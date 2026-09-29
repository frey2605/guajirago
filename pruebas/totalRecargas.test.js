/**
 * G54 · EL TOTAL RECARGADO DEL PANEL SE CUENTA EN UN SOLO SITIO (29-sep-2026)
 *
 * El tablero (guajirago-admin/src/App.js, 💰 Recargas) y 🎟️ Códigos («VALOR RECARGADO», Codigos.js) sumaban lo
 * recargado con criterios distintos: el tablero contaba los anulados ya cobrados y 🎟️ Códigos no; 🎟️ Códigos contaba
 * un `usado` que solo «pareciera verdad» y el tablero no; y el tablero perdía los que traían la fecha de uso como
 * Timestamp. Ahora las dos usan `totalRecargado` (guajirago-admin/src/recargas.js), con el criterio del servidor que
 * acredita (canjearCodigoRecarga escribe `usado: true` en la misma transacción en que suma el saldo).
 *
 *   1. La pieza se EJECUTA con los casos que separaban a las dos cuentas.
 *   2. Las dos pantallas se sacan de su archivo con el MISMO lector del medidor (scripts/medir-total-recargas.cjs) y
 *      se EJECUTAN: tienen que dar lo mismo que la pieza, con fechas y sin ellas.
 *   3. Ningún otro archivo del panel vuelve a sumar códigos cobrados a mano.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const { lasDosCuentas } = require('../scripts/medir-total-recargas.cjs');
const { timestampDe } = require('../scripts/medir-fecha-pedido.cjs');

const PIEZA = 'guajirago-admin/src/recargas.js';

// Los casos que separaban a las dos cuentas.
const JUNIO = '2026-06-15T15:00:00.000Z';
const JULIO = '2026-07-02T18:00:00.000Z';
const CODIGOS = [
  { id: 'COBRADO', usado: true, anulado: false, valor: 50000, fechaUso: JUNIO },
  { id: 'COBRADO-Y-ANULADO', usado: true, anulado: true, valor: 40000, fechaUso: JUNIO },
  { id: 'SIN-USAR', usado: false, anulado: false, valor: 70000 },
  { id: 'ANULADO-SIN-USAR', usado: false, anulado: true, valor: 60000 },
  { id: 'USADO-QUE-PARECE', usado: 'si', valor: 30000, fechaUso: JUNIO },
  { id: 'FECHA-TIMESTAMP', usado: true, valor: 20000, fechaUso: timestampDe(JULIO) },
  { id: 'VALOR-TEXTO', usado: true, valor: '5000', fechaUso: JUNIO },
  { id: 'VALOR-NEGATIVO', usado: true, valor: -900, fechaUso: JUNIO },
  { id: 'SIN-FECHA', usado: true, valor: 1000 },
  { id: 'ESCRITO-ENCIMA', usado: false, valor: 800, fechaUso: JUNIO },
];
const TODO = 50000 + 40000 + 20000 + 1000;
const RANGOS = [
  [new Date(2026, 5, 1), new Date(2026, 5, 30, 23, 59, 59), 50000 + 40000],
  [new Date(2026, 6, 1), new Date(2026, 6, 31, 23, 59, 59), 20000],
  [new Date(2026, 5, 1), null, 50000 + 40000 + 20000],
  [new Date(2000, 0, 1), null, 50000 + 40000 + 20000],
  [new Date(2026, 7, 1), new Date(2026, 7, 31, 23, 59, 59), 0],
];

describe('G54 · el total recargado del panel sale de UNA cuenta', () => {
  it('la pieza cuenta lo que entró a los saldos: usado === true, por su valor, anulado o no', () => {
    const P = cargarDeLaApp(PIEZA);
    assert.strictEqual(P.totalRecargado(CODIGOS), TODO);
    assert.strictEqual(P.totalRecargado([]), 0);
    assert.strictEqual(P.totalRecargado(null), 0);
    assert.strictEqual(P.esRecargaCobrada({ usado: true, anulado: true }), true, 'un anulado ya cobrado está en el saldo');
    assert.strictEqual(P.esRecargaCobrada({ usado: 'si' }), false, 'solo cuenta lo que el servidor marcó true');
    assert.strictEqual(P.esRecargaCobrada(null), false);
    assert.strictEqual(P.valorDeRecarga({ valor: '5000' }), 0);
    assert.strictEqual(P.valorDeRecarga({ valor: NaN }), 0);
    assert.strictEqual(P.valorDeRecarga({ valor: -1 }), 0);
    assert.strictEqual(P.valorDeRecarga({ valor: 800 }), 800);
    for (const [desde, hasta, esperado] of RANGOS) {
      assert.strictEqual(P.totalRecargado(CODIGOS, desde, hasta), esperado, 'rango ' + desde.toISOString() + ' → ' + hasta);
    }
  });

  it('el tablero (App.js) y 🎟️ Códigos (Codigos.js), ejecutados, dicen lo mismo que la pieza', () => {
    const P = cargarDeLaApp(PIEZA);
    const C = lasDosCuentas(null);
    assert.ok(C.usaLaPieza, 'las dos pantallas tienen que llamar a totalRecargado');
    assert.strictEqual(C.pantalla(CODIGOS), TODO, '🎟️ Códigos «VALOR RECARGADO»');
    assert.strictEqual(C.pantalla(CODIGOS), P.totalRecargado(CODIGOS));
    for (const [desde, hasta, esperado] of RANGOS) {
      assert.strictEqual(C.tablero(CODIGOS, desde, hasta), esperado, 'tablero, rango ' + desde.toISOString() + ' → ' + hasta);
    }
    // El total de siempre del tablero es el de 🎟️ Códigos (los que no traen fecha no caen en ningún mes).
    assert.strictEqual(C.tablero(CODIGOS, new Date(2000, 0, 1), null) + 1000, C.pantalla(CODIGOS));
  });

  it('ningún otro archivo del panel vuelve a sumar a mano los códigos cobrados', () => {
    const carpeta = path.join(__dirname, '..', 'guajirago-admin', 'src');
    const culpables = [];
    for (const f of fs.readdirSync(carpeta).filter((n) => n.endsWith('.js') && n !== 'recargas.js')) {
      const lineas = leer('guajirago-admin/src/' + f).split(/\r?\n/);
      lineas.forEach((l, i) => {
        if (/^\s*(\/\/|\*)/.test(l)) return;
        if (/\busado\b/.test(l) && /\.reduce\(/.test(l)) culpables.push(f + ':' + (i + 1));
      });
    }
    assert.deepStrictEqual(culpables, [], 'suma de códigos cobrados fuera de recargas.js');
  });
});
