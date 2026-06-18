import React, { useState } from 'react';

function AppConductor() {
  const [activo, setActivo] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const [viaje, setViaje] = useState(false);

  const simularSolicitud = () => {
    if (activo) {
      setSolicitud({
        pasajero: 'Maria Pushaina',
        origen: 'Barrio Once de Noviembre',
        destino: 'Centro Comercial Mayore',
        distancia: '2.3 km',
        tarifa: '$5.000',
        tipo: 'Taxi',
      });
    }
  };

  if (viaje) {
    return (
      <div style={{
        backgroundColor: '#141416',
        minHeight: '100vh',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{ fontSize: '60px', marginBottom: '24px' }}>🚗</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', margin: '0 0 8px', textAlign: 'center' }}>
          Viaje en curso
        </h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 8px' }}>Pasajero: Maria Pushaina</p>
        <p style={{ color: '#FF7A2F', fontSize: '14px', margin: '0 0 32px' }}>
          Destino: Centro Comercial Mayore
        </p>
        <button onClick={() => { setViaje(false); setSolicitud(null); }} style={{
          width: '100%',
          padding: '18px',
          background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
          border: 'none',
          borderRadius: '16px',
          color: '#141416',
          fontSize: '18px',
          fontWeight: '900',
          cursor: 'pointer',
        }}>
          Finalizar viaje
        </button>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#141416',
      minHeight: '100vh',
      fontFamily: 'Arial, sans-serif',
    }}>

      <div style={{
        background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
        padding: '24px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <p style={{ color: '#555', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>CONDUCTOR</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '20px', margin: '4px 0 0', fontWeight: '900' }}>
            Carlos Epieyu
          </h2>
          <p style={{ color: '#FFCF4D', fontSize: '13px', margin: '4px 0 0' }}>4.9 GUA 123</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>HOY</p>
          <p style={{ color: '#2ECC71', fontSize: '22px', fontWeight: '900', margin: '4px 0 0' }}>$45.000</p>
        </div>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <div style={{
          background: '#1A1A1E',
          borderRadius: '20px',
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>
              {activo ? 'Estoy disponible' : 'No disponible'}
            </p>
            <p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>
              {activo ? 'Puedes recibir solicitudes' : 'Activate para recibir viajes'}
            </p>
          </div>
          <div
            onClick={() => { setActivo(!activo); setSolicitud(null); }}
            style={{
              width: '56px', height: '32px',
              borderRadius: '16px',
              background: activo
                ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)'
                : '#2A2A2E',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0 4px',
              justifyContent: activo ? 'flex-end' : 'flex-start',
            }}
          >
            <div style={{
              width: '24px', height: '24px',
              borderRadius: '50%',
              background: '#FFFFFF',
            }}/>
          </div>
        </div>

        {activo && !solicitud && (
          <button onClick={simularSolicitud} style={{
            width: '100%',
            padding: '16px',
            background: '#1A1A1E',
            border: '1px dashed #FF7A2F',
            borderRadius: '16px',
            color: '#FF7A2F',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: '16px',
          }}>
            Simular solicitud de viaje
          </button>
        )}

        {solicitud && (
          <div style={{
            background: '#1A1A1E',
            borderRadius: '20px',
            padding: '20px',
            border: '1px solid #FF7A2F',
          }}>
            <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>
              NUEVA SOLICITUD
            </p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0 0 4px' }}>
              {solicitud.pasajero}
            </p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 4px' }}>
              {solicitud.origen}
            </p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 16px' }}>
              {solicitud.destino}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>DISTANCIA</p>
                <p style={{ color: '#FFFFFF', fontWeight: 'bold', margin: '4px 0 0' }}>{solicitud.distancia}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p>
                <p style={{ color: '#2ECC71', fontWeight: '900', fontSize: '18px', margin: '4px 0 0' }}>{solicitud.tarifa}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setSolicitud(null)} style={{
                flex: 1, padding: '14px',
                background: '#141416',
                border: 'none', borderRadius: '14px',
                color: '#555', fontSize: '14px',
                fontWeight: 'bold', cursor: 'pointer',
              }}>
                Rechazar
              </button>
              <button onClick={() => setViaje(true)} style={{
                flex: 2, padding: '14px',
                background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
                border: 'none', borderRadius: '14px',
                color: '#141416', fontSize: '14px',
                fontWeight: 'bold', cursor: 'pointer',
              }}>
                Aceptar viaje
              </button>
            </div>
          </div>
        )}

        <div style={{
          background: '#1A1A1E',
          borderRadius: '20px',
          padding: '20px',
          marginTop: '16px',
          display: 'flex',
          justifyContent: 'space-around',
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>VIAJES</p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '4px 0 0' }}>8</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>HORAS</p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '4px 0 0' }}>5.2</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#555', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>CALIFIC.</p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '4px 0 0' }}>4.9</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppConductor;