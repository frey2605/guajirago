import React, { useState, useEffect } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import AppConductor from './AppConductor';
import MenuLateral from './MenuLateral';
import { auth, db, storage } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
const MARCAS_VEHICULO = [
  'AKT', 'Auteco', 'Bajaj', 'BMW', 'BYD', 'Chery', 'Chevrolet',
  'Citroen', 'Ford', 'Foton', 'Hero', 'Honda', 'Hyundai', 'JAC',
  'JMC', 'Kia', 'Mazda', 'Mercedes Benz', 'Mitsubishi', 'Nissan',
  'Peugeot', 'Renault', 'Subaru', 'Suzuki', 'Toyota', 'TVS',
  'Volkswagen', 'Yamaha',
  'Otra',
];
const COLORES_VEHICULO = [
  { nombre: 'Amarillo', hex: '#FDD835' },
  { nombre: 'Azul', hex: '#1E88E5' },
  { nombre: 'Beige', hex: '#D7CCA3' },
  { nombre: 'Blanco', hex: '#FFFFFF' },
  { nombre: 'Dorado', hex: '#C9A227' },
  { nombre: 'Gris', hex: '#9E9E9E' },
  { nombre: 'Naranja', hex: '#FB8C00' },
  { nombre: 'Negro', hex: '#1A1A1A' },
  { nombre: 'Plateado', hex: '#C0C0C0' },
  { nombre: 'Rojo', hex: '#E53935' },
  { nombre: 'Verde', hex: '#43A047' },
  { nombre: 'Vinotinto', hex: '#7B1E2B' },
];
const STORAGE_KEY = 'guajirago_usuario';

function guardarLocal(datos) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(datos)); } catch (e) {}
}

function cargarLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; }
}

function PantallaModulos({ nombre, onSeleccionar, onVolver, onCerrarSesion }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <MenuLateral nombre={nombre} onCerrarSesion={onCerrarSesion} />
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
      </div>
  );
}

