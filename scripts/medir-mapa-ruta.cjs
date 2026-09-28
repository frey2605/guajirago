#!/usr/bin/env node
/**
 * MEDIR LOS MAPAS CON RUTA — gemelo G29 (28-sep-2026).
 * Solo lee código y lo EJECUTA con un Google Maps de mentira; no toca datos.
 *
 *   node scripts/medir-mapa-ruta.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-mapa-ruta.cjs --commit <hash>  <- el de otro commit (el careo antes/después)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántos componentes de `guajirago/src` dibujan una ruta (`DirectionsRenderer`).
 *     Antes: 2 (`MapaConductor` en AppConductor.js y `MapaPasajero` en Solicitar.js),
 *     casi iguales. Tiene que ser 1.
 *  2. Las CUATRO pantallas que enseñan un mapa con ruta (conductor yendo a recoger,
 *     conductor en viaje, pasajero esperando al conductor, pasajero en viaje): de cada
 *     una se saca del archivo el mapa que usa y los datos que le pasa, TAL COMO ESTÁN
 *     ESCRITOS, y se corre el mapa con esos datos —primero sin el carro, luego con él, y
 *     luego con el carro movido—. Se apunta dónde se centra, qué ruta pide, de qué color,
 *     qué marcadores pone y, sobre todo, **cuánto margen deja al encuadrar la ruta**.
 *  3. El margen se cuenta como lo cuenta Google: `fitBounds(límites, relleno)` acepta un
 *     número (el mismo en los cuatro lados) o un objeto con `top`, `bottom`, `left` y
 *     `right`; lo que falte vale 0. El conductor pasaba `{ padding: 80 }`, que NO es ninguna
 *     de las dos cosas: en la práctica, 0 abajo, y la ruta se encuadra por detrás de la
 *     tarjeta del viaje. El pasajero deja 380 abajo.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre React ni un navegador: los ganchos (`useRef`, `useEffect`) son de mentira y
 *     el dibujo se cambia por nada. Si la tarjeta de verdad cabe o no encima del mapa lo
 *     mira el robot en pruebas (`robot/ruta-conductor.cjs`), que mide dónde quedan los
 *     marcadores y dónde empieza la tarjeta.
 *   · No mira el mapa de RECOGIDA del pasajero (`MapaRecogida`): es otro mapa, sin ruta.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, sinTextos, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const SRC = 'guajirago/src';

function lector(commit) {
  if (!commit) {
    return {
      leer: (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8'),
      lista: () => fs.readdirSync(path.join(RAIZ, SRC)).filter((a) => a.endsWith('.js')),
    };
  }
  return {
    leer: (r) => execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
    lista: () => execFileSync('git', ['ls-tree', '--name-only', commit, SRC + '/'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').filter((a) => a.endsWith('.js')).map((a) => path.posix.basename(a)),
  };
}

// Los puntos de mentira: el carro, el sitio de recogida (1,3 km al SUR del carro: es el caso que
// muerde, porque al sur del mapa es donde está la tarjeta) y el destino del viaje.
const CARRO = Object.freeze({ lat: 11.5444, lng: -72.9072 });
const CARRO_2 = Object.freeze({ lat: 11.5430, lng: -72.9072 });
const RECOGIDA = Object.freeze({ lat: 11.5324, lng: -72.9072 });
const DESTINO = Object.freeze({ lat: 11.5500, lng: -72.9200 });
const PLAZA = Object.freeze({ lat: 11.5444, lng: -72.9072, plaza: true });
// El alto del mapa (la pantalla del robot: 400×860) y el de cada tarjeta, medido por el robot en pruebas.
const ALTO_PANTALLA = 860;

function nombrar(p) {
  if (!p) return 'nada';
  if (p.plaza) return 'plaza';
  if (p === CARRO || p === CARRO_2) return 'carro';
  if (p === RECOGIDA) return 'recogida';
  if (p === DESTINO) return 'destino';
  return 'otro';
}

// Las cuatro pantallas: dónde empieza cada una en su archivo, con qué datos se corre y cuál de
// esos datos es el CARRO (el que se quita en el primer dibujo y se mueve en el tercero).
const PANTALLAS = [
  {
    nombre: 'conductor · yendo a recoger', archivo: 'AppConductor.js', ancla: "if (fase === 'recogiendo' || fase === 'en_punto')",
    carro: 'ubicacion', altoTarjeta: 294, datos: { ubicacion: CARRO, ubicacionPasajero: RECOGIDA, destinoCoords: DESTINO, fase: 'recogiendo', viajeActual: { tipo: 'Taxi' } },
  },
  {
    nombre: 'conductor · viaje en curso', archivo: 'AppConductor.js', ancla: "if (fase === 'en_viaje' && viajeActual)",
    carro: 'ubicacion', altoTarjeta: 294, datos: { ubicacion: CARRO, ubicacionPasajero: RECOGIDA, destinoCoords: DESTINO, fase: 'en_viaje', viajeActual: { tipo: 'Taxi' } },
  },
  {
    nombre: 'pasajero · conductor en camino', archivo: 'Solicitar.js', ancla: "if (pantalla === 'fase1')",
    carro: 'ubicacionConductor', altoTarjeta: 409, datos: { ubicacionConductor: CARRO, ubicacionRecogida: RECOGIDA, ubicacionPasajero: RECOGIDA, destinoCoords: DESTINO, tipo: 'Taxi' },
  },
  {
    nombre: 'pasajero · viaje en curso', archivo: 'Solicitar.js', ancla: "if (pantalla === 'fase2')",
    carro: 'ubicacionConductor', altoTarjeta: 300, datos: { ubicacionConductor: CARRO, ubicacionRecogida: RECOGIDA, ubicacionPasajero: RECOGIDA, destinoCoords: DESTINO, tipo: 'Taxi' },
  },
];

/** Cierra el paréntesis/llave/corchete que abre en `i` (sin contar lo que va entre comillas). */
function elQueCierra(seguro, i) {
  const abre = seguro[i];
  const cierra = { '(': ')', '{': '}', '[': ']' }[abre];
  let hondo = 0;
  for (let j = i; j < seguro.length; j += 1) {
    if (seguro[j] === abre) hondo += 1;
    else if (seguro[j] === cierra && --hondo === 0) return j;
  }
  return -1;
}

