/**
 * LA GEOGRAFÍA DE RIOHACHA — UN SOLO SITIO
 *
 * SEGUNDA LEY: «La información que se supone deben compartir debe salir de los
 * mismos archivos.» Hasta el 23-ago-2026 el centro de la ciudad estaba escrito
 * a mano en CUATRO archivos y el marco del mapa en TRES. Si un día se ajusta
 * uno y no los demás, cada pantalla centra su mapa en un sitio distinto — y no
 * hay error que lo delate.
 *
 * (Había una quinta copia en Conductor.js, un archivo muerto que nadie
 * importaba: se borró el 23-ago-2026 con permiso del dueño. Vive en el
 * historial de git por si alguna vez hace falta mirarlo.)
 */

/** El centro de Riohacha: donde arranca todo mapa mientras llega el GPS. */
export const centroRiohacha = { lat: 11.5444, lng: -72.9072 };

/**
 * El marco de Riohacha: hasta dónde busca direcciones el autocompletar.
 * Fuera de este rectángulo no se sugiere nada.
 */
export const BOUNDS_RIOHACHA = { north: 11.7, south: 11.3, east: -72.6, west: -73.0 };

/**
 * El marco de La Guajira (G61 · 29-sep-2026): Riohacha y alrededores. Lo usan las
 * sugerencias de los domicilios y de los perfiles de los negocios, que solo lo toman
 * como PREFERENCIA (se sugiere primero lo de adentro, pero no se prohíbe lo de afuera).
 * Estaba escrito a mano tres veces (Restaurantes.js y los dos perfiles de aliados).
 * Aliados lleva una copia de los DOS marcos (repo aparte, no puede importar este archivo),
 * atada en pruebas/sugerencias.test.js: se cambia AQUÍ y se copia igual.
 */
export const BOUNDS_LA_GUAJIRA = { north: 12.5, south: 10.9, east: -71.1, west: -73.4 };

/**
 * Lo que se le pega a una dirección escrita para que Google la busque AQUÍ y no
 * en otra ciudad (G60 · 29-sep-2026). Estaba escrito a mano cuatro veces, en
 * dos pantallas. Solo lo usa `puntoDeDireccion` (direccionDePunto.js).
 */
export const CIUDAD_PARA_BUSCAR = ', Riohacha, Colombia';
