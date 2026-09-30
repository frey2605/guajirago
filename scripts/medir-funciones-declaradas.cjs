#!/usr/bin/env node
/**
 * ☁️ LAS FUNCIONES, DECLARADAS DOS VECES — gemelo G101 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-funciones-declaradas.cjs              el código del disco
 *   node scripts/medir-funciones-declaradas.cjs --commit X   el código de un commit (p. ej. el de antes de G101)
 *
 * Hay DOS firebase.json que declaran las funciones del servidor, y cada uno tiene su trabajo:
 *
 *   · guajirago/firebase.json — el que PUBLICA. Las funciones se publican desde dentro de `guajirago/`: lo hace
 *     herramientas/publicar-funciones.sh (copia limpia con `git archive <commit> guajirago`, que ni siquiera trae
 *     el firebase.json de la raíz) y lo hacía el botón apagado .github/workflows/desplegar-funciones.yml
 *     (`working-directory: guajirago`).
 *   · firebase.json de la RAÍZ — el que usa el EMULADOR de `npm test` (pruebas/correr.cjs corre
 *     `emulators:exec --only firestore,functions,storage` con `cwd: RAIZ`). Sin su sección `functions`,
 *     pruebas/funciones.test.js no tendría funciones que encender.
 *
 * Los dos hacen falta, así que no se borra ninguno: se ATAN. pruebas/funcionesDeclaradas.test.js exige que
 * declaren lo MISMO, entendido como lo entiende `firebase` (un objeto suelto vale lo que una lista de uno, el
 * `codebase` que falta es "default", y `source` se lee desde la carpeta de su firebase.json).
 *
 * Lo que mide:
 *   1. Qué declara cada uno, ya normalizado, y en qué opciones difieren.
 *   2. Si firebase-tools está en la caché de npx, le pide a SU normalizador lo mismo (careo: que mi lectura sea la suya).
 *   3. Lo que viaja al publicar: qué firebase.json entra en `git archive <commit> guajirago`, y su huella.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const DE_LA_RAIZ = 'firebase.json';       // lo usa el emulador de npm test
const DE_LA_APP = 'guajirago/firebase.json'; // lo usa el que publica
const ANTES = 'f29bf8b'; // el último commit antes de G101

/** Lee un archivo del disco o de un commit. */
function lector(commit) {
  return (r) => {
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r],
        { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { return null; }
  };
}

/** JSON sin la marca invisible (BOM) del principio: `JSON.parse` revienta con ella. */
function leerJson(texto) {
  let t = texto;
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  return JSON.parse(t);
}

/**
 * Lo que `firebase` entiende de la sección `functions` de un firebase.json que vive en `carpeta` (relativa a la
 * raíz del repo): una lista, cada entrada con su `codebase` (el que falta es "default") y su `source` leída desde
 * la raíz del repo. Devuelve un objeto codebase → entrada, con las claves en orden, para poder compararlo.
 * Si no declara funciones devuelve null.
 */
function normalizar(config, carpeta) {
  const f = config && config.functions;
  if (!f) return null;
  const lista = Array.isArray(f) ? f : [f];
  const salida = {};
  for (const e of lista) {
    const x = { ...e, codebase: e.codebase || 'default' };
    if (typeof x.source === 'string') x.source = path.posix.normalize(path.posix.join(carpeta, x.source));
    const ordenado = {};
    for (const k of Object.keys(x).sort()) ordenado[k] = x[k];
    salida[x.codebase] = ordenado;
  }
  return salida;
}

/** Las opciones en que difieren dos declaraciones normalizadas: [{ codebase, opcion, raiz, app }]. */
function diferencias(a, b) {
  const out = [];
  const bases = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const cb of [...bases].sort()) {
    const x = (a || {})[cb] || {};
    const y = (b || {})[cb] || {};
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
      if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push({ codebase: cb, opcion: k, raiz: x[k], app: y[k] });
    }
  }
  return out;
}

/** Mide las dos declaraciones desde sus textos (el amarre le da textos de mentira). */
function medirTextos(textoRaiz, textoApp) {
  const raiz = textoRaiz == null ? null : normalizar(leerJson(textoRaiz), path.posix.dirname(DE_LA_RAIZ));
  const app = textoApp == null ? null : normalizar(leerJson(textoApp), path.posix.dirname(DE_LA_APP));
  return { raiz, app, difieren: diferencias(raiz, app) };
}

function medirCodigo(commit = null) {
  const leer = lector(commit);
  return medirTextos(leer(DE_LA_RAIZ), leer(DE_LA_APP));
}

