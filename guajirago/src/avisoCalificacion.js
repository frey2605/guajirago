// ── UN SOLO SITIO DECIDE QUÉ SE LE DICE AL CLIENTE ─────────────────────────
// REGLA 9 del dueño: «Nada se rechaza en silencio.»
//
// Hasta el 26-ago-2026 los DOS sitios que guardan una calificación se tragaban
// el fallo con un `catch` vacío, y cada uno lo hacía mal a su manera:
//
//   · guajirago/src/Restaurantes.js — las estrellas se quedaban puestas y no
//     pasaba nada. Parecía un botón roto.
//   · guajirago/src/Calificacion.js — PEOR: cerraba la pantalla igual, así que
//     el pasajero se quedaba creyendo que había calificado.
//
// Medido el 26-ago-2026 contra el servidor vivo: 54 ocasiones de calificar han
// existido (22 pedidos entregados + 16 viajes terminados por sus dos lados) y
// ha llegado UNA calificación. De los 16 viajes terminados, CERO calificados —
// ni por el pasajero ni por el conductor. No se puede afirmar que las 53 que
// faltan fallaran: puede que nadie quisiera calificar. Y ese es exactamente el
// problema — no hay forma de saberlo, porque no queda rastro por ningún lado.
//
// SEGUNDA LEY: esto vive en UN archivo y lo usan las dos pantallas. Si el
// motivo se escribiera en cada una, en un mes dirían cosas distintas.
//
// ESTE ARCHIVO ES LA MITAD DEL CLIENTE: que se entere. La otra mitad que pide la
// REGLA 9 —«todo rechazo va a una bandeja con su motivo», o sea un sitio donde el
// DUEÑO los vea— se construyó el 26-ago y vive en guardarRechazo.js, en la
// colección `rechazos` y en la pantalla del panel. Las dos se llaman desde el
// mismo catch: primero se avisa, luego se apunta.
//
// Y los rechazos mudos que quedaban en las otras dos apps también se cerraron ese
// día (aliados/CalificacionesRestaurante.js y admin/ComentariosReportados.js).
// `guajirago/functions/index.js` no toca calificaciones: por ahí no hay nada.

// El texto que ve el cliente. Sale de aquí y de ningún otro sitio.
//
// La `clave` la usa la BANDEJA (guardarRechazo.js): es lo que se guarda para que
// el dueño vea «sin permiso» o «sin internet» en vez de jerga en inglés. Va
// DENTRO de cada motivo a propósito: la alternativa era que alguien clasificara
// otra vez el mismo fallo en otro sitio, y una segunda calculadora del mismo
// número acaba SIEMPRE dando otro resultado (SEGUNDA LEY). Es el mismo nombre y
// los mismos tres valores que en guajirago-aliados/src/avisoRechazo.js, y hay un
// amarre que carea los dos lados.
export const MOTIVOS = {
  permiso: {
    clave: 'permiso',
    titulo: 'No pudimos guardar tu calificación',
    // OJO AL DETALLE: esto decía «puede que ya esté calificado», y era MENTIRA.
    // Lo cazó la segunda opinión leyendo las reglas: el `allow create` de
    // `calificaciones` tiene cinco condiciones y NINGUNA mira si ya se calificó.
    // Por ahí no puede venir nunca un rechazo. Las causas de abajo sí son las
    // que están escritas en las reglas.
    texto: 'El servidor no aceptó esta calificación. Puede que el pedido o el '
      + 'viaje no esté todavía terminado, que no figures como quien lo hizo, o '
      + 'que tu cuenta no pueda calificar a este negocio. Si crees que es una '
      + 'equivocación, escríbenos desde Ayuda y soporte.',
  },
  sinRed: {
    clave: 'sinRed',
    titulo: 'Sin conexión',
    texto: 'No hay internet ahora mismo, así que tu calificación no salió. '
      + 'Vuelve a intentarlo cuando tengas señal.',
  },
  otro: {
    clave: 'otro',
    titulo: 'No pudimos guardar tu calificación',
    texto: 'Algo falló al enviarla y no se guardó. Vuelve a intentarlo; si '
      + 'sigue pasando, escríbenos desde Ayuda y soporte.',
  },
};

/**
 * Convierte el fallo de Firestore en algo que una persona entiende.
 *
 * Se mira `e.code`, no el mensaje: el mensaje cambia entre versiones del SDK y
 * viene en inglés. El código es el contrato.
 *
 * Cualquier cosa que no se reconozca cae en 'otro' A PROPÓSITO: es mejor un
 * aviso genérico que ningún aviso, que es de donde venimos.
 */
export function motivoDeRechazo(e) {
  const codigo = (e && e.code) ? String(e.code) : '';
  if (codigo === 'permission-denied') return MOTIVOS.permiso;
  if (codigo === 'unavailable' || codigo === 'deadline-exceeded') return MOTIVOS.sinRed;
  return MOTIVOS.otro;
}

/**
 * Para la consola del que revisa. NO es la bandeja de la REGLA 9 —es solo un
 * rastro en el navegador— pero sin esto un fallo raro no deja NADA, y ya
 * sabemos cómo acaba eso.
 */
export function apuntarRechazo(donde, e) {
  const codigo = (e && e.code) ? e.code : '(sin código)';
  const mensaje = (e && e.message) ? e.message : String(e);
  // eslint-disable-next-line no-console
  console.error('[calificación rechazada] ' + donde + ' · ' + codigo + ' · ' + mensaje);
}
