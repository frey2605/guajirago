#!/usr/bin/env node
/**
 * ¿CUÁNTO SALDO TIENE EL CONDUCTOR? — gemelo G81 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-saldo-conductor.cjs                 <- el código del disco, con casos de mentira
 *   node scripts/medir-saldo-conductor.cjs --commit <hash>  <- el de otro commit (careo)
 *   node scripts/medir-saldo-conductor.cjs --nube           <- y además las fichas VIVAS de producción
 *
 * El saldo del conductor lo guarda el SERVIDOR en la ficha `usuarios/{uid}` (campo `creditos`):
 * la calculadora buena es la del servidor. El teléfono solo lo ENSEÑA. Pero la app lo sacaba de
 * la ficha escribiendo la misma cuenta a mano en cuatro sitios: dos en AppConductor.js (la
 * lectura al entrar y la escucha en tiempo real) y dos en Creditos.js (al abrir «Mis créditos» y
 * después de recargar). Desde G81 los cuatro llaman a `saldoDe` (guajirago/src/saldoUsuario.js).
 *
 * Qué hace este guion:
 *   1. Saca de cada archivo TODAS las llamadas `setSaldoCreditos(...)` / `setSaldo(...)` que leen
 *      la ficha (`snap`), y las CORRE con fichas de mentira (muchos valores de `creditos`, buenos
 *      y raros). Compara lo que da cada sitio con el código de ANTES (commit f6a60f4): tiene que
 *      dar EXACTAMENTE lo mismo (Object.is), en todos los casos.
 *   2. Cuenta cuántas veces la app escribe `.creditos` a mano fuera de la pieza.
 *   3. Con --nube: pasa cada ficha de producción por los sitios de antes y de ahora, y cuenta
 *      cuántas coinciden. No imprime uids ni nombres: solo cuenta. No escribe nada.
 *
 * Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo } = require('../pruebas/cargar.cjs');

const ANTES = 'f6a60f4'; // el último commit antes de G81
const PIEZA = 'guajirago/src/saldoUsuario.js';
// Los sitios que ENSEÑAN el saldo de la ficha, y cuántas lecturas de la ficha tiene cada uno.
const SITIOS = [
  { archivo: 'guajirago/src/AppConductor.js', setter: 'setSaldoCreditos', lecturas: 2 },
  { archivo: 'guajirago/src/Creditos.js', setter: 'setSaldo', lecturas: 2 },
];

// Valores de `creditos` que se le dan a los sitios: los normales y los raros.
const VALORES = [
  undefined, null, 0, -0, 1, 1000, 5000, 20000, 123456789, -2500, 0.5, 1500.75,
  NaN, Infinity, '', '0', '5000', 'abc', true, false, [], {},
];
const CASOS = [
  ...VALORES.map((v) => ({ nombre: 'creditos = ' + describir(v), ficha: { tipo: 'conductor', nombre: 'Ana', creditos: v } })),
  { nombre: 'ficha sin el campo creditos', ficha: { tipo: 'conductor', nombre: 'Ana' } },
  { nombre: 'ficha vacía', ficha: {} },
];

function describir(v) {
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[]';
  if (v && typeof v === 'object') return '{}';
  if (Object.is(v, -0)) return '-0';
  return String(v);
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? (process.argv[i + 1] || true) : null;
}

/** Lee un archivo de la raíz: del disco, o de un commit. `cambios` pisa lo que haya (pantallas de mentira). */
function lector(commit, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Los argumentos de cada `setter(...)` del texto, contando paréntesis (y saltando los textos entre comillas). */
function argumentosDe(texto, setter) {
  const salida = [];
  const re = new RegExp('\\b' + setter + '\\(', 'g');
  let m;
  while ((m = re.exec(texto))) {
    let i = m.index + m[0].length;
    let nivel = 1;
    const desde = i;
    let comilla = null;
    for (; i < texto.length && nivel > 0; i += 1) {
      const c = texto[i];
      if (comilla) { if (c === '\\') i += 1; else if (c === comilla) comilla = null; continue; }
      if (c === '\'' || c === '"' || c === '`') comilla = c;
      else if (c === '(') nivel += 1;
      else if (c === ')') nivel -= 1;
    }
    salida.push(texto.slice(desde, i - 1).trim());
  }
  return salida;
}

/** Mide un commit (o el disco): qué sitios hay, qué da cada uno con cada caso, y cuántas lecturas a mano quedan. */
function medir(commit, cambios = {}) {
  const leer = lector(commit, cambios);
  const fuentePieza = leer(PIEZA);
  const saldoDe = fuentePieza ? cargarDeLaApp(PIEZA, fuentePieza).saldoDe : undefined;
  const sitios = [];
  const problemas = [];
  for (const s of SITIOS) {
    const texto = leer(s.archivo);
    if (texto == null) { problemas.push('no está ' + s.archivo); continue; }
    const codigo = soloCodigo(texto).replace(/\r\n/g, '\n');
    const lecturas = argumentosDe(codigo, s.setter).filter((a) => /\bsnap\b/.test(a));
    if (lecturas.length !== s.lecturas) {
      problemas.push(s.archivo + ': esperaba ' + s.lecturas + ' lectura(s) de la ficha en ' + s.setter + '(…), hay ' + lecturas.length);
    }
    lecturas.forEach((expr, n) => {
      let fn;
      try {
        // eslint-disable-next-line no-new-func
        fn = new Function('snap', 'saldoDe', 'return (' + expr + ');');
      } catch (e) { problemas.push(s.archivo + ' #' + (n + 1) + ': no se puede correr `' + expr + '`'); return; }
      sitios.push({ id: s.archivo.split('/').pop() + ' #' + (n + 1), expr, correr: (ficha) => fn({ exists: () => ficha != null, data: () => ficha }, saldoDe) });
    });
  }
  // Lecturas de `.creditos` a mano en la app (fuera de la pieza). App.js lee `r.data.creditos`: la RESPUESTA del
  // servidor al regalo de bienvenida, no la ficha; se cuenta aparte para que se vea.
  const aMano = {};
  const carpeta = 'guajirago/src';
  const nombres = commit
    ? execFileSync('git', ['ls-tree', '--name-only', commit, carpeta + '/'], { cwd: RAIZ, encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.js'))
    : fs.readdirSync(path.join(RAIZ, carpeta)).filter((f) => f.endsWith('.js')).map((f) => carpeta + '/' + f);
  for (const r of [...new Set([...nombres, ...Object.keys(cambios).filter((k) => k.startsWith(carpeta + '/'))])]) {
    if (r === PIEZA || r.endsWith('.test.js')) continue;
    const t = leer(r);
    if (t == null) continue;
    const n = (soloCodigo(t).match(/\.creditos\b/g) || []).length;
    if (n) aMano[r] = n;
  }
  return { commit: commit || 'el disco', saldoDe, sitios, problemas, aMano };
}

/** Pasa cada ficha por los sitios de `a` y de `b` (por posición) y cuenta dónde difieren. */
function carear(a, b, fichas) {
  const diferencias = [];
  let comparaciones = 0;
  const n = Math.min(a.sitios.length, b.sitios.length);
  for (const [i, f] of fichas.entries()) {
    for (let k = 0; k < n; k += 1) {
      const va = a.sitios[k].correr(f.ficha);
      const vb = b.sitios[k].correr(f.ficha);
      comparaciones += 1;
      if (!Object.is(va, vb)) diferencias.push({ caso: f.nombre || ('ficha ' + (i + 1)), sitio: b.sitios[k].id, antes: describir(va), ahora: describir(vb) });
    }
  }
  return { comparaciones, diferencias, sitiosDistintos: a.sitios.length !== b.sitios.length };
}

function informe(m) {
  console.log('\n💰 EL SALDO DEL CONDUCTOR · ' + m.commit);
  console.log('   pieza ' + PIEZA + ': ' + (m.saldoDe ? 'existe (saldoDe)' : 'NO existe'));
  for (const s of m.sitios) console.log('   · ' + s.id.padEnd(20) + s.expr);
  const sitiosConPieza = m.sitios.filter((s) => /\bsaldoDe\(/.test(s.expr)).length;
  console.log('   sitios que leen la ficha con la pieza: ' + sitiosConPieza + ' de ' + m.sitios.length);
  const total = Object.values(m.aMano).reduce((x, y) => x + y, 0);
  console.log('   `.creditos` escrito a mano en guajirago/src (fuera de la pieza): ' + total);
  for (const [r, n] of Object.entries(m.aMano)) console.log('      ' + r.padEnd(34) + n + (r.endsWith('/App.js') ? '  (la respuesta del servidor al regalo, no la ficha)' : ''));
  for (const p of m.problemas) console.log('   🔴 ' + p);
}

async function main() {
  const commit = argumento('--commit');
  const ahora = medir(commit === true ? null : commit);
  const antes = medir(ANTES);
  informe(ahora);
  const c = carear(antes, ahora, CASOS);
  console.log('\n🧪 CAREO con ' + ANTES + ' (antes de G81), ' + CASOS.length + ' fichas de mentira × ' + ahora.sitios.length + ' sitios = ' + c.comparaciones + ' comparaciones');
  console.log('   diferentes: ' + c.diferencias.length + (c.sitiosDistintos ? '  🔴 y no tienen los mismos sitios' : ''));
  for (const d of c.diferencias.slice(0, 20)) console.log('   🔴 ' + d.sitio + ' · ' + d.caso + ': antes ' + d.antes + ', ahora ' + d.ahora);

  if (argumento('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const usuarios = (await traer('usuarios')).map(doc);
    const conductores = usuarios.filter((u) => u.tipo === 'conductor');
    const tipos = {};
    for (const u of usuarios) { const t = u.creditos === undefined ? 'sin el campo' : typeof u.creditos; tipos[t] = (tipos[t] || 0) + 1; }
    console.log('\n☁️  PRODUCCIÓN · fichas usuarios/{uid}: ' + usuarios.length + ' · conductores: ' + conductores.length);
    console.log('   qué guarda `creditos`: ' + Object.entries(tipos).map(([t, n]) => t + ' ' + n).join(' · '));
    const suma = (f) => conductores.reduce((x, u) => x + (Number(f(u)) || 0), 0);
    if (ahora.sitios[0]) console.log('   saldo total de los conductores (' + ahora.sitios[0].id + '): ' + suma((u) => ahora.sitios[0].correr(u)) + ' · con el de antes: ' + suma((u) => antes.sitios[0].correr(u)));
    const cn = carear(antes, ahora, usuarios.map((u) => ({ ficha: u })));
    console.log('   careo ficha por ficha y sitio por sitio: ' + (cn.comparaciones - cn.diferencias.length) + ' de ' + cn.comparaciones + ' iguales');
    for (const d of cn.diferencias.slice(0, 20)) console.log('   🔴 ' + d.sitio + ' · ' + d.caso + ': antes ' + d.antes + ', ahora ' + d.ahora);
  }
  console.log('');
}

module.exports = { medir, carear, CASOS, SITIOS, PIEZA, ANTES, argumentosDe };

if (require.main === module) main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
