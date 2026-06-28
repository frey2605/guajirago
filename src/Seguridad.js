import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

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
      } catch (e) {}
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

    let texto = '🚨 *Estoy usando GuajiraGo* y quiero que sepas dónde estoy.';
    if (ubicacion) {
      texto += `\n\n📍 *Mi ubicación:* https://maps.google.com/?q=${ubicacion.lat},${ubicacion.lng}`;
    } else {
      texto += '\n\n📍 No pude obtener mi ubicación exacta en este momento.';
    }

    // Buscar si el pasajero tiene un viaje en curso para añadir ruta y datos del conductor
    try {
      const user = auth.currentUser;
      if (user) {
        const q = query(collection(db, 'viajes'), where('pasajeroId', '==', user.uid));
        const snap = await getDocs(q);
        const viajeActivo = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .find(v => ['confirmado', 'aceptado', 'recogiendo', 'en_punto', 'en_viaje'].includes(v.estado) || ['recogiendo', 'en_punto', 'en_viaje'].includes(v.fase));

        if (viajeActivo) {
          texto += '\n\n🛣️ *MI RUTA*';
          if (viajeActivo.origen) texto += `\n🟢 Origen: ${viajeActivo.origen}`;
          if (viajeActivo.destino) texto += `\n🔴 Destino: ${viajeActivo.destino}`;

          texto += '\n\n🚗 *DATOS DEL CONDUCTOR*';
          if (viajeActivo.conductorNombre) texto += `\n👤 Nombre: ${viajeActivo.conductorNombre}`;
          if (viajeActivo.conductorPlaca) texto += `\n🚘 Placa: ${viajeActivo.conductorPlaca}`;
          if (viajeActivo.conductorColor) texto += `\n🎨 Color: ${viajeActivo.conductorColor}`;
          if (viajeActivo.conductorVehiculo) texto += `\n🏷️ Vehículo: ${viajeActivo.conductorVehiculo}`;
          if (viajeActivo.conductorTelefono) texto += `\n📞 Teléfono: ${viajeActivo.conductorTelefono}`;
          if (viajeActivo.conductorFoto) texto += `\n📸 Foto: ${viajeActivo.conductorFoto}`;
        }
      }
    } catch (e) {}

    const numero = contactoNumero.replace(/\D/g, '');
    const numeroFinal = numero.startsWith('57') ? numero : '57' + numero;
    window.open(`https://wa.me/${numeroFinal}?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const llamarEmergencia = () => {
    window.location.href = 'tel:123';
  };

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Seguridad</h2>
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
        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '3px', margin: '0 0 12px' }}>CONTACTO DE CONFIANZA</p>

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '2px', margin: '0 0 6px' }}>NOMBRE</p>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '12px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>👤</span>
          {editandoNombre ? (
            <input value={contactoNombre} onChange={e => { setContactoNombre(e.target.value); setHayCambios(true); }} autoFocus placeholder="Nombre del contacto" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          ) : (
            <span style={{ color: contactoNombre ? '#FFFFFF' : '#555', fontSize: '16px', flex: 1 }}>{contactoNombre || 'Sin nombre'}</span>
          )}
          <div onClick={() => setEditandoNombre(!editandoNombre)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#2A2A2E', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '13px' }}>✏️</span>
            <span style={{ color: '#AAAAAA', fontSize: '12px', fontWeight: 'bold' }}>Editar</span>
          </div>
        </div>

        <p style={{ color: '#555', fontSize: '11px', letterSpacing: '2px', margin: '0 0 6px' }}>NÚMERO WHATSAPP</p>
        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px' }}>📞</span>
          {editandoNumero ? (
            <input value={contactoNumero} onChange={e => { setContactoNumero(e.target.value); setHayCambios(true); }} autoFocus placeholder="Ej: 3001234567" type="tel" style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }} />
          ) : (
            <span style={{ color: contactoNumero ? '#FFFFFF' : '#555', fontSize: '16px', flex: 1 }}>{contactoNumero || 'Sin número'}</span>
          )}
          <div onClick={() => setEditandoNumero(!editandoNumero)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#2A2A2E', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: '13px' }}>✏️</span>
            <span style={{ color: '#AAAAAA', fontSize: '12px', fontWeight: 'bold' }}>Editar</span>
          </div>
        </div>

        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', margin: '0 0 12px' }}>{error}</p>}
        {mensaje && <p style={{ color: '#2ECC71', fontSize: '14px', textAlign: 'center', margin: '0 0 12px', fontWeight: 'bold' }}>{mensaje}</p>}

        <button onClick={guardar} disabled={guardando || !hayCambios} style={{ width: '100%', padding: '16px', marginBottom: '12px', background: guardando || !hayCambios ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: guardando || !hayCambios ? '#555' : '#141416', fontSize: '16px', fontWeight: '900', cursor: guardando || !hayCambios ? 'default' : 'pointer' }}>
          {guardando ? 'Guardando...' : 'Guardar contacto'}
        </button>

        {/* Compartir ubicación */}
        <div onClick={compartirUbicacion} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', border: '1px solid #25D366', marginTop: '8px' }}>
          <span style={{ fontSize: '32px' }}>📤</span>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0', lineHeight: '1.3' }}>Compartir ubicación, ruta e identidad del conductor</p>
            <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '6px 0 0', lineHeight: '1.4' }}>Nombre, foto, placa, color, marca y modelo</p>
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