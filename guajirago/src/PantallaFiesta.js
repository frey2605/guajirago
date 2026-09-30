import React from 'react';

// 🎉 EL MARCO DE LAS PANTALLAS DE FIESTA — UNA sola pieza para el fondo y el confeti que cae (gemelo G80, 29-sep-2026).
//
// Lo usan cuatro pantallas: la bienvenida del pasajero (Login.js), la del conductor (App.js), «¡Recibiste tu saldo!»
// (AppConductor.js) y «¡Código activado!» (Promociones.js). Hasta el 29-sep-2026 cada una dibujaba a mano el fondo
// blanco, las bolitas de colores y su animación (SEGUNDA LEY).
//
// Aquí vive SOLO el marco: el fondo a pantalla completa, el confeti y sus animaciones. El dibujo, el título, el texto,
// la tarjeta y el botón los pone cada pantalla (van como `children`), y son distintos a propósito.
//
// Hay DOS estilos de confeti, los mismos que ya había, para que nadie vea un cambio:
//   · 'bienvenida' — 40 bolitas más grandes, encima de todo (las dos bienvenidas). Trae además el rebote de los dibujos
//     de arriba: esas pantallas lo usan con `REBOTE`.
//   · 'saldo'      — 30 bolitas (el saldo del conductor y el código activado).
// La bienvenida del conductor pinta su confeti con seis colores; la del pasajero con cinco: `colores` lo deja igual.
//
// Que cada pantalla se vea EXACTAMENTE igual que antes lo mide, pintándolas, `node scripts/medir-pantallas-fiesta.cjs`,
// y lo vigila `pruebas/pantallasFiesta.test.js`. (La ventanita «¡Trato hecho!» NO usa este marco: no tiene confeti que
// cae ni el mismo fondo; vive en TratoHecho.js.)
const ESTILOS = {
  bienvenida: {
    capa: 999999, piezas: 40, arriba: 24, tamano: [16, 18], duracion: [2.2, 2], espera: 1.2, caer: 'caerBienvenida',
    colores: ['#FFCF4D', '#FF7A2F', '#D6357E', '#1C8EF9', '#2ECC71'],
    css: '@keyframes caerBienvenida { from { transform: translateY(-24px) rotate(0deg); opacity: 1; } to { transform: translateY(100vh) rotate(360deg); opacity: 0.2; } }\n' +
      '@keyframes rebotarBienvenida { from { transform: scale(1); } to { transform: scale(1.12); } }',
  },
  saldo: {
    capa: 99999, piezas: 30, arriba: 20, tamano: [14, 14], duracion: [2, 2], espera: 1.5, caer: 'caer',
    colores: ['#FFCF4D', '#FF7A2F', '#D6357E', '#2ECC71', '#1C8EF9'],
    css: '@keyframes caer { from { transform: translateY(-20px) rotate(0deg); opacity: 1; } to { transform: translateY(100vh) rotate(360deg); opacity: 0.3; } }',
  },
};

// El rebote de los dibujos de las bienvenidas (solo existe con el estilo 'bienvenida').
export const REBOTE = 'rebotarBienvenida 0.6s infinite alternate';

export default function PantallaFiesta({ estilo, colores, children }) {
  const e = ESTILOS[estilo];
  const lista = colores || e.colores;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: e.capa, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden' }}>
      {Array.from({ length: e.piezas }, (_, i) => (
        <span key={i} style={{
          position: 'absolute', top: `-${e.arriba}px`, left: `${Math.random() * 100}%`,
          fontSize: `${e.tamano[0] + Math.random() * e.tamano[1]}px`,
          color: lista[i % lista.length],
          animation: `${e.caer} ${e.duracion[0] + Math.random() * e.duracion[1]}s linear ${Math.random() * e.espera}s infinite`,
        }}>●</span>
      ))}
      {children}
      <style>{e.css}</style>
    </div>
  );
}
