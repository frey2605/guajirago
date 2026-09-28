// ─────────────────────────────────────────────────────────────────────────────
// ¿CUÁL ES EL TELÉFONO DE ESTA PERSONA? — una sola respuesta (gemelo G08, 28-sep-2026).
//
// La ficha `usuarios/{uid}` tiene DOS campos de teléfono, y cada uno quiere decir algo:
//   · `celular`  — el número con que se REGISTRÓ. Lo escribe solo el registro (Login.js)
//                  y nadie lo cambia después: el servidor lo usa para no dar dos veces el
//                  crédito de bienvenida al mismo número (functions: celularDisponible).
//   · `telefono` — el número DE AHORA, si lo cambió: lo escriben «Mi perfil», el alta
//                  del conductor y el panel de Conductores.
// Hasta hoy cada pantalla elegía uno en distinto orden: el inicio de sesión y el panel de
// Pasajeros leían primero `celular` (el VIEJO); App.js y Mi perfil, primero `telefono`;
// el panel de Conductores, solo `telefono`. Con una ficha que tuviera los dos distintos,
// el conductor mandaba en la oferta —y por ahí en el MENSAJE DE EMERGENCIA del pasajero—
// un número u otro según por dónde hubiera entrado.
//
// LA REGLA: `telefono`, y si no hay, `celular`. Todas las pantallas que enseñan o usan el
// teléfono de una persona lo sacan de aquí.
//
// 🔴 Por qué NO se escriben los dos iguales al cambiarlo (se pensó y se descartó): si
// «Mi perfil» sobrescribiera `celular`, el servidor perdería la memoria del número del
// registro, y ese número quedaría libre para abrir otra cuenta. Que los dos sean distintos
// no es un fallo: es la historia. El fallo era LEERLOS en distinto orden.
//
// Esto decide QUÉ CAMPO, no si el número SIRVE: validar y dar formato es otro gemelo
// (G10 / G42). Aquí el número sale tal como está guardado.
//
// El panel (guajirago-admin, otro repo) tiene una copia idéntica, atada byte a byte por
// pruebas/telefonoFicha.test.js. Sin imports a propósito: así las pruebas lo cargan tal
// cual (pruebas/cargar.cjs).
// ─────────────────────────────────────────────────────────────────────────────

export function telefonoDe(ficha) {
  if (!ficha) return '';
  return ficha.telefono || ficha.celular || '';
}
