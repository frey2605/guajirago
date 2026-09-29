#!/usr/bin/env node
/**
 * 🔑 ¿QUÉ LE DICE LA APP A QUIEN PIDE EL CORREO PARA CAMBIAR LA CONTRASEÑA? — gemelo G71 (29-sep-2026), SOLO LECTURA.
 *
 * La app de transporte manda ese correo desde DOS pantallas: Login.js («¿Olvidaste tu contraseña?», fuera de la
 * cuenta) y Configuracion.js («Cambiar contraseña», dentro). Cada una tenía su propio texto de fallo a mano, y Login
 * culpaba al correo de CUALQUIER fallo («No encontramos ese correo» sin señal). El panel y aliados tienen el suyo.
 *
 *   node scripts/medir-recuperar-contrasena.cjs                 <- el código de hoy (el disco)
 *   node scripts/medir-recuperar-contrasena.cjs --commit <hash> <- la app en otro commit de la raíz (careo)
 *
 * No habla con ningún servidor: SACA cada función del archivo y la CORRE con un envío de mentira que contesta, uno por
 * uno, lo que puede contestar Firebase. Lo que «ve la persona» es lo que la función deja escrito: el renglón rojo, el
 * verde, o la ventanita (la del candado de LA LEY DEL BOTÓN sale del candado.js y del avisoRechazo.js de ese mismo
 * commit, así que el careo corre el motivo de ENTONCES con el código de entonces).
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántos sitios llaman a sendPasswordResetEmail en cada app, y si existe la pieza recuperarContrasena.js.
 *  2. Por sitio y por respuesta del servidor, qué texto ve la persona.
 *  3. MENTIRAS: culpar al correo de un fallo que no es del correo; decir «te enviamos» a un correo que no existe.
 *  4. DELATA: si con un correo que existe y con uno que no (servidor sin protección) se ve algo distinto.
 *  5. VERDAD por fallo: sin señal dice señal/internet; demasiados intentos lo dice; correo mal escrito lo dice.
 *
 * El panel y aliados NO son de G71 (son de su repo y no se tocan): se miden para que se vea dónde está cada uno.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo: del disco, o (solo la app de la raíz) de un commit. */
