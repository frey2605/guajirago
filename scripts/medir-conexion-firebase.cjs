#!/usr/bin/env node
/**
 * MEDIR LA CONEXIÓN A FIREBASE DE LAS TRES APPS — gemelo G65 (29-sep-2026).
 * Solo LEE código (del disco o de un commit de cada repo). No lee ni escribe datos, no toca la red.
 *
 *   node scripts/medir-conexion-firebase.cjs                                                  <- el código de hoy (el disco)
 *   node scripts/medir-conexion-firebase.cjs --commit <raíz> --admin <hash> --aliados <hash>  <- el de otros commits (careo)
 *   node scripts/medir-conexion-firebase.cjs --json                                           <- el resultado entero
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  `src/firebase.js` arranca la conexión de cada app (transporte, panel y aliados). Estaba copiado en las tres, y lo
 *  vigilaban solo por FORMA (que el texto nombre tal función). Este medidor lo CORRE: saca el archivo, le cambia los
 *  `import` de `firebase/*` por un Firebase de mentira que apunta todo lo que se le pide, le da el `ambiente.js` DE
 *  VERDAD de esa app y el `.env.pruebas` / `.env.produccion` de esa app, y mira:
 *   1. cuántas versiones distintas del archivo hay entre las tres apps (antes de G65: 2);
 *   2. con qué configuración se conecta (tiene que ser la de `configFirebaseDe` de ese .env), en qué ORDEN arranca
 *      los servicios (App Check antes de la base), con qué llave de App Check, y qué exporta;
 *   3. si el navegador NO deja guardar los datos en el aparato (trabajar sin señal), ¿la conexión lo dice? Dos formas
 *      de fallar: la respuesta rechazada, y la de esta versión de Firebase, que no rechaza sino que escribe en su
 *      registro «Falling back to memory cache». Si ninguna llega a `trabajoSinSenal`, se calla (REGLA 9);
 *   4. si la pieza que sella con App Check sella LA CONEXIÓN QUE RECIBE (aliados tiene dos).
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre el Firebase de verdad ni compila: el Firebase es de mentira y solo apunta lo que se le pide.
 *   · No mira si la ventanita de «sin señal» se pinta: eso es de `AvisoSinSenal.js`, que hoy solo tiene aliados.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { leerEnv } = require('./medir-ambientes.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const AMBIENTES = ['pruebas', 'produccion'];
const APPS = [
  { nombre: 'transporte', carpeta: 'guajirago' },
  { nombre: 'panel', carpeta: 'guajirago-admin' },
  { nombre: 'aliados', carpeta: 'guajirago-aliados' },
];

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo del disco, o del commit de SU repo (admin y aliados son repos aparte). */
function lector(commits = {}) {
  return (r) => {
    const repo = r.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : r.startsWith('guajirago-admin/') ? 'guajirago-admin' : null;
    const commit = repo === 'guajirago-aliados' ? commits.aliados : repo === 'guajirago-admin' ? commits.admin : commits.raiz;
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      const cwd = repo ? path.join(RAIZ, repo) : RAIZ;
      const ruta = repo ? r.slice(repo.length + 1) : r;
      return execFileSync('git', ['show', commit + ':' + ruta], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { return null; }
  };
}

/** Un Firebase de mentira: cada llamada queda apuntada en `pasos`, y la persistencia hace lo que diga el caso. */
function firebaseDeMentira(caso) {
  const pasos = [];
  const oyentes = [];
  let persistencia = null;
  const m = {
    'firebase/app': {
      initializeApp: (cfg, nombre) => { const a = { nombre: nombre || '[DEFAULT]' }; pasos.push(['initializeApp', a.nombre, cfg]); return a; },
      onLog: (cb, opciones) => { pasos.push(['onLog', opciones && opciones.level]); oyentes.push(cb); },
    },
    'firebase/firestore': {
      getFirestore: (app) => { pasos.push(['getFirestore', app.nombre]); return { base: app.nombre }; },
      enableIndexedDbPersistence: (db) => {
        pasos.push(['enableIndexedDbPersistence', db.base]);
        persistencia = caso === 'rechaza' ? Promise.reject(Object.assign(new Error('x'), { code: 'failed-precondition' })) : Promise.resolve();
        return persistencia;
      },
    },
    'firebase/auth': {
      initializeAuth: (app, op) => { pasos.push(['initializeAuth', app.nombre, op && op.persistence]); return { settings: {} }; },
      browserLocalPersistence: 'local',
    },
    'firebase/messaging': { getMessaging: (app) => { pasos.push(['getMessaging', app.nombre]); return { mensajeria: app.nombre }; } },
    'firebase/storage': { getStorage: (app) => { pasos.push(['getStorage', app.nombre]); return { almacen: app.nombre }; } },
    'firebase/app-check': {
      initializeAppCheck: (app, op) => {
        pasos.push(['initializeAppCheck', app.nombre, op.provider && op.provider.llave, op.isTokenAutoRefreshEnabled]);
      },
      ReCaptchaEnterpriseProvider: function ReCaptchaEnterpriseProvider(llave) { this.llave = llave; },
    },
  };
  return { modulos: m, pasos, oyentes, persistencia: () => persistencia };
}

/**
 * Corre el texto de un firebase.js con el Firebase de mentira, el ambiente.js de verdad y un .env.
 * Devuelve lo que exporta, lo que pidió en orden, y si la conexión dice algo en cada caso de «sin señal».
 */
async function correr(texto, ambienteTexto, env, caso = 'bien') {
  const fb = firebaseDeMentira(caso);
  const t = String(texto).replace(/\r\n/g, '\n');
  const locales = {};
  const sinImports = t.replace(/^import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?[ \t]*$/gm, (_, lista, mod) => {
    const origen = mod === './ambiente' ? cargarDeLaApp('ambiente.js', ambienteTexto) : fb.modulos[mod];
    if (!origen) throw new Error('firebase.js pide un módulo que el medidor no conoce: ' + mod);
    for (const n of lista.split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!(n in origen)) throw new Error('firebase.js pide «' + n + '» a ' + mod + ', y no existe');
      locales[n] = origen[n];
    }
    return '';
  });
  if (/^\s*import\b/m.test(sinImports)) throw new Error('firebase.js tiene un import que el medidor no sabe leer');
  const exportados = [...sinImports.matchAll(/^export\s+(?:const|function|let)\s+([A-Za-z0-9_]+)/gm)].map((x) => x[1]);
  const cuerpo = sinImports.replace(/^export\s+/gm, '');
  const claves = Object.keys(locales);
  // eslint-disable-next-line no-new-func
  const hecho = new Function('process', ...claves, cuerpo + '\nreturn { ' + exportados.join(', ') + ' };')({ env }, ...claves.map((k) => locales[k]));
  if (caso === 'cae-a-memoria') {
    // Lo que hace Firebase 12 cuando no puede guardar en el aparato: no rechaza, lo escribe en su registro.
    for (const cb of fb.oyentes) cb({ level: 'warn', message: 'Error using user provided cache. Falling back to memory cache: FirebaseError: [code=unimplemented]: x' });
  }
  const p = fb.persistencia();
  if (p) await p.catch(() => {});
  let seEntera = 'nunca';
  if (hecho.trabajoSinSenal && typeof hecho.trabajoSinSenal.then === 'function') {
    seEntera = await Promise.race([hecho.trabajoSinSenal, new Promise((r) => setTimeout(() => r('nunca'), 30))]);
  }
  const alArrancar = fb.pasos.slice(); // lo que hizo el arranque, antes de probar la pieza con otra conexión
  let sellaLaQueRecibe = null;
  if (typeof hecho.sellarConAppCheck === 'function') {
    const antes = fb.pasos.length;
    hecho.sellarConAppCheck({ nombre: 'secundaria' });
    const nuevos = fb.pasos.slice(antes).filter((x) => x[0] === 'initializeAppCheck');
    sellaLaQueRecibe = nuevos.length === 0 ? 'sin llave' : nuevos.every((x) => x[1] === 'secundaria');
  }
  return {
    exporta: exportados.slice().sort(),
    pasos: alArrancar,
    verificacionDePrueba: hecho.auth && hecho.auth.settings ? hecho.auth.settings.appVerificationDisabledForTesting : undefined,
    ambiente: hecho.ambiente && hecho.ambiente.nombre,
    proyecto: hecho.proyecto,
    seEntera,
    sellaLaQueRecibe,
  };
}

