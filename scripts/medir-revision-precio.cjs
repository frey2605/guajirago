#!/usr/bin/env node
/**
 * P11 · SI LA REVISIÓN DEL PRECIO DEL PEDIDO FALLA, ¿QUIÉN SE ENTERA? — SOLO LECTURA
 *
 *   node scripts/medir-revision-precio.cjs                                       el código de hoy (sin red)
 *   node scripts/medir-revision-precio.cjs --commit 49317d0 --commit-aliados 2b5f4ee   el código de antes de P11
 *   node scripts/medir-revision-precio.cjs --nube                                además, los pedidos de PRODUCCIÓN
 *
 * El pendiente (hijo de P09/P10): `notificarNuevoPedido` le pone al pedido de un cliente el precio del MENÚ al nacer
 * (ponerElPrecioDelServidor, guajirago/functions/precioPedido.cjs) y luego avisa al negocio. Si esa revisión revienta,
 * el pedido se queda con los precios que mandó el TELÉFONO y aliados lo enseña como uno cualquiera.
 *
 * Este guion EJECUTA index.js de verdad (el de hoy o el de un commit, con SU precioPedido.cjs) contra la nube de
 * mentira de pruebas/nubeDeMentira.cjs, en cada camino que hace fallar la revisión, y dice:
 *   · qué queda escrito en el pedido (¿el total del teléfono? ¿alguna marca?);
 *   · qué dice el aviso que le llega al negocio;
 *   · qué enseña ALIADOS: lo dice la pieza de aliados (revisionPrecio.js) de ese commit, a los 5 segundos de nacer
 *     el pedido y a los 3 minutos; si aliados no tiene la pieza, lo enseña como un pedido normal.
 * Con --nube cuenta además los pedidos de clientes guardados en producción y cómo quedó su revisión.
 * No escribe nada en ningún sitio.
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const DIR_FUNCIONES = path.join(RAIZ, 'guajirago', 'functions');
const PIEZA_ALIADOS = 'src/revisionPrecio.js';
const PANTALLA_ALIADOS = 'src/PedidosDomicilio.js';

function deGit(cwd, commit, rel) {
  try { return execFileSync('git', ['show', commit + ':' + rel], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
}
const leerRaiz = (commit, rel) => (commit ? deGit(RAIZ, commit, rel) : (fs.existsSync(path.join(RAIZ, rel)) ? fs.readFileSync(path.join(RAIZ, rel), 'utf8') : null));
const DIR_ALIADOS = path.join(RAIZ, 'guajirago-aliados');
const leerAliados = (commit, rel) => (commit ? deGit(DIR_ALIADOS, commit, rel) : (fs.existsSync(path.join(DIR_ALIADOS, rel)) ? fs.readFileSync(path.join(DIR_ALIADOS, rel), 'utf8') : null));

/** precioPedido.cjs del commit (o del disco), cargado como módulo de la carpeta de las funciones. */
function piezaDelServidor(commit) {
  const fuente = leerRaiz(commit, 'guajirago/functions/precioPedido.cjs');
  if (!fuente) return null;
  const archivo = path.join(DIR_FUNCIONES, 'precioPedido.cjs');
  const m = new Module(archivo, null);
  m.filename = archivo;
  m.paths = Module._nodeModulePaths(DIR_FUNCIONES);
  m._compile(fuente, archivo);
  return m.exports;
}

/** La pieza de aliados que dice cómo va la revisión, o null si ese aliados no la tiene (no mira la revisión). */
function piezaDeAliados(commitAliados, fuente) {
  const t = fuente !== undefined ? fuente : leerAliados(commitAliados, PIEZA_ALIADOS);
  if (!t) return null;
  const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
  return cargarDeLaApp('guajirago-aliados/' + PIEZA_ALIADOS, t);
}

// ── El caso de siempre: Ana pide 2 sancochos con un teléfono que dice $1 cada uno ──
const TEL = '3001112233';
const NEGOCIO = () => ({
  nombre: 'La Cocina de Meche', costoDomicilio: 4000,
  menu: [{ id: 'p1', nombre: 'Sancocho', precio: 18000, disponible: true }],
  promociones: [],
});
const PEDIDO = (extra) => ({
  restauranteId: 'R1', clienteId: 'ana', cliente: 'Ana', telefono: TEL, estado: 'nuevo', tipo: 'domicilio',
  items: [{ id: 'p1', nombre: 'Sancocho', precio: 1, cantidad: 2, adiciones: [] }],
  subtotal: 2, costoDomicilio: 0, total: 2, ...(extra || {}),
});
const seCayo = () => new Proxy({}, { get: () => { throw new Error('se cayó la base'); } });

/**
 * Los caminos. `datos()` arma la nube; `romper(datos)` la daña DESPUÉS de cargar index.js (como hace la prueba de
 * P09); `noCorre` = la función ni arranca (se cayó, se le acabó el tiempo, no estaba publicada).
 */
