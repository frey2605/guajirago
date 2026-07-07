const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
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

// Notificar al restaurante (dueño + recepción/admin) cuando llega un pedido a domicilio
exports.notificarNuevoPedidoRestaurante = onDocumentCreated("pedidosRestaurantes/{id}", async (event) => {
  const p = event.data.data();
  if (!p || p.tipo === "local" || p.estado !== "nuevo") return null;
  const restauranteId = p.restauranteId;
  if (!restauranteId) return null;

  try {
    const tokens = [];
    const restSnap = await admin.firestore().collection("restaurantes").doc(restauranteId).get();
    if (restSnap.exists && restSnap.data().fcmToken) tokens.push(restSnap.data().fcmToken);

    const empSnap = await admin.firestore().collection("empleados").where("restauranteId", "==", restauranteId).get();
    empSnap.forEach((doc) => {
      const d = doc.data();
      const r = d.roles || {};
      if (d.fcmToken && d.activo !== false && (r.recepcionista || r.administrador)) tokens.push(d.fcmToken);
    });

    if (tokens.length === 0) {
      console.log("Sin tokens para restaurante", restauranteId);
      return null;
    }

    const totalTxt = p.total ? ("$" + Number(p.total).toLocaleString("es-CO")) : "";
    await admin.messaging().sendEachForMulticast({
      notification: {
        title: "🍽️ Nuevo pedido a domicilio",
        body: (p.cliente || "Cliente") + (totalTxt ? " — " + totalTxt : ""),
      },
      android: { priority: "high", notification: { sound: "default", channelId: "pedidos" } },
      apns: {
        payload: { aps: { sound: "default", badge: 1, contentAvailable: true } },
        headers: { "apns-priority": "10" },
      },
      tokens: tokens,
    });

    console.log("Notif pedido restaurante enviada a", tokens.length, "tokens");
    return null;
  } catch (e) {
    console.error("Error notificarNuevoPedidoRestaurante:", e.message);
    return null;
  }
});

// Avisar al CLIENTE cuando su pedido a domicilio cambia de estado
exports.notificarClientePedido = onDocumentUpdated("pedidosRestaurantes/{id}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();
  if (!despues || !despues.clienteFcmToken) return null;
  if (antes.estado === despues.estado) return null;

  const restNombre = despues.restauranteNombre || "El restaurante";
  const mensajes = {
    confirmado: { title: "✅ Pedido confirmado", body: restNombre + " confirmó tu pedido" + (despues.tiempoEstimado ? " · listo en ~" + despues.tiempoEstimado + " min" : "") },
    preparando: { title: "👨‍🍳 Preparando tu pedido", body: "Ya están cocinando lo tuyo en " + restNombre },
    en_camino: { title: "🛵 Tu pedido va en camino", body: "El domiciliario salió con tu pedido" },
    entregado: { title: "🎉 ¡Pedido entregado!", body: "¡Buen provecho! Gracias por pedir con GuajiraGo" },
    cancelado: { title: "❌ Pedido cancelado", body: "Tu pedido en " + restNombre + " fue cancelado" + (despues.motivoRechazo ? ": " + despues.motivoRechazo : "") },
  };
  const m = mensajes[despues.estado];
  if (!m) return null;

  try {
    await admin.messaging().send({
      token: despues.clienteFcmToken,
      notification: m,
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } }, headers: { "apns-priority": "10" } },
    });
    console.log("Aviso al cliente:", despues.estado);
    return null;
  } catch (e) {
    console.error("Error notificarClientePedido:", e.message);
    return null;
  }
});

// Avisar a la AGENCIA cuando llega una nueva reserva de turismo
exports.notificarNuevaReserva = onDocumentCreated("reservasTurismo/{id}", async (event) => {
  const r = event.data.data();
  if (!r || r.estado !== "nueva") return null;
  const agenciaId = r.agenciaId;
  if (!agenciaId) return null;
  try {
    const tokens = [];
    const agSnap = await admin.firestore().collection("restaurantes").doc(agenciaId).get();
    if (agSnap.exists && agSnap.data().fcmToken) tokens.push(agSnap.data().fcmToken);
    const empSnap = await admin.firestore().collection("empleados").where("restauranteId", "==", agenciaId).get();
    empSnap.forEach((doc) => {
      const d = doc.data();
      if (d.fcmToken && d.activo !== false && (d.roles || {}).administrador) tokens.push(d.fcmToken);
    });
    if (tokens.length === 0) return null;
    const totalTxt = r.total ? ("$" + Number(r.total).toLocaleString("es-CO")) : "";
    await admin.messaging().sendEachForMulticast({
      notification: {
        title: "🧭 Nueva reserva",
        body: (r.cliente || "Cliente") + " reservó " + (r.nombreTour || "un tour") + (totalTxt ? " — " + totalTxt : ""),
      },
      android: { priority: "high", notification: { sound: "default", channelId: "pedidos" } },
      apns: { payload: { aps: { sound: "default", badge: 1, contentAvailable: true } }, headers: { "apns-priority": "10" } },
      tokens: tokens,
    });
    return null;
  } catch (e) {
    console.error("Error notificarNuevaReserva:", e.message);
    return null;
  }
});

// Avisar al CLIENTE cuando su reserva cambia de estado
exports.notificarClienteReserva = onDocumentUpdated("reservasTurismo/{id}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();
  if (!despues || !despues.clienteFcmToken) return null;
  if (antes.estado === despues.estado) return null;
  const ag = despues.agenciaNombre || "La agencia";
  const mensajes = {
    confirmada: { title: "✅ Reserva confirmada", body: ag + " confirmó tu reserva de " + (despues.nombreTour || "tu tour") + (despues.codigo ? " · código " + despues.codigo : "") },
    realizada: { title: "🏁 ¡Tour realizado!", body: "Gracias por viajar con GuajiraGo" },
    cancelada: { title: "❌ Reserva cancelada", body: "Tu reserva en " + ag + " fue cancelada" + (despues.motivoCancelacion ? ": " + despues.motivoCancelacion : "") },
  };
  const m = mensajes[despues.estado];
  if (!m) return null;
  try {
    await admin.messaging().send({
      token: despues.clienteFcmToken,
      notification: m,
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } }, headers: { "apns-priority": "10" } },
    });
    return null;
  } catch (e) {
    console.error("Error notificarClienteReserva:", e.message);
    return null;
  }
});

// Pasajero sube su tarifa mientras espera
exports.subirTarifa = onCall(async (request) => {
  const { viajeId, nuevaTarifa } = request.data;
  if (!viajeId || !nuevaTarifa) throw new Error("Faltan datos");

  await admin.firestore().collection("viajes").doc(viajeId).update({
    tarifa: "$" + nuevaTarifa.toLocaleString(),
    tarifaValor: nuevaTarifa,
    nuevaOferta: new Date().toISOString(),
    estado: "esperando",
  });

  console.log("Tarifa subida a:", nuevaTarifa, "en viaje:", viajeId);
  return { ok: true };
});