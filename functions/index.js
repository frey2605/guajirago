const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.notificarNuevoViaje = onDocumentCreated("viajes/{viajeId}", async (event) => {
  const viaje = event.data.data();
  if (!viaje || viaje.estado !== "esperando") return null;
  try {
    const snap = await admin.firestore()
      .collection("conductores")
      .where("activo", "==", true)
      .get();
    if (snap.empty) return null;
    const tokens = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (d.fcmToken) tokens.push(d.fcmToken);
    });
    if (tokens.length === 0) return null;
    await admin.messaging().sendEachForMulticast({
      notification: {
        title: "Nuevo viaje disponible",
        body: viaje.tipo + " - " + viaje.tarifa,
      },
      tokens: tokens,
    });
    return null;
  } catch(e) {
    console.error(e);
    return null;
  }
});