#!/usr/bin/env node
/**
 * P13 · ¿UN CLIENTE PUEDE LLENAR SU PEDIDO HASTA DEJAR AL SERVIDOR SIN SITIO? — SOLO LECTURA
 *
 *   node scripts/medir-pedido-cerrado.cjs                    el código de hoy (sin red)
 *   node scripts/medir-pedido-cerrado.cjs --commit c61de14   el código de antes de P13
 *   node scripts/medir-pedido-cerrado.cjs --nube             además, lo guardado en PRODUCCIÓN
 *   node scripts/medir-pedido-cerrado.cjs --publicado        además, el paquete PUBLICADO de la app (guajirago.web.app)
 *
 * El pendiente (hijo de P12): el cliente crea su pedido con lo que quiera dentro —un campo de sobra, un texto enorme—
 * hasta casi 1 MiB (el máximo de un documento). Entonces la revisión del precio (ponerElPrecioDelServidor,
 * guajirago/functions/precioPedido.cjs) no cabe para escribir el precio, y la marca de «sin revisar» (P11) tampoco:
 * el pedido se queda con la plata del teléfono y aliados solo lo sabe pasados 2 minutos.
 *
 * Mide tres cosas, sin escribir nada en ningún sitio:
 *   1. QUÉ ESCRIBE LA APP en `pedidos` (Restaurantes.js, o el paquete publicado con --publicado): los campos al crear,
 *      los que cambia después, los del mensaje del chat y el token de avisos. Y si las reglas (firestore.rules, el
 *      bloque de `pedidos`) los dejan TODOS: una lista cerrada a la que le falte uno rompe la app en silencio.
 *   2. LA REVISIÓN DEL SERVIDOR con pedidos LLENOS (la de hoy o la de un commit), contra la base estricta del medidor
 *      de P12 (rutas, nombres y el tamaño de un documento como Firestore): si revienta o si queda revisada.
 *   3. Con --nube: los 29 pedidos de producción —campos, tamaño del más grande, líneas, mensajes— y si alguno de
 *      cliente se sale de la lista o de los topes.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { baseEstricta, tamano, piezaDelServidor, NEGOCIO, PEDIDO, AHORA } = require('./medir-revision-venenosa.cjs');

const RAIZ = path.resolve(__dirname, '..');
const LIMITE_DOCUMENTO = 1048576;

function leerRaiz(commit, rel) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

// ── 1. LO QUE ESCRIBE LA APP ──

/** Desde `i` (un «{»), dónde se cierra, saltando textos y comentarios. */
function cierreDe(t, i) {
  let prof = 0;
  for (let k = i; k < t.length; k++) {
    const c = t[k];
    if (c === '"' || c === "'" || c === '`') {
      for (k++; k < t.length && t[k] !== c; k++) if (t[k] === '\\') k++;
    } else if (c === '/' && t[k + 1] === '/') {
      while (k < t.length && t[k] !== '\n') k++;
    } else if (c === '/' && t[k + 1] === '*') {
      k = t.indexOf('*/', k + 2) + 1;
    } else if (c === '{' || c === '(' || c === '[') prof++;
    else if (c === '}' || c === ')' || c === ']') { prof--; if (prof === 0) return k; }
  }
  return -1;
}

/** Las claves de primer nivel de un objeto literal `t.slice(i, fin+1)`; las expansiones («...x») salen como «...x». */
function clavesDelObjeto(t, i) {
  const fin = cierreDe(t, i);
  const claves = [];
  const anidados = {};
  let prof = 0;
  let k = i + 1;
  let inicioDeEntrada = true;
  for (; k < fin; k++) {
    const c = t[k];
    if (c === '"' || c === "'" || c === '`') {
      const ini = k;
      for (k++; k < fin && t[k] !== c; k++) if (t[k] === '\\') k++;
      if (prof === 0 && inicioDeEntrada && /^\s*:/.test(t.slice(k + 1))) { claves.push(t.slice(ini + 1, k)); inicioDeEntrada = false; }
      continue;
    }
    if (c === '/' && t[k + 1] === '/') { while (k < fin && t[k] !== '\n') k++; continue; }
    if (c === '/' && t[k + 1] === '*') { k = t.indexOf('*/', k + 2) + 1; continue; }
    if (c === '{' || c === '(' || c === '[') {
      // El primer objeto dentro del valor de una clave (p. ej. el mensaje de `mensajesPedido: arrayUnion({ … })`).
      if (c === '{' && claves.length && anidados[claves[claves.length - 1]] === undefined) anidados[claves[claves.length - 1]] = k;
      prof++; continue;
    }
    if (c === '}' || c === ')' || c === ']') { prof--; continue; }
    if (prof !== 0) continue;
    if (c === ',') { inicioDeEntrada = true; continue; }
    if (inicioDeEntrada && /\s/.test(c)) continue;
    if (inicioDeEntrada) {
      const m = /^(\.\.\.[\w$.]+|[\w$]+)\s*:?/.exec(t.slice(k, k + 200));
      if (m) { claves.push(m[1]); k += m[0].length - 1; }
      inicioDeEntrada = false;
    }
  }
  const dentro = {};
  for (const [clave, pos] of Object.entries(anidados)) dentro[clave] = clavesDelObjeto(t, pos).claves;
  return { claves, dentro };
}

