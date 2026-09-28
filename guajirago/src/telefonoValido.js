// ─────────────────────────────────────────────────────────────────────────────
// ¿ESTE TELÉFONO SIRVE? — una sola respuesta (gemelo G10, 28-sep-2026).
//
// El contacto de emergencia se validaba en DOS sitios y no igual:
//   · el REGISTRO (Login.js) exigía 10 cifras;
//   · SEGURIDAD (Seguridad.js), al cambiarlo, solo exigía que no estuviera vacío.
// Así se podía guardar «300 123 45», y el botón de emergencia abría
// wa.me/5730012345 —un número que no existe—; o «abc», y abría «wa.me/57», que no le
// avisa a nadie. El pasajero no se enteraba hasta el día que lo necesitara.
//
// LA REGLA: un celular colombiano son 10 cifras. Se aceptan con espacios, guiones o
// puntos («300 123 4567»), y también con el indicativo delante («+57 300 123 4567»,
// «57 3001234567»), que es como lo copia WhatsApp. Cualquier otra cosa NO sirve.
//
// `celularDiezCifras` devuelve las 10 cifras limpias (o '' si no sirve): con eso, el
// botón de emergencia arma el número de WhatsApp sin adivinar. `telefonoSirve` es la
// pregunta de sí o no de los formularios.
//
// 🔴 Lo que esto NO decide:
//   · QUÉ CAMPO de la ficha es el teléfono de una persona → telefonoUsuario.js (G08).
//   · Cómo se arma el número de WhatsApp en las OTRAS pantallas (8 copias, G41).
//   · Los demás formularios que validan teléfonos a su manera (G42): cuando les toque,
//     usan esta misma pieza, no otra.
//
// Sin imports a propósito: así las pruebas lo cargan y lo ejecutan tal cual está en el
// disco (pruebas/cargar.cjs), igual que mensajeEmergencia.js.
// ─────────────────────────────────────────────────────────────────────────────

export function celularDiezCifras(texto) {
  const crudo = String(texto == null ? '' : texto).trim();
  // Solo cifras, espacios, guiones, puntos, paréntesis y un «+» al principio: «abc», «300-12x»
  // o «300123456 ext 2» no son un número que se pueda marcar, aunque tengan cifras.
  if (!/^\+?[\d\s().-]+$/.test(crudo)) return '';
  const cifras = crudo.replace(/\D/g, '');
  if (cifras.length === 10) return cifras;
  if (cifras.length === 12 && cifras.startsWith('57')) return cifras.slice(2);
  return '';
}

export function telefonoSirve(texto) {
  return celularDiezCifras(texto) !== '';
}
