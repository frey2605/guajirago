#!/usr/bin/env node
// 🤖 EL TOTAL DEL PEDIDO LO PONE EL SERVIDOR — P09 (30-sep-2026). En PRUEBAS:
//   1. HONRADO, como una persona: el pasajero de prueba (pasajero@gg.test) → Restaurantes → Restaurante de Prueba,
//      echa dos platos, escribe dirección y teléfono, paga en efectivo y PIDE. En el seguimiento se lee el «Total».
//      Se busca el pedido (su id lo recuerda la app en este aparato) y tiene que llevar la revisión del servidor
//      (`revisionServidor`), con el MISMO total que vio el cliente: a un cliente honrado no le cambia nada.
//   2. TRAMPOSO, como una app modificada: con la misma cuenta se crea por la red un pedido de esos mismos platos,
//      pero a $1 cada uno. El servidor tiene que ponerle el precio del menú (el del pedido honrado), no $1.
//   Los dos pedidos se cancelan al final (como el cliente), para que el restaurante no tenga que atenderlos.
//   node robot/total-pedido.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function revisado(base, ruta) {
  for (let i = 0; i < 40; i++) {
    const p = await base.leer(ruta);
    if (p.revisionServidor) return p;
    await esperar(1500);
  }
  return base.leer(ruta);
}
const pesos = (t) => Number(String(t || '').replace(/[^\d]/g, '')) || null;

async function pedirComoPersona() {
  const r = await abrir('transporte', { nombre: 'total-pedido-cliente' });
  const p = r.pagina;
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
    await p.getByText('+', { exact: true }).last().click();
    await p.waitForTimeout(1500);
    await p.getByText('+', { exact: true }).last().click();
    await p.waitForTimeout(1000);
    await p.fill('input[placeholder="📍 Dirección de entrega"]', 'Calle Robot P09 #1-2');
    await p.fill('input[placeholder="📞 Tu teléfono (obligatorio · 10 dígitos)"]', '3000900909');
    await p.getByText('Efectivo', { exact: true }).first().click();
    await p.waitForTimeout(500);
    await r.captura('carrito');
    await p.getByRole('button', { name: /^Pedir \d+ item/ }).click();
    await p.waitForTimeout(9000);
    await r.captura('seguimiento');
    const total = await p.evaluate(() => {
      const nodos = [...document.querySelectorAll('p')];
      const i = nodos.findIndex((x) => x.textContent.trim() === 'Total');
      return i >= 0 && nodos[i + 1] ? nodos[i + 1].textContent.trim() : null;
    });
    const ids = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('misPedidosGuajira')) || []; } catch (e) { return []; } });
    return { total, id: ids[0] || null, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const c = await pedirComoPersona();
  console.log('HONRADO: la pantalla dice Total ' + c.total + ' · pedido ' + c.id + ' · capturas', c.carpeta);
  if (!c.id) { console.log('🔴 FALLÓ: el pasajero no logró pedir (no hay id recordado)'); process.exit(1); }

  const yo = await entrarALaBase('pasajero@gg.test');
  const honrado = await revisado(yo, 'pedidos/' + c.id);
  console.log('  en la base: subtotal ' + honrado.subtotal + ' · domicilio ' + honrado.costoDomicilio + ' · total ' + honrado.total
    + ' · revisión del servidor: ' + JSON.stringify(honrado.revisionServidor));
  if (!honrado.revisionServidor) fallos.push('el pedido honrado no lleva la revisión del servidor (¿está publicada la función?)');
  else {
    if (honrado.revisionServidor.totalDelTelefono !== honrado.total) fallos.push('al cliente honrado el servidor le cambió el total: el teléfono ' + honrado.revisionServidor.totalDelTelefono + ', el servidor ' + honrado.total);
    if ((honrado.revisionServidor.problemas || []).length) fallos.push('el pedido honrado salió con problemas: ' + JSON.stringify(honrado.revisionServidor.problemas));
  }
  if (pesos(c.total) !== honrado.total) fallos.push('la pantalla dice ' + c.total + ' y la base ' + honrado.total);

  // El tramposo: los mismos platos, a $1.
  const id = 'robotP09' + Date.now();
  const items = (honrado.items || []).map((l) => ({ id: l.id, nombre: l.nombre, precio: 1, cantidad: l.cantidad, adiciones: [] }));
  await yo.cambiar('pedidos/' + id, {
    restauranteId: honrado.restauranteId, clienteId: yo.uid, restauranteNombre: honrado.restauranteNombre || '', cliente: 'Robot P09',
    telefono: '3000900909', direccion: 'Calle Robot P09 #1-2', items, subtotal: items.length, costoDomicilio: 0,
    total: items.length, metodoPago: 'Efectivo', estado: 'nuevo', tipo: 'domicilio',
  });
  const truco = await revisado(yo, 'pedidos/' + id);
  console.log('TRAMPOSO (platos a $1): en la base subtotal ' + truco.subtotal + ' · total ' + truco.total + ' · revisión ' + JSON.stringify(truco.revisionServidor));
  if (truco.subtotal !== honrado.subtotal) fallos.push('el pedido con platos a $1 quedó en ' + truco.subtotal + '; con los precios del menú son ' + honrado.subtotal);
  if (!truco.revisionServidor || truco.revisionServidor.totalDelTelefono !== items.length) fallos.push('el pedido tramposo no lleva la revisión del servidor con lo que mandó el teléfono');

  // Se cancelan los dos, como el cliente.
  for (const ruta of ['pedidos/' + c.id, 'pedidos/' + id]) {
    try { await yo.cambiar(ruta, { estado: 'cancelado', canceladoPor: 'cliente' }); } catch (e) { fallos.push('no pude cancelar ' + ruta + ': ' + e.message); }
  }
  // Y el cliente no puede cambiar la plata después (las reglas).
  let cambio = false;
  try { await yo.cambiar('pedidos/' + id, { total: 1 }); cambio = true; } catch (e) { /* lo negó: bien */ }
  if (cambio) fallos.push('el cliente pudo cambiar el total de su pedido después de nacer');

  console.log('ERRORES DE LA PÁGINA:', c.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ al honrado el servidor le deja su total, al tramposo le pone el precio del menú, y la plata ya no se cambia desde el teléfono');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
