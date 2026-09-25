// ═══════════════════════════════════════════════════════════════════════════
//  EL AMBIENTE DE PRUEBAS (fase 0) · la app de transporte deduce dónde corre
//
//  Hasta el 25-sep-2026 había UN solo ambiente, y era producción: las llaves de
//  Firebase iban escritas a mano en src/firebase.js de las tres apps, y probar era
//  tocar los datos de verdad. Desde hoy la app de transporte se compila POR
//  ambiente (`npm run build:pruebas` / `build:produccion`), las llaves salen de
//  .env.pruebas / .env.produccion, y una guardia (verificarPareja) impide que la
//  copia de pruebas apunte a producción o al revés. Es el patrón de Talaria.
//
//  Lo que se prueba EJECUTANDO: el módulo del ambiente tal cual está escrito, y
//  los dos .env reales pasados por la guardia de la propia app. Lo que se prueba
//  por FORMA (porque es JSX o configuración): que firebase.js ya no lleve llaves,
//  que el cartel se pinte, que package.json y .firebaserc digan lo que deben.
//  Y el medidor de la fase (scripts/medir-ambientes.cjs) recibe árboles de mentira
//  para que no se pueda ablandar.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-ambientes.cjs');

describe('EL AMBIENTE (fase 0) · la app de transporte deduce si es PRUEBAS o PRODUCCIÓN', () => {
  const A = cargarDeLaApp('guajirago/src/ambiente.js');

  it('solo existen dos ambientes, y cualquier otro nombre se rechaza en vez de adivinarse', () => {
    assert.strictEqual(A.ambienteDe('pruebas').esProduccion, false);
    assert.strictEqual(A.ambienteDe('produccion').esProduccion, true);
    assert.throws(() => A.ambienteDe('development'), /Ambiente desconocido/);
    assert.throws(() => A.ambienteDe(undefined), /Ambiente desconocido/,
      '⛔ un `react-scripts build` a secas (sin REACT_APP_AMBIENTE) tiene que pararse, no adivinar');
  });

  it('pruebas y producción se ven distintos en pantalla', () => {
    assert.notStrictEqual(A.ambienteDe('pruebas').color, A.ambienteDe('produccion').color);
    assert.notStrictEqual(A.ambienteDe('pruebas').nombre, A.ambienteDe('produccion').nombre);
  });

  const envCompleto = {
    REACT_APP_FIREBASE_API_KEY: 'k', REACT_APP_FIREBASE_AUTH_DOMAIN: 'd', REACT_APP_FIREBASE_PROJECT_ID: 'guajirago-pruebas',
    REACT_APP_FIREBASE_STORAGE_BUCKET: 'b', REACT_APP_FIREBASE_MESSAGING_SENDER_ID: 'm', REACT_APP_FIREBASE_APP_ID: 'a',
  };

  it('la configuración se arma completa desde las llaves REACT_APP_FIREBASE_*, y si falta una dice cuál', () => {
    const c = A.configFirebaseDe(envCompleto);
    assert.deepStrictEqual(Object.keys(c).sort(), ['apiKey', 'appId', 'authDomain', 'messagingSenderId', 'projectId', 'storageBucket']);
    assert.strictEqual(c.projectId, 'guajirago-pruebas');
    const incompleto = { ...envCompleto };
    delete incompleto.REACT_APP_FIREBASE_APP_ID;
    assert.throws(() => A.configFirebaseDe(incompleto), /REACT_APP_FIREBASE_APP_ID/);
  });

  it('la copia de PRUEBAS jamás apunta a la base de PRODUCCIÓN, ni al revés', () => {
    assert.strictEqual(A.verificarPareja('pruebas', 'guajirago-pruebas'), true);
    assert.strictEqual(A.verificarPareja('produccion', 'guajirago'), true);
    assert.throws(() => A.verificarPareja('pruebas', 'guajirago'), /no es un proyecto de pruebas/);
    assert.throws(() => A.verificarPareja('produccion', 'guajirago-pruebas'), /es un proyecto de pruebas/);
  });

  it('los dos .env de la app están completos y en pareja: se pasan por la guardia de la propia app', () => {
    for (const modo of ['pruebas', 'produccion']) {
      const e = M.leerEnv(leer('guajirago/.env.' + modo));
      const cfg = A.configFirebaseDe(e);
      assert.strictEqual(e.REACT_APP_AMBIENTE, modo, '.env.' + modo + ' no dice su ambiente');
      assert.strictEqual(A.verificarPareja(modo, cfg.projectId), true);
    }
    assert.strictEqual(M.leerEnv(leer('guajirago/.env.produccion')).REACT_APP_FIREBASE_PROJECT_ID, 'guajirago',
      '⛔ producción tiene que seguir siendo el proyecto guajirago');
    assert.strictEqual(M.leerEnv(leer('guajirago/.env.pruebas')).REACT_APP_FIREBASE_PROJECT_ID, 'guajirago-pruebas');
  });

  it('firebase.js ya no lleva llaves escritas: las pide al ambiente y comprueba la pareja', () => {
    const t = soloCodigo(leer('guajirago/src/firebase.js'));
    assert.ok(!/projectId:\s*["']/.test(t) && !/apiKey:\s*["']AIza/.test(t), '⛔ quedan llaves escritas a mano en firebase.js');
    for (const f of ['ambienteDe(', 'configFirebaseDe(', 'verificarPareja(']) assert.ok(t.includes(f), '⛔ firebase.js no llama a ' + f);
    assert.match(t, /export const ambiente\b/, '⛔ firebase.js no exporta el ambiente, y el cartel lo necesita');
  });

  it('la llave de notificaciones del conductor sale del ambiente, no del código', () => {
    const t = soloCodigo(leer('guajirago/src/AppConductor.js'));
    assert.ok(!/vapidKey:\s*["']B/.test(t), '⛔ la vapidKey sigue escrita a mano en AppConductor.js');
    assert.match(t, /vapidKey:\s*process\.env\.REACT_APP_FIREBASE_VAPID_KEY/, '⛔ la vapidKey no se lee de REACT_APP_FIREBASE_VAPID_KEY');
    assert.ok(M.leerEnv(leer('guajirago/.env.produccion')).REACT_APP_FIREBASE_VAPID_KEY,
      '⛔ producción se quedó sin su llave de notificaciones: los conductores dejarían de recibir avisos');
  });

  it('se compila por ambiente: build:pruebas, build:produccion, build a secas sigue siendo producción, start es pruebas', () => {
    const pkg = JSON.parse(leer('guajirago/package.json'));
    const s = pkg.scripts;
    assert.match(s['build:pruebas'], /env-cmd -f \.env\.pruebas react-scripts build/);
    assert.match(s['build:produccion'], /env-cmd -f \.env\.produccion react-scripts build/);
    assert.match(s.build, /build:produccion/, '⛔ `npm run build` a secas tiene que seguir publicando producción: lo usan las notas y el botón');
    assert.match(s.start, /\.env\.pruebas/, '⛔ el servidor de desarrollo tiene que correr contra PRUEBAS, nunca contra producción');
    assert.ok((pkg.devDependencies || {})['env-cmd'], '⛔ env-cmd no está declarado: en una máquina limpia los scripts no correrían');
  });

  it('.firebaserc de la app: alias pruebas y produccion, y el default es PRUEBAS', () => {
    const rc = JSON.parse(leer('guajirago/.firebaserc'));
    assert.strictEqual(rc.projects.pruebas, 'guajirago-pruebas');
    assert.strictEqual(rc.projects.produccion, 'guajirago');
    assert.strictEqual(rc.projects.default, 'guajirago-pruebas',
      '⛔ un `firebase deploy` sin --project tiene que caer en pruebas, nunca en producción');
  });

  it('la copia de pruebas se ve: el cartel se pinta al arrancar, y en producción no pinta nada', () => {
    assert.match(soloCodigo(leer('guajirago/src/index.js')), /<CartelAmbiente\s*\/>/, '⛔ index.js no pinta el cartel');
    const c = soloCodigo(leer('guajirago/src/CartelAmbiente.js'));
    assert.match(c, /if \(ambiente\.esProduccion\) return null/, '⛔ en producción el cartel tiene que ser nada');
    assert.match(c, /ambiente\.nombre/, '⛔ el cartel no dice el nombre del ambiente');
  });

  it('el medidor dice que la app de transporte tiene las 6 piezas, y las otras dos apps todavía no', () => {
    const [t, admin, aliados] = M.medirTodas();
    assert.strictEqual(t.puestas, 6, '⛔ transporte: ' + t.porque.join(' · '));
    assert.ok(admin.puestas < 6 && aliados.puestas < 6,
      'el panel y aliados van aparte, cada uno con su arreglo: si ya están, esta prueba se actualiza con ellos');
  });

  //  🔴 Y EL MEDIDOR NO SE PUEDE ABLANDAR: se le da un árbol de mentira con las seis
  //   piezas puestas (6 de 6) y luego se le rompe UNA por vez; cada rotura tiene que
  //   bajarle exactamente esa pieza. Sin esto, un medidor que contara «6» sin mirar
  //   pasaría la prueba de arriba.
  describe('y el medidor no se puede ablandar', () => {
    const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'fase0-'));
    after(() => fs.rmSync(carpeta, { recursive: true, force: true }));
    let n = 0;
    const arbol = (romper) => {
      const app = path.join(carpeta, 'arbol-' + (n++), 'guajirago');
      fs.mkdirSync(path.join(app, 'src'), { recursive: true });
      const archivos = {
        'src/ambiente.js': leer('guajirago/src/ambiente.js'),
        'src/firebase.js': "import { ambienteDe, configFirebaseDe, verificarPareja } from './ambiente';\nexport const ambiente = ambienteDe(process.env.REACT_APP_AMBIENTE);\n",
        '.env.pruebas': leer('guajirago/.env.pruebas'),
        '.env.produccion': leer('guajirago/.env.produccion'),
        'package.json': JSON.stringify({ scripts: {
          start: 'env-cmd -f .env.pruebas react-scripts start', build: 'npm run build:produccion',
          'build:pruebas': 'env-cmd -f .env.pruebas react-scripts build', 'build:produccion': 'env-cmd -f .env.produccion react-scripts build',
        } }),
        '.firebaserc': JSON.stringify({ projects: { default: 'guajirago-pruebas', pruebas: 'guajirago-pruebas', produccion: 'guajirago' } }),
      };
      if (romper) romper(archivos);
      for (const [r, t] of Object.entries(archivos)) {
        if (t === null) continue;
        fs.writeFileSync(path.join(app, r), t);
      }
      return M.medirApp(app);
    };

    it('con las seis piezas puestas dice 6 de 6', () => {
      const m = arbol();
      assert.strictEqual(m.puestas, 6, m.porque.join(' · '));
    });

    const roturas = [
      ['una llave escrita a mano en src', (a) => { a['src/firebase.js'] += 'const x = { projectId: "guajirago" };\n'; }, 'sinLlavesEnSrc'],
      ['sin ambiente.js', (a) => { a['src/ambiente.js'] = null; }, 'ambienteJs'],
      ['.env.pruebas apuntando a producción', (a) => { a['.env.pruebas'] = a['.env.pruebas'].replace('PROJECT_ID=guajirago-pruebas', 'PROJECT_ID=guajirago'); }, 'envEnPareja'],
      ['.env.produccion sin el appId', (a) => { a['.env.produccion'] = a['.env.produccion'].replace(/^REACT_APP_FIREBASE_APP_ID=.*$/m, ''); }, 'envEnPareja'],
      ['los dos .env al mismo proyecto', (a) => { a['.env.produccion'] = a['.env.produccion'].replace('PROJECT_ID=guajirago', 'PROJECT_ID=guajirago-pruebas').replace('AMBIENTE=produccion', 'AMBIENTE=produccion'); }, 'envEnPareja'],
      ['build a secas sin ambiente', (a) => { a['package.json'] = a['package.json'].replace('npm run build:produccion', 'react-scripts build'); }, 'compilaPorAmbiente'],
      ['el alias produccion apuntando a pruebas', (a) => { a['.firebaserc'] = a['.firebaserc'].replace('"produccion":"guajirago"', '"produccion":"guajirago-pruebas"'); }, 'aliasFirebaserc'],
      ['la vapidKey escrita a mano', (a) => { a['src/firebase.js'] += "const v = { vapidKey: 'BLcx' };\n"; }, 'sinVapidEnSrc'],
    ];
    for (const [que, romper, pieza] of roturas) {
      it('se queja si ' + que, () => {
        const m = arbol(romper);
        assert.strictEqual(m.piezas[pieza], false, '⛔ rota «' + que + '» y la pieza ' + pieza + ' siguió en verde');
        assert.ok(m.porque.length > 0, 'y tiene que decir por qué');
      });
    }
  });
});
