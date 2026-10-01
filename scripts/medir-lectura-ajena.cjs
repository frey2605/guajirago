#!/usr/bin/env node
/**
 * 👀 ¿QUÉ PUEDE LEER DE OTRAS PERSONAS ALGUIEN QUE SOLO TIENE CUENTA? — SOLO LECTURA.
 *
 * Pasos 1 y 12 de P18 (1-oct-2026). Lee `firestore.rules` y saca, colección por colección, las que dejan LEER a
 * cualquiera con sesión (la condición es `request.auth != null` a secas, sin mirar de quién es el documento). Para
 * cada una dice:
 *   · QUIÉN LA LEE en el código: la app (pasajero y conductor), aliados, el panel y las funciones. Las funciones usan
 *     el SDK de administrador y el panel entra como admin: ninguno de los dos necesita la puerta abierta a todos.
 *     Solo la app y aliados la necesitan (sus usuarios no son admin).
 *   · con --publicado, lo mismo en los paquetes PUBLICADOS en producción de las tres apps.
 *   · con --nube, cuántos documentos hay en producción y qué datos de personas llevan (uid, teléfono, aparato, nombre…).
 *   · con --commit <hash>, las reglas de ese commit (para el careo antes/después).
 * Veredicto: las abiertas que NINGUNA app de usuario lee. Ésas se pueden cerrar sin romper nada.
 *
 *   node scripts/medir-lectura-ajena.cjs [--commit <hash>] [--publicado] [--nube]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');

function leerRaiz(commit, rel) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Quita los comentarios `//` y `/* *\/` sin tocar lo que va entre comillas. */
function sinComentarios(texto) {
  let r = '';
  let comilla = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) {
      r += c;
      if (c === '\\') { r += texto[i + 1] || ''; i++; } else if (c === comilla) comilla = null;
      continue;
    }
    if (c === '"' || c === "'") { comilla = c; r += c; continue; }
    if (c === '/' && texto[i + 1] === '/') { while (i < texto.length && texto[i] !== '\n') i++; r += '\n'; continue; }
    if (c === '/' && texto[i + 1] === '*') { i += 2; while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) i++; i++; continue; }
    r += c;
  }
  return r;
}

/**
 * Todas las lecturas de las reglas: [{ ruta, ops, condicion }], con la ruta entera (los `match` anidados se suman).
 * `ops` son las de lectura que nombra ese `allow` (read, get, list).
 */
function lecturasDeLasReglas(reglas) {
  const t = sinComentarios(reglas.replace(/\r\n/g, '\n'));
  const pila = [];
  let prof = 0;
  const salida = [];
  const re = /allow\s+([a-z,\s]+?)\s*:\s*if\s+([^;]+);|match\s+(\S+)\s*\{|\{|\}/g;
  let m;
  while ((m = re.exec(t))) {
    if (m[1] !== undefined) {
      const ops = m[1].split(',').map((s) => s.trim()).filter((o) => ['read', 'get', 'list'].includes(o));
      if (ops.length) salida.push({ ruta: pila.map((p) => p.ruta).join(''), ops, condicion: m[2].replace(/\s+/g, ' ').trim() });
    } else if (m[3] !== undefined) {
      prof += 1;
      pila.push({ ruta: m[3], prof });
    } else if (m[0] === '{') {
      prof += 1;
    } else {
      if (pila.length && pila[pila.length - 1].prof === prof) pila.pop();
      prof -= 1;
    }
  }
  return salida.map((l) => ({ ...l, ruta: l.ruta.replace(/^\/databases\/\{database\}\/documents/, '') }));
}

/** ¿La condición deja pasar a cualquiera con sesión, sin mirar de quién es el documento? */
function abiertaATodos(condicion) {
  const c = condicion.replace(/\s+/g, ' ').trim();
  return c === 'true' || c === 'request.auth != null' || c === 'request.auth!=null';
}

/** Las colecciones que cualquiera con sesión puede leer: [{ ruta, coleccion, ops }]. */
function abiertas(reglas) {
  const porRuta = new Map();
  for (const l of lecturasDeLasReglas(reglas)) {
    if (!abiertaATodos(l.condicion)) continue;
    const previo = porRuta.get(l.ruta) || [];
    porRuta.set(l.ruta, [...previo, ...l.ops]);
  }
  return [...porRuta.entries()].map(([ruta, ops]) => {
    const literales = ruta.split('/').filter((s) => s && !s.startsWith('{'));
    return { ruta, coleccion: literales[literales.length - 1], ops: [...new Set(ops)] };
  });
}

const APPS = [
  { app: 'app', carpeta: 'guajirago/src', necesita: true },
  { app: 'aliados', carpeta: 'guajirago-aliados/src', necesita: true },
  { app: 'panel', carpeta: 'guajirago-admin/src', necesita: false },
  { app: 'funciones', carpeta: 'guajirago/functions', necesita: false },
];

function archivosDe(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...archivosDe(p));
    else if (/\.(c?js|jsx)$/.test(e.name) && !/\.test\.js$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Renglones de un texto que nombran la colección ENTRE COMILLAS (un comentario no cuenta). */
function nombraEn(texto, coleccion) {
  const re = new RegExp('[\'"`/]' + coleccion + '[\'"`/]');
  const renglones = [];
  texto.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const codigo = l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/\s.*$/, '');
    if (re.test(codigo)) renglones.push(i + 1);
  });
  return renglones;
}

