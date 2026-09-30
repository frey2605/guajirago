#!/usr/bin/env node
/**
 * 🛟 LA RED DE SEGURIDAD (ErrorBoundary) — gemelo G102 (30-sep-2026) · SOLO LECTURA (no toca datos: es solo código)
 *
 * La red de seguridad atrapa el fallo de una pantalla al dibujarse: en vez de dejar la app en blanco enseña «Algo se
 * quedó pegado», escribe el fallo en la consola y ofrece «Volver al inicio». Estaba escrita DOS veces: en
 * guajirago/src/ErrorBoundary.js y en guajirago-aliados/src/ErrorBoundary.js (otro repo), iguales salvo los colores y
 * el nombre en la consola. Desde G102 la pieza vive en guajirago/src/ y aliados lleva una copia IDÉNTICA; lo que
 * cambia entre apps (colores y nombre) lo pasa cada index.js, tomado de SU paleta (theme.js / flujoPedidos.js).
 *
 *   node scripts/medir-red-de-seguridad.cjs                       <- el código del disco
 *   node scripts/medir-red-de-seguridad.cjs --antes [<raíz> <aliados>]
 *        <- y el careo con el código de esos commits (por defecto b2d0f10 de la raíz y 06d4f9e de aliados, antes de G102)
 *
 * ── LO QUE MIDE ────────────────────────────────────────────────────────────
 *  1. LAS REDES: qué archivos de las tres apps definen una red (`getDerivedStateFromError` o `componentDidCatch`), y
 *     si la de aliados es copia idéntica de la pieza (la vara de pruebas/cargar.cjs, `sonLaMismaCopia`).
 *  2. CÓMO ATRAPA: saca de cada index.js el `<ErrorBoundary …>` TAL COMO ESTÁ ESCRITO (con los props que le pase), le
 *     cambia la app por una pantalla de mentira que revienta al dibujarse, y lo PINTA con React en un navegador de
 *     mentira (jsdom). Apunta: lo que se ve (etiqueta, texto y ESTILO de cada elemento tal como React se lo dio —el
 *     HTML solo no basta: jsdom tira el `linear-gradient` del botón—), lo que escribe en la consola, y el manejador
 *     del botón. Y sin fallo: que deja pasar la app tal cual.
 *  3. SIN PROPS: la pieza sola, sin colores ni nombre, también tiene que atrapar (si la red revienta al enseñar su
 *     mensaje, la app queda en blanco: es peor que no tenerla).
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo, sonLaMismaCopia } = require('../pruebas/cargar.cjs');
const P = require('./medir-paleta.cjs');

const ANTES = { raiz: 'b2d0f10', aliados: '06d4f9e' };
const PIEZA = 'guajirago/src/ErrorBoundary.js';
const COPIA = 'guajirago-aliados/src/ErrorBoundary.js';
const APPS = [
  { app: 'transporte', indice: 'guajirago/src/index.js' },
  { app: 'aliados', indice: 'guajirago-aliados/src/index.js' },
];

/** Lee del disco o, con commits, de la raíz (guajirago/…) y de aliados (guajirago-aliados/…). */
function lector(commits = null, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    const git = (cwd, commit, ruta) => {
      try {
        return execFileSync('git', ['show', commit + ':' + ruta], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
      } catch (e) { return null; }
    };
    if (commits && r.startsWith('guajirago/')) return git(RAIZ, commits.raiz, r);
    if (commits && r.startsWith('guajirago-aliados/')) return git(path.join(RAIZ, 'guajirago-aliados'), commits.aliados, r.slice('guajirago-aliados/'.length));
    const abs = path.join(RAIZ, r);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };
}

// ── 1 · LAS REDES ─────────────────────────────────────────────────────────

/** { redes: [archivos que definen una red], identica: la copia de aliados = la pieza }. `extra` suma archivos de mentira. */
function redes(leer = lector(), extra = []) {
  const archivos = [];
  for (const c of P.CARPETAS) {
    const abs = path.join(RAIZ, c);
    if (!fs.existsSync(abs)) throw new Error('no está ' + c + ': los tres repos tienen que estar juntos en la raíz');
    for (const f of fs.readdirSync(abs)) if (f.endsWith('.js')) archivos.push(c + '/' + f);
  }
  for (const e of extra) if (!archivos.includes(e)) archivos.push(e);
  const lista = archivos.sort().filter((f) => {
    const t = leer(f);
    return t != null && /\b(getDerivedStateFromError|componentDidCatch)\b/.test(soloCodigo(t.replace(/\r\n/g, '\n')));
  });
  return { redes: lista, identica: sonLaMismaCopia(leer(PIEZA), leer(COPIA)) };
}

