/**
 * LOS TEXTOS DEL VIAJE — UN SOLO SITIO
 *
 * SEGUNDA LEY: «Si dos pantallas necesitan la misma lista, salen del mismo
 * archivo.» Las respuestas rápidas del chat y las razones de cancelación del
 * pasajero estaban copiadas en las dos pantallas de pedir; las del conductor
 * viven con ellas porque son el mismo proceso visto del otro lado.
 *
 * OJO: la razón elegida se GUARDA en el viaje (razonCancelacion) y el panel de
 * administración la enseña tal cual. Cambiar un texto aquí cambia lo que el
 * dueño verá en los viajes nuevos; los viejos conservan el texto con que se
 * cancelaron.
 */

/** Respuestas de un toque en el chat del pasajero con su conductor. */
export const RESPUESTAS_RAPIDAS = [
  '🏃 Ya voy saliendo',
  '⏳ Dame un momento',
  '👀 No te veo, ¿dónde estás?',
  '📍 Estoy en la entrada',
  '✅ Ya estoy afuera',
];

/** Por qué cancela un pasajero. La elegida queda escrita en el viaje. */
export const RAZONES_CANCELACION_PASAJERO = [
  'Me equivoqué de dirección',
  'El conductor tarda mucho',
  'Conseguí otro transporte',
  'Emergencia personal',
  'Otro motivo',
];

/** Por qué cancela un conductor. La elegida queda escrita en el viaje. */
export const RAZONES_CANCELACION_CONDUCTOR = [
  'El pasajero no aparece',
  'Dirección incorrecta o no la encuentro',
  'El pasajero solicitó algo diferente',
  'Problema con el vehículo',
  'Otro motivo',
];
