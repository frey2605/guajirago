#!/usr/bin/env node
/**
 * P09 · ¿QUIÉN DECIDE EL TOTAL DE UN PEDIDO A DOMICILIO? — SOLO LECTURA
 *
 *   node scripts/medir-total-pedido.cjs                  el código de hoy (sin red)
 *   node scripts/medir-total-pedido.cjs --commit 8b34eb3 el código de un commit (el de antes de P09)
 *   node scripts/medir-total-pedido.cjs --nube           además, los pedidos guardados en PRODUCCIÓN
 *
 * La deuda (CLAUDE.md, SEGUNDA LEY): «El total del pedido lo decide el teléfono». Este guion cuenta:
 *   1. EN EL CÓDIGO: qué sitios de las tres apps escriben en `pedidos` los campos de plata (items, subtotal,
 *      costoDomicilio, total); si el servidor les pone el precio al nacer (notificarNuevoPedido → precioPedido.cjs);
 *      y quién escribe el contador de las promociones (`usosPromo`).
 *   2. EN PRODUCCIÓN (--nube): los pedidos de clientes (a domicilio), y cuántos tienen un precio que NO es el del menú
 *      de hoy. Lo dice el MOTOR DEL SERVIDOR (`pedidoConPreciosDelMenu` de guajirago/functions/precioPedido.cjs), no
 *      una cuenta de este guion. Ojo: el menú pudo cambiar desde que se hizo el pedido, así que un pedido viejo que no
 *      cuadra NO es por fuerza una trampa; y los usos viejos de las promociones no se saben (se cuentan como 0).
 *      Cuántos ya llevan la revisión del servidor (`revisionServidor`).
 * No escribe nada en ningún sitio.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const PLATA = ['items', 'subtotal', 'costoDomicilio', 'total'];

function archivos(dir) {
  const fuera = [];
  if (!fs.existsSync(dir)) return fuera;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'build') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) fuera.push(...archivos(p));
    else if (/\.(c?js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) fuera.push(p);
  }
  return fuera;
}

/** Lee del disco o de un commit. Los dos repos hermanos se leen siempre del disco (el commit es del repo raíz). */
function lector(commit) {
  return (rel) => {
    if (commit && !/^guajirago-(admin|aliados)\//.test(rel)) {
      try { return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
    }
    const abs = path.join(RAIZ, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };
}

function listaDeArchivos(commit) {
  const lista = [];
  for (const c of APPS) {
    if (commit && c.startsWith('guajirago/')) {
      const salida = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, c], { cwd: RAIZ, encoding: 'utf8' });
      lista.push(...salida.split('\n').filter((r) => /\.(c?js|jsx)$/.test(r) && !/\.test\./.test(r)));
    } else {
      lista.push(...archivos(path.join(RAIZ, c)).map((a) => path.relative(RAIZ, a).replace(/\\/g, '/')));
    }
  }
  return lista;
}

/**
 * Los sitios que ESCRIBEN plata en `pedidos` desde un teléfono: un addDoc/updateDoc/setDoc a la colección `pedidos`
 * y, en sus 30 renglones siguientes (hasta que cierra la llamada), alguno de los campos de plata. Función pura sobre
 * { archivo: texto }.
 */
function quienEscribeLaPlata(textos) {
  const sitios = [];
  for (const [archivo, texto] of Object.entries(textos)) {
    if (!texto) continue;
    const r = texto.split(/\r?\n/);
    r.forEach((linea, i) => {
      if (!/\b(addDoc|updateDoc|setDoc)\(/.test(linea) || !/['"]pedidos['"]/.test(linea)) return;
      const tramo = r.slice(i, i + 30);
      const fin = tramo.findIndex((l, k) => k > 0 && /^\s*\}\s*(,\s*\{[^}]*\})?\)/.test(l));
      const cuerpo = (fin >= 0 ? tramo.slice(0, fin + 1) : tramo.slice(0, 1)).join('\n');
      const campos = PLATA.filter((c) => new RegExp('(^|[\\s{,])' + c + '\\s*:').test(cuerpo));
      if (campos.length) sitios.push({ sitio: archivo + ':' + (i + 1), campos });
    });
  }
  return sitios;
}

/** ¿El servidor le pone el precio al pedido al nacer? Mira index.js y la pieza. */
function elServidorPoneElPrecio(leer) {
  const index = leer('guajirago/functions/index.js') || '';
  const pieza = leer('guajirago/functions/precioPedido.cjs');
  const pide = /require\('\.\/precioPedido\.cjs'\)/.test(index);
  const m = index.match(/exports\.notificarNuevoPedido\s*=\s*onDocumentCreated\([^]*?\);/);
  const disparo = m ? m[0] : '';
  return { pieza: !!pieza, pide, enElDisparo: /pedidoConElPrecioDelServidor\(event\)/.test(disparo) };
}

