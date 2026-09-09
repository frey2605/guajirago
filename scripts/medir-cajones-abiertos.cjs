#!/usr/bin/env node
/**
 * LOS CUATRO CAJONES ABIERTOS — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-cajones-abiertos.cjs
 *
 * PASO 1 de los 10. Se guarda porque el PASO 10 lo re-corre.
 *
 * ── POR QUÉ ─────────────────────────────────────────────────────────────────
 * El software de restaurantes se va a VENDER a varios negocios. Auditado el
 * 6-sep-2026 leyendo firestore.rules: hay ONCE permisos abiertos a «cualquiera
 * que haya entrado», y CUATRO colecciones enteras se pueden LEER Y ESCRIBIR por
 * cualquier usuario registrado de las tres apps:
 *
 *   comprasInsumos  · lo que le cuesta la mercancía a cada negocio
 *   visitasDiarias  · cuánta gente entra cada día
 *   mesasInfo       · las mesas
 *   usosPromo       · quién usó qué promoción
 *
 * Con un solo dueño eso «no pasa nada». Vendiéndolo a dos restaurantes de la
 * misma calle, uno le puede leer los costos al otro abriendo la consola del
 * navegador. No hay que ser experto.
 *
 * Antes de cerrar hay que saber QUÉ HAY DENTRO y de quién es: cerrar una puerta
 * sin mirar quién está pasando por ella es como se rompen las cosas.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No escribe NINGÚN dato. Solo GET. El único POST es el de abrir la sesión contra
 * oauth2.googleapis.com, que no toca la base.
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
  : v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : undefined)
    ?? (v.doubleValue != null ? v.doubleValue : undefined);

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
    if (!r.ok) return { error: r.status, docs: [] };
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return { docs: todos };
}

// Cómo se sabe de qué negocio es cada documento, en cada cajón.
// Los dos primeros lo llevan en el NOMBRE (`restauranteId_loQueSea`), que es un
// regalo: la regla del servidor puede leerlo de ahí sin abrir el documento.
const CAJONES = [
  ['comprasInsumos', 'campo', 'restauranteId', 'lo que le cuesta la mercancía'],
  ['visitasDiarias', 'nombre', null, 'cuánta gente entra cada día'],
  ['mesasInfo', 'nombre', null, 'las mesas'],
  ['usosPromo', 'otro', null, 'quién usó qué promoción'],
];

(async () => {
  const t = await token();

  // Los negocios que existen, para poder decir de quién es cada dato.
  const negocios = new Map();
  for (const d of (await traer(t, 'negocios')).docs) {
    negocios.set(d.name.split('/').pop(), val((d.fields || {}).nombre) || '(sin nombre)');
  }

  console.log('\n=== LOS CUATRO CAJONES · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===\n');
  console.log('negocios en el servidor: ' + negocios.size);
  for (const [id, n] of negocios) console.log('   · ' + n + '   (' + id.slice(0, 12) + '…)');

  for (const [nombre, como, campo, queEs] of CAJONES) {
    const { docs, error } = await traer(t, nombre);
    console.log('\n── ' + nombre + '  —  ' + queEs + ' ──');
    if (error) { console.log('   no pude leerlo: ' + error); continue; }
    console.log('   documentos: ' + docs.length);
    if (!docs.length) { console.log('   VACÍO. Cerrarlo no puede romper nada que exista.'); continue; }

    const porNegocio = new Map();
    const huerfanos = [];
    for (const d of docs) {
      const id = d.name.split('/').pop();
      let dueno = null;
      if (como === 'campo') dueno = val((d.fields || {})[campo]);
      else if (como === 'nombre') dueno = id.split('_')[0];
      if (dueno && negocios.has(dueno)) porNegocio.set(dueno, (porNegocio.get(dueno) || 0) + 1);
      else huerfanos.push(id.slice(0, 28));
    }
    for (const [id, n] of porNegocio) console.log('   ' + String(n).padStart(4) + '  de ' + (negocios.get(id) || id));
    if (huerfanos.length) {
      console.log('   ' + String(huerfanos.length).padStart(4) + '  SIN DUEÑO RECONOCIBLE  <- ojo: una regla que');
      console.log('         exija dueño los dejaría fuera. Hay que mirarlos uno por uno.');
      huerfanos.slice(0, 6).forEach((x) => console.log('           · ' + x));
      if (huerfanos.length > 6) console.log('           … y ' + (huerfanos.length - 6) + ' más');
    }
  }

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('NO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
