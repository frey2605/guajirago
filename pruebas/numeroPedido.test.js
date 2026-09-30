/**
 * G94 · EL NÚMERO «PEDIDO #ABCDE» SALE DE UNA PIEZA (30-sep-2026)
 *
 * El número corto de un pedido (las 5 últimas letras del id, en mayúsculas) lo enseñan la app del cliente
 * (guajirago/src/Restaurantes.js, 3 sitios) y aliados (HistorialDomicilios.js, 1; PedidosDomicilio.js, 5: recibo,
 * comanda, tarjeta, WhatsApp y chat). Estaba armado a mano en los NUEVE. Ahora lo arma numeroDelPedido, en
 * guajirago/src/estadosPedido.js, con copia letra por letra en guajirago-aliados/src/flujoPedidos.js (otro repo).
 *
 *   1. Los dos bloques son IGUALES y la pieza se EJECUTA.
 *   2. Cada uno de los 9 sitios se saca de su archivo y se EJECUTA con la pieza que importa (scripts/medir-numero-pedido.cjs):
 *      los 9 usan la pieza, nadie arma el número a mano en las tres apps ni en el servidor, y todos dan el mismo.
 *   3. CAREO con el código de antes (ee4a572 / 53f39a9): mismo número en cada sitio y el mismo texto alrededor.
 *   4. Pantallas de mentira: si la copia se separa o alguien vuelve a armarlo a mano, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, copiaIdentica } = require('./cargar.cjs');
const { medir, carear, bloque, ANTES, PIEZA_APP, PIEZA_ALIADOS, SITIOS, IDS_DE_MENTIRA } = require('../scripts/medir-numero-pedido.cjs');

const RESTAURANTES = 'guajirago/src/Restaurantes.js';
const DOMICILIO = 'guajirago-aliados/src/PedidosDomicilio.js';
// Ids con la forma de los de producción (20 letras de Firestore) y bordes.
const IDS = [...IDS_DE_MENTIRA, '44L9cUcmCEDfFihAuN75', '4cWdkuMj1Fciqbtg2Qd6'];

describe('G94 · el número del pedido sale de UNA pieza', () => {
  it('el bloque de la pieza es IGUAL en la app (estadosPedido.js) y en aliados (flujoPedidos.js)', () => {
    const app = bloque(leer(PIEZA_APP));
    assert.ok(app, 'no encuentro el bloque de numeroDelPedido en ' + PIEZA_APP);
    copiaIdentica({ nombre: 'el bloque de ' + PIEZA_ALIADOS, texto: bloque(leer(PIEZA_ALIADOS)) }, { nombre: 'el bloque de ' + PIEZA_APP, texto: app },
      'la copia de aliados se separó de ' + PIEZA_APP);
  });

  it('la pieza, ejecutada: las 5 últimas letras en mayúsculas; sin id, vacío (en la app y en aliados)', () => {
    for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
      const { numeroDelPedido: n } = cargarDeLaApp(ruta);
      assert.strictEqual(n('44L9cUcmCEDfFihAuN75'), 'AUN75', ruta);
      assert.strictEqual(n('4uQvzdIsR7oDV9ISllcc'), 'SLLCC', ruta);
      assert.strictEqual(n('ab'), 'AB', ruta);
      assert.strictEqual(n(''), '', ruta);
      assert.strictEqual(n(undefined), '', ruta);
      assert.strictEqual(n(null), '', ruta);
    }
  });

  it('los 9 sitios usan la pieza, nadie arma el número a mano (tres apps y servidor) y todos dan el mismo', () => {
    const m = medir(null, IDS);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(m.aMano.map((l) => l.archivo + ':' + l.renglon), [], 'número armado a mano (usa numeroDelPedido)');
    assert.ok(m.copiasIguales, 'las dos copias de la pieza no son iguales');
    assert.strictEqual(m.sitios.length, SITIOS.reduce((s, x) => s + x.cuantos, 0));
    assert.strictEqual(m.sitios.length, 9);
    for (const s of m.sitios) {
      assert.strictEqual(s.forma, 'pieza', s.archivo + ':' + s.renglon + ' no usa la pieza');
      assert.deepStrictEqual(s.numeros, IDS.map((id) => id.slice(-5).toUpperCase()), s.archivo + ':' + s.renglon);
    }
    assert.deepStrictEqual(m.distintos, []);
  });

  it('CAREO · con el código de antes (' + Object.values(ANTES).join(' / ') + ') cada sitio da el mismo número y el mismo texto alrededor', () => {
    const antes = medir(ANTES, IDS);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.strictEqual(antes.aMano.length, 9, 'el medidor ya no ve los nueve números a mano de antes');
    assert.ok(!antes.copiasIguales, 'antes no había pieza');
    const c = carear(antes, medir(null, IDS));
    assert.strictEqual(c.sitios, 9);
    assert.strictEqual(c.numeros, 9 * IDS.length);
    assert.deepStrictEqual(c.diferencias, [], JSON.stringify(c.diferencias));
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    const L = "export const numeroDelPedido = (id) => (id || '').slice(-5).toUpperCase();";

    it('si la copia de aliados se separa, se nota (y aliados da otro número)', () => {
      const rota = leer(PIEZA_ALIADOS).replace(L, "export const numeroDelPedido = (id) => (id || '').slice(-6).toUpperCase();");
      assert.notStrictEqual(rota, leer(PIEZA_ALIADOS));
      const m = medir(null, IDS, { [PIEZA_ALIADOS]: rota });
      assert.ok(!m.copiasIguales, 'la copia separada sigue saliendo igual');
      assert.ok(m.distintos.length > 0, 'la app y aliados dan distinto número y el medidor no lo ve');
    });

    it('si el chat vuelve a armarlo a mano, se nota (aunque dé lo mismo)', () => {
      const t = leer(DOMICILIO);
      const rota = t.replace('Chat · Pedido #{numeroDelPedido(pedidoChat.id)}', "Chat · Pedido #{(pedidoChat.id || '').slice(-5).toUpperCase()}");
      assert.notStrictEqual(rota, t);
      const m = medir(null, IDS, { [DOMICILIO]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [DOMICILIO]);
    });

    it('si la app importa la pieza de otro sitio, se nota', () => {
      const t = leer(RESTAURANTES);
      const rota = t.replace("quienCanceloElPedido, numeroDelPedido, METODOS_PAGO }", "quienCanceloElPedido, METODOS_PAGO }");
      assert.notStrictEqual(rota, t);
      const m = medir(null, IDS, { [RESTAURANTES]: rota });
      assert.ok(m.problemas.some((p) => /Restaurantes\.js: usa numeroDelPedido sin importarla/.test(p)), m.problemas.join(' · '));
    });

    it('si cambia lo de alrededor («Domicilio #» → «Pedido #»), el careo lo ve', () => {
      const t = leer(DOMICILIO);
      const rota = t.replace("referencia: 'Domicilio #' + numeroDelPedido(p.id)", "referencia: 'Pedido #' + numeroDelPedido(p.id)");
      assert.notStrictEqual(rota, t);
      const c = carear(medir(null, IDS), medir(null, IDS, { [DOMICILIO]: rota }));
      assert.deepStrictEqual(c.diferencias.map((d) => d.que), ['cambió lo de alrededor']);
    });

    it('si un sitio desaparece o se añade uno, se nota', () => {
      const t = leer(DOMICILIO);
      const rota = t.replace('const num = numeroDelPedido(p.id);', "const num = (p.id || '').slice(-4);");
      assert.notStrictEqual(rota, t);
      const m = medir(null, IDS, { [DOMICILIO]: rota });
      assert.ok(m.problemas.some((p) => /esperaba 5 sitios/.test(p)), m.problemas.join(' · '));
    });
  });
});
