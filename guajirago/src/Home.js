import React, { useState } from 'react';
import Solicitar from './Solicitar';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';

function Home({ nombre }) {
  const [pantalla, setPantalla] = useState('home');
  const [tipoSeleccionado, setTipoSeleccionado] = useState('');

  const cerrarSesion = async () => {
    await signOut(auth);
    window.location.reload();
  };

  if (pantalla === 'solicitar') {
    return <Solicitar tipo={tipoSeleccionado} onVolver={() => setPantalla('home')} />;
  }

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
        padding: '24px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{ color: '#555', fontSize: '12px', margin: '0', letterSpacing: '2px' }}>UBICACIÓN</p>
          <p style={{ color: '#FFFFFF', fontSize: '16px', margin: '4px 0 0', fontWeight: 'bold' }}>📍 Riohacha, La Guajira</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '22px', margin: '12px 0 0', fontWeight: '900' }}>
            Hola, {nombre || 'pasajero'} 👋
          </h2>
          <p style={{ color: '#555', fontSize: '14px', margin: '4px 0 0' }}>¿A dónde vamos hoy?</p>
        </div>
        <button onClick={cerrarSesion} style={{
          background: '#141416',
          border: 'none',
          borderRadius: '12px',
          padding: '10px 16px',
          color: '#FF4444',
          fontSize: '13px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          🚪 Salir
        </button>
      </div>

      {/* Servicios */}
      <div style={{ padding: '24px 20px' }}>
        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '0 0 16px' }}>SERVICIOS</p>

        {/* Taxi */}
        <div onClick={() => { setTipoSeleccionado('Taxi'); setPantalla('solicitar'); }}
          style={{
            background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
            borderRadius: '20px', padding: '20px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '16px',
            border: '1px solid #2A2A2E', cursor: 'pointer',
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
            borderRadius: '20px', padding: '20px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '16px',
            border: '1px solid #2A2A2E', cursor: 'pointer',
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