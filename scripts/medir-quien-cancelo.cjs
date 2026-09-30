#!/usr/bin/env node
/**
 * ¿QUIÉN CANCELÓ EL PEDIDO, Y POR QUÉ? — gemelo G84 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-quien-cancelo.cjs            <- el código del disco, con pedidos de mentira
 *   node scripts/medir-quien-cancelo.cjs --antes    <- y el careo con el código de antes (4372a52 / e80e6b8)
 *   node scripts/medir-quien-cancelo.cjs --nube     <- y además los pedidos CANCELADOS de producción
 *
 * Un pedido cancelado dice quién lo canceló en TRES sitios:
 *   · SEGUIMIENTO — la pantalla del pedido en la app del cliente (guajirago/src/Restaurantes.js, «❌ Cancelado por …»
 *                   y su «Motivo: …»);
 *   · MIS PEDIDOS — la lista de pedidos del cliente (Restaurantes.js, la etiqueta roja de cada tarjeta);
 *   · ALIADOS     — la tarjeta del pedido en el restaurante (guajirago-aliados/src/PedidosDomicilio.js, «❌ … · motivo»).
 * Antes de G84 la app y aliados lo decidían con reglas distintas cuando el pedido NO trae `canceladoPor` (los
 * viejos): la app decía «por ti» salvo que hubiera `motivoRechazo`; aliados decía «por el restaurante» salvo que
 * `canceladoPor` fuera 'cliente'. Desde G84 los tres preguntan a quienCanceloElPedido (estadosPedido.js en la app,
 * copia atada en aliados/flujoPedidos.js).
 *
 * Qué hace: saca de cada archivo el trozo que PINTA quién canceló (y el motivo) y lo CORRE con pedidos de mentira
 * (o los de producción). Cada texto se traduce a QUIÉN dice que canceló: cliente, restaurante o «no dice». No
 * imprime nombres, teléfonos ni direcciones: solo el final del id del pedido y los campos de la cancelación.
 * No escribe nada. Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const ANTES = { raiz: '4372a52', aliados: 'e80e6b8' }; // los últimos commits antes de G84
const PIEZA_APP = 'guajirago/src/estadosPedido.js';
const PIEZA_ALIADOS = 'guajirago-aliados/src/flujoPedidos.js';
const RESTAURANTES = 'guajirago/src/Restaurantes.js';
const ALIADOS = 'guajirago-aliados/src/PedidosDomicilio.js';

const CASOS = [
  { nombre: 'nuevo: lo canceló el cliente, sin motivo todavía', p: { canceladoPor: 'cliente' } },
  { nombre: 'nuevo: lo canceló el cliente y dijo por qué', p: { canceladoPor: 'cliente', motivoCancelacion: 'Se demora mucho' } },
  { nombre: 'nuevo: lo rechazó el restaurante con motivo', p: { canceladoPor: 'restaurante', motivoRechazo: 'Sin gas' } },
  { nombre: 'viejo: sin canceladoPor, con motivo del restaurante', p: { motivoRechazo: 'Cerrado' } },
  { nombre: 'viejo: sin canceladoPor, con motivo del cliente', p: { motivoCancelacion: 'Cancelado por el cliente' } },
  { nombre: 'viejo: sin canceladoPor y sin ningún motivo', p: {} },
  { nombre: 'raro: canceladoPor con un valor que nadie escribe', p: { canceladoPor: 'panel' } },
];

function argumento(nombre) { return process.argv.includes(nombre); }

/** Lee un archivo (ruta desde la raíz): del disco o de un commit de su repo. `cambios` pisa (pantallas de mentira). */
function lector(commits, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    const enAliados = r.startsWith('guajirago-aliados/');
    const commit = commits && (enAliados ? commits.aliados : commits.raiz);
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    const cwd = enAliados ? path.join(RAIZ, 'guajirago-aliados') : RAIZ;
    const rel = enAliados ? r.slice('guajirago-aliados/'.length) : r;
    try {
      return execFileSync('git', ['show', commit + ':' + rel], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Desde `i` (que apunta a un `{` o `(`), hasta su pareja; salta textos entre comillas. */
function pareja(t, i) {
  const abre = t[i];
  const cierra = abre === '{' ? '}' : ')';
  let nivel = 0;
  let comilla = null;
  for (let k = i; k < t.length; k += 1) {
    const c = t[k];
    if (comilla) { if (c === '\\') k += 1; else if (c === comilla) comilla = null; continue; }
    if (c === '\'' || c === '"' || c === '`') comilla = c;
    else if (c === abre) nivel += 1;
    else if (c === cierra) { nivel -= 1; if (nivel === 0) return k; }
  }
  return -1;
}

/** Los hijos de un trozo de JSX: el texto suelto y las expresiones `{…}`, en orden. */
function hijos(seg) {
  const out = [];
  let texto = '';
  for (let k = 0; k < seg.length; k += 1) {
    if (seg[k] !== '{') { texto += seg[k]; continue; }
    const p = pareja(seg, k);
    if (p < 0) return null;
    if (texto) out.push({ texto });
    texto = '';
    out.push({ expr: seg.slice(k + 1, p) });
    k = p;
  }
  if (texto) out.push({ texto });
  return out;
}

function correrCon(nombres, valores, cuerpo) {
  // eslint-disable-next-line no-new-func
  return new Function(...nombres, cuerpo)(...valores);
}

/** Pinta unos hijos de JSX como texto, igual que React: null/false/true/undefined no se ven. */
function pintar(lista, nombres, valores) {
  return lista.map((h) => {
    if (h.texto !== undefined) return h.texto;
    const v = correrCon(nombres, valores, 'return (' + h.expr + ');');
    return v === null || v === undefined || v === false || v === true ? '' : String(v);
  }).join('').replace(/\s+/g, ' ').trim();
}

/** De un texto que se ve, QUIÉN dice que canceló. Solo se mira lo de antes del motivo (« · »): el motivo lo escribe
 *  una persona y puede decir cualquier cosa («Cancelado por el cliente» es el motivo de un pedido de producción). */
function quienDice(texto) {
  const quien = String(texto).split(' · ')[0];
  if (/restaurante/i.test(quien)) return 'restaurante';
  if (/por ti$|por mí$|por el cliente$/i.test(quien)) return 'cliente';
  return 'no dice';
}

/** Mide un par de commits (o el disco): arma los tres sitios como funciones que dan el texto que se ve. */
function medir(commits, cambios = {}) {
  const leer = lector(commits, cambios);
  const problemas = [];
  const pieza = (ruta) => {
    const f = leer(ruta);
    if (f == null) { problemas.push('no está ' + ruta); return {}; }
    try { return cargarDeLaApp(ruta, f); } catch (e) { problemas.push(ruta + ' no carga: ' + e.message); return {}; }
  };
  const pApp = pieza(PIEZA_APP);
  const pAli = pieza(PIEZA_ALIADOS);
  const sitios = {};
  const trozos = {};

  const tr = leer(RESTAURANTES);
  if (tr == null) problemas.push('no está ' + RESTAURANTES);
  const t = tr == null ? '' : tr.replace(/\r\n/g, '\n');
  const importaApp = /import \{[^}]*\bquienCanceloElPedido\b[^}]*\} from '\.\/estadosPedido';/.test(t);

  // ── SEGUIMIENTO ── el bloque `{cancelado ? (` hasta su `) : (`: la línea «❌ …» y, si hay, el «Motivo: …» con su guarda.
  const iS = t.indexOf('{cancelado ? (');
  if (iS < 0 || t.indexOf('{cancelado ? (', iS + 1) >= 0) problemas.push('SEGUIMIENTO: el bloque `{cancelado ? (` no está UNA vez');
  else {
    const fin = pareja(t, iS + '{cancelado ? '.length);
    const bloque = t.slice(iS, fin);
    trozos.seguimiento = bloque;
    const iX = bloque.indexOf('❌');
    const iFinX = bloque.indexOf('</p>', iX);
    const linea = iX < 0 || iFinX < 0 ? null : hijos(bloque.slice(iX, iFinX));
    const iM = bloque.indexOf('Motivo: {');
    let guarda = null; let motivo = null;
    if (iM >= 0) {
      const g = bloque.indexOf('{', iFinX);
      const y = bloque.indexOf('&& (', g);
      guarda = bloque.slice(g + 1, y).trim();
      motivo = bloque.slice(iM + 'Motivo: {'.length, pareja(bloque, iM + 'Motivo: '.length));
    }
    if (!linea) problemas.push('SEGUIMIENTO: no está la línea «❌ …»');
    else if (iM < 0) problemas.push('SEGUIMIENTO: no está el «Motivo: {…}»');
    else {
      sitios.SEGUIMIENTO = (pedido) => {
        const nombres = ['pedidoActivo', ...Object.keys(pApp)];
        const valores = [pedido, ...Object.values(pApp)];
        const texto = pintar(linea, nombres, valores);
        const m = correrCon(nombres, valores, 'return (' + guarda + ');') ? correrCon(nombres, valores, 'return (' + motivo + ');') : null;
        return texto + (m ? ' · Motivo: ' + m : '');
      };
    }
  }

  // ── MIS PEDIDOS ── lo que hay entre `lista.map((p) => {` y su `return (`: calcula `est`, la etiqueta de la tarjeta.
  const iL = t.indexOf('lista.map((p) => {');
  if (iL < 0 || t.indexOf('lista.map((p) => {', iL + 1) >= 0) problemas.push('MIS PEDIDOS: `lista.map((p) => {` no está UNA vez');
  else {
    const cuerpo = t.slice(iL + 'lista.map((p) => {'.length, t.indexOf('return (', iL));
    trozos.misPedidos = cuerpo;
    if (!/\bconst est\b/.test(cuerpo)) problemas.push('MIS PEDIDOS: no está `const est`');
    else {
      sitios['MIS PEDIDOS'] = (pedido) => correrCon(['p', ...Object.keys(pApp)], [pedido, ...Object.values(pApp)], cuerpo + '\nreturn est;');
    }
  }

  // ── ALIADOS ── el bloque `{p.estado === 'cancelado' && (`: la línea «❌ …» entera (quién y motivo).
  const ta = leer(ALIADOS);
  if (ta == null) problemas.push('no está ' + ALIADOS);
  const a = ta == null ? '' : ta.replace(/\r\n/g, '\n');
  const importaAli = /import \{[^}]*\bquienCanceloElPedido\b[^}]*\} from '\.\/flujoPedidos';/.test(a);
  const iA = a.indexOf("{p.estado === 'cancelado' && (");
  if (iA < 0 || a.indexOf("{p.estado === 'cancelado' && (", iA + 1) >= 0) problemas.push("ALIADOS: el bloque `{p.estado === 'cancelado' && (` no está UNA vez");
  else {
    const bloque = a.slice(iA, pareja(a, iA));
    trozos.aliados = bloque;
    const iX = bloque.indexOf('❌');
    const iFinX = bloque.indexOf('</p>', iX);
    const linea = iX < 0 || iFinX < 0 ? null : hijos(bloque.slice(iX, iFinX));
    if (!linea) problemas.push('ALIADOS: no está la línea «❌ …»');
    else sitios.ALIADOS = (pedido) => pintar(linea, ['p', ...Object.keys(pAli)], [pedido, ...Object.values(pAli)]);
  }

  return { commits: commits || 'el disco', sitios, problemas, importaApp, importaAli, trozos, pApp, pAli };
}

