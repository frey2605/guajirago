import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, setDoc, getDocs, addDoc } from 'firebase/firestore';
import { registrarTokenFCM, alertarNuevoViaje, activarAudioiOS, setDebugCallback } from './Notificaciones';
import { signOut } from 'firebase/auth';
import Calificacion from './Calificacion';
import Llamada from './Llamada';

const centroRiohacha = { lat: 11.5444, lng: -72.9072 };
const TARIFA_MINIMA = 8000;

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1A1A1E' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#FFFFFF' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141416' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2A2E' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
];

const RAZONES_CANCELACION_CONDUCTOR = [
  'El pasajero no aparece',
  'Dirección incorrecta o no la encuentro',
  'El pasajero solicitó algo diferente',
  'Problema con el vehículo',
  'Otro motivo',
];

function Celebracion() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#141416', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '100px', marginBottom: '24px', animation: 'bounce 0.5s infinite alternate' }}>🤝</div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['🎊', '🎉', '🎊', '🎉', '🎊'].map((e, i) => <span key={i} style={{ fontSize: '32px' }}>{e}</span>)}
      </div>
      <h2 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: '900', margin: '0 0 8px', textAlign: 'center' }}>¡Trato hecho!</h2>
      <p style={{ color: '#FF7A2F', fontSize: '16px', margin: '0', textAlign: 'center' }}>El viaje está confirmado 🚀</p>
      <style>{`@keyframes bounce { from { transform: scale(1); } to { transform: scale(1.2); } }`}</style>
    </div>
  );
}

function MensajeGrande({ mensaje, onCerrar }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ fontSize: '70px', marginBottom: '20px' }}>💬</div>
      <p style={{ color: '#FF7A2F', fontSize: '14px', margin: '0 0 16px', letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}>MENSAJE DEL PASAJERO</p>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '2px solid #FF7A2F', textAlign: 'center' }}>
        <p style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: '900', margin: '0', lineHeight: '1.3' }}>{mensaje}</p>
      </div>
      <button onClick={onCerrar} style={{ marginTop: '28px', padding: '16px 40px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
    </div>
  );
}

function ModalCancelacion({ razones, onConfirmar, onCerrar }) {
  const [razonSeleccionada, setRazonSeleccionada] = useState('');
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9997, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#1A1A1E', borderRadius: '24px', padding: '28px 24px', width: '100%', maxWidth: '440px', border: '1px solid #2A2A2E' }}>
        <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 8px', letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}>CANCELAR VIAJE</p>
        <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '900', margin: '0 0 20px', textAlign: 'center' }}>¿Por qué cancelas?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {razones.map((razon, i) => (
            <button key={i} onClick={() => setRazonSeleccionada(razon)} style={{ padding: '14px 16px', background: razonSeleccionada === razon ? 'rgba(255,68,68,0.15)' : '#141416', border: `1px solid ${razonSeleccionada === razon ? '#FF4444' : '#2A2A2E'}`, borderRadius: '14px', color: razonSeleccionada === razon ? '#FF4444' : '#FFFFFF', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontWeight: razonSeleccionada === razon ? 'bold' : 'normal' }}>
              {razonSeleccionada === razon ? '● ' : '○ '}{razon}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={onCerrar} style={{ flex: 1, padding: '14px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Volver</button>
          <button onClick={() => razonSeleccionada && onConfirmar(razonSeleccionada)} style={{ flex: 2, padding: '14px', background: razonSeleccionada ? '#FF4444' : '#2A2A2E', border: 'none', borderRadius: '14px', color: razonSeleccionada ? '#FFFFFF' : '#555', fontSize: '14px', fontWeight: '900', cursor: razonSeleccionada ? 'pointer' : 'default' }}>
            Confirmar cancelación
          </button>
        </div>
      </div>
    </div>
  );
}

function MapaConductor({ ubicacionConductor, ubicacionDestino, colorRuta, tipo, onTiempo }) {
  const mapRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorConductorRef = useRef(null);
  const marcadorDestinoRef = useRef(null);
  const rutaRef = useRef(null);
  const ajustadoRef = useRef(false);

  useEffect(() => {
    if (!window.google || !mapRef.current || mapaRef.current) return;
    mapaRef.current = new window.google.maps.Map(mapRef.current, {
      center: ubicacionConductor || centroRiohacha,
      zoom: 15,
      styles: MAP_STYLES,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });
  }, []);

  useEffect(() => {
    if (!mapaRef.current || !window.google || !ubicacionConductor) return;
    if (marcadorConductorRef.current) {
      marcadorConductorRef.current.setPosition(ubicacionConductor);
    } else {
      marcadorConductorRef.current = new window.google.maps.Marker({
        position: ubicacionConductor,
        map: mapaRef.current,
        label: { text: tipo === 'Taxi' ? '🚗' : '🏍️', fontSize: '28px' },
      });
      mapaRef.current.setCenter(ubicacionConductor);
    }
  }, [ubicacionConductor, tipo]);

  useEffect(() => {
    if (!mapaRef.current || !window.google || !ubicacionDestino) return;
    if (marcadorDestinoRef.current) {
      marcadorDestinoRef.current.setPosition(ubicacionDestino);
    } else {
      marcadorDestinoRef.current = new window.google.maps.Marker({
        position: ubicacionDestino,
        map: mapaRef.current,
        label: { text: '📍', fontSize: '24px' },
      });
    }
  }, [ubicacionDestino]);

  useEffect(() => {
    if (!mapaRef.current || !window.google || !ubicacionConductor || !ubicacionDestino) return;
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: ubicacionConductor,
      destination: ubicacionDestino,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') {
        if (rutaRef.current) rutaRef.current.setMap(null);
        rutaRef.current = new window.google.maps.DirectionsRenderer({
          directions: result,
          map: mapaRef.current,
          suppressMarkers: true,
          polylineOptions: { strokeColor: colorRuta || '#2ECC71', strokeWeight: 5 },
        });
        const leg = result.routes[0].legs[0];
        if (onTiempo) onTiempo(leg.duration.text, leg.distance.text);
        if (!ajustadoRef.current) {
          ajustadoRef.current = true;
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(ubicacionConductor);
          bounds.extend(ubicacionDestino);
          mapaRef.current.fitBounds(bounds, { padding: 80 });
        }
      }
    });
  }, [ubicacionConductor, ubicacionDestino, colorRuta, onTiempo]);

  return <div ref={mapRef} style={{ width: '100%', height: '100vh' }} />;
}


