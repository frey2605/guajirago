// ═══════════════════════════════════════════════════════════════════════════
//  APP CHECK (fase 1 del plan, «cerrar la puerta») · 26-sep-2026
//
//  Sin App Check, cualquiera que saque la llave pública de Firebase —que viaja dentro
//  de la app, a la vista— puede hablar con la base desde un guion, sin abrir la app.
//  Con App Check, cada llamada lleva un sello que dice «vengo de la app de verdad».
//
//  Se enciende AMBIENTE POR AMBIENTE: la llave del sitio va en el .env, y si el .env no
//  la trae la app no arranca App Check y queda exactamente como estaba. Así pruebas se
//  enciende primero y producción no cambia hasta que su .env la tenga.
//
//  Lo que se prueba EJECUTANDO: la decisión (`llaveAppCheckDe`, en ambiente.js, la pieza
//  que ya comparten las tres apps y que elAmbiente.test.js ata byte a byte). Lo que se
//  prueba por FORMA, porque firebase.js importa el SDK: que las tres lo arranquen con esa
//  llave, solo si la hay, y ANTES de la base — una llamada hecha antes no lleva sello.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-ambientes.cjs');
const { contarCodigo } = require('../scripts/medir-app-check.cjs');

const APPS = ['guajirago', 'guajirago-admin', 'guajirago-aliados'];
const LLAVE = 'REACT_APP_APPCHECK_SITE_KEY';

describe('APP CHECK · la llave sale del ambiente, y sin llave nada cambia', () => {
  const A = cargarDeLaApp('guajirago/src/ambiente.js');

  it('con llave la devuelve limpia; sin llave, vacía o en blanco, NO arranca', () => {
    assert.strictEqual(A.llaveAppCheckDe({ [LLAVE]: '6Labc' }), '6Labc');
    assert.strictEqual(A.llaveAppCheckDe({ [LLAVE]: '  6Labc \r' }), '6Labc',
      '⛔ un espacio o un \\r del .env de Windows mandaría a Google una llave que no existe');
    for (const env of [{}, { [LLAVE]: '' }, { [LLAVE]: '   ' }]) {
      assert.strictEqual(A.llaveAppCheckDe(env), null, '⛔ sin llave App Check no se arranca: ' + JSON.stringify(env));
    }
  });

  it('PRODUCCIÓN trae LA MISMA llave en las tres apps, y no es la de pruebas (encendido el 27-sep-2026)', () => {
    const prod = APPS.map((a) => M.leerEnv(leer(a + '/.env.produccion'))[LLAVE] || null);
    const pru = M.leerEnv(leer('guajirago/.env.pruebas'))[LLAVE];
    assert.ok(prod[0], '⛔ producción perdió su llave de App Check: dejaría de mandar el sello');
    assert.ok(prod.every((k) => k === prod[0]), '⛔ las llaves de producción no coinciden entre las tres apps: ' + JSON.stringify(prod));
    assert.notStrictEqual(prod[0], pru, '⛔ producción usa la llave de PRUEBAS: su sello no valdría en producción');
  });

  it('en PRUEBAS, si una app trae llave, las tres traen LA MISMA (comparten la app web)', () => {
    const llaves = APPS.map((a) => M.leerEnv(leer(a + '/.env.pruebas'))[LLAVE] || null);
    assert.ok(llaves.every((k) => k === llaves[0]),
      '⛔ las llaves de App Check de pruebas no coinciden entre las tres apps: ' + JSON.stringify(llaves));
  });
});

describe('APP CHECK · las tres apps lo arrancan igual, con la llave del ambiente y antes de la base', () => {
  for (const a of APPS) {
    it(a + ': lo arranca solo si hay llave, con reCAPTCHA Enterprise, entre initializeApp y la base', () => {
      const t = soloCodigo(leer(a + '/src/firebase.js'));
      assert.match(t, /import\s*\{[^}]*\binitializeAppCheck\b[^}]*\bReCaptchaEnterpriseProvider\b[^}]*\}\s*from\s*["']firebase\/app-check["']/,
        '⛔ ' + a + ' no importa App Check con el proveedor de reCAPTCHA Enterprise');
      assert.match(t, /import\s*\{[^}]*\bllaveAppCheckDe\b[^}]*\}\s*from\s*["']\.\/ambiente["']/,
        '⛔ ' + a + ' no saca la llave de ambiente.js: una segunda forma de leerla sería un gemelo');
      const m = t.match(/const\s+(\w+)\s*=\s*llaveAppCheckDe\(\s*process\.env\s*\)\s*;\s*if\s*\(\s*\1\s*\)\s*initializeAppCheck\(\s*app\s*,\s*\{\s*provider:\s*new\s+ReCaptchaEnterpriseProvider\(\s*\1\s*\)/);
      assert.ok(m, '⛔ ' + a + ' no arranca App Check con la llave del ambiente, o lo arranca sin preguntar si la hay');
      const iApp = t.indexOf('initializeApp(firebaseConfig)');
      const iCheck = t.indexOf('initializeAppCheck(app');
      const iBase = t.indexOf('getFirestore(app)');
      assert.ok(iApp >= 0 && iCheck > iApp, '⛔ ' + a + ': App Check tiene que ir DESPUÉS de initializeApp');
      assert.ok(iBase > iCheck, '⛔ ' + a + ': App Check tiene que ir ANTES de la base, o las primeras llamadas salen sin sello');
      assert.strictEqual((t.match(/initializeAppCheck\s*\(/g) || []).length, 1, '⛔ ' + a + ': App Check se arranca una sola vez');
    });
  }

  it('el medidor ve lo mismo que esta prueba: las tres apps lo arrancan', () => {
    for (const x of contarCodigo().apps) assert.strictEqual(x.arranca, true, '⛔ el medidor dice que ' + x.app + ' no arranca App Check');
  });
});
