#!/usr/bin/env node
/**
 * ¿QUIÉN PUDO USAR CADA PROMOCIÓN? — gemelo G12 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-promociones.cjs
 *
 * Tres sitios deciden si una persona puede usar una promoción: el servidor (el canje,
 * `reclamarPromocion`), la app (la lista de ofertas) y el panel (asignar a mano). El
 * «requiere N viajes previos» solo lo miraba el panel. Este guion cuenta, contra
 * producción:
 *   · cuántas promociones piden viajes previos;
 *   · cada vez que alguien usó una de ellas —descuento reclamado en la ficha, descuento
 *     puesto en un viaje, o apunte del historial de la promoción— y cuántos viajes
 *     completados llevaba esa persona ANTES de esa fecha;
 *   · los apuntes del historial hechos con la promoción fuera de su vigencia (la vigencia
 *     se sabe por fecha; `activa` es la de hoy, no la de entonces).
 * Si existe la regla única (guajirago/functions/promociones.cjs), la corre con cada caso
 * y dice cuántos rechazaría hoy.
 *
 * No escribe nada.
 */
const path = require('path');
const fs = require('fs');
const { traer, doc } = require('./nube.cjs');

const RAIZ = path.resolve(__dirname, '..');
const REGLA = path.join(RAIZ, 'guajirago/functions/promociones.cjs');

async function main() {
  const [promosCrudas, usuariosCrudos, viajesCrudos] = await Promise.all([
    traer('promociones'), traer('usuarios'), traer('viajes'),
  ]);
  const promos = promosCrudas.map(doc);
  const usuarios = usuariosCrudos.map(doc);
  const viajes = viajesCrudos.map(doc);
  const tipoDe = Object.fromEntries(usuarios.map((u) => [u.id, u.tipo || '']));
  const regla = fs.existsSync(REGLA) ? require(REGLA) : null;

  // Viajes completados de una persona antes de una fecha (como pasajero, o como conductor si lo es).
  const completadosAntes = (uid, fecha) => {
    const campo = tipoDe[uid] === 'conductor' ? 'conductorId' : 'pasajeroId';
    return viajes.filter((v) => v[campo] === uid && v.estado === 'finalizado'
      && (!fecha || !v.fechaSolicitud || v.fechaSolicitud < fecha)).length;
  };

  console.log('PROMOCIONES en producción: ' + promos.length);
  const conMinimos = promos.filter((p) => (p.viajesMinimosRequeridos || 0) > 0);
  console.log('  · piden viajes previos: ' + conMinimos.length
    + (conMinimos.length ? ' → ' + conMinimos.map((p) => p.id + ' (' + p.viajesMinimosRequeridos + ')').join(', ') : ''));
  console.log('  · de porcentaje: ' + promos.filter((p) => p.tipoBeneficio === 'descuento').length
    + ' · de crédito: ' + promos.filter((p) => p.tipoBeneficio === 'credito').length
    + ' · inactivas: ' + promos.filter((p) => !p.activa).length);

  // Cada uso, venga de donde venga.
  const usos = [];
  for (const u of usuarios) {
    const d = u.descuentoPendiente;
    if (d && d.promoId) usos.push({ promoId: d.promoId, uid: u.id, fecha: d.fechaActivacion, de: 'reclamado (ficha)' });
  }
  for (const v of viajes) {
    const d = v.descuentoInfo;
    if (d && d.promoId && v.pasajeroId) usos.push({ promoId: d.promoId, uid: v.pasajeroId, fecha: v.fechaSolicitud, de: 'en un viaje' });
  }
  for (const p of promos) {
    for (const h of p.historialUsos || []) usos.push({ promoId: p.id, uid: h.usuarioId, fecha: h.fecha, de: 'historial', valor: h.valor });
  }
  console.log('\nUSOS encontrados (ficha + viajes + historial): ' + usos.length);

  const porId = Object.fromEntries(promos.map((p) => [p.id, p]));
  let sinCumplir = 0; let conMin = 0; let rechazariaHoy = 0;
  for (const x of usos) {
    const p = porId[x.promoId];
    const min = (p && p.viajesMinimosRequeridos) || 0;
    if (min <= 0) continue;
    conMin++;
    const n = completadosAntes(x.uid, x.fecha);
    const falta = n < min;
    if (falta) sinCumplir++;
    let veredicto = '';
    if (regla) {
      const persona = { esConductor: tipoDe[x.uid] === 'conductor', usosPrevios: 0, viajesCompletados: n };
      const m = regla.motivoParaNoUsar({ ...p, activa: true }, persona, new Date(x.fecha || Date.now()));
      if (m && m.codigo === 'faltan-viajes') { rechazariaHoy++; veredicto = ' → la regla de hoy: NO'; }
    }
    console.log('  ' + (falta ? '🔴' : '✓') + ' ' + x.promoId + ' · ' + String(x.uid).slice(0, 8) + ' · ' + x.de + ' · '
      + (x.fecha || '?') + ' · llevaba ' + n + ' de ' + min + veredicto);
  }
  console.log('  · usos de promociones que piden viajes previos: ' + conMin + ' · sin cumplirlos: ' + sinCumplir);
  if (regla) console.log('  · de esos, la regla única de hoy rechazaría: ' + rechazariaHoy);
  else console.log('  · (la regla única aún no existe: no se puede decir qué rechazaría)');

  // Apuntes del historial con la promoción fuera de fecha, y de porcentaje.
  let fueraDeFecha = 0; let porcentajeEnHistorial = 0;
  for (const p of promos) {
    for (const h of p.historialUsos || []) {
      const f = new Date(h.fecha);
      if (new Date(p.fechaInicio + 'T00:00:00') > f || new Date(p.fechaFin + 'T23:59:59') < f) fueraDeFecha++;
      if (p.tipoBeneficio === 'descuento') porcentajeEnHistorial++;
    }
  }
  console.log('\nHISTORIAL: apuntes con la promoción fuera de su vigencia: ' + fueraDeFecha
    + ' · apuntes de promociones de porcentaje: ' + porcentajeEnHistorial);
}

main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
