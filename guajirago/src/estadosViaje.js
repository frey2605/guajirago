/**
 * LOS ESTADOS DEL MERCADO — UN SOLO SITIO
 *
 * SEGUNDA LEY del proyecto: «La información que se supone deben compartir debe
 * salir de los mismos archivos.»
 *
 * Esta lista dice qué viajes están BUSCANDO CONDUCTOR. Sirve para dos cosas que
 * tienen que decir exactamente lo mismo:
 *
 *   1. La app del conductor la usa para pedir el mercado (AppConductor.js).
 *   2. `firestore.rules` la usa para DEJAR ver esos viajes a cualquier conductor
 *      (REGLA 6: un viaje es de quien viaja, salvo los que buscan taxi).
 *
 * EL PELIGRO SI SE SEPARAN: si mañana se añade un estado a la app y no a las
 * reglas, el conductor pide viajes que las reglas no le dejan ver — y **no sale
 * ningún error**: sale una lista vacía. El mercado se queda mudo y nadie sabe por
 * qué. Al revés es peor todavía: las reglas enseñarían viajes que no tocan.
 *
 * LAS REGLAS DE FIRESTORE NO SON JAVASCRIPT: no pueden importar este archivo. Por
 * eso hay una PRUEBA que lee los dos y falla si dejan de coincidir
 * (pruebas/reglas.test.js). Es el único amarre posible, y es de verdad: si alguien
 * cambia uno solo de los dos, la prueba se pone roja antes de llegar al servidor.
 *
 * SI HAY QUE AÑADIR UN ESTADO: se añade aquí Y en firestore.rules, en la función
 * enElMercado(). La prueba no deja hacerlo a medias.
 */

// ── TRES QUE SE RETIRARON (9 y 12-sep-2026) ────────────────────────────────
// Esta lista tenía CUATRO. `confirmando` y `contraoferta` se quedaron del flujo
// viejo, de antes de que el mercado de ofertas pasara por la función
// `confirmarConductor`: la oferta de un conductor ya no cambia el estado del
// viaje, se guarda en la subcolección `viajes/{id}/contraofertas/{suUid}`.
//
// MEDIDO contra el servidor antes de quitarlos (scripts/medir-estados-muertos.cjs):
//   · NADIE los escribe, en ninguna de las tres apps ni en las funciones.
//   · `confirmando`: cero viajes, nunca.
//   · `contraoferta`: UN viaje parado ahí desde el 2-jul-2026. Se pasó a
//     `expirado` ANTES de quitar el estado, con `scripts/expirar-viaje-atascado.cjs`.
//
// OJO, QUE NO ES LO MISMO: 15 viajes tienen un CAMPO llamado `contraoferta`
// —el monto que ofreció el conductor— y el panel lo usa para calcular lo que se
// cobró. Ese campo NO se toca. Lo que se retira es el ESTADO.
// Y EL TERCERO (12-sep-2026): `en_negociacion`, por lo mismo. Medido con el
// mismo contador: cero escritores y CERO viajes, nunca. La negociación no
// cambia el estado del viaje desde que las ofertas viven en la subcolección
// `contraofertas`: el viaje se queda en `esperando` mientras se negocia.
//
// Queda UN SOLO estado de mercado, y está bien que se vea: «buscando
// conductor» es exactamente una cosa. Si algún día el viaje tiene que marcar
// que está negociando, se añade aquí Y en firestore.rules — la prueba no deja
// hacerlo a medias.
//
// 🔴 Y NO SE PUEDE QUEDAR VACÍA. `AppConductor.js` consulta el mercado con
// `where('estado','in', ESTADOS_MERCADO)`, y Firestore REVIENTA en ejecución
// con una lista vacía («A non-empty array is required for 'in' filters»). Hoy
// el margen es de uno. Lo vigila `pruebas/reglas.test.js`, que exige que las
// dos listas —ésta y la de las reglas— tengan algo dentro.
export const ESTADOS_MERCADO = ['esperando'];

