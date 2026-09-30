/**
 * LOS ESTADOS DEL COBRO A ALIADOS · una sola fuente (gemelo G99, 30-sep-2026)
 *
 * La lista de los seis estados por los que pasa un cliente del cobro vive en `ESTADOS` de
 * guajirago/functions/suscripcion.js. Estaba escrita a mano dos veces más en este repo:
 *
 *  · en firestore.rules (`estadoConocido()` de `match /suscripciones`). Las reglas NO pueden importar JavaScript,
 *    así que ahí la copia se queda, y AQUÍ se ata: si dice otra cosa, esta prueba se pone roja. Si le falta un
 *    estado, el panel no puede guardar a un cliente en ese estado; si le sobra uno, se cuela un estado que el
 *    candado no conoce (un «Bloqueado» con mayúscula deja el bloqueo sin efecto).
 *  · en pruebas/reglas.test.js («los estados buenos SÍ se guardan»). Ésa SÍ puede importar, y desde G99 importa.
 *    Es la que EJECUTA las reglas en el emulador con cada estado de la fuente.
 *
 * El recorrido que saca cada lista de su archivo vive UNA vez, en scripts/medir-estados-cobro.cjs: esta prueba lo
 * importa, y le da de comer archivos de mentira para comprobar que no se ablanda.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const M = require('../scripts/medir-estados-cobro.cjs');
const { ESTADOS } = require('../guajirago/functions/suscripcion.js');

const REGLAS = leer(M.REGLAS).replace(/\r\n/g, '\n');
const PRUEBA = leer(M.PRUEBA).replace(/\r\n/g, '\n');

/** Cambia `de` por `a` en `t` y exige que calzara UNA vez (si no calza, la mentira no se aplicó). */
function cambiar(t, de, a) {
  const n = t.split(de).length - 1;
  assert.strictEqual(n, 1, 'el texto de la mentira calza ' + n + ' veces, no una: «' + de + '»');
  return t.replace(de, a);
}
// Las listas de mentira se ARMAN desde la fuente, para no escribir aquí otra copia a mano.
const comoLista = (l) => '[' + l.map((e) => "'" + e + "'").join(', ') + ']';
const LA_DE_LAS_REGLAS = comoLista(ESTADOS);

describe('G99 · los estados del cobro salen de UNA fuente', () => {
  it('la fuente es una lista de textos distintos', () => {
    assert.ok(Array.isArray(ESTADOS) && ESTADOS.length >= 2);
    assert.strictEqual(new Set(ESTADOS).size, ESTADOS.length, 'ESTADOS repite un estado');
    for (const e of ESTADOS) assert.ok(typeof e === 'string' && e.length, 'ESTADOS lleva algo que no es un texto');
    assert.ok(ESTADOS.includes('bloqueado'), 'el candado de negocioPuedeOperar pregunta por «bloqueado»');
  });

  it('EL QUE MUERDE · firestore.rules deja guardar exactamente los estados de la fuente', () => {
    const r = M.listaDeLasReglas(REGLAS);
    assert.ok(r.lista, 'no pude sacar la lista de las reglas: ' + r.porQue);
    assert.deepStrictEqual(r.lista, ESTADOS,
      'la lista de estadoConocido() en firestore.rules y ESTADOS de suscripcion.js se separaron.\n'
      + '  reglas: ' + JSON.stringify(r.lista) + '\n  fuente: ' + JSON.stringify(ESTADOS) + '\n'
      + '  Se arregla PRIMERO en guajirago/functions/suscripcion.js, y luego en firestore.rules (y se publican).');
  });

  it('EL QUE MUERDE · la prueba de reglas IMPORTA la lista, no la copia', () => {
    const p = M.listaDeLaPrueba(PRUEBA, ESTADOS);
    assert.ok(p.lista, 'no pude sacar la lista de la prueba de reglas: ' + p.porQue);
    assert.strictEqual(p.importa, true, 'pruebas/reglas.test.js volvió a escribir los estados a mano: '
      + JSON.stringify(p.lista) + '. Tiene que recorrer ESTADOS de suscripcion.js.');
    assert.deepStrictEqual(p.lista, ESTADOS);
  });

  it('EL QUE MUERDE · no nace otra copia a mano de la lista en las tres apps', () => {
    const c = M.copias(ESTADOS, M.lector(null));
    assert.deepStrictEqual(M.sobran(c), [],
      'hay listas de estados del cobro escritas a mano que podrían importar la fuente: '
      + JSON.stringify(M.sobran(c)) + '. Que usen ESTADOS de suscripcion.js (o, si es otro repo, que se aten).');
    // Y las permitidas siguen donde se dice: si una desaparece, su atadura también se quedó vieja.
    for (const ruta of Object.keys(M.PERMITIDAS)) assert.ok(c[ruta], ruta + ' ya no tiene la lista: revisa PERMITIDAS');
  });
});

