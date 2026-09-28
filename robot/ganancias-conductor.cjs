#!/usr/bin/env node
// 🤖 «¿CUÁNTO GANÉ HOY?» SALE DE UNA SOLA CUENTA EN LA APP DEL CONDUCTOR — gemelo G23 (28-sep-2026).
// Hasta ese día el recuadro «GANANCIAS DE HOY» de «Mis viajes» (AppConductor.js) y la tarjeta HOY de «Ganancias»
// (Ganancias.js) sumaban cada uno a su manera (el día del teléfono, y el historial solo entre sus 50 viajes).
// Entra como el taxista de prueba (taxi@gg.test) en PRUEBAS y lee las dos pantallas. Exige:
//   · que las dos abran con la consulta nueva SIN error en la consola (si falta el índice conductorId + estado +
//     fechaSolicitud, o las reglas no la dejan, el historial lo escribe en la consola y el recuadro no sale);
//   · que la tarjeta HOY de «Ganancias» tenga su cifra, y que «Mis viajes» enseñe el recuadro con esa MISMA cifra
//     (o que no lo enseñe, si la cifra es $ 0: así está hecho, el recuadro solo sale con ganancias).
// Lo que NO puede probar: la suma con viajes de verdad. Un viaje con conductor solo lo escribe el servidor
// (confirmarConductor; las reglas no dejan poner conductorId desde afuera, ni al admin), y el taxista de prueba no
// tiene ninguno. Esa suma la EJECUTA pruebas/gananciasHoy.test.js contra un Firestore de mentira. No escribe nada.
//   node robot/ganancias-conductor.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'taxi@gg.test';
const P = '\\$[ ' + String.fromCharCode(160) + ']([\\d.]+)'; // una cifra como la escribe cop(): «$ 12.345»
const numero = (s) => Number(String(s).replace(/\./g, ''));

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'ganancias-conductor' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Transporte y movilidad').click();
    await p.waitForTimeout(2000);
    await p.getByText('Soy conductor').click();
    await p.waitForTimeout(4000);
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }

    // ── ☰ Menú → 📊 Ganancias: la tarjeta HOY ──
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Ganancias', { exact: true }).first().click();
    await p.waitForTimeout(6000);
    await r.captura('ganancias');
    const t1 = await r.texto();
    const m1 = t1.match(new RegExp('HOY\\s*GANADO\\s*' + P));
    console.log('GANANCIAS · HOY:', m1 ? '$ ' + m1[1] : '(no sale)');
    if (!m1) fallos.push('no encuentro la tarjeta HOY con su cifra en «Ganancias»');
    await p.getByText('Volver').first().click();
    await p.waitForTimeout(2000);

    // ── ☰ Menú → 🕐 Mis viajes: el recuadro GANANCIAS DE HOY ──
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mis viajes').first().click();
    await p.waitForTimeout(6000);
    await r.captura('mis-viajes');
    const t2 = await r.texto();
    const m2 = t2.match(new RegExp('GANANCIAS DE HOY\\s*' + P));
    console.log('MIS VIAJES · GANANCIAS DE HOY:', m2 ? '$ ' + m2[1] : '(no sale)');
    if (m1 && numero(m1[1]) > 0 && !m2) fallos.push('«Ganancias» dice $ ' + m1[1] + ' hoy y «Mis viajes» no enseña el recuadro');
    if (m1 && numero(m1[1]) === 0 && m2) fallos.push('«Ganancias» dice $ 0 hoy y «Mis viajes» enseña $ ' + m2[1]);
    if (m1 && m2 && numero(m1[1]) !== numero(m2[1])) {
      fallos.push('«Ganancias» dice $ ' + m1[1] + ' y «Mis viajes» dice $ ' + m2[1] + ' para el mismo hoy');
    }
    const deLaConsulta = r.errores.filter((e) => /FirebaseError|requires an index|index|permission/i.test(e));
    if (deLaConsulta.length) fallos.push('la consulta de las ganancias falló en la consola: ' + deLaConsulta.join(' || '));
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ «Ganancias» y «Mis viajes» del conductor abren sin error y dicen la misma ganancia de hoy');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
