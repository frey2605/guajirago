/**
 * «PÍDELE LA UBICACIÓN AL TELÉFONO» — UNA SOLA PIEZA PARA TODA LA APP
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EXISTE (28-sep-2026, gemelo G28 de la auditoría)
 * ════════════════════════════════════════════════════════════════════════════
 * Pedir el GPS estaba escrito SEIS veces, cada una con sus tiempos a mano:
 *   · la pantalla del pasajero al abrir (`Solicitar.js`),
 *   · su botón «📍 Usar mi ubicación» (`Solicitar.js`, `MapaRecogida`),
 *   · el conductor al entrar en turno y su seguimiento continuo (`AppConductor.js`),
 *   · el botón de la dirección del pedido (`Restaurantes.js`),
 *   · y «dame mi ubicación de ahora» de los botones de emergencia (`ubicacionDeAhora.js`).
 * Cinco juegos de tiempos distintos en seis sitios. Y el seguimiento del
 * conductor tenía un fallo de verdad: cada vez que el satélite fallaba, abría
 * OTRO seguimiento de respaldo sin cerrar el anterior, y al salir del turno solo
 * cerraba el último. Los que quedaban sueltos seguían escribiendo la ubicación
 * —con `activo: true`— en la ficha de un conductor que ya se había ido.
 *
 * Ahora los tiempos viven AQUÍ (`GPS`) y los seis sitios piden por aquí.
 *
 * ── LA REGLA DE LOS INTENTOS: no se inventa aquí ────────────────────────────
 * La que juzga es `elRespaldoDelGps`, en `pruebas/cargar.cjs`: primero el punto
 * BUENO (satélite) y, si no llega, el que SIEMPRE contesta (wifi y antenas),
 * nunca al revés; y aceptando una posición que el aparato ya tiene. Esa regla
 * CORRE esta pieza con un teléfono de mentira. Cada juego es una lista de
 * intentos, en orden: si uno falla, se pasa al siguiente.
 *
 * ── LOS JUEGOS ──────────────────────────────────────────────────────────────
 *   · `pantalla`    — abrir una pantalla que necesita saber dónde está la
 *                     persona (el pasajero al pedir, el conductor al entrar en
 *                     turno). Satélite 10 s y, si no, wifi 10 s: nunca más de
 *                     20 s callados (antes del 23-sep eran 28).
 *   · `emergencia`  — los botones de pánico. Todo cabe en el tope de 4 s de
 *                     `ubicacionDeAhora.js`: 2,5 s + 1,5 s, y posiciones
 *                     guardadas de poco tiempo (en un carro, un minuto son
 *                     cientos de metros).
 *   · `boton`       — un botón «usar mi ubicación» que la persona aprieta a
 *                     mano: UN intento de satélite, sin posición guardada, y si
 *                     falla se le DICE (quien llama pone el aviso). Así estaba
 *                     en los dos botones y así se deja (G28 junta, no cambia).
 *   · `seguimiento` — el GPS del conductor mientras trabaja: satélite y, si se
 *                     cae, UN respaldo de wifi al lado (el satélite sigue
 *                     intentándolo por si sale de la casa).
 *
 * Sin imports y sin React: `pruebas/cargar.cjs` la carga y la EJECUTA tal cual
 * está en el disco. `navigator` se pasa siempre como primer argumento —en la
 * app es el del navegador—, y así las pruebas le dan uno de mentira.
 */
export const GPS = {
  pantalla: [
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  ],
  emergencia: [
    { enableHighAccuracy: true, timeout: 2500, maximumAge: 5000 },
    { enableHighAccuracy: false, timeout: 1500, maximumAge: 30000 },
  ],
  boton: [
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  ],
  seguimiento: [
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    { enableHighAccuracy: false, timeout: 20000, maximumAge: 5000 },
  ],
};

/**
 * Una ubicación, una vez: prueba los intentos del juego en orden; al primero
 * que conteste llama a `bien(pos)`, y si fallan todos llama a `mal(error)`.
 * Un juego que no existe revienta aquí, a propósito: callarlo sería pedir el
 * GPS con tiempos inventados.
 */
export function pedirGps(navigator, juego, bien, mal) {
  const intentos = GPS[juego];
  if (!intentos) throw new Error('No existe el juego de GPS «' + juego + '»');
  const intentar = (i) => navigator.geolocation.getCurrentPosition(
    bien,
    (error) => {
      if (i + 1 < intentos.length) intentar(i + 1);
      else if (mal) mal(error);
    },
    intentos[i]
  );
  intentar(0);
}

/**
 * Seguir la ubicación sin parar. Devuelve la función que lo PARA TODO.
 *
 * 🔴 UN SOLO RESPALDO, y se cierra con lo demás. Un seguimiento no se acaba al
 * fallar: el teléfono vuelve a avisar del fallo cada vez que vence el tiempo.
 * Antes, cada aviso abría un seguimiento de respaldo nuevo y el de salir solo
 * cerraba el último. Aquí el respaldo se abre una vez, y `parar` cierra los dos.
 */
export function seguirGps(navigator, juego, bien) {
  const [primero, respaldo] = GPS[juego] || [];
  if (!primero) throw new Error('No existe el juego de GPS «' + juego + '»');
  let principal = null;
  let deRespaldo = null;
  let parado = false;
  try {
    principal = navigator.geolocation.watchPosition(bien, () => {
      if (parado || deRespaldo !== null || !respaldo) return;
      deRespaldo = navigator.geolocation.watchPosition(bien, () => {}, respaldo);
    }, primero);
  } catch (e) {
    // Un navegador que revienta al seguir el GPS no puede tumbar la pantalla del conductor.
  }
  return () => {
    parado = true;
    if (principal !== null) navigator.geolocation.clearWatch(principal);
    if (deRespaldo !== null) navigator.geolocation.clearWatch(deRespaldo);
  };
}
