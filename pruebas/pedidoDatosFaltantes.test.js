/**
 * P15 · UN DATO QUE LE FALTA AL NEGOCIO YA NO TRANCA EL PEDIDO (1-oct-2026)
 *
 * El fallo (hijo de P14): la app (agregarLinea y enviarPedido, Restaurantes.js) armaba el pedido con el nombre del
 * negocio, el id y el nombre de cada plato y el id y el nombre de la promoción TAL CUAL venían del negocio. Si uno
 * faltaba, iba `undefined`, Firestore lo rechazaba en el propio teléfono y el cliente veía «No se pudo enviar el
 * pedido» cada vez. Y si el nombre del negocio no era texto, la librería lo dejaba pasar pero las reglas (P13) no.
 *
 * Aquí NO se lee el código: el medidor (scripts/medir-pedido-sin-indefinidos.cjs, casos CASOS_FALTANTES) saca de
 * Restaurantes.js el carrito y el envío y los EJECUTA con el candado de verdad y la validación de verdad de Firestore.
 *   1. CAREO con f12717e (antes de P15): los pedidos honrados salen IDÉNTICOS (lo que manda la app y lo que guarda el
 *      servidor); con cada dato faltante, antes no entraba y ahora entra con un nombre que se entiende.
 *   2. Lo que manda la app entra con las REGLAS de hoy en el emulador (tipos y topes de P13).
 *   3. El nombre por defecto es UNO (trozo compartido de precioPedido): la app y el servidor dicen lo mismo.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { cargarDeLaApp } = require('./cargar.cjs');
const M = require('../scripts/medir-pedido-sin-indefinidos.cjs');
const SERVIDOR = require('../guajirago/functions/precioPedido.cjs');

const ANTES = 'f12717e'; // el último commit antes de P15

const comparable = (pedido) => pedido && {
  ...pedido, creado: 'hora-del-servidor',
  items: pedido.items.map((l) => ({ ...l, lineaId: 'l' })),
};

/** Lo que se espera HOY de cada caso con un dato faltante: el nombre del negocio, la línea y la ruta que antes era undefined. */
const ESPERADO = {
  'FALTA · el negocio no tiene nombre': { negocio: 'Restaurante', antesIndefinido: 'restauranteNombre' },
  'FALTA · el nombre del negocio no es texto (un número)': { negocio: 'Restaurante', antesIndefinido: null },
  'FALTA · un plato sin nombre': { linea: { nombre: 'Plato' }, antesIndefinido: 'items.0.nombre' },
  'FALTA · una promoción sin nombre': { linea: { nombre: 'Jugo', promoId: 'libre', promoNombre: 'Promoción', precio: 5000 }, antesIndefinido: 'items.0.promoNombre' },
  'FALTA · una promoción sin id': { linea: { nombre: 'Jugo', precio: 6000 }, sinCampos: ['promoId', 'promoNombre', 'precioOriginal'], antesIndefinido: 'items.0.promoId' },
  'FALTA · un plato sin id': { linea: { nombre: 'Agua', precio: 3000 }, sinCampos: ['id'], antesIndefinido: 'items.0.id' },
};

let hoy;
let antes;
let honradosHoy;
let honradosAntes;
before(async () => {
  hoy = await M.medirApp(null, M.CASOS_FALTANTES);
  antes = await M.medirApp(ANTES, M.CASOS_FALTANTES);
  honradosHoy = await M.medirApp(null);
  honradosAntes = await M.medirApp(ANTES);
});
const fila = (filas, caso) => {
  const f = filas.find((x) => x.caso === caso);
  assert.ok(f, 'falta el caso «' + caso + '» en el medidor');
  return f;
};

