import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, limit, onSnapshot, doc, updateDoc, setDoc, getDoc, getDocs, arrayUnion, addDoc, orderBy } from 'firebase/firestore';
import { registrarTokenFCM, alertarNuevoViaje, activarAudioiOS, precargarAudio, setDebugCallback } from './Notificaciones';
import { signOut } from 'firebase/auth';
import Calificacion from './Calificacion';
import Llamada from './Llamada';
import Creditos from './Creditos';
import MiPerfil from './MiPerfil';
import Ganancias from './Ganancias';
import Seguridad from './Seguridad';
import AyudaSoporte from './AyudaSoporte';
import Configuracion from './Configuracion';
import Promociones from './Promociones';
import MenuLateral from './MenuLateral';
const centroRiohacha = { lat: 11.5444, lng: -72.9072 };

// Valores por defecto (respaldo). Se reemplazan por los de config/global cuando cargan.
const CONFIG_APP_DEFECTO = {
  tarifaMinimaDia: 8000,
  tarifaMinimaNoche: 10000,
  tarifaMinimaMototaxi: 3000,
  horaInicioNoche: 18,
  horaFinNoche: 6,
  incrementoTarifa: 1000,
  comisionMototaxi: 300,
  comisionTaxi: 800,
  comisionDomicilio: 1000,
  tiempoEsperaConductor: 240,
};

function calcularTarifaMinima(cfg = CONFIG_APP_DEFECTO) {
  const hora = new Date().getHours();
  return (hora >= cfg.horaInicioNoche || hora < cfg.horaFinNoche) ? cfg.tarifaMinimaNoche : cfg.tarifaMinimaDia;
}
const TARIFA_MINIMA = calcularTarifaMinima();

// Devuelve la comisión según el tipo de vehículo, usando la config recibida
function comisionSegunTipo(tipoVehiculo, cfg = CONFIG_APP_DEFECTO, tipoViaje) {
  // Un mandado (Mensajería) cobra la comisión de domicilio, aunque lo haga un mototaxista
  if (tipoViaje === 'Mensajería') return cfg.comisionDomicilio ?? 1000;
  return tipoVehiculo === 'Mototaxi' ? cfg.comisionMototaxi : cfg.comisionTaxi;
}
// Calcula la distancia en kilómetros entre dos puntos del mapa (fórmula Haversine)
function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
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