function PantallaRol({ nombre, onSeleccionar, onVolver, onCerrarSesion }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <MenuLateral nombre={nombre} onCerrarSesion={onCerrarSesion} />
      <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '120px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
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

function PantallaDatosConductor({ nombre, celular, onGuardar, onVolver, onCerrarSesion }) {
  const [tipoVehiculo, setTipoVehiculo] = React.useState('');
  const [placa, setPlaca] = React.useState('');
  const [marca: marcaFinal, setMarca] = React.useState('');
  const [listaMarcaAbierta, setListaMarcaAbierta] = React.useState(false);
  const [marcaOtra, setMarcaOtra] = React.useState('');
  const [modelo, setModelo] = React.useState('');
  const [color, setColor] = React.useState('');
  const [listaColorAbierta, setListaColorAbierta] = React.useState(false);
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
    if (!tipoVehiculo || !placa || !marca || !modelo || !color || !documento || !telefono) { setError('Por favor completa todos los campos'); return; }
    if (marca === 'Otra' && !marcaOtra.trim()) { setError('Escribe la marca del vehículo'); return; }
    if (!fotoConductor || !fotoCedula) { setError('Debes subir la foto del conductor y la foto de la cédula'); return; }
    setCargando(true); setError('');
    try {
      const user = auth.currentUser;
      if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); setCargando(false); return; }
      const urlFotoConductor = await subirFoto(fotoConductor, 'conductor', user.uid);
      const urlFotoCedula = await subirFoto(fotoCedula, 'cedula', user.uid);
      const marcaFinal = marca === 'Otra' ? marcaOtra.trim() : marca;
      const vehiculo = `${marcaFinal} ${modelo}`;
      await setDoc(doc(db, 'usuarios', user.uid), {
        tipo: 'conductor',
        tipoVehiculo,
        placa: placa.toUpperCase(),
        marca: marcaFinal,
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
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <MenuLateral nombre={nombre} onCerrarSesion={onCerrarSesion} />
      <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '120px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span style={{ fontSize: '48px' }}>🚗</span>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '12px 0 4px' }}>Datos del conductor</h2>
        <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0' }}>Completa tu perfil de conductor</p>
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🚖</span>
        <select value={tipoVehiculo} onChange={e => setTipoVehiculo(e.target.value)} style={{ ...estiloInput, cursor: 'pointer' }}>
          <option value="" style={{ background: '#1A1A1E' }}>Tipo de vehículo</option>
          <option value="Taxi" style={{ background: '#1A1A1E' }}>🚗 Taxi</option>
          <option value="Mototaxi" style={{ background: '#1A1A1E' }}>🏍️ Mototaxi</option>
        </select>
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>📞</span>
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Número de teléfono" type="tel" style={estiloInput} />
      </div>
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🚘</span>
        <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="Placa del vehículo (ej: GUA 123)" style={estiloInput} />
      </div>
      <div onClick={() => setListaMarcaAbierta(true)} style={{ ...estiloCampo, cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>🏭</span>
        <span style={{ color: marca ? '#FFFFFF' : '#AAAAAA', fontSize: '16px', flex: 1 }}>{marca || 'Marca del vehículo'}</span>
        <span style={{ color: '#AAAAAA', fontSize: '14px' }}>▼</span>
      </div>
      {marca === 'Otra' && (
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>✏️</span>
          <input value={marcaOtra} onChange={e => setMarcaOtra(e.target.value)} placeholder="Escribe la marca" style={estiloInput} />
        </div>
      )}

      {listaMarcaAbierta && (
        <div onClick={() => setListaMarcaAbierta(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '70vh', overflowY: 'auto' }}>
            <p style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '900', margin: '0 0 16px', textAlign: 'center' }}>Escoge la marca</p>
            {MARCAS_VEHICULO.map(m => (
              <div key={m} onClick={() => { setMarca(m); if (m !== 'Otra') setMarcaOtra(''); setListaMarcaAbierta(false); }} style={{ display: 'flex', alignItems: 'center', padding: '14px', borderRadius: '12px', cursor: 'pointer', background: marca === m ? '#2A2A2E' : 'transparent', marginBottom: '4px' }}>
                <span style={{ color: '#FFFFFF', fontSize: '16px' }}>{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>📅</span>
        <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Modelo (ej: 2020)" style={estiloInput} />
      </div>
      <div onClick={() => setListaColorAbierta(true)} style={{ ...estiloCampo, cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>🎨</span>
        {color ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: COLORES_VEHICULO.find(c => c.nombre === color)?.hex || '#888', border: '1px solid #555', flexShrink: 0 }} />
            <span style={{ color: '#FFFFFF', fontSize: '16px' }}>{color}</span>
          </div>
        ) : (
          <span style={{ color: '#AAAAAA', fontSize: '16px', flex: 1 }}>Color del vehículo</span>
        )}
        <span style={{ color: '#AAAAAA', fontSize: '14px' }}>▼</span>
      </div>

      {listaColorAbierta && (
        <div onClick={() => setListaColorAbierta(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '70vh', overflowY: 'auto' }}>
            <p style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '900', margin: '0 0 16px', textAlign: 'center' }}>Escoge el color</p>
            {COLORES_VEHICULO.map(c => (
              <div key={c.nombre} onClick={() => { setColor(c.nombre); setListaColorAbierta(false); }} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '12px', cursor: 'pointer', background: color === c.nombre ? '#2A2A2E' : 'transparent', marginBottom: '4px' }}>
                <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: c.hex, border: '1px solid #555', flexShrink: 0 }} />
                <span style={{ color: '#FFFFFF', fontSize: '16px' }}>{c.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={estiloCampo}>
        <span style={{ fontSize: '20px' }}>🪪</span>
        <input value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Documento de identidad" type="tel" style={estiloInput} />
      </div>

      <label style={{ ...estiloCampo, cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>📸</span>
        <span style={{ color: fotoConductor ? '#2ECC71' : '#AAAAAA', fontSize: '15px', flex: 1 }}>
          {fotoConductor ? '✓ Foto del conductor lista' : 'Subir foto del conductor'}
        </span>
        <input type="file" accept="image/*" onChange={e => setFotoConductor(e.target.files[0])} style={{ display: 'none' }} />
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
  if (screen === 'modulos') return <PantallaModulos nombre={nombreUsuario} onSeleccionar={handleSeleccionarModulo} onVolver={() => setScreen('login')} onCerrarSesion={handleCerrarSesion} />;
  if (screen === 'rol') return <PantallaRol nombre={nombreUsuario} onSeleccionar={handleSeleccionarRol} onVolver={() => setScreen('modulos')} onCerrarSesion={handleCerrarSesion} />;
  if (screen === 'datos_conductor') return <PantallaDatosConductor nombre={nombreUsuario} celular={telefonoUsuario} onGuardar={handleDatosConductor} onVolver={() => setScreen('rol')} onCerrarSesion={handleCerrarSesion} />;

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