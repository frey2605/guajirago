/**
 * G10 · ¿EL CONTACTO DE EMERGENCIA SIRVE? (28-sep-2026)
 *
 * El registro (Login.js) exigía 10 cifras; Seguridad.js, al cambiarlo, solo que no
 * estuviera vacío. «300 123 45» se guardaba y el botón de emergencia abría
 * wa.me/5730012345 (no existe); «abc» abría wa.me/57 (no avisa a nadie).
 * Ahora hay UNA regla, guajirago/src/telefonoValido.js, y esta prueba la EJECUTA:
 *
 *   1. la regla, con números de mentira;
 *   2. el `registrarse` de Login.js y el `guardar` de Seguridad.js, sacados del archivo y
 *      corridos con la base de mentira: con un número que no sirve NO se guarda nada;
 *   3. los DOS botones de emergencia (`compartirUbicacion` de Seguridad.js y
 *      `compartirSeguridad` de Solicitar.js), corridos igual: nunca abren un número roto,
 *      y si el guardado no sirve lo dicen;
 *   4. nadie más escribe `contactoConfianzaNumero` sin pasar por la regla.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion } = require('./cargar.cjs');

const PIEZA = 'guajirago/src/telefonoValido.js';
const { celularDiezCifras, telefonoSirve } = cargarDeLaApp(PIEZA);

// Saca `const <nombre> = async () => { … }` del archivo y lo devuelve listo para correr
// con las variables que se le den (lo que no se le dé revienta: así no se inventa nada).
function laFuncion(archivo, nombre) {
  const codigo = leer(archivo);
  const desde = codigo.indexOf('const ' + nombre + ' = ');
  assert.ok(desde >= 0, 'no está `const ' + nombre + '` en ' + archivo);
  assert.strictEqual(codigo.indexOf('const ' + nombre + ' = ', desde + 1), -1,
    'hay DOS `const ' + nombre + '` en ' + archivo + ': no sé cuál es el de verdad');
  const cuerpo = cuerpoDeLaFuncion(codigo, desde);
  assert.ok(cuerpo, 'no pude sacar el cuerpo de ' + nombre);
  // eslint-disable-next-line no-new-func
  const f = new Function('ambito', 'with (ambito) { return (async () => {' + cuerpo.texto + '\n})(); }');
  return (ambito) => f(ambito);
}

// Todo lo que exporta la pieza (desde G41 también `numeroWhatsApp` y `enlaceWhatsApp`, que usan los botones).
const REGLA = cargarDeLaApp(PIEZA);

describe('G10 · la regla: ¿este teléfono sirve?', () => {
  const SIRVEN = [
    ['3001234567', '3001234567'],
    ['300 123 4567', '3001234567'],
    ['300-123-4567', '3001234567'],
    ['(300) 123.4567', '3001234567'],
    ['+57 3001234567', '3001234567'],
    ['57 300 123 4567', '3001234567'],
    ['  3001234567  ', '3001234567'],
    ['5712345678', '5712345678'], // 10 cifras que empiezan por 57: es el número, no el indicativo
  ];
  const NO_SIRVEN = ['', '   ', 'abc', '300 123 45', '30012345678', '+1 3001234567', '573001234',
    '300123456x', '300 123 4567 ext 2', '++573001234567', null, undefined];

  for (const [dado, sale] of SIRVEN) {
    it('sirve «' + dado + '» → ' + sale, () => {
      assert.strictEqual(celularDiezCifras(dado), sale);
      assert.strictEqual(telefonoSirve(dado), true);
    });
  }
  for (const dado of NO_SIRVEN) {
    it('NO sirve «' + dado + '»', () => {
      assert.strictEqual(celularDiezCifras(dado), '');
      assert.strictEqual(telefonoSirve(dado), false);
    });
  }
});

describe('G10 · los formularios no guardan un contacto que no sirve', () => {
  function ambitoSeguridad(numero, escrito) {
    return {
      ...REGLA,
      contactoNombre: 'Mamá',
      contactoNumero: numero,
      setError: (t) => { escrito.error = t; },
      setGuardando: () => {}, setMensaje: () => {}, setHayCambios: () => {},
      setEditandoNombre: () => {}, setEditandoNumero: () => {},
      auth: { currentUser: { uid: 'u1' } },
      db: {},
      doc: () => ({}),
      setDoc: async (_ref, datos) => { escrito.guardado = datos; },
    };
  }

  it('Seguridad (`guardar`): «300 123 45» y «abc» NO se guardan, y se dice', async () => {
    const guardar = laFuncion('guajirago/src/Seguridad.js', 'guardar');
    for (const malo of ['300 123 45', 'abc', '30012345678']) {
      const escrito = {};
      await guardar(ambitoSeguridad(malo, escrito));
      assert.strictEqual(escrito.guardado, undefined, 'Seguridad guardó «' + malo + '»');
      assert.match(escrito.error || '', /10 cifras/, 'no le dijo al pasajero por qué no guardó «' + malo + '»');
    }
  });

  it('Seguridad (`guardar`): «+57 3001234567» y «300 123 4567» SÍ se guardan', async () => {
    const guardar = laFuncion('guajirago/src/Seguridad.js', 'guardar');
    for (const bueno of ['+57 3001234567', '300 123 4567']) {
      const escrito = {};
      await guardar(ambitoSeguridad(bueno, escrito));
      assert.ok(escrito.guardado, 'Seguridad no guardó «' + bueno + '»: ' + escrito.error);
      // G42: se guarda en UN solo formato, las 10 cifras limpias (antes, tal cual se escribió).
      assert.strictEqual(escrito.guardado.contactoConfianzaNumero, '3001234567');
    }
  });

  function ambitoLogin(numero, escrito) {
    const llego = new Error('llegó a crear la cuenta');
    llego.code = 'prueba/llego';
    return {
      ...REGLA,
      nombre: 'Ana', email: 'a@b.co', emailConfirm: 'a@b.co', celular: '3001112233',
      diaNac: '1', mesNac: '2', anioNac: '1990', password: 'secreta1', passwordConfirm: 'secreta1',
      contactoNombre: 'Mamá', contactoNumero: numero, aceptaTerminos: true,
      setError: (t) => { escrito.error = t; }, setEnviando: () => {},
      auth: {},
      createUserWithEmailAndPassword: async () => { escrito.creo = true; throw llego; },
    };
  }

  it('Registro (`registrarse`): con «300 123 45» NO crea la cuenta; con «+57 300 123 4567» sí', async () => {
    const registrarse = laFuncion('guajirago/src/Login.js', 'registrarse');
    const malo = {};
    await registrarse(ambitoLogin('300 123 45', malo));
    assert.strictEqual(malo.creo, undefined, 'el registro creó la cuenta con «300 123 45»');
    assert.match(malo.error || '', /10 d[ií]gitos|10 cifras/);
    for (const bueno of ['+57 300 123 4567', '3001234567']) {
      const e = {};
      await registrarse(ambitoLogin(bueno, e));
      assert.strictEqual(e.creo, true, 'el registro no dejó pasar «' + bueno + '»: ' + e.error);
    }
  });
});

describe('G10 · los botones de emergencia no abren un número roto', () => {
  async function ajustes(numero) {
    const compartir = laFuncion('guajirago/src/Seguridad.js', 'compartirUbicacion');
    const r = { errores: [] };
    await compartir({
      ...REGLA,
      contactoNumero: numero,
      setError: (t) => { if (t) r.errores.push(t); },
      ubicacionDeAhora: async () => ({ punto: null, de: null }),
      auth: { currentUser: null },
      armarMensajeDeEmergencia: () => 'AUXILIO',
      window: { open: (url) => { r.url = url; return {}; } },
    });
    return r;
  }

  async function mapa(numero) {
    const compartir = laFuncion('guajirago/src/Solicitar.js', 'compartirSeguridad');
    const r = { avisos: [] };
    await compartir({
      ...REGLA,
      contactoEmergencia: numero,
      pantalla: 'fase2', ubicacionConductor: null, ubicacionEsDelGps: false, ubicacionPasajero: null,
      viaje: { id: 'v1' },
      ubicacionDeAhora: async () => ({ punto: null, de: null }),
      armarMensajeDeEmergencia: () => 'AUXILIO',
      setAviso: (a) => { if (a) r.avisos.push(a); },
      window: { open: (url) => { r.url = url; return {}; } },
    });
    return r;
  }

  const numeroDe = (url) => (url.match(/^https:\/\/wa\.me\/(\d*)\?/) || [])[1];

  for (const [nombre, correr, avisos] of [['Ajustes (Seguridad.js)', ajustes, 'errores'], ['🚨 del mapa (Solicitar.js)', mapa, 'avisos']]) {
    it(nombre + ': un número bueno va a wa.me/57 + sus 10 cifras', async () => {
      for (const bueno of ['3001234567', '+57 3001234567', '300 123 4567', '5712345678']) {
        const r = await correr(bueno);
        assert.strictEqual(numeroDe(r.url), '57' + celularDiezCifras(bueno), nombre + ' con «' + bueno + '» abrió ' + r.url);
        assert.strictEqual(r[avisos].length, 0, nombre + ' avisó de más con «' + bueno + '»');
      }
    });

    it(nombre + ': «300 123 45» y «abc» NO abren un número inventado, y lo dicen', async () => {
      for (const malo of ['300 123 45', 'abc']) {
        const r = await correr(malo);
        assert.ok(r.url, nombre + ' no abrió WhatsApp con «' + malo + '»: el mensaje tiene que salir igual');
        assert.strictEqual(numeroDe(r.url), '', nombre + ' con «' + malo + '» abrió ' + r.url.split('?')[0]);
        assert.ok(r[avisos].some((a) => /no está completo/.test(typeof a === 'string' ? a : a.texto)),
          nombre + ' no le dijo al pasajero que su contacto «' + malo + '» no sirve');
      }
    });
  }
});

describe('G10 · la regla es UNA', () => {
  it('Login.js, Seguridad.js y Solicitar.js la importan de telefonoValido.js', () => {
    for (const archivo of ['guajirago/src/Login.js', 'guajirago/src/Seguridad.js', 'guajirago/src/Solicitar.js']) {
      assert.match(leer(archivo), /import\s*\{[^}]*\}\s*from\s*'\.\/telefonoValido'/, archivo + ' no importa la regla');
    }
  });

  it('nadie más en las tres apps ni en las funciones escribe `contactoConfianzaNumero`', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const { RAIZ } = require('./cargar.cjs');
    const ESCRIBEN = ['guajirago/src/Login.js', 'guajirago/src/Seguridad.js'];
    const encontrados = [];
    for (const carpeta of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
      for (const f of fs.readdirSync(path.join(RAIZ, carpeta)).filter((x) => x.endsWith('.js'))) {
        if (/contactoConfianzaNumero\s*:/.test(leer(carpeta + '/' + f))) encontrados.push(carpeta + '/' + f);
      }
    }
    if (/contactoConfianzaNumero\s*:/.test(leer('guajirago/functions/index.js'))) encontrados.push('guajirago/functions/index.js');
    assert.deepStrictEqual(encontrados.sort(), ESCRIBEN.sort(),
      'un archivo nuevo escribe el contacto de emergencia: tiene que validarlo con telefonoValido.js y sumarse aquí');
  });
});