/** Quién nombra cada colección en el código de las tres apps y las funciones: { app: ['archivo:renglón', ...] }. */
function lectoresEnCodigo(coleccion, raiz = RAIZ) {
  const r = {};
  for (const { app, carpeta } of APPS) {
    for (const f of archivosDe(path.join(raiz, carpeta))) {
      for (const n of nombraEn(fs.readFileSync(f, 'utf8'), coleccion)) {
        (r[app] = r[app] || []).push(path.relative(raiz, f).replace(/\\/g, '/') + ':' + n);
      }
    }
  }
  return r;
}

/** ¿Alguna app de USUARIO (no admin, no servidor) la nombra? */
function laNecesitaUnaApp(lectores) {
  return APPS.filter((a) => a.necesita).some((a) => (lectores[a.app] || []).length > 0);
}

const SITIOS = { app: 'guajirago', aliados: 'guajirago-aliados', panel: 'guajirago-admin' };
async function paquete(sitio) {
  const html = await (await fetch('https://' + sitio + '.web.app/')).text();
  const m = /static\/js\/main\.[0-9a-f]+\.js/.exec(html);
  if (!m) throw new Error('no encontré el paquete en ' + sitio + '.web.app');
  return { nombre: m[0], texto: await (await fetch('https://' + sitio + '.web.app/' + m[0])).text() };
}
/** Veces que el paquete minificado nombra la colección entre comillas. */
function vecesEnPaquete(texto, coleccion) {
  return (texto.match(new RegExp('["\'`/]' + coleccion + '["\'`/]', 'g')) || []).length;
}

// Los campos que dicen algo de una PERSONA.
const PERSONALES = /^(uid|pasajeroId|conductorId|clienteId|calificadoId|autorId|usuarioId|telefono|celular|nombre|nombreCliente|cliente|email|correo|deviceId|ubicacion|fcmToken|placa|cedula|direccion|comentario|veces)$/;

/** De los documentos de una colección: cuántos, qué campos de personas llevan, y cuántos se llaman como un uid. */
function datosDePersonas(docs, uids) {
  const campos = {};
  for (const d of docs) for (const k of Object.keys(d)) if (k !== 'id' && PERSONALES.test(k)) campos[k] = (campos[k] || 0) + 1;
  return { docs: docs.length, campos, idEsUid: docs.filter((d) => uids.has(d.id)).length };
}

async function traerRuta(ruta, N) {
  const partes = ruta.split('/').filter(Boolean);
  if (partes.length === 2) return (await N.traer(partes[0])).map(N.doc);
  if (partes.length === 4) {
    const padres = (await N.traer(partes[0])).map(N.doc);
    const todos = [];
    for (const p of padres) todos.push(...(await N.traer(partes[0] + '/' + p.id + '/' + partes[2])).map(N.doc));
    return todos;
  }
  return [];
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const lista = abiertas(leerRaiz(commit, 'firestore.rules'));
  const publicados = {};
  if (process.argv.includes('--publicado')) for (const [app, sitio] of Object.entries(SITIOS)) publicados[app] = await paquete(sitio); // eslint-disable-line no-await-in-loop
  let N = null;
  let uids = new Set();
  if (process.argv.includes('--nube')) {
    N = require('./nube.cjs');
    uids = new Set((await N.traer('usuarios')).map((d) => N.doc(d).id));
  }

  console.log('── LO QUE CUALQUIERA CON SESIÓN PUEDE LEER · reglas ' + (commit || 'de hoy') + ' ──');
  const sinLector = [];
  for (const c of lista) {
    const lectores = lectoresEnCodigo(c.coleccion);
    let necesita = laNecesitaUnaApp(lectores);
    console.log('\n· ' + c.ruta + '  (' + c.ops.join(', ') + ' abierto a todos)');
    for (const { app } of APPS) console.log('    ' + app.padEnd(10) + (lectores[app] ? lectores[app].length + ' sitio(s): ' + lectores[app].slice(0, 4).join(' · ') + (lectores[app].length > 4 ? ' …' : '') : '—'));
    if (Object.keys(publicados).length) {
      const veces = Object.fromEntries(Object.entries(publicados).map(([app, p]) => [app, vecesEnPaquete(p.texto, c.coleccion)]));
      console.log('    publicado ' + Object.entries(veces).map(([a, n]) => a + ' ' + n).join(' · '));
      if (veces.app || veces.aliados) necesita = true;
    }
    if (N) {
      const d = datosDePersonas(await traerRuta(c.ruta, N), uids); // eslint-disable-line no-await-in-loop
      console.log('    producción ' + d.docs + ' doc(s) · datos de personas: ' + (Object.entries(d.campos).map(([k, n]) => k + '×' + n).join(', ') || 'ninguno')
        + (d.idEsUid ? ' · ' + d.idEsUid + ' se llaman como el uid de alguien' : ''));
    }
    console.log('    ' + (necesita ? '✓ la lee una app de usuario: se queda abierta (ver el informe)' : '🔴 NINGUNA app de usuario la lee: no hace falta que esté abierta a todos'));
    if (!necesita) sinLector.push(c.ruta);
  }
  console.log('\n── VEREDICTO ──');
  console.log('  abiertas a cualquiera con sesión: ' + lista.length + ' · sin ninguna app de usuario que las lea: ' + sinLector.length
    + (sinLector.length ? ' (' + sinLector.join(', ') + ')' : ''));
  if (N && N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { sinComentarios, lecturasDeLasReglas, abiertaATodos, abiertas, nombraEn, lectoresEnCodigo, laNecesitaUnaApp, vecesEnPaquete, datosDePersonas, paquete };
