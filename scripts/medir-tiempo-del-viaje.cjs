#!/usr/bin/env node
/**
 * LA FECHA DEL VIAJE Y EL CONTADOR m:ss — gemelo G95 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-tiempo-del-viaje.cjs            <- el código del disco
 *   node scripts/medir-tiempo-del-viaje.cjs --antes    <- y el careo con el código de antes (142a3ae)
 *   node scripts/medir-tiempo-del-viaje.cjs --nube     <- y con la fechaSolicitud de los viajes de PRODUCCIÓN (solo lee)
 *
 * Dos cosas estaban escritas a mano en la app de transporte:
 *   · LA FECHA DEL VIAJE («20 sept 2026») en los tres historiales: Home.js (el del pasajero), MisViajes.js y
 *     AppConductor.js (el del conductor). Las tres hacían `new Date(v.fechaSolicitud).toLocaleDateString('es-CO', …)`,
 *     o sea, el día en la ZONA HORARIA DEL TELÉFONO.
 *   · EL CONTADOR m:ss («1:05») en cuatro sitios: la cuenta atrás de la oferta del conductor (AppConductor.js), la del
 *     pasajero y el tiempo buscando conductor (Solicitar.js), y la duración de la llamada (Llamada.js).
 * Desde G95 las dos salen de guajirago/src/tiempoDelViaje.js: `fechaDelViaje` (el día EN COLOMBIA, armado con las
 * piezas que ya había: diaEnColombiaDe de fechaGuardada.js y fechaDeCalendario de fechaCalendario.js) y
 * `minutosSegundos`.
 *
 * Qué hace: saca cada sitio de su archivo y lo EJECUTA —la fecha con varias fechas de prueba y en varias zonas horarias
 * del teléfono (Colombia, Londres, Los Ángeles, Tokio); el contador con varios segundos— usando la pieza que el
 * archivo de verdad importa. El careo compara, sitio por sitio, lo que se pinta antes y ahora. No escribe nada.
 */
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { lector } = require('./medir-conexion-firebase.cjs');

const ANTES = { raiz: '142a3ae' }; // el último commit antes de G95
const PIEZA = 'guajirago/src/tiempoDelViaje.js';
const FECHAS = [
  { archivo: 'guajirago/src/Home.js', cuantos: 1 },
  { archivo: 'guajirago/src/MisViajes.js', cuantos: 1 },
  { archivo: 'guajirago/src/AppConductor.js', cuantos: 1 },
];
const CONTADORES = [
  { archivo: 'guajirago/src/AppConductor.js', cuantos: 1 },
  { archivo: 'guajirago/src/Solicitar.js', cuantos: 2 },
  { archivo: 'guajirago/src/Llamada.js', cuantos: 1 },
];
// Zonas horarias del TELÉFONO con que se pinta la fecha. La de Colombia es la de casi todos los clientes.
const ZONAS = ['America/Bogota', 'Europe/London', 'America/Los_Angeles', 'Asia/Tokyo'];
// Fechas de prueba: de día, de 7 p. m. a medianoche (en Londres ya es otro día), justo la medianoche, fin de año,
// un Timestamp de Firestore (el objeto que da la librería: con toMillis), vacías y una que no se puede leer.
const TS = (iso) => { const ms = Date.parse(iso); return { seconds: Math.floor(ms / 1000), nanoseconds: 0, toMillis: () => ms }; };
const FECHAS_DE_PRUEBA = [
  ['10 a. m. en Colombia', '2026-09-20T15:00:00.000Z'],
  ['7:00 p. m. en Colombia', '2026-09-21T00:00:00.000Z'],
  ['8:30 p. m. en Colombia', '2026-09-21T01:30:00.000Z'],
  ['11:59 p. m. en Colombia', '2026-09-21T04:59:59.000Z'],
  ['medianoche en Colombia', '2026-09-21T05:00:00.000Z'],
  ['00:30 en Colombia (en Los Ángeles aún es el día anterior)', '2026-09-21T05:30:00.000Z'],
  ['31-dic 10 p. m. en Colombia', '2027-01-01T03:00:00.000Z'],
  ['Timestamp de Firestore, 9 p. m. en Colombia', TS('2026-09-21T02:00:00.000Z')],
  ['sin fecha (vacía)', ''],
  ['sin fecha (no está)', undefined],
  ['texto que no es fecha', 'ayer'],
];
const SEGUNDOS_DE_PRUEBA = [0, 1, 9, 10, 59, 60, 61, 65, 119, 120, 599, 600, 3599, 3600, 7325];

