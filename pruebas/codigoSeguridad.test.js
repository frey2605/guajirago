/**
 * EL CÓDIGO DE SEGURIDAD — PRUEBAS QUE EJECUTAN EL ARCHIVO REAL
 *
 * Este archivo, a diferencia de tarifas.js y descuentos.js, habla con la base de
 * datos. La prueba le entrega una base FALSA que anota cada cosa que le piden:
 * así se comprueba que escribe y lee EXACTAMENTE la ruta del cajón privado
 * (viajes/{id}/privado/seguridad) sin necesitar el emulador.
 *
 * Y lo más importante: la ruta del cajón es un CONTRATO con el servidor. La
 * función verificarCodigoViaje (guajirago/functions/index.js) lee esa misma ruta
 * con su propio código — el servidor no puede importar archivos de la app. La
 * última prueba lee LOS DOS LADOS y falla si dejan de coincidir. Si se separan
 * no hay error visible: el conductor solo vería «código incorrecto» siempre.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

/**
 * Carga codigoSeguridad.js con una base de datos FALSA.
 * Se quitan los `import` (la base falsa entra en su lugar) y los `export`.
 */
function cargarConBaseFalsa() {
  const anotado = { escrituras: [], lecturas: [] };
  let respuestaLectura = null; // lo que la "base" contesta al leer
  let fallarLectura = false;

  const falsa = {
    db: { __esLaBase: true },
    doc: (base, ...segmentos) => {
      assert.ok(base && base.__esLaBase, 'doc() tiene que recibir la base de datos de primero');
      return { ruta: segmentos };
    },
    setDoc: (ref, datos) => { anotado.escrituras.push({ ruta: ref.ruta, datos }); return Promise.resolve(); },
    getDoc: (ref) => {
      anotado.lecturas.push({ ruta: ref.ruta });
      if (fallarLectura) return Promise.reject(new Error('sin permiso'));
      return Promise.resolve({
        exists: () => respuestaLectura != null,
        data: () => respuestaLectura,
      });
    },
  };

  const fuente = fs.readFileSync(path.join(RAIZ, 'guajirago/src/codigoSeguridad.js'), 'utf8');
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  assert.ok(nombres.length > 0, 'no se encontró nada exportado');
  const cuerpo = fuente
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  const cargado = new Function('db', 'doc', 'setDoc', 'getDoc',
    cuerpo + '\nreturn { ' + nombres.join(', ') + ' };'
  )(falsa.db, falsa.doc, falsa.setDoc, falsa.getDoc);

  return {
    ...cargado,
    anotado,
    contestarConCodigo: (c) => { respuestaLectura = c == null ? null : { codigo: c }; },
    contestarSinCajon: () => { respuestaLectura = null; },
    romperLaLectura: () => { fallarLectura = true; },
  };
}