function HistorialConductor({ onVolver }) {
  const [viajes, setViajes] = React.useState([]);
  const [cargando, setCargando] = React.useState(true);
  const [totalHoy, setTotalHoy] = React.useState(0);

  React.useEffect(() => {
    const cargar = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        // Consulta simple sin indice compuesto
        const q = query(
          collection(db, 'viajes'),
          where('conductorId', '==', user.uid),
          limit(50)
        );
        const snap = await getDocs(q);
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
        setViajes(lista);
        // Sumar ganancias de hoy
        const hoy = new Date().toDateString();
        const gananciaHoy = lista
          .filter(v => v.estado === 'finalizado' && new Date(v.fechaSolicitud).toDateString() === hoy)
          .reduce((acc, v) => acc + (v.tarifaValor || 0), 0);
        setTotalHoy(gananciaHoy);
      } catch (e) { console.error(e); }
      setCargando(false);
    };
    cargar();
  }, []);

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', color: '#FF7A2F', fontSize: '24px', cursor: 'pointer' }}>←</button>
        <h2 style={{ color: '#FFFFFF', margin: '0', fontSize: '20px', fontWeight: '900' }}>Mis viajes</h2>
      </div>
      {totalHoy > 0 && (
        <div style={{ margin: '16px 20px 0', background: 'linear-gradient(135deg, #0A1F0A, #1A2A1A)', borderRadius: '16px', padding: '16px 20px', border: '1px solid #1A3A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#555', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>GANANCIAS DE HOY</p>
            <p style={{ color: '#2ECC71', fontSize: '28px', fontWeight: '900', margin: '4px 0 0' }}>${totalHoy.toLocaleString()}</p>
          </div>
          <span style={{ fontSize: '36px' }}>💰</span>
        </div>
      )}
      <div style={{ padding: '16px 20px' }}>
        {cargando && <p style={{ color: '#555', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>}
        {!cargando && viajes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '60px', margin: '0 0 16px' }}>🚗</p>
            <p style={{ color: '#555', fontSize: '15px' }}>Aún no tienes viajes</p>
          </div>
        )}
        {viajes.map((v) => {
          const fecha = v.fechaSolicitud ? new Date(v.fechaSolicitud).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
          const cancelado = v.estado === 'cancelado';
          return (
            <div key={v.id} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', marginBottom: '12px', border: `1px solid ${cancelado ? '#2A1A1A' : '#1A2A1A'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>{v.tipo === 'Taxi' ? '🚗' : '🏍️'}</span>
                  <div>
                    <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0' }}>{v.tipo}</p>
                    <p style={{ color: '#555', fontSize: '12px', margin: '3px 0 0' }}>{fecha}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: cancelado ? '#FF4444' : '#2ECC71', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>{cancelado ? 'Cancelado' : 'Completado'}</p>
                  <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: '900', margin: '4px 0 0' }}>{v.tarifa}</p>
                </div>
              </div>
              <div style={{ background: '#141416', borderRadius: '12px', padding: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ECC71', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0' }}>{v.origen}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FF7A2F', marginTop: '3px', flexShrink: 0 }}/>
                  <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0' }}>{v.destino}</p>
                </div>
              </div>
              {cancelado && v.razonCancelacion && <p style={{ color: '#555', fontSize: '12px', margin: '10px 0 0' }}>Razón: {v.razonCancelacion}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AppConductor({ nombre, telefono, placa, vehiculo, onCerrarSesion }) {
  const [activo, setActivo] = useState(false);
  const [solicitud, setSolicitud] = useState(null);
  const [fase, setFase] = useState(null);
  const [viajeActual, setViajeActual] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [ubicacionPasajero, setUbicacionPasajero] = useState(null);
  const [tarifaModificada, setTarifaModificada] = useState(TARIFA_MINIMA);
  const [tarifaCambiada, setTarifaCambiada] = useState(false);
  const [celebrando, setCelebrando] = useState(false);
  const [viajeIdEscuchando, setViajeIdEscuchando] = useState(null);
  const [tiempoLlegada, setTiempoLlegada] = useState(null);
  const [distancia, setDistancia] = useState(null);
  const [respuestaPasajero, setRespuestaPasajero] = useState(null);
  const [mensajeGrande, setMensajeGrande] = useState(null);
  const [mostrarCancelacion, setMostrarCancelacion] = useState(false);
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [contador, setContador] = useState(240);
  const [verHistorial, setVerHistorial] = useState(false);
  const [datosCalificacion, setDatosCalificacion] = useState(null);
  const [enLlamada, setEnLlamada] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] = useState(false);
  const contadorRef = useRef(null);
  const [debugMsg, setDebugMsg] = React.useState('');
  const ultimoMensajeRef = useRef(null);
  const solicitudIdRef = useRef(null);
  const descartadosRef = useRef({}); // { [viajeId]: timestampOfertaAlDescartar }
  const ultimaOfertaRef = useRef(null); // timestamp de la última oferta mostrada (para re-sonar si sube)

  const cerrarSesion = async () => {
    try {
      // Cancelar viaje activo si lo hay
      if (viajeActual) {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'Conductor cerró sesión' });
      }
      // Marcar conductor como inactivo
      const user = auth.currentUser;
      if (user) await setDoc(doc(db, 'conductores', user.uid), { activo: false }, { merge: true });
    } catch(e) {}
    try { await signOut(auth); } catch(e) {}
    if (onCerrarSesion) onCerrarSesion(); else window.location.reload();
  };



  // Registrar token FCM al cargar la app
  useEffect(() => {
    setDebugCallback((msg) => {
      setDebugMsg(msg);
      setTimeout(() => setDebugMsg(''), 8000);
    });
    registrarTokenFCM();
  }, []);



  const recibirMensajePasajero = useCallback((mensaje) => {
    if (!mensaje) return;
    setRespuestaPasajero(mensaje);
    if (mensaje !== ultimoMensajeRef.current) {
      ultimoMensajeRef.current = mensaje;
      setMensajeGrande(mensaje);
    }
  }, []);

  useEffect(() => {
    if (!activo && !fase) return;
    const user = auth.currentUser;
    if (!user || !navigator.geolocation) return;
    // Registrar token FCM cuando el conductor se activa
    if (activo) registrarTokenFCM();

    const guardarUbicacion = async (pos) => {
      const nueva = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString() };
      setUbicacion(nueva);
      try {
        // Obtener token FCM fresco cada vez que se guarda ubicación
        let tokenFCM = null;
        try {
          const { getMessaging, getToken } = await import('firebase/messaging');
          const messaging = getMessaging();
          tokenFCM = await getToken(messaging, { vapidKey: 'BLcxcBCOZVLKO-qblckhRh0vcuAZjrXmMLZIQNxI0T6x9Viw0XxbpKoZJmNhvTb173FLjuaBIiRum8fSsZGljY0' });
        } catch(e) {}
        await setDoc(doc(db, 'conductores', user.uid), {
          nombre: nombre || 'Conductor', telefono: telefono || '',
          placa: placa || '', vehiculo: vehiculo || '',
          ubicacion: nueva, activo: true,
          ...(tokenFCM ? { fcmToken: tokenFCM } : {}),
        });
      } catch (e) {}
    };

    navigator.geolocation.getCurrentPosition(guardarUbicacion, () => {
      navigator.geolocation.getCurrentPosition(guardarUbicacion, () => {}, { enableHighAccuracy: true, timeout: 20000 });
    }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 });

    let intervalo;
    try {
      intervalo = navigator.geolocation.watchPosition(guardarUbicacion, (err) => {
        intervalo = navigator.geolocation.watchPosition(guardarUbicacion, () => {}, { enableHighAccuracy: false, maximumAge: 5000, timeout: 20000 });
      }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
    } catch (e) {}

    return () => { if (intervalo) navigator.geolocation.clearWatch(intervalo); };
  }, [activo, fase, nombre, telefono, placa, vehiculo]);

  useEffect(() => {
    if (activo || fase) return;
    const user = auth.currentUser;
    if (!user) return;
    setDoc(doc(db, 'conductores', user.uid), { activo: false, nombre: nombre || '' }).catch(() => {});
  }, [activo, fase, nombre]);

  useEffect(() => {
    if (!activo) { setSolicitud(null); solicitudIdRef.current = null; return; }
    const VENTANA_MS = 6 * 60 * 1000; // respaldo: ocultar solicitudes colgadas de más de 6 minutos
    const q = query(collection(db, 'viajes'), where('estado', '==', 'esperando'));
    const unsub = onSnapshot(q, (snap) => {
      const ahora = Date.now();
      const tsDe = (v) => new Date(v.nuevaOferta || v.fechaSolicitud).getTime();
      const vigentes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => {
          if (!v.nuevaOferta && !v.fechaSolicitud) return false;
          const ts = tsDe(v);
          const edad = ahora - ts;
          if (edad < 0 || edad > VENTANA_MS) return false; // respaldo global contra colgadas
          // Si este conductor ya descartó el viaje (rechazó o se le venció) y la oferta NO
          // ha cambiado desde entonces, no se lo volvemos a mostrar.
          const descartadoEn = descartadosRef.current[v.id];
          if (descartadoEn && ts <= new Date(descartadoEn).getTime()) return false;
          return true;
        })
        .sort((a, b) => tsDe(b) - tsDe(a));

      if (vigentes.length === 0) {
        setSolicitud(null);
        solicitudIdRef.current = null;
        return;
      }
      const datos = vigentes[0];
      // Si reaparece porque la oferta cambió, quitarlo de descartados para que cuente como nuevo
      if (descartadosRef.current[datos.id]) delete descartadosRef.current[datos.id];
      const tsActual = datos.nuevaOferta || datos.fechaSolicitud;
      const esNuevoViaje = solicitudIdRef.current !== datos.id;
      const ofertaSubio = !esNuevoViaje && ultimaOfertaRef.current !== tsActual;
      solicitudIdRef.current = datos.id;
      ultimaOfertaRef.current = tsActual;
      setSolicitud(datos);
      // Siempre mostrar la oferta REAL del pasajero y limpiar cualquier contraoferta vieja.
      // (El conductor ajusta sobre este valor; si toca +/- pasa a "Enviar contraoferta")
      setTarifaModificada(datos.tarifaValor || TARIFA_MINIMA);
      setTarifaCambiada(false);
      // Suena GO GO: viaje nuevo, reaparece tras descarte, o el pasajero subió su oferta
      if (esNuevoViaje || ofertaSubio) alertarNuevoViaje();
    });
    return () => unsub();
  }, [activo]);

  // Si el conductor no acepta ni rechaza en 3 minutos, se descarta esa solicitud para él.
  // (Reaparece solo si el pasajero cambia la oferta.) El timer se reinicia si la oferta cambia.
  useEffect(() => {
    if (!solicitud?.id) return;
    const TIEMPO_DESCARTE = 3 * 60 * 1000; // 3 minutos
    const t = setTimeout(() => {
      descartadosRef.current[solicitud.id] = solicitud.nuevaOferta || solicitud.fechaSolicitud;
      solicitudIdRef.current = null;
      setSolicitud(null);
      setTarifaCambiada(false);
    }, TIEMPO_DESCARTE);
    return () => clearTimeout(t);
  }, [solicitud?.id, solicitud?.nuevaOferta]);

  useEffect(() => {
    if (!viajeIdEscuchando) return;
    const miId = auth.currentUser?.uid;
    if (!miId) return;

    // Escuchar MI contraoferta en la subcoleccion (mi propio espacio)
    const unsubMiContra = onSnapshot(doc(db, 'viajes', viajeIdEscuchando, 'contraofertas', miId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      // El pasajero aceptó mi contraoferta
      if (data.estado === 'aceptada' && !celebrando && !fase) {
        setCelebrando(true);
        // Leer el viaje principal para tener todos los datos del viaje
        import('firebase/firestore').then(({ getDoc }) => {
          getDoc(doc(db, 'viajes', viajeIdEscuchando)).then(viajeSnap => {
            const viajeData = viajeSnap.exists() ? viajeSnap.data() : {};
            setTimeout(() => {
              setCelebrando(false);
              iniciarFase1({ id: viajeIdEscuchando, ...viajeData, ...data });
              setViajeIdEscuchando(null);
            }, 3000);
          });
        });
        return;
      }
      // Mi contraoferta fue rechazada -> liberar
      if (data.estado === 'rechazada') {
        setViajeIdEscuchando(null);
        setTarifaCambiada(false);
        return;
      }
    });

    // Escuchar el viaje principal para detectar confirmacion o cancelacion del pasajero
    const unsubViaje = onSnapshot(doc(db, 'viajes', viajeIdEscuchando), (snap) => {
      if (!snap.exists()) { setViajeIdEscuchando(null); return; }
      const data = snap.data();
      // Pasajero confirmó el viaje
      if (data.estado === 'aceptado' && data.conductorId === miId && !celebrando && !fase) {
        setCelebrando(true);
        setTimeout(() => {
          setCelebrando(false);
          iniciarFase1({ id: viajeIdEscuchando, ...data });
          setViajeIdEscuchando(null);
        }, 3000);
        return;
      }
      if (data.estado === 'cancelado' || data.estado === 'cancelado_conductor') {
        setViajeIdEscuchando(null);
        setTarifaCambiada(false);
        setActivo(true);
        return;
      }
      if (data.respuestaPasajero) recibirMensajePasajero(data.respuestaPasajero);
    });

    return () => { unsubMiContra(); unsubViaje(); };
  }, [viajeIdEscuchando, celebrando, fase, recibirMensajePasajero]);

  // Respaldo iPhone: si la contraoferta no es aceptada en 15s (el cartel del pasajero dura 10s),
  // limpiar el indicador aunque el listener en tiempo real falle por el background de iOS.
  useEffect(() => {
    if (!viajeIdEscuchando) return;
    const t = setTimeout(() => setViajeIdEscuchando(null), 15000);
    return () => clearTimeout(t);
  }, [viajeIdEscuchando]);

  useEffect(() => {
    if (!viajeActual?.id || !fase) return;
    const unsub = onSnapshot(doc(db, 'viajes', viajeActual.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.respuestaPasajero) recibirMensajePasajero(data.respuestaPasajero);
        if (data.estado === 'cancelado' && data.canceladoPor === 'pasajero') {
          clearInterval(contadorRef.current);
          setFase('cancelado_pasajero');
          setViajeActual({ ...viajeActual, razonCancelacion: data.razonCancelacion });
        }
        if (data.fase === 'en_viaje' && fase !== 'en_viaje') {
          setFase('en_viaje');
          setTiempoLlegada(null); setDistancia(null);
          geocodificarDestino(data.destino);
        }
      }
    });
    return () => unsub();
  }, [viajeActual, fase, recibirMensajePasajero]);

  const geocodificarDestino = (destinoTexto) => {
    if (!window.google || !destinoTexto) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: destinoTexto + ', Riohacha, Colombia' }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setDestinoCoords({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
      }
    });
  };

  const iniciarFase1 = (viaje) => {
    setViajeActual(viaje);
    setFase('recogiendo');
    setActivo(false);
    if (viaje.pasajeroLat && viaje.pasajeroLng) {
      setUbicacionPasajero({ lat: viaje.pasajeroLat, lng: viaje.pasajeroLng });
    }
  };

  const llegueAlPunto = async () => {
    if (!viajeActual) return;
    await updateDoc(doc(db, 'viajes', viajeActual.id), { conductorEnPunto: true, fase: 'en_punto', tiempoEspera: new Date().toISOString() });
    setRespuestaPasajero(null);
    setFase('en_punto');
    setContador(240);
    geocodificarDestino(viajeActual.destino);
    contadorRef.current = setInterval(() => {
      setContador(prev => {
        if (prev <= 1) { clearInterval(contadorRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const iniciarViaje = async () => {
    if (!viajeActual) return;
    clearInterval(contadorRef.current);
    await updateDoc(doc(db, 'viajes', viajeActual.id), { fase: 'en_viaje' });
    setFase('en_viaje');
    geocodificarDestino(viajeActual.destino);
  };

  const cancelarViaje = async (razon) => {
    clearInterval(contadorRef.current);
    if (viajeActual) {
      await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: razon });
    }
    setMostrarCancelacion(false);
    setFase(null); setViajeActual(null); setTiempoLlegada(null); setDistancia(null);
    setRespuestaPasajero(null); setMensajeGrande(null); ultimoMensajeRef.current = null;
    setUbicacionPasajero(null); setDestinoCoords(null); setActivo(false); setContador(240);
    setTarifaModificada(TARIFA_MINIMA); setTarifaCambiada(false); solicitudIdRef.current = null; ultimaOfertaRef.current = null;
  };

  const finalizarViaje = async () => {
    clearInterval(contadorRef.current);
    if (viajeActual) {
      try {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'finalizado', fase: 'finalizado' });
        // Guardar datos para calificacion antes de resetear
        setDatosCalificacion({ viajeId: viajeActual.id, nombrePasajero: viajeActual.pasajeroEmail?.split('@')[0] || 'Pasajero' });
      } catch (err) {}
    }
    setFase(null); setViajeActual(null); setTiempoLlegada(null); setDistancia(null);
    setRespuestaPasajero(null); setMensajeGrande(null); ultimoMensajeRef.current = null;
    setUbicacionPasajero(null); setDestinoCoords(null); setActivo(false); setContador(240);
    setTarifaModificada(TARIFA_MINIMA); setTarifaCambiada(false); solicitudIdRef.current = null; ultimaOfertaRef.current = null;
  };

  const subirTarifa = () => {
    setTarifaModificada(prev => (tarifaCambiada ? prev : (solicitud?.tarifaValor || TARIFA_MINIMA)) + 1000);
    setTarifaCambiada(true);
  };



  const aceptarOEnviar = async () => {
    if (!solicitud) return;
    const user = auth.currentUser;
    if (tarifaCambiada) {
      const idViaje = solicitud.id;
      const tsOferta = solicitud.nuevaOferta || solicitud.fechaSolicitud;
      const montoContra = tarifaModificada;
      // Volver al menú INMEDIATAMENTE sin esperar la escritura (clave para iPhone PWA)
      setSolicitud(null);
      solicitudIdRef.current = null;
      setTarifaCambiada(false);
      descartadosRef.current[idViaje] = tsOferta;
      setViajeIdEscuchando(idViaje);
      setActivo(true);
      // Guardar la contraoferta en su propio espacio dentro del viaje
      // Asi cada conductor tiene su propia fila sin pisar a los demas
      setDoc(doc(db, 'viajes', idViaje, 'contraofertas', user.uid), {
        conductorId: user.uid,
        conductorNombre: nombre || 'Conductor',
        conductorTelefono: telefono || '',
        conductorPlaca: placa || '',
        conductorVehiculo: vehiculo || '',
        contraoferta: `$${montoContra.toLocaleString()}`,
        contraofertaValor: montoContra,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
      }).catch(() => {});
    } else {
      const viajeAceptado = solicitud;
      setSolicitud(null);
      solicitudIdRef.current = null;
      // Poner estado 'confirmando': el pasajero debe confirmar antes de arrancar
      setViajeIdEscuchando(viajeAceptado.id);
      setActivo(false);
      updateDoc(doc(db, 'viajes', viajeAceptado.id), {
        estado: 'confirmando', conductorId: user.uid,
        conductorNombre: nombre || 'Conductor', conductorTelefono: telefono || '',
        conductorPlaca: placa || '', conductorVehiculo: vehiculo || '',
      }).catch(() => {});
    }
  };

  // Escuchar llamada entrante del pasajero
  useEffect(() => {
    if (!viajeActual?.id) return;
    const unsub = onSnapshot(doc(db, 'llamadas', viajeActual.id), (s) => {
      if (s.exists() && s.data().estado === 'llamando') setLlamadaEntrante(true);
      if (!s.exists() || s.data().estado === 'terminada') setLlamadaEntrante(false);
    });
    return () => unsub();
  }, [viajeActual]);

  // Conductor esperando que el pasajero confirme
  if (viajeIdEscuchando && !fase && !celebrando) {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>⏳</div>
        <p style={{ color: '#FFCF4D', fontSize: '13px', margin: '0 0 8px', letterSpacing: '3px', fontWeight: 'bold', textAlign: 'center' }}>ESPERANDO AL PASAJERO</p>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '0 0 8px', textAlign: 'center' }}>El pasajero está confirmando el viaje</h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 32px', textAlign: 'center' }}>Si no confirma en 60 segundos el viaje se cancela</p>
        <div style={{ width: '60px', height: '4px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '2px', marginBottom: '32px' }}/>
        <button onClick={async () => {
          try {
            const { updateDoc, doc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'viajes', viajeIdEscuchando), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'Conductor canceló antes de confirmar' });
          } catch(e) {}
          setViajeIdEscuchando(null);
          setActivo(true);
        }} style={{ background: 'transparent', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FF4444', fontSize: '14px', padding: '14px 32px', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>
    );
  }

  if (enLlamada || llamadaEntrante) return <Llamada viajeId={viajeActual?.id} miRol="conductor" nombreOtro={viajeActual?.pasajeroEmail?.split('@')[0] || 'Pasajero'} onCerrar={() => { setEnLlamada(false); setLlamadaEntrante(false); }} />;

  if (datosCalificacion) return <Calificacion tipo={null} viajeId={datosCalificacion.viajeId} nombreCalificado={datosCalificacion.nombrePasajero} quienCalifica="conductor" onFinalizar={() => setDatosCalificacion(null)} />;

  if (verHistorial) return <HistorialConductor onVolver={() => setVerHistorial(false)} />;

  if (celebrando) return <Celebracion />;

  // Pasajero canceló el viaje
  if (fase === 'cancelado_pasajero') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>😕</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '0 0 12px', textAlign: 'center' }}>El pasajero canceló el viaje</h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>Razón: <span style={{ color: '#FF7A2F' }}>{viajeActual?.razonCancelacion || 'No especificada'}</span></p>
        <p style={{ color: '#555', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>Puedes activarte para recibir nuevos viajes</p>
        <button onClick={() => { setFase(null); setViajeActual(null); setUbicacionPasajero(null); setDestinoCoords(null); setActivo(false); setTarifaModificada(TARIFA_MINIMA); setTarifaCambiada(false); solicitudIdRef.current = null; ultimaOfertaRef.current = null; }} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
      </div>
    );
  }

  if (fase === 'recogiendo' || fase === 'en_punto') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_CONDUCTOR} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} />}
        <MapaConductor
          ubicacionConductor={ubicacion}
          ubicacionDestino={fase === 'en_punto' ? destinoCoords : ubicacionPasajero}
          colorRuta={fase === 'en_punto' ? '#FF7A2F' : '#2ECC71'}
          tipo={viajeActual?.tipo}
          onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }}
        />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: fase === 'en_punto' ? '#FF7A2F' : '#2ECC71', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>{fase === 'en_punto' ? '🏁 RUTA AL DESTINO' : '🚗 YENDO A RECOGER'}</p>
            <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>{fase === 'en_punto' ? viajeActual?.destino : viajeActual?.origen}</p>
          </div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        {respuestaPasajero && (
          <div onClick={() => setMensajeGrande(respuestaPasajero)} style={{ position: 'absolute', top: '90px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255, 122, 47, 0.95)', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer' }}>
            <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual?.pasajeroEmail?.split('@')[0]}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual?.tarifa}</p></div>
          </div>
          {fase === 'recogiendo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => setEnLlamada(true)} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>📞 Llamar al pasajero</button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setMostrarCancelacion(true)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid #FF4444', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={llegueAlPunto} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>📍 Llegué al punto</button>
              </div>
            </div>
          )}
          {fase === 'en_punto' && (
            <div>
              <div style={{ background: contador <= 60 ? 'rgba(255,68,68,0.15)' : 'rgba(255,207,77,0.1)', borderRadius: '16px', padding: '16px', marginBottom: '16px', border: `1px solid ${contador <= 60 ? '#FF4444' : '#FFCF4D'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: '#555', fontSize: '11px', margin: '0' }}>TIEMPO DE ESPERA</p>
                  <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '11px', margin: '4px 0 0' }}>{contador === 0 ? '⚠️ Tiempo agotado' : 'Esperando al pasajero...'}</p>
                </div>
                <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '36px', fontWeight: '900', margin: '0', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(contador / 60)}:{String(contador % 60).padStart(2, '0')}</p>
              </div>
              {respuestaPasajero && (
                <div onClick={() => setMensajeGrande(respuestaPasajero)} style={{ background: 'rgba(255,122,47,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', border: '1px solid #FF7A2F', cursor: 'pointer' }}>
                  <p style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setMostrarCancelacion(true)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid #FF4444', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={iniciarViaje} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>🚀 Iniciar viaje</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fase === 'en_viaje' && viajeActual) {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
        <MapaConductor ubicacionConductor={ubicacion} ubicacionDestino={destinoCoords} colorRuta="#FF7A2F" tipo={viajeActual.tipo} onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }} />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚀 VIAJE EN CURSO</p><p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>🏁 {viajeActual.destino}</p></div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual.pasajeroEmail?.split('@')[0]}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual.tarifa}</p></div>
          </div>
          <button onClick={finalizarViaje} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>🏁 Finalizar viaje</button>
        </div>
      </div>
    );
  }

  // Si hay contraoferta enviada pero no hay fase activa, mostrar menu normal

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: '#555', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>CONDUCTOR</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '20px', margin: '4px 0 8px', fontWeight: '900' }}>{nombre || 'Conductor'}</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {placa && <div style={{ background: '#141416', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🚘</span><span style={{ color: '#FFCF4D', fontSize: '13px', fontWeight: 'bold' }}>{placa}</span></div>}
            {vehiculo && <div style={{ background: '#141416', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🏷️</span><span style={{ color: '#FFFFFF', fontSize: '13px' }}>{vehiculo}</span></div>}
            {telefono && <div style={{ background: '#141416', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>📞</span><span style={{ color: '#FFFFFF', fontSize: '13px' }}>{telefono}</span></div>}
          </div>
        </div>
        <button onClick={cerrarSesion} style={{ background: '#141416', border: 'none', borderRadius: '12px', padding: '10px 16px', color: '#FF4444', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>🚪 Salir</button>
      </div>
      <div style={{ padding: '24px 20px' }}>
        {debugMsg && (
          <div style={{ background: '#1A1A00', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', border: '1px solid #FFCF4D' }}>
            <p style={{ color: '#FFCF4D', fontSize: '12px', margin: '0', fontFamily: 'monospace' }}>{debugMsg}</p>
          </div>
        )}
        {ubicacion && <div style={{ background: '#0A1F0A', borderRadius: '16px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #1A3A1A' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ECC71' }}/><span style={{ color: '#2ECC71', fontSize: '13px', fontWeight: 'bold' }}>GPS activo — ubicación en tiempo real</span></div>}
        <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div><p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>{activo ? 'Estoy disponible' : 'No disponible'}</p><p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>{activo ? 'Puedes recibir solicitudes' : 'Actívate para recibir viajes'}</p></div>
          <div onClick={() => { activarAudioiOS(); setActivo(!activo); }} style={{ width: '56px', height: '32px', borderRadius: '16px', background: activo ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: activo ? 'flex-end' : 'flex-start' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#FFFFFF' }}/>
          </div>
        </div>

        {activo && !solicitud && <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '32px 20px', textAlign: 'center', border: '1px dashed #2A2A2E' }}><p style={{ fontSize: '40px', margin: '0 0 12px' }}>⏳</p><p style={{ color: '#555', fontSize: '14px', margin: '0' }}>Esperando solicitudes de viaje...</p></div>}

        {!activo && (
          <div onClick={() => setVerHistorial(true)} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #2A2A2E', cursor: 'pointer', marginTop: '4px' }}>
            <span style={{ fontSize: '36px' }}>🕐</span>
            <div><p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>Mis viajes</p><p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>Ver historial y ganancias</p></div>
          </div>
        )}
        {solicitud && (
          <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', border: '1px solid #FF7A2F' }}>
            <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>🔔 NUEVA SOLICITUD</p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0 0 4px' }}>{solicitud.tipo}</p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 4px' }}>📍 Desde: {solicitud.origen}</p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 20px' }}>🏁 Hasta: {solicitud.destino}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', background: '#141416', borderRadius: '16px', padding: '16px' }}>
              <div>
                <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>{tarifaCambiada ? 'TU CONTRAOFERTA' : 'OFERTA DEL PASAJERO'}</p>
                <p style={{ color: tarifaCambiada ? '#FF7A2F' : '#2ECC71', fontWeight: '900', fontSize: '28px', margin: '4px 0 0' }}>${(tarifaCambiada ? tarifaModificada : (solicitud.tarifaValor || TARIFA_MINIMA)).toLocaleString()}</p>
                {!tarifaCambiada && solicitud?.nuevaOferta && <p style={{ color: '#FFCF4D', fontSize: '11px', margin: '4px 0 0' }}>⬆️ Pasajero actualizó su oferta</p>}
                {tarifaCambiada && <p style={{ color: '#555', fontSize: '11px', margin: '4px 0 0' }}>Oferta original: {solicitud.tarifa}</p>}
              </div>
              <button onClick={subirTarifa} style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '28px', fontWeight: '900', cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { if (solicitud) { descartadosRef.current[solicitud.id] = solicitud.nuevaOferta || solicitud.fechaSolicitud; solicitudIdRef.current = null; setSolicitud(null); setTarifaCambiada(false); } }} style={{ flex: 1, padding: '14px', background: '#141416', border: 'none', borderRadius: '14px', color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>✗ Rechazar</button>
              <button onClick={aceptarOEnviar} style={{ flex: 2, padding: '14px', background: tarifaCambiada ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>
                {tarifaCambiada ? '💬 Enviar contraoferta' : '✅ Aceptar viaje'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppConductor;