#!/usr/bin/env node
/**
 * P12 · ¿UN CLIENTE PUEDE HACER REVENTAR LA REVISIÓN DEL PRECIO DE SU PEDIDO? — SOLO LECTURA
 *
 *   node scripts/medir-revision-venenosa.cjs                    el código de hoy (sin red)
 *   node scripts/medir-revision-venenosa.cjs --commit 31e5291   el código de antes de P12
 *   node scripts/medir-revision-venenosa.cjs --nube             además, lo guardado en PRODUCCIÓN
 *
 * El pendiente (hijo de P11): la revisión del precio (ponerElPrecioDelServidor, guajirago/functions/precioPedido.cjs)
 * arma la ruta del contador de una promoción con el TELÉFONO que manda el cliente, tal cual: `usosPromo/<promo>__<tel>`.
 * Un teléfono con «/» rompe la ruta, la revisión revienta y el pedido se queda con los precios del teléfono (desde P11,
 * al menos marcado «sin revisar»). Lo correcto: que la revisión NUNCA reviente por un dato del cliente.
 *
 * Este guion EJECUTA ponerElPrecioDelServidor (la de hoy o la de un commit) contra una base de mentira que se porta como
 * Firestore en lo que aquí importa —una ruta tiene que nombrar un documento (número par de tramos, ninguno vacío), un
 * nombre no puede ser «.», «..», `__algo__` ni pasar de 1.500 bytes, y un documento no puede pasar de 1 MiB (con la
 * cuenta de tamaño de Firestore)— en pedidos HONRADOS y VENENOSOS, y dice de cada uno: si revienta, el total, los
 * problemas y qué contadores escribe. Los honrados tienen que salir IGUALES antes y después; los venenosos, con el
 * precio del menú (no «sin revisar»).
 * Con --nube cuenta además qué hay guardado: teléfonos de los pedidos, contadores y nombres de promociones.
 * No escribe nada en ningún sitio.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const DIR_FUNCIONES = path.join(RAIZ, 'guajirago', 'functions');

function leerRaiz(commit, rel) {
  if (!commit) return fs.existsSync(path.join(RAIZ, rel)) ? fs.readFileSync(path.join(RAIZ, rel), 'utf8') : null;
  try { return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
}

/** precioPedido.cjs del commit (o del disco, o el texto `fuente`), cargado como módulo de la carpeta de las funciones. */
function piezaDelServidor(commit, fuente) {
  const t = fuente !== undefined ? fuente : leerRaiz(commit, 'guajirago/functions/precioPedido.cjs');
  if (!t) throw new Error('no encontré precioPedido.cjs' + (commit ? ' en ' + commit : ''));
  const archivo = path.join(DIR_FUNCIONES, 'precioPedido.cjs');
  const m = new Module(archivo, null);
  m.filename = archivo;
  m.paths = Module._nodeModulePaths(DIR_FUNCIONES);
  m._compile(t, archivo);
  return m.exports;
}

// ── LO QUE FIRESTORE NO DEJA (lo justo para este guion) ──

const LIMITE_DOCUMENTO = 1048576; // 1 MiB

/** El tamaño de un valor con la cuenta de Firestore (texto = bytes + 1, número 8, mapa = nombre + 1 + valor…). */
function tamano(v) {
  if (v === null || v === undefined) return 1;
  if (typeof v === 'boolean') return 1;
  if (typeof v === 'number') return 8;
  if (typeof v === 'string') return Buffer.byteLength(v, 'utf8') + 1;
  if (Array.isArray(v)) return v.reduce((s, x) => s + tamano(x), 0);
  if (typeof v === 'object') return Object.entries(v).reduce((s, [k, x]) => s + Buffer.byteLength(k, 'utf8') + 1 + tamano(x), 0);
  return 8;
}
const tamanoDocumento = (ruta, campos) => ruta.split('/').reduce((s, t) => s + Buffer.byteLength(t, 'utf8') + 1, 0) + 16 + tamano(campos) + 32;

