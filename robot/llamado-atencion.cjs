#!/usr/bin/env node
// 🤖 EL LLAMADO DE ATENCIÓN — gemelo G37 (28-sep-2026).
// Hasta el G37 la pantalla del pasajero (Home.js) pintaba la ventanita «MENSAJE DE GUAJIRAGO» DOS veces, una encima
// de otra, y se cerraba aunque «Entendido» no hubiera llegado a la base. Ahora la pinta LlamadoAtencion.js, la misma
// pieza del conductor. Este recorrido, en PRUEBAS:
//   1. como superadmin de prueba (admin@gg.test) le deja al pasajero de prueba un llamado sin ver (como el panel);
//   2. el pasajero entra: exige la ventanita UNA sola vez, con el botón en «Lee el mensaje completo...»;
//   3. a los 8 s el botón dice «Entendido ✓». Se corta la señal y se toca: exige que NO se cierre y que, pasado el
//      tope del candado (20 s), diga «No se pudo confirmar» DENTRO de la ventanita del llamado;
//   4. vuelve la señal: la escritura entra tarde, la ventanita se cierra sola y en la base el llamado queda leído.
// Al final el campo del pasajero queda como estaba (o en null si no lo tenía: la app lee los dos igual).
//   node robot/llamado-atencion.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const TEXTO = 'Robot G37: llamado de prueba, no es de verdad.';

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const pas = await entrarALaBase('pasajero@gg.test');
  const ruta = 'usuarios/' + pas.uid;
  const antes = (await pas.leer(ruta)).llamadoPendiente;
  let r = null;
  const cuantas = async (p) => p.getByText('MENSAJE DE GUAJIRAGO', { exact: true }).count();
  try {
    await adm.cambiar(ruta, { llamadoPendiente: TEXTO });
    console.log('llamado sin ver puesto al pasajero de PRUEBAS (antes:', JSON.stringify(antes ?? null) + ')');

    r = await abrir('transporte', { nombre: 'llamado-atencion' });
    const p = r.pagina;
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(6000);
    for (const paso of ['Transporte y movilidad', 'Soy pasajero']) {
      const x = p.getByText(paso, { exact: true });
      if (await x.count()) { await x.first().click(); await p.waitForTimeout(2500); }
    }
    await p.getByText(TEXTO).first().waitFor({ timeout: 15000 }).catch(() => {});

    // ── 2: una sola ventanita ──
    const n = await cuantas(p);
    const leer = await p.getByText('Lee el mensaje completo...').count();
    await r.captura('llamado-recien-llega');
    console.log('VENTANITAS «MENSAJE DE GUAJIRAGO»:', n, '· botón «Lee el mensaje completo...»:', leer);
    if (n !== 1) fallos.push('la ventanita del llamado se pinta ' + n + ' veces (tiene que ser 1)');
    if (!leer) fallos.push('al llegar, el botón no dice «Lee el mensaje completo...»');

    // ── 3: sin señal, «Entendido» no cierra y lo dice ──
    await p.getByText('Entendido ✓').first().waitFor({ timeout: 12000 });
    await p.context().setOffline(true);
    await p.getByText('Entendido ✓').first().click();
    await p.waitForTimeout(1500);
    const trabajando = await p.getByText('Un momento…').count();
    console.log('AL TOCAR SIN SEÑAL, EL BOTÓN DICE «Un momento…»:', trabajando ? 'sí' : 'no');
    if (!trabajando) fallos.push('al tocar «Entendido», el botón no dice «Un momento…»');
    await p.getByText(/No se pudo confirmar/).first().waitFor({ timeout: 26000 }).catch(() => {});
    const dice = await p.getByText(/No se pudo confirmar/).count();
    const sigue = await cuantas(p);
    await r.captura('sin-senal-no-se-cierra');
    console.log('SIN SEÑAL, PASADO EL TOPE: dice «No se pudo confirmar»:', dice ? 'sí' : 'no', '· la ventanita del llamado sigue:', sigue ? 'sí' : 'no');
    if (!dice) fallos.push('sin señal, pasado el tope del candado, no dice «No se pudo confirmar»');
    if (sigue !== 1) fallos.push('sin señal, la ventanita del llamado se cerró como si hubiera quedado leído');

    // ── 4: vuelve la señal: entra tarde y se cierra sola ──
    await p.context().setOffline(false);
    let cerrada = false;
    for (let i = 0; i < 20 && !cerrada; i += 1) { await p.waitForTimeout(1500); cerrada = (await cuantas(p)) === 0; }
    await r.captura('con-senal-se-cierra');
    const despues = (await pas.leer(ruta)).llamadoPendiente;
    console.log('CON SEÑAL: la ventanita se cerró sola:', cerrada ? 'sí' : 'no', '· en la base llamadoPendiente =', JSON.stringify(despues ?? null));
    if (!cerrada) fallos.push('al volver la señal y entrar la escritura, la ventanita no se cerró');
    if (despues) fallos.push('en la base el llamado sigue sin ver: ' + JSON.stringify(despues));
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    if (r) await r.cerrar();
    await adm.cambiar(ruta, { llamadoPendiente: antes ?? null })
      .catch((e) => console.log('⚠ no pude devolver el llamadoPendiente del pasajero:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el llamado sale una vez; sin señal «Entendido» no lo cierra y dice «No se pudo confirmar»; con señal entra y se cierra solo');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
