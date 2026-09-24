#!/usr/bin/env node
/**
 * ☁️ LA CASA COMÚN PARA LEER DATOS DE FIRESTORE
 *
 * 🔴 POR QUÉ EXISTE, medido el 24-sep-2026 y recontado antes de escribir esto:
 *   · `token()`  lo tienen **29** guiones, en **5 versiones distintas**
 *   · `traer()`  lo tienen **24** guiones, en **7 versiones distintas**
 *   · `val()`    lo tienen **24** guiones
 *
 *  O sea que la SEGUNDA LEY ya se rompió sola: el mismo trabajo escrito veintitantas
 *  veces, y ya NO se porta igual. «Uno de los dos se queda viejo, y es el que nadie
 *  mira» — aquí son cinco y siete.
 *
 *  `pruebas/cargar.cjs` es la casa común para leer CÓDIGO. Ésta es la de leer DATOS.
 *
 * 🔑 DOS PUERTAS, y es decisión del dueño (22-sep-2026). Los 31 guiones de hoy solo
 *  saben abrir la sesión del `firebase` del PC, así que **ninguno corre desde el
 *  celular**. Esta casa acepta las dos:
 *
 *    · la LLAVE DE SERVICIO  (`GOOGLE_APPLICATION_CREDENTIALS`) → sirve en la nube
 *    · la SESIÓN DEL CLI     (el `firebase login` del PC)       → sirve en el PC
 *
 *  Con las dos, el mismo guion corre en los dos sitios — y por eso se puede CAREAR
 *  lo que decía antes con lo que dice después, que es el huevo y gallina que la
 *  tabla de deuda dejó escrito.
 *
 * 🔴 NO SE TOCA NINGUNO DE LOS 31. Lo dice la tabla de deuda con todas las letras:
 *  «el primer trabajo es construir la casa común con su amarre SIN TOCAR ninguno de
 *  los 31; migrar va después, de a uno y careando». Siete archivos de `pruebas/`
 *  importan quince de esos guiones, así que moverlos a ciegas pone rojas las pruebas.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROYECTO = 'guajirago';
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

// Los datos del CLI de firebase, para la puerta del PC. Son públicos: vienen dentro
// del propio `firebase-tools`, no son un secreto de nadie.
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

const AMBITO = 'https://www.googleapis.com/auth/datastore';

/**
 * ¿QUÉ PUERTA HAY ABIERTA? Función PURA: recibe el entorno y qué archivos existen,
 * y dice por dónde se puede entrar. Se separa de la llamada a propósito, para que la
 * prueba pueda darle casos de mentira sin llave y sin red.
 *
 * La llave de servicio va PRIMERO: si alguien la puso, es porque quiere usarla. La
 * sesión del PC es el respaldo, no al revés.
 */
function quePuertaHay(env, existe) {
  const llave = (env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (llave) {
    if (!existe(llave)) {
      return {
        puerta: null,
        porque: 'GOOGLE_APPLICATION_CREDENTIALS apunta a «' + llave + '» y ahí no hay nada.',
        comoSeArregla: [
          '   Esa variable tiene que apuntar al archivo .json de la llave de servicio.',
          '   Si lo que querías era usar la sesión del PC, quita la variable.',
        ],
      };
    }
    return { puerta: 'servicio', ruta: llave };
  }
  if (existe(SES)) return { puerta: 'cli', ruta: SES };
  return {
    puerta: null,
    porque: 'no hay ni llave de servicio ni sesión de firebase abierta.',
    comoSeArregla: [
      '   Hay DOS formas, y sirve cualquiera:',
      '     · en la nube: pon la llave de servicio en GOOGLE_APPLICATION_CREDENTIALS',
      '     · en el PC:   corre `npx firebase login`',
      '   🔴 Y esto NO se queda callado a propósito: un lector sin llave que devuelva',
      '      una lista vacía diría «no hay viajes» en vez de «no pude mirar».',
    ],
  };
}

/** Firma el JWT que pide Google para canjear una llave de servicio por un permiso. */
function armarJwt(llave, ahora) {
  const cab = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const cuerpo = Buffer.from(JSON.stringify({
    iss: llave.client_email,
    scope: AMBITO,
    aud: 'https://oauth2.googleapis.com/token',
    iat: ahora,
    exp: ahora + 3600,
  })).toString('base64url');
  const firma = crypto.createSign('RSA-SHA256').update(cab + '.' + cuerpo).end()
    .sign(llave.private_key, 'base64url');
  return cab + '.' + cuerpo + '.' + firma;
}

/** El permiso para leer. Abre por la puerta que haya, y si no hay ninguna lo DICE. */
async function token(opciones = {}) {
  const env = opciones.env || process.env;
  const existe = opciones.existe || ((r) => fs.existsSync(r));
  const pedir = opciones.fetch || fetch;
  const p = quePuertaHay(env, existe);
  if (!p.puerta) {
    const e = new Error('No puedo leer los datos: ' + p.porque + '\n' + p.comoSeArregla.join('\n'));
    e.sinPuerta = true;
    throw e;
  }

  const cuerpo = p.puerta === 'servicio'
    ? (() => {
      const llave = JSON.parse(fs.readFileSync(p.ruta, 'utf8'));
      return new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: armarJwt(llave, Math.floor(Date.now() / 1000)),
      });
    })()
    : (() => {
      const j = JSON.parse(fs.readFileSync(p.ruta, 'utf8'));
      const refresco = j.tokens && j.tokens.refresh_token;
      if (!refresco) throw new Error('la sesión de firebase del PC no tiene refresh_token: '
        + 'corre `npx firebase login` otra vez');
      return new URLSearchParams({
        client_id: CI, client_secret: CS, refresh_token: refresco, grant_type: 'refresh_token',
      });
    })();

  const r = await pedir('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  const x = await r.json();
  if (!x.access_token) {
    throw new Error('no pude abrir sesión por la puerta «' + p.puerta + '»: '
      + JSON.stringify(x).slice(0, 300));
  }
  return { permiso: x.access_token, puerta: p.puerta };
}

