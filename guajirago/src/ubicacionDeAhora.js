/**
 * «DAME MI UBICACIÓN DE AHORA» — LA DE LOS DOS BOTONES DE EMERGENCIA
 *
 * Una sola función para los dos sitios desde donde el pasajero le manda su
 * ubicación a su contacto de confianza:
 *   · el «compartir» de Ajustes → Seguridad (`Seguridad.js`, `compartirUbicacion`);
 *   · el 🚨 rojo del mapa durante el viaje (`Solicitar.js`, `compartirSeguridad`).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ EXISTE (27-sep-2026, gemelo G05 de la auditoría)
 * ════════════════════════════════════════════════════════════════════════════
 * Hasta hoy cada botón conseguía la ubicación a su manera, y los dos mandaban
 * una ubicación VIEJA:
 *   · el del mapa mandaba la que la pantalla tomó AL ABRIRSE —normalmente el
 *     sitio donde recogieron al pasajero—, porque no hay seguimiento continuo.
 *     Si se aprieta a los 20 minutos, el familiar recibe el punto de recogida
 *     como «Mi ubicación», con enlace de mapa y todo, y va a buscarlo allí;
 *   · el de Ajustes la pedía una sola vez al abrir la pantalla, con poca
 *     precisión (`enableHighAccuracy: false`) y sin segundo intento.
 * Ahora los dos la piden AQUÍ, en el momento del toque.
 *
 * ── EL TOPE: el mensaje NO espera más de 4 segundos ─────────────────────────
 * En una emergencia, un mensaje que no sale es peor que uno con la ubicación de
 * hace un rato. Así que, pase lo que pase con el GPS, a los `TOPE_UBICACION_MS`
 * se contesta con lo mejor que haya. ¿Por qué 4 y no más?
 *   · porque la persona está esperando con el dedo en el botón;
 *   · y porque los navegadores solo dejan abrir otra ventana (WhatsApp) durante
 *     unos 5 segundos después del toque. Esperar más puede hacer que el
 *     navegador BLOQUEE la apertura de WhatsApp — el peor resultado posible.
 *
 * ── EL ORDEN DE LOS INTENTOS: la regla del respaldo del GPS ─────────────────
 * No se inventa una regla nueva: se cumple la que ya juzga a las otras dos
 * pantallas (`elRespaldoDelGps`, en `pruebas/cargar.cjs`). Primero el punto
 * BUENO (satélite), y si no llega, el que SIEMPRE contesta (wifi y antenas),
 * nunca al revés; los dos aceptan una posición que el aparato YA tiene. Con
 * tiempos cortos porque aquí el tope es de 4 segundos, no de 20: 2,5 s para el
 * bueno y 1,5 s para el de respaldo. Y posiciones guardadas de poco tiempo (5 y
 * 30 segundos): en un carro, un minuto son cientos de metros.
 *
 * ── EL RESPALDO: la última conocida, DICHO como tal ─────────────────────────
 * Si el GPS no contesta a tiempo, se usa lo que cada pantalla sabe, en su orden:
 * `respaldos` es una lista de `{ punto, de }` —el primero con `punto` gana—. El
 * botón del mapa pasa primero dónde va el CARRO (solo en `fase2`, cuando el
 * pasajero va dentro: es la ubicación viva que la pantalla ya escucha), y
 * después la del pasajero de cuando abrió la pantalla. Quien llama pasa `null`
 * en `punto` cuando no la tiene; aquí no se inventa nada.
 *
 * Y el `de` viaja hasta el mensaje (`mensajeEmergencia.js`), que NO dice «Mi
 * ubicación» de algo que no es de ahora: dice «donde va el carro» o «mi última
 * ubicación conocida». Mandar un punto viejo como si fuera el de ahora es la
 * misma mentira que mandar la plaza (ver la cabecera de `mensajeEmergencia.js`).
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 *   · No comprueba que el punto de un respaldo tenga números de verdad: eso ya
 *     lo hace el mensaje (`Number.isFinite`), y escribirlo aquí otra vez sería
 *     una segunda versión de la misma comprobación (SEGUNDA LEY).
 *   · Nunca falla: siempre contesta, aunque sea con `{ punto: null }`. El
 *     mensaje dice entonces que no pudo conseguirla.
 *
 * Sin React y sin más import que otra pieza pura (`pedirGps.js`), para que `pruebas/cargar.cjs` la cargue y la EJECUTE
 * tal cual está en el disco. `navigator` se puede pasar para las pruebas; en la
 * app es el del navegador.
 *
 * Desde G28 (28-sep-2026) los dos intentos y sus tiempos no se escriben aquí:
 * son el juego `emergencia` de `pedirGps.js`, donde viven los de toda la app.
 */
import { pedirGps } from './pedirGps';

export const TOPE_UBICACION_MS = 4000;

/**
 * @param respaldos  lista de `{ punto: {lat, lng} | null, de: 'carro' | 'ultima' }`
 * @param tope       cuánto se espera como mucho, en milisegundos
 * @returns promesa de `{ punto, de }`: `de` es 'ahora' si la dio el GPS en este
 *          momento, el `de` del respaldo usado, o 'ninguna' si no hubo nada
 */
export function ubicacionDeAhora(respaldos = [], tope = TOPE_UBICACION_MS, navigator = (typeof window !== 'undefined' ? window.navigator : undefined)) {
  return new Promise((resolver) => {
    let listo = false;
    let reloj = null;
    const terminar = (punto, de) => {
      if (listo) return;
      listo = true;
      if (reloj) clearTimeout(reloj);
      resolver({ punto, de });
    };
    const respaldo = () => {
      const r = (respaldos || []).find((x) => x && x.punto);
      if (r) terminar(r.punto, r.de);
      else terminar(null, 'ninguna');
    };
    const delAparato = (pos) => terminar({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'ahora');

    reloj = setTimeout(respaldo, tope);
    if (!navigator || !navigator.geolocation) { respaldo(); return; }
    try {
      // Los intentos y sus tiempos, del juego `emergencia` de `pedirGps.js` (G28).
      pedirGps(navigator, 'emergencia', delAparato, respaldo);
    } catch (e) {
      // Un navegador que revienta al pedir el GPS no puede dejar el mensaje sin salir.
      respaldo();
    }
  });
}
