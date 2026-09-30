#!/usr/bin/env node
/**
 * EL LOGO DE LA ESQUINA — gemelo G92 (30-sep-2026) · SOLO LECTURA (no toca datos: es solo código)
 *
 * Hasta el 30-sep-2026 el logo de arriba a la derecha se escribía a mano en cada pantalla de guajirago/src:
 * `<Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />`, 14 veces en 13
 * archivos, con 5 formas (tamaño 26, 28, 30 o 34; arriba 12, 14 o 16; con zIndex 5, 6 o sin él). Y la pieza que
 * Logo.js tenía para eso, LogoEsquina, no la usaba nadie. Ahora cada pantalla dice `<LogoEsquina />` (o
 * `<LogoEsquina tamano="portada" />` en las portadas con el ☰ Menú), y el sitio y los tamaños viven en Logo.js.
 *
 *   node scripts/medir-logo-esquina.cjs                   <- el código del disco
 *   node scripts/medir-logo-esquina.cjs --antes [<hash>]  <- y el careo con ese commit (por defecto 236586d, antes de G92)
 *   node scripts/medir-logo-esquina.cjs --detalle         <- además, cada logo con su forma
 *
 * ── LO QUE MIDE ────────────────────────────────────────────────────────────
 *  1. LAS COPIAS: cuántos logos de esquina escritos a mano hay en el código (sin comentarios) de guajirago/src, fuera
 *     de Logo.js (un `<Logo … />` con `position: 'absolute'`), y cuántos usan la pieza (`<LogoEsquina … />`). Los
 *     demás `<Logo … />` (centrados o dentro de una fila) se cuentan aparte: no son de esquina.
 *  2. LAS FORMAS: SACA del archivo cada logo, lo PINTA con React en un navegador de mentira (jsdom) y apunta su
 *     tamaño y los estilos tal como React se los da al dibujo (jsdom tira algunos estilos del HTML, así que no basta
 *     con el HTML: lo cazó G90). Cuenta cuántas formas distintas hay, y comprueba que cada uno sea el dibujo oficial
 *     (el pin de Logo.js, con su nombre «GuajiraGo») y que esté pegado a la derecha.
 *  3. EL CAREO (--antes): cada archivo tiene los mismos logos de esquina, en las mismas pantallas y en el mismo orden,
 *     y dice cuáles cambiaron de forma y en qué, en palabras.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');
const P = require('./medir-paleta.cjs');

const ANTES = '236586d';
const CARPETA = 'guajirago/src';
const PIEZA = 'guajirago/src/Logo.js';

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

/** El nombre de la función de la pantalla donde está el logo (la última `function X` antes de él). */
function pantallaDe(codigo, i) {
  const m = [...codigo.slice(0, i).matchAll(/function\s+([A-Z]\w*)/g)];
  return m.length ? m[m.length - 1][1] : '(arriba del archivo)';
}

/** Los logos de un archivo: [{ archivo, pantalla, tipo: 'a mano' | 'pieza' | 'otro', trozo }] en su orden. */
function losLogos(archivo, texto) {
  if (archivo === PIEZA) return [];
  const c = limpio(texto);
  const out = [];
  for (const m of c.matchAll(/<(LogoEsquina|Logo)\b[\s\S]*?\/>/g)) {
    const tipo = m[1] === 'LogoEsquina' ? 'pieza' : /position:\s*'absolute'/.test(m[0]) ? 'a mano' : 'otro';
    out.push({ archivo, pantalla: pantallaDe(c, m.index), tipo, trozo: m[0] });
  }
  return out;
}

/**
 * Pinta cada logo con React. Devuelve [{ …logo, tamano, estilo, forma, html, dibujo, error }].
 * `commit` null = el disco; `cambios` = { archivo: texto } pisa archivos (pantallas de mentira).
 */
