import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, auth } from './firebase';
import Logo from './Logo';
// setDoc salió con la extracción del código de seguridad: el único que escribía
// con él era el cajón privado, y eso ahora lo hace codigoSeguridad.js.
import { collection, addDoc, doc, onSnapshot, updateDoc, getDoc, query, orderBy } from 'firebase/firestore';
import Calificacion from './Calificacion';
import Llamada from './Llamada';
import TratoHecho from './TratoHecho'; // G74: la ventanita «¡Trato hecho!», la misma para pasajero y conductor
import { useLlamadaEntrante } from './llamadaEntrante';
import { prepararTokenDeAvisos } from './Notificaciones';
import { sonarAlerta, desbloquearAudio } from './alerta';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { calcularTarifaMinima } from './tarifas';
import { RESPALDO_CONFIG, leerConfig, segundosDeEspera, BUSQUEDA, marcaDelVencido, maximoDeFavoritos, lugaresFavoritos } from './configApp';
import { cop } from './moneda';
import { valorDelBeneficio } from './reglaPromocion';
import { aplicarDescuento, armarDescuentoInfo, tarifaParaPasajero } from './descuentos';
import { generarCodigoSeguridad, guardarCodigoDeViaje, cargarCodigoDeViaje } from './codigoSeguridad';
import { armarViajeNuevo } from './viajeNuevo';
import { ESTADOS_QUE_CIERRA_EL_SERVIDOR, avisoDelCierre, huellaDelViaje } from './estadosViaje';
// Los datos que comparten las pantallas salen de archivos únicos (SEGUNDA LEY).
import { centroRiohacha } from './riohacha';
// G61: el cuadro de sugerencias de direcciones sale de UNA pieza (con su marco de Riohacha).
import { ponerSugerencias } from './sugerenciasDeDirecciones';
import { RESPUESTAS_RAPIDAS, RAZONES_CANCELACION_PASAJERO } from './textosViaje';
import ModalCancelacion from './ModalCancelacion';
// REGLA 9 · qué se le dice al pasajero cuando el servidor dice que no. Mismo
// archivo y misma ventanita que usan el conductor, el panel y aliados.
import { motivoDeRechazo, apuntarRechazo } from './avisoRechazo';
import AvisoModal from './AvisoModal';
// LA LEY DEL BOTÓN (26-sep-2026): todo lo que guarda en esta pantalla pasa por el candado.
import { useAccion } from './useAccion';
// El texto del mensaje de emergencia. MISMO archivo que el botón de Ajustes:
// un proceso, un sitio (SEGUNDA LEY). Vive aparte para poder PROBARLO.
import { armarMensajeDeEmergencia } from './mensajeEmergencia';
// La ubicación del mensaje de emergencia, pedida EN EL MOMENTO DEL TOQUE. MISMA
// función que el botón de Ajustes (G05, 27-sep-2026).
import { ubicacionDeAhora } from './ubicacionDeAhora';
// Pedirle el GPS al teléfono, con sus tiempos en un solo sitio (G28).
import { pedirGps } from './pedirGps';
import { direccionDePunto, puntoDeDireccion, geocodificadorDe } from './direccionDePunto';
// El mapa con ruta es UNO para el conductor y el pasajero (G29).
import MapaConRuta from './MapaConRuta';
// El número del contacto de emergencia: la MISMA regla que el registro y Seguridad (G10).
import { numeroWhatsApp, telefonoSirve, celularDiezCifras, cifrasMientrasEscribe } from './telefonoValido';
// La tarjeta roja «Llamar al 123» y el número salen de UNA pieza, la misma de Ajustes › Seguridad (G70).
import { TarjetaLlamar123 } from './LlamarAl123';
import BotonVolver from './BotonVolver';

/**
 * EL AVISO DE «NO SÉ DÓNDE RECOGERTE» — ESCRITO UNA SOLA VEZ.
 *
 * Sale en los dos sitios donde la pantalla se queda sin saber dónde está el
 * pasajero: cuando no ha dicho nada, y cuando escribió una dirección que no se
 * pudo encontrar. Es el MISMO aviso, así que vive en un solo sitio (SEGUNDA
 * LEY); escribirlo dos veces es cómo empiezan a decir cosas distintas.
 *
 * Nombra LAS DOS SALIDAS —el marcador y escribir la dirección— porque ésas son
 * las que decidió el dueño el 15-sep-2026, y un aviso que no dice cómo salir
 * deja igual de atascado que el silencio.
 */
const NO_SE_DONDE_ESTAS = (esMensajeria, porque) => ({
  titulo: esMensajeria ? 'No sé dónde recoger' : 'No sé dónde recogerte',
  texto: (porque ? porque + ' ' : '')
    + 'Mueve el marcador 📍 del mapa hasta el sitio exacto, o escribe la dirección y '
    + 'escógela de la lista.',
});

// Valores por defecto (respaldo). Se reemplazan por los de config/global cuando cargan.
// G36/G66: el respaldo ENTERO sale de configApp.js (tarifas, comisiones, números y módulos), el mismo de toda la app,
// amarrado por prueba a la copia del panel. Las claves que esta pantalla no usa son inertes.
const CONFIG_APP_DEFECTO = RESPALDO_CONFIG;

// La tarifa mínima ya NO se calcula aquí: vive en tarifas.js, que es el único sitio
// donde se calcula para toda la app (SEGUNDA LEY). Se importa arriba.
// El centro y el marco de Riohacha, las respuestas rápidas y las razones de
// cancelación tampoco: viven en riohacha.js y textosViaje.js. Se importan arriba.

function ConductorLlego({ nombre, placa, onCerrar }) {
  const handleCerrar = (e) => { e.preventDefault(); e.stopPropagation(); onCerrar(); };
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ fontSize: '90px', marginBottom: '16px', animation: 'pulso 1s infinite alternate' }}>🚗</div>
      <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '28px', padding: '36px 24px', width: '100%', maxWidth: '440px', border: '3px solid #2ECC71', textAlign: 'center' }}>
        <p style={{ color: '#2ECC71', fontSize: '14px', margin: '0 0 12px', letterSpacing: '3px', fontWeight: 'bold' }}>¡ATENCIÓN!</p>
        <h1 style={{ color: '#FFFFFF', fontSize: '40px', fontWeight: '900', margin: '0 0 16px', lineHeight: '1.15' }}>TU CONDUCTOR<br/>YA LLEGÓ</h1>
        {nombre && <p style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 'bold', margin: '0' }}>{nombre}</p>}
        {placa && <p style={{ color: '#FF7A2F', fontSize: '20px', fontWeight: '900', margin: '8px 0 0' }}>🚘 {placa}</p>}
      </div>
      <button onClick={handleCerrar} onTouchEnd={handleCerrar} style={{ marginTop: '28px', width: '100%', maxWidth: '440px', padding: '18px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '16px', color: '#FFFFFF', fontSize: '22px', fontWeight: '900', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>OK</button>
      <style>{`@keyframes pulso { from { transform: scale(1); } to { transform: scale(1.12); } }`}</style>
    </div>
  );
}

