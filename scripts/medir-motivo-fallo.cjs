#!/usr/bin/env node
/**
 * G40 · CUANDO ALGO NO SE GUARDA, ¿LA PANTALLA DICE POR QUÉ?   (solo lectura, no toca datos)
 *
 *   node scripts/medir-motivo-fallo.cjs                 → el código de hoy (el disco)
 *   node scripts/medir-motivo-fallo.cjs --commit 69a68b9 → el código de ese commit (para el careo antes/después)
 *
 * El gemelo: varias pantallas decían «Revisa tu conexión» FUERA CUAL FUERA el fallo —el servidor dijo que no, la foto
 * pesaba demasiado, el código era de otro viaje—, y los dos códigos del conductor (el de seguridad y el de descuento)
 * avisaban distinto: el de descuento ya sacaba el motivo de `motivoDeRechazo` y el de seguridad no. La única pieza que
 * sabe decir por qué falló algo es `motivoDeRechazo` (guajirago/src/avisoRechazo.js).
 *
 * Qué hace:
 *   1. Saca de cada sitio del gemelo el `catch` que pinta el aviso y lo EJECUTA con cuatro fallos de verdad
 *      (sin permiso, sin señal, una frase de nuestro servidor, y el almacén rechazando la foto), con la
 *      `motivoDeRechazo` real de la app. Dice qué le queda escrito a la persona en cada caso.
 *      Un sitio «dice lo mismo sea cual sea el fallo» si los tres primeros dan el mismo texto.
 *   2. Mira que los dos códigos del conductor digan LO MISMO ante el mismo fallo.
 *   3. Cuenta en las TRES apps los «Revisa tu conexión» escritos a mano dentro de un `catch`.
 *      Los que quedan a propósito van en PENDIENTES, que SOLO PUEDE BAJAR (lo exige pruebas/motivoFallo.test.js).
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { cargarDeLaApp, soloCodigo, sinTextos, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');

// Los sitios del gemelo (auditoría de gemelos, fila G40). `camino` es la función, y si hace falta, la de fuera primero.
const SITIOS = [
  { nombre: 'Código de seguridad (conductor)', archivo: 'guajirago/src/AppConductor.js', camino: ['verificarCodigo'], setter: 'setErrorCodigo', par: 'codigos' },
  { nombre: 'Código de descuento (conductor)', archivo: 'guajirago/src/AppConductor.js', camino: ['verificarCodigoDescuento'], setter: 'setErrorCodigoDescuento', par: 'codigos' },
  { nombre: 'Datos del conductor (registro)', archivo: 'guajirago/src/App.js', camino: ['PantallaDatosConductor', 'guardar'], setter: 'setError' },
  { nombre: 'Mi perfil', archivo: 'guajirago/src/MiPerfil.js', camino: ['guardar'], setter: 'setError' },
  { nombre: 'Contacto de confianza (Seguridad)', archivo: 'guajirago/src/Seguridad.js', camino: ['guardar'], setter: 'setError' },
  { nombre: 'Reserva de turismo', archivo: 'guajirago/src/Turismo.js', camino: ['enviarReserva'], setter: 'setAviso' },
];

// Los fallos, con la forma que tienen de verdad (el código es el contrato; ver avisoRechazo.js).
const FALLOS = [
  { cual: 'sin permiso', e: { code: 'permission-denied', message: 'Missing or insufficient permissions.' } },
  { cual: 'sin señal', e: { code: 'unavailable', message: 'Failed to get document because the client is offline.' } },
  { cual: 'frase del servidor', e: { code: 'functions/failed-precondition', message: 'Ese código ya fue usado [400]' } },
  { cual: 'foto rechazada', e: { code: 'storage/unauthorized', message: 'User does not have permission to access this object.' } },
];

// «Revisa tu conexión» escritos a mano dentro de un catch que se dejan A PROPÓSITO. SOLO PUEDE BAJAR.
//   · Seguridad.js: el de CARGAR el contacto (una lectura: los textos de motivoDeRechazo hablan de «el cambio no se
//     hizo», que ahí sería falso). · Los tres de aliados: otro repo, fuera de la fila G40 (anotados para el dueño).
const PENDIENTES = {
  'guajirago/src/Seguridad.js': 1,
  'guajirago-aliados/src/Mesero.js': 1,
  'guajirago-aliados/src/PerfilAgencia.js': 1,
  'guajirago-aliados/src/PerfilRestaurante.js': 1,
};

function fuenteDe(archivo, commit) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
  return execFileSync('git', ['show', commit + ':' + archivo], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** El cuerpo de la función `nombre` que empieza DENTRO de [desde, hasta). */
function funcionDentro(t, nombre, desde, hasta) {
  const re = new RegExp('(?:const\\s+' + nombre + '\\s*=\\s*(?:async\\s*)?\\(|function\\s+' + nombre + '\\s*\\()', 'g');
  re.lastIndex = desde;
  const m = re.exec(t);
  if (!m || m.index >= hasta) return null;
  return cuerpoDeLaFuncion(t, m.index);
}

/** Los cuerpos de TODOS los catch de un trozo (con su posición). */
function losCatch(t, ini, fin) {
  const seguro = sinTextos(t);
  const out = [];
  const re = /catch\s*(\([^)]*\))?\s*\{/g;
  re.lastIndex = ini;
  let m;
  while ((m = re.exec(seguro)) && m.index < fin) {
    let i = m.index + m[0].length;
    const a = i;
    let hondo = 1;
    while (i < fin && hondo > 0) {
      if (seguro[i] === '{') hondo += 1;
      else if (seguro[i] === '}') hondo -= 1;
      i += 1;
    }
    out.push({ pos: m.index, texto: t.slice(a, i - 1) });
  }
  return out;
}

