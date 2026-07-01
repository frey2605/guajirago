import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

function Anuncio({ tipoUsuario }) {
  const [anuncio, setAnuncio] = useState(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'global'));
        if (!snap.exists()) return;
        const d = snap.data();
        if (!d.anuncioActivo) return;

        // Filtrar por destino: si es solo pasajeros o solo conductores, respetar
        const destino = d.anuncioDestino || 'todos';
        if (destino === 'pasajeros' && tipoUsuario === 'conductor') return;
        if (destino === 'conductores' && tipoUsuario === 'pasajero') return;

        const tipoAnuncio = d.anuncioTipo || 'modal';
        const anuncioId = d.anuncioId || '';

        // Si es ventana y el usuario ya la cerró antes, no volver a mostrarla
        if (tipoAnuncio === 'modal') {
          try {
            if (localStorage.getItem('anuncio_visto_' + anuncioId) === 'si') return;
          } catch (e) {}
        }

        setAnuncio({
          titulo: d.anuncioTitulo || '',
          texto: d.anuncioTexto || '',
          tipo: tipoAnuncio,
          imagen: d.anuncioImagen || '',
          anuncioId: anuncioId,
        });
      } catch (e) {}
    };
    cargar();
  }, [tipoUsuario]);

  if (!anuncio || cerrado) return null;

  const cerrarVentana = () => {
    try { localStorage.setItem('anuncio_visto_' + anuncio.anuncioId, 'si'); } catch (e) {}
    setCerrado(true);
  };

  // 🖼️ Afiche a pantalla completa (cuando hay imagen)
  if (anuncio.imagen) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000000', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={anuncio.imagen} alt="anuncio" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <span onClick={cerrarVentana} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#FFFFFF', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', lineHeight: 1 }}>✕</span>
      </div>
    );
  }

  // 📌 Banner fijo arriba (sin imagen)
  if (anuncio.tipo === 'banner') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99998, background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
        <span style={{ fontSize: '22px' }}>📢</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: '#141416', fontWeight: '900', fontSize: '14px', margin: 0 }}>{anuncio.titulo}</p>
          <p style={{ color: '#3A2400', fontSize: '12px', margin: '2px 0 0', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{anuncio.texto}</p>
        </div>
        <span onClick={() => setCerrado(true)} style={{ color: '#141416', fontSize: '22px', cursor: 'pointer', fontWeight: 'bold', lineHeight: 1 }}>✕</span>
      </div>
    );
  }

  // 🪟 Ventana (modal) de solo texto, una sola vez
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '400px', border: '2px solid #FF7A2F', textAlign: 'center', position: 'relative' }}>
        <span onClick={cerrarVentana} style={{ position: 'absolute', top: '16px', right: '20px', color: '#AAAAAA', fontSize: '26px', cursor: 'pointer', lineHeight: '1' }}>✕</span>
        <div style={{ fontSize: '54px', marginBottom: '12px' }}>📢</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '0 0 12px', lineHeight: '1.25' }}>{anuncio.titulo}</h2>
        <p style={{ color: '#AAAAAA', fontSize: '15px', margin: '0 0 24px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{anuncio.texto}</p>
        <button onClick={cerrarVentana} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
      </div>
    </div>
  );
}

export default Anuncio;