/**
 * 🔴 TRAE UNA COLECCIÓN ENTERA, Y «ENTERA» ES LA PALABRA.
 *
 *  De los 31 guiones de hoy, TRES piden `pageSize=300` y NO siguen el `nextPageToken`
 *  (está en la tabla de deuda): al pasar de 300 negocios, el 301 desaparece sin que
 *  nada avise. Y el peor de los tres ESCRIBE. Aquí no se puede: el bucle sigue hasta
 *  que Google deja de dar página, y no hay forma de pedir «solo un trozo».
 */
async function traer(coleccion, opciones = {}) {
  const permiso = opciones.permiso || (await token(opciones)).permiso;
  const pedir = opciones.fetch || fetch;
  const todos = [];
  let pagina;
  let vueltas = 0;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    // eslint-disable-next-line no-await-in-loop
    const r = await pedir(url, { headers: { Authorization: 'Bearer ' + permiso } });
    if (!r.ok) throw new Error('no pude leer «' + coleccion + '»: ' + r.status);
    // eslint-disable-next-line no-await-in-loop
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
    vueltas += 1;
    // Un tope de seguridad, y si se alcanza SE DICE: mejor reventar que devolver
    // media colección como si fuera entera.
    if (vueltas > 5000) throw new Error('«' + coleccion + '» no deja de dar páginas ('
      + vueltas + '): algo va mal y prefiero parar que devolver la mitad');
  } while (pagina);
  return todos;
}

// Los tipos de campo que este lector no supo leer. Si queda alguno, el guion que lo
// use puede decirlo en vez de firmar un `undefined` que parece «estaba vacío».
const TIPOS_QUE_NO_SUPE = [];

/**
 * Lee un campo de Firestore, sea del tipo que sea.
 *
 * 🔴 Las versiones de hoy nombran de UNO a SIETE tipos: las que nombran uno leen bien
 *  los textos y devuelven `undefined` para todo lo demás — y un `undefined` se lee
 *  igual que «estaba vacío». Ésta los conoce todos, y **el tipo que no conozca lo
 *  ANOTA** en vez de callarlo (REGLA 9).
 */
function val(v) {
  if (v == null) return undefined;
  if ('nullValue' in v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('integerValue' in v) {
    // Google manda los enteros como TEXTO. Pasarlos a número está bien hasta que un
    // identificador se pasa de lo que un número aguanta sin perder dígitos: ahí se
    // deja como texto, porque un id mal leído es peor que un id incómodo.
    const n = Number(v.integerValue);
    return Number.isSafeInteger(n) ? n : v.integerValue;
  }
  if ('geoPointValue' in v) {
    return { lat: v.geoPointValue.latitude, lng: v.geoPointValue.longitude };
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  if ('mapValue' in v) {
    const campos = (v.mapValue && v.mapValue.fields) || {};
    const o = {};
    for (const k of Object.keys(campos)) o[k] = val(campos[k]);
    return o;
  }
  const tipo = Object.keys(v)[0] || '(vacío)';
  if (!TIPOS_QUE_NO_SUPE.includes(tipo)) TIPOS_QUE_NO_SUPE.push(tipo);
  return undefined;
}

/** Un documento entero, con su nombre corto y sus campos ya leídos. */
function doc(d) {
  const campos = d.fields || {};
  const o = { id: (d.name || '').split('/').pop() };
  for (const k of Object.keys(campos)) o[k] = val(campos[k]);
  return o;
}

module.exports = {
  PROYECTO, BASE, SES,
  quePuertaHay, armarJwt, token, traer, val, doc,
  tiposQueNoSupe: () => [...TIPOS_QUE_NO_SUPE],
};
