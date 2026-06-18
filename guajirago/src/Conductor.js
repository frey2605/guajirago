import React, { useState, useEffect } from 'react';
import Calificacion from './Calificacion';

function Conductor({ tipo, onCancelar }) {
  const [segundos, setSegundos] = useState(10);
  const [pantalla, setPantalla] = useState('conductor');

  useEffect(() => {
    const timer = setInterval(() => {
      setSegundos(s => {
        if (s <= 1) {
          clearInterval(timer);
          setPantalla('calificacion');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (pantalla === 'calificacion') {
    return <Calificacion tipo={tipo} onFinalizar={onCancelar} />;
  }

  const minutos = Math.floor(segundos / 60);
  const segs = segundos % 60;

  return (
    <div style={{
      backgroundColor: '#141416',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
    }}>

      {/* Mapa simulado */}
      <div style={{
        height: '280px',
        background: 'linear-gradient(135deg, #1a2a1a, #1a1a2a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '60px' }}>{tipo === 'Taxi' ? '🚗' : '🏍️'}</div>
          <div style={{
            width: '80px',
            height: '3px',
            background: 'linear-gradient(90deg, #FF7A2F, transparent)',
            margin: '8px auto',
            borderRadius: '2px',
          }}/>
          <div style={{ fontSize: '24px' }}>📍</div>
        </div>

        <div style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          background: '#141416',
          borderRadius: '12px',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ECC71' }}/>
          <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold' }}>
            En camino · {minutos}:{segs.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Card conductor */}
      <div style={{
        margin: '-20px 16px 0',
        background: '#1A1A1E',
        borderRadius: '24px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        position: 'relative',
        zIndex: 2,
      }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div style={{
            width: '60px', height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px',
          }}>
            👨🏽
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Carlos Epieyu</p>
            <p style={{ color: '#FFCF4D', fontSize: '14px', margin: '4px 0 0' }}>⭐ 4.9 · 312 viajes</p>
          </div>
          <div style={{
            background: '#141416',
            borderRadius: '12px',
            padding: '8px 14px',
            textAlign: 'center',
          }}>
            <p style={{ color: '#555', fontSize: '9px', margin: '0', letterSpacing: '1px' }}>PLACA</p>
            <p style={{ color: '#FFCF4D', fontSize: '16px', fontWeight: '900', margin: '2px 0 0' }}>GUA 123</p>
          </div>
        </div>

        <div style={{
          background: '#141416',
          borderRadius: '16px',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-around',
          marginBottom: '20px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>VEHÍCULO</p>
            <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold', margin: '4px 0 0' }}>
              {tipo === 'Taxi' ? 'Chevrolet Spark' : 'Honda CB125'}
            </p>
          </div>
          <div style={{ width: '1px', background: '#2A2A2E' }}/>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>LLEGA EN</p>
            <p style={{ color: '#FF7A2F', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>
              {minutos}:{segs.toString().padStart(2, '0')}
            </p>
          </div>
          <div style={{ width: '1px', background: '#2A2A2E' }}/>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>TARIFA</p>
            <p style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold', margin: '4px 0 0' }}>$5.000</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{
            flex: 1, padding: '14px',
            background: '#141416',
            border: 'none', borderRadius: '14px',
            color: '#FFFFFF', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}>
            📞 Llamar
          </button>
          <button style={{
            flex: 1, padding: '14px',
            background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
            border: 'none', borderRadius: '14px',
            color: '#141416', fontSize: '14px',
            fontWeight: 'bold', cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px',
          }}>
            💬 Chatear
          </button>
        </div>

        <button onClick={onCancelar} style={{
          width: '100%', marginTop: '12px',
          padding: '14px',
          background: 'transparent',
          border: '1px solid #2A2A2E',
          borderRadius: '14px',
          color: '#555', fontSize: '14px',
          cursor: 'pointer',
        }}>
          Cancelar viaje
        </button>

      </div>
    </div>
  );
}

export default Conductor;