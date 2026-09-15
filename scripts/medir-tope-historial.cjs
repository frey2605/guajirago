/**
 * EL TOPE DEL HISTORIAL — ¿a quién le faltan viajes, y por qué lado?
 *
 *   node scripts/medir-tope-historial.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * `HistorialConductor` pide los viajes del conductor con un `limit(N)` **y sin
 * decir por cuál empezar**. Eso tiene dos consecuencias, y la segunda es la que
 * muerde:
 *
 *   1 · Cuando un conductor pasa de N, el servidor manda N cualesquiera. No los
 *       últimos: los que le salgan. El orden por fecha se hace DESPUÉS, en el
 *       teléfono, ya con la lista recortada — o sea que ordena bien una lista a
 *       la que ya le faltan viajes.
 *   2 · Y no avisa. Igual que la lista de estados que se arregló el 13-sep-2026:
 *       no da error, no sale en rojo, simplemente no están.
 *
 * ── QUÉ MIDE, Y POR QUÉ ESTAS TRES COSAS ────────────────────────────────────
 * A · CUÁNTOS viajes tiene cada conductor contra el tope que pide la pantalla.
 *     El tope se LEE DEL ARCHIVO (no se copia aquí), igual que en
 *     `medir-historial-conductor.cjs`.
 *
 * B · SI EXISTE EL ÍNDICE que haría falta para ordenar en el servidor. Firestore
 *     necesita un índice compuesto para `where(conductorId) + orderBy(fecha)`, y
 *     si no está, la consulta **falla en la cara del conductor**. En este repo no
 *     hay `firestore.indexes.json`, así que se le pregunta al servidor.
 *
 * C · 🔴 SI LA FECHA POR LA QUE SE ORDENARÍA ES DE FIAR.
 *     `fechaSolicitud` la escribe **el reloj del celular del cliente** (deuda ya
 *     anotada: 79 sitios con `new Date().toISOString()`). Ordenar por ella es
 *     ordenar por un reloj ajeno. Pero Firestore guarda su PROPIA hora de
 *     creación (`createTime`), que sí es del servidor y no se puede tocar: así
 *     que se pueden comparar las dos y ver cuánto se desvía cada una. Si la
 *     desviación es grande, ordenar por `fechaSolicitud` mete viajes en el sitio
 *     equivocado — y con un tope, los mete FUERA.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/AppConductor.js';

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';
const ADMIN = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/collectionGroups/viajes/indexes';

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};
const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length));

/**
 * El tope que pide la pantalla, LEÍDO DEL ARCHIVO.
 *
 * No se copia aquí el 50: si mañana alguien lo cambia, este guion mide el nuevo.
 * Es la misma razón por la que `medir-historial-conductor.cjs` lee el filtro en
 * vez de fiarse del nombre.
 */
