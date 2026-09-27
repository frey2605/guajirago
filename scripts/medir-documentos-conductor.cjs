#!/usr/bin/env node
/**
 * 📂 ¿QUÉ DOCUMENTOS TIENE CADA CONDUCTOR? — SOLO LECTURA, contra producción.
 *
 * Pasos 1 y 12 del arreglo del 27-sep-2026: el conductor sube sus documentos al
 * registrarse (cédula, licencia, tarjeta de propiedad y tres fotos del vehículo). La
 * lista NO se copia aquí: sale de guajirago/src/documentosConductor.js, la misma que
 * usan el registro y el panel.
 *
 *   node scripts/medir-documentos-conductor.cjs
 */
const N = require('./nube.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const { DOCUMENTOS_CONDUCTOR } = cargarDeLaApp('guajirago/src/documentosConductor.js');

/** Función pura: de las fichas, cuántos conductores tienen cada documento. */
function contar(fichas) {
  const conductores = fichas.filter((f) => f.tipo === 'conductor');
  const porDocumento = DOCUMENTOS_CONDUCTOR.map((d) => ({
    campo: d.campo, nombre: d.nombre, tienen: conductores.filter((f) => !!f[d.campo]).length,
  }));
  const completos = conductores.filter((f) => DOCUMENTOS_CONDUCTOR.every((d) => !!f[d.campo])).length;
  return { conductores: conductores.length, completos, porDocumento };
}

async function main() {
  const fichas = (await N.traer('usuarios')).map(N.doc);
  const r = contar(fichas);
  console.log('Conductores: ' + r.conductores + ' · con los ' + DOCUMENTOS_CONDUCTOR.length + ' documentos: ' + r.completos);
  for (const d of r.porDocumento) console.log('  ' + d.nombre.padEnd(46) + d.tienen + ' de ' + r.conductores);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { contar };
