import React, { useState } from 'react';
import { db, auth } from './firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';

function Calificacion({ tipo, viajeId, nombreCalificado, quienCalifica, onFinalizar }) {
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (estrellas === 0 || enviando) return;
    setEnviando(true);
    try {
      // Guardar calificación en Firestore
      await addDoc(collection(db, 'calificaciones'), {
        viajeId,
        quienCalifica,
        nombreCalificado: nombreCalificado || '',
        estrellas,
        comentario,
        fecha: new Date().toISOString(),
      });
      // Marcar en el viaje que ya calificó
      if (viajeId) {
        const campo = quienCalifica === 'pasajero' ? 'calificadoPorPasajero' : 'calificadoPorConductor';
        await updateDoc(doc(db, 'viajes', viajeId), { [campo]: true, [`estrellas_${quienCalifica}`]: estrellas });
      }
    } catch (e) {}
    onFinalizar();
  };

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '24px' }}>
        {quienCalifica === 'pasajero' ? (tipo === 'Taxi' ? '🚗' : '🏍️') : '🙋'}
      </div>
      <h2 style={{ color: '#FFFFFF', fontSize: '24px', margin: '0 0 8px', textAlign: 'center' }}>
        {quienCalifica === 'pasajero' ? '¡Llegaste a tu destino!' : '¡Viaje completado!'}
      </h2>
      <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 32px', textAlign: 'center' }}>
        ¿Cómo fue tu experiencia con <span style={{ color: '#FFCF4D', fontWeight: 'bold' }}>{nombreCalificado || 'el usuario'}</span>?
      </p>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} onClick={() => setEstrellas(star)} style={{ fontSize: '48px', cursor: 'pointer', opacity: star <= estrellas ? 1 : 0.3, transition: 'all 0.2s' }}>⭐</span>
        ))}
      </div>
      <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Deja un comentario (opcional)"
        style={{ width: '100%', padding: '16px', background: '#1A1A1E', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '14px', height: '100px', resize: 'none', outline: 'none', marginBottom: '24px', boxSizing: 'border-box' }}
      />
      <button onClick={enviar} style={{ width: '100%', padding: '18px', background: estrellas > 0 ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)' : '#2A2A2E', border: 'none', borderRadius: '16px', color: estrellas > 0 ? '#141416' : '#AAAAAA', fontSize: '18px', fontWeight: '900', cursor: estrellas > 0 ? 'pointer' : 'default', transition: 'all 0.3s' }}>
        {enviando ? 'Enviando...' : estrellas > 0 ? 'Enviar calificación' : 'Selecciona una estrella'}
      </button>
      <button onClick={onFinalizar} style={{ background: 'none', border: 'none', color: '#AAAAAA', fontSize: '13px', cursor: 'pointer', marginTop: '16px' }}>Omitir</button>
    </div>
  );
}

export default Calificacion;