/** El primer mapa con nombre `Mapa…` (que no sea el de recogida) que pinta la pantalla, con sus datos. */
function elMapaDeLaPantalla(codigo, ancla) {
  const desde = codigo.indexOf(ancla);
  if (desde < 0) return { falla: 'no encuentro la pantalla «' + ancla + '»' };
  const seguro = sinTextos(codigo);
  const re = /<(Mapa\w*)\b/g;
  re.lastIndex = desde;
  let m;
  while ((m = re.exec(codigo)) && m[1] === 'MapaRecogida');
  if (!m) return { falla: 'la pantalla «' + ancla + '» no pinta ningún mapa' };
  const fin = seguro.indexOf('/>', m.index);
  const atributos = {};
  let i = m.index + m[0].length;
  while (i < fin) {
    const a = /\s*([A-Za-z]+)=/y;
    a.lastIndex = i;
    const n = a.exec(codigo);
    if (!n) { i += 1; continue; }
    const v = a.lastIndex;
    if (codigo[v] === '{') {
      const c = elQueCierra(seguro, v);
      atributos[n[1]] = codigo.slice(v + 1, c);
      i = c + 1;
    } else {
      const c = codigo.indexOf(codigo[v], v + 1);
      atributos[n[1]] = JSON.stringify(codigo.slice(v + 1, c));
      i = c + 1;
    }
  }
  return { nombre: m[1], atributos };
}

/** Dónde vive la función del mapa: en el mismo archivo, o en el archivo de donde se importa. */
function dondeVive(L, archivo, codigo, nombre) {
  if (new RegExp('^(?:export\\s+(?:default\\s+)?)?function\\s+' + nombre + '\\(', 'm').test(codigo)) return { archivo, codigo };
  const imp = new RegExp("^import\\s+(?:\\{[^}]*\\b" + nombre + "\\b[^}]*\\}|" + nombre + ")\\s+from\\s+'\\./([^']+)'", 'm').exec(codigo);
  if (!imp) return { falla: archivo + ' pinta <' + nombre + '> pero no lo define ni lo importa de su carpeta' };
  const otro = imp[1].endsWith('.js') ? imp[1] : imp[1] + '.js';
  return { archivo: otro, codigo: L.leer(SRC + '/' + otro) };
}