/** Todo lo que se mide, con los textos de un lector (disco o commits). */
async function medir(leerArchivo = lector()) {
  const apps = [];
  for (const a of APPS) {
    const texto = leerArchivo(a.carpeta + '/src/firebase.js');
    const ambienteTexto = leerArchivo(a.carpeta + '/src/ambiente.js');
    const A = cargarDeLaApp('ambiente.js', ambienteTexto);
    const porAmbiente = {};
    let exporta = null;
    for (const amb of AMBIENTES) {
      const env = leerEnv(fs.readFileSync(path.join(RAIZ, a.carpeta, '.env.' + amb), 'utf8'));
      const bien = await correr(texto, ambienteTexto, env, 'bien');
      exporta = exporta || bien.exporta;
      const inicio = bien.pasos.find((x) => x[0] === 'initializeApp');
      const iCheck = bien.pasos.findIndex((x) => x[0] === 'initializeAppCheck');
      const iBase = bien.pasos.findIndex((x) => x[0] === 'getFirestore');
      const rechaza = await correr(texto, ambienteTexto, env, 'rechaza');
      const memoria = await correr(texto, ambienteTexto, env, 'cae-a-memoria');
      porAmbiente[amb] = {
        configBuena: JSON.stringify(inicio && inicio[2]) === JSON.stringify(A.configFirebaseDe(env)),
        appCheckBien: A.llaveAppCheckDe(env)
          ? bien.pasos.filter((x) => x[0] === 'initializeAppCheck').length === 1 && iCheck < iBase
            && bien.pasos[iCheck][1] === '[DEFAULT]' && bien.pasos[iCheck][2] === A.llaveAppCheckDe(env)
          : iCheck < 0,
        llaveAppCheck: iCheck >= 0 ? bien.pasos[iCheck][2] : null,
        // Lo que arranca, en orden, SIN el oyente del registro (que es parte del «sin señal», no de la conexión).
        firma: JSON.stringify({ pasos: bien.pasos.filter((x) => x[0] !== 'onLog'), v: bien.verificacionDePrueba, amb: bien.ambiente, p: bien.proyecto }),
        conSenalCalla: bien.seEntera === 'nunca',
        rechazaSeEntera: rechaza.seEntera,
        memoriaSeEntera: memoria.seEntera,
        sellaLaQueRecibe: bien.sellaLaQueRecibe,
      };
    }
    apps.push({ app: a.nombre, texto: String(texto || '').replace(/\r\n/g, '\n'), exporta, porAmbiente });
  }
  const versiones = new Set(apps.map((x) => x.texto)).size;
  const casos = apps.flatMap((x) => AMBIENTES.map((amb) => ({ app: x.app, amb, ...x.porAmbiente[amb] })));
  const callados = casos.flatMap((c) => [
    c.rechazaSeEntera === 'nunca' ? c.app + '/' + c.amb + ' (la respuesta rechaza)' : null,
    c.memoriaSeEntera === 'nunca' ? c.app + '/' + c.amb + ' (Firebase cae a memoria)' : null,
  ]).filter(Boolean);
  return {
    versiones,
    exportsDistintos: new Set(apps.map((x) => x.exporta.join(','))).size,
    configBuena: casos.filter((c) => c.configBuena).length,
    appCheckBien: casos.filter((c) => c.appCheckBien).length,
    callados,
    avisaSinProblema: casos.filter((c) => !c.conSenalCalla).length,
    sellaMal: casos.filter((c) => c.sellaLaQueRecibe === false).length,
    casos: casos.length,
    apps: apps.map((x) => ({ app: x.app, exporta: x.exporta, porAmbiente: x.porAmbiente })),
  };
}

