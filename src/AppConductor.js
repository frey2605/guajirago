import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const centroRiohacha = { lat: 11.5444, lng: -72.9072 };
const TARIFA_MINIMA = 8000;

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

function MapaConductor({ ubicacionConductor, ubicacionDestino, colorRuta, tipo, onTiempo }) {
  const mapRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorConductorRef = useRef(null);
  const marcadorDestinoRef = useRef(null);
  const rutaRef = useRef(null);
  const ajustadoRef = useRef(false);

  // Inicializar el mapa apenas el div esté listo (no espera al GPS)
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

  // Actualizar marcador del conductor cada vez que cambia su posición
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
      // Primera vez que tenemos ubicación: centrar el mapa en el conductor
      mapaRef.current.setCenter(ubicacionConductor);
    }
  }, [ubicacionConductor, tipo]);

  // Actualizar marcador del destino
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

  // Calcular la ruta cada vez que tengamos ambos puntos (se recalcula al moverse)
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
        // Ajustar el zoom para ver toda la ruta solo la primera vez
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

function AppConductor({ nombre, telefono, placa, vehiculo }) {
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
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [contador, setContador] = useState(240); // 4 minutos en segundos
  const contadorRef = useRef(null);

  const cerrarSesion = async () => { await signOut(auth); window.location.reload(); };

  useEffect(() => {
    if (!activo && !fase) return;
    const user = auth.currentUser;
    if (!user || !navigator.geolocation) return;

    const guardarUbicacion = async (pos) => {
      const nueva = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date().toISOString() };
      setUbicacion(nueva);
      try {
        await setDoc(doc(db, 'conductores', user.uid), {
          nombre: nombre || 'Conductor', telefono: telefono || '',
          placa: placa || '', vehiculo: vehiculo || '',
          ubicacion: nueva, activo: true,
        });
      } catch (e) {}
    };

    // Primer intento rápido sin alta precisión (el iPhone responde al instante)
    navigator.geolocation.getCurrentPosition(
      guardarUbicacion,
      () => {
        // Si falla, intentar con alta precisión
        navigator.geolocation.getCurrentPosition(guardarUbicacion, () => {}, { enableHighAccuracy: true, timeout: 20000 });
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );

    // Seguimiento continuo con alta precisión y respaldo de baja precisión
    let intervalo;
    try {
      intervalo = navigator.geolocation.watchPosition(
        guardarUbicacion,
        (err) => {
          console.error('GPS alta precisión:', err);
          // Respaldo: seguir con baja precisión
          intervalo = navigator.geolocation.watchPosition(
            guardarUbicacion,
            (e) => console.error('GPS:', e),
            { enableHighAccuracy: false, maximumAge: 5000, timeout: 20000 }
          );
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
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
    if (!activo) { setSolicitud(null); return; }
    const q = query(collection(db, 'viajes'), where('estado', '==', 'esperando'));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        const datos = { id: d.id, ...d.data() };
        setSolicitud(datos);
        setTarifaModificada(datos.tarifaValor || TARIFA_MINIMA);
        setTarifaCambiada(false);
      } else { setSolicitud(null); }
    });
    return () => unsub();
  }, [activo]);

  useEffect(() => {
    if (!viajeIdEscuchando) return;
    const unsub = onSnapshot(doc(db, 'viajes', viajeIdEscuchando), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.estado === 'aceptado' && !celebrando && !fase) {
          setCelebrando(true);
          setTimeout(() => {
            setCelebrando(false);
            iniciarFase1({ id: viajeIdEscuchando, ...data });
            setViajeIdEscuchando(null);
          }, 3000);
        }
        if (data.respuestaPasajero) setRespuestaPasajero(data.respuestaPasajero);
      }
    });
    return () => unsub();
  }, [viajeIdEscuchando, celebrando, fase]);

  useEffect(() => {
    if (!viajeActual?.id || fase !== 'recogiendo') return;
    const unsub = onSnapshot(doc(db, 'viajes', viajeActual.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.respuestaPasajero) setRespuestaPasajero(data.respuestaPasajero);
        if (data.fase === 'en_viaje') {
          setFase('en_viaje');
          setTiempoLlegada(null); setDistancia(null);
          geocodificarDestino(data.destino);
        }
      }
    });
    return () => unsub();
  }, [viajeActual, fase]);

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
    await updateDoc(doc(db, 'viajes', viajeActual.id), {
      conductorEnPunto: true,
      fase: 'en_punto',
      tiempoEspera: new Date().toISOString(),
    });
    setRespuestaPasajero(null);
    setFase('en_punto');
    setContador(240);
    // Geocodificar destino para mostrar mapa al destino
    geocodificarDestino(viajeActual.destino);
    // Iniciar contador regresivo
    contadorRef.current = setInterval(() => {
      setContador(prev => {
        if (prev <= 1) {
          clearInterval(contadorRef.current);
          return 0;
        }
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

  const finalizarViaje = async () => {
    clearInterval(contadorRef.current);
    if (viajeActual) { try { await updateDoc(doc(db, 'viajes', viajeActual.id), { estado: 'finalizado', fase: 'finalizado' }); } catch (err) {} }
    setFase(null); setViajeActual(null); setTiempoLlegada(null); setDistancia(null);
    setRespuestaPasajero(null); setUbicacionPasajero(null); setDestinoCoords(null); setActivo(false); setContador(240);
  };

  const subirTarifa = () => { setTarifaModificada(t => t + 1000); setTarifaCambiada(true); };

  const aceptarOEnviar = async () => {
    if (!solicitud) return;
    const user = auth.currentUser;
    if (tarifaCambiada) {
      await updateDoc(doc(db, 'viajes', solicitud.id), {
        estado: 'contraoferta', conductorId: user.uid,
        conductorNombre: nombre || 'Conductor', conductorTelefono: telefono || '',
        conductorPlaca: placa || '', conductorVehiculo: vehiculo || '',
        contraoferta: `$${tarifaModificada.toLocaleString()}`, contraofertaValor: tarifaModificada,
      });
      setViajeIdEscuchando(solicitud.id); setSolicitud(null);
    } else {
      setCelebrando(true);
      await updateDoc(doc(db, 'viajes', solicitud.id), {
        estado: 'aceptado', conductorId: user.uid,
        conductorNombre: nombre || 'Conductor', conductorTelefono: telefono || '',
        conductorPlaca: placa || '', conductorVehiculo: vehiculo || '',
      });
      setTimeout(() => { setCelebrando(false); iniciarFase1(solicitud); setSolicitud(null); }, 3000);
    }
  };

  if (celebrando) return <Celebracion />;

  if (fase === 'recogiendo' || fase === 'en_punto') {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
        <MapaConductor
          ubicacionConductor={ubicacion}
          ubicacionDestino={fase === 'en_punto' ? destinoCoords : ubicacionPasajero}
          colorRuta={fase === 'en_punto' ? '#FF7A2F' : '#2ECC71'}
          tipo={viajeActual?.tipo}
          onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }}
        />
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(20,20,22,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: fase === 'en_punto' ? '#FF7A2F' : '#2ECC71', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>
              {fase === 'en_punto' ? '🏁 RUTA AL DESTINO' : '🚗 YENDO A RECOGER'}
            </p>
            <p style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>
              {fase === 'en_punto' ? viajeActual?.destino : viajeActual?.origen}
            </p>
          </div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FFCF4D', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#555', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        {respuestaPasajero && (
          <div style={{ position: 'absolute', top: '90px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255, 122, 47, 0.95)', borderRadius: '12px', padding: '12px 16px' }}>
            <p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(20,20,22,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>PASAJERO</p><p style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viajeActual?.pasajeroEmail?.split('@')[0]}</p></div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#555', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '4px 0 0' }}>{viajeActual?.tarifa}</p></div>
          </div>
          {fase === 'recogiendo' && <button onClick={llegueAlPunto} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>📍 Llegué al punto</button>}
          {fase === 'en_punto' && (
            <div>
              {/* Contador regresivo */}
              <div style={{
                background: contador <= 60 ? 'rgba(255,68,68,0.15)' : 'rgba(255,207,77,0.1)',
                borderRadius: '16px', padding: '16px', marginBottom: '16px',
                border: `1px solid ${contador <= 60 ? '#FF4444' : '#FFCF4D'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <p style={{ color: '#555', fontSize: '11px', margin: '0' }}>TIEMPO DE ESPERA</p>
                  <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '11px', margin: '4px 0 0' }}>
                    {contador === 0 ? '⚠️ Tiempo agotado' : 'Esperando al pasajero...'}
                  </p>
                </div>
                <p style={{
                  color: contador <= 60 ? '#FF4444' : '#FFCF4D',
                  fontSize: '36px', fontWeight: '900', margin: '0', fontVariantNumeric: 'tabular-nums',
                }}>
                  {Math.floor(contador / 60)}:{String(contador % 60).padStart(2, '0')}
                </p>
              </div>
              {respuestaPasajero && (
                <div style={{ background: 'rgba(255,122,47,0.15)', borderRadius: '12px', padding: '12px 16px', marginBottom: '12px', border: '1px solid #FF7A2F' }}>
                  <p style={{ color: '#FF7A2F', fontSize: '13px', fontWeight: 'bold', margin: '0' }}>💬 Pasajero: "{respuestaPasajero}"</p>
                </div>
              )}
              <button onClick={iniciarViaje} style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>🚀 Iniciar viaje</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (fase === 'en_viaje' && viajeActual) {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', position: 'relative' }}>
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

  if (viajeIdEscuchando && !fase) {
    return (
      <div style={{ backgroundColor: '#141416', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '60px', marginBottom: '24px' }}>⏳</div>
        <h2 style={{ color: '#FFFFFF', fontSize: '20px', margin: '0 0 8px', textAlign: 'center' }}>Contraoferta enviada</h2>
        <p style={{ color: '#555', fontSize: '14px', margin: '0', textAlign: 'center' }}>Esperando respuesta del pasajero...</p>
      </div>
    );
  }

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
        {ubicacion && <div style={{ background: '#0A1F0A', borderRadius: '16px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #1A3A1A' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ECC71' }}/><span style={{ color: '#2ECC71', fontSize: '13px', fontWeight: 'bold' }}>GPS activo — ubicación en tiempo real</span></div>}
        <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div><p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0' }}>{activo ? 'Estoy disponible' : 'No disponible'}</p><p style={{ color: '#555', fontSize: '12px', margin: '4px 0 0' }}>{activo ? 'Puedes recibir solicitudes' : 'Actívate para recibir viajes'}</p></div>
          <div onClick={() => setActivo(!activo)} style={{ width: '56px', height: '32px', borderRadius: '16px', background: activo ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#2A2A2E', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 4px', justifyContent: activo ? 'flex-end' : 'flex-start' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#FFFFFF' }}/>
          </div>
        </div>
        {activo && !solicitud && <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '32px 20px', textAlign: 'center', border: '1px dashed #2A2A2E' }}><p style={{ fontSize: '40px', margin: '0 0 12px' }}>⏳</p><p style={{ color: '#555', fontSize: '14px', margin: '0' }}>Esperando solicitudes de viaje...</p></div>}
        {solicitud && (
          <div style={{ background: '#1A1A1E', borderRadius: '20px', padding: '20px', border: '1px solid #FF7A2F' }}>
            <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px', fontWeight: 'bold' }}>🔔 NUEVA SOLICITUD</p>
            <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '16px', margin: '0 0 4px' }}>{solicitud.tipo}</p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 4px' }}>📍 Desde: {solicitud.origen}</p>
            <p style={{ color: '#555', fontSize: '13px', margin: '0 0 20px' }}>🏁 Hasta: {solicitud.destino}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', background: '#141416', borderRadius: '16px', padding: '16px' }}>
              <div>
                <p style={{ color: '#555', fontSize: '10px', margin: '0' }}>{tarifaCambiada ? 'TU CONTRAOFERTA' : 'OFERTA DEL PASAJERO'}</p>
                <p style={{ color: tarifaCambiada ? '#FF7A2F' : '#2ECC71', fontWeight: '900', fontSize: '28px', margin: '4px 0 0' }}>${tarifaModificada.toLocaleString()}</p>
                {tarifaCambiada && <p style={{ color: '#555', fontSize: '11px', margin: '4px 0 0' }}>Oferta original: {solicitud.tarifa}</p>}
              </div>
              <button onClick={subirTarifa} style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '16px', color: '#141416', fontSize: '28px', fontWeight: '900', cursor: 'pointer' }}>+</button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setSolicitud(null)} style={{ flex: 1, padding: '14px', background: '#141416', border: 'none', borderRadius: '14px', color: '#555', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>✗ Rechazar</button>
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