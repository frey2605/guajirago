// ══════════════════════════════════════════════════════════════════════════════
//  LA CASA COMÚN PARA LEER DATOS DE FIRESTORE
//
//  🔴 Por qué existe, recontado el 24-sep-2026 antes de escribirla: `token()` está
//  escrito en 29 guiones y en CINCO versiones distintas; `traer()` en 24 y en SIETE.
//  O sea que la SEGUNDA LEY ya se rompió sola — «uno de los dos se queda viejo, y es
//  el que nadie mira», y aquí son cinco y siete.
//
//  🔑 Todo lo que decide está separado de la red a propósito: `quePuertaHay` es pura
//  y `token`/`traer` aceptan un `fetch` de mentira. Por eso esta prueba corre SIN
//  llave, SIN sesión y SIN internet — que es la única forma de comprobar que la casa
//  se queja cuando toca.
// ══════════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { quePuertaHay, armarJwt, token, traer, val, doc, SES } = require('../scripts/nube.cjs');

const nunca = () => false;
const siempre = () => true;

describe('LA CASA COMÚN · las dos puertas', () => {
  it('con la llave de servicio puesta, entra por ahí', () => {
    const p = quePuertaHay({ GOOGLE_APPLICATION_CREDENTIALS: '/llave.json' }, siempre);
    assert.strictEqual(p.puerta, 'servicio');
  });

  it('sin llave pero con la sesión del PC, entra por el PC', () => {
    const p = quePuertaHay({}, (r) => r === SES);
    assert.strictEqual(p.puerta, 'cli');
  });

  //  La llave de servicio va PRIMERO: si alguien la puso, es porque quiere usarla.
  it('si están las dos, manda la llave de servicio', () => {
    const p = quePuertaHay({ GOOGLE_APPLICATION_CREDENTIALS: '/llave.json' }, siempre);
    assert.strictEqual(p.puerta, 'servicio',
      '⛔ con la llave puesta se usó la sesión del PC. En la nube no hay sesión del PC, así que ' +
      'el guion funcionaría en un sitio y no en el otro sin decir por qué');
  });

  //  🔴 LO QUE MÁS IMPORTA: sin puerta NO se devuelve una lista vacía. Un lector sin
  //   llave que conteste «no hay viajes» en vez de «no pude mirar» es la peor mentira
  //   que puede contar un medidor, porque se lee como un dato.
  it('🔴 sin ninguna puerta, se queja — NO devuelve vacío', () => {
    const p = quePuertaHay({}, nunca);
    assert.strictEqual(p.puerta, null);
    assert.ok(p.porque && p.comoSeArregla.length, 'tiene que decir qué pasa y cómo se arregla');
  });

  it('y si la llave apunta a un archivo que no existe, lo dice en vez de callarse', () => {
    const p = quePuertaHay({ GOOGLE_APPLICATION_CREDENTIALS: '/no/esta.json' }, nunca);
    assert.strictEqual(p.puerta, null);
    assert.ok(p.porque.includes('/no/esta.json'), 'tiene que nombrar el archivo que falta');
  });

  it('pedir el permiso sin puerta revienta con una explicación, no con un vacío', async () => {
    await assert.rejects(
      () => token({ env: {}, existe: nunca, fetch: () => { throw new Error('no debería llamar'); } }),
      (e) => e.sinPuerta === true && /DOS formas/.test(e.message),
      '⛔ sin puerta tiene que explicar las dos formas de abrirla',
    );
  });
});

describe('LA CASA COMÚN · traer una colección ENTERA', () => {
  //  Una red de mentira que da la colección en tres páginas. Si el lector se quedara
  //  con la primera —que es lo que hacen tres de los 31— devolvería 1 de 3.
  const redDeTresPaginas = () => {
    const paginas = {
      '': { documents: [{ name: 'a/1' }], nextPageToken: 'p2' },
      p2: { documents: [{ name: 'a/2' }], nextPageToken: 'p3' },
      p3: { documents: [{ name: 'a/3' }] },
    };
    const vistas = [];
    const red = async (url) => {
      const m = /pageToken=([^&]*)/.exec(url);
      const k = m ? m[1] : '';
      vistas.push(k);
      return { ok: true, json: async () => paginas[k] };
    };
    return { red, vistas };
  };

  it('🔴 sigue TODAS las páginas: 3 de 3, no 1 de 3', async () => {
    const { red, vistas } = redDeTresPaginas();
    const r = await traer('negocios', { permiso: 'x', fetch: red });
    assert.strictEqual(r.length, 3,
      '⛔ se quedó con ' + r.length + ' de 3. Es el fallo que tienen tres de los 31 guiones: ' +
      'piden 300 y no siguen leyendo, así que el 301 desaparece sin que nada avise.');
    assert.deepStrictEqual(vistas, ['', 'p2', 'p3'], 'tiene que pedir las tres páginas, en orden');
  });

  it('una colección vacía son cero documentos, no un error', async () => {
    const red = async () => ({ ok: true, json: async () => ({}) });
    assert.deepStrictEqual(await traer('vacia', { permiso: 'x', fetch: red }), []);
  });

  it('🔴 si Google contesta un error, REVIENTA — no devuelve media lista', async () => {
    const red = async () => ({ ok: false, status: 403, json: async () => ({}) });
    await assert.rejects(() => traer('negocios', { permiso: 'x', fetch: red }), /403/,
      '⛔ un error tiene que reventar. Devolver lo que llevaba sería contar media colección ' +
      'como si fuera entera, y nadie lo notaría');
  });
});

