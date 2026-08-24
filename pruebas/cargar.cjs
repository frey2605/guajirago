/**
 * EL CARGADOR DE LAS PRUEBAS — UN SOLO SITIO
 *
 * SEGUNDA LEY, aplicada a las propias pruebas: este par de ayudantes estaba
 * copiado en cinco archivos de pruebas/ (lo encontró la segunda opinión del
 * arreglo del amarre del panel, 23-ago-2026).
 *
 * · leer(ruta)          — trae un archivo de CUALQUIERA de los tres repos, y si
 *                         no está en el disco lo dice claro en vez de reventar
 *                         con un error de sistema.
 * · cargarDeLaApp(ruta) — carga un archivo de la app (escrito con
 *                         import/export, que Node no puede mezclar con require)
 *                         y devuelve lo que exporta, EJECUTÁNDOLO tal cual está
 *                         en el disco. Solo sirve para archivos SIN imports
 *                         (datos y cuentas puras); para los que hablan con la
 *                         base de datos, codigoSeguridad.test.js tiene su
 *                         propio cargador con base falsa.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

function leer(rutaRelativa) {
  const ruta = path.join(RAIZ, rutaRelativa);
  assert.ok(fs.existsSync(ruta),
    'No está «' + rutaRelativa + '» en el disco. Las pruebas necesitan los tres repos ' +
    'juntos en la carpeta raíz; sin el otro lado del contrato no se puede comprobar nada.');
  return fs.readFileSync(ruta, 'utf8');
}

function cargarDeLaApp(rutaRelativa) {
  const fuente = leer(rutaRelativa);
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  assert.ok(nombres.length > 0, 'no se encontró nada exportado en ' + rutaRelativa);
  const sinExport = fuente.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(sinExport + '\nreturn { ' + nombres.join(', ') + ' };')();
}

module.exports = { RAIZ, leer, cargarDeLaApp };
