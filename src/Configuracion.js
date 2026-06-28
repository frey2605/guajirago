import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, deleteUser, signOut, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import TerminosCondiciones from './TerminosCondiciones';
import PoliticaPrivacidad from './PoliticaPrivacidad';

const VERSION_APP = '2.1';

function Configuracion({ onVolver, onCerrarSesion }) {
  const [sonido, setSonido] = useState(true);
  const [notificaciones, setNotificaciones] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [verTerminos, setVerTerminos] = useState(false);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [correoEnviado, setCorreoEnviado] = useState('');
  const [contrasenaEliminar, setContrasenaEliminar] = useState('');
  const [errorEliminar, setErrorEliminar] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          if (d.configSonido === false) setSonido(false);
          if (d.configNotificaciones === false) setNotificaciones(false);
        }
      } catch (e) {}
    };
    cargar();
  }, []);

  const guardarPreferencia = async (campo, valor) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      await setDoc(doc(db, 'usuarios', user.uid), { [campo]: valor }, { merge: true });
    } catch (e) {}
  };

  const cambiarSonido = () => {
    const nuevo = !sonido;
    setSonido(nuevo);
    guardarPreferencia('configSonido', nuevo);
  };

  const cambiarNotificaciones = () => {
    const nuevo = !notificaciones;
    setNotificaciones(nuevo);
    guardarPreferencia('configNotificaciones', nuevo);
  };

  const cambiarContrasena = async () => {
    setError(''); setMensaje(''); setCorreoEnviado('');
    try {
      const user = auth.currentUser;
      if (!user || !user.email) { setError('No se pudo identificar tu correo'); return; }
      await sendPasswordResetEmail(auth, user.email);
      setCorreoEnviado(user.email);
    } catch (e) {
      setError('No se pudo enviar el correo. Intenta más tarde');
    }
  };

  const eliminarCuenta = async () => {
    setErrorEliminar('');
    if (!contrasenaEliminar.trim()) { setErrorEliminar('Escribe tu contraseña para confirmar'); return; }
    try {
      const user = auth.currentUser;
      if (!user || !user.email) return;
      const credencial = EmailAuthProvider.credential(user.email, contrasenaEliminar);
      await reauthenticateWithCredential(user, credencial);
      await deleteUser(user);
      if (onCerrarSesion) onCerrarSesion();
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setErrorEliminar('Contraseña incorrecta. Inténtalo de nuevo');
      } else {
        setErrorEliminar('Error al eliminar. Intenta más tarde');
      }
    }
  };

  if (verTerminos) return <TerminosCondiciones onVolver={() => setVerTerminos(false)} />;
  if (verPrivacidad) return <PoliticaPrivacidad onVolver={() => setVerPrivacidad(false)} />;

  const toggle = (activo, onClick) => (
    <div onClick={onClick} style={{ width: '52px', height: '30px', borderRadius: '15px', background: activo ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: activo ? 'flex-end' : 'flex-start', flexShrink: 0, transition: 'all 0.2s' }}>
      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#FFFFFF' }} />
    </div>
  );

  const filaToggle = (icono, texto, activo, onClick) => (
    <div style={{ background: '#1A1A1E', borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '20px' }}>{icono}</span>
      <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '500', flex: 1 }}>{texto}</span>
      {toggle(activo, onClick)}
    </div>
  );

  const filaBoton = (icono, texto, onClick, color) => (
    <div onClick={onClick} style={{ background: '#1A1A1E', borderRadius: '14px', padding: '14px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
      <span style={{ fontSize: '20px' }}>{icono}</span>
      <span style={{ color: color || '#FFFFFF', fontSize: '15px', fontWeight: '500', flex: 1 }}>{texto}</span>
      <span style={{ color: '#555', fontSize: '18px' }}>›</span>
    </div>
  );

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* Modal correo enviado */}
      {correoEnviado && (
        <div onClick={() => setCorreoEnviado('')} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', border: '2px solid #2ECC71', textAlign: 'center' }}>
            <div style={{ fontSize: '54px', marginBottom: '12px' }}>📧</div>
            <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 10px' }}>¡Correo enviado!</h2>
            <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 8px', lineHeight: '1.5' }}>Te enviamos un enlace para cambiar tu contraseña a:</p>
            <p style={{ color: '#2ECC71', fontSize: '15px', fontWeight: 'bold', margin: '0 0 16px' }}>{correoEnviado}</p>
            <div style={{ background: 'rgba(255,207,77,0.1)', borderRadius: '12px', padding: '12px 16px', marginBottom: '24px', border: '1px solid #FFCF4D' }}>
              <p style={{ color: '#FFCF4D', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>⚠️ Si no lo ves en tu bandeja de entrada, revisa la carpeta de <strong>correo no deseado o spam</strong>.</p>
            </div>
            <button onClick={() => setCorreoEnviado('')} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Configuración</h2>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', margin: '0 0 12px', lineHeight: '1.5' }}>{error}</p>}

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '0 0 8px' }}>NOTIFICACIONES</p>
        {filaToggle('🔊', 'Sonido de solicitudes', sonido, cambiarSonido)}
        {filaToggle('🔔', 'Notificaciones push', notificaciones, cambiarNotificaciones)}

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '16px 0 8px' }}>CUENTA</p>
        {filaBoton('🔑', 'Cambiar contraseña', cambiarContrasena)}
        {filaBoton('🗑️', 'Eliminar mi cuenta', () => setConfirmarEliminar(true), '#FF4444')}

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '16px 0 8px' }}>PREFERENCIAS</p>
        <div style={{ background: '#1A1A1E', borderRadius: '14px', padding: '10px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🌍</span>
          <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '500', flex: 1 }}>Idioma</span>
          <span style={{ color: '#555', fontSize: '14px' }}>Español</span>
        </div>

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '16px 0 8px' }}>LEGAL</p>
        {filaBoton('📄', 'Términos y condiciones', () => setVerTerminos(true))}
        {filaBoton('🔒', 'Política de privacidad', () => setVerPrivacidad(true))}

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '16px 0 8px' }}>ACERCA DE</p>
        <div style={{ background: '#1A1A1E', borderRadius: '14px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📱</span>
          <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '500', flex: 1 }}>Versión de la app</span>
          <span style={{ color: '#555', fontSize: '14px' }}>{VERSION_APP}</span>
        </div>

        <p style={{ color: '#555', fontSize: '12px', textAlign: 'center', margin: '24px 0 0' }}>GuajiraGo © 2026 · Riohacha, La Guajira</p>
      </div>

      {confirmarEliminar && (
        <div onClick={() => { setConfirmarEliminar(false); setContrasenaEliminar(''); setErrorEliminar(''); }} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', border: '2px solid #FF4444', textAlign: 'center' }}>
            <div style={{ fontSize: '54px', marginBottom: '12px' }}>⚠️</div>
            <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 10px' }}>¿Eliminar tu cuenta?</h2>
            <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 16px', lineHeight: '1.5' }}>Esta acción es permanente. Se borrarán todos tus datos y no podrás recuperarlos. Escribe tu contraseña para confirmar.</p>
            <div style={{ background: '#141416', borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: `1px solid ${errorEliminar ? '#FF4444' : '#2A2A2E'}` }}>
              <span style={{ fontSize: '18px' }}>🔒</span>
              <input
                value={contrasenaEliminar}
                onChange={e => { setContrasenaEliminar(e.target.value); setErrorEliminar(''); }}
                type={verContrasena ? 'text' : 'password'}
                placeholder="Escribe tu contraseña"
                autoComplete="new-password"
                style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
              />
              <span onClick={() => setVerContrasena(!verContrasena)} style={{ fontSize: '18px', cursor: 'pointer' }}>{verContrasena ? '🙈' : '👁️'}</span>
            </div>
            {errorEliminar && <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 12px', fontWeight: 'bold' }}>{errorEliminar}</p>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setConfirmarEliminar(false); setContrasenaEliminar(''); setErrorEliminar(''); }} style={{ flex: 1, padding: '16px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={eliminarCuenta} style={{ flex: 1, padding: '16px', background: '#FF4444', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Configuracion;