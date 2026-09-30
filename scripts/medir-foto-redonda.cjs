#!/usr/bin/env node
/**
 * 👤 LA FOTO REDONDA CON EL MUÑECO DE RESPALDO — gemelo G98 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-foto-redonda.cjs              código, careo pintado con React y datos de producción
 *   node scripts/medir-foto-redonda.cjs --sin-red    sin los datos (solo el código y el careo)
 *   node scripts/medir-foto-redonda.cjs --commit X   el código de un commit (p. ej. el de antes de G98)
 *
 * El círculo con la foto de una persona —y el muñeco 👤 si no hay foto— estaba escrito a mano 5 veces en la app de
 * transporte (menú lateral, «Mi perfil» y tres en la pantalla del pasajero). Desde G98 sale de UNA pieza,
 * guajirago/src/FotoRedonda.js, que además pone el muñeco si la foto NO CARGA.
 *
 *   1. LAS COPIAS: en las tres apps, cuántas fotos de persona con respaldo (`? <img … /> : 👤/🙋/🚗`) se escriben a
 *      mano, y cuántas pantallas usan la pieza. Las del panel (otro repo, no puede importar la pieza) están contadas
 *      en PENDIENTES y solo pueden bajar.
 *   2. CÓMO SE VEN: saca cada círculo de su archivo (del disco o de un commit), lo pinta con React en un navegador de
 *      mentira (jsdom) y apunta lo que sale en tres casos: con foto, sin foto, y con una foto que NO carga.
 *   3. LOS DATOS (producción, solo lectura): cuántas fichas y viajes llevan foto, y cuántas de esas fotos cargan de
 *      verdad (se le pregunta al almacén con HEAD; no se imprime ningún enlace).
 */
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');
const P = require('./medir-paleta.cjs');

const PIEZA = 'guajirago/src/FotoRedonda.js';
const ANTES = '62697e7'; // el último commit antes de G98
const SITIOS = [
  // [archivo, nombre del sitio] — en el orden en que aparecen en el archivo.
  ['guajirago/src/MenuLateral.js', 'menú lateral'],
  ['guajirago/src/MiPerfil.js', 'Mi perfil'],
  ['guajirago/src/Solicitar.js', 'la oferta del conductor'],
  ['guajirago/src/Solicitar.js', 'el conductor que viene'],
  ['guajirago/src/Solicitar.js', 'el viaje en curso'],
];
// Las fotos redondas a mano que ya había y NO pueden usar la pieza (otro repo). Solo pueden bajar.
const PENDIENTES = {
  'guajirago-admin/src/Conductores.js': 2, // la ficha del conductor (🚗) y el conductor del mes (🚗)
  'guajirago-admin/src/Pasajeros.js': 1, // la ficha del pasajero (🙋)
};

// ── 1 · LAS COPIAS ────────────────────────────────────────────────────────