function lector(commit) {
  return (r) => {
    if (!commit || /^guajirago-(admin|aliados)\//.test(r)) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

// Los sitios que mandan el correo. `fuera`: la persona no ha entrado a su cuenta (ahí importa no delatar correos).
const SITIOS = [
  { app: 'transporte', archivo: 'guajirago/src/Login.js', funcion: 'recuperarContrasena', fuera: true },
  { app: 'transporte', archivo: 'guajirago/src/Configuracion.js', funcion: 'cambiarContrasena', fuera: false },
  { app: 'panel', archivo: 'guajirago-admin/src/App.js', funcion: 'olvideContrasena', fuera: true },
  { app: 'aliados', archivo: 'guajirago-aliados/src/Login.js', funcion: 'recuperarClave', fuera: true },
];

// Lo que puede contestar el servidor. `null` = sale bien.
const RESPUESTAS = [
  { id: 'existe', que: 'el correo existe', codigo: null },
  { id: 'noExisteProtegido', que: 'no existe (servidor con protección, como hoy)', codigo: null, noExiste: true },
  { id: 'noExisteDelata', que: 'no existe (servidor SIN protección)', codigo: 'auth/user-not-found', noExiste: true },
  { id: 'sinSenal', que: 'sin señal', codigo: 'auth/network-request-failed', verdad: /señal|internet|conexi[oó]n/i },
  { id: 'muchos', que: 'demasiados intentos', codigo: 'auth/too-many-requests', verdad: /intentos/i },
  { id: 'malEscrito', que: 'correo mal escrito', codigo: 'auth/invalid-email', verdad: /bien escrito|no es v[aá]lido/i },
  { id: 'otro', que: 'otro fallo del servidor', codigo: 'auth/internal-error' },
];

/** `const nombre = [async] (...) => { ... };` sacada del archivo, tal cual. */
function laFuncion(texto, nombre) {
  const codigo = soloCodigo(texto.replace(/\r\n/g, '\n'));
  const seguro = sinTextos(codigo);
  const m = new RegExp('const\\s+' + nombre + '\\s*=\\s*(async\\s*)?\\([^)]*\\)\\s*=>\\s*\\{').exec(seguro);
  if (!m) return null;
  const abre = m.index + m[0].length - 1;
  let p = 0;
  for (let j = abre; j < seguro.length; j += 1) {
    if (seguro[j] === '{') p += 1;
    else if (seguro[j] === '}') { p -= 1; if (p === 0) return codigo.slice(m.index, j + 1).replace(/^const\s+\w+\s*=\s*/, ''); }
  }
  return null;
}

/** La pieza recuperarContrasena.js de ese commit, con el envío de mentira en lugar del de Firebase. */
function laPieza(fuente, enviar) {
  if (!fuente) return {};
  const sin = fuente.replace(/\r\n/g, '\n')
    .replace(/^import\s*\{[^}]*\}\s*from\s*'firebase\/auth';?[ \t]*$/m, '')
    .replace(/^import\s*\{[^}]*\}\s*from\s*'\.\/firebase';?[ \t]*$/m, '');
  if (/^import\s/m.test(sin)) throw new Error('recuperarContrasena.js importa algo que este medidor no sabe dar');
  const nombres = [...sin.matchAll(/^export\s+(?:async\s+)?(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((x) => x[1]);
  // eslint-disable-next-line no-new-func
  return new Function('sendPasswordResetEmail', 'auth', sin.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')(enviar, { app: 'mentira' });
}

const CORREO = 'persona@ejemplo.com';

/** Corre UNA función de pantalla con UNA respuesta del servidor. Devuelve lo que ve la persona y qué se envió. */
async function correrUna(cuerpo, leerDe, respuesta) {
  const vistos = [];
  const enviados = [];
  const enviar = async (a, correo) => {
    enviados.push(correo);
    if (respuesta.codigo) { const e = new Error('Firebase: Error (' + respuesta.codigo + ').'); e.code = respuesta.codigo; throw e; }
  };
  const pieza = laPieza(leerDe('guajirago/src/recuperarContrasena.js'), enviar);
  const { crearCandado } = cargarDeLaApp('guajirago/src/candado.js', leerDe('guajirago/src/candado.js'));
  const { motivoDeRechazo } = cargarDeLaApp('guajirago/src/avisoRechazo.js', leerDe('guajirago/src/avisoRechazo.js'));
  const pendientes = [];
  const candado = crearCandado({
    alAviso: (a) => vistos.push({ via: 'ventanita', titulo: a.titulo, texto: a.texto }),
    traducir: (e, accion) => motivoDeRechazo(e, accion),
    reloj: { poner: () => 0, quitar: () => {} },
  });
  const correr = (...a) => { const p = candado.correr(...a); pendientes.push(p); return p; };
  const dice = (via) => (t) => { if (t) vistos.push({ via, texto: String(t) }); };
  const nombres = {
    email: CORREO, correo: CORREO,
    setError: dice('renglón rojo'), setMensajeRecuperar: dice('renglón verde'), setAvisoReset: dice('aviso'),
    setMensaje: dice('mensaje'), setCampoError: () => {}, setCargando: () => {},
    setCorreoEnviado: (c) => { if (c) vistos.push({ via: 'ventanita', titulo: '¡Correo enviado!', texto: 'Te enviamos un enlace para cambiar tu contraseña a: ' + c }); },
    sendPasswordResetEmail: enviar, auth: { currentUser: { email: CORREO } },
    correr, texto: (c, t, n) => n,
    mandarCorreoDeRecuperacion: pieza.mandarCorreoDeRecuperacion,
    CORREO_DE_RECUPERACION_ENVIADO: pieza.CORREO_DE_RECUPERACION_ENVIADO,
  };
  let reventó = null;
  try {
    // eslint-disable-next-line no-new-func
    const f = new Function(...Object.keys(nombres), 'return (' + cuerpo + ');')(...Object.values(nombres));
    await f();
    await Promise.all(pendientes);
  } catch (e) { reventó = e.message; }
  return { vistos, enviados, reventó };
}

function frase(v) { return v.vistos.map((x) => x.via + ': ' + (x.titulo ? '«' + x.titulo + '» ' : '') + '«' + x.texto + '»').join(' + ') || (v.reventó ? 'REVENTÓ: ' + v.reventó : '(nada)'); }
function soloTexto(v) { return v.vistos.map((x) => (x.titulo || '') + '|' + x.texto).join(' + '); }

async function medirSitio(sitio, leerDe) {
  const fuente = leerDe(sitio.archivo);
  const cuerpo = fuente && laFuncion(fuente, sitio.funcion);
  if (!cuerpo) return { ...sitio, falta: true };
  const por = {};
  for (const r of RESPUESTAS) por[r.id] = await correrUna(cuerpo, leerDe, r);
  const mentiras = [];
  for (const r of RESPUESTAS) {
    const t = soloTexto(por[r.id]);
    if (r.id !== 'noExisteDelata' && /no encontramos|no existe|no est[aá] registrado/i.test(t)) mentiras.push(r.que + ': culpa al correo');
    if (sitio.fuera && r.id === 'noExisteProtegido' && /(^|\|)Te enviamos/.test(t)) mentiras.push(r.que + ': dice «te enviamos» y no se envió nada');
    if (!t) mentiras.push(r.que + ': no dice nada');
  }
  const delata = sitio.fuera && soloTexto(por.existe) !== soloTexto(por.noExisteDelata);
  const verdades = RESPUESTAS.filter((r) => r.verdad).map((r) => ({ que: r.que, dice: r.verdad.test(soloTexto(por[r.id])) }));
  const normaliza = por.existe.enviados.every((c) => c === CORREO);
  return { ...sitio, por, mentiras, delata, verdades, normaliza };
}

function contarLlamadas(leerDe) {
  const cuenta = {};
  for (const [app, dir] of [['transporte', 'guajirago/src'], ['panel', 'guajirago-admin/src'], ['aliados', 'guajirago-aliados/src']]) {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) continue;
    // Los nombres de archivo salen del disco (los de la app de la raíz, más la pieza, por si el commit no la tenía).
    const nombres = new Set(fs.readdirSync(abs).filter((n) => /\.js$/.test(n) && !/\.test\.js$/.test(n)));
    cuenta[app] = [];
    for (const n of nombres) {
      const t = leerDe(dir + '/' + n);
      if (!t) continue;
      const k = (sinTextos(soloCodigo(t)).match(/\bsendPasswordResetEmail\s*\(/g) || []).length;
      if (k) cuenta[app].push(n + ' ×' + k);
    }
  }
  return cuenta;
}

async function medir(leerDe) {
  const sitios = [];
  for (const s of SITIOS) sitios.push(await medirSitio(s, leerDe));
  // Ante el MISMO fallo, ¿las dos pantallas de la app dicen lo mismo? (los fallos que no delatan a nadie)
  const [a, b] = sitios.filter((x) => x.app === 'transporte');
  const fallosDistintos = (a && b && !a.falta && !b.falta)
    ? RESPUESTAS.filter((y) => y.codigo && y.id !== 'noExisteDelata' && soloTexto(a.por[y.id]) !== soloTexto(b.por[y.id])).length : null;
  return { sitios, llamadas: contarLlamadas(leerDe), pieza: !!leerDe('guajirago/src/recuperarContrasena.js'), fallosDistintos };
}

async function main() {
  const commit = argumento('--commit');
  const r = await medir(lector(commit));
  console.log('🔑 Recuperar la contraseña — ' + (commit ? 'la app en el commit ' + commit : 'el disco'));
  console.log('  llamadas a sendPasswordResetEmail: ' + Object.entries(r.llamadas).map(([a, l]) => a + ' [' + (l.join(', ') || '0') + ']').join(' · '));
  console.log('  la pieza guajirago/src/recuperarContrasena.js: ' + (r.pieza ? 'sí' : 'no existe'));
  for (const s of r.sitios) {
    console.log('\n  ' + s.app + ' · ' + s.archivo + ' → ' + s.funcion + (s.fuera ? ' (fuera de la cuenta)' : ' (dentro de la cuenta)'));
    if (s.falta) { console.log('    🔴 no encontré la función'); continue; }
    for (const x of RESPUESTAS) console.log('    · ' + x.que.padEnd(46) + ' → ' + frase(s.por[x.id]));
    console.log('    mentiras: ' + (s.mentiras.length ? s.mentiras.length + ' (' + s.mentiras.join('; ') + ')' : '0'));
    if (s.fuera) console.log('    delata qué correos existen: ' + (s.delata ? 'SÍ' : 'no'));
    console.log('    dice la verdad del fallo: ' + s.verdades.map((v) => v.que + ' ' + (v.dice ? '✓' : '✗')).join(' · '));
  }
  const app = r.sitios.filter((s) => s.app === 'transporte' && !s.falta);
  console.log('\n  RESUMEN DE LA APP DE TRANSPORTE (lo de G71):');
  console.log('    mentiras: ' + app.reduce((n, s) => n + s.mentiras.length, 0) + ' · delata correos: ' + app.filter((s) => s.delata).length
    + ' · fallos con la verdad: ' + app.reduce((n, s) => n + s.verdades.filter((v) => v.dice).length, 0) + '/' + app.reduce((n, s) => n + s.verdades.length, 0)
    + ' · fallos en que las dos pantallas dicen distinto: ' + r.fallosDistintos + '/' + RESPUESTAS.filter((y) => y.codigo && y.id !== 'noExisteDelata').length);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medir, medirSitio, laFuncion, laPieza, lector, SITIOS, RESPUESTAS };
