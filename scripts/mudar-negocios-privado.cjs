#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LA MUDANZA DEL NOMBRE · `restaurantesPrivado` pasa a `negociosPrivado`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/mudar-negocios-privado.cjs              ← SIMULACRO (no escribe)
 *   node scripts/mudar-negocios-privado.cjs --aplicar    ← escribe de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 *
 *
 * POR QUÉ ESTE CAMBIO DE NOMBRE
 *
 * Decisión del dueño (7-sep-2026): el software de aliados va a ser UNO con
 * módulos, y va a vender a panaderías, peluquerías, hoteles, tiendas… no solo a
 * restaurantes. Pero la base de datos dice «restaurante» en todas partes: la
 * palabra está escrita 224 veces en 25 archivos de las tres apps, las reglas y
 * las funciones. El día que entre una peluquería, el sistema por dentro dirá
 * que una peluquería es un restaurante.
 *
 * Eso no rompe nada — pero confunde para siempre, y renombrar una colección con
 * clientes dentro deja de ser un trabajo y pasa a ser una mudanza. HOY hay 3
 * negocios y ningún cliente pagando: es el momento más barato que va a existir.
 *
 *
 * ESTE ES EL ENSAYO, A PROPÓSITO EL MÁS PEQUEÑO
 *
 * `restaurantesPrivado` es el «cuarto de atrás» de cada negocio: los datos del
 * dueño que NO salen en el escaparate. Son 3 documentos con 4 campos y sin
 * subcolecciones, y su nombre solo está escrito de verdad en CUATRO sitios
 * porque ya vive en una constante (`COLECCION_PRIVADA` / `NEGOCIO_PRIVADO`).
 * Sirve para probar el procedimiento entero —guion, simulacro, orden del
 * despliegue y verificación— antes de tocar `restaurantes`, que sí es grande.
 *
 *
 * COPIA. NO BORRA NADA.
 *
 * La colección vieja se queda EXACTAMENTE como está, de lápida (REGLA 12 del
 * dueño: «los borrados dejan lápida»). Si algo sale mal, los datos siguen en su
 * sitio de siempre y no se ha perdido nada. Vaciarla, si algún día se quiere,
 * es otro trabajo con su propio permiso.
 *
 * Y NO PISA lo que ya esté en el destino: si un documento ya existe en
 * `negociosPrivado`, se salta y lo dice. Así el guion se puede correr dos veces
 * sin miedo.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const APLICAR = process.argv.includes('--aplicar');

const PROYECTO = 'guajirago';
const DE = 'restaurantesPrivado';
const A = 'negociosPrivado';

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

/** Trae una colección entera, con los campos TAL CUAL los guarda Firestore. */
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

/** Enseña un campo en cristiano, sin destripar datos personales. */
function enCristiano(k, v) {
  if (!v) return '(vacío)';
  if (v.stringValue !== undefined) {
    const s = v.stringValue;
    // El teléfono y el correo son datos del dueño: se enseñan a medias.
    if (/telefono|email|correo/i.test(k) && s.length > 6) {
      return s.slice(0, 3) + '…' + s.slice(-3) + '  (' + s.length + ' letras)';
    }
    return s.length > 30 ? s.slice(0, 30) + '…' : s;
  }
  if (v.integerValue !== undefined) return v.integerValue;
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return String(v.booleanValue);
  if (v.nullValue !== undefined) return '(nulo)';
  if (v.arrayValue) return '(lista de ' + ((v.arrayValue.values || []).length) + ')';
  if (v.mapValue) return '(mapa)';
  return '(otro)';
}

