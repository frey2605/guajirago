import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from './firebase';
import { doc, getDoc, updateDoc, setDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function contieneInfoSensible(texto) {
  const limpio = texto.toLowerCase();
  // Secuencias de 7+ dígitos seguidos (posible teléfono)
  if (/\d{7,}/.test(texto.replace(/[\s.-]/g, ''))) return true;
  // Correos electrónicos
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(texto)) return true;
  // Menciones a redes o apps de contacto externo
  const palabrasBloqueadas = ['whatsapp', 'whats app', 'wasap', 'instagram', 'facebook', 'telegram', 'tiktok', 'correo', 'email', 'gmail', 'hotmail', 'llamame', 'llámame', 'celular', 'numero', 'número'];
  return palabrasBloqueadas.some(p => limpio.includes(p));
}

function Creditos({ onVolver }) {
  const [saldo, setSaldo] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensajesRecarga, setMensajesRecarga] = useState([]);
  const [textoChatRecarga, setTextoChatRecarga] = useState('');
  const [errorChatRecarga, setErrorChatRecarga] = useState('');
  const chatRecargaFinRef = useRef(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
      if (!snap.exists()) return;
      setMensajesRecarga(snap.data().mensajesRecarga || []);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (chatRecargaFinRef.current) {
      setTimeout(() => chatRecargaFinRef.current.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [mensajesRecarga]);

  const [subiendoComprobante, setSubiendoComprobante] = useState(false);

  const enviarMensajeRecarga = async () => {
    setErrorChatRecarga('');
    if (!textoChatRecarga.trim()) return;
    if (contieneInfoSensible(textoChatRecarga)) {
      setErrorChatRecarga('No se permite compartir teléfonos, correos ni redes sociales en este chat');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    try {
      const nuevoMensaje = { texto: textoChatRecarga.trim(), autor: 'conductor', fecha: new Date().toISOString() };
      const previos = mensajesRecarga || [];
      await updateDoc(doc(db, 'usuarios', user.uid), { mensajesRecarga: [...previos, nuevoMensaje] });
      setTextoChatRecarga('');
    } catch (e) {}
  };

  const enviarComprobante = async (archivo) => {
    if (!archivo) return;
    const user = auth.currentUser;
    if (!user) return;
    setSubiendoComprobante(true);
    setErrorChatRecarga('');
    try {
      const refArchivo = ref(storage, `recargas/${user.uid}/comprobante_${Date.now()}.jpg`);
      await uploadBytes(refArchivo, archivo);
      const url = await getDownloadURL(refArchivo);
      const nuevoMensaje = { tipo: 'imagen', url, autor: 'conductor', fecha: new Date().toISOString() };
      const previos = mensajesRecarga || [];
      await updateDoc(doc(db, 'usuarios', user.uid), { mensajesRecarga: [...previos, nuevoMensaje] });
    } catch (e) {
      setErrorChatRecarga('No se pudo subir el comprobante. Intenta de nuevo');
    }
    setSubiendoComprobante(false);
  };

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
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '14px 20px', position: 'relative', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: '12px' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', flexShrink: 0 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver</div>
        <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '14px', padding: '6px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p style={{ color: '#141416', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: '900' }}>SALDO DISPONIBLE</p>
          <p style={{ color: '#141416', fontSize: '26px', fontWeight: '900', margin: '0' }}>
            {saldo === null ? '...' : `$${saldo.toLocaleString()}`}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Recargar con código */}
        <p style={{ color: '#FFCF4D', fontSize: '14px', letterSpacing: '2px', margin: '0 0 10px', fontWeight: '900' }}>RECARGAR CON CÓDIGO</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', marginBottom: '8px' }}>
          <div style={{ flex: 1, background: '#FFFFFF', borderRadius: '12px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', border: '2px solid #FF7A2F', boxShadow: '0 0 0 3px rgba(255,122,47,0.15)' }}>
            <span style={{ fontSize: '18px' }}>🎟️</span>
            <input
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="ESCRIBE TU CÓDIGO"
              style={{ background: 'none', border: 'none', outline: 'none', color: '#141416', fontSize: '15px', fontWeight: '900', width: '100%', letterSpacing: '1px' }}
            />
          </div>
          <button
            onClick={recargar}
            disabled={cargando}
            style={{ flexShrink: 0, padding: '0 18px', background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '12px', color: cargando ? '#AAAAAA' : '#141416', fontSize: '14px', fontWeight: '900', cursor: cargando ? 'default' : 'pointer' }}
          >
            {cargando ? '...' : 'Recargar'}
          </button>
        </div>

        {error && <p style={{ color: '#FF4444', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>{error}</p>}
        {mensaje && <p style={{ color: '#2ECC71', fontSize: '13px', textAlign: 'center', marginBottom: '12px', fontWeight: 'bold' }}>{mensaje}</p>}

        {/* Información */}
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', border: '1px solid #FF7A2F' }}>
          <p style={{ color: '#FF7A2F', fontSize: '12px', fontWeight: '900', margin: '0 0 10px', letterSpacing: '2px' }}>💡 ¿CÓMO RECARGAR?</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '22px', flexShrink: 0 }}>1️⃣</span>
            <div>
              <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Realiza tu pago</p>
              <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Envía tu pago por <strong style={{ color: '#FFFFFF' }}>Nequi o Daviplata</strong> al número de GuajiraGo.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>2️⃣</span>
            <div>
              <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Recibe tu código</p>
              <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Te enviaremos un <strong style={{ color: '#FFFFFF' }}>código único</strong> de recarga por el chat de recargas, aquí abajo.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>3️⃣</span>
            <div>
              <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Ingresa el código</p>
              <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Escríbelo arriba y listo, tus créditos se suman al instante.</p>
            </div>
          </div>
        </div>

        {/* Chat de recargas */}
        <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', marginTop: '16px', border: '1px solid #2A2A2E' }}>
          <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>💬 Chat de recargas</p>
          <p style={{ color: '#777', fontSize: '12px', margin: '0 0 14px' }}>Envía tu comprobante de pago o haz un reclamo sobre tu recarga</p>
          <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
            {mensajesRecarga.length === 0 && <p style={{ color: '#555', fontSize: '13px', textAlign: 'center', margin: '12px 0' }}>Sin mensajes aún</p>}
            {mensajesRecarga.map((m, i) => {
              const matchCodigo = m.texto ? m.texto.match(/GGO-[A-Z0-9]{6}/) : null;
              const codigoDetectado = matchCodigo ? matchCodigo[0] : null;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                  <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', borderRadius: '12px', padding: m.tipo === 'imagen' ? '6px' : '10px 14px', maxWidth: '85%' }}>
                    {m.tipo === 'imagen' ? (
                      <img src={m.url} alt="Comprobante" style={{ width: '100%', maxWidth: '220px', borderRadius: '10px', display: 'block' }} />
                    ) : (
                      <>
                        <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0', lineHeight: '1.4', whiteSpace: 'pre-line' }}>{m.texto}</p>
                        {codigoDetectado && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(codigoDetectado).catch(() => {}); setCodigo(codigoDetectado); }}
                            style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: '#FFFFFF', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
                          >
                            📋 Copiar y usar este código
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={chatRecargaFinRef} />
          </div>
          {errorChatRecarga && <p style={{ color: '#FF4444', fontSize: '12px', margin: '0 0 8px' }}>{errorChatRecarga}</p>}
          <div style={{ display: 'flex', gap: '8px' }}>
            <label style={{ width: '46px', height: '46px', flexShrink: 0, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: subiendoComprobante ? 'default' : 'pointer', fontSize: '20px' }}>
              {subiendoComprobante ? '⏳' : '📎'}
              <input type="file" accept="image/*" disabled={subiendoComprobante} onChange={e => { if (e.target.files[0]) enviarComprobante(e.target.files[0]); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
            <input
              value={textoChatRecarga}
              onChange={e => setTextoChatRecarga(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarMensajeRecarga()}
              placeholder="Escribe tu mensaje..."
              style={{ flex: 1, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', padding: '12px 14px', color: '#FFFFFF', fontSize: '15px', outline: 'none' }}
            />
            <button onClick={enviarMensajeRecarga} disabled={!textoChatRecarga.trim()} style={{ padding: '12px 18px', background: textoChatRecarga.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '20px', cursor: textoChatRecarga.trim() ? 'pointer' : 'default' }}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Creditos;
