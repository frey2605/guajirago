import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// LA VENTANITA «¿POR QUÉ CANCELAS?» — UNA SOLA, para el pasajero y el conductor (gemelo G06, 28-sep-2026).
//
// Estaba escrita dos veces, en Solicitar.js y en AppConductor.js. Al pasar al tema claro se arregló la del
// conductor y la del pasajero se quedó con la letra de los motivos en BLANCO sobre la tarjeta blanca: el
// pasajero veía cinco cajas vacías, y el motivo que escogía a ciegas es el que el dueño lee luego en el panel.
// Ahora las dos pantallas importan ésta; lo único que cambia es la lista de motivos, que les llega de
// textosViaje.js (RAZONES_CANCELACION_PASAJERO / RAZONES_CANCELACION_CONDUCTOR).
//
// LA LEY DEL BOTÓN: la acción la corre la pantalla con su candado (`onConfirmar` va por `correr`); aquí solo se
// reciben `ocupado` y la palabra, y los dos botones se bloquean mientras trabaja (pruebas/leyBoton.test.js).
// El color de cada motivo lo mide scripts/medir-cancelacion-g06.cjs corriendo `estiloMotivo`.
// ─────────────────────────────────────────────────────────────────────────────

export function estiloMotivo(escogido) {
  return { padding: '14px 16px', background: escogido ? 'rgba(255,68,68,0.15)' : '#FFFFFF', border: `1px solid ${escogido ? '#FF4444' : '#ECECEF'}`, borderRadius: '14px', color: escogido ? '#FF4444' : '#1A1A1E', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontWeight: escogido ? 'bold' : 'normal' };
}

export default function ModalCancelacion({ razones, onConfirmar, onCerrar, ocupado }) {
  const [razonSeleccionada, setRazonSeleccionada] = useState('');
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9997, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '28px 24px', width: '100%', maxWidth: '440px', border: '1px solid #ECECEF' }}>
        <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 8px', letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}>CANCELAR VIAJE</p>
        <p style={{ color: '#1A1A1E', fontSize: '18px', fontWeight: '900', margin: '0 0 20px', textAlign: 'center' }}>¿Por qué cancelas?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {razones.map((razon, i) => (
            <button key={i} onClick={() => setRazonSeleccionada(razon)} style={estiloMotivo(razonSeleccionada === razon)}>
              {razonSeleccionada === razon ? '● ' : '○ '}{razon}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onCerrar} disabled={!!ocupado} style={{ flex: 1, padding: '14px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '14px', color: '#6B7280', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Volver</button>
          <button onClick={() => razonSeleccionada && onConfirmar(razonSeleccionada)} disabled={!!ocupado} style={{ flex: 2, padding: '14px', background: razonSeleccionada ? '#FF4444' : '#ECECEF', border: 'none', borderRadius: '14px', color: razonSeleccionada ? '#FFFFFF' : '#6B7280', fontSize: '14px', fontWeight: '900', cursor: razonSeleccionada ? 'pointer' : 'default' }}>
            {ocupado === 'cancelar' ? 'Cancelando…' : 'Confirmar cancelación'}
          </button>
        </div>
      </div>
    </div>
  );
}
