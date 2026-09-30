#!/usr/bin/env node
/**
 * MEDIR EL CUADRO DE SUGERENCIAS DE DIRECCIONES — gemelo G61 (29-sep-2026).
 * Solo LEE el código (y lo EJECUTA con un Google de mentira). No lee ni escribe datos:
 * lo que se mide no depende de nada guardado.
 *
 *   node scripts/medir-sugerencias.cjs                                   <- el código de hoy (el disco)
 *   node scripts/medir-sugerencias.cjs --commit <raíz> --aliados <hash>  <- el de otros commits (careo)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántos sitios de las TRES apps arman el cuadro de Google a mano
 *     (`places.Autocomplete(`) fuera de la pieza `sugerenciasDeDirecciones.js`. Antes: 5.
 *  2. Cuántos marcos (`LatLngBounds(...)` con esquinas) se arman a mano fuera de la pieza. Antes: 5.
 *  3. Cuántas esquinas de un marco se escriben con NÚMEROS a mano fuera de `riohacha.js`
 *     (`LatLng(10.9, ...)`). Antes: 6 (el marco de La Guajira, 3 veces).
 *  4. Cuántos `setBounds(...)` que repiten el marco que ya se le dio al crearlo. Antes: 3.
 *  5. Si las copias de aliados siguen atadas: la pieza, byte a byte; su `riohacha.js`
 *     (que lleva solo los dos marcos), con los mismos valores que el de la app.
 *  6. Qué hace CADA uno de los sitios (cinco; cuatro desde G67, que quitó la ventanita muerta de favoritos), sacando su efecto del archivo y CORRIÉNDOLO:
 *       · con qué opciones crea el cuadro (país, marco, si es estricto, tipos, campos),
 *       · con qué marco queda al final, y
 *       · qué le queda a la pantalla cuando se escoge una sugerencia.
 *     G61 NO cambia esto: tiene que salir IDÉNTICO antes y después.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre React ni un navegador: el efecto se corre sacado del archivo.
 *   · No mira a Google de verdad: el cuadro de mentira apunta lo que se le pide.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo, sinTextos, cuerpoDeLaFuncion, sonLaMismaCopia } = require('../pruebas/cargar.cjs');

const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const PIEZAS = ['guajirago/src/sugerenciasDeDirecciones.js', 'guajirago-aliados/src/sugerenciasDeDirecciones.js'];
const GEOGRAFIAS = ['guajirago/src/riohacha.js', 'guajirago-aliados/src/riohacha.js'];

const SITIOS = [
  { nombre: 'app · pedir el viaje (Solicitar.js, AutocompleteInput)', archivo: 'guajirago/src/Solicitar.js', desde: 'function AutocompleteInput' },
  // El quinto, «app · lugar favorito (Home.js, ModalFavorito)», se quitó con G67 (29-sep-2026): la ventanita guardaba
  // en el teléfono y nadie la abría. El careo con el código de antes de G61 mira los cuatro que siguen vivos.
  { nombre: 'app · dirección de entrega del domicilio (Restaurantes.js)', archivo: 'guajirago/src/Restaurantes.js', desde: null },
  { nombre: 'aliados · perfil del restaurante (PerfilRestaurante.js)', archivo: 'guajirago-aliados/src/PerfilRestaurante.js', desde: null },
  { nombre: 'aliados · perfil de la agencia (PerfilAgencia.js)', archivo: 'guajirago-aliados/src/PerfilAgencia.js', desde: null },
];

// Lo que Google devolvería al escoger una sugerencia.
const LUGAR = {
  name: 'Cra. 7 # 10-20',
  formatted_address: 'Cra. 7 #10-20, Riohacha, La Guajira, Colombia',
  geometry: { location: { lat: () => 11.5501, lng: () => -72.9012 } },
};

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo del disco, o del commit de SU repo (aliados es un repo aparte). */
function lector(commitRaiz, commitAliados) {
  return (r) => {
    const deAliados = r.startsWith('guajirago-aliados/');
    const commit = deAliados ? commitAliados : commitRaiz;
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

function archivosJs(dir) {
  const abs = path.join(RAIZ, dir);
  if (!fs.existsSync(abs)) return [];
  const fuera = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const r = dir + '/' + e.name;
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'build') fuera.push(...archivosJs(r)); }
    else if (/\.js$/.test(e.name) && !/\.test\.js$/.test(e.name)) fuera.push(r);
  }
  return fuera;
}

