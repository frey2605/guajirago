const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────
// NOTIFICACIONES (igual que antes, no se toca)
// ─────────────────────────────────────────────

exports.notificarNuevoViaje = onDocumentCreated("viajes/{viajeId}", async (event) => {
  const viaje = event.data.data();
  console.log("notificarNuevoViaje disparado, estado:", viaje?.estado);
  if (!viaje || viaje.estado !== "esperando") return null;
  try {
    const snap = await db.collection("conductores").where("activo", "==", true).get();
    if (snap.empty) return null;
    const tokens = [];
    snap.forEach(doc => { const d = doc.data(); if (d.fcmToken) tokens.push(d.fcmToken); });
    if (tokens.length === 0) return null;
    const resultado = await admin.messaging().sendEachForMulticast({
      notification: { title: "🚖 Nuevo viaje disponible", body: (viaje.tipo || "Taxi") + " — " + (viaje.tarifa || "$0") },
      android: { priority: "high", notification: { sound: "default", channelId: "viajes" } },
      apns: { payload: { aps: { sound: "default", badge: 1, contentAvailable: true } }, headers: { "apns-priority": "10" } },
      tokens,
    });
    console.log("Notificaciones enviadas:", resultado.successCount, "exitosas,", resultado.failureCount, "fallidas");
    return null;
  } catch(e) { console.error("Error general:", e.message); return null; }
});

exports.notificarNuevaOferta = onDocumentUpdated("viajes/{viajeId}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();
  if (!despues || despues.estado !== "esperando") return null;
  if (antes.tarifaValor === despues.tarifaValor) return null;
  try {
    const snap = await db.collection("conductores").where("activo", "==", true).get();
    const tokens = [];
    snap.forEach(doc => { const d = doc.data(); if (d.fcmToken) tokens.push(d.fcmToken); });
    if (tokens.length === 0) return null;
    await admin.messaging().sendEachForMulticast({
      notification: { title: "⬆️ El pasajero subió su oferta", body: (despues.tipo || "Taxi") + " — " + (despues.tarifa || "$0") },
      android: { priority: "high", notification: { sound: "default", channelId: "viajes" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } }, headers: { "apns-priority": "10" } },
      tokens,
    });
    return null;
  } catch(e) { console.error("Error notificarNuevaOferta:", e.message); return null; }
});

// ─────────────────────────────────────────────
// CEREBRO V2.0 — Cloud Functions como árbitro
// ─────────────────────────────────────────────

// El pasajero solicita un viaje
exports.crearViaje = onCall(async (request) => {
  const { pasajeroId, pasajeroEmail, pasajeroLat, pasajeroLng, tipo, origen, destino, tarifa, tarifaValor } = request.data;
  if (!pasajeroId || !origen || !destino) throw new HttpsError("invalid-argument", "Faltan datos del viaje");

  const viajeRef = db.collection("viajes").doc();
  await viajeRef.set({
    pasajeroId,
    pasajeroEmail,
    pasajeroLat,
    pasajeroLng,
    tipo,
    origen,
    destino,
    tarifa,
    tarifaValor,
    estado: "esperando",
    fechaSolicitud: new Date().toISOString(),
  });

  console.log("Viaje creado:", viajeRef.id);
  return { viajeId: viajeRef.id };
});

// El conductor envía una oferta o contraoferta
exports.enviarOferta = onCall(async (request) => {
  const { viajeId, conductorId, conductorNombre, conductorPlaca, conductorVehiculo, conductorTelefono, tarifaValor } = request.data;
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos de la oferta");

  const viajeRef = db.collection("viajes").doc(viajeId);
  const viajeSnap = await viajeRef.get();
  if (!viajeSnap.exists) throw new HttpsError("not-found", "Viaje no encontrado");

  const viaje = viajeSnap.data();
  if (viaje.estado !== "esperando" && viaje.estado !== "contraoferta") {
    throw new HttpsError("failed-precondition", "El viaje no está disponible");
  }

  // Guardar oferta en subcolección — cada conductor tiene su propio espacio
  await db.collection("viajes").doc(viajeId).collection("ofertas").doc(conductorId).set({
    conductorId,
    conductorNombre,
    conductorPlaca,
    conductorVehiculo,
    conductorTelefono,
    tarifaValor,
    tarifa: "$" + tarifaValor.toLocaleString(),
    estado: "pendiente",
    fecha: new Date().toISOString(),
  });

  // Actualizar estado del viaje
  await viajeRef.update({
    estado: "contraoferta",
    ultimaOfertaConductorId: conductorId,
    ultimaOfertaFecha: new Date().toISOString(),
  });

  console.log("Oferta enviada por conductor:", conductorId, "en viaje:", viajeId);
  return { ok: true };
});

// El pasajero acepta una oferta
exports.aceptarOferta = onCall(async (request) => {
  const { viajeId, conductorId } = request.data;
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos");

  const viajeRef = db.collection("viajes").doc(viajeId);
  const ofertaRef = db.collection("viajes").doc(viajeId).collection("ofertas").doc(conductorId);

  const [viajeSnap, ofertaSnap] = await Promise.all([viajeRef.get(), ofertaRef.get()]);
  if (!viajeSnap.exists) throw new HttpsError("not-found", "Viaje no encontrado");
  if (!ofertaSnap.exists) throw new HttpsError("not-found", "Oferta no encontrada");

  const oferta = ofertaSnap.data();

  // Usar transacción para evitar condiciones de carrera
  await db.runTransaction(async (t) => {
    t.update(viajeRef, {
      estado: "aceptado",
      conductorId: oferta.conductorId,
      conductorNombre: oferta.conductorNombre,
      conductorPlaca: oferta.conductorPlaca,
      conductorVehiculo: oferta.conductorVehiculo,
      conductorTelefono: oferta.conductorTelefono,
      tarifa: oferta.tarifa,
      tarifaValor: oferta.tarifaValor,
      fechaAceptado: new Date().toISOString(),
    });
    t.update(ofertaRef, { estado: "aceptada" });
  });

  console.log("Oferta aceptada, conductor:", conductorId, "viaje:", viajeId);
  return { ok: true };
});

