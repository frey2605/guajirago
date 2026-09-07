/**
 * ¿QUIÉN SALE EN LA APP? — PRUEBAS QUE EJECUTAN EL ARCHIVO REAL
 *
 * Hasta el 7-sep-2026 esta pregunta se contestaba en DOS sitios que no decían lo
 * mismo, y el interruptor que la manda no lo miraba nadie:
 *
 *   · `visibleEnEscaparate` es la llave que hace posible vender el programa
 *     fuera de Riohacha: el negocio paga, lo usa, y NO sale en la app —porque
 *     allí no hay conductores que lleven el domicilio—. El panel ya la movía
 *     (admin/Cobros.js:603) y las reglas ya la protegían, pero la app del
 *     cliente NUNCA la leía. Un interruptor con el cable cortado.
 *   · Y el filtro de comida no pedía `perfilCompleto` y el de turismo sí, así
 *     que un restaurante a medio llenar salía y una agencia a medio llenar no.
 *
 * Estas pruebas cargan guajirago/src/escaparate.js TAL CUAL ESTÁ EN EL DISCO, y
 * además comprueban que las dos pantallas lo USAN — que es la mitad que impide
 * que mañana alguien vuelva a escribir el filtro a mano en una de ellas y estas
 * pruebas sigan verdes.
 *
 * LA QUE MÁS IMPORTA es «un campo que falta NO apaga a nadie». Medido en la base
 * viva antes de tocar (scripts/medir-escaparate.cjs): NINGUNO de los 3 negocios
 * tiene `visibleEnEscaparate`. Si alguien cambia el `!== false` por un
 * `=== true`, los tres desaparecen de la app el día del despliegue, y la app no
 * da ningún error: simplemente se queda vacía.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { leer, cargarDeLaApp } = require('./cargar.cjs');

const { saleEnElEscaparate, losDeComida, lasDeTurismo } =
  cargarDeLaApp('guajirago/src/escaparate.js');

// Quita los comentarios antes de mirar el CÓDIGO.
//
// Hace falta, y lo descubrió esta misma prueba poniéndose roja la primera vez que
// se corrió: escaparate.js EXPLICA en un comentario cuál es el error a evitar
// —«si se exigiera visibleEnEscaparate === true, los tres desaparecen»— y la
// prueba lo leía como si fuera código. O sea que estaba prohibiendo que el
// archivo se explicara. Sin esto, la única salida sería no escribir el porqué, y
// el porqué es la mitad del valor de ese archivo.
const soloCodigo = (fuente) => fuente
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

// Un negocio que pasa las tres preguntas. Cada prueba le estropea UNA.
const bueno = (extra) => Object.assign({
  id: 'r1', nombre: 'La Guajira', tipoNegocio: 'restaurante',
  aprobado: true, perfilCompleto: true, visibleEnEscaparate: true,
}, extra || {});

describe('EL ESCAPARATE · quién sale en la app del cliente', () => {
  it('un negocio aprobado, encendido y con la ficha llena SÍ sale', () => {
    assert.strictEqual(saleEnElEscaparate(bueno()), true);
  });

  it('EL QUE MUERDE · el interruptor apagado lo saca de la app', () => {
    // Esta es la razón de ser de todo el arreglo. Antes del 7-sep-2026 el dueño
    // apagaba esto en el panel y el negocio seguía saliendo igual.
    assert.strictEqual(saleEnElEscaparate(bueno({ visibleEnEscaparate: false })), false);
  });

  it('EL QUE MUERDE · un campo que FALTA no apaga a nadie', () => {
    // Medido: los 3 negocios de la base NO tienen `visibleEnEscaparate`, y 2 de
    // 3 tampoco tienen `aprobado`. Exigirlos en positivo los borra a todos de la
    // app, en silencio. El riesgo caro es dejar fuera a quien SÍ pagó.
    const sinInterruptor = bueno();
    delete sinInterruptor.visibleEnEscaparate;
    assert.strictEqual(saleEnElEscaparate(sinInterruptor), true);

    const sinAprobado = bueno();
    delete sinAprobado.aprobado;
    assert.strictEqual(saleEnElEscaparate(sinAprobado), true);
  });

  it('EL QUE MUERDE · pero la ficha a medias SÍ lo saca, y a los dos por igual', () => {
    // Decisión del dueño, 7-sep-2026, con las tres opciones delante: se exige a
    // comida Y a turismo. Antes solo se le pedía a turismo.
    const sinFicha = bueno();
    delete sinFicha.perfilCompleto;
    assert.strictEqual(saleEnElEscaparate(sinFicha), false);
    assert.strictEqual(saleEnElEscaparate(bueno({ perfilCompleto: false })), false);
    assert.strictEqual(saleEnElEscaparate(bueno({ tipoNegocio: 'turismo', perfilCompleto: false })), false);
  });

  it('no aprobado no sale, y un negocio que no existe tampoco', () => {
    assert.strictEqual(saleEnElEscaparate(bueno({ aprobado: false })), false);
    assert.strictEqual(saleEnElEscaparate(null), false);
    assert.strictEqual(saleEnElEscaparate(undefined), false);
  });

  it('cada pantalla se lleva SOLO los suyos', () => {
    const todos = [
      bueno({ id: 'com1' }),
      bueno({ id: 'tur1', tipoNegocio: 'turismo' }),
      bueno({ id: 'com2', visibleEnEscaparate: false }),
      bueno({ id: 'tur2', tipoNegocio: 'turismo', visibleEnEscaparate: false }),
    ];
    assert.deepStrictEqual(losDeComida(todos).map((n) => n.id), ['com1']);
    assert.deepStrictEqual(lasDeTurismo(todos).map((n) => n.id), ['tur1']);
    // Un negocio sin `tipoNegocio` cuenta como comida, que es como se comportaba
    // el filtro viejo (`tipoNegocio !== 'turismo'`). Medido: los 3 lo tienen.
    const sinTipo = bueno({ id: 'x' });
    delete sinTipo.tipoNegocio;
    assert.deepStrictEqual(losDeComida([sinTipo]).map((n) => n.id), ['x']);
    assert.deepStrictEqual(lasDeTurismo([sinTipo]), []);
  });

  it('aguanta que no le den nada', () => {
    assert.deepStrictEqual(losDeComida(null), []);
    assert.deepStrictEqual(lasDeTurismo(undefined), []);
    assert.deepStrictEqual(losDeComida([null, undefined]), []);
  });
});

describe('EL ESCAPARATE · las dos pantallas lo USAN de verdad', () => {
  // Sin esto, alguien podría volver a escribir el filtro a mano en una pantalla
  // y todo lo de arriba seguiría verde. Es el mismo careo que hace amarres.test.js
  // con los contratos entre repos.
  const pantallas = [
    ['guajirago/src/Restaurantes.js', 'losDeComida'],
    ['guajirago/src/Turismo.js', 'lasDeTurismo'],
  ];

  for (const [ruta, funcion] of pantallas) {
    it(ruta + ' importa y llama a ' + funcion + '()', () => {
      const fuente = leer(ruta);
      assert.ok(/from '\.\/escaparate'/.test(fuente),
        ruta + ' no importa de escaparate.js. Si el filtro se volvió a escribir a ' +
        'mano ahí dentro, hay OTRA VEZ dos respuestas para la misma pregunta.');
      assert.ok(fuente.includes(funcion + '('),
        ruta + ' importa escaparate.js pero no llama a ' + funcion + '().');
    });

    it(ruta + ' ya NO decide por su cuenta quién sale', () => {
      const fuente = soloCodigo(leer(ruta));
      assert.ok(!/aprobado\s*!==\s*false/.test(fuente),
        ruta + ' vuelve a mirar `aprobado` por su cuenta. Esa pregunta se ' +
        'contesta en escaparate.js y en ningún otro sitio (SEGUNDA LEY).');
      assert.ok(!/perfilCompleto\s*===\s*true/.test(fuente),
        ruta + ' vuelve a mirar `perfilCompleto` por su cuenta. Misma ley.');
    });
  }

  it('EL QUE MUERDE · el interruptor se mira en la app, no solo en el panel', () => {
    // El campo tiene que aparecer en la app del cliente. Si un día desaparece de
    // escaparate.js, el panel seguirá teniendo su botón y no hará nada — que es
    // exactamente el estado del que se viene.
    const fuente = soloCodigo(leer('guajirago/src/escaparate.js'));
    assert.ok(fuente.includes('visibleEnEscaparate'),
      'escaparate.js ya no mira `visibleEnEscaparate`. El botón del panel volvería ' +
      'a ser un interruptor con el cable cortado.');
    assert.ok(!/visibleEnEscaparate\s*===\s*true/.test(fuente),
      'escaparate.js exige `visibleEnEscaparate === true`. Medido en la base viva: ' +
      'NINGUNO de los negocios tiene el campo, así que eso los borra a todos de la ' +
      'app el día del despliegue, y sin dar ningún error.');
  });
});
