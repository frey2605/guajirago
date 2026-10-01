#!/usr/bin/env node
// 🤖 EL TELÉFONO DE QUIEN RECIBE SOLO LO VE EL REPARTIDOR ACEPTADO — P21 (1-oct-2026).
// Antes un viaje del mercado llevaba dentro el correo del pasajero, el teléfono de quien recibe un mandado y el token de
// avisos, y la tarjeta del mercado le enseñaba el teléfono a cualquier repartidor ANTES de aceptar. Ahora el correo no
// se escribe y el teléfono y el token van al cajón `viajes/{id}/contacto/pasajero`.
//
// Arma el caso en PRUEBAS, de punta a punta (como carro-en-vivo):
//   1. abre la app como el mototaxista de prueba, disponible, con un GPS de mentira;
//   2. abre otra app como el pasajero de prueba y pide un MANDADO por la pantalla (con nombre y teléfono de quien recibe);
//   3. el viaje del mercado NO lleva correo ni teléfono; la tarjeta del mercado del repartidor enseña a quién se
//      entrega pero NO el teléfono; el repartidor NO puede leer el cajón; el pasajero y el panel SÍ;
//   4. el repartidor oferta y el pasajero acepta con `confirmarConductor`;
//   5. el repartidor ya ve «Llamar a quien recibe (<teléfono>)» y lee el cajón; otra pasajera, no;
//   6. se termina el viaje (cancelado por el repartidor) y el repartidor ya NO lee el cajón; el pasajero sí.
// Deja en pruebas UN viaje `cancelado_conductor`; los créditos y la ficha del repartidor quedan como estaban.
//   node robot/contacto-del-viaje.cjs
const { abrir, cerrarAvisoDeOfertas, claveDePruebas, entrarALaBase, saldoDePrueba } = require('./comun.cjs');

const MOTO = { lat: 11.5444, lng: -72.9072 };
const RECOGIDA = { lat: 11.5324, lng: -72.9072 };
const SELLO = Date.now().toString().slice(-5);
const ORIGEN = 'Calle 1 # 1-1 robot P21 ' + SELLO;
const RECIBE = 'ROSA ROBOT ' + SELLO;
const TELEFONO = '3001112233';

const gps = (p) => '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 300),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 500); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + p.lat + ',' + p.lng + ');';

async function entrar(p, correo) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', correo);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
}

/** ¿La base de pruebas le niega esa lectura a esa persona? */
async function negado(quien, ruta) {
  try { await quien.leer(ruta); return false; } catch (e) { return /rechazó/.test(e.message) && /(PERMISSION_DENIED|permission|403|insufficient)/i.test(e.message); }
}

/** Entrar a la base, con hasta 4 intentos si Google contesta «The service is currently unavailable» (pasó el 1-oct-2026). */
async function entrarConPaciencia(correo) {
  for (let i = 1; ; i += 1) {
    try { return await entrarALaBase(correo); } catch (e) {
      if (i >= 4 || !/unavailable/i.test(e.message)) throw e;
      console.log('⚠ ' + correo + ': Google no está disponible, reintento ' + i + ' en ' + (i * 10) + ' s');
      await new Promise((ok) => setTimeout(ok, i * 10000));
    }
  }
}

