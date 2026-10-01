#!/usr/bin/env node
// 🤖 SIN PERMISO DE AVISOS, AL PASAJERO SE LE DICE — P23 (1-oct-2026).
// Entra como el pasajero de prueba (pasajero@gg.test), pide un Taxi en PRUEBAS con un GPS de mentira y exige que, al
// llegar a la pantalla de espera, salga la ventanita «Así no te van a llegar las ofertas» (el navegador del robot no da
// permiso de avisos: es justo el caso del pasajero que lo bloquea). La cierra con «Entendido», comprueba que la pantalla
// de espera sigue ahí, y cancela el viaje con «Otro motivo» para no dejarlo vivo.
// Lo que el robot NO puede probar: el caso con permiso (el token pegado en la ficha y el aviso que llega). Eso lo
// EJECUTA pruebas/tokenDelPasajero.test.js con la nube de mentira.
// Deja en pruebas UN viaje, ya cancelado.
//   node robot/aviso-ofertas.cjs
const { abrir, cerrarAvisoDeOfertas, claveDePruebas, entrarALaBase } = require('./comun.cjs');

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
}) + ')(' + LAT + ',' + LNG + ');';

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'aviso-ofertas', antesDeCargar });
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
    const permiso = await p.evaluate(() => (typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission));
    console.log('PERMISO DE AVISOS DEL NAVEGADOR DEL ROBOT:', permiso);
    await p.getByText('Taxi', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.fill('input[placeholder="¿Dónde estás? (Riohacha)"]', 'Calle 1 # 1-1 prueba del robot P23');
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /^Solicitar Taxi/ }).click();
    await p.waitForTimeout(6000);
    await r.captura('ventanita');
    const t = await r.texto();
    const salio = /Así no te van a llegar las ofertas/.test(t);
    console.log('VENTANITA DEL PASAJERO:', salio ? 'sale' : 'NO sale');
    if (!salio) fallos.push('sin permiso de avisos, al pasajero no se le dice que no le van a llegar las ofertas');
    if (salio && !/ofertas de los conductores|ver las ofertas/.test(t)) fallos.push('la ventanita no dice qué se pierde: ' + t.slice(0, 200));
    if (/sonar los viajes/.test(t)) fallos.push('al pasajero le sale el texto del conductor');
    if (/\b(FCM|token|denied|granted)\b/.test(t)) fallos.push('la pantalla pinta palabras técnicas');
    const cerro = await cerrarAvisoDeOfertas(p, 1000);
    if (salio && !cerro) fallos.push('la ventanita no se cierra con «Entendido»');
    await r.captura('esperando');
    const cancelar = p.getByRole('button', { name: 'Cancelar viaje', exact: true });
    if (!(await cancelar.count())) throw new Error('después de la ventanita no estoy en la pantalla de espera: ' + (await r.texto()).slice(0, 200));
    await cancelar.first().click();
    await p.waitForTimeout(1200);
    await p.getByRole('button', { name: /Otro motivo/ }).click();
    await p.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await p.waitForTimeout(5000);

    // En la base: el viaje quedó cancelado, y ni el viaje ni su cajón llevan token (sin permiso no se escribe nada).
    const base = await entrarALaBase(CORREO);
    const ids = [...vistos];
    if (ids.length !== 1) fallos.push('esperaba que la app escribiera en UN viaje y nombró ' + ids.length);
    if (ids[0]) {
      const v = await base.leer('viajes/' + ids[0]);
      console.log('EN LA BASE:', ids[0], '·', v.estado, '·', v.canceladoPor);
      if (v.estado !== 'cancelado') fallos.push('el viaje de la prueba no quedó cancelado: ' + v.estado);
      if ('pasajeroFcmToken' in v) fallos.push('el viaje del mercado lleva un token');
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ sin permiso de avisos, al pasajero se le dice en una ventanita y puede seguir');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
