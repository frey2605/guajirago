/**
 * ¿LA RUTINA NOCTURNA DEJA VIAJES COLGADOS, O MATA VIAJES VIVOS?
 *
 *   node scripts/medir-rutina-colgados.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12. Contar dos veces con el
 * MISMO contador es la única forma de saber que no se movió lo que no tocaba.
 *
 * ── 🔴 LE PREGUNTA A LA CALCULADORA, NO SE INVENTA LOS NÚMEROS ──────────────
 * La primera versión llevaba los límites escritos a mano (20 y 60) y un
 * comentario que decía «lo que usa la rutina HOY». En cuanto la rutina cambió,
 * este contador se quedó viejo: seguía diciendo que un viaje de 65 minutos «lo
 * habrían dado por abandonado en medio del viaje», que ya era falso. Lo cazó la
 * segunda opinión del 10-sep-2026.
 *
 * Un contador que cambia de opinión no sirve para el paso 12. Así que ahora
 * IMPORTA la misma calculadora que usa la rutina: si los números o las reglas
 * cambian, este guion cambia con ellos y no hay nada que acordarse de tocar.
 *
 * ── QUÉ MIDE ────────────────────────────────────────────────────────────────
 *   1. Si hay algún viaje colgado AHORA, y qué haría la rutina con cada uno.
 *   2. Cuánto duran los viajes de verdad, para ver si los topes aprietan.
 *   3. Qué ha cerrado la rutina hasta hoy, y EN QUÉ FASE estaban esos viajes —
 *      que es lo que destapó el fallo: 4 de 8 se cerraron con el pasajero
 *      montado.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// LA MISMA calculadora que usa `expirarViajesColgados`. Ni una copia.
const { queHacerConElViaje, MINUTOS, RODANDO }
  = require('../guajirago/functions/viajesColgados.cjs');

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

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

/** El documento de Firestore en un objeto normal, como lo ve la función. */
const enCristiano = (d) => {
  const o = {};
  for (const [k, v] of Object.entries(d.fields || {})) o[k] = val(v);
  return o;
};

const minutos = (a, b) => (new Date(b) - new Date(a)) / 60000;
const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length);