// Tarjeta de contraoferta de un conductor
function TarjetaContraoferta({ oferta, onAceptar, onRechazar, ocupado }) {
  const progreso = 100;
  const [fotoConductor, setFotoConductor] = useState(null);

  useEffect(() => {
    setFotoConductor(oferta.conductorFoto || null);
  }, [oferta.conductorFoto]);

  // AQUÍ SE VEÍA LA SEPARACIÓN que causó tener dos archivos: mensajería escribía
  // `progreso > 50 ? verde : progreso > 25 ? amarillo : rojo` y taxi solo verde.
  //
  // PERO NO SE VEÍA NADA: `progreso` está fijo en 100 ahí arriba, así que la
  // condición siempre da verde. Las dos pantallas pintaban EXACTAMENTE el mismo
  // color. Era una mejora a medias —el degradado sin el contador que lo mueva—,
  // no una diferencia que el cliente notara.
  //
  // Se deja el gradiente porque describe lo que se quiso hacer, y queda ANOTADO:
  // si algún día el contador mueve `progreso`, esto empieza a cambiar de color
  // solo. Eso es una decisión del dueño, no algo que se cuele en una unión.
  const colorBarra = progreso > 50 ? '#2ECC71' : progreso > 25 ? '#FFCF4D' : '#FF4444';

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '20px', padding: '16px', marginBottom: '10px', border: '1px solid #FF7A2F' }}>
      {/* Barra de tiempo */}
      <div style={{ height: '4px', background: '#ECECEF', borderRadius: '2px', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progreso}%`, background: colorBarra, borderRadius: '2px', transition: 'width 0.05s linear, background 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', overflow: 'hidden', border: '2px solid #FF7A2F', flexShrink: 0 }}>
            {fotoConductor ? <img src={fotoConductor} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
          </div>
          <div>
            <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0' }}>{oferta.conductorNombre}</p>
            {oferta.conductorPlaca && <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '3px 0 0' }}>🚘 {oferta.conductorPlaca} · {oferta.conductorVehiculo}</p>}
          </div>
        </div>
        <p style={{ color: '#FF7A2F', fontSize: '28px', fontWeight: '900', margin: '0' }}>{oferta.contraoferta}</p>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onRechazar} disabled={!!ocupado} style={{ flex: 1, padding: '12px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', color: '#FF4444', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>❌ No</button>
        <button onClick={onAceptar} disabled={!!ocupado} style={{ flex: 2, padding: '12px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', border: 'none', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', fontWeight: '900', cursor: 'pointer' }}>{ocupado === 'aceptar' ? 'Aceptando…' : '✅ Aceptar'}</button>
      </div>
    </div>
  );
}

function AutocompleteInput({ value, onChange, placeholder, icon, onPlaceCoords }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const onPlaceCoordsRef = useRef(onPlaceCoords);
  useEffect(() => { onPlaceCoordsRef.current = onPlaceCoords; }, [onPlaceCoords]);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!inputRef.current || !window.google) return;
    autocompleteRef.current = ponerSugerencias(window.google, inputRef.current, 'viaje');
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      if (place && place.name) onChangeRef.current(place.name);
      // Si Google ya trae las coordenadas de la sugerencia, las usamos directo (mueve el pin al instante)
      if (onPlaceCoordsRef.current && place && place.geometry && place.geometry.location) {
        onPlaceCoordsRef.current({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
      } else if (onPlaceCoordsRef.current && place && place.name && window.google) {
        // Respaldo: si Google no trajo las coordenadas, las buscamos para que el pin salte a la primera.
        // G60: la búsqueda sale de la pieza común (direccionDePunto.js); si falla, el pin no salta, como antes.
        puntoDeDireccion(geocodificadorDe(window.google), place.name, (r) => {
          if (r.ok && onPlaceCoordsRef.current) onPlaceCoordsRef.current({ lat: r.lat, lng: r.lng });
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '10px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: icon === 'origen' ? '50%' : '2px', background: icon === 'origen' ? '#2ECC71' : '#FF7A2F', flexShrink: 0 }}/>
      <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' }}/>
    </div>
  );
}

// NUEVO: mapa de recogida con pin fijo en el centro y dirección automática (geocodificación inversa, estilo InDriver).
// Se agranda a pantalla completa mientras se mantiene presionado. Solo se cierra cuando se levantan TODOS los dedos
// (si sueltas uno y sigues con otro, NO se cierra). Botón verde "usar mi ubicación" abajo a la derecha cuando está cerrado.
function MapaRecogida({ ubicacionInicial, onCambioPunto, onNoSePudo }) {
  const mapRef = useRef(null);
  const mapaRef = useRef(null);
  const geocoderRef = useRef(null);
  const listenerRef = useRef(null);
  const ultimoPuntoRef = useRef(null);
  const [expandido, setExpandido] = useState(false);
  const [ubicUsada, setUbicUsada] = useState(false);
  // 🔴 ¿ESTE PUNTO LO ELIGIÓ ALGUIEN, O ES DONDE EL MAPA SE ABRIÓ SOLO?
  //
  // Google lanza `idle` en cuanto el mapa termina de dibujarse, sin que nadie
  // haya tocado nada. Hasta el 15-sep-2026 ese primer `idle` geocodificaba el
  // centro del mapa —que sin GPS es el relleno, la plaza—, la pantalla escribía
  // esa dirección en el campo de origen ella sola y daba el pin por bueno.
  // Medido: 4 de 91 viajes nacieron en la plaza, y a los 4 fue un conductor a
  // buscar a alguien que podía estar en cualquier otro sitio.
  //
  // Esta marca distingue las dos cosas. Se prende cuando el pasajero ARRASTRA
  // el mapa o cuando aprieta «Usar mi ubicación»: las dos formas de elegir un
  // punto desde aquí. NO se prende con un toque, porque tocar no es elegir —
  // el contenedor ya se agranda al tocarlo, y aceptar el relleno por un toque
  // accidental sería el mismo fallo con otro disfraz.
  //
  // El mapa se dibuja exactamente igual que antes: esto no le toca nada.
  const loEligioRef = useRef(false);
  const arrastreRef = useRef(null);

  const resolverDireccion = useCallback((lat, lng) => {
    const clave = lat.toFixed(6) + ',' + lng.toFixed(6);
    ultimoPuntoRef.current = clave;
    // La marca se lee AQUÍ, no cuando llegue la respuesta: pertenece al momento
    // en que este punto se calculó. Si el pasajero arrastra mientras el
    // geocodificador contesta, esa respuesta se descarta igual por la clave.
    const loEligio = loEligioRef.current;
    // G30: la dirección del punto sale de la pieza común (direccionDePunto.js). Sin Google cargado, contesta un fallo.
    direccionDePunto(geocoderRef.current, lat, lng, (r) => {
      if (ultimoPuntoRef.current !== clave) return; // llegó tarde, el usuario ya movió el mapa
      if (r.ok) {
        onCambioPunto({ lat, lng }, r.direccion, loEligio);
      } else {
        // Diagnóstico para F12: si aquí sale REQUEST_DENIED, falta habilitar la Geocoding API en el key de Maps.
        console.log('Geocodificación inversa status:', r.motivo);
        onCambioPunto({ lat, lng }, '', loEligio); // si falla, dejamos el campo de recogida como está (no metemos texto raro)
      }
    });
  }, [onCambioPunto]);

  // 🔴 EL OYENTE DEL MAPA SE REGISTRA UNA SOLA VEZ, ASÍ QUE TIENE QUE LLAMAR A
  // LA VERSIÓN DE AHORA, NO A LA DEL PRIMER DIBUJO.
  //
  // El `useEffect` de abajo va con `[]`: corre al montar y nunca más. Si el
  // `idle` llamara directamente a `resolverDireccion`, se quedaría con la del
  // primer render — y con ella, con la `onCambioPunto` del primer render, que
  // lee un `ubicacionEsDelGps` que en ese momento es SIEMPRE `false` (el GPS
  // puede tardar hasta 28 segundos en contestar: un intento de 8 y, si ese
  // falla, otro de 20). Resultado: al pasajero con GPS bueno
  // dejaba de escribírsele la dirección sola, que es justo lo que esta pantalla
  // ya hacía bien. Lo cazó la segunda opinión.
  //
  // Es el mismo patrón que `AutocompleteInput` ya usa aquí al lado con
  // `onChangeRef` y `onPlaceCoordsRef`, por lo mismo: un solo modo de resolver
  // esto en el archivo (SEGUNDA LEY).
  const resolverRef = useRef(resolverDireccion);
  useEffect(() => { resolverRef.current = resolverDireccion; }, [resolverDireccion]);

  useEffect(() => {
    if (!window.google || !mapRef.current || mapaRef.current) return;
    mapaRef.current = new window.google.maps.Map(mapRef.current, {
      center: ubicacionInicial || centroRiohacha,
      zoom: 16,
      styles: [], // mapa blanco (tema normal de Google, no el oscuro)
      zoomControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy', // se mueve con un solo dedo
      clickableIcons: false,
    });
    geocoderRef.current = new window.google.maps.Geocoder();

    // ARRASTRAR EL MAPA SÍ ES ELEGIR. Google solo lanza `dragstart` cuando el
    // mapa empieza a moverse de verdad, así que esta es la señal limpia: a
    // partir de aquí, el punto del centro lo está poniendo el pasajero.
    arrastreRef.current = mapaRef.current.addListener('dragstart', () => {
      loEligioRef.current = true;
    });

    listenerRef.current = mapaRef.current.addListener('idle', () => {
      const centro = mapaRef.current.getCenter();
      resolverRef.current(centro.lat(), centro.lng());
    });

    return () => {
      if (listenerRef.current) listenerRef.current.remove();
      if (arrastreRef.current) arrastreRef.current.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapaRef.current || !ubicacionInicial) return;
    mapaRef.current.setCenter(ubicacionInicial);
  }, [ubicacionInicial]);

  // Al agrandar/achicar el mapa hay que avisarle a Google para que redibuje bien y mantenga el centro (el pin no se mueve de lugar)
  useEffect(() => {
    if (!mapaRef.current || !window.google) return;
    const centroActual = mapaRef.current.getCenter();
    setTimeout(() => {
      window.google.maps.event.trigger(mapaRef.current, 'resize');
      if (centroActual) mapaRef.current.setCenter(centroActual);
    }, 80);
  }, [expandido]);

  // Cierra SOLO cuando ya no queda ningún dedo tocando la pantalla.
  // El listener se pone directo al tocar (no en un useEffect) para que un toque rápido no lo deje pegado.
  const alSoltar = useCallback((e) => {
    if (e.touches && e.touches.length > 0) return; // todavía hay un dedo → seguir abierto
    setExpandido(false);
    document.removeEventListener('touchend', alSoltar);
  }, []);
  const alSoltarMouse = useCallback(() => {
    setExpandido(false);
    document.removeEventListener('mouseup', alSoltarMouse);
  }, []);

  const abrir = () => {
    setExpandido(true);
    document.addEventListener('touchend', alSoltar); // NO usamos 'touchcancel' para que no se cierre solo al arrastrar
  };
  const abrirMouse = () => {
    setExpandido(true);
    document.addEventListener('mouseup', alSoltarMouse);
  };

  // REGLA 9 · «NADA SE RECHAZA EN SILENCIO» — Y ESTE BOTÓN TENÍA TRES SALIDAS
  // MUDAS, no una.
  //
  // El pasajero apretaba «📍 Usar mi ubicación», no pasaba nada, y nadie le
  // decía por qué. Las tres se iban con un `return` seco o un `() => {}`:
  // el teléfono que no deja dar ubicación, el mapa que todavía no se ha
  // dibujado, y —la que muerde de verdad— el aparato que no contesta.
  //
  // Medido en un teléfono de verdad el 23-sep-2026, en una casa: el GPS
  // automático no llegó, el dueño apretó el botón, y la pantalla se quedó
  // callada. Media hora de adivinar lo que un renglón habría dicho.
  //
  // NO se inventa un texto nuevo: sale de `NO_SE_DONDE_ESTAS`, el mismo que ya
  // usa el pedido, y nombra las dos salidas que decidió el dueño —mover el
  // marcador o escribir la dirección— (SEGUNDA LEY). Este componente no lo
  // conoce: solo dice QUÉ pasó, y quien lo pinta es el que lo llama.
  //
  // `onNoSePudo` NO lleva respaldo a propósito. Un `|| (() => {})` volvería a
  // poner el silencio de antes y nadie se enteraría; que reviente se ve. Que
  // esté puesto lo vigila el amarre, no la suerte.
  const usarMiUbicacion = (e) => {
    if (e) e.stopPropagation();
    if (!navigator.geolocation) {
      onNoSePudo('Este teléfono no deja dar la ubicación.');
      return;
    }
    if (!mapaRef.current) {
      onNoSePudo('El mapa todavía no está listo.');
      return;
    }
    pedirGps(navigator, 'boton',
      (pos) => {
        // Se prende ANTES de mover el mapa: mover dispara el `idle`, y cuando
        // ese `idle` llegue la marca ya tiene que estar puesta. Esto es una
        // ubicación del aparato, o sea de las buenas.
        loEligioRef.current = true;
        mapaRef.current.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        mapaRef.current.setZoom(16);
        setUbicUsada(true);
      },
      () => onNoSePudo('Tu celular no dio la ubicación.'),
    );
  };

  // Pequeño (normal) o a pantalla completa mientras se mantiene presionado
  const estiloContenedor = expandido
    ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', zIndex: 99999, marginBottom: '0', borderRadius: '0', border: 'none' }
    : { position: 'relative', width: '100%', height: '300px', borderRadius: '16px', overflow: 'hidden', marginBottom: '12px', border: '3px solid #1C8EF9' };

  return (
    <div
      style={estiloContenedor}
      onTouchStart={abrir}
      onMouseDown={abrirMouse}
    >
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', pointerEvents: 'none', zIndex: 5, fontSize: '42px', lineHeight: '1', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.5))' }}>📍</div>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(0,0,0,0.45)', pointerEvents: 'none', zIndex: 4 }} />
      {!expandido && (
        <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.9)', color: '#1A1A1E', fontSize: '12px', fontWeight: 'bold', padding: '6px 14px', borderRadius: '20px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 6 }}>👆 Mantén presionado para ajustar</div>
      )}
      {!expandido && !ubicUsada && (
        <button
          onClick={usarMiUbicacion}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 8, background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '14px', padding: '14px 22px', color: '#FFFFFF', fontSize: '15px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
        >📍 Usar mi ubicación</button>
      )}
      {!expandido && ubicUsada && (
        <button
          onClick={usarMiUbicacion}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 7, background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '12px', padding: '10px 14px', color: '#FFFFFF', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: '6px' }}
        >📍 Mi ubicación</button>
      )}
    </div>
  );
}

function Solicitar({ tipo, onVolver, destinoInicial }) {
  // UN SOLO ARCHIVO para las dos pantallas (SEGUNDA LEY). Eran gemelos: 94% de
  // renglones idénticos. Lo que de verdad cambiaba eran rótulos, un color y el
  // bloque de campos del paquete — todo lo demás era la misma pantalla escrita
  // dos veces, y ya se habían separado solos (ver `colorBarra` más abajo).
  const esMensajeria = tipo === 'Mensajería';
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState(destinoInicial || '');
  // NUEVO (mensajería): datos del paquete
  const [queEnvia, setQueEnvia] = useState('');
  const [recibeNombre, setRecibeNombre] = useState('');
  const [recibeTel, setRecibeTel] = useState('');
  const [notaEnvio, setNotaEnvio] = useState('');
  const [favoritos, setFavoritos] = useState([]);
  const [pantalla, setPantalla] = useState('solicitar');
  const [viajeId, setViajeId] = useState(null);
  // REGLAS 5 y 11 — el código ya no viaja dentro del viaje: se lee del cajón
  // privado, que solo puede abrir la pasajera.
  const [codigoSeguridad, setCodigoSeguridad] = useState('');
  const [viaje, setViaje] = useState(null);
  const [error, setError] = useState('');
  const [configApp, setConfigApp] = useState(CONFIG_APP_DEFECTO);
  // G26: el oyente del viaje vive en un efecto que NO se vuelve a armar cuando carga config/global, así que lee la
  // config por aquí; si la leyera directo se quedaría con el respaldo del primer dibujo.
  const configAppRef = useRef(configApp);
  configAppRef.current = configApp;
  const TARIFA_MINIMA = calcularTarifaMinima(tipo, configApp);
  const [tarifa, setTarifa] = useState(calcularTarifaMinima(tipo, CONFIG_APP_DEFECTO));
  const [ubicacionPasajero, setUbicacionPasajero] = useState(centroRiohacha);
  // 🔴 ¿ESA UBICACIÓN ES DEL GPS, O ES EL RELLENO?
  //
  // `ubicacionPasajero` arranca en el centro de Riohacha y vuelve al centro si
  // el GPS falla, porque PARA DIBUJAR EL MAPA eso está bien: mejor el pueblo
  // que una pantalla en blanco. Pero el botón de emergencia necesita saber la
  // diferencia, y antes no podía: mandaba la plaza como «mi ubicación» con la
  // misma seguridad que un GPS de verdad, y la familia iba a la plaza.
  //
  // Esta marca es lo único que lo distingue. Se pone en `true` SOLO cuando
  // llega una posición del aparato. El mapa no la mira — sigue exactamente
  // igual que antes, no se le tocó nada.
  const [ubicacionEsDelGps, setUbicacionEsDelGps] = useState(false);
  // NUEVO: punto exacto del pin de recogida (se usa al crear el viaje)
  const [puntoRecogida, setPuntoRecogida] = useState(null);
  // NUEVO: centro del mapa de recogida. Arranca en el GPS y se mueve cuando el usuario elige una dirección de la lista
  const [centroMapa, setCentroMapa] = useState(centroRiohacha);
  // true = la recogida corresponde al pin (moviste el mapa o elegiste una sugerencia). false = escribiste a mano.
  // 🔴 ARRANCA EN `false`, no en `true`. Arrancaba dado por bueno, así que el
  // pin valía antes de que nadie lo hubiera puesto en ningún sitio: sin GPS,
  // el punto que valía era el relleno. Se prende de CUATRO maneras, y la cuarta
  // es la del 95% de la gente: el pasajero mueve el mapa, aprieta «Usar mi
  // ubicación», escoge una sugerencia de la lista... o el mapa está donde dice
  // el GPS del aparato, y entonces no hizo falta que tocara nada. Esa cuarta es
  // la que mantiene vivo el caso bueno, y una versión de esta nota se la dejaba
  // fuera: hacía creer que el pin solo se enciende por decisión del pasajero.
  const pinActivoRef = useRef(false);
  // La tarjeta de abajo mientras hay conductor: el mapa con ruta deja su alto libre al encuadrar (G29).
  const tarjetaRef = useRef(null);
  const [ubicacionConductor, setUbicacionConductor] = useState(null);
  // NUEVO: punto real de recogida del viaje, para que el mapa del pasajero muestre lo mismo que ve el conductor (no el GPS)
  const [ubicacionRecogida, setUbicacionRecogida] = useState(null);
  const [tiempoLlegada, setTiempoLlegada] = useState(null);
  const [distancia, setDistancia] = useState(null);
  const [celebrando, setCelebrando] = useState(false);
  const [conductorEnPunto, setConductorEnPunto] = useState(false);
  const [mostrarLlego, setMostrarLlego] = useState(false);
  const [mostrarCancelacion, setMostrarCancelacion] = useState(false);
  const [mostrarEmergencia, setMostrarEmergencia] = useState(false);
  const [contador, setContador] = useState(segundosDeEspera(CONFIG_APP_DEFECTO));
  const [buscandoAgotado, setBuscandoAgotado] = useState(false);
  const [contactoEmergencia, setContactoEmergencia] = useState('');
  const [datosConductor, setDatosConductor] = useState(null);
  const [conductorYaTomado, setConductorYaTomado] = useState(false);
  // REGLA 9 · «Nada se rechaza en silencio». Hasta el 6-sep-2026 los botones que
  // deciden el viaje —cancelar, aceptar, rechazar— y el que quema el descuento no
  // decían NADA si el servidor los rechazaba.
  const [aviso, setAviso] = useState(null);
  // El candado de LA LEY DEL BOTÓN. Su aviso entra por la MISMA ventanita que ya pintan las siete pantallas de aquí
  // (`aviso`), no por una segunda. Y solo cuando algo FALLA: en esta pantalla lo que sale bien se ve solo —el viaje
  // arranca a buscar, el mensaje sale en el chat, el favorito en la lista—, y una ventanita de «¡Listo!» encima de
  // cada cosa solo estorbaría.
  const { ocupado, correr, texto, aviso: avisoAccion } = useAccion();
  useEffect(() => {
    if (avisoAccion && !avisoAccion.ok) setAviso(avisoAccion);
  }, [avisoAccion]);
  const [llamandoConductor, setLlamandoConductor] = useState(false);
  const [llamadaEntrante, setLlamadaEntrante] = useLlamadaEntrante(viajeId, setAviso);
  const [tiempoBusqueda, setTiempoBusqueda] = useState(BUSQUEDA.segundos);
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
  const ultimaHuellaRef = useRef(null); // G22: el último viaje que vio la pantalla (lo usa el respaldo de 5 s)
  const [mensajesChat, setMensajesChat] = useState([]);
  const [textoChat, setTextoChat] = useState('');
  const [mostrarChat, setMostrarChat] = useState(false);
  const chatFinRef = useRef(null);

  useEffect(() => { pantallaRef.current = pantalla; }, [pantalla]);

  // Cargar la configuración global (tarifas, radios, etc.) una sola vez al abrir
  useEffect(() => {
    const cargarConfigApp = async () => {
      // G66: la lectura sale de configApp.js (lo del servidor encima del respaldo; si falla, se queda el respaldo).
      const { config: nueva, existe } = await leerConfig({ getDoc, doc, db });
      if (existe) {
        setConfigApp(nueva);
        // Si el pasajero aún no ha tocado la tarifa, ajustarla a la mínima según la config real
        setTarifa(prev => {
          const minimaVieja = calcularTarifaMinima(tipo, CONFIG_APP_DEFECTO);
          // Solo la reajustamos si sigue en la mínima por defecto (no la ha modificado el usuario)
          return prev === minimaVieja ? calcularTarifaMinima(tipo, nueva) : prev;
        });
      }
    };
    cargarConfigApp();
  }, [tipo]);

  const [descuentoPendiente, setDescuentoPendiente] = useState(null);

  useEffect(() => {
    const cargarFavoritos = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'usuarios', user.uid));
        if (snap.exists()) {
          if (Array.isArray(snap.data().favoritos)) setFavoritos(snap.data().favoritos);
          setContactoEmergencia(snap.data().contactoConfianzaNumero || '');
          if (snap.data().descuentoPendiente) setDescuentoPendiente(snap.data().descuentoPendiente);
        }
      } catch (e) {
        // 🔴 ESTE `catch` ESTABA VACÍO, y aquí dentro viene el CONTACTO DE
        // CONFIANZA. Si falla, `contactoEmergencia` se queda en nada y el botón
        // de emergencia abre WhatsApp SIN DESTINATARIO — en una emergencia, el
        // pasajero se encuentra eligiendo un contacto a mano sin saber por qué.
        // También se quedan sin cargar los lugares guardados y el descuento.
        // REGLA 9 del dueño: nada se rechaza en silencio. Y la ventanita sale
        // de `avisoRechazo.js`, que es el único sitio donde se escribe qué
        // decirle a la gente cuando algo del servidor no se pudo.
        setAviso(motivoDeRechazo(e, 'cargar tus lugares guardados y tu contacto de confianza'));
      }
    };
    cargarFavoritos();
  }, []);

  // La cuenta del descuento ya NO vive aquí: está en descuentos.js, el único
  // sitio donde se calcula (SEGUNDA LEY). Esto solo le pasa el descuento cargado.
  const calcularTarifaConDescuento = (tarifaBase) => aplicarDescuento(tarifaBase, descuentoPendiente);

  useEffect(() => {
    if (!navigator.geolocation) return;
    // LA MARCA SE PONE EN LOS DOS CAMINOS BUENOS y se deja en false en el
    // relleno. El `setUbicacionPasajero(centroRiohacha)` de abajo NO se toca:
    // es lo que mantiene el mapa dibujado, y funciona.
    const delAparato = (pos) => {
      setUbicacionPasajero({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setUbicacionEsDelGps(true);
    };
    // 🔴 EL RESPALDO PEDÍA ALGO MÁS DIFÍCIL QUE EL PRIMER INTENTO (23-sep-2026).
    //
    // Estaba al revés: el intento 1 pedía precisión BAJA —wifi y antenas, el
    // camino fácil— y, cuando ése fallaba, el respaldo pedía precisión ALTA,
    // o sea SATÉLITES, que es lo más difícil que hay. Dentro de una casa los
    // satélites son justo lo que no se ve, así que cuando el camino fácil no
    // servía la app se iba por el imposible y se rendía a los 28 segundos.
    //
    // MEDIDO EN UN TELÉFONO DE VERDAD, no razonado: el 23-sep-2026 el dueño
    // abrió la pantalla dentro de su casa, esperó 30 segundos y no llegó
    // ninguno de los dos. El botón verde sí le funcionó — pero no por ser
    // mejor: para entonces estos dos intentos ya llevaban 28 segundos
    // despertando el GPS del aparato, y el botón se encontró el trabajo hecho.
    //
    // Ahora el orden es el que tiene sentido: primero el BUENO, y si no
    // aparece, el que SIEMPRE contesta. Y de paso el que está al aire libre
    // gana también, porque hasta hoy recibía el punto malo primero.
    //
    // `maximumAge` deja valer una posición que el aparato ya tiene. Antes los
    // dos decían 0 —«no me sirve nada guardado»—, así que un teléfono que sacó
    // su ubicación hace medio minuto la tiraba y la pedía otra vez desde cero.
    // Un minuto para la buena, cinco para el respaldo: nadie se muda de barrio
    // en ese rato, y quien lo haga tiene el marcador y la dirección a mano.
    //
    // 🔴 LO QUE ESTO CUESTA, y lo decidió el dueño sabiéndolo: una posición de
    // wifi puede estar desviada 100 o 300 metros, y el conductor iría a esa
    // zona. Se acepta porque lo que había antes cuando fallaban los dos era la
    // PLAZA o nada, y 300 metros es mucho mejor que eso.
    //
    // Los intentos y sus tiempos viven en `pedirGps.js` (juego `pantalla`), no
    // aquí: estaban escritos a mano en seis sitios (G28, 28-sep-2026).
    pedirGps(navigator, 'pantalla',
      delAparato,
      () => setUbicacionPasajero(centroRiohacha),
    );
  }, []);

  // El mapa de recogida arranca centrado en el GPS del pasajero cuando este se obtiene
  //
  // 🔴 PERO NO LE PISA EL PUNTO AL QUE YA DIJO DÓNDE ESTÁ.
  //
  // El GPS puede tardar hasta 28 segundos en contestar (un intento de 8 y, si
  // falla, otro de 20). En ese rato al pasajero le da tiempo de sobra a decir
  // dónde está: arrastrando el pin, o escogiendo su dirección de la lista.
  // Cuando el GPS llegaba, este efecto recentraba el mapa IGUAL, sin preguntar
  // si ya había un punto puesto. Recentrar lanza otro `idle`, y ese `idle`
  // pasaba la guardia de `onCambioPunto` por las DOS puertas —por el arrastre
  // porque `loEligio` sigue encendido, y por la dirección escrita porque para
  // entonces `ubicacionEsDelGps` ya es `true`—, así que le PISABA el punto y
  // el texto, sin avisar. Medido corriendo el camino entero: 2 de 2.
  //
  // Es el mismo daño que el del viaje que nacía en la plaza, entrando por otra
  // puerta: el conductor va a un sitio que el pasajero no pidió, y el servidor
  // avisa a los conductores de ALREDEDOR DE ESE PUNTO (`tokensConductoresCerca`
  // en `functions/index.js`), no de donde está la persona.
  //
  // La marca que lo distingue ya existe y es `pinActivoRef`: encendida
  // significa que hay una recogida puesta —la puso el pasajero, o la puso el
  // propio GPS cuando llegó a tiempo—. No se inventa una segunda marca para lo
  // mismo (SEGUNDA LEY).
  //
  // Y el caso del 95% NO cambia: quien abre la pantalla y no toca nada llega
  // aquí con la marca APAGADA, así que el mapa se recentra en su GPS y la
  // dirección se le sigue escribiendo sola.
  useEffect(() => {
    if (pinActivoRef.current) return;
    setCentroMapa(ubicacionPasajero);
  }, [ubicacionPasajero]);

  // Cuando el viaje ya tiene guardado el punto de recogida, el mapa del pasajero usa ESE punto (el mismo del conductor), no el GPS
  useEffect(() => {
    const lat = viaje?.pasajeroLat;
    const lng = viaje?.pasajeroLng;
    if (lat != null && lng != null) setUbicacionRecogida({ lat, lng });
  }, [viaje?.pasajeroLat, viaje?.pasajeroLng]);

  // G20: si el SERVIDOR cerró el viaje (vencido o expirado) mientras el pasajero lo tenía en curso, sale del viaje y
  // le queda la ventanita que dice por qué (con «Volver al inicio» debajo). Antes seguía viendo a su conductor en camino
  // de un viaje que ya no existía. Lo usan LOS DOS vigilantes de abajo (el vivo y el respaldo de cada 5 s): una sola
  // vez escrito. Solo en fase1/fase2: mientras busca, el `vencido` lo escribe su propio teléfono y tiene su pantalla.
  const [viajeCerrado, setViajeCerrado] = useState(null);
  const elServidorCerroElViaje = (data) => {
    if (!ESTADOS_QUE_CIERRA_EL_SERVIDOR.includes(data.estado)) return false;
    if (pantallaRef.current !== 'fase1' && pantallaRef.current !== 'fase2') return false;
    clearInterval(contadorRef.current);
    // Y se apaga el respaldo de cada 5 s: el viaje ya acabó, y si siguiera leyéndolo volvería a abrir la ventanita
    // cada 5 s aunque el pasajero la cierre (lo cazó el robot `viaje-cerrado`).
    clearInterval(intervaloRespaldoRef.current);
    const cierre = avisoDelCierre(data, 'pasajero');
    setViajeCerrado(cierre);
    setAviso(cierre);
    return true;
  };

  useEffect(() => {
    if (!viajeId) return;

    // G22 (28-sep-2026): el RESPALDO de cada 5 s, para los teléfonos (Safari) en que el vigilante en vivo tarda. Ya
    // no lleva su propia copia de las reacciones —se había separado: no conocía `aceptado` y respaldaba `confirmando`,
    // un estado retirado—: reacciona con la MISMA función que el vivo, `reaccionarAlViaje` (abajo). Y solo si trae un
    // viaje distinto del último que se vio, o sea si el vivo se calló; si no, repetía cada 5 s lo que el vivo ya hizo.
    intervaloRespaldoRef.current = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, 'viajes', viajeId));
        if (!snap.exists()) return;
        const data = snap.data();
        if (huellaDelViaje(data) === ultimaHuellaRef.current) return;
        reaccionarAlViaje(data);
      } catch (e) {}
    }, 5000);

    // REGLAS 5 y 11 — si la app se cerró y se volvió a abrir con un viaje en curso,
    // el código no está en memoria: se trae del cajón privado del viaje.
    cargarCodigoDeViaje(viajeId).then((c) => { if (c) setCodigoSeguridad(c); });

    // LA ÚNICA manera de reaccionar a cada paso del viaje (G22): la usan el vigilante en vivo y el respaldo de arriba.
    // No reacciona a ningún estado RETIRADO (`ESTADOS_RETIRADOS` en estadosViaje.js): no los escribe nadie.
    const reaccionarAlViaje = (data) => {
      ultimaHuellaRef.current = huellaDelViaje(data);
      setViaje(data);

      // El conductor marcó el descuento como consumido: el pasajero borra su propio código de bienvenida/promo
      // para que no se pueda volver a usar en otro viaje.
      if (data.descuentoInfo?.consumido === true && descuentoPendiente) {
        const user = auth.currentUser;
        if (user) {
          // Esto QUEMA el descuento que el conductor acaba de marcar como usado.
          // Si falla callado, el descuento NO se quema y se puede volver a gastar
          // en otro viaje: es plata que se va sin que nadie se entere.
          updateDoc(doc(db, 'usuarios', user.uid), { descuentoPendiente: null })
            .catch((e) => {
              apuntarRechazo('Solicitar.js (quemar el descuento)', e);
              setAviso(motivoDeRechazo(e, 'registrar que usaste tu descuento'));
            });
        }
        setDescuentoPendiente(null);
      }

      if (data.estado === 'cancelado_conductor') {
        clearInterval(contadorRef.current);
        setPantalla('cancelado_conductor');
        return;
      }

      if (elServidorCerroElViaje(data)) return;

      // (Aquí había dos reacciones a estados RETIRADOS —`contraoferta` y `confirmando`—, del flujo de antes de
      // `confirmarConductor`. Las ofertas llegan por la subcolección `contraofertas`, en el vigilante de más abajo.)

      if (data.estado === 'aceptado' && pantallaRef.current !== 'fase1' && pantallaRef.current !== 'fase2' && !celebrando) {
        if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
        clearInterval(contadorBusquedaRef.current);
        sonarAlerta();
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
        setContador(segundosDeEspera(configAppRef.current)); // G26: la misma cuenta que el reloj del conductor
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
    };

    const unsub = onSnapshot(doc(db, 'viajes', viajeId), (snap) => {
      if (!snap.exists()) return;
      reaccionarAlViaje(snap.data());
    });

    return () => { unsub(); clearInterval(intervaloRespaldoRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajeId, celebrando, conductorEnPunto]);

  // Ofertas de conductores EN TIEMPO REAL (subcolección) — fuente de verdad, hasta 5, mejor precio primero.
  useEffect(() => {
    if (!viajeId) return;
    const unsub = onSnapshot(collection(db, 'viajes', viajeId, 'contraofertas'), (snap) => {
      if (pantallaRef.current !== 'esperando') return;
      const lista = snap.docs.map(d => d.data())
        .filter(o => o && o.conductorId && o.vigente !== false)
        .map(o => ({
          conductorId: o.conductorId,
          conductorNombre: o.conductorNombre,
          conductorPlaca: o.conductorPlaca,
          conductorVehiculo: o.conductorVehiculo,
          conductorTelefono: o.conductorTelefono,
          conductorFoto: o.conductorFoto || null,
          contraoferta: o.monto,
          contraofertaValor: o.montoValor,
          tipoOferta: o.tipoOferta,
          creado: o.creado,
        }))
        .sort((a, b) => (a.contraofertaValor || 0) - (b.contraofertaValor || 0) || String(a.creado || '').localeCompare(String(b.creado || '')))
        .slice(0, 5);
      lista.forEach(o => {
        const key = o.conductorId + '_' + (o.contraofertaValor || '');
        if (!contaofertasIdsRef.current.has(key)) { contaofertasIdsRef.current.add(key); sonarAlerta(); }
      });
      setContraofertas(lista);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viajeId]);

  const escucharConductor = useCallback((conductorId) => {
    if (!conductorId) return;
    onSnapshot(doc(db, 'conductores', conductorId), (snap) => {
      if (snap.exists() && snap.data().ubicacion) setUbicacionConductor({ lat: snap.data().ubicacion.lat, lng: snap.data().ubicacion.lng });
    });
  }, []);

  useEffect(() => {
    if (viaje?.conductorFoto || viaje?.conductorColor) {
      setDatosConductor({ foto: viaje.conductorFoto || null, color: viaje.conductorColor || '' });
    }
  }, [viaje?.conductorFoto, viaje?.conductorColor]);

  // G60: el destino escrito se convierte en punto con la pieza común (direccionDePunto.js); si falla, no se pinta, como antes.
  const geocodificarDestino = (destinoTexto) => {
    puntoDeDireccion(geocodificadorDe(window.google), destinoTexto, (r) => {
      if (r.ok) setDestinoCoords({ lat: r.lat, lng: r.lng });
    });
  };

  const enviarRespuesta = async (respuesta) => {
    if (!viajeId) return;
    // Antes, si fallaba, no lo decía nadie: el pasajero creía que el conductor ya sabía que sale en un minuto.
    await correr(() => updateDoc(doc(db, 'viajes', viajeId), { respuestaPasajero: respuesta }),
      'respuesta:' + respuesta, 'Respuesta enviada.', 'enviar tu respuesta');
  };
  useEffect(() => {
    if (!viajeId) return;
    const q = query(collection(db, 'viajes', viajeId, 'mensajes'), orderBy('fecha', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMensajesChat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => { if (chatFinRef.current) chatFinRef.current.scrollIntoView({ behavior: 'smooth' }); }, 100);
    });
    return () => unsub();
  }, [viajeId]);

  const enviarMensajeChat = async () => {
    if (!textoChat.trim() || !viajeId) return;
    const user = auth.currentUser;
    // Antes: `catch (e) {}` — si no salía, nadie lo decía. Y dos Enter seguidos lo mandaban dos veces.
    await correr(async () => {
      await addDoc(collection(db, 'viajes', viajeId, 'mensajes'), {
        texto: textoChat.trim(),
        autor: 'pasajero',
        autorId: user?.uid || '',
        fecha: new Date().toISOString(),
      });
      setTextoChat('');
    }, 'mensaje', 'Mensaje enviado.', 'enviar el mensaje');
  };

  // 🔴 SIN EL CANDADO DE LA LEY DEL BOTÓN, a propósito (G05, 27-sep-2026): el robot midió en el navegador que
  // `candado.js` revienta al primer toque («Illegal invocation») y se queda cerrado; colgado de él, el 🚨 serviría
  // UNA sola vez por viaje. Queda anotado para arreglar el candado aparte.
  const compartirSeguridad = async () => {
    // EL TEXTO SE ARMA EN `mensajeEmergencia.js`, que es el MISMO archivo que
    // usa el botón de Ajustes (SEGUNDA LEY: un proceso, un sitio). Antes estaba
    // escrito a mano aquí, y los dos ya decían cosas distintas: el de Ajustes
    // comprobaba que hubiera conductor y avisaba de lo que no había conseguido,
    // y éste no. Ahora hay un solo texto y se puede PROBAR: dentro de este
    // componente de React no había forma de escribir una prueba que mirara lo
    // que de verdad le llega al familiar.
    //
    // 🔴 LA UBICACIÓN VA SOLO SI ES DEL GPS. Si es el relleno del centro de
    // Riohacha, va `null` y el mensaje dice que no la pudo conseguir. Antes
    // mandaba la plaza como si fuera cierta.
    //
    // Y el viaje sale de `viaje` —el documento que escucha esta pantalla—, no
    // de `datosConductor`, que se llena una vez y NUNCA se vacía: con dos
    // viajes seguidos se mandaba la foto del conductor del anterior.
    // Si `viaje` todavía no ha llegado, se dice: estando en el mapa hay viaje
    // seguro, así que no tenerlo es «no lo pude conseguir», no «no hay».
    //
    // 🔴 LA UBICACIÓN SE PIDE AHORA, AL TOCAR (G05, 27-sep-2026). Antes se
    // mandaba `ubicacionPasajero`, que es la de CUANDO SE ABRIÓ LA PANTALLA —
    // normalmente donde lo recogieron—: apretado a los 20 minutos, el familiar
    // recibía el punto de recogida como «Mi ubicación». Ahora la pide
    // `ubicacionDeAhora.js` (la misma del botón de Ajustes) con un tope de 4 s,
    // y si el GPS no contesta usa, en este orden: dónde va el CARRO —solo en
    // `fase2`, cuando el pasajero va dentro; en `fase1` el carro viene hacia él y
    // NO es su sitio— y la del pasajero de cuando abrió la pantalla. El mensaje
    // dice cuál de las dos es. La del pasajero sigue yendo SOLO si es del GPS:
    // el relleno del centro de Riohacha no es el sitio de nadie.
    const { punto, de } = await ubicacionDeAhora([
      { punto: pantalla === 'fase2' ? ubicacionConductor : null, de: 'carro' },
      { punto: ubicacionEsDelGps ? ubicacionPasajero : null, de: 'ultima' },
    ]);
    const texto = armarMensajeDeEmergencia({
      desde: 'enViaje',
      ubicacion: punto,
      ubicacionDe: de,
      viaje,
      fallo: viaje ? null : 'viaje',
    });

    // 🔴 G10: el número sale de la MISMA regla que valida el registro y Seguridad
    // (telefonoValido.js). Antes se le pegaba un 57 a lo que hubiera: «300 123 45»
    // abría wa.me/5730012345, un número que no existe, y «abc» abría wa.me/57.
    // G41: y el número para WhatsApp («57» + las 10 cifras) también sale de ahí, no se arma a mano.
    const numeroFinal = numeroWhatsApp(contactoEmergencia);
    // SIN NÚMERO, SE DICE. Antes abría WhatsApp sin destinatario y el pasajero
    // se encontraba eligiendo un contacto a mano, en una emergencia, sin saber
    // por qué. El mensaje va igual —se abre el selector— pero avisado.
    if (!numeroFinal) {
      const porQue = String(contactoEmergencia).trim()
        ? 'El número de tu contacto de confianza no está completo (debe tener 10 cifras), así que WhatsApp te va a pedir que '
        : 'No pude leer tu contacto de confianza, así que WhatsApp te va a pedir que ';
      setAviso({
        titulo: 'No tengo a quién mandarlo',
        texto: porQue
          + 'elijas a quién. El mensaje ya va escrito. Guarda un contacto en Seguridad para '
          + 'que la próxima vez salga solo.',
      });
    }
    const url = numeroFinal
      ? `https://wa.me/${numeroFinal}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    // 🔴 `window.open`, NO `window.location.href`. Con `location.href` la página
    // se va de inmediato y la ventanita de arriba NO LLEGA A PINTARSE: el aviso
    // quedaba escrito de adorno, que es peor que no ponerlo. Lo cazó la segunda
    // opinión del 12-sep-2026. Así lo hace el botón de Ajustes desde el
    // principio, y es una diferencia menos entre los dos.
    //
    // Y SI EL NAVEGADOR NO DEJA ABRIRLO, SE DICE (G05). Ahora hay una espera
    // antes de abrir (el GPS, hasta 4 s), y un navegador puede bloquear la
    // ventana si pasa mucho rato desde el toque. Un mensaje de emergencia que
    // no sale no puede quedarse callado: se dice en la ventanita.
    const ventana = window.open(url, '_blank');
    if (!ventana) {
      setAviso({
        titulo: 'No se pudo abrir WhatsApp',
        texto: 'Tu teléfono no dejó abrir WhatsApp. Vuelve a tocar «Compartir»: el mensaje sale de una vez.',
      });
    }
  };

  const cancelarViaje = async (razon) => {
    clearInterval(contadorRef.current);
    if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
    clearInterval(contadorBusquedaRef.current);
    // Si la cancelación no entra, NO se sale de la pantalla: el viaje seguiría
    // vivo en el servidor —un conductor en camino a alguien que ya se fue— y sin
    // el botón delante no habría forma de reintentar.
    if (viajeId) {
      // El candado dice el motivo (con motivoDeRechazo, la pieza única) y deja rastro del rechazo; aquí solo se
      // decide no salir. Y un segundo toque (r === null) tampoco sale: el primero sigue trabajando.
      const r = await correr(() => updateDoc(doc(db, 'viajes', viajeId), { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: razon }),
        'cancelar', 'Viaje cancelado.', 'cancelar el viaje');
      if (!r || !r.ok) return;
    }
    setMostrarCancelacion(false);
    onVolver();
  };

  const guardarFavorito = async () => {
    if (!destino) return;
    const user = auth.currentUser;
    if (!user) return;
    if (favoritos.length >= maximoDeFavoritos(configApp)) { setAviso({ icono: '📍', titulo: 'Llegaste al límite', texto: `Solo puedes guardar ${lugaresFavoritos(configApp)}. Borra uno para poder agregar otro.` }); return; }
    if (favoritos.find(f => f.direccion === destino)) { setError('Ese lugar ya está guardado'); return; }
    const nuevo = { nombre: destino.length > 18 ? destino.slice(0, 18) + '…' : destino, direccion: destino, icono: '⭐' };
    const nuevos = [...favoritos, nuevo];
    await correr(async () => {
      await updateDoc(doc(db, 'usuarios', user.uid), { favoritos: nuevos });
      setFavoritos(nuevos);
    }, 'favorito', 'Lugar guardado.', 'guardar el lugar');
  };

  const borrarFavorito = async (i) => {
    const user = auth.currentUser;
    if (!user) return;
    const nuevos = favoritos.filter((_, idx) => idx !== i);
    // Antes: `catch (e) {}` — si no se borraba, el lugar seguía ahí y nadie decía por qué.
    await correr(async () => {
      await updateDoc(doc(db, 'usuarios', user.uid), { favoritos: nuevos });
      setFavoritos(nuevos);
    }, 'borrarFavorito', 'Lugar borrado.', 'borrar el lugar');
  };

  const subirNuevaTarifa = () => {
    const base = nuevaTarifa !== null ? nuevaTarifa : tarifa;
    setNuevaTarifa(base + configApp.incrementoTarifa);
    setOfertaModificada(true);
  };

  const bajarNuevaTarifa = () => {
    const base = nuevaTarifa !== null ? nuevaTarifa : tarifa;
    if (base <= tarifa) return; // no puede bajar de la oferta original
    setNuevaTarifa(base - configApp.incrementoTarifa);
    setOfertaModificada(true);
  };

  const enviarNuevaOferta = async () => {
    if (!viajeId || !nuevaTarifa || nuevaTarifa <= tarifa) return;
    // Antes: `catch(e) {}` — si la oferta nueva no entraba, el pasajero creía que los conductores veían más plata.
    await correr(async () => {
      await updateDoc(doc(db, 'viajes', viajeId), {
        tarifa: cop(nuevaTarifa), // G13: el formateador único, no el idioma del teléfono
        tarifaValor: nuevaTarifa,
        nuevaOferta: new Date().toISOString(),
        estado: 'esperando',
      });
      setTarifa(nuevaTarifa);
      setNuevaTarifa(null);
      setOfertaModificada(false);
    }, 'oferta', 'Nueva oferta enviada.', 'enviar la nueva oferta');
  };
  const seguirBuscando = async () => {
    if (!viajeId) return;
    // Revivir el viaje: vuelve a 'esperando' con tiempo nuevo para que reaparezca en los conductores.
    // Ahora se ESPERA a que entre: antes se pintaba «buscando» con el reloj corriendo aunque la escritura fallara
    // (`.catch(() => {})`), y el pasajero esperaba a conductores que nunca iban a ver su viaje.
    const r = await correr(() => updateDoc(doc(db, 'viajes', viajeId), { estado: 'esperando', radioBusqueda: configApp.radioBusquedaInicial, nuevaOferta: new Date().toISOString() }),
      'seguir', 'Seguimos buscando.', 'volver a buscar conductor');
    if (!r || !r.ok) return;
    setBuscandoAgotado(false);
    setTiempoBusqueda(BUSQUEDA.segundos);
    if (radioRef.current) { clearTimeout(radioRef.current.ampliar); clearTimeout(radioRef.current.agotar); }
    radioRef.current = {
      ampliar: setTimeout(() => {
        updateDoc(doc(db, 'viajes', viajeId), { radioBusqueda: configApp.radioBusquedaAmpliado }).catch(() => {});
      }, BUSQUEDA.segundosParaAmpliar * 1000),
      agotar: setTimeout(() => {
        setBuscandoAgotado(true);
        // Si se acaba otra vez, volver a marcarlo vencido (G27: con su fecha, quién y por qué)
        updateDoc(doc(db, 'viajes', viajeId), marcaDelVencido(new Date().toISOString())).catch(() => {});
      }, BUSQUEDA.segundos * 1000),
    };
    clearInterval(contadorBusquedaRef.current);
    contadorBusquedaRef.current = setInterval(() => {
      setTiempoBusqueda(prev => { if (prev <= 1) { clearInterval(contadorBusquedaRef.current); return 0; } return prev - 1; });
    }, 1000);
  };
  const subirTarifa = () => setTarifa(t => t + configApp.incrementoTarifa);
  const bajarTarifa = () => setTarifa(t => Math.max(TARIFA_MINIMA, t - configApp.incrementoTarifa));

  const solicitarViaje = async () => {
    // Un mandado pide seis datos; un viaje pide dos. Cada uno como estaba.
    if (esMensajeria) {
      const faltan = [];
      if (!origen) faltan.push('Dónde se recoge');
      if (!destino) faltan.push('Dónde se entrega');
      if (!queEnvia.trim()) faltan.push('Qué vas a enviar');
      if (!recibeNombre.trim()) faltan.push('Nombre de quien recibe');
      if (!telefonoSirve(recibeTel)) faltan.push('Teléfono de quien recibe (10 números)');
      if (!notaEnvio.trim()) faltan.push('Nota para el domiciliario');
      if (faltan.length > 0) { setAviso({ icono: '📋', titulo: 'Te faltan datos', texto: 'Completa esto para enviar tu mandado: ' + faltan.join(', ') + '.' }); return; }
    } else {
      // 🔴 SI LO QUE FALTA ES DÓNDE ESTÁ, SE DICE CÓMO DECIRLO.
      //
      // Desde el 15-sep-2026 el campo de origen ya no se rellena solo con la
      // plaza cuando no hay GPS: se queda vacío, que es la verdad. Pero
      // entonces el pasajero choca aquí, y lo que había era un renglón rojo que
      // solo dice «escribe» — sin nombrar el marcador, que es la otra forma de
      // decir dónde estás, y la que el dueño puso por delante. Un aviso que no
      // nombra la salida deja igual de atascado que el silencio (REGLA 9), y en
      // esta app los avisos son ventanitas. Lo de FALTAR EL DESTINO se queda
      // exactamente como estaba: no es este fallo.
      if (!origen || !destino) {
        // El renglón rojo de un intento anterior se limpia ANTES de abrir la
        // ventanita: si no, se queda debajo diciendo otra cosa. Aquí arriba no
        // se limpiaba nunca, porque el `setError('')` de siempre está más abajo
        // y estos dos `return` se van antes de llegar a él.
        if (!origen) { setError(''); setAviso(NO_SE_DONDE_ESTAS(esMensajeria)); return; }
        setError('Por favor escribe el origen y destino');
        return;
      }
    }
    desbloquearAudio();
    setError('');

    // LA LEY DEL BOTÓN: desde aquí hasta crear el viaje, UNA sola vez aunque se toque dos. El candado cubre también
    // la búsqueda de la dirección: con el «cargando» de antes, un doble toque mientras Google contestaba podía crear
    // DOS viajes. (El audio de iOS se activa arriba, fuera: iOS solo lo deja en el mismo instante del toque.)
    await correr(async () => {
    // Punto de recogida:
    // - Si lo escrito COINCIDE con la dirección del pin (movió el mapa o eligió una sugerencia) → usamos el pin (exacto).
    // - Si el usuario ESCRIBIÓ otra dirección a mano (ej: pide para otra persona) → geocodificamos ese texto, NO el pin.
    // 🔴 Y SI NO HAY PIN, NO SE CAE AL RELLENO.
    //
    // Antes, sin pin, esto arrancaba en `ubicacionPasajero` — que sin GPS es la
    // plaza. Así, una dirección escrita que Google no encontrara terminaba con
    // el texto diciendo una cosa y las coordenadas diciendo la plaza, y el
    // conductor va por las coordenadas. Ahora arranca SIN punto: hay que
    // conseguir uno, y si no se consigue, el viaje no se crea.
    const usarPin = puntoRecogida && pinActivoRef.current;
    let coordsRecogida = usarPin
      ? { lat: puntoRecogida.lat, lng: puntoRecogida.lng }
      : null;
    if (!usarPin) {
      try {
        // G60: la dirección escrita se busca con la pieza común (direccionDePunto.js). Sin Google, o si no la
        // encuentra, contesta un fallo y `coordsRecogida` se queda como estaba: lo que sigue decide, igual que antes.
        const resultado = await new Promise((resolve) => {
          puntoDeDireccion(geocodificadorDe(window.google), origen, (r) => resolve(r.ok ? { lat: r.lat, lng: r.lng } : null));
        });
        if (resultado) coordsRecogida = resultado;
      } catch (e) {}
      // Si el texto no se pudo convertir en un punto, queda la ubicación del
      // aparato — pero SOLO si de verdad viene del aparato. Ese caso ya
      // funcionaba (sin Google cargado pero con GPS bueno, el viaje nacía donde
      // está el pasajero) y no se toca. Lo que se cierra es el otro: sin GPS,
      // `ubicacionPasajero` es el relleno, y el relleno ya no vale.
      if (!coordsRecogida && ubicacionEsDelGps) {
        coordsRecogida = { lat: ubicacionPasajero.lat, lng: ubicacionPasajero.lng };
      }
    }

    // 🔴 NADIE SABE DÓNDE RECOGER: NO SE CREA EL VIAJE, Y SE DICE POR QUÉ.
    //
    // Decisión del dueño, 15-sep-2026: sin saber dónde está el pasajero no se
    // puede pedir, y las dos formas de decirlo son mover el marcador del mapa o
    // escribir la dirección. La ventanita las nombra las dos, porque un botón
    // que no responde y no explica es la REGLA 9 rota.
    if (!coordsRecogida) {
      setAviso(NO_SE_DONDE_ESTAS(esMensajeria,
        'Tu celular no dio la ubicación y no pude encontrar la dirección que escribiste.'));
      // «Ya avisé yo»: esta ventanita nombra las dos salidas; el candado no le pone otra encima.
      return { ok: false, avisado: true };
    }

      const user = auth.currentUser;
      // G34: el cartel de permiso de avisos sale YA, con el toque fresco; el token se pega al viaje cuando exista.
      const pegarToken = prepararTokenDeAvisos('pasajeroFcmToken');
      // Traer el nombre del pasajero guardado en su registro
      let nombrePasajero = '';
      // REGLAS 5 y 11 — el código de seguridad era el DÍA y el MES de nacimiento de
      // la pasajera: el mismo en todos sus viajes, para siempre, y a la vista de
      // cualquiera que mirase el mercado. Ahora son cuatro cifras al azar, distintas
      // en cada viaje, y se guardan en el cajón privado del viaje.
      const codigoSeguridad = generarCodigoSeguridad();
      try {
        const snapU = await getDoc(doc(db, 'usuarios', user.uid));
        if (snapU.exists()) nombrePasajero = snapU.data().nombre || '';
      } catch (e) {}
      // La ficha del descuento la arma descuentos.js: una sola calculadora (SEGUNDA LEY).
      const datosDescuento = armarDescuentoInfo(tarifa, descuentoPendiente);

      // El documento del viaje se arma en viajeNuevo.js: un solo sitio para el
      // contrato de campos que leen el conductor, las reglas y el servidor.
      // Lo ÚNICO propio de esta pantalla es el paquete de mensajería, que entra
      // por `extras`.
      const docRef = await addDoc(collection(db, 'viajes'), armarViajeNuevo({
        user, nombrePasajero,
        coords: coordsRecogida,
        tipo, origen, destino, tarifa,
        datosDescuento,
        radioBusqueda: configApp.radioBusquedaInicial,
        extras: { mensajeria: { queEnvia: queEnvia.trim(), recibeNombre: recibeNombre.trim(), recibeTel: celularDiezCifras(recibeTel), nota: notaEnvio.trim() } },
      }));
      setViajeId(docRef.id);
      // El código, al cajón privado del viaje: ahí solo lo ve ella.
      setCodigoSeguridad(codigoSeguridad);
      guardarCodigoDeViaje(docRef.id, codigoSeguridad);
      // Token del pasajero SIN bloquear la creación del viaje (el permiso de notificación puede tardar).
      pegarToken(docRef);
      setContraofertas([]);
      contaofertasIdsRef.current.clear();
      setBuscandoAgotado(false);
      setTiempoBusqueda(BUSQUEDA.segundos);
      setPantalla('esperando');

      // Temporizadores de radio: al 1 min amplía a 7km, a los 2 min marca agotado (los plazos: BUSQUEDA, G27)
      radioRef.current = {
        ampliar: setTimeout(() => {
          updateDoc(doc(db, 'viajes', docRef.id), { radioBusqueda: configApp.radioBusquedaAmpliado }).catch(() => {});
        }, BUSQUEDA.segundosParaAmpliar * 1000),
        agotar: setTimeout(() => {
          setBuscandoAgotado(true);
          // El tiempo se acabó: marcar el viaje como vencido para que desaparezca de TODOS los conductores.
          // G27: con su fecha, quién y por qué, como lo deja el servidor.
          updateDoc(doc(db, 'viajes', docRef.id), marcaDelVencido(new Date().toISOString())).catch(() => {});
        }, BUSQUEDA.segundos * 1000),
      };
      // Contador visible (cuenta regresiva de 4:00 a 0:00)
      clearInterval(contadorBusquedaRef.current);
      contadorBusquedaRef.current = setInterval(() => {
        setTiempoBusqueda(prev => { if (prev <= 1) { clearInterval(contadorBusquedaRef.current); return 0; } return prev - 1; });
      }, 1000);
    // Si falla, el candado lo dice con su motivo (antes: un renglón rojo «Error al solicitar viaje» sin porqué).
    }, 'pedir', 'Buscando conductor.', 'pedir el viaje');
  };
  // G59 (29-sep-2026): aquí vivían `confirmarViaje` y `rechazarConfirmacion`, los botones de la ventanita
  // «¿Confirmas este viaje?». Nadie la abría desde que se retiró el estado `confirmando` (G22): el único camino para
  // aceptar a un conductor es `aceptarContraoferta` → `confirmarConductor` en el servidor. `confirmarViaje` ponía
  // `aceptado` a mano sin pasar por él (sin cobrar la comisión ni marcar al conductor ocupado, G24).
  const aceptarContraoferta = async (oferta) => {
    if (!viajeId || celebrando) return;
    // El candado: una sola aceptación aunque se toque dos (el «celebrando» de antes hacía de bloqueo a mano). La
    // respuesta del servidor se envuelve: que el conductor ya esté ocupado NO es un fallo de la conexión, y ése lo
    // dice esta pantalla con su propio aviso, como antes.
    const res = await correr(async () => {
      const fn = httpsCallable(getFunctions(), 'confirmarConductor');
      const resp = await fn({ viajeId, conductorId: oferta.conductorId });
      return { respuesta: (resp && resp.data) || {} };
    }, 'aceptar', 'Oferta aceptada.', 'aceptar la oferta');
    if (!res || !res.ok) return; // el candado ya dijo el motivo
    const r = res.valor.respuesta;
    if (r.ok) {
      setCelebrando(true);
      setContraofertas([]);
      contaofertasIdsRef.current.clear();
      setTimeout(() => {
        setCelebrando(false);
        setPantalla('fase1');
        escucharConductor(oferta.conductorId);
      }, 3000);
      return;
    }
    if (r.motivo === 'ocupado') {
      setAviso({ icono: esMensajeria ? '🏍️' : '🚕', titulo: 'Conductor ocupado', texto: `${oferta.conductorNombre || 'Ese conductor'} ya tomó otro ${esMensajeria ? 'servicio' : 'viaje'}. Escoge otra de las propuestas.` });
      setContraofertas(prev => prev.filter(c => c.conductorId !== oferta.conductorId));
    } else {
      setAviso({ titulo: 'No se pudo confirmar', texto: 'Intenta de nuevo en un momento.' });
    }
  };

  // Rechazar una oferta: la marca como NO vigente en la subcolección (desaparece de la lista en vivo).
  const rechazarContraoferta = async (conductorId) => {
    setContraofertas(prev => prev.filter(c => c.conductorId !== conductorId));
    // La oferta ya se quitó de la lista de arriba. Si la escritura no entra, el
    // pasajero deja de verla pero el conductor sigue creyendo que está viva.
    // El motivo, si falla, lo dice el candado.
    if (viajeId) await correr(() => updateDoc(doc(db, 'viajes', viajeId, 'contraofertas', conductorId), { vigente: false }),
      'rechazarOferta', 'Oferta rechazada.', 'rechazar esa oferta');
  };
