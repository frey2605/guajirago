import React, { useState } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import TerminosCondiciones from './TerminosCondiciones';
import PoliticaPrivacidad from './PoliticaPrivacidad';

function Login({ onEntrar }) {
  const [pantalla, setPantalla] = useState('inicio');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirm, setEmailConfirm] = useState('');
  const [celular, setCelular] = useState('');
  const [diaNac, setDiaNac] = useState('');
  const [mesNac, setMesNac] = useState('');
  const [anioNac, setAnioNac] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoNumero, setContactoNumero] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensajeRecuperar, setMensajeRecuperar] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [verPasswordConfirm, setVerPasswordConfirm] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [verTerminos, setVerTerminos] = useState(false);
  const [verPrivacidad, setVerPrivacidad] = useState(false);

  const registrarse = async () => {
    if (!nombre || !email || !emailConfirm || !celular || !diaNac || !mesNac || !anioNac || !password || !passwordConfirm) { setError('Por favor completa todos los campos'); return; }
    if (!contactoNombre.trim()) { setError('Escribe el nombre de tu contacto de emergencia'); return; }
    if (!contactoNumero.trim()) { setError('Escribe el número de tu contacto de emergencia'); return; }
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) { setError('Los correos no coinciden'); return; }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener mínimo 6 caracteres'); return; }
    if (!aceptaTerminos) { setError('Debes aceptar los Términos y condiciones para continuar'); return; }
    setEnviando(true); setError('');
    try {
      const resultado = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      try { await sendEmailVerification(resultado.user); } catch (e) {}
      const fechaNacimiento = `${String(diaNac).padStart(2, '0')}/${String(mesNac).padStart(2, '0')}/${anioNac}`;
      await setDoc(doc(db, 'usuarios', resultado.user.uid), { nombre, email: email.trim().toLowerCase(), celular, fechaNacimiento, contactoConfianzaNombre: contactoNombre.trim(), contactoConfianzaNumero: contactoNumero.trim(), tipo: '', placa: '', vehiculo: '', fechaRegistro: new Date().toISOString() });
      onEntrar('', nombre, celular, '', '');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setError('Este correo ya está registrado');
      else if (err.code === 'auth/weak-password') setError('La contraseña debe tener mínimo 6 caracteres');
      else if (err.code === 'auth/invalid-email') setError('El correo no es válido');
      else setError('Error al registrarse. Intenta de nuevo');
    }
    setEnviando(false);
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

  if (verTerminos) return <TerminosCondiciones onVolver={() => setVerTerminos(false)} />;
  if (verPrivacidad) return <PoliticaPrivacidad onVolver={() => setVerPrivacidad(false)} />;
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
        {error && (
          <div onClick={() => setError('')} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '380px', border: '2px solid #FF4444', textAlign: 'center', position: 'relative' }}>
              <span onClick={() => setError('')} style={{ position: 'absolute', top: '16px', right: '20px', color: '#AAAAAA', fontSize: '26px', cursor: 'pointer', lineHeight: '1' }}>✕</span>
              <div style={{ fontSize: '54px', marginBottom: '12px' }}>⚠️</div>
              <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 10px' }}>Atención</h2>
              <p style={{ color: '#FFFFFF', fontSize: '17px', margin: '0 0 24px', lineHeight: '1.5', fontWeight: 'bold' }}>{error}</p>
              <button onClick={() => setError('')} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
            </div>
          </div>
        )}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '28px', color: '#FFFFFF', margin: '0', fontFamily: 'Arial Black, sans-serif' }}>Crear cuenta</h1>
          <p style={{ color: '#555', fontSize: '13px', margin: '8px 0 0' }}>Ingresa tus datos para registrarte</p>
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <input value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📧</span>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" type="email" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📧</span>
          <input value={emailConfirm} onChange={e => setEmailConfirm(e.target.value)} onPaste={e => e.preventDefault()} placeholder="Confirmar correo electrónico" type="email" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '900', whiteSpace: 'nowrap' }}>+57</span>
          <input value={celular} onChange={e => setCelular(e.target.value)} placeholder="3001234567" type="tel" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>🎂</span>
            <span style={{ color: '#AAAAAA', fontSize: '14px' }}>Fecha de nacimiento</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={diaNac} onChange={e => setDiaNac(e.target.value)} style={{ flex: 1, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', padding: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
              <option value="">Día</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d} style={{ background: '#1A1A1E' }}>{d}</option>)}
            </select>
            <select value={mesNac} onChange={e => setMesNac(e.target.value)} style={{ flex: 1, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', padding: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
              <option value="">Mes</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m} style={{ background: '#1A1A1E' }}>{m}</option>)}
            </select>
            <select value={anioNac} onChange={e => setAnioNac(e.target.value)} style={{ flex: 1.3, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', padding: '12px', color: '#FFFFFF', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
              <option value="">Año</option>
              {Array.from({ length: 90 }, (_, i) => new Date().getFullYear() - 15 - i).map(a => <option key={a} value={a} style={{ background: '#1A1A1E' }}>{a}</option>)}
            </select>
          </div>
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña (mínimo 6 caracteres)" type={verPassword ? 'text' : 'password'} style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          <span onClick={() => setVerPassword(!verPassword)} style={{ fontSize: '20px', cursor: 'pointer' }}>{verPassword ? '🙈' : '👁️'}</span>
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <input value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} onPaste={e => e.preventDefault()} placeholder="Confirmar contraseña" type={verPasswordConfirm ? 'text' : 'password'} style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          <span onClick={() => setVerPasswordConfirm(!verPasswordConfirm)} style={{ fontSize: '20px', cursor: 'pointer' }}>{verPasswordConfirm ? '🙈' : '👁️'}</span>
        </div>
        <p style={{ color: '#FF7A2F', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px 4px', fontWeight: 'bold' }}>🚨 CONTACTO DE EMERGENCIA</p>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>👥</span>
          <input value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Nombre del contacto" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '900', whiteSpace: 'nowrap' }}>+57</span>
          <input value={contactoNumero} onChange={e => setContactoNumero(e.target.value)} placeholder="3001234567" type="tel" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', padding: '14px', background: '#1A1A1E', borderRadius: '14px', border: `1px solid ${aceptaTerminos ? '#FF7A2F' : '#2A2A2E'}` }}>
          <div onClick={() => setAceptaTerminos(!aceptaTerminos)} style={{ width: '22px', height: '22px', borderRadius: '6px', background: aceptaTerminos ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', border: aceptaTerminos ? 'none' : '2px solid #555', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}>
            {aceptaTerminos && <span style={{ color: '#141416', fontSize: '14px', fontWeight: '900' }}>✓</span>}
          </div>
          <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
            He leído y acepto los{' '}
            <span onClick={() => setVerTerminos(true)} style={{ color: '#FF7A2F', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Términos y condiciones</span>
            {' '}y la{' '}
            <span onClick={() => setVerPrivacidad(true)} style={{ color: '#FF7A2F', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Política de privacidad</span>
            {' '}de GuajiraGo.
          </p>
        </div>
        <button onClick={registrarse} disabled={enviando} style={{ width: '100%', padding: '18px', background: enviando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: enviando ? '#555' : '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>
          {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
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

  
}

export default Login;