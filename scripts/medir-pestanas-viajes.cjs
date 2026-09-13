/**
 * LAS PESTAÑAS DEL PANEL DE VIAJES — ¿cabe cada viaje en alguna?
 *
 *   node scripts/medir-pestanas-viajes.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El panel tiene tres pestañas —en curso, completados, cancelados— y cada una
 * con su filtro escrito a mano. Un viaje cuyo estado no esté en ninguno de los
 * tres NO APARECE EN NINGÚN SITIO: no da error, no sale en rojo, simplemente no
 * está. Nadie echa de menos lo que nunca vio.
 *
 * Es el mismo fallo que se cerró el 12-sep-2026 en la pantalla de mensajería
 * —allí los que no cabían al menos salían disfrazados de «En curso»—, pero aquí
 * es peor: aquí desaparecen del todo.
 *
 * ── CÓMO LO MIDE ────────────────────────────────────────────────────────────
 * Los filtros SE LEEN DEL PROPIO PANEL, no se copian aquí: si alguien los
 * cambia, este guion mide los nuevos sin que haya que tocarlo. Copiarlos sería
 * otra versión de la misma lista, que es justo la enfermedad que se persigue.
 *
 * Y se cuentan los viajes de Firestore, por estado, para ver cuántos se quedan
 * fuera de verdad. Sin ese número esto es una opinión.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANEL = 'guajirago-admin/src/Viajes.js';

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};
const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length));

/** Los estados que acoge cada pestaña, leídos del panel. */
function lasPestanas() {
  const t = fs.readFileSync(path.join(RAIZ, PANEL), 'utf8');

  // «en curso» es una consulta a Firestore: where('estado','in',[...])
  const q = /where\('estado',\s*'in',\s*\[([^\]]+)\]/.exec(t);
  const enCurso = q ? q[1].replace(/['"\s]/g, '').split(',').filter(Boolean) : null;

  // Las otras dos son filtros sobre la lista ya cargada. Se sacan los estados
  // que compara cada uno.
  // Y SE SIGUE LA PISTA CUANDO EL FILTRO DELEGA. Un `viajes.filter(noCompleto)`
  // no lleva los estados dentro: están en la lista que usa ese ayudante. La
  // primera versión de este guion solo sabía leer las comparaciones escritas a
  // pelo, así que en cuanto el panel sacó la lista a una constante —el mismo
  // día— empezó a decir que la pestaña no acogía NADA y que 75 de 91 viajes
  // desaparecían. Un medidor que se queda viejo grita en falso, y a la tercera
  // vez ya nadie lo mira.
  const deFiltro = (nombre) => {
    const m = new RegExp('const\\s+' + nombre + '\\s*=\\s*viajes\\.filter\\(([^;]+?)\\)\\.sort')
      .exec(t) || new RegExp('const\\s+' + nombre + '\\s*=\\s*viajes\\.filter\\(([^;]+?)\\);')
      .exec(t);
    if (!m) return null;
    let cuerpo = m[1];

    // ¿Delega en un ayudante? (`viajes.filter(noCompleto)`)
    const soloUnNombre = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(cuerpo);
    if (soloUnNombre) {
      const ayudante = new RegExp('const\\s+' + soloUnNombre[1]
        + '\\s*=\\s*\\(\\w+\\)\\s*=>\\s*([A-Z_][\\w$]*)\\.includes').exec(t);
      if (ayudante) {
        const laLista = new RegExp('const\\s+' + ayudante[1] + '\\s*=\\s*\\[([^\\]]*)\\]').exec(t);
        if (laLista) return laLista[1].replace(/['"\s]/g, '').split(',').filter(Boolean);
      }
      // Delega, pero no se pudo seguir: mejor decirlo que inventar una lista.
      return null;
    }

    const estados = [...cuerpo.matchAll(/estado\s*===\s*['"]([^'"]+)['"]/g)].map((x) => x[1]);
    const lista = /\.includes\(v\.estado\)/.test(cuerpo)
      ? [...cuerpo.matchAll(/['"]([a-z_]+)['"]/g)].map((x) => x[1]) : [];
    return [...new Set([...estados, ...lista])];
  };

  return {
    enCurso,
    completados: deFiltro('completados'),
    cancelados: deFiltro('cancelados'),
  };
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

(async () => {
  const p = lasPestanas();
  console.log('');
  console.log(C.neg + '  LAS PESTAÑAS DEL PANEL DE VIAJES' + C.off);
  console.log(C.gris + '  ' + PANEL + C.off);
  console.log('');
  console.log('  ' + C.neg + 'QUÉ ACOGE CADA UNA, HOY' + C.off);
  for (const [nombre, lista] of Object.entries(p)) {
    console.log('    ' + pad(nombre, 14)
      + (lista ? JSON.stringify(lista) : C.roj + 'no la pude leer del archivo' + C.off));
  }
  // 🔴 SI NO SE PUDO LEER UNA PESTAÑA, NO HAY VEREDICTO. La primera versión
  // avisaba de que no sabía leerla y, tres renglones más abajo, remataba con
  // «✓ todos los viajes caben en alguna pestaña» — porque los que faltaban
  // resultaban ser cero HOY. Un medidor que no pudo medir no dice que todo
  // está bien: dice que no pudo medir. Lo cazó la segunda opinión.
  const ciego = Object.values(p).some((x) => !x);
  if (ciego) {
    console.log(C.roj + '    ✗ alguna pestaña cambió de forma y NO LA PUDE LEER.' + C.off);
  }

  let sesion;
  try {
    sesion = await token();
  } catch (e) {
    console.log('');
    console.log(C.ama + '    ⚠ sin sesión de firebase: ' + e.message + C.off);
    return;
  }

  const viajes = await traer(sesion, 'viajes');
  const porEstado = {};
  for (const v of viajes) {
    const e = val((v.fields || {}).estado) || '(sin estado)';
    porEstado[e] = (porEstado[e] || 0) + 1;
  }

  console.log('');
  console.log('  ' + C.neg + 'LOS VIAJES QUE HAY (' + viajes.length + ')' + C.off);
  const cabe = (e) => (p.enCurso || []).includes(e) || (p.completados || []).includes(e)
    || (p.cancelados || []).includes(e);
  for (const [e, n] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
    const ok = cabe(e);
    console.log('    ' + pad(e, 24) + pad(n, 6)
      + (ok ? C.ver + '✓ tiene pestaña' + C.off : C.roj + '🔴 NO SALE EN NINGUNA' + C.off));
  }

  const fuera = viajes.filter((v) => !cabe(val((v.fields || {}).estado)));
  console.log('');
  if (ciego) {
    console.log(C.roj + '  ✗ NO HAY VEREDICTO: hay una pestaña que no pude leer, así que el '
      + 'recuento de' + C.off);
    console.log(C.roj + '    arriba está incompleto. Mírala a mano, o enséñale a este guion a '
      + 'leerla.' + C.off);
    console.log('');
    return;
  }
  console.log('  ' + (fuera.length === 0
    ? C.ver + '✓ todos los viajes caben en alguna pestaña.' + C.off
    : C.roj + '🔴 ' + fuera.length + ' de ' + viajes.length
      + ' viajes NO SALEN EN NINGUNA PESTAÑA.' + C.off));
  if (fuera.length > 0) {
    console.log(C.gris + '     No dan error ni salen en rojo: simplemente no están. Y nadie '
      + 'echa de menos' + C.off);
    console.log(C.gris + '     lo que nunca vio.' + C.off);
  }

  // ── Y EL PORCENTAJE DE CANCELACIÓN, QUE SALE DE ESAS MISMAS LISTAS ──────
  const cuenta = (lista) => viajes.filter((v) => (lista || []).includes(val((v.fields || {}).estado))).length;
  const comp = cuenta(p.completados);
  const canc = cuenta(p.cancelados);
  const noLlegaron = viajes.length - cuenta(p.enCurso) - comp;
  console.log('');
  console.log('  ' + C.neg + 'EL PORCENTAJE DE CANCELACIÓN QUE ENSEÑA EL PANEL' + C.off);
  console.log('    ' + pad('como lo calcula hoy', 26)
    + (comp + canc > 0 ? Math.round((canc / (comp + canc)) * 100) : 0) + '%'
    + C.gris + '   (' + canc + ' de ' + (comp + canc) + ')' + C.off);
  console.log('    ' + pad('contando los que faltan', 26)
    + (comp + noLlegaron > 0 ? Math.round((noLlegaron / (comp + noLlegaron)) * 100) : 0) + '%'
    + C.gris + '   (' + noLlegaron + ' de ' + (comp + noLlegaron)
    + ': todo lo que no acabó bien)' + C.off);
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
