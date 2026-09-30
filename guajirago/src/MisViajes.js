import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import Logo from './Logo';
// G21: qué viajes salen en el historial y cómo terminó cada uno salen de UNA pieza, la misma de las otras dos pantallas.
import { ESTADOS_TERMINADOS, comoTermino } from './estadosViaje';
import BotonVolver from './BotonVolver';

function MisViajes({ onVolver }) {
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setCargando(false); return; }

        // G21: los ÚLTIMOS 50 de cada lado, no 50 cualesquiera. Piden los índices pasajeroId/conductorId ASC +
        // fechaSolicitud DESC (firestore.indexes.json), que van ANTES que esta app.
        const [snapPasajero, snapConductor] = await Promise.all([
          getDocs(query(collection(db, 'viajes'), where('pasajeroId', '==', user.uid), orderBy('fechaSolicitud', 'desc'), limit(50))),
          getDocs(query(collection(db, 'viajes'), where('conductorId', '==', user.uid), orderBy('fechaSolicitud', 'desc'), limit(50))),
        ]);

        const idsSeen = new Set();
        const lista = [];

        [...snapPasajero.docs, ...snapConductor.docs].forEach(d => {
          if (!idsSeen.has(d.id)) {
            idsSeen.add(d.id);
            lista.push({ id: d.id, ...d.data() });
          }
        });

        // G21: TODOS los terminados (antes solo `finalizado || cancelado`: 72 viajes escondidos, medido con
        // scripts/medir-historial-pasajero.cjs). Y una sola vez: aquí había otra copia de este filtro que filtraba,
        // ordenaba y tiraba el resultado.
        setViajes(
          lista
            .filter(v => ESTADOS_TERMINADOS.includes(v.estado))
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
        <BotonVolver alVolver={onVolver} />
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
          const user = auth.currentUser;
          const fuiConductor = v.conductorId === user?.uid;
          const fin = comoTermino(v, fuiConductor ? 'conductor' : 'pasajero');
          return (
            <div key={v.id} style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: '1px solid #ECECEF' }}>
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
                  <p style={{ color: fin.color, fontSize: '13px', fontWeight: 'bold', margin: '0' }}>{fin.texto}</p>
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
              {!fin.completado && fin.porque &&<p style={{ color: '#6B7280', fontSize: '12px', margin: '4px 0 0' }}>Razón: {fin.porque}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MisViajes;