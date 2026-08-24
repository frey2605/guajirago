const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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
  // REGLA 2 — esta función COBRA la comisión al conductor. Hasta el 23-ago-2026 no
  // preguntaba quién llamaba: cualquiera, incluso sin cuenta, podía confirmar el
  // viaje de otro y descontarle $800 a un conductor. Medido: 7 conductores con
  // $291.700 en créditos; el mayor, $74.800 = 93 llamadas para vaciarlo.
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");
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
      // Solo el DUEÑO del viaje confirma. Va dentro de la transacción a propósito:
      // fuera, alguien podría cambiar el pasajeroId entre la lectura y el cobro.
      // Medido el 23-ago-2026: los 91 viajes de la base tienen pasajeroId. Ni una
      // excepción, así que esto no deja a nadie fuera.
      if (viaje.pasajeroId !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Este viaje no es tuyo");
      }
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
    // Un rechazo de seguridad se devuelve tal cual. Si se disfraza de "internal",
    // el registro miente y nadie se entera de que alguien intentó colarse.
    if (e instanceof HttpsError) throw e;
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

// Liberar al conductor (enViajeId + ocupado) cuando el viaje llega a un estado terminal.
// Imprescindible cuando el pasajero cancela (no puede escribir el doc del conductor por reglas) o si la app del conductor está cerrada.
exports.onViajeCerrado = onDocumentUpdated("viajes/{viajeId}", async (event) => {
  const antes = event.data.before.data();
  const despues = event.data.after.data();
  if (!antes || !despues) return null;
  const terminales = ["finalizado", "cancelado", "cancelado_conductor", "vencido", "expirado"];
  if (antes.estado === despues.estado) return null;
  if (!terminales.includes(despues.estado)) return null;
  const cid = despues.conductorId;
  if (!cid) return null;
  try {
    await admin.firestore().collection("conductores").doc(cid)
      .set({ enViajeId: null, ocupado: false }, { merge: true });
  } catch (e) {
    console.error("Error onViajeCerrado:", e.message);
  }
  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// VENCER VIAJES COLGADOS — evita que el panel muestre "EN CURSO" para siempre.
// Corre cada 30 min y cierra los viajes que quedaron a medias:
//   • 'esperando' de +20 min (búsquedas que se colgaron con la app cerrada) → 'vencido'.
//   • 'aceptado' de +1 h desde que lo tomó el conductor (viaje abandonado, nunca se
//     marcó finalizado) → 'expirado'. Se CONSERVA el registro (tuvo conductor, valor legal);
//     onViajeCerrado libera al conductor (enViajeId/ocupado) porque 'expirado' es terminal.
exports.expirarViajesColgados = onSchedule(
  { schedule: "every 30 minutes", timeZone: "America/Bogota", timeoutSeconds: 300 },
  async () => {
    const db = admin.firestore();
    const ahora = Date.now();
    const haceMin = (m) => new Date(ahora - m * 60000).toISOString();
    const limiteEsperando = haceMin(20);   // 20 minutos
    const limiteEnCurso = haceMin(60);      // 1 hora
    let vencidos = 0, expirados = 0;

    // 1) Búsquedas colgadas ('esperando') → 'vencido'
    try {
      const snap = await db.collection("viajes").where("estado", "==", "esperando").limit(400).get();
      for (const d of snap.docs) {
        const f = (d.data() || {}).fechaSolicitud || "";
        if (f && f < limiteEsperando) { await d.ref.update({ estado: "vencido" }); vencidos++; }
      }
    } catch (e) { console.error("expirar esperando:", e.message); }

    // 2) Viajes en curso abandonados ('aceptado' +3h) → 'expirado'
    try {
      const snap = await db.collection("viajes").where("estado", "==", "aceptado").limit(400).get();
      for (const d of snap.docs) {
        const v = d.data() || {};
        const ref = v.fechaAceptacion || v.fechaSolicitud || "";
        if (ref && ref < limiteEnCurso) {
          await d.ref.update({ estado: "expirado", fechaExpiracion: new Date().toISOString(), expiradoPor: "sistema" });
          expirados++;
        }
      }
    } catch (e) { console.error("expirar en curso:", e.message); }

    console.log("expirarViajesColgados: vencidos =", vencidos, "expirados =", expirados);
    return null;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// REGLAS 5 y 11 — VERIFICAR EL CODIGO DE SEGURIDAD, EN EL SERVIDOR
//
// El código que la pasajera le dice al conductor al subirse servía para comprobar
// que ese es SU conductor. Hasta el 23-ago-2026 tenía dos fallos graves:
//   1. NO era un código: era el día y el mes de nacimiento de la pasajera
//      (Solicitar.js). El mismo en todos sus viajes, para siempre.
//   2. Viajaba DENTRO del viaje, y cualquiera que mirase el mercado lo leía. Un
//      impostor podía leerlo, plantarse y decirlo. El código no protegía de nada.
//
// Ahora el código es distinto en cada viaje, vive aparte (viajes/{id}/privado/
// seguridad) donde SOLO lo ve la pasajera, y la comparación se hace AQUI. Ni
// siquiera el conductor que va asignado puede leerlo: solo puede preguntar si el
// que le dijeron es el bueno.
exports.verificarCodigoViaje = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");
  const { viajeId, codigo } = request.data || {};
  if (!viajeId || !codigo) throw new HttpsError("invalid-argument", "Faltan datos");

  const db = admin.firestore();
  const viajeSnap = await db.collection("viajes").doc(viajeId).get();
  if (!viajeSnap.exists) throw new HttpsError("not-found", "Ese viaje no existe");

  // Solo el conductor ASIGNADO pregunta. Si no, cualquiera podría probar códigos
  // uno por uno hasta acertar, en el viaje de quien fuera.
  if (viajeSnap.data().conductorId !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Este viaje no es tuyo");
  }

  const secreto = await db.collection("viajes").doc(viajeId)
    .collection("privado").doc("seguridad").get();
  if (!secreto.exists) return { ok: true, motivo: "sin_codigo" };

  const acierta = String(secreto.data().codigo || "").trim() === String(codigo).trim();
  return { ok: acierta };
});

// ─────────────────────────────────────────────────────────────────────────────
// REGLA 6 — ¿ESTE CELULAR YA ESTÁ REGISTRADO?
//
// El registro comprueba que el celular no esté repetido, para proteger el crédito
// de bienvenida (Login.js). Antes lo hacía pidiendo la LISTA de fichas desde el
// celular, y por eso la lista tenía que estar abierta a cualquiera: ahí se veían
// los teléfonos, las fechas de nacimiento y las fotos de cédula de todo el mundo.
//
// Ahora la pregunta se hace aquí. El servidor mira la lista y devuelve UN SÍ O UN
// NO. Nunca devuelve de quién es el celular, ni ningún otro dato: quien pregunta
// solo se entera de lo que ya sabía — el número que él mismo escribió.
exports.celularDisponible = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");
  const celular = String((request.data || {}).celular || "").trim();
  if (!celular) throw new HttpsError("invalid-argument", "Falta el celular");

  const snap = await admin.firestore()
    .collection("usuarios").where("celular", "==", celular).limit(2).get();

  // Su propia ficha no cuenta: si vuelve a intentarlo, no se bloquea a sí mismo.
  const deOtro = snap.docs.some((d) => d.id !== request.auth.uid);
  return { disponible: !deOtro };
});

