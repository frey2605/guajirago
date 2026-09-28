#!/usr/bin/env node
/**
 * MEDIR CÓMO SE CONVIERTE UN PUNTO DEL MAPA EN DIRECCIÓN — gemelo G30 (28-sep-2026).
 * Solo LEE: el código (y lo EJECUTA con un Google de mentira) y, con `--datos`,
 * la colección `pedidos` de producción. No escribe nada.
 *
 *   node scripts/medir-direccion-punto.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-direccion-punto.cjs --commit <hash>  <- el de otro commit (careo antes/después)
 *   node scripts/medir-direccion-punto.cjs --datos          <- y además cuenta los pedidos vivos
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántos sitios de las TRES apps le piden a Google la dirección de un
 *     punto POR SU CUENTA (`.geocode({ location ...`) fuera de la pieza común
 *     `guajirago/src/direccionDePunto.js`. Antes: 2 (el mapa de recogida y el
 *     botón de la dirección del pedido de comida).
 *  2. Qué hace CADA una de las dos pantallas en 4 casos —Google contesta,
 *     Google no encuentra nada, Google niega el permiso, Google no está
 *     cargado—, sacando su código del archivo y CORRIÉNDOLO:
 *       · el mapa de recogida (`resolverDireccion` de Solicitar.js): con qué
 *         dirección llama a `onCambioPunto`. G30 NO cambia esto: tiene que
 *         salir idéntico antes y después.
 *       · el botón «Usar mi ubicación» del pedido (`usarMiUbicacion` de
 *         Restaurantes.js): qué queda escrito en la dirección y si sale una
 *         ventanita. Antes, si Google fallaba, escribía las coordenadas crudas
 *         SIN DECIR NADA.
 *  3. Con `--datos`: cuántos pedidos guardados llevan por dirección unas
 *     coordenadas crudas («11.544210, -72.907110») — los que nacieron de ese
 *     fallo mudo. Los pedidos solo guardan el TEXTO de la dirección, así que
 *     esas cifras son lo único que el domiciliario tuvo para encontrar al cliente.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre React ni un navegador: los dos trozos se corren sacados del
 *     archivo. La pantalla de verdad la mira el robot.
 *   · No sabe si Google de verdad falla hoy en producción: eso se ve en el
 *     teléfono. Lo de los datos dice cuántas veces YA falló.
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const PIEZA = 'guajirago/src/direccionDePunto.js';
const PIEZA_GPS = 'guajirago/src/pedirGps.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const PUNTO = { lat: 11.5442101, lng: -72.9071099 };
const CALLE = 'Calle 15 #10-20, Riohacha, La Guajira, Colombia';

// Lo que contesta Google en cada caso. `null` = Google no está cargado.
const CASOS = [
  ['Google contesta', { status: 'OK', results: [{ formatted_address: CALLE }] }],
  ['Google no encuentra nada', { status: 'ZERO_RESULTS', results: [] }],
  ['Google niega el permiso', { status: 'REQUEST_DENIED', results: null }],
  ['Google no está cargado', null],
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

/** 1 · Los que le piden a Google la dirección de un punto por su cuenta. */
function losQueGeocodificanPorSuCuenta(leerDe) {
  const sitios = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosJs(carpeta)) {
      if (r === PIEZA) continue;
      const t = leerDe(r);
      if (!t) continue;
      const n = (soloCodigo(t).match(/\.geocode\s*\(\s*\{\s*location\b/g) || []).length;
      if (n) sitios.push([r, n]);
    }
  }
  return sitios;
}

/** Un Google de mentira: su geocodificador contesta lo que diga el caso, al momento. */
function geocodificadorDe(caso) {
  return { geocode: (req, cb) => cb(caso.results, caso.status) };
}

/** Las constantes de arriba del archivo (`const NOMBRE = '...';`) que el trozo nombre. */
function constanteDelArchivo(codigo, nombre) {
  const m = new RegExp('^const ' + nombre + '\\s*=\\s*([\'"`])([\\s\\S]*?)\\1;', 'm').exec(codigo);
  return m ? m[2] : undefined;
}

