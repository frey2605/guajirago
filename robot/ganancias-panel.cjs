#!/usr/bin/env node
// 🤖 LAS GANANCIAS DEL PANEL SALEN DE UNA SOLA CUENTA — gemelo G15 (28-sep-2026).
// Entra al panel de pruebas como superadmin (admin@gg.test), lee «GANANCIAS HOY» del tablero, va a 👑 Superadmin →
// «Ingresos reales» y lee la columna HOY: las dos pantallas tienen que decir la MISMA cifra (antes el tablero contaba
// «finalizados × 800» y la otra lo cobrado). Y la nota «Son comisiones brutas (mototaxi … · taxi … · mandado …)»
// tiene que enseñar lo que dice config/global en la base de pruebas, no los números de respaldo del panel. Solo lee.
//   node robot/ganancias-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const P = '\\$[ ' + String.fromCharCode(160) + ']([\\d.]+)'; // una cifra como la escribe cop(): «$ 1.000»
const numero = (s) => Number(String(s).replace(/\./g, ''));

(async () => {
  const fallos = [];
  const db = await entrarALaBase('admin@gg.test');
  const cfg = (await db.leer('config/global')) || {};
  const esperado = { mototaxi: cfg.comisionMototaxi ?? 300, taxi: cfg.comisionTaxi ?? 800, mandado: cfg.comisionDomicilio ?? 1000 };
  console.log('CONFIG DE PRUEBAS:', JSON.stringify(esperado));

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'ganancias-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    await r.captura('tablero');
    const t1 = await r.texto();
    const m1 = t1.match(new RegExp('GANANCIAS HOY\\s*' + P));
    console.log('TABLERO · GANANCIAS HOY:', m1 ? '$ ' + m1[1] : '(no sale)');
    if (!m1) fallos.push('no encuentro «GANANCIAS HOY» con su cifra en el tablero');

    // El menú del panel está ABAJO, con íconos; Superadmin es el 👑.
    await p.locator('button, div').filter({ hasText: /^👑$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Ingresos reales', { exact: true }).first().click();
    await p.waitForTimeout(6000);
    await r.captura('ingresos-reales');
    const t2 = await r.texto();
    const m2 = t2.match(new RegExp('\\bHOY\\s*' + P));
    console.log('INGRESOS REALES · HOY:', m2 ? '$ ' + m2[1] : '(no sale)');
    if (!m2) fallos.push('no encuentro la columna HOY con su cifra en «Ingresos reales»');
    if (m1 && m2 && numero(m1[1]) !== numero(m2[1])) {
      fallos.push('el tablero dice $ ' + m1[1] + ' y «Ingresos reales» dice $ ' + m2[1] + ' para el mismo día');
    }
    const nota = t2.match(new RegExp('mototaxi ' + P + ' · taxi ' + P + ' · mandado ' + P));
    console.log('NOTA:', nota ? nota[0] : '(no sale con mototaxi · taxi · mandado)');
    if (!nota) fallos.push('la nota no enseña «mototaxi · taxi · mandado» con sus cifras');
    else {
      const vistos = { mototaxi: numero(nota[1]), taxi: numero(nota[2]), mandado: numero(nota[3]) };
      for (const k of Object.keys(esperado)) {
        if (vistos[k] !== esperado[k]) fallos.push('la nota dice ' + k + ' $ ' + vistos[k] + ' y config/global dice $ ' + esperado[k]);
      }
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el tablero y «Ingresos reales» dicen la misma ganancia, y la nota enseña la config de verdad');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
