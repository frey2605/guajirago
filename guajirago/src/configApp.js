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
