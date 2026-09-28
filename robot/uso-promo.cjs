#!/usr/bin/env node
// 🤖 «SE USÓ ESTA PROMOCIÓN, Y COSTÓ TANTOS PESOS» — gemelo G17 (28-sep-2026). Contra la base de PRUEBAS.
// Crea (como admin@gg.test) dos promociones de mentira, vigentes, que empiezan con 0 usos y $0 invertidos:
//   · CREDITO — de $1.000 de crédito.
//   · PCT     — de 20 % de descuento.
// 1. PANEL: entra como superadmin → 🎁 Promociones → «Activas», toca «🎁 Asignar» en la de CRÉDITO, busca al pasajero
//    de prueba por su documento y toca «Asignar». Tiene que decir «¡Promoción asignada…!», y la tarjeta tiene que
//    quedar en «1 usos» y «💰 Invertido: $ 1.000» — los pesos de verdad, apuntados con la receta única.
// 2. Toca «🎁 Asignar» en la de PORCENTAJE: tiene que salir la ventanita de que un porcentaje no se asigna a mano, y su
//    «Invertido» se queda en $0 (antes de G12 sumaba un 20 como si fueran $20).
// 3. En la base: la de crédito con usosTotales 1, inversionTotal 1000, un apunte de $1.000 en el historial y la persona
//    con veces 1; la de porcentaje intacta.
// Al final le devuelve al pasajero su saldo de antes y apaga las dos promociones (no se borran: lápidas).
//   node robot/uso-promo.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

