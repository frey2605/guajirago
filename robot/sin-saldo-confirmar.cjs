#!/usr/bin/env node
// 🤖 SIN SALDO PARA LA COMISIÓN NO SE ENTRA A LA SUBASTA — pendiente P04 (30-sep-2026).
// Palabras del dueño: «no debería ni dejarlo participar en la subasta, es decir, solo ve las ofertas pero no puede
// enviar una aceptación, confirmación o contraoferta, solo puede ver». Y si el saldo le baja DESPUÉS de ofertar,
// confirmarConductor no lo confirma y el pasajero ve «Escoge otra oferta» (última defensa).
//
// Arma el caso en PRUEBAS, con dos pantallas:
//   1. abre la app como el taxista de prueba (taxi@gg.test), con saldo, y se pone disponible;
//   2. abre OTRA app como el pasajero de prueba (pasajero@gg.test) y pide un Taxi por la pantalla;
//   3. el taxista deja su oferta mientras TIENE saldo (así el pasajero tiene una oferta que aceptar);
//   4. como superadmin de prueba (admin@gg.test) le pone los créditos del taxista en 0;
//   5. LADO DEL CONDUCTOR: sigue VIENDO el viaje en su lista; toca «✅ Aceptar viaje» y ve la ventanita
//      «Te falta saldo»; toca + y «💬 Enviar contraoferta» y otra vez «Te falta saldo»; y si escribe la oferta
//      directo en la base (saltándose la app), la base la NIEGA;
//   6. LADO DEL PASAJERO: toca «✅ Aceptar» en la oferta que dejó antes y ve «Este conductor no puede tomar el viaje
//      ahora. Escoge otra oferta.»; la oferta sale de la lista, el viaje sigue `esperando` sin conductor y los créditos
//      del taxista siguen en 0 (no se cobró nada).
// Al final: el pasajero cancela su viaje, y los créditos y la ficha del taxista quedan EXACTAMENTE como estaban.
// Deja en pruebas UN viaje `cancelado`. No cuesta comisión (ese es el punto).
//   node robot/sin-saldo-confirmar.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const LAT = 11.5444;
const LNG = -72.9072;
const ORIGEN = 'Calle 1 # 1-1 robot P04 ' + Date.now().toString().slice(-5);
const FRASE = 'Este conductor no puede tomar el viaje ahora. Escoge otra oferta.';
const TE_FALTA = 'Te falta saldo';
const NOMBRE = 'Robot Sin Saldo';

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