describe('SEGUNDA LEY · el código de seguridad, un solo sitio', () => {
  it('fabrica SIEMPRE cuatro cifras, nunca empieza por cero', () => {
    const { generarCodigoSeguridad } = cargarConBaseFalsa();
    for (let i = 0; i < 2000; i++) {
      const c = generarCodigoSeguridad();
      assert.match(c, /^[1-9][0-9]{3}$/, 'salió «' + c + '», y tiene que ser 1000–9999');
    }
  });

  it('no fabrica siempre el mismo: en 200 intentos salen muchos distintos', () => {
    // Si alguien rompe el azar (p. ej. deja el codigo fijo), esto se pone rojo.
    const { generarCodigoSeguridad } = cargarConBaseFalsa();
    const vistos = new Set();
    for (let i = 0; i < 200; i++) vistos.add(generarCodigoSeguridad());
    assert.ok(vistos.size > 50, 'solo salieron ' + vistos.size + ' códigos distintos en 200 intentos');
  });

  it('GUARDA en el cajón privado exacto: viajes/{id}/privado/seguridad, campo codigo', async () => {
    const m = cargarConBaseFalsa();
    await m.guardarCodigoDeViaje('viaje-77', '4321');
    assert.deepStrictEqual(m.anotado.escrituras, [
      { ruta: ['viajes', 'viaje-77', 'privado', 'seguridad'], datos: { codigo: '4321' } },
    ]);
  });

  it('CARGA del mismo cajón, y devuelve el código', async () => {
    const m = cargarConBaseFalsa();
    m.contestarConCodigo('9876');
    assert.strictEqual(await m.cargarCodigoDeViaje('viaje-77'), '9876');
    assert.deepStrictEqual(m.anotado.lecturas, [{ ruta: ['viajes', 'viaje-77', 'privado', 'seguridad'] }]);
  });

  it('sin cajón o sin permiso devuelve vacío, nunca revienta la pantalla', async () => {
    const sinCajon = cargarConBaseFalsa();
    sinCajon.contestarSinCajon();
    assert.strictEqual(await sinCajon.cargarCodigoDeViaje('v'), '');

    const sinPermiso = cargarConBaseFalsa();
    sinPermiso.romperLaLectura();
    assert.strictEqual(await sinPermiso.cargarCodigoDeViaje('v'), '');
  });

  it('EL CONTRATO CON EL SERVIDOR: la app y verificarCodigoViaje usan el mismo cajón', () => {
    // La app escribe con la ruta de codigoSeguridad.js; el servidor lee con la
    // suya propia en functions/index.js. Aquí se leen los DOS archivos.
    const app = fs.readFileSync(path.join(RAIZ, 'guajirago/src/codigoSeguridad.js'), 'utf8');
    const servidor = fs.readFileSync(path.join(RAIZ, 'guajirago/functions/index.js'), 'utf8');

    // El lado de la app: doc(db, 'viajes', ..., 'privado', 'seguridad') y el campo { codigo }
    assert.ok(/'viajes',\s*\w+,\s*'privado',\s*'seguridad'/.test(app),
      'codigoSeguridad.js ya no escribe en viajes/{id}/privado/seguridad');
    assert.ok(/\{\s*codigo\s*\}/.test(app), 'codigoSeguridad.js ya no guarda el campo «codigo»');

    // El lado del servidor: .collection("privado").doc("seguridad") y lee .codigo
    const verificar = servidor.slice(servidor.indexOf('exports.verificarCodigoViaje'));
    assert.ok(verificar.includes('exports.verificarCodigoViaje') && verificar.length > 100,
      'verificarCodigoViaje desapareció de functions/index.js');
    // La cadena ENTERA, con su padre: viajes/{id} → privado/seguridad. Solo
    // «privado/seguridad» no basta: el cajón podría colgar de otra colección.
    assert.ok(/collection\("viajes"\)\.doc\(viajeId\)\s*\.collection\("privado"\)\.doc\("seguridad"\)/.test(verificar.replace(/\s+/g, ' ')),
      'el SERVIDOR ya no lee viajes/{id}/privado/seguridad — si la app escribe ahí y él lee en otro lado, ' +
      'el conductor verá «código incorrecto» SIEMPRE y ningún error lo delatará');
    assert.ok(/\.data\(\)\.codigo/.test(verificar),
      'el servidor ya no compara el campo «codigo» del cajón');
  });

  it('NINGUNA pantalla toca el cajón privado por su cuenta', () => {
    const PANTALLAS = ['guajirago/src/Solicitar.js', 'guajirago/src/SolicitarMensajeria.js'];
    for (const pantalla of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(RAIZ, pantalla), 'utf8');
      assert.ok(!fuente.includes("'privado'"),
        pantalla + ' volvió a escribir la ruta del cajón privado a mano. Ese proceso vive en codigoSeguridad.js.');
      assert.ok(!/Math\.floor\(1000/.test(fuente),
        pantalla + ' volvió a fabricar el código por su cuenta. Eso vive en codigoSeguridad.js.');
      assert.ok(/from\s+'\.\/codigoSeguridad'/.test(fuente),
        pantalla + ' no está importando codigoSeguridad.js.');
    }
  });
});
