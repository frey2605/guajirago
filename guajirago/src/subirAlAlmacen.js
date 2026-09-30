// ─────────────────────────────────────────────────────────────────────────────
// SUBIR UNA FOTO AL ALMACÉN Y PEDIR SU DIRECCIÓN — una sola pieza (gemelo G82, 29-sep-2026).
//
// PIEZA COMPARTIDA: hay tres copias IDÉNTICAS, byte a byte —guajirago/src, guajirago-admin/src y
// guajirago-aliados/src—, porque son tres repos y no pueden importarse entre sí. Las ata y las CORRE
// pruebas/subirFoto.test.js del repo raíz; y pruebas/storage.test.js sube con ella contra las reglas
// de verdad (storage.rules) en el emulador.
//
// Las tres apps suben fotos en 13 sitios (la cédula y los papeles del conductor, su foto de perfil,
// el comprobante de una recarga, el chat de un pedido, la imagen de un anuncio, el logo de un negocio,
// la foto de un plato o de un tour, los comprobantes de pago). Los 13 escribían lo mismo a mano:
// `ref(storage, ruta)`, `uploadBytes(ref, archivo)` y `getDownloadURL(ref)`.
//
// LO QUE HACE: sube `archivo` a `ruta` DICIENDO SU TIPO y devuelve la dirección (URL con permiso) para
// guardarla o enseñarla. El tipo es el que dio el teléfono (`archivo.type`); si el teléfono no dijo
// ninguno, `image/jpeg`. Antes, sin tipo, el SDK la guardaba como `application/octet-stream`, y por eso
// storage.rules (esUnaFoto) tuvo que dejar pasar también ese tipo. Es el arreglo que storage.rules
// dejó anotado el 6-sep-2026. Todos los sitios suben FOTOS (`accept="image/*"`).
//
// LO QUE NO HACE, a propósito: no decide la RUTA ni el nombre del archivo (cada pantalla sigue
// decidiéndolos: las reglas del almacén miran la carpeta), no achica la foto y no borra la anterior.
// Ningún sitio lo hacía. Si falla, el error sale tal cual: cada pantalla lo dice a su manera.
// ─────────────────────────────────────────────────────────────────────────────
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

export async function subirAlAlmacen(storage, ruta, archivo) {
  const refArchivo = ref(storage, ruta);
  await uploadBytes(refArchivo, archivo, { contentType: (archivo && archivo.type) || 'image/jpeg' });
  return getDownloadURL(refArchivo);
}
