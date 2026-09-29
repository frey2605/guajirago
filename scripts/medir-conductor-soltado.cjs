#!/usr/bin/env node
/**
 * ¿QUÉ SE BORRA AL SOLTAR AL CONDUCTOR DE UN VIAJE, Y QUIÉN ACEPTA? — gemelo G59 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-conductor-soltado.cjs              (el código de hoy + los viajes de producción)
 *   node scripts/medir-conductor-soltado.cjs --sin-red    (solo el código)
 *   node scripts/medir-conductor-soltado.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * Al conductor lo pone en el viaje UNA sola pieza: `confirmarConductor` (guajirago/functions/index.js), en el
 * servidor, que escribe su id, su nombre, su teléfono, su placa, su vehículo, su foto y su color. Soltarlo (devolver
 * el viaje al mercado sin él) lo hacía la app a mano, y cada sitio borraba SU lista: ninguna borraba la foto ni el
 * color, que el servidor escribe desde hace tiempo. Y en la pantalla del pasajero había un segundo camino para
 * aceptar —la ventanita «¿Confirmas este viaje?»— que ponía `aceptado` a mano, sin pasar por el servidor.
 *
 * Mide, EJECUTANDO los objetos que se escriben (no buscando textos):
 *   1. los campos del conductor que escribe `confirmarConductor` (se corre el objeto de su `t.update`);
 *   2. cada escritura de la app que suelta al conductor (`conductorId: null`) y qué campos del conductor le quedan
 *      sin borrar;
 *   3. las escrituras de la app que ponen el viaje en «aceptado» (el único que acepta debe ser el servidor);
 *   4. si la ventanita de confirmar se puede abrir: las entradas que ponen `confirmacionPendiente` en algo que no
 *      salga de ella misma. Cero = camino muerto.
 *   5. DATOS (producción): viajes con restos de un conductor soltado (sin conductorId pero con su nombre, placa, foto…)
 *      y viajes en el mercado que aún tienen conductor.
 * No escribe nada.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { leer, soloCodigo, sinTextos, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const FUNCIONES = 'guajirago/functions/index.js';
const SOLICITAR = 'guajirago/src/Solicitar.js';
const CARPETA_APP = 'guajirago/src';
const PIEZA = 'guajirago/src/conductorDelViaje.js';
const ESTADOS = 'guajirago/src/estadosViaje.js';

function fuente(ruta, commit) {
  if (!commit) return fs.existsSync(path.join(RAIZ, ruta)) ? leer(ruta) : null;
  try {
    return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + ruta],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

function archivosDeLaApp(commit) {
  const nombres = commit
    ? execFileSync('git', ['-C', RAIZ, 'ls-tree', '--name-only', commit + ':' + CARPETA_APP], { encoding: 'utf8' }).split('\n')
    : fs.readdirSync(path.join(RAIZ, CARPETA_APP));
  return nombres.filter((n) => n.endsWith('.js') && !n.endsWith('.test.js')).map((n) => CARPETA_APP + '/' + n);
}

/** Desde la llave o el paréntesis en `pos`, hasta el que lo cierra (en el código sin textos). */
function hastaElQueCierra(seguro, pos) {
  const abre = seguro[pos];
  const cierra = abre === '{' ? '}' : ')';
  let hondo = 0;
  for (let k = pos; k < seguro.length; k++) {
    if (seguro[k] === abre) hondo++;
    else if (seguro[k] === cierra && --hondo === 0) return k + 1;
  }
  return -1;
}

// Un «cualquier cosa» que se deja llamar, leer y convertir: lo que un objeto nombre y no se le dé, vale esto.
const CUALQUIERA = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 'x' : k === 'then' ? undefined : CUALQUIERA),
  apply: () => CUALQUIERA,
  construct: () => CUALQUIERA,
});
const DE_VERDAD = ['Date', 'Number', 'String', 'Object', 'Math', 'JSON', 'Array', 'undefined', 'null'];

/** EJECUTA el texto de un objeto `{ … }`. Lo que nombre y no esté en `reales` vale CUALQUIERA. */
function evaluarObjeto(texto, reales = {}) {
  const alcance = new Proxy({}, {
    has: () => true,
    get: (t, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (Object.prototype.hasOwnProperty.call(reales, k)) return reales[k];
      if (DE_VERDAD.includes(k)) return globalThis[k];
      return CUALQUIERA;
    },
  });
  // eslint-disable-next-line no-new-func
  return new Function('alcance', 'with (alcance) { return (' + texto + '); }')(alcance);
}

