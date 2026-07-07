import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, where, getDocs, getDoc, addDoc, doc } from 'firebase/firestore';
import Logo from './Logo';
import MenuLateral from './MenuLateral';
import { obtenerTokenFCM } from './Notificaciones';

const AZUL = '#1C8EF9';
const NARANJA = '#FF7A2F';
const VERDE = '#2ECC71';

const cop = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const unidadTxt = (k) => ({ persona: 'por persona', grupo: 'por grupo', dia: 'por día', hora: 'por hora' }[k] || '');
const LS_KEY = 'misReservasGuajira';
const leerReservas = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; } };
const guardarReserva = (id) => { try { const a = leerReservas(); if (!a.includes(id)) localStorage.setItem(LS_KEY, JSON.stringify([id, ...a])); } catch (e) {} };

function Turismo({ nombre, foto, onVolver, onCerrarSesion, onIrPerfil, onIrGanancias, onIrSeguridad, onIrViajes, onIrCreditos, onIrAyuda, onIrConfig, onIrPromociones }) {
  const [pantalla, setPantalla] = useState('lista'); // lista | agencia | misReservas
  const [agencias, setAgencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [agenciaActiva, setAgenciaActiva] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  // Reserva
  const [tourReserva, setTourReserva] = useState(null);
  const [fecha, setFecha] = useState('');
  const [personas, setPersonas] = useState('1');
  const [telefono, setTelefono] = useState('');
  const [cliente, setCliente] = useState(nombre || '');
  const [notas, setNotas] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [exito, setExito] = useState(null);

  // Mis reservas
  const [misReservas, setMisReservas] = useState([]);
  const [cargandoMis, setCargandoMis] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'restaurantes'), where('tipoNegocio', '==', 'turismo')));
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => a.perfilCompleto === true && a.aprobado !== false);
        setAgencias(lista);
      } catch (e) {}
      setCargando(false);
    })();
  }, []);

  const abiertaAhora = (a) => {
    if (a.abierto === false) return false;
    const ap = a.horarioApertura, ci = a.horarioCierre;
    if (ap === undefined || ci === undefined) return true;
    const h = new Date().getHours();
    return ap <= ci ? (h >= ap && h < ci) : (h >= ap || h < ci);
  };

  const abrirReserva = (tour) => {
    setTourReserva(tour); setFecha(''); setPersonas('1'); setTelefono(''); setCliente(nombre || ''); setNotas(''); setAviso('');
  };

  const totalReserva = () => {
    if (!tourReserva) return 0;
    const p = tourReserva.unidadPrecio === 'persona' ? (parseInt(personas || '1', 10) || 1) : 1;
    return (tourReserva.precio || 0) * p;
  };

  const enviarReserva = async () => {
    if (!fecha) { setAviso('Escoge la fecha'); return; }
    if (!cliente.trim()) { setAviso('Escribe tu nombre'); return; }
    if (telefono.replace(/\D/g, '').length !== 10) { setAviso('El teléfono debe tener 10 números'); return; }
    setEnviando(true);
    try {
      const clienteFcmToken = await obtenerTokenFCM();
      const ref = await addDoc(collection(db, 'reservasTurismo'), {
        agenciaId: agenciaActiva.id,
        agenciaNombre: agenciaActiva.nombre || '',
        tourId: tourReserva.id,
        tipo: tourReserva.tipo || 'tour',
        nombreTour: tourReserva.nombre,
        imagen: tourReserva.imagen || '',
        cliente: cliente.trim(),
        telefono: '+57' + telefono.replace(/\D/g, '').slice(-10),
        personas: parseInt(personas || '1', 10) || 1,
        fecha,
        total: totalReserva(),
        unidadPrecio: tourReserva.unidadPrecio || 'persona',
        estado: 'nueva',
        notas: notas.trim(),
        creado: new Date().toISOString(),
        ...(clienteFcmToken ? { clienteFcmToken } : {}),
      });
      guardarReserva(ref.id);
      setEnviando(false);
      setExito({ nombre: tourReserva.nombre });
      setTourReserva(null);
    } catch (e) {
      setEnviando(false);
      setAviso('No se pudo enviar. Revisa tu conexión e intenta de nuevo');
    }
  };

  const cargarMisReservas = async () => {
    setPantalla('misReservas'); setCargandoMis(true);
    const ids = leerReservas();
    const out = [];
    for (const id of ids) {
      try { const s = await getDoc(doc(db, 'reservasTurismo', id)); if (s.exists()) out.push({ id, ...s.data() }); } catch (e) {}
    }
    setMisReservas(out); setCargandoMis(false);
  };

  const soloDigitos = (v) => v.replace(/[^0-9]/g, '').slice(0, 10);
  const estadoTxt = (e) => ({ nueva: '⏳ Esperando confirmación', confirmada: '✅ Confirmada', realizada: '🏁 Realizada', cancelada: '❌ Cancelada' }[e] || e);
  const estadoColor = (e) => ({ nueva: NARANJA, confirmada: VERDE, realizada: AZUL, cancelada: '#E33' }[e] || '#666');
  const fechaTxt = (v) => { if (!v) return ''; const d = new Date(v + 'T00:00:00'); return isNaN(d) ? String(v) : d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }); };

  const campoBase = { width: '100%', boxSizing: 'border-box', padding: '13px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', marginBottom: '10px', outline: 'none' };

  // ---------- LISTA DE AGENCIAS ----------
  if (pantalla === 'lista') {
    const filtradas = agencias.filter(a => !busqueda.trim() || (a.nombre || '').toLowerCase().includes(busqueda.toLowerCase()) || (a.categorias || []).join(' ').toLowerCase().includes(busqueda.toLowerCase()));
    return (
      <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: 'Arial, sans-serif', padding: '20px 16px 40px', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <MenuLateral nombre={nombre} foto={foto} onIrPerfil={onIrPerfil} onIrGanancias={onIrGanancias} onIrSeguridad={onIrSeguridad} onIrViajes={onIrViajes} onIrCreditos={onIrCreditos} onIrAyuda={onIrAyuda} onIrConfig={onIrConfig} onIrPromociones={onIrPromociones} onCerrarSesion={onCerrarSesion} />
          <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 14px', cursor: 'pointer', marginLeft: '96px' }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
          <Logo size={30} style={{ marginLeft: 'auto' }} />
        </div>

        <h2 style={{ color: '#1A1A1E', fontSize: '22px', fontWeight: '900', margin: '0 0 2px' }}>🧭 Turismo en La Guajira</h2>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 14px' }}>Tours y alquileres con agencias locales</p>

        <button onClick={cargarMisReservas} style={{ width: '100%', padding: '12px', background: '#EAF2FF', border: `1px solid ${AZUL}`, borderRadius: '12px', color: AZUL, fontSize: '14px', fontWeight: '900', cursor: 'pointer', marginBottom: '14px' }}>📋 Mis reservas</button>

        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="🔎 Buscar agencia o tipo de tour" style={{ ...campoBase, marginBottom: '16px' }} />

        {cargando ? <p style={{ color: '#999' }}>Cargando...</p> : filtradas.length === 0 ? (
          <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '30px 0' }}>Aún no hay agencias de turismo disponibles.</p>
        ) : filtradas.map(a => {
          const ab = abiertaAhora(a);
          return (
            <div key={a.id} onClick={() => { setAgenciaActiva(a); setPantalla('agencia'); }} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', marginBottom: '10px', display: 'flex', gap: '12px', alignItems: 'center', cursor: 'pointer', border: '1px solid #ECECEF' }}>
              {a.logo ? <img src={a.logo} alt={a.nombre} style={{ width: '58px', height: '58px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ fontSize: '40px' }}>🧭</span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '16px', margin: 0 }}>{a.nombre}</p>
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '3px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.descripcion || (a.categorias || []).slice(0, 2).join(' · ')}</p>
                <p style={{ color: ab ? VERDE : '#FF4444', fontSize: '12px', margin: '3px 0 0', fontWeight: 'bold' }}>{ab ? 'Abierta ahora' : 'Cerrada ahora'}{ab && a.demoraMin > 0 ? ` · ⏱ ~${a.demoraMin}m` : ''}</p>
              </div>
              <span style={{ fontSize: '22px', color: '#CBD5E1' }}>›</span>
            </div>
          );
        })}
        {exito && (
          <div onClick={() => { setExito(null); cargarMisReservas(); }} style={ovl}>
            <div onClick={e => e.stopPropagation()} style={modalBox}>
              <div style={{ fontSize: '46px', marginBottom: '8px' }}>🎉</div>
              <p style={{ color: '#1A1A1E', fontSize: '18px', fontWeight: '900', margin: '0 0 8px' }}>¡Reserva enviada!</p>
              <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 18px' }}>La agencia te confirmará pronto <b>{exito.nombre}</b>. Puedes seguirla en "Mis reservas".</p>
              <button onClick={() => { setExito(null); cargarMisReservas(); }} style={{ ...btnOk, width: '100%' }}>Ver mis reservas</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- MIS RESERVAS ----------
  if (pantalla === 'misReservas') {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: 'Arial, sans-serif', padding: '20px 16px 40px' }}>
        <div onClick={() => setPantalla('lista')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 14px', cursor: 'pointer', marginBottom: '16px' }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
        <h2 style={{ color: '#1A1A1E', fontSize: '22px', fontWeight: '900', margin: '0 0 14px' }}>📋 Mis reservas</h2>
        {cargandoMis ? <p style={{ color: '#999' }}>Cargando...</p> : misReservas.length === 0 ? (
          <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '30px 0' }}>Aún no tienes reservas.</p>
        ) : misReservas.map(r => (
          <div key={r.id} style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px', marginBottom: '10px', border: '1px solid #ECECEF' }}>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0 0 2px' }}>{(r.tipo === 'alquiler' ? '🚙 ' : '🧭 ') + r.nombreTour}</p>
            <p style={{ color: '#6B7280', fontSize: '12px', margin: '0 0 2px' }}>{r.agenciaNombre} · 📅 {fechaTxt(r.fecha)} · {r.personas} pers.</p>
            <p style={{ color: NARANJA, fontSize: '14px', fontWeight: '900', margin: '0 0 6px' }}>{cop(r.total)}</p>
            <p style={{ color: estadoColor(r.estado), fontSize: '13px', fontWeight: '900', margin: 0 }}>{estadoTxt(r.estado)}</p>
            {r.estado === 'confirmada' && r.codigo && (
              <div style={{ background: '#EAF9EF', border: `1.5px solid ${VERDE}`, borderRadius: '12px', padding: '10px', marginTop: '8px', textAlign: 'center' }}>
                <p style={{ color: '#1B8A4A', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', margin: 0 }}>TU CÓDIGO</p>
                <p style={{ color: '#1B8A4A', fontSize: '22px', fontWeight: '900', margin: '2px 0 0', letterSpacing: '2px' }}>{r.codigo}</p>
              </div>
            )}
            {r.estado === 'cancelada' && r.motivoCancelacion && <p style={{ color: '#E33', fontSize: '12px', margin: '6px 0 0' }}>Motivo: {r.motivoCancelacion}</p>}
          </div>
        ))}
      </div>
    );
  }

  // ---------- AGENCIA (tours/alquileres) ----------
  const tours = (agenciaActiva.tours || []).filter(t => t.disponible !== false).sort((a, b) => (b.destacado ? 1 : 0) - (a.destacado ? 1 : 0));
  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA', fontFamily: 'Arial, sans-serif', padding: '20px 16px 40px' }}>
      <div onClick={() => setPantalla('lista')} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '500', padding: '8px 14px', cursor: 'pointer', marginBottom: '16px' }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        {agenciaActiva.logo ? <img src={agenciaActiva.logo} alt="" style={{ width: '60px', height: '60px', borderRadius: '14px', objectFit: 'cover' }} /> : <span style={{ fontSize: '46px' }}>🧭</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '18px', margin: 0 }}>{agenciaActiva.nombre}</p>
          <p style={{ color: '#6B7280', fontSize: '12px', margin: '2px 0 0' }}>{agenciaActiva.descripcion}</p>
          {agenciaActiva.telefono && <a href={`https://wa.me/57${String(agenciaActiva.telefono).replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '4px', color: VERDE, fontSize: '12px', fontWeight: '900', textDecoration: 'none' }}>💬 WhatsApp</a>}
        </div>
      </div>

      {tours.length === 0 ? (
        <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '30px 0' }}>Esta agencia aún no ha publicado tours.</p>
      ) : tours.map(t => (
        <div key={t.id} style={{ background: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px', border: '1px solid #ECECEF' }}>
          {t.imagen && <img src={t.imagen} alt={t.nombre} style={{ width: '100%', height: '150px', objectFit: 'cover', display: 'block' }} />}
          <div style={{ padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '16px', margin: '0 0 2px' }}>{(t.tipo === 'alquiler' ? '🚙 ' : '🧭 ') + t.nombre}{t.destacado ? ' ⭐' : ''}</p>
            </div>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 6px' }}>{t.descripcion}</p>
            <p style={{ color: '#8A97B8', fontSize: '12px', margin: '0 0 6px' }}>{t.categoria}{t.duracion ? ' · ⏱ ' + t.duracion : ''}{t.cupoMax ? ' · 👥 hasta ' + t.cupoMax : ''}</p>
            {(t.incluye || []).length > 0 && <p style={{ color: AZUL, fontSize: '12px', margin: '0 0 6px' }}>Incluye: {t.incluye.join(', ')}</p>}
            {t.puntoEncuentro && <p style={{ color: '#8A97B8', fontSize: '12px', margin: '0 0 8px' }}>📍 {t.puntoEncuentro}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: NARANJA, fontSize: '18px', fontWeight: '900', margin: 0 }}>{cop(t.precio)} <span style={{ color: '#999', fontSize: '12px', fontWeight: 'normal' }}>{unidadTxt(t.unidadPrecio)}</span></p>
              <button onClick={() => abrirReserva(t)} style={{ padding: '10px 18px', background: `linear-gradient(135deg, #FFCF4D, ${NARANJA})`, border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}>Reservar</button>
            </div>
          </div>
        </div>
      ))}

      {/* Modal reserva */}
      {tourReserva && (
        <div onClick={() => setTourReserva(null)} style={{ ...ovl, alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '17px', margin: 0 }}>Reservar</p>
              <span onClick={() => setTourReserva(null)} style={{ color: '#AAA', cursor: 'pointer', fontWeight: 'bold' }}>✕</span>
            </div>
            <p style={{ color: NARANJA, fontWeight: '900', fontSize: '15px', margin: '0 0 14px' }}>{tourReserva.nombre}</p>

            <p style={lbl}>FECHA</p>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={campoBase} />

            {tourReserva.unidadPrecio === 'persona' && (
              <>
                <p style={lbl}>¿CUÁNTAS PERSONAS?</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <button onClick={() => setPersonas(p => String(Math.max(1, (parseInt(p, 10) || 1) - 1)))} style={btnPM}>−</button>
                  <span style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: '900', color: AZUL }}>{personas}</span>
                  <button onClick={() => setPersonas(p => String((parseInt(p, 10) || 1) + 1))} style={btnPM}>+</button>
                </div>
              </>
            )}

            <p style={lbl}>TU NOMBRE</p>
            <input value={cliente} onChange={e => setCliente(e.target.value)} placeholder="Nombre y apellido" style={campoBase} />

            <p style={lbl}>TU TELÉFONO</p>
            <input value={telefono} onChange={e => setTelefono(soloDigitos(e.target.value))} placeholder="10 números" type="tel" inputMode="numeric" style={campoBase} />

            <p style={lbl}>NOTAS (opcional)</p>
            <input value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej: somos 2 adultos y 1 niño" style={campoBase} />

            <div style={{ background: '#EAF9EF', border: `1.5px solid ${VERDE}`, borderRadius: '14px', padding: '12px', margin: '6px 0 14px', textAlign: 'center' }}>
              <p style={{ color: '#1B8A4A', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px', margin: 0 }}>TOTAL A PAGAR</p>
              <p style={{ color: '#1B8A4A', fontSize: '24px', fontWeight: '900', margin: '2px 0 0' }}>{cop(totalReserva())}</p>
            </div>
            <p style={{ color: '#8A97B8', fontSize: '12px', textAlign: 'center', margin: '0 0 12px' }}>El pago lo acuerdas directamente con la agencia.</p>

            <button onClick={enviarReserva} disabled={enviando} style={{ width: '100%', padding: '15px', background: enviando ? '#CCC' : `linear-gradient(135deg, ${VERDE}, #27AE60)`, border: 'none', borderRadius: '14px', color: '#FFF', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>{enviando ? 'Enviando...' : 'Enviar reserva'}</button>
          </div>
        </div>
      )}

      {aviso && (
        <div onClick={() => setAviso('')} style={ovl}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>
            <div style={{ fontSize: '44px', marginBottom: '8px' }}>⚠️</div>
            <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: 'bold', margin: '0 0 18px' }}>{aviso}</p>
            <button onClick={() => setAviso('')} style={{ ...btnOk, width: '100%' }}>Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { color: '#6B7280', fontSize: '11px', letterSpacing: '2px', fontWeight: 'bold', margin: '0 0 6px' };
const btnPM = { width: '44px', height: '44px', borderRadius: '12px', background: '#F4F6F8', border: '1px solid #ECECEF', color: AZUL, fontSize: '22px', fontWeight: '900', cursor: 'pointer' };
const ovl = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const modalBox = { background: '#FFFFFF', borderRadius: '20px', padding: '26px 22px', width: '100%', maxWidth: '340px', textAlign: 'center' };
const btnOk = { padding: '14px', background: `linear-gradient(135deg, #FFCF4D, ${NARANJA})`, border: 'none', borderRadius: '12px', color: '#FFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer' };

export default Turismo;
