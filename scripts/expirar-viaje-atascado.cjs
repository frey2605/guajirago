/**
 * LOS VIAJES PARADOS EN UN ESTADO QUE SE RETIRA → `expirado`
 *
 *   node scripts/expirar-viaje-atascado.cjs            <- SIMULACRO: no escribe
 *   node scripts/expirar-viaje-atascado.cjs --aplicar  <- escribe de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El 9-sep-2026 se retiraron del mercado dos estados que ya no escribía nadie:
 * `confirmando` y `contraoferta`. Medido con `scripts/medir-estados-muertos.cjs`
 * antes de tocar: UN viaje seguía parado en `contraoferta` desde el 2-jul-2026,
 * tocado por última vez 6 minutos después de nacer.
 *
 * ── 🔴 ESTO NO ES COSMÉTICO, Y HAY QUE CORRERLO ANTES QUE LAS REGLAS ────────
 * La primera versión de esta nota decía que dejar el viaje ahí «no rompe nada».
 * Es FALSO, y lo cazó la segunda opinión. Las reglas de Firestore no filtran una
 * consulta: EVALÚAN `allow read` contra cada documento del resultado, y si UNO
 * solo no pasa, FALLA LA CONSULTA ENTERA.
 *
 * La app del conductor que está PUESTA hoy pide `where('estado','in',[los
 * cuatro])`. Si se despliegan las reglas nuevas con ese viaje todavía en
 * `contraoferta`, a TODO conductor con la app vieja —y una PWA sigue cacheada
 * días— le sale el mercado VACÍO y sin ningún error. No es un viaje que se
 * pierde: es el mercado entero, para todos, hasta que recarguen.
 *
 * Por eso el orden es OBLIGATORIO:  este guion  →  firestore.rules  →  las apps.
 *
 * ── POR QUÉ `expirado` Y NO OTRA COSA ───────────────────────────────────────
 * Es lo que la rutina nocturna (`expirarViajesColgados`, functions/index.js:437)
 * escribe para un viaje abandonado, así que el panel ya sabe pintarlo y no hay
 * estado nuevo que nadie conozca. Y es la verdad: lleva dos meses sin tocarse.
 * SE ESCRIBEN LOS MISMOS TRES CAMPOS QUE ELLA —`estado`, `fechaExpiracion` y
 * `expiradoPor`— para que el viaje quede con la misma forma que los otros ocho
 * que ya están expirados. Dos formas para el mismo estado es el gemelo que
 * prohíbe la SEGUNDA LEY.
 *
 * 🔴 Y LA RAZÓN POR LA QUE ESE VIAJE SIGUE AHÍ, que es un problema APARTE y ya
 * está avisado al dueño: `expirarViajesColgados` solo mira `esperando` y
 * `aceptado`. Un viaje que se quede negociando NO LO LIMPIA NADIE, NUNCA. Hoy
 * es un viaje de prueba; con clientes de verdad sería un pasajero esperando en
 * una pantalla para siempre. Ese arreglo va con sus propios 12 pasos.
 *
 * ── LOS CANDADOS ────────────────────────────────────────────────────────────
 *  1. SIMULACRO por defecto.
 *  2. Solo toca viajes cuyo estado esté en la lista de RETIRADOS. Ninguno más.
 *  3. TECHO: si encuentra más de los medidos, PARA sin escribir. Una herramienta
 *     que escribe y no tiene techo puede vaciar media base por un filtro mal
 *     puesto. Si el techo salta, se vuelve a medir antes de subirlo.
 *  4. `currentDocument.exists=true`: si el documento no existe, el servidor
 *     rechaza la escritura. No se crea nada por accidente.
 *  5. `updateMask` con SOLO los campos que se tocan: el PATCH no reemplaza el
 *     documento entero. Sin esto, un PATCH le borra al viaje todo lo demás.
 *  6. CAREO DE TODA LA COLECCIÓN, no solo de lo tocado: se cuenta que sigan
 *     siendo los mismos viajes, y se compara campo por campo TODOS los que no
 *     se debían tocar. Un careo que solo mira lo que tocaste no puede decir
 *     «todo lo demás, intacto» — y eso era justo lo que decía antes.
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

const RETIRADOS = ['confirmando', 'contraoferta'];
const DESTINO = 'expirado';
// CANDADO 3. Medido el 9-sep-2026: UN viaje. Si algún día hay más, se mide
// primero y se sube a mano, sabiendo cuáles son.
const TECHO = 1;
const QUIEN = 'script:expirar-viaje-atascado 9-sep-2026';
// Los mismos tres campos que escribe `expirarViajesColgados`.
const CAMPOS = ['estado', 'fechaExpiracion', 'expiradoPor'];

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

/**
 * 🔴 ORDENA LAS CLAVES ANTES DE COMPARAR, Y HAY QUE EXPLICAR POR QUÉ.
 *
 * La primera versión de este careo comparaba `JSON.stringify(campos)` a pelo y
 * dio 90 FALSAS ALARMAS la primera vez que se corrió de verdad (9-sep-2026):
 * dijo que se habían tocado 90 viajes que nadie tocó. Firestore NO devuelve los
 * campos en el mismo orden en dos lecturas, así que dos textos distintos pueden
 * ser el mismo documento.
 *
 * Un careo que grita en falso es peor que no tener careo: la próxima vez nadie
 * lo mira. Es la MISMA trampa que ya mordió en `scripts/mudar-negocios.cjs`, y
 * por eso está escrita aquí también.
 *
 * Los ARRAYS se dejan en su orden a propósito: ahí el orden sí significa algo.
 */
