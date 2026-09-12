/**
 * EL MENSAJE DE EMERGENCIA — LOS DOS BOTONES, armado sin tocar la red
 *
 * Recibe lo que se pudo conseguir y devuelve el texto que se le manda al
 * contacto de confianza. Nada más: ni pide permisos, ni habla con la base.
 *
 * ── LOS DOS BOTONES QUE PASAN POR AQUÍ ──────────────────────────────────────
 *   · `desde: 'ajustes'` — el «compartir mi ubicación» de la pantalla de
 *     Seguridad. PREVENTIVO: se usa antes de que pase nada.
 *   · `desde: 'enViaje'` — el 🚨 rojo que flota sobre el mapa DURANTE el viaje
 *     (`compartirSeguridad`, en `Solicitar.js`). **Es el que de verdad se
 *     aprieta**: 76 de los 91 viajes llegaron a tenerlo en pantalla.
 *
 * Hasta el 12-sep-2026 el del mapa armaba SU PROPIO texto a mano dentro del
 * componente, sin una sola prueba, y los dos ya se habían separado: el de
 * Ajustes comprobaba que hubiera conductor y avisaba de lo que le faltaba, y el
 * del mapa no. Se juntaron ese día, con lo único que de verdad cambiaba —el
 * encabezado— como dato. Eso es la SEGUNDA LEY: un proceso, un archivo.
 *
 * 🔴 Y OJO AL NOMBRE, QUE LO TUVE MAL UN DÍA ENTERO: llamé «el botón de pánico»
 * al de AJUSTES, y ése fue el motivo de que el del mapa no se viera. Lo cazó la
 * segunda opinión.
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
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 Y LO SEGUNDO (12-sep-2026) · EL MENSAJE DEL MAPA MENTÍA
 * ════════════════════════════════════════════════════════════════════════════
 * El botón 🚨 del mapa armaba su propio texto a mano dentro de `Solicitar.js`.
 * Ese texto no se callaba cuando no tenía la ubicación: DECÍA OTRA COSA.
 *
 * La pantalla del pasajero arranca con el centro de Riohacha metido en
 * `ubicacionPasajero` —y si el GPS falla dos veces lo vuelve a poner a
 * propósito—, porque para DIBUJAR EL MAPA eso está bien: mejor el pueblo que
 * una pantalla en blanco. El problema era que el botón de emergencia no podía
 * distinguir ese relleno de un GPS de verdad, y mandaba:
 *
 *     📍 *Mi ubicación:* https://maps.google.com/?q=11.5444,-72.9072
 *
 * O sea la plaza de Riohacha, con la misma seguridad que si fuera cierto. Y el
 * GPS se intenta UNA SOLA VEZ al abrir: si falló ahí, se quedaba mintiendo toda
 * la sesión. Medido en la base: 4 de los 91 viajes nacieron con ese relleno.
 *
 * UN SILENCIO Y UNA MENTIRA NO SON LO MISMO. Con un silencio, quien recibe el
 * mensaje sabe que no sabe. Con esto, se iba a la plaza a buscar a alguien que
 * podía estar en cualquier otro sitio. Por eso `ubicacion` solo se pasa cuando
 * es de verdad, y aquí el `else` dice que no se pudo — lo mismo que ya hacía el
 * de Ajustes al lado.
 *
 * ── POR QUÉ NO VA A LA BANDEJA DE RECHAZOS ──────────────────────────────────
 * Decisión del dueño, 12-sep-2026. La REGLA 9 tiene dos mitades —que el
 * afectado se entere, y que quede escrito para el panel— y aquí se hace solo la
 * primera, a propósito: en una emergencia, escribir en la base puede fallar por
 * lo mismo que falló la consulta, y además retrasaría la apertura de WhatsApp.
 * El que necesita saberlo es el familiar, y se entera al instante.
 */

/**
 * LOS DOS ENCABEZADOS · lo ÚNICO que de verdad cambia entre los dos botones.
 *
 * Aparte, para que las pruebas puedan exigirlos tal cual, y juntos, para que se
 * vea de un golpe que el resto del mensaje es el mismo.
 *
 *   · `ajustes` — el «compartir mi ubicación» de la pantalla de Seguridad. Se
 *     usa ANTES de que pase nada, de forma preventiva.
 *   · `enViaje` — el 🚨 rojo que flota sobre el mapa DURANTE el viaje. Éste es
 *     el que se aprieta cuando algo está pasando de verdad, y por eso su
 *     primera línea dice EMERGENCIA.
 *
 * El texto de `enViaje` es EL MISMO que tenía `Solicitar.js` escrito a mano: no
 * se le cambió ni una letra al juntarlos.
 */
export const ENCABEZADOS = {
  ajustes: '🚨 *Estoy usando GuajiraGo* y quiero que sepas dónde estoy.',
  enViaje: '🚨 *EMERGENCIA - Estoy en un viaje de GuajiraGo*',
};

