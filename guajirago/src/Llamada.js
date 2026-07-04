import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, setDoc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function Llamada({ viajeId, miRol, nombreOtro, onCerrar }) {
  const [estado, setEstado] = useState(miRol === 'entrante' ? 'entrante' : 'llamando');
  const [duracion, setDuracion] = useState(0);
  const [silenciado, setSilenciado] = useState(false);
  const [altavoz, setAltavoz] = useState(false);
  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const audioRemotoRef = useRef(null);
  const intervaloRef = useRef(null);
  const unsubRef = useRef(null);
  const tonoRef = useRef(null);
  const candidatosLocalesRef = useRef([]);
  const llamadaDocRef = doc(db, 'llamadas', viajeId);

  // El que llama es el "oferente"; el que recibe es el "respondedor"
  const soyOferente = miRol === 'conductor' || miRol === 'pasajero';
  const miCampoCandidatos = soyOferente ? 'candidatosOferente' : 'candidatosRespondedor';
  const campoCandidatosOtro = soyOferente ? 'candidatosRespondedor' : 'candidatosOferente';

  const iniciarTono = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const tocar = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1.0);
      };
      tocar();
      tonoRef.current = setInterval(tocar, 3000);
    } catch (e) {}
  };

  const detenerTono = () => {
    if (tonoRef.current) { clearInterval(tonoRef.current); tonoRef.current = null; }
  };

  useEffect(() => {
    if (soyOferente) {
      iniciarLlamada();
    }
    // El receptor (entrante) no hace nada hasta que toca Contestar
    return () => limpiar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiar = () => {
    detenerTono();
    clearInterval(intervaloRef.current);
    if (unsubRef.current) { try { unsubRef.current(); } catch (e) {} unsubRef.current = null; }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (pcRef.current) { try { pcRef.current.close(); } catch (e) {} pcRef.current = null; }
    if (audioRemotoRef.current) { try { audioRemotoRef.current.srcObject = null; } catch (e) {} }
  };

  // Manejadores comunes de la conexión WebRTC (los usan ambos lados)
  const configurarPeer = (pc) => {
    pc.onicecandidate = async (e) => {
      if (e.candidate) {
        candidatosLocalesRef.current.push(e.candidate.toJSON());
        try {
          await updateDoc(llamadaDocRef, { [miCampoCandidatos]: candidatosLocalesRef.current });
        } catch (err) {}
      }
    };

    pc.ontrack = (event) => {
      detenerTono();
      if (audioRemotoRef.current) {
        audioRemotoRef.current.srcObject = event.streams[0];
        audioRemotoRef.current.play().catch(() => {});
      }
      setEstado('activa');
      clearInterval(intervaloRef.current);
      intervaloRef.current = setInterval(() => setDuracion(d => d + 1), 1000);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setEstado('terminada');
      }
    };
  };

  // EL QUE LLAMA: crea la oferta y espera la respuesta
  const iniciarLlamada = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      configurarPeer(pc);

      const oferta = await pc.createOffer();
      await pc.setLocalDescription(oferta);

      // Crear el documento con la oferta y los candidatos ya reunidos
      await setDoc(llamadaDocRef, {
        estado: 'llamando',
        oferta: { type: oferta.type, sdp: oferta.sdp },
        candidatosOferente: candidatosLocalesRef.current,
        candidatosRespondedor: [],
        inicio: new Date().toISOString(),
      });

      iniciarTono();

      unsubRef.current = onSnapshot(llamadaDocRef, async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        if (data.respuesta && pcRef.current && !pcRef.current.currentRemoteDescription) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.respuesta));
          } catch (e) {}
        }

        if (pcRef.current && pcRef.current.currentRemoteDescription && Array.isArray(data[campoCandidatosOtro])) {
          for (const c of data[campoCandidatosOtro]) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
          }
        }

        if (data.estado === 'terminada') {
          limpiar();
          setEstado('terminada');
          setTimeout(onCerrar, 1500);
        }
      });
    } catch (e) {
      setEstado('error');
    }
  };

  // EL QUE RECIBE: lee la oferta y responde (solo al tocar Contestar)
  const contestar = async () => {
    try {
      setEstado('conectando');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      configurarPeer(pc);

      const snap = await getDoc(llamadaDocRef);
      const data = snap.exists() ? snap.data() : null;
      if (!data || !data.oferta) { setEstado('error'); return; }

      await pc.setRemoteDescription(new RTCSessionDescription(data.oferta));
      const respuesta = await pc.createAnswer();
      await pc.setLocalDescription(respuesta);

      await updateDoc(llamadaDocRef, {
        respuesta: { type: respuesta.type, sdp: respuesta.sdp },
        estado: 'activa',
      });

      // Agregar los candidatos del que llamó que ya estaban guardados
      if (Array.isArray(data.candidatosOferente)) {
        for (const c of data.candidatosOferente) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
        }
      }

      unsubRef.current = onSnapshot(llamadaDocRef, async (snap2) => {
        if (!snap2.exists()) return;
        const d = snap2.data();

        if (pcRef.current && pcRef.current.currentRemoteDescription && Array.isArray(d.candidatosOferente)) {
          for (const c of d.candidatosOferente) {
            try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
          }
        }

        if (d.estado === 'terminada') {
          limpiar();
          setEstado('terminada');
          setTimeout(onCerrar, 1500);
        }
      });
    } catch (e) {
      setEstado('error');
    }
  };

  const rechazar = async () => {
    try { await updateDoc(llamadaDocRef, { estado: 'terminada' }); } catch (e) {}
    limpiar();
    onCerrar();
  };

  const colgar = async () => {
    try { await updateDoc(llamadaDocRef, { estado: 'terminada' }); } catch (e) {}
    limpiar();
    setEstado('terminada');
    setTimeout(onCerrar, 1000);
  };

  const toggleSilencio = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => { t.enabled = silenciado; });
      setSilenciado(!silenciado);
    }
  };

  const toggleAltavoz = () => {
    setAltavoz(!altavoz);
  };

  const formatDuracion = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const colorEstado = estado === 'activa' ? '#2ECC71' : estado === 'terminada' || estado === 'error' ? '#FF4444' : '#FFCF4D';
  const textoEstado = estado === 'llamando' ? 'Llamando...' : estado === 'entrante' ? 'Llamada entrante' : estado === 'conectando' ? 'Conectando...' : estado === 'activa' ? 'En llamada' : estado === 'terminada' ? 'Llamada terminada' : 'Error de conexión';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#141416', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>

      <audio ref={audioRemotoRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Avatar animado */}
      <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: `linear-gradient(135deg, #1A1A1E, #2A2A2E)`, border: `3px solid ${colorEstado}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '56px', marginBottom: '24px', boxShadow: estado === 'activa' ? `0 0 30px ${colorEstado}40` : 'none', transition: 'all 0.5s' }}>
        {miRol === 'pasajero' ? '🚗' : '🙋'}
      </div>

      <h2 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: '900', margin: '0 0 8px', textAlign: 'center' }}>{nombreOtro}</h2>

      <p style={{ color: colorEstado, fontSize: '15px', margin: '0 0 8px', fontWeight: 'bold' }}>{textoEstado}</p>

      {estado === 'activa' && (
        <p style={{ color: '#2ECC71', fontSize: '22px', fontWeight: '900', margin: '0 0 48px', fontVariantNumeric: 'tabular-nums' }}>{formatDuracion(duracion)}</p>
      )}
      {estado !== 'activa' && <div style={{ height: '74px' }} />}

      {/* Llamada entrante: botones Contestar/Rechazar */}
      {estado === 'entrante' && (
        <div style={{ display: 'flex', gap: '32px', alignItems: 'center', marginBottom: '48px' }}>
          <div onClick={rechazar} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF4444, #CC0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', boxShadow: '0 6px 24px rgba(255,68,68,0.5)' }}>📵</div>
            <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0', fontWeight: 'bold' }}>Rechazar</p>
          </div>
          <div onClick={contestar} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', boxShadow: '0 6px 24px rgba(46,204,113,0.5)' }}>📞</div>
            <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0', fontWeight: 'bold' }}>Contestar</p>
          </div>
        </div>
      )}

      {/* Controles durante la llamada */}
      {(estado === 'llamando' || estado === 'conectando' || estado === 'activa') && (
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '48px' }}>

          {/* Silenciar */}
          <div onClick={toggleSilencio} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: silenciado ? '#FF4444' : 'rgba(255,255,255,0.1)', border: `2px solid ${silenciado ? '#FF4444' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: silenciado ? '0 4px 16px rgba(255,68,68,0.4)' : 'none' }}>
              {silenciado ? '🔇' : '🎤'}
            </div>
            <p style={{ color: '#FFFFFF', fontSize: '12px', margin: '0', fontWeight: 'bold' }}>{silenciado ? 'Activar mic' : 'Silenciar'}</p>
          </div>

          {/* Colgar */}
          <div onClick={colgar} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF4444, #CC0000)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', boxShadow: '0 6px 24px rgba(255,68,68,0.5)' }}>
              📵
            </div>
            <p style={{ color: '#FFFFFF', fontSize: '12px', margin: '0', fontWeight: 'bold' }}>Colgar</p>
          </div>

          {/* Altavoz */}
          <div onClick={toggleAltavoz} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: altavoz ? '#2ECC71' : 'rgba(255,255,255,0.1)', border: `2px solid ${altavoz ? '#2ECC71' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', boxShadow: altavoz ? '0 4px 16px rgba(46,204,113,0.4)' : 'none' }}>
              {altavoz ? '🔊' : '🔈'}
            </div>
            <p style={{ color: '#FFFFFF', fontSize: '12px', margin: '0', fontWeight: 'bold' }}>{altavoz ? 'Altavoz on' : 'Altavoz'}</p>
          </div>

        </div>
      )}

      {(estado === 'terminada' || estado === 'error') && (
        <button onClick={onCerrar} style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>
          Volver
        </button>
      )}
    </div>
  );
}

export default Llamada;