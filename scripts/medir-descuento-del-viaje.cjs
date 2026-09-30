#!/usr/bin/env node
/**
 * ¿DE DÓNDE SALE LA PLATA DEL DESCUENTO DE UN VIAJE? — pendiente P02 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-descuento-del-viaje.cjs
 *
 * Hasta P02, `consumirDescuentoViaje` le abonaba al conductor el número `descuentoInfo.descuentoAplicado` escrito
 * DENTRO del viaje, y las reglas dejaban que el pasajero y el conductor del viaje lo cambiaran; y el pasajero podía no
 * quemar su descuento (lo quemaba su propio teléfono) y volver a usarlo. Este guion cuenta en producción:
 *   · los viajes con `descuentoInfo`, cuántos se cobraron y cuánta plata se abonó por descuentos;
 *   · de los cobrados, cuántos CUADRAN con su origen (la bienvenida de $8.000 o la promoción de hoy, rehecho sobre la
 *     tarifa del viaje con la MISMA cuenta del servidor) y cuáles no, o no se puede saber (su promoción ya no existe);
 *   · si un mismo descuento (pasajero + código) se cobró más de una vez, y si alguna ficha sigue guardando un descuento
 *     que ya se cobró (sin quemar: se podría reusar);
 *   · los viajes VIVOS con descuento, y qué les daría el servidor de P02 (`descuentoQueVale` sobre la ficha del
 *     pasajero): así se ve antes de publicar si a alguien en curso le cambia algo.
 *
 * La cuenta NO se copia: sale de `guajirago/functions/descuentos.cjs` y `descuentoPendiente.cjs`, las del servidor.
 * No escribe nada.
 */
const path = require('node:path');

const FUNCIONES = path.resolve(__dirname, '..', 'guajirago', 'functions');
const { descuentoSobreTarifaAceptada } = require(path.join(FUNCIONES, 'descuentos.cjs'));
const { descuentoQueVale, PROMO_BIENVENIDA, CREDITO_BIENVENIDA_PASAJERO } = require(path.join(FUNCIONES, 'descuentoPendiente.cjs'));

const VIVOS = ['esperando', 'aceptado'];
const cifras = (v) => String(v == null ? '' : v).replace(/\D/g, '');

/** Lo que su ORIGEN dice que vale un descuento (sin mirar lo que diga el viaje). null si no se sabe. */
function origenDe(promoId, promos) {
  if (promoId === PROMO_BIENVENIDA) return { tipoBeneficio: 'credito', valorBeneficio: CREDITO_BIENVENIDA_PASAJERO };
  const p = promos[promoId];
  return p ? { tipoBeneficio: p.tipoBeneficio, valorBeneficio: p.valorBeneficio || 0 } : null;
}

