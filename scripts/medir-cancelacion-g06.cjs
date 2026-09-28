#!/usr/bin/env node
/**
 * MEDIR LA VENTANITA «¿POR QUÉ CANCELAS?» — gemelo G06 (28-sep-2026).
 *
 *   node scripts/medir-cancelacion-g06.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-cancelacion-g06.cjs --commit <hash>  <- el de otro commit (el careo antes/después)
 *   node scripts/medir-cancelacion-g06.cjs --datos          <- y además cuenta, en PRODUCCIÓN, los motivos guardados
 *
 * ── QUÉ MIDE ────────────────────────────────────────────────────────────────
 * 1. CUÁNTAS VECES está escrita la ventanita en las tres apps: todo archivo de `src/`
 *    que lleve el texto «¿Por qué cancelas?» es una ventanita escrita. Tiene que ser UNA.
 * 2. QUÉ VE CADA PANTALLA que la usa (la del pasajero y la del conductor): se busca de
 *    dónde sale su `ModalCancelacion` (escrita dentro o importada), se saca del archivo
 *    el `style` del botón de cada motivo y se CORRE, con el motivo sin escoger y
 *    escogido. Con el color de la letra y el del fondo (mezclado sobre la tarjeta
 *    blanca si es transparente) se calcula el CONTRASTE, como lo mide la norma WCAG:
 *    por debajo de 4,5 la letra de 14 px no se lee bien; en 1,0 no se ve nada.
 *    Si el estilo llama a una función (`estiloMotivo(...)`), esa función también se
 *    saca del mismo archivo y se corre: no se da nada por supuesto.
 * 3. Con `--datos`, SOLO LECTURA en producción: cuántos viajes canceló un pasajero y
 *    qué motivo quedó escrito. Es el motivo que el dueño lee en el panel.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre React ni un navegador: el color que de verdad pinta la pantalla lo mira
 *     el robot (`robot/cancelar-viaje.cjs`), en pruebas.
 *   · Con `--commit`, solo los archivos de ESTE repo salen de ese commit; los de
 *     guajirago-admin y guajirago-aliados salen del disco (son repos aparte).
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, sinTextos } = require('../pruebas/cargar.cjs');

const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const TITULO = '¿Por qué cancelas?';
const PANTALLAS = [
  { quien: 'pasajero', archivo: 'guajirago/src/Solicitar.js' },
  { quien: 'conductor', archivo: 'guajirago/src/AppConductor.js' },
];
const FONDO_TARJETA = '#FFFFFF';
const CONTRASTE_MINIMO = 4.5;

// ── leer archivos (del disco o de un commit) ─────────────────────────────────
function archivosDe(dir) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  const fuera = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) fuera.push(...archivosDe(dir + '/' + e.name));
    else if (/\.jsx?$/.test(e.name) && !/\.test\.js$/.test(e.name)) fuera.push(dir + '/' + e.name);
  }
  return fuera;
}

function lectorDe(commit) {
  return (ruta) => {
    if (commit && ruta.startsWith('guajirago/')) {
      try {
        return execFileSync('git', ['show', commit + ':' + ruta], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch (e) { return null; }
    }
    const abs = path.join(RAIZ, ruta);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  };
}

function listaDeArchivos(commit) {
  const del = APPS.flatMap(archivosDe).filter((r) => !r.startsWith('guajirago/'));
  if (commit) {
    const git = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'guajirago/src'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').filter((r) => /\.jsx?$/.test(r) && !/\.test\.js$/.test(r));
    return [...git, ...del];
  }
  return [...archivosDe('guajirago/src'), ...del];
}

// ── colores y contraste (WCAG) ───────────────────────────────────────────────
function aRgba(c) {
  const s = String(c).trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16)).concat(1);
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  if (/^(transparent)$/i.test(s)) return [0, 0, 0, 0];
  if (/^white$/i.test(s)) return [255, 255, 255, 1];
  if (/^black$/i.test(s)) return [0, 0, 0, 1];
  return null;
}
const sobre = (arriba, abajo) => [0, 1, 2].map((i) => arriba[i] * arriba[3] + abajo[i] * (1 - arriba[3])).concat(1);
function luz(rgb) {
  const [r, g, b] = rgb.slice(0, 3).map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contraste(letra, fondo) {
  const f = sobre(aRgba(fondo), aRgba(FONDO_TARJETA));
  const l = sobre(aRgba(letra), f);
  const [a, b] = [luz(l), luz(f)].sort((x, y) => y - x);
  return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}

// ── sacar código del archivo ─────────────────────────────────────────────────
/** El texto entre la llave (o paréntesis) que abre en `abre` y la que la cierra, sin contar las de dentro de textos. */
function balanceado(codigo, abre) {
  const seguro = sinTextos(codigo);
  const par = { '{': '}', '(': ')' }[seguro[abre]];
  let hondo = 0;
  for (let i = abre; i < seguro.length; i++) {
    if (seguro[i] === seguro[abre]) hondo++;
    else if (seguro[i] === par && --hondo === 0) return codigo.slice(abre + 1, i);
  }
  return null;
}

