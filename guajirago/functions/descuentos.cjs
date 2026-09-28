/**
 * EL DESCUENTO DEL PASAJERO, EN EL SERVIDOR — gemelo G01 (27-sep-2026)
 *
 * La calculadora es la de guajirago/src/descuentos.js. Esto es una COPIA, y existe solo porque la nube no puede
 * importar la de la app: `functions/` es otro paquete que se sube solo, y la app está escrita con import/export.
 * Para que las dos no se separen en silencio, pruebas/descuentoAceptado.test.js EJECUTA las dos con los mismos casos
 * y se pone roja si dicen distinto (SEGUNDA LEY: una copia que no se puede evitar, se ata).
 *
 * POR QUÉ HACE FALTA AQUÍ: la ficha `descuentoInfo` se arma en el celular al crear el viaje, con la oferta del
 * pasajero. Pero la tarifa que de verdad se cobra la fija `confirmarConductor` (la oferta aceptada, que puede ser una
 * contraoferta, o la oferta subida por el pasajero). Si la ficha no se rehace sobre ESA tarifa, el pasajero ve una
 * cifra, el conductor otra y el servidor abona una tercera. Ejemplo medido: oferta $10.000, contraoferta $15.000,
 * crédito $8.000 → el pasajero veía «$2.000», el conductor $15.000 y se abonaban $8.000: faltaban $5.000.
 */

/** Cuánto paga el pasajero por una tarifa, con su descuento aplicado. Nunca menos de $0 con un crédito. */
function aplicarDescuento(tarifaBase, descuentoPendiente) {
  if (!descuentoPendiente) return tarifaBase;
  if (descuentoPendiente.tipoBeneficio === 'credito') {
    return Math.max(0, tarifaBase - descuentoPendiente.valorBeneficio);
  }
  // descuento en %
  return Math.round(tarifaBase * (1 - descuentoPendiente.valorBeneficio / 100));
}

/** La ficha `descuentoInfo` sobre una tarifa. Los mismos campos que arma la app: los lee el conductor y el cobro. */
function armarDescuentoInfo(tarifa, descuentoPendiente) {
  if (!descuentoPendiente) return null;
  const paga = aplicarDescuento(tarifa, descuentoPendiente);
  return {
    tarifaOriginal: tarifa,
    tarifaPasajeroPaga: paga,
    descuentoAplicado: tarifa - paga,
    promoId: descuentoPendiente.promoId,
    tipoBeneficio: descuentoPendiente.tipoBeneficio,
    valorBeneficio: descuentoPendiente.valorBeneficio,
    codigoVerificacion: descuentoPendiente.codigoVerificacion,
    consumido: false,
  };
}

/**
 * La ficha del viaje, rehecha sobre la tarifa ACEPTADA. Devuelve null si no hay nada que rehacer: sin ficha, con el
 * descuento ya abonado (esa plata ya se movió y no se toca), o sin una tarifa que sea un número.
 * Un crédito sigue valiendo los mismos pesos; un porcentaje se aplica sobre la tarifa nueva.
 * Lo demás que traiga la ficha se conserva tal cual.
 */
function descuentoSobreTarifaAceptada(info, tarifaAceptada) {
  if (!info || typeof info !== 'object' || info.consumido === true) return null;
  const tarifa = Number(tarifaAceptada);
  if (!Number.isFinite(tarifa) || tarifa <= 0) return null;
  return { ...info, ...armarDescuentoInfo(tarifa, info) };
}

module.exports = { aplicarDescuento, armarDescuentoInfo, descuentoSobreTarifaAceptada };
