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