// ── 2 · CÓMO ATRAPA ───────────────────────────────────────────────────────

/** El `<ErrorBoundary …>` de un index.js: { abre: la etiqueta de apertura tal cual, imports: los que usa }. */
function laRedDelIndice(texto) {
  const t = String(texto).replace(/\r\n/g, '\n');
  const i = t.indexOf('<ErrorBoundary');
  if (i < 0) return null;
  let hondo = 0;
  let fin = -1;
  for (let k = i; k < t.length; k += 1) {
    if (t[k] === '{') hondo += 1;
    else if (t[k] === '}') hondo -= 1;
    else if (t[k] === '>' && hondo === 0) { fin = k; break; }
  }
  if (fin < 0) return null;
  const abre = t.slice(i, fin + 1);
  const imports = t.split('\n').filter((l) => /^import\s.+\sfrom\s+'\.\/[^']+';?$/.test(l)).filter((l) => {
    const nombres = (/^import\s+(.+?)\s+from/.exec(l)[1]).replace(/[{}]/g, ' ').split(/[\s,]+/).filter(Boolean);
    return nombres.some((n) => new RegExp('\\b' + n + '\\b').test(abre));
  });
  return { abre, imports };
}

/** Describe lo pintado sin depender del orden de las claves del estilo: etiqueta, estilo ordenado y texto. */
function describir(el, props) {
  if (!el) return '(nada)';
  if (el.nodeType === 3) return JSON.stringify(el.textContent);
  const st = props(el).style || {};
  const orden = Object.keys(st).filter((k) => st[k] != null).sort().map((k) => k + ':' + st[k]).join(';');
  return el.tagName.toLowerCase() + '{' + orden + '}(' + [...el.childNodes].map((c) => describir(c, props)).join(',') + ')';
}

const FALLO = 'pantalla de mentira rota';

/**
 * EL RECORRIDO: para cada app, pinta su red (la del index.js, con sus props) con una pantalla que revienta y con una
 * que no, y la pieza sola sin props. Devuelve [{ app, conFallo, consola, boton, sinFallo, sinProps }].
 */
async function recorrido(commits = null, cambios = {}) {
  const H = P.herramientas();
  const leer = lector(commits, cambios);
  const dom = new H.JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { pretendToBeVisual: true });
  const win = dom.window;
  const antes = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
  const errorReal = console.error;
  const errorVentana = win.console.error;
  let consola = [];
  global.window = win;
  global.document = win.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  console.error = (...a) => { consola.push(a); };
  win.console.error = () => {};
  win.addEventListener('error', (e) => e.preventDefault());
  const out = [];
  try {
    const { React } = H;
    const { act } = React;
    const raiz = win.document.getElementById('raiz');
    const props = (el) => { const k = el && Object.keys(el).find((x) => x.startsWith('__reactProps$')); return k ? el[k] : {}; };
    const pintar = async (Comp) => {
      consola = [];
      const r = H.cliente.createRoot(raiz, { onCaughtError: () => {}, onUncaughtError: () => {} });
      let revento = null;
      try { await act(async () => { r.render(React.createElement(Comp)); }); } catch (e) { revento = e; }
      const vista = describir(raiz.firstChild, props);
      const boton = raiz.querySelector('button');
      const manejador = boton && props(boton).onClick ? String(props(boton).onClick).replace(/\s+/g, ' ') : null;
      const escrito = consola.filter((a) => typeof a[0] === 'string' && /crash:$/.test(a[0]))
        .map((a) => a[0] + ' ' + (a[1] && a[1].message) + ' · con la pila de React: ' + !!(a[2] && a[2].componentStack));
      await act(async () => { r.unmount(); });
      return { vista, manejador, escrito, revento: revento ? String(revento.message || revento) : null };
    };
    for (const { app, indice } of APPS) {
      const red = laRedDelIndice(leer(indice));
      if (!red) { out.push({ app, falta: indice + ' no pinta <ErrorBoundary>' }); continue; }
      const dir = path.posix.dirname(indice);
      const virtual = (hijo) => dir + '/__red_' + hijo + '.js';
      const fuente = (hijo) => "import React from 'react';\n" + red.imports.join('\n') + '\n'
        + "function Revienta() { throw new Error('" + FALLO + "'); }\n"
        + 'function Sana() { return <p>la app de mentira</p>; }\n'
        + 'export default function Sitio() {\n  void Revienta; void Sana;\n  return (' + red.abre + '<' + hijo + ' /></ErrorBoundary>);\n}\n';
      const cargar = (hijo) => P.cargarModulo(virtual(hijo), lector(commits, { ...cambios, [virtual(hijo)]: fuente(hijo) }), {}).default;
      const conFallo = await pintar(cargar('Revienta'));
      const sinFallo = await pintar(cargar('Sana'));
      // La pieza de ESA app, sola y sin props.
      const piezaSola = dir + '/__red_sola.js';
      const Sola = P.cargarModulo(piezaSola, lector(commits, { ...cambios,
        [piezaSola]: "import React from 'react';\nimport ErrorBoundary from './ErrorBoundary';\n"
          + "function Revienta() { throw new Error('" + FALLO + "'); }\n"
          + 'export default function Sitio() { return (<ErrorBoundary><Revienta /></ErrorBoundary>); }\n' }), {}).default;
      const sinProps = await pintar(Sola);
      out.push({
        app, abre: red.abre.replace(/\s+/g, ' '),
        conFallo: conFallo.vista, consola: conFallo.escrito, boton: conFallo.manejador, revento: conFallo.revento,
        sinFallo: sinFallo.vista,
        sinProps: { atrapa: !sinProps.revento && /Algo se quedó pegado/.test(sinProps.vista), revento: sinProps.revento },
      });
    }
  } finally {
    console.error = errorReal;
    win.console.error = errorVentana;
    global.window = antes.window;
    global.document = antes.document;
    global.IS_REACT_ACT_ENVIRONMENT = antes.act;
  }
  return out;
}

