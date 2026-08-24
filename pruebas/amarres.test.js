/**
 * LOS AMARRES ENTRE REPOS — PRUEBAS QUE LEEN LOS DOS LADOS
 *
 * El panel (guajirago-admin) y la app de aliados son repositorios APARTE: no
 * pueden importar archivos de la app del pasajero. Todo lo que comparten es
 * contrato invisible de campos y listas en Firestore — y un contrato invisible
 * se rompe en silencio.
 *
 * Pero estas pruebas viven en la carpeta RAÍZ, que en este disco contiene las
 * tres apps. Así que pueden leer los dos lados de cada contrato y ponerse rojas
 * si dejan de decir lo mismo. Es el mismo amarre de estadosViaje.js con las
 * reglas de Firestore, extendido a los otros repos.
 *
 * OJO: estas pruebas necesitan que guajirago-admin/ y guajirago-aliados/ estén
 * en el disco junto a la raíz (así está esta máquina). Si un día faltan, la
 * prueba lo dice con claridad en vez de mentir en verde.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

function leer(rutaRelativa) {
  const ruta = path.join(RAIZ, rutaRelativa);
  assert.ok(fs.existsSync(ruta),
    'No está «' + rutaRelativa + '» en el disco. Los amarres necesitan los tres repos ' +
    'juntos en la carpeta raíz; sin el otro lado del contrato no se puede comprobar nada.');
  return fs.readFileSync(ruta, 'utf8');
}

/** Carga un archivo de la app (import/export) y devuelve lo que exporta. */
function cargarDeLaApp(rutaRelativa) {
  const fuente = leer(rutaRelativa);
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  assert.ok(nombres.length > 0, 'no se encontró nada exportado en ' + rutaRelativa);
  // eslint-disable-next-line no-new-func
  return new Function(fuente.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
}

describe('AMARRES · el panel y la app dicen lo mismo', () => {
  it('la lista de VIAJES EN CURSO del panel contiene TODO el mercado de la app, y nada inventado', () => {
    // El panel enseña "viajes activos" con una lista escrita a mano en
    // guajirago-admin/src/Viajes.js. Esa lista tiene que ser: los estados del
    // MERCADO (los que buscan conductor, de estadosViaje.js) MÁS los dos de
    // viaje andando ('aceptado' y 'confirmado').
    //
    // EL PELIGRO: si mañana se añade un estado al mercado en la app y no aquí,
    // el panel deja de ver esos viajes — sin error, solo una lista más corta.
    const { ESTADOS_MERCADO } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const EN_MARCHA = ['aceptado', 'confirmado']; // el viaje ya tiene conductor

    const panel = leer('guajirago-admin/src/Viajes.js');
    const consulta = panel.match(/where\('estado',\s*'in',\s*\[([^\]]+)\]/);
    assert.ok(consulta, 'el panel ya no consulta los viajes en curso con where(estado, in, [...])');
    const delPanel = consulta[1].replace(/['"\s]/g, '').split(',').filter(Boolean);

    assert.deepStrictEqual(
      [...delPanel].sort(),
      [...ESTADOS_MERCADO, ...EN_MARCHA].sort(),
      'La lista del panel y la de la app se separaron.\n' +
      '   app (mercado + en marcha): ' + [...ESTADOS_MERCADO, ...EN_MARCHA].sort().join(', ') + '\n' +
      '   panel (Viajes.js):         ' + [...delPanel].sort().join(', ') + '\n' +
      'Si el cambio es a propósito, se cambian LOS DOS LADOS: estadosViaje.js (y ' +
      'firestore.rules, que tiene su propio amarre) y guajirago-admin/src/Viajes.js.'
    );
  });
});
