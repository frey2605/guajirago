/**
 * PASO 1 · MEDIR LOS PEDIDOS   (SOLO LECTURA)
 *
 * Para cerrar `pedidosRestaurantes/` en el almacen hay que poder preguntarle a
 * Firestore de QUIEN es cada pedido. Este guion contesta con los datos reales:
 *   · cuantos pedidos hay
 *   · QUE CAMPOS traen, y cuales identifican al cliente y al restaurante
 *   · si esos campos estan en TODOS (si falta en alguno, la regla lo dejaria
 *     fuera y se romperia el chat de ese pedido)
 *   · cuantas fotos hay en los chats
 */
const fs = require('fs'); const path = require('path'); const os = require('os');
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/guajirago/databases/(default)/documents';

const val = (v) => v == null ? undefined : v.stringValue ?? v.booleanValue
  ?? (v.integerValue != null ? Number(v.integerValue) : undefined)
  ?? (v.doubleValue != null ? v.doubleValue : undefined);

(async () => {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const t = (await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CI, client_secret: CS, refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token' }),
  })).json()).access_token;

  let p; const docs = [];
  do {
    const r = await fetch(BASE + '/pedidosRestaurantes?pageSize=300' + (p ? '&pageToken=' + p : ''),
      { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) { console.log('no pude leer: HTTP ' + r.status); process.exit(1); }
    const x = await r.json(); docs.push(...(x.documents || [])); p = x.nextPageToken;
  } while (p);

  console.log('PEDIDOS A RESTAURANTES\n');
  console.log('  pedidos en total ......... ' + docs.length);

  const cuenta = {};
  for (const d of docs) for (const k of Object.keys(d.fields || {})) cuenta[k] = (cuenta[k] || 0) + 1;
  console.log('\n  ' + 'CAMPO'.padEnd(28) + 'EN CUANTOS   EJEMPLO');
  for (const [k, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    const ej = docs.find((d) => d.fields[k] && val(d.fields[k]) !== undefined);
    const v = ej ? String(val(ej.fields[k])).slice(0, 26) : '(no llano)';
    console.log('  ' + k.padEnd(28) + String(n + '/' + docs.length).padEnd(13) + v);
  }

  console.log('\n  LOS CAMPOS QUE IDENTIFICAN A ALGUIEN:');
  // ── SE CUENTAN LOS QUE SIRVEN, NO LOS QUE ESTÁN ─────────────────────────
  //  La regla del almacén compara `data.get('clienteId','') == uid`, así que un
  //  campo escrito como NULO no le sirve de nada — y `Restaurantes.js:336` sí
  //  puede escribirlo nulo (`auth.currentUser ? …uid : null`). Contar la mera
  //  presencia daría un verde falso el día que aparezca uno: se vería
  //  «29 de 29» y su cliente estaría fuera igual.
  const sirve = (d, k) => {
    const f = (d.fields || {})[k];
    if (!f || f.nullValue !== undefined) return false;
    return String(val(f) ?? '') !== '';
  };
  for (const k of ['clienteId', 'usuarioId', 'clienteUid', 'restauranteId', 'negocioId']) {
    const n = docs.filter((d) => sirve(d, k)).length;
    const nulos = docs.filter((d) => ((d.fields || {})[k] || {}).nullValue !== undefined).length;
    console.log('    ' + k.padEnd(18) + n + ' de ' + docs.length
      + (n === 0 ? '   (no lo trae ninguno)' : n < docs.length ? '   *** FALTA EN ' + (docs.length - n) : '   (en todos)')
      + (nulos ? '   ✋ ' + nulos + ' lo traen NULO, que no vale' : ''));
  }

  let conChat = 0, conFoto = 0, mensajes = 0;
  for (const d of docs) {
    const a = d.fields && d.fields.mensajesPedido && d.fields.mensajesPedido.arrayValue;
    const vs = (a && a.values) || [];
    if (vs.length) conChat += 1;
    mensajes += vs.length;
    for (const m of vs) {
      const f = (m.mapValue && m.mapValue.fields) || {};
      if (f.imagen && val(f.imagen)) conFoto += 1;
    }
  }
  console.log('\n  pedidos con chat ......... ' + conChat);
  console.log('  mensajes en total ........ ' + mensajes);
  console.log('  FOTOS en los chats ....... ' + conFoto);

  console.log('\nLA HUELLA (paso 1 vs paso 10)');
  console.log('pedidos=' + docs.length + ' conChat=' + conChat + ' mensajes=' + mensajes + ' fotos=' + conFoto);
})().catch((e) => { console.error('FALLO: ' + e.message); process.exit(1); });
