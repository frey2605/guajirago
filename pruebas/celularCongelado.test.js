/**
 * P07 · EL CELULAR DEL REGISTRO NO SE LO CAMBIA NADIE DESDE SU TELÉFONO (30-sep-2026)
 *
 * `usuarios/{uid}.celular` es el número con que la persona se registró. El servidor lo usa para dar el regalo de
 * bienvenida una vez por número (P06). Hasta P07 el dueño de la ficha podía cambiarlo y ponerse el número de otra
 * persona, que ya no podía registrarse («ocupado»). Ahora `firestore.rules` lo congela (`camposCongelados`) y al crear
 * la ficha pide la forma de 10 cifras limpias (`celularDelRegistro`). El panel sí puede corregirlo.
 *
 *   1. La forma que piden las reglas es EXACTAMENTE «lo que devuelve celularDiezCifras» (la regla única de G42):
 *      se ejecutan las dos con los mismos textos y tienen que decir lo mismo.
 *   2. El MEDIDOR (scripts/medir-celular-congelado.cjs) no se ablanda: con reglas de mentira se queja.
 *   3. Las escrituras de verdad, persona por persona, en el EMULADOR: con las reglas de ahora dan lo esperado, y en
 *      el CAREO con las de antes (fc41fb1) las que hace la app dan lo MISMO y solo cambian los trucos.
 *
 * Quién escribe `celular` en el código de las tres apps lo vigila pruebas/telefonoFicha.test.js (G08).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, elEmulador } = require('./cargar.cjs');
const M = require('../scripts/medir-celular-congelado.cjs');

const REGLAS = leer('firestore.rules');
const { celularDiezCifras } = cargarDeLaApp('guajirago/src/telefonoValido.js');
const ANTES = 'fc41fb1';

describe('P07 · la forma del celular en las reglas es la de celularDiezCifras', () => {
  const forma = M.formaDelCelular(REGLAS);
  it('las reglas piden una forma al crear la ficha', () => {
    assert.ok(forma, 'no encuentro `celularDelRegistro()` con su `.celular.matches(...)` en el bloque de usuarios');
    assert.ok(M.altaPideLaForma(REGLAS), 'el `allow create` del dueño no llama a celularDelRegistro()');
  });
  // `matches` de las reglas exige que TODO el texto case: se ejecuta igual aquí.
  const textos = ['3001234567', '3009990000', '0000000000', '300 123 4567', '300-123-4567', '+573001234567',
    '573001234567', '300123456', '30012345678', '300123456a', 'abc', '', ' 3001234567', '3001234567 ', '(300)1234567'];
  for (const t of textos) {
    it('«' + t + '»: las reglas y celularDiezCifras dicen lo mismo', () => {
      const lasReglas = new RegExp('^(?:' + forma + ')$').test(t);
      // celularDiezCifras devuelve '' cuando el número NO sirve: el vacío no es una forma limpia.
      assert.strictEqual(lasReglas, celularDiezCifras(t) !== '' && celularDiezCifras(t) === t,
        'la forma de las reglas se separó de la regla única de G42 (guajirago/src/telefonoValido.js)');
    });
  }
});

describe('P07 · las reglas del repo congelan el celular', () => {
  it('celular está en camposCongelados y el update del dueño la mira', () => {
    const q = M.queDicenLasReglas(REGLAS);
    assert.deepStrictEqual(q, { celularCongelado: true, forma: q.forma, altaPideLaForma: true });
  });
});

describe('P07 · el medidor de las reglas no se ablanda (reglas de mentira)', () => {
  const quitar = (de, a) => { assert.ok(REGLAS.includes(de), 'el sabotaje no calza: ' + de); return REGLAS.replace(de, a); };
  it('sin celular en la lista → no congelado', () => {
    assert.strictEqual(M.queDicenLasReglas(quitar("return ['email', 'celular'];", "return ['email'];")).celularCongelado, false);
  });
  it('celular solo en un comentario de la lista → no congelado', () => {
    assert.strictEqual(M.queDicenLasReglas(quitar("return ['email', 'celular'];", "return ['email'] // 'celular'\n;")).celularCongelado, false);
  });
  it('la lista lo trae pero el update del dueño no la mira → no congelado', () => {
    const r = REGLAS.replace(/\.hasAny\(camposDePoder\(\)\.concat\(camposCongelados\(\)\)/, '.hasAny(camposDePoder()');
    assert.notStrictEqual(r, REGLAS, 'el sabotaje no calza');
    assert.strictEqual(M.queDicenLasReglas(r).celularCongelado, false);
  });
  it('la función existe pero el alta no la llama → no la pide', () => {
    const r = REGLAS.replace(/\n\s*&& celularDelRegistro\(\)/, '');
    assert.notStrictEqual(r, REGLAS, 'el sabotaje no calza');
    assert.strictEqual(M.altaPideLaForma(r), false);
  });
  it('llamada solo en un comentario del alta → no la pide', () => {
    const r = REGLAS.replace(/\n(\s*)&& celularDelRegistro\(\)/, '\n$1// && celularDelRegistro()');
    assert.strictEqual(M.altaPideLaForma(r), false);
  });
});

describe('P07 · las escrituras de verdad, en el emulador', () => {
  const puerto = elEmulador().firestore;
  it('con las reglas de AHORA, cada persona y cada escritura dan lo esperado', async () => {
    const ahora = await M.correrEscrituras(REGLAS, 'demo-p07-ahora', '127.0.0.1', puerto);
    const mal = M.ESCRITURAS.map(([q, que, , debe], i) => (ahora[i] === debe ? null : q + ' · ' + que + ': dio ' + ahora[i] + ', debía ' + debe)).filter(Boolean);
    assert.deepStrictEqual(mal, []);
  });
  it('CAREO con las de antes (' + ANTES + '): lo que hace la app da lo mismo; los trucos pasaban y ya no', async () => {
    const antes = await M.correrEscrituras(M.reglasDelCommit(ANTES), 'demo-p07-antes', '127.0.0.1', puerto);
    const ahora = await M.correrEscrituras(REGLAS, 'demo-p07-careo', '127.0.0.1', puerto);
    const appCambia = M.ESCRITURAS.filter((e, i) => e[4] && antes[i] !== ahora[i]).map((e) => e[1]);
    assert.deepStrictEqual(appCambia, [], 'una escritura que hace la app cambió de resultado');
    // El hueco existía: con las reglas de antes, el dueño se cambiaba el celular por el de otro.
    const i = M.ESCRITURAS.findIndex((e) => e[1] === 'se pone el celular de Luis');
    assert.ok(i >= 0);
    assert.deepStrictEqual([antes[i], ahora[i]], ['sí', 'no']);
    // Lo único que cambia es lo que se cerró a propósito: lo que antes pasaba y ahora debe dar «no».
    const cambian = M.ESCRITURAS.filter((e, k) => antes[k] !== ahora[k]);
    assert.ok(cambian.every((e) => e[3] === 'no'), 'cambió algo que debía seguir permitido');
  });
});
