/**
 * LA DIRECCIÓN DE UN PUNTO DEL MAPA — una sola manera (G30 · 28-sep-2026).
 *
 * Convertir unas coordenadas en su dirección («Calle 15 #10-20, Riohacha…») se
 * hacía en dos sitios, cada uno a su manera: el mapa de recogida del pasajero
 * (`resolverDireccion` en Solicitar.js) y el botón «Usar mi ubicación» del
 * pedido de comida (Restaurantes.js). Los dos le preguntaban a Google por su
 * cuenta y cada uno decidía, sin decirlo, qué era «falló».
 *
 * Aquí se pregunta, y se contesta SIEMPRE una de dos cosas:
 *   · `{ ok: true, direccion }` — Google dio una dirección con texto;
 *   · `{ ok: false, motivo }`   — no la dio, y `motivo` dice por qué: lo que
 *     contestó Google (`ZERO_RESULTS`, `REQUEST_DENIED`…) o `SIN_MAPAS` si
 *     Google no está cargado.
 * Qué hacer con un fallo NO lo decide la pieza: lo decide cada pantalla, porque
 * no es lo mismo (el mapa deja el campo como está; el pedido deja las
 * coordenadas y avisa).
 *
 * Sin imports y sin React: `pruebas/cargar.cjs` la carga y la EJECUTA tal cual.
 * El geocodificador se pasa como argumento —en la app es el de Google, o `null`
 * si no está cargado—, y así las pruebas le dan uno de mentira.
 */
export function direccionDePunto(geocodificador, lat, lng, alTerminar) {
  if (!geocodificador) {
    alTerminar({ ok: false, motivo: 'SIN_MAPAS' });
    return;
  }
  geocodificador.geocode({ location: { lat, lng } }, (results, status) => {
    const direccion = status === 'OK' && results && results[0] && results[0].formatted_address;
    if (direccion) alTerminar({ ok: true, direccion });
    else alTerminar({ ok: false, motivo: status || 'SIN_RESPUESTA' });
  });
}

/** Las coordenadas escritas como texto, para cuando no hay dirección: «11.544210, -72.907110». */
export function textoDeCoordenadas(lat, lng) {
  return lat.toFixed(6) + ', ' + lng.toFixed(6);
}
