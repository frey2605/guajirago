#!/usr/bin/env node
// 🤖 LA DIRECCIÓN DEL PEDIDO DE COMIDA CON «📍 USAR MI UBICACIÓN» — gemelo G30 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test) → Restaurantes → «Restaurante de Prueba», echa un «Jugo de corozo»
// al carrito y toca «📍 Usar mi ubicación», dos veces, cada una en una sesión nueva:
//   1. Google contesta con una calle: la dirección de entrega tiene que quedar con ESA calle y sin ventanita.
//   2. Google no encuentra la calle (ZERO_RESULTS): la dirección queda con las coordenadas del GPS —es lo único que
//      tendría el domiciliario— y tiene que salir la ventanita «Falta el nombre de la calle». Antes de G30 quedaban
//      las coordenadas SIN DECIR NADA.
// El GPS y el geocodificador de Google son de mentira (se ponen antes de cargar), para que el caso sea el mismo
// siempre. No se crea ningún pedido: el recorrido no toca la base.
//   node robot/direccion-pedido.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';
const LAT = 11.5442101;
const LNG = -72.9071099;
const COORDS = LAT.toFixed(6) + ', ' + LNG.toFixed(6);
const CALLE = 'Calle Robot 7 #8-9, Riohacha, La Guajira, Colombia';

// Va como TEXTO porque el motor no le pasa datos a lo que corre antes de cargar (ver APRENDIDO.md).
// El Geocoder de Google se cambia en cuanto Google carga (se vigila cada 100 ms); el constructor se lee al tocar el
// botón, así que el cambio llega a tiempo.
const antesDeCargar = (status, calle) => '(' + ((lat, lng, st, c) => {
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() }), 300),
    watchPosition: () => 1,
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  window.__pedidas = [];
  const iv = setInterval(() => {
    if (window.google && window.google.maps && window.google.maps.Geocoder && !window.__geoCambiado) {
      window.google.maps.Geocoder = function Geocoder() {
        return {
          geocode: (req, cb) => {
            window.__pedidas.push(req);
            setTimeout(() => cb(st === 'OK' ? [{ formatted_address: c }] : [], st), 300);
          },
        };
      };
      window.__geoCambiado = true;
      clearInterval(iv);
    }
  }, 100);
}) + ')(' + LAT + ',' + LNG + ',' + JSON.stringify(status) + ',' + JSON.stringify(calle) + ');';

async function unaVuelta(nombre, status) {
  const r = await abrir('transporte', { nombre: 'direccion-pedido-' + nombre, antesDeCargar: antesDeCargar(status, CALLE) });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Restaurantes', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByText('Restaurante de Prueba').first().click();
    await p.waitForTimeout(3000);
    await p.getByText('+', { exact: true }).last().click(); // el «+» del último plato (Jugo de corozo)
    await p.waitForTimeout(1500);
    const geoCambiado = await p.evaluate(() => !!window.__geoCambiado);
    await p.getByRole('button', { name: '📍 Usar mi ubicación' }).click();
    await p.waitForTimeout(3000);
    const direccion = await p.inputValue('input[placeholder="📍 Dirección de entrega"]');
    const texto = await r.texto();
    await r.captura('despues-de-tocar');
    const ventanita = /Falta el nombre de la calle/.test(texto) && /Encontramos tu ubicación, pero no el nombre de la calle/.test(texto);
    let cerro = null;
    if (ventanita) {
      await p.getByRole('button', { name: 'Entendido' }).click();
      await p.waitForTimeout(800);
      cerro = !/Falta el nombre de la calle/.test(await r.texto());
      await r.captura('ventanita-cerrada');
    }
    const botonLibre = await p.getByRole('button', { name: '📍 Usar mi ubicación' }).count();
    const pedidas = await p.evaluate(() => window.__pedidas);
    return { geoCambiado, direccion, ventanita, cerro, botonLibre, pedidas, errores: r.errores, carpeta: r.carpeta };
  } finally {
    await r.cerrar();
  }
}

(async () => {
  const fallos = [];
  const punto = (v) => v.pedidas.length === 1 && v.pedidas[0].location
    && Math.abs(v.pedidas[0].location.lat - LAT) < 1e-9 && Math.abs(v.pedidas[0].location.lng - LNG) < 1e-9;

  const a = await unaVuelta('google-contesta', 'OK');
  console.log('GOOGLE CONTESTA: dirección «' + a.direccion + '» · ventanita ' + (a.ventanita ? 'SÍ' : 'no') + ' · capturas', a.carpeta);
  if (!a.geoCambiado) fallos.push('Google Maps no cargó en la app de pruebas: no se pudo poner el geocodificador de mentira');
  if (!punto(a)) fallos.push('con Google contestando, no se le preguntó UNA vez por el punto del GPS: ' + JSON.stringify(a.pedidas));
  if (a.direccion !== CALLE) fallos.push('con Google contestando, la dirección no quedó con la calle: «' + a.direccion + '»');
  if (a.ventanita) fallos.push('con Google contestando, salió la ventanita de «falta la calle»');
  if (!a.botonLibre) fallos.push('con Google contestando, el botón se quedó en «Buscando tu ubicación»');

  const b = await unaVuelta('google-sin-calle', 'ZERO_RESULTS');
  console.log('GOOGLE SIN CALLE: dirección «' + b.direccion + '» · ventanita ' + (b.ventanita ? 'SÍ' : 'NO') + ' · capturas', b.carpeta);
  if (!punto(b)) fallos.push('sin calle, no se le preguntó UNA vez a Google por el punto del GPS: ' + JSON.stringify(b.pedidas));
  if (b.direccion !== COORDS) fallos.push('sin calle, la dirección no quedó con las coordenadas (' + COORDS + '): «' + b.direccion + '»');
  if (!b.ventanita) fallos.push('sin calle, NO salió la ventanita: el fallo sigue siendo mudo');
  if (b.ventanita && !b.cerro) fallos.push('la ventanita no se cierra con «Entendido»');
  if (!b.botonLibre) fallos.push('sin calle, el botón se quedó en «Buscando tu ubicación»');

  console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...b.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ con calle la escribe; sin calle deja las coordenadas y lo dice en la ventanita');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
