#!/usr/bin/env node
/**
 * EL HISTORIAL DEL PASAJERO — ¿qué ve cada persona de sus propios viajes? — gemelo G21 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-historial-pasajero.cjs            (las pantallas + los datos de producción)
 *   node scripts/medir-historial-pasajero.cjs --sin-red  (solo las pantallas)
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El historial de viajes está en TRES pantallas: «Mis viajes» del pasajero (`Home.js`, `Historial`), «Mis viajes»
 * del menú de módulos (`MisViajes.js`, que junta lo que hiciste de pasajero y de conductor) y el del conductor
 * (`AppConductor.js`, `HistorialConductor`). El del conductor se arregló el 13-sep-2026 (salen TODOS los terminados, y
 * cada final dice en palabras qué pasó) y su medidor es `medir-historial-conductor.cjs`. Las otras dos se quedaron con
 * `finalizado || cancelado`: los viajes que canceló el conductor, los que nadie tomó y los que se quedaron a medias
 * NO APARECEN. No dan error ni salen en rojo: no están.
 *
 * ── CÓMO LO MIDE ────────────────────────────────────────────────────────────
 * Como el del conductor: NO lee etiquetas. Saca del archivo la cadena que llega a `setViajes(...)`, le saca sus
 * `.filter(...)` y LOS CORRE estado por estado, con las listas de verdad de `estadosViaje.js`. Así sirve igual para el
 * código de antes y el de ahora, y el paso 1 y el paso 12 se carean con el mismo contador. Los ayudantes de leer
 * código se IMPORTAN de `medir-historial-conductor.cjs` (no se copian: SEGUNDA LEY).
 *
 * Y se cuenta POR PERSONA, porque la pantalla es de cada uno.
 * No escribe nada: ni un archivo, ni un dato. Contra Firestore solo pide.
 */
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { argumentoDe, hastaElPuntoYComa, pareceSeguro, sinRabo } = require('./medir-historial-conductor.cjs');
const { lasConsultasConTope } = require('./medir-tope-historial.cjs');

const LISTAS = cargarDeLaApp('guajirago/src/estadosViaje.js');
const { ESTADOS_TERMINADOS, ESTADOS_EN_CURSO } = LISTAS;
const TODOS_LOS_ESTADOS = [...ESTADOS_TERMINADOS, ...ESTADOS_EN_CURSO];

// Las dos pantallas del pasajero. `quien` dice de qué lado sale cada viaje: la de Home solo pide los del pasajero; la
// de MisViajes pide los dos lados y los junta.
const PANTALLAS = [
  { nombre: 'Home · Mis viajes', archivo: 'guajirago/src/Home.js', ancla: 'function Historial(', lados: ['pasajeroId'] },
  { nombre: 'MisViajes', archivo: 'guajirago/src/MisViajes.js', ancla: 'function MisViajes(', lados: ['pasajeroId', 'conductorId'] },
];

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m', ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};
const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length));

/**
 * LO QUE DEJA PASAR UNA PANTALLA — corriendo sus filtros, no leyéndolos.
 *
 * @param pantalla  una de `PANTALLAS`
 * @param fuenteDePrueba  el texto del archivo, para que la prueba le dé pantallas de mentira (opcional)
 * @returns `{ entran, filtros, usaLaPieza, quejas }`; `entran` en `null` si no se pudo leer (cegado ≠ mal).
 */
