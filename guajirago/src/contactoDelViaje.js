// P21 (1-oct-2026) · EL CAJÓN DE CONTACTO DEL VIAJE — una sola pieza.
//
// Un viaje que busca conductor lo leen TODOS los conductores (P20: es el mercado). Hasta hoy llevaba dentro datos que
// el conductor solo necesita DESPUÉS de que el pasajero lo acepta: el teléfono de quien recibe un mandado y el token de
// avisos del pasajero. (El correo del pasajero también iba ahí, y no lo leía nadie: ya no se escribe.) Ahora esos dos
// van en `viajes/{viajeId}/contacto/pasajero`, y las reglas (firestore.rules, `match /contacto/{cual}`) solo dejan
// leerlo al pasajero, al conductor ACEPTADO mientras el viaje está vivo, y al panel. El servidor (SDK admin) lo lee
// para el aviso «tienes una oferta» (notificarPasajeroOferta).
//
// La usan: la pantalla de pedir (Solicitar.js, escribe), la del conductor (AppConductor.js, lee al ser aceptado) y el
// panel (guajirago-admin/src/Mensajeria.js, que lleva una COPIA IDÉNTICA de este archivo porque es otro repo; la ata
// byte a byte pruebas/contactoDelViaje.test.js). La ruta del servidor la ata la misma prueba.
//
// Los viajes de ANTES de P21 (y los que cree una app vieja que todavía no se actualizó) llevan el teléfono dentro del
// viaje, en `mensajeria.recibeTel`: por eso quien lee pregunta primero al cajón y, si no está, al viaje. No se
// mudan los viajes guardados.
import { doc, setDoc, getDoc } from 'firebase/firestore';

/** El documento del cajón de contacto de ese viaje. */
export const refContactoDelViaje = (db, viajeId) => doc(db, 'viajes', viajeId, 'contacto', 'pasajero');

/** Lo que se guarda al pedir: el teléfono de quien recibe, solo si lo hay (un taxi no lleva nada). El token lo pega después Notificaciones.js. */
export const contactoNuevo = (recibeTel) => (recibeTel ? { recibeTel } : {});

/**
 * Crea el cajón del viaje recién creado (siempre, también vacío: ahí se pega luego el token de avisos). No bloquea el
 * viaje: si falla, el viaje sale igual y queda rastro en la consola; el conductor no tendría el teléfono de quien recibe.
 */
export const guardarContactoDelViaje = (db, viajeId, recibeTel) =>
  setDoc(refContactoDelViaje(db, viajeId), contactoNuevo(recibeTel))
    .then(() => true)
    .catch((e) => { console.warn('No se pudo guardar el contacto del viaje:', (e && e.message) || e); return false; });

/** Lee el cajón. Si no existe o no se puede leer, devuelve {} (y quien lee cae en lo que lleve el viaje). */
export const leerContactoDelViaje = (db, viajeId) =>
  getDoc(refContactoDelViaje(db, viajeId))
    .then((s) => (s.exists() ? s.data() : {}))
    .catch((e) => { console.warn('No se pudo leer el contacto del viaje:', (e && e.message) || e); return {}; });

/** El teléfono de quien recibe: el del cajón; si el viaje es de antes de P21, el que lleva el propio viaje. */
export const telefonoDeQuienRecibe = (viaje, contacto) =>
  (contacto && contacto.recibeTel) || (viaje && viaje.mensajeria && viaje.mensajeria.recibeTel) || '';
