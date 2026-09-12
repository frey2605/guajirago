/**
 * EL MENSAJE DE SEGURIDAD DE LA PANTALLA DE AJUSTES — armado sin tocar la red
 *
 * 🔴 OJO AL NOMBRE, QUE ME EQUIVOQUÉ. Esto NO es el botón de pánico: es el
 * «compartir mi ubicación» de la pantalla de Seguridad (Ajustes), que se usa
 * ANTES de que pase nada. EL BOTÓN DE PÁNICO DE VERDAD es el 🚨 rojo que flota
 * sobre el mapa mientras vas en el viaje, y arma SU PROPIO mensaje a mano en
 * `Solicitar.js:772` (`compartirSeguridad`). Ése sigue con sus silencios y está
 * anotado como deuda. Lo cazó la segunda opinión del 12-sep-2026.
 *
 * Recibe lo que se pudo conseguir y devuelve el texto que se le manda al
 * contacto de confianza. Nada más: ni pide permisos, ni habla con la base.
 *
 * ── POR QUÉ VIVE APARTE ─────────────────────────────────────────────────────
 * Para poder PROBARLO. Es el mismo trato que `avisoCalificacion.js`: sin imports
 * y sin red —solo texto, nada que dependa de fuera— y por eso
 * `pruebas/cargar.cjs` puede cargarlo y ejecutarlo
 * tal cual está en el disco. Dentro del componente de React no había forma de
 * escribir una prueba que mirara el texto que de verdad sale.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ SE ESCRIBIÓ ESTO (12-sep-2026) · REGLA 9 DEL DUEÑO
 * ════════════════════════════════════════════════════════════════════════════
 * «Nada se rechaza en silencio.»
 *
 * `Seguridad.js` buscaba el viaje en curso dentro de un `try` con el `catch`
 * VACÍO. Si esa consulta fallaba —sin cobertura, reglas que niegan, la sesión
 * caída—, el mensaje de emergencia salía SIN ruta y SIN datos del conductor, y
 * no lo decía.
 *
 * LO GRAVE NO ES QUE FALTE EL DATO. Es que quien recibe el mensaje NO PUEDE
 * DISTINGUIR «no iba en ningún viaje» de «no se pudo comprobar». Para alguien
 * que está buscando a otro alguien, esas dos cosas no se parecen en nada: en la
 * primera no hay carro que buscar; en la segunda puede haberlo y nadie lo sabe.
 *
 * ── Y LA COSTUMBRE YA ESTABA AQUÍ ───────────────────────────────────────────
 * Esta misma función ya hacía lo correcto con la UBICACIÓN: cuando no la
 * conseguía, el mensaje decía «no pude obtener mi ubicación exacta». El viaje
 * era el único que se callaba. Esto no inventa nada: le aplica al viaje la
 * costumbre que ya tenía la ubicación al lado.
 *
 * ── POR QUÉ NO VA A LA BANDEJA DE RECHAZOS ──────────────────────────────────
 * Decisión del dueño, 12-sep-2026. La REGLA 9 tiene dos mitades —que el
 * afectado se entere, y que quede escrito para el panel— y aquí se hace solo la
 * primera, a propósito: en una emergencia, escribir en la base puede fallar por
 * lo mismo que falló la consulta, y además retrasaría la apertura de WhatsApp.
 * El que necesita saberlo es el familiar, y se entera al instante.
 */

/** El encabezado, aparte para que las pruebas puedan exigirlo tal cual. */
export const ENCABEZADO = '🚨 *Estoy usando GuajiraGo* y quiero que sepas dónde estoy.';

/**
 * Arma el mensaje de emergencia.
 *
 * @param ubicacion  `{lat, lng}`, o null si no se pudo conseguir
 * @param viaje      el viaje en curso (de `elViajeEnCurso`), o null si no hay
 * @param fallo      QUÉ NO SE PUDO COMPROBAR, o null si todo fue bien.
 *                   `'viaje'` = la consulta del viaje falló. OJO a la
 *                   diferencia con `viaje: null`, que significa «se comprobó y
 *                   no hay ninguno». Son dos cosas distintas y el mensaje las
 *                   dice distinto: ésa es toda la razón de este archivo.
 * @returns  el texto, listo para mandar
 */
export function armarMensajeDeEmergencia(ubicacion, viaje, fallo) {
  let texto = ENCABEZADO;

  // ── LA UBICACIÓN ─────────────────────────────────────────────────────────
  if (ubicacion && typeof ubicacion.lat === 'number' && typeof ubicacion.lng === 'number') {
    texto += `\n\n📍 *Mi ubicación:* https://maps.google.com/?q=${ubicacion.lat},${ubicacion.lng}`;
  } else {
    texto += '\n\n📍 No pude obtener mi ubicación exacta en este momento.';
  }

  // ── 🔴 EL FALLO, JUSTO DETRÁS DE LA UBICACIÓN ────────────────────────────
  // Primero la ubicación, que es lo que de verdad sirve para encontrar a
  // alguien; y el aviso inmediatamente después, ANTES de la ruta y del
  // conductor. Así lo primero que se lee es dónde está y qué falta por saber.
  if (fallo === 'viaje') {
    texto += '\n\n⚠️ No pude comprobar los datos de mi viaje.'
      + '\nPuede que vaya en uno: llámame para saberlo.';
    return texto;
  }

  // ── LA RUTA Y EL CONDUCTOR ───────────────────────────────────────────────
  if (viaje) {
    texto += '\n\n🛣️ *MI RUTA*';
    if (viaje.origen) texto += `\n🟢 Origen: ${viaje.origen}`;
    if (viaje.destino) texto += `\n🔴 Destino: ${viaje.destino}`;

    // LOS DATOS DEL CONDUCTOR, SOLO SI HAY CONDUCTOR. Si el pasajero todavía
    // está buscando, va la ruta y nada más: un encabezado «DATOS DEL CONDUCTOR»
    // vacío en un mensaje de emergencia hace dudar de todo el mensaje.
    // Lo decidió el dueño el 11-sep-2026.
    if (viaje.conductorId) {
      texto += '\n\n🚗 *DATOS DEL CONDUCTOR*';
      if (viaje.conductorNombre) texto += `\n👤 Nombre: ${viaje.conductorNombre}`;
      if (viaje.conductorPlaca) texto += `\n🚘 Placa: ${viaje.conductorPlaca}`;
      if (viaje.conductorColor) texto += `\n🎨 Color: ${viaje.conductorColor}`;
      if (viaje.conductorVehiculo) texto += `\n🏷️ Vehículo: ${viaje.conductorVehiculo}`;
      if (viaje.conductorTelefono) texto += `\n📞 Teléfono: ${viaje.conductorTelefono}`;
      if (viaje.conductorFoto) texto += `\n📸 Foto: ${viaje.conductorFoto}`;
    }
  }

  return texto;
}