function CelebracionConductor({ monto, onCerrar }) {
  const confeti = Array.from({ length: 30 }, (_, i) => i);
  const coloresConfeti = ['#FFCF4D', '#FF7A2F', '#D6357E', '#2ECC71', '#FFFFFF'];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#141416', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflow: 'hidden' }}>
      {confeti.map(i => (
        <span key={i} style={{
          position: 'absolute', top: '-20px', left: `${Math.random() * 100}%`,
          fontSize: `${14 + Math.random() * 14}px`,
          color: coloresConfeti[i % coloresConfeti.length],
          animation: `caer ${2 + Math.random() * 2}s linear ${Math.random() * 1.5}s infinite`,
        }}>●</span>
      ))}
      <div style={{ fontSize: '70px', marginBottom: '12px' }}>🎉</div>
      <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '0 0 6px', textAlign: 'center' }}>¡Recibiste tu saldo!</h2>
      <p style={{ color: '#FFCF4D', fontSize: '16px', margin: '0 0 24px', textAlign: 'center', fontWeight: 'bold' }}>El descuento del pasajero es tuyo 🎁</p>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #2ECC71', textAlign: 'center', zIndex: 2 }}>
        <p style={{ color: '#2ECC71', fontSize: '12px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>SALDO ACREDITADO A TUS CRÉDITOS</p>
        <p style={{ color: '#FFFFFF', fontSize: '52px', fontWeight: '900', margin: '0' }}>${(monto || 0).toLocaleString()}</p>
        <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '16px 0 0', lineHeight: '1.5' }}>Ya está sumado a tu saldo de créditos. ¡Gracias por rodar con GuajiraGo!</p>
      </div>
      <button onClick={onCerrar} style={{ marginTop: '28px', width: '100%', maxWidth: '420px', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '17px', fontWeight: '900', cursor: 'pointer', zIndex: 2 }}>Continuar</button>
      <style>{`@keyframes caer { from { transform: translateY(-20px) rotate(0deg); opacity: 1; } to { transform: translateY(100vh) rotate(360deg); opacity: 0.3; } }`}</style>
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
          <button onClick={onCerrar} style={{ flex: 1, padding: '14px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#AAAAAA', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Volver</button>
          <button onClick={() => razonSeleccionada && onConfirmar(razonSeleccionada)} style={{ flex: 2, padding: '14px', background: razonSeleccionada ? '#FF4444' : '#2A2A2E', border: 'none', borderRadius: '14px', color: razonSeleccionada ? '#FFFFFF' : '#AAAAAA', fontSize: '14px', fontWeight: '900', cursor: razonSeleccionada ? 'pointer' : 'default' }}>
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
      styles: [], // mapa blanco (tema normal de Google)
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
        const q = query(collection(db, 'viajes'), where('conductorId', '==', user.uid), limit(50));
        const snap = await getDocs(q);
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')
          .sort((a, b) => new Date(b.fechaSolicitud) - new Date(a.fechaSolicitud));
        setViajes(lista);
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
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver</div>
        <h2 style={{ color: '#FFFFFF', margin: '0 auto', fontSize: '20px', fontWeight: '900' }}>Mis viajes</h2>
      </div>
      {totalHoy > 0 && (
        <div style={{ margin: '16px 20px 0', background: 'linear-gradient(135deg, #0A1F0A, #1A2A1A)', borderRadius: '16px', padding: '16px 20px', border: '1px solid #1A3A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#AAAAAA', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>GANANCIAS DE HOY</p>
            <p style={{ color: '#2ECC71', fontSize: '28px', fontWeight: '900', margin: '4px 0 0' }}>${totalHoy.toLocaleString()}</p>
          </div>
          <span style={{ fontSize: '36px' }}>💰</span>
        </div>
      )}
      <div style={{ padding: '16px 20px' }}>
        {cargando && <p style={{ color: '#AAAAAA', textAlign: 'center', marginTop: '40px' }}>Cargando...</p>}
        {!cargando && viajes.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <p style={{ fontSize: '60px', margin: '0 0 16px' }}>🚗</p>
            <p style={{ color: '#AAAAAA', fontSize: '15px' }}>Aún no tienes viajes</p>
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
                    <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '3px 0 0' }}>{fecha}</p>
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
              {cancelado && v.razonCancelacion && <p style={{ color: '#AAAAAA', fontSize: '12px', margin: '10px 0 0' }}>Razón: {v.razonCancelacion}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TarjetaSolicitud({ solicitud, nombre, telefono, placa, vehiculo, tipoVehiculo, fotoConductor, colorConductor, saldoCreditos, configApp, descartadosRef, agregarViajeEscuchando, onRechazar }) {
  const [tarifaModificada, setTarifaModificada] = useState(solicitud.tarifaValor || TARIFA_MINIMA);
  const [tarifaCambiada, setTarifaCambiada] = useState(false);

  useEffect(() => {
    setTarifaModificada(solicitud.tarifaValor || TARIFA_MINIMA);
    setTarifaCambiada(false);
  }, [solicitud.tarifaValor]);

  const subirTarifa = () => {
    setTarifaModificada(prev => (tarifaCambiada ? prev : (solicitud.tarifaValor || TARIFA_MINIMA)) + configApp.incrementoTarifa);
    setTarifaCambiada(true);
  };

  const bajarTarifa = () => {
    const minimo = solicitud.tarifaValor || TARIFA_MINIMA;
    setTarifaModificada(prev => {
      const actual = tarifaCambiada ? prev : minimo;
      if (actual <= minimo) return actual;
      return actual - configApp.incrementoTarifa;
    });
    setTarifaCambiada(true);
  };

  const aceptarOEnviar = async () => {
    const comisionAplicable = comisionSegunTipo(tipoVehiculo, configApp, solicitud.tipo);
    if (saldoCreditos !== null && saldoCreditos < comisionAplicable) {
      alert('No tienes saldo suficiente para tomar viajes. Recarga tus créditos.');
      return;
    }
    const user = auth.currentUser;
    if (tarifaCambiada) {
      const idViaje = solicitud.id;
      const montoContra = tarifaModificada;
      descartadosRef.current[idViaje] = solicitud.nuevaOferta || solicitud.fechaSolicitud;
      agregarViajeEscuchando(idViaje);
      updateDoc(doc(db, 'viajes', idViaje), {
        estado: 'contraoferta',
        conductorId: user.uid,
        conductorNombre: nombre || 'Conductor',
        conductorTelefono: telefono || '',
        conductorPlaca: placa || '',
        conductorVehiculo: vehiculo || '',
        conductorFoto: fotoConductor || null,
        conductorColor: colorConductor || '',
        contraoferta: `$${montoContra.toLocaleString()}`,
        contraofertaValor: montoContra,
      }).catch(() => {});
    } else {
      agregarViajeEscuchando(solicitud.id);
      updateDoc(doc(db, 'viajes', solicitud.id), {
        estado: 'confirmando',
        conductorId: user.uid,
        conductorNombre: nombre || 'Conductor',
        conductorTelefono: telefono || '',
        conductorPlaca: placa || '',
        conductorVehiculo: vehiculo || '',
        conductorFoto: fotoConductor || null,
        conductorColor: colorConductor || '',
      }).catch(() => {});
    }
    onRechazar(solicitud.id);
  };

  return (
    <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', border: '1px solid #FF7A2F', marginBottom: '12px' }}>
      {solicitud.tipo === 'Mensajería' ? (
        <>
          <div style={{ background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '10px', padding: '8px 12px', margin: '0 0 12px', display: 'inline-block' }}>
            <p style={{ color: '#141416', fontSize: '15px', margin: '0', letterSpacing: '1px', fontWeight: '900' }}>📦 MENSAJERÍA / MANDADO</p>
          </div>
          {solicitud.mensajeria?.queEnvia && <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '17px', margin: '0 0 8px' }}>📦 Envía: {solicitud.mensajeria.queEnvia}</p>}
          <p style={{ color: '#FFFFFF', fontSize: '15px', margin: '0 0 4px', fontWeight: 'bold' }}>📍 Recoger en: {solicitud.origen}</p>
          <p style={{ color: '#FFFFFF', fontSize: '15px', margin: '0 0 8px', fontWeight: 'bold' }}>🏁 Entregar en: {solicitud.destino}</p>
          {solicitud.mensajeria?.recibeNombre && <p style={{ color: '#FFFFFF', fontSize: '15px', margin: '0 0 4px', fontWeight: 'bold' }}>🙋 Recibe: {solicitud.mensajeria.recibeNombre}{solicitud.mensajeria?.recibeTel ? ` · 📞 ${solicitud.mensajeria.recibeTel}` : ''}</p>}
          {solicitud.mensajeria?.nota && <p style={{ color: '#FFCF4D', fontSize: '14px', margin: '0 0 14px', fontWeight: 'bold' }}>📝 {solicitud.mensajeria.nota}</p>}
          {!solicitud.mensajeria?.nota && <div style={{ marginBottom: '14px' }} />}
        </>
      ) : (
        <>
          <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 8px', letterSpacing: '2px', fontWeight: 'bold' }}>🔔 SOLICITUD</p>
          <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0 0 3px' }}>{solicitud.tipo}</p>
          <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0 0 2px' }}>📍 {solicitud.origen}</p>
          <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0 0 14px' }}>🏁 {solicitud.destino}</p>
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', background: '#141416', borderRadius: '14px', padding: '14px' }}>
        <div>
          <p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0' }}>{tarifaCambiada ? 'TU CONTRAOFERTA' : 'OFERTA DEL PASAJERO'}</p>
          <p style={{ color: tarifaCambiada ? '#FF7A2F' : '#2ECC71', fontWeight: '900', fontSize: '26px', margin: '4px 0 0' }}>${(tarifaCambiada ? tarifaModificada : (solicitud.tarifaValor || TARIFA_MINIMA)).toLocaleString()}</p>
          {!tarifaCambiada && solicitud.nuevaOferta && <p style={{ color: '#FFCF4D', fontSize: '11px', margin: '4px 0 0' }}>⬆️ Pasajero actualizó su oferta</p>}
          {tarifaCambiada && <p style={{ color: '#AAAAAA', fontSize: '11px', margin: '4px 0 0' }}>Oferta original: {solicitud.tarifa}</p>}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={bajarTarifa} style={{ width: '52px', height: '52px', background: tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? '#2A2A2E' : '#1A1A1E', border: `2px solid ${tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? '#2A2A2E' : '#FF7A2F'}`, borderRadius: '14px', color: tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? '#AAAAAA' : '#FF7A2F', fontSize: '26px', fontWeight: '900', cursor: tarifaModificada <= (solicitud.tarifaValor || TARIFA_MINIMA) ? 'default' : 'pointer' }}>−</button>
          <button onClick={subirTarifa} style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '26px', fontWeight: '900', cursor: 'pointer' }}>+</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => onRechazar(solicitud.id)} style={{ flex: 1, padding: '13px', background: '#141416', border: 'none', borderRadius: '13px', color: '#AAAAAA', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>✗ Rechazar</button>
        <button onClick={aceptarOEnviar} style={{ flex: 2, padding: '13px', background: tarifaCambiada ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '13px', color: '#141416', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>
          {tarifaCambiada ? '💬 Enviar contraoferta' : '✅ Aceptar viaje'}
        </button>
      </div>
    </div>
  );
}

function AppConductor({ nombre, telefono, placa, vehiculo, tipoVehiculo, onCerrarSesion, onVolver }) {
  const [activo, setActivo] = useState(true);
  const [solicitudes, setSolicitudes] = useState([]);
  const [fase, setFase] = useState(null);
  const [viajeActual, setViajeActual] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [ubicacionPasajero, setUbicacionPasajero] = useState(null);
  const [celebrando, setCelebrando] = useState(false);
  const [viajesEscuchando, setViajesEscuchando] = useState([]);
  const [tiempoLlegada, setTiempoLlegada] = useState(null);
  const [distancia, setDistancia] = useState(null);
  const [respuestaPasajero, setRespuestaPasajero] = useState(null);
  const [mensajeGrande, setMensajeGrande] = useState(null);
  const [mostrarCancelacion, setMostrarCancelacion] = useState(false);
  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [errorCodigo, setErrorCodigo] = useState('');
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [contador, setContador] = useState(240);
  const [buscandoAgotado, setBuscandoAgotado] = useState(false);
  const radioRef = useRef(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [verCreditos, setVerCreditos] = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);
  const [verGanancias, setVerGanancias] = useState(false);
  const [verSeguridad, setVerSeguridad] = useState(false);
  const [verAyuda, setVerAyuda] = useState(false);
  const [verConfig, setVerConfig] = useState(false);
  const [verPromociones, setVerPromociones] = useState(false);
  const [saldoCreditos, setSaldoCreditos] = useState(null);
  const [fotoConductor, setFotoConductor] = useState(null);
  const [colorConductor, setColorConductor] = useState('');
  const [datosCalificacion, setDatosCalificacion] = useState(null);
  const [enLlamada, setEnLlamada] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] = useState(false);
  const [mensajesChat, setMensajesChat] = useState([]);
  const [textoChat, setTextoChat] = useState('');
  const chatFinRef = useRef(null);
  const contadorRef = useRef(null);
  const [debugMsg, setDebugMsg] = React.useState('');
  const ultimoMensajeRef = useRef(null);
  const descartadosRef = useRef({});
  const celebrandoRef = useRef(false);
  const faseRef = useRef(null);
  const comisionDevueltaRef = useRef(false);
  const unsubsViajesRef = useRef({});
  const solicitudesIdsRef = useRef(new Set());
  const ubicacionRef = useRef(null);
  const [refrescoListener, setRefrescoListener] = useState(0);
  const [llamadoAtencion, setLlamadoAtencion] = useState(null);
  const [puedeCerrarLlamado, setPuedeCerrarLlamado] = useState(false);
  const [sancionActiva, setSancionActiva] = useState(null);
  const [contadorSancion, setContadorSancion] = useState('');
  const [saldoVirtualRecibido, setSaldoVirtualRecibido] = useState(null);
  const [configApp, setConfigApp] = useState(CONFIG_APP_DEFECTO);

  // Cargar la configuración global (comisiones, tarifas, etc.) una vez al abrir
  const [debugConfig, setDebugConfig] = useState('Cargando config...');
  useEffect(() => {
    const cargarConfigApp = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'global'));
        if (snap.exists()) {
          const d = snap.data();
          setConfigApp({ ...CONFIG_APP_DEFECTO, ...d });
          setDebugConfig('CONFIG OK → comisionTaxi=' + d.comisionTaxi + ' / comisionMoto=' + d.comisionMototaxi);
        } else {
          setDebugConfig('config/global NO EXISTE');
        }
      } catch (e) {
        setDebugConfig('ERROR: ' + (e.code || '') + ' ' + (e.message || ''));
      }
    };
    cargarConfigApp();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.llamadoPendiente && !faseRef.current) {
        setLlamadoAtencion(data.llamadoPendiente);
        setPuedeCerrarLlamado(false);
        setTimeout(() => setPuedeCerrarLlamado(true), 8000);
      }
    });
    return () => unsub();
  }, []);

  const cerrarLlamado = async () => {
    if (!puedeCerrarLlamado) return;
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, 'usuarios', user.uid), { llamadoPendiente: null });
    } catch(e) {}
    setLlamadoAtencion(null);
  };

  const [textoApelacion, setTextoApelacion] = useState('');
  const [mensajesApelacion, setMensajesApelacion] = useState([]);
  const chatApelacionFinRef = useRef(null);

  useEffect(() => {
    if (chatApelacionFinRef.current) {
      setTimeout(() => chatApelacionFinRef.current.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [mensajesApelacion]);

  const enviarApelacion = async () => {
    if (!textoApelacion.trim()) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      const nuevoMensaje = {
        texto: textoApelacion.trim(),
        autor: 'conductor',
        fecha: new Date().toISOString(),
      };
      const previos = mensajesApelacion || [];
      await updateDoc(doc(db, 'usuarios', user.uid), {
        mensajesApelacion: [...previos, nuevoMensaje],
      });
      setTextoApelacion('');
    } catch (e) {}
  };
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const ahora = new Date();
      const esPermanente = data.activo === false && !data.sancionHasta;
      const esTemporalVigente = data.sancionHasta && new Date(data.sancionHasta) > ahora;

      if (esPermanente || esTemporalVigente) {
        const ultimaSancion = (data.sanciones || [])[data.sanciones.length - 1] || null;
        setSancionActiva({
          razon: ultimaSancion?.razon || 'Motivo no especificado',
          duracion: ultimaSancion?.duracion || (esPermanente ? 'Permanente' : ''),
          permanente: esPermanente,
          sancionHasta: data.sancionHasta || null,
        });
        setMensajesApelacion(data.mensajesApelacion || []);
      } else {
        setSancionActiva(null);
        setMensajesApelacion([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!sancionActiva || sancionActiva.permanente || !sancionActiva.sancionHasta) {
      setContadorSancion('');
      return;
    }
    const actualizar = () => {
      const restante = new Date(sancionActiva.sancionHasta) - new Date();
      if (restante <= 0) {
        setContadorSancion('00:00:00');
        return;
      }
      const horas = Math.floor(restante / 3600000);
      const minutos = Math.floor((restante % 3600000) / 60000);
      const segundos = Math.floor((restante % 60000) / 1000);
      setContadorSancion(`${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`);
    };
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [sancionActiva]);
  useEffect(() => { celebrandoRef.current = celebrando; }, [celebrando]);
  useEffect(() => { faseRef.current = fase; }, [fase]);

  const limpiarVigilantesMenos = useCallback((idViajeMantener) => {
    Object.entries(unsubsViajesRef.current).forEach(([id, cerrar]) => {
      if (id !== idViajeMantener) {
        try { cerrar(); } catch(e) {}
        delete unsubsViajesRef.current[id];
      }
    });
    setViajesEscuchando(prev => prev.filter(id => id === idViajeMantener));
  }, []);

  const limpiarTodosVigilantes = useCallback(() => {
    Object.values(unsubsViajesRef.current).forEach(fn => { try { fn(); } catch(e) {} });
    unsubsViajesRef.current = {};
    setViajesEscuchando([]);
  }, []);

  const limpiarViajesOtrosConductor = useCallback(async (miId, idViajeGanador) => {
    try {
      const snap = await getDocs(query(collection(db, 'viajes'), where('conductorId', '==', miId)));
      snap.docs.forEach(d => {
        if (d.id !== idViajeGanador && (d.data().estado === 'confirmando' || d.data().estado === 'en_negociacion' || d.data().estado === 'esperando')) {
          updateDoc(doc(db, 'viajes', d.id), {
            estado: 'esperando',
            conductorId: null,
            conductorNombre: null,
            conductorPlaca: null,
            conductorVehiculo: null,
            conductorTelefono: null,
          }).catch(() => {});
        }
      });
    } catch(e) {}
  }, []);

  const agregarViajeEscuchando = useCallback((idViaje) => {
    if (unsubsViajesRef.current[idViaje]) return;
    const miId = auth.currentUser?.uid;
    const unsubHolder = { fn: null };

    const cerrarEsteVigilante = () => {
      if (unsubHolder.fn) {
        try { unsubHolder.fn(); } catch(e) {}
        unsubHolder.fn = null;
      }
      delete unsubsViajesRef.current[idViaje];
      setViajesEscuchando(prev => prev.filter(id => id !== idViaje));
    };

    const unsub = onSnapshot(doc(db, 'viajes', idViaje), (snap) => {
      if (!snap.exists()) { cerrarEsteVigilante(); return; }
      const data = snap.data();

      // El pasajero aceptó (contraoferta o directo): este viaje es mío → celebrar aunque el estado llegue junto con los datos.
      if ((data.estado === 'confirmado' || data.estado === 'aceptado') && data.conductorId === miId && !celebrandoRef.current && !faseRef.current) {
        const dataCopy = { id: idViaje, ...data };
        limpiarVigilantesMenos(idViaje);
        limpiarViajesOtrosConductor(miId, idViaje);
        setCelebrando(true);
        celebrandoRef.current = true;
        // CAMBIO: marcar ocupado:true inmediatamente al celebrar, no 3 segundos después
        if (miId) {
          setDoc(doc(db, 'conductores', miId), { ocupado: true }, { merge: true }).catch(() => {});
          (async () => {
            try {
              // Leer la comisión vigente directo de config/global en el momento del cobro
              // (evita usar un valor "congelado" de configApp).
              let comMoto = CONFIG_APP_DEFECTO.comisionMototaxi;
              let comTaxi = CONFIG_APP_DEFECTO.comisionTaxi;
              let comDom = CONFIG_APP_DEFECTO.comisionDomicilio;
              try {
                const snapCfg = await getDoc(doc(db, 'config', 'global'));
                if (snapCfg.exists()) {
                  comMoto = snapCfg.data().comisionMototaxi ?? comMoto;
                  comTaxi = snapCfg.data().comisionTaxi ?? comTaxi;
                  comDom = snapCfg.data().comisionDomicilio ?? comDom;
                }
              } catch (eCfg) {}
              // Si el viaje es un mandado, cobra la comisión de domicilio (no la de mototaxi)
              const comisionAplicable = data.tipo === 'Mensajería' ? comDom : (tipoVehiculo === 'Mototaxi' ? comMoto : comTaxi);

              const snapU = await getDoc(doc(db, 'usuarios', miId));
              const saldoU = snapU.exists() ? (snapU.data().creditos || 0) : 0;
              const nuevoU = saldoU - comisionAplicable;
              await setDoc(doc(db, 'usuarios', miId), { creditos: nuevoU }, { merge: true });
              setSaldoCreditos(nuevoU);
            } catch (e) {}
          })();
        }
        setTimeout(() => {
          setCelebrando(false);
          celebrandoRef.current = false;
          iniciarFase1(dataCopy);
          cerrarEsteVigilante();
        }, 3000);
        return;
      }

      if ((data.estado === 'confirmado' || data.estado === 'aceptado') && data.conductorId !== miId) {
        cerrarEsteVigilante();
        return;
      }

      if (data.estado === 'cancelado' || data.estado === 'cancelado_conductor') {
        cerrarEsteVigilante();
        return;
      }

      // El pasajero subió su oferta: soltar este viaje para que reaparezca en la lista de solicitudes
      if (data.estado === 'esperando' && data.nuevaOferta) {
        delete descartadosRef.current[idViaje];
        cerrarEsteVigilante();
        return;
      }

      if (data.respuestaPasajero) recibirMensajePasajero(data.respuestaPasajero);
    });

    unsubHolder.fn = unsub;
    unsubsViajesRef.current[idViaje] = cerrarEsteVigilante;
    setViajesEscuchando(prev => prev.includes(idViaje) ? prev : [...prev, idViaje]);

    setTimeout(() => {
      if (unsubsViajesRef.current[idViaje]) cerrarEsteVigilante();
    }, 180000);
  }, [limpiarVigilantesMenos, limpiarViajesOtrosConductor]);

  // NUEVO: vigilante global. Escucha TODOS los viajes del conductor a la vez y detecta cuando un pasajero acepta,
  // sin importar cuántas contraofertas haya enviado (arregla que la 2ª contraoferta no le llegara la respuesta).
  useEffect(() => {
    const miId = auth.currentUser?.uid;
    if (!miId) return;
    const q = query(collection(db, 'viajes'), where('conductorId', '==', miId));
    const unsub = onSnapshot(q, (snap) => {
      if (celebrandoRef.current || faseRef.current) return; // ya está celebrando o en viaje: no hacer nada
      const d = snap.docs.find(docu => {
        const dt = docu.data();
        const e = dt.estado;
        if (e !== 'aceptado' && e !== 'confirmado') return false;
        if (dt.fase === 'en_viaje') return false; // ya arrancó, no re-celebrar
        const t = new Date(dt.nuevaOferta || dt.fechaSolicitud).getTime();
        if (isNaN(t)) return true;
        return (Date.now() - t) < 10 * 60 * 1000; // solo aceptaciones recientes
      });
      if (!d) return;
      const data = { id: d.id, ...d.data() };
      limpiarTodosVigilantes();
      limpiarViajesOtrosConductor(miId, data.id);
      setCelebrando(true);
      celebrandoRef.current = true; // se marca de inmediato para que no cobre doble
      setDoc(doc(db, 'conductores', miId), { ocupado: true }, { merge: true }).catch(() => {});
      (async () => {
        try {
          let comMoto = CONFIG_APP_DEFECTO.comisionMototaxi;
          let comTaxi = CONFIG_APP_DEFECTO.comisionTaxi;
          let comDom = CONFIG_APP_DEFECTO.comisionDomicilio;
          try {
            const snapCfg = await getDoc(doc(db, 'config', 'global'));
            if (snapCfg.exists()) {
              comMoto = snapCfg.data().comisionMototaxi ?? comMoto;
              comTaxi = snapCfg.data().comisionTaxi ?? comTaxi;
              comDom = snapCfg.data().comisionDomicilio ?? comDom;
            }
          } catch (eCfg) {}
          // Si el viaje es un mandado, cobra la comisión de domicilio (no la de mototaxi)
          const comisionAplicable = data.tipo === 'Mensajería' ? comDom : (tipoVehiculo === 'Mototaxi' ? comMoto : comTaxi);
          const snapU = await getDoc(doc(db, 'usuarios', miId));
          const saldoU = snapU.exists() ? (snapU.data().creditos || 0) : 0;
          await setDoc(doc(db, 'usuarios', miId), { creditos: saldoU - comisionAplicable }, { merge: true });
          setSaldoCreditos(saldoU - comisionAplicable);
        } catch (e) {}
      })();
      setTimeout(() => {
        setCelebrando(false);
        celebrandoRef.current = false;
        iniciarFase1(data);
      }, 3000);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limpiarTodosVigilantes, limpiarViajesOtrosConductor, tipoVehiculo]);

  const cerrarSesion = async () => {
    try {
      if (viajeActual) {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'Conductor cerró sesión' });
      }
      const user = auth.currentUser;
      if (user) await setDoc(doc(db, 'conductores', user.uid), { activo: false, ocupado: false }, { merge: true });
    } catch(e) {}
    try { await signOut(auth); } catch(e) {}
    if (onCerrarSesion) onCerrarSesion(); else window.location.reload();
  };

  useEffect(() => {
    setDebugCallback((msg) => {
      setDebugMsg(msg);
      setTimeout(() => setDebugMsg(''), 8000);
    });
    registrarTokenFCM();
  }, []);
const cargarSaldo = useCallback(async (uid) => {
    try {
      const id = uid || auth.currentUser?.uid;
      if (!id) { setSaldoCreditos(0); return; }
      const snap = await getDoc(doc(db, 'usuarios', id));
      if (snap.exists()) {
        setSaldoCreditos(snap.data().creditos || 0);
        setFotoConductor(snap.data().fotoConductor || null);
        setColorConductor(snap.data().color || '');
      } else {
        setSaldoCreditos(0);
      }
    } catch (e) { setSaldoCreditos(0); }
  }, []);
  useEffect(() => {
    const desuscribir = auth.onAuthStateChanged((user) => {
      if (user) cargarSaldo(user.uid);
      else setSaldoCreditos(0);
    });
    return () => desuscribir();
  }, [cargarSaldo]);
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
    if (activo) registrarTokenFCM();

    const guardarUbicacion = async (pos) => {
      const nueva = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString() };
      setUbicacion(nueva);
      ubicacionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      try {
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
    if (!activo) { setSolicitudes([]); solicitudesIdsRef.current.clear(); return; }
    const VENTANA_MS = 2 * 60 * 1000;
    const q = query(collection(db, 'viajes'), where('estado', 'in', ['esperando', 'en_negociacion', 'confirmando', 'contraoferta']));
    const unsub = onSnapshot(q, (snap) => {
      const ahora = Date.now();
      const tsDe = (v) => new Date(v.nuevaOferta || v.fechaSolicitud).getTime();
      const vigentes = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(v => {
          if (!v.nuevaOferta && !v.fechaSolicitud) return false;
          // Filtro por tipo: el conductor ve solicitudes de su tipo de vehículo.
          // Los mototaxistas ADEMÁS ven los mandados de mensajería.
          if (tipoVehiculo && v.tipo && v.tipo !== tipoVehiculo) {
            const esMandadoParaMoto = v.tipo === 'Mensajería' && tipoVehiculo === 'Mototaxi';
            if (!esMandadoParaMoto) return false;
          }
          // Filtro por distancia: solo mostrar si el pasajero está dentro del radio de búsqueda actual
          if (ubicacionRef.current && v.pasajeroLat && v.pasajeroLng) {
            const radio = v.radioBusqueda || 7;
            const dist = calcularDistanciaKm(ubicacionRef.current.lat, ubicacionRef.current.lng, v.pasajeroLat, v.pasajeroLng);
            if (dist > radio) return false;
          }
          const ts = tsDe(v);
          const edad = ahora - ts;
          if (edad < 0 || edad > VENTANA_MS) return false;
          const descartadoEn = descartadosRef.current[v.id];
          if (descartadoEn && ts <= new Date(descartadoEn).getTime()) return false;
          return true;
        })
        .sort((a, b) => tsDe(b) - tsDe(a))
        .slice(0, 5);

      const nuevas = vigentes.filter(v => !solicitudesIdsRef.current.has(v.id) && !v.nuevaOferta);
      if (nuevas.length > 0) alertarNuevoViaje();
      solicitudesIdsRef.current = new Set(vigentes.map(v => v.id));
      setSolicitudes(vigentes);
    });

    // Refresco automático: quita solicitudes vencidas aunque nadie toque nada
    const intervaloLimpieza = setInterval(() => {
      const ahora = Date.now();
      const tsDe = (v) => new Date(v.nuevaOferta || v.fechaSolicitud).getTime();
      setSolicitudes(prev => prev.filter(v => {
        const edad = ahora - tsDe(v);
        return edad >= 0 && edad <= VENTANA_MS;
      }));
    }, 10000);

    // Despertador: reconecta la búsqueda cada 10 segundos para que las solicitudes lleguen rápido
    const intervaloRefresco = setInterval(() => {
      setRefrescoListener(r => r + 1);
    }, 10000);

    return () => { unsub(); clearInterval(intervaloLimpieza); clearInterval(intervaloRefresco); };
  }, [activo, tipoVehiculo, refrescoListener]);

  const rechazarSolicitud = useCallback((idViaje) => {
    descartadosRef.current[idViaje] = new Date().toISOString();
    setSolicitudes(prev => prev.filter(s => s.id !== idViaje));
    solicitudesIdsRef.current.delete(idViaje);
  }, []);

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
    faseRef.current = 'recogiendo';
    if (viaje.pasajeroLat && viaje.pasajeroLng) {
      setUbicacionPasajero({ lat: viaje.pasajeroLat, lng: viaje.pasajeroLng });
    }
  };

  const llegueAlPunto = async () => {
    if (!viajeActual) return;
    await updateDoc(doc(db, 'viajes', viajeActual.id), { conductorEnPunto: true, fase: 'en_punto', tiempoEspera: new Date().toISOString() });
    setRespuestaPasajero(null);
    setFase('en_punto');
    setContador(configApp.tiempoEsperaConductor || 240);
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

  const intentarIniciar = () => {
    if (!viajeActual) return;
    // Si el viaje tiene código de seguridad, pedirlo. Si no (pasajero registrado antes), iniciar directo.
    if (viajeActual.codigoSeguridad) {
      setCodigoIngresado('');
      setErrorCodigo('');
      setMostrarCodigo(true);
    } else {
      iniciarViaje();
    }
  };

  const verificarCodigo = () => {
    if (codigoIngresado.trim() === String(viajeActual.codigoSeguridad).trim()) {
      setMostrarCodigo(false);
      setCodigoIngresado('');
      setErrorCodigo('');
      iniciarViaje();
    } else {
      setErrorCodigo('Código incorrecto. Verifícalo con el pasajero');
    }
  };

  const cancelarViaje = async (razon) => {
    clearInterval(contadorRef.current);
    if (viajeActual) {
      await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: razon });
    }
    const user = auth.currentUser;
    if (user) setDoc(doc(db, 'conductores', user.uid), { ocupado: false }, { merge: true }).catch(() => {});
    setMostrarCancelacion(false);
    setFase(null); faseRef.current = null;
    setViajeActual(null); setTiempoLlegada(null); setDistancia(null);
    setRespuestaPasajero(null); setMensajeGrande(null); ultimoMensajeRef.current = null;
    setUbicacionPasajero(null); setDestinoCoords(null); setActivo(true); setContador(240);
  };

  const [mostrarCodigoDescuento, setMostrarCodigoDescuento] = useState(false);
  const [codigoDescuentoIngresado, setCodigoDescuentoIngresado] = useState('');
  const [errorCodigoDescuento, setErrorCodigoDescuento] = useState('');

  const cerrarViajeFinal = async () => {
    if (viajeActual) {
      try {
        await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'finalizado', fase: 'finalizado' });
        setDatosCalificacion({ viajeId: viajeActual.id, nombrePasajero: viajeActual.pasajeroNombre || 'Pasajero', pasajeroId: viajeActual.pasajeroId || '' });
      } catch (err) {}
    }
    const user = auth.currentUser;
    if (user) setDoc(doc(db, 'conductores', user.uid), { ocupado: false }, { merge: true }).catch(() => {});
    setFase(null); faseRef.current = null;
    setViajeActual(null); setTiempoLlegada(null); setDistancia(null);
    setRespuestaPasajero(null); setMensajeGrande(null); ultimoMensajeRef.current = null;
    setUbicacionPasajero(null); setDestinoCoords(null); setActivo(true); setContador(240);
    setMostrarCodigoDescuento(false); setCodigoDescuentoIngresado(''); setErrorCodigoDescuento('');
  };

  const finalizarViaje = async () => {
    clearInterval(contadorRef.current);
    if (viajeActual?.descuentoInfo && !viajeActual.descuentoInfo.consumido) {
      setCodigoDescuentoIngresado('');
      setErrorCodigoDescuento('');
      setMostrarCodigoDescuento(true);
      return;
    }
    await cerrarViajeFinal();
  };

  const verificarCodigoDescuento = async () => {
    if (!viajeActual) return;
    try {
      const info = viajeActual.descuentoInfo;
      const codigoGuardado = String(info?.codigoVerificacion || '').trim().replace(/\D/g, '');
      const codigoEscrito = codigoDescuentoIngresado.trim().replace(/\D/g, '');
      if (!info || !codigoGuardado || codigoGuardado !== codigoEscrito) {
        setErrorCodigoDescuento('Código incorrecto. Verifícalo con el pasajero');
        return;
      }

      const montoDescuento = info.descuentoAplicado || 0;

      // 1) Marcar el descuento como consumido en el VIAJE (el conductor sí puede escribir su propio viaje).
      //    El pasajero, al ver consumido:true en su listener del viaje, borra él mismo su descuentoPendiente.
      await updateDoc(doc(db, 'viajes', viajeActual.id), { 'descuentoInfo.consumido': true });

      // 2) Acreditar el saldo al conductor en SU PROPIO documento (siempre permitido por las reglas).
      const userConductor = auth.currentUser;
      if (userConductor) {
        const snapUC = await getDoc(doc(db, 'usuarios', userConductor.uid));
        const saldoActual = snapUC.exists() ? (snapUC.data().creditos || 0) : 0;
        const nuevoSaldo = saldoActual + montoDescuento;
        await setDoc(doc(db, 'usuarios', userConductor.uid), { creditos: nuevoSaldo }, { merge: true });
        setSaldoCreditos(nuevoSaldo);
        setSaldoVirtualRecibido(montoDescuento);
      }

      // 3) Registro de uso de la promoción (analítica para el admin). Va en su PROPIO try
      //    para que, si las reglas de Firestore no lo permiten, NO bloquee el cierre del viaje
      //    ni el saldo ya acreditado al conductor.
      try {
        const refPromo = doc(db, 'promociones', info.promoId);
        const refUso = doc(db, 'promociones', info.promoId, 'usos', viajeActual.pasajeroId);
        const snapUso = await getDoc(refUso);
        const usosPrevios = snapUso.exists() ? (snapUso.data().veces || 0) : 0;
        const fechaUso = new Date().toISOString();
        await setDoc(refUso, { veces: usosPrevios + 1, ultimaFecha: fechaUso }, { merge: true });

        const snapPromo = await getDoc(refPromo);
        if (snapPromo.exists()) {
          const dPromo = snapPromo.data();
          const historialPrevio = dPromo.historialUsos || [];
          await updateDoc(refPromo, {
            usosTotales: (dPromo.usosTotales || 0) + 1,
            inversionTotal: (dPromo.inversionTotal || 0) + montoDescuento,
            historialUsos: [...historialPrevio, { usuarioId: viajeActual.pasajeroId, fecha: fechaUso, valor: montoDescuento }],
          });
        }
      } catch (ePromo) {}

      // Cerrar el modal del código y mostrar la pantalla de celebración.
      // El cierre real del viaje (y el paso a calificación) ocurre cuando el
      // conductor toca "Continuar" en la celebración.
      setMostrarCodigoDescuento(false);
      setCodigoDescuentoIngresado('');
      setErrorCodigoDescuento('');
      setSaldoVirtualRecibido(montoDescuento);
    } catch (e) {
      setErrorCodigoDescuento('Error al verificar. Intenta de nuevo');
    }
  };

  const omitirCodigoDescuento = async () => {
    await cerrarViajeFinal();
  };
