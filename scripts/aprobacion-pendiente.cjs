#!/usr/bin/env node
/**
 * LOS NEGOCIOS QUE NADIE APROBÓ — devolverlos a la bandeja de pendientes.
 *
 *   node scripts/aprobacion-pendiente.cjs            <- SIMULACRO: no escribe nada
 *   node scripts/aprobacion-pendiente.cjs --aplicar  <- escribe de verdad
 *
 * El simulacro y la aplicación son EL MISMO CÓDIGO: solo cambia si al final se
 * llama o no a la escritura. Un ensayo de otra obra no es un ensayo.
 *
 * ── DECISIÓN DEL DUEÑO (26-ago-2026): NO SE CORRE TODAVÍA ───────────────────
 * Palabras suyas, después de ver el simulacro: «Son de prueba no hemos comenzado
 * operaciones.» Es la misma decisión que ya tomó con la agencia demo. Así que
 * este guion queda HECHO Y PARADO: no escribe nada hasta que alguien lo llame
 * con --aplicar, y no se vuelve a proponer mientras no arranquen.
 *
 * CUÁNDO HAY QUE ACORDARSE: antes de abrir al público. El día que entre el primer
 * cliente de verdad, estos dos negocios se le enseñan sin que nadie los haya
 * aprobado. Correr primero el simulacro, sin --aplicar.
 *
 * ── QUÉ ARREGLA ─────────────────────────────────────────────────────────────
 * La regla del 24-ago-2026 obliga a que un negocio nazca con `aprobado: false`
 * y `estadoAprobacion: 'pendiente'`. Cerró la puerta HACIA ADELANTE. Los que ya
 * estaban dentro se quedaron dentro: medido el 25-ago-2026, DOS de los tres
 * negocios (del 2-jul-2026) no tienen ninguno de los dos campos.
 *
 * Y «el campo no existe» NO es «false» para NINGÚN lector de las tres apps.
 * Auditado uno por uno:
 *   · guajirago/src/Restaurantes.js:105  `aprobado !== false`  -> SE LO ENSEÑA AL CLIENTE
 *   · guajirago/src/Turismo.js:45        idem
 *   · admin/Restaurantes.js:73           -> lo pinta APROBADO, en verde
 *   · admin/Restaurantes.js:114          pendientes = `aprobado === false` -> NO SALE
 *   · admin/Restaurantes.js:217          lo CUENTA como aprobado en el marcador
 *   · admin/AliadosPendientes.js:18      where('aprobado','==',false) -> NO LO ENCUENTRA
 *   · admin/Turismo.js:70, :112, :209    lo mismo por el lado de turismo
 *   · aliados/App.js:57                  `useState(true) // true por defecto` -> ni el
 *                                        propio negocio ve el aviso de «pendiente»
 * O sea: nadie los aprobó nunca, y los seis sitios se comportan como si sí.
 *
 * ── QUÉ ESCRIBE ─────────────────────────────────────────────────────────────
 * Exactamente los dos campos con los que HOY nace un negocio en
 * guajirago-aliados/src/Login.js:60-61. No se inventa vocabulario nuevo: se les
 * pone el estado con el que tendrían que haber nacido.
 *
 * ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
 *   · No toca ningún negocio que YA tenga el campo `aprobado`, valga lo que valga.
 *     Si alguien lo aprobó o lo rechazó, esa decisión manda.
 *   · No borra nada (REGLA 12).
 *   · No aprueba ni rechaza a nadie: eso lo decide el dueño desde el panel, que es
 *     justo lo que este arreglo le devuelve.
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

const APLICAR = process.argv.includes('--aplicar');
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

(async () => {
  const t = await token();
  const r = await fetch(BASE + '/restaurantes?pageSize=300', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('no pude leer los negocios: ' + r.status);
  const docs = (await r.json()).documents || [];

  console.log(APLICAR ? '\n*** APLICANDO DE VERDAD ***\n' : '\n=== SIMULACRO — no se escribe nada ===\n');
  console.log('negocios en el servidor: ' + docs.length + '\n');

  const tocar = [];
  for (const d of docs) {
    const f = d.fields || {};
    const id = d.name.split('/').pop();
    const nombre = val(f.nombre) || '(sin nombre)';
    const tieneAprobado = Object.prototype.hasOwnProperty.call(f, 'aprobado');
    const tieneEstado = Object.prototype.hasOwnProperty.call(f, 'estadoAprobacion');

    console.log('· ' + nombre + '   ' + id);
    console.log('    hoy:  aprobado=' + (tieneAprobado ? val(f.aprobado) : 'NO EXISTE')
      + '   estadoAprobacion=' + (tieneEstado ? val(f.estadoAprobacion) : 'NO EXISTE')
      + '   creado ' + String(val(f.fechaCreacion) || '?').slice(0, 10));

    if (tieneAprobado) {
      console.log('    -> SE QUEDA COMO ESTÁ. Ya tiene el campo: alguien decidió, y esa'
        + ' decisión manda.\n');
      continue;
    }
    tocar.push({ id, nombre, name: d.name });
    console.log('    -> LE FALTA. Quedaría: aprobado=false  estadoAprobacion=pendiente');
    console.log('       y con eso:');
    console.log('         · el cliente DEJA de verlo   (Restaurantes.js:105, Turismo.js:45)');
    console.log('         · SALE en la bandeja de pendientes   (AliadosPendientes.js:18)');
    console.log('         · el panel deja de pintarlo verde   (admin/Restaurantes.js:73)');
    console.log('         · el negocio ve su aviso de «pendiente»   (aliados/App.js:397)');
    console.log('       y el dueño decide en el panel: aprobar o rechazar.\n');
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log('se tocarían: ' + tocar.length + ' de ' + docs.length
    + '   ·   se quedan igual: ' + (docs.length - tocar.length));

  if (!tocar.length) { console.log('\nno hay nada que hacer.'); return; }
  if (!APLICAR) {
    console.log('\nesto ha sido un SIMULACRO. Para escribirlo de verdad:');
    console.log('   node scripts/aprobacion-pendiente.cjs --aplicar');
    return;
  }

  console.log('');
  for (const n of tocar) {
    // updateMask: SOLO estos dos campos. No se reescribe el documento entero.
    const url = 'https://firestore.googleapis.com/v1/' + n.name
      + '?updateMask.fieldPaths=aprobado&updateMask.fieldPaths=estadoAprobacion';
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          aprobado: { booleanValue: false },
          estadoAprobacion: { stringValue: 'pendiente' },
        },
      }),
    });
    console.log('   ' + n.nombre + ': ' + (res.ok ? 'escrito' : 'FALLÓ ' + res.status
      + ' ' + (await res.text()).slice(0, 200)));
  }

  // ── VERIFICAR CONTRA LA NUBE. Que el PATCH conteste 200 no es prueba de nada.
  console.log('\n=== se vuelve a LEER del servidor ===');
  const r2 = await fetch(BASE + '/restaurantes?pageSize=300', { headers: { Authorization: 'Bearer ' + t } });
  const docs2 = (await r2.json()).documents || [];
  for (const d of docs2) {
    const f = d.fields || {};
    console.log('   ' + String(val(f.nombre) || '?').padEnd(20)
      + ' aprobado=' + (Object.prototype.hasOwnProperty.call(f, 'aprobado') ? val(f.aprobado) : 'NO EXISTE')
      + '  estadoAprobacion=' + (val(f.estadoAprobacion) || 'NO EXISTE'));
  }
  const quedan = docs2.filter((d) => !Object.prototype.hasOwnProperty.call(d.fields || {}, 'aprobado'));
  console.log('\nnegocios que siguen SIN el campo: ' + quedan.length + '   (tiene que ser 0)');
})().catch((e) => { console.error('FALLÓ:', e.message); process.exit(1); });
