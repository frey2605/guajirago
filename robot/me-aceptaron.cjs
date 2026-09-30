#!/usr/bin/env node
// 🤖 «ME ACEPTARON EL VIAJE» LLEGA TARDE — gemelo G24 (28-sep-2026).
// La app del conductor se entera de que el pasajero le aceptó la oferta por dos vigilantes. Hasta ese día el general
// solo creía los viajes de menos de 10 min (con el reloj del teléfono) y el de la oferta vivía 3 min, mientras el
// servidor deja aceptar hasta 20: entre los 10 y los 20 NO LO VEÍA NINGUNO, con la comisión ya cobrada.
//
// Arma ese caso en PRUEBAS, de verdad y sin tocar la pantalla del pasajero:
//   1. como el pasajero de prueba (pasajero@gg.test): crea su viaje con la fecha de solicitud de hace 12 minutos;
//   2. como el taxista de prueba (taxi@gg.test): deja su oferta en ese viaje;
//   3. abre la app como el taxista, disponible, con un GPS de mentira;
//   4. el pasajero acepta la oferta llamando a `confirmarConductor` (la única que escribe un viaje aceptado);
//   5. exige que la app del taxista diga «¡Trato hecho!» y pase a «YENDO A RECOGER» con el origen de ESTE viaje.
// Al final el taxista cancela el viaje (el servidor le quita la marca) y su ficha se deja como estaba.
// Deja en pruebas UN viaje `cancelado_conductor`, y
// los créditos del taxista de prueba quedan como estaban (saldoDePrueba de comun.cjs le da saldo para ofertar y al final le devuelve el suyo, P04).
//   node robot/me-aceptaron.cjs
const { abrir, claveDePruebas, entrarALaBase, saldoDePrueba } = require('./comun.cjs');

const MIN = 60 * 1000;
const ORIGEN = 'Calle 1 # 1-1 robot G24 ' + Date.now().toString().slice(-5);
const LAT = 11.5444;
const LNG = -72.9072;
const ID = 'robotG24' + Date.now();

const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 300),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 500); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + LAT + ',' + LNG + ');';

(async () => {
  const fallos = [];
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  // P04: sin saldo para la comisión la base no deja ofertar; se le da saldo de PRUEBA y al final se le devuelve el suyo.
  const saldo = await saldoDePrueba(tax.uid);
  const ficha = 'conductores/' + tax.uid;
  const antes = await tax.leer(ficha).catch(() => ({}));
  // Libre para que el servidor lo deje confirmar (con una marca de otro viaje contestaría «ocupado»).
  await tax.cambiar(ficha, { enViajeId: null, ocupado: false });

  // 1 y 2: el viaje, pedido hace 12 minutos, y la oferta del taxista (hace 11,5).
  const hace = (m) => new Date(Date.now() - m * MIN).toISOString();
  await pas.cambiar('viajes/' + ID, {
    pasajeroId: pas.uid, pasajeroNombre: 'Robot G24', estado: 'esperando', tipo: 'Taxi',
    origen: ORIGEN, destino: 'Terminal de transportes', pasajeroLat: LAT, pasajeroLng: LNG,
    tarifa: '$ 8.000', tarifaValor: 8000, fechaSolicitud: hace(12),
  });
  await tax.cambiar('viajes/' + ID + '/contraofertas/' + tax.uid, {
    conductorId: tax.uid, conductorNombre: 'Robot Taxi', conductorTelefono: '', conductorPlaca: 'ROB024', conductorVehiculo: 'Taxi',
    tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: hace(11.5), vigente: true,
  });
  console.log('VIAJE:', ID, '· pedido hace 12 min · oferta del taxista hace 11,5 min');

  const r = await abrir('transporte', { nombre: 'me-aceptaron', antesDeCargar });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'taxi@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Transporte y movilidad').click();
    await p.waitForTimeout(2000);
    await p.getByText('Soy conductor').click();
    await p.waitForTimeout(4000);
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }
    const estado = p.getByText(/Estoy disponible|No disponible/).first();
    if (/No disponible/.test(await estado.innerText())) {
      await estado.locator('xpath=following-sibling::div[1]').click();
      await p.waitForTimeout(1000);
    }
    await p.waitForTimeout(4000);
    await r.captura('disponible');

    // 4: el pasajero acepta, 12 minutos después de pedir (dentro de los 20 que deja el servidor).
    const res = await pas.llamar('confirmarConductor', { viajeId: ID, conductorId: tax.uid });
    console.log('CONFIRMAR (servidor de pruebas):', JSON.stringify(res));
    if (!res || res.ok !== true) fallos.push('el servidor no confirmó la oferta (' + JSON.stringify(res) + '): el recorrido no puede juzgar nada');

    // 5: la app del taxista se entera sola.
    let celebra = false;
    for (let i = 0; i < 20 && !celebra; i += 1) {
      await p.waitForTimeout(500);
      celebra = /Trato hecho/.test(await r.texto());
    }
    if (celebra) await r.captura('trato-hecho');
    await p.waitForTimeout(5000);
    const despues = await r.texto();
    await r.captura('yendo-a-recoger');
    const recoge = /YENDO A RECOGER/.test(despues) && despues.includes(ORIGEN);
    console.log('LA APP DEL TAXISTA:', celebra ? 'dice «¡Trato hecho!»' : 'NO se enteró', '·', recoge ? 'va a recoger a ESTE viaje' : 'NO está yendo a recoger este viaje');
    if (!celebra) fallos.push('el pasajero aceptó a los 12 min y la app del conductor no se enteró (la ventana ciega)');
    if (!recoge) fallos.push('la app del conductor no pasó a «YENDO A RECOGER» con el origen de este viaje');
    const viaje = await tax.leer('viajes/' + ID);
    console.log('VIAJE EN LA BASE:', JSON.stringify({ estado: viaje.estado, conductor: viaje.conductorId === tax.uid ? 'el taxista' : viaje.conductorId }));
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    await r.cerrar();
    await saldo.devolver().catch((e) => console.log('⚠ no pude devolver los créditos del taxista:', e.message));
    // El taxista lo cancela (el servidor, `onViajeCerrado`, le quita la marca) y la ficha queda como estaba.
    await tax.cambiar('viajes/' + ID, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT G24: fin del recorrido' })
      .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
    await new Promise((ok) => setTimeout(ok, 4000));
    await tax.cambiar(ficha, { enViajeId: antes.enViajeId ?? null, ocupado: antes.ocupado ?? false, activo: antes.activo ?? false });
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el pasajero acepta a los 12 min de pedir y la app del conductor se entera: «¡Trato hecho!» y a recoger');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
