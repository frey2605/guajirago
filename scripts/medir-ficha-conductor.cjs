#!/usr/bin/env node
/**
 * 🚕 ¿QUÉ GUARDA LA FICHA DE CADA CONDUCTOR? — SOLO LECTURA, contra producción.
 *
 * Pasos 1 y 12 del gemelo G02 (27-sep-2026): el GPS del conductor reescribía su ficha
 * (`conductores/{uid}`) ENTERA en cada lectura, sin merge, y así borraba lo que pone el
 * servidor al confirmarlo (`enViajeId`, `ocupado`) y el token de avisos si esa vez no se
 * pudo pedir. Este guion cuenta, ficha por ficha:
 *   · cuántas llevan viaje en curso, ocupado y token;
 *   · los viajes VIVOS (aceptados) cuyo conductor NO tiene `enViajeId`: la huella del borrado;
 *   · los `enViajeId` que apuntan a un viaje ya terminado o que no existe: los que el GPS
 *     «limpiaba» por casualidad y que, con merge, se quedarían puestos.
 * La lista de estados terminados NO se copia: sale de guajirago/src/estadosViaje.js.
 *
 *   node scripts/medir-ficha-conductor.cjs
 */
const N = require('./nube.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const { ESTADOS_TERMINADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');

/** Función pura: de las fichas y los viajes, qué se ve en cada una. */
function medir(fichas, viajes) {
  const porId = new Map(viajes.map((v) => [v.id, v]));
  const vivos = viajes.filter((v) => v.estado === 'aceptado' && v.conductorId);
  const fichaDe = new Map(fichas.map((f) => [f.id, f]));
  const conViaje = fichas.filter((f) => f.enViajeId);
  return {
    fichas: fichas.length,
    activos: fichas.filter((f) => f.activo === true).length,
    conViaje: conViaje.length,
    ocupados: fichas.filter((f) => f.ocupado === true).length,
    conToken: fichas.filter((f) => f.fcmToken).length,
    activosSinToken: fichas.filter((f) => f.activo === true && !f.fcmToken).map((f) => f.id),
    vivosSinMarca: vivos.filter((v) => (fichaDe.get(v.conductorId) || {}).enViajeId !== v.id).map((v) => v.id),
    marcasViejas: conViaje
      .filter((f) => { const v = porId.get(f.enViajeId); return !v || ESTADOS_TERMINADOS.includes(v.estado); })
      .map((f) => f.id + ' → ' + f.enViajeId + ' (' + ((porId.get(f.enViajeId) || {}).estado || 'no existe') + ')'),
    campos: [...new Set(fichas.flatMap((f) => Object.keys(f).filter((k) => k !== 'id')))].sort(),
  };
}

async function main() {
  const fichas = (await N.traer('conductores')).map(N.doc);
  const viajes = (await N.traer('viajes')).map(N.doc);
  const r = medir(fichas, viajes);
  console.log('Fichas de conductor: ' + r.fichas + ' · activos: ' + r.activos);
  console.log('  con viaje en curso (enViajeId): ' + r.conViaje + ' · ocupados: ' + r.ocupados + ' · con token de avisos: ' + r.conToken);
  console.log('  activos SIN token de avisos: ' + r.activosSinToken.length + (r.activosSinToken.length ? ' → ' + r.activosSinToken.join(', ') : ''));
  console.log('  viajes aceptados cuyo conductor NO tiene la marca del viaje: ' + r.vivosSinMarca.length + (r.vivosSinMarca.length ? ' → ' + r.vivosSinMarca.join(', ') : ''));
  console.log('  marcas que apuntan a un viaje terminado o que no existe: ' + r.marcasViejas.length + (r.marcasViejas.length ? '\n    · ' + r.marcasViejas.join('\n    · ') : ''));
  console.log('  campos que aparecen: ' + r.campos.join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medir };