/** Lo que hace el SDK al armar la referencia: la ruta tiene que nombrar un documento. */
function rutaDeDocumento(ruta) {
  const tramos = ruta.split('/');
  if (tramos.some((t) => t === '')) throw new Error('ruta con un tramo vacío: «' + ruta.slice(0, 80) + '»');
  if (tramos.length % 2 !== 0) throw new Error('«' + ruta.slice(0, 80) + '» no apunta a un documento (número impar de tramos)');
  return ruta;
}
/** Lo que dice el servidor de Firestore al leer o escribir: nombres prohibidos y largos. */
function nombresValidos(ruta) {
  for (const t of ruta.split('/')) {
    if (t === '.' || t === '..' || /^__.*__$/.test(t)) throw new Error('nombre de documento no permitido: «' + t.slice(0, 80) + '»');
    if (Buffer.byteLength(t, 'utf8') > 1500) throw new Error('nombre de documento de más de 1.500 bytes');
  }
}

/** Una base de mentira ESTRICTA: `datos` = { 'coleccion/id': campos }. Apunta lecturas y lo que escribiría. */
function baseEstricta(datos) {
  const registro = { lecturas: [], escrituras: [] };
  const ref = (ruta) => ({ ruta: rutaDeDocumento(ruta) });
  const db = {
    collection: (col) => ({ doc: (id) => ref(col + '/' + id) }),
    runTransaction: async (fn) => {
      const pendientes = [];
      const tx = {
        get: async (r) => {
          nombresValidos(r.ruta);
          registro.lecturas.push(r.ruta);
          const d = datos[r.ruta];
          return { exists: !!d, data: () => d };
        },
        update: (r, campos) => { pendientes.push({ que: 'update', ruta: r.ruta, campos }); },
        set: (r, campos) => { pendientes.push({ que: 'set', ruta: r.ruta, campos }); },
      };
      const valor = await fn(tx);
      // Al confirmar, el servidor revisa cada escritura: si una no vale, NO entra ninguna.
      for (const e of pendientes) {
        nombresValidos(e.ruta);
        const final = e.que === 'update' ? { ...(datos[e.ruta] || {}), ...e.campos } : e.campos;
        if (e.que === 'update' && !datos[e.ruta]) throw new Error('no existe el documento a actualizar');
        const t = tamanoDocumento(e.ruta, final);
        if (t > LIMITE_DOCUMENTO) throw new Error('el documento quedaría de ' + t + ' bytes (máximo ' + LIMITE_DOCUMENTO + ')');
      }
      registro.escrituras.push(...pendientes);
      return valor;
    },
  };
  return { db, registro };
}

// ── LOS CASOS ──

const TEL = '3001112233';
const NEGOCIO = () => ({
  nombre: 'La Cocina de Meche', costoDomicilio: 4000,
  menu: [{ id: 'p1', nombre: 'Sancocho', precio: 18000, disponible: true, adiciones: [{ nombre: 'Queso', precio: 2000 }] }],
  promociones: [
    { id: 'pct', nombre: '20%', tipo: 'porcentaje', valor: 20, activa: true, programacion: 'siempre', platosAplica: [], limiteCliente: 1 },
    { id: 'fijo', nombre: '$1.000 menos', tipo: 'fijo', valor: 1000, activa: true, programacion: 'siempre', platosAplica: [], limiteCliente: 0 },
  ],
});
const linea = (extra) => ({ lineaId: 'l_1', firma: 'p1|', id: 'p1', nombre: 'Sancocho', precio: 18000, cantidad: 1, adiciones: [], ...(extra || {}) });
const PEDIDO = (extra) => ({
  restauranteId: 'R1', clienteId: 'ana', cliente: 'Ana', telefono: TEL, direccion: 'Calle 1', estado: 'nuevo', tipo: 'domicilio',
  items: [linea()], subtotal: 18000, costoDomicilio: 4000, total: 22000, metodoPago: 'efectivo', ...(extra || {}),
});
const muchas = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/**
 * `usos` = contadores ya guardados ({ 'pct__3001112233': 1 }). `honrado`: lo que manda la app de hoy; tiene que
 * salir IGUAL antes y después. Los demás son venenosos: lo que puede mandar una app modificada.
 */
