#!/usr/bin/env node
/**
 * ¿CON QUÉ SE PUEDE PAGAR UN PEDIDO? — gemelo G85 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-metodos-pago.cjs            <- el código del disco
 *   node scripts/medir-metodos-pago.cjs --antes    <- y el careo con el código de antes (a7df44a / d804688 / 0f89437)
 *   node scripts/medir-metodos-pago.cjs --nube     <- y además qué métodos tienen GUARDADOS los pedidos de producción
 *
 * La lista de métodos de pago de un pedido (Efectivo, Nequi, Daviplata, Tarjeta) la ofrecen o la cuentan CUATRO sitios:
 *   · APP · al pedir               — los botones «¿Cómo vas a pagar?» del pedido a domicilio (guajirago/src/Restaurantes.js);
 *   · ALIADOS · cerrar el domicilio — «💳 Cerrar venta» de la tarjeta del pedido (guajirago-aliados/src/PedidosDomicilio.js);
 *   · ALIADOS · cerrar la mesa      — «💳 Cerrar mesa» del mesero, junta o por comensal (guajirago-aliados/src/Mesero.js);
 *   · ALIADOS · corte de caja       — el «por método» del corte (guajirago-aliados/src/CorteCaja.js): lo que no está en la
 *                                    lista cae en «Sin especificar».
 * Antes de G85 la lista estaba escrita a mano en Restaurantes.js, en flujoPedidos.js y CINCO veces dentro de Mesero.js.
 * Desde G85 vive en guajirago/src/estadosPedido.js, con copia letra por letra en guajirago-aliados/src/flujoPedidos.js
 * (otro repo, no puede importarla), y todos la importan.
 *
 * Qué hace: busca en las TRES apps toda lista escrita a mano (un [ … ] con 'Efectivo' y 'Nequi'), y para cada sitio
 * CARGA la lista que de verdad usa (la suya a mano, o la de la pieza que importa, ejecutándola). Con --nube lee los
 * pedidos y cuenta los métodos guardados (`metodoPago`, `pagos[].metodo` y `reparto[].metodoPago`): solo nombres de
 * método y cantidades, nada de clientes. No escribe nada. Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo } = require('../pruebas/cargar.cjs');
const { lector } = require('./medir-conexion-firebase.cjs');

const ANTES = { raiz: 'a7df44a', aliados: 'd804688', admin: '0f89437' }; // los últimos commits antes de G85
const PIEZA_APP = 'guajirago/src/estadosPedido.js';
const PIEZA_ALIADOS = 'guajirago-aliados/src/flujoPedidos.js';
const MARCA = '// ¿CÓMO SE PAGA UN PEDIDO?';
const CARPETAS = ['guajirago/src', 'guajirago-aliados/src', 'guajirago-admin/src'];
const SITIOS = [
  { nombre: 'APP · al pedir', archivo: 'guajirago/src/Restaurantes.js' },
  { nombre: 'ALIADOS · cerrar el domicilio', archivo: 'guajirago-aliados/src/PedidosDomicilio.js' },
  { nombre: 'ALIADOS · cerrar la mesa', archivo: 'guajirago-aliados/src/Mesero.js' },
  { nombre: 'ALIADOS · corte de caja', archivo: 'guajirago-aliados/src/CorteCaja.js' },
];
// 'Mixto' no es un método: es el resumen que guarda aliados cuando se pagó con varios (el detalle va en `pagos`).
const RESUMEN = 'Mixto';

function argumento(nombre) { return process.argv.includes(nombre); }

/** Los .js de una carpeta: del disco, o del commit de su repo. */
function archivosDe(carpeta, commits) {
  const repo = carpeta.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : carpeta.startsWith('guajirago-admin/') ? 'guajirago-admin' : null;
  const commit = commits && (repo === 'guajirago-aliados' ? commits.aliados : repo === 'guajirago-admin' ? commits.admin : commits.raiz);
  if (!commit) return fs.readdirSync(path.join(RAIZ, carpeta)).filter((f) => f.endsWith('.js')).map((f) => carpeta + '/' + f);
  const cwd = repo ? path.join(RAIZ, repo) : RAIZ;
  const dentro = repo ? carpeta.slice(repo.length + 1) : carpeta;
  const salida = execFileSync('git', ['ls-tree', '--name-only', commit, dentro + '/'], { cwd, encoding: 'utf8' });
  return salida.split('\n').filter((f) => f.endsWith('.js')).map((f) => (repo ? repo + '/' : '') + f);
}

