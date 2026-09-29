/**
 * LOS ESTADOS VIVOS DEL VIAJE, EN EL SERVIDOR — gemelo G55 (29-sep-2026)
 *
 * La fuente es `guajirago/src/estadosViaje.js` (la app). Las funciones son otro paquete npm con su propio
 * `node_modules` y no pueden importar ese archivo, así que aquí vive UNA copia, y `pruebas/estadosAMano.test.js` la
 * ata a la de la app: si una de las dos cambia sola, la tanda se pone roja.
 *
 * Antes del G55 `index.js` y `viajesColgados.cjs` escribían `"esperando"` y `"aceptado"` a mano en seis sitios
 * (avisar del viaje nuevo y de la oferta subida, confirmar al conductor, la rutina de colgados), y nada los comparaba
 * con la app. Ahora esas comparaciones salen de aquí, y la misma prueba prohíbe volver a escribirlos a mano.
 *
 * SI HAY QUE CAMBIAR UN ESTADO: se cambia en `guajirago/src/estadosViaje.js` Y aquí (y en `firestore.rules`, función
 * `enElMercado()`, para el mercado). La prueba no deja hacerlo a medias.
 */

// Buscando conductor (el «mercado»). Mismo contenido que ESTADOS_MERCADO de la app.
const ESTADOS_MERCADO = ['esperando'];

// Ya tiene conductor. Mismo valor que ESTADO_ACEPTADO de la app.
const ESTADO_ACEPTADO = 'aceptado';

// Vivos: los del mercado más el aceptado. Se DERIVA, igual que en la app.
const ESTADOS_EN_CURSO = [...ESTADOS_MERCADO, ESTADO_ACEPTADO];

module.exports = { ESTADOS_MERCADO, ESTADO_ACEPTADO, ESTADOS_EN_CURSO };