function argumento(nombre) { return process.argv.includes(nombre); }
const sinCR = (t) => t.replace(/\r\n/g, '\n');
const renglonDe = (t, i) => t.slice(0, i).split('\n').length;

/** Carga la pieza (con las dos piezas de fecha que importa) del texto dado; null si no está o no carga. */
function cargarPieza(texto, problemas) {
  if (texto == null) return null;
  try { return cargarDeLaApp(PIEZA, texto); } catch (e) { problemas.push(PIEZA + ' no carga: ' + e.message); return null; }
}

/** ¿El archivo importa `nombre` de la pieza? Solo así se le pasa la pieza de verdad al ejecutar su sitio. */
function importaDeLaPieza(t, nombre) {
  return new RegExp("^import \\{[^}]*\\b" + nombre + "\\b[^}]*\\} from '\\./tiempoDelViaje';", 'm').test(t);
}

/** Los renglones `const fecha = …;` de un archivo: la expresión que pinta la fecha de cada viaje. */
function fechasEn(t) {
  return [...t.matchAll(/^[ \t]*const fecha = (.+);[ \t]*$/gm)].map((m) => ({ expr: m[1], renglon: renglonDe(t, m.index) }));
}

/**
 * Los contadores de un archivo: lo que va dentro de un elemento con números de ancho fijo (`tabular-nums`) y que cuenta
 * en minutos (divide entre 60, o usa la pieza, o la formatDuracion de Llamada). El de la sanción (`{contadorSancion}`,
 * horas:minutos:segundos) NO es de este gemelo y no entra.
 */
