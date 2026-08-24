/**
 * LOS DATOS COMPARTIDOS — PRUEBAS
 *
 * riohacha.js (la geografía) y textosViaje.js (las listas de textos) existen
 * para que cuatro pantallas no tengan cada una su copia. Aquí se comprueba que
 * los datos son sanos y —lo que de verdad importa— que NINGUNA pantalla viva
 * vuelve a escribirlos a mano.
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

const { centroRiohacha, BOUNDS_RIOHACHA } = cargarDeLaApp('guajirago/src/riohacha.js');
const { RESPUESTAS_RAPIDAS, RAZONES_CANCELACION_PASAJERO, RAZONES_CANCELACION_CONDUCTOR } =
  cargarDeLaApp('guajirago/src/textosViaje.js');

describe('SEGUNDA LEY · los datos compartidos salen del mismo sitio', () => {
  it('el centro de Riohacha cae DENTRO de su propio marco', () => {
    // Si alguien mueve el centro fuera del marco, el mapa arranca en un sitio
    // donde el autocompletar no sugiere nada.
    assert.ok(BOUNDS_RIOHACHA.south < centroRiohacha.lat && centroRiohacha.lat < BOUNDS_RIOHACHA.north,
      'el centro quedó fuera del marco (latitud)');
    assert.ok(BOUNDS_RIOHACHA.west < centroRiohacha.lng && centroRiohacha.lng < BOUNDS_RIOHACHA.east,
      'el centro quedó fuera del marco (longitud)');
  });

  it('el marco está bien armado: norte arriba del sur, este a la derecha del oeste', () => {
    assert.ok(BOUNDS_RIOHACHA.north > BOUNDS_RIOHACHA.south);
    assert.ok(BOUNDS_RIOHACHA.east > BOUNDS_RIOHACHA.west);
  });

  it('las tres listas tienen textos, y las de cancelar dejan siempre la puerta de «Otro motivo»', () => {
    // Sin «Otro motivo», un pasajero con una razón no listada no podría cancelar
    // honestamente: elegiría cualquiera y el reporte del panel mentiría.
    assert.ok(RESPUESTAS_RAPIDAS.length >= 3);
    for (const lista of [RAZONES_CANCELACION_PASAJERO, RAZONES_CANCELACION_CONDUCTOR]) {
      assert.ok(lista.length >= 2);
      assert.strictEqual(lista[lista.length - 1], 'Otro motivo');
    }
  });

  it('NINGUNA pantalla viva vuelve a escribir estos datos a mano', () => {
    // (Conductor.js, el archivo muerto que conservaba su copia vieja, se borró
    // el 23-ago-2026 con permiso del dueño.)
    const PANTALLAS = [
      'guajirago/src/Solicitar.js',
      'guajirago/src/SolicitarMensajeria.js',
      'guajirago/src/AppConductor.js',
      'guajirago/src/Home.js',
    ];
    const HUELLAS = ['centroRiohacha = {', 'BOUNDS_RIOHACHA = {', 'RESPUESTAS_RAPIDAS = [', 'RAZONES_CANCELACION_PASAJERO = [', 'RAZONES_CANCELACION_CONDUCTOR = ['];
    for (const pantalla of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(RAIZ, pantalla), 'utf8');
      for (const huella of HUELLAS) {
        assert.ok(!fuente.includes(huella),
          pantalla + ' volvió a escribir «' + huella.replace(/ [={[]+$/, '') + '» a mano. ' +
          'Ese dato vive en riohacha.js o textosViaje.js (SEGUNDA LEY).');
      }
    }
  });
});
