#!/usr/bin/env node
// 🤖 EL CONDUCTOR SIN SALDO SE PONE DISPONIBLE Y VE EL MERCADO — pendiente P05 (30-sep-2026).
// Palabras del dueño: «Que pueda ver: se pone disponible y ve los viajes y sus precios, pero no puede ofertar hasta
// recargar. Ve lo que se está perdiendo.»
//
// Arma el caso en PRUEBAS:
//   1. como superadmin de prueba le pone los créditos del taxista de prueba (taxi@gg.test) en 0;
//   2. abre la app como ese taxista, apaga el interruptor si estaba prendido y lo PRENDE: tiene que quedar
//      «🟢 Estoy disponible» sin ventanita (antes de P05 salía «Te falta saldo» y no se prendía);
//   3. ve la franja «Te falta saldo» con el texto de AVISO_SIN_SALDO (textosViaje.js);
//   4. el pasajero de prueba (pasajero@gg.test) pide un Taxi: el taxista VE el viaje en su lista, y al tocar
//      «✅ Aceptar viaje» sale la ventanita «Te falta saldo» (P04: no puede ofertar);
//   5. tocar la franja abre «Mis créditos»;
//   6. con saldo de sobra (10.000), la franja desaparece.
// Al final: el pasajero cancela su viaje, y los créditos y la ficha del taxista quedan EXACTAMENTE como estaban.
// Deja en pruebas UN viaje `cancelado`. No cuesta comisión.
//   node robot/disponible-sin-saldo.cjs
const { abrir, cerrarAvisoDeOfertas, claveDePruebas, entrarALaBase, saldoDePrueba } = require('./comun.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const { AVISO_SIN_SALDO } = cargarDeLaApp('guajirago/src/textosViaje.js');
const LAT = 11.5444;
const LNG = -72.9072;
const ORIGEN = 'Calle 1 # 1-1 robot P05 ' + Date.now().toString().slice(-5);

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

async function hayVentanita(p) {
  return (await p.getByRole('button', { name: 'Entendido' }).count()) > 0;
}

async function cerrarVentanita(p) {
  const b = p.getByRole('button', { name: 'Entendido' });
  if (await b.count()) { await b.last().click().catch(() => {}); await p.waitForTimeout(800); }
}

(async () => {
  const fallos = [];
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  const fichaCond = 'conductores/' + tax.uid;
  const saldo = await saldoDePrueba(tax.uid);
  const creditosAntes = saldo.antes;
  const condAntes = await tax.leer(fichaCond).catch(() => ({}));
  let idViaje = null;
  let rc = null;
  let rp = null;
  try {
    await tax.cambiar(fichaCond, { enViajeId: null, ocupado: false });
    // 1: sin saldo.
    await saldo.poner(0);
    console.log('CRÉDITOS DEL TAXISTA DE PRUEBA:', creditosAntes, '→ 0');

    // 2: el taxista prende el interruptor.
    rc = await abrir('transporte', { nombre: 'disponible-sin-saldo-taxista', antesDeCargar });
    const c = rc.pagina;
    await entrar(c, 'taxi@gg.test');
    await c.getByText('Transporte y movilidad').click();
    await c.waitForTimeout(2000);
    await c.getByText('Soy conductor').click();
    await c.waitForTimeout(4000);
    await cerrarVentanita(c);
    const estado = () => c.getByText(/Estoy disponible|No disponible/).first();
    const interruptor = () => estado().locator('xpath=following-sibling::div[1]');
    if (/Estoy disponible/.test(await estado().innerText())) {
      await interruptor().click();
      await c.waitForTimeout(1500);
    }
    const apagado = /No disponible/.test(await estado().innerText());
    console.log('APAGADO ANTES DE PRENDER:', apagado ? 'sí' : 'NO');
    if (!apagado) fallos.push('no se pudo apagar el interruptor para probar a prenderlo');
    await rc.captura('apagado-sin-saldo');
    await interruptor().click();
    await c.waitForTimeout(1500);
    const prendido = /Estoy disponible/.test(await estado().innerText());
    const ventanitaAlPrender = await hayVentanita(c);
    await rc.captura('prendido-sin-saldo');
    console.log('AL PRENDER CON $0:', prendido ? '🟢 Estoy disponible' : '⚪ sigue No disponible', '· ventanita:', ventanitaAlPrender ? 'SÍ' : 'no');
    if (!prendido) fallos.push('con $0 el interruptor no se prende');
    if (ventanitaAlPrender) { fallos.push('al prender con $0 salió una ventanita'); await cerrarVentanita(c); }

    // 3: la franja.
    const franja = await esperarTexto(rc, AVISO_SIN_SALDO.texto, 10);
    console.log('LA FRANJA:', franja ? 'se ve, con el texto de AVISO_SIN_SALDO' : 'NO se ve');
    if (!franja) fallos.push('no se ve la franja «' + AVISO_SIN_SALDO.titulo + '» con su texto');

    // 4: el pasajero pide un Taxi; el taxista lo ve y no puede aceptarlo.
    rp = await abrir('transporte', { nombre: 'disponible-sin-saldo-pasajero', antesDeCargar });
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

    const veViaje = await esperarTexto(rc, ORIGEN, 40);
    await rc.captura('ve-el-viaje-con-la-franja');
    console.log('EL TAXISTA SIN SALDO:', veViaje ? 'VE el viaje en su lista' : 'NO ve el viaje');
    if (!veViaje) fallos.push('el taxista sin saldo no ve el viaje');
    if (veViaje) {
      const tarjeta = c.locator('div', { hasText: ORIGEN }).filter({ has: c.getByRole('button', { name: /Rechazar/ }) }).last();
      await tarjeta.getByRole('button', { name: /Aceptar viaje/ }).click();
      await c.waitForTimeout(1500);
      const aviso = await hayVentanita(c);
      await rc.captura('aceptar-sin-saldo');
      console.log('AL ACEPTAR:', aviso ? 'ventanita «' + AVISO_SIN_SALDO.titulo + '»' : 'SIN ventanita');
      if (!aviso) fallos.push('al tocar «Aceptar viaje» sin saldo no salió la ventanita');
      await cerrarVentanita(c);
    }
    const ofertas = await pas.leer('viajes/' + idViaje + '/contraofertas/' + tax.uid).catch(() => null);
    console.log('OFERTA DEL TAXISTA EN LA BASE:', ofertas ? '🔴 HAY' : 'ninguna');
    if (ofertas) fallos.push('quedó una oferta del taxista sin saldo');

    // 5: tocar la franja abre «Mis créditos».
    await c.getByText(AVISO_SIN_SALDO.texto).first().click();
    const abreCreditos = await esperarTexto(rc, '¿CÓMO RECARGAR?', 20);
    await rc.captura('mis-creditos');
    console.log('TOCAR LA FRANJA:', abreCreditos ? 'abre «Mis créditos»' : 'NO abre «Mis créditos»');
    if (!abreCreditos) fallos.push('tocar la franja no abre «Mis créditos»');
    const volver = c.getByText(/Volver/).first();
    if (await volver.count()) { await volver.click().catch(() => {}); await c.waitForTimeout(1500); }

    // 6: con saldo, la franja se va.
    await saldo.poner(10000);
    let seFue = false;
    for (let i = 0; i < 20 && !seFue; i += 1) {
      await c.waitForTimeout(500);
      seFue = !(await rc.texto()).includes(AVISO_SIN_SALDO.texto);
    }
    await rc.captura('con-saldo-sin-franja');
    console.log('CON $10.000:', seFue ? 'la franja ya no está' : 'la franja SIGUE');
    if (!seFue) fallos.push('con saldo de sobra la franja sigue');
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    if (rp) await rp.cerrar();
    if (idViaje) {
      await pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT P05: fin del recorrido' })
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    await tax.cambiar(fichaCond, { enViajeId: condAntes.enViajeId ?? null, ocupado: condAntes.ocupado ?? false, activo: condAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
    const quedo = await saldo.devolver().catch((e) => { console.log('⚠ no pude devolver los créditos del taxista:', e.message); return null; });
    console.log('CRÉDITOS DEL TAXISTA DE PRUEBA QUEDARON EN:', quedo, quedo === creditosAntes ? '(como estaban)' : '🔴 (antes ' + creditosAntes + ')');
    if (quedo !== creditosAntes) fallos.push('los créditos del taxista no quedaron como estaban');
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ con $0 el taxista se pone disponible sin ventanita, ve la franja «' + AVISO_SIN_SALDO.titulo + '» y el viaje, no puede aceptarlo, la franja abre «Mis créditos» y con saldo se va');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
