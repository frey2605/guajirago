/**
 * G35 (28-sep-2026) · EL TOPE DE LUGARES FAVORITOS sale de UN solo sitio para la comprobación y los dos textos.
 *
 * Antes: `guardarFavorito` (Solicitar.js) comprobaba con `config/global.maximoFavoritos` (producción: 2), pero la
 * ventanita «Llegaste al límite» decía siempre «Solo puedes guardar 3 lugares» y la pregunta de Ayuda
 * (AyudaSoporte.js) «hasta 3 lugares favoritos». Y con la casilla del panel vacía (0) no se podía guardar ninguno.
 * Ahora las tres salen de `maximoDeFavoritos` / `lugaresFavoritos` de configApp.js. Esta prueba:
 *   · EJECUTA las dos piezas con configs buenas y malas;
 *   · SACA de Solicitar.js la condición del límite y el texto de la ventanita, y de AyudaSoporte.js la respuesta y lo
 *     que la pantalla le pasa a `preguntasCon(...)`, y los EJECUTA (con el mismo lector de
 *     scripts/medir-favoritos-g35.cjs, no una copia);
 *   · exige que Ayuda lea config/global y la ponga ENCIMA del mismo respaldo que Solicitar;
 *   · y que el medidor, con lo de antes, sí vea la diferencia (si no, estaría mirando nada).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const medidor = require('../scripts/medir-favoritos-g35.cjs');

const piezas = cargarDeLaApp('guajirago/src/configApp.js');
const { maximoDeFavoritos, lugaresFavoritos, CONFIG_COMPARTIDA } = piezas;
const RESPALDO = CONFIG_COMPARTIDA.maximoFavoritos;

describe('G35 · el tope de lugares favoritos, una sola cuenta', () => {
  it('maximoDeFavoritos: usa lo del panel si sirve, y el respaldo de configApp.js si no', () => {
    assert.strictEqual(RESPALDO, 3, 'el respaldo de configApp.js cambió: revisa el amarre con el panel');
    assert.strictEqual(maximoDeFavoritos({ maximoFavoritos: 2 }), 2);
    assert.strictEqual(maximoDeFavoritos({ maximoFavoritos: 5 }), 5);
    assert.strictEqual(maximoDeFavoritos({ maximoFavoritos: '4' }), 4, 'un número que llegó como texto se lee como número');
    assert.strictEqual(maximoDeFavoritos({ maximoFavoritos: 0 }), RESPALDO, 'el panel guarda 0 con la casilla vacía, y con 0 no se podía guardar ninguno');
    assert.strictEqual(maximoDeFavoritos({ maximoFavoritos: -1 }), RESPALDO);
    assert.strictEqual(maximoDeFavoritos({ maximoFavoritos: 'abc' }), RESPALDO);
    assert.strictEqual(maximoDeFavoritos({}), RESPALDO);
    assert.strictEqual(maximoDeFavoritos(undefined), RESPALDO);
  });

  it('lugaresFavoritos: el mismo número, en palabras', () => {
    assert.strictEqual(lugaresFavoritos({ maximoFavoritos: 1 }), '1 lugar');
    assert.strictEqual(lugaresFavoritos({ maximoFavoritos: 2 }), '2 lugares');
    assert.strictEqual(lugaresFavoritos({ maximoFavoritos: 0 }), RESPALDO + ' lugares');
  });

  it('la comprobación, la ventanita y la Ayuda dicen el MISMO número (sacado de los archivos y ejecutado)', () => {
    const hoy = medidor.piezasDeHoy();
    assert.ok(hoy.argAyuda, 'AyudaSoporte.js ya no arma sus preguntas con preguntasCon(...): la respuesta de favoritos quedó sin número del panel');
    const r = medidor.medir(hoy, medidor.casos({ maximoFavoritos: 2 }), piezas);
    for (const f of r.filas) {
      const esperado = maximoDeFavoritos({ ...CONFIG_COMPARTIDA, ...(medidor.casos({ maximoFavoritos: 2 }).find(([n]) => n === f.nombre)[1]) });
      assert.strictEqual(f.deja, esperado, 'con «' + f.nombre + '» la comprobación deja guardar ' + f.deja + ' y debería dejar ' + esperado);
      assert.strictEqual(f.nV, esperado, 'con «' + f.nombre + '» la ventanita dice «' + f.ventanita + '»');
      assert.strictEqual(f.nA, esperado, 'con «' + f.nombre + '» la Ayuda dice «' + f.ayuda + '»');
    }
    assert.strictEqual(r.distintos, 0);
  });

  it('Ayuda lee config/global y la pone ENCIMA del mismo respaldo que Solicitar', () => {
    const ayuda = soloCodigo(leer('guajirago/src/AyudaSoporte.js')).replace(/\s+/g, ' ');
    // G66: la lectura (lo del servidor ENCIMA del respaldo) es `leerConfig` de configApp.js, la misma de Solicitar.js;
    // pruebas/configGlobal.test.js la ejecuta. Aquí se exige que Ayuda la use y ponga lo que devuelve.
    assert.ok(ayuda.includes('leerConfig({ getDoc, doc, db }).then(({ config, existe }) => { if (existe) setConfigApp(config); })'),
      'AyudaSoporte.js ya no lee config/global con leerConfig de configApp.js (como hace Solicitar.js)');
    assert.ok(ayuda.includes('useState(RESPALDO_CONFIG)'),
      'AyudaSoporte.js ya no arranca con el respaldo de configApp.js: mientras carga diría otra cosa que Solicitar.js');
    assert.ok(soloCodigo(leer('guajirago/src/Solicitar.js')).includes('const CONFIG_APP_DEFECTO = RESPALDO_CONFIG;'),
      'Solicitar.js ya no arranca con el mismo respaldo (RESPALDO_CONFIG) que Ayuda');
  });

  it('y el medidor SÍ ve la diferencia con el código de antes (si no, no estaría mirando nada)', () => {
    const r = medidor.medir(medidor.ANTES, medidor.casos({ maximoFavoritos: 2 }), piezas);
    assert.strictEqual(r.distintos, 5, 'con lo de antes, 5 de los 6 casos no coincidían');
  });
});
