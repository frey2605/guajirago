// ─────────────────────────────────────────────────────────────────────────────
// ¿ESTÁ EN SERVICIO ESTE CONDUCTOR, PARA AVISARLE DE UN VIAJE? — la regla, en UN solo sitio.
//
// La usan el servidor (tokensConductoresCerca, en index.js) y el medidor
// (scripts/medir-ficha-conductor.cjs), así que no pueden decir cosas distintas. La DISTANCIA no vive
// aquí: sigue en distanciaKm de index.js, atada a la de la app por pruebas/amarres.test.js.
//
// Hasta el 27-sep-2026 bastaba con estar «activo». Pero quien cierra la app sin desconectarse se queda
// activo para siempre y le siguen sonando viajes días después (las 8 fichas de producción decían activo
// desde julio). Decisión del dueño (27-sep-2026): sin NINGUNA señal de su celular en 12 horas, no se le
// avisa. En cuanto vuelve a abrir la app y el GPS escribe, entra solo otra vez.
//
// 🔴 Por qué 12 horas y no menos: con el celular bloqueado el navegador duerme la app y el GPS deja de
// escribir, y ese conductor es justo al que el aviso tiene que despertar. Una ventana corta lo dejaría
// sin avisos estando trabajando.
// 🔴 La hora es la del SERVIDOR (cuándo se escribió la ficha por última vez), no la que manda el
// celular: un reloj de teléfono corrido ya cerró un viaje vivo una vez.
// ─────────────────────────────────────────────────────────────────────────────
const HORAS_SIN_SENAL = 12;

/**
 * ¿Por qué NO se le avisa a este conductor? `d` es su ficha, `actualizadaMs` la hora del SERVIDOR de su
 * última escritura (milisegundos) y `ahoraMs` la hora actual. Devuelve el motivo, o null si está en servicio.
 */
function porQueNoSeLeAvisa(d, actualizadaMs, ahoraMs) {
  if (!d || d.activo !== true) return 'no está activo';
  if (!d.fcmToken) return 'sin token de avisos';
  if (typeof actualizadaMs !== 'number' || ahoraMs - actualizadaMs > HORAS_SIN_SENAL * 3600 * 1000) {
    return 'sin señal hace más de ' + HORAS_SIN_SENAL + ' h';
  }
  return null;
}

module.exports = { HORAS_SIN_SENAL, porQueNoSeLeAvisa };
