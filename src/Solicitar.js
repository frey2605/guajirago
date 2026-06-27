import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, doc, onSnapshot, updateDoc, getDoc, runTransaction } from 'firebase/firestore';
import Calificacion from './Calificacion';
import { alertarNuevoViaje, precargarAudio, activarAudioiOS } from './Notificaciones';

const centroRiohacha = { lat: 11.5444, lng: -72.9072 };
const TARIFA_DIA = 8000;
const TARIFA_NOCHE = 10000;
const TARIFA_MOTOTAXI = 3000;
function calcularTarifaMinima(tipo) {
  if (tipo === 'Mototaxi') return TARIFA_MOTOTAXI;
  const hora = new Date().getHours();
  // Noche: de 6 pm (18) a 6 am (6) → tarifa más alta
  return (hora >= 18 || hora < 6) ? TARIFA_NOCHE : TARIFA_DIA;
}
const BOUNDS_RIOHACHA = { north: 11.7, south: 11.3, east: -72.6, west: -73.0 };
const DURACION_CONTRAOFERTA_MS = 20000; // 20 segundos

const RESPUESTAS_RAPIDAS = [
  '🏃 Ya voy saliendo',
  '⏳ Dame un momento',
  '👀 No te veo, ¿dónde estás?',
  '📍 Estoy en la entrada',
  '✅ Ya estoy afuera',
];

const RAZONES_CANCELACION_PASAJERO = [
  'Me equivoqué de dirección',
  'El conductor tarda mucho',
  'Conseguí otro transporte',
  'Emergencia personal',
  'Otro motivo',
];

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1A1A1E' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#FFFFFF' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141416' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2A2A2E' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
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

