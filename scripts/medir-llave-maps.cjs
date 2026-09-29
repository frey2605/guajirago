#!/usr/bin/env node
/**
 * MEDIR LA LLAVE DE GOOGLE MAPS — gemelo G62 (29-sep-2026).
 * Solo LEE: el código (del disco o de un commit) y lo que SIRVEN hoy los seis sitios (sin sesión:
 * es la página pública). No lee ni escribe datos.
 *
 *   node scripts/medir-llave-maps.cjs                                   <- el código de hoy (el disco) + lo servido
 *   node scripts/medir-llave-maps.cjs --commit <raíz> --aliados <hash>  <- el de otros commits (careo)
 *   node scripts/medir-llave-maps.cjs --sin-red                         <- sin preguntarle a los sitios
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántas llaves de Google (`AIza…`) hay escritas A MANO en los `public/index.html` de las tres
 *     apps. Antes de G62: 2 (transporte y aliados, la misma, copiada).
 *  2. Qué llave de Maps VIAJA en cada app y cada ambiente: el `index.html` se pasa por el mismo
 *     reemplazo que hace Create React App al compilar (cada `%REACT_APP_…%` por su valor del
 *     `.env.<ambiente>`, que es lo que carga `env-cmd` en `build:pruebas` / `build:produccion`), y se
 *     lee la llave del `<script>` de Maps que queda. Si queda un `%…%` sin reemplazar, es que el
 *     `.env` no trae la llave: la app saldría SIN MAPA, y eso es una falla.
 *  3. Que transporte y aliados lleven la MISMA llave en cada ambiente (comparten la app web de
 *     Firebase y la lista de sitios permitidos de la llave).
 *  4. Qué llave SIRVE hoy cada uno de los seis sitios, y si es la que saldría del código.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No compila entero: corre SOLO la pieza de CRA que hace el reemplazo (InterpolateHtmlPlugin, la de
 *     cada app). El careo de G62 se hizo además compilando de verdad antes y después.
 *   · No le pregunta a Google si la llave sirve en ese dominio: eso lo comprueba el navegador, no la
 *     descarga (trampa del 23-sep-2026 en CLAUDE.md). Lo mira el robot (robot/llave-maps.cjs).
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { leerEnv } = require('./medir-ambientes.cjs');

const RAIZ = path.join(__dirname, '..');
const NOMBRE = 'REACT_APP_GOOGLE_MAPS_KEY';
const MARCA = '%' + NOMBRE + '%';
const AMBIENTES = ['pruebas', 'produccion'];
const APPS = [
  { nombre: 'transporte', carpeta: 'guajirago', mapas: true, sitios: { pruebas: 'guajirago-pruebas', produccion: 'guajirago' } },
  { nombre: 'aliados', carpeta: 'guajirago-aliados', mapas: true, sitios: { pruebas: 'guajirago-pruebas-aliados', produccion: 'guajirago-aliados' } },
  { nombre: 'panel', carpeta: 'guajirago-admin', mapas: false, sitios: { pruebas: 'guajirago-pruebas-admin', produccion: 'guajirago-admin' } },
];
const LLAVE_GOOGLE = /AIza[0-9A-Za-z_-]{35}/g;

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo del disco, o del commit de SU repo (admin y aliados son repos aparte). */
function lector(commitRaiz, commitAliados) {
  return (r) => {
    const deAliados = r.startsWith('guajirago-aliados/');
    const deAdmin = r.startsWith('guajirago-admin/');
    const commit = deAliados ? commitAliados : deAdmin ? null : commitRaiz;
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      const cwd = deAliados ? path.join(RAIZ, 'guajirago-aliados') : RAIZ;
      const ruta = deAliados ? r.slice('guajirago-aliados/'.length) : r;
      return execFileSync('git', ['show', commit + ':' + ruta], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { return null; }
  };
}

/**
 * El reemplazo que hace Create React App en public/index.html al compilar, CORRIENDO SU PROPIA PIEZA:
 * `InterpolateHtmlPlugin` de react-dev-utils, de la carpeta de esa app (la que la configuración de webpack de
 * react-scripts usa con `env.raw`), enchufada a un compilador de mentira que solo le entrega el html. `env.raw` se
 * arma como lo hace getClientEnvironment en la configuración de react-scripts: las variables que empiezan por REACT_APP_ (sin
 * distinguir mayúsculas) más NODE_ENV, PUBLIC_URL ('' al compilar sin homepage), WDS_* y FAST_REFRESH.
 * Lo que no está en `env.raw` se queda escrito tal cual.
 */
function interpolarComoCRA(html, env, carpeta = 'guajirago') {
  const InterpolateHtmlPlugin = require(path.join(RAIZ, carpeta, 'node_modules', 'react-dev-utils', 'InterpolateHtmlPlugin.js'));
  const raw = {};
  for (const [k, v] of Object.entries(env || {})) if (/^REACT_APP_/i.test(k)) raw[k] = v;
  Object.assign(raw, { NODE_ENV: 'production', PUBLIC_URL: '', WDS_SOCKET_HOST: undefined, WDS_SOCKET_PATH: undefined, WDS_SOCKET_PORT: undefined, FAST_REFRESH: true });
  let alTerminar = null;
  const htmlWebpackPlugin = { getHooks: () => ({ afterTemplateExecution: { tap: (_n, fn) => { alTerminar = fn; } } }) };
  new InterpolateHtmlPlugin(htmlWebpackPlugin, raw).apply({ hooks: { compilation: { tap: (_n, fn) => fn({}) } } });
  const data = { html };
  alTerminar(data);
  return data.html;
}

/** Los <script> que cargan Google Maps y la llave que le pasan (el parámetro key= de la dirección). */
function scriptsDeMaps(html) {
  const out = [];
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']*maps\.googleapis\.com\/maps\/api\/js[^"']*)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1].replace(/&amp;/g, '&');
    const k = src.match(/[?&]key=([^&]*)/);
    out.push({ src, llave: k ? k[1] : null });
  }
  return out;
}

