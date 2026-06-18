import React, { useState } from 'react';
import Solicitar from './Solicitar';

function Home() {
  const [pantalla, setPantalla] = useState('home');
  const [tipoSeleccionado, setTipoSeleccionado] = useState('');

  if (pantalla === 'solicitar') {
    return <Solicitar tipo={tipoSeleccionado} onVolver={() => setPantalla('home')} />;
  }

  return (
    <div style={{
      backgroundColor: '#141416',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
        padding: '24px 20px',
      }}>
        <p style={{ color: '#555', fontSize: '12px', margin: '0', letterSpacing: '2px' }}>UBICACIÓN</p>
        <p style={{ color: '#FFFFFF', fontSize: '16px', margin: '4px 0 0', fontWeight: 'bold' }}>📍 Riohacha, La Guajira</p>
        <h2 style={{ color: '#FFFFFF', fontSize: '24px', margin: '16px 0 0', fontWeight: '900' }}>
          ¿A dónde vamos hoy?
        </h2>
      </div>

      {/* Servicios */}
      <div style={{ padding: '24px 20px' }}>
        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '0 0 16px' }}>SERVICIOS</p>

        {/* Taxi */}
        <div onClick={() => { setTipoSeleccionado('Taxi'); setPantalla('solicitar'); }}
          style={{
            background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid #2A2A2E',
            cursor: 'pointer',
          }}>
          <span style={{ fontSize: '36px' }}>🚗</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>Taxi</p>
            <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '4px 0 0' }}>Disponible ahora</p>
          </div>
        </div>

        {/* Mototaxi */}
        <div onClick={() => { setTipoSeleccionado('Mototaxi'); setPantalla('solicitar'); }}
          style={{
            background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
            borderRadius: '20px',
            padding: '20px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            border: '1px solid #2A2A2E',
            cursor: 'pointer',
          }}>
          <span style={{ fontSize: '36px' }}>🏍️</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>Mototaxi</p>
            <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '4px 0 0' }}>Disponible ahora</p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Home;