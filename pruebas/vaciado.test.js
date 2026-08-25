/**
 * EL CANDADO QUE EVITA PERDER LOS DATOS DE UNA PERSONA
 *
 * `scripts/vaciar-escaparate.cjs` es el único trozo de este proyecto que BORRA.
 * Quita el nombre, el teléfono, el correo y el saldo del dueño de
 * `restaurantes/{id}` —el escaparate, la colección que la app del pasajero se
 * descarga entera— porque esos datos ya viven en `restaurantesPrivado/{id}`.
 *
 * Su promesa es una sola: **no borra nada de un negocio si no ha comprobado, campo
 * por campo, que está guardado idéntico en su cuarto de atrás.** Ni siquiera borra
 * «lo que sí cuadra»: o todo o nada.
 *
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 *
 * Porque esa promesa no la vigilaba nadie. La segunda opinión del 24-ago-2026
 * plantó dos mutantes dentro del script y la suite entera se quedó VERDE:
 *
 *   · que la comparación dijera siempre «cuadra»;
 *   · quitar el aviso de «este negocio no tiene cuarto».
 *
 * Con el segundo, un negocio sin cuarto se vaciaba igual y los datos de su dueño
 * se perdían para siempre. Que es lo único que este trabajo no se puede permitir.
 *
 * El script se queda en el repo para que alguien lo corra dentro de un año — y no
 * va a ser quien lo escribió. Para entonces, esto es lo único que va a quedar de
 * la conversación que lo produjo.
 *
 *
 * CÓMO ESTÁN ESCRITAS
 *
 * Se EJECUTA `decidir()`, la función que toma la decisión, con documentos con la
 * forma cruda de Firestore ({ stringValue: 'X' }, { integerValue: '0' }...). No se
 * toca la red: cargar este script no arranca nada, y por eso no puede pasar que
 * `npm test` se ponga a borrar en el servidor de verdad.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { decidir } = require('../scripts/vaciar-escaparate.cjs');
// La lista buena, la de la app. Sin copias (SEGUNDA LEY).
const { cargarDeLaApp } = require('./cargar.cjs');

const txt = (v) => ({ stringValue: v });
const num = (v) => ({ integerValue: String(v) });

/** Un negocio del escaparate, con lo del dueño dentro, como están los de verdad. */
const negocioLleno = () => ({
  nombre: txt('DONDE MECHE'),
  logo: txt('logo.png'),
  duenoNombre: txt('MECHE'),
  duenoTelefono: txt('+573001112233'),
  email: txt('meche@ejemplo.com'),
  creditos: num(0),
});

/** Su cuarto de atrás, con lo mismo. */
const cuartoLleno = () => ({
  duenoNombre: txt('MECHE'),
  duenoTelefono: txt('+573001112233'),
  email: txt('meche@ejemplo.com'),
  creditos: num(0),
});

const LISTA = ['duenoNombre', 'duenoTelefono', 'email', 'creditos', 'fcmToken'];

