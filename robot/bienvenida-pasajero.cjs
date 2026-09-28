#!/usr/bin/env node
// 🤖 EL CRÉDITO DE BIENVENIDA LO DA EL SERVIDOR — gemelo G18 (28-sep-2026).
// Crea una cuenta NUEVA de pasajero en pruebas, como una persona, y comprueba:
//   1. sale la celebración «¡Bienvenido a GuajiraGo!» con el crédito que dio el servidor ($ 8.000);
//   2. la ficha guardada lleva el descuento pendiente FIRMADO por el servidor (fabricadoPor: 'servidor'), con un código
//      de 4 cifras. Antes de G18 lo fabricaba el teléfono: el valor, el código y la huella del aparato.
// Dice también cuántos segundos tardó en salir la celebración (la función puede estar fría).
// Escribe en la base de pruebas lo mismo que cualquier registro: una cuenta nueva con su ficha.
//   node robot/bienvenida-pasajero.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const marca = Date.now();
const correo = 'robot.pasajero.' + marca + '@gg.test';

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'bienvenida-pasajero' });
  const p = r.pagina;
  let segundos = null; let celebracion = ''; let ficha = null;
  try {
    await p.getByRole('button', { name: 'Crear cuenta' }).click();
    await p.fill('input[placeholder="NOMBRE COMPLETO"]', 'Robot Pasajero De Prueba');
    await p.fill('input[placeholder="Correo electrónico"]', correo);
    await p.fill('input[placeholder="Confirmar correo electrónico"]', correo);
    // El celular NO se puede repetir entre cuentas (ver APRENDIDO.md): uno distinto cada vez.
    await p.locator('input[placeholder="3001234567"]').first().fill('302' + String(marca).slice(-7));
    const fecha = p.locator('select');
    await fecha.nth(0).selectOption({ index: 5 });
    await fecha.nth(1).selectOption({ index: 3 });
    await fecha.nth(2).selectOption({ index: 10 });
    await p.fill('input[placeholder="Contraseña (mínimo 6 caracteres)"]', claveDePruebas());
    await p.fill('input[placeholder="Confirmar contraseña"]', claveDePruebas());
    if (await p.locator('input[placeholder="Nombre del contacto"]').count()) {
      await p.fill('input[placeholder="Nombre del contacto"]', 'Contacto Robot');
      await p.locator('input[placeholder="3001234567"]').nth(1).fill('301' + String(marca).slice(-7));
    }
    // Los términos NO son una casilla normal: es un cuadrito al lado del texto (ver APRENDIDO.md).
    await p.locator('div', { has: p.getByText('Términos y condiciones', { exact: true }) }).last().locator('> div').first().click();
    const inicio = Date.now();
    await p.getByRole('button', { name: /Crear cuenta/ }).last().click();
    const vamos = p.getByText(/¡Vamos!/);
    try {
      await vamos.first().waitFor({ timeout: 15000 });
      segundos = ((Date.now() - inicio) / 1000).toFixed(1);
      celebracion = await r.texto();
      await r.captura('celebracion');
      await vamos.first().click();
    } catch (e) {
      await r.captura('sin-celebracion');
      fallos.push('no salió la celebración de bienvenida en 15 s: ' + (await r.texto()).slice(0, 160));
    }
    await p.waitForTimeout(1500);
  } finally {
    await r.cerrar();
  }

  if (celebracion && !/\$\s?8\.000/.test(celebracion)) fallos.push('la celebración no dice $ 8.000: ' + celebracion.slice(0, 200));
  try {
    const base = await entrarALaBase(correo);
    ficha = await base.leer('usuarios/' + base.uid);
  } catch (e) {
    fallos.push('no pude leer la ficha nueva: ' + e.message);
  }
  const d = (ficha && ficha.descuentoPendiente) || null;
  console.log('CUENTA:', correo, '· CELEBRACIÓN EN:', segundos ? segundos + ' s' : '(no salió)',
    '· DESCUENTO EN LA FICHA:', JSON.stringify(d), '· capturas', r.carpeta);
  if (!d) fallos.push('la ficha nueva no tiene descuento pendiente');
  else {
    if (d.fabricadoPor !== 'servidor') fallos.push('el descuento de la ficha NO lo firmó el servidor: lo fabricó el teléfono');
    if (d.valorBeneficio !== 8000 || d.promoId !== 'BIENVENIDA' || d.tipoBeneficio !== 'credito') fallos.push('el descuento no es el crédito de bienvenida de $8.000');
    if (!/^[1-9][0-9]{3}$/.test(String(d.codigoVerificacion))) fallos.push('el código no es de 4 cifras: ' + d.codigoVerificacion);
  }
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la bienvenida del pasajero la da el servidor ($ 8.000, firmada) y la pantalla enseña lo que él dio');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
