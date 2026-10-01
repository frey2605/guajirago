#!/usr/bin/env node
/**
 * P08 · EL CONTADOR DE LAS PROMOCIONES DE RESTAURANTE (`usosPromo`) — SOLO LECTURA
 *
 *   node scripts/medir-contador-promos-restaurante.cjs           <- quién lo escribe en el código (sin red)
 *   node scripts/medir-contador-promos-restaurante.cjs --nube    <- y además qué hay guardado en PRODUCCIÓN
 *
 * La pregunta del pendiente: «el contador de las promociones de restaurante lo escribe el cliente; ¿se lo
 * puede bajar?». Este guion cuenta dos cosas que se pueden recontar:
 *   1. EN EL CÓDIGO: qué archivos de las tres apps y de las funciones nombran la colección `usosPromo`, y en
 *      qué renglones la ESCRIBEN.
 *   2. EN PRODUCCIÓN (--nube): cuántas promociones de restaurante hay guardadas (en `negocios` y en la
 *      carpeta vieja `restaurantes`), cuántas tienen tope por cliente, cuántos contadores `usosPromo` hay
 *      y con qué valores, y cuántos pedidos llevan platos con promoción.
 * Lo que las REGLAS dejan hacer con el contador no se mide aquí leyendo: lo EJECUTA el emulador en
 * `pruebas/reglas.test.js` (bloque «usosPromo · el contador que impide repetir una promoción»).
 * No escribe nada en ningún sitio.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const CARPETAS = ['guajirago/src', 'guajirago/functions', 'guajirago-admin/src', 'guajirago-aliados/src'];
const ESCRIBE = /\b(setDoc|updateDoc|addDoc|deleteDoc|writeBatch|runTransaction)\b|\.(set|update|delete|add|create)\(/;

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

/** Quién nombra y quién escribe la colección `usosPromo`. Función pura sobre {archivo: texto}. */
function quienEscribe(textos) {
  const nombran = [];
  const escriben = [];
  for (const [archivo, texto] of Object.entries(textos)) {
    let lo = false;
    texto.split(/\r?\n/).forEach((r, i) => {
      if (!/['"`]usosPromo['"`/]/.test(r)) return; // el nombre de la COLECCIÓN, no la variable de React
      lo = true;
      if (ESCRIBE.test(r)) escriben.push(archivo + ':' + (i + 1));
    });
    if (lo) nombran.push(archivo);
  }
  return { nombran, escriben };
}

function leerCodigo() {
  const textos = {};
  for (const c of CARPETAS) {
    for (const a of archivos(path.join(RAIZ, c))) {
      textos[path.relative(RAIZ, a).replace(/\\/g, '/')] = fs.readFileSync(a, 'utf8');
    }
  }
  return textos;
}

/** Cuenta lo guardado (documentos ya leídos con nube.doc). */
function contarNube({ negocios, restaurantes, usos, pedidos }) {
  const promos = (lista) => lista.flatMap((n) => (Array.isArray(n.promociones) ? n.promociones : []));
  const pn = promos(negocios);
  const pr = promos(restaurantes);
  return {
    negocios: negocios.length, promosNegocios: pn.length,
    restaurantes: restaurantes.length, promosRestaurantes: pr.length,
    conTope: [...pn, ...pr].filter((p) => p && p.limiteCliente > 0).length,
    usos: usos.length, veces: usos.map((u) => u.veces),
    pedidos: pedidos.length,
    pedidosConPromo: pedidos.filter((p) => Array.isArray(p.items) && p.items.some((i) => i && i.promoId)).length,
  };
}

async function main() {
  const { nombran, escriben } = quienEscribe(leerCodigo());
  console.log('── EN EL CÓDIGO (tres apps + funciones) ──');
  console.log('  nombran la colección usosPromo: ' + nombran.length + (nombran.length ? '  (' + nombran.join(', ') + ')' : ''));
  console.log('  la ESCRIBEN: ' + escriben.length + (escriben.length ? '  (' + escriben.join(', ') + ')' : ''));
  console.log('  ¿la escribe el servidor (functions)?: ' + (escriben.some((e) => e.startsWith('guajirago/functions')) ? 'SÍ' : 'NO'));

  if (process.argv.includes('--nube')) {
    const { traer, doc, tiposQueNoSupe } = require('./nube.cjs');
    const r = contarNube({
      negocios: (await traer('negocios')).map(doc),
      restaurantes: (await traer('restaurantes')).map(doc),
      usos: (await traer('usosPromo')).map(doc),
      pedidos: (await traer('pedidos')).map(doc),
    });
    console.log('\n── PRODUCCIÓN (solo lectura) ──');
    console.log('  negocios: ' + r.negocios + ' · promociones guardadas en ellos: ' + r.promosNegocios);
    console.log('  carpeta vieja restaurantes: ' + r.restaurantes + ' · promociones: ' + r.promosRestaurantes);
    console.log('  promociones con tope por cliente: ' + r.conTope);
    console.log('  contadores usosPromo: ' + r.usos + (r.usos ? ' · valores: ' + JSON.stringify(r.veces) : ''));
    console.log('  pedidos: ' + r.pedidos + ' · con algún plato en promoción: ' + r.pedidosConPromo);
    const raros = tiposQueNoSupe();
    if (raros.length) console.log('  ⚠ tipos de campo que no supe leer: ' + raros.join(', '));
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { quienEscribe, contarNube, leerCodigo };
