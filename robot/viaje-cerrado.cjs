#!/usr/bin/env node
// 🤖 EL SERVIDOR CIERRA EL VIAJE EN CURSO DEL PASAJERO — gemelo G20 (28-sep-2026).
// Hasta ese día, si la rutina del servidor cerraba un viaje (`expirado`) mientras el pasajero lo tenía en pantalla, el
// pasajero seguía viendo «CONDUCTOR EN CAMINO» de un viaje que ya no existía.
// Entra como el pasajero de prueba (pasajero@gg.test), pide un Taxi en PRUEBAS con un GPS de mentira, y desde la base
// de pruebas (como ese mismo pasajero: las reglas le dejan cambiar el estado de SU viaje) hace lo que harían el
// servidor y un conductor: lo pone `aceptado` (la pantalla pasa a «conductor en camino») y luego `expirado` con
// `expiradoPor: 'sistema'` y su `motivoExpiracion`, como lo escribe `expirarViajesColgados`. Exige que salga la
// ventanita «Este viaje ya se cerró» con ese porqué, que al tocar «Entendido» quede fuera del viaje con «Volver al
// inicio», y que ese botón lo lleve al inicio.
// Deja en pruebas UN viaje, ya `expirado` y sin conductor (no le llega a nadie como viaje vivo).
// Lo que NO puede probar: el lado del CONDUCTOR, que pide un viaje confirmado por `confirmarConductor`; ese lo EJECUTA
// pruebas/viajeCerrado.test.js.
//   node robot/viaje-cerrado.cjs
const { abrir, cerrarAvisoDeOfertas, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';
const LAT = 11.5444;
const LNG = -72.9072;
const MOTIVO = 'ROBOT G20: lo aceptaron hace 61 min y el conductor nunca llegó a recoger';

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
  const r = await abrir('transporte', { nombre: 'viaje-cerrado', antesDeCargar });
  const p = r.pagina;
  // El id del viaje se saca de lo que la app le manda a Firestore al crearlo (el SDK arma el id en el aparato).
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
    await p.fill('input[placeholder="¿Dónde estás? (Riohacha)"]', 'Calle 1 # 1-1 prueba del robot G20');
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /^Solicitar Taxi/ }).click();
    await p.waitForTimeout(6000);
    await cerrarAvisoDeOfertas(p); // P23: sin permiso de avisos sale la ventanita de las ofertas y tapa la pantalla
    await r.captura('esperando');
    const ids = [...vistos];
    console.log('VIAJES QUE LA APP NOMBRÓ AL ESCRIBIR:', ids.join(', ') || '(ninguno)');
    if (ids.length !== 1) throw new Error('esperaba que la app escribiera en UN viaje y nombró ' + ids.length);
    const idViaje = ids[0];
    const base = await entrarALaBase(CORREO);

    // 1) Lo «aceptan»: la pantalla del pasajero pasa a «conductor en camino» (tras la celebración de 3 s).
    await base.cambiar('viajes/' + idViaje, { estado: 'aceptado', fechaAceptacion: new Date().toISOString() });
    await p.waitForTimeout(7000);
    await r.captura('en-camino');
    const enCamino = await r.texto();
    if (!/CONDUCTOR EN CAMINO/.test(enCamino)) throw new Error('no llegué a «conductor en camino»: ' + enCamino.slice(0, 200));

    // 2) El servidor lo cierra, como lo escribe expirarViajesColgados.
    await base.cambiar('viajes/' + idViaje, {
      estado: 'expirado', expiradoPor: 'sistema', motivoExpiracion: MOTIVO, fechaExpiracion: new Date().toISOString(),
    });
    await p.waitForTimeout(5000);
    await r.captura('ventanita');
    const conVentanita = await r.texto();
    const esperado = 'El sistema lo cerró: ' + MOTIVO + '. Si todavía lo necesitas, pide uno nuevo.';
    if (!/Este viaje ya se cerró/.test(conVentanita)) fallos.push('no salió la ventanita «Este viaje ya se cerró»: ' + conVentanita.slice(0, 200));
    if (!conVentanita.includes(esperado)) fallos.push('la ventanita no dice el porqué del servidor: ' + conVentanita.slice(0, 300));
    if (/CONDUCTOR EN CAMINO/.test(conVentanita)) fallos.push('sigue enseñando «CONDUCTOR EN CAMINO» de un viaje cerrado');

    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (!(await entendido.count())) fallos.push('la ventanita no tiene «Entendido»');
    else await entendido.first().click();
    await p.waitForTimeout(1200);
    await r.captura('fuera-del-viaje');
    const fuera = await r.texto();
    if (!/Volver al inicio/.test(fuera)) fallos.push('después de «Entendido» no queda «Volver al inicio»: ' + fuera.slice(0, 200));
    const volver = p.getByRole('button', { name: 'Volver al inicio' });
    if (await volver.count()) {
      await volver.first().click();
      await p.waitForTimeout(3000);
      await r.captura('inicio');
      if (!/¿QUÉ NECESITAS\?/.test(await r.texto())) fallos.push('«Volver al inicio» no llevó al inicio');
    }

    const v = await base.leer('viajes/' + idViaje);
    console.log('EN LA BASE:', idViaje, '·', v.estado, '·', v.expiradoPor, '·', v.motivoExpiracion);
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el pasajero sale del viaje que cerró el servidor, con la ventanita que dice por qué');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