const PanelEmergencia = () => (
    mostrarEmergencia ? (
      <div onClick={() => setMostrarEmergencia(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: '#FFFFFF', borderRadius: '28px', padding: '28px 24px', width: '100%', maxWidth: '420px', border: '3px solid #FF4444' }}>
          <p style={{ color: '#FF4444', fontSize: '14px', margin: '0 0 4px', letterSpacing: '2px', fontWeight: 'bold', textAlign: 'center' }}>🚨 EMERGENCIA</p>
          <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 24px', textAlign: 'center', lineHeight: '1.4' }}>¿Qué necesitas hacer?</p>

          <TarjetaLlamar123 donde="viaje" />

          <div onClick={async () => { await compartirSeguridad(); setMostrarEmergencia(false); }} style={{ background: '#FFFFFF', borderRadius: '18px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', border: '1px solid #25D366' }}>
            <span style={{ fontSize: '34px' }}>📤</span>
            <div>
              <p style={{ color: '#1A1A1E', fontWeight: '900', fontSize: '15px', margin: '0', lineHeight: '1.3' }}>Compartir ubicación, ruta e identidad del conductor</p>
              <p style={{ color: '#25D366', fontSize: '12px', margin: '5px 0 0' }}>Enviar por WhatsApp</p>
            </div>
          </div>

          <button onClick={() => setMostrarEmergencia(false)} style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px solid #ECECEF', borderRadius: '14px', color: '#6B7280', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>Cerrar</button>
        </div>
      </div>
    ) : null
  );
  const resumenMandado = (tipo === 'Mensajería') ? (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '12px 14px', margin: '0 0 16px', border: '1px solid #FF7A2F', width: '100%', maxWidth: '400px', boxSizing: 'border-box' }}>
      <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 6px', letterSpacing: '1px', fontWeight: '900' }}>📦 TU MANDADO</p>
      {queEnvia && <p style={{ color: '#1A1A1E', fontSize: '14px', margin: '0 0 3px', fontWeight: 'bold' }}>📦 Envías: {queEnvia}</p>}
      {recibeNombre && <p style={{ color: '#1A1A1E', fontSize: '14px', margin: '0 0 3px' }}>🙋 Recibe: {recibeNombre}{recibeTel ? ` · 📞 ${recibeTel}` : ''}</p>}
      {notaEnvio && <p style={{ color: '#FF7A2F', fontSize: '13px', margin: '0', fontWeight: 'bold' }}>📝 {notaEnvio}</p>}
    </div>
  ) : null;
  if (mostrarCalificacion) return <Calificacion tipo={tipo} viajeId={viajeId} nombreCalificado={viaje?.conductorNombre} calificadoId={viaje?.conductorId} quienCalifica="pasajero" onFinalizar={onVolver} />;
  if (celebrando) return <TratoHecho />;
  if (llamandoConductor) return <Llamada viajeId={viajeId} miRol="pasajero" nombreOtro={viaje?.conductorNombre || 'Conductor'} onCerrar={() => setLlamandoConductor(false)} />;
  if (llamadaEntrante) return <Llamada viajeId={viajeId} miRol="entrante" nombreOtro={viaje?.conductorNombre || 'Conductor'} onCerrar={() => setLlamadaEntrante(false)} />;

  if (conductorYaTomado) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9998, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ fontSize: '70px', marginBottom: '16px' }}>😕</div>
        <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '420px', border: '2px solid #FF7A2F', textAlign: 'center' }}>
          <h2 style={{ color: '#1A1A1E', fontSize: '22px', fontWeight: '900', margin: '0 0 12px' }}>UPP, ESTE CONDUCTOR YA NO ESTÁ DISPONIBLE 🙈</h2>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: '0', lineHeight: '1.5' }}>Otro pasajero lo tomó primero. No te preocupes, seguimos buscando otro conductor para ti.</p>
        </div>
        <button onClick={() => { setConductorYaTomado(false); seguirBuscando(); }} disabled={!!ocupado} style={{ marginTop: '28px', width: '100%', maxWidth: '420px', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#1A1A1E', fontSize: '17px', fontWeight: '900', cursor: 'pointer' }}>{texto('seguir', 'Buscando…', '🔄 Seguir buscando')}</button>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      </div>
    );
  }

  // G20: el servidor cerró el viaje. El pasajero ya no ve el viaje: la ventanita (la de siempre, `aviso`) dice por
  // qué, y debajo queda lo mismo escrito con el botón para volver al inicio.
  if (viajeCerrado) {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>{viajeCerrado.icono}</div>
        <h2 style={{ color: '#1A1A1E', fontSize: '24px', fontWeight: '900', margin: '0 0 12px', textAlign: 'center' }}>{viajeCerrado.titulo}</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 32px', textAlign: 'center' }}>{viajeCerrado.texto}</p>
        <button onClick={onVolver} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#1A1A1E', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      </div>
    );
  }

  if (pantalla === 'cancelado_conductor') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '80px', marginBottom: '24px' }}>😕</div>
        <h2 style={{ color: '#1A1A1E', fontSize: '24px', fontWeight: '900', margin: '0 0 12px', textAlign: 'center' }}>El conductor canceló el viaje</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 8px', textAlign: 'center' }}>Razón: <span style={{ color: '#FF7A2F' }}>{viaje?.razonCancelacion || 'No especificada'}</span></p>
        <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 32px', textAlign: 'center' }}>Puedes solicitar otro viaje</p>
        <button onClick={onVolver} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#1A1A1E', fontSize: '18px', fontWeight: '900', cursor: 'pointer' }}>Volver al inicio</button>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      </div>
    );
  }

  if (pantalla === 'fase1') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', position: 'relative' }}>
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_PASAJERO} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} ocupado={ocupado} />}
        {mostrarLlego && <ConductorLlego nombre={viaje?.conductorNombre} placa={viaje?.conductorPlaca} onCerrar={() => setMostrarLlego(false)} />}
        <PanelEmergencia />
        <MapaConRuta desde={ubicacionConductor} hasta={ubicacionRecogida || ubicacionPasajero} tipo={tipo} tarjetaRef={tarjetaRef} />
        <div onClick={() => setMostrarEmergencia(true)} style={{ position: 'absolute', top: '86px', right: '16px', zIndex: 20, background: 'linear-gradient(135deg, #FF4444, #CC0000)', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,68,68,0.5)' }}>
          <span style={{ fontSize: '20px' }}>🚨</span>
          <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '900' }}>Emergencia</span>
        </div>
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255,255,255,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#2ECC71', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚗 CONDUCTOR EN CAMINO</p>
            <p style={{ color: '#1A1A1E', fontSize: '14px', fontWeight: '900', margin: '2px 0 0' }}>{viaje?.conductorNombre} · {viaje?.conductorPlaca}</p>
          </div>
          <div style={{ textAlign: 'right' }}><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '18px', fontWeight: '900', margin: '2px 0 0' }}>{tarifaParaPasajero(viaje)}</p></div>
        </div>
        {conductorEnPunto && (
          <div style={{ position: 'absolute', top: '90px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255,255,255,0.97)', borderRadius: '20px', padding: '20px', border: '2px solid #2ECC71' }}>
            <p style={{ color: '#2ECC71', fontSize: '16px', fontWeight: '900', margin: '0 0 4px', textAlign: 'center' }}>📍 ¡Tu conductor llegó!</p>
            {codigoSeguridad && (
              <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '16px', padding: '16px', marginBottom: '12px', border: '2px solid #FFCF4D', textAlign: 'center' }}>
                <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 6px', letterSpacing: '2px', fontWeight: 'bold' }}>🔐 CÓDIGO DE SEGURIDAD</p>
                <p style={{ color: '#FFFFFF', fontSize: '40px', fontWeight: '900', margin: '0', letterSpacing: '8px' }}>{codigoSeguridad}</p>
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '6px 0 0' }}>Dáselo al conductor al subir</p>
              </div>
            )}
            <div style={{ background: contador <= 60 ? 'rgba(255,68,68,0.15)' : 'rgba(255,207,77,0.1)', borderRadius: '12px', padding: '10px 16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${contador <= 60 ? '#FF4444' : '#FFCF4D'}` }}>
              <p style={{ color: '#6B7280', fontSize: '12px', margin: '0' }}>{contador === 0 ? '⚠️ Tiempo agotado' : 'Sal pronto o el conductor puede cancelar'}</p>
              <p style={{ color: contador <= 60 ? '#FF4444' : '#FFCF4D', fontSize: '28px', fontWeight: '900', margin: '0', fontVariantNumeric: 'tabular-nums' }}>{Math.floor(contador / 60)}:{String(contador % 60).padStart(2, '0')}</p>
            </div>
            <p style={{ color: '#6B7280', fontSize: '13px', margin: '0 0 12px', textAlign: 'center' }}>Responde rápido:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {RESPUESTAS_RAPIDAS.map((resp, i) => (
                <button key={i} onClick={() => enviarRespuesta(resp)} disabled={!!ocupado} style={{ padding: '12px 16px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '12px', color: '#1A1A1E', fontSize: '14px', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}>{texto('respuesta:' + resp, 'Enviando…', resp)}</button>
              ))}
            </div>
            <button onClick={() => setMostrarCancelacion(true)} style={{ width: '100%', marginTop: '12px', padding: '14px', background: 'transparent', border: '1px solid #ECECEF', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar viaje</button>
          </div>
        )}
        {!conductorEnPunto && (
          <div ref={tarjetaRef} style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(255,255,255,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', overflow: 'hidden', border: '2px solid #2ECC71', flexShrink: 0 }}>
                  {datosConductor?.foto ? <img src={datosConductor.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
                </div>
                <div>
                  <p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>CONDUCTOR</p>
                  <p style={{ color: '#1A1A1E', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viaje?.conductorNombre}</p>
                  {viaje?.conductorPlaca && <p style={{ color: '#FF7A2F', fontSize: '12px', margin: '2px 0 0' }}>🚘 {viaje.conductorPlaca} · {viaje.conductorVehiculo}{datosConductor?.color ? ` · ${datosConductor.color}` : ''}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                <div style={{ textAlign: 'right' }}><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '18px', fontWeight: '900', margin: '2px 0 0' }}>{tarifaParaPasajero(viaje)}</p></div>
              </div>
            </div>
            {codigoSeguridad && (
              <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '16px', padding: '16px', marginTop: '12px', border: '2px solid #FFCF4D', textAlign: 'center' }}>
                <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0 0 6px', letterSpacing: '2px', fontWeight: 'bold' }}>🔐 CÓDIGO DE SEGURIDAD</p>
                <p style={{ color: '#FFFFFF', fontSize: '40px', fontWeight: '900', margin: '0', letterSpacing: '8px' }}>{codigoSeguridad}</p>
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '6px 0 0' }}>Dáselo al conductor cuando subas</p>
              </div>
            )}
            {descuentoPendiente?.codigoVerificacion && (
              <div style={{ background: 'linear-gradient(135deg, #1A1A1E, #2A2A2E)', borderRadius: '16px', padding: '16px', marginTop: '12px', border: '2px solid #2ECC71', textAlign: 'center' }}>
                <p style={{ color: '#2ECC71', fontSize: '11px', margin: '0 0 6px', letterSpacing: '2px', fontWeight: 'bold' }}>🎁 CÓDIGO DE DESCUENTO</p>
                <p style={{ color: '#FFFFFF', fontSize: '32px', fontWeight: '900', margin: '0', letterSpacing: '8px' }}>{descuentoPendiente.codigoVerificacion}</p>
                <p style={{ color: '#6B7280', fontSize: '12px', margin: '6px 0 0' }}>Dáselo al conductor al finalizar el viaje</p>
              </div>
            )}
            <button onClick={() => setLlamandoConductor(true)} style={{ width: '100%', marginTop: '12px', padding: '14px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>📞 Llamar al conductor</button>
            <button onClick={() => setMostrarChat(!mostrarChat)} style={{ width: '100%', marginTop: '8px', padding: '14px', background: mostrarChat ? '#ECECEF' : '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '14px', color: '#1A1A1E', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>💬 Chat con el conductor {mensajesChat.length > 0 ? `(${mensajesChat.length})` : ''}</button>
            {mostrarChat && (
              <div style={{ marginTop: '8px', background: '#FFFFFF', borderRadius: '14px', padding: '12px', border: '1px solid #ECECEF' }}>
                <div style={{ maxHeight: '160px', overflowY: 'auto', marginBottom: '8px' }}>
                  {mensajesChat.length === 0 && <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', margin: '8px 0' }}>Sin mensajes aún</p>}
                  {mensajesChat.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'pasajero' ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                      <div style={{ background: m.autor === 'pasajero' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', borderRadius: '12px', padding: '8px 12px', maxWidth: '80%' }}>
                        <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0', lineHeight: '1.4' }}>{m.texto}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatFinRef} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={textoChat} onChange={e => setTextoChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarMensajeChat()} placeholder="Escribe un mensaje..." style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '10px', padding: '10px 12px', color: '#1A1A1E', fontSize: '14px', outline: 'none' }} />
                  <button onClick={enviarMensajeChat} disabled={!textoChat.trim() || !!ocupado} style={{ padding: '10px 16px', background: textoChat.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontSize: '18px', cursor: textoChat.trim() ? 'pointer' : 'default' }}>{texto('mensaje', '…', '➤')}</button>
                </div>
              </div>
            )}
            <button onClick={() => setMostrarCancelacion(true)} style={{ width: '100%', marginTop: '8px', padding: '14px', background: 'transparent', border: '1px solid #ECECEF', borderRadius: '14px', color: '#FF4444', fontSize: '14px', cursor: 'pointer' }}>Cancelar viaje</button>
          </div>
        )}
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      </div>
    );
  }

  if (pantalla === 'fase2') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', position: 'relative' }}>
        <PanelEmergencia />
        <MapaConRuta desde={ubicacionConductor} hasta={destinoCoords || ubicacionPasajero} tipo={tipo} tarjetaRef={tarjetaRef} onTiempo={(t, d) => { setTiempoLlegada(t); setDistancia(d); }} />
        <div onClick={() => setMostrarEmergencia(true)} style={{ position: 'absolute', top: '86px', right: '16px', zIndex: 20, background: 'linear-gradient(135deg, #FF4444, #CC0000)', borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(255,68,68,0.5)' }}>
          <span style={{ fontSize: '20px' }}>🚨</span>
          <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '900' }}>Emergencia</span>
        </div>
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, background: 'rgba(255,255,255,0.95)', borderRadius: '16px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '0', letterSpacing: '1px', fontWeight: 'bold' }}>🚀 VIAJE EN CURSO</p>
            <p style={{ color: '#1A1A1E', fontSize: '15px', fontWeight: '900', margin: '2px 0 0' }}>🏁 {destino}</p>
          </div>
          {tiempoLlegada && <div style={{ textAlign: 'right' }}><p style={{ color: '#FF7A2F', fontSize: '20px', fontWeight: '900', margin: '0' }}>⏱️ {tiempoLlegada}</p><p style={{ color: '#6B7280', fontSize: '11px', margin: '0' }}>{distancia}</p></div>}
        </div>
        <div ref={tarjetaRef} style={{ position: 'absolute', bottom: '0', left: '0', right: '0', zIndex: 10, background: 'rgba(255,255,255,0.97)', borderRadius: '24px 24px 0 0', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', overflow: 'hidden', border: '2px solid #FF7A2F', flexShrink: 0 }}>
                {datosConductor?.foto ? <img src={datosConductor.foto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
              </div>
              <div>
                <p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>CONDUCTOR</p>
                <p style={{ color: '#1A1A1E', fontSize: '14px', fontWeight: 'bold', margin: '4px 0 0' }}>{viaje?.conductorNombre}</p>
                {viaje?.conductorPlaca && <p style={{ color: '#FF7A2F', fontSize: '11px', margin: '2px 0 0' }}>🚘 {viaje.conductorPlaca} · {viaje.conductorVehiculo}{datosConductor?.color ? ` · ${datosConductor.color}` : ''}</p>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}><p style={{ color: '#6B7280', fontSize: '10px', margin: '0' }}>TARIFA</p><p style={{ color: '#2ECC71', fontSize: '18px', fontWeight: '900', margin: '4px 0 0' }}>{viaje?.tarifa}</p></div>
          </div>
          {descuentoPendiente?.codigoVerificacion && (
            <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '12px', marginBottom: '10px', border: '2px solid #2ECC71', textAlign: 'center' }}>
              <p style={{ color: '#2ECC71', fontSize: '10px', margin: '0 0 4px', letterSpacing: '2px', fontWeight: 'bold' }}>🎁 CÓDIGO DE DESCUENTO</p>
              <p style={{ color: '#1A1A1E', fontSize: '26px', fontWeight: '900', margin: '0', letterSpacing: '6px' }}>{descuentoPendiente.codigoVerificacion}</p>
              <p style={{ color: '#6B7280', fontSize: '11px', margin: '4px 0 0' }}>Dáselo al conductor al finalizar</p>
            </div>
          )}
          {resumenMandado}
          <button onClick={() => setLlamandoConductor(true)} style={{ width: '100%', marginBottom: '10px', padding: '13px', background: 'linear-gradient(135deg, #2ECC71, #27AE60)', border: 'none', borderRadius: '14px', color: '#FFFFFF', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}>📞 Llamar al conductor</button>
          <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '12px 0 8px' }}>RESPUESTAS RÁPIDAS</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {RESPUESTAS_RAPIDAS.map((resp, i) => (
              <button key={i} onClick={() => enviarRespuesta(resp)} disabled={!!ocupado} style={{ padding: '8px 12px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '10px', color: '#1A1A1E', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}>{texto('respuesta:' + resp, 'Enviando…', resp)}</button>
            ))}
          </div>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '10px', border: '1px solid #ECECEF', marginBottom: '8px' }}>
            <div style={{ maxHeight: '120px', overflowY: 'auto', marginBottom: '8px' }}>
              {mensajesChat.length === 0 && <p style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', margin: '8px 0' }}>Sin mensajes aún</p>}
              {mensajesChat.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'pasajero' ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                  <div style={{ background: m.autor === 'pasajero' ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', borderRadius: '12px', padding: '8px 12px', maxWidth: '80%' }}>
                    <p style={{ color: '#1A1A1E', fontSize: '13px', margin: '0', lineHeight: '1.4' }}>{m.texto}</p>
                  </div>
                </div>
              ))}
              <div ref={chatFinRef} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={textoChat} onChange={e => setTextoChat(e.target.value)} onKeyDown={e => e.key === 'Enter' && enviarMensajeChat()} placeholder="Escribe un mensaje..." style={{ flex: 1, background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '10px', padding: '10px 12px', color: '#1A1A1E', fontSize: '14px', outline: 'none' }} />
              <button onClick={enviarMensajeChat} disabled={!textoChat.trim() || !!ocupado} style={{ padding: '10px 16px', background: textoChat.trim() ? 'linear-gradient(135deg, #FF7A2F, #D6357E)' : '#ECECEF', border: 'none', borderRadius: '10px', color: '#FFFFFF', fontSize: '18px', cursor: textoChat.trim() ? 'pointer' : 'default' }}>{texto('mensaje', '…', '➤')}</button>
            </div>
          </div>
        </div>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      </div>
    );
  }

  if (pantalla === 'esperando') {
    return (
      <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {mostrarCancelacion && <ModalCancelacion razones={RAZONES_CANCELACION_PASAJERO} onConfirmar={cancelarViaje} onCerrar={() => setMostrarCancelacion(false)} ocupado={ocupado} />}

        <div style={{ fontSize: '80px', marginBottom: '24px' }}>{buscandoAgotado ? '😕' : (tipo === 'Taxi' ? '🚗' : '🏍️')}</div>
        <h2 style={{ color: '#1A1A1E', fontSize: '22px', margin: '0 0 8px', textAlign: 'center' }}>{buscandoAgotado ? 'No encontramos conductor' : 'Buscando conductor...'}</h2>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 4px', textAlign: 'center' }}>{origen} → {destino}</p>
        {resumenMandado}
        {!buscandoAgotado && (
          <p style={{ color: '#2ECC71', fontSize: '20px', fontWeight: '900', margin: '0 0 16px', textAlign: 'center' }}>
            Tu oferta: {cop(tarifa)}
            {descuentoPendiente && <span style={{ color: '#FF7A2F', fontSize: '14px' }}> · Pagas {cop(calcularTarifaConDescuento(tarifa))} con tu descuento</span>}
          </p>
        )}
        {!buscandoAgotado && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, height: '8px', background: '#ECECEF', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(tiempoBusqueda / BUSQUEDA.segundos) * 100}%`, background: tiempoBusqueda > 60 ? '#2ECC71' : tiempoBusqueda > 30 ? '#FFCF4D' : '#FF4444', borderRadius: '4px', transition: 'width 1s linear, background 0.5s' }} />
            </div>
            <span style={{ color: tiempoBusqueda > 60 ? '#2ECC71' : tiempoBusqueda > 30 ? '#FFCF4D' : '#FF4444', fontSize: '15px', fontWeight: '900', fontVariantNumeric: 'tabular-nums', minWidth: '42px', textAlign: 'right' }}>{Math.floor(tiempoBusqueda / 60)}:{String(tiempoBusqueda % 60).padStart(2, '0')}</span>
          </div>
        )}
        {buscandoAgotado && (
          <div style={{ width: '100%', marginBottom: '24px' }}>
            <p style={{ color: '#6B7280', fontSize: '14px', margin: '0 0 16px', textAlign: 'center', lineHeight: '1.5' }}>No hay conductores disponibles cerca en este momento. Puedes seguir buscando o subir tu oferta.</p>
            <button onClick={seguirBuscando} disabled={!!ocupado} style={{ width: '100%', padding: '18px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '16px', color: '#1A1A1E', fontSize: '17px', fontWeight: '900', cursor: 'pointer' }}>{texto('seguir', 'Buscando…', '🔄 Seguir buscando')}</button>
          </div>
        )}

        {/* Contraofertas múltiples */}
        {contraofertas.length > 0 && (
          <div style={{ width: '100%', marginBottom: '16px' }}>
            <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px', textAlign: 'center' }}>PROPUESTAS DE CONDUCTORES</p>
            {contraofertas.map(oferta => (
              <TarjetaContraoferta
                key={oferta.conductorId}
                oferta={oferta}
                ocupado={ocupado}
                onAceptar={() => aceptarContraoferta(oferta)}
                onRechazar={() => rechazarContraoferta(oferta.conductorId)}
              />
            ))}
          </div>
        )}

        {/* Subir oferta mientras espera */}
        <div style={{ width: '100%', background: '#FFFFFF', borderRadius: '20px', padding: '20px', marginBottom: '16px', border: '1px solid #ECECEF' }}>
          <p style={{ color: '#6B7280', fontSize: '11px', margin: '0 0 12px', letterSpacing: '2px', textAlign: 'center' }}>¿QUIERES SUBIR TU OFERTA?</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <button onClick={bajarNuevaTarifa} style={{ width: '48px', height: '48px', background: (nuevaTarifa || tarifa) <= tarifa ? '#ECECEF' : '#FFFFFF', border: `2px solid ${(nuevaTarifa || tarifa) <= tarifa ? '#ECECEF' : '#FF7A2F'}`, borderRadius: '14px', color: (nuevaTarifa || tarifa) <= tarifa ? '#6B7280' : '#FF7A2F', fontSize: '24px', cursor: (nuevaTarifa || tarifa) <= tarifa ? 'default' : 'pointer', fontWeight: 'bold' }}>−</button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#1A1A1E', fontSize: '32px', fontWeight: '900', margin: '0' }}>{cop(nuevaTarifa || tarifa)}</p>
              <p style={{ color: '#6B7280', fontSize: '11px', margin: '4px 0 0' }}>Oferta actual: {cop(tarifa)}</p>
            </div>
            <button onClick={subirNuevaTarifa} style={{ width: '48px', height: '48px', background: '#FFFFFF', border: '2px solid #2ECC71', borderRadius: '14px', color: '#2ECC71', fontSize: '24px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
          </div>
          <button onClick={enviarNuevaOferta} disabled={!ofertaModificada || !!ocupado} style={{ width: '100%', padding: '14px', background: ofertaModificada ? 'linear-gradient(135deg, #FFCF4D, #FF7A2F)' : '#ECECEF', border: 'none', borderRadius: '14px', color: ofertaModificada ? '#FFFFFF' : '#6B7280', fontSize: '15px', fontWeight: '900', cursor: ofertaModificada ? 'pointer' : 'default' }}>
            {texto('oferta', 'Enviando…', ofertaModificada ? '⬆️ Enviar nueva oferta' : 'Modifica la tarifa para enviar')}
          </button>
        </div>

        <div style={{ width: '60px', height: '4px', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '2px', marginBottom: '16px' }}/>
        <button onClick={() => setMostrarCancelacion(true)} style={{ background: 'transparent', border: '1px solid #ECECEF', borderRadius: '14px', color: '#FF4444', fontSize: '14px', padding: '14px 32px', cursor: 'pointer' }}>Cancelar viaje</button>
        <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#FFFFFF', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#FFFFFF', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', borderBottom: '1px solid #ECECEF' }}>
        <BotonVolver alVolver={onVolver} />
        <h2 style={{ color: '#1A1A1E', margin: '0', fontSize: '20px' }}>{esMensajeria ? 'Pedir mandado 📦' : `Solicitar ${tipo}`}</h2>
        <Logo size={26} style={{ position: 'absolute', top: '12px', right: '16px' }} />
      </div>
      <div style={{ padding: '12px 20px 24px' }}>
        <AutocompleteInput value={origen} onChange={(v) => { setOrigen(v); pinActivoRef.current = false; }} placeholder={esMensajeria ? '¿Dónde se recoge? (Riohacha)' : '¿Dónde estás? (Riohacha)'} icon="origen" onPlaceCoords={(coords) => { setPuntoRecogida(coords); setCentroMapa(coords); pinActivoRef.current = true; }} />
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <AutocompleteInput value={destino} onChange={setDestino} placeholder={esMensajeria ? '¿Dónde se entrega? (Riohacha)' : '¿A dónde vas? (Riohacha)'} icon="destino" />
          </div>
          {destino && !favoritos.find(f => f.direccion === destino) && (
            <div onClick={guardarFavorito} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FFCF4D, #FF7A2F)', borderRadius: '16px', padding: '0 14px', marginBottom: '12px', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ color: '#1A1A1E', fontSize: '20px', fontWeight: '900', lineHeight: '1' }}>{texto('favorito', '…', '➕')}</span>
              <span style={{ color: '#1A1A1E', fontSize: '9px', fontWeight: '900', marginTop: '2px', textAlign: 'center', lineHeight: '1.1' }}>Guardar<br/>lugar</span>
            </div>
          )}
        </div>

        {/* NUEVO: mapa de recogida con pin fijo. La dirección se auto-llena arriba en el campo de recogida (y se puede editar). */}
        <p style={{ color: '#1A1A1E', fontSize: '11px', letterSpacing: '2px', margin: '0 0 8px' }}>MUEVE EL MAPA PARA MARCAR TU RECOGIDA</p>
        <MapaRecogida
          ubicacionInicial={centroMapa}
          // El mapa dice QUÉ pasó; la ventanita la pinta quien sabe pintarla, y
          // el texto sale del único sitio donde vive (`NO_SE_DONDE_ESTAS`), el
          // mismo que ve quien pide sin decir dónde está.
          onNoSePudo={(porque) => setAviso(NO_SE_DONDE_ESTAS(esMensajeria, porque))}
          onCambioPunto={(punto, direccion, loEligio) => {
            // 🔴 EL RELLENO NO SE DA POR BUENO.
            //
            // El punto vale de dos maneras: porque lo eligió el pasajero (movió
            // el mapa o apretó «Usar mi ubicación»), o porque el mapa está
            // donde dice el GPS del aparato. Si no es ninguna de las dos, este
            // aviso viene del `idle` que Google lanza él solo al terminar de
            // dibujar el mapa, y el punto es el centro de relleno: la plaza.
            //
            // Darlo por bueno es lo que hacía que el viaje naciera allí, que el
            // conductor fuera allí y que el servidor avisara a los conductores
            // de allí. Aquí no se hace nada: ni se escribe la dirección en el
            // campo de origen, ni se activa el pin.
            if (!loEligio && !ubicacionEsDelGps) return;
            setPuntoRecogida(punto);
            pinActivoRef.current = true;
            if (direccion) setOrigen(direccion);
          }}
        />

        {/* Los datos del paquete solo existen en mensajería. Un viaje de taxi no
            los pide, y dejarlos sueltos los pintaría también ahí. */}
        {esMensajeria && (<>
          <p style={{ color: '#1A1A1E', fontSize: '11px', letterSpacing: '2px', margin: '4px 0 8px' }}>DATOS DEL ENVÍO</p>
          <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '10px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📦</span>
            <input value={queEnvia} onChange={e => setQueEnvia(e.target.value)} placeholder="¿Qué envías? (ej: una caja)" style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '10px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>🙋</span>
            <input value={recibeNombre} onChange={e => setRecibeNombre(e.target.value.toUpperCase())} placeholder="NOMBRE DE QUIEN RECIBE" style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%', textTransform: 'uppercase' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '10px 14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📞</span>
            <input value={recibeTel} onChange={e => setRecibeTel(cifrasMientrasEscribe(e.target.value))} placeholder="Teléfono (10 números)" type="tel" inputMode="numeric" maxLength={10} style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' }} />
          </div>
          <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '14px', padding: '10px 14px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>📝</span>
            <input value={notaEnvio} onChange={e => setNotaEnvio(e.target.value)} placeholder="Nota para el domiciliario (ej: dejar en portería)" style={{ background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' }} />
          </div>
        </>)}

        {favoritos.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#6B7280', fontSize: '11px', letterSpacing: '2px', margin: '0 0 10px' }}>MIS LUGARES</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {favoritos.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFFFF', border: '1px solid #ECECEF', borderRadius: '14px', padding: '10px 14px' }}>
                  <div onClick={() => setDestino(f.direccion)} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <span style={{ fontSize: '18px' }}>{f.icono}</span>
                    <span style={{ color: '#1A1A1E', fontSize: '14px', fontWeight: 'bold' }}>{f.nombre}</span>
                  </div>
                  <span onClick={() => borrarFavorito(i)} style={{ color: '#FF4444', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold', paddingLeft: '4px' }}>{texto('borrarFavorito', '…', '✕')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {descuentoPendiente && (
          <div style={{ background: 'linear-gradient(135deg, #2ECC71, #27AE60)', borderRadius: '16px', padding: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🎁</span>
            <div>
              <p style={{ color: '#FFFFFF', fontWeight: '900', fontSize: '15px', margin: '0' }}>
                Tienes un descuento activo de {valorDelBeneficio(descuentoPendiente)}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', margin: '2px 0 0' }}>Se aplicará automáticamente a este viaje</p>
            </div>
          </div>
        )}

        <div style={{ background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '12px', padding: '8px 14px', marginBottom: '12px' }}>
          <p style={{ color: '#6B7280', fontSize: '9px', margin: '0 0 4px', letterSpacing: '2px' }}>TU OFERTA</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={bajarTarifa} style={{ width: '36px', height: '36px', background: tarifa <= TARIFA_MINIMA ? '#ECECEF' : '#FFFFFF', border: `2px solid ${tarifa <= TARIFA_MINIMA ? '#ECECEF' : '#FF7A2F'}`, borderRadius: '10px', color: tarifa <= TARIFA_MINIMA ? '#6B7280' : '#FF7A2F', fontSize: '20px', cursor: tarifa <= TARIFA_MINIMA ? 'default' : 'pointer', fontWeight: 'bold' }}>−</button>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: '#1A1A1E', fontSize: '24px', fontWeight: '900', margin: '0' }}>{cop(tarifa)}</p>
              <p style={{ color: '#6B7280', fontSize: '9px', margin: '1px 0 0' }}>{tarifa === TARIFA_MINIMA ? 'Tarifa mínima' : 'Oferta personalizada'}</p>
            </div>
            <button onClick={subirTarifa} style={{ width: '36px', height: '36px', background: '#FFFFFF', border: '2px solid #2ECC71', borderRadius: '10px', color: '#2ECC71', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
          </div>
        </div>
        {error && <p style={{ color: '#FF4444', fontSize: '13px', textAlign: 'center', marginBottom: '12px' }}>{error}</p>}
        <button onClick={solicitarViaje} disabled={!!ocupado} style={{ width: '100%', padding: '13px', background: ocupado ? '#ECECEF' : 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', border: 'none', borderRadius: '14px', color: ocupado ? '#6B7280' : '#FFFFFF', fontSize: '16px', fontWeight: '900', cursor: ocupado ? 'default' : 'pointer' }}>
          {texto('pedir', 'Enviando…', esMensajeria
            ? `Pedir mandado — ${cop(tarifa)}`
            : `Solicitar ${tipo} — ${cop(tarifa)}`)}
        </button>
      </div>
      <AvisoModal aviso={aviso} onCerrar={() => setAviso(null)} />
    </div>
  );
}

export default Solicitar;