const CASOS = [
  { nombre: 'honrado · 2 sancochos con queso', honrado: true,
    pedido: PEDIDO({ items: [linea({ firma: 'p1|Queso', precio: 20000, cantidad: 2, adiciones: [{ nombre: 'Queso', precio: 2000 }] })], subtotal: 40000, total: 44000 }) },
  { nombre: 'honrado · con la promoción del 20% (tope 1), primera vez', honrado: true,
    pedido: PEDIDO({ items: [linea({ firma: 'p1||ppct', precio: 14400, promoId: 'pct', promoNombre: '20%', precioOriginal: 18000 })], subtotal: 14400, total: 18400 }) },
  { nombre: 'honrado · la del 20% ya usada por este teléfono', honrado: true, usos: { ['pct__' + TEL]: 1 },
    pedido: PEDIDO({ items: [linea({ firma: 'p1||ppct', precio: 14400, promoId: 'pct', promoNombre: '20%', precioOriginal: 18000 })], subtotal: 14400, total: 18400 }) },
  { nombre: 'honrado · la de $1.000 menos (sin tope), dos veces en el pedido', honrado: true, usos: { ['fijo__' + TEL]: 3 },
    pedido: PEDIDO({ items: [linea({ firma: 'p1||pfijo', precio: 17000, cantidad: 2, promoId: 'fijo', promoNombre: '$1.000 menos', precioOriginal: 18000 })], subtotal: 34000, total: 38000 }) },
  { nombre: 'honrado · plato fuera del menú y cantidad 0', honrado: true,
    pedido: PEDIDO({ items: [linea({ id: 'p9', nombre: 'Viejo', precio: 5000 }), linea({ cantidad: 0 })], subtotal: 5000, total: 9000 }) },

  { nombre: 'teléfono «300/111/2233» y la promoción del 20%',
    pedido: PEDIDO({ telefono: '300/111/2233', items: [linea({ precio: 1, promoId: 'pct' })], subtotal: 1, total: 1 }) },
  { nombre: 'teléfono «300/1112233» (una sola barra) y la promoción del 20%',
    pedido: PEDIDO({ telefono: '300/1112233', items: [linea({ precio: 1, promoId: 'pct' })], subtotal: 1, total: 1 }) },
  { nombre: 'teléfono «a/b/c» (la ruta sigue «valiendo») y la promoción del 20%',
    pedido: PEDIDO({ telefono: 'a/b/c', items: [linea({ precio: 1, promoId: 'pct' })], subtotal: 1, total: 1 }) },
  { nombre: 'el MISMO teléfono escrito «+57 300 111 2233», con la del 20% ya usada',
    usos: { ['pct__' + TEL]: 1 },
    pedido: PEDIDO({ telefono: '+57 300 111 2233', items: [linea({ precio: 1, promoId: 'pct' })], subtotal: 1, total: 1 }) },
  { nombre: 'teléfono escrito «+57 300 111 2233», primera vez con la del 20%',
    pedido: PEDIDO({ telefono: '+57 300 111 2233', items: [linea({ precio: 1, promoId: 'pct' })], subtotal: 1, total: 1 }) },
  { nombre: 'teléfono «..» y la promoción de $1.000 menos',
    pedido: PEDIDO({ telefono: '..', items: [linea({ precio: 1, promoId: 'fijo' })], subtotal: 1, total: 1 }) },
  { nombre: 'promoción inventada «a/b»',
    pedido: PEDIDO({ items: [linea({ precio: 1, promoId: 'a/b' })], subtotal: 1, total: 1 }) },
  { nombre: 'promoción inventada «/x»',
    pedido: PEDIDO({ items: [linea({ precio: 1, promoId: '/x' })], subtotal: 1, total: 1 }) },
  { nombre: 'promoción inventada de 2.000 letras',
    pedido: PEDIDO({ items: [linea({ precio: 1, promoId: 'x'.repeat(2000) })], subtotal: 1, total: 1 }) },
  { nombre: '3.000 promociones inventadas distintas (una por línea)',
    pedido: PEDIDO({ items: muchas(3000, (i) => linea({ lineaId: 'l' + i, precio: 1, promoId: 'falsa' + i })), subtotal: 1, total: 1 }) },
  { nombre: '300 líneas con una promoción inventada de 3.000 letras',
    pedido: PEDIDO({ items: muchas(300, (i) => linea({ lineaId: 'l' + i, precio: 1, promoId: 'y'.repeat(3000) })), subtotal: 1, total: 1 }) },
  { nombre: 'cantidad 1e300',
    pedido: PEDIDO({ items: [linea({ precio: 1, cantidad: 1e300 })], subtotal: 1, total: 1 }) },
  { nombre: 'cantidad «2» (texto) y cantidad 2,5',
    pedido: PEDIDO({ items: [linea({ precio: 1, cantidad: '2' }), linea({ precio: 1, cantidad: 2.5 })], subtotal: 1, total: 1 }) },
  { nombre: '30.000 adiciones inventadas en una línea',
    pedido: PEDIDO({ items: [linea({ precio: 1, adiciones: muchas(30000, () => ({ nombre: 'x' })) })], subtotal: 1, total: 1 }) },
  { nombre: '20.000 líneas de un plato que no existe',
    pedido: PEDIDO({ items: muchas(20000, () => ({ id: 'zz' })), subtotal: 1, total: 1 }) },
  { nombre: 'la promoción como mapa y el plato como lista',
    pedido: PEDIDO({ items: [linea({ precio: 1, promoId: { a: 1 } }), linea({ id: ['p1'], precio: 1 })], subtotal: 1, total: 1 }) },
];

