#!/usr/bin/env node
/**
 * ¿QUÉ NÚMERO LLEVA UN PEDIDO? «Pedido #ABCDE» — gemelo G94 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-numero-pedido.cjs            <- el código del disco
 *   node scripts/medir-numero-pedido.cjs --antes    <- y el careo con el código de antes (ee4a572 / 53f39a9)
 *   node scripts/medir-numero-pedido.cjs --nube     <- y con los ids de los pedidos de PRODUCCIÓN (solo lee los ids)
 *
 * El número corto de un pedido son las 5 últimas letras de su id, en mayúsculas. Lo enseñan NUEVE sitios:
 *   · la app del cliente (guajirago/src/Restaurantes.js): al crear el pedido, al abrir uno de «Mis pedidos» y en su tarjeta;
 *   · aliados: el historial (HistorialDomicilios.js) y, en PedidosDomicilio.js, el recibo, la comanda, la tarjeta,
 *     el WhatsApp al cliente y el chat.
 * Antes de G94 cada sitio lo armaba a mano (`(p.id || '').slice(-5).toUpperCase()`). Desde G94 lo arma numeroDelPedido,
 * en guajirago/src/estadosPedido.js, con copia letra por letra en guajirago-aliados/src/flujoPedidos.js (otro repo,
 * no puede importarla). El servidor (guajirago/functions) y el panel NO arman el número (lo comprueba este guion).
 *
 * Qué hace: en cada archivo busca cada sitio donde sale el número —a mano o con la pieza— y lo EJECUTA con cada id
 * (el sitio sacado del archivo, con la pieza que de verdad importa). Así el careo compara el número que sale, sitio por
 * sitio, antes y ahora; y compara también el renglón que lo rodea (con el número tapado), para ver que el «Pedido #»,
 * «Domicilio #» o «pedido #» de alrededor sigue igual. No escribe nada.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { lector } = require('./medir-conexion-firebase.cjs');

const ANTES = { raiz: 'ee4a572', aliados: '53f39a9', admin: '1cf9bef' }; // los últimos commits antes de G94
const PIEZA_APP = 'guajirago/src/estadosPedido.js';
const PIEZA_ALIADOS = 'guajirago-aliados/src/flujoPedidos.js';
const MARCA = '// ¿QUÉ NÚMERO LLEVA EL PEDIDO?';
const SITIOS = [
  { archivo: 'guajirago/src/Restaurantes.js', pieza: PIEZA_APP, desde: './estadosPedido', cuantos: 3 },
  { archivo: 'guajirago-aliados/src/HistorialDomicilios.js', pieza: PIEZA_ALIADOS, desde: './flujoPedidos', cuantos: 1 },
  { archivo: 'guajirago-aliados/src/PedidosDomicilio.js', pieza: PIEZA_ALIADOS, desde: './flujoPedidos', cuantos: 5 },
];
// Donde se busca el número armado a mano: las TRES apps y el servidor.
const CARPETAS = ['guajirago/src', 'guajirago-aliados/src', 'guajirago-admin/src', 'guajirago/functions'];
// Ids de mentira para cuando no se lee producción (largos, cortos y con minúsculas).
const IDS_DE_MENTIRA = ['Xq3kLm9aZb2cD', 'abcde', 'ab', '0Kz9y', 'pEdIdOxYz12'];

// El número a mano: `(X || '').slice(-5).toUpperCase()` o `X.slice(-5).toUpperCase()`.
const A_MANO = /(\(\s*[A-Za-z_$][\w$.]*\s*\|\|\s*''\s*\)|[A-Za-z_$][\w$.]*)\.slice\(-5\)\.toUpperCase\(\)/g;
// El número con la pieza: `numeroDelPedido(X)`.
const CON_PIEZA = /\bnumeroDelPedido\(([^()]*)\)/g;

function argumento(nombre) { return process.argv.includes(nombre); }

/** Los .js/.cjs de una carpeta (sin node_modules): del disco, o del commit de su repo. */
function archivosDe(carpeta, commits) {
  const repo = carpeta.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : carpeta.startsWith('guajirago-admin/') ? 'guajirago-admin' : null;
  const commit = commits && (repo === 'guajirago-aliados' ? commits.aliados : repo === 'guajirago-admin' ? commits.admin : commits.raiz);
  const vale = (f) => /\.(c?js)$/.test(f) && !f.includes('node_modules');
  if (!commit) {
    const out = [];
    const recorrer = (rel) => {
      for (const e of fs.readdirSync(path.join(RAIZ, rel), { withFileTypes: true })) {
        if (e.name === 'node_modules') continue;
        if (e.isDirectory()) recorrer(rel + '/' + e.name);
        else if (vale(e.name)) out.push(rel + '/' + e.name);
      }
    };
    recorrer(carpeta);
    return out;
  }
  const cwd = repo ? path.join(RAIZ, repo) : RAIZ;
  const dentro = repo ? carpeta.slice(repo.length + 1) : carpeta;
  const salida = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, dentro + '/'], { cwd, encoding: 'utf8' });
  return salida.split('\n').filter(vale).map((f) => (repo ? repo + '/' : '') + f);
}