/** Lo que ve cada sitio en cada pedido, y QUIÉN dice cada uno que canceló. */
function verCasos(m, casos = CASOS) {
  return casos.map((c) => {
    const vistos = {};
    const quien = {};
    for (const [n, f] of Object.entries(m.sitios)) {
      try { vistos[n] = f({ estado: 'cancelado', ...c.p }); } catch (e) { vistos[n] = 'ERROR: ' + e.message; }
      quien[n] = quienDice(vistos[n]);
    }
    const q = Object.values(quien);
    return { caso: c.nombre, vistos, quien, iguales: q.length === 3 && q.every((x) => x === q[0]) };
  });
}

function carear(antes, ahora, casos = CASOS) {
  const a = verCasos(antes, casos);
  const b = verCasos(ahora, casos);
  const diferencias = [];
  let comparaciones = 0;
  a.forEach((x, i) => {
    for (const s of Object.keys(x.vistos)) {
      comparaciones += 1;
      if (x.vistos[s] !== b[i].vistos[s]) diferencias.push({ caso: x.caso, sitio: s, antes: x.vistos[s], ahora: b[i].vistos[s] });
    }
  });
  return { comparaciones, diferencias };
}

module.exports = { medir, verCasos, carear, quienDice, CASOS, ANTES, PIEZA_APP, PIEZA_ALIADOS, RESTAURANTES, ALIADOS };

