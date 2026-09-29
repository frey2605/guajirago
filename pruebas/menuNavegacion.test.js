/**
 * «MIS VIAJES» Y «GANANCIAS» ABREN LO QUE DICE UNA TABLA — gemelo G51 (29-sep-2026)
 *
 * Hasta ese día «Mis viajes» abría TRES pantallas distintas según desde dónde se tocara (la de los dos lados desde las
 * pantallas de antes de escoger papel, la del pasajero desde su menú, la del conductor desde el suyo), y «Ganancias»
 * contestaba «estará disponible muy pronto» en el menú del pasajero aunque la pantalla existe. Medido con
 * `scripts/medir-menu-navegacion.cjs`: 13 de 41 combinaciones no abrían lo que toca, y 3 «personas» (opción + papel)
 * veían dos pantallas distintas.
 *
 * Ahora lo decide `pantallaDelMenu` (guajirago/src/navegacionMenu.js) según QUIÉN ES la persona. Esta prueba no lee los
 * botones como texto: con el lector del medidor (que se importa, no se copia) SACA lo que hace cada botón, lo EJECUTA,
 * y corre la cadena de pantallas de ese archivo para ver cuál se abre de verdad.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cargarDeLaApp } = require('./cargar.cjs');
const {
  ENTRADAS, OPCIONES, PAPELES, COMPONENTE, TABLA, medir, loQueAbre,
} = require('../scripts/medir-menu-navegacion.cjs');

const { pantallaDelMenu, PANTALLA_DEL_MENU } = cargarDeLaApp(TABLA);
const CLAVES = new Set(Object.values(COMPONENTE));

describe('G51 · la tabla de navegación del menú', () => {
  it('EL QUE MUERDE · según quién sea: pasajero → su historial, conductor → el suyo, sin papel → los dos lados', () => {
    assert.strictEqual(pantallaDelMenu('viajes', 'pasajero'), 'historialPasajero');
    assert.strictEqual(pantallaDelMenu('viajes', 'conductor'), 'historialConductor');
    assert.strictEqual(pantallaDelMenu('viajes', ''), 'misViajes');
    assert.strictEqual(pantallaDelMenu('viajes', undefined), 'misViajes');
  });

  it('EL QUE MUERDE · «Ganancias» abre la pantalla Ganancias para todos: nunca «muy pronto»', () => {
    for (const papel of PAPELES) assert.strictEqual(pantallaDelMenu('ganancias', papel), 'ganancias');
  });

  it('cada casilla de la tabla nombra una pantalla que existe; una opción que no conoce da null', () => {
    for (const [opcion, fila] of Object.entries(PANTALLA_DEL_MENU)) {
      assert.deepStrictEqual(Object.keys(fila).sort(), ['conductor', 'pasajero', 'sinPapel'], opcion);
      for (const v of Object.values(fila)) assert.ok(CLAVES.has(v), opcion + ' → «' + v + '» no es ninguna pantalla');
    }
    assert.strictEqual(pantallaDelMenu('otra', 'pasajero'), null);
  });
});

describe('G51 · cada botón abre lo que dice la tabla (corriéndolo)', () => {
  it('EL QUE MUERDE · todas las entradas, con cada papel posible, abren la pantalla de la tabla', () => {
    const filas = medir();
    assert.ok(filas.length >= 41, 'esperaba al menos 41 combinaciones, salieron ' + filas.length);
    const malas = filas.filter((f) => f.abre !== pantallaDelMenu(f.opcion, f.papel));
    assert.deepStrictEqual(malas.map((f) => f.entrada + ' · ' + f.opcion + ' · ' + (f.papel || 'sin papel') + ' → ' + f.abre), [],
      'estos botones no abren lo que dice navegacionMenu.js');
  });

  it('EL QUE MUERDE · para la misma persona, todas las entradas abren LA MISMA pantalla', () => {
    const porPersona = {};
    for (const f of medir()) (porPersona[f.opcion + '|' + f.papel] = porPersona[f.opcion + '|' + f.papel] || new Set()).add(f.abre);
    for (const [k, s] of Object.entries(porPersona)) assert.strictEqual(s.size, 1, k + ' abre ' + [...s].join(' / '));
  });

  it('todo menú lateral de la app recibe «Mis viajes» y «Ganancias» (si falta uno, el menú dice «muy pronto»)', () => {
    for (const a of ['App.js', 'Home.js', 'AppConductor.js', 'Restaurantes.js', 'Turismo.js']) {
      const t = soloCodigo(leer('guajirago/src/' + a));
      const menus = [...t.matchAll(/<MenuLateral\b[\s\S]*?\/>/g)].map((m) => m[0]);
      assert.ok(menus.length > 0, a + ': no encuentro su menú lateral');
      for (const m of menus) {
        assert.ok(/\bonIrViajes=\{/.test(m), a + ': un menú lateral sin onIrViajes');
        assert.ok(/\bonIrGanancias=\{/.test(m), a + ': un menú lateral sin onIrGanancias («Ganancias» diría «muy pronto»)');
      }
    }
  });

  it('las pantallas de App.js que dan el menú son justo las que mide el lector (ninguna se queda sin mirar)', () => {
    const t = soloCodigo(leer('guajirago/src/App.js'));
    const conMenu = [...t.matchAll(/if \(screen === '(\w+)'\) return[^\n]*\bonIrViajes=/g)].map((m) => m[1]).sort();
    const medidas = ENTRADAS.filter((e) => e.archivo.endsWith('/App.js')).map((e) => /«(\w+)»/.exec(e.nombre)[1]).sort();
    assert.deepStrictEqual(conMenu, medidas);
  });

  it('nadie más abre esas pantallas por su cuenta: solo por la clave de la tabla', () => {
    for (const a of ['App.js', 'Home.js', 'AppConductor.js']) {
      const t = soloCodigo(leer('guajirago/src/' + a));
      for (const comp of Object.keys(COMPONENTE)) {
        for (const m of t.matchAll(new RegExp('if \\(([^\\n]+?)\\)\\s*\\{?\\s*return\\s*<' + comp + '\\b', 'g'))) {
          assert.ok(new RegExp("=== '" + COMPONENTE[comp] + "'$").test(m[1].trim()),
            a + ': <' + comp + '> se abre con «' + m[1] + '», no con su clave de la tabla «' + COMPONENTE[comp] + '»');
        }
      }
      assert.ok(/import \{ pantallaDelMenu \} from '\.\/navegacionMenu'/.test(t), a + ' no importa pantallaDelMenu');
    }
  });
});

// ── Y EL LECTOR NO SE PUEDE ABLANDAR ────────────────────────────────────────
//  Las pruebas de arriba se creen lo que diga el lector. Se le dan pantallas de mentira —las formas conocidas de
//  volver a separar los botones— y se exige que lo note.
describe('G51 · el lector del menú ve los escapes', () => {
  const disco = (a) => leer(a).split('\r\n').join('\n');
  const ESCAPES = [
    ['el pasajero sin «Ganancias» (vuelve el «muy pronto»)', 'guajirago/src/Home.js',
      " onIrGanancias={() => abrirDelMenu('ganancias')}", '', 'menú del pasajero', 'ganancias', 'pasajero'],
    ['App.js con el papel fijo en pasajero', 'guajirago/src/App.js',
      'pantallaDelMenu(opcion, tipoUsuario)', "pantallaDelMenu(opcion, 'pasajero')", 'menú de «modulos»', 'viajes', 'conductor'],
    ['App.js abre la de los dos lados a todos (lo de antes)', 'guajirago/src/App.js',
      "  if (verDelMenu === 'historialPasajero') return <Historial", "  if (verDelMenu === 'historialPasajero') return <MisViajes",
      'menú de «rol»', 'viajes', 'pasajero'],
    ['la tarjeta del conductor abre Ganancias', 'guajirago/src/AppConductor.js',
      "<div onClick={() => abrirDelMenu('viajes')} style=", "<div onClick={() => setVerDelMenu('ganancias')} style=",
      'tarjeta «Mis viajes» del conductor', 'viajes', 'conductor'],
    ['el conductor con el papel de pasajero', 'guajirago/src/AppConductor.js',
      "pantallaDelMenu(opcion, 'conductor')", "pantallaDelMenu(opcion, 'pasajero')", 'menú del conductor', 'viajes', 'conductor'],
    ['Home no pinta Ganancias', 'guajirago/src/Home.js',
      "if (pantalla === 'ganancias')", "if (pantalla === 'gananciasVieja')", 'menú del pasajero', 'ganancias', 'pasajero'],
  ];
  for (const [nombre, archivo, de, a, entrada, opcion, papel] of ESCAPES) {
    it(nombre, () => {
      const bueno = disco(archivo);
      assert.strictEqual(bueno.split(de).length - 1, 1, 'el escape «' + nombre + '» no encuentra su sitio en ' + archivo);
      const e = ENTRADAS.find((x) => x.nombre === entrada);
      assert.ok(e, 'no hay entrada «' + entrada + '»');
      const bien = loQueAbre(e, opcion, papel);
      assert.strictEqual(bien, pantallaDelMenu(opcion, papel));
      const mal = loQueAbre(e, opcion, papel, { textos: { [archivo]: bueno.replace(de, a) } });
      assert.notStrictEqual(mal, pantallaDelMenu(opcion, papel), '🔴 el lector NO ve el escape «' + nombre + '»');
    });
  }

  it('una tabla que importa algo no se carga a ciegas: el lector revienta en vez de inventarse la pantalla', () => {
    const e = ENTRADAS.find((x) => x.nombre === 'menú del pasajero');
    assert.throws(() => loQueAbre(e, 'viajes', 'pasajero', { textos: { [TABLA]: 'import y from "z";\nexport const x = 1;' } }));
    for (const opcion of OPCIONES) assert.ok(CLAVES.has(loQueAbre(e, opcion, 'pasajero')));
  });
});