describe('LA CASA COMÚN · leer un campo de cualquier tipo', () => {
  //  🔴 Las versiones de hoy nombran de UNO a SIETE tipos. Las que nombran uno leen
  //   bien los textos y devuelven `undefined` para todo lo demás — y un `undefined`
  //   se lee igual que «estaba vacío».
  it('lee los tipos sencillos', () => {
    assert.strictEqual(val({ stringValue: 'hola' }), 'hola');
    assert.strictEqual(val({ booleanValue: true }), true);
    assert.strictEqual(val({ doubleValue: 1.5 }), 1.5);
    assert.strictEqual(val({ integerValue: '42' }), 42);
    assert.strictEqual(val({ nullValue: null }), null);
    assert.strictEqual(val(undefined), undefined);
  });

  //  Google manda los enteros como TEXTO. Pasarlos a número está bien hasta que un
  //  identificador se pasa de lo que un número aguanta sin perder dígitos.
  it('🔴 un entero gigante se queda como texto, para no perder dígitos', () => {
    const gigante = '9007199254740993';
    assert.strictEqual(val({ integerValue: gigante }), gigante,
      '⛔ se convirtió a número y perdió un dígito. Un identificador mal leído es peor que ' +
      'uno incómodo');
  });

  it('lee mapas y listas, por dentro', () => {
    assert.deepStrictEqual(val({
      mapValue: { fields: { a: { stringValue: 'x' }, b: { integerValue: '2' } } },
    }), { a: 'x', b: 2 });
    assert.deepStrictEqual(val({
      arrayValue: { values: [{ stringValue: 'u' }, { booleanValue: false }] },
    }), ['u', false]);
  });

  it('lee una ubicación', () => {
    assert.deepStrictEqual(val({ geoPointValue: { latitude: 11.5, longitude: -72.9 } }),
      { lat: 11.5, lng: -72.9 });
  });

  it('y un documento entero sale con su id y sus campos', () => {
    assert.deepStrictEqual(doc({
      name: 'projects/p/databases/(default)/documents/viajes/ABC',
      fields: { estado: { stringValue: 'finalizado' }, tarifa: { integerValue: '8000' } },
    }), { id: 'ABC', estado: 'finalizado', tarifa: 8000 });
  });

  it('un tipo que no conoce se ANOTA, no se calla', () => {
    const { tiposQueNoSupe } = require('../scripts/nube.cjs');
    val({ tipoInventadoDeGoogle: 1 });
    assert.ok(tiposQueNoSupe().includes('tipoInventadoDeGoogle'),
      '⛔ un tipo desconocido devolvería `undefined` y se leería como «estaba vacío». Tiene que ' +
      'quedar anotado para que el guion lo pueda decir (REGLA 9)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  LA PUERTA QUE NADIE HA USADO NUNCA
//
//  🔴 La sesión del PC lleva meses funcionando: si se rompiera, se notaría el mismo
//  día. La llave de servicio NO la ha usado nadie todavía, así que es justo la mitad
//  que puede estar mal sin que nadie se entere — hasta el día que haga falta, desde
//  el celular, con prisa.
//
//  Se prueba con una llave RSA hecha aquí mismo: no hay ningún secreto de verdad en
//  juego, y aun así se comprueba lo que de verdad importa — que Google podría
//  verificar esa firma.
describe('LA CASA COMÚN · la llave de servicio firma de verdad', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const CORREO = 'prueba@guajirago.iam.gserviceaccount.com';
  const jwt = armarJwt({ client_email: CORREO, private_key: privateKey }, 1758700000);
  const [cab, cuerpo, firma] = jwt.split('.');
  const leer = (x) => JSON.parse(Buffer.from(x, 'base64url').toString());

  it('🔴 la firma se puede VERIFICAR con la llave pública', () => {
    const buena = crypto.createVerify('RSA-SHA256').update(cab + '.' + cuerpo).end()
      .verify(publicKey, Buffer.from(firma, 'base64url'));
    assert.ok(buena,
      '⛔ la firma no vale. Google rechazaría la llave de servicio y el guion moriría en la ' +
      'nube con un error de permisos que no es de permisos');
  });

  it('pide exactamente el permiso de LEER datos, ni más ni menos', () => {
    assert.strictEqual(leer(cuerpo).scope, 'https://www.googleapis.com/auth/datastore',
      '⛔ un ámbito de más es permiso de más: esta casa solo LEE');
  });

  it('va dirigido a Google y dura una hora', () => {
    const c = leer(cuerpo);
    assert.strictEqual(c.aud, 'https://oauth2.googleapis.com/token');
    assert.strictEqual(c.iss, CORREO);
    assert.strictEqual(c.exp - c.iat, 3600,
      '⛔ Google rechaza los que duran más de una hora');
  });

  it('y dice que es RS256, que es lo que Google espera', () => {
    assert.deepStrictEqual(leer(cab), { alg: 'RS256', typ: 'JWT' });
  });
});