module.exports = { medir, correr, lector, firebaseDeMentira, APPS, AMBIENTES };

if (require.main === module) {
  (async () => {
    const commits = { raiz: argumento('--commit'), admin: argumento('--admin'), aliados: argumento('--aliados') };
    const r = await medir(lector(commits));
    if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 1)); return; }
    const de = Object.values(commits).some(Boolean) ? 'commits ' + JSON.stringify(commits) : 'el disco';
    console.log('\nLA CONEXIÓN A FIREBASE DE LAS TRES APPS (G65) — código de ' + de + '\n');
    console.log('  Versiones distintas de src/firebase.js entre las tres apps: ' + r.versiones);
    console.log('  Listas distintas de lo que exporta:                         ' + r.exportsDistintos);
    for (const a of r.apps) console.log('    · ' + a.app.padEnd(10) + ' exporta: ' + a.exporta.join(', '));
    console.log('  Casos con la configuración del .env (configFirebaseDe):     ' + r.configBuena + ' de ' + r.casos);
    console.log('  Casos con App Check bien (su llave, una vez, antes de la base): ' + r.appCheckBien + ' de ' + r.casos);
    console.log('  Casos en que la pieza de App Check sella otra conexión:     ' + r.sellaMal);
    console.log('  Avisos de «sin señal» sin que haya problema:                ' + r.avisaSinProblema);
    console.log('  Casos en que no poder trabajar sin señal se CALLA:          ' + r.callados.length + ' de ' + r.casos * 2);
    for (const c of r.callados) console.log('    · ' + c);
    const bien = r.versiones === 1 && r.configBuena === r.casos && r.appCheckBien === r.casos && !r.callados.length && !r.sellaMal && !r.avisaSinProblema;
    console.log('\n  ' + (bien ? '✓ una sola conexión, y se porta igual y bien en las tres apps y los dos ambientes' : '⚠ hay algo que mirar (arriba)') + '\n');
  })().catch((e) => { console.error(e); process.exit(1); });
}
