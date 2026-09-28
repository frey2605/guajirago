#!/usr/bin/env node
// 🤖 EL CONTACTO DE EMERGENCIA NO SE GUARDA SI NO SIRVE — gemelo G10 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test) → ☰ Menú → 🛡️ Seguridad, abre el número del contacto, escribe
// «300 123 45» (le faltan cifras) y toca «Guardar contacto». Tiene que:
//   1. decir en pantalla que el número debe tener 10 cifras;
//   2. NO guardarlo: al volver a entrar, el número guardado es el mismo de antes.
// Antes de G10 esta pantalla solo miraba que no estuviera vacío, y el 🚨 abría wa.me/5730012345, que no existe.
// No escribe nada en la base: el número malo no pasa la regla. (Si el pasajero no tiene contacto, se para: ese lo
// guarda el recorrido ubicacion-emergencia.)
//   node robot/contacto-emergencia.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';

async function entrarASeguridad(p) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', CORREO);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
  await p.getByText('Menú').first().click();
  await p.waitForTimeout(800);
  await p.getByText('Seguridad', { exact: true }).first().click();
  await p.waitForTimeout(3000);
}

// El número que la pantalla enseña guardado (el renglón del número cuando no se está editando).
const numeroEnPantalla = (p) => p.evaluate(() => {
  const spans = [...document.querySelectorAll('span')].map((s) => s.textContent.trim());
  return spans.find((t) => /^\+?[\d\s().-]{7,}$/.test(t)) || (spans.includes('Sin número') ? 'Sin número' : null);
});

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'contacto-emergencia' });
  const p = r.pagina;
  let antes = null; let error = ''; let despues = null;
  try {
    await entrarASeguridad(p);
    antes = await numeroEnPantalla(p);
    if (!antes || antes === 'Sin número') throw new Error('el pasajero de prueba no tiene contacto guardado: corre antes robot/ubicacion-emergencia.cjs');
    await r.captura('antes');

    await p.getByText('Editar').nth(1).click();
    await p.fill('input[placeholder="Ej: 3001234567"]', '300 123 45');
    await p.getByRole('button', { name: 'Guardar contacto' }).click();
    await p.waitForTimeout(2500);
    error = (await p.locator('p').allTextContents()).find((t) => /10 cifras/.test(t)) || '';
    await r.captura('despues-de-guardar');

    // Vuelve a entrar desde cero: lo que enseña ahora es lo que de verdad quedó en la base.
    await p.reload();
    await p.waitForTimeout(6000);
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Seguridad', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    despues = await numeroEnPantalla(p);
    await r.captura('al-volver');
  } finally {
    await r.cerrar();
  }

  console.log('GUARDADO ANTES:', antes, '· AVISO:', error || '(ninguno)', '· GUARDADO DESPUÉS:', despues, '· capturas', r.carpeta);
  if (!error) fallos.push('con «300 123 45» la pantalla no dijo que el número debe tener 10 cifras');
  if (despues !== antes) fallos.push('el número guardado cambió de «' + antes + '» a «' + despues + '»: se guardó uno que no sirve');
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ Seguridad no guarda un contacto de emergencia que no sirve, y dice por qué');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
