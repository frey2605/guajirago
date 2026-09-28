/**
 * EL SOBRE DE CADA AVISO AL CELULAR, Y QUIÉN LO MANDA — gemelo G32 (28-sep-2026)
 *
 * Hasta hoy, cada función de index.js armaba su aviso a mano —título, cuerpo, sonido, canal de Android, prioridad
 * de iPhone— y lo mandaba por su cuenta: 8 sitios, 7 sobres copiados, y SOLO UNO (el aviso al dueño del negocio
 * de la rutina de cobros) miraba si Google lo había entregado. Los otros siete mandaban y se iban: un token vencido
 * en `sendEachForMulticast` NO lanza error, devuelve `failureCount`, así que nadie se enteraba de que el conductor,
 * el restaurante o el cliente no habían recibido nada.
 *
 * Ahora hay UNA pieza:
 *   · `sobreDelAviso` arma lo que ve el celular. Cada sitio sigue diciendo SU título, SU cuerpo, SU canal y si
 *     despierta a la app en iPhone (`despertar`), exactamente como antes: el careo de pruebas/sobreDelAviso.test.js
 *     comprueba que cada aviso sale IGUAL que salía.
 *   · `sobreSencillo` es el aviso sin sonido ni canal que ya usaba el aviso al dueño del negocio (se deja igual).
 *   · `mandarAviso` lo manda a uno o a varios teléfonos, SIEMPRE mira la respuesta, y la anota en el registro de la
 *     nube: cuántos llegaron, cuántos no y por qué. Los tokens vencidos se NOMBRAN (solo el final, no entero) pero
 *     NO se borran de las fichas: eso es tocar datos y es otra decisión.
 *
 * Todo sale por `sendEachForMulticast`, también cuando es un solo teléfono: Google arma un mensaje por token, igual
 * que `send({ token, ... })`, así que el celular recibe lo mismo. La diferencia es que un fallo ya no se escapa como
 * excepción muda hacia un `catch` que solo decía «Error …»: queda contado y con su código.
 */

// Estos códigos quieren decir «ese teléfono ya no existe para Google»: el token hay que cambiarlo en la ficha.
const TOKEN_VENCIDO = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

/** El aviso completo (con sonido): el que usan viajes, pedidos y reservas. */
function sobreDelAviso(titulo, cuerpo, { canal, despertar } = {}) {
  const aps = { sound: 'default', badge: 1 };
  if (despertar) aps.contentAvailable = true;
  const notificacionAndroid = { sound: 'default' };
  if (canal) notificacionAndroid.channelId = canal;
  return {
    notification: { title: titulo, body: cuerpo },
    android: { priority: 'high', notification: notificacionAndroid },
    apns: { payload: { aps }, headers: { 'apns-priority': '10' } },
  };
}

/** El aviso pelado, solo título y cuerpo: el del dueño del negocio en la rutina de cobros. */
function sobreSencillo(titulo, cuerpo) {
  return { notification: { title: titulo, body: cuerpo } };
}

const finalDelToken = (t) => '…' + String(t).slice(-6);

/**
 * Manda el sobre a uno o varios tokens y DICE qué pasó. Nunca se queda callado:
 *   { total, llegaron, fallaron, vencidos: [tokens], motivos: [códigos] }
 * Si Google revienta del todo (sin red, sin permiso), la excepción sigue su camino: el que llama ya tiene su catch.
 *   `mensajero` → admin.messaging() (se recibe por parámetro para poder probarlo sin nube)
 *   `quien`     → el nombre que sale en el registro (normalmente el de la función)
 */
async function mandarAviso(mensajero, tokens, sobre, quien) {
  const lista = (Array.isArray(tokens) ? tokens : [tokens]).filter((t) => typeof t === 'string' && t);
  const salida = { total: lista.length, llegaron: 0, fallaron: 0, vencidos: [], motivos: [] };
  if (lista.length === 0) {
    console.log('aviso ' + quien + ': no hay a quién mandarlo (0 tokens)');
    return salida;
  }
  const r = await mensajero.sendEachForMulticast({ ...sobre, tokens: lista });
  const respuestas = (r && r.responses) || [];
  salida.llegaron = r && typeof r.successCount === 'number' ? r.successCount : respuestas.filter((x) => x && x.success).length;
  salida.fallaron = r && typeof r.failureCount === 'number' ? r.failureCount : lista.length - salida.llegaron;
  respuestas.forEach((x, i) => {
    if (!x || x.success) return;
    const codigo = (x.error && (x.error.code || x.error.message)) || 'sin código';
    salida.motivos.push(codigo);
    if (TOKEN_VENCIDO.includes(codigo)) salida.vencidos.push(lista[i]);
  });
  if (salida.fallaron === 0) {
    console.log('aviso ' + quien + ': llegó a ' + salida.llegaron + ' de ' + salida.total);
  } else {
    console.warn('aviso ' + quien + ': ' + salida.fallaron + ' de ' + salida.total + ' NO llegaron — '
      + [...new Set(salida.motivos)].join(', ')
      + (salida.vencidos.length ? ' · tokens vencidos (hay que cambiarlos en la ficha): '
        + salida.vencidos.map(finalDelToken).join(', ') : ''));
  }
  return salida;
}

module.exports = { sobreDelAviso, sobreSencillo, mandarAviso, TOKEN_VENCIDO };