/** El bloque de la pieza: desde su comentario hasta el final del renglón `export const METODOS_PAGO = …;`. */
function bloque(texto) {
  if (texto == null) return null;
  const t = texto.replace(/\r\n/g, '\n');
  const i = t.indexOf(MARCA);
  if (i < 0 || t.indexOf(MARCA, i + 1) >= 0) return null;
  const e = t.indexOf('export const METODOS_PAGO', i);
  if (e < 0) return null;
  const j = t.indexOf('\n', e);
  return t.slice(i, j < 0 ? t.length : j);
}

/** Las listas de métodos escritas a mano en un texto: un [ … ] (sin corchetes dentro) con 'Efectivo' y 'Nequi'. */
function listasEn(texto) {
  // Sin comentarios, pero con los MISMOS renglones (para que el número de renglón sea el del archivo).
  const t = soloCodigo(texto.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' ')));
  const out = [];
  for (const m of t.matchAll(/\[[^[\]]*\]/g)) {
    if (/['"`]efectivo['"`]/i.test(m[0]) && /['"`]nequi['"`]/i.test(m[0])) {
      out.push({ texto: m[0], renglon: t.slice(0, m.index).split('\n').length });
    }
  }
  return out;
}

/** Un literal de lista, EJECUTADO (no leído a ojo). */
function evaluar(literal) {
  // eslint-disable-next-line no-new-func
  return new Function('return (' + literal + ');')();
}

/**
 * Mide un estado del código. `commits` = null (el disco) o { raiz, aliados, admin }; `cambios` pisa archivos
 * (pantallas de mentira para la prueba).
 */
function medir(commits, cambios = {}) {
  const base = lector(commits || {});
  const leer = (r) => (Object.prototype.hasOwnProperty.call(cambios, r) ? cambios[r] : base(r));
  const problemas = [];

  // 1 · La pieza y su copia.
  const bApp = bloque(leer(PIEZA_APP));
  const bAli = bloque(leer(PIEZA_ALIADOS));
  const pieza = {};
  for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
    const t = leer(ruta);
    if (t == null) { problemas.push('no está ' + ruta); continue; }
    try { pieza[ruta] = cargarDeLaApp(ruta, t).METODOS_PAGO || null; } catch (e) { problemas.push(ruta + ' no carga: ' + e.message); }
  }

  // 2 · Las listas escritas a mano en las TRES apps (fuera del bloque de la pieza).
  const aMano = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosDe(carpeta, commits)) {
      let t = leer(r);
      if (t == null) continue;
      t = t.replace(/\r\n/g, '\n');
      if (r === PIEZA_APP || r === PIEZA_ALIADOS) { const b = bloque(t); if (b) t = t.replace(b, ''); }
      for (const l of listasEn(t)) aMano.push({ archivo: r, renglon: l.renglon, texto: l.texto });
    }
  }

  // 3 · La lista que USA cada sitio, cargada: las suyas a mano y, si nombra METODOS_PAGO, la de donde venga.
  const sitios = {};
  for (const s of SITIOS) {
    const t0 = leer(s.archivo);
    if (t0 == null) { problemas.push('no está ' + s.archivo); continue; }
    const t = soloCodigo(t0.replace(/\r\n/g, '\n'));
    const listas = listasEn(t).map((l) => evaluar(l.texto));
    let origen = 'a mano';
    const imp = t.match(/import \{[^}]*\bMETODOS_PAGO\b[^}]*\} from '\.\/([A-Za-z0-9_]+)';/);
    const usa = (t.match(/\bMETODOS_PAGO\b/g) || []).length;
    if (imp) {
      const de = path.posix.dirname(s.archivo) + '/' + imp[1] + '.js';
      const texto = leer(de);
      let v = null;
      try { v = texto == null ? null : cargarDeLaApp(de, texto).METODOS_PAGO; } catch (e) { v = null; }
      if (!Array.isArray(v)) problemas.push(s.nombre + ': importa METODOS_PAGO de ' + de + ' y allí no está');
      else listas.push(v);
      origen = de;
      if (usa < 2) problemas.push(s.nombre + ': importa METODOS_PAGO y no la usa');
    } else if (usa && !/const METODOS_PAGO\s*=/.test(t)) {
      problemas.push(s.nombre + ': nombra METODOS_PAGO sin importarla ni escribirla');
    }
    const distintas = [...new Set(listas.map((l) => JSON.stringify(l)))];
    if (distintas.length === 0) problemas.push(s.nombre + ': no encuentro qué lista de métodos usa');
    sitios[s.nombre] = { archivo: s.archivo, origen, listas: distintas.map((x) => JSON.parse(x)), usosDeLaPieza: imp ? usa - 1 : 0 };
  }

  // 4 · El panel: ¿nombra los métodos de pago de un pedido? (si sí, habría que atarlo)
  const panel = [];
  for (const r of archivosDe('guajirago-admin/src', commits)) {
    const t = leer(r);
    if (t && /\bmetodoPago\b|METODOS_PAGO/.test(soloCodigo(t))) panel.push(r);
  }

  const todas = [...new Set(Object.values(sitios).flatMap((x) => x.listas.map((l) => JSON.stringify(l))))];
  return {
    commits: commits || 'el disco', problemas, pieza, copiasIguales: !!bApp && bApp === bAli, bApp, bAli,
    aMano, sitios, panel, listasDistintas: todas.map((x) => JSON.parse(x)),
  };
}

