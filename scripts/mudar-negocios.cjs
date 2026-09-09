#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LA MUDANZA DE LOS NEGOCIOS · `restaurantes` pasa a `negocios`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/mudar-negocios.cjs              ← SIMULACRO (no escribe)
 *   node scripts/mudar-negocios.cjs --aplicar    ← escribe de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 *
 * TERCER pedazo (de cuatro) del cambio de nombre «restaurante» → «negocio», y el
 * que de verdad importa: esta es LA CARPETA DE LOS NEGOCIOS. Mientras se llame
 * `restaurantes`, el dia que entre una peluqueria el sistema por dentro dira
 * que una peluqueria es un restaurante.
 *
 * COPIA. NO BORRA NADA. La coleccion vieja se queda entera, de lapida (REGLA 12
 * del dueño). Y NO PISA lo que ya este en el destino, asi que se puede correr
 * dos veces — y hace falta poder, porque se corre ANTES y DESPUES de mudar las
 * apps, para recoger rezagados.
 *
 * ── 🔴 LO QUE NO SE COPIA, Y HAY QUE DECIRLO ───────────────────────────────
 * Uno de los tres negocios trae una SUBCOLECCION `empleados` con un registro
 * huerfano. Esta MUERTA: las leyes del proyecto ya la tienen anotada, ninguna de
 * las tres apps la lee ni la escribe, y sus propias reglas lo dicen. Este guion
 * copia SOLO los campos del documento, no las subcolecciones — asi que ese
 * registro se queda en la lapida, que es donde le toca. No se borra (REGLA 12).
 * Si alguna vez hubiera una subcolección VIVA, este guion la dejaria atras EN
 * SILENCIO: por eso lo dice aqui y lo canta al correr.
 *
 * ── POR QUE LOS DATOS VAN PRIMERO ──────────────────────────────────────────
 * Es la leccion que costo dos rondas con los pedidos: mientras dos carpetas
 * convivan, un numero ocupado en una puede estar LIBRE en la otra. Aqui el
 * riesgo es menor —el documento se llama igual que la cuenta de su dueño, asi
 * que nadie puede crear el negocio de otro— pero un negocio NUEVO si podria
 * crearse a si mismo en la carpeta libre diciendo que esta «al dia», y
 * desbloquearse. Por eso `negocioPuedeOperar` pregunta en «Y», no en «O».
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const APLICAR = process.argv.includes('--aplicar');

const PROYECTO = 'guajirago';
const DE = 'restaurantes';
const A = 'negocios';

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
//  🔴 Y SE ORDENA EN TODOS LOS NIVELES, NO SOLO EN EL PRIMERO. Ordenar solo
//  arriba dio una FALSA ALARMA en la mudanza de verdad: el campo `fidelizacion`
//  salió «distinto» cuando los datos eran idénticos — Firestore devolvía las
//  claves de DENTRO del mapa en otro orden («texto, comprarN, activa» contra
//  «texto, activa, comprarN»). El orden de las claves de un mapa no significa
//  nada y Firestore no lo conserva.
//  Un careo que grita en falso deja de mirarse, y entonces no avisa el día que
//  sea verdad. Las LISTAS sí se dejan como están: ahí el orden SÍ significa (el
//  primer mensaje de un chat es el primero).
function ordenado(v) {
  if (Array.isArray(v)) return v.map(ordenado);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = ordenado(v[k]);
    return o;
  }
  return v;
}
const huella = (f) => JSON.stringify(ordenado(f));

/** Un resumen corto de un negocio, sin destripar datos de nadie. */
function enCristiano(f) {
  const s = (k) => (f[k] && f[k].stringValue) || '';
  const b = (k) => f[k] && f[k].booleanValue;
  return [
    (s('nombre') || '?').slice(0, 20).padEnd(22),
    (s('tipoNegocio') || 'restaurante').padEnd(12),
    (b('aprobado') ? 'aprobado' : 'sin aprobar').padEnd(12),
    (s('estadoComercial') || 'alDia').padEnd(10),
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

  say('   en ' + DE + ': ' + viejos.length + ' negocio(s)');
  say('   en ' + A + ': ' + nuevos.length + ' negocio(s)');
  say('');

  if (!viejos.length) { say(C.ama + '   No hay nada que mudar.' + C.off); return; }

  let copiados = 0; let saltados = 0; let fallos = 0; let distintosYaEstaban = 0;
  const subsDejadas = [];

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

    // ── LO QUE SE DEJA ATRÁS, DICHO EN VOZ ALTA ────────────────────────────
    //  Este guion copia CAMPOS, no subcolecciones. Callarlo sería justo el
    //  fallo mudo que este proyecto persigue: una carpeta entera perdida sin
    //  que nada avise. Hoy la única que hay es la copia huérfana del empleado,
    //  que está muerta y se queda en la lápida a propósito.
    const sub = await (await fetch(BASE + '/' + DE + '/' + d.id + ':listCollectionIds', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: '{}',
    })).json();
    for (const c of (sub.collectionIds || [])) {
      say(C.ama + '      ! NO se copia la subcolección «' + c + '»: se queda en la lápida.' + C.off);
      subsDejadas.push(d.id.slice(0, 8) + '/' + c);
    }

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
  if (subsDejadas.length) {
    say(C.ama + '   subcolecciones NO copiadas (' + subsDejadas.length + '): '
      + subsDejadas.join(', ') + C.off);
    say(C.gris + '   viven en la lápida. Si alguna estuviera VIVA, hay que mudarla aparte.' + C.off);
  }

  if (!APLICAR) {
    say('');
    say(C.ama + '   Esto era un SIMULACRO. No se escribió nada.' + C.off);
    say(C.gris + '   Para hacerlo de verdad: node scripts/mudar-negocios.cjs --aplicar' + C.off);
  }
  say('');
  if (fallos || distintos || faltan || distintosYaEstaban) {
    say(C.rojo + '✋ LA MUDANZA NO CUADRA.' + C.off);
    process.exit(1);
  }
})().catch((e) => { console.error(C.rojo + 'FALLÓ: ' + e.message + C.off); process.exit(1); });
