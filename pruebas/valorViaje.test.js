// ═══════════════════════════════════════════════════════════════════════════
//  ¿CUÁNTO VALIÓ ESTE VIAJE? UNA SOLA REGLA · gemelo G19, 28-sep-2026
//
//  El panel (Viajes.js, Conductores.js, Pasajeros.js) decía que un viaje valió `contraofertaValor || tarifaValor`,
//  y la app del conductor (historial de AppConductor.js y Ganancias.js) `tarifaValor`. `contraofertaValor` es del
//  flujo VIEJO de contraofertas y ya no lo escribe nadie; el precio lo fija el servidor en `tarifaValor` al confirmar.
//  Medido con scripts/medir-valor-viaje.cjs: 15 viajes traen contraofertaValor y en 2 dice una oferta que NO quedó
//  (el panel les ponía $11.000 y $11.500 a viajes de $10.000 y $10.500).
//
//  Aquí se prueba, EJECUTANDO el código (sacado del archivo, no copiado):
//    · la regla de la app y la copia del panel dicen lo mismo con los mismos casos;
//    · las seis cuentas (4 del panel, 2 de la app) salen de esa regla y ya no miran contraofertaValor.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo } = require('./cargar.cjs');

const APP = cargarDeLaApp('guajirago/src/valorViaje.js');
const PANEL = cargarDeLaApp('guajirago-admin/src/valorViaje.js');
const codigo = (ruta) => soloCodigo(leer(ruta)).replace(/\r\n/g, '\n');

// El viaje de julio que el panel valoraba mal: la oferta vieja de $11.000 se quedó escrita, pero valió $10.000.
const VIEJO = { estado: 'finalizado', tarifaValor: 10000, contraofertaValor: 11000 };
const CASOS = [
  [VIEJO, 10000],
  [{ tarifaValor: 7500 }, 7500],
  [{ tarifaValor: '5000' }, 5000], // un número guardado como texto se lee como número, no se pega como texto
  [{ contraofertaValor: 9000 }, 0], // sin tarifaValor no valió nada que se pueda contar: la oferta no es el precio
  [{ tarifaValor: -300 }, 0],
  [{ tarifaValor: 'abc' }, 0],
  [{ tarifaValor: null }, 0],
  [{}, 0],
  [null, 0],
  [undefined, 0],
];

/** Un renglón `const <nombre> = ...;` del texto, tal cual. */
function renglon(texto, nombre) {
  const m = texto.match(new RegExp('\\n\\s*(const ' + nombre + ' = [^\\n]*;)\\n'));
  assert.ok(m, 'no encuentro «const ' + nombre + ' = …;» en un renglón');
  return m[1];
}
const correr = (lineas, nombres, valores) =>
  // eslint-disable-next-line no-new-func
  new Function(...nombres, lineas.join('\n'))(...valores);

// Cada viaje de la mezcla separa la regla de una de las cuentas de antes: la oferta vieja (panel), el número como texto
// (`acc + (v.tarifaValor || 0)` lo pega como texto) y el negativo (`Number(m.tarifaValor) || 0` lo resta).
const MEZCLA = [VIEJO, { estado: 'finalizado', tarifaValor: '5000' }, { estado: 'finalizado', tarifaValor: 2500 },
  { estado: 'finalizado', tarifaValor: -300 }];
const BUENO = 10000 + 5000 + 2500;

