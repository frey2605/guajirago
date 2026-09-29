// ═══════════════════════════════════════════════════════════════════════════
//  «¿QUÉ PASÓ CON ESTE VIAJE?» — UNA SOLA TABLA DE PALABRAS PARA CADA FINAL · gemelo G56, 29-sep-2026
//
//  Cada final del viaje se decía con TRES tablas: `comoTermino` de la app (guajirago/src/estadosViaje.js), el
//  `etiquetaEstado` de 🚕 Viajes del panel y el `NOMBRE_DEL_FINAL` de 📦 Mensajería del panel. Las dos del panel, del
//  MISMO mandado, decían cosas distintas: «Cancelado por pasajero» y «Lo canceló el cliente», «Finalizado» y
//  «Entregado», «Cancelado por conductor» y «Lo soltó el repartidor» (10 de los 12 mandados de producción, medido con
//  scripts/medir-que-paso.cjs). Y ninguna tarjeta enseñaba el porqué con que el sistema cierra un viaje
//  (`motivoExpiracion`): leían `razonCancelacion`, que el sistema no escribe.
//
//  Ahora: `comoTermino(viaje, 'panel')` en la pieza y en su copia atada del panel; las dos pantallas del panel la usan,
//  y las cuatro tarjetas enseñan su `porque`. Aquí se EJECUTA todo: la pieza, la copia, y la etiqueta y el renglón del
//  porqué de cada pantalla, sacados de sus archivos.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const { lasPantallas, medir } = require('../scripts/medir-que-paso.cjs');

const APP = cargarDeLaApp('guajirago/src/estadosViaje.js');
const PANEL = cargarDeLaApp('guajirago-admin/src/estadosViaje.js');
const P = lasPantallas(null, null);

const FINALES = APP.ESTADOS_TERMINADOS;
const ESTADOS = [...APP.ESTADOS_EN_CURSO, ...FINALES, 'algo_nuevo', undefined];
const TIPOS = ['Taxi', 'Mototaxi', 'Mensajería', undefined];
const PORQUES = [{}, { razonCancelacion: 'Ya no lo necesito' }, { motivoExpiracion: 'lo aceptaron hace 61 min' },
  { razonCancelacion: 'R', motivoExpiracion: 'M' }, { razonCancelacion: '   ', motivoExpiracion: '  ' },
  { motivoExpiracion: 42 }];
const casos = () => {
  const lista = [];
  for (const estado of ESTADOS) for (const tipo of TIPOS) for (const x of PORQUES) lista.push({ estado, tipo, ...x });
  return lista;
};

