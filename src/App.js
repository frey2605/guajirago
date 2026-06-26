import React, { useState, useEffect } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import AppConductor from './AppConductor';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const STORAGE_KEY = 'guajirago_usuario';

function guardarLocal(datos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch (e) {}
}

function cargarLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
}

function PantallaModulos({ onSeleccionar, onVolver }) {
  const [menuAbierto, setMenuAbierto] = React.useState(false);
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <div onClick={() => setMenuAbierto(true)} style={{ position: 'absolute', top: '18px', left: '20px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', lineHeight: '1' }}>☰</span> Menú</div>
      <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '120px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
      <h1 style={{ fontSize: '42px', color: '#FFFFFF', margin: '0', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-1px', textAlign: 'center' }}>Guajira</h1>
      <h1 style={{ fontSize: '56px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 16px', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-2px' }}>GO</h1>
      <p style={{ color: '#AAAAAA', fontSize: '14px', letterSpacing: '3px', marginBottom: '32px', textAlign: 'center' }}>¿QUÉ QUIERES HACER?</p>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div onClick={() => onSeleccionar('transporte')} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #FF7A2F' }}>
          <span style={{ fontSize: '40px' }}>🚗</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Transporte y movilidad</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Taxi y mototaxi en Riohacha</p>
          </div>
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #2A2A2E', opacity: 0.4 }}>
          <span style={{ fontSize: '40px' }}>🛒</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Más módulos</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Próximamente</p>
          </div>
        </div>
      </div>
      {menuAbierto && (
        <div onClick={() => setMenuAbierto(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '80%', maxWidth: '320px', background: '#1A1A1E', padding: '24px 20px', boxShadow: '2px 0 20px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0' }}>Menú</h2>
              <span onClick={() => setMenuAbierto(false)} style={{ color: '#FFFFFF', fontSize: '24px', cursor: 'pointer' }}>✕</span>
            </div>
            <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0' }}>Aquí irán las opciones...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PantallaRol({ nombre, onSeleccionar, onVolver }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '20px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
      <p style={{ color: '#AAAAAA', fontSize: '14px', letterSpacing: '3px', marginBottom: '8px', textAlign: 'center' }}>BIENVENIDO</p>
      <h2 style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: '900', margin: '0 0 32px', textAlign: 'center' }}>{nombre || 'Usuario'}</h2>
      <p style={{ color: '#AAAAAA', fontSize: '14px', letterSpacing: '2px', marginBottom: '24px', textAlign: 'center' }}>¿CÓMO VAS A USAR GUAJIRAGO?</p>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div onClick={() => onSeleccionar('pasajero')} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #2A2A2E' }}>
          <span style={{ fontSize: '40px' }}>🙋</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Soy pasajero</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Quiero solicitar taxi o mototaxi</p>
          </div>
        </div>
        <div onClick={() => onSeleccionar('conductor')} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #2A2A2E' }}>
          <span style={{ fontSize: '40px' }}>🚗</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Soy conductor</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Quiero recibir y hacer viajes</p>
          </div>
        </div>
      </div>
      </div>
  );
}

function PantallaDatosConductor({ nombre, celular, onGuardar, onVolver }) {
  const [placa, setPlaca] = React.useState('');
  const [marca, setMarca] = React.useState('');
  const [modelo, setModelo] = React.useState('');
  const [color, setColor] = React.useState('');
  const [documento, setDocumento] = React.useState('');
  const [telefono, setTelefono] = React.useState(celular || '');
  const [fotoConductor, setFotoConductor] = React.useState(null);
  const [fotoCedula, setFotoCedula] = React.useState(null);
  const [error, setError] = React.useState('');
  const [cargando, setCargando] = React.useState(false);

  const subirFoto = async (archivo, carpeta, uid) => {
    const refArchivo = ref(storage, `conductores/${uid}/${carpeta}_${Date.now()}.jpg`);
    await uploadBytes(refArchivo, archivo);
    return await getDownloadURL(refArchivo);
  };

  const guardar = async () => {
    if (!placa || !marca || !modelo || !color || !documento || !telefono) { setError('Por favor completa todos los campos'); return; }
    if (!fotoConductor || !fotoCedula) { setError('Debes subir la foto del conductor y la foto de la cédula'); return; }
    setCargando(true); setError('');
    try {
      const user = auth.currentUser;
      if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); setCargando(false); return; }
      const urlFotoConductor = await subirFoto(fotoConductor, 'conductor', user.uid);
      const urlFotoCedula = await subirFoto(fotoCedula, 'cedula', user.uid);
      const vehiculo = `${marca} ${modelo}`;
      await setDoc(doc(db, 'usuarios', user.uid), {
        tipo: 'conductor',
        placa: placa.toUpperCase(),
        marca,
        modelo,
        color,
        documento,
        vehiculo,
        telefono,
        fotoConductor: urlFotoConductor,
        fotoCedula: urlFotoCedula,
      }, { merge: true });
      onGuardar(placa.toUpperCase(), vehiculo, telefono);
    } catch (e) { setError('Error al guardar. Revisa tu conexión e intenta de nuevo'); }
    setCargando(false);
  };

  const estiloCampo = { background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' };
  const estiloInput = { background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' };

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span style={{ fontSize: '48px' }}>🚗</span>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '12px 0 4px' }}>Datos del conductor</h2>
        <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0' }}>Completa tu perfil de conductor</p>
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>📞</span>
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Número de teléfono" type="tel" style={estiloInput} />
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🚘</span>
        <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="Placa del vehículo (ej: GUA 123)" style={estiloInput} />
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🏭</span>
        <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Marca (ej: Chevrolet)" style={estiloInput} />
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>📅</span>
        <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Modelo (ej: 2020)" style={estiloInput} />
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🎨</span>
        <input value={color} onChange={e => setColor(e.target.value)} placeholder="Color del vehículo" style={estiloInput} />
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🪪</span>
        <input value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Documento de identidad" type="tel" style={estiloInput} />
      </div>

      <label style={{ ...estiloCampo, cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>📸</span>
        <span style={{ color: fotoConductor ? '#2ECC71' : '#AAAAAA', fontSize: '15px', flex: 1 }}>
          {fotoConductor ? '✓ Foto del conductor lista' : 'Subir foto del conductor'}
        </span>
        <input type="file" accept="image/*" capture="user" onChange={e => setFotoConductor(e.target.files[0])} style={{ display: 'none' }} />
      </label>

      <label style={{ ...estiloCampo, cursor: 'pointer', marginBottom: '20px' }}>
        <span style={{ fontSize: '20px' }}>🪪</span>
        <span style={{ color: fotoCedula ? '#2ECC71' : '#AAAAAA', fontSize: '15px', flex: 1 }}>
          {fotoCedula ? '✓ Foto de la cédula lista' : 'Subir foto de la cédula'}
        </span>
        <input type="file" accept="image/*" onChange={e => setFotoCedula(e.target.files[0])} style={{ display: 'none' }} />
      </label>

      {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
      <button onClick={guardar} disabled={cargando} style={{ width: '100%', padding: '18px', background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: cargando ? '#AAAAAA' : '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer', marginBottom: '12px' }}>
        {cargando ? 'Guardando...' : 'Entrar a GuajiraGo'}
      </button>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', color: '#AAAAAA', fontSize: '13px', cursor: 'pointer' }}>Volver</button>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('splash');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [telefonoUsuario, setTelefonoUsuario] = useState('');
  const [placaUsuario, setPlacaUsuario] = useState('');
  const [vehiculoUsuario, setVehiculoUsuario] = useState('');

  useEffect(() => {
    const local = cargarLocal();
    if (local && local.tipo) {
      setTipoUsuario(local.tipo);
      setNombreUsuario(local.nombre || '');
      setTelefonoUsuario(local.telefono || local.celular || '');
      setPlacaUsuario(local.placa || '');
      setVehiculoUsuario(local.vehiculo || '');
      setTimeout(() => setScreen('modulos'), 2000);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'usuarios', user.uid));
          if (snap.exists()) {
            const datos = snap.data();
            setNombreUsuario(datos.nombre || '');
            setTelefonoUsuario(datos.telefono || datos.celular || '');
            setPlacaUsuario(datos.placa || '');
            setVehiculoUsuario(datos.vehiculo || '');
            setTipoUsuario(datos.tipo || '');
            guardarLocal(datos);
            setTimeout(() => setScreen('modulos'), 2000);
            return;
          }
        } catch (e) {}
      }
      setTimeout(() => setScreen('login'), 2000);
    });
    return () => unsub();
  }, []);

  const handleEntrar = (tipo, nombre, celular, placa, vehiculo) => {
    setNombreUsuario(nombre);
    setTelefonoUsuario(celular);
    setPlacaUsuario(placa);
    setVehiculoUsuario(vehiculo);
    setTipoUsuario(tipo);
    guardarLocal({ tipo, nombre, celular, placa, vehiculo });
    setScreen('modulos');
  };

  const handleSeleccionarModulo = (modulo) => {
    if (modulo === 'transporte') {
      setScreen('rol');
    }
  };

  const handleSeleccionarRol = async (rol) => {
    setTipoUsuario(rol);
    if (rol === 'pasajero') {
      guardarLocal({ tipo: 'pasajero', nombre: nombreUsuario, celular: telefonoUsuario, placa: placaUsuario, vehiculo: vehiculoUsuario });
      setScreen('home');
    } else {
      if (placaUsuario && vehiculoUsuario) {
        setScreen('home');
      } else {
        setScreen('datos_conductor');
      }
    }
  };

  const handleDatosConductor = (placa, vehiculo, telefono) => {
    setPlacaUsuario(placa);
    setVehiculoUsuario(vehiculo);
    setTelefonoUsuario(telefono);
    guardarLocal({ tipo: 'conductor', nombre: nombreUsuario, celular: telefono, placa, vehiculo });
    setScreen('home');
  };

  const handleCerrarSesion = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setScreen('login');
  };

  if (screen === 'splash') return <Splash onFinish={() => {}} />;
  if (screen === 'login') return <Login onEntrar={handleEntrar} />;
  if (screen === 'modulos') return <PantallaModulos onSeleccionar={handleSeleccionarModulo} onVolver={() => setScreen('login')} />;
  if (screen === 'rol') return <PantallaRol nombre={nombreUsuario} onSeleccionar={handleSeleccionarRol} onVolver={() => setScreen('modulos')} />;
  if (screen === 'datos_conductor') return <PantallaDatosConductor nombre={nombreUsuario} celular={telefonoUsuario} onGuardar={handleDatosConductor} onVolver={() => setScreen('rol')} />;

  if (screen === 'home') {
    if (tipoUsuario === 'conductor') {
      return (
        <AppConductor
          nombre={nombreUsuario}
          telefono={telefonoUsuario}
          placa={placaUsuario}
          vehiculo={vehiculoUsuario}
          onCerrarSesion={handleCerrarSesion}
          onVolver={() => setScreen('rol')}
        />
      );
    }
    return <Home nombre={nombreUsuario} onCerrarSesion={handleCerrarSesion} onVolver={() => setScreen('rol')} />;
  }
}

export default App;