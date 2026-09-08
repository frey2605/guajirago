#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LA MUDANZA DEL CONTADOR · las ventas por plato salen del menú
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/mudar-ventas-por-plato.cjs              ← SIMULACRO (no escribe)
 *   node scripts/mudar-ventas-por-plato.cjs --aplicar    ← escribe de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 * Es el PASO 7 de los 10: correr sin escribir y enseñar qué cambiaría, uno por uno.
 *
 *
 * QUÉ HACE, Y POR QUÉ NO COPIA
 *
 * Hasta el 7-sep-2026 «cuántas veces se vendió cada plato» vivía dentro de
 * `restaurantes/{id}.menu[].vecesVendido`. Se muda a `ventasPorPlato/{id}`, un
 * documento por negocio con un mapa `platos: { platoId: cantidad }`.
 *
 * Y NO SE COPIA EL NÚMERO VIEJO: se RECALCULA desde los pedidos. El dueño lo
 * decidió así el 7-sep-2026 después de que se le enseñara por qué. El número
 * viejo está MAL, y se sabe exactamente cuánto: medido ese día con
 * scripts/medir-mas-vendidos.cjs, el contador decía 20 y lo vendido eran 34,
 * porque las 9 mesas que cerró un empleado nunca se contaron (el servidor le
 * decía que no y el error caía en un `catch` vacío). Copiar los 20 sería mudar la
 * mentira a una casa nueva.
 *
 * La verdad sale de los pedidos, que sí están completos:
 *
 *     pedidosRestaurantes  con  tipo == 'local'  y  estado == 'cerrado'
 *     → por cada línea de `items`: id del plato × cantidad
 *
 *
 * ESTO ESCRIBE. POR ESO LLEVA CUATRO CANDADOS
 *
 *   1. NO BORRA NADA, NUNCA. El campo viejo `menu[].vecesVendido` se queda donde
 *      está, intacto. Si algo saliera mal, el número viejo sigue ahí para
 *      compararlo. Vaciarlo es otro trabajo, con su propio permiso.
 *   2. NO ESCRIBE SI NO HAY QUE ESCRIBIR. Si el sitio nuevo ya dice lo mismo que
 *      se calculó, ese negocio se salta. Correrlo dos veces no hace nada la
 *      segunda vez.
 *   3. SOLO TOCA `platos`. Escribe con merge y solo ese campo: cualquier otra
 *      cosa que alguien haya puesto en ese documento se queda.
 *   4. ENSEÑA TODO ANTES. En simulacro imprime negocio por negocio y plato por
 *      plato lo que cambiaría, con el número viejo al lado.
 *
 *
 * LO QUE NO PUEDE SABER
 *
 * Si un plato se vendió y DESPUÉS se borró del menú, su venta aparece aquí pero
 * no tiene a qué nombre ponerse. Se cuenta igual —el dato es del negocio— y se
 * avisa por pantalla, para que nadie se extrañe de ver un id suelto.
 *
 *
 * ── ANOTADO, NO ARREGLADO (SEGUNDA LEY) ─────────────────────────────────────
 * Este es el DÉCIMO guion que repite `token()` palabra por palabra. No hay un
 * ayudante común. Unificarlos es tocar nueve archivos que funcionan: es un
 * trabajo aparte, con sus 10 pasos y su permiso.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const APLICAR = process.argv.includes('--aplicar');

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const val = (v) => v == null ? undefined
  : v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : undefined)
    ?? (v.doubleValue != null ? v.doubleValue : undefined);
const lista = (v) => (v && v.arrayValue && v.arrayValue.values) || [];
const campos = (v) => (v && v.mapValue && v.mapValue.fields) || {};

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

