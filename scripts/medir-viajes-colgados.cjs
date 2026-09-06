#!/usr/bin/env node
/**
 * ¿HAY VIAJES COLGADOS Y CONDUCTORES ATASCADOS? — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-viajes-colgados.cjs
 *
 * PASO 1 de los 10. Se guarda porque el PASO 10 lo re-corre: contar dos veces con
 * el mismo contador es la única forma de saber que no se movió lo que no tocaba.
 *
 * ── POR QUÉ SE MIDE ESTO ────────────────────────────────────────────────────
 * guajirago/src/AppConductor.js tiene 16 escrituras que no le dicen NADA al
 * conductor si el servidor las rechaza: siete con `catch (e) {}` vacío y NUEVE
 * sin catch ninguno. Las que pesan son las del viaje en marcha:
 *
 *   r951   conductorEnPunto / fase 'en_punto'  -> «ya llegué» que el pasajero no ve
 *   r967   fase 'en_viaje'                     -> arrancar y que no conste
 *   r1018  estado 'cancelado_conductor'        -> cancelar y que el viaje siga vivo
 *   r1038  estado 'finalizado'                 -> TERMINAR Y QUE NO CONSTE (la plata)
 *   r353   la contraoferta                     -> ofertar y que nadie la vea
 *   r1021 / r1041 / r1195  ocupado:false       -> QUEDARSE OCUPADO PARA SIEMPRE
 *
 * Ese último es el más callado de todos: mientras figure ocupado no le entran
 * viajes, y no hay nada en pantalla que se lo diga. Pierde trabajo sin saberlo.
 *
 * Este guion NO adivina y NO propone: cuenta en la base cuántos viajes se quedaron
 * parados en un estado que no es final, y cuántos conductores figuran ocupados sin
 * un viaje vivo que lo justifique. Con ese número se decide si el arreglo urge.
 *
 * ── LO QUE NO ESCRIBE ───────────────────────────────────────────────────────
 * NINGÚN DATO. Los datos solo se LEEN, con GET. No hay ni un PATCH, ni un DELETE,
 * ni un :commit, ni un :batchWrite.
 *
 * SÍ hay UN POST, y hay que decirlo: el de abrir la sesión contra
 * oauth2.googleapis.com. No toca la base. (Se dice porque la primera versión del
 * guion hermano —medir-conductores.cjs— juraba «no hay un solo POST» y era falso.)
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

const val = (v) => v == null ? undefined
  : v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : undefined);

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

// Trae la colección ENTERA, página a página. Sin esto, con más de 300 documentos
// la cuenta saldría corta y nadie se enteraría de que faltan.
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

// Los estados en los que un viaje YA TERMINÓ. Cualquier otro es un viaje que
// sigue vivo para la app y para las funciones del servidor.
//
// «vencido» SE SACÓ DE LA FUNCIÓN, no de la cabeza: lo escribe
// expirarViajesColgados (functions/index.js:377) para los viajes que nadie
// atendió en 20 minutos. La primera lista de aquí no lo tenía, y con eso CADA
// viaje vencido habría salido contado como «colgado». Hoy no hay ninguno, así que
// el número no cambia — pero la lista estaba mal y el día que lo hubiera habría
// mentido.
const TERMINADOS = ['finalizado', 'cancelado', 'cancelado_conductor',
  'cancelado_pasajero', 'expirado', 'vencido'];

(async () => {
  const t = await token();
  const viajes = await traer(t, 'viajes');
  const conductores = await traer(t, 'conductores');

  console.log('\n=== MEDIDA · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===\n');
  console.log('viajes en el servidor:      ' + viajes.length);
  console.log('conductores en el servidor: ' + conductores.length + '\n');

  const porEstado = new Map();
  const porFase = new Map();
  const colgados = [];
  const ahora = new Date();

  for (const d of viajes) {
    const f = d.fields || {};
    const estado = val(f.estado) || '(sin estado)';
    const fase = val(f.fase) || '(sin fase)';
    porEstado.set(estado, (porEstado.get(estado) || 0) + 1);
    porFase.set(fase, (porFase.get(fase) || 0) + 1);

    if (TERMINADOS.includes(estado)) continue;
    const cuando = val(f.fechaSolicitud) || val(f.fechaCreacion) || '';
    const dias = cuando ? Math.floor((ahora - new Date(cuando)) / 86400000) : null;
    colgados.push({
      id: d.name.split('/').pop(), estado, fase, dias,
      cuando: String(cuando).slice(0, 10),
    });
  }

  console.log('POR ESTADO:');
  [...porEstado.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(4) + '  ' + k
      + (TERMINADOS.includes(k) ? '' : '   <- NO ES FINAL')));

  console.log('\nPOR FASE:');
  [...porFase.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('   ' + String(v).padStart(4) + '  ' + k));

  console.log('\n── VIAJES QUE NUNCA LLEGARON A UN ESTADO FINAL: ' + colgados.length + ' ──');
  const viejos = colgados.filter((c) => c.dias !== null && c.dias > 1);
  console.log('   de esos, parados más de UN DÍA: ' + viejos.length);
  // El identificador va ENTERO. La primera versión lo cortaba a 16 letras «para
  // que cupiera», y los de Firestore son de 20: el que salía por pantalla no se
  // podía buscar. Un dato que no se puede comprobar no es una medida.
  viejos.sort((a, b) => b.dias - a.dias).slice(0, 15).forEach((c) => console.log(
    '     · ' + c.id + '  estado=' + String(c.estado).padEnd(14)
    + 'fase=' + String(c.fase).padEnd(12) + c.dias + ' días (' + c.cuando + ')'));
  if (viejos.length > 15) console.log('     … y ' + (viejos.length - 15) + ' más');

  // ── LOS CONDUCTORES ATASCADOS EN «OCUPADO» ────────────────────────────────
  // Un conductor ocupado SIN un viaje vivo que lo justifique es el síntoma de
  // que el `ocupado: false` de r1021/r1041/r1195 no llegó y nadie se enteró.
  const vivos = new Set(colgados.map((c) => c.id));
  const atascados = [];
  for (const d of conductores) {
    const f = d.fields || {};
    if (val(f.ocupado) !== true) continue;
    const enViaje = val(f.enViajeId);
    if (!enViaje || !vivos.has(enViaje)) {
      atascados.push({
        nombre: val(f.nombre) || '(sin nombre)',
        enViaje: enViaje || 'ninguno',
      });
    }
  }
  console.log('\n── CONDUCTORES MARCADOS «OCUPADO» SIN VIAJE VIVO: ' + atascados.length + ' ──');
  if (atascados.length) {
    console.log('   (mientras figuren ocupados NO les entran viajes, y nada se lo dice)');
    atascados.forEach((c) => console.log('     · ' + c.nombre.padEnd(22) + 'enViajeId=' + c.enViaje));
  } else {
    console.log('   ninguno.');
  }

  // ── LAS CONTRAOFERTAS ─────────────────────────────────────────────────────
  let conOfertas = 0;
  let ofertas = 0;
  for (const d of viajes) {
    const id = d.name.split('/').pop();
    const r = await fetch(BASE + '/viajes/' + id + '/contraofertas?pageSize=100',
      { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) continue;
    const n = ((await r.json()).documents || []).length;
    if (n) { conOfertas += 1; ofertas += n; }
  }
  console.log('\n── CONTRAOFERTAS ──');
  console.log('   viajes con ofertas: ' + conOfertas + '   ·   ofertas en total: ' + ofertas);

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('NO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
