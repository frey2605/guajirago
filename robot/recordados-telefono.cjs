#!/usr/bin/env node
// 🤖 «MIS PEDIDOS» Y «MIS RESERVAS» LEEN LO QUE YA ESTÁ GUARDADO EN EL TELÉFONO — gemelo G88, 30-sep-2026.
// Desde G88 las dos listas las recuerda UNA pieza (guajirago/src/recordadosEnTelefono.js), con las mismas claves de
// siempre. Aquí, en PRUEBAS:
//   1. pasajero@gg.test deja en la base UN pedido fijo (robotG88PED01, cancelado) y UNA reserva fija (robotG88RES01,
//      cancelada). Se reusan en cada corrida.
//   2. «Mis pedidos»: el teléfono trae la lista vieja con basura dentro — [1, "robotG88PED01", null, ""]. Antes la
//      pantalla se caía (pedía a la base el pedido «1»); ahora tiene que enseñar #PED01, y lo guardado no se toca.
//   3. «Mis reservas»: el teléfono trae la forma vieja ["robotG88RES01"] → tiene que enseñarla. Luego se pone un guardado
//      roto ({"a":1}) y se vuelve a abrir → tiene que decir «Aún no tienes reservas.» (antes se quedaba en «Cargando...»).
//   node robot/recordados-telefono.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const PEDIDO = 'robotG88PED01';
const RESERVA = 'robotG88RES01';
const TOUR = 'Tour fijo del robot G88';
const CON_BASURA = JSON.stringify([1, PEDIDO, null, '']);

async function dejarDatos() {
  const base = await entrarALaBase('pasajero@gg.test');
  let existe = true;
  try { await base.leer('pedidos/' + PEDIDO); } catch (e) { existe = false; }
  if (!existe) {
    // El cliente solo puede CREAR su pedido en 'nuevo' (firestore.rules); después lo cancela, como en la app.
    await base.cambiar('pedidos/' + PEDIDO, {
      restauranteId: 'prueba-restaurante', restauranteNombre: 'Restaurante de Prueba', clienteId: base.uid,
      cliente: 'Pasajero de Prueba', telefono: '3008408484', direccion: 'Calle Robot G88', tipo: 'domicilio',
      items: [{ nombre: 'Jugo de corozo', cantidad: 1, precio: 5000 }], subtotal: 5000, total: 5000,
      estado: 'nuevo', creado: new Date().toISOString(),
    });
    await base.cambiar('pedidos/' + PEDIDO, { estado: 'cancelado', canceladoPor: 'cliente', motivoCancelacion: 'ROBOT G88 pedido fijo' });
  }
  existe = true;
  try { await base.leer('reservasTurismo/' + RESERVA); } catch (e) { existe = false; }
  if (!existe) {
    await base.cambiar('reservasTurismo/' + RESERVA, {
      agenciaId: 'prueba-agencia', clienteId: base.uid, agenciaNombre: 'Agencia de Turismo de Prueba',
      tourId: 'tour_1', tipo: 'tour', nombreTour: TOUR, imagen: '', cliente: 'Robot G88',
      telefono: '3000000001', personas: 1, fecha: '2026-10-05', total: 250000, unidadPrecio: 'persona',
      estado: 'cancelada', motivoCancelacion: 'Reserva fija del robot G88', notas: 'Reserva de mentira del robot (G88)',
      creado: new Date().toISOString(),
    });
  }
}

async function entrar(p) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
}

async function verPedidos() {
  const r = await abrir('transporte', { nombre: 'recordados-pedidos' });
  const p = r.pagina;
  try {
    await p.evaluate((v) => localStorage.setItem('misPedidosGuajira', v), CON_BASURA);
    await entrar(p);
    await p.getByText('Restaurantes', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByText('📦 Mis pedidos').first().click();
    await p.waitForTimeout(5000);
    await r.captura('mis-pedidos');
    const ve = await p.evaluate(() => ({
      pedido: [...document.querySelectorAll('p')].some((x) => x.textContent.trim().startsWith('Pedido #PED01')),
      titulo: document.body.innerText.includes('Mis pedidos'),
      guardado: localStorage.getItem('misPedidosGuajira'),
    }));
    return { ...ve, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function verReservas() {
  const r = await abrir('transporte', { nombre: 'recordados-reservas' });
  const p = r.pagina;
  try {
    await p.evaluate((v) => localStorage.setItem('misReservasGuajira', v), JSON.stringify([RESERVA]));
    await entrar(p);
    await p.getByText('Turismo', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    await p.getByText('📋 Mis reservas').first().click();
    await p.waitForTimeout(5000);
    await r.captura('mis-reservas');
    const vieja = await p.evaluate((tour) => document.body.innerText.includes(tour), TOUR);
    // Ahora un guardado roto: se vuelve a la lista y se abre otra vez «Mis reservas» (la lista se relee al abrirla).
    await p.evaluate(() => localStorage.setItem('misReservasGuajira', '{"a":1}'));
    await p.getByText('‹ Volver').first().click();
    await p.waitForTimeout(1500);
    await p.getByText('📋 Mis reservas').first().click();
    await p.waitForTimeout(4000);
    await r.captura('mis-reservas-roto');
    const roto = await p.evaluate(() => ({
      vacia: document.body.innerText.includes('Aún no tienes reservas.'),
      cargando: document.body.innerText.includes('Cargando...'),
    }));
    return { vieja, roto, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  await dejarDatos();
  const a = await verPedidos();
  const b = await verReservas();
  console.log('MIS PEDIDOS con ' + CON_BASURA + ': ¿se ve #PED01? ' + a.pedido + ' · ¿la pantalla está? ' + a.titulo + ' · queda guardado ' + a.guardado);
  console.log('MIS RESERVAS con ["' + RESERVA + '"]: ¿se ve «' + TOUR + '»? ' + b.vieja);
  console.log('MIS RESERVAS con {"a":1}: ¿dice «Aún no tienes reservas.»? ' + b.roto.vacia + ' · ¿se quedó «Cargando...»? ' + b.roto.cargando);
  if (!a.titulo) fallos.push('«Mis pedidos» no se pintó con la lista vieja con basura (antes se caía)');
  if (!a.pedido) fallos.push('«Mis pedidos» no enseña #PED01, que está en la lista guardada del teléfono');
  if (a.guardado !== CON_BASURA) fallos.push('abrir «Mis pedidos» cambió lo guardado en el teléfono: ' + a.guardado);
  if (!b.vieja) fallos.push('«Mis reservas» no enseña la reserva guardada en la forma de siempre');
  if (!b.roto.vacia || b.roto.cargando) fallos.push('con un guardado roto «Mis reservas» no dice «Aún no tienes reservas.»');
  console.log('CAPTURAS:', a.carpeta, b.carpeta);
  console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...b.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ «Mis pedidos» y «Mis reservas» leen lo ya guardado en el teléfono, y lo roto no las tumba');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
