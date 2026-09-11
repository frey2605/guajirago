/**
 * ¿EL BOTÓN DE PÁNICO MANDA LOS DATOS DEL CONDUCTOR EQUIVOCADO?
 *
 *   node scripts/medir-panico.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── QUÉ PASA ────────────────────────────────────────────────────────────────
 * `guajirago/src/Seguridad.js` busca el viaje en curso del pasajero para meterle
 * al mensaje de emergencia su RUTA y los DATOS DEL CONDUCTOR. Lo busca de dos
 * maneras, y la segunda mira la FASE sin comprobar que el viaje esté vivo:
 *
 *     ['confirmado','aceptado','recogiendo','en_punto','en_viaje'].includes(v.estado)
 *     || ['recogiendo','en_punto','en_viaje'].includes(v.fase)
 *
 * Un viaje que se canceló o se expiró MIENTRAS ESTABA EN MARCHA se queda con su
 * `fase` pegada («en_punto», «en_viaje»), así que entra por la segunda puerta.
 *
 * MEDIDO el 11-sep-2026: 7 viajes terminados llevan una fase de viaje en marcha,
 * y TRES DE LOS CINCO pasajeros de la base cogerían uno de ésos. O sea: aprietas
 * emergencia sin ir en ningún viaje y a tu familia le llega la ruta y la placa
 * de un viaje de julio. Es justo lo que avisa `firestore.rules`: «si algo pasa,
 * buscan el carro que no es».
 *
 * ── DE PASO, LO QUE NO PUEDE PASAR NUNCA ────────────────────────────────────
 * De los cinco estados de la primera lista, solo `aceptado` existe de verdad:
 *   · `confirmado`  — NADIE lo escribe en `viajes` (es un estado de PEDIDOS).
 *   · `recogiendo`  — es una fase que vive solo en la memoria de la app del
 *                     conductor (`AppConductor.js:963`), nunca se guarda.
 *   · `en_punto` y `en_viaje` son FASES, no estados: en `v.estado` no caben.
 *
 * Este guion lo comprueba todo contra los datos, reproduciendo la MISMA
 * condición de la app.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

// EL BUSCADOR NUEVO, cargado de la app de verdad. Sin esto el guion solo
// medía la condición VIEJA, y el PASO 12 —que vuelve a correr este mismo
// guion— daría el mismo número aunque el arreglo se rompiera mañana. Lo cazó
// la segunda opinión del 11-sep-2026.
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { elViajeEnCurso, ESTADOS_TERMINADOS }
  = cargarDeLaApp('guajirago/src/estadosViaje.js');

// La lista de terminados sale de la app, no de una copia de aquí.
const TERMINALES = ESTADOS_TERMINADOS;

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};

/**
 * LA CONDICIÓN DE LA APP, COPIADA A MANO A PROPÓSITO.
 *
 * Un guion de Node no puede importar un componente de React sin arrastrar medio
 * React detrás, así que esto es una copia — y una copia se separa. Por eso el
 * guion CAREA su copia contra el archivo de verdad antes de usarla, y avisa si
 * ya no coinciden. Cuando el arreglo esté puesto, este careo dirá que cambió, y
 * eso es lo que se quiere: es la señal de que el fallo se cerró.
 */
const LA_CONDICION_VIEJA =
  "['confirmado', 'aceptado', 'recogiendo', 'en_punto', 'en_viaje'].includes(v.estado)"
  + " || ['recogiendo', 'en_punto', 'en_viaje'].includes(v.fase)";

const comoBuscaLaApp = (v) =>
  ['confirmado', 'aceptado', 'recogiendo', 'en_punto', 'en_viaje'].includes(v.estado)
  || ['recogiendo', 'en_punto', 'en_viaje'].includes(v.fase);

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 200));
  return x.access_token;
}

async function traer(t, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) throw new Error('no pude leer ' + coleccion + ': ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

const val = (v) => v == null ? undefined
  : v.stringValue ?? v.booleanValue ?? v.timestampValue
    ?? (v.integerValue != null ? Number(v.integerValue) : undefined)
    ?? (v.doubleValue != null ? v.doubleValue : undefined);

const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length);

