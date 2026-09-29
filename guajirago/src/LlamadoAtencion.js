// ── EL LLAMADO DE ATENCIÓN · UNA SOLA VENTANITA (gemelo G37, 28-sep-2026) ─────────────────────────────────────────
// El panel (guajirago-admin/src/Conductores.js, `enviarLlamado`) le escribe al usuario `llamadoPendiente` (el texto)
// y lo suma a `llamadosAtencion` (el historial). Hasta el G37 lo mostraban y atendían DOS pantallas, cada una a su
// manera: la del pasajero (Home.js) se cerraba aunque el «marcar como leído» fallara —`catch(e) {}` y cerrar igual—,
// y además pintaba la ventanita DOS veces, una encima de otra; la del conductor (AppConductor.js) ya pasaba por el
// candado, pero su pantalla del llamado no tenía dónde pintar el aviso del fallo, así que fallaba callada.
// Ahora vive aquí y las dos pantallas la ponen: se ve una vez, «Entendido» pasa por el candado (LA LEY DEL BOTÓN) y
// la ventanita SOLO se cierra cuando quedó marcado en la base; si no, lo dice encima de la ventanita, sin cerrarla.
//
// «Marcar como leído» NO borra el llamado (REGLA de las lápidas): el llamado queda en `llamadosAtencion`, que es lo
// que lee el panel; aquí solo se apaga la bandera de «sin ver» (`llamadoPendiente: null`), igual que antes.
import React, { useEffect, useState } from 'react';
import { auth, db } from './firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAccion } from './useAccion';
import AvisoModal from './AvisoModal';

// Cuánto hay que esperar para poder tocar «Entendido»: que se lea el mensaje entero.
const SEGUNDOS_PARA_LEER = 8;

function LlamadoAtencion() {
  const [llamado, setLlamado] = useState(null);
  const [puedeCerrar, setPuedeCerrar] = useState(false);
  const { ocupado, correr, texto, aviso, cerrarAviso } = useAccion();

  // El llamado sin ver del usuario. Se queda puesto hasta que «Entendido» entre en la base: un `null` que la app
  // escribe y el servidor todavía no confirma no lo cierra.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return undefined;
    const unsub = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.llamadoPendiente) setLlamado(data.llamadoPendiente);
    });
    return () => unsub();
  }, []);

  // Los segundos para leer cuentan desde que se ve ESTE llamado (no se reinician con cada cambio de la ficha).
  useEffect(() => {
    setPuedeCerrar(false);
    if (!llamado) return undefined;
    const t = setTimeout(() => setPuedeCerrar(true), SEGUNDOS_PARA_LEER * 1000);
    return () => clearTimeout(t);
  }, [llamado]);

  // Si el candado dijo «sin confirmar» y la escritura entró después, el aviso se corrige solo a «listo»: ahí se cierra.
  useEffect(() => {
    if (aviso && aviso.ok && aviso.cual === 'llamado') setLlamado(null);
  }, [aviso]);

  const cerrar = async () => {
    if (!puedeCerrar) return;
    const r = await correr(async () => {
      const user = auth.currentUser;
      await updateDoc(doc(db, 'usuarios', user.uid), { llamadoPendiente: null });
    }, 'llamado', 'Listo.', 'marcar el llamado como leído');
    if (r && r.ok) setLlamado(null);
  };

  if (!llamado) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #FF7A2F', textAlign: 'center' }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>📢</div>
        <p style={{ color: '#FF7A2F', fontSize: '12px', letterSpacing: '3px', fontWeight: 'bold', margin: '0 0 12px' }}>MENSAJE DE GUAJIRAGO</p>
        <p style={{ color: '#1A1A1E', fontSize: '16px', lineHeight: '1.6', margin: '0 0 28px' }}>{llamado}</p>
        <button onClick={cerrar} disabled={!puedeCerrar || !!ocupado} style={{ width: '100%', padding: '16px', background: puedeCerrar ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#ECECEF', border: 'none', borderRadius: '16px', color: puedeCerrar ? '#FFFFFF' : '#6B7280', fontSize: '16px', fontWeight: '900', cursor: puedeCerrar ? 'pointer' : 'default', transition: 'all 0.5s' }}>
          {texto('llamado', 'Un momento…', puedeCerrar ? 'Entendido ✓' : 'Lee el mensaje completo...')}
        </button>
      </div>
      {/* El fallo se dice DENTRO de la ventanita del llamado: fuera, quedaría tapado por ella (va a zIndex 99999). */}
      <AvisoModal aviso={aviso && !aviso.ok ? aviso : null} onCerrar={cerrarAviso} />
    </div>
  );
}

export default LlamadoAtencion;
