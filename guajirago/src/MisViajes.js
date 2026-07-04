import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import Logo from './Logo';

function MisViajes({ onVolver }) {
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setCargando(false); return; }

        const [snapPasajero, snapConductor] = await Promise.all([
          getDocs(query(collection(db, 'viajes'), where('pasajeroId', '==', user.uid), limit(50))),
          getDocs(query(collection(db, 'viajes'), where('conductorId', '==', user.uid), limit(50))),
        ]);

        const idsSeen = new Set();
        const lista = [];

        [...snapPasajero.docs, ...snapConductor.docs].forEach(d => {
          if (!idsSeen.has(d.id)) {
            idsSeen.add(d.id);
            lista.push({ id: d.id, ...d.data() });
          }
        });

        lista
          .filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));

        setViajes(
          lista
            .filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')
            .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud))
        );
      } catch (e) {}
      setCargando(false);
    };
    cargar();
  }, []);

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#1A1A1E', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Mis viajes</h2>
        <Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />
      </div>

      <div style={{ padding: '20px' }}>
        {cargando && <p style={{ color: '#6B7280', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>}
        {!cargando && viajes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '60px', margin: '0 0 16px' }}>🚗</p>
            <p style={{ color: '#6B7280', fontSize: '15px' }}>Aún no tienes viajes</p>
          </div>
        )}
        {viajes.map((v) => {
          const fecha = v.fechaSolicitud ? new Date(v.fechaSolicitud).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          const cancelado = v.estado === 'cancelado';
          const user = auth.currentUser;
          const fuiConductor = v.conductorId === user?.uid;
          return (
            <div key={v.id} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: `1px solid ${cancelado ? '#ECECEF' : '#ECECEF'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>{v.tipo === 'Taxi' ? '🚗' : '🏍️'}</span>
                  <div>
                    <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0' }}>{v.tipo}</p>
                    <p style={{ color: '#6B7280', fontSize: '12px', margin: '3px 0 0' }}>{fecha}</p>
                    <p style={{ color: fuiConductor ? '#FF7A2F' : '#2ECC71', fontSize: '11px', margin: '3px 0 0', fontWeight: 'bold' }}>{fuiConductor ? '🚗 Como conductor' : '🙋 Como pasajero'}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: cancelado ? '#FF4444' : '#2ECC71', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>{cancelado ? 'Cancelado' : 'Completado'}</p>
                  <p style={{ color: '#1A1A1E', fontSize: '18px', fontWeight: '900', margin: '4px 0 0' }}>{v.tarifa}</p>
                </div>
              </div>
              <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ECC71', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{v.origen}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FF7A2F', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0' }}>{v.destino}</p>
                </div>
              </div>
              {!fuiConductor && v.conductorNombre && <p style={{ color: '#6B7280', fontSize: '12px', margin: '10px 0 0' }}>Conductor: <span style={{ color: '#FF7A2F' }}>{v.conductorNombre}</span></p>}
              {cancelado && v.razonCancelacion && <p style={{ color: '#6B7280', fontSize: '12px', margin: '4px 0 0' }}>Razón: {v.razonCancelacion}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MisViajes;