/** 1 a 4 · Lo que se arma a mano, archivo por archivo. */
function lasCopias(leerDe) {
  const cuenta = { cuadros: [], marcos: [], esquinas: [], setBounds: [] };
  const apuntar = (lista, r, n) => { if (n) lista.push([r, n]); };
  for (const carpeta of CARPETAS) {
    for (const r of archivosJs(carpeta)) {
      const t = leerDe(r);
      if (!t) continue;
      const codigo = sinTextos(soloCodigo(t));
      if (!PIEZAS.includes(r)) {
        apuntar(cuenta.cuadros, r, (codigo.match(/places\.Autocomplete\s*\(/g) || []).length);
        // `new LatLngBounds()` vacío es otra cosa (el encuadre de la ruta en MapaConRuta.js): no cuenta.
        apuntar(cuenta.marcos, r, (codigo.match(/LatLngBounds\s*\(\s*[^)\s]/g) || []).length);
        apuntar(cuenta.setBounds, r, (codigo.match(/\.setBounds\s*\(/g) || []).length);
      }
      if (!GEOGRAFIAS.includes(r)) {
        apuntar(cuenta.esquinas, r, (codigo.match(/LatLng\s*\(\s*-?\d/g) || []).length);
      }
    }
  }
  return cuenta;
}

/** Carga una pieza con import/export pasándole lo que importa ya hecho. */
function cargarPieza(fuente, conocidos) {
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const cuerpo = fuente.replace(/^import\s[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(conocidos), cuerpo + '\nreturn { ' + nombres.join(', ') + ' };')(...Object.values(conocidos));
}

/** La geografía y la pieza que ve cada archivo: las de SU app, del mismo commit. */
function loQueImporta(leerDe, archivo) {
  const carpeta = archivo.startsWith('guajirago-aliados/') ? 'guajirago-aliados/src/' : 'guajirago/src/';
  const conocidos = {};
  const geo = leerDe(carpeta + 'riohacha.js');
  if (geo) { try { Object.assign(conocidos, cargarPieza(geo, {})); } catch (e) { /* sin geografía */ } }
  const pieza = leerDe(carpeta + 'sugerenciasDeDirecciones.js');
  if (pieza) {
    try { Object.assign(conocidos, cargarPieza(pieza, { ...conocidos })); } catch (e) { /* sin pieza */ }
  }
  return conocidos;
}

/** Un Google de mentira: el cuadro apunta con qué se creó, qué marco le pusieron y qué oyentes tiene. */
function googleDeMentira(registro) {
  function LatLng(la, ln) { this.la = la; this.ln = ln; }
  function LatLngBounds(sw, ne) {
    this.toJSON = () => (sw && ne ? { south: sw.la, west: sw.ln, north: ne.la, east: ne.ln } : 'vacío');
  }
  function Autocomplete(input, opciones) {
    registro.cuadros += 1;
    registro.opciones = JSON.parse(JSON.stringify(opciones));
    registro.marco = JSON.parse(JSON.stringify(opciones && opciones.bounds ? opciones.bounds : null));
    this.setBounds = (b) => { registro.marco = JSON.parse(JSON.stringify(b)); };
    this.addListener = (ev, fn) => { registro.oyentes[ev] = fn; };
    this.getPlace = () => LUGAR;
  }
  return { maps: { LatLng, LatLngBounds, places: { Autocomplete } } };
}

/** 6 · Lo que hace un sitio, CORRIDO. */
function loQueHace(leerDe, sitio) {
  const t = leerDe(sitio.archivo);
  if (!t) return { falla: 'no existe ' + sitio.archivo };
  const codigo = soloCodigo(t);
  const seguro = sinTextos(codigo);
  const d = sitio.desde ? seguro.indexOf(sitio.desde) : 0;
  if (d < 0) return { falla: 'no encuentro `' + sitio.desde + '`' };
  const re = /places\.Autocomplete\s*\(|ponerSugerencias\s*\(/g;
  re.lastIndex = d;
  const m = re.exec(seguro);
  if (!m) return { falla: 'no encuentro dónde se arma el cuadro' };
  const efecto = seguro.lastIndexOf('useEffect(', m.index);
  if (efecto < 0 || efecto < d) return { falla: 'no encuentro el efecto que arma el cuadro' };
  const fn = cuerpoDeLaFuncion(codigo, efecto);
  if (!fn) return { falla: 'no entiendo el efecto que arma el cuadro' };

  const registro = { cuadros: 0, opciones: null, marco: null, oyentes: {} };
  const queda = [];
  const apunta = (quien) => (v) => queda.push(quien + ' ← ' + JSON.stringify(v));
  const intervalos = [];
  const input = {};
  const conocidos = {
    ...loQueImporta(leerDe, sitio.archivo),
    window: { google: googleDeMentira(registro) },
    inputRef: { current: input },
    inputDireccionRef: { current: input },
    direccionRef: { current: input },
    autocompleteRef: { current: null },
    pantalla: 'menu',
    setInterval: (f) => { intervalos.push(f); return intervalos.length; },
    clearInterval: () => {},
    setDireccion: apunta('dirección'),
    setUbicacion: apunta('ubicación'),
    onChangeRef: { current: apunta('texto del campo') },
    onPlaceCoordsRef: { current: apunta('punto del mapa') },
    puntoDeDireccion: () => queda.push('le pregunta a Google por el punto'),
    geocodificadorDe: () => ({}),
  };
  try {
    // eslint-disable-next-line no-new-func
    new Function(...Object.keys(conocidos), fn.texto)(...Object.values(conocidos));
    intervalos.forEach((f) => f());
    if (registro.oyentes.place_changed) registro.oyentes.place_changed();
  } catch (e) {
    return { falla: 'reventó al correrlo: ' + e.message };
  }
  return {
    cuadros: registro.cuadros,
    opciones: registro.opciones,
    marco: registro.marco,
    oyentes: Object.keys(registro.oyentes).sort(),
    queda,
  };
}

function medir(leerDe) {
  const copias = lasCopias(leerDe);
  const pApp = leerDe('guajirago/src/sugerenciasDeDirecciones.js');
  const pAli = leerDe('guajirago-aliados/src/sugerenciasDeDirecciones.js');
  const atadas = [{ n: 'sugerenciasDeDirecciones.js', estado: !pAli ? 'no existe en aliados' : sonLaMismaCopia(pAli, pApp) ? 'idéntica (G100: salvo el final de línea)' : 'DISTINTA' }];
  // riohacha.js de aliados lleva SOLO los marcos: se comparan sus valores, uno por uno.
  const gAli = leerDe('guajirago-aliados/src/riohacha.js');
  if (!gAli) atadas.push({ n: 'riohacha.js', estado: 'no existe en aliados' });
  else {
    try {
      const ali = cargarPieza(gAli, {});
      const app = cargarPieza(leerDe('guajirago/src/riohacha.js'), {});
      const malos = Object.keys(ali).filter((k) => JSON.stringify(ali[k]) !== JSON.stringify(app[k]));
      atadas.push({ n: 'riohacha.js (' + Object.keys(ali).join(', ') + ')', estado: malos.length ? 'DISTINTOS: ' + malos.join(', ') : 'mismos valores que la app' });
    } catch (e) { atadas.push({ n: 'riohacha.js', estado: 'no se pudo cargar: ' + e.message }); }
  }
  const sitios = SITIOS.map((s) => ({ ...s, hace: loQueHace(leerDe, s) }));
  return { copias, atadas, sitios };
}

function total(lista) { return lista.reduce((a, [, n]) => a + n, 0); }

function imprimir(r) {
  const lin = (titulo, lista) => {
    console.log('  ' + titulo + ': ' + total(lista));
    for (const [f, n] of lista) console.log('     · ' + f + ' (' + n + ')');
  };
  console.log('\n══ LO QUE SE ARMA A MANO (fuera de la pieza y de riohacha.js) ══');
  lin('cuadros de sugerencias armados a mano', r.copias.cuadros);
  lin('marcos armados a mano', r.copias.marcos);
  lin('esquinas de un marco escritas con números', r.copias.esquinas);
  lin('setBounds que repiten el marco', r.copias.setBounds);
  console.log('\n══ COPIAS DE ALIADOS ══');
  for (const a of r.atadas) console.log('  ' + a.n + ': ' + a.estado);
  console.log('\n══ LO QUE HACE CADA SITIO (tiene que salir IDÉNTICO antes y después) ══');
  for (const s of r.sitios) {
    console.log('  ' + s.nombre);
    if (s.hace.falla) { console.log('     ✗ ' + s.hace.falla); continue; }
    console.log('     cuadros creados: ' + s.hace.cuadros);
    console.log('     opciones: ' + JSON.stringify(s.hace.opciones));
    console.log('     marco al final: ' + JSON.stringify(s.hace.marco));
    console.log('     oyentes: ' + s.hace.oyentes.join(', '));
    console.log('     al escoger «' + LUGAR.name + '»: ' + (s.hace.queda.join(' · ') || '(nada)'));
  }
}

module.exports = { medir, lector, SITIOS, LUGAR };

if (require.main === module) {
  const commitRaiz = argumento('--commit');
  const commitAliados = argumento('--aliados');
  console.log('Cuadro de sugerencias de direcciones · ' +
    (commitRaiz || commitAliados ? 'raíz ' + (commitRaiz || 'disco') + ' · aliados ' + (commitAliados || 'disco') : 'el disco'));
  const r = medir(lector(commitRaiz, commitAliados));
  imprimir(r);
  const fallas = r.sitios.filter((s) => s.hace.falla).length;
  process.exit(fallas ? 1 : 0);
}
