// ═══════════════════════════════════════════════════════════════════════════
//  G53 · EL REGALO AL CONDUCTOR NUEVO: EL RESPALDO DEL SERVIDOR, ATADO AL DEL PANEL · 29-sep-2026
//
//  creditosDeBienvenida (guajirago/functions/index.js) le escribe al conductor nuevo sus créditos de regalo: lo que
//  diga config/global y, si la config no lo trae, un respaldo. El panel (Superadmin.js, CONFIG_POR_DEFECTO) tiene el
//  suyo, y pesa más: si config/global no existe, lo escribe ENTERO como configuración inicial. Hasta hoy el del
//  servidor iba a mano dentro de index.js (`?? 10000`, `?? 20000`) y ninguna prueba lo comparaba con el panel: cambiar
//  uno sin el otro no ponía nada en rojo, y el día que la config perdiera el número el servidor regalaría otra cifra.
//
//  Ahora el respaldo vive en guajirago/functions/regaloConductorNuevo.cjs. Esta prueba EJECUTA el `const monto = …`
//  de verdad (sacado de index.js por el medidor) y el objeto del panel, y exige que digan lo mismo.
//
//  Los otros números de respaldo del servidor ya estaban atados y NO se repiten aquí: las comisiones (G03,
//  pruebas/amarres.test.js), el radio de repuesto (G04, pruebas/leTocaElViaje.test.js) y el interruptor del regalo del
//  pasajero (G36, pruebas/configGlobal.test.js).
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const medidor = require('../scripts/medir-regalo-conductor.cjs');
const PIEZA = require('../guajirago/functions/regaloConductorNuevo.cjs');

const f = medidor.fuentes();
const panel = medidor.respaldoDelPanel(f.panel);

describe('G53 · el regalo al conductor nuevo: un solo respaldo en el servidor, atado al panel', () => {
  it('el panel tiene los dos números del regalo', () => {
    for (const k of ['incentivoNuevoMototaxi', 'incentivoNuevoTaxi']) {
      assert.strictEqual(typeof panel[k], 'number', 'el panel ya no tiene «' + k + '» en CONFIG_POR_DEFECTO (¿se renombró?)');
    }
  });

  it('el respaldo del servidor vale lo mismo que el del panel, número por número', () => {
    assert.deepStrictEqual(Object.keys(PIEZA.REGALO_CONDUCTOR_DEFECTO).sort(), ['incentivoNuevoMototaxi', 'incentivoNuevoTaxi']);
    for (const k of Object.keys(PIEZA.REGALO_CONDUCTOR_DEFECTO)) {
      assert.strictEqual(PIEZA.REGALO_CONDUCTOR_DEFECTO[k], panel[k],
        'El respaldo de «' + k + '» vale ' + PIEZA.REGALO_CONDUCTOR_DEFECTO[k] + ' en el servidor y ' + panel[k]
        + ' en el panel. Se cambia en LOS DOS: regaloConductorNuevo.cjs y Superadmin.js.');
    }
  });

  it('creditosDeBienvenida, EJECUTADO sin config, regala lo que dice el panel para cada vehículo', () => {
    const r = medidor.medirCodigo(f);
    assert.ok(r.usaPieza, 'el medidor no encontró la pieza regaloConductorNuevo.cjs');
    for (const x of r.filas) {
      assert.strictEqual(x.servidor, x.panel,
        'sin config, el servidor le regala ' + x.servidor + ' a un conductor ' + x.tipoVehiculo + ' y el panel dice ' + x.panel);
    }
    assert.strictEqual(r.distintos, 0);
  });

  it('creditosDeBienvenida usa la pieza: lo que diga config/global manda (también el 0, que apaga el regalo)', () => {
    const cuerpo = medidor.cuerpoDeLaFuncion(f.index);
    assert.match(cuerpo, /const monto = regaloDelConductorNuevo\(u\.tipoVehiculo, cfg\);/,
      'creditosDeBienvenida ya no calcula el monto con regaloDelConductorNuevo');
    assert.match(f.index, /^const \{[^}]*\bregaloDelConductorNuevo\b[^}]*\} = require\('\.\/regaloConductorNuevo\.cjs'\);/m,
      'index.js no trae regaloDelConductorNuevo de ./regaloConductorNuevo.cjs');
    const cfg = { incentivoNuevoMototaxi: 7000, incentivoNuevoTaxi: 15000 };
    assert.strictEqual(medidor.regaloDelServidor(f, 'Mototaxi', cfg), 7000);
    assert.strictEqual(medidor.regaloDelServidor(f, 'Taxi', cfg), 15000);
    assert.strictEqual(medidor.regaloDelServidor(f, undefined, cfg), 15000, 'sin tipo de vehículo se regala el de taxi');
    assert.strictEqual(medidor.regaloDelServidor(f, 'Mototaxi', { incentivoNuevoMototaxi: 0 }), 0, 'el 0 del panel no apaga el regalo');
  });

  it('en el servidor no queda ningún número de respaldo escrito a mano (`?? 20000`, `|| 3`…)', () => {
    assert.deepStrictEqual(medidor.numerosSueltos(f), [],
      'hay números de respaldo escritos a mano en el servidor: salen de una pieza atada (SEGUNDA LEY)');
  });

  it('y el medidor no se puede ablandar: con el index de antes (a mano) y un número distinto, se queja', () => {
    const viejo = f.index.replace('const monto = regaloDelConductorNuevo(u.tipoVehiculo, cfg);',
      'const monto = u.tipoVehiculo === "Mototaxi"\n        ? (cfg.incentivoNuevoMototaxi ?? 10000)\n        : (cfg.incentivoNuevoTaxi ?? 25000);');
    assert.notStrictEqual(viejo, f.index, 'el reemplazo de prueba no calzó');
    const r = medidor.medirCodigo({ index: viejo, pieza: null, panel: f.panel });
    assert.strictEqual(r.sueltos.length, 2, 'el medidor no ve los dos números escritos a mano');
    assert.strictEqual(r.distintos, 3, 'el medidor no ve que Taxi, sin tipo y Carro regalan distinto que el panel');
  });
});
