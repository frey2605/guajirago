#!/usr/bin/env node
/**
 * P10 · ¿CUÁNTO COBRA DE DOMICILIO CADA NEGOCIO? — SOLO LECTURA
 *
 *   node scripts/medir-costo-domicilio.cjs                         el código de hoy (sin red, con negocios de ejemplo)
 *   node scripts/medir-costo-domicilio.cjs --commit c0f8ee5 --commit-aliados caedbdb
 *                                                                  el código de esos commits (el de antes de P10)
 *   node scripts/medir-costo-domicilio.cjs --nube                  además, los negocios de PRODUCCIÓN
 *
 * El pendiente (hijo de P09): 2 de los 3 negocios de producción guardan su domicilio en `costoEnvio` —el nombre viejo,
 * de antes del 6-jul-2026, cuando aliados lo llamó `costoDomicilio`— y nadie leía ese nombre, así que su domicilio
 * salía en $0 al pedir. Este guion cuenta:
 *   1. EN EL CÓDIGO (las tres apps y las funciones): quién nombra `costoEnvio` o `costoDomicilio` de un NEGOCIO, y si
 *      lo lee directo o a través de la pieza única `costoDomicilioDelNegocio`; y quién ESCRIBE `costoEnvio`.
 *   2. LO QUE PASA CON CADA NEGOCIO, EJECUTANDO el código (el de hoy o el de los commits):
 *        · servidor  → lo que `ponerElPrecioDelServidor` (P09) le pone de domicilio a un pedido nuevo, con la nube de
 *                      mentira;
 *        · app       → el `costoDom` del carrito, sacado de guajirago/src/Restaurantes.js;
 *        · confirmar → el domicilio que aliados propone al confirmar el pedido (PedidosDomicilio.js);
 *        · perfil    → lo que el perfil de aliados enseña en «costo del domicilio» (PerfilRestaurante.js).
 * No escribe nada en ningún sitio.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const NUBE = require('../pruebas/nubeDeMentira.cjs');

const RAIZ = path.resolve(__dirname, '..');
const DIR_FUNCIONES = path.join(RAIZ, 'guajirago', 'functions');
const CARPETAS = ['guajirago/src', 'guajirago/functions', 'guajirago-admin/src', 'guajirago-aliados/src'];
const MARCA_A = '// ── EL DOMICILIO DEL NEGOCIO';
const MARCA_B = '// ── FIN DEL DOMICILIO DEL NEGOCIO ──';

// ── Leer el código: del disco o de un commit (el raíz con --commit, aliados con --commit-aliados) ──
function repoDe(rel) {
  if (rel.startsWith('guajirago-aliados/')) return { cwd: path.join(RAIZ, 'guajirago-aliados'), rel: rel.slice('guajirago-aliados/'.length) };
  if (rel.startsWith('guajirago-admin/')) return { cwd: path.join(RAIZ, 'guajirago-admin'), rel: rel.slice('guajirago-admin/'.length) };
  return { cwd: RAIZ, rel };
}
function lector(commits) {
  const refDe = (rel) => (rel.startsWith('guajirago-aliados/') ? commits.aliados : rel.startsWith('guajirago-admin/') ? null : commits.raiz);
  return (rel) => {
    const ref = refDe(rel);
    if (ref) {
      const r = repoDe(rel);
      try { return execFileSync('git', ['show', ref + ':' + r.rel], { cwd: r.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
    }
    const abs = path.join(RAIZ, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };
}
function archivosDe(dir) {
  const fuera = [];
  if (!fs.existsSync(dir)) return fuera;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'build' || e.name === 'lib') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuera.push(...archivosDe(p));
    else if (/\.(c?js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) fuera.push(p);
  }
  return fuera;
}
function listaDeArchivos(commits) {
  const lista = [];
  for (const c of CARPETAS) {
    const ref = c.startsWith('guajirago-aliados/') ? commits.aliados : c.startsWith('guajirago-admin/') ? null : commits.raiz;
    if (ref) {
      const r = repoDe(c);
      const salida = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, r.rel], { cwd: r.cwd, encoding: 'utf8' });
      const prefijo = r.cwd === RAIZ ? '' : path.basename(r.cwd) + '/';
      lista.push(...salida.split('\n').filter((x) => /\.(c?js|jsx)$/.test(x) && !/\.test\./.test(x) && !/node_modules\//.test(x)).map((x) => prefijo + x));
    } else {
      lista.push(...archivosDe(path.join(RAIZ, c)).map((a) => path.relative(RAIZ, a).replace(/\\/g, '/')));
    }
  }
  return lista;
}

/** El texto sin el trozo de la pieza (entre sus marcas): lo que la pieza lee por dentro no es un lector suelto. */
function sinLaPieza(texto) {
  const t = texto.replace(/\r\n/g, '\n');
  const a = t.indexOf(MARCA_A);
  const b = t.indexOf(MARCA_B);
  // Se cambia por renglones vacíos, para que los números de renglón que da el informe sigan siendo los del archivo.
  return a >= 0 && b > a ? t.slice(0, a) + t.slice(a, b).replace(/[^\n]/g, '') + t.slice(b) : t;
}
const esComentario = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

