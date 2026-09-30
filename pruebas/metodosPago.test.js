/**
 * G85 · LOS MÉTODOS DE PAGO DE UN PEDIDO SALEN DE UNA PIEZA (30-sep-2026)
 *
 * La lista «Efectivo, Nequi, Daviplata, Tarjeta» la ofrecen la app del cliente al pedir (guajirago/src/Restaurantes.js)
 * y aliados al cerrar el domicilio (PedidosDomicilio.js) y la mesa (Mesero.js), y la cuenta el corte de caja
 * (CorteCaja.js). Estaba escrita a mano SIETE veces (una en la app, una en flujoPedidos.js y cinco dentro de Mesero.js).
 * Ahora vive en guajirago/src/estadosPedido.js, con una copia letra por letra en guajirago-aliados/src/flujoPedidos.js
 * (otro repo, no puede importarla), y todos la importan.
 *
 *   1. Los dos bloques son IGUALES y la pieza se EJECUTA: da los nombres que ya guardan los pedidos de producción.
 *   2. Cada sitio se lee de su archivo y se CARGA la lista que de verdad usa (scripts/medir-metodos-pago.cjs): los
 *      cuatro usan la pieza, y nadie en las tres apps escribe la lista a mano.
 *   3. CAREO con el código de antes (a7df44a / d804688 / 0f89437): ningún sitio ofrece algo distinto.
 *   4. El contador de lo guardado separa lo que está en la lista, el «Mixto» y lo que quedaría sin nombre.
 *   5. Pantallas de mentira: si la copia se separa, o alguien vuelve a escribir la lista a mano, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, copiaIdentica } = require('./cargar.cjs');
const { medir, carear, contarGuardados, bloque, ANTES, PIEZA_APP, PIEZA_ALIADOS, SITIOS } = require('../scripts/medir-metodos-pago.cjs');

// Los nombres que YA están guardados en los pedidos (metodoPago y pagos[].metodo): cambiarlos deja los viejos en
// «Sin especificar» del corte de caja. Medido en producción el 30-sep-2026: Efectivo 19+1, Nequi 4, ninguno fuera.
const GUARDADOS = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];
const MESERO = 'guajirago-aliados/src/Mesero.js';
const RESTAURANTES = 'guajirago/src/Restaurantes.js';

describe('G85 · los métodos de pago de un pedido salen de UNA pieza', () => {
  it('el bloque de la pieza es IGUAL en la app (estadosPedido.js) y en aliados (flujoPedidos.js)', () => {
    const app = bloque(leer(PIEZA_APP));
    assert.ok(app, 'no encuentro el bloque de METODOS_PAGO en ' + PIEZA_APP);
    copiaIdentica({ nombre: 'el bloque de ' + PIEZA_ALIADOS, texto: bloque(leer(PIEZA_ALIADOS)) }, { nombre: 'el bloque de ' + PIEZA_APP, texto: app },
      'la copia de aliados se separó de ' + PIEZA_APP);
  });

  it('la pieza, ejecutada, da los nombres que guardan los pedidos (en la app y en aliados)', () => {
    for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
      assert.deepStrictEqual(cargarDeLaApp(ruta).METODOS_PAGO, GUARDADOS, ruta);
    }
  });

  it('los cuatro sitios usan la pieza, y nadie en las tres apps escribe la lista a mano', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(m.aMano.map((l) => l.archivo + ':' + l.renglon), [], 'lista de métodos escrita a mano (usa METODOS_PAGO)');
    assert.ok(m.copiasIguales, 'las dos copias de la pieza no son iguales');
    assert.deepStrictEqual(Object.keys(m.sitios), SITIOS.map((s) => s.nombre));
    for (const [n, s] of Object.entries(m.sitios)) {
      const pieza = s.archivo.startsWith('guajirago-aliados/') ? PIEZA_ALIADOS : PIEZA_APP;
      assert.strictEqual(s.origen, pieza, n + ' no saca la lista de ' + pieza);
      assert.deepStrictEqual(s.listas, [GUARDADOS], n + ' ofrece otra cosa');
    }
    // Mesero la usa en sus cinco sitios (cobrar junta, recibo, suma, montos y cobrar por comensal).
    assert.strictEqual(m.sitios['ALIADOS · cerrar la mesa'].usosDeLaPieza, 5, 'Mesero.js ya no usa la pieza en sus cinco sitios');
    assert.deepStrictEqual(m.listasDistintas, [GUARDADOS]);
    assert.deepStrictEqual(m.panel, [], 'el panel nombra métodos de pago de un pedido: hay que atarlo');
  });

  it('CAREO · con el código de antes (' + Object.values(ANTES).join(' / ') + ') ningún sitio ofrece algo distinto', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.strictEqual(antes.aMano.length, 7, 'el medidor ya no ve las siete listas a mano de antes');
    assert.ok(!antes.copiasIguales, 'antes no había pieza en la app');
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparaciones, 4);
    assert.deepStrictEqual(c.diferencias, [], 'un sitio ofrece otros métodos que antes');
  });

  it('lo guardado: en la lista, «Mixto» (resumen) y lo que quedaría sin nombre se cuentan aparte', () => {
    const r = contarGuardados([
      { tipo: 'domicilio', estado: 'cerrado', metodoPago: 'Nequi' },
      { tipo: 'local', estado: 'cerrado', metodoPago: 'Mixto', pagos: [{ metodo: 'Efectivo', monto: 1 }, { metodo: 'Tarjeta', monto: 2 }] },
      { tipo: 'local', estado: 'cerrado', metodoPago: 'Mixto' },
      { tipo: 'domicilio', estado: 'cerrado', metodoPago: 'efectivo' },
      { estado: 'cerrado' },
      { tipo: 'domicilio', estado: 'nuevo' },
    ], GUARDADOS);
    assert.deepStrictEqual(r.fuera.map((f) => f.valor), ['efectivo']);
    assert.strictEqual(r.mixtoSinDetalle, 1);
    const clase = Object.fromEntries(r.filas.map((f) => [f.campo + ' · ' + f.valor, f.clase]));
    assert.strictEqual(clase['metodoPago · Nequi'], 'en la lista');
    assert.strictEqual(clase['metodoPago · Mixto'], 'resumen (Mixto)');
    assert.strictEqual(clase['metodoPago · (sin método)'], 'sin método');
    assert.strictEqual(clase['pagos[].metodo · Tarjeta'], 'en la lista');
    assert.strictEqual(r.filas.length, 6, 'el pedido «nuevo» sin método no cuenta');
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    const L = "export const METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];";

    it('si la copia de aliados se separa, se nota', () => {
      const rota = leer(PIEZA_ALIADOS).replace(L, "export const METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta', 'Bancolombia'];");
      assert.notStrictEqual(rota, leer(PIEZA_ALIADOS));
      const m = medir(null, { [PIEZA_ALIADOS]: rota });
      assert.ok(!m.copiasIguales, 'la copia separada sigue saliendo igual');
      assert.strictEqual(m.listasDistintas.length, 2, 'la app y aliados ofrecen distinto y el medidor no lo ve');
    });

    it('si Mesero vuelve a escribir la lista a mano, se nota (aunque sea igual)', () => {
      const t = leer(MESERO);
      const rota = t.replace('{METODOS_PAGO.map(m => (', "{['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'].map(m => (");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [MESERO]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [MESERO]);
      assert.strictEqual(m.sitios['ALIADOS · cerrar la mesa'].usosDeLaPieza, 4);
    });

    it('si Mesero cobra con una lista a mano distinta, se nota', () => {
      const t = leer(MESERO);
      const rota = t.replace('{METODOS_PAGO.map(m => (', "{['Efectivo', 'Nequi', 'Daviplata'].map(m => (");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [MESERO]: rota });
      assert.strictEqual(m.sitios['ALIADOS · cerrar la mesa'].listas.length, 2, 'Mesero con dos listas no se nota');
      assert.strictEqual(m.listasDistintas.length, 2);
    });

    it('si la app vuelve a su lista propia, se nota', () => {
      const t = leer(RESTAURANTES);
      const rota = t.replace(', METODOS_PAGO } from \'./estadosPedido\';', " } from './estadosPedido';\nconst METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [RESTAURANTES]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [RESTAURANTES]);
      assert.strictEqual(m.sitios['APP · al pedir'].origen, 'a mano');
    });

    it('si un sitio importa METODOS_PAGO de un archivo que no la tiene, se nota', () => {
      const t = leer(PIEZA_APP);
      const rota = t.replace(L, "export const METODOS_PAGO_X = ['Efectivo'];");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PIEZA_APP]: rota });
      assert.ok(m.problemas.some((p) => /APP · al pedir: importa METODOS_PAGO/.test(p)), m.problemas.join(' · '));
    });
  });
});
