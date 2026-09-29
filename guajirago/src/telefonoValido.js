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
// EL NÚMERO PARA WHATSAPP (gemelo G41, 28-sep-2026) sale de esta MISMA regla:
// `numeroWhatsApp` da «57» + las 10 cifras, o '' si el teléfono no sirve, y `enlaceWhatsApp`
// arma el enlace wa.me entero. Antes se armaba en 8 sitios de las tres apps, de tres formas:
// «pegar 57 si no empieza por 57» (5712345678 abría wa.me/5712345678), «57 + las 10 últimas
// cifras» (300 123 45 abría wa.me/5730012345) y «57 a todo» (+57 300… abría wa.me/57573…).
// Si el teléfono no sirve y hay mensaje, el enlace abre WhatsApp SIN destinatario —el mensaje
// va escrito y la persona elige a quién—; si no hay mensaje, no hay enlace ('').
//
// 🔴 Lo que esto NO decide:
//   · QUÉ CAMPO de la ficha es el teléfono de una persona → telefonoUsuario.js (G08).
//   · Los demás formularios que validan teléfonos a su manera (G42): cuando les toque,
//     usan esta misma pieza, no otra.
//
// El panel (guajirago-admin) y aliados (guajirago-aliados) son repos APARTE y no pueden
// importar de aquí: tienen una copia IDÉNTICA de este archivo, atada byte a byte por
// pruebas/numeroWhatsApp.test.js. Se cambia aquí primero y se copia igual.
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

export function numeroWhatsApp(texto) {
  const diez = celularDiezCifras(texto);
  return diez ? '57' + diez : '';
}

export function enlaceWhatsApp(telefono, mensaje) {
  const numero = numeroWhatsApp(telefono);
  const conMensaje = mensaje ? '?text=' + encodeURIComponent(mensaje) : '';
  if (!numero && !conMensaje) return '';
  return 'https://wa.me/' + numero + conMensaje;
}
