#!/usr/bin/env node
/**
 * ¿CUÁNTAS VECES SE ESCRIBE «SOLTAR AL CONDUCTOR»? — gemelo G57 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-soltar-conductor.cjs              (el código de hoy + las fichas de producción)
 *   node scripts/medir-soltar-conductor.cjs --sin-red    (solo el código)
 *   node scripts/medir-soltar-conductor.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * Cuando el viaje se acaba, el conductor tiene que quedar LIBRE (`ocupado: false`, `enViajeId: null` en su ficha
 * `conductores/{uid}`) y su pantalla tiene que SALIR del viaje (fase, viaje, pasajero, destino, mensajes, contador…).
 * Hasta el 29-sep-2026 eso estaba escrito a mano en CUATRO sitios de AppConductor.js —cancelar, terminar, el botón
 * «El pasajero canceló» y el cierre del servidor (G20)— y cada sitio limpiaba una lista distinta.
 *
 * Mide dos cosas:
 *   1. CÓDIGO: cuántas escrituras de «soltar» hay y cuántos sitios sacan la pantalla del viaje, y QUÉ deja cada uno
 *      sin limpiar comparado con los demás (lo que se queda pegado para el viaje siguiente).
 *   2. DATOS (producción): fichas de conductor que siguen «ocupadas» o con la marca de un viaje ya terminado — lo que
 *      dejaría un «soltar» que no entró. Esa cuenta NO se copia: sale de medir-ficha-conductor.cjs (G02).
 * No escribe nada.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { leer, soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

const APP = 'guajirago/src/AppConductor.js';
const RAIZ = path.join(__dirname, '..');
// La escritura de soltar. La de cerrar sesión (G07) lleva además `activo: false` y es OTRA cosa (apagarse): no cuenta.
const SOLTAR = /doc\(db,\s*'conductores',\s*user\.uid\),\s*\{\s*ocupado:\s*false,\s*enViajeId:\s*null\s*\}/g;
// Lo que no es «estado del viaje»: la ventanita del aviso, la calificación del que termina y la escritura misma.
const NO_CUENTA = new Set(['setAviso', 'setDatosCalificacion', 'setDoc']);

function fuente(commit) {
  if (!commit) return leer(APP);
  return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + APP], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** El bloque `{ … }` que encierra la posición `pos` (en el código sin textos). */
function bloqueQueEncierra(seguro, pos) {
  let hondo = 0, abre = -1;
  for (let k = pos; k >= 0; k--) {
    const c = seguro[k];
    if (c === '}') hondo++;
    else if (c === '{') { if (hondo === 0) { abre = k; break; } hondo--; }
  }
  if (abre < 0) return null;
  hondo = 0;
  for (let k = abre; k < seguro.length; k++) {
    if (seguro[k] === '{') hondo++;
    else if (seguro[k] === '}' && --hondo === 0) return { desde: abre, hasta: k + 1 };
  }
  return null;
}

/** Lo que limpia un trozo de pantalla: los `setX(` y los `xRef.current = null`. */
function loQueLimpia(trozo) {
  const s = new Set();
  for (const m of trozo.matchAll(/\b(set[A-Z]\w*)\s*\(/g)) if (!NO_CUENTA.has(m[1])) s.add(m[1]);
  for (const m of trozo.matchAll(/\b(\w+Ref)\.current\s*=\s*null/g)) s.add(m[1] + '.current = null');
  return s;
}

/** Función pura: del código de AppConductor.js, las escrituras de soltar y los sitios que sacan la pantalla del viaje. */
function medirCodigo(codigoFuente) {
  const codigo = soloCodigo(codigoFuente);
  const seguro = sinTextos(codigo);
  const renglon = (pos) => codigo.slice(0, pos).split('\n').length;
  const escrituras = [...codigo.matchAll(SOLTAR)].map((m) => renglon(m.index));
  const sitios = [];
  for (const m of seguro.matchAll(/\bsetFase\s*\(\s*null\s*\)/g)) {
    const b = bloqueQueEncierra(seguro, m.index);
    sitios.push({ renglon: renglon(m.index), limpia: loQueLimpia(b ? codigo.slice(b.desde, b.hasta) : '') });
  }
  const todo = new Set(sitios.flatMap((s) => [...s.limpia]));
  for (const s of sitios) s.leFalta = [...todo].filter((x) => !s.limpia.has(x)).sort();
  const llamadas = [...seguro.matchAll(/\bsoltarmeDelViaje\s*\(/g)].length;
  return { escrituras, sitios, llamadasAlaPieza: llamadas /* la definición (`= async (modo)`) no calza */ };
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const r = medirCodigo(fuente(commit));
  console.log('🚕 SOLTAR AL CONDUCTOR · ' + APP + (commit ? ' (commit ' + commit + ')' : ' (carpeta de trabajo)'));
  console.log('  escrituras de «soltar» (ocupado:false, enViajeId:null): ' + r.escrituras.length
    + (r.escrituras.length ? ' → renglones (sin comentarios) ' + r.escrituras.join(', ') : ''));
  console.log('  sitios que sacan la pantalla del viaje (setFase(null)): ' + r.sitios.length);
  console.log('  llamadas a la pieza soltarmeDelViaje: ' + r.llamadasAlaPieza);
  const conHueco = r.sitios.filter((s) => s.leFalta.length);
  console.log('  sitios que dejan algo SIN limpiar que otro sí limpia: ' + conHueco.length);
  for (const s of conHueco) console.log('    · renglón ' + s.renglon + ': le falta ' + s.leFalta.join(', '));
  if (process.argv.includes('--sin-red')) return;
  const N = require('./nube.cjs');
  const { medir } = require('./medir-ficha-conductor.cjs');
  const fichas = (await N.traer('conductores')).map(N.doc);
  const viajes = (await N.traer('viajes')).map(N.doc);
  const f = medir(fichas, viajes);
  console.log('DATOS (producción): fichas ' + f.fichas + ' · ocupadas ' + f.ocupados + ' · con viaje puesto ' + f.conViaje
    + ' · marcas que apuntan a un viaje terminado o que no existe: ' + f.marcasViejas.length);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medirCodigo };
