/**
 * G84 · ¿QUIÉN CANCELÓ EL PEDIDO? SALE DE UNA PIEZA (29-sep-2026)
 *
 * Un pedido cancelado dice quién lo canceló en tres sitios: el seguimiento y «Mis pedidos» de la app del cliente
 * (guajirago/src/Restaurantes.js) y la tarjeta del pedido en aliados (PedidosDomicilio.js). Antes la app y aliados lo
 * decidían con reglas distintas y, con los pedidos viejos sin `canceladoPor`, el cliente leía «por ti» y el
 * restaurante «rechazado por el restaurante» del MISMO pedido. Ahora los tres preguntan a quienCanceloElPedido:
 * vive en guajirago/src/estadosPedido.js y hay una copia letra por letra en guajirago-aliados/src/flujoPedidos.js.
 *
 *   1. Los dos bloques de la pieza son IGUALES, y la pieza se EJECUTA.
 *   2. Los tres sitios se SACAN de su archivo y se CORREN (scripts/medir-quien-cancelo.cjs): en cada pedido de
 *      mentira, el cliente y el restaurante dicen el MISMO «quién».
 *   3. CAREO con el código de antes (4372a52 / e80e6b8): cambia SOLO donde se decidió (los pedidos sin canceladoPor).
 *   4. Nadie más en la app ni en aliados decide a mano quién canceló un pedido.
 *   5. Pantallas de mentira: si un sitio vuelve a su regla propia, o las copias se separan, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo, copiaIdentica } = require('./cargar.cjs');
const { medir, verCasos, carear, CASOS, ANTES, PIEZA_APP, PIEZA_ALIADOS, RESTAURANTES, ALIADOS } = require('../scripts/medir-quien-cancelo.cjs');

const MARCA = '// ¿QUIÉN CANCELÓ EL PEDIDO, Y POR QUÉ?';

/** El bloque de la pieza: desde su comentario hasta el `};` que cierra la función. */
function bloque(texto) {
  const t = texto.replace(/\r\n/g, '\n');
  const i = t.indexOf(MARCA);
  if (i < 0 || t.indexOf(MARCA, i + 1) >= 0) return null;
  const j = t.indexOf('\n};', t.indexOf('export const quienCanceloElPedido', i));
  return j < 0 ? null : t.slice(i, j + 3);
}

