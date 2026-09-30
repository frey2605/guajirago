#!/usr/bin/env node
// 🤖 LOS MÉTODOS DE PAGO SALEN DE UNA PIEZA — gemelo G85, 30-sep-2026.
// La lista «Efectivo, Nequi, Daviplata, Tarjeta» estaba escrita a mano en la app (Restaurantes.js), en aliados
// (flujoPedidos.js) y cinco veces dentro de Mesero.js. Desde G85 vive en guajirago/src/estadosPedido.js, con copia
// atada en guajirago-aliados/src/flujoPedidos.js. Aquí, en PRUEBAS:
//   1. el pasajero de prueba → Restaurantes → Restaurante de Prueba → echa un plato, y se leen los botones de
//      «¿cómo vas a pagar?» (NO pide nada);
//   2. el restaurante de prueba: si no tiene mesas, se le pone UNA (y al final se le devuelve el número que tenía), y se
//      deja en la Mesa 1 un pedido FIJO abierto (robotG85MESA1, un jugo de $ 5.000; se reusa en cada corrida);
//   3. aliados → «Tomar pedido» → Mesa 1 → «💳 Cerrar mesa»: se leen los métodos del cobro, se escribe 5.000 en
//      Efectivo y «Confirmar cierre»; y se lee el pedido guardado: tiene que quedar metodoPago «Efectivo» y
//      pagos [{ Efectivo, 5000 }].
//   Los dos lados tienen que ofrecer los MISMOS cuatro métodos, en el mismo orden.
//   node robot/metodos-pago.cjs
const { abrir, claveDePruebas, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');

const METODOS = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];
const NEGOCIO = 'negocios/prueba-restaurante';
const PEDIDO = 'pedidos/robotG85MESA1';

async function verApp() {
  const r = await abrir('transporte', { nombre: 'metodos-pago-cliente' });
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
    await r.captura('carrito');
    // Los botones de pago son los hermanos del que dice «Efectivo».
    const metodos = await p.evaluate(() => {
      const e = [...document.querySelectorAll('span')].find((x) => x.textContent.trim() === 'Efectivo');
      return e ? [...e.parentElement.children].map((x) => x.textContent.trim()) : null;
    });
    return { metodos, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function verMesero(base) {
  const a = await abrir('aliados', { nombre: 'metodos-pago-mesero' });
  const p = a.pagina;
  try {
    await entrarComoRestaurante(p);
    if (!(await p.getByText('Tomar pedido', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Tomar pedido', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByRole('button', { name: /Mesa 1\b/ }).first().click();
    await p.waitForTimeout(4000);
    await a.captura('mesa');
    await p.getByRole('button', { name: '💳 Cerrar mesa' }).click();
    await p.waitForTimeout(1500);
    // Cada método del cobro es un renglón: su nombre (span) y la caja del monto (input con «0»).
    const metodos = await p.evaluate(() => [...document.querySelectorAll('input[placeholder="0"]')]
      .map((i) => { const fila = i.parentElement && i.parentElement.parentElement; const s = fila && fila.querySelector(':scope > span'); return s ? s.textContent.trim() : null; })
      .filter(Boolean));
    const efectivo = p.locator('span', { hasText: /^Efectivo$/ }).locator('xpath=..').locator('input[placeholder="0"]');
    await efectivo.first().fill('5000');
    await p.waitForTimeout(500);
    await a.captura('cobro');
    await p.getByRole('button', { name: 'Confirmar cierre' }).click();
    await p.waitForTimeout(6000);
    await a.captura('cerrada');
    const guardado = await base.leer(PEDIDO);
    return { metodos, guardado, errores: a.errores, carpeta: a.carpeta };
  } finally { await a.cerrar(); }
}

(async () => {
  const fallos = [];
  const c = await verApp();
  console.log('APP · ¿cómo vas a pagar?: ' + JSON.stringify(c.metodos) + ' · capturas', c.carpeta);
  if (JSON.stringify(c.metodos) !== JSON.stringify(METODOS)) fallos.push('la app ofrece ' + JSON.stringify(c.metodos) + ' y tenía que ofrecer ' + JSON.stringify(METODOS));

  const base = await entrarALaBase('restaurante@gg.test');
  const negocio = await base.leer(NEGOCIO);
  const mesasAntes = negocio.numeroMesas || 0;
  let m = null;
  try {
    if (mesasAntes < 1) await base.cambiar(NEGOCIO, { numeroMesas: 1 });
    await base.cambiar(PEDIDO, {
      restauranteId: 'prueba-restaurante', tipo: 'local', mesa: 1, estado: 'tomado', tomadoPor: 'Robot G85',
      items: [{ nombre: 'Jugo de corozo', cantidad: 1, precio: 5000 }], total: 5000, mensajesPedido: [],
      creado: new Date().toISOString(), metodoPago: null, pagos: null, fechaCierre: null,
    });
    m = await verMesero(base);
  } finally {
    if (mesasAntes < 1) await base.cambiar(NEGOCIO, { numeroMesas: mesasAntes });
  }
  console.log('ALIADOS · cerrar la mesa: ' + JSON.stringify(m.metodos) + ' · capturas', m.carpeta);
  console.log('PEDIDO GUARDADO: estado «' + m.guardado.estado + '» · metodoPago «' + m.guardado.metodoPago + '» · pagos ' + JSON.stringify(m.guardado.pagos));
  if (JSON.stringify(m.metodos) !== JSON.stringify(METODOS)) fallos.push('el cobro de la mesa ofrece ' + JSON.stringify(m.metodos) + ' y tenía que ofrecer ' + JSON.stringify(METODOS));
  if (m.guardado.estado !== 'cerrado') fallos.push('la mesa no quedó cerrada: ' + m.guardado.estado);
  if (m.guardado.metodoPago !== 'Efectivo') fallos.push('el pedido guardó metodoPago «' + m.guardado.metodoPago + '» y tenía que ser «Efectivo»');
  if (JSON.stringify(m.guardado.pagos) !== JSON.stringify([{ metodo: 'Efectivo', monto: 5000 }])) fallos.push('el pedido guardó pagos ' + JSON.stringify(m.guardado.pagos));
  console.log('NÚMERO DE MESAS DEL RESTAURANTE: ' + mesasAntes + ' antes, devuelto a ' + mesasAntes);
  console.log('ERRORES DE LA PÁGINA:', [...c.errores, ...m.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la app y el cobro de la mesa ofrecen los mismos cuatro métodos, y la mesa se cierra en Efectivo');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
