#!/usr/bin/env node
/**
 * ¿CUÁNTO DE LA FASE 0 ESTÁ PUESTO EN CADA APP? — SOLO LEE.
 *
 *   node scripts/medir-ambientes.cjs
 *
 * La fase 0 del plan (plan/05-AMBIENTE-DE-PRUEBAS.md) es «dos proyectos Firebase,
 * y el ambiente se deduce de cómo se compila, nunca a mano». Aquí se cuenta, app
 * por app, qué piezas están puestas. Es el guion del paso 1 y del paso 12 de esa
 * fase: se corre antes y después, y el amarre (pruebas/elAmbiente.test.js) lo importa
 * y le da árboles de mentira para que no se pueda ablandar.
 *
 * SEIS PIEZAS por app:
 *   1 · sin llaves de Firebase escritas a mano en src (ni projectId ni apiKey de Google)
 *   2 · src/ambiente.js existe y se puede CORRER (ambienteDe, configFirebaseDe, verificarPareja)
 *   3 · .env.pruebas y .env.produccion completos, cada uno con su ambiente y su proyecto EN
 *       PAREJA — se comprueba CORRIENDO el verificarPareja de la propia app, no comparando textos
 *   4 · package.json compila por ambiente: build:pruebas y build:produccion, y build va a producción
 *   5 · .firebaserc con los alias pruebas y produccion
 *   6 · sin llave de notificaciones (vapidKey) escrita a mano en src
 *
 * Lo que NO mide: si guajirago-pruebas existe en la nube ni qué tiene dentro. Eso lo
 * dice `npx firebase-tools@15 projects:list`, y se anota aparte.
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const APPS = ['guajirago', 'guajirago-admin', 'guajirago-aliados'];
const LLAVES = ['REACT_APP_AMBIENTE', 'REACT_APP_FIREBASE_API_KEY', 'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID', 'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID', 'REACT_APP_FIREBASE_APP_ID'];

/** Un .env como objeto. Las líneas con # son comentarios; una llave vacía cuenta como ausente. */
function leerEnv(texto) {
  const o = {};
  for (const l of texto.split(/\r?\n/)) {
    if (l.trim().startsWith('#')) continue;
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && m[2] !== '') o[m[1]] = m[2];
  }
  return o;
}

const existe = (r) => fs.existsSync(r);
const leer = (r) => (existe(r) ? fs.readFileSync(r, 'utf8') : '');
const sinBom = (t) => (t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t);
const json = (r) => { try { return JSON.parse(sinBom(leer(r))); } catch (e) { return null; } };

