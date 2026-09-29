#!/usr/bin/env node
// 🤖 ¿PUEDE ESTA PERSONA USAR ESTA PROMOCIÓN? — gemelo G12 (28-sep-2026). Contra la base de PRUEBAS.
// Crea (como admin@gg.test) dos promociones de mentira:
//   · VENCIDA  — de crédito, con fechas de enero de 2026.
//   · VIAJES   — de crédito, vigente, para pasajeros, que pide 99 viajes completados.
// 1. PANEL: entra como superadmin → 🎁 Promociones → «Vencidas», toca «🎁 Asignar» en la VENCIDA, escribe el documento
//    del pasajero de prueba y toca «Asignar». Tiene que salir la VENTANITA «No se puede asignar esta promoción» que
//    dice que está fuera de sus fechas, y ni el saldo del pasajero ni los usos de la promoción pueden moverse.
//    Antes de G12 el panel la asignaba sin decir nada y le sumaba el crédito.
// 2. APP: entra como pasajero@gg.test → «Menú» → «Promociones», escribe el código VIAJES y toca «Aplicar». El SERVIDOR
//    de pruebas tiene que contestar que la promoción es para quien ya tiene 99 viajes. Antes de G12 se la daba.
// Al final apaga las dos promociones (no se borran: lápidas) y, si algo se hubiera movido, lo devuelve.
//   node robot/promo-asignar.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

