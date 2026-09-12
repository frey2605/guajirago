/**
 * ¿ESTÁN DE VERDAD MUERTOS LOS ESTADOS QUE SE RETIRAN?
 *
 *   node scripts/medir-estados-muertos.cjs     <- SOLO LEE. No escribe nada.
 *
 * Es el guion del PASO 1 de dos trabajos —el del 9 y el del 12 de sep-2026— y se
 * guarda para que el PASO 12 lo vuelva a correr: contar dos veces con el mismo
 * contador es la única forma de saber que no se movió lo que no tocaba.
 *
 * ── QUÉ PREGUNTA ────────────────────────────────────────────────────────────
 * `guajirago/src/estadosViaje.js` declaraba CUATRO estados de mercado —los
 * viajes que están buscando conductor— y `firestore.rules` los repetía en
 * `enElMercado()`. TRES se quedaron del flujo viejo, de antes de que el mercado
 * de ofertas pasara por la función `confirmarConductor`: hoy una oferta no
 * cambia el estado del viaje, vive en la subcolección `contraofertas`.
 * Queda uno: `esperando`.
 *
 * Que el CÓDIGO no los escriba no basta para retirarlos: hay que mirar los
 * DATOS. Un viaje parado en un estado que se retira desaparece de la pantalla
 * del conductor y del panel, y nadie lo recoge.
 *
 * ── 🔴 LA TRAMPA QUE ME MORDIÓ A MÍ, Y POR ESO ESTÁ ESCRITA AQUÍ ────────────
 * La primera versión buscaba la palabra en `JSON.stringify(documento.fields)`
 * y dio 15 viajes «con rastro». Era MENTIRA: `JSON.stringify` de un documento
 * de Firestore incluye los NOMBRES de los campos, y 15 viajes tienen un campo
 * que se LLAMA `contraoferta` (el monto que ofreció el conductor) sin estar en
 * ese estado. La diferencia importa: 15 sonaba a «esto está vivo» y la verdad
 * era UN viaje atascado.
 * Por eso aquí se mira el VALOR de cada campo por separado, y se dice en cuál
 * aparece la palabra.
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

// TODOS los estados de VIAJE que se han retirado, para que este contador siga
// sirviendo al paso 12 de los dos trabajos:
//   · 9-sep-2026  `confirmando` y `contraoferta` — del flujo viejo, de antes de
//     que las ofertas pasaran por `confirmarConductor`.
//   · 12-sep-2026 `en_negociacion` y `confirmado` — lo mismo, medido igual:
//     cero escritores en las tres apps y en las funciones, cero viajes nunca.
//
// 🔴 OJO CON `confirmado`: está muerto como estado de VIAJE y muy VIVO como
// estado de PEDIDO (`aliados/flujoPedidos.js`, el paso «Recepcionista recibe»).
// Son dos cosas distintas con el mismo nombre. Este guion solo mira `viajes`,
// así que aquí no hay confusión posible — pero al tocar código, sí la hay.
//
// Y LA LISTA SALE DE LA APP, no de una copia de aquí. Tenerla escrita dos
// veces es lo que hizo que este mismo guion se quedara viejo con el arreglo de
// la rutina nocturna (10-sep-2026): el contador del paso 1 dejó de contar lo
// que el paso 12 tenía que comparar.
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { ESTADOS_RETIRADOS: RETIRADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');

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

const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length);

(async () => {
  const t = await token();
  const docs = await traer(t, 'viajes');

  console.log('');
  console.log(C.neg + '  LOS ESTADOS MUERTOS DEL MERCADO' + C.off);
  console.log(C.gris + '  viajes en el servidor: ' + docs.length + C.off);

  // ── 1. QUÉ ESTADOS HAY DE VERDAD ─────────────────────────────────────────
  const cuenta = {};
  for (const d of docs) {
    const e = val((d.fields || {}).estado) || '(sin campo)';
    cuenta[e] = (cuenta[e] || 0) + 1;
  }
  console.log('');
  console.log('  ' + C.neg + 'LOS ESTADOS QUE HAY HOY' + C.off);
  for (const [e, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
    const marca = RETIRADOS.includes(e) ? C.ama + '   <-- SE RETIRA' + C.off : '';
    console.log('    ' + pad(e, 22) + String(n).padStart(4) + marca);
  }

  // ── 2. ¿HAY ALGUIEN PARADO EN LOS QUE SE RETIRAN? ────────────────────────
  const atascados = docs.filter((d) => RETIRADOS.includes(val((d.fields || {}).estado)));
  console.log('');
  console.log('  ' + C.neg + 'VIAJES PARADOS EN UN ESTADO QUE SE RETIRA' + C.off);
  if (atascados.length === 0) {
    console.log(C.ver + '    ninguno.' + C.off);
  } else {
    for (const d of atascados) {
      const f = d.fields || {};
      console.log('    ' + pad(d.name.split('/').pop(), 24)
        + pad(val(f.estado), 14)
        + 'creado ' + String(d.createTime).slice(0, 10)
        + '  ·  tocado ' + String(d.updateTime).slice(0, 10));
      console.log(C.gris + '      ' + (val(f.pasajeroNombre) || '?')
        + '  →  ' + (val(f.destino) || '?')
        + '  ·  ' + (val(f.tarifa) || '?') + C.off);
    }
  }

  // ── 3. EL CAMPO QUE SE LLAMA IGUAL, Y NO ES LO MISMO ─────────────────────
  // (ver la trampa de la cabecera)
  const conCampo = docs.filter((d) => Object.keys(d.fields || {})
    .some((k) => RETIRADOS.some((e) => k.toLowerCase().startsWith(e))));
  console.log('');
  console.log('  ' + C.neg + 'Y OJO, QUE NO ES LO MISMO' + C.off);
  console.log('    ' + conCampo.length + ' viaje(s) tienen un CAMPO que se llama `contraoferta`');
  console.log(C.gris + '    (el monto que ofreció el conductor). Eso es un dato del viaje, no un');
  console.log('    estado, y el panel lo usa para calcular lo que se cobró. NO se toca.' + C.off);

  // ── 4. EL VEREDICTO ──────────────────────────────────────────────────────
  console.log('');
  if (atascados.length === 0) {
    console.log(C.ver + '  ✓ SE PUEDEN RETIRAR: ningún viaje está parado en ellos.' + C.off);
  } else {
    console.log(C.ama + '  ⚠ HAY ' + atascados.length + ' VIAJE(S) PARADO(S) AHÍ.' + C.off);
    console.log('    Al retirar el estado desaparecen del mercado y de la pantalla de');
    console.log('    viajes del panel. Hay que moverlos ANTES, con');
    console.log('    ' + C.neg + 'node scripts/expirar-viaje-atascado.cjs' + C.off);
  }
})();
