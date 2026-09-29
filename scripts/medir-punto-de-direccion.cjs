#!/usr/bin/env node
/**
 * MEDIR CÓMO SE CONVIERTE UNA DIRECCIÓN ESCRITA EN UN PUNTO — gemelo G60 (29-sep-2026).
 * Solo LEE el código (y lo EJECUTA con un Google de mentira). No lee ni escribe datos:
 * lo que se mide no depende de nada guardado.
 *
 *   node scripts/medir-punto-de-direccion.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-punto-de-direccion.cjs --commit <hash>  <- el de otro commit (careo antes/después)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántas veces está escrito a mano «Riohacha, Colombia» en el código de
 *     las TRES apps fuera de `guajirago/src/riohacha.js`. Antes: 4.
 *  2. Cuántos sitios le piden a Google las coordenadas de una dirección POR SU
 *     CUENTA (`.geocode({ address ...`) fuera de la pieza común
 *     `guajirago/src/direccionDePunto.js`. Antes: 4.
 *  3. Qué hace CADA uno de los cuatro sitios en cada caso —Google la encuentra,
 *     no la encuentra, niega el permiso, no está cargado, y (donde se puede
 *     llegar) el texto vacío—, sacando su código del archivo y CORRIÉNDOLO:
 *       · qué texto le pregunta a Google, y
 *       · qué le queda a la pantalla (el punto, o nada).
 *     G60 NO cambia esto: tiene que salir IDÉNTICO antes y después.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre React ni un navegador: los trozos se corren sacados del archivo.
 *   · El texto vacío NO se prueba en el pedido del viaje: allí no se llega con
 *     el origen vacío (la validación de `solicitarViaje` corta antes, y eso lo
 *     vigila `scripts/medir-origen-del-viaje.cjs`).
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo, sinTextos, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const PIEZA = 'guajirago/src/direccionDePunto.js';
const GEOGRAFIA = 'guajirago/src/riohacha.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const TEXTO = 'Cl. 15 # 7-100';
const LUGAR = { lat: 11.5501234, lng: -72.9012345 };

// Lo que contesta Google en cada caso. `null` = Google no está cargado.
const CASOS = [
  ['Google la encuentra', { status: 'OK', results: [{ geometry: { location: { lat: () => LUGAR.lat, lng: () => LUGAR.lng } } }] }, TEXTO],
  ['Google no la encuentra', { status: 'ZERO_RESULTS', results: [] }, TEXTO],
  ['Google niega el permiso', { status: 'REQUEST_DENIED', results: null }, TEXTO],
  ['Google no está cargado', null, TEXTO],
  ['texto vacío', { status: 'OK', results: [{ geometry: { location: { lat: () => LUGAR.lat, lng: () => LUGAR.lng } } }] }, ''],
];

function lector(commit) {
  if (!commit) {
    return (r) => (fs.existsSync(path.join(RAIZ, r)) ? fs.readFileSync(path.join(RAIZ, r), 'utf8') : null);
  }
  return (r) => {
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
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

/** 1 y 2 · La ciudad escrita a mano, y los que le preguntan a Google por su cuenta. */
function lasCopias(leerDe) {
  const ciudad = [];
  const porSuCuenta = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosJs(carpeta)) {
      const t = leerDe(r);
      if (!t) continue;
      const codigo = soloCodigo(t);
      if (r !== GEOGRAFIA) {
        const n = (codigo.match(/Riohacha,\s*Colombia/g) || []).length;
        if (n) ciudad.push([r, n]);
      }
      if (r !== PIEZA) {
        const n = (codigo.match(/\.geocode\s*\(\s*\{\s*address\b/g) || []).length;
        if (n) porSuCuenta.push([r, n]);
      }
    }
  }
  return { ciudad, porSuCuenta };
}

/** Un Google de mentira: apunta qué se le preguntó y contesta lo que diga el caso, al momento. */
function googleDe(caso, preguntas) {
  if (!caso) return {};
  return {
    google: {
      maps: {
        Geocoder: function Geocoder() {
          this.geocode = (req, cb) => { preguntas.push(req.address); cb(caso.results, caso.status); };
        },
      },
    },
  };
}

/** Las piezas de la app que el trozo puede nombrar (si el commit las trae). */
function lasPiezas(leerDe) {
  const fuente = leerDe(PIEZA);
  if (!fuente) return {};
  try { return cargarDeLaApp(PIEZA, fuente); } catch (e) { return {}; }
}

function correr(texto, conocidos) {
  try {
    // eslint-disable-next-line no-new-func
    return { valor: new Function(...Object.keys(conocidos), texto)(...Object.values(conocidos)) };
  } catch (e) {
    return { falla: 'reventó al correrlo: ' + e.message };
  }
}

/** El cuerpo de lo que empieza en `ancla` (una función, un `if`, un oyente), sacado del archivo. */
function elTrozo(leerDe, archivo, ancla, desde) {
  const t = leerDe(archivo);
  if (!t) return { falla: 'no existe ' + archivo };
  const codigo = soloCodigo(t);
  let d = desde ? codigo.indexOf(desde) : 0;
  if (d < 0) return { falla: 'no encuentro `' + desde + '` en ' + archivo };
  d = codigo.indexOf(ancla, d);
  if (d < 0) return { falla: 'no encuentro `' + ancla + '` en ' + archivo };
  // El siguiente `ancla` igual NO puede existir: si hay dos, no sé cuál es el bueno.
  if (sinTextos(codigo).indexOf(ancla, d + 1) >= 0 && !desde) {
    return { falla: 'hay más de un `' + ancla + '` en ' + archivo };
  }
  const fn = cuerpoDeLaFuncion(codigo, d);
  if (!fn) return { falla: 'no entiendo la forma de `' + ancla + '`' };
  return { cuerpo: fn.texto };
}