(async () => {
  say('');
  say(C.neg + (APLICAR ? '🚚 MUDANZA DE VERDAD' : '🔍 SIMULACRO — no se escribe nada') + C.off);
  say(C.gris + '   ' + DE + '  →  ' + A + C.off);
  say('');

  const t = await token();
  const viejos = await traer(t, DE);
  const nuevos = await traer(t, A);
  const yaEstan = new Set(nuevos.map((d) => d.id));

  say('   en ' + DE + ': ' + viejos.length + ' documento(s)');
  say('   en ' + A + ': ' + nuevos.length + ' documento(s)');
  say('');

  if (!viejos.length) {
    say(C.ama + '   No hay nada que mudar.' + C.off);
    return;
  }

  let mudados = 0; let saltados = 0; let fallos = 0;

  for (const d of viejos) {
    const campos = Object.keys(d.fields);
    say(C.neg + '   ' + d.id + C.off);
    for (const k of campos) say('      ' + k.padEnd(16) + enCristiano(k, d.fields[k]));

    if (yaEstan.has(d.id)) {
      say(C.ama + '      ↳ YA ESTÁ en ' + A + ': no se toca.' + C.off);
      saltados += 1;
      say('');
      continue;
    }

    if (!APLICAR) {
      say(C.gris + '      ↳ se copiaría a ' + A + '/' + d.id + ' con estos ' + campos.length + ' campos.' + C.off);
      mudados += 1;
      say('');
      continue;
    }

    // ── LA ESCRITURA ────────────────────────────────────────────────────────
    //  `currentDocument.exists=false` es el candado de VERDAD: se lo pide al
    //  servidor, no a este guion. Si entre la lectura de arriba y esta
    //  escritura alguien creara el documento, el servidor lo rechaza en vez de
    //  pisarlo. Fiarse del `yaEstan` de arriba sería fiarse de una foto vieja.
    const url = BASE + '/' + A + '/' + d.id + '?currentDocument.exists=false';
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: d.fields }),
    });
    if (!r.ok) {
      // EL MOTIVO, NO SOLO EL NÚMERO: un 409 (ya existe), un 403 (sin permiso) y
      // un 400 (datos malos) se arreglan de tres maneras distintas, y con solo
      // «HTTP 4xx» se ven iguales.
      let porQue = '';
      try { porQue = ((await r.json()).error || {}).message || ''; } catch (e) { porQue = ''; }
      say(C.rojo + '      ✋ NO se pudo copiar: HTTP ' + r.status
        + (porQue ? ' — ' + porQue.slice(0, 90) : '') + C.off);
      fallos += 1;
    } else {
      say(C.verde + '      ✓ copiado a ' + A + '/' + d.id + C.off);
      mudados += 1;
    }
    say('');
  }

  // ── EL CAREO: se vuelve a LEER del servidor ───────────────────────────────
  //  Que el PATCH conteste 200 no es prueba de nada. Se relee y se compara con
  //  lo que había en el sitio viejo — VALORES INCLUIDOS.
  //
  //  🔴 LA PRIMERA VERSIÓN DE ESTO NO COMPARABA NADA. Decía:
  //        JSON.stringify(v.fields, Object.keys(v.fields).sort())
  //  creyendo que el segundo argumento ordenaba las claves. NO: es una LISTA DE
  //  QUÉ PROPIEDADES CONSERVAR, y se aplica en TODOS los niveles. Como
  //  `stringValue` no estaba en esa lista, se comía todos los valores y producía
  //     {"creditos":{},"duenoNombre":{}}
  //  O sea que solo comparaba los NOMBRES de los campos. Probado: un
  //  `duenoNombre` que dijera OTRO en vez de MECHE, o unos `creditos` copiados
  //  como texto en vez de número, PASABAN como iguales.
  //  Lo cazó la segunda opinión. Y el comentario de entonces decía «se compara
  //  campo por campo», que es exactamente lo que NO hacía.
  const huella = (f) => JSON.stringify(Object.keys(f).sort().map((k) => [k, f[k]]));

  const carear = () => (async () => {
    say(C.neg + '   CAREO — releyendo del servidor' + C.off);
    const quedaron = await traer(t, A);
    const porId = new Map(quedaron.map((d) => [d.id, d]));
    let iguales = 0; let distintos = 0;
    for (const v of viejos) {
      const n = porId.get(v.id);
      if (!n) {
        // En el simulacro esto es lo NORMAL: todavía no se ha copiado nada.
        if (APLICAR) { say(C.rojo + '      ✋ falta ' + v.id + C.off); distintos += 1; }
        continue;
      }
      if (huella(v.fields) === huella(n.fields)) { iguales += 1; } else {
        say(C.rojo + '      ✋ ' + v.id + ' está en el destino pero DISTINTO al origen' + C.off);
        for (const k of new Set([...Object.keys(v.fields), ...Object.keys(n.fields)])) {
          if (JSON.stringify(v.fields[k]) !== JSON.stringify(n.fields[k])) {
            say(C.rojo + '         ' + k + ': origen ' + enCristiano(k, v.fields[k])
              + '  ≠  destino ' + enCristiano(k, n.fields[k]) + C.off);
          }
        }
        distintos += 1;
      }
    }
    say('      ' + iguales + ' iguales, ' + distintos + ' distintos');
    say('');
    return distintos;
  })();

  // SE CAREA SIEMPRE, también en el simulacro. Ahí no comprueba la copia —no la
  // hubo— pero sí avisa si el destino YA tiene algo que no cuadra con el origen,
  // que es justo cuando saberlo es gratis. Ese caso existe de verdad: hay guiones
  // viejos de mudanza que pueden haber dejado un cuarto a medias.
  const distintos = await carear();
  if (distintos) { say(C.rojo + '✋ LA MUDANZA NO CUADRA.' + C.off); process.exit(1); }

  say(C.neg + '   copiados: ' + mudados + '   ya estaban: ' + saltados + '   fallos: ' + fallos + C.off);
  say(C.gris + '   el sitio viejo (' + DE + ') se queda intacto, de lápida.' + C.off);

  if (!APLICAR) {
    say('');
    say(C.ama + '   Esto era un SIMULACRO. No se escribió nada.' + C.off);
    say(C.gris + '   Para hacerlo de verdad: node scripts/mudar-negocios-privado.cjs --aplicar' + C.off);
  }
  say('');
  if (fallos) process.exit(1);
})().catch((e) => { console.error(C.rojo + 'FALLÓ: ' + e.message + C.off); process.exit(1); });
