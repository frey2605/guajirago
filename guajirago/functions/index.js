const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

// EL CUARTO DE ATRÁS DE CADA NEGOCIO.
//
// El token de avisos del dueño vive AQUÍ, y no en restaurantes/{id}, que es el
// escaparate que se descarga cualquier cliente de la app.
//
// Este nombre está escrito en TRES sitios del proyecto, y ninguno puede importar
// a los otros:
//   · guajirago-aliados/src/negocioPrivado.js  ← EL BUENO, la fuente única
//   · firestore.rules                          ← match /negociosPrivado/
//   · aquí                                     ← otro repo y otro runtime
// Los ata pruebas/amarres.test.js, que lee los tres y se pone rojo si dejan de
// decir lo mismo.
//
// Ese amarre importa más de lo que parece. Si los dos nombres se separan, aquí no
// falla NADA: se busca el token en una colección que no existe, no se encuentra, y
// la función se va sin mandar el aviso. El dueño dejaría de enterarse de sus
// pedidos sin un solo error en ningún registro.
const NEGOCIO_PRIVADO = "negociosPrivado";

// La decisión de qué hacerle a cada cliente vive aparte y pura, para poder
// probarla sin base de datos (ver cobros.cjs).
const { queHacerCon, loQueSeEscribe, hoyEnColombia } = require('./cobros.cjs');
const { esFecha } = require('./suscripcion.js');

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
    const restSnap = await admin.firestore().collection(NEGOCIO_PRIVADO).doc(restauranteId).get();
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
    const agSnap = await admin.firestore().collection(NEGOCIO_PRIVADO).doc(agenciaId).get();
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

      // ── EL CÓDIGO ANULADO NO SE COBRA (6-sep-2026) ──────────────────────────
      // El panel escribe `anulado: true` (Codigos.js, botón de anular) y esa
      // palabra NO llegaba hasta aquí: esta función se fiaba de `usado` y de nada
      // más. O sea que anular solo cambiaba cómo se veía la lista en la pantalla
      // del dueño; el código se seguía cobrando igual.
      // MEDIDO contra la nube el 6-sep-2026: GGO-CHSGYH, $50.000, Nequi, anulado
      // el 29-jun y SIN USAR. El servidor se lo habría entregado a quien lo
      // escribiera.
      if (datos.anulado === true) {
        throw new HttpsError("failed-precondition", "Ese código fue anulado. Pide uno nuevo");
      }

      // ── Y ES DE QUIEN ES ────────────────────────────────────────────────────
      // El panel ATA cada código a un conductor: exige su documento, lo busca y
      // guarda `conductorId`. Aquí se le acreditaba el saldo A QUIEN LLAMARA, sin
      // comparar nunca los dos. Un código que llegara a otras manos —reenviado,
      // pasado por WhatsApp, leído por encima del hombro— lo cobraba el otro, y
      // el que hizo la transferencia se quedaba sin su recarga.
      //
      // SOLO MUERDE SI EL CÓDIGO TRAE DUEÑO, y eso no es pereza: MEDIDO el
      // 6-sep-2026, de los 3 códigos cobrables DOS son viejos y no lo traen
      // (GGO-4PZKAT por $50.000, y GGO-CHSGYH que ya cae por anulado arriba).
      // Exigirlo a secas habría dejado sin cobrar una recarga que alguien pagó.
      // Los que nacen hoy lo traen SIEMPRE: el panel no deja crear uno sin el
      // documento del conductor.
      if (datos.conductorId && datos.conductorId !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Ese código es de otro conductor");
      }

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

