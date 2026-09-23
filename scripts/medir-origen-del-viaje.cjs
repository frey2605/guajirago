/**
 * DÓNDE NACE EL VIAJE — el punto de recogida con el que se crea
 *
 *   node scripts/medir-origen-del-viaje.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que correrá el PASO 12.
 *
 * ── QUÉ SE MIDE AQUÍ, Y QUÉ NO ──────────────────────────────────────────────
 * Esto: con qué coordenadas se GUARDA el viaje (`pasajeroLat`/`pasajeroLng`),
 * que son las que mandan al conductor a un sitio y las que el servidor usa para
 * decidir a QUÉ conductores avisar.
 *
 * NO esto: el mensaje del botón de emergencia. Ése comparte una medida con
 * éste —los viajes nacidos en la plaza— pero se arregló el 12-sep-2026 y su
 * guion es `medir-boton-del-mapa.cjs`. Confundirlos es fácil y ya escondió el
 * fallo una vez: el botón dejó de mentir y el PEDIDO siguió mintiendo.
 *
 * ── EL CAMINO, EN CRISTIANO ─────────────────────────────────────────────────
 * El mapa de recogida arranca centrado donde diga `centroMapa`, que sigue a
 * `ubicacionPasajero`, que arranca —y vuelve, si el GPS falla dos veces— en el
 * centro de Riohacha. Eso, PARA DIBUJAR EL MAPA, está bien: mejor el pueblo que
 * una pantalla en blanco.
 *
 * Lo que no estaba bien es lo que pasaba después, y pasaba SOLO:
 *
 *   1. Google lanza `idle` en cuanto el mapa termina de dibujarse. Nadie ha
 *      tocado nada todavía.
 *   2. El `idle` geocodifica al revés el centro del mapa —la plaza— y llama a
 *      `onCambioPunto` con esa dirección.
 *   3. `onCambioPunto` ESCRIBÍA esa dirección en el campo de origen y ponía
 *      `pinActivoRef` en `true`.
 *   4. Al pedir, `usarPin` era `true`, así que el viaje se creaba con la plaza.
 *
 * Y había un SEGUNDO camino a la plaza: si el pasajero escribe la dirección a
 * mano (`pinActivoRef` en `false`) y la geocodificación de ese texto no
 * contesta, `coordsRecogida` se quedaba en `ubicacionPasajero` — que sin GPS es
 * la plaza. Ahí el texto decía una cosa y las coordenadas otra, y el conductor
 * navega por las coordenadas.
 *
 * ── 🔴 POR QUÉ ESTE GUION CORRE EL CAMINO ENTERO ────────────────────────────
 * La primera versión de este archivo medía cada eslabón POR SEPARADO: sacaba
 * del código la sentencia que decide el punto de recogida y la corría sola.
 * Con el arreglo puesto seguía diciendo PUESTO, y tenía razón en lo que miraba
 * y estaba equivocada en lo que importaba: esa sentencia, vista sola, sigue
 * devolviendo la plaza si se le dan un pin y una bandera que digan plaza. Lo
 * que el arreglo cambió es que **ese estado ya no se alcanza**.
 *
 * O sea: medía una foto de un eslabón, no el camino. Y un medidor que prueba
 * un estado imposible acusa para siempre, que es la otra cara del verde falso —
 * quien lo lee acaba por no creerle.
 *
 * Ahora se corre la CADENA: el `idle` del mapa, lo que la pantalla hace con lo
 * que el `idle` le dice, y con ESE estado —el que de verdad queda— la decisión
 * del pedido. Seis escenarios, todos sacados del archivo y ejecutados. Lo que
 * sale es la coordenada con la que nacería el viaje, o nada si el viaje no se
 * puede crear.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/Solicitar.js';
const DOCUMENTO = 'guajirago/src/viajeNuevo.js';

const { cargarDeLaApp, soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

// La plaza, la calculadora de distancia y la lista de finales salen de los
// archivos de la app, no de una copia aquí (SEGUNDA LEY). Si mañana se mueve el
// centro, este guion mide el nuevo sin que haya que tocarlo; y si se escribiera
// aquí otra fórmula de distancia, serían dos calculadoras para lo mismo.
const { centroRiohacha } = cargarDeLaApp('guajirago/src/riohacha.js');
const { calcularDistanciaKm } = cargarDeLaApp('guajirago/src/distancia.js');
const { ESTADOS_TERMINADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');

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

/** Los documentos de una colección. SOLO LEE. */
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
  if (v.mapValue !== undefined) return v.mapValue.fields || {};
  return undefined;
};

// ── SACAR TROZOS DEL ARCHIVO PARA CORRERLOS ────────────────────────────────

/**
 * Desde la llave/paréntesis de `abre`, el índice del que lo cierra.
 *
 * 🔴 SE CUENTA CON LOS TEXTOS TAPADOS. Una llave dentro de unas comillas —un
 * `'{'` en un mensaje— descuadra la cuenta y el corte se va a otro sitio, y
 * entonces el medidor mira un trozo que no es el que dice mirar. Esa trampa ya
 * mordió en este proyecto: cegó al contador de `catch` de la pantalla del
 * cliente y lo dejó verde con el arreglo deshecho. `sinTextos` deja el texto
 * del mismo largo (cambia lo de dentro de las comillas por equis), así que los
 * índices que salen de aquí siguen valiendo sobre el original.
 */
function elQueCierra(texto, abre) {
  const t = sinTextos(texto);
  const pares = { '{': '}', '(': ')', '[': ']' };
  const cierra = pares[t[abre]];
  if (!cierra) return -1;
  let hondo = 0;
  for (let i = abre; i < t.length; i += 1) {
    const c = t[i];
    if (c === t[abre]) hondo += 1;
    else if (c === cierra) { hondo -= 1; if (hondo === 0) return i; }
  }
  return -1;
}

/** Desde `desde`, hasta el `;` que está a nivel cero de paréntesis y llaves. */
function hastaElPuntoYComa(texto, desde) {
  // Con los textos tapados, por lo mismo que `elQueCierra`: un `;` o una llave
  // dentro de unas comillas cortaría por donde no es.
  const seguro = sinTextos(texto);
  let hondo = 0;
  for (let i = desde; i < seguro.length; i += 1) {
    const c = seguro[i];
    if (c === '(' || c === '{' || c === '[') hondo += 1;
    else if (c === ')' || c === '}' || c === ']') hondo -= 1;
    else if (c === ';' && hondo === 0) return texto.slice(desde, i + 1);
  }
  return null;
}

/**
 * ¿Es seguro correr este trozo?
 *
 * No se corre nada que pueda salirse de aquí. Si el trozo nombra una de estas
 * puertas, el guion NO lo ejecuta: lo dice y se queja, que es lo contrario de
 * dar el visto bueno. Un medidor que se calla porque no pudo mirar miente.
 *
 * `window` NO está en la lista a propósito: el trozo del pedido lo usa, y se le
 * pasa COMO PARÁMETRO, así que el `window` de verdad queda tapado por el de
 * mentira que le doy yo. Tapado es más seguro que prohibido: prohibirlo dejaría
 * el eslabón más importante sin medir.
 */
const PUERTAS = /\b(?:require|process|globalThis|global|fetch|eval|Function|import|module|child_process|document|localStorage)\b/;
const pareceSeguro = (trozo) => {
  const m = PUERTAS.exec(trozo);
  return m ? 'nombra `' + m[0] + '`' : null;
};

// ── EL CÓDIGO DE HOY ───────────────────────────────────────────────────────

const fuente = fs.existsSync(path.join(RAIZ, PANTALLA))
  ? fs.readFileSync(path.join(RAIZ, PANTALLA), 'utf8') : '';

/**
 * 🔴 SE PUEDE CAMBIAR — y tiene que poderse.
 *
 * Normalmente es la pantalla de verdad. Pero el amarre le da de comer PANTALLAS
 * DE MENTIRA —la pantalla real con un escape metido— y exige que se queje de
 * todas. Sin eso, ablandar este archivo dejaría la pantalla rota con todas las
 * pruebas en verde: el amarre se cree lo que este lector le diga, y el guardián
 * lo aprueba porque está en la foto. Ya pasó con el historial del conductor.
 *
 * `elVeredicto` la cambia y la devuelve a su sitio en un `finally`, así que no
 * se queda pegada aunque algo reviente en medio.
 */
let codigo = soloCodigo(fuente);

/** El `addListener('<que>', ...)` del mapa: su cuerpo, listo para correr. */
function elOyente(que) {
  // SE BUSCA EL QUE SE PIDE, NO EL PRIMERO. La pantalla tiene varios
  // `addListener` —el del autocompletar, el del arrastre, el del `idle`—, y
  // coger el primero que aparezca dejaba el eslabón sin medir.
  for (let d = codigo.indexOf('addListener('); d >= 0; d = codigo.indexOf('addListener(', d + 1)) {
    const cierra = elQueCierra(codigo, codigo.indexOf('(', d));
    if (cierra < 0) continue;
    const llamada = codigo.slice(d, cierra + 1);
    if (!new RegExp('^addListener\\(\\s*[\'"]' + que + '[\'"]').test(llamada)) continue;
    const flecha = llamada.indexOf('=>');
    const abre = llamada.indexOf('{', flecha);
    if (flecha < 0 || abre < 0) return { falla: 'el `' + que + '` no lleva una función con llaves' };
    return { cuerpo: llamada.slice(abre + 1, elQueCierra(llamada, abre)) };
  }
  return { falla: 'no encuentro el `addListener` del `' + que + '` del mapa de recogida' };
}

/** Lo que hace el `idle` del mapa, CORRIDO: qué punto manda a resolver. */
function elIdle(centro) {
  const o = elOyente('idle');
  if (o.falla) return { falla: o.falla };
  const pega = pareceSeguro(o.cuerpo);
  if (pega) return { falla: 'no corro el `idle` porque ' + pega };
  const pedidas = [];
  const espia = (la, ln) => pedidas.push({ lat: la, lng: ln });
  const mapaFalso = {
    current: { getCenter: () => ({ lat: () => centro.lat, lng: () => centro.lng }) },
  };
  try {
    // Se le dan los DOS nombres apuntando al mismo espía —el directo y el del
    // ref— porque el oyente puede llamar a cualquiera de los dos y las dos
    // formas son buenas. Si un día llama a una tercera, el espía no se llama,
    // `pedidas` queda vacío y el veredicto se queja: que es lo que debe pasar.
    // eslint-disable-next-line no-new-func
    new Function('mapaRef', 'resolverDireccion', 'resolverRef', o.cuerpo)(
      mapaFalso, espia, { current: espia });
  } catch (e) {
    return { falla: 'el `idle` reventó al correrlo: ' + e.message };
  }
  return { pedidas };
}

/**
 * 🔴 `resolverDireccion`, SACADA DEL ARCHIVO Y CORRIDA.
 *
 * Este es el eslabón que UNE la marca con la decisión, y estuvo sin medir. El
 * guion se inventaba el `loEligio` y se lo inyectaba a `onCambioPunto`, así que
 * todo el tramo que va de `loEligioRef` al tercer argumento no se ejecutaba ni
 * se miraba. La segunda opinión metió por ahí el fallo entero —un
 * `const loEligio = true;` a pelo— y las 88 pruebas siguieron en verde.
 *
 * Ahora se corre de verdad: ella lee el `loEligioRef` que le den —el mismo que
 * prendieron (o no) los oyentes que se corrieron antes— y llama a la
 * `onCambioPunto` de verdad.
 */
