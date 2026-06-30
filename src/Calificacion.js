import React, { useState } from 'react';
import { db, auth } from './firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';

const OPCIONES_PASAJERO = [
  { texto: 'Llegó rápido', buena: true },
  { texto: 'Buen trato', buena: true },
  { texto: 'Conducción segura', buena: true },
  { texto: 'Vehículo limpio', buena: true },
  { texto: 'Llegó tarde', buena: false },
  { texto: 'Mal trato', buena: false },
  { texto: 'Conducción peligrosa', buena: false },
  { texto: 'Vehículo sucio', buena: false },
  { texto: 'Canceló sin avisar', buena: false },
];

const OPCIONES_CONDUCTOR = [
  { texto: 'Pasajero puntual', buena: true },
  { texto: 'Trato respetuoso', buena: true },
  { texto: 'Buen comunicador', buena: true },
  { texto: 'Sin contratiempos', buena: true },
  { texto: 'Hizo esperar mucho', buena: false },
  { texto: 'Trato grosero', buena: false },
  { texto: 'Dirección incorrecta', buena: false },
  { texto: 'Canceló sin avisar', buena: false },
];

function Calificacion({ tipo, viajeId, nombreCalificado, calificadoId, quienCalifica, onFinalizar }) {
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [opcionesSeleccionadas, setOpcionesSeleccionadas] = useState([]);

  const opciones = quienCalifica === 'pasajero' ? OPCIONES_PASAJERO : OPCIONES_CONDUCTOR;

  const toggleOpcion = (texto) => {
    setOpcionesSeleccionadas(prev =>
      prev.includes(texto) ? prev.filter(o => o !== texto) : [...prev, texto]
    );
  };

  const enviar = async () => {
    if (estrellas === 0 || enviando) return;
    setEnviando(true);
    try {
      // Guardar calificación en Firestore
      await addDoc(collection(db, 'calificaciones'), {
        viajeId,
        quienCalifica,
        calificadoId: calificadoId || '',
        nombreCalificado: nombreCalificado || '',
        estrellas,
        opcionesSeleccionadas,
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
      <div style={{ width: '100%', marginBottom: '20px' }}>
        <p style={{ color: '#AAAAAA', fontSize: '12px', letterSpacing: '2px', margin: '0 0 12px', textAlign: 'center' }}>¿QUÉ DESTACAS?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {opciones.map((op, i) => {
            const seleccionada = opcionesSeleccionadas.includes(op.texto);
            return (
              <button key={i} onClick={() => toggleOpcion(op.texto)} style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: seleccionada ? 'none' : '1px solid #2A2A2E',
                background: seleccionada ? (op.buena ? 'linear-gradient(135deg, #2ECC71, #27AE60)' : 'linear-gradient(135deg, #FF4444, #CC0000)') : '#1A1A1E',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: seleccionada ? '900' : '500',
                cursor: 'pointer',
              }}>
                {op.buena ? '✅' : '❌'} {op.texto}
              </button>
            );
          })}
        </div>
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