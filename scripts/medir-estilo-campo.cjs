#!/usr/bin/env node
/**
 * ▭ EL ESTILO DEL CAMPO DEL FORMULARIO — gemelo G97 (30-sep-2026) · SOLO LECTURA (no toca datos: es solo código)
 *
 * La cajita blanca de borde gris claro donde va cada campo (un ícono y el texto que se escribe) y el estilo del texto
 * de dentro estaban escritos a mano, letra por letra, en dos sitios: el registro y la entrada (Login.js) y los datos
 * del conductor (App.js, PantallaDatosConductor). Ahora salen de UNA pieza, guajirago/src/estiloCampo.js, con los
 * colores de la paleta (theme.js, G90).
 *
 *   node scripts/medir-estilo-campo.cjs                   <- el código del disco
 *   node scripts/medir-estilo-campo.cjs --antes [<hash>]  <- y el careo con ese commit (por defecto 2a20537, antes de G97)
 *   node scripts/medir-estilo-campo.cjs --detalle         <- además, dónde está cada copia a mano
 *
 * ── LO QUE MIDE ────────────────────────────────────────────────────────────
 *  1. LAS COPIAS: dónde está escrito a mano el estilo de la caja y el del texto, en las tres apps, fuera de la pieza.
 *     Se buscan por lo que DICEN (el objeto, sin espacios ni comentarios), no por cómo se llama la variable. La caja
 *     no puede quedar a mano en ningún sitio; las copias del estilo del texto que ya estaban en OTRAS pantallas (en
 *     línea, dentro de otras cajas) van contadas en PENDIENTES y solo pueden bajar.
 *  2. CÓMO SE VEN: pinta con React, en un navegador de mentira (jsdom), la entrada de Login.js («Crear cuenta» y
 *     «Ya tengo cuenta») y los datos del conductor de App.js (vacía, y con el teléfono en rojo tras tocar Guardar), y
 *     apunta el HTML y los estilos TAL COMO REACT SE LOS DIO a cada elemento (jsdom tira del HTML lo que no sabe leer,
 *     como los degradados: lo aprendió G90). Con --antes, el mismo recorrido con el código de ese commit tiene que dar
 *     lo MISMO paso por paso.
 *  3. LOS DOS IGUALES: la caja y el texto del primer campo de Login y del primer campo del conductor, según React,
 *     son el mismo estilo.
 */
const path = require('node:path');
const fs = require('node:fs');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');
const P = require('./medir-paleta.cjs');

const ANTES = '2a20537';
const PIEZA = 'guajirago/src/estiloCampo.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
// Los dos estilos, escritos como estaban a mano (sin espacios).
const CAJA = "{background:'#FFFFFF',border:'1.5px solid #ECECEF',borderRadius:'16px',padding:'16px',marginBottom:'12px',display:'flex',alignItems:'center',gap:'12px'";
const TEXTO = "{background:'none',border:'none',outline:'none',color:'#1A1A1E',fontSize:'16px',width:'100%'";

/**
 * Las copias a mano del estilo del TEXTO que había en otras pantallas el día de G97 (en línea, cada una dentro de su
 * propia caja, que no es la del formulario). SOLO PUEDEN BAJAR. La de la CAJA no tiene lista: no queda ninguna.
 */
const PENDIENTES = {
  'guajirago-admin/src/App.js': 2,
  'guajirago-admin/src/Superadmin.js': 1,
  'guajirago/src/AyudaSoporte.js': 1,
  'guajirago/src/Configuracion.js': 1,
  'guajirago/src/MiPerfil.js': 2,
  'guajirago/src/Seguridad.js': 2,
  'guajirago/src/Solicitar.js': 5,
};

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

// ── 1 · LAS COPIAS ────────────────────────────────────────────────────────

/** Cuántas veces aparece `que` en el código (sin comentarios ni espacios) de un texto. */
function vecesEn(texto, que) {
  const t = soloCodigo(String(texto).replace(/\r\n/g, '\n')).replace(/\s+/g, '');
  que = que.replace(/\s+/g, '');
  let n = 0;
  for (let i = t.indexOf(que); i >= 0; i = t.indexOf(que, i + 1)) n++;
  return n;
}

