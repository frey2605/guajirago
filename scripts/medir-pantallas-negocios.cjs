#!/usr/bin/env node
/**
 * 🍽️🧭 LAS PANTALLAS «RESTAURANTES» Y «TURISMO» DEL PANEL — gemelo G89 (30-sep-2026) · SOLO LECTURA
 *
 * Hasta el 30-sep-2026 el panel tenía dos archivos casi iguales, guajirago-admin/src/Restaurantes.js y
 * guajirago-admin/src/Turismo.js: la misma pantalla (menú lateral Resumen / Todos / Pendientes, tarjetas, ficha con
 * Aprobar / Suspender / Rechazar / WhatsApp) escrita dos veces, con textos, iconos y colores distintos.
 *
 *   node scripts/medir-pantallas-negocios.cjs                     <- el código del disco
 *   node scripts/medir-pantallas-negocios.cjs --antes [<commit>]  <- y el careo con el panel de ese commit
 *                                                                    (por defecto 0f89437, el de antes de G89)
 *   node scripts/medir-pantallas-negocios.cjs --nube              <- y cuántos negocios, pedidos y reservas hay en producción
 *   node scripts/medir-pantallas-negocios.cjs --html              <- además, el HTML de cada paso
 *
 * ── LO QUE MIDE ────────────────────────────────────────────────────────────
 *  1. EL CÓDIGO: cuántas veces está escrita la pantalla (archivos del panel con `const tarjetaLista =` y
 *     `const renderDetalle =`) y cuántos renglones son iguales entre las dos copias.
 *  2. CÓMO SE VE Y QUÉ ESCRIBE: saca de guajirago-admin/src/App.js el renglón que abre cada módulo
 *     (`if (modulo === 'restaurantes') return …`), lo compila con el Babel del panel junto con TODO lo que importa, y
 *     lo PINTA con React en un navegador de mentira (jsdom), con una base de mentira y el reloj parado. Recorre las
 *     secciones (Todos, Resumen, Pendientes, buscar), abre la ficha de cada negocio, aprieta cada botón que escribe
 *     (Aprobar / Suspender / Rechazar) y apunta QUÉ escribe y dónde; aprieta «💬 WhatsApp» y apunta qué abre o qué
 *     ventanita sale; y con el servidor diciendo que no, apunta la ventanita y el renglón de la consola. Al final
 *     cambia de Restaurantes a Turismo sin pasar por otro módulo (lo que hace el menú del panel).
 *  3. EL CAREO: el mismo recorrido con el panel de otro commit. Tiene que dar lo MISMO paso por paso: el HTML, cada
 *     escritura y cada enlace. La única licencia, y se dice: el renglón de la CONSOLA (`[rechazo] …`) nombra el
 *     archivo donde vive el botón, así que cambia de nombre con el archivo; se enseña aparte y no cuenta.
 *  4. --nube: cuántos negocios de cada tipo, pedidos y reservas de turismo hay en producción (solo cuántos).
 *
 * No escribe nada: ni en la base, ni en el disco.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');

const PANEL = 'guajirago-admin';
const ANTES = '0f89437';
const NM = path.join(RAIZ, PANEL, 'node_modules');
const pedir = (n) => {
  try { return require(path.join(NM, n)); } catch (e) {
    throw new Error('hace falta ' + n + ' en ' + PANEL + '/node_modules (npm ci dentro del panel): ' + e.message);
  }
};

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/** Lee un archivo del panel (ruta dentro de src/): del disco, o de un commit del panel. `cambios` pisa lo que haya. */
function lector(commit, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    if (!commit) {
      const abs = path.join(RAIZ, PANEL, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['-C', path.join(RAIZ, PANEL), 'show', commit + ':' + r], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Los .js de src/ del panel: del disco o de un commit. */
function listar(commit) {
  if (!commit) return fs.readdirSync(path.join(RAIZ, PANEL, 'src')).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f);
  return execFileSync('git', ['-C', path.join(RAIZ, PANEL), 'ls-tree', '--name-only', commit, 'src/'], { encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.js'));
}

const huella = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 10);

// ── 1 · EL CÓDIGO ──────────────────────────────────────────────────────────

/** Renglones iguales entre dos textos (la subsecuencia común más larga, sin contar renglones en blanco). */
function renglonesIguales(a, b) {
  const A = a.replace(/\r\n/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  const B = b.replace(/\r\n/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  let prev = new Array(B.length + 1).fill(0);
  for (let i = 1; i <= A.length; i += 1) {
    const cur = new Array(B.length + 1).fill(0);
    for (let j = 1; j <= B.length; j += 1) cur[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    prev = cur;
  }
  return prev[B.length];
}

/** Los archivos del panel que dibujan la pantalla de negocios (tarjeta de la lista + ficha), y cuánto se parecen. */
function elCodigo(commit, leer = lector(commit)) {
  const copias = listar(commit).filter((r) => {
    const t = leer(r);
    return t != null && /const tarjetaLista\s*=/.test(soloCodigo(t)) && /const renderDetalle\s*=/.test(soloCodigo(t));
  });
  let iguales = 0;
  if (copias.length >= 2) iguales = renglonesIguales(leer(copias[0]), leer(copias[1]));
  return { copias, iguales };
}

// ── 2 · PINTAR Y TOCAR ─────────────────────────────────────────────────────

let HERR = null;
/** Babel, React y jsdom del panel (los mismos con que se compila). */
function herramientas() {
  if (HERR) return HERR;
  HERR = {
    babel: pedir('@babel/core'),
    presetReact: pedir('@babel/preset-react'),
    aCommonJs: pedir('@babel/plugin-transform-modules-commonjs'),
    React: pedir('react'),
    cliente: pedir('react-dom/client'),
    JSDOM: pedir('jsdom').JSDOM,
    Timestamp: pedir('firebase/firestore').Timestamp,
  };
  return HERR;
}

/** La base de mentira: lo que devuelve cada colección, y lo que se le escribe. `falla` hace que toda escritura se rechace. */
function baseDeMentira(datos) {
  const escrituras = [];
  const estado = { falla: null };
  const snap = (col) => ({ docs: (datos[col] || []).map((o) => ({ id: o.id, data: () => { const { id, ...resto } = o; return resto; } })) });
  const firestore = {
    collection: (_db, col) => ({ col }),
    doc: (_db, col, id) => ({ ruta: col + '/' + id }),
    onSnapshot: (ref, ok) => { ok(snap(ref.col)); return () => {}; },
    getDocs: async (ref) => snap(ref.col),
    updateDoc: async (ref, campos) => {
      if (estado.falla) throw estado.falla;
      escrituras.push({ ruta: ref.ruta, campos });
    },
  };
  return { escrituras, estado, firestore };
}

/** Carga un módulo del panel (con JSX o sin él) y lo que importa, desde el lector. */
function cargarModulo(ruta, leer, cache, base) {
  const H = herramientas();
  if (cache[ruta]) return cache[ruta].exports;
  const texto = leer(ruta);
  if (texto == null) throw new Error('no está ' + PANEL + '/' + ruta);
  const code = H.babel.transformSync(texto, {
    babelrc: false, configFile: false, sourceType: 'module',
    presets: [[H.presetReact, { runtime: 'classic' }]], plugins: [H.aCommonJs],
  }).code;
  const mod = { exports: {} };
  cache[ruta] = mod;
  const req = (n) => {
    if (n === 'react') return H.React;
    if (n === 'firebase/firestore') return base.firestore;
    if (n === './firebase') return { db: { soyLaBase: true } };
    if (!n.startsWith('./')) throw new Error(ruta + ' pide «' + n + '», que este medidor no sabe cargar');
    return cargarModulo(path.posix.join(path.posix.dirname(ruta), n.endsWith('.js') ? n : n + '.js'), leer, cache, base);
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports;
}

/**
 * El renglón de App.js que abre un módulo (`if (modulo === 'turismo') return <… />;`), compilado con los componentes
 * que App.js importa para él: () => el elemento que App pinta.
 */
function elModulo(modulo, leer, cache, base, alVolver) {
  const H = herramientas();
  const app = leer('src/App.js');
  if (app == null) throw new Error('no está ' + PANEL + '/src/App.js');
  const t = app.replace(/\r\n/g, '\n');
  const m = new RegExp("if \\(modulo === '" + modulo + "'\\) return (<[^\\n]*/>);").exec(t);
  if (!m) throw new Error('no encuentro en App.js el renglón que abre «' + modulo + '»');
  const jsx = m[1];
  const alcance = { React: H.React, setModulo: (x) => alVolver(x) };
  for (const i of t.matchAll(/^import (\w+) from '(\.\/[\w]+)';/gm)) {
    if (new RegExp('<' + i[1] + '\\b').test(jsx)) {
      const r = path.posix.join('src', i[2].slice(2) + '.js');
      alcance[i[1]] = cargarModulo(r, leer, cache, base).default;
    }
  }
  const js = H.babel.transformSync('(' + jsx + ')', {
    babelrc: false, configFile: false, sourceType: 'script', presets: [[H.presetReact, { runtime: 'classic' }]],
  }).code.replace(/;\s*$/, '');
  const nombres = Object.keys(alcance);
  // eslint-disable-next-line no-new-func
  return () => new Function(...nombres, 'return ' + js + ';')(...nombres.map((k) => alcance[k]));
}

// El reloj de la pantalla: las 3:30 p. m. del martes 29 de septiembre de 2026 en Colombia.
const AHORA = Date.parse('2026-09-29T15:30:00-05:00');

/** Los datos de mentira: negocios de los dos tipos en los cuatro estados, su cuarto, pedidos y reservas. */
function losDatos() {
  const { Timestamp } = herramientas();
  const ts = (iso) => Timestamp.fromDate(new Date(iso));
  const hoy = (h) => '2026-09-29T' + h + ':00-05:00';
  const ayer = '2026-09-28T10:00:00-05:00';
  const plato = (i) => ({ nombre: i % 7 === 0 ? '' : 'Plato ' + i, precio: i * 1000 + 500 });
  const tour = (i) => ({ nombre: i % 5 === 0 ? '' : 'Tour ' + i, precio: i * 25000, tipo: i % 2 ? 'alquiler' : 'tour' });
  const negocios = [
    { id: 'R1', nombre: 'La Arepa', tipoNegocio: 'restaurante', aprobado: true, estadoAprobacion: 'aprobado', logo: 'https://x/logo1.jpg', perfilCompleto: true, horarioApertura: 0, horarioCierre: 0, menu: Array.from({ length: 25 }, (_, i) => plato(i + 1)), fechaCreacion: '2026-08-01T12:00:00.000Z', direccion: 'Calle 1 # 2-3' },
    { id: 'R2', nombre: 'Sin Tipo Viejo', aprobado: false, estadoAprobacion: 'pendiente', perfilCompleto: false, fechaCreacion: '2026-09-20T12:00:00.000Z' },
    { id: 'R3', nombre: 'Pausado', tipoNegocio: 'restaurante', aprobado: false, estadoAprobacion: 'suspendido', perfilCompleto: true, abierto: false, horarioApertura: 8, horarioCierre: 22, menu: [plato(3)], fechaCreacion: ts('2026-07-15T10:00:00.000Z') },
    { id: 'R4', nombre: '', tipoNegocio: 'restaurante', aprobado: false, estadoAprobacion: 'rechazado', perfilCompleto: true, horarioApertura: 16, horarioCierre: 18, telefono: 'abc', fechaCreacion: 'no es fecha' },
    { id: 'R5', nombre: 'Ana Comidas', tipoNegocio: 'restaurante', perfilCompleto: true, activo: false },
    { id: 'A1', nombre: 'Guajira Tours', tipoNegocio: 'turismo', aprobado: true, estadoAprobacion: 'aprobado', logo: 'https://x/logo2.jpg', perfilCompleto: true, tours: Array.from({ length: 22 }, (_, i) => tour(i + 1)), fechaCreacion: '2026-08-10T12:00:00.000Z', direccion: 'Malecón' },
    { id: 'A2', nombre: 'Nueva Agencia', tipoNegocio: 'turismo', aprobado: false, estadoAprobacion: 'pendiente', perfilCompleto: false, fechaCreacion: ts('2026-09-25T10:00:00.000Z') },
    { id: 'A3', nombre: 'Ana Viajes', tipoNegocio: 'turismo', aprobado: false, estadoAprobacion: 'suspendido', perfilCompleto: true, tours: [tour(2)], telefono: '5712345678' },
    { id: 'A4', tipoNegocio: 'turismo', aprobado: false, estadoAprobacion: 'rechazado', fechaCreacion: 'no es fecha' },
  ];
  const negociosPrivado = [
    { id: 'R1', duenoNombre: 'Ana Pérez', duenoTelefono: '3001234567', email: 'ana@x.co', creditos: '15000' },
    { id: 'R3', duenoNombre: 'Luis', duenoTelefono: '300 123 45', creditos: 2500 },
    { id: 'A1', duenoNombre: 'Marta Ana', duenoTelefono: '+57 311 222 3344', email: 'marta@x.co', creditos: 70000 },
    { id: 'A2', duenoNombre: 'Pedro', creditos: 'no' },
  ];
  const pedidos = [];
  for (let i = 0; i < 14; i += 1) {
    const creado = i < 4 ? ts(hoy(String(8 + i).padStart(2, '0') + ':15')) : i < 7 ? hoy(String(10 + i) + ':00') : i < 12 ? ayer : i === 12 ? 'no es fecha' : null;
    pedidos.push({ id: 'P' + i, restauranteId: 'R1', cliente: i % 3 === 0 ? 'Cliente ' + i : '', clienteNombre: i % 3 === 1 ? 'Nombre ' + i : '', total: i * 1500, estado: i % 4 === 0 ? '' : 'entregado', creado });
  }
  pedidos.push({ id: 'PX', restauranteId: 'R3', cliente: 'Z', total: '9000', estado: 'nuevo', creado: hoy('09:00') });
  const reservasTurismo = [];
  for (let i = 0; i < 13; i += 1) {
    const creado = i < 3 ? hoy(String(8 + i).padStart(2, '0') + ':00') :i < 6 ? ayer : i === 6 ? 'no es fecha' : i === 7 ? null : '2026-09-2' + (i - 7) + 'T12:00:00.000Z';
    reservasTurismo.push({ id: 'T' + i, agenciaId: 'A1', nombreTour: i % 4 === 0 ? '' : 'Tour ' + i, cliente: i % 3 ? 'Cli ' + i : '', total: i * 40000, personas: i % 2 ? i : 0, fecha: i % 5 === 0 ? '2026-10-0' + (i % 9 + 1) : '', estado: i % 3 === 0 ? '' : 'confirmada', creado });
  }
  reservasTurismo.push({ id: 'TX', agenciaId: 'A3', nombreTour: 'Cabo', cliente: 'Y', total: 100000, personas: 3, creado: hoy('07:00') });
  return { negocios, negociosPrivado, pedidos, reservasTurismo };
}

/** Pone el reloj parado y la zona de Colombia mientras corre `fn` (async). */
async function conReloj(fn) {
  const Real = Date;
  const antesTz = process.env.TZ;
  class Parado extends Real {
    constructor(...a) { if (a.length === 0) super(AHORA); else super(...a); }
    static now() { return AHORA; }
  }
  global.Date = Parado;
  process.env.TZ = 'America/Bogota';
  try { return await fn(); } finally {
    global.Date = Real;
    if (antesTz === undefined) delete process.env.TZ; else process.env.TZ = antesTz;
  }
}

/**
 * EL RECORRIDO: pinta el módulo que dice App.js y lo usa como una persona. Devuelve la lista de pasos:
 * [{ paso, html, escrituras, abre, consola }].
 */
async function recorrido(commit, cambios = {}) {
  const H = herramientas();
  const leer = lector(commit, cambios);
  const dom = new H.JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { pretendToBeVisual: true });
  const win = dom.window;
  const antes = { window: global.window, document: global.document, navigator: global.navigator, act: global.IS_REACT_ACT_ENVIRONMENT };
  const consola = [];
  const errorReal = console.error;
  global.window = win;
  global.document = win.document;
  Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true, writable: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  console.error = (...a) => { consola.push(a.map(String).join(' ')); };
  const abiertos = [];
  win.open = (u) => { abiertos.push(String(u)); return {}; };
  const pasos = [];
  try {
    return await conReloj(async () => {
      const base = baseDeMentira(losDatos());
      const cache = {};
      let volvio = null;
      const modulos = {
        restaurantes: elModulo('restaurantes', leer, cache, base, (x) => { volvio = x; }),
        turismo: elModulo('turismo', leer, cache, base, (x) => { volvio = x; }),
      };
      const raiz = win.document.getElementById('raiz');
      const root = H.cliente.createRoot(raiz);
      const { act } = H.React;
      const tocar = async (el) => { await act(async () => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); }); };
      const escribir = async (input, v) => {
        await act(async () => {
          Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, v);
          input.dispatchEvent(new win.Event('input', { bubbles: true }));
        });
      };
      const apuntar = (paso, extra = {}) => {
        pasos.push({ paso, html: raiz.innerHTML, escrituras: base.escrituras.splice(0), abre: abiertos.splice(0), consola: consola.splice(0), ...extra });
      };
      const nav = () => [...raiz.querySelectorAll('.gg-mod-navitems > div')];
      const contenido = () => raiz.querySelector('.gg-mod > div:nth-child(2)');
      const tarjetas = () => [...contenido().querySelectorAll('div[style*="cursor: pointer"]')];
      const boton = (txt) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === txt);

      for (const modulo of ['restaurantes', 'turismo']) {
        await act(async () => { root.render(modulos[modulo]()); });
        apuntar(modulo + ' · al abrir');
        const [resumen, todos, pendientes] = nav();
        await tocar(resumen); apuntar(modulo + ' · Resumen');
        await tocar(pendientes); apuntar(modulo + ' · Pendientes');
        await tocar(todos); apuntar(modulo + ' · Todos');
        const buscar = contenido().querySelector('input');
        for (const q of ['ana', '3001', 'zzz', '']) { await escribir(buscar, q); apuntar(modulo + ' · buscar «' + q + '»'); }
        const n = tarjetas().length;
        for (let i = 0; i < n; i += 1) {
          await tocar(tarjetas()[i]);
          apuntar(modulo + ' · ficha ' + i);
          for (const b of ['🚫 Suspender', '✅ Aprobar', 'Rechazar']) {
            const el = boton(b);
            if (!el) continue;
            await tocar(el); apuntar(modulo + ' · ficha ' + i + ' · ' + b);
            base.estado.falla = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
            await tocar(el); apuntar(modulo + ' · ficha ' + i + ' · ' + b + ' (el servidor dice que no)');
            base.estado.falla = null;
            const cerrar = boton('Entendido');
            if (cerrar) { await tocar(cerrar); apuntar(modulo + ' · ficha ' + i + ' · cierra la ventanita'); }
          }
          await tocar(boton('💬 WhatsApp')); apuntar(modulo + ' · ficha ' + i + ' · 💬 WhatsApp');
          const cerrar = boton('Entendido');
          if (cerrar) { await tocar(cerrar); apuntar(modulo + ' · ficha ' + i + ' · cierra la ventanita'); }
          await tocar(boton('← Volver a la lista')); apuntar(modulo + ' · ficha ' + i + ' · ← Volver a la lista');
        }
        // En Pendientes, la tarjeta también abre la ficha.
        await tocar(pendientes);
        const tp = tarjetas();
        if (tp.length) { await tocar(tp[0]); apuntar(modulo + ' · Pendientes · ficha 0'); }
        await tocar(resumen);
        await tocar(boton('← Volver')); apuntar(modulo + ' · ← Volver', { volvio });
      }
      // El menú del panel pasa de un módulo a otro sin cerrar el primero. Turismo tiene que abrir como nuevo (en
      // «Todas», sin nada buscado ni ficha abierta), no heredar lo que quedó en Restaurantes.
      await act(async () => { root.render(modulos.restaurantes()); });
      await tocar(tarjetas()[0]);
      await act(async () => { root.render(modulos.turismo()); });
      apuntar('de 🍽️ Restaurantes (con una ficha abierta) a 🧭 Turismo');
      await act(async () => { root.render(modulos.restaurantes()); });
      await escribir(contenido().querySelector('input'), 'ana');
      await tocar(nav()[0]);
      await act(async () => { root.render(modulos.turismo()); });
      apuntar('de 🍽️ Restaurantes (en Resumen, con «ana» buscado) a 🧭 Turismo');
      await tocar(nav()[1]);
      apuntar('de 🍽️ Restaurantes (en Resumen, con «ana» buscado) a 🧭 Turismo · Todas');
      await act(async () => { root.unmount(); });
      return pasos;
    });
  } finally {
    console.error = errorReal;
    global.window = antes.window;
    global.document = antes.document;
    Object.defineProperty(global, 'navigator', { value: antes.navigator, configurable: true, writable: true });
    global.IS_REACT_ACT_ENVIRONMENT = antes.act;
    win.close();
  }
}

/** El renglón de la consola sin el nombre del archivo del botón (la única licencia del careo). */
const consolaSinArchivo = (l) => String(l).replace(/^\[rechazo\] .*?\(/, '[rechazo] (').replace(/\((?:restaurante|turismo) · /, '(');

/** Compara dos recorridos paso por paso. Devuelve { comparaciones, distintas: [{ paso, que }], consola: [...] }. */
function carear(antes, ahora) {
  const distintas = [];
  const consola = [];
  const n = Math.max(antes.length, ahora.length);
  let comparaciones = 0;
  for (let i = 0; i < n; i += 1) {
    const a = antes[i];
    const b = ahora[i];
    if (!a || !b) { distintas.push({ paso: (a || b).paso, que: a ? 'falta en AHORA' : 'sobra en AHORA' }); continue; }
    if (a.paso !== b.paso) { distintas.push({ paso: a.paso + ' / ' + b.paso, que: 'el recorrido se desvió' }); continue; }
    for (const k of ['html', 'escrituras', 'abre', 'volvio']) {
      comparaciones += 1;
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) distintas.push({ paso: a.paso, que: k });
    }
    comparaciones += 1;
    if (JSON.stringify(a.consola.map(consolaSinArchivo)) !== JSON.stringify(b.consola.map(consolaSinArchivo))) distintas.push({ paso: a.paso, que: 'consola' });
    if (JSON.stringify(a.consola) !== JSON.stringify(b.consola)) consola.push({ paso: a.paso, antes: a.consola, ahora: b.consola });
  }
  return { comparaciones, distintas, consola };
}

/** Lo que un recorrido deja escrito en la base, junto (para enseñarlo). */
const escriturasDe = (pasos) => pasos.flatMap((p) => p.escrituras.map((e) => p.paso + ' → ' + e.ruta + ' ' + JSON.stringify(e.campos)));

// ── 4 · PRODUCCIÓN ─────────────────────────────────────────────────────────
async function laNube() {
  const { traer, doc } = require('./nube.cjs');
  const negocios = (await traer('negocios')).map(doc);
  const pedidos = await traer('pedidos');
  const reservas = await traer('reservasTurismo');
  return {
    negocios: negocios.length,
    restaurantes: negocios.filter((n) => n.tipoNegocio !== 'turismo').length,
    agencias: negocios.filter((n) => n.tipoNegocio === 'turismo').length,
    pedidos: pedidos.length,
    reservas: reservas.length,
  };
}

module.exports = { elCodigo, recorrido, carear, escriturasDe, lector, renglonesIguales, consolaSinArchivo, ANTES, AHORA };

if (require.main === module) {
  (async () => {
    console.log('\n=== 🍽️🧭 LAS PANTALLAS DE NEGOCIOS DEL PANEL · G89 · SOLO LECTURA ===');
    const pintarCodigo = (nombre, c) => {
      console.log('\n── EL CÓDIGO (' + nombre + '): la pantalla está escrita ' + c.copias.length + ' vez/veces: ' + c.copias.join(', '));
      if (c.copias.length >= 2) console.log('   renglones iguales entre las dos copias: ' + c.iguales);
    };
    const ahoraC = elCodigo(null);
    pintarCodigo('AHORA', ahoraC);
    const ahora = await recorrido(null);
    const esc = escriturasDe(ahora);
    console.log('\n── EL RECORRIDO (AHORA): ' + ahora.length + ' pasos · ' + esc.length + ' escrituras · '
      + ahora.reduce((s, p) => s + p.abre.length, 0) + ' WhatsApp abiertos · huella ' + huella(JSON.stringify(ahora)));
    for (const e of esc) console.log('   · ' + e);
    if (argumento('--html')) for (const p of ahora) console.log('\n[' + p.paso + ']\n' + p.html);

    let ok = ahoraC.copias.length === 1;
    const antesArg = argumento('--antes');
    if (antesArg) {
      const commit = antesArg === true ? ANTES : antesArg;
      pintarCodigo('ANTES, ' + commit, elCodigo(commit));
      const antes = await recorrido(commit);
      const c = carear(antes, ahora);
      console.log('\n── CAREO con ' + commit + ': ' + antes.length + ' / ' + ahora.length + ' pasos · ' + c.comparaciones + ' comparaciones · ' + c.distintas.length + ' distintas');
      for (const d of c.distintas) console.log('   ✗ ' + d.paso + ': ' + d.que);
      if (c.consola.length) {
        console.log('   (la consola nombra el archivo del botón, y cambió en ' + c.consola.length + ' paso(s); por ejemplo:)');
        console.log('     antes «' + c.consola[0].antes.join(' | ') + '»\n     ahora «' + c.consola[0].ahora.join(' | ') + '»');
      }
      ok = ok && c.distintas.length === 0;
    }
    if (argumento('--nube')) {
      const n = await laNube();
      console.log('\n── PRODUCCIÓN: ' + n.negocios + ' negocios (' + n.restaurantes + ' salen en 🍽️ Restaurantes, ' + n.agencias + ' en 🧭 Turismo) · '
        + n.pedidos + ' pedidos · ' + n.reservas + ' reservas de turismo');
    }
    console.log('\n' + (ok ? '✓ la pantalla de negocios está escrita UNA vez' + (antesArg ? ', y se ve y escribe igual que antes' : '')
      : '✗ la pantalla de negocios está escrita ' + ahoraC.copias.length + ' veces' + (antesArg ? ', o no se ve / no escribe igual que antes' : '')));
  })().catch((e) => { console.error('❌ ' + (e && e.stack || e)); process.exit(1); });
}
