#!/usr/bin/env node
// 🤖 LA PROMOCIÓN DICE EL DÍA QUE ES, Y ESTÁ VIGENTE HOY EN COLOMBIA — gemelo G16 (28-sep-2026). Contra PRUEBAS.
// Crea (como admin@gg.test) una promoción de mentira que dura UN solo día: HOY en Colombia (inicio = fin = hoy).
// 1. APP: entra como pasajero@gg.test → «Menú» → «Promociones». La promoción tiene que salir en la lista (está
//    vigente hoy) y su «Válida hasta» tiene que decir el día de HOY. Antes de G16 decía AYER: la app leía
//    «2026-09-28» como medianoche UTC, que en Colombia son las 7 de la noche del día anterior.
// 2. PANEL: entra como superadmin → 🎁 Promociones → «Activas». La promoción tiene que estar ahí y su rango tiene
//    que decir «hoy → hoy». Antes de G16 decía «ayer → ayer».
// Lo que el robot NO puede probar aquí: las 7 de la noche (el reloj del servidor no se mueve); eso lo EJECUTA
// pruebas/vigenciaHoy.test.js en cuatro zonas horarias.
// Al final apaga la promoción (no se borra: lápidas).
//   node robot/vigencia-promo.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

// Hoy en Colombia (UTC−5 todo el año), AAAA-MM-DD, y su día del mes.
const HOY = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const DIA = Number(HOY.slice(8, 10));
const MES = Number(HOY.slice(5, 7));
// «28/9/2026» o «28/09/2026»: el primer número es el día y el segundo el mes.
const esHoy = (t) => { const m = /(\d{1,2})\/(\d{1,2})\/\d{4}/.exec(t || ''); return !!m && Number(m[1]) === DIA && Number(m[2]) === MES; };

(async () => {
  const fallos = [];
  const hora = Date.now().toString().slice(-6);
  const ID = 'ROBOT-G16-' + hora;
  const NOMBRE = 'Robot G16 hoy ' + hora;
  const admin = await entrarALaBase('admin@gg.test');
  await admin.cambiar('promociones/' + ID, {
    nombre: NOMBRE, categoria: 'transporte', tipoBeneficio: 'credito', valorBeneficio: 1000, requiereCodigo: true,
    descripcion: 'Promoción de mentira del robot (G16)', aplicaA: 'ambos', fechaInicio: HOY, fechaFin: HOY,
    limiteUsosPorPersona: 1, viajesMinimosRequeridos: 0, activa: true, usosTotales: 0, inversionTotal: 0,
    creadoPor: 'robot', fechaCreacion: new Date().toISOString(),
  });
  let enApp = null; let enPanel = null; let zona = '';
  try {
    // ── APP ──
    const a = await abrir('transporte', { nombre: 'vigencia-promo-app' });
    const q = a.pagina;
    try {
      zona = await q.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
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
      enApp = await q.evaluate((nombre) => {
        const ps = [...document.querySelectorAll('p')];
        const i = ps.findIndex((x) => x.textContent.trim() === nombre);
        if (i < 0) return null;
        const v = ps.slice(i, i + 8).find((x) => x.textContent.includes('Válida hasta'));
        return v ? v.textContent.trim() : '(sin «Válida hasta»)';
      }, NOMBRE);
      await a.captura('promociones');
      console.log('APP · ERRORES:', a.errores.join(' || ') || 'ninguno', '· capturas', a.carpeta);
    } finally { await a.cerrar(); }

    // ── PANEL ──
    const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'vigencia-promo-panel' });
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
      enPanel = await p.evaluate((nombre) => {
        const ps = [...document.querySelectorAll('p')];
        const i = ps.findIndex((x) => x.textContent.trim() === nombre);
        if (i < 0) return null;
        const v = ps.slice(i, i + 8).find((x) => x.textContent.includes('→'));
        return v ? v.textContent.trim() : '(sin rango)';
      }, NOMBRE);
      await r.captura('activas');
      console.log('PANEL · ERRORES:', r.errores.join(' || ') || 'ninguno', '· capturas', r.carpeta);
    } finally { await r.cerrar(); }
  } finally {
    try { await admin.cambiar('promociones/' + ID, { activa: false }); } catch (e) { console.log('⚠ no pude apagar ' + ID + ': ' + e.message); }
  }

  console.log('ZONA DEL NAVEGADOR:', zona, '· HOY EN COLOMBIA:', HOY, '· APP:', enApp, '· PANEL (Activas):', enPanel);
  if (zona !== 'America/Bogota') fallos.push('el navegador no está en hora de Colombia (' + zona + '): así no se ve el fallo');
  if (enApp === null) fallos.push('la app no ofrece la promoción que vence HOY');
  else if (!esHoy(enApp)) fallos.push('la app dice «' + enApp + '» y la promoción vence hoy, ' + HOY);
  if (enPanel === null) fallos.push('el panel no pone en «Activas» la promoción que vence HOY');
  else {
    const partes = enPanel.split('→');
    if (partes.length !== 2 || !esHoy(partes[0]) || !esHoy(partes[1])) fallos.push('el panel pinta «' + enPanel + '» y la promoción es de hoy, ' + HOY);
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ la promoción de hoy sale vigente en la app y en el panel, y las dos dicen el día de hoy');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
