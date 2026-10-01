#!/usr/bin/env node
/**
 * ¿PUEDE ALGUIEN CAMBIARSE EL `celular` DE SU FICHA? — pendiente P07 (30-sep-2026), hijo de P06. SOLO LEE.
 *
 *   node scripts/medir-celular-congelado.cjs                    → las reglas del repo + producción
 *   node scripts/medir-celular-congelado.cjs --sin-red          → no lee la base
 *   node scripts/medir-celular-congelado.cjs --reglas-vivas <archivo>
 *        → además compara el `firestore.rules` del repo con uno bajado del servidor
 *          (`node scripts/bajar-reglas.cjs guajirago <archivo>`), sin mirar los finales de línea.
 *   node scripts/medir-celular-congelado.cjs --careo <commit>   → CAREO en el emulador (hay que correrlo dentro de
 *        `npx firebase-tools@15 emulators:exec --only firestore --project demo-guajirago "..."`): las MISMAS
 *        escrituras, persona por persona, con las reglas de ese commit y con las del disco, una al lado de la otra.
 *
 * `usuarios/{uid}.celular` es el número con que la persona se REGISTRÓ (Login.js lo escribe al crear la ficha;
 * «Mi perfil» cambia `telefono`, que es otro campo — G08). El servidor lo usa para que el regalo de bienvenida vaya
 * una vez por número (`celularDisponible` le dice «ocupado» a quien se registre con un número que ya tiene otra
 * ficha; P06). Hasta P07 las reglas dejaban que el dueño de la ficha lo cambiara: alguien podía ponerse ahí el número
 * de otra persona y esa persona ya no podía registrarse. Este guion cuenta:
 *   · EN LAS REGLAS: si `celular` está entre los campos que el dueño no puede cambiar (`camposCongelados`) y si el
 *     alta de la ficha exige la forma de 10 cifras;
 *   · EN PRODUCCIÓN: cuántas fichas tienen `celular`, cuántas en 10 cifras limpias, cuántas en otra forma y cuántos
 *     números están en más de una ficha;
 *   · EN EL CAREO: qué escrituras pasan de permitidas a negadas, y que las de la app sigan igual.
 *
 * Quién ESCRIBE `celular` en el código de las tres apps y de las funciones ya lo cuenta y lo vigila
 * pruebas/telefonoFicha.test.js («`celular` no lo escribe nadie más que el registro», G08); aquí no se cuenta otra vez.
 *
 * No escribe nada en ninguna base de verdad (el careo escribe en el emulador, que es de mentira).
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const REGLAS = path.join(RAIZ, 'firestore.rules');

const normal = (t) => String(t).replace(/\r\n/g, '\n');

/** El bloque `match /usuarios/{userId} { ... }` de un texto de reglas (contando llaves). */
function bloqueUsuarios(reglas) {
  const t = normal(reglas);
  const i = t.indexOf('match /usuarios/{userId} {');
  if (i < 0) return '';
  let n = 0;
  for (let j = t.indexOf('{', i + 'match /usuarios/{userId} '.length - 1); j < t.length; j++) {
    if (t[j] === '{') n++;
    else if (t[j] === '}') { n--; if (n === 0) return t.slice(i, j + 1); }
  }
  return '';
}

/** Lo que vale para el código, sin los comentarios `//` de las reglas. */
const sinComentarios = (t) => normal(t).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

