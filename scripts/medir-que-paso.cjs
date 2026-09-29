#!/usr/bin/env node
/**
 * «¿QUÉ PASÓ CON ESTE VIAJE?» — LAS PALABRAS DE CADA FINAL Y SU PORQUÉ, pantalla por pantalla. SOLO LECTURA.
 *
 * Pasos 1 y 12 del gemelo G56 (29-sep-2026). Cada final del viaje (cancelado, cancelado_conductor, vencido, expirado,
 * finalizado) se decía con TRES tablas de textos: la pieza de la app (`comoTermino`, guajirago/src/estadosViaje.js), el
 * `etiquetaEstado` de 🚕 Viajes del panel y el `NOMBRE_DEL_FINAL` de 📦 Mensajería del panel; y las dos del panel no
 * decían lo mismo del MISMO mandado. Además el porqué que escribe el servidor al cerrar un viaje (`motivoExpiracion`)
 * no lo enseñaba ninguna tarjeta: solo enseñaban `razonCancelacion`, que es el de las personas.
 *
 * Este guion NO copia ninguna tabla: saca de cada archivo la etiqueta (y el renglón «Razón:/Motivo:») y los EJECUTA con
 * los viajes de producción.
 *
 *   node scripts/medir-que-paso.cjs                                   → el código de la carpeta de trabajo
 *   node scripts/medir-que-paso.cjs --commit X --commit-panel Y       → la app del commit X y el panel del Y (careo)
 */
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { leer, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { declaracion } = require('./medir-estados-panel.cjs');

const RAIZ = path.resolve(__dirname, '..');

/** Un archivo: el de la carpeta de trabajo, o el de un commit (del repo raíz o del panel). null si no existe. */
function fuente(ruta, commit) {
  if (!commit) {
    try { return leer(ruta); } catch (e) { return null; }
  }
  const panel = ruta.startsWith('guajirago-admin/');
  const repo = panel ? path.join(RAIZ, 'guajirago-admin') : RAIZ;
  const rel = panel ? ruta.replace(/^guajirago-admin\//, '') : ruta;
  try {
    return execFileSync('git', ['-C', repo, 'show', commit + ':' + rel],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

const sinComentarios = (t) => t.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Arma una función con las declaraciones `const` pedidas (las que haya), con lo que exporta la pieza a mano. */
function armar(codigo, nombres, extras, devolver) {
  const partes = nombres.map((n) => declaracion(codigo, n).texto).filter(Boolean);
  const claves = Object.keys(extras);
  // eslint-disable-next-line no-new-func
  return new Function(...claves, partes.join('\n') + '\nreturn (' + devolver + ');')(...claves.map((k) => extras[k]));
}

/**
 * El renglón `{condición && <p ...>Etiqueta: {expresión}</p>}` que enseña el porqué en una tarjeta, EJECUTABLE.
 * `desde` es un texto que lo precede (para coger el de la tarjeta del historial y no el de otra ventanita).
 * Devuelve `{ condicion, expresion, correr(ambito) }`, o null si la tarjeta no tiene ese renglón.
 */
function elRenglonDelPorque(codigo, etiqueta, desde, variables) {
  const t = sinComentarios(codigo);
  const i = desde ? t.indexOf(desde) : 0;
  if (i < 0) return null;
  const re = new RegExp('\\{([^{}\\n]*?)&&\\s*<p[^>]*>' + etiqueta + ':\\s*\\{([^}]+)\\}');
  const m = re.exec(t.slice(i));
  if (!m) return null;
  // eslint-disable-next-line no-new-func
  const f = new Function(...variables, 'return (' + m[1] + ') ? String(' + m[2] + ') : "";');
  return { condicion: m[1].trim(), expresion: m[2].trim(), correr: (a) => f(...variables.map((k) => a[k])) };
}

/** Todo lo que se puede ejecutar de un par de commits (o de la carpeta de trabajo). `textos` pisa archivos (pruebas). */
function lasPantallas(commitApp, commitPanel, textos = {}) {
  const t = (ruta, commit) => (ruta in textos ? textos[ruta] : fuente(ruta, commit));
  const tPieza = t('guajirago/src/estadosViaje.js', commitApp);
  const tCopia = t('guajirago-admin/src/estadosViaje.js', commitPanel);
  const tVia = t('guajirago-admin/src/Viajes.js', commitPanel);
  const tMen = t('guajirago-admin/src/Mensajeria.js', commitPanel);
  const tCond = t('guajirago/src/AppConductor.js', commitApp);
  const tHome = t('guajirago/src/Home.js', commitApp);
  const tMis = t('guajirago/src/MisViajes.js', commitApp);
  for (const [n, x] of [['pieza de la app', tPieza], ['copia del panel', tCopia], ['Viajes.js', tVia],
    ['Mensajeria.js', tMen], ['AppConductor.js', tCond], ['Home.js', tHome], ['MisViajes.js', tMis]]) {
    assert.ok(x, 'no pude leer ' + n);
  }
  const pieza = cargarDeLaApp('guajirago/src/estadosViaje.js', tPieza);
  const copia = cargarDeLaApp('guajirago-admin/src/estadosViaje.js', tCopia);

  const etiquetaViajes = armar(sinComentarios(tVia), ['etiquetaEstado'], { ...copia }, 'etiquetaEstado');
  const men = sinComentarios(tMen);
  const etiquetaMensajeria = armar(men, ['esEnCurso', 'esEntregado', 'esCancelado', 'NOMBRE_DEL_FINAL', 'etiquetaEstado'],
    { ...copia }, 'etiquetaEstado');
  const esCancelado = armar(men, ['esCancelado'], { ...copia }, 'esCancelado');

  // El porqué de cada tarjeta. En la app, la tarjeta del historial es la que llama `comoTermino(`.
  const historial = (texto, quien) => {
    const r = elRenglonDelPorque(texto, 'Razón', 'comoTermino(v,', ['v', 'fin']);
    return r && { ...r, ver: (v) => r.correr({ v, fin: pieza.comoTermino(v, quien) }) };
  };
  const rMen = elRenglonDelPorque(tMen, 'Motivo', 'const tarjetaMandado', ['m', 'est', 'esCancelado']);
  const rDet = elRenglonDelPorque(tVia, '⏱️ Motivo', 'const renderDetalle', ['v', 'et']);
  return {
    pieza, copia,
    viajes: (v) => etiquetaViajes(v),
    mensajeria: (v) => etiquetaMensajeria(v.estado, v),
    porque: {
      'historial del conductor (AppConductor.js)': historial(tCond, 'conductor'),
      'historial del pasajero (Home.js)': historial(tHome, 'pasajero'),
      'Mis viajes (MisViajes.js)': historial(tMis, 'pasajero'),
      '📦 Mensajería del panel': rMen && { ...rMen,
        ver: (v) => rMen.correr({ m: v, est: etiquetaMensajeria(v.estado, v), esCancelado }) },
      // El detalle de 🚕 Viajes: el renglón del porqué cuando NO lo canceló una persona (el cierre del sistema).
      '🚕 Viajes del panel (detalle)': rDet && { ...rDet, ver: (v) => rDet.correr({ v, et: etiquetaViajes(v) }) },
    },
  };
}

/** Lo que se mide, función pura: la prueba la corre con viajes de mentira. */
function medir(viajes, P) {
  const finales = viajes.filter((v) => P.pieza.ESTADOS_TERMINADOS.includes(v.estado));
  const mandados = finales.filter((v) => v.tipo === 'Mensajería');
  const distintos = mandados.filter((v) => P.viajes(v).texto !== P.mensajeria(v).t);
  const conMotivo = finales.filter((v) => typeof v.motivoExpiracion === 'string' && v.motivoExpiracion.trim());
  const porque = {};
  for (const [nombre, r] of Object.entries(P.porque)) {
    const lista = nombre.includes('Mensajería') ? conMotivo.filter((v) => v.tipo === 'Mensajería') : conMotivo;
    const mudos = r ? lista.filter((v) => !r.ver(v).includes(v.motivoExpiracion.trim())) : lista;
    porque[nombre] = { de: lista.length, mudos: mudos.length, renglon: r ? r.condicion + ' → ' + r.expresion : '(no hay renglón)' };
    // Y un viaje DE EJEMPLO que cerró el servidor: producción puede no tener ninguno con el porqué escrito.
    const ejemplo = { estado: 'expirado', tipo: 'Mensajería', motivoExpiracion: 'EJEMPLO-G56' };
    porque[nombre].ejemplo = !!r && r.ver(ejemplo).includes('EJEMPLO-G56');
  }
  // Por cada final, lo que dice cada pantalla (un viaje de taxi y un mandado de mentira: las palabras, no los datos).
  const tabla = P.pieza.ESTADOS_TERMINADOS.map((estado) => ({
    estado,
    viajesTaxi: P.viajes({ estado, tipo: 'Taxi' }).texto,
    viajesMandado: P.viajes({ estado, tipo: 'Mensajería' }).texto,
    mensajeria: P.mensajeria({ estado, tipo: 'Mensajería' }).t,
    conductor: P.pieza.comoTermino({ estado }, 'conductor').texto,
    pasajero: P.pieza.comoTermino({ estado }, 'pasajero').texto,
  }));
  const finalesConDosTextos = tabla.filter((f) => f.viajesMandado !== f.mensajeria).map((f) => f.estado);
  return { finales: finales.length, mandados: mandados.length, distintos, conMotivo: conMotivo.length, porque, tabla,
    finalesConDosTextos };
}

async function main() {
  const N = require('./nube.cjs');
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const commitApp = arg('--commit');
  const commitPanel = arg('--commit-panel');
  const P = lasPantallas(commitApp, commitPanel);
  const viajes = (await N.traer('viajes')).map(N.doc);
  const r = medir(viajes, P);
  console.log('App: ' + (commitApp || 'carpeta de trabajo') + ' · panel: ' + (commitPanel || 'carpeta de trabajo'));
  console.log('Viajes en producción: ' + viajes.length + ' · terminados: ' + r.finales + ' · mandados terminados: '
    + r.mandados + ' · con porqué del servidor (motivoExpiracion): ' + r.conMotivo);
  console.log('\nLO QUE DICE CADA PANTALLA DE CADA FINAL');
  for (const f of r.tabla) {
    console.log('  ' + f.estado.padEnd(20) + ' 🚕 Viajes (taxi): «' + f.viajesTaxi + '» · 🚕 Viajes (mandado): «'
      + f.viajesMandado + '» · 📦 Mensajería: «' + f.mensajeria + '» · conductor: «' + f.conductor + '» · pasajero: «'
      + f.pasajero + '»');
  }
  console.log('\n  ' + (r.finalesConDosTextos.length ? '🔴' : '✓ ') + ' finales que el panel dice de dos formas para el MISMO mandado: '
    + r.finalesConDosTextos.length + (r.finalesConDosTextos.length ? ' (' + r.finalesConDosTextos.join(', ') + ')' : ''));
  console.log('  ' + (r.distintos.length ? '🔴' : '✓ ') + ' mandados de producción con una palabra en 🚕 Viajes y otra en 📦 Mensajería: '
    + r.distintos.length + ' de ' + r.mandados);
  console.log('\nEL PORQUÉ DEL SERVIDOR (motivoExpiracion): ¿lo enseña la tarjeta?');
  for (const [n, x] of Object.entries(r.porque)) {
    console.log('  ' + (x.mudos || !x.ejemplo ? '🔴' : '✓ ') + ' ' + n + ': ' + x.mudos + ' de ' + x.de + ' sin su porqué · con un viaje de ejemplo cerrado por el servidor: '
      + (x.ejemplo ? 'lo enseña' : 'NO lo enseña') + ' · ' + x.renglon);
  }
  if (N.tiposQueNoSupe && N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { lasPantallas, medir, elRenglonDelPorque };