/**
 * Las escrituras a `pedidos` de un archivo de la app (el fuente o el paquete minificado): { crear: [claves...],
 * cambiar: [[claves...], ...], mensaje: [claves del mensaje del chat], token: ['clienteFcmToken'...] }.
 * Se reconoce `…'pedidos'), {` (crear: collection) y `…'pedidos', id), {` (cambiar: doc). Las lecturas no llevan `{`.
 */
function escriturasDeLaApp(t) {
  const r = { crear: [], cambiar: [], mensaje: [], token: [] };
  const re = /(['"])pedidos\1(\s*,\s*[\w$.]+)?\s*\)\s*,\s*\{/g;
  let m;
  while ((m = re.exec(t))) {
    const llave = m.index + m[0].length - 1;
    const { claves, dentro } = clavesDelObjeto(t, llave);
    if (m[2]) r.cambiar.push(claves); else r.crear.push(...claves);
    if (dentro.mensajesPedido) r.mensaje.push(...dentro.mensajesPedido);
    // El token de avisos se pega después con prepararTokenDeAvisos('<campo>') (G34): se nombra justo antes de crear.
    const antes = t.slice(Math.max(0, m.index - 300), m.index);
    for (const x of antes.matchAll(/[\w$]+\(\s*['"](\w*FcmToken)['"]\s*\)/g)) r.token.push(x[1]);
  }
  return r;
}

/** Las listas cerradas que dicen las reglas del bloque `pedidos`: { crear, cambiar, mensaje }. */
function listasDeLasReglas(reglas) {
  const t = reglas.replace(/\r\n/g, '\n');
  const lista = (funcion, desde) => {
    const i = t.indexOf('function ' + funcion + '(');
    if (i < 0) return null;
    const j = t.indexOf(desde, i);
    const fin = t.indexOf('])', j);
    if (j < 0 || fin < 0) return null;
    return [...t.slice(j + desde.length, fin).matchAll(/'([^']+)'/g)].map((x) => x[1]);
  };
  return {
    crear: lista('elPedidoDelClienteNaceCerrado', 'keys().hasOnly(['),
    cambiar: lista('elClienteSoloCambiaLoSuyo', 'cambia.hasOnly(['),
    mensaje: lista('unMensajeMasDelCliente', 'keys().hasOnly(['),
  };
}

/** ¿Las reglas dejan todo lo que escribe la app? Devuelve lo que la app escribe y las reglas no dejan. */
function loQueLaAppEscribeYLasReglasNo(app, reglas) {
  const fuera = (lista, permitidas) => (permitidas ? [...new Set(lista)].filter((k) => !permitidas.includes(k)) : ['(las reglas no tienen lista)']);
  return {
    crear: fuera(app.crear, reglas.crear),
    cambiar: fuera([...app.cambiar.flat(), ...app.token], reglas.cambiar),
    mensaje: fuera(app.mensaje, reglas.mensaje),
  };
}

// ── 2. LA REVISIÓN DEL SERVIDOR CON PEDIDOS LLENOS ──

/** Rellena `campo(n)` hasta que el pedido quede a `holgura` bytes del máximo de un documento. */
function lleno(pedido, poner, holgura = 60) {
  const ruta = 'pedidos/ped1';
  const sin = poner(pedido, '');
  const sobra = LIMITE_DOCUMENTO - holgura - (ruta.split('/').reduce((s, x) => s + x.length + 1, 0) + 16 + tamano(sin) + 32);
  return poner(pedido, 'x'.repeat(Math.max(0, sobra)));
}
const tamanoPedido = (p) => 'pedidos/ped1'.split('/').reduce((s, x) => s + x.length + 1, 0) + 16 + tamano(p) + 32;
const linea = (extra) => ({ lineaId: 'l_1', firma: 'p1|', id: 'p1', nombre: 'Sancocho', precio: 18000, cantidad: 1, adiciones: [], ...(extra || {}) });
const muchas = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const MENSAJE_TOPE = () => ({ de: 'cliente', texto: 't'.repeat(1000), imagen: 'i'.repeat(500), fecha: 'f'.repeat(40) });

/**
 * Los pedidos LLENOS. `reglas`: qué dicen las reglas de hoy de ese pedido ('entra' / 'no entra'); los que no entran
 * se miden igual con el servidor, para enseñar que ahí la defensa son las reglas.
 */
const LLENOS = [
  { nombre: 'honrado · 2 sancochos con queso (para comparar)', honrado: true, reglas: 'entra',
    pedido: () => PEDIDO({ items: [linea({ firma: 'p1|Queso', precio: 20000, cantidad: 2, adiciones: [{ nombre: 'Queso', precio: 2000 }] })], subtotal: 40000, total: 44000 }) },
  { nombre: 'honrado · plato que ya no está en el menú (para comparar)', honrado: true, reglas: 'entra',
    pedido: () => PEDIDO({ items: [linea({ id: 'p9', nombre: 'Viejo', precio: 5000, adiciones: [{ nombre: 'Queso', precio: 2000 }] })], subtotal: 7000, total: 11000 }) },
  { nombre: 'una línea con un campo de sobra («nota») casi de 1 MiB', reglas: 'entra',
    pedido: () => lleno(PEDIDO({ items: [linea({ precio: 1 })], subtotal: 1, total: 1 }), (p, x) => ({ ...p, items: [linea({ precio: 1, nota: x })] })) },
  { nombre: 'un plato fuera del menú con un nombre casi de 1 MiB', reglas: 'entra',
    pedido: () => lleno(PEDIDO({ subtotal: 1, total: 1 }), (p, x) => ({ ...p, items: [linea({ id: 'p9', precio: 1, nombre: x })] })) },
  { nombre: 'un plato fuera del menú con una adición casi de 1 MiB', reglas: 'entra',
    pedido: () => lleno(PEDIDO({ subtotal: 1, total: 1 }), (p, x) => ({ ...p, items: [linea({ id: 'p9', precio: 1, adiciones: [{ nombre: x, precio: 1 }] })] })) },
  { nombre: 'la firma de la línea casi de 1 MiB', reglas: 'entra',
    pedido: () => lleno(PEDIDO({ subtotal: 1, total: 1 }), (p, x) => ({ ...p, items: [linea({ precio: 1, firma: x })] })) },
  { nombre: 'un campo de sobra («relleno») fuera de las líneas, casi de 1 MiB', reglas: 'no entra',
    pedido: () => lleno(PEDIDO({ items: [linea({ precio: 1 })], subtotal: 1, total: 1 }), (p, x) => ({ ...p, relleno: x })) },
  { nombre: 'la dirección casi de 1 MiB', reglas: 'no entra',
    pedido: () => lleno(PEDIDO({ items: [linea({ precio: 1 })], subtotal: 1, total: 1 }), (p, x) => ({ ...p, direccion: x })) },
  // El peor que dejan las reglas de hoy, con la revisión ya hecha: 100 líneas fuera del menú con todo al tope que
  // guarda el servidor (200 letras) y 30 adiciones cada una, y el chat lleno (100 mensajes del cliente al tope).
  { nombre: 'el PEOR que dejan las reglas: 100 líneas × 30 adiciones de textos largos + 100 mensajes al tope', reglas: 'entra',
    pedido: () => {
      const largo = (n) => 'w'.repeat(n);
      const base = PEDIDO({
        cliente: largo(200), direccion: largo(1000), restauranteNombre: largo(300), metodoPago: largo(50), tipo: largo(30),
        items: muchas(100, (i) => linea({ lineaId: largo(200), firma: largo(200), id: ('z' + i + largo(200)).slice(0, 200), nombre: largo(200), precio: 1,
          adiciones: muchas(30, () => ({ nombre: largo(200), precio: 1 })) })),
        subtotal: 1, total: 1, mensajesPedido: muchas(100, MENSAJE_TOPE), clienteFcmToken: largo(500),
      });
      // Si pasa de 1 MiB, se recortan las líneas hasta que quepa (el cliente no lo puede crear más grande).
      while (tamanoPedido(base) > LIMITE_DOCUMENTO - 60) base.items.pop();
      return base;
    } },
];

async function correrLleno(pieza, caso) {
  const pedido = caso.pedido();
  const datos = { 'pedidos/ped1': pedido, 'negocios/R1': NEGOCIO() };
  const { db, registro } = baseEstricta(datos);
  const antes = tamanoPedido(pedido);
  try {
    const p = await pieza.ponerElPrecioDelServidor(db, 'ped1', 'ev1', AHORA);
    const esc = registro.escrituras.find((e) => e.ruta === 'pedidos/ped1');
    return { revienta: false, estado: (p.revisionServidor || {}).estado || null, subtotal: p.subtotal, items: p.items, antes,
      despues: esc ? tamanoPedido({ ...pedido, ...esc.campos }) : antes };
  } catch (e) {
    // Si la revisión no cupo, ¿cabe al menos la marca de «sin revisar» (P11)?
    let marca = 'no se intentó';
    try { await pieza.marcarSinRevisar(baseEstricta(datos).db, 'ped1', 'ev1', e.message); marca = 'cabe'; } catch (e2) { marca = 'tampoco cabe'; }
    return { revienta: true, motivo: e.message, antes, marca };
  }
}

async function medirServidor(commit, pieza) {
  const pz = pieza || piezaDelServidor(commit);
  const filas = [];
  for (const caso of LLENOS) filas.push({ nombre: caso.nombre, honrado: !!caso.honrado, reglas: caso.reglas, ...(await correrLleno(pz, caso)) });
  return filas;
}

// ── 3. PRODUCCIÓN ──

const TOPES = { restauranteNombre: 300, cliente: 200, direccion: 1000, metodoPago: 50, tipo: 30, motivoCancelacion: 1000, clienteFcmToken: 500 };
/** Lo que el servidor escribe (no pasa por reglas): no cuenta como «fuera de la lista». */
const DEL_SERVIDOR = ['revisionServidor'];

function contarNube(pedidos, reglas) {
  const r = { pedidos: pedidos.length, deCliente: 0, mayor: 0, mayorId: '', maxLineas: 0, maxMensajes: 0, fueraDeLaLista: [], pasanDelTope: [], campos: {} };
  const permitidas = [...(reglas.crear || []), ...(reglas.cambiar || []), ...DEL_SERVIDOR];
  for (const p of pedidos) {
    const { id, ...campos } = p;
    const t = tamanoPedido(campos);
    if (t > r.mayor) { r.mayor = t; r.mayorId = id; }
    r.maxLineas = Math.max(r.maxLineas, Array.isArray(p.items) ? p.items.length : 0);
    r.maxMensajes = Math.max(r.maxMensajes, Array.isArray(p.mensajesPedido) ? p.mensajesPedido.length : 0);
    for (const k of Object.keys(campos)) r.campos[k] = (r.campos[k] || 0) + 1;
    if (!p.clienteId) continue; // los del negocio (la mesa) y los viejos sin firma no pasan por la regla del cliente
    r.deCliente += 1;
    const fuera = Object.keys(campos).filter((k) => !permitidas.includes(k));
    if (fuera.length) r.fueraDeLaLista.push(id + ': ' + fuera.join(', '));
    for (const [k, tope] of Object.entries(TOPES)) if (typeof p[k] === 'string' && p[k].length > tope) r.pasanDelTope.push(id + ': ' + k + ' (' + p[k].length + ')');
  }
  return r;
}

async function paquetePublicado() {
  const html = await (await fetch('https://guajirago.web.app/')).text();
  const m = /static\/js\/main\.[0-9a-f]+\.js/.exec(html);
  if (!m) throw new Error('no encontré el paquete en guajirago.web.app');
  return { nombre: m[0], texto: await (await fetch('https://guajirago.web.app/' + m[0])).text() };
}

function imprimirApp(titulo, app, reglas) {
  const fuera = loQueLaAppEscribeYLasReglasNo(app, reglas);
  console.log('── ' + titulo + ' ──');
  console.log('  crea con:   ' + [...new Set(app.crear)].join(', '));
  console.log('  cambia:     ' + app.cambiar.map((c) => '{' + c.join(', ') + '}').join(' · ') + (app.token.length ? ' · {' + app.token.join(', ') + '} (token de avisos)' : ''));
  console.log('  mensaje:    ' + [...new Set(app.mensaje)].join(', '));
  const n = fuera.crear.length + fuera.cambiar.length + fuera.mensaje.length;
  console.log('  ' + (n ? '🔴 lo que escribe y las reglas NO dejan: ' + JSON.stringify(fuera) : '✓ las reglas dejan todo lo que escribe'));
  return n;
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const commit = arg('--commit');
  const reglas = listasDeLasReglas(leerRaiz(commit, 'firestore.rules'));
  console.log('── LAS REGLAS ' + (commit || 'de hoy') + ' ──');
  console.log('  al crear (cliente): ' + (reglas.crear ? reglas.crear.length + ' campos' : 'SIN LISTA: entra cualquier campo de cualquier tamaño'));
  console.log('  al cambiar (cliente): ' + (reglas.cambiar ? reglas.cambiar.length + ' campos' : 'SIN LISTA: cualquier campo menos la plata'));
  console.log('  mensaje del chat: ' + (reglas.mensaje ? reglas.mensaje.join(', ') : 'SIN LISTA'));
  imprimirApp('LA APP · Restaurantes.js ' + (commit || 'de hoy'), escriturasDeLaApp(leerRaiz(commit, 'guajirago/src/Restaurantes.js')), reglas);

  const filas = await medirServidor(commit);
  console.log('\n── LA REVISIÓN DEL SERVIDOR · precioPedido.cjs ' + (commit || 'de hoy') + ' ──');
  for (const f of filas) {
    const que = f.revienta
      ? '🔴 NO CABE: ' + f.motivo.slice(0, 90) + ' · la marca de «sin revisar»: ' + f.marca
      : (f.estado || 'sin revisión') + ' · subtotal ' + f.subtotal + ' · ' + f.antes + ' → ' + f.despues + ' bytes';
    console.log('  ' + (f.honrado ? '(honrado) ' : '') + f.nombre + ' [reglas de hoy: ' + f.reglas + ']\n      ' + que);
  }
  const queEntran = filas.filter((f) => !f.honrado && f.reglas === 'entra');
  console.log('\n  llenos que dejan las reglas de hoy: ' + queEntran.length + ' · no caben para la revisión: ' + queEntran.filter((f) => f.revienta).length
    + ' · llenos que ya no dejan las reglas: ' + filas.filter((f) => f.reglas === 'no entra').length);

  if (process.argv.includes('--publicado')) {
    const pq = await paquetePublicado();
    imprimirApp('LA APP PUBLICADA · ' + pq.nombre, escriturasDeLaApp(pq.texto), listasDeLasReglas(leerRaiz(null, 'firestore.rules')));
  }
  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const r = contarNube((await traer('pedidos')).map(doc), listasDeLasReglas(leerRaiz(null, 'firestore.rules')));
    console.log('\n── PRODUCCIÓN (solo lectura) ──');
    console.log('  pedidos: ' + r.pedidos + ' · de clientes con firma: ' + r.deCliente + ' · el más grande: ' + r.mayor + ' bytes (' + r.mayorId + ')'
      + ' · líneas máx.: ' + r.maxLineas + ' · mensajes máx.: ' + r.maxMensajes);
    console.log('  campos guardados: ' + Object.entries(r.campos).sort().map(([k, n]) => k + '×' + n).join(', '));
    console.log('  de cliente fuera de la lista de hoy: ' + r.fueraDeLaLista.length + (r.fueraDeLaLista.length ? ' → ' + r.fueraDeLaLista.join(' · ') : ''));
    console.log('  de cliente que pasan un tope de hoy: ' + r.pasanDelTope.length + (r.pasanDelTope.length ? ' → ' + r.pasanDelTope.join(' · ') : ''));
  }
  process.exit(0);
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { escriturasDeLaApp, listasDeLasReglas, loQueLaAppEscribeYLasReglasNo, clavesDelObjeto, LLENOS, correrLleno, medirServidor, contarNube, tamanoPedido, MENSAJE_TOPE, LIMITE_DOCUMENTO };
