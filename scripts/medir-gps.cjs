#!/usr/bin/env node
/**
 * MEDIR CÓMO SE LE PIDE EL GPS AL TELÉFONO — gemelo G28 (28-sep-2026).
 * Solo lee código y lo EJECUTA con teléfonos de mentira; no toca datos.
 *
 *   node scripts/medir-gps.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-gps.cjs --commit <hash>  <- el de otro commit (el careo antes/después)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cuántos sitios de las TRES apps le piden el GPS al teléfono POR SU CUENTA
 *     (`navigator.geolocation.getCurrentPosition` / `watchPosition` escrito a
 *     mano) fuera de la pieza común `guajirago/src/pedirGps.js`, y cuántos
 *     juegos de tiempos distintos llevan escritos. Antes: 6 sitios, 5 juegos.
 *  2. Qué le pide CADA sitio al teléfono, en orden, CORRIENDO su petición con
 *     la regla de `pruebas/cargar.cjs` (`intentosDelGps`). El careo exige que
 *     sea lo mismo antes y después: G28 junta, no cambia tiempos.
 *  3. El seguimiento del conductor: se saca de `AppConductor.js` el efecto que
 *     sigue su GPS y se CORRE entero con un teléfono de mentira al que el
 *     satélite se le cae 5 veces seguidas; luego el conductor sale del turno.
 *     Se cuenta cuántos seguimientos quedan ABIERTOS después de salir y cuántas
 *     veces se escribe su ficha después de salir. Antes: 5 y 5. Tiene que ser 0 y 0.
 *     Y bajo techo (satélite no, wifi sí) su ubicación tiene que seguir llegando.
 *
 * ── LO QUE NO HACE, dicho ───────────────────────────────────────────────────
 *   · No corre React ni un navegador. El seguimiento se corre sacado del
 *     archivo; un teléfono de verdad lo mira el robot (`robot/conductor-en-turno.cjs`).
 *   · Con `--commit`, las pantallas salen de ese commit y `pedirGps.js` también
 *     (si en ese commit no existía, no hace falta: nadie la llamaba).
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo, cuerpoDeLaFuncion, intentosDelGps, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const PIEZA = 'guajirago/src/pedirGps.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];

// Los sitios que piden el GPS, con DÓNDE empieza cada petición. El ancla hace
// falta porque un archivo puede tener varias (ver `intentosDelGps`).
const SITIOS = [
  ['el pasajero al abrir la pantalla', 'guajirago/src/Solicitar.js', 'if (!navigator.geolocation) return;'],
  ['el botón «Usar mi ubicación» del mapa', 'guajirago/src/Solicitar.js', 'const usarMiUbicacion'],
  ['el conductor al entrar en turno', 'guajirago/src/AppConductor.js', 'const guardarUbicacion'],
  ['el botón de la dirección del pedido', 'guajirago/src/Restaurantes.js', 'const usarMiUbicacion'],
  ['los botones de emergencia', 'guajirago/src/ubicacionDeAhora.js', 'export function ubicacionDeAhora'],
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
    if (e.isDirectory()) fuera.push(...archivosJs(r));
    else if (/\.js$/.test(e.name) && !/\.test\.js$/.test(e.name)) fuera.push(r);
  }
  return fuera;
}

/** 1 · Los que piden el GPS por su cuenta, y los juegos de tiempos que llevan escritos. */
function losQuePidenPorSuCuenta(leerDe) {
  const sitios = [];
  const juegos = new Set();
  for (const carpeta of CARPETAS) {
    for (const r of archivosJs(carpeta)) {
      if (r === PIEZA) continue;
      const t = leerDe(r);
      if (!t) continue;
      const codigo = soloCodigo(t);
      const n = (codigo.match(/navigator\.geolocation\.(?:getCurrentPosition|watchPosition)\s*\(/g) || []).length;
      if (n) sitios.push([r, n]);
      for (const m of codigo.matchAll(/\{\s*enableHighAccuracy[^}]*\}/g)) {
        juegos.add(m[0].replace(/\s+/g, ' '));
      }
    }
  }
  return { sitios, juegos: [...juegos] };
}