/**
 * La función del mapa, lista para correr: su texto, más las constantes de arriba del archivo que
 * nombra (el relleno, por ejemplo), con el dibujo cambiado por nada y la caja del mapa «montada».
 */
function laFuncion(codigo, nombre) {
  const m = new RegExp('^(?:export\\s+(?:default\\s+)?)?function\\s+' + nombre + '\\(', 'm').exec(codigo);
  if (!m) return { falla: 'no encuentro function ' + nombre };
  const inicio = codigo.indexOf('function', m.index);
  const cuerpo = cuerpoDeLaFuncion(codigo, inicio);
  let texto = codigo.slice(inicio, cuerpo.fin + 1);
  const seguroArchivo = sinTextos(codigo);
  // Las constantes de arriba del archivo (las de columna 0), con su valor entero.
  const todas = [];
  const reConst = /^(?:export\s+)?const\s+([A-Za-z_]\w*)\s*=\s*/gm;
  let c;
  while ((c = reConst.exec(codigo))) {
    let j = reConst.lastIndex;
    while (j < seguroArchivo.length && seguroArchivo[j] !== ';') {
      if ('({['.includes(seguroArchivo[j])) j = elQueCierra(seguroArchivo, j);
      j += 1;
    }
    todas.push({ nombre: c[1], texto: 'const ' + c[1] + ' = ' + codigo.slice(reConst.lastIndex, j) + ';' });
  }
  // Se meten las que nombra la función, y las que nombran ésas (una cuenta que usa una tabla), en su orden.
  const dentro = new Set();
  let crece = true;
  while (crece) {
    crece = false;
    const mirado = texto + '\n' + todas.filter((k) => dentro.has(k.nombre)).map((k) => k.texto).join('\n');
    for (const k of todas) {
      if (!dentro.has(k.nombre) && new RegExp('\\b' + k.nombre + '\\b').test(mirado)) { dentro.add(k.nombre); crece = true; }
    }
  }
  const constantes = todas.filter((k) => dentro.has(k.nombre)).map((k) => k.texto);
  const ref = /ref=\{(\w+)\}/.exec(texto);
  if (!ref) return { falla: nombre + ' no pinta ninguna caja con `ref`: no sé dónde va el mapa' };
  const ret = /return\s*\(?\s*<[\s\S]*?\/>\s*\)?\s*;/.exec(texto);
  if (!ret) return { falla: 'no entiendo el dibujo de ' + nombre };
  texto = texto.slice(0, ret.index) + 'return __montar(' + ref[1] + ');' + texto.slice(ret.index + ret[0].length);
  return { texto: constantes.join('\n') + '\n' + texto };
}

function googleDeMentira(reg) {
  class Map {
    constructor(el, o) { reg.mapa = this; this.centros = [o.center]; this.encuadres = []; }
    setCenter(p) { this.centros.push(p); }
    fitBounds(b, relleno) { this.encuadres.push({ puntos: b.puntos, relleno }); }
  }
  class Marker {
    constructor(o) { reg.marcadores.push(this); this.pos = o.position; this.etiqueta = o.label && o.label.text; }
    setPosition(p) { this.pos = p; }
    setMap() {}
  }
  class DirectionsService {
    route(pedido, responder) {
      reg.pedidas.push(nombrar(pedido.origin) + '→' + nombrar(pedido.destination));
      const bounds = new LatLngBounds();
      responder({ routes: [{ bounds, legs: [{ duration: { text: '4 min' }, distance: { text: '1,3 km' } }] }] }, 'OK');
    }
  }
  class DirectionsRenderer {
    constructor(o) { reg.colores.push(o.polylineOptions && o.polylineOptions.strokeColor); reg.quietos.push(o.preserveViewport === true); }
    setMap() {}
  }
  class LatLngBounds { constructor() { this.puntos = []; } extend(p) { this.puntos.push(p); } union(b) { this.puntos.push(...b.puntos); } }
  return { maps: { Map, Marker, DirectionsService, DirectionsRenderer, LatLngBounds, TravelMode: { DRIVING: 'DRIVING' } } };
}

/** El margen que de verdad deja Google con lo que se le pasa (lo que no dice, 0). */
function margenDeGoogle(relleno) {
  if (typeof relleno === 'number') return { arriba: relleno, abajo: relleno, izquierda: relleno, derecha: relleno };
  const r = relleno || {};
  const n = (v) => (typeof v === 'number' ? v : 0);
  return { arriba: n(r.top), abajo: n(r.bottom), izquierda: n(r.left), derecha: n(r.right) };
}

