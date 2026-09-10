/**
 * ¿LA RUTINA NOCTURNA DEJA VIAJES COLGADOS, O MATA VIAJES VIVOS?
 *
 *   node scripts/medir-rutina-colgados.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1. Se guarda para que el PASO 12 lo vuelva a correr.
 *
 * ── QUÉ PREGUNTA, Y POR QUÉ CAMBIÓ LA PREGUNTA ──────────────────────────────
 * Se empezó buscando un AGUJERO: `expirarViajesColgados` solo mira `esperando`
 * y `aceptado`, así que —se pensaba— un viaje parado en otro estado no lo
 * limpiaría nadie. Midiendo el CÓDIGO salió que eso ya no puede pasar: los
 * únicos estados VIVOS que alguien escribe hoy son esos dos. Los demás
 * (`en_negociacion`, `confirmado`, y los ya retirados `confirmando` y
 * `contraoferta`) NO LOS ESCRIBE NADIE.
 *
 * Así que la pregunta de verdad es la contraria, y es peor:
 * 🔴 LA RUTINA EXPIRA UN VIAJE `aceptado` A LA HORA. ¿Hay viajes de verdad que
 * duren más de una hora? Porque a ésos los mata EN MEDIO DEL VIAJE: el pasajero
 * va montado y el sistema da el viaje por abandonado.
 *
 * Y hay una señal de que ese número no está pensado: el comentario de al lado
 * (`functions/index.js:430`) dice «'aceptado' +3h» y el código usa 60 minutos.
 * Uno de los dos está mal desde que se escribió.
 *
 * ── CÓMO SE MIDE ────────────────────────────────────────────────────────────
 * Con los viajes que TERMINARON BIEN (`finalizado`): desde que el conductor lo
 * aceptó hasta que se cerró. Es la única duración real que hay en los datos.
 *
 * OJO CON ESTA MEDICIÓN, y hay que decirlo: hoy los viajes de la base son de
 * PRUEBA, no de clientes. Un puñado de pruebas cortas no demuestra que una
 * hora sea suficiente para un viaje de verdad — solo demuestra que hasta hoy no
 * ha mordido. El número hay que decidirlo pensando en el peor viaje real, no en
 * el promedio de las pruebas.
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

// Lo que usa la rutina HOY (functions/index.js:417-418).
const LIMITE_ESPERANDO_MIN = 20;
const LIMITE_ACEPTADO_MIN = 60;
const TERMINALES = ['finalizado', 'cancelado', 'cancelado_conductor', 'vencido', 'expirado'];

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};

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

const minutos = (a, b) => (new Date(b) - new Date(a)) / 60000;
const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length);

(async () => {
  const t = await token();
  const docs = await traer(t, 'viajes');

  console.log('');
  console.log(C.neg + '  LA RUTINA QUE CIERRA VIAJES COLGADOS' + C.off);
  console.log(C.gris + '  viajes en el servidor: ' + docs.length + C.off);
  console.log(C.gris + '  la rutina de hoy: `esperando` a los ' + LIMITE_ESPERANDO_MIN
    + ' min → vencido   ·   `aceptado` a los ' + LIMITE_ACEPTADO_MIN + ' min → expirado' + C.off);

  // ── 1. ¿HAY ALGUIEN COLGADO AHORA? ───────────────────────────────────────
  const cuenta = {};
  for (const d of docs) {
    const e = val((d.fields || {}).estado) || '(sin campo)';
    cuenta[e] = (cuenta[e] || 0) + 1;
  }
  console.log('');
  console.log('  ' + C.neg + 'LOS ESTADOS DE HOY' + C.off);
  let colgados = 0;
  for (const [e, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    const vivo = !TERMINALES.includes(e);
    if (vivo) colgados += n;
    console.log('    ' + pad(e, 22) + String(n).padStart(4)
      + (vivo ? C.ama + '   <-- NO es terminal: alguien lo tiene que cerrar' + C.off
              : C.gris + '   terminal' + C.off));
  }
  console.log('    ' + (colgados === 0
    ? C.ver + 'ninguno colgado ahora mismo.' + C.off
    : C.ama + colgados + ' viaje(s) sin cerrar.' + C.off));

  // ── 2. 🔴 LO QUE DE VERDAD IMPORTA: ¿CUÁNTO DURA UN VIAJE? ───────────────
  const acabados = docs.filter((d) => val((d.fields || {}).estado) === 'finalizado');
  const duraciones = [];
  for (const d of acabados) {
    const f = d.fields || {};
    const desde = val(f.fechaAceptacion) || val(f.fechaSolicitud);
    if (!desde || !d.updateTime) continue;
    duraciones.push({
      id: d.name.split('/').pop(),
      m: minutos(desde, d.updateTime),
      conFechaAceptacion: !!val(f.fechaAceptacion),
    });
  }
  duraciones.sort((a, b) => a.m - b.m);

  console.log('');
  console.log('  ' + C.neg + 'CUÁNTO DURÓ CADA VIAJE QUE TERMINÓ BIEN' + C.off);
  console.log(C.gris + '    (desde que el conductor lo aceptó hasta que se cerró)' + C.off);
  if (duraciones.length === 0) {
    console.log('    no hay ninguno con fechas para medir.');
  } else {
    const enMin = duraciones.map((x) => x.m);
    const mediana = enMin[Math.floor(enMin.length / 2)];
    const sinFecha = duraciones.filter((x) => !x.conFechaAceptacion).length;
    console.log('    viajes medidos:  ' + duraciones.length
      + (sinFecha ? C.gris + '   (' + sinFecha + ' sin `fechaAceptacion`: se midió desde que se pidió)' + C.off : ''));
    console.log('    el más corto:    ' + enMin[0].toFixed(1) + ' min');
    console.log('    la mitad duran:  ' + mediana.toFixed(1) + ' min o menos');
    console.log('    el más largo:    ' + enMin[enMin.length - 1].toFixed(1) + ' min');

    const pasados = duraciones.filter((x) => x.m > LIMITE_ACEPTADO_MIN);
    console.log('');
    if (pasados.length === 0) {
      console.log(C.ver + '    ✓ ninguno pasó de ' + LIMITE_ACEPTADO_MIN + ' min.' + C.off);
      console.log(C.ama + '      PERO OJO: son ' + duraciones.length + ' viajes de PRUEBA, no de clientes.' + C.off);
      console.log('      Que no haya mordido hasta hoy no dice que una hora alcance para');
      console.log('      un viaje de verdad. El número se decide pensando en el PEOR viaje');
      console.log('      real —un trancón, una espera larga—, no en el promedio.');
    } else {
      console.log(C.roj + '    ✗ ' + pasados.length + ' de ' + duraciones.length
        + ' pasaron de ' + LIMITE_ACEPTADO_MIN + ' min:' + C.off);
      for (const p of pasados) console.log('      ' + pad(p.id, 24) + p.m.toFixed(1) + ' min');
      console.log('      A ésos la rutina los habría dado por abandonados EN MEDIO DEL VIAJE.');
    }
  }

  // ── 3. LO QUE LA RUTINA HA CERRADO ───────────────────────────────────────
  const porSistema = docs.filter((d) => val((d.fields || {}).expiradoPor) === 'sistema');
  console.log('');
  console.log('  ' + C.neg + 'LO QUE LA RUTINA HA CERRADO HASTA HOY' + C.off);
  console.log('    con la marca `expiradoPor: sistema`:  ' + porSistema.length);
  console.log('    en estado `vencido`:                  ' + (cuenta.vencido || 0)
    + C.gris + '   (a éstos la rutina NO les deja huella: solo cambia el estado)' + C.off);
  console.log('    en estado `expirado`:                 ' + (cuenta.expirado || 0));
  if (porSistema.length < (cuenta.expirado || 0)) {
    console.log(C.gris + '    (los `expirado` sin marca son de antes de que la rutina la pusiera,');
    console.log('     o los movió un guion a mano.)' + C.off);
  }
})();
