#!/usr/bin/env node
/**
 * ⭐ ¿DÓNDE VIVEN LOS LUGARES FAVORITOS DEL PASAJERO? — gemelo G67 (29-sep-2026), SOLO LECTURA.
 *
 * Los favoritos se guardaban en DOS sitios:
 *   · en la NUBE, `usuarios/{uid}.favoritos` (Solicitar.js: se guardan, se borran, con el tope de config/global);
 *   · en el TELÉFONO, `localStorage['guajirago_favoritos']` (Home.js: sin tope, con su propia ventanita
 *     «Agregar lugar favorito» y su propio cuadro de sugerencias de Google).
 * La del teléfono es de junio (19 al 25-jun-2026, repo anidado): el 25-jun la lista y el botón salieron de Home
 * («Home limpio», 022510f) y los favoritos pasaron a la nube (8789507). Lo que quedó en Home.js desde entonces se
 * LEE al abrir la pantalla y no se pinta, y la ventanita que escribe no la abre nadie.
 *
 *   node scripts/medir-favoritos-g67.cjs                      <- el código de hoy (el disco) + producción
 *   node scripts/medir-favoritos-g67.cjs --commit <raíz> --admin <hash> --aliados <hash>   <- otros commits (careo)
 *   --sin-nube                                                <- no lee producción
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. TELÉFONO: en las TRES apps (y las funciones), cada llamada a `localStorage` cuya clave (el texto, o la constante
 *     que la guarda) habla de favoritos. Lecturas y escrituras, archivo por archivo.
 *  2. ¿Hay CAMINO VIVO al teléfono? Se CORREN las funciones de Home.js que tocan el teléfono con un localStorage de
 *     mentira (un aparato con 2 favoritos de junio guardados) para ver qué leen y qué escriben; y se mira quién abre la
 *     ventanita que escribe (`setMostrarModalFavorito(...)` con algo que no sea `false`) y si lo leído se pinta.
 *  3. NUBE: quién escribe `favoritos` en el documento del usuario y quién lo lee, en las tres apps y en las funciones.
 *  4. El cuadro de sugerencias: si la tabla `SUGERENCIAS` (las dos copias) tiene el uso «favorito» y quién lo pide.
 *  5. PRODUCCIÓN (solo lectura): cuántos usuarios tienen favoritos en la nube, cuántos cada uno, el tope de hoy y
 *     cuántos pasan del tope. Lo que haya en los TELÉFONOS no se puede medir desde aquí: vive en cada aparato.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo: sinComentariosCortos, sinTextos, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

// Quita los comentarios DEJANDO el mismo largo y los mismos renglones (cargar.cjs los quita y corre los renglones):
// así el renglón que se nombra es el del archivo de verdad.
const soloCodigo = (t) => sinComentariosCortos(t.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')));

const REPOS = { 'guajirago-admin/': 'admin', 'guajirago-aliados/': 'aliados' };
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src', 'guajirago/functions'];
const PIEZAS_SUGERENCIAS = ['guajirago/src/sugerenciasDeDirecciones.js', 'guajirago-aliados/src/sugerenciasDeDirecciones.js'];
const CLAVE_DE_FAVORITOS = /favorit/i;

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo del disco, o del commit de SU repo (admin y aliados son repos aparte). */
function lector(commits = {}) {
  const lectorDe = (r) => {
    const pre = Object.keys(REPOS).find((p) => r.startsWith(p));
    const commit = pre ? commits[REPOS[pre]] : commits.raiz;
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      const cwd = pre ? path.join(RAIZ, pre) : RAIZ;
      const ruta = pre ? r.slice(pre.length) : r;
      return execFileSync('git', ['show', commit + ':' + ruta], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
  lectorDe.commits = commits;
  return lectorDe;
}

/** Los .js de una carpeta. Del disco se listan; de un commit, se le pregunta a git. */
function archivosJs(leerDe, dir) {
  const pre = Object.keys(REPOS).find((p) => dir.startsWith(p));
  const commit = pre ? leerDe.commits[REPOS[pre]] : leerDe.commits.raiz;
  const vale = (r) => /\.(js|cjs)$/.test(r) && !/\.test\.js$/.test(r) && !/(^|\/)(node_modules|build)\//.test(r);
  if (commit) {
    try {
      const cwd = pre ? path.join(RAIZ, pre) : RAIZ;
      const sub = pre ? dir.slice(pre.length) : dir;
      const l = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', sub], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return l.split('\n').filter(Boolean).map((r) => (pre || '') + r).filter(vale);
    } catch (e) { return []; }
  }
  const fuera = [];
  const recorrer = (d) => {
    const abs = path.join(RAIZ, d);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = d + '/' + e.name;
      if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'build') recorrer(r); }
      else if (vale(r)) fuera.push(r);
    }
  };
  recorrer(dir);
  return fuera;
}

