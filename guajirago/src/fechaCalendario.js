/**
 * LA FECHA DE CALENDARIO — UN SOLO SITIO (gemelo G11, 28-sep-2026)
 *
 * Una «fecha de calendario» es un DÍA sin hora, como la guarda un <input type="date">:
 * «2026-10-05». La reserva de turismo la guarda así.
 *
 * SEGUNDA LEY. La pintaban dos pantallas, cada una a su manera, y ya no decían lo mismo:
 *   · el cliente (Turismo.js) la leía como hora local → «lunes, 5 de octubre»;
 *   · la agencia (aliados, ReservasTurismo.js) hacía `new Date('2026-10-05')`, que JavaScript
 *     lee como medianoche de LONDRES (UTC). En Colombia eso son las 7 de la noche del día
 *     ANTERIOR → «dom, 4 de oct». La agencia veía TODAS las reservas un día antes.
 *
 * Aquí el día se arma con año, mes y día en la hora del aparato: `new Date(año, mes - 1, día)`.
 * Así el día que se ve es el que se guardó, en cualquier zona horaria.
 * Si llega algo que no es AAAA-MM-DD, se enseña tal cual (nunca «Invalid Date»).
 * El formato (largo o corto) lo decide cada pantalla con `opciones`, como toLocaleDateString.
 *
 * ALIADOS y EL PANEL SON OTROS REPOSITORIOS y no pueden importar este archivo: tienen su copia
 * IDÉNTICA en guajirago-aliados/src/fechaCalendario.js y guajirago-admin/src/fechaCalendario.js.
 * pruebas/fechaCalendario.test.js ejecuta las tres y exige que sean iguales byte a byte.
 * G16 (28-sep-2026): las fechas de las promociones («Válida hasta» en la app, el rango en el
 * panel) también se pintan con esta pieza; antes salían un día antes, igual que la reserva.
 */
export const fechaDeCalendario = (v, opciones) => {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
  if (!m) return String(v);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Un día que no existe (31 de febrero) se enseña tal cual: new Date lo correría al mes siguiente.
  return isNaN(d) || d.getDate() !== Number(m[3]) ? String(v) : d.toLocaleDateString('es-CO', opciones);
};
