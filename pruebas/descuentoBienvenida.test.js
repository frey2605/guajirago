/**
 * G18 · EL DESCUENTO PENDIENTE Y SU CÓDIGO LOS FABRICA EL SERVIDOR (28-sep-2026)
 *
 * El descuento pendiente de una ficha es plata: al usarlo, `consumirDescuentoViaje` se lo abona al conductor. Nacía
 * en dos sitios: el servidor (`reclamarPromocion`) y el TELÉFONO (Login.js, el crédito de bienvenida: el celular
 * decidía los $8.000, miraba la config y la huella del aparato, y fabricaba el código). Y la receta del código de 4
 * cifras estaba tres veces: Login.js, functions/index.js y guajirago/src/codigoSeguridad.js.
 *
 * Estas pruebas EJECUTAN:
 *   1. la pieza del servidor (guajirago/functions/descuentoPendiente.cjs): la receta, la ficha y la decisión;
 *   2. la receta de la app (generarCodigoSeguridad) contra la del servidor, con el mismo azar: tienen que dar lo mismo;
 *   3. el `registrarse` de Login.js sacado del archivo, con un servidor de mentira: la ficha nace SIN descuento, la
 *      bienvenida se le pide al servidor y la pantalla enseña lo que él contesta (no un número propio).
 * Y comprueban que nadie más vuelve a fabricar el código ni a escribir un descuento pendiente desde el teléfono.
 * (Las del servidor encendido, con el emulador, están en pruebas/funciones.test.js: «G18 · descuentoDeBienvenida».)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, cuerpoDeLaFuncion, cargarDeLaApp } = require('./cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const PIEZA = require('../guajirago/functions/descuentoPendiente.cjs');

/** Corre `fn` con Math.random devolviendo `valor`, y lo deja como estaba. */
function conAzar(valor, fn) {
  const original = Math.random;
  Math.random = () => valor;
  try { return fn(); } finally { Math.random = original; }
}

/** generarCodigoSeguridad de la app, sacada del archivo y lista para correr (sin la base de datos). */
function recetaDeLaApp() {
  const fuente = leer('guajirago/src/codigoSeguridad.js');
  const i = fuente.indexOf('export function generarCodigoSeguridad');
  assert.ok(i >= 0, 'no está generarCodigoSeguridad en codigoSeguridad.js');
  const fin = fuente.indexOf('\n}', i);
  // eslint-disable-next-line no-new-func
  return new Function(fuente.slice(i, fin + 2).replace(/^export\s+/, '') + '\nreturn generarCodigoSeguridad;')();
}

describe('G18 · la receta del código de 4 cifras', () => {
  it('el servidor fabrica SIEMPRE cuatro cifras (1000–9999), y no siempre la misma', () => {
    const vistos = new Set();
    for (let i = 0; i < 2000; i++) {
      const c = PIEZA.codigoDeCuatroCifras();
      assert.match(c, /^[1-9][0-9]{3}$/, 'salió «' + c + '»');
      vistos.add(c);
    }
    assert.ok(vistos.size > 500, 'solo salieron ' + vistos.size + ' códigos distintos en 2000');
  });

  it('la app y el servidor son LA MISMA receta: con el mismo azar dan el mismo código', () => {
    const app = recetaDeLaApp();
    for (const azar of [0, 0.00001, 0.1234, 0.5, 0.77777, 0.99999999]) {
      const deLaApp = conAzar(azar, app);
      const delServidor = conAzar(azar, PIEZA.codigoDeCuatroCifras);
      assert.strictEqual(delServidor, deLaApp, 'con azar ' + azar + ' la app da «' + deLaApp + '» y el servidor «' + delServidor + '»');
    }
    assert.strictEqual(conAzar(0, app), '1000');
    assert.strictEqual(conAzar(0.99999999, app), '9999');
  });

  it('nadie más fabrica el código: ni otra pantalla de la app, ni el index.js de la nube', () => {
    const permitidos = ['guajirago/src/codigoSeguridad.js', 'guajirago/functions/descuentoPendiente.cjs'];
    const receta = /Math\.random\(\)\s*\*\s*9000|1000\s*\+\s*Math\.random/;
    const archivos = fs.readdirSync(path.join(RAIZ, 'guajirago/src')).filter((f) => f.endsWith('.js'))
      .map((f) => 'guajirago/src/' + f)
      .concat(['guajirago/functions/index.js']);
    const culpables = archivos.filter((a) => !permitidos.includes(a) && receta.test(leer(a)));
    assert.deepStrictEqual(culpables, [], '⛔ volvió a fabricarse el código de 4 cifras a mano en: ' + culpables.join(', '));
  });
});

