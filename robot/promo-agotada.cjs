#!/usr/bin/env node
// 🤖 LA PROMOCIÓN AGOTADA YA NO TRANCA EL PEDIDO — P14 (1-oct-2026). En PRUEBAS:
//   0. Como la administradora de pruebas (admin@gg.test), el Restaurante de Prueba gana una promoción de UN USO por
//      cliente, del 50 % en todos sus platos (`robotP14_<hora>`: nueva en cada corrida, así su contador empieza en 0).
//   1. PRIMER APARATO, como una persona: pasajero@gg.test → Restaurantes → Restaurante de Prueba, echa un plato, pone
//      un teléfono nuevo y PIDE. El plato lleva la promoción; el servidor la deja y cuenta el uso de ese teléfono.
//   2. OTRO APARATO (un navegador nuevo: no recuerda nada), la misma persona con el MISMO teléfono echa el mismo plato y
//      PIDE: la app ve que ese teléfono ya usó la promoción, la quita y lo dice («Promoción sin cupos»). El cliente toca
//      «Entendido» y vuelve a PEDIR. Hasta P14, ese segundo envío no salía del teléfono (la línea llevaba
//      `promoId: undefined`) y el cliente veía «No se pudo enviar el pedido · Algo falló…» cada vez que lo intentaba.
//      Ahora tiene que entrar, sin descuento, y el servidor cobrarlo al precio del menú.
//   3. Los pedidos se cancelan (como el cliente) y la promoción se quita: el negocio queda como estaba.
//   node robot/promo-agotada.cjs
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

