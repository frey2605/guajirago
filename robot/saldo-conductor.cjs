#!/usr/bin/env node
// 🤖 EL SALDO DEL CONDUCTOR SE VE IGUAL EN LAS DOS PANTALLAS (G81, 29-sep-2026).
// Lee en la BASE de pruebas el saldo guardado del taxista de prueba (usuarios/{uid}.creditos, solo lectura), y
// entra como él (taxi@gg.test):
//   1. «Menú» → «Mis créditos»: la pantalla tiene que enseñar ese saldo.
//   2. «Transporte y movilidad» → «Soy conductor»: la tarjeta del saldo tiene que enseñar el MISMO.
// Las dos pantallas lo sacan de la ficha con la misma pieza (guajirago/src/saldoUsuario.js). No escribe nada en la
// base (ni se pone disponible).
//   node robot/saldo-conductor.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CORREO = 'taxi@gg.test';
// El mismo formato que cop() de la app (moneda.js). Se comparan solo las cifras, para no depender de los espacios.
const pesos = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
const cifras = (s) => s.replace(/[^\d-]/g, '');

(async () => {
  const fallos = [];
  const db = await entrarALaBase(CORREO);
  const ficha = await db.leer('usuarios/' + db.uid).catch(() => ({}));
  const guardado = ficha.creditos || 0;
  console.log('SALDO GUARDADO EN LA FICHA:', pesos(guardado));

  // Busca en el texto de la pantalla un «$ …» con las mismas cifras que el guardado.
  const loEnsena = (texto) => (texto.match(/-?\$\s?[\d.]+/g) || []).some((t) => cifras(t) === cifras(pesos(guardado)));

  const r = await abrir('transporte', { nombre: 'saldo-conductor' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);

    // ── 1. Mis créditos ──
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mis créditos').first().click();
    await p.waitForTimeout(4000);
    await r.captura('mis-creditos');
    const enCreditos = loEnsena(await r.texto());
    console.log('MIS CRÉDITOS:', enCreditos ? 'enseña ' + pesos(guardado) : 'NO enseña el saldo guardado');
    if (!enCreditos) fallos.push('«Mis créditos» no enseña el saldo guardado (' + pesos(guardado) + ')');

    // ── 2. La pantalla del conductor ──
    await p.reload();
    await p.waitForTimeout(8000);
    await p.getByText('Transporte y movilidad').click();
    await p.waitForTimeout(2000);
    await p.getByText('Soy conductor').click();
    await p.waitForTimeout(6000);
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }
    await r.captura('conductor');
    const enConductor = loEnsena(await r.texto());
    console.log('PANTALLA DEL CONDUCTOR:', enConductor ? 'enseña ' + pesos(guardado) : 'NO enseña el saldo guardado');
    if (!enConductor) fallos.push('la pantalla del conductor no enseña el saldo guardado (' + pesos(guardado) + ')');

    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    await r.cerrar();
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el saldo guardado (' + pesos(guardado) + ') se ve igual en «Mis créditos» y en la pantalla del conductor');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