function contadoresEn(t) {
  const out = [];
  for (const m of t.matchAll(/tabular-nums'[^}]*\}\}>([^<]*)</g)) {
    const hijos = m[1];
    if (!/\/ *60\b|minutosSegundos|formatDuracion/.test(hijos)) continue;
    out.push({ hijos, renglon: renglonDe(t, m.index) });
  }
  return out;
}

/** La ayudante local de Llamada, si el archivo la tiene: `const formatDuracion = (s) => …;`. */
function ayudanteLocal(t) {
  const m = /^[ \t]*const formatDuracion = (.+);[ \t]*$/m.exec(t);
  return m ? m[1] : null;
}

/** Ejecuta la expresión de la fecha con un viaje y la zona horaria del teléfono dada. */
function pintarFecha(expr, fechaDelViaje, fechaSolicitud, zona) {
  const antes = process.env.TZ;
  process.env.TZ = zona;
  try {
    // eslint-disable-next-line no-new-func
    return String(new Function('fechaDelViaje', 'v', 'return (' + expr + ');')(fechaDelViaje, { fechaSolicitud }));
  } catch (e) { return 'ERROR: ' + e.message; } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

/** Ejecuta los hijos JSX de un contador (`{a}:{b}` → texto) con un número de segundos. */
function pintarContador(hijos, minutosSegundos, formatDuracion, segundos) {
  const libres = [...new Set([...hijos.matchAll(/\b([a-z][A-Za-z]*)\b/g)].map((m) => m[1]))]
    .filter((n) => !['minutosSegundos', 'formatDuracion', 'padStart'].includes(n));
  const plantilla = '`' + hijos.replace(/\{/g, '${') + '`';
  try {
    // eslint-disable-next-line no-new-func
    const fd = formatDuracion ? new Function('minutosSegundos', 'return (' + formatDuracion + ');')(minutosSegundos) : null;
    // eslint-disable-next-line no-new-func
    return new Function('minutosSegundos', 'formatDuracion', ...libres, 'return ' + plantilla + ';')(minutosSegundos, fd, ...libres.map(() => segundos));
  } catch (e) { return 'ERROR: ' + e.message; }
}

/** Los .js de la app de transporte (sin la pieza): donde se busca lo escrito a mano. */
function archivosDeLaApp() {
  return fs.readdirSync(path.join(RAIZ, 'guajirago/src')).filter((f) => f.endsWith('.js')).map((f) => 'guajirago/src/' + f);
}
// Escrito A MANO: una fecha del viaje pasada por toLocale…, o un m:ss armado dividiendo entre 60 y sacando el resto.
const FECHA_A_MANO = /new Date\([^()]*fechaSolicitud[^()]*\)\.toLocale\w*\(/g;
const CONTADOR_A_MANO = /Math\.floor\(\s*[\w.]+\s*\/\s*60\s*\)[^\n]*%\s*60\b/g;

/**
 * Mide un estado del código. `commits` = null (el disco) o { raiz }; `cambios` pisa archivos (pantallas de mentira
 * para la prueba). `fechas` = [[nombre, valor]] y `segundos` = [n] con que se ejecuta cada sitio.
 */
function medir(commits, { fechas = FECHAS_DE_PRUEBA, segundos = SEGUNDOS_DE_PRUEBA, cambios = {} } = {}) {
  const base = lector(commits || {});
  const leer = (r) => (Object.prototype.hasOwnProperty.call(cambios, r) ? cambios[r] : base(r));
  const problemas = [];
  const pieza = cargarPieza(leer(PIEZA), problemas) || {};

  // 1 · Lo escrito a mano en la app de transporte (fuera de la pieza).
  const aMano = [];
  for (const r of archivosDeLaApp()) {
    if (r === PIEZA) continue;
    const t0 = leer(r);
    if (t0 == null) continue;
    const t = sinCR(t0);
    for (const m of t.matchAll(FECHA_A_MANO)) aMano.push({ archivo: r, renglon: renglonDe(t, m.index), que: 'fecha' });
    for (const m of t.matchAll(CONTADOR_A_MANO)) aMano.push({ archivo: r, renglon: renglonDe(t, m.index), que: 'contador' });
  }

  // 2 · Cada fecha, EJECUTADA con cada fecha de prueba en cada zona del teléfono.
  const sitiosFecha = [];
  for (const s of FECHAS) {
    const t0 = leer(s.archivo);
    if (t0 == null) { problemas.push('no está ' + s.archivo); continue; }
    const t = sinCR(t0);
    const encontrados = fechasEn(t);
    if (encontrados.length !== s.cuantos) problemas.push(s.archivo + ': esperaba ' + s.cuantos + ' fecha(s) del viaje y hay ' + encontrados.length);
    const usa = /\bfechaDelViaje\(/;
    const importa = importaDeLaPieza(t, 'fechaDelViaje');
    encontrados.forEach((f, k) => {
      if (usa.test(f.expr) && !importa) problemas.push(s.archivo + ': usa fechaDelViaje sin importarla de ./tiempoDelViaje');
      const fn = importa && typeof pieza.fechaDelViaje === 'function' ? pieza.fechaDelViaje : () => 'SIN PIEZA';
      sitiosFecha.push({
        archivo: s.archivo, orden: k + 1, renglon: f.renglon, expr: f.expr, forma: usa.test(f.expr) ? 'pieza' : 'a mano',
        pinta: fechas.map(([, valor]) => ZONAS.map((z) => pintarFecha(f.expr, fn, valor, z))),
      });
    });
  }

  // 3 · Cada contador, EJECUTADO con cada número de segundos.
  const sitiosContador = [];
  for (const s of CONTADORES) {
    const t0 = leer(s.archivo);
    if (t0 == null) { problemas.push('no está ' + s.archivo); continue; }
    const t = sinCR(t0);
    const encontrados = contadoresEn(t);
    if (encontrados.length !== s.cuantos) problemas.push(s.archivo + ': esperaba ' + s.cuantos + ' contador(es) y hay ' + encontrados.length);
    const importa = importaDeLaPieza(t, 'minutosSegundos');
    const fd = ayudanteLocal(t);
    encontrados.forEach((c, k) => {
      if (/minutosSegundos/.test(c.hijos) && !importa) problemas.push(s.archivo + ': usa minutosSegundos sin importarla de ./tiempoDelViaje');
      const fn = importa && typeof pieza.minutosSegundos === 'function' ? pieza.minutosSegundos : () => 'SIN PIEZA';
      sitiosContador.push({
        archivo: s.archivo, orden: k + 1, renglon: c.renglon, hijos: c.hijos.trim(),
        forma: /minutosSegundos/.test(c.hijos) ? 'pieza' : 'a mano',
        pinta: segundos.map((n) => pintarContador(c.hijos, fn, fd, n)),
      });
    });
  }

  // 4 · ¿Los sitios dicen lo MISMO entre sí? (la misma fecha en la misma zona; el mismo contador con los mismos segundos)
  const fechasDistintas = [];
  fechas.forEach(([nombre], i) => ZONAS.forEach((z, j) => {
    if (new Set(sitiosFecha.map((s) => s.pinta[i][j])).size > 1) fechasDistintas.push(nombre + ' · ' + z);
  }));
  const contadoresDistintos = segundos.filter((n, i) => new Set(sitiosContador.map((s) => s.pinta[i])).size > 1);
  // 5 · ¿La fecha es la de COLOMBIA en cualquier zona del teléfono? (misma fecha en las cuatro zonas)
  const dependeDelTelefono = [];
  for (const s of sitiosFecha) {
    fechas.forEach(([nombre], i) => {
      if (new Set(s.pinta[i]).size > 1) dependeDelTelefono.push({ sitio: s.archivo, fecha: nombre, pinta: Object.fromEntries(ZONAS.map((z, j) => [z, s.pinta[i][j]])) });
    });
  }

  return { commits: commits || 'el disco', problemas, aMano, sitiosFecha, sitiosContador, fechas, segundos, fechasDistintas, contadoresDistintos, dependeDelTelefono };
}

/** Careo: lo que se pinta en cada sitio (por archivo y en orden), antes y ahora. */
function carear(antes, ahora) {
  const diferencias = [];
  let comparados = 0;
  const mapa = (lista) => Object.fromEntries(lista.map((s) => [s.archivo + ' #' + s.orden, s]));
  for (const [tipo, a, b] of [['fecha', mapa(antes.sitiosFecha), mapa(ahora.sitiosFecha)], ['contador', mapa(antes.sitiosContador), mapa(ahora.sitiosContador)]]) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!a[k] || !b[k]) { diferencias.push({ tipo, sitio: k, que: a[k] ? 'desapareció' : 'es nuevo' }); continue; }
      if (tipo === 'fecha') {
        antes.fechas.forEach(([nombre], i) => ZONAS.forEach((z, j) => {
          comparados += 1;
          if (a[k].pinta[i][j] !== b[k].pinta[i][j]) diferencias.push({ tipo, sitio: k, fecha: nombre, zona: z, antes: a[k].pinta[i][j], ahora: b[k].pinta[i][j] });
        }));
      } else {
        antes.segundos.forEach((n, i) => {
          comparados += 1;
          if (a[k].pinta[i] !== b[k].pinta[i]) diferencias.push({ tipo, sitio: k, segundos: n, antes: a[k].pinta[i], ahora: b[k].pinta[i] });
        });
      }
    }
  }
  return { comparados, diferencias };
}

/** El veredicto: todo sale de la pieza, nada a mano, todos dicen lo mismo y la fecha es la de Colombia. */
function todoBien(m) {
  return m.problemas.length === 0 && m.aMano.length === 0 && m.fechasDistintas.length === 0 && m.contadoresDistintos.length === 0
    && m.dependeDelTelefono.length === 0 && m.sitiosFecha.length === 3 && m.sitiosContador.length === 4
    && [...m.sitiosFecha, ...m.sitiosContador].every((s) => s.forma === 'pieza');
}

module.exports = {
  medir, carear, todoBien, fechasEn, contadoresEn, pintarFecha, pintarContador,
  ANTES, PIEZA, FECHAS, CONTADORES, ZONAS, FECHAS_DE_PRUEBA, SEGUNDOS_DE_PRUEBA, TS,
};

if (require.main === module) {
  (async () => {
    let fechas = FECHAS_DE_PRUEBA;
    if (argumento('--nube')) {
      const { traer } = require('./nube.cjs');
      const viajes = await traer('viajes');
      const tipos = {};
      fechas = viajes.map((d) => {
        const c = (d.fields || {}).fechaSolicitud;
        const tipo = c ? Object.keys(c)[0] : '(no está)';
        tipos[tipo] = (tipos[tipo] || 0) + 1;
        const valor = !c ? undefined : 'stringValue' in c ? c.stringValue : 'timestampValue' in c ? TS(c.timestampValue) : null;
        return [(d.name || '').split('/').pop(), valor];
      });
      console.log('\n☁️  PRODUCCIÓN: ' + viajes.length + ' viajes leídos (solo fechaSolicitud) · tipos: ' + JSON.stringify(tipos));
      const horaCol = (v) => (typeof v === 'string' && Date.parse(v) ? new Date(Date.parse(v) - 5 * 3600000).getUTCHours() : null);
      const deNoche = fechas.filter(([, v]) => { const h = horaCol(v); return h !== null && h >= 19; }).length;
      console.log('   de ellos, pedidos entre las 7 p. m. y la medianoche de Colombia (en Londres ya es otro día): ' + deNoche);
    }
    const pintar = (titulo, m) => {
      console.log('\n── ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : m.commits.raiz) + ')');
      console.log('   Escrito A MANO en la app de transporte: ' + m.aMano.length);
      for (const l of m.aMano) console.log('     · ' + l.archivo + ':' + l.renglon + '  (' + l.que + ')');
      for (const s of m.sitiosFecha) console.log('   fecha    ' + (s.archivo.replace('guajirago/src/', '') + ':' + s.renglon).padEnd(22) + s.forma.padEnd(7) + ' ' + s.expr.slice(0, 90));
      for (const s of m.sitiosContador) console.log('   contador ' + (s.archivo.replace('guajirago/src/', '') + ':' + s.renglon).padEnd(22) + s.forma.padEnd(7) + ' ' + s.hijos.slice(0, 90));
      console.log('   fechas en que un sitio pinta distinto de otro: ' + m.fechasDistintas.length + ' · contadores distintos: ' + m.contadoresDistintos.length);
      console.log('   fechas que cambian según la ZONA del teléfono: ' + m.dependeDelTelefono.length + ' (sitio × fecha)');
      for (const d of m.dependeDelTelefono.slice(0, 6)) console.log('     · ' + d.sitio.replace('guajirago/src/', '') + ' · ' + d.fecha + ' → ' + JSON.stringify(d.pinta));
      if (m.problemas.length) console.log('   ⚠ ' + m.problemas.join('\n   ⚠ '));
    };

    const ahora = medir(null, { fechas });
    console.log('\n=== LA FECHA DEL VIAJE Y EL CONTADOR m:ss · G95 · SOLO LECTURA · ' + new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }) + ' ===');
    pintar('AHORA', ahora);
    if (ahora.sitiosFecha[0]) {
      console.log('   ejemplo (Home, teléfono en Colombia / en Londres):');
      fechas.slice(0, 8).forEach(([nombre], i) => console.log('     ' + String(nombre).padEnd(40) + ' → ' + ahora.sitiosFecha[0].pinta[i][0] + ' / ' + ahora.sitiosFecha[0].pinta[i][1]));
    }

    if (argumento('--antes')) {
      const antes = medir(ANTES, { fechas });
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      const enColombia = c.diferencias.filter((d) => d.zona === 'America/Bogota' || d.tipo === 'contador');
      console.log('\n── CAREO: ' + c.comparados + ' cosas pintadas comparadas · diferencias: ' + c.diferencias.length
        + ' (con el teléfono en Colombia o en los contadores: ' + enColombia.length + ')');
      for (const d of c.diferencias.slice(0, 40)) console.log('   · ' + JSON.stringify(d));
      if (c.diferencias.length > 40) console.log('   … y ' + (c.diferencias.length - 40) + ' más');
    }

    console.log('\n' + (todoBien(ahora) ? '✓ la fecha del viaje (en Colombia) y el contador m:ss salen de UNA pieza en los ' + (ahora.sitiosFecha.length + ahora.sitiosContador.length) + ' sitios'
      : '✗ la fecha del viaje o el contador m:ss NO salen de una sola pieza'));
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