async function medir(commit = null, cambios = {}) {
  const leer = P.lector(commit, cambios);
  const H = P.herramientas();
  const { React } = H;
  const archivos = losArchivos(commit, Object.keys(cambios).filter((f) => f.startsWith(CARPETA + '/')));
  let Logo;
  let LogoEsquina;
  try {
    const m = P.cargarModulo(PIEZA, leer, {});
    Logo = m.default;
    LogoEsquina = m.LogoEsquina;
  } catch (e) { Logo = undefined; }
  const logos = [];
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
      for (const l of losLogos(f, texto)) {
        const r = { ...l, tamano: null, estilo: null, forma: null, html: null, dibujo: null, error: null };
        logos.push(r);
        if (l.tipo === 'otro') continue;
        try {
          const code = H.babel.transformSync('function __logo(React, Logo, LogoEsquina) { return (' + l.trozo + '); }', {
            babelrc: false, configFile: false, sourceType: 'script', presets: [[H.presetReact, { runtime: 'classic' }]],
          }).code;
          // eslint-disable-next-line no-new-func
          const fn = new Function(code + '\nreturn __logo;')();
          const caja = win.document.createElement('div');
          win.document.body.appendChild(caja);
          const root = H.cliente.createRoot(caja);
          await React.act(async () => { root.render(fn(React, Logo, LogoEsquina)); });
          const props = (x) => { if (!x) return null; const k = Object.keys(x).find((y) => y.startsWith('__reactProps$')); return k ? x[k] : null; };
          const svg = caja.querySelector('svg');
          if (!svg) throw new Error('no pinta ningún dibujo');
          // Los estilos de todo lo que envuelve al dibujo (de fuera hacia dentro) y del dibujo, tal como React los da.
          const capas = [];
          for (let x = caja.firstElementChild; x; x = x === svg ? null : x.firstElementChild) {
            const st = (props(x) || {}).style || {};
            capas.push({ etiqueta: x.tagName.toLowerCase(), estilo: Object.fromEntries(Object.entries(st).sort()) });
          }
          r.tamano = Number(svg.getAttribute('width'));
          r.estilo = capas;
          r.forma = JSON.stringify({ tamano: r.tamano, alto: Number(svg.getAttribute('height')), capas });
          r.nombre = svg.getAttribute('aria-label');
          r.dibujo = svg.innerHTML;
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
  return logos;
}

/** El dibujo oficial: el que pinta `<Logo />` de Logo.js del mismo lector (el pin en degradado). */
async function elDibujoOficial(commit = null, cambios = {}) {
  const m = await medir(commit, { ...cambios, 'guajirago/src/__oficial.js': "const y = <Logo size={28} style={{ position: 'absolute' }} />;" });
  const o = m.find((l) => l.archivo === 'guajirago/src/__oficial.js');
  return o ? o.dibujo : null;
}

/** El resumen de una medición. `oficial` = el dibujo que tiene que pintar cada logo. */
function resumen(logos, oficial = null) {
  const esquina = logos.filter((l) => l.tipo !== 'otro');
  const aMano = esquina.filter((l) => l.tipo === 'a mano');
  const pieza = esquina.filter((l) => l.tipo === 'pieza');
  const pegadoDerecha = (l) => {
    const e = l.estilo || [];
    return e.some((c) => c.estilo.position === 'absolute' && c.estilo.right === '16px');
  };
  return {
    total: esquina.length,
    aMano: aMano.length,
    archivosAMano: [...new Set(aMano.map((l) => l.archivo))].length,
    pieza: pieza.length,
    archivos: [...new Set(esquina.map((l) => l.archivo))].length,
    formas: [...new Set(esquina.filter((l) => l.forma).map((l) => l.forma))].length,
    otros: logos.filter((l) => l.tipo === 'otro').map((l) => l.archivo.replace(CARPETA + '/', '') + ' (' + l.pantalla + ')'),
    errores: esquina.filter((l) => l.error || l.nombre !== 'GuajiraGo' || !pegadoDerecha(l) || (oficial && l.dibujo !== oficial))
      .map((l) => l.archivo + ' (' + l.pantalla + '): ' + (l.error || (l.nombre !== 'GuajiraGo' ? 'el dibujo no se llama «GuajiraGo»'
        : !pegadoDerecha(l) ? 'no está arriba a la derecha' : 'no es el dibujo oficial de Logo.js'))),
  };
}

/** Qué pantallas tienen logo de esquina, archivo por archivo: { archivo: ['Pantalla', …] } en su orden. */
function dondeHay(logos) {
  const out = {};
  for (const l of logos) if (l.tipo !== 'otro') (out[l.archivo] = out[l.archivo] || []).push(l.pantalla);
  return out;
}

/** El careo de «dónde hay logo de esquina», archivo por archivo. Devuelve las diferencias en palabras. */
function carear(antes, ahora) {
  const a = dondeHay(antes);
  const b = dondeHay(ahora);
  const difs = [];
  for (const f of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    const x = JSON.stringify(a[f] || []);
    const y = JSON.stringify(b[f] || []);
    if (x !== y) difs.push(f + ': antes tenía logo de esquina en ' + x + ' y ahora en ' + y);
  }
  return difs;
}

/** Los logos de esquina emparejados por archivo y orden: [{ antes, ahora }]. */
function parejas(antes, ahora) {
  const por = (l) => { const m = {}; for (const x of l) if (x.tipo !== 'otro') (m[x.archivo] = m[x.archivo] || []).push(x); return m; };
  const A = por(antes);
  const B = por(ahora);
  const out = [];
  for (const f of Object.keys(A).sort()) (A[f] || []).forEach((x, i) => { const y = (B[f] || [])[i]; if (y) out.push({ antes: x, ahora: y }); });
  return out;
}

/** Qué logos cambiaron de forma: [{ archivo, pantalla, antes, ahora }]. */
function cambiosDeForma(antes, ahora) {
  return parejas(antes, ahora).filter((p) => p.antes.forma !== p.ahora.forma)
    .map((p) => ({ archivo: p.antes.archivo, pantalla: p.antes.pantalla, antes: p.antes.forma, ahora: p.ahora.forma }));
}

/** En palabras: en qué se diferencian dos formas (se mira el estilo de la capa que va pegada a la esquina). */
function diferencia(a, b) {
  const x = JSON.parse(a);
  const y = JSON.parse(b);
  const d = [];
  if (x.tamano !== y.tamano) d.push('tamaño ' + x.tamano + ' → ' + y.tamano);
  const capa = (f) => (f.capas.find((c) => c.estilo.position === 'absolute') || f.capas[0]).estilo;
  const p = capa(x);
  const q = capa(y);
  for (const k of [...new Set([...Object.keys(p), ...Object.keys(q)])].sort()) {
    if (p[k] !== q[k]) d.push(k + ': ' + (p[k] === undefined ? '(nada)' : p[k]) + ' → ' + (q[k] === undefined ? '(nada)' : q[k]));
  }
  if (x.capas.length !== y.capas.length) d.push('capas: ' + x.capas.map((c) => c.etiqueta).join('>') + ' → ' + y.capas.map((c) => c.etiqueta).join('>'));
  return d.join(' · ');
}

async function principal() {
  const ahora = await medir(null);
  const oficial = await elDibujoOficial(null);
  const r = resumen(ahora, oficial);
  console.log('\nEL LOGO DE LA ESQUINA (G92)\n');
  console.log('1 · COPIAS: ' + r.total + ' logos de esquina en ' + r.archivos + ' archivos · ' + r.aMano + ' escritos a mano (en ' + r.archivosAMano + ' archivos) · ' + r.pieza + ' usan LogoEsquina');
  console.log('   otros logos (centrados o en una fila, no de esquina): ' + (r.otros.join(', ') || 'ninguno'));
  console.log('2 · FORMAS distintas: ' + r.formas);
  console.log('   ' + (r.errores.length ? '🔴 ' + r.errores.join(' · ') : '✓ los ' + r.total + ' son el dibujo oficial de Logo.js, se llaman «GuajiraGo» y van pegados a la derecha'));
  if (argumento('--detalle')) {
    for (const l of ahora.filter((x) => x.tipo !== 'otro')) console.log('   ' + l.archivo.replace(CARPETA + '/', '') + ' · ' + l.pantalla + ' · ' + l.tipo + '\n      forma ' + l.forma);
  }
  const a = argumento('--antes');
  if (a) {
    const commit = a === true ? ANTES : a;
    const antes = await medir(commit);
    const ra = resumen(antes, await elDibujoOficial(commit));
    console.log('\n   ANTES (' + commit + '): ' + ra.total + ' logos de esquina en ' + ra.archivos + ' archivos · ' + ra.aMano + ' a mano · ' + ra.pieza + ' con la pieza · ' + ra.formas + ' formas');
    const d = carear(antes, ahora);
    console.log('   careo de DÓNDE HAY LOGO: ' + (d.length ? '🔴 ' + d.length + ' archivos distintos\n     ' + d.join('\n     ') : '✓ los ' + Object.keys(dondeHay(ahora)).length + ' archivos tienen el logo en las mismas pantallas, en el mismo orden'));
    const c = cambiosDeForma(antes, ahora);
    const iguales = parejas(antes, ahora).filter((p) => p.antes.html === p.ahora.html).length;
    console.log('   pintan el MISMO HTML que antes: ' + iguales + ' · cambian de forma: ' + c.length + ' de ' + ra.total);
    for (const x of c) console.log('     · ' + x.archivo.replace(CARPETA + '/', '') + ' (' + x.pantalla + '): ' + diferencia(x.antes, x.ahora));
  }
}

module.exports = { ANTES, PIEZA, losArchivos, losLogos, medir, elDibujoOficial, resumen, dondeHay, carear, parejas, cambiosDeForma, diferencia };

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
