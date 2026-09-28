#!/usr/bin/env node
// 🤖 EL CONDUCTOR EN TURNO — entra como el taxista de prueba (taxi@gg.test), con un GPS de mentira, y
// mira en la BASE de pruebas qué le pasa a su ficha (conductores/{uid}) mientras trabaja:
//   1. Antes de abrir la app se le pone a la ficha una marca de viaje en curso (enViajeId, ocupado),
//      como la que pone el servidor al confirmarlo.
//   2. Con la app abierta y disponible, el GPS escribe su posición: la posición tiene que llegar Y la
//      marca tiene que seguir ahí. Hasta el 27-sep-2026 (G02) cada lectura del GPS reescribía la ficha
//      entera y la borraba.
//   3. Al tocar «No disponible»: queda apagado, se quita la ubicación y la marca sigue.
// Al final la ficha se deja como estaba (la marca y la disponibilidad de antes).
//   node robot/conductor-en-turno.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CORREO = 'taxi@gg.test';
const MARCA = 'robot-en-turno-' + Date.now();
// Un punto de Riohacha que cambia en cada vuelta, para saber que la posición es de ESTA vuelta.
const LAT = Number((11.54 + Math.random() / 100).toFixed(6));
const LNG = -72.9072;

(async () => {
  const fallos = [];
  const db = await entrarALaBase(CORREO);
  const ruta = 'conductores/' + db.uid;
  const antes = await db.leer(ruta).catch(() => ({}));
  console.log('FICHA ANTES:', JSON.stringify({ activo: antes.activo, enViajeId: antes.enViajeId, ocupado: antes.ocupado, token: !!antes.fcmToken }));
  await db.cambiar(ruta, { enViajeId: MARCA, ocupado: true });

  const r = await abrir('transporte', {
    nombre: 'conductor-en-turno',
    // Va como TEXTO para llevar dentro la coordenada de esta vuelta (el motor no pasa argumentos).
    antesDeCargar: '(' + ((lat, lng) => {
      const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
      const geo = {
        getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 300),
        watchPosition: (ok) => { setTimeout(() => ok(pos()), 500); return 1; },
        clearWatch: () => {},
      };
      Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
    }) + ')(' + LAT + ',' + LNG + ');',
  });
  const p = r.pagina;
  try {
    // ── Entrar como el taxista de prueba → Transporte → Soy conductor ──
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Transporte y movilidad').click();
    await p.waitForTimeout(2000);
    await p.getByText('Soy conductor').click();
    await p.waitForTimeout(4000);

    // ── Sin permiso de avisos (el navegador del robot no lo da): se le dice en una ventanita (27-sep-2026) ──
    const alEntrar = await r.texto();
    await r.captura('al-entrar');
    const ventanita = /Así no te van a sonar los viajes/.test(alEntrar);
    console.log('SIN PERMISO DE AVISOS:', ventanita ? 'sale la ventanita' : 'NO avisa', /FCM:/.test(alEntrar) ? '· y pinta el registro técnico «FCM:»' : '');
    if (!ventanita) fallos.push('sin permiso de avisos, la app no se lo dice al conductor');
    if (/FCM:/.test(alEntrar)) fallos.push('la pantalla pinta el registro técnico «FCM: …»');
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }

    // ── Disponible (si no lo está, se toca el interruptor) ──
    const estado = p.getByText(/Estoy disponible|No disponible/).first();
    const interruptor = estado.locator('xpath=following-sibling::div[1]');
    if (/No disponible/.test(await estado.innerText())) { await interruptor.click(); await p.waitForTimeout(1000); }
    await p.waitForTimeout(8000);
    await r.captura('disponible');
    const enTurno = await db.leer(ruta);
    const llego = enTurno.ubicacion && Math.abs(enTurno.ubicacion.lat - LAT) < 1e-6;
    console.log('EN TURNO:', JSON.stringify({ activo: enTurno.activo, posicion: llego ? 'la de esta vuelta' : (enTurno.ubicacion || 'ninguna'), enViajeId: enTurno.enViajeId, ocupado: enTurno.ocupado, token: !!enTurno.fcmToken }));
    if (!llego) fallos.push('la posición del GPS no llegó a la ficha: el recorrido no puede juzgar nada');
    if (enTurno.activo !== true) fallos.push('estando disponible, la ficha no dice activo');
    if (enTurno.enViajeId !== MARCA || enTurno.ocupado !== true) fallos.push('el GPS BORRÓ la marca del viaje en curso (enViajeId/ocupado): un segundo pasajero podría confirmarlo');
    if (antes.fcmToken && enTurno.fcmToken !== antes.fcmToken && !enTurno.fcmToken) fallos.push('el GPS borró el token de avisos');

    // ── No disponible ──
    await interruptor.click();
    await p.waitForTimeout(5000);
    await r.captura('no-disponible');
    const apagado = await db.leer(ruta);
    console.log('APAGADO:', JSON.stringify({ activo: apagado.activo, ubicacion: apagado.ubicacion || 'quitada', enViajeId: apagado.enViajeId, ocupado: apagado.ocupado, token: !!apagado.fcmToken }));
    if (apagado.activo !== false) fallos.push('al tocar «No disponible» la ficha sigue activa');
    if (apagado.ubicacion) fallos.push('fuera de turno se quedó guardada la ubicación');
    if (apagado.enViajeId !== MARCA) fallos.push('al apagarse se BORRÓ la marca del viaje en curso');
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    await r.cerrar();
    // Se deja la ficha como estaba: la marca, ocupado y la disponibilidad de antes.
    await db.cambiar(ruta, { enViajeId: antes.enViajeId ?? null, ocupado: antes.ocupado ?? false, activo: antes.activo ?? false });
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el GPS del conductor escribe su posición sin borrarle el viaje en curso, y al apagarse se quita la ubicación');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
