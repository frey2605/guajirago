#!/usr/bin/env node
// 🤖 EL PASAJERO VE MOVERSE EL CARRO, PERO YA NO LEE LA FICHA DEL CONDUCTOR — P19 (1-oct-2026).
// Antes el mapa del pasajero seguía al carro leyendo la ficha del conductor (`conductores/{uid}`), y por eso esa ficha
// (teléfono, placa, token de avisos, ubicación) la leía cualquiera con sesión. Ahora el GPS del conductor escribe su
// posición en el viaje vivo (`viajes/{id}/enVivo/conductor`) y el pasajero la lee de ahí.
//
// Arma el caso en PRUEBAS, de punta a punta (como ruta-conductor):
//   1. abre la app como el taxista de prueba, disponible, con un GPS de mentira que se puede MOVER;
//   2. abre otra app como el pasajero de prueba (1,3 km al sur) y pide un Taxi por la pantalla;
//   3. el taxista oferta y el pasajero acepta con `confirmarConductor`;
//   4. en la pantalla del pasajero sale el 🚗; se mueve el GPS del taxista 600 m al ESTE y el 🚗 tiene que correrse a
//      la derecha del 📍 (antes estaban en la misma vertical), y el viaje vivo dice la posición nueva;
//   5. el pasajero (y otra cuenta cualquiera) NO pueden leer la ficha del taxista;
//   6. se cancela el viaje y el pasajero ya NO puede leer dónde va el carro.
// Deja en pruebas UN viaje `cancelado_conductor`; los créditos y la ficha del taxista quedan como estaban.
//   node robot/carro-en-vivo.cjs
const { abrir, claveDePruebas, entrarALaBase, saldoDePrueba } = require('./comun.cjs');

const CARRO = { lat: 11.5444, lng: -72.9072 };
const MOVIDO = { lat: 11.5444, lng: -72.9017 };
const RECOGIDA = { lat: 11.5324, lng: -72.9072 };
const ORIGEN = 'Calle 1 # 1-1 robot P19 ' + Date.now().toString().slice(-5);

