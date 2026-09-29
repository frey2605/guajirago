import React from 'react';

// 🤝 «¡TRATO HECHO!» — UNA sola ventanita para las dos puntas del viaje (gemelo G74, 29-sep-2026).
//
// Sale al pasajero cuando acepta una oferta (Solicitar.js) y al conductor cuando el pasajero lo escoge
// (AppConductor.js). Hasta el 29-sep-2026 cada pantalla la tenía dibujada a mano en su propia
// `function Celebracion()`, copiada igual letra por letra (SEGUNDA LEY).
//
// Aquí vive SOLO cómo se ve. Cuándo sale y cuánto dura (los 3 segundos) lo sigue decidiendo cada pantalla, como antes.
// Que se vea EXACTAMENTE igual que antes en las dos lo mide, pintándola, `node scripts/medir-trato-hecho.cjs`, y lo
// vigila `pruebas/tratoHecho.test.js`.
export default function TratoHecho() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '100px', marginBottom: '24px', animation: 'bounce 0.5s infinite alternate' }}>🤝</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['🎊', '🎉', '🎊', '🎉', '🎊'].map((e, i) => <span key={i} style={{ fontSize: '32px' }}>{e}</span>)}
      </div>
      <h2 style={{ color: '#1A1A1E', fontSize: '28px', fontWeight: '900', margin: '0 0 8px', textAlign: 'center' }}>¡Trato hecho!</h2>
      <p style={{ color: '#FF7A2F', fontSize: '16px', margin: '0', textAlign: 'center' }}>El viaje está confirmado 🚀</p>
      <style>{`@keyframes bounce { from { transform: scale(1); } to { transform: scale(1.2); } }`}</style>
    </div>
  );
}