/**
 * Arma el mensaje de emergencia. LOS DOS BOTONES PASAN POR AQUÍ.
 *
 * SE RECIBE UN OBJETO, NO CUATRO DATOS EN FILA, y eso no es estilo: los datos
 * en fila fue exactamente cómo se colaron dos roturas gordas. Con
 * `armar(ubicacion, viaje, fallo)` la segunda opinión cambió el del medio por
 * `null` y el mensaje perdió la ruta, la placa, el nombre y el teléfono —toda
 * la ficha del carro— con todas las pruebas en verde. Con nombres, cada dato
 * dice lo que es y el amarre puede vigilarlos uno por uno.
 *
 * @param desde      de qué botón viene: `'ajustes'` o `'enViaje'` (ver arriba)
 * @param ubicacion  `{lat, lng}` DE VERDAD, o null si no se pudo conseguir.
 *                   🔴 OJO: null también cuando lo que hay es un RELLENO. Ver
 *                   la nota de abajo, que es lo que vino a cerrar este cambio.
 * @param viaje      el viaje, o null si no hay ninguno
 * @param fallo      QUÉ NO SE PUDO COMPROBAR, o null si todo fue bien.
 *                   `'viaje'` = no se pudieron conseguir los datos del viaje.
 *                   OJO a la diferencia con `viaje: null`, que significa «se
 *                   comprobó y no hay ninguno». Son dos cosas distintas y el
 *                   mensaje las dice distinto: ésa es la razón de este archivo.
 * @returns  el texto, listo para mandar
 */
export function armarMensajeDeEmergencia({ desde, ubicacion, viaje, fallo }) {
  // Si el nombre del botón llega mal, se usa el de EMERGENCIA. Se tira hacia el
  // lado urgente a propósito: un encabezado más alarmante de lo que toca es un
  // susto; quedarse sin mensaje en una emergencia es otra cosa. Que los dos
  // sitios pasen un nombre bueno lo vigila un amarre, no el usuario.
  let texto = ENCABEZADOS[desde] || ENCABEZADOS.enViaje;

  // ── LA UBICACIÓN ─────────────────────────────────────────────────────────
  // `Number.isFinite`, NO `typeof === 'number'`. `typeof NaN` es «number», así
  // que un punto a medias —`{lat: NaN, lng: NaN}`, que es lo que sale de un
  // `parseFloat` fallido— pasaba el filtro y mandaba
  // «maps.google.com/?q=NaN,NaN»: un enlace que parece bueno y no lleva a
  // ninguna parte. Lo cazó la segunda opinión del 12-sep-2026. `isFinite`
  // también echa fuera Infinity, y sigue dejando pasar el 0 (que es un sitio
  // de verdad, aunque quede en el golfo de Guinea).
  if (ubicacion && Number.isFinite(ubicacion.lat) && Number.isFinite(ubicacion.lng)) {
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
  //
  // NINGÚN ENCABEZADO SALE VACÍO. Es la decisión del dueño del 11-sep-2026 —«un
  // encabezado “DATOS DEL CONDUCTOR” vacío en un mensaje de emergencia hace
  // dudar de todo el mensaje»— y ahora se aplica a los dos: se arman los
  // renglones primero y el encabezado solo se pone si hay algo debajo. Antes se
  // comprobaba `viaje.conductorId` para el del conductor, pero con un viaje a
  // medias los dos encabezados salían pelados igual. Lo cazó la segunda opinión.
  const bloque = (encabezado, renglones) => {
    const hay = renglones.filter(Boolean);
    return hay.length ? '\n\n' + encabezado + hay.join('') : '';
  };

  if (viaje) {
    texto += bloque('🛣️ *MI RUTA*', [
      viaje.origen && `\n🟢 Origen: ${viaje.origen}`,
      viaje.destino && `\n🔴 Destino: ${viaje.destino}`,
    ]);

    // Y LOS DATOS DEL CONDUCTOR, SOLO SI HAY CONDUCTOR. Si el pasajero todavía
    // está buscando, va la ruta y nada más.
    if (viaje.conductorId) {
      texto += bloque('🚗 *DATOS DEL CONDUCTOR*', [
        viaje.conductorNombre && `\n👤 Nombre: ${viaje.conductorNombre}`,
        viaje.conductorPlaca && `\n🚘 Placa: ${viaje.conductorPlaca}`,
        viaje.conductorColor && `\n🎨 Color: ${viaje.conductorColor}`,
        viaje.conductorVehiculo && `\n🏷️ Vehículo: ${viaje.conductorVehiculo}`,
        viaje.conductorTelefono && `\n📞 Teléfono: ${viaje.conductorTelefono}`,
        viaje.conductorFoto && `\n📸 Foto: ${viaje.conductorFoto}`,
      ]);
    }
  }

  return texto;
}