/**
 * Corre un trozo sacado del archivo con los nombres que se le den. Si nombra
 * algo que no está —una pieza importada que ese commit trae o no—, se busca como
 * constante del archivo o se da como función muda, y se vuelve a intentar.
 */
function correrTrozo(texto, conocidos, codigo) {
  const libres = {};
  for (let vuelta = 0; vuelta <= 12; vuelta += 1) {
    const nombres = [...Object.keys(conocidos), ...Object.keys(libres)];
    const valores = [...Object.values(conocidos), ...Object.values(libres)];
    try {
      // eslint-disable-next-line no-new-func
      return { valor: new Function(...nombres, texto)(...valores) };
    } catch (e) {
      const falta = /^(\w+) is not defined$/.exec(e.message || '');
      if (!falta || falta[1] in libres) return { falla: 'reventó al correrlo: ' + e.message };
      const c = constanteDelArchivo(codigo, falta[1]);
      libres[falta[1]] = c !== undefined ? c : () => {};
    }
  }
  return { falla: 'nombra demasiadas cosas de fuera' };
}

/** 2a · El mapa de recogida: `resolverDireccion`, corrida. */
function elMapaDeRecogida(leerDe, caso) {
  const t = leerDe('guajirago/src/Solicitar.js');
  if (!t) return { falla: 'no existe Solicitar.js' };
  // Los textos se dejan: `soloCodigo` solo quita comentarios, y el trozo se corre.
  const codigo = soloCodigo(t);
  const d = codigo.indexOf('const resolverDireccion');
  if (d < 0) return { falla: 'no encuentro `resolverDireccion`' };
  const fn = cuerpoDeLaFuncion(codigo, d);
  if (!fn) return { falla: 'no entiendo la forma de `resolverDireccion`' };
  const llamadas = [];
  const conocidos = {
    onCambioPunto: (punto, direccion, loEligio) => llamadas.push({ punto, direccion, loEligio }),
    loEligioRef: { current: true },
    ultimoPuntoRef: { current: null },
    geocoderRef: { current: caso ? geocodificadorDe(caso) : null },
    console: { log: () => {} },
  };
  const pieza = leerDe(PIEZA);
  if (pieza) Object.assign(conocidos, cargarDeLaApp(PIEZA, pieza));
  const r = correrTrozo('return ((lat, lng) => {' + fn.texto + '});', conocidos, codigo);
  if (r.falla) return { falla: '`resolverDireccion` ' + r.falla };
  try { r.valor(PUNTO.lat, PUNTO.lng); } catch (e) { return { falla: '`resolverDireccion` reventó: ' + e.message }; }
  return { llamadas };
}

