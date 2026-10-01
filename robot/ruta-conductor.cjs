#!/usr/bin/env node
// 🤖 LA TARJETA DEL CONDUCTOR NO TAPA LA RUTA — gemelo G29 (28-sep-2026).
// El conductor y el pasajero tenían cada uno su mapa con ruta, casi iguales. El del pasajero encuadra la ruta dejando
// sitio abajo para su tarjeta; el del conductor no (le pasaba a Google un relleno que Google no entiende), y la ruta y
// el punto del pasajero podían quedar DEBAJO de la tarjeta del viaje.
//
// Arma el caso en PRUEBAS, de punta a punta (como espera-conductor):
//   1. abre la app como el taxista de prueba (taxi@gg.test), disponible, con un GPS de mentira en la plaza;
//   2. abre OTRA app como el pasajero de prueba (pasajero@gg.test), con su GPS 1,3 km AL SUR (al sur del mapa es donde
//      está la tarjeta: es el caso que muerde), y pide un Taxi por la pantalla;
//   3. deja el punto de recogida del viaje en ese sitio del sur (el pasajero puede escribir su viaje);
//   4. el taxista deja su oferta y el pasajero la acepta con `confirmarConductor`;
//   5. en las DOS apps, ya con la ruta pintada, mide dónde quedan los marcadores 🚗 y 📍 del mapa y dónde empieza la
//      tarjeta de abajo y acaba la barra de arriba, y exige que los dos marcadores queden en el hueco que se ve.
// Al final: el taxista cancela el viaje y su ficha queda como estaba.
// Deja en pruebas UN viaje `cancelado_conductor` y
// los créditos del taxista de prueba quedan como estaban (saldoDePrueba de comun.cjs le da saldo para ofertar y al final le devuelve el suyo, P04).
//   node robot/ruta-conductor.cjs
const { abrir, cerrarAvisoDeOfertas, claveDePruebas, entrarALaBase, saldoDePrueba } = require('./comun.cjs');

const CARRO = { lat: 11.5444, lng: -72.9072 };
const RECOGIDA = { lat: 11.5324, lng: -72.9072 };
const ORIGEN = 'Calle 1 # 1-1 robot G29 ' + Date.now().toString().slice(-5);

