// ═══════════════════════════════════════════════════════════════════════════
//  EL ABONO DEL DESCUENTO LO DECIDE EL SERVIDOR · pendiente P02, 30-sep-2026
//
//  Hasta P02, `consumirDescuentoViaje` le abonaba al conductor el número `descuentoInfo.descuentoAplicado` escrito
//  DENTRO del viaje (que el pasajero y el conductor podían cambiar), y `confirmarConductor` rehacía la cuenta con el
//  `valorBeneficio` que había escrito el teléfono. Ahora las dos le preguntan a UNA pieza, `descuentoQueVale`
//  (guajirago/functions/descuentoPendiente.cjs), cuánto vale el descuento de la ficha del pasajero.
//
//  Aquí se EJECUTA esa pieza caso por caso (la regla del negocio: con firma vale lo que dice; sin firma solo si es lo
//  de su origen), se ejecuta el medidor con datos de mentira para que no se ablande, y se mira que las dos funciones
//  del servidor no vuelvan a leer la plata del viaje. Las funciones encendidas de verdad, con el ataque, las prueba
//  pruebas/funciones.test.js («P02 · el abono del descuento lo decide el servidor, no el viaje») contra el emulador.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo } = require('./cargar.cjs');

const { descuentoQueVale } = require('../guajirago/functions/descuentoPendiente.cjs');
const { revisar } = require('../scripts/medir-descuento-del-viaje.cjs');

const FIRMADO = { promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: 8000, codigoVerificacion: '4455', fabricadoPor: 'servidor' };
const sinFirma = (o) => { const c = { ...FIRMADO, ...o }; delete c.fabricadoPor; return c; };
const PROMO = { tipoBeneficio: 'credito', valorBeneficio: 5000 };

describe('P02 · cuánto vale el descuento de una ficha (descuentoQueVale)', () => {
  it('con la firma del servidor vale lo que dice', () => {
    assert.deepStrictEqual(descuentoQueVale(FIRMADO, null),
      { promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: 8000, codigoVerificacion: '4455' });
    assert.strictEqual(descuentoQueVale({ ...FIRMADO, promoId: 'P10', tipoBeneficio: 'descuento', valorBeneficio: 10 }, null).valorBeneficio, 10);
  });

  it('SIN firma, la bienvenida vale solo si es exactamente $8.000 de crédito', () => {
    assert.strictEqual(descuentoQueVale(sinFirma({}), null).valorBeneficio, 8000);
    assert.strictEqual(descuentoQueVale(sinFirma({ valorBeneficio: 50000 }), null), null, 'una bienvenida sin firma de $50.000 valió');
    assert.strictEqual(descuentoQueVale(sinFirma({ tipoBeneficio: 'descuento', valorBeneficio: 100 }), null), null);
  });

  it('SIN firma, una promoción vale solo si su tipo y valor son los de la promoción de hoy', () => {
    const d = sinFirma({ promoId: 'PROMO-X', valorBeneficio: 5000 });
    assert.strictEqual(descuentoQueVale(d, PROMO).valorBeneficio, 5000);
    assert.strictEqual(descuentoQueVale(d, { ...PROMO, valorBeneficio: 4000 }), null, 'valió con otro valor que el de su promoción');
    assert.strictEqual(descuentoQueVale(d, { ...PROMO, tipoBeneficio: 'descuento' }), null);
    assert.strictEqual(descuentoQueVale(d, null), null, 'valió una promoción que ya no existe');
  });

  it('nunca vale lo que no es plata sana (ni con firma)', () => {
    for (const malo of [
      { valorBeneficio: 0 }, { valorBeneficio: -8000 }, { valorBeneficio: '8000' }, { valorBeneficio: NaN },
      { valorBeneficio: Infinity }, { tipoBeneficio: 'descuento', valorBeneficio: 150 }, { tipoBeneficio: 'regalo' },
      { codigoVerificacion: '' }, { codigoVerificacion: null }, { codigoVerificacion: 'abc' },
    ]) {
      assert.strictEqual(descuentoQueVale({ ...FIRMADO, ...malo }, null), null, 'valió ' + JSON.stringify(malo));
    }
    assert.strictEqual(descuentoQueVale(null, null), null);
    assert.strictEqual(descuentoQueVale(undefined, PROMO), null);
    assert.strictEqual(descuentoQueVale('8000', PROMO), null);
  });

  it('el código se queda con sus cifras, como lo compara el cobro', () => {
    assert.strictEqual(descuentoQueVale({ ...FIRMADO, codigoVerificacion: ' 44-55 ' }, null).codigoVerificacion, '4455');
  });
});

