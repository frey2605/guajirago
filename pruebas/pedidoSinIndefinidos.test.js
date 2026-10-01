/**
 * P14 · LA PROMOCIÓN AGOTADA YA NO TRANCA EL PEDIDO (1-oct-2026)
 *
 * El fallo: cuando una promoción con tope ya la usó ESE teléfono, la app (enviarPedido, Restaurantes.js) le quitaba el
 * descuento a la línea dejando `promoId`, `promoNombre` y `precioOriginal` en `undefined`, y le pedía al cliente que
 * volviera a enviar. Firestore no guarda `undefined`: el segundo envío (y todos los siguientes) se rechazaba en el
 * propio teléfono, y el cliente veía «No se pudo enviar el pedido · Algo falló por el camino…» sin salida.
 *
 * Aquí NO se lee el código: el medidor (scripts/medir-pedido-sin-indefinidos.cjs) saca de Restaurantes.js el carrito
 * y el envío y los EJECUTA con el candado de verdad y la validación de verdad de la librería de Firestore de la app.
 *   1. CAREO con c6bf569 (antes de P14): los pedidos honrados salen IDÉNTICOS; con la promoción agotada, antes el
 *      pedido no entraba y ahora entra, sin descuento y al precio que cobra el servidor.
 *   2. Ningún caso manda un `undefined`, y lo que se manda cabe en la lista cerrada de P13 (las reglas) y en los campos
 *      de línea que guarda el servidor.
 *   3. La pieza `sinPromo` es UNA (trozo compartido de precioPedido): la de la app y la del servidor QUITAN los campos.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp } = require('./cargar.cjs');
const M = require('../scripts/medir-pedido-sin-indefinidos.cjs');
const SERVIDOR = require('../guajirago/functions/precioPedido.cjs');

const ANTES = 'c6bf569'; // el último commit antes de P14

// Lo que cambia solo por la hora o el azar: el id de la línea y la marca de tiempo del servidor.
const comparable = (pedido) => pedido && {
  ...pedido, creado: 'hora-del-servidor',
  items: pedido.items.map((l) => ({ ...l, lineaId: 'l' })),
};

describe('P14 · la promoción agotada ya no tranca el pedido', () => {
  let hoy;
  let antes;
  before(async () => {
    hoy = await M.medirApp(null);
    antes = await M.medirApp(ANTES);
  });
  const fila = (filas, caso) => {
    const f = filas.find((x) => x.caso === caso);
    assert.ok(f, 'falta el caso «' + caso + '» en el medidor');
    return f;
  };

  it('el medidor corre los 3 honrados y los 2 de promoción agotada', () => {
    assert.strictEqual(hoy.length, 5);
    assert.strictEqual(hoy.filter((f) => f.agotada).length, 2);
  });

  for (const c of M.CASOS.filter((x) => !x.agotada)) {
    it('CAREO · honrado «' + c.caso + '»: el pedido que manda la app es IDÉNTICO al de antes', () => {
      const a = fila(antes, c.caso);
      const h = fila(hoy, c.caso);
      assert.ok(a.entro && h.entro, 'el pedido honrado tiene que entrar con los dos códigos');
      assert.deepStrictEqual(comparable(h.pedido), comparable(a.pedido));
      assert.strictEqual(h.subtotalServidor, a.subtotalServidor);
    });
  }

  for (const c of M.CASOS.filter((x) => x.agotada)) {
    it('CAREO · «' + c.caso + '»: antes el pedido NO entraba; ahora entra sin el descuento', () => {
      const a = fila(antes, c.caso);
      assert.strictEqual(a.entro, false, 'con el código de antes este caso tenía que fallar (si no, el medidor se ablandó)');
      assert.ok(a.indefinidosMandados.includes('items.0.promoId'), 'antes mandaba promoId en undefined');
      const ultimoAntes = a.pasos[a.pasos.length - 1];
      assert.ok(ultimoAntes.aviso && /No se pudo enviar el pedido/.test(ultimoAntes.aviso.titulo), 'antes el cliente veía «No se pudo enviar el pedido»');

      const h = fila(hoy, c.caso);
      assert.strictEqual(h.entro, true, 'al volver a enviar, el pedido tiene que entrar');
      assert.strictEqual(h.pasos.length, 2, 'el primer envío avisa de la promoción y el segundo entra');
      assert.ok(/ya usaste el máximo/.test(h.pasos[0].avisoPromo), 'el primer envío dice que la promoción ya no tiene cupos');
      assert.strictEqual(h.pasos[0].mando, false, 'el primer envío no manda nada');
      assert.ok(h.pasos[1].aviso && h.pasos[1].aviso.ok, 'el segundo envío dice «Pedido enviado»');
      // La línea de la promoción agotada va SIN sus campos (no en undefined) y a su precio de siempre.
      const linea = h.pedido.items.find((l) => l.id === 'p1');
      for (const k of ['promoId', 'promoNombre', 'precioOriginal']) assert.ok(!(k in linea), 'la línea todavía tiene «' + k + '»');
      assert.strictEqual(linea.precio, 18000);
      // Lo que enseña la app es lo que cobra el servidor, y el servidor no aplica la agotada.
      assert.strictEqual(h.subtotalApp, h.subtotalServidor);
      assert.ok(!h.promosServidor.includes('tope1'));
      assert.deepStrictEqual(h.problemasServidor, []);
    });
  }

  it('la otra promoción (sin tope) del mismo pedido se queda', () => {
    const h = fila(hoy, 'PROMO AGOTADA con dos promociones: solo se quita la agotada');
    const jugo = h.pedido.items.find((l) => l.id === 'p2');
    assert.strictEqual(jugo.promoId, 'libre');
    assert.deepStrictEqual(h.promosServidor, ['libre']);
  });

  it('ningún caso manda un undefined, ni campos fuera de la lista de P13 o de la línea', () => {
    for (const f of hoy) {
      assert.deepStrictEqual(f.indefinidosMandados, [], f.caso);
      assert.deepStrictEqual(f.fueraDeP13, [], f.caso);
      assert.deepStrictEqual(f.enLaLinea, [], f.caso);
      for (const p of f.pasos) assert.deepStrictEqual(p.carritoConIndefinidos, [], f.caso + ' · carrito del envío ' + p.envio);
    }
  });

  it('la validación del medidor es la de Firestore de verdad: rechaza un undefined y acepta lo mismo sin él', () => {
    const no = M.loQueDiceFirestore({ items: [{ id: 'p1', promoId: undefined }] });
    assert.ok(no && no.code === 'invalid-argument', JSON.stringify(no));
    assert.strictEqual(M.loQueDiceFirestore({ items: [{ id: 'p1' }] }), null);
  });
});

describe('P14 · sinPromo es UNA pieza: la de la app y la del servidor quitan los campos', () => {
  const APP = cargarDeLaApp('guajirago/src/precioPedido.js');
  const linea = { lineaId: 'l1', id: 'p1', nombre: 'Sancocho', precio: 14400, cantidad: 1, adiciones: [], promoId: 'tope1', promoNombre: 'x', precioOriginal: 18000 };
  it('la de la app', () => {
    const r = APP.sinPromo(linea);
    assert.deepStrictEqual(Object.keys(r), ['lineaId', 'id', 'nombre', 'precio', 'cantidad', 'adiciones']);
    assert.ok(!('promoId' in r));
  });
  it('y el servidor la usa: la línea que guarda no lleva la promoción que no vale', () => {
    const r = SERVIDOR.pedidoConPreciosDelMenu({ menu: [{ id: 'p1', nombre: 'Sancocho', precio: 18000 }], promociones: [] }, [linea], () => 0, new Date());
    assert.ok(!('promoId' in r.items[0]) && !('precioOriginal' in r.items[0]));
    assert.strictEqual(r.subtotal, 18000);
  });
});
