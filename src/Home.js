import React, { useState, useEffect, useRef } from 'react';
import Solicitar from './Solicitar';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';

const ICONOS_FAVORITOS = ['🏠', '💼', '❤️', '⭐', '🏥', '🏫', '🛒', '🏖️', '⛪', '🏋️'];

const BOUNDS_RIOHACHA = { north: 11.7, south: 11.3, east: -72.6, west: -73.0 };

function ModalFavorito({ onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [icono, setIcono] = useState('⭐');
  const inputDireccionRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    if (!inputDireccionRef.current || !window.google) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputDireccionRef.current, {
      componentRestrictions: { country: 'co' },
      bounds: new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(BOUNDS_RIOHACHA.south, BOUNDS_RIOHACHA.west),
        new window.google.maps.LatLng(BOUNDS_RIOHACHA.north, BOUNDS_RIOHACHA.east)
      ),
      strictBounds: true,
      types: ['establishment', 'geocode'],
    });
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place && place.name) setDireccion(place.name);
    });
  }, []);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#1A1A1E', borderRadius: '24px 24px 0 0', padding: '28px 24px', width: '100%', maxWidth: '480px' }}>
        <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '900', margin: '0 0 20px', textAlign: 'center' }}>Agregar lugar favorito</p>
        <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '0 0 10px', letterSpacing: '1px' }}>ÍCONO</p>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {ICONOS_FAVORITOS.map(i => (
            <div key={i} onClick={() => setIcono(i)} style={{ width: '44px', height: '44px', borderRadius: '12px', background: icono === i ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#141416', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', cursor: 'pointer', border: icono === i ? 'none' : '1px solid #2A2A2E' }}>
              {i}
            </div>
          ))}
        </div>
        <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '0 0 8px', letterSpacing: '1px' }}>NOMBRE (ej: Casa, Trabajo, Mamá)</p>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="¿Cómo lo llamas?" style={{ width: '100%', padding: '14px 16px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FFFFFF', fontSize: '16px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }} />
        <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '0 0 8px', letterSpacing: '1px' }}>DIRECCIÓN</p>
        <input ref={inputDireccionRef} value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Escribe la dirección o lugar" style={{ width: '100%', padding: '14px 16px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FFFFFF', fontSize: '16px', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: '14px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#AAAAAA', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => nombre && direccion && onGuardar({ nombre, direccion, icono })} style={{ flex: 2, padding: '14px', background: nombre && direccion ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', border: 'none', borderRadius: '14px', color: nombre && direccion ? '#141416' : '#AAAAAA', fontSize: '14px', fontWeight: '900', cursor: nombre && direccion ? 'pointer' : 'default' }}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function Historial({ onVolver }) {
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, 'viajes'), where('pasajeroId', '==', user.uid), limit(50));
        const snap = await getDocs(q);
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
        setViajes(lista);
      } catch (e) {}
      setCargando(false);
    };
    cargar();
  }, []);

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', color: '#FF7A2F', fontSize: '24px', cursor: 'pointer' }}>←</button>
        <h2 style={{ color: '#FFFFFF', margin: '0', fontSize: '20px', fontWeight: '900' }}>Mis viajes</h2>
      </div>
      <div style={{ padding: '20px' }}>
        {cargando && <p style={{ color: '#AAAAAA', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>}
        {!cargando && viajes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '60px', margin: '0 0 16px' }}>🚗</p>
            <p style={{ color: '#AAAAAA', fontSize: '15px' }}>Aún no tienes viajes</p>
          </div>
        )}
        {viajes.map((v) => {
          const fecha = v.fechaSolicitud ? new Date(v.fechaSolicitud).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          const cancelado = v.estado === 'cancelado';
          return (
            <div key={v.id} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: `1px solid ${cancelado ? '#2A1A1A' : '#1A2A1A'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>{v.tipo === 'Taxi' ? '🚗' : '🏍️'}</span>
                  <div>
                    <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0' }}>{v.tipo}</p>
                    <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '3px 0 0' }}>{fecha}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: cancelado ? '#FF4444' : '#2ECC71', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>{cancelado ? 'Cancelado' : 'Completado'}</p>
                  <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '900', margin: '4px 0 0' }}>{v.tarifa}</p>
                </div>
              </div>
              <div style={{ background: '#141416', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ECC71', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0' }}>{v.origen}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FF7A2F', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0' }}>{v.destino}</p>
                </div>
              </div>
              {v.conductorNombre && <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '10px 0 0' }}>Conductor: <span style={{ color: '#FFCF4D' }}>{v.conductorNombre}</span></p>}
              {cancelado && v.razonCancelacion && <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '4px 0 0' }}>Razón: {v.razonCancelacion}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STORAGE_FAVORITOS = 'guajirago_favoritos';
const STORAGE_RECIENTES = 'guajirago_recientes';

function cargarFavoritos() { try { return JSON.parse(localStorage.getItem(STORAGE_FAVORITOS)) || []; } catch(e) { return []; } }
function guardarFavoritos(f) { try { localStorage.setItem(STORAGE_FAVORITOS, JSON.stringify(f)); } catch(e) {} }
function cargarRecientes() { try { return JSON.parse(localStorage.getItem(STORAGE_RECIENTES)) || []; } catch(e) { return []; } }
function guardarReciente(destino) {
  try {
    const recientes = cargarRecientes().filter(r => r !== destino);
    recientes.unshift(destino);
    localStorage.setItem(STORAGE_RECIENTES, JSON.stringify(recientes.slice(0, 5)));
  } catch(e) {}
}

function Home({ nombre, onCerrarSesion, onVolver }) {
  const [pantalla, setPantalla] = useState('home');
  const [tipoSeleccionado, setTipoSeleccionado] = useState('');
  const [destinoPredefinido, setDestinoPredefinido] = useState('');
  const [favoritos, setFavoritos] = useState(cargarFavoritos());
  const [recientes, setRecientes] = useState(cargarRecientes());
  const [mostrarModalFavorito, setMostrarModalFavorito] = useState(false);

  const cerrarSesion = async () => { try { await signOut(auth); } catch(e) {} if (onCerrarSesion) onCerrarSesion(); else window.location.reload(); };

  const irASolicitar = (tipo, destino = '') => {
    if (destino) guardarReciente(destino);
    setRecientes(cargarRecientes());
    setTipoSeleccionado(tipo);
    setDestinoPredefinido(destino);
    setPantalla('solicitar');
  };

  const agregarFavorito = ({ nombre, direccion, icono }) => {
    const nuevos = [...favoritos, { nombre, direccion, icono }];
    setFavoritos(nuevos);
    guardarFavoritos(nuevos);
    setMostrarModalFavorito(false);
  };

  const eliminarFavorito = (i) => {
    const nuevos = favoritos.filter((_, idx) => idx !== i);
    setFavoritos(nuevos);
    guardarFavoritos(nuevos);
  };

  if (pantalla === 'solicitar') {
    return <Solicitar tipo={tipoSeleccionado} destinoInicial={destinoPredefinido} onVolver={() => setPantalla('home')} />;
  }

  if (pantalla === 'historial') {
    return <Historial onVolver={() => setPantalla('home')} />;
  }

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {mostrarModalFavorito && <ModalFavorito onGuardar={agregarFavorito} onCerrar={() => setMostrarModalFavorito(false)} />}

      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative' }}>
        <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '20px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
        <div style={{ marginTop: '48px' }}>
          <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '0', letterSpacing: '2px' }}>UBICACIÓN</p>
          <p style={{ color: '#FFFFFF', fontSize: '16px', margin: '4px 0 0', fontWeight: 'bold' }}>📍 Riohacha, La Guajira</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '22px', margin: '12px 0 0', fontWeight: '900' }}>Hola, {nombre || 'pasajero'} 👋</h2>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <p style={{ color: '#AAAAAA', fontSize: '11px', letterSpacing: '3px', margin: '0 0 12px' }}>¿QUÉ NECESITAS?</p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
          <div onClick={() => irASolicitar('Taxi')} style={{ flex: 1, background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '20px', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,122,47,0.3)' }}>
            <span style={{ fontSize: '44px' }}>🚗</span>
            <p style={{ color: '#141416', fontWeight: '900', fontSize: '18px', margin: '0' }}>Taxi</p>
            <p style={{ color: 'rgba(20,20,22,0.7)', fontSize: '12px', margin: '0', fontWeight: 'bold' }}>Disponible ahora</p>
          </div>
          <div onClick={() => irASolicitar('Mototaxi')} style={{ flex: 1, background: 'linear-gradient(135deg, #D6357E, #FF7A2F)', borderRadius: '20px', padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(214,53,126,0.3)' }}>
            <span style={{ fontSize: '44px' }}>🏍️</span>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Mototaxi</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', margin: '0', fontWeight: 'bold' }}>Disponible ahora</p>
          </div>
        </div>

        

        

        
      </div>
    </div>
  );
}

export default Home;