/** Careo: la lista que ofrece cada sitio, antes y ahora. */
function carear(antes, ahora) {
  const diferencias = [];
  const nombres = SITIOS.map((s) => s.nombre);
  for (const n of nombres) {
    const a = JSON.stringify((antes.sitios[n] || {}).listas);
    const b = JSON.stringify((ahora.sitios[n] || {}).listas);
    if (a !== b) diferencias.push({ sitio: n, antes: a, ahora: b });
  }
  return { comparaciones: nombres.length, diferencias };
}

/** Cuenta los métodos guardados en unos pedidos (ya leídos con nube.doc) contra una lista. */
function contarGuardados(pedidos, lista) {
  const cuenta = {};
  const sumar = (campo, v, tipo) => {
    const nombre = v === undefined || v === null || v === '' ? '(sin método)' : String(v);
    const k = campo + ' · ' + nombre;
    if (!cuenta[k]) {
      cuenta[k] = {
        campo, valor: nombre, pedidos: 0, tipos: {},
        clase: lista.includes(nombre) ? 'en la lista' : nombre === RESUMEN ? 'resumen (Mixto)' : nombre === '(sin método)' ? 'sin método' : 'FUERA DE LA LISTA',
      };
    }
    cuenta[k].pedidos += 1;
    cuenta[k].tipos[tipo] = (cuenta[k].tipos[tipo] || 0) + 1;
  };
  for (const p of pedidos) {
    const tipo = p.tipo || '(sin tipo)';
    if ('metodoPago' in p || p.estado === 'cerrado') sumar('metodoPago', p.metodoPago, tipo);
    for (const pg of Array.isArray(p.pagos) ? p.pagos : []) sumar('pagos[].metodo', pg && pg.metodo, tipo);
    for (const c of Array.isArray(p.reparto) ? p.reparto : []) if (c && c.metodoPago) sumar('reparto[].metodoPago', c.metodoPago, tipo);
  }
  const filas = Object.values(cuenta).sort((a, b) => a.campo.localeCompare(b.campo) || b.pedidos - a.pedidos);
  // «Mixto» sin su detalle en `pagos` (y sin estar el detalle en otro pedido de la mesa) cae en «Sin especificar».
  const mixtoSinDetalle = pedidos.filter((p) => p.metodoPago === RESUMEN && !(Array.isArray(p.pagos) && p.pagos.length) && !p.pagosEnOtro).length;
  return { filas, fuera: filas.filter((f) => f.clase === 'FUERA DE LA LISTA'), mixtoSinDetalle };
}

