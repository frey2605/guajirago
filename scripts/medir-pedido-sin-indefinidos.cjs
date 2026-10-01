#!/usr/bin/env node
/**
 * P14 · ¿LA APP MANDA UN «undefined» AL CREAR EL PEDIDO? — SOLO LECTURA
 *
 *   node scripts/medir-pedido-sin-indefinidos.cjs                   el código de hoy (sin red)
 *   node scripts/medir-pedido-sin-indefinidos.cjs --commit c6bf569  el código de antes de P14
 *   node scripts/medir-pedido-sin-indefinidos.cjs --nube            además, lo guardado en PRODUCCIÓN
 *
 * El hallazgo (de P13, leído y no ejecutado): cuando una promoción con tope ya la usó ESE teléfono, la app (enviarPedido,
 * Restaurantes.js) le quita el descuento a la línea poniéndole `promoId: undefined` (y lo mismo a promoNombre y
 * precioOriginal) y le pide al cliente que vuelva a enviar. Firestore no guarda `undefined`: el segundo envío se
 * rechazaría en el propio teléfono, antes de salir.
 *
 * Aquí NO se lee el código: se EJECUTA. Se saca de Restaurantes.js (el de hoy o el de un commit) el bloque del
 * carrito y del envío —desde `nuevaLineaId` hasta el final de `enviarPedido`— y se corre como lo haría la pantalla,
 * con su candado de verdad (candado.js, el de la LEY DEL BOTÓN) y con la validación de verdad de Firestore: lo que la
 * app le pasa a `addDoc` se le da a la librería `firebase/firestore` de la app (la misma versión que se compila) con
 * `writeBatch().set()`, que revisa los datos igual que `addDoc` y NO escribe nada (el lote nunca se envía).
 *
 * Para cada caso dice: cuántos pedidos salieron, qué ventanita vio el cliente, si quedó algún `undefined` en lo que se
 * mandó (y dónde), si lo que se mandó cabe en la lista cerrada de P13 (las reglas) y en los campos de línea que guarda
 * el servidor, y cuánto cobra el servidor por ese pedido (pedidoConPreciosDelMenu, la calculadora de verdad).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { listasDeLasReglas } = require('./medir-pedido-cerrado.cjs');
const SERVIDOR = require('../guajirago/functions/precioPedido.cjs');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/Restaurantes.js';
const PIEZA = 'guajirago/src/precioPedido.js';
const sinCR = (t) => t.replace(/\r\n/g, '\n');

function leerRaiz(commit, rel) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// ── La validación de verdad de Firestore (la librería de la app) ──
let FS = null;
function firestoreDeVerdad() {
  if (FS) return FS;
  const R = path.join(RAIZ, 'guajirago', 'node_modules');
  const { initializeApp } = require(path.join(R, 'firebase', 'app'));
  const F = require(path.join(R, 'firebase', 'firestore'));
  const app = initializeApp({ projectId: 'demo-p14', apiKey: 'demo', appId: 'demo' }, 'medir-p14-' + process.pid);
  FS = { F, db: F.getFirestore(app) };
  return FS;
}
/** Lo que haría Firestore con estos datos: null si los acepta, o su error (código y mensaje). No escribe nada. */
function loQueDiceFirestore(datos) {
  const { F, db } = firestoreDeVerdad();
  try { F.writeBatch(db).set(F.doc(F.collection(db, 'pedidos')), datos); return null; } catch (e) { return { code: e.code, message: e.message }; }
}

/** Dónde hay un `undefined` dentro de `v` (rutas como «items.0.promoId»). */
function dondeHayIndefinidos(v, ruta = '') {
  if (v === undefined) return [ruta || '(todo)'];
  if (!v || typeof v !== 'object' || v.constructor !== Object && !Array.isArray(v)) return [];
  return Object.entries(v).flatMap(([k, x]) => dondeHayIndefinidos(x, ruta ? ruta + '.' + k : k));
}