const limpio = (t) => soloCodigo(String(t).replace(/\r\n/g, '\n'));
// Una imagen con respaldo de persona: `? <img … /> : '👤'` o `? ( <img … /> ) : ( <div …>🚗</div> )`.
const A_MANO = /\?\s*\(?\s*<img\b[^>]*\/>\s*\)?\s*:\s*\(?\s*(?:'👤'|"👤"|<div[^>]*>\s*(?:👤|🙋|🚗)\s*<\/div>)/gu;

/** { archivos: { ruta: n de fotos a mano }, usan: [rutas que pintan <FotoRedonda>] } */
function copias(leer = P.lector(null)) {
  const archivos = {};
  const usan = [];
  for (const c of P.CARPETAS) {
    const abs = path.join(RAIZ, c);
    for (const f of fs.readdirSync(abs).filter((x) => x.endsWith('.js') && !x.endsWith('.test.js')).sort()) {
      const ruta = c + '/' + f;
      if (ruta === PIEZA) continue;
      const t = leer(ruta);
      if (t == null) continue;
      const n = (limpio(t).match(A_MANO) || []).length;
      if (n) archivos[ruta] = n;
      if (/<FotoRedonda\b/.test(limpio(t))) usan.push(ruta);
    }
  }
  return { archivos, usan };
}

/** Diferencias contra PENDIENTES: lo que subió (rojo) y lo que bajó sin tachar. */
function contraPendientes(hoy, pendientes = PENDIENTES) {
  const difs = [];
  for (const f of [...new Set([...Object.keys(hoy.archivos), ...Object.keys(pendientes)])].sort()) {
    const a = hoy.archivos[f] || 0;
    const p = pendientes[f] || 0;
    if (a > p) difs.push(`🔴 ${f}: ${a} foto(s) de persona con respaldo escrita(s) a mano (se permiten ${p}): usa <FotoRedonda> de ${PIEZA}`);
    else if (a < p) difs.push(`✓ ${f} bajó de ${p} a ${a}: táchalo en PENDIENTES de scripts/medir-foto-redonda.cjs`);
  }
  return difs;
}

// ── 2 · CÓMO SE VEN ───────────────────────────────────────────────────────

// El círculo a mano de antes: `<div style={{ width: '56px' … borderRadius: '50%' … }}> {X ? <img …/> : '👤'} </div>`.
const CIRCULO_VIEJO = /<div style=\{\{ width: '\d+px'[^\n]*?borderRadius: '50%'[^\n]*?\}\}>\s*\{[^\n]*?\?\s*<img\b[^\n]*?\/>\s*:\s*'👤'\}\s*<\/div>/g;
const CIRCULO_NUEVO = /<FotoRedonda\b[^>]*\/>/g;

/** Los círculos de cada archivo de SITIOS, en orden: [{ archivo, sitio, jsx }]. */
function losCirculos(leer) {
  const out = [];
  for (const archivo of [...new Set(SITIOS.map((s) => s[0]))]) {
    const t = limpio(leer(archivo) || '');
    const hallados = [...t.matchAll(CIRCULO_VIEJO), ...t.matchAll(CIRCULO_NUEVO)].sort((a, b) => a.index - b.index).map((m) => m[0]);
    const nombres = SITIOS.filter((s) => s[0] === archivo).map((s) => s[1]);
    if (hallados.length !== nombres.length) throw new Error(archivo + ': esperaba ' + nombres.length + ' foto(s) redonda(s) y hay ' + hallados.length);
    hallados.forEach((jsx, i) => out.push({ archivo, sitio: nombres[i], jsx }));
  }
  return out;
}

/** Describe lo pintado sin depender del orden de las claves del estilo: etiqueta, estilo ordenado, src y texto. */
function describir(el, props) {
  if (el.nodeType === 3) return JSON.stringify(el.textContent);
  const st = props(el).style || {};
  // Un hueco vacío (undefined) React no lo pinta: no cuenta.
  const orden = Object.keys(st).filter((k) => st[k] != null).sort().map((k) => k + ':' + st[k]).join(';');
  const src = el.getAttribute('src');
  return el.tagName.toLowerCase() + '{' + orden + '}' + (src != null ? '[src=' + src + ']' : '')
    + '(' + [...el.childNodes].map((c) => describir(c, props)).join(',') + ')';
}

const FOTO = 'https://almacen.de.mentira/foto.jpg';

/**
 * EL RECORRIDO: pinta cada círculo del código (del disco o de `commit`) en tres casos.
 * Devuelve [{ archivo, sitio, conFoto, sinFoto, fotoRota, imgRota }] — imgRota: si con la foto rota queda una
 * <img> puesta (el círculo vacío con el ícono roto) en vez del muñeco.
 */
async function recorrido(commit = null, cambios = {}) {
  const H = P.herramientas();
  const leer = P.lector(commit, cambios);
  const circulos = losCirculos(leer);
  const dom = new H.JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { pretendToBeVisual: true });
  const win = dom.window;
  const antes = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
  const errorReal = console.error;
  global.window = win;
  global.document = win.document;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  console.error = () => {};
  const out = [];
  try {
    const { React } = H;
    const { act } = React;
    const raiz = win.document.getElementById('raiz');
    const props = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactProps$')); return k ? el[k] : {}; };
    for (const [i, c] of circulos.entries()) {
      // El círculo, tal cual está en su archivo, con sus variables puestas.
      const virtual = 'guajirago/src/__foto_' + i + '.js';
      const usaPieza = /<FotoRedonda\b/.test(c.jsx);
      const fuente = "import React from 'react';\n"
        + (usaPieza ? "import FotoRedonda from './FotoRedonda';\n" : '')
        + "import { T } from './theme';\n"
        + 'export default function Sitio({ src }) {\n'
        + '  const foto = src; const fotoMostrar = src; const fotoConductor = src; const datosConductor = { foto: src }; void T;\n'
        + '  return (' + c.jsx + ');\n}\n';
      const Sitio = P.cargarModulo(virtual, P.lector(commit, { ...cambios, [virtual]: fuente }), {}).default;
      const pintar = async (src, romper) => {
        const r = H.cliente.createRoot(raiz);
        await act(async () => { r.render(React.createElement(Sitio, { src })); });
        if (romper) {
          const img = raiz.querySelector('img');
          if (img) await act(async () => { img.dispatchEvent(new win.Event('error')); });
        }
        const vista = describir(raiz.firstChild, props);
        const img = !!raiz.querySelector('img');
        await act(async () => { r.unmount(); });
        return { vista, img };
      };
      const con = await pintar(FOTO, false);
      const sin = await pintar(null, false);
      const rota = await pintar(FOTO, true);
      out.push({ archivo: c.archivo, sitio: c.sitio, conFoto: con.vista, sinFoto: sin.vista, fotoRota: rota.vista, imgRota: rota.img });
    }
  } finally {
    console.error = errorReal;
    global.window = antes.window;
    global.document = antes.document;
    global.IS_REACT_ACT_ENVIRONMENT = antes.act;
  }
  return out;
}

