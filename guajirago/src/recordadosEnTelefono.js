// G88 (30-sep-2026): LO QUE EL TELÉFONO RECUERDA de lo que pedí o reservé, para «Mis pedidos» (Restaurantes.js) y
// «Mis reservas» (Turismo.js). Antes cada pantalla lo guardaba a su manera: el pedido con tope de 40 y el repetido al
// frente, la reserva sin tope; y si lo guardado no era una lista, «Mis pedidos» se caía y «Mis reservas» se quedaba
// cargando. Ahora es UNA forma, y lo que cambia a propósito tiene nombre: cada lista su CLAVE y su TOPE.
//
// 🔴 Las claves NO se cambian: son las que ya están guardadas en los teléfonos ('misPedidosGuajira' y
// 'misReservasGuajira', una lista JSON de ids, el último primero). Cambiarlas deja a cada cliente sin su historial.
// Lo ya guardado se lee tal cual; no se migra ni se borra nada. Tampoco se limpia al cerrar sesión (como antes): quien
// abra la app con otra cuenta en el mismo teléfono no ve lo ajeno porque las reglas solo le dejan leer lo suyo.

// «Mis pedidos»: los últimos 40 (el tope que ya tenía).
export const MIS_PEDIDOS = { clave: 'misPedidosGuajira', tope: 40 };
// «Mis reservas»: sin tope, como antes (acortarla borraría ids ya guardados en el teléfono).
export const MIS_RESERVAS = { clave: 'misReservasGuajira', tope: null };

// Los ids recordados, el último primero. Siempre una lista de textos: si el teléfono no deja leer o lo guardado no
// se entiende, lista vacía; si la lista trae algo que no es un id, eso se salta. No escribe nada.
export function leerRecordados(lista) {
  try {
    const guardado = JSON.parse(localStorage.getItem(lista.clave));
    return Array.isArray(guardado) ? guardado.filter((id) => typeof id === 'string' && id.length > 0) : [];
  } catch (e) {
    return [];
  }
}

// Apunta un id nuevo al frente (si ya estaba, sube al frente) y recorta al tope de esa lista. Si el teléfono no deja
// guardar, no pasa nada: el pedido o la reserva ya quedó en la nube.
export function recordar(lista, id) {
  try {
    const ids = [id, ...leerRecordados(lista).filter((x) => x !== id)];
    localStorage.setItem(lista.clave, JSON.stringify(lista.tope ? ids.slice(0, lista.tope) : ids));
  } catch (e) {}
}