const corta = (l) => (l ? l.slice(0, 10) + '…' + l.slice(-4) : '—');

/** Mide con un lector de archivos (el disco, un commit, o archivos de mentira en las pruebas). */
function medir(leer) {
  const apps = [];
  const fallas = [];
  let aMano = 0;
  for (const a of APPS) {
    const rutaHtml = a.carpeta + '/public/index.html';
    const html = leer(rutaHtml);
    const r = { nombre: a.nombre, mapas: a.mapas, rutaHtml, aMano: 0, marcas: 0, scripts: 0, ambientes: {} };
    if (html == null) { fallas.push(a.nombre + ': no existe ' + rutaHtml); apps.push(r); continue; }
    r.aMano = (html.match(LLAVE_GOOGLE) || []).length;
    r.marcas = html.split(MARCA).length - 1;
    r.scripts = scriptsDeMaps(html).length;
    aMano += r.aMano;
    if (r.aMano) fallas.push(a.nombre + ': ' + r.aMano + ' llave(s) de Google escrita(s) a mano en ' + rutaHtml);
    if (a.mapas && r.scripts !== 1) fallas.push(a.nombre + ': ' + rutaHtml + ' carga Maps ' + r.scripts + ' veces (debe ser 1)');
    if (!a.mapas && r.scripts) fallas.push(a.nombre + ': ' + rutaHtml + ' carga Maps y no debería');
    for (const amb of AMBIENTES) {
      const rutaEnv = a.carpeta + '/.env.' + amb;
      const envTxt = leer(rutaEnv);
      const env = envTxt == null ? {} : leerEnv(envTxt);
      const final = interpolarComoCRA(html, env, a.carpeta);
      const s = scriptsDeMaps(final)[0] || null;
      const llave = s ? s.llave : null;
      const sinResolver = s ? /%[A-Za-z0-9_]+%/.test(s.src) : false;
      r.ambientes[amb] = { rutaEnv, enEnv: env[NOMBRE] || null, llave, sinResolver };
      if (a.mapas) {
        if (sinResolver) fallas.push(a.nombre + ' · ' + amb + ': la llave de Maps queda SIN REEMPLAZAR («' + s.src.match(/key=([^&]*)/)[1] + '»): ' + rutaEnv + ' no trae ' + NOMBRE + ' — la app saldría sin mapa');
        else if (!llave || !/^AIza[0-9A-Za-z_-]{35}$/.test(llave)) fallas.push(a.nombre + ' · ' + amb + ': la llave de Maps que viaja no es una llave de Google («' + llave + '»)');
      }
    }
    apps.push(r);
  }
  // Transporte y aliados: la MISMA llave en cada ambiente.
  const t = apps.find((x) => x.nombre === 'transporte');
  const al = apps.find((x) => x.nombre === 'aliados');
  for (const amb of AMBIENTES) {
    const lt = t.ambientes[amb] && t.ambientes[amb].llave;
    const la = al.ambientes[amb] && al.ambientes[amb].llave;
    if (lt && la && lt !== la) fallas.push(amb + ': transporte y aliados viajan con llaves de Maps DISTINTAS (' + corta(lt) + ' / ' + corta(la) + ')');
  }
  return { apps, aMano, fallas };
}