module.exports = { medir, carear, contarGuardados, bloque, listasEn, ANTES, PIEZA_APP, PIEZA_ALIADOS, SITIOS, MARCA, CARPETAS };

if (require.main === module) {
  (async () => {
    const pintar = (titulo, m) => {
      console.log('\n── ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : Object.values(m.commits).join(' / ')) + ')');
      console.log('   Listas escritas a mano (fuera de la pieza): ' + m.aMano.length);
      for (const l of m.aMano) console.log('     · ' + l.archivo + ':' + l.renglon + '  ' + l.texto);
      console.log('   La pieza en la app (' + PIEZA_APP + '): ' + JSON.stringify(m.pieza[PIEZA_APP] || null));
      console.log('   La copia en aliados (' + PIEZA_ALIADOS + '): ' + JSON.stringify(m.pieza[PIEZA_ALIADOS] || null));
      console.log('   ¿El bloque es IGUAL letra por letra en los dos? ' + (m.copiasIguales ? 'sí' : 'no (o no existe)'));
      for (const [n, s] of Object.entries(m.sitios)) {
        console.log('   ' + n.padEnd(32) + ' ofrece ' + s.listas.map((l) => JSON.stringify(l)).join(' y ') + '  ← ' + s.origen);
      }
      console.log('   ¿Los cuatro sitios ofrecen la MISMA lista? ' + (m.listasDistintas.length === 1 ? 'sí' : 'NO (' + m.listasDistintas.length + ' listas)'));
      console.log('   El panel nombra métodos de pago de un pedido en: ' + (m.panel.length ? m.panel.join(', ') : 'ningún archivo'));
      if (m.problemas.length) console.log('   ⚠ ' + m.problemas.join('\n   ⚠ '));
    };

    const ahora = medir(null);
    console.log('\n=== ¿CON QUÉ SE PUEDE PAGAR UN PEDIDO? · G85 · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===');
    pintar('AHORA', ahora);

    if (argumento('--antes')) {
      const antes = medir(ANTES);
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n── CAREO: ' + c.comparaciones + ' sitios comparados, ' + c.diferencias.length + ' ofrecen algo distinto');
      for (const d of c.diferencias) console.log('   · ' + d.sitio + ': antes ' + d.antes + ' · ahora ' + d.ahora);
    }

    if (argumento('--nube')) {
      const { traer, doc, tiposQueNoSupe } = require('./nube.cjs');
      const pedidos = (await traer('pedidos')).map(doc);
      const lista = ahora.pieza[PIEZA_APP] || ahora.pieza[PIEZA_ALIADOS] || (ahora.listasDistintas[0] || []);
      const r = contarGuardados(pedidos, lista);
      console.log('\n── PRODUCCIÓN: ' + pedidos.length + ' pedidos leídos (contra la lista ' + JSON.stringify(lista) + ')');
      for (const f of r.filas) {
        console.log('   ' + (f.campo + ' = «' + f.valor + '»').padEnd(40) + String(f.pedidos).padStart(4) + '  ' + f.clase
          + '  ' + Object.entries(f.tipos).map(([t, n]) => t + ':' + n).join(' '));
      }
      console.log('   Valores guardados FUERA de la lista (saldrían en «Sin especificar» del corte de caja): ' + r.fuera.length);
      console.log('   Pedidos «Mixto» sin su detalle en pagos: ' + r.mixtoSinDetalle);
      if (tiposQueNoSupe().length) console.log('   ⚠ tipos de campo que no supe leer: ' + tiposQueNoSupe().join(', '));
    }

    const ok = ahora.problemas.length === 0 && ahora.aMano.length === 0 && ahora.copiasIguales && ahora.listasDistintas.length === 1;
    console.log('\n' + (ok ? '✓ una sola lista de métodos de pago, en la pieza y su copia atada' : '✗ la lista de métodos de pago NO sale de una sola pieza'));
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