// REGLA 2 — subirTarifa RETIRADA el 23-ago-2026.
// Estaba desplegada y no preguntaba quién llamaba: permitía reescribir el precio de
// CUALQUIER viaje al valor que fuera y devolverlo a "esperando". Medido: ninguna de
// las tres apps la llamaba. El botón "+" de subir tarifa que ve el pasajero es una
// función LOCAL de la pantalla (Solicitar.js:876 y SolicitarMensajeria.js:881), que
// escribe el viaje directamente — nunca pasó por aquí.
// No se le pone candado a una puerta que no lleva a ningún sitio: se quita la puerta.
// Su código queda en el historial de git (commit 9404aba y anteriores) por si vuelve.

// ─────────────────────────────────────────────────────────────────────────────
// LIMPIEZA AUTOMÁTICA — control de crecimiento SIN tocar datos con valor.
// SOLO borra "basura": búsquedas de viaje que NINGÚN conductor tomó ('vencido')
// de más de 2 días. Nadie viajó en ellas → no tienen valor legal ni de seguridad.
// Los viajes REALES (finalizado, cancelado, cancelado_conductor, etc.) se CONSERVAN
// PARA SIEMPRE, con conductor, pasajero, teléfonos, ruta y código de seguridad, por si
// se necesitan para un tema de seguridad/legal. Ganancias e historial no se tocan.
exports.limpiezaDiaria = onSchedule(
  { schedule: "every day 03:00", timeZone: "America/Bogota", timeoutSeconds: 540, memory: "512MiB" },
  async () => {
    const db = admin.firestore();
    const ahora = Date.now();
    const hace2 = new Date(ahora - 2 * 86400000).toISOString();
    let borrados = 0;

    try {
      // Solo las búsquedas fallidas ('vencido'); tanda acotada, el conjunto se reduce al borrarlas.
      const snap = await db.collection("viajes").where("estado", "==", "vencido").limit(400).get();
      for (const docu of snap.docs) {
        const v = docu.data() || {};
        const f = v.fechaSolicitud || "";
        if (f && f < hace2) {
          await db.recursiveDelete(docu.ref); // borra la búsqueda fallida + sus subcolecciones
          borrados++;
        }
      }
      console.log("limpiezaDiaria: búsquedas fallidas eliminadas =", borrados);
    } catch (err) {
      console.error("Error en limpiezaDiaria:", err.message);
    }
    return null;
  }
);
// ─────────────────────────────────────────────────────────────────────────────
// REGLA 7 — LA PLATA NO LA DECIDE EL TELÉFONO
//
// Medido el 24-ago-2026: $369.700 en créditos repartidos en 8 fichas, y las
// reglas de Firestore dejaban que CUALQUIERA escribiera su propio campo
// 'creditos'. Se cerraron 'rol', 'email', 'activo'… pero el saldo quedó abierto.
//
// Había tres caminos que pasaban por el celular: canjear un código de recarga,
// reclamar una promoción y los créditos de bienvenida del conductor nuevo. Los
// tres hacían la cuenta EN EL TELÉFONO y escribían el resultado. Ahora la cuenta
// vive aquí, donde nadie la puede tocar, y las reglas congelan los dos campos.
//
// La cuenta es LA MISMA que hacía la app: se mudó de sitio, no se cambió.
// (Cobrar la comisión ya lo hacía el servidor desde el principio: eso estaba
// bien hecho y no se toca.)
// ─────────────────────────────────────────────────────────────────────────────

