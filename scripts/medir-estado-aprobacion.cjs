#!/usr/bin/env node
/**
 * 🕒 ¿EN QUÉ ESTADO DE APROBACIÓN ESTÁ ESTE NEGOCIO? — gemelo G50 (29-sep-2026) · SOLO LECTURA
 *
 * El panel tiene TRES listas que contestan «¿quién está pendiente de aprobar?»: 🍽️ Restaurantes, 🧭 Turismo y
 * 🤝 Aliados pendientes. Cada una lo decidía a su manera, y en 🤝 Aliados pendientes un negocio SUSPENDIDO salía como
 * si fuera un registro nuevo por revisar: sin su etiqueta, en naranja, con «Rechazar» y «✅ Aprobar».
 *
 * Este guion NO lee las listas como texto: SACA de cada pantalla lo que decide el estado y lo EJECUTA.
 *   · 🍽️ / 🧭: `estadoInfo` (la etiqueta de la tarjeta) y el filtro de `pendientes` (la pestaña «Pendientes»).
 *   · 🤝: la tarjeta ENTERA de cada negocio (el `lista.map(a => { … })`), compilada con el Babel del panel y pintada
 *     con React; de lo pintado se lee qué etiqueta lleva y qué botones ofrece.
 * Y se compara con la regla única `estadoDeAprobacion` de guajirago-admin/src/aprobarNegocio.js (la del DISCO, que
 * hace de juez también cuando se corre el código de otro commit). Si la regla todavía no existe, el juez es otro:
 * que las tres listas digan lo mismo.
 *
 *   node scripts/medir-estado-aprobacion.cjs [--commit-panel <hash>]
 *
 * Con `--commit-panel` corre las pantallas de ese commit (careo antes/después). No escribe nada.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cuerpoDeLaFuncion, soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const PANEL = 'guajirago-admin';
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const LA_PIEZA = 'src/aprobarNegocio.js';
// Las tres listas: su archivo, su nombre, y qué negocios le llegan (la consulta o el filtro de tipo de cada pantalla).
const LAS_LISTAS = [
  { ruta: 'src/Restaurantes.js', nombre: '🍽️ Restaurantes', tipo: 'ficha', llega: (n) => n.tipoNegocio !== 'turismo' },
  { ruta: 'src/Turismo.js', nombre: '🧭 Turismo', tipo: 'ficha', llega: (n) => n.tipoNegocio === 'turismo' },
  { ruta: 'src/AliadosPendientes.js', nombre: '🤝 Aliados pendientes', tipo: 'tarjeta', llega: (n) => n.aprobado === false },
];
const ESTADOS = ['pendiente', 'aprobado', 'suspendido', 'rechazado'];

/** El texto de un archivo del panel: el del disco, o el de un commit. null si no existe. */
function textoDe(ruta, commit) {
  if (!commit) {
    const p = path.join(RAIZ, PANEL, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, PANEL), 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

/** La pieza (`aprobarNegocio.js`) sin su import de firebase, con lo que exporta. {} si no está. */
function laPieza(commit, leerTexto = textoDe) {
  const t = leerTexto(LA_PIEZA, commit);
  if (t == null) return {};
  const limpio = t.replace(/\r\n/g, '\n').replace(/^import\s*\{[^}]*\}\s*from\s*'firebase\/firestore';?[ \t]*$/m, '');
  if (/^import\s/m.test(limpio)) throw new Error(PANEL + '/' + LA_PIEZA + ' importa algo más: este lector no sabe cargarlo');
  const nombres = [...limpio.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  return new Function('doc', 'updateDoc', limpio.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')(() => ({}), async () => {});
}

/** El juez: la regla única del DISCO. null si todavía no existe. */
function elJuez() {
  const p = laPieza(null);
  return typeof p.estadoDeAprobacion === 'function' ? p.estadoDeAprobacion : null;
}

/** Lo que va entre el paréntesis que abre en `abre` y el que lo cierra. */
function entreParentesis(t, abre) {
  const s = sinTextos(t);
  let i = abre + 1;
  let hondo = 1;
  while (i < s.length && hondo > 0) {
    if (s[i] === '(') hondo += 1;
    else if (s[i] === ')') hondo -= 1;
    i += 1;
  }
  return t.slice(abre + 1, i - 1);
}

/** «APROBADA», «SUSPENDIDO»… → el estado. null si la etiqueta no es de ninguno. */
function estadoDeEtiqueta(txt) {
  const t = String(txt || '').toUpperCase();
  if (t.startsWith('APROBAD')) return 'aprobado';
  if (t.startsWith('PENDIENTE')) return 'pendiente';
  if (t.startsWith('SUSPENDID')) return 'suspendido';
  if (t.startsWith('RECHAZAD')) return 'rechazado';
  return null;
}

/**
 * 🍽️ / 🧭 · `estadoInfo` y el filtro de `pendientes`, SACADOS del archivo y listos para correr:
 * (negocio) => { estado, enPendientes }.
 */
function laFicha(ruta, commit, pieza, leerTexto = textoDe) {
  const texto = leerTexto(ruta, commit);
  if (texto == null) throw new Error('no está ' + PANEL + '/' + ruta + (commit ? ' en ' + commit : ''));
  const t = soloCodigo(texto).replace(/\r\n/g, '\n');
  const m = /const estadoInfo\s*=\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/.exec(t);
  if (!m) throw new Error('no encuentro «const estadoInfo = (x) =>» en ' + PANEL + '/' + ruta);
  const cuerpo = cuerpoDeLaFuncion(t, m.index);
  const p = /const pendientes\s*=\s*lista\.filter\(/.exec(t);
  if (!p) throw new Error('no encuentro «const pendientes = lista.filter(» en ' + PANEL + '/' + ruta);
  const filtro = entreParentesis(t, p.index + p[0].length - 1);
  const piezas = { VERDE: 'verde', ROJO: 'rojo', AMBAR: 'ambar', NARANJA: 'naranja', estadoDeAprobacion: pieza.estadoDeAprobacion };
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  const hecho = new Function(...nombres, 'return { info: (' + m[1] + ') => {' + cuerpo.texto + '}, filtro: (' + filtro + ') };')(...nombres.map((n) => piezas[n]));
  return (negocio) => {
    const info = hecho.info(negocio);
    return { estado: estadoDeEtiqueta(info && info.t), etiqueta: info && info.t, enPendientes: [negocio].filter(hecho.filtro).length === 1 };
  };
}

/** Babel y React del panel (los mismos con que se compila). */
function herramientasDelPanel() {
  const nm = path.join(RAIZ, PANEL, 'node_modules');
  const pedir = (n) => {
    try { return require(path.join(nm, n)); } catch (e) {
      throw new Error('para pintar la tarjeta hace falta ' + n + ' en ' + PANEL + '/node_modules (npm ci dentro del panel): ' + e.message);
    }
  };
  return { babel: pedir('@babel/core'), presetReact: pedir('@babel/preset-react'), React: pedir('react'), servidor: pedir('react-dom/server') };
}

/**
 * 🤝 · la tarjeta de cada negocio (`lista.map(a => { … })`), compilada y PINTADA: (negocio) => { estado, botones, html }.
 * Lo que la tarjeta toma de fuera se le da de mentira; si pide algo que no se le dio, revienta (y se ve).
 */
function laTarjeta(ruta, commit, pieza, leerTexto = textoDe) {
  const texto = leerTexto(ruta, commit);
  if (texto == null) throw new Error('no está ' + PANEL + '/' + ruta + (commit ? ' en ' + commit : ''));
  const t = soloCodigo(texto).replace(/\r\n/g, '\n');
  const m = /lista\.map\(\s*([A-Za-z_$][\w$]*)\s*=>\s*\{/.exec(t);
  if (!m) throw new Error('no encuentro «lista.map(a => {» en ' + PANEL + '/' + ruta);
  const cuerpo = cuerpoDeLaFuncion(t, m.index);
  const { babel, presetReact, React, servidor } = herramientasDelPanel();
  const js = babel.transformSync('(' + m[1] + ') => {' + cuerpo.texto + '}', {
    presets: [[presetReact, { runtime: 'classic' }]], babelrc: false, configFile: false,
  }).code.replace(/;\s*$/, '');
  const piezas = {
    React, NARANJA: '#FF7A2F', VERDE: '#2ECC71', ROJO: '#E33',
    card: {}, btn: () => ({}), tipoTxt: () => '', fechaTxt: () => '',
    guardando: '', aprobar: () => {}, rechazar: () => {},
    estadoDeAprobacion: pieza.estadoDeAprobacion,
  };
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  const pintar = new Function(...nombres, 'return ' + js + ';')(...nombres.map((n) => piezas[n]));
  return (negocio) => {
    const html = servidor.renderToStaticMarkup(pintar(negocio));
    const soloTexto = html.replace(/<[^>]*>/g, '|');
    const botones = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((b) => b[1]);
    // La etiqueta: un texto suelto que sea el nombre de un estado. Sin etiqueta, la tarjeta se presenta como pendiente.
    const etiquetas = soloTexto.split('|').map((s) => s.trim()).filter((s) => estadoDeEtiqueta(s) && /^[A-ZÁÉÍÓÚ ]+$/.test(s));
    const estado = etiquetas.length ? estadoDeEtiqueta(etiquetas[0]) : 'pendiente';
    return { estado, etiqueta: etiquetas[0] || '(sin etiqueta: se ve como pendiente)', botones, enPendientes: estado === 'pendiente' };
  };
}

/** Las tres listas del commit, listas para correr: [{ nombre, llega, ver(negocio) }]. */
function lasTresListas(commit, leerTexto = textoDe) {
  const pieza = laPieza(commit, leerTexto);
  return LAS_LISTAS.map((l) => ({
    ...l,
    ver: l.tipo === 'ficha' ? laFicha(l.ruta, commit, pieza, leerTexto) : laTarjeta(l.ruta, commit, pieza, leerTexto),
  }));
}

// Los casos que deciden, uno por estado y los dos «viejos» (sin campo). `debe` = lo que es de verdad.
const CASOS = [
  { que: 'recién registrado (estadoAprobacion «pendiente»)', debe: 'pendiente', negocio: { id: 'c1', aprobado: false, estadoAprobacion: 'pendiente' } },
  { que: 'sin aprobar y sin estadoAprobacion', debe: 'pendiente', negocio: { id: 'c2', aprobado: false } },
  { que: 'SUSPENDIDO desde el panel', debe: 'suspendido', negocio: { id: 'c3', aprobado: false, estadoAprobacion: 'suspendido' } },
  { que: 'rechazado', debe: 'rechazado', negocio: { id: 'c4', aprobado: false, estadoAprobacion: 'rechazado', fechaRechazo: '2026-09-01T00:00:00Z' } },
  { que: 'aprobado', debe: 'aprobado', negocio: { id: 'c5', aprobado: true, estadoAprobacion: 'aprobado' } },
  { que: 'negocio viejo sin el campo aprobado', debe: 'aprobado', negocio: { id: 'c6' } },
];

/**
 * Cada caso por las tres listas (sin el filtro de tipo: se pregunta «si le llegara, ¿cómo lo enseña?»; la de 🤝 sí
 * respeta su consulta `aprobado == false`). Devuelve { filas, malos }.
 */
function losCasos(commit, leerTexto = textoDe) {
  const listas = lasTresListas(commit, leerTexto);
  const filas = [];
  let malos = 0;
  for (const c of CASOS) {
    for (const l of listas) {
      if (l.nombre.startsWith('🤝') && !l.llega(c.negocio)) continue;
      const v = l.ver({ ...c.negocio });
      const fallos = [];
      if (v.estado !== c.debe) fallos.push('lo enseña como «' + v.estado + '» (' + v.etiqueta + ') y es «' + c.debe + '»');
      if (v.enPendientes !== (c.debe === 'pendiente')) fallos.push(v.enPendientes ? 'lo cuenta entre los pendientes' : 'no lo cuenta entre los pendientes');
      if (fallos.length) malos += 1;
      filas.push({ caso: c.que, debe: c.debe, lista: l.nombre, visto: v, fallos });
    }
  }
  return { filas, malos };
}

async function main() {
  const commit = arg('--commit-panel');
  const juez = elJuez();
  console.log('\n🕒 ¿EN QUÉ ESTADO DE APROBACIÓN ESTÁ ESTE NEGOCIO? — G50 · código del panel: ' + (commit || 'el del disco'));
  console.log('   juez: ' + (juez ? 'la regla única estadoDeAprobacion (aprobarNegocio.js del disco)' : 'NO HAY regla única todavía → se juzga que las tres listas digan lo mismo'));

  const { filas, malos } = losCasos(commit);
  console.log('\n1. SEIS CASOS POR LAS TRES LISTAS (ejecutadas):');
  for (const f of filas) {
    console.log('   ' + (f.fallos.length ? '🔴' : '✓ ') + ' ' + f.lista.padEnd(22) + ' · ' + f.caso + ' → ' + f.visto.estado
      + (f.visto.botones ? ' · botones: ' + f.visto.botones.join(' / ') : '')
      + (f.fallos.length ? '\n        ' + f.fallos.join(' · ') : ''));
  }
  console.log('   → ' + malos + ' de ' + filas.length + ' combinaciones enseñan un estado que no es');

  // 2. Producción: cuántos negocios caen en cada estado en cada lista.
  const { traer, val } = require('./nube.cjs');
  const crudos = await traer('negocios');
  const listas = lasTresListas(commit);
  const negocios = crudos.map((d) => {
    const f = d.fields || {};
    const n = { id: d.name.split('/').pop() };
    for (const k of Object.keys(f)) n[k] = val(f[k]);
    return n;
  });
  console.log('\n2. PRODUCCIÓN · ' + negocios.length + ' negocios:');
  for (const n of negocios) {
    const ver = (x) => (x === undefined ? '(sin campo)' : JSON.stringify(x));
    console.log('   · ' + n.id.slice(0, 12) + ' «' + (n.nombre || '') + '» ' + (n.tipoNegocio || '(sin tipo)')
      + ' · aprobado=' + ver(n.aprobado) + ' estadoAprobacion=' + ver(n.estadoAprobacion) + (juez ? ' · la regla dice: ' + juez(n) : ''));
  }
  let contra = 0;
  let desacuerdos = 0;
  const porNegocio = {};
  for (const l of listas) {
    const cuenta = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
    let llegan = 0;
    let pend = 0;
    for (const n of negocios) {
      if (!l.llega(n)) continue;
      llegan += 1;
      const v = l.ver({ ...n });
      cuenta[v.estado] = (cuenta[v.estado] || 0) + 1;
      if (v.enPendientes) pend += 1;
      (porNegocio[n.id] = porNegocio[n.id] || new Set()).add(v.estado);
      if (juez && juez(n) !== v.estado) {
        contra += 1;
        console.log('   🔴 ' + l.nombre + ' enseña a «' + (n.nombre || n.id) + '» como ' + v.estado + ' y la regla dice ' + juez(n));
      }
    }
    console.log('   ' + l.nombre.padEnd(22) + ' le llegan ' + llegan + ' · ' + ESTADOS.map((e) => e + ' ' + cuenta[e]).join(' · ') + ' · en «pendientes»: ' + pend);
  }
  for (const [id, s] of Object.entries(porNegocio)) if (s.size > 1) { desacuerdos += 1; console.log('   🔴 ' + id + ': las listas no se ponen de acuerdo: ' + [...s].join(' / ')); }
  console.log('   → negocios en que dos listas dicen cosas distintas: ' + desacuerdos + (juez ? ' · lista×negocio contra la regla: ' + contra : ''));

  console.log(malos ? '\n🔴 ' + malos + ' combinaciones de los casos enseñan un estado que no es' : '\n✓ las tres listas enseñan el estado que es, y cuentan como pendiente solo al pendiente');
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + (e && e.message)); process.exit(1); });
}

module.exports = { LAS_LISTAS, CASOS, ESTADOS, lasTresListas, losCasos, laFicha, laTarjeta, laPieza, elJuez, textoDe };
