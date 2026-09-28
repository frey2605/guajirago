// ═══════════════════════════════════════════════════════════════════════════
//  EL RESPALDO DE 5 s DEL PASAJERO · gemelo G22, 28-sep-2026
//
//  La pantalla del pasajero (`Solicitar.js`) mira su viaje por DOS sitios: el vigilante en vivo (`onSnapshot`) y un
//  respaldo que lo relee cada 5 s (para Safari, donde el vivo tarda). El respaldo llevaba su propia copia de las
//  reacciones y se había separado: no conocía `aceptado`, respaldaba `confirmando` (RETIRADO) y repetía cada 5 s lo
//  que el vivo ya había hecho. Ahora los dos llaman a UNA función, `reaccionarAlViaje`, y el respaldo solo la llama
//  si el viaje trae una huella (`huellaDelViaje`) distinta de la del último que se vio.
//
//  Esta prueba CORRE los dos vigilantes sacados del archivo (con `scripts/medir-respaldo-viaje.cjs`, el contador del
//  paso 1 y del 12), no busca palabras.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('./cargar.cjs');
const { medirPantallas } = require('../scripts/medir-respaldo-viaje.cjs');
const { correrVigilante } = require('../scripts/medir-viaje-cerrado.cjs');

const APP = 'guajirago/src/Solicitar.js';
const { huellaDelViaje, ESTADOS_RETIRADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');

function cuerpo(t, ancla) {
  const i = t.indexOf(ancla);
  assert.ok(i >= 0, 'no encuentro «' + ancla + '» en ' + APP);
  assert.strictEqual(t.indexOf(ancla, i + 1), -1, '«' + ancla + '» aparece más de una vez');
  const c = cuerpoDeLaFuncion(t, i);
  assert.ok(c, 'no pude sacar el cuerpo de «' + ancla + '»');
  return c.texto;
}

describe('G22 · la huella del viaje', () => {
  it('es la misma para el mismo viaje aunque los campos vengan en otro orden (también los de dentro)', () => {
    const a = { estado: 'aceptado', conductorId: 'c1', descuentoInfo: { consumido: false, codigo: 'X' } };
    const b = { descuentoInfo: { codigo: 'X', consumido: false }, conductorId: 'c1', estado: 'aceptado' };
    assert.strictEqual(huellaDelViaje(a), huellaDelViaje(b));
  });

  it('cambia en cuanto cambia cualquier cosa del viaje, también dentro', () => {
    const a = { estado: 'aceptado', descuentoInfo: { consumido: false } };
    assert.notStrictEqual(huellaDelViaje(a), huellaDelViaje({ ...a, estado: 'finalizado' }));
    assert.notStrictEqual(huellaDelViaje(a), huellaDelViaje({ ...a, descuentoInfo: { consumido: true } }));
    assert.notStrictEqual(huellaDelViaje(a), huellaDelViaje({ ...a, conductorEnPunto: true }));
  });

  it('una fecha de Firestore cuenta por su hora; lo que no se puede convertir sale único (el respaldo reacciona)', () => {
    const ts = (ms) => ({ toMillis: () => ms, seconds: Math.floor(ms / 1000), nanoseconds: 0 });
    assert.strictEqual(huellaDelViaje({ f: ts(1000) }), huellaDelViaje({ f: ts(1000) }));
    assert.notStrictEqual(huellaDelViaje({ f: ts(1000) }), huellaDelViaje({ f: ts(2000) }));
    const redondo = { a: 1 };
    redondo.yo = redondo;
    assert.notStrictEqual(huellaDelViaje(redondo), huellaDelViaje(redondo));
  });
});

describe('G22 · los dos vigilantes del pasajero, corridos de verdad', () => {
  it('el respaldo hace EXACTAMENTE lo que haría el vivo cuando el vivo se calló (en cada paso del viaje)', async () => {
    const filas = await medirPantallas();
    assert.ok(filas.length >= 7 + ESTADOS_RETIRADOS.length, 'el medidor corrió solo ' + filas.length + ' casos');
    assert.deepStrictEqual(filas.filter((f) => f.distinto).map((f) => f.paso), [],
      'en estos pasos el respaldo no hace lo que haría el vigilante en vivo');
  });

  it('el paso vivo «aceptado» tiene respaldo: si el vivo se calla, el respaldo arranca la celebración', async () => {
    const viaje = { estado: 'aceptado', conductorId: 'c1', conductorNombre: 'Luis' };
    const ll = await correrVigilante('pasajeroRespaldo', viaje, 'esperando', {}, { ultimaHuellaRef: { current: null } });
    assert.ok(ll.some((l) => l[0] === 'setCelebrando' && l[1] === true), 'el respaldo no se enteró de que lo aceptaron');
  });

  it('nadie reacciona a un estado RETIRADO (solo guarda el documento)', async () => {
    const filas = await medirPantallas();
    assert.deepStrictEqual(filas.filter((f) => f.reaccionaRetirado).map((f) => f.paso), []);
  });

  it('el respaldo NO repite lo que el vivo ya hizo con el mismo viaje', async () => {
    const filas = await medirPantallas();
    assert.deepStrictEqual(filas.filter((f) => f.repite).map((f) => f.paso + ': ' + f.despues.join(',')), [],
      'el respaldo vuelve a hacer cada 5 s lo que el vivo ya hizo');
  });

  it('los dos vigilantes solo LLAMAN a reaccionarAlViaje: ninguno decide por su cuenta con el estado', () => {
    const t = soloCodigo(leer(APP));
    const vivo = cuerpo(t, "const unsub = onSnapshot(doc(db, 'viajes', viajeId), (snap) => {");
    const respaldo = cuerpo(t, 'intervaloRespaldoRef.current = setInterval(async () => {');
    for (const [nombre, c] of [['el vivo', vivo], ['el respaldo', respaldo]]) {
      assert.strictEqual((c.match(/\breaccionarAlViaje\s*\(/g) || []).length, 1, nombre + ' no llama UNA vez a reaccionarAlViaje');
      assert.doesNotMatch(c, /\bestado\b|\bfase\b|conductorEnPunto|\bset[A-Z]\w*\s*\(/,
        nombre + ' decide algo por su cuenta: la reacción vive en reaccionarAlViaje, y solo ahí');
    }
    assert.strictEqual((t.match(/const\s+reaccionarAlViaje\s*=/g) || []).length, 1, 'reaccionarAlViaje está definida más de una vez');
  });

  it('el medidor no se puede ablandar: sin la huella, el respaldo vuelve a repetir', async () => {
    const t = leer(APP);
    const roto = t.replace('if (huellaDelViaje(data) === ultimaHuellaRef.current) return;', '');
    assert.notStrictEqual(roto, t, 'el sabotaje no calzó');
    const filas = await medirPantallas({ [APP]: roto });
    assert.ok(filas.some((f) => f.repite), 'sin la huella el medidor sigue sin ver repeticiones');
  });
});