const ESCENARIOS = [
  { nombre: 'normal (todo bien)', falla: false, datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: { R1: NEGOCIO() }, pedidos: { ped1: PEDIDO() } }) },
  { nombre: 'la base no contesta al leer el negocio', falla: true,
    datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: { R1: NEGOCIO() }, pedidos: { ped1: PEDIDO() } }), romper: (d) => { d.negocios = seCayo(); } },
  { nombre: 'el menú guardado con otra forma (no es una lista)', falla: true,
    datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: { R1: { ...NEGOCIO(), menu: { p1: { id: 'p1', precio: 18000 } } } }, pedidos: { ped1: PEDIDO() } }) },
  { nombre: 'una promoción con los días mal guardados', falla: true,
    datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: { R1: { ...NEGOCIO(), promociones: [{ id: 'mar', tipo: 'fijo', valor: 1000, activa: true, programacion: 'dias', dias: 3 }] } },
      pedidos: { ped1: PEDIDO({ items: [{ id: 'p1', nombre: 'Sancocho', precio: 1, cantidad: 2, promoId: 'mar' }] }) } }) },
  { nombre: 'la base entera se cae (tampoco se puede marcar)', falla: true,
    datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: { R1: NEGOCIO() }, pedidos: { ped1: PEDIDO() } }), romper: (d) => { d.negocios = seCayo(); d.pedidos = seCayo(); } },
  { nombre: 'la función no corre (caída, tiempo agotado o sin publicar)', falla: true, noCorre: true,
    datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: { R1: NEGOCIO() }, pedidos: { ped1: PEDIDO() } }) },
  { nombre: 'el negocio no existe', falla: true, sinAliados: true,
    datos: () => ({ negociosPrivado: { R1: { fcmToken: 'tok-meche' } }, negocios: {}, pedidos: { ped1: PEDIDO() } }) },
];

/** Corre un camino con el index.js (y su precioPedido.cjs) de `commit`. Devuelve qué quedó y qué se avisó. */
async function correrEscenario(esc, commit) {
  const NUBE = require('../pruebas/nubeDeMentira.cjs');
  const datos = esc.datos();
  const pedidoNacido = datos.pedidos.ped1;
  const pieza = commit ? piezaDelServidor(commit) : null;
  const original = Module._load;
  if (pieza) {
    Module._load = function (pedido, ...resto) {
      if (pedido === './precioPedido.cjs') return pieza;
      return original.call(this, pedido, ...resto);
    };
  }
  let cargado;
  try { cargado = NUBE.cargarIndex(datos, {}, commit || undefined); } finally { Module._load = original; }
  const { fx, escrituras, mensajero } = cargado;
  if (esc.romper) esc.romper(datos);
  let registro = '';
  if (!esc.noCorre) {
    const evento = { id: 'ev1', data: { id: 'ped1', data: () => pedidoNacido } };
    registro = (await NUBE.conRegistro(() => fx.notificarNuevoPedido(evento))).registro;
  }
  const alPedido = escrituras.filter((e) => e.ruta === 'pedidos/ped1');
  const quedo = alPedido.reduce((p, e) => ({ ...p, ...e.campos }), { ...pedidoNacido });
  return {
    nombre: esc.nombre, falla: esc.falla, sinAliados: !!esc.sinAliados,
    escrituras: alPedido.length, quedo, total: quedo.total,
    conElTotalDelTelefono: quedo.total === pedidoNacido.total,
    revision: quedo.revisionServidor || null,
    aviso: esc.noCorre ? '(no corrió)' : (mensajero.recibidos[0] ? mensajero.recibidos[0].notification.body : '(sin aviso)'),
    usosPromo: escrituras.filter((e) => e.ruta.startsWith('usosPromo/')).length,
    registro,
  };
}

/** Lo que enseña aliados de ese pedido a los `ms` de nacer: con su pieza, o «normal» si no la tiene. */
function loQueVeAliados(pieza, pedido, ms) {
  if (!pieza) return 'normal (aliados no mira la revisión)';
  return pieza.comoVaLaRevision(pedido, ms);
}

