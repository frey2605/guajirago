#!/usr/bin/env node
/**
 * EL PLAZO DE LA BÚSQUEDA Y EL «VENCIDO» DEL CELULAR — gemelo G27 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-vencido-busqueda.cjs            (datos de producción + el código)
 *   node scripts/medir-vencido-busqueda.cjs --sin-red  (solo el código)
 *
 * Mide DOS cosas:
 *   1. DATOS (producción): cuántos viajes están en `vencido`, y cuántos dicen quién los venció, cuándo y por qué
 *      (`expiradoPor`, `fechaExpiracion`, `motivoExpiracion`). El servidor los escribe desde el 10-sep-2026; el
 *      celular del pasajero, que vence la búsqueda a los 2 minutos, escribía solo `{ estado: 'vencido' }`.
 *      Nada de esto se toca: los viejos se quedan como están.
 *   2. CÓDIGO: cuántos números del plazo de búsqueda quedan escritos a mano en las dos pantallas (el 60000 de
 *      ampliar, el 120000 de agotar, el 120 del reloj, el 240 de arranque, el 2 * 60 * 1000 del conductor) y cuántas
 *      escrituras del `vencido` salen sin rastro.
 *
 * 🔑 Lo que NO es gemelo, y está dicho en la auditoría: el servidor vence a los 20 min y el celular a los 2. Es a
 *  propósito (el servidor es la red de seguridad para cuando el celular se apagó). El del servidor vive en
 *  `functions/viajesColgados.cjs` (MINUTOS.buscando) y aquí solo se enseña.
 */
const { leer, soloCodigo } = require('../pruebas/cargar.cjs');

// Los números del plazo, escritos a mano. Cada patrón es UNA forma en que estaba escrito el 28-sep-2026.
const A_MANO = [
  ['ampliar el radio a los 60 s', /\},\s*60000\s*\)/g],
  ['agotar la búsqueda a los 120 s', /\},\s*120000\s*\)/g],
  ['el reloj arranca en 120', /setTiempoBusqueda\(\s*120\s*\)/g],
  ['el reloj nace en 240', /useState\(\s*240\s*\)/g],
  ['la barra divide entre 120', /tiempoBusqueda\s*\/\s*120\b/g],
  ['la ventana del conductor 2 * 60 * 1000', /2\s*\*\s*60\s*\*\s*1000/g],
];

const ARCHIVOS = ['guajirago/src/Solicitar.js', 'guajirago/src/AppConductor.js'];

/** Cuenta lo escrito a mano en los textos que se le den (por defecto, los del disco). */
function medirCodigo(fuentes = {}) {
  const t = (r) => soloCodigo(fuentes[r] != null ? fuentes[r] : leer(r));
  const filas = [];
  for (const [nombre, re] of A_MANO) {
    for (const a of ARCHIVOS) {
      const n = (t(a).match(re) || []).length;
      if (n) filas.push({ nombre, archivo: a, n });
    }
  }
  // El `vencido` del celular: un updateDoc cuyo objeto dice `estado: 'vencido'` y nada más.
  const vencidoPelado = (t('guajirago/src/Solicitar.js').match(/updateDoc\([^;]*?\{\s*estado:\s*'vencido'\s*\}\s*\)/g) || []).length;
  return { filas, aMano: filas.reduce((s, f) => s + f.n, 0), vencidoPelado };
}

async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  const vencidos = viajes.filter((v) => v.estado === 'vencido');
  const porQuien = {};
  for (const v of vencidos) {
    const q = v.expiradoPor || '(nadie: sin rastro)';
    porQuien[q] = (porQuien[q] || 0) + 1;
  }
  const sinRastro = vencidos.filter((v) => !v.expiradoPor || !v.fechaExpiracion || !v.motivoExpiracion).length;
  // Los que vencieron y luego revivieron con «Seguir buscando»: llevan el rastro con otro estado.
  const conRastroYOtroEstado = viajes.filter((v) => v.estado !== 'vencido' && v.estado !== 'expirado' && v.expiradoPor).length;
  return { total: viajes.length, vencidos: vencidos.length, porQuien, sinRastro, conRastroYOtroEstado };
}

async function main() {
  const { MINUTOS } = require('../guajirago/functions/viajesColgados.cjs');
  if (!process.argv.includes('--sin-red')) {
    const d = await medirDatos();
    console.log('🚕 viajes en producción: ' + d.total + ' · en `vencido`: ' + d.vencidos);
    console.log('   quién los venció: ' + Object.entries(d.porQuien).map(([k, n]) => k + '=' + n).join(' · '));
    console.log('   sin rastro completo (quién, cuándo o por qué): ' + d.sinRastro + ' de ' + d.vencidos);
    console.log('   con rastro de vencimiento pero en otro estado (revividos): ' + d.conRastroYOtroEstado);
  }
  const c = medirCodigo();
  console.log('\n📱 el plazo de la búsqueda escrito a mano en las pantallas: ' + c.aMano);
  for (const f of c.filas) console.log('   · ' + f.nombre.padEnd(40) + ' ' + f.archivo + ' ×' + f.n);
  console.log('   escrituras del `vencido` sin rastro en Solicitar.js: ' + c.vencidoPelado);
  console.log('\n🛟 la red del servidor (a propósito distinta): vence a los ' + MINUTOS.buscando + ' min (viajesColgados.cjs)');
  console.log(c.aMano === 0 && c.vencidoPelado === 0 ? '✓ el plazo sale de un solo sitio y el vencido deja rastro'
    : '🔴 quedan números a mano o vencidos sin rastro');
}

if (require.main === module) main().catch((e) => { console.error('⛔ ' + e.message); process.exit(1); });

module.exports = { medirCodigo, medirDatos, A_MANO };