/** Un aparato nuevo: entra, echa el primer plato que se deje y pide. Devuelve lo que vio y el pedido que recuerda. */
async function pedirEnUnAparato(nombre, telefono, veces) {
  const r = await abrir('transporte', { nombre });
  const p = r.pagina;
  const visto = [];
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
    // El Restaurante de Prueba pide un mínimo: se suben unidades del plato (el «+» del carrito) hasta alcanzarlo.
    for (let i = 0; i < 12 && (await p.getByText(/^Pedido mínimo/).count()); i++) {
      await p.getByText('+', { exact: true }).last().click();
      await p.waitForTimeout(500);
    }
    await p.fill('input[placeholder="📍 Dirección de entrega"]', 'Calle Robot P14 #1-2');
    await p.fill('input[placeholder="📞 Tu teléfono (obligatorio · 10 dígitos)"]', telefono);
    await p.getByText('Efectivo', { exact: true }).first().click();
    await p.waitForTimeout(500);
    await r.captura(nombre + '-carrito');
    for (let i = 1; i <= veces; i++) {
      const boton = p.getByRole('button', { name: /^Pedir \d+ item/ });
      if (!(await boton.count())) { visto.push({ envio: i, sinBoton: true }); break; }
      const rotulo = (await boton.first().textContent()).trim();
      await boton.first().click();
      await p.waitForTimeout(9000);
      await r.captura(nombre + '-envio' + i);
      // La ventanita que haya (la de la promoción o la del candado), y si ya estamos en el seguimiento.
      const ventanita = await p.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Entendido');
        if (!b) return null;
        return b.parentElement.innerText.replace(/\s+/g, ' ').replace(/Entendido$/, '').trim();
      });
      const seguimiento = await p.evaluate(() => [...document.querySelectorAll('p')].some((x) => x.textContent.trim() === 'Total'));
      visto.push({ envio: i, rotulo, ventanita, seguimiento });
      if (seguimiento) break;
      if (ventanita) { await p.getByRole('button', { name: 'Entendido' }).first().click(); await p.waitForTimeout(800); }
    }
    const ids = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('misPedidosGuajira')) || []; } catch (e) { return []; } });
    return { visto, id: ids[0] || null, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const RUTA_NEGOCIO = 'negocios/prueba-restaurante';
  const negocio = await adm.leer(RUTA_NEGOCIO);
  const originales = negocio.promociones || [];
  const t = Date.now();
  const promo = {
    id: 'robotP14_' + t, nombre: 'Robot P14 una vez', tipo: 'porcentaje', valor: 50, activa: true, programacion: 'siempre',
    limiteCliente: 1, platosAplica: [],
  };
  // Un teléfono nuevo en cada corrida (celular de 10 cifras), para que su contador empiece en 0.
  const telefono = '314' + String(t).slice(-7);
  await adm.cambiar(RUTA_NEGOCIO, { promociones: [...originales, promo] });
  const yo = await entrarALaBase('pasajero@gg.test');
  const creados = [];
  try {
    const a = await pedirEnUnAparato('promo-agotada-1', telefono, 1);
    console.log('PRIMER APARATO: ' + JSON.stringify(a.visto) + ' · pedido ' + a.id + ' · capturas', a.carpeta);
    if (!a.id) throw new Error('el primer pedido no salió (no hay id recordado)');
    creados.push(a.id);
    const p1 = await revisado(yo, 'pedidos/' + a.id);
    const conPromo = (p1.items || []).some((l) => l.promoId === promo.id);
    console.log('  en la base: subtotal ' + p1.subtotal + ' · promociones del servidor: ' + JSON.stringify((p1.revisionServidor || {}).promos || []));
    if (!conPromo) fallos.push('el primer pedido no lleva la promoción ' + promo.id + ' (¿otra promoción del negocio era mejor?)');
    const contador = await adm.leer('usosPromo/' + promo.id + '__' + telefono).catch(() => null);
    console.log('  contador del teléfono: ' + JSON.stringify(contador && contador.veces));
    if (!contador || contador.veces !== 1) fallos.push('el servidor no contó el uso de la promoción (contador ' + JSON.stringify(contador) + ')');

    const b = await pedirEnUnAparato('promo-agotada-2', telefono, 3);
    console.log('OTRO APARATO, mismo teléfono:');
    for (const v of b.visto) console.log('  envío ' + v.envio + ' («' + v.rotulo + '»): ' + (v.seguimiento ? 'ENTRÓ (seguimiento)' : 'no entró') + (v.ventanita ? ' · ventanita: «' + v.ventanita + '»' : ''));
    console.log('  capturas', b.carpeta);
    const primero = b.visto[0] || {};
    if (!primero.ventanita || !/sin cupos/i.test(primero.ventanita)) fallos.push('el primer envío del otro aparato no dijo que la promoción ya no tiene cupos');
    const fallido = b.visto.find((v) => v.ventanita && /No se pudo enviar el pedido/.test(v.ventanita));
    if (fallido) fallos.push('al volver a enviar, el cliente vio «' + fallido.ventanita + '» (envío ' + fallido.envio + ')');
    const entro = b.visto.find((v) => v.seguimiento);
    if (!entro || !b.id || b.id === a.id) fallos.push('el pedido sin la promoción no entró');
    else {
      creados.push(b.id);
      const p2 = await revisado(yo, 'pedidos/' + b.id);
      const linea = (p2.items || [])[0] || {};
      console.log('  en la base: subtotal ' + p2.subtotal + ' · línea ' + JSON.stringify({ id: linea.id, precio: linea.precio, promoId: linea.promoId })
        + ' · teléfono mandó ' + JSON.stringify((p2.revisionServidor || {}).totalDelTelefono) + ' · problemas ' + JSON.stringify((p2.revisionServidor || {}).problemas || []));
      if (linea.promoId) fallos.push('el segundo pedido salió con la promoción agotada');
      const plato = (negocio.menu || []).find((x) => x && x.id === linea.id);
      if (plato && linea.precio !== plato.precio) fallos.push('el segundo pedido no quedó al precio del menú (' + linea.precio + ' contra ' + plato.precio + ')');
      if (((p2.revisionServidor || {}).problemas || []).length) fallos.push('el pedido honrado sin promoción salió con problemas');
      if (p2.revisionServidor && p2.revisionServidor.totalDelTelefono !== p2.total) fallos.push('lo que enseñó el teléfono (' + p2.revisionServidor.totalDelTelefono + ') no es lo que cobra el servidor (' + p2.total + ')');
    }
    console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...b.errores].join(' || ') || 'ninguno');
  } catch (e) {
    fallos.push(e.message.split('\n')[0]);
  } finally {
    for (const id of creados) {
      try { await yo.cambiar('pedidos/' + id, { estado: 'cancelado', canceladoPor: 'cliente' }); } catch (e) { fallos.push('no pude cancelar ' + id + ': ' + e.message); }
    }
    await adm.cambiar(RUTA_NEGOCIO, { promociones: originales });
    const despues = (await adm.leer(RUTA_NEGOCIO)).promociones || [];
    if (JSON.stringify(despues) !== JSON.stringify(originales)) fallos.push('las promociones del negocio no quedaron como estaban');
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ con la promoción agotada en ese teléfono, la app la quita, lo dice, y al volver a enviar el pedido entra al precio del menú');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
