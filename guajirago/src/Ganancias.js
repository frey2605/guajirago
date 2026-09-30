import React, { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { LogoEsquina } from './Logo';
import { leerConfig } from './configApp';
import { cop } from './moneda';
import { consultaDeGanancias, resumenDeGanancias } from './gananciasConductor';
import BotonVolver from './BotonVolver';

function Ganancias({ onVolver }) {
  const [cargando, setCargando] = useState(true);
  const [hoy, setHoy] = useState({ total: 0, viajes: 0, comision: 0 });
  const [semana, setSemana] = useState({ total: 0, viajes: 0, comision: 0 });
  const [mes, setMes] = useState({ total: 0, viajes: 0, comision: 0 });

  useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) { setCargando(false); return; }

        // Las comisiones vigentes, por si algún viaje es tan viejo que no guarda
        // lo que se le cobró. La fuente buena es config/global. G66: la lectura y el respaldo (las comisiones de
        // comisiones.js, dentro del respaldo entero) salen de configApp.js; si falla, se sigue con el respaldo.
        const { config: cfgComisiones } = await leerConfig({ getDoc, doc, db });

        // G23 — la consulta y la cuenta son las MISMAS del recuadro «GANANCIAS DE HOY» del historial
        // (gananciasConductor.js): días de Colombia, no del teléfono, y sin el tope de 50 del historial.
        // La comisión sale de comisiones.js (SEGUNDA LEY), con lo que el viaje GUARDA que se le cobró.
        const ahora = new Date();
        const snap = await getDocs(consultaDeGanancias({ collection, query, where }, db, user.uid, ahora));
        const r = resumenDeGanancias(snap.docs.map(d => ({ ...d.data() })), ahora, cfgComisiones);

        setHoy(r.hoy);
        setSemana(r.semana);
        setMes(r.mes);
      } catch (e) {}
      setCargando(false);
    };
    cargar();
  }, []);

  const TarjetaPeriodo = ({ titulo, icono, datos }) => (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: '1px solid #ECECEF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px' }}>{icono}</span>
        <p style={{ color: '#6B7280', fontSize: '12px', fontWeight: 'bold', margin: '0', letterSpacing: '2px' }}>{titulo}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ flex: 1, background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
          <p style={{ color: '#6B7280', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>GANADO</p>
          <p style={{ color: '#2ECC71', fontSize: '22px', fontWeight: '900', margin: '6px 0 0' }}>{cop(datos.total)}</p>
        </div>
        <div style={{ flex: 1, background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
          <p style={{ color: '#6B7280', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>VIAJES</p>
          <p style={{ color: '#FF7A2F', fontSize: '22px', fontWeight: '900', margin: '6px 0 0' }}>{datos.viajes}</p>
        </div>
        <div style={{ flex: 1, background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
          <p style={{ color: '#6B7280', fontSize: '10px', margin: '0', letterSpacing: '1px' }}>COMISIÓN</p>
          <p style={{ color: '#FF4444', fontSize: '22px', fontWeight: '900', margin: '6px 0 0' }}>{cop(datos.comision)}</p>
        </div>
      </div>
      {datos.viajes > 0 && (
        <div style={{ marginTop: '12px', background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '12px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>Neto después de comisión</p>
          <p style={{ color: '#1A1A1E', fontSize: '16px', fontWeight: '900', margin: '0' }}>{cop(datos.total - datos.comision)}</p>
        </div>
      )}
      {datos.viajes === 0 && (
        <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', margin: '8px 0 0' }}>Sin viajes en este período</p>
      )}
    </div>
  );

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #FFFFFF, #ECECEF)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <BotonVolver alVolver={onVolver} />
        <h2 style={{ color: '#1A1A1E', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Ganancias</h2>
        <LogoEsquina />
      </div>

      <div style={{ padding: '24px 20px' }}>
        {cargando ? (
          <p style={{ color: '#6B7280', textAlign: 'center', marginTop: '60px' }}>Cargando...</p>
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