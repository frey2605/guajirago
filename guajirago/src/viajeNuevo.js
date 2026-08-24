/**
 * EL DOCUMENTO DEL VIAJE NUEVO — SE ARMA EN UN SOLO SITIO
 *
 * SEGUNDA LEY del proyecto: «La información que se supone deben compartir debe
 * salir de los mismos archivos.» Este es el contrato más gordo de GuajiraGo:
 * los campos que se escriben aquí los leen la app del conductor
 * (AppConductor.js: pasajeroLat/Lng para la distancia, tarifaValor para la
 * oferta, tieneCodigo para pedir el código), el servidor
 * (functions/index.js: pasajeroLat/Lng y radioBusqueda para avisar a los
 * conductores cercanos, pasajeroId para confirmar) y las reglas de Firestore
 * (pasajeroId, estado). No hay API que avise: si un campo se renombra en una
 * pantalla y no en la otra, el que lee deja de encontrar el dato EN SILENCIO.
 *
 * Hasta el 23-ago-2026 este documento se armaba a mano, dos veces, en
 * Solicitar.js y SolicitarMensajeria.js — 93 de 95 renglones idénticos.
 * Ahora las dos pantallas llaman esto; la de mensajería añade su paquete
 * con `extras`.
 *
 * DOS DECISIONES QUE VIVEN AQUÍ, en cristiano:
 *
 * · El viaje SIEMPRE se crea con la tarifa COMPLETA: es lo que el conductor ve
 *   y debe recibir. El descuento del pasajero viaja aparte (descuentoInfo, la
 *   arma descuentos.js) y solo se consume cuando el conductor verifica el
 *   código — no antes.
 *
 * · El código de seguridad YA NO va dentro del viaje: ahí lo leía cualquiera
 *   que mirase el mercado (REGLA 11). Va solo el aviso `tieneCodigo`, para que
 *   el conductor sepa que ha de pedirlo; el código de verdad vive en el cajón
 *   privado (codigoSeguridad.js).
 *
 * El parámetro `ahora` existe para poder probar la fecha con un reloj fijo;
 * nadie más lo pasa.
 */

/** Arma el documento con que nace TODO viaje (taxi, mototaxi o mandado). */
export function armarViajeNuevo({ user, nombrePasajero, coords, tipo, origen, destino, tarifa, datosDescuento, radioBusqueda, extras }, ahora = new Date()) {
  return {
    pasajeroId: user.uid, pasajeroEmail: user.email,
    pasajeroNombre: nombrePasajero,
    tieneCodigo: true,
    pasajeroLat: coords.lat, pasajeroLng: coords.lng,
    tipo, origen, destino, estado: 'esperando',
    tarifa: `$${tarifa.toLocaleString()}`, tarifaValor: tarifa,
    ...(datosDescuento ? { descuentoInfo: datosDescuento } : {}),
    fechaSolicitud: ahora.toISOString(),
    radioBusqueda,
    ...(extras || {}),
  };
}
