/**
 * P11 · SI LA REVISIÓN DEL PRECIO DEL PEDIDO FALLA, NO SE QUEDA EN SILENCIO (30-sep-2026)
 *
 * El pendiente (hijo de P09/P10): notificarNuevoPedido le pone al pedido de un cliente el precio del MENÚ y luego
 * avisa; si la revisión reventaba, el pedido seguía con los precios del teléfono, el aviso decía ese total como uno
 * cualquiera y aliados lo enseñaba como bueno. Medido con scripts/medir-revision-precio.cjs: 6 caminos fallan y 5 se
 * quedaban en silencio. Ahora:
 *   1. «cómo va la revisión» es UNA pieza (comoVaLaRevision) en guajirago/functions/precioPedido.cjs con copia atada
 *      en guajirago-aliados/src/revisionPrecio.js: el trozo es IGUAL y los dos se EJECUTAN con los mismos casos;
 *   2. la transacción deja `revisionServidor.estado` ('revisado' / 'sin_revisar'), y marcarSinRevisar marca el pedido
 *      cuando la revisión falla, sin pisar una revisión hecha ni tocar el contador de las promociones; un reintento
 *      del mismo disparo tras un fallo vuelve a intentar y cuenta la promoción UNA vez;
 *   3. index.js de verdad, en los 7 caminos del medidor: ninguno queda en silencio, y el aviso dice «precio sin
 *      revisar». CAREO con 49317d0/2b5f4ee: el pedido normal queda IDÉNTICO (solo se suma el estado de la revisión);
 *   4. aliados: confirmar usa el pedido VIVO y espera la revisión (careo: antes, abriendo la ventanita antes de la
 *      revisión, guardaba el subtotal del teléfono encima del del servidor); la tarjeta y la ventanita lo enseñan;
 *   5. el medidor no se puede ablandar.
 * La regla (el teléfono no nace el pedido con la marca) la prueba pruebas/reglas.test.js en el emulador.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, cuerpoDeLaFuncion, copiaIdentica } = require('./cargar.cjs');
const NUBE = require('./nubeDeMentira.cjs');
const M = require('../scripts/medir-revision-precio.cjs');

const ANTES = { raiz: '49317d0', aliados: '2b5f4ee' }; // los últimos commits antes de P11
const SERVIDOR_RUTA = 'guajirago/functions/precioPedido.cjs';
const ALIADOS_RUTA = 'guajirago-aliados/src/revisionPrecio.js';
const PANTALLA = 'guajirago-aliados/src/PedidosDomicilio.js';
const SERVIDOR = require('../' + SERVIDOR_RUTA);
const ALIADOS = cargarDeLaApp(ALIADOS_RUTA);
const sinCR = (t) => t.replace(/\r\n/g, '\n');
const aliadosDe = (commit, rel) => execFileSync('git', ['show', commit + ':' + rel], { cwd: path.join(RAIZ, 'guajirago-aliados'), encoding: 'utf8' });

const MARCA_A = '// ── LA REVISIÓN DEL PRECIO';
const MARCA_B = '// ── FIN DE LA REVISIÓN DEL PRECIO ──';
function trozo(ruta) {
  const t = sinCR(leer(ruta));
  const a = t.indexOf(MARCA_A);
  const b = t.indexOf(MARCA_B);
  assert.ok(a >= 0 && b > a, 'no están las marcas de la revisión del precio en ' + ruta);
  return t.slice(a, b).replace(/^export (function|const) /gm, '$1 ');
}

const MIN = 60 * 1000;
// [caso, pedido, ms de vida, lo que se dice]
const CASOS = [
  ['pedido de la mesa (sin firma de cliente)', { restauranteId: 'R1', items: [] }, 10 * MIN, 'no-aplica'],
  ['sin pedido', null, 0, 'no-aplica'],
  ['de cliente, recién nacido, sin revisión', { clienteId: 'a' }, 5000, 'revisando'],
  ['de cliente, con el reloj del aparato 30 s atrasado', { clienteId: 'a' }, -30000, 'revisando'],
  ['de cliente, con el reloj del aparato 10 min atrasado', { clienteId: 'a' }, -10 * MIN, 'sin-revisar'],
  ['de cliente, sin revisión a los 3 minutos', { clienteId: 'a' }, 3 * MIN, 'sin-revisar'],
  ['de cliente, sin revisión justo a los 2 minutos', { clienteId: 'a' }, 2 * MIN, 'sin-revisar'],
  ['de cliente, sin revisión y sin saber cuándo nació', { clienteId: 'a' }, null, 'sin-revisar'],
  ['revisado por el servidor', { clienteId: 'a', revisionServidor: { estado: 'revisado' } }, 5000, 'revisado'],
  ['marcado sin revisar por el servidor', { clienteId: 'a', revisionServidor: { estado: 'sin_revisar', motivo: 'x' } }, 5000, 'sin-revisar'],
  ['una revisión sin estado (no la escribió este servidor)', { clienteId: 'a', revisionServidor: { evento: 'e', problemas: [] } }, 5000, 'sin-revisar'],
  ['una revisión con un estado inventado', { clienteId: 'a', revisionServidor: { estado: 'ok' } }, 5000, 'sin-revisar'],
];

describe('P11 · la pieza «cómo va la revisión» es UNA: servidor y aliados', () => {
  it('el trozo entre las marcas es igual en los dos archivos', () => {
    copiaIdentica({ nombre: 'el trozo de ' + ALIADOS_RUTA, texto: trozo(ALIADOS_RUTA) },
      { nombre: 'el trozo de ' + SERVIDOR_RUTA, texto: trozo(SERVIDOR_RUTA) }, 'la copia de ALIADOS se separó de la del servidor');
  });

  for (const [caso, p, ms, dice] of CASOS) {
    it(caso + ' → ' + dice, () => {
      assert.strictEqual(SERVIDOR.comoVaLaRevision(p, ms), dice);
      assert.strictEqual(ALIADOS.comoVaLaRevision(p, ms), dice);
    });
  }

  it('las constantes son las mismas en los dos (lo que escribe el servidor es lo que lee aliados)', () => {
    for (const k of ['REVISION_HECHA', 'REVISION_FALLIDA', 'ESPERA_DE_LA_REVISION_MS']) assert.strictEqual(ALIADOS[k], SERVIDOR[k], k);
    assert.deepStrictEqual([SERVIDOR.REVISION_HECHA, SERVIDOR.REVISION_FALLIDA], ['revisado', 'sin_revisar']);
  });
});

// ── La transacción del servidor, con la base de mentira ──
const TEL = '3001112233';
const NEGOCIO = {
  nombre: 'La Cocina de Meche', costoDomicilio: 4000,
  menu: [{ id: 'p1', nombre: 'Sancocho', precio: 18000, disponible: true }],
  promociones: [{ id: 'pct', nombre: '20%', tipo: 'porcentaje', valor: 20, activa: true, programacion: 'siempre', platosAplica: [], limiteCliente: 1 }],
};
const PEDIDO = (extra) => ({
  restauranteId: 'R1', clienteId: 'ana', cliente: 'Ana', telefono: TEL, estado: 'nuevo', tipo: 'domicilio',
  items: [{ id: 'p1', nombre: 'Sancocho', precio: 1, cantidad: 2, promoId: 'pct' }], subtotal: 2, costoDomicilio: 0, total: 2, ...(extra || {}),
});
const datosCon = (pedido) => ({ negocios: { R1: NEGOCIO }, pedidos: { ped1: pedido }, usosPromo: {} });

describe('P11 · el servidor deja dicho cómo quedó la revisión', () => {
  it('si sale bien: estado «revisado», y el contador de la promoción sube UNA vez', async () => {
    const esc = [];
    await SERVIDOR.ponerElPrecioDelServidor(NUBE.baseDeMentira(datosCon(PEDIDO()), esc), 'ped1', 'ev1');
    const up = esc.find((e) => e.ruta === 'pedidos/ped1');
    assert.strictEqual(up.campos.revisionServidor.estado, 'revisado');
    assert.strictEqual(up.campos.total, 14400 * 2 + 4000);
    assert.strictEqual(esc.filter((e) => e.ruta.startsWith('usosPromo/')).length, 1);
  });

  it('si el negocio no existe: estado «sin_revisar» con su motivo, y la plata del teléfono intacta', async () => {
    const esc = [];
    const d = datosCon(PEDIDO());
    d.negocios = {};
    await SERVIDOR.ponerElPrecioDelServidor(NUBE.baseDeMentira(d, esc), 'ped1', 'ev1');
    assert.strictEqual(esc.length, 1);
    assert.deepStrictEqual(Object.keys(esc[0].campos), ['revisionServidor']);
    assert.strictEqual(esc[0].campos.revisionServidor.estado, 'sin_revisar');
    assert.strictEqual(esc[0].campos.revisionServidor.motivo, 'sin-negocio');
  });

  it('un REINTENTO del mismo disparo después de un fallo vuelve a revisar, y cuenta la promoción UNA vez', async () => {
    const esc = [];
    const marcado = PEDIDO({ revisionServidor: { evento: 'ev1', estado: 'sin_revisar', motivo: 'se cayó la base' } });
    await SERVIDOR.ponerElPrecioDelServidor(NUBE.baseDeMentira(datosCon(marcado), esc), 'ped1', 'ev1');
    assert.strictEqual(esc.find((e) => e.ruta === 'pedidos/ped1').campos.revisionServidor.estado, 'revisado');
    assert.strictEqual(esc.filter((e) => e.ruta.startsWith('usosPromo/')).length, 1);
  });

  it('un reintento del mismo disparo después de una revisión HECHA no escribe nada (no cuenta dos veces)', async () => {
    const esc = [];
    await SERVIDOR.ponerElPrecioDelServidor(NUBE.baseDeMentira(datosCon(PEDIDO({ revisionServidor: { evento: 'ev1', estado: 'revisado' } })), esc), 'ped1', 'ev1');
    assert.strictEqual(esc.length, 0);
  });

  it('marcarSinRevisar: deja «sin_revisar», el motivo y lo del teléfono; no toca la plata ni el contador', async () => {
    const esc = [];
    const r = await SERVIDOR.marcarSinRevisar(NUBE.baseDeMentira(datosCon(PEDIDO()), esc), 'ped1', 'ev1', 'se cayó la base');
    assert.strictEqual(esc.length, 1);
    assert.deepStrictEqual(esc[0], { que: 'update', ruta: 'pedidos/ped1', campos: { revisionServidor: {
      evento: 'ev1', estado: 'sin_revisar', motivo: 'se cayó la base', subtotalDelTelefono: 2, totalDelTelefono: 2, promos: [], problemas: [] } } });
    assert.strictEqual(r.revisionServidor.estado, 'sin_revisar');
  });

  it('marcarSinRevisar no pisa una revisión HECHA por este mismo disparo, ni toca los pedidos de la mesa', async () => {
    const esc = [];
    await SERVIDOR.marcarSinRevisar(NUBE.baseDeMentira(datosCon(PEDIDO({ revisionServidor: { evento: 'ev1', estado: 'revisado' } })), esc), 'ped1', 'ev1', 'x');
    await SERVIDOR.marcarSinRevisar(NUBE.baseDeMentira(datosCon({ restauranteId: 'R1', tipo: 'local', total: 1 }), esc), 'ped1', 'ev1', 'x');
    assert.strictEqual(esc.length, 0);
  });

  it('el motivo no se guarda entero si es enorme (200 letras)', async () => {
    const esc = [];
    await SERVIDOR.marcarSinRevisar(NUBE.baseDeMentira(datosCon(PEDIDO()), esc), 'ped1', 'ev1', 'x'.repeat(5000));
    assert.strictEqual(esc[0].campos.revisionServidor.motivo.length, 200);
  });
});

describe('P11 · index.js de verdad en los 7 caminos del medidor (con la nube de mentira)', () => {
  let hoy;
  let antes;
  const fila = (m, n) => m.filas.find((f) => f.nombre.startsWith(n));

  it('HOY: ningún camino que falla se queda en silencio; aliados lo da por «sin revisar» y el aviso lo dice', async () => {
    hoy = await M.medirCodigo();
    assert.strictEqual(hoy.filas.length, 7);
    const fallan = hoy.filas.filter((f) => f.falla);
    assert.strictEqual(fallan.length, 6);
    assert.deepStrictEqual(fallan.filter((f) => f.enSilencio).map((f) => f.nombre), []);
    for (const f of fallan) {
      assert.strictEqual(f.aliados3min, 'sin-revisar', f.nombre);
      assert.strictEqual(f.usosPromo, 0, f.nombre);
      if (f.aviso !== '(no corrió)') assert.match(f.aviso, / · ⚠️ precio sin revisar$/, f.nombre);
    }
    // Donde la base aún contesta, la marca queda ESCRITA en el pedido (y aliados lo ve desde el primer segundo).
    for (const n of ['la base no contesta', 'el menú guardado', 'una promoción con los días', 'el negocio no existe']) {
      assert.strictEqual(fila(hoy, n).revision.estado, 'sin_revisar', n);
      assert.strictEqual(fila(hoy, n).aliados5s, 'sin-revisar', n);
    }
    // Donde no se pudo escribir nada, aliados espera 2 minutos y luego lo da por «sin revisar».
    for (const n of ['la base entera se cae', 'la función no corre']) {
      assert.strictEqual(fila(hoy, n).revision, null, n);
      assert.strictEqual(fila(hoy, n).aliados5s, 'revisando', n);
    }
    assert.strictEqual(hoy.carrera, 'revisando');
  });

  it('el pedido normal: revisado, sin aviso de «sin revisar»', () => {
    const n = fila(hoy, 'normal');
    assert.strictEqual(n.revision.estado, 'revisado');
    assert.strictEqual(n.aliados5s, 'revisado');
    assert.doesNotMatch(n.aviso, /sin revisar/);
  });

  it('CAREO con ' + ANTES.raiz + ' / ' + ANTES.aliados + ': antes 5 caminos en silencio; el pedido normal queda IDÉNTICO', async () => {
    antes = await M.medirCodigo(ANTES.raiz, ANTES.aliados);
    assert.strictEqual(antes.filas.filter((f) => f.enSilencio).length, 5);
    assert.strictEqual(antes.carrera, 'normal (aliados no mira la revisión)');
    const a = fila(antes, 'normal');
    const h = fila(hoy, 'normal');
    const sinRevision = ({ revisionServidor, ...resto }) => resto;
    assert.deepStrictEqual(sinRevision(h.quedo), sinRevision(a.quedo));
    assert.deepStrictEqual(h.revision, { ...a.revision, estado: 'revisado' });
    assert.strictEqual(h.aviso, a.aviso);
    // En los caminos que fallan, la plata es la MISMA de antes (no se inventa nada): lo nuevo es que se dice.
    for (const f of hoy.filas.filter((x) => x.falla)) assert.strictEqual(f.total, fila(antes, f.nombre).total, f.nombre);
  });
});

// ── Aliados: el confirmar, sacado de la pantalla y ejecutado ──
function confirmarDe(fuente) {
  const f = sinCR(fuente);
  const d = f.indexOf('const confirmarConTiempo = ');
  assert.ok(d >= 0, 'no está confirmarConTiempo en aliados');
  // eslint-disable-next-line no-new-func
  return new Function('confirmando', 'costoDomSel', 'tiempoSel', 'cambiarEstado', 'setConfirmando', 'setErrorConfirmar', 'pedidoVivo', 'revisionDe',
    'return (async () => {' + cuerpoDeLaFuncion(f, d).texto + '})();');
}
/** revisionDe y pedidoVivo, sacados de la pantalla tal como están y armados con la pieza de aliados. */
function ayudantesDe(fuente, pedidos, ahora) {
  const f = sinCR(fuente);
  const r = f.match(/^ {2}const revisionDe = .*;$/m);
  const v = f.match(/^ {2}const pedidoVivo = .*;$/m);
  assert.ok(r && v, 'no están revisionDe y pedidoVivo en la pantalla de aliados');
  const fechaMs = (p) => p.creadoMs || 0;
  // eslint-disable-next-line no-new-func
  return new Function('comoVaLaRevision', 'fechaMs', 'ahora', 'pedidos', r[0] + '\n' + v[0] + '\nreturn { revisionDe, pedidoVivo };')(
    ALIADOS.comoVaLaRevision, fechaMs, ahora, pedidos);
}

