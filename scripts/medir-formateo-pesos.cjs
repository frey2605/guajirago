#!/usr/bin/env node
/**
 * MEDIR LOS PESOS ESCRITOS A MANO — en las TRES apps y en el servidor. Solo lee código; no toca nada.
 *
 *   node scripts/medir-formateo-pesos.cjs            <- el informe, archivo por archivo
 *   node scripts/medir-formateo-pesos.cjs --detalle  <- y cada renglón
 *
 * ── EL GEMELO G14 (auditoría del 27-sep-2026) ────────────────────────────────
 * La plata se escribe con UN formateador: `cop()` (guajirago/src/moneda.js, y sus copias atadas en aliados, en el
 * panel y en el servidor, guajirago/functions/moneda.cjs). Pero había decenas de sitios que la escribían a mano:
 *   · `x.toLocaleString()` SIN idioma → usa el del TELÉFONO: en uno en inglés sale «$10,000», en otro «$10.000».
 *   · `'$' + n` o `$${n}` → el signo pegado a mano, cada sitio a su manera.
 *   · `$` suelto en la pantalla seguido de `{n}` → lo mismo, escrito en JSX.
 *   · `n.toLocaleString('es-CO')` a mano, o un `Intl.NumberFormat` propio → una segunda calculadora del mismo texto.
 *
 * ── CÓMO MIRA ────────────────────────────────────────────────────────────────
 * Renglón por renglón, sin comentarios (el `soloCodigo` de medir-ley-boton.cjs, que conserva los renglones), y
 * sabiendo si cada `${` está dentro de una plantilla `...` (eso es código) o fuera de todo texto (eso es JSX: un
 * «$» que se pinta tal cual). Las fechas (`new Date(...).toLocaleString('es-CO')`) no son plata y no se cuentan.
 *
 * ── LO QUE SE QUEDA A MANO, A PROPÓSITO ──────────────────────────────────────
 * `PENDIENTES` lleva, archivo por archivo, cuántos renglones se quedan como están y POR QUÉ. La prueba
 * (pruebas/formateoPesos.test.js) exige que la cuenta de hoy sea EXACTAMENTE esa: si nace uno nuevo se pone roja,
 * y si se arregla uno y nadie baja la cuenta, también. Solo puede bajar, y bajar a la vista.
 */
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ } = require('../pruebas/cargar.cjs');
const { soloCodigo } = require('./medir-ley-boton.cjs');

const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src', 'guajirago/functions'];
// El formateador mismo (y sus copias atadas): ahí SÍ vive el `Intl.NumberFormat`.
const EL_FORMATEADOR = ['moneda.js', 'moneda.cjs'];

// Dónde está cada `${` y cada `$` suelto: dentro de una plantilla, dentro de un texto, o fuera (JSX).
// Recorre el código ya sin comentarios. Una plantilla puede llevar `${ ... }` con código dentro, y ese código
// puede llevar otra plantilla: se lleva una pila.
function signosSueltos(codigo) {
  const out = []; // { linea, tipo: 'jsx' | 'plantilla' }
  const pila = [{ en: 'codigo', hondo: 0 }];
  let linea = 1;
  let q = null; // comilla simple o doble abierta
  for (let i = 0; i < codigo.length; i++) {
    const c = codigo[i];
    const d = codigo[i + 1];
    if (c === '\n') linea++;
    const arriba = pila[pila.length - 1];
    if (q) {
      if (c === '\\') { i++; continue; }
      if (c === q || c === '\n') q = null;
      continue;
    }
    if (arriba.en === 'plantilla') {
      if (c === '\\') { i++; continue; }
      if (c === '`') { pila.pop(); continue; }
      if (c === '$' && d === '{') {
        if (codigo[i - 1] === '$') out.push({ linea, tipo: 'plantilla' });
        pila.push({ en: 'codigo', hondo: 0 });
        i++;
      }
      continue;
    }
    // código
    if (c === "'" || c === '"') { q = c; continue; }
    if (c === '`') { pila.push({ en: 'plantilla' }); continue; }
    if (c === '$' && d === '{' && !/[\w$]/.test(codigo[i - 1] || '')) { out.push({ linea, tipo: 'jsx' }); continue; }
    if (c === '{') arriba.hondo++;
    else if (c === '}') {
      if (arriba.hondo === 0 && pila.length > 1) { pila.pop(); continue; }
      arriba.hondo--;
    }
  }
  return out;
}

