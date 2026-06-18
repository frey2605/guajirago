import React, { useState } from 'react';
import Conductor from './Conductor';

function Solicitar({ tipo, onVolver }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [pantalla, setPantalla] = useState('solicitar');

  if (pantalla === 'conductor') {
    return <Conductor tipo={tipo} onCancelar={onVolver} />;
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
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <button onClick={onVolver} style={{
          background: 'none',
          border: 'none',
          color: '#FF7A2F',
          fontSize: '24px',
          cursor: 'pointer',
        }}>←</button>
        <h2 style={{ color: '#FFFFFF', margin: '0', fontSize: '20px' }}>
          Solicitar {tipo}
        </h2>
      </div>

      {/* Formulario */}
      <div style={{ padding: '24px 20px' }}>

        {/* Origen */}
        <div style={{
          background: '#1A1A1E',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '12px', height: '12px',
            borderRadius: '50%',
            background: '#2ECC71',
            flexShrink: 0,
          }}/>
          <input
            value={origen}
            onChange={e => setOrigen(e.target.value)}
            placeholder="¿Dónde estás?"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: '16px',
              width: '100%',
            }}
          />
        </div>

        {/* Destino */}
        <div style={{
          background: '#1A1A1E',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '12px', height: '12px',
            borderRadius: '2px',
            background: '#FF7A2F',
            flexShrink: 0,
          }}/>
          <input
            value={destino}
            onChange={e => setDestino(e.target.value)}
            placeholder="¿A dónde vas?"
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              fontSize: '16px',
              width: '100%',
            }}
          />
        </div>

        {/* Tarifa */}
        <div style={{
          background: '#1A1A1E',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <p style={{ color: '#555', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>TARIFA ESTIMADA</p>
            <p style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '4px 0 0' }}>$5.000 COP</p>
          </div>
          <span style={{ fontSize: '32px' }}>{tipo === 'Taxi' ? '🚗' : '🏍️'}</span>
        </div>

        {/* Botón */}
        <button
          onClick={() => setPantalla('conductor')}
          style={{
            width: '100%',
            padding: '18px',
            background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
            border: 'none',
            borderRadius: '16px',
            color: '#141416',
            fontSize: '18px',
            fontWeight: '900',
            cursor: 'pointer',
            letterSpacing: '1px',
          }}>
          Solicitar {tipo} ahora
        </button>

      </div>
    </div>
  );
}

export default Solicitar;