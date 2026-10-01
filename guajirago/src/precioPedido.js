/**
 * 🍽️ EL PRECIO DEL PEDIDO — COPIA de guajirago/functions/precioPedido.cjs · P09 (30-sep-2026)
 *
 * El precio del pedido lo pone el SERVIDOR cuando el pedido nace (los precios del menú, la promoción solo si vale
 * hoy y si el teléfono no llenó su tope). La app usa ESTE trozo para ENSEÑAR el carrito mientras se arma, con la
 * misma cuenta: así lo que el cliente ve es lo que el servidor va a cobrar. Es una COPIA porque desde aquí no se puede
 * importar aquel archivo: pruebas/totalPedido.test.js exige que el trozo entre las marcas sea IGUAL y lo ejecuta con
 * los mismos casos. Se cambia allá y se copia aquí, o la tanda se pone roja.
 */
import { etapaDeVigencia, hoyEnColombia } from './reglaPromocion';

// ── EL PRECIO DEL PEDIDO (se copia igual en la app) ──

/** El día de la semana HOY en Colombia, con el número de `Date.getDay()` (0 = domingo … 6 = sábado). */
export function diaDeLaSemanaEnColombia(ahora) {
  return new Date(hoyEnColombia(ahora) + 'T12:00:00Z').getUTCDay();
}

/** ¿Esta promoción del negocio vale HOY (en Colombia)? Encendida, y en su programación: siempre, ciertos días o un rango. */
export function promoVigenteHoy(promo, ahora) {
  if (!promo || !promo.activa) return false;
  if (promo.programacion === 'dias') return (promo.dias || []).includes(diaDeLaSemanaEnColombia(ahora));
  // G16: el DÍA de hoy en Colombia (antes era el día en UTC: desde las 7 de la noche ya contaba «mañana»).
  if (promo.programacion === 'rango') return etapaDeVigencia(promo.fechaInicio, promo.fechaFin, ahora) === 'vigente';
  return true; // siempre
}

/** El precio del plato con esta promoción, o null si la promoción no le baja el precio a ESTE plato. */
export function precioConPromo(plato, promo) {
  if (!plato || !promo) return null;
  if (promo.tipo !== 'porcentaje' && promo.tipo !== 'fijo') return null;
  const lista = promo.platosAplica || [];
  if (lista.length > 0 && !lista.some((x) => x.id === plato.id)) return null;
  const precioFinal = promo.tipo === 'porcentaje'
    ? Math.round(plato.precio * (1 - (promo.valor || 0) / 100))
    : Math.max(0, plato.precio - (promo.valor || 0));
  return precioFinal < plato.precio ? precioFinal : null;
}

/** ¿Este teléfono ya llenó el tope de la promoción? `usados` = cuántas veces la usó. Sin tope, nunca. */
export function topeLleno(promo, usados) {
  return promo.limiteCliente > 0 && (usados || 0) >= promo.limiteCliente;
}

/**
 * La mejor promoción para este plato: { promo, precioFinal }, o null. `usos(id)` dice cuántas veces la usó ya quien
 * pide; con su tope lleno no cuenta.
 */
export function mejorDescuento(plato, promos, usos, ahora) {
  let mejor = null;
  for (const p of (promos || []).filter((x) => promoVigenteHoy(x, ahora))) {
    if (topeLleno(p, usos(p.id))) continue;
    const precioFinal = precioConPromo(plato, p);
    if (precioFinal !== null && (!mejor || precioFinal < mejor.precioFinal)) mejor = { promo: p, precioFinal };
  }
  return mejor;
}

/** El precio de UNA unidad de la línea: el del plato (con su promoción, si la hay) más el de sus adiciones. */
export function precioDeLaLinea(plato, adiciones, desc) {
  const extra = (adiciones || []).reduce((s, a) => s + (a.precio || 0), 0);
  return (desc ? desc.precioFinal : plato.precio) + extra;
}

/**
 * La línea sin lo que dice de la promoción (promoId, promoNombre y precioOriginal). El servidor la usa para guardar la
 * línea (la promoción la pone él), y la app para quitar una promoción que ese teléfono ya agotó. P14: la app ponía
 * esos tres campos en `undefined`, y Firestore no guarda `undefined`: el pedido ya no salía del teléfono.
 */
export function sinPromo(linea) {
  const { promoId, promoNombre, precioOriginal, ...resto } = linea && typeof linea === 'object' ? linea : {};
  return resto;
}

/**
 * P15: el nombre que se guarda en el pedido (del negocio, de un plato o de una promoción): el suyo si es un texto con
 * algo, o `porDefecto` si falta o no es texto. Firestore no guarda `undefined` y las reglas piden texto: con un nombre
 * que faltaba, el pedido no salía del teléfono. El servidor usa los mismos nombres por defecto al revisar la línea.
 */
export function nombreOPorDefecto(nombre, porDefecto) {
  return typeof nombre === 'string' && nombre.trim() ? nombre : porDefecto;
}
export const PLATO_SIN_NOMBRE = 'Plato';
export const PROMO_SIN_NOMBRE = 'Promoción';

/**
 * P17: lo que cuesta una RESERVA de turismo: el precio del tour por las `personas` (un entero) si el tour se cobra
 * «por persona» (`unidadPrecio`, G86); por grupo, por día o por hora es el precio tal cual (la app no pregunta cuántos
 * días ni cuántas horas). La app la usa para ENSEÑAR el total al reservar (Turismo.js, totalReserva) y el servidor
 * para PONERLO cuando nace la reserva (precioReserva.cjs): una sola cuenta. Hasta P17 vivía solo en la app y el
 * servidor se creía el total del teléfono.
 */
export function totalDeLaReserva(tour, personas) {
  if (!tour) return 0;
  const p = tour.unidadPrecio === 'persona' ? personas : 1;
  return (tour.precio || 0) * p;
}

// ── EL DOMICILIO DEL NEGOCIO (se copia igual en la app y en aliados) ──

/**
 * P10: cuánto cobra de domicilio este negocio. El campo de hoy es `costoDomicilio` (el que escribe el perfil de
 * aliados desde el 6-jul-2026); `costoEnvio` es el MISMO dato con su nombre viejo, de antes de ese día, y solo vale
 * si el negocio no tiene el de hoy. Lo guardado no se reescribe: se lee así.
 */
export function costoDomicilioDelNegocio(negocio) {
  if (!negocio) return 0;
  const valor = negocio.costoDomicilio != null ? negocio.costoDomicilio : negocio.costoEnvio;
  return Number(valor) || 0;
}

// ── FIN DEL DOMICILIO DEL NEGOCIO ──

// ── FIN DEL PRECIO DEL PEDIDO ──