/** La lista que devuelve una función de reglas `function nombre() { return [ ... ]; }`. */
function listaDe(bloque, nombre) {
  const m = sinComentarios(bloque).match(new RegExp('function ' + nombre + '\\(\\)\\s*\\{\\s*return\\s*\\[([^\\]]*)\\]'));
  if (!m) return null;
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/** La expresión con que las reglas dicen qué forma tiene el `celular` del registro (o null si no la piden). */
function formaDelCelular(reglas) {
  const b = sinComentarios(bloqueUsuarios(reglas));
  const m = b.match(/function celularDelRegistro\(\)\s*\{[\s\S]*?\.celular\.matches\('([^']+)'\)/);
  return m ? m[1] : null;
}

/** ¿El alta del dueño PIDE `celularDelRegistro()`? (dentro del `allow create` del dueño, no en cualquier sitio). */
function altaPideLaForma(reglas) {
  const b = sinComentarios(bloqueUsuarios(reglas));
  const i = b.indexOf('allow create: if request.auth != null');
  if (i < 0) return false;
  const fin = b.indexOf(';', i);
  return /celularDelRegistro\(\)/.test(b.slice(i, fin));
}

/** Lo que dicen las reglas de `celular`. FUNCIÓN PURA sobre el texto. */
function queDicenLasReglas(reglas) {
  const b = bloqueUsuarios(reglas);
  const congelados = listaDe(b, 'camposCongelados') || [];
  // ¿El update del dueño mira de verdad `camposCongelados()`?
  const upd = sinComentarios(b);
  const iu = upd.indexOf('allow update: if request.auth != null');
  const usaCongelados = iu >= 0 && /camposCongelados\(\)/.test(upd.slice(iu, upd.indexOf(';', iu)));
  return {
    celularCongelado: congelados.includes('celular') && usaCongelados,
    forma: formaDelCelular(reglas),
    altaPideLaForma: altaPideLaForma(reglas),
  };
}

// ── EL CAREO: personas y escrituras ──────────────────────────────────────────
// Antes de cada escritura la base se deja así (saltándose las reglas):
const SIEMBRA = {
  'usuarios/ana': { nombre: 'Ana', email: 'ana@ejemplo.com', celular: '3001112233', tipo: '' },
  'usuarios/luis': { nombre: 'Luis', email: 'luis@ejemplo.com', celular: '3004445566', tipo: 'conductor', creditos: 10000 },
  'usuarios/vieja': { nombre: 'Vieja', email: 'vieja@ejemplo.com', celular: '300 777 8899', tipo: '' }, // forma de antes de G42
  'usuarios/sincel': { nombre: 'Sin celular', email: 'sin@ejemplo.com', tipo: 'conductor' },
  'usuarios/eladmin': { nombre: 'Admin', rol: 'admin' },
};
// Lo que escribe el registro de verdad (Login.js), salvo el celular.
const REGISTRO = (celular) => ({
  nombre: 'Nuevo', email: 'nuevo@ejemplo.com', ...(celular === undefined ? {} : { celular }), fechaNacimiento: '01/01/1990',
  contactoConfianzaNombre: 'Mamá', contactoConfianzaNumero: '3007654321', tipo: '', placa: '', vehiculo: '',
  fechaRegistro: '2026-09-30T10:00:00.000Z', ipRegistro: '181.0.0.1',
});
/**
 * [quién, qué, cómo, debe] — `cómo` = ['set'|'merge'|'update', ruta, datos]; `debe` = lo que tiene que pasar con las
 * reglas de AHORA ('sí' o 'no'). Las de la app (`app: true`) tienen que dar lo MISMO antes y ahora.
 */
const ESCRITURAS = [
  // EL REGISTRO (Login.js crea la ficha con setDoc, sin merge)
  ['nuevo', 'se registra con su celular en 10 cifras (Login.js)', ['set', 'usuarios/nuevo', REGISTRO('3009990000')], 'sí', true],
  ['nuevo', 'se registra sin celular', ['set', 'usuarios/nuevo', REGISTRO(undefined)], 'sí'],
  ['nuevo', 'se registra con «300 999 0000» (forma de antes de G42)', ['set', 'usuarios/nuevo', REGISTRO('300 999 0000')], 'no'],
  ['nuevo', 'se registra con «573009990000» (con el 57)', ['set', 'usuarios/nuevo', REGISTRO('573009990000')], 'no'],
  ['nuevo', 'se registra con 9 cifras', ['set', 'usuarios/nuevo', REGISTRO('300999000')], 'no'],
  ['nuevo', 'se registra con el número como cifra, no texto', ['set', 'usuarios/nuevo', REGISTRO(3009990000)], 'no'],
  ['nuevo', 'se registra con una letra', ['set', 'usuarios/nuevo', REGISTRO('300999000a')], 'no'],
  // LO QUE LA APP ESCRIBE DESPUÉS EN LA FICHA (nada de esto nombra `celular`)
  ['ana', 'Mi perfil: nombre, teléfono y foto (MiPerfil.js)', ['merge', 'usuarios/ana', { nombre: 'Ana María', telefono: '3002223344', fotoConductor: 'https://x/f.jpg' }], 'sí', true],
  ['ana', 'se hace conductora (App.js, alta del conductor)', ['merge', 'usuarios/ana', { tipo: 'conductor', tipoVehiculo: 'Taxi', placa: 'ABC123', marca: 'Chevrolet', modelo: '2015', color: 'Blanco', documento: '123', vehiculo: 'Chevrolet 2015', telefono: '3002223344', fotoConductor: 'https://x/f.jpg' }], 'sí', true],
  ['ana', 'contacto de emergencia (Seguridad.js)', ['merge', 'usuarios/ana', { contactoConfianzaNombre: 'Papá', contactoConfianzaNumero: '3005556677' }], 'sí', true],
  ['ana', 'configuración (Configuracion.js)', ['merge', 'usuarios/ana', { sonido: false }], 'sí', true],
  ['ana', 'favoritos (Solicitar.js)', ['update', 'usuarios/ana', { favoritos: [{ nombre: 'Casa' }] }], 'sí', true],
  ['vieja', 'Mi perfil con un celular viejo en otra forma', ['merge', 'usuarios/vieja', { nombre: 'Vieja Dos', telefono: '3007778899' }], 'sí', true],
  ['sincel', 'Mi perfil en una ficha sin celular', ['merge', 'usuarios/sincel', { nombre: 'Con nombre', telefono: '3001231234' }], 'sí', true],
  ['ana', 'reenvía el MISMO celular sin cambiarlo', ['merge', 'usuarios/ana', { celular: '3001112233', nombre: 'Ana' }], 'sí'],
  // EL HUECO
  ['ana', 'se cambia el celular por otro número', ['update', 'usuarios/ana', { celular: '3008887766' }], 'no'],
  ['ana', 'se pone el celular de Luis', ['update', 'usuarios/ana', { celular: '3004445566' }], 'no'],
  ['ana', 'se pone el número de alguien que AÚN no se registra', ['merge', 'usuarios/ana', { celular: '3009990000' }], 'no'],
  ['ana', 'se borra el celular (libera su número)', ['update', 'usuarios/ana', { celular: null }], 'no'],
  ['ana', 'reescribe toda su ficha con otro celular (setDoc sin merge)', ['set', 'usuarios/ana', { nombre: 'Ana', email: 'ana@ejemplo.com', celular: '3008887766', tipo: '' }], 'no'],
  ['sincel', 'una ficha SIN celular se pone uno', ['update', 'usuarios/sincel', { celular: '3001231234' }], 'no'],
  ['vieja', 'una ficha vieja «limpia» su celular a 10 cifras', ['update', 'usuarios/vieja', { celular: '3007778899' }], 'no'],
  ['ana', 'le cambia el celular a OTRA persona', ['update', 'usuarios/luis', { celular: '3008887766' }], 'no'],
  // EL PANEL
  ['eladmin', 'el panel le corrige el celular a alguien', ['update', 'usuarios/ana', { celular: '3008887766' }], 'sí', true],
  ['eladmin', 'el panel le pone celular a una ficha que no tenía', ['update', 'usuarios/sincel', { celular: '3001231234' }], 'sí', true],
];

/**
 * Corre las ESCRITURAS con un texto de reglas en un proyecto del emulador y devuelve, para cada una, 'sí' o 'no'.
 * Cada escritura parte de la base sembrada de nuevo, así ninguna depende de la anterior.
 */
async function correrEscrituras(reglas, proyecto, host, puerto) {
  const RUT = await import('@firebase/rules-unit-testing');
  const FS = await import('firebase/firestore');
  const entorno = await RUT.initializeTestEnvironment({ projectId: proyecto, firestore: { rules: reglas, host, port: puerto } });
  const salida = [];
  try {
    for (const [quien, , [como, ruta, datos]] of ESCRITURAS) {
      await entorno.clearFirestore();
      await entorno.withSecurityRulesDisabled(async (ctx) => {
        for (const [r, d] of Object.entries(SIEMBRA)) await FS.setDoc(FS.doc(ctx.firestore(), r), d);
      });
      const db = entorno.authenticatedContext(quien).firestore();
      const ref = FS.doc(db, ruta);
      const d = Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === null && como === 'update' ? FS.deleteField() : v]));
      const p = como === 'set' ? FS.setDoc(ref, d) : como === 'merge' ? FS.setDoc(ref, d, { merge: true }) : FS.updateDoc(ref, d);
      try { await p; salida.push('sí'); } catch (e) {
        if (!/PERMISSION_DENIED|permission/i.test(String(e && (e.code || e.message)))) throw e;
        salida.push('no');
      }
    }
  } finally { await entorno.cleanup(); }
  return salida;
}

