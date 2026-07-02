import React, { useState, useEffect } from 'react';
import Splash from './Splash';
import Login from './Login';
import Home from './Home';
import SolicitarMensajeria from './SolicitarMensajeria';
import AppConductor from './AppConductor';
import MenuLateral from './MenuLateral';
import MiPerfil from './MiPerfil';
import Ganancias from './Ganancias';
import Seguridad from './Seguridad';
import MisViajes from './MisViajes';
import AyudaSoporte from './AyudaSoporte';
import Configuracion from './Configuracion';
import Promociones from './Promociones';
import Creditos from './Creditos';
import Anuncio from './Anuncio';
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

function PantallaModulos({ nombre, foto, onSeleccionar, onVolver, onCerrarSesion, onIrPerfil, onIrGanancias, onIrSeguridad, onIrViajes, onIrCreditos, onIrAyuda, onIrConfig, onIrPromociones }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <MenuLateral nombre={nombre} foto={foto} onIrPerfil={onIrPerfil} onIrGanancias={onIrGanancias} onIrSeguridad={onIrSeguridad} onIrViajes={onIrViajes} onIrCreditos={onIrCreditos} onIrAyuda={onIrAyuda} onIrConfig={onIrConfig} onIrPromociones={onIrPromociones} onCerrarSesion={onCerrarSesion} />
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
        <div onClick={() => onSeleccionar('mensajeria')} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #FF7A2F' }}>
          <span style={{ fontSize: '40px' }}>📦</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Mensajería y Mandados</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Envía paquetes y haz mandados en moto</p>
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

function PantallaRol({ nombre, foto, onSeleccionar, onVolver, onCerrarSesion, onIrPerfil, onIrGanancias, onIrSeguridad, onIrViajes, onIrCreditos, onIrAyuda, onIrConfig, onIrPromociones }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <MenuLateral nombre={nombre} foto={foto} onIrPerfil={onIrPerfil} onIrGanancias={onIrGanancias} onIrSeguridad={onIrSeguridad} onIrViajes={onIrViajes} onIrCreditos={onIrCreditos} onIrAyuda={onIrAyuda} onIrConfig={onIrConfig} onIrPromociones={onIrPromociones} onCerrarSesion={onCerrarSesion} />
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

function PantallaMensajeria({ nombre, onEnviar, onDomiciliario, onVolver }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '20px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
      <span style={{ fontSize: '52px', marginBottom: '8px' }}>📦</span>
      <h2 style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: '900', margin: '0 0 4px', textAlign: 'center' }}>Mensajería y Mandados</h2>
      <p style={{ color: '#AAAAAA', fontSize: '14px', letterSpacing: '2px', margin: '0 0 28px', textAlign: 'center' }}>¿QUÉ QUIERES HACER?</p>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div onClick={onEnviar} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #FF7A2F' }}>
          <span style={{ fontSize: '40px' }}>📦</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Quiero enviar algo</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Enviar un paquete o pedir un mandado</p>
          </div>
        </div>
        <div onClick={onDomiciliario} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #2A2A2E' }}>
          <span style={{ fontSize: '40px' }}>🏍️</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Soy domiciliario</p>
            <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '4px 0 0' }}>Recibir mandados y llevarlos en moto</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PantallaDatosConductor({ nombre, foto, celular, onGuardar, onVolver, onCerrarSesion, onIrPerfil, onIrGanancias, onIrSeguridad, onIrViajes, onIrCreditos, onIrAyuda, onIrConfig, onIrPromociones }) {
  const [tipoVehiculo, setTipoVehiculo] = React.useState('');
  const [placa, setPlaca] = React.useState('');
  const [marca, setMarca] = React.useState('');
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
  const [campoError, setCampoError] = React.useState('');
  const [cargando, setCargando] = React.useState(false);

  const subirFoto = async (archivo, carpeta, uid) => {
    const refArchivo = ref(storage, `conductores/${uid}/${carpeta}_${Date.now()}.jpg`);
    await uploadBytes(refArchivo, archivo);
    return await getDownloadURL(refArchivo);
  };

  const guardar = async () => {
    if (!tipoVehiculo) { setError('Falta escoger el tipo de vehículo'); setCampoError('tipoVehiculo'); return; }
    if (!telefono) { setError('Falta el número de teléfono'); setCampoError('telefono'); return; }
    if (!placa) { setError('Falta la placa del vehículo'); setCampoError('placa'); return; }
    if (placa.trim().length !== 6) { setError('La placa debe tener exactamente 6 caracteres'); setCampoError('placa'); return; }
    if (!marca) { setError('Falta escoger la marca'); setCampoError('marca'); return; }
    if (marca === 'Otra' && !marcaOtra.trim()) { setError('Escribe la marca del vehículo'); setCampoError('marcaOtra'); return; }
    if (!modelo) { setError('Falta el modelo'); setCampoError('modelo'); return; }
    if (!color) { setError('Falta escoger el color'); setCampoError('color'); return; }
    if (!documento) { setError('Falta el documento de identidad'); setCampoError('documento'); return; }
    if (!fotoConductor) { setError('Falta subir la foto del conductor'); setCampoError('fotoConductor'); return; }
    if (!fotoCedula) { setError('Falta subir la foto de la cédula'); setCampoError('fotoCedula'); return; }
    setCampoError('');
    setCargando(true); setError('');
    try {
      const user = auth.currentUser;
      if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); setCargando(false); return; }
      const urlFotoConductor = await subirFoto(fotoConductor, 'conductor', user.uid);
      const urlFotoCedula = await subirFoto(fotoCedula, 'cedula', user.uid);
      const marcaFinal = marca === 'Otra' ? marcaOtra.trim() : marca;
      const vehiculo = `${marcaFinal} ${modelo}`;

      // Créditos de bienvenida: solo si el usuario aún no tiene saldo (evita duplicar si edita sus datos)
      // El monto depende del tipo de vehículo (mototaxi o taxi)
      let creditosIniciales = null;
      try {
        const snapActual = await getDoc(doc(db, 'usuarios', user.uid));
        const yaTieneCreditos = snapActual.exists() && (snapActual.data().creditos || 0) > 0;
        if (!yaTieneCreditos) {
          const snapCfg = await getDoc(doc(db, 'config', 'global'));
          const d = snapCfg.exists() ? snapCfg.data() : {};
          const monto = tipoVehiculo === 'Mototaxi' ? (d.incentivoNuevoMototaxi ?? 10000) : (d.incentivoNuevoTaxi ?? 20000);
          if (monto > 0) creditosIniciales = monto;
        }
      } catch (e) {}

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
        ...(creditosIniciales !== null ? { creditos: creditosIniciales } : {}),
      }, { merge: true });
      onGuardar(placa.toUpperCase(), vehiculo, telefono, tipoVehiculo, creditosIniciales);
    } catch (e) { setError('Error al guardar. Revisa tu conexión e intenta de nuevo'); }
    setCargando(false);
  };

  const estiloCampoBase = { background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' };
  const estiloCampo = estiloCampoBase;
  const campoRojo = (campo) => campoError === campo ? { ...estiloCampoBase, border: '2px solid #FF4444' } : estiloCampoBase;
  const estiloInput = { background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' };

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', position: 'relative' }}>
      {error && campoError && (
        <div onClick={() => setError('')} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '380px', border: '2px solid #FF4444', textAlign: 'center', position: 'relative' }}>
            <span onClick={() => setError('')} style={{ position: 'absolute', top: '16px', right: '20px', color: '#AAAAAA', fontSize: '26px', cursor: 'pointer', lineHeight: '1' }}>✕</span>
            <div style={{ fontSize: '54px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 10px' }}>Falta un dato</h2>
            <p style={{ color: '#FFFFFF', fontSize: '17px', margin: '0 0 24px', lineHeight: '1.5', fontWeight: 'bold' }}>{error}</p>
            <button onClick={() => setError('')} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}
      <MenuLateral nombre={nombre} foto={foto} onIrPerfil={onIrPerfil} onIrGanancias={onIrGanancias} onIrSeguridad={onIrSeguridad} onIrViajes={onIrViajes} onIrCreditos={onIrCreditos} onIrAyuda={onIrAyuda} onIrConfig={onIrConfig} onIrPromociones={onIrPromociones} onCerrarSesion={onCerrarSesion} />
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
      <div style={campoRojo('telefono')}>
        <span style={{ fontSize: '20px' }}>📞</span>
        <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Número de teléfono" type="tel" style={estiloInput} />
      </div>
      <div style={campoRojo('placa')}>
        <span style={{ fontSize: '20px' }}>🚘</span>
        <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase().slice(0, 6))} placeholder="Placa del vehículo (6 caracteres)" style={estiloInput} />
      </div>
      <div onClick={() => setListaMarcaAbierta(true)} style={{ ...campoRojo('marca'), cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>🏭</span>
        <span style={{ color: marca ? '#FFFFFF' : '#AAAAAA', fontSize: '16px', flex: 1 }}>{marca || 'Marca del vehículo'}</span>
        <span style={{ color: '#AAAAAA', fontSize: '14px' }}>▼</span>
      </div>
      {marca === 'Otra' && (
        <div style={campoRojo('marcaOtra')}>
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
      <div style={campoRojo('modelo')}>
        <span style={{ fontSize: '20px' }}>📅</span>
        <select value={modelo} onChange={e => setModelo(e.target.value)} style={{ ...estiloInput, cursor: 'pointer' }}>
          <option value="" style={{ background: '#1A1A1E' }}>Año del modelo</option>
          {Array.from({ length: new Date().getFullYear() - 1989 }, (_, i) => new Date().getFullYear() - i).map(anio => (
            <option key={anio} value={anio} style={{ background: '#1A1A1E' }}>{anio}</option>
          ))}
        </select>
      </div>
      <div onClick={() => setListaColorAbierta(true)} style={{ ...campoRojo('color'), cursor: 'pointer' }}>
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
      <div style={campoRojo('documento')}>
        <span style={{ fontSize: '20px' }}>🪪</span>
        <input value={documento} onChange={e => setDocumento(e.target.value)} placeholder="Documento de identidad" type="tel" style={estiloInput} />
      </div>

      <label style={{ ...campoRojo('fotoConductor'), cursor: 'pointer' }}>
        <span style={{ fontSize: '20px' }}>📸</span>
        <span style={{ color: fotoConductor ? '#2ECC71' : '#AAAAAA', fontSize: '15px', flex: 1 }}>
          {fotoConductor ? '✓ Foto del conductor lista' : 'Subir foto del conductor'}
        </span>
        <input type="file" accept="image/*" onChange={e => setFotoConductor(e.target.files[0])} style={{ display: 'none' }} />
      </label>

      <label style={{ ...campoRojo('fotoCedula'), cursor: 'pointer', marginBottom: '20px' }}>
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

function PantallaMantenimiento({ mensaje, onVolver }) {
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '70px', marginBottom: '20px' }}>🛠️</div>
      <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '0 0 16px' }}>Estamos en mantenimiento</h2>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '20px', padding: '24px', width: '100%', maxWidth: '420px', border: '1px solid #FF7A2F', marginBottom: '24px' }}>
        <p style={{ color: '#FFFFFF', fontSize: '15px', margin: '0', lineHeight: '1.6' }}>{mensaje}</p>
      </div>
      <button onClick={onVolver} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Volver</button>
    </div>
  );
}

