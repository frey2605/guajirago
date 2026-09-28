/**
 * LA COMISIÓN QUE SE LE COBRA AL CONDUCTOR, EN EL SERVIDOR — gemelo G03 (27-sep-2026)
 *
 * ESTA ES LA REGLA QUE MANDA: la usa confirmarConductor, que es quien COBRA. Se cobra según el tipo del VIAJE
 * (`viaje.tipo`), nunca según el vehículo del conductor: un mandado paga la de domicilio aunque lo lleve un
 * mototaxista, y un viaje sin tipo se cobra como taxi.
 *
 * La app del conductor (guajirago/src/comisiones.js) tiene una COPIA, porque la nube no puede importar la de la app
 * (`functions/` es otro paquete que se sube solo, y la app está escrita con import/export). Y el panel
 * (guajirago-admin/src/Superadmin.js, `comisionDe`) tiene la suya. pruebas/amarres.test.js EJECUTA las tres con los
 * mismos casos y se pone roja si dicen distinto (SEGUNDA LEY: una copia que no se puede evitar, se ata).
 *
 * Los números de aquí son el PARACAÍDAS por si config/global no trae la clave; la verdad es config/global.
 */

const COMISIONES_DEFECTO = {
  comisionMototaxi: 300,
  comisionTaxi: 800,
  comisionDomicilio: 1000,
};

/** Cuánto se cobra por un viaje, según SU tipo. */
function comisionSegunTipoDeViaje(tipoViaje, cfg) {
  const c = cfg || {};
  const tipo = tipoViaje || 'Taxi';
  if (tipo === 'Mototaxi') return c.comisionMototaxi ?? COMISIONES_DEFECTO.comisionMototaxi;
  if (tipo === 'Mensajería') return c.comisionDomicilio ?? COMISIONES_DEFECTO.comisionDomicilio;
  return c.comisionTaxi ?? COMISIONES_DEFECTO.comisionTaxi;
}

module.exports = { COMISIONES_DEFECTO, comisionSegunTipoDeViaje };
