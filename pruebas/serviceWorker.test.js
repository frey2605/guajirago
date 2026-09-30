// ═══════════════════════════════════════════════════════════════════════════
//  G31 · EL SERVICE WORKER DE AVISOS SALE DEL AMBIENTE (28-sep-2026)
//
//  El SW de avisos (firebase-messaging-sw.js) no lee `process.env`. Hasta hoy vivía en public/ de
//  transporte y de aliados con la configuración de PRODUCCIÓN escrita a mano, así que el sitio de
//  PRUEBAS servía `projectId: "guajirago"`. Ahora cada app lo GENERA al compilar
//  (sw/generar-sw.cjs), desde el mismo .env que la app y con configFirebaseDe de src/ambiente.js.
//
//  Lo que se prueba EJECUTANDO: el generador de cada app con los dos .env reales, sus negativas
//  (llave que falta, ambiente que no existe, proyecto de otro ambiente, plantilla con un campo de más
//  o de menos) y el generador corriendo como programa sobre una carpeta build/ de mentira.
//  Lo que se prueba por FORMA (es configuración): que package.json corra el generador DESPUÉS de
//  compilar y con el MISMO .env, y que la copia de aliados sea la de transporte. Y el medidor
//  (scripts/medir-service-worker.cjs) recibe apps de mentira para que no se pueda ablandar.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { leer, copiaIdentica } = require('./cargar.cjs');
const { leerEnv } = require('../scripts/medir-ambientes.cjs');
const M = require('../scripts/medir-service-worker.cjs');

const RAIZ = path.resolve(__dirname, '..');
const APPS = ['guajirago', 'guajirago-aliados'];
const PLANTILLA = 'sw/plantilla-firebase-messaging-sw.js';
const GENERADOR = 'sw/generar-sw.cjs';
const sinCR = (t) => String(t).replace(/\r\n/g, '\n');

function piezasDe(app) {
  leer(app + '/' + GENERADOR); // si falta el otro repo, lo dice con todas las letras
  const ruta = path.join(RAIZ, app, GENERADOR);
  delete require.cache[require.resolve(ruta)];
  const { generarServiceWorker } = require(ruta);
  const { configFirebaseDe } = require(path.join(RAIZ, app, 'src', 'ambiente.js'));
  const env = (amb) => leerEnv(leer(app + '/.env.' + amb));
  const manifest = leer(app + '/public/manifest.json');
  return { generarServiceWorker: (pl, e, m = manifest) => generarServiceWorker(pl, e, m), configFirebaseDe, env, plantilla: leer(app + '/' + PLANTILLA), manifest };
}

