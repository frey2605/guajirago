/**
 * LOS ARCHIVOS DE PLANTILLA YA NO ESTÁN (gemelo G103, 30-sep-2026)
 *
 * Create React App dejó en las tres apps un `src/App.css` y un `src/logo.svg` (el átomo de React), idénticos, y
 * `firebase init` dejó en `guajirago/` un `index.html` de bienvenida. Nadie los importaba ni los publicaba (lo
 * mide scripts/medir-archivos-muertos.cjs), y el paquete compilado de las tres apps salió igual sin ellos. Se
 * borraron. Esta prueba se pone roja si vuelven a aparecer, si alguien los nombra (un import de un archivo que
 * no está rompe la compilación), o si `guajirago/src/theme.js` —que estaba en la misma fila y NO es muerto:
 * es la paleta desde G90— deja de existir o de importarse.
 *
 * El recorrido vive UNA vez, en el medidor: esta prueba lo importa y le da de comer árboles de mentira para
 * comprobar que no se ablanda.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../scripts/medir-archivos-muertos.cjs');

/** Un árbol de mentira: { ruta: texto }. */
function arbol(archivos) {
  return { rutas: Object.keys(archivos), leer: (r) => archivos[r] };
}

/** Un árbol sano: lo mínimo de hoy, sin los siete. */
const SANO = {
  'firebase.json': JSON.stringify({ hosting: { public: 'build' } }),
  'guajirago/firebase.json': JSON.stringify({ hosting: { public: 'build' } }),
  'guajirago-admin/firebase.json': '﻿' + JSON.stringify({ hosting: { target: 'admin', public: 'build' } }),
  'guajirago/src/theme.js': 'export const T = {};\n',
  'guajirago/src/index.js': "import { T } from './theme';\n",
  'guajirago/src/App.js': "import React from 'react';\n",
};

