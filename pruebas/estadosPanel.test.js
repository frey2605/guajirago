// ═══════════════════════════════════════════════════════════════════════════
//  LOS ESTADOS DEL VIAJE EN EL PANEL, DE UNA SOLA COPIA ATADA · gemelo G25, 28-sep-2026
//
//  El panel (otro repo) llevaba sus listas de estados escritas a mano en cada pantalla, y tres se habían quedado
//  cortas. Medido con scripts/medir-estados-panel.cjs en producción (92 viajes): el tablero y la ficha del pasajero
//  no contaban los 9 `expirado` como cancelados (67 en vez de 76), el buscador de Viajes.js no ofrecía `aceptado`,
//  `vencido` ni `expirado` (9 viajes que no se podían buscar por su estado), y el «EN CURSO» del tablero miraba la
//  FASE sin mirar si el viaje seguía vivo (7 viajes muertos contaban como en curso).
//
//  Ahora el panel tiene UNA copia (guajirago-admin/src/estadosViaje.js) y aquí se prueba, EJECUTANDO el código:
//    · la copia dice lo mismo que la fuente (guajirago/src/estadosViaje.js);
//    · cada pantalla del panel, sacada de su archivo y corrida viaje por viaje, pone cada viaje donde dice la fuente;
//    · ninguna pantalla vuelve a escribir una lista a mano.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const { lasDecisiones, contar, textosDe, ARCHIVOS } = require('../scripts/medir-estados-panel.cjs');

const APP = cargarDeLaApp('guajirago/src/estadosViaje.js');
const PANEL = cargarDeLaApp('guajirago-admin/src/estadosViaje.js');
const PANTALLAS = ['App.js', 'Pasajeros.js', 'Viajes.js', 'Mensajeria.js', 'Conductores.js'];
const codigo = (nombre) => soloCodigo(leer('guajirago-admin/src/' + nombre)).replace(/\r\n/g, '\n');

// Un viaje de cada estado, los muertos con la fase pegada (así quedan al cancelar o expirar en marcha), y los mismos
// como mandado.
const TODOS = [...APP.ESTADOS_EN_CURSO, ...APP.ESTADOS_TERMINADOS];
const VIAJES = [];
for (const estado of TODOS) {
  for (const fase of [undefined, 'en_punto', 'en_viaje']) {
    VIAJES.push({ id: estado + '-' + fase, estado, fase });
    VIAJES.push({ id: 'm-' + estado + '-' + fase, estado, fase, tipo: 'Mensajería' });
  }
}

