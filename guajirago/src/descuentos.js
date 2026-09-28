/**
 * EL DESCUENTO DEL PASAJERO — UNA SOLA CALCULADORA
 *
 * SEGUNDA LEY del proyecto: «No se pueden usar dos calculadoras para un mismo
 * proceso.» Hasta el 23-ago-2026 esta cuenta vivía COPIADA, byte por byte, en
 * Solicitar.js y SolicitarMensajeria.js (comprobado con hash: idénticas). Dos
 * copias iguales hoy son dos copias distintas mañana: el próximo arreglo se le
 * aplica a una y a la otra se le olvida.
 *
 * QUÉ ES EL DESCUENTO, en cristiano: el pasajero puede traer un beneficio
 * pendiente en su ficha (`usuarios/{uid}.descuentoPendiente`) — hoy, el crédito
 * de bienvenida de $8.000. El viaje se crea SIEMPRE con la tarifa COMPLETA
 * (es lo que el conductor ve y debe recibir); lo que el pasajero paga de menos
 * viaja aparte, en `descuentoInfo`, y solo se CONSUME cuando el conductor
 * verifica el código. Esa plata la pone GuajiraGo, no el conductor.
 *
 * MEDIDO EL 23-ago-2026 en los datos vivos: 20 de 91 viajes llevan
 * descuentoInfo, todos de tipo «credito» por $8.000. Y existe el caso de verdad
 * del viaje de $5.000 con crédito de $8.000: pagó $0 — nunca negativo. Las
 * pruebas de pruebas/descuentos.test.js usan ESOS números reales.
 *
 * QUIÉN LEE ESTO DESPUÉS: AppConductor.js NO recalcula nada — lee los números ya
 * guardados en descuentoInfo (descuentoAplicado, codigoVerificacion).
 *
 * 🔴 LA CUENTA SE HACE DOS VECES, y la que manda es la segunda (gemelo G01,
 * 27-sep-2026): aquí, al crear el viaje, con la oferta del pasajero; y otra vez
 * en el servidor, en `confirmarConductor`, sobre la tarifa ACEPTADA (que puede
 * ser una contraoferta o la oferta subida). Antes solo se hacía la primera, y con
 * una contraoferta el pasajero, el conductor y el abono decían cifras distintas.
 * El servidor no puede importar este archivo: usa su copia,
 * guajirago/functions/descuentos.cjs, y pruebas/descuentoAceptado.test.js ejecuta
 * las dos con los mismos casos. Si cambias la cuenta aquí, cámbiala allá.
 */
import { cop } from './moneda';

/**
 * Cuánto paga el pasajero por una tarifa, con su descuento pendiente aplicado.
 * Sin descuento, paga la tarifa tal cual. Nunca devuelve menos de $0.
 */
export function aplicarDescuento(tarifaBase, descuentoPendiente) {
  if (!descuentoPendiente) return tarifaBase;
  if (descuentoPendiente.tipoBeneficio === 'credito') {
    return Math.max(0, tarifaBase - descuentoPendiente.valorBeneficio);
  }
  // descuento en %
  return Math.round(tarifaBase * (1 - descuentoPendiente.valorBeneficio / 100));
}

/**
 * Arma la ficha `descuentoInfo` que se guarda DENTRO del viaje al crearlo.
 * Sin descuento pendiente devuelve null y el viaje se crea sin la ficha.
 *
 * OJO: estos nombres de campo cruzan de app en app — los lee AppConductor.js al
 * verificar el código y acreditar al conductor. Renombrar uno aquí rompe al
 * conductor EN SILENCIO (SEGUNDA LEY: conexiones estables).
 */
export function armarDescuentoInfo(tarifa, descuentoPendiente) {
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
 * Qué tarifa se le ENSEÑA al pasajero en la pantalla del viaje: si el viaje ya
 * lleva descuento aplicado, lo que de verdad va a pagar; si no, la tarifa tal
 * cual viene escrita en el viaje (que ya trae el signo de pesos).
 */
export function tarifaParaPasajero(v) {
  if (v?.descuentoInfo?.tarifaPasajeroPaga != null) {
    return cop(v.descuentoInfo.tarifaPasajeroPaga);
  }
  return v?.tarifa;
}