/** Qué llave de Maps sirve HOY cada sitio (su index.html público). */
async function servido() {
  const out = {};
  for (const a of APPS) for (const amb of AMBIENTES) {
    const sitio = a.sitios[amb];
    try {
      const x = await fetch('https://' + sitio + '.web.app/index.html?v=' + Date.now());
      const s = scriptsDeMaps(await x.text());
      out[sitio] = { ok: x.ok, scripts: s.length, llave: s[0] ? s[0].llave : null };
    } catch (e) { out[sitio] = { ok: false, error: String(e.message || e) }; }
  }
  return out;
}

function imprimir(r, srv) {
  console.log('\nLlaves de Google escritas A MANO en los index.html: ' + r.aMano);
  for (const a of r.apps) {
    console.log('\n· ' + a.nombre + ' (' + a.rutaHtml + ') · a mano: ' + a.aMano + ' · toma ' + MARCA + ': ' + a.marcas + ' · <script> de Maps: ' + a.scripts);
    for (const amb of AMBIENTES) {
      const e = a.ambientes[amb];
      if (!e) continue;
      let linea = '    ' + amb.padEnd(10) + ' .env: ' + (e.enEnv ? corta(e.enEnv) : 'no la trae').padEnd(16) + ' · viaja: ' + (e.sinResolver ? 'SIN REEMPLAZAR' : corta(e.llave));
      if (srv) {
        const sv = srv[APPS.find((x) => x.nombre === a.nombre).sitios[amb]];
        const sitio = APPS.find((x) => x.nombre === a.nombre).sitios[amb];
        if (sv && sv.ok) linea += ' · ' + sitio + '.web.app sirve: ' + corta(sv.llave) + (sv.llave === e.llave ? ' ✓ igual' : ' ≠ DISTINTA');
        else linea += ' · ' + sitio + '.web.app: no contestó';
      }
      console.log(linea);
    }
  }
  const t = r.apps.find((x) => x.nombre === 'transporte');
  if (t && t.ambientes.pruebas && t.ambientes.produccion) {
    console.log('\nPruebas y producción usan la ' + (t.ambientes.pruebas.llave === t.ambientes.produccion.llave ? 'MISMA' : 'OTRA') + ' llave de Maps.');
  }
  console.log(r.fallas.length ? '\n🔴 ' + r.fallas.length + ' falla(s):\n  · ' + r.fallas.join('\n  · ') : '\n✓ ninguna llave a mano; cada index.html toma la suya del .env de su ambiente');
}

module.exports = { medir, lector, interpolarComoCRA, scriptsDeMaps, APPS, NOMBRE, MARCA };

if (require.main === module) {
  (async () => {
    const commitRaiz = argumento('--commit');
    const commitAliados = argumento('--aliados');
    console.log('Llave de Google Maps · ' +
      (commitRaiz || commitAliados ? 'raíz ' + (commitRaiz || 'disco') + ' · aliados ' + (commitAliados || 'disco') : 'el disco'));
    const r = medir(lector(commitRaiz, commitAliados));
    const srv = process.argv.includes('--sin-red') ? null : await servido();
    imprimir(r, srv);
    process.exit(r.fallas.length ? 1 : 0);
  })();
}
