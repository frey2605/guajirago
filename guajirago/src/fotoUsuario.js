// ─────────────────────────────────────────────────────────────────────────────
// ¿CUÁL ES LA FOTO DE ESTA PERSONA? — una sola respuesta (gemelo G43, 28-sep-2026).
//
// La foto de perfil se guarda en la ficha `usuarios/{uid}` con el nombre `fotoConductor`,
// sea conductor o pasajero: lo escriben el alta del conductor (App.js) y «Mi perfil»
// (MiPerfil.js). El nombre engaña, pero es el contrato entre las apps y los datos
// guardados, así que NO se renombra: se LEE bien.
//
// Hasta hoy cada pantalla la buscaba a su manera: la app `fotoConductor || foto`, la
// pantalla del conductor y el panel de Conductores solo `fotoConductor`, y el panel de
// Pasajeros solo `foto` —un campo que nadie escribe—, así que la foto que un pasajero
// subía en «Mi perfil» nunca salía en el panel.
//
// LA REGLA: `fotoConductor`, y si no hay, `foto` (el nombre viejo: medido el 28-sep-2026,
// ninguna ficha lo lleva, pero se sigue leyendo por si alguna antigua lo tuviera).
// Todas las pantallas que enseñan la foto de la FICHA de una persona la sacan de aquí.
// La foto del conductor que va dentro de un viaje (`conductorFoto`) es otra cosa: es la
// copia del día del viaje.
//
// El panel (guajirago-admin, otro repo) tiene una copia idéntica, atada byte a byte por
// pruebas/fotoFicha.test.js. Sin imports a propósito: así las pruebas lo cargan tal cual
// (pruebas/cargar.cjs).
// ─────────────────────────────────────────────────────────────────────────────

export function fotoDe(ficha) {
  if (!ficha) return null;
  return ficha.fotoConductor || ficha.foto || null;
}