/**
 * REGLA 7 (parte 2) — CONSUMIR EL DESCUENTO DE UN VIAJE.
 *
 * Lo que hacía el teléfono del conductor (AppConductor.js, hasta el
 * 24-ago-2026), en cuatro pasos sueltos: comparaba el código, marcaba el
 * descuento como consumido, SE ACREDITABA los créditos a sí mismo (el
 * comentario decía «siempre permitido por las reglas», y esa suposición es la
 * que cierra la REGLA 7) y apuntaba el uso de la promoción.
 *
 * Ahora el cobro ocurre aquí, de una pieza: o se marca Y se cobra, o no pasa
 * nada. Quien cobra es el conductor ASIGNADO al viaje, no quien llame.
 *
 * ⚠ LO QUE ESTO **NO** ARREGLA — Y HAY QUE DECIRLO CLARO:
 *
 * 1. El monto sale de `descuentoInfo.descuentoAplicado`, que vive DENTRO del
 *    viaje… y hoy `firestore.rules` deja que cualquiera con sesión escriba
 *    CUALQUIER viaje («allow create, update: if request.auth != null»). O sea:
 *    un conductor puede fabricarse un viaje con el descuento que quiera y
 *    cobrarlo. Esta función pone dos frenos baratos (que el viaje sea suyo y
 *    que no sea su propio pasajero), pero la raíz es la REGLA 9 — los viajes y
 *    pedidos sin dueño — y se cierra allí, no aquí.
 *
 * 2. El código del descuento NO es secreto para el conductor: viaja dentro del
 *    viaje, que él puede leer. Mover la comparación al servidor evita que se
 *    salte el paso, pero no le esconde el número. El patrón bueno ya existe en
 *    el proyecto: el código de seguridad del viaje vive en `viajes/{id}/privado`
 *    justo para eso (REGLAS 5 y 11). Mudar este código ahí es su propio trabajo.
 */
exports.consumirDescuentoViaje = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");
  const { viajeId, codigo } = request.data || {};
  if (!viajeId || !codigo) throw new HttpsError("invalid-argument", "Faltan datos");

  const db = admin.firestore();
  const refViaje = db.collection("viajes").doc(viajeId);
  const refConductor = db.collection("usuarios").doc(request.auth.uid);

  let resultado;
  try {
    resultado = await db.runTransaction(async (t) => {
      const snapViaje = await t.get(refViaje);
      if (!snapViaje.exists) throw new HttpsError("not-found", "Ese viaje no existe");
      const viaje = snapViaje.data() || {};

      // Solo el conductor ASIGNADO. Si no, cualquiera podría cobrar el
      // descuento del viaje de otro.
      if (viaje.conductorId !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Este viaje no es tuyo");
      }
      // Y no puede ser su propio pasajero: sin esto, un conductor se fabrica un
      // viaje donde él es las dos partes y se cobra el descuento que quiera.
      // Medido el 24-ago-2026: de los 20 viajes con descuento, en NINGUNO
      // coinciden pasajero y conductor. (Ojo: esto tapa lo barato, no la raíz —
      // ver la nota de arriba sobre la REGLA 9.)
      if (viaje.pasajeroId === request.auth.uid) {
        throw new HttpsError("permission-denied", "Un viaje no puede ser tuyo por los dos lados");
      }

      const info = viaje.descuentoInfo;
      if (!info) throw new HttpsError("failed-precondition", "Este viaje no tiene descuento");
      if (info.consumido === true) {
        throw new HttpsError("already-exists", "Ese descuento ya se cobró");
      }

      // Mismo trato del código que hacía la app: solo las cifras.
      const guardado = String(info.codigoVerificacion || "").trim().replace(/\D/g, "");
      const escrito = String(codigo).trim().replace(/\D/g, "");
      if (!guardado || guardado !== escrito) {
        throw new HttpsError("permission-denied", "Código incorrecto. Verifícalo con el pasajero");
      }

      const monto = info.descuentoAplicado || 0;

      // Todas las lecturas ANTES de escribir: lo exige la transacción.
      const snapConductor = await t.get(refConductor);
      const saldoActual = snapConductor.exists ? (snapConductor.data().creditos || 0) : 0;

      // El promoId y el pasajeroId salen del viaje, y hoy el viaje lo puede
      // escribir cualquiera (REGLA 9). Un id con una barra dentro revienta la
      // ruta del documento — y si eso pasara aquí, se llevaría por delante el
      // COBRO del conductor. Lo cazó una prueba el 24-ago-2026. Si el id viene
      // raro, no se cuenta el uso, pero el conductor cobra igual.
      const idSano = (v) => typeof v === "string" && v.length > 0 && !v.includes("/");
      let refUso = null; let usosPrevios = 0;
      if (idSano(info.promoId) && idSano(viaje.pasajeroId)) {
        refUso = db.collection("promociones").doc(info.promoId).collection("usos").doc(viaje.pasajeroId);
        const snapUso = await t.get(refUso);
        usosPrevios = snapUso.exists ? (snapUso.data().veces || 0) : 0;
      }

      const fechaUso = new Date().toISOString();

      t.update(refViaje, { "descuentoInfo.consumido": true });
      t.set(refConductor, { creditos: saldoActual + monto }, { merge: true });

      if (refUso) {
        // Este contador es el que hace de verdad el tope por persona: lo lee
        // reclamarPromocion. Cuenta descuentos USADOS, no reclamados.
        t.set(refUso, { veces: usosPrevios + 1, ultimaFecha: fechaUso }, { merge: true });
      }

      return { monto, saldo: saldoActual + monto, promoId: refUso ? info.promoId : null, pasajeroId: viaje.pasajeroId, fechaUso };
    });
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    console.error("Error consumirDescuentoViaje:", e.message);
    throw new HttpsError("internal", "Error al verificar. Intenta de nuevo");
  }

  // La ANALÍTICA del panel va APARTE y no bloquea el cobro — igual que hacía la
  // app, y por una razón que encontró la segunda opinión del 24-ago-2026:
  // 'historialUsos' es una lista que crece dentro del documento de la promoción,
  // y Firestore corta cualquier documento en 1 MB. A unos 120 bytes por apunte,
  // sobre los 8.000 usos ese documento revienta. Si esto viviera dentro de la
  // transacción, a partir de ahí NINGÚN conductor de esa promoción volvería a
  // cobrar — con el pasajero delante. La plata va primero; el informe, después.
  // (La lista sin tope es deuda vieja: guajirago-admin/Promociones.js:228.)
  if (resultado.promoId && resultado.pasajeroId) {
    try {
      const refPromo = db.collection("promociones").doc(resultado.promoId);
      await db.runTransaction(async (t) => {
        const snapPromo = await t.get(refPromo);
        if (!snapPromo.exists) return;
        const promo = snapPromo.data() || {};
        t.update(refPromo, {
          usosTotales: (promo.usosTotales || 0) + 1,
          inversionTotal: (promo.inversionTotal || 0) + resultado.monto,
          historialUsos: [...(promo.historialUsos || []),
            { usuarioId: resultado.pasajeroId, fecha: resultado.fechaUso, valor: resultado.monto }],
        });
      });
    } catch (ePromo) {
      console.error("consumirDescuentoViaje: el cobro SI se hizo, falló solo la analítica:", ePromo.message);
    }
  }

  return { monto: resultado.monto, saldo: resultado.saldo };
});