(async () => {
  const fallos = [];
  const pas = await entrarConPaciencia('pasajero@gg.test');
  const moto = await entrarConPaciencia('moto@gg.test');
  const otra = await entrarConPaciencia('pasajera@gg.test');
  const adm = await entrarConPaciencia('admin@gg.test');
  const saldo = await saldoDePrueba(moto.uid);
  const ficha = 'conductores/' + moto.uid;
  const fichaAntes = await moto.leer(ficha).catch(() => ({}));
  let idViaje = null;
  let cancelado = false;
  let rc = null;
  let rp = null;
  try {
    await moto.cambiar(ficha, { enViajeId: null, ocupado: false });

    // 1: el mototaxista, disponible.
    rc = await abrir('transporte', { nombre: 'contacto-del-viaje-repartidor', antesDeCargar: gps(MOTO) });
    const c = rc.pagina;
    await entrar(c, 'moto@gg.test');
    await c.getByText('Transporte y movilidad').click();
    await c.waitForTimeout(2000);
    await c.getByText('Soy conductor').click();
    await c.waitForTimeout(4000);
    const entendido = c.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await c.waitForTimeout(500); }
    const estado = c.getByText(/Estoy disponible|No disponible/).first();
    if (/No disponible/.test(await estado.innerText())) {
      await estado.locator('xpath=following-sibling::div[1]').click();
      await c.waitForTimeout(1000);
    }

    // 2: el pasajero pide un mandado por la pantalla.
    rp = await abrir('transporte', { nombre: 'contacto-del-viaje-pasajero', antesDeCargar: gps(RECOGIDA) });
    const p = rp.pagina;
    const vistos = new Set();
    p.on('request', (req) => {
      let b = '';
      try { b = decodeURIComponent(req.postData() || ''); } catch (e) { b = req.postData() || ''; }
      for (const m of b.matchAll(/documents\/viajes\/([A-Za-z0-9]{20})/g)) vistos.add(m[1]);
    });
    await entrar(p, 'pasajero@gg.test');
    await p.getByText('Mensajería y Mandados', { exact: true }).first().click();
    await p.waitForTimeout(2500);
    await p.getByText('Quiero enviar algo', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.fill('input[placeholder="¿Dónde se recoge? (Riohacha)"]', ORIGEN);
    await p.fill('input[placeholder="¿Dónde se entrega? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.fill('input[placeholder="¿Qué envías? (ej: una caja)"]', 'Documentos del robot');
    await p.fill('input[placeholder="NOMBRE DE QUIEN RECIBE"]', RECIBE);
    await p.fill('input[placeholder="Teléfono (10 números)"]', TELEFONO);
    await p.fill('input[placeholder="Nota para el domiciliario (ej: dejar en portería)"]', 'Timbrar');
    await p.waitForTimeout(1500);
    await rp.captura('pasajero-llena-el-mandado');
    await p.getByRole('button', { name: /^Pedir mandado/ }).click();
    await p.waitForTimeout(6000);
    await cerrarAvisoDeOfertas(p); // P23: sin permiso de avisos sale la ventanita de las ofertas y tapa la pantalla
    const ids = [...vistos];
    if (ids.length !== 1) throw new Error('esperaba que la app del pasajero escribiera en UN viaje y nombró ' + ids.length + ': ' + ids.join(', '));
    idViaje = ids[0];
    console.log('VIAJE:', idViaje);
    const viaje = 'viajes/' + idViaje;
    const contacto = viaje + '/contacto/pasajero';
    await pas.cambiar(viaje, { pasajeroLat: RECOGIDA.lat, pasajeroLng: RECOGIDA.lng });

    // 3: lo que hay en el mercado, y quién lee el cajón antes de aceptar.
    const enMercado = await moto.leer(viaje);
    const lleva = Object.keys(enMercado).filter((k) => /pasajero/i.test(k)).sort();
    console.log('EL REPARTIDOR LEE DEL MERCADO · campos del pasajero:', lleva.join(', '), '· mensajeria:', JSON.stringify(enMercado.mensajeria));
    if ('pasajeroEmail' in enMercado) fallos.push('el viaje del mercado lleva el correo del pasajero');
    if (enMercado.mensajeria && enMercado.mensajeria.recibeTel) fallos.push('el viaje del mercado lleva el teléfono de quien recibe');
    if ('pasajeroFcmToken' in enMercado) fallos.push('el viaje del mercado lleva el token de avisos del pasajero');
    if (!enMercado.mensajeria || enMercado.mensajeria.recibeNombre !== RECIBE) fallos.push('el mercado perdió el nombre de quien recibe (lo necesita para decidir)');
    const delPasajero = await pas.leer(contacto).catch((e) => ({ error: e.message }));
    console.log('CAJÓN (lo lee el pasajero):', JSON.stringify({ ...delPasajero, pasajeroFcmToken: delPasajero.pasajeroFcmToken ? '(hay)' : undefined }));
    if (delPasajero.recibeTel !== TELEFONO) fallos.push('el cajón no tiene el teléfono de quien recibe (' + JSON.stringify(delPasajero) + ')');
    const delPanel = await adm.leer(contacto).catch((e) => ({ error: e.message }));
    if (delPanel.recibeTel !== TELEFONO) fallos.push('el panel no lee el cajón (' + JSON.stringify(delPanel) + ')');
    const motoAntes = await negado(moto, contacto);
    console.log('CAJÓN antes de aceptar · el repartidor: ' + (motoAntes ? 'negado ✓' : 'LO LEE'));
    if (!motoAntes) fallos.push('el repartidor del mercado lee el cajón antes de que lo acepten');
    let tarjeta = false;
    for (let i = 0; i < 20 && !tarjeta; i += 1) { await c.waitForTimeout(500); tarjeta = (await rc.texto()).includes(RECIBE); }
    await rc.captura('repartidor-ve-el-mandado-en-el-mercado');
    const textoMercado = await rc.texto();
    console.log('TARJETA DEL MERCADO · sale el mandado: ' + (tarjeta ? 'sí' : 'NO') + ' · enseña el teléfono: ' + (textoMercado.includes(TELEFONO) ? 'SÍ' : 'no ✓'));
    if (!tarjeta) fallos.push('el mototaxista no ve el mandado en su mercado');
    if (textoMercado.includes(TELEFONO)) fallos.push('la tarjeta del mercado enseña el teléfono de quien recibe');

    // 4: la oferta del repartidor y el sí del pasajero.
    await moto.cambiar(viaje + '/contraofertas/' + moto.uid, {
      conductorId: moto.uid, conductorNombre: 'Robot Moto', conductorTelefono: '', conductorPlaca: 'ROB021', conductorVehiculo: 'Mototaxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    });
    await p.waitForTimeout(2000);
    const res = await pas.llamar('confirmarConductor', { viajeId: idViaje, conductorId: moto.uid });
    console.log('CONFIRMAR (servidor de pruebas):', JSON.stringify(res));
    if (!res || res.ok !== true) throw new Error('el servidor no confirmó la oferta (' + JSON.stringify(res) + ')');

    // 5: el repartidor aceptado ve el teléfono y lee el cajón; otra pasajera no.
    let llamar = false;
    for (let i = 0; i < 30 && !llamar; i += 1) { await c.waitForTimeout(500); llamar = (await rc.texto()).includes('Llamar a quien recibe (' + TELEFONO + ')'); }
    await rc.captura('repartidor-aceptado-ve-el-telefono');
    console.log('REPARTIDOR ACEPTADO · «Llamar a quien recibe (' + TELEFONO + ')»: ' + (llamar ? 'sí ✓' : 'NO SALE'));
    if (!llamar) fallos.push('el repartidor aceptado no ve el botón para llamar a quien recibe con su teléfono');
    const motoDespues = await moto.leer(contacto).catch((e) => ({ error: e.message }));
    if (motoDespues.recibeTel !== TELEFONO) fallos.push('el repartidor aceptado no lee el cajón (' + JSON.stringify(motoDespues) + ')');
    if (!(await negado(otra, contacto))) fallos.push('otra pasajera lee el cajón');

    // 6: se termina el viaje: el repartidor deja de leer el cajón; el pasajero no.
    await moto.cambiar(viaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT P21: fin del recorrido' });
    cancelado = true;
    await c.waitForTimeout(3000);
    const motoFin = await negado(moto, contacto);
    const pasFin = await pas.leer(contacto).catch((e) => ({ error: e.message }));
    console.log('VIAJE TERMINADO · el repartidor lee el cajón: ' + (motoFin ? 'negado ✓' : 'TODAVÍA LO LEE') + ' · el pasajero: ' + (pasFin.recibeTel === TELEFONO ? 'lo lee ✓' : 'NO'));
    if (!motoFin) fallos.push('con el viaje terminado el repartidor todavía lee el teléfono de quien recibe');
    if (pasFin.recibeTel !== TELEFONO) fallos.push('el pasajero dejó de leer su cajón');
    console.log('ERRORES DE LA PÁGINA (repartidor):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    await saldo.devolver().catch((e) => console.log('⚠ no pude devolver los créditos del repartidor:', e.message));
    if (rp) await rp.cerrar();
    if (idViaje && !cancelado) {
      await moto.cambiar('viajes/' + idViaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT P21: fin del recorrido' })
        .catch(() => pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT P21: fin del recorrido' }))
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 4000));
    }
    await moto.cambiar(ficha, { enViajeId: fichaAntes.enViajeId ?? null, ocupado: fichaAntes.ocupado ?? false, activo: fichaAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del repartidor como estaba:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el mercado no lleva correo, teléfono ni token; el teléfono de quien recibe solo lo ven el pasajero, el panel y el repartidor ya aceptado');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
