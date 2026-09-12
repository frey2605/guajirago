import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Logo from './Logo';
// Qué cuenta como «viaje en curso» vive en un solo sitio (SEGUNDA LEY). Esta
// pantalla lo tenía escrito a mano y por eso mandaba los datos de un viaje
// terminado — lee el porqué entero en estadosViaje.js.
import { elViajeEnCurso } from './estadosViaje';
// Y el texto del mensaje se arma aparte, en un archivo puro que SÍ se puede
// probar (mismo trato que avisoCalificacion.js). Ahí está escrito por qué el
// mensaje tiene que DECIR lo que no pudo conseguir — REGLA 9.
import { armarMensajeDeEmergencia } from './mensajeEmergencia';

function Seguridad({ onVolver }) {
  const [contactoNombre, setContactoNombre] = useState('');
  const [contactoNumero, setContactoNumero] = useState('');
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [editandoNumero, setEditandoNumero] = useState(false);
  const [hayCambios, setHayCambios] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ubicacion, setUbicacion] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setContactoNombre(d.contactoConfianzaNombre || '');
          setContactoNumero(d.contactoConfianzaNumero || '');
        }
      } catch (e) {
        // ESTE `catch` ESTABA VACÍO. Si falla, los campos se quedan en blanco y
        // el pasajero cree que nunca guardó un contacto de confianza — cuando a
        // lo mejor lo tiene guardado y lo que falló fue leerlo. Peor todavía: si
        // escribe otro encima, pisa el que había. REGLA 9: que se entere.
        setError('No pude cargar tu contacto guardado. Revisa tu conexión antes de cambiarlo.');
      }
    };
    cargar();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacion({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  const guardar = async () => {
    if (!contactoNombre.trim()) { setError('Escribe el nombre del contacto'); return; }
    if (!contactoNumero.trim()) { setError('Escribe el número del contacto'); return; }
    setGuardando(true); setError(''); setMensaje('');
    try {
      const user = auth.currentUser;
      if (!user) { setError('Error de sesión'); setGuardando(false); return; }
      await setDoc(doc(db, 'usuarios', user.uid), {
        contactoConfianzaNombre: contactoNombre.trim(),
        contactoConfianzaNumero: contactoNumero.trim(),
      }, { merge: true });
      setHayCambios(false);
      setEditandoNombre(false);
      setEditandoNumero(false);
      setMensaje('¡Contacto guardado! ✅');
    } catch (e) {
      setError('Error al guardar. Revisa tu conexión');
    }
    setGuardando(false);
  };

  const compartirUbicacion = async () => {
    if (!contactoNumero.trim()) {
      setError('Primero guarda un contacto de confianza');
      return;
    }
    setError('');

    // BUSCAR EL VIAJE EN CURSO, para meterle al mensaje la ruta y el conductor.
    //
    // 🔴 ESTE `catch` ESTABA VACÍO, y era el peor sitio del sistema para un
    // fallo callado: si la consulta se caía —sin cobertura, la sesión vencida,
    // las reglas negando— el mensaje de emergencia salía SIN ruta y SIN
    // conductor, y no lo decía. Quien lo recibía no podía distinguir «no iba en
    // ningún viaje» de «no se pudo comprobar». REGLA 9 del dueño.
    //
    // `fallo` es lo que arregla eso, y hay que ver la diferencia con `viaje`:
    //   viaje = null, fallo = null   →  se comprobó y NO hay viaje
    //   viaje = null, fallo = 'viaje' →  NO se pudo comprobar
    // El mensaje dice cada cosa distinto. Eso es todo el arreglo.
    let viajeActivo = null;
    let fallo = null;
    try {
      const user = auth.currentUser;
      if (user) {
        const q = query(collection(db, 'viajes'), where('pasajeroId', '==', user.uid));
        const snap = await getDocs(q);
        // QUIÉN DECIDE si hay viaje en curso: estadosViaje.js, no esta pantalla.
        // Aquí estaba escrito a mano y miraba la FASE sin comprobar que el viaje
        // estuviera vivo: un viaje cancelado o expirado EN MARCHA se queda con su
        // fase pegada, así que entraba. Medido el 11-sep-2026: tres de los cinco
        // de la base recibían los datos de un conductor de un viaje terminado.
        viajeActivo = elViajeEnCurso(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      fallo = 'viaje';
      // Y también en la pantalla, que el pasajero lo vea antes de mandar.
      setError('No pude leer los datos de tu viaje. El mensaje va igual, avisando de eso.');
    }

    // EL TEXTO SE ARMA APARTE (mensajeEmergencia.js) para poder probarlo: dentro
    // de este componente no hay forma de escribir una prueba que mire lo que de
    // verdad sale.
    const texto = armarMensajeDeEmergencia(ubicacion, viajeActivo, fallo);

    const numero = contactoNumero.replace(/\D/g, '');
    const numeroFinal = numero.startsWith('57') ? numero : '57' + numero;
    window.open(`https://wa.me/${numeroFinal}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const llamarEmergencia = () => {
    window.location.href = 'tel:123';
  };

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#1A1A1E', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Seguridad</h2>
        <Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />
      </div>

      <div style={{ padding: '24px 20px' }}>

        {/* Botón emergencia */}
        <div onClick={llamarEmergencia} style={{ background: 'linear-gradient(135deg, #FF4444, #CC0000)', borderRadius: '20px', padding: '24px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '2px solid #FF4444' }}>
          <span style={{ fontSize: '40px' }}>🚨</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '18px', margin: '0' }}>Llamar al 123</p>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', margin: '4px 0 0' }}>Línea de emergencias Colombia</p>
          </div>
        </div>

        {/* Contacto de confianza */}
        <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '3px', margin: '0 0 12px' }}>CONTACTO DE CONFIANZA</p>

        <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 6px' }}>NOMBRE</p>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          {editandoNombre ? (
            <input value={contactoNombre} onChange={e => { setContactoNombre(e.target.value); setHayCambios(true); }} autoFocus placeholder="Nombre del contacto" style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' }} />
          ) : (
            <span style={{ color: contactoNombre ? '#1A1A1E' : '#6B7280', fontSize: '16px', flex: 1 }}>{contactoNombre || 'Sin nombre'}</span>
          )}
          <div onClick={() => setEditandoNombre(!editandoNombre)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ECECEF', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '13px' }}>✏️</span>
            <span style={{ color: '#6B7280', fontSize: '12px', fontWeight: 'bold' }}>Editar</span>
          </div>
        </div>

        <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 6px' }}>NÚMERO WHATSAPP</p>
        <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📞</span>
          {editandoNumero ? (
            <input value={contactoNumero} onChange={e => { setContactoNumero(e.target.value); setHayCambios(true); }} autoFocus placeholder="Ej: 3001234567" type="tel" style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' }} />
          ) : (
            <span style={{ color: contactoNumero ? '#1A1A1E' : '#6B7280', fontSize: '16px', flex: 1 }}>{contactoNumero || 'Sin número'}</span>
          )}
          <div onClick={() => setEditandoNumero(!editandoNumero)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ECECEF', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '13px' }}>✏️</span>
            <span style={{ color: '#6B7280', fontSize: '12px', fontWeight: 'bold' }}>Editar</span>
          </div>
        </div>

        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', margin: '0 0 12px' }}>{error}</p>}
        {mensaje && <p style={{ color: '#2ECC71', fontSize: '14px', textAlign: 'center', margin: '0 0 12px', fontWeight: 'bold' }}>{mensaje}</p>}

        <button onClick={guardar} disabled={guardando || !hayCambios} style={{ width: '100%', padding: '16px', marginBottom: '12px', background: guardando || !hayCambios ? '#E7E7EA' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: guardando || !hayCambios ? '#9AA0A6' : '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: guardando || !hayCambios ? 'default' : 'pointer' }}>
          {guardando ? 'Guardando...' : 'Guardar contacto'}
        </button>

        {/* Compartir ubicación */}
        <div onClick={compartirUbicacion} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #25D366', marginTop: '8px' }}>
          <span style={{ fontSize: '32px' }}>📤</span>
          <div>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0', lineHeight: '1.3' }}>Compartir ubicación, ruta e identidad del conductor</p>
            <p style={{ color: '#6B7280', fontSize: '12px', margin: '6px 0 0', lineHeight: '1.4' }}>Nombre, foto, placa, color, marca y modelo</p>
            <p style={{ color: '#25D366', fontSize: '13px', margin: '6px 0 0' }}>
              {contactoNombre ? `Enviar por WhatsApp a ${contactoNombre}` : 'Guarda un contacto primero'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Seguridad;