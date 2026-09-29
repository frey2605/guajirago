import React, { useState } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
// collection/query/where/getDocs salieron con la REGLA 6: la unica consulta de
// LISTA que hacia esta pantalla se mudo al servidor (functions: celularDisponible).
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import TerminosCondiciones from './TerminosCondiciones';
import PoliticaPrivacidad from './PoliticaPrivacidad';
import Logo from './Logo';
import AvisoModal from './AvisoModal';
import { telefonoDe } from './telefonoUsuario';
import { telefonoSirve, celularDiezCifras } from './telefonoValido';
import { cop } from './moneda';
import { useAccion } from './useAccion';
import { mandarCorreoDeRecuperacion, CORREO_DE_RECUPERACION_ENVIADO } from './recuperarContrasena';
import { avisoEnUnaLinea } from './avisoRechazo';

// Identificador único de este navegador/dispositivo (persiste en localStorage)
function obtenerDeviceId() {
  try {
    let id = localStorage.getItem('gg_device_id');
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem('gg_device_id', id);
    }
    return id;
  } catch (e) {
    return null;
  }
}

// Obtiene la IP pública del usuario (solo informativa, nunca bloquea el registro)
async function obtenerIP() {
  try {
    const resp = await fetch('https://api.ipify.org?format=json');
    const data = await resp.json();
    return data.ip || '';
  } catch (e) {
    return '';
  }
}

