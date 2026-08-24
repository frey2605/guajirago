/**
 * LA DISTANCIA ENTRE DOS PUNTOS DEL MAPA — LA CALCULADORA DE LA APP
 *
 * SEGUNDA LEY: «No se pueden usar dos calculadoras para un mismo proceso.»
 * Esta cuenta decide algo serio: si un viaje está DENTRO del radio de búsqueda
 * — o sea, qué conductor ve qué viaje y a quién se le avisa.
 *
 * HAY DOS LADOS Y NO PUEDEN COMPARTIR ARCHIVO:
 *   · La app del conductor (AppConductor.js) filtra el mercado con esta cuenta.
 *   · El servidor (guajirago/functions/index.js, distanciaKm) decide a qué
 *     conductores les llega el aviso del viaje nuevo. Las funciones se
 *     despliegan solas con su propia carpeta: no pueden importar este archivo.
 *
 * Por eso el amarre es una PRUEBA (pruebas/amarres.test.js) que EJECUTA las dos
 * copias con los mismos puntos y compara los kilómetros. Si un día dan números
 * distintos, se pone roja. El peligro si divergen es mudo: el conductor vería
 * viajes de los que el servidor nunca le avisó, o al revés — avisos de viajes
 * que su pantalla no le enseña.
 *
 * La fórmula es Haversine: la distancia en línea recta sobre la esfera de la
 * Tierra (radio 6371 km). No son kilómetros de calle, y para decidir "¿está
 * cerca?" no hace falta que lo sean — lo que hace falta es que TODOS la midan
 * igual.
 */

/** Kilómetros en línea recta entre dos coordenadas (fórmula Haversine). */
export function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
