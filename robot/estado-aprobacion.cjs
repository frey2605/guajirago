#!/usr/bin/env node
// 🤖 EL SUSPENDIDO NO SALE COMO PENDIENTE — gemelo G50 (29-sep-2026).
// Antes, 🤝 Aliados pendientes del panel solo miraba «rechazado»: un negocio SUSPENDIDO salía ahí como un registro
// nuevo por revisar (sin etiqueta, en naranja, con «Rechazar» y «✅ Aprobar»). Ahora las tres listas del panel sacan el
// estado de una sola regla (estadoDeAprobacion, en aprobarNegocio.js). Aquí, en PRUEBAS:
//   1. como superadmin de prueba (admin@gg.test) deja al Restaurante de Prueba suspendido (aprobado:false,
//      estadoAprobacion:'suspendido'), como lo deja «🚫 Suspender»;
//   2. el panel → 🤝 Aliados pendientes → la tarjeta del Restaurante de Prueba;
//   3. tiene que decir «SUSPENDIDO» y ofrecer «Reactivar y aprobar», y NO «Rechazar» ni «✅ Aprobar» como a uno nuevo.
// No pulsa ningún botón. Al final le devuelve al Restaurante de Prueba sus dos campos como estaban.
//   node robot/estado-aprobacion.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const RESTAURANTE = 'negocios/prueba-restaurante';

async function mirarAliadosPendientes() {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'estado-aprobacion-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Superadmin es el 👑, y dentro, «Aliados pendientes» va con su nombre.
    await p.locator('button, div').filter({ hasText: /^👑$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Aliados pendientes', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    await r.captura('aliados-pendientes');
    // La tarjeta: el último div que tiene el nombre Y algún botón (dentro, la cabecera tiene el nombre y la fila de
    // botones tiene los botones; solo la tarjeta tiene las dos cosas).
    const tarjeta = p.locator('div').filter({ hasText: 'Restaurante de Prueba' }).filter({ has: p.locator('button') }).last();
    if (!(await tarjeta.count())) return { sale: false, errores: r.errores, carpeta: r.carpeta };
    const texto = await tarjeta.innerText();
    const botones = (await tarjeta.locator('button').allInnerTexts()).map((b) => b.trim());
    return { sale: true, texto, botones, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const antes = await adm.leer(RESTAURANTE);
  const como = { aprobado: antes.aprobado, estadoAprobacion: antes.estadoAprobacion };
  console.log('RESTAURANTE DE PRUEBA ANTES:', JSON.stringify(como));
  let v = { errores: [] };
  try {
    await adm.cambiar(RESTAURANTE, { aprobado: false, estadoAprobacion: 'suspendido' });
    v = await mirarAliadosPendientes();
    console.log('TARJETA EN 🤝 ALIADOS PENDIENTES:', v.sale ? JSON.stringify(v.texto.split('\n').slice(0, 3)) + ' · botones: ' + v.botones.join(' / ') : '(no sale)', '· capturas', v.carpeta);
    if (!v.sale) fallos.push('el Restaurante de Prueba suspendido no sale en 🤝 Aliados pendientes');
    else {
      if (!/SUSPENDIDO/.test(v.texto)) fallos.push('la tarjeta del suspendido no dice «SUSPENDIDO»: se ve como un registro nuevo');
      if (v.botones.includes('Rechazar')) fallos.push('al suspendido se le ofrece «Rechazar», como a un registro nuevo');
      if (!v.botones.includes('Reactivar y aprobar')) fallos.push('al suspendido no se le ofrece «Reactivar y aprobar» (botones: ' + v.botones.join(' / ') + ')');
    }
  } finally {
    const devolver = {};
    for (const k of Object.keys(como)) if (como[k] !== undefined) devolver[k] = como[k];
    await adm.cambiar(RESTAURANTE, devolver);
  }
  const fin = await adm.leer(RESTAURANTE);
  for (const k of Object.keys(como)) if (como[k] !== undefined && fin[k] !== como[k]) fallos.push('no pude devolverle «' + k + '» al Restaurante de Prueba');

  console.log('ERRORES DE LA PÁGINA:', v.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el suspendido sale como suspendido: con su etiqueta y «Reactivar y aprobar»');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
