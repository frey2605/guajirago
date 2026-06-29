import React from 'react';

function Promociones({ onVolver }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Promociones</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>🎁</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '0 0 12px' }}>No hay ofertas activas</h2>
        <p style={{ color: '#555', fontSize: '15px', margin: '0', lineHeight: '1.6' }}>En este momento no hay promociones disponibles. Vuelve pronto, ¡pronto habrá sorpresas para ti!</p>
      </div>
    </div>
  );
}

export default Promociones;