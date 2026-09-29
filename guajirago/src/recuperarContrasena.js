// ─────────────────────────────────────────────────────────────────────────────
// MANDAR EL CORREO PARA CREAR UNA CONTRASEÑA NUEVA — la pieza. G71 (29-sep-2026).
//
// Lo usan las dos pantallas de la app que lo mandan: Login.js («¿Olvidaste tu contraseña?», fuera de la cuenta) y
// Configuracion.js («Cambiar contraseña», dentro). Antes cada una llamaba a sendPasswordResetEmail por su lado y
// escribía su propio fallo a mano; y Login culpaba al correo de CUALQUIER fallo: sin señal decía «No encontramos ese
// correo», que es falso, y el día que el servidor contestara «no existe» le habría dicho a cualquiera qué correos
// están registrados (el panel lo evita a propósito desde siempre).
//
// Lo que hace esta pieza, y nada más:
//   · deja el correo como se guardó al registrarse (sin espacios, en minúsculas);
//   · si el servidor contesta que ese correo no existe (o que la cuenta está apagada), NO lo dice: se trata igual que
//     si hubiera salido, y la pantalla enseña el mismo aviso neutro (CORREO_DE_RECUPERACION_ENVIADO);
//   · cualquier otro fallo lo deja pasar tal cual. Quien lo convierte en palabras es motivoDeRechazo de
//     avisoRechazo.js, a través del candado de LA LEY DEL BOTÓN (useAccion): sin señal, demasiados intentos, correo
//     mal escrito. Aquí NO hay otra tabla de errores (SEGUNDA LEY).
// ─────────────────────────────────────────────────────────────────────────────
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from './firebase';

// El aviso de «salió»: el MISMO si el correo existe y si no. Así nadie puede averiguar qué correos tienen cuenta.
export const CORREO_DE_RECUPERACION_ENVIADO = 'Si ese correo está registrado en GuajiraGo, te llegó un enlace para '
  + 'crear una contraseña nueva. Revisa tu bandeja de entrada y la carpeta de correo no deseado (spam).';

// Las respuestas del servidor que DELATAN si un correo tiene cuenta. Hoy el servidor no las manda (tiene puesta la
// protección contra adivinar correos: medido el 29-sep-2026, a un correo que no existe le contesta «listo»), pero si
// un día se apaga, la app sigue sin decirlo.
export const RESPUESTAS_QUE_DELATAN = ['auth/user-not-found', 'auth/user-disabled'];

export async function mandarCorreoDeRecuperacion(correo) {
  try {
    await sendPasswordResetEmail(auth, String(correo || '').trim().toLowerCase());
  } catch (e) {
    if (e && RESPUESTAS_QUE_DELATAN.includes(e.code)) return;
    throw e;
  }
}