const gpsDeMentira = (p) => '(' + ((lat, lng) => {
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

/**
 * Dónde quedan, en la pantalla, los marcadores del mapa y el hueco que dejan la barra de arriba y la tarjeta de abajo.
 * Los marcadores son los rótulos 🚗/🏍️ y 📍 que pinta Google (un elemento cuyo texto es SOLO el emoji); la tarjeta es
 * el bloque pegado abajo (position absolute, bottom 0) más alto y la barra el pegado arriba (top 16px).
 */
async function hueco(pagina) {
  return pagina.evaluate(() => {
    const cajas = [...document.querySelectorAll('div')];
    const marca = (emojis) => cajas.filter((d) => d.children.length === 0 && emojis.includes(d.textContent.trim()))
      .map((d) => d.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => Math.round(r.top + r.height / 2));
    // 🪤 Google también pinta capas `absolute` pegadas abajo y a todo lo ancho: se cogía una y la «tarjeta» empezaba
    // en y=0. Las de la app llevan zIndex 10 escrito en su estilo; las de Google, no.
    const fijos = cajas.filter((d) => d.style.position === 'absolute' && d.style.zIndex === '10');
    const abajo = fijos.filter((d) => d.style.bottom === '0px' && d.getBoundingClientRect().width > window.innerWidth * 0.9)
      .map((d) => d.getBoundingClientRect()).sort((a, b) => b.height - a.height)[0];
    const arriba = fijos.filter((d) => d.style.top === '16px').map((d) => d.getBoundingClientRect()).sort((a, b) => b.width - a.width)[0];
    return {
      carro: marca(['🚗', '🏍️']), punto: marca(['📍']),
      tarjeta: abajo ? Math.round(abajo.top) : null, barra: arriba ? Math.round(arriba.bottom) : null, alto: window.innerHeight,
    };
  });
}

function juzgar(quien, h, fallos) {
  console.log(quien + ': barra acaba en y=' + h.barra + ' · tarjeta empieza en y=' + h.tarjeta + ' (pantalla de ' + h.alto + ')'
    + ' · 🚗 en y=' + (h.carro.join(',') || 'NO SALE') + ' · 📍 en y=' + (h.punto.join(',') || 'NO SALE'));
  if (h.tarjeta === null) { fallos.push(quien + ': no encuentro la tarjeta de abajo'); return; }
  for (const [nombre, ys] of [['el carro 🚗', h.carro], ['el punto 📍', h.punto]]) {
    if (!ys.length) { fallos.push(quien + ': ' + nombre + ' no sale en el mapa'); continue; }
    if (!ys.some((y) => y > (h.barra || 0) && y < h.tarjeta)) fallos.push(quien + ': ' + nombre + ' queda en y=' + ys.join(',') + ', fuera del hueco que se ve (' + h.barra + '–' + h.tarjeta + '): lo tapa la ' + (ys[0] >= h.tarjeta ? 'tarjeta' : 'barra'));
  }
}

(async () => {
  const fallos = [];
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  // P04: sin saldo para la comisión la base no deja ofertar; se le da saldo de PRUEBA y al final se le devuelve el suyo.
  const saldo = await saldoDePrueba(tax.uid);
  const ficha = 'conductores/' + tax.uid;
  const fichaAntes = await tax.leer(ficha).catch(() => ({}));
  let idViaje = null;
  let rc = null;
  let rp = null;
  try {
    await tax.cambiar(ficha, { enViajeId: null, ocupado: false });

    // 1: el taxista, disponible.
    rc = await abrir('transporte', { nombre: 'ruta-conductor-taxista', antesDeCargar: gpsDeMentira(CARRO) });
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

    // 2: el pasajero pide un Taxi por la pantalla (el id del viaje se saca de lo que la app le manda a Firestore).
    rp = await abrir('transporte', { nombre: 'ruta-conductor-pasajero', antesDeCargar: gpsDeMentira(RECOGIDA) });
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
    await cerrarAvisoDeOfertas(p); // P23: sin permiso de avisos sale la ventanita de las ofertas y tapa la pantalla
    const ids = [...vistos];
    if (ids.length !== 1) throw new Error('esperaba que la app del pasajero escribiera en UN viaje y nombró ' + ids.length);
    idViaje = ids[0];
    console.log('VIAJE:', idViaje);

    // 3: el punto de recogida, al sur (lo que el taxista lee al aceptar).
    await pas.cambiar('viajes/' + idViaje, { pasajeroLat: RECOGIDA.lat, pasajeroLng: RECOGIDA.lng });

    // 4: la oferta del taxista y el sí del pasajero.
    await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, {
      conductorId: tax.uid, conductorNombre: 'Robot Taxi', conductorTelefono: '', conductorPlaca: 'ROB029', conductorVehiculo: 'Taxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    });
    await p.waitForTimeout(2000);
    const res = await pas.llamar('confirmarConductor', { viajeId: idViaje, conductorId: tax.uid });
    console.log('CONFIRMAR (servidor de pruebas):', JSON.stringify(res));
    if (!res || res.ok !== true) throw new Error('el servidor no confirmó la oferta (' + JSON.stringify(res) + ')');

    let recoge = false;
    for (let i = 0; i < 30 && !recoge; i += 1) { await c.waitForTimeout(500); recoge = /YENDO A RECOGER/.test(await rc.texto()); }
    if (!recoge) throw new Error('la app del taxista no pasó a «YENDO A RECOGER»');
    // La ruta la pide Google y el encuadre llega después: se deja tiempo para las dos cosas.
    await c.waitForTimeout(9000);
    await rc.captura('taxista-yendo-a-recoger');
    await rp.captura('pasajero-conductor-en-camino');

    // 5: los marcadores contra la tarjeta, en las dos apps.
    const hc = await hueco(c);
    const hp = await hueco(p);
    juzgar('TAXISTA (yendo a recoger)', hc, fallos);
    juzgar('PASAJERO (conductor en camino)', hp, fallos);
    const sinMapa = [...rc.errores, ...rp.errores].filter((e) => /Google Maps|maps\.googleapis/i.test(e));
    if (sinMapa.length) fallos.push('Google Maps se quejó: ' + sinMapa[0]);
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    await saldo.devolver().catch((e) => console.log('⚠ no pude devolver los créditos del taxista:', e.message));
    if (rp) await rp.cerrar();
    if (idViaje) {
      await tax.cambiar('viajes/' + idViaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT G29: fin del recorrido' })
        .catch(() => pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT G29: fin del recorrido' }))
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 4000));
    }
    await tax.cambiar(ficha, { enViajeId: fichaAntes.enViajeId ?? null, ocupado: fichaAntes.ocupado ?? false, activo: fichaAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ en las dos apps el carro y el punto de recogida quedan en el hueco entre la barra y la tarjeta');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
