/**
 * P12 · UN DATO DEL CLIENTE YA NO HACE REVENTAR LA REVISIÓN DEL PRECIO DEL PEDIDO (30-sep-2026)
 *
 * El pendiente (hijo de P11): la revisión (ponerElPrecioDelServidor, guajirago/functions/precioPedido.cjs) armaba la
 * ruta del contador de una promoción con el TELÉFONO tal cual lo mandó el cliente; un «/» la rompía, la revisión
 * reventaba y el pedido se quedaba con los precios del teléfono, «sin revisar». Y no era lo único: un promoId con «/»
 * o de miles de letras, miles de líneas o de adiciones inventadas, también la hacían reventar.
 *
 * Esta prueba EJECUTA la pieza (la del disco y la de antes, 31e5291) con la base ESTRICTA del medidor
 * (scripts/medir-revision-venenosa.cjs), que se porta como Firestore en rutas, nombres y tamaño del documento:
 *   · los venenosos quedan REVISADOS, con el precio del menú (lo dice cada fila), y ninguno revienta;
 *   · los honrados salen IGUALES que con el código de antes (careo);
 *   · el código de antes revienta en 7 (así se sabe que la base estricta muerde);
 *   · el teléfono se cuenta en sus 10 cifras (la regla única de telefonoValido.cjs).
 * El camino entero con el Firestore de verdad lo prueba pruebas/funciones.test.js (bloque P12), y la puerta de las
 * reglas (el teléfono nace en 10 cifras), pruebas/reglas.test.js.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../scripts/medir-revision-venenosa.cjs');
const P = require('../guajirago/functions/precioPedido.cjs');

const ANTES = '31e5291';

// Lo que tiene que quedar de cada venenoso: el subtotal con el precio del MENÚ y los contadores que se escriben.
const ESPERADO = {
  'teléfono «300/111/2233» y la promoción del 20%': { subtotal: 18000, contadores: [] },
  'teléfono «300/1112233» (una sola barra) y la promoción del 20%': { subtotal: 18000, contadores: [] },
  'teléfono «a/b/c» (la ruta sigue «valiendo») y la promoción del 20%': { subtotal: 18000, contadores: [] },
  'el MISMO teléfono escrito «+57 300 111 2233», con la del 20% ya usada': { subtotal: 18000, contadores: [] },
  'teléfono escrito «+57 300 111 2233», primera vez con la del 20%': { subtotal: 14400, contadores: ['usosPromo/pct__3001112233=1'] },
  'teléfono «..» y la promoción de $1.000 menos': { subtotal: 17000, contadores: [] },
  'promoción inventada «a/b»': { subtotal: 18000, contadores: [] },
  'promoción inventada «/x»': { subtotal: 18000, contadores: [] },
  'promoción inventada de 2.000 letras': { subtotal: 18000, contadores: [] },
  '3.000 promociones inventadas distintas (una por línea)': { subtotal: 100 * 18000, contadores: [] },
  '300 líneas con una promoción inventada de 3.000 letras': { subtotal: 100 * 18000, contadores: [] },
  'cantidad 1e300': { subtotal: 0, contadores: [] },
  'cantidad «2» (texto) y cantidad 2,5': { subtotal: 0, contadores: [] },
  '30.000 adiciones inventadas en una línea': { subtotal: 18000, contadores: [] },
  '20.000 líneas de un plato que no existe': { subtotal: 0, contadores: [] },
  'la promoción como mapa y el plato como lista': { subtotal: 18000, contadores: [] },
};

describe('P12 · la revisión del precio no revienta por un dato del cliente', () => {
  it('cada caso venenoso tiene su fila de lo esperado (y no sobra ninguna)', () => {
    const venenosos = M.CASOS.filter((c) => !c.honrado).map((c) => c.nombre);
    assert.deepStrictEqual(venenosos.slice().sort(), Object.keys(ESPERADO).sort());
  });

  it('HOY: ningún caso revienta; los venenosos quedan revisados, con el precio del menú', async () => {
    const filas = await M.medirCodigo(null);
    for (const f of filas) {
      assert.strictEqual(f.revienta, false, f.nombre + ' revienta: ' + f.motivo);
      assert.strictEqual(f.estado, P.REVISION_HECHA, f.nombre + ': ' + f.estado);
      assert.ok(f.problemas <= P.MAX_PROBLEMAS, f.nombre + ': ' + f.problemas + ' problemas guardados');
      if (f.honrado) continue;
      const e = ESPERADO[f.nombre];
      assert.strictEqual(f.subtotal, e.subtotal, f.nombre + ': subtotal');
      assert.strictEqual(f.total, e.subtotal + 4000, f.nombre + ': total');
      assert.deepStrictEqual(f.contadores, e.contadores, f.nombre + ': contadores');
    }
  });

  it('CAREO: los honrados salen IGUALES que con el código de antes; y el de antes revienta en 7 venenosos', async () => {
    const antes = await M.medirCodigo(ANTES);
    const ahora = await M.medirCodigo(null);
    for (let i = 0; i < M.CASOS.length; i++) {
      if (!M.CASOS[i].honrado) continue;
      assert.strictEqual(M.huella(ahora[i]), M.huella(antes[i]), 'el honrado «' + M.CASOS[i].nombre + '» cambió');
    }
    const revientan = antes.filter((f) => !f.honrado && f.revienta).map((f) => f.nombre);
    assert.strictEqual(revientan.length, 7, 'con el código de antes revientan: ' + revientan.join(' | '));
  });

  it('los problemas guardados tienen tope, y se dice cuántos más hubo', async () => {
    const caso = M.CASOS.find((c) => c.nombre.startsWith('20.000 líneas'));
    const r = P.pedidoConPreciosDelMenu(M.NEGOCIO(), caso.pedido.items, () => 0, M.AHORA);
    assert.strictEqual(r.items.length, P.MAX_LINEAS);
    assert.strictEqual(r.problemas.length, P.MAX_PROBLEMAS);
    assert.deepStrictEqual(r.problemas[0], { codigo: 'demasiadas-lineas', lineas: 20000 });
    assert.strictEqual(r.problemasDeMas, 1 + P.MAX_LINEAS * 2 - P.MAX_PROBLEMAS);
    // Y un pedido normal no lleva la cuenta de más.
    const n = P.pedidoConPreciosDelMenu(M.NEGOCIO(), M.PEDIDO().items, () => 0, M.AHORA);
    assert.ok(!('problemasDeMas' in n));
    // El texto del cliente que se guarda en un problema va recortado.
    const largo = P.pedidoConPreciosDelMenu(M.NEGOCIO(), [{ id: 'p1', cantidad: 1, promoId: 'z'.repeat(5000), adiciones: [{ nombre: 'w'.repeat(5000) }] }], () => 0, M.AHORA);
    assert.strictEqual(largo.problemas.find((p) => p.codigo === 'promocion-no-vale').promoId.length, 200);
    assert.strictEqual(largo.items[0].adiciones[0].nombre.length, 200);
    // Más de MAX_ADICIONES: entran las primeras, y queda dicho.
    const muchas = P.pedidoConPreciosDelMenu(M.NEGOCIO(), [{ id: 'p1', cantidad: 1, adiciones: Array.from({ length: 40 }, () => ({ nombre: 'Queso' })) }], () => 0, M.AHORA);
    assert.strictEqual(muchas.items[0].adiciones.length, P.MAX_ADICIONES);
    assert.strictEqual(muchas.subtotal, 18000 + P.MAX_ADICIONES * 2000);
    assert.deepStrictEqual(muchas.problemas, [{ linea: 0, codigo: 'demasiadas-adiciones', adiciones: 40 }]);
    // La cantidad: de 1 a CANTIDAD_MAXIMA.
    const cant = (c) => P.pedidoConPreciosDelMenu(M.NEGOCIO(), [{ id: 'p1', cantidad: c }], () => 0, M.AHORA).subtotal;
    assert.strictEqual(cant(P.CANTIDAD_MAXIMA), P.CANTIDAD_MAXIMA * 18000);
    assert.strictEqual(cant(P.CANTIDAD_MAXIMA + 1), 0);
  });

  it('el nombre del contador: la promo y las 10 cifras, o nada', () => {
    assert.strictEqual(P.idDelContador('promo_1', '3001112233'), 'promo_1__3001112233');
    assert.strictEqual(P.idDelContador(17, '3001112233'), '17__3001112233');
    for (const [promo, tel] of [['promo_1', '300/1112233'], ['promo_1', '+57 300 111 2233'], ['promo_1', ''], ['a/b', '3001112233'],
      ['', '3001112233'], ['x'.repeat(201), '3001112233'], [{ a: 1 }, '3001112233'], [NaN, '3001112233'], ['promo_1', 3001112233]]) {
      assert.strictEqual(P.idDelContador(promo, tel), '', JSON.stringify([promo, tel]));
    }
    for (const malo of ['a/b', '.', '..', '__x__', '', 'x'.repeat(1501), null, {}, Infinity]) assert.strictEqual(P.nombreDeDocumento(malo), '', String(malo).slice(0, 20));
    assert.strictEqual(P.nombreDeDocumento('R1'), 'R1');
  });

  it('el negocio con un id que no puede ser nombre de documento queda «sin negocio», sin reventar', async () => {
    for (const id of ['a/b', '..', '__x__']) {
      const { db } = M.baseEstricta({ 'pedidos/ped1': M.PEDIDO({ restauranteId: id }) });
      const p = await P.ponerElPrecioDelServidor(db, 'ped1', 'ev1', M.AHORA);
      assert.strictEqual(p.revisionServidor.motivo, 'sin-negocio', id);
    }
  });

  it('la base estricta del medidor muerde (si no, «no revienta» no diría nada)', async () => {
    const { db } = M.baseEstricta({ 'x/1': { a: 1 } });
    assert.throws(() => db.collection('usosPromo').doc('a/b'), /impar/);
    assert.throws(() => db.collection('usosPromo').doc('/x'), /vacío/);
    await assert.rejects(db.runTransaction(async (tx) => tx.get(db.collection('u').doc('y'.repeat(1501)))), /1\.500/);
    await assert.rejects(db.runTransaction(async (tx) => tx.get(db.collection('u').doc('__x__'))), /no permitido/);
    await assert.rejects(db.runTransaction(async (tx) => tx.update(db.collection('x').doc('1'), { b: 'z'.repeat(1048576) })), /bytes/);
    assert.strictEqual(M.tamano({ ab: 'xyz', n: 1, l: [true, null] }), 3 + 4 + 2 + 8 + 2 + 2);
  });
});
