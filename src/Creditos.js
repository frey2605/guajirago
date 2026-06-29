import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, updateDoc, setDoc, runTransaction } from 'firebase/firestore';

function Creditos({ onVolver }) {
  const [saldo, setSaldo] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  // Cargar el saldo actual del conductor
  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setSaldo(0); return; }
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          setSaldo(snap.data().creditos || 0);
        } else {
          setSaldo(0);
        }
      } catch (e) {
        setSaldo(0);
      }
    };
    cargar();
  }, []);

  const recargar = async () => {
    const cod = codigo.trim().toUpperCase();
    if (!cod) { setError('Escribe un código de recarga'); return; }
    setCargando(true); setError(''); setMensaje('');

    const user = auth.currentUser;
    if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); setCargando(false); return; }

    try {
      const refCodigo = doc(db, 'codigos', cod);
      const refUsuario = doc(db, 'usuarios', user.uid);

      // Transacción: verifica y aplica el código de forma atómica (a prueba de doble uso)
      const valorRecargado = await runTransaction(db, async (transaccion) => {
        const snapCodigo = await transaccion.get(refCodigo);
        if (!snapCodigo.exists()) {
          throw new Error('CODIGO_NO_EXISTE');
        }
        const datosCodigo = snapCodigo.data();
        if (datosCodigo.usado === true) {
          throw new Error('CODIGO_USADO');
        }
        const valor = datosCodigo.valor || 0;
        if (valor <= 0) {
          throw new Error('CODIGO_INVALIDO');
        }

        const snapUsuario = await transaccion.get(refUsuario);
        const saldoActual = snapUsuario.exists() ? (snapUsuario.data().creditos || 0) : 0;
        const nuevoSaldo = saldoActual + valor;

        // Marcar el código como usado
        transaccion.update(refCodigo, {
          usado: true,
          usadoPor: user.uid,
          fechaUso: new Date().toISOString(),
        });
        // Sumar los créditos al conductor
        transaccion.set(refUsuario, { creditos: nuevoSaldo }, { merge: true });

        return valor;
      });

      // Recargar saldo en pantalla
      const snap = await getDoc(refUsuario);
      setSaldo(snap.exists() ? (snap.data().creditos || 0) : 0);
      setCodigo('');
      setMensaje(`¡Recargaste $${valorRecargado.toLocaleString()} en créditos! 🎉`);
    } catch (e) {
      if (e.message === 'CODIGO_NO_EXISTE') setError('Ese código no existe. Verifícalo');
      else if (e.message === 'CODIGO_USADO') setError('Ese código ya fue usado');
      else if (e.message === 'CODIGO_INVALIDO') setError('Código inválido');
      else setError('Error al recargar. Revisa tu conexión e intenta de nuevo');
    }
    setCargando(false);
  };

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver</div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Mis créditos</h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        {/* Tarjeta de saldo */}
        <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', borderRadius: '24px', padding: '28px 24px', marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(20,20,22,0.7)', fontSize: '13px', margin: '0', letterSpacing: '2px', fontWeight: 'bold' }}>SALDO DISPONIBLE</p>
          <p style={{ color: '#141416', fontSize: '44px', fontWeight: '900', margin: '8px 0 0' }}>
            {saldo === null ? '...' : `$${saldo.toLocaleString()}`}
          </p>
        </div>

        {/* Recargar con código */}
        <p style={{ color: '#AAAAAA', fontSize: '11px', letterSpacing: '3px', margin: '0 0 12px' }}>RECARGAR CON CÓDIGO</p>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>🎟️</span>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            placeholder="Escribe tu código"
            style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%', letterSpacing: '1px' }}
          />
        </div>

        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
        {mensaje && <p style={{ color: '#2ECC71', fontSize: '14px', textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>{mensaje}</p>}

        <button
          onClick={recargar}
          disabled={cargando}
          style={{ width: '100%', padding: '18px', background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: cargando ? '#AAAAAA' : '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer', marginBottom: '20px' }}
        >
          {cargando ? 'Recargando...' : 'Recargar créditos'}
        </button>

        {/* Información */}
        <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '24px', border: '1px solid #FF7A2F' }}>
          <p style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: '900', margin: '0 0 16px', letterSpacing: '2px' }}>💡 ¿CÓMO RECARGAR?</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>1️⃣</span>
            <div>
              <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Realiza tu pago</p>
              <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Envía tu pago por <strong style={{ color: '#FFFFFF' }}>Nequi o Daviplata</strong> al número de GuajiraGo.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>2️⃣</span>
            <div>
              <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Recibe tu código</p>
              <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Te enviaremos un <strong style={{ color: '#FFFFFF' }}>código único</strong> de recarga por WhatsApp.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>3️⃣</span>
            </div>
          </div>
      </div>
    </div>
  );
}

export default Creditos;
