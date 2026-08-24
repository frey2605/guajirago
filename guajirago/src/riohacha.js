/**
 * LA GEOGRAFÍA DE RIOHACHA — UN SOLO SITIO
 *
 * SEGUNDA LEY: «La información que se supone deben compartir debe salir de los
 * mismos archivos.» Hasta el 23-ago-2026 el centro de la ciudad estaba escrito
 * a mano en CUATRO archivos y el marco del mapa en TRES. Si un día se ajusta
 * uno y no los demás, cada pantalla centra su mapa en un sitio distinto — y no
 * hay error que lo delate.
 *
 * (Queda una quinta copia en Conductor.js, que es un archivo MUERTO: nadie lo
 * importa. No se toca aquí — borrarlo es trabajo aparte, anotado para el dueño.)
 */

/** El centro de Riohacha: donde arranca todo mapa mientras llega el GPS. */
export const centroRiohacha = { lat: 11.5444, lng: -72.9072 };

/**
 * El marco de Riohacha: hasta dónde busca direcciones el autocompletar.
 * Fuera de este rectángulo no se sugiere nada.
 */
export const BOUNDS_RIOHACHA = { north: 11.7, south: 11.3, east: -72.6, west: -73.0 };
