#!/usr/bin/env node
/**
 * 🗣️ ¿CUÁNTOS TRADUCTORES DE ERRORES HAY, Y CLASIFICAN IGUAL? — gemelo G68 (29-sep-2026), SOLO LECTURA.
 *
 * En la app de transporte había DOS funciones llamadas `motivoDeRechazo` (y dos `apuntarRechazo`):
 *   · guajirago/src/avisoRechazo.js — la pieza de LA LEY DEL BOTÓN, «la única que sabe decir el motivo»; desde el
 *     26-sep-2026 le quita el apellido al código («functions/permission-denied» → «permission-denied») y respeta la
 *     frase de nuestro servidor.
 *   · guajirago/src/avisoCalificacion.js — la de la calificación (Calificacion.js y Restaurantes.js), que se quedó
 *     como estaba: un código con apellido caía en «otro».
 *
 *   node scripts/medir-traductores-g68.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-traductores-g68.cjs --commit <hash>  <- el de ese commit (careo antes/después)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Se CORREN los dos traductores con la MISMA lista de errores (los 16 códigos de Firebase, pelados y con apellido
 *     `functions/`, los de la foto `storage/…`, y los raros) y se cuenta en cuántos la calificación da OTRA CLASE que
 *     la pieza. La clase es lo que se guarda en la bandeja de rechazos (guardarRechazo) y lo que decide el aviso.
 *  2. Que la calificación siga diciendo SUS palabras (las de MOTIVOS), una por clase.
 *  3. Cuántas funciones `motivoDeRechazo` / `apuntarRechazo` hay definidas en guajirago/src.
 *  4. Quién importa de avisoCalificacion.js y quién de avisoRechazo.js, en las TRES apps.
 *  5. Si hay copias de avisoCalificacion.js en el panel o en aliados (si las hubiera, habría que atarlas).
 * No lee Firestore: el gemelo es de código, no de datos.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo } = require('../pruebas/cargar.cjs');

const PIEZA = 'guajirago/src/avisoRechazo.js';
const CALIF = 'guajirago/src/avisoCalificacion.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];

// Los 16 códigos de Firebase (Firestore y Functions comparten la lista).
const CODIGOS = ['cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded', 'not-found', 'already-exists',
  'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'out-of-range', 'unimplemented',
  'internal', 'unavailable', 'data-loss', 'unauthenticated'];

function errores(fuentes) {
  const lista = [];
  // Los que nombra cualquiera de las dos piezas, por si mañana aprenden uno que no está arriba.
  const nombrados = new Set(CODIGOS);
  for (const f of fuentes) for (const m of f.matchAll(/codigo === '([^']+)'/g)) nombrados.add(m[1]);
  for (const c of nombrados) {
    lista.push({ code: c, message: 'Missing or insufficient permissions.' });
    lista.push({ code: 'functions/' + c, message: c }); // sin frase: el mensaje es el código pelado
  }
  lista.push({ code: 'storage/unauthorized', message: 'User does not have permission to access this object.' });
  lista.push({ code: 'storage/retry-limit-exceeded', message: 'Max retry time for operation exceeded.' });
  lista.push({ code: 'functions/failed-precondition', message: 'Ese pedido ya no se puede calificar [400]' });
  lista.push({ code: 'functions/internal', message: 'internal [0]' });
  for (const raro of [null, undefined, {}, 'un texto suelto', new Error('boom'), { code: 42 }]) lista.push(raro);
  return lista;
}

const nombreDe = (e) => (e && typeof e === 'object' && 'code' in e) ? String(e.code) + (/\s/.test(e.message || '') && !/^Missing|^User|^Max/.test(e.message) ? ' «' + e.message + '»' : '')
  : JSON.stringify(e === undefined ? '(undefined)' : (e instanceof Error ? 'Error(' + e.message + ')' : e));

function fuenteDe(archivo, commit) {
  if (!commit) {
    const r = path.join(RAIZ, archivo);
    return fs.existsSync(r) ? fs.readFileSync(r, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['show', commit + ':' + archivo], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return null; }
}

// Los archivos .js de una carpeta (del disco, o del commit si es del repo raíz).
function archivos(carpeta, commit) {
  const repoAparte = !carpeta.startsWith('guajirago/');
  if (commit && !repoAparte) {
    return execFileSync('git', ['ls-tree', '-r', '--name-only', commit, carpeta], { cwd: RAIZ, encoding: 'utf8' })
      .split(/\r?\n/).filter((f) => f.endsWith('.js'));
  }
  const base = path.join(RAIZ, carpeta);
  if (!fs.existsSync(base)) return [];
  const salida = [];
  const andar = (d) => {
    for (const n of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, n.name);
      if (n.isDirectory()) andar(p);
      else if (n.name.endsWith('.js')) salida.push(path.relative(RAIZ, p).split(path.sep).join('/'));
    }
  };
  andar(base);
  return salida;
}

/**
 * El traductor de la calificación, sea cual sea su forma: hoy `motivoDeCalificacion(e)`; antes de G68,
 * `motivoDeRechazo(e)` dentro de avisoCalificacion.js. Devuelve { motivo(e), MOTIVOS, nombre }.
 */
