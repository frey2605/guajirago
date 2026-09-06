/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MEDIR · LOS CLIENTES DEL SOFTWARE QUE SE VENDE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SOLO LECTURA. No escribe ni un campo. Se puede correr las veces que haga
 * falta, y hay que correrlo DOS: antes de tocar nada (paso 1) y otra vez al
 * final (paso 10), para comprobar que lo que no se tocó sigue igual.
 *
 *     node scripts/medir-clientes.cjs
 *
 * QUÉ CONTESTA, y por qué cada pregunta importa para la pantalla de clientes:
 *
 *  · ¿Cuántos negocios hay, y cuántos tienen ficha de cobro? Un negocio sin
 *    ficha es un cliente al que NO se le está cobrando nada.
 *  · ¿Cómo están sus tres llaves? `visibleEnEscaparate` (si sale en la app),
 *    `estadoComercial` (si puede trabajar) y `activo` (si la cuenta está viva)
 *    son TRES cosas distintas a propósito. La pantalla las maneja por separado.
 *  · ¿A quién se le puede avisar de verdad? Los avisos de cobro van por
 *    notificación al `fcmToken` de `restaurantesPrivado`. Un cliente sin token
 *    es un cliente al que la rutina le contaría los días SIN poder avisarle.
 *  · ¿Le falta a alguna ficha un dato de los que hacen falta para castigar?
 *    Sin precio, sin días de gracia o sin días de aviso, la rutina NO toca a
 *    ese cliente: lo manda a la lista de «revisar». Esta cuenta dice cuántos
 *    saldrían en esa lista.
 *  · ¿Ha corrido la rutina de madrugada, y qué dejó apuntado?
 *
 * LA CUENTA DE «LE FALTA ALGO» LA HACE LA CALCULADORA DE VERDAD, no una copia:
 * este guion importa `faltaAlgoParaCastigar` de las funciones. Si un día se
 * cambia la regla allí, esta medición cambia sola. Medir con una calculadora
 * distinta de la que decide es medir otra cosa — y ya pasó en este proyecto.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { faltaAlgoParaCastigar, interruptorQueLeToca } =
  require('../guajirago/functions/cobros.cjs');

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

/**
 * Los campos de un documento, pasados a objeto normal.
 *
 * LAS LISTAS TAMBIÉN CUENTAN, y no es un adorno: la primera versión solo
 * copiaba los campos llanos y tiraba `paraRevisar` —la lista de clientes a los
 * que la rutina NO pudo cobrar— sin que nada lo dijera. Se veían los
 * contadores, y el único dato que hay que mirar de verdad se caía en silencio.
 */
function campos(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) {
    const x = val(v);
    if (x !== undefined) o[k] = x;
    else if (v && v.arrayValue) {
      o[k] = (v.arrayValue.values || [])
        .map((e) => (e.mapValue ? campos(e.mapValue.fields) : val(e)));
    }
  }
  return o;
}

/** Un documento entero, con su id. */
function llano(doc) {
  const o = campos(doc.fields);
  o.__id = doc.name.split('/').pop();
  return o;
}

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
  return { docs: todos.map(llano) };
}

const raya = (t) => console.log('\n' + t + '\n' + '─'.repeat(t.length));
const si = (b) => b ? 'sí' : 'no';

