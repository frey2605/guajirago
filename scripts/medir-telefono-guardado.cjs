#!/usr/bin/env node
/**
 * 📞 ¿EN QUÉ FORMATO ESTÁN GUARDADOS LOS TELÉFONOS? — gemelo G42 (28-sep-2026). SOLO LECTURA.
 *
 * Qué cuenta, contra Firestore VIVO (producción):
 *   1. Cada campo de teléfono que escriben las tres apps, agrupado por su FORMA: cada cifra se cambia por «9»,
 *      así «300 123 4567» sale «999 999 9999» y «+573001234567» sale «+57999…». Dice cuántos están ya en el
 *      formato único (10 cifras limpias) y cuántos NO sirven (ni siquiera con la regla de telefonoValido.js).
 *      No enseña ningún número.
 *   2. EL CRÉDITO DE BIENVENIDA: números de registro (`usuarios.celular`) que son el MISMO número (las mismas
 *      10 cifras) escrito distinto en dos fichas. La comparación letra por letra no los ve como repetidos.
 *   3. Con el servidor de ESTE código (guajirago/functions/telefonoValido.cjs, si existe): cuántos `celular`
 *      guardados alcanza la búsqueda por las 10 cifras de `celularDisponible`, y cuáles quedan fuera
 *      (se anotan para el dueño; NO se migran).
 *
 *   4. EL CÓDIGO: saca `celularDisponible` de guajirago/functions/index.js y lo CORRE con fichas de mentira
 *      (el mismo número escrito de varias maneras). Con `--commit <hash>` corre el de ese commit: así se carea
 *      el de antes con el de ahora. Esta parte no necesita red.
 *
 * Uso:  node scripts/medir-telefono-guardado.cjs [--commit <hash>] [--solo-codigo]
 * No escribe nada. Usa la casa común de datos (scripts/nube.cjs).
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cargarDeLaApp, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const { celularDiezCifras } = cargarDeLaApp('guajirago/src/telefonoValido.js');

// La forma de un texto: cada cifra → «9» y cada letra → «x». Así se agrupan sin enseñar ningún dato
// (un campo de teléfono puede tener guardado hasta un correo: medido el 28-sep-2026).
const forma = (v) => String(v).replace(/\d/g, '9').replace(/[^\d\s()+.\-@_9]/g, 'x');

function contarFormas(valores) {
  const formas = {};
  let limpias = 0, noSirven = 0, total = 0;
  for (const v of valores) {
    if (v == null || v === '') continue;
    total++;
    const f = forma(v);
    formas[f] = (formas[f] || 0) + 1;
    if (/^\d{10}$/.test(String(v))) limpias++;
    if (!celularDiezCifras(v)) noSirven++;
  }
  return { total, limpias, noSirven, formas };
}

// Números de registro (10 cifras) que están escritos de más de una manera en `celular`.
function repetidosEscritosDistinto(usuarios) {
  const porNumero = {};
  for (const u of usuarios) {
    const d = celularDiezCifras(u.celular);
    if (!d) continue;
    (porNumero[d] = porNumero[d] || new Set()).add(String(u.celular).trim());
  }
  return Object.values(porNumero).filter((s) => s.size > 1).length;
}

// ¿La búsqueda del servidor de ESTE código alcanza este texto guardado? null si el servidor compara letra por letra.
function alcanceDelServidor() {
  const ruta = path.join(RAIZ, 'guajirago/functions/telefonoValido.cjs');
  if (!fs.existsSync(ruta)) return null;
  delete require.cache[require.resolve(ruta)];
  const { celularDiezCifras: diezServidor, formasGuardadas } = require(ruta);
  return (texto) => {
    const d = diezServidor(texto);
    return !!d && formasGuardadas(d).includes(String(texto));
  };
}

// ── 4. EL CÓDIGO: `celularDisponible` sacado del archivo y corrido ──────────────────────────────────────────
// Base de mentira: solo lo que usa la función (collection → where → limit → get), con `==` e `in`.
function baseDeMentira(fichas) {
  const consulta = (filtro) => ({
    where: (campo, op, valor) => {
      if (op === 'in' && (!Array.isArray(valor) || valor.length > 30)) throw new Error('Firestore no acepta ese «in» (máx. 30)');
      if (op !== '==' && op !== 'in') throw new Error('operador no esperado: ' + op);
      const casa = op === 'in' ? (v) => valor.includes(v) : (v) => v === valor;
      return consulta((f) => filtro(f) && casa(f[campo]));
    },
    limit: (n) => ({ get: async () => ({ docs: fichas.filter(filtro).slice(0, n).map((f) => ({ id: f.id })) }) }),
  });
  return { firestore: () => ({ collection: () => consulta(() => true) }) };
}

// Devuelve `(fichas, celular, uid) => respuesta` con el `celularDisponible` del texto de index.js que se le dé.
function celularDisponibleDe(fuenteIndex) {
  const desde = fuenteIndex.indexOf('exports.celularDisponible = ');
  if (desde < 0) throw new Error('no está `exports.celularDisponible` en index.js');
  const cuerpo = cuerpoDeLaFuncion(fuenteIndex, desde);
  if (!cuerpo) throw new Error('no pude sacar el cuerpo de celularDisponible');
  const rutaPieza = path.join(RAIZ, 'guajirago/functions/telefonoValido.cjs');
  const pieza = fs.existsSync(rutaPieza) ? require(rutaPieza) : {};
  class HttpsError extends Error { constructor(codigo, texto) { super(texto); this.code = codigo; } }
  // eslint-disable-next-line no-new-func
  const f = new Function('request', 'ambito', 'with (ambito) { return (async () => {' + cuerpo.texto + '\n})(); }');
  return async (fichas, celular, uid = 'nuevo') => {
    try {
      const r = await f({ auth: { uid }, data: { celular } }, { ...pieza, admin: baseDeMentira(fichas), HttpsError });
      return r.disponible ? 'SÍ disponible' : 'NO disponible';
    } catch (e) { return 'rechaza (' + (e.code || e.message) + ')'; }
  };
}

// Los casos: el mismo número escrito de maneras distintas. Lo correcto está al lado.
const CASOS = [
  ['guardado «300 123 4567» (de otro) · se registra «3001234567»', [{ id: 'otro', celular: '300 123 4567' }], '3001234567', 'NO disponible'],
  ['guardado «3001234567» (de otro) · se registra «+57 300 123 4567»', [{ id: 'otro', celular: '3001234567' }], '+57 300 123 4567', 'NO disponible'],
  ['guardado «+573001234567» (de otro) · se registra «3001234567»', [{ id: 'otro', celular: '+573001234567' }], '3001234567', 'NO disponible'],
  ['guardado «3001234567» (de otro) · se registra «3001234567»', [{ id: 'otro', celular: '3001234567' }], '3001234567', 'NO disponible'],
  ['guardado «3001234567» (SU PROPIA ficha) · reintenta «300 123 4567»', [{ id: 'nuevo', celular: '3001234567' }], '300 123 4567', 'SÍ disponible'],
  ['nadie lo tiene · se registra «3009998888»', [{ id: 'otro', celular: '3001234567' }], '3009998888', 'SÍ disponible'],
];

async function medirCodigo(commit) {
  const fuente = commit
    ? execFileSync('git', ['show', commit + ':guajirago/functions/index.js'], { cwd: RAIZ, encoding: 'utf8' })
    : fs.readFileSync(path.join(RAIZ, 'guajirago/functions/index.js'), 'utf8');
  const correr = celularDisponibleDe(fuente);
  console.log('\n🧪 celularDisponible ' + (commit ? 'del commit ' + commit : 'de este código') + ', corrido con fichas de mentira:');
  let malos = 0;
  for (const [nombre, fichas, celular, bueno] of CASOS) {
    // eslint-disable-next-line no-await-in-loop
    const sale = await correr(fichas, celular);
    if (sale !== bueno) malos++;
    console.log('   ' + (sale === bueno ? '✓' : '✗') + ' ' + nombre + ' → ' + sale + (sale === bueno ? '' : '   (lo correcto: ' + bueno + ')'));
  }
  console.log('   casos que contestan mal: ' + malos + ' de ' + CASOS.length);
  return malos;
}

async function main() {
  const arg = process.argv.slice(2);
  const i = arg.indexOf('--commit');
  await medirCodigo(i >= 0 ? arg[i + 1] : null);
  if (arg.includes('--solo-codigo')) return;

  const { traer, doc } = require('./nube.cjs');
  const nombres = ['usuarios', 'pedidos', 'reservasTurismo', 'negocios', 'negociosPrivado', 'viajes'];
  const [usuarios, pedidos, reservas, negocios, privados, viajes] = (await Promise.all(nombres.map((c) => traer(c))))
    .map((l) => l.map(doc));

  const campos = [
    ['usuarios.celular (registro; lo mira el crédito de bienvenida)', usuarios.map((u) => u.celular)],
    ['usuarios.telefono (Mi perfil, alta del conductor, panel)', usuarios.map((u) => u.telefono)],
    ['usuarios.contactoConfianzaNumero (contacto de emergencia)', usuarios.map((u) => u.contactoConfianzaNumero)],
    ['pedidos.telefono (domicilio de restaurante)', pedidos.map((p) => p.telefono)],
    ['reservasTurismo.telefono (reserva de tour)', reservas.map((r) => r.telefono)],
    ['negocios.duenoTelefono (registro de aliados)', negocios.map((n) => n.duenoTelefono)],
    ['negociosPrivado.duenoTelefono (registro de aliados)', privados.map((n) => n.duenoTelefono)],
    ['negocios.telefono (perfil de la agencia)', negocios.map((n) => n.telefono)],
    ['viajes.mensajeria.recibeTel (mandado)', viajes.map((v) => (v.mensajeria || {}).recibeTel)],
  ];

  console.log('\n📞 TELÉFONOS GUARDADOS, POR FORMA (cada cifra = 9) — producción, solo lectura\n');
  let totalTodo = 0, limpiasTodo = 0, noSirvenTodo = 0;
  for (const [nombre, valores] of campos) {
    const c = contarFormas(valores);
    totalTodo += c.total; limpiasTodo += c.limpias; noSirvenTodo += c.noSirven;
    console.log('  ' + nombre + ': ' + c.total + ' con dato · ' + c.limpias + ' en 10 cifras limpias · ' + c.noSirven + ' que no sirven');
    for (const [f, n] of Object.entries(c.formas).sort((a, b) => b[1] - a[1])) console.log('       «' + f + '» × ' + n);
  }
  console.log('\n  EN TOTAL: ' + totalTodo + ' teléfonos guardados · ' + limpiasTodo + ' ya en 10 cifras limpias · '
    + (totalTodo - limpiasTodo) + ' en otra forma · ' + noSirvenTodo + ' que no sirven');

  const rep = repetidosEscritosDistinto(usuarios);
  console.log('\n🎁 CRÉDITO DE BIENVENIDA: números de registro repetidos escritos distinto en dos fichas: ' + rep);

  const alcanza = alcanceDelServidor();
  const conCelular = usuarios.filter((u) => u.celular);
  if (!alcanza) {
    console.log('\n🔎 El servidor de este código compara letra por letra (no hay functions/telefonoValido.cjs): solo alcanza'
      + ' el celular escrito EXACTAMENTE igual.');
  } else {
    const fuera = conCelular.filter((u) => !alcanza(u.celular));
    console.log('\n🔎 Con el servidor de este código: la búsqueda por las 10 cifras alcanza ' + (conCelular.length - fuera.length)
      + ' de ' + conCelular.length + ' celulares de registro; ' + fuera.length + ' quedan fuera');
    for (const u of fuera) console.log('       fuera: forma «' + forma(u.celular) + '»' + (celularDiezCifras(u.celular) ? '' : ' (no sirve como número)'));
  }
  console.log('');
}

module.exports = { forma, contarFormas, repetidosEscritosDistinto, celularDisponibleDe, baseDeMentira, CASOS };

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
