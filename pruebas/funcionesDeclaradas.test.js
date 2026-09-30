/**
 * LAS FUNCIONES DEL SERVIDOR SE DECLARAN IGUAL EN LOS DOS firebase.json (gemelo G101, 30-sep-2026)
 *
 * Hay dos firebase.json que declaran las funciones, y los dos hacen falta:
 *  · guajirago/firebase.json es el que PUBLICA (herramientas/publicar-funciones.sh publica desde dentro de
 *    `guajirago/`, con una copia limpia que ni siquiera trae el de la raíz);
 *  · el de la RAÍZ lo usa el emulador de `npm test` (pruebas/correr.cjs, `cwd: RAIZ`), que enciende las funciones
 *    de verdad para pruebas/funciones.test.js.
 * Hasta G101 decían cosas distintas: el de la raíz no llevaba `ignore` ni `disallowLegacyRuntimeConfig`, así que
 * un `firebase deploy` desde la raíz habría subido otra cosa que el de la app. Ahora dicen lo mismo, y esta
 * prueba se pone roja si se separan.
 *
 * El recorrido que normaliza y compara vive UNA vez, en scripts/medir-funciones-declaradas.cjs: esta prueba lo
 * importa, y le da de comer archivos de mentira para comprobar que no se ablanda.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const M = require('../scripts/medir-funciones-declaradas.cjs');

const RAIZ = leer(M.DE_LA_RAIZ);
const APP = leer(M.DE_LA_APP);

/** Cambia `de` por `a` en `t` y exige que calzara UNA vez (si no calza, la mentira no se aplicó). */
function cambiar(t, de, a) {
  const n = t.split(de).length - 1;
  assert.strictEqual(n, 1, 'el texto de la mentira calza ' + n + ' veces, no una: «' + de + '»');
  return t.replace(de, a);
}

describe('G101 · los dos firebase.json declaran las mismas funciones', () => {
  it('los dos declaran funciones, de la MISMA carpeta', () => {
    const r = M.medirTextos(RAIZ, APP);
    assert.ok(r.raiz, 'firebase.json de la raíz ya no declara funciones: el emulador de npm test se queda sin ellas');
    assert.ok(r.app, 'guajirago/firebase.json ya no declara funciones: el que publica no sabría qué publicar');
    assert.deepStrictEqual(Object.keys(r.app), ['default'], 'el que publica tiene que declarar un solo codebase, "default"');
    assert.strictEqual(r.app.default.source, 'guajirago/functions');
    assert.strictEqual(r.raiz.default.source, 'guajirago/functions');
  });

  it('y dicen LO MISMO, opción por opción', () => {
    const { difieren } = M.medirTextos(RAIZ, APP);
    assert.deepStrictEqual(difieren, [],
      'los dos firebase.json declaran las funciones con opciones distintas: '
      + difieren.map((d) => '[' + d.codebase + '] ' + d.opcion + ': raíz=' + JSON.stringify(d.raiz)
        + ' · app=' + JSON.stringify(d.app)).join(' | ')
      + '. Cambia los DOS a la vez (el de guajirago/ es el que publica; el de la raíz, el del emulador).');
  });

  it('el emulador de npm test corre desde la raíz y enciende las funciones (por eso la raíz las declara)', () => {
    const c = leer('pruebas/correr.cjs');
    assert.ok(/'--only',\s*'[^']*\bfunctions\b[^']*'/.test(c), 'correr.cjs ya no levanta el emulador de funciones');
    assert.ok(/cwd:\s*RAIZ\b/.test(c), 'correr.cjs ya no corre el emulador desde la raíz');
  });

  describe('el medidor no se ablanda (archivos de mentira)', () => {
    it('un objeto suelto sin codebase vale lo mismo que la lista con "default"', () => {
      const raiz = JSON.stringify({ functions: { source: 'guajirago/functions', disallowLegacyRuntimeConfig: true,
        ignore: ['node_modules', '.git', 'firebase-debug.log', 'firebase-debug.*.log', '*.local'] } });
      assert.deepStrictEqual(M.medirTextos(raiz, APP).difieren, []);
    });
    it('una opción de menos en la raíz se ve', () => {
      const r = M.medirTextos(cambiar(RAIZ, '"disallowLegacyRuntimeConfig": true,', ''), APP);
      assert.deepStrictEqual(r.difieren.map((d) => d.opcion), ['disallowLegacyRuntimeConfig']);
    });
    it('un ignore distinto se ve', () => {
      const r = M.medirTextos(RAIZ, cambiar(APP, '"*.local"', '"*.locales"'));
      assert.deepStrictEqual(r.difieren.map((d) => d.opcion), ['ignore']);
    });
    it('otra carpeta se ve, aunque el texto de `source` sea el mismo', () => {
      // "functions" leído desde la RAÍZ es otra carpeta que "functions" leído desde guajirago/.
      const r = M.medirTextos(cambiar(RAIZ, '"source": "guajirago/functions"', '"source": "functions"'), APP);
      assert.deepStrictEqual(r.difieren.map((d) => d.opcion), ['source']);
    });
    it('un codebase de más se ve', () => {
      const raiz = JSON.stringify({ functions: [M.leerJson(RAIZ).functions[0],
        { source: 'otra', codebase: 'otra' }] });
      assert.ok(M.medirTextos(raiz, APP).difieren.some((d) => d.codebase === 'otra'));
    });
    it('sin sección functions, el medidor lo dice (null)', () => {
      assert.strictEqual(M.medirTextos('{"hosting":{}}', APP).raiz, null);
    });
  });
});