(async () => {
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  console.log('MEDICIÓN DE CLIENTES · ' + hoy + ' (hora de Colombia)');

  const t = await token();
  const negocios = await traer(t, 'restaurantes');
  const fichas = await traer(t, 'suscripciones');
  const privados = await traer(t, 'restaurantesPrivado');
  const rastro = await traer(t, 'logsCobros');

  if (negocios.error) { console.error('no pude leer los negocios: ' + negocios.error); process.exit(1); }

  const fichaDe = new Map(fichas.docs.map((f) => [f.__id, f]));
  const privDe = new Map(privados.docs.map((p) => [p.__id, p]));

  raya('LOS NEGOCIOS: ' + negocios.docs.length);
  for (const n of negocios.docs) {
    const f = fichaDe.get(n.__id);
    const p = privDe.get(n.__id);
    console.log('\n · ' + (n.nombre || '(sin nombre)') + '   [' + n.__id.slice(0, 8) + '…]');
    console.log('     tipo de negocio ..... ' + (n.tipoNegocio || '(no tiene)'));
    console.log('     LAS TRES LLAVES');
    console.log('       sale en el escaparate . '
      + (n.visibleEnEscaparate === undefined ? '(no tiene campo)' : si(n.visibleEnEscaparate)));
    console.log('       puede trabajar ........ '
      + (n.estadoComercial === undefined
        ? '(no tiene campo) → el candado NO lo frena'
        : n.estadoComercial + (n.estadoComercial === 'bloqueado' ? ' → FRENADO' : ' → pasa')));
    console.log('       la cuenta está viva ... '
      + (n.activo === undefined ? '(no tiene campo) → cuenta como viva' : si(n.activo)));
    console.log('     se le puede avisar .... '
      + (p && p.fcmToken ? 'sí' : 'NO — no tiene notificaciones activadas'));
    if (!f) {
      console.log('     FICHA DE COBRO ....... NO TIENE. A este cliente no se le cobra nada.');
      continue;
    }
    console.log('     FICHA DE COBRO');
    console.log('       precio ................ ' + (f.precio === undefined ? '(no tiene)' : f.precio));
    console.log('       estado ................ ' + (f.estado || '(no tiene)'));
    console.log('       próximo cobro ......... ' + (f.proximoCobro || '(no tiene)'));
    console.log('       días de prueba/gracia/aviso  '
      + f.diasDePrueba + ' / ' + f.diasDeGracia + ' / ' + f.diasDeAviso);
    const falta = faltaAlgoParaCastigar(f, hoy);
    console.log('       ¿se le puede cobrar? .. '
      + (falta ? 'NO: le falta ' + falta : 'sí, la ficha está completa'));
    if (f.estado && interruptorQueLeToca(f.estado) !== n.estadoComercial) {
      console.log('       ⚠ DESCUADRE: la ficha dice «' + f.estado + '» (interruptor «'
        + interruptorQueLeToca(f.estado) + '») y el negocio tiene «'
        + (n.estadoComercial === undefined ? '(nada)' : n.estadoComercial) + '»');
    }
  }

  // ── EL RESUMEN, que es lo que se compara en el paso 10 ──────────────────
  const conFicha = negocios.docs.filter((n) => fichaDe.has(n.__id));
  const sinFicha = negocios.docs.filter((n) => !fichaDe.has(n.__id));
  const sinAviso = negocios.docs.filter((n) => !(privDe.get(n.__id) || {}).fcmToken);
  const incompletas = conFicha.filter((n) => faltaAlgoParaCastigar(fichaDe.get(n.__id), hoy));
  const frenados = negocios.docs.filter((n) => n.estadoComercial === 'bloqueado');
  const huerfanas = fichas.docs.filter((f) => !negocios.docs.some((n) => n.__id === f.__id));

  raya('EL RESUMEN');
  console.log('   negocios ............................... ' + negocios.docs.length);
  console.log('   con ficha de cobro ..................... ' + conFicha.length);
  console.log('   SIN ficha (no se les cobra nada) ....... ' + sinFicha.length);
  console.log('   fichas incompletas (irían a «revisar») . ' + incompletas.length);
  console.log('   frenados por el candado ................ ' + frenados.length);
  console.log('   a los que NO se les puede avisar ....... ' + sinAviso.length
    + ' de ' + negocios.docs.length);
  console.log('   fichas sin negocio (huérfanas) ......... ' + huerfanas.length);

  raya('LA RUTINA DE MADRUGADA');
  if (rastro.error) {
    console.log('   nunca ha corrido: la colección `logsCobros` no existe todavía.');
  } else {
    console.log('   noches apuntadas: ' + rastro.docs.length);
    const ult = rastro.docs.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).pop();
    if (ult) {
      console.log('   la última (' + ult.hoy + '): miró ' + ult.fichasMiradas
        + ', tocó ' + ult.tocados + ', avisó ' + ult.avisados);
      // A QUIÉN NO SE LE PUDO COBRAR. Es lo único de todo el rastro que pide una
      // decisión de una persona: la rutina no toca a estos clientes.
      const pendientes = ult.paraRevisar || [];
      if (pendientes.length === 0) {
        console.log('   nadie quedó pendiente de revisar.');
      } else {
        console.log('   ⚠ ' + pendientes.length + ' PARA REVISAR — a estos no se les cobró:');
        for (const r of pendientes) {
          const quien = negocios.docs.find((n) => n.__id === r.negocioId);
          console.log('      · ' + ((quien && quien.nombre) || r.negocioId)
            + ' — ' + r.porQue);
        }
      }
    }
  }

  // Una sola línea, fácil de comparar de un vistazo entre el paso 1 y el 10.
  raya('LA HUELLA (esto es lo que se carea al final)');
  console.log('   negocios=' + negocios.docs.length
    + ' fichas=' + fichas.docs.length
    + ' conFicha=' + conFicha.length
    + ' incompletas=' + incompletas.length
    + ' frenados=' + frenados.length
    + ' sinAviso=' + sinAviso.length
    + ' huerfanas=' + huerfanas.length
    + ' noches=' + (rastro.error ? 0 : rastro.docs.length));
})().catch((e) => { console.error('\nFALLÓ: ' + e.message); process.exit(1); });