describe('EL VACIADO · el candado que evita perder los datos del dueño', () => {
  // ── LO QUE SÍ SE PUEDE BORRAR ────────────────────────────────────────────
  it('con todo guardado idéntico, se vacía', () => {
    const d = decidir(negocioLleno(), cuartoLleno(), LISTA);
    assert.strictEqual(d.accion, 'vaciar');
    assert.deepStrictEqual(d.campos.sort(), ['creditos', 'duenoNombre', 'duenoTelefono', 'email']);
  });

  it('solo se lleva los campos de la lista, nunca lo público', () => {
    const d = decidir(negocioLleno(), cuartoLleno(), LISTA);
    assert.ok(!d.campos.includes('nombre'), 'se iba a llevar el NOMBRE DEL NEGOCIO, que es público');
    assert.ok(!d.campos.includes('logo'), 'se iba a llevar el logo, que es público');
  });

  it('un negocio que ya está limpio no se toca', () => {
    const d = decidir({ nombre: txt('LIMPIO'), logo: txt('x.png') }, cuartoLleno(), LISTA);
    assert.strictEqual(d.accion, 'limpio');
    assert.deepStrictEqual(d.campos, []);
  });

  // ── LO QUE NO SE PUEDE BORRAR ────────────────────────────────────────────
  // ESTA ES LA IMPORTANTE. Es el mutante que sobrevivió: sin ella, un negocio
  // sin cuarto se vacía igual y los datos de su dueño no quedan en ningún sitio.
  it('SIN CUARTO no se borra NADA — es el caso que pierde los datos', () => {
    const d = decidir(negocioLleno(), undefined, LISTA);
    assert.strictEqual(d.accion, 'saltar',
      'Un negocio SIN cuarto de atrás se iba a vaciar. Sus datos no están guardados en ningún ' +
      'otro sitio: al quitarlos del escaparate desaparecen para siempre. Antes de vaciar hay ' +
      'que correr scripts/mudar-datos-negocio.cjs, que es quien crea los cuartos.');
    assert.strictEqual(d.motivo, 'sin-cuarto');
  });

  it('si al cuarto le falta UN campo, no se borra ninguno', () => {
    const cuarto = cuartoLleno();
    delete cuarto.email;
    const d = decidir(negocioLleno(), cuarto, LISTA);
    assert.strictEqual(d.accion, 'saltar',
      'Al cuarto le faltaba el correo y se iba a vaciar el negocio igual. Ese correo ' +
      'desaparecería para siempre.');
    assert.deepStrictEqual(d.descuadres, ['email']);
  });

  it('y tampoco se borran los que SÍ cuadran: o todo o nada', () => {
    const cuarto = cuartoLleno();
    delete cuarto.email;
    const d = decidir(negocioLleno(), cuarto, LISTA);
    assert.strictEqual(d.accion, 'saltar');
    assert.ok(!('vaciar' === d.accion),
      'Se iba a borrar «lo que sí cuadra» y dejar el resto. Un negocio a medias es peor que ' +
      'uno sin tocar: nadie sabría cuál quedó cómo.');
  });

  it('si un valor es DISTINTO, tampoco', () => {
    const cuarto = cuartoLleno();
    cuarto.duenoTelefono = txt('+570000000000');
    const d = decidir(negocioLleno(), cuarto, LISTA);
    assert.strictEqual(d.accion, 'saltar');
    assert.deepStrictEqual(d.descuadres, ['duenoTelefono']);
  });

  // Firestore guarda 0 como entero o como decimal según quién lo escribiera, y
  // son dos cosas distintas ahí dentro. Se comparan CRUDOS a propósito: ante la
  // duda, saltar. Perder medio segundo es barato; perder un teléfono, no.
  it('si el mismo número está guardado de otra forma, se salta (falla del lado seguro)', () => {
    const cuarto = cuartoLleno();
    cuarto.creditos = { doubleValue: 0 };
    const d = decidir(negocioLleno(), cuarto, LISTA);
    assert.strictEqual(d.accion, 'saltar');
    assert.deepStrictEqual(d.descuadres, ['creditos']);
  });

  it('un campo con valor nulo cuenta como presente, y sin pareja se salta', () => {
    const negocio = negocioLleno();
    negocio.email = { nullValue: null };
    const cuarto = cuartoLleno();
    delete cuarto.email;
    const d = decidir(negocio, cuarto, LISTA);
    assert.strictEqual(d.accion, 'saltar');
    assert.deepStrictEqual(d.descuadres, ['email']);
  });

  // ── EL AMARRE CON LA LISTA BUENA ─────────────────────────────────────────
  // El script no puede tener su propia idea de qué es privado: la saca de
  // negocioPrivado.js. Si esa lista y esta prueba se separan, el vaciado dejaría
  // un campo privado en el escaparate sin que nadie se enterara.
  it('la lista con la que se prueba es la MISMA de negocioPrivado.js', () => {
    const { CAMPOS_PRIVADOS } = cargarDeLaApp('guajirago-aliados/src/negocioPrivado.js');
    assert.deepStrictEqual([...CAMPOS_PRIVADOS].sort(), [...LISTA].sort(),
      'La lista de campos privados cambió y esta prueba se quedó vieja. Actualiza LISTA aquí ' +
      'arriba — y comprueba que el vaciado se lleva de verdad el campo nuevo.');
  });

  it('con la lista de verdad, un negocio de los que hay se vacía entero', () => {
    const { CAMPOS_PRIVADOS } = cargarDeLaApp('guajirago-aliados/src/negocioPrivado.js');
    const d = decidir(negocioLleno(), cuartoLleno(), CAMPOS_PRIVADOS);
    assert.strictEqual(d.accion, 'vaciar');
    assert.strictEqual(d.campos.length, 4, 'los 4 que llevan los negocios de verdad');
  });

  // ── Y QUE NO SE LE PUEDA QUITAR EL FRENO ─────────────────────────────────
  it('con una lista vacía no hace nada, no se inventa qué borrar', () => {
    assert.strictEqual(decidir(negocioLleno(), cuartoLleno(), []).accion, 'limpio');
    assert.strictEqual(decidir(negocioLleno(), cuartoLleno(), null).accion, 'limpio');
  });
});
