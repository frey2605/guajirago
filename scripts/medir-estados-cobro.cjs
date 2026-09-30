#!/usr/bin/env node
/**
 * 🧾 LOS ESTADOS DEL COBRO A ALIADOS — gemelo G99 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-estados-cobro.cjs                          código y datos de producción
 *   node scripts/medir-estados-cobro.cjs --sin-red                solo el código
 *   node scripts/medir-estados-cobro.cjs --commit X               el código de un commit (p. ej. el de antes de G99)
 *   node scripts/medir-estados-cobro.cjs --reglas-vivas <archivo> además, la lista de las reglas PUESTAS
 *                                                                 (bajadas con scripts/bajar-reglas.cjs)
 *
 * La lista de los seis estados por los que pasa un cliente del cobro vive en `ESTADOS` de
 * guajirago/functions/suscripcion.js. Hasta G99 estaba escrita a mano en otros dos sitios de este repo:
 *
 *   · firestore.rules (`estadoConocido()` de `match /suscripciones`): las reglas NO pueden importar JavaScript,
 *     así que ahí la copia se queda — y se ATA: pruebas/estadosCobro.test.js exige que diga lo mismo.
 *   · pruebas/reglas.test.js («los seis estados buenos SÍ se guardan»): ésa SÍ puede importar, así que desde G99
 *     la importa. Y es la que EJECUTA las reglas en el emulador con cada estado de la fuente.
 *
 * El panel (guajirago-admin/src/estadosCobro.js, otro repo) tiene su copia desde antes y ya la ata
 * pruebas/cobrosPanel.test.js.
 *
 * Lo que mide:
 *   1. LAS LISTAS: la de la fuente, la de las reglas y la de la prueba de reglas, sacadas de su archivo.
 *   2. LAS COPIAS A MANO: en las tres apps, las funciones, las pruebas, los guiones y las reglas, cuántas listas
 *      escritas a mano llevan (casi) los seis estados, y dónde. Las permitidas son las que no pueden importar.
 *   3. LOS DATOS (producción, solo lectura): cuántas fichas de `suscripciones` hay y en qué estado, y si alguna
 *      lleva un estado que la fuente no conoce.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
const FUENTE = 'guajirago/functions/suscripcion.js';
const REGLAS = 'firestore.rules';
const PRUEBA = 'pruebas/reglas.test.js';
const ANTES = '35a5c76'; // el último commit antes de G99

// Las copias que se quedan porque NO pueden importar la fuente, y quién las ata.
const PERMITIDAS = {
  [FUENTE]: 'la fuente',
  [REGLAS]: 'las reglas no importan JavaScript · la ata pruebas/estadosCobro.test.js',
  'guajirago-admin/src/estadosCobro.js': 'otro repo · la ata pruebas/cobrosPanel.test.js',
};
// Dónde se buscan copias. `firestore.rules.LIVE` NO: es la foto bajada del servidor, no se despliega.
const CARPETAS = ['guajirago/src', 'guajirago/functions', 'pruebas', 'scripts',
  'guajirago-admin/src', 'guajirago-aliados/src'];

/** Lee un archivo del disco o de un commit (los de admin/aliados, siempre del disco: son otros repos). */
function lector(commit) {
  return (r) => {
    if (!commit || r.startsWith('guajirago-admin/') || r.startsWith('guajirago-aliados/')) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r],
        { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

const sinCR = (t) => String(t).replace(/\r\n/g, '\n');

/** Los textos de una lista `[ 'a', "b" ]`, o null si lleva algo que no es texto. */
function textosDe(dentro) {
  const partes = dentro.split(',').map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of partes) {
    const m = /^(['"])([^'"]*)\1$/.exec(p);
    if (!m) return null;
    out.push(m[2]);
  }
  return out;
}

/** El bloque que abre la primera `{` desde `desde`, llaves contadas. */
function bloque(t, desde) {
  const i = t.indexOf('{', desde);
  if (i < 0) return null;
  let n = 0;
  for (let k = i; k < t.length; k += 1) {
    if (t[k] === '{') n += 1;
    else if (t[k] === '}') { n -= 1; if (n === 0) return t.slice(i + 1, k); }
  }
  return null;
}

/**
 * LA LISTA DE LAS REGLAS. Sale de `estadoConocido()` DENTRO de `match /suscripciones/{…}` (no del primer `in [...]`
 * del archivo), sin comentarios, y solo vale si alguna `allow` de ese bloque la llama: una función que nadie llama no
 * protege nada. Devuelve `{ lista }` o `{ lista: null, porQue }`.
 */
function listaDeLasReglas(texto) {
  if (texto == null) return { lista: null, porQue: 'no está el archivo de reglas' };
  const t = sinCR(texto).replace(/\/\/[^\n]*/g, '');
  const i = t.search(/match\s+\/suscripciones\/\{[^}]*\}/);
  if (i < 0) return { lista: null, porQue: 'las reglas no tienen `match /suscripciones/{…}`' };
  const b = bloque(t, t.indexOf('}', i) + 1);
  if (b == null) return { lista: null, porQue: 'el bloque de `suscripciones` no cierra' };
  const f = b.search(/function\s+estadoConocido\s*\(\s*\)/);
  if (f < 0) return { lista: null, porQue: 'el bloque de `suscripciones` no tiene `estadoConocido()`' };
  const cuerpo = bloque(b, f);
  const fuera = b.slice(0, f) + b.slice(f + (cuerpo || '').length);
  if (!/allow\s[^;]*estadoConocido\s*\(\s*\)/.test(fuera)) {
    return { lista: null, porQue: 'ninguna `allow` de `suscripciones` llama a `estadoConocido()`: no protege nada' };
  }
  const m = /\.estado\s+in\s*\[([^\]]*)\]/.exec(cuerpo || '');
  if (!m) return { lista: null, porQue: '`estadoConocido()` ya no pregunta `estado in [...]`' };
  const lista = textosDe(m[1]);
  if (!lista) return { lista: null, porQue: 'la lista de `estadoConocido()` lleva algo que no es un texto' };
  return { lista };
}

/**
 * LA LISTA DE LA PRUEBA DE REGLAS. Sale del `for (const bueno of …)` de la prueba «los … estados buenos SÍ se guardan»
 * del bloque «SE VENDE · la ficha de cobro». Devuelve `{ lista, importa }`: `importa` es true solo si la lista es un
 * nombre que el archivo trae con `require` de suscripcion.js, y entonces `lista` es la de la fuente.
 */
function listaDeLaPrueba(texto, fuente) {
  if (texto == null) return { lista: null, porQue: 'no está ' + PRUEBA };
  const t = sinCR(texto);
  const d = t.indexOf("describe('SE VENDE · la ficha de cobro");
  if (d < 0) return { lista: null, porQue: 'no está el bloque «SE VENDE · la ficha de cobro»' };
  const bloqueDescribe = bloque(t, d) || '';
  const k = bloqueDescribe.search(/it\('EL QUE MUERDE · los [^']*estados buenos SÍ se guardan'/);
  if (k < 0) return { lista: null, porQue: 'no está la prueba «los estados buenos SÍ se guardan»' };
  const cuerpo = bloque(bloqueDescribe, k) || '';
  const m = /for\s*\(\s*const\s+bueno\s+of\s+([^)]*)\)/.exec(cuerpo);
  if (!m) return { lista: null, porQue: 'la prueba ya no recorre los estados buenos' };
  const x = m[1].trim();
  if (x.startsWith('[')) {
    const lista = textosDe(x.slice(1, -1));
    return lista ? { lista, importa: false } : { lista: null, porQue: 'la lista de la prueba lleva algo que no es un texto' };
  }
  // Un nombre: tiene que venir de suscripcion.js, por `const { ESTADOS[: nombre] } = require('…suscripcion.js')`.
  const req = /const\s*\{([^}]*)\}\s*=\s*require\(\s*['"][^'"]*functions\/suscripcion(?:\.js)?['"]\s*\)/g;
  let r;
  while ((r = req.exec(t))) {
    for (const parte of r[1].split(',').map((s) => s.trim())) {
      const [clave, alias] = parte.split(':').map((s) => s.trim());
      if (clave === 'ESTADOS' && (alias || clave) === x) return { lista: fuente, importa: true };
    }
  }
  return { lista: null, porQue: 'la prueba recorre «' + x + '», que no viene de ESTADOS de suscripcion.js' };
}

