/**
 * LA COMISIÓN DEL VIAJE — UNA SOLA CALCULADORA
 *
 * SEGUNDA LEY del proyecto: «No se pueden usar dos calculadoras para un mismo
 * proceso.» Hasta el 23-ago-2026 la comisión se calculaba en CUATRO sitios:
 * functions/index.js (que es quien COBRA), AppConductor.js, Ganancias.js y el
 * panel. Y no daban lo mismo:
 *
 *   · Ganancias.js y el panel NO conocían la mensajería: le cobraban la comisión
 *     de taxi ($800) en vez de la de domicilio ($1.000). Doscientos pesos de menos
 *     por cada mandado, en la pantalla del conductor y en la tuya.
 * OJO CON LOS NÚMEROS DE AQUÍ ABAJO: son el PARACAÍDAS, no la verdad. Hoy
 * config/global dice mototaxi $400, y eso es lo que se cobra. Estos valores solo
 * se usan si esa configuración no carga, y valen 300/800/1000 porque es lo que
 * usa el servidor en functions/index.js. Deben coincidir con él SIEMPRE: si no,
 * habría dos verdades otra vez, que es justo lo que esta ley prohíbe.
 *
 * QUIÉN MANDA AHORA:
 *   1º  Lo que el viaje GUARDA que se le cobró (comisionCobrada). Es el número de
 *       verdad, lo escribió el servidor al cobrar, y NO CAMBIA aunque mañana subas
 *       la comisión. Las ganancias de marzo no se recalculan en abril.
 *   2º  Si el viaje no lo trae, se calcula con la config. Medido el 23-ago-2026:
 *       eso solo les pasa a los 91 viajes del 30-jun al 6-jul, que son anteriores a
 *       que existiera la función que cobra.
 *
 * LA FUENTE BUENA DE LOS NÚMEROS ES `config/global` EN LA BASE DE DATOS. Los
 * valores de aquí abajo son solo el paracaídas por si la config no carga, y son
 * los mismos que usa el servidor en functions/index.js. Si cambian allí, cambian
 * aquí — y al revés.
 *
 * OJO: el panel (guajirago-admin) es OTRO repositorio y no puede importar este
 * archivo. Su copia está en Superadmin.js y tiene que decir lo mismo. El único
 * sitio que de verdad comparten las tres apps es `config/global`.
 */

export const COMISIONES_DEFECTO = {
  comisionMototaxi: 300,
  comisionTaxi: 800,
  comisionDomicilio: 1000,
};

/**
 * Cuánto se cobra por un viaje NUEVO, según su tipo.
 * Un mandado (Mensajería) paga la comisión de domicilio aunque lo lleve un mototaxista.
 */
export function comisionSegunTipo(tipoVehiculo, cfg = COMISIONES_DEFECTO, tipoViaje) {
  if (tipoViaje === 'Mensajería') return cfg.comisionDomicilio ?? COMISIONES_DEFECTO.comisionDomicilio;
  return tipoVehiculo === 'Mototaxi'
    ? (cfg.comisionMototaxi ?? COMISIONES_DEFECTO.comisionMototaxi)
    : (cfg.comisionTaxi ?? COMISIONES_DEFECTO.comisionTaxi);
}

/**
 * Cuánto se le cobró a UN VIAJE YA HECHO. Esta es la que hay que usar para
 * contar ganancias: devuelve lo que se cobró de verdad, no lo que se cobraría hoy.
 */
export function comisionDeViaje(viaje, cfg = COMISIONES_DEFECTO) {
  if (viaje && typeof viaje.comisionCobrada === 'number') return viaje.comisionCobrada;
  // Viaje anterior al sistema actual: se calcula, y se calcula BIEN — mirando
  // también si fue un mandado, que es justo lo que se olvidaba antes.
  return comisionSegunTipo(viaje && viaje.tipoVehiculo, cfg, viaje && viaje.tipo);
}
