#!/usr/bin/env node
// 🤖 SIN SALDO PARA LA COMISIÓN NO SE CONFIRMA — pendiente P04 (30-sep-2026).
// Decisión del dueño: «si al conductor no le alcanza el saldo para la comisión, el servidor no lo confirma y al pasajero
// le sale un aviso para escoger otra oferta. El saldo nunca queda negativo.»
//
// Arma el caso en PRUEBAS, por la pantalla del pasajero:
//   1. como superadmin de prueba (admin@gg.test) guarda los créditos del taxista de prueba (taxi@gg.test) y se los
//      pone en 0 (la comisión de taxi es mayor que 0);
//   2. abre la app como el pasajero de prueba (pasajero@gg.test) y pide un Taxi por la pantalla;
//   3. el taxista deja su oferta en ese viaje, y el pasajero la ve y toca «✅ Aceptar»;
//   4. exige: la ventanita dice «Este conductor no puede tomar el viaje ahora. Escoge otra oferta.», la oferta sale de
//      la lista, el viaje sigue `esperando` sin conductor y los créditos del taxista siguen en 0 (no se cobró nada).
// Al final: el pasajero cancela su viaje, y los créditos y la ficha del taxista quedan EXACTAMENTE como estaban.
// Deja en pruebas UN viaje `cancelado`. No cuesta comisión (ese es el punto).
//   node robot/sin-saldo-confirmar.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const LAT = 11.5444;
const LNG = -72.9072;
const ORIGEN = 'Calle 1 # 1-1 robot P04 ' + Date.now().toString().slice(-5);
const FRASE = 'Este conductor no puede tomar el viaje ahora. Escoge otra oferta.';
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
  let rp = null;
  try {
    // 1: sin saldo, y libre (con una marca de otro viaje el servidor contestaría «ocupado» y no se vería lo de hoy).
    await adm.cambiar(fichaUsuario, { creditos: 0 });
    await tax.cambiar(fichaCond, { enViajeId: null, ocupado: false });
    console.log('CRÉDITOS DEL TAXISTA DE PRUEBA:', creditosAntes, '→ 0');

    // 2: el pasajero pide un Taxi (el id del viaje se saca de lo que la app le manda a Firestore).
    rp = await abrir('transporte', { nombre: 'sin-saldo-confirmar', antesDeCargar });
    const p = rp.pagina;
    const vistos = new Set();
    p.on('request', (req) => {
      let b = '';
      try { b = decodeURIComponent(req.postData() || ''); } catch (e) { b = req.postData() || ''; }
      for (const m of b.matchAll(/documents\/viajes\/([A-Za-z0-9]{20})/g)) vistos.add(m[1]);
    });
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
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

    // 3: la oferta del taxista, y el pasajero la acepta por la pantalla.
    await tax.cambiar('viajes/' + idViaje + '/contraofertas/' + tax.uid, {
      conductorId: tax.uid, conductorNombre: NOMBRE, conductorTelefono: '', conductorPlaca: 'ROB004', conductorVehiculo: 'Taxi',
      tipoOferta: 'acepta', monto: '$ 8.000', montoValor: 8000, creado: new Date().toISOString(), vigente: true,
    });
    let ve = false;
    for (let i = 0; i < 30 && !ve; i += 1) { await p.waitForTimeout(500); ve = (await rp.texto()).includes(NOMBRE); }
    if (!ve) throw new Error('la oferta del taxista no apareció en la pantalla del pasajero');
    await rp.captura('oferta');
    await p.getByRole('button', { name: '✅ Aceptar' }).first().click();

    // 4: la ventanita con la frase, y la oferta fuera de la lista.
    let aviso = false;
    for (let i = 0; i < 40 && !aviso; i += 1) { await p.waitForTimeout(500); aviso = (await rp.texto()).includes(FRASE); }
    await rp.captura('aviso');
    const texto = await rp.texto();
    console.log('LA VENTANITA:', aviso ? 'dice «' + FRASE + '»' : 'NO dice la frase');
    if (!aviso) fallos.push('el pasajero no vio «' + FRASE + '»');
    if (texto.includes('Oferta aceptada')) fallos.push('la pantalla dice «Oferta aceptada»');
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.last().click().catch(() => {}); await p.waitForTimeout(1000); }
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
    console.log('ERRORES DE LA PÁGINA:', rp.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', rp.carpeta);
  } finally {
    if (rp) await rp.cerrar();
    if (idViaje) {
      await pas.cambiar('viajes/' + idViaje, { estado: 'cancelado', canceladoPor: 'pasajero', razonCancelacion: 'ROBOT P04: fin del recorrido' })
        .catch((e) => console.log('⚠ no pude cancelar el viaje del robot:', e.message));
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    await adm.cambiar(fichaUsuario, { creditos: creditosAntes ?? 0 })
      .catch((e) => console.log('⚠ no pude devolver los créditos del taxista:', e.message));
    await tax.cambiar(fichaCond, { enViajeId: condAntes.enViajeId ?? null, ocupado: condAntes.ocupado ?? false })
      .catch((e) => console.log('⚠ no pude dejar la ficha del taxista como estaba:', e.message));
    const quedo = (await adm.leer(fichaUsuario).catch(() => ({}))).creditos;
    console.log('CRÉDITOS DEL TAXISTA DE PRUEBA QUEDARON EN:', quedo, quedo === creditosAntes ? '(como estaban)' : '🔴 (antes ' + creditosAntes + ')');
    if (quedo !== creditosAntes) fallos.push('los créditos del taxista no quedaron como estaban');
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ sin saldo para la comisión: el pasajero ve «' + FRASE + '», la oferta sale, el viaje sigue libre y no se cobra nada');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
