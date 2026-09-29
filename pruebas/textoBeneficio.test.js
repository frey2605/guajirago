/**
 * G52 · EL BENEFICIO DE UNA PROMOCIÓN EN PALABRAS, Y SUS CATEGORÍAS — UNA SOLA FUENTE (29-sep-2026)
 *
 * Seis pantallas escribían el beneficio a mano («$ 8.000 de crédito» / «20% de descuento»), unas preguntando «¿es de
 * crédito?» y otras «¿es de descuento?»: con un tipo vacío o raro, la tarjeta de la app y la del panel decían
 * «$ 15 de crédito» mientras el cobro restaba un 15 %. Y la lista de categorías estaba en la app y en el panel.
 * Ahora las dos cosas viven en la regla única de promociones (guajirago/functions/promociones.cjs) y sus copias
 * atadas `reglaPromocion.js` (app, panel y aliados), y las pantallas las usan.
 *
 *   1. La pieza, en sus cuatro copias, dice lo mismo que el que COBRA (descuentos.cjs) con cada caso.
 *   2. Los seis sitios se SACAN de su archivo y se EJECUTAN (con scripts/medir-texto-beneficio.cjs): ninguno enseña
 *      algo distinto de lo que se cobra, y todos llaman a la pieza.
 *   3. El lector no se puede ablandar: con el código de antes (commits de antes de G52) tiene que quejarse.
 *   4. Nadie más escribe la lista de categorías ni elige el texto del beneficio con su propio «?».
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { cargarDeLaApp } = require('./cargar.cjs');
const M = require('../scripts/medir-texto-beneficio.cjs');

const RAIZ = path.resolve(__dirname, '..');
const NUBE = require('../guajirago/functions/promociones.cjs');
const { cop } = require('../guajirago/functions/moneda.cjs');
const COPIAS = {
  app: cargarDeLaApp('guajirago/src/reglaPromocion.js'),
  panel: cargarDeLaApp('guajirago-admin/src/reglaPromocion.js'),
  aliados: cargarDeLaApp('guajirago-aliados/src/reglaPromocion.js'),
};
const REGLAS = ['guajirago/functions/promociones.cjs', 'guajirago/src/reglaPromocion.js',
  'guajirago-admin/src/reglaPromocion.js', 'guajirago-aliados/src/reglaPromocion.js'];

describe('G52 · la pieza del beneficio', () => {
  it('dice lo que el cobro hace: crédito → pesos, cualquier otro → porcentaje', () => {
    assert.strictEqual(NUBE.textoDelBeneficio({ tipoBeneficio: 'credito', valorBeneficio: 8000 }), cop(8000) + ' de crédito');
    assert.strictEqual(NUBE.textoDelBeneficio({ tipoBeneficio: 'descuento', valorBeneficio: 20 }), '20% de descuento');
    assert.strictEqual(NUBE.textoDelBeneficio({ tipoBeneficio: '', valorBeneficio: 15 }), '15% de descuento');
    assert.strictEqual(NUBE.valorDelBeneficio({ tipoBeneficio: 'descuento' }), '0%');
    assert.strictEqual(NUBE.valorDelBeneficio({ tipoBeneficio: 'credito', valorBeneficio: 8000 }), cop(8000));
    assert.strictEqual(NUBE.valorDelBeneficio(null), '0%');
    for (const c of M.INVENTADOS) {
      const cobra = M.loQueCobra(c.b);
      assert.strictEqual(M.loQueDice(NUBE.valorDelBeneficio(c.b)), cobra, c.nombre);
      assert.strictEqual(M.loQueDice(NUBE.textoDelBeneficio(c.b)), cobra, c.nombre);
    }
  });

  it('las copias de la app, el panel y aliados dicen lo mismo que el servidor, ejecutándolas', () => {
    for (const [quien, C] of Object.entries(COPIAS)) {
      for (const c of M.INVENTADOS.concat([{ b: undefined }, { b: {} }])) {
        assert.strictEqual(C.valorDelBeneficio(c.b), NUBE.valorDelBeneficio(c.b), quien + ' ' + JSON.stringify(c.b));
        assert.strictEqual(C.textoDelBeneficio(c.b), NUBE.textoDelBeneficio(c.b), quien + ' ' + JSON.stringify(c.b));
      }
      assert.deepStrictEqual(C.CATEGORIAS_PROMOCION, NUBE.CATEGORIAS_PROMOCION, quien);
      for (const id of ['transporte', 'general', 'otra', undefined]) {
        assert.deepStrictEqual(C.categoriaDePromocion(id), NUBE.categoriaDePromocion(id), quien + ' ' + id);
      }
    }
    assert.deepStrictEqual(NUBE.categoriaDePromocion('otra'), { label: 'otra', icono: '🎁' });
  });
});

describe('G52 · los seis sitios, sacados de su archivo y ejecutados', () => {
  it('ninguno enseña algo distinto de lo que se cobra, y todos llaman a la pieza', () => {
    const filas = M.correrSitios(M.INVENTADOS);
    assert.strictEqual(filas.length, 6);
    for (const f of filas) {
      assert.ok(!f.error, f.sitio.nombre + ': ' + f.error);
      assert.deepStrictEqual(f.malos, [], f.sitio.nombre + ' enseña otra cosa que el cobro');
      assert.match(f.expr, /^(valorDelBeneficio|textoDelBeneficio)\(/, f.sitio.nombre + ' no usa la pieza: ' + f.expr);
      assert.match(f.expr, f.sitio.largo ? /^textoDelBeneficio\(/ : /^valorDelBeneficio\(/, f.sitio.nombre);
    }
  });

  it('las categorías: ninguna pantalla las escribe, y app y panel pintan lo mismo que la pieza', () => {
    const ids = ['transporte', 'domicilios', 'restaurantes', 'turismo', 'general', 'otra'];
    const cats = M.categorias(null, null, ids);
    const esperado = ids.map((id) => { const c = NUBE.categoriaDePromocion(id); return c.icono + ' ' + c.label; });
    for (const [ruta, c] of Object.entries(cats)) {
      assert.strictEqual(c.escritaAqui, false, ruta + ' vuelve a escribir su lista de categorías');
      assert.deepStrictEqual(c.etiquetas, esperado, ruta);
    }
    const panel = fs.readFileSync(path.join(RAIZ, 'guajirago-admin/src/Promociones.js'), 'utf8');
    assert.match(panel, /\{CATEGORIAS_PROMOCION\.map\(c => \(/, 'el formulario del panel no ofrece la lista de la pieza');
  });

  it('el lector no se ablanda: con el código de antes de G52 se queja', () => {
    const filas = M.correrSitios(M.INVENTADOS, '57047ae', 'f006b21');
    const malos = filas.filter((f) => !f.error && f.malos.length).map((f) => f.sitio.nombre);
    assert.deepStrictEqual(malos, ['app · Promociones · descuento pendiente', 'app · Promociones · tarjeta de la oferta',
      'app · Solicitar · «Tienes un descuento activo de…»', 'panel · Promociones · tarjeta']);
    const cats = M.categorias('57047ae', 'f006b21', ['transporte']);
    assert.deepStrictEqual(Object.values(cats).map((c) => c.escritaAqui), [true, true]);
  });
});

describe('G52 · nadie más lo escribe a mano', () => {
  it('en las tres apps y el servidor, solo la pieza escribe la lista o elige el texto con su «?»', () => {
    const culpables = [];
    const recorrer = (dir) => {
      for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
        const rel = dir + '/' + e.name;
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'build') recorrer(rel); continue; }
        if (!/\.(c?js)$/.test(e.name) || REGLAS.includes(rel)) continue;
        const t = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
        if (/id:\s*'transporte',\s*label:/.test(t)) culpables.push(rel + ' (lista de categorías)');
        if (/\.tipo(Beneficio)?\s*===\s*'(credito|descuento)'\s*\?/.test(t)) culpables.push(rel + ' (texto del beneficio)');
        if (/\bcategoriaInfo\b/.test(t)) culpables.push(rel + ' (categoriaInfo propia)');
      }
    };
    for (const d of ['guajirago/src', 'guajirago/functions', 'guajirago-admin/src', 'guajirago-aliados/src']) recorrer(d);
    assert.deepStrictEqual(culpables, []);
  });
});
