// 📅 LOS DÍAS DE LA SEMANA DE UNA PROMOCIÓN — qué número es cada día y cómo se dice (G87, 30-sep-2026).
//
// PIEZA COMPARTIDA. Hay una copia IDÉNTICA en guajirago-aliados/src/diasSemana.js (otro repo, no puede importarla):
// las ata letra por letra pruebas/diasPromocion.test.js del repo raíz. Si cambias una, cambia la otra.
//
// Antes el mapa número → nombre (DOW_TXT) estaba escrito a mano DOS veces: en la app del cliente (Restaurantes.js, la
// tarjeta de la promo) y en aliados (Promociones.js, la lista de promos); y los botones L M M J V S D, una tercera.
//
// `dia` es lo que se GUARDA en el campo `dias` de la promoción: el número de `Date.getDay()` (0 = domingo … 6 = sábado).
// No se cambia, o las promociones ya guardadas cambian de día. `corto` es cómo se dice y `letra` el botón que se toca.
// La lista va de lunes a domingo: así salen los botones. El texto ordena por número, como siempre (domingo primero).

export const DIAS_SEMANA = [
  { dia: 1, corto: 'Lun', letra: 'L' },
  { dia: 2, corto: 'Mar', letra: 'M' },
  { dia: 3, corto: 'Mié', letra: 'M' },
  { dia: 4, corto: 'Jue', letra: 'J' },
  { dia: 5, corto: 'Vie', letra: 'V' },
  { dia: 6, corto: 'Sáb', letra: 'S' },
  { dia: 0, corto: 'Dom', letra: 'D' },
];

// Los días guardados, dichos: [3, 1, 5] → «Lun, Mié, Vie». Un número que no es un día no se nombra.
export function diasTxt(dias) {
  return [...(dias || [])].sort().map((d) => (DIAS_SEMANA.find((x) => String(x.dia) === String(d)) || {}).corto).join(', ');
}
