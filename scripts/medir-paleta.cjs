#!/usr/bin/env node
/**
 * 🎨 LA PALETA DE GUAJIRAGO — gemelo G90 (30-sep-2026) · SOLO LECTURA (no toca datos: es solo código)
 *
 * guajirago/src/theme.js guarda los colores del sistema de diseño (tema claro, azul #1C8EF9, degradado cálido) desde
 * julio de 2026, y hasta el 30-sep-2026 no lo importaba NADIE: cada pantalla escribía sus colores a mano, y
 * Turismo.js tenía su propia paletita (AZUL, NARANJA, VERDE) aparte (SEGUNDA LEY).
 *
 *   node scripts/medir-paleta.cjs                   <- el código del disco
 *   node scripts/medir-paleta.cjs --antes [<hash>]  <- y el careo de las pantallas con la raíz de ese commit
 *                                                      (por defecto 907dfd6, el de antes de G90)
 *   node scripts/medir-paleta.cjs --html            <- además, el HTML de cada paso
 *   node scripts/medir-paleta.cjs --detalle         <- además, los colores a mano archivo por archivo
 *
 * ── LO QUE MIDE ────────────────────────────────────────────────────────────
 *  1. LOS COLORES A MANO: cuántos `#rgb` / `#rrggbb` / `#rrggbbaa` hay escritos en el código (sin comentarios) de los
 *     .js de guajirago/src, guajirago-admin/src y guajirago-aliados/src, sin contar theme.js (que ES la paleta).
 *     Es el mismo recorte que este comando de consola, pero sin comentarios y con los de 3 y 8 cifras:
 *       grep -rhoE "#[0-9A-Fa-f]{6}" guajirago/src guajirago-admin/src guajirago-aliados/src | wc -l
 *     `PENDIENTES` (abajo) lleva cuántos tenía cada archivo el día de G90, y la prueba (pruebas/paleta.test.js) solo
 *     deja que BAJEN: un color nuevo a mano pone la tanda en rojo, y uno quitado que nadie tache también.
 *  2. QUIÉN USA LA PALETA: qué archivos de la app de transporte importan theme.js, y cuáles se arman una paleta propia
 *     arriba del archivo (`const AZUL = '#…'`).
 *  3. LA COPIA DE ALIADOS: guajirago-aliados/src/flujoPedidos.js exporta AZUL, AZUL_MEDIO, NARANJA y NARANJA_CLARO. Es
 *     otro repo y no puede importar theme.js: se mira que diga lo MISMO que la paleta.
 *  4. CÓMO SE VEN: saca del disco (o de un commit) guajirago/src/Turismo.js y guajirago/src/MenuLateral.js, los compila
 *     con el Babel de la app junto con lo que importan (theme.js incluido), y los PINTA con React en un navegador de
 *     mentira (jsdom), con una base de mentira y el reloj parado. Abre y cierra el menú, recorre la lista de agencias,
 *     busca, «Mis reservas» con una reserva en cada estado, la agencia, la ventanita de reservar (sin fecha, con todo,
 *     y con el servidor diciendo que no) y la de «¡Reserva enviada!». Con --antes, el mismo recorrido con el código de
 *     ese commit tiene que dar el MISMO HTML paso por paso, sin ninguna licencia.
 *     🔴 Y el HTML solo NO basta: jsdom TIRA del atributo `style` lo que no sabe leer, y no sabe leer un
 *     `linear-gradient(…)` — el degradado del botón ☰ y el del encabezado del menú no salen en el HTML, así que un
 *     careo solo de HTML no vería cambiarlos (lo cazó el sabotaje de la prueba). Por eso cada paso apunta TAMBIÉN los
 *     estilos tal como React se los dio a cada elemento (sus props), y el careo compara los dos.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');

const ANTES = '907dfd6';
const PALETA = 'guajirago/src/theme.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
// La copia de aliados: cada nombre suyo ↔ el nombre en la paleta.
const COPIA_ALIADOS = 'guajirago-aliados/src/flujoPedidos.js';
const ATADOS = { AZUL: 'azul', AZUL_MEDIO: 'azulClaro', NARANJA: 'naranja', NARANJA_CLARO: 'amarillo' };
const COLOR = /#(?:[0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})(?![0-9A-Za-z_])/g;

/**
 * Los colores a mano que tenía cada archivo el 30-sep-2026, con G90 puesto. SOLO PUEDEN BAJAR: quien quite colores de
 * un archivo lo tacha aquí; un archivo nuevo con colores a mano no entra (nace usando theme.js).
 */