(async () => {
  const fallos = [];
  const hora = Date.now().toString().slice(-6);
  const CREDITO = 'ROBOT-G17C-' + hora;
  const PCT = 'ROBOT-G17P-' + hora;
  const admin = await entrarALaBase('admin@gg.test');
  const pasajero = await entrarALaBase('pasajero@gg.test');
  const ficha = await admin.leer('usuarios/' + pasajero.uid);
  if (!ficha.documento) {
    await admin.cambiar('usuarios/' + pasajero.uid, { documento: 'ROBOT-PASAJERO' });
    ficha.documento = 'ROBOT-PASAJERO';
  }
  const saldoAntes = ficha.creditos || 0;
  const base = {
    categoria: 'transporte', requiereCodigo: true, descripcion: 'Promoción de mentira del robot (G17)', aplicaA: 'ambos',
    limiteUsosPorPersona: null, viajesMinimosRequeridos: 0, activa: true, usosTotales: 0, inversionTotal: 0,
    fechaInicio: '2026-01-01', fechaFin: '2099-12-31', creadoPor: 'robot', fechaCreacion: new Date().toISOString(),
  };
  await admin.cambiar('promociones/' + CREDITO, { ...base, nombre: 'Robot G17 credito ' + hora, tipoBeneficio: 'credito', valorBeneficio: 1000 });
  await admin.cambiar('promociones/' + PCT, { ...base, nombre: 'Robot G17 porcentaje ' + hora, tipoBeneficio: 'descuento', valorBeneficio: 20 });

  try {
    await recorrer(fallos, hora, ficha);
    const pc = await admin.leer('promociones/' + CREDITO);
    const pp = await admin.leer('promociones/' + PCT);
    const uso = await admin.leer('promociones/' + CREDITO + '/usos/' + pasajero.uid).catch(() => ({}));
    const hist = pc.historialUsos || [];
    console.log('BASE · crédito: usos', pc.usosTotales, '· invertido', pc.inversionTotal, '· historial', JSON.stringify(hist.map((h) => h.valor)),
      '· la persona: veces', uso.veces, '· porcentaje: usos', pp.usosTotales, '· invertido', pp.inversionTotal);
    if (pc.usosTotales !== 1) fallos.push('la de crédito no quedó con 1 uso: ' + pc.usosTotales);
    if (pc.inversionTotal !== 1000) fallos.push('la de crédito no quedó con $1.000 invertidos: ' + pc.inversionTotal);
    if (hist.length !== 1 || hist[0].valor !== 1000 || hist[0].usuarioId !== pasajero.uid) fallos.push('el historial no tiene UN apunte de $1.000 del pasajero');
    if (uso.veces !== 1) fallos.push('el uso de la persona no quedó en 1: ' + uso.veces);
    if ((pp.usosTotales || 0) !== 0 || (pp.inversionTotal || 0) !== 0) fallos.push('la de porcentaje se movió: ' + pp.usosTotales + ' usos, ' + pp.inversionTotal + ' invertidos');
    const despues = await admin.leer('usuarios/' + pasajero.uid);
    console.log('SALDO DEL PASAJERO: antes', saldoAntes, '· después', despues.creditos || 0);
    if ((despues.creditos || 0) !== saldoAntes + 1000) fallos.push('el saldo no subió $1.000: ' + saldoAntes + ' → ' + despues.creditos);
  } finally {
    try { await admin.cambiar('usuarios/' + pasajero.uid, { creditos: saldoAntes }); } catch (e) { console.log('⚠ no pude devolver el saldo: ' + e.message); }
    for (const id of [CREDITO, PCT]) {
      try { await admin.cambiar('promociones/' + id, { activa: false }); } catch (e) { console.log('⚠ no pude apagar ' + id + ': ' + e.message); }
    }
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ asignar una de crédito suma sus pesos al «Invertido», y una de porcentaje no se asigna ni suma');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });

async function recorrer(fallos, hora, ficha) {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'uso-promo-panel' });
  const p = r.pagina;
  const tarjetaDe = (nombre) => p.locator('div').filter({ hasText: nombre }).filter({ has: p.getByRole('button', { name: '🎁 Asignar' }) }).last();
  const asignarEn = async (nombre) => {
    await tarjetaDe(nombre).getByRole('button', { name: '🎁 Asignar' }).click();
    await p.waitForTimeout(800);
    await p.locator('input[placeholder="Número de documento"]').fill(String(ficha.documento || ''));
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Asignar', exact: true }).click();
  };
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    await p.locator('button, div').filter({ hasText: /^🎁$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Activas', { exact: true }).first().click();
    await p.waitForTimeout(1500);

    // 1. La de crédito.
    await asignarEn('Robot G17 credito ' + hora);
    let ok = false;
    for (let i = 0; i < 20 && !ok; i += 1) { await p.waitForTimeout(500); ok = /¡Promoción asignada/.test(await r.texto()); }
    await r.captura('credito-asignada');
    if (!ok) fallos.push('el panel no dijo «¡Promoción asignada…!» con la de crédito');
    await p.getByRole('button', { name: 'Cerrar', exact: true }).click().catch(() => {});
    await p.waitForTimeout(2500);
    const texto = await tarjetaDe('Robot G17 credito ' + hora).innerText();
    const usos = (texto.match(/(\d+) usos/) || [])[1];
    const invertido = ((texto.match(/Invertido:\s*([^\n]*)/) || [])[1] || '').trim();
    console.log('PANEL · CRÉDITO: usos', usos, '· Invertido', invertido);
    if (usos !== '1') fallos.push('la tarjeta de crédito no dice «1 usos»: ' + usos);
    if (!/^\$\s?1\.000$/.test(invertido.replace(/ /g, ' '))) fallos.push('la tarjeta de crédito no dice «Invertido: $ 1.000»: «' + invertido + '»');

    // 2. La de porcentaje.
    await asignarEn('Robot G17 porcentaje ' + hora);
    let ventanita = null;
    for (let i = 0; i < 20 && !ventanita; i += 1) {
      await p.waitForTimeout(500);
      const t = await r.texto();
      if (/No se puede asignar esta promoción/.test(t)) ventanita = (t.match(/No se puede asignar esta promoción\s*\n?([^\n]*)/) || [])[1] || '(sin texto)';
    }
    await r.captura('porcentaje');
    console.log('PANEL · PORCENTAJE · VENTANITA:', ventanita || '(no sale)');
    if (!ventanita || !/porcentaje/.test(ventanita)) fallos.push('asignar una de porcentaje no sacó la ventanita que lo explica');
    console.log('ERRORES DEL PANEL:', r.errores.join(' || ') || 'ninguno');
  } finally {
    console.log('CAPTURAS PANEL:', r.carpeta);
    await r.cerrar();
  }
}
