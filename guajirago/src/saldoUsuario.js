// ─────────────────────────────────────────────────────────────────────────────
// ¿CUÁNTO SALDO TIENE ESTA PERSONA? — una sola respuesta (gemelo G81, 29-sep-2026).
//
// El saldo (los créditos del conductor) lo CALCULA Y GUARDA EL SERVIDOR en la ficha
// `usuarios/{uid}`, campo `creditos`: lo suben el canje de recargas y los regalos, y lo baja
// el cobro de la comisión (functions/index.js). La calculadora buena es la del servidor;
// el teléfono solo lo ENSEÑA, y nunca lo escribe (la regla congela el campo, REGLA 7).
//
// Hasta hoy la app lo sacaba de la ficha escribiendo la misma cuenta a mano en cuatro
// sitios: dos en AppConductor.js (la lectura al entrar y la escucha en tiempo real) y dos
// en Creditos.js (al abrir «Mis créditos» y después de recargar). Cuatro copias de lo mismo:
// el día que una cambie (un Number(), un redondeo), el conductor vería dos saldos distintos
// en dos pantallas.
//
// LA REGLA: `creditos` tal como lo guardó el servidor, y si no hay, 0. Es EXACTAMENTE la
// cuenta que había (`creditos || 0`): no cambia cuánto da, lo demuestra
// scripts/medir-saldo-conductor.cjs corriendo los cuatro sitios de antes y de ahora.
//
// Sin imports a propósito: así las pruebas lo cargan tal cual (pruebas/cargar.cjs).
// ─────────────────────────────────────────────────────────────────────────────

export function saldoDe(ficha) {
  return (ficha && ficha.creditos) || 0;
}