/** El bloque de la pieza: desde su comentario hasta el renglón `export const numeroDelPedido = …;`. */
function bloque(texto) {
  if (texto == null) return null;
  const t = texto.replace(/\r\n/g, '\n');
  const i = t.indexOf(MARCA);
  if (i < 0 || t.indexOf(MARCA, i + 1) >= 0) return null;
  const e = t.indexOf('export const numeroDelPedido', i);
  if (e < 0) return null;
  const j = t.indexOf('\n', e);
  return t.slice(i, j < 0 ? t.length : j);
}

/** Los sitios de un texto donde sale el número, en orden: a mano o con la pieza. */
function usosEn(texto) {
  const t = texto.replace(/\r\n/g, '\n');
  const usos = [];
  for (const m of t.matchAll(A_MANO)) usos.push({ i: m.index, expr: m[0], forma: 'a mano' });
  for (const m of t.matchAll(CON_PIEZA)) {
    const antes = t.slice(Math.max(0, m.index - 30), m.index);
    if (/export const\s*$/.test(antes)) continue; // la definición de la pieza no es un uso
    usos.push({ i: m.index, expr: m[0], forma: 'pieza' });
  }
  usos.sort((a, b) => a.i - b.i);
  return usos.map((u) => {
    const ini = t.lastIndexOf('\n', u.i) + 1;
    let fin = t.indexOf('\n', u.i);
    if (fin < 0) fin = t.length;
    const linea = t.slice(ini, fin);
    return {
      ...u,
      renglon: t.slice(0, u.i).split('\n').length,
      // El renglón con el número TAPADO: lo que lo rodea («Pedido #», «Domicilio #»…) tiene que seguir igual.
      alrededor: (linea.slice(0, u.i - ini) + '«№»' + linea.slice(u.i - ini + u.expr.length)).trim(),
    };
  });
}

/** Ejecuta un uso con un id: la variable que lleva el `.id` (p, pedidoChat, ref…) es un pedido con ese id. */
function ejecutar(expr, numeroDelPedido, id) {
  const raices = [...new Set([...expr.matchAll(/\b([A-Za-z_$][\w$]*)\.id\b/g)].map((m) => m[1]))];
  // eslint-disable-next-line no-new-func
  const f = new Function('numeroDelPedido', ...raices, 'return (' + expr + ');');
  try { return f(numeroDelPedido, ...raices.map(() => ({ id }))); } catch (e) { return 'ERROR: ' + e.message; }
}

/**
 * Mide un estado del código. `commits` = null (el disco) o { raiz, aliados, admin }; `cambios` pisa archivos
 * (pantallas de mentira para la prueba). `ids` = los ids con que se ejecuta cada sitio.
 */
function medir(commits, ids = IDS_DE_MENTIRA, cambios = {}) {
  const base = lector(commits || {});
  const leer = (r) => (Object.prototype.hasOwnProperty.call(cambios, r) ? cambios[r] : base(r));
  const problemas = [];

  // 1 · La pieza y su copia.
  const bApp = bloque(leer(PIEZA_APP));
  const bAli = bloque(leer(PIEZA_ALIADOS));
  const piezas = {};
  for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
    const t = leer(ruta);
    if (t == null) { problemas.push('no está ' + ruta); continue; }
    try { piezas[ruta] = cargarDeLaApp(ruta, t).numeroDelPedido || null; } catch (e) { problemas.push(ruta + ' no carga: ' + e.message); }
  }

  // 2 · El número armado a mano en las tres apps y el servidor (fuera del bloque de la pieza).
  const aMano = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosDe(carpeta, commits)) {
      let t = leer(r);
      if (t == null) continue;
      t = t.replace(/\r\n/g, '\n');
      if (r === PIEZA_APP || r === PIEZA_ALIADOS) { const b = bloque(t); if (b) t = t.replace(b, ''); }
      for (const u of usosEn(t)) if (u.forma === 'a mano') aMano.push({ archivo: r, renglon: u.renglon, expr: u.expr });
    }
  }

  // 3 · Cada sitio, EJECUTADO con cada id (con la pieza que de verdad importa, si la usa).
  const sitios = [];
  for (const s of SITIOS) {
    const t0 = leer(s.archivo);
    if (t0 == null) { problemas.push('no está ' + s.archivo); continue; }
    const t = t0.replace(/\r\n/g, '\n');
    const usos = usosEn(t);
    const importa = new RegExp("import \\{[^}]*\\bnumeroDelPedido\\b[^}]*\\} from '" + s.desde.replace(/[./]/g, '\\$&') + "';").test(t);
    const usaPieza = usos.some((u) => u.forma === 'pieza');
    if (usaPieza && !importa) problemas.push(s.archivo + ': usa numeroDelPedido sin importarla de ' + s.desde);
    const pieza = importa ? piezas[s.pieza] : null;
    if (usaPieza && typeof pieza !== 'function') problemas.push(s.archivo + ': importa numeroDelPedido de ' + s.pieza + ' y allí no está');
    if (usos.length !== s.cuantos) problemas.push(s.archivo + ': esperaba ' + s.cuantos + ' sitios con el número y hay ' + usos.length);
    usos.forEach((u, k) => {
      sitios.push({
        archivo: s.archivo, orden: k + 1, renglon: u.renglon, forma: u.forma, expr: u.expr, alrededor: u.alrededor,
        numeros: ids.map((id) => ejecutar(u.expr, pieza || (() => 'SIN PIEZA'), id)),
      });
    });
  }

  // 4 · ¿Todos los sitios dan el MISMO número para cada id?
  const distintos = ids.filter((id, k) => new Set(sitios.map((s) => s.numeros[k])).size > 1);

  return {
    commits: commits || 'el disco', problemas, copiasIguales: !!bApp && bApp === bAli, bApp, bAli, piezas,
    aMano, sitios, ids, distintos,
  };
}

