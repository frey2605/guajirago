/**
 * EL DESCUENTO DEL PASAJERO — PRUEBAS QUE EJECUTAN EL ARCHIVO REAL
 *
 * Igual que tarifas.test.js: no leen texto para ver si "se ve bien", CARGAN
 * guajirago/src/descuentos.js tal cual está en el disco y le piden números.
 *
 * Los casos NO son inventados: son los que hay VIVOS en Firestore, medidos el
 * 23-ago-2026 — 20 viajes con descuento, todos crédito de $8.000, incluido el
 * caso del viaje de $5.000 donde el crédito era más grande que la tarifa.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { RAIZ, cargarDeLaApp } = require('./cargar.cjs');

const { aplicarDescuento, armarDescuentoInfo, tarifaParaPasajero } = cargarDeLaApp('guajirago/src/descuentos.js');

// El descuento que existe de verdad: el crédito de bienvenida de $8.000.
const CREDITO_8000 = { promoId: 'bienvenida', tipoBeneficio: 'credito', valorBeneficio: 8000, codigoVerificacion: '1234' };

describe('SEGUNDA LEY · el descuento, una sola calculadora', () => {
  it('los viajes REALES: $10.000 con crédito de $8.000 → paga $2.000', () => {
    // Así están guardados 14 de los 20 viajes vivos con descuento.
    assert.strictEqual(aplicarDescuento(10000, CREDITO_8000), 2000);
  });

  it('el crédito MÁS GRANDE que la tarifa: paga $0, nunca negativo', () => {
    // Caso real: hay 2 viajes vivos de $5.000 con crédito de $8.000. Si esto
    // devolviera -3000, el viaje se crearía diciendo que GuajiraGo le debe
    // plata al pasajero.
    assert.strictEqual(aplicarDescuento(5000, CREDITO_8000), 0);
    assert.strictEqual(aplicarDescuento(8000, CREDITO_8000), 0);
  });

  it('sin descuento pendiente, la tarifa queda tal cual', () => {
    assert.strictEqual(aplicarDescuento(10000, null), 10000);
    assert.strictEqual(aplicarDescuento(10000, undefined), 10000);
  });

  it('el descuento en % descuenta el porcentaje y redondea', () => {
    // Hoy no hay ninguno vivo en %, pero el panel puede crearlos (Promociones).
    const DIEZ_POR_CIENTO = { tipoBeneficio: 'descuento', valorBeneficio: 10 };
    assert.strictEqual(aplicarDescuento(8000, DIEZ_POR_CIENTO), 7200);
    // 15% de $8.500 = $7.225 exacto; 33% de $10.000 = $6.700
    assert.strictEqual(aplicarDescuento(10000, { tipoBeneficio: 'descuento', valorBeneficio: 33 }), 6700);
  });

  it('la ficha del viaje se arma con los MISMOS campos que leen el conductor y el panel', () => {
    // Estos nombres cruzan de app en app (AppConductor.js los lee al verificar
    // el código y acreditar la plata). La forma se compara ENTERA y de una vez:
    // si un campo se renombra o desaparece, esto se pone rojo.
    assert.deepStrictEqual(armarDescuentoInfo(10000, CREDITO_8000), {
      tarifaOriginal: 10000,
      tarifaPasajeroPaga: 2000,
      descuentoAplicado: 8000,
      promoId: 'bienvenida',
      tipoBeneficio: 'credito',
      valorBeneficio: 8000,
      codigoVerificacion: '1234',
      consumido: false,
    });
  });

  it('en la ficha, lo aplicado es tarifa MENOS lo pagado — también cuando el crédito sobra', () => {
    // El viaje real de $5.000: pagó $0 y lo aplicado fue $5.000 (no $8.000).
    // Al conductor se le acredita descuentoAplicado: si dijera 8000, GuajiraGo
    // pagaría $3.000 de más por un viaje de $5.000.
    const ficha = armarDescuentoInfo(5000, CREDITO_8000);
    assert.strictEqual(ficha.tarifaPasajeroPaga, 0);
    assert.strictEqual(ficha.descuentoAplicado, 5000);
    assert.strictEqual(ficha.consumido, false, 'la ficha nace SIN consumir: se consume al verificar el código');
  });

  it('sin descuento pendiente NO hay ficha: el viaje se crea limpio', () => {
    assert.strictEqual(armarDescuentoInfo(10000, null), null);
  });

  it('al pasajero se le enseña lo que VA A PAGAR, no la tarifa completa', () => {
    const viajeConDescuento = { tarifa: '$10.000', descuentoInfo: { tarifaPasajeroPaga: 2000 } };
    const viajeSinDescuento = { tarifa: '$10.000' };
    assert.strictEqual(tarifaParaPasajero(viajeConDescuento), `$${(2000).toLocaleString()}`);
    assert.strictEqual(tarifaParaPasajero(viajeSinDescuento), '$10.000');
    // Y con paga $0 se enseña $0, no la tarifa completa: != null, no falsy.
    assert.strictEqual(tarifaParaPasajero({ tarifa: '$5.000', descuentoInfo: { tarifaPasajeroPaga: 0 } }), '$0');
  });

  it('NINGUNA pantalla tiene su propia copia de la cuenta', () => {
    // El candado de la SEGUNDA LEY. Se busca la ARITMÉTICA del descuento, no el
    // nombre: las pantallas conservan un pase de un renglón que se llama igual,
    // pero la cuenta (restar el crédito, el % y su redondeo, armar la ficha)
    // solo puede vivir en descuentos.js.
    const PANTALLAS = ['guajirago/src/Solicitar.js', 'guajirago/src/SolicitarMensajeria.js'];
    for (const pantalla of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(RAIZ, pantalla), 'utf8');
      for (const huella of ['valorBeneficio / 100', 'tarifaBase - descuentoPendiente', 'descuentoAplicado:']) {
        assert.ok(
          !fuente.includes(huella),
          pantalla + ' volvió a tener su PROPIA cuenta del descuento (se encontró «' + huella + '»). ' +
          'La SEGUNDA LEY lo prohíbe: la cuenta vive en descuentos.js y solo ahí.'
        );
      }
      assert.ok(
        /from\s+'\.\/descuentos'/.test(fuente),
        pantalla + ' no está importando la cuenta de descuentos.js.'
      );
    }
  });
});