// ═══════════════════════════════════════════════════════════════════════════
// ¿ESTE VIAJE ESTÁ EN CURSO? — y por qué esto vive aquí
// ═══════════════════════════════════════════════════════════════════════════
//  🔴 ESTO SE ESCRIBIÓ POR UN FALLO EN EL BOTÓN DE PÁNICO (11-sep-2026).
//
//  `Seguridad.js` busca el viaje en curso del pasajero para meterle al mensaje
//  de emergencia su RUTA y los DATOS DEL CONDUCTOR. Lo buscaba así:
//
//     ['confirmado','aceptado','recogiendo','en_punto','en_viaje'].includes(v.estado)
//     || ['recogiendo','en_punto','en_viaje'].includes(v.fase)
//
//  La segunda mitad mira la FASE sin comprobar que el viaje esté vivo. Un viaje
//  que se canceló o se expiró MIENTRAS ESTABA EN MARCHA se queda con su fase
//  pegada, así que entra por ahí.
//
//  MEDIDO contra el servidor (`scripts/medir-panico.cjs`): 7 viajes terminados
//  llevan una fase de viaje en marcha, y TRES DE LOS CINCO pasajeros de la base
//  cogían uno de ésos. O sea: aprietas emergencia sin ir en ningún viaje y a tu familia
//  le llega la ruta y la placa de un viaje de julio. Es exactamente lo que avisa
//  `firestore.rules`: «si algo pasa, buscan el carro que no es».
//
//  Y de los cinco estados de aquella lista, solo `aceptado` existía:
//    · `confirmado` — nadie lo escribe en `viajes`. Es un estado de PEDIDOS
//      (`aliados/flujoPedidos.js`), que es otra cosa con el mismo nombre.
//    · `recogiendo` — una fase que vive SOLO en la memoria de la app del
//      conductor (`AppConductor.js:966`): nunca se guarda.
//    · `en_punto` y `en_viaje` son FASES, no estados: en `estado` no caben.

// LAS DOS LISTAS SON BLANCAS A PROPÓSITO, no negras. El fallo de arriba salió de
// dar por activo lo que no estaba en una lista; aquí un estado que nadie conozca
// NO cuenta como en curso. Para el botón de pánico, equivocarse por defecto es
// no mandar datos; equivocarse por exceso es mandar los de otro viaje.
//
// Y SE DERIVA DEL MERCADO, no se copia. Un viaje que está buscando conductor
// está vivo por definición, así que la lista es «los del mercado, más el que ya
// tiene conductor». Escribirla a mano fue lo primero que intenté, y una prueba
// de aquí al lado lo cazó: `en_negociacion` estaba en el mercado y se me quedó
// fuera de esta lista. Derivándola, el día que un estado entre o salga del
// mercado, esto se mueve con él y no hay nada que acordarse de tocar.
// G55 (29-sep-2026): «ya tiene conductor», con nombre propio. Lo usan la pantalla del conductor y, por su copia atada
// (`functions/estadosViaje.cjs`, pruebas/estadosAMano.test.js), el servidor: nadie más lo escribe a mano.
export const ESTADO_ACEPTADO = 'aceptado';
export const ESTADOS_EN_CURSO = [...ESTADOS_MERCADO, ESTADO_ACEPTADO];
export const ESTADOS_TERMINADOS = ['finalizado', 'cancelado', 'cancelado_conductor', 'vencido', 'expirado'];

