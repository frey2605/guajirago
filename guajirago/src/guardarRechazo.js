// ── LA BANDEJA DE RECHAZOS · EL LADO QUE ESCRIBE ───────────────────────────
// REGLA 9 del dueño: «Nada se rechaza en silencio. Todo rechazo va a una bandeja
// con su motivo.» La primera mitad —que el cliente se entere— la resuelve
// avisoCalificacion.js. Esta es la otra: que quede escrito y el dueño lo vea en
// el panel.
//
// VA EN ARCHIVO APARTE de avisoCalificacion.js A PROPÓSITO. Aquél es aritmética
// pura, sin imports, y por eso las pruebas pueden EJECUTARLO tal cual está en el
// disco (pruebas/cargar.cjs solo sabe cargar archivos sin imports). Este habla
// con la base de datos. Si se juntaran, se perderían las pruebas que ejecutan el
// archivo de verdad, que son las que valen.
//
// ESTE ARCHIVO ESTÁ DOS VECES, y las dos copias son idénticas byte a byte:
//     guajirago/src/guardarRechazo.js
//     guajirago-aliados/src/guardarRechazo.js
// Se nombran las DOS a propósito. Con el gemelo de avisoRechazo.js se escribió
// «gemelo de …», se copió tal cual, y la copia acabó señalándose a sí misma:
// quien la abriera leía «toca también el gemelo» sin saber dónde estaba. Los
// repos son APARTE y no hay forma de importar entre ellos; van amarrados por
// pruebas/amarres.test.js. SI TOCAS UNO, TOCA EL OTRO.
//
// EL PANEL NO ESCRIBE AQUÍ, y es decisión tomada, no olvido: la bandeja es para
// lo que le pasa a la GENTE en las apps, donde el dueño no está mirando. (Ojo: el
// panel tiene por su cuenta 33 catch vacíos suyos, de los que solo se arreglaron
// los de moderar comentarios. Eso es otro trabajo y queda ANOTADO — lo contó la
// segunda opinión.)
import { db, auth } from './firebase';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';

/**
 * Los cuatro sitios que existen. Es la MISMA lista que la de firestore.rules y
 * la de la tabla del panel (guajirago-admin/src/Rechazos.js), y hay una prueba
 * que carea los tres lados.
 *
 * Que sea cerrada no es higiene: es la mitad del candado anti-vertedero. Ver
 * nombreDelRechazo.
 */
export const SITIOS = [
  'calificar-viaje', 'calificar-pedido', 'ver-calificaciones', 'reportar-comentario',
];

/**
 * El nombre del documento: {uid}__{donde}. Nada más.
 *
 * ES EL CANDADO ANTI-VERTEDERO, y la primera versión NO cerraba. Aquí escribe
 * cualquiera con cuenta —tiene que ser así, el que sufre el rechazo es quien lo
 * cuenta—, así que lo que el que escribe pueda ELEGIR del nombre, son documentos
 * que puede crear. La primera versión metía la fecha dentro y las reglas solo
 * exigían que el nombre EMPEZARA por el uid: la segunda opinión creó 300
 * documentos de basura con una sola cuenta, 300 de 300 intentos.
 *
 * Ahora el nombre no tiene ninguna parte libre: uid (lo pone el servidor) más un
 * sitio de la lista cerrada. Lo máximo que una persona puede crear en toda su
 * vida son CUATRO documentos, uno por sitio. Las reglas comparan el nombre
 * ENTERO, no el principio.
 *
 * Se perdió la agrupación por día, y a cambio hay un tope demostrable. La fecha
 * no hacía falta: `ultima` la pone el servidor y dice cuándo fue la última vez.
 */
export function nombreDelRechazo(uid, donde) {
  return uid + '__' + limpiar(donde);
}

// El nombre de un documento no puede llevar barras. Se limpia aquí Y se guarda
// limpio, porque las reglas comparan el nombre con el campo: si no coincidieran,
// el apunte se perdería justo cuando hace falta.
export function limpiar(donde) {
  return String(donde || 'sin-sitio').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
}

/**
 * Apunta el rechazo en la bandeja. Best-effort a propósito: si esto falla, NO se
 * le dice nada más al usuario —ya tiene su ventanita— y se deja rastro en la
 * consola.
 *
 * SIN RED NO FALLA: SE ESPERA. Las dos apps encienden la cola de escrituras sin
 * red (firebase.js:24), así que el apunte se guarda en el teléfono y llega solo
 * cuando vuelve la señal. Esta promesa se queda pendiente mientras tanto — por
 * eso se llama SIN await desde las pantallas: nadie debe esperar a esto.
 */
export async function guardarRechazo(app, donde, clave, e) {
  try {
    const usuario = auth.currentUser;
    if (!usuario) return false;
    await setDoc(doc(db, 'rechazos', nombreDelRechazo(usuario.uid, donde)), {
      quienUid: usuario.uid,
      app,
      donde: limpiar(donde),
      clave,
      codigo: String((e && e.code) || '').slice(0, 60),
      // El contador lo lleva el servidor: dos pantallas a la vez no se pisan. Y
      // las reglas exigen que suba DE UNO EN UNO, así que el número que ve el
      // dueño no lo puede fijar nadie desde fuera.
      veces: increment(1),
      // La hora también la pone el servidor, que es la única que no depende del
      // reloj del teléfono. Y es OBLIGATORIA: la pantalla ordena por ella, y un
      // documento sin el campo por el que se ordena no sale en la consulta.
      ultima: serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bandeja] no se pudo apuntar el rechazo de «' + donde + '»: '
      + ((err && err.message) || err));
    return false;
  }
}