function correrResolver(punto, loEligioRef, onCambioPunto, direccion) {
  const d = codigo.indexOf('const resolverDireccion');
  if (d < 0) return 'no encuentro `resolverDireccion` en el mapa de recogida';
  const flecha = codigo.indexOf('(lat, lng) =>', d);
  const abre = codigo.indexOf('{', flecha);
  if (flecha < 0 || abre < 0) return 'no entiendo la forma de `resolverDireccion`';
  const cuerpo = codigo.slice(abre + 1, elQueCierra(codigo, abre));
  const pega = pareceSeguro(cuerpo);
  if (pega) return 'no corro `resolverDireccion` porque ' + pega;
  // Un geocodificador de mentira que contesta lo que yo le diga. Si `direccion`
  // viene vacía, contesta que no encontró nada — que es el caso de verdad en
  // que Google no responde.
  const geocoderRef = {
    current: {
      geocode: (req, cb) => (direccion
        ? cb([{ formatted_address: direccion }], 'OK')
        : cb(null, 'ZERO_RESULTS')),
    },
  };
  try {
    // eslint-disable-next-line no-new-func
    const resolver = new Function('onCambioPunto', 'loEligioRef', 'ultimoPuntoRef',
      'geocoderRef', 'console', 'return ((lat, lng) => {' + cuerpo + '});')(
      onCambioPunto, loEligioRef, { current: null }, geocoderRef, { log: () => {} });
    resolver(punto.lat, punto.lng);
  } catch (e) {
    return '`resolverDireccion` reventó al correrla: ' + e.message;
  }
  return null;
}

/**
 * 🔴 ¿LOS OYENTES QUEDAN ENCHUFADOS AL MAPA? Se monta el mapa y se mira.
 *
 * Los otros lectores sacan el CUERPO de cada oyente y lo corren suelto, así que
 * comprueban lo que HACE — pero no que esté conectado. Un cuerpo perfecto en un
 * oyente desenchufado no sirve de nada: la segunda opinión añadió un
 * `arrastreRef.current.remove();` justo después de registrarlo y el veredicto
 * salió limpio, mientras que en la app **arrastrar el marcador dejaba de
 * marcar** — o sea, la salida que el dueño puso PRIMERA dejaba de funcionar y
 * sin GPS no se podía pedir de ninguna manera.
 *
 * Es el hermano de una lección que este proyecto ya pagó: «un amarre tiene que
 * mirar el `exports.`» —quitarle el `exports.` a un disparador lo saca del
 * despliegue y la prueba que busca la cadena sigue verde—. Aquí se monta el
 * mapa con un Google de mentira y se mira qué oyentes quedan puestos.
 */
function losOyentesQuedanPuestos() {
  const d = codigo.indexOf('if (!window.google || !mapRef.current || mapaRef.current) return;');
  if (d < 0) return { falla: 'no encuentro el efecto que crea el mapa de recogida' };
  const fin = codigo.indexOf('\n  }, []);', d);
  if (fin < 0) return { falla: 'no entiendo dónde acaba el efecto que crea el mapa' };
  const cuerpo = codigo.slice(d, fin);
  const pega = pareceSeguro(cuerpo);
  if (pega) return { falla: 'no lo corro porque ' + pega };

  const puestos = [];
  const mapaFalso = {
    addListener: (que) => {
      const oyente = { que, vivo: true, remove: () => { oyente.vivo = false; } };
      puestos.push(oyente);
      return oyente;
    },
  };
  const windowFalso = {
    google: {
      maps: {
        Map: function Map() { return mapaFalso; },
        Geocoder: function Geocoder() { this.geocode = () => {}; },
        event: { trigger: () => {} },
      },
    },
  };
  try {
    // eslint-disable-next-line no-new-func
    new Function('window', 'mapRef', 'mapaRef', 'geocoderRef', 'arrastreRef', 'listenerRef',
      'loEligioRef', 'resolverRef', 'resolverDireccion', 'ubicacionInicial', 'centroRiohacha',
      cuerpo)(
      windowFalso, { current: {} }, { current: null }, { current: null }, { current: null },
      { current: null }, { current: false }, { current: () => {} }, () => {},
      centroRiohacha, centroRiohacha);
  } catch (e) {
    return { falla: 'el efecto del mapa reventó al correrlo: ' + e.message };
  }
  const vivos = puestos.filter((o) => o.vivo).map((o) => o.que);
  return { vivos };
}

/** ¿Arrastrar el mapa marca el punto como elegido? CORRIDO. */
function elArrastreMarca() {
  const o = elOyente('dragstart');
  if (o.falla) return { falla: o.falla };
  const pega = pareceSeguro(o.cuerpo);
  if (pega) return { falla: 'no lo corro porque ' + pega };
  const ref = { current: false };
  try {
    // eslint-disable-next-line no-new-func
    new Function('loEligioRef', o.cuerpo)(ref);
  } catch (e) {
    return { falla: 'reventó al correrlo: ' + e.message };
  }
  return { marca: ref.current === true };
}

/**
 * El botón «Usar mi ubicación», CORRIDO ENTERO — y con el aparato de las dos
 * maneras.
 *
 * 🔴 ANTES SE CORRÍA SOLO LA MITAD. Este lector sacaba únicamente el callback
 * de ÉXITO del `getCurrentPosition`, pero el permiso que le daba el vigilante
 * de la marca era la función ENTERA. O sea: todo lo demás del botón estaba
 * permitido y nadie lo ejecutaba. La segunda opinión metió por ahí el fallo
 * completo dos veces, y la segunda es daño de verdad, no teórico: prender la
 * marca en el callback de ERROR. El pasajero aprieta el botón verde, NIEGA el
 * permiso de ubicación, y la marca se queda encendida — el siguiente `idle` da
 * el relleno por bueno y el viaje vuelve a nacer en la plaza.
 *
 * Ahora se corre la función entera, y dos veces: con el aparato contestando y
 * con el aparato negándose. Negándose, la marca TIENE que quedar apagada.
 */
function elBotonVerdeMarca() {
  const d = codigo.indexOf('const usarMiUbicacion');
  if (d < 0) return { falla: 'no encuentro `usarMiUbicacion`' };
  const abre = codigo.indexOf('{', codigo.indexOf('=>', d));
  const cierra = elQueCierra(codigo, abre);
  if (abre < 0 || cierra < 0) return { falla: 'no entiendo el botón verde' };
  const cuerpo = codigo.slice(abre + 1, cierra);
  const pega = pareceSeguro(cuerpo);
  if (pega) return { falla: 'no lo corro porque ' + pega };

  // El botón se aprieta con un aparato de mentira que se puede poner de CUATRO
  // maneras, porque este botón tiene cuatro finales y tres de ellos eran mudos.
  // Devuelve si prendió la marca Y si dijo algo — las dos cosas del mismo tiro,
  // ejecutando, no leyendo.
  const aprieta = ({ contesta, hayGeo = true, hayMapa = true }) => {
    const ref = { current: false };
    const dicho = [];
    const mapaFalso = { current: hayMapa ? { setCenter: () => {}, setZoom: () => {} } : null };
    const navigatorFalso = hayGeo ? {
      geolocation: {
        getCurrentPosition: (bien, mal) => (contesta
          ? bien({ coords: { latitude: 11.53, longitude: -72.92 } })
          : (mal ? mal({ code: 1 }) : undefined)),
      },
    } : {};
    // eslint-disable-next-line no-new-func
    new Function('navigator', 'loEligioRef', 'mapaRef', 'setUbicUsada', 'onNoSePudo', 'e', cuerpo)(
      navigatorFalso, ref, mapaFalso, () => {}, (porque) => dicho.push(porque),
      { stopPropagation: () => {} });
    // Hablar no es llamar a la función: un `onNoSePudo()` sin nada dentro, o con
    // un texto vacío, deja al pasajero igual de atascado que el silencio. Así
    // que se exige TEXTO, y se mira lo que llegó, no que llegara.
    return { marca: ref.current === true, habla: dicho.some((t) => typeof t === 'string' && t.trim().length > 0) };
  };
  try {
    const bien = aprieta({ contesta: true });
    const sinPermiso = aprieta({ contesta: false });
    const sinAparato = aprieta({ contesta: false, hayGeo: false });
    const sinMapa = aprieta({ contesta: false, hayMapa: false });
    return {
      marca: bien.marca,
      marcaSinPermiso: sinPermiso.marca,
      // 🔴 REGLA 9 · las TRES salidas que se iban calladas. Hasta el
      // 23-sep-2026 las tres eran un `return` seco o un `() => {}`: el dueño
      // apretó el botón en su casa, no pasó nada, y nadie le dijo por qué.
      hablaSinPermiso: sinPermiso.habla,
      hablaSinAparato: sinAparato.habla,
      hablaSinMapa: sinMapa.habla,
      // Y que el que lo pinta esté enchufado. Un botón que grita a un `onNoSePudo`
      // que nadie pasó revienta; uno al que le pasan `() => {}` calla igual que
      // antes. Se mira en el SITIO DE LLAMADA, que es donde se decide.
      enchufado: elAvisoEstaEnchufado(),
    };
  } catch (e) {
    return { falla: 'reventó al correrlo: ' + e.message };
  }
}

/**
 * ¿El aviso del botón verde llega a una ventanita de verdad?
 *
 * No basta con que `MapaRecogida` hable: si quien lo dibuja no le pasa nada, el
 * botón revienta; y si le pasa un `() => {}`, calla igual que antes y NADIE se
 * entera — que es exactamente el fallo que este arreglo cierra, vuelto a poner
 * con otro disfraz. Así que se mira el sitio de llamada y se exige que lo que
 * pasa nombre el ÚNICO texto que existe para esto (`NO_SE_DONDE_ESTAS`), no uno
 * nuevo: dos textos para el mismo aviso es el gemelo de la SEGUNDA LEY.
 */
function elAvisoEstaEnchufado() {
  const i = codigo.indexOf('onNoSePudo={');
  if (i < 0) return false;
  // 🔴 SE MIRA SOLO LO QUE SE LE PASA A `onNoSePudo`, NO LO QUE VENGA DETRÁS.
  //  La primera versión de esto cogía desde `onNoSePudo` hasta el final de la
  //  etiqueta — y ahí dentro va también el cuerpo de `onCambioPunto`. O sea que
  //  el día que alguien escribiera un `setAviso` ahí, un `onNoSePudo={() => {}}`
  //  habría pasado por bueno: el silencio de vuelta, con la prueba en verde.
  //  Se corta con el contador de llaves que ya existe en este archivo, no con
  //  otro escrito a mano (SEGUNDA LEY).
  const abre = codigo.indexOf('{', i);
  const cierra = elQueCierra(codigo, abre);
  if (abre < 0 || cierra < 0) return false;
  const valor = codigo.slice(abre + 1, cierra);
  return valor.includes('NO_SE_DONDE_ESTAS') && valor.includes('setAviso');
}

