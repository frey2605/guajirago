/**
 * LOS SILENCIOS DE LA PANTALLA DE SEGURIDAD (Ajustes · compartir ubicación)
 *
 * 🔴 NO ES EL BOTÓN DE PÁNICO, y llamarlo así fue mi error. El de pánico es el
 * 🚨 rojo que flota sobre el mapa durante el viaje, y arma su propio mensaje a
 * mano en `Solicitar.js:772`. Esta pantalla es el compartir PREVENTIVO, el que
 * se abre desde Ajustes antes de que pase nada. Ponerle el nombre del otro es
 * justo lo que mantuvo al otro invisible. Lo cazó la segunda opinión.
 *
 *   node scripts/medir-silencios-seguridad.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── QUÉ CUENTA ──────────────────────────────────────────────────────────────
 * REGLA 9 del dueño: «Nada se rechaza en silencio.» Este guion cuenta, en
 * `guajirago/src/Seguridad.js`, cuántas cosas pueden fallar sin que NADIE se
 * entere — ni el pasajero en la pantalla, ni el familiar que recibe el mensaje.
 *
 * Y no lo cuenta leyendo comentarios: parte el archivo por cada `catch`, mira
 * si dentro hay algo que avise, y comprueba que la cuenta le cuadre.
 *
 * ── LO QUE SE MIDIÓ EL 12-sep-2026, ANTES DE ARREGLARLO ─────────────────────
 * LOS TRES `catch` DE LA PANTALLA, uno por uno:
 *   1. cargar el contacto de confianza ... MUDO. Si falla, los campos salen
 *      vacíos y el pasajero cree que no tiene contacto guardado.
 *   2. GUARDAR el contacto .............. ya avisaba («Error al guardar»).
 *   3. buscar el viaje en curso ......... MUDO, y nada lo decía. El mensaje
 *      salía sin ruta y sin conductor.
 *
 * Y APARTE, que este guion NO mira: el fallo de la ubicación no es un `catch`,
 * es un `() => {}` (el segundo argumento de `getCurrentPosition`). Ése ya se
 * hacía bien —el mensaje dice «no pude obtener mi ubicación»— y por eso se
 * comprueba abajo, en la sección del mensaje, y no aquí arriba. La cabecera
 * anterior lo listaba como si fuera un `catch`, y el «2 mudos» salía bien de
 * casualidad. Lo cazó la segunda opinión.
 *
 * 🔴 LO GRAVE NO ES QUE FALTE EL DATO. Es que quien recibe el mensaje no puede
 * distinguir «no iba en ningún viaje» de «no se pudo comprobar». Para alguien
 * que te está buscando, esas dos cosas no se parecen en nada.
 *
 * ── Y EN EL SERVIDOR · DOS ERRORES MÍOS, UNO DETRÁS DEL OTRO ───────────────
 * 1. La primera versión dejaba los números ESCRITOS aquí arriba y no los
 *    consultaba. El paso 12 habría repetido la frase sin comprobarla, que es
 *    justo lo que los 12 pasos prohíben: «un veredicto sin medir es una
 *    suposición».
 * 2. Al ponerme a medirlos, conté la colección `contactosEmergencia` — que
 *    **NO EXISTE**. No la escribe nadie: solo aparecía en este guion. El
 *    contacto de confianza se guarda en `usuarios/{uid}`, en los campos
 *    `contactoConfianzaNombre` y `contactoConfianzaNumero` (los escribe el
 *    `setDoc` de `guardarContacto`, en `Seguridad.js`).
 *    O sea que mi «0» era 0 POR CONSTRUCCIÓN, y de ese 0 saqué la conclusión
 *    «esto nunca se ha usado de verdad todavía» — que es FALSA. Medido bien,
 *    la mayoría de los usuarios ya tiene su contacto guardado.
 *    Un contador que mide una colección vacía es peor que no tener contador:
 *    da un cero tranquilizador para siempre. Las dos las cazó la segunda
 *    opinión del 12-sep-2026.
 *
 * Ahora se cuentan los usuarios CON contacto guardado, y la bandeja de rechazos
 * (`rechazos`, que sí existe: la escribe `guardarRechazo.js`). Solo lectura. Si
 * no hay sesión de `firebase` abierta, lo dice y sigue con la parte del código.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/Seguridad.js';
const MENSAJE = 'guajirago/src/mensajeEmergencia.js';

// ── LA SESIÓN DE FIRESTORE, PRESTADA DEL CLI (igual que medir-panico.cjs) ───
const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

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

/** Los documentos de una colección, con sus campos. SOLO LEE. */
async function traer(sesion, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300'
      + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + sesion } });
    if (!r.ok) throw new Error('no pude leer ' + coleccion + ': ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

/** El valor de un campo, como lo envuelve la API de Firestore. */
const val = (v) => (v == null ? undefined : v.stringValue);

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};