/** { caja: { archivo: n }, texto: { archivo: n } } fuera de la pieza. `leer` y `extra` como en medir-paleta. */
function copias(leer = P.lector(null), extra = []) {
  const out = { caja: {}, texto: {} };
  const archivos = [];
  for (const c of CARPETAS) {
    const abs = path.join(RAIZ, c);
    if (!fs.existsSync(abs)) throw new Error('no está ' + c + ': los tres repos tienen que estar juntos en la raíz');
    for (const f of fs.readdirSync(abs)) if (f.endsWith('.js')) archivos.push(c + '/' + f);
  }
  for (const e of extra) if (!archivos.includes(e)) archivos.push(e);
  for (const f of archivos.sort()) {
    if (f === PIEZA) continue;
    const t = leer(f);
    if (t == null) continue;
    const c = vecesEn(t, CAJA);
    const x = vecesEn(t, TEXTO);
    if (c) out.caja[f] = c;
    if (x) out.texto[f] = x;
  }
  return out;
}

/** Lo que no cuadra: una caja a mano en cualquier sitio, o el texto por encima (o por debajo sin tachar) de PENDIENTES. */
function contraPendientes(hoy, pendientes = PENDIENTES) {
  const difs = [];
  for (const [f, n] of Object.entries(hoy.caja)) difs.push(`🔴 ${f}: ${n} caja(s) del campo escrita(s) a mano (sale de ${PIEZA})`);
  const todos = new Set([...Object.keys(hoy.texto), ...Object.keys(pendientes)]);
  for (const f of [...todos].sort()) {
    const n = hoy.texto[f] || 0;
    const p = pendientes[f] || 0;
    if (n > p) difs.push(`🔴 ${f}: ${n} estilo(s) del texto del campo a mano, y PENDIENTES dice ${p} (sale de ${PIEZA})`);
    else if (n < p) difs.push(`✓ ${f}: bajó de ${p} a ${n} — táchalo en PENDIENTES de scripts/medir-estilo-campo.cjs`);
  }
  return difs;
}

// ── 2 · CÓMO SE VEN ───────────────────────────────────────────────────────

/** Un módulo de mentira: cualquier cosa que se le pida es un componente/función que no pinta nada. */
function falso() {
  const nada = () => null;
  return new Proxy({}, { get: (t, k) => (k === '__esModule' ? true : nada) });
}

// Las pantallas grandes que App.js importa y este recorrido no pinta (solo se pinta PantallaDatosConductor).
const NO_SE_PINTAN = ['./Splash', './Login', './Home', './Solicitar', './Restaurantes', './Turismo', './AppConductor',
  './MiPerfil', './Ganancias', './Seguridad', './MisViajes', './AyudaSoporte', './Configuracion', './Promociones',
  './Creditos', './Anuncio', './subirAlAlmacen', './configApp', './navegacionMenu'];

