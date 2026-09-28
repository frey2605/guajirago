#!/usr/bin/env node
// 🤖 SALIR POR EL MENÚ (gemelo G07, 28-sep-2026) — entra como el taxista de prueba (taxi@gg.test), se pone
// disponible, y sale por «☰ Menú → Cerrar sesión». Luego mira en la BASE de pruebas su ficha (conductores/{uid}):
// tiene que quedar APAGADA (activo: false). Hasta el 28-sep-2026 el menú cerraba la sesión PRIMERO y después
// intentaba apagarlo: sin sesión esa escritura no entraba, la ficha se quedaba «activo» y el servidor le seguía
// mandando viajes a alguien que ya se había ido.
// Al final la ficha se deja como estaba.
//   node robot/salir-por-el-menu.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CORREO = 'taxi@gg.test';
const LAT = 11.5444;
const LNG = -72.9072;

(async () => {
  const fallos = [];
  const db = await entrarALaBase(CORREO);
  const ruta = 'conductores/' + db.uid;
  const antes = await db.leer(ruta).catch(() => ({}));
  console.log('FICHA ANTES:', JSON.stringify({ activo: antes.activo, enViajeId: antes.enViajeId, ocupado: antes.ocupado }));

  const r = await abrir('transporte', {
    nombre: 'salir-por-el-menu',
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
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }

    // ── Disponible ──
    const estado = p.getByText(/Estoy disponible|No disponible/).first();
    const interruptor = estado.locator('xpath=following-sibling::div[1]');
    if (/No disponible/.test(await estado.innerText())) { await interruptor.click(); await p.waitForTimeout(1000); }
    await p.waitForTimeout(6000);
    const enTurno = await db.leer(ruta);
    console.log('EN TURNO:', JSON.stringify({ activo: enTurno.activo }));
    if (enTurno.activo !== true) fallos.push('estando disponible, la ficha no dice activo: el recorrido no puede juzgar nada');
    await r.captura('disponible');

    // ── ☰ Menú → Cerrar sesión ──
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await r.captura('menu-abierto');
    await p.getByText('Cerrar sesión').first().click();
    await p.waitForTimeout(6000);
    await r.captura('despues-de-salir');
    const alSalir = await r.texto();
    const enLogin = /Ya tengo cuenta|Entrar a GuajiraGo|Crear cuenta/i.test(alSalir);
    console.log('PANTALLA AL SALIR:', enLogin ? 'la de entrar' : 'NO volvió a la de entrar');
    if (!enLogin) fallos.push('después de «Cerrar sesión» no volvió a la pantalla de entrar');

    const despues = await db.leer(ruta);
    console.log('FICHA AL SALIR:', JSON.stringify({ activo: despues.activo, ubicacion: despues.ubicacion ? 'guardada' : 'ninguna' }));
    if (despues.activo !== false) fallos.push('salió por el menú y su ficha sigue ACTIVA: el servidor le seguiría mandando viajes');
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    await r.cerrar();
    await db.cambiar(ruta, { activo: antes.activo ?? false });
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ al salir por el menú la ficha del conductor queda apagada y vuelve a la pantalla de entrar');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