(async () => {
  // ── 0. EL CAREO DE LA COPIA ──────────────────────────────────────────────
  const pantalla = fs.readFileSync(
    path.resolve(__dirname, '..', 'guajirago/src/Seguridad.js'), 'utf8');
  const sigueIgual = pantalla.includes(LA_CONDICION_VIEJA);
  console.log('');
  console.log(C.neg + '  EL BOTÓN DE PÁNICO Y EL VIAJE ACTIVO' + C.off);
  console.log(sigueIgual
    ? C.ama + '  Seguridad.js sigue buscando el viaje como cuando se midió el fallo.' + C.off
    : C.ver + '  ✓ Seguridad.js YA NO busca así: el arreglo está puesto.' + C.off
      + C.gris + '\n    (lo de abajo enseña lo que HABRÍA pasado con la condición vieja,'
      + '\n     que es el careo del paso 12 contra la medición del paso 1.)' + C.off);

  const t = await token();
  const docs = await traer(t, 'viajes');
  const viajes = docs.map((d) => {
    const o = { id: d.name.split('/').pop() };
    for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v);
    return o;
  });
  console.log(C.gris + '  viajes en el servidor: ' + viajes.length + C.off);

  // ── 1. LOS VIAJES TERMINADOS QUE SE VEN VIVOS ────────────────────────────
  console.log('');
  console.log('  ' + C.neg + 'VIAJES YA TERMINADOS QUE LA CONDICIÓN VIEJA DA POR ACTIVOS' + C.off);
  const falsos = viajes.filter((v) => TERMINALES.includes(v.estado) && comoBuscaLaApp(v));
  for (const v of falsos) {
    console.log('    ' + pad(v.id, 24) + pad(v.estado, 22) + 'fase=' + pad(v.fase || '(ninguna)', 12)
      + (v.conductorNombre ? 'conductor: ' + v.conductorNombre : 'sin conductor'));
  }
  console.log('    total: ' + falsos.length + ' de ' + viajes.length);

  // ── 2. LO QUE DE VERDAD IMPORTA: QUÉ COGERÍA CADA PASAJERO ───────────────
  console.log('');
  console.log('  ' + C.neg + 'QUÉ VIAJE COGERÍA CADA PASAJERO · ANTES vs AHORA' + C.off);
  console.log(C.gris + '    (la condición vieja usaba .find(): el PRIMERO, sin ningún orden)' + C.off);
  const porPasajero = {};
  for (const v of viajes) {
    const p = v.pasajeroId || '(sin pasajero)';
    (porPasajero[p] = porPasajero[p] || []).push(v);
  }
  let enRiesgo = 0;
  for (const [p, suyos] of Object.entries(porPasajero)) {
    const antes = suyos.find(comoBuscaLaApp);
    const ahora = elViajeEnCurso(suyos);
    // Se enseñan TODOS los pasajeros, también los que no cogían nada: esconder
    // a los que están bien hace que «3» se lea como «todos».
    const malAntes = antes && TERMINALES.includes(antes.estado);
    const malAhora = ahora && TERMINALES.includes(ahora.estado);
    if (malAhora) enRiesgo++;
    console.log('    ' + pad(p, 30) + pad(suyos.length + ' viajes', 11)
      + 'ANTES ' + pad(antes ? antes.estado : '(ninguno)', 22)
      + (malAntes ? C.roj + '✗' + C.off : C.ver + '✓' + C.off)
      + '   AHORA ' + pad(ahora ? ahora.estado : '(ninguno)', 12)
      + (malAhora ? C.roj + '✗ ¡TERMINADO!' + C.off : C.ver + '✓' + C.off));
    if (malAntes && antes.conductorNombre) {
      console.log(C.gris + '        antes le mandaba a su familia: ' + antes.conductorNombre
        + ' · placa ' + (antes.conductorPlaca || '?')
        + ' · tel ' + (antes.conductorTelefono || '?') + C.off);
    }
  }

  // ── 3. LOS ESTADOS QUE LA CONDICIÓN BUSCA Y NO EXISTEN ───────────────────
  console.log('');
  console.log('  ' + C.neg + 'LO QUE LA CONDICIÓN BUSCA Y NO PUEDE ENCONTRAR' + C.off);
  for (const e of ['confirmado', 'recogiendo', 'en_punto', 'en_viaje']) {
    const n = viajes.filter((v) => v.estado === e).length;
    console.log('    estado «' + pad(e, 14) + '»: ' + n + ' viajes'
      + (n === 0 ? C.gris + '   (nadie lo escribe ahí)' + C.off : ''));
  }
  const conFaseRecogiendo = viajes.filter((v) => v.fase === 'recogiendo').length;
  console.log('    fase   «recogiendo    »: ' + conFaseRecogiendo + ' viajes'
    + C.gris + '   (vive solo en la memoria de la app)' + C.off);

  console.log('');
  console.log(enRiesgo
    ? C.roj + '  🔴 CON EL CÓDIGO DE HOY, ' + enRiesgo
      + ' pasajero(s) recibirían los datos de un viaje TERMINADO.' + C.off
    : C.ver + '  ✓ con el código de hoy, NINGÚN pasajero coge un viaje terminado.' + C.off);
})();
