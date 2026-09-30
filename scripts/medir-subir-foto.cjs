#!/usr/bin/env node
/**
 * SUBIR UNA FOTO Y PEDIR SU DIRECCIÓN — gemelo G82 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-subir-foto.cjs                  <- el código del disco, con fotos de mentira
 *   node scripts/medir-subir-foto.cjs --antes          <- el código de ANTES de G82 (los tres repos)
 *   node scripts/medir-subir-foto.cjs --nube           <- y además qué hay guardado en el almacén de PRODUCCIÓN
 *
 * Las tres apps suben fotos al almacén (Storage) en 13 sitios: la cédula y los papeles del conductor, su foto de
 * perfil, el comprobante de una recarga, las fotos del chat de un pedido, la imagen de un anuncio, el logo de un
 * negocio, la foto de un plato o de un tour y los comprobantes de pago de aliados. Los 13 hacían lo mismo, escrito a
 * mano cada vez: `ref(storage, ruta)`, `uploadBytes(ref, archivo)` y `getDownloadURL(ref)`. Desde G82 los 13 llaman
 * a la pieza `subirAlAlmacen(storage, ruta, archivo)` (guajirago/src/subirAlAlmacen.js, con copias idénticas en el
 * panel y en aliados). La RUTA y el nombre de cada foto los sigue decidiendo cada pantalla.
 *
 * Qué hace este guion:
 *   1. Saca de su archivo la función de cada uno de los 13 sitios y la CORRE ENTERA, tal como está escrita, con un
 *      almacén de mentira que apunta qué se subió (ruta, tipo, tamaño), qué dirección se pidió y a dónde fue a parar
 *      (qué estado o qué documento la recibió). Con cuatro fotos: una PNG, una JPEG, una que el teléfono NO dice de
 *      qué tipo es, y una que el almacén rechaza.
 *   2. Carea cada sitio con el de ANTES (los commits de ANTES, abajo): tiene que dar exactamente lo mismo, salvo el
 *      tipo de la foto sin tipo (antes el SDK la guardaba como `application/octet-stream`; ahora `image/jpeg`).
 *   3. Cuenta cuántas veces se escribe la subida a mano (`uploadBytes(`) en las tres apps fuera de la pieza, y si
 *      las tres copias de la pieza son idénticas.
 *   4. Con --nube: lista el almacén de producción (nombre, tipo y tamaño de cada archivo, sin bajar ninguno) y cuenta
 *      por carpeta cuántos se guardaron como imagen y cuántos como `application/octet-stream` (subidos sin tipo).
 *      No imprime nombres de archivo (llevan uids): solo cuenta.
 *
 * Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

// El último commit de cada repo antes de G82.
const ANTES = { '.': '5ddbeb1', 'guajirago-admin': 'bacc0c0', 'guajirago-aliados': '8fd4175' };
const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const PIEZAS = APPS.map((a) => a + '/subirAlAlmacen.js');
const BUCKET = 'guajirago.firebasestorage.app';

// Los 13 sitios: el archivo, la función que sube, y con qué se le llama (`F` es la foto del caso).
const SITIOS = [
  { archivo: 'guajirago/src/App.js', funcion: 'subirFoto', llamar: (fn, F) => fn(F, 'cedula', 'UID1') },
  { archivo: 'guajirago/src/Creditos.js', funcion: 'enviarComprobante', llamar: (fn, F) => fn(F) },
  { archivo: 'guajirago/src/MiPerfil.js', funcion: 'guardar', llamar: (fn) => fn() },
  { archivo: 'guajirago/src/Restaurantes.js', funcion: 'subirImagenChat', llamar: (fn, F) => fn(F) },
  { archivo: 'guajirago-admin/src/Superadmin.js', funcion: 'subirImagenAnuncio', llamar: (fn, F) => fn(F) },
  { archivo: 'guajirago-aliados/src/Menu.js', funcion: 'subirImagen', llamar: (fn, F) => fn(F) },
  { archivo: 'guajirago-aliados/src/Mesero.js', funcion: 'subirComprobanteMesa', llamar: (fn, F) => fn('Nequi', F) },
  { archivo: 'guajirago-aliados/src/Mesero.js', funcion: 'subirComprobante', llamar: (fn, F, apuntar) => fn(F, (url) => apuntar('onDone', url)) },
  { archivo: 'guajirago-aliados/src/PedidosDomicilio.js', funcion: 'subirComprobantePago', llamar: (fn, F) => fn('Nequi', F) },
  { archivo: 'guajirago-aliados/src/PedidosDomicilio.js', funcion: 'subirImagenChat', llamar: (fn, F) => fn('PED1', F) },
  { archivo: 'guajirago-aliados/src/PerfilAgencia.js', funcion: 'subirLogo', llamar: (fn, F) => fn(F) },
  { archivo: 'guajirago-aliados/src/PerfilRestaurante.js', funcion: 'subirLogo', llamar: (fn, F) => fn(F) },
  { archivo: 'guajirago-aliados/src/Tours.js', funcion: 'subirImagen', llamar: (fn, F) => fn(F) },
];

// Las fotos de mentira: lo que el celular entrega en `e.target.files[0]` (nombre, tipo y tamaño).
const FOTOS = [
  { caso: 'foto PNG', foto: { name: 'foto.png', type: 'image/png', size: 2048 } },
  { caso: 'foto JPEG', foto: { name: 'foto.jpg', type: 'image/jpeg', size: 4096 } },
  { caso: 'foto SIN tipo (el teléfono no dice qué es)', foto: { name: 'foto', type: '', size: 3000 } },
  { caso: 'el almacén la rechaza', foto: { name: 'grande.jpg', type: 'image/jpeg', size: 11 * 1024 * 1024 }, falla: true },
];

const AHORA_FIJO = 1790000000000; // Date.now() fijo, para que la ruta con la hora salga igual antes y después

// ── LEER LOS ARCHIVOS: del disco, o de un commit de SU repo ───────────────────────────────────────────
function repoDe(ruta) {
  if (ruta.startsWith('guajirago-admin/')) return 'guajirago-admin';
  if (ruta.startsWith('guajirago-aliados/')) return 'guajirago-aliados';
  return '.';
}
/** `commits` = null (el disco) o { repo: commit }. `cambios` pisa archivos (pantallas de mentira). */
function lector(commits, cambios = {}) {
  return (ruta) => {
    if (Object.prototype.hasOwnProperty.call(cambios, ruta)) return cambios[ruta];
    if (!commits) {
      const abs = path.join(RAIZ, ruta);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    const repo = repoDe(ruta);
    const dentro = repo === '.' ? ruta : ruta.slice(repo.length + 1);
    try {
      return execFileSync('git', ['show', commits[repo] + ':' + dentro], { cwd: path.join(RAIZ, repo), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

// ── EL ALMACÉN DE MENTIRA: se porta como el SDK en lo que importa aquí ─────────────────────────────────
// El tipo: si la subida trae `contentType`, ese; si no, el `type` del archivo; si no, `application/octet-stream`.
// Así lo hace el SDK de Firebase (y así lo midió storage.rules el 6-sep-2026).
function almacenDeMentira(apuntes, falla) {
  const STORAGE = { soy: 'el almacén' };
  const sdk = {
    ref: (st, ruta) => {
      if (st !== STORAGE) throw new Error('ref() recibió otra cosa en vez del almacén');
      return { ruta: String(ruta) };
    },
    uploadBytes: async (r, archivo, meta) => {
      const tipo = (meta && meta.contentType) || (archivo && archivo.type) || 'application/octet-stream';
      apuntes.push(['subió', { ruta: r.ruta, tipo, tamaño: archivo && archivo.size }]);
      if (falla) { const e = new Error('Firebase Storage: User does not have permission.'); e.code = 'storage/unauthorized'; throw e; }
      return { ref: r };
    },
    getDownloadURL: async (r) => {
      const url = 'https://almacen.de.mentira/' + r.ruta;
      apuntes.push(['pidió la dirección', r.ruta]);
      return url;
    },
  };
  return { STORAGE, sdk };
}

/** Carga la pieza (si esa versión la tiene) con el almacén de mentira en lugar de `firebase/storage`. */
function cargarPieza(fuente, sdk) {
  if (fuente == null) return null;
  const importar = /^import\s*\{([^}]*)\}\s*from\s*'firebase\/storage';?[ \t]*\r?$/m;
  const m = fuente.match(importar);
  const nombres = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  const sinImport = fuente.replace(importar, '');
  if (/^import\s/m.test(sinImport)) throw new Error('la pieza de subir fotos importa algo más que firebase/storage');
  const exportados = [...sinImport.matchAll(/^export\s+(?:async\s+)?(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((x) => x[1]);
  const cuerpo = sinImport.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(...nombres, cuerpo + '\nreturn { ' + exportados.join(', ') + ' };')(...nombres.map((n) => sdk[n]));
}

// Un COMODÍN para todo lo que la función use y no importe aquí (textos del estado, ayudantes de la pantalla):
// se deja llamar, leer y escribir; en un texto sale «?», y no es una promesa (se puede esperar sin colgarse).
function comodin() {
  const f = function () { return p; };
  const p = new Proxy(f, {
    get: (t, k) => {
      if (k === 'then') return undefined;
      if (k === Symbol.toPrimitive) return () => '«?»';
      if (k === 'toJSON') return () => '«?»';
      if (k === Symbol.iterator) return undefined;
      return p;
    },
    apply: () => p,
  });
  return p;
}

const describir = (v) => {
  try { return JSON.stringify(v); } catch (e) { return String(v); }
};

/**
 * Saca la función del sitio de su archivo y devuelve `async (foto) => { apuntes }`: la corre ENTERA, con el almacén
 * de mentira, los estados apuntados (`setX(valor)`; si es una función, se le da `{}` y se apunta lo que devuelve) y
 * las escrituras a la base apuntadas (`updateDoc`, `setDoc`).
 */
function sacarSitio(fuente, s, pieza, crearAlmacen) {
  const marca = 'const ' + s.funcion + ' = ';
  const pos = fuente.indexOf(marca);
  if (pos < 0) throw new Error('no encontré «' + marca + '» en ' + s.archivo);
  if (fuente.indexOf(marca, pos + 1) >= 0) throw new Error('hay más de un «' + marca + '» en ' + s.archivo);
  const c = cuerpoDeLaFuncion(fuente, pos);
  const cabeza = fuente.slice(pos + marca.length, c.ini - 1);
  const codigo = cabeza + '{' + c.texto + '}';
  return async (caso) => {
    const apuntes = [];
    const { STORAGE, sdk } = crearAlmacen(apuntes, caso.falla);
    const piezaViva = pieza ? pieza(sdk) : null;
    const apuntar = (k, v) => apuntes.push([k, typeof v === 'function' ? { conFuncion: v({}) } : v]);
    class FechaFija extends Date {
      constructor(...a) { super(...(a.length ? a : [AHORA_FIJO])); }
      static now() { return AHORA_FIJO; }
    }
    const ambito = {
      ...sdk,
      storage: STORAGE,
      Date: FechaFija,
      auth: { currentUser: { uid: 'UID1' } },
      db: { soy: 'la base' },
      doc: (db, ...partes) => partes.join('/'),
      arrayUnion: (...x) => ({ arrayUnion: x }),
      updateDoc: async (ruta, datos) => { apuntes.push(['updateDoc', ruta, datos]); },
      setDoc: async (ruta, datos, op) => { apuntes.push(['setDoc', ruta, datos, op || null]); },
      correr: async (fn) => { try { return await fn(); } catch (e) { apuntes.push(['el candado dice que falló', e && e.code]); return null; } },
      restauranteId: 'NEG1',
      pedidoActivo: { id: 'PED1' },
      foto: 'https://foto.de.antes/perfil.jpg',
      fotoNueva: caso.foto,
      ...(piezaViva || {}),
    };
    const proxy = new Proxy(ambito, {
      has: (t, k) => typeof k === 'string' && (k in t || !(k in globalThis)),
      get: (t, k) => {
        if (k === Symbol.unscopables) return undefined;
        if (k in t) return t[k];
        if (typeof k === 'string' && /^set[A-Z]/.test(k)) return (v) => apuntar(k, v);
        return comodin();
      },
      set: (t, k, v) => { t[k] = v; return true; },
    });
    // eslint-disable-next-line no-new-func
    const fn = new Function('ambito', 'with (ambito) { return (' + codigo + '); }')(proxy);
    let devuelve; let lanzo = null;
    try { devuelve = await s.llamar(fn, caso.foto, apuntar); } catch (e) { lanzo = (e && (e.code || e.message)) || String(e); }
    return JSON.parse(describir({ apuntes, devuelve: devuelve === undefined ? null : devuelve, lanzo }));
  };
}

/** Mide una versión (el disco, o `commits`): los 13 sitios listos para correr, la pieza, y las subidas a mano. */
function medir(commits, cambios = {}) {
  const leer = lector(commits, cambios);
  const problemas = [];
  const fuentesPieza = {};
  for (const p of PIEZAS) fuentesPieza[p] = leer(p);
  const piezaDe = (archivo) => {
    const p = PIEZAS.find((x) => archivo.startsWith(path.posix.dirname(x) + '/'));
    const f = fuentesPieza[p];
    return f == null ? null : (sdk) => cargarPieza(f, sdk);
  };
  const sitios = [];
  for (const s of SITIOS) {
    const fuente = leer(s.archivo);
    if (fuente == null) { problemas.push('no está ' + s.archivo); continue; }
    try {
      sitios.push({ ...s, id: s.archivo.replace(/^guajirago(-admin|-aliados)?\/src\//, (m, x) => (x ? x.slice(1) + ' ' : 'app ')) + ' · ' + s.funcion, correr: sacarSitio(fuente, s, piezaDe(s.archivo), almacenDeMentira), usaPieza: /\bsubirAlAlmacen\s*\(/.test(cuerpoDeLaFuncion(fuente, fuente.indexOf('const ' + s.funcion + ' = ')).texto) });
    } catch (e) { problemas.push(s.archivo + ' · ' + s.funcion + ': ' + e.message); }
  }
  // Las subidas escritas a mano en las tres apps (fuera de la pieza).
  const aMano = {};
  for (const app of APPS) {
    const repo = repoDe(app);
    const dentro = repo === '.' ? app : app.slice(repo.length + 1);
    let nombres;
    if (commits) {
      nombres = execFileSync('git', ['ls-tree', '--name-only', commits[repo], dentro + '/'], { cwd: path.join(RAIZ, repo), encoding: 'utf8' })
        .split('\n').filter((f) => f.endsWith('.js')).map((f) => (repo === '.' ? f : repo + '/' + f));
    } else {
      nombres = fs.readdirSync(path.join(RAIZ, app)).filter((f) => f.endsWith('.js')).map((f) => app + '/' + f);
    }
    for (const r of [...new Set([...nombres, ...Object.keys(cambios).filter((k) => k.startsWith(app + '/'))])]) {
      if (PIEZAS.includes(r) || r.endsWith('.test.js')) continue;
      const t = leer(r);
      if (t == null) continue;
      const n = (t.match(/\buploadBytes(?:Resumable)?\s*\(|\buploadString\s*\(/g) || []).length;
      if (n) aMano[r] = n;
    }
  }
  const presentes = PIEZAS.filter((p) => fuentesPieza[p] != null);
  const copiasIguales = presentes.length === PIEZAS.length && presentes.every((p) => fuentesPieza[p] === fuentesPieza[PIEZAS[0]]);
  return { version: commits ? Object.values(commits).join(' / ') : 'el disco', sitios, problemas, aMano, presentes, copiasIguales };
}

/** Corre cada sitio de `a` y de `b` con cada foto y dice dónde difieren. */
async function carear(a, b) {
  const diferencias = [];
  let comparaciones = 0;
  for (const sb of b.sitios) {
    const sa = a.sitios.find((x) => x.archivo === sb.archivo && x.funcion === sb.funcion);
    if (!sa) { diferencias.push({ sitio: sb.id, caso: '(todos)', antes: 'no existe', ahora: 'existe' }); continue; }
    for (const f of FOTOS) {
      const ra = await sa.correr(f);
      const rb = await sb.correr(f);
      comparaciones += 1;
      if (describir(ra) !== describir(rb)) diferencias.push({ sitio: sb.id, caso: f.caso, antes: ra, ahora: rb });
    }
  }
  return { comparaciones, diferencias };
}

/** La diferencia esperada: la foto SIN tipo, que antes se guardaba como octet-stream y ahora como image/jpeg. */
function esLaDelTipo(d) {
  if (d.caso !== FOTOS[2].caso) return false;
  const quitarTipo = (r) => describir({ ...r, apuntes: r.apuntes.map((x) => (x[0] === 'subió' ? ['subió', { ...x[1], tipo: '·' }] : x)) });
  const tipoDe = (r) => (r.apuntes.find((x) => x[0] === 'subió') || [null, {}])[1].tipo;
  return quitarTipo(d.antes) === quitarTipo(d.ahora) && tipoDe(d.antes) === 'application/octet-stream' && tipoDe(d.ahora) === 'image/jpeg';
}

function informe(m) {
  console.log('\n📷 SUBIR UNA FOTO Y PEDIR SU DIRECCIÓN · ' + m.version);
  console.log('   la pieza subirAlAlmacen.js está en: ' + (m.presentes.length ? m.presentes.join(', ') : 'ninguna app'));
  if (m.presentes.length) console.log('   ¿las copias son idénticas byte a byte? ' + (m.copiasIguales ? 'sí' : '🔴 NO'));
  console.log('   sitios que suben una foto: ' + m.sitios.length + ' · con la pieza: ' + m.sitios.filter((s) => s.usaPieza).length);
  const total = Object.values(m.aMano).reduce((x, y) => x + y, 0);
  console.log('   subidas escritas a mano (uploadBytes) en las tres apps, fuera de la pieza: ' + total);
  for (const [r, n] of Object.entries(m.aMano)) console.log('      ' + r.padEnd(44) + n);
  for (const p of m.problemas) console.log('   🔴 ' + p);
}

async function tiposEnLaNube() {
  const { token } = require('./nube.cjs');
  const { permiso } = await token();
  const todos = [];
  let pagina;
  do {
    const u = 'https://storage.googleapis.com/storage/v1/b/' + BUCKET + '/o?maxResults=1000&fields=items(name,contentType,size),nextPageToken'
      + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : '');
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + permiso } });
    if (!r.ok) throw new Error('no pude listar el almacén: HTTP ' + r.status);
    const j = await r.json();
    todos.push(...(j.items || []));
    pagina = j.nextPageToken;
  } while (pagina);
  const porCarpeta = {};
  for (const o of todos) {
    const c = String(o.name || '').split('/')[0];
    const t = /^image\//.test(o.contentType || '') ? 'imagen' : (o.contentType || '(sin tipo)');
    porCarpeta[c] = porCarpeta[c] || {};
    porCarpeta[c][t] = (porCarpeta[c][t] || 0) + 1;
  }
  const tipos = {};
  for (const o of todos) tipos[o.contentType || '(sin tipo)'] = (tipos[o.contentType || '(sin tipo)'] || 0) + 1;
  return { total: todos.length, porCarpeta, tipos, grandes: todos.filter((o) => Number(o.size) >= 10 * 1024 * 1024).length };
}

async function main() {
  const ahora = medir(process.argv.includes('--antes') ? ANTES : null);
  const antes = medir(ANTES);
  informe(ahora);
  const c = await carear(antes, ahora);
  const esperadas = c.diferencias.filter(esLaDelTipo);
  const otras = c.diferencias.filter((d) => !esLaDelTipo(d));
  console.log('\n🧪 CAREO con el código de ANTES de G82 (' + Object.values(ANTES).join(' / ') + '), ' + FOTOS.length + ' fotos × ' + ahora.sitios.length + ' sitios = ' + c.comparaciones + ' comparaciones');
  console.log('   iguales: ' + (c.comparaciones - c.diferencias.length));
  console.log('   distintas por el TIPO de la foto sin tipo (octet-stream → image/jpeg): ' + esperadas.length);
  console.log('   distintas por otra cosa: ' + otras.length);
  for (const d of otras.slice(0, 10)) console.log('   🔴 ' + d.sitio + ' · ' + d.caso + '\n      antes ' + describir(d.antes) + '\n      ahora ' + describir(d.ahora));
  if (process.argv.includes('--detalle')) {
    for (const s of ahora.sitios) console.log('\n   · ' + s.id + ' con una PNG: ' + describir(await s.correr(FOTOS[0])));
  }

  if (process.argv.includes('--nube')) {
    const n = await tiposEnLaNube();
    console.log('\n☁️  PRODUCCIÓN · almacén ' + BUCKET + ': ' + n.total + ' archivos (de 10 MB o más: ' + n.grandes + ')');
    console.log('   por tipo: ' + Object.entries(n.tipos).map(([t, k]) => t + ' ' + k).join(' · '));
    for (const [carpeta, t] of Object.entries(n.porCarpeta)) console.log('   ' + carpeta.padEnd(22) + Object.entries(t).map(([x, k]) => x + ' ' + k).join(' · '));
  }
  console.log('');
}

module.exports = { medir, carear, esLaDelTipo, SITIOS, FOTOS, PIEZAS, ANTES, cargarPieza };

if (require.main === module) main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
