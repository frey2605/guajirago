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

// ── DOS QUE SE RETIRARON (9-sep-2026) ───────────────────────────────────────
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
export const ESTADOS_MERCADO = ['esperando', 'en_negociacion'];

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
//  uno de ésos. O sea: aprietas emergencia sin ir en ningún viaje y a tu familia
//  le llega la ruta y la placa de un viaje de julio. Es exactamente lo que avisa
//  `firestore.rules`: «si algo pasa, buscan el carro que no es».
//
//  Y de los cinco estados de aquella lista, solo `aceptado` existía:
//    · `confirmado` — nadie lo escribe en `viajes`. Es un estado de PEDIDOS
//      (`aliados/flujoPedidos.js`), que es otra cosa con el mismo nombre.
//    · `recogiendo` — una fase que vive SOLO en la memoria de la app del
//      conductor (`AppConductor.js:963`): nunca se guarda.
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
export const ESTADOS_EN_CURSO = [...ESTADOS_MERCADO, 'aceptado'];
export const ESTADOS_TERMINADOS = ['finalizado', 'cancelado', 'cancelado_conductor', 'vencido', 'expirado'];

// Las fases que SÍ se guardan en el viaje (`AppConductor.js:977` y `:1003`).
// `recogiendo` no está: no se guarda nunca.
export const FASES_GUARDADAS = ['en_punto', 'en_viaje', 'finalizado'];

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
  return masReciente(enCurso.filter((v) => v.estado === 'aceptado'))
    || masReciente(enCurso);
}
