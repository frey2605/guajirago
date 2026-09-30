/**
 * P04 (30-sep-2026) · SI AL CONDUCTOR NO LE ALCANZA EL SALDO PARA LA COMISIÓN, EL SERVIDOR NO LO CONFIRMA
 *
 * `confirmarConductor` (guajirago/functions/index.js) cobra la comisión en la misma transacción en que le da el viaje
 * al conductor. Hasta P04 no miraba el saldo: con $500 y un taxi de $800 confirmaba y dejaba el saldo en -$300.
 * Decisión del dueño: «No dejar confirmar: si al conductor no le alcanza el saldo para la comisión, el servidor no lo
 * confirma y al pasajero le sale un aviso para escoger otra oferta. El saldo nunca queda negativo.»
 *
 *   1. EJECUTA confirmarConductor (scripts/medir-saldo-al-confirmar.cjs, con la nube de mentira): con saldo de sobra o
 *      justo confirma y cobra; con menos, lanza su frase con `motivo: 'sin_saldo'` y NO escribe nada.
 *   2. Careo con el código de antes (64fa676): con saldo que alcanza, TODO idéntico; con saldo de menos, el de antes
 *      dejaba el saldo negativo (el medidor lo ve).
 *   3. La frase del servidor, tal como la recibe el teléfono, la respeta motivoDeRechazo (avisoRechazo.js).
 *   4. EJECUTA `aceptarContraoferta` sacada de Solicitar.js con el candado de verdad: con el rechazo del servidor la
 *      ventanita dice la frase y esa oferta sale de la lista; con otros fallos la lista no se toca.
 *   5. Le da datos de mentira al medidor de producción y exige que cuente bien.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion } = require('./cargar.cjs');
const M = require('../scripts/medir-saldo-al-confirmar.cjs');

const ANTES = '64fa676';
const { motivoDeRechazo } = cargarDeLaApp('guajirago/src/avisoRechazo.js');
const { crearCandado } = cargarDeLaApp('guajirago/src/candado.js');

const alcanza = (x) => typeof x.saldoAntes === 'number' && x.saldoAntes >= x.comision;
let hoy = null;
let antes = null;
const medidas = async () => {
  if (!hoy) [hoy, antes] = await Promise.all([M.medirCodigo(null), M.medirCodigo(ANTES)]);
  return { hoy, antes };
};

/** El error tal como le llega al teléfono (firebase le pone «functions/» al código). */
const comoLlega = (error) => Object.assign(new Error(error.message), { code: 'functions/' + error.code, details: error.details });

describe('P04 · confirmarConductor EJECUTADO: sin saldo para la comisión no se confirma', () => {
  it('los casos cubren de sobra, justo y de menos', async () => {
    const { hoy: h } = await medidas();
    assert.ok(h.some((x) => x.saldoAntes === x.comision), 'falta un caso con el saldo justo');
    assert.ok(h.filter(alcanza).length >= 3 && h.filter((x) => !alcanza(x)).length >= 3);
  });

  it('con saldo que alcanza (también justo): confirma, cobra la comisión y el saldo no baja de 0', async () => {
    const { hoy: h } = await medidas();
    for (const x of h.filter(alcanza)) {
      assert.deepStrictEqual(x.respuesta, { ok: true }, x.caso);
      assert.strictEqual(x.error, null, x.caso);
      assert.strictEqual(x.saldoDespues, x.saldoAntes - x.comision, x.caso + ': no cobró la comisión exacta');
      assert.ok(x.saldoDespues >= 0, x.caso);
      assert.strictEqual(x.viaje.estado, 'aceptado', x.caso);
      assert.strictEqual(x.viaje.comisionCobrada, x.comision, x.caso);
    }
    const justo = h.find((x) => x.saldoAntes === x.comision);
    assert.strictEqual(justo.saldoDespues, 0, 'con el saldo justo se confirma y queda en 0');
  });

  it('con saldo de menos: lanza su frase con motivo sin_saldo y NO escribe nada (ni viaje, ni saldo, ni marca)', async () => {
    const { hoy: h } = await medidas();
    for (const x of h.filter((y) => !alcanza(y))) {
      assert.strictEqual(x.respuesta, null, x.caso + ': contestó en vez de rechazar');
      assert.ok(x.error, x.caso + ': no rechazó');
      assert.strictEqual(x.error.code, 'failed-precondition', x.caso);
      assert.deepStrictEqual(x.error.details, { motivo: 'sin_saldo' }, x.caso);
      assert.match(x.error.message, /Escoge otra oferta/, x.caso);
      assert.strictEqual(x.escrituras, 0, x.caso + ': escribió algo aunque rechazó');
      assert.strictEqual(x.saldoDespues, null, x.caso);
    }
  });

  it('CAREO con ' + ANTES + ': con saldo que alcanza, todo idéntico; con saldo de menos, antes quedaba negativo', async () => {
    const { hoy: h, antes: a } = await medidas();
    assert.strictEqual(h.length, a.length);
    h.forEach((x, i) => {
      if (alcanza(x)) assert.deepStrictEqual(x, a[i], x.caso + ': cambió un caso honrado');
      else assert.ok(a[i].saldoDespues < 0 && a[i].respuesta && a[i].respuesta.ok === true,
        x.caso + ': el medidor ya no ve que el código de antes dejaba el saldo negativo');
    });
  });
});

