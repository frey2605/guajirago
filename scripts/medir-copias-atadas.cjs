#!/usr/bin/env node
/**
 * 🧬 LAS PRUEBAS QUE ATAN COPIAS HERMANAS — gemelo G100 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-copias-atadas.cjs               las pruebas de hoy
 *   node scripts/medir-copias-atadas.cjs --commit X    las pruebas de un commit (p. ej. el de antes de G100)
 *   node scripts/medir-copias-atadas.cjs --detalle     además, cada comparación con su archivo y renglón
 *
 * Los tres repos son APARTE y no pueden importar entre sí: una pieza compartida se COPIA a cada app y una prueba
 * la ATA («esta copia es idéntica a aquella»). Hasta G100 cada prueba decidía a su manera qué es «idéntica»: unas
 * byte a byte, otras quitando el final de línea de Windows (\r\n), otra quitando TODO \r. Tres varas de medir para
 * la misma pregunta: con la de byte a byte, dos copias con el mismo código se ponían rojas si git les dejaba un final
 * de línea distinto; con la de «todo \r», un \r suelto metido en medio pasaba.
 *
 * Lo que mide:
 *   1. LAS COMPARACIONES: en cada archivo de pruebas de la carpeta pruebas/, cada `assert.strictEqual`/`equal`/`deepStrictEqual` cuyos DOS lados
 *      son texto de un archivo (sale de `leer(…)` o `readFileSync(…)`, directo, por una variable o por una función
 *      del propio archivo o de un guion), y con qué vara compara. Y cuántas pasan ya por la casa común
 *      (`copiaIdentica` de pruebas/cargar.cjs).
 *   2. EL DISCO: los archivos con la misma ruta en dos o tres apps (src/ y public/), y cuántos son iguales byte a
 *      byte, cuántos solo difieren en el final de línea, y cuáles son esos (los que una vara byte a byte pondría rojos).
 *   3. LAS VARAS, EJECUTADAS: cada vara encontrada, corrida con los mismos casos (iguales, solo el final de línea,
 *      un carácter distinto, un \r suelto, una marca BOM), para enseñar en qué se separan.
 *
 * No lee datos de Firestore: G100 es solo de pruebas.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const ANTES = 'd483d58'; // el último commit antes de G100
const APPS = ['guajirago', 'guajirago-admin', 'guajirago-aliados'];

/** Lee un archivo del repo raíz, del disco o de un commit. */
function lector(commit) {
  return (r) => {
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r],
        { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Los archivos de pruebas de la carpeta pruebas/, de ese commit o del disco. */
function lasPruebas(commit) {
  let nombres;
  if (!commit) nombres = fs.readdirSync(path.join(RAIZ, 'pruebas'));
  else {
    nombres = execFileSync('git', ['ls-tree', '--name-only', commit, 'pruebas/'],
      { cwd: RAIZ, encoding: 'utf8' }).split('\n').map((x) => x.replace(/^pruebas\//, ''));
  }
  return nombres.filter((n) => /\.test\.js$/.test(n)).sort().map((n) => 'pruebas/' + n);
}

// ── Leer un trozo de código sin perderse en los textos ─────────────────────────────────────────────────────────
/** El texto entre el `(` de `i` y su `)`, saltando textos entrecomillados. */
function entreParentesis(src, i) {
  let d = 0; let q = null; let j = i;
  for (; j < src.length; j += 1) {
    const c = src[j];
    if (q) { if (c === '\\') { j += 1; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '(') d += 1;
    else if (c === ')') { d -= 1; if (d === 0) break; }
  }
  return src.slice(i + 1, j);
}
/** Parte los argumentos de una llamada por sus comas de primer nivel. */
function argumentos(a) {
  const out = []; let d = 0; let q = null; let s = 0;
  for (let j = 0; j < a.length; j += 1) {
    const c = a[j];
    if (q) { if (c === '\\') { j += 1; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if ('([{'.includes(c)) d += 1;
    else if (')]}'.includes(c)) d -= 1;
    else if (c === ',' && d === 0) { out.push(a.slice(s, j).trim()); s = j + 1; }
  }
  out.push(a.slice(s).trim());
  return out;
}

/** Cómo se definió `nombre` en `src`: su cuerpo si es función, su valor si es variable; o null. */
function definicion(src, nombre, leerRuta, antesDe = src.length) {
  const n = nombre.replace(/[$]/g, '\\$');
  // El nombre puede estar declarado varias veces en el archivo (un `const app` en cada `it`): vale la ÚLTIMA
  // declaración antes de la comparación, que es la que está a la vista de ella.
  const todas = [
    ...[...src.matchAll(new RegExp('function\\s+' + n + '\\s*\\(', 'g'))].map((m) => ({ m, clase: 'funcion' })),
    ...[...src.matchAll(new RegExp('(?:const|let|var)\\s+' + n + '\\s*=\\s*([^\\n]*)', 'g'))].map((m) => ({ m, clase: 'valor' })),
    // Destructurado de una lista: `const [a, b, c] = LISTA.map((r) => leer(r));`
    ...[...src.matchAll(new RegExp('(?:const|let)\\s+\\[[^\\]]*\\b' + n + '\\b[^\\]]*\\]\\s*=\\s*([^\\n]*)', 'g'))].map((m) => ({ m, clase: 'lista' })),
  ].sort((x, y) => x.m.index - y.m.index);
  const cual = todas.filter((x) => x.m.index < antesDe).pop() || todas[0];
  if (cual) {
    const { m, clase } = cual;
    if (clase === 'funcion') { const c = cuerpoDeLaFuncion(src, m.index); return c ? c.texto : null; }
    if (clase === 'valor' && /=>\s*\{\s*$/.test(m[1])) { const c = cuerpoDeLaFuncion(src, m.index); return c ? c.texto : m[1]; }
    return m[1];
  }
  // Traído de un guion: `const { bloque, … } = require('../scripts/x.cjs');` → su definición allí.
  const req = [...src.matchAll(/const\s*\{([^}]*)\}\s*=\s*require\(\s*['"]\.\.\/(scripts\/[^'"]+)['"]\s*\)/g)]
    .find((m) => new RegExp('\\b' + n + '\\b').test(m[1]));
  if (req && leerRuta) {
    const guion = leerRuta(req[2]);
    if (guion && guion !== src) return definicion(guion, nombre, null);
  }
  return null;
}

/**
 * Un lado de la comparación, EXPANDIDO: se le cambian las variables por su valor y se le pegan los cuerpos de las
 * funciones locales que llama (dos niveles), para poder ver si al final sale de un archivo y cómo se normaliza.
 */
function expandir(lado, src, leerRuta, donde = src.length) {
  let t = lado;
  const vistos = new Set();
  for (let nivel = 0; nivel < 3; nivel += 1) {
    const nombres = [...new Set([...t.matchAll(/(?<![.\w$'"])([A-Za-z_$][\w$]*)\b/g)].map((m) => m[1]))]
      .filter((x) => !vistos.has(x) && !/^(leer|assert|String|JSON|fs|path|require|return|const|let|new|typeof|true|false|null|undefined)$/.test(x));
    let crecio = false;
    for (const x of nombres) {
      vistos.add(x);
      const d = definicion(src, x, leerRuta, donde);
      if (d) { t += '\n' + d; crecio = true; }
    }
    if (!crecio) break;
  }
  return t;
}

const SALE_DE_UN_ARCHIVO = /\bleer\s*\(|readFileSync\s*\(/;
const NO_SON_FUNCIONES_LOCALES = /^(assert|String|JSON|Object|Array|Number|Boolean|new|typeof|await)$/;

/**
 * ¿Este lado de la comparación ES el texto de un archivo (entero o un trozo)? No basta con que por ahí se lea un
 * archivo: `M.leerEnv(leer(x)).LLAVE` lee uno y compara un VALOR, y eso es comparar por lo que dice, no la copia.
 * Vale: `leer(…)` y su cadena (`.replace(…)`), `fs.readFileSync(…)`, una función SUELTA (sin punto) del archivo o de
 * un guion que lea o reciba un archivo (`sinCR(leer(x))`, `bloque(leer(x))`, `trozo(RUTA)`), y una variable (o un
 * elemento de una lista) que valga eso. Devuelve el lado ya sustituido, o null.
 */
function textoDeArchivo(lado, src, leerRuta, hondo = 0, donde = src.length) {
  const s = lado.trim();
  if (hondo > 3) return null;
  if (/^(fs\.)?(leer|readFileSync)\s*\(/.test(s)) return s;
  const id = s.match(/^([A-Za-z_$][\w$]*)(\[[^\]]+\])?$/);
  if (id) {
    const d = definicion(src, id[1], leerRuta, donde);
    if (!d) return null;
    const init = d.trim().replace(/;\s*(\/\/.*)?$/, '');
    if (id[2] || /^\[/.test(s) || /\.map\(/.test(init)) {
      // Una lista de textos: `COPIAS.map((f) => mismoTexto(leer(f)))`, o `[a, b, c] = LISTA.map((r) => leer(r))`.
      const m = init.match(/\.map\(\s*\(?\s*[\w$]+\s*\)?\s*=>\s*([\s\S]+)\)\s*$/);
      return m ? textoDeArchivo(m[1], src, leerRuta, hondo + 1, donde) : null;
    }
    return textoDeArchivo(init, src, leerRuta, hondo + 1, donde);
  }
  const f = s.match(/^([A-Za-z_$][\w$]*)\s*\(/);
  if (f && !NO_SON_FUNCIONES_LOCALES.test(f[1])) {
    const cuerpo = definicion(src, f[1], leerRuta, donde);
    if (cuerpo && (SALE_DE_UN_ARCHIVO.test(s) || SALE_DE_UN_ARCHIVO.test(cuerpo))) return s;
  }
  return null;
}
/** La vara con que se compara un lado ya expandido. */
function varaDe(t) {
  if (/\/\\r\\n\/g|split\(\s*['"]\\r\\n['"]\s*\)/.test(t)) return 'sin el \\r\\n (final de línea)';
  if (/\/\\r\/g|\/\\r\+?\/g/.test(t)) return 'sin NINGÚN \\r';
  return 'byte a byte';
}

/**
 * Comparaciones que el buscador encuentra y NO son una copia atada: comparan lo que SACAN de dos archivos
 * distintos, a propósito. Se nombran por archivo y por el primer lado de la comparación, con su porqué.
 */
const NO_SON_COPIAS = [
  ['pruebas/bienvenidaConductor.test.js', 'conductor',
    'compara los COLORES sacados de dos tarjetas en dos pantallas distintas (Login.js y App.js), no una copia de archivo'],
];

/**
 * El código con la MISMA longitud pero sin nada dentro de los textos ni de los comentarios, para buscar las
 * comparaciones sin que cuenten las que solo están escritas dentro de un texto (las pruebas de mentira de
 * pruebas/copiasAtadas.test.js) o de un comentario. Las posiciones siguen valiendo para el original.
 */
function enBlanco(src) {
  // Un lector pequeño y no una expresión regular: `sinTextos` se pierde con una expresión regular que lleva comillas
  // dentro (`/(['"]?)celular\1/` en telefonoFicha.test.js se comía el resto del archivo), y así dejaba de ver dos
  // comparaciones de verdad. Aquí las expresiones regulares también se reconocen y se blanquean.
  const blanco = (s) => s.replace(/[^\n]/g, ' ');
  const n = src.length;
  let out = '';
  let i = 0;
  let ultimo = '';
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      let j = src.indexOf('\n', i); if (j < 0) j = n;
      out += blanco(src.slice(i, j)); i = j; continue;
    }
    if (c === '/' && d === '*') {
      let j = src.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
      out += blanco(src.slice(i, j)); i = j; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') j += 1;
        else if (c !== '`' && src[j] === '\n') break;
        j += 1;
      }
      out += c + blanco(src.slice(i + 1, j)) + (j < n ? src[j] : '');
      i = j + 1; ultimo = 'x'; continue;
    }
    if (c === '/' && (ultimo === '' || /[(,=:[!&|?{};+\-*%<>~^]/.test(ultimo) || /\breturn\s*$/.test(out))) {
      let j = i + 1;
      let clase = false;
      while (j < n && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') clase = true;
        else if (src[j] === ']') clase = false;
        else if (src[j] === '/' && !clase) break;
        j += 1;
      }
      out += '/' + blanco(src.slice(i + 1, j)) + (j < n ? src[j] : '');
      i = j + 1; ultimo = 'x'; continue;
    }
    out += c;
    if (!/\s/.test(c)) ultimo = c;
    i += 1;
  }
  return out;
}

/** Las comparaciones de copias de UN archivo de pruebas. */
function comparacionesDe(archivo, src, leerRuta) {
  const out = [];
  const seguro = enBlanco(src); // se busca sin textos ni comentarios: una comparación escrita DENTRO de un texto no cuenta
  const re = /assert\.(strictEqual|equal|deepStrictEqual)\s*\(/g;
  let m;
  while ((m = re.exec(seguro))) {
    const a = argumentos(entreParentesis(src, m.index + m[0].length - 1));
    if (a.length < 2) continue;
    const tx = textoDeArchivo(a[0], src, leerRuta, 0, m.index);
    const ty = textoDeArchivo(a[1], src, leerRuta, 0, m.index);
    if (!tx || !ty) continue;
    if (NO_SON_COPIAS.some(([f, lado]) => f === archivo && a[0] === lado)) continue;
    const x = expandir(tx, src, leerRuta, m.index);
    const y = expandir(ty, src, leerRuta, m.index);
    const vx = varaDe(x); const vy = varaDe(y);
    out.push({
      archivo,
      renglon: src.slice(0, m.index).split('\n').length,
      vara: vx === vy ? vx : vx + ' contra ' + vy,
      que: (a[0] + '  ==  ' + a[1]).replace(/\s+/g, ' ').slice(0, 140),
    });
  }
  // Las que ya pasan por la casa común.
  const reCasa = /\bcopiaIdentica\s*\(/g;
  while ((m = reCasa.exec(seguro))) {
    const antes = src.slice(Math.max(0, m.index - 9), m.index);
    if (/function\s+$/.test(antes)) continue; // la definición misma
    out.push({
      archivo,
      renglon: src.slice(0, m.index).split('\n').length,
      vara: 'casa común (copiaIdentica)',
      que: ('copiaIdentica(' + entreParentesis(src, m.index + m[0].length - 1)).replace(/\s+/g, ' ').slice(0, 140),
    });
  }
  return out;
}

/** 1 · Todas las comparaciones de copias en las pruebas de ese commit (o del disco). */
function lasComparaciones(commit, pruebas) {
  const leerRuta = lector(commit);
  const lista = [];
  for (const archivo of pruebas || lasPruebas(commit)) {
    // La prueba de la vara misma llama a copiaIdentica con textos de mentira: no ata ninguna copia.
    if (archivo === 'pruebas/copiasAtadas.test.js') continue;
    const src = leerRuta(archivo);
    if (src) lista.push(...comparacionesDe(archivo, src, leerRuta));
  }
  const porVara = {};
  for (const c of lista) porVara[c.vara] = (porVara[c.vara] || 0) + 1;
  return { lista, porVara, archivos: [...new Set(lista.map((c) => c.archivo))] };
}

// ── 2 · El disco ───────────────────────────────────────────────────────────────────────────────────────────────
function archivosDe(base, sub) {
  const raiz = path.join(RAIZ, base, sub);
  if (!fs.existsSync(raiz)) return [];
  const out = [];
  const andar = (rel) => {
    for (const e of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
      if (['node_modules', 'build', '.git'].includes(e.name)) continue;
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) andar(r); else out.push(sub + '/' + r);
    }
  };
  andar('');
  return out;
}
function elDisco() {
  const donde = {};
  for (const app of APPS) for (const f of [...archivosDe(app, 'src'), ...archivosDe(app, 'public')]) (donde[f] = donde[f] || []).push(app);
  const r = { iguales: 0, soloFinDeLinea: [], distintos: 0 };
  for (const [f, apps] of Object.entries(donde)) {
    if (apps.length < 2) continue;
    const base = fs.readFileSync(path.join(RAIZ, apps[0], f));
    for (const app of apps.slice(1)) {
      const otro = fs.readFileSync(path.join(RAIZ, app, f));
      if (otro.equals(base)) r.iguales += 1;
      else if (otro.toString('utf8').replace(/\r\n/g, '\n') === base.toString('utf8').replace(/\r\n/g, '\n')) {
        r.soloFinDeLinea.push(app + '/' + f + ' ↔ ' + apps[0] + '/' + f);
      } else r.distintos += 1;
    }
  }
  return r;
}

// ── 3 · Las varas, ejecutadas ──────────────────────────────────────────────────────────────────────────────────
const CASOS = [
  ['las dos iguales', 'const a = 1;\nconst b = 2;\n', 'const a = 1;\nconst b = 2;\n'],
  ['solo cambia el final de línea (Windows contra Unix)', 'const a = 1;\r\nconst b = 2;\r\n', 'const a = 1;\nconst b = 2;\n'],
  ['un carácter distinto', 'const a = 1;\nconst b = 2;\n', 'const a = 1;\nconst b = 3;\n'],
  ['un \\r suelto metido en medio', 'const a = 1;\nconst\r b = 2;\n', 'const a = 1;\nconst b = 2;\n'],
  ['una marca BOM al principio', '﻿const a = 1;\nconst b = 2;\n', 'const a = 1;\nconst b = 2;\n'],
];
function lasVaras() {
  const { sonLaMismaCopia } = require('../pruebas/cargar.cjs');
  const varas = {
    'byte a byte': (a, b) => a === b,
    'sin el \\r\\n (final de línea)': (a, b) => a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n'),
    'sin NINGÚN \\r': (a, b) => a.replace(/\r/g, '') === b.replace(/\r/g, ''),
  };
  if (typeof sonLaMismaCopia === 'function') varas['casa común (copiaIdentica)'] = sonLaMismaCopia;
  return CASOS.map(([caso, a, b]) => ({ caso, dice: Object.fromEntries(Object.entries(varas).map(([n, f]) => [n, f(a, b)])) }));
}

function medir(commit) {
  return { comparaciones: lasComparaciones(commit), disco: elDisco(), varas: lasVaras() };
}

module.exports = { medir, lasComparaciones, comparacionesDe, textoDeArchivo, definicion, NO_SON_COPIAS, lector, lasVaras, elDisco, ANTES, CASOS };

if (require.main === module) {
  const arg = process.argv.slice(2);
  const i = arg.indexOf('--commit');
  const commit = i >= 0 ? arg[i + 1] : null;
  const r = medir(commit);
  const c = r.comparaciones;
  console.log('🧬 LAS PRUEBAS QUE ATAN COPIAS HERMANAS' + (commit ? ' (commit ' + commit + ')' : ' (disco)') + '\n');
  console.log('1 · Comparaciones de copias en pruebas/: ' + c.lista.length + ', en ' + c.archivos.length + ' archivos');
  for (const [v, n] of Object.entries(c.porVara).sort((a, b) => b[1] - a[1])) console.log('     ' + String(n).padStart(3) + '  ' + v);
  if (arg.includes('--detalle')) for (const x of c.lista) console.log('   · ' + x.archivo + ':' + x.renglon + '  [' + x.vara + ']  ' + x.que);
  console.log('\n2 · El disco (misma ruta en dos o tres apps): ' + r.disco.iguales + ' pares iguales byte a byte, '
    + r.disco.soloFinDeLinea.length + ' que solo difieren en el final de línea, ' + r.disco.distintos + ' distintos de verdad');
  for (const p of r.disco.soloFinDeLinea) console.log('     solo el final de línea: ' + p);
  console.log('\n3 · Las varas, corridas con los mismos casos (✓ = «son iguales»):');
  const nombres = Object.keys(r.varas[0].dice);
  for (const v of r.varas) console.log('     ' + v.caso.padEnd(52) + nombres.map((n) => n + ' ' + (v.dice[n] ? '✓' : '✗')).join(' · '));
  const varas = Object.keys(c.porVara);
  const ok = varas.length === 1 && varas[0] === 'casa común (copiaIdentica)';
  console.log('\n' + (ok ? '✓ todas las copias atadas se comparan con UNA vara, la de la casa común'
    : '✗ las copias atadas se comparan con ' + varas.length + ' varas distintas'));
}