for (const app of APPS) {
  describe('G31 · ' + app + ' · el SW de avisos lleva la configuración de SU ambiente', () => {
    const P = piezasDe(app);

    for (const amb of ['pruebas', 'produccion']) {
      it('generado con .env.' + amb + ': sus seis valores son los de ese .env, y no queda ninguna marca sin llenar', () => {
        const env = P.env(amb);
        const sw = P.generarServiceWorker(P.plantilla, env);
        const esperado = P.configFirebaseDe(env);
        assert.deepStrictEqual(M.configDelSw(sw), esperado,
          '⛔ el SW de ' + amb + ' no lleva la configuración de .env.' + amb);
        assert.doesNotMatch(sw, /%[A-Za-z]+%/, '⛔ quedaron marcas %campo% sin llenar');
        assert.strictEqual(M.juzgarSw(sw, env, P.configFirebaseDe).ok, true);
      });
    }

    it('el de PRUEBAS no dice nada de producción, y el de PRODUCCIÓN nada de pruebas', () => {
      const prod = P.configFirebaseDe(P.env('produccion'));
      const swPruebas = P.generarServiceWorker(P.plantilla, P.env('pruebas'));
      const swProd = P.generarServiceWorker(P.plantilla, P.env('produccion'));
      for (const v of Object.values(prod)) assert.ok(!swPruebas.includes('"' + v + '"'),'⛔ el SW de pruebas lleva «' + v + '» de producción');
      assert.doesNotMatch(swProd, /pruebas/, '⛔ el SW de producción menciona pruebas');
      assert.match(swPruebas, /projectId: "guajirago-pruebas"/);
      assert.match(swProd, /projectId: "guajirago"/);
    });

    it('fuera de los seis renglones de la configuración, el SW es la plantilla tal cual (no se toca lo que ya servía)', () => {
      const sw = sinCR(P.generarServiceWorker(P.plantilla, P.env('produccion'))).split('\n');
      const pl = sinCR(P.plantilla).split('\n');
      assert.strictEqual(sw.length, pl.length);
      const distintos = pl.map((l, i) => (l === sw[i] ? null : l.trim().split(':')[0])).filter(Boolean);
      assert.deepStrictEqual(distintos.sort(), ['apiKey', 'appId', 'authDomain', 'badge', 'icon', 'messagingSenderId', 'projectId', 'storageBucket']);
    });

    it('se NIEGA en vez de generar a medias: llave que falta, ambiente que no existe, proyecto del otro ambiente', () => {
      const env = P.env('pruebas');
      const sinLlave = { ...env }; delete sinLlave.REACT_APP_FIREBASE_APP_ID;
      assert.throws(() => P.generarServiceWorker(P.plantilla, sinLlave), /Faltan llaves de Firebase: REACT_APP_FIREBASE_APP_ID/);
      assert.throws(() => P.generarServiceWorker(P.plantilla, { ...env, REACT_APP_AMBIENTE: undefined }), /Ambiente desconocido/,
        '⛔ generar sin ambiente (un build a secas) tiene que pararse');
      assert.throws(() => P.generarServiceWorker(P.plantilla, { ...P.env('produccion'), REACT_APP_AMBIENTE: 'pruebas' }), /no es un proyecto de pruebas/,
        '⛔ un SW de PRUEBAS con el proyecto de producción tiene que pararse');
    });

    it('la plantilla no puede pedir un campo que no existe ni dejarse uno sin usar', () => {
      const env = P.env('pruebas');
      assert.throws(() => P.generarServiceWorker(P.plantilla.replace('%appId%', '%appID%'), env), /pide «appID»/);
      assert.throws(() => P.generarServiceWorker(P.plantilla.replace('"%storageBucket%"', '"x"'), env), /no usa: storageBucket/);
    });

    it('corre como PROGRAMA: escribe build/firebase-messaging-sw.js con el ambiente recibido, y sin build/ se para', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g31-prog-'));
      after(() => fs.rmSync(tmp, { recursive: true, force: true }));
      fs.mkdirSync(path.join(tmp, 'sw')); fs.mkdirSync(path.join(tmp, 'src')); fs.mkdirSync(path.join(tmp, 'public'));
      fs.copyFileSync(path.join(RAIZ, app, 'public', 'manifest.json'), path.join(tmp, 'public', 'manifest.json'));
      fs.copyFileSync(path.join(RAIZ, app, GENERADOR), path.join(tmp, GENERADOR));
      fs.copyFileSync(path.join(RAIZ, app, PLANTILLA), path.join(tmp, PLANTILLA));
      fs.copyFileSync(path.join(RAIZ, app, 'src', 'ambiente.js'), path.join(tmp, 'src', 'ambiente.js'));
      const correr = () => spawnSync(process.execPath, [path.join(tmp, GENERADOR)], { encoding: 'utf8', env: { ...process.env, ...P.env('pruebas') } });
      const sinBuild = correr();
      assert.notStrictEqual(sinBuild.status, 0, '⛔ sin build/ tiene que fallar');
      assert.match(sinBuild.stderr, /No hay carpeta build/);
      fs.mkdirSync(path.join(tmp, 'build'));
      const r = correr();
      assert.strictEqual(r.status, 0, r.stderr);
      const escrito = fs.readFileSync(path.join(tmp, 'build', 'firebase-messaging-sw.js'), 'utf8');
      assert.deepStrictEqual(M.configDelSw(escrito), P.configFirebaseDe(P.env('pruebas')));
    });

    it('el repo cumple las cuatro piezas del medidor (sin SW en public/, plantilla sin valores, compila con el generador, el generador da su ambiente)', () => {
      const r = M.medirRepoApp(path.join(RAIZ, app));
      assert.deepStrictEqual(r.porque, []);
      assert.strictEqual(r.puestas, r.de);
    });
  });
}

