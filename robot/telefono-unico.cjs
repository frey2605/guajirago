#!/usr/bin/env node
// 🤖 MI PERFIL NO GUARDA UN TELÉFONO QUE NO SIRVE — gemelo G42 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test) → ☰ Menú → 👤 Mi perfil, abre el teléfono, escribe «abc» y
// toca «Guardar cambios». Tiene que:
//   1. decir en pantalla que el teléfono debe tener 10 cifras;
//   2. NO guardarlo: al volver a entrar, el teléfono es el mismo de antes.
// Antes de G42 Mi perfil solo miraba que no estuviera vacío: «abc» o «1» se guardaban como el teléfono de la persona.
// No escribe nada en la base: el teléfono malo no pasa la regla.
//   node robot/telefono-unico.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';

async function irAMiPerfil(p) {
  await p.getByText('Menú').first().click();
  await p.waitForTimeout(800);
  await p.getByText('Mi perfil', { exact: true }).first().click();
  await p.waitForTimeout(3000);
}

// El teléfono que la pantalla enseña guardado (el renglón del 📞 cuando no se está editando).
const telefonoEnPantalla = (p) => p.evaluate(() => {
  const spans = [...document.querySelectorAll('span')].map((s) => s.textContent.trim());
  const i = spans.indexOf('📞');
  return i >= 0 ? spans[i + 1] : null;
});

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'telefono-unico' });
  const p = r.pagina;
  let antes = null; let error = ''; let despues = null;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await irAMiPerfil(p);
    antes = await telefonoEnPantalla(p);
    await r.captura('antes');

    await p.getByText('Editar').nth(1).click();
    await p.fill('input[placeholder="Tu teléfono"]', 'abc');
    await p.getByRole('button', { name: 'Guardar cambios' }).click();
    await p.waitForTimeout(2500);
    error = (await p.locator('p').allTextContents()).find((t) => /10 cifras/.test(t)) || '';
    await r.captura('despues-de-guardar');

    // Vuelve a entrar desde cero: lo que enseña ahora es lo que de verdad quedó en la base.
    await p.reload();
    await p.waitForTimeout(6000);
    await irAMiPerfil(p);
    despues = await telefonoEnPantalla(p);
    await r.captura('al-volver');
  } finally {
    await r.cerrar();
  }

  console.log('TELÉFONO ANTES:', antes, '· AVISO:', error || '(ninguno)', '· TELÉFONO DESPUÉS:', despues, '· capturas', r.carpeta);
  if (!antes) fallos.push('no encontré el renglón del teléfono en Mi perfil');
  if (!error) fallos.push('con «abc» la pantalla no dijo que el teléfono debe tener 10 cifras');
  if (despues !== antes) fallos.push('el teléfono guardado cambió de «' + antes + '» a «' + despues + '»: se guardó uno que no sirve');
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ Mi perfil no guarda un teléfono que no sirve, y dice por qué');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