/** Los campos que escribe `confirmarConductor` en el viaje: se EJECUTA el objeto de su `t.update(viajeRef, …)`. */
function camposDelServidor(index) {
  const codigo = soloCodigo(index.replace(/\r\n/g, '\n'));
  const i = codigo.indexOf('exports.confirmarConductor = ');
  if (i < 0) throw new Error('functions/index.js ya no exporta confirmarConductor');
  const j = codigo.indexOf('t.update(viajeRef, {', i);
  if (j < 0) throw new Error('confirmarConductor ya no escribe el viaje con t.update(viajeRef, { … })');
  const seguro = sinTextos(codigo);
  const desde = codigo.indexOf('{', j);
  const obj = evaluarObjeto(codigo.slice(desde, hastaElQueCierra(seguro, desde)));
  const claves = Object.keys(obj);
  return { todos: claves, delConductor: claves.filter((k) => /^conductor[A-Z]/.test(k)).sort() };
}

/** Las piezas que un objeto de la app puede usar: los estados y la lista del conductor (si ya existe). */
function piezasDeLaApp(commit) {
  const reales = {};
  for (const ruta of [ESTADOS, PIEZA]) {
    const f = fuente(ruta, commit);
    if (f) Object.assign(reales, cargarDeLaApp(ruta, f));
  }
  return reales;
}

/** Cada `updateDoc(ref, { … })` de un archivo, con su objeto EJECUTADO. */
function escriturasDe(texto, reales) {
  const codigo = soloCodigo(texto.replace(/\r\n/g, '\n'));
  const seguro = sinTextos(codigo);
  const salen = [];
  for (const m of seguro.matchAll(/\bupdateDoc\s*\(/g)) {
    const par = m.index + m[0].length - 1;
    const fin = hastaElQueCierra(seguro, par);
    // el segundo argumento: la primera llave del primer nivel después de la primera coma del primer nivel
    let hondo = 0; let coma = -1;
    for (let k = par + 1; k < fin - 1; k++) {
      const c = seguro[k];
      if ('({['.includes(c)) hondo++;
      else if (')}]'.includes(c)) hondo--;
      else if (c === ',' && hondo === 0) { coma = k; break; }
    }
    if (coma < 0) continue;
    const llave = seguro.slice(coma + 1).search(/\S/) + coma + 1;
    if (seguro[llave] !== '{') continue;
    let obj;
    try { obj = evaluarObjeto(codigo.slice(llave, hastaElQueCierra(seguro, llave)), reales); } catch (e) { continue; }
    salen.push({ renglon: codigo.slice(0, m.index).split('\n').length, obj });
  }
  return salen;
}

/** Las escrituras de la app que sueltan al conductor, y las que aceptan el viaje. */
function escriturasDeLaApp(archivos, reales, delConductor) {
  const sueltan = [];
  const aceptan = [];
  const aceptado = reales.ESTADO_ACEPTADO || 'aceptado';
  for (const [ruta, texto] of Object.entries(archivos)) {
    for (const e of escriturasDe(texto, reales)) {
      const donde = ruta.replace(CARPETA_APP + '/', '') + ':' + e.renglon;
      if (Object.prototype.hasOwnProperty.call(e.obj, 'conductorId') && e.obj.conductorId === null) {
        sueltan.push({ donde, leQuedan: delConductor.filter((c) => e.obj[c] !== null) });
      }
      if (e.obj.estado === aceptado) aceptan.push(donde);
    }
  }
  return { sueltan, aceptan };
}

/**
 * ¿Se puede abrir la ventanita «¿Confirmas este viaje?»? Cuenta las veces que `confirmacionPendiente` se pone en algo
 * que no sea `null` NI una copia de sí misma (`const x = confirmacionPendiente; … setConfirmacionPendiente(x)`).
 */
function laVentanitaDeConfirmar(texto) {
  const codigo = soloCodigo(texto.replace(/\r\n/g, '\n'));
  const usos = (codigo.match(/\bconfirmacionPendiente\b/g) || []).length;
  if (!usos && !/setConfirmacionPendiente/.test(codigo)) return { existe: false, entradas: 0, usos: 0 };
  const copias = new Set([...codigo.matchAll(/const\s+(\w+)\s*=\s*confirmacionPendiente\s*;/g)].map((m) => m[1]));
  const inicial = codigo.match(/\[\s*confirmacionPendiente\s*,\s*setConfirmacionPendiente\s*\]\s*=\s*useState\(([^)]*)\)/);
  let entradas = inicial && inicial[1].trim() !== 'null' && inicial[1].trim() !== '' ? 1 : 0;
  for (const m of codigo.matchAll(/\bsetConfirmacionPendiente\s*\(([^)]*)\)/g)) {
    const arg = m[1].trim();
    if (arg !== 'null' && !copias.has(arg)) entradas++;
  }
  return { existe: true, entradas, usos };
}

