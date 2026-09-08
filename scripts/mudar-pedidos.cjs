#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LA MUDANZA DE LOS PEDIDOS · `pedidosRestaurantes` pasa a `pedidos`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/mudar-pedidos.cjs              ← SIMULACRO (no escribe)
 *   node scripts/mudar-pedidos.cjs --aplicar    ← escribe de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 *
 * Tercer pedazo del cambio de nombre «restaurante» → «negocio». El terreno ya
 * está puesto (commit a2eadcf): las reglas conocen `pedidos` desde ayer y son
 * gemelas de las del nombre viejo, probadas por comportamiento y por texto.
 *
 * COPIA. NO BORRA NADA. La colección vieja se queda entera, de lápida (REGLA 12
 * del dueño). Y NO PISA lo que ya esté en el destino: si un pedido ya está en
 * `pedidos`, se salta y lo dice, así que el guion se puede correr dos veces sin
 * miedo — y hace falta poder, porque se corre ANTES y DESPUÉS de mudar las apps.
 *
 * ── 🔴 POR QUÉ LOS DATOS VAN PRIMERO, Y NO ES UN DETALLE ────────────────────
 * `storage.rules` decide quién puede ver las fotos del chat de un pedido
 * preguntándole a Firestore de quién es ese pedido. Mientras `pedidos` esté
 * VACÍA, cualquiera con cuenta puede crear ahí `pedidos/{el número del pedido de
 * otro}` poniéndose de cliente. Se probó contra el emulador: con eso se bajaba
 * el COMPROBANTE DE PAGO de la víctima y se le podían meter fotos en su chat.
 * En cuanto los 29 estén aquí, esos números quedan OCUPADOS y no se puede crear
 * encima de un documento que ya existe. Por eso: primero esto, y solo entonces
 * `storage.rules`. Nunca al revés.
 *
 * ── ANOTADO, NO ARREGLADO ───────────────────────────────────────────────────
 * Este guion es GEMELO de `scripts/mudar-negocios-privado.cjs`: misma mudanza,
 * distinta colección. Lo suyo sería un solo guion con el origen y el destino por
 * argumento. Unificarlos toca un archivo ya commiteado que no está en lo que se
 * mandó reparar (PRIMERA LEY), así que va aparte y queda dicho aquí.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const APLICAR = process.argv.includes('--aplicar');

const PROYECTO = 'guajirago';
const DE = 'pedidosRestaurantes';
const A = 'pedidos';

// Las credenciales públicas del CLI de Firebase: no son un secreto, salen de su
// propio código. La sesión de verdad es el refresh_token del disco.
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const C = { verde: '\x1b[32m', rojo: '\x1b[31m', ama: '\x1b[33m', gris: '\x1b[90m', neg: '\x1b[1m', off: '\x1b[0m' };
const say = (t) => console.log(t);

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

