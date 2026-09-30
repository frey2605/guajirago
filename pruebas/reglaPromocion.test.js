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
const { leer, cargarDeLaApp, cuerpoDeLaFuncion, copiaIdentica } = require('./cargar.cjs');

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
  return t.slice(a, b).replace(/^export (function|const) /gm, '$1 ');
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
  it('el trozo entre las marcas es igual en los tres archivos, y las dos copias son idénticas', () => {
    const nube = { nombre: 'el trozo de ' + NUBE_RUTA, texto: trozo(NUBE_RUTA) };
    copiaIdentica({ nombre: 'el trozo de ' + APP_RUTA, texto: trozo(APP_RUTA) }, nube, 'la copia de la APP se separó de la regla del servidor');
    copiaIdentica({ nombre: 'el trozo de ' + PANEL_RUTA, texto: trozo(PANEL_RUTA) }, nube, 'la copia del PANEL se separó de la regla del servidor');
    copiaIdentica(PANEL_RUTA, APP_RUTA, 'las copias de la app y del panel no son iguales');
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
    assert.match(f, /import \{ motivoPorLaPromocion(, valorDelBeneficio, textoDelBeneficio, categoriaDePromocion)? \} from '\.\/reglaPromocion';/, 'la app no importa la copia de la regla');
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
  // G17: y la receta del uso (pesosDelUso, apunteDeLaPersona, apunteEnLaPromocion).
  // G52: y el texto del beneficio y las categorías (textoDelBeneficio, CATEGORIAS_PROMOCION, categoriaDePromocion).
  assert.match(f, /import \{ motivoParaNoUsar(, etapaDeVigencia)?(, pesosDelUso, apunteDeLaPersona, apunteEnLaPromocion)?(, textoDelBeneficio, CATEGORIAS_PROMOCION, categoriaDePromocion)? \} from '\.\/reglaPromocion';/, 'el panel no importa la copia de la regla');
  const desde = f.indexOf('const asignarPromoManual');
  assert.ok(desde >= 0, 'no está asignarPromoManual');
  const cuerpo = cuerpoDeLaFuncion(f, desde).texto;
  const NOMBRES = ['db', 'getDocs', 'query', 'collection', 'where', 'doc', 'runTransaction', 'motivoParaNoUsar', 'pesosDelUso', 'apunteDeLaPersona', 'apunteEnLaPromocion',
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
    PANEL.pesosDelUso, PANEL.apunteDeLaPersona, PANEL.apunteEnLaPromocion,
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

// ══ G17 · «SE USÓ ESTA PROMOCIÓN, Y COSTÓ TANTOS PESOS» — UNA SOLA RECETA (28-sep-2026) ══
// El servidor (consumirDescuentoViaje) y el panel (asignar a mano) apuntaban el uso cada uno a su manera, y el panel
// sumaba al «Invertido» el valorBeneficio: con una de porcentaje, un 20 % entraba como $20. Ahora los dos apuntan con
// pesosDelUso / apunteDeLaPersona / apunteEnLaPromocion (promociones.cjs y sus copias, dentro de las marcas).
const PCT = (extra) => PROMO({ tipoBeneficio: 'descuento', valorBeneficio: 20, ...extra });
const CASOS_PESOS = [
  [PROMO(), undefined], [PCT(), undefined], [PCT(), 3000], [PROMO(), 8000], [PCT(), '3000'], [PCT(), -5], [PCT(), NaN],
  [PROMO({ valorBeneficio: undefined }), undefined], [PROMO({ valorBeneficio: '5000' }), undefined], [null, undefined], [{}, 0],
];

describe('G17 · la receta del uso es UNA, y las tres copias dicen lo mismo', () => {
  it('pesosDelUso: sin viaje, solo el crédito cuesta pesos; un porcentaje NO es plata', () => {
    assert.strictEqual(NUBE.pesosDelUso(PROMO()), 8000);
    assert.strictEqual(NUBE.pesosDelUso(PCT()), null, 'un 20 % se tomó por $20');
    assert.strictEqual(NUBE.pesosDelUso(PCT(), 3000), 3000, 'con viaje, el costo es lo que se le descontó al viaje');
    assert.strictEqual(NUBE.pesosDelUso(PCT(), '3000'), null);
    assert.strictEqual(NUBE.pesosDelUso(PCT(), -5), null);
  });

  it('apunteEnLaPromocion suma PESOS y revienta si le dan otra cosa', () => {
    const p = PCT({ usosTotales: 4, inversionTotal: 32000, historialUsos: [{ usuarioId: 'x', fecha: 'f', valor: 32000 }] });
    const a = NUBE.apunteEnLaPromocion(p, 'ana', '2026-09-28T10:00:00.000Z', 3000);
    assert.strictEqual(a.usosTotales, 5);
    assert.strictEqual(a.inversionTotal, 35000);
    assert.deepStrictEqual(a.historialUsos[1], { usuarioId: 'ana', fecha: '2026-09-28T10:00:00.000Z', valor: 3000 });
    assert.throws(() => NUBE.apunteEnLaPromocion(p, 'ana', 'f', NUBE.pesosDelUso(p)), /no está en pesos/);
    assert.throws(() => NUBE.apunteEnLaPromocion(p, 'ana', 'f', '20'), /no está en pesos/);
    assert.deepStrictEqual(NUBE.apunteDeLaPersona({ veces: 2, nombreUsuario: 'Ana' }, 'f'), { veces: 3, ultimaFecha: 'f' });
    assert.deepStrictEqual(NUBE.apunteDeLaPersona(null, 'f'), { veces: 1, ultimaFecha: 'f' });
  });

  it('la app y el panel, ejecutados, dan lo mismo que el servidor', () => {
    for (const [p, d] of CASOS_PESOS) {
      const args = d === undefined ? [p] : [p, d];
      assert.strictEqual(PANEL.pesosDelUso(...args), NUBE.pesosDelUso(...args), 'panel ≠ servidor con ' + JSON.stringify([p, d]));
      assert.strictEqual(APP.pesosDelUso(...args), NUBE.pesosDelUso(...args));
      const pesos = NUBE.pesosDelUso(...args);
      if (pesos === null) {
        assert.throws(() => PANEL.apunteEnLaPromocion(p, 'u', 'f', pesos));
      } else {
        assert.deepStrictEqual(PANEL.apunteEnLaPromocion(p, 'u', 'f', pesos), NUBE.apunteEnLaPromocion(p, 'u', 'f', pesos));
      }
      assert.deepStrictEqual(PANEL.apunteDeLaPersona(p, 'f'), NUBE.apunteDeLaPersona(p, 'f'));
    }
  });

  it('nadie más suma usos o «Invertido» a mano, en las tres apps ni en el servidor', () => {
    const fsn = require('node:fs'); const pathn = require('node:path');
    const RAIZ = pathn.resolve(__dirname, '..');
    // G47: aliados lleva una copia IGUAL de la de la app (la pide horarioNegocio.js por hoyEnColombia); la ata
    // pruebas/pedirAhora.test.js letra por letra, así que no es una receta propia.
    const PERMITIDOS = [NUBE_RUTA, APP_RUTA, PANEL_RUTA, 'guajirago-aliados/src/reglaPromocion.js'];
    const culpables = [];
    const recorrer = (dir) => {
      for (const e of fsn.readdirSync(pathn.join(RAIZ, dir), { withFileTypes: true })) {
        const rel = dir + '/' + e.name;
        if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'build') recorrer(rel); continue; }
        if (!/\.(c?js)$/.test(e.name) || PERMITIDOS.includes(rel)) continue;
        const t = fsn.readFileSync(pathn.join(RAIZ, rel), 'utf8');
        if (/inversionTotal\s*:\s*\(|usosTotales\s*:\s*\(|historialUsos\s*:\s*\[/.test(t)) culpables.push(rel);
      }
    };
    for (const d of ['guajirago/src', 'guajirago/functions', 'guajirago-admin/src', 'guajirago-aliados/src']) recorrer(d);
    assert.deepStrictEqual(culpables, [], 'estos archivos apuntan el uso de una promoción con su propia receta');
  });
});

describe('G17 · el panel y el servidor apuntan con la receta, ejecutándolos', () => {
  const vigente = (extra) => ({ ...PROMO(), fechaInicio: '2020-01-01', fechaFin: '2099-12-31', ...extra });

  it('el panel: una de crédito suma sus pesos al «Invertido», con el crédito y el uso de la persona', async () => {
    const r = await asignar(vigente({ usosTotales: 4, inversionTotal: 32000, historialUsos: [] }), { id: 'ana', tipo: '', nombre: 'Ana' }, [],
      { 'promociones/P/usos/ana': { veces: 0 } });
    assert.strictEqual(r.ok, true, JSON.stringify(r.aviso));
    assert.strictEqual(r.base['usuarios/ana'].creditos, 9000);
    assert.strictEqual(r.base['promociones/P'].inversionTotal, 40000);
    assert.strictEqual(r.base['promociones/P'].usosTotales, 5);
    assert.strictEqual(r.base['promociones/P'].historialUsos[0].valor, 8000);
    assert.strictEqual(r.base['promociones/P/usos/ana'].veces, 1);
    assert.strictEqual(r.base['promociones/P/usos/ana'].nombreUsuario, 'Ana');
  });

  it('el panel: una de PORCENTAJE no suma nada al «Invertido» (antes: un 20 % entraba como $20)', async () => {
    const r = await asignar(vigente({ tipoBeneficio: 'descuento', valorBeneficio: 20, inversionTotal: 32000 }), { id: 'ana', tipo: '', nombre: 'Ana' }, []);
    assert.match(r.aviso?.texto || '', /porcentaje/);
    assert.strictEqual(r.base['promociones/P'].inversionTotal, 32000, 'sumó un porcentaje como si fueran pesos');
  });

  // La analítica de consumirDescuentoViaje (va APARTE del cobro), sacada del archivo y ejecutada con una base de mentira.
  function laAnaliticaDelServidor() {
    const idx = leer('guajirago/functions/index.js');
    const desde = idx.indexOf('exports.consumirDescuentoViaje');
    assert.ok(desde >= 0);
    const fn = cuerpoDeLaFuncion(idx, desde).texto;
    assert.match(fn, /t\.set\(refUso, apunteDeLaPersona\(usoPrevio, fechaUso\), \{ merge: true \}\)/,
      'el servidor no apunta el uso de la persona con la receta');
    const i = fn.indexOf('if (resultado.promoId && resultado.pasajeroId)');
    assert.ok(i >= 0, 'no está la analítica del servidor');
    const bloque = cuerpoDeLaFuncion(fn, i).texto;
    // eslint-disable-next-line no-new-func
    return new Function('db', 'resultado', 'apunteEnLaPromocion', 'pesosDelUso', 'console', 'return (async () => {' + bloque + '})();');
  }
  async function analitica(promo, resultado) {
    const base = { 'promociones/P': promo };
    const errores = [];
    const db = {
      collection: (c) => ({ doc: (id) => ({ ruta: c + '/' + id }) }),
      runTransaction: async (fn) => {
        const pend = [];
        await fn({ get: async (ref) => ({ exists: base[ref.ruta] !== undefined, data: () => base[ref.ruta] }),
          update: (ref, d) => pend.push([ref.ruta, d]) });
        for (const [r, d] of pend) base[r] = { ...base[r], ...d };
      },
    };
    await laAnaliticaDelServidor()(db, resultado, NUBE.apunteEnLaPromocion, NUBE.pesosDelUso, { error: (...a) => errores.push(a.join(' ')) });
    return { promo: base['promociones/P'], errores };
  }

  it('el servidor: un 20 % sobre un viaje de $15.000 suma $3.000 al «Invertido», no $20', async () => {
    const r = await analitica(PCT({ usosTotales: 1, inversionTotal: 1000, historialUsos: [] }),
      { promoId: 'P', pasajeroId: 'ana', fechaUso: 'f', monto: 3000 });
    assert.strictEqual(r.promo.inversionTotal, 4000);
    assert.strictEqual(r.promo.usosTotales, 2);
    assert.deepStrictEqual(r.promo.historialUsos, [{ usuarioId: 'ana', fecha: 'f', valor: 3000 }]);
  });

  it('el servidor: si lo descontado no es un número de pesos, NO suma y lo anota (el cobro ya se hizo)', async () => {
    const r = await analitica(PCT({ usosTotales: 1, inversionTotal: 1000 }), { promoId: 'P', pasajeroId: 'ana', fechaUso: 'f', monto: '3000' });
    assert.strictEqual(r.promo.inversionTotal, 1000, 'sumó algo que no son pesos');
    assert.strictEqual(r.promo.usosTotales, 1);
    assert.strictEqual(r.errores.length, 1, 'no lo anotó');
  });
});
