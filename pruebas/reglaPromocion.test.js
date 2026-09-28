/**
 * G12 · ¿PUEDE ESTA PERSONA USAR ESTA PROMOCIÓN? — UNA SOLA REGLA (28-sep-2026)
 *
 * Tres sitios lo decidían con reglas distintas: el servidor no miraba los «viajes previos», el panel no miraba
 * si la promoción estaba encendida ni sus fechas, y la app tenía su propia lista de condiciones. Ahora la regla
 * vive en guajirago/functions/promociones.cjs y la app y el panel llevan una COPIA (no pueden importarla).
 *
 *   1. El trozo entre las marcas es IGUAL en los tres archivos, y las copias son iguales byte a byte.
 *   2. Las tres se EJECUTAN con los mismos casos y dicen lo mismo.
 *   3. Los casos del hallazgo: pasajero nuevo con una promoción que pide viajes; promoción vencida o apagada.
 *   4. La app y el panel USAN la copia: la lista de la app y el botón «Asignar» del panel se EJECUTAN (sacados del
 *      archivo) contra una base de mentira. El servidor encendido de verdad lo prueba pruebas/funciones.test.js.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion } = require('./cargar.cjs');

const NUBE_RUTA = 'guajirago/functions/promociones.cjs';
const APP_RUTA = 'guajirago/src/reglaPromocion.js';
const PANEL_RUTA = 'guajirago-admin/src/reglaPromocion.js';
const NUBE = require('../' + NUBE_RUTA);
const APP = cargarDeLaApp(APP_RUTA);
const PANEL = cargarDeLaApp(PANEL_RUTA);

const MARCA_A = '// ── LA REGLA';
const MARCA_B = '// ── FIN DE LA REGLA ──';
function trozo(ruta) {
  const t = leer(ruta).replace(/\r\n/g, '\n');
  const a = t.indexOf(MARCA_A);
  const b = t.indexOf(MARCA_B);
  assert.ok(a >= 0 && b > a, 'no están las marcas de la regla en ' + ruta);
  return t.slice(a, b).replace(/^export function /gm, 'function ');
}

const HOY = new Date('2026-09-28T15:00:00');
const PROMO = (extra) => ({
  activa: true, fechaInicio: '2026-09-01', fechaFin: '2026-09-30', aplicaA: 'ambos',
  tipoBeneficio: 'credito', valorBeneficio: 8000, limiteUsosPorPersona: 1, viajesMinimosRequeridos: 0, ...extra,
});

const PROMOS = [
  PROMO(), PROMO({ activa: false }), PROMO({ fechaFin: '2026-09-27' }), PROMO({ fechaInicio: '2026-09-29' }),
  PROMO({ aplicaA: 'pasajeros' }), PROMO({ aplicaA: 'conductores' }), PROMO({ limiteUsosPorPersona: null }),
  PROMO({ viajesMinimosRequeridos: 3 }), PROMO({ viajesMinimosRequeridos: '2' }), PROMO({ tipoBeneficio: 'descuento' }),
  undefined, null, {},
];
const PERSONAS = [
  { esConductor: false, usosPrevios: 0, viajesCompletados: 0 },
  { esConductor: true, usosPrevios: 0, viajesCompletados: 5 },
  { esConductor: false, usosPrevios: 1, viajesCompletados: 3 },
  { esConductor: false, usosPrevios: 0, viajesCompletados: 2 },
  { esConductor: false, usosPrevios: 0 },
  undefined,
];
const MOMENTOS = [HOY, new Date('2026-09-30T23:00:00'), new Date('2026-10-01T00:30:00'), new Date('2026-08-31T23:59:00')];

describe('G12 · la regla de la promoción es UNA, en el servidor, la app y el panel', () => {
  it('el trozo entre las marcas es igual en los tres archivos, y las dos copias son iguales byte a byte', () => {
    const nube = trozo(NUBE_RUTA);
    assert.strictEqual(trozo(APP_RUTA), nube, 'la copia de la APP se separó de la regla del servidor');
    assert.strictEqual(trozo(PANEL_RUTA), nube, 'la copia del PANEL se separó de la regla del servidor');
    assert.strictEqual(leer(APP_RUTA), leer(PANEL_RUTA), 'las copias de la app y del panel no son iguales');
  });

  it('las tres dicen lo mismo con los mismos casos, ejecutándolas', () => {
    let n = 0;
    for (const p of PROMOS) for (const q of PERSONAS) for (const t of MOMENTOS) {
      const esperado = p == null ? { codigo: 'inactiva' } : NUBE.motivoParaNoUsar(p, q, t);
      assert.deepStrictEqual(NUBE.motivoParaNoUsar(p, q, t), esperado);
      assert.deepStrictEqual(APP.motivoParaNoUsar(p, q, t), NUBE.motivoParaNoUsar(p, q, t), 'app ≠ servidor con ' + JSON.stringify([p, q]));
      assert.deepStrictEqual(PANEL.motivoParaNoUsar(p, q, t), NUBE.motivoParaNoUsar(p, q, t), 'panel ≠ servidor con ' + JSON.stringify([p, q]));
      const m = NUBE.motivoParaNoUsar(p, q, t);
      assert.strictEqual(APP.textoParaQuienLaUsa(m), NUBE.textoParaQuienLaUsa(m));
      n++;
    }
    assert.strictEqual(n, PROMOS.length * PERSONAS.length * MOMENTOS.length);
  });
});

describe('G12 · los casos del hallazgo, con la regla del servidor', () => {
  const pasajero = (viajes, usos = 0) => ({ esConductor: false, usosPrevios: usos, viajesCompletados: viajes });

  it('un pasajero NUEVO no puede usar una promoción que pide 3 viajes; con 3, sí', () => {
    assert.deepStrictEqual(NUBE.motivoParaNoUsar(PROMO({ viajesMinimosRequeridos: 3 }), pasajero(0), HOY),
      { codigo: 'faltan-viajes', minimos: 3, tiene: 0 });
    assert.deepStrictEqual(NUBE.motivoParaNoUsar(PROMO({ viajesMinimosRequeridos: 3 }), pasajero(2), HOY),
      { codigo: 'faltan-viajes', minimos: 3, tiene: 2 });
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ viajesMinimosRequeridos: 3 }), pasajero(3), HOY), null);
    assert.strictEqual(NUBE.textoParaQuienLaUsa({ codigo: 'faltan-viajes', minimos: 3, tiene: 0 }),
      'Esta promoción es para quien ya tiene 3 viajes completados. Llevas 0');
  });

  it('si pide viajes y nadie los contó, NO se deja (quien llama tiene que contarlos)', () => {
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ viajesMinimosRequeridos: 1 }), { esConductor: false, usosPrevios: 0 }, HOY).codigo, 'faltan-viajes');
    // Y si no pide viajes, no hace falta contarlos.
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO(), { esConductor: false, usosPrevios: 0 }, HOY), null);
  });

  it('vencida, que no ha empezado o apagada: no se usa', () => {
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ fechaFin: '2026-09-27' }), pasajero(9), HOY).codigo, 'fuera-de-fecha');
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ fechaInicio: '2026-09-29' }), pasajero(9), HOY).codigo, 'fuera-de-fecha');
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ activa: false }), pasajero(9), HOY).codigo, 'inactiva');
  });

  it('lo que ya se miraba sigue igual: tipo de cuenta y tope por persona, con las palabras de siempre', () => {
    assert.deepStrictEqual(NUBE.motivoParaNoUsar(PROMO({ aplicaA: 'conductores' }), pasajero(0), HOY), { codigo: 'otro-tipo', aplicaA: 'conductores' });
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ aplicaA: 'pasajeros' }), { esConductor: true, usosPrevios: 0, viajesCompletados: 0 }, HOY).codigo, 'otro-tipo');
    assert.deepStrictEqual(NUBE.motivoParaNoUsar(PROMO(), pasajero(0, 1), HOY), { codigo: 'limite', limite: 1 });
    assert.strictEqual(NUBE.motivoParaNoUsar(PROMO({ limiteUsosPorPersona: null }), pasajero(0, 7), HOY), null);
    assert.strictEqual(NUBE.textoParaQuienLaUsa({ codigo: 'fuera-de-fecha' }), 'Esta promoción ya no está disponible');
    assert.strictEqual(NUBE.textoParaQuienLaUsa({ codigo: 'otro-tipo' }), 'Esta promoción no aplica para tu tipo de cuenta');
    assert.strictEqual(NUBE.textoParaQuienLaUsa({ codigo: 'limite' }), 'Ya usaste esta promoción el máximo de veces permitido');
  });
});

describe('G12 · el servidor decide con la regla', () => {
  it('reclamarPromocion llama a motivoParaNoUsar con los viajes contados, y la importa de promociones.cjs', () => {
    const idx = leer('guajirago/functions/index.js');
    assert.match(idx, /require\('\.\/promociones\.cjs'\)/, 'index.js no importa la regla');
    const desde = idx.indexOf('exports.reclamarPromocion');
    assert.ok(desde >= 0);
    const cuerpo = cuerpoDeLaFuncion(idx, desde).texto;
    assert.match(cuerpo, /motivoParaNoUsar\(promo, \{ esConductor, usosPrevios, viajesCompletados \}/,
      'el canje no le pasa a la regla la promoción, el tipo, los usos y los viajes contados');
    assert.match(cuerpo, /viajesCompletados = snapViajes\.size/, 'el canje no cuenta los viajes');
    assert.match(cuerpo, /where\("estado", "==", "finalizado"\)/, 'el canje cuenta viajes que no están completados');
  });
});

// ── LA APP: la lista de ofertas, sacada del archivo y ejecutada ──
describe('G12 · la lista de ofertas de la app usa la regla', () => {
  it('filtra con motivoPorLaPromocion, y deja fuera la vencida, la apagada y la de otro tipo de cuenta', () => {
    const f = leer('guajirago/src/Promociones.js').replace(/\r\n/g, '\n');
    assert.match(f, /import \{ motivoPorLaPromocion \} from '\.\/reglaPromocion';/, 'la app no importa la copia de la regla');
    const m = f.match(/\.filter\((p => !motivoPorLaPromocion\(p, tipo === 'conductor', ahora\))\)/);
    assert.ok(m, 'la lista de la app no filtra con la regla');
    // eslint-disable-next-line no-new-func
    const filtro = new Function('motivoPorLaPromocion', 'tipo', 'ahora', 'return ' + m[1] + ';');
    const lista = [PROMO(), PROMO({ activa: false }), PROMO({ fechaFin: '2026-09-27' }), PROMO({ aplicaA: 'conductores' })];
    assert.strictEqual(lista.filter(filtro(APP.motivoPorLaPromocion, '', HOY)).length, 1);
    assert.strictEqual(lista.filter(filtro(APP.motivoPorLaPromocion, 'conductor', HOY)).length, 2);
  });
});

// ── EL PANEL: el botón «Asignar», sacado del archivo y ejecutado contra una base de mentira ──
function elBotonAsignar() {
  const f = leer('guajirago-admin/src/Promociones.js');
  // G16: el panel también pide de ahí `etapaDeVigencia` (las pestañas Activas/Próximas/Vencidas).
  assert.match(f, /import \{ motivoParaNoUsar(, etapaDeVigencia)? \} from '\.\/reglaPromocion';/, 'el panel no importa la copia de la regla');
  const desde = f.indexOf('const asignarPromoManual');
  assert.ok(desde >= 0, 'no está asignarPromoManual');
  const cuerpo = cuerpoDeLaFuncion(f, desde).texto;
  const NOMBRES = ['db', 'getDocs', 'query', 'collection', 'where', 'doc', 'runTransaction', 'motivoParaNoUsar',
    'promoAsignar', 'usuarioAsignar', 'setErrorAsignar', 'setAsignando', 'setAviso', 'setAsignadoOk', 'cargarPromos'];
  // eslint-disable-next-line no-new-func
  return new Function(...NOMBRES, 'return (async () => {' + cuerpo + '})();');
}

async function asignar(promo, usuario, viajes, usos = {}) {
  const base = { 'promociones/P': promo ? { ...promo } : undefined, ...usos };
  if (usuario) base['usuarios/' + usuario.id] = { creditos: 1000 };
  const salida = { aviso: null, error: '', ok: false };
  const fs = {
    db: {},
    collection: (_db, c) => ({ c }),
    where: (campo, _op, valor) => ({ campo, valor }),
    query: (col, ...w) => ({ col: col.c, w }),
    getDocs: async (q) => ({ size: viajes.filter((v) => q.w.every((x) => v[x.campo] === x.valor)).length }),
    doc: (_db, ...seg) => ({ ruta: seg.join('/') }),
    runTransaction: async (_db, fn) => {
      const pendientes = [];
      const tx = {
        get: async (ref) => ({ exists: () => base[ref.ruta] !== undefined, data: () => base[ref.ruta] }),
        set: (ref, d) => pendientes.push([ref.ruta, d]),
        update: (ref, d) => pendientes.push([ref.ruta, d]),
      };
      await fn(tx);
      for (const [r, d] of pendientes) base[r] = { ...(base[r] || {}), ...d };
    },
  };
  await elBotonAsignar()(fs.db, fs.getDocs, fs.query, fs.collection, fs.where, fs.doc, fs.runTransaction, PANEL.motivoParaNoUsar,
    { id: 'P', ...promo }, usuario, (e) => { salida.error = e; }, () => {}, (a) => { salida.aviso = a; }, (v) => { salida.ok = v; }, () => {});
  return { ...salida, base };
}

describe('G12 · el panel no asigna lo que la regla no deja, y lo dice en ventanita', () => {
  const vigente = (extra) => ({ ...PROMO(), fechaInicio: '2020-01-01', fechaFin: '2099-12-31', ...extra });
  const pasajero = { id: 'ana', tipo: '', nombre: 'Ana' };

  it('una promoción VENCIDA no se asigna: ventanita, y ni saldo ni uso', async () => {
    const r = await asignar(vigente({ fechaFin: '2020-01-02' }), pasajero, []);
    assert.ok(r.aviso, 'no salió ventanita');
    assert.match(r.aviso.texto, /fuera de sus fechas/);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.base['usuarios/ana'].creditos, 1000, 'le dio el crédito de una promoción vencida');
    assert.strictEqual(r.base['promociones/P/usos/ana'], undefined, 'contó un uso');
  });

  it('una promoción APAGADA no se asigna', async () => {
    const r = await asignar(vigente({ activa: false }), pasajero, []);
    assert.match(r.aviso?.texto || '', /desactivada/);
    assert.strictEqual(r.base['usuarios/ana'].creditos, 1000);
  });

  it('una de PORCENTAJE no se asigna a mano (antes contaba un uso sin darle nada)', async () => {
    const r = await asignar(vigente({ tipoBeneficio: 'descuento', valorBeneficio: 10 }), pasajero, []);
    assert.match(r.aviso?.texto || '', /porcentaje/);
    assert.strictEqual(r.base['promociones/P/usos/ana'], undefined, 'contó un uso de una promoción de porcentaje');
    assert.strictEqual(r.base['promociones/P'].usosTotales, undefined);
  });

  it('sin los viajes previos no se asigna, y cuenta solo los finalizados de esa persona', async () => {
    const viajes = [
      { pasajeroId: 'ana', estado: 'finalizado' }, { pasajeroId: 'ana', estado: 'cancelado' },
      { pasajeroId: 'otro', estado: 'finalizado' },
    ];
    const r = await asignar(vigente({ viajesMinimosRequeridos: 2 }), pasajero, viajes);
    assert.match(r.aviso?.texto || '', /al menos 2 viajes completados \(tiene 1\)/);
    assert.strictEqual(r.base['usuarios/ana'].creditos, 1000);
  });

  it('el tope por persona sigue funcionando, ahora en ventanita', async () => {
    const r = await asignar(vigente(), pasajero, [], { 'promociones/P/usos/ana': { veces: 1 } });
    assert.match(r.aviso?.texto || '', /límite de usos/);
  });

  it('y la que SÍ vale se asigna como siempre: crédito, uso y contador', async () => {
    const r = await asignar(vigente({ viajesMinimosRequeridos: 1 }), pasajero, [{ pasajeroId: 'ana', estado: 'finalizado' }]);
    assert.strictEqual(r.aviso, null, 'salió una ventanita con una promoción válida: ' + JSON.stringify(r.aviso));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.base['usuarios/ana'].creditos, 9000);
    assert.strictEqual(r.base['promociones/P/usos/ana'].veces, 1);
    assert.strictEqual(r.base['promociones/P'].usosTotales, 1);
  });

  it('a un conductor le cuenta los viajes como CONDUCTOR', async () => {
    const cond = { id: 'leo', tipo: 'conductor', nombre: 'Leo' };
    const viajes = [{ conductorId: 'leo', estado: 'finalizado' }, { conductorId: 'leo', estado: 'finalizado' }, { pasajeroId: 'leo', estado: 'finalizado' }];
    const r = await asignar(vigente({ viajesMinimosRequeridos: 3 }), cond, viajes);
    assert.match(r.aviso?.texto || '', /tiene 2/);
    const r2 = await asignar(vigente({ viajesMinimosRequeridos: 2 }), cond, viajes);
    assert.strictEqual(r2.ok, true);
  });
});