/** 2b · El botón «Usar mi ubicación» del pedido de comida, corrido. */
function elBotonDelPedido(leerDe, caso) {
  const t = leerDe('guajirago/src/Restaurantes.js');
  if (!t) return { falla: 'no existe Restaurantes.js' };
  const codigo = soloCodigo(t);
  const d = codigo.indexOf('const usarMiUbicacion');
  if (d < 0) return { falla: 'no encuentro `usarMiUbicacion`' };
  const fn = cuerpoDeLaFuncion(codigo, d);
  if (!fn) return { falla: 'no entiendo la forma de `usarMiUbicacion`' };
  const estado = { direccion: '', aviso: '', ubicando: null };
  const conocidos = {
    navigator: { geolocation: { getCurrentPosition: (bien) => bien({ coords: { latitude: PUNTO.lat, longitude: PUNTO.lng } }) } },
    window: caso ? { google: { maps: { Geocoder: function Geocoder() { return geocodificadorDe(caso); } } } } : {},
    setDireccion: (v) => { estado.direccion = v; },
    setAvisoUbic: (v) => { estado.aviso = v; },
    setUbicando: (v) => { estado.ubicando = v; },
  };
  const gps = leerDe(PIEZA_GPS);
  if (gps) Object.assign(conocidos, cargarDeLaApp(PIEZA_GPS, gps));
  const pieza = leerDe(PIEZA);
  if (pieza) Object.assign(conocidos, cargarDeLaApp(PIEZA, pieza));
  const r = correrTrozo(fn.texto, conocidos, codigo);
  if (r.falla) return { falla: '`usarMiUbicacion` ' + r.falla };
  // La ventanita solo existe si la pantalla la PINTA: se busca que `avisoUbic`
  // abra una ventanita en el archivo (la que ya salía con el GPS negado).
  const pinta = /\{avisoUbic && \(/.test(codigo);
  return { ...estado, ventanita: !!estado.aviso && pinta };
}

// Una dirección que en realidad son coordenadas: «11.544210, -72.907110».
const ES_COORDENADA = /^\s*-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}\s*$/;

function medir(commit) {
  const leerDe = lector(commit);
  const sitios = losQueGeocodificanPorSuCuenta(leerDe);
  const mapa = CASOS.map(([nombre, caso]) => [nombre, elMapaDeRecogida(leerDe, caso)]);
  const boton = CASOS.map(([nombre, caso]) => [nombre, elBotonDelPedido(leerDe, caso)]);
  const piezaExiste = !!leerDe(PIEZA);
  return { commit: commit || '(disco)', piezaExiste, sitios, mapa, boton };
}

async function contarPedidos() {
  const { traer, doc } = require('./nube.cjs');
  const pedidos = (await traer('pedidos')).map(doc);
  const conCoordenadas = pedidos.filter((p) => typeof p.direccion === 'string' && ES_COORDENADA.test(p.direccion));
  const sinDireccion = pedidos.filter((p) => !p.direccion || !String(p.direccion).trim());
  return {
    total: pedidos.length,
    conCoordenadas: conCoordenadas.length,
    sinDireccion: sinDireccion.length,
    ejemplos: conCoordenadas.slice(0, 5).map((p) => ({ id: p.id, direccion: p.direccion })),
  };
}

function informe(m) {
  const out = [];
  out.push('G30 · de un punto del mapa a su dirección — ' + m.commit);
  out.push('  pieza común (' + PIEZA + '): ' + (m.piezaExiste ? 'existe' : 'NO existe'));
  out.push('  1. sitios que le piden la dirección a Google por su cuenta: ' + m.sitios.reduce((s, [, n]) => s + n, 0)
    + (m.sitios.length ? '  (' + m.sitios.map(([r, n]) => r + ' ×' + n).join(', ') + ')' : ''));
  out.push('  2a. el mapa de recogida (lo que le llega a onCambioPunto):');
  for (const [n, r] of m.mapa) {
    out.push('      · ' + n.padEnd(26) + (r.falla ? '🔴 ' + r.falla
      : r.llamadas.map((l) => 'dirección «' + l.direccion + '»').join(' | ') + ' (' + r.llamadas.length + ' llamada)'));
  }
  out.push('  2b. el botón «Usar mi ubicación» del pedido:');
  for (const [n, r] of m.boton) {
    out.push('      · ' + n.padEnd(26) + (r.falla ? '🔴 ' + r.falla
      : 'dirección «' + r.direccion + '» · ' + (r.ventanita ? 'ventanita: «' + r.aviso + '»' : 'SIN AVISO')
        + (r.ubicando === false ? '' : ' · 🔴 el botón se queda en «Buscando»')));
  }
  return out.join('\n');
}

module.exports = { medir, CASOS, PUNTO, CALLE, ES_COORDENADA, contarPedidos };

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : null;
  const m = medir(commit);
  console.log(informe(m));
  if (process.argv.includes('--datos')) {
    contarPedidos().then((p) => {
      console.log('  3. pedidos guardados en producción: ' + p.total);
      console.log('      · con coordenadas crudas por dirección: ' + p.conCoordenadas);
      console.log('      · sin dirección: ' + p.sinDireccion);
      for (const e of p.ejemplos) console.log('        ' + e.id + '  «' + e.direccion + '»');
    }).catch((e) => { console.log('  3. 🔴 no pude leer los pedidos: ' + e.message); process.exitCode = 1; });
  }
}