const leer = (rel) => {
  const f = path.join(RAIZ, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

/**
 * Los dos ayudantes salen de `pruebas/cargar.cjs`, que es el sitio compartido:
 *   · `soloCodigo` quita los comentarios, para no contar lo que dice un comentario.
 *   · `sinTextos` vacía lo que va entre comillas SIN cambiar la longitud.
 */
const { soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

/**
 * El cuerpo de cada `catch (...) { ... }` del archivo, en orden.
 *
 * LAS LLAVES SE CUENTAN SOBRE EL TEXTO SIN CADENAS. La primera versión las
 * contaba a pelo, y un `console.log('algo { raro')` le descuadraba la cuenta y
 * la dejaba salirse del catch. Ese ayudante ya existía y no lo usaba.
 * (`sinTextos` deja la MISMA longitud, así que los renglones siguen cuadrando
 * y el trozo que se enseña se corta del original, con sus textos dentro.)
 *
 * 🔴 ESTE RECORRIDO ESTÁ ESCRITO DOS VECES: aquí y en `pruebas/amarres.test.js`
 * («ningún `catch` se queda callado»). `pruebas/cargar.cjs` ya tiene el hermano
 * pequeño —`cuerpoDelCatch`, que saca UN catch de DENTRO de UNA función— y
 * usa el mismo `sinTextos`; lo que falta allí es esto: TODOS los catch de un
 * archivo. Ahí debería vivir, y mudarlo es trabajo aparte con su permiso
 * (`cargar.cjs` no está en la foto). Queda ANOTADO en CLAUDE.md.
 *
 * Mientras estén los dos: SI TOCAS UNO, TOCA EL OTRO. Y no es un consejo: ya
 * se separaron DOS veces el mismo día que nacieron. Primero el criterio —este
 * daba por bueno un `console.error` y el amarre lo prohíbe—, y después el
 * recorrido: arreglé aquí el descuadre de las llaves y dejé el amarre con el
 * fallo, así que una llave dentro de un texto lo cegaba y el amarre seguía
 * verde con el arreglo deshecho. Las dos las cazó la segunda opinión.
 * Hay un amarre que ahora los obliga a decir lo mismo.
 */
const BLOQUE_CATCH = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;

function catches(texto) {
  const seguro = sinTextos(texto);
  const fuera = [];
  let m;
  BLOQUE_CATCH.lastIndex = 0;
  while ((m = BLOQUE_CATCH.exec(seguro)) !== null) {
    const abre = m.index + m[0].length - 1;
    let hondo = 0, j = abre;
    for (; j < seguro.length; j++) {
      if (seguro[j] === '{') hondo++;
      else if (seguro[j] === '}') { hondo--; if (hondo === 0) break; }
    }
    fuera.push({ desde: m.index, cuerpo: texto.slice(abre + 1, j) });
    BLOQUE_CATCH.lastIndex = j + 1;
  }
  // ¿LE CUADRA LA CUENTA? Si el contador se sale de sitio mira de MENOS y no
  // se queja: da un número más bajo y suena tranquilizador. Así que se compara
  // con los bloques `catch {` que hay. Se buscan BLOQUES y no la palabra a
  // secas porque un `.catch(avisar)` no lleva llave detrás, y con la palabra
  // suelta el contador se agarraba una llave de más adelante.
  const cuantas = (seguro.match(/\bcatch\s*(?:\([^)]*\))?\s*\{/g) || []).length;
  if (fuera.length !== cuantas) {
    fuera.descuadre = 'la palabra `catch` sale ' + cuantas + ' veces y solo se pudieron '
      + 'mirar ' + fuera.length + ' cuerpos';
  }
  const gordo = fuera.find((c) => c.cuerpo.length > 1500);
  if (gordo) {
    fuera.descuadre = 'un catch salió con ' + gordo.cuerpo.length + ' letras dentro: el '
      + 'contador se salió y se tragó media pantalla, así que los demás no se miraron';
  }
  return fuera;
}

const pad = (s, n) => String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length);

const t = soloCodigo(leer(PANTALLA) || '');
const cs = catches(t);

console.log('');
console.log(C.neg + '  LOS SILENCIOS DE LA PANTALLA DE SEGURIDAD' + C.off);
console.log(C.gris + '  (Ajustes · compartir ubicación. NO es el botón de pánico del mapa)' + C.off);
console.log(C.gris + '  ' + PANTALLA + C.off);
console.log('');

let mudos = 0;
cs.forEach((c, n) => {
  // ¿AVISA AL PASAJERO? Las tres reglas son las MISMAS que las del amarre, y
  // hay una prueba que lo obliga (ver la nota de `catches`). Tres formas de
  // callarse que NO cuentan:
  //   · `console.error(e)` — el pasajero no abre la consola.
  //   · `setError('')` — la cadena vacía no pinta nada.
  //   · `setMensaje('Listo ✅')` — pinta en verde de éxito un fallo.
  //   · Y SÍ cuenta la ventanita, que es como manda avisar el dueño.
  const avisaAlPasajero = /setError\s*\(\s*['"][^'"]{10,}/.test(c.cuerpo)
    || /set(?:Aviso|Modal)\s*\(\s*\{[^}]*texto\s*:\s*['"][^'"]{10,}/.test(c.cuerpo);
  const marcaElFallo = /fallo\s*(?:\|\|)?=[^;]*'[a-z]+'/.test(c.cuerpo);
  const vaALaBandeja = /guardarRechazo\s*\(/.test(c.cuerpo);
  const avisa = avisaAlPasajero || marcaElFallo || vaALaBandeja;
  const vacio = c.cuerpo.trim() === '';
  if (!avisa) mudos++;
  const antes = t.slice(0, c.desde);
  const renglon = antes.split('\n').length;
  console.log('    catch #' + (n + 1) + '  (renglón ~' + renglon + ')  '
    + (avisa ? C.ver + 'avisa' + C.off : C.roj + 'MUDO' + C.off)
    + (vacio ? C.gris + '   (vacío del todo)' + C.off : ''));
  if (!avisa) {
    const trozo = c.cuerpo.trim().slice(0, 60).replace(/\s+/g, ' ');
    console.log(C.gris + '        dentro: ' + (trozo || '(nada)') + C.off);
  }
});

// ── ¿Y EL MENSAJE DICE LO QUE FALTA? ──────────────────────────────────────
console.log('');
console.log('  ' + C.neg + '¿EL MENSAJE AVISA DE LO QUE NO PUDO CONSEGUIR?' + C.off);
const mensaje = leer(MENSAJE);
const donde = mensaje !== null ? soloCodigo(mensaje) : t;
console.log('    ' + pad('la ubicación', 24)
  + (/No pude obtener mi ubicaci/.test(donde) ? C.ver + '✓ lo dice' + C.off : C.roj + '✗ se calla' + C.off));
console.log('    ' + pad('el viaje / el conductor', 24)
  + (/No pude (comprobar|consultar|obtener) (los datos de )?mi viaje/i.test(donde)
    ? C.ver + '✓ lo dice' + C.off : C.roj + '✗ se calla' + C.off));
console.log('    ' + pad('el armado, en su archivo', 24)
  + (mensaje !== null ? C.ver + '✓ sí (se puede probar)' + C.off
    : C.ama + '✗ dentro del componente (no se puede probar)' + C.off));

console.log('');
if (cs.descuadre) {
  // Y AQUÍ NO SE DA NINGÚN VEREDICTO. La primera versión imprimía el
  // descuadre y justo debajo «✓ ningún catch se queda callado» — las dos
  // cosas a la vez, y la de abajo en verde. Quien lo lea rápido se queda con
  // el verde. Si el contador no cuadra, no hay número que dar.
  console.log(C.roj + '  ✗ EL CONTADOR NO CUADRA: ' + cs.descuadre + C.off);
  console.log(C.roj + '    NO HAY VEREDICTO. Lo de arriba mira de menos; arregla el '
    + 'recorrido y vuelve a medir.' + C.off);
} else {
  console.log(mudos === 0
    ? C.ver + '  ✓ ningún catch se queda callado.' + C.off
    : C.ama + '  ⚠ ' + mudos + ' catch se quedan callados.' + C.off);
}

// ── LO QUE HAY EN EL SERVIDOR ─────────────────────────────────────────────
// CUÁNTA GENTE DEPENDE YA DE ESTO. Cada usuario con contacto de confianza
// guardado es una persona que, si aprieta el botón, espera que su familiar
// reciba algo cierto. Ese es el número que dice si esta pantalla urge o no —
// y el que yo medí mal contando una colección que no existe.
//
// 🔴 LA SESIÓN SE LLAMA `sesion`, NO `t`. Arriba ya hay un `const t` con el
// código de la pantalla, y declarar otro `t` aquí lo tapaba: hoy no rompía
// nada porque este trozo no usa el código, y mañana sí. Lo cazó la segunda
// opinión — que también cazó que la primera corrección de esto citaba un
// número de renglón equivocado. Por eso ya no cita ninguno: un número dentro
// de un comentario se queda viejo en la siguiente edición, y entonces el
// comentario miente. Se nombra la variable, que no se mueve.
(async () => {
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

  // El contacto vive en `usuarios/{uid}`, NO en una colección propia.
  try {
    const usuarios = await traer(sesion, 'usuarios');
    const conContacto = usuarios.filter(
      (u) => (val((u.fields || {}).contactoConfianzaNumero) || '').trim() !== '');
    console.log('    ' + pad('con contacto guardado', 24)
      + pad(conContacto.length + ' de ' + usuarios.length, 12)
      + C.gris + 'usuarios que YA dependen de este botón' + C.off);
    if (conContacto.length > 0) {
      console.log(C.ama + '      ⚠ no es 0: cada silencio de esta pantalla es una de esas '
        + 'personas quedándose sin avisar.' + C.off);
    }
  } catch (e) {
    console.log('    ' + pad('con contacto guardado', 24) + C.ama + 'no pude leerlo: '
      + e.message + C.off);
  }

  // La bandeja de rechazos sí es una colección, y la escribe guardarRechazo.js.
  try {
    const rechazos = await traer(sesion, 'rechazos');
    console.log('    ' + pad('bandeja de rechazos', 24) + pad(rechazos.length, 12)
      + C.gris + 'REGLA 9 (aquí NO se escribe, por decisión del dueño)' + C.off);
  } catch (e) {
    console.log('    ' + pad('bandeja de rechazos', 24) + C.ama + 'no pude leerla: '
      + e.message + C.off);
  }
  console.log('');
})();