describe('P11 · aliados: confirmar espera la revisión y usa el pedido VIVO', () => {
  const AHORA = 1_000_000_000;
  // La ventanita se abrió cuando el pedido acababa de nacer (precio del teléfono, $2)...
  const viejo = { id: 'x', clienteId: 'ana', creadoMs: AHORA - 5000, items: [{ precio: 1, cantidad: 2 }], subtotal: 2, total: 2 };
  // ...y mientras tanto llegó la revisión del servidor.
  const vivo = { ...viejo, items: [{ precio: 18000, cantidad: 2 }], subtotal: 36000, total: 40000, revisionServidor: { estado: 'revisado' } };
  const correr = async (fuente, pedidos, ayudantes) => {
    let escrito = null;
    let error = '';
    const h = ayudantes || ayudantesDe(fuente, pedidos, AHORA);
    await confirmarDe(fuente)({ pedido: viejo, destino: 'confirmado' }, '4000', 20,
      async (_p, _d, extra) => { escrito = extra; }, () => {}, (e) => { error = e; }, h.pedidoVivo, h.revisionDe);
    return { escrito, error };
  };

  it('HOY: con la revisión ya llegada, guarda el subtotal del SERVIDOR aunque la ventanita se abriera antes', async () => {
    const { escrito } = await correr(leer(PANTALLA), [vivo]);
    assert.deepStrictEqual(escrito, { tiempoEstimado: 20, costoDomicilio: 4000, subtotal: 36000, total: 40000 });
  });

  it('HOY: si la revisión aún no llega, NO confirma y dice por qué', async () => {
    const { escrito, error } = await correr(leer(PANTALLA), [viejo]);
    assert.strictEqual(escrito, null);
    assert.match(error, /revisando el precio/);
  });

  it('HOY: un pedido «sin revisar» SÍ se puede confirmar (el negocio decide), con lo que tiene', async () => {
    const marcado = { ...viejo, revisionServidor: { estado: 'sin_revisar' } };
    const { escrito } = await correr(leer(PANTALLA), [marcado]);
    assert.deepStrictEqual(escrito, { tiempoEstimado: 20, costoDomicilio: 4000, subtotal: 2, total: 4002 });
  });

  it('ANTES (' + ANTES.aliados + '): guardaba el subtotal del TELÉFONO encima del del servidor', async () => {
    const pasa = { pedidoVivo: () => { throw new Error('antes no existía'); }, revisionDe: () => { throw new Error('antes no existía'); } };
    const { escrito } = await correr(aliadosDe(ANTES.aliados, 'src/PedidosDomicilio.js'), [vivo], pasa);
    assert.deepStrictEqual(escrito, { tiempoEstimado: 20, costoDomicilio: 4000, subtotal: 2, total: 4002 });
  });

  it('la tarjeta y la ventanita lo enseñan (el total espera, el aviso sale y el botón se frena)', () => {
    const f = sinCR(leer(PANTALLA));
    const t = f.indexOf('const tarjeta = (p) => {');
    assert.ok(t >= 0, 'no está la tarjeta');
    const tarjeta = cuerpoDeLaFuncion(f, t).texto;
    assert.match(tarjeta, /const revision = revisionDe\(p\);/);
    assert.match(tarjeta, /\{revision === 'revisando' \? '⏳ Revisando precio…' : cop\(p\.total\)\}/);
    assert.match(tarjeta, /\{revision === 'sin-revisar' && !finalizado && \([^]*?⚠️ Precio sin revisar/);
    assert.match(tarjeta, /disabled=\{guardando \|\| revision === 'revisando'\}/);
    const m = f.indexOf('{/* Modal: confirmar con tiempo estimado */}');
    const modal = f.slice(m, f.indexOf('{/* Modal: rechazar/cancelar con motivo */}'));
    assert.match(modal, /\{revisionDe\(pedidoVivo\(confirmando\.pedido\)\) === 'sin-revisar' && \([^]*?⚠️ Precio sin revisar/);
    assert.match(modal, /Total del pedido: \{cop\(\(pedidoVivo\(confirmando\.pedido\)\.subtotal/);
    assert.match(f, /^import \{ comoVaLaRevision \} from '\.\/revisionPrecio';$/m);
  });
});

describe('P11 · el medidor no se puede ablandar', () => {
  it('sin la pieza de aliados, el pedido se ve «normal» (no la da por revisada ni por sin revisar)', () => {
    assert.strictEqual(M.loQueVeAliados(null, { clienteId: 'a' }, 0), 'normal (aliados no mira la revisión)');
    assert.strictEqual(M.loQueVeAliados(ALIADOS, { clienteId: 'a' }, 3 * MIN), 'sin-revisar');
  });

  it('ve la pantalla de antes sin la pieza y la de hoy con ella', () => {
    assert.deepStrictEqual(M.pantallaDeAliados(ANTES.aliados), { importaLaPieza: false, usosDeLaPieza: 0, confirmaConElPedidoVivo: false, confirmarEsperaLaRevision: false });
    assert.deepStrictEqual(M.pantallaDeAliados(), { importaLaPieza: true, usosDeLaPieza: 3, confirmaConElPedidoVivo: true, confirmarEsperaLaRevision: true });
  });

  it('con una pieza de aliados de mentira que todo lo da por revisado, el medidor ve los 5 caminos EN SILENCIO', async () => {
    const blanda = M.piezaDeAliados(null, "export function comoVaLaRevision() { return 'revisado'; }\n");
    const m = await M.medirCodigo(undefined, undefined, blanda);
    assert.strictEqual(m.filas.filter((f) => f.enSilencio).length, 5);
  });

  it('cuenta los pedidos de producción con la pieza que se le da', () => {
    const pedidos = [
      { id: 'a', estado: 'cerrado' },
      { id: 'b', clienteId: 'u', estado: 'nuevo', creado: 0 },
      { id: 'c', clienteId: 'u', estado: 'cerrado', revisionServidor: { estado: 'revisado' } },
      { id: 'd', clienteId: 'u', estado: 'confirmado', revisionServidor: { evento: 'e' } },
    ];
    const r = M.contarPedidos(pedidos, ALIADOS, 10 * MIN, (v) => v);
    assert.strictEqual(r.deCliente, 3);
    assert.strictEqual(r.sinRevision, 1);
    assert.strictEqual(r.revisionSinEstado, 1);
    assert.deepStrictEqual(r.porEstado, { revisado: 1 });
    assert.deepStrictEqual(r.activosSinRevisar, ['b (nuevo)', 'd (confirmado)']);
  });
});
