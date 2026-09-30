/**
 * G87 · LOS DÍAS DE LA PROMOCIÓN («Lun, Mié, Vie» y los botones L M M J V S D) SALEN DE UNA PIEZA (30-sep-2026)
 *
 * Una promoción de restaurante «por días» guarda en `dias` los números de `Date.getDay()` (0 = domingo … 6 = sábado).
 * Ese contrato lo usan la tarjeta de la promo en la app del cliente (guajirago/src/Restaurantes.js, vigenciaTxt), y la
 * lista de promos y los botones de días de aliados (guajirago-aliados/src/Promociones.js, progTxt y el selector).
 * Estaba escrito a mano TRES veces (dos DOW_TXT y la lista de letras). Ahora vive en guajirago/src/diasSemana.js, con
 * una copia IDÉNTICA en guajirago-aliados/src/diasSemana.js (otro repo, no puede importarla).
 *
 *   1. Las dos copias son IGUALES y la pieza se EJECUTA: qué número es cada día, su nombre y su letra.
 *   2. Cada sitio se saca de su archivo y se CORRE (scripts/medir-dias-promocion.cjs): dicen lo mismo en todos los
 *      casos, los botones cuadran con los nombres, y nadie en las tres apps escribe los días a mano.
 *   3. CAREO con el código de antes (d1cbe51 / 3673808 / 0f89437): ningún sitio dice algo distinto.
 *   4. El contador de lo guardado separa los días buenos de los raros.
 *   5. Pantallas de mentira: si la copia se separa, o alguien vuelve a escribir los días a mano, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const { medir, carear, contarGuardados, ANTES, PIEZA_APP, PIEZA_ALIADOS, RESTAURANTES, PROMOCIONES, CASOS } = require('../scripts/medir-dias-promocion.cjs');

// Lo que se GUARDA en `dias` (el número de Date.getDay()) y cómo se dice. Cambiar un número cambia de día las promos
// ya guardadas. Medido en producción el 30-sep-2026: 3 negocios, 0 promociones, así que hoy nadie cambia de día.
const SEMANA = [[1, 'Lun', 'L'], [2, 'Mar', 'M'], [3, 'Mié', 'M'], [4, 'Jue', 'J'], [5, 'Vie', 'V'], [6, 'Sáb', 'S'], [0, 'Dom', 'D']];
const TEXTOS = ['APP · la tarjeta de la promo', 'ALIADOS · la lista de promos'];
const SELECTOR = 'ALIADOS · el selector de días';

describe('G87 · los días de la promoción salen de UNA pieza', () => {
  it('las dos copias de la pieza son IDÉNTICAS (app y aliados)', () => {
    assert.strictEqual(leer(PIEZA_ALIADOS).replace(/\r\n/g, '\n'), leer(PIEZA_APP).replace(/\r\n/g, '\n'), 'la copia de aliados se separó de ' + PIEZA_APP);
  });

  it('la pieza, ejecutada, da cada día con su número, su nombre y su letra (en la app y en aliados)', () => {
    for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
      const p = cargarDeLaApp(ruta);
      assert.deepStrictEqual(p.DIAS_SEMANA.map((x) => [x.dia, x.corto, x.letra]), SEMANA, ruta);
      assert.strictEqual(p.diasTxt([3, 1, 5]), 'Lun, Mié, Vie', ruta);
      assert.strictEqual(p.diasTxt([5, 6, 0]), 'Dom, Vie, Sáb', ruta);
      assert.strictEqual(p.diasTxt(['2']), 'Mar', ruta);
      assert.strictEqual(p.diasTxt([7]), '', ruta + ' nombra un día que no existe');
      assert.strictEqual(p.diasTxt(undefined), '', ruta);
    }
  });

  it('los tres sitios usan la pieza, corridos dicen lo MISMO, y nadie escribe los días a mano', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(m.aMano.map((l) => l.archivo + ':' + l.renglon), [], 'días de la semana escritos a mano (usa diasSemana.js)');
    assert.ok(m.copiasIguales, 'las dos copias de la pieza no son iguales');
    assert.deepStrictEqual(Object.keys(m.sitios), [...TEXTOS, SELECTOR]);
    assert.strictEqual(m.sitios[TEXTOS[0]].origen, PIEZA_APP);
    assert.strictEqual(m.sitios[TEXTOS[1]].origen, PIEZA_ALIADOS);
    assert.strictEqual(m.sitios[SELECTOR].origen, PIEZA_ALIADOS);
    assert.deepStrictEqual(m.sitios[SELECTOR].botones, SEMANA.map(([d, , l]) => d + '=' + l), 'el selector ofrece otros botones');
    assert.ok(m.selectorBien, 'los botones del selector no cuadran con los nombres');
    assert.deepStrictEqual(m.distintos.map((x) => x.caso), [], 'los sitios dicen cosas distintas');
    for (const s of TEXTOS) assert.deepStrictEqual(m.sitios[s].dice.slice(0, 3), ['Lun', 'Dom', 'Sáb'], s);
    assert.strictEqual(m.porCaso.length, CASOS.length);
  });

  it('CAREO · con el código de antes (' + Object.values(ANTES).join(' / ') + ') ningún sitio dice algo distinto', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.deepStrictEqual(antes.aMano.map((l) => l.archivo), [RESTAURANTES, PROMOCIONES, PROMOCIONES], 'el medidor ya no ve los tres días a mano de antes');
    assert.ok(!antes.copiasIguales, 'antes no había pieza');
    assert.deepStrictEqual(Object.values(antes.sitios).map((s) => s.origen), ['a mano', 'a mano', 'a mano']);
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparaciones, CASOS.length * 2 + 1);
    assert.deepStrictEqual(c.diferencias, [], 'un sitio dice otra cosa que antes');
  });

  it('lo guardado: los días buenos y los raros se cuentan aparte', () => {
    const p = cargarDeLaApp(PIEZA_APP);
    const r = contarGuardados(
      [{ promociones: [{ programacion: 'dias', dias: [1, 3], activa: true }, { programacion: 'dias', dias: [7] }, { programacion: 'rango' }, {}] }, { promociones: [] }, {}],
      p.diasTxt,
    );
    assert.strictEqual(r.negocios, 3);
    assert.strictEqual(r.conPromos, 1);
    assert.deepStrictEqual(r.porProgramacion, { dias: 2, rango: 1, '(sin campo)': 1 });
    assert.deepStrictEqual(r.raros, ['[7]']);
    const fila = r.porDias.find((f) => f.dias === '[1,3]');
    assert.strictEqual(fila.dice, 'Lun, Mié');
    assert.strictEqual(fila.activas, 1);
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    it('si la copia de aliados se separa, se nota', () => {
      const t = leer(PIEZA_ALIADOS).replace(/\r\n/g, '\n');
      const rota = t.replace("corto: 'Mié'", "corto: 'Mie'");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PIEZA_ALIADOS]: rota });
      assert.ok(!m.copiasIguales, 'la copia separada sigue saliendo igual');
      assert.ok(m.distintos.length > 0, 'la app y aliados dicen distinto y el medidor no lo ve');
    });

    it('si la app vuelve a su mapa propio, se nota (aunque diga lo mismo)', () => {
      const t = leer(RESTAURANTES);
      const rota = t.replace("import { diasTxt } from './diasSemana';",
        "const DOW_TXT = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };\nconst diasTxt = (dias) => [...dias].sort().map((d) => DOW_TXT[d]).join(', ');");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [RESTAURANTES]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [RESTAURANTES]);
    });

    it('si aliados vuelve a escribir los botones a mano (y uno queda mal), se nota', () => {
      const t = leer(PROMOCIONES);
      const rota = t.replace('{DIAS_SEMANA.map(({ dia: d, letra: t }) => {',
        "{[[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'L']].map(([d, t]) => {");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PROMOCIONES]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [PROMOCIONES]);
      assert.ok(!m.selectorBien, 'el botón «L» que guarda el domingo no se nota');
    });

    it('si aliados dice los días con su propia cuenta y distinta, se nota', () => {
      const t = leer(PROMOCIONES);
      const rota = t.replace("return '📅 ' + diasTxt(p.dias);", "return '📅 ' + p.dias.join(', ');");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PROMOCIONES]: rota });
      assert.ok(m.distintos.length > 0, 'una cuenta propia en aliados no se nota');
    });

    it('si un sitio importa de la pieza algo que no está, se nota', () => {
      const t = leer(PIEZA_APP);
      const rota = t.replace('export function diasTxt(dias)', 'export function diasTexto(dias)');
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PIEZA_APP]: rota });
      assert.ok(m.problemas.some((p) => /Restaurantes\.js: importa diasTxt/.test(p)), m.problemas.join(' · '));
    });
  });
});