/** Lo que va dentro de los paréntesis que abren en `i` (i apunta al `(`). */
function dentroDeParentesis(seguro, original, i) {
  let p = 0;
  for (let j = i; j < seguro.length; j += 1) {
    if (seguro[j] === '(') p += 1;
    else if (seguro[j] === ')') { p -= 1; if (p === 0) return original.slice(i + 1, j); }
  }
  return null;
}

/** 1 · Las llamadas a localStorage de un archivo cuya clave habla de favoritos. */
function telefonoDe(texto) {
  const codigo = soloCodigo(texto);
  const seguro = sinTextos(codigo);
  // Las constantes de texto del archivo, para resolver `localStorage.getItem(STORAGE_FAVORITOS)`.
  const constantes = {};
  for (const m of codigo.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(['"`])([^'"`]*)\2/g)) constantes[m[1]] = m[3];
  const lecturas = []; const escrituras = [];
  const re = /localStorage\s*(?:\.\s*(getItem|setItem|removeItem)\s*\(|\[)/g;
  let m;
  while ((m = re.exec(seguro))) {
    const inicio = m.index + m[0].length - 1;
    const arg = m[1] ? dentroDeParentesis(seguro, codigo, inicio) : codigo.slice(inicio + 1, seguro.indexOf(']', inicio));
    if (arg == null) continue;
    const clave = arg.split(',')[0].trim();
    const resuelta = constantes[clave] !== undefined ? constantes[clave] : clave;
    if (!CLAVE_DE_FAVORITOS.test(clave) && !CLAVE_DE_FAVORITOS.test(resuelta)) continue;
    const renglon = codigo.slice(0, m.index).split('\n').length;
    const esLectura = m[1] ? m[1] === 'getItem' : !/^\[[^\]]*\]\s*=[^=]/.test(seguro.slice(inicio, inicio + 200));
    (esLectura ? lecturas : escrituras).push({ renglon, clave: resuelta.replace(/['"`]/g, '') });
  }
  // Una clave de favoritos escrita como texto en cualquier sitio del archivo (aunque no se vea la llamada).
  const claves = [...codigo.matchAll(/(['"`])([^'"`\n]*favorit[^'"`\n]*)\1/gi)]
    .map((x) => x[2]).filter((k) => /^[a-z0-9_.-]+$/i.test(k) && /_/.test(k));
  return { lecturas, escrituras, claves };
}

/** 2 · Home.js: se CORRE lo que toca el teléfono, y se mira si hay quien abra la ventanita y si se pinta lo leído. */
function caminoVivoEnHome(leerDe) {
  const t = leerDe('guajirago/src/Home.js');
  if (!t) return { falla: 'no existe Home.js' };
  const codigo = soloCodigo(t);
  const seguro = sinTextos(codigo);
  // Lo que un teléfono usado entre el 19 y el 25-jun-2026 podría tener guardado.
  const DE_JUNIO = [{ nombre: 'Casa', direccion: 'Cra. 7 # 10-20', icono: '🏠' }, { nombre: 'Trabajo', direccion: 'Calle 15 # 5-30', icono: '💼' }];
  const guardado = {};
  const usos = [];
  const localStorage = {
    getItem: (k) => { usos.push('lee «' + k + '»'); return guardado[k] === undefined ? null : guardado[k]; },
    setItem: (k, v) => { usos.push('escribe «' + k + '»'); guardado[k] = String(v); },
    removeItem: (k) => { usos.push('borra «' + k + '»'); delete guardado[k]; },
  };
  // Las funciones de ARRIBA del archivo (fuera de los componentes) que tocan el teléfono con favoritos, sacadas y corridas.
  const constantes = [...codigo.matchAll(/^const\s+[A-Za-z0-9_]+\s*=\s*(['"`])[^'"`\n]*\1\s*;/gm)].map((x) => x[0]).join('\n');
  const funciones = [];
  for (const m of seguro.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)) {
    const f = cuerpoDeLaFuncion(codigo, m.index);
    if (!f) continue;
    const fin = codigo.indexOf(f.texto, m.index);
    if (fin < 0) continue;
    const trozo = codigo.slice(m.index, fin + f.texto.length + 1);
    if (!/localStorage/.test(trozo)) continue;
    const tel = telefonoDe(constantes + '\n' + trozo);
    if (tel.lecturas.length || tel.escrituras.length) funciones.push({ nombre: m[1], trozo });
  }
  const claveTel = (constantes.match(/(['"`])([^'"`]*favorit[^'"`]*)\1/i) || [])[2];
  const corridas = [];
  for (const f of funciones) {
    for (const k of Object.keys(guardado)) delete guardado[k];
    if (claveTel) guardado[claveTel] = JSON.stringify(DE_JUNIO);
    usos.length = 0;
    let devuelve;
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('localStorage', constantes + '\n' + f.trozo + '\nreturn ' + f.nombre + ';')(localStorage);
      devuelve = fn.length ? fn(DE_JUNIO) : fn();
    } catch (e) { devuelve = 'reventó: ' + e.message; }
    corridas.push({ nombre: f.nombre, hace: usos.slice(), devuelve: Array.isArray(devuelve) ? devuelve.length + ' favorito(s)' : String(devuelve) });
  }
  // ¿Quién abre la ventanita del teléfono? `setMostrarModalFavorito(x)` con x distinto de `false`.
  const abridores = [...seguro.matchAll(/setMostrarModalFavorito\s*\(/g)]
    .map((x) => dentroDeParentesis(seguro, codigo, x.index + x[0].length - 1))
    .filter((a) => a !== null && a.trim() !== 'false');
  const hayVentanita = /function\s+ModalFavorito\b/.test(seguro);
  // ¿Se lee al abrir la pantalla? `useState(cargarFavoritos())` o similar.
  const seLeeAlAbrir = funciones.some((f) => new RegExp('useState\\s*\\(\\s*' + f.nombre + '\\s*\\(').test(seguro));
  // ¿Se pinta lo leído? Usos del estado `favoritos` que no sean declararlo ni copiarlo (`...favoritos`) para guardarlo.
  const decl = seguro.match(/const\s*\[\s*favoritos\s*,\s*setFavoritos\s*\]\s*=\s*useState/);
  let sePinta = 0;
  if (decl) {
    const dondeDecl = decl.index + decl[0].indexOf('favoritos');
    sePinta = [...seguro.matchAll(/\bfavoritos\b/g)]
      .filter((x) => x.index !== dondeDecl && !/\.\.\.\s*$/.test(seguro.slice(x.index - 4, x.index))).length;
  }
  return { funciones: corridas, abridores, hayVentanita, seLeeAlAbrir, sePinta };
}

/** 3 · La nube: quién escribe y quién lee `favoritos` del documento del usuario. */
function nubeDe(texto) {
  const codigo = soloCodigo(texto);
  const seguro = sinTextos(codigo);
  const escrituras = [];
  for (const m of seguro.matchAll(/\b(updateDoc|setDoc)\s*\(/g)) {
    const arg = dentroDeParentesis(seguro, codigo, m.index + m[0].length - 1);
    if (arg && /usuarios/.test(arg) && /\bfavoritos\s*:/.test(arg)) escrituras.push(codigo.slice(0, m.index).split('\n').length);
  }
  // `...favoritos` (copiar la lista) no es leer la nube: se exige un solo punto delante.
  const lecturas = [...seguro.matchAll(/(?<!\.)\.favoritos\b/g)].map((m) => codigo.slice(0, m.index).split('\n').length);
  return { escrituras, lecturas };
}

/** 4 · El uso «favorito» del cuadro de sugerencias: en la tabla y en quien lo pide. */
function sugerenciasDe(leerDe, archivos) {
  const tabla = PIEZAS_SUGERENCIAS.map((r) => {
    const t = leerDe(r);
    if (!t) return { r, estado: 'no existe' };
    const m = soloCodigo(t).replace(/\r\n/g, '\n').match(/SUGERENCIAS\s*=\s*\{([\s\S]*?)\n\};/);
    return { r, tieneFavorito: !!(m && /^\s*favorito\s*:/m.test(m[1])) };
  });
  const quienLoPide = [];
  for (const r of archivos) {
    const t = leerDe(r);
    if (!t) continue;
    const c = soloCodigo(t);
    for (const m of c.matchAll(/ponerSugerencias\s*\([^)]*['"`]favorito['"`]\s*\)/g)) {
      quienLoPide.push(r + ':' + c.slice(0, m.index).split('\n').length);
    }
  }
  return { tabla, quienLoPide };
}

function medirCodigo(leerDe) {
  const archivos = CARPETAS.flatMap((c) => archivosJs(leerDe, c));
  const telefono = []; const nube = [];
  for (const r of archivos) {
    const t = leerDe(r);
    if (!t) continue;
    const tel = telefonoDe(t);
    if (tel.lecturas.length || tel.escrituras.length || tel.claves.length) telefono.push({ r, ...tel });
    const n = nubeDe(t);
    if (n.escrituras.length || n.lecturas.length) nube.push({ r, ...n });
  }
  const home = caminoVivoEnHome(leerDe);
  const sug = sugerenciasDe(leerDe, archivos);
  const lecturasTel = telefono.reduce((a, x) => a + x.lecturas.length, 0);
  const escriturasTel = telefono.reduce((a, x) => a + x.escrituras.length, 0);
  const clavesTel = telefono.reduce((a, x) => a + x.claves.length, 0);
  const fuentes = (nube.length ? 1 : 0) + (lecturasTel + escriturasTel + clavesTel ? 1 : 0);
  return { archivos: archivos.length, carpetas: CARPETAS.map((c) => [c, archivos.filter((r) => r.startsWith(c + '/')).length]), telefono, lecturasTel, escriturasTel, clavesTel, nube, home, sug, fuentes };
}

async function medirProduccion() {
  const { traer, doc } = require('./nube.cjs');
  const config = (await traer('config')).map(doc);
  const global = config.find((d) => d.id === 'global') || {};
  const usuarios = (await traer('usuarios')).map(doc);
  const conLista = usuarios.filter((u) => Array.isArray(u.favoritos));
  const porCuantos = {};
  for (const u of conLista) porCuantos[u.favoritos.length] = (porCuantos[u.favoritos.length] || 0) + 1;
  const total = conLista.reduce((a, u) => a + u.favoritos.length, 0);
  const tope = Number(global.maximoFavoritos);
  const encima = Number.isFinite(tope) && tope > 0 ? conLista.filter((u) => u.favoritos.length > tope).length : null;
  const formas = {};
  for (const u of conLista) for (const f of u.favoritos) {
    const k = Object.keys(f || {}).sort().join(',');
    formas[k] = (formas[k] || 0) + 1;
  }
  return { usuarios: usuarios.length, conLista: conLista.length, total, porCuantos, tope: global.maximoFavoritos, encima, formas };
}

function imprimir(r) {
  console.log('\n══ 1 · EN EL TELÉFONO (localStorage con clave de favoritos), en ' + r.archivos + ' archivos de las 3 apps y funciones ══');
  if (!r.telefono.length) console.log('  ninguno');
  for (const x of r.telefono) {
    console.log('  ' + x.r + ': ' + x.lecturas.length + ' lectura(s)' + (x.lecturas.length ? ' (renglón ' + x.lecturas.map((l) => l.renglon).join(', ') + ')' : '')
      + ' · ' + x.escrituras.length + ' escritura(s)' + (x.escrituras.length ? ' (renglón ' + x.escrituras.map((l) => l.renglon).join(', ') + ')' : '')
      + (x.claves.length ? ' · clave ' + [...new Set(x.claves)].join(', ') : ''));
  }
  console.log('  TOTAL: ' + r.lecturasTel + ' lectura(s) · ' + r.escriturasTel + ' escritura(s)');
  const h = r.home;
  console.log('\n══ 2 · ¿HAY CAMINO VIVO AL TELÉFONO? (Home.js, corrido con un aparato que guardó 2 favoritos en junio) ══');
  if (h.falla) console.log('  ✗ ' + h.falla);
  else {
    if (!h.funciones.length) console.log('  Home.js no tiene ninguna función que toque el teléfono');
    for (const f of h.funciones) console.log('  ' + f.nombre + '(): ' + (f.hace.join(' · ') || 'nada') + ' → ' + f.devuelve);
    console.log('  se lee al abrir la pantalla: ' + (h.seLeeAlAbrir ? 'SÍ' : 'no'));
    console.log('  lo leído se pinta en pantalla: ' + (h.sePinta ? 'SÍ (' + h.sePinta + ' uso(s))' : 'no'));
    console.log('  ventanita «Agregar lugar favorito» (la que escribe en el teléfono): ' + (h.hayVentanita ? 'existe' : 'no existe')
      + ' · quién la abre: ' + (h.abridores.length ? h.abridores.join(', ') : 'NADIE'));
  }
  console.log('\n══ 3 · EN LA NUBE (usuarios/{uid}.favoritos) ══');
  for (const x of r.nube) console.log('  ' + x.r + ': escribe en renglón ' + (x.escrituras.join(', ') || '—') + ' · lee en renglón ' + (x.lecturas.join(', ') || '—'));
  console.log('\n══ 4 · EL USO «favorito» DEL CUADRO DE SUGERENCIAS ══');
  for (const t of r.sug.tabla) console.log('  ' + t.r + ': ' + (t.estado || (t.tieneFavorito ? 'lo tiene' : 'no lo tiene')));
  console.log('  quién lo pide: ' + (r.sug.quienLoPide.join(', ') || 'nadie'));
  console.log('\n  FUENTES DE FAVORITOS CON CÓDIGO: ' + r.fuentes + (r.fuentes > 1 ? '  🔴 (nube y teléfono)' : '  ✓ (una)'));
}

module.exports = { medirCodigo, lector, telefonoDe, nubeDe, caminoVivoEnHome, sugerenciasDe };

if (require.main === module) {
  (async () => {
    const commits = { raiz: argumento('--commit'), admin: argumento('--admin'), aliados: argumento('--aliados') };
    const hayCommit = commits.raiz || commits.admin || commits.aliados;
    console.log('Favoritos del pasajero · ' + (hayCommit
      ? 'raíz ' + (commits.raiz || 'disco') + ' · admin ' + (commits.admin || 'disco') + ' · aliados ' + (commits.aliados || 'disco')
      : 'el disco'));
    imprimir(medirCodigo(lector(commits)));
    if (!process.argv.includes('--sin-nube')) {
      const p = await medirProduccion();
      console.log('\n══ 5 · PRODUCCIÓN (solo lectura) ══');
      console.log('  usuarios: ' + p.usuarios + ' · con lista de favoritos en la nube: ' + p.conLista + ' · favoritos guardados en total: ' + p.total);
      console.log('  cuántos tiene cada uno → ' + (Object.keys(p.porCuantos).sort((a, b) => a - b).map((k) => k + ': ' + p.porCuantos[k] + ' usuario(s)').join(' · ') || 'nadie'));
      console.log('  tope de hoy (config/global.maximoFavoritos): ' + JSON.stringify(p.tope) + ' · por encima del tope: ' + p.encima);
      console.log('  forma de cada favorito → ' + (Object.entries(p.formas).map(([k, n]) => '{' + k + '}: ' + n).join(' · ') || '—'));
      console.log('  lo guardado en los TELÉFONOS no se puede medir desde aquí (vive en cada aparato).');
    }
  })().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