/** Las reglas tal como estaban en un commit. */
function reglasDelCommit(commit) {
  return execFileSync('git', ['show', commit + ':firestore.rules'], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
}

function decirReglas(titulo, reglas) {
  const q = queDicenLasReglas(reglas);
  console.log('  ' + titulo + ': celular congelado para el dueño: ' + (q.celularCongelado ? 'SÍ' : 'NO')
    + ' · el alta pide la forma: ' + (q.altaPideLaForma ? 'SÍ (' + q.forma + ')' : 'NO'));
}

async function main() {
  const args = process.argv.slice(2);
  const sinRed = args.includes('--sin-red');
  const iv = args.indexOf('--reglas-vivas');
  const ic = args.indexOf('--careo');
  const repo = fs.readFileSync(REGLAS, 'utf8');

  console.log('── LAS REGLAS ──');
  decirReglas('repo (disco)', repo);
  if (iv >= 0) {
    const vivas = fs.readFileSync(args[iv + 1], 'utf8');
    decirReglas('PUESTAS (' + path.basename(args[iv + 1]) + ')', vivas);
    console.log('  las puestas y el repo: ' + (normal(vivas) === normal(repo) ? 'IGUALES' : 'DISTINTAS'));
  }

  if (ic >= 0) {
    const commit = args[ic + 1];
    const host = process.env.FIRESTORE_EMULATOR_HOST;
    if (!host) { console.error('El careo necesita el emulador: córrelo dentro de `firebase emulators:exec`.'); process.exit(1); }
    const [h, p] = host.split(':');
    const antes = await correrEscrituras(reglasDelCommit(commit), 'demo-careo-p07-antes', h, Number(p));
    const ahora = await correrEscrituras(repo, 'demo-careo-p07-ahora', h, Number(p));
    console.log('── CAREO: reglas de ' + commit + ' (ANTES) contra las del disco (AHORA) ──');
    let cambian = 0; let appDistinta = 0; let fallan = 0;
    ESCRITURAS.forEach(([quien, que, , debe, app], i) => {
      const marca = antes[i] === ahora[i] ? '   ' : ' ⇒ ';
      if (antes[i] !== ahora[i]) cambian++;
      if (app && antes[i] !== ahora[i]) appDistinta++;
      if (ahora[i] !== debe) fallan++;
      console.log('  ' + (ahora[i] === debe ? '✓' : '🔴') + ' ' + quien.padEnd(8) + ' antes ' + antes[i].padEnd(2) + marca + 'ahora '
        + ahora[i].padEnd(2) + ' · ' + que + (app ? '  [lo hace la app]' : ''));
    });
    console.log('  ' + ESCRITURAS.length + ' escrituras · ' + cambian + ' cambian · de las que hace la app, ' + appDistinta
      + ' cambian · ' + fallan + ' no dan lo esperado');
  }

  if (sinRed) return;
  const { traer, doc } = require('./nube.cjs');
  const fichas = (await traer('usuarios')).map(doc);
  const conCel = fichas.filter((f) => f.celular !== undefined && f.celular !== null && f.celular !== '');
  const forma = queDicenLasReglas(repo).forma || '[0-9]{10}';
  const re = new RegExp('^(?:' + forma + ')$');
  const limpias = conCel.filter((f) => typeof f.celular === 'string' && re.test(f.celular));
  const porNumero = {};
  for (const f of conCel) { const k = String(f.celular).replace(/\D/g, '').slice(-10); (porNumero[k] = porNumero[k] || []).push(f.id); }
  const repetidos = Object.values(porNumero).filter((l) => l.length > 1);
  console.log('── PRODUCCIÓN ──');
  console.log('FICHAS: ' + fichas.length + ' · con celular: ' + conCel.length + ' · en 10 cifras limpias: ' + limpias.length
    + ' · en otra forma: ' + (conCel.length - limpias.length) + ' · sin celular: ' + (fichas.length - conCel.length)
    + ' · números en más de una ficha: ' + repetidos.length);
  for (const f of conCel.filter((x) => !limpias.includes(x))) {
    console.log('   · ' + String(f.id).slice(0, 8) + '… (' + (f.tipo || 'pasajero') + ') celular en otra forma (' + String(f.celular).length + ' caracteres)');
  }
}

module.exports = { bloqueUsuarios, listaDe, formaDelCelular, altaPideLaForma, queDicenLasReglas, ESCRITURAS, SIEMBRA, correrEscrituras, reglasDelCommit };

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