const PENDIENTES = {
  'guajirago-admin/src/AliadosPendientes.js': 18,
  'guajirago-admin/src/App.js': 118,
  'guajirago-admin/src/AvisoModal.js': 5,
  'guajirago-admin/src/CartelAmbiente.js': 1,
  'guajirago-admin/src/Cobros.js': 57,
  'guajirago-admin/src/Codigos.js': 130,
  'guajirago-admin/src/ComentariosReportados.js': 27,
  'guajirago-admin/src/Conductores.js': 247,
  'guajirago-admin/src/Mensajeria.js': 59,
  'guajirago-admin/src/NegociosDeUnTipo.js': 46,
  'guajirago-admin/src/Pasajeros.js': 78,
  'guajirago-admin/src/Promociones.js': 143,
  'guajirago-admin/src/Rechazos.js': 14,
  'guajirago-admin/src/Superadmin.js': 356,
  'guajirago-admin/src/Viajes.js': 61,
  'guajirago-admin/src/ambiente.js': 2,
  'guajirago-admin/src/estadosCobro.js': 7,
  'guajirago-admin/src/estadosViaje.js': 2,
  'guajirago-admin/src/tiposDeNegocio.js': 6,
  'guajirago-aliados/src/App.js': 94,
  'guajirago-aliados/src/AvisoModal.js': 5,
  'guajirago-aliados/src/CalificacionesRestaurante.js': 42,
  'guajirago-aliados/src/CartelAmbiente.js': 1,
  'guajirago-aliados/src/ConfigFlujos.js': 21,
  'guajirago-aliados/src/ConfigMesas.js': 18,
  'guajirago-aliados/src/Configuracion.js': 21,
  'guajirago-aliados/src/CorteCaja.js': 22,
  'guajirago-aliados/src/Empleados.js': 34,
  'guajirago-aliados/src/ErrorBoundary.js': 3, // G102: 7 -> 3 (los colores de la app entran por props desde index.js)
  'guajirago-aliados/src/HistorialDomicilios.js': 15,
  'guajirago-aliados/src/HistorialMesas.js': 8,
  'guajirago-aliados/src/Inventario.js': 76,
  'guajirago-aliados/src/Login.js': 25,
  'guajirago-aliados/src/Menu.js': 62,
  'guajirago-aliados/src/Mesero.js': 123,
  'guajirago-aliados/src/PedidosDomicilio.js': 97,
  'guajirago-aliados/src/PerfilAgencia.js': 21,
  'guajirago-aliados/src/PerfilRestaurante.js': 16,
  'guajirago-aliados/src/Promociones.js': 77,
  'guajirago-aliados/src/ReservasTurismo.js': 38,
  'guajirago-aliados/src/ResumenDia.js': 17,
  'guajirago-aliados/src/Tours.js': 54,
  'guajirago-aliados/src/ambiente.js': 2,
  // G102: 9 -> 11, y es la única subida a propósito: TINTA y GRIS salieron de ErrorBoundary.js (7 -> 3) a la paleta
  // de aliados, que es este archivo (no puede importar theme.js). En aliados, en total, 16 -> 14.
  'guajirago-aliados/src/flujoPedidos.js': 11,
  'guajirago-aliados/src/recibo.js': 5,
  'guajirago/src/Anuncio.js': 19,
  'guajirago/src/App.js': 125, // G97: 128 -> 125 (la caja y el texto del campo salen de estiloCampo.js)
  'guajirago/src/AppConductor.js': 298,
  'guajirago/src/AvisoModal.js': 5,
  'guajirago/src/AyudaSoporte.js': 22,
  'guajirago/src/Calificacion.js': 25,
  'guajirago/src/CartelAmbiente.js': 1,
  'guajirago/src/Configuracion.js': 45,
  'guajirago/src/Creditos.js': 52,
  'guajirago/src/ErrorBoundary.js': 3, // G102: 7 -> 3 (los colores entran por props desde index.js, tomados de T)
  'guajirago/src/Ganancias.js': 25,
  'guajirago/src/Home.js': 35,
  'guajirago/src/Llamada.js': 26,
  'guajirago/src/LlamadoAtencion.js': 9,
  'guajirago/src/LlamarAl123.js': 4,
  'guajirago/src/Login.js': 69, // G97: 72 -> 69 (ídem)
  'guajirago/src/Logo.js': 5,
  'guajirago/src/MapaConRuta.js': 1,
  'guajirago/src/MenuLateral.js': 3,
  'guajirago/src/MiPerfil.js': 57,
  'guajirago/src/MisViajes.js': 22,
  'guajirago/src/ModalCancelacion.js': 16,
  'guajirago/src/PaginaLegal.js': 7,
  'guajirago/src/PantallaFiesta.js': 11,
  'guajirago/src/Promociones.js': 51,
  'guajirago/src/Restaurantes.js': 225,
  'guajirago/src/Seguridad.js': 34,
  'guajirago/src/Solicitar.js': 282,
  'guajirago/src/Splash.js': 18,
  'guajirago/src/TratoHecho.js': 3,
  'guajirago/src/Turismo.js': 60,
  'guajirago/src/ambiente.js': 2,
  'guajirago/src/estadosViaje.js': 2,
};

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  if (i < 0) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