// ── El negocio de mentira ──
const NEGOCIO = {
  id: 'neg1', nombre: 'Restaurante de Mentira', abierto: true, costoDomicilio: 4000,
  menu: [
    { id: 'p1', nombre: 'Sancocho', precio: 18000, disponible: true },
    { id: 'p2', nombre: 'Jugo', precio: 6000, disponible: true, adiciones: [{ nombre: 'Hielo', precio: 0 }, { nombre: 'Leche', precio: 1500 }] },
    { id: 'p3', nombre: 'Agua', precio: 3000, disponible: true },
  ],
  promociones: [
    // Una vez por cliente: la del hallazgo.
    { id: 'tope1', nombre: '20% en sancocho', tipo: 'porcentaje', valor: 20, activa: true, programacion: 'siempre', limiteCliente: 1, platosAplica: [{ id: 'p1', nombre: 'Sancocho' }] },
    // Sin tope.
    { id: 'libre', nombre: '$1.000 menos en jugo', tipo: 'fijo', valor: 1000, activa: true, programacion: 'siempre', platosAplica: [{ id: 'p2', nombre: 'Jugo' }] },
  ],
};
const plato = (id) => NEGOCIO.menu.find((p) => p.id === id);
const TELEFONO = '300 140 0140';
const TEL10 = '3001400140';

/**
 * Los casos. `lineas`: [idDelPlato, adiciones, cantidad]. `usosTelefono`: el contador de la base (usosPromo) de ESE
 * teléfono; `usosAparato`: lo que recuerda ESTE teléfono (localStorage). `envios`: cuántas veces toca «Pedir».
 */
const CASOS = [
  { caso: 'honrado sin promoción (2 aguas)', lineas: [['p3', [], 2]], envios: 1 },
  { caso: 'honrado con la promoción de tope 1, primera vez', lineas: [['p1', [], 1], ['p3', [], 1]], envios: 1 },
  { caso: 'honrado con promoción sin tope y adiciones', lineas: [['p2', [{ nombre: 'Leche', precio: 1500 }], 2]], envios: 1 },
  {
    caso: 'PROMO AGOTADA: el teléfono ya la usó (en otro aparato) y el cliente vuelve a enviar',
    lineas: [['p1', [], 1], ['p3', [], 1]], usosTelefono: { tope1: 1 }, envios: 2, agotada: true,
  },
  {
    caso: 'PROMO AGOTADA con dos promociones: solo se quita la agotada',
    lineas: [['p1', [], 1], ['p2', [], 1]], usosTelefono: { tope1: 1 }, envios: 2, agotada: true,
  },
];

/** La pantalla sacada de Restaurantes.js y ejecutada: devuelve un «aparato» con su estado y sus dos acciones. */
function pantallaDe(fuente, pieza) {
  const f = sinCR(fuente);
  const a = f.indexOf('  const nuevaLineaId = ');
  const b = f.indexOf('  // ---------- Cancelar mi pedido');
  if (a < 0 || b < a) throw new Error('no está el bloque del carrito y del envío en ' + PANTALLA);
  const bloque = f.slice(a, b);
  // eslint-disable-next-line no-new-func
  const hacer = new Function('ambito', 'with (ambito) {' + bloque + '\nreturn { agregarLinea, enviarPedido }; }');
  const { crearCandado } = cargarDeLaApp('guajirago/src/candado.js');
  const { celularDiezCifras } = cargarDeLaApp('guajirago/src/telefonoValido.js');

  return function aparato({ usosTelefono = {}, usosAparato = {} } = {}) {
    const estado = {
      carrito: [], usosPromo: { ...usosAparato }, telefono: TELEFONO, direccion: 'Calle 1 #2-3', metodoPago: 'Efectivo',
      avisoPromo: '', avisoPago: '', pantalla: 'menu', pedidoId: null,
    };
    const mandados = []; // lo que la app le pasó a addDoc
    const avisos = []; // las ventanitas del candado
    const candado = crearCandado({ alAviso: (x) => avisos.push(x), tope: 60000 });
    const poner = (k) => (v) => { estado[k] = typeof v === 'function' ? v(estado[k]) : v; };
    const ambito = {
      ...pieza, celularDiezCifras,
      restauranteActivo: NEGOCIO, nombre: 'Ana',
      platoConfig: null, adicionesSel: [], setPlatoConfig: () => {}, setAdicionesSel: () => {}, setCantidadConfig: () => {},
      setCarrito: poner('carrito'), setUsosPromo: poner('usosPromo'), setAvisoPromo: poner('avisoPromo'), setAvisoPago: poner('avisoPago'),
      setDireccion: poner('direccion'), setTelefono: poner('telefono'), setMetodoPago: poner('metodoPago'),
      setPedidoId: poner('pedidoId'), setPantalla: poner('pantalla'), setNumeroPedido: () => {},
      correr: (fn, cual, exito, accion) => candado.correr(fn, cual, exito, accion),
      db: {}, auth: { currentUser: { uid: 'cliente-ana' } },
      collection: (_db, nombre) => ({ coleccion: nombre }),
      doc: (_db, coleccion, id) => ({ coleccion, id }),
      getDoc: async (ref) => {
        const veces = ref.coleccion === 'usosPromo' && ref.id.endsWith('__' + TEL10) ? usosTelefono[ref.id.split('__')[0]] : undefined;
        return { exists: () => veces != null, data: () => ({ veces }) };
      },
      addDoc: async (_col, datos) => {
        mandados.push(datos);
        const no = loQueDiceFirestore(datos);
        if (no) { const e = new Error(no.message); e.code = no.code; throw e; }
        return { id: 'pedido' + mandados.length };
      },
      serverTimestamp: () => firestoreDeVerdad().F.serverTimestamp(),
      prepararTokenDeAvisos: () => () => {}, numeroDelPedido: (id) => id, recordar: () => {}, MIS_PEDIDOS: 'misPedidos',
      localStorage: { setItem: () => {}, getItem: () => null },
    };
    // Cada «render» vuelve a crear las funciones con el estado de ahora, como React.
    const render = () => hacer({ ...ambito, ...estado });
    return {
      estado, mandados, avisos,
      agregar: (id, ad, n) => render().agregarLinea(plato(id), ad, n),
      pedir: () => render().enviarPedido(),
    };
  };
}

