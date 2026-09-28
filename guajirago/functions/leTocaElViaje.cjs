// ─────────────────────────────────────────────────────────────────────────────
// ¿LE TOCA ESTE VIAJE A ESTE CONDUCTOR? (tipo de vehículo + radio) — gemelo G04, 27-sep-2026.
//
// La usa el servidor (tokensConductoresCerca, en index.js) para decidir a quién le SUENA el aviso. La lista del
// conductor (guajirago/src/leTocaElViaje.js, que usa AppConductor.js) tiene una COPIA, porque la nube no puede
// importar la app (`functions/` es otro paquete). pruebas/leTocaElViaje.test.js EJECUTA las dos con los mismos casos
// y se pone roja si dicen distinto (SEGUNDA LEY: una copia que no se puede evitar, se ata).
//
// Lo que NO vive aquí: si el conductor está EN SERVICIO (avisables.cjs) y cómo se mide la distancia (distanciaKm de
// index.js, atada a guajirago/src/distancia.js). Esta función recibe los km ya medidos.
//
// Antes del 27-sep-2026 el servidor avisaba solo por distancia: a un taxista le sonaba «Nuevo viaje» por un mototaxi
// que su lista no le enseñaba. Y si el viaje llegaba sin radio o con 0, el servidor usaba 3 km y la lista 7 km.
// ─────────────────────────────────────────────────────────────────────────────

// El radio de repuesto: el INICIAL de la app (guajirago/src/configApp.js, radioBusquedaInicial), atado por prueba.
// Solo se usa si el viaje llega sin radio, con 0 o con algo que no es un número.
const RADIO_DE_REPUESTO_KM = 3;

// Qué tipos de viaje ve cada vehículo: COPIA de tiposDeViajeQueVe de guajirago/src/comisiones.js (atada por prueba).
function tiposDeViajeQueVe(tipoVehiculo) {
  if (!tipoVehiculo) return ['Taxi', 'Mototaxi', 'Mensajería'];
  return tipoVehiculo === 'Mototaxi' ? ['Mototaxi', 'Mensajería'] : [tipoVehiculo];
}

/** El radio del viaje en km; si no trae uno que sirva (falta, 0, negativo, texto), el de repuesto. */
function radioDelViaje(viaje) {
  const r = viaje && viaje.radioBusqueda;
  return typeof r === 'number' && r > 0 ? r : RADIO_DE_REPUESTO_KM;
}

/**
 * ¿Por qué NO le toca este viaje a este conductor? `tipoVehiculo` es el de su ficha (usuarios/{uid}) y `km` la
 * distancia al pasajero (undefined si no se sabe dónde está alguno de los dos: entonces no se descarta por distancia).
 * Devuelve el motivo, o null si le toca.
 */
function porQueNoLeToca(viaje, tipoVehiculo, km) {
  const tipo = viaje && viaje.tipo;
  if (tipoVehiculo && tipo && !tiposDeViajeQueVe(tipoVehiculo).includes(tipo)) return 'su vehículo no ve viajes de ' + tipo;
  if (typeof km === 'number' && km > radioDelViaje(viaje)) return 'fuera del radio';
  return null;
}

module.exports = { RADIO_DE_REPUESTO_KM, tiposDeViajeQueVe, radioDelViaje, porQueNoLeToca };