describe('G31 · la copia de aliados es la de transporte (dos repos, una sola pieza)', () => {
  for (const f of [GENERADOR, PLANTILLA]) {
    it(f + ' es igual en guajirago y en guajirago-aliados', () => {
      copiaIdentica('guajirago-aliados/' + f, 'guajirago/' + f,
        '⛔ la copia de aliados se separó de la de transporte: se cambia en las dos o en ninguna');
    });
  }
});

describe('G31 · el medidor del service worker no se puede ablandar', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g31-medidor-'));
  after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  let n = 0;
  // Una app de mentira: la de transporte copiada (lo que el medidor mira), con un cambio.
  function appDeMentira(romper) {
    const dir = path.join(tmp, 'app' + (++n));
    for (const f of [GENERADOR, PLANTILLA, 'src/ambiente.js', '.env.pruebas', '.env.produccion', 'package.json', 'public/manifest.json', 'public/logo-icon-192.png']) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.copyFileSync(path.join(RAIZ, 'guajirago', f), path.join(dir, f));
    }
    const cambiar = (f, fn) => { const r = path.join(dir, f); fs.writeFileSync(r, fn(fs.readFileSync(r, 'utf8'))); };
    romper({ dir, cambiar });
    return M.medirRepoApp(dir);
  }
  const prod = leerEnv(leer('guajirago/.env.produccion'));

  it('la app de mentira SIN romper pasa (si no, las trampas de abajo no prueban nada)', () => {
    const r = appDeMentira(() => {});
    assert.deepStrictEqual(r.porque, []);
  });

  const TRAMPAS = [
    ['el SW vuelve a public/', ({ dir }) => { fs.mkdirSync(path.join(dir, 'public'), { recursive: true }); fs.copyFileSync(path.join(dir, PLANTILLA), path.join(dir, 'public', 'firebase-messaging-sw.js')); }, 'sinSwEnPublic'],
    ['la plantilla con el proyecto de producción a mano', ({ cambiar }) => cambiar(PLANTILLA, (t) => t.replace('"%projectId%"', '"' + prod.REACT_APP_FIREBASE_PROJECT_ID + '"')), 'plantillaSinValores'],
    ['la plantilla con una apiKey a mano', ({ cambiar }) => cambiar(PLANTILLA, (t) => t.replace('%apiKey%', 'AIza' + 'x'.repeat(35))), 'plantillaSinValores'],
    ['build:pruebas sin generador', ({ cambiar }) => cambiar('package.json', (t) => t.replace(' && env-cmd -f .env.pruebas node sw/generar-sw.cjs', '')), 'compilaConGenerador'],
    ['build:produccion genera con el .env de pruebas', ({ cambiar }) => cambiar('package.json', (t) => t.replace('env-cmd -f .env.produccion node sw/generar-sw.cjs', 'env-cmd -f .env.pruebas node sw/generar-sw.cjs')), 'compilaConGenerador'],
    ['el generador ANTES de compilar', ({ cambiar }) => cambiar('package.json', (t) => t.replace('"env-cmd -f .env.pruebas react-scripts build && env-cmd -f .env.pruebas node sw/generar-sw.cjs"', '"env-cmd -f .env.pruebas node sw/generar-sw.cjs && env-cmd -f .env.pruebas react-scripts build"')), 'compilaConGenerador'],
    ['el generador pone siempre producción', ({ cambiar }) => cambiar(GENERADOR, (t) => t.replace('return JSON.stringify(String(valores[campo])).slice(1, -1);', 'return ' + JSON.stringify(prod) + '["REACT_APP_FIREBASE_" + campo.replace(/[A-Z]/g, (m) => "_" + m).toUpperCase()];')), 'generadorDaSuAmbiente'],
    ['sin generador', ({ dir }) => fs.unlinkSync(path.join(dir, GENERADOR)), 'generadorDaSuAmbiente'],
    ['G93 · la plantilla con el logo viejo escrito a mano en icon', ({ cambiar }) => cambiar(PLANTILLA, (t) => t.replace("icon: '%icono%'", "icon: '/logo192.png'")), 'iconoDelManifest'],
    ['G93 · la plantilla con el logo viejo escrito a mano en badge', ({ cambiar }) => cambiar(PLANTILLA, (t) => t.replace("badge: '%icono%'", "badge: '/logo192.png'")), 'iconoDelManifest'],
    ['G93 · el manifest apunta a un ícono que no está en public/', ({ cambiar }) => cambiar('public/manifest.json', (t) => t.replace('"logo-icon-192.png"', '"no-existe-192.png"')), 'iconoDelManifest'],
  ];
  for (const [nombre, romper, pieza] of TRAMPAS) {
    it('se queja: ' + nombre, () => {
      const r = appDeMentira(romper);
      assert.strictEqual(r.piezas[pieza], false, '⛔ el medidor no vio «' + nombre + '»: ' + JSON.stringify(r.piezas));
    });
  }

  it('lo SERVIDO se juzga contra el .env de su ambiente: un SW de pruebas con la configuración de producción sale rojo', async () => {
    const pl = leer('guajirago/' + PLANTILLA);
    const { generarServiceWorker } = require(path.join(RAIZ, 'guajirago', GENERADOR));
    const man = leer('guajirago/public/manifest.json');
    const swProd = generarServiceWorker(pl, prod, man);
    const swPruebas = generarServiceWorker(pl, leerEnv(leer('guajirago/.env.pruebas')), man);
    // Un «internet» de mentira: cada sitio de pruebas sirve el SW de producción (lo que pasaba hasta el 28-sep-2026).
    const filas = await M.medirServido(RAIZ, async () => ({ text: async () => swProd }));
    assert.deepStrictEqual(filas.map((f) => [f.amb, f.ok]), [['pruebas', false], ['produccion', true], ['pruebas', false], ['produccion', true]]);
    const bien = await M.medirServido(RAIZ, async (url) => ({ text: async () => (/pruebas/.test(url) ? swPruebas : swProd) }));
    assert.ok(bien.every((f) => f.ok), JSON.stringify(bien.map((f) => [f.url, f.distintos])));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  G93 · LOS AVISOS LLEVAN EL ÍCONO DE LA APP INSTALADA (30-sep-2026)
//  Hasta ese día la plantilla del SW decía '/logo192.png' a mano, y en transporte ése era el logo VIEJO
//  (el naranja plano), mientras el manifest —el ícono de la app instalada— dice logo-icon-192.png (el nuevo,
//  degradado). Ahora el SW lo toma del manifest de cada app: una sola fuente.
// ═══════════════════════════════════════════════════════════════════════════
describe('G93 · el ícono de los avisos sale del manifest de cada app', () => {
  for (const app of APPS) {
    it(app + ': los avisos de los dos ambientes pintan (icon y badge) el ícono del manifest, y ese archivo está en public/', () => {
      const P = piezasDe(app);
      const { iconoDelManifest } = require(path.join(RAIZ, app, GENERADOR));
      const icono = iconoDelManifest(P.manifest);
      assert.ok(fs.existsSync(path.join(RAIZ, app, 'public', icono)), '⛔ ' + icono + ' no está en public/ de ' + app);
      for (const amb of ['pruebas', 'produccion']) {
        const sw = P.generarServiceWorker(P.plantilla, P.env(amb));
        assert.deepStrictEqual(M.iconosDelSw(sw), { icon: icono, badge: icono }, '⛔ los avisos de ' + app + '/' + amb + ' no llevan el ícono del manifest');
      }
    });
  }

  it('transporte: el aviso lleva el logo NUEVO (logo-icon-192.png, el mismo del apple-touch-icon), no el viejo logo192.png', () => {
    const P = piezasDe('guajirago');
    const sw = P.generarServiceWorker(P.plantilla, P.env('produccion'));
    assert.deepStrictEqual(M.iconosDelSw(sw), { icon: '/logo-icon-192.png', badge: '/logo-icon-192.png' });
    assert.match(leer('guajirago/public/index.html'), /rel="apple-touch-icon" href="%PUBLIC_URL%\/logo-icon-192\.png"/);
    assert.ok(!fs.readFileSync(path.join(RAIZ, 'guajirago/public/logo-icon-192.png')).equals(fs.readFileSync(path.join(RAIZ, 'guajirago/public/logo192.png'))),
      'los dos archivos son distintos: por eso importaba');
  });

  it('una sola fuente: si el manifest cambia de ícono, el aviso cambia con él (sin tocar la plantilla)', () => {
    const P = piezasDe('guajirago');
    const otro = JSON.stringify({ icons: [{ src: 'otro-512.png', sizes: '512x512', type: 'image/png' }, { src: './marca/otro-192.png', sizes: '192x192', type: 'image/png' }] });
    assert.deepStrictEqual(M.iconosDelSw(P.generarServiceWorker(P.plantilla, P.env('pruebas'), otro)), { icon: '/marca/otro-192.png', badge: '/marca/otro-192.png' });
  });

  it('iconoDelManifest se NIEGA en vez de adivinar: sin PNG de 192, ruta rara, sin manifest; y tolera la marca BOM', () => {
    const { iconoDelManifest } = require(path.join(RAIZ, 'guajirago', GENERADOR));
    assert.throws(() => iconoDelManifest(JSON.stringify({ icons: [{ src: 'a.png', sizes: '512x512' }] })), /no declara un ícono PNG de 192x192/);
    assert.throws(() => iconoDelManifest(JSON.stringify({ icons: [{ src: 'favicon.ico', sizes: '192x192' }] })), /no declara un ícono PNG de 192x192/);
    assert.throws(() => iconoDelManifest(JSON.stringify({ icons: [{ src: "x.png' });alert(1);//.png", sizes: '192x192' }] })), /ruta rara/);
    assert.throws(() => iconoDelManifest(undefined), /no declara/);
    assert.strictEqual(iconoDelManifest(String.fromCharCode(0xFEFF) + leer('guajirago/public/manifest.json')), '/logo-icon-192.png');
    assert.strictEqual(iconoDelManifest(leer('guajirago-aliados/public/manifest.json')), '/logo192.png');
  });

  it('lo SERVIDO: un sitio cuyo aviso pinta el logo viejo sale rojo, y uno que pinta el del manifest (bajado igual a public/) sale verde', async () => {
    const genera = (P) => P.generarServiceWorker(P.plantilla, P.env('produccion'));
    const internet = (swDe, imagenDe = (app, archivo) => fs.readFileSync(path.join(RAIZ, app, 'public', archivo))) => async (url) => {
      const u = url.split('?')[0];
      const app = /aliados/.test(u) ? 'guajirago-aliados' : 'guajirago';
      const P = piezasDe(app);
      let buf;
      if (u.endsWith('/firebase-messaging-sw.js')) buf = Buffer.from(swDe(P));
      else if (u.endsWith('/manifest.json')) buf = Buffer.from(P.manifest);
      else buf = imagenDe(app, u.replace(/^https:\/\/[^/]+\//, ''));
      return { ok: true, headers: { get: () => '' }, arrayBuffer: async () => buf };
    };
    const soloTransporteRojo = [['guajirago', 'pruebas', false], ['guajirago', 'produccion', false], ['guajirago-aliados', 'pruebas', true], ['guajirago-aliados', 'produccion', true]];
    const casos = [
      ['icon y badge con el logo viejo', internet((P) => genera(P).replace(/'\/logo-icon-192\.png'/g, "'/logo192.png'"))],
      ['solo el icon con el logo viejo', internet((P) => genera(P).replace("icon: '/logo-icon-192.png'", "icon: '/logo192.png'"))],
      ['solo el badge con el logo viejo', internet((P) => genera(P).replace("badge: '/logo-icon-192.png'", "badge: '/logo192.png'"))],
      ['el sitio sirve en logo-icon-192.png la imagen VIEJA', internet(genera, (app, f) => fs.readFileSync(path.join(RAIZ, app, 'public', f === 'logo-icon-192.png' ? 'logo192.png' : f)))],
      ['el sitio sirve en logo-icon-192.png algo que no es PNG', internet(genera, (app, f) => (f === 'logo-icon-192.png' ? Buffer.from('<html>no está</html>') : fs.readFileSync(path.join(RAIZ, app, 'public', f))))],
    ];
    for (const [nombre, red] of casos) {
      const filas = await M.medirIconoServido(RAIZ, red);
      assert.deepStrictEqual(filas.map((f) => [f.app, f.amb, f.ok]), soloTransporteRojo, '⛔ el medidor no vio «' + nombre + '»');
    }
    const bien = await M.medirIconoServido(RAIZ, internet(genera));
    assert.ok(bien.every((f) => f.ok && f.esPng && f.igualAlRepo), JSON.stringify(bien));
  });
});