if (require.main === module) {
  (async () => {
    const pintarMedida = (titulo, m) => {
      console.log('\n══ ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : m.commits.raiz + ' / ' + m.commits.aliados) + ')');
      if (m.problemas.length) console.log('  🔴 ' + m.problemas.join('\n  🔴 '));
      console.log('  sitios medidos: ' + Object.keys(m.sitios).join(', ') + ' · usan la pieza: app ' + (m.importaApp ? 'sí' : 'no') + ', aliados ' + (m.importaAli ? 'sí' : 'no'));
      const v = verCasos(m);
      for (const x of v) console.log('  ' + (x.iguales ? '✓' : '✗') + ' ' + x.caso + ' → ' + Object.entries(x.vistos).map(([s, tx]) => s + ' «' + tx + '»').join(' · '));
      console.log('  pedidos donde el cliente y el restaurante dicen el MISMO «quién»: ' + v.filter((x) => x.iguales).length + ' de ' + v.length);
    };
    const ahora = medir(null);
    pintarMedida('AHORA', ahora);
    if (argumento('--antes')) {
      const antes = medir(ANTES);
      pintarMedida('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n══ CAREO antes/ahora: ' + c.comparaciones + ' comparaciones, ' + c.diferencias.length + ' distintas');
      for (const d of c.diferencias) console.log('  · ' + d.caso + ' · ' + d.sitio + ': «' + d.antes + '» → «' + d.ahora + '»');
    }
    if (argumento('--nube')) {
      const { traer, doc } = require('./nube.cjs');
      const pedidos = (await traer('pedidos')).map(doc);
      const cancelados = pedidos.filter((p) => p.estado === 'cancelado');
      console.log('\n══ PRODUCCIÓN: ' + pedidos.length + ' pedidos, ' + cancelados.length + ' cancelados');
      const forma = {};
      cancelados.forEach((p) => {
        const k = 'canceladoPor=' + (p.canceladoPor || '(no)') + ' · motivoRechazo ' + (p.motivoRechazo ? 'sí' : 'no') + ' · motivoCancelacion ' + (p.motivoCancelacion ? 'sí' : 'no');
        forma[k] = (forma[k] || 0) + 1;
      });
      for (const [k, n] of Object.entries(forma)) console.log('  ' + n + ' × ' + k);
      console.log('  campos de cancelación en pedidos NO cancelados: ' + pedidos.filter((p) => p.estado !== 'cancelado' && (p.canceladoPor || p.motivoRechazo || p.motivoCancelacion)).length);
      const antes = medir(ANTES);
      const casos = cancelados.map((p) => ({ nombre: '#' + (p.id || '').slice(-5).toUpperCase(), p: { canceladoPor: p.canceladoPor, motivoRechazo: p.motivoRechazo, motivoCancelacion: p.motivoCancelacion } }));
      const va = verCasos(antes, casos);
      const vb = verCasos(ahora, casos);
      let cambian = 0;
      casos.forEach((c, i) => {
        if (JSON.stringify(va[i].vistos) !== JSON.stringify(vb[i].vistos)) cambian += 1;
        console.log('  ' + c.nombre + ': ANTES ' + (va[i].iguales ? '✓' : '✗') + ' ' + Object.entries(va[i].vistos).map(([s, tx]) => s + ' «' + tx + '»').join(' · ')
          + '\n          AHORA ' + (vb[i].iguales ? '✓' : '✗') + ' ' + Object.entries(vb[i].vistos).map(([s, tx]) => s + ' «' + tx + '»').join(' · '));
      });
      console.log('  cancelados donde los tres dicen el mismo «quién»: ANTES ' + va.filter((x) => x.iguales).length + ' de ' + casos.length
        + ' · AHORA ' + vb.filter((x) => x.iguales).length + ' de ' + casos.length + ' · pedidos cuyo texto cambia: ' + cambian);
    }
  })().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
