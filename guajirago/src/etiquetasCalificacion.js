// G73 (29-sep-2026) · LAS ETIQUETAS DE LA CALIFICACIÓN, EN UN SOLO SITIO.
//
// Al calificar un viaje, la app ofrece estas etiquetas («¿QUÉ DESTACAS?») y cada una dice si es buena (verde ✅) o
// mala (roja ❌). Se guardan tal cual, como texto, en `calificaciones.opcionesSeleccionadas`, y el panel las vuelve a
// pintar verdes o rojas en ⭐ Calificaciones. Hasta hoy el panel llevaba SU PROPIA lista de las buenas, escrita a
// mano tres veces: una etiqueta buena nueva aquí la habría pintado roja allá sin que nada avisara.
//
// 🔴 El panel es OTRO repo y no puede importar este archivo: lleva una copia IDÉNTICA en
// guajirago-admin/src/etiquetasCalificacion.js, atada byte a byte por pruebas/etiquetasCalificacion.test.js.
// Se cambia AQUÍ primero y se copia igual.
//
// ⚠️ Los textos son el dato guardado: cambiar uno deja las calificaciones viejas con el texto de antes, y el panel
// ya no lo reconocería como bueno (lo pintaría rojo). Una etiqueta que se retire se deja en la lista.

export const OPCIONES_PASAJERO = [
  { texto: 'Llegó rápido', buena: true },
  { texto: 'Buen trato', buena: true },
  { texto: 'Conducción segura', buena: true },
  { texto: 'Vehículo limpio', buena: true },
  { texto: 'Llegó tarde', buena: false },
  { texto: 'Mal trato', buena: false },
  { texto: 'Conducción peligrosa', buena: false },
  { texto: 'Vehículo sucio', buena: false },
  { texto: 'Canceló sin avisar', buena: false },
];

export const OPCIONES_CONDUCTOR = [
  { texto: 'Pasajero puntual', buena: true },
  { texto: 'Trato respetuoso', buena: true },
  { texto: 'Buen comunicador', buena: true },
  { texto: 'Sin contratiempos', buena: true },
  { texto: 'Hizo esperar mucho', buena: false },
  { texto: 'Trato grosero', buena: false },
  { texto: 'Dirección incorrecta', buena: false },
  { texto: 'Canceló sin avisar', buena: false },
];

// Las buenas de las dos listas. Una etiqueta que ninguna lista conoce NO es buena (el panel la pinta roja).
export const ETIQUETAS_BUENAS = [...OPCIONES_PASAJERO, ...OPCIONES_CONDUCTOR].filter((o) => o.buena).map((o) => o.texto);

export function esEtiquetaBuena(texto) {
  return ETIQUETAS_BUENAS.includes(texto);
}