/** Corre el mapa de una pantalla: sin carro, con carro, con el carro movido. */
function correrPantalla(fuenteFuncion, nombre, atributos, pantalla) {
  const reg = { mapa: null, marcadores: [], pedidas: [], colores: [], quietos: [], tiempos: 0 };
  const refs = [];
  const efectos = [];
  let iRef = 0;
  let iEf = 0;
  let pendientes = [];
  const useRef = (v) => { const i = iRef++; if (!refs[i]) refs[i] = { current: v }; return refs[i]; };
  const useEffect = (fn, deps) => {
    const i = iEf++;
    const antes = efectos[i];
    if (!antes || !deps || deps.length !== antes.deps.length || deps.some((d, k) => !Object.is(d, antes.deps[k]))) pendientes.push({ i, fn, deps: deps || [] });
  };
  const __montar = (r) => { if (!r.current) r.current = { caja: true, offsetHeight: ALTO_PANTALLA }; return null; };
  const window = { google: googleDeMentira(reg) };
  // eslint-disable-next-line no-new-func
  const Componente = new Function('useRef', 'useEffect', 'React', 'window', 'centroRiohacha', '__montar',
    fuenteFuncion + '\nreturn ' + nombre + ';')(useRef, useEffect, { useRef, useEffect }, window, PLAZA, __montar);

  const accesorios = (datos) => {
    const datosYa = { ...datos, setTiempoLlegada: () => { reg.tiempos += 1; }, setDistancia: () => {} };
    // Lo que la pantalla le preste al mapa con un `ref` (su tarjeta) llega con el alto de esa tarjeta.
    const alcance = new Proxy(datosYa, {
      has: (o, k) => k in o || /Ref$/.test(String(k)),
      get: (o, k) => (k in o ? o[k] : (/Ref$/.test(String(k)) ? { current: { offsetHeight: pantalla.altoTarjeta } } : undefined)),
    });
    const p = {};
    for (const [k, expr] of Object.entries(atributos)) {
      // eslint-disable-next-line no-new-func
      p[k] = new Function('alcance', 'with (alcance) { return (' + expr + '); }')(alcance);
    }
    return p;
  };
  const dibujar = (datos) => {
    iRef = 0; iEf = 0; pendientes = [];
    Componente(accesorios(datos));
    for (const e of pendientes) {
      if (efectos[e.i] && efectos[e.i].limpiar) efectos[e.i].limpiar();
      const l = e.fn();
      efectos[e.i] = { deps: e.deps, limpiar: typeof l === 'function' ? l : null };
    }
  };
  dibujar({ ...pantalla.datos, [pantalla.carro]: null });
  dibujar(pantalla.datos);
  dibujar({ ...pantalla.datos, [pantalla.carro]: CARRO_2 });

  const m = reg.mapa;
  if (!m) return { falla: 'el mapa de «' + pantalla.nombre + '» no se creó' };
  // Sin `preserveViewport`, cada ruta nueva la encuadra GOOGLE, sin margen, encima de lo que se le haya pedido.
  const loEncuadraGoogle = reg.quietos.some((q) => !q);
  const encuadre = m.encuadres[m.encuadres.length - 1];
  return {
    mapa: nombre,
    centros: m.centros.map(nombrar),
    rutas: [...new Set(reg.pedidas)],
    colores: [...new Set(reg.colores)],
    marcadores: reg.marcadores.map((x) => x.etiqueta),
    encuadres: m.encuadres.length,
    loEncuadraGoogle,
    // Al moverse el carro, ¿se vuelve a encuadrar? (antes lo hacía Google por su cuenta; ahora, este mapa).
    sigueAlCarro: loEncuadraGoogle || m.encuadres.length >= 2,
    puntosEncuadrados: encuadre ? [...new Set(encuadre.puntos.map(nombrar))] : [],
    margen: loEncuadraGoogle ? margenDeGoogle(0) : (encuadre ? margenDeGoogle(encuadre.relleno) : null),
    altoTarjeta: pantalla.altoTarjeta,
    avisaElTiempo: reg.tiempos > 0,
  };
}