/** Careo: el número que sale en cada sitio (por archivo y en orden) y el renglón que lo rodea, antes y ahora. */
function carear(antes, ahora) {
  const diferencias = [];
  const clave = (s) => s.archivo + ' #' + s.orden;
  const mapa = (m) => Object.fromEntries(m.sitios.map((s) => [clave(s), s]));
  const a = mapa(antes);
  const b = mapa(ahora);
  const claves = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  let numeros = 0;
  for (const k of claves) {
    if (!a[k] || !b[k]) { diferencias.push({ sitio: k, que: a[k] ? 'desapareció' : 'es nuevo' }); continue; }
    if (a[k].alrededor !== b[k].alrededor) diferencias.push({ sitio: k, que: 'cambió lo de alrededor', antes: a[k].alrededor, ahora: b[k].alrededor });
    a[k].numeros.forEach((n, i) => {
      numeros += 1;
      if (n !== b[k].numeros[i]) diferencias.push({ sitio: k, que: 'número distinto', id: antes.ids[i], antes: n, ahora: b[k].numeros[i] });
    });
  }
  return { sitios: claves.length, numeros, diferencias };
}

module.exports = { medir, carear, bloque, usosEn, ejecutar, ANTES, PIEZA_APP, PIEZA_ALIADOS, SITIOS, MARCA, CARPETAS, IDS_DE_MENTIRA };

if (require.main === module) {
  (async () => {
    let ids = IDS_DE_MENTIRA;
    if (argumento('--nube')) {
      const { traer } = require('./nube.cjs');
      ids = (await traer('pedidos')).map((d) => (d.name || '').split('/').pop());
      console.log('\n☁️  PRODUCCIÓN: ' + ids.length + ' pedidos leídos (solo el id)');
    }
    const pintar = (titulo, m) => {
      console.log('\n── ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : Object.values(m.commits).join(' / ')) + ')');
      console.log('   Número armado A MANO en las tres apps y el servidor: ' + m.aMano.length);
      for (const l of m.aMano) console.log('     · ' + l.archivo + ':' + l.renglon + '  ' + l.expr);
      console.log('   ¿La pieza está IGUAL letra por letra en la app y en aliados? ' + (m.copiasIguales ? 'sí' : 'no (o no existe)'));
      for (const s of m.sitios) {
        console.log('   ' + (s.archivo.replace(/^guajirago(-aliados)?\/src\//, (x, a) => (a ? 'aliados/' : 'app/')) + ':' + s.renglon).padEnd(34)
          + s.forma.padEnd(7) + ' «' + s.alrededor.slice(0, 70) + '»');
      }
      console.log('   ids con los que algún sitio da un número DISTINTO de los demás: ' + m.distintos.length + ' de ' + m.ids.length);
      if (m.problemas.length) console.log('   ⚠ ' + m.problemas.join('\n   ⚠ '));
    };

    const ahora = medir(null, ids);
    console.log('\n=== ¿QUÉ NÚMERO LLEVA UN PEDIDO? · G94 · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===');
    pintar('AHORA', ahora);
    console.log('   ejemplo: ' + ids.slice(0, 3).map((id, k) => id + ' → ' + (ahora.sitios[0] || { numeros: [] }).numeros[k]).join(' · '));

    if (argumento('--antes')) {
      const antes = medir(ANTES, ids);
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n── CAREO: ' + c.sitios + ' sitios × ' + ids.length + ' ids = ' + c.numeros + ' números comparados · diferencias: ' + c.diferencias.length);
      for (const d of c.diferencias) console.log('   · ' + JSON.stringify(d));
    }

    const ok = ahora.problemas.length === 0 && ahora.aMano.length === 0 && ahora.copiasIguales && ahora.distintos.length === 0
      && ahora.sitios.every((s) => s.forma === 'pieza');
    console.log('\n' + (ok ? '✓ el número del pedido sale de UNA pieza (y su copia atada) en los ' + ahora.sitios.length + ' sitios'
      : '✗ el número del pedido NO sale de una sola pieza'));
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