const REGLAS = [
  ['sin idioma', /\.toLocaleString\(\s*\)/],
  ['signo pegado', /\$ ?['"]\s*\+/],
  ['es-CO a mano', /\.toLocaleString\(\s*['"]es-CO['"]\s*\)/],
  ['Intl propio', /\bIntl\.NumberFormat\s*\(/],
];
// Una fecha no es plata: `new Date(v).toLocaleString('es-CO')`, `d.toLocaleString('es-CO')`.
const ES_FECHA = /\bDate\b|fecha|\b[df]\.toLocaleString/i;

// Los renglones de UN archivo que escriben pesos a mano: [{ linea, reglas, trozo }].
function revisarArchivo(fuente, nombre = '') {
  const codigo = soloCodigo(fuente.replace(/\r\n/g, '\n'));
  const renglones = codigo.split('\n');
  const por = new Map();
  const apuntar = (linea, regla) => {
    if (!por.has(linea)) por.set(linea, new Set());
    por.get(linea).add(regla);
  };
  renglones.forEach((l, i) => {
    for (const [regla, re] of REGLAS) {
      if (!re.test(l)) continue;
      if (regla === 'es-CO a mano' && ES_FECHA.test(l)) continue;
      if (regla === 'Intl propio' && EL_FORMATEADOR.includes(path.basename(nombre))) continue;
      apuntar(i + 1, regla);
    }
  });
  for (const s of signosSueltos(codigo)) apuntar(s.linea, s.tipo === 'jsx' ? '$ suelto en pantalla' : 'plantilla $${');
  return [...por.entries()].sort((a, b) => a[0] - b[0])
    .map(([linea, reglas]) => ({ linea, reglas: [...reglas], trozo: renglones[linea - 1].trim() }));
}

function archivosDe(carpeta) {
  const dir = path.join(RAIZ, carpeta);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.(c?js)$/.test(d.name) && !d.name.endsWith('.test.js'))
    .map((d) => ({ ruta: carpeta + '/' + d.name, fuente: fs.readFileSync(path.join(dir, d.name), 'utf8') }));
}

// Todo el proyecto: { 'carpeta/X.js': [ … ] } — solo los que tienen algo.
function medir() {
  const out = {};
  for (const c of CARPETAS) {
    for (const a of archivosDe(c)) {
      const r = revisarArchivo(a.fuente, a.ruta);
      if (r.length) out[a.ruta] = r;
    }
  }
  return out;
}

// Lo que se queda a mano, A PROPÓSITO, el día que se cerró G14 (28-sep-2026). SOLO PUEDE BAJAR.
// Los campos donde se TECLEA un precio: el número se enseña con puntos de mil mientras se escribe, y el «$» va
// pintado por FUERA del campo. `cop()` metería el «$ » DENTRO del campo y el cursor saltaría a cada tecla. No es un
// texto de plata que se lee, es una máscara de escritura; se queda con 'es-CO' fijo (no depende del teléfono).
const PENDIENTES = {
  'guajirago-aliados/src/Inventario.js': 2, // máscara: costo unitario y costo del ingreso de inventario
  'guajirago-aliados/src/Menu.js': 2, // máscara: precio del plato y precio de la adición
  'guajirago-aliados/src/Mesero.js': 2, // máscara: propina y monto de cada medio de pago
  'guajirago-aliados/src/PedidosDomicilio.js': 2, // máscara: costo del domicilio y monto de cada medio de pago
  'guajirago-aliados/src/PerfilRestaurante.js': 1, // máscara: costo del domicilio
  'guajirago-aliados/src/Promociones.js': 1, // máscara: valor de la promoción
  'guajirago-aliados/src/Tours.js': 1, // máscara: precio del tour
};

module.exports = { revisarArchivo, signosSueltos, medir, PENDIENTES, CARPETAS };

if (require.main === module) {
  const r = medir();
  const detalle = process.argv.includes('--detalle');
  let total = 0;
  let aProposito = 0;
  for (const c of CARPETAS) {
    const suyos = Object.entries(r).filter(([f]) => f.startsWith(c + '/'));
    const n = suyos.reduce((s, [, x]) => s + x.length, 0);
    console.log(`\n${c}: ${n} renglón(es) que escriben pesos a mano · en ${suyos.length} archivo(s)`);
    for (const [f, x] of suyos) {
      const p = PENDIENTES[f] || 0;
      console.log(`   ${f.slice(c.length + 1).padEnd(30)} ${String(x.length).padStart(3)}${p ? ` (a propósito: ${p})` : ''}${x.length > p ? ' · 🔴 ' + (x.length - p) + ' de más' : ''}`);
      if (detalle) for (const s of x) console.log(`        :${s.linea} [${s.reglas.join(', ')}] ${s.trozo.slice(0, 140)}`);
    }
    total += n;
    aProposito += suyos.reduce((s, [f, x]) => s + Math.min(x.length, PENDIENTES[f] || 0), 0);
  }
  console.log(`\nTOTAL: ${total} renglón(es) a mano · ${aProposito} a propósito (máscaras de campo) · ${total - aProposito} por arreglar`);
}
