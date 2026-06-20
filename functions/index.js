const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.notificarNuevoViaje = onDocumentCreated("viajes/{viajeId}", async (event) => {
  const viaje = event.data.data();
  console.log("notificarNuevoViaje disparado, estado:", viaje?.estado);

  if (!viaje || viaje.estado !== "esperando") {
    console.log("Ignorado: estado no es esperando");
    return null;
  }

  try {
    const snap = await admin.firestore()
      .collection("conductores")
      .where("activo", "==", true)
      .get();

    console.log("Conductores activos encontrados:", snap.size);

    if (snap.empty) {
      console.log("No hay conductores activos");
      return null;
    }

    const tokens = [];
    snap.forEach(doc => {
      const d = doc.data();
      console.log("Conductor:", doc.id, "tiene token:", !!d.fcmToken);
      if (d.fcmToken) tokens.push(d.fcmToken);
    });

    console.log("Tokens FCM encontrados:", tokens.length);

    if (tokens.length === 0) {
      console.log("Ningún conductor tiene token FCM");
      return null;
    }

    const resultado = await admin.messaging().sendEachForMulticast({
      notification: {
        title: "🚖 Nuevo viaje disponible",
        body: (viaje.tipo || "Taxi") + " — " + (viaje.tarifa || "$0"),
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "viajes",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
        headers: {
          "apns-priority": "10",
        },
      },
      tokens: tokens,
    });

    console.log("Notificaciones enviadas:", resultado.successCount, "exitosas,", resultado.failureCount, "fallidas");

    resultado.responses.forEach((resp, i) => {
      if (!resp.success) {
        console.error("Error token", i, ":", resp.error?.message);
      }
    });

    return null;
  } catch(e) {
    console.error("Error general:", e.message);
    return null;
  }
});

exports.notificarNuevaOferta = require("firebase-functions/v2/firestore").onDocumentUpdated("viajes/{viajeId}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();

  if (!despues || despues.estado !== "esperando") return null;
  if (antes.tarifaValor === despues.tarifaValor) return null;

  console.log("notificarNuevaOferta: oferta subió de", antes.tarifaValor, "a", despues.tarifaValor);

  try {
    const snap = await admin.firestore()
      .collection("conductores")
      .where("activo", "==", true)
      .get();

    const tokens = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.fcmToken) tokens.push(d.fcmToken);
    });

    if (tokens.length === 0) return null;

    await admin.messaging().sendEachForMulticast({
      notification: {
        title: "⬆️ El pasajero subió su oferta",
        body: (despues.tipo || "Taxi") + " — " + (despues.tarifa || "$0"),
      },
      android: {
        priority: "high",
        notification: { sound: "default", channelId: "viajes" },
      },
      apns: {
        payload: { aps: { sound: "default", badge: 1 } },
        headers: { "apns-priority": "10" },
      },
      tokens: tokens,
    });

    console.log("Notificación nueva oferta enviada a", tokens.length, "conductores");
    return null;
  } catch(e) {
    console.error("Error notificarNuevaOferta:", e.message);
    return null;
  }
});

// Limpieza automática de viajes atascados y conductores inactivos
exports.limpiarAtascados = require("firebase-functions/v2/scheduler").onSchedule("every 1 minutes", async () => {
  const ahora = Date.now();
  const db = admin.firestore();

  const TIEMPOS = {
    contraoferta: 1 * 60 * 1000,   // 1 minuto
    confirmando:  1 * 60 * 1000,   // 1 minuto
    esperando:    5 * 60 * 1000,   // 5 minutos
    aceptado:    15 * 60 * 1000,   // 15 minutos
  };

  try {
    // Limpiar viajes atascados
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
        batch.update(doc.ref, {
          estado: "cancelado",
          canceladoPor: "sistema",
          razonCancelacion: "Expirado automáticamente",
        });
        count++;
        console.log("Viaje atascado cancelado:", doc.id, "estado:", data.estado, "edad:", Math.round(edad/1000), "s");
      }
    });

    // Limpiar conductores inactivos (sin actualizar ubicación en 5 minutos)
    const conductoresSnap = await db.collection("conductores")
      .where("activo", "==", true)
      .get();

    conductoresSnap.forEach(doc => {
      const data = doc.data();
      if (!data.ubicacion?.timestamp) return;
      const edad = ahora - new Date(data.ubicacion.timestamp).getTime();
      if (edad > 5 * 60 * 1000) {
        batch.update(doc.ref, { activo: false });
        console.log("Conductor marcado inactivo:", doc.id, "sin GPS hace:", Math.round(edad/1000), "s");
      }
    });

    await batch.commit();
    console.log("Limpieza completada:", count, "viajes cancelados");
    return null;
  } catch(e) {
    console.error("Error en limpiarAtascados:", e.message);
    return null;
  }
});