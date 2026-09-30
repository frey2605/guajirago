// 🎟️ ¿CÓMO SE COBRA UN TOUR? — la unidad del precio y cómo se dice (G86, 30-sep-2026).
//
// PIEZA COMPARTIDA. Hay una copia IDÉNTICA en guajirago-aliados/src/unidadesTour.js (otro repo, no puede
// importarla): las ata letra por letra pruebas/unidadesTour.test.js del repo raíz. Si cambias una, cambia la otra.
//
// Antes esta lista estaba escrita a mano DOS veces: un diccionario en la app del cliente (Turismo.js, la tarjeta del
// tour) y la lista UNIDADES en aliados (Tours.js, el selector y la lista de la agencia). Decían lo mismo; ahora es una.
//
// `k` es lo que se GUARDA en el campo `unidadPrecio` del tour (y se copia a la reserva): no se cambia, o los tours
// ya guardados se quedan sin nombre. `t` es cómo se dice en pantalla. Una unidad que no está aquí no se nombra ('').
// La CUENTA del precio (por persona × personas) vive solo en la app (Turismo.js, totalReserva): aquí no hay pesos.

export const UNIDADES_PRECIO = [
  { k: 'persona', t: 'por persona' },
  { k: 'grupo', t: 'por grupo' },
  { k: 'dia', t: 'por día' },
  { k: 'hora', t: 'por hora' },
];

export function unidadTxt(k) {
  const u = UNIDADES_PRECIO.find((x) => x.k === k);
  return u ? u.t : '';
}