describe('G99 · y el lector no se puede ablandar (archivos de mentira)', () => {
  it('ve las reglas a las que les falta un estado, o les sobra uno', () => {
    const falta = cambiar(REGLAS, LA_DE_LAS_REGLAS, comoLista(ESTADOS.slice(1)));
    assert.notDeepStrictEqual(M.listaDeLasReglas(falta).lista, ESTADOS);
    const sobra = cambiar(REGLAS, LA_DE_LAS_REGLAS, comoLista(ESTADOS.concat(['moroso'])));
    assert.notDeepStrictEqual(M.listaDeLasReglas(sobra).lista, ESTADOS);
  });

  it('un comentario con la lista buena no tapa la lista mala', () => {
    const t = cambiar(REGLAS, 'function estadoConocido() {',
      '// estado in ' + LA_DE_LAS_REGLAS + '\n      function estadoConocido() {');
    const mala = cambiar(t, '|| request.resource.data.estado in\n             ' + LA_DE_LAS_REGLAS,
      '|| request.resource.data.estado in\n             ' + comoLista(ESTADOS.slice(0, -1)));
    assert.notDeepStrictEqual(M.listaDeLasReglas(mala.replace(/\r\n/g, '\n')).lista, ESTADOS);
  });

  it('si ninguna allow llama a estadoConocido(), la lista no protege nada y no vale', () => {
    const b = REGLAS.replace(/\r\n/g, '\n');
    const i = b.indexOf('function estadoConocido()');
    const antes = b.slice(0, i);
    const despues = b.slice(i).replace(/(allow[^;]*?)estadoConocido\(\)/g, '$1true');
    const r = M.listaDeLasReglas(antes + despues);
    assert.strictEqual(r.lista, null, 'dio por buena una lista que nadie usa');
  });

  it('la lista de OTRO bloque no sirve: se busca dentro de match /suscripciones', () => {
    const t = cambiar(REGLAS, 'match /suscripciones/{negocioId} {', 'match /otraCosa/{negocioId} {');
    assert.strictEqual(M.listaDeLasReglas(t).lista, null);
  });

  it('ve la prueba de reglas que vuelve a copiar la lista a mano, o que recorre otra', () => {
    const aMano = cambiar(PRUEBA, 'for (const bueno of ESTADOS)', 'for (const bueno of ' + LA_DE_LAS_REGLAS + ')');
    assert.strictEqual(M.listaDeLaPrueba(aMano, ESTADOS).importa, false);
    const otra = cambiar(PRUEBA, 'for (const bueno of ESTADOS)', 'for (const bueno of OTROS)');
    assert.strictEqual(M.listaDeLaPrueba(otra, ESTADOS).lista, null);
    const sinRequire = cambiar(PRUEBA, "const { ESTADOS } = require('../guajirago/functions/suscripcion.js');",
      'const ESTADOS = ' + LA_DE_LAS_REGLAS + ';');
    assert.strictEqual(M.listaDeLaPrueba(sinRequire, ESTADOS).lista, null);
  });

  it('ve una copia nueva escrita a mano en cualquier archivo', () => {
    const falso = 'guajirago/src/deMentira.js';
    const leerReal = M.lector(null);
    const leerConMentira = (r) => (r === falso ? 'export const E = ' + comoLista(ESTADOS) + ';\n' : leerReal(r));
    const c = M.copias(ESTADOS, leerConMentira, M.losArchivos([falso]));
    assert.deepStrictEqual(M.sobran(c), [falso]);
  });
});