/** Una función con nombre, entera, tal como está escrita en el archivo (para poder correrla). */
function funcionEntera(codigo, nombre) {
  const m = new RegExp('(?:^|\\n)(?:export\\s+(?:default\\s+)?)?function\\s+' + nombre + '\\s*\\(').exec(codigo);
  if (!m) return null;
  const ini = codigo.indexOf('function', m.index);
  const parAbre = codigo.indexOf('(', ini);
  const params = balanceado(codigo, parAbre);
  const llave = codigo.indexOf('{', parAbre + params.length + 2);
  const cuerpo = balanceado(codigo, llave);
  return codigo.slice(ini, llave + cuerpo.length + 2);
}

/**
 * El estilo del botón de un motivo, CORRIDO: se busca el `.map(` que pinta los motivos dentro de
 * la ventanita, su `<button` y su `style={...}`, y se evalúa con el motivo sin escoger y escogido.
 */
function estiloDelMotivo(codigo) {
  const ini = codigo.indexOf(TITULO);
  if (ini < 0) return { error: 'no encuentro el título «' + TITULO + '»' };
  const mapa = codigo.indexOf('.map(', ini);
  if (mapa < 0) return { error: 'no encuentro la lista de motivos (.map)' };
  const boton = codigo.indexOf('<button', mapa);
  const style = codigo.indexOf('style={', boton);
  if (boton < 0 || style < 0) return { error: 'no encuentro el botón del motivo o su style' };
  const expr = balanceado(codigo, style + 6);
  if (expr === null) return { error: 'el style del motivo no cierra' };
  // Las funciones que llame el estilo, sacadas del mismo archivo.
  const llamadas = [...new Set([...expr.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map((m) => m[1]))];
  const ayudas = llamadas.map((n) => funcionEntera(codigo, n)).filter(Boolean).join('\n');
  const correr = (escogido) => {
    const razon = 'Motivo de prueba';
    // eslint-disable-next-line no-new-func
    return new Function('razonSeleccionada', 'razon', ayudas + '\nreturn (' + expr + ');')(escogido ? razon : '', razon);
  };
  try {
    const estados = {};
    for (const [nombre, escogido] of [['sin escoger', false], ['escogido', true]]) {
      const s = correr(escogido);
      const fondo = s.background || s.backgroundColor || 'transparent';
      const letra = s.color;
      if (!letra || !aRgba(letra) || !aRgba(fondo)) return { error: 'no sé leer el color «' + letra + '» sobre «' + fondo + '»' };
      estados[nombre] = { letra, fondo, contraste: contraste(letra, fondo) };
    }
    return { estados };
  } catch (e) {
    return { error: 'el estilo no se pudo correr: ' + e.message };
  }
}

// ── de dónde saca cada pantalla su ventanita ─────────────────────────────────
function origenDeLaVentanita(archivo, codigo, leer) {
  if (/(?:^|\n)(?:export\s+(?:default\s+)?)?function\s+ModalCancelacion\s*\(/.test(codigo)) return { ruta: archivo, codigo, propia: true };
  const m = /import\s+(?:ModalCancelacion|\{[^}]*\bModalCancelacion\b[^}]*\})\s+from\s+'(\.[^']+)'/.exec(codigo);
  if (!m) return null;
  const ruta = path.posix.join(path.posix.dirname(archivo), m[1]) + (m[1].endsWith('.js') ? '' : '.js');
  const otro = leer(ruta);
  return otro === null ? null : { ruta, codigo: otro, propia: false };
}

