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

/**
 * ── LEER CÓDIGO SIN QUE LOS COMENTARIOS ENGAÑEN ────────────────────────────
 *
 * Varias pruebas miran el código de las apps como TEXTO para comprobar que un
 * catch de verdad avisa, o que una ventanita se pinta. Estos tres ayudantes
 * vivían en pruebas/avisoCalificacion.test.js y se usan ya desde dos sitios, así
 * que se mudan aquí: es la casa común (SEGUNDA LEY). La segunda opinión cazó
 * este mismo error dos veces — la primera anotándolo, la segunda desmintiendo
 * que no hubiera sitio donde ponerlos.
 *
 * Cada uno está como está por un fallo que se comió de verdad:
 */

/**
 * Quita los comentarios. El `//` solo cuando ABRE el renglón: una versión que lo
 * quitaba en cualquier posición se comía la mitad de un texto entrecomillado
 * como 'https://…' y mutilaba el código que venía a mirar. Y se quitan también
 * los comentarios de bloque, los que van entre barra-asterisco: por ahí se colaba
 * un catch que dentro solo llevaba un comentario y no avisaba a nadie.
 */
// OJO AL `$` QUE NO ESTÁ, que costó siete botones. La primera versión terminaba
// el patrón en `$`, y en los archivos con finales de línea de Windows eso NO
// CASA NUNCA: `.` no se traga el `\r`, y el `$` queda detrás de él. Resultado: en
// Codigos.js y Promociones.js —que son CRLF— este ayudante no quitaba ni un
// comentario, y se podía comentar el arreglo entero de siete botones con las
// pruebas en verde. Lo midió la segunda opinión comentándolos de verdad.
// Sin el `$`, el `.*` se para solo antes del `\r` y el renglón conserva su final.
const soloCodigo = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/^(\s*)\/\/.*/, '$1')).join('\n');

/**
 * Deja el código con la MISMA longitud pero sin nada dentro de los textos
 * entrecomillados. Hace falta para contar llaves: sin esto, un
 * `console.log('formato {{ raro')` descuadraba la cuenta y el contador se salía
 * de la función.
 */
const sinTextos = (t) => t.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
  (s) => s[0] + 'x'.repeat(s.length - 2) + s[s.length - 1]);

/**
 * El cuerpo de la función que empieza en `desde`, contando llaves.
 *
 * SE SALTA LA LISTA DE PARÁMETROS primero, y eso NO sobra: un componente como
 * `function Restaurantes({ irA }) {` lleva llaves EN LOS PARÁMETROS, y sin este
 * salto se tomaba ese `{ irA }` por el cuerpo entero — 33 letras en vez de 15.000.
 * La prueba que lo usó salió roja diciendo que el componente no tenía dentro nada
 * de lo que sí tenía.
 */
function cuerpoDeLaFuncion(codigo, desde) {
  const seguro = sinTextos(codigo);
  const llave = seguro.indexOf('{', desde);
  if (llave < 0) return null;
  let arranque = desde;

  // ¿Es una función de flecha? Entonces el cuerpo es la llave que va DESPUÉS de
  // la flecha, y no hay nada que saltar.
  //
  // ESTA MITAD NO SOBRA: la primera versión del salto de parámetros se comía el
  // paréntesis de `useCallback(async () => { … }, [])` ENTERO y agarraba la llave
  // de la función SIGUIENTE — el mismo fallo del «catch del vecino» contra el que
  // avisa el comentario de aquí abajo. No rompía nada todavía porque ninguna
  // prueba miraba dentro de una carga, y TODAS las cargas del panel son
  // useCallback: se lo habría comido la primera que lo hiciera. Lo cazó la
  // segunda opinión careando la versión vieja con la nueva.
  const flecha = seguro.indexOf('=>', desde);
  if (flecha >= 0 && flecha < llave) {
    arranque = flecha + 2;
  } else {
    // Es una función con nombre. Se salta su lista de parámetros, porque puede
    // llevar llaves dentro: `function Restaurantes({ irA }) {` daba 33 letras de
    // cuerpo en vez de 15.000.
    const par = seguro.indexOf('(', desde);
    if (par >= 0 && par < llave) {
      let j = par + 1;
      let hondoPar = 1;
      while (j < seguro.length && hondoPar > 0) {
        if (seguro[j] === '(') hondoPar += 1;
        else if (seguro[j] === ')') hondoPar -= 1;
        j += 1;
      }
      arranque = j;
    }
  }
  const abre = seguro.indexOf('{', arranque);
  if (abre < 0) return null;
  let i = abre + 1;
  let hondo = 1;
  while (i < seguro.length && hondo > 0) {
    if (seguro[i] === '{') hondo += 1;
    else if (seguro[i] === '}') hondo -= 1;
    i += 1;
  }
  return { ini: abre + 1, fin: i - 1, texto: codigo.slice(abre + 1, i - 1) };
}

/**
 * El cuerpo de un `catch`, buscado SOLO DENTRO de su función.
 *
 * EL «SOLO DENTRO» NO ES ADORNO: una versión que buscaba hacia adelante sin tope
 * agarraba el catch de la función DE AL LADO, y daba por buena una prueba con el
 * agujero abierto. Devuelve null si esa función no tiene catch, y eso ES un
 * fallo: quien llama tiene que comprobarlo.
 */
function cuerpoDelCatch(codigo, desde) {
  const fn = cuerpoDeLaFuncion(codigo, desde);
  if (!fn) return null;
  const seguro = sinTextos(codigo);
  const m = /catch\s*(\([^)]*\))?\s*\{/.exec(seguro.slice(fn.ini, fn.fin));
  if (!m) return null;
  let i = fn.ini + m.index + m[0].length;
  let hondo = 1;
  const ini = i;
  while (i < fn.fin && hondo > 0) {
    if (seguro[i] === '{') hondo += 1;
    else if (seguro[i] === '}') hondo -= 1;
    i += 1;
  }
  return codigo.slice(ini, i - 1);
}

module.exports = { RAIZ, leer, cargarDeLaApp, soloCodigo, sinTextos, cuerpoDeLaFuncion, cuerpoDelCatch };