describe('P15 · un dato que le falta al negocio ya no tranca el pedido', () => {
  it('el medidor corre los 6 casos de un dato faltante', () => {
    assert.deepStrictEqual(hoy.map((f) => f.caso).sort(), Object.keys(ESPERADO).sort());
  });

  for (const c of M.CASOS.filter((x) => !x.agotada)) {
    it('CAREO · honrado «' + c.caso + '»: lo que manda la app y lo que guarda el servidor, IDÉNTICOS a antes', () => {
      const a = fila(honradosAntes, c.caso);
      const h = fila(honradosHoy, c.caso);
      assert.ok(a.entro && h.entro);
      assert.deepStrictEqual(comparable(h.pedido), comparable(a.pedido));
      assert.deepStrictEqual(h.itemsServidor.map((l) => ({ ...l, lineaId: 'l' })), a.itemsServidor.map((l) => ({ ...l, lineaId: 'l' })));
      assert.strictEqual(h.subtotalServidor, a.subtotalServidor);
    });
  }

  for (const [caso, e] of Object.entries(ESPERADO)) {
    it('CAREO · «' + caso + '»: antes ' + (e.antesIndefinido ? 'no entraba' : 'mandaba un nombre que no es texto') + '; ahora entra con un nombre que se entiende', () => {
      const a = fila(antes, caso);
      if (e.antesIndefinido) {
        assert.strictEqual(a.entro, false, 'con el código de antes este caso tenía que fallar (si no, el medidor se ablandó)');
        assert.ok(a.indefinidosMandados.includes(e.antesIndefinido), 'antes mandaba undefined en ' + e.antesIndefinido + ' (mandó: ' + a.indefinidosMandados + ')');
        const ultimo = a.pasos[a.pasos.length - 1];
        assert.ok(ultimo.aviso && /No se pudo enviar el pedido/.test(ultimo.aviso.titulo));
      } else {
        assert.strictEqual(typeof a.intentado.restauranteNombre, 'number', 'antes mandaba el nombre del negocio como número');
      }

      const h = fila(hoy, caso);
      assert.strictEqual(h.entro, true, 'el pedido tiene que entrar');
      assert.ok(h.pasos[0].aviso && h.pasos[0].aviso.ok, 'el cliente ve «Pedido enviado»');
      assert.deepStrictEqual(h.indefinidosMandados, []);
      assert.deepStrictEqual(h.indefinidosServidor, [], 'lo que guarda el servidor tampoco lleva undefined');
      assert.deepStrictEqual(h.fueraDeP13, []);
      assert.deepStrictEqual(h.enLaLinea, []);
      assert.strictEqual(h.pedido.restauranteNombre, e.negocio || 'Restaurante de Mentira');
      const linea = h.pedido.items[0];
      for (const [k, v] of Object.entries(e.linea || {})) assert.strictEqual(linea[k], v, 'la línea: ' + k);
      for (const k of e.sinCampos || []) assert.ok(!(k in linea), 'la línea no debe llevar «' + k + '»');
      // Lo que enseña la app es lo que cobra el servidor, y el servidor guarda el mismo nombre por defecto.
      assert.strictEqual(h.subtotalApp, h.subtotalServidor);
      assert.strictEqual(h.itemsServidor[0].nombre, linea.nombre);
      if ('promoNombre' in linea) assert.strictEqual(h.itemsServidor[0].promoNombre, linea.promoNombre);
    });
  }
});

describe('P15 · el nombre por defecto es UNO: el de la app y el del servidor', () => {
  const APP = cargarDeLaApp('guajirago/src/precioPedido.js');
  it('la pieza: el nombre si es texto con algo; si no, el de por defecto', () => {
    for (const P of [APP, SERVIDOR]) {
      assert.strictEqual(P.nombreOPorDefecto('Sancocho', 'Plato'), 'Sancocho');
      for (const malo of [undefined, null, '', '   ', 123, {}]) assert.strictEqual(P.nombreOPorDefecto(malo, 'Plato'), 'Plato');
      assert.strictEqual(P.PLATO_SIN_NOMBRE, 'Plato');
      assert.strictEqual(P.PROMO_SIN_NOMBRE, 'Promoción');
    }
  });
  it('el servidor: el plato y la promoción sin nombre se guardan con el nombre por defecto; con nombre, el suyo', () => {
    const negocio = { menu: [{ id: 'p1', precio: 18000 }, { id: 'p2', nombre: 'Jugo', precio: 6000 }], promociones: [{ id: 'x', activa: true, tipo: 'fijo', valor: 1000, platosAplica: [{ id: 'p2' }] }] };
    const r = SERVIDOR.pedidoConPreciosDelMenu(negocio, [{ id: 'p1', cantidad: 1, adiciones: [] }, { id: 'p2', cantidad: 1, adiciones: [], promoId: 'x' }], () => 0, new Date());
    assert.strictEqual(r.items[0].nombre, 'Plato');
    assert.strictEqual(r.items[1].nombre, 'Jugo');
    assert.strictEqual(r.items[1].promoNombre, 'Promoción');
    assert.strictEqual(r.subtotal, 18000 + 5000);
  });
});

// ── Lo que manda la app, con las REGLAS de hoy en el emulador ──

let RUT;
let FS;
let entorno;
before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  entorno = await RUT.initializeTestEnvironment({
    projectId: 'demo-p15',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: elEmulador().firestore },
  });
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await FS.setDoc(FS.doc(db, 'usuarios/cliente-ana'), { nombre: 'Ana', rol: '' });
    await FS.setDoc(FS.doc(db, 'negocios/' + M.NEGOCIO.id), { nombre: M.NEGOCIO.nombre, activo: true });
  });
});
after(async () => { if (entorno) await entorno.cleanup(); });

/** El pedido que mandó la app, con la hora del servidor de ESTA librería (la marca de la app es de otra copia). */
const paraLaBase = (pedido) => ({ ...pedido, creado: FS.serverTimestamp() });

describe('P15 · lo que manda la app entra con las reglas de hoy (emulador)', () => {
  for (const caso of Object.keys(ESPERADO)) {
    it('«' + caso + '» → la base lo acepta', async () => {
      const db = entorno.authenticatedContext('cliente-ana').firestore();
      await RUT.assertSucceeds(FS.addDoc(FS.collection(db, 'pedidos'), paraLaBase(fila(hoy, caso).pedido)));
    });
  }
  it('y con el código de antes, el nombre del negocio como número lo negaban las reglas', async () => {
    const db = entorno.authenticatedContext('cliente-ana').firestore();
    await RUT.assertFails(FS.addDoc(FS.collection(db, 'pedidos'), paraLaBase(fila(antes, 'FALTA · el nombre del negocio no es texto (un número)').intentado)));
  });
});