/** Lo que el servidor guarda de cada línea (pedidoConPreciosDelMenu), más lo de la promoción. */
const CAMPOS_LINEA = ['lineaId', 'firma', 'id', 'nombre', 'precio', 'cantidad', 'adiciones', 'promoId', 'promoNombre', 'precioOriginal'];

async function correrCaso(aparatoDe, c, crear) {
  const ap = aparatoDe({ usosTelefono: c.usosTelefono, usosAparato: c.usosAparato });
  for (const [id, ad, n] of c.lineas) ap.agregar(id, ad, n);
  const pasos = [];
  for (let i = 0; i < c.envios; i++) {
    const antes = ap.mandados.length;
    // eslint-disable-next-line no-await-in-loop
    await ap.pedir();
    pasos.push({
      envio: i + 1, mando: ap.mandados.length > antes, aviso: ap.avisos[ap.avisos.length - 1] || null, avisoPromo: ap.estado.avisoPromo,
      carritoConIndefinidos: dondeHayIndefinidos(ap.estado.carrito),
    });
    if (ap.estado.pantalla === 'seguimiento') break;
  }
  const ultimo = ap.mandados[ap.mandados.length - 1] || null;
  const entro = ap.estado.pantalla === 'seguimiento';
  const enLaLinea = ultimo ? ultimo.items.flatMap((l) => Object.keys(l).filter((k) => !CAMPOS_LINEA.includes(k))) : [];
  const fueraDeP13 = ultimo ? Object.keys(ultimo).filter((k) => !crear.includes(k)) : [];
  const usos = (id) => (c.usosTelefono || {})[id] || 0;
  const servidor = entro ? SERVIDOR.pedidoConPreciosDelMenu(NEGOCIO, ultimo.items, usos, new Date()) : null;
  return {
    caso: c.caso, agotada: !!c.agotada, entro, pasos, pedido: entro ? ultimo : null,
    indefinidosMandados: ultimo ? dondeHayIndefinidos(ultimo) : [],
    fueraDeP13, enLaLinea,
    subtotalApp: entro ? ultimo.subtotal : null,
    subtotalServidor: servidor ? servidor.subtotal : null,
    promosServidor: servidor ? servidor.promos : null,
    problemasServidor: servidor ? servidor.problemas.map((p) => p.codigo) : null,
  };
}

/** Corre todos los casos con el código de hoy (commit null) o el de un commit. */
async function medirApp(commit) {
  const pieza = cargarDeLaApp(PIEZA, leerRaiz(commit, PIEZA));
  const aparatoDe = pantallaDe(leerRaiz(commit, PANTALLA), pieza);
  const { crear } = listasDeLasReglas(leerRaiz(null, 'firestore.rules'));
  const filas = [];
  // eslint-disable-next-line no-await-in-loop
  for (const c of CASOS) filas.push(await correrCaso(aparatoDe, c, crear));
  return filas;
}

