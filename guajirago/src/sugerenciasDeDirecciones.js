/**
 * EL CUADRO DE SUGERENCIAS DE DIRECCIONES — UNA SOLA PIEZA (gemelo G61, 29-sep-2026)
 *
 * El cuadro de Google que sugiere direcciones mientras se escribe se armaba a mano en
 * CINCO sitios de dos apps (pedir el viaje, el lugar favorito, la dirección de entrega
 * del domicilio y los dos perfiles de aliados), cada uno con su país, su marco, sus
 * tipos y sus campos, y el marco de La Guajira escrito con números tres veces.
 *
 * Las diferencias entre ellos SON A PROPÓSITO, y por eso viven aquí juntas, en una
 * tabla, y no en cinco copias:
 *   · el TAXI y los FAVORITOS solo sugieren dentro de Riohacha (`soloDentro`): el
 *     servicio es de la ciudad, y lo de afuera no se puede pedir;
 *   · los DOMICILIOS y los NEGOCIOS prefieren La Guajira, pero no prohíben lo de afuera;
 *   · cada pantalla pide a Google solo los campos que usa (los favoritos no dicen
 *     cuáles, así que Google manda todos: se dejó igual, está anotado).
 *
 * Qué hace cada pantalla con la sugerencia escogida lo sigue decidiendo cada pantalla
 * (su propio `place_changed`): eso no es una copia, es su trabajo.
 *
 * Los marcos viven en `riohacha.js`. Aliados lleva una copia byte a byte de este archivo
 * y una de los dos marcos en su `riohacha.js` (repo aparte), atadas en
 * pruebas/sugerencias.test.js: se cambia AQUÍ.
 */
import { BOUNDS_RIOHACHA, BOUNDS_LA_GUAJIRA } from './riohacha';

const TIPOS_DE_LA_CIUDAD = ['establishment', 'geocode'];

/** Cada uso del cuadro, con lo que lo hace distinto. */
export const SUGERENCIAS = {
  viaje: { marco: BOUNDS_RIOHACHA, soloDentro: true, tipos: TIPOS_DE_LA_CIUDAD, campos: ['geometry', 'name', 'formatted_address'] },
  favorito: { marco: BOUNDS_RIOHACHA, soloDentro: true, tipos: TIPOS_DE_LA_CIUDAD, campos: null },
  entrega: { marco: BOUNDS_LA_GUAJIRA, soloDentro: false, tipos: null, campos: ['formatted_address'] },
  negocio: { marco: BOUNDS_LA_GUAJIRA, soloDentro: false, tipos: null, campos: ['formatted_address', 'geometry'] },
};

/** Las opciones que se le dan a Google para un uso. Un uso que no existe revienta: es un error de quien lo pide. */
export function opcionesDeSugerencias(maps, uso) {
  const u = SUGERENCIAS[uso];
  if (!u) throw new Error('sugerenciasDeDirecciones: no conozco el uso «' + uso + '»');
  const m = u.marco;
  const opciones = {
    componentRestrictions: { country: 'co' },
    bounds: new maps.LatLngBounds(new maps.LatLng(m.south, m.west), new maps.LatLng(m.north, m.east)),
  };
  if (u.soloDentro) opciones.strictBounds = true;
  if (u.tipos) opciones.types = u.tipos.slice();
  if (u.campos) opciones.fields = u.campos.slice();
  return opciones;
}

/** Pone el cuadro de sugerencias en un campo y lo devuelve (la pantalla le pone su `place_changed`). */
export function ponerSugerencias(google, input, uso) {
  return new google.maps.places.Autocomplete(input, opcionesDeSugerencias(google.maps, uso));
}
