/**
 * EL BOTÓN DE EMERGENCIA DEL MAPA — el 🚨 que se aprieta DURANTE el viaje
 *
 *   node scripts/medir-boton-del-mapa.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que correrá el PASO 12.
 *
 * ── CUÁL ES ESTE BOTÓN Y CUÁL NO ────────────────────────────────────────────
 * Éste: el 🚨 rojo que flota arriba a la derecha del mapa en `fase1` y `fase2`
 * —o sea, desde que un conductor acepta hasta que el viaje termina—. Abre un
 * panel y de ahí se manda el mensaje: `compartirSeguridad`, en `Solicitar.js`.
 *
 * (Sin número de renglón A PROPÓSITO. La primera versión de este archivo decía
 * `:772`, y el propio arreglo lo movió a `:804` el mismo día: un número dentro
 * de un comentario nace viejo. El nombre de la función no se mueve.)
 *
 * NO éste: el «compartir mi ubicación» de la pantalla de Ajustes
 * (`Seguridad.js` + `mensajeEmergencia.js`), que se arregló el 12-sep-2026.
 * Ése es el PREVENTIVO, antes de salir. Confundirlos es lo que mantuvo este
 * escondido: durante un día entero llamé «botón de pánico» al de Ajustes.
 * El guion de ése es `medir-silencios-seguridad.cjs`.
 *
 * ── LO QUE MIDE, Y POR QUÉ CADA COSA ────────────────────────────────────────
 *
 * 1. CUÁNTOS VIAJES NACIERON CON EL CENTRO DE RIOHACHA COMO UBICACIÓN.
 *    Es la medida que importa. `Solicitar.js` arranca con
 *    `useState(centroRiohacha)` y, si el GPS falla dos veces, VUELVE a poner
 *    `centroRiohacha` a propósito (para que el mapa no salga en blanco, que
 *    para el mapa está bien). El problema es que el botón de emergencia no
 *    puede distinguir ese relleno de un GPS de verdad: manda
 *    «📍 *Mi ubicación:* https://maps.google.com/?q=11.5444,-72.9072» con la
 *    misma seguridad que si fuera cierto.
 *
 *    Y eso NO es un silencio: es una MENTIRA. Un silencio deja a quien lo
 *    recibe sin saber; esto lo manda a la plaza de Riohacha a buscar a alguien
 *    que puede estar en cualquier otro sitio. Se mide contando los viajes cuyo
 *    `pasajeroLat`/`pasajeroLng` son EXACTAMENTE los del centro: cada uno es
 *    una vez que el relleno se usó de verdad.
 *
 * 2. CUÁNTOS PASAJEROS PODRÍAN MANDAR LA FOTO DEL CONDUCTOR ANTERIOR.
 *    `datosConductor` (la foto y el color del carro) se llena cuando el viaje
 *    trae esos campos y NUNCA se vuelve a vaciar. Un pasajero con dos viajes,
 *    el primero con foto y el segundo sin ella, manda en el segundo la foto
 *    del conductor del primero. Se mide: pasajeros con 2+ viajes con conductor,
 *    donde alguno trae foto o color.
 *
 * 3. CUÁNTA GENTE DEPENDE DEL BOTÓN. Los usuarios con contacto de confianza
 *    guardado (`usuarios/{uid}.contactoConfianzaNumero`). Si el `catch` que
 *    carga ese número falla —y estuvo MUDO hasta el 12-sep-2026— el botón abre
 *    WhatsApp SIN DESTINATARIO y no dice por qué.
 *
 * 4. EL CAREO DEL CÓDIGO. Lo de arriba solo vale si la pantalla sigue como
 *    cuando se midió, así que el guion comprueba uno por uno los fallos que
 *    dice medir. Cuando el arreglo está puesto, esas líneas pasan de PUESTO a
 *    ARREGLADO — y eso es lo que se quiere ver en el paso 12.
 *
 *    🔴 Y LOS QUE PUEDEN, **EJECUTAN** EN VEZ DE LEER. Los marcados
 *    «(ejecutado)» cargan `mensajeEmergencia.js` —que es puro— y miran el TEXTO
 *    que sale. La primera versión los buscaba con expresiones regulares dentro
 *    de `compartirSeguridad`, y el propio arreglo mudó esas líneas a otro
 *    archivo: tres detectores se quedaron diciendo «arreglado» con el fallo
 *    puesto, y el guion remataba con «✓ los 8 están arreglados». Un VERDE FALSO
 *    es peor que un rojo falso: el rojo hace mirar, el verde hace cerrar el
 *    asunto. Un detector que ejecuta no se queda viejo cuando el código se
 *    mueve de sitio. Lo cazó la segunda opinión.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/Solicitar.js';

// El centro que se usa de relleno. Sale del archivo de verdad, no de una copia:
// si alguien lo mueve, este guion mide el nuevo sin que haya que tocarlo.
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { centroRiohacha } = cargarDeLaApp('guajirago/src/riohacha.js');

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};

const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length));

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 200));
  return x.access_token;
}

/** Los documentos de una colección, con sus campos. SOLO LEE. */
async function traer(sesion, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + sesion } });
    if (!r.ok) throw new Error('no pude leer ' + coleccion + ': ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

/** El valor de un campo, como lo envuelve la API de Firestore. */
const val = (v) => {
  if (v == null) return undefined;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  return undefined;
};

// ── 4 · EL CAREO DEL CÓDIGO ────────────────────────────────────────────────
// Cada fila: qué fallo es, y cómo se reconoce que SIGUE PUESTO. Se mira el
// código sin comentarios, para que un comentario no cuente como código.
const { soloCodigo, sinTextos, cuerpoDeLaFuncion, trozoDelTry }
  = require('../pruebas/cargar.cjs');

const pantalla = fs.existsSync(path.join(RAIZ, PANTALLA))
  ? soloCodigo(fs.readFileSync(path.join(RAIZ, PANTALLA), 'utf8')) : '';
const desde = pantalla.indexOf('const compartirSeguridad');
const fn = desde >= 0 ? cuerpoDeLaFuncion(pantalla, desde) : null;
const cuerpo = fn ? fn.texto : '';

// El texto del mensaje ya no vive en la pantalla: vive en su archivo. Así que
// lo que dice el mensaje se mira ALLÍ. La primera versión de este guion lo
// buscaba dentro de `compartirSeguridad`, y cuando el arreglo lo mudó de sitio
// siguió diciendo «PUESTO» — un detector que se quedó viejo y daba una alarma
// falsa. Lo cazó el careo del paso 7, comparando lo que decía con el código.
const MENSAJE = 'guajirago/src/mensajeEmergencia.js';
const elMensaje = fs.existsSync(path.join(RAIZ, MENSAJE))
  ? soloCodigo(fs.readFileSync(path.join(RAIZ, MENSAJE), 'utf8')) : '';

/** Los cuerpos de los `catch` de la pantalla, con el `try` que protegen. */
function losCatch() {
  const seguro = sinTextos(pantalla);
  const BLOQUE = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  const fuera = [];
  let m;
  while ((m = BLOQUE.exec(seguro)) !== null) {
    const abre = m.index + m[0].length - 1;
    let hondo = 0;
    let j = abre;
    for (; j < seguro.length; j += 1) {
      if (seguro[j] === '{') hondo += 1;
      else if (seguro[j] === '}') { hondo -= 1; if (hondo === 0) break; }
    }
    fuera.push({
      cuerpo: pantalla.slice(abre + 1, j),
      suTry: trozoDelTry(pantalla, m.index),
      renglon: pantalla.slice(0, m.index).split('\n').length,
    });
    BLOQUE.lastIndex = j + 1;
  }
  return fuera;
}
const CATCHES = losCatch();
// QUÉ CUENTA COMO AVISAR EN ESTA PANTALLA. Se incluye `setAvisoOcupado`, que
// pinta la ventanita de «No se pudo confirmar · Intenta de nuevo en un
// momento»: la primera versión no lo conocía y contaba como MUDO un `catch` que
// sí avisa, así que el guion decía 8 donde hay 7. Un contador que acusa de más
// gasta el tiempo de alguien buscando un agujero que no existe — y la próxima
// vez ya no se le cree. Lo cazó la segunda opinión del 12-sep-2026.
const avisa = (c) => /setAviso\s*\(|setAvisoOcupado\s*\(\s*['"][^'"]+|setAvisoFaltan\s*\(|setAvisoLimite\s*\(\s*true|setError\s*\(\s*['"][^'"]{10,}|guardarRechazo\s*\(/.test(c);
// EL DEL CONTACTO, buscado POR LO QUE PROTEGE, no por ser el primero vacío.
// La primera versión miraba si había ALGÚN `catch (e) {}` en la pantalla y lo
// llamaba «el del contacto». Había seis más, de otras cosas, así que decía
// PUESTO con el del contacto ya arreglado. Una etiqueta que miente.
const elDelContacto = CATCHES.find((c) => /contactoConfianzaNumero/.test(c.suTry));

// ── LO QUE DICE EL MENSAJE SE MIDE EJECUTÁNDOLO, NO LEYÉNDOLO ──────────────
//
// 🔴 ESTO ES LA CORRECCIÓN DE UN FALLO DE ESTE MISMO GUION. La primera versión
// buscaba con expresiones regulares, DENTRO de `compartirSeguridad`, cosas que
// el arreglo acababa de mudar a `mensajeEmergencia.js`. Resultado: tres
// detectores decían «arreglado» con el fallo puesto —`if (viaje)` por
// `if (true)`, el `else` por `else if (false)`— y el guion remataba con
// «✓ los 8 están arreglados». Un VERDE FALSO, que es peor que el rojo falso
// que tenía antes: el rojo hace mirar, el verde hace cerrar el asunto. Y es la
// misma enfermedad que la cabecera de este archivo presume de haber curado.
// Lo cazó la segunda opinión del 12-sep-2026.
//
// El archivo del mensaje es PURO —sin red, sin React— así que se puede cargar y
// ejecutar. Un detector que ejecuta no se queda viejo cuando el código se mueve.
const { cargarDeLaApp: cargar } = require('../pruebas/cargar.cjs');
let armar = null;
try {
  ({ armarMensajeDeEmergencia: armar } = cargar('guajirago/src/mensajeEmergencia.js'));
} catch (e) {
  armar = null;
}
const conMapa = { lat: 11.5424, lng: -72.9019 };
/** Arma un mensaje del botón del mapa, o `null` si el archivo no se pudo cargar. */
const texto = (ubicacion, viaje, fallo) => (armar
  ? armar({ desde: 'enViaje', ubicacion, viaje, fallo: fallo || null }) : null);
/**
 * ¿Sale este encabezado sin nada debajo?
 *
 * SE MIRA SOLO HASTA EL SIGUIENTE BLOQUE, no hasta el final del mensaje. La
 * primera versión miraba todo lo que venía detrás, así que un «MI RUTA» pelado
 * seguido de «DATOS DEL CONDUCTOR» nunca parecía vacío: el detector daba
 * ARREGLADO con el fallo puesto, y el guion remataba con «✓ los 12 están
 * arreglados». Otro VERDE FALSO, cazado por la segunda opinión — la misma
 * enfermedad que esta cabecera presume de haber curado, en el detector de al
 * lado. Los bloques van separados por un renglón en blanco.
 */
const peladoEl = (t, cabeza) => {
  const i = t.indexOf(cabeza);
  if (i < 0) return false;
  const detras = t.slice(i + cabeza.length);
  const corte = detras.indexOf('\n\n');
  const suyo = corte < 0 ? detras : detras.slice(0, corte);
  return suyo.replace(/[\s*]/g, '').length === 0;
};

const FALLOS = [
  ['la ubicación se manda sin comprobar si es de verdad',
    () => !/\?[\s\S]*:\s*null/.test(cuerpo) || !/ubicacion\s*:/.test(cuerpo),
    'manda el centro de Riohacha como tu sitio cuando el GPS falla'],
  ['y el mensaje no dice nada cuando no la tiene   (ejecutado)',
    () => !armar || !/No pude obtener mi ubicaci/.test(texto(null, null, null)),
    'el de Ajustes sí lo dice; éste se callaba'],
  ['manda un enlace de mapa sin tener ubicación   (ejecutado)',
    () => !armar || /maps\.google\.com/.test(texto(null, null, null)),
    'un enlace que parece bueno y lleva al sitio equivocado'],
  ['el encabezado «MI RUTA» sale pelado   (ejecutado)',
    () => !armar || peladoEl(texto(conMapa, { conductorId: 'x' }, null), 'MI RUTA'),
    'un encabezado vacío en un mensaje de emergencia hace dudar de todo'],
  ['el conductor se manda sin comprobar que haya conductor   (ejecutado)',
    () => !armar || /DATOS DEL CONDUCTOR/.test(texto(conMapa, { origen: 'Cl. 16' }, null)),
    'el dueño lo mandó arreglar el 11-sep: «tu ruta sí, conductor no»'],
  ['la foto y el color salen de `datosConductor`, que nunca se vacía',
    () => /datosConductor/.test(cuerpo),
    'se puede mandar la foto del conductor del viaje ANTERIOR'],
  // EL TEXTO QUE SE MANDA TIENE QUE SER EL QUE SE ARMÓ. No basta con que la
  // llamada esté en la función: un señuelo —la llamada buena guardada en una
  // variable que nadie usa, y el texto de verdad hecho a mano al lado— dejaba
  // este detector en verde. Se carean los dos nombres.
  ['el texto que se manda NO es el que arma el archivo probado',
    () => {
      if (/texto\s*\+=/.test(cuerpo) || /📍|🛣|🚗/.test(cuerpo)) return true;
      const armado = /(?:const|let|var)\s+(\w+)\s*=\s*armarMensajeDeEmergencia\s*\(/.exec(cuerpo);
      const mandado = /encodeURIComponent\s*\(\s*(\w+)\s*\)/.exec(cuerpo);
      return !armado || !mandado || armado[1] !== mandado[1];
    },
    'así no hay forma de PROBAR lo que de verdad le llega al familiar'],
  ['sin contacto, WhatsApp abre a ciegas y no se dice',
    () => !/setAviso\s*\(/.test(cuerpo),
    'el pasajero se encuentra eligiendo un contacto a mano, sin saber por qué'],
  ['el aviso está escrito pero no se llega a él',
    () => !/if\s*\(\s*!\s*\w+\s*\)\s*\{[\s\S]{0,500}?setAviso/.test(cuerpo),
    'un `if (false)` deja el texto en el archivo y el aviso no sale nunca'],
  ['la ventanita se pinta y la página se va antes (no se ve)',
    () => /window\.location\.href\s*=/.test(cuerpo),
    '`location.href` navega de inmediato: el aviso queda de adorno'],
  ['el `catch` que carga el contacto de confianza es MUDO',
    () => !elDelContacto || !avisa(elDelContacto.cuerpo),
    'si falla, WhatsApp abre SIN DESTINATARIO y no se dice por qué'],
  ['el botón del panel ya no llama a la función',
    () => !/onClick\s*=\s*\{[^}]*compartirSeguridad\s*\(\s*\)/.test(pantalla),
    'el 🚨 se aprieta y no pasa nada, sin que nada avise'],
];

(async () => {
  console.log('');
  console.log(C.neg + '  EL BOTÓN DE EMERGENCIA DEL MAPA' + C.off);
  console.log(C.gris + '  el 🚨 rojo que se aprieta DURANTE el viaje · ' + PANTALLA + C.off);
  console.log(C.gris + '  (NO es el de Ajustes: ése es medir-silencios-seguridad.cjs)' + C.off);
  console.log('');

  // ── EL CÓDIGO ────────────────────────────────────────────────────────────
  console.log('  ' + C.neg + 'LO QUE DICE EL CÓDIGO DE HOY' + C.off);
  if (!fn) {
    console.log(C.roj + '    ✗ no encuentro `compartirSeguridad` en ' + PANTALLA + C.off);
    console.log(C.gris + '      (si se renombró, hay que actualizar este guion)' + C.off);
  } else {
    let puestos = 0;
    for (const [que, sigue, porQue] of FALLOS) {
      const hay = sigue();
      if (hay) puestos += 1;
      console.log('    ' + (hay ? C.roj + 'PUESTO   ' : C.ver + 'arreglado') + C.off + '  ' + que);
      if (hay) console.log(C.gris + '                 ' + porQue + C.off);
    }
    console.log('');
    console.log(puestos === 0
      ? C.ver + '    ✓ los ' + FALLOS.length + ' están arreglados' + C.off
      : C.ama + '    ⚠ siguen puestos ' + puestos + ' de ' + FALLOS.length + C.off);
    // Y LO QUE ESTE VERDE NO QUIERE DECIR, dicho aquí para que nadie se confíe.
    // Este guion mide los 12 fallos concretos que el arreglo del 12-sep-2026
    // vino a cerrar: sirve para el paso 1 y para el paso 12. NO es un vigilante.
    // Quien vigila a diario es el amarre, que corre en cada `npm test` y ve
    // muchas más formas de romperlo que este guion. (Una versión anterior de
    // esta nota decía «el amarre las ve las 13»; para cuando la escribí ya no
    // era verdad, porque la segunda opinión encontró cinco más. Poner un
    // número en un comentario es firmarlo para siempre.)
    console.log(C.gris + '      (esto mide ESOS ' + FALLOS.length + ', para el paso 1 y el '
      + '12. Quien vigila a diario es' + C.off);
    console.log(C.gris + '       `pruebas/amarres.test.js`, «EL BOTÓN DEL MAPA · no se '
      + 'inventa dónde estás».)' + C.off);
  }

  // ── Y LO QUE NO ES DE ESTE TRABAJO, PERO SE DICE ────────────────────────
  // PRIMERA LEY: si al arreglar aparece otro problema, se ANOTA y se le dice
  // al dueño. Esta pantalla tiene más `catch` callados, de otras cosas —la
  // configuración, el descuento, los favoritos—. No se tocan aquí, pero el
  // guion los cuenta para que no se pierdan de vista.
  const otrosMudos = CATCHES.filter((c) => !avisa(c.cuerpo)
    && !(elDelContacto && c.renglon === elDelContacto.renglon));
  if (otrosMudos.length > 0) {
    console.log('');
    console.log('  ' + C.ama + 'ANOTADO (no es de este trabajo): ' + otrosMudos.length
      + ' `catch` más se quedan callados' + C.off);
    // Y SE DICE QUÉ PROTEGE CADA UNO, sacado del `try`. Una lista de números de
    // renglón se queda vieja en la siguiente edición —y entonces la nota
    // miente—; el nombre de lo que se estaba haciendo, no.
    for (const c of otrosMudos) {
      const pistas = (c.suTry.match(
        /getDocs?|updateDoc|addDoc|setDoc|deleteDoc|geocode|obtenerTokenFCM|httpsCallable/g)
        || []);
      const nombres = (c.suTry.match(/['"]([a-zA-Z]{3,24})['"]/g) || [])
        .map((x) => x.slice(1, -1)).slice(0, 2);
      console.log(C.gris + '      ~' + pad(c.renglon, 6)
        + pad([...new Set(pistas)].join(' ') || '(sin llamada)', 22)
        + (nombres.length ? '· ' + nombres.join(', ') : '') + C.off);
    }
    console.log(C.gris + '    Son de otras cosas de la pantalla. Cada uno pide su propio '
      + 'arreglo, con permiso.' + C.off);
  }

  // ── LOS DATOS VIVOS ──────────────────────────────────────────────────────
  console.log('');
  console.log('  ' + C.neg + 'Y EN EL SERVIDOR (solo lectura)' + C.off);
  let sesion;
  try {
    sesion = await token();
  } catch (e) {
    console.log(C.ama + '    ⚠ sin sesión de firebase: ' + e.message + C.off);
    console.log(C.gris + '      (corre `npx firebase login` y vuelve a medir)' + C.off);
    console.log('');
    return;
  }

  const viajes = await traer(sesion, 'viajes');
  const usuarios = await traer(sesion, 'usuarios');

  // 1 · los que nacieron con el relleno
  const esElCentro = (v) => {
    const la = val((v.fields || {}).pasajeroLat);
    const ln = val((v.fields || {}).pasajeroLng);
    return typeof la === 'number' && typeof ln === 'number'
      && la === centroRiohacha.lat && ln === centroRiohacha.lng;
  };
  const conRelleno = viajes.filter(esElCentro);
  console.log('    ' + pad('nacidos en el centro', 26)
    + pad(conRelleno.length + ' de ' + viajes.length, 12)
    + C.gris + 'viajes con el relleno (' + centroRiohacha.lat + ', '
    + centroRiohacha.lng + ')' + C.off);
  if (conRelleno.length > 0) {
    console.log(C.roj + '      🔴 cada uno es una vez que el GPS no se consiguió. Si en ese '
      + 'viaje se aprieta' + C.off);
    console.log(C.roj + '         el 🚨, el mensaje manda la plaza de Riohacha como «mi '
      + 'ubicación».' + C.off);
  }

  // 2 · la foto pegada del conductor anterior
  const porPasajero = {};
  for (const v of viajes) {
    const f = v.fields || {};
    if (!val(f.conductorId)) continue;
    const p = val(f.pasajeroId);
    if (!p) continue;
    (porPasajero[p] = porPasajero[p] || []).push({
      foto: val(f.conductorFoto) || '', color: val(f.conductorColor) || '',
    });
  }
  const enRiesgo = Object.entries(porPasajero).filter(([, l]) => l.length >= 2
    && l.some((x) => x.foto || x.color));
  console.log('    ' + pad('foto pegada del anterior', 26)
    + pad(enRiesgo.length + ' de ' + Object.keys(porPasajero).length, 12)
    + C.gris + 'pasajeros con 2+ viajes y foto/color en alguno' + C.off);

  // 3 · quién depende del botón
  const conContacto = usuarios.filter(
    (u) => (val((u.fields || {}).contactoConfianzaNumero) || '').trim() !== '');
  console.log('    ' + pad('con contacto guardado', 26)
    + pad(conContacto.length + ' de ' + usuarios.length, 12)
    + C.gris + 'usuarios a los que este botón les serviría' + C.off);

  // 4 · cuántos viajes llegaron a tener el botón en pantalla
  const conConductor = viajes.filter((v) => val((v.fields || {}).conductorId));
  console.log('    ' + pad('llegaron a fase1/fase2', 26)
    + pad(conConductor.length + ' de ' + viajes.length, 12)
    + C.gris + 'viajes con conductor: el botón SÍ estuvo en pantalla' + C.off);
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
