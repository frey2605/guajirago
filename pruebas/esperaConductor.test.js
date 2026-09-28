/**
 * G26 (28-sep-2026) · EL TIEMPO QUE EL CONDUCTOR ESPERA AL PASAJERO sale de UN solo sitio para las dos pantallas.
 *
 * Antes: el conductor arrancaba su cuenta con `configApp.tiempoEsperaConductor || 240` (lo que pone el dueño en el
 * panel) y el pasajero con un 240 fijo. Con el panel en 300, el conductor veía 5:00 y el pasajero 4:00.
 * Ahora las dos llaman a `segundosDeEspera` de configApp.js. Esta prueba:
 *   · EJECUTA `segundosDeEspera` con configs buenas y malas;
 *   · SACA de AppConductor.js y Solicitar.js lo que cada una le pasa a `setContador` al arrancar la cuenta y lo
 *     EJECUTA (con el mismo lector que usa scripts/medir-espera-g26.cjs, no una copia);
 *   · exige que el pasajero lea la config de AHORA y no la del primer dibujo (su oyente vive en un efecto que no se
 *     vuelve a armar cuando carga config/global);
 *   · y que ninguna de las dos vuelva a escribir un número a mano en su reloj.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const medidor = require('../scripts/medir-espera-g26.cjs');

const piezas = cargarDeLaApp('guajirago/src/configApp.js');
const { segundosDeEspera, CONFIG_COMPARTIDA } = piezas;
const RESPALDO = CONFIG_COMPARTIDA.tiempoEsperaConductor;

/** Ejecuta una expresión de pantalla: `configApp` es el del dibujo, `configAppRef.current` el de ahora. */
function ejecutar(expresion, configDelDibujo, configDeAhora) {
  const nombres = { ...piezas, configApp: configDelDibujo, configAppRef: { current: configDeAhora } };
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(nombres), 'return (' + expresion + ');')(...Object.values(nombres));
}

describe('G26 · el tiempo de espera del conductor, una sola cuenta', () => {
  it('segundosDeEspera: usa lo del panel si sirve, y el respaldo de configApp.js si no', () => {
    assert.strictEqual(RESPALDO, 240, 'el respaldo de configApp.js cambió: revisa el amarre con el panel');
    assert.strictEqual(segundosDeEspera({ tiempoEsperaConductor: 300 }), 300);
    assert.strictEqual(segundosDeEspera({ tiempoEsperaConductor: 120 }), 120);
    assert.strictEqual(segundosDeEspera({ tiempoEsperaConductor: '180' }), 180, 'un número que llegó como texto se lee como número');
    assert.strictEqual(segundosDeEspera({ tiempoEsperaConductor: 0 }), RESPALDO, 'el panel guarda 0 con la casilla vacía');
    assert.strictEqual(segundosDeEspera({ tiempoEsperaConductor: -5 }), RESPALDO);
    assert.strictEqual(segundosDeEspera({ tiempoEsperaConductor: 'abc' }), RESPALDO);
    assert.strictEqual(segundosDeEspera({}), RESPALDO);
    assert.strictEqual(segundosDeEspera(undefined), RESPALDO);
  });

  it('las DOS pantallas arrancan su reloj con la misma cuenta (sacado de los archivos y ejecutado)', () => {
    const exp = medidor.expresionesDeHoy();
    for (const cfg of [{ tiempoEsperaConductor: 300 }, { tiempoEsperaConductor: 90 }, {}, { tiempoEsperaConductor: 0 }]) {
      const config = { ...CONFIG_COMPARTIDA, ...cfg };
      const esperado = segundosDeEspera(config);
      // El conductor arranca en `llegueAlPunto`, que se vuelve a crear en cada dibujo: su configApp es la de ahora.
      assert.strictEqual(ejecutar(exp.conductor, config, config), esperado,
        'el reloj del CONDUCTOR no sale de segundosDeEspera con ' + JSON.stringify(cfg) + ' (expresión: ' + exp.conductor + ')');
      // El pasajero arranca en el oyente del viaje: su `configApp` puede ser el respaldo del PRIMER dibujo.
      assert.strictEqual(ejecutar(exp.pasajero, { ...CONFIG_COMPARTIDA }, config), esperado,
        'el reloj del PASAJERO no cuenta lo que dice config/global con ' + JSON.stringify(cfg)
        + ' — o no sale de segundosDeEspera, o lee la config del primer dibujo en vez de la de ahora (expresión: ' + exp.pasajero + ')');
    }
    // Y el medidor, con las mismas expresiones, no ve ningún caso distinto.
    assert.strictEqual(medidor.medir(exp, medidor.casos({ tiempoEsperaConductor: 300 }), piezas).distintos, 0);
  });

  it('el pasajero guarda en el ref la config de AHORA en cada dibujo', () => {
    const fuente = soloCodigo(leer('guajirago/src/Solicitar.js'));
    assert.match(fuente, /const configAppRef = useRef\(configApp\);/, 'Solicitar.js ya no crea configAppRef');
    assert.match(fuente, /configAppRef\.current = configApp;/,
      'Solicitar.js ya no pone la config de ahora en configAppRef: el reloj del pasajero se quedaría con el respaldo');
  });

  it('ninguna de las dos pantallas escribe un número a mano en su reloj de espera', () => {
    for (const pantalla of ['guajirago/src/AppConductor.js', 'guajirago/src/Solicitar.js']) {
      const fuente = soloCodigo(leer(pantalla));
      assert.match(fuente, /import\s*\{[^}]*\bsegundosDeEspera\b[^}]*\}\s*from\s*'\.\/configApp'/,
        pantalla + ' no trae segundosDeEspera de configApp.js');
      const aMano = [...fuente.matchAll(/setContador\(\s*\d|\[contador, setContador\] = useState\(\s*\d|tiempoEsperaConductor\s*\|\|/g)];
      assert.strictEqual(aMano.length, 0,
        pantalla + ' volvió a escribir el tiempo de espera a mano (' + aMano.map((m) => m[0]).join(' · ')
        + '). Sale de segundosDeEspera, en configApp.js (SEGUNDA LEY).');
    }
  });

  it('el medidor NO está ciego: con el código de antes ve los relojes distintos', () => {
    const r = medidor.medir(medidor.ANTES, medidor.casos(), piezas);
    assert.ok(r.distintos >= 2, 'con el código de antes el medidor debería ver relojes distintos, y vio ' + r.distintos);
  });
});