/** Careo de dos recorridos: con foto y sin foto tienen que verse IGUAL; lo roto se cuenta aparte. */
function carear(antes, ahora) {
  const difs = [];
  if (antes.length !== ahora.length) difs.push('antes hay ' + antes.length + ' fotos y ahora ' + ahora.length);
  for (let i = 0; i < Math.min(antes.length, ahora.length); i += 1) {
    for (const caso of ['conFoto', 'sinFoto']) {
      if (antes[i][caso] !== ahora[i][caso]) difs.push(ahora[i].sitio + ' · ' + caso + ':\n   antes ' + antes[i][caso] + '\n   ahora ' + ahora[i][caso]);
    }
  }
  return difs;
}

// ── 3 · LOS DATOS ─────────────────────────────────────────────────────────

async function datos() {
  const { traer, doc } = require('./nube.cjs');
  const { fotoDe } = require('../pruebas/cargar.cjs').cargarDeLaApp('guajirago/src/fotoUsuario.js');
  const usuarios = (await traer('usuarios')).map(doc);
  const viajes = (await traer('viajes')).map(doc);
  const fotos = [
    ...usuarios.map((u) => ['ficha', fotoDe(u)]),
    ...viajes.map((v) => ['viaje', v.conductorFoto || null]),
  ].filter((x) => x[1]);
  const cache = new Map();
  const carga = async (url) => {
    if (cache.has(url)) return cache.get(url);
    let ok = 'no';
    if (/^data:image\//.test(url)) ok = 'sí';
    else {
      try {
        const r = await fetch(url, { method: 'HEAD' });
        ok = r.ok && /^image\//.test(r.headers.get('content-type') || '') ? 'sí' : 'no (' + r.status + ')';
      } catch (e) { ok = 'no (sin respuesta)'; }
    }
    cache.set(url, ok);
    return ok;
  };
  const cuenta = {};
  for (const [tipo, url] of fotos) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await carga(url);
    const k = tipo + ' · carga ' + ok;
    cuenta[k] = (cuenta[k] || 0) + 1;
  }
  return { usuarios: usuarios.length, viajes: viajes.length, conFoto: fotos.length, distintas: cache.size, cuenta };
}

// ── EL INFORME ────────────────────────────────────────────────────────────

async function principal() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit') ? args[args.indexOf('--commit') + 1] : null;
  const leer = P.lector(commit);

  const hoy = copias(leer);
  console.log('\n👤 LAS FOTOS DE PERSONA CON RESPALDO' + (commit ? ' (commit ' + commit + ')' : ''));
  const total = Object.values(hoy.archivos).reduce((a, b) => a + b, 0);
  console.log('   escritas a mano: ' + total + (total ? '' : ' (ninguna)'));
  for (const [f, n] of Object.entries(hoy.archivos)) console.log('      ' + f.padEnd(40) + n + (PENDIENTES[f] ? '  (PENDIENTES, otro repo)' : ''));
  console.log('   pantallas que usan la pieza (' + PIEZA + '): ' + (hoy.usan.join(', ') || 'ninguna'));
  if (!commit) {
    const difs = contraPendientes(hoy);
    console.log(difs.length ? '   ' + difs.join('\n   ') : '   ✓ nada nuevo a mano, y PENDIENTES al día');
  }

  const r = await recorrido(commit);
  console.log('\n🖼️  PINTADAS CON REACT (con foto · sin foto · con una foto que NO carga)');
  for (const x of r) {
    console.log('   ' + x.sitio.padEnd(26) + (x.conFoto.includes('img{') ? 'foto' : '¿?') + ' · '
      + (x.sinFoto.includes('"👤"') ? '👤' : '¿?') + ' · ' + (x.imgRota ? 'círculo con la imagen rota' : (x.fotoRota.includes('"👤"') ? '👤' : '¿?')));
  }
  const rotas = r.filter((x) => x.imgRota).length;
  console.log('   con la foto rota enseñan la imagen rota en vez del muñeco: ' + rotas + ' de ' + r.length);
  if (!commit) {
    const antes = await recorrido(ANTES);
    const difs = carear(antes, r);
    console.log('   careo con ' + ANTES + ' (con foto y sin foto): ' + (difs.length ? '🔴 ' + difs.length + ' diferencia(s)\n   ' + difs.join('\n   ') : 'IGUAL en los ' + r.length + ' sitios'));
  }

  if (!args.includes('--sin-red')) {
    const d = await datos();
    console.log('\n☁️  PRODUCCIÓN: ' + d.usuarios + ' fichas, ' + d.viajes + ' viajes · con foto: ' + d.conFoto + ' (' + d.distintas + ' fotos distintas)');
    for (const [k, n] of Object.entries(d.cuenta).sort()) console.log('      ' + k.padEnd(34) + n);
  }
  console.log('');
}

module.exports = { PIEZA, ANTES, SITIOS, PENDIENTES, A_MANO, copias, contraPendientes, losCirculos, recorrido, carear };

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
