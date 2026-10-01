#!/usr/bin/env node
// 🤖 EL MERCADO DE VIAJES ES DE LOS CONDUCTORES — P20 (1-oct-2026).
// Un viaje que busca conductor (estado `esperando`) lleva el nombre, el correo y las coordenadas del pasajero. Antes lo
// leía cualquiera con sesión; ahora solo los conductores (su ficha dice `tipo: 'conductor'`), su pasajero y el panel.
//
// Arma el caso en PRUEBAS:
//   1. abre la app como el taxista de prueba (taxi@gg.test) y lo pone disponible;
//   2. el pasajero de prueba (pasajero@gg.test) pide un Taxi por la pantalla;
//   3. el taxista VE el viaje en su lista (la consulta del mercado de la app, con las reglas nuevas);
//   4. contra la base: el mototaxista y el propio pasajero y el panel leen el viaje; OTRA pasajera (pasajera@gg.test) y
//      el restaurante de prueba reciben «permiso denegado».
// Al final: el pasajero cancela su viaje y la ficha del taxista queda como estaba. Deja en pruebas UN viaje `cancelado`.
//   node robot/mercado-viajes.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const LAT = 11.5444;
const LNG = -72.9072;
const ORIGEN = 'Calle 1 # 1-1 robot P20 ' + Date.now().toString().slice(-5);

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

async function esperarTexto(r, que, veces = 30) {
  for (let i = 0; i < veces; i += 1) {
    if ((await r.texto()).includes(que)) return true;
    await r.pagina.waitForTimeout(500);
  }
  return false;
}

/** ¿La base de pruebas le niega esa lectura a esa persona? */
async function negado(quien, ruta) {
  try { await quien.leer(ruta); return false; } catch (e) { return /rechazó/.test(e.message) && /(PERMISSION_DENIED|permission|403|insufficient)/i.test(e.message); }
}

(async () => {
  const fallos = [];
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  const moto = await entrarALaBase('moto@gg.test');
  const otra = await entrarALaBase('pasajera@gg.test');
  const negocio = await entrarALaBase('restaurante@gg.test');
  const adm = await entrarALaBase('admin@gg.test');
  const fichaCond = 'conductores/' + tax.uid;
  const condAntes = await tax.leer(fichaCond).catch(() => ({}));
  let idViaje = null;
  let rc = null;
  let rp = null;
  try {
    await tax.cambiar(fichaCond, { enViajeId: null, ocupado: false });

    // 1: el taxista, disponible.
    rc = await abrir('transporte', { nombre: 'mercado-viajes-taxista', antesDeCargar });
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
      await c.waitForTimeout(1500);
    }
    if (!/Estoy disponible/.test(await estado.innerText())) fallos.push('el taxista no quedó disponible');

    // 2: el pasajero pide un Taxi por la pantalla.
    rp = await abrir('transporte', { nombre: 'mercado-viajes-pasajero', antesDeCargar });
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
    const ruta = 'viajes/' + idViaje;

    // 3: el taxista lo ve en su lista.
    const veViaje = await esperarTexto(rc, ORIGEN, 40);
    await rc.captura('el-taxista-ve-el-viaje');
    console.log('EL TAXISTA:', veViaje ? 'VE el viaje en su lista' : 'NO ve el viaje');
    if (!veViaje) fallos.push('el taxista no ve el viaje de la pasajera en su lista (¿las reglas le cerraron el mercado?)');

    // 4: quién lo lee en la base.
    const lee = async (quien, nombre, debe) => {
      const no = await negado(quien, ruta);
      console.log(nombre + ': ' + (no ? 'negado' : 'lo lee') + (no === !debe ? ' ✓' : ' 🔴'));
      if (no === debe) fallos.push(nombre + (debe ? ' NO puede leer el viaje' : ' TODAVÍA puede leer el viaje del pasajero'));
    };
    await lee(moto, 'EL MOTOTAXISTA', true);
    await lee(pas, 'EL PROPIO PASAJERO', true);
    await lee(adm, 'EL PANEL', true);
    await lee(otra, 'OTRA PASAJERA', false);
    await lee(negocio, 'EL RESTAURANTE DE PRUEBA', false);
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    if (rp) await rp.cerrar();
    if (idViaje) {
      await pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT P20: fin del recorrido' })
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    await tax.cambiar(fichaCond, { enViajeId: condAntes.enViajeId ?? null, ocupado: condAntes.ocupado ?? false, activo: condAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el taxista ve el viaje de la pasajera; el mototaxista, ella y el panel lo leen; otra pasajera y el restaurante, negados');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