/** firebase-tools de la caché de npx, si está (la más nueva). Solo para el careo: la prueba no depende de él. */
function firebaseTools() {
  const cache = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  if (!fs.existsSync(cache)) return null;
  let mejor = null;
  for (const d of fs.readdirSync(cache)) {
    const p = path.join(cache, d, 'node_modules', 'firebase-tools');
    try {
      const v = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8')).version;
      if (!mejor || v.localeCompare(mejor.v, undefined, { numeric: true }) > 0) mejor = { p, v };
    } catch (e) { /* no es firebase-tools */ }
  }
  return mejor;
}

/** Lo que diría el normalizador de firebase-tools de cada archivo (codebase → source leída desde la raíz, y demás). */
function comoLoEntiendeFirebase(ft, commit) {
  const pc = require(path.join(ft.p, 'lib', 'functions', 'projectConfig.js'));
  const leer = lector(commit);
  const una = (r) => {
    const t = leer(r);
    if (t == null) return null;
    const lista = pc.normalizeAndValidate(leerJson(t).functions);
    const salida = {};
    for (const e of lista) {
      const x = { ...e, source: path.posix.normalize(path.posix.join(path.posix.dirname(r), e.source)) };
      const o = {};
      for (const k of Object.keys(x).sort()) o[k] = x[k];
      salida[x.codebase] = o;
    }
    return salida;
  };
  const raiz = una(DE_LA_RAIZ);
  const app = una(DE_LA_APP);
  return { raiz, app, difieren: diferencias(raiz, app) };
}

/** Lo que viaja al publicar: los firebase.json dentro de `git archive <commit> guajirago` y la huella del que va. */
function loQuePublica(commit) {
  const c = commit || 'HEAD';
  const archivos = execFileSync('git', ['ls-tree', '-r', '--name-only', c, '--', 'guajirago'],
    { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => /(^|\/)firebase\.json$/.test(f));
  const texto = execFileSync('git', ['show', c + ':' + DE_LA_APP], { cwd: RAIZ });
  return { archivos, huella: crypto.createHash('sha256').update(texto).digest('hex').slice(0, 12) };
}

function principal() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit') ? args[args.indexOf('--commit') + 1] : null;
  const r = medirCodigo(commit);
  console.log('\n☁️  LAS FUNCIONES, DECLARADAS DOS VECES' + (commit ? ' (commit ' + commit + ')' : ' (disco)'));
  console.log('\n  ' + DE_LA_RAIZ + ' (emulador de npm test):\n    ' + JSON.stringify(r.raiz));
  console.log('  ' + DE_LA_APP + ' (el que publica):\n    ' + JSON.stringify(r.app));
  if (!r.difieren.length) console.log('\n  ✓ declaran LO MISMO (0 opciones distintas)');
  else {
    console.log('\n  🔴 ' + r.difieren.length + ' opción(es) distinta(s):');
    for (const d of r.difieren) {
      console.log('     · [' + d.codebase + '] ' + d.opcion + ': raíz=' + JSON.stringify(d.raiz) + ' · app=' + JSON.stringify(d.app));
    }
  }
  const ft = firebaseTools();
  if (ft) {
    try {
      const f = comoLoEntiendeFirebase(ft, commit);
      console.log('\n  Careo con firebase-tools ' + ft.v + ' (su normalizeAndValidate): '
        + (f.difieren.length ? f.difieren.length + ' opción(es) distinta(s): ' + f.difieren.map((d) => d.opcion).join(', ') : '0 opciones distintas'));
      const mio = JSON.stringify(r.app) === JSON.stringify(f.app) && JSON.stringify(r.difieren) === JSON.stringify(f.difieren);
      console.log('  ' + (mio ? '✓ mi lectura del que publica y de las diferencias es la misma que la de firebase'
        : '🔴 mi lectura NO es la de firebase: ' + JSON.stringify(f)));
    } catch (e) { console.log('\n  (careo con firebase-tools no disponible: ' + e.message + ')'); }
  } else console.log('\n  (firebase-tools no está en la caché de npx: sin careo)');
  const p = loQuePublica(commit);
  console.log('\n  Al publicar (git archive ' + (commit || 'HEAD') + ' guajirago) viaja: ' + p.archivos.join(', ')
    + ' · huella ' + p.huella + (p.archivos.includes(DE_LA_RAIZ) ? ' · 🔴 ¡viaja también el de la raíz!' : ' · el de la raíz NO viaja'));
  console.log('');
}

module.exports = { DE_LA_RAIZ, DE_LA_APP, ANTES, leerJson, normalizar, diferencias, medirTextos, medirCodigo, loQuePublica };

if (require.main === module) principal();
