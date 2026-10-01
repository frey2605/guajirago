// P19 (1-oct-2026) · DÓNDE VA EL CARRO MIENTRAS EL VIAJE ESTÁ VIVO — una sola pieza.
//
// Antes el pasajero seguía al carro leyendo la FICHA del conductor (`conductores/{uid}`), y para eso esa ficha tenía
// que poder leerla cualquiera con sesión: con el uid de un conductor se veían su teléfono, su placa, su token de avisos
// y dónde estaba, también semanas después del viaje. Ahora el GPS del conductor escribe su posición, mientras el viaje
// está vivo, en `viajes/{viajeId}/enVivo/conductor`, y el mapa del pasajero la lee de ahí. Las reglas
// (firestore.rules, `match /enVivo/{cual}`) solo dejan leerla a los dos que van en el viaje, y solo mientras está vivo.
//
// La usan los dos lados: el GPS del conductor (AppConductor.js) y el mapa del pasajero (Solicitar.js). La ruta vive
// AQUÍ y en ningún otro sitio: si un lado escribiera en una ruta y el otro leyera de otra, el carro no se movería y
// nadie lo diría.
import { doc } from 'firebase/firestore';

/** El documento donde va el carro de ese viaje. */
export const refUbicacionEnVivo = (db, viajeId) => doc(db, 'viajes', viajeId, 'enVivo', 'conductor');

/** Lo único que se escribe ahí: la posición y su hora (nada de teléfono, nombre ni token). */
export const puntoEnVivo = (lat, lng, timestamp) => ({ lat, lng, timestamp });