/** Los archivos donde se buscan copias (del disco), más las reglas. `extra` suma archivos de mentira. */
function losArchivos(extra = []) {
  const out = [REGLAS];
  for (const c of CARPETAS) {
    const abs = path.join(RAIZ, c);
    if (!fs.existsSync(abs)) throw new Error('no está ' + c + ': los tres repos tienen que estar juntos en la raíz');
    for (const f of fs.readdirSync(abs)) if (/\.(c?js|mjs)$/.test(f)) out.push(c + '/' + f);
  }
  for (const e of extra) if (!out.includes(e)) out.push(e);
  return out.sort();
}

/**
 * LAS COPIAS A MANO: cada lista literal que lleve CINCO o más de los estados de la fuente. (Una de cuatro, como la de
 * cobros.test.js, es un recorte a propósito —los que no frenan—, no una copia de la lista.)
 * Devuelve `{ ruta: n }`.
 */
function copias(fuente, leer, archivos = losArchivos()) {
  const out = {};
  for (const ruta of archivos) {
    const t = leer(ruta);
    if (t == null) continue;
    let n = 0;
    for (const m of sinCR(t).matchAll(/\[([^[\]]*)\]/g)) {
      const lista = textosDe(m[1]);
      if (!lista) continue;
      const comunes = new Set(lista.filter((e) => fuente.includes(e)));
      if (comunes.size >= 5) n += 1;
    }
    if (n) out[ruta] = n;
  }
  return out;
}