// ══════════════════════════════════════════════════════════════════════════
// LA RUTINA DE COBROS · cada madrugada, avisa y bloquea sola
//
// El software de aliados se vende. Esta es la ÚNICA parte del sistema que puede
// APAGARLE EL NEGOCIO A UN CLIENTE sin que nadie pulse un botón.
//
// LA DECISIÓN NO ESTÁ AQUÍ, Y LO QUE SE ESCRIBE TAMPOCO: están en ./cobros.cjs,
// en funciones puras que se prueban enteras sin base de datos ni red. Aquí solo
// queda el ir y venir. Es a propósito: hace dos días, un guion de este mismo
// proyecto tenía SIETE mutantes vivos en su plomería porque las pruebas solo
// miraban la decisión. Uno de ellos borraba el documento entero de un negocio.
//
// SE DESPLIEGA POR NOMBRE:
//     firebase deploy --only functions:rutinaDeCobros --project guajirago
// Un despliegue completo de funciones BORRARÍA getTurnCredentials y
// notificarConductorEnPunto, cuyo código ya no existe. Está en las leyes del
// proyecto.
// ══════════════════════════════════════════════════════════════════════════
const FICHAS_POR_NOCHE = 500;

exports.rutinaDeCobros = onSchedule(
  { schedule: "every day 03:30", timeZone: "America/Bogota", timeoutSeconds: 540, memory: "256MiB" },
  async () => {
    const db = admin.firestore();
    const hoy = hoyEnColombia(new Date());
    let tocados = 0; let avisados = 0; const paraRevisar = [];

    const fichas = await db.collection("suscripciones").limit(FICHAS_POR_NOCHE).get();

    // Si se llenó el cupo, hay clientes que NO se miraron esta noche — y, como el
    // orden es siempre el mismo, serían SIEMPRE LOS MISMOS: nunca se les cobraría
    // ni se les bloquearía, y en el registro no se notaría nada raro. Se dice.
    if (fichas.size >= FICHAS_POR_NOCHE) {
      paraRevisar.push({
        negocioId: "(todos)",
        porQue: "se llegó al tope de " + FICHAS_POR_NOCHE + " fichas por noche: hay "
          + "clientes que NO se revisaron. Hay que paginar esta rutina.",
      });
    }

    for (const docu of fichas.docs) {
      const negocioId = docu.id;
      try {
        const ficha = docu.data() || {};
        const negSnap = await db.collection("restaurantes").doc(negocioId).get();
        if (!negSnap.exists) {
          paraRevisar.push({ negocioId, porQue: "tiene ficha de cobro pero el negocio no existe" });
          continue;
        }
        const decision = queHacerCon(ficha, negSnap.data() || {}, hoy);

        // ANTE LA DUDA, NO SE TOCA. A este cliente no se le cambia nada: se
        // apunta para que el dueño lo mire.
        if (decision.hacer === "revisar") {
          paraRevisar.push({ negocioId, porQue: decision.porQue });
          continue;
        }
        if (decision.hacer !== "actualizar") continue;

        // EL AVISO VA ANTES DE ESCRIBIR, a propósito: el sello «ya se le avisó»
        // solo se pone si el mensaje salió de verdad. Al revés, la ficha juraría
        // haber avisado a alguien que nunca recibió nada.
        let avisoQueSalio = false;
        if (decision.avisar && decision.mensaje) {
          const salida = await avisarAlNegocio(negocioId, decision.mensaje);
          avisoQueSalio = salida.salio;
          if (salida.salio) avisados++;
          else {
            // A este cliente se le está contando el plazo SIN poder avisarle.
            // Que no se le apague nunca sin que el dueño lo sepa.
            paraRevisar.push({
              negocioId,
              porQue: "quedó «" + decision.estado + "» y NO se le pudo avisar: " + salida.porQue,
            });
          }
        }

        // El estado va en la ficha Y el interruptor en el negocio. Se escriben
        // JUNTOS: si se quedaran descuadrados, un cliente bloqueado seguiría
        // trabajando, o uno al día se quedaría apagado.
        const escribir = loQueSeEscribe(decision, hoy, avisoQueSalio);
        const lote = db.batch();
        // `merge: true` en las dos: la rutina de cobros toca SU campo y nada más.
        // Sin él, un `set` reemplazaría el documento entero del negocio.
        lote.set(docu.ref, escribir.ficha, { merge: true });
        lote.set(negSnap.ref, escribir.negocio, { merge: true });
        await lote.commit();
        tocados++;
      } catch (e) {
        // Que un cliente falle no puede dejar a los demás sin revisar.
        paraRevisar.push({ negocioId, porQue: "falló al procesarlo: " + (e && e.message) });
      }
    }

    // EN SU PROPIA COLECCIÓN, no en `logs`: `logs` es la bitácora de acciones de
    // PERSONAS que pinta el superadmin, y una fila automática cada noche —sin
    // `accion` ni `detalle`— saldría en blanco y en cien noches echaría de la
    // pantalla las acciones de verdad.
    //
    // El rastro va SIEMPRE, aunque no se haya tocado a nadie: saber que la rutina
    // corrió y no hizo nada vale tanto como saber qué hizo.
    await db.collection("logsCobros").add({
      tipo: "rutinaDeCobros",
      fecha: new Date().toISOString(),
      hoy,
      fichasMiradas: fichas.size,
      tocados,
      avisados,
      paraRevisar,
    });
  },
);

