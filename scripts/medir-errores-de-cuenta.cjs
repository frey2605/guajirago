#!/usr/bin/env node
/**
 * 🔐 ¿QUÉ LE DICE CADA APP A QUIEN NO PUDO ENTRAR O CREAR SU CUENTA? — gemelo G72 (29-sep-2026), SOLO LECTURA.
 *
 * Los fallos de las cuentas (Firebase Auth: contraseña mala, correo ya usado, contraseña débil, sin señal…) se
 * traducían a mano en SIETE sitios de las tres apps, cada uno con su propia tablita de `if (e.code === 'auth/…')`:
 *   transporte · Login.js (registrarse, iniciarSesion) · Configuracion.js (eliminarCuenta)
 *   panel      · App.js (iniciarSesion)
 *   aliados    · Login.js (registrar, iniciarSesion) · Empleados.js (crearEmpleado)
 * y el mismo fallo salía con palabras distintas según la pantalla (o con un «Error al ingresar» que no dice nada).
 *
 *   node scripts/medir-errores-de-cuenta.cjs                                  <- el código de hoy (el disco)
 *   node scripts/medir-errores-de-cuenta.cjs --raiz <c> --panel <c> --aliados <c>   <- cada repo en un commit (careo)
 *
 * No habla con ningún servidor: SACA de cada pantalla el `catch` que protege la llamada a la cuenta y lo CORRE con
 * cada error que puede contestar Firebase. Lo que «ve la persona» es lo que ese catch deja escrito (setError…). Las
 * funciones de avisoRechazo.js que use el catch salen del avisoRechazo.js de ESA app en ESE commit.
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. TABLAS A MANO: sitios cuyo catch escribe un texto propio (una comilla dentro de setError…).
 *  2. PALABRAS DISTINTAS para el mismo fallo, entre los sitios que pueden recibirlo (quitando el nombre de la acción,
 *     que es lo único que puede cambiar de una pantalla a otra).
 *  3. VERDAD: sin señal dice señal/internet; demasiados intentos lo dice; contraseña mala nombra la contraseña; correo
 *     ya usado, contraseña débil y correo mal escrito lo dicen.
 *  4. DELATA: en las pantallas de ENTRAR, si «ese correo no existe» y «la contraseña está mal» se ven distinto (con un
 *     servidor sin protección contra adivinar correos, eso diría qué correos tienen cuenta).
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo, sinTextos, catchQueProtege } = require('../pruebas/cargar.cjs');

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

const REPO = { transporte: '', panel: 'guajirago-admin', aliados: 'guajirago-aliados' };

/** Lee un archivo del disco, o de un commit de SU repo. `commits` = { transporte, panel, aliados } (cada uno opcional). */
function lector(commits = {}) {
  return (r) => {
    const app = /^guajirago-admin\//.test(r) ? 'panel' : /^guajirago-aliados\//.test(r) ? 'aliados' : 'transporte';
    const commit = commits[app];
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    const dentro = REPO[app] ? r.slice(REPO[app].length + 1) : r;
    try {
      return execFileSync('git', ['show', commit + ':' + dentro], { cwd: path.join(RAIZ, REPO[app]), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

// `tipo`: entrar | crear | confirmar (volver a escribir la contraseña para eliminar la cuenta). `llamada`: la llamada a
// la cuenta que protege el catch. `accion`: cómo la nombra la pantalla (lo único que puede cambiar entre sitios).
const SITIOS = [
  { app: 'transporte', archivo: 'guajirago/src/Login.js', funcion: 'registrarse', llamada: 'createUserWithEmailAndPassword', tipo: 'crear', accion: 'crear la cuenta' },
  { app: 'transporte', archivo: 'guajirago/src/Login.js', funcion: 'iniciarSesion', llamada: 'signInWithEmailAndPassword', tipo: 'entrar', accion: 'iniciar sesión' },
  { app: 'transporte', archivo: 'guajirago/src/Configuracion.js', funcion: 'eliminarCuenta', llamada: 'reauthenticateWithCredential', tipo: 'confirmar', accion: 'eliminar la cuenta' },
  { app: 'panel', archivo: 'guajirago-admin/src/App.js', funcion: 'iniciarSesion', llamada: 'signInWithEmailAndPassword', tipo: 'entrar', accion: 'iniciar sesión' },
  { app: 'aliados', archivo: 'guajirago-aliados/src/Login.js', funcion: 'registrar', llamada: 'createUserWithEmailAndPassword', tipo: 'crear', accion: 'crear la cuenta' },
  { app: 'aliados', archivo: 'guajirago-aliados/src/Login.js', funcion: 'iniciarSesion', llamada: 'signInWithEmailAndPassword', tipo: 'entrar', accion: 'iniciar sesión' },
  { app: 'aliados', archivo: 'guajirago-aliados/src/Empleados.js', funcion: 'crearEmpleado', llamada: 'crearCuentaEmpleado', tipo: 'crear', accion: 'crear la cuenta del empleado' },
];

// Lo que puede contestar Firebase Auth, y a qué tipo de sitio. `verdad`: lo que el texto tiene que decir.
const FALLOS = [
  { id: 'credencial', codigo: 'auth/invalid-credential', que: 'contraseña mala o correo sin cuenta (servidor con protección, como hoy)', tipos: ['entrar', 'confirmar'], verdad: /contrase[ñn]a/i },
  { id: 'claveMala', codigo: 'auth/wrong-password', que: 'contraseña mala (servidor sin protección)', tipos: ['entrar', 'confirmar'], verdad: /contrase[ñn]a/i },
  { id: 'noExiste', codigo: 'auth/user-not-found', que: 'correo sin cuenta (servidor sin protección)', tipos: ['entrar'] },
  { id: 'yaUsado', codigo: 'auth/email-already-in-use', que: 'el correo ya tiene cuenta', tipos: ['crear'], verdad: /ya (tiene una cuenta|est[aá] registrado)/i },
  { id: 'debil', codigo: 'auth/weak-password', que: 'contraseña débil', tipos: ['crear'], verdad: /6 caracteres/i },
  { id: 'malEscrito', codigo: 'auth/invalid-email', que: 'correo mal escrito', tipos: ['entrar', 'crear'], verdad: /bien escrito|no es v[aá]lido/i },
  { id: 'sinSenal', codigo: 'auth/network-request-failed', que: 'sin señal', tipos: ['entrar', 'crear', 'confirmar'], verdad: /se[ñn]al|internet|conexi[oó]n/i },
  { id: 'muchos', codigo: 'auth/too-many-requests', que: 'demasiados intentos', tipos: ['entrar', 'crear', 'confirmar'], verdad: /intentos/i },
  { id: 'otro', codigo: 'auth/internal-error', que: 'otro fallo del servidor', tipos: ['entrar', 'crear', 'confirmar'] },
];

/** El catch que protege la llamada a la cuenta dentro de `const funcion = async (…) => {…}`, con el nombre de su error. */
function elCatch(fuente, funcion, llamada) {
  const codigo = soloCodigo(fuente.replace(/\r\n/g, '\n'));
  const seguro = sinTextos(codigo);
  const m = new RegExp('const\\s+' + funcion + '\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*\\{').exec(seguro);
  if (!m) return null;
  const pos = seguro.indexOf(llamada + '(', m.index);
  if (pos < 0) return null;
  const cuerpo = catchQueProtege(codigo, pos);
  if (cuerpo == null) return null;
  // Un catch vacío no hace falta buscarlo: no dice nada, y eso es lo que tiene que salir (mudo).
  if (!cuerpo.trim()) return { cuerpo: '', variable: 'e' };
  const ini = codigo.indexOf(cuerpo, pos);
  const p = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{\s*$/.exec(codigo.slice(0, ini));
  return p ? { cuerpo, variable: p[1] } : null;
}

/** Corre el catch con UN error. Devuelve los textos que ve la persona. */
function correrCatch(c, pieza, codigo) {
  const vistos = [];
  const e = new Error('Firebase: Error (' + codigo + ').');
  e.code = codigo;
  const dice = (t) => { if (t) vistos.push(String(t)); };
  const nombres = { ...pieza, setError: dice, setErrorEliminar: dice, setCampoError: () => {}, setCargando: () => {}, setGuardando: () => {} };
  let reventó = null;
  try {
    // eslint-disable-next-line no-new-func
    new Function(...Object.keys(nombres), c.variable, c.cuerpo)(...Object.values(nombres), e);
  } catch (x) { reventó = x.message; }
  return { vistos, reventó };
}

function medirSitio(sitio, leerDe) {
  const fuente = leerDe(sitio.archivo);
  const c = fuente && elCatch(fuente, sitio.funcion, sitio.llamada);
  if (!c) return { ...sitio, falta: true };
  const piezaFuente = leerDe(sitio.archivo.replace(/[^/]+$/, 'avisoRechazo.js'));
  const pieza = piezaFuente ? cargarDeLaApp(sitio.archivo.replace(/[^/]+$/, 'avisoRechazo.js'), piezaFuente) : {};
  const por = {};
  for (const f of FALLOS) if (f.tipos.includes(sitio.tipo)) por[f.id] = correrCatch(c, pieza, f.codigo);
  const texto = (id) => (por[id] ? por[id].vistos.join(' + ') : '');
  // Una tabla a mano: el catch le pasa una comilla (un texto escrito ahí mismo) a la función que lo enseña.
  const tablaAMano = /\bset(Error|ErrorEliminar)\s*\(\s*['"`]/.test(c.cuerpo);
  const verdades = FALLOS.filter((f) => f.verdad && por[f.id]).map((f) => ({ id: f.id, que: f.que, dice: f.verdad.test(texto(f.id)) }));
  const mudos = FALLOS.filter((f) => por[f.id] && !texto(f.id)).map((f) => f.que + (por[f.id].reventó ? ' (REVENTÓ: ' + por[f.id].reventó + ')' : ''));
  const delata = sitio.tipo === 'entrar' && texto('noExiste') !== texto('claveMala');
  return { ...sitio, por, texto, tablaAMano, verdades, mudos, delata };
}

/** Para comparar sitios: el texto sin el nombre de la acción de ese sitio (lo único que puede cambiar). */
function sinAccion(s, id) {
  return s.texto(id).split(s.accion).join('<acción>');
}

function medir(leerDe) {
  const sitios = SITIOS.map((s) => medirSitio(s, leerDe));
  const vivos = sitios.filter((s) => !s.falta);
  const distintos = FALLOS.map((f) => {
    const textos = new Set(vivos.filter((s) => s.por[f.id]).map((s) => sinAccion(s, f.id)));
    return { id: f.id, que: f.que, textos: [...textos] };
  });
  return {
    sitios,
    faltan: sitios.filter((s) => s.falta).length,
    tablasAMano: vivos.filter((s) => s.tablaAMano).length,
    // Fallos que salen con más de UNA forma de decirlo, contando todos los sitios que pueden recibirlos.
    fallosConPalabrasDistintas: distintos.filter((d) => d.textos.length > 1).length,
    distintos,
    verdades: vivos.reduce((n, s) => n + s.verdades.filter((v) => v.dice).length, 0),
    verdadesPosibles: vivos.reduce((n, s) => n + s.verdades.length, 0),
    mudos: vivos.reduce((n, s) => n + s.mudos.length, 0),
    delatan: vivos.filter((s) => s.delata).length,
  };
}

function main() {
  const commits = { transporte: argumento('--raiz'), panel: argumento('--panel'), aliados: argumento('--aliados') };
  const r = medir(lector(commits));
  const donde = Object.entries(commits).filter(([, c]) => c).map(([a, c]) => a + '@' + c).join(' · ');
  console.log('🔐 Los errores de las cuentas — ' + (donde || 'el disco'));
  for (const s of r.sitios) {
    console.log('\n  ' + s.app + ' · ' + s.archivo + ' → ' + s.funcion + ' (' + s.tipo + ')');
    if (s.falta) { console.log('    🔴 no encontré el catch de ' + s.llamada); continue; }
    for (const f of FALLOS) if (s.por[f.id]) console.log('    · ' + f.que.padEnd(72) + ' → «' + (s.texto(f.id) || '(nada)') + '»');
    console.log('    textos a mano en el catch: ' + (s.tablaAMano ? 'SÍ' : 'no')
      + ' · dice la verdad: ' + s.verdades.filter((v) => v.dice).length + '/' + s.verdades.length
      + (s.tipo === 'entrar' ? ' · delata qué correos existen: ' + (s.delata ? 'SÍ' : 'no') : ''));
    if (s.mudos.length) console.log('    🔴 no dice nada con: ' + s.mudos.join('; '));
  }
  console.log('\n  PALABRAS PARA EL MISMO FALLO (entre todos los sitios que pueden recibirlo):');
  for (const d of r.distintos) console.log('    · ' + d.que.padEnd(72) + ' → ' + d.textos.length + (d.textos.length > 1 ? ' formas' : ' forma'));
  console.log('\n  RESUMEN: sitios ' + (SITIOS.length - r.faltan) + '/' + SITIOS.length
    + ' · con textos a mano: ' + r.tablasAMano
    + ' · fallos con palabras distintas: ' + r.fallosConPalabrasDistintas + '/' + FALLOS.length
    + ' · dicen la verdad: ' + r.verdades + '/' + r.verdadesPosibles
    + ' · mudos: ' + r.mudos
    + ' · pantallas de entrar que delatan correos: ' + r.delatan);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('🔴 ' + e.message); process.exit(1); }
}
module.exports = { medir, medirSitio, elCatch, lector, SITIOS, FALLOS };