function ordenado(v) {
  if (Array.isArray(v)) return v.map(ordenado);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = ordenado(v[k]);
    return o;
  }
  return v;
}
const huella = (campos) => JSON.stringify(ordenado(campos || {}));

(async () => {
  const t = await token();
  const docs = await traer(t, 'viajes');
  const atascados = docs.filter((d) => RETIRADOS.includes(val((d.fields || {}).estado)));

  console.log('');
  console.log(APLICAR
    ? C.neg + '✍  APLICANDO — esto SÍ escribe' + C.off
    : C.neg + '🔍 SIMULACRO — no se escribe nada' + C.off);
  console.log(C.gris + '   viajes en el servidor: ' + docs.length
    + '   ·   parados en un estado retirado: ' + atascados.length + C.off);
  console.log('');

  if (atascados.length === 0) {
    console.log(C.ver + '   No hay nada que mover.' + C.off);
    return;
  }

  // ── CANDADO 3 · EL TECHO ─────────────────────────────────────────────────
  if (atascados.length > TECHO) {
    console.log(C.roj + '   ✋ SE PARA: hay ' + atascados.length + ' viajes atascados y el techo es '
      + TECHO + '.' + C.off);
    console.log('   Cuando se escribió esto se midió UNO. Si ahora hay más, algo');
    console.log('   cambió: puede que alguien esté escribiendo esos estados otra vez.');
    console.log('   Se vuelve a medir antes de subir el techo:');
    console.log('     ' + C.neg + 'node scripts/medir-estados-muertos.cjs' + C.off);
    process.exit(1);
  }

  // El ANTES de TODA la colección, para el careo del final.
  const antes = {};
  for (const d of docs) antes[d.name] = { huella: huella(d.fields), tocado: d.updateTime };
  const tocados = new Set(atascados.map((d) => d.name));

  let movidos = 0, fallos = 0;
  for (const d of atascados) {
    const id = d.name.split('/').pop();
    const f = d.fields || {};
    console.log('   ' + id);
    console.log(C.gris + '     ' + (val(f.pasajeroNombre) || '?') + '  →  ' + (val(f.destino) || '?')
      + '  ·  creado ' + String(d.createTime).slice(0, 10) + C.off);
    console.log('     ' + C.ama + val(f.estado) + C.off + '  →  ' + C.ver + DESTINO + C.off);

    if (!APLICAR) { console.log(''); continue; }

    const mascara = CAMPOS.map((c) => 'updateMask.fieldPaths=' + c).join('&');
    const url = BASE + '/viajes/' + id + '?' + mascara + '&currentDocument.exists=true';
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          estado: { stringValue: DESTINO },
          fechaExpiracion: { stringValue: new Date().toISOString() },
          expiradoPor: { stringValue: QUIEN },
        },
      }),
    });
    if (r.ok) { movidos++; console.log(C.ver + '     ✓ movido' + C.off); }
    else { fallos++; console.log(C.roj + '     ✗ falló: ' + r.status + C.off); }
    console.log('');
  }

  if (!APLICAR) {
    console.log(C.ama + '   Esto era un SIMULACRO. No se escribió nada.' + C.off);
    console.log(C.gris + '   Para hacerlo de verdad: node scripts/expirar-viaje-atascado.cjs --aplicar' + C.off);
    return;
  }

  // ── CANDADO 6 · EL CAREO, DE TODA LA COLECCIÓN ───────────────────────────
  console.log(C.neg + '   CAREO — releyendo los ' + docs.length + ' viajes del servidor' + C.off);
  const despues = await traer(t, 'viajes');

  const problemas = [];
  if (despues.length !== docs.length) {
    problemas.push('había ' + docs.length + ' viajes y ahora hay ' + despues.length);
  }
  for (const d of despues) {
    const nuevo = d.fields || {};
    if (!(d.name in antes)) { problemas.push('apareció un viaje que no estaba: ' + d.name.split('/').pop()); continue; }
    const viejo = antes[d.name];
    const id = d.name.split('/').pop();

    if (tocados.has(d.name)) {
      // Los que SÍ se tocaron: lo prometido, y NADA más.
      if (val(nuevo.estado) !== DESTINO) problemas.push(id + ': el estado no quedó en ' + DESTINO);
      if (val(nuevo.expiradoPor) !== QUIEN) problemas.push(id + ': falta la huella de quién lo movió');
      if (!val(nuevo.fechaExpiracion)) problemas.push(id + ': falta la fecha de expiración');
      // De los que SI se tocaron se compara todo MENOS los tres campos
      // prometidos, con las claves ordenadas.
      const sinLosTres = (campos) => {
        const c = { ...(campos || {}) };
        for (const k of CAMPOS) delete c[k];
        return huella(c);
      };
      const antesDelDoc = docs.find((x) => x.name === d.name);
      if (sinLosTres(antesDelDoc.fields) !== sinLosTres(nuevo)) {
        problemas.push(id + ': cambió algún campo que no eran los tres prometidos');
      }
    } else if (huella(nuevo) !== viejo.huella || d.updateTime !== viejo.tocado) {
      // Los que NO se tocaban: ni una coma. Se miran las dos cosas — el
      // contenido ordenado Y la marca de escritura del servidor. La segunda
      // es la que no se puede discutir: si el updateTime no cambió, ese
      // documento NO se escribió, punto.
      problemas.push(id + ': cambió, y este viaje no se tocaba');
    }
  }
  for (const nombre of Object.keys(antes)) {
    if (!despues.some((d) => d.name === nombre)) problemas.push('DESAPARECIÓ ' + nombre.split('/').pop());
  }

  console.log('');
  console.log(C.neg + '   movidos: ' + movidos + '   fallos: ' + fallos + C.off);
  if (problemas.length === 0 && fallos === 0) {
    console.log(C.ver + '   ✓ los ' + despues.length + ' viajes careados: solo cambió el que tocaba,');
    console.log('     y solo en los tres campos prometidos.' + C.off);
  } else {
    console.log(C.roj + '   ✗ ' + problemas.length + ' problema(s):' + C.off);
    for (const p of problemas) console.log('     · ' + p);
    process.exit(1);
  }
})();