describe('P02 · las dos funciones del servidor ya no leen la plata del viaje', () => {
  const fuente = soloCodigo(leer('guajirago/functions/index.js'));
  const cuerpoDe = (nombre) => {
    const ini = fuente.indexOf('exports.' + nombre);
    const fin = fuente.indexOf('exports.', ini + 10);
    assert.ok(ini > 0 && fin > ini, 'no encontré ' + nombre);
    return fuente.slice(ini, fin);
  };

  it('consumirDescuentoViaje: el monto sale de descuentoQueVale, no de descuentoInfo, y quema la ficha', () => {
    const c = cuerpoDe('consumirDescuentoViaje');
    assert.match(c, /descuentoQueVale\(/, 'el cobro no mira la ficha del pasajero');
    assert.doesNotMatch(c, /info\.descuentoAplicado/, 'el cobro vuelve a leer el monto del viaje');
    assert.doesNotMatch(c, /info\.codigoVerificacion/, 'el cobro vuelve a comparar con el código del viaje');
    assert.doesNotMatch(c, /info\.valorBeneficio|info\.tipoBeneficio/, 'el cobro vuelve a leer el valor del viaje');
    assert.match(c, /t\.update\(refFichaPasajero,\s*\{\s*descuentoPendiente:[^}]*FieldValue\.delete\(\)/,
      'el cobro no quema el descuento de la ficha en la misma transacción');
  });

  it('confirmarConductor: no rehace la cuenta con lo que trae el viaje', () => {
    const c = cuerpoDe('confirmarConductor');
    assert.match(c, /descuentoQueVale\(/);
    assert.doesNotMatch(c, /descuentoSobreTarifaAceptada\(\s*viaje\.descuentoInfo/);
    assert.doesNotMatch(c, /\.\.\.viaje\.descuentoInfo/, 'confirmarConductor copia campos de la ficha del teléfono');
  });
});

describe('P02 · el medidor (scripts/medir-descuento-del-viaje.cjs) no se ablanda', () => {
  const viaje = (id, o) => ({ id, pasajeroId: 'ana', estado: 'finalizado', tarifaValor: 15000, ...o });
  const info = (o) => ({ promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: 8000, codigoVerificacion: '4455',
    tarifaOriginal: 15000, descuentoAplicado: 8000, consumido: true, ...o });

  it('cuenta lo abonado, lo que cuadra y lo que no cuadra con su origen', () => {
    const r = revisar({
      viajes: [viaje('v1', { descuentoInfo: info() }), viaje('v2', { descuentoInfo: info({ descuentoAplicado: 999999, codigoVerificacion: '1' }) }),
        viaje('v3', { descuentoInfo: info({ promoId: 'BORRADA' }) }), viaje('v4', {})],
      usuarios: [], promos: {},
    });
    assert.strictEqual(r.conInfo.length, 3);
    assert.strictEqual(r.abonado, 8000 + 999999 + 8000);
    assert.deepStrictEqual(r.cuadran.map((v) => v.id), ['v1']);
    assert.deepStrictEqual(r.noCuadran.map((x) => [x.v.id, x.debia]), [['v2', 8000]]);
    assert.deepStrictEqual(r.sinOrigen.map((v) => v.id), ['v3']);
  });

  it('ve el mismo descuento cobrado dos veces y la ficha que lo guarda sin quemar', () => {
    const r = revisar({
      viajes: [viaje('v1', { descuentoInfo: info() }), viaje('v2', { descuentoInfo: info({ codigoVerificacion: '44-55' }) })],
      usuarios: [{ id: 'ana', descuentoPendiente: { ...FIRMADO } }], promos: {},
    });
    assert.strictEqual(r.cobradosDosVeces.length, 1);
    assert.strictEqual(r.sinQuemar.length, 1);
  });

  it('dice qué les daría P02 a los viajes vivos (según la ficha, no según el viaje)', () => {
    const r = revisar({
      viajes: [viaje('v1', { estado: 'aceptado', descuentoInfo: info({ consumido: false, descuentoAplicado: 999999 }) }),
        viaje('v2', { estado: 'esperando', pasajeroId: 'luis', descuentoInfo: info({ consumido: false }) })],
      usuarios: [{ id: 'ana', descuentoPendiente: { ...FIRMADO, enViajeId: 'v1' } }, { id: 'luis' }], promos: {},
    });
    assert.strictEqual(r.vivos.length, 2);
    assert.strictEqual(r.vivos[0].vale.valorBeneficio, 8000);
    assert.strictEqual(r.vivos[0].antes, 999999);
    assert.strictEqual(r.vivos[1].vale, null, 'a un pasajero sin descuento en la ficha le dio uno');
    assert.strictEqual(r.apartados.length, 1);
  });
});
