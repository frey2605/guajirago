import React, { useEffect, useRef } from 'react';
import { centroRiohacha } from './riohacha';

// ─────────────────────────────────────────────────────────────────────────────
// EL MAPA CON RUTA — UNO SOLO para el conductor y el pasajero (gemelo G29, 28-sep-2026).
//
// Hasta ese día eran dos, casi iguales: `MapaConductor` en AppConductor.js y `MapaPasajero` en Solicitar.js. Pintan
// el carro (o la moto), un 📍 y la ruta de Google entre los dos, y encuadran la ruta. Se habían separado en lo que más
// se ve: el del pasajero le pasaba a Google un margen para su tarjeta de abajo, y el del conductor le pasaba
// `{ padding: 80 }`, que Google NO entiende (quiere `top`, `bottom`, `left`, `right`): margen 0.
//
// 🔴 Y el robot enseñó que ni el del pasajero servía: la ruta la pintaba un `DirectionsRenderer` sin
// `preserveViewport`, y ése RE-ENCUADRA la vista a la ruta él solo, sin margen, por encima del nuestro. Medido en
// pruebas (robot/ruta-conductor.cjs): en las dos apps el 📍 quedaba en y=692 de 860, debajo de la tarjeta (la del
// taxista empieza en 566 y la del pasajero en 451). Por eso aquí la ruta se pinta con `preserveViewport: true` y el
// encuadre lo hace SOLO este archivo.
//
// Lo que cambia entre las dos pantallas va por datos, no por copia:
//   · `desde` es el carro (el origen de la ruta) y `hasta` el 📍 (el destino de la ruta);
//   · `centrarEn` dice a quién mira el mapa mientras no hay ruta: el conductor a su carro ('desde'), el pasajero a su
//     punto ('hasta'), como hacía cada uno;
//   · `tarjetaRef` es la tarjeta de abajo de la pantalla: su alto DE VERDAD es el margen de abajo. Un número fijo no
//     sirve: la del pasajero esperando mide ~409 px (lleva el código de seguridad) y la del taxista ~294.
// ─────────────────────────────────────────────────────────────────────────────

// El margen al encuadrar: arriba la barra (y el 🚨 del pasajero), a los lados un respiro, abajo la tarjeta. Si la
// pantalla no presta su tarjeta, abajo quedan los 380 que ya usaba el pasajero.
export const MARGEN_DE_LA_RUTA = { top: 120, bottom: 380, left: 60, right: 60 };

// Abajo, el alto de la tarjeta más un respiro; pero nunca tanto que no quede hueco para la ruta (con un margen mayor
// que el mapa, Google no sabe encuadrar).
export const margenDeLaRuta = (altoMapa, altoTarjeta) => {
  const abajo = altoTarjeta > 0 ? altoTarjeta + 24 : MARGEN_DE_LA_RUTA.bottom;
  const tope = altoMapa > 0 ? Math.max(0, altoMapa - MARGEN_DE_LA_RUTA.top - 120) : abajo;
  return { ...MARGEN_DE_LA_RUTA, bottom: Math.min(abajo, tope) };
};

export default function MapaConRuta({ desde, hasta, tipo, colorRuta = '#FF7A2F', centrarEn = 'hasta', tarjetaRef, onTiempo }) {
  const mapRef = useRef(null);
  const mapaRef = useRef(null);
  const marcadorDesdeRef = useRef(null);
  const marcadorHastaRef = useRef(null);
  const rutaRef = useRef(null);
  const ajustadoRef = useRef(false);

  useEffect(() => {
    if (!window.google || !mapRef.current || mapaRef.current) return;
    mapaRef.current = new window.google.maps.Map(mapRef.current, {
      center: (centrarEn === 'desde' ? desde : hasta) || centroRiohacha,
      zoom: 15,
      styles: [], // mapa blanco (tema normal de Google)
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El carro (o la moto). El conductor centra el mapa en él la primera vez que aparece.
  useEffect(() => {
    if (!mapaRef.current || !window.google || !desde) return;
    if (marcadorDesdeRef.current) {
      marcadorDesdeRef.current.setPosition(desde);
    } else {
      marcadorDesdeRef.current = new window.google.maps.Marker({
        position: desde,
        map: mapaRef.current,
        label: { text: tipo === 'Taxi' ? '🚗' : '🏍️', fontSize: '28px' },
      });
      if (centrarEn === 'desde') mapaRef.current.setCenter(desde);
    }
  }, [desde, tipo, centrarEn]);

  // El 📍. El pasajero centra el mapa en él mientras no haya carro (evita quedar en el centro por defecto).
  useEffect(() => {
    if (!mapaRef.current || !window.google || !hasta) return;
    if (marcadorHastaRef.current) marcadorHastaRef.current.setPosition(hasta);
    else marcadorHastaRef.current = new window.google.maps.Marker({ position: hasta, map: mapaRef.current, label: { text: '📍', fontSize: '24px' } });
    if (centrarEn === 'hasta' && !desde && !ajustadoRef.current) mapaRef.current.setCenter(hasta);
  }, [hasta, desde, centrarEn]);

  useEffect(() => {
    if (!mapaRef.current || !window.google || !desde || !hasta) return;
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin: desde,
      destination: hasta,
      travelMode: window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status !== 'OK') return;
      if (rutaRef.current) rutaRef.current.setMap(null);
      // `preserveViewport: true`: sin él, Google encuadra la ruta por su cuenta, sin margen, y pisa el de abajo.
      rutaRef.current = new window.google.maps.DirectionsRenderer({
        directions: result,
        map: mapaRef.current,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: colorRuta, strokeWeight: 5 },
      });
      const leg = result.routes[0].legs[0];
      if (onTiempo) onTiempo(leg.duration.text, leg.distance.text);
      // Se encuadra con CADA ruta nueva, como ya lo hacía Google por su cuenta (la gente ve el mapa seguir al carro),
      // pero dejando ver la barra y la tarjeta.
      ajustadoRef.current = true;
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(desde);
      bounds.extend(hasta);
      if (result.routes[0].bounds) bounds.union(result.routes[0].bounds);
      const altoTarjeta = tarjetaRef && tarjetaRef.current ? tarjetaRef.current.offsetHeight : 0;
      mapaRef.current.fitBounds(bounds, margenDeLaRuta(mapRef.current ? mapRef.current.offsetHeight : 0, altoTarjeta));
    });
  }, [desde, hasta, colorRuta, onTiempo, tarjetaRef]);

  return <div ref={mapRef} style={{ width: '100%', height: '100vh' }} />;
}
