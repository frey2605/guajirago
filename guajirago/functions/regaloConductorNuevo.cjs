/**
 * EL REGALO AL CONDUCTOR NUEVO, EN EL SERVIDOR — gemelo G53 (29-sep-2026)
 *
 * Lo usa creditosDeBienvenida (index.js), que es quien le escribe los créditos al conductor nuevo. La verdad es
 * config/global (`incentivoNuevoMototaxi`, `incentivoNuevoTaxi`), que el dueño edita en el panel; los números de aquí
 * son el PARACAÍDAS por si la config no trae la clave.
 *
 * El panel (guajirago-admin/src/Superadmin.js, CONFIG_POR_DEFECTO) tiene su propia copia de esos dos números y no se
 * pueden importar entre sí (otro repositorio, otro paquete). Hasta hoy el servidor los tenía escritos a mano dentro
 * de index.js (`?? 10000`, `?? 20000`) y ninguna prueba los comparaba con el panel. pruebas/regaloConductorNuevo.test.js
 * EJECUTA esta regla y la del panel y se pone roja si se separan (SEGUNDA LEY: una copia que no se puede evitar, se ata).
 */

const REGALO_CONDUCTOR_DEFECTO = {
  incentivoNuevoMototaxi: 10000,
  incentivoNuevoTaxi: 20000,
};

/** Cuánto se le regala a un conductor nuevo, según el vehículo de SU FICHA: mototaxi el suyo, cualquier otro el de taxi. */
function regaloDelConductorNuevo(tipoVehiculo, cfg) {
  const c = cfg || {};
  return tipoVehiculo === 'Mototaxi'
    ? (c.incentivoNuevoMototaxi ?? REGALO_CONDUCTOR_DEFECTO.incentivoNuevoMototaxi)
    : (c.incentivoNuevoTaxi ?? REGALO_CONDUCTOR_DEFECTO.incentivoNuevoTaxi);
}

module.exports = { REGALO_CONDUCTOR_DEFECTO, regaloDelConductorNuevo };
