#!/usr/bin/env node
/**
 * ¿QUIÉN SALE HOY EN LA APP, Y QUIÉN SALDRÍA? — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-escaparate.cjs
 *
 * PASO 1 de los 10, del PUNTO 2b. Se guarda porque el PASO 10 lo re-corre, y
 * porque conviene volver a correrlo CADA VEZ QUE ENTRE UN CLIENTE NUEVO: es el
 * único sitio que avisa si a alguien le falta un campo y por eso va a
 * desaparecer —o a aparecer— sin que nadie lo haya decidido.
 *
 * ── QUÉ SE MIDE Y POR QUÉ ───────────────────────────────────────────────────
 * `visibleEnEscaparate` es la llave que contesta «¿sale este negocio en la app
 * de clientes?». Es la que hace posible venderle el programa a un restaurante de
 * otra ciudad: paga, lo usa, y NO sale en la app —porque allí no hay conductores
 * que lleven el domicilio—.
 *
 * La llave se creó el 6-sep-2026, el panel ya la mueve (admin/Cobros.js:603) y
 * las reglas ya la protegen. Pero la app del cliente NO LA MIRABA: el dueño la
 * apagaba, el botón cambiaba, y el negocio seguía saliendo. Un interruptor con
 * el cable cortado.
 *
 * LO QUE ESTE GUION CONTESTA, y es la pregunta que puede romperlo todo:
 *
 *     ¿a quién le falta el campo?
 *
 * Porque si la app exigiera `visibleEnEscaparate === true`, todos los que no lo
 * tengan DESAPARECEN de la app el día del despliegue — y sin dar ningún error:
 * la pantalla simplemente se queda vacía. Por eso el filtro pregunta
 * `!== false`: un campo que falta no apaga a nadie. Este guion enseña las dos
 * cuentas, la buena y la mala, para que se vea la diferencia en números.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No escribe NINGÚN dato. Solo GET. El único POST es el de abrir la sesión contra
 * oauth2.googleapis.com, que no toca la base.
 *
 * ── ANOTADO, NO ARREGLADO (SEGUNDA LEY) ─────────────────────────────────────
 * Este es el UNDÉCIMO guion que repite `token()` palabra por palabra. No hay un
 * ayudante común. Unificarlos es un trabajo aparte, con sus 10 pasos y su permiso.
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

const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length);

// LA MISMA CUENTA QUE guajirago/src/escaparate.js. Está escrita dos veces —aquí
// en Node y allí en la app— porque no hay forma de importar la app desde un guion
// suelto sin arrastrar todo React. Lo que impide que se separen es
// pruebas/escaparate.test.js, que EJECUTA el archivo de la app: si allí se cambia
// la cuenta y aquí no, la prueba se pone roja antes de que nadie corra esto.
const sale = (n) => n.aprobado !== false
  && n.visibleEnEscaparate !== false
  && n.perfilCompleto === true;

(async () => {
  const t = await token();
  const { docs, error } = await traer(t, 'restaurantes');
  if (error) throw new Error('no pude leer restaurantes: ' + error);

  console.log('\n=== ¿QUIÉN SALE EN LA APP? · SOLO LECTURA · '
    + new Date().toLocaleString('es-CO') + ' ===\n');
  console.log('negocios en el servidor: ' + docs.length + '\n');

  const negocios = docs.map((d) => {
    const f = d.fields || {};
    return {
      id: d.name.split('/').pop(),
      nombre: val(f.nombre) || '(sin nombre)',
      tipoNegocio: val(f.tipoNegocio),
      aprobado: f.aprobado === undefined ? undefined : val(f.aprobado),
      perfilCompleto: f.perfilCompleto === undefined ? undefined : val(f.perfilCompleto),
      visibleEnEscaparate: f.visibleEnEscaparate === undefined ? undefined : val(f.visibleEnEscaparate),
    };
  });

  const q = (v) => v === undefined ? '(no tiene)' : String(v);
  console.log('  ' + pad('negocio', 24) + pad('tipo', 13) + pad('aprobado', 12)
    + pad('perfilCompleto', 16) + 'visibleEnEscaparate');
  console.log('  ' + '─'.repeat(84));
  for (const n of negocios) {
    console.log('  ' + pad(n.nombre, 24) + pad(n.tipoNegocio || '(no tiene)', 13)
      + pad(q(n.aprobado), 12) + pad(q(n.perfilCompleto), 16) + q(n.visibleEnEscaparate));
  }

  console.log('\n── QUIÉN SALE, con la cuenta buena (`!== false`) ──');
  let salen = 0, apagados = 0;
  for (const n of negocios) {
    const s = sale(n);
    if (s) salen++;
    if (n.visibleEnEscaparate === false) apagados++;
    const porQue = s ? ''
      : (n.aprobado === false ? '  ← no aprobado'
        : n.visibleEnEscaparate === false ? '  ← APAGADO en el panel'
          : n.perfilCompleto !== true ? '  ← ficha a medias' : '');
    console.log('  ' + pad(n.nombre, 24) + (s ? 'SÍ sale' : 'no sale') + porQue);
  }

  console.log('\n── LA CUENTA MALA, la que hay que evitar (`=== true`) ──');
  const conCampo = negocios.filter((n) => n.visibleEnEscaparate !== undefined).length;
  const desaparecen = negocios.filter((n) => sale(n) && n.visibleEnEscaparate !== true);
  if (desaparecen.length === 0) {
    console.log('  daría lo mismo: todos los que salen tienen el campo puesto en true.');
  } else {
    console.log('  ⚠ DESAPARECERÍAN ' + desaparecen.length + ' de ' + negocios.length + ' negocios,');
    console.log('    y la app no daría ningún error: se quedaría vacía.');
    for (const n of desaparecen) console.log('      · ' + n.nombre);
  }

  console.log('\n── LA HUELLA (esto es lo que se carea en el paso 10) ──');
  console.log('  negocios=' + negocios.length
    + ' salen=' + salen
    + ' apagadosAmano=' + apagados
    + ' conCampoInterruptor=' + conCampo
    + ' sinFichaLlena=' + negocios.filter((n) => n.perfilCompleto !== true).length
    + ' sinCampoAprobado=' + negocios.filter((n) => n.aprobado === undefined).length);

  console.log('\nNO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
