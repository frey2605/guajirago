// ─────────────────────────────────────────────────────────────────────────────
//  G65 (29-sep-2026) · LA CONEXIÓN A FIREBASE SALE DE UNA PIEZA EN LAS TRES APPS
//
//  `src/firebase.js` estaba copiado en transporte, panel y aliados, y solo lo vigilaban por FORMA (que el texto
//  nombre tal función). Y ya se habían separado: aliados aprendió a decir cuándo no puede trabajar sin señal y a
//  sellar su segunda conexión con App Check; transporte y panel seguían tragándose el fallo (`.catch(() => {})`).
//  Ahora es UN archivo, idéntico en las tres (la versión de aliados, que era la más completa).
//
//  Esta prueba:
//    1. exige que las tres copias sean byte a byte la misma;
//    2. CORRE cada copia con un Firebase de mentira (scripts/medir-conexion-firebase.cjs), con el ambiente.js de
//       verdad y los .env de pruebas y producción de esa app, y exige: la configuración de configFirebaseDe, el
//       arranque en su orden (App Check con su llave y ANTES de la base), que el «sin señal» se DIGA por las dos
//       vías y que no se diga si no hay problema, y que la pieza de App Check selle la conexión que recibe;
//    3. le da al medidor el código de ANTES (raíz 87a5a11, panel 6d0411f) y exige que vea el fallo;
//    4. le da pantallas de mentira (una copia rota cada vez) y exige que las vea todas.
// ─────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, cargarDeLaApp, copiaIdentica } = require('./cargar.cjs');
const { medir, correr, lector, APPS, AMBIENTES } = require('../scripts/medir-conexion-firebase.cjs');
const { leerEnv } = require('../scripts/medir-ambientes.cjs');

const RAIZ = path.join(__dirname, '..');
const PIEZA = 'guajirago/src/firebase.js';
const sinCR = (s) => String(s).replace(/\r\n/g, '\n');
const ANTES = { raiz: '87a5a11', admin: '6d0411f', aliados: 'f0951e9' };