/** Producción (solo lectura): ¿hay datos que harían que la app mandara un undefined o que activan el caso? */
function contarNube(negocios, usosPromo, pedidos) {
  const r = { negocios: negocios.length, sinNombre: [], platosSinNombre: [], promosSinNombre: [], promosConTope: [], usosPromo: usosPromo.length, pedidosConPromo: 0, lineasConPromoVacia: 0 };
  for (const n of negocios) {
    if (typeof n.nombre !== 'string') r.sinNombre.push(n.id);
    for (const p of n.menu || []) if (p && typeof p.nombre !== 'string') r.platosSinNombre.push(n.id + '/' + p.id);
    for (const p of n.promociones || []) {
      if (p && typeof p.nombre !== 'string') r.promosSinNombre.push(n.id + '/' + p.id);
      if (p && p.limiteCliente > 0) r.promosConTope.push(n.id + '/' + p.id + ' (tope ' + p.limiteCliente + (p.activa ? ', encendida' : ', apagada') + ')');
    }
  }
  for (const p of pedidos) {
    const items = Array.isArray(p.items) ? p.items : [];
    if (items.some((l) => l && l.promoId)) r.pedidosConPromo++;
    r.lineasConPromoVacia += items.filter((l) => l && ('promoId' in l) && !l.promoId).length;
  }
  return r;
}

function imprimir(titulo, filas) {
  console.log('\n── ' + titulo + ' ──');
  for (const f of filas) {
    console.log('\n  · ' + f.caso);
    for (const p of f.pasos) {
      console.log('      envío ' + p.envio + ': ' + (p.mando ? 'la app llamó a addDoc' : 'no llamó a addDoc')
        + (p.avisoPromo ? ' · aviso de la promoción: «' + p.avisoPromo.slice(0, 60) + '…»' : '')
        + (p.aviso ? ' · ventanita: ' + p.aviso.icono + ' «' + p.aviso.titulo + '» ' + p.aviso.texto : '')
        + (p.carritoConIndefinidos.length ? ' · carrito con undefined en ' + p.carritoConIndefinidos.join(', ') : ''));
    }
    console.log('      ' + (f.entro ? '✓ el pedido ENTRÓ' : '✗ el pedido NO entró')
      + (f.indefinidosMandados.length ? ' · 🔴 mandó undefined en ' + f.indefinidosMandados.join(', ') : '')
      + (f.fueraDeP13.length ? ' · 🔴 fuera de la lista de P13: ' + f.fueraDeP13.join(', ') : '')
      + (f.enLaLinea.length ? ' · 🔴 campos de línea desconocidos: ' + f.enLaLinea.join(', ') : ''));
    if (f.entro) {
      console.log('      la app enseñó subtotal ' + f.subtotalApp + ' · el servidor cobra ' + f.subtotalServidor
        + ' · promociones aplicadas por el servidor: ' + (f.promosServidor.join(', ') || 'ninguna')
        + (f.problemasServidor.length ? ' · problemas: ' + f.problemasServidor.join(', ') : ''));
    }
  }
  const atascados = filas.filter((f) => f.agotada && !f.entro).length;
  const conIndef = filas.filter((f) => f.indefinidosMandados.length).length;
  const distintos = filas.filter((f) => f.entro && f.subtotalApp !== f.subtotalServidor).length;
  console.log('\n  promo agotada que NO deja pedir: ' + atascados + ' de ' + filas.filter((f) => f.agotada).length
    + ' · casos que mandan undefined: ' + conIndef + ' de ' + filas.length
    + ' · casos donde la app enseña un subtotal distinto al del servidor: ' + distintos);
  return { atascados, conIndef, distintos };
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const filas = await medirApp(commit);
  imprimir('LA APP ' + (commit ? 'DEL COMMIT ' + commit : 'DE HOY'), filas);
  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const r = contarNube((await traer('negocios')).map(doc), (await traer('usosPromo')).map(doc), (await traer('pedidos')).map(doc));
    console.log('\n── PRODUCCIÓN (solo lectura) ──');
    console.log('  negocios: ' + r.negocios + ' · sin nombre: ' + r.sinNombre.length + ' · platos sin nombre: ' + r.platosSinNombre.length
      + ' · promociones sin nombre: ' + r.promosSinNombre.length);
    console.log('  promociones con tope por cliente: ' + r.promosConTope.length + (r.promosConTope.length ? ' → ' + r.promosConTope.join(' · ') : ''));
    console.log('  contadores usosPromo: ' + r.usosPromo + ' · pedidos con promoción: ' + r.pedidosConPromo + ' · líneas con promoId vacío: ' + r.lineasConPromoVacia);
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { medirApp, pantallaDe, correrCaso, dondeHayIndefinidos, loQueDiceFirestore, contarNube, CASOS, NEGOCIO, CAMPOS_LINEA };