/** DATOS: restos de un conductor soltado, y viajes del mercado que siguen con conductor. */
function restosEnLosViajes(viajes, delConductor, mercado) {
  const lleno = (v) => v !== undefined && v !== null && v !== '';
  const restos = viajes.filter((v) => !lleno(v.conductorId) && delConductor.some((c) => c !== 'conductorId' && lleno(v[c])));
  const mercadoConConductor = viajes.filter((v) => mercado.includes(v.estado) && lleno(v.conductorId));
  return { total: viajes.length, restos, mercadoConConductor };
}

function medirCodigo(commit) {
  const servidor = camposDelServidor(fuente(FUNCIONES, commit));
  const reales = piezasDeLaApp(commit);
  const archivos = {};
  for (const r of archivosDeLaApp(commit)) archivos[r] = fuente(r, commit);
  return { servidor, ...escriturasDeLaApp(archivos, reales, servidor.delConductor),
    ventanita: laVentanitaDeConfirmar(fuente(SOLICITAR, commit)), reales };
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const r = medirCodigo(commit);
  console.log('🚕 SOLTAR AL CONDUCTOR DEL VIAJE · ' + (commit ? 'commit ' + commit : 'carpeta de trabajo'));
  console.log('  campos del conductor que escribe confirmarConductor: ' + r.servidor.delConductor.length
    + ' (' + r.servidor.delConductor.join(', ') + ')');
  console.log('  escrituras de la app que sueltan al conductor: ' + r.sueltan.length);
  for (const s of r.sueltan) {
    console.log('    · ' + s.donde + ' → le quedan sin borrar ' + s.leQuedan.length
      + (s.leQuedan.length ? ': ' + s.leQuedan.join(', ') : ''));
  }
  const conHueco = r.sueltan.filter((s) => s.leQuedan.length).length;
  console.log('  escrituras que dejan restos del conductor: ' + conHueco + ' de ' + r.sueltan.length);
  console.log('  escrituras de la app que ponen el viaje en «aceptado» (debe ser solo el servidor): ' + r.aceptan.length
    + (r.aceptan.length ? ' → ' + r.aceptan.join(', ') : ''));
  console.log('  ventanita «¿Confirmas este viaje?»: ' + (r.ventanita.existe
    ? 'existe (' + r.ventanita.usos + ' usos) · entradas que la abren: ' + r.ventanita.entradas
      + (r.ventanita.entradas ? '' : ' → CAMINO MUERTO')
    : 'no existe'));
  if (process.argv.includes('--sin-red')) return;
  const N = require('./nube.cjs');
  const viajes = (await N.traer('viajes')).map(N.doc);
  const d = restosEnLosViajes(viajes, r.servidor.delConductor, r.reales.ESTADOS_MERCADO || ['esperando']);
  console.log('DATOS (producción): viajes ' + d.total
    + ' · con restos de un conductor soltado (sin conductorId pero con sus datos): ' + d.restos.length
    + ' · en el mercado y todavía con conductor: ' + d.mercadoConConductor.length);
  for (const v of d.restos) console.log('    · resto: ' + v.id + ' (' + v.estado + ')');
  for (const v of d.mercadoConConductor) console.log('    · mercado con conductor: ' + v.id + ' (' + v.estado + ')');
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { camposDelServidor, escriturasDe, escriturasDeLaApp, laVentanitaDeConfirmar, restosEnLosViajes,
  evaluarObjeto, piezasDeLaApp, medirCodigo };