function loQueDejaPasar(pantalla, fuenteDePrueba) {
  const quejas = [];
  const nada = { entran: null, filtros: [], usaLaPieza: null, quejas };
  const archivo = soloCodigo(fuenteDePrueba != null ? fuenteDePrueba : leer(pantalla.archivo));
  const i = archivo.indexOf(pantalla.ancla);
  if (i < 0) { quejas.push(pantalla.archivo + ': ya no encuentro «' + pantalla.ancla + '».'); return nada; }
  if (archivo.indexOf(pantalla.ancla, i + 1) >= 0) {
    quejas.push(pantalla.archivo + ': «' + pantalla.ancla + '» está más de una vez.');
    return nada;
  }
  const fn = cuerpoDeLaFuncion(archivo, i);
  if (!fn) { quejas.push(pantalla.archivo + ': no pude leer el cuerpo de la pantalla.'); return nada; }
  const t = sinRabo(fn.texto);

  // ── LA LISTA QUE ACABA EN LA PANTALLA ─────────────────────────────────
  const sets = (t.match(/setViajes\(/g) || []).length;
  if (sets !== 1) {
    quejas.push(pantalla.archivo + ': `setViajes(...)` se llama ' + sets + ' veces y debe ser UNA: con dos, la '
      + 'segunda puede pisar a la buena y esto solo miraría una.');
    return nada;
  }
  const iSet = t.indexOf('setViajes(');
  const arg = argumentoDe(t, iSet + 'setViajes'.length);
  if (arg == null) { quejas.push(pantalla.archivo + ': el `setViajes(` no cierra.'); return nada; }
  // La cadena entera, aunque esté partida en varios `const` (igual que en el del conductor).
  let cadena = arg;
  let nombre = (/^\s*([A-Za-z_$][\w$]*)/.exec(arg) || [])[1];
  for (let vuelta = 0; nombre && vuelta < 6; vuelta += 1) {
    const arranca = new RegExp('(?:const|let|var)\\s+' + nombre + '\\s*=').exec(t);
    if (!arranca) break;
    const tramo = hastaElPuntoYComa(t, arranca.index + arranca[0].length);
    if (tramo == null) { quejas.push(pantalla.archivo + ': la cadena de «' + nombre + '» no cierra.'); return nada; }
    cadena = tramo + '\n' + cadena;
    const deQuien = (/^\s*([A-Za-z_$][\w$]*)\s*[.;\n]/.exec(tramo) || [])[1];
    if (!deQuien || deQuien === 'snap' || deQuien === nombre) break;
    nombre = deQuien;
  }
  if (/\.slice\(/.test(cadena)) {
    quejas.push(pantalla.archivo + ': a la lista que ve la persona se le encadena un `.slice(...)`: recorta viajes '
      + 'sin tocar la lista de estados.');
  }

  // ── LOS FILTROS, CORRIDOS ─────────────────────────────────────────────
  const importa = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/estadosViaje['"]/.exec(archivo);
  const importados = importa ? importa[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  const filtros = [];
  let desde = 0;
  for (;;) {
    const j = cadena.indexOf('.filter(', desde);
    if (j < 0) break;
    const flecha = argumentoDe(cadena, j + 7);
    if (flecha == null) { quejas.push(pantalla.archivo + ': un `.filter(` no cierra.'); return nada; }
    filtros.push(flecha.trim());
    desde = j + 8 + flecha.length;
  }
  if (filtros.length === 0) {
    quejas.push(pantalla.archivo + ': la lista no se filtra: entraría también el viaje EN CURSO.');
  }
  const corridos = [];
  for (const f of filtros) {
    const raro = pareceSeguro(f, true);
    if (raro) { quejas.push(pantalla.archivo + ': el filtro ' + raro + ', así que no se corre.'); return nada; }
    // Lo que el filtro nombre de `estadosViaje.js` tiene que estar IMPORTADO: si no, en el teléfono revienta.
    for (const n of Object.keys(LISTAS)) {
      if (new RegExp('\\b' + n + '\\b').test(f) && !importados.includes(n)) {
        quejas.push(pantalla.archivo + ': el filtro usa `' + n + '` y el archivo no lo importa de `./estadosViaje`: '
          + 'en el teléfono esa pantalla revienta.');
      }
    }
    try {
      corridos.push(new Function(...Object.keys(LISTAS), 'return (' + f + ');')(...Object.values(LISTAS)));
    } catch (e) {
      quejas.push(pantalla.archivo + ': el filtro «' + f.slice(0, 60) + '» no se puede correr: ' + e.message);
      return nada;
    }
  }
  const entran = TODOS_LOS_ESTADOS.filter((e) => corridos.every((g) => {
    try { return !!g({ estado: e }); } catch (err) { return false; }
  }));

  // ── LA TARJETA: ¿el final en palabras y su color salen de la pieza común? ──
  const pieza = /comoTermino\(\s*v\s*,\s*([^)]*)\)/.exec(t);
  return { entran, filtros, usaLaPieza: pieza ? pieza[1].trim() : null, quejas, cuerpo: t, archivo };
}

// Los ayudantes de leer, para la prueba; el informe, solo si se corre a mano (una prueba no sale a internet).
module.exports = { PANTALLAS, loQueDejaPasar };
if (require.main !== module) return;

(async () => {
  const sinRed = process.argv.includes('--sin-red');
  console.log('');
  console.log(C.neg + '  EL HISTORIAL DE VIAJES DEL PASAJERO (G21)' + C.off);
  console.log('');
  const lectura = {};
  const { consultas } = lasConsultasConTope();
  for (const p of PANTALLAS) {
    const r = loQueDejaPasar(p);
    lectura[p.archivo] = r;
    console.log('  ' + C.neg + p.nombre + C.off + C.gris + '  ' + p.archivo + C.off);
    console.log('    ' + pad('viajes que entran', 24)
      + (r.entran ? JSON.stringify(r.entran) : C.roj + 'no lo pude leer' + C.off));
    const faltan = ESTADOS_TERMINADOS.filter((e) => r.entran && !r.entran.includes(e));
    console.log('    ' + pad('terminados que NO salen', 24)
      + (faltan.length ? C.roj + JSON.stringify(faltan) + C.off : C.ver + 'ninguno' + C.off));
    const vivos = ESTADOS_EN_CURSO.filter((e) => r.entran && r.entran.includes(e));
    if (vivos.length) console.log('    ' + pad('EN CURSO que se cuelan', 24) + C.roj + JSON.stringify(vivos) + C.off);
    console.log('    ' + pad('el final y su color', 24)
      + (r.usaLaPieza ? C.ver + 'de la pieza común: comoTermino(v, ' + r.usaLaPieza + ')' + C.off
        : C.roj + 'A MANO en la pantalla (no sale de estadosViaje.js)' + C.off));
    for (const c of consultas.filter((x) => x.archivo === p.archivo)) {
      console.log('    ' + pad('consulta :' + c.renglon, 24) + 'tope ' + c.tope + ' · '
        + (c.ordena ? C.ver + 'los ÚLTIMOS, ordena por ' + c.ordena + C.off
          : C.roj + 'SIN ORDEN: el servidor elige cuáles manda' + C.off));
    }
    for (const q of r.quejas) console.log(C.roj + '    ✗ ' + q + C.off);
    console.log('');
  }

  if (sinRed) return;
  const { traer, doc } = require('./nube.cjs');
  let viajes;
  try {
    viajes = (await traer('viajes')).map(doc);
  } catch (e) {
    console.log(C.ama + '  ⚠ ' + e.message + C.off);
    return;
  }

  // ── LO QUE VE CADA PERSONA ──────────────────────────────────────────────
  const personas = new Set();
  for (const v of viajes) if (v.pasajeroId) personas.add(v.pasajeroId);
  const deLado = (uid, lado) => viajes.filter((v) => v[lado] === uid);
  const topeDe = (archivo) => (consultas.find((c) => c.archivo === archivo) || {}).tope || null;

  console.log('  ' + C.neg + 'LO QUE VE CADA PASAJERO, DE LO SUYO (producción)' + C.off);
  console.log(C.gris + '    «terminados» = todos sus viajes que ya acabaron, sea como sea. «ve hoy» = lo que deja pasar el '
    + 'código de AHORA.' + C.off);
  console.log('    ' + pad('pasajero', 14) + pad('viajes', 8) + pad('terminados', 12)
    + pad('Home ve', 9) + pad('MisViajes ve', 14) + 'no salen (por estado)');
  const tot = { suyos: 0, term: 0, home: 0, mis: 0, misTerm: 0 };
  const escondidosPorEstado = {};
  const filas = [];
  for (const uid of personas) {
    const suyos = deLado(uid, 'pasajeroId');
    const term = suyos.filter((v) => ESTADOS_TERMINADOS.includes(v.estado));
    const home = lectura['guajirago/src/Home.js'];
    const mis = lectura['guajirago/src/MisViajes.js'];
    const veHome = home.entran ? term.filter((v) => home.entran.includes(v.estado)).length : NaN;
    // MisViajes junta los dos lados (sin repetir), así que su «terminados» es la unión.
    const union = new Map();
    for (const lado of PANTALLAS[1].lados) for (const v of deLado(uid, lado)) union.set(v.id, v);
    const termMis = [...union.values()].filter((v) => ESTADOS_TERMINADOS.includes(v.estado));
    const veMis = mis.entran ? termMis.filter((v) => mis.entran.includes(v.estado)).length : NaN;
    const fuera = {};
    for (const v of termMis) {
      if (mis.entran && !mis.entran.includes(v.estado)) {
        fuera[v.estado] = (fuera[v.estado] || 0) + 1;
        escondidosPorEstado[v.estado] = (escondidosPorEstado[v.estado] || 0) + 1;
      }
    }
    tot.suyos += suyos.length; tot.term += term.length; tot.home += veHome; tot.mis += veMis;
    tot.misTerm += termMis.length;
    filas.push({ uid, suyos: suyos.length, term: term.length, veHome, termMis: termMis.length, veMis, fuera });
  }
  filas.sort((a, b) => b.suyos - a.suyos);
  for (const f of filas) {
    const faltaH = f.term - f.veHome;
    const faltaM = f.termMis - f.veMis;
    console.log('    ' + pad(f.uid.slice(0, 12), 14) + pad(f.suyos, 8) + pad(f.term, 12)
      + (faltaH ? C.roj : C.ver) + pad(f.veHome + ' de ' + f.term, 9) + C.off
      + (faltaM ? C.roj : C.ver) + pad(f.veMis + ' de ' + f.termMis, 14) + C.off
      + (Object.keys(f.fuera).length ? C.roj + JSON.stringify(f.fuera) + C.off : C.gris + '—' + C.off));
  }
  console.log('');
  console.log('    ' + pad('pasajeros', 34) + filas.length);
  console.log('    ' + pad('viajes terminados (como pasajero)', 34) + tot.term);
  console.log('    ' + pad('los ve en Home', 34) + (tot.home === tot.term ? C.ver : C.roj) + tot.home + C.off);
  console.log('    ' + pad('terminados en MisViajes (2 lados)', 34) + tot.misTerm);
  console.log('    ' + pad('los ve en MisViajes', 34) + (tot.mis === tot.misTerm ? C.ver : C.roj) + tot.mis + C.off);
  if (Object.keys(escondidosPorEstado).length) {
    console.log('    ' + pad('escondidos, por estado', 34) + C.roj + JSON.stringify(escondidosPorEstado) + C.off);
  }
  const topeH = topeDe('guajirago/src/Home.js');
  const masAlto = Math.max(0, ...filas.map((f) => f.suyos));
  console.log('    ' + pad('el que más tiene', 34) + masAlto + (topeH ? ' (la consulta pide como mucho ' + topeH + ')' : ''));
  console.log('');
  if (tot.home === tot.term && tot.mis === tot.misTerm) {
    console.log(C.ver + '  ✓ cada persona ve todos sus viajes terminados en las dos pantallas.' + C.off);
  } else {
    console.log(C.roj + '  🔴 faltan ' + (tot.term - tot.home) + ' viajes en Home y ' + (tot.misTerm - tot.mis)
      + ' en MisViajes, sin error ni aviso.' + C.off);
  }
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