/**
 * LE MANDA EL AVISO AL DUEÑO DEL NEGOCIO.
 * Devuelve `{ salio, porQue }` — nunca lanza. Que no se pueda avisar a uno no
 * puede dejar a los demás sin revisar, pero TAMPOCO puede pasar en silencio: el
 * que lo llama lo apunta para el dueño.
 */
async function avisarAlNegocio(negocioId, mensaje) {
  try {
    const priv = await admin.firestore().collection(NEGOCIO_PRIVADO).doc(negocioId).get();
    const token = priv.exists && priv.data().fcmToken;
    // Aliados es una app web: si el dueño nunca aceptó las notificaciones en su
    // navegador, no hay token. A ese cliente no se le puede avisar por aquí.
    if (!token) return { salio: false, porQue: "no tiene notificaciones activadas" };
    const r = await admin.messaging().sendEachForMulticast({
      tokens: [token],
      notification: { title: mensaje.titulo, body: mensaje.texto },
    });
    // OJO: esto NO lanza con un token caducado, devuelve `failureCount`. Si no se
    // mirara, se contaría como avisado un mensaje que no llegó a ninguna parte.
    if (r && r.failureCount > 0) {
      return { salio: false, porQue: "su teléfono rechazó el aviso (token vencido)" };
    }
    return { salio: true, porQue: "" };
  } catch (e) {
    return { salio: false, porQue: "falló el envío: " + (e && e.message) };
  }
}