function medir(commit) {
  const L = lector(commit);
  const conRuta = [];
  for (const a of L.lista()) {
    const cod = L.leer(SRC + '/' + a);
    const re = /^(?:export\s+(?:default\s+)?)?function\s+([A-Z]\w*)\(/gm;
    let f;
    while ((f = re.exec(cod))) {
      const ini = cod.indexOf('function', f.index);
      const cuerpo = cuerpoDeLaFuncion(cod, ini);
      if (cuerpo && /DirectionsRenderer/.test(cuerpo.texto)) conRuta.push(a + ':' + f[1]);
    }
  }
  const pantallas = PANTALLAS.map((p) => {
    const codigo = L.leer(SRC + '/' + p.archivo);
    const uso = elMapaDeLaPantalla(codigo, p.ancla);
    if (uso.falla) return { pantalla: p.nombre, falla: uso.falla };
    const donde = dondeVive(L, p.archivo, codigo, uso.nombre);
    if (donde.falla) return { pantalla: p.nombre, falla: donde.falla };
    const fn = laFuncion(donde.codigo, uso.nombre);
    if (fn.falla) return { pantalla: p.nombre, falla: fn.falla };
    try {
      return { pantalla: p.nombre, vive: donde.archivo, ...correrPantalla(fn.texto, uso.nombre, uso.atributos, p) };
    } catch (e) {
      return { pantalla: p.nombre, falla: 'el mapa reventó al correrlo: ' + e.message };
    }
  });
  const fallos = [];
  if (conRuta.length !== 1) fallos.push(conRuta.length + ' componentes dibujan una ruta (' + conRuta.join(', ') + '): tiene que ser UNO');
  for (const p of pantallas) {
    if (p.falla) { fallos.push(p.pantalla + ': ' + p.falla); continue; }
    if (!p.margen) fallos.push(p.pantalla + ': nunca encuadra la ruta');
    else if (p.margen.abajo < p.altoTarjeta) fallos.push(p.pantalla + ': deja ' + p.margen.abajo + ' px abajo al encuadrar la ruta y su tarjeta mide ' + p.altoTarjeta + ' — la tarjeta tapa la ruta' + (p.loEncuadraGoogle ? ' (la encuadra Google, sin margen)' : ''));
    if (!p.sigueAlCarro) fallos.push(p.pantalla + ': al moverse el carro el mapa ya no lo sigue');
  }
  return { conRuta, pantallas, fallos };
}

module.exports = { medir, margenDeGoogle, elMapaDeLaPantalla, laFuncion, correrPantalla, PANTALLAS };

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : null;
  const r = medir(commit);
  console.log('MAPAS CON RUTA — ' + (commit ? 'commit ' + commit : 'el disco'));
  console.log('Componentes que dibujan una ruta: ' + r.conRuta.length + ' (' + r.conRuta.join(', ') + ')');
  for (const p of r.pantallas) {
    if (p.falla) { console.log('  · ' + p.pantalla + ': 🔴 ' + p.falla); continue; }
    const g = p.margen;
    console.log('  · ' + p.pantalla + ' → <' + p.mapa + '> de ' + p.vive);
    console.log('      margen al encuadrar: arriba ' + (g ? g.arriba : '-') + ' · abajo ' + (g ? g.abajo : '-') + ' · lados ' + (g ? g.izquierda + '/' + g.derecha : '-'));
    console.log('      centros: ' + p.centros.join(' → ') + ' · ruta: ' + p.rutas.join(', ') + ' · color: ' + p.colores.join(', ')
      + ' · marcadores: ' + p.marcadores.join(' ') + ' · encuadra ' + p.encuadres + ' vez/veces (' + p.puntosEncuadrados.join('+') + ')'
      + ' · avisa el tiempo: ' + (p.avisaElTiempo ? 'sí' : 'no') + ' · sigue al carro: ' + (p.sigueAlCarro ? 'sí' : 'no')
      + (p.loEncuadraGoogle ? ' · 🔴 la encuadra Google (sin preserveViewport)' : '') + ' · tarjeta de ' + p.altoTarjeta + ' px');
  }
  console.log(r.fallos.length ? '🔴 ' + r.fallos.length + ' problema(s):\n  · ' + r.fallos.join('\n  · ') : '✓ un solo mapa con ruta, y en las cuatro pantallas deja sitio a la tarjeta');
  process.exit(r.fallos.length ? 1 : 0);
}