// Un GPS de mentira que se puede mover desde fuera: window.__moverGps(lat, lng) avisa a todos los que lo siguen.
const gpsMovible = (p) => '(' + ((lat, lng) => {
  const estado = { lat, lng, oyentes: [] };
  const pos = () => ({ coords: { latitude: estado.lat, longitude: estado.lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 300),
    watchPosition: (ok) => { estado.oyentes.push(ok); setTimeout(() => ok(pos()), 500); return estado.oyentes.length; },
    clearWatch: (id) => { estado.oyentes[id - 1] = null; },
  };
  window.__moverGps = (la, ln) => { estado.lat = la; estado.lng = ln; estado.oyentes.forEach((f) => f && f(pos())); };
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

/** Dónde quedan en la pantalla el 🚗 y el 📍 del mapa (centro de cada rótulo). */
async function marcas(pagina) {
  return pagina.evaluate(() => {
    const cajas = [...document.querySelectorAll('div')];
    const de = (emojis) => cajas.filter((d) => d.children.length === 0 && emojis.includes(d.textContent.trim()))
      .map((d) => d.getBoundingClientRect()).filter((r) => r.width > 0)
      .map((r) => ({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }));
    return { carro: de(['🚗', '🏍️']), punto: de(['📍']) };
  });
}

/** ¿La base de pruebas le niega esa lectura a esa persona? */
async function negado(quien, ruta) {
  try { await quien.leer(ruta); return false; } catch (e) { return /rechazó/.test(e.message) && /(PERMISSION_DENIED|permission|403|insufficient)/i.test(e.message); }
}

(async () => {
  const fallos = [];
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  const otra = await entrarALaBase('restaurante@gg.test');
  const saldo = await saldoDePrueba(tax.uid);
  const ficha = 'conductores/' + tax.uid;
  const fichaAntes = await tax.leer(ficha).catch(() => ({}));
  let idViaje = null;
  let cancelado = false;
  let rc = null;
  let rp = null;
  try {
    await tax.cambiar(ficha, { enViajeId: null, ocupado: false });

    // 1: el taxista, disponible.
    rc = await abrir('transporte', { nombre: 'carro-en-vivo-taxista', antesDeCargar: gpsMovible(CARRO) });
    const c = rc.pagina;
    await entrar(c, 'taxi@gg.test');
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

    // 2: el pasajero pide un Taxi por la pantalla.
    rp = await abrir('transporte', { nombre: 'carro-en-vivo-pasajero', antesDeCargar: gpsMovible(RECOGIDA) });
    const p = rp.pagina;
    const vistos = new Set();
    p.on('request', (req) => {
      let b = '';
      try { b = decodeURIComponent(req.postData() || ''); } catch (e) { b = req.postData() || ''; }
      for (const m of b.matchAll(/documents\/viajes\/([A-Za-z0-9]{20})/g)) vistos.add(m[1]);
    });
    await entrar(p, 'pasajero@gg.test');
    for (const paso of ['Transporte y movilidad', 'Soy pasajero']) {
      const x = p.getByText(paso, { exact: true });
      if (await x.count()) { await x.first().click(); await p.waitForTimeout(2500); }
    }
    await p.getByText('Taxi', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.fill('input[placeholder="¿Dónde estás? (Riohacha)"]', ORIGEN);
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: /^Solicitar Taxi/ }).click();
    await p.waitForTimeout(6000);
    const ids = [...vistos];
    if (ids.length !== 1) throw new Error('esperaba que la app del pasajero escribiera en UN viaje y nombró ' + ids.length);
    idViaje = ids[0];
    console.log('VIAJE:', idViaje);
    await pas.cambiar('viajes/' + idViaje, { pasajeroLat: RECOGIDA.lat, pasajeroLng: RECOGIDA.lng });

    // 3: la oferta del taxista y el sí del pasajero.
    await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, {
      conductorId: tax.uid, conductorNombre: 'Robot Taxi', conductorTelefono: '', conductorPlaca: 'ROB019', conductorVehiculo: 'Taxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    });
    await p.waitForTimeout(2000);
    const res = await pas.llamar('confirmarConductor', { viajeId: idViaje, conductorId: tax.uid });
    console.log('CONFIRMAR (servidor de pruebas):', JSON.stringify(res));
    if (!res || res.ok !== true) throw new Error('el servidor no confirmó la oferta (' + JSON.stringify(res) + ')');
    let recoge = false;
    for (let i = 0; i < 30 && !recoge; i += 1) { await c.waitForTimeout(500); recoge = /YENDO A RECOGER/.test(await rc.texto()); }
    if (!recoge) throw new Error('la app del taxista no pasó a «YENDO A RECOGER»');
    await c.waitForTimeout(9000);

    // 4a: el carro sale en la pantalla del pasajero, encima del 📍 (misma vertical).
    const enVivo = 'viajes/' + idViaje + '/enVivo/conductor';
    const antes = await pas.leer(enVivo).catch((e) => ({ error: e.message }));
    console.log('VIAJE VIVO (lo lee el pasajero):', JSON.stringify(antes));
    if (antes.error || Math.abs(antes.lat - CARRO.lat) > 0.0005 || Math.abs(antes.lng - CARRO.lng) > 0.0005) fallos.push('el viaje vivo no tiene la posición del taxista (' + JSON.stringify(antes) + ')');
    const m1 = await marcas(p);
    await rp.captura('pasajero-carro-al-norte');
    console.log('PASAJERO antes de moverse: 🚗', JSON.stringify(m1.carro), '· 📍', JSON.stringify(m1.punto));
    if (!m1.carro.length) fallos.push('el pasajero no ve el 🚗 en el mapa');

    // 4b: el taxista se mueve 600 m al este: el 🚗 del pasajero se corre a la derecha del 📍.
    await c.evaluate(([la, ln]) => window.__moverGps(la, ln), [MOVIDO.lat, MOVIDO.lng]);
    await c.waitForTimeout(10000);
    const despues = await pas.leer(enVivo).catch((e) => ({ error: e.message }));
    console.log('VIAJE VIVO tras moverse:', JSON.stringify(despues));
    if (despues.error || Math.abs(despues.lng - MOVIDO.lng) > 0.0005) fallos.push('el viaje vivo no se actualizó con la posición nueva (' + JSON.stringify(despues) + ')');
    const m2 = await marcas(p);
    await rp.captura('pasajero-carro-movido-al-este');
    console.log('PASAJERO tras moverse: 🚗', JSON.stringify(m2.carro), '· 📍', JSON.stringify(m2.punto));
    if (!m2.carro.length || !m2.punto.length) fallos.push('tras moverse no salen el 🚗 y el 📍');
    else {
      const dx1 = m1.carro.length && m1.punto.length ? m1.carro[0].x - m1.punto[0].x : null;
      const dx2 = m2.carro[0].x - m2.punto[0].x;
      console.log('🚗 respecto al 📍 (px a la derecha): antes ' + dx1 + ' · después ' + dx2);
      if (!(dx2 > 25)) fallos.push('el 🚗 no se movió al este en la pantalla del pasajero (queda ' + dx2 + ' px a la derecha del 📍)');
    }

    // 5: la ficha del taxista ya no la lee el pasajero, ni otra cuenta cualquiera.
    const fichaPas = await negado(pas, ficha);
    const fichaOtra = await negado(otra, ficha);
    console.log('FICHA DEL TAXISTA · el pasajero: ' + (fichaPas ? 'negada ✓' : 'LA LEE') + ' · otra cuenta: ' + (fichaOtra ? 'negada ✓' : 'LA LEE'));
    if (!fichaPas) fallos.push('el pasajero todavía puede leer la ficha del taxista (teléfono, token)');
    if (!fichaOtra) fallos.push('otra cuenta cualquiera todavía puede leer la ficha del taxista');
    if (!(await negado(otra, enVivo))) fallos.push('otra cuenta cualquiera puede ver el carro del viaje del pasajero');

    // 6: se acaba el viaje: el pasajero deja de ver el carro.
    await tax.cambiar('viajes/' + idViaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT P19: fin del recorrido' });
    cancelado = true;
    await c.waitForTimeout(3000);
    const tras = await negado(pas, enVivo);
    console.log('VIAJE TERMINADO · el pasajero lee el carro: ' + (tras ? 'negado ✓' : 'TODAVÍA LO LEE'));
    if (!tras) fallos.push('con el viaje terminado el pasajero todavía ve dónde va el carro');
    const sinMapa = [...rc.errores, ...rp.errores].filter((e) => /Google Maps|maps\.googleapis/i.test(e));
    if (sinMapa.length) fallos.push('Google Maps se quejó: ' + sinMapa[0]);
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    await saldo.devolver().catch((e) => console.log('⚠ no pude devolver los créditos del taxista:', e.message));
    if (rp) await rp.cerrar();
    if (idViaje && !cancelado) {
      await tax.cambiar('viajes/' + idViaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT P19: fin del recorrido' })
        .catch(() => pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT P19: fin del recorrido' }))
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 4000));
    }
    await tax.cambiar(ficha, { enViajeId: fichaAntes.enViajeId ?? null, ocupado: fichaAntes.ocupado ?? false, activo: fichaAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el pasajero ve moverse el carro desde el viaje vivo, y la ficha del taxista ya no la lee nadie más que él');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
