// ═══════════════════════════════════════════════════════════════════════════
//  EL DESCUENTO SE CALCULA SOBRE LA TARIFA ACEPTADA · gemelo G01, 27-sep-2026
//
//  La ficha `descuentoInfo` se armaba una sola vez, en el celular, con la oferta del pasajero. Si el conductor
//  contraofertaba, la tarifa cambiaba y la ficha no: oferta $10.000, contraoferta $15.000, crédito $8.000 → el
//  pasajero veía «$2.000», el conductor $15.000 y el servidor abonaba $8.000. Faltaban $5.000.
//
//  Ahora `confirmarConductor` la rehace sobre la tarifa aceptada con guajirago/functions/descuentos.cjs, que es COPIA
//  de guajirago/src/descuentos.js (la nube no puede importar la app). Esta prueba EJECUTA las dos con los mismos casos
//  y exige que digan lo mismo; y ejecuta la pieza del servidor con el caso del hallazgo. La función encendida de
//  verdad, con su transacción, la prueba pruebas/funciones.test.js contra el emulador.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer, soloCodigo } = require('./cargar.cjs');

const APP = cargarDeLaApp('guajirago/src/descuentos.js');
const NUBE = require('../guajirago/functions/descuentos.cjs');

const CREDITO_8000 = { promoId: 'bienvenida', tipoBeneficio: 'credito', valorBeneficio: 8000, codigoVerificacion: '1234' };
const DIEZ_POR_CIENTO = { promoId: 'P10', tipoBeneficio: 'descuento', valorBeneficio: 10, codigoVerificacion: '9876' };

const TARIFAS = [0, 1000, 4600, 5000, 7200, 8000, 9999, 10000, 15000, 23500, 100000];
const BENEFICIOS = [null, undefined, CREDITO_8000, DIEZ_POR_CIENTO,
  { promoId: 'X', tipoBeneficio: 'descuento', valorBeneficio: 33, codigoVerificacion: '1' },
  { promoId: 'Y', tipoBeneficio: 'credito', valorBeneficio: 0, codigoVerificacion: '2' },
  { promoId: 'Z', tipoBeneficio: 'descuento', valorBeneficio: 100, codigoVerificacion: '3' }];

describe('G01 · la cuenta del celular y la del servidor son la MISMA', () => {
  it('aplicarDescuento da lo mismo en las dos, caso por caso', () => {
    let n = 0;
    for (const t of TARIFAS) for (const b of BENEFICIOS) {
      assert.strictEqual(NUBE.aplicarDescuento(t, b), APP.aplicarDescuento(t, b),
        'la copia del servidor se separó de la app con tarifa ' + t + ' y ' + JSON.stringify(b));
      n++;
    }
    assert.strictEqual(n, TARIFAS.length * BENEFICIOS.length);
  });

  it('armarDescuentoInfo arma la misma ficha en las dos (mismos campos, mismos números)', () => {
    for (const t of TARIFAS) for (const b of BENEFICIOS) {
      assert.deepStrictEqual(NUBE.armarDescuentoInfo(t, b), APP.armarDescuentoInfo(t, b),
        'la ficha del servidor no es la de la app con tarifa ' + t + ' y ' + JSON.stringify(b));
    }
  });
});

