#!/usr/bin/env node
/**
 * 🎟️ ¿EL DESCUENTO DEL VIAJE SE CALCULÓ SOBRE LA TARIFA QUE DE VERDAD SE COBRÓ? — SOLO LECTURA, contra producción.
 *
 * Pasos 1 y 12 del gemelo G01 (27-sep-2026). La ficha `descuentoInfo` del viaje se armaba UNA vez, al crearlo, con la
 * oferta del pasajero. Si después el conductor contraofertaba (o el pasajero subía su oferta), `tarifaValor` cambiaba
 * y la ficha no: el pasajero veía «paga $2.000» sobre $10.000, el conductor cobraba $15.000 y el servidor le abonaba
 * los $8.000 de siempre. Este guion cuenta, viaje por viaje:
 *   · cuántos llevan descuento;
 *   · cuántos tienen la ficha CONGELADA: calculada sobre una tarifa distinta de la que quedó en el viaje;
 *   · de esos, cuánto dice la ficha que paga el pasajero y cuánto diría la cuenta sobre la tarifa de verdad.
 * La cuenta NO se copia aquí: sale de guajirago/src/descuentos.js (la del celular), y se carea con
 * guajirago/functions/descuentos.cjs (la del servidor): si las dos no dicen lo mismo, el guion lo dice.
 * NO escribe nada: los viajes viejos no se recalculan (orden del dueño: la plata ya guardada no se toca).
 *
 *   node scripts/medir-descuento-congelado.cjs
 */
const fs = require('fs');
const path = require('path');
const N = require('./nube.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const APP = cargarDeLaApp('guajirago/src/descuentos.js');
const RUTA_NUBE = path.join(__dirname, '..', 'guajirago', 'functions', 'descuentos.cjs');
// Antes del arreglo la cuenta del servidor no existía: el guion corre igual y lo dice.
const NUBE = fs.existsSync(RUTA_NUBE) ? require(RUTA_NUBE) : null;

/** Función pura: de los viajes, cuáles llevan la ficha del descuento calculada sobre otra tarifa. */
function medir(viajes) {
  const conDescuento = viajes.filter((v) => v.descuentoInfo && typeof v.descuentoInfo === 'object');
  const congelados = [];
  for (const v of conDescuento) {
    const info = v.descuentoInfo;
    const tarifa = Number(v.tarifaValor);
    if (!Number.isFinite(tarifa) || tarifa <= 0) continue;
    if (Number(info.tarifaOriginal) === tarifa) continue;
    const beneficio = { tipoBeneficio: info.tipoBeneficio, valorBeneficio: info.valorBeneficio };
    congelados.push({
      id: v.id,
      estado: v.estado,
      consumido: info.consumido === true,
      tarifaDelViaje: tarifa,
      fichaSobre: info.tarifaOriginal,
      fichaDicePaga: info.tarifaPasajeroPaga,
      fichaAbona: info.descuentoAplicado,
      deberiaPagar: APP.aplicarDescuento(tarifa, beneficio),
    });
  }
  return {
    viajes: viajes.length,
    conDescuento: conDescuento.length,
    congelados,
    congeladosYaCobrados: congelados.filter((c) => c.consumido).length,
  };
}

/** Las dos calculadoras (celular y servidor), con los mismos casos: ¿dicen lo mismo? */
function carearCalculadoras() {
  if (!NUBE) return { hay: false, distintos: [] };
  const casos = [];
  for (const tarifa of [0, 1000, 5000, 7200, 8000, 10000, 15000, 23500])
    for (const b of [null, { tipoBeneficio: 'credito', valorBeneficio: 8000 }, { tipoBeneficio: 'descuento', valorBeneficio: 10 },
      { tipoBeneficio: 'descuento', valorBeneficio: 33 }, { tipoBeneficio: 'credito', valorBeneficio: 0 }])
      casos.push([tarifa, b]);
  const distintos = casos.filter(([t, b]) => APP.aplicarDescuento(t, b) !== NUBE.aplicarDescuento(t, b));
  return { hay: true, casos: casos.length, distintos };
}

async function main() {
  const viajes = (await N.traer('viajes')).map(N.doc);
  const r = medir(viajes);
  console.log('Viajes: ' + r.viajes + ' · con descuento: ' + r.conDescuento);
  console.log('  con la ficha del descuento calculada sobre OTRA tarifa (congelada): ' + r.congelados.length
    + ' · de ésos, con el descuento ya abonado al conductor: ' + r.congeladosYaCobrados);
  for (const c of r.congelados) {
    console.log('    · ' + c.id + ' (' + c.estado + (c.consumido ? ', ya abonado' : '') + '): tarifa $' + c.tarifaDelViaje
      + ' · la ficha se hizo sobre $' + c.fichaSobre + ', dice que paga $' + c.fichaDicePaga + ' y abona $' + c.fichaAbona
      + ' · sobre la tarifa de verdad pagaría $' + c.deberiaPagar);
  }
  const k = carearCalculadoras();
  if (!k.hay) console.log('  la cuenta del servidor (guajirago/functions/descuentos.cjs): NO EXISTE — el servidor no recalcula el descuento');
  else console.log('  la cuenta del celular y la del servidor, con ' + k.casos + ' casos: '
    + (k.distintos.length ? '🔴 difieren en ' + k.distintos.length : '✓ dicen lo mismo'));
  if (N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medir, carearCalculadoras };