describe('G103 · los archivos de plantilla no vuelven', () => {
  it('en el disco: ninguno de los siete existe, nadie los nombra y nadie los publicaría', () => {
    const r = M.medirDisco();
    assert.deepStrictEqual(r.fallas, [], 'alguien usa o publicaría un archivo de plantilla: ' + r.fallas.join(' | '));
    const vuelven = r.candidatos.filter((c) => c.existe).map((c) => c.ruta);
    assert.deepStrictEqual(vuelven, [], 'volvieron archivos de plantilla que se borraron en G103: ' + vuelven.join(', '));
    assert.strictEqual(r.candidatos.length, 7, 'la lista de G103 tiene siete archivos');
  });

  it('theme.js NO es muerto: existe y lo importan pantallas de la app', () => {
    const { vivo } = M.medirDisco();
    assert.ok(vivo.existe, 'guajirago/src/theme.js desapareció: es la paleta (G90), no un archivo de plantilla');
    assert.ok(vivo.importan.length >= 1, 'ninguna pantalla importa ya guajirago/src/theme.js');
  });

  describe('el medidor no se ablanda (árboles de mentira)', () => {
    it('el árbol sano no tiene fallas y cuenta quién importa theme.js', () => {
      const r = M.medir(arbol(SANO));
      assert.deepStrictEqual(r.fallas, []);
      assert.deepStrictEqual(r.sobran, []);
      assert.deepStrictEqual(r.vivo.importan, ['guajirago/src/index.js']);
      assert.ok(r.vivo.existe);
    });

    it('un archivo que vuelve sin que nadie lo use sale como «sobra»', () => {
      const r = M.medir(arbol({ ...SANO, 'guajirago-aliados/src/logo.svg': '<svg/>' }));
      assert.deepStrictEqual(r.sobran, ['guajirago-aliados/src/logo.svg']);
      assert.ok(r.candidatos.find((c) => c.ruta === 'guajirago-aliados/src/logo.svg').existe);
    });

    it('un import de App.css en una pantalla es un uso, con archivo y renglón', () => {
      const r = M.medir(arbol({ ...SANO, 'guajirago-admin/src/App.js': "import React from 'react';\nimport './App.css';\n" }));
      const c = r.candidatos.find((x) => x.ruta === 'guajirago-admin/src/App.css');
      assert.deepStrictEqual(c.usos, ['guajirago-admin/src/App.js:2']);
      assert.ok(r.fallas.some((f) => f.includes('guajirago-admin/src/App.css lo usa')));
    });

    it('un url(logo.svg) en una hoja de estilo y un src en un html son usos', () => {
      const r = M.medir(arbol({ ...SANO,
        'guajirago/src/index.css': '.x { background: url(./logo.svg); }\n',
        'guajirago-aliados/public/index.html': '<img src="logo.svg">\n' }));
      const c = r.candidatos.find((x) => x.ruta === 'guajirago/src/logo.svg');
      assert.deepStrictEqual([...c.usos].sort(), ['guajirago-aliados/public/index.html:1', 'guajirago/src/index.css:1']);
    });

    it('un require de App.css en un guion o una prueba también es un uso', () => {
      const r = M.medir(arbol({ ...SANO, 'pruebas/otra.test.js': "const t = leer('guajirago/src/App.css');\n" }));
      assert.ok(r.candidatos.find((x) => x.ruta === 'guajirago/src/App.css').usos.includes('pruebas/otra.test.js:1'));
    });

    it('un firebase.json que publique la carpeta guajirago/ publicaría guajirago/index.html', () => {
      const r = M.medir(arbol({ ...SANO, 'guajirago/firebase.json': JSON.stringify({ hosting: { public: '.' } }) }));
      const c = r.candidatos.find((x) => x.ruta === 'guajirago/index.html');
      assert.deepStrictEqual(c.lasPublica, ['guajirago/firebase.json']);
      assert.ok(r.fallas.some((f) => f.includes('guajirago/index.html lo publicaría')));
    });

    it('y uno de la raíz que publique «guajirago» también (varios hosting en lista)', () => {
      const r = M.medir(arbol({ ...SANO, 'firebase.json': JSON.stringify({ hosting: [{ public: 'build' }, { public: 'guajirago' }] }) }));
      assert.deepStrictEqual(r.candidatos.find((x) => x.ruta === 'guajirago/index.html').lasPublica, ['firebase.json']);
    });

    it('un firebase.json roto es una falla, no un silencio (y la marca BOM no lo rompe)', () => {
      const r = M.medir(arbol({ ...SANO, 'guajirago-aliados/firebase.json': '{ roto' }));
      assert.ok(r.fallas.some((f) => f.startsWith('guajirago-aliados/firebase.json no se pudo leer')));
      assert.ok(!r.fallas.some((f) => f.startsWith('guajirago-admin/firebase.json')));
    });

    it('no cuentan las notas, la copia vieja anidada ni los nombres que solo se parecen', () => {
      const r = M.medir(arbol({ ...SANO,
        'CLAUDE.md': 'el App.css y el logo.svg de plantilla\n',
        'guajirago/guajirago/src/App.js': "import './App.css';\nimport logo from './logo.svg';\n",
        'guajirago/public/manifest.json': '{ "src": "logo-completo.svg", "x": "MiApp.css" }\n' }));
      assert.deepStrictEqual(r.fallas, []);
    });

    it('theme.js: un guion que lo nombre no lo mantiene vivo; una pantalla con require sí', () => {
      const sinPantallas = { ...SANO, 'guajirago/src/index.js': '', 'scripts/x.cjs': "import { T } from './theme';\n" };
      assert.deepStrictEqual(M.medir(arbol(sinPantallas)).vivo.importan, []);
      const conRequire = { ...sinPantallas, 'guajirago/src/Otra.js': "const { T } = require('./theme.js');\n" };
      assert.deepStrictEqual(M.medir(arbol(conRequire)).vivo.importan, ['guajirago/src/Otra.js']);
      const sinTema = { ...SANO };
      delete sinTema['guajirago/src/theme.js'];
      assert.strictEqual(M.medir(arbol(sinTema)).vivo.existe, false);
    });
  });
});
