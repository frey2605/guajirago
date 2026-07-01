import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

function Anuncio({ tipoUsuario }) {
  const [anuncio, setAnuncio] = useState(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDocs(collection(db, 'anuncios'));
        const hoy = new Date();

        // Convertir a lista y filtrar los que se pueden mostrar
        const candidatos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => {
          // Debe estar activo
          if (a.activo === false) return false;

          // Filtrar por destino
          const destino = a.destino || 'todos';
          if (destino === 'pasajeros' && tipoUsuario === 'conductor') return false;
          if (destino === 'conductores' && tipoUsuario === 'pasajero') return false;

          // Filtrar por fechas (obligatorias)
          if (a.fechaInicio) {
            const inicio = new Date(a.fechaInicio + 'T00:00:00');
            if (hoy < inicio) return false;
          }
          if (a.fechaFin) {
            const fin = new Date(a.fechaFin + 'T23:59:59');
            if (hoy > fin) return false;
          }

          // Filtrar por número de veces (si está activado). Se cuenta por dispositivo.
          if (a.limitarVeces && a.maxVeces > 0) {
            try {
              const vistas = parseInt(localStorage.getItem('anuncio_vistas_' + (a.anuncioId || a.id)) || '0', 10);
              if (vistas >= a.maxVeces) return false;
            } catch (e) {}
          }

          return true;
        });

        if (candidatos.length === 0) return;

        // Cola: el más antiguo primero (por fecha de creación)
        candidatos.sort((a, b) => (a.fechaCreacion || '').localeCompare(b.fechaCreacion || ''));

        // Mostrar el primero de la cola
        const elegido = candidatos[0];
        setAnuncio({
          titulo: elegido.titulo || '',
          texto: elegido.texto || '',
          tipo: elegido.tipo || 'modal',
          imagen: elegido.imagen || '',
          anuncioId: elegido.anuncioId || elegido.id,
          limitarVeces: elegido.limitarVeces || false,
          maxVeces: elegido.maxVeces || 0,
        });
      } catch (e) {}
    };
    cargar();
  }, [tipoUsuario]);

  // Cuando el anuncio se muestra, contamos +1 vista para este dispositivo (si tiene límite)
  useEffect(() => {
    if (!anuncio || !anuncio.limitarVeces || anuncio.maxVeces <= 0) return;
    try {
      const clave = 'anuncio_vistas_' + anuncio.anuncioId;
      const vistas = parseInt(localStorage.getItem(clave) || '0', 10);
      localStorage.setItem(clave, String(vistas + 1));
    } catch (e) {}
  }, [anuncio]);

  if (!anuncio || cerrado) return null;

  const cerrarVentana = () => setCerrado(true);

  // 🖼️ Afiche a pantalla completa (cuando hay imagen)
  if (anuncio.imagen) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000000', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={anuncio.imagen} alt="anuncio" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        <span onClick={cerrarVentana} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#FFFFFF', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', lineHeight: 1 }}>✕</span>
      </div>
    );
  }

  // 📢 Banner a pantalla completa (sin imagen) — texto grande y vistoso
  if (anuncio.tipo === 'banner') {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 28px', textAlign: 'center' }}>
        <span onClick={cerrarVentana} style={{ position: 'absolute', top: '20px', right: '20px', width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.25)', color: '#FFFFFF', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', lineHeight: 1 }}>✕</span>
        <div style={{ fontSize: '72px', marginBottom: '20px' }}>📢</div>
        <h1 style={{ color: '#141416', fontSize: '32px', fontWeight: '900', margin: '0 0 20px', lineHeight: '1.2' }}>{anuncio.titulo}</h1>
        <p style={{ color: '#2A1500', fontSize: '18px', margin: '0 0 36px', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxWidth: '440px', fontWeight: 'bold' }}>{anuncio.texto}</p>
        <button onClick={cerrarVentana} style={{ width: '100%', maxWidth: '340px', padding: '18px', background: '#141416', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
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