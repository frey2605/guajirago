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
