// ── «ME ESTÁN LLAMANDO» · UNA SOLA ESCUCHA PARA LAS DOS PANTALLAS ─────────────────────────────────────────────────
// G58 (29-sep-2026). Cuando el otro lado del viaje llama por la app, Llamada.js escribe `llamadas/{viajeId}` con
// `estado: 'llamando'`, y la pantalla del que recibe tiene que saltar a «Llamada entrante». Esa escucha estaba copiada
// IGUAL en AppConductor.js y en Solicitar.js; ahora las dos usan este gancho:
//     const [llamadaEntrante, setLlamadaEntrante] = useLlamadaEntrante(viajeId, setAviso);
// La marca se enciende con 'llamando' y se apaga con 'terminada' o si el documento no existe; con cualquier otro
// estado ('activa', …) se deja como está. La pantalla la apaga ella misma al cerrar la ventana (setLlamadaEntrante).
// Escucha por la ID del viaje: si el viaje cambia pero es el mismo, no vuelve a empezar.
//
// Y YA NO FALLA MUDA: antes el `onSnapshot` iba sin manejador de error, así que si el servidor cortaba la escucha
// (sin permiso, por ejemplo) al que le llamaban no le sonaba nada y nadie se enteraba. Ahora deja rastro en la consola
// y le pasa a la pantalla un aviso para su ventanita (REGLA 9: nada se rechaza en silencio). El motivo lo pone
// motivoDeRechazo (avisoRechazo.js), la única pieza que lo sabe decir; aquí solo se dice qué significa para la persona.
// Lo vigila pruebas/llamadaEntrante.test.js y lo mide scripts/medir-llamada-entrante.cjs.
import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { motivoDeRechazo, apuntarRechazo } from './avisoRechazo';

export const QUE_SE_INTENTABA = 'escuchar las llamadas de este viaje';

/** Qué hacer con la marca cuando llega el documento de la llamada: true (suena), false (se apaga) o null (igual). */
export function marcaDeLlamada(foto) {
  if (foto.exists() && foto.data().estado === 'llamando') return true;
  if (!foto.exists() || foto.data().estado === 'terminada') return false;
  return null;
}

/** El aviso cuando el servidor corta la escucha: el motivo de avisoRechazo.js y lo que eso significa aquí. */
export function avisoSinEscucha(e) {
  const m = motivoDeRechazo(e, QUE_SE_INTENTABA);
  return { ...m, texto: 'Si te llaman por la app durante este viaje, no te va a sonar. Cierra la app y vuelve a abrirla.' };
}

export function useLlamadaEntrante(viajeId, alFallar) {
  const [entrante, setEntrante] = useState(false);
  // La versión de ahora del aviso, para que la escucha no dependa de él (solo de la ID del viaje).
  const alFallarRef = useRef(alFallar);
  alFallarRef.current = alFallar;
  useEffect(() => {
    if (!viajeId) return undefined;
    const unsub = onSnapshot(doc(db, 'llamadas', viajeId), (foto) => {
      const marca = marcaDeLlamada(foto);
      if (marca !== null) setEntrante(marca);
    }, (e) => {
      apuntarRechazo('llamadaEntrante.js (escuchar llamadas/' + viajeId + ')', e);
      if (alFallarRef.current) alFallarRef.current(avisoSinEscucha(e));
    });
    return () => unsub();
  }, [viajeId]);
  return [entrante, setEntrante];
}