function CelebracionBienvenida({ monto, onContinuar }) {
  const confeti = Array.from({ length: 40 }, (_, i) => i);
  const colores = ['#FFCF4D', '#FF7A2F', '#D6357E', '#1C8EF9', '#2ECC71'];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden' }}>
      {confeti.map(i => (
        <span key={i} style={{
          position: 'absolute', top: '-24px', left: `${Math.random() * 100}%`,
          fontSize: `${16 + Math.random() * 18}px`,
          color: colores[i % colores.length],
          animation: `caerBienvenida ${2.2 + Math.random() * 2}s linear ${Math.random() * 1.2}s infinite`,
        }}>●</span>
      ))}
      <div style={{ fontSize: '30px', marginBottom: '4px', animation: 'rebotarBienvenida 0.6s infinite alternate', zIndex: 2 }}>🎉🎊🎉</div>
      <div style={{ fontSize: '90px', margin: '8px 0 4px', animation: 'rebotarBienvenida 0.6s infinite alternate', zIndex: 2 }}>🎁</div>
      <h1 style={{ color: '#1A1A1E', fontSize: '26px', fontWeight: '900', margin: '8px 0 4px', textAlign: 'center', zIndex: 2 }}>¡Bienvenido a GuajiraGo!</h1>
      <p style={{ color: '#FF7A2F', fontSize: '15px', margin: '0 0 24px', textAlign: 'center', fontWeight: 'bold', zIndex: 2 }}>Tenemos un regalo para ti 🥳</p>
      <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', borderRadius: '28px', padding: '32px 28px', width: '100%', maxWidth: '420px', textAlign: 'center', zIndex: 2, boxShadow: '0 8px 32px rgba(255,122,47,0.4)' }}>
        <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0 0 8px', letterSpacing: '2px', fontWeight: '900' }}>CRÉDITO DE BIENVENIDA</p>
        <p style={{ color: '#FFFFFF', fontSize: '54px', fontWeight: '900', margin: '0', lineHeight: '1' }}>{cop(monto || 0)}</p>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', margin: '14px 0 0', lineHeight: '1.5', fontWeight: 'bold' }}>Ya está en tu cuenta. Úsalo automáticamente en tu primer viaje 🚀</p>
      </div>
      <button onClick={onContinuar} style={{ marginTop: '28px', width: '100%', maxWidth: '420px', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer', zIndex: 2 }}>¡Vamos! 🎉</button>
      <style>{`
        @keyframes caerBienvenida { from { transform: translateY(-24px) rotate(0deg); opacity: 1; } to { transform: translateY(100vh) rotate(360deg); opacity: 0.2; } }
        @keyframes rebotarBienvenida { from { transform: scale(1); } to { transform: scale(1.12); } }
      `}</style>
    </div>
  );
}

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
  const { ocupado, correr, texto, aviso, cerrarAviso } = useAccion();
  const [verPassword, setVerPassword] = useState(false);
  const [verPasswordConfirm, setVerPasswordConfirm] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [verTerminos, setVerTerminos] = useState(false);
  const [verPrivacidad, setVerPrivacidad] = useState(false);
  const [celebracionBienvenida, setCelebracionBienvenida] = useState(null); // { monto, datosEntrar }

  const registrarse = async () => {
    if (!nombre || !email || !emailConfirm || !celular || !diaNac || !mesNac || !anioNac || !password || !passwordConfirm) { setError('Por favor completa todos los campos'); return; }
    if (!contactoNombre.trim()) { setError('Escribe el nombre de tu contacto de emergencia'); return; }
    if (!contactoNumero.trim()) { setError('Escribe el número de tu contacto de emergencia'); return; }
    // ¿Sirve? La MISMA regla que Seguridad al cambiarlo (G10): telefonoValido.js.
    if (!telefonoSirve(contactoNumero)) { setError('El número del contacto de emergencia debe tener 10 dígitos'); return; }
    // G42: el celular propio también pasa por la regla única, y se guarda en 10 cifras limpias. Antes se guardaba
    // tal cual se escribiera («1», «300 123 4567»…) y el servidor lo comparaba letra por letra.
    const celularLimpio = celularDiezCifras(celular);
    if (!celularLimpio) { setError('Tu celular debe tener 10 cifras, por ejemplo 300 123 4567'); return; }
    if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) { setError('Los correos no coinciden'); return; }
    if (password !== passwordConfirm) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener mínimo 6 caracteres'); return; }
    if (!aceptaTerminos) { setError('Debes aceptar los Términos y condiciones para continuar'); return; }
    setEnviando(true); setError('');
    try {
      const cuentaCreada = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

      // Verificar que el celular no esté ya usado por otra cuenta (protege el beneficio de bienvenida)
      // REGLA 6 — antes esto pedía la LISTA de fichas desde el celular, y por eso la
      // lista tenía que estar abierta a cualquiera: ahí quedaban a la vista los
      // teléfonos, las fechas de nacimiento y las fotos de cédula de todo el mundo.
      // Ahora lo pregunta el servidor y contesta solo sí o no (functions: celularDisponible).
      const preguntar = httpsCallable(getFunctions(), 'celularDisponible');
      const respuesta = await preguntar({ celular: celularLimpio });
      if (!(respuesta && respuesta.data && respuesta.data.disponible)) {
        try { await cuentaCreada.user.delete(); } catch (eDel) {}
        try { await auth.signOut(); } catch (eSignOut) {}
        setError('Ese número de celular ya está registrado en otra cuenta');
        setEnviando(false);
        return;
      }

      try { await sendEmailVerification(cuentaCreada.user); } catch (e) {}
      const fechaNacimiento = `${String(diaNac).padStart(2, '0')}/${String(mesNac).padStart(2, '0')}/${anioNac}`;

      let ipRegistro = '';
      try { ipRegistro = await obtenerIP(); } catch (e) {}

      await setDoc(doc(db, 'usuarios', cuentaCreada.user.uid), {
        nombre, email: email.trim().toLowerCase(), celular: celularLimpio, fechaNacimiento,
        contactoConfianzaNombre: contactoNombre.trim(), contactoConfianzaNumero: celularDiezCifras(contactoNumero),
        tipo: '', placa: '', vehiculo: '', fechaRegistro: new Date().toISOString(),
        ipRegistro,
      });

      // G18 — el crédito de bienvenida ya NO lo fabrica este teléfono (valor, código y huella del aparato): con la
      // ficha ya guardada se lo pide al servidor (functions: descuentoDeBienvenida), que decide si le toca, lo
      // escribe y contesta cuánto. Aquí solo se enseña. Si falla, el registro NO se cae: entra sin el regalo.
      let montoBienvenida = 0;
      try {
        const pedirBienvenida = httpsCallable(getFunctions(), 'descuentoDeBienvenida');
        const r = await pedirBienvenida({ deviceId: obtenerDeviceId() });
        montoBienvenida = (r && r.data && r.data.valor) || 0;
      } catch (e) {}

      if (montoBienvenida > 0) {
        setCelebracionBienvenida({ monto: montoBienvenida, datosEntrar: ['', nombre, celularLimpio, '', ''] });
      } else {
        onEntrar('', nombre, celularLimpio, '', '');
      }
    } catch (err) {
      // G72: el texto de cada fallo de la cuenta lo dice avisoRechazo.js, el mismo en las tres apps.
      setError(avisoEnUnaLinea(err, 'crear la cuenta'));
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
        onEntrar(datos.tipo || '', datos.nombre, telefonoDe(datos), datos.placa || '', datos.vehiculo || '');
      } else { onEntrar('', '', '', '', ''); }
    } catch (err) {
      // G72: el texto lo dice avisoRechazo.js («contraseña mala» y «correo sin cuenta» dicen lo mismo).
      setError(avisoEnUnaLinea(err, 'iniciar sesión'));
    }
    setCargando(false);
  };

  // G71: el correo sale de la pieza recuperarContrasena.js, con el mismo aviso exista o no el correo; los fallos los
  // dice el candado con motivoDeRechazo (sin señal, demasiados intentos, correo mal escrito).
  const recuperarContrasena = () => {
    if (!email) { setError('Ingresa tu correo para recuperar la contraseña'); return; }
    setError('');
    return correr(() => mandarCorreoDeRecuperacion(email), 'recuperar', CORREO_DE_RECUPERACION_ENVIADO, 'enviar el correo');
  };

  // ---- Estilos reutilizables del tema claro ----
  const estiloCampo = { background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' };
  const estiloInput = { background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' };
  const btnPrimario = { width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer' };

  if (celebracionBienvenida) return <CelebracionBienvenida monto={celebracionBienvenida.monto} onContinuar={() => onEntrar(...celebracionBienvenida.datosEntrar)} />;
  if (verTerminos) return <TerminosCondiciones onVolver={() => setVerTerminos(false)} />;
  if (verPrivacidad) return <PoliticaPrivacidad onVolver={() => setVerPrivacidad(false)} />;
  if (pantalla === 'inicio') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <img src="/logo-completo.svg" alt="GuajiraGo" style={{ width: '360px', maxWidth: '90vw', height: 'auto', marginBottom: '36px' }} />
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={() => { setError(''); setPantalla('registro'); }} style={btnPrimario}>Crear cuenta</button>
          <button onClick={() => { setError(''); setPantalla('login'); }} style={{ width: '100%', padding: '18px', background: '#FFFFFF', border: '1.5px solid #1C8EF9', borderRadius: '16px', color: '#1C8EF9', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Ya tengo cuenta</button>
        </div>
      </div>
    );
  }

  if (pantalla === 'registro') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px' }}>
        {error && (
          <AvisoModal aviso={{ titulo: 'Atención', texto: error }} onCerrar={() => setError('')} />
        )}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Logo size={64} style={{ marginBottom: '10px' }} />
          <h1 style={{ fontSize: '28px', color: '#1A1A1E', margin: '0', fontFamily: 'Arial Black, sans-serif' }}>Crear cuenta</h1>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '8px 0 0' }}>Ingresa tus datos para registrarte</p>
        </div>
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <input value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())} placeholder="NOMBRE COMPLETO" style={estiloInput} />
        </div>
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>📧</span>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" type="email" style={estiloInput} />
        </div>
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>📧</span>
          <input value={emailConfirm} onChange={e => setEmailConfirm(e.target.value)} onPaste={e => e.preventDefault()} placeholder="Confirmar correo electrónico" type="email" style={estiloInput} />
        </div>
        <div style={estiloCampo}>
          <span style={{ color: '#1A1A1E', fontSize: '16px', fontWeight: '900', whiteSpace: 'nowrap' }}>+57</span>
          <input value={celular} onChange={e => setCelular(e.target.value)} placeholder="3001234567" type="tel" style={estiloInput} />
        </div>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '20px' }}>🎂</span>
            <span style={{ color: '#6B7280', fontSize: '14px' }}>Fecha de nacimiento</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select value={diaNac} onChange={e => setDiaNac(e.target.value)} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px', color: '#1A1A1E', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
              <option value="">Día</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={mesNac} onChange={e => setMesNac(e.target.value)} style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px', color: '#1A1A1E', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
              <option value="">Mes</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={anioNac} onChange={e => setAnioNac(e.target.value)} style={{ flex: 1.3, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px', color: '#1A1A1E', fontSize: '15px', outline: 'none', cursor: 'pointer' }}>
              <option value="">Año</option>
              {Array.from({ length: 90 }, (_, i) => new Date().getFullYear() - 15 - i).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña (mínimo 6 caracteres)" type={verPassword ? 'text' : 'password'} style={estiloInput} />
          <span onClick={() => setVerPassword(!verPassword)} style={{ fontSize: '20px', cursor: 'pointer' }}>{verPassword ? '🙈' : '👁️'}</span>
        </div>
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <input value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} onPaste={e => e.preventDefault()} placeholder="Confirmar contraseña" type={verPasswordConfirm ? 'text' : 'password'} style={estiloInput} />
          <span onClick={() => setVerPasswordConfirm(!verPasswordConfirm)} style={{ fontSize: '20px', cursor: 'pointer' }}>{verPasswordConfirm ? '🙈' : '👁️'}</span>
        </div>
        <p style={{ color: '#FF7A2F', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px 4px', fontWeight: 'bold' }}>🚨 CONTACTO DE EMERGENCIA</p>
        <div style={estiloCampo}>
          <span style={{ fontSize: '20px' }}>👥</span>
          <input value={contactoNombre} onChange={e => setContactoNombre(e.target.value.toUpperCase())} placeholder="Nombre del contacto" style={estiloInput} />
        </div>
        <div style={{ ...estiloCampo, marginBottom: '20px' }}>
          <span style={{ color: '#1A1A1E', fontSize: '16px', fontWeight: '900', whiteSpace: 'nowrap' }}>+57</span>
          <input value={contactoNumero} onChange={e => setContactoNumero(e.target.value)} placeholder="3001234567" type="tel" style={estiloInput} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', padding: '14px', background: '#FFFFFF', borderRadius: '14px', border: `1.5px solid ${aceptaTerminos ? '#FF7A2F' : '#ECECEF'}` }}>
          <div onClick={() => setAceptaTerminos(!aceptaTerminos)} style={{ width: '22px', height: '22px', borderRadius: '6px', background: aceptaTerminos ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#FFFFFF', border: aceptaTerminos ? 'none' : '2px solid #C9CDD3', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}>
            {aceptaTerminos && <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '900' }}>✓</span>}
          </div>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>
            He leído y acepto los{' '}
            <span onClick={() => setVerTerminos(true)} style={{ color: '#FF7A2F', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Términos y condiciones</span>
            {' '}y la{' '}
            <span onClick={() => setVerPrivacidad(true)} style={{ color: '#FF7A2F', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}>Política de privacidad</span>
            {' '}de GuajiraGo.
          </p>
        </div>
        <button onClick={registrarse} disabled={enviando} style={{ ...btnPrimario, background: enviando ? '#E7E7EA' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', color: enviando ? '#9AA0A6' : '#FFFFFF' }}>
          {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
        <button onClick={() => { setError(''); setPantalla('inicio'); }} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer', marginTop: '16px' }}>Volver</button>
      </div>
    );
  }

  if (pantalla === 'login') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '0px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Logo size={80} style={{ marginBottom: '12px' }} />
            <h1 style={{ fontSize: '28px', color: '#1A1A1E', margin: '0', fontFamily: 'Arial Black, sans-serif' }}>Bienvenido</h1>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '8px 0 0' }}>Ingresa con tu correo y contraseña</p>
          </div>
          <div style={estiloCampo}>
            <span style={{ fontSize: '20px' }}>📧</span>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Correo electrónico" type="email" style={estiloInput} />
          </div>
          <div style={estiloCampo}>
            <span style={{ fontSize: '20px' }}>🔒</span>
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Contraseña" type="password" style={estiloInput} />
          </div>
          {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
          {aviso && <AvisoModal aviso={aviso} onCerrar={cerrarAviso} />}
          <button onClick={iniciarSesion} style={{ ...btnPrimario, background: cargando ? '#E7E7EA' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', color: cargando ? '#9AA0A6' : '#FFFFFF', marginBottom: '12px', marginTop: '8px' }}>
            {cargando ? 'Cargando...' : 'Entrar a GuajiraGo'}
          </button>
          <button onClick={recuperarContrasena} disabled={!!ocupado} style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1.5px solid #1C8EF9', borderRadius: '16px', color: '#1C8EF9', fontSize: '15px', fontWeight: '900', cursor: 'pointer', marginBottom: '12px' }}>
            {texto('recuperar', 'Enviando…', '¿Olvidaste tu contraseña?')}
          </button>
          <button onClick={() => { setError(''); setPantalla('inicio'); }} style={{ width: '100%', padding: '14px', background: 'none', border: 'none', color: '#6B7280', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Volver</button>
        </div>
      </div>
    );
  }


}

export default Login;