/** FUNCIÓN PURA: el informe entero a partir de los datos (listas de documentos ya leídos). */
function revisar({ viajes, usuarios, promos }) {
  const fichas = Object.fromEntries(usuarios.map((u) => [u.id, u]));
  const conInfo = viajes.filter((v) => v.descuentoInfo && typeof v.descuentoInfo === 'object');
  const cobrados = conInfo.filter((v) => v.descuentoInfo.consumido === true);
  const abonado = cobrados.reduce((s, v) => s + (Number(v.descuentoInfo.descuentoAplicado) || 0), 0);

  const cuadran = []; const noCuadran = []; const sinOrigen = [];
  for (const v of cobrados) {
    const i = v.descuentoInfo;
    const o = origenDe(i.promoId, promos);
    if (!o) { sinOrigen.push(v); continue; }
    const tarifa = [Number(i.tarifaOriginal), Number(v.tarifaValor)].find((n) => Number.isFinite(n) && n > 0);
    const debia = tarifa ? descuentoSobreTarifaAceptada({ ...o }, tarifa).descuentoAplicado : null;
    if (debia === Number(i.descuentoAplicado)) cuadran.push(v);
    else noCuadran.push({ v, debia });
  }

  const veces = {};
  for (const v of cobrados) {
    const k = v.pasajeroId + ' · ' + cifras(v.descuentoInfo.codigoVerificacion);
    veces[k] = (veces[k] || 0) + 1;
  }
  const cobradosDosVeces = Object.entries(veces).filter(([, n]) => n > 1);

  const sinQuemar = usuarios.filter((u) => u.descuentoPendiente && typeof u.descuentoPendiente === 'object'
    && cobrados.some((v) => v.pasajeroId === u.id
      && cifras(v.descuentoInfo.codigoVerificacion) === cifras(u.descuentoPendiente.codigoVerificacion)));

  const vivos = conInfo.filter((v) => VIVOS.includes(v.estado) && v.descuentoInfo.consumido !== true).map((v) => {
    const f = fichas[v.pasajeroId] || {};
    const pend = f.descuentoPendiente;
    const vale = descuentoQueVale(pend, pend && promos[pend.promoId] ? promos[pend.promoId] : null);
    return { v, vale, antes: Number(v.descuentoInfo.descuentoAplicado) || 0 };
  });

  const apartados = usuarios.filter((u) => u.descuentoPendiente && u.descuentoPendiente.enViajeId);

  return { conInfo, cobrados, abonado, cuadran, noCuadran, sinOrigen, cobradosDosVeces, sinQuemar, vivos, apartados };
}

const corto = (id) => String(id).slice(0, 8) + '…';

async function main() {
  const { traer, doc } = require('./nube.cjs');
  const [u, p, v] = await Promise.all([traer('usuarios'), traer('promociones'), traer('viajes')]);
  const r = revisar({
    viajes: v.map(doc), usuarios: u.map(doc), promos: Object.fromEntries(p.map(doc).map((x) => [x.id, x])),
  });
  console.log('── PRODUCCIÓN ──');
  console.log('VIAJES: ' + v.length + ' · con descuento (descuentoInfo): ' + r.conInfo.length
    + ' · cobrados por el conductor: ' + r.cobrados.length + ' · abonado por descuentos: $' + r.abonado);
  console.log('COBRADOS que cuadran con su origen: ' + r.cuadran.length + ' · que NO cuadran: ' + r.noCuadran.length
    + ' · sin origen que mirar (la promoción ya no existe): ' + r.sinOrigen.length);
  for (const { v: x, debia } of r.noCuadran) {
    console.log('   · viaje ' + corto(x.id) + ' abonó $' + x.descuentoInfo.descuentoAplicado + ', su origen daba $' + debia);
  }
  for (const x of r.sinOrigen) {
    console.log('   · viaje ' + corto(x.id) + ' ' + x.descuentoInfo.promoId + ' abonó $' + x.descuentoInfo.descuentoAplicado
      + ' (' + x.descuentoInfo.tipoBeneficio + ' ' + x.descuentoInfo.valorBeneficio + ' según el viaje)');
  }
  console.log('MISMO descuento (pasajero + código) cobrado más de una vez: ' + r.cobradosDosVeces.length);
  for (const [k, n] of r.cobradosDosVeces) console.log('   · ' + corto(k) + ' ' + n + ' veces');
  console.log('FICHAS que guardan un descuento YA cobrado (sin quemar): ' + r.sinQuemar.length);
  console.log('VIAJES VIVOS con descuento: ' + r.vivos.length);
  for (const { v: x, vale, antes } of r.vivos) {
    const ahora = vale ? descuentoSobreTarifaAceptada({ ...vale }, Number(x.descuentoInfo.tarifaOriginal) || Number(x.tarifaValor)) : null;
    console.log('   · viaje ' + corto(x.id) + ' ' + x.estado + ': dice $' + antes + ' · con P02: '
      + (ahora ? '$' + ahora.descuentoAplicado : 'sin descuento (la ficha no tiene uno que valga)'));
  }
  console.log('FICHAS con el descuento apartado para un viaje (enViajeId, lo pone P02): ' + r.apartados.length);
}

module.exports = { revisar, origenDe };

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
