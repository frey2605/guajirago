#!/usr/bin/env node
// 🤖 «PEDIDOS HOY» DEL PANEL CUENTA LOS DOMICILIOS — gemelo G48 (29-sep-2026).
// El domicilio de la app guarda su hora como Timestamp del servidor, y el panel la leía con `new Date(...)`, que con un
// Timestamp da «Invalid Date»: «🧾 N pedidos hoy» no contaba NINGÚN domicilio. Aquí, en PRUEBAS:
//   1. el panel (admin@gg.test) → 🍽️ Restaurantes: se lee «🧾 N pedidos hoy» del Restaurante de Prueba;
//   2. el pasajero de prueba (pasajero@gg.test) → Restaurantes → Restaurante de Prueba: echa un plato, escribe dirección
//      y teléfono, paga en efectivo y PIDE (un pedido de verdad en la base de pruebas); después lo cancela él mismo
//      (así el restaurante no tiene que atenderlo);
//   3. el panel otra vez: tiene que decir N + 1, y la fecha de ese pedido en la ficha no puede salir «—».
//   node robot/fecha-pedido.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

async function leerPanel(nombre, abrirFicha) {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'fecha-pedido-panel-' + nombre });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    await p.locator('button, div').filter({ hasText: /^🍽️$/ }).last().click();
    await p.waitForTimeout(5000);
    await r.captura('lista');
    const hoy = await p.evaluate(() => {
      const nodos = [...document.querySelectorAll('p, span')];
      const i = nodos.findIndex((x) => x.textContent.trim() === 'Restaurante de Prueba');
      if (i < 0) return null;
      const f = nodos.slice(i, i + 12).find((x) => /^🧾 \d+ pedidos hoy$/.test(x.textContent.trim()));
      return f ? Number(f.textContent.trim().match(/\d+/)[0]) : null;
    });
    let fechas = null;
    if (abrirFicha) {
      await p.getByText('Restaurante de Prueba', { exact: true }).first().click();
      await p.waitForTimeout(3000);
      await r.captura('ficha');
      // Las filas de pedidos de la ficha dicen «<fecha> · <estado>»: se leen las fechas.
      fechas = await p.evaluate(() => [...document.querySelectorAll('p')]
        .map((x) => x.textContent.trim())
        .filter((t) => /\s·\s*(nuevo|cancelado|confirmado|preparando|empacado|en_camino|entregado|cerrado|tomado|—)$/.test(t))
        .map((t) => t.split(/\s·/)[0].trim()));
    }
    return { hoy, fechas, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function pedirDomicilio() {
  const r = await abrir('transporte', { nombre: 'fecha-pedido-cliente' });
  const p = r.pagina;
  const paso = { pidio: false, cancelo: false };
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Restaurantes', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByText('Restaurante de Prueba').first().click();
    await p.waitForTimeout(3000);
    // Dos jugos de corozo ($ 5.000 cada uno): el pedido mínimo del restaurante de prueba es $ 10.000.
    await p.getByText('+', { exact: true }).last().click();
    await p.waitForTimeout(1500);
    await p.getByText('+', { exact: true }).last().click();
    await p.waitForTimeout(1000);
    await p.fill('input[placeholder="📍 Dirección de entrega"]', 'Calle Robot G48 #1-2');
    await p.fill('input[placeholder="📞 Tu teléfono (obligatorio · 10 dígitos)"]', '3004804848');
    await p.getByText('Efectivo', { exact: true }).first().click();
    await p.waitForTimeout(500);
    await r.captura('carrito');
    await p.getByRole('button', { name: /^Pedir \d+ item/ }).click();
    await p.waitForTimeout(6000);
    await r.captura('pedido');
    const cancelar = p.getByRole('button', { name: '✕ Cancelar pedido' });
    paso.pidio = (await cancelar.count()) > 0;
    if (paso.pidio) {
      await cancelar.first().click();
      await p.waitForTimeout(4000);
      await r.captura('cancelado');
      paso.cancelo = /cancelad/i.test(await r.texto());
    }
    return { ...paso, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const antes = await leerPanel('antes', false);
  console.log('PANEL ANTES: «🧾 ' + antes.hoy + ' pedidos hoy» · capturas', antes.carpeta);
  if (antes.hoy === null) fallos.push('no encontré «🧾 N pedidos hoy» del Restaurante de Prueba en el panel');

  const c = await pedirDomicilio();
  console.log('EL PASAJERO: ' + (c.pidio ? 'pidió un domicilio' : 'NO LOGRÓ PEDIR') + (c.cancelo ? ' y lo canceló' : '') + ' · capturas', c.carpeta);
  if (!c.pidio) fallos.push('el pasajero de prueba no logró hacer el pedido (¿restaurante cerrado o sin platos?)');

  const despues = await leerPanel('despues', true);
  console.log('PANEL DESPUÉS: «🧾 ' + despues.hoy + ' pedidos hoy» · fechas en la ficha: ' + JSON.stringify((despues.fechas || []).slice(0, 5)) + ' · capturas', despues.carpeta);
  if (c.pidio && antes.hoy !== null && despues.hoy !== antes.hoy + 1) {
    fallos.push('el panel decía ' + antes.hoy + ' y después del domicilio dice ' + despues.hoy + ': tenía que subir a ' + (antes.hoy + 1));
  }
  if (!despues.fechas || !despues.fechas.length) fallos.push('no encontré las filas de pedidos en la ficha del panel');
  else if (despues.fechas.includes('—')) fallos.push('la ficha del panel pinta «—» en la fecha de algún pedido');

  console.log('ERRORES DE LA PÁGINA:', [...antes.errores, ...c.errores, ...despues.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el domicilio entra en «pedidos hoy» del panel y su fecha se pinta');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