function CelebracionBienvenidaConductor({ monto, onContinuar }) {
  const confeti = Array.from({ length: 40 }, (_, i) => i);
  const colores = ['#FFCF4D', '#FF7A2F', '#D6357E', '#2ECC71', '#4DA3FF', '#FFFFFF'];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#141416', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden' }}>
      {confeti.map(i => (
        <span key={i} style={{
          position: 'absolute', top: '-24px', left: `${Math.random() * 100}%`,
          fontSize: `${16 + Math.random() * 18}px`,
          color: colores[i % colores.length],
          animation: `caerBienvenidaC ${2.2 + Math.random() * 2}s linear ${Math.random() * 1.2}s infinite`,
        }}>●</span>
      ))}
      <div style={{ fontSize: '30px', marginBottom: '4px', animation: 'rebotarBienvenidaC 0.6s infinite alternate', zIndex: 2 }}>🎉🎊🎉</div>
      <div style={{ fontSize: '90px', margin: '8px 0 4px', animation: 'rebotarBienvenidaC 0.6s infinite alternate', zIndex: 2 }}>🚗💰</div>
      <h1 style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: '900', margin: '8px 0 4px', textAlign: 'center', zIndex: 2 }}>¡Bienvenido, conductor!</h1>
      <p style={{ color: '#FFCF4D', fontSize: '15px', margin: '0 0 24px', textAlign: 'center', fontWeight: 'bold', zIndex: 2 }}>Empiezas con saldo en tu cuenta 🥳</p>
      <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', borderRadius: '28px', padding: '32px 28px', width: '100%', maxWidth: '420px', textAlign: 'center', zIndex: 2, boxShadow: '0 8px 32px rgba(255,122,47,0.4)' }}>
        <p style={{ color: '#141416', fontSize: '13px', margin: '0 0 8px', letterSpacing: '2px', fontWeight: '900' }}>CRÉDITOS DE BIENVENIDA</p>
        <p style={{ color: '#141416', fontSize: '54px', fontWeight: '900', margin: '0', lineHeight: '1' }}>${(monto || 0).toLocaleString()}</p>
        <p style={{ color: '#3A2400', fontSize: '13px', margin: '14px 0 0', lineHeight: '1.5', fontWeight: 'bold' }}>Ya está en tu saldo. Úsalo para pagar tus primeras comisiones 🚀</p>
      </div>
      <button onClick={onContinuar} style={{ marginTop: '28px', width: '100%', maxWidth: '420px', padding: '18px', background: '#FFFFFF', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer', zIndex: 2 }}>¡A rodar! 🎉</button>
      <style>{`
        @keyframes caerBienvenidaC { from { transform: translateY(-24px) rotate(0deg); opacity: 1; } to { transform: translateY(100vh) rotate(360deg); opacity: 0.2; } }
        @keyframes rebotarBienvenidaC { from { transform: scale(1); } to { transform: scale(1.12); } }
      `}</style>
    </div>
  );
}