/** Las copias que sobran: las que no están en PERMITIDAS. */
const sobran = (c) => Object.keys(c).filter((r) => !PERMITIDAS[r]);

const igual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

/** Todo el veredicto del código (sin red). */
function medirCodigo(commit = null) {
  const leer = lector(commit);
  const textoFuente = leer(FUENTE);
  if (textoFuente == null) throw new Error('no está ' + FUENTE);
  // La fuente se EJECUTA: se carga el módulo (del disco o del commit) y se le pide su ESTADOS.
  const Module = require('node:module');
  const m = new Module(path.join(RAIZ, FUENTE));
  m.filename = path.join(RAIZ, FUENTE);
  m.paths = Module._nodeModulePaths(path.dirname(m.filename));
  m._compile(textoFuente, m.filename);
  const fuente = m.exports.ESTADOS;
  const reglas = listaDeLasReglas(leer(REGLAS));
  const prueba = listaDeLaPrueba(leer(PRUEBA), fuente);
  const c = copias(fuente, leer);
  return { fuente, reglas, prueba, copias: c, sobran: sobran(c) };
}

async function losDatos(fuente) {
  const nube = require('./nube.cjs');
  const fichas = (await nube.traer('suscripciones')).map(nube.doc);
  const porEstado = {};
  for (const f of fichas) {
    const e = f.estado === undefined ? '(sin estado)' : String(f.estado);
    porEstado[e] = (porEstado[e] || 0) + 1;
  }
  const raros = Object.keys(porEstado).filter((e) => e !== '(sin estado)' && !fuente.includes(e));
  return { total: fichas.length, porEstado, raros };
}

async function principal() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit') ? args[args.indexOf('--commit') + 1] : null;
  const vivas = args.includes('--reglas-vivas') ? args[args.indexOf('--reglas-vivas') + 1] : null;
  const r = medirCodigo(commit);
  const dice = (x) => (x.lista ? JSON.stringify(x.lista) : '— ' + x.porQue);

  console.log('\n🧾 LOS ESTADOS DEL COBRO A ALIADOS' + (commit ? ' (commit ' + commit + ')' : ''));
  console.log('   fuente  (' + FUENTE + '): ' + JSON.stringify(r.fuente));
  console.log('   reglas  (' + REGLAS + '): ' + dice(r.reglas) + (igual(r.reglas.lista, r.fuente) ? '  ✓ igual' : '  🔴 DISTINTA'));
  console.log('   prueba  (' + PRUEBA + '): ' + (r.prueba.lista ? (r.prueba.importa ? 'IMPORTA la de la fuente' : 'escrita A MANO ' + JSON.stringify(r.prueba.lista)) : '— ' + r.prueba.porQue)
    + (igual(r.prueba.lista, r.fuente) ? '  ✓ igual' : '  🔴 DISTINTA'));
  if (vivas) {
    const v = listaDeLasReglas(fs.existsSync(vivas) ? fs.readFileSync(vivas, 'utf8') : null);
    console.log('   reglas PUESTAS (' + path.basename(vivas) + '): ' + dice(v) + (igual(v.lista, r.fuente) ? '  ✓ igual' : '  🔴 DISTINTA'));
  }

  const total = Object.values(r.copias).reduce((a, b) => a + b, 0);
  console.log('\n   LISTAS A MANO con los estados (5 o más de los 6): ' + total + ' en ' + Object.keys(r.copias).length + ' archivos');
  for (const [ruta, n] of Object.entries(r.copias)) {
    console.log('     ' + (PERMITIDAS[ruta] ? '·' : '🔴') + ' ' + ruta + ': ' + n + '  — ' + (PERMITIDAS[ruta] || 'SOBRA: podría importar la fuente'));
  }
  console.log('   copias que sobran: ' + r.sobran.length);

  if (!args.includes('--sin-red') && !commit) {
    try {
      const d = await losDatos(r.fuente);
      console.log('\n   DATOS (producción, suscripciones): ' + d.total + ' fichas · ' + JSON.stringify(d.porEstado));
      console.log('   con un estado que la fuente no conoce: ' + d.raros.length + (d.raros.length ? ' 🔴 ' + JSON.stringify(d.raros) : ''));
    } catch (e) {
      console.log('\n   DATOS: no pude leer producción (' + e.message + ')');
    }
  }

  const ok = igual(r.reglas.lista, r.fuente) && igual(r.prueba.lista, r.fuente) && r.prueba.importa && !r.sobran.length;
  console.log('\n' + (ok ? '✓ una sola fuente: las reglas dicen lo mismo y la prueba la importa'
    : '🔴 la lista de estados NO sale de una sola fuente') + '\n');
}

module.exports = {
  FUENTE, REGLAS, PRUEBA, ANTES, PERMITIDAS, listaDeLasReglas, listaDeLaPrueba, copias, sobran, losArchivos,
  medirCodigo, lector, igual,
};

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