// ══════════════════════════════════════════════════════════════════════════
// RECALCULAR EL COBRO DE UN CLIENTE · para la pantalla del panel
//
// La administradora cambia el precio o apunta un pago y quiere ver el estado
// AL MOMENTO, sin esperar a la madrugada.
//
// POR QUÉ ESTO EXISTE Y NO SE CALCULA EN EL PANEL: la SEGUNDA LEY dice que un
// número no se calcula en dos sitios, y que la calculadora buena es la del
// servidor. Si el panel decidiera por su cuenta en qué estado nace un cliente,
// habría DOS calculadoras del mismo proceso y algún día darían respuestas
// distintas — con el dinero de por medio. Esta función usa EXACTAMENTE el mismo
// `queHacerCon` y el mismo `loQueSeEscribe` que la rutina de madrugada.
//
// NO MANDA AVISOS, a propósito. Cambiar un precio no es motivo para despertar a
// nadie. Como tampoco pone el sello de «ya se le avisó», si el cliente queda en
// un estado que hay que avisarle, la rutina de esa noche se lo dirá.
//
// SE DESPLIEGA POR NOMBRE:
//     firebase deploy --only functions:recalcularCobro --project guajirago
// ══════════════════════════════════════════════════════════════════════════
exports.recalcularCobro = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Hay que iniciar sesión");

  const db = admin.firestore();

  // El mismo `esAdmin()` que las reglas: rol `admin` o `superadmin`. Se
  // comprueba AQUÍ porque las funciones corren con el SDK admin y SE SALTAN las
  // reglas de Firestore: lo que no se compruebe en este renglón, no se comprueba.
  const quien = await db.collection("usuarios").doc(request.auth.uid).get();
  const rol = quien.exists ? (quien.data() || {}).rol : "";
  if (rol !== "admin" && rol !== "superadmin") {
    throw new HttpsError("permission-denied", "Esta pantalla es solo para administradores");
  }

  const negocioId = String((request.data || {}).negocioId || "").trim();
  if (!negocioId) throw new HttpsError("invalid-argument", "Falta decir de qué negocio");

  const [fichaSnap, negSnap] = await Promise.all([
    db.collection("suscripciones").doc(negocioId).get(),
    db.collection("restaurantes").doc(negocioId).get(),
  ]);
  if (!fichaSnap.exists) throw new HttpsError("not-found", "Ese cliente no tiene ficha de cobro");
  if (!negSnap.exists) throw new HttpsError("not-found", "Ese negocio no existe");

  const hoy = hoyEnColombia(new Date());
  const ficha = fichaSnap.data() || {};

  // `inicio` es la fecha con la que se cuentan los días de prueba. La pone el
  // SERVIDOR y no el panel: si saliera del reloj del computador de quien abra
  // la pantalla, una hora mal puesta le acortaría o le alargaría la prueba a un
  // cliente. Se pone una sola vez, la primera; después no se toca nunca.
  if (!esFecha(ficha.inicio)) {
    ficha.inicio = hoy;
    await fichaSnap.ref.set({ inicio: hoy }, { merge: true });
  }

  const decision = queHacerCon(ficha, negSnap.data() || {}, hoy);

  // ANTE LA DUDA, NO SE TOCA. Se le devuelve a la pantalla el motivo para que se
  // lo enseñe a la administradora, y no se le cambia nada al cliente.
  if (decision.hacer === "revisar") {
    return { hacer: "revisar", porQue: decision.porQue, hoy };
  }

  if (decision.hacer === "actualizar") {
    // `false`: desde aquí no sale ningún aviso, así que no se sella que se avisó.
    const escribir = loQueSeEscribe(decision, hoy, false);
    const lote = db.batch();
    lote.set(fichaSnap.ref, escribir.ficha, { merge: true });
    lote.set(negSnap.ref, escribir.negocio, { merge: true });
    await lote.commit();
  }

  return {
    hacer: decision.hacer,
    estado: decision.estado,
    interruptor: decision.interruptor,
    porQue: decision.porQue,
    diasPara: decision.diasPara === undefined ? null : decision.diasPara,
    hoy,
  };
});
