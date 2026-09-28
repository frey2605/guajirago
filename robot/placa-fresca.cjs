#!/usr/bin/env node
// 🤖 LA PLACA FRESCA (gemelo G09, 28-sep-2026) — entra como el taxista de prueba (taxi@gg.test), así la app deja su
// copia en el teléfono (localStorage). Luego el ADMIN de prueba le corrige la placa en la ficha `usuarios/{uid}` de la
// base de PRUEBAS —como haría el panel—, y la app se vuelve a abrir CON la copia puesta. Se mira:
//   1. qué placa enseña la pantalla del conductor, y
//   2. qué placa manda: la hoja `conductores/{uid}` que escribe su GPS lleva la misma placa que sus ofertas.
// Hasta el 28-sep-2026, con copia puesta la app no releía la ficha: enseñaba y mandaba la placa VIEJA hasta cerrar sesión.
// Al final la ficha y la hoja se dejan como estaban.
//   node robot/placa-fresca.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CORREO = 'taxi@gg.test';
const NUEVA = 'RB' + String(Date.now()).slice(-4);
const LAT = 11.5444;
const LNG = -72.9072;

(async () => {
  const fallos = [];
  const taxi = await entrarALaBase(CORREO);
  const admin = await entrarALaBase('admin@gg.test');
  const rutaFicha = 'usuarios/' + taxi.uid;
  const rutaHoja = 'conductores/' + taxi.uid;
  const ficha = await taxi.leer(rutaFicha);
  const hoja = await taxi.leer(rutaHoja).catch(() => ({}));
  console.log('ANTES:', JSON.stringify({ placaFicha: ficha.placa, placaHoja: hoja.placa, activo: hoja.activo }));
  if (!ficha.placa) { console.log('🔴 el taxista de prueba no tiene placa en su ficha: el recorrido no puede juzgar nada'); process.exit(1); }

  const r = await abrir('transporte', {
    nombre: 'placa-fresca',
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
  const alConductor = async () => {
    await p.getByText('Transporte y movilidad').click();
    await p.waitForTimeout(2000);
    await p.getByText('Soy conductor').click();
    await p.waitForTimeout(4000);
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }
  };
  try {
    // ── 1. Entrar: la app guarda su copia en el teléfono ──
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await alConductor();
    const copia = await p.evaluate(() => localStorage.getItem('guajirago_usuario'));
    console.log('COPIA EN EL TELÉFONO:', copia ? 'placa ' + (JSON.parse(copia).placa || '(vacía)') : 'NINGUNA');
    if (!copia) fallos.push('la app no dejó copia en el teléfono: el recorrido no puede juzgar nada');
    await r.captura('antes-de-corregir');

    // ── 2. El admin corrige la placa en la ficha, como el panel ──
    await admin.cambiar(rutaFicha, { placa: NUEVA });
    console.log('EL ADMIN CORRIGIÓ LA PLACA A:', NUEVA);

    // ── 3. Se vuelve a abrir la app CON la copia puesta ──
    await p.reload();
    await p.waitForTimeout(6000);
    await alConductor();
    await p.waitForTimeout(3000);
    await r.captura('despues-de-abrir');
    const texto = await r.texto();
    const enseña = texto.includes(NUEVA) ? NUEVA : texto.includes(ficha.placa) ? ficha.placa : '(ninguna)';
    console.log('LA PANTALLA ENSEÑA LA PLACA:', enseña);
    if (enseña !== NUEVA) fallos.push('con copia puesta, la pantalla enseña «' + enseña + '» y la ficha dice «' + NUEVA + '»');

    // ── 4. Lo que manda: disponible, el GPS escribe la hoja con su placa ──
    const estado = p.getByText(/Estoy disponible|No disponible/).first();
    const interruptor = estado.locator('xpath=following-sibling::div[1]');
    if (/No disponible/.test(await estado.innerText())) { await interruptor.click(); await p.waitForTimeout(1000); }
    await p.waitForTimeout(8000);
    const enTurno = await taxi.leer(rutaHoja);
    console.log('LA HOJA QUE ESCRIBE SU GPS LLEVA:', enTurno.placa);
    if (enTurno.placa !== NUEVA) fallos.push('el teléfono MANDA la placa «' + enTurno.placa + '» y la ficha dice «' + NUEVA + '»');
    if (/No disponible/.test(await estado.innerText()) === false) { await interruptor.click(); await p.waitForTimeout(3000); }
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    await r.cerrar();
    // Se deja todo como estaba.
    await admin.cambiar(rutaFicha, { placa: ficha.placa });
    await taxi.cambiar(rutaHoja, { placa: hoja.placa ?? ficha.placa, activo: hoja.activo ?? false });
    const quedo = await taxi.leer(rutaFicha);
    console.log('FICHA AL FINAL:', quedo.placa, quedo.placa === ficha.placa ? '(como estaba)' : '🔴 NO quedó como estaba');
    if (quedo.placa !== ficha.placa) fallos.push('la ficha no quedó como estaba');
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ con la copia del teléfono puesta, la app enseña y manda la placa que dice la ficha');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
