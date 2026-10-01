#!/usr/bin/env node
// 🤖 SI LA REVISIÓN DEL PRECIO FALLA, ALIADOS LO DICE — P11 (30-sep-2026). En PRUEBAS:
//   1. pasajero@gg.test deja por la red DOS pedidos al Restaurante de Prueba con el primer plato de su menú:
//      · «Robot P11 normal»: a su precio. El servidor lo revisa → revisionServidor.estado = 'revisado'.
//      · «Robot P11 sin revisar»: a $1, con un teléfono que lleva «/» y una promoción inventada. Esa barra rompe la
//        ruta del contador de la promoción y la revisión REVIENTA en el servidor (así se provoca un fallo de verdad):
//        el pedido tiene que quedar con revisionServidor.estado = 'sin_revisar', y la plata del teléfono intacta.
//   2. El restaurante (aliados) → Pedidos a domicilio: la tarjeta del «sin revisar» dice «⚠️ Precio sin revisar» y la
//      del normal no; al tocar «✅ Confirmar pedido» en el «sin revisar», la ventanita también lo dice (no se confirma:
//      se cierra con «Cancelar»).
//   3. Los dos pedidos se cancelan al final, como el cliente.
//   node robot/revision-precio.cjs
const { abrir, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function conRevision(base, ruta) {
  for (let i = 0; i < 40; i++) {
    const p = await base.leer(ruta);
    if (p.revisionServidor) return p;
    await esperar(1500);
  }
  return base.leer(ruta);
}

async function dejarPedidos(base) {
  const negocio = await base.leer('negocios/prueba-restaurante');
  const plato = (negocio.menu || []).find((x) => x && x.id && x.disponible !== false) || (negocio.menu || [])[0];
  if (!plato) throw new Error('el Restaurante de Prueba no tiene menú');
  const comun = {
    restauranteId: 'prueba-restaurante', restauranteNombre: negocio.nombre || 'Restaurante de Prueba', clienteId: base.uid,
    direccion: 'Calle Robot P11 #1-2', metodoPago: 'Efectivo', estado: 'nuevo', tipo: 'domicilio', costoDomicilio: 0,
    creado: new Date().toISOString(),
  };
  const ids = { normal: 'robotP11N' + Date.now(), malo: 'robotP11S' + Date.now() };
  await base.cambiar('pedidos/' + ids.normal, {
    ...comun, cliente: 'Robot P11 normal', telefono: '3001100110',
    items: [{ id: plato.id, nombre: plato.nombre, precio: plato.precio, cantidad: 1, adiciones: [] }],
    subtotal: plato.precio, total: plato.precio,
  });
  await base.cambiar('pedidos/' + ids.malo, {
    ...comun, cliente: 'Robot P11 sin revisar', telefono: '300/1100110',
    items: [{ id: plato.id, nombre: plato.nombre, precio: 1, cantidad: 1, adiciones: [], promoId: 'robotP11' }],
    subtotal: 1, total: 1,
  });
  return { ids, plato };
}

async function verAliados() {
  const a = await abrir('aliados', { nombre: 'revision-precio-aliados' });
  const p = a.pagina;
  try {
    await entrarComoRestaurante(p);
    if (!(await p.getByText('Pedidos a domicilio', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Pedidos a domicilio', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    // La tarjeta de cada cliente: se sube desde «👤 <nombre>» hasta la caja que lleva «Pedido #».
    const tarjetas = await p.evaluate(() => {
      const out = {};
      for (const nombre of ['Robot P11 normal', 'Robot P11 sin revisar']) {
        const n = [...document.querySelectorAll('p')].find((x) => x.textContent.trim() === '👤 ' + nombre);
        let caja = n;
        while (caja && !caja.textContent.includes('Pedido #')) caja = caja.parentElement;
        out[nombre] = caja ? caja.textContent : null;
      }
      return out;
    });
    await a.captura('tarjetas');
    // La ventanita de confirmar, en el «sin revisar»: se marca su botón desde la tarjeta y se toca.
    let ventanita = null;
    const marcado = await p.evaluate(() => {
      const n = [...document.querySelectorAll('p')].find((x) => x.textContent.trim() === '👤 Robot P11 sin revisar');
      let caja = n;
      while (caja && !caja.textContent.includes('Pedido #')) caja = caja.parentElement;
      const b = caja && [...caja.querySelectorAll('button')].find((x) => x.textContent.includes('Confirmar pedido'));
      if (b) b.setAttribute('data-robot', 'confirmar-p11');
      return !!b;
    });
    if (marcado) {
      await p.locator('[data-robot="confirmar-p11"]').click();
      await p.waitForTimeout(1200);
      ventanita = await p.evaluate(() => {
        const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.includes('¿En cuánto está listo?'));
        return h ? h.parentElement.textContent : null;
      });
      await a.captura('ventanita-confirmar');
      await p.getByText('Cancelar', { exact: true }).last().click();
      await p.waitForTimeout(600);
    }
    return { tarjetas, ventanita, errores: a.errores, carpeta: a.carpeta };
  } finally { await a.cerrar(); }
}

(async () => {
  const fallos = [];
  const yo = await entrarALaBase('pasajero@gg.test');
  const { ids, plato } = await dejarPedidos(yo);
  const normal = await conRevision(yo, 'pedidos/' + ids.normal);
  const malo = await conRevision(yo, 'pedidos/' + ids.malo);
  console.log('NORMAL: total ' + normal.total + ' · revisión ' + JSON.stringify(normal.revisionServidor && { estado: normal.revisionServidor.estado }));
  console.log('SIN REVISAR: total ' + malo.total + ' · revisión ' + JSON.stringify(malo.revisionServidor && { estado: malo.revisionServidor.estado, motivo: malo.revisionServidor.motivo }));
  if (!normal.revisionServidor || normal.revisionServidor.estado !== 'revisado') fallos.push('el pedido normal no quedó «revisado» (¿está publicada la función?)');
  if (normal.total !== plato.precio) fallos.push('al pedido normal le cambió el total: ' + normal.total + ' y el menú dice ' + plato.precio);
  if (!malo.revisionServidor || malo.revisionServidor.estado !== 'sin_revisar') fallos.push('el pedido cuya revisión revienta no quedó marcado «sin_revisar»');
  if (malo.total !== 1) fallos.push('al pedido sin revisar se le cambió la plata (' + malo.total + '): el servidor no tenía cómo revisarlo');

  const al = await verAliados();
  console.log('ALIADOS · capturas', al.carpeta);
  const tN = al.tarjetas['Robot P11 normal'];
  const tS = al.tarjetas['Robot P11 sin revisar'];
  if (!tN) fallos.push('aliados no enseña la tarjeta del pedido normal');
  else if (/Precio sin revisar/.test(tN)) fallos.push('la tarjeta del pedido NORMAL dice «Precio sin revisar»');
  if (!tS) fallos.push('aliados no enseña la tarjeta del pedido sin revisar');
  else if (!/⚠️ Precio sin revisar/.test(tS)) fallos.push('la tarjeta del pedido sin revisar NO lo dice');
  if (!al.ventanita) fallos.push('no se pudo abrir la ventanita de confirmar del pedido sin revisar');
  else if (!/⚠️ Precio sin revisar/.test(al.ventanita)) fallos.push('la ventanita de confirmar NO dice «Precio sin revisar»');
  console.log('  tarjeta normal: ' + (tN && /Precio sin revisar/.test(tN) ? 'con aviso' : 'sin aviso') + ' · tarjeta sin revisar: '
    + (tS && /Precio sin revisar/.test(tS) ? 'con aviso' : 'sin aviso') + ' · ventanita: ' + (al.ventanita && /Precio sin revisar/.test(al.ventanita) ? 'con aviso' : 'sin aviso'));

  for (const id of [ids.normal, ids.malo]) {
    try { await yo.cambiar('pedidos/' + id, { estado: 'cancelado', canceladoPor: 'cliente' }); } catch (e) { fallos.push('no pude cancelar ' + id + ': ' + e.message); }
  }
  console.log('ERRORES DE LA PÁGINA:', al.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el pedido normal sale revisado y sin aviso; el que no se pudo revisar queda marcado y aliados lo dice en la tarjeta y al confirmar');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