/** El respaldo del autocompletar: Google no trajo coordenadas con la sugerencia y se buscan por el nombre. */
function elAutocompletar(leerDe, caso, texto) {
  const tr = elTrozo(leerDe, 'guajirago/src/Solicitar.js', "addListener('place_changed'", 'function AutocompleteInput');
  if (tr.falla) return tr;
  const preguntas = [];
  const puntos = [];
  const r = correr(tr.cuerpo, {
    ...lasPiezas(leerDe),
    autocompleteRef: { current: { getPlace: () => ({ name: texto }) } },
    onChangeRef: { current: () => {} },
    onPlaceCoordsRef: { current: (p) => puntos.push(p) },
    window: googleDe(caso, preguntas),
  });
  if (r.falla) return r;
  return { preguntas, queda: puntos };
}

/** `geocodificarDestino` de una pantalla: el destino del mapa. */
function elDestino(leerDe, archivo, caso, texto) {
  const tr = elTrozo(leerDe, archivo, 'const geocodificarDestino');
  if (tr.falla) return tr;
  const preguntas = [];
  const puntos = [];
  const r = correr('return ((destinoTexto) => {' + tr.cuerpo + '});', {
    ...lasPiezas(leerDe),
    setDestinoCoords: (p) => puntos.push(p),
    window: googleDe(caso, preguntas),
  });
  if (r.falla) return r;
  try { r.valor(texto); } catch (e) { return { falla: 'reventó: ' + e.message }; }
  return { preguntas, queda: puntos };
}

/** El pedido del viaje: la dirección escrita a mano, SIN pin y SIN GPS (así solo cuenta lo que diga Google). */
async function elPedido(leerDe, caso, texto) {
  const tr = elTrozo(leerDe, 'guajirago/src/Solicitar.js', 'if (!usarPin)', 'const solicitarViaje');
  if (tr.falla) return tr;
  const preguntas = [];
  const r = correr('return (async () => { let coordsRecogida = null;\n' + tr.cuerpo + '\nreturn coordsRecogida; })();', {
    ...lasPiezas(leerDe),
    origen: texto,
    ubicacionEsDelGps: false,
    ubicacionPasajero: { lat: 0, lng: 0 },
    window: googleDe(caso, preguntas),
  });
  if (r.falla) return r;
  try { return { preguntas, queda: await r.valor }; } catch (e) { return { falla: 'reventó: ' + e.message }; }
}

const SITIOS = [
  ['el respaldo del autocompletar (Solicitar.js)', (l, c, t) => elAutocompletar(l, c, t), true],
  ['el destino del pasajero (Solicitar.js)', (l, c, t) => elDestino(l, 'guajirago/src/Solicitar.js', c, t), true],
  ['el destino del conductor (AppConductor.js)', (l, c, t) => elDestino(l, 'guajirago/src/AppConductor.js', c, t), true],
  // El pedido NO corre el texto vacío: allí no se llega (ver arriba).
  ['el pedido del viaje (Solicitar.js)', (l, c, t) => elPedido(l, c, t), false],
];

async function medir(commit) {
  const leerDe = lector(commit);
  const copias = lasCopias(leerDe);
  const sitios = [];
  for (const [nombre, fn, conVacio] of SITIOS) {
    const casos = [];
    for (const [caso, google, texto] of CASOS) {
      if (texto === '' && !conVacio) continue;
      casos.push([caso, await fn(leerDe, google, texto)]);
    }
    sitios.push([nombre, casos]);
  }
  return { commit: commit || '(disco)', piezaExiste: !!lasPiezas(leerDe).puntoDeDireccion, ...copias, sitios };
}

const suma = (l) => l.reduce((s, [, n]) => s + n, 0);

function informe(m) {
  const out = [];
  out.push('G60 · de una dirección escrita a su punto — ' + m.commit);
  out.push('  pieza común (puntoDeDireccion en ' + PIEZA + '): ' + (m.piezaExiste ? 'existe' : 'NO existe'));
  out.push('  1. «Riohacha, Colombia» escrito a mano fuera de riohacha.js: ' + suma(m.ciudad)
    + (m.ciudad.length ? '  (' + m.ciudad.map(([r, n]) => r + ' ×' + n).join(', ') + ')' : ''));
  out.push('  2. sitios que le piden a Google el punto de una dirección por su cuenta: ' + suma(m.porSuCuenta)
    + (m.porSuCuenta.length ? '  (' + m.porSuCuenta.map(([r, n]) => r + ' ×' + n).join(', ') + ')' : ''));
  out.push('  3. lo que hace cada sitio, corrido:');
  for (const [nombre, casos] of m.sitios) {
    out.push('     ' + nombre);
    for (const [caso, r] of casos) {
      out.push('       · ' + caso.padEnd(24) + (r.falla ? '🔴 ' + r.falla
        : 'pregunta ' + (r.preguntas.length ? r.preguntas.map((p) => '«' + p + '»').join(', ') : '(nada)')
          + ' → queda ' + JSON.stringify(r.queda)));
    }
  }
  return out.join('\n');
}

module.exports = { medir, informe, CASOS, TEXTO, LUGAR };

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : null;
  medir(commit).then((m) => console.log(informe(m))).catch((e) => { console.error(e); process.exitCode = 1; });
}
