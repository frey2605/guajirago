// ═══════════════════════════════════════════════════════════════════════════
//  ¿CUÁNTO GANÉ HOY? UNA SOLA CUENTA · gemelo G23, 28-sep-2026
//
//  El recuadro «GANANCIAS DE HOY» del historial (AppConductor.js) y la tarjeta HOY de la pantalla Ganancias
//  (Ganancias.js) sumaban cada uno a su manera: el historial solo entre los 50 viajes más recientes y con el día del
//  teléfono (`toDateString`); Ganancias con todos y desde la medianoche del teléfono. Ahora las dos piden y cuentan
//  con guajirago/src/gananciasConductor.js, en días de COLOMBIA.
//
//  Aquí se prueba EJECUTANDO:
//    1. la pieza (día de Colombia en cualquier zona, semana que empieza el domingo, mes, fechas raras, el futuro);
//    2. la consulta: sin tope y desde el principio del periodo más largo;
//    3. el trozo de CADA pantalla, sacado de su archivo y corrido contra un Firestore de mentira que aplica los
//       filtros: las dos dicen lo mismo, en cualquier zona, y el historial ya no depende de su tope de 50.
//    4. el medidor (scripts/medir-ganancias-hoy.cjs) cuenta bien con viajes de mentira.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo } = require('./cargar.cjs');

const GAN = cargarDeLaApp('guajirago/src/gananciasConductor.js');
const PROMO = cargarDeLaApp('guajirago/src/reglaPromocion.js');
const ZONAS = ['UTC', 'America/Bogota', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
const codigo = (ruta) => soloCodigo(leer(ruta)).replace(/\r\n/g, '\n');

function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}
async function enZonaAsync(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return await fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}
// Un instante dicho en hora de Colombia: col('2026-10-07T20:00').
const col = (s) => new Date(s + ':00-05:00');
const RealDate = Date;
const relojEn = (t) => class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(t.getTime()); }
  static now() { return t.getTime(); }
};
const fin = (cuando, tarifaValor, extra = {}) => ({ estado: 'finalizado', tarifaValor, tipo: 'Taxi',
  conductorId: 'c1', fechaSolicitud: col(cuando).toISOString(), ...extra });

// Miércoles 7 de octubre de 2026, 9 de la noche en Colombia (en UTC ya es el 8).
const AHORA = col('2026-10-07T21:00');
const VIAJES = [
  fin('2026-10-07T20:30', 10000),                         // hoy, de noche: en UTC ya es mañana
  fin('2026-10-07T00:10', 5000),                          // hoy, recién pasada la medianoche de Colombia
  fin('2026-10-06T23:50', 7000),                          // ayer a las 11:50 p. m.: en UTC ya es hoy
  fin('2026-10-04T08:00', 3000),                          // el domingo: abre la semana
  fin('2026-10-03T08:00', 2000),                          // el sábado: semana pasada, pero este mes
  fin('2026-09-30T08:00', 1000),                          // el mes pasado
  fin('2026-10-08T08:00', 9000),                          // mañana: un reloj adelantado no cuenta para hoy
  fin('2026-10-07T10:00', 4000, { estado: 'cancelado' }), // no se ganó
  fin('2026-10-07T10:00', 0, { fechaSolicitud: 'no es una fecha' }),
];

