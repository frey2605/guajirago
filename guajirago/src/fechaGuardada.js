/**
 * LEER UNA FECHA GUARDADA — UN SOLO SITIO (gemelo G48, 29-sep-2026)
 *
 * Una fecha con hora llega de Firestore de DOS maneras, y a veces en el MISMO campo:
 *   · como TEXTO ISO, «2026-09-20T20:00:00.000Z», si la escribió el celular con `new Date().toISOString()`;
 *   · como TIMESTAMP de Firestore, si la escribió el servidor con `serverTimestamp()`.
 * El `creado` de los pedidos es las dos cosas: el domicilio de la app lleva Timestamp y el pedido de mesa de aliados
 * llevaba texto (medido el 29-sep-2026 en producción: 17 Timestamp y 12 texto). Y se leía con SEIS convertidores:
 * `new Date(v)` a pelo en el panel —que con un Timestamp da «Invalid Date», así que «🧾 pedidos hoy» no contaba
 * ningún domicilio—, `.seconds` en «Mis pedidos», comparar texto en Mesero, y tres más en aliados. Y un séptimo, el
 * `diaEnColombia` de las ganancias del conductor (gananciasConductor.js), que ahora también sale de aquí.
 *
 * Aquí se lee UNA vez:
 *   · `msDeFecha(v)`         → milisegundos, o null si no hay fecha o no se puede leer (nunca NaN).
 *                             Entiende texto, Timestamp (el de la librería o uno plano {seconds, nanoseconds}),
 *                             número de milisegundos y Date. Un Timestamp que aún no llega del servidor es null.
 *   · `diaEnColombiaDe(v)`   → el día AAAA-MM-DD en que cae esa fecha EN COLOMBIA, o null.
 *   · `esDeHoyEnColombia(v)` → ¿cae hoy, en Colombia? (con `ahora` opcional, para las pruebas).
 * El día sale de `hoyEnColombia` (reglaPromocion.js), la misma de las promociones y las ganancias: Colombia es
 * UTC−5 todo el año, así que la zona horaria del aparato no cambia nada.
 *
 * ALIADOS y EL PANEL SON OTROS REPOSITORIOS y no pueden importar este archivo: tienen su copia IDÉNTICA en
 * guajirago-aliados/src/fechaGuardada.js y guajirago-admin/src/fechaGuardada.js. pruebas/fechaPedido.test.js
 * ejecuta las tres y exige que sean iguales byte a byte.
 */
import { hoyEnColombia } from './reglaPromocion';

export function msDeFecha(v) {
  if (!v) return null;
  let ms = null;
  if (typeof v === 'string') ms = Date.parse(v);
  else if (typeof v === 'number') ms = v;
  else if (v instanceof Date) ms = v.getTime();
  else if (typeof v.toMillis === 'function') ms = v.toMillis();
  else if (typeof v.seconds === 'number') ms = v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
}

export function diaEnColombiaDe(v) {
  const ms = msDeFecha(v);
  return ms === null ? null : hoyEnColombia(new Date(ms));
}

export function esDeHoyEnColombia(v, ahora) {
  const dia = diaEnColombiaDe(v);
  return dia !== null && dia === hoyEnColombia(ahora);
}