function ConductorLlego({ nombre, placa, onCerrar }) {
  const handleCerrar = (e) => { e.preventDefault(); e.stopPropagation(); onCerrar(); };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ fontSize: '90px', marginBottom: '16px', animation: 'pulso 1s infinite alternate' }}>🚗</div>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '36px 24px', width: '100%', maxWidth: '440px', border: '3px solid #2ECC71', textAlign: 'center' }}>
        <p style={{ color: '#2ECC71', fontSize: '14px', margin: '0 0 12px', letterSpacing: '3px', fontWeight: 'bold' }}>¡ATENCIÓN!</p>
        <h1 style={{ color: '#FFFFFF', fontSize: '40px', fontWeight: '900', margin: '0 0 16px', lineHeight: '1.15' }}>TU CONDUCTOR<br/>YA LLEGÓ</h1>
        {nombre && <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 'bold', margin: '0' }}>{nombre}</p>}
        {placa && <p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '8px 0 0' }}>🚘 {placa}</p>}
      </div>
      <button onClick={handleCerrar} onTouchEnd={handleCerrar} style={{ marginTop: '28px', width: '100%', maxWidth: '440px', padding: '18px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '22px', fontWeight: '900', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>OK</button>
      <style>{`@keyframes pulso { from { transform: scale(1); } to { transform: scale(1.12); } }`}</style>
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
          <button onClick={() => razonSeleccionada && onConfirmar(razonSeleccionada)} style={{ flex: 2, padding: '14px', background: razonSeleccionada ? '#FF4444' : '#2A2A2E', border: 'none', borderRadius: '14px', color: razonSeleccionada ? '#FFFFFF' : '#555', fontSize: '14px', fontWeight: '900', cursor: razonSeleccionada ? 'pointer' : 'default' }}>Confirmar cancelación</button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta de contraoferta con barra de tiempo
function TarjetaContraoferta({ oferta, onAceptar, onRechazar }) {
  const [progreso, setProgreso] = useState(100);

  useEffect(() => {
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      const transcurrido = Date.now() - inicio;
      const restante = Math.max(0, 100 - (transcurrido / DURACION_CONTRAOFERTA_MS * 100));
      setProgreso(restante);
      if (restante === 0) {
        clearInterval(intervalo);
        onRechazar();
      }
    }, 50);
    return () => clearInterval(intervalo);
  }, []);

  const colorBarra = progreso > 50 ? '#2ECC71' : progreso > 25 ? '#FFCF4D' : '#FF4444';

  return (
    <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '16px', marginBottom: '10px', border: '1px solid #FF7A2F' }}>
      {/* Barra de tiempo */}
      <div style={{ height: '4px', background: '#2A2A2E', borderRadius: '2px', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progreso}%`, background: colorBarra, borderRadius: '2px', transition: 'width 0.05s linear, background 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0' }}>{oferta.conductorNombre}</p>
          {oferta.conductorPlaca && <p style={{ color: '#FFCF4D', fontSize: '12px', margin: '3px 0 0' }}>🚘 {oferta.conductorPlaca} · {oferta.conductorVehiculo}</p>}
        </div>
        <p style={{ color: '#FF7A2F', fontSize: '28px', fontWeight: '900', margin: '0' }}>{oferta.contraoferta}</p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onRechazar} style={{ flex: 1, padding: '12px', background: '#141416', border: '1px solid #2A2A2E', borderRadius: '12px', color: '#FF4444', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>❌ No</button>
        <button onClick={onAceptar} style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#141416', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}>✅ Aceptar</button>
      </div>
    </div>
  );
}

function AutocompleteInput({ value, onChange, placeholder, icon }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  useEffect(() => {
    if (!inputRef.current || !window.google) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'co' },
      bounds: new window.google.maps.LatLngBounds(
        new window.google.maps.LatLng(BOUNDS_RIOHACHA.south, BOUNDS_RIOHACHA.west),
        new window.google.maps.LatLng(BOUNDS_RIOHACHA.north, BOUNDS_RIOHACHA.east)
      ),
      strictBounds: true, types: ['establishment', 'geocode'],
    });
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place && place.name) onChange(place.name);
    });
  }, [onChange]);
  return (
    <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '12px', height: '12px', borderRadius: icon === 'origen' ? '50%' : '2px', background: icon === 'origen' ? '#2ECC71' : '#FF7A2F', flexShrink: 0 }}/>
      <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: 'none', border: 'none', outline: 'none', color: '#FFFFFF', fontSize: '16px', width: '100%' }}/>
    </div>
  );
}

function MapaPasajero({ ubicacionPasajero, ubicacionConductor, tipo, onTiempo }) {
  const mapRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorPasajeroRef = useRef(null);
  const marcadorConductorRef = useRef(null);
  const rutaRef = useRef(null);
  const ajustadoRef = useRef(false);

  useEffect(() => {
    if (!window.google || !mapRef.current || mapaRef.current) return;
    mapaRef.current = new window.google.maps.Map(mapRef.current, {
      center: ubicacionPasajero || centroRiohacha,
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
    if (!mapaRef.current || !window.google || !ubicacionPasajero) return;
    if (marcadorPasajeroRef.current) marcadorPasajeroRef.current.setPosition(ubicacionPasajero);
    else marcadorPasajeroRef.current = new window.google.maps.Marker({ position: ubicacionPasajero, map: mapaRef.current, label: { text: '📍', fontSize: '24px' } });
  }, [ubicacionPasajero]);

  useEffect(() => {
    if (!mapaRef.current || !window.google || !ubicacionConductor) return;
    if (marcadorConductorRef.current) marcadorConductorRef.current.setPosition(ubicacionConductor);
    else marcadorConductorRef.current = new window.google.maps.Marker({ position: ubicacionConductor, map: mapaRef.current, label: { text: tipo === 'Taxi' ? '🚗' : '🏍️', fontSize: '28px' } });
  }, [ubicacionConductor, tipo]);

  useEffect(() => {
    if (!mapaRef.current || !window.google || !ubicacionConductor || !ubicacionPasajero) return;
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({ origin: ubicacionConductor, destination: ubicacionPasajero, travelMode: window.google.maps.TravelMode.DRIVING }, (result, status) => {
      if (status === 'OK') {
        if (rutaRef.current) rutaRef.current.setMap(null);
        rutaRef.current = new window.google.maps.DirectionsRenderer({ directions: result, map: mapaRef.current, suppressMarkers: true, polylineOptions: { strokeColor: '#FF7A2F', strokeWeight: 5 } });
        const leg = result.routes[0].legs[0];
        if (onTiempo) onTiempo(leg.duration.text, leg.distance.text);
        if (!ajustadoRef.current) {
          ajustadoRef.current = true;
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(ubicacionConductor);
          bounds.extend(ubicacionPasajero);
          mapaRef.current.fitBounds(bounds, { padding: 80 });
        }
      }
    });
  }, [ubicacionConductor, ubicacionPasajero, onTiempo]);

  return <div ref={mapRef} style={{ width: '100%', height: '100vh' }} />;
}

function Solicitar({ tipo, onVolver, destinoInicial }) {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState(destinoInicial || '');
  const [favoritos, setFavoritos] = useState([]);
  const [avisoLimite, setAvisoLimite] = useState(false);
  const [pantalla, setPantalla] = useState('solicitar');
  const [cargando, setCargando] = useState(false);
  const [viajeId, setViajeId] = useState(null);
  const [viaje, setViaje] = useState(null);
  const [error, setError] = useState('');
  const TARIFA_MINIMA = calcularTarifaMinima(tipo);
  const [tarifa, setTarifa] = useState(TARIFA_MINIMA);
  const [ubicacionPasajero, setUbicacionPasajero] = useState(centroRiohacha);
  const [ubicacionConductor, setUbicacionConductor] = useState(null);
  const [tiempoLlegada, setTiempoLlegada] = useState(null);
  const [distancia, setDistancia] = useState(null);
  const [celebrando, setCelebrando] = useState(false);
  const [conductorEnPunto, setConductorEnPunto] = useState(false);
  const [mostrarLlego, setMostrarLlego] = useState(false);
  const [mostrarCancelacion, setMostrarCancelacion] = useState(false);
  const [contador, setContador] = useState(240);
  const [buscandoAgotado, setBuscandoAgotado] = useState(false);
  const [confirmacionPendiente, setConfirmacionPendiente] = useState(null);
  const [conductorYaTomado, setConductorYaTomado] = useState(false);
  const [tiempoBusqueda, setTiempoBusqueda] = useState(240);
  const contadorBusquedaRef = useRef(null);
  const radioRef = useRef(null);
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [mostrarCalificacion, setMostrarCalificacion] = useState(false);
  const [nuevaTarifa, setNuevaTarifa] = useState(null); // tarifa modificada mientras espera
  const [ofertaModificada, setOfertaModificada] = useState(false);
  // Contraofertas múltiples: lista de { conductorId, conductorNombre, conductorPlaca, conductorVehiculo, contraoferta, contraofertaValor }
  const [contraofertas, setContraofertas] = useState([]);
  const contadorRef = useRef(null);
  const pantallaRef = useRef(pantalla);
  const intervaloRespaldoRef = useRef(null);
  const contaofertasIdsRef = useRef(new Set()); // IDs ya vistos para no duplicar
  const confirmacionMostradaRef = useRef(false);

  useEffect(() => { pantallaRef.current = pantalla; }, [pantalla]);

  useEffect(() => {
    const cargarFavoritos = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists() && Array.isArray(snap.data().favoritos)) {
          setFavoritos(snap.data().favoritos);
        }
      } catch (e) {}
    };
    cargarFavoritos();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacionPasajero({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => navigator.geolocation.getCurrentPosition(
        (pos) => setUbicacionPasajero({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setUbicacionPasajero(centroRiohacha),
        { enableHighAccuracy: true, timeout: 20000 }
      ),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    if (!viajeId) return;

    intervaloRespaldoRef.current = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, 'viajes', viajeId));
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.estado === 'finalizado' && pantallaRef.current === 'fase2') setMostrarCalificacion(true);
        if (data.estado === 'cancelado_conductor' && pantallaRef.current !== 'cancelado_conductor') {
          clearInterval(contadorRef.current);
          setPantalla('cancelado_conductor');
        }
        if (data.conductorEnPunto && pantallaRef.current === 'fase1') setViaje(data);
        // Respaldo: detectar si un conductor aceptó (para Safari que tarda en el listener)
        if (data.estado === 'confirmando' && data.conductorId && pantallaRef.current === 'esperando' && !celebrando && !confirmacionMostradaRef.current) {
          confirmacionMostradaRef.current = true;
          if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
          clearInterval(contadorBusquedaRef.current);
          setConfirmacionPendiente(prev => prev || {
            conductorId: data.conductorId,
            conductorNombre: data.conductorNombre,
            conductorPlaca: data.conductorPlaca,
            conductorVehiculo: data.conductorVehiculo,
            conductorTelefono: data.conductorTelefono,
            tarifa: data.tarifa,
          });
        }
      } catch (e) {}
    }, 5000);

    const unsub = onSnapshot(doc(db, 'viajes', viajeId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setViaje(data);

      if (data.estado === 'cancelado_conductor') {
        clearInterval(contadorRef.current);
        setPantalla('cancelado_conductor');
        return;
      }

      // Contraoferta de un conductor: agregar a la lista si no está ya
      if (data.estado === 'contraoferta' && data.conductorId) {
        const key = data.conductorId + '_' + (data.contraofertaValor || '');
        if (!contaofertasIdsRef.current.has(key)) {
          contaofertasIdsRef.current.add(key);
          alertarNuevoViaje();
          setContraofertas(prev => {
            // Evitar duplicados por conductorId
            if (prev.find(c => c.conductorId === data.conductorId && c.contraofertaValor === data.contraofertaValor)) return prev;
            return [...prev, {
              conductorId: data.conductorId,
              conductorNombre: data.conductorNombre,
              conductorPlaca: data.conductorPlaca,
              conductorVehiculo: data.conductorVehiculo,
              conductorTelefono: data.conductorTelefono,
              contraoferta: data.contraoferta,
              contraofertaValor: data.contraofertaValor,
            }];
          });
        }
        // Si hay contraofertas y estamos en 'esperando', mantenemos esa pantalla
        return;
      }

      // El conductor aceptó el viaje directo: mostrar confirmación al pasajero (no aceptar automático)
      if (data.estado === 'confirmando' && data.conductorId && pantallaRef.current === 'esperando' && !celebrando && !confirmacionMostradaRef.current) {
        confirmacionMostradaRef.current = true;
        if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
        clearInterval(contadorBusquedaRef.current);
        alertarNuevoViaje();
        setConfirmacionPendiente({
          conductorId: data.conductorId,
          conductorNombre: data.conductorNombre,
          conductorPlaca: data.conductorPlaca,
          conductorVehiculo: data.conductorVehiculo,
          conductorTelefono: data.conductorTelefono,
          tarifa: data.tarifa,
        });
        return;
      }

      if (data.estado === 'aceptado' && pantallaRef.current !== 'fase1' && pantallaRef.current !== 'fase2' && !celebrando) {
        if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
        clearInterval(contadorBusquedaRef.current);
        alertarNuevoViaje();
        setContraofertas([]);
        contaofertasIdsRef.current.clear();
        setCelebrando(true);
        setTimeout(() => {
          setCelebrando(false);
          setPantalla('fase1');
          if (data.conductorId) escucharConductor(data.conductorId);
        }, 3000);
      }

      if (data.conductorEnPunto && !conductorEnPunto) {
        setConductorEnPunto(true);
        setMostrarLlego(true);
        setContador(240);
        contadorRef.current = setInterval(() => {
          setContador(prev => { if (prev <= 1) { clearInterval(contadorRef.current); return 0; } return prev - 1; });
        }, 1000);
      }

      if (data.fase === 'en_viaje' && pantallaRef.current !== 'fase2') {
        setPantalla('fase2');
        setTiempoLlegada(null); setDistancia(null);
        geocodificarDestino(data.destino);
      }

      if (data.estado === 'finalizado' && pantallaRef.current === 'fase2') setMostrarCalificacion(true);

      if (data.estado === 'esperando') {
        // El viaje volvió a esperando (contraoferta rechazada o expirada), limpiar contraofertas de ese conductor
        // No limpiamos toda la lista porque pueden haber otras contraofertas válidas aún
      }
    });

    return () => { unsub(); clearInterval(intervaloRespaldoRef.current); };
  }, [viajeId, celebrando, conductorEnPunto]);

  const escucharConductor = useCallback((conductorId) => {
    if (!conductorId) return;
    onSnapshot(doc(db, 'conductores', conductorId), (snap) => {
      if (snap.exists() && snap.data().ubicacion) setUbicacionConductor({ lat: snap.data().ubicacion.lat, lng: snap.data().ubicacion.lng });
    });
  }, []);

  const geocodificarDestino = (destinoTexto) => {
    if (!window.google || !destinoTexto) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: destinoTexto + ', Riohacha, Colombia' }, (results, status) => {
      if (status === 'OK' && results[0]) setDestinoCoords({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
    });
  };

  const enviarRespuesta = async (respuesta) => {
    if (!viajeId) return;
    await updateDoc(doc(db, 'viajes', viajeId), { respuestaPasajero: respuesta });
  };

  const cancelarViaje = async (razon) => {
    clearInterval(contadorRef.current);
    if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
    clearInterval(contadorBusquedaRef.current);
    if (viajeId) await updateDoc(doc(db, 'viajes', viajeId), { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: razon });
    setMostrarCancelacion(false);
    onVolver();
  };

  const guardarFavorito = async () => {
    if (!destino) return;
    const user = auth.currentUser;
    if (!user) return;
    if (favoritos.length >= 3) { setAvisoLimite(true); return; }
    if (favoritos.find(f => f.direccion === destino)) { setError('Ese lugar ya está guardado'); return; }
    const nuevo = { nombre: destino.length > 18 ? destino.slice(0, 18) + '…' : destino, direccion: destino, icono: '⭐' };
    const nuevos = [...favoritos, nuevo];
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { favoritos: nuevos });
      setFavoritos(nuevos);
    } catch (e) { setError('No se pudo guardar el lugar'); }
  };

  const borrarFavorito = async (i) => {
    const user = auth.currentUser;
    if (!user) return;
    const nuevos = favoritos.filter((_, idx) => idx !== i);
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), { favoritos: nuevos });
      setFavoritos(nuevos);
    } catch (e) {}
  };

  const subirNuevaTarifa = () => {
    const base = nuevaTarifa !== null ? nuevaTarifa : tarifa;
    setNuevaTarifa(base + 1000);
    setOfertaModificada(true);
  };

  const bajarNuevaTarifa = () => {
    const base = nuevaTarifa !== null ? nuevaTarifa : tarifa;
    if (base <= tarifa) return; // no puede bajar de la oferta original
    setNuevaTarifa(base - 1000);
    setOfertaModificada(true);
  };

  const enviarNuevaOferta = async () => {
    if (!viajeId || !nuevaTarifa || nuevaTarifa <= tarifa) return;
    try {
      await updateDoc(doc(db, 'viajes', viajeId), {
        tarifa: '$' + nuevaTarifa.toLocaleString(),
        tarifaValor: nuevaTarifa,
        nuevaOferta: new Date().toISOString(),
        estado: 'esperando',
      });
      setTarifa(nuevaTarifa);
      setNuevaTarifa(null);
      setOfertaModificada(false);
    } catch(e) {}
  };
  const seguirBuscando = () => {
    if (!viajeId) return;
    setBuscandoAgotado(false);
    setTiempoBusqueda(120);
    updateDoc(doc(db, 'viajes', viajeId), { radioBusqueda: 3, nuevaOferta: new Date().toISOString() }).catch(() => {});
    if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
    radioRef.current = {
      ampliar: setTimeout(() => {
        updateDoc(doc(db, 'viajes', viajeId), { radioBusqueda: 7 }).catch(() => {});
      }, 60000),
      agotar: setTimeout(() => {
        setBuscandoAgotado(true);
      }, 120000),
    };
    clearInterval(contadorBusquedaRef.current);
    contadorBusquedaRef.current = setInterval(() => {
      setTiempoBusqueda(prev => { if (prev <= 1) { clearInterval(contadorBusquedaRef.current); return 0; } return prev - 1; });
    }, 1000);
  };
  const subirTarifa = () => setTarifa(t => t + 1000);
  const bajarTarifa = () => setTarifa(t => Math.max(TARIFA_MINIMA, t - 1000));

  const solicitarViaje = async () => {
    if (!origen || !destino) { setError('Por favor escribe el origen y destino'); return; }
    activarAudioiOS();
    precargarAudio();
    setCargando(true); setError('');

    // Convertir la dirección escrita del origen en coordenadas (más confiable que el GPS)
    let coordsRecogida = { lat: ubicacionPasajero.lat, lng: ubicacionPasajero.lng };
    try {
      if (window.google) {
        const geocoder = new window.google.maps.Geocoder();
        const resultado = await new Promise((resolve) => {
          geocoder.geocode({ address: origen + ', Riohacha, Colombia' }, (results, status) => {
            if (status === 'OK' && results[0]) {
              resolve({ lat: results[0].geometry.location.lat(), lng: results[0].geometry.location.lng() });
            } else {
              resolve(null);
            }
          });
        });
        if (resultado) coordsRecogida = resultado;
      }
    } catch (e) {}

    try {
      const user = auth.currentUser;
      // Traer el nombre del pasajero guardado en su registro
      let nombrePasajero = '';
      try {
        const snapU = await getDoc(doc(db, 'usuarios', user.uid));
        if (snapU.exists()) nombrePasajero = snapU.data().nombre || '';
      } catch (e) {}
      const docRef = await addDoc(collection(db, 'viajes'), {
        pasajeroId: user.uid, pasajeroEmail: user.email,
        pasajeroNombre: nombrePasajero,
        pasajeroLat: coordsRecogida.lat, pasajeroLng: coordsRecogida.lng,
        tipo, origen, destino, estado: 'esperando',
        tarifa: `$${tarifa.toLocaleString()}`, tarifaValor: tarifa,
        fechaSolicitud: new Date().toISOString(),
        radioBusqueda: 3,
      });
      setViajeId(docRef.id);
      setContraofertas([]);
      contaofertasIdsRef.current.clear();
      setBuscandoAgotado(false);
      setTiempoBusqueda(120);
      setPantalla('esperando');

      // Temporizadores de radio: al 1 min amplía a 7km, a los 2 min marca agotado
      radioRef.current = {
        ampliar: setTimeout(() => {
          updateDoc(doc(db, 'viajes', docRef.id), { radioBusqueda: 7 }).catch(() => {});
        }, 60000),
        agotar: setTimeout(() => {
          setBuscandoAgotado(true);
        }, 120000),
      };
      // Contador visible (cuenta regresiva de 4:00 a 0:00)
      clearInterval(contadorBusquedaRef.current);
      contadorBusquedaRef.current = setInterval(() => {
        setTiempoBusqueda(prev => { if (prev <= 1) { clearInterval(contadorBusquedaRef.current); return 0; } return prev - 1; });
      }, 1000);
    } catch (err) { setError('Error al solicitar viaje. Intenta de nuevo.'); }
    setCargando(false);
  };
const confirmarViaje = async () => {
    if (!viajeId || !confirmacionPendiente) return;
    const datos = confirmacionPendiente;
    setConfirmacionPendiente(null);

    try {
      // Transacción: solo se queda con el conductor si todavía está libre (la "última silla")
      await runTransaction(db, async (transaccion) => {
        const refConductor = doc(db, 'conductores', datos.conductorId);
        const snapConductor = await transaccion.get(refConductor);
        if (snapConductor.exists() && snapConductor.data().ocupado === true) {
          throw new Error('CONDUCTOR_OCUPADO');
        }
        // Marcar al conductor como ocupado y aceptar el viaje, todo junto
        transaccion.set(refConductor, { ocupado: true }, { merge: true });
        transaccion.update(doc(db, 'viajes', viajeId), { estado: 'aceptado' });
      });

      // Éxito: el conductor era nuestro, celebramos
      setCelebrando(true);
      setTimeout(() => {
        setCelebrando(false);
        setPantalla('fase1');
        if (datos.conductorId) escucharConductor(datos.conductorId);
      }, 3000);
    } catch (e) {
      // El conductor ya fue tomado por otro pasajero
      setConductorYaTomado(true);
    }
  };

  const rechazarConfirmacion = async () => {
    setConfirmacionPendiente(null);
    if (viajeId) {
      // Devolver el viaje a 'esperando' y liberar al conductor
      updateDoc(doc(db, 'viajes', viajeId), {
        estado: 'esperando',
        conductorId: null,
        conductorNombre: null,
        conductorPlaca: null,
        conductorVehiculo: null,
        conductorTelefono: null,
        nuevaOferta: new Date().toISOString(),
      }).catch(() => {});
    }
  };
  const aceptarContraoferta = async (oferta) => {
    if (!viajeId) return;
    setContraofertas([]);
    contaofertasIdsRef.current.clear();
    setCelebrando(true);
    try {
      await updateDoc(doc(db, 'viajes', viajeId), {
        estado: 'aceptado',
        conductorId: oferta.conductorId,
        conductorNombre: oferta.conductorNombre,
        conductorPlaca: oferta.conductorPlaca,
        conductorVehiculo: oferta.conductorVehiculo,
        conductorTelefono: oferta.conductorTelefono,
        tarifa: oferta.contraoferta,
        tarifaValor: oferta.contraofertaValor,
      });
    } catch (e) {}
    setTimeout(() => {
      setCelebrando(false);
      setPantalla('fase1');
      escucharConductor(oferta.conductorId);
    }, 3000);
  };

  const rechazarContraoferta = async (conductorId) => {
    // Quitar de la lista local
    setContraofertas(prev => prev.filter(c => c.conductorId !== conductorId));
    // Si no quedan más contraofertas, volver el viaje a esperando
    setContraofertas(prev => {
      if (prev.filter(c => c.conductorId !== conductorId).length === 0 && viajeId) {
        updateDoc(doc(db, 'viajes', viajeId), { estado: 'esperando' }).catch(() => {});
      }
      return prev.filter(c => c.conductorId !== conductorId);
    });
  };

  if (mostrarCalificacion) return <Calificacion tipo={tipo} viajeId={viajeId} nombreCalificado={viaje?.conductorNombre} quienCalifica="pasajero" onFinalizar={onVolver} />;
  if (celebrando) return <Celebracion />;

  if (conductorYaTomado) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '70px', marginBottom: '16px' }}>😕</div>
        <div style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '2px solid #FF7A2F', textAlign: 'center' }}>
          <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: '900', margin: '0 0 12px' }}>UPP, ESTE CONDUCTOR YA NO ESTÁ DISPONIBLE 🙈</h2>
          <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0', lineHeight: '1.5' }}>Otro pasajero lo tomó primero. No te preocupes, seguimos buscando otro conductor para ti.</p>
        </div>
        <button onClick={() => { setConductorYaTomado(false); seguirBuscando(); }} style={{ marginTop: '28px', width: '100%', maxWidth: '420px', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '17px', fontWeight: '900', cursor: 'pointer' }}>🔄 Seguir buscando</button>
      </div>
    );
  }

  if (confirmacionPendiente) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '16px', animation: 'pulso 1s infinite alternate' }}>🚗</div>
        <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '32px 24px', width: '100%', maxWidth: '440px', border: '3px solid #2ECC71', textAlign: 'center' }}>
          <p style={{ color: '#2ECC71', fontSize: '13px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>¡UN CONDUCTOR ACEPTÓ!</p>
          <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '0 0 12px' }}>{confirmacionPendiente.conductorNombre || 'Conductor'}</h2>
          {confirmacionPendiente.conductorPlaca && <p style={{ color: '#FFCF4D', fontSize: '18px', fontWeight: '900', margin: '0 0 4px' }}>🚘 {confirmacionPendiente.conductorPlaca}</p>}
          {confirmacionPendiente.conductorVehiculo && <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 12px' }}>{confirmacionPendiente.conductorVehiculo}</p>}
          <p style={{ color: '#2ECC71', fontSize: '32px', fontWeight: '900', margin: '8px 0 0' }}>{confirmacionPendiente.tarifa}</p>
        </div>
        <p style={{ color: '#FFFFFF', fontSize: '16px', margin: '24px 0 16px', textAlign: 'center', fontWeight: 'bold' }}>¿Confirmas este viaje?</p>
        <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '440px' }}>
          <button onClick={rechazarConfirmacion} style={{ flex: 1, padding: '16px', background: '#141416', border: '1px solid #FF4444', borderRadius: '16px', color: '#FF4444', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>❌ No</button>
          <button onClick={confirmarViaje} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '17px', fontWeight: '900', cursor: 'pointer' }}>✅ Sí, confirmar</button>
        </div>
        <style>{`@keyframes pulso { from { transform: scale(1); } to { transform: scale(1.12); } }`}</style>
      </div>
    );
  }

  if (pantalla === 'cancelado_conductor') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>😕</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '900', margin: '0 0 12px', textAlign: 'center' }}>El conductor canceló el viaje</h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>Razón: <span style={{ color: '#FF7A2F' }}>{viaje?.razonCancelacion || 'No especificada'}</span></p>
        <p style={{ color: '#555', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>Puedes solicitar otro viaje</p>
        <button onClick={onVolver} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
      </div>
    );
  }

  if (pantalla === 'fase1') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_PASAJERO} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} />}
        {mostrarLlego && <ConductorLlego nombre={viaje?.conductorNombre} placa={viaje?.conductorPlaca} onCerrar={() => setMostrarLlego(false)} />}
        <MapaPasajero ubicacionPasajero={ubicacionPasajero} ubicacionConductor={ubicacionConductor} tipo={tipo} />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#2ECC71', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚗 CONDUCTOR EN CAMINO</p>
            <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '900', margin: '2px 0 0' }}>{viaje?.conductorNombre} · {viaje?.conductorPlaca}</p>
          </div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        {conductorEnPunto && (
          <div style={{ position: 'absolute', top: '90px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '20px', padding: '20px', border: '2px solid #2ECC71' }}>
            <p style={{ color: '#2ECC71', fontSize: '16px', fontWeight: '900', margin: '0 0 4px', textAlign: 'center' }}>📍 ¡Tu conductor llegó!</p>
            <div style={{ background: contador <= 60 ? 'rgba(255,68,68,0.15)' : 'rgba(255,207,77,0.1)', borderRadius: '12px', padding: '10px 16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${contador <= 60 ? '#FF4444' : '#FFCF4D'}` }}>
              <p style={{ color: '#555', fontSize: '12px', margin: '0' }}>{contador === 0 ? '⚠️ Tiempo agotado' : 'Sal pronto o el conductor puede cancelar'}</p>
              <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '28px', fontWeight: '900', margin: '0', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(contador / 60)}:{String(contador % 60).padStart(2, '0')}</p>
            </div>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 12px', textAlign: 'center' }}>Responde rápido:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {RESPUESTAS_RAPIDAS.map((resp, i) => (
                <button key={i} onClick={() => enviarRespuesta(resp)} style={{ padding: '12px 16px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}>{resp}</button>
              ))}
            </div>
            <button onClick={() => setMostrarCancelacion(true)} style={{ width: '100%', marginTop: '12px', padding: '14px', background: 'transparent', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar viaje</button>
          </div>
        )}
        {!conductorEnPunto && (
          <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>CONDUCTOR</p>
                <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viaje?.conductorNombre}</p>
                {viaje?.conductorPlaca && <p style={{ color: '#FFCF4D', fontSize: '12px', margin: '2px 0 0' }}>🚘 {viaje.conductorPlaca} · {viaje.conductorVehiculo}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ textAlign: 'right' }}><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '18px', fontWeight: '900', margin: '2px 0 0' }}>{viaje?.tarifa}</p></div>
              </div>
            </div>
            <button onClick={() => setMostrarCancelacion(true)} style={{ width: '100%', marginTop: '12px', padding: '14px', background: 'transparent', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar viaje</button>
          </div>
        )}
      </div>
    );
  }

  if (pantalla === 'fase2') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
        <MapaPasajero ubicacionPasajero={destinoCoords || ubicacionPasajero} ubicacionConductor={ubicacionConductor} tipo={tipo} onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }} />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚀 VIAJE EN CURSO</p>
            <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>🏁 {destino}</p>
          </div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>CONDUCTOR</p><p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viaje?.conductorNombre}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '18px', fontWeight: '900', margin: '4px 0 0' }}>{viaje?.tarifa}</p></div>
          </div>
        </div>
      </div>
    );
  }

  if (pantalla === 'esperando') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_PASAJERO} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} />}

        <div style={{ fontSize: '80px', marginBottom: '24px' }}>{buscandoAgotado ? '😕' : (tipo === 'Taxi' ? '🚗' : '🏍️')}</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '22px', margin: '0 0 8px', textAlign: 'center' }}>{buscandoAgotado ? 'No encontramos conductor' : 'Buscando conductor...'}</h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0 0 4px', textAlign: 'center' }}>{origen} → {destino}</p>
        {!buscandoAgotado && <p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '0 0 16px', textAlign: 'center' }}>Tu oferta: ${tarifa.toLocaleString()}</p>}
        {!buscandoAgotado && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, height: '8px', background: '#2A2A2E', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(tiempoBusqueda / 120) * 100}%`, background: tiempoBusqueda > 60 ? '#2ECC71' : tiempoBusqueda > 30 ? '#FFCF4D' : '#FF4444', borderRadius: '4px', transition: 'width 1s linear, background 0.5s' }} />
            </div>
            <span style={{ color: tiempoBusqueda > 60 ? '#2ECC71' : tiempoBusqueda > 30 ? '#FFCF4D' : '#FF4444', fontSize: '15px', fontWeight: '900', fontVariantNumeric: 'tabular-nums', minWidth: '42px', textAlign: 'right' }}>{Math.floor(tiempoBusqueda / 60)}:{String(tiempoBusqueda % 60).padStart(2, '0')}</span>
          </div>
        )}
        {buscandoAgotado && (
          <div style={{ width: '100%', marginBottom: '24px' }}>
            <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 16px', textAlign: 'center', lineHeight: '1.5' }}>No hay conductores disponibles cerca en este momento. Puedes seguir buscando o subir tu oferta.</p>
            <button onClick={seguirBuscando} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '17px', fontWeight: '900', cursor: 'pointer' }}>🔄 Seguir buscando</button>
          </div>
        )}

        {/* Contraofertas múltiples */}
        {contraofertas.length > 0 && (
          <div style={{ width: '100%', marginBottom: '16px' }}>
            <p style={{ color: '#555', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px', textAlign: 'center' }}>PROPUESTAS DE CONDUCTORES</p>
            {contraofertas.map(oferta => (
              <TarjetaContraoferta
                key={oferta.conductorId}
                oferta={oferta}
                onAceptar={() => aceptarContraoferta(oferta)}
                onRechazar={() => rechazarContraoferta(oferta.conductorId)}
              />
            ))}
          </div>
        )}

        {/* Subir oferta mientras espera */}
        <div style={{ width: '100%', background: '#1A1A1E', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid #2A2A2E' }}>
          <p style={{ color: '#555', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px', textAlign: 'center' }}>¿QUIERES SUBIR TU OFERTA?</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button onClick={bajarNuevaTarifa} style={{ width: '48px', height: '48px', background: (nuevaTarifa || tarifa) <= tarifa ? '#2A2A2E' : '#1A1A1E', border: `2px solid ${(nuevaTarifa || tarifa) <= tarifa ? '#2A2A2E' : '#FF7A2F'}`, borderRadius: '14px', color: (nuevaTarifa || tarifa) <= tarifa ? '#555' : '#FF7A2F', fontSize: '24px', cursor: (nuevaTarifa || tarifa) <= tarifa ? 'default' : 'pointer', fontWeight: 'bold' }}>−</button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: '900', margin: '0' }}>${(nuevaTarifa || tarifa).toLocaleString()}</p>
              <p style={{ color: '#555', fontSize: '11px', margin: '4px 0 0' }}>Oferta actual: ${tarifa.toLocaleString()}</p>
            </div>
            <button onClick={subirNuevaTarifa} style={{ width: '48px', height: '48px', background: '#1A1A1E', border: '2px solid #2ECC71', borderRadius: '14px', color: '#2ECC71', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
          </div>
          <button onClick={enviarNuevaOferta} disabled={!ofertaModificada} style={{ width: '100%', padding: '14px', background: ofertaModificada ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', border: 'none', borderRadius: '14px', color: ofertaModificada ? '#141416' : '#555', fontSize: '15px', fontWeight: '900', cursor: ofertaModificada ? 'pointer' : 'default' }}>
            {ofertaModificada ? '⬆️ Enviar nueva oferta' : 'Modifica la tarifa para enviar'}
          </button>
        </div>

        <div style={{ width: '60px', height: '4px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '2px', marginBottom: '16px' }}/>
        <button onClick={() => setMostrarCancelacion(true)} style={{ background: 'transparent', border: '1px solid #2A2A2E', borderRadius: '14px', color: '#FF4444', fontSize: '14px', padding: '14px 32px', cursor: 'pointer' }}>Cancelar viaje</button>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#141416', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      {avisoLimite && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: '#1A1A1E', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '380px', border: '1px solid #FF7A2F', textAlign: 'center', position: 'relative' }}>
            <span onClick={() => setAvisoLimite(false)} style={{ position: 'absolute', top: '16px', right: '20px', color: '#AAAAAA', fontSize: '26px', cursor: 'pointer', lineHeight: '1' }}>✕</span>
            <div style={{ fontSize: '54px', marginBottom: '12px' }}>📍</div>
            <h2 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: '900', margin: '0 0 10px' }}>Llegaste al límite</h2>
            <p style={{ color: '#AAAAAA', fontSize: '14px', margin: '0 0 24px', lineHeight: '1.5' }}>Solo puedes guardar 3 lugares. Borra uno para poder agregar otro.</p>
            <button onClick={() => setAvisoLimite(false)} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '14px', color: '#141416', fontSize: '16px', fontWeight: '900', cursor: 'pointer' }}>Entendido</button>
          </div>
        </div>
      )}
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div onClick={onVolver} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.12)', borderRadius: '12px', color: '#FFFFFF', fontSize: '14px', fontWeight: '500', padding: '8px 16px', cursor: 'pointer' }}><span style={{ fontSize: '22px', fontWeight: '900', lineHeight: '1', position: 'relative', top: '-1px' }}>‹</span> Volver</div>
        <h2 style={{ color: '#FFFFFF', margin: '0', fontSize: '20px' }}>Solicitar {tipo}</h2>
      </div>
      <div style={{ padding: '24px 20px' }}>
        <AutocompleteInput value={origen} onChange={setOrigen} placeholder="¿Dónde estás? (Riohacha)" icon="origen" />
        <AutocompleteInput value={destino} onChange={setDestino} placeholder="¿A dónde vas? (Riohacha)" icon="destino" />

        {destino && !favoritos.find(f => f.direccion === destino) && (
          <div onClick={guardarFavorito} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '16px', padding: '16px', marginBottom: '16px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(255,122,47,0.4)' }}>
            <span style={{ fontSize: '22px' }}>⭐</span>
            <span style={{ color: '#141416', fontSize: '16px', fontWeight: '900' }}>Guardar este lugar</span>
          </div>
        )}

        {favoritos.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#AAAAAA', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px' }}>MIS LUGARES</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {favoritos.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1A1A1E', border: '1px solid #2A2A2E', borderRadius: '14px', padding: '10px 14px' }}>
                  <div onClick={() => setDestino(f.direccion)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '18px' }}>{f.icono}</span>
                    <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold' }}>{f.nombre}</span>
                  </div>
                  <span onClick={() => borrarFavorito(i)} style={{ color: '#FF4444', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold', paddingLeft: '4px' }}>✕</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: '#1A1A1E', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <p style={{ color: '#555', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px' }}>TU OFERTA</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={bajarTarifa} style={{ width: '48px', height: '48px', background: tarifa <= TARIFA_MINIMA ? '#2A2A2E' : '#1A1A1E', border: `2px solid ${tarifa <= TARIFA_MINIMA ? '#2A2A2E' : '#FF7A2F'}`, borderRadius: '14px', color: tarifa <= TARIFA_MINIMA ? '#555' : '#FF7A2F', fontSize: '24px', cursor: tarifa <= TARIFA_MINIMA ? 'default' : 'pointer', fontWeight: 'bold' }}>−</button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#FFFFFF', fontSize: '36px', fontWeight: '900', margin: '0' }}>${tarifa.toLocaleString()}</p>
              <p style={{ color: '#555', fontSize: '11px', margin: '4px 0 0' }}>{tarifa === TARIFA_MINIMA ? 'Tarifa mínima' : 'Oferta personalizada'}</p>
            </div>
            <button onClick={subirTarifa} style={{ width: '48px', height: '48px', background: '#1A1A1E', border: '2px solid #2ECC71', borderRadius: '14px', color: '#2ECC71', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
          </div>
          <p style={{ color: '#555', fontSize: '11px', margin: '12px 0 0', textAlign: 'center' }}>💡 Ofrece más para que te atiendan más rápido</p>
        </div>
        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
        <button onClick={solicitarViaje} style={{ width: '100%', padding: '18px', background: cargando ? '#2A2A2E' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: cargando ? '#555' : '#141416', fontSize: '18px', fontWeight: '900', cursor: cargando ? 'default' : 'pointer' }}>
          {cargando ? 'Enviando...' : `Solicitar ${tipo} — $${tarifa.toLocaleString()}`}
        </button>
      </div>
    </div>
  );
}

export default Solicitar;