describe('¿CUÁNTO GANÉ HOY? · una sola cuenta para el historial y la pantalla Ganancias (G23)', () => {
  it('la pieza cuenta hoy, la semana (desde el domingo) y el mes en días de Colombia, en cualquier zona', () => {
    for (const tz of ZONAS) {
      enZona(tz, () => {
        const r = GAN.resumenDeGanancias(VIAJES, AHORA, {});
        assert.deepStrictEqual(r.hoy, { total: 15000, viajes: 2, comision: 1600 }, 'hoy en ' + tz);
        assert.deepStrictEqual(r.semana, { total: 25000, viajes: 4, comision: 3200 }, 'semana en ' + tz);
        assert.deepStrictEqual(r.mes, { total: 27000, viajes: 5, comision: 4000 }, 'mes en ' + tz);
        assert.strictEqual(GAN.diaEnColombia('2026-10-08T01:30:00.000Z'), '2026-10-07', 'en ' + tz);
      });
    }
    assert.strictEqual(GAN.diaEnColombia('no es una fecha'), null);
    assert.strictEqual(GAN.diaEnColombia(undefined), null);
    // La comisión es la que el viaje GUARDA que se le cobró, y la config manda sobre el respaldo.
    assert.strictEqual(GAN.resumenDeGanancias([fin('2026-10-07T10:00', 8000, { comisionCobrada: 350 })], AHORA).hoy.comision, 350);
    assert.strictEqual(GAN.resumenDeGanancias([fin('2026-10-07T10:00', 8000)], AHORA, { comisionTaxi: 900 }).hoy.comision, 900);
  });

  it('el día sale de hoyEnColombia (la pieza de las promociones), no de una segunda cuenta', () => {
    const t = codigo('guajirago/src/gananciasConductor.js');
    assert.match(t, /^import \{ hoyEnColombia \} from '\.\/reglaPromocion';$/m);
    assert.ok(!/getTimezoneOffset|toDateString|getHours|3600000|getDate\(\)/.test(t),
      'gananciasConductor.js hace su propia cuenta de la hora: tiene que pedírsela a hoyEnColombia');
    for (let t2 = Date.parse('2026-01-01T00:00:00Z'); t2 < Date.parse('2026-01-03T00:00:00Z'); t2 += 1800000) {
      assert.strictEqual(GAN.diaEnColombia(new Date(t2).toISOString()), PROMO.hoyEnColombia(new Date(t2)));
    }
  });

  it('los periodos cruzan bien el cambio de mes, y la consulta lee desde el más largo', () => {
    // Viernes 2 de octubre: la semana empezó el domingo 27 de septiembre, antes que el mes.
    const p = GAN.periodosDeGanancias(col('2026-10-02T12:00'));
    assert.deepStrictEqual(p, { hoy: '2026-10-02', semana: '2026-09-27', mes: '2026-10-01' });
    assert.strictEqual(GAN.desdeCuandoSeLee(col('2026-10-02T12:00')), '2026-09-27T05:00:00.000Z');
    assert.strictEqual(GAN.desdeCuandoSeLee(AHORA), '2026-10-01T05:00:00.000Z');
    // Un domingo, la semana es ese mismo día.
    assert.strictEqual(GAN.periodosDeGanancias(col('2026-10-04T23:59')).semana, '2026-10-04');
    const r = GAN.resumenDeGanancias([fin('2026-09-28T08:00', 1000)], col('2026-10-02T12:00'), {});
    assert.strictEqual(r.semana.total, 1000);
    assert.strictEqual(r.mes.total, 0);
  });

  it('la consulta pide los finalizados del conductor desde el principio del periodo, SIN tope', () => {
    const fs = {
      collection: (db, nombre) => ({ db, nombre }),
      where: (campo, op, valor) => ({ campo, op, valor }),
      query: (c, ...filtros) => ({ c, filtros }),
    };
    const q = GAN.consultaDeGanancias(fs, 'DB', 'c1', AHORA);
    assert.deepStrictEqual(q, { c: { db: 'DB', nombre: 'viajes' }, filtros: [
      { campo: 'conductorId', op: '==', valor: 'c1' },
      { campo: 'estado', op: '==', valor: 'finalizado' },
      { campo: 'fechaSolicitud', op: '>=', valor: '2026-10-01T05:00:00.000Z' },
    ] });
  });

  // ── Las dos pantallas, EJECUTADAS contra un Firestore de mentira que aplica los filtros ──
  const OPS = { '==': (a, b) => a === b, '>=': (a, b) => typeof a === 'string' && a >= b };
  function firestoreDeMentira(datos) {
    const pedidas = [];
    return {
      pedidas,
      collection: (db, nombre) => ({ nombre }),
      where: (campo, op, valor) => ({ campo, op, valor }),
      query: (c, ...filtros) => ({ c, filtros }),
      getDocs: async (q) => {
        pedidas.push(q);
        let docs = datos.filter((v) => q.filtros.every((f) => !f.campo || OPS[f.op](v[f.campo], f.valor)));
        const tope = q.filtros.find((f) => f.tope);
        if (tope) docs = docs.slice(0, tope.tope);
        return { docs: docs.map((v) => ({ id: v.id, data: () => ({ ...v }) })) };
      },
      limit: (n) => ({ tope: n }),
      orderBy: () => ({}),
    };
  }

  /** El trozo de la pantalla desde `const ahora = new Date();` hasta el renglón que termina en `fin`. */
  function trozo(texto, fin, donde) {
    const d = texto.indexOf('const ahora = new Date();');
    assert.ok(d >= 0, donde + ': no está «const ahora = new Date();»');
    const h = texto.indexOf(fin, d);
    assert.ok(h >= 0, donde + ': no está «' + fin + '» después de «const ahora»');
    return texto.slice(d, texto.indexOf('\n', h));
  }

  async function correrPantalla(pantalla, datos, ahora, tz) {
    const fsm = firestoreDeMentira(datos);
    const salida = {};
    const nombres = ['Date', 'getDocs', 'collection', 'query', 'where', 'db', 'user', 'consultaDeGanancias',
      'resumenDeGanancias', 'cfgComisiones', 'setTotalHoy', 'setHoy', 'setSemana', 'setMes'];
    const valores = [relojEn(ahora), fsm.getDocs, fsm.collection, fsm.query, fsm.where, 'DB', { uid: 'c1' },
      GAN.consultaDeGanancias, GAN.resumenDeGanancias, { comisionTaxi: 900 }, (n) => { salida.hoy = n; }, (h) => { salida.hoy = h.total; salida.comision = h.comision; },
      (s) => { salida.semana = s.total; }, (m) => { salida.mes = m.total; }];
    // eslint-disable-next-line no-new-func
    const f = new Function(...nombres, 'return (async () => {\n' + pantalla + '\n})();');
    await enZonaAsync(tz, () => f(...valores));
    return { ...salida, pedidas: fsm.pedidas };
  }

  // Cada «set» de las ganancias aparece UNA sola vez en la pantalla: si hubiera otro después del trozo que se corre
  // (una segunda cuenta a mano), ése pisaría al bueno y la prueba no lo vería.
  const unaVez = (cuerpo, donde, nombres) => {
    for (const n of nombres) {
      assert.strictEqual(cuerpo.split(n + '(').length - 1, 1, donde + ': «' + n + '(» tiene que aparecer una sola vez');
    }
  };
  const HISTORIAL = (() => {
    const t = codigo('guajirago/src/AppConductor.js');
    const d = t.indexOf('function HistorialConductor(');
    assert.ok(d >= 0, 'AppConductor.js ya no tiene HistorialConductor');
    const cuerpo = cuerpoDeLaFuncion(t, d).texto;
    unaVez(cuerpo, 'HistorialConductor', ['setTotalHoy']);
    return trozo(cuerpo, 'setTotalHoy(', 'HistorialConductor');
  })();
  const GANANCIAS = (() => {
    const t = codigo('guajirago/src/Ganancias.js');
    const d = t.indexOf('function Ganancias(');
    assert.ok(d >= 0, 'Ganancias.js ya no tiene la función Ganancias');
    const cuerpo = cuerpoDeLaFuncion(t, d).texto;
    unaVez(cuerpo, 'Ganancias', ['setHoy', 'setSemana', 'setMes']);
    return trozo(cuerpo, 'setMes(', 'Ganancias');
  })();

  it('las dos pantallas dicen LO MISMO que la pieza, con el teléfono en cualquier zona', async () => {
    const datos = VIAJES.map((v, i) => ({ id: 'v' + i, ...v }));
    for (const tz of ZONAS) {
      const h = await correrPantalla(HISTORIAL, datos, AHORA, tz);
      const g = await correrPantalla(GANANCIAS, datos, AHORA, tz);
      assert.strictEqual(h.hoy, 15000, 'el recuadro del historial en ' + tz);
      assert.strictEqual(g.hoy, 15000, 'la tarjeta HOY de Ganancias en ' + tz);
      assert.strictEqual(g.comision, 1800, 'la tarjeta HOY de Ganancias no cobra con la comisión de config/global en ' + tz);
      assert.strictEqual(g.semana, 25000, 'la tarjeta ESTA SEMANA de Ganancias en ' + tz);
      assert.strictEqual(g.mes, 27000, 'la tarjeta ESTE MES de Ganancias en ' + tz);
    }
  });

  it('el recuadro del historial no depende del tope de 50 de su lista', async () => {
    // Dos viajes cobrados por la mañana y, después, 55 viajes cancelados: la lista del historial (los 50 más
    // recientes) ya no trae los dos cobrados, pero el recuadro los sigue contando.
    const datos = [fin('2026-10-07T08:00', 6000), fin('2026-10-07T09:00', 6000)];
    for (let i = 0; i < 55; i++) datos.push(fin('2026-10-07T1' + (i % 10) + ':' + String(10 + (i % 40)).padStart(2, '0'), 5000, { estado: 'cancelado' }));
    const conId = datos.map((v, i) => ({ id: 'v' + i, ...v }));
    const h = await correrPantalla(HISTORIAL, conId, AHORA, 'America/Bogota');
    assert.strictEqual(h.hoy, 12000, 'el recuadro del historial depende del tope de su lista');
    const deGanancias = h.pedidas.filter((q) => q.filtros.some((f) => f.campo === 'estado'));
    assert.strictEqual(deGanancias.length, 1, 'el historial no pide sus ganancias con su propia consulta');
    assert.ok(!deGanancias[0].filtros.some((f) => f.tope), 'la consulta de ganancias lleva tope');
  });

  it('ninguna de las dos pantallas vuelve a contar «hoy» por su cuenta', () => {
    for (const [nombre, t] of [['AppConductor.js', HISTORIAL], ['Ganancias.js', GANANCIAS]]) {
      assert.ok(!/toDateString|inicioHoy|getFullYear|fechaSolicitud|valorDelViaje|\.reduce\(/.test(t),
        nombre + ' vuelve a hacer su propia cuenta de las ganancias');
    }
  });

  it('el medidor careado cuenta lo que decía cada pantalla (scripts/medir-ganancias-hoy.cjs)', () => {
    const { carear } = require('../scripts/medir-ganancias-hoy.cjs');
    const c = carear([
      { ...fin('2026-10-07T20:30', 10000), conductorId: 'c1' },
      { ...fin('2026-10-07T10:00', 5000), conductorId: 'c1' },
      { ...fin('2026-10-07T10:00', 5000), conductorId: 'c2', fechaSolicitud: 'no es fecha' },
    ], GAN);
    assert.strictEqual(c.filas.length, 1);
    const f = c.filas[0];
    assert.deepStrictEqual([f.dia, f.historialCol, f.gananciasCol, f.unica], ['2026-10-07', 15000, 15000, 15000]);
    // Con el teléfono en UTC, a las 23:59 de Colombia ya es «mañana»: las dos de antes solo contaban el viaje de las
    // 8:30 p. m. (que en UTC ya cae mañana) y perdían el de las 10 a. m.
    assert.deepStrictEqual([f.historialUtc, f.gananciasUtc], [10000, 10000]);
    assert.strictEqual(c.noIso, 1);
  });
});