/** Un teléfono de mentira que lleva la cuenta de sus seguimientos abiertos. */
function telefono(estado) {
  let sig = 1;
  const vivos = new Map();
  const pedidos = [];
  const contesta = (o) => ((o || {}).enableHighAccuracy === true ? estado.satelite : estado.wifi);
  const pos = { coords: { latitude: 11.5312, longitude: -72.9241 }, timestamp: 0 };
  return {
    vivos,
    pedidos,
    // Todos los seguimientos vivos reciben lo que les toca: posición si su
    // precisión contesta, fallo si no. Es lo que hace el teléfono cada vez que
    // vence el tiempo de un seguimiento.
    tic() {
      for (const [, w] of [...vivos]) {
        if (contesta(w.o)) w.bien(pos);
        else if (w.mal) w.mal({ code: 3, message: 'timeout' });
      }
    },
    navigator: {
      geolocation: {
        getCurrentPosition: (bien, mal, o) => (contesta(o) ? bien(pos) : (mal && mal({ code: 3 }))),
        watchPosition: (bien, mal, o) => {
          const id = sig++;
          vivos.set(id, { bien, mal, o: o || {} });
          pedidos.push(o || {});
          return id;
        },
        clearWatch: (id) => { vivos.delete(id); },
      },
    },
  };
}

/** 3 · El efecto del conductor que sigue su GPS, sacado del archivo y CORRIDO. */
function elSeguimientoDelConductor(leerDe, { satelite, wifi, caidas, luego }) {
  const t = leerDe('guajirago/src/AppConductor.js');
  if (!t) return { falla: 'no encuentro AppConductor.js' };
  const codigo = soloCodigo(t);
  const d = codigo.indexOf('const guardarUbicacion');
  if (d < 0) return { falla: 'no encuentro `guardarUbicacion`' };
  const efecto = codigo.lastIndexOf('useEffect(', d);
  const cuerpo = efecto < 0 ? null : cuerpoDeLaFuncion(codigo, efecto + 'useEffect('.length);
  if (!cuerpo || cuerpo.fin < d) return { falla: 'no encuentro el efecto que sigue el GPS del conductor' };

  const estado = { satelite, wifi };
  const tel = telefono(estado);
  const escrituras = [];
  let fuera = false;
  const conocidos = {
    navigator: tel.navigator,
    auth: { currentUser: { uid: 'conductor-1' } },
    db: {},
    doc: (...a) => a.join('/'),
    setDoc: (ref, datos) => { escrituras.push({ fuera, datos }); return Promise.resolve(); },
    setUbicacion: () => {},
    ubicacionRef: { current: null },
    registrarTokenFCM: () => Promise.resolve(true),
    activo: true, fase: null, nombre: 'Pedro', telefono: '3000000000', placa: 'ABC123', vehiculo: 'Taxi',
  };
  // Las piezas que el archivo importa de `pedirGps.js` se le pasan de verdad.
  const pieza = leerDe(PIEZA);
  if (pieza) Object.assign(conocidos, cargarDeLaApp(PIEZA, pieza));

  const libres = [];
  for (let vuelta = 0; vuelta <= 12; vuelta += 1) {
    const nombres = [...Object.keys(conocidos), ...libres];
    const valores = [...Object.values(conocidos), ...libres.map(() => () => {})];
    try {
      // eslint-disable-next-line no-new-func
      const salir = new Function(...nombres, cuerpo.texto)(...valores);
      for (let i = 0; i < caidas; i += 1) tel.tic();
      const abiertosEnTurno = tel.vivos.size;
      const escritasEnTurno = escrituras.length;
      if (typeof salir === 'function') salir();
      fuera = true;
      const abiertosAlSalir = tel.vivos.size;
      // Ya fuera del turno, el teléfono vuelve a dar posición (sale de la casa,
      // vuelve la señal): lo que siga abierto la escribe en la ficha.
      Object.assign(estado, luego || { satelite: true, wifi: true });
      tel.tic();
      return {
        abiertosEnTurno,
        escritasEnTurno,
        abiertosAlSalir,
        escritasAlSalir: escrituras.filter((e) => e.fuera).length,
        seguimientosPedidos: tel.pedidos,
      };
    } catch (e) {
      const falta = /^(\w+) is not defined$/.exec(e.message || '');
      if (!falta || libres.includes(falta[1])) return { falla: 'el efecto reventó al correrlo: ' + e.message };
      libres.push(falta[1]);
    }
  }
  return { falla: 'el efecto usa demasiados nombres de fuera' };
}

