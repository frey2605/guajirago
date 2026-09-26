import React, { useState, useEffect, useRef } from 'react';
import { db, auth, storage } from './firebase';
import Logo from './Logo';
// runTransaction salió con la REGLA 7: el canje del código lo hace el servidor.
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
// El filtro anti-datos vive en filtroChat.js: un solo sitio para todos los
// chats de la app (SEGUNDA LEY), amarrado por prueba a la copia del panel.
import { contieneInfoSensible } from './filtroChat';
// LA LEY DEL BOTÓN (26-sep-2026): recargar, el comprobante y el chat pasan por el candado — una sola vez aunque se
// toque dos, su palabra mientras trabaja, la verdad al final en una ventanita, y nunca trabado sin señal.
import { useAccion } from './useAccion';
import AvisoModal from './AvisoModal';

function Creditos({ onVolver }) {
  const [saldo, setSaldo] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const { ocupado, correr, texto, aviso, cerrarAviso } = useAccion();
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

  const enviarMensajeRecarga = async () => {
    setErrorChatRecarga('');
    if (!textoChatRecarga.trim()) return;
    if (contieneInfoSensible(textoChatRecarga)) {
      setErrorChatRecarga('No se permite compartir teléfonos, correos ni redes sociales en este chat');
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    await correr(async () => {
      const nuevoMensaje = { texto: textoChatRecarga.trim(), autor: 'conductor', fecha: new Date().toISOString() };
      // ── UNA RESPUESTA NO PUEDE BORRAR UN MENSAJE (6-sep-2026) ──────────────
      // Esto leía la lista entera, le pegaba el mensaje nuevo y SUBÍA LA LISTA
      // COMPLETA otra vez. Y a esta misma lista le escriben CINCO sitios: dos
      // aquí y tres en el panel. El que subiera de segundo, con la copia que
      // había leído ANTES, borraba lo que el otro acababa de mandar. Sin error
      // y sin rastro: el mensaje simplemente ya no está.
      // Lo que se pierde aquí no es charla — es la FOTO DEL COMPROBANTE que el
      // conductor sube para que le den su recarga.
      // `arrayUnion` le pega el mensaje EN EL SERVIDOR, sin leer nada, así que
      // ningún escritor puede pisar a otro. Es lo que ya hace el otro chat de la
      // casa, el del cliente con el restaurante (Restaurantes.js:414).
      // OJO CON SU ÚNICA CARA: `arrayUnion` descarta elementos IDÉNTICOS campo
      // por campo. Aquí no puede pasar porque cada mensaje lleva `fecha` con
      // milisegundos. MEDIDO el 6-sep-2026 sobre los 9 mensajes que hay en la
      // nube: CERO idénticos y CERO sin fecha.
      await updateDoc(doc(db, 'usuarios', user.uid), { mensajesRecarga: arrayUnion(nuevoMensaje) });
      setTextoChatRecarga('');
      // REGLA 9: nada se rechaza en silencio. Antes: `catch (e) {}` — si el mensaje no salía, el conductor lo veía irse
      // de la caja de texto y creía que había llegado. Ahora el fallo lo dice el candado, en la ventanita.
    }, 'mensaje', 'Mensaje enviado.', 'enviar el mensaje');
  };

  const enviarComprobante = async (archivo) => {
    if (!archivo) return;
    const user = auth.currentUser;
    if (!user) return;
    setErrorChatRecarga('');
    await correr(async () => {
      const refArchivo = ref(storage, `recargas/${user.uid}/comprobante_${Date.now()}.jpg`);
      await uploadBytes(refArchivo, archivo);
      const url = await getDownloadURL(refArchivo);
      const nuevoMensaje = { tipo: 'imagen', url, autor: 'conductor', fecha: new Date().toISOString() };
      // EL COMPROBANTE, por el mismo camino seguro que el texto de arriba: se le
      // pega a la lista EN EL SERVIDOR. Antes, si el dueño contestaba en ese
      // mismo momento, su respuesta subía la lista de ANTES de la foto y la foto
      // desaparecía — justo la prueba de que el conductor pagó.
      await updateDoc(doc(db, 'usuarios', user.uid), { mensajesRecarga: arrayUnion(nuevoMensaje) });
    }, 'comprobante', 'Comprobante enviado. Te contestamos por este chat.', 'subir el comprobante');
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
    setError('');

    const user = auth.currentUser;
    if (!user) { setError('Error de sesión. Vuelve a iniciar sesión'); return; }

    await correr(async () => {
      // REGLA 7 — el canje ya NO se hace aquí. Hasta el 24-ago-2026 este
      // teléfono comprobaba el código y SE SUMABA EL SALDO él mismo; las reglas
      // dejaban escribir 'creditos' a cualquiera, así que ni siquiera hacía
      // falta un código para recargarse. Ahora lo hace el servidor
      // (functions: canjearCodigoRecarga) y la regla congela el campo.
      const canjear = httpsCallable(getFunctions(), 'canjearCodigoRecarga');
      const respuesta = await canjear({ codigo: cod });
      const valorRecargado = (respuesta && respuesta.data && respuesta.data.valor) || 0;

      // Recargar saldo en pantalla
      const snap = await getDoc(doc(db, 'usuarios', user.uid));
      setSaldo(snap.exists() ? (snap.data().creditos || 0) : 0);
      setCodigo('');
      return valorRecargado;
      // El motivo del fallo lo explica el servidor ("Ese código ya fue usado", etc.) y el candado lo respeta tal cual;
      // cuando falla la red y Firebase pone el código pelado ('internal', 'deadline-exceeded'), lo traduce
      // (enCristiano, en candado.js: el criterio que vivía aquí se mudó allí, para todas las pantallas).
    }, 'recargar', (valor) => `¡Recargaste $${valor.toLocaleString()} en créditos! 🎉`, 'canjear el código');
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '14px 20px', position: 'relative', display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: '12px' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', flexShrink: 0 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver</div>
        <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '14px', padding: '6px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p style={{ color: '#FFFFFF', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: '900' }}>SALDO DISPONIBLE</p>
          <p style={{ color: '#FFFFFF', fontSize: '26px', fontWeight: '900', margin: '0' }}>
            {saldo === null ? '...' : `$${saldo.toLocaleString()}`}
          </p>
        </div>
        <Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Recargar con código */}
        <p style={{ color: '#FF7A2F', fontSize: '14px', letterSpacing: '2px', margin: '0 0 10px', fontWeight: '900' }}>RECARGAR CON CÓDIGO</p>
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
            disabled={!!ocupado}
            style={{ flexShrink: 0, padding: '0 18px', background: ocupado ? '#ECECEF' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '12px', color: ocupado ? '#6B7280' : '#FFFFFF', fontSize: '14px', fontWeight: '900', cursor: ocupado ? 'default' : 'pointer' }}
          >
            {texto('recargar', 'Recargando…', 'Recargar')}
          </button>
        </div>

        {error && <p style={{ color: '#FF4444', fontSize: '12px', textAlign: 'center', marginBottom: '8px' }}>{error}</p>}
        {/* La verdad del final, en ventanita. El mensaje del chat que SÍ salió no la abre: se ve en la conversación. */}
        {aviso && !(aviso.ok && aviso.cual === 'mensaje') && (
          <AvisoModal aviso={aviso} onCerrar={cerrarAviso} />
        )}

        {/* Información */}
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', border: '1px solid #FF7A2F' }}>
          <p style={{ color: '#FF7A2F', fontSize: '12px', fontWeight: '900', margin: '0 0 10px', letterSpacing: '2px' }}>💡 ¿CÓMO RECARGAR?</p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '22px', flexShrink: 0 }}>1️⃣</span>
            <div>
              <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Realiza tu pago</p>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Envía tu pago por <strong style={{ color: '#1A1A1E' }}>Nequi o Daviplata</strong> al número de GuajiraGo.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>2️⃣</span>
            <div>
              <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Recibe tu código</p>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Te enviaremos un <strong style={{ color: '#1A1A1E' }}>código único</strong> de recarga por el chat de recargas, aquí abajo.</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>3️⃣</span>
            <div>
              <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>Ingresa el código</p>
              <p style={{ color: '#6B7280', fontSize: '13px', margin: '0', lineHeight: '1.5' }}>Escríbelo arriba y listo, tus créditos se suman al instante.</p>
            </div>
          </div>
        </div>

        {/* Chat de recargas */}
        <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', marginTop: '16px', border: '1px solid #ECECEF' }}>
          <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '0 0 4px' }}>💬 Chat de recargas</p>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 14px' }}>Envía tu comprobante de pago o haz un reclamo sobre tu recarga</p>
          <div style={{ maxHeight: '220px', overflowY: 'auto', marginBottom: '12px' }}>
            {mensajesRecarga.length === 0 && <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', margin: '12px 0' }}>Sin mensajes aún</p>}
            {mensajesRecarga.map((m, i) => {
              const matchCodigo = m.texto ? m.texto.match(/GGO-[A-Z0-9]{6}/) : null;
              const codigoDetectado = matchCodigo ? matchCodigo[0] : null;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                  <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', borderRadius: '12px', padding: m.tipo === 'imagen' ? '6px' : '10px 14px', maxWidth: '85%' }}>
                    {m.tipo === 'imagen' ? (
                      <img src={m.url} alt="Comprobante" style={{ width: '100%', maxWidth: '220px', borderRadius: '10px', display: 'block' }} />
                    ) : (
                      <>
                        <p style={{ color: m.autor === 'conductor' ? '#FFFFFF' : '#1A1A1E', fontSize: '14px', margin: '0', lineHeight: '1.4', whiteSpace: 'pre-line' }}>{m.texto}</p>
                        {codigoDetectado && (
                          <button
                            onClick={() => { navigator.clipboard.writeText(codigoDetectado).catch(() => {}); setCodigo(codigoDetectado); }}
                            style={{ marginTop: '8px', padding: '8px 12px', background: m.autor === 'conductor' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)', border: `1px solid ${m.autor === 'conductor' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)'}`, borderRadius: '8px', color: m.autor === 'conductor' ? '#FFFFFF' : '#1A1A1E', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}
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
            <label style={{ width: '46px', height: '46px', flexShrink: 0, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: ocupado ? 'default' : 'pointer', fontSize: '20px' }}>
              {texto('comprobante', '⏳', '📎')}
              <input type="file" accept="image/*" disabled={!!ocupado} onChange={e => { if (e.target.files[0]) enviarComprobante(e.target.files[0]); e.target.value = ''; }} style={{ display: 'none' }} />
            </label>
            <input
              value={textoChatRecarga}
              onChange={e => setTextoChatRecarga(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarMensajeRecarga()}
              placeholder="Escribe tu mensaje..."
              style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', padding: '12px 14px', color: '#1A1A1E', fontSize: '15px', outline: 'none' }}
            />
            <button onClick={enviarMensajeRecarga} disabled={!textoChatRecarga.trim() || !!ocupado} style={{ padding: '12px 18px', background: textoChatRecarga.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '12px', color: textoChatRecarga.trim() ? '#FFFFFF' : '#6B7280', fontSize: '20px', cursor: textoChatRecarga.trim() ? 'pointer' : 'default' }}>{texto('mensaje', '…', '➤')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Creditos;
