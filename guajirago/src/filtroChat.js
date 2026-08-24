/**
 * EL FILTRO ANTI-DATOS DE LOS CHATS — UN SOLO SITIO
 *
 * SEGUNDA LEY. Este filtro impide que por los chats de la plataforma pasen
 * teléfonos, correos o menciones a WhatsApp/redes — o sea, que el negocio se
 * escape por fuera y la comisión se quede sin cobrar.
 *
 * Hasta el 24-ago-2026 vivía copiado TRES veces, y las copias YA HABÍAN
 * DIVERGIDO — medido, no supuesto:
 *   · Creditos.js (chat de recargas)       — la versión fuerte, 16 palabras.
 *   · Restaurantes.js (chat del pedido)    — una versión FLOJA: dejaba pasar
 *     «gmail», «hotmail», «correo», «email», «celular», «tiktok» y «whats app»
 *     — aunque era la ÚNICA que bloqueaba «wapp».
 *   · guajirago-admin/Codigos.js (panel)   — igual a la fuerte.
 *
 * La ley rota, mordiendo: lo que un chat bloqueaba, el otro lo dejaba pasar.
 * Al unificar manda LA UNIÓN de las listas — nadie pierde una palabra que ya
 * bloqueaba. Ese endurecimiento es a propósito y está declarado.
 *
 * EL PANEL ES OTRO REPOSITORIO y no puede importar este archivo: conserva su
 * copia en Codigos.js. Un amarre (pruebas/amarres.test.js) EJECUTA las dos con
 * la misma batería de mensajes y falla si dan veredictos distintos.
 *
 * DÓNDE NO SE FILTRA, A PROPÓSITO: el chat del viaje (pasajero↔conductor ya
 * emparejados). Ellos ya se ven el teléfono para llamarse — ahí el filtro no
 * protege nada. Medido y decidido el 24-ago-2026.
 */

/** ¿Este texto trae un teléfono, un correo o una invitación a irse del chat? */
export function contieneInfoSensible(texto) {
  const limpio = texto.toLowerCase();
  // Secuencias de 7+ dígitos seguidos (posible teléfono). Se quitan espacios,
  // puntos, rayas Y el signo + — la copia floja atajaba «3+0+0+1+2+3+4» y la
  // unión no podía perder eso (lo encontró la segunda opinión del 24-ago-2026).
  // La coma NO se quita a propósito: quitarla bloquearía listas de precios
  // («1,200, 3,400...») que hoy pasan bien — y con comas ya se evadían las DOS
  // copias viejas, así que ahí no se pierde nada.
  if (/\d{7,}/.test(texto.replace(/[\s.+-]/g, ''))) return true;
  // Correos electrónicos
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(texto)) return true;
  // Menciones a redes o apps de contacto externo
  const palabrasBloqueadas = ['whatsapp', 'whats app', 'wasap', 'wapp', 'instagram', 'facebook', 'telegram', 'tiktok', 'correo', 'email', 'gmail', 'hotmail', 'llamame', 'llámame', 'celular', 'numero', 'número'];
  return palabrasBloqueadas.some(p => limpio.includes(p));
}