function medir(commit) {
  const leerDe = lector(commit);
  const cuenta = losQuePidenPorSuCuenta(leerDe);
  const pieza = leerDe(PIEZA);
  const intentos = SITIOS.map(([quien, archivo, ancla]) => {
    const t = leerDe(archivo);
    if (!t) return [quien, { falla: 'no existe ' + archivo }];
    const r = intentosDelGps(t, false, ancla, pieza || undefined);
    return [quien, r.falla ? { falla: r.falla } : { intentos: r.intentos.map((o) => ({ ...o })) }];
  });
  const caida = elSeguimientoDelConductor(leerDe, { satelite: false, wifi: false, caidas: 5 });
  const bajoTecho = elSeguimientoDelConductor(leerDe, { satelite: false, wifi: true, caidas: 3 });
  const enLaCalle = elSeguimientoDelConductor(leerDe, { satelite: true, wifi: true, caidas: 3 });
  return { cuenta, intentos, caida, bajoTecho, enLaCalle };
}

const corto = (o) => (o.enableHighAccuracy ? 'satélite' : 'wifi') + ' ' + (o.timeout / 1000) + ' s'
  + ' (guardada ' + ((o.maximumAge || 0) / 1000) + ' s)';

function informe(commit) {
  const v = medir(commit);
  console.log('\n  CÓMO SE LE PIDE EL GPS AL TELÉFONO — ' + (commit ? 'commit ' + commit : 'el disco de hoy'));
  console.log('\n  1 · sitios que lo piden por su cuenta (fuera de pedirGps.js): '
    + v.cuenta.sitios.reduce((a, [, n]) => a + n, 0) + ' en ' + v.cuenta.sitios.length + ' archivo(s)');
  for (const [r, n] of v.cuenta.sitios) console.log('      · ' + r + ': ' + n);
  console.log('    juegos de tiempos escritos a mano en las pantallas: ' + v.cuenta.juegos.length);
  for (const j of v.cuenta.juegos) console.log('      · ' + j);
  console.log('\n  2 · lo que cada sitio le pide al teléfono, en orden (corrido)');
  for (const [quien, r] of v.intentos) {
    console.log('      · ' + quien + ': ' + (r.falla ? '🔴 ' + r.falla : r.intentos.map(corto).join(' → ')));
  }
  console.log('\n  3 · el seguimiento del conductor (corrido)');
  const c = v.caida;
  if (c.falla) console.log('      🔴 ' + c.falla);
  else {
    console.log('      con el satélite cayéndose 5 veces: ' + c.abiertosEnTurno + ' seguimiento(s) abiertos en turno');
    console.log('      al salir del turno quedan abiertos: ' + c.abiertosAlSalir
      + '  · y, cuando vuelve la señal, escriben la ficha ya fuera de turno: ' + c.escritasAlSalir + ' vez/veces');
  }
  const b = v.bajoTecho;
  console.log('      bajo techo (satélite no, wifi sí): ' + (b.falla ? '🔴 ' + b.falla
    : b.escritasEnTurno + ' escritura(s) de su ubicación en turno; al salir quedan ' + b.abiertosAlSalir
      + ' abiertos, que escriben ' + b.escritasAlSalir + ' vez/veces ya fuera'));
  const e = v.enLaCalle;
  console.log('      en la calle (satélite sí): ' + (e.falla ? '🔴 ' + e.falla
    : e.escritasEnTurno + ' escritura(s) en turno; al salir quedan ' + e.abiertosAlSalir
      + ' abiertos, que escriben ' + e.escritasAlSalir + ' vez/veces ya fuera'));
  console.log('');
  return v;
}

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  informe(i >= 0 ? process.argv[i + 1] : null);
}

module.exports = { medir, SITIOS, PIEZA, elSeguimientoDelConductor, losQuePidenPorSuCuenta, lector };