// ═══════════════════════════════════════════════════════════════════════════
// LOS FINALES QUE PONE EL SERVIDOR, Y LO QUE SE LE DICE A QUIEN IBA EN EL VIAJE — G20 (28-sep-2026)
// ═══════════════════════════════════════════════════════════════════════════
//  La rutina `expirarViajesColgados` (functions/index.js, la decisión en functions/viajesColgados.cjs) cierra los
//  viajes que nadie cerró: `vencido` (nadie lo tomó) o `expirado` (lo tomaron y se quedó a medias), y escribe el
//  porqué en `motivoExpiracion`. Hasta hoy ni el conductor ni el pasajero se enteraban: medido con
//  `scripts/medir-viaje-cerrado.cjs`, 17 casos en que la pantalla seguía en el viaje; en producción el servidor ha
//  cerrado 8 viajes, los 8 con conductor dentro (4 con el pasajero montado).
//
//  Son los dos únicos finales que no escribe NINGUNA de las dos personas del viaje, así que son los que su pantalla
//  tiene que enterarse por sí sola. `pruebas/viajeCerrado.test.js` los ata a lo que de verdad puede devolver
//  `queHacerConElViaje`: si la rutina aprende un final nuevo, la prueba se pone roja.
export const ESTADOS_QUE_CIERRA_EL_SERVIDOR = ['vencido', 'expirado'];

/**
 * LA VENTANITA DEL CIERRE: qué se le dice a quien tenía el viaje abierto cuando el servidor lo cerró.
 *
 * @param viaje  el documento del viaje, tal cual
 * @param quien  'conductor' o 'pasajero' (cambia solo la última frase: qué puede hacer ahora)
 * @returns  `{ icono, titulo, texto }` para `AvisoModal`, o `null` si ese final no lo puso el servidor
 *
 * El porqué sale de `motivoExpiracion`, el campo que ya escribe el servidor (no `razonCancelacion`, que es de las
 * cancelaciones de las personas). Los 8 viajes que hay cerrados son de antes de que el servidor lo escribiera, así
 * que sin él se dice lo que se sabe por el estado, sin inventar minutos.
 */
export function avisoDelCierre(viaje, quien) {
  const v = viaje || {};
  if (!ESTADOS_QUE_CIERRA_EL_SERVIDOR.includes(v.estado)) return null;
  const motivo = typeof v.motivoExpiracion === 'string' ? v.motivoExpiracion.trim() : '';
  const porque = motivo
    ? 'El sistema lo cerró: ' + motivo + '.'
    : (v.estado === 'vencido'
      ? 'Nadie lo tomó a tiempo y el sistema lo cerró.'
      : 'Pasó demasiado tiempo sin que se terminara y el sistema lo cerró.');
  const ahora = quien === 'conductor'
    ? ' Ya quedaste libre para recibir viajes nuevos.'
    : ' Si todavía lo necesitas, pide uno nuevo.';
  return { icono: '⏱️', titulo: 'Este viaje ya se cerró', texto: porque + ahora };
}

/**
 * LA HUELLA DE UN VIAJE — G22 (28-sep-2026): un texto que es igual para dos lecturas del MISMO documento.
 *
 * La pantalla del pasajero (`Solicitar.js`) mira su viaje por dos sitios: el vigilante en vivo y un respaldo que lo
 * vuelve a leer cada 5 s. Los dos reaccionan con la MISMA función (`reaccionarAlViaje`), y el respaldo solo la llama
 * si trae un viaje distinto del último que se vio: o sea, si el vivo se calló. Sin esto repetía cada 5 s lo que el
 * vivo ya había hecho.
 *
 * Las claves se ORDENAN: Firestore no promete devolver los campos en el mismo orden dos veces. Si algo no se puede
 * convertir, la huella sale única: el respaldo reacciona (mejor repetir que quedarse callado).
 */
export function huellaDelViaje(viaje) {
  const ordenado = (v, hondo) => {
    if (hondo > 8) throw new Error('demasiado hondo');
    if (Array.isArray(v)) return v.map((x) => ordenado(x, hondo + 1));
    if (v && typeof v === 'object') {
      if (typeof v.toMillis === 'function') return { ms: v.toMillis() };
      const o = {};
      for (const k of Object.keys(v).sort()) o[k] = ordenado(v[k], hondo + 1);
      return o;
    }
    return v;
  };
  try {
    return JSON.stringify(ordenado(viaje == null ? null : viaje, 0));
  } catch (e) {
    return 'sin-huella-' + Date.now() + '-' + Math.random();
  }
}

