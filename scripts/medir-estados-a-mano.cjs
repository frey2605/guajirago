#!/usr/bin/env node
/**
 * 🚦 «BUSCANDO CONDUCTOR» Y «ACEPTADO»: ¿CUÁNTAS VECES ESTÁN ESCRITOS A MANO? — gemelo G55, SOLO LECTURA.
 *
 * El nombre de los dos estados vivos del viaje (`esperando` = buscando conductor, `aceptado` = ya tiene conductor)
 * vive en `guajirago/src/estadosViaje.js` (ESTADOS_MERCADO, ESTADOS_EN_CURSO). Hasta el G55 el servidor
 * (functions/index.js, functions/viajesColgados.cjs) y la pantalla del conductor (AppConductor.js) los escribían A MANO
 * en sus comparaciones, y ninguna prueba ataba esos textos a la fuente: si la app renombraba un estado, el servidor
 * dejaba de avisar a los conductores, de confirmar ofertas y de cerrar colgados, sin un solo rojo.
 *
 * Qué cuenta:
 *   · en el CÓDIGO (sin comentarios): cuántas veces aparece `'esperando'` / `'aceptado'` escrito a mano en cada archivo,
 *     y si el servidor tiene una pieza de estados (`functions/estadosViaje.cjs`) que diga lo mismo que la app;
 *   · EJECUTANDO la calculadora de colgados (`queHacerConElViaje`) de ese commit con una batería de viajes, para el
 *     careo antes/después: tiene que decidir exactamente lo mismo;
 *   · en PRODUCCIÓN: cuántos viajes hay en cada estado, y si alguno lleva un estado que la app no conoce.
 *
 *   node scripts/medir-estados-a-mano.cjs                 → el código de hoy + producción
 *   node scripts/medir-estados-a-mano.cjs --commit <c>    → el código de ese commit (careo)
 *   node scripts/medir-estados-a-mano.cjs --sin-nube      → solo el código
 */
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ, leer, soloCodigo, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const ARCHIVOS = [
  'guajirago/functions/index.js',
  'guajirago/functions/viajesColgados.cjs',
  'guajirago/functions/estadosViaje.cjs',
  'guajirago/src/AppConductor.js',
  'guajirago/src/estadosViaje.js',
];
const A_MANO = /['"](esperando|aceptado)['"]/g;

function deGit(commit, ruta) {
  try {
    return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

function fuente(commit, ruta) {
  if (commit) return deGit(commit, ruta);
  try { return leer(ruta); } catch (e) { return null; }
}

/** Carga el texto de un .cjs como módulo, con los `require('./x.cjs')` de su carpeta resueltos desde el mismo commit. */
function cargarCjs(texto, commit) {
  const module = { exports: {} };
  const req = (r) => {
    if (r.startsWith('./')) {
      const t = fuente(commit, 'guajirago/functions/' + r.slice(2));
      if (t == null) throw new Error('no encuentro ' + r + (commit ? ' en ' + commit : ''));
      return cargarCjs(t, commit);
    }
    return require(r);
  };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', texto)(module, module.exports, req);
  return module.exports;
}

/** Cuántas veces está cada estado escrito a mano, archivo por archivo. */
function contarAMano(commit) {
  const filas = {};
  for (const ruta of ARCHIVOS) {
    const t = fuente(commit, ruta);
    if (t == null) { filas[ruta] = null; continue; }
    const c = { esperando: 0, aceptado: 0 };
    for (const m of soloCodigo(t).matchAll(A_MANO)) c[m[1]] += 1;
    filas[ruta] = c;
  }
  return filas;
}

/** ¿El servidor tiene su pieza, y dice lo mismo que la app? */
function atadura(commit) {
  const textoApp = fuente(commit, 'guajirago/src/estadosViaje.js');
  const app = cargarDeLaApp('guajirago/src/estadosViaje.js', textoApp);
  const textoPieza = fuente(commit, 'guajirago/functions/estadosViaje.cjs');
  if (textoPieza == null) return { pieza: false, app };
  const srv = cargarCjs(textoPieza, commit);
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return {
    pieza: true, app, srv,
    mismoMercado: igual(srv.ESTADOS_MERCADO, app.ESTADOS_MERCADO),
    mismoAceptado: srv.ESTADO_ACEPTADO === app.ESTADO_ACEPTADO,
    mismoEnCurso: igual(srv.ESTADOS_EN_CURSO, app.ESTADOS_EN_CURSO),
  };
}

/** La batería del careo: la calculadora de colgados de ese commit, ejecutada. */
const AHORA = '2026-09-29T12:00:00.000Z';
const haceMin = (m) => new Date(new Date(AHORA).getTime() - m * 60000).toISOString();
const BATERIA = [
  ['buscando 5 min', { estado: 'esperando', fechaSolicitud: haceMin(5) }],
  ['buscando 21 min', { estado: 'esperando', fechaSolicitud: haceMin(21) }],
  ['aceptado 10 min sin recoger', { estado: 'aceptado', fechaAceptacion: haceMin(10) }],
  ['aceptado 61 min sin recoger', { estado: 'aceptado', fechaAceptacion: haceMin(61) }],
  ['en_viaje 100 min', { estado: 'aceptado', fase: 'en_viaje', fechaAceptacion: haceMin(100) }],
  ['en_punto 181 min', { estado: 'aceptado', fase: 'en_punto', fechaAceptacion: haceMin(181) }],
  ['finalizado viejo', { estado: 'finalizado', fechaSolicitud: haceMin(999) }],
  ['vencido viejo', { estado: 'vencido', fechaSolicitud: haceMin(999) }],
  ['sin estado', { fechaSolicitud: haceMin(999) }],
];
function careoColgados(commit) {
  const t = fuente(commit, 'guajirago/functions/viajesColgados.cjs');
  const { queHacerConElViaje } = cargarCjs(t, commit);
  return BATERIA.map(([nombre, v]) => {
    const r = queHacerConElViaje(v, AHORA);
    return [nombre, r.cerrar ? 'cierra → ' + r.estado : 'no toca'];
  });
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--commit');
  const commit = i >= 0 ? args[i + 1] : null;
  console.log('🚦 G55 · estados «esperando» / «aceptado» escritos a mano' + (commit ? ' — commit ' + commit : ' — código de hoy'));
  console.log('');

  const filas = contarAMano(commit);
  let fueraDeLaFuente = 0;
  for (const [ruta, c] of Object.entries(filas)) {
    if (!c) { console.log('   ' + ruta.padEnd(42) + ' (no existe)'); continue; }
    const esFuente = ruta.endsWith('estadosViaje.js') || ruta.endsWith('estadosViaje.cjs');
    if (!esFuente) fueraDeLaFuente += c.esperando + c.aceptado;
    console.log('   ' + ruta.padEnd(42) + ' esperando ×' + c.esperando + '  aceptado ×' + c.aceptado + (esFuente ? '   (fuente)' : ''));
  }
  console.log('');
  console.log('   ESCRITOS A MANO FUERA DE LA FUENTE (servidor + pantalla del conductor): ' + fueraDeLaFuente);

  const a = atadura(commit);
  if (!a.pieza) {
    console.log('   PIEZA DE ESTADOS DEL SERVIDOR: no existe — el servidor no tiene de dónde sacar los nombres');
  } else {
    console.log('   PIEZA DE ESTADOS DEL SERVIDOR: existe · mercado ' + (a.mismoMercado ? '=' : '≠') + ' app · aceptado '
      + (a.mismoAceptado ? '=' : '≠') + ' app · en curso ' + (a.mismoEnCurso ? '=' : '≠') + ' app');
  }

  console.log('');
  console.log('   CAREO · la calculadora de colgados de este código, ejecutada:');
  for (const [nombre, r] of careoColgados(commit)) console.log('     · ' + nombre.padEnd(30) + r);

  if (args.includes('--sin-nube')) return;
  const N = require('./nube.cjs');
  const viajes = (await N.traer('viajes')).map(N.doc);
  const porEstado = {};
  for (const v of viajes) porEstado[v.estado || '(sin estado)'] = (porEstado[v.estado || '(sin estado)'] || 0) + 1;
  const conocidos = new Set([...a.app.ESTADOS_EN_CURSO, ...a.app.ESTADOS_TERMINADOS]);
  console.log('');
  console.log('   PRODUCCIÓN · ' + viajes.length + ' viajes por estado:');
  for (const [e, n] of Object.entries(porEstado).sort((x, y) => y[1] - x[1])) {
    console.log('     · ' + e.padEnd(22) + String(n).padStart(4) + (conocidos.has(e) ? '' : '   ⚠ la app no lo conoce'));
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
}

module.exports = { contarAMano, atadura, careoColgados };
