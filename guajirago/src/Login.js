import React, { useState } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

function Login({ onEntrar }) {
  const [modo, setModo] = useState('login');
  const [tipo, setTipo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [placa, setPlaca] = useState('');
  const [vehiculo, setVehiculo] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }
    if (modo === 'registro' && !nombre) {
      setError('Por favor escribe tu nombre');
      return;
    }
    if (modo === 'registro' && tipo === 'conductor' && (!telefono || !placa)) {
      setError('Por favor completa teléfono y placa');
      return;
    }
    setCargando(true);
    setError('');
    try {
      if (modo === 'registro') {
        const resultado = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'usuarios', resultado.user.uid), {
          nombre,
          email,
          tipo,
          telefono: telefono || '',
          placa: placa || '',
          vehiculo: vehiculo || '',
          fechaRegistro: new Date().toISOString(),
        });
        onEntrar(tipo, nombre, telefono, placa, vehiculo);
      } else {
        const resultado = await signInWithEmailAndPassword(auth, email, password);
        const docSnap = await getDoc(doc(db, 'usuarios', resultado.user.uid));
        if (docSnap.exists()) {
          const datos = docSnap.data();
          onEntrar(datos.tipo, datos.nombre, datos.telefono, datos.placa, datos.vehiculo);
        } else {
          onEntrar(tipo, '', '', '', '');
        }
      }
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya esta registrado');
      } else if (err.code === 'auth/weak-password') {
        setError('La contrasena debe tener minimo 6 caracteres');
      } else if (err.code === 'auth/invalid-email') {
        setError('El correo no es valido');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Correo o contrasena incorrectos');
      } else {
        setError('Error al ingresar. Intenta de nuevo');
      }
    }
    setCargando(false);
  };

  if (!tipo) {
    return (
      <div style={{
        backgroundColor: '#141416', minHeight: '100vh',
        fontFamily: 'Arial, sans-serif', display: 'flex',
        flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 24px',
      }}>
        <h1 style={{
          fontSize: '42px', color: '#FFFFFF', margin: '0',
          fontFamily: 'Arial Black, sans-serif', letterSpacing: '-1px', textAlign: 'center',
        }}>Guajira</h1>
        <h1 style={{
          fontSize: '56px',
          background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          margin: '0 0 40px', fontFamily: 'Arial Black, sans-serif', letterSpacing: '-2px',
        }}>GO</h1>
        <p style={{ color: '#555', fontSize: '14px', letterSpacing: '3px', marginBottom: '24px' }}>
          COMO VAS A USAR GUAJIRAGO
        </p>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div onClick={() => setTipo('pasajero')} style={{
            background: '#1A1A1E', borderRadius: '20px', padding: '24px',
            display: 'flex', alignItems: 'center', gap: '16px',
            cursor: 'pointer', border: '1px solid #2A2A2E',
          }}>
            <span style={{ fontSize: '40px' }}>🙋</span>
            <div>
              <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Soy pasajero</p>
              <p style={{ color: '#555', fontSize: '13px', margin: '4px 0 0' }}>Quiero solicitar taxi o mototaxi</p>
            </div>
          </div>
          <div onClick={() => setTipo('conductor')} style={{
            background: '#1A1A1E', borderRadius: '20px', padding: '24px',
            display: 'flex', alignItems: 'center', gap: '16px',
            cursor: 'pointer', border: '1px solid #2A2A2E',
          }}>
            <span style={{ fontSize: '40px' }}>🚗</span>
            <div>
              <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Soy conductor</p>
              <p style={{ color: '#555', fontSize: '13px', margin: '4px 0 0' }}>Quiero recibir y hacer viajes</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#141416', minHeight: '100vh',
      fontFamily: 'Arial, sans-serif', display: 'flex',
      flexDirection: 'column', justifyContent: 'center', padding: '32px 24px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <span style={{ fontSize: '48px' }}>{tipo === 'pasajero' ? '🙋' : '🚗'}</span>
        <h2 style={{ color: '#FFFFFF', margin: '12px 0 0', fontSize: '22px' }}>
          {tipo === 'pasajero' ? 'Entrar como pasajero' : 'Entrar como conductor'}
        </h2>
      </div>

      <div style={{
        display: 'flex', background: '#1A1A1E',
        borderRadius: '16px', padding: '4px', marginBottom: '24px',
      }}>
        <button onClick={() => setModo('login')} style={{
          flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
          cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
          background: modo === 'login' ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : 'transparent',
          color: modo === 'login' ? '#141416' : '#555',
        }}>Iniciar sesion</button>
        <button onClick={() => setModo('registro')} style={{
          flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
          cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
          background: modo === 'registro' ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : 'transparent',
          color: modo === 'registro' ? '#141416' : '#555',
        }}>Registrarse</button>
      </div>

      {/* Nombre */}
      {modo === 'registro' && (
        <div style={{
          background: '#1A1A1E', borderRadius: '16px',
          padding: '16px', marginBottom: '12px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre completo"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
          />
        </div>
      )}

      {/* Campos extra para conductor */}
      {modo === 'registro' && tipo === 'conductor' && (
        <>
          <div style={{
            background: '#1A1A1E', borderRadius: '16px',
            padding: '16px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '20px' }}>📞</span>
            <input value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="Tu número de teléfono"
              type="tel"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
            />
          </div>
          <div style={{
            background: '#1A1A1E', borderRadius: '16px',
            padding: '16px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '20px' }}>🚘</span>
            <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())}
              placeholder="Placa del vehículo (ej: GUA 123)"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
            />
          </div>
          <div style={{
            background: '#1A1A1E', borderRadius: '16px',
            padding: '16px', marginBottom: '12px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span style={{ fontSize: '20px' }}>🏷️</span>
            <input value={vehiculo} onChange={e => setVehiculo(e.target.value)}
              placeholder="Tipo de vehículo (ej: Chevrolet Spark)"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
            />
          </div>
        </>
      )}

      {/* Email */}
      <div style={{
        background: '#1A1A1E', borderRadius: '16px',
        padding: '16px', marginBottom: '12px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '20px' }}>📧</span>
        <input value={email} onChange={e => setEmail(e.target.value)}
          placeholder="Tu correo electronico" type="email"
          style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
        />
      </div>

      {/* Password */}
      <div style={{
        background: '#1A1A1E', borderRadius: '16px',
        padding: '16px', marginBottom: '12px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <span style={{ fontSize: '20px' }}>🔒</span>
        <input value={password} onChange={e => setPassword(e.target.value)}
          placeholder="Contrasena minimo 6 caracteres" type="password"
          style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}
        />
      </div>

      {error && (
        <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>
          {error}
        </p>
      )}

      <button onClick={handleAuth} style={{
        width: '100%', padding: '18px',
        background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
        border: 'none', borderRadius: '16px',
        color: cargando ? '#555' : '#141416',
        fontSize: '18px', fontWeight: '900', cursor: 'pointer',
      }}>
        {cargando ? 'Cargando...' : modo === 'login' ? 'Entrar a GuajiraGo' : 'Crear cuenta'}
      </button>

      <button onClick={() => setTipo('')} style={{
        background: 'none', border: 'none',
        color: '#555', fontSize: '13px',
        cursor: 'pointer', marginTop: '16px',
      }}>
        Volver
      </button>
    </div>
  );
}

export default Login;