/**
 * Función pura sobre { archivo: texto }. Devuelve los sitios (archivo:renglón) que:
 *   · leenDirecto    — leen `costoDomicilio` o `costoEnvio` de un NEGOCIO a pelo (negocio., restauranteActivo., d.,
 *                      snap.data().), fuera de la pieza;
 *   · porLaPieza     — llaman a `costoDomicilioDelNegocio(…)`;
 *   · escribenEnvio  — escriben `costoEnvio:` (nadie debería).
 */
function sitiosDelCodigo(textos) {
  const r = { leenDirecto: [], porLaPieza: [], escribenEnvio: [] };
  for (const [archivo, texto] of Object.entries(textos)) {
    if (!texto) continue;
    sinLaPieza(texto).split('\n').forEach((l, i) => {
      if (esComentario(l)) return;
      const sitio = archivo + ':' + (i + 1);
      // Un renglón que pasa por la pieza cuenta como de la pieza (el perfil solo mira si hay ALGÚN valor guardado).
      const porLaPieza = /(?<!function )\bcostoDomicilioDelNegocio\(/.test(l);
      if (porLaPieza) r.porLaPieza.push(sitio);
      else if (/\b(negocio|restauranteActivo|d|snap\.data\(\))\.(costoDomicilio|costoEnvio)\b/.test(l)) r.leenDirecto.push(sitio);
      if (/\bcostoEnvio\s*:/.test(l)) r.escribenEnvio.push(sitio);
    });
  }
  return r;
}

// ── Cargar la pieza del servidor del disco o de un commit (con sus ./*.cjs del MISMO commit) ──
function piezaDelServidor(ref) {
  if (!ref) return require('../guajirago/functions/precioPedido.cjs');
  const hechos = {};
  const original = Module._load;
  const cargar = (nombre, padre) => {
    if (!hechos[nombre]) {
      const archivo = path.join(DIR_FUNCIONES, nombre);
      const m = new Module(archivo, padre);
      m.filename = archivo;
      m.paths = Module._nodeModulePaths(DIR_FUNCIONES);
      m._compile(execFileSync('git', ['show', ref + ':guajirago/functions/' + nombre], { cwd: RAIZ, encoding: 'utf8' }), archivo);
      hechos[nombre] = m.exports;
    }
    return hechos[nombre];
  };
  Module._load = function (pedido, padre, ...resto) {
    if (/^\.\/[\w-]+\.cjs$/.test(pedido) && padre && path.dirname(padre.filename) === DIR_FUNCIONES) return cargar(pedido.slice(2), padre);
    return original.call(this, pedido, padre, ...resto);
  };
  try { return cargar('precioPedido.cjs', module); } finally { Module._load = original; }
}

/** Saca del texto UNA expresión con su patrón y la deja lista para correr; si no está, lo dice (null). */
function expresion(texto, patron) {
  const m = (texto || '').replace(/\r\n/g, '\n').match(patron);
  return m ? m[1] : null;
}

/**
 * Las cuatro miradas del código (el de hoy o el de los commits), listas para correr con un negocio.
 * Lo que no se encuentra en el archivo queda en null y el informe lo dice, en vez de inventarse un valor.
 */
function lasMiradas(commits) {
  const leer = lector(commits);
  const servidor = piezaDelServidor(commits.raiz);
  const appPieza = (() => {
    const t = leer('guajirago/src/precioPedido.js');
    return t ? cargarDeLaApp('guajirago/src/precioPedido.js', t) : {};
  })();
  const aliadosPieza = (() => {
    const t = leer('guajirago-aliados/src/costoDomicilio.js');
    return t ? cargarDeLaApp('guajirago-aliados/src/costoDomicilio.js', t) : {};
  })();
  const fn = (args, cuerpo, ...valores) => (cuerpo ? new Function(...args, cuerpo)(...valores) : null); // eslint-disable-line no-new-func

  const app = expresion(leer('guajirago/src/Restaurantes.js'), /const costoDom = ([^;\n]+);/);
  const confirmar = expresion(leer('guajirago-aliados/src/PedidosDomicilio.js'), /setCostoDomDefault\(((?:[^()]|\([^()]*(?:\([^()]*\))?[^()]*\))+)\)/);
  const perfil = expresion(leer('guajirago-aliados/src/PerfilRestaurante.js'), /\n\s*(if \([^\n]*\) setCostoDomicilio\([^\n]*\);)/);

  return {
    textos: { app, confirmar, perfil },
    servidor: async (negocio) => {
      const plato = ((negocio && negocio.menu) || []).find((p) => p && p.id);
      const pedido = {
        restauranteId: 'N', clienteId: 'u1', telefono: '3001112233', estado: 'nuevo', tipo: 'domicilio',
        items: plato ? [{ id: plato.id, nombre: plato.nombre, precio: plato.precio, cantidad: 1 }] : [],
        subtotal: 0, costoDomicilio: 0, total: 0,
      };
      const escrituras = [];
      const db = NUBE.baseDeMentira({ pedidos: { p1: pedido }, negocios: { N: negocio }, usosPromo: {} }, escrituras);
      await servidor.ponerElPrecioDelServidor(db, 'p1', 'ev-medir', new Date());
      const up = escrituras.find((e) => e.ruta === 'pedidos/p1');
      return up ? up.campos.costoDomicilio : null;
    },
    app: (negocio) => fn(['restauranteActivo', 'costoDomicilioDelNegocio'], app && 'return (' + app + ');', negocio, appPieza.costoDomicilioDelNegocio),
    confirmar: (negocio) => fn(['snap', 'costoDomicilioDelNegocio'], confirmar && 'return (' + confirmar + ');', { data: () => negocio }, aliadosPieza.costoDomicilioDelNegocio),
    perfil: (negocio) => fn(['d', 'costoDomicilioDelNegocio'], perfil && 'let v = ""; const setCostoDomicilio = (x) => { v = x; }; ' + perfil + ' return v;',
      negocio, aliadosPieza.costoDomicilioDelNegocio),
  };
}

/** Lo que pasa con cada negocio ({id, nombre, costoDomicilio, costoEnvio, …}) con estas miradas. */
async function cadaNegocio(negocios, miradas) {
  const fuera = [];
  for (const n of negocios) {
    // eslint-disable-next-line no-await-in-loop
    fuera.push({ id: n.id, nombre: n.nombre, costoDomicilio: n.costoDomicilio, costoEnvio: n.costoEnvio,
      servidor: await miradas.servidor(n), app: miradas.app(n), confirmar: miradas.confirmar(n), perfil: miradas.perfil(n) });
  }
  return fuera;
}

const EJEMPLOS = [
  { id: 'con-domicilio', nombre: 'con costoDomicilio 4000', costoDomicilio: 4000, menu: [{ id: 'p1', nombre: 'Sancocho', precio: 18000 }] },
  { id: 'solo-envio', nombre: 'solo costoEnvio 5200', costoEnvio: 5200, menu: [{ id: 'p1', nombre: 'Sancocho', precio: 18000 }] },
  { id: 'los-dos', nombre: 'costoDomicilio 3000 y costoEnvio 5000', costoDomicilio: 3000, costoEnvio: 5000, menu: [] },
  { id: 'gratis', nombre: 'costoDomicilio 0 y costoEnvio 5000', costoDomicilio: 0, costoEnvio: 5000, menu: [] },
  { id: 'ninguno', nombre: 'sin ninguno', menu: [] },
];

function pintar(filas) {
  for (const f of filas) {
    console.log('  · ' + f.nombre + ' (' + f.id + ')  guardado: costoDomicilio=' + f.costoDomicilio + ' costoEnvio=' + f.costoEnvio);
    console.log('      servidor cobra ' + f.servidor + ' · app enseña ' + f.app + ' · aliados propone al confirmar ' + f.confirmar
      + ' · perfil enseña «' + f.perfil + '»');
  }
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const commits = { raiz: arg('--commit'), aliados: arg('--commit-aliados') };
  const de = commits.raiz || commits.aliados ? ' (raíz ' + (commits.raiz || 'hoy') + ', aliados ' + (commits.aliados || 'hoy') + ')' : ' (hoy)';
  const leer = lector(commits);
  const textos = {};
  for (const a of listaDeArchivos(commits)) textos[a] = leer(a);
  const s = sitiosDelCodigo(textos);
  console.log('── 1. EN EL CÓDIGO' + de + ' ──');
  console.log('  leen el domicilio del negocio A PELO: ' + s.leenDirecto.length);
  for (const x of s.leenDirecto) console.log('    · ' + x);
  console.log('  lo leen por la pieza costoDomicilioDelNegocio: ' + s.porLaPieza.length);
  for (const x of s.porLaPieza) console.log('    · ' + x);
  console.log('  escriben costoEnvio: ' + (s.escribenEnvio.length ? s.escribenEnvio.join(', ') : 'nadie'));

  const miradas = lasMiradas(commits);
  for (const [k, v] of Object.entries(miradas.textos)) if (!v) console.log('  ⚠ no encontré en el código la mirada «' + k + '»');
  console.log('\n── 2. NEGOCIOS DE EJEMPLO, ejecutando el código ──');
  pintar(await cadaNegocio(EJEMPLOS, miradas));

  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const negocios = (await traer('negocios')).map(doc);
    console.log('\n── 3. PRODUCCIÓN (solo lectura): ' + negocios.length + ' negocios ──');
    const filas = await cadaNegocio(negocios, miradas);
    pintar(filas);
    const soloEnvio = negocios.filter((n) => n.costoDomicilio == null && n.costoEnvio != null).length;
    const enCero = filas.filter((f) => f.costoEnvio != null && f.costoDomicilio == null && f.servidor === 0).length;
    console.log('  negocios solo con el nombre viejo (costoEnvio): ' + soloEnvio + ' · de ellos, el servidor les cobra $0 de domicilio: ' + enCero);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { sitiosDelCodigo, lasMiradas, cadaNegocio, EJEMPLOS, sinLaPieza };