async function leerUno(t, ruta) {
  const r = await fetch(BASE + '/' + ruta, { headers: { Authorization: 'Bearer ' + t } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('no pude leer ' + ruta + ': ' + r.status);
  return await r.json();
}

// Escribe SOLO el campo `platos`, con merge. El resto del documento no se toca.
async function escribirPlatos(t, negocioId, platos) {
  const fields = { platos: { mapValue: { fields: {} } } };
  for (const [id, n] of Object.entries(platos)) {
    fields.platos.mapValue.fields[id] = { integerValue: String(n) };
  }
  const url = BASE + '/ventasPorPlato/' + negocioId + '?updateMask.fieldPaths=platos';
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error('no pude escribir ' + negocioId + ': ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n) : String(s) + ' '.repeat(n - String(s).length);
const der = (s, n) => String(s).padStart(n);

(async () => {
  const t = await token();
  console.log('\n=== LA MUDANZA DEL CONTADOR · ' + (APLICAR ? '⚠ APLICANDO DE VERDAD' : 'SIMULACRO, no escribe nada')
    + ' · ' + new Date().toLocaleString('es-CO') + ' ===\n');

  // Los negocios y sus menús (solo para poder decir el NOMBRE de cada plato).
  const negocios = new Map();
  for (const d of (await traer(t, 'restaurantes')).docs) {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    const platos = new Map();
    for (const p of lista(f.menu)) {
      const g = campos(p);
      platos.set(String(val(g.id)), { nombre: val(g.nombre) || '(sin nombre)', viejo: val(g.vecesVendido) || 0 });
    }
    negocios.set(id, { nombre: val(f.nombre) || '(sin nombre)', platos });
  }

  // La verdad: lo que se vendió en las mesas ya cerradas.
  const { docs: pedidos, error } = await traer(t, 'pedidos');
  if (error) throw new Error('no pude leer los pedidos: ' + error);

  const verdad = new Map();  // negocioId -> { platoId: cantidad }
  let mesas = 0;
  for (const d of pedidos) {
    const f = d.fields || {};
    if (val(f.tipo) !== 'local' || val(f.estado) !== 'cerrado') continue;
    mesas++;
    const neg = val(f.restauranteId) || '';
    if (!verdad.has(neg)) verdad.set(neg, {});
    const caja = verdad.get(neg);
    for (const it of lista(f.items)) {
      const g = campos(it);
      const id = val(g.id);
      if (id === undefined || id === null) continue;
      caja[String(id)] = (caja[String(id)] || 0) + (Number(val(g.cantidad)) || 1);
    }
  }
  console.log('mesas cerradas leídas: ' + mesas + '   ·   negocios con ventas: ' + verdad.size + '\n');

  let aEscribir = 0, saltados = 0;
  for (const [neg, platos] of verdad) {
    const info = negocios.get(neg) || { nombre: '(negocio que ya no existe: ' + neg.slice(0, 12) + '…)', platos: new Map() };

    // Lo que dice HOY el sitio nuevo, para no escribir si ya está bien (candado 2).
    const actualDoc = await leerUno(t, 'ventasPorPlato/' + neg);
    const actual = {};
    if (actualDoc) {
      for (const [k, v] of Object.entries(campos((actualDoc.fields || {}).platos))) actual[k] = val(v) || 0;
    }

    const ids = Object.keys(platos).sort();
    const igual = ids.length === Object.keys(actual).length
      && ids.every((id) => actual[id] === platos[id]);

    console.log('── ' + info.nombre + ' ──');
    if (igual) {
      console.log('   ya está al día. No se toca.\n');
      saltados++;
      continue;
    }

    console.log('   ' + pad('plato', 30) + der('viejo', 8) + der('ahora', 8) + der('quedará', 9));
    let huerfanos = 0;
    for (const id of ids) {
      const p = info.platos.get(id);
      if (!p) huerfanos++;
      console.log('   ' + pad(p ? p.nombre : '(id ' + id + ', ya no está en el menú)', 30)
        + der(p ? p.viejo : '—', 8) + der(actual[id] !== undefined ? actual[id] : '—', 8) + der(platos[id], 9));
    }
    if (huerfanos) {
      console.log('   ojo: ' + huerfanos + ' venta(s) de platos que ya no están en el menú. Se cuentan igual:');
      console.log('        el dato es del negocio, aunque el plato ya no se sirva.');
    }
    console.log('');
    aEscribir++;

    if (APLICAR) {
      await escribirPlatos(t, neg, platos);
      console.log('   ✓ escrito.\n');
    }
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log('negocios que cambiarían: ' + aEscribir + '   ·   ya al día: ' + saltados);
  if (!APLICAR) {
    console.log('\nSIMULACRO: NO SE ESCRIBIÓ NADA.');
    console.log('Si lo de arriba está bien, se aplica con:');
    console.log('   node scripts/mudar-ventas-por-plato.cjs --aplicar');
  } else {
    console.log('\nAPLICADO. El campo viejo `menu[].vecesVendido` se ha dejado INTACTO,');
    console.log('a propósito: si algo saliera mal, el número de antes sigue ahí.');
  }
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