/** Todo el análisis, sobre un lector de archivos y una lista: función pura para que la prueba la alimente con mentiras. */
function analizar(lista, leer) {
  const escritas = lista.filter((r) => { const t = leer(r); return t !== null && t.includes(TITULO); });
  const pantallas = PANTALLAS.map(({ quien, archivo }) => {
    const codigo = leer(archivo);
    if (codigo === null) return { quien, archivo, error: 'no existe' };
    const usos = (codigo.match(/<ModalCancelacion\b/g) || []).length;
    const listas = [...codigo.matchAll(/<ModalCancelacion\b[^\n]*?razones=\{(\w+)\}/g)].map((m) => m[1]);
    const origen = origenDeLaVentanita(archivo, codigo, leer);
    if (!origen) return { quien, archivo, usos, listas, error: 'no sé de dónde sale su ModalCancelacion' };
    const e = estiloDelMotivo(origen.codigo);
    return { quien, archivo, usos, listas, de: origen.ruta, propia: origen.propia, ...e };
  });
  // El veredicto mira el motivo SIN ESCOGER: es como se ven los cinco al abrir la ventanita, y es el fallo de G06.
  // El ESCOGIDO (rojo sobre rosado, en negrilla y con borde) se mide y se enseña, pero no entra: es igual en las dos
  // pantallas, se ve, y cambiar su color es otra decisión (anotada aparte, 28-sep-2026).
  const ilegibles = pantallas.filter((p) => p.error || p.estados['sin escoger'].contraste < CONTRASTE_MINIMO);
  return { escritas, pantallas, ilegibles: ilegibles.map((p) => p.quien) };
}

function medir({ commit } = {}) {
  const leer = lectorDe(commit);
  return analizar(listaDeArchivos(commit), leer);
}

async function medirDatos() {
  const N = require('./nube.cjs');
  const viajes = (await N.traer('viajes')).map(N.doc);
  const delPasajero = viajes.filter((v) => v.canceladoPor === 'pasajero');
  const motivos = {};
  for (const v of delPasajero) { const k = v.razonCancelacion || '(sin motivo)'; motivos[k] = (motivos[k] || 0) + 1; }
  return { total: viajes.length, delPasajero: delPasajero.length, motivos, tiposRaros: N.tiposQueNoSupe() };
}

if (require.main === module) {
  (async () => {
    const i = process.argv.indexOf('--commit');
    const commit = i >= 0 ? process.argv[i + 1] : null;
    const r = medir({ commit });
    console.log('\n🔎 LA VENTANITA «¿POR QUÉ CANCELAS?»' + (commit ? ' — commit ' + commit : ' — el disco de hoy'));
    console.log('\nEscrita en ' + r.escritas.length + ' archivo(s):');
    for (const e of r.escritas) console.log('   · ' + e);
    console.log('\nLo que ve cada pantalla (contraste mínimo para leer: ' + CONTRASTE_MINIMO + '):');
    for (const p of r.pantallas) {
      console.log('   ' + p.quien.toUpperCase() + ' (' + p.archivo + ')' + (p.de ? ' · su ventanita sale de ' + p.de + (p.propia ? ' (escrita dentro)' : ' (importada)') : '')
        + ' · la usa ' + (p.usos || 0) + ' vez/veces con ' + ((p.listas || []).join(', ') || '—'));
      if (p.error) { console.log('      🔴 ' + p.error); continue; }
      for (const [n, s] of Object.entries(p.estados)) {
        console.log('      motivo ' + n.padEnd(12) + ' letra ' + String(s.letra).padEnd(8) + ' sobre ' + String(s.fondo).padEnd(22)
          + ' contraste ' + String(s.contraste).padStart(5) + (s.contraste >= CONTRASTE_MINIMO ? '  ✓'
          : n === 'sin escoger' ? '  🔴 NO SE LEE' : '  ⚠ por debajo de la norma (no entra en el veredicto)'));
      }
    }
    if (process.argv.includes('--datos')) {
      const d = await medirDatos();
      console.log('\nEN PRODUCCIÓN (solo lectura): ' + d.total + ' viajes · ' + d.delPasajero + ' cancelados por el pasajero');
      for (const [k, n] of Object.entries(d.motivos).sort((a, b) => b[1] - a[1])) console.log('   ' + String(n).padStart(3) + '  ' + k);
      if (d.tiposRaros.length) console.log('   ⚠ tipos de campo que no supe leer: ' + d.tiposRaros.join(', '));
    }
    const bien = r.escritas.length === 1 && r.ilegibles.length === 0;
    console.log('\n' + (bien ? '✓ una sola ventanita, y los motivos se leen en las dos pantallas'
      : '🔴 ' + r.escritas.length + ' ventanita(s) escrita(s) · pantallas donde los motivos no se leen: ' + (r.ilegibles.join(', ') || 'ninguna')));
    process.exit(bien ? 0 : 1);
  })().catch((e) => { console.error('🔴 ' + e.message); process.exit(2); });
}

module.exports = { medir, analizar, contraste, aRgba, estiloDelMotivo, CONTRASTE_MINIMO, TITULO };
