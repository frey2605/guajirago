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
import { CONFIG_TARIFAS_DEFECTO } from './tarifas';
import { COMISIONES_DEFECTO } from './comisiones';

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
 * G35 (28-sep-2026): CUÁNTOS LUGARES FAVORITOS PUEDE GUARDAR EL PASAJERO — una sola cuenta para la comprobación y los
 * dos textos. Hasta hoy `guardarFavorito` (Solicitar.js) sí leía `config/global.maximoFavoritos`, pero la ventanita
 * «Llegaste al límite» y la pregunta de Ayuda (AyudaSoporte.js) decían siempre «3». Medido ese día: producción tiene 2,
 * así que al que llegaba al tope se le decía «Solo puedes guardar 3 lugares» teniendo 2. Si el número no sirve (no
 * cargó, el panel guardó 0 con la casilla vacía —y con 0 no se podía guardar NINGUNO—, llegó como texto raro) se usa el
 * respaldo de arriba.
 */
export function maximoDeFavoritos(config) {
  const n = Number(config && config.maximoFavoritos);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : CONFIG_COMPARTIDA.maximoFavoritos;
}

/** G35: el mismo número, dicho en palabras para los textos: «1 lugar», «2 lugares». */
export function lugaresFavoritos(config) {
  const n = maximoDeFavoritos(config);
  return n + (n === 1 ? ' lugar' : ' lugares');
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

/**
 * G36 (28-sep-2026): LOS INTERRUPTORES DE MÓDULOS — un solo respaldo. Estaban escritos a mano en App.js
 * (`PantallaModulos`), con `!== false` para los dos primeros y `=== true` para los otros dos, y en el CONFIG_POR_DEFECTO
 * del panel, sin prueba que los atara. Ahora la tabla vive aquí y pruebas/amarres.test.js la compara con la del panel.
 * Transporte y Mensajería se ven si el panel no dice nada; Restaurantes y Turismo solo si el panel los prende.
 */
export const MODULOS_DEFECTO = {
  moduloTransporte: true,
  moduloMensajeria: true,
  moduloRestaurantes: false,
  moduloTurismo: false,
};

/** G36: qué módulos se ven con esta config. Lo que no sea verdadero/falso de verdad cae en el respaldo de arriba. */
export function modulosDe(config) {
  const o = {};
  for (const k of Object.keys(MODULOS_DEFECTO)) {
    const v = config && config[k];
    o[k] = typeof v === 'boolean' ? v : MODULOS_DEFECTO[k];
  }
  return o;
}

/**
 * G36: EL MENSAJE DE MANTENIMIENTO cuando el panel no escribió ninguno. Había TRES versiones: la app decía «Estamos
 * haciendo mejoras. Volvemos muy pronto.», el panel al cargar «…en GuajiraGo. Volvemos muy pronto. ¡Gracias por tu
 * paciencia!» y el panel si fallaba la carga «…en GuajiraGo. Volvemos muy pronto.». Queda la del panel al cargar, que
 * es la que el dueño ve en la cajita y la que producción tiene guardada. El panel no puede importar este archivo (otro
 * repositorio): su copia (MENSAJE_MANTENIMIENTO_DEFECTO en Superadmin.js) la ata pruebas/configGlobal.test.js.
 */
export const MENSAJE_MANTENIMIENTO = 'Estamos haciendo mejoras en GuajiraGo. Volvemos muy pronto. ¡Gracias por tu paciencia!';

/** G36: el mensaje que se enseña: el del panel si trae texto de verdad; si no (falta, vacío, solo espacios), el respaldo. */
export function mensajeDeMantenimiento(config) {
  const m = config && config.mensajeMantenimiento;
  return typeof m === 'string' && m.trim() ? m : MENSAJE_MANTENIMIENTO;
}

/**
 * G36/G66: EL RESPALDO ENTERO de config/global en la app — tarifas (tarifas.js), comisiones (comisiones.js), los números
 * de arriba y los módulos. Antes cada pantalla armaba el suyo (Solicitar sin comisiones, Ganancias solo comisiones,
 * Ayuda solo los números, App.js los módulos a mano); las claves de más son inertes.
 */
export const RESPALDO_CONFIG = {
  ...CONFIG_TARIFAS_DEFECTO,
  ...COMISIONES_DEFECTO,
  ...CONFIG_COMPARTIDA,
  ...MODULOS_DEFECTO,
};

/**
 * G66 (28-sep-2026): LA ÚNICA FORMA DE LEER config/global EN LA APP. Antes cada pantalla (App.js dos veces,
 * AppConductor, Solicitar, Ganancias, AyudaSoporte) hacía su propio getDoc, con su respaldo y su `catch` mudo.
 * Devuelve SIEMPRE una config usable — lo del servidor ENCIMA del respaldo — y dice qué pasó:
 *   · existe: true  → vino del servidor;
 *   · existe: false, error: null → el documento no existe (manda el respaldo);
 *   · existe: false, error: <el fallo> → no se pudo leer; se avisa en la consola y manda el respaldo.
 * Las piezas de Firestore llegan de la pantalla (`{ getDoc, doc, db }`), así este archivo sigue siendo puro y se prueba
 * ejecutándolo.
 */
export function leerConfig({ getDoc, doc, db }) {
  return Promise.resolve()
    .then(() => getDoc(doc(db, 'config', 'global')))
    .then((snap) => (snap.exists()
      ? { config: { ...RESPALDO_CONFIG, ...snap.data() }, existe: true, error: null }
      : { config: { ...RESPALDO_CONFIG }, existe: false, error: null }))
    .catch((e) => {
      console.warn('config/global no cargó; se usa el respaldo de configApp.js:', (e && (e.code || e.message)) || e);
      return { config: { ...RESPALDO_CONFIG }, existe: false, error: e || new Error('fallo sin detalle') };
    });
}
