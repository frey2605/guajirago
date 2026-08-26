import React, { useState } from 'react';
import { db } from './firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
// REGLA 9 — el motivo del rechazo sale de UN solo archivo, compartido con
// Restaurantes.js. Si se escribiera aqui, en un mes dirian cosas distintas.
import { motivoDeRechazo, apuntarRechazo } from './avisoCalificacion';

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
  const [aviso, setAviso] = useState(null);

  const opciones = quienCalifica === 'pasajero' ? OPCIONES_PASAJERO : OPCIONES_CONDUCTOR;

  const toggleOpcion = (texto) => {
    setOpcionesSeleccionadas(prev =>
      prev.includes(texto) ? prev.filter(o => o !== texto) : [...prev, texto]
    );
  };

  const enviar = async () => {
    if (estrellas === 0 || enviando) return;
    setEnviando(true);
    // Son DOS escrituras y la que cuenta es la PRIMERA: si el addDoc entra y el
    // updateDoc del viaje falla, la calificación YA ESTÁ GUARDADA. Sin esto se
    // le decía «no pudimos guardarla» a quien sí había calificado, y se le
    // invitaba a reintentar — y las reglas no impiden una segunda calificación
    // del mismo viaje, así que el mismo voto contaría dos veces en la media.
    let guardada = false;
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
      guardada = true;
      // Marcar en el viaje que ya calificó
      if (viajeId) {
        const campo = quienCalifica === 'pasajero' ? 'calificadoPorPasajero' : 'calificadoPorConductor';
        await updateDoc(doc(db, 'viajes', viajeId), { [campo]: true, [`estrellas_${quienCalifica}`]: estrellas });
      }
    } catch (e) {
      // REGLA 9 del dueño — «nada se rechaza en silencio». Esto era `catch (e) {}`
      // Y ADEMAS se llamaba a onFinalizar() pasara lo que pasara: la pantalla se
      // cerraba igual y el pasajero se iba creyendo que habia calificado. De los
      // 16 viajes terminados que hay en el servidor, CERO estan calificados por
      // ninguno de los dos lados — y con este catch no habia forma de saber si
      // era porque nadie quiso o porque nunca entro ninguna.
      //
      // Ahora: se apunta, se le dice, y NO se cierra. Puede reintentar, o salir
      // por «Omitir», que sigue donde estaba.
      apuntarRechazo('Calificacion.js (viaje ' + (viajeId || 'sin id') + ')', e);
      // Si entró, lo que falló fue la marca del viaje: se sigue como si nada,
      // que es la verdad. Avisar aquí sería mentir e invitar a calificar otra vez.
      if (!guardada) {
        setAviso(motivoDeRechazo(e));
        setEnviando(false);
        return;
      }
    }
    onFinalizar();
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '48px', marginBottom: '24px' }}>
        {quienCalifica === 'pasajero' ? (tipo === 'Taxi' ? '🚗' : '🏍️') : '🙋'}
      </div>
      <h2 style={{ color: '#1A1A1E', fontSize: '24px', margin: '0 0 8px', textAlign: 'center' }}>
        {quienCalifica === 'pasajero' ? '¡Llegaste a tu destino!' : '¡Viaje completado!'}
      </h2>
      <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 32px', textAlign: 'center' }}>
        ¿Cómo fue tu experiencia con <span style={{ color: '#FF7A2F', fontWeight: 'bold' }}>{nombreCalificado || 'el usuario'}</span>?
      </p>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} onClick={() => setEstrellas(star)} style={{ fontSize: '48px', cursor: 'pointer', opacity: star <= estrellas ? 1 : 0.3, transition: 'all 0.2s' }}>⭐</span>
        ))}
      </div>
      <div style={{ width: '100%', marginBottom: '20px' }}>
        <p style={{ color: '#6B7280', fontSize: '12px', letterSpacing: '2px', margin: '0 0 12px', textAlign: 'center' }}>¿QUÉ DESTACAS?</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
          {opciones.map((op, i) => {
            const seleccionada = opcionesSeleccionadas.includes(op.texto);
            return (
              <button key={i} onClick={() => toggleOpcion(op.texto)} style={{
                padding: '8px 14px',
                borderRadius: '20px',
                border: seleccionada ? 'none' : '1px solid #ECECEF',
                background: seleccionada ? (op.buena ? 'linear-gradient(135deg, #2ECC71, #27AE60)' : 'linear-gradient(135deg, #FF4444, #CC0000)') : '#FFFFFF',
                color: seleccionada ? '#FFFFFF' : '#1A1A1E',
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
        style={{ width: '100%', padding: '16px', background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', color: '#1A1A1E', fontSize: '14px', height: '100px', resize: 'none', outline: 'none', marginBottom: '24px', boxSizing: 'border-box' }}
      />
      <button onClick={enviar} style={{ width: '100%', padding: '18px', background: estrellas > 0 ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '16px', color: estrellas > 0 ? '#FFFFFF' : '#6B7280', fontSize: '18px', fontWeight: '900', cursor: estrellas > 0 ? 'pointer' : 'default', transition: 'all 0.3s' }}>
        {enviando ? 'Enviando...' : estrellas > 0 ? 'Enviar calificación' : 'Selecciona una estrella'}
      </button>
      <button onClick={onFinalizar} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '13px', cursor: 'pointer', marginTop: '16px' }}>Omitir</button>

      {/* Ventanita: la calificacion no entro. Misma forma que las de Restaurantes.js
          a proposito — el dueño quiere que TODO aviso sea una ventanita, y que se
          parezcan entre si. */}
      {aviso && (
        <div onClick={() => setAviso(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '28px 24px', width: '100%', maxWidth: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '46px', marginBottom: '8px' }}>⭐</div>
            <p style={{ color: '#1A1A1E', fontSize: '17px', fontWeight: '900', margin: '0 0 8px' }}>{aviso.titulo}</p>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 20px' }}>{aviso.texto}</p>
            <button onClick={() => setAviso(null)} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calificacion;