async function cerrarVentanita(p) {
  const b = p.getByRole('button', { name: 'Entendido' });
  if (await b.count()) { await b.last().click().catch(() => {}); await p.waitForTimeout(800); }
}

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const pas = await entrarALaBase('pasajero@gg.test');
  const tax = await entrarALaBase('taxi@gg.test');
  const fichaUsuario = 'usuarios/' + tax.uid;
  const fichaCond = 'conductores/' + tax.uid;
  const creditosAntes = (await adm.leer(fichaUsuario)).creditos;
  const condAntes = await tax.leer(fichaCond).catch(() => ({}));
  let idViaje = null;
  let rc = null;
  let rp = null;
  try {
    // Con saldo para poder ponerse disponible y dejar la oferta de antes (si en pruebas ya no le quedaba, se le da).
    if (!(creditosAntes >= 10000)) await adm.cambiar(fichaUsuario, { creditos: 10000 });
    await tax.cambiar(fichaCond, { enViajeId: null, ocupado: false });

    // 1: el taxista, disponible.
    rc = await abrir('transporte', { nombre: 'sin-saldo-taxista', antesDeCargar });
    const c = rc.pagina;
    await entrar(c, 'taxi@gg.test');
    await c.getByText('Transporte y movilidad').click();
    await c.waitForTimeout(2000);
    await c.getByText('Soy conductor').click();
    await c.waitForTimeout(4000);
    await cerrarVentanita(c);
    const estado = c.getByText(/Estoy disponible|No disponible/).first();
    if (/No disponible/.test(await estado.innerText())) {
      await estado.locator('xpath=following-sibling::div[1]').click();
      await c.waitForTimeout(1000);
    }

    // 2: el pasajero pide un Taxi (el id del viaje se saca de lo que la app le manda a Firestore).
    rp = await abrir('transporte', { nombre: 'sin-saldo-pasajero', antesDeCargar });
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

    // 3: la oferta de antes, con saldo.
    const oferta = {
      conductorId: tax.uid, conductorNombre: NOMBRE, conductorTelefono: '', conductorPlaca: 'ROB004', conductorVehiculo: 'Taxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    };
    await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, oferta);

    // 4: sin saldo.
    await adm.cambiar(fichaUsuario, { creditos: 0 });
    console.log('CRÉDITOS DEL TAXISTA DE PRUEBA:', creditosAntes, '→ 0');
    await c.waitForTimeout(3000);

    // 5: LADO DEL CONDUCTOR.
    const veViaje = await esperarTexto(rc, ORIGEN, 40);
    console.log('EL TAXISTA SIN SALDO:', veViaje ? 'VE el viaje en su lista' : 'NO ve el viaje');
    if (!veViaje) fallos.push('el taxista sin saldo no ve el viaje en su lista (tiene que poder VER)');
    await rc.captura('taxista-ve-el-viaje');
    if (veViaje) {
      const tarjeta = c.locator('div', { hasText: ORIGEN }).filter({ has: c.getByRole('button', { name: /Aceptar viaje/ }) }).last();
      await tarjeta.getByRole('button', { name: /Aceptar viaje/ }).click();
      const avisoAceptar = await esperarTexto(rc, TE_FALTA, 10);
      await rc.captura('taxista-aceptar');
      console.log('AL ACEPTAR:', avisoAceptar ? 'ventanita «' + TE_FALTA + '»' : 'SIN ventanita');
      if (!avisoAceptar) fallos.push('al tocar «Aceptar viaje» sin saldo no salió «' + TE_FALTA + '»');
      await cerrarVentanita(c);
      await tarjeta.getByRole('button', { name: '+' }).click();
      await c.waitForTimeout(500);
      await tarjeta.getByRole('button', { name: /Enviar contraoferta/ }).click();
      const avisoContra = await esperarTexto(rc, TE_FALTA, 10);
      await rc.captura('taxista-contraoferta');
      console.log('AL CONTRAOFERTAR:', avisoContra ? 'ventanita «' + TE_FALTA + '»' : 'SIN ventanita');
      if (!avisoContra) fallos.push('al tocar «Enviar contraoferta» sin saldo no salió «' + TE_FALTA + '»');
      await cerrarVentanita(c);
    }
    let negada = false;
    try {
      await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, { tipoOferta: 'contraoferta', monto: '$ 9.000', montoValor: 9000, vigente: true });
    } catch (e) { negada = /rechazó/.test(e.message); }
    console.log('OFERTA ESCRITA DIRECTO EN LA BASE SIN SALDO:', negada ? 'NEGADA por las reglas' : '🔴 ENTRÓ');
    if (!negada) fallos.push('la base dejó escribir una contraoferta sin saldo');

    // 6: LADO DEL PASAJERO (la última defensa).
    const veOferta = await esperarTexto(rp, NOMBRE, 30);
    if (!veOferta) throw new Error('la oferta del taxista no apareció en la pantalla del pasajero');
    await rp.captura('oferta');
    await p.getByRole('button', { name: '✅ Aceptar' }).first().click();
    const aviso = await esperarTexto(rp, FRASE, 40);
    await rp.captura('aviso');
    console.log('LA VENTANITA DEL PASAJERO:', aviso ? 'dice «' + FRASE + '»' : 'NO dice la frase');
    if (!aviso) fallos.push('el pasajero no vio «' + FRASE + '»');
    await cerrarVentanita(p);
    const sigue = (await rp.texto()).includes(NOMBRE);
    console.log('LA OFERTA:', sigue ? 'SIGUE en la lista' : 'salió de la lista');
    if (sigue) fallos.push('la oferta del conductor sin saldo sigue ofreciéndose');
    await rp.captura('sin-la-oferta');

    const viaje = await pas.leer('viajes/' + idViaje);
    const creditos = (await adm.leer(fichaUsuario)).creditos;
    console.log('VIAJE EN LA BASE:', JSON.stringify({ estado: viaje.estado, conductorId: viaje.conductorId ?? null }), '· CRÉDITOS DEL TAXISTA:', creditos);
    if (viaje.estado !== 'esperando') fallos.push('el viaje salió del mercado: ' + viaje.estado);
    if (viaje.conductorId) fallos.push('el viaje quedó con conductor');
    if (creditos !== 0) fallos.push('se movieron los créditos del taxista: ' + creditos);
    console.log('ERRORES DE LA PÁGINA (taxista):', rc.errores.join(' || ') || 'ninguno');
    console.log('ERRORES DE LA PÁGINA (pasajero):', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rc.carpeta, '·', rp.carpeta);
  } finally {
    if (rc) await rc.cerrar();
    if (rp) await rp.cerrar();
    if (idViaje) {
      await pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT P04: fin del recorrido' })
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    await adm.cambiar(fichaUsuario, { creditos: creditosAntes ?? 0 })
      .catch((e) => console.log('⚠ no pude devolver los créditos del taxista:', e.message));
    await tax.cambiar(fichaCond, { enViajeId: condAntes.enViajeId ?? null, ocupado: condAntes.ocupado ?? false, activo: condAntes.activo ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
    const quedo = (await adm.leer(fichaUsuario).catch(() => ({}))).creditos;
    console.log('CRÉDITOS DEL TAXISTA DE PRUEBA QUEDARON EN:', quedo, quedo === creditosAntes ? '(como estaban)' : '🔴 (antes ' + creditosAntes + ')');
    if (quedo !== creditosAntes) fallos.push('los créditos del taxista no quedaron como estaban');
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ sin saldo: el taxista ve el viaje pero no puede aceptar ni contraofertar («' + TE_FALTA + '», y la base lo niega); el pasajero ve «' + FRASE + '», la oferta sale y no se cobra nada');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
