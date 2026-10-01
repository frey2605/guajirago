/**
 * P09 · EL TOTAL DEL PEDIDO LO PONE EL SERVIDOR, NO EL TELÉFONO (30-sep-2026)
 *
 * La deuda: la app del cliente mandaba cada plato CON SU PRECIO, el subtotal y el total, y aliados confirmaba con
 * esos mismos números; el tope de una promoción solo lo miraba la app (hallazgo de P08). Ahora:
 *   1. La cuenta (qué promoción vale hoy, cuánto baja, cuánto cuesta una línea) vive en
 *      guajirago/functions/precioPedido.cjs, y la app lleva una COPIA en guajirago/src/precioPedido.js: el trozo
 *      entre las marcas es IGUAL y las dos se EJECUTAN con los mismos casos.
 *   2. CAREO de la pantalla: el carrito de la app de ANTES (8b34eb3) y el de AHORA, sacados de Restaurantes.js y
 *      ejecutados, ponen el mismo precio en los casos honrados (en hora de Colombia).
 *   3. El servidor (`pedidoConPreciosDelMenu`) cobra lo mismo que enseñaba la app a un cliente honrado, y el precio
 *      del MENÚ a uno que inventa precios; la promoción agotada, vencida, de otro día o inventada no descuenta.
 *   4. La transacción (`ponerElPrecioDelServidor`) con la nube de mentira: escribe el precio y suma el contador UNA
 *      vez (un reintento del mismo disparo no cuenta dos), y no toca los pedidos del negocio.
 *   5. index.js de verdad (cargado con la nube de mentira): notificarNuevoPedido pone el precio ANTES de avisar, y
 *      el aviso dice el total bueno. Careo con 8b34eb3: antes no escribía nada y avisaba el total del teléfono.
 *   6. La app ya no escribe el contador `usosPromo`; aliados confirma con el subtotal del pedido (el del servidor).
 *   7. El medidor (scripts/medir-total-pedido.cjs) no se puede ablandar.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { RAIZ, leer, cargarDeLaApp, cuerpoDeLaFuncion, copiaIdentica } = require('./cargar.cjs');
const NUBE = require('./nubeDeMentira.cjs');
const { cop } = require('../guajirago/functions/moneda.cjs');
const M = require('../scripts/medir-total-pedido.cjs');

const ANTES = '8b34eb3'; // el último commit antes de P09
const SERVIDOR_RUTA = 'guajirago/functions/precioPedido.cjs';
const APP_RUTA = 'guajirago/src/precioPedido.js';
const SERVIDOR = require('../' + SERVIDOR_RUTA);
const APP = cargarDeLaApp(APP_RUTA);
const sinCR = (t) => t.replace(/\r\n/g, '\n');
const deAntes = (ruta) => execFileSync('git', ['show', ANTES + ':' + ruta], { cwd: RAIZ, encoding: 'utf8' });

const MARCA_A = '// ── EL PRECIO DEL PEDIDO';
const MARCA_B = '// ── FIN DEL PRECIO DEL PEDIDO ──';
function trozo(ruta) {
  const t = sinCR(leer(ruta));
  const a = t.indexOf(MARCA_A);
  const b = t.indexOf(MARCA_B);
  assert.ok(a >= 0 && b > a, 'no están las marcas del precio del pedido en ' + ruta);
  return t.slice(a, b).replace(/^export (function|const) /gm, '$1 ');
}

// Un reloj parado, para el código que hace `new Date()` sin argumentos.
const RealDate = Date;
const relojEn = (t) => class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(t.getTime()); }
  static now() { return t.getTime(); }
};
function enColombia(fn) {
  const antes = process.env.TZ;
  process.env.TZ = 'America/Bogota';
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

// ── El negocio de mentira ──
// 30-sep-2026 es MIÉRCOLES (3). A las 3 de la tarde de Colombia.
const AHORA = new Date('2026-09-30T15:00:00-05:00');
const JUEVES = new Date('2026-10-01T15:00:00-05:00');
const MIERCOLES_11PM = new Date('2026-09-30T23:30:00-05:00'); // en UTC ya es jueves
const NEGOCIO = {
  nombre: 'La Cocina de Meche',
  costoDomicilio: 4000,
  menu: [
    { id: 'p1', nombre: 'Sancocho', precio: 18000, disponible: true },
    { id: 'p2', nombre: 'Arroz con pollo', precio: 20000, disponible: true,
      adiciones: [{ nombre: 'Queso', precio: 2000 }, { nombre: 'Huevo', precio: 1500 }] },
    { id: 'p3', nombre: 'Jugo de corozo', precio: 6000, disponible: true },
  ],
  promociones: [
    { id: 'pct', nombre: '20% en sancocho', tipo: 'porcentaje', valor: 20, activa: true, programacion: 'siempre',
      platosAplica: [{ id: 'p1', nombre: 'Sancocho' }], limiteCliente: 1 },
    { id: 'miercoles', nombre: 'Miércoles $3.000 menos', tipo: 'fijo', valor: 3000, activa: true, programacion: 'dias',
      dias: [3], platosAplica: [], limiteCliente: 0 },
    { id: 'dosxuno', nombre: '2x1', tipo: '2x1', valor: 0, activa: true, programacion: 'siempre', platosAplica: [] },
    { id: 'vencida', nombre: 'Septiembre a mitad', tipo: 'porcentaje', valor: 50, activa: true, programacion: 'rango',
      fechaInicio: '2026-09-01', fechaFin: '2026-09-29', platosAplica: [] },
    { id: 'apagada', nombre: 'Apagada', tipo: 'porcentaje', valor: 90, activa: false, programacion: 'siempre', platosAplica: [] },
  ],
};
const plato = (id) => NEGOCIO.menu.find((p) => p.id === id);
const sinUsos = () => 0;

describe('P09 · la cuenta es UNA: el trozo del servidor y la copia de la app', () => {
  it('el trozo entre las marcas es igual en los dos archivos', () => {
    copiaIdentica({ nombre: 'el trozo de ' + APP_RUTA, texto: trozo(APP_RUTA) },
      { nombre: 'el trozo de ' + SERVIDOR_RUTA, texto: trozo(SERVIDOR_RUTA) }, 'la copia de la APP se separó de la cuenta del servidor');
  });

  it('las dos se EJECUTAN con los mismos casos y dicen lo mismo', () => {
    const momentos = [AHORA, JUEVES, MIERCOLES_11PM, new Date('2026-09-29T23:59:00-05:00')];
    for (const ahora of momentos) {
      assert.strictEqual(APP.diaDeLaSemanaEnColombia(ahora), SERVIDOR.diaDeLaSemanaEnColombia(ahora));
      for (const pr of [...NEGOCIO.promociones, null, {}]) {
        assert.strictEqual(APP.promoVigenteHoy(pr, ahora), SERVIDOR.promoVigenteHoy(pr, ahora), JSON.stringify(pr));
        for (const pl of NEGOCIO.menu) {
          assert.deepStrictEqual(APP.precioConPromo(pl, pr), SERVIDOR.precioConPromo(pl, pr));
          for (const usos of [sinUsos, () => 1]) {
            const a = APP.mejorDescuento(pl, NEGOCIO.promociones, usos, ahora);
            const s = SERVIDOR.mejorDescuento(pl, NEGOCIO.promociones, usos, ahora);
            assert.deepStrictEqual(a && [a.promo.id, a.precioFinal], s && [s.promo.id, s.precioFinal]);
          }
        }
      }
    }
    assert.strictEqual(APP.precioDeLaLinea(plato('p2'), [{ precio: 2000 }], null), SERVIDOR.precioDeLaLinea(plato('p2'), [{ precio: 2000 }], null));
  });

  it('el día de la semana es el de COLOMBIA: el miércoles a las 11:30 de la noche sigue siendo miércoles', () => {
    assert.strictEqual(SERVIDOR.diaDeLaSemanaEnColombia(MIERCOLES_11PM), 3);
    assert.strictEqual(SERVIDOR.diaDeLaSemanaEnColombia(JUEVES), 4);
    const miercoles = NEGOCIO.promociones.find((p) => p.id === 'miercoles');
    assert.strictEqual(SERVIDOR.promoVigenteHoy(miercoles, MIERCOLES_11PM), true);
    assert.strictEqual(SERVIDOR.promoVigenteHoy(miercoles, JUEVES), false);
  });
});

// ── El carrito de la pantalla, sacado de Restaurantes.js (el de hoy o el de antes) y ejecutado ──
function elCarritoDe(fuente, extra) {
  const f = sinCR(fuente);
  const a = f.indexOf('  const promosActivasHoy = () => {');
  const b = f.indexOf('  const tocarPlato = ');
  assert.ok(a >= 0 && b > a, 'no está el bloque del carrito en Restaurantes.js');
  // eslint-disable-next-line no-new-func
  const hacer = new Function('ambito', 'with (ambito) {' + f.slice(a, b) + '\nreturn { descuentoDePlato, agregarLinea }; }');
  return (restauranteActivo, usosPromo, ahora) => {
    let carrito = [];
    const r = hacer({
      restauranteActivo, usosPromo, Date: relojEn(ahora), diasTxt: () => '', nuevaLineaId: () => 'l1',
      setCarrito: (fn) => { carrito = fn(carrito); }, ...extra,
    });
    return { ...r, carrito: () => carrito };
  };
}
const CARRITO_HOY = () => elCarritoDe(leer('guajirago/src/Restaurantes.js'), APP);
const CARRITO_ANTES = () => elCarritoDe(deAntes('guajirago/src/Restaurantes.js'),
  { etapaDeVigencia: cargarDeLaApp('guajirago/src/reglaPromocion.js').etapaDeVigencia });

// Los pedidos honrados: lo que el cliente pone en el carrito.
const HONRADOS = [
  { caso: 'sin promoción (jugo)', lineas: [['p3', [], 2]] },
  { caso: 'con promoción de porcentaje (sancocho al 20 %)', lineas: [['p1', [], 1]] },
  { caso: 'con promoción fija del miércoles y adiciones', lineas: [['p2', [{ nombre: 'Queso', precio: 2000 }], 2]] },
  { caso: 'varios platos, una promo con tope y otra sin tope', lineas: [['p1', [], 2], ['p2', [], 1], ['p3', [], 1]] },
];
function armar(carrito, lineas, ahora, usos = {}) {
  const c = carrito(NEGOCIO, usos, ahora);
  for (const [id, ad, n] of lineas) c.agregarLinea(plato(id), ad, n);
  return c.carrito();
}

describe('P09 · CAREO de la pantalla: el carrito de antes y el de ahora', () => {
  for (const h of HONRADOS) {
    for (const [nombre, ahora] of [['miércoles', AHORA], ['jueves', JUEVES]]) {
      it(h.caso + ' (' + nombre + '): mismo precio, misma promoción', () => enColombia(() => {
        const antes = armar(CARRITO_ANTES(), h.lineas, ahora);
        const ahoraC = armar(CARRITO_HOY(), h.lineas, ahora);
        assert.deepStrictEqual(ahoraC, antes);
      }));
    }
  }

  it('y con el tope del aparato lleno, ninguno de los dos pone la promoción', () => enColombia(() => {
    const antes = armar(CARRITO_ANTES(), [['p1', [], 1]], AHORA, { pct: 1 });
    const hoy = armar(CARRITO_HOY(), [['p1', [], 1]], AHORA, { pct: 1 });
    assert.deepStrictEqual(hoy, antes);
    assert.strictEqual(hoy[0].precio, 15000, 'el sancocho sin el 20 % pero con los $3.000 del miércoles');
  }));
});

describe('P09 · el servidor cobra con el MENÚ', () => {
  const cobrar = (items, ahora = AHORA, usos = sinUsos) => SERVIDOR.pedidoConPreciosDelMenu(NEGOCIO, items, usos, ahora);
  const sumaDelTelefono = (carrito) => carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  for (const h of HONRADOS) {
    it('honrado · ' + h.caso + ': el servidor cobra lo MISMO que enseñaba la app', () => enColombia(() => {
      const carrito = armar(CARRITO_HOY(), h.lineas, AHORA);
      const r = cobrar(carrito);
      assert.strictEqual(r.subtotal, sumaDelTelefono(carrito));
      assert.deepStrictEqual(r.problemas, []);
      assert.deepStrictEqual(r.items.map((i) => [i.id, i.precio, i.cantidad, i.promoId]), carrito.map((i) => [i.id, i.precio, i.cantidad, i.promoId]));
    }));
  }

  it('precios inventados: el sancocho a $1 se cobra a $18.000 (jueves, sin promo del día)', () => {
    const r = cobrar([{ id: 'p1', nombre: 'Sancocho', precio: 1, cantidad: 2 }], JUEVES);
    assert.strictEqual(r.subtotal, 36000);
    assert.strictEqual(r.items[0].precio, 18000);
  });

  it('nombre inventado: el plato se llama como en el menú', () => {
    assert.strictEqual(cobrar([{ id: 'p1', nombre: 'Langosta', precio: 18000, cantidad: 1 }], JUEVES).items[0].nombre, 'Sancocho');
  });

  it('adición con precio falso: el queso vale lo del menú; una adición que el plato no tiene va a $0 y se anota', () => {
    const r = cobrar([{ id: 'p2', precio: 20001, cantidad: 1, adiciones: [{ nombre: 'Queso', precio: 1 }, { nombre: 'Caviar', precio: 1 }] }], JUEVES);
    assert.strictEqual(r.subtotal, 22000);
    assert.deepStrictEqual(r.items[0].adiciones, [{ nombre: 'Queso', precio: 2000 }, { nombre: 'Caviar', precio: 0 }]);
    assert.deepStrictEqual(r.problemas.map((p) => p.codigo), ['adicion-fuera-del-menu']);
  });

  it('PROMO AGOTADA (el hallazgo de P08): con el tope lleno, el sancocho vuelve a su precio', () => {
    const linea = { id: 'p1', precio: 14400, cantidad: 1, promoId: 'pct', promoNombre: '20% en sancocho', precioOriginal: 18000 };
    const r = cobrar([linea], JUEVES, (id) => (id === 'pct' ? 1 : 0));
    assert.strictEqual(r.subtotal, 18000);
    assert.strictEqual(r.items[0].promoId, undefined, 'la línea sigue diciendo que lleva la promoción');
    assert.deepStrictEqual(r.promos, []);
    assert.deepStrictEqual(r.problemas.map((p) => p.codigo), ['promocion-no-vale']);
    // Y sin usarla antes, sí vale.
    const bien = cobrar([linea], JUEVES);
    assert.strictEqual(bien.subtotal, 14400);
    assert.deepStrictEqual(bien.promos, ['pct']);
  });

  for (const [promoId, ahora, porque] of [
    ['vencida', AHORA, 'vencida ayer'], ['miercoles', JUEVES, 'de otro día'], ['apagada', AHORA, 'apagada'],
    ['dosxuno', AHORA, 'un 2x1 (ninguna app lo cobra)'], ['inventada', AHORA, 'que no existe'],
  ]) {
    it('una promoción ' + porque + ' no descuenta', () => {
      const r = cobrar([{ id: 'p3', precio: 1, cantidad: 1, promoId }], ahora);
      assert.strictEqual(r.subtotal, 6000);
      assert.deepStrictEqual(r.promos, []);
    });
  }

  it('una promoción que no es de ese plato no descuenta (el 20 % es del sancocho, no del jugo)', () => {
    assert.strictEqual(cobrar([{ id: 'p3', precio: 4800, cantidad: 1, promoId: 'pct' }], JUEVES).subtotal, 6000);
  });

  it('cantidades que no son un entero de 1 o más no suman (ni restan)', () => {
    for (const cantidad of [-3, 0, 1.5, '2', null, undefined]) {
      const r = cobrar([{ id: 'p1', precio: 18000, cantidad }, { id: 'p3', precio: 6000, cantidad: 1 }], JUEVES);
      assert.strictEqual(r.subtotal, 6000, 'cantidad ' + cantidad);
      assert.deepStrictEqual(r.problemas.map((p) => p.codigo), ['cantidad-no-valida']);
    }
  });

  it('un plato que no está en el menú va a $0 y se anota (no se inventa un precio)', () => {
    const r = cobrar([{ id: 'langosta', nombre: 'Langosta', precio: 50000, cantidad: 1 }]);
    assert.strictEqual(r.subtotal, 0);
    // Y la línea tampoco lleva el precio del teléfono (aliados pinta precio × cantidad de cada línea).
    assert.strictEqual(r.items[0].precio, 0);
    assert.deepStrictEqual(r.problemas.map((p) => p.codigo), ['fuera-del-menu']);
  });

  it('dos líneas con la misma promoción cuentan UN uso, como en la app', () => {
    const r = cobrar([{ id: 'p1', cantidad: 1, promoId: 'pct' }, { id: 'p1', cantidad: 2, promoId: 'pct', adiciones: [] }], JUEVES);
    assert.deepStrictEqual(r.promos, ['pct']);
    assert.strictEqual(r.subtotal, 14400 * 3);
  });

  it('sin items, o items que no son una lista: subtotal 0', () => {
    assert.strictEqual(cobrar(undefined).subtotal, 0);
    assert.strictEqual(cobrar('x').subtotal, 0);
  });
});

// ── La transacción, con la nube de mentira ──
const TEL = '3001112233';
const PEDIDO = (extra) => ({
  restauranteId: 'R1', clienteId: 'u1', cliente: 'Ana', telefono: TEL, direccion: 'Calle 1', estado: 'nuevo', tipo: 'domicilio',
  items: [{ id: 'p1', nombre: 'Sancocho', precio: 1, cantidad: 2, promoId: 'pct' }, { id: 'p3', nombre: 'Jugo', precio: 1, cantidad: 1 }],
  subtotal: 3, costoDomicilio: 0, total: 3, ...extra,
});
const datosCon = (pedido, usos = {}) => ({
  pedidos: { ped1: pedido }, negocios: { R1: NEGOCIO }, usosPromo: usos,
  negociosPrivado: { R1: { fcmToken: 'tokR1' } }, empleados: {},
});

describe('P09 · la transacción del servidor (ponerElPrecioDelServidor)', () => {
  const correr = async (datos, evento = 'ev1', ahora = JUEVES) => {
    const escrituras = [];
    const db = NUBE.baseDeMentira(datos, escrituras);
    const r = await SERVIDOR.ponerElPrecioDelServidor(db, 'ped1', evento, ahora);
    return { r, escrituras };
  };

  it('pone el precio del menú, el domicilio del negocio y el total, y suma UNA vez el contador de la promoción', async () => {
    const { r, escrituras } = await correr(datosCon(PEDIDO()));
    const up = escrituras.find((e) => e.ruta === 'pedidos/ped1');
    assert.strictEqual(up.campos.subtotal, 14400 * 2 + 6000);
    assert.strictEqual(up.campos.costoDomicilio, 4000);
    assert.strictEqual(up.campos.total, 14400 * 2 + 6000 + 4000);
    assert.deepStrictEqual(up.campos.revisionServidor, { evento: 'ev1', subtotalDelTelefono: 3, totalDelTelefono: 3, promos: ['pct'], problemas: [] });
    const uso = escrituras.find((e) => e.ruta === 'usosPromo/pct__' + TEL);
    assert.deepStrictEqual(uso.campos, { veces: 1, telefono: TEL, promoId: 'pct' });
    assert.strictEqual(escrituras.length, 2);
    assert.strictEqual(r.total, up.campos.total);
  });

  it('PROMO AGOTADA: con el contador en 1 (tope 1) no hay descuento ni se vuelve a contar', async () => {
    const { escrituras } = await correr(datosCon(PEDIDO(), { ['pct__' + TEL]: { veces: 1, telefono: TEL, promoId: 'pct' } }));
    const up = escrituras.find((e) => e.ruta === 'pedidos/ped1');
    assert.strictEqual(up.campos.subtotal, 18000 * 2 + 6000);
    assert.deepStrictEqual(up.campos.revisionServidor.promos, []);
    assert.strictEqual(escrituras.filter((e) => e.ruta.startsWith('usosPromo/')).length, 0);
  });

  it('un reintento del MISMO disparo no escribe nada (no cuenta dos veces)', async () => {
    const { escrituras } = await correr(datosCon(PEDIDO({ revisionServidor: { evento: 'ev1' } })));
    assert.strictEqual(escrituras.length, 0);
  });

  it('una revisión FALSA puesta por el teléfono al crear no lo salva: se revisa igual', async () => {
    const { escrituras } = await correr(datosCon(PEDIDO({ revisionServidor: { evento: 'inventado' } })));
    assert.strictEqual(escrituras.find((e) => e.ruta === 'pedidos/ped1').campos.total, 14400 * 2 + 6000 + 4000);
  });

  it('el pedido del NEGOCIO (la mesa, sin firma de cliente) no se toca', async () => {
    const { escrituras } = await correr(datosCon({ restauranteId: 'R1', tipo: 'local', estado: 'tomado', items: [{ id: 'p1', precio: 1, cantidad: 1 }], total: 1 }));
    assert.strictEqual(escrituras.length, 0);
  });

  it('si el negocio ya confirmó con otro domicilio, se respeta el suyo', async () => {
    const { escrituras } = await correr(datosCon(PEDIDO({ estado: 'confirmado', costoDomicilio: 7000 })));
    const up = escrituras.find((e) => e.ruta === 'pedidos/ped1');
    assert.strictEqual(up.campos.costoDomicilio, 7000);
    assert.strictEqual(up.campos.total, up.campos.subtotal + 7000);
  });

  it('sin teléfono no se puede mirar el tope: la promoción con tope no descuenta y no se cuenta', async () => {
    const { escrituras } = await correr(datosCon(PEDIDO({ telefono: '' })));
    assert.strictEqual(escrituras.find((e) => e.ruta === 'pedidos/ped1').campos.subtotal, 18000 * 2 + 6000);
    assert.strictEqual(escrituras.filter((e) => e.ruta.startsWith('usosPromo/')).length, 0);
  });

  it('si el negocio no existe, no inventa precios: lo anota y deja el pedido como vino', async () => {
    const d = datosCon(PEDIDO());
    delete d.negocios.R1;
    const { escrituras } = await correr(d);
    assert.strictEqual(escrituras.length, 1);
    assert.deepStrictEqual(Object.keys(escrituras[0].campos), ['revisionServidor']);
    assert.deepStrictEqual(escrituras[0].campos.revisionServidor.problemas, [{ codigo: 'sin-negocio' }]);
  });
});

describe('P09 · index.js de verdad: notificarNuevoPedido pone el precio y LUEGO avisa', () => {
  const evento = { id: 'ev1', data: { id: 'ped1', data: () => PEDIDO() } };
  // Con reloj de jueves: sin la promoción del miércoles.
  const conReloj = (fn) => { const D = global.Date; global.Date = relojEn(JUEVES); return Promise.resolve().then(fn).finally(() => { global.Date = D; }); };

  it('HOY: escribe el precio del menú y el aviso al negocio dice el total BUENO', () => conReloj(async () => {
    const { fx, escrituras, mensajero } = NUBE.cargarIndex(datosCon(PEDIDO()), {});
    await NUBE.conRegistro(() => fx.notificarNuevoPedido(evento));
    const up = escrituras.find((e) => e.ruta === 'pedidos/ped1');
    assert.ok(up, 'notificarNuevoPedido no le puso el precio al pedido');
    assert.strictEqual(up.campos.total, 38800);
    assert.ok(escrituras.some((e) => e.ruta === 'usosPromo/pct__' + TEL));
    assert.strictEqual(mensajero.recibidos[0].notification.body, 'Ana — ' + cop(38800));
  }));

  it('ANTES (' + ANTES + '): no escribía nada y avisaba el total del TELÉFONO ($3)', () => conReloj(async () => {
    const { fx, escrituras, mensajero } = NUBE.cargarIndex(datosCon(PEDIDO()), {}, ANTES);
    await NUBE.conRegistro(() => fx.notificarNuevoPedido(evento));
    assert.strictEqual(escrituras.length, 0);
    assert.strictEqual(mensajero.recibidos[0].notification.body, 'Ana — ' + cop(3));
  }));

  it('si poner el precio falla, el aviso sale igual (con el total del teléfono) y queda en el registro', () => conReloj(async () => {
    const datos = datosCon(PEDIDO());
    const { fx, mensajero } = NUBE.cargarIndex(datos, {});
    datos.negocios = new Proxy({}, { get: () => { throw new Error('se cayó la base'); } });
    const { registro } = await NUBE.conRegistro(() => fx.notificarNuevoPedido(evento));
    assert.match(registro, /P09 · no se pudo poner el precio del servidor al pedido ped1/);
    assert.strictEqual(mensajero.recibidos.length, 1);
  }));
});

describe('P09 · las apps', () => {
  it('la app ya no escribe el contador de las promociones: solo lo LEE (el aviso antes de enviar)', () => {
    const c = M.medirCodigo();
    const desdeTelefono = c.cuentanPromos.filter((s) => !s.startsWith('guajirago/functions'));
    assert.deepStrictEqual(desdeTelefono, []);
    assert.deepStrictEqual(c.cuentanPromos.map((s) => s.split(':')[0]), ['guajirago/functions/precioPedido.cjs']);
    assert.match(sinCR(leer('guajirago/src/Restaurantes.js')), /getDoc\(doc\(db, 'usosPromo', pid \+ '__' \+ tel\)\)/);
  });

  it('aliados confirma con el subtotal DEL PEDIDO (el del servidor), no vuelve a sumar los platos', async () => {
    const f = sinCR(leer('guajirago-aliados/src/PedidosDomicilio.js'));
    const d = f.indexOf('const confirmarConTiempo = ');
    assert.ok(d >= 0, 'no está confirmarConTiempo en aliados');
    // eslint-disable-next-line no-new-func
    const confirmar = new Function('confirmando', 'costoDomSel', 'tiempoSel', 'cambiarEstado', 'setConfirmando', 'setErrorConfirmar',
      'return (async () => {' + cuerpoDeLaFuncion(f, d).texto + '})();');
    let escrito = null;
    // Un pedido que el servidor ya revisó: los platos dicen $1 (lo que mandó un teléfono tramposo antes de la
    // revisión no importa: el servidor reescribe los items), el subtotal es el del servidor.
    const p = { id: 'x', items: [{ precio: 1, cantidad: 2 }], subtotal: 36000, total: 40000, costoDomicilio: 4000 };
    await confirmar({ pedido: p, destino: 'confirmado' }, '5000', 20, async (_p, _d, extra) => { escrito = extra; }, () => {}, () => {});
    assert.deepStrictEqual(escrito, { tiempoEstimado: 20, costoDomicilio: 5000, subtotal: 36000, total: 41000 });
  });
});

describe('P09 · el medidor no se puede ablandar', () => {
  it('ve al teléfono escribiendo la plata y el contador ANTES, y al servidor poniendo el precio HOY', () => {
    const antes = M.medirCodigo(ANTES);
    assert.ok(antes.escribenPlata.some((s) => s.sitio.startsWith('guajirago/src/Restaurantes.js') && s.campos.includes('total')));
    assert.deepStrictEqual(antes.servidor, { pieza: false, pide: false, enElDisparo: false });
    assert.deepStrictEqual(antes.cuentanPromos.map((s) => s.split(':')[0]), ['guajirago/src/Restaurantes.js']);
    assert.deepStrictEqual(M.medirCodigo().servidor, { pieza: true, pide: true, enElDisparo: true });
  });

  it('con un index.js de mentira que pide la pieza pero NO la usa en el disparo, dice que no', () => {
    const index = "const { a } = require('./precioPedido.cjs');\nexports.notificarNuevoPedido = onDocumentCreated(\"pedidos/{id}\",\n  async (event) => avisarDelPedidoNuevo(event.data.data()));\n";
    const leerMentira = (r) => (r.endsWith('index.js') ? index : 'pieza');
    assert.deepStrictEqual(M.elServidorPoneElPrecio(leerMentira), { pieza: true, pide: true, enElDisparo: false });
  });

  it('cuenta los pedidos con el motor que se le da, y caza el que no cuadra', () => {
    const pedidos = [
      { id: 'a', tipo: 'domicilio', restauranteId: 'R1', items: [{ id: 'p3', precio: 6000, cantidad: 1 }], subtotal: 6000 },
      { id: 'b', tipo: 'domicilio', restauranteId: 'R1', items: [{ id: 'p3', precio: 1, cantidad: 1 }] },
      { id: 'c', tipo: 'local', restauranteId: 'R1', items: [{ id: 'p3', precio: 1, cantidad: 1 }] },
      { id: 'd', clienteId: 'u', restauranteId: 'NADIE', items: [] },
    ];
    const r = M.contarPedidos(pedidos, [{ id: 'R1', ...NEGOCIO }], SERVIDOR.pedidoConPreciosDelMenu, JUEVES);
    assert.strictEqual(r.deCliente, 3);
    assert.strictEqual(r.sinNegocio, 1);
    assert.deepStrictEqual(r.noCuadran, [{ id: 'b', telefono: 1, servidor: 6000 }]);
  });
});