/** Los .js de src con su texto (sin bajar a subcarpetas: las llaves viven arriba). */
function archivosDeSrc(app) {
  const dir = path.join(app, 'src');
  if (!existe(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .map((f) => ({ nombre: f, texto: leer(path.join(dir, f)) }));
}

/** Carga src/ambiente.js tal cual está escrito (no lleva imports) y devuelve sus funciones, o null. */
function cargarAmbiente(app) {
  const ruta = path.join(app, 'src', 'ambiente.js');
  if (!existe(ruta)) return null;
  const fuente = leer(ruta);
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  try {
    // eslint-disable-next-line no-new-func
    return new Function(fuente.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
  } catch (e) {
    return null;
  }
}

/**
 * Mide UNA app (`app` es la ruta de su carpeta). Devuelve las seis piezas (true/false),
 * cuántas están puestas y, por cada una que falla, el porqué en palabras.
 */
function medirApp(app) {
  const src = archivosDeSrc(app);
  const porque = [];
  const piezas = {};

  // 1 · llaves escritas a mano en src
  const aMano = src.filter((f) => /projectId:\s*["']|apiKey:\s*["']AIza/.test(f.texto)).map((f) => f.nombre);
  piezas.sinLlavesEnSrc = aMano.length === 0;
  if (!piezas.sinLlavesEnSrc) porque.push('llaves de Firebase escritas a mano en: ' + aMano.join(', '));

  // 2 · un ambiente.js que corre
  const amb = cargarAmbiente(app);
  const corre = !!(amb && typeof amb.ambienteDe === 'function'
    && typeof amb.configFirebaseDe === 'function' && typeof amb.verificarPareja === 'function');
  piezas.ambienteJs = corre;
  if (!corre) porque.push('no hay src/ambiente.js que se pueda correr (ambienteDe, configFirebaseDe, verificarPareja)');

  // 3 · los dos .env, completos y en pareja, corriendo la guardia de la propia app
  const envs = {};
  const malos = [];
  for (const modo of ['pruebas', 'produccion']) {
    const ruta = path.join(app, '.env.' + modo);
    if (!existe(ruta)) { malos.push('.env.' + modo + ' no existe'); continue; }
    const e = leerEnv(leer(ruta));
    envs[modo] = e;
    const faltan = LLAVES.filter((k) => !e[k]);
    if (faltan.length) { malos.push('.env.' + modo + ' sin ' + faltan.join(', ')); continue; }
    if (e.REACT_APP_AMBIENTE !== modo) { malos.push('.env.' + modo + ' dice REACT_APP_AMBIENTE=' + e.REACT_APP_AMBIENTE); continue; }
    if (corre) {
      try { amb.configFirebaseDe(e); amb.verificarPareja(modo, e.REACT_APP_FIREBASE_PROJECT_ID); }
      catch (x) { malos.push('.env.' + modo + ': ' + x.message); }
    }
  }
  if (envs.pruebas && envs.produccion
    && envs.pruebas.REACT_APP_FIREBASE_PROJECT_ID === envs.produccion.REACT_APP_FIREBASE_PROJECT_ID) {
    malos.push('los dos .env apuntan al MISMO proyecto');
  }
  piezas.envEnPareja = corre && malos.length === 0;
  if (malos.length) porque.push(...malos);
  else if (!corre) porque.push('los .env no se pudieron carear: falta ambiente.js');

  // 4 · compila por ambiente
  const s = (json(path.join(app, 'package.json')) || {}).scripts || {};
  const compila = /\.env\.pruebas\b/.test(s['build:pruebas'] || '')
    && /\.env\.produccion\b/.test(s['build:produccion'] || '')
    && /build:produccion/.test(s.build || '');
  piezas.compilaPorAmbiente = compila;
  if (!compila) porque.push('package.json sin build:pruebas (.env.pruebas), build:produccion (.env.produccion) o build → build:produccion');

  // 5 · alias en .firebaserc
  const pr = (json(path.join(app, '.firebaserc')) || {}).projects || {};
  const alias = /pruebas/.test(pr.pruebas || '') && !!pr.produccion && !/pruebas/.test(pr.produccion);
  piezas.aliasFirebaserc = alias;
  if (!alias) porque.push('.firebaserc sin alias pruebas (→ un proyecto de pruebas) y produccion (→ el de verdad)');

  // 6 · la llave de notificaciones a mano
  const vapid = src.filter((f) => /vapidKey:\s*["']B/.test(f.texto)).map((f) => f.nombre);
  piezas.sinVapidEnSrc = vapid.length === 0;
  if (!piezas.sinVapidEnSrc) porque.push('llave de notificaciones (vapidKey) escrita a mano en: ' + vapid.join(', '));

  const puestas = Object.values(piezas).filter(Boolean).length;
  return { app: path.basename(app), piezas, puestas, de: Object.keys(piezas).length, porque };
}

function medirTodas(raiz = RAIZ) {
  return APPS.map((a) => medirApp(path.join(raiz, a)));
}

module.exports = { medirApp, medirTodas, leerEnv, APPS, LLAVES };

if (require.main === module) {
  console.log('== FASE 0 · ¿cuánto del ambiente de pruebas está puesto? · medido ' + new Date().toISOString());
  for (const m of medirTodas()) {
    console.log('\n' + m.app + ': ' + m.puestas + ' de ' + m.de + ' piezas' + (m.puestas === m.de ? ' ✓' : ''));
    for (const [k, v] of Object.entries(m.piezas)) console.log('   ' + (v ? '✓' : '✗') + ' ' + k);
    for (const p of m.porque) console.log('     ↳ ' + p);
  }
  console.log('\nLo que esto NO mide: si guajirago-pruebas existe en la nube ni qué tiene dentro '
    + '(`npx firebase-tools@15 projects:list`).');
}
