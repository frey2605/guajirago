#!/usr/bin/env node
// 🤖 UN TELÉFONO EN INGLÉS PIDE UN TAXI Y EL PRECIO SE GUARDA IGUAL QUE EN UNO EN ESPAÑOL — gemelo G13 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test) con el navegador haciéndose pasar por un teléfono en INGLÉS
// (`toLocaleString()` sin idioma escribe «10,000»), pide un Taxi en PRUEBAS con un GPS de mentira y lee en la base
// de pruebas el viaje que nació: su texto `tarifa` tiene que ser el de cop() («$ 10.000», con el espacio fijo) y
// decir el mismo número que `tarifaValor`. Antes de G13 ese teléfono guardaba «$10,000».
// Al final cancela el viaje por la pantalla («Otro motivo»), así que no le llega a nadie como viaje vivo.
//   node robot/precio-viaje.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');
const { formaDe, numeroDel } = require('../scripts/medir-tarifa-texto.cjs');

const CORREO = 'pasajero@gg.test';
const LAT = 11.5444;
const LNG = -72.9072;

// Va como TEXTO porque el motor no le pasa datos a lo que corre antes de cargar (ver APRENDIDO.md).
const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 200),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 200); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  // Un teléfono en inglés: el número sin idioma se escribe como en Estados Unidos.
  const original = Number.prototype.toLocaleString;
  // eslint-disable-next-line no-extend-native
  Number.prototype.toLocaleString = function (loc, op) { return original.call(this, loc || 'en-US', op); };
}) + ')(' + LAT + ',' + LNG + ');';

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'precio-viaje', antesDeCargar });
  const p = r.pagina;
  // El id del viaje se saca de lo que la app le manda a Firestore al crearlo (el SDK arma el id en el aparato).
  const vistos = new Set();
  p.on('request', (req) => {
    let b = '';
    try { b = decodeURIComponent(req.postData() || ''); } catch (e) { b = req.postData() || ''; }
    for (const m of b.matchAll(/documents\/viajes\/([A-Za-z0-9]{20})/g)) vistos.add(m[1]);
  });
  try {
    const ingles = await p.evaluate(() => (10000).toLocaleString());
    console.log('EL TELÉFONO ESCRIBE 10000 COMO:', ingles);
    if (ingles !== '10,000') fallos.push('el navegador no se hizo pasar por un teléfono en inglés (escribe «' + ingles + '»)');

    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    for (const paso of ['Transporte y movilidad', 'Soy pasajero']) {
      const x = p.getByText(paso, { exact: true });
      if (await x.count()) { await x.first().click(); await p.waitForTimeout(2500); }
    }
    await p.getByText('Taxi', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.fill('input[placeholder="¿Dónde estás? (Riohacha)"]', 'Calle 1 # 1-1 prueba del robot');
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await r.captura('formulario');
    await p.getByRole('button', { name: /^Solicitar Taxi/ }).click();
    await p.waitForTimeout(6000);
    await r.captura('esperando');

    const base = await entrarALaBase(CORREO);
    const ids = [...vistos];
    console.log('VIAJES QUE LA APP NOMBRÓ AL ESCRIBIR:', ids.join(', ') || '(ninguno)');
    if (ids.length !== 1) fallos.push('esperaba que la app escribiera en UN viaje y nombró ' + ids.length);
    if (ids[0]) {
      const v = await base.leer('viajes/' + ids[0]);
      console.log('EN LA BASE:', ids[0], '· tarifa «' + v.tarifa + '» (' + formaDe(v.tarifa) + ') · tarifaValor', v.tarifaValor);
      if (formaDe(v.tarifa) !== 'cop() «$ 10.000»' && !(v.tarifaValor < 1000)) {
        fallos.push('el viaje guardó el precio con la forma del teléfono: «' + v.tarifa + '» (' + formaDe(v.tarifa) + ')');
      }
      if (numeroDel(v.tarifa) !== v.tarifaValor) fallos.push('el texto «' + v.tarifa + '» no dice el número ' + v.tarifaValor);
    }

    // Se cancela por la pantalla, para no dejar un viaje vivo en pruebas.
    const cancelar = p.getByRole('button', { name: 'Cancelar viaje', exact: true });
    if (!(await cancelar.count())) throw new Error('no llegué a la pantalla de espera: ' + (await r.texto()).slice(0, 200));
    await cancelar.first().click();
    await p.waitForTimeout(1200);
    await p.getByRole('button', { name: /Otro motivo/ }).click();
    await p.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await p.waitForTimeout(5000);
    await r.captura('cancelado');
    if (ids[0]) {
      const v = await base.leer('viajes/' + ids[0]);
      if (v.estado !== 'cancelado') fallos.push('el viaje de la prueba no quedó cancelado: ' + v.estado);
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ un teléfono en inglés guarda el precio con cop(), igual que uno en español');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
