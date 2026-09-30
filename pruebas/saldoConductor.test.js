/**
 * G81 · ¿CUÁNTO SALDO TIENE EL CONDUCTOR? (29-sep-2026)
 *
 * El saldo lo calcula y lo guarda el SERVIDOR en la ficha `usuarios/{uid}` (campo `creditos`).
 * La app solo lo enseña, y lo sacaba de la ficha escribiendo la misma cuenta a mano en cuatro
 * sitios (dos en AppConductor.js, dos en Creditos.js). Ahora los cuatro llaman a `saldoDe`
 * (guajirago/src/saldoUsuario.js).
 *
 *   1. La pieza se EJECUTA con fichas de mentira.
 *   2. Los cuatro sitios se SACAN del archivo y se CORREN (scripts/medir-saldo-conductor.cjs):
 *      los cuatro pasan por la pieza, y dan EXACTAMENTE lo mismo que el código de antes
 *      (commit f6a60f4) en todos los casos, buenos y raros.
 *   3. En guajirago/src nadie más escribe `.creditos` a mano: una pantalla nueva que enseñe el
 *      saldo de la ficha tiene que pasar por la pieza.
 *   4. Pantallas de mentira: si la pieza cambia la cuenta, o un sitio vuelve a la cuenta a mano,
 *      esta prueba se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo } = require('./cargar.cjs');
const { medir, carear, CASOS, PIEZA, ANTES } = require('../scripts/medir-saldo-conductor.cjs');

describe('G81 · el saldo del conductor sale de UNA pieza', () => {
  it('la pieza da el saldo guardado, y 0 si no hay', () => {
    const { saldoDe } = medir(null);
    assert.strictEqual(typeof saldoDe, 'function', 'no está saldoDe en ' + PIEZA);
    assert.strictEqual(saldoDe({ creditos: 5000 }), 5000);
    assert.strictEqual(saldoDe({ creditos: -2500 }), -2500, 'un saldo negativo se enseña tal cual (lo decide el servidor)');
    assert.strictEqual(saldoDe({ creditos: 0 }), 0);
    assert.strictEqual(saldoDe({}), 0);
    assert.strictEqual(saldoDe(null), 0);
    assert.strictEqual(saldoDe(undefined), 0);
    assert.strictEqual(saldoDe({ creditos: null }), 0);
  });

  it('los cuatro sitios que enseñan el saldo pasan por la pieza (corridos)', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.strictEqual(m.sitios.length, 4);
    for (const s of m.sitios) {
      assert.match(s.expr, /\bsaldoDe\(snap\.data\(\)\)/, s.id + ' no lee el saldo con saldoDe: `' + s.expr + '`');
      assert.strictEqual(s.correr({ creditos: 7300 }), 7300, s.id + ' no enseña el saldo guardado');
      assert.strictEqual(s.correr({}), 0, s.id + ' sin saldo tiene que dar 0');
    }
  });

  it('CAREO · dan exactamente lo mismo que el código de antes (' + ANTES + '), caso por caso', () => {
    const antes = medir(ANTES);
    const ahora = medir(null);
    assert.strictEqual(antes.sitios.length, 4, 'el medidor no ve los cuatro sitios de antes');
    assert.ok(antes.sitios.every((s) => !/saldoDe/.test(s.expr)), 'el commit de antes no debería usar la pieza');
    const c = carear(antes, ahora, CASOS);
    assert.strictEqual(c.comparaciones, CASOS.length * 4);
    assert.ok(!c.sitiosDistintos);
    assert.deepStrictEqual(c.diferencias, [], 'el saldo cambió: ' + JSON.stringify(c.diferencias.slice(0, 3)));
  });

  it('en guajirago/src nadie más lee `.creditos` a mano', () => {
    const { aMano } = medir(null);
    // App.js: `r.data.creditos` es la RESPUESTA del servidor al regalo de bienvenida, no la ficha.
    assert.deepStrictEqual(aMano, { 'guajirago/src/App.js': 1 },
      'cambió quién escribe `.creditos` a mano. Si enseña el saldo de la ficha, usa saldoDe; si es otra cosa, súmalo aquí diciendo por qué.');
  });

  for (const ruta of ['guajirago/src/AppConductor.js', 'guajirago/src/Creditos.js']) {
    it(ruta + ' importa saldoDe de ./saldoUsuario', () => {
      assert.match(soloCodigo(leer(ruta)), /import \{ saldoDe \} from '\.\/saldoUsuario';/);
    });
  }

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    it('si la pieza cambia la cuenta, el careo lo ve', () => {
      const rota = leer(PIEZA).replace('return (ficha && ficha.creditos) || 0;', 'return Number((ficha && ficha.creditos) || 0);');
      assert.notStrictEqual(rota, leer(PIEZA));
      const c = carear(medir(ANTES), medir(null, { [PIEZA]: rota }), CASOS);
      assert.ok(c.diferencias.length > 0, 'una pieza que convierte a número no cambia nada según el careo');
    });

    it('si un sitio vuelve a la cuenta a mano, se nota', () => {
      const ruta = 'guajirago/src/Creditos.js';
      const rota = leer(ruta).replace('setSaldo(saldoDe(snap.data()));', 'setSaldo(snap.data().creditos || 0);');
      assert.notStrictEqual(rota, leer(ruta));
      const m = medir(null, { [ruta]: rota });
      assert.strictEqual(m.aMano[ruta], 1);
      assert.ok(m.sitios.some((s) => !/saldoDe/.test(s.expr)));
    });

    it('si aparece una lectura más de la ficha sin medir, se nota', () => {
      const ruta = 'guajirago/src/AppConductor.js';
      const rota = leer(ruta).replace('setSaldoCreditos(saldoDe(snap.data()));', 'setSaldoCreditos(saldoDe(snap.data())); setSaldoCreditos(snap.data().creditos);');
      const m = medir(null, { [ruta]: rota });
      assert.ok(m.problemas.length > 0, 'una lectura de más no la cuenta nadie');
    });
  });
});
