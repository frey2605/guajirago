#!/usr/bin/env node
// 🤖 SE ACABA EL PLAZO DE LA BÚSQUEDA — gemelo G27 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test), pide un Taxi en PRUEBAS con un GPS de mentira y NO hace nada:
// deja que se acabe el plazo del celular (BUSQUEDA.segundos de configApp.js, 2 min). Exige:
//   · que la pantalla diga «No encontramos conductor» con su botón «Seguir buscando», y que NO le salga la ventanita
//     «Este viaje ya se cerró» (ese vencido lo escribió su propio teléfono, no el servidor);
//   · que en la base de pruebas el viaje quede `vencido` CON SU RASTRO: `expiradoPor: 'app-pasajero'`,
//     `fechaExpiracion` y `motivoExpiracion`. Eso prueba también que las reglas de Firestore dejan escribirlo.
// Deja en pruebas UN viaje por corrida, ya `vencido` (no le llega a nadie como viaje vivo).
//   node robot/vencer-busqueda.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const CORREO = 'pasajero@gg.test';
const LAT = 11.5444;
const LNG = -72.9072;
const { BUSQUEDA, marcaDelVencido } = cargarDeLaApp('guajirago/src/configApp.js');

// Va como TEXTO porque el motor no le pasa datos a lo que corre antes de cargar (ver APRENDIDO.md).
const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 200),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 200); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + LAT + ',' + LNG + ');';

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'vencer-busqueda', antesDeCargar });
  const p = r.pagina;
  const vistos = new Set();
  p.on('request', (req) => {
    let b = '';
    try { b = decodeURIComponent(req.postData() || ''); } catch (e) { b = req.postData() || ''; }
    for (const m of b.matchAll(/documents\/viajes\/([A-Za-z0-9]{20})/g)) vistos.add(m[1]);
  });
  try {
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
    await p.fill('input[placeholder="¿Dónde estás? (Riohacha)"]', 'Calle 1 # 1-1 prueba del robot G27');
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /^Solicitar Taxi/ }).click();
    await p.waitForTimeout(4000);
    await r.captura('buscando');
    const t0 = await r.texto();
    if (!/Buscando conductor/.test(t0)) throw new Error('no llegué a «Buscando conductor»: ' + t0.slice(0, 200));
    const reloj = /(\d):(\d\d)/.exec(t0);
    console.log('RELOJ AL EMPEZAR:', reloj ? reloj[0] : '(no se ve)', '· plazo de la pieza:', BUSQUEDA.segundos, 's');
    if (!reloj || Number(reloj[1]) * 60 + Number(reloj[2]) > BUSQUEDA.segundos) {
      fallos.push('el reloj no arranca en el plazo de la pieza (' + BUSQUEDA.segundos + ' s): ' + (reloj ? reloj[0] : 'no se ve'));
    }

    // Que se acabe el plazo, y un margen para que la escritura llegue.
    await p.waitForTimeout(BUSQUEDA.segundos * 1000 + 8000);
    await r.captura('agotado');
    const t = await r.texto();
    if (!/No encontramos conductor/.test(t)) fallos.push('al acabarse el plazo no dice «No encontramos conductor»: ' + t.slice(0, 200));
    if (!(await p.getByRole('button', { name: /Seguir buscando/ }).count())) fallos.push('no está el botón «Seguir buscando»');
    if (/Este viaje ya se cerró/.test(t)) fallos.push('le salió la ventanita del cierre del servidor por su propio vencido');

    const base = await entrarALaBase(CORREO);
    const ids = [...vistos];
    console.log('VIAJES QUE LA APP NOMBRÓ AL ESCRIBIR:', ids.join(', ') || '(ninguno)');
    if (ids.length !== 1) fallos.push('esperaba que la app escribiera en UN viaje y nombró ' + ids.length);
    if (ids[0]) {
      const v = await base.leer('viajes/' + ids[0]);
      console.log('EN LA BASE:', ids[0], '·', v.estado, '·', v.expiradoPor, '·', v.fechaExpiracion, '·', v.motivoExpiracion);
      const esperado = marcaDelVencido('x');
      if (v.estado !== 'vencido') fallos.push('el viaje no quedó vencido: ' + v.estado);
      if (v.expiradoPor !== esperado.expiradoPor) fallos.push('el vencido no dice quién: ' + v.expiradoPor);
      if (v.motivoExpiracion !== esperado.motivoExpiracion) fallos.push('el vencido no dice por qué: ' + v.motivoExpiracion);
      if (!v.fechaExpiracion || Number.isNaN(Date.parse(v.fechaExpiracion))) fallos.push('el vencido no dice cuándo: ' + v.fechaExpiracion);
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ al acabarse el plazo el pasajero ve «No encontramos conductor» y el viaje queda vencido con fecha, quién y por qué');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
