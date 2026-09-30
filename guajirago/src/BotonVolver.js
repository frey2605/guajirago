import React from 'react';
import { T } from './theme';

// ‹ EL BOTÓN «VOLVER» DE LA APP — UNA sola pieza (gemelo G91, 30-sep-2026).
//
// Se escribía a mano en cada pantalla: 24 copias en 15 archivos, con 7 aspectos (el fondo gris claro o #ECECEF, el ‹
// de 20 o de 22, un padding de 14, y uno azul en Restaurantes). Todas van sobre fondo claro, así que el aspecto es UNO:
// la pastilla gris con ‹ que pide robot/ESTILO.md, con los colores de la paleta (theme.js). Cada pantalla solo dice:
//   · alVolver — lo que hace al tocarlo (a dónde vuelve). La pieza no decide nada de eso.
//   · lugar    — DÓNDE va puesto (no cambia cómo se ve):
//       'fila'        dentro de la fila del encabezado (lo normal);
//       'filaApretada' en una fila que se aprieta: no se encoge (Créditos, con el saldo al lado);
//       'flotante'    encima del encabezado, al lado del ☰ Menú (App, Home, conductor);
//       'trasMenu'    en la fila, detrás del ☰ Menú (Restaurantes, Turismo);
//       'arriba'      solo, arriba de la página, sin estirarse (Turismo: mis reservas y la agencia).
// Lo mide `node scripts/medir-boton-volver.cjs` y lo vigila `pruebas/botonVolver.test.js`.

export const LUGARES = {
  fila: {},
  filaApretada: { flexShrink: 0 },
  flotante: { position: 'absolute', top: '18px', left: '120px', zIndex: 5 },
  trasMenu: { marginLeft: '96px' },
  arriba: { display: 'inline-flex', marginBottom: '16px' },
};

function BotonVolver({ alVolver, lugar = 'fila' }) {
  const donde = LUGARES[lugar];
  if (!donde) throw new Error('BotonVolver: no conozco el lugar «' + lugar + '»');
  return (
    <div onClick={alVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: T.pastilla, borderRadius: '12px', color: T.tinta, fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', ...donde }}>
      <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
    </div>
  );
}

export default BotonVolver;
