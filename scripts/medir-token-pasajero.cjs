#!/usr/bin/env node
/**
 * 🔔 ¿A QUÉ TOKEN LE AVISA EL SERVIDOR AL PASAJERO? — P23, SOLO LECTURA.
 *
 * El pendiente decía: «en producción hay 0 de 92 viajes con token de avisos del pasajero; parece que el aviso
 * "tienes una oferta" casi nunca llega». Este guion mide de dónde sale ese número y si el aviso PUEDE llegar:
 *
 *   1. EL CÓDIGO: dónde pega la app el token del pasajero (Solicitar.js, con prepararTokenDeAvisos de Notificaciones.js)
 *      y dónde lo busca cada aviso del servidor al pasajero. Si lo busca donde la app no lo pone, ese aviso no llega
 *      NUNCA, tenga el pasajero el permiso que tenga.
 *   2. LA NUBE (lo publicado): los avisos al pasajero que hay PUESTOS en producción, con su código bajado del servidor.
 *      Uno de ellos, `notificarConductorEnPunto` («¡Tu conductor llegó!»), se publicó en junio y su código ya no está
 *      en este repo: solo se puede saber dónde busca el token bajándolo.
 *   3. LOS DATOS de producción: cuántos viajes llevan token (en el viaje o en su cajón de contacto), separando los que
 *      nacieron ANTES de que existiera el código que lo pega (12-jul-2026, commit ba179ea), y cuántas fichas
 *      (`usuarios/{uid}`) tienen `fcmToken`.
 *
 *   node scripts/medir-token-pasajero.cjs                 → el código de hoy + la nube + los datos
 *   node scripts/medir-token-pasajero.cjs --ref 2f7efd3   → el código de ese commit (para carear el antes)
 *   node scripts/medir-token-pasajero.cjs --sin-datos     → solo el código (sin red)
 *
 * No escribe nada en ningún sitio. Lo vigila pruebas/tokenDelPasajero.test.js.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const NACIO_EL_CODIGO = '2026-07-12'; // ba179ea: el mercado de ofertas y el primer pegado del token del pasajero

function leerDe(ref, archivo) {
  if (ref) {
    try { return execSync('git show ' + ref + ':' + archivo, { cwd: RAIZ, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return ''; }
  }
  const p = path.join(RAIZ, archivo);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

/** Sin comentarios de renglón ni de bloque (para que una nota no cuente como código). */
function soloCodigo(t) {
  return t.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
    .map((l) => l.replace(/(^|[^:'"\\])\/\/.*$/, '$1')).join('\n');
}

/**
 * ¿Dónde pega la app el token del pasajero? Función pura: recibe el texto de Solicitar.js.
 * Devuelve { donde: 'ficha' | 'contacto' | 'viaje' | 'otro (…)' | 'no lo pega', campo }.
 */
function dondePegaLaApp(textoSolicitar) {
  const t = soloCodigo(textoSolicitar);
  const prep = t.match(/const\s+(\w+)\s*=\s*prepararTokenDeAvisos\(\s*'(\w+)'\s*\)/);
  if (!prep) return { donde: 'no lo pega', campo: null };
  const [, pegar, campo] = prep;
  const llamada = t.match(new RegExp('\\b' + pegar + '\\(\\s*((?:[^()]|\\([^()]*\\))*?)\\s*\\)'));
  if (!llamada) return { donde: 'no lo pega', campo };
  let arg = llamada[1];
  const def = /^\w+$/.test(arg) && t.match(new RegExp('const\\s+' + arg + '\\s*=\\s*([^;]+);'));
  if (def) arg = def[1].trim();
  if (/^doc\(\s*db\s*,\s*'usuarios'\s*,\s*user\.uid\s*\)$/.test(arg)) return { donde: 'ficha', campo };
  if (/^refContactoDelViaje\(/.test(arg)) return { donde: 'contacto', campo };
  if (/^await\s+addDoc\(\s*collection\(\s*db\s*,\s*'viajes'\s*\)/.test(arg)) return { donde: 'viaje', campo };
  return { donde: 'otro (' + arg.slice(0, 60) + ')', campo };
}

/**
 * ¿Dónde busca el token un aviso del servidor? Función pura: recibe el texto de la función (y, si la función le pregunta
 * a la pieza tokenDelPasajero, el texto de la pieza). Devuelve la lista de sitios, en el orden en que se nombran:
 * 'ficha' (usuarios/{uid}.fcmToken), 'contacto' (viajes/{id}/contacto/pasajero.pasajeroFcmToken) o 'viaje'.
 */
function dondeBuscaElServidor(textoFuncion, textoPieza = '') {
  let t = soloCodigo(textoFuncion);
  if (/\btokenDelPasajero\s*\(/.test(t)) t += '\n' + soloCodigo(textoPieza);
  // El orden es el de las LECTURAS del campo (`x.fcmToken`, `x.data().pasajeroFcmToken`): el primero que se lee es el
  // que manda cuando hay varios. Cada lectura se clasifica por el campo y por el nombre de lo que se lee.
  const leeLaFicha = /collection\(\s*["']usuarios["']\s*\)/.test(t);
  const leeElCajon = /collection\(\s*["']contacto["']\s*\)/.test(t);
  const sitios = [];
  for (const m of t.matchAll(/(\w+)(?:\.data\(\))?\.(fcmToken|pasajeroFcmToken)\b/g)) {
    const [, quien, campo] = m;
    let s = null;
    if (campo === 'fcmToken' && leeLaFicha && !/contacto|viaje/i.test(quien)) s = 'ficha';
    else if (campo === 'pasajeroFcmToken' && /contacto/i.test(quien) && leeElCajon) s = 'contacto';
    else if (campo === 'pasajeroFcmToken' && /viaje/i.test(quien)) s = 'viaje';
    if (s && !sitios.includes(s)) sitios.push(s);
  }
  return sitios;
}

/** El texto de una función exportada de index.js, hasta el siguiente export. */
function trozoDe(index, nombre) {
  const t = index.replace(/\r\n/g, '\n');
  const i = t.indexOf('exports.' + nombre + ' =');
  if (i < 0) return '';
  const fin = t.indexOf('\nexports.', i + 10);
  return t.slice(i, fin < 0 ? undefined : fin);
}

/** ¿Le dice la pantalla de pedir al pasajero que no le van a llegar los avisos? Función pura. */
function avisaSinPermiso(textoSolicitar) {
  return /avisoDeAvisos\(\s*permisoDeAvisos\(\)\s*,\s*'pasajero'\s*\)/.test(soloCodigo(textoSolicitar));
}

/** El veredicto: un aviso que busca donde la app no pega no llega nunca. Función pura. */
function veredicto({ app, avisos, ventanita }) {
  const v = [];
  for (const a of avisos) {
    if (!a.sitios.length) v.push('🔴 «' + a.nombre + '» no busca el token del pasajero en ningún sitio que yo conozca');
    else if (!a.sitios.includes(app.donde)) v.push('🔴 «' + a.nombre + '» busca el token en ' + a.sitios.join(' / ') + ' y la app lo pega en ' + app.donde + ': ese aviso NO LLEGA NUNCA');
  }
  if (app.donde === 'viaje') v.push('🔴 la app pega el token en el viaje del mercado (lo leen todos los conductores)');
  if (!ventanita) v.push('🟠 si el pasajero no da permiso de avisos, nadie se lo dice');
  return v;
}

/** De viajes y fichas ya leídos, las cuentas. Función pura. */
function contarDatos(viajes, contactos, fichas) {
  const conToken = (v) => (typeof v.pasajeroFcmToken === 'string' && v.pasajeroFcmToken)
    || (contactos[v.id] && contactos[v.id].pasajeroFcmToken);
  const despues = viajes.filter((v) => String(v.fechaSolicitud || '') >= NACIO_EL_CODIGO);
  const pasajeros = [...new Set(viajes.map((v) => v.pasajeroId).filter(Boolean))];
  const fichaDe = Object.fromEntries(fichas.map((f) => [f.id, f]));
  return {
    viajes: viajes.length,
    antesDelCodigo: viajes.length - despues.length,
    despuesDelCodigo: despues.length,
    conToken: viajes.filter(conToken).length,
    despuesConToken: despues.filter(conToken).length,
    conCajon: Object.keys(contactos).length,
    fichas: fichas.length,
    fichasConToken: fichas.filter((f) => typeof f.fcmToken === 'string' && f.fcmToken).length,
    pasajeros: pasajeros.length,
    pasajerosConTokenEnFicha: pasajeros.filter((p) => fichaDe[p] && fichaDe[p].fcmToken).length,
  };
}

/** Baja de la nube el código PUBLICADO de una función (solo lectura) y devuelve su index.js, o null. */
async function codigoPublicado(n, nombre) {
  const { permiso } = await n.token();
  const u = 'https://cloudfunctions.googleapis.com/v2/projects/' + n.PROYECTO + '/locations/us-central1/functions/' + nombre;
  const r = await fetch(u + ':generateDownloadUrl', { method: 'POST', headers: { Authorization: 'Bearer ' + permiso } });
  if (!r.ok) return null;
  const { downloadUrl } = await r.json();
  if (!downloadUrl) return null;
  const zip = Buffer.from(await (await fetch(downloadUrl)).arrayBuffer());
  const os = require('os');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p23-'));
  fs.writeFileSync(path.join(dir, 'f.zip'), zip);
  try {
    // Un .zip: `unzip` si lo hay; si no, el tar de Windows (bsdtar sí abre zip; el tar de GNU no).
    try { execSync('unzip -o -q f.zip', { cwd: dir, stdio: 'ignore' }); } catch (e) {
      execSync((process.platform === 'win32' ? '"' + path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') + '"' : 'tar') + ' -xf f.zip', { cwd: dir, stdio: 'ignore' });
    }
    const pieza = path.join(dir, 'tokenDelPasajero.cjs');
    return { index: fs.readFileSync(path.join(dir, 'index.js'), 'utf8'), pieza: fs.existsSync(pieza) ? fs.readFileSync(pieza, 'utf8') : '' };
  } catch (e) { return null; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

const AVISOS_EN_EL_CODIGO = ['notificarPasajeroOferta'];
const AVISOS_PUBLICADOS = ['notificarPasajeroOferta', 'notificarConductorEnPunto'];

async function main() {
  const i = process.argv.indexOf('--ref');
  const ref = i > 0 ? process.argv[i + 1] : null;
  const sinDatos = process.argv.includes('--sin-datos');
  const solicitar = leerDe(ref, 'guajirago/src/Solicitar.js');
  const index = leerDe(ref, 'guajirago/functions/index.js');
  const pieza = leerDe(ref, 'guajirago/functions/tokenDelPasajero.cjs');
  const app = dondePegaLaApp(solicitar);
  const ventanita = avisaSinPermiso(solicitar);
  console.log('🔔 EL TOKEN DE AVISOS DEL PASAJERO — código ' + (ref || 'de hoy'));
  console.log('  la app (Solicitar.js) lo pega en: ' + app.donde + (app.campo ? ' (campo ' + app.campo + ')' : ''));
  console.log('  si no da permiso, se le dice: ' + (ventanita ? 'sí, en una ventanita' : 'NO'));
  const avisos = AVISOS_EN_EL_CODIGO.map((nombre) => ({ nombre, sitios: dondeBuscaElServidor(trozoDe(index, nombre), pieza) }));
  for (const a of avisos) console.log('  servidor (repo) · ' + a.nombre + ' lo busca en: ' + (a.sitios.join(' → ') || 'ningún sitio'));

  if (!sinDatos) {
    const n = require('./nube.cjs');
    console.log('\n  LO PUBLICADO EN PRODUCCIÓN (bajado del servidor, solo lectura):');
    for (const nombre of AVISOS_PUBLICADOS) {
      // eslint-disable-next-line no-await-in-loop
      const cod = await codigoPublicado(n, nombre);
      if (!cod) { console.log('    ' + nombre + ': no pude bajar su código'); continue; }
      const enElRepo = AVISOS_EN_EL_CODIGO.includes(nombre);
      const sitios = dondeBuscaElServidor(trozoDe(cod.index, nombre), cod.pieza);
      console.log('    ' + nombre + (enElRepo ? '' : ' (su código NO está en el repo)') + ' lo busca en: ' + (sitios.join(' → ') || 'ningún sitio'));
      if (!enElRepo) avisos.push({ nombre, sitios });
    }
    const viajes = (await n.traer('viajes')).map(n.doc);
    const contactos = {};
    for (const v of viajes) {
      // eslint-disable-next-line no-await-in-loop
      const c = (await n.traer('viajes/' + v.id + '/contacto')).map(n.doc).find((d) => d.id === 'pasajero');
      if (c) contactos[v.id] = c;
    }
    const fichas = (await n.traer('usuarios')).map(n.doc);
    const d = contarDatos(viajes, contactos, fichas);
    console.log('\n  LOS DATOS DE PRODUCCIÓN (solo lectura):');
    console.log('    viajes: ' + d.viajes + ' · con token (en el viaje o en su cajón): ' + d.conToken);
    console.log('      nacidos ANTES del código que pega el token (' + NACIO_EL_CODIGO + '): ' + d.antesDelCodigo + ' — no podían llevarlo');
    console.log('      nacidos DESPUÉS: ' + d.despuesDelCodigo + ' · con token: ' + d.despuesConToken);
    console.log('    viajes con cajón de contacto (P21): ' + d.conCajon);
    console.log('    fichas (usuarios): ' + d.fichas + ' · con fcmToken: ' + d.fichasConToken);
    console.log('    pasajeros distintos: ' + d.pasajeros + ' · con token en su ficha: ' + d.pasajerosConTokenEnFicha);
  }
  const v = veredicto({ app, avisos, ventanita });
  console.log('\n── VEREDICTO ──\n  ' + (v.length ? v.join('\n  ') : '✓ todos los avisos al pasajero buscan el token donde la app lo pega, y si no da permiso se le dice'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { dondePegaLaApp, dondeBuscaElServidor, trozoDe, avisaSinPermiso, veredicto, contarDatos, NACIO_EL_CODIGO };