describe('G01 · el servidor rehace la ficha sobre la tarifa aceptada', () => {
  const fichaDeCreacion = (oferta, b) => APP.armarDescuentoInfo(oferta, b);

  it('el caso del hallazgo: $10.000 → contraoferta $15.000 con crédito $8.000 → paga $7.000 y se abonan $8.000', () => {
    const f = NUBE.descuentoSobreTarifaAceptada(fichaDeCreacion(10000, CREDITO_8000), 15000);
    assert.strictEqual(f.tarifaOriginal, 15000);
    assert.strictEqual(f.tarifaPasajeroPaga, 7000, 'antes decía $2.000: la cuenta sobre la oferta vieja');
    assert.strictEqual(f.descuentoAplicado, 8000, 'un crédito sigue valiendo los mismos pesos');
    assert.strictEqual(f.tarifaPasajeroPaga + f.descuentoAplicado, 15000, 'lo que paga + lo que abona GuajiraGo = lo que cobra el conductor');
    assert.strictEqual(f.codigoVerificacion, '1234');
    assert.strictEqual(f.promoId, 'bienvenida');
    assert.strictEqual(f.consumido, false);
  });

  it('un porcentaje se aplica sobre la tarifa aceptada: 10% de $15.000', () => {
    const f = NUBE.descuentoSobreTarifaAceptada(fichaDeCreacion(10000, DIEZ_POR_CIENTO), 15000);
    assert.strictEqual(f.tarifaPasajeroPaga, 13500);
    assert.strictEqual(f.descuentoAplicado, 1500);
  });

  it('si la tarifa BAJA por debajo del crédito, paga $0 y se abona solo la tarifa (nunca más)', () => {
    const f = NUBE.descuentoSobreTarifaAceptada(fichaDeCreacion(10000, CREDITO_8000), 5000);
    assert.strictEqual(f.tarifaPasajeroPaga, 0);
    assert.strictEqual(f.descuentoAplicado, 5000);
  });

  it('con cualquier tarifa, lo que paga + lo que se abona = la tarifa aceptada', () => {
    for (const oferta of TARIFAS.filter((t) => t > 0)) for (const acept of TARIFAS.filter((t) => t > 0))
      for (const b of BENEFICIOS.filter(Boolean)) {
        const f = NUBE.descuentoSobreTarifaAceptada(fichaDeCreacion(oferta, b), acept);
        assert.strictEqual(f.tarifaOriginal, acept);
        assert.strictEqual(f.tarifaPasajeroPaga + f.descuentoAplicado, acept);
      }
  });

  it('no rehace lo que no toca: sin ficha, ya abonada, o sin tarifa que sea número', () => {
    assert.strictEqual(NUBE.descuentoSobreTarifaAceptada(undefined, 15000), null);
    assert.strictEqual(NUBE.descuentoSobreTarifaAceptada(null, 15000), null);
    const abonada = { ...fichaDeCreacion(10000, CREDITO_8000), consumido: true };
    assert.strictEqual(NUBE.descuentoSobreTarifaAceptada(abonada, 15000), null, 'la plata ya abonada no se toca');
    for (const malo of [undefined, null, 0, -5, 'quince', NaN])
      assert.strictEqual(NUBE.descuentoSobreTarifaAceptada(fichaDeCreacion(10000, CREDITO_8000), malo), null);
  });

  it('lo que la ficha traiga de más se conserva', () => {
    const f = NUBE.descuentoSobreTarifaAceptada({ ...fichaDeCreacion(10000, CREDITO_8000), otraCosa: 'x' }, 12000);
    assert.strictEqual(f.otraCosa, 'x');
  });

  it('confirmarConductor la usa con la MISMA tarifa que guarda, y la escribe en el viaje', () => {
    const fuente = soloCodigo(leer('guajirago/functions/index.js'));
    const ini = fuente.indexOf('exports.confirmarConductor');
    const fin = fuente.indexOf('exports.', ini + 10);
    assert.ok(ini > 0 && fin > ini, 'no encontré confirmarConductor');
    const cuerpo = fuente.slice(ini, fin);
    assert.match(fuente, /require\(['"]\.\/descuentos\.cjs['"]\)/, 'el servidor no carga su cuenta del descuento');
    // P02 (30-sep-2026): la ficha se rehace con el descuento que VALE según la ficha del pasajero (`vale`, de
    // descuentoQueVale), no con el número que traiga el viaje (lo escribía el teléfono).
    const m = cuerpo.match(/descuentoSobreTarifaAceptada\(\s*\{\s*\.\.\.vale\s*,\s*consumido:\s*false\s*\}\s*,\s*(\w+)\s*\)/);
    assert.ok(m, 'confirmarConductor no rehace la ficha desde el descuento de la ficha del pasajero');
    assert.doesNotMatch(cuerpo, /descuentoSobreTarifaAceptada\(\s*viaje\.descuentoInfo/, 'confirmarConductor vuelve a creerse el número del viaje');
    assert.match(cuerpo, /descuentoQueVale\(/, 'confirmarConductor no mira cuánto vale de verdad el descuento');
    assert.match(cuerpo, new RegExp('tarifaValor:\\s*' + m[1] + '\\s*,'), 'la tarifa que se guarda no es la misma sobre la que se rehace el descuento');
    assert.match(cuerpo, /t\.update\(viajeRef,[\s\S]*descuentoInfo[\s\S]*\}\);/, 'la ficha rehecha no se escribe en el viaje');
  });
});