/** Canjea un código de recarga y suma el saldo. Antes: Creditos.js en el celular. */
exports.canjearCodigoRecarga = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");
  const codigo = String((request.data || {}).codigo || "").trim().toUpperCase();
  if (!codigo) throw new HttpsError("invalid-argument", "Falta el código");

  const db = admin.firestore();
  const refCodigo = db.collection("codigos").doc(codigo);
  const refUsuario = db.collection("usuarios").doc(request.auth.uid);

  try {
    return await db.runTransaction(async (t) => {
      const snapCodigo = await t.get(refCodigo);
      if (!snapCodigo.exists) throw new HttpsError("not-found", "Ese código no existe. Verifícalo");
      const datos = snapCodigo.data() || {};
      if (datos.usado === true) throw new HttpsError("already-exists", "Ese código ya fue usado");
      const valor = datos.valor || 0;
      if (valor <= 0) throw new HttpsError("invalid-argument", "Código inválido");

      const snapUsuario = await t.get(refUsuario);
      const saldoActual = snapUsuario.exists ? (snapUsuario.data().creditos || 0) : 0;

      t.update(refCodigo, {
        usado: true,
        usadoPor: request.auth.uid,
        fechaUso: new Date().toISOString(),
      });
      t.set(refUsuario, { creditos: saldoActual + valor }, { merge: true });
      return { valor, saldo: saldoActual + valor };
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("Error canjearCodigoRecarga:", e.message);
    throw new HttpsError("internal", "No se pudo canjear el código");
  }
});

