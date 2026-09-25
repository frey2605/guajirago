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

  it('el medidor dice que transporte y el panel tienen las 6 piezas, y aliados todavía no', () => {
    const [t, admin, aliados] = M.medirTodas();
    assert.strictEqual(t.puestas, 6, '⛔ transporte: ' + t.porque.join(' · '));
    assert.strictEqual(admin.puestas, 6, '⛔ panel: ' + admin.porque.join(' · '));
    assert.ok(aliados.puestas < 6, 'aliados va aparte, con su arreglo: si ya está, esta prueba se actualiza con él');
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

// ═══════════════════════════════════════════════════════════════════════════
//  EL PANEL (guajirago-admin) · la misma fase 0, con la MISMA pieza
//
//  El panel es otro repo, así que no puede importar guajirago/src/ambiente.js:
//  lleva una COPIA. Una copia en otro repo es el gemelo que se queda viejo
//  (SEGUNDA LEY), y por eso aquí se ata byte a byte: si se separan, rojo. Lo que
//  la copia HACE ya está probado arriba ejecutando la de transporte; aquí va lo que
//  es del panel: sus .env, su firebase.js, su cartel, sus scripts y su .firebaserc,
//  que además lleva TARGETS, porque el panel publica en un sitio aparte y un target
//  mal mapeado publica el panel ENCIMA de la app de transporte.
// ═══════════════════════════════════════════════════════════════════════════
describe('EL AMBIENTE (fase 0) · el panel (guajirago-admin) deduce igual, con la misma pieza', () => {
  const P = 'guajirago-admin/';

  it('ambiente.js y CartelAmbiente.js del panel son byte a byte los de transporte: la copia está atada', () => {
    for (const f of ['src/ambiente.js', 'src/CartelAmbiente.js']) {
      assert.strictEqual(leer(P + f), leer('guajirago/' + f),
        '⛔ ' + P + f + ' se separó de guajirago/' + f + ': la copia se cambia en los dos sitios o se saca a una casa común');
    }
  });

  it('los dos .env del panel están completos y en pareja: se pasan por la guardia de su propia copia', () => {
    const A = cargarDeLaApp(P + 'src/ambiente.js');
    for (const modo of ['pruebas', 'produccion']) {
      const e = M.leerEnv(leer(P + '.env.' + modo));
      const cfg = A.configFirebaseDe(e);
      assert.strictEqual(e.REACT_APP_AMBIENTE, modo, P + '.env.' + modo + ' no dice su ambiente');
      assert.strictEqual(A.verificarPareja(modo, cfg.projectId), true);
    }
    assert.strictEqual(M.leerEnv(leer(P + '.env.produccion')).REACT_APP_FIREBASE_PROJECT_ID, 'guajirago',
      '⛔ producción del panel tiene que seguir siendo el proyecto guajirago');
    assert.strictEqual(M.leerEnv(leer(P + '.env.pruebas')).REACT_APP_FIREBASE_PROJECT_ID, 'guajirago-pruebas');
  });

  it('el panel usa la MISMA app web de Firebase que transporte, en los dos ambientes (así está en producción, medido el 25-sep-2026)', () => {
    for (const modo of ['pruebas', 'produccion']) {
      const a = M.leerEnv(leer(P + '.env.' + modo));
      const t = M.leerEnv(leer('guajirago/.env.' + modo));
      for (const k of M.LLAVES) assert.strictEqual(a[k], t[k], '⛔ ' + k + ' del panel (' + modo + ') no es la de transporte: el panel no tiene app web propia');
    }
  });

  it('firebase.js del panel ya no lleva llaves escritas: las pide al ambiente y comprueba la pareja', () => {
    const t = soloCodigo(leer(P + 'src/firebase.js'));
    assert.ok(!/projectId:\s*["']/.test(t) && !/apiKey:\s*["']AIza/.test(t), '⛔ quedan llaves escritas a mano en firebase.js del panel');
    for (const f of ['ambienteDe(', 'configFirebaseDe(', 'verificarPareja(']) assert.ok(t.includes(f), '⛔ firebase.js del panel no llama a ' + f);
    assert.match(t, /export const ambiente\b/, '⛔ firebase.js del panel no exporta el ambiente, y el cartel lo necesita');
  });

  it('la copia de pruebas del panel se ve: index.js pinta el cartel', () => {
    assert.match(soloCodigo(leer(P + 'src/index.js')), /<CartelAmbiente\s*\/>/, '⛔ index.js del panel no pinta el cartel');
  });

  it('el panel se compila por ambiente, y su .firebaserc manda el target admin a un sitio distinto en cada proyecto', () => {
    const pkg = JSON.parse(leer(P + 'package.json'));
    const s = pkg.scripts;
    assert.match(s['build:pruebas'], /env-cmd -f \.env\.pruebas react-scripts build/);
    assert.match(s['build:produccion'], /env-cmd -f \.env\.produccion react-scripts build/);
    assert.match(s.build, /build:produccion/, '⛔ `npm run build` a secas tiene que seguir siendo producción');
    assert.match(s.start, /\.env\.pruebas/, '⛔ el servidor de desarrollo del panel tiene que correr contra PRUEBAS, nunca contra producción');
    assert.ok((pkg.devDependencies || {})['env-cmd'], '⛔ env-cmd no está declarado en el panel');
    const rc = JSON.parse(leer(P + '.firebaserc'));
    assert.strictEqual(rc.projects.default, 'guajirago-pruebas', '⛔ un `firebase deploy` sin --project tiene que caer en pruebas, nunca en producción');
    assert.strictEqual(rc.projects.pruebas, 'guajirago-pruebas');
    assert.strictEqual(rc.projects.produccion, 'guajirago');
    assert.deepStrictEqual(rc.targets.guajirago.hosting.admin, ['guajirago-admin'], '⛔ en producción el target admin es el sitio guajirago-admin');
    assert.deepStrictEqual(rc.targets['guajirago-pruebas'].hosting.admin, ['guajirago-pruebas-admin'],
      '⛔ en pruebas el target admin tiene que ir a guajirago-pruebas-admin: en el sitio guajirago-pruebas vive la app de transporte');
    const fjt = leer(P + 'firebase.json');
    const fj = JSON.parse(fjt.charCodeAt(0) === 0xFEFF ? fjt.slice(1) : fjt); // el archivo empieza con BOM (trampa del 23-sep)
    assert.strictEqual(fj.hosting.target, 'admin', '⛔ firebase.json del panel ya no publica por el target admin');
  });
});