// El pasajero rechaza una oferta
exports.rechazarOferta = onCall(async (request) => {
  const { viajeId, conductorId } = request.data;
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos");

  await db.collection("viajes").doc(viajeId).collection("ofertas").doc(conductorId).update({
    estado: "rechazada",
  });

  // Volver a esperando
  await db.collection("viajes").doc(viajeId).update({
    estado: "esperando",
    ultimaOfertaConductorId: null,
  });

  console.log("Oferta rechazada, conductor:", conductorId, "viaje:", viajeId);
  return { ok: true };
});

// El pasajero sube su tarifa
exports.subirTarifa = onCall(async (request) => {
  const { viajeId, nuevaTarifa } = request.data;
  if (!viajeId || !nuevaTarifa) throw new HttpsError("invalid-argument", "Faltan datos");

  await db.collection("viajes").doc(viajeId).update({
    tarifa: "$" + nuevaTarifa.toLocaleString(),
    tarifaValor: nuevaTarifa,
    estado: "esperando",
    nuevaOferta: new Date().toISOString(),
  });

  console.log("Tarifa subida a:", nuevaTarifa, "en viaje:", viajeId);
  return { ok: true };
});

// El conductor inicia el viaje
exports.iniciarViaje = onCall(async (request) => {
  const { viajeId, conductorId } = request.data;
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos");

  const viajeSnap = await db.collection("viajes").doc(viajeId).get();
  if (!viajeSnap.exists) throw new HttpsError("not-found", "Viaje no encontrado");
  if (viajeSnap.data().conductorId !== conductorId) throw new HttpsError("permission-denied", "No autorizado");

  await db.collection("viajes").doc(viajeId).update({
    fase: "en_viaje",
    fechaInicio: new Date().toISOString(),
  });

  console.log("Viaje iniciado:", viajeId);
  return { ok: true };
});

// El conductor finaliza el viaje
exports.finalizarViaje = onCall(async (request) => {
  const { viajeId, conductorId } = request.data;
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos");

  const viajeSnap = await db.collection("viajes").doc(viajeId).get();
  if (!viajeSnap.exists) throw new HttpsError("not-found", "Viaje no encontrado");
  if (viajeSnap.data().conductorId !== conductorId) throw new HttpsError("permission-denied", "No autorizado");

  await db.collection("viajes").doc(viajeId).update({
    estado: "finalizado",
    fase: "finalizado",
    fechaFin: new Date().toISOString(),
  });

  console.log("Viaje finalizado:", viajeId);
  return { ok: true };
});

// Cualquiera cancela el viaje
exports.cancelarViaje = onCall(async (request) => {
  const { viajeId, canceladoPor, razonCancelacion } = request.data;
  if (!viajeId) throw new HttpsError("invalid-argument", "Faltan datos");

  await db.collection("viajes").doc(viajeId).update({
    estado: canceladoPor === "conductor" ? "cancelado_conductor" : "cancelado",
    canceladoPor,
    razonCancelacion: razonCancelacion || "Sin razón",
    fechaCancelacion: new Date().toISOString(),
  });

  console.log("Viaje cancelado:", viajeId, "por:", canceladoPor);
  return { ok: true };
});

// El conductor llega al punto
exports.conductorEnPunto = onCall(async (request) => {
  const { viajeId, conductorId } = request.data;
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos");

  await db.collection("viajes").doc(viajeId).update({
    conductorEnPunto: true,
    fase: "en_punto",
    tiempoEspera: new Date().toISOString(),
  });

  console.log("Conductor en punto:", viajeId);
  return { ok: true };
});

// ─────────────────────────────────────────────
// LIMPIEZA AUTOMÁTICA (igual que antes)
// ─────────────────────────────────────────────

exports.limpiarAtascados = onSchedule("every 1 minutes", async () => {
  const ahora = Date.now();
  const TIEMPOS = {
    contraoferta: 1 * 60 * 1000,
    confirmando: 1 * 60 * 1000,
    esperando: 5 * 60 * 1000,
    aceptado: 15 * 60 * 1000,
  };

  try {
    const viajesSnap = await db.collection("viajes")
      .where("estado", "in", ["contraoferta", "confirmando", "esperando", "aceptado"])
      .get();

    const batch = db.batch();
    let count = 0;

    viajesSnap.forEach(doc => {
      const data = doc.data();
      const fechaRef = data.nuevaOferta || data.fechaSolicitud;
      if (!fechaRef) return;
      const edad = ahora - new Date(fechaRef).getTime();
      const limite = TIEMPOS[data.estado];
      if (limite && edad > limite) {
        batch.update(doc.ref, { estado: "cancelado", canceladoPor: "sistema", razonCancelacion: "Expirado automáticamente" });
        count++;
      }
    });

    const conductoresSnap = await db.collection("conductores").where("activo", "==", true).get();
    conductoresSnap.forEach(doc => {
      const data = doc.data();
      if (!data.ubicacion?.timestamp) return;
      const edad = ahora - new Date(data.ubicacion.timestamp).getTime();
      if (edad > 5 * 60 * 1000) {
        batch.update(doc.ref, { activo: false });
      }
    });

    await batch.commit();
    console.log("Limpieza completada:", count, "viajes cancelados");
    return null;
  } catch(e) { console.error("Error en limpiarAtascados:", e.message); return null; }
});