/** Reclama una promoción y deja el descuento pendiente. Antes: Promociones.js en el celular. */
exports.reclamarPromocion = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");
  const codigo = String((request.data || {}).codigo || "").trim().toUpperCase();
  if (!codigo) throw new HttpsError("invalid-argument", "Falta el código");

  const db = admin.firestore();
  const refPromo = db.collection("promociones").doc(codigo);
  const refUso = refPromo.collection("usos").doc(request.auth.uid);
  const refUsuario = db.collection("usuarios").doc(request.auth.uid);

  try {
    return await db.runTransaction(async (t) => {
      const snapPromo = await t.get(refPromo);
      if (!snapPromo.exists) throw new HttpsError("not-found", "Ese código no existe. Verifícalo");
      const promo = snapPromo.data() || {};
      const ahora = new Date();
      if (!promo.activa) throw new HttpsError("failed-precondition", "Esta promoción ya no está disponible");
      if (new Date(promo.fechaInicio + "T00:00:00") > ahora || new Date(promo.fechaFin + "T23:59:59") < ahora) {
        throw new HttpsError("failed-precondition", "Esta promoción ya no está disponible");
      }

      // El tipo de cuenta se lee de la FICHA, no de lo que diga el teléfono:
      // antes el celular mandaba su propio 'tipoUsuario' para pasar este filtro.
      const snapUsuario = await t.get(refUsuario);
      const esConductor = snapUsuario.exists && snapUsuario.data().tipo === "conductor";
      if (promo.aplicaA === "pasajeros" && esConductor) {
        throw new HttpsError("failed-precondition", "Esta promoción no aplica para tu tipo de cuenta");
      }
      if (promo.aplicaA === "conductores" && !esConductor) {
        throw new HttpsError("failed-precondition", "Esta promoción no aplica para tu tipo de cuenta");
      }

      // El tope por persona SÍ funciona, aunque el contador se escriba lejos de
      // aquí: quien lo sube es AppConductor.js:1096, cuando el conductor
      // verifica el código y el descuento se CONSUME de verdad. La misma ruta
      // (promociones/{codigo}/usos/{uid}) que se lee aquí. O sea: cuenta los
      // descuentos usados, no los reclamados — que es lo correcto.
      const snapUso = await t.get(refUso);
      const usosPrevios = snapUso.exists ? (snapUso.data().veces || 0) : 0;
      if (promo.limiteUsosPorPersona && usosPrevios >= promo.limiteUsosPorPersona) {
        throw new HttpsError("resource-exhausted", "Ya usaste esta promoción el máximo de veces permitido");
      }

      const codigoVerificacion = String(Math.floor(1000 + Math.random() * 9000));
      t.set(refUsuario, {
        descuentoPendiente: {
          promoId: codigo,
          tipoBeneficio: promo.tipoBeneficio,
          valorBeneficio: promo.valorBeneficio || 0,
          fechaActivacion: new Date().toISOString(),
          codigoVerificacion,
        },
      }, { merge: true });

      return { tipo: promo.tipoBeneficio, valor: promo.valorBeneficio || 0, codigoVerificacion };
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("Error reclamarPromocion:", e.message);
    throw new HttpsError("internal", "Error al aplicar el código. Intenta de nuevo");
  }
});

/**
 * Créditos de bienvenida del conductor nuevo. Antes: App.js decidía el monto en
 * el celular y se lo escribía. El monto sale de config/global, y el tipo de
 * vehículo de la FICHA — no de lo que mande el teléfono.
 * Devuelve { creditos: n } con lo que se acreditó (0 si no le tocaba).
 */
exports.creditosDeBienvenida = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");

  const db = admin.firestore();
  const refUsuario = db.collection("usuarios").doc(request.auth.uid);
  const refConfig = db.collection("config").doc("global");

  try {
    return await db.runTransaction(async (t) => {
      const snapUsuario = await t.get(refUsuario);
      if (!snapUsuario.exists) throw new HttpsError("failed-precondition", "Primero hay que guardar los datos");
      const u = snapUsuario.data() || {};

      if (u.tipo !== "conductor") return { creditos: 0, motivo: "no_es_conductor" };

      // SOLO UNA VEZ EN LA VIDA. Y el candado NO es "¿tiene saldo?" sino
      // "¿existe el campo?" — la diferencia es la que evita un agujero de plata
      // infinita, y la encontró la segunda opinión del 24-ago-2026:
      //
      // Dentro de la app, mirar el saldo bastaba porque aquí solo se llegaba
      // desde el alta. Pero esto ahora es una PUERTA ABIERTA: cualquier
      // conductor con sesión la llama cuando quiera. Y su saldo llega a cero
      // solo, gastando comisiones. Con el candado del saldo, bastaba con
      // gastarlo todo y volver a pedir el regalo. Otra vez. Y otra. Peor aún:
      // como esto ESCRIBE el monto (no lo suma), a un conductor endeudado le
      // habría borrado la deuda de paso.
      //
      // El campo, en cambio, no se borra nunca: quien lo tiene —aunque valga 0
      // o esté en negativo— ya pasó por aquí y no vuelve a cobrar.
      //
      // Medido el 24-ago-2026 en los datos vivos: de 10 fichas, 8 tienen el
      // campo y las 2 que no lo tienen NO son conductores. O sea: ni un solo
      // conductor de hoy puede reclamarlo, y no hace falta migrar nada.
      if (u.creditos !== undefined && u.creditos !== null) {
        return { creditos: 0, motivo: "ya_recibida" };
      }

      const snapCfg = await t.get(refConfig);
      const cfg = snapCfg.exists ? snapCfg.data() : {};
      const monto = u.tipoVehiculo === "Mototaxi"
        ? (cfg.incentivoNuevoMototaxi ?? 10000)
        : (cfg.incentivoNuevoTaxi ?? 20000);
      if (monto <= 0) return { creditos: 0, motivo: "sin_incentivo" };

      t.set(refUsuario, { creditos: monto }, { merge: true });
      return { creditos: monto };
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("Error creditosDeBienvenida:", e.message);
    throw new HttpsError("internal", "No se pudieron dar los créditos de bienvenida");
  }
});
