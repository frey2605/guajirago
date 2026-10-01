// P23 (1-oct-2026) · ¿A QUÉ TOKEN LE AVISO A ESTE PASAJERO? — una sola respuesta.
//
// El token de avisos del pasajero vive en SU FICHA, `usuarios/{uid}.fcmToken`. La app lo pega ahí cuando el pasajero
// pide un viaje y da permiso (guajirago/src/Solicitar.js, con prepararTokenDeAvisos de Notificaciones.js). La ficha la
// leen solo su dueño y el panel (firestore.rules, `match /usuarios/{userId}`): el token no queda a la vista del mercado.
//
// Hasta hoy había DOS sitios y la app solo llenaba uno: «tienes una oferta» (notificarPasajeroOferta) lo buscaba en el
// viaje (desde P21, en su cajón de contacto), y «¡tu conductor llegó!» (notificarConductorEnPunto, publicada en junio y
// sin código en este repo) lo busca en la ficha, que NADIE llenaba. Medido el 1-oct-2026 en producción: 0 de 10 fichas
// con token. Ese aviso no pudo llegar nunca. (Lo mide scripts/medir-token-pasajero.cjs.)
//
// Los viajes guardados y las apps de antes de P23 lo llevan en el cajón del viaje o en el propio viaje: se miran
// DESPUÉS de la ficha, solo para no dejarlos sin aviso. No se mudan datos.
// Lo prueba pruebas/tokenDelPasajero.test.js, ejecutándolo con la nube de mentira.

const sirve = (t) => (typeof t === "string" && t.length > 0 ? t : null);

/** Función pura: de lo ya leído (ficha, cajón de contacto y viaje), el token que vale, o null. */
function elTokenDelPasajero({ ficha, contacto, viaje } = {}) {
  return sirve(ficha && ficha.fcmToken)
    || sirve(contacto && contacto.pasajeroFcmToken)
    || sirve(viaje && viaje.pasajeroFcmToken);
}

/** Lee la ficha del pasajero de ese viaje (y, por los viajes de antes, el cajón) y contesta con su token, o null. */
async function tokenDelPasajero(db, viajeId, viaje) {
  const uid = viaje && viaje.pasajeroId;
  const idSano = typeof uid === "string" && uid.length > 0 && !uid.includes("/");
  const [ficha, contacto] = await Promise.all([
    idSano ? db.collection("usuarios").doc(uid).get() : null,
    db.collection("viajes").doc(viajeId).collection("contacto").doc("pasajero").get(),
  ]);
  return elTokenDelPasajero({
    ficha: ficha && ficha.exists ? ficha.data() : null,
    contacto: contacto && contacto.exists ? contacto.data() : null,
    viaje,
  });
}

module.exports = { elTokenDelPasajero, tokenDelPasajero };
