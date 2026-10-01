#!/usr/bin/env node
// 🤖 SI LA REVISIÓN DEL PRECIO FALLA, ALIADOS LO DICE — P11 (30-sep-2026). Y UN DATO RARO YA NO LA HACE FALLAR — P12.
// En PRUEBAS:
//   1. pasajero@gg.test deja por la red pedidos al Restaurante de Prueba con el primer plato de su menú:
//      · «Robot P11 normal»: a su precio. El servidor lo revisa → revisionServidor.estado = 'revisado'.
//      · P12: uno con un teléfono que lleva «/» → las reglas lo RECHAZAN (el teléfono nace en 10 cifras).
//      · P12 «Robot P12 venenoso»: a $1 con una promoción inventada «a/b» (hasta P12 eso hacía reventar la revisión):
//        queda 'revisado' con el precio del MENÚ.
//      · P13: uno LLENO casi hasta el máximo de un documento (1 MiB) con un campo de sobra → las reglas lo RECHAZAN
//        (lista cerrada de campos). Hasta P13 era lo único que le quedaba al cliente para que el servidor no cupiera
//        ni para poner el precio ni para dejar la marca.
//      · P13: uno lleno DENTRO de una línea (un campo «nota» que la app no manda) → entra, pero la revisión guarda de
//        la línea solo sus campos conocidos: queda «revisado», con el precio del menú y pequeño.
//      · «Robot P11 sin revisar»: a $1. Como el cliente ya no puede hacer fallar la revisión, el fallo se SIMULA: tras
//        la revisión, la administradora de pruebas le pone la marca que deja el servidor cuando no puede revisar.
//   2. El restaurante (aliados) → Pedidos a domicilio: la tarjeta del «sin revisar» dice «⚠️ Precio
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
  const ids = { normal: 'robotP11N' + t, malo: 'robotP11S' + t, venenoso: 'robotP12V' + t, barra: 'robotP12B' + t, sobra: 'robotP13C' + t, linea: 'robotP13L' + t };
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
  // P13: el pedido lleno casi hasta el máximo (la cuenta de tamaño de Firestore, como en el medidor de P12) ya no
  // entra con un campo de sobra: las reglas cierran la lista. Y lleno DENTRO de una línea (un campo «nota» que la app
  // no manda) sí entra, pero la revisión guarda de la línea solo sus campos conocidos: queda revisado y pequeño.
  const relleno = async (id, pedido, poner) => {
    const nombre = 'pedidos'.length + 1 + id.length + 1 + 16;
    let holgura = HOLGURA;
    for (;;) {
      const p = poner(pedido, '');
      const lleno = poner(pedido, 'x'.repeat(LIMITE_DOCUMENTO - holgura - nombre - 32 - tamano(p)));
      try { await base.cambiar('pedidos/' + id, lleno); return { entro: true, holgura }; } catch (e) {
        if (!/size|tama|exceed|bytes/i.test(e.message) || holgura >= 150) return { entro: false, motivo: e.message.split('\n')[0] };
        holgura += 30; // la cuenta quedó corta por unos bytes: se deja un poco más libre
      }
    }
  };
  const aUnPeso = { ...comun, telefono: '3001100110', items: [{ id: plato.id, nombre: plato.nombre, precio: 1, cantidad: 1, adiciones: [] }], subtotal: 1, total: 1 };
  const sobra = await relleno(ids.sobra, { ...aUnPeso, cliente: 'Robot P13 campo de sobra' }, (p, x) => ({ ...p, relleno: x }));
  const enLinea = await relleno(ids.linea, { ...aUnPeso, cliente: 'Robot P13 lleno en la línea' }, (p, x) => ({ ...p, items: [{ ...p.items[0], nota: x }] }));
  // P11: el que aliados tiene que dar por «sin revisar». Desde P13 el cliente ya no puede hacer fallar la revisión, así
  // que el fallo se SIMULA: la administradora de pruebas le pone la marca que deja el servidor cuando no puede revisar.
  await base.cambiar('pedidos/' + ids.malo, { ...aUnPeso, cliente: 'Robot P11 sin revisar' });
  return { ids, plato, barraEntro, sobra, enLinea };
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
  const { ids, plato, barraEntro, sobra, enLinea } = await dejarPedidos(yo);
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

  // P13: lleno con un campo de sobra → no entra; lleno dentro de una línea → entra y queda revisado y pequeño.
  console.log('P13 · LLENO con un campo de sobra: ' + (sobra.entro ? 'ENTRÓ' : 'rechazado (' + sobra.motivo.slice(0, 80) + ')'));
  if (sobra.entro) fallos.push('P13: las reglas dejaron crear un pedido lleno con un campo de sobra');
  if (!enLinea.entro) fallos.push('P13: no pude crear el pedido lleno dentro de una línea: ' + enLinea.motivo);
  else {
    const linea = await conRevision(yo, 'pedidos/' + ids.linea);
    const { id: _id, ...campos } = linea;
    const peso = tamano(campos);
    console.log('P13 · LLENO en la línea (holgura ' + enLinea.holgura + ' bytes): subtotal ' + linea.subtotal + ' · revisión '
      + JSON.stringify(linea.revisionServidor && { estado: linea.revisionServidor.estado }) + ' · queda de ~' + peso + ' bytes');
    if (!linea.revisionServidor || linea.revisionServidor.estado !== 'revisado') fallos.push('P13: el pedido lleno en la línea no quedó «revisado»');
    if (linea.subtotal !== plato.precio) fallos.push('P13: el pedido lleno en la línea no quedó con el precio del menú: ' + linea.subtotal);
    if (peso > 20000) fallos.push('P13: el pedido lleno en la línea sigue pesando ' + peso + ' bytes: la revisión no soltó la «nota»');
  }
  // P11 (simulado desde P13): se espera la revisión de verdad y encima se pone la marca de «sin revisar», como admin.
  await conRevision(yo, 'pedidos/' + ids.malo);
  const adm = await entrarALaBase('admin@gg.test');
  await adm.cambiar('pedidos/' + ids.malo, { revisionServidor: { evento: 'robot', estado: 'sin_revisar', motivo: 'simulado por el robot', subtotalDelTelefono: 1, totalDelTelefono: 1, promos: [], problemas: [] } });
  const malo = await yo.leer('pedidos/' + ids.malo);
  console.log('SIN REVISAR (simulado): revisión ' + JSON.stringify(malo.revisionServidor && { estado: malo.revisionServidor.estado }));
  if (!malo.revisionServidor || malo.revisionServidor.estado !== 'sin_revisar') fallos.push('no quedó puesta la marca de «sin revisar» del pedido simulado');

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

  for (const id of [ids.normal, ids.malo, ids.venenoso, ...(enLinea.entro ? [ids.linea] : []), ...(sobra.entro ? [ids.sobra] : [])]) {
    try { await yo.cambiar('pedidos/' + id, { estado: 'cancelado', canceladoPor: 'cliente' }); } catch (e) { fallos.push('no pude cancelar ' + id + ': ' + e.message); }
  }
  console.log('ERRORES DE LA PÁGINA:', al.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el pedido normal sale revisado y sin aviso; el teléfono con «/» no entra y la promoción «a/b» sale revisada con el precio del menú (P12); el lleno con un campo de sobra no entra y el lleno dentro de una línea sale revisado y pequeño (P13); el marcado «sin revisar», aliados lo dice en la tarjeta y al confirmar');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