/**
 * 🔴 LO QUE LA PANTALLA DICE DEL GPS — SACADO DEL ARCHIVO Y CORRIDO.
 *
 * Éste era el último valor que el guion **se inventaba**. Sacaba del archivo
 * con qué arrancan el pin y la marca, pero el tercer dato de la guardia —«esta
 * ubicación es del aparato»— se lo ponía él por escenario. O sea: no medía si
 * la app dice la verdad sobre el GPS, se la decía él. La segunda opinión metió
 * por ahí el fallo ENTERO con dos cambios de una línea y todo en verde:
 *
 *   · `useState(false)` → `useState(true)` en `ubicacionEsDelGps`: la guardia
 *     queda muerta desde el primer dibujo.
 *   · y el peor, porque parece normal: añadir `setUbicacionEsDelGps(true)` al
 *     camino de FALLO del GPS, o sea que la app declara «esto es del aparato»
 *     justo cuando los dos intentos fallaron y lo que hay es el relleno. Con
 *     eso se abren LOS DOS caminos a la plaza a la vez.
 *
 * Ninguna regex habría cazado el segundo con seguridad. Pero el efecto del GPS
 * es código puro —un `getCurrentPosition` con dos respaldos— así que se le
 * puede dar un aparato de mentira y mirar qué declara la pantalla. Eso sí lo
 * caza: con el aparato callado, la marca TIENE que quedar apagada.
 */
function elGpsDeLaPantalla(contesta) {
  const d = codigo.indexOf('if (!navigator.geolocation) return;');
  if (d < 0) return { falla: 'no encuentro el efecto que pide el GPS' };
  // El cuerpo va desde ahí hasta el `}, []);` que cierra el efecto.
  const fin = codigo.indexOf('}, []);', d);
  if (fin < 0) return { falla: 'no entiendo dónde acaba el efecto del GPS' };
  const cuerpo = codigo.slice(d, fin);
  const pega = pareceSeguro(cuerpo);
  if (pega) return { falla: 'no corro el efecto del GPS porque ' + pega };

  const delAparato = { lat: 11.5312, lng: -72.9241 };
  const puesto = { ubicacion: null, esDelGps: null };
  // Un aparato de mentira: o contesta con una posición, o falla las dos veces.
  const navigatorFalso = {
    geolocation: {
      getCurrentPosition: (bien, mal) => (contesta
        ? bien({ coords: { latitude: delAparato.lat, longitude: delAparato.lng } })
        : (mal ? mal({ code: 1 }) : undefined)),
    },
  };
  try {
    // eslint-disable-next-line no-new-func
    new Function('navigator', 'setUbicacionPasajero', 'setUbicacionEsDelGps', 'centroRiohacha',
      cuerpo)(
      navigatorFalso, (u) => { puesto.ubicacion = u; },
      (v) => { puesto.esDelGps = v; }, centroRiohacha);
  } catch (e) {
    return { falla: 'el efecto del GPS reventó al correrlo: ' + e.message };
  }
  // El arranque también sale del archivo: si la marca nace en `true`, la guardia
  // está muerta antes de que el GPS diga nada.
  const arranque = /ubicacionEsDelGps,\s*setUbicacionEsDelGps\]\s*=\s*useState\(\s*(true|false)\s*\)/
    .exec(codigo);
  if (!arranque) return { falla: 'no sé con qué valor arranca `ubicacionEsDelGps`' };
  return {
    arrancaEnFalse: arranque[1] === 'false',
    // Si nadie llamó a la marca, se queda como arrancó.
    esDelGps: puesto.esDelGps === null ? arranque[1] === 'true' : puesto.esDelGps === true,
    ubicacion: puesto.ubicacion || centroRiohacha,
    delAparato,
  };
}

/**
 * La `onCambioPunto` de la pantalla, sacada del archivo y lista para llamar.
 *
 * Devuelve la función, no el resultado: quien la llama es `resolverDireccion`,
 * corrida de verdad, y es ella la que decide con qué argumentos. Antes este
 * guion la llamaba él mismo con un `loEligio` inventado, y ahí estaba el hueco.
 */
function laFlechaDelAviso(esDelGps, pinRef) {
  const i = codigo.indexOf('onCambioPunto={');
  if (i < 0) return { falla: 'no encuentro el `onCambioPunto` del mapa de recogida' };
  const abre = codigo.indexOf('{', i + 'onCambioPunto='.length - 1);
  const cierra = elQueCierra(codigo, abre);
  if (cierra < 0) return { falla: 'no entiendo el `onCambioPunto`' };
  const flecha = codigo.slice(abre + 1, cierra).trim();
  if (!/=>/.test(flecha)) return { falla: 'el `onCambioPunto` no lleva una flecha' };
  const pega = pareceSeguro(flecha);
  if (pega) return { falla: 'no lo corro porque ' + pega };
  const puesto = { punto: null, origen: null };
  try {
    // eslint-disable-next-line no-new-func
    const hacer = new Function('setPuntoRecogida', 'pinActivoRef', 'setOrigen',
      'ubicacionEsDelGps', 'return (' + flecha + ');')(
      (p) => { puesto.punto = p; }, pinRef, (t) => { puesto.origen = t; }, esDelGps);
    return { hacer, puesto };
  } catch (e) {
    return { falla: 'el `onCambioPunto` no se pudo preparar: ' + e.message };
  }
}

/**
 * ¿QUIÉN PUEDE PRENDER LA MARCA? Solo dos sitios, y los dos se corren aparte.
 *
 * Los dos oyentes se comprueban ejecutándolos, pero eso no impide que alguien
 * añada un TERCER sitio que la prenda — por ejemplo al TOCAR el mapa, que no es
 * elegir: la propia pantalla dice «👆 Mantén presionado para ajustar», así que
 * un toque para agrandar el mapa pasaría a valer como haber puesto el pin. Ese
 * escape lo encontró la segunda opinión. Aquí se cuenta cuántos sitios la
 * prenden: si aparece uno más, hay que mirarlo.
 */
