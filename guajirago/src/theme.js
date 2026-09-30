// Paleta del tema claro de GuajiraGo.
// Fondo blanco; los colores cálidos del logo + azul cielo se usan en bordes,
// botones y recuadros. Reutilizar estas constantes para mantener consistencia.
// G90 (30-sep-2026): ES LA paleta de la app de transporte — un color se toma de aquí (`T.azul`), no se escribe a mano.
// Los colores a mano que quedan están contados archivo por archivo en PENDIENTES de scripts/medir-paleta.cjs y solo
// pueden bajar (pruebas/paleta.test.js). Aliados no puede importar este archivo (otro repo): su copia de AZUL,
// AZUL_MEDIO, NARANJA y NARANJA_CLARO (guajirago-aliados/src/flujoPedidos.js) está atada a esta por la misma prueba.
export const T = {
  fondo: '#FFFFFF',          // fondo de pantalla
  fondoSuave: '#FFFBF7',     // secciones con tinte cálido muy suave
  tarjeta: '#FFFFFF',        // fondo de tarjetas/inputs
  borde: '#ECECEF',          // borde neutro
  bordeCalido: '#FF7A2F',    // borde de acento cálido
  azul: '#1C8EF9',           // Azul Cielo (el mismo de la app de restaurante/mesero)
  azulClaro: '#39A6FF',
  azulSuave: 'rgba(28,142,249,0.14)',
  azulNaranja: 'linear-gradient(135deg, #1C8EF9, #FF7A2F)', // matiz azul→naranja (botón menú)
  tinta: '#1A1A1E',          // texto principal sobre blanco
  negro: '#141416',          // el negro oficial de la marca (texto sobre el degradado cálido)
  gris: '#6B7280',           // texto secundario
  grisClaro: '#9AA0A6',      // placeholders
  grad: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', // botones/marca
  amarillo: '#FFCF4D',
  naranja: '#FF7A2F',
  magenta: '#D6357E',
  peligro: '#FF4444',
  ok: '#2ECC71',
};
