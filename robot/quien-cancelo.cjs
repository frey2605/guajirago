#!/usr/bin/env node
// 🤖 EL CLIENTE Y EL RESTAURANTE DICEN LO MISMO DE QUIÉN CANCELÓ EL PEDIDO — gemelo G84, 29-sep-2026.
// Antes, con un pedido viejo sin `canceladoPor`, el cliente leía «Cancelado por mí» y el restaurante «Rechazado por el
// restaurante» del MISMO pedido. Desde G84 las dos apps preguntan a quienCanceloElPedido (estadosPedido.js en la app,
// copia atada en aliados/flujoPedidos.js). Aquí, en PRUEBAS:
//   1. pasajero@gg.test deja en la base TRES pedidos FIJOS suyos al Restaurante de Prueba, ya cancelados (se reusan
//      en cada corrida; solo se les renueva la hora para que aliados los enseñe, que esconde los de más de 24 h):
//      · #CLI01 — nuevo: canceladoPor 'cliente' y su motivo;
//      · #VIE02 — viejo: sin canceladoPor (null) y con el motivo que solo escribe el cliente;
//      · #NAD03 — viejo: sin canceladoPor y sin ningún motivo.
//   2. el pasajero abre «📦 Mis pedidos» (la app los busca por los ids guardados en el teléfono) y se lee la etiqueta de
//      cada uno; y entra al seguimiento de #VIE02 y se lee «❌ …» y «Motivo: …»;
//   3. el restaurante (aliados) → Pedidos a domicilio → «Cancelado», y se lee la línea «❌ …» de cada uno.
//   Los dos lados tienen que decir el MISMO «quién»: cliente, cliente y «no se sabe» (solo «Cancelado»).
//   node robot/quien-cancelo.cjs
const { abrir, claveDePruebas, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');

const PEDIDOS = [
  { id: 'robotG84CLI01', cod: 'CLI01', campos: { canceladoPor: 'cliente', motivoCancelacion: 'ROBOT G84 se demoraba' }, quien: 'cliente' },
  { id: 'robotG84VIE02', cod: 'VIE02', campos: { canceladoPor: null, motivoCancelacion: 'ROBOT G84 viejo del cliente' }, quien: 'cliente' },
  { id: 'robotG84NAD03', cod: 'NAD03', campos: { canceladoPor: null, motivoCancelacion: null }, quien: 'no dice' },
];

function quienDice(texto) {
  const quien = String(texto || '').replace(/^❌\s*/, '').split(' · ')[0].trim();
  if (/restaurante/i.test(quien)) return 'restaurante';
  if (/por ti$|por mí$|por el cliente$/i.test(quien)) return 'cliente';
  return quien === 'Cancelado' ? 'no dice' : '¿' + quien + '?';
}

async function dejarPedidos() {
  const base = await entrarALaBase('pasajero@gg.test');
  const adm = await entrarALaBase('admin@gg.test');
  for (const x of PEDIDOS) {
    const ruta = 'pedidos/' + x.id;
    let existe = true;
    try { await base.leer(ruta); } catch (e) { existe = false; }
    if (!existe) {
      // El cliente solo puede CREAR su pedido en 'nuevo' (firestore.rules); después lo cancela, como en la app.
      await base.cambiar(ruta, {
        restauranteId: 'prueba-restaurante', restauranteNombre: 'Restaurante de Prueba', clienteId: base.uid,
        cliente: 'Pasajero de Prueba', telefono: '3008408484', direccion: 'Calle Robot G84', tipo: 'domicilio',
        items: [{ nombre: 'Jugo de corozo', cantidad: 1, precio: 5000 }], subtotal: 5000, total: 5000,
        estado: 'nuevo', creado: new Date().toISOString(),
      });
    }
    // P13: dejarlo «viejo» (sin canceladoPor, sin motivoRechazo) y renovarle la hora no es algo que haga la app del
    // cliente, y desde P13 las reglas no se lo dejan: lo prepara la administradora de pruebas.
    await adm.cambiar(ruta, { estado: 'cancelado', motivoRechazo: null, ...x.campos, creado: new Date().toISOString() });
  }
}

async function verCliente() {
  const r = await abrir('transporte', { nombre: 'quien-cancelo-cliente' });
  const p = r.pagina;
  try {
    // «Mis pedidos» son los que ESTE teléfono ha hecho: la app guarda sus ids en el teléfono.
    await p.evaluate((ids) => localStorage.setItem('misPedidosGuajira', JSON.stringify(ids)), PEDIDOS.map((x) => x.id));
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Restaurantes', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByText('📦 Mis pedidos').first().click();
    await p.waitForTimeout(5000);
    await r.captura('mis-pedidos');
    const lista = await p.evaluate((cods) => {
      const out = {};
      for (const cod of cods) {
        const n = [...document.querySelectorAll('p')].find((x) => x.textContent.trim().startsWith('Pedido #' + cod));
        const caja = n && n.parentElement;
        const s = caja && caja.querySelector('span');
        out[cod] = s ? s.textContent.trim() : null;
      }
      return out;
    }, PEDIDOS.map((x) => x.cod));
    // El seguimiento de #VIE02: la línea «❌ …» y el «Motivo: …».
    await p.getByText('Pedido #VIE02', { exact: false }).first().click();
    await p.waitForTimeout(4000);
    await r.captura('seguimiento-VIE02');
    const seg = await p.evaluate(() => {
      const ps = [...document.querySelectorAll('p')].map((x) => x.textContent.trim());
      return { linea: ps.find((t) => t.startsWith('❌')) || null, motivo: ps.find((t) => t.startsWith('Motivo:')) || null };
    });
    return { lista, seg, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function verAliados() {
  const a = await abrir('aliados', { nombre: 'quien-cancelo-aliados' });
  const p = a.pagina;
  try {
    await entrarComoRestaurante(p);
    if (!(await p.getByText('Pedidos a domicilio', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Pedidos a domicilio', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    await p.getByRole('button', { name: /^Cancelado/ }).first().click();
    await p.waitForTimeout(1500);
    await a.captura('cancelados');
    const lineas = await p.evaluate((cods) => {
      const out = {};
      for (const cod of cods) {
        // El nodo MÁS CORTO que lleva «#COD» (el título «Pedido #COD»), y de ahí se sube hasta la tarjeta.
        const n = [...document.querySelectorAll('p, span, div')].filter((x) => x.textContent.includes('#' + cod))
          .sort((x, y) => x.textContent.length - y.textContent.length)[0];
        // 🪤 La tarjeta lleva también la etiqueta «❌ Cancelado» (un span, arriba): se sube hasta tener un <p> que empiece
        // por «❌», que es la línea de quién canceló. El título del grupo «❌ Cancelado (n)» está más arriba que la tarjeta.
        const linea = (caja) => [...caja.querySelectorAll('p')].find((x) => x.textContent.trim().startsWith('❌'));
        let caja = n;
        while (caja && !linea(caja)) caja = caja.parentElement;
        const l = caja && linea(caja);
        out[cod] = l ? l.textContent.trim() : null;
      }
      return out;
    }, PEDIDOS.map((x) => x.cod));
    return { lineas, errores: a.errores, carpeta: a.carpeta };
  } finally { await a.cerrar(); }
}

(async () => {
  const fallos = [];
  await dejarPedidos();
  const c = await verCliente();
  const al = await verAliados();
  for (const x of PEDIDOS) {
    const enCliente = c.lista[x.cod];
    const enAliados = al.lineas[x.cod];
    console.log('#' + x.cod + ': CLIENTE «' + enCliente + '» · ALIADOS «' + enAliados + '»');
    if (enCliente == null) fallos.push('«Mis pedidos» del cliente no enseña #' + x.cod);
    if (enAliados == null) fallos.push('aliados no enseña #' + x.cod + ' en «Cancelado»');
    if (enCliente != null && quienDice(enCliente) !== x.quien) fallos.push('el cliente dice «' + enCliente + '» de #' + x.cod + ' y tenía que ser ' + x.quien);
    if (enAliados != null && quienDice(enAliados) !== x.quien) fallos.push('aliados dice «' + enAliados + '» de #' + x.cod + ' y tenía que ser ' + x.quien);
  }
  console.log('SEGUIMIENTO #VIE02: «' + c.seg.linea + '» · «' + c.seg.motivo + '»');
  if (quienDice(c.seg.linea) !== 'cliente') fallos.push('el seguimiento de #VIE02 dice «' + c.seg.linea + '» y tenía que decir «Cancelado por ti»');
  if (c.seg.motivo !== 'Motivo: ROBOT G84 viejo del cliente') fallos.push('el seguimiento de #VIE02 no enseña su motivo: «' + c.seg.motivo + '»');
  console.log('CAPTURAS:', c.carpeta, al.carpeta);
  console.log('ERRORES DE LA PÁGINA:', [...c.errores, ...al.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el cliente y el restaurante dicen lo mismo de quién canceló (nuevo, viejo del cliente y viejo sin datos)');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