describe('P04 · el pasajero ve el aviso y la oferta sale de la lista', () => {
  it('motivoDeRechazo respeta la frase del servidor', async () => {
    const { hoy: h } = await medidas();
    const x = h.find((y) => !alcanza(y));
    const m = motivoDeRechazo(comoLlega(x.error), 'aceptar la oferta');
    assert.strictEqual(m.titulo, 'No se pudo aceptar la oferta');
    assert.strictEqual(m.texto, x.error.message, 'la ventanita no dice la frase del servidor');
  });

  // Saca `aceptarContraoferta` de Solicitar.js y la corre con el candado de verdad y un servidor de mentira.
  const fuente = leer('guajirago/src/Solicitar.js');
  const desde = fuente.indexOf('const aceptarContraoferta = async (oferta) =>');
  const cuerpo = desde >= 0 ? cuerpoDeLaFuncion(fuente, desde) : null;

  async function aceptar(servidor, contraofertas) {
    assert.ok(cuerpo, 'no encontré aceptarContraoferta en Solicitar.js');
    const avisos = [];
    const estado = { contraofertas, avisoPantalla: null, celebrando: false };
    const candado = crearCandado({ alAviso: (a) => avisos.push(a), tope: 5000 });
    const ctx = {
      viajeId: 'V1', celebrando: false, esMensajeria: false, correr: candado.correr,
      getFunctions: () => ({}),
      httpsCallable: () => servidor,
      setCelebrando: (v) => { estado.celebrando = v; },
      setContraofertas: (f) => { estado.contraofertas = typeof f === 'function' ? f(estado.contraofertas) : f; },
      contaofertasIdsRef: { current: new Set() },
      setTimeout: () => 0, setPantalla: () => {}, escucharConductor: () => {},
      setAviso: (a) => { estado.avisoPantalla = a; },
    };
    // eslint-disable-next-line no-new-func
    const fn = new Function('ctx', 'with (ctx) { return async (oferta) => {' + cuerpo.texto + '}; }')(ctx);
    await fn(contraofertas[0]);
    return { ...estado, avisos };
  }
  const OFERTAS = [{ conductorId: 'C1', conductorNombre: 'LUIS' }, { conductorId: 'C2', conductorNombre: 'ANA' }];

  it('con el rechazo del servidor: la ventanita dice la frase y la oferta de ese conductor sale de la lista', async () => {
    const { hoy: h } = await medidas();
    const x = h.find((y) => !alcanza(y));
    const r = await aceptar(async () => { throw comoLlega(x.error); }, OFERTAS);
    assert.strictEqual(r.avisos.length, 1);
    assert.strictEqual(r.avisos[0].ok, false);
    assert.strictEqual(r.avisos[0].texto, x.error.message, 'la ventanita no dice la frase del servidor');
    assert.deepStrictEqual(r.contraofertas.map((o) => o.conductorId), ['C2'], 'la oferta sin saldo sigue ofreciéndose');
    assert.strictEqual(r.celebrando, false);
  });

  it('con otro fallo (sin señal, o un error sin motivo) la lista no se toca', async () => {
    for (const e of [
      Object.assign(new Error('internal'), { code: 'functions/unavailable' }),
      Object.assign(new Error('No se pudo confirmar el conductor'), { code: 'functions/internal', details: { motivo: 'otro' } }),
    ]) {
      // eslint-disable-next-line no-await-in-loop
      const r = await aceptar(async () => { throw e; }, OFERTAS);
      assert.strictEqual(r.contraofertas.length, 2, e.code + ': quitó la oferta');
      assert.strictEqual(r.avisos[0].ok, false);
    }
  });

  it('confirmado: celebra como siempre', async () => {
    const r = await aceptar(async () => ({ data: { ok: true } }), OFERTAS);
    assert.strictEqual(r.celebrando, true);
    assert.deepStrictEqual(r.contraofertas, []);
  });
});

