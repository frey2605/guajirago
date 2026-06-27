import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

function Ganancias({ onVolver }) {
  const [cargando, setCargando] = useState(true);
  const [hoy, setHoy] = useState({ total: 0, viajes: 0, comision: 0 });
  const [semana, setSemana] = useState({ total: 0, viajes: 0, comision: 0 });
  const [mes, setMes] = useState({ total: 0, viajes: 0, comision: 0 });
  const COMISION = 800;

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setCargando(false); return; }

        const q = query(collection(db, 'viajes'),
          where('conductorId', '==', user.uid),
          where('estado', '==', 'finalizado')
        );
        const snap = await getDocs(q);
        const viajes = snap.docs.map(d => ({ ...d.data() }));

        const ahora = new Date();
        const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const inicioSemana = new Date(inicioHoy);
        inicioSemana.setDate(inicioHoy.getDate() - inicioHoy.getDay());
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

        const calcular = (lista) => {
          const total = lista.reduce((acc, v) => acc + (v.tarifaValor || 0), 0);
          const comision = lista.length * COMISION;
          return { total, viajes: lista.length, comision };
        };

        const viajesHoy = viajes.filter(v => new Date(v.fechaSolicitud) >= inicioHoy);
        const viajesSemana = viajes.filter(v => new Date(v.fechaSolicitud) >= inicioSemana);
        const viajesMes = viajes.filter(v => new Date(v.fechaSolicitud) >= inicioMes);

        setHoy(calcular(viajesHoy));
        setSemana(calcular(viajesSemana));
        setMes(calcular(viajesMes));
      } catch (e) {}
      setCargando(false);
    };
    cargar();
  }, []);

  const TarjetaPeriodo = ({ titulo, icono, datos }) => (
    <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: '1px solid #2A2A2E' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px' }}>{icono}</span>
        <p style={{ color: '#AAAAAA', fontSize: '12px', fontWeight: 'bold', margin: '0', letterSpacing: '2px' }}>{titulo}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, background: '#141416', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
          <p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>GANADO</p>
          <p style={{ color: '#2ECC71', fontSize: '22px', fontWeight: '900', margin: '6px 0 0' }}>${datos.total.toLocaleString()}</p>
        </div>
        <div style={{ flex: 1, background: '#141416', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
          <p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>VIAJES</p>
          <p style={{ color: '#FFCF4D', fontSize: '22px', fontWeight: '900', margin: '6px 0 0' }}>{datos.viajes}</p>
        </div>
        <div style={{ flex: 1, background: '#141416', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
          <p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>COMISIÓN</p>
          <p style={{ color: '#FF4444', fontSize: '22px', fontWeight: '900', margin: '6px 0 0' }}>${datos.comision.toLocaleString()}</p>
        </div>
      </div>
      {datos.viajes > 0 && (
        <div style={{ marginTop: '12px', background: '#141416', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '0' }}>Neto después de comisión</p>
          <p style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '900', margin: '0' }}>${(datos.total - datos.comision).toLocaleString()}</p>
        </div>
      )}
      {datos.viajes === 0 && (
        <p style={{ color: '#555', fontSize: '13px', textAlign: 'center', margin: '8px 0 0' }}>Sin viajes en este período</p>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver
        </div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Ganancias</h2>
      </div>

      <div style={{ padding: '24px 20px' }}>
        {cargando ? (
          <p style={{ color: '#AAAAAA', textAlign: 'center', marginTop: '60px' }}>Cargando...</p>
        ) : (
          <>
            <TarjetaPeriodo titulo="HOY" icono="☀️" datos={hoy} />
            <TarjetaPeriodo titulo="ESTA SEMANA" icono="📅" datos={semana} />
            <TarjetaPeriodo titulo="ESTE MES" icono="🗓️" datos={mes} />
          </>
        )}
      </div>
    </div>
  );
}

export default Ganancias;