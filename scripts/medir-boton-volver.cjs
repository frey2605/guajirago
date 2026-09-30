#!/usr/bin/env node
/**
 * ‹ EL BOTÓN «VOLVER» DE LA APP DE TRANSPORTE — gemelo G91 (30-sep-2026) · SOLO LECTURA (no toca datos: es solo código)
 *
 * Hasta el 30-sep-2026 el botón «‹ Volver» se escribía a mano en cada pantalla de guajirago/src: 24 copias en 15
 * archivos, cada una con su estilo (fondos distintos, el ‹ de 20 o de 22, uno azul en Restaurantes…). Ahora es UNA
 * pieza, guajirago/src/BotonVolver.js, y cada pantalla solo dice A DÓNDE vuelve y DÓNDE va puesto.
 *
 *   node scripts/medir-boton-volver.cjs                   <- el código del disco
 *   node scripts/medir-boton-volver.cjs --antes [<hash>]  <- y el careo con ese commit (por defecto 9dca917, antes de G91)
 *   node scripts/medir-boton-volver.cjs --detalle         <- además, cada copia con su aspecto y a dónde vuelve
 *
 * ── LO QUE MIDE ────────────────────────────────────────────────────────────
 *  1. LAS COPIAS: cuántos «‹ Volver» escritos a mano hay en el código (sin comentarios) de guajirago/src, fuera de
 *     BotonVolver.js, y cuántas pantallas usan la pieza (`<BotonVolver … />`).
 *  2. LOS ASPECTOS: SACA del archivo cada botón (la copia a mano o el `<BotonVolver … />`), lo PINTA con React en un
 *     navegador de mentira (jsdom) y apunta los estilos tal como React se los da al botón y al ‹. Cuenta cuántos
 *     aspectos distintos hay (el aspecto = todo menos DÓNDE va puesto: position, top, left, zIndex, márgenes,
 *     flexShrink y display).
 *  3. A DÓNDE VUELVE: a cada botón pintado le da funciones de mentira en lugar de las de la pantalla (onVolver,
 *     setPantalla, setCarrito…), lo TOCA y apunta a quién llamó y con qué. Con --antes, el careo exige que cada
 *     archivo vuelva a los mismos sitios, en el mismo orden, que en ese commit.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');
const P = require('./medir-paleta.cjs');

const ANTES = '9dca917';
const CARPETA = 'guajirago/src';
const PIEZA = 'guajirago/src/BotonVolver.js';
// Lo que dice DÓNDE va puesto el botón, no cómo se ve.
const LUGAR = ['position', 'top', 'left', 'zIndex', 'marginLeft', 'marginBottom', 'flexShrink', 'display'];

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/** Los .js de guajirago/src: del disco, o del commit. `extra` suma archivos de mentira. */
function losArchivos(commit, extra = []) {
  let out;
  if (!commit) out = fs.readdirSync(path.join(RAIZ, CARPETA)).filter((f) => f.endsWith('.js')).map((f) => CARPETA + '/' + f);
  else {
    out = execFileSync('git', ['ls-tree', '--name-only', commit, CARPETA + '/'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter((f) => f.endsWith('.js'));
  }
  for (const e of extra) if (!out.includes(e)) out.push(e);
  return out.filter((f) => !/\.test\.js$/.test(f)).sort();
}

const limpio = (t) => soloCodigo(String(t).replace(/\r\n/g, '\n'));

/** El nombre de la función de la pantalla donde está el botón (la última `function X` antes de él). */
function pantallaDe(codigo, i) {
  const antes = codigo.slice(0, i);
  const m = [...antes.matchAll(/function\s+([A-Z]\w*)/g)];
  return m.length ? m[m.length - 1][1] : '(arriba del archivo)';
}

/** Los botones de un archivo: [{ archivo, pantalla, tipo: 'a mano' | 'pieza', trozo }] en el orden del archivo. */
function losBotones(archivo, texto) {
  const c = limpio(texto);
  const out = [];
  if (archivo === PIEZA) return out;
  for (let i = c.indexOf('‹'); i >= 0; i = c.indexOf('‹', i + 1)) {
    const d = c.lastIndexOf('<div', i);
    const b = c.lastIndexOf('<button', i);
    const ini = Math.max(d, b);
    const cierre = ini === b ? '</button>' : '</div>';
    const fin = c.indexOf(cierre, i);
    if (ini < 0 || fin < 0) { out.push({ archivo, pantalla: pantallaDe(c, i), tipo: 'a mano', trozo: null }); continue; }
    out.push({ archivo, pantalla: pantallaDe(c, i), tipo: 'a mano', trozo: c.slice(ini, fin + cierre.length), pos: ini });
  }
  for (const m of c.matchAll(/<BotonVolver\b[\s\S]*?\/>/g)) out.push({ archivo, pantalla: pantallaDe(c, m.index), tipo: 'pieza', trozo: m[0], pos: m.index });
  return out.sort((x, y) => (x.pos || 0) - (y.pos || 0));
}

/** `const backBtn = {…};` de Restaurantes.js (el estilo de sus copias de antes), ejecutado. */
function elBackBtn(texto) {
  const m = /^const backBtn = (\{[^\n]*\});/m.exec(limpio(texto || ''));
  // eslint-disable-next-line no-new-func
  return m ? new Function('return ' + m[1])() : undefined;
}

/**
 * Pinta cada botón con React y lo toca. Devuelve [{ …boton, estilo, aspecto, lugar, llamadas }].
 * `commit` null = el disco; `cambios` = { archivo: texto } pisa archivos (pantallas de mentira).
 */
async function medir(commit = null, cambios = {}) {
  const leer = P.lector(commit, cambios);
  const H = P.herramientas();
  const { React } = H;
  const archivos = losArchivos(commit, Object.keys(cambios).filter((f) => f.startsWith(CARPETA + '/')));
  const botones = [];
  const cache = {};
  let BotonVolver;
  try { BotonVolver = leer(PIEZA) == null ? undefined : P.cargarModulo(PIEZA, leer, cache).default; } catch (e) { BotonVolver = undefined; }
  const dom = new H.JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  const win = dom.window;
  const antes = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
  global.window = win;
  global.document = win.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const errorReal = console.error;
  console.error = () => {};
  try {
    for (const f of archivos) {
      const texto = leer(f);
      if (texto == null) continue;
      const backBtn = elBackBtn(texto);
      for (const b of losBotones(f, texto)) {
        const r = { ...b, estilo: null, aspecto: null, lugar: null, llamadas: null, error: null };
        botones.push(r);
        if (!b.trozo) { r.error = 'no se pudo sacar el botón del archivo'; continue; }
        const nombres = [...new Set([...b.trozo.matchAll(/\b(on[A-Z]\w*|set[A-Z]\w*)\b/g)].map((m) => m[1]))].filter((n) => n !== 'onClick');
        const llamadas = [];
        // El evento del toque (cuando la pantalla pasa su función directo a onClick) se apunta como «toque».
        const decir = (x) => (x && typeof x === 'object' && 'nativeEvent' in x ? 'toque' : JSON.stringify(x));
        const espias = nombres.map((n) => (...a) => { llamadas.push(n + '(' + a.map(decir).join(', ') + ')'); });
        try {
          const code = H.babel.transformSync('function __boton(React, BotonVolver, backBtn, ' + nombres.join(', ') + ') { return (' + b.trozo + '); }', {
            babelrc: false, configFile: false, sourceType: 'script', presets: [[H.presetReact, { runtime: 'classic' }]],
          }).code;
          // eslint-disable-next-line no-new-func
          const fn = new Function(code + '\nreturn __boton;')();
          const el = fn(React, BotonVolver, backBtn, ...espias);
          const caja = win.document.createElement('div');
          win.document.body.appendChild(caja);
          const root = H.cliente.createRoot(caja);
          await React.act(async () => { root.render(el); });
          const boton = caja.firstElementChild;
          const props = (x) => { if (!x) return null; const k = Object.keys(x).find((y) => y.startsWith('__reactProps$')); return k ? x[k] : null; };
          const span = boton.querySelector('span');
          const st = { ...((props(boton) || {}).style || {}) };
          r.texto = boton.textContent.trim();
          r.estilo = { etiqueta: boton.tagName.toLowerCase(), boton: st, flecha: span ? (props(span) || {}).style || null : null };
          const aspecto = {};
          const lugar = {};
          for (const [k, v] of Object.entries(st)) (LUGAR.includes(k) ? lugar : aspecto)[k] = v;
          r.aspecto = JSON.stringify({ etiqueta: r.estilo.etiqueta, boton: Object.fromEntries(Object.entries(aspecto).sort()), flecha: r.estilo.flecha && Object.fromEntries(Object.entries(r.estilo.flecha).sort()) });
          r.lugar = JSON.stringify(Object.fromEntries(Object.entries(lugar).sort()));
          await React.act(async () => { boton.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
          r.llamadas = llamadas;
          r.html = caja.innerHTML;
          await React.act(async () => { root.unmount(); });
          caja.remove();
        } catch (e) { r.error = e.message.split('\n')[0]; }
      }
    }
  } finally {
    console.error = errorReal;
    global.window = antes.window;
    global.document = antes.document;
    global.IS_REACT_ACT_ENVIRONMENT = antes.act;
    win.close();
  }
  return botones;
}

/** El resumen de una medición. */
function resumen(botones) {
  const aMano = botones.filter((b) => b.tipo === 'a mano');
  const pieza = botones.filter((b) => b.tipo === 'pieza');
  const aspectos = [...new Set(botones.filter((b) => b.aspecto).map((b) => b.aspecto))];
  const estilos = [...new Set(botones.filter((b) => b.estilo).map((b) => JSON.stringify(b.estilo)))];
  return {
    total: botones.length,
    aMano: aMano.length,
    archivosAMano: [...new Set(aMano.map((b) => b.archivo))].length,
    pieza: pieza.length,
    archivos: [...new Set(botones.map((b) => b.archivo))].length,
    aspectos: aspectos.length,
    estilos: estilos.length,
    errores: botones.filter((b) => b.error || !b.llamadas || !b.llamadas.length || b.texto !== '‹ Volver')
      .map((b) => b.archivo + ' (' + b.pantalla + '): ' + (b.error || (b.texto !== '‹ Volver' ? 'dice «' + b.texto + '»' : 'al tocarlo no llama a nadie'))),
  };
}

/** A dónde vuelve cada archivo: { archivo: ['onVolver()', …] } en el orden del archivo. */
function aDonde(botones) {
  const out = {};
  for (const b of botones) (out[b.archivo] = out[b.archivo] || []).push((b.llamadas || ['(no se pudo tocar)']).join(' + '));
  return out;
}

/** El careo de «a dónde vuelve», archivo por archivo. Devuelve las diferencias en palabras. */
function carear(antes, ahora) {
  const a = aDonde(antes);
  const b = aDonde(ahora);
  const difs = [];
  for (const f of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = JSON.stringify(a[f] || []);
    const y = JSON.stringify(b[f] || []);
    if (x !== y) difs.push(f + ': antes volvía con ' + x + ' y ahora con ' + y);
  }
  return difs;
}

/** Qué botones cambiaron de aspecto (mismo archivo, mismo orden): [{ archivo, pantalla, antes, ahora }]. */
function cambiosDeAspecto(antes, ahora) {
  const out = [];
  const por = (l) => { const m = {}; for (const b of l) (m[b.archivo] = m[b.archivo] || []).push(b); return m; };
  const A = por(antes);
  const B = por(ahora);
  for (const f of Object.keys(A).sort()) {
    (A[f] || []).forEach((x, i) => {
      const y = (B[f] || [])[i];
      if (y && x.aspecto !== y.aspecto) out.push({ archivo: f, pantalla: x.pantalla, antes: x.aspecto, ahora: y.aspecto });
    });
  }
  return out;
}

/** En palabras: en qué se diferencian dos aspectos. */
function diferencia(a, b) {
  const x = JSON.parse(a);
  const y = JSON.parse(b);
  const d = [];
  if (x.etiqueta !== y.etiqueta) d.push('era <' + x.etiqueta + '> y es <' + y.etiqueta + '>');
  for (const [parte, nombre] of [['boton', 'botón'], ['flecha', '‹']]) {
    const p = x[parte] || {};
    const q = y[parte] || {};
    for (const k of [...new Set([...Object.keys(p), ...Object.keys(q)])].sort()) {
      if (p[k] !== q[k]) d.push(nombre + ' ' + k + ': ' + (p[k] === undefined ? '(nada)' : p[k]) + ' → ' + (q[k] === undefined ? '(nada)' : q[k]));
    }
  }
  return d.join(' · ');
}

/**
 * Quita el «‹ Volver» de los pasos de un recorrido pintado ({ html, estilos } de scripts/medir-paleta.cjs), para carear
 * TODO lo demás de una pantalla con un commit de antes de G91: el botón se carea aparte, aquí. Se quita el <div> cuyo
 * texto es «‹ Volver» y su ‹, del HTML y de la lista de estilos (que va elemento por elemento, en el mismo orden).
 */
function sinVolver(pasos) {
  const { JSDOM } = P.herramientas();
  const w = new JSDOM('<!doctype html><html><body></body></html>').window;
  try {
    return pasos.map((p) => {
      const caja = w.document.createElement('div');
      caja.innerHTML = p.html;
      const todos = [...caja.querySelectorAll('*')];
      const fuera = new Set();
      for (const el of todos) {
        if (el.tagName === 'DIV' && el.textContent.trim() === '‹ Volver' && el.children.length === 1 && el.children[0].tagName === 'SPAN') {
          fuera.add(todos.indexOf(el));
          fuera.add(todos.indexOf(el.children[0]));
          el.replaceWith(w.document.createTextNode('[VOLVER]'));
        }
      }
      const lineas = String(p.estilos).split('\n');
      if (lineas.length !== todos.length) throw new Error('sinVolver: los estilos no van elemento por elemento (' + lineas.length + ' y ' + todos.length + ')');
      return { ...p, html: caja.innerHTML, estilos: lineas.filter((_, i) => !fuera.has(i)).join('\n') };
    });
  } finally { w.close(); }
}

async function principal() {
  const ahora = await medir(null);
  const r = resumen(ahora);
  console.log('\n‹ EL BOTÓN «VOLVER» (G91)\n');
  console.log('1 · COPIAS: ' + r.total + ' botones en ' + r.archivos + ' archivos · ' + r.aMano + ' escritos a mano (en ' + r.archivosAMano + ' archivos) · ' + r.pieza + ' usan BotonVolver.js');
  console.log('2 · ASPECTOS distintos: ' + r.aspectos + ' (estilos completos, con el lugar: ' + r.estilos + ')');
  console.log('3 · A DÓNDE VUELVE: ' + (r.errores.length ? '🔴 ' + r.errores.join(' · ') : '✓ los ' + r.total + ' dicen «‹ Volver» y, al tocarlos, llaman a su pantalla'));
  if (argumento('--detalle')) {
    for (const b of ahora) console.log('   ' + b.archivo.replace(CARPETA + '/', '') + ' · ' + b.pantalla + ' · ' + b.tipo + ' · vuelve: ' + (b.llamadas || []).join(' + ') + ' · lugar ' + b.lugar + '\n      aspecto ' + b.aspecto);
  }
  const a = argumento('--antes');
  if (a) {
    const commit = a === true ? ANTES : a;
    const antes = await medir(commit);
    const ra = resumen(antes);
    console.log('\n   ANTES (' + commit + '): ' + ra.total + ' botones en ' + ra.archivos + ' archivos · ' + ra.aMano + ' a mano · ' + ra.pieza + ' con la pieza · ' + ra.aspectos + ' aspectos · ' + ra.estilos + ' estilos completos');
    const d = carear(antes, ahora);
    console.log('   careo de A DÓNDE VUELVE: ' + (d.length ? '🔴 ' + d.length + ' archivos distintos\n     ' + d.join('\n     ') : '✓ los ' + Object.keys(aDonde(ahora)).length + ' archivos vuelven a los mismos sitios, en el mismo orden (' + ahora.length + ' botones tocados)'));
    const c = cambiosDeAspecto(antes, ahora);
    console.log('   cambian de aspecto: ' + c.length + ' de ' + antes.length);
    for (const x of c) console.log('     · ' + x.archivo.replace(CARPETA + '/', '') + ' (' + x.pantalla + '): ' + diferencia(x.antes, x.ahora));
  }
}

module.exports = { ANTES, PIEZA, LUGAR, losArchivos, losBotones, medir, resumen, aDonde, carear, cambiosDeAspecto, diferencia, sinVolver };

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