describe('G84 · quién canceló el pedido sale de UNA pieza', () => {
  it('el bloque de la pieza es IGUAL en la app (estadosPedido.js) y en aliados (flujoPedidos.js)', () => {
    const app = bloque(leer(PIEZA_APP));
    assert.ok(app, 'no encuentro el bloque de quienCanceloElPedido en ' + PIEZA_APP);
    copiaIdentica({ nombre: 'el bloque de ' + PIEZA_ALIADOS, texto: bloque(leer(PIEZA_ALIADOS)) }, { nombre: 'el bloque de ' + PIEZA_APP, texto: app },
      'la copia de aliados se separó de ' + PIEZA_APP);
  });

  it('la pieza: canceladoPor manda; sin él, el motivo dice quién; sin nada, no se inventa', () => {
    for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
      const { quienCanceloElPedido: q } = cargarDeLaApp(ruta);
      assert.deepStrictEqual(q({ canceladoPor: 'cliente' }), { quien: 'cliente', motivo: null }, ruta);
      assert.deepStrictEqual(q({ canceladoPor: 'cliente', motivoCancelacion: 'Tarde' }), { quien: 'cliente', motivo: 'Tarde' }, ruta);
      assert.deepStrictEqual(q({ canceladoPor: 'restaurante', motivoRechazo: 'Sin gas' }), { quien: 'restaurante', motivo: 'Sin gas' }, ruta);
      assert.deepStrictEqual(q({ motivoRechazo: 'Cerrado' }), { quien: 'restaurante', motivo: 'Cerrado' }, ruta);
      assert.deepStrictEqual(q({ motivoCancelacion: 'Me arrepentí' }), { quien: 'cliente', motivo: 'Me arrepentí' }, ruta);
      assert.deepStrictEqual(q({}), { quien: null, motivo: null }, ruta);
      assert.deepStrictEqual(q(undefined), { quien: null, motivo: null }, ruta);
      assert.deepStrictEqual(q({ canceladoPor: 'panel' }), { quien: null, motivo: null }, ruta);
      // Si vinieran los dos motivos, se enseña el del restaurante (como ya hacían las dos pantallas).
      assert.deepStrictEqual(q({ canceladoPor: 'cliente', motivoRechazo: 'R', motivoCancelacion: 'C' }), { quien: 'cliente', motivo: 'R' }, ruta);
    }
  });

  it('los tres sitios pasan por la pieza, corridos, y dicen el MISMO «quién» en todos los pedidos', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(Object.keys(m.sitios), ['SEGUIMIENTO', 'MIS PEDIDOS', 'ALIADOS']);
    assert.ok(m.importaApp, 'Restaurantes.js no importa quienCanceloElPedido de ./estadosPedido');
    assert.ok(m.importaAli, 'PedidosDomicilio.js no importa quienCanceloElPedido de ./flujoPedidos');
    const v = verCasos(m);
    const distintos = v.filter((x) => !x.iguales).map((x) => x.caso + ' → ' + JSON.stringify(x.vistos));
    assert.deepStrictEqual(distintos, [], 'el cliente y el restaurante dicen distinto quién canceló');
    const sinNada = v.find((x) => /sin ningún motivo/.test(x.caso));
    assert.deepStrictEqual(sinNada.vistos, { SEGUIMIENTO: '❌ Cancelado', 'MIS PEDIDOS': 'Cancelado', ALIADOS: '❌ Cancelado' });
    const delCliente = v.find((x) => /viejo: sin canceladoPor, con motivo del cliente/.test(x.caso));
    assert.deepStrictEqual(delCliente.quien, { SEGUIMIENTO: 'cliente', 'MIS PEDIDOS': 'cliente', ALIADOS: 'cliente' });
  });

  it('CAREO · con el código de antes (' + ANTES.raiz + ' / ' + ANTES.aliados + ') cambia SOLO lo decidido', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.ok(!antes.importaApp && !antes.importaAli, 'el código de antes no debería usar la pieza');
    assert.strictEqual(verCasos(antes).filter((x) => !x.iguales).length, 3, 'el medidor ya no ve el fallo de antes');
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparaciones, CASOS.length * 3);
    assert.deepStrictEqual(c.diferencias.map((d) => d.caso + ' · ' + d.sitio), [
      'viejo: sin canceladoPor, con motivo del cliente · ALIADOS',
      'viejo: sin canceladoPor y sin ningún motivo · SEGUIMIENTO',
      'viejo: sin canceladoPor y sin ningún motivo · MIS PEDIDOS',
      'viejo: sin canceladoPor y sin ningún motivo · ALIADOS',
      'raro: canceladoPor con un valor que nadie escribe · SEGUIMIENTO',
      'raro: canceladoPor con un valor que nadie escribe · MIS PEDIDOS',
      'raro: canceladoPor con un valor que nadie escribe · ALIADOS',
    ], 'el careo cambió en un caso que no se decidió cambiar');
  });

  it('nadie más en la app ni en aliados decide a mano quién canceló un pedido', () => {
    const aMano = [];
    for (const carpeta of ['guajirago/src', 'guajirago-aliados/src']) {
      for (const f of fs.readdirSync(path.join(RAIZ, carpeta)).filter((x) => x.endsWith('.js'))) {
        const r = carpeta + '/' + f;
        if (r === PIEZA_APP || r === PIEZA_ALIADOS) continue;
        const t = soloCodigo(leer(r));
        // Un pedido se reconoce por sus campos de cancelación propios (los viajes y las reservas usan otros).
        if (/(\.canceladoPor|\.motivoRechazo)\s*(===|!==|&&|\|\||\?)|!\s*\w+\.canceladoPor/.test(t) && /motivoRechazo/.test(t)) aMano.push(r);
      }
    }
    assert.deepStrictEqual(aMano, [], 'decide a mano quién canceló el pedido (usa quienCanceloElPedido): ' + aMano.join(', '));
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    it('si la copia de aliados se separa, se nota', () => {
      const rota = leer(PIEZA_ALIADOS).replace("if (p.motivoCancelacion) return { quien: 'cliente', motivo };", '');
      assert.notStrictEqual(rota, leer(PIEZA_ALIADOS));
      assert.notStrictEqual(bloque(rota), bloque(leer(PIEZA_APP)));
      assert.ok(verCasos(medir(null, { [PIEZA_ALIADOS]: rota })).some((x) => !x.iguales), 'aliados sin mirar el motivo del cliente no cambia nada según el medidor');
    });

    it('si aliados vuelve a su regla vieja, el cliente y el restaurante dicen distinto', () => {
      const rota = leer(ALIADOS).replace("{{ cliente: 'Cancelado por el cliente', restaurante: 'Rechazado por el restaurante' }[quienCanceloElPedido(p).quien] || 'Cancelado'}",
        "{p.canceladoPor === 'cliente' ? 'Cancelado por el cliente' : 'Rechazado por el restaurante'}");
      assert.notStrictEqual(rota, leer(ALIADOS));
      assert.ok(verCasos(medir(null, { [ALIADOS]: rota })).some((x) => !x.iguales), 'aliados con su regla vieja no se nota');
    });

    it('si el seguimiento del cliente vuelve a su regla vieja, se nota', () => {
      const rota = leer(RESTAURANTES).replace("{{ restaurante: 'Cancelado por el restaurante', cliente: 'Cancelado por ti' }[quienCanceloElPedido(pedidoActivo).quien] || 'Cancelado'}",
        "{(pedidoActivo.canceladoPor === 'restaurante' || (!pedidoActivo.canceladoPor && pedidoActivo.motivoRechazo)) ? 'Cancelado por el restaurante' : 'Cancelado por ti'}");
      assert.notStrictEqual(rota, leer(RESTAURANTES));
      assert.ok(verCasos(medir(null, { [RESTAURANTES]: rota })).some((x) => !x.iguales), 'el seguimiento con su regla vieja no se nota');
    });

    it('si «Mis pedidos» deja de preguntarle a la pieza, se nota', () => {
      const rota = leer(RESTAURANTES).replace('const quien = quienCanceloElPedido(p).quien;', "const quien = p.canceladoPor || 'cliente';");
      assert.notStrictEqual(rota, leer(RESTAURANTES));
      assert.ok(verCasos(medir(null, { [RESTAURANTES]: rota })).some((x) => !x.iguales), '«Mis pedidos» con su regla propia no se nota');
    });

    it('si el motivo del seguimiento se deja de enseñar, se nota', () => {
      const rota = leer(RESTAURANTES).replace('{quienCanceloElPedido(pedidoActivo).motivo && (', '{false && (');
      assert.notStrictEqual(rota, leer(RESTAURANTES));
      const v = verCasos(medir(null, { [RESTAURANTES]: rota }));
      assert.ok(!/Motivo/.test(v.find((x) => /restaurante con motivo/.test(x.caso)).vistos.SEGUIMIENTO), 'el medidor no mira el motivo');
      assert.ok(/Motivo: Sin gas/.test(verCasos(medir(null)).find((x) => /restaurante con motivo/.test(x.caso)).vistos.SEGUIMIENTO));
    });
  });
});