(async () => {
  const t = await token();
  const docs = await traer(t, 'viajes');
  const ahora = new Date().toISOString();

  console.log('');
  console.log(C.neg + '  LA RUTINA QUE CIERRA VIAJES COLGADOS' + C.off);
  console.log(C.gris + '  viajes en el servidor: ' + docs.length + C.off);
  console.log(C.gris + '  los topes de HOY (salen de viajesColgados.cjs): buscando '
    + MINUTOS.buscando + ' min · sin recoger ' + MINUTOS.noRecogio
    + ' min · rodando ' + MINUTOS.rodando + ' min' + C.off);
  console.log(C.gris + '  cuentan como «hay alguien ahí»: ' + RODANDO.join(', ') + C.off);

  // ── 1. QUÉ HAY, Y QUÉ HARÍA LA RUTINA CON CADA UNO ───────────────────────
  const cuenta = {};
  for (const d of docs) {
    const e = val((d.fields || {}).estado) || '(sin campo)';
    cuenta[e] = (cuenta[e] || 0) + 1;
  }
  console.log('');
  console.log('  ' + C.neg + 'LOS ESTADOS DE HOY' + C.off);
  for (const [e, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    const vivo = !TERMINALES.includes(e);
    console.log('    ' + pad(e, 22) + String(n).padStart(4)
      + (vivo ? C.ama + '   <-- NO es terminal' + C.off : C.gris + '   terminal' + C.off));
  }

  // Se le PREGUNTA a la calculadora, no se adivina.
  const sinCerrar = docs.filter((d) => !TERMINALES.includes(val((d.fields || {}).estado)));
  console.log('');
  console.log('  ' + C.neg + 'QUÉ HARÍA LA RUTINA AHORA MISMO' + C.off);
  if (sinCerrar.length === 0) {
    console.log(C.ver + '    nada: no hay ningún viaje sin cerrar.' + C.off);
  } else {
    for (const d of sinCerrar) {
      const r = queHacerConElViaje(enCristiano(d), ahora);
      console.log('    ' + pad(d.name.split('/').pop(), 24)
        + (r.cerrar ? C.ama + '→ ' + r.estado + C.off : C.ver + '· se queda' + C.off));
      console.log(C.gris + '      ' + r.porQue + C.off);
    }
  }

  // ── 2. ¿APRIETAN LOS TOPES? ──────────────────────────────────────────────
  const acabados = docs.filter((d) => val((d.fields || {}).estado) === 'finalizado');
  const duraciones = [];
  for (const d of acabados) {
    const f = d.fields || {};
    const desde = val(f.tiempoEspera) || val(f.fechaAceptacion) || val(f.fechaSolicitud);
    if (!desde || !d.updateTime) continue;
    duraciones.push({
      id: d.name.split('/').pop(),
      m: minutos(desde, d.updateTime),
      desdeDonde: val(f.tiempoEspera) ? 'desde que recogió'
        : val(f.fechaAceptacion) ? 'desde que se aceptó' : 'desde que se pidió',
    });
  }
  duraciones.sort((a, b) => a.m - b.m);

  console.log('');
  console.log('  ' + C.neg + 'CUÁNTO DURÓ CADA VIAJE QUE TERMINÓ BIEN' + C.off);
  if (duraciones.length === 0) {
    console.log('    no hay ninguno con fechas para medir.');
  } else {
    const enMin = duraciones.map((x) => x.m);
    console.log('    viajes medidos:  ' + duraciones.length);
    console.log('    el más corto:    ' + enMin[0].toFixed(1) + ' min');
    console.log('    la mitad duran:  ' + enMin[Math.floor(enMin.length / 2)].toFixed(1) + ' min o menos');
    console.log('    el más largo:    ' + enMin[enMin.length - 1].toFixed(1) + ' min');
    // Se compara contra el tope del que VA RODANDO, que es el que decide si a un
    // viaje vivo se le acaba el tiempo. El de `noRecogio` no aplica: estos
    // viajes terminaron, o sea que alguien recogió a alguien.
    const pasados = duraciones.filter((x) => x.m > MINUTOS.rodando);
    console.log('');
    if (pasados.length === 0) {
      console.log(C.ver + '    ✓ ninguno pasó de ' + MINUTOS.rodando
        + ' min, que es el tope del que va rodando.' + C.off);
      console.log(C.ama + '      OJO: son ' + duraciones.length + ' viajes de PRUEBA, no de clientes.' + C.off);
      console.log('      Que no haya mordido hasta hoy no dice que el tope alcance para un');
      console.log('      viaje de verdad. Se decide pensando en el PEOR viaje real.');
    } else {
      console.log(C.roj + '    ✗ ' + pasados.length + ' de ' + duraciones.length
        + ' pasaron de ' + MINUTOS.rodando + ' min:' + C.off);
      for (const p of pasados) {
        console.log('      ' + pad(p.id, 24) + p.m.toFixed(1) + ' min  (' + p.desdeDonde + ')');
      }
      console.log('      A ésos la rutina los habría cerrado antes de que terminaran.');
    }
  }

  // ── 3. LO QUE LA RUTINA YA CERRÓ, Y EN QUÉ FASE ESTABAN ──────────────────
  // Ésta es la sección que destapó el fallo del 9-sep-2026.
  const porSistema = docs.filter((d) => val((d.fields || {}).expiradoPor) === 'sistema');
  console.log('');
  console.log('  ' + C.neg + 'LO QUE LA RUTINA HA CERRADO, Y EN QUÉ PUNTO IBA CADA VIAJE' + C.off);
  let conPasajero = 0;
  for (const d of porSistema) {
    const f = d.fields || {};
    const fase = val(f.fase);
    const vivo = RODANDO.includes(fase);
    if (vivo) conPasajero++;
    console.log('    ' + pad(d.name.split('/').pop(), 24) + pad(val(f.tipo) || '?', 12)
      + 'fase=' + pad(fase || '(ninguna)', 12)
      + (vivo ? C.roj + '  <-- SE CERRÓ CON ALGUIEN ESPERANDO O MONTADO' + C.off : ''));
  }
  console.log('    total cerrados por la rutina: ' + porSistema.length
    + (conPasajero ? C.roj + '   ·   ' + conPasajero + ' con el viaje vivo' + C.off
                   : C.ver + '   ·   ninguno con el viaje vivo' + C.off));
  console.log(C.gris + '    (los de antes del 10-sep-2026 se cerraron por reloj, sin mirar la fase.');
  console.log('     Desde esa fecha la rutina mira la fase y ya no puede hacerlo.)' + C.off);

  // ── 4. LA HUELLA ─────────────────────────────────────────────────────────
  console.log('');
  console.log('  ' + C.neg + 'LA HUELLA DE QUIÉN CERRÓ' + C.off);
  const conMotivo = docs.filter((d) => val((d.fields || {}).motivoExpiracion)).length;
  console.log('    con `expiradoPor`:      ' + porSistema.length);
  console.log('    con `motivoExpiracion`: ' + conMotivo
    + C.gris + '   (lo escribe la rutina desde el 10-sep-2026)' + C.off);
  console.log(C.gris + '    Antes, un viaje «vencido» se cerraba SIN dejar rastro y no había forma de');
  console.log('    saber si lo cerró la rutina o la app — `Solicitar.js` también lo escribe.');
  console.log('    Ahora la rutina siempre deja quién, cuándo y por qué.' + C.off);
})();