/** Carga un módulo de la app (del lector), con Firebase de mentira y, si se pide, sin las pantallas grandes. */
function cargar(ruta, leer, cache, sinPantallas) {
  const H = P.herramientas();
  if (cache[ruta]) return cache[ruta].exports;
  const texto = leer(ruta);
  if (texto == null) throw new Error('no está ' + ruta);
  const code = H.babel.transformSync(texto, {
    babelrc: false, configFile: false, sourceType: 'module',
    presets: [[H.presetReact, { runtime: 'classic' }]], plugins: [H.aCommonJs],
  }).code;
  const mod = { exports: {} };
  cache[ruta] = mod;
  const req = (n) => {
    if (n === 'react') return H.React;
    if (n === './firebase' || n.startsWith('firebase/')) return falso();
    if (sinPantallas && NO_SE_PINTAN.includes(n)) return falso();
    if (!n.startsWith('./')) throw new Error(ruta + ' pide «' + n + '», que este medidor no sabe cargar');
    return cargar(path.posix.join(path.posix.dirname(ruta), n.endsWith('.js') ? n : n + '.js'), leer, cache, false);
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports;
}

/** EL RECORRIDO: pinta la entrada y los datos del conductor. Devuelve [{ paso, html, estilos, caja, texto }]. */
async function recorrido(commit = null, cambios = {}) {
  const H = P.herramientas();
  const leer = P.lector(commit, cambios);
  // PantallaDatosConductor no se exporta: se le pide a App.js que la deje salir, solo aquí.
  const app = leer('guajirago/src/App.js');
  const leerConSalida = (r) => (r === 'guajirago/src/App.js' ? app + '\nexport { PantallaDatosConductor as __PantallaDatosConductor };\n' : leer(r));
  const dom = new H.JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { pretendToBeVisual: true, url: 'https://guajirago-pruebas.web.app/' });
  const win = dom.window;
  const antes = { window: global.window, document: global.document, navigator: global.navigator, localStorage: global.localStorage, act: global.IS_REACT_ACT_ENVIRONMENT };
  const errorReal = console.error;
  global.window = win;
  global.document = win.document;
  Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true, writable: true });
  global.localStorage = win.localStorage;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  console.error = () => {};
  const pasos = [];
  try {
    const Login = cargar('guajirago/src/Login.js', leerConSalida, {}, false).default;
    const Datos = cargar('guajirago/src/App.js', leerConSalida, {}, true).__PantallaDatosConductor;
    if (typeof Login !== 'function') throw new Error('Login.js no exporta la pantalla');
    if (typeof Datos !== 'function') throw new Error('App.js no tiene PantallaDatosConductor');
    const { React } = H;
    const { act } = React;
    const raiz = win.document.getElementById('raiz');
    const props = (el) => { const k = Object.keys(el).find((x) => x.startsWith('__reactProps$')); return k ? el[k] : {}; };
    const estilos = () => [...raiz.querySelectorAll('*')].map((el) => el.tagName + ' ' + (props(el).style ? JSON.stringify(props(el).style) : '-')).join('\n');
    const campo = (ph) => [...raiz.querySelectorAll('input')].find((i) => i.getAttribute('placeholder') === ph);
    const apuntar = (paso, ph) => {
      const i = campo(ph);
      if (!i) throw new Error(paso + ': no encuentro el campo «' + ph + '»');
      pasos.push({ paso, html: raiz.innerHTML, estilos: estilos(), caja: props(i.parentElement).style, texto: props(i).style });
    };
    const tocar = async (txt) => {
      const b = [...raiz.querySelectorAll('button')].find((x) => x.textContent.trim() === txt);
      if (!b) throw new Error('no encuentro el botón «' + txt + '»');
      await act(async () => { b.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    };
    const nada = () => {};

    const r1 = H.cliente.createRoot(raiz);
    await act(async () => { r1.render(React.createElement(Login, { onEntrar: nada })); });
    await tocar('Crear cuenta'); apuntar('login · crear cuenta', 'NOMBRE COMPLETO');
    await tocar('Volver');
    await tocar('Ya tengo cuenta'); apuntar('login · ya tengo cuenta', 'Correo electrónico');
    await act(async () => { r1.unmount(); });

    const r2 = H.cliente.createRoot(raiz);
    await act(async () => { r2.render(React.createElement(Datos, { nombre: 'Ana Pérez', celular: '', onGuardar: nada, onVolver: nada })); });
    apuntar('conductor · datos, vacía', 'Número de teléfono');
    const sel = raiz.querySelector('select');
    await act(async () => {
      Object.getOwnPropertyDescriptor(win.HTMLSelectElement.prototype, 'value').set.call(sel, 'Taxi');
      sel.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
    const guardar = [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Entrar a GuajiraGo');
    if (!guardar) throw new Error('no encuentro el botón de guardar del conductor');
    await act(async () => { guardar.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
    apuntar('conductor · datos, el teléfono en rojo', 'Número de teléfono');
    await act(async () => { r2.unmount(); });
    return pasos;
  } finally {
    console.error = errorReal;
    global.window = antes.window;
    global.document = antes.document;
    Object.defineProperty(global, 'navigator', { value: antes.navigator, configurable: true, writable: true });
    global.localStorage = antes.localStorage;
    global.IS_REACT_ACT_ENVIRONMENT = antes.act;
    win.close();
  }
}

/** El careo de dos recorridos, paso por paso (HTML y estilos de React). Devuelve las diferencias en palabras. */
function carear(a, b) {
  const difs = [];
  if (a.length !== b.length) difs.push(`pasos: ${a.length} contra ${b.length}`);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].paso !== b[i].paso) difs.push(`paso ${i}: «${a[i].paso}» contra «${b[i].paso}»`);
    if (a[i].html !== b[i].html) difs.push(`«${a[i].paso}»: el HTML cambió`);
    if (a[i].estilos !== b[i].estilos) difs.push(`«${a[i].paso}»: los estilos que da React cambiaron`);
  }
  return difs;
}

/** Los dos formularios, ¿dan la misma caja y el mismo texto? (el primer paso de cada uno). */
function losDosIguales(pasos) {
  const l = pasos.find((p) => p.paso.startsWith('login'));
  const c = pasos.find((p) => p.paso.startsWith('conductor'));
  const difs = [];
  if (!l || !c) return ['faltan pasos para comparar'];
  if (JSON.stringify(l.caja) !== JSON.stringify(c.caja)) difs.push('la caja del campo: Login ' + JSON.stringify(l.caja) + ' · conductor ' + JSON.stringify(c.caja));
  if (JSON.stringify(l.texto) !== JSON.stringify(c.texto)) difs.push('el texto del campo: Login ' + JSON.stringify(l.texto) + ' · conductor ' + JSON.stringify(c.texto));
  return difs;
}

async function principal() {
  console.log('\n▭ EL ESTILO DEL CAMPO DEL FORMULARIO (G97) — solo lectura\n');
  const hoy = copias();
  console.log('1 · LAS COPIAS A MANO (fuera de ' + PIEZA + ')');
  const nCaja = Object.values(hoy.caja).reduce((s, n) => s + n, 0);
  const nTexto = Object.values(hoy.texto).reduce((s, n) => s + n, 0);
  console.log(`   la caja del campo:  ${nCaja} en ${Object.keys(hoy.caja).length} archivo(s)`);
  console.log(`   el texto del campo: ${nTexto} en ${Object.keys(hoy.texto).length} archivo(s)`);
  if (argumento('--detalle')) {
    for (const [f, n] of Object.entries(hoy.caja)) console.log(`      caja  · ${f}: ${n}`);
    for (const [f, n] of Object.entries(hoy.texto)) console.log(`      texto · ${f}: ${n}`);
  }
  const usan = ['guajirago/src/Login.js', 'guajirago/src/App.js'].filter((f) => /from '\.\/estiloCampo'/.test(P.lector(null)(f) || ''));
  console.log(`   usan la pieza: ${usan.length ? usan.join(', ') : 'ninguno'}`);
  const difs = contraPendientes(hoy);
  for (const d of difs) console.log('   ' + d);

  console.log('\n2 · CÓMO SE VEN (pintados con React)');
  const ahora = await recorrido(null);
  for (const p of ahora) console.log(`   ${p.paso}: caja ${JSON.stringify(p.caja)} · texto ${JSON.stringify(p.texto)}`);
  let careo = [];
  const a = argumento('--antes');
  if (a) {
    const commit = a === true ? ANTES : a;
    const viejo = await recorrido(commit);
    careo = carear(viejo, ahora);
    console.log(`   careo con ${commit}: ${careo.length ? careo.length + ' diferencia(s)' : 'IGUALES paso por paso (' + ahora.length + ' pasos, HTML y estilos de React)'}`);
    for (const d of careo) console.log('      🔴 ' + d);
  }

  console.log('\n3 · LOS DOS IGUALES (Login y el conductor)');
  const iguales = losDosIguales(ahora);
  console.log(iguales.length ? iguales.map((d) => '   🔴 ' + d).join('\n') : '   ✓ la misma caja y el mismo texto');

  const rojo = difs.some((d) => d.startsWith('🔴')) || careo.length || iguales.length;
  console.log('\n' + (rojo ? '🔴 algo no cuadra' : '✓ una sola pieza, y se ven igual') + '\n');
  process.exitCode = rojo ? 1 : 0;
}

module.exports = { ANTES, PIEZA, CAJA, TEXTO, PENDIENTES, vecesEn, copias, contraPendientes, recorrido, carear, losDosIguales };

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