describe('LOS ESTADOS DEL VIAJE EN EL PANEL · una sola copia atada (G25)', () => {
  it('la copia del panel dice lo mismo que la fuente de la app', () => {
    for (const k of ['ESTADOS_MERCADO', 'ESTADOS_EN_CURSO', 'ESTADOS_TERMINADOS']) {
      assert.deepStrictEqual(PANEL[k], APP[k], 'la copia del panel se separó de la app en ' + k);
    }
    assert.deepStrictEqual(PANEL.NO_COMPLETADOS, APP.ESTADOS_TERMINADOS.filter((e) => e !== 'finalizado'),
      'NO_COMPLETADOS del panel no es «los finales menos finalizado»');
    assert.deepStrictEqual(PANEL.TODOS_LOS_ESTADOS, TODOS, 'TODOS_LOS_ESTADOS del panel se dejó un estado fuera');
    assert.ok(PANEL.ESTADOS_EN_CURSO.length > 0 && PANEL.NO_COMPLETADOS.length > 0,
      'una lista vacía revienta el `where(... in ...)` de Firestore');
  });

  it('las pantallas del panel, corridas viaje por viaje, ponen cada viaje donde dice la fuente', () => {
    const d = lasDecisiones(textosDe(null));
    const c = contar(VIAJES, d, APP);
    const ids = (x) => x.mal.map((v) => v.id);
    assert.deepStrictEqual(ids(c.tableroCancelados), [], 'el tablero (App.js) cuenta mal los cancelados');
    assert.deepStrictEqual(ids(c.tableroEnCurso), [], 'el «EN CURSO» del tablero (App.js) cuenta mal');
    assert.deepStrictEqual(ids(c.fichaCancelados), [], 'la ficha del pasajero (Pasajeros.js) cuenta mal los cancelados');
    assert.deepStrictEqual(c.buscador.faltan, [], 'al buscador de Viajes.js le faltan estados');
    assert.deepStrictEqual([...c.buscador.opciones].sort(), [...TODOS].sort(), 'el buscador ofrece algo que no es un estado');
    assert.deepStrictEqual(c.pestanas.mal.map((v) => v.id), [], 'hay viajes sin pestaña, o en dos, en Viajes.js');
    assert.deepStrictEqual(c.mandados.mal.map((v) => v.id), [], 'Mensajería pone mandados en la caja equivocada');
    // Y que de verdad se haya corrido algo: sin viajes en cada caja, «0 mal» no dice nada.
    assert.strictEqual(c.tableroCancelados.cuenta, 12 * 2, 'el tablero no contó los 4 finales x 3 fases x 2');
    assert.strictEqual(c.tableroEnCurso.cuenta, 2 * 3 * 2, 'el tablero no contó los 2 vivos x 3 fases x 2');
    assert.strictEqual(c.mandados.total, TODOS.length * 3);
  });

  it('ninguna pantalla del panel escribe una lista de estados a mano: importan la copia', () => {
    const esEstado = new RegExp("['\"](" + TODOS.join('|') + ")['\"]");
    // Las únicas comparaciones sueltas que quedan: `finalizado` (completado es UNO, y tiene su propia caja) y el
    // nombre de la opción «Con conductor» del desplegable de Viajes.js.
    const PERMITIDAS = { 'Viajes.js': ['aceptado'] };
    for (const nombre of PANTALLAS) {
      const t = codigo(nombre);
      const listas = [...t.matchAll(/\[[^\]\n]*\]/g)].map((m) => m[0]).filter((l) => esEstado.test(l));
      assert.deepStrictEqual(listas, [], nombre + ' vuelve a escribir una lista de estados a mano');
      const comparados = [...t.matchAll(new RegExp("[!=]==?\\s*['\"](" + TODOS.join('|') + ")['\"]|['\"]("
        + TODOS.join('|') + ")['\"]\\s*[!=]==?", 'g'))].map((m) => m[1] || m[2]);
      const sobran = [...new Set(comparados)].filter((e) => e !== 'finalizado' && !(PERMITIDAS[nombre] || []).includes(e));
      assert.deepStrictEqual(sobran, [], nombre + ' compara a mano con estados que tienen su lista en la copia: '
        + sobran.join(', '));
      const opciones = [...t.matchAll(/<option\s+value="([^"]+)"/g)].map((m) => m[1]).filter((v) => TODOS.includes(v));
      assert.deepStrictEqual(opciones, [], nombre + ' escribe opciones de estado a mano');
      for (const k of Object.keys(PANEL)) {
        assert.ok(!new RegExp('\\bconst\\s+' + k + '\\s*=').test(t),
          nombre + ' declara su propia `' + k + '`, que tapa a la de la copia');
      }
    }
    for (const [nombre, usa] of [['App.js', ['ESTADOS_EN_CURSO', 'NO_COMPLETADOS']], ['Pasajeros.js', ['NO_COMPLETADOS']],
      ['Viajes.js', ['ESTADOS_EN_CURSO', 'NO_COMPLETADOS', 'TODOS_LOS_ESTADOS']],
      ['Mensajeria.js', ['ESTADOS_MERCADO', 'ESTADOS_EN_CURSO', 'NO_COMPLETADOS']]]) {
      const imp = new RegExp("^import \\{([^}]*)\\} from '\\./estadosViaje';$", 'm').exec(codigo(nombre));
      assert.ok(imp, nombre + ' no importa la copia de los estados (./estadosViaje)');
      const traidos = imp[1].split(',').map((s) => s.trim());
      for (const u of usa) assert.ok(traidos.includes(u), nombre + ' no trae ' + u + ' de la copia');
    }
  });

  it('el medidor no se ablanda: con cada lista vieja puesta, la pantalla sale mal', () => {
    // Las formas de ANTES del 28-sep-2026, una por pantalla, puestas sobre el código de hoy.
    const MENTIRAS = [
      ['App.js', 'NO_COMPLETADOS.includes(v.estado) && enRango', "(v.estado === 'cancelado' || v.estado === 'cancelado_conductor') && enRango", 'tableroCancelados'],
      ['App.js', 'ESTADOS_EN_CURSO.includes(v.estado) && fechaEnCurso', "(v.estado === 'aceptado' || v.fase === 'en_viaje' || v.fase === 'en_punto') && fechaEnCurso", 'tableroEnCurso'],
      ['Pasajeros.js', 'viajesPas.filter(v => NO_COMPLETADOS.includes(v.estado))', "viajesPas.filter(v => v.estado === 'cancelado' || v.estado === 'cancelado_conductor')", 'fichaCancelados'],
      ['Viajes.js', 'const noCompleto = (v) => NO_COMPLETADOS.includes(v.estado);', "const NO_COMPLETADOS = ['cancelado', 'cancelado_conductor', 'vencido'];\n  const noCompleto = (v) => NO_COMPLETADOS.includes(v.estado);", 'pestanas'],
      ['Mensajeria.js', 'const esCancelado = (e) => NO_COMPLETADOS.includes(e);', "const esCancelado = (e) => ['cancelado', 'vencido'].includes(e);", 'mandados'],
    ];
    for (const [archivo, bueno, malo, donde] of MENTIRAS) {
      const textos = textosDe(null);
      assert.ok(ARCHIVOS.includes(archivo));
      const t = textos[archivo].replace(/\r\n/g, '\n');
      assert.strictEqual(t.split(bueno).length, 2, 'la mentira de ' + archivo + ' no calza una vez: «' + bueno + '»');
      textos[archivo] = t.replace(bueno, malo);
      const c = contar(VIAJES, lasDecisiones(textos), APP);
      assert.ok(c[donde].mal.length > 0, 'el medidor no vio la lista vieja de ' + archivo + ' (' + donde + ')');
    }
  });
});
