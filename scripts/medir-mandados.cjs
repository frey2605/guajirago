/**
 * EL PANEL DE MENSAJERÍA — ¿cuadran sus cajas con los mandados que hay?
 *
 *   node scripts/medir-mandados.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * Porque no existía, y por eso se coló un número falso.
 *
 * El 12-sep-2026 medí «a ojo», sin guion guardado, cuántos mandados había. Filtré
 * por `tipo === 'mensajeria'` y me salió CERO, así que di por bueno que el
 * conteo del panel no podía estar mal. El campo dice **«Mensajería»**, con
 * mayúscula y con tilde: hay DOCE. Y en cuanto se cuentan bien, aparece que
 * CINCO no caben en ninguna caja de la pantalla.
 *
 * Un guion guardado no se equivoca dos veces igual, y el paso 12 lo vuelve a
 * correr. Uno hecho a ojo se equivoca una vez y no se entera nadie. Lo cazó la
 * segunda opinión.
 *
 * ── QUÉ MIDE ────────────────────────────────────────────────────────────────
 * Las tres cajas de `guajirago-admin/src/Mensajeria.js` —en curso, entregados,
 * cancelados— contra los mandados que hay de verdad. Y, sobre todo, los que NO
 * caen en ninguna: ésos acaban en el cajón de sastre de `etiquetaEstado`, que
 * los pinta «En curso» en naranja aunque estén cancelados o expirados.
 *
 * Las listas se sacan DEL PROPIO PANEL leyendo el archivo, no se copian aquí:
 * si alguien las cambia, este guion mide las nuevas sin que haya que tocarlo.
 * (Copiarlas sería una cuarta versión de la misma lista — SEGUNDA LEY.)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANEL = 'guajirago-admin/src/Mensajeria.js';

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

// 🔴 EL TIPO SE ESCRIBE ASÍ, CON MAYÚSCULA Y CON TILDE. Es el error que este
// guion viene a impedir: filtrar por «mensajeria» da CERO y parece que no hay
// nada que mirar.
const EL_TIPO = 'Mensajería';

/** Las listas de cajas, sacadas del propio panel. */
function lasCajas() {
  const t = fs.readFileSync(path.join(RAIZ, PANEL), 'utf8');
  const lista = (nombre) => {
    const m = new RegExp('const\\s+' + nombre + '\\s*=\\s*\\(\\w+\\)\\s*=>\\s*\\[([^\\]]*)\\]')
      .exec(t);
    if (m) return m[1].replace(/['"\s]/g, '').split(',').filter(Boolean);
    const uno = new RegExp('const\\s+' + nombre + "\\s*=\\s*\\(\\w+\\)\\s*=>\\s*\\w+\\s*===\\s*'([^']+)'")
      .exec(t);
    return uno ? [uno[1]] : null;
  };
  return {
    enCurso: lista('esEnCurso'),
    entregado: lista('esEntregado'),
    cancelado: lista('esCancelado'),
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
  const cajas = lasCajas();
  console.log('');
  console.log(C.neg + '  EL PANEL DE MENSAJERÍA Y SUS CAJAS' + C.off);
  console.log(C.gris + '  ' + PANEL + C.off);
  console.log('');
  console.log('  ' + C.neg + 'LAS CAJAS QUE TIENE EL PANEL HOY' + C.off);
  for (const [nombre, lista] of Object.entries(cajas)) {
    console.log('    ' + pad(nombre, 12)
      + (lista ? JSON.stringify(lista) : C.roj + 'no la pude leer del archivo' + C.off));
  }
  if (Object.values(cajas).some((x) => !x)) {
    console.log(C.roj + '    ✗ alguna caja cambió de forma: hay que mirarla a mano.' + C.off);
  }

  let sesion;
  try {
    sesion = await token();
  } catch (e) {
    console.log('');
    console.log(C.ama + '    ⚠ sin sesión de firebase: ' + e.message + C.off);
    return;
  }

  const todos = await traer(sesion, 'viajes');
  const mandados = todos.filter((v) => val((v.fields || {}).tipo) === EL_TIPO);

  console.log('');
  console.log('  ' + C.neg + 'LOS MANDADOS QUE HAY (tipo «' + EL_TIPO + '»)' + C.off);
  console.log('    ' + pad('en total', 22) + mandados.length + ' de ' + todos.length + ' viajes');
  const porEstado = {};
  for (const v of mandados) {
    const e = val((v.fields || {}).estado) || '(sin estado)';
    porEstado[e] = (porEstado[e] || 0) + 1;
  }
  for (const [e, n] of Object.entries(porEstado).sort((a, b) => b[1] - a[1])) {
    console.log('      ' + pad(e, 24) + n);
  }

  // ── ¿CABEN TODOS EN ALGUNA CAJA? ───────────────────────────────────────
  const cae = (lista, e) => Array.isArray(lista) && lista.includes(e);
  const sinCaja = mandados.filter((v) => {
    const e = val((v.fields || {}).estado);
    return !cae(cajas.enCurso, e) && !cae(cajas.entregado, e) && !cae(cajas.cancelado, e);
  });

  console.log('');
  console.log('  ' + C.neg + 'CÓMO LOS REPARTE EL PANEL' + C.off);
  console.log('    ' + pad('en curso', 22)
    + mandados.filter((v) => cae(cajas.enCurso, val((v.fields || {}).estado))).length);
  console.log('    ' + pad('entregados', 22)
    + mandados.filter((v) => cae(cajas.entregado, val((v.fields || {}).estado))).length);
  console.log('    ' + pad('cancelados', 22)
    + mandados.filter((v) => cae(cajas.cancelado, val((v.fields || {}).estado))).length);
  console.log('    ' + pad('SIN CAJA', 22)
    + (sinCaja.length === 0 ? C.ver + '0' + C.off : C.roj + sinCaja.length + C.off));

  if (sinCaja.length > 0) {
    const cuales = {};
    for (const v of sinCaja) {
      const e = val((v.fields || {}).estado) || '(sin estado)';
      cuales[e] = (cuales[e] || 0) + 1;
    }
    console.log('');
    console.log(C.roj + '      🔴 estos ' + sinCaja.length + ' no caben en ninguna caja:' + C.off);
    for (const [e, n] of Object.entries(cuales)) {
      console.log(C.gris + '         ' + pad(e, 24) + n + C.off);
    }
    console.log(C.roj + '      Caen en el cajón de sastre de `etiquetaEstado` y se pintan '
      + '«En curso» en' + C.off);
    console.log(C.roj + '      naranja — estando cancelados o expirados. Y no se cuentan ni '
      + 'en «EN CURSO' + C.off);
    console.log(C.roj + '      AHORA» ni en «CANCELADOS HOY».' + C.off);
  }
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