/**
 * ¿ME ACEPTARON ESTE VIAJE? — G24 (28-sep-2026): la ÚNICA regla con la que la app del conductor decide que el pasajero
 * le aceptó la oferta.
 *
 * `AppConductor.js` se entera por dos vigilantes: el de la oferta (`agregarViajeEscuchando`, vive 3 min) y el general
 * (todos los viajes del conductor). Cada uno llevaba su regla: el general solo creía los de menos de 10 min contados
 * con el RELOJ DEL TELÉFONO desde `nuevaOferta || fechaSolicitud`, y el servidor deja aceptar hasta 20
 * (`MINUTOS.buscando`). Si el pasajero aceptaba pasados 3 min de la oferta y 10 de la búsqueda, no lo veía NINGUNO,
 * con la comisión ya cobrada. Medido con `scripts/medir-me-aceptaron.cjs`.
 *
 * Aquí no se mira ninguna hora: un viaje `aceptado` vive hasta que lo cierra el servidor (`expirado` a los 60 min sin
 * recoger, y G20 se lo dice al conductor). Lo único que no se vuelve a celebrar es el que ya va `en_viaje`.
 */
export function meAceptaronEsteViaje(viaje, miId) {
  const v = viaje || {};
  return !!miId && v.estado === ESTADO_ACEPTADO && v.conductorId === miId && v.fase !== 'en_viaje';
}

// ═══════════════════════════════════════════════════════════════════════════
// EL HISTORIAL: CÓMO TERMINÓ CADA VIAJE, EN PALABRAS Y CON SU COLOR — G21 (28-sep-2026)
// ═══════════════════════════════════════════════════════════════════════════
//  El historial de viajes está en TRES pantallas: el del conductor (`AppConductor.js`, `HistorialConductor`), el del
//  pasajero (`Home.js`, `Historial`) y el del menú de módulos (`MisViajes.js`, que junta los dos lados). QUÉ viajes
//  salen lo dice `ESTADOS_TERMINADOS`, la lista de arriba; CÓMO se llama cada final y DE QUÉ COLOR sale, esto. Antes
//  cada pantalla lo decidía a mano: la del conductor ya decía cada final en palabras, y las otras dos solo conocían
//  `cancelado` — lo demás salía VERDE «Completado» o ni salía (medido con `scripts/medir-historial-pasajero.cjs`: 40
//  viajes escondidos en el historial del pasajero y 72 en «Mis viajes»).
//
//  Las palabras cambian según QUIÉN MIRA, y solo eso: `cancelado` lo escribe el pasajero al cancelar
//  (`Solicitar.js`, `canceladoPor: 'pasajero'`) y `cancelado_conductor` el conductor (`AppConductor.js`). Así que al
//  pasajero `cancelado` le dice «Lo cancelaste tú» y al conductor «Lo canceló el cliente».
//  (El panel tiene sus propias tablas, en tercera persona y en OTRO repo: `guajirago-admin/src/Viajes.js` y
//  `Mensajeria.js`. No pueden importar esto.)
export const FINAL_EN_PALABRAS = {
  pasajero: {
    cancelado: 'Lo cancelaste tú',
    cancelado_conductor: 'Lo canceló el conductor',
    vencido: 'Nadie lo tomó',
    expirado: 'Quedó sin terminar',
  },
  conductor: {
    cancelado: 'Lo canceló el cliente',
    cancelado_conductor: 'Lo cancelaste tú',
    vencido: 'Nadie lo tomó',
    expirado: 'Quedó sin terminar',
  },
};

/**
 * CÓMO TERMINÓ UN VIAJE, para su tarjeta del historial.
 *
 * @param viaje  el documento del viaje, tal cual
 * @param quien  'pasajero' o 'conductor': quién está mirando (cambia las palabras, no el color)
 * @returns `{ completado, texto, color }`
 *
 * Completado es UNO (`finalizado`): todo lo demás es un final que NO se completó y sale en rojo, con sus palabras. Un
 * estado que no conozca sale en rojo con su nombre crudo, nunca en verde: equivocarse por defecto es no dar por hecho
 * un trabajo que no se hizo.
 */