describe('¿CUÁNTO VALIÓ ESTE VIAJE? · una sola regla en la app y su copia atada en el panel (G19)', () => {
  it('la regla de la app y la copia del panel dan lo mismo con los mismos casos', () => {
    for (const [v, esperado] of CASOS) {
      assert.strictEqual(APP.valorDelViaje(v), esperado, 'la app: ' + JSON.stringify(v));
      assert.strictEqual(PANEL.valorDelViaje(v), esperado, 'el panel se separó de la app: ' + JSON.stringify(v));
    }
  });

  it('las seis pantallas importan la regla y ninguna lee contraofertaValor', () => {
    // G23 (28-sep-2026): el historial y Ganancias del conductor ya no suman por su cuenta; lo hace
    // gananciasConductor.js, que es quien importa la regla (pruebas/gananciasHoy.test.js exige que la usen).
    for (const ruta of ['guajirago/src/gananciasConductor.js', 'guajirago-admin/src/Viajes.js',
      'guajirago-admin/src/Conductores.js', 'guajirago-admin/src/Pasajeros.js', 'guajirago-admin/src/Mensajeria.js']) {
      const t = codigo(ruta);
      assert.match(t, /^import \{ valorDelViaje \} from '\.\/valorViaje';$/m, ruta + ' no importa la regla única');
      assert.ok(!/contraofertaValor/.test(t), ruta + ' volvió a leer contraofertaValor');
    }
    for (const ruta of ['guajirago/src/AppConductor.js', 'guajirago/src/Ganancias.js']) {
      assert.ok(!/contraofertaValor/.test(codigo(ruta)), ruta + ' volvió a leer contraofertaValor');
    }
  });

  it('el panel: Viajes, Conductores, Pasajeros y Mensajería cuentan con la regla (ejecutado)', () => {
    const viajes = codigo('guajirago-admin/src/Viajes.js');
    const valorViaje = correr([renglon(viajes, 'valorViaje'), 'return valorViaje;'], ['valorDelViaje'], [PANEL.valorDelViaje]);
    assert.strictEqual(valorViaje(VIEJO), 10000, 'Viajes.js valora el viaje con la oferta vieja');

    const cond = codigo('guajirago-admin/src/Conductores.js');
    const valorCobrado = correr([renglon(cond, 'valorCobrado'), 'return valorCobrado;'], ['valorDelViaje'], [PANEL.valorDelViaje]);
    assert.strictEqual(valorCobrado(VIEJO), 10000, 'Conductores.js valora el viaje con la oferta vieja');

    const pas = codigo('guajirago-admin/src/Pasajeros.js');
    const gastado = correr([renglon(pas, 'totalGastado'), 'return totalGastado;'], ['completados', 'valorDelViaje'],
      [MEZCLA, PANEL.valorDelViaje]);
    assert.strictEqual(gastado, BUENO, 'Pasajeros.js no suma con la regla única');

    const men = codigo('guajirago-admin/src/Mensajeria.js');
    const valorHoy = correr([renglon(men, 'valorHoy'), 'return valorHoy;'], ['entregadosHoy', 'valorDelViaje'],
      [MEZCLA, PANEL.valorDelViaje]);
    assert.strictEqual(valorHoy, BUENO, 'el resumen de Mensajería no suma con la regla única');
    const m = men.match(/\n\s*(conteo\[k\]\.valor \+= [^\n]*;)\n/);
    assert.ok(m, 'no encuentro «conteo[k].valor += …;» en Mensajeria.js');
    const conteo = { k: { valor: 0 } };
    for (const v of MEZCLA) correr([m[1]], ['conteo', 'k', 'm', 'valorDelViaje'], [conteo, 'k', v, PANEL.valorDelViaje]);
    assert.strictEqual(conteo.k.valor, BUENO, 'el ranking de domiciliarios no suma con la regla única');
  });

  it('la app del conductor: la cuenta de ganancias (historial y pantalla Ganancias) suma con la regla (ejecutado)', () => {
    // G23 (28-sep-2026): las dos pantallas cuentan con gananciasConductor.js; aquí se ejecuta esa cuenta.
    const GAN = cargarDeLaApp('guajirago/src/gananciasConductor.js');
    const ahora = new Date();
    const lista = MEZCLA.map((v) => ({ ...v, fechaSolicitud: ahora.toISOString() }));
    const r = GAN.resumenDeGanancias(lista, ahora, {});
    assert.strictEqual(r.hoy.total, BUENO, 'la cuenta de ganancias del conductor no suma con la regla única');
    assert.strictEqual(r.mes.total, BUENO, 'la cuenta de ganancias del mes no suma con la regla única');
  });

  it('el medidor cuenta los viajes cuya oferta vieja no es el precio (scripts/medir-valor-viaje.cjs)', () => {
    const { contar } = require('../scripts/medir-valor-viaje.cjs');
    const c = contar([
      { id: 'a', estado: 'finalizado', tarifaValor: 10000, contraofertaValor: 10000, conductorId: 'c1', pasajeroId: 'p1' },
      { id: 'b', estado: 'cancelado', tarifaValor: 10000, contraofertaValor: 11000, conductorId: 'c1', pasajeroId: 'p1' },
      { id: 'c', estado: 'finalizado', tarifaValor: 8000, contraofertaValor: 9000, conductorId: 'c2', pasajeroId: 'p2' },
    ], APP.valorDelViaje);
    assert.strictEqual(c.conContra, 3);
    assert.strictEqual(c.distintos.length, 2);
    assert.strictEqual(c.distintosFinalizados, 1);
    assert.deepStrictEqual(c.totales, { panelAntes: 19000, appAntes: 18000, regla: 18000 });
    assert.deepStrictEqual(c.conductoresQueCambian, [{ quien: 'c2', antes: 9000, ahora: 8000 }]);
  });
});
