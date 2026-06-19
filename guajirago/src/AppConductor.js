import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

function AppConductor({ nombre, telefono, placa, vehiculo }) {
  const [activo, setActivo] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const [viaje, setViaje] = useState(false);
  const [viajeActual, setViajeActual] = useState(null);

  const cerrarSesion = async () => {
    await signOut(auth);
    window.location.reload();
  };

  useEffect(() => {
    if (!activo) { setSolicitud(null); return; }
    const q = query(collection(db, 'viajes'), where('estado', '==', 'esperando'));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const primerViaje = snap.docs[0];
        setSolicitud({ id: primerViaje.id, ...primerViaje.data() });
      } else {
        setSolicitud(null);
      }
    });
    return () => unsub();
  }, [activo]);

  const aceptarViaje = async () => {
    if (!solicitud) return;
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, 'viajes', solicitud.id), {
        estado: 'aceptado',
        conductorId: user.uid,
        conductorNombre: nombre || 'Conductor',
        conductorTelefono: telefono || '',
        conductorPlaca: placa || '',
        conductorVehiculo: vehiculo || '',
      });
      setViajeActual(solicitud);
      setViaje(true);
      setSolicitud(null);
    } catch (err) {
      console.error('Error aceptando viaje:', err);
    }
  };

  const finalizarViaje = async () => {
    if (viajeActual) {
      try {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'finalizado' });
      } catch (err) {
        console.error('Error finalizando viaje:', err);
      }
    }
    setViaje(false);
    setViajeActual(null);
  };

  if (viaje && viajeActual) {
    return (
      <div style={{
        backgroundColor: '#141416', minHeight: '100vh',
        fontFamily: 'Arial, sans-serif', display: 'flex',
        flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ fontSize: '60px', marginBottom: '24px' }}>
          {viajeActual.tipo === 'Taxi' ? '🚗' : '🏍️'}
        </div>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', margin: '0 0 8px', textAlign: 'center' }}>
          Viaje en curso
        </h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 4px' }}>Pasajero: {viajeActual.pasajeroEmail}</p>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 4px' }}>📍 Desde: {viajeActual.origen}</p>
        <p style={{ color: '#FF7A2F', fontSize: '14px', margin: '0 0 32px' }}>🏁 Hasta: {viajeActual.destino}</p>
        <button onClick={finalizarViaje} style={{
          width: '100%', padding: '18px',
          background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
          border: 'none', borderRadius: '16px',
          color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer',
        }}>
          Finalizar viaje
        </button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)',
        padding: '24px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          <p style={{ color: '#555', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>CONDUCTOR</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '20px', margin: '4px 0 8px', fontWeight: '900' }}>
            {nombre || 'Conductor'}
          </h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {placa && (
              <div style={{
                background: '#141416', borderRadius: '8px',
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '14px' }}>🚘</span>
                <span style={{ color: '#FFCF4D', fontSize: '13px', fontWeight: 'bold' }}>{placa}</span>
              </div>
            )}
            {vehiculo && (
              <div style={{
                background: '#141416', borderRadius: '8px',
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '14px' }}>🏷️</span>
                <span style={{ color: '#FFFFFF', fontSize: '13px' }}>{vehiculo}</span>
              </div>
            )}
            {telefono && (
              <div style={{
                background: '#141416', borderRadius: '8px',
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '14px' }}>📞</span>
                <span style={{ color: '#FFFFFF', fontSize: '13px' }}>{telefono}</span>
              </div>
            )}
          </div>
        </div>
        <button onClick={cerrarSesion} style={{
          background: '#141416',
          border: 'none',
          borderRadius: '12px',
          padding: '10px 16px',
          color: '#FF4444',
          fontSize: '13px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          🚪 Salir
        </button>
      </div>

      <div style={{ padding: '24px 20px' }}>
        {/* Toggle disponibilidad */}
        <div style={{
          background: '#1A1A1E', borderRadius: '20px',
          padding: '20px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '16px',
        }}>
          <div>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>
              {activo ? 'Estoy disponible' : 'No disponible'}
            </p>
            <p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>
              {activo ? 'Puedes recibir solicitudes' : 'Actívate para recibir viajes'}
            </p>
          </div>
          <div onClick={() => setActivo(!activo)} style={{
            width: '56px', height: '32px', borderRadius: '16px',
            background: activo ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            padding: '0 4px', justifyContent: activo ? 'flex-end' : 'flex-start',
          }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#FFFFFF' }}/>
          </div>
        </div>

        {activo && !solicitud && (
          <div style={{
            background: '#1A1A1E', borderRadius: '20px',
            padding: '32px 20px', textAlign: 'center',
            border: '1px dashed #2A2A2E',
          }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⏳</p>
            <p style={{ color: '#555', fontSize: '14px', margin: '0' }}>
              Esperando solicitudes de viaje...
            </p>
          </div>
        )}

        {solicitud && (
          <div style={{
            background: '#1A1A1E', borderRadius: '20px',
            padding: '20px', border: '1px solid #FF7A2F',
          }}>
            <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>
              🔔 NUEVA SOLICITUD
            </p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0 0 4px' }}>{solicitud.tipo}</p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 4px' }}>📍 Desde: {solicitud.origen}</p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 16px' }}>🏁 Hasta: {solicitud.destino}</p>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p>
              <p style={{ color: '#2ECC71', fontWeight: '900', fontSize: '24px', margin: '4px 0 0' }}>{solicitud.tarifa}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setSolicitud(null)} style={{
                flex: 1, padding: '14px', background: '#141416',
                border: 'none', borderRadius: '14px',
                color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
              }}>Rechazar</button>
              <button onClick={aceptarViaje} style={{
                flex: 2, padding: '14px',
                background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)',
                border: 'none', borderRadius: '14px',
                color: '#141416', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer',
              }}>✅ Aceptar viaje</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppConductor;