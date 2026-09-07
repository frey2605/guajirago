/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MEDIR · EL CHAT DE RECARGA DEL CONDUCTOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SOLO LECTURA. No escribe ni un campo. Se corre DOS veces: antes de tocar
 * nada (paso 1) y otra vez al final (paso 10), para comprobar que lo que no se
 * tocó sigue igual.
 *
 *     node scripts/medir-chat-recarga.cjs
 *
 * POR QUÉ EXISTE. El chat guarda todos sus mensajes en UNA lista dentro del
 * documento del conductor (`usuarios/{uid}.mensajesRecarga`), y por ahí sube el
 * conductor la FOTO DE SU COMPROBANTE. Hasta el 6-sep-2026, los cinco sitios
 * que le escriben leían la lista entera, le pegaban su mensaje y la subían
 * completa otra vez: el que subiera de segundo borraba lo del primero, sin
 * error y sin rastro. Ahora se usa `arrayUnion`, que se lo pega EN EL SERVIDOR.
 *
 * LA PREGUNTA QUE DECIDE SI ESO ES SEGURO, y por eso este guion existe:
 * `arrayUnion` DESCARTA los elementos que ya están, comparados campo por campo.
 *
 *      ¿HAY, EN LOS CHATS DE VERDAD, DOS MENSAJES EXACTAMENTE IGUALES?
 *
 * Si los hubiera, `arrayUnion` los colapsaría en uno y el arreglo perdería
 * mensajes. Medido el 6-sep-2026: CERO idénticos y CERO sin fecha — cada
 * mensaje lleva `fecha` con milisegundos, así que dos no pueden coincidir.
 * Este guion vuelve a hacer esa pregunta cada vez que se corre: si algún día
 * alguien quita la fecha de un mensaje, aquí se ve.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'guajirago';
// Las credenciales públicas del CLI de Firebase: no son un secreto, salen de su
// propio código. La sesión de verdad es el refresh_token del disco.
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const val = (v) => v == null ? undefined
  : v.stringValue ?? v.booleanValue
    ?? (v.integerValue != null ? Number(v.integerValue) : undefined)
    ?? (v.doubleValue != null ? v.doubleValue : undefined);

/** Un mapa de Firestore pasado a objeto normal. */
const mapa = (m) => {
  const o = {};
  for (const [k, v] of Object.entries((m && m.fields) || {})) o[k] = val(v);
  return o;
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
  if (!x.access_token) {
    throw new Error('no pude abrir sesión con Firebase: ' + JSON.stringify(x).slice(0, 200)
      + '\n   (arréglalo con: npx firebase-tools login)');
  }
  return x.access_token;
}

/** Trae una colección ENTERA. Pagina: sin esto, a partir de 300 mentiría. */
async function traer(t, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) return { error: r.status, docs: [] };
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return { docs: todos };
}

(async () => {
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  console.log('EL CHAT DE RECARGA · ' + hoy + ' (hora de Colombia)\n');

  const t = await token();
  const { docs, error } = await traer(t, 'usuarios');
  if (error) { console.error('no pude leer los usuarios: ' + error); process.exit(1); }

  let conChat = 0, total = 0, imagenes = 0, sinFecha = 0, mayor = 0, identicos = 0;
  const detalle = [];

  for (const d of docs) {
    const f = d.fields || {};
    const arr = f.mensajesRecarga && f.mensajesRecarga.arrayValue
      && f.mensajesRecarga.arrayValue.values;
    if (!arr || !arr.length) continue;
    conChat += 1;
    const msgs = arr.map((e) => mapa(e.mapValue));
    total += msgs.length;
    mayor = Math.max(mayor, msgs.length);
    const img = msgs.filter((m) => m.tipo === 'imagen').length;
    imagenes += img;
    sinFecha += msgs.filter((m) => !m.fecha).length;

    // LA PREGUNTA QUE DECIDE: dos mensajes idénticos campo por campo.
    const vistos = new Set();
    let rep = 0;
    for (const m of msgs) {
      const huella = JSON.stringify(Object.keys(m).sort().map((k) => [k, m[k]]));
      if (vistos.has(huella)) rep += 1; else vistos.add(huella);
    }
    identicos += rep;

    detalle.push({
      nombre: String(val(f.nombre) || '?').slice(0, 22),
      n: msgs.length, img, rep,
      desde: String((msgs[0] || {}).fecha || '').slice(0, 10),
      hasta: String((msgs[msgs.length - 1] || {}).fecha || '').slice(0, 10),
    });
  }

  console.log('  usuarios en total ............ ' + docs.length);
  console.log('  con chat de recarga .......... ' + conChat);
  console.log('  mensajes en total ............ ' + total);
  console.log('  de esos, FOTOS (comprobantes)  ' + imagenes);
  console.log('  el chat más largo ............ ' + mayor + ' mensajes');
  console.log('  mensajes SIN fecha ........... ' + sinFecha
    + (sinFecha ? '   ← OJO: sin fecha, dos iguales SÍ podrían chocar' : ''));
  console.log('  MENSAJES IDÉNTICOS entre sí .. ' + identicos
    + (identicos ? '   ✋ arrayUnion los colapsaría: hay que mirarlo'
      : '   ← ninguno: arrayUnion es seguro aquí'));

  if (detalle.length) {
    console.log('\n  ' + 'PERSONA'.padEnd(24) + 'MSG'.padEnd(6) + 'FOTOS'.padEnd(7)
      + 'REPES'.padEnd(7) + 'DESDE'.padEnd(12) + 'HASTA');
    for (const p of detalle.sort((a, b) => b.n - a.n)) {
      console.log('  ' + p.nombre.padEnd(24) + String(p.n).padEnd(6) + String(p.img).padEnd(7)
        + String(p.rep).padEnd(7) + p.desde.padEnd(12) + p.hasta);
    }
  }

  console.log('\nLA HUELLA (paso 1 vs paso 10)');
  console.log('chats=' + conChat + ' mensajes=' + total + ' fotos=' + imagenes
    + ' identicos=' + identicos + ' sinFecha=' + sinFecha);

  // Si aparecieran idénticos, el arreglo dejaría de ser seguro y hay que verlo.
  process.exit(identicos ? 1 : 0);
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
