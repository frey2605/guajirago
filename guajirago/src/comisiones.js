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
 * usa el servidor en functions/comisiones.cjs. Deben coincidir con él SIEMPRE: si no,
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
 * los mismos que usa el servidor en functions/comisiones.cjs. Si cambian allí, cambian
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
 * Cuánto se cobra por un viaje, según el tipo del VIAJE — gemelo G03 (27-sep-2026).
 *
 * La regla que manda es la del servidor (guajirago/functions/comisiones.cjs), que es quien COBRA. Esto es su COPIA,
 * y pruebas/amarres.test.js ejecuta las dos (y la del panel) con los mismos casos. Antes la app decidía con el
 * vehículo del CONDUCTOR: un conductor sin tipo de vehículo ante un mototaxi tenía que tener $800 aunque el servidor
 * le cobraba $400. Un mandado paga la de domicilio aunque lo lleve un mototaxista; un viaje sin tipo, la de taxi.
 */
export function comisionSegunTipoDeViaje(tipoViaje, cfg = COMISIONES_DEFECTO) {
  const c = cfg || {};
  const tipo = tipoViaje || 'Taxi';
  if (tipo === 'Mototaxi') return c.comisionMototaxi ?? COMISIONES_DEFECTO.comisionMototaxi;
  if (tipo === 'Mensajería') return c.comisionDomicilio ?? COMISIONES_DEFECTO.comisionDomicilio;
  return c.comisionTaxi ?? COMISIONES_DEFECTO.comisionTaxi;
}

/**
 * Los tipos de viaje que la lista del conductor le enseña, según su vehículo. Sin vehículo los ve todos; el
 * mototaxista ve además los mandados. (Los viajes sin tipo los ven todos: eso lo decide la lista, no esta función.)
 */
export function tiposDeViajeQueVe(tipoVehiculo) {
  if (!tipoVehiculo) return ['Taxi', 'Mototaxi', 'Mensajería'];
  return tipoVehiculo === 'Mototaxi' ? ['Mototaxi', 'Mensajería'] : [tipoVehiculo];
}

/**
 * El saldo mínimo para prender el interruptor: la comisión más barata de los viajes que puede tomar. Con menos no
 * podría tomar ninguno; con eso, por lo menos uno (y cada viaje vuelve a mirar su propia comisión al aceptarlo).
 */
export function comisionParaActivarse(tipoVehiculo, cfg = COMISIONES_DEFECTO) {
  return Math.min(...tiposDeViajeQueVe(tipoVehiculo).map((t) => comisionSegunTipoDeViaje(t, cfg)));
}

/**
 * Cuánto se le cobró a UN VIAJE YA HECHO. Esta es la que hay que usar para
 * contar ganancias: devuelve lo que se cobró de verdad, no lo que se cobraría hoy.
 */
export function comisionDeViaje(viaje, cfg = COMISIONES_DEFECTO) {
  if (viaje && typeof viaje.comisionCobrada === 'number') return viaje.comisionCobrada;
  // Viaje anterior al sistema actual: se calcula con la MISMA regla del servidor, según el tipo del viaje. Antes se
  // miraba `viaje.tipoVehiculo`, un campo que ningún viaje lleva: los mototaxis se contaban como taxi.
  return comisionSegunTipoDeViaje(viaje && viaje.tipo, cfg);
}

