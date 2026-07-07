const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// Distancia en km entre dos coordenadas (Haversine)
function distanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Tokens FCM de conductores activos DENTRO del radio (km) del pasajero.
// Un conductor sin ubicación conocida se incluye igual (su app filtra la distancia).
async function tokensConductoresCerca(pLat, pLng, radioKm) {
  const snap = await admin.firestore().collection("conductores").where("activo", "==", true).get();
  const tokens = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.fcmToken) return;
    const u = d.ubicacion;
    if (typeof pLat === "number" && typeof pLng === "number" &&
        u && typeof u.lat === "number" && typeof u.lng === "number") {
      if (distanciaKm(pLat, pLng, u.lat, u.lng) > (radioKm || 3)) return; // fuera del radio
    }
    tokens.push(d.fcmToken);
  });
  return tokens;
}

exports.notificarNuevoViaje = onDocumentCreated("viajes/{viajeId}", async (event) => {
  const viaje = event.data.data();
  if (!viaje || viaje.estado !== "esperando") return null;
  try {
    const tokens = await tokensConductoresCerca(viaje.pasajeroLat, viaje.pasajeroLng, viaje.radioBusqueda || 3);
    console.log("notificarNuevoViaje: conductores en radio con token:", tokens.length);
    if (tokens.length === 0) return null;
    await admin.messaging().sendEachForMulticast({
      notification: {
        title: "🚖 Nuevo viaje disponible",
        body: (viaje.tipo || "Taxi") + " — " + (viaje.tarifa || "$0"),
      },
      android: { priority: "high", notification: { sound: "default", channelId: "viajes" } },
      apns: { payload: { aps: { sound: "default", badge: 1, contentAvailable: true } }, headers: { "apns-priority": "10" } },
      tokens,
    });
    return null;
  } catch (e) {
    console.error("Error notificarNuevoViaje:", e.message);
    return null;
  }
});

exports.notificarNuevaOferta = onDocumentUpdated("viajes/{viajeId}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();
  if (!despues || despues.estado !== "esperando") return null;
  if (antes.tarifaValor === despues.tarifaValor) return null;
  try {
    const tokens = await tokensConductoresCerca(despues.pasajeroLat, despues.pasajeroLng, despues.radioBusqueda || 3);
    if (tokens.length === 0) return null;
    await admin.messaging().sendEachForMulticast({
      notification: {
        title: "⬆️ El pasajero subió su oferta",
        body: (despues.tipo || "Taxi") + " — " + (despues.tarifa || "$0"),
      },
      android: { priority: "high", notification: { sound: "default", channelId: "viajes" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } }, headers: { "apns-priority": "10" } },
      tokens,
    });
    return null;
  } catch (e) {
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

// El PASAJERO confirma a un conductor: transacción atómica.
// El primer pasajero que confirme al conductor lo gana; si ya está ocupado, devuelve motivo 'ocupado'.
exports.confirmarConductor = onCall(async (request) => {
  const { viajeId, conductorId } = request.data || {};
  if (!viajeId || !conductorId) throw new HttpsError("invalid-argument", "Faltan datos");
  const db = admin.firestore();
  const viajeRef = db.collection("viajes").doc(viajeId);
  const condRef = db.collection("conductores").doc(conductorId);
  const ofertaRef = viajeRef.collection("contraofertas").doc(conductorId);
  const usuarioRef = db.collection("usuarios").doc(conductorId);
  const configRef = db.collection("config").doc("global");
  try {
    return await db.runTransaction(async (t) => {
      const [viajeSnap, condSnap, ofertaSnap, usuarioSnap, configSnap] = await Promise.all([
        t.get(viajeRef), t.get(condRef), t.get(ofertaRef), t.get(usuarioRef), t.get(configRef),
      ]);
      if (!viajeSnap.exists) return { ok: false, motivo: "viaje_no_existe" };
      const viaje = viajeSnap.data();
      if (viaje.estado !== "esperando") return { ok: false, motivo: "viaje_no_disponible" };
      const cond = condSnap.exists ? condSnap.data() : {};
      if (cond.enViajeId && cond.enViajeId !== viajeId) return { ok: false, motivo: "ocupado" };
      if (!ofertaSnap.exists) return { ok: false, motivo: "sin_oferta" };
      const of = ofertaSnap.data();
      const cfg = configSnap.exists ? configSnap.data() : {};
      const tipo = viaje.tipo || "Taxi";
      const comision = tipo === "Mototaxi" ? (cfg.comisionMototaxi ?? 300)
        : tipo === "Mensajería" ? (cfg.comisionDomicilio ?? 1000)
          : (cfg.comisionTaxi ?? 800);
      const creditosActuales = (usuarioSnap.exists ? usuarioSnap.data().creditos : 0) || 0;

      t.update(viajeRef, {
        estado: "aceptado",
        conductorId,
        conductorNombre: of.conductorNombre || "",
        conductorTelefono: of.conductorTelefono || "",
        conductorPlaca: of.conductorPlaca || "",
        conductorVehiculo: of.conductorVehiculo || "",
        conductorFoto: of.conductorFoto || null,
        conductorColor: of.conductorColor || "",
        tarifa: of.monto || viaje.tarifa,
        tarifaValor: of.montoValor || viaje.tarifaValor,
        fechaAceptacion: new Date().toISOString(),
        comisionCobrada: comision,
      });
      t.set(condRef, { enViajeId: viajeId, ocupado: true }, { merge: true });
      t.set(usuarioRef, { creditos: creditosActuales - comision }, { merge: true });
      return { ok: true };
    });
  } catch (e) {
    console.error("Error confirmarConductor:", e.message);
    throw new HttpsError("internal", "No se pudo confirmar el conductor");
  }
});

// Avisar al PASAJERO por push (aunque tenga la app cerrada) cuando un conductor deja una oferta/contraoferta
exports.notificarPasajeroOferta = onDocumentCreated("viajes/{viajeId}/contraofertas/{conductorId}", async (event) => {
  const of = event.data && event.data.data();
  if (!of) return null;
  try {
    const viajeSnap = await admin.firestore().collection("viajes").doc(event.params.viajeId).get();
    if (!viajeSnap.exists) return null;
    const token = viajeSnap.data().pasajeroFcmToken;
    if (!token) return null;
    const cuerpo = (of.conductorNombre || "Un conductor") +
      (of.tipoOferta === "acepta" ? " aceptó tu oferta" : " te ofrece " + (of.monto || ""));
    await admin.messaging().send({
      token,
      notification: { title: "🚕 Tienes una oferta de un conductor", body: cuerpo },
      android: { priority: "high", notification: { sound: "default", channelId: "viajes" } },
      apns: { payload: { aps: { sound: "default", badge: 1 } }, headers: { "apns-priority": "10" } },
    });
    return null;
  } catch (e) {
    console.error("Error notificarPasajeroOferta:", e.message);
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