(async () => {
  const fallos = [];
  const hora = Date.now().toString().slice(-6);
  const VENCIDA = 'ROBOT-G12V-' + hora;
  const VIAJES = 'ROBOT-G12N-' + hora;
  const admin = await entrarALaBase('admin@gg.test');
  const pasajero = await entrarALaBase('pasajero@gg.test');
  const ficha = await admin.leer('usuarios/' + pasajero.uid);
  // «Asignar» busca a la persona por su documento, y el pasajero de prueba nace sin él: se le pone uno fijo y de
  // mentira (solo en la base de pruebas), la primera vez.
  if (!ficha.documento) {
    await admin.cambiar('usuarios/' + pasajero.uid, { documento: 'ROBOT-PASAJERO' });
    ficha.documento = 'ROBOT-PASAJERO';
  }
  const saldoAntes = ficha.creditos || 0;
  const base = {
    categoria: 'transporte', tipoBeneficio: 'credito', valorBeneficio: 1000, requiereCodigo: true, descripcion: 'Promoción de mentira del robot (G12)',
    limiteUsosPorPersona: 1, activa: true, usosTotales: 0, inversionTotal: 0, creadoPor: 'robot', fechaCreacion: new Date().toISOString(),
  };
  await admin.cambiar('promociones/' + VENCIDA, { ...base, nombre: 'Robot G12 vencida ' + hora, aplicaA: 'ambos', fechaInicio: '2026-01-01', fechaFin: '2026-01-02', viajesMinimosRequeridos: 0 });
  await admin.cambiar('promociones/' + VIAJES, { ...base, nombre: 'Robot G12 viajes ' + hora, aplicaA: 'pasajeros', fechaInicio: '2026-01-01', fechaFin: '2099-12-31', viajesMinimosRequeridos: 99 });

  try {
    await recorrer(fallos, hora, VENCIDA, VIAJES, ficha, admin, pasajero, saldoAntes);
  } finally {
    for (const id of [VENCIDA, VIAJES]) {
      try { await admin.cambiar('promociones/' + id, { activa: false }); } catch (e) { console.log('⚠ no pude apagar ' + id + ': ' + e.message); }
    }
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el panel no asigna una promoción vencida (lo dice en ventanita) y el servidor exige los viajes previos');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });

async function recorrer(fallos, hora, VENCIDA, VIAJES, ficha, admin, pasajero, saldoAntes) {
  let ventanita = null; let dijoLaApp = null;
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'promo-asignar-panel' });
  const p = r.pagina;
  try {
    if (!ficha.documento) fallos.push('el pasajero de prueba no tiene documento: no se puede buscar en «Asignar»');
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    await p.locator('button, div').filter({ hasText: /^🎁$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Vencidas', { exact: true }).first().click();
    await p.waitForTimeout(1500);
    const tarjeta = p.locator('div').filter({ hasText: 'Robot G12 vencida ' + hora }).filter({ has: p.getByRole('button', { name: '🎁 Asignar' }) }).last();
    await tarjeta.getByRole('button', { name: '🎁 Asignar' }).click();
    await p.waitForTimeout(800);
    await p.locator('input[placeholder="Número de documento"]').fill(String(ficha.documento || ''));
    await p.waitForTimeout(3000);
    await r.captura('asignar');
    await p.getByRole('button', { name: 'Asignar', exact: true }).click();
    for (let i = 0; i < 20 && !ventanita; i += 1) {
      await p.waitForTimeout(500);
      const t = await r.texto();
      if (/No se puede asignar esta promoción/.test(t)) ventanita = (t.match(/No se puede asignar esta promoción\s*\n?([^\n]*)/) || [])[1] || '(sin texto)';
    }
    await r.captura('ventanita');
    console.log('PANEL · VENTANITA:', ventanita || '(no sale)');
    if (!ventanita) fallos.push('el panel no sacó la ventanita al asignar una promoción vencida');
    else if (!/fuera de sus fechas/.test(ventanita)) fallos.push('la ventanita no dice que está fuera de sus fechas: «' + ventanita + '»');
    console.log('ERRORES DEL PANEL:', r.errores.join(' || ') || 'ninguno');
  } finally {
    console.log('CAPTURAS PANEL:', r.carpeta);
    await r.cerrar();
  }

  const a = await abrir('transporte', { nombre: 'promo-asignar-app' });
  const q = a.pagina;
  try {
    await q.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await q.waitForTimeout(800);
    await q.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await q.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await q.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await q.waitForTimeout(8000);
    await q.getByText('Menú').first().click();
    await q.waitForTimeout(800);
    await q.getByText('Promociones', { exact: true }).first().click();
    await q.waitForTimeout(3000);
    await q.fill('input[placeholder="Escribe el código"]', VIAJES);
    await q.getByRole('button', { name: 'Aplicar', exact: true }).click();
    for (let i = 0; i < 30 && !dijoLaApp; i += 1) {
      await q.waitForTimeout(500);
      dijoLaApp = ((await a.texto()).match(/Esta promoción es para quien ya tiene[^\n]*|¡Código activado![^\n]*/) || [])[0] || null;
    }
    await a.captura('codigo');
    console.log('APP · EL SERVIDOR DIJO:', dijoLaApp || '(nada)');
    if (!dijoLaApp) fallos.push('la app no dijo nada al aplicar el código que pide 99 viajes');
    else if (!/99 viajes completados\. Llevas \d+/.test(dijoLaApp)) fallos.push('el servidor de pruebas dejó canjear sin los viajes previos: «' + dijoLaApp + '»');
    // G38: esa frase la enseña motivoDeRechazo en la VENTANITA del candado, entera y sin la marca « [400]» que la
    // librería de firebase le pega (antes salía en letra roja: «… Llevas 0 [400]»).
    if (dijoLaApp && /\[\d+\]/.test(dijoLaApp)) fallos.push('la frase del servidor llegó con la marca técnica pegada: «' + dijoLaApp + '»');
    if (dijoLaApp && !/No se pudo aplicar el código/.test(await a.texto())) fallos.push('el motivo no salió en la ventanita «No se pudo aplicar el código»');
    console.log('ERRORES DE LA APP:', a.errores.join(' || ') || 'ninguno');
  } finally {
    console.log('CAPTURAS APP:', a.carpeta);
    await a.cerrar();
  }

  // Lo que se movió en la base, y la limpieza.
  const despues = await admin.leer('usuarios/' + pasajero.uid);
  const pv = await admin.leer('promociones/' + VENCIDA);
  console.log('SALDO DEL PASAJERO: antes', saldoAntes, '· después', despues.creditos || 0, '· usos de la vencida:', pv.usosTotales || 0);
  if ((despues.creditos || 0) !== saldoAntes) {
    fallos.push('el saldo del pasajero se movió: ' + saldoAntes + ' → ' + despues.creditos);
    await admin.cambiar('usuarios/' + pasajero.uid, { creditos: saldoAntes });
    console.log('(se devolvió el saldo de antes)');
  }
  if ((pv.usosTotales || 0) !== 0) fallos.push('la promoción vencida contó ' + pv.usosTotales + ' uso(s)');
  if (despues.descuentoPendiente && despues.descuentoPendiente.promoId === VIAJES) fallos.push('al pasajero le quedó el descuento de la promoción de 99 viajes');
}