const AHORA = new Date('2026-09-30T15:00:00Z');

/** Corre un caso con una pieza: { revienta, motivo, total, subtotal, problemas, contadores, lecturas, items } */
async function correrCaso(pieza, caso) {
  const datos = { 'pedidos/ped1': caso.pedido, 'negocios/R1': NEGOCIO() };
  for (const [id, veces] of Object.entries(caso.usos || {})) datos['usosPromo/' + id] = { veces };
  const { db, registro } = baseEstricta(datos);
  try {
    const p = await pieza.ponerElPrecioDelServidor(db, 'ped1', 'ev1', AHORA);
    const rv = p.revisionServidor || {};
    return {
      revienta: false, estado: rv.estado || null, total: p.total, subtotal: p.subtotal, items: p.items,
      problemas: (rv.problemas || []).length, promos: rv.promos || [],
      contadores: registro.escrituras.filter((e) => e.ruta.startsWith('usosPromo/')).map((e) => e.ruta + '=' + e.campos.veces),
      lecturas: registro.lecturas.length,
    };
  } catch (e) {
    return { revienta: true, motivo: e.message, lecturas: registro.lecturas.length };
  }
}

/** Los casos con la pieza `pieza` (o la del commit / la del disco). */
async function medirCodigo(commit, pieza) {
  const pz = pieza || piezaDelServidor(commit);
  const filas = [];
  for (const caso of CASOS) filas.push({ nombre: caso.nombre, honrado: !!caso.honrado, ...(await correrCaso(pz, caso)) });
  return filas;
}

/** Lo que importa de un resultado para decir si dos son IGUALES (la plata, las líneas y los contadores). */
const huella = (f) => JSON.stringify(f.revienta ? { revienta: true } : { total: f.total, subtotal: f.subtotal, items: f.items, promos: f.promos, contadores: f.contadores, estado: f.estado });

