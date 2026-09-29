#!/usr/bin/env node
// 🤖 APROBAR RESPETA LO QUE SE APAGÓ EN COBROS — gemelo G49 (29-sep-2026).
// Antes, «✅ Aprobar» de 🍽️ Restaurantes y de 🧭 Turismo escribía además `activo: true`: si en 💳 Cobros se había
// apagado «La cuenta está viva», aprobar la volvía a encender. Ahora los tres botones usan una sola escritura
// (aprobarNegocio.js) que solo aprueba. Aquí, en PRUEBAS:
//   1. como superadmin de prueba (admin@gg.test) deja al Restaurante de Prueba suspendido (aprobado:false,
//      estadoAprobacion:'suspendido') y con la cuenta apagada (activo:false), como la deja Cobros;
//   2. el panel → 🍽️ Restaurantes → Restaurante de Prueba → «✅ Aprobar»;
//   3. en la base: tiene que quedar aprobado y `activo` tiene que seguir en false.
// Al final le devuelve al Restaurante de Prueba sus tres campos como estaban.
//   node robot/aprobar-negocio.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const RESTAURANTE = 'negocios/prueba-restaurante';

async function aprobarEnElPanel() {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'aprobar-negocio-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    await p.locator('button, div').filter({ hasText: /^🍽️$/ }).last().click();
    await p.waitForTimeout(5000);
    await p.getByText('Restaurante de Prueba', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    await r.captura('ficha-suspendido');
    await p.getByText('✅ Aprobar', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    await r.captura('ficha-aprobado');
    const texto = await r.texto();
    return { suspenderSale: texto.includes('🚫 Suspender'), errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const antes = await adm.leer(RESTAURANTE);
  const como = { aprobado: antes.aprobado, estadoAprobacion: antes.estadoAprobacion, activo: antes.activo };
  console.log('RESTAURANTE DE PRUEBA ANTES:', JSON.stringify(como), '· estadoComercial', antes.estadoComercial);
  let pa = { errores: [] };
  try {
    await adm.cambiar(RESTAURANTE, { aprobado: false, estadoAprobacion: 'suspendido', activo: false });
    pa = await aprobarEnElPanel();
    const d = await adm.leer(RESTAURANTE);
    console.log('DESPUÉS DE «✅ Aprobar»: aprobado', d.aprobado, '· estadoAprobacion', d.estadoAprobacion, '· activo', d.activo,
      '· estadoComercial', d.estadoComercial, '· la ficha ofrece «🚫 Suspender»:', pa.suspenderSale, '· capturas', pa.carpeta);
    if (d.aprobado !== true || d.estadoAprobacion !== 'aprobado') fallos.push('el botón no dejó aprobado al Restaurante de Prueba');
    if (!pa.suspenderSale) fallos.push('después de aprobar, la ficha no ofrece «🚫 Suspender»');
    if (d.activo !== false) fallos.push('aprobar volvió a encender «La cuenta está viva» (activo: ' + JSON.stringify(d.activo) + ') que se había apagado en Cobros');
    if (d.estadoComercial !== antes.estadoComercial) fallos.push('aprobar cambió estadoComercial: ' + JSON.stringify(antes.estadoComercial) + ' → ' + JSON.stringify(d.estadoComercial));
  } finally {
    const devolver = {};
    for (const k of Object.keys(como)) if (como[k] !== undefined) devolver[k] = como[k];
    await adm.cambiar(RESTAURANTE, devolver);
  }
  const fin = await adm.leer(RESTAURANTE);
  for (const k of Object.keys(como)) if (como[k] !== undefined && fin[k] !== como[k]) fallos.push('no pude devolverle «' + k + '» al Restaurante de Prueba');

  console.log('ERRORES DE LA PÁGINA:', pa.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ aprobar solo aprueba: la cuenta apagada en Cobros sigue apagada');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
