/**
 * EL FORMATEADOR DE PESOS, EN EL SERVIDOR — gemelo G13 (28-sep-2026)
 *
 * COPIA de guajirago/src/moneda.js (`cop`), porque la nube no puede importar la de la app (`functions/` es otro
 * paquete que se sube solo, y la app está escrita con import/export). pruebas/tarifaTexto.test.js EJECUTA las dos
 * con los mismos números y se pone roja si escriben distinto (SEGUNDA LEY: una copia que no se puede evitar, se ata).
 *
 * La usa confirmarConductor para escribir el TEXTO del precio del viaje (`tarifa`) a partir del NÚMERO aceptado,
 * en vez de copiar el texto que armó el teléfono del conductor con el idioma de ese teléfono.
 */
const cop = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

module.exports = { cop };