/** Quién escribe el contador `usosPromo` (sitios), en las apps y en la nube. */
function quienCuentaLasPromos(textos) {
  const sitios = [];
  for (const [archivo, texto] of Object.entries(textos)) {
    if (!texto) continue;
    texto.split(/\r?\n/).forEach((l, i) => {
      if (/['"]usosPromo['"]/.test(l) && /\b(setDoc|updateDoc|addDoc)\(|\.(set|update)\(/.test(l)) sitios.push(archivo + ':' + (i + 1));
    });
  }
  return sitios;
}

function medirCodigo(commit) {
  const leer = lector(commit);
  const textos = {};
  for (const a of listaDeArchivos(commit)) textos[a] = leer(a);
  const nube = {};
  for (const a of ['guajirago/functions/index.js', 'guajirago/functions/precioPedido.cjs']) nube[a] = leer(a);
  return {
    escribenPlata: quienEscribeLaPlata(textos),
    servidor: elServidorPoneElPrecio(leer),
    cuentanPromos: quienCuentaLasPromos({ ...textos, ...nube }),
  };
}

/**
 * Los pedidos guardados, contados con el MOTOR DEL SERVIDOR. `pedidos` y `negocios` ya leídos ({id, ...campos}).
 * Un pedido «de cliente» es uno a domicilio (los viejos no llevan firma); los de mesa los pone el propio negocio.
 */
function contarPedidos(pedidos, negocios, motor, ahora) {
  const porId = Object.fromEntries(negocios.map((n) => [n.id, n]));
  const r = { pedidos: pedidos.length, deCliente: 0, conRevision: 0, sinNegocio: 0, noCuadran: [], conPromo: 0, conProblemas: 0 };
  for (const p of pedidos) {
    if (p.tipo !== 'domicilio' && !p.clienteId) continue;
    r.deCliente += 1;
    if (p.revisionServidor) r.conRevision += 1;
    if ((p.items || []).some((i) => i && i.promoId)) r.conPromo += 1;
    const n = porId[p.restauranteId];
    if (!n) { r.sinNegocio += 1; continue; }
    const s = motor(n, p.items, () => 0, ahora);
    const delTelefono = typeof p.subtotal === 'number' ? p.subtotal
      : (p.items || []).reduce((t, i) => t + (Number(i && i.precio) || 0) * (Number(i && i.cantidad) || 0), 0);
    if (s.problemas.length) r.conProblemas += 1;
    if (s.subtotal !== delTelefono) r.noCuadran.push({ id: p.id, telefono: delTelefono, servidor: s.subtotal });
  }
  return r;
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const c = medirCodigo(commit);
  console.log('── EN EL CÓDIGO' + (commit ? ' (commit ' + commit + ')' : ' (hoy)') + ' ──');
  console.log('  sitios de las apps que escriben PLATA en pedidos: ' + c.escribenPlata.length);
  for (const s of c.escribenPlata) console.log('    · ' + s.sitio + '  (' + s.campos.join(', ') + ')');
  const ok = c.servidor.pieza && c.servidor.pide && c.servidor.enElDisparo;
  console.log('  ¿el servidor le pone el precio del menú al pedido al nacer?: ' + (ok ? 'SÍ' : 'NO')
    + (ok ? '' : '  (pieza: ' + c.servidor.pieza + ', la pide index.js: ' + c.servidor.pide + ', en el disparo: ' + c.servidor.enElDisparo + ')'));
  console.log('  quién escribe el contador usosPromo: ' + (c.cuentanPromos.length ? c.cuentanPromos.join(', ') : 'nadie'));
  console.log('    · desde un teléfono: ' + c.cuentanPromos.filter((s) => !s.startsWith('guajirago/functions')).length
    + ' · desde el servidor: ' + c.cuentanPromos.filter((s) => s.startsWith('guajirago/functions')).length);

  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const { pedidoConPreciosDelMenu } = require('../guajirago/functions/precioPedido.cjs');
    const r = contarPedidos((await traer('pedidos')).map(doc), (await traer('negocios')).map(doc), pedidoConPreciosDelMenu, new Date());
    console.log('\n── PRODUCCIÓN (solo lectura; el motor es el del servidor, con el menú de HOY) ──');
    console.log('  pedidos: ' + r.pedidos + ' · de clientes (a domicilio): ' + r.deCliente);
    console.log('  con la revisión del servidor (revisionServidor): ' + r.conRevision);
    console.log('  con algún plato en promoción: ' + r.conPromo);
    console.log('  con algo que el menú de hoy no puede cobrar (problemas): ' + r.conProblemas + ' · sin negocio: ' + r.sinNegocio);
    console.log('  cuyo subtotal NO es el del menú de hoy: ' + r.noCuadran.length);
    for (const x of r.noCuadran) console.log('    · ' + x.id + ': el teléfono ' + x.telefono + ', el menú ' + x.servidor);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { quienEscribeLaPlata, elServidorPoneElPrecio, quienCuentaLasPromos, medirCodigo, contarPedidos };