/** Trae una colección ENTERA, con los campos TAL CUAL los guarda Firestore. */
async function traer(t, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (r.status === 404) return [];
    if (!r.ok) throw new Error('no pude leer ' + coleccion + ': HTTP ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos.map((d) => ({ id: d.name.split('/').pop(), fields: d.fields || {} }));
}

/**
 * LA HUELLA DE UN DOCUMENTO, para carear el origen contra el destino.
 *
 * 🔴 OJO CON CÓMO SE ESCRIBE, que ya mordió una vez. Poner
 *      JSON.stringify(f, Object.keys(f).sort())
 * NO ordena las claves: el segundo argumento es una LISTA DE QUÉ PROPIEDADES
 * CONSERVAR y se aplica en TODOS los niveles, así que se come los
 * `stringValue`/`integerValue` de Firestore y deja {"campo":{}}. Con eso el
 * careo solo comparaba NOMBRES de campo, y un valor copiado mal pasaba por
 * bueno. Aquí se ordenan las claves a mano y los valores viajan enteros.
 */
const huella = (f) => JSON.stringify(Object.keys(f).sort().map((k) => [k, f[k]]));

/** Un resumen corto de un pedido, sin destripar datos de nadie. */
function enCristiano(f) {
  const s = (k) => (f[k] && f[k].stringValue) || '';
  const n = (k) => (f[k] && (f[k].integerValue ?? f[k].doubleValue)) ?? '';
  const tel = s('telefono');
  const msgs = f.mensajesPedido && f.mensajesPedido.arrayValue
    ? (f.mensajesPedido.arrayValue.values || []).length : 0;
  return [
    (s('estado') || '?').padEnd(11),
    (s('tipo') || '?').padEnd(10),
    ('$' + (n('total') || 0)).padEnd(9),
    (s('creado') || '').slice(0, 10).padEnd(11),
    tel ? 'tel ' + tel.slice(0, 3) + '…' + tel.slice(-2) : 'sin tel',
    msgs ? '  ' + msgs + ' msg' : '',
    Object.keys(f).length + ' campos',
  ].join(' ');
}

(async () => {
  say('');
  say(C.neg + (APLICAR ? '🚚 MUDANZA DE VERDAD' : '🔍 SIMULACRO — no se escribe nada') + C.off);
  say(C.gris + '   ' + DE + '  →  ' + A + C.off);
  say('');

  const t = await token();
  const viejos = await traer(t, DE);
  const nuevos = await traer(t, A);
  const yaEstan = new Map(nuevos.map((d) => [d.id, d]));

  say('   en ' + DE + ': ' + viejos.length + ' pedido(s)');
  say('   en ' + A + ': ' + nuevos.length + ' pedido(s)');
  say('');

  if (!viejos.length) { say(C.ama + '   No hay nada que mudar.' + C.off); return; }

  let copiados = 0; let saltados = 0; let fallos = 0; let distintosYaEstaban = 0;

  for (const d of viejos) {
    const ya = yaEstan.get(d.id);
    if (ya) {
      // Ya está — pero ¿está IGUAL? Si no, es que alguien escribió en el destino
      // por su cuenta, y eso hay que saberlo antes de dar la mudanza por buena.
      const igual = huella(d.fields) === huella(ya.fields);
      say('   ' + d.id.slice(0, 12).padEnd(14) + (igual
        ? C.gris + 'ya estaba, igual' + C.off
        : C.rojo + '✋ YA ESTABA Y ES DISTINTO al original' + C.off));
      if (!igual) distintosYaEstaban += 1;
      saltados += 1;
      continue;
    }

    say('   ' + d.id.slice(0, 12).padEnd(14) + enCristiano(d.fields));

    if (!APLICAR) { copiados += 1; continue; }

    // `currentDocument.exists=false` es el candado de VERDAD: lo pone el
    // SERVIDOR. Si entre la lectura de arriba y esta escritura alguien creara el
    // documento, lo rechaza en vez de pisarlo.
    const r = await fetch(BASE + '/' + A + '/' + d.id + '?currentDocument.exists=false', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: d.fields }),
    });
    if (!r.ok) {
      let porQue = '';
      try { porQue = ((await r.json()).error || {}).message || ''; } catch (e) { porQue = ''; }
      say(C.rojo + '      ✋ NO se pudo copiar: HTTP ' + r.status
        + (porQue ? ' — ' + porQue.slice(0, 90) : '') + C.off);
      fallos += 1;
    } else { copiados += 1; }
  }

  // ── EL CAREO: se relee del servidor y se comparan los VALORES ─────────────
  say('');
  say(C.neg + '   CAREO — releyendo del servidor' + C.off);
  const quedaron = await traer(t, A);
  const porId = new Map(quedaron.map((d) => [d.id, d]));
  let iguales = 0; let distintos = 0; let faltan = 0;
  for (const v of viejos) {
    const n = porId.get(v.id);
    if (!n) {
      // En el simulacro es lo normal: todavía no se ha copiado nada.
      if (APLICAR) { say(C.rojo + '      ✋ falta ' + v.id + C.off); faltan += 1; }
      continue;
    }
    if (huella(v.fields) === huella(n.fields)) { iguales += 1; } else {
      say(C.rojo + '      ✋ ' + v.id + ' está en el destino pero DISTINTO al origen' + C.off);
      for (const k of new Set([...Object.keys(v.fields), ...Object.keys(n.fields)])) {
        if (JSON.stringify(v.fields[k]) !== JSON.stringify(n.fields[k])) {
          say(C.rojo + '         difiere el campo: ' + k + C.off);
        }
      }
      distintos += 1;
    }
  }
  say('      ' + iguales + ' iguales, ' + distintos + ' distintos, ' + faltan + ' sin copiar');
  say('');

  say(C.neg + '   copiados: ' + copiados + '   ya estaban: ' + saltados
    + '   fallos: ' + fallos + C.off);
  say(C.gris + '   el sitio viejo (' + DE + ') se queda intacto, de lápida.' + C.off);

  if (!APLICAR) {
    say('');
    say(C.ama + '   Esto era un SIMULACRO. No se escribió nada.' + C.off);
    say(C.gris + '   Para hacerlo de verdad: node scripts/mudar-pedidos.cjs --aplicar' + C.off);
  }
  say('');
  if (fallos || distintos || faltan || distintosYaEstaban) {
    say(C.rojo + '✋ LA MUDANZA NO CUADRA.' + C.off);
    process.exit(1);
  }
})().catch((e) => { console.error(C.rojo + 'FALLÓ: ' + e.message + C.off); process.exit(1); });
