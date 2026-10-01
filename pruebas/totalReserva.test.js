/**
 * P17 · EL TOTAL DE LA RESERVA DE TURISMO LO PONE EL SERVIDOR, NO EL TELÉFONO (1-oct-2026)
 *
 * El pendiente (hijo de P16): la app (Turismo.js, totalReserva) mandaba `total` = precio del tour × personas y nadie lo
 * revisaba; `notificarNuevaReserva` le avisaba a la agencia con ese total. Ahora:
 *   1. La cuenta es UNA (`totalDeLaReserva`), en el trozo atado de la plata: guajirago/functions/precioPedido.cjs y su
 *      copia guajirago/src/precioPedido.js (el trozo igual lo exige pruebas/totalPedido.test.js); aquí se EJECUTAN las
 *      dos con los mismos casos, y la pantalla (Turismo.js) la usa en vez de la suya.
 *   2. CAREO de la pantalla con el código de antes (d69c6de): el cliente ve el mismo total en todos los casos honrados.
 *   3. El motor del servidor (`precioDeLaReserva`, precioReserva.cjs) con lo que pueda mandar una app modificada: nunca
 *      revienta, y lo que no puede revisar lo dice con su motivo.
 *   4. La transacción con la nube de mentira, y lo que pasa cuando FALLA (P11): la marca «sin revisar», y si ni eso,
 *      el aviso igual lo dice.
 *   5. index.js de verdad (scripts/medir-total-reserva.cjs): antes 8 de 13 casos dejaban el total del teléfono o un
 *      tour borrado sin decirlo (también una unidad de cobro mentida y un total inflado); ahora 0; las honradas,
 *      idénticas en la pantalla y en el servidor. Y lo que la pantalla ENVÍA (personas) da en el servidor lo que enseña.
 *   6. Aliados (ReservasTurismo.js): «⏳ Revisando precio…» los primeros segundos (y no deja confirmar), y
 *      «⚠️ Precio sin revisar» cuando el servidor no pudo; con la pieza de P11, ejecutada.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const NUBE = require('./nubeDeMentira.cjs');
const M = require('../scripts/medir-total-reserva.cjs');
const { pantallaDe } = require('../scripts/medir-reserva-cerrada.cjs');

const ANTES = 'd69c6de'; // el último commit antes de P17
const SERVIDOR = require('../guajirago/functions/precioPedido.cjs');
const RESERVA = require('../guajirago/functions/precioReserva.cjs');
const APP = cargarDeLaApp('guajirago/src/precioPedido.js');
const ALIADOS = cargarDeLaApp('guajirago-aliados/src/revisionPrecio.js');
const FECHAS = cargarDeLaApp('guajirago-aliados/src/fechaGuardada.js');
const sinCR = (t) => t.replace(/\r\n/g, '\n');

const TOURS = M.TOURS;
const tour = (id) => TOURS.find((t) => t.id === id);

// [tour, personas, total que tiene que salir]
const CUENTAS = [
  [tour('cabo'), 1, 250000], [tour('cabo'), 2, 500000], [tour('cabo'), 10, 2500000],
  [tour('lancha'), 1, 400000], [tour('lancha'), 5, 400000],
  [tour('carro'), 3, 300000], [tour('kayak'), 4, 50000],
  [{ id: 'x', precio: 1000 }, 3, 1000], // sin unidad: el precio tal cual (así cobraba la app)
  [{ id: 'x', unidadPrecio: 'persona' }, 3, 0], // sin precio: $0 (así cobraba la app)
  [null, 2, 0],
];

describe('P17 · la cuenta de la reserva es UNA (servidor, app y pantalla)', () => {
  it('el servidor y la copia de la app, ejecutados, dan lo mismo en todos los casos', () => {
    for (const [t, p, bueno] of CUENTAS) {
      assert.strictEqual(SERVIDOR.totalDeLaReserva(t, p), bueno, JSON.stringify(t) + ' × ' + p);
      assert.strictEqual(APP.totalDeLaReserva(t, p), bueno, JSON.stringify(t) + ' × ' + p + ' (app)');
    }
  });

  it('la pantalla (Turismo.js) usa la pieza y no hace su propia cuenta', () => {
    const f = sinCR(leer('guajirago/src/Turismo.js'));
    const a = f.indexOf('  const totalReserva = () => {');
    const b = f.indexOf('\n  };\n', a);
    assert.ok(a >= 0 && b > a, 'no está totalReserva en Turismo.js');
    const cuerpo = f.slice(a, b).split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.match(cuerpo, /return totalDeLaReserva\(tourReserva, parseInt\(personas \|\| '1', 10\) \|\| 1\);/);
    assert.doesNotMatch(cuerpo, /precio|unidadPrecio/, 'totalReserva hace su propia cuenta');
    assert.match(f, /^import \{ nombreOPorDefecto, totalDeLaReserva \} from '\.\/precioPedido';$/m);
  });

  it(`CAREO con ${ANTES}: la pantalla enseña el mismo total en todos los casos honrados`, () => {
    const personas = [1, 2, 3, 7, 1000];
    let comparados = 0;
    for (const t of TOURS.filter((x) => typeof x.precio === 'number')) {
      for (const p of personas) {
        assert.strictEqual(M.totalDeLaPantalla(null, t, p), M.totalDeLaPantalla(ANTES, t, p), t.nombre + ' × ' + p);
        assert.strictEqual(M.totalDeLaPantalla(null, t, p), SERVIDOR.totalDeLaReserva(t, p), t.nombre + ' × ' + p + ' (servidor)');
        comparados += 1;
      }
    }
    assert.strictEqual(comparados, 4 * personas.length);
  });

  it('lo que la pantalla ENVÍA (enviarReserva, ejecutada), pasado por el servidor, da el total que la pantalla enseña', async () => {
    const fuente = leer('guajirago/src/Turismo.js');
    let comparados = 0;
    for (const t of TOURS.filter((x) => typeof x.precio === 'number')) {
      for (const p of ['1', '2', '10', '', '0', '3 ', '1000']) {
        const aparato = pantallaDe(fuente)({ tour: t });
        aparato.estado.personas = p;
        const enseña = aparato.total();
        // eslint-disable-next-line no-await-in-loop
        await aparato.enviar();
        const mandada = aparato.mandados[0];
        assert.ok(mandada, 'la pantalla no envió la reserva (' + t.nombre + ', «' + p + '»): ' + JSON.stringify(aparato.estado.aviso));
        assert.strictEqual(mandada.total, enseña, t.nombre + ' «' + p + '»');
        assert.deepStrictEqual(RESERVA.precioDeLaReserva({ tours: [t] }, mandada), { total: enseña, problemas: [] }, t.nombre + ' «' + p + '»');
        comparados += 1;
      }
    }
    assert.strictEqual(comparados, 4 * 7);
  });
});

describe('P17 · el motor del servidor (precioDeLaReserva) no revienta con nada', () => {
  const AG = { tours: TOURS };
  const R = (extra) => ({ tourId: 'cabo', personas: 2, total: 1, ...extra });
  it('pone el total del tour aunque el teléfono mande otro', () => {
    assert.deepStrictEqual(RESERVA.precioDeLaReserva(AG, R()), { total: 500000, problemas: [] });
    assert.deepStrictEqual(RESERVA.precioDeLaReserva(AG, R({ tourId: 'lancha', personas: 9 })), { total: 400000, problemas: [] });
    assert.deepStrictEqual(RESERVA.precioDeLaReserva({ tours: [{ ...tour('cabo'), disponible: false }] }, R()),
      { total: 500000, problemas: [{ codigo: 'no-disponible' }] });
  });
  it('lo que no puede revisar lo dice con su motivo', () => {
    const casos = [
      [AG, R({ tourId: 'borrado' }), 'sin-tour'],
      [AG, R({ tourId: undefined }), 'reserva-sin-tour'],
      [AG, R({ tourId: { id: 'cabo' } }), 'sin-tour'],
      [{ tours: 'no es lista' }, R(), 'sin-tour'],
      [{ tours: [null, 5, 'x'] }, R(), 'sin-tour'],
      [null, R(), 'sin-tour'],
      [AG, R({ tourId: 'raro' }), 'precio-del-tour-no-valido'],
      [{ tours: [{ id: 'cabo', precio: -5, unidadPrecio: 'persona' }] }, R(), 'precio-del-tour-no-valido'],
      [{ tours: [{ id: 'cabo', precio: Infinity, unidadPrecio: 'grupo' }] }, R(), 'precio-del-tour-no-valido'],
      [AG, R({ personas: 0 }), 'personas-no-valido'],
      [AG, R({ personas: 1001 }), 'personas-no-valido'],
      [AG, R({ personas: 1.5 }), 'personas-no-valido'],
      [AG, R({ personas: '2' }), 'personas-no-valido'],
    ];
    for (const [ag, r, motivo] of casos) assert.deepStrictEqual(RESERVA.precioDeLaReserva(ag, r), { motivo }, JSON.stringify(r) + ' en ' + JSON.stringify(ag && ag.tours));
  });
});

// ── La transacción, con la nube de mentira ──
const LA_RESERVA = (extra) => ({ agenciaId: 'ag1', clienteId: 'ana', tourId: 'cabo', personas: 2, total: 1, estado: 'nueva', cliente: 'Ana', nombreTour: 'Cabo de la Vela', ...extra });
const datosCon = (r, agencia = { tours: TOURS }) => ({ reservasTurismo: { res1: r }, negocios: { ag1: agencia } });

describe('P17 · la transacción del servidor (ponerElPrecioDeLaReserva)', () => {
  const correr = async (datos, evento = 'ev1') => {
    const escrituras = [];
    const c = await RESERVA.ponerElPrecioDeLaReserva(NUBE.baseDeMentira(datos, escrituras), 'res1', evento);
    return { c, escrituras };
  };
  it('escribe el total del tour y guarda lo que mandó el teléfono', async () => {
    const { c, escrituras } = await correr(datosCon(LA_RESERVA()));
    assert.deepStrictEqual(escrituras, [{ que: 'update', ruta: 'reservasTurismo/res1',
      campos: { total: 500000, revisionServidor: { evento: 'ev1', estado: 'revisado', totalDelTelefono: 1, problemas: [] } } }]);
    assert.strictEqual(c.total, 500000);
  });
  it('un total que no es número se guarda como null (no se copia la basura)', async () => {
    const { escrituras } = await correr(datosCon(LA_RESERVA({ total: 'mil' })));
    assert.strictEqual(escrituras[0].campos.revisionServidor.totalDelTelefono, null);
  });
  it('un reintento del MISMO disparo no escribe nada', async () => {
    const { escrituras } = await correr(datosCon(LA_RESERVA({ total: 500000, revisionServidor: { evento: 'ev1', estado: 'revisado' } })));
    assert.strictEqual(escrituras.length, 0);
  });
  it('la reserva de la AGENCIA (sin firma de cliente) no se toca', async () => {
    const { c, escrituras } = await correr(datosCon(LA_RESERVA({ clienteId: null })));
    assert.strictEqual(escrituras.length, 0);
    assert.strictEqual(c, null);
  });
  it('tour borrado, agencia que no existe o con un nombre que Firestore no acepta: «sin revisar», sin tocar el total', async () => {
    for (const [r, motivo] of [[LA_RESERVA({ tourId: 'borrado' }), 'sin-tour'], [LA_RESERVA({ agenciaId: 'otra' }), 'sin-agencia'], [LA_RESERVA({ agenciaId: 'a/b' }), 'sin-agencia']]) {
      // eslint-disable-next-line no-await-in-loop
      const { escrituras } = await correr(datosCon(r));
      assert.deepStrictEqual(escrituras[0].campos, { revisionServidor: { evento: 'ev1', estado: 'sin_revisar', motivo, totalDelTelefono: 1, problemas: [{ codigo: motivo }] } }, motivo);
    }
  });
});

describe('P17 · si la revisión FALLA, no se queda callada (como P11)', () => {
  const dbQueFalla = (veces, escrituras) => {
    const base = NUBE.baseDeMentira(datosCon(LA_RESERVA()), escrituras);
    let n = 0;
    return { ...base, runTransaction: async (fn) => { n += 1; if (n <= veces) throw new Error('se cayó la base ' + n); return base.runTransaction(fn); } };
  };
  it('si poner el total revienta, la marca «sin revisar» con el motivo', async () => {
    const escrituras = [];
    const { valor: r } = await NUBE.conRegistro(() => RESERVA.reservaConElPrecioDelServidor(dbQueFalla(1, escrituras), 'res1', 'ev1', LA_RESERVA()));
    assert.deepStrictEqual(escrituras[0].campos.revisionServidor, { evento: 'ev1', estado: 'sin_revisar', motivo: 'se cayó la base 1', totalDelTelefono: 1, problemas: [] });
    assert.strictEqual(ALIADOS.comoVaLaRevision(r, null), 'sin-revisar');
    assert.strictEqual(r.estado, 'nueva');
  });
  it('si ni eso se puede, devuelve la reserva como nació y se da por «sin revisar»', async () => {
    const { valor: r, registro } = await NUBE.conRegistro(() => RESERVA.reservaConElPrecioDelServidor(dbQueFalla(2, []), 'res1', 'ev1', LA_RESERVA()));
    assert.deepStrictEqual(r, LA_RESERVA());
    assert.strictEqual(SERVIDOR.comoVaLaRevision(r, null), 'sin-revisar');
    assert.match(registro, /tampoco se pudo marcar la reserva sin revisar/);
  });
});

describe('P17 · index.js de verdad: notificarNuevaReserva pone el total y LUEGO avisa', () => {
  it('hoy: 0 casos con un total que no es el del tour (o sin revisar sin decirlo), y las honradas idénticas', async () => {
    const m = await M.medirCodigo(null);
    assert.strictEqual(m.filas.length, M.CASOS.length);
    assert.deepStrictEqual(m.malos.map((f) => f.caso), []);
    assert.deepStrictEqual(m.honradasDistintas.map((f) => f.caso), []);
    const inventada = m.filas.find((f) => /INVENTADA · Cabo/.test(f.caso));
    assert.strictEqual(inventada.servidor.total, 500000);
    assert.match(inventada.servidor.aviso, /^Ana reservó Cabo de la Vela — \$\s500\.000$/);
    const borrado = m.filas.find((f) => /TOUR BORRADO/.test(f.caso));
    assert.match(borrado.servidor.aviso, /· ⚠️ precio sin revisar$/);
    // La unidad de cobro la dice el TOUR, no la reserva; y un total MAYOR que el del tour tampoco se queda.
    assert.strictEqual(m.filas.find((f) => /«por grupo»/.test(f.caso)).servidor.total, 2500000);
    assert.strictEqual(m.filas.find((f) => /INFLADA/.test(f.caso)).servidor.total, 50000);
    const deLaAgencia = m.filas.find((f) => /DE LA AGENCIA/.test(f.caso));
    assert.deepStrictEqual(deLaAgencia.servidor.escribio, [], 'la reserva de la agencia no se toca');
  });
  it(`CAREO con ${ANTES}: antes 8 de 13 se quedaban con el total del teléfono; las honradas avisaban lo mismo`, async () => {
    const antes = await M.medirCodigo(ANTES);
    const hoy = await M.medirCodigo(null);
    assert.strictEqual(antes.malos.length, 8);
    for (const c of [/unidadPrecio|«por grupo»/, /INFLADA/]) assert.ok(antes.malos.some((f) => c.test(f.caso)), 'el medidor perdió el caso ' + c);
    assert.match(antes.filas.find((f) => /INVENTADA · Cabo/.test(f.caso)).servidor.aviso, /— \$\s1$/);
    for (const [i, f] of antes.filas.entries()) {
      if (!f.honrado) continue;
      assert.strictEqual(hoy.filas[i].servidor.total, f.servidor.total, f.caso);
      assert.strictEqual(hoy.filas[i].servidor.aviso, f.servidor.aviso, f.caso);
    }
  });
});

describe('P17 · aliados (ReservasTurismo.js) dice cómo va la revisión del total', () => {
  const f = sinCR(leer('guajirago-aliados/src/ReservasTurismo.js'));
  it('usa la pieza de P11 y la de las fechas guardadas (no una copia propia)', () => {
    assert.match(f, /^import \{ comoVaLaRevision \} from '\.\/revisionPrecio';$/m);
    assert.match(f, /^import \{ msDeFecha \} from '\.\/fechaGuardada';$/m);
  });
  it('el reloj de la espera avanza cada segundo (si no, «revisando» dura de más o de menos)', () => {
    assert.ok(f.includes('\n  useEffect(() => {\n    const t = setInterval(() => setAhora(Date.now()), 1000);\n    return () => clearInterval(t);\n  }, []);\n'),
      'el reloj de la espera no avanza cada segundo');
    assert.strictEqual(f.split('setAhora(').length - 1, 1, 'otro sitio cambia el reloj');
  });
  it('revisionDe, sacada del archivo y ejecutada: revisando, revisado y sin revisar', () => {
    const l = f.split('\n').find((x) => /^  const revisionDe = /.test(x));
    assert.ok(l, 'no está revisionDe');
    const AHORA = Date.parse('2026-10-01T15:00:00.000Z');
    // eslint-disable-next-line no-new-func
    const revisionDe = new Function('comoVaLaRevision', 'msDeFecha', 'ahora', l + '\nreturn revisionDe;')(ALIADOS.comoVaLaRevision, FECHAS.msDeFecha, AHORA);
    const r = (extra) => ({ clienteId: 'ana', total: 1, creado: '2026-10-01T14:59:50.000Z', ...extra });
    assert.strictEqual(revisionDe(r()), 'revisando');
    assert.strictEqual(revisionDe(r({ creado: '2026-10-01T14:50:00.000Z' })), 'sin-revisar');
    assert.strictEqual(revisionDe(r({ revisionServidor: { estado: 'revisado' } })), 'revisado');
    assert.strictEqual(revisionDe(r({ revisionServidor: { estado: 'sin_revisar' } })), 'sin-revisar');
    assert.strictEqual(revisionDe(r({ clienteId: null })), 'no-aplica');
    assert.strictEqual(revisionDe(r({ creado: undefined })), 'sin-revisar');
  });
  it('la tarjeta: el total espera la revisión, el aviso naranja sale sin revisar, y no deja confirmar mientras revisa', () => {
    const tarjeta = f.slice(f.indexOf("const revision = revisionDe(r);"), f.indexOf('{cancelando && ('));
    assert.ok(tarjeta.length > 100, 'no encuentro la tarjeta de la reserva');
    assert.match(tarjeta, /\{revision === 'revisando' \? '⏳ Revisando precio…' : cop\(r\.total\)\}/);
    assert.match(tarjeta, /\{revision === 'sin-revisar' && \(est === 'nueva' \|\| est === 'confirmada'\) && \(\n\s*<p [^\n]*>⚠️ Precio sin revisar: [^<]*Confírmalo con el cliente\.<\/p>/);
    assert.match(tarjeta, /onClick=\{\(\) => confirmar\(r\)\} disabled=\{guardando === r\.id \|\| revision === 'revisando'\}/);
    assert.strictEqual((tarjeta.match(/cop\(r\.total\)/g) || []).length, 1, 'otro sitio de la tarjeta enseña el total sin mirar la revisión');
  });
});