/** ¿La pantalla de pedidos de aliados usa la pieza, y confirma con el pedido VIVO? (lo ejecuta la prueba) */
function pantallaDeAliados(commitAliados) {
  const t = (leerAliados(commitAliados, PANTALLA_ALIADOS) || '').replace(/\r\n/g, '\n');
  const i = t.indexOf('const confirmarConTiempo = ');
  const confirmar = i >= 0 ? t.slice(i, t.indexOf('\n  };', i)) : '';
  return {
    importaLaPieza: /from '\.\/revisionPrecio'/.test(t),
    usosDeLaPieza: (t.match(/\brevisionDe\(/g) || []).length,
    confirmaConElPedidoVivo: /pedidoVivo\(/.test(confirmar),
    confirmarEsperaLaRevision: /'revisando'/.test(confirmar),
  };
}

/** `piezaAliados` (opcional): otra pieza de aliados, para que la prueba compruebe que el veredicto muerde. */
async function medirCodigo(commit, commitAliados, piezaAliados) {
  const pieza = piezaAliados !== undefined ? piezaAliados : piezaDeAliados(commitAliados);
  const filas = [];
  for (const esc of ESCENARIOS) {
    const r = await correrEscenario(esc, commit);
    r.aliados5s = loQueVeAliados(pieza, r.quedo, 5 * 1000);
    r.aliados3min = loQueVeAliados(pieza, r.quedo, 3 * 60 * 1000);
    // Daño en silencio: falló, el pedido sigue con el total del teléfono, y aliados (ya pasados 3 minutos) no lo
    // enseña como «sin revisar». El negocio sin aliados no cuenta: nadie lo ve.
    r.enSilencio = r.falla && !r.sinAliados && r.conElTotalDelTelefono && r.aliados3min !== 'sin-revisar';
    filas.push(r);
  }
  // La carrera: el pedido recién nacido, a los 5 segundos, antes de que el servidor conteste.
  const carrera = loQueVeAliados(pieza, PEDIDO(), 5 * 1000);
  return { filas, carrera, pantalla: pantallaDeAliados(commitAliados), tienePieza: !!pieza };
}

/** Los pedidos de clientes guardados, y cómo quedó su revisión (lo dice la pieza de aliados si la hay). */
function contarPedidos(pedidos, pieza, ahora, msDeFecha) {
  const r = { pedidos: pedidos.length, deCliente: 0, sinRevision: 0, revisionSinEstado: 0, porEstado: {}, vistaAliados: {}, activosSinRevisar: [] };
  for (const p of pedidos) {
    if (!p.clienteId) continue;
    r.deCliente += 1;
    const rv = p.revisionServidor;
    if (!rv) r.sinRevision += 1;
    else if (!rv.estado) r.revisionSinEstado += 1;
    else r.porEstado[rv.estado] = (r.porEstado[rv.estado] || 0) + 1;
    if (pieza) {
      const ms = msDeFecha(p.creado);
      const v = pieza.comoVaLaRevision(p, ms ? ahora - ms : null);
      r.vistaAliados[v] = (r.vistaAliados[v] || 0) + 1;
      if (v === 'sin-revisar' && !['cerrado', 'cancelado'].includes(p.estado)) r.activosSinRevisar.push(p.id + ' (' + p.estado + ')');
    }
  }
  return r;
}

async function main() {
  const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
  const commit = arg('--commit');
  const commitAliados = arg('--commit-aliados');
  const c = await medirCodigo(commit, commitAliados);
  console.log('── EN EL CÓDIGO · servidor ' + (commit || 'hoy') + ' · aliados ' + (commitAliados || 'hoy') + ' ──');
  for (const f of c.filas) {
    console.log('  · ' + f.nombre);
    console.log('      pedido: total ' + f.total + (f.conElTotalDelTelefono ? ' (EL DEL TELÉFONO)' : '') + ' · revisión: '
      + (f.revision ? JSON.stringify({ estado: f.revision.estado, motivo: f.revision.motivo }) : 'ninguna') + ' · contador de promos: ' + f.usosPromo);
    console.log('      aviso al negocio: ' + f.aviso);
    console.log('      aliados: a los 5 s «' + f.aliados5s + '» · a los 3 min «' + f.aliados3min + '»' + (f.sinAliados ? ' (ningún negocio lo ve)' : ''));
    if (f.enSilencio) console.log('      🔴 EN SILENCIO: el pedido sigue con el precio del teléfono y aliados no lo distingue');
  }
  const fallan = c.filas.filter((f) => f.falla);
  console.log('\n  caminos que hacen fallar la revisión: ' + fallan.length
    + ' · se quedan EN SILENCIO: ' + fallan.filter((f) => f.enSilencio).length);
  console.log('  la carrera (aliados mira el pedido a los 5 s, antes de la revisión): «' + c.carrera + '»');
  console.log('  pantalla de aliados: ' + JSON.stringify(c.pantalla));

  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const pieza = piezaDeAliados(commitAliados);
    const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
    const { msDeFecha } = cargarDeLaApp('guajirago-aliados/src/fechaGuardada.js');
    const r = contarPedidos((await traer('pedidos')).map(doc), pieza, Date.now(), msDeFecha);
    console.log('\n── PRODUCCIÓN (solo lectura) ──');
    console.log('  pedidos: ' + r.pedidos + ' · de clientes: ' + r.deCliente);
    console.log('  sin revisión del servidor: ' + r.sinRevision + ' · con revisión sin estado (antes de P11): ' + r.revisionSinEstado
      + ' · por estado: ' + JSON.stringify(r.porEstado));
    if (pieza) {
      console.log('  lo que enseñaría aliados: ' + JSON.stringify(r.vistaAliados));
      console.log('  sin revisar y todavía en curso (lo verá el negocio): ' + (r.activosSinRevisar.length ? r.activosSinRevisar.join(', ') : 'ninguno'));
    }
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { ESCENARIOS, PEDIDO, NEGOCIO, correrEscenario, loQueVeAliados, pantallaDeAliados, piezaDeAliados, piezaDelServidor, medirCodigo, contarPedidos };