export function comoTermino(viaje, quien) {
  const estado = (viaje || {}).estado;
  if (estado === 'finalizado') return { completado: true, texto: 'Completado', color: '#2ECC71' };
  const palabras = FINAL_EN_PALABRAS[quien === 'conductor' ? 'conductor' : 'pasajero'];
  return { completado: false, texto: palabras[estado] || String(estado || '—'), color: '#FF4444' };
}

// Las fases que SÍ se guardan en el viaje (`AppConductor.js:980` y `:1006`).
// `recogiendo` no está: no se guarda nunca.
export const FASES_GUARDADAS = ['en_punto', 'en_viaje', 'finalizado'];

// ── LOS QUE SE RETIRARON, para que no vuelvan ──────────────────────────────
//  Ninguno de éstos lo escribía nadie, y ningún viaje estuvo nunca en ellos
//  —medido con `scripts/medir-estados-muertos.cjs`—. Se quedaron del flujo
//  viejo, de antes de que las ofertas pasaran por `confirmarConductor`.
//
//  ESTA LISTA EXISTE PARA QUE UNA PRUEBA PUEDA VIGILARLOS. Un sabotaje del
//  12-sep-2026 cambió `'aceptado'` por `'confirmado'` en la app del conductor
//  —con lo que el conductor deja de reconocer su propio viaje y no le sale
//  nada— y NINGUNA prueba lo vio. Ahora `pruebas/amarres.test.js` compara
//  contra esto.
//
//  🔴 OJO: `confirmado` está muerto como estado de VIAJE y VIVO como estado de
//  PEDIDO (`aliados/flujoPedidos.js`, el paso «Recepcionista recibe»). Dos cosas
//  distintas con el mismo nombre. Esta lista es SOLO de viajes, y la prueba que
//  la usa mira solo pantallas de viajes.
export const ESTADOS_RETIRADOS = ['confirmando', 'contraoferta', 'en_negociacion', 'confirmado'];

/**
 * EL VIAJE EN CURSO DE UN PASAJERO, de entre todos los suyos.
 *
 * @param viajes  los viajes del pasajero, tal cual vienen de Firestore
 * @returns  el viaje en curso, o `null` si no tiene ninguno
 *
 * SE MIRA EL `estado` Y NUNCA LA `fase`. La fase dice en qué punto va un viaje
 * vivo; no dice si está vivo. Eso era el fallo.
 *
 * Y SI TUVIERA VARIOS, se escoge a propósito y no al azar: primero el que YA
 * TIENE CONDUCTOR —que es el que lleva los datos que hacen falta en una
 * emergencia— y de ésos el más reciente. Antes se usaba `.find()`, que coge el
 * primero que aparece en una lista sin ningún orden.
 */
export function elViajeEnCurso(viajes) {
  const enCurso = (viajes || []).filter((v) => v && ESTADOS_EN_CURSO.includes(v.estado));
  // SOLO SE ORDENA POR FECHAS QUE SON TEXTO. Hoy las tres apps guardan las
  // fechas como texto ISO, pero si algún día cae ahí un Timestamp de Firestore,
  // `String(...)` lo volvería «[object Object]» — que ordena POR ENCIMA de
  // cualquier fecha ISO, y ese viaje ganaría siempre. Lo vio la segunda opinión
  // del 11-sep-2026. Una fecha que no es texto se trata como si no estuviera.
  const cuando = (v) => {
    for (const f of [v.fechaAceptacion, v.fechaSolicitud]) {
      if (typeof f === 'string' && f) return f;
    }
    return '';
  };
  const masReciente = (lista) => lista.slice()
    .sort((a, b) => cuando(b).localeCompare(cuando(a)))[0] || null;
  // Con conductor primero: en una emergencia, la placa vale más que la ruta.
  return masReciente(enCurso.filter((v) => v.estado === ESTADO_ACEPTADO))
    || masReciente(enCurso);
}