describe('G18 · la ficha del descuento pendiente y quién la recibe (la pieza del servidor)', () => {
  it('arma los mismos campos de siempre, firmados por el servidor', () => {
    const f = PIEZA.armarDescuentoPendiente({ promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: 8000 },
      '2026-09-28T12:00:00.000Z', '4321');
    assert.deepStrictEqual(f, {
      promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: 8000,
      fechaActivacion: '2026-09-28T12:00:00.000Z', codigoVerificacion: '4321', fabricadoPor: 'servidor',
    });
    const sinCodigo = PIEZA.armarDescuentoPendiente({ promoId: 'X', tipoBeneficio: 'descuento' }, 'f');
    assert.match(sinCodigo.codigoVerificacion, /^[1-9][0-9]{3}$/, 'sin código dado, lo fabrica con la receta');
    assert.strictEqual(sinCodigo.valorBeneficio, 0);
  });

  it('el crédito de bienvenida vale $8.000, como el que ponía el teléfono', () => {
    assert.strictEqual(PIEZA.CREDITO_BIENVENIDA_PASAJERO, 8000);
    assert.strictEqual(PIEZA.PROMO_BIENVENIDA, 'BIENVENIDA');
  });

  // P06: un pasajero nuevo trae su celular (el servidor lo saca de la ficha); los casos del teléfono, en bienvenidaPorTelefono.test.js.
  const nuevo = { config: {}, ficha: { tipo: '' }, aparatoYaUsado: false, yaLaRecibio: false, viajesPedidos: 0, telefono: '3001112233' };
  const CASOS = [
    ['un pasajero nuevo, con el interruptor sin tocar', {}, null],
    ['con el interruptor ENCENDIDO', { config: { viajeGratisNuevoPasajero: true } }, null],
    ['con el interruptor APAGADO en el panel', { config: { viajeGratisNuevoPasajero: false } }, 'apagada'],
    ['sin ficha', { ficha: null }, 'sin_ficha'],
    ['un conductor', { ficha: { tipo: 'conductor' } }, 'es_conductor'],
    ['quien ya la recibió (en otro aparato)', { yaLaRecibio: true }, 'ya_recibida'],
    ['un aparato que ya la usó', { aparatoYaUsado: true }, 'aparato_usado'],
    ['quien ya pidió viajes', { viajesPedidos: 1 }, 'no_es_nuevo'],
    ['quien ya tiene otro descuento pendiente (no se le pisa)', { ficha: { tipo: '', descuentoPendiente: { promoId: 'P' } } }, 'ya_tiene_descuento'],
  ];
  for (const [que, cambio, motivo] of CASOS) {
    it(que + ' → ' + (motivo || 'le toca'), () => {
      assert.strictEqual(PIEZA.porQueNoLaBienvenida({ ...nuevo, ...cambio }), motivo);
    });
  }

  it('el identificador del aparato solo sirve si puede ser nombre de documento', () => {
    assert.strictEqual(PIEZA.aparatoSano('dev_123_abc'), 'dev_123_abc');
    for (const malo of [null, undefined, '', 'a/b', '.', '..', '__x__', 'x'.repeat(101), 42, {}]) {
      assert.strictEqual(PIEZA.aparatoSano(malo), null, 'dejó pasar ' + JSON.stringify(malo));
    }
  });

  it('el servidor usa la pieza: reclamarPromocion y descuentoDeBienvenida arman la ficha con ella', () => {
    const idx = leer('guajirago/functions/index.js');
    for (const nombre of ['reclamarPromocion', 'descuentoDeBienvenida']) {
      const i = idx.indexOf('exports.' + nombre + ' = ');
      assert.ok(i >= 0, 'no está exports.' + nombre);
      const cuerpo = idx.slice(i, idx.indexOf('\nexports.', i + 10));
      assert.match(cuerpo, /armarDescuentoPendiente\(/, '⛔ ' + nombre + ' arma el descuento a mano');
      assert.match(cuerpo, /t\.set\(refUsuario, \{ descuentoPendiente \}, \{ merge: true \}\)/, '⛔ ' + nombre + ' no escribe la ficha armada');
    }
  });
});

describe('G18 · el registro (Login.js) ya no fabrica el descuento: se lo pide al servidor', () => {
  function laFuncion(archivo, nombre) {
    const codigo = leer(archivo);
    const desde = codigo.indexOf('const ' + nombre + ' = ');
    assert.ok(desde >= 0, 'no está `const ' + nombre + '` en ' + archivo);
    const cuerpo = cuerpoDeLaFuncion(codigo, desde);
    assert.ok(cuerpo, 'no pude sacar el cuerpo de ' + nombre);
    // eslint-disable-next-line no-new-func
    const f = new Function('ambito', 'with (ambito) { return (async () => {' + cuerpo.texto + '\n})(); }');
    return (ambito) => f(ambito);
  }

  /** Registra a Ana con un servidor que contesta `bienvenida` (o revienta si es un Error). */
  async function registrar(bienvenida) {
    const r = { escrituras: [], lecturas: [], llamadas: [], orden: [], celebracion: null, entro: null, error: '' };
    const registrarse = laFuncion('guajirago/src/Login.js', 'registrarse');
    await registrarse({
      nombre: 'Ana', email: 'a@b.co', emailConfirm: 'a@b.co', celular: '3001112233',
      diaNac: '1', mesNac: '2', anioNac: '1990', password: 'secreta1', passwordConfirm: 'secreta1',
      contactoNombre: 'Mamá', contactoNumero: '3007654321', aceptaTerminos: true,
      telefonoSirve: () => true,
      // G42: el registro limpia el celular con la regla única (telefonoValido.js); se le da la de verdad.
      celularDiezCifras: cargarDeLaApp('guajirago/src/telefonoValido.js').celularDiezCifras,
      setError: (t) => { r.error = t; }, setEnviando: () => {},
      auth: {}, db: { base: true },
      createUserWithEmailAndPassword: async () => ({ user: { uid: 'ana1' } }),
      sendEmailVerification: async () => {},
      obtenerIP: async () => '1.2.3.4',
      obtenerDeviceId: () => 'dev_ana',
      doc: (base, ...ruta) => ({ ruta: ruta.join('/') }),
      getDoc: async (ref) => { r.lecturas.push(ref.ruta); return { exists: () => false, data: () => ({}) }; },
      setDoc: async (ref, datos) => { r.escrituras.push({ ruta: ref.ruta, datos }); r.orden.push('escribe ' + ref.ruta); },
      getFunctions: () => ({}),
      httpsCallable: (_f, nombre) => async (datos) => {
        r.llamadas.push({ nombre, datos }); r.orden.push('llama ' + nombre);
        if (nombre === 'celularDisponible') return { data: { disponible: true } };
        if (nombre === 'descuentoDeBienvenida') {
          if (bienvenida instanceof Error) throw bienvenida;
          return { data: bienvenida };
        }
        throw new Error('llamó a una función que no existe: ' + nombre);
      },
      setCelebracionBienvenida: (c) => { r.celebracion = c; },
      onEntrar: (...a) => { r.entro = a; },
    });
    return r;
  }

  it('la ficha nace SIN descuento, y el teléfono no toca la huella del aparato ni la config', async () => {
    const r = await registrar({ valor: 8000, codigoVerificacion: '1234' });
    assert.strictEqual(r.error, '', 'el registro falló: ' + r.error);
    const ficha = r.escrituras.find((e) => e.ruta === 'usuarios/ana1');
    assert.ok(ficha, 'no se escribió la ficha');
    assert.ok(!('descuentoPendiente' in ficha.datos), '⛔ el teléfono se escribió el descuento en su propia ficha');
    assert.deepStrictEqual(r.escrituras.map((e) => e.ruta), ['usuarios/ana1'], '⛔ el teléfono escribió algo más que su ficha');
    assert.deepStrictEqual(r.lecturas, [], '⛔ el teléfono volvió a decidir la bienvenida leyendo: ' + r.lecturas.join(', '));
  });

  it('la bienvenida se le pide al servidor DESPUÉS de guardar la ficha, mandando solo el aparato', async () => {
    const r = await registrar({ valor: 8000 });
    const nombres = r.llamadas.map((l) => l.nombre);
    assert.deepStrictEqual(nombres, ['celularDisponible', 'descuentoDeBienvenida']);
    assert.deepStrictEqual(r.orden, ['llama celularDisponible', 'escribe usuarios/ana1', 'llama descuentoDeBienvenida'],
      '⛔ la bienvenida se pide antes de que exista la ficha (el servidor no la encontraría)');
    assert.deepStrictEqual(r.llamadas[1].datos, { deviceId: 'dev_ana' }, '⛔ el teléfono le manda al servidor algo más que su aparato');
  });

  it('la pantalla enseña lo que CONTESTA el servidor, no un número propio', async () => {
    const r = await registrar({ valor: 5000 });
    assert.ok(r.celebracion, 'no salió la celebración');
    assert.strictEqual(r.celebracion.monto, 5000, '⛔ la pantalla enseña ' + r.celebracion.monto + ' y el servidor dio 5000');
    assert.strictEqual(r.entro, null);
  });

  it('si al servidor no le toca darla, entra directo, sin celebración', async () => {
    const r = await registrar({ valor: 0, motivo: 'aparato_usado' });
    assert.strictEqual(r.celebracion, null, '⛔ celebró un regalo que no se dio');
    assert.deepStrictEqual(r.entro, ['', 'Ana', '3001112233', '', '']);
  });

  it('si el servidor falla, el registro NO se cae: entra sin el regalo', async () => {
    const r = await registrar(new Error('sin red'));
    assert.strictEqual(r.error, '', '⛔ el registro se cayó porque falló la bienvenida');
    assert.strictEqual(r.celebracion, null);
    assert.deepStrictEqual(r.entro, ['', 'Ana', '3001112233', '', '']);
  });

  it('ninguna pantalla de la app escribe un descuento pendiente con contenido (solo lo borra al usarlo)', () => {
    // P01: la vara es UNA, la del medidor (scripts/medir-descuento-telefono.cjs), que mira las tres apps.
    const { escritoresEnCodigo } = require('../scripts/medir-descuento-telefono.cjs');
    const culpables = escritoresEnCodigo().cliente.filter((s) => s.tipo === 'valor').map((s) => s.archivo + ':' + s.renglon);
    assert.deepStrictEqual(culpables, [], '⛔ el teléfono vuelve a escribir un descuento pendiente: ' + culpables.join(' · '));
  });
});