describe('P04 · quién escribe las ofertas (la regla de contraofertas cubre a todos)', () => {
  it('solo tres escrituras en las tres apps: la oferta del conductor, y dos que solo la retiran (vigente: false)', () => {
    const esc = M.escritoresDeOfertas();
    assert.strictEqual(esc.length, 3, 'apareció otra escritura a contraofertas: ¿pide saldo la regla para ella?\n'
      + esc.map((x) => x.archivo + ':' + x.renglon).join('\n'));
    assert.strictEqual(esc.filter((x) => /setDoc\(/.test(x.texto) && x.archivo === 'guajirago/src/AppConductor.js').length, 1);
    assert.strictEqual(esc.filter((x) => /updateDoc\(/.test(x.texto) && /vigente: false/.test(x.texto)).length, 2);
  });
});

describe('P04 · el medidor de producción cuenta bien', () => {
  it('negativos, por debajo de su comisión, y ofertas vivas que ya no se confirmarían', () => {
    const cfg = { comisionTaxi: 800, comisionMototaxi: 400, comisionDomicilio: 1000 };
    const d = M.revisarDatos({
      config: cfg,
      usuarios: [
        { id: 'A', tipo: 'conductor', tipoVehiculo: 'Taxi', creditos: 5000 },
        { id: 'B', tipo: 'conductor', tipoVehiculo: 'Taxi', creditos: -300 },
        { id: 'C', tipo: 'conductor', tipoVehiculo: 'Mototaxi', creditos: 500 },
        { id: 'D', tipo: 'conductor', tipoVehiculo: 'Mototaxi', creditos: 100 },
        { id: 'P', tipo: 'pasajero', creditos: -9 },
      ],
      viajes: [
        { id: 'V1', estado: 'esperando', tipo: 'Taxi' },
        { id: 'V2', estado: 'finalizado', tipo: 'Taxi', comisionCobrada: 800 },
        { id: 'V3', estado: 'esperando', tipo: 'Mototaxi' },
      ],
      ofertas: [
        { viajeId: 'V1', conductorId: 'A' }, { viajeId: 'V1', conductorId: 'C' },
        { viajeId: 'V3', conductorId: 'C' }, { viajeId: 'V3', conductorId: 'D', vigente: false },
        { viajeId: 'V2', conductorId: 'B' },
      ],
    });
    assert.strictEqual(d.conductores.length, 4);
    assert.deepStrictEqual(d.negativos.map((u) => u.id), ['B']);
    assert.deepStrictEqual(d.bajoSuMinimo.map((u) => u.id), ['B', 'D']);
    assert.deepStrictEqual(d.bajoTaxi.map((u) => u.id), ['B', 'C', 'D']);
    assert.strictEqual(d.cobrados.length, 1);
    assert.strictEqual(d.plataCobrada, 800);
    assert.strictEqual(d.vivas.length, 3);
    assert.deepStrictEqual(d.noAlcanzan.map((o) => o.viajeId + o.conductorId), ['V1C']);
  });
});
