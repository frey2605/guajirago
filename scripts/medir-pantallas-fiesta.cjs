#!/usr/bin/env node
/**
 * 🎉 LAS PANTALLAS DE FIESTA CON CONFETI: ¿CUÁNTAS VECES ESTÁ DIBUJADO EL CONFETI Y CÓMO SE VE CADA UNA?
 *    Gemelo G80 (29-sep-2026), SOLO LECTURA. No toca datos: es solo código.
 *
 * Cuatro pantallas celebran con el mismo marco: fondo blanco a pantalla completa y bolitas de colores cayendo.
 *   · Login.js        — CelebracionBienvenida            «¡Bienvenido a GuajiraGo!» (el pasajero nuevo y su crédito)
 *   · App.js          — CelebracionBienvenidaConductor   «¡Bienvenido, conductor!»  (el conductor nuevo y sus créditos)
 *   · AppConductor.js — CelebracionConductor             «¡Recibiste tu saldo!»     (el descuento del pasajero pasa al conductor)
 *   · Promociones.js  — CelebracionPromo                 «¡Código activado!»        (el pasajero activa una promoción)
 * Hasta el 29-sep-2026 cada una dibujaba el marco y el confeti a mano (SEGUNDA LEY).
 *
 *   node scripts/medir-pantallas-fiesta.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-pantallas-fiesta.cjs --commit <hash>  <- otro commit de la raíz (careo)
 *   node scripts/medir-pantallas-fiesta.cjs --html           <- además, el HTML que pinta cada pantalla
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cada pantalla se saca de su archivo (con el analizador de Babel, el mismo con que compila la app), se compila
 *     con las piezas que importa y se PINTA con React (renderToStaticMarkup), con varios casos. El confeti cae en
 *     sitios al azar (`Math.random`): se pinta con un azar FIJO (semilla), así antes y después caen igual.
 *  2. «Se ve igual» se compara sobre el HTML pintado con UNA sola licencia, y se dice: el NOMBRE de una animación
 *     (`@keyframes caerBienvenidaC`) no se ve, lo que se ve es lo que la animación hace. Así que cada nombre se cambia
 *     por lo que dice su @keyframes, y los espacios de dentro del <style> se juntan (en CSS no cuentan). Todo lo
 *     demás —cada estilo, cada color, cada tamaño, cada letra, el sitio de cada bolita— tiene que ser idéntico.
 *     También se da la huella cruda, sin licencia.
 *  3. El RESTO de cada archivo (sin la función de la pantalla de fiesta y sin el import de la pieza común): su
 *     huella. Con el arreglo tiene que quedar igual.
 *  4. En las TRES apps: en cuántos archivos está dibujado el confeti que cae (un @keyframes que arranca un poco
 *     arriba con `translateY(-Npx)` y termina en `translateY(100vh)`), sin contar comentarios.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');

const NM = path.join(RAIZ, 'guajirago', 'node_modules');
const pedir = (n) => {
  try { return require(path.join(NM, n)); } catch (e) {
    throw new Error('hace falta ' + n + ' en guajirago/node_modules (npm ci dentro de guajirago): ' + e.message);
  }
};
const babel = pedir('@babel/core');
const presetReact = pedir('@babel/preset-react');
const aCommonJs = pedir('@babel/plugin-transform-modules-commonjs');
const React = pedir('react');
const servidor = pedir('react-dom/server');

const nada = () => {};
const PANTALLAS = [
  { archivo: 'guajirago/src/Login.js', funcion: 'CelebracionBienvenida', nombre: 'bienvenida del pasajero (Login)',
    casos: [{ monto: 5000, onContinuar: nada }, { monto: 0, onContinuar: nada }] },
  { archivo: 'guajirago/src/App.js', funcion: 'CelebracionBienvenidaConductor', nombre: 'bienvenida del conductor (App)',
    casos: [{ monto: 10000, tipoVehiculo: 'carro', onContinuar: nada }, { monto: 8000, tipoVehiculo: 'moto', onContinuar: nada }, { monto: 0, onContinuar: nada }] },
  { archivo: 'guajirago/src/AppConductor.js', funcion: 'CelebracionConductor', nombre: 'saldo del conductor (AppConductor)',
    casos: [{ monto: 3000, onCerrar: nada }, { monto: null, onCerrar: nada }] },
  { archivo: 'guajirago/src/Promociones.js', funcion: 'CelebracionPromo', nombre: 'código activado (Promociones)',
    casos: [{ codigo: '4821', textoValor: '$5.000', onCerrar: nada }, { codigo: 'AB12', textoValor: 'el 20%', onCerrar: nada }] },
];
const PIEZA = 'guajirago/src/PantallaFiesta.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
// El confeti que cae: un @keyframes que arranca un poco arriba y termina abajo del todo.
const CONFETI = /@keyframes\s+[\w-]+\s*\{\s*from\s*\{\s*transform:\s*translateY\(-\d+px\)[^}]*\}\s*to\s*\{\s*transform:\s*translateY\(100vh\)/g;

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo de la raíz: del disco, o de un commit. `cambios` ({ ruta: texto }) pisa lo que haya: las pantallas de mentira de la prueba. */
function lector(commit, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Los .js de una carpeta (del disco o de un commit). Los repos hermanos solo se miran en el disco: un commit es de la raíz. */
function listar(carpeta, commit) {
  if (!commit || carpeta !== 'guajirago/src') {
    const abs = path.join(RAIZ, carpeta);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs).filter((f) => f.endsWith('.js')).map((f) => carpeta + '/' + f);
  }
  return execFileSync('git', ['ls-tree', '--name-only', commit, carpeta + '/'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.js'));
}

const huella = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const OPC = { babelrc: false, configFile: false, presets: [[presetReact, { runtime: 'classic' }]] };
const analizar = (texto) => babel.parseSync(texto, { ...OPC, sourceType: 'module' });

/** Carga un módulo de la app (con JSX o sin él) y sus imports relativos, desde el lector. Solo sabe de 'react' y de './x'. */
function cargarModulo(ruta, leer, cache) {
  if (cache[ruta]) return cache[ruta].exports;
  const texto = leer(ruta);
  if (texto == null) throw new Error('no está ' + ruta);
  const code = babel.transformSync(texto, { ...OPC, plugins: [aCommonJs], sourceType: 'module' }).code;
  const mod = { exports: {} };
  cache[ruta] = mod;
  const req = (n) => {
    if (n === 'react') return React;
    if (!n.startsWith('./')) throw new Error(ruta + ' pide «' + n + '», que este medidor no sabe cargar');
    return cargarModulo(path.posix.join(path.posix.dirname(ruta), n.endsWith('.js') ? n : n + '.js'), leer, cache);
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports;
}

/** La `function <nombre>(…) {…}` declarada arriba del todo en el archivo, o null. */
function funcionDelArchivo(ast, nombre) {
  for (const n of ast.program.body) if (n.type === 'FunctionDeclaration' && n.id && n.id.name === nombre) return n;
  return null;
}

/** Lo que la función usa y el archivo importa de una pieza suya (./x): { nombre: valor }; y dónde está el import de la pieza común. */
function loQueImporta(ast, fn, ruta, leer, cache) {
  const usados = new Set();
  const dentro = (n) => n.start >= fn.start && n.end <= fn.end;
  babel.traverse(ast, {
    Identifier(p) { if (dentro(p.node)) usados.add(p.node.name); },
    JSXIdentifier(p) { if (dentro(p.node)) usados.add(p.node.name); },
  });
  const alcance = {};
  const cortes = [];
  let usaLaPieza = false;
  for (const n of ast.program.body) {
    if (n.type !== 'ImportDeclaration' || !n.source.value.startsWith('./')) continue;
    const v = n.source.value;
    const r = path.posix.join(path.posix.dirname(ruta), v.endsWith('.js') ? v : v + '.js');
    if (r === PIEZA) cortes.push({ start: n.start, end: n.end });
    for (const s of n.specifiers) {
      if (!usados.has(s.local.name)) continue;
      const m = cargarModulo(r, leer, cache);
      alcance[s.local.name] = s.type === 'ImportDefaultSpecifier' ? m.default : m[s.imported.name];
      if (r === PIEZA && s.type === 'ImportDefaultSpecifier') usaLaPieza = true;
    }
  }
  return { alcance, cortes, usaLaPieza };
}

/** Un azar fijo (mulberry32), para que el confeti caiga igual antes y después. */
function azarFijo(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pinta el componente con un caso y con el azar fijo. */
function pintarCon(Comp, props) {
  const real = Math.random;
  Math.random = azarFijo(80);
  try { return servidor.renderToStaticMarkup(React.createElement(Comp, props)); } finally { Math.random = real; }
}

/** Lo que SE VE: cada nombre de animación cambiado por lo que dice su @keyframes, y los espacios del <style> juntos. */
function comoSeVe(html) {
  const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join(' ');
  const nombres = {};
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*(\{(?:[^{}]|\{[^{}]*\})*\})/g)) {
    nombres[m[1]] = 'animacion-' + huella(m[2].replace(/\s+/g, ' ').replace(/\s*([{}:;])\s*/g, '$1'));
  }
  let t = html.replace(/<style>([\s\S]*?)<\/style>/g, (_, c) => '<style>' + c.replace(/\s+/g, ' ').trim() + '</style>');
  for (const n of Object.keys(nombres).sort((a, b) => b.length - a.length)) t = t.replace(new RegExp('\\b' + n + '\\b', 'g'), nombres[n]);
  return t;
}

function elResto(texto, cortes) {
  let t = texto;
  for (const c of [...cortes].sort((a, b) => b.start - a.start)) t = t.slice(0, c.start) + t.slice(c.end);
  return t.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
}

function medir(commit, cambios = {}) {
  const leer = lector(commit, cambios);
  const pantallas = PANTALLAS.map((p) => {
    const texto = leer(p.archivo);
    if (texto == null) throw new Error('no está ' + p.archivo + (commit ? ' en ' + commit : ''));
    const ast = analizar(texto);
    const fn = funcionDelArchivo(ast, p.funcion);
    if (!fn) return { ...p, pintadas: null, resto: null, usaLaPieza: false };
    const { alcance, cortes, usaLaPieza } = loQueImporta(ast, fn, p.archivo, leer, {});
    const js = babel.transformSync(texto.slice(fn.start, fn.end), { ...OPC, sourceType: 'script' }).code;
    const claves = Object.keys(alcance);
    // eslint-disable-next-line no-new-func
    const Comp = new Function('React', ...claves, js + '\nreturn ' + p.funcion + ';')(React, ...claves.map((k) => alcance[k]));
    const pintadas = p.casos.map((c) => pintarCon(Comp, c));
    return {
      ...p,
      usaLaPieza,
      pintadas,
      crudo: huella(pintadas.join('\n')),
      seVe: pintadas.map(comoSeVe),
      resto: huella(elResto(texto, [{ start: fn.start, end: fn.end }, ...cortes])),
    };
  });
  const dibujadas = [];
  for (const carpeta of CARPETAS) {
    for (const r of [...new Set([...listar(carpeta, commit), ...Object.keys(cambios).filter((k) => k.startsWith(carpeta + '/'))])]) {
      const t = leer(r);
      if (t == null) continue;
      const n = (soloCodigo(t.replace(/\r\n/g, '\n')).match(CONFETI) || []).length;
      if (n) dibujadas.push(r + ' ×' + n);
    }
  }
  return { pantallas, dibujadas };
}

function informe(m, etiqueta) {
  console.log('\n🎉 Pantallas de fiesta con confeti · ' + etiqueta);
  for (const p of m.pantallas) {
    if (!p.pintadas) { console.log('  · ' + p.nombre + ': (no se encontró la función ' + p.funcion + ')'); continue; }
    console.log('  · ' + p.nombre + ': ' + (p.usaLaPieza ? 'usa el marco común PantallaFiesta' : 'marco y confeti dibujados a mano') +
      ' · se ve ' + huella(p.seVe.join('\n')) + ' · HTML crudo ' + p.crudo + ' · resto del archivo ' + p.resto);
  }
  console.log('  · confeti dibujado en el código de las tres apps: ' + m.dibujadas.length + ' archivo(s)' + (m.dibujadas.length ? ' (' + m.dibujadas.join(', ') + ')' : ''));
}

if (require.main === module) {
  const commit = argumento('--commit');
  const m = medir(commit);
  informe(m, commit ? 'commit ' + commit : 'el disco');
  if (process.argv.includes('--html')) for (const p of m.pantallas) if (p.pintadas) console.log('\n' + p.nombre + ':\n' + p.pintadas[0]);
}

module.exports = { medir, huella, comoSeVe, PIEZA, PANTALLAS };
