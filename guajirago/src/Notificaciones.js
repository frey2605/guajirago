import { db } from './firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';
import { auth } from './firebase';
// La llave pública Web Push del proyecto. Fase 0 (25-sep-2026): sale del ambiente (.env.produccion /
// .env.pruebas), no del código. Hasta ese día iba escrita aquí la de PRODUCCIÓN, y la compilación de
// pruebas pedía con ella el token del pasajero (obtenerTokenFCM) y el del conductor (registrarTokenFCM).
// La vigila pruebas/elAmbiente.test.js.
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;
// (La alarma sonora de un aviso nuevo vivía aquí. Desde G63 vive en alerta.js, la misma pieza que usa aliados.)
// ¿Puede este celular avisarle al conductor de un viaje nuevo con la app cerrada? 'granted' (sí), 'denied'
// (lo bloqueó), 'default' (no ha contestado) o 'no-soportado' (el navegador no sabe avisar).
export const permisoDeAvisos = () => (typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission);

// La ventanita que se le enseña al conductor cuando NO le van a sonar los viajes (27-sep-2026). Antes la app
// se callaba y solo pintaba «FCM: permiso=denied». Con permiso, no sale nada.
export const avisoDeAvisos = (permiso) => {
  if (permiso === 'granted') return null;
  const titulo = 'Así no te van a sonar los viajes';
  if (permiso === 'denied') return { icono: '🔕', titulo, texto: 'Bloqueaste los avisos de GuajiraGo en este celular. Para que te suenen los viajes nuevos aunque la app esté cerrada, actívalos en los ajustes del navegador: el candado junto a la dirección → Notificaciones → Permitir.' };
  if (permiso === 'default') return { icono: '🔔', titulo, texto: 'Todavía no le diste permiso a GuajiraGo para avisarte. Cuando el celular te pregunte, toca «Permitir» para que te suenen los viajes nuevos aunque la app esté cerrada.' };
  return { icono: '📵', titulo, texto: 'Este navegador no puede avisarte de viajes nuevos con la app cerrada. Mientras estés disponible, deja GuajiraGo abierta en la pantalla.' };
};

// Callback para mostrar el resultado en pantalla
let _onDebug = null;
export const setDebugCallback = (fn) => { _onDebug = fn; };

export const registrarTokenFCM = async () => {
  const log = (msg) => { console.log(msg); if (_onDebug) _onDebug(msg); };
  try {
    const user = auth.currentUser;
    if (!user) { log('FCM: sin usuario'); return; }
    const permiso = await Notification.requestPermission();
    log('FCM: permiso=' + permiso);
    if (permiso !== 'granted') return;
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
    log('FCM: SW listo');
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    log('FCM: token=' + (token ? 'OK' : 'VACIO'));
    if (token) {
      await setDoc(doc(db, 'conductores', user.uid), { fcmToken: token }, { merge: true });
      log('FCM: guardado OK');
      return true; // quién lo llama sabe si quedó guardado (el GPS deja de reintentar)
    }
  } catch(e) {
    if (_onDebug) _onDebug('FCM ERROR: ' + (e.message || e));
    console.log('Error FCM:', e);
  }
  return false;
};

// Pide permiso y devuelve el token de notificaciones del cliente (sin guardarlo),
// para adjuntarlo al pedido y poder avisarle los cambios de estado.
export const obtenerTokenFCM = async () => {
  try {
    if (!('Notification' in window)) return null;
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return null;
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
    const messaging = getMessaging();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token || null;
  } catch (e) {
    return null;
  }
};

// G34 (28-sep-2026): la ÚNICA forma de pegarle al documento que crea el cliente —el viaje, el pedido o la reserva— su
// token de avisos. Se llama ANTES de crear el documento (el cartel de permiso sale con el toque todavía fresco) y
// devuelve con qué pegarlo cuando el documento ya existe. Crear el documento NO espera al cartel: hasta hoy el pedido y
// la reserva no nacían mientras el cliente no tocara «Permitir» o «Bloquear», y cada pantalla lo pegaba a su manera.
// Sin permiso no se escribe nada; si la escritura falla, queda rastro en la consola y el documento sigue bueno (solo se
// queda sin avisos, como sin permiso). El campo lo nombra quien llama porque cada colección lo lee una función distinta
// del servidor: pasajeroFcmToken (notificarPasajeroOferta) y clienteFcmToken (notificarClienteDelPedido y
// notificarClienteReserva). Devuelve una promesa con true si quedó pegado.
export const prepararTokenDeAvisos = (campo) => {
  const token = obtenerTokenFCM();
  return (ref) => token
    .then((t) => (t ? updateDoc(ref, { [campo]: t }).then(() => true) : false))
    .catch((e) => { console.warn('No se pudo pegar el token de avisos (' + campo + '):', (e && e.message) || e); return false; });
};