function traductorDeLaCalificacion(fuente) {
  const m = cargarDeLaApp(CALIF, fuente);
  const nombre = typeof m.motivoDeCalificacion === 'function' ? 'motivoDeCalificacion'
    : (typeof m.motivoDeRechazo === 'function' ? 'motivoDeRechazo' : null);
  if (!nombre) throw new Error(CALIF + ' no exporta ningún traductor (ni motivoDeCalificacion ni motivoDeRechazo)');
  return { motivo: (e) => m[nombre](e), MOTIVOS: m.MOTIVOS, nombre };
}

function medir({ commit = null, fuentePieza = null, fuenteCalif = null } = {}) {
  const pieza = fuentePieza != null ? fuentePieza : fuenteDe(PIEZA, commit);
  const calif = fuenteCalif != null ? fuenteCalif : fuenteDe(CALIF, commit);
  const P = cargarDeLaApp(PIEZA, pieza);
  const C = traductorDeLaCalificacion(calif);

  // 1. Los dos traductores con la MISMA lista.
  const casos = errores([pieza, calif]).map((e) => {
    const deLaPieza = P.motivoDeRechazo(e, 'guardar tu calificación').clave;
    const m = C.motivo(e);
    const deLaCalif = m && m.clave;
    return { error: nombreDe(e), deLaPieza, deLaCalif, igual: deLaPieza === deLaCalif, motivo: m };
  });
  const distintos = casos.filter((c) => !c.igual);

  // 2. Las palabras propias de la calificación: cada clase devuelve SU motivo de MOTIVOS.
  const palabrasPropias = casos.every((c) => c.motivo && C.MOTIVOS[c.deLaCalif] === c.motivo);

  // 3. Definiciones de las dos funciones en guajirago/src.
  const defs = { motivoDeRechazo: [], apuntarRechazo: [] };
  const importan = { avisoCalificacion: [], avisoRechazo: [] };
  const copias = [];
  for (const carpeta of CARPETAS) {
    for (const f of archivos(carpeta, carpeta.startsWith('guajirago/') ? commit : null)) {
      const t = f === PIEZA ? pieza : (f === CALIF ? calif : fuenteDe(f, f.startsWith('guajirago/') ? commit : null));
      if (t == null) continue;
      const c = soloCodigo(t);
      if (carpeta === 'guajirago/src') {
        for (const n of Object.keys(defs)) if (new RegExp('function\\s+' + n + '\\s*\\(').test(c)) defs[n].push(f);
      }
      const mc = c.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/avisoCalificacion'/);
      if (mc) importan.avisoCalificacion.push(f + ' → ' + mc[1].trim().replace(/\s+/g, ' '));
      const mr = c.match(/import\s*\{([^}]*)\}\s*from\s*'\.\/avisoRechazo'/);
      if (mr) importan.avisoRechazo.push(f + ' → ' + mr[1].trim().replace(/\s+/g, ' '));
      if (/avisoCalificacion\.js$/.test(f) && f !== CALIF) copias.push(f);
    }
  }
  return { commit, traductor: C.nombre, casos, distintos, palabrasPropias, defs, importan, copias };
}

function informe(r) {
  const L = [];
  L.push('🗣️  G68 · los traductores de errores de la app de transporte' + (r.commit ? '  (commit ' + r.commit + ')' : '  (el disco)'));
  L.push('');
  L.push('1. La MISMA lista de ' + r.casos.length + ' errores por la pieza (avisoRechazo.js) y por la calificación (' + r.traductor + '):');
  L.push('   dan OTRA CLASE en ' + r.distintos.length + ' de ' + r.casos.length);
  for (const d of r.distintos) L.push('     ✗ ' + d.error + ': la pieza dice «' + d.deLaPieza + '», la calificación «' + d.deLaCalif + '»');
  L.push('   la calificación dice SUS palabras (MOTIVOS) en cada caso: ' + (r.palabrasPropias ? 'sí' : 'NO'));
  L.push('');
  L.push('2. Funciones definidas en guajirago/src:');
  for (const [n, fs2] of Object.entries(r.defs)) L.push('   ' + n + ': ' + fs2.length + '  (' + fs2.join(', ') + ')');
  L.push('');
  L.push('3. Quién importa:');
  L.push('   de avisoCalificacion.js (' + r.importan.avisoCalificacion.length + '):');
  for (const x of r.importan.avisoCalificacion) L.push('     · ' + x);
  L.push('   de avisoRechazo.js (' + r.importan.avisoRechazo.length + ', en las tres apps)');
  L.push('');
  L.push('4. Copias de avisoCalificacion.js en el panel o en aliados: ' + r.copias.length + (r.copias.length ? ' (' + r.copias.join(', ') + ')' : ''));
  return L.join('\n');
}

module.exports = { medir, informe, errores, traductorDeLaCalificacion };

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : null;
  console.log(informe(medir({ commit })));
}
