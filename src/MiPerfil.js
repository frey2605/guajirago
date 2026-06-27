import React, { useState, useEffect } from 'react';
import { auth, db, storage } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function MiPerfil({ onVolver }) {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [datos, setDatos] = useState(null);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [foto, setFoto] = useState(null);
  const [fotoNueva, setFotoNueva] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setCargando(false); return; }
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setDatos(d);
          setNombre(d.nombre || '');
          setTelefono(d.telefono || d.celular || '');
          setFoto(d.fotoConductor || d.foto || null);
        }
      } catch (e) {}
      setCargando(false);
    };
    cargar();
  }, []);

  const elegirFoto = (e) => {
    const archivo = e.target.files[0];
    if (!archivo) return;
    setFotoNueva(archivo);
    setFotoPreview(URL.createObjectURL(archivo));
  };

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre no puede estar vacío'); return; }
    if (!telefono.trim()) { setError('El teléfono no puede estar vacío'); return; }
    setGuardando(true); setError(''); setMensaje('');
    try {
      const user = auth.currentUser;
      if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); setGuardando(false); return; }

      let urlFoto = foto;
      if (fotoNueva) {
        const refArchivo = ref(storage, `usuarios/${user.uid}/perfil_${Date.now()}.jpg`);
        await uploadBytes(refArchivo, fotoNueva);
        urlFoto = await getDownloadURL(refArchivo);
      }

      const actualizacion = {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
      };
      if (urlFoto) actualizacion.fotoConductor = urlFoto;

      await setDoc(doc(db, 'usuarios', user.uid), actualizacion, { merge: true });

      setFoto(urlFoto);
      setFotoNueva(null);
      setMensaje('¡Perfil actualizado! ✅');
    } catch (e) {
      setError('Error al guardar. Revisa tu conexión e intenta de nuevo');
    }
    setGuardando(false);
  };

  const esConductor = datos?.tipo === 'conductor';
  const fotoMostrar = fotoPreview || foto;

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', color: '#FF7A2F', fontSize: '24px', cursor: 'pointer' }}>←</button>
        <h2 style={{ color: '#FFFFFF', margin: '0', fontSize: '20px', fontWeight: '900' }}>Mi perfil</h2>
      </div>

      {cargando ? (
        <p style={{ color: '#AAAAAA', textAlign: 'center', marginTop: '60px' }}>Cargando...</p>
      ) : (
        <div style={{ padding: '24px 20px' }}>
          {/* Foto de perfil */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
            <div style={{ width: '110px', height: '110px', borderRadius: '50%', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', overflow: 'hidden', marginBottom: '12px' }}>
              {fotoMostrar ? <img src={fotoMostrar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
            </div>
            <label style={{ cursor: 'pointer', background: '#1A1A1E', border: '1px solid #FF7A2F', borderRadius: '12px', padding: '8px 18px', color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold' }}>
              📸 Cambiar foto
              <input type="file" accept="image/*" onChange={elegirFoto} style={{ display: 'none' }} />
            </label>
          </div>

          {/* Nombre */}
          <p style={{ color: '#555', fontSize: '11px', letterSpacing: '2px', margin: '0 0 8px' }}>NOMBRE</p>
          <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>👤</span>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          </div>

          {/* Teléfono */}
          <p style={{ color: '#555', fontSize: '11px', letterSpacing: '2px', margin: '0 0 8px' }}>TELÉFONO</p>
          <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>📞</span>
            <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Tu teléfono" type="tel" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          </div>

          {/* Datos solo lectura del conductor */}
          {esConductor && (
            <>
              <p style={{ color: '#555', fontSize: '11px', letterSpacing: '2px', margin: '20px 0 8px' }}>DATOS DEL VEHÍCULO (no editables)</p>
              {datos?.placa && (
                <div style={{ background: '#141416', borderRadius: '16px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #2A2A2E' }}>
                  <span style={{ fontSize: '20px' }}>🚘</span>
                  <div><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>Placa</p><p style={{ color: '#FFCF4D', fontSize: '16px', fontWeight: 'bold', margin: '2px 0 0' }}>{datos.placa}</p></div>
                </div>
              )}
              {datos?.vehiculo && (
                <div style={{ background: '#141416', borderRadius: '16px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #2A2A2E' }}>
                  <span style={{ fontSize: '20px' }}>🏷️</span>
                  <div><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>Vehículo</p><p style={{ color: '#FFFFFF', fontSize: '16px', margin: '2px 0 0' }}>{datos.vehiculo}{datos.color ? ` · ${datos.color}` : ''}</p></div>
                </div>
              )}
              {datos?.documento && (
                <div style={{ background: '#141416', borderRadius: '16px', padding: '16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #2A2A2E' }}>
                  <span style={{ fontSize: '20px' }}>🪪</span>
                  <div><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>Documento</p><p style={{ color: '#FFFFFF', fontSize: '16px', margin: '2px 0 0' }}>{datos.documento}</p></div>
                </div>
              )}
            </>
          )}

          {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', margin: '16px 0 0' }}>{error}</p>}
          {mensaje && <p style={{ color: '#2ECC71', fontSize: '14px', textAlign: 'center', margin: '16px 0 0', fontWeight: 'bold' }}>{mensaje}</p>}

          <button onClick={guardar} disabled={guardando} style={{ width: '100%', padding: '18px', marginTop: '24px', background: guardando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: guardando ? '#555' : '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MiPerfil;