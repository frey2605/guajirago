// ── EL CHAT DEL VIAJE · UNA SOLA PIEZA PARA LAS DOS PANTALLAS ─────────────────────────────────────────────────────
// G96 (30-sep-2026). Durante el viaje, el conductor y el pasajero se escriben en `viajes/{viajeId}/mensajes`. Escuchar
// ese chat y enviar un mensaje estaba copiado en AppConductor.js y en Solicitar.js (solo cambiaba quién escribe); ahora
// las dos usan este gancho:
//     const [mensajesChat, enviarAlChat] = useChatDelViaje(viajeId, 'conductor' | 'pasajero', chatFinRef, setAviso);
// · Escucha los mensajes en orden de fecha y, cuando llegan, baja al último (chatFinRef). Escucha por la ID del viaje:
//   si el viaje cambia pero es el mismo, no vuelve a empezar; sin viaje no escucha nada.
// · enviarAlChat(texto) escribe { texto (sin espacios a los lados), autor, autorId, fecha } — lo MISMO que escribían
//   las dos copias — y devuelve la promesa de la escritura. El candado de la LEY DEL BOTÓN (useAccion) lo pone la
//   pantalla, que es la que tiene el botón y la tecla Enter.
// · Y LA ESCUCHA YA NO FALLA MUDA: antes el `onSnapshot` iba sin manejador de error, así que si el servidor la cortaba
//   los mensajes nuevos dejaban de llegar y nadie se enteraba. Ahora deja rastro en la consola y le pasa a la pantalla un
//   aviso para su ventanita (REGLA 9). El motivo lo pone motivoDeRechazo (avisoRechazo.js), la única pieza que lo sabe.
// Lo vigila pruebas/chatDelViaje.test.js y lo mide scripts/medir-chat-del-viaje.cjs.
import { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { motivoDeRechazo, apuntarRechazo } from './avisoRechazo';

export const QUE_SE_INTENTABA = 'recibir los mensajes del chat';

/** El mensaje tal como se guarda en la base. */
export function mensajeDelChat(texto, autor, autorId) {
  return { texto: texto.trim(), autor, autorId: autorId || '', fecha: new Date().toISOString() };
}

/** El aviso cuando el servidor corta la escucha: el motivo de avisoRechazo.js y lo que eso significa aquí. */
export function avisoSinChat(e) {
  const m = motivoDeRechazo(e, QUE_SE_INTENTABA);
  return { ...m, texto: 'Los mensajes nuevos del chat no te van a llegar. Cierra la app y vuelve a abrirla.' };
}

export function useChatDelViaje(viajeId, autor, finRef, alFallar) {
  const [mensajes, setMensajes] = useState([]);
  // La versión de ahora del aviso, para que la escucha no dependa de él (solo de la ID del viaje).
  const alFallarRef = useRef(alFallar);
  alFallarRef.current = alFallar;
  useEffect(() => {
    if (!viajeId) return undefined;
    const q = query(collection(db, 'viajes', viajeId, 'mensajes'), orderBy('fecha', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMensajes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => { if (finRef && finRef.current) finRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }, (e) => {
      apuntarRechazo('chatDelViaje.js (escuchar viajes/' + viajeId + '/mensajes)', e);
      if (alFallarRef.current) alFallarRef.current(avisoSinChat(e));
    });
    return () => unsub();
  }, [viajeId]); // eslint-disable-line react-hooks/exhaustive-deps
  const enviar = (texto) => addDoc(collection(db, 'viajes', viajeId, 'mensajes'),
    mensajeDelChat(texto, autor, auth.currentUser?.uid));
  return [mensajes, enviar];
}