/** El catch del sitio: el ÚNICO de su función que llama a su setter. */
function catchDelSitio(sitio, commit) {
  const t = soloCodigo(fuenteDe(sitio.archivo, commit));
  let ini = 0;
  let fin = t.length;
  for (const nombre of sitio.camino) {
    const f = funcionDentro(t, nombre, ini, fin);
    if (!f) throw new Error(sitio.archivo + ': no encontré la función ' + sitio.camino.join(' › '));
    ini = f.ini; fin = f.fin;
  }
  const conSetter = losCatch(t, ini, fin).filter((c) => new RegExp('\\b' + sitio.setter + '\\s*\\(').test(c.texto));
  if (conSetter.length !== 1) {
    throw new Error(sitio.archivo + ' › ' + sitio.camino.join(' › ') + ': esperaba UN catch que llame a ' + sitio.setter + ', hay ' + conSetter.length);
  }
  return conSetter[0].texto;
}

/**
 * Corre el cuerpo de un catch con el fallo `e`. Todo lo que el cuerpo nombre y no sea del navegador sale de aquí:
 * motivoDeRechazo y apuntarRechazo de verdad (la de la app), y los `set...` apuntan lo que reciben.
 */
function correrCatch(cuerpo, e, sitio, piezas) {
  const puesto = {};
  const fijos = {
    motivoDeRechazo: piezas.motivoDeRechazo,
    apuntarRechazo: () => {},
  };
  const alcance = new Proxy({}, {
    // `e` NO: es el fallo que se le pasa al catch (si el alcance se lo quedara, el catch vería un fallo vacío).
    has: (_, k) => typeof k === 'string' && k !== 'e' && (k in fijos || /^set[A-Z]/.test(k) || !(k in globalThis)),
    get: (_, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (k in fijos) return fijos[k];
      if (typeof k === 'string' && /^set[A-Z]/.test(k)) return (v) => { puesto[k] = v; };
      return undefined;
    },
  });
  // eslint-disable-next-line no-new-func
  const f = new Function('alcance', 'e', 'with (alcance) { return (function () {' + cuerpo + '\n})(); }');
  f(alcance, e);
  const v = puesto[sitio.setter];
  if (v === undefined) return '(no dice nada)';
  if (v && typeof v === 'object') return [v.titulo, v.texto].filter(Boolean).join(' · ');
  return String(v);
}

function contarAMano() {
  const out = {};
  for (const dir of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!/\.js$/.test(f)) continue;
      const ruta = dir + '/' + f;
      const t = soloCodigo(fs.readFileSync(path.join(abs, f), 'utf8'));
      const n = losCatch(t, 0, t.length).filter((c) => /Revisa tu conexi/i.test(c.texto)).length;
      if (n) out[ruta] = n;
    }
  }
  return out;
}

function medir({ commit } = {}) {
  const piezas = cargarDeLaApp('guajirago/src/avisoRechazo.js');
  const sitios = SITIOS.map((s) => {
    const cuerpo = catchDelSitio(s, commit);
    const dice = FALLOS.map((f) => ({ cual: f.cual, texto: correrCatch(cuerpo, f.e, s, piezas) }));
    const distintos = new Set(dice.slice(0, 3).map((d) => d.texto)).size;
    return { ...s, dice, siempreLoMismo: distintos === 1 };
  });
  const [a, b] = sitios.filter((s) => s.par === 'codigos');
  // Los dos códigos avisan igual si, ante el mismo fallo, dicen lo mismo (salvo el nombre de lo que se intentaba).
  const quitarAccion = (x) => x.replace(/comprobar el código( de descuento)?/g, '…');
  const codigosIguales = a.dice.every((d, i) => quitarAccion(d.texto) === quitarAccion(b.dice[i].texto));
  return { sitios, codigosIguales, aMano: commit ? null : contarAMano() };
}

module.exports = { medir, SITIOS, FALLOS, PENDIENTES, catchDelSitio, correrCatch, contarAMano };

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : null;
  const r = medir({ commit });
  console.log('\nG40 · cuando algo no se guarda, ¿la pantalla dice por qué?  (' + (commit ? 'commit ' + commit : 'el disco') + ')\n');
  let malos = 0;
  for (const s of r.sitios) {
    if (s.siempreLoMismo) malos++;
    console.log((s.siempreLoMismo ? '🔴 ' : '✓ ') + s.nombre + (s.siempreLoMismo ? ' — dice LO MISMO sea cual sea el fallo' : ''));
    for (const d of s.dice) console.log('     · ' + d.cual.padEnd(19) + ' → «' + d.texto + '»');
  }
  console.log('\nLos dos códigos del conductor avisan igual: ' + (r.codigosIguales ? '✓ sí' : '🔴 NO'));
  if (!r.codigosIguales) malos++;
  if (r.aMano) {
    const total = Object.values(r.aMano).reduce((x, y) => x + y, 0);
    console.log('\n«Revisa tu conexión» a mano dentro de un catch, en las tres apps: ' + total);
    for (const [f, n] of Object.entries(r.aMano)) {
      const pend = PENDIENTES[f] || 0;
      const nota = n > pend ? '  🔴 más de los ' + pend + ' que se dejan a propósito' : '  (se deja a propósito: ver PENDIENTES)';
      if (n > pend) malos++;
      console.log('   · ' + f + ': ' + n + nota);
    }
  }
  console.log('\n' + (malos ? '🔴 ' + malos + ' cosas por arreglar' : '✓ cada sitio dice el motivo, y los dos códigos avisan igual'));
}