describe('G56 · «qué pasó» con cada final sale de UNA tabla (comoTermino), también en el panel', () => {
  it('la copia del panel dice lo mismo que la pieza de la app, EJECUTADAS con cada final, tipo y porqué', () => {
    assert.deepStrictEqual(PANEL.FINAL_EN_PALABRAS, APP.FINAL_EN_PALABRAS, 'las tablas de palabras se separaron');
    assert.deepStrictEqual(PANEL.ESTADOS_QUE_CIERRA_EL_SERVIDOR, APP.ESTADOS_QUE_CIERRA_EL_SERVIDOR);
    for (const v of casos()) {
      for (const quien of ['pasajero', 'conductor', 'panel', 'otro', 'constructor']) {
        assert.deepStrictEqual(PANEL.comoTermino(v, quien), APP.comoTermino(v, quien),
          'la copia del panel dice otra cosa de ' + JSON.stringify(v) + ' mirando «' + quien + '»');
      }
      assert.strictEqual(PANEL.quienManeja(v), APP.quienManeja(v));
    }
    assert.deepStrictEqual(PANEL.comoTermino(null, 'panel'), APP.comoTermino(null, 'panel'));
  });

  it('el panel habla en tercera persona, uno solo por final, y el mandado dice «repartidor» por su tipo', () => {
    const panel = (estado, tipo) => APP.comoTermino({ estado, tipo }, 'panel').texto;
    assert.strictEqual(panel('cancelado', 'Taxi'), 'Lo canceló el cliente');
    assert.strictEqual(panel('cancelado', 'Mensajería'), 'Lo canceló el cliente');
    assert.strictEqual(panel('cancelado_conductor', 'Taxi'), 'Lo canceló el conductor');
    assert.strictEqual(panel('cancelado_conductor', 'Mensajería'), 'Lo canceló el repartidor');
    assert.strictEqual(panel('vencido'), 'Nadie lo tomó');
    assert.strictEqual(panel('expirado'), 'Quedó sin terminar');
    assert.strictEqual(panel('finalizado'), 'Completado');
    for (const e of FINALES) {
      for (const tipo of TIPOS) {
        assert.ok(!/\btú\b|\{/.test(panel(e, tipo)), 'el panel no habla de «tú» ni deja marcas sin llenar: ' + panel(e, tipo));
      }
    }
    // Y lo que ya decían la app del pasajero y la del conductor no cambia (el tipo solo entra en el panel).
    assert.strictEqual(APP.comoTermino({ estado: 'cancelado_conductor', tipo: 'Mensajería' }, 'pasajero').texto,
      'Lo canceló el conductor');
    assert.strictEqual(APP.comoTermino({ estado: 'cancelado', tipo: 'Mensajería' }, 'conductor').texto,
      'Lo canceló el cliente');
  });

  it('el porqué: el del sistema si lo cerró el sistema, el de la persona si lo cancelaron', () => {
    const pq = (v) => APP.comoTermino(v, 'panel').porque;
    assert.strictEqual(pq({ estado: 'expirado', motivoExpiracion: ' lleva 61 min ' }), 'lleva 61 min');
    assert.strictEqual(pq({ estado: 'vencido', motivoExpiracion: 'nadie lo tomó en 20 min' }), 'nadie lo tomó en 20 min');
    assert.strictEqual(pq({ estado: 'cancelado', razonCancelacion: 'Ya no lo necesito', motivoExpiracion: 'X' }),
      'Ya no lo necesito', 'una cancelación de persona enseña su razón, no un motivo del sistema');
    assert.strictEqual(pq({ estado: 'expirado', razonCancelacion: 'R' }), 'R', 'sin motivo del sistema, lo que haya');
    assert.strictEqual(pq({ estado: 'expirado' }), '');
    assert.strictEqual(pq({ estado: 'finalizado', razonCancelacion: 'R' }), '');
  });

  it('EL QUE MUERDE · 🚕 Viajes y 📦 Mensajería, sacadas de sus archivos, dicen de cada final lo que dice comoTermino', () => {
    for (const v of casos().filter((x) => FINALES.includes(x.estado))) {
      const fin = APP.comoTermino(v, 'panel');
      const via = P.viajes(v);
      assert.deepStrictEqual([via.texto, via.color, via.porque], [fin.texto, fin.color, fin.porque],
        '🚕 Viajes dice otra cosa de ' + JSON.stringify(v));
      const men = P.mensajeria(v);
      assert.deepStrictEqual([men.t, men.c, men.porque], [fin.texto, fin.color, fin.porque],
        '📦 Mensajería dice otra cosa de ' + JSON.stringify(v));
    }
    // Y los vivos siguen como estaban (no son finales: no pasan por la tabla).
    assert.strictEqual(P.viajes({ estado: 'esperando' }).texto, 'Esperando conductor');
    assert.strictEqual(P.mensajeria({ estado: 'esperando' }).t, 'Buscando');
    assert.strictEqual(P.mensajeria({ estado: 'algo_nuevo' }).t, 'algo_nuevo');
  });

  it('EL QUE MUERDE · las cuatro tarjetas enseñan el porqué del sistema y la razón de las personas', () => {
    const cerrado = { estado: 'expirado', tipo: 'Mensajería', motivoExpiracion: 'lo aceptaron hace 61 min' };
    const cancelado = { estado: 'cancelado', tipo: 'Mensajería', razonCancelacion: 'Ya no lo necesito' };
    const hecho = { estado: 'finalizado', tipo: 'Mensajería', razonCancelacion: 'vieja' };
    for (const [nombre, r] of Object.entries(P.porque)) {
      assert.ok(r, nombre + ': no encuentro el renglón del porqué');
      assert.strictEqual(r.ver(cerrado), 'lo aceptaron hace 61 min', nombre + ' no enseña el porqué del sistema');
      assert.strictEqual(r.ver(cancelado), 'Ya no lo necesito', nombre + ' no enseña la razón de quien canceló');
      assert.strictEqual(r.ver(hecho), '', nombre + ' enseña una razón en un viaje completado');
    }
    assert.strictEqual(Object.keys(P.porque).length, 5, 'faltan tarjetas por mirar (4 de historial/mensajería + el detalle)');
  });

  it('ninguna pantalla vuelve a escribir las palabras de un final a mano', () => {
    const textos = new Set(Object.values(APP.FINAL_EN_PALABRAS).flatMap((t) => Object.values(t)));
    for (const viejo of ['Cancelado por pasajero', 'Cancelado por conductor', 'Lo soltó el repartidor', 'Finalizado']) {
      textos.add(viejo);
    }
    for (const a of ['guajirago-admin/src/Viajes.js', 'guajirago-admin/src/Mensajeria.js', 'guajirago/src/AppConductor.js',
      'guajirago/src/Home.js', 'guajirago/src/MisViajes.js']) {
      const t = soloCodigo(leer(a));
      for (const x of textos) {
        assert.ok(!t.includes("'" + x + "'") && !t.includes('"' + x + '"'), a + ' escribe a mano «' + x + '»');
      }
      assert.ok(!/\b(NOMBRE_DEL_FINAL|FINAL_EN_PALABRAS|comoTermino)\s*=/.test(t) && !/function\s+comoTermino\b/.test(t),
        a + ' declara su propia tabla o su propia comoTermino, que tapa a la de la pieza');
    }
    for (const [a, quien] of [['guajirago-admin/src/Viajes.js', 'panel'], ['guajirago-admin/src/Mensajeria.js', 'panel']]) {
      assert.match(soloCodigo(leer(a)), new RegExp("comoTermino\\([^)]*'" + quien + "'\\)"), a + " no llama comoTermino(…, 'panel')");
    }
  });

  it('el medidor no se ablanda: con el código de ANTES (app 434d536, panel 862a143) ve las dos tablas y el porqué mudo', () => {
    const antes = medir([], lasPantallas('434d536', '862a143'));
    assert.deepStrictEqual(antes.finalesConDosTextos, ['finalizado', 'cancelado', 'cancelado_conductor']);
    for (const [n, x] of Object.entries(antes.porque)) assert.strictEqual(x.ejemplo, false, n + ': el medidor no vio el porqué mudo');
    const hoy = medir([], P);
    assert.deepStrictEqual(hoy.finalesConDosTextos, []);
    for (const [n, x] of Object.entries(hoy.porque)) assert.strictEqual(x.ejemplo, true, n);
  });
});
