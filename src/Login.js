import React, { useState } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

function Login({ onEntrar }) {
  const [pantalla, setPantalla] = useState('inicio');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [celular, setCelular] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensajeRecuperar, setMensajeRecuperar] = useState('');

  const registrarse = async () => {
    if (!nombre || !email || !celular || !password || !passwordConfirm) { setError('Por favor completa todos los campos'); return; }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener mínimo 6 caracteres'); return; }
    setCargando(true); setError('');
    try {
      const resultado = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await setDoc(doc(db, 'usuarios', resultado.user.uid), { nombre, email: email.trim().toLowerCase(), celular, tipo: '', placa: '', vehiculo: '', fechaRegistro: new Date().toISOString() });
      onEntrar('', nombre, celular, '', '');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Este correo ya está registrado');
      else if (err.code === 'auth/weak-password') setError('La contraseña debe tener mínimo 6 caracteres');
      else if (err.code === 'auth/invalid-email') setError('El correo no es válido');
      else setError('Error al registrarse. Intenta de nuevo');
    }
    setCargando(false);
  };

  const iniciarSesion = async () => {
    if (!email || !password) { setError('Por favor completa todos los campos'); return; }
    setCargando(true); setError('');
    try {
      const resultado = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const docSnap = await getDoc(doc(db, 'usuarios', resultado.user.uid));
      if (docSnap.exists()) {
        const datos = docSnap.data();
        onEntrar(datos.tipo || '', datos.nombre, datos.celular || datos.telefono || '', datos.placa || '', datos.vehiculo || '');
      } else { onEntrar('', '', '', '', ''); }
    } catch (err) {
      if (err.code === 'auth/invalid-credential') setError('Correo o contraseña incorrectos');
      else if (err.code === 'auth/invalid-email') setError('El correo no es válido');
      else setError('Error al ingresar. Intenta de nuevo');
    }
    setCargando(false);
  };

  const recuperarContrasena = async () => {
    if (!email) { setError('Ingresa tu correo para recuperar la contraseña'); return; }
    setCargando(true); setError(''); setMensajeRecuperar('');
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setMensajeRecuperar('Te enviamos un correo para restablecer tu contraseña ✅');
    } catch (err) { setError('No encontramos ese correo. Verifica e intenta de nuevo'); }
    setCargando(false);
  };

  if (pantalla === 'inicio') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <h1 style={{ fontSize: '42px', color: '#FFFFFF', margin: '0', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-1px', textAlign: 'center' }}>Guajira</h1>
        <h1 style={{ fontSize: '56px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: '0 0 60px', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-2px' }}>GO</h1>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => { setError(''); setPantalla('registro'); }} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Crear cuenta</button>
          <button onClick={() => { setError(''); setMensajeRecuperar(''); setPantalla('login'); }} style={{ width: '100%', padding: '18px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Ya tengo cuenta</button>
        </div>
      </div>
    );
  }

  if (pantalla === 'registro') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', color: '#FFFFFF', margin: '0', fontFamily: 'Arial Black, sans-serif' }}>Crear cuenta</h1>
          <p style={{ color: '#555', fontSize: '13px', margin: '8px 0 0' }}>Ingresa tus datos para registrarte</p>
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre completo" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📧</span>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" type="email" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '900', whiteSpace: 'nowrap' }}>+57</span>
          <input value={celular} onChange={e => setCelular(e.target.value)} placeholder="3001234567" type="tel" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña (mínimo 6 caracteres)" type="password" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <input value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} placeholder="Confirmar contraseña" type="password" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
        <button onClick={registrarse} style={{ width: '100%', padding: '18px', background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: cargando ? '#555' : '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>
          {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
        <button onClick={() => { setError(''); setPantalla('inicio'); }} style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', marginTop: '16px' }}>Volver</button>
      </div>
    );
  }

  if (pantalla === 'login') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '0px' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', color: '#FFFFFF', margin: '0', fontFamily: 'Arial Black, sans-serif' }}>Bienvenido</h1>
            <p style={{ color: '#555', fontSize: '13px', margin: '8px 0 0' }}>Ingresa con tu correo y contraseña</p>
          </div>
          <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>📧</span>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" type="email" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          </div>
          <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>🔒</span>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" type="password" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          </div>
          {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
          {mensajeRecuperar && <p style={{ color: '#2ECC71', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{mensajeRecuperar}</p>}
          <button onClick={iniciarSesion} style={{ width: '100%', padding: '18px', background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: cargando ? '#555' : '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer', marginBottom: '12px', marginTop: '8px' }}>
            {cargando ? 'Cargando...' : 'Entrar a GuajiraGo'}
          </button>
          <button onClick={recuperarContrasena} style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '15px', fontWeight: '900', cursor: 'pointer', marginBottom: '12px' }}>
            ¿Olvidaste tu contraseña?
          </button>
          <button onClick={() => { setError(''); setMensajeRecuperar(''); setPantalla('inicio'); }} style={{ width: '100%', padding: '14px', background: 'none', border: 'none', color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Volver</button>
        </div>
      </div>
    );
  }

  return null;
}

export default Login;