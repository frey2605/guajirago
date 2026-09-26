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

  it('la llave de notificaciones del conductor y del pasajero sale del ambiente, no del código', () => {
    const t = soloCodigo(leer('guajirago/src/AppConductor.js'));
    assert.ok(!/vapidKey:\s*["']B/.test(t), '⛔ la vapidKey sigue escrita a mano en AppConductor.js');
    assert.match(t, /vapidKey:\s*process\.env\.REACT_APP_FIREBASE_VAPID_KEY/, '⛔ la vapidKey no se lee de REACT_APP_FIREBASE_VAPID_KEY');
    // El PASAJERO (Solicitar, Restaurantes, Turismo) y el conductor (registrarTokenFCM) piden el token en
    // Notificaciones.js, no en AppConductor.js. Hasta el 25-sep-2026 ese archivo llevaba la llave de PRODUCCIÓN
    // escrita a mano y este `it` no lo miraba: la compilación de pruebas pedía con la llave de producción el
    // token del pasajero y el del conductor, en verde. Se mira el archivo CRUDO (ni en un comentario), como ya
    // hace el de aliados.
    const crudo = leer('guajirago/src/Notificaciones.js');
    assert.ok(!/B[A-Za-z0-9_-]{80,}/.test(crudo), '⛔ la llave Web Push sigue escrita en guajirago/src/Notificaciones.js (ni en un comentario): el pasajero y el conductor de pruebas pedirían su token con la de producción');
    const n = soloCodigo(crudo);
    // Ancladas (`;` y `[},]`): sin ancla casan por prefijo, y `REACT_APP_FIREBASE_VAPID_KEY_PROD` o
    // `vapidKey: VAPID_KEY || RESPALDO` pasaban en verde (segunda opinión, 25-sep-2026).
    assert.match(n, /const VAPID_KEY = process\.env\.REACT_APP_FIREBASE_VAPID_KEY;/, '⛔ VAPID_KEY de Notificaciones.js no se lee de REACT_APP_FIREBASE_VAPID_KEY (exactamente ese nombre, y nada más)');
    const llamadas = (n.match(/getToken\(/g) || []).length;
    const conLaLlave = (n.match(/vapidKey:\s*VAPID_KEY\s*[},]/g) || []).length;
    assert.ok(llamadas >= 2 && conLaLlave === llamadas, '⛔ en Notificaciones.js hay ' + llamadas + ' getToken y ' + conLaLlave + ' usan VAPID_KEY: alguno pide el token con otra llave');
    // Y la llave de PRODUCCIÓN no puede estar en .env.pruebas bajo NINGÚN nombre, ni comentada: con otro nombre y un
    // process.env de ese nombre, todo lo de arriba pasaba (segunda opinión, 25-sep-2026).
    const laDeProduccion = M.leerEnv(leer('guajirago/.env.produccion')).REACT_APP_FIREBASE_VAPID_KEY;
    assert.ok(laDeProduccion && !leer('guajirago/.env.pruebas').includes(laDeProduccion), '⛔ la llave Web Push de PRODUCCIÓN aparece en guajirago/.env.pruebas (con cualquier nombre, o comentada): la compilación de pruebas la tendría a mano');
    assert.ok(M.leerEnv(leer('guajirago/.env.produccion')).REACT_APP_FIREBASE_VAPID_KEY,
      '⛔ producción se quedó sin su llave de notificaciones: los conductores dejarían de recibir avisos');
    const pruebas = M.leerEnv(leer('guajirago/.env.pruebas')).REACT_APP_FIREBASE_VAPID_KEY;
    assert.ok(pruebas, '⛔ pruebas se quedó sin su llave de notificaciones: el conductor de pruebas no recibiría avisos (la generó el dueño el 25-sep-2026)');
    // FORMA además de valor: la prueba lee el .env con leerEnv y la app con env-cmd, y no parsean igual (env-cmd quita
    // comillas y corta en #). Unas comillas o un «# ojo» al lado de la llave de PRODUCCIÓN pasaban el notStrictEqual de
    // abajo y la app compilaba con producción. Lo cazó la segunda opinión el 25-sep-2026. Una llave VAPID pública son
    // 87 caracteres base64url y empieza por B; lo que no tenga esa forma exacta no es una llave, es un disfraz.
    assert.match(pruebas, /^B[A-Za-z0-9_-]{86}$/, '⛔ la llave Web Push de pruebas no tiene forma de llave (comillas, espacios, un # al lado o un largo raro): la app la leería distinto a como la lee esta prueba');
    assert.notStrictEqual(pruebas, M.leerEnv(leer('guajirago/.env.produccion')).REACT_APP_FIREBASE_VAPID_KEY,
      '⛔ pruebas lleva la llave Web Push de PRODUCCIÓN: los avisos de prueba saldrían por el proyecto de verdad');
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

  it('el medidor dice que las tres apps tienen las 6 piezas (transporte b1c8a63, panel 0664217, aliados hoy)', () => {
    for (const m of M.medirTodas()) assert.strictEqual(m.puestas, 6, '⛔ ' + m.app + ': ' + m.porque.join(' · '));
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

    // Una llave Web Push pública son 87 caracteres base64url y empieza por B: 'BLcx' a secas ya no engaña al medidor.
    const LLAVE_DE_MENTIRA = 'B' + 'x'.repeat(86);
    const roturas = [
      ['una llave escrita a mano en src', (a) => { a['src/firebase.js'] += 'const x = { projectId: "guajirago" };\n'; }, 'sinLlavesEnSrc'],
      ['sin ambiente.js', (a) => { a['src/ambiente.js'] = null; }, 'ambienteJs'],
      ['.env.pruebas apuntando a producción', (a) => { a['.env.pruebas'] = a['.env.pruebas'].replace('PROJECT_ID=guajirago-pruebas', 'PROJECT_ID=guajirago'); }, 'envEnPareja'],
      ['.env.produccion sin el appId', (a) => { a['.env.produccion'] = a['.env.produccion'].replace(/^REACT_APP_FIREBASE_APP_ID=.*$/m, ''); }, 'envEnPareja'],
      ['los dos .env al mismo proyecto', (a) => { a['.env.produccion'] = a['.env.produccion'].replace('PROJECT_ID=guajirago', 'PROJECT_ID=guajirago-pruebas').replace('AMBIENTE=produccion', 'AMBIENTE=produccion'); }, 'envEnPareja'],
      ['build a secas sin ambiente', (a) => { a['package.json'] = a['package.json'].replace('npm run build:produccion', 'react-scripts build'); }, 'compilaPorAmbiente'],
      ['el alias produccion apuntando a pruebas', (a) => { a['.firebaserc'] = a['.firebaserc'].replace('"produccion":"guajirago"', '"produccion":"guajirago-pruebas"'); }, 'aliasFirebaserc'],
      ['la vapidKey escrita a mano', (a) => { a['src/firebase.js'] += "const v = { vapidKey: '" + LLAVE_DE_MENTIRA + "' };\n"; }, 'sinVapidEnSrc'],
      ['la llave Web Push en una constante, como estaba en Notificaciones.js de transporte hasta el 25-sep-2026', (a) => { a['src/Notificaciones.js'] = "const VAPID_KEY = '" + LLAVE_DE_MENTIRA + "';\n"; }, 'sinVapidEnSrc'],
      ['la llave Web Push en un comentario de src', (a) => { a['src/firebase.js'] += "// la de antes: " + LLAVE_DE_MENTIRA + "\n"; }, 'sinVapidEnSrc'],
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
//  EL PANEL Y ALIADOS · la misma fase 0, con la MISMA pieza
//
//  El panel (guajirago-admin) y aliados (guajirago-aliados) son otros repos, así
//  que no pueden importar guajirago/src/ambiente.js: llevan una COPIA. Una copia en
//  otro repo es el gemelo que se queda viejo (SEGUNDA LEY), y por eso aquí se ata
//  byte a byte: si se separan, rojo. Lo que la copia HACE ya está probado arriba
//  ejecutando la de transporte; aquí va lo que es de cada app: sus .env, su
//  firebase.js, su cartel, sus scripts y su .firebaserc, que además lleva TARGETS,
//  porque cada una publica en un sitio aparte y un target mal mapeado publica una
//  app ENCIMA de otra. En producción las tres comparten la app web de Firebase
//  (medido el 25-sep-2026 con hosting:sites:list): mismas llaves, distinto sitio.
// ═══════════════════════════════════════════════════════════════════════════
const HERMANAS = [
  { app: 'guajirago-admin', que: 'el panel', target: 'admin', sitios: { guajirago: 'guajirago-admin', 'guajirago-pruebas': 'guajirago-pruebas-admin' } },
  { app: 'guajirago-aliados', que: 'aliados', target: 'aliados', sitios: { guajirago: 'guajirago-aliados', 'guajirago-pruebas': 'guajirago-pruebas-aliados' } },
];
for (const { app, que, target, sitios } of HERMANAS) {
  describe('EL AMBIENTE (fase 0) · ' + que + ' (' + app + ') deduce igual, con la misma pieza', () => {
    const P = app + '/';

    it('ambiente.js y CartelAmbiente.js son byte a byte los de transporte: la copia está atada', () => {
      for (const f of ['src/ambiente.js', 'src/CartelAmbiente.js']) {
        assert.strictEqual(leer(P + f), leer('guajirago/' + f),
          '⛔ ' + P + f + ' se separó de guajirago/' + f + ': la copia se cambia en los dos sitios o se saca a una casa común');
      }
    });

    it('los dos .env están completos y en pareja: se pasan por la guardia de su propia copia', () => {
      const A = cargarDeLaApp(P + 'src/ambiente.js');
      for (const modo of ['pruebas', 'produccion']) {
        const e = M.leerEnv(leer(P + '.env.' + modo));
        const cfg = A.configFirebaseDe(e);
        assert.strictEqual(e.REACT_APP_AMBIENTE, modo, P + '.env.' + modo + ' no dice su ambiente');
        assert.strictEqual(A.verificarPareja(modo, cfg.projectId), true);
      }
      assert.strictEqual(M.leerEnv(leer(P + '.env.produccion')).REACT_APP_FIREBASE_PROJECT_ID, 'guajirago',
        '⛔ producción de ' + que + ' tiene que seguir siendo el proyecto guajirago');
      assert.strictEqual(M.leerEnv(leer(P + '.env.pruebas')).REACT_APP_FIREBASE_PROJECT_ID, 'guajirago-pruebas');
    });

    it('usa la MISMA app web de Firebase que transporte, en los dos ambientes', () => {
      for (const modo of ['pruebas', 'produccion']) {
        const a = M.leerEnv(leer(P + '.env.' + modo));
        const t = M.leerEnv(leer('guajirago/.env.' + modo));
        for (const k of M.LLAVES) assert.strictEqual(a[k], t[k], '⛔ ' + k + ' de ' + que + ' (' + modo + ') no es la de transporte: no tiene app web propia');
      }
    });

    it('firebase.js ya no lleva llaves escritas: las pide al ambiente y comprueba la pareja', () => {
      const t = soloCodigo(leer(P + 'src/firebase.js'));
      assert.ok(!/projectId:\s*["']/.test(t) && !/apiKey:\s*["']AIza/.test(t), '⛔ quedan llaves escritas a mano en firebase.js de ' + que);
      for (const f of ['ambienteDe(', 'configFirebaseDe(', 'verificarPareja(']) assert.ok(t.includes(f), '⛔ firebase.js de ' + que + ' no llama a ' + f);
      assert.match(t, /export const ambiente\b/, '⛔ firebase.js de ' + que + ' no exporta el ambiente, y el cartel lo necesita');
    });

    it('la copia de pruebas se ve: index.js pinta el cartel', () => {
      assert.match(soloCodigo(leer(P + 'src/index.js')), /<CartelAmbiente\s*\/>/, '⛔ index.js de ' + que + ' no pinta el cartel');
    });

    it('se compila por ambiente, y su .firebaserc manda el target a un sitio distinto en cada proyecto', () => {
      const pkg = JSON.parse(leer(P + 'package.json'));
      const s = pkg.scripts;
      assert.match(s['build:pruebas'], /env-cmd -f \.env\.pruebas react-scripts build/);
      assert.match(s['build:produccion'], /env-cmd -f \.env\.produccion react-scripts build/);
      assert.match(s.build, /build:produccion/, '⛔ `npm run build` a secas tiene que seguir siendo producción');
      assert.match(s.start, /\.env\.pruebas/, '⛔ el servidor de desarrollo de ' + que + ' tiene que correr contra PRUEBAS, nunca contra producción');
      assert.ok((pkg.devDependencies || {})['env-cmd'], '⛔ env-cmd no está declarado en ' + que);
      const rc = JSON.parse(leer(P + '.firebaserc'));
      assert.strictEqual(rc.projects.default, 'guajirago-pruebas', '⛔ un `firebase deploy` sin --project tiene que caer en pruebas, nunca en producción');
      assert.strictEqual(rc.projects.pruebas, 'guajirago-pruebas');
      assert.strictEqual(rc.projects.produccion, 'guajirago');
      assert.deepStrictEqual(rc.targets.guajirago.hosting[target], [sitios.guajirago], '⛔ en producción el target ' + target + ' es el sitio ' + sitios.guajirago);
      assert.deepStrictEqual(rc.targets['guajirago-pruebas'].hosting[target], [sitios['guajirago-pruebas']],
        '⛔ en pruebas el target ' + target + ' tiene que ir a ' + sitios['guajirago-pruebas'] + ': cada app tiene su sitio, y en guajirago-pruebas vive transporte');
      const fjt = leer(P + 'firebase.json');
      const fj = JSON.parse(fjt.charCodeAt(0) === 0xFEFF ? fjt.slice(1) : fjt); // los dos empiezan con BOM (trampa del 23-sep)
      assert.strictEqual(fj.hosting.target, target, '⛔ firebase.json de ' + que + ' ya no publica por el target ' + target);
    });
  });
}

// Lo que SOLO tiene aliados: una segunda conexión a Firebase para crear cuentas de empleados sin
// cerrar la sesión del dueño (firebaseSecundario.js), que llevaba las llaves COPIADAS a mano; y la
// llave Web Push con la que los negocios reciben el aviso de cada pedido, escrita en el código.
describe('EL AMBIENTE (fase 0) · lo que solo tiene aliados', () => {
  const P = 'guajirago-aliados/';

  it('la conexión secundaria (crear empleados) saca las llaves de la MISMA calculadora, no de una copia', () => {
    const t = soloCodigo(leer(P + 'src/firebaseSecundario.js'));
    assert.ok(!/projectId:\s*["']/.test(t) && !/apiKey:\s*["']AIza/.test(t), '⛔ quedan llaves escritas a mano en firebaseSecundario.js');
    assert.ok(t.includes('configFirebaseDe(process.env)'), '⛔ firebaseSecundario.js no le pide las llaves al ambiente');
    assert.match(t, /initializeApp\(firebaseConfig, ["']secundaria["']\)/, '⛔ la conexión secundaria tiene que seguir siendo una app aparte llamada «secundaria»');
  });

  it('la llave de notificaciones de los negocios sale del ambiente, no del código, y producción la conserva', () => {
    const crudo = leer(P + 'src/Notificaciones.js');
    assert.ok(!/B[A-Za-z0-9_-]{80,}/.test(crudo), '⛔ la llave Web Push sigue escrita en Notificaciones.js (ni en un comentario)');
    const t = soloCodigo(crudo);
    assert.match(t, /const VAPID_KEY = process\.env\.REACT_APP_FIREBASE_VAPID_KEY/, '⛔ VAPID_KEY no se lee de REACT_APP_FIREBASE_VAPID_KEY');
    assert.match(t, /vapidKey:\s*VAPID_KEY/, '⛔ getToken ya no usa VAPID_KEY');
    const prod = M.leerEnv(leer(P + '.env.produccion')).REACT_APP_FIREBASE_VAPID_KEY;
    assert.ok(prod, '⛔ producción de aliados se quedó sin su llave de notificaciones: los negocios dejarían de recibir los avisos de pedidos');
    assert.strictEqual(prod, M.leerEnv(leer('guajirago/.env.produccion')).REACT_APP_FIREBASE_VAPID_KEY,
      '⛔ la llave Web Push de aliados no es la del proyecto (la misma de transporte)');
    const pruebas = M.leerEnv(leer(P + '.env.pruebas')).REACT_APP_FIREBASE_VAPID_KEY;
    assert.ok(pruebas, '⛔ pruebas de aliados se quedó sin su llave de notificaciones: el negocio de pruebas no recibiría avisos de pedidos');
    assert.strictEqual(pruebas, M.leerEnv(leer('guajirago/.env.pruebas')).REACT_APP_FIREBASE_VAPID_KEY,
      '⛔ la llave Web Push de pruebas de aliados no es la del proyecto (la misma de transporte)');
  });
});