function App() {
  const [screen, setScreen] = useState('splash');
  const [celebracionCreditosConductor, setCelebracionCreditosConductor] = useState(null); // monto o null
  const [mensajeMantenimiento, setMensajeMantenimiento] = useState('');
  const [tipoUsuario, setTipoUsuario] = useState('');
  const [nombreUsuario, setNombreUsuario] = useState('');
  const [telefonoUsuario, setTelefonoUsuario] = useState('');
  const [placaUsuario, setPlacaUsuario] = useState('');
  const [vehiculoUsuario, setVehiculoUsuario] = useState('');
  const [tipoVehiculoUsuario, setTipoVehiculoUsuario] = useState('');
  const [verPerfil, setVerPerfil] = useState(false);
  const [verGanancias, setVerGanancias] = useState(false);
  const [verSeguridad, setVerSeguridad] = useState(false);
  const [fotoUsuario, setFotoUsuario] = useState(null);
  const [verMisViajes, setVerMisViajes] = useState(false);
  const [verCreditos, setVerCreditos] = useState(false);
  const [verAyuda, setVerAyuda] = useState(false);
  const [verConfig, setVerConfig] = useState(false);
  const [verPromociones, setVerPromociones] = useState(false);

  useEffect(() => {
    const local = cargarLocal();
    if (local && local.tipo) {
      setTipoUsuario(local.tipo);
      setNombreUsuario(local.nombre || '');
      setTelefonoUsuario(local.telefono || local.celular || '');
      setPlacaUsuario(local.placa || '');
      setVehiculoUsuario(local.vehiculo || '');
      setTipoVehiculoUsuario(local.tipoVehiculo || '');
      const desuscribirFoto = onAuthStateChanged(auth, (user) => {
        if (user) {
          getDoc(doc(db, 'usuarios', user.uid)).then(snap => {
            if (snap.exists()) setFotoUsuario(snap.data().fotoConductor || snap.data().foto || null);
          }).catch(() => {});
        }
      });
      setTimeout(() => setScreen('modulos'), 2000);
      return () => desuscribirFoto();
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
            setTipoVehiculoUsuario(datos.tipoVehiculo || '');
            setTipoUsuario(datos.tipo || '');
            guardarLocal(datos);
            setFotoUsuario(datos.fotoConductor || datos.foto || null);
            setTimeout(() => setScreen('modulos'), 2000);
            return;
          }
        } catch (e) {}
      }
      setTimeout(() => setScreen('login'), 2000);
    });
    return () => unsub();
  }, []);

  const handleEntrar = async (tipo, nombre, celular, placa, vehiculo) => {
    setNombreUsuario(nombre);
    setTelefonoUsuario(celular);
    setPlacaUsuario(placa);
    setVehiculoUsuario(vehiculo);
    setTipoUsuario(tipo);
    let tipoVeh = '';
    try {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) tipoVeh = snap.data().tipoVehiculo || '';
      }
    } catch (e) {}
    setTipoVehiculoUsuario(tipoVeh);
    guardarLocal({ tipo, nombre, celular, placa, vehiculo, tipoVehiculo: tipoVeh });
    setScreen('modulos');
  };

  const handleSeleccionarModulo = (modulo) => {
    if (modulo === 'transporte') {
      setScreen('rol');
    } else if (modulo === 'mensajeria') {
      setScreen('mensajeria');
    }
  };

  // Revisa si hay mantenimiento activo para el tipo de usuario. Devuelve true si está bloqueado.
  const revisarMantenimiento = async (rol) => {
    try {
      const snap = await getDoc(doc(db, 'config', 'global'));
      if (!snap.exists()) return false;
      const d = snap.data();
      const bloqueado = (rol === 'pasajero' && d.mantPasajeros) || (rol === 'conductor' && d.mantConductores);
      if (bloqueado) {
        setMensajeMantenimiento(d.mensajeMantenimiento || 'Estamos haciendo mejoras. Volvemos muy pronto.');
        return true;
      }
    } catch (e) {}
    return false;
  };

  const handleSeleccionarRol = async (rol) => {
    // Antes de entrar, revisar si hay mantenimiento activo para ese tipo de usuario
    const bloqueado = await revisarMantenimiento(rol);
    if (bloqueado) { setScreen('mantenimiento'); return; }

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

  const handleDatosConductor = (placa, vehiculo, telefono, tipoVehiculo, creditosIniciales) => {
    setPlacaUsuario(placa);
    setVehiculoUsuario(vehiculo);
    setTelefonoUsuario(telefono);
    setTipoVehiculoUsuario(tipoVehiculo || '');
    guardarLocal({ tipo: 'conductor', nombre: nombreUsuario, celular: telefono, placa, vehiculo, tipoVehiculo: tipoVehiculo || '' });
    if (creditosIniciales) {
      setCelebracionCreditosConductor(creditosIniciales);
    } else {
      setScreen('home');
    }
  };

  const handleCerrarSesion = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setScreen('login');
  };

  if (celebracionCreditosConductor) return <CelebracionBienvenidaConductor monto={celebracionCreditosConductor} onContinuar={() => { setCelebracionCreditosConductor(null); setScreen('home'); }} />;
  if (verPerfil) return <MiPerfil onVolver={() => setVerPerfil(false)} />;
  if (verGanancias) return <Ganancias onVolver={() => setVerGanancias(false)} />;
  if (verSeguridad) return <Seguridad onVolver={() => setVerSeguridad(false)} />;
  if (verMisViajes) return <MisViajes onVolver={() => setVerMisViajes(false)} />;
  if (verCreditos) return <Creditos onVolver={() => setVerCreditos(false)} />;
  if (verAyuda) return <AyudaSoporte onVolver={() => setVerAyuda(false)} />;
  if (verConfig) return <Configuracion onVolver={() => setVerConfig(false)} onCerrarSesion={handleCerrarSesion} />;
  if (verPromociones) return <Promociones onVolver={() => setVerPromociones(false)} />;
  if (screen === 'splash') return <Splash onFinish={() => {}} />;
  if (screen === 'login') return <Login onEntrar={handleEntrar} />;
  if (screen === 'modulos') return <><PantallaModulos nombre={nombreUsuario} foto={fotoUsuario} onSeleccionar={handleSeleccionarModulo} onVolver={() => setScreen('login')} onCerrarSesion={handleCerrarSesion} onIrPerfil={() => setVerPerfil(true)} onIrGanancias={() => setVerGanancias(true)} onIrSeguridad={() => setVerSeguridad(true)} onIrViajes={() => setVerMisViajes(true)} onIrCreditos={() => setVerCreditos(true)} onIrAyuda={() => setVerAyuda(true)} onIrConfig={() => setVerConfig(true)} onIrPromociones={() => setVerPromociones(true)} /><Anuncio tipoUsuario={tipoUsuario} /></>;
  if (screen === 'rol') return <PantallaRol nombre={nombreUsuario} foto={fotoUsuario} onSeleccionar={handleSeleccionarRol} onVolver={() => setScreen('modulos')} onCerrarSesion={handleCerrarSesion} onIrPerfil={() => setVerPerfil(true)} onIrGanancias={() => setVerGanancias(true)} onIrSeguridad={() => setVerSeguridad(true)} onIrViajes={() => setVerMisViajes(true)} onIrCreditos={() => setVerCreditos(true)} onIrAyuda={() => setVerAyuda(true)} onIrConfig={() => setVerConfig(true)} onIrPromociones={() => setVerPromociones(true)} />;
  if (screen === 'mensajeria') return <PantallaMensajeria nombre={nombreUsuario} onVolver={() => setScreen('modulos')} onEnviar={() => setScreen('enviar')} onDomiciliario={() => alert('🏍️ Domiciliario: en el siguiente paso el mototaxista verá aquí los mandados disponibles.')} />;
  if (screen === 'enviar') return <SolicitarMensajeria onVolver={() => setScreen('mensajeria')} />;
  if (screen === 'mantenimiento') return <PantallaMantenimiento mensaje={mensajeMantenimiento} onVolver={() => setScreen('rol')} />;
  if (screen === 'datos_conductor') return <PantallaDatosConductor nombre={nombreUsuario} foto={fotoUsuario} celular={telefonoUsuario} onGuardar={handleDatosConductor} onVolver={() => setScreen('rol')} onCerrarSesion={handleCerrarSesion} onIrPerfil={() => setVerPerfil(true)} onIrGanancias={() => setVerGanancias(true)} onIrSeguridad={() => setVerSeguridad(true)} onIrViajes={() => setVerMisViajes(true)} onIrCreditos={() => setVerCreditos(true)} onIrAyuda={() => setVerAyuda(true)} onIrConfig={() => setVerConfig(true)} />;

  if (screen === 'home') {
    if (tipoUsuario === 'conductor') {
      return (
        <AppConductor
          nombre={nombreUsuario}
          telefono={telefonoUsuario}
          placa={placaUsuario}
          vehiculo={vehiculoUsuario}
          tipoVehiculo={tipoVehiculoUsuario}
          onCerrarSesion={handleCerrarSesion}
          onVolver={() => setScreen('rol')}
        />
      );
    }
    return <Home nombre={nombreUsuario} onCerrarSesion={handleCerrarSesion} onVolver={() => setScreen('rol')} />;
  }
}

export default App;