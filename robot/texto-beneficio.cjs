#!/usr/bin/env node
// 🤖 EL BENEFICIO DE LA PROMOCIÓN DICE LO QUE SE COBRA — gemelo G52 (29-sep-2026). Contra PRUEBAS.
// Crea (como admin@gg.test) una promoción de mentira SIN tipo de beneficio (tipoBeneficio vacío) y valor 15. El que
// cobra (descuentos.cjs) la trata como un 15 %: solo «credito» resta pesos.
// 1. APP: pasajero@gg.test → «Menú» → «Promociones». La tarjeta tiene que decir «15% de descuento».
// 2. PANEL: superadmin → 🎁 Promociones → «Activas». La tarjeta tiene que decir «15% de descuento».
// Antes de G52 las dos decían «$ 15 de crédito» (preguntaban «¿es de descuento?» en vez de «¿es de crédito?»).
// Al final apaga la promoción (no se borra: lápidas).
//   node robot/texto-beneficio.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const HOY = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const ESPERADO = '15% de descuento';

(async () => {
  const fallos = [];
  const hora = Date.now().toString().slice(-6);
  const ID = 'ROBOT-G52-' + hora;
  const NOMBRE = 'Robot G52 beneficio ' + hora;
  const admin = await entrarALaBase('admin@gg.test');
  await admin.cambiar('promociones/' + ID, {
    nombre: NOMBRE, categoria: 'general', tipoBeneficio: '', valorBeneficio: 15, requiereCodigo: true,
    descripcion: 'Promoción de mentira del robot (G52)', aplicaA: 'ambos', fechaInicio: HOY, fechaFin: HOY,
    limiteUsosPorPersona: 1, viajesMinimosRequeridos: 0, activa: true, usosTotales: 0, inversionTotal: 0,
    creadoPor: 'robot', fechaCreacion: new Date().toISOString(),
  });
  // El texto que sigue al nombre en la tarjeta (el beneficio va justo debajo).
  const beneficioTrasElNombre = (nombre) => {
    const ps = [...document.querySelectorAll('p')];
    const i = ps.findIndex((x) => x.textContent.trim() === nombre);
    if (i < 0) return null;
    const v = ps.slice(i + 1, i + 4).find((x) => /de (crédito|descuento)/.test(x.textContent));
    return v ? v.textContent.trim() : '(sin beneficio)';
  };
  let enApp = null; let enPanel = null;
  try {
    // ── APP ──
    const a = await abrir('transporte', { nombre: 'texto-beneficio-app' });
    const q = a.pagina;
    try {
      await q.getByRole('button', { name: 'Ya tengo cuenta' }).click();
      await q.waitForTimeout(800);
      await q.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
      await q.fill('input[placeholder="Contraseña"]', claveDePruebas());
      await q.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
      await q.waitForTimeout(8000);
      await q.getByText('Menú').first().click();
      await q.waitForTimeout(800);
      await q.getByText('Promociones', { exact: true }).first().click();
      await q.waitForTimeout(4000);
      enApp = await q.evaluate(beneficioTrasElNombre, NOMBRE);
      await a.captura('promociones');
      console.log('APP · ERRORES:', a.errores.join(' || ') || 'ninguno', '· capturas', a.carpeta);
    } finally { await a.cerrar(); }

    // ── PANEL ──
    const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'texto-beneficio-panel' });
    const p = r.pagina;
    try {
      await p.locator('input[type="email"]').first().fill('admin@gg.test');
      await p.locator('input[type="password"]').first().fill(claveDePruebas());
      await p.getByText('Entrar al panel').click();
      await p.waitForTimeout(6000);
      await p.locator('button, div').filter({ hasText: /^🎁$/ }).last().click();
      await p.waitForTimeout(3000);
      await p.getByText('Activas', { exact: true }).first().click();
      await p.waitForTimeout(1500);
      enPanel = await p.evaluate(beneficioTrasElNombre, NOMBRE);
      await r.captura('activas');
      console.log('PANEL · ERRORES:', r.errores.join(' || ') || 'ninguno', '· capturas', r.carpeta);
    } finally { await r.cerrar(); }
  } finally {
    try { await admin.cambiar('promociones/' + ID, { activa: false }); } catch (e) { console.log('⚠ no pude apagar ' + ID + ': ' + e.message); }
  }

  console.log('APP:', enApp, '· PANEL (Activas):', enPanel);
  if (enApp === null) fallos.push('la app no ofrece la promoción de mentira');
  else if (enApp !== ESPERADO) fallos.push('la app pinta «' + enApp + '» y el cobro descuenta un 15 %');
  if (enPanel === null) fallos.push('el panel no pone la promoción en «Activas»');
  else if (enPanel !== ESPERADO) fallos.push('el panel pinta «' + enPanel + '» y el cobro descuenta un 15 %');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ la app y el panel dicen «' + ESPERADO + '», lo mismo que se cobra');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