/** Lee un archivo (ruta desde la raíz): del disco, o de un commit de la raíz. `cambios` pisa lo que haya. */
function lector(commit, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    if (!commit || !r.startsWith('guajirago/')) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Los .js de las tres carpetas (del disco). `extra` suma archivos de mentira. */
function losArchivos(extra = []) {
  const out = [];
  for (const c of CARPETAS) {
    const abs = path.join(RAIZ, c);
    if (!fs.existsSync(abs)) throw new Error('no está ' + c + ': los tres repos tienen que estar juntos en la raíz');
    for (const f of fs.readdirSync(abs)) if (f.endsWith('.js')) out.push(c + '/' + f);
  }
  for (const e of extra) if (!out.includes(e)) out.push(e);
  return out.sort();
}

// ── 1 · LOS COLORES A MANO ────────────────────────────────────────────────

/** Cuántos colores a mano tiene un texto (sin comentarios). */
const coloresDe = (texto) => (soloCodigo(String(texto).replace(/\r\n/g, '\n')).match(COLOR) || []).length;

/** { archivo: n } de los archivos con algún color a mano (sin la paleta). */
function contar(leer = lector(null), extra = []) {
  const hoy = {};
  for (const f of losArchivos(extra)) {
    if (f === PALETA) continue;
    const t = leer(f);
    if (t == null) continue;
    const n = coloresDe(t);
    if (n > 0) hoy[f] = n;
  }
  return hoy;
}

/** Diferencias contra PENDIENTES: lo que subió (rojo) y lo que bajó sin tachar (también rojo). */
function contraPendientes(hoy, pendientes = PENDIENTES) {
  const difs = [];
  for (const f of [...new Set([...Object.keys(hoy), ...Object.keys(pendientes)])].sort()) {
    const a = hoy[f] || 0;
    const p = pendientes[f] || 0;
    if (a > p) difs.push(`🔴 ${f}: ${a} colores a mano y se permiten ${p}. Lo nuevo toma el color de guajirago/src/theme.js (T.…).`);
    else if (a < p) difs.push(`✓ ${f} bajó de ${p} a ${a}: táchalo en PENDIENTES de scripts/medir-paleta.cjs.`);
  }
  return difs;
}

// ── 2 · QUIÉN USA LA PALETA ───────────────────────────────────────────────

/** Los archivos de la app de transporte que importan theme.js. */
function quienImporta(leer = lector(null), extra = []) {
  return losArchivos(extra).filter((f) => f.startsWith('guajirago/src/') && f !== PALETA)
    .filter((f) => /^import\s[^;]*from\s+'\.\/theme(\.js)?';/m.test(soloCodigo(String(leer(f) || '').replace(/\r\n/g, '\n'))));
}

/** Los nombres de una paleta propia arriba del archivo: `const AZUL = '#…';` */
const paletaPropia = (texto) => [...soloCodigo(String(texto).replace(/\r\n/g, '\n'))
  .matchAll(/^const\s+([A-Z][A-Z0-9_]*)\s*=\s*['"`]#[0-9A-Fa-f]{3,8}['"`]/gm)].map((m) => m[1]);

// ── 3 · LA PALETA Y LA COPIA DE ALIADOS ───────────────────────────────────

let HERR = null;
function herramientas() {
  if (HERR) return HERR;
  const NM = path.join(RAIZ, 'guajirago', 'node_modules');
  const pedir = (n) => {
    try { return require(path.join(NM, n)); } catch (e) {
      throw new Error('hace falta ' + n + ' en guajirago/node_modules (npm ci dentro de guajirago): ' + e.message);
    }
  };
  const JSDOM = pedir('jsdom').JSDOM;
  // react-dom decide AL CARGARSE si hay navegador (`canUseDOM`), y sin él su onChange no oye el evento `input`: se
  // carga con una ventana de mentira puesta, y se quita después.
  const previa = { window: global.window, document: global.document };
  const w = new JSDOM('<!doctype html><html><body></body></html>').window;
  global.window = w;
  global.document = w.document;
  try {
    HERR = {
      babel: pedir('@babel/core'),
      presetReact: pedir('@babel/preset-react'),
      aCommonJs: pedir('@babel/plugin-transform-modules-commonjs'),
      React: pedir('react'),
      cliente: pedir('react-dom/client'),
      JSDOM,
    };
  } finally {
    global.window = previa.window;
    global.document = previa.document;
  }
  return HERR;
}

/** Carga un módulo de la app y lo que importa, desde el lector. `stubs` = { 'nombre pedido': módulo }. */
function cargarModulo(ruta, leer, cache, stubs = {}) {
  const H = herramientas();
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
    if (Object.prototype.hasOwnProperty.call(stubs, n)) return stubs[n];
    if (!n.startsWith('./')) throw new Error(ruta + ' pide «' + n + '», que este medidor no sabe cargar');
    return cargarModulo(path.posix.join(path.posix.dirname(ruta), n.endsWith('.js') ? n : n + '.js'), leer, cache, stubs);
  };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports;
}

/** La paleta que exporta theme.js, ejecutada. */
function laPaleta(leer = lector(null)) {
  return cargarModulo(PALETA, leer, {}).T;
}

/** Lo que exporta la copia de aliados, nombre por nombre: { AZUL: '#…', … } (lo que no esté, falta). */
function laCopiaDeAliados(leer = lector(null)) {
  const t = soloCodigo(String(leer(COPIA_ALIADOS) || '').replace(/\r\n/g, '\n'));
  const out = {};
  for (const k of Object.keys(ATADOS)) {
    const m = new RegExp('^export const ' + k + "\\s*=\\s*'([^']*)';", 'm').exec(t);
    out[k] = m ? m[1] : null;
  }
  return out;
}

/** Los nombres de la copia que no dicen lo mismo que la paleta. */
function copiaSeparada(T, copia) {
  return Object.entries(ATADOS).filter(([k, v]) => !T || copia[k] !== T[v])
    .map(([k, v]) => `${k} = ${copia[k]} y la paleta dice T.${v} = ${T ? T[v] : '(no hay paleta)'}`);
}

// ── 4 · CÓMO SE VEN ───────────────────────────────────────────────────────

// El reloj de la pantalla: las 3:30 p. m. del miércoles 30 de septiembre de 2026 en Colombia.
const AHORA = Date.parse('2026-09-30T15:30:00-05:00');

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

/** Los datos de mentira: agencias abiertas, cerradas y escondidas, con tours; y una reserva en cada estado. */
function losDatos() {
  const tour = (id, extra) => ({ id, nombre: 'Tour ' + id, precio: 120000, unidadPrecio: 'persona', descripcion: 'Un día entero', categoria: 'Playa', duracion: '8 h', cupoMax: 12, incluye: ['Almuerzo', 'Guía'], puntoEncuentro: 'Malecón', ...extra });
  const negocios = [
    { id: 'A1', nombre: 'Guajira Tours', tipoNegocio: 'turismo', aprobado: true, estadoAprobacion: 'aprobado', perfilCompleto: true, horarioApertura: 0, horarioCierre: 0, logo: 'https://x/logo1.jpg', descripcion: 'Cabo de la Vela y Punta Gallinas', telefono: '3001234567', demoraMin: 20,
      tours: [tour('T1'), tour('T2', { tipo: 'alquiler', unidadPrecio: 'dia', destacado: true, imagen: 'https://x/carro.jpg', incluye: [] }), tour('T3', { disponible: false })] },
    { id: 'A2', nombre: 'Playa Mayapo', tipoNegocio: 'turismo', aprobado: true, estadoAprobacion: 'aprobado', perfilCompleto: true, horarioApertura: 6, horarioCierre: 9, categorias: ['playa', 'sol', 'mar'], telefono: 'abc', tours: [] },
    { id: 'A3', nombre: 'Escondida', tipoNegocio: 'turismo', aprobado: false, estadoAprobacion: 'pendiente', perfilCompleto: true },
  ];
  const reservas = {
    R1: { agenciaNombre: 'Guajira Tours', nombreTour: 'Tour T1', fecha: '2026-10-05', personas: 2, total: 240000, estado: 'nueva' },
    R2: { agenciaNombre: 'Guajira Tours', nombreTour: 'Tour T1', fecha: '2026-10-06', personas: 1, total: 120000, estado: 'confirmada', codigo: '4821' },
    R3: { agenciaNombre: 'Guajira Tours', tipo: 'alquiler', nombreTour: 'Carro', fecha: '2026-09-01', personas: 1, total: 300000, estado: 'realizada' },
    R4: { agenciaNombre: 'Playa Mayapo', nombreTour: 'Sol', fecha: '', personas: 3, total: 90000, estado: 'cancelada', motivoCancelacion: 'Lluvia' },
    R5: { agenciaNombre: 'Playa Mayapo', nombreTour: 'Raro', fecha: 'no es fecha', personas: 1, total: 0, estado: 'rara' },
  };
  return { negocios, reservas };
}

/** La base de mentira de Turismo: lo que lee y lo que escribe. `falla` hace que la escritura se rechace. */
function baseDeMentira() {
  const { negocios, reservas } = losDatos();
  const escrituras = [];
  const estado = { falla: null };
  const firestore = {
    collection: (_db, col) => ({ col }),
    query: (ref) => ref,
    where: () => ({}),
    doc: (_db, col, id) => ({ col, id }),
    getDocs: async (ref) => ({ docs: (ref.col === 'negocios' ? negocios : []).map((o) => ({ id: o.id, data: () => { const { id, ...r } = o; return r; } })) }),
    getDoc: async (ref) => ({ exists: () => !!reservas[ref.id], data: () => reservas[ref.id] }),
    addDoc: async (ref, datos) => {
      if (estado.falla) throw estado.falla;
      escrituras.push({ col: ref.col, datos });
      return { id: 'NUEVA' + escrituras.length };
    },
  };
  return { escrituras, estado, firestore };
}

/** EL RECORRIDO: pinta el menú y Turismo como una persona. Devuelve [{ paso, html, escrituras }]. */
async function recorrido(commit, cambios = {}) {
  const H = herramientas();
  const leer = lector(commit, cambios);
  const dom = new H.JSDOM('<!doctype html><html><body><div id="raiz"></div></body></html>', { pretendToBeVisual: true, url: 'https://guajirago-pruebas.web.app/' });
  const win = dom.window;
  const antes = { window: global.window, document: global.document, navigator: global.navigator, localStorage: global.localStorage, act: global.IS_REACT_ACT_ENVIRONMENT };
  const errorReal = console.error;
  const consola = [];
  global.window = win;
  global.document = win.document;
  Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true, writable: true });
  global.localStorage = win.localStorage;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  console.error = (...a) => { consola.push(a.map(String).join(' ')); };
  win.alert = () => {};
  const pasos = [];
  try {
    return await conReloj(async () => {
      const base = baseDeMentira();
      const stubs = {
        'firebase/firestore': base.firestore,
        './firebase': { auth: { currentUser: { uid: 'pasajero1' } }, db: { soyLaBase: true } },
        './Notificaciones': { prepararTokenDeAvisos: () => () => {} },
      };
      const cache = {};
      const MenuLateral = cargarModulo('guajirago/src/MenuLateral.js', leer, cache, stubs).default;
      const Turismo = cargarModulo('guajirago/src/Turismo.js', leer, cache, stubs).default;
      const { React } = H;
      const { act } = React;
      const raiz = win.document.getElementById('raiz');
      const root = H.cliente.createRoot(raiz);
      const tocar = async (el, que) => {
        if (!el) throw new Error('no encuentro ' + que);
        await act(async () => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); });
      };
      const escribir = async (input, v) => {
        await act(async () => {
          Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value').set.call(input, v);
          input.dispatchEvent(new win.Event('input', { bubbles: true }));
        });
      };
      // Los estilos tal como React se los dio a cada elemento (jsdom tira los degradados del atributo `style`).
      const estilos = () => [...raiz.querySelectorAll('*')].map((el) => {
        const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'));
        return el.tagName + ' ' + (k && el[k].style ? JSON.stringify(el[k].style) : '-');
      }).join('\n');
      const apuntar = (paso) => { pasos.push({ paso, html: raiz.innerHTML, estilos: estilos(), escrituras: base.escrituras.splice(0) }); };
      const elMenu = () => [...raiz.querySelectorAll('div')].find((d) => d.textContent.trim() === '☰ Menú');
      const elVelo = () => [...raiz.querySelectorAll('div')].find((d) => d.style.position === 'fixed' && d.style.zIndex === '50');
      const volver = () => [...raiz.querySelectorAll('div')].find((d) => d.textContent.trim() === '‹ Volver');
      const boton = (txt) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === txt);
      const tarjeta = (txt) => [...raiz.querySelectorAll('div')].find((d) => d.style.cursor === 'pointer' && d.textContent.includes(txt));
      const campo = (ph) => [...raiz.querySelectorAll('input')].find((i) => i.getAttribute('placeholder') === ph);
      const nada = () => {};
      const props = { onIrPerfil: nada, onIrCreditos: nada, onIrViajes: nada, onIrGanancias: nada, onIrSeguridad: nada, onIrAyuda: nada, onIrConfig: nada, onIrPromociones: nada, onCerrarSesion: nada };

      // EL MENÚ SOLO, en sus dos formas.
      await act(async () => { root.render(React.createElement(MenuLateral, { ...props, nombre: 'Ana Pérez', onCambiarNegocio: nada })); });
      apuntar('menú · cerrado');
      await tocar(elMenu(), 'el botón ☰ Menú'); apuntar('menú · abierto, con «Cambiar de negocio»');
      await tocar(elVelo(), 'el velo del menú'); apuntar('menú · cerrado con el velo');
      await act(async () => { root.render(React.createElement(MenuLateral, { ...props, foto: 'https://x/foto.jpg' })); });
      await tocar(elMenu(), 'el botón ☰ Menú'); apuntar('menú · abierto, con foto y sin nombre');
      await act(async () => { root.unmount(); });

      // TURISMO.
      win.localStorage.setItem('misReservasGuajira', JSON.stringify(['R1', 'R2', 'R3', 'R4', 'R5', 'NOESTA']));
      const root2 = H.cliente.createRoot(raiz);
      await act(async () => { root2.render(React.createElement(Turismo, { ...props, nombre: 'Ana Pérez', onVolver: nada })); });
      await act(async () => {});
      apuntar('turismo · lista de agencias');
      await tocar(elMenu(), 'el botón ☰ Menú de Turismo'); apuntar('turismo · menú abierto');
      await tocar(elVelo(), 'el velo del menú');
      const buscar = campo('🔎 Buscar agencia o tipo de tour');
      await escribir(buscar, 'playa'); apuntar('turismo · buscar «playa»');
      await escribir(buscar, 'zzz'); apuntar('turismo · buscar «zzz»');
      await escribir(buscar, '');
      await tocar(boton('📋 Mis reservas'), '📋 Mis reservas');
      await act(async () => {});
      apuntar('turismo · mis reservas (una en cada estado)');
      await tocar(volver(), '‹ Volver'); apuntar('turismo · vuelve a la lista');
      await tocar(tarjeta('Playa Mayapo'), 'la agencia Playa Mayapo'); apuntar('turismo · agencia cerrada y sin tours');
      await tocar(volver(), '‹ Volver');
      await tocar(tarjeta('Guajira Tours'), 'la agencia Guajira Tours'); apuntar('turismo · agencia con tours');
      await tocar([...raiz.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Reservar')[1], 'Reservar'); apuntar('turismo · reservar el tour por persona');
      await tocar(boton('+'), '+'); await tocar(boton('+'), '+'); apuntar('turismo · reservar · tres personas');
      await tocar(boton('Enviar reserva'), 'Enviar reserva'); apuntar('turismo · reservar · sin fecha');
      await tocar(boton('Entendido'), 'Entendido');
      await escribir(raiz.querySelector('input[type="date"]'), '2026-10-10');
      await escribir(campo('10 números'), '300 123 4567');
      await escribir(campo('Ej: somos 2 adultos y 1 niño'), 'con niños');
      apuntar('turismo · reservar · lleno');
      base.estado.falla = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
      await tocar(boton('Enviar reserva'), 'Enviar reserva'); apuntar('turismo · reservar · el servidor dice que no');
      base.estado.falla = null;
      await tocar(boton('Entendido'), 'Entendido');
      await tocar(boton('Enviar reserva'), 'Enviar reserva'); apuntar('turismo · reservar · enviada');
      await tocar(volver(), '‹ Volver'); apuntar('turismo · «¡Reserva enviada!» en la lista');
      await tocar(boton('Ver mis reservas'), 'Ver mis reservas');
      await act(async () => {});
      apuntar('turismo · mis reservas después de reservar');
      await tocar(volver(), '‹ Volver');
      await tocar(tarjeta('Guajira Tours'), 'la agencia Guajira Tours');
      await tocar(boton('Reservar'), 'Reservar (el alquiler)'); apuntar('turismo · reservar el alquiler por día');
      await act(async () => { root2.unmount(); });
      return pasos;
    });
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

/** El careo: los pasos de dos recorridos, uno a uno. Devuelve las diferencias en palabras. */
function carear(a, b) {
  const difs = [];
  if (a.length !== b.length) difs.push(`distinto número de pasos: ${a.length} y ${b.length}`);
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    if (a[i].paso !== b[i].paso) difs.push(`paso ${i}: «${a[i].paso}» y «${b[i].paso}»`);
    if (a[i].html !== b[i].html) difs.push(`paso ${i} (${a[i].paso}): el HTML pintado es distinto`);
    if (a[i].estilos !== b[i].estilos) difs.push(`paso ${i} (${a[i].paso}): los estilos que da React son distintos`);
    if (JSON.stringify(a[i].escrituras) !== JSON.stringify(b[i].escrituras)) difs.push(`paso ${i} (${a[i].paso}): lo que escribe es distinto`);
  }
  return difs;
}

const huella = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

async function principal() {
  const hoy = contar();
  const total = Object.values(hoy).reduce((s, n) => s + n, 0);
  const porApp = {};
  for (const [f, n] of Object.entries(hoy)) { const app = f.split('/')[0]; porApp[app] = (porApp[app] || 0) + n; }
  console.log('\n🎨 LA PALETA (G90)\n');
  console.log('1 · COLORES A MANO (sin comentarios, sin theme.js): ' + total + ' en ' + Object.keys(hoy).length + ' archivos');
  for (const [app, n] of Object.entries(porApp)) console.log('     ' + app + ': ' + n);
  if (argumento('--detalle')) for (const [f, n] of Object.entries(hoy)) console.log('       ' + f + ': ' + n);
  const difs = contraPendientes(hoy);
  console.log(difs.length ? difs.map((d) => '   ' + d).join('\n') : '   ✓ ninguno subió de lo que dice PENDIENTES');

  const usan = quienImporta();
  console.log('\n2 · QUIÉN IMPORTA theme.js en la app de transporte: ' + (usan.length ? usan.join(', ') : 'NADIE'));
  const propias = losArchivos().filter((f) => f.startsWith('guajirago/src/') && f !== PALETA)
    .map((f) => [f, paletaPropia(lector(null)(f))]).filter(([, n]) => n.length);
  console.log('   paletas propias (const AZUL = \'#…\') en la app de transporte: ' + (propias.length ? propias.map(([f, n]) => f + ' → ' + n.join(', ')).join(' · ') : 'ninguna'));

  const T = laPaleta();
  const sep = copiaSeparada(T, laCopiaDeAliados());
  console.log('\n3 · LA COPIA DE ALIADOS (' + COPIA_ALIADOS + '): ' + (sep.length ? '🔴 ' + sep.join(' · ') : '✓ dice lo mismo que la paleta en ' + Object.keys(ATADOS).length + ' colores'));

  const ahora = await recorrido(null);
  console.log('\n4 · CÓMO SE VEN (pintado con React): ' + ahora.length + ' pasos · huella ' + huella(ahora.map((p) => p.html + p.estilos).join('\n')));
  if (argumento('--html')) for (const p of ahora) console.log('\n── ' + p.paso + '\n' + p.html + (p.escrituras.length ? '\n   escribe: ' + JSON.stringify(p.escrituras) : ''));
  const a = argumento('--antes');
  if (a) {
    const commit = a === true ? ANTES : a;
    const antes = await recorrido(commit);
    const d = carear(antes, ahora);
    console.log('   careo con ' + commit + ': ' + antes.length + ' pasos · huella ' + huella(antes.map((p) => p.html + p.estilos).join('\n')) + ' · ' + (d.length ? '🔴 ' + d.length + ' distintos\n     ' + d.join('\n     ') : '✓ 0 distintos, el mismo HTML, los mismos estilos y las mismas escrituras paso por paso'));
  }
}

module.exports = { PENDIENTES, PALETA, CARPETAS, ATADOS, COPIA_ALIADOS, ANTES, coloresDe, contar, contraPendientes, quienImporta, paletaPropia, laPaleta, laCopiaDeAliados, copiaSeparada, recorrido, carear, lector, herramientas, cargarModulo };

if (require.main === module) principal().catch((e) => { console.error(e); process.exit(1); });
