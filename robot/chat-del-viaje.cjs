#!/usr/bin/env node
// 🤖 EL CHAT DEL VIAJE, DE LOS DOS LADOS — gemelo G96 (30-sep-2026).
// Escuchar y enviar el chat del viaje estaba copiado en la app del conductor y en la del pasajero; desde G96 las dos
// usan la misma pieza (guajirago/src/chatDelViaje.js). Qué se escribe en la base lo compara, caso por caso,
// scripts/medir-chat-del-viaje.cjs (pruebas/chatDelViaje.test.js). Este robot mira lo que ve una persona:
//   1. abre la app como el taxista de prueba (taxi@gg.test), disponible, con un GPS de mentira;
//   2. abre OTRA app como el pasajero de prueba (pasajero@gg.test) y pide un Taxi por la pantalla;
//   3. el taxista deja su oferta y el pasajero la acepta con `confirmarConductor` (como en espera-conductor);
//   4. el taxista escribe en el chat y lo manda con la tecla ENTER;
//   5. el pasajero abre «💬 Chat con el conductor», lo ve, contesta y lo manda con el botón ➤;
//   6. exige que cada uno vea los DOS mensajes, que el campo quede vacío tras enviar y que no salga ninguna ventanita
//      de error.
// Al final: el taxista cancela el viaje y su ficha queda como estaba. Deja en pruebas UN viaje `cancelado_conductor` con
// dos mensajes, y los créditos del taxista de prueba quedan como estaban (saldoDePrueba de comun.cjs le da saldo para ofertar y al final le devuelve el suyo, P04).
//   node robot/chat-del-viaje.cjs
const { abrir, claveDePruebas, entrarALaBase, saldoDePrueba } = require('./comun.cjs');

const LAT = 11.5444;
const LNG = -72.9072;
const MARCA = Date.now().toString().slice(-5);
const ORIGEN = 'Calle 1 # 1-1 robot G96 ' + MARCA;
const DEL_TAXISTA = 'Voy en camino ' + MARCA;
const DEL_PASAJERO = 'Te espero en la puerta ' + MARCA;

const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 300),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 500); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + LAT + ',' + LNG + ');';

async function entrar(p, correo) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', correo);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
}

async function esperarTexto(r, texto, veces = 30) {
  for (let i = 0; i < veces; i += 1) {
    if ((await r.texto()).includes(texto)) return true;
    await r.pagina.waitForTimeout(500);
  }
  return false;
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
    rc = await abrir('transporte', { nombre: 'chat-del-viaje-taxista', antesDeCargar });
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
    rp = await abrir('transporte', { nombre: 'chat-del-viaje-pasajero', antesDeCargar });
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

    // 3: la oferta del taxista y el sí del pasajero.
    await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, {
      conductorId: tax.uid, conductorNombre: 'Robot Taxi', conductorTelefono: '', conductorPlaca: 'ROB096', conductorVehiculo: 'Taxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    });
    await p.waitForTimeout(2000);
    const res = await pas.llamar('confirmarConductor', { viajeId: idViaje, conductorId: tax.uid });
    console.log('CONFIRMAR (servidor de pruebas):', JSON.stringify(res));
    if (!res || res.ok !== true) throw new Error('el servidor no confirmó la oferta (' + JSON.stringify(res) + ')');
    if (!(await esperarTexto(rc, 'YENDO A RECOGER'))) throw new Error('la app del taxista no pasó a «YENDO A RECOGER»');
    await c.waitForTimeout(3000);

    // 4: el taxista escribe y manda con ENTER.
    const campoTaxista = c.locator('input[placeholder="Escribe un mensaje..."]:visible').first();
    await campoTaxista.fill(DEL_TAXISTA);
    await campoTaxista.press('Enter');
    await c.waitForTimeout(2500);
    const quedoTaxista = await campoTaxista.inputValue();
    if (quedoTaxista !== '') fallos.push('tras enviar con Enter, el campo del taxista no quedó vacío: «' + quedoTaxista + '»');

    // 5: el pasajero abre el chat, lo ve, contesta con el botón ➤.
    const abrirChat = p.getByRole('button', { name: /Chat con el conductor/ });
    await abrirChat.waitFor({ timeout: 20000 });
    const etiqueta = await abrirChat.innerText();
    console.log('BOTÓN DEL PASAJERO:', etiqueta.trim());
    if (!/\(1\)/.test(etiqueta)) fallos.push('el botón del chat del pasajero no cuenta el mensaje del taxista: «' + etiqueta.trim() + '»');
    await abrirChat.click();
    await p.waitForTimeout(1000);
    if (!(await esperarTexto(rp, DEL_TAXISTA, 20))) fallos.push('el pasajero no ve el mensaje del taxista');
    const campoPasajero = p.locator('input[placeholder="Escribe un mensaje..."]:visible').first();
    await campoPasajero.fill(DEL_PASAJERO);
    await campoPasajero.locator('xpath=following-sibling::button[1]').click();
    await p.waitForTimeout(2500);
    const quedoPasajero = await campoPasajero.inputValue();
    if (quedoPasajero !== '') fallos.push('tras enviar con ➤, el campo del pasajero no quedó vacío: «' + quedoPasajero + '»');

    // 6: los dos ven los dos.
    if (!(await esperarTexto(rp, DEL_PASAJERO, 20))) fallos.push('el pasajero no ve su propio mensaje');
    if (!(await esperarTexto(rc, DEL_PASAJERO, 20))) fallos.push('el taxista no ve la respuesta del pasajero');
    if (!(await rc.texto()).includes(DEL_TAXISTA)) fallos.push('el taxista no ve su propio mensaje');
    for (const [r, quien] of [[rc, 'taxista'], [rp, 'pasajero']]) {
      const t = await r.texto();
      if (/No se pudo (enviar el mensaje|recibir los mensajes del chat)/.test(t)) fallos.push('al ' + quien + ' le salió una ventanita de error del chat');
    }
    await rc.captura('taxista-chat');
    await rp.captura('pasajero-chat');
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    await saldo.devolver().catch((e) => console.log('⚠ no pude devolver los créditos del taxista:', e.message));
    if (rp) await rp.cerrar();
    if (idViaje) {
      await tax.cambiar('viajes/' + idViaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT G96: fin del recorrido' })
        .catch(() => pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT G96: fin del recorrido' }))
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 4000));
    }
    await tax.cambiar(ficha, { enViajeId: fichaAntes.enViajeId ?? null, ocupado: fichaAntes.ocupado ?? false, activo: fichaAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el taxista escribe con Enter, el pasajero contesta con ➤, y los dos ven los dos mensajes');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