/** Careo de dos recorridos: lo que se ve, lo que escribe y el botón tienen que ser IGUALES. */
function carear(antes, ahora) {
  const difs = [];
  for (const b of ahora) {
    const a = antes.find((x) => x.app === b.app);
    if (!a) { difs.push(b.app + ': no está en el de antes'); continue; }
    for (const k of ['conFallo', 'sinFallo', 'boton']) if (a[k] !== b[k]) difs.push(b.app + ' · ' + k + ':\n   antes ' + a[k] + '\n   ahora ' + b[k]);
    if (JSON.stringify(a.consola) !== JSON.stringify(b.consola)) difs.push(b.app + ' · consola:\n   antes ' + JSON.stringify(a.consola) + '\n   ahora ' + JSON.stringify(b.consola));
  }
  return difs;
}

async function principal() {
  const arg = process.argv.indexOf('--antes');
  const r = redes();
  console.log('\n🛟 LA RED DE SEGURIDAD (G102) — solo lectura\n');
  console.log('1 · Redes definidas en las tres apps: ' + r.redes.length);
  for (const f of r.redes) console.log('     · ' + f);
  console.log('   La de aliados es copia IDÉNTICA de la pieza: ' + (r.identica ? '✓ sí' : '🔴 no'));
  const ahora = await recorrido(null);
  console.log('\n2 · Cómo atrapa (pintada con React, desde cada index.js):');
  for (const x of ahora) {
    if (x.falta) { console.log('   🔴 ' + x.app + ': ' + x.falta); continue; }
    console.log('   · ' + x.app + '  ' + x.abre);
    console.log('       con fallo: ' + (x.revento ? '🔴 REVENTÓ: ' + x.revento : '✓ atrapa'));
    console.log('       consola:   ' + JSON.stringify(x.consola));
    console.log('       vista:     ' + x.conFallo);
    console.log('       sin fallo: ' + x.sinFallo);
    console.log('       la pieza sin props: ' + (x.sinProps.atrapa ? '✓ atrapa' : '🔴 no atrapa (' + x.sinProps.revento + ')'));
  }
  if (arg >= 0) {
    const c = process.argv.slice(arg + 1).filter((v) => !v.startsWith('--'));
    const commits = { raiz: c[0] || ANTES.raiz, aliados: c[1] || ANTES.aliados };
    const antes = await recorrido(commits);
    const difs = carear(antes, ahora);
    console.log('\n3 · Careo con raíz ' + commits.raiz + ' y aliados ' + commits.aliados + ': ' + (difs.length ? '🔴 ' + difs.length + ' diferencias' : '✓ se ve, escribe y reacciona IGUAL'));
    for (const d of difs) console.log('   ' + d);
    const r0 = redes(lector(commits));
    console.log('   Antes: la de aliados copia idéntica: ' + (r0.identica ? 'sí' : 'no'));
  }
}

module.exports = { ANTES, PIEZA, COPIA, APPS, FALLO, lector, redes, laRedDelIndice, describir, recorrido, carear };

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