/** Lo guardado en producción: teléfonos de los pedidos, contadores y nombres de promociones que romperían una ruta. */
function contarNube(pedidos, usos, negocios) {
  const diez = /^\d{10}$/;
  const r = { pedidos: pedidos.length, deCliente: 0, telefonoNoDiez: [], conPromo: 0, maxLineas: 0, usosPromo: usos.length, usosRaros: [], promosRaras: [] };
  for (const p of pedidos) {
    // Como el medidor de P09: los de un cliente (firma) y los que nacieron a domicilio antes de la firma.
    if (!p.clienteId && p.tipo !== 'domicilio') continue;
    r.deCliente += 1;
    if (!diez.test(String(p.telefono == null ? '' : p.telefono))) r.telefonoNoDiez.push(p.id + ' «' + String(p.telefono).slice(0, 20) + '»');
    const items = Array.isArray(p.items) ? p.items : [];
    r.maxLineas = Math.max(r.maxLineas, items.length);
    if (items.some((l) => l && l.promoId)) r.conPromo += 1;
  }
  for (const u of usos) if (!/^[^/]{1,200}__\d{10}$/.test(u.id)) r.usosRaros.push(u.id);
  for (const n of negocios) {
    for (const pr of (Array.isArray(n.promociones) ? n.promociones : [])) {
      const id = pr && pr.id;
      if (!((typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id))) && /^[^/]{1,200}$/.test(String(id)))) r.promosRaras.push(n.id + ':' + String(id));
    }
  }
  return r;
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const commit = arg('--commit');
  const filas = await medirCodigo(commit);
  console.log('── EN EL CÓDIGO · servidor ' + (commit || 'hoy') + ' ──');
  for (const f of filas) {
    const que = f.revienta ? '🔴 REVIENTA: ' + f.motivo + ' (el pedido se queda con los precios del teléfono, «sin revisar»)'
      : 'total ' + f.total + ' · ' + f.estado + ' · problemas ' + f.problemas + ' · promos ' + JSON.stringify(f.promos)
        + ' · contadores ' + (f.contadores.length ? f.contadores.map((c) => c.slice(0, 60)).join(', ') : 'ninguno') + ' · lecturas ' + f.lecturas;
    console.log('  ' + (f.honrado ? '(honrado) ' : '') + f.nombre + '\n      ' + que);
  }
  const venenosos = filas.filter((f) => !f.honrado);
  console.log('\n  venenosos: ' + venenosos.length + ' · revientan: ' + venenosos.filter((f) => f.revienta).length
    + ' · honrados que revientan: ' + filas.filter((f) => f.honrado && f.revienta).length);

  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const r = contarNube((await traer('pedidos')).map(doc), (await traer('usosPromo')).map(doc), (await traer('negocios')).map(doc));
    console.log('\n── PRODUCCIÓN (solo lectura) ──');
    console.log('  pedidos: ' + r.pedidos + ' · de clientes (a domicilio): ' + r.deCliente + ' · con promoción: ' + r.conPromo + ' · líneas máx. en un pedido: ' + r.maxLineas);
    console.log('  pedidos de cliente con el teléfono fuera de 10 cifras: ' + r.telefonoNoDiez.length + (r.telefonoNoDiez.length ? ' → ' + r.telefonoNoDiez.join(', ') : ''));
    console.log('  contadores de promoción: ' + r.usosPromo + ' · con un nombre fuera de «<promo>__<10 cifras>»: ' + r.usosRaros.length + (r.usosRaros.length ? ' → ' + r.usosRaros.join(', ') : ''));
    console.log('  promociones de negocios con un nombre que rompería la ruta: ' + r.promosRaras.length + (r.promosRaras.length ? ' → ' + r.promosRaras.join(', ') : ''));
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { CASOS, NEGOCIO, PEDIDO, TEL, AHORA, baseEstricta, tamano, piezaDelServidor, correrCaso, medirCodigo, huella, contarNube };
