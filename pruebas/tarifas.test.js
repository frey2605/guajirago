/**
 * LA TARIFA MÍNIMA — PRUEBAS QUE LA EJECUTAN DE VERDAD
 *
 * Estas pruebas NO leen el archivo para ver si dice lo que debería: lo CARGAN y le
 * piden números. Si la calculadora se rompe, aquí sale rojo.
 *
 * Por qué hay un cargador a mano abajo: `guajirago/src/tarifas.js` está escrito en
 * el lenguaje de módulos que usa la app (import/export), y estas pruebas corren en
 * el otro (require). Node no puede mezclarlos sin más. El cargador coge el archivo
 * TAL CUAL está en el disco —el mismo que se sube a la app, sin copias ni
 * traducciones— y lo ejecuta. Lo que se prueba aquí es el código que viaja.
 *
 * No necesita emulador ni internet: es aritmética.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

/** Carga un archivo de la app (import/export) y devuelve lo que exporta. */
function cargarDeLaApp(rutaRelativa) {
  const fuente = fs.readFileSync(path.join(RAIZ, rutaRelativa), 'utf8');
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  assert.ok(nombres.length > 0, 'no se encontró nada exportado en ' + rutaRelativa);
  const sinExport = fuente.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(sinExport + '\nreturn { ' + nombres.join(', ') + ' };')();
}

const { CONFIG_TARIFAS_DEFECTO, calcularTarifaMinima } = cargarDeLaApp('guajirago/src/tarifas.js');

// Horas fijas para que la prueba dé lo mismo a cualquier hora del día real.
const ALAS = (hora) => new Date(2026, 7, 23, hora, 0, 0);

describe('SEGUNDA LEY · la tarifa mínima, una sola calculadora', () => {
  it('un MANDADO cobra el mínimo de mensajería, no el de taxi', () => {
    // Esta es la falla que tenía Solicitar.js: no conocía la mensajería y le
    // habría cobrado tarifa de taxi. De día habrían sido $8.000 en vez de $5.000.
    assert.strictEqual(calcularTarifaMinima('Mensajería', CONFIG_TARIFAS_DEFECTO, ALAS(12)), 5000);
    assert.strictEqual(calcularTarifaMinima('Mensajería', CONFIG_TARIFAS_DEFECTO, ALAS(21)), 5000);
  });

  it('un MOTOTAXI cobra el suyo y no le importa la hora', () => {
    // Esta es la falla que tenía AppConductor.js: no conocía el mototaxi.
    assert.strictEqual(calcularTarifaMinima('Mototaxi', CONFIG_TARIFAS_DEFECTO, ALAS(12)), 3000);
    assert.strictEqual(calcularTarifaMinima('Mototaxi', CONFIG_TARIFAS_DEFECTO, ALAS(23)), 3000);
  });

  it('el TAXI de día cuesta menos que de noche', () => {
    const dia = calcularTarifaMinima('Taxi', CONFIG_TARIFAS_DEFECTO, ALAS(12));
    const noche = calcularTarifaMinima('Taxi', CONFIG_TARIFAS_DEFECTO, ALAS(20));
    assert.strictEqual(dia, 8000);
    assert.strictEqual(noche, 10000);
    assert.ok(noche > dia, 'la noche tiene que costar más que el día');
  });

  it('la noche CRUZA LA MEDIANOCHE: las 3 de la madrugada siguen siendo noche', () => {
    // Si alguien cambia el «o» por un «y», esto se pone rojo. A las 3 a.m. no se
    // cumple «hora >= 18», así que solo la segunda mitad de la condición lo salva.
    assert.strictEqual(calcularTarifaMinima('Taxi', CONFIG_TARIFAS_DEFECTO, ALAS(3)), 10000);
    assert.strictEqual(calcularTarifaMinima('Taxi', CONFIG_TARIFAS_DEFECTO, ALAS(0)), 10000);
    assert.strictEqual(calcularTarifaMinima('Taxi', CONFIG_TARIFAS_DEFECTO, ALAS(6)), 8000, 'a las 6 ya es de día');
    assert.strictEqual(calcularTarifaMinima('Taxi', CONFIG_TARIFAS_DEFECTO, ALAS(18)), 10000, 'a las 6 de la tarde ya es de noche');
  });

  it('MANDA el panel: lo que el dueño pone en config/global gana al respaldo', () => {
    // Así llega de verdad: el respaldo por debajo y encima lo que trae el servidor.
    const delServidor = {
      ...CONFIG_TARIFAS_DEFECTO,
      tarifaMinimaDia: 9500,
      tarifaMinimaNoche: 12000,
      tarifaMinimaMototaxi: 3500,
      tarifaMinimaMensajeria: 6000,
      horaInicioNoche: 19,
    };
    assert.strictEqual(calcularTarifaMinima('Taxi', delServidor, ALAS(12)), 9500);
    assert.strictEqual(calcularTarifaMinima('Taxi', delServidor, ALAS(20)), 12000);
    assert.strictEqual(calcularTarifaMinima('Mototaxi', delServidor, ALAS(12)), 3500);
    assert.strictEqual(calcularTarifaMinima('Mensajería', delServidor, ALAS(12)), 6000);
    // Y la hora de la noche también se mueve: a las 18:00 con inicio en 19 es de día.
    assert.strictEqual(calcularTarifaMinima('Taxi', delServidor, ALAS(18)), 9500);
  });

  it('los tres números del respaldo son los que el panel escribe', () => {
    // No es decoración: si el respaldo dijera otra cosa, el día que el servidor no
    // cargue el pasajero vería un precio distinto del que el dueño puso.
    assert.strictEqual(CONFIG_TARIFAS_DEFECTO.tarifaMinimaDia, 8000);
    assert.strictEqual(CONFIG_TARIFAS_DEFECTO.tarifaMinimaNoche, 10000);
    assert.strictEqual(CONFIG_TARIFAS_DEFECTO.tarifaMinimaMototaxi, 3000);
    assert.strictEqual(CONFIG_TARIFAS_DEFECTO.tarifaMinimaMensajeria, 5000);
  });

  it('NINGUNA pantalla tiene su propia copia de la calculadora', () => {
    // Este es el candado de la SEGUNDA LEY. El día que alguien vuelva a escribir
    // `function calcularTarifaMinima` en una pantalla, esta prueba se pone roja
    // ANTES de que las dos versiones empiecen a dar respuestas distintas.
    const PANTALLAS = [
      'guajirago/src/Solicitar.js',
      'guajirago/src/SolicitarMensajeria.js',
      'guajirago/src/AppConductor.js',
    ];
    for (const pantalla of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(RAIZ, pantalla), 'utf8');
      assert.ok(
        // Las DOS formas de escribir una función en JavaScript, porque una copia
        // escrita como `const calcularTarifaMinima = (...) => ...` se colaría.
        !/(function\s+calcularTarifaMinima|(?:const|let|var)\s+calcularTarifaMinima\s*=)/.test(fuente),
        pantalla + ' volvió a tener su PROPIA calculadora de tarifa mínima. ' +
        'Eso es justo lo que la SEGUNDA LEY prohíbe: dos calculadoras para un mismo ' +
        'proceso terminan dando números distintos. Tiene que usar la de tarifas.js.'
      );
      assert.ok(
        /from\s+'\.\/tarifas'/.test(fuente),
        pantalla + ' no está importando la calculadora de tarifas.js.'
      );
    }
  });
});
