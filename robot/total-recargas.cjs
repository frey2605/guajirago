#!/usr/bin/env node
// 🤖 EL TOTAL RECARGADO DEL PANEL SALE DE UNA SOLA CUENTA — gemelo G54 (29-sep-2026).
// Entra al panel de pruebas como superadmin (admin@gg.test) → 🎟️ Códigos. En «Todos» lee qué códigos hay (su nombre
// sale en cada tarjeta), los lee UNO POR UNO de la base de pruebas y calcula el total con la cuenta única del panel
// (guajirago-admin/src/recargas.js, ejecutada). Luego en «Resumen» lee «VALOR RECARGADO»: tiene que ser esa cifra.
// Antes 🎟️ Códigos sumaba a su manera (sin los anulados ya cobrados) y el tablero a la suya. Solo lee.
//   node robot/total-recargas.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const P = '\\$[ ' + String.fromCharCode(160) + ']([\\d.]+)'; // una cifra como la escribe cop(): «$ 1.000»
const numero = (s) => Number(String(s).replace(/\./g, ''));

(async () => {
  const fallos = [];
  const { totalRecargado } = cargarDeLaApp('guajirago-admin/src/recargas.js');
  const db = await entrarALaBase('admin@gg.test');
  // Los dos casos que separaban a las cuentas, fijos y REUSADOS en cada corrida (las reglas no dejan borrar un código
  // ni cambiarle `usado`, así que se crean solo si faltan). Ya cobrados: nadie los puede canjear, y no tocan saldos.
  const FIJOS = {
    'ROBOT-G54-COBRADO': { usado: true, anulado: false, valor: 50000, fechaUso: '2026-09-29T12:00:00.000Z' },
    'ROBOT-G54-COBRADO-ANULADO': { usado: true, anulado: true, valor: 40000, fechaUso: '2026-09-29T12:00:00.000Z',
      fechaAnulacion: '2026-09-29T12:01:00.000Z' },
  };
  for (const [id, campos] of Object.entries(FIJOS)) {
    const ya = await db.leer('codigos/' + id).catch(() => null);
    if (!ya) {
      await db.cambiar('codigos/' + id, { ...campos, creadoPor: 'robot total-recargas (G54)', fechaCreacion: campos.fechaUso });
      console.log('CREÉ en pruebas: codigos/' + id);
    }
  }
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'total-recargas' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Códigos es el 🎟️.
    await p.locator('button, div').filter({ hasText: /^🎟️$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Todos', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await r.captura('todos');
    // El nombre del código va justo después de su etiqueta (DISPONIBLE / USADO / ANULADO).
    const ids = await p.evaluate(() => [...document.querySelectorAll('span')]
      .filter((s) => ['DISPONIBLE', 'USADO', 'ANULADO'].includes(s.textContent.trim()))
      .map((s) => (s.nextElementSibling ? s.nextElementSibling.textContent.trim() : ''))
      .filter(Boolean));
    console.log('CÓDIGOS EN PANTALLA:', ids.length);
    if (!ids.length) fallos.push('no encuentro ningún código en «Todos»');
    const codigos = [];
    for (const id of ids) codigos.push({ id, ...((await db.leer('codigos/' + encodeURIComponent(id))) || {}) });
    const esperado = totalRecargado(codigos);
    const cobradosYAnulados = codigos.filter((c) => c.usado === true && c.anulado === true).length;
    console.log('CUENTA ÚNICA sobre la base de pruebas: $ ' + esperado.toLocaleString('es-CO')
      + ' · cobrados: ' + codigos.filter((c) => c.usado === true).length + ' · cobrados y anulados: ' + cobradosYAnulados);

    await p.getByText('Resumen', { exact: true }).first().click();
    await p.waitForTimeout(2000);
    await r.captura('resumen');
    const m = (await r.texto()).match(new RegExp('VALOR RECARGADO\\s*' + P));
    console.log('🎟️ CÓDIGOS · VALOR RECARGADO:', m ? '$ ' + m[1] : '(no sale)');
    if (!m) fallos.push('no encuentro «VALOR RECARGADO» con su cifra');
    else if (numero(m[1]) !== esperado) {
      fallos.push('la pantalla dice $ ' + m[1] + ' y la cuenta única, con los mismos códigos, $ ' + esperado.toLocaleString('es-CO'));
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ «VALOR RECARGADO» de 🎟️ Códigos es la cuenta única sobre los códigos de verdad');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
