// ── QUÉ SE LE DICE A QUIEN SE QUEDÓ SIN SABER ──────────────────────────────
// REGLA 9 del dueño: «Nada se rechaza en silencio.»
//
// ESTE ARCHIVO ESTÁ TRES VECES, y las tres copias son idénticas byte a byte:
//     guajirago/src/avisoRechazo.js
//     guajirago-aliados/src/avisoRechazo.js
//     guajirago-admin/src/avisoRechazo.js
// Se nombran las TRES a propósito. La primera versión decía «gemelo exacto de
// guajirago-admin/…», y al copiarlo tal cual el del panel acabó señalándose a sí
// mismo: quien lo abriera leía «toca también el gemelo» sin saber dónde estaba.
// Lo cazó la segunda opinión. SI TOCAS UNA, TOCA LAS OTRAS DOS.
//
// La tercera llegó el 5-sep-2026, con la REGLA 9 en los botones del viaje del
// conductor: hasta entonces la app del pasajero solo tenía las palabras de una
// calificación que no entró, y no servían para «no se pudo cerrar el viaje».
//
// Y son hermanos de guajirago/src/avisoCalificacion.js, que dice lo mismo con
// otras palabras porque allí quien lee es un cliente. Los tres repos son APARTE
// —no hay forma de importar de uno a otro, aquí no hay API—, así que la SEGUNDA
// LEY se cumple como en el resto del proyecto: copias AMARRADAS por
// pruebas/amarres.test.js, que ejecuta los tres lados con los mismos fallos.
//
// Por qué no se comparte el texto con la app del pasajero: allí el que lee es un
// cliente al que no le entró la calificación; aquí es un restaurante que reporta
// una reseña, o el propio panel moderándola. Lo que SÍ tiene que ser igual en los
// tres es CÓMO se clasifica el fallo, y eso es lo que amarra la prueba.

// Las tres clases de fallo. Quien las usa es el amarre de pruebas/amarres.test.js:
// comprueba que ninguna de las tres apps devuelva una clase que no esté aquí.
//
// La primera versión decía que «el resto del proyecto se apoya en estos nombres»,
// y era MENTIRA: no las importaba nadie. Era código muerto con un comentario que
// decía lo contrario. Lo cazó la segunda opinión. O se usan, o se van; se usan.
export const CLAVES = ['permiso', 'sinRed', 'otro'];

/**
 * Convierte el fallo de Firestore en algo que una persona entiende.
 *
 * Se mira `e.code`, no el mensaje: el mensaje cambia entre versiones del SDK y
 * viene en inglés. El código es el contrato.
 *
 * `accion` es lo que se estaba intentando, en infinitivo y en cristiano:
 * «reportar el comentario», «restaurar el comentario», «cargar los comentarios
 * reportados». Se mete en la frase para que el aviso diga qué falló y no un
 * «error» a secas.
 *
 * Lo que no se reconozca cae en 'otro' A PROPÓSITO: más vale un aviso genérico
 * que ningún aviso, que es de donde venimos.
 */
export function motivoDeRechazo(e, accion) {
  const codigo = (e && e.code) ? String(e.code) : '';
  const queIba = accion || 'guardar el cambio';
  if (codigo === 'permission-denied') {
    return {
      clave: 'permiso',
      titulo: 'No se pudo ' + queIba,
      texto: 'El servidor no aceptó el cambio. Puede que esta cuenta no tenga '
        + 'permiso para hacerlo.',
    };
  }
  if (codigo === 'unavailable' || codigo === 'deadline-exceeded') {
    return {
      clave: 'sinRed',
      titulo: 'Sin conexión',
      texto: 'No hay internet ahora mismo, así que no se pudo ' + queIba
        + '. Inténtalo otra vez cuando haya señal.',
    };
  }
  return {
    clave: 'otro',
    titulo: 'No se pudo ' + queIba,
    texto: 'Algo falló por el camino y el cambio no se hizo. Inténtalo otra vez.',
  };
}

/**
 * Para la consola del que revisa. NO es la bandeja que pide la REGLA 9 —es solo
 * un rastro en el navegador— pero sin esto un fallo raro no deja NADA, y ya
 * sabemos cómo acaba eso.
 */
export function apuntarRechazo(donde, e) {
  const codigo = (e && e.code) ? e.code : '(sin código)';
  const mensaje = (e && e.message) ? e.message : String(e);
  // eslint-disable-next-line no-console
  console.error('[rechazo] ' + donde + ' · ' + codigo + ' · ' + mensaje);
}
