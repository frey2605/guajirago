/**
 * G67 · LOS LUGARES FAVORITOS VIVEN EN UN SOLO SITIO: LA NUBE (29-sep-2026)
 *
 * Había dos: `usuarios/{uid}.favoritos` (Solicitar.js, con el tope de config/global) y el TELÉFONO,
 * `localStorage['guajirago_favoritos']` (Home.js, sin tope), que venía de junio: se leía al abrir la pantalla y no se
 * pintaba, y su ventanita «Agregar lugar favorito» no la abría nadie. Se quitó entero.
 *
 * Esta prueba:
 *   1. corre el medidor (`scripts/medir-favoritos-g67.cjs`) sobre el código de HOY de las tres apps y las funciones:
 *      nadie toca el teléfono con favoritos, y solo Solicitar.js escribe los de la nube;
 *   2. corre la pieza del cuadro de sugerencias: el uso «favorito» ya no existe (revienta, en vez de armar un cuadro);
 *   3. careo: con el código de ANTES el medidor tiene que ver la segunda fuente, CORRIENDO lo que leía el teléfono;
 *   4. y el medidor no se puede ablandar: pantallas de mentira que tiene que ver.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, leer, cuerpoDeLaFuncion } = require('./cargar.cjs');
const { medirCodigo, lector, telefonoDe, nubeDe, caminoVivoEnHome } = require('../scripts/medir-favoritos-g67.cjs');

const ANTES = { raiz: '8e40aab', admin: 'f1cef14', aliados: '86521c2' };

describe('G67 · hoy: los favoritos viven solo en la nube', () => {
  const hoy = medirCodigo(lector());

  it('el medidor recorre las tres apps y las funciones (si deja una fuera, su «nadie» no vale)', () => {
    const miradas = Object.fromEntries(hoy.carpetas);
    for (const c of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src', 'guajirago/functions']) {
      assert.ok(miradas[c] > 0, 'el medidor no mira ' + c + ': ' + JSON.stringify(hoy.carpetas));
    }
  });

  it('nadie, en las tres apps ni en las funciones, lee ni escribe favoritos en el teléfono', () => {
    assert.deepStrictEqual(hoy.telefono, [], 'favoritos en el teléfono: ' + JSON.stringify(hoy.telefono));
    assert.strictEqual(hoy.fuentes, 1);
  });

  it('Home.js ya no tiene la ventanita del teléfono, ni quien la abra, ni lectura al abrir la pantalla', () => {
    assert.ok(!hoy.home.falla, hoy.home.falla);
    assert.deepStrictEqual(hoy.home.funciones, []);
    assert.strictEqual(hoy.home.hayVentanita, false);
    assert.deepStrictEqual(hoy.home.abridores, []);
    assert.strictEqual(hoy.home.seLeeAlAbrir, false);
  });

  it('en la nube escribe UNO: Solicitar.js (guardar y borrar), y guardar pasa por el tope de configApp.js', () => {
    const escriben = hoy.nube.filter((x) => x.escrituras.length);
    assert.deepStrictEqual(escriben.map((x) => [x.r, x.escrituras.length]), [['guajirago/src/Solicitar.js', 2]]);
    const s = leer('guajirago/src/Solicitar.js');
    const i = s.indexOf('const guardarFavorito = ');
    assert.ok(i >= 0, 'Solicitar.js ya no tiene guardarFavorito');
    assert.match(cuerpoDeLaFuncion(s, i).texto, /maximoDeFavoritos\s*\(\s*configApp\s*\)/,
      'guardarFavorito tiene que preguntar el tope a maximoDeFavoritos (configApp.js), no llevar el suyo');
  });

  it('el cuadro de sugerencias ya no tiene el uso «favorito» (las dos copias) y nadie lo pide', () => {
    for (const t of hoy.sug.tabla) assert.strictEqual(t.tieneFavorito, false, t.r + ' todavía tiene el uso «favorito»');
    assert.deepStrictEqual(hoy.sug.quienLoPide, []);
    const pieza = cargarDeLaApp('guajirago/src/sugerenciasDeDirecciones.js');
    const maps = { LatLng: function LatLng() {}, LatLngBounds: function LatLngBounds() {} };
    assert.throws(() => pieza.opcionesDeSugerencias(maps, 'favorito'), /no conozco el uso/);
  });
});

describe('G67 · careo: con el código de antes el medidor ve las dos fuentes', () => {
  let hayHistoria = true;
  try {
    execFileSync('git', ['cat-file', '-e', ANTES.raiz + '^{commit}'], { cwd: RAIZ, stdio: 'ignore' });
    execFileSync('git', ['cat-file', '-e', ANTES.admin + '^{commit}'], { cwd: path.join(RAIZ, 'guajirago-admin'), stdio: 'ignore' });
    execFileSync('git', ['cat-file', '-e', ANTES.aliados + '^{commit}'], { cwd: path.join(RAIZ, 'guajirago-aliados'), stdio: 'ignore' });
  } catch (e) { hayHistoria = false; }

  it('antes: 1 lectura y 1 escritura en el teléfono, que se leía al abrir y no se pintaba, y una ventanita que nadie abría',
    { skip: !hayHistoria && 'sin la historia de git de los tres repos' }, () => {
      const antes = medirCodigo(lector(ANTES));
      assert.deepStrictEqual([antes.lecturasTel, antes.escriturasTel, antes.fuentes], [1, 1, 2]);
      assert.deepStrictEqual(antes.telefono.map((x) => x.r), ['guajirago/src/Home.js']);
      const h = antes.home;
      assert.deepStrictEqual(h.funciones.map((f) => [f.nombre, f.hace.join(' · '), f.devuelve]), [
        ['cargarFavoritos', 'lee «guajirago_favoritos»', '2 favorito(s)'],
        ['guardarFavoritos', 'escribe «guajirago_favoritos»', 'undefined'],
      ]);
      assert.deepStrictEqual([h.seLeeAlAbrir, h.sePinta, h.hayVentanita, h.abridores], [true, 0, true, []]);
      assert.deepStrictEqual(antes.sug.quienLoPide, ['guajirago/src/Home.js:37']);
      assert.deepStrictEqual(antes.sug.tabla.map((t) => t.tieneFavorito), [true, true]);
    });
});

describe('G67 · y el medidor no se puede ablandar', () => {
  const TELEFONO = [
    ['lee con el texto de la clave', "const f = JSON.parse(localStorage.getItem('guajirago_favoritos'));", 1, 0],
    ['escribe con una constante', "const K = 'mis_favoritos';\nlocalStorage.setItem(K, JSON.stringify(f));", 0, 1],
    ['escribe con corchetes', "localStorage['guajirago_favoritos'] = '[]';", 0, 1],
    ['lee con corchetes', "const x = localStorage['guajirago_favoritos'];", 1, 0],
    ['borra', 'localStorage.removeItem("lugaresFavoritos");', 0, 1],
    ['solo en un comentario no cuenta', "// localStorage.getItem('guajirago_favoritos')", 0, 0],
    ['otra clave no cuenta', "localStorage.getItem('guajirago_recientes');", 0, 0],
  ];
  for (const [nombre, texto, l, e] of TELEFONO) {
    it('teléfono · ' + nombre, () => {
      const r = telefonoDe(texto);
      assert.deepStrictEqual([r.lecturas.length, r.escrituras.length], [l, e]);
    });
  }

  it('nube · una escritura a usuarios con favoritos se ve; copiar la lista (`...favoritos`) no es leer', () => {
    assert.strictEqual(nubeDe("updateDoc(doc(db, 'usuarios', uid), { favoritos: nuevos });").escrituras.length, 1);
    assert.strictEqual(nubeDe("setDoc(doc(db, 'usuarios', uid), { favoritos: [] }, { merge: true });").escrituras.length, 1);
    assert.strictEqual(nubeDe("updateDoc(doc(db, 'viajes', id), { favoritos: 1 });").escrituras.length, 0);
    assert.deepStrictEqual(nubeDe('const n = [...favoritos, x];').lecturas, []);
    assert.strictEqual(nubeDe('const f = snap.data().favoritos;').lecturas.length, 1);
  });

  it('Home de mentira · alguien vuelve a abrir la ventanita y a leer el teléfono al abrir', () => {
    const falso = [
      "const STORAGE_FAVORITOS = 'guajirago_favoritos';",
      'function cargarFavoritos() { try { return JSON.parse(localStorage.getItem(STORAGE_FAVORITOS)) || []; } catch (e) { return []; } }',
      'function ModalFavorito() { return null; }',
      'function Home() {',
      '  const [favoritos, setFavoritos] = useState(cargarFavoritos());',
      '  const [m, setMostrarModalFavorito] = useState(false);',
      '  return <div onClick={() => setMostrarModalFavorito(true)}>{favoritos.map(f => f.nombre)}</div>;',
      '}',
    ].join('\n');
    const leerDe = (r) => (r === 'guajirago/src/Home.js' ? falso : null);
    const h = caminoVivoEnHome(leerDe);
    assert.deepStrictEqual(h.funciones.map((f) => [f.nombre, f.devuelve]), [['cargarFavoritos', '2 favorito(s)']]);
    assert.deepStrictEqual([h.seLeeAlAbrir, h.hayVentanita, h.abridores, h.sePinta], [true, true, ['true'], 1]);
  });
});
