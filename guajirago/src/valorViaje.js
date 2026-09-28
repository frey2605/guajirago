/**
 * ¿CUÁNTO VALIÓ ESTE VIAJE? — gemelo G19 (28-sep-2026). UNA sola regla.
 *
 * El precio de un viaje es `tarifaValor`: lo pone el pasajero al pedirlo (viajeNuevo.js) y lo FIJA el servidor al
 * confirmar la oferta aceptada (confirmarConductor, en guajirago/functions/index.js). Nada más.
 *
 * Hasta el 28-sep-2026 el panel leía primero `contraofertaValor`, un campo del flujo VIEJO de contraofertas (antes
 * del 12-jul-2026 la contraoferta se escribía encima del viaje). Hoy no lo escribe nadie, pero 15 viajes viejos lo
 * traen, y en 2 dice una oferta que NO fue la que quedó (medido con scripts/medir-valor-viaje.cjs): el panel les
 * ponía $11.000 y $11.500 a viajes que valían $10.000 y $10.500. La app del conductor leía solo `tarifaValor`.
 *
 * La usan el historial y «Ganancias» del conductor (AppConductor.js, Ganancias.js). El panel es OTRO repositorio y
 * lleva una COPIA idéntica en guajirago-admin/src/valorViaje.js; pruebas/valorViaje.test.js corre las dos con los
 * mismos casos y se pone roja si dicen distinto (SEGUNDA LEY: una copia que no se puede evitar, se ata).
 *
 * Es el valor del VIAJE (lo que cobra el conductor), no lo que pagó el pasajero con descuento: eso es
 * descuentoInfo.tarifaPasajeroPaga (descuentos.js).
 */
export function valorDelViaje(viaje) {
  const n = Number(viaje && viaje.tarifaValor);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
