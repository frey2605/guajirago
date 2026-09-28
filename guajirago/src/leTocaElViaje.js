/**
 * ¿LE TOCA ESTE VIAJE A ESTE CONDUCTOR? (tipo de vehículo + radio) — la regla de la LISTA del conductor. Gemelo G04.
 *
 * La que decide a quién le SUENA el aviso es la del servidor (guajirago/functions/leTocaElViaje.cjs). Esto es su COPIA
 * para la app, y pruebas/leTocaElViaje.test.js ejecuta las dos con los mismos casos: si un día dicen distinto, al
 * conductor le sonaría un viaje que no ve, o vería uno del que nunca le avisaron.
 *
 * Qué tipos ve cada vehículo sale de comisiones.js (tiposDeViajeQueVe, la misma lista del interruptor), y el radio de
 * repuesto de configApp.js (el inicial). Antes la lista usaba 7 km si el viaje venía sin radio, y el servidor 3.
 */
import { tiposDeViajeQueVe } from './comisiones';
import { CONFIG_COMPARTIDA } from './configApp';

export const RADIO_DE_REPUESTO_KM = CONFIG_COMPARTIDA.radioBusquedaInicial;

/** El radio del viaje en km; si no trae uno que sirva (falta, 0, negativo, texto), el de repuesto. */
export function radioDelViaje(viaje) {
  const r = viaje && viaje.radioBusqueda;
  return typeof r === 'number' && r > 0 ? r : RADIO_DE_REPUESTO_KM;
}

/** ¿Por qué NO le toca? `km` undefined = no se sabe la distancia (no se descarta por eso). null = le toca. */
export function porQueNoLeToca(viaje, tipoVehiculo, km) {
  const tipo = viaje && viaje.tipo;
  if (tipoVehiculo && tipo && !tiposDeViajeQueVe(tipoVehiculo).includes(tipo)) return 'su vehículo no ve viajes de ' + tipo;
  if (typeof km === 'number' && km > radioDelViaje(viaje)) return 'fuera del radio';
  return null;
}
