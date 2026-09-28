#!/usr/bin/env node
/**
 * LAS LISTAS DE ESTADOS DEL VIAJE EN EL PANEL — gemelo G25 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-estados-panel.cjs                 (el código de hoy)
 *   node scripts/medir-estados-panel.cjs --antes <rev>   (y además el de <rev> del repo guajirago-admin, para carear)
 *
 * El panel (guajirago-admin) decide en varios sitios en qué caja cae cada viaje, y cada uno llevaba su lista de
 * estados escrita a mano. La fuente es `guajirago/src/estadosViaje.js` (ESTADOS_EN_CURSO, ESTADOS_TERMINADOS).
 * Este guion NO copia las listas del panel: SACA del archivo cada decisión y la EJECUTA viaje por viaje, con los
 * viajes de producción, y la compara con lo que dice la fuente:
 *
 *   · tablero (App.js)         «Cancelados» de las gráficas  → debería ser: terminado y no finalizado
 *   · tablero (App.js)         «EN CURSO»                    → debería ser: ESTADOS_EN_CURSO (sin mirar la fase)
 *   · ficha del pasajero       «❌ Cancelados»               → debería ser: terminado y no finalizado
 *   · buscador de Viajes.js    el desplegable de ESTADO      → debería ofrecer TODOS los estados
 *   · pestañas de Viajes.js    en curso / completados / cancelados → cada viaje en una, y solo una
 *   · Mensajería               la caja de cada mandado
 *
 * El «EN CURSO» del tablero lleva además un filtro de la última hora; aquí se mide SOLO la lista (con el reloj
 * abierto), porque los viajes de producción son de julio y con el reloj de verdad las dos versiones dan 0.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const ADMIN = path.join(RAIZ, 'guajirago-admin');
const ARCHIVOS = ['estadosViaje.js', 'App.js', 'Pasajeros.js', 'Viajes.js', 'Mensajeria.js'];

/** Un archivo del panel: el del disco, o el de una revisión (`git show`). null si no existe allí. */
function archivoDelPanel(nombre, rev) {
  if (!rev) {
    const r = path.join(ADMIN, 'src', nombre);
    return fs.existsSync(r) ? fs.readFileSync(r, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', ADMIN, 'show', rev + ':src/' + nombre],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return null;
  }
}

/** Ejecuta un archivo puro de export (la copia del panel) y devuelve lo que exporta. */
function cargarPuro(texto) {
  if (!texto) return {};
  const nombres = [...texto.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  return new Function(texto.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
}

const sinTextos = (t) => t.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
  (m) => m[0] + ' '.repeat(m.length - 2) + m[m.length - 1]);
const sinComentarios = (t) => t.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/**
 * La declaración `const <nombre> = … ;` entera, contando paréntesis, corchetes y llaves (fuera de los textos).
 * `veces` dice cuántas hay con ese nombre: si son dos, una tapa a la otra y quien mide lo tiene que decir.
 */
function declaracion(codigo, nombre) {
  const limpio = sinTextos(codigo);
  const re = new RegExp('\\bconst\\s+' + nombre + '\\s*=', 'g');
  const inicios = [...limpio.matchAll(re)].map((m) => m.index);
  if (inicios.length === 0) return { texto: null, veces: 0 };
  const desde = inicios[0];
  let hondo = 0;
  for (let i = desde; i < limpio.length; i++) {
    const c = limpio[i];
    if ('([{'.includes(c)) hondo++;
    else if (')]}'.includes(c)) hondo--;
    else if (c === ';' && hondo === 0) return { texto: codigo.slice(desde, i + 1), veces: inicios.length };
  }
  return { texto: null, veces: inicios.length };
}

/**
 * Arma una función con las declaraciones pedidas (las que existan, en ese orden). Lo que exporta la copia del panel
 * entra como parámetro, salvo lo que el archivo declare él mismo (eso manda, como en el navegador).
 */
function armar(codigo, nombres, extras, devolver) {
  const partes = [];
  const locales = new Set();
  for (const n of nombres) {
    const d = declaracion(codigo, n);
    if (d.texto) { partes.push(d.texto); locales.add(n); }
  }
  const params = Object.keys(extras).filter((k) => !locales.has(k));
  // eslint-disable-next-line no-new-func
  const f = new Function(...params, partes.join('\n') + '\nreturn (' + devolver + ');');
  return (sobre = {}) => f(...params.map((k) => (k in sobre ? sobre[k] : extras[k])));
}

/**
 * Lee las decisiones del panel de unos textos (los del disco, los de una revisión, o de mentira en la prueba) y
 * devuelve funciones que se corren con UN viaje.
 */
function lasDecisiones(textos) {
  const copia = cargarPuro(textos['estadosViaje.js']);
  const app = sinComentarios(textos['App.js'] || '');
  const pas = sinComentarios(textos['Pasajeros.js'] || '');
  const via = sinComentarios(textos['Viajes.js'] || '');
  const men = sinComentarios(textos['Mensajeria.js'] || '');

  const tablero = armar(app, ['cancelados'], { ...copia, viajes: [], enRango: () => true, fechaViaje: () => true },
    'cancelados(0, 0)');
  const enCursoTablero = armar(app, ['enCurso'],
    { ...copia, viajes: [], hace1h: new Date(0), fechaEnCurso: () => new Date() }, 'enCurso');
  const fichaPasajero = armar(pas, ['cancelados'], { ...copia, viajesPas: [] }, 'cancelados.length');

  // El desplegable del buscador: los <option value="x"> escritos a mano, más las listas de la copia que se
  // recorran con `.map(` dentro del <select>.
  const sel = /<select\s+value=\{filtroEstado\}[\s\S]*?<\/select>/.exec(via);
  let opciones = null;
  if (sel) {
    const escritas = [...sel[0].matchAll(/<option\s+value="([^"]*)"/g)].map((m) => m[1]).filter(Boolean);
    const recorridas = Object.keys(copia).filter((k) => Array.isArray(copia[k])
      && new RegExp('\\b' + k + '\\.map\\(').test(sel[0])).flatMap((k) => copia[k]);
    opciones = [...new Set([...escritas, ...recorridas])];
  }

  // Las pestañas de Viajes.js: «en curso» es la consulta; «completados» y «cancelados» filtran la lista cargada.
  const consulta = /where\(\s*'estado'\s*,\s*'in'\s*,\s*(\[[^\]]*\]|[A-Z_][A-Z0-9_]*)\s*\)/.exec(via);
  let enCursoPestana = null;
  if (consulta) {
    enCursoPestana = consulta[1].startsWith('[')
      ? consulta[1].slice(1, -1).replace(/['"\s]/g, '').split(',').filter(Boolean)
      : copia[consulta[1]] || null;
  }
  const cancPestana = armar(via, ['NO_COMPLETADOS', 'noCompleto'], { ...copia }, 'noCompleto')();

  const cajas = armar(men, ['esEnCurso', 'esEntregado', 'esCancelado', 'NOMBRE_DEL_FINAL', 'etiquetaEstado'],
    { ...copia }, '{ esEnCurso, esEntregado, esCancelado, etiquetaEstado }')();

  return {
    copia,
    canceladoEnTablero: (v) => tablero({ viajes: [v] }) === 1,
    enCursoEnTablero: (v) => enCursoTablero({ viajes: [v] }) === 1,
    canceladoEnFicha: (v) => fichaPasajero({ viajesPas: [v] }) === 1,
    opcionesDelBuscador: opciones,
    pestanas: (v) => {
      const cual = [];
      if (enCursoPestana && enCursoPestana.includes(v.estado)) cual.push('en curso');
      if (v.estado === 'finalizado') cual.push('completados');
      if (cancPestana(v)) cual.push('cancelados');
      return cual;
    },
    cajaMandado: (v) => {
      const dentro = [];
      if (cajas.esEnCurso(v.estado)) dentro.push('en curso');
      if (cajas.esEntregado(v.estado)) dentro.push('entregado');
      if (cajas.esCancelado(v.estado)) dentro.push('cancelado');
      const et = cajas.etiquetaEstado(v.estado);
      return { cajas: dentro, etiqueta: et.t, color: et.c };
    },
  };
}

function textosDe(rev) {
  const t = {};
  for (const n of ARCHIVOS) t[n] = archivoDelPanel(n, rev);
  return t;
}

/** Lo que dice la FUENTE (la app) de cada viaje. */
function laFuente(fuente) {
  const noCompletados = fuente.ESTADOS_TERMINADOS.filter((e) => e !== 'finalizado');
  return {
    cancelado: (v) => noCompletados.includes(v.estado),
    enCurso: (v) => fuente.ESTADOS_EN_CURSO.includes(v.estado),
    todos: [...fuente.ESTADOS_EN_CURSO, ...fuente.ESTADOS_TERMINADOS],
  };
}

/**
 * Cuenta, para un juego de decisiones, cuántos viajes caen distinto de lo que dice la fuente en cada sitio.
 * Función pura: la prueba la corre con viajes de mentira.
 */
function contar(viajes, d, fuente) {
  const F = laFuente(fuente);
  const mal = (f, g) => viajes.filter((v) => f(v) !== g(v));
  const mandados = viajes.filter((v) => v.tipo === 'Mensajería');
  const opc = d.opcionesDelBuscador || [];
  const cajasMal = mandados.filter((v) => {
    const c = d.cajaMandado(v);
    const debe = v.estado === 'finalizado' ? 'entregado' : F.enCurso(v) ? 'en curso' : F.cancelado(v) ? 'cancelado' : null;
    const naranjaSinVida = !F.enCurso(v) && /#FF7A2F/i.test(c.color);
    return naranjaSinVida || (debe ? (c.cajas.length !== 1 || c.cajas[0] !== debe) : c.cajas.length !== 0);
  });
  return {
    total: viajes.length,
    tableroCancelados: { cuenta: viajes.filter(d.canceladoEnTablero).length, deberia: viajes.filter(F.cancelado).length,
      mal: mal(d.canceladoEnTablero, F.cancelado) },
    tableroEnCurso: { cuenta: viajes.filter(d.enCursoEnTablero).length, deberia: viajes.filter(F.enCurso).length,
      mal: mal(d.enCursoEnTablero, F.enCurso) },
    fichaCancelados: { cuenta: viajes.filter(d.canceladoEnFicha).length, deberia: viajes.filter(F.cancelado).length,
      mal: mal(d.canceladoEnFicha, F.cancelado) },
    buscador: {
      opciones: d.opcionesDelBuscador,
      faltan: F.todos.filter((e) => !opc.includes(e)),
      viajesQueNoSePuedenBuscar: viajes.filter((v) => !opc.includes(v.estado)),
    },
    pestanas: { mal: viajes.filter((v) => F.todos.includes(v.estado) && d.pestanas(v).length !== 1) },
    mandados: { total: mandados.length, mal: cajasMal },
  };
}

const porEstado = (lista) => {
  const m = {};
  for (const v of lista) m[v.estado || '(sin estado)'] = (m[v.estado || '(sin estado)'] || 0) + 1;
  return Object.entries(m).map(([k, n]) => k + ' ' + n).join(', ') || '—';
};

function imprimir(titulo, c) {
  console.log('\n══ ' + titulo + ' ══');
  const fila = (nombre, x) => console.log('  ' + (x.mal.length ? '🔴' : '✓ ') + ' ' + nombre + ': cuenta ' + x.cuenta
    + ' · la fuente dice ' + x.deberia + ' · viajes que caen distinto: ' + x.mal.length
    + (x.mal.length ? ' (' + porEstado(x.mal) + ')' : ''));
  fila('tablero «Cancelados» (App.js)', c.tableroCancelados);
  fila('tablero «EN CURSO» (App.js, sin el reloj)', c.tableroEnCurso);
  fila('ficha del pasajero «Cancelados» (Pasajeros.js)', c.fichaCancelados);
  const b = c.buscador;
  console.log('  ' + (b.faltan.length ? '🔴' : '✓ ') + ' buscador de Viajes.js: ofrece '
    + (b.opciones ? b.opciones.join(', ') : '(no lo pude leer)')
    + (b.faltan.length ? ' · le faltan ' + b.faltan.join(', ') : '')
    + ' · viajes que no se pueden buscar por su estado: ' + b.viajesQueNoSePuedenBuscar.length
    + (b.viajesQueNoSePuedenBuscar.length ? ' (' + porEstado(b.viajesQueNoSePuedenBuscar) + ')' : ''));
  console.log('  ' + (c.pestanas.mal.length ? '🔴' : '✓ ') + ' pestañas de Viajes.js: viajes sin pestaña o en dos: '
    + c.pestanas.mal.length);
  console.log('  ' + (c.mandados.mal.length ? '🔴' : '✓ ') + ' cajas de Mensajería: ' + c.mandados.mal.length + ' de '
    + c.mandados.total + ' mandados en la caja equivocada');
}

async function main() {
  const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
  const fuente = cargarDeLaApp('guajirago/src/estadosViaje.js');
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  console.log('🚕 viajes en producción: ' + viajes.length + ' (' + porEstado(viajes) + ')');
  const i = process.argv.indexOf('--antes');
  let antes = null;
  if (i > 0 && process.argv[i + 1]) {
    const rev = process.argv[i + 1];
    antes = contar(viajes, lasDecisiones(textosDe(rev)), fuente);
    imprimir('EL PANEL EN ' + rev, antes);
  }
  const hoy = contar(viajes, lasDecisiones(textosDe(null)), fuente);
  imprimir('EL PANEL DEL DISCO (hoy)', hoy);
  if (antes) {
    console.log('\n── lo que cambia de ANTES a HOY ──');
    const d = (n, a, b) => console.log('  ' + n + ': ' + a + ' → ' + b);
    d('tablero «Cancelados» (todos los días juntos)', antes.tableroCancelados.cuenta, hoy.tableroCancelados.cuenta);
    d('tablero «EN CURSO» (sin reloj)', antes.tableroEnCurso.cuenta, hoy.tableroEnCurso.cuenta);
    d('fichas de pasajero «Cancelados» (sumando todas)', antes.fichaCancelados.cuenta, hoy.fichaCancelados.cuenta);
    d('viajes que el buscador no encuentra por estado', antes.buscador.viajesQueNoSePuedenBuscar.length,
      hoy.buscador.viajesQueNoSePuedenBuscar.length);
    d('mandados en la caja equivocada', antes.mandados.mal.length, hoy.mandados.mal.length);
  }
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { lasDecisiones, contar, declaracion, textosDe, ARCHIVOS };
