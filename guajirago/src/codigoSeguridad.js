/**
 * EL CÓDIGO DE SEGURIDAD DEL VIAJE — UN SOLO SITIO
 *
 * SEGUNDA LEY del proyecto: «Un proceso vive en UN archivo.» Este proceso es el
 * que el 23-ago-2026 hubo que arreglar DOS VECES, renglón por renglón igual, en
 * Solicitar.js y SolicitarMensajeria.js (REGLAS 5 y 11). Esa doble reparación es
 * la prueba de que la ley estaba rota aquí. Ya no: las dos pantallas llaman esto.
 *
 * QUÉ ES, en cristiano: al pedir un viaje se fabrican cuatro cifras al azar. La
 * pasajera las ve en su pantalla; el conductor tiene que pedírselas en persona al
 * llegar. Así nadie puede hacerse pasar por su conductor.
 *
 * DÓNDE VIVE EL CÓDIGO: en el cajón privado del viaje —
 * `viajes/{id}/privado/seguridad`, campo `codigo` — que según las reglas de
 * Firestore solo puede abrir quien pidió el viaje. Dentro del viaje NO va: ahí lo
 * leía cualquiera que mirase el mercado (así estaba antes de la REGLA 11).
 *
 * ⚠ LA RUTA DEL CAJÓN ES UN CONTRATO CON EL SERVIDOR. La función
 * `verificarCodigoViaje` (guajirago/functions/index.js) lee EXACTAMENTE esta
 * ruta para comprobar el código que teclea el conductor. El servidor no puede
 * importar este archivo (las funciones son otro paquete), así que una PRUEBA
 * (pruebas/codigoSeguridad.test.js) lee los dos lados y falla si dejan de
 * coincidir. Si la ruta cambia aquí y no allá, el conductor no podría iniciar
 * ningún viaje — y no saldría ningún error: solo «código incorrecto» siempre.
 */
import { db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/** Cuatro cifras al azar (1000–9999), distintas en cada viaje. */
export function generarCodigoSeguridad() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Guarda el código en el cajón privado del viaje recién creado.
 * No bloquea la creación del viaje: si falla, el viaje sale igual, solo que el
 * conductor verá «sin_codigo» al verificar (el servidor lo trata como válido).
 */
export function guardarCodigoDeViaje(viajeId, codigo) {
  return setDoc(doc(db, 'viajes', viajeId, 'privado', 'seguridad'), { codigo }).catch(() => {});
}

/**
 * Vuelve a traer el código del cajón privado. Sirve cuando la app se cerró y se
 * volvió a abrir con un viaje en curso: el código ya no está en memoria.
 * Si no hay cajón o no se puede leer, devuelve '' y la pantalla no enseña nada.
 */
export function cargarCodigoDeViaje(viajeId) {
  return getDoc(doc(db, 'viajes', viajeId, 'privado', 'seguridad'))
    .then((s) => (s.exists() ? (s.data().codigo || '') : ''))
    .catch(() => '');
}