function dondeSeTocaLaMarca() {
  // 🔴 NO SE MIRA **CÓMO** SE ESCRIBE, SE MIRA **DÓNDE** APARECE.
  //
  // Esto se ha rehecho dos veces y las dos se escapó, porque las dos veces
  // buscaba una forma de escribir:
  //   · la primera contaba el texto `loEligioRef.current = true`, y un
  //     `= !false` en otro sitio devolvía el fallo entero con todo en verde;
  //   · la segunda contaba cualquier asignación a `.current`, y se colaron
  //     `loEligioRef['current'] = true`, `Object.assign(loEligioRef, {...})` y
  //     guardar el ref en otra variable y escribir por ella.
  //
  // Persiguiendo formas de escribir no se acaba nunca: siempre hay una más. Así
  // que se cambia la pregunta. El nombre `loEligioRef` solo tiene cuatro sitios
  // donde tiene algo que hacer: su declaración, el oyente del arrastre, el
  // botón verde y `resolverDireccion` (que lo lee). Los tres primeros se
  // EJECUTAN aquí y el cuarto también. Cualquier aparición del nombre FUERA de
  // esos cuatro sitios es algo que nadie está mirando — y da igual cómo esté
  // escrita. Para colar un escape ahora habría que meterlo dentro de un sitio
  // que sí se corre, y entonces se ve al correrlo.
  // 🔴 LOS COMENTARIOS SE TAPAN CON ESPACIOS, NO SE BORRAN. Borrarlos cambia la
  // longitud, y entonces las posiciones de un texto ya no valen sobre el otro:
  // los rangos salen de `codigo` y las apariciones de aquí, así que los dos
  // tienen que medir lo mismo o la comparación es mentira. (Y se tapan porque
  // `soloCodigo` deja los comentarios que van AL FINAL de un renglón de código:
  // sin esto, documentar la marca en un comentario ponía el detector rojo sin
  // motivo — y la salida fácil de un rojo sin motivo es ablandar el detector.)
  const sinRabo = codigo.split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*/,
      (m, p1) => p1 + ' '.repeat(m.length - p1.length))).join('\n');

  const rangos = [];
  const mete = (desde, hasta) => { if (desde >= 0 && hasta > desde) rangos.push([desde, hasta]); };

  // Los rangos se buscan sobre `codigo`, CON sus textos: `sinTextos` cambia
  // `'dragstart'` por equis, así que buscarlo sobre el texto tapado no encuentra
  // nada nunca — y el rango del arrastre se quedaba fuera, dejando su propia
  // línea marcada como sospechosa. Un detector en rojo por no saber mirar.
  // 1 · la declaración: hasta su `;`, NO hasta el final del renglón. Con el
  //     renglón entero permitido, un `const loEligioRef = useRef(false);
  //     loEligioRef.current = true;` pegado detrás se colaba —y ese renglón no
  //     lo ejecuta nadie, el arranque se lee con una regex—. Lo encontró la
  //     segunda opinión, y es la misma forma de los que ya se colaron: una
  //     línea de aspecto normal.
  const decl = codigo.indexOf('const loEligioRef');
  mete(decl, decl + (hastaElPuntoYComa(codigo, decl) || '').length);
  // 2 · el oyente del arrastre.
  for (let d = codigo.indexOf('addListener('); d >= 0; d = codigo.indexOf('addListener(', d + 1)) {
    const cierra = elQueCierra(codigo, codigo.indexOf('(', d));
    if (cierra > d && /^addListener\(\s*['"]dragstart['"]/.test(codigo.slice(d, cierra + 1))) {
      mete(d, cierra + 1);
    }
  }
  // 3 · el botón verde, entero.
  const boton = codigo.indexOf('const usarMiUbicacion');
  mete(boton, elQueCierra(codigo, codigo.indexOf('{', boton)) + 1);
  // 4 · `resolverDireccion`, que la LEE.
  const resol = codigo.indexOf('const resolverDireccion');
  mete(resol, elQueCierra(codigo, codigo.indexOf('{', codigo.indexOf('(lat, lng) =>', resol))) + 1);

  const dentro = (i) => rangos.some(([a, b]) => i >= a && i <= b);
  const fuera = [];
  const NOMBRE = /loEligioRef/g;
  let m;
  while ((m = NOMBRE.exec(sinRabo)) !== null) {
    if (!dentro(m.index)) fuera.push(sinRabo.slice(0, m.index).split('\n').length);
  }
  return { fuera, sitios: rangos.length };
}

/**
 * La decisión del pedido, sacada del archivo y lista para correr.
 *
 * Se lleva el trozo ENTERO: desde `const usarPin` hasta donde acabe la
 * comprobación de que hay un punto. Si el arreglo está puesto, ese trozo
 * termina en un `return` — y como se corre dentro de una flecha, ese `return`
 * sale sin coordenada: eso es «no se puede pedir», que es justo lo que hay que
 * poder distinguir de «nace aquí».
 */
function laCadenaDelPedido() {
  // 🔴 LA VALIDACIÓN DE «NO DIJISTE DÓNDE ESTÁS» ENTRA EN LA CADENA.
  //
  // Antes esto empezaba en `const usarPin`, y así se medía un camino que el
  // pasajero no recorre: sin GPS el campo de origen queda vacío, así que choca
  // ANTES con la validación y nunca llega a la decisión del punto. O sea que la
  // fila «y cuando no se crea, se dice por qué» firmaba sobre un tramo que
  // nadie pisa. Lo cazó la segunda opinión.
  // 🔴 EL DE DENTRO DEL BUENO, NO EL PRIMERO DEL ARCHIVO.
  //
  // Buscaba el primer `if (!origen) {` que apareciera, y la segunda opinión lo
  // cegó con un señuelo: un `if (!origen) { }` vacío un renglón más arriba. El
  // guion medía el adorno, la bandera salía bien, y mientras tanto la
  // comprobación de verdad podía quedarse muda. Es el mismo fallo que ya costó
  // tres rondas en el historial del conductor —leer el primero del archivo en
  // vez del que se pide— y está escrito arriba en este mismo archivo.
  //
  // El bueno es el que vive DENTRO de `if (!origen || !destino) {`, que es la
  // comprobación que la pantalla usa de verdad y que `gemelosSolicitar.test.js`
  // vigila aparte para que el taxi y el mandado no pidan lo mismo.
  const marco = codigo.indexOf('if (!origen || !destino) {');
  const finMarco = marco >= 0 ? elQueCierra(codigo, codigo.indexOf('{', marco)) : -1;
  // 🔴 SE LLEVA EL BLOQUE ENTERO, NO UN `if` ELEGIDO A DEDO.
  //
  // Esto se arregló mal una vez: buscaba el primer `if (!origen) {` del archivo
  // y un señuelo vacío delante lo cegaba; se ancló al marco... y la segunda
  // opinión metió el señuelo DENTRO del marco. Seguía siendo «el primero», solo
  // que el primero de otro sitio. Perseguir al señuelo no acaba nunca.
  //
  // Así que no se elige: se corre el bloque ENTERO, tal como está escrito. Un
  // señuelo vacío no esconde nada, porque la comprobación de verdad se ejecuta
  // detrás y en su orden; si se ha quedado muda, se ve al correrla.
  const validacion = (marco >= 0 && finMarco > marco)
    ? codigo.slice(marco, finMarco + 1) + '\n'
    : '';

  const i = codigo.indexOf('const usarPin');
  if (i < 0) return { falla: 'no encuentro `usarPin` en la pantalla' };
  let fin = -1;
  const guardia = codigo.indexOf('if (!coordsRecogida)', i);
  if (guardia >= 0) {
    fin = elQueCierra(codigo, codigo.indexOf('{', guardia)) + 1;
  } else {
    // Sin la guardia —el arreglo deshecho, o un sabotaje— se llega hasta el
    // final del bloque que geocodifica el texto escrito a mano.
    const sinPin = codigo.indexOf('if (!usarPin)', i);
    if (sinPin >= 0) fin = elQueCierra(codigo, codigo.indexOf('{', sinPin)) + 1;
  }
  if (fin <= i) return { falla: 'no entiendo la cadena que decide el punto de recogida' };
  const trozo = validacion + codigo.slice(i, fin);
  const pega = pareceSeguro(trozo);
  if (pega) return { falla: 'no la corro porque ' + pega };
  return { trozo, conValidacion: validacion !== '' };
}

/**
 * El aviso de «no sé dónde estás», sacado del archivo y EJECUTADO.
 *
 * Se saca de verdad, en vez de dárselo de mentira a la cadena, porque hay algo
 * que comprobar en él: que nombre EL MARCADOR. Ésa es una de las dos salidas
 * que decidió el dueño, y un aviso que solo diga «escribe la dirección» deja
 * fuera la que él puso por delante.
 */
function elAvisoDeNoSaber() {
  const d = codigo.indexOf('const NO_SE_DONDE_ESTAS');
  if (d < 0) return { falla: 'no encuentro el aviso `NO_SE_DONDE_ESTAS`' };
  const igual = codigo.indexOf('=', d);
  const trozo = hastaElPuntoYComa(codigo, igual + 1);
  if (!trozo) return { falla: 'no entiendo el aviso `NO_SE_DONDE_ESTAS`' };
  const pega = pareceSeguro(trozo);
  if (pega) return { falla: 'no lo corro porque ' + pega };
  try {
    // eslint-disable-next-line no-new-func
    const armar = new Function('return (' + trozo.replace(/;\s*$/, '') + ');')();
    return { armar, ejemplo: armar(false, null) };
  } catch (e) {
    return { falla: 'el aviso reventó al armarlo: ' + e.message };
  }
}
// 🔴 NO SE GUARDA EN UNA CONSTANTE. La tenía así —`const CADENA =
// laCadenaDelPedido()`, calculada una vez al cargar el archivo— y eso dejaba
// CIEGO al lector para las pantallas de mentira: se le daba una pantalla con el
// respaldo del GPS saboteado y él seguía leyendo la cadena que había guardado
// al arrancar, o sea la buena. Todo en verde con el escape puesto. Lo cazó el
// sabotaje del amarre, que es justo para lo que está. Se calcula en cada
// llamada, contra `codigo`, que es lo que puede cambiar.

/** Un `window` de mentira: su geocodificador contesta lo que yo le diga. */
const windowFalso = (resultado) => ({
  google: {
    maps: {
      Geocoder: function Geocoder() {
        this.geocode = (req, cb) => {
          if (!resultado) { cb(null, 'ZERO_RESULTS'); return; }
          cb([{ geometry: { location: { lat: () => resultado.lat, lng: () => resultado.lng } } }],
            'OK');
        };
      },
    },
  },
});

/** Corre la decisión del pedido con un estado dado. Devuelve la coordenada, o nada. */
async function correrElPedido({ punto, pin, ubicacion, esDelGps, origen, encuentra }) {
  const cadena = laCadenaDelPedido();
  if (cadena.falla) return { falla: cadena.falla };
  const avisos = [];
  try {
    const aviso = elAvisoDeNoSaber();
    if (aviso.falla) return { falla: aviso.falla };
    // eslint-disable-next-line no-new-func
    const correr = new Function('window', 'setCargando', 'setAviso', 'setError', 'esMensajeria',
      'NO_SE_DONDE_ESTAS', 'puntoRecogida', 'pinActivoRef', 'ubicacionPasajero',
      'ubicacionEsDelGps', 'origen', 'destino',
      'return (async () => {\n' + cadena.trozo + '\nreturn coordsRecogida;\n})();');
    const coords = await correr(windowFalso(encuentra), () => {}, (a) => avisos.push(a),
      (t) => avisos.push({ titulo: '', texto: t, enLinea: true }), false, aviso.armar,
      punto, { current: pin }, ubicacion, esDelGps, origen, 'Cl. 1 # 2-3');
    return { coords: coords || null, avisos };
  } catch (e) {
    return { falla: 'la decisión del pedido reventó: ' + e.message };
  }
}

/**
 * 🔴 LOS `useEffect` DEL PADRE, SACADOS DEL ARCHIVO Y CORRIDOS.
 *
 * Éste era EL HUECO, y estaba escrito en CLAUDE.md desde el 15-sep-2026: «no
 * ejecuta los `useEffect` del componente padre, que es donde vive el recentrado
 * del mapa». La segunda opinión lo demostró entonces metiendo UN efecto al lado
 * del que ya había y devolviendo el fallo entero con el veredicto limpio.
 *
 * No se busca un texto concreto: perseguir formas de escribir no acaba nunca
 * —lección pagada tres veces en esta misma pantalla—. Se buscan TODOS los
 * efectos del padre cuya lista de dependencias nombre `ubicacionPasajero`, y se
 * CORREN. Si alguno recentra el mapa, el mapa se recentra, esté escrito como
 * esté y sea uno o sean cuatro.
 *
 * Se mira solo dentro de `Solicitar`: `MapaPasajero` —el mapa de seguimiento,
 * que es OTRO mapa— también depende de `ubicacionPasajero`, y colarlo aquí
 * sería medir otra pantalla.
 */
function losEfectosDelPadre(pinRef, ubicacionDelGps) {
  const inicio = codigo.indexOf('function Solicitar(');
  if (inicio < 0) return { falla: 'no encuentro el componente `Solicitar`' };
  // El `{` del CUERPO, no el de los parámetros: `function Solicitar({ tipo,
  // onVolver, destinoInicial })` empieza por una llave que no es el cuerpo, y
  // cogerla deja la región en la lista de parámetros — sin un solo efecto que
  // mirar, y por tanto en verde sin haber medido nada.
  const abre = codigo.indexOf('{', elQueCierra(codigo, codigo.indexOf('(', inicio)));
  if (abre < 0) return { falla: 'no entiendo la forma de `Solicitar`' };
  const dentro = codigo.slice(abre, elQueCierra(codigo, abre) + 1);

  const cuerpos = [];
  for (let d = dentro.indexOf('useEffect('); d >= 0; d = dentro.indexOf('useEffect(', d + 1)) {
    const a = dentro.indexOf('(', d);
    const c = elQueCierra(dentro, a);
    if (c < 0) continue;
    const llamada = dentro.slice(a + 1, c);
    // La lista de dependencias es lo que va después de la ÚLTIMA COMA A NIVEL
    // CERO, no el último `[` del trozo: un corchete dentro del cuerpo mandaría
    // a mirar donde no es.
    const seguro = sinTextos(llamada);
    let hondo = 0; let ultima = -1;
    for (let i = 0; i < seguro.length; i += 1) {
      const ch = seguro[i];
      if (ch === '(' || ch === '{' || ch === '[') hondo += 1;
      else if (ch === ')' || ch === '}' || ch === ']') hondo -= 1;
      else if (ch === ',' && hondo === 0) ultima = i;
    }
    if (ultima < 0) continue;
    if (!/\bubicacionPasajero\b/.test(llamada.slice(ultima + 1))) continue;
    const f = llamada.indexOf('=>');
    const ab = llamada.indexOf('{', f);
    if (f < 0 || ab < 0) return { falla: 'un efecto del padre no lleva una función con llaves' };
    const cuerpo = llamada.slice(ab + 1, elQueCierra(llamada, ab));
    const pega = pareceSeguro(cuerpo);
    if (pega) return { falla: 'no corro un efecto del padre porque ' + pega };
    cuerpos.push(cuerpo);
  }
  if (!cuerpos.length) {
    return { falla: 'ningún `useEffect` del padre reacciona ya a `ubicacionPasajero`' };
  }

  let centro = null;
  for (const cuerpo of cuerpos) {
    try {
      // 🔴 EL MISMO `pinActivoRef` QUE VIENE USANDO LA CORRIDA, no uno limpio.
      // En React es un solo ref compartido; darle uno nuevo aquí sería
      // inventarse justo el valor que decide, que es la enfermedad que este
      // repo ya pagó tres veces.
      // eslint-disable-next-line no-new-func
      new Function('setCentroMapa', 'ubicacionPasajero', 'pinActivoRef', cuerpo)(
        (c) => { centro = c; }, ubicacionDelGps, pinRef);
    } catch (e) {
      return { falla: 'un efecto del padre reventó al correrlo: ' + e.message };
    }
  }
  return { cuantos: cuerpos.length, centro };
}

/** Una flecha de las que el campo de origen le pasa al autocompletar. */
function laFlechaDelCampo(prop, desdeTag) {
  const p = codigo.indexOf(prop + '={', desdeTag);
  if (p < 0) return { falla: 'no encuentro el `' + prop + '` del campo de origen' };
  const abre = codigo.indexOf('{', p + prop.length);
  const cierra = elQueCierra(codigo, abre);
  if (cierra < 0) return { falla: 'no entiendo el `' + prop + '` del campo de origen' };
  const flecha = codigo.slice(abre + 1, cierra).trim();
  if (!/=>/.test(flecha)) return { falla: 'el `' + prop + '` no lleva una flecha' };
  const pega = pareceSeguro(flecha);
  if (pega) return { falla: 'no corro el `' + prop + '` porque ' + pega };
  return { flecha };
}

/**
 * ESCOGER LA DIRECCIÓN DE LA LISTA — la otra forma de decir dónde estás.
 *
 * No pasa por el mapa: el autocompletar de Google avisa y la pantalla pone el
 * punto y enciende el pin ella misma. Sin correrlo, esa puerta no se mide.
 *
 * 🔴 Y EL ORDEN LO PONE EL ARCHIVO, NO YO. Aquí hay dos flechas que se pisan a
 * propósito: `onChange` APAGA el pin (quien escribe a mano no tiene pin) y
 * `onPlaceCoords` lo vuelve a ENCENDER. Corriendo solo la segunda —que es lo
 * que hacía la primera versión de este lector— el tramo en que el pin se apaga
 * no se ejecutaba, y una inversión del orden en la app habría dejado el pin
 * APAGADO con esta medición en verde. Así que se corre el `place_changed` de
 * verdad, tal como está escrito, y que él llame a las dos en su orden.
 */
function elEscogerDeLaLista(pinRef, puesto, lugar) {
  const i = codigo.indexOf('onPlaceCoords={');
  if (i < 0) return { falla: 'no encuentro el `onPlaceCoords` del campo de origen' };
  // El campo de origen es el ÚNICO que lleva `onPlaceCoords`; el de destino no.
  // Se ancla ahí y se sube a su etiqueta, en vez de coger «el primer
  // AutocompleteInput del archivo», que es la forma de acabar midiendo el otro.
  const tag = codigo.lastIndexOf('<AutocompleteInput', i);
  if (tag < 0) return { falla: 'no encuentro el campo de origen' };

  const fCambio = laFlechaDelCampo('onChange', tag);
  if (fCambio.falla) return fCambio;
  const fCoords = laFlechaDelCampo('onPlaceCoords', tag);
  if (fCoords.falla) return fCoords;

  let onChange; let onPlaceCoords;
  try {
    // eslint-disable-next-line no-new-func
    onChange = new Function('setOrigen', 'pinActivoRef', 'return (' + fCambio.flecha + ');')(
      (t) => { puesto.origen = t; }, pinRef);
    // eslint-disable-next-line no-new-func
    onPlaceCoords = new Function('setPuntoRecogida', 'setCentroMapa', 'pinActivoRef',
      'return (' + fCoords.flecha + ');')(
      (p) => { puesto.punto = p; }, (c) => { puesto.centro = c; }, pinRef);
  } catch (e) {
    return { falla: 'las flechas del campo de origen no se pudieron preparar: ' + e.message };
  }

  const o = elOyente('place_changed');
  if (o.falla) return { falla: o.falla };
  const pega = pareceSeguro(o.cuerpo);
  if (pega) return { falla: 'no corro el `place_changed` porque ' + pega };
  const place = {
    name: lugar.nombre,
    geometry: { location: { lat: () => lugar.lat, lng: () => lugar.lng } },
  };
  try {
    // eslint-disable-next-line no-new-func
    new Function('autocompleteRef', 'onChangeRef', 'onPlaceCoordsRef', 'window', o.cuerpo)(
      { current: { getPlace: () => place } },
      { current: onChange }, { current: onPlaceCoords }, windowFalso(null));
  } catch (e) {
    return { falla: 'el `place_changed` reventó al correrlo: ' + e.message };
  }
  return {};
}

/**
 * 🔴 EL CAMINO ENTERO, DE PUNTA A PUNTA.
 *
 * Se arranca como arranca la pantalla —el pin como lo deje el archivo—, se
 * corre el `idle` del mapa con el centro que tocaría, se le da a la pantalla lo
 * que el `idle` diga, y con el estado que quede se corre la decisión del
 * pedido. Lo que sale es dónde nacería el viaje. O nada, si no se puede crear.
 */
async function elViajeQueNace({
  hayGps, loEligio, escribe, encuentra, sinDireccion, gpsTardio, escogeDeLaLista,
}) {
  // LOS DOS ARRANQUES SALEN DEL ARCHIVO, no de lo que yo crea que valen.
  const arrPin = /pinActivoRef\s*=\s*useRef\(\s*(true|false)\s*\)/.exec(codigo);
  const arrMarca = /loEligioRef\s*=\s*useRef\(\s*(true|false)\s*\)/.exec(codigo);
  if (!arrPin) return { falla: 'no sé con qué valor arranca `pinActivoRef`' };
  if (!arrMarca) return { falla: 'no sé con qué valor arranca `loEligioRef`' };
  const pinRef = { current: arrPin[1] === 'true' };
  const loEligioRef = { current: arrMarca[1] === 'true' };
  let origen = escribe || '';

  // 🔴 SI EL ESCENARIO DICE QUE EL PASAJERO MOVIÓ EL MAPA, SE CORRE EL OYENTE
  // DE VERDAD. Antes se ponía la marca a mano, y por ahí se colaba el fallo
  // entero: bastaba con que `loEligioRef` arrancara en `true`, o con que
  // `resolverDireccion` se inventara el valor, para que el relleno volviera a
  // darse por bueno — y el guion ni se enteraba, porque nunca los corría.
  if (loEligio) {
    const d = elOyente('dragstart');
    if (d.falla) return { falla: d.falla };
    const pega = pareceSeguro(d.cuerpo);
    if (pega) return { falla: 'no corro el `dragstart` porque ' + pega };
    try {
      // eslint-disable-next-line no-new-func
      new Function('loEligioRef', d.cuerpo)(loEligioRef);
    } catch (e) {
      return { falla: 'el `dragstart` reventó al correrlo: ' + e.message };
    }
  }

  // 🔴 SI LA UBICACIÓN ES DEL APARATO LO DICE LA PANTALLA, NO EL ESCENARIO.
  //
  // El escenario solo decide si el aparato contesta o se queda callado — eso es
  // del mundo, no del código. Lo que la pantalla HACE con esa respuesta sale de
  // correr su propio efecto del GPS. Antes este valor se lo inyectaba el guion,
  // y por ahí volvía el fallo entero con todo en verde.
  // 🔴 `gpsTardio` NO ES OTRO MUNDO: ES EL MISMO, ANTES. El GPS puede tardar
  // hasta 28 segundos (un intento de 8 y, si falla, otro de 20), y en ese rato
  // el pasajero ya dijo dónde está. Así que la primera mitad del camino se
  // corre con el aparato TODAVÍA CALLADO, y el aparato contesta más abajo.
  const gps = elGpsDeLaPantalla(gpsTardio ? false : hayGps);
  if (gps.falla) return { falla: gps.falla };
  const esDelGps = gps.esDelGps;
  const delGps = gps.delAparato;

  // 🔴 LA OTRA FORMA DE DECIR DÓNDE ESTÁS: escribir la dirección y escogerla de
  // la lista. No pasa por el mapa —el `onPlaceCoords` pone el punto, mueve el
  // centro y enciende el pin él solo—, así que se corre aquí, de verdad, antes
  // de que el mapa se quede quieto.
  const deLaLista = { punto: null, centro: null, origen: null };
  if (escogeDeLaLista) {
    const r = elEscogerDeLaLista(pinRef, deLaLista, escogeDeLaLista);
    if (r.falla) return { falla: r.falla };
    // El texto lo escribe la propia pantalla al escoger de la lista, igual que
    // en la app. Dárselo yo sería inventarme el eslabón que quiero medir.
    if (deLaLista.origen) origen = deLaLista.origen;
  }

  // Dónde está centrado el mapa: donde la pantalla dejó la ubicación, donde lo
  // haya dejado el pasajero si lo movió, y donde lo haya puesto la dirección
  // que escogió de la lista.
  const centro = deLaLista.centro
    || (loEligio ? { lat: 11.5388, lng: -72.9155 } : gps.ubicacion);

  const i = elIdle(centro);
  if (i.falla) return { falla: i.falla };
  if (i.pedidas.length === 0) {
    return { falla: 'el `idle` del mapa ya no manda ningún punto a resolver' };
  }
  const flecha = laFlechaDelAviso(esDelGps, pinRef);
  if (flecha.falla) return { falla: flecha.falla };
  for (const p of i.pedidas) {
    // LA CADENA DE VERDAD: el `idle` pide, `resolverDireccion` resuelve y llama
    // a `onCambioPunto`. Nadie por el medio se inventa nada.
    const mal = correrResolver(p, loEligioRef, flecha.hacer,
      sinDireccion ? '' : 'Cl. 15 # 7-100, Riohacha');
    if (mal) return { falla: mal };
  }
  if (flecha.puesto.origen) origen = flecha.puesto.origen;
  let puntoPuesto = flecha.puesto.punto || deLaLista.punto;

  // Lo que el pasajero tenía puesto ANTES de que el aparato dijera nada. Es
  // contra esto contra lo que se carea después: sin la foto de antes, «lo pisó»
  // no se puede medir, solo suponer.
  const antesDelGps = { punto: puntoPuesto, origen };

  // ── 🔴 Y AHORA EL APARATO CONTESTA, TARDE ────────────────────────────────
  //
  // Aquí es donde estaba el daño, y donde ningún lector miraba. Al llegar el
  // GPS, los efectos del padre recentran el mapa; recentrar lanza OTRO `idle`
  // —Google lo lanza SOLO, sin que nadie toque nada—; y ese aviso volvía a
  // entrar por la guardia, pisando el punto y el texto del pasajero.
  let ubicacionFinal = gps.ubicacion;
  let esDelGpsFinal = esDelGps;
  let delGpsFinal = delGps;
  let tardio = null;
  if (gpsTardio) {
    const gps2 = elGpsDeLaPantalla(true);
    if (gps2.falla) return { falla: gps2.falla };
    ubicacionFinal = gps2.ubicacion;
    esDelGpsFinal = gps2.esDelGps;
    delGpsFinal = gps2.delAparato;

    const efectos = losEfectosDelPadre(pinRef, gps2.ubicacion);
    if (efectos.falla) return { falla: efectos.falla };
    tardio = { cuantos: efectos.cuantos, recentro: !!efectos.centro };

    if (efectos.centro) {
      const i2 = elIdle(efectos.centro);
      if (i2.falla) return { falla: i2.falla };
      if (i2.pedidas.length === 0) {
        return { falla: 'el `idle` del mapa ya no manda ningún punto a resolver' };
      }
      // LA FLECHA ES LA DE AHORA. La pantalla se ha vuelto a dibujar, así que
      // `onCambioPunto` se rehizo con `ubicacionEsDelGps` ya en `true` — que es
      // precisamente lo que abría una de las dos puertas. Reusar la de antes
      // sería medir un render que ya no existe.
      const flecha2 = laFlechaDelAviso(esDelGpsFinal, pinRef);
      if (flecha2.falla) return { falla: flecha2.falla };
      for (const p of i2.pedidas) {
        const mal = correrResolver(p, loEligioRef, flecha2.hacer, 'Cra. 9 # 12-40, Riohacha');
        if (mal) return { falla: mal };
      }
      if (flecha2.puesto.punto) puntoPuesto = flecha2.puesto.punto;
      if (flecha2.puesto.origen) origen = flecha2.puesto.origen;
    }
  }

  const r = await correrElPedido({
    punto: puntoPuesto, pin: pinRef.current,
    ubicacion: ubicacionFinal, esDelGps: esDelGpsFinal, origen, encuentra,
  });
  if (r.falla) return { falla: r.falla };
  return {
    coords: r.coords, avisos: r.avisos, origen, pin: pinRef.current, delGps: delGpsFinal,
    punto: puntoPuesto, esDelGps: esDelGpsFinal, arrancaEnFalse: gps.arrancaEnFalse,
    antesDelGps, tardio,
  };
}

/** ¿El documento del viaje guarda de dónde salió la coordenada? EJECUTADO. */
function loQueGuardaElViaje() {
  let armar;
  try {
    ({ armarViajeNuevo: armar } = cargarDeLaApp(DOCUMENTO));
  } catch (e) {
    return { falla: 'no pude cargar ' + DOCUMENTO + ': ' + e.message };
  }
  let doc;
  try {
    doc = armar({
      user: { uid: 'u1', email: 'a@b.c' }, nombrePasajero: 'Ana',
      coords: { lat: centroRiohacha.lat, lng: centroRiohacha.lng },
      tipo: 'Taxi', origen: 'Cl. 15 # 7-100', destino: 'Cl. 1',
      tarifa: 8000, datosDescuento: null, radioBusqueda: 3, extras: null,
    }, new Date('2026-09-15T12:00:00.000Z'));
  } catch (e) {
    return { falla: 'reventó al armar el viaje: ' + e.message };
  }
  const marca = Object.keys(doc).find((k) => /gps|precisi|exact|aproxim|relleno|fuente/i.test(k));
  return { claves: Object.keys(doc), marca: marca || null };
}

const esLaPlaza = (c) => !!c && typeof c.lat === 'number'
  && c.lat === centroRiohacha.lat && c.lng === centroRiohacha.lng;

/** ¿Son el mismo punto? Dos nulos NO lo son: nada no es «lo que había». */
const mismoPunto = (a, b) => !!a && !!b && a.lat === b.lat && a.lng === b.lng;

// ── LOS CAMINOS QUE SE CORREN ──────────────────────────────────────────────
const ESCENARIOS = [
  ['sin GPS y sin tocar nada', { hayGps: false, loEligio: false }],
  ['sin GPS, moviendo el marcador', { hayGps: false, loEligio: true }],
  ['sin GPS, escribiendo una dirección que SÍ se encuentra',
    { hayGps: false, loEligio: false, escribe: 'Cl. 3 # 12-4', encuentra: { lat: 11.5401, lng: -72.9133 } }],
  ['sin GPS, escribiendo una dirección que NO se encuentra',
    { hayGps: false, loEligio: false, escribe: 'la casa de mi tía' }],
  ['con GPS bueno, sin tocar nada', { hayGps: true, loEligio: false }],
  // Éste no está en la lista de fallos a propósito: lo que enseña —que moviendo
  // el marcador, si Google no devuelve la dirección, el campo de origen se
  // queda vacío y la pantalla pide que se escriba— es ANTERIOR a este arreglo y
  // se quedó igual (PRIMERA LEY). Está aquí para que se vea, no para acusar.
  ['sin GPS, moviendo el marcador y sin que Google dé la dirección',
    { hayGps: false, loEligio: true, sinDireccion: true }],
  // 🔴 LOS TRES DEL GPS QUE LLEGA TARDE (21-sep-2026). El aparato puede tardar
  // 28 segundos, y en ese rato el pasajero ya dijo dónde está. Los dos primeros
  // son las DOS PUERTAS por las que el aviso del recentrado volvía a entrar; el
  // tercero es el caso del 95%, que tiene que seguir funcionando igual.
  ['el GPS llega tarde, después de mover el marcador',
    { gpsTardio: true, loEligio: true }],
  ['el GPS llega tarde, después de escoger la dirección de la lista',
    { gpsTardio: true,
      escogeDeLaLista: { lat: 11.5389, lng: -72.9155, nombre: 'Cl. 15 # 7-22' } }],
  ['el GPS llega tarde y el pasajero no tocó nada', { gpsTardio: true }],
];

/**
 * EL VEREDICTO ENTERO — y vive AQUÍ, en un solo sitio.
 *
 * Lo usan las dos bocas: el informe de abajo (pasos 1 y 12) y el amarre de
 * `pruebas/amarres.test.js`, que lo IMPORTA en vez de copiarlo. SEGUNDA LEY, y
 * no es teoría: el recorrido del historial del conductor estuvo escrito en dos
 * sitios con regex casi calcadas y los dos se separaron el mismo día — el guion
 * en verde y el amarre en rojo, sobre el mismo código.
 */
async function elVeredicto(fuenteDePrueba) {
  const antes = codigo;
  if (fuenteDePrueba != null) codigo = soloCodigo(fuenteDePrueba);
  try {
    return await elVeredictoDe();
  } finally {
    codigo = antes;
  }
}

async function elVeredictoDe() {
  const salidas = [];
  for (const [nombre, caso] of ESCENARIOS) {
    // eslint-disable-next-line no-await-in-loop
    salidas.push([nombre, caso, await elViajeQueNace(caso)]);
  }
  // Cada fila: qué tiene que pasar, y si pasa. El veredicto sale de lo CORRIDO
  // arriba, no de leer el archivo otra vez.
  const busca = (n) => (salidas.find(([x]) => x === n) || [])[2] || {};
  const ARRASTRE = elArrastreMarca();
  const BOTON = elBotonVerdeMarca();
  const AVISO = elAvisoDeNoSaber();
  const CADENA = laCadenaDelPedido();
  const MARCA = dondeSeTocaLaMarca();
  const OYENTES = losOyentesQuedanPuestos();
  const ELVIAJE = loQueGuardaElViaje();

  const FALLOS = [
    ['sin GPS y sin tocar nada, el viaje NO nace en la plaza   (ejecutado)',
      () => {
        const r = busca('sin GPS y sin tocar nada');
        return !!r.falla || esLaPlaza(r.coords) || !!r.coords;
      },
      'nacía allí, iba el conductor, y el servidor avisaba a los de allí'],
    // MIRA TODOS LOS CAMINOS, NO UNO. Miraba solo «sin GPS y sin tocar nada», y
    // en cuanto la cadena creció ese escenario dejó de pasar por el último
    // tramo: se le podía quitar la ventanita de allí y el detector ni se
    // enteraba. Lo que importa es la regla entera — si no se crea el viaje, se
    // dice por qué, venga el pasajero por donde venga — y además con ventanita,
    // que en esta app es como se avisa.
    ['y cuando no se crea, se dice por qué   (ejecutado)',
      () => salidas.some(([, , r]) => !r.falla && !r.coords
        && !(r.avisos || []).some((a) => a && !a.enLinea && a.texto)),
      'un botón que no responde y no explica es la REGLA 9 rota'],
    ['sin GPS, la app no escribe sola la dirección en el origen   (ejecutado)',
      () => {
        const r = busca('sin GPS y sin tocar nada');
        return !!r.falla || !!r.origen;
      },
      'el pasajero veía escrito un sitio donde no estaba, sin haberlo puesto'],
    ['sin GPS, el pin no se da por bueno solo   (ejecutado)',
      () => {
        const r = busca('sin GPS y sin tocar nada');
        return !!r.falla || r.pin === true;
      },
      '`pinActivoRef` en `true` es lo que hacía que el pedido usara el relleno'],
    ['escribir una dirección que no se encuentra no acaba en la plaza   (ejecutado)',
      () => {
        const r = busca('sin GPS, escribiendo una dirección que NO se encuentra');
        return !!r.falla || esLaPlaza(r.coords) || !!r.coords;
      },
      'el SEGUNDO camino: el texto decía una cosa y las coordenadas otra'],
    ['arrastrar el mapa marca el punto como elegido   (ejecutado)',
      () => !!ARRASTRE.falla || !ARRASTRE.marca,
      'sin eso, mover el marcador no serviría de nada'],
    ['el botón «Usar mi ubicación» marca el punto como elegido   (ejecutado)',
      () => !!BOTON.falla || !BOTON.marca,
      'sin eso, apretarlo no dejaría pedir tampoco'],
    // Y LA OTRA MITAD DEL MISMO BOTÓN, que es la que hacía daño: si el pasajero
    // lo aprieta y NIEGA el permiso, la marca no puede quedarse encendida. Si
    // se queda, el siguiente `idle` da el relleno por bueno y el viaje vuelve a
    // nacer en la plaza. Lo encontró la segunda opinión.
    ['y si el pasajero niega el permiso, NO lo marca   (ejecutado)',
      () => !!BOTON.falla || BOTON.marcaSinPermiso !== false,
      'apretar el botón no es saber dónde estás: hay que conseguir la ubicación'],
    // 🔴 REGLA 9 · «NADA SE RECHAZA EN SILENCIO» — LAS TRES SALIDAS DEL BOTÓN.
    // No marcarlo estaba bien; irse sin decirlo, no. Las tres se comprueban por
    // separado porque son tres caminos distintos del archivo, y una nota vieja
    // de la tabla de deuda nombraba SOLO el primero: arreglarlo por ella habría
    // dejado dos mudos y a nadie quejándose.
    ['si el aparato no contesta, el botón lo DICE   (ejecutado)',
      () => !!BOTON.falla || BOTON.hablaSinPermiso !== true,
      'el dueño lo apretó en su casa el 23-sep-2026 y la pantalla se quedó callada'],
    ['si el teléfono no deja dar ubicación, lo DICE   (ejecutado)',
      () => !!BOTON.falla || BOTON.hablaSinAparato !== true,
      'era un `return` seco: ni marca, ni mapa, ni explicación'],
    ['si el mapa no está listo, lo DICE   (ejecutado)',
      () => !!BOTON.falla || BOTON.hablaSinMapa !== true,
      'la tercera salida muda, la que ninguna nota nombraba'],
    ['y ese aviso llega a una ventanita de verdad',
      () => !!BOTON.falla || BOTON.enchufado !== true,
      'hablarle a un `() => {}` es el mismo silencio con otro disfraz'],
    // 🔴 ESTE DETECTOR LO PIDIÓ LA SEGUNDA OPINIÓN, y es de contar, no de
    // correr: los dos oyentes se comprueban ejecutándolos, pero eso no impide
    // que alguien añada un TERCER sitio que prenda la marca. El que probó era
    // el peor: prenderla al TOCAR el mapa. Tocar no es elegir —la pantalla pide
    // «👆 Mantén presionado para ajustar»— así que un toque para agrandarlo
    // haría valer el relleno otra vez, y los detectores de arriba seguían
    // verdes porque los oyentes sí funcionaban.
    // Y QUE LOS OYENTES QUEDEN ENCHUFADOS. Un cuerpo perfecto en un oyente
    // desenchufado no sirve: arrastrar el marcador dejaría de marcar, y ésa es
    // la primera salida que nombró el dueño.
    ['el arrastre y el `idle` quedan enchufados al mapa   (ejecutado)',
      () => !!OYENTES.falla || !OYENTES.vivos.includes('dragstart')
        || !OYENTES.vivos.includes('idle'),
      'un oyente que se registra y se quita en el acto no lo ve ningún otro detector'],
    ['la marca solo se toca en los cuatro sitios que se ejecutan aquí',
      () => MARCA.fuera.length > 0 || MARCA.sitios !== 4,
      'una aparición fuera de esos cuatro es código que nadie está mirando'],
    // La decisión del dueño fue que hay DOS formas de decir dónde estás, y puso
    // el marcador por delante. Un aviso que solo diga «escribe la dirección»
    // deja fuera la mitad de lo que se decidió, y el pasajero no tiene por qué
    // adivinar que puede mover el pin.
    // 🔴 ÉSTE NO SE PUEDE EJECUTAR, Y SE DICE. Es un fallo de React puro: el
    // oyente se registra en un `useEffect` con `[]`, así que se queda con las
    // funciones del PRIMER dibujo — y con ellas, con un `ubicacionEsDelGps` que
    // en ese momento es siempre `false`: el GPS puede tardar hasta 28 segundos
    // en contestar (un intento de 8 y, si falla, otro de 20).
    // Correrlo aquí no lo enseñaría: haría falta React de verdad. Así que se
    // mira la FORMA, que es lo único honesto que se puede mirar: el oyente
    // tiene que llamar a través de un ref, nunca a una función del render.
    // Este fallo lo metí yo arreglando lo de la plaza, y lo cazó la segunda
    // opinión: al pasajero con GPS bueno dejaba de escribírsele la dirección.
    ['el oyente del mapa llama a la versión de AHORA, no a la del primer dibujo',
      () => {
        const o = elOyente('idle');
        if (o.falla) return true;
        const c = sinTextos(o.cuerpo);
        // Las dos mitades hacen falta: que llame a través de un ref, Y que NO
        // llame además a la función suelta. Con solo la primera, dejar las dos
        // llamadas —una al ref que no hace nada y la de siempre debajo— pasaba.
        return !/\.current\s*\(/.test(c) || /(?:^|[^.\w])resolverDireccion\s*\(/.test(c);
      },
      'con `[]` se queda con el estado del primer render, y el GPS llega después'],
    // Y QUE LO QUE SE MIDE SEA EL CAMINO QUE EL PASAJERO RECORRE. Si la
    // comprobación de «no dijiste dónde estás» se escribe de otra forma —sin
    // llaves, o mirando `origen === ''`—, el guion deja de encontrarla, corre la
    // cadena sin ella y los demás detectores siguen verdes aunque en la app el
    // botón se haya quedado mudo. Esta bandera se calculaba y no la leía nadie:
    // era justo la que avisaba de eso.
    // 🔴 LA PANTALLA NO PUEDE DECLARAR QUE EL RELLENO VIENE DEL APARATO.
    //
    // Es el otro valor de la guardia, y el que decide el 95% de los casos. La
    // segunda opinión abrió los DOS caminos a la plaza con una línea de aspecto
    // inofensivo: `setUbicacionEsDelGps(true)` en el camino de FALLO del GPS.
    // Con eso la app afirma «esto es del aparato» justo cuando los dos intentos
    // fallaron y lo que hay es la plaza. Se corre el efecto del GPS con un
    // aparato callado y se exige que la marca quede APAGADA.
    ['con el aparato callado, la pantalla no dice que la ubicación sea suya   (ejecutado)',
      () => {
        const r = busca('sin GPS y sin tocar nada');
        return !!r.falla || r.esDelGps !== false;
      },
      'si la app declara que el relleno es del GPS, la guardia queda muerta'],
    ['y esa marca arranca apagada',
      () => {
        const r = busca('sin GPS y sin tocar nada');
        return !!r.falla || r.arrancaEnFalse !== true;
      },
      'naciendo en `true`, la guardia está muerta antes de que el GPS diga nada'],
    ['la cadena que se mide incluye la comprobación de «no dijiste dónde estás»',
      () => !!CADENA.falla || !CADENA.conValidacion,
      'sin ella se mide un tramo por el que el pasajero sin GPS no pasa'],
    ['el aviso nombra el marcador, no solo escribir   (ejecutado)',
      () => !!AVISO.falla || !/marcador/i.test((AVISO.ejemplo || {}).texto || ''),
      'es una de las dos salidas que decidió el dueño, y la que puso primero'],
    // 🔴 LAS DOS PUERTAS DEL GPS TARDÍO (21-sep-2026).
    //
    // Es el MISMO daño que el del viaje que nacía en la plaza, entrando por
    // otro sitio: el conductor va a donde el pasajero no pidió, y el servidor
    // avisa a los conductores de ALREDEDOR DE ESE PUNTO. Son dos filas y no una
    // a propósito: las dos puertas se abren por motivos DISTINTOS —por el
    // arrastre porque `loEligio` sigue encendido, por la lista porque para
    // entonces `ubicacionEsDelGps` ya es `true`—, así que una guardia que
    // cerrara solo una dejaría la otra en verde.
    ['el GPS que llega tarde no le pisa el marcador al pasajero   (ejecutado)',
      () => {
        const r = busca('el GPS llega tarde, después de mover el marcador');
        return !!r.falla || !r.antesDelGps
          || !mismoPunto(r.antesDelGps.punto, r.punto)
          || r.antesDelGps.origen !== r.origen;
      },
      'el pasajero puso el pin donde está y el viaje nace donde el aparato diga'],
    ['ni la dirección que escogió de la lista   (ejecutado)',
      () => {
        const r = busca('el GPS llega tarde, después de escoger la dirección de la lista');
        return !!r.falla || !r.antesDelGps
          || !mismoPunto(r.antesDelGps.punto, r.punto)
          || r.antesDelGps.origen !== r.origen;
      },
      'el texto dice una cosa y el mapa otra, y el conductor va por el mapa'],
  ];

  // Y esto es lo que NO se puede romper arreglando lo de arriba. Va aparte para
  // que no se confunda con la lista de fallos: aquí «en verde» quiere decir que
  // lo que ya servía sigue sirviendo.
  const NOROMPER = [
    ['con GPS bueno y sin tocar nada, el viaje nace donde está el pasajero   (ejecutado)',
      () => {
        const r = busca('con GPS bueno, sin tocar nada');
        return !r.falla && !!r.coords && !esLaPlaza(r.coords)
          && r.coords.lat === r.delGps.lat && r.coords.lng === r.delGps.lng;
      }],
    ['moviendo el marcador, el viaje nace donde lo pusieron   (ejecutado)',
      () => {
        const r = busca('sin GPS, moviendo el marcador');
        return !r.falla && !!r.coords && !esLaPlaza(r.coords);
      }],
    ['una dirección escrita que sí se encuentra sigue valiendo   (ejecutado)',
      () => {
        const r = busca('sin GPS, escribiendo una dirección que SÍ se encuentra');
        return !r.falla && !!r.coords && !esLaPlaza(r.coords);
      }],
    // 🔴 ESTA FILA LA ENCONTRÓ UN SABOTAJE, no yo. Una guardia que mirase solo
    // si el pasajero eligió el punto —olvidándose del GPS— seguía haciendo
    // nacer el viaje en el sitio bueno, porque el respaldo del GPS lo salvaba.
    // Todo en verde. Pero el pasajero CON GPS se quedaba el campo «¿Dónde
    // estás?» vacío y tenía que escribir su dirección a mano, que es justo la
    // comodidad que la pantalla ya daba bien. Un arreglo que castiga al 95% por
    // cerrarle el paso al 5% no es un arreglo.
    ['con GPS bueno, la app sí escribe la dirección en el origen   (ejecutado)',
      () => {
        const r = busca('con GPS bueno, sin tocar nada');
        return !r.falla && !!r.origen;
      }],
    // 🔴 ESTA ES LA QUE IMPIDE «ARREGLARLO» APAGANDO EL RECENTRADO.
    //
    // La forma más fácil de que las dos filas de arriba salgan verdes es que el
    // mapa no se recentre NUNCA. Y sería peor que el fallo: al pasajero que
    // abre la pantalla y no toca nada —el 95%— dejaría de escribírsele la
    // dirección sola, que es lo que esta pantalla ya hacía bien. Por eso aquí
    // se EXIGE que con el GPS tardío y sin que el pasajero toque nada el mapa
    // SÍ se recentre y el viaje SÍ nazca en el aparato. Ese error exacto —
    // castigar al 95% por cerrarle el paso al 5%— ya se cometió una vez en esta
    // pantalla, y lo cazó la segunda opinión, no las pruebas.
    ['y si el pasajero no tocó nada, el GPS tardío sí manda   (ejecutado)',
      () => {
        const r = busca('el GPS llega tarde y el pasajero no tocó nada');
        return !r.falla && !!r.tardio && r.tardio.recentro === true
          && !!r.origen && !!r.coords && !esLaPlaza(r.coords)
          && r.coords.lat === r.delGps.lat && r.coords.lng === r.delGps.lng;
      }],
  ];

  // 🔴 EL VEREDICTO SE CIERRA AQUÍ DENTRO, NO SE DEVUELVE A MEDIO HACER.
  //
  // Antes devolvía las funciones y quien llamaba las ejecutaba después. Parece
  // igual y no lo es: cuando el amarre da una pantalla de mentira, la pantalla
  // vuelve a su sitio en cuanto `elVeredicto` termina — o sea ANTES de que
  // nadie ejecutara nada. Los detectores que miran el archivo en el momento de
  // ejecutarse leían entonces la pantalla BUENA y decían que todo estaba bien.
  // Así se escapó «tocar el mapa cuenta como elegir». Los que miran cosas ya
  // medidas (los escenarios, los oyentes) no se enteraban del problema, que es
  // lo que lo hacía difícil de ver: fallaban unos sí y otros no.
  //
  // Cerrándolo aquí, cualquier detector que se añada mañana queda a salvo de
  // esto sin tener que acordarse.
  return {
    salidas,
    FALLOS: FALLOS.map(([que, sigue, porQue]) => [que, sigue(), porQue]),
    NOROMPER: NOROMPER.map(([que, bien]) => [que, bien()]),
    ELVIAJE,
  };
}

// El informe de abajo NO se corre al importar este archivo: el amarre solo
// quiere el veredicto, no que se conecte al servidor en cada `npm test`.
module.exports = { elVeredicto, ESCENARIOS };
if (require.main !== module) return;

(async () => {
  console.log('');
  console.log(C.neg + '  DÓNDE NACE EL VIAJE' + C.off);
  console.log(C.gris + '  el punto de recogida con que se crea · ' + PANTALLA + C.off);
  console.log(C.gris + '  (NO es el mensaje de emergencia: ése es medir-boton-del-mapa.cjs)' + C.off);
  console.log('');

  const { salidas, FALLOS, NOROMPER, ELVIAJE } = await elVeredicto();

  console.log('  ' + C.neg + 'DÓNDE NACERÍA EL VIAJE, CORRIENDO EL CAMINO ENTERO' + C.off);
  for (const [nombre, , r] of salidas) {
    let dice;
    if (r.falla) dice = C.roj + 'no pude medirlo: ' + r.falla;
    else if (!r.coords) dice = C.ver + 'no se crea el viaje, y se dice por qué'
      + (r.avisos && r.avisos.length ? '' : C.roj + '  (¡pero SIN ventanita!)');
    else if (esLaPlaza(r.coords)) dice = C.roj + 'EN LA PLAZA';
    else dice = C.ver + 'en ' + r.coords.lat.toFixed(4) + ', ' + r.coords.lng.toFixed(4);
    console.log('    ' + pad(nombre, 52) + dice + C.off);
  }

  console.log('');
  console.log('  ' + C.neg + 'LO QUE DICE EL CÓDIGO DE HOY' + C.off);
  let puestos = 0;
  for (const [que, hay, porQue] of FALLOS) {
    if (hay) puestos += 1;
    console.log('    ' + (hay ? C.roj + 'PUESTO   ' : C.ver + 'arreglado') + C.off + '  ' + que);
    if (hay) console.log(C.gris + '                 ' + porQue + C.off);
  }
  console.log('');
  console.log(puestos === 0
    ? C.ver + '    ✓ los ' + FALLOS.length + ' están arreglados' + C.off
    : C.ama + '    ⚠ siguen puestos ' + puestos + ' de ' + FALLOS.length + C.off);

  console.log('');
  console.log('  ' + C.neg + 'Y LO QUE NO SE PUEDE ROMPER AL ARREGLARLO' + C.off);
  let rotos = 0;
  for (const [que, ok] of NOROMPER) {
    if (!ok) rotos += 1;
    console.log('    ' + (ok ? C.ver + 'sigue bien' : C.roj + 'ROTO      ') + C.off + '  ' + que);
  }
  if (rotos > 0) {
    console.log(C.roj + '    🔴 ' + rotos + ' cosa(s) que ya servían han dejado de servir.' + C.off);
  }

  // ── Y LO QUE NO ES DE ESTE TRABAJO, PERO SE DICE ────────────────────────
  // PRIMERA LEY: si al arreglar aparece otro problema, se ANOTA. Va FUERA de la
  // lista de fallos a propósito: un detector en rojo permanente por algo que se
  // decidió no arreglar deja el guion en amarillo para siempre, y un guion que
  // nunca puede decir «todo bien» es un guion que nadie vuelve a mirar.
  if (!ELVIAJE.falla && !ELVIAJE.marca) {
    console.log('');
    console.log('  ' + C.ama + 'ANOTADO (no es de este trabajo)' + C.off);
    console.log(C.gris + '    El viaje guardado no dice de dónde salió la coordenada. De los '
      + 'viajes ya creados' + C.off);
    console.log(C.gris + '    nadie puede saber cuáles nacieron de un GPS de verdad; desde hoy '
      + 'no hace falta para' + C.off);
    console.log(C.gris + '    que el viaje nazca bien, pero sí para poder medirlo después. '
      + 'Añadir un campo al viaje' + C.off);
    console.log(C.gris + '    es tocar el contrato entre las tres apps: va aparte, con permiso.'
      + C.off);
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
  const conductores = await traer(sesion, 'conductores');

  const ficha = (v) => {
    const f = v.fields || {};
    return {
      id: v.name.split('/').pop(),
      lat: val(f.pasajeroLat), lng: val(f.pasajeroLng),
      origen: val(f.origen) || '', destino: val(f.destino) || '',
      estado: val(f.estado) || '', conductor: val(f.conductorId) || '',
      fecha: (val(f.fechaSolicitud) || '').slice(0, 10),
      radio: val(f.radioBusqueda) || 3,
      claves: Object.keys(f),
    };
  };
  const todos = viajes.map(ficha);
  const conCoords = todos.filter((v) => typeof v.lat === 'number' && typeof v.lng === 'number');
  const enLaPlaza = conCoords.filter(
    (v) => v.lat === centroRiohacha.lat && v.lng === centroRiohacha.lng);

  console.log('    ' + pad('nacidos en la plaza', 26)
    + pad(enLaPlaza.length + ' de ' + todos.length, 12)
    + C.gris + 'exactamente (' + centroRiohacha.lat + ', ' + centroRiohacha.lng + ')' + C.off);

  if (enLaPlaza.length > 0) {
    // LOS DOS CAMINOS, SEPARADOS. Si el origen escrito es el mismo en todos,
    // son del camino 1 (lo escribió el mapa solo). Si alguno dice otra cosa, es
    // del camino 2: el pasajero escribió su dirección y las coordenadas se
    // quedaron en la plaza — ahí el texto y el mapa se contradicen.
    const porOrigen = {};
    for (const v of enLaPlaza) (porOrigen[v.origen] = porOrigen[v.origen] || []).push(v);
    const cuantosOrigenes = Object.keys(porOrigen).length;
    const ultima = enLaPlaza.map((v) => v.fecha).sort().pop();
    console.log(C.gris + '      el más nuevo es del ' + ultima + '; origen escrito: '
      + (enLaPlaza[0].origen || '(vacío)') + C.off);
    if (cuantosOrigenes === 1) {
      console.log(C.gris + '      los ' + enLaPlaza.length + ' con EL MISMO origen escrito: lo '
        + 'puso el mapa solo, no el pasajero.' + C.off);
    } else {
      console.log(C.gris + '      ' + cuantosOrigenes + ' orígenes escritos distintos: hay más '
        + 'de un camino a la plaza.' + C.off);
    }
    const tomados = enLaPlaza.filter((v) => v.conductor).length;
    console.log(C.gris + '      ' + tomados + ' de los ' + enLaPlaza.length + ' los tomó un '
      + 'conductor: fue allí a buscar a alguien que podía' + C.off);
    console.log(C.gris + '      estar en cualquier otro sitio.' + C.off);

    // EL CONTRASTE. Saber que 4 acabaron mal no dice nada por sí solo: hay que
    // compararlo con cómo acaban los demás. Se cuenta sobre los que YA
    // terminaron —comparar uno vivo con uno acabado no mide nada— y el final
    // bueno es UNO: `finalizado`. La lista sale de `estadosViaje.js`, que es
    // donde vive (SEGUNDA LEY); escribirla aquí sería la segunda copia.
    const acabo = (v) => ESTADOS_TERMINADOS.includes(v.estado);
    const malAcabo = (v) => acabo(v) && v.estado !== 'finalizado';
    const plazaAcabados = enLaPlaza.filter(acabo);
    const restoAcabados = conCoords.filter((v) => !enLaPlaza.includes(v) && acabo(v));
    const pct = (a, b) => (b === 0 ? '—' : Math.round((a / b) * 100) + '%');
    const malPlaza = plazaAcabados.filter(malAcabo).length;
    const malResto = restoAcabados.filter(malAcabo).length;
    console.log(C.gris + '      acabaron SIN completarse: ' + malPlaza + ' de '
      + plazaAcabados.length + ' (' + pct(malPlaza, plazaAcabados.length) + ') de los nacidos '
      + 'en la plaza,' + C.off);
    console.log(C.gris + '      contra ' + malResto + ' de ' + restoAcabados.length + ' ('
      + pct(malResto, restoAcabados.length) + ') de todos los demás. Son pocos viajes y son de '
      + 'prueba,' + C.off);
    console.log(C.gris + '      así que esto NO demuestra la causa; lo que sí se ve es que '
      + 'ninguno se completó.' + C.off);
  }

  // Los que quedaron CERCA pero no exactos: podrían ser gente que arrastró el
  // mapa un poco desde el relleno, o gente que de verdad estaba por allí. No se
  // pueden distinguir, y se dice así en vez de contarlos como culpables.
  const cerquita = conCoords.filter((v) => {
    if (v.lat === centroRiohacha.lat && v.lng === centroRiohacha.lng) return false;
    return calcularDistanciaKm(v.lat, v.lng, centroRiohacha.lat, centroRiohacha.lng) < 0.3;
  });
  console.log('    ' + pad('cerca de la plaza', 26)
    + pad(cerquita.length + ' de ' + todos.length, 12)
    + C.gris + 'a menos de 300 m, sin ser el punto exacto' + C.off);

  // ¿Hay alguna forma de saberlo DESPUÉS? Si ningún viaje guarda una marca de
  // procedencia, la respuesta es no: de los viajes ya guardados no se puede
  // saber cuáles nacieron de un GPS de verdad.
  const conMarca = todos.filter((v) => v.claves.some(
    (k) => /gps|precisi|exact|aproxim|relleno|fuente/i.test(k)));
  console.log('    ' + pad('dicen de dónde salió', 26)
    + pad(conMarca.length + ' de ' + todos.length, 12)
    + C.gris + 'viajes que guardan si la coordenada era del aparato' + C.off);

  // A QUIÉN SE AVISÓ. El servidor manda el aviso a los conductores activos que
  // estén dentro del radio DE ESE PUNTO. Si el punto es la plaza, el aviso sale
  // desde la plaza: a los de allí les llega, y a los que de verdad tenían cerca
  // al pasajero, no. Esto no es una suposición — es la misma cuenta que hace
  // `tokensConductoresCerca` en el servidor.
  const activos = conductores.map((c) => {
    const f = c.fields || {};
    const u = val(f.ubicacion);
    return {
      activo: val(f.activo) === true, token: !!val(f.fcmToken),
      lat: u && u.lat ? val(u.lat) : undefined, lng: u && u.lng ? val(u.lng) : undefined,
    };
  }).filter((c) => c.activo && c.token);
  const ubicados = activos.filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number');
  console.log('    ' + pad('conductores avisables', 26) + pad(activos.length + '', 12)
    + C.gris + 'activos y con aviso; ' + ubicados.length + ' con ubicación guardada' + C.off);
  if (enLaPlaza.length > 0 && ubicados.length > 0) {
    const cuentas = enLaPlaza.map((v) => ubicados.filter(
      (c) => calcularDistanciaKm(v.lat, v.lng, c.lat, c.lng) <= (v.radio || 3)).length);
    console.log(C.gris + '      el aviso de esos ' + enLaPlaza.length + ' salió DESDE LA PLAZA: '
      + 'alcanzó a ' + cuentas.join(', ') + ' de ' + ubicados.length + ' conductores.' + C.off);
    // 🔴 SE DICE LO QUE SE MIDIÓ, NO LO QUE SUENA BIEN.
    //
    // Aquí había una frase —«que son los cercanos a la plaza, no los cercanos
    // al pasajero»— debajo de un «6, 6, 6, 6» que la desmentía: con 6 de 6
    // alcanzados no se quedó fuera nadie. Lo cazó la segunda opinión. El
    // mecanismo es real y está en el código del servidor, pero eso es el
    // código, no la cuenta; y una suposición vestida de medida es lo que este
    // proyecto persigue. Así que la cuenta dice lo suyo, y cuando no hay nada
    // que enseñar, lo dice también.
    const fuera = cuentas.filter((n) => n < ubicados.length).length;
    console.log(C.gris + '      ' + (fuera > 0
      ? fuera + ' de ellos NO alcanzaron a todos: ésos son conductores que el pasajero pudo '
        + 'tener cerca y no se enteraron.'
      : 'con tan pocos conductores todos caían dentro del radio igual, así que aquí NO se '
        + 've daño.') + C.off);
    console.log(C.gris + '      Lo que sí se sabe es POR DÓNDE pasa: el servidor busca alrededor '
      + 'del punto del viaje' + C.off);
    console.log(C.gris + '      (`tokensConductoresCerca`), y ese punto era la plaza. Con más '
      + 'conductores, se notaría.' + C.off);
  }

  console.log('');
  console.log(C.gris + '  (esto mide ESE camino, para el paso 1 y el 12. Quien vigila a diario es'
    + C.off);
  console.log(C.gris + '   `pruebas/amarres.test.js`.)' + C.off);
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
