// G59 (29-sep-2026): LOS DATOS DEL CONDUCTOR QUE LLEVA UN VIAJE, en UNA lista.
//
// Al conductor lo pone en el viaje una sola pieza: `confirmarConductor` (guajirago/functions/index.js), en el
// servidor. Escribe su id, su nombre, su teléfono, su placa, su vehículo, su foto y su color. Las funciones son otro
// paquete y no pueden importar esto, así que ésta es una COPIA ATADA: `pruebas/conductorDelViaje.test.js` ejecuta el
// objeto que escribe el servidor y exige que sus campos `conductor…` sean exactamente estos.
//
// Soltar al conductor (devolver el viaje al mercado sin él) borra ESTA lista, toda. Antes cada sitio borraba la suya a
// mano y ninguno borraba la foto ni el color: medido el 29-sep-2026, 2 de 92 viajes de producción guardan la foto y el
// color de un conductor que ya no está (scripts/medir-conductor-soltado.cjs).
export const CAMPOS_DEL_CONDUCTOR = [
  'conductorId', 'conductorNombre', 'conductorTelefono', 'conductorPlaca', 'conductorVehiculo', 'conductorFoto',
  'conductorColor',
];

// Lo que se escribe para soltarlo: cada campo en null (las reglas dejan poner `conductorId: null` solo a quien va en
// el viaje; ver `conductorIntacto()` en firestore.rules).
export const sinConductor = () => Object.fromEntries(CAMPOS_DEL_CONDUCTOR.map((c) => [c, null]));
