/**
 * LOS NÚMEROS DE RESPALDO DE LA APP — UN SOLO SITIO
 *
 * SEGUNDA LEY: «La información que se supone deben compartir debe salir de los
 * mismos archivos.» Estos seis números estaban escritos a mano en Solicitar.js,
 * SolicitarMensajeria.js y (dos de ellos) AppConductor.js.
 *
 * SON EL PARACAÍDAS, NO LA VERDAD. La verdad vive en `config/global` en la base
 * de datos, que el dueño edita desde el panel (Superadmin → configuración), y
 * SIEMPRE gana: cada pantalla hace { ...respaldo, ...loDelServidor }. Estos
 * valores solo se usan si esa carga falla. Medido el 23-ago-2026: el servidor
 * vivo dice incrementoTarifa 500 y maximoFavoritos 2 — distintos del paracaídas
 * a propósito, porque el dueño los cambió desde el panel y eso es lo que manda.
 *
 * EL PANEL TIENE SU PROPIA COPIA (guajirago-admin/src/Superadmin.js,
 * CONFIG_POR_DEFECTO) y no puede importar este archivo: es otro repositorio.
 * Su copia importa MÁS que esta: si config/global no existiera, el panel la
 * ESCRIBE entera como configuración inicial. Por eso hay un amarre en
 * pruebas/amarres.test.js que compara los dos lados, número por número, y se
 * pone rojo si se separan.
 */

export const CONFIG_COMPARTIDA = {
  incrementoTarifa: 1000,     // cuánto sube/baja la oferta con cada toque de +/−
  radioBusquedaInicial: 3,    // km alrededor del pasajero donde se busca primero
  radioBusquedaAmpliado: 7,   // km cuando al minuto nadie ha tomado el viaje
  maximoFavoritos: 3,         // direcciones guardadas por pasajero
  tiempoEsperaConductor: 240, // segundos que el conductor espera al pasajero
  duracionContraoferta: 20,   // segundos de vida de una contraoferta en pantalla
};

/**
 * G26 (28-sep-2026): CUÁNTOS SEGUNDOS ESPERA EL CONDUCTOR AL PASAJERO — una sola cuenta para las DOS pantallas.
 * Hasta hoy el conductor leía `config/global` (`configApp.tiempoEsperaConductor || 240`) y el pasajero tenía un 240
 * fijo: si el dueño cambiaba el tiempo en el panel, el conductor veía un reloj y el pasajero otro. Ahora las dos
 * llaman a esta función con su `configApp`. Si el número no sirve (no cargó, el panel guardó 0 con la casilla vacía,
 * llegó como texto raro) se usa el respaldo de arriba, no un número escrito en la pantalla.
 */
export function segundosDeEspera(config) {
  const n = Number(config && config.tiempoEsperaConductor);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : CONFIG_COMPARTIDA.tiempoEsperaConductor;
}

/**
 * G27 (28-sep-2026): EL PLAZO DE LA BÚSQUEDA DEL CELULAR — un solo sitio para las DOS pantallas.
 * Estaba escrito a mano nueve veces: en `Solicitar.js` el 60000 de ampliar y el 120000 de agotar (dos veces cada uno:
 * al pedir y al «Seguir buscando»), el 120 del reloj (dos), el 240 con que nacía el reloj y el 120 de la barra; y en
 * `AppConductor.js` la ventana de 2 * 60 * 1000 con que el conductor deja de ver una solicitud vieja. Cambiar uno sin
 * los otros dejaba al pasajero buscando con un reloj y al conductor mirando con otro.
 * 🔑 NO es el plazo del SERVIDOR (20 min, `MINUTOS.buscando` en functions/viajesColgados.cjs): ése es la red de
 * seguridad para cuando el celular se apagó, y es distinto A PROPÓSITO.
 */
export const BUSQUEDA = {
  segundosParaAmpliar: 60, // al minuto sin nadie, el radio pasa a `radioBusquedaAmpliado`
  segundos: 120,           // a los 2 min el celular da la búsqueda por agotada y la vence
};

/**
 * G27: LO QUE ESCRIBE EL CELULAR CUANDO SE LE ACABA LA BÚSQUEDA. Antes era `{ estado: 'vencido' }` a secas: el viaje no
 * decía cuándo, quién ni por qué, y no había forma de distinguirlo de uno que cerró el servidor. Ahora deja los MISMOS
 * tres campos que `expirarViajesColgados` (functions/index.js), con `expiradoPor: 'app-pasajero'` en vez de `'sistema'`.
 * La fecha es la del teléfono (como `nuevaOferta`): sirve de rastro, no decide nada.
 */
export function marcaDelVencido(ahoraIso) {
  return {
    estado: 'vencido',
    fechaExpiracion: ahoraIso,
    expiradoPor: 'app-pasajero',
    motivoExpiracion: 'llevaba ' + Math.round(BUSQUEDA.segundos / 60) + ' min buscando conductor y nadie lo tomó',
  };
}