function elTopeDeLaPantalla() {
  const { soloCodigo, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');
  const archivo = soloCodigo(fs.readFileSync(path.join(RAIZ, PANTALLA), 'utf8'));
  const arranca = archivo.indexOf('function HistorialConductor');
  if (arranca < 0) return { tope: null, ordena: null };
  const fn = cuerpoDeLaFuncion(archivo, arranca);
  if (!fn) return { tope: null, ordena: null };
  const t = fn.texto;
  const lim = /\blimit\(\s*(\d+)\s*\)/.exec(t);
  // ¿Le dice al SERVIDOR por cuál empezar, o solo ordena después en el teléfono?
  //
  // 🔴 LA DIRECCIÓN TAMBIÉN, y no es un detalle: en Firestore un índice
  // `fechaSolicitud DESCENDING` **no sirve** para un `orderBy(..., 'asc')`.
  // Aquí no hay lectura al revés — se comprobó preguntándole al servidor con las
  // dos: pide dos índices distintos. Sin leer la dirección, cambiar `'desc'` por
  // `'asc'` dejaba al conductor el historial **EN BLANCO** con todo en verde.
  // Lo midió la segunda opinión.
  const enElServidor = /\borderBy\(\s*['"]([^'"]+)['"]\s*(?:,\s*['"](\w+)['"])?/.exec(t);
  const enElTelefono = /\.sort\(/.test(t);
  return {
    tope: lim ? Number(lim[1]) : null,
    ordena: enElServidor ? enElServidor[1] : null,
    // Firestore ordena ascendente si no se dice nada.
    direccion: enElServidor ? ((enElServidor[2] || 'asc').toLowerCase() === 'desc'
      ? 'DESCENDING' : 'ASCENDING') : null,
    ordenaDespues: enElTelefono,
  };
}

/**
 * TODAS las consultas con tope de la app del cliente, y si dicen por dónde
 * empezar.
 *
 * 🔴 ESTO LO IMPORTA EL AMARRE. No se copia allí (SEGUNDA LEY): el recorrido de
 * los `catch` ya se escribió dos veces y se separó el mismo día.
 *
 * Una consulta con `limit(N)` y sin `orderBy` no es «casi correcta»: es el
 * servidor eligiendo qué se ve. Con pocos registros no se nota, y el día que se
 * note no habrá aviso — el mismo silencio de la lista de estados.
 */
const PENDIENTES = [
  // [archivo, cuántas consultas con tope y sin orden, por qué siguen así]
  ['guajirago/src/Home.js', 1,
    'el historial del pasajero. Ya está anotado en CLAUDE.md por OTRO fallo (la lista de '
    + 'estados corta), y los dos se arreglan juntos cuando le toque: es el mismo archivo y '
    + 'la misma consulta. No estaba en la foto del 15-sep-2026 (PRIMERA LEY).'],
  ['guajirago/src/MisViajes.js', 2,
    'las dos consultas de «Mis viajes» —la del pasajero y la del conductor—. Mismo caso que '
    + 'Home.js: anotado, con su fallo hermano, y fuera de la foto.'],
];

function lasConsultasConTope() {
  const { soloCodigo } = require('../pruebas/cargar.cjs');
  const CARPETA = path.join(RAIZ, 'guajirago', 'src');
  const salida = [];
  for (const nombre of fs.readdirSync(CARPETA).filter((n) => n.endsWith('.js')).sort()) {
    const rel = 'guajirago/src/' + nombre;
    const texto = soloCodigo(fs.readFileSync(path.join(CARPETA, nombre), 'utf8'));
    let desde = 0;
    for (;;) {
      const i = texto.indexOf('query(', desde);
      if (i < 0) break;
      desde = i + 6;
      // El argumento entero, contando paréntesis: una consulta puede ocupar
      // varios renglones (y desde el 15-sep-2026 la del conductor los ocupa).
      let hondo = 0;
      let fin = -1;
      for (let j = i + 5; j < texto.length; j += 1) {
        if (texto[j] === '(') hondo += 1;
        else if (texto[j] === ')') { hondo -= 1; if (hondo === 0) { fin = j; break; } }
      }
      if (fin < 0) continue;
      const dentro = texto.slice(i + 6, fin);
      if (!/\blimit\(/.test(dentro)) continue;
      salida.push({
        archivo: rel,
        tope: Number((/\blimit\(\s*(\d+)\s*\)/.exec(dentro) || [])[1]) || null,
        ordena: (/\borderBy\(\s*['"]([^'"]+)['"]/.exec(dentro) || [])[1] || null,
        colecciona: (/collection\(\s*\w+\s*,\s*['"]([^'"]+)['"]/.exec(dentro) || [])[1] || '?',
        renglon: texto.slice(0, i).split('\n').length,
      });
      desde = fin;
    }
  }
  return { consultas: salida, PENDIENTES };
}

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 160));
  return x.access_token;
}

async function traer(sesion, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + sesion } });
    if (!r.ok) throw new Error('no pude leer ' + coleccion + ': ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

const val = (v) => (v == null ? undefined : v.stringValue);

module.exports = { elTopeDeLaPantalla, lasConsultasConTope, PENDIENTES };
if (require.main !== module) return;

(async () => {
  const p = elTopeDeLaPantalla();
  console.log('');
  console.log(C.neg + '  EL TOPE DEL HISTORIAL DEL CONDUCTOR' + C.off);
  console.log(C.gris + '  ' + PANTALLA + C.off);
  console.log('');
  console.log('  ' + C.neg + 'LO QUE PIDE LA PANTALLA HOY' + C.off);
  console.log('    ' + pad('como mucho', 28)
    + (p.tope ? p.tope + ' viajes' : C.ver + 'sin tope' + C.off));
  console.log('    ' + pad('le dice al servidor', 28)
    + (p.ordena ? 'por cuál empezar: ' + p.ordena
      : C.roj + 'NADA — el servidor elige cuáles manda' + C.off));
  console.log('    ' + pad('ordena en el teléfono', 28)
    + (p.ordenaDespues ? 'sí, DESPUÉS de recortar' : 'no'));

  // ── TODAS LAS CONSULTAS CON TOPE DE LA APP DEL CLIENTE ──────────────────
  console.log('');
  console.log('  ' + C.neg + 'TODAS LAS CONSULTAS CON TOPE, EN LA APP DEL CLIENTE' + C.off);
  const { consultas } = lasConsultasConTope();
  const pendientesPor = {};
  for (const [a, n] of PENDIENTES) pendientesPor[a] = n;
  let sinOrden = 0;
  let sinOrdenNiPerdon = 0;
  for (const c of consultas) {
    const perdonadas = pendientesPor[c.archivo] || 0;
    const perdonada = !c.ordena && perdonadas > 0;
    if (perdonada) pendientesPor[c.archivo] -= 1;
    if (!c.ordena) sinOrden += 1;
    if (!c.ordena && !perdonada) sinOrdenNiPerdon += 1;
    console.log('    ' + (c.ordena ? C.ver + '✓' : (perdonada ? C.ama + '·' : C.roj + '✗')) + C.off
      + ' ' + pad(c.archivo.replace('guajirago/src/', '') + ':' + c.renglon, 24)
      + pad(c.colecciona, 12) + pad('tope ' + c.tope, 10)
      + (c.ordena ? C.gris + 'ordena por ' + c.ordena + C.off
        : (perdonada ? C.ama + 'sin orden — ANOTADA, se arregla aparte' + C.off
          : C.roj + 'SIN ORDEN: el servidor elige qué se ve' + C.off)));
  }
  if (sinOrden === 0) {
    console.log(C.ver + '    todas dicen por dónde empezar.' + C.off);
  }

  let sesion;
  try {
    sesion = await token();
  } catch (e) {
    console.log('');
    console.log(C.ama + '    ⚠ sin sesión de firebase: ' + e.message + C.off);
    return;
  }

  // ── B · ¿EXISTE EL ÍNDICE QUE HARÍA FALTA? ──────────────────────────────
  console.log('');
  console.log('  ' + C.neg + 'LOS ÍNDICES QUE HAY PUESTOS EN EL SERVIDOR' + C.off);
  let indices = [];
  try {
    const r = await fetch(ADMIN, { headers: { Authorization: 'Bearer ' + sesion } });
    const j = await r.json();
    indices = (j.indexes || []).map((i) => (i.fields || [])
      .map((f) => f.fieldPath + (f.order === 'DESCENDING' ? '↓' : '↑')).join(' + '));
  } catch (e) {
    console.log(C.ama + '    ⚠ no pude preguntarle por los índices: ' + e.message + C.off);
  }
  if (!indices.length) console.log(C.gris + '    (ninguno propio: solo los automáticos de un campo)' + C.off);
  for (const i of indices) console.log('    · ' + i);

  // ── A · CUÁNTOS TIENE CADA UNO ──────────────────────────────────────────
  const viajes = await traer(sesion, 'viajes');
  const mios = viajes.filter((v) => val((v.fields || {}).conductorId));

  const porConductor = {};
  for (const v of mios) {
    const c = val((v.fields || {}).conductorId);
    (porConductor[c] = porConductor[c] || []).push(v);
  }

  console.log('');
  console.log('  ' + C.neg + 'CUÁNTOS VIAJES TIENE CADA CONDUCTOR' + C.off);
  console.log('    ' + pad('conductor', 14) + pad('suyos', 8) + pad('del tope', 12)
    + 'le faltan');
  let pasados = 0;
  let faltanPorTope = 0;
  for (const [c, lista] of Object.entries(porConductor).sort((a, b) => b[1].length - a[1].length)) {
    const cuantos = lista.length;
    const pierde = p.tope && cuantos > p.tope ? cuantos - p.tope : 0;
    if (pierde) { pasados += 1; faltanPorTope += pierde; }
    const cerca = p.tope && cuantos > p.tope * 0.9;
    console.log('    ' + pad(c.slice(0, 12), 14) + pad(cuantos, 8)
      + (pierde ? C.roj : (cerca ? C.ama : C.gris))
      + pad(p.tope ? Math.round((cuantos / p.tope) * 100) + '%' : '—', 12) + C.off
      + (pierde ? C.roj + pierde + C.off : C.ver + '0' + C.off));
  }

  // ── C · 🔴 ¿ES DE FIAR LA FECHA POR LA QUE SE ORDENARÍA? ─────────────────
  //  Se compara `fechaSolicitud` (la escribe el celular del CLIENTE) con
  //  `createTime` (la pone el servidor y no se puede tocar).
  console.log('');
  console.log('  ' + C.neg + 'LA FECHA POR LA QUE HABRÍA QUE ORDENAR' + C.off);
  console.log(C.gris + '    `fechaSolicitud` la escribe el celular del cliente; `createTime` la '
    + 'pone el servidor.' + C.off);
  let sinFecha = 0;
  let ilegible = 0;
  const desvios = [];
  let peor = null;
  for (const v of mios) {
    const f = val((v.fields || {}).fechaSolicitud);
    if (!f) { sinFecha += 1; continue; }
    const suya = Date.parse(f);
    const delServidor = Date.parse(v.createTime);
    if (!Number.isFinite(suya) || !Number.isFinite(delServidor)) { ilegible += 1; continue; }
    const min = Math.round((suya - delServidor) / 60000);
    desvios.push(min);
    if (!peor || Math.abs(min) > Math.abs(peor.min)) peor = { min, id: (v.name || '').split('/').pop() };
  }
  const fuera = (n) => desvios.filter((d) => Math.abs(d) > n).length;
  console.log('    ' + pad('viajes con fecha', 28) + desvios.length + ' de ' + mios.length
    + (sinFecha ? C.roj + '   (' + sinFecha + ' SIN fecha)' + C.off : '')
    + (ilegible ? C.roj + '   (' + ilegible + ' ilegible)' + C.off : ''));
  console.log('    ' + pad('se desvían más de 1 minuto', 28)
    + (fuera(1) ? C.ama + fuera(1) + C.off : C.ver + '0' + C.off));
  console.log('    ' + pad('se desvían más de 1 hora', 28)
    + (fuera(60) ? C.roj + fuera(60) + C.off : C.ver + '0' + C.off));
  console.log('    ' + pad('se desvían más de 1 día', 28)
    + (fuera(1440) ? C.roj + fuera(1440) + C.off : C.ver + '0' + C.off));
  if (peor) {
    const h = Math.round((peor.min / 60) * 10) / 10;
    console.log('    ' + pad('el más torcido', 28) + peor.id + ': ' + (peor.min > 0 ? '+' : '')
      + peor.min + ' min (' + (h > 0 ? '+' : '') + h + ' h)');
  }
  // ¿Ordenar por la fecha del celular daría un orden distinto al del servidor?
  const conLos2 = mios.filter((v) => val((v.fields || {}).fechaSolicitud));
  const porSuya = [...conLos2].sort((a, b) => String(val(b.fields.fechaSolicitud))
    .localeCompare(String(val(a.fields.fechaSolicitud))));
  const porServidor = [...conLos2].sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)));
  let distintos = 0;
  for (let i = 0; i < porSuya.length; i += 1) if (porSuya[i].name !== porServidor[i].name) distintos += 1;
  console.log('    ' + pad('puestos que cambian', 28)
    + (distintos ? C.roj + distintos + ' de ' + conLos2.length + C.off
      : C.ver + '0 — los dos órdenes coinciden' + C.off));

  // ── D · 🔴 SE LE PREGUNTA AL SERVIDOR DE VERDAD ─────────────────────────
  //  No se supone si el índice sirve: se corre la consulta. Firestore contesta
  //  con el enlace para crear el índice cuando le falta, y eso es un dato, no
  //  una opinión. Es de solo lectura: `runQuery` no escribe nada.
  console.log('');
  console.log('  ' + C.neg + 'LA CONSULTA QUE HARÍA FALTA, PROBADA CONTRA EL SERVIDOR' + C.off);
  const elMasCargado = Object.entries(porConductor)
    .sort((a, b) => b[1].length - a[1].length)[0];
  const quien = elMasCargado ? elMasCargado[0] : null;

  const preguntar = async (cuerpo) => {
    const r = await fetch(BASE + ':runQuery', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + sesion, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const j = await r.json();
    // El error de `runQuery` llega de dos formas: como objeto, o dentro de un
    // array. Leyendo solo la primera salía «HTTP 400» a secas y se perdía el
    // mensaje, que es justo donde Firestore pone el enlace para crear el índice.
    const suyo = Array.isArray(j) ? (j.find((x) => x && x.error) || {}).error : j.error;
    if (!r.ok || suyo) return { fallo: (suyo || {}).message || ('HTTP ' + r.status) };
    return { filas: (Array.isArray(j) ? j : []).filter((x) => x.document) };
  };

  const conFiltro = (orden) => ({
    structuredQuery: {
      from: [{ collectionId: 'viajes' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'conductorId' }, op: 'EQUAL', value: { stringValue: quien },
        },
      },
      ...(orden ? { orderBy: [{ field: { fieldPath: 'fechaSolicitud' }, direction: orden }] } : {}),
      limit: p.tope || 50,
    },
  });

  if (!quien) {
    console.log(C.gris + '    (no hay conductores con viajes)' + C.off);
  } else {
    console.log(C.gris + '    se prueba con ' + quien.slice(0, 12) + ', que es el que más tiene ('
      + elMasCargado[1].length + ')' + C.off);
    const ahora = await preguntar(conFiltro(null));
    console.log('    ' + pad('como está hoy (sin orden)', 30)
      + (ahora.fallo ? C.roj + ahora.fallo.slice(0, 60) + C.off
        : C.ver + 'funciona' + C.off + C.gris + ' — devuelve ' + ahora.filas.length + C.off));
    const ordenada = await preguntar(conFiltro('DESCENDING'));
    if (ordenada.fallo) {
      console.log('    ' + pad('pidiendo los ÚLTIMOS por fecha', 30) + C.roj + 'NO SE PUEDE HOY'
        + C.off);
      console.log(C.roj + '      ' + ordenada.fallo.slice(0, 300) + C.off);
      console.log(C.ama + '      → hace falta CREAR UN ÍNDICE (conductorId + fechaSolicitud). '
        + 'Se crea una vez, en el servidor,' + C.off);
      console.log(C.ama + '        y hasta que esté la consulta falla EN LA CARA DEL CONDUCTOR: '
        + 'primero el índice, después la app.' + C.off);
    } else {
      console.log('    ' + pad('pidiendo los ÚLTIMOS por fecha', 30) + C.ver + 'ya funciona'
        + C.off + C.gris + ' — devuelve ' + ordenada.filas.length + C.off);
    }

    // ¿Y qué se pierde HOY? Los que manda el servidor sin orden, contra los que
    // de verdad son los últimos.
    if (!ahora.fallo && elMasCargado[1].length > (p.tope || 50)) {
      const mandados = new Set(ahora.filas.map((f) => f.document.name));
      const ultimos = [...elMasCargado[1]]
        .sort((a, b) => String(val(b.fields.fechaSolicitud) || '')
          .localeCompare(String(val(a.fields.fechaSolicitud) || '')))
        .slice(0, p.tope || 50);
      const perdidos = ultimos.filter((v) => !mandados.has(v.name)).length;
      console.log('    ' + pad('de sus últimos ' + (p.tope || 50), 30)
        + (perdidos ? C.roj + 'el servidor NO manda ' + perdidos + C.off
          : C.ver + 'hoy coinciden' + C.off));
    }
  }

  console.log('');
  if (!p.tope) {
    console.log(C.ver + '  ✓ la pantalla ya no tiene tope: ningún conductor pierde viajes por ahí.'
      + C.off);
  } else if (pasados > 0) {
    console.log(C.roj + '  🔴 ' + pasados + ' conductor(es) ya pasan de ' + p.tope + ': se pierden '
      + faltanPorTope + ' viajes, y el servidor elige cuáles.' + C.off);
  } else {
    const masAlto = Math.max(...Object.values(porConductor).map((l) => l.length));
    console.log(C.ama + '  ⚠ todavía nadie pasa de ' + p.tope + ' (el que más va por ' + masAlto
      + '), pero llega solo: cuando pase,' + C.off);
    console.log(C.ama + '    el servidor elegirá cuáles manda y no avisará nadie.' + C.off);
  }
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
