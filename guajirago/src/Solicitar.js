import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

const GOOGLE_MAPS_KEY = 'AIzaSyDCo-KBq_QWq18FbKy3otxItajq8cKvtXY';
const centroRiohacha = { lat: 11.5444, lng: -72.9072 };

function Solicitar({ tipo, onVolver }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [pantalla, setPantalla] = useState('solicitar');
  const [cargando, setCargando] = useState(false);
  const [viajeId, setViajeId] = useState(null);
  const [viaje, setViaje] = useState(null);
  const [error, setError] = useState('');
  const [ubicacion, setUbicacion] = useState(centroRiohacha);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUbicacion(centroRiohacha)
      );
    }
  }, []);

  useEffect(() => {
    if (!viajeId) return;
    const unsub = onSnapshot(doc(db, 'viajes', viajeId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setViaje(data);
        if (data.estado === 'aceptado') setPantalla('aceptado');
      }
    });
    return () => unsub();
  }, [viajeId]);

  const solicitarViaje = async () => {
    if (!origen || !destino) {
      setError('Por favor escribe el origen y destino');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const user = auth.currentUser;
      const docRef = await addDoc(collection(db, 'viajes'), {
        pasajeroId: user.uid,
        pasajeroEmail: user.email,
        tipo: tipo,
        origen: origen,
        destino: destino,
        estado: 'esperando',
        tarifa: '$5.000',
        fechaSolicitud: new Date().toISOString(),
      });
      setViajeId(docRef.id);
      setPantalla('esperando');
    } catch (err) {
      setError('Error al solicitar viaje. Intenta de nuevo.');
    }
    setCargando(false);
  };

  if (pantalla === 'esperando') {
    return (
      <div style={{
        backgroundColor: '#141416', minHeight: '100vh',
        fontFamily: 'Arial, sans-serif', display: 'flex',
        flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>
          {tipo === 'Taxi' ? '🚗' : '🏍️'}
        </div>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', margin: '0 0 8px', textAlign: 'center' }}>
          Buscando conductor...
        </h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>
          {origen} → {destino}
        </p>
        <p style={{ color: '#FF7A2F', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>
          Espera, un conductor va a aceptar tu viaje
        </p>
        <div style={{
          width: '60px', height: '4px',
          background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
          borderRadius: '2px', marginBottom: '32px',
        }}/>
        <button onClick={onVolver} style={{
          background: 'transparent', border: '1px solid #2A2A2E',
          borderRadius: '14px', color: '#555',
          fontSize: '14px', padding: '14px 32px', cursor: 'pointer',
        }}>
          Cancelar
        </button>
      </div>
    );
  }

  if (pantalla === 'aceptado') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
        <LoadScript googleMapsApiKey={GOOGLE_MAPS_KEY}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '300px' }}
            center={ubicacion}
            zoom={15}
            options={{
              styles: [
                { elementType: 'geometry', stylers: [{ color: '#1A1A1E' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#FFFFFF' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#141416' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2A2E' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
              ],
            }}
          >
            <Marker position={ubicacion} label={{ text: '📍', fontSize: '24px' }} />
            <Marker position={centroRiohacha} label={{ text: tipo === 'Taxi' ? '🚗' : '🏍️', fontSize: '24px' }} />
          </GoogleMap>
        </LoadScript>

        <div style={{
          margin: '-20px 16px 0',
          background: '#1A1A1E', borderRadius: '24px',
          padding: '24px', position: 'relative', zIndex: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{
            background: '#141416', borderRadius: '12px',
            padding: '10px 16px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ECC71' }}/>
            <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold' }}>
              🎉 ¡Conductor en camino!
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '26px',
            }}>👨🏽</div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>
                {viaje?.conductorNombre || 'Tu conductor'}
              </p>
              <p style={{ color: '#2ECC71', fontSize: '13px', margin: '4px 0 0' }}>
                En camino hacia ti
              </p>
            </div>
          </div>

          <div style={{
            background: '#141416', borderRadius: '16px',
            padding: '16px', marginBottom: '16px',
          }}>
            <p style={{ color: '#555', fontSize: '11px', margin: '0 0 4px', letterSpacing: '1px' }}>RUTA</p>
            <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0' }}>
              📍 {origen} → 🏁 {destino}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TIPO</p>
              <p style={{ color: '#FFFFFF', fontWeight: 'bold', margin: '4px 0 0' }}>{tipo}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p>
              <p style={{ color: '#2ECC71', fontWeight: '900', fontSize: '18px', margin: '4px 0 0' }}>$5.000</p>
            </div>
          </div>

          <button onClick={onVolver} style={{
            width: '100%', padding: '18px',
            background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
            border: 'none', borderRadius: '16px',
            color: '#141416', fontSize: '18px',
            fontWeight: '900', cursor: 'pointer',
          }}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{
        background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
        padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <button onClick={onVolver} style={{
          background: 'none', border: 'none', color: '#FF7A2F', fontSize: '24px', cursor: 'pointer',
        }}>←</button>
        <h2 style={{ color: '#FFFFFF', margin: '0', fontSize: '20px' }}>Solicitar {tipo}</h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        <div style={{
          background: '#1A1A1E', borderRadius: '16px',
          padding: '16px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#2ECC71', flexShrink: 0 }}/>
          <input value={origen} onChange={e => setOrigen(e.target.value)}
            placeholder="¿Dónde estás?"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
          />
        </div>

        <div style={{
          background: '#1A1A1E', borderRadius: '16px',
          padding: '16px', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: '#FF7A2F', flexShrink: 0 }}/>
          <input value={destino} onChange={e => setDestino(e.target.value)}
            placeholder="¿A dónde vas?"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
          />
        </div>

        <div style={{
          background: '#1A1A1E', borderRadius: '16px',
          padding: '16px', marginBottom: '24px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ color: '#555', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>TARIFA ESTIMADA</p>
            <p style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '4px 0 0' }}>$5.000 COP</p>
          </div>
          <span style={{ fontSize: '32px' }}>{tipo === 'Taxi' ? '🚗' : '🏍️'}</span>
        </div>

        {error && (
          <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>
        )}

        <button onClick={solicitarViaje} style={{
          width: '100%', padding: '18px',
          background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
          border: 'none', borderRadius: '16px',
          color: cargando ? '#555' : '#141416',
          fontSize: '18px', fontWeight: '900',
          cursor: cargando ? 'default' : 'pointer',
        }}>
          {cargando ? 'Enviando...' : `Solicitar ${tipo} ahora`}
        </button>
      </div>
    </div>
  );
}

export default Solicitar;