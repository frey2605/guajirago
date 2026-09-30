/**
 * G48 · LA FECHA DEL PEDIDO SE LEE EN UN SOLO SITIO (29-sep-2026)
 *
 * El `creado` de un pedido llegaba en dos formatos (Timestamp del servidor en el domicilio de la app; texto ISO del
 * celular en el pedido de mesa de aliados) y se leía con seis convertidores. El del panel no entendía un Timestamp:
 * «🧾 pedidos hoy» no contaba ningún domicilio (medido en producción: 17 de 29 pedidos fuera de la cuenta).
 *
 *   1. La pieza (`guajirago/src/fechaGuardada.js`) se EJECUTA —la de la app, la de aliados y la del panel— con los
 *      dos formatos (el Timestamp de VERDAD de la librería de firebase), en varias zonas horarias.
 *   2. Las copias son iguales byte a byte.
 *   3. Las pantallas se ejecutan: el «pedidos hoy» y la fecha de la ficha del panel, y el «hoy» de Corte de caja,
 *      sacados del archivo con el MISMO lector que usa scripts/medir-fecha-pedido.cjs; y cada convertidor de aliados
 *      y de la app, sacado de su archivo y corrido con los dos formatos.
 *   4. Los dos que escriben `creado` en un pedido usan la hora del servidor.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, copiaIdentica } = require('./cargar.cjs');
const { elPanel, laCaja, conReloj, timestampDe } = require('../scripts/medir-fecha-pedido.cjs');

const APP = 'guajirago/src/fechaGuardada.js';
const ALIADOS = 'guajirago-aliados/src/fechaGuardada.js';
const PANEL = 'guajirago-admin/src/fechaGuardada.js';

// Las 8 p. m. del domingo 20 de septiembre en Colombia: en Londres ya es el lunes 21.
const OCHO_PM = '2026-09-20T20:00:00-05:00';
const MS = Date.parse(OCHO_PM);
const ISO = new Date(MS).toISOString();
const TS = timestampDe(ISO);
const PLANO = { seconds: Math.floor(MS / 1000), nanoseconds: 0 };
const ZONAS = ['America/Bogota', 'UTC', 'Asia/Tokyo', 'Pacific/Pago_Pago'];

function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

/** Saca del archivo una línea `const <nombre> = ...;` (una sola línea) y la devuelve como función, con las piezas dadas. */
function unaLinea(ruta, nombre, piezas) {
  const t = leer(ruta).replace(/\r\n/g, '\n');
  const m = t.match(new RegExp('\\n[ \\t]*(const ' + nombre + ' = [^\\n]*;)\\n'));
  assert.ok(m, 'no encuentro «const ' + nombre + '» en ' + ruta);
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  return new Function(...nombres, m[1] + '\nreturn ' + nombre + ';')(...nombres.map((n) => piezas[n]));
}

describe('G48 · la fecha guardada de un pedido se lee con UNA pieza', () => {
  for (const ruta of [APP, ALIADOS, PANEL]) {
    it('la pieza entiende texto y Timestamp, y da el día de Colombia en cualquier zona (' + ruta.split('/')[0] + ')', () => {
      const F = cargarDeLaApp(ruta);
      // El Timestamp es el de verdad: `new Date(ts)` da «Invalid Date» (es lo que le pasaba al panel).
      assert.ok(Number.isNaN(new Date(TS).getTime()), 'el Timestamp de prueba no es el de la librería');
      for (const v of [ISO, TS, PLANO, MS, new Date(MS)]) assert.strictEqual(F.msDeFecha(v), MS, 'lee ' + JSON.stringify(v));
      for (const v of [null, undefined, '', 'no es fecha', {}, { seconds: 'x' }, NaN, { toMillis: () => NaN }]) {
        assert.strictEqual(F.msDeFecha(v), null, 'no inventa fecha con ' + String(v));
      }
      for (const tz of ZONAS) {
        enZona(tz, () => {
          if (tz === 'UTC') assert.strictEqual(new Date(MS).getDate(), 21, 'la zona de Londres no se aplicó');
          for (const v of [ISO, TS, PLANO]) {
            assert.strictEqual(F.diaEnColombiaDe(v), '2026-09-20', 'en ' + tz);
            assert.strictEqual(F.esDeHoyEnColombia(v, new Date(Date.parse('2026-09-20T23:59:00-05:00'))), true, 'hoy, en ' + tz);
            assert.strictEqual(F.esDeHoyEnColombia(v, new Date(Date.parse('2026-09-21T00:01:00-05:00'))), false, 'mañana, en ' + tz);
          }
        });
      }
      assert.strictEqual(F.diaEnColombiaDe(null), null);
      assert.strictEqual(F.esDeHoyEnColombia(null), false);
    });
  }

  it('las copias de aliados y del panel son la de la app, idénticas', () => {
    copiaIdentica(ALIADOS, APP, 'se separaron: guajirago-aliados/src/fechaGuardada.js tiene que ser la de la app');
    copiaIdentica(PANEL, APP, 'se separaron: guajirago-admin/src/fechaGuardada.js tiene que ser la de la app');
  });

  it('el panel: «pedidos hoy» cuenta el domicilio (Timestamp) y la mesa (texto), con el día de Colombia', () => {
    const panel = elPanel(null);
    const pedidos = [
      { restauranteId: 'R', tipo: 'domicilio', creado: TS },
      { restauranteId: 'R', tipo: 'local', creado: ISO },
      { restauranteId: 'R', tipo: 'local', creado: new Date(MS - 24 * 3600000).toISOString() }, // ayer
      { restauranteId: 'OTRO', tipo: 'domicilio', creado: TS },
    ];
    for (const tz of ['America/Bogota', 'UTC']) {
      assert.strictEqual(conReloj(MS, tz, () => panel.pedidosHoyDe(pedidos, 'R')), 2, 'a las 8 p. m., en ' + tz);
      assert.strictEqual(conReloj(Date.parse('2026-09-20T23:30:00-05:00'), tz, () => panel.pedidosHoyDe(pedidos, 'R')), 2, 'a las 11:30 p. m., en ' + tz);
      assert.strictEqual(conReloj(Date.parse('2026-09-21T08:00:00-05:00'), tz, () => panel.pedidosHoyDe(pedidos, 'R')), 0, 'al día siguiente, en ' + tz);
    }
    assert.notStrictEqual(panel.fechaTxt(TS), '—', 'la ficha pinta «—» en la fecha de un domicilio');
    assert.strictEqual(panel.fechaTxt(TS), panel.fechaTxt(ISO), 'el mismo instante se pinta igual en los dos formatos');
    assert.strictEqual(panel.fechaTxt(null), '—');
  });

  it('Corte de caja: a las 8 p. m. de Colombia, «hoy» sigue siendo hoy y el cierre cae hoy', () => {
    const caja = laCaja(null);
    for (const tz of ['America/Bogota', 'UTC']) {
      conReloj(MS, tz, () => {
        assert.strictEqual(caja.hoy(), '2026-09-20', '«hoy», en ' + tz);
        assert.strictEqual(caja.diaDelCierre({ fechaCierre: ISO }), '2026-09-20', 'el día del cierre, en ' + tz);
        assert.strictEqual(caja.diaDelCierre({ fechaCierre: new Date(MS - 12 * 3600000).toISOString() }), '2026-09-20', 'el de la mañana, en ' + tz);
      });
    }
  });

  it('cada convertidor de aliados y de la app, sacado de su archivo, lee los dos formatos igual', () => {
    const { msDeFecha, diaEnColombiaDe } = cargarDeLaApp(ALIADOS);
    const fmPedidos = unaLinea('guajirago-aliados/src/PedidosDomicilio.js', 'fechaMs', { msDeFecha });
    const fmHistorial = unaLinea('guajirago-aliados/src/HistorialDomicilios.js', 'fechaMs', { msDeFecha });
    const aFecha = unaLinea('guajirago-aliados/src/ResumenDia.js', 'aFecha', { msDeFecha });
    const msDesde = unaLinea('guajirago-aliados/src/Mesero.js', 'msDesde', { msDeFecha });
    const segundosDesde = unaLinea('guajirago-aliados/src/Mesero.js', 'segundosDesde', { msDesde });
    for (const v of [ISO, TS]) {
      assert.strictEqual(fmPedidos({ creado: v }), MS, 'PedidosDomicilio');
      assert.strictEqual(fmHistorial({ creado: v }), MS, 'HistorialDomicilios');
      assert.strictEqual(aFecha(v).getTime(), MS, 'ResumenDia');
      assert.strictEqual(msDesde(v, 0), MS, 'Mesero');
      assert.strictEqual(segundosDesde(v, MS + 90000), 90, 'Mesero: el reloj de la mesa');
    }
    // Un pedido de mesa recién enviado, sin la hora del servidor todavía: cuenta desde «ahora», no desde 1970.
    assert.strictEqual(segundosDesde(null, MS), 0);
    assert.strictEqual(fmPedidos({}), 0);
    assert.strictEqual(aFecha(undefined), null);
    assert.strictEqual(diaEnColombiaDe(TS), '2026-09-20');

    // «Mis pedidos» de la app: el más nuevo arriba, mezclando formatos; el que aún no tiene hora del servidor, primero.
    const t = leer('guajirago/src/Restaurantes.js').replace(/\r\n/g, '\n');
    const m = t.match(/const lista = \[\.\.\.misPedidos\]\.sort\(([\s\S]*?\n {4}\})\);/);
    assert.ok(m, 'no encuentro el orden de «Mis pedidos» en guajirago/src/Restaurantes.js');
    // eslint-disable-next-line no-new-func
    const comparar = new Function('msDeFecha', 'return ' + m[1] + ';')(cargarDeLaApp(APP).msDeFecha);
    const lista = [
      { id: 'viejo', creado: new Date(MS - 3600000).toISOString() },
      { id: 'pendiente', creado: null },
      { id: 'nuevo', creado: TS },
    ].sort(comparar).map((p) => p.id);
    assert.deepStrictEqual(lista, ['pendiente', 'nuevo', 'viejo']);
  });

  it('las ganancias del conductor leen el día con la misma pieza (también un Timestamp)', () => {
    const GAN = cargarDeLaApp('guajirago/src/gananciasConductor.js');
    assert.strictEqual(GAN.diaEnColombia(TS), '2026-09-20');
    assert.strictEqual(GAN.diaEnColombia(ISO), '2026-09-20');
    assert.match(leer('guajirago/src/gananciasConductor.js'), /return diaEnColombiaDe\(fecha\);/);
  });

  it('los dos que crean un pedido escriben `creado` con la hora del servidor, y Mesero la estima mientras llega', () => {
    const conCreado = [];
    for (const ruta of ['guajirago/src/Restaurantes.js', 'guajirago-aliados/src/Mesero.js']) {
      const t = leer(ruta).replace(/\r\n/g, '\n');
      const bloques = [...t.matchAll(/addDoc\(collection\(db, 'pedidos'\), \{([\s\S]*?)\n\s*\}\);/g)];
      assert.ok(bloques.length >= 1, 'no encuentro el addDoc de pedidos en ' + ruta);
      for (const b of bloques) {
        const linea = (b[1].match(/\n\s*creado: ([^\n]*),/) || [])[1];
        conCreado.push(ruta + ' → ' + linea);
        assert.strictEqual(linea, 'serverTimestamp()', ruta + ' escribe `creado` como ' + linea);
      }
    }
    assert.strictEqual(conCreado.length, 2, 'son dos los que crean pedidos: ' + conCreado.join(' | '));
    assert.match(leer('guajirago-aliados/src/Mesero.js'), /d\.data\(\{ serverTimestamps: 'estimate' \}\)/,
      'Mesero tiene que leer sus pedidos con la hora estimada mientras llega la del servidor');
  });
});
