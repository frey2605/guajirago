#!/usr/bin/env node
// 🤖 LOS DOS RELOJES DE ESPERA CUENTAN LO MISMO — gemelo G26 (28-sep-2026).
// Cuando el conductor aprieta «📍 Llegué al punto», su app arranca la cuenta «Esperando al pasajero...» y la del pasajero
// «Sal pronto o el conductor puede cancelar». Hasta ese día el conductor contaba lo que dice el panel
// (config/global.tiempoEsperaConductor) y el pasajero un 240 fijo: con el panel en 300, 5:00 contra 4:00.
//
// Arma el caso en PRUEBAS, de punta a punta:
//   1. como superadmin de prueba (admin@gg.test) pone config/global.tiempoEsperaConductor = 300 (guarda el de antes);
//   2. abre la app como el taxista de prueba (taxi@gg.test), disponible, con un GPS de mentira;
//   3. abre OTRA app como el pasajero de prueba (pasajero@gg.test) y pide un Taxi por la pantalla;
//   4. el taxista deja su oferta y el pasajero la acepta con `confirmarConductor` (la única que escribe un viaje aceptado);
//   5. en la app del taxista aprieta «📍 Llegué al punto»;
//   6. lee los DOS relojes y exige que los dos arranquen de 5:00 (más de 4:30 al leerlos) y a menos de 10 s uno de otro.
// Al final: el taxista cancela el viaje, su ficha y config/global quedan como estaban.
// Deja en pruebas UN viaje `cancelado_conductor`, y le cuesta al taxista de prueba UNA comisión de sus créditos de prueba
// (la cobra el servidor al confirmar, como en me-aceptaron).
//   node robot/espera-conductor.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const SEGUNDOS = 300;
const LAT = 11.5444;
const LNG = -72.9072;
const ORIGEN = 'Calle 1 # 1-1 robot G26 ' + Date.now().toString().slice(-5);

const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 300),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 500); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + LAT + ',' + LNG + ');';

/** Los segundos del reloj que va detrás de `etiqueta` en el texto de la pantalla (o null si no está). */
function reloj(texto, etiqueta) {
  const m = new RegExp(etiqueta + '[\\s\\S]{0,60}?(\\d+):(\\d\\d)').exec(texto);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

async function entrar(p, correo) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', correo);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
}

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  const config = await adm.leer('config/global');
  const esperaAntes = config.tiempoEsperaConductor;
  const ficha = 'conductores/' + tax.uid;
  const fichaAntes = await tax.leer(ficha).catch(() => ({}));
  let idViaje = null;
  let rc = null;
  let rp = null;
  try {
    await adm.cambiar('config/global', { tiempoEsperaConductor: SEGUNDOS });
    await tax.cambiar(ficha, { enViajeId: null, ocupado: false });
    console.log('config/global.tiempoEsperaConductor en PRUEBAS:', esperaAntes, '→', SEGUNDOS);

    // 2: el taxista, disponible.
    rc = await abrir('transporte', { nombre: 'espera-conductor-taxista', antesDeCargar });
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

    // 3: el pasajero pide un Taxi por la pantalla (el id del viaje se saca de lo que la app le manda a Firestore).
    rp = await abrir('transporte', { nombre: 'espera-conductor-pasajero', antesDeCargar });
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

    // 4: la oferta del taxista y el sí del pasajero.
    await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, {
      conductorId: tax.uid, conductorNombre: 'Robot Taxi', conductorTelefono: '', conductorPlaca: 'ROB026', conductorVehiculo: 'Taxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    });
    await p.waitForTimeout(2000);
    const res = await pas.llamar('confirmarConductor', { viajeId: idViaje, conductorId: tax.uid });
    console.log('CONFIRMAR (servidor de pruebas):', JSON.stringify(res));
    if (!res || res.ok !== true) throw new Error('el servidor no confirmó la oferta (' + JSON.stringify(res) + ')');

    let recoge = false;
    for (let i = 0; i < 30 && !recoge; i += 1) { await c.waitForTimeout(500); recoge = /YENDO A RECOGER/.test(await rc.texto()); }
    if (!recoge) throw new Error('la app del taxista no pasó a «YENDO A RECOGER»');
    await c.waitForTimeout(4000);

    // 5: «Llegué al punto».
    await c.getByRole('button', { name: /Llegué al punto/ }).click();
    await c.waitForTimeout(4000);
    await rc.captura('taxista-llego');
    await rp.captura('pasajero-sabe');

    // 6: los dos relojes.
    const deTaxista = reloj(await rc.texto(), 'Esperando al pasajero\\.\\.\\.');
    const dePasajero = reloj(await rp.texto(), 'Sal pronto o el conductor puede cancelar');
    console.log('RELOJ DEL TAXISTA:', deTaxista, 's · RELOJ DEL PASAJERO:', dePasajero, 's (el panel dice ' + SEGUNDOS + ')');
    if (deTaxista === null) fallos.push('no encuentro el reloj «Esperando al pasajero...» en la app del taxista');
    if (dePasajero === null) fallos.push('no encuentro el reloj «Sal pronto…» en la app del pasajero');
    if (deTaxista !== null && (deTaxista > SEGUNDOS || deTaxista < SEGUNDOS - 30)) fallos.push('el reloj del taxista no arrancó de ' + SEGUNDOS + ' s: marca ' + deTaxista);
    if (dePasajero !== null && (dePasajero > SEGUNDOS || dePasajero < SEGUNDOS - 30)) fallos.push('el reloj del pasajero no arrancó de ' + SEGUNDOS + ' s: marca ' + dePasajero);
    if (deTaxista !== null && dePasajero !== null && Math.abs(deTaxista - dePasajero) > 10) fallos.push('los dos relojes van a ' + Math.abs(deTaxista - dePasajero) + ' s uno de otro');
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    if (rp) await rp.cerrar();
    if (idViaje) {
      await tax.cambiar('viajes/' + idViaje, { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT G26: fin del recorrido' })
        .catch(() => pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT G26: fin del recorrido' }))
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 4000));
    }
    await tax.cambiar(ficha, { enViajeId: fichaAntes.enViajeId ?? null, ocupado: fichaAntes.ocupado ?? false, activo: fichaAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
    await adm.cambiar('config/global', { tiempoEsperaConductor: esperaAntes ?? 240 })
      .catch((e) => console.log('⚠ no pude devolver config/global.tiempoEsperaConductor:', e.message));
    const quedo = await adm.leer('config/global').catch(() => ({}));
    console.log('config/global.tiempoEsperaConductor en PRUEBAS quedó en:', quedo.tiempoEsperaConductor);
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ con ' + SEGUNDOS + ' s en el panel, el reloj del taxista y el del pasajero cuentan lo mismo');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