describe('G65 · la conexión a Firebase sale de UNA pieza', { timeout: 20000 }, () => {
  for (const a of APPS.filter((x) => x.carpeta !== 'guajirago')) {
    it(a.carpeta + '/src/firebase.js es idéntica a ' + PIEZA, () => {
      copiaIdentica(a.carpeta + '/src/firebase.js', PIEZA,
        '⛔ la conexión de ' + a.nombre + ' se separó de la de transporte: se copia ENTERA a las tres, no se arregla en un solo lado');
    });
  }

  for (const a of APPS) {
    for (const amb of AMBIENTES) {
      it(a.nombre + ' / ' + amb + ' · se conecta con la configuración del .env y arranca en su orden', async () => {
        const texto = leer(a.carpeta + '/src/firebase.js');
        const ambienteTexto = leer(a.carpeta + '/src/ambiente.js');
        const A = cargarDeLaApp('ambiente.js', ambienteTexto);
        const env = leerEnv(fs.readFileSync(path.join(RAIZ, a.carpeta, '.env.' + amb), 'utf8'));
        const r = await correr(texto, ambienteTexto, env, 'bien');
        const llave = A.llaveAppCheckDe(env);
        const esperado = [
          ['initializeApp', '[DEFAULT]', A.configFirebaseDe(env)],
          ...(llave ? [['initializeAppCheck', '[DEFAULT]', llave, true]] : []),
          ['getFirestore', '[DEFAULT]'],
          ['initializeAuth', '[DEFAULT]', 'local'],
          ['getMessaging', '[DEFAULT]'],
          ['getStorage', '[DEFAULT]'],
          ['onLog', 'warn'],
          ['enableIndexedDbPersistence', '[DEFAULT]'],
        ];
        assert.deepStrictEqual(r.pasos, esperado, '⛔ ' + a.nombre + '/' + amb + ' ya no arranca igual');
        assert.strictEqual(r.verificacionDePrueba, false, '⛔ la verificación de pruebas del inicio de sesión quedó encendida');
        assert.strictEqual(r.ambiente, A.ambienteDe(amb).nombre);
        assert.strictEqual(r.proyecto, A.configFirebaseDe(env).projectId);
        assert.strictEqual(r.seEntera, 'nunca', '⛔ avisa «sin señal» sin que haya problema');
        assert.strictEqual(r.sellaLaQueRecibe, llave ? true : 'sin llave', '⛔ la pieza de App Check no sella la conexión que recibe');
        assert.deepStrictEqual(r.exporta, ['ambiente', 'auth', 'db', 'messaging', 'proyecto', 'sellarConAppCheck', 'storage', 'trabajoSinSenal']);
      });

      it(a.nombre + ' / ' + amb + ' · si no puede trabajar sin señal, lo DICE (las dos formas de fallar)', async () => {
        const texto = leer(a.carpeta + '/src/firebase.js');
        const ambienteTexto = leer(a.carpeta + '/src/ambiente.js');
        const env = leerEnv(fs.readFileSync(path.join(RAIZ, a.carpeta, '.env.' + amb), 'utf8'));
        const rechaza = await correr(texto, ambienteTexto, env, 'rechaza');
        assert.deepStrictEqual(rechaza.seEntera, { ok: false, codigo: 'failed-precondition' }, '⛔ se traga la respuesta rechazada');
        const memoria = await correr(texto, ambienteTexto, env, 'cae-a-memoria');
        assert.deepStrictEqual(memoria.seEntera, { ok: false, codigo: 'unimplemented' }, '⛔ no escucha cuando Firebase cae a memoria');
      });
    }
  }

  it('el medidor, con el código de hoy: una versión y nada callado', async () => {
    const r = await medir();
    assert.strictEqual(r.versiones, 1);
    assert.strictEqual(r.exportsDistintos, 1);
    assert.strictEqual(r.configBuena, r.casos);
    assert.strictEqual(r.appCheckBien, r.casos);
    assert.deepStrictEqual(r.callados, []);
    assert.strictEqual(r.sellaMal, 0);
    assert.strictEqual(r.avisaSinProblema, 0);
  });

  it('el medidor, con el código de ANTES, ve las dos versiones y los 8 casos callados de transporte y panel', async () => {
    const r = await medir(lector(ANTES));
    assert.strictEqual(r.versiones, 2);
    assert.strictEqual(r.callados.length, 8);
    assert.ok(r.callados.every((c) => /^(transporte|panel)\//.test(c)), r.callados.join(' | '));
    assert.strictEqual(r.configBuena, r.casos, 'antes la configuración ya era la buena: el careo lo exige igual');
  });

  // Pantallas de mentira: una copia rota cada vez, en la pieza de transporte. El medidor tiene que verla.
  const ROTAS = [
    ['el catch mudo de siempre', /enableIndexedDbPersistence\(db\)\.catch\(\(e\) => [^\n]*\);/, 'enableIndexedDbPersistence(db).catch(() => {});', (r) => r.callados.length > 0],
    ['sin escuchar el registro', /if \(\/Falling back to memory cache\|offline persistence\/i\.test/, 'if (/nada que ver/.test', (r) => r.callados.some((c) => /memoria/.test(c))],
    ['App Check después de la base', /sellarConAppCheck\(app\);\nexport const db = getFirestore\(app\);/, 'export const db = getFirestore(app);\nsellarConAppCheck(app);', (r) => r.appCheckBien < r.casos],
    ['la pieza sella siempre la principal', /initializeAppCheck\(unaApp,/, 'initializeAppCheck(app,', (r) => r.sellaMal > 0],
    ['una llave escrita a mano', /const firebaseConfig = configFirebaseDe\(process\.env\);/, 'const firebaseConfig = { ...configFirebaseDe(process.env), apiKey: "AIza-otra" };', (r) => r.configBuena < r.casos],
    ['avisa aunque todo vaya bien', /let avisarSinSenal = \(\) => \{\};/, 'let avisarSinSenal = () => {}; setTimeout(() => avisarSinSenal({ ok: false }), 0);', (r) => r.avisaSinProblema > 0],
  ];
  for (const [nombre, busca, pone, loVe] of ROTAS) {
    it('el medidor ve una pieza rota: ' + nombre, async () => {
      const bueno = sinCR(leer(PIEZA));
      assert.strictEqual((bueno.match(new RegExp(busca.source, 'g')) || []).length, 1, 'la pantalla de mentira no calza: ' + nombre);
      const roto = bueno.replace(busca, pone);
      const base = lector();
      const r = await medir((ruta) => (ruta === PIEZA ? roto : base(ruta)));
      assert.ok(r.versiones === 2, 'la copia rota tenía que contar como otra versión');
      assert.ok(loVe(r), '⛔ el medidor no ve: ' + nombre);
    });
  }
});