useEffect(() => {
    if (!viajeActual?.id) return;
    const q = query(collection(db, 'viajes', viajeActual.id, 'mensajes'), orderBy('fecha', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMensajesChat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => { if (chatFinRef.current) chatFinRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
    });
    return () => unsub();
  }, [viajeActual?.id]);

  const enviarMensajeConductor = async () => {
    if (!textoChat.trim() || !viajeActual?.id) return;
    const user = auth.currentUser;
    try {
      await addDoc(collection(db, 'viajes', viajeActual.id, 'mensajes'), {
        texto: textoChat.trim(),
        autor: 'conductor',
        autorId: user?.uid || '',
        fecha: new Date().toISOString(),
      });
      setTextoChat('');
    } catch (e) {}
  };
  useEffect(() => {
    if (!viajeActual?.id) return;
    const unsub = onSnapshot(doc(db, 'llamadas', viajeActual.id), (s) => {
      if (s.exists() && s.data().estado === 'llamando') setLlamadaEntrante(true);
      if (!s.exists() || s.data().estado === 'terminada') setLlamadaEntrante(false);
    });
    return () => unsub();
  }, [viajeActual]);

  if (enLlamada) return <Llamada viajeId={viajeActual?.id} miRol="conductor" nombreOtro={viajeActual?.pasajeroNombre || 'Pasajero'} onCerrar={() => { setEnLlamada(false); }} />;
  if (llamadaEntrante) return <Llamada viajeId={viajeActual?.id} miRol="entrante" nombreOtro={viajeActual?.pasajeroNombre || 'Pasajero'} onCerrar={() => { setLlamadaEntrante(false); }} />;
  const llamarQuienRecibe = () => {
    const tel = viajeActual?.mensajeria?.recibeTel;
    if (tel) window.location.href = 'tel:' + tel;
  };
  const tarjetaMensajeria = (viajeActual?.tipo === 'Mensajería' && viajeActual?.mensajeria) ? (
    <div style={{ background: '#141416', borderRadius: '16px', padding: '14px', marginBottom: '14px', border: '1px solid #FF7A2F' }}>
      <p style={{ color: '#FFCF4D', fontSize: '11px', margin: '0 0 8px', letterSpacing: '1px', fontWeight: '900' }}>📦 DATOS DEL MANDADO</p>
      {viajeActual.mensajeria.queEnvia && <p style={{ color: '#FFFFFF', fontSize: '15px', margin: '0 0 4px', fontWeight: 'bold' }}>📦 Paquete: {viajeActual.mensajeria.queEnvia}</p>}
      <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0 0 3px' }}>📍 Recoger en: {viajeActual.origen}</p>
      <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0 0 3px' }}>🏁 Entregar en: {viajeActual.destino}</p>
      {viajeActual.mensajeria.recibeNombre && <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0 0 3px' }}>🙋 Recibe: {viajeActual.mensajeria.recibeNombre}</p>}
      {viajeActual.mensajeria.nota && <p style={{ color: '#FFCF4D', fontSize: '13px', margin: '0 0 8px', fontWeight: 'bold' }}>📝 {viajeActual.mensajeria.nota}</p>}
      {viajeActual.mensajeria.recibeTel && (
        <button onClick={llamarQuienRecibe} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '900', cursor: 'pointer', marginTop: '4px' }}>📞 Llamar a quien recibe ({viajeActual.mensajeria.recibeTel})</button>
      )}
    </div>
  ) : null;
  const esMandado = viajeActual?.tipo === 'Mensajería';
  const comunicacionCompacta = (
    <div style={{ marginBottom: '10px' }}>
      <button onClick={() => setEnLlamada(true)} style={{ width: '100%', marginBottom: '6px', padding: '9px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>📞 {esMandado ? 'Llamar a quien envía' : 'Llamar al pasajero'}</button>
      <div style={{ background: '#141416', borderRadius: '10px', padding: '7px', border: '1px solid #2A2A2E' }}>
        <div style={{ maxHeight: '70px', overflowY: 'auto', marginBottom: '5px' }}>
          {mensajesChat.length === 0 && <p style={{ color: '#555', fontSize: '11px', textAlign: 'center', margin: '3px 0' }}>Sin mensajes aún</p>}
          {mensajesChat.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '4px' }}>
              <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', borderRadius: '9px', padding: '5px 9px', maxWidth: '80%' }}>
                <p style={{ color: '#FFFFFF', fontSize: '12px', margin: '0', lineHeight: '1.3' }}>{m.texto}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={textoChat} onChange={e => setTextoChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarMensajeConductor()} placeholder="Escribe un mensaje..." style={{ flex: 1, background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '8px', padding: '7px 10px', color: '#FFFFFF', fontSize: '13px', outline: 'none' }} />
          <button onClick={enviarMensajeConductor} disabled={!textoChat.trim()} style={{ padding: '7px 12px', background: textoChat.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '16px', cursor: textoChat.trim() ? 'pointer' : 'default' }}>➤</button>
        </div>
      </div>
    </div>
  );
  if (datosCalificacion) return <Calificacion tipo={null} viajeId={datosCalificacion.viajeId} nombreCalificado={datosCalificacion.nombrePasajero} calificadoId={datosCalificacion.pasajeroId} quienCalifica="conductor" onFinalizar={() => setDatosCalificacion(null)} />;
  if (verHistorial) return <HistorialConductor onVolver={() => setVerHistorial(false)} />;
  if (verCreditos) return <Creditos onVolver={() => setVerCreditos(false)} />;
  if (verPerfil) return <MiPerfil onVolver={() => setVerPerfil(false)} />;
  if (verGanancias) return <Ganancias onVolver={() => setVerGanancias(false)} />;
  if (verSeguridad) return <Seguridad onVolver={() => setVerSeguridad(false)} />;
  if (verAyuda) return <AyudaSoporte onVolver={() => setVerAyuda(false)} />;
  if (verConfig) return <Configuracion onVolver={() => setVerConfig(false)} onCerrarSesion={cerrarSesion} />;
  if (verPromociones) return <Promociones onVolver={() => setVerPromociones(false)} />;
  if (celebrando) return <Celebracion />;

  if (saldoVirtualRecibido !== null) return (
    <CelebracionConductor
      monto={saldoVirtualRecibido}
      onCerrar={() => { setSaldoVirtualRecibido(null); cerrarViajeFinal(); }}
    />
  );

  if (fase === 'cancelado_pasajero') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>😕</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '0 0 12px', textAlign: 'center' }}>El pasajero canceló el viaje</h2>
        <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>Razón: <span style={{ color: '#FF7A2F' }}>{viajeActual?.razonCancelacion || 'No especificada'}</span></p>
        <p style={{ color: '#AAAAAA', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>Puedes activarte para recibir nuevos viajes</p>
        <button onClick={() => {
          const user = auth.currentUser;
          if (user) setDoc(doc(db, 'conductores', user.uid), { ocupado: false }, { merge: true }).catch(() => {});
          setFase(null); faseRef.current = null; setViajeActual(null); setUbicacionPasajero(null); setDestinoCoords(null); setActivo(true);
        }} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
      </div>
    );
  }

  if (fase === 'recogiendo' || fase === 'en_punto') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
        {mensajeGrande && <MensajeGrande mensaje={mensajeGrande} onCerrar={() => setMensajeGrande(null)} />}
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_CONDUCTOR} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} />}
        {mostrarCodigo && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #FFCF4D', textAlign: 'center' }}>
              <div style={{ fontSize: '60px', marginBottom: '12px' }}>🔐</div>
              <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '0 0 8px' }}>Código de seguridad</h2>
              <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.5' }}>Pídele al pasajero su código de 4 dígitos para iniciar el viaje</p>
              <input
                value={codigoIngresado}
                onChange={e => { setCodigoIngresado(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setErrorCodigo(''); }}
                type="tel"
                inputMode="numeric"
                placeholder="••••"
                style={{ width: '100%', background: '#141416', border: `2px solid ${errorCodigo ? '#FF4444' : '#2A2A2E'}`, borderRadius: '16px', padding: '18px', color: '#FFFFFF', fontSize: '32px', fontWeight: '900', textAlign: 'center', letterSpacing: '12px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
              />
              {errorCodigo && <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 12px', fontWeight: 'bold' }}>{errorCodigo}</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={() => { setMostrarCodigo(false); setCodigoIngresado(''); setErrorCodigo(''); }} style={{ flex: 1, padding: '16px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '16px', color: '#AAAAAA', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={verificarCodigo} disabled={codigoIngresado.length < 4} style={{ flex: 2, padding: '16px', background: codigoIngresado.length < 4 ? '#2A2A2E' : 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: codigoIngresado.length < 4 ? '#555' : '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: codigoIngresado.length < 4 ? 'default' : 'pointer' }}>✅ Verificar</button>
              </div>
            </div>
          </div>
        )}
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
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#AAAAAA', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        {respuestaPasajero && (
          <div onClick={() => setMensajeGrande(respuestaPasajero)} style={{ position: 'absolute', top: '90px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255, 122, 47, 0.95)', borderRadius: '12px', padding: '12px 16px', cursor: 'pointer' }}>
            <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual?.pasajeroNombre || 'Pasajero'}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual?.tarifa}</p></div>
          </div>
          {tarjetaMensajeria}
          {fase === 'recogiendo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {comunicacionCompacta}
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
                  <p style={{ color: '#AAAAAA', fontSize: '11px', margin: '0' }}>TIEMPO DE ESPERA</p>
                  <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '11px', margin: '4px 0 0' }}>{contador === 0 ? '⚠️ Tiempo agotado' : 'Esperando al pasajero...'}</p>
                </div>
                <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '36px', fontWeight: '900', margin: '0', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(contador / 60)}:{String(contador % 60).padStart(2, '0')}</p>
              </div>
              {respuestaPasajero && (
                <div onClick={() => setMensajeGrande(respuestaPasajero)} style={{ background: 'rgba(255,122,47,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', border: '1px solid #FF7A2F', cursor: 'pointer' }}>
                  <p style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
                </div>
              )}
              <button onClick={() => setEnLlamada(true)} style={{ width: '100%', marginBottom: '10px', padding: '14px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer' }}>📞 Llamar al pasajero</button>
              <div style={{ background: '#141416', borderRadius: '14px', padding: '10px', border: '1px solid #2A2A2E', marginBottom: '12px' }}>
                <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
                  {mensajesChat.length === 0 && <p style={{ color: '#555', fontSize: '13px', textAlign: 'center', margin: '8px 0' }}>Sin mensajes aún</p>}
                  {mensajesChat.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                      <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', borderRadius: '12px', padding: '8px 12px', maxWidth: '80%' }}>
                        <p style={{ color: '#FFFFFF', fontSize: '13px', margin: '0', lineHeight: '1.4' }}>{m.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={textoChat} onChange={e => setTextoChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarMensajeConductor()} placeholder="Escribe un mensaje..." style={{ flex: 1, background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '14px', outline: 'none' }} />
                  <button onClick={enviarMensajeConductor} disabled={!textoChat.trim()} style={{ padding: '10px 16px', background: textoChat.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontSize: '18px', cursor: textoChat.trim() ? 'pointer' : 'default' }}>➤</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setMostrarCancelacion(true)} style={{ flex: 1, padding: '14px', background: 'transparent', border: '1px solid #FF4444', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={intentarIniciar} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>🚀 Iniciar viaje</button>
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
        {mostrarCodigoDescuento && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #2ECC71', textAlign: 'center' }}>
              <div style={{ fontSize: '60px', marginBottom: '12px' }}>🎁</div>
              <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 8px' }}>Código de promoción</h2>
              <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 20px', lineHeight: '1.5' }}>Este viaje tiene un descuento activo. Pídele al pasajero su código de 4 dígitos para recibir tu saldo</p>
              <input
                value={codigoDescuentoIngresado}
                onChange={e => { setCodigoDescuentoIngresado(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setErrorCodigoDescuento(''); }}
                type="tel" inputMode="numeric" placeholder="••••"
                style={{ width: '100%', background: '#141416', border: `2px solid ${errorCodigoDescuento ? '#FF4444' : '#2A2A2E'}`, borderRadius: '16px', padding: '18px', color: '#FFFFFF', fontSize: '32px', fontWeight: '900', textAlign: 'center', letterSpacing: '12px', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }}
              />
              {errorCodigoDescuento && <p style={{ color: '#FF4444', fontSize: '13px', margin: '0 0 12px', fontWeight: 'bold' }}>{errorCodigoDescuento}</p>}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={omitirCodigoDescuento} style={{ flex: 1, padding: '16px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '16px', color: '#AAAAAA', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Omitir</button>
                <button onClick={verificarCodigoDescuento} disabled={codigoDescuentoIngresado.length < 4} style={{ flex: 2, padding: '16px', background: codigoDescuentoIngresado.length < 4 ? '#2A2A2E' : 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: codigoDescuentoIngresado.length < 4 ? '#555' : '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: codigoDescuentoIngresado.length < 4 ? 'default' : 'pointer' }}>✅ Verificar</button>
              </div>
            </div>
          </div>
        )}
        <MapaConductor ubicacionConductor={ubicacion} ubicacionDestino={destinoCoords} colorRuta="#FF7A2F" tipo={viajeActual.tipo} onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }} />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚀 VIAJE EN CURSO</p><p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>🏁 {viajeActual.destino}</p></div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#AAAAAA', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual.pasajeroNombre || 'Pasajero'}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#AAAAAA', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual.tarifa}</p></div>
          </div>
          {tarjetaMensajeria}
          {comunicacionCompacta}
          <button onClick={finalizarViaje} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>🏁 Finalizar viaje</button>
        </div>
      </div>
    );
  }
if (sancionActiva) return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', overflowY: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #2A1414, #1A1A1E)', borderRadius: '28px', padding: '36px 28px', width: '100%', maxWidth: '460px', border: '3px solid #FF4444', textAlign: 'center' }}>
        <div style={{ fontSize: '70px', marginBottom: '18px' }}>🚫</div>
        <p style={{ color: '#FF4444', fontSize: '16px', letterSpacing: '3px', fontWeight: '900', margin: '0 0 16px' }}>CUENTA SANCIONADA</p>
        <p style={{ color: '#FFFFFF', fontSize: '22px', lineHeight: '1.5', fontWeight: 'bold', margin: '0 0 24px' }}>{sancionActiva.razon}</p>
        {sancionActiva.permanente ? (
          <p style={{ color: '#FF4444', fontSize: '24px', fontWeight: '900', margin: '0 0 8px' }}>Suspensión permanente</p>
        ) : (
          <>
            <p style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 'bold', margin: '0 0 12px' }}>Tiempo restante de la sanción ({sancionActiva.duracion}):</p>
            <p style={{ color: '#FF4444', fontSize: '52px', fontWeight: '900', margin: '0 0 16px', fontVariantNumeric: 'tabular-nums' }}>{contadorSancion}</p>
            <p style={{ color: '#FFCF4D', fontSize: '16px', fontWeight: 'bold', margin: '0' }}>Hasta: {sancionActiva.sancionHasta ? new Date(sancionActiva.sancionHasta).toLocaleString('es-CO') : '—'}</p>
          </>
        )}
      </div>
      <p style={{ color: '#CCCCCC', fontSize: '16px', margin: '24px 0 0', textAlign: 'center', maxWidth: '420px', lineHeight: '1.5' }}>{sancionActiva.permanente ? 'Contacta al soporte de GuajiraGo para más información.' : 'No podrás recibir viajes hasta que finalice la sanción.'}</p>

      <div style={{ width: '100%', maxWidth: '460px', background: '#1A1A1E', borderRadius: '20px', padding: '16px', marginTop: '20px', border: '1px solid #2A2A2E' }}>
        <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 'bold', margin: '0 0 10px' }}>💬 ¿Necesitas explicar tu caso?</p>
        <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' }}>
          {mensajesApelacion.length === 0 && <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', margin: '8px 0' }}>Escríbele a GuajiraGo si crees que esto es un error</p>}
          {mensajesApelacion.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.autor === 'conductor' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
              <div style={{ background: m.autor === 'conductor' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', borderRadius: '12px', padding: '10px 14px', maxWidth: '85%' }}>
                <p style={{ color: '#FFFFFF', fontSize: '14px', margin: '0', lineHeight: '1.4' }}>{m.texto}</p>
              </div>
            </div>
          ))}
          <div ref={chatApelacionFinRef} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={textoApelacion} onChange={e => setTextoApelacion(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarApelacion()} placeholder="Escribe tu mensaje..." style={{ flex: 1, background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', padding: '12px 14px', color: '#FFFFFF', fontSize: '15px', outline: 'none' }} />
          <button onClick={enviarApelacion} disabled={!textoApelacion.trim()} style={{ padding: '12px 18px', background: textoApelacion.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#2A2A2E', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '20px', cursor: textoApelacion.trim() ? 'pointer' : 'default' }}>➤</button>
        </div>
      </div>
    </div>
  );

if (llamadoAtencion && !fase) return (  
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '3px solid #FF7A2F', textAlign: 'center' }}>
        <div style={{ fontSize: '60px', marginBottom: '16px' }}>📢</div>
        <p style={{ color: '#FF7A2F', fontSize: '12px', letterSpacing: '3px', fontWeight: 'bold', margin: '0 0 12px' }}>MENSAJE DE GUAJIRAGO</p>
        <p style={{ color: '#FFFFFF', fontSize: '16px', lineHeight: '1.6', margin: '0 0 28px' }}>{llamadoAtencion}</p>
        <button onClick={cerrarLlamado} disabled={!puedeCerrarLlamado} style={{ width: '100%', padding: '16px', background: puedeCerrarLlamado ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', border: 'none', borderRadius: '16px', color: puedeCerrarLlamado ? '#141416' : '#555', fontSize: '16px', fontWeight: '900', cursor: puedeCerrarLlamado ? 'pointer' : 'default', transition: 'all 0.5s' }}>
          {puedeCerrarLlamado ? 'Entendido ✓' : 'Lee el mensaje completo...'}
        </button>
      </div>
    </div>
  );
  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', position: 'relative' }}>
        <MenuLateral nombre={nombre} foto={fotoConductor} onIrPerfil={() => setVerPerfil(true)} onIrCreditos={() => setVerCreditos(true)} onIrViajes={() => setVerHistorial(true)} onIrGanancias={() => setVerGanancias(true)} onIrSeguridad={() => setVerSeguridad(true)} onIrAyuda={() => setVerAyuda(true)} onIrConfig={() => setVerConfig(true)} onIrPromociones={() => setVerPromociones(true)} onCerrarSesion={cerrarSesion} />
        <div onClick={onVolver} style={{ position: 'absolute', top: '18px', left: '120px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer', zIndex: 5 }}><span style={{ fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>‹</span> Volver</div>
        <div style={{ marginTop: '48px' }}>
          <p style={{ color: '#AAAAAA', fontSize: '11px', margin: '0', letterSpacing: '2px' }}>CONDUCTOR</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '20px', margin: '4px 0 8px', fontWeight: '900' }}>Hola, {nombre || 'Conductor'} 👋</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {placa && <div style={{ background: '#141416', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🚘</span><span style={{ color: '#FFCF4D', fontSize: '13px', fontWeight: 'bold' }}>{placa}</span></div>}
            {vehiculo && <div style={{ background: '#141416', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>🏷️</span><span style={{ color: '#FFFFFF', fontSize: '13px' }}>{vehiculo}</span></div>}
            {telefono && <div style={{ background: '#141416', borderRadius: '8px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span>📞</span><span style={{ color: '#FFFFFF', fontSize: '13px' }}>{telefono}</span></div>}
          </div>
        </div>
      </div>
      <div style={{ padding: '24px 20px' }}>
        {debugMsg && (
          <div style={{ background: '#1A1A00', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', border: '1px solid #FFCF4D' }}>
            <p style={{ color: '#FFCF4D', fontSize: '12px', margin: '0', fontFamily: 'monospace' }}>{debugMsg}</p>
          </div>
        )}
        <div onClick={() => setVerCreditos(true)} style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #FF7A2F', cursor: 'pointer', marginBottom: '12px' }}>
          <span style={{ fontSize: '24px' }}>💰</span>
          <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0', flex: 1 }}>Mis créditos</p>
          <p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '0' }}>{saldoCreditos === null ? '...' : `$${saldoCreditos.toLocaleString()}`}</p>
        </div>
        
        <div style={{ background: '#1A1A1E', borderRadius: '14px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ color: activo ? '#FFFFFF' : '#AAAAAA', fontWeight: '900', fontSize: '15px', margin: '0' }}>{activo ? '🟢 Estoy disponible' : '⚪ No disponible'}</p>
          <div onClick={() => { if (!activo && saldoCreditos !== null && saldoCreditos < comisionSegunTipo(tipoVehiculo, configApp)) { alert('No tienes saldo suficiente para recibir viajes. Recarga tus créditos.'); return; } activarAudioiOS(); precargarAudio(); setActivo(!activo); }} style={{ width: '52px', height: '30px', borderRadius: '15px', background: activo ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: activo ? 'flex-end' : 'flex-start', flexShrink: 0 }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#FFFFFF' }}/>
          </div>
        </div>
        
        {viajesEscuchando.length > 0 && !fase && (
          <div style={{ background: 'rgba(255,207,77,0.1)', borderRadius: '16px', padding: '14px 16px', marginBottom: '12px', border: '1px solid #FFCF4D', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>⏳</span>
            <p style={{ color: '#FFCF4D', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>
              Ofertas enviadas{viajesEscuchando.length > 1 ? ` (${viajesEscuchando.length} pasajeros)` : ''}...
            </p>
          </div>
        )}
        {activo && solicitudes.length === 0 && (
          <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '32px 20px', textAlign: 'center', border: '1px dashed #2A2A2E' }}>
            <p style={{ fontSize: '40px', margin: '0 0 12px' }}>⏳</p>
            <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0' }}>Esperando solicitudes de viaje...</p>
          </div>
        )}
        {!activo && (
          <div onClick={() => setVerHistorial(true)} style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #2A2A2E', cursor: 'pointer', marginTop: '4px' }}>
            <span style={{ fontSize: '36px' }}>🕐</span>
            <div><p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>Mis viajes</p><p style={{ color: '#AAAAAA', fontSize: '12px', margin: '4px 0 0' }}>Ver historial y ganancias</p></div>
          </div>
        )}
        {activo && solicitudes.length > 0 && (
          <div>
            {solicitudes.length > 1 && (
              <p style={{ color: '#AAAAAA', fontSize: '11px', letterSpacing: '2px', margin: '0 0 12px', textAlign: 'center' }}>{solicitudes.length} SOLICITUDES DISPONIBLES</p>
            )}
            {solicitudes.map(sol => (
              <TarjetaSolicitud
                key={sol.id}
                solicitud={sol}
                nombre={nombre}
                telefono={telefono}
                placa={placa}
                vehiculo={vehiculo}
                tipoVehiculo={tipoVehiculo}
                fotoConductor={fotoConductor}
                colorConductor={colorConductor}
                saldoCreditos={saldoCreditos}
                configApp={configApp}
                descartadosRef={descartadosRef}
                agregarViajeEscuchando={agregarViajeEscuchando}
                onRechazar={rechazarSolicitud}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AppConductor;