#!/usr/bin/env node
// 🤖 SI LA REVISIÓN DEL PRECIO FALLA, ALIADOS LO DICE — P11 (30-sep-2026). Y UN DATO RARO YA NO LA HACE FALLAR — P12.
// En PRUEBAS:
//   1. pasajero@gg.test deja por la red pedidos al Restaurante de Prueba con el primer plato de su menú:
//      · «Robot P11 normal»: a su precio. El servidor lo revisa → revisionServidor.estado = 'revisado'.
//      · P12: uno con un teléfono que lleva «/» → las reglas lo RECHAZAN (el teléfono nace en 10 cifras).
//      · P12 «Robot P12 venenoso»: a $1 con una promoción inventada «a/b» (hasta P12 eso hacía reventar la revisión):
//        queda 'revisado' con el precio del MENÚ.
//      · «Robot P11 sin revisar»: a $1 y LLENO casi hasta el máximo de un documento (1 MiB) con un campo de relleno. Es
//        lo único que le queda al cliente para hacer fallar la revisión (hasta P12 bastaba el teléfono con «/»): el
//        servidor no cabe ni para poner el precio ni para dejar la marca, así que el pedido se queda SIN revisión, con
//        la plata del teléfono, y aliados lo da por «sin revisar» cuando pasa la espera de 2 minutos (P11).
//   2. El restaurante (aliados) → Pedidos a domicilio, pasada la espera: la tarjeta del «sin revisar» dice «⚠️ Precio
//      sin revisar» y la del normal no; al tocar «✅ Confirmar pedido» en el «sin revisar», la ventanita también lo
//      dice (no se confirma: se cierra con «Cancelar»).
//   3. Los pedidos se cancelan al final, como el cliente.
//   node robot/revision-precio.cjs
const { abrir, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');
const { tamano } = require('../scripts/medir-revision-venenosa.cjs');

const LIMITE_DOCUMENTO = 1048576;
// Lo que se deja libre: menos de lo que añade la revisión (unos 190 bytes) y la marca de «sin revisar» (más aún).
const HOLGURA = 60;

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
  const t = Date.now();
  const ids = { normal: 'robotP11N' + t, malo: 'robotP11S' + t, venenoso: 'robotP12V' + t, barra: 'robotP12B' + t };
  await base.cambiar('pedidos/' + ids.normal, {
    ...comun, cliente: 'Robot P11 normal', telefono: '3001100110',
    items: [{ id: plato.id, nombre: plato.nombre, precio: plato.precio, cantidad: 1, adiciones: [] }],
    subtotal: plato.precio, total: plato.precio,
  });
  // P12: el teléfono con «/» ya no entra.
  let barraEntro = true;
  try {
    await base.cambiar('pedidos/' + ids.barra, {
      ...comun, cliente: 'Robot P12 barra', telefono: '300/1100110',
      items: [{ id: plato.id, nombre: plato.nombre, precio: 1, cantidad: 1, adiciones: [], promoId: 'robotP11' }], subtotal: 1, total: 1,
    });
  } catch (e) { barraEntro = false; }
  // P12: la promoción inventada con «/» ya no hace reventar la revisión.
  await base.cambiar('pedidos/' + ids.venenoso, {
    ...comun, cliente: 'Robot P12 venenoso', telefono: '3001100110',
    items: [{ id: plato.id, nombre: plato.nombre, precio: 1, cantidad: 1, adiciones: [], promoId: 'a/b' }], subtotal: 1, total: 1,
  });
  // P11: el pedido lleno casi hasta el máximo (la cuenta de tamaño de Firestore, como en el medidor de P12).
  const malo = {
    ...comun, cliente: 'Robot P11 sin revisar', telefono: '3001100110',
    items: [{ id: plato.id, nombre: plato.nombre, precio: 1, cantidad: 1, adiciones: [] }], subtotal: 1, total: 1, relleno: '',
  };
  const nombre = 'pedidos'.length + 1 + ids.malo.length + 1 + 16;
  let holgura = HOLGURA;
  for (;;) {
    malo.relleno = '';
    malo.relleno = 'x'.repeat(LIMITE_DOCUMENTO - holgura - nombre - 32 - tamano(malo));
    try { await base.cambiar('pedidos/' + ids.malo, malo); break; } catch (e) {
      if (holgura >= 150) throw new Error('no pude dejar el pedido lleno: ' + e.message.split('\n')[0]);
      holgura += 30; // la cuenta quedó corta por unos bytes: se deja un poco más libre
    }
  }
  return { ids, plato, barraEntro, holgura };
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
  const nacio = Date.now();
  const { ids, plato, barraEntro, holgura } = await dejarPedidos(yo);
  const normal = await conRevision(yo, 'pedidos/' + ids.normal);
  const venenoso = await conRevision(yo, 'pedidos/' + ids.venenoso);
  console.log('NORMAL: total ' + normal.total + ' · revisión ' + JSON.stringify(normal.revisionServidor && { estado: normal.revisionServidor.estado }));
  console.log('P12 · teléfono con «/»: ' + (barraEntro ? 'ENTRÓ' : 'rechazado por las reglas'));
  console.log('P12 · VENENOSO (promo «a/b», a $1): subtotal ' + venenoso.subtotal + ' · revisión ' + JSON.stringify(venenoso.revisionServidor && { estado: venenoso.revisionServidor.estado }));
  if (!normal.revisionServidor || normal.revisionServidor.estado !== 'revisado') fallos.push('el pedido normal no quedó «revisado» (¿está publicada la función?)');
  // El total del normal lleva además el domicilio del negocio (lo pone el servidor): se compara el subtotal.
  if (normal.subtotal !== plato.precio) fallos.push('al pedido normal le cambió el subtotal: ' + normal.subtotal + ' y el menú dice ' + plato.precio);
  if (barraEntro) fallos.push('P12: las reglas dejaron crear un pedido con el teléfono «300/1100110»');
  if (!venenoso.revisionServidor || venenoso.revisionServidor.estado !== 'revisado') fallos.push('P12: el pedido con la promoción «a/b» no quedó «revisado»');
  if (venenoso.subtotal !== plato.precio) fallos.push('P12: el pedido con la promoción «a/b» no quedó con el precio del menú: ' + venenoso.subtotal);

  // El lleno: el servidor no cabe ni para la revisión ni para la marca. Se espera a que pase la espera de aliados.
  const falta = nacio + 2 * 60 * 1000 + 15000 - Date.now();
  if (falta > 0) await esperar(falta);
  const malo = await yo.leer('pedidos/' + ids.malo);
  console.log('LLENO (holgura ' + holgura + ' bytes): total ' + malo.total + ' · revisión ' + JSON.stringify(malo.revisionServidor && { estado: malo.revisionServidor.estado }));
  if (malo.revisionServidor && malo.revisionServidor.estado === 'revisado') fallos.push('el pedido lleno sí se pudo revisar: no sirve para probar el aviso');
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

  for (const id of [ids.normal, ids.malo, ids.venenoso]) {
    try { await yo.cambiar('pedidos/' + id, { estado: 'cancelado', canceladoPor: 'cliente' }); } catch (e) { fallos.push('no pude cancelar ' + id + ': ' + e.message); }
  }
  console.log('ERRORES DE LA PÁGINA:', al.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el pedido normal sale revisado y sin aviso; el teléfono con «/» no entra y la promoción «a/b» sale revisada con el precio del menú (P12); el que no se pudo revisar, aliados lo dice en la tarjeta y al confirmar');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
