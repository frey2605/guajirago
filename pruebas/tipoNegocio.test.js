/**
 * QUE TODO NEGOCIO DIGA QUÉ ES · la decisión, probada aparte
 *
 * `scripts/poner-tipo-negocio.cjs` escribe en la base de un negocio que va a ser
 * un CLIENTE QUE PAGA. Lo que decide qué escribir es una función pura, `decidir`,
 * y estas pruebas la ejercitan sin tocar Firestore — el mismo patrón que
 * pruebas/vaciado.test.js.
 *
 * ── LO QUE ESTE GUION NO PUEDE HACER, Y ES LO QUE MÁS SE VIGILA ────────────
 * NO PUEDE ADIVINAR. Si las señales se contradicen, o no hay ninguna, tiene que
 * PARAR y decírselo al dueño. Un guion que le adivina el tipo de negocio a un
 * cliente que paga es un guion que se equivoca en silencio, y el cliente se entera
 * cuando abre la app y no encuentra sus mesas.
 *
 * Por eso la mitad de estas pruebas comprueban lo que NO hace.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  decidir, SENALES, direccionDeEscritura, cuerpoDeEscritura,
} = require('../scripts/poner-tipo-negocio.cjs');
const { leer } = require('./cargar.cjs');

// Un negocio de verdad trae muchos campos; solo unos pocos delatan qué es.
const COMUNES = ['nombre', 'fechaCreacion', 'activo', 'rol', 'menu', 'perfilCompleto'];
const con = (...extra) => [...COMUNES, ...extra];

describe('EL ESQUELETO · qué tipo de negocio es cada uno', () => {
  it('EL QUE MUERDE · lo que YA dice qué es, no se toca', () => {
    // Si alguien puso el tipo —el dueño, o el propio negocio al registrarse—, esa
    // decisión manda. Ni siquiera se mira si las señales dicen otra cosa.
    const d = decidir(con('numeroMesas', 'demoraMin'), 'turismo');
    assert.strictEqual(d.accion, 'dejar');
    assert.match(d.porque, /turismo/);
  });

  it('un restaurante se reconoce por sus campos', () => {
    const d = decidir(con('numeroMesas', 'flujoDomicilio', 'costoEnvio'), undefined);
    assert.strictEqual(d.accion, 'poner');
    assert.strictEqual(d.tipo, 'restaurante');
    // El porqué se enseña en el simulacro: el dueño tiene que poder discutirlo.
    assert.match(d.porque, /numeroMesas/);
  });

  it('una agencia de turismo también', () => {
    const d = decidir(con('tours', 'alquileres'), undefined);
    assert.strictEqual(d.accion, 'poner');
    assert.strictEqual(d.tipo, 'turismo');
  });

  it('EL QUE MUERDE · con UNA sola señal basta, pero tiene que haberla', () => {
    assert.strictEqual(decidir(con('tours'), undefined).tipo, 'turismo');
    assert.strictEqual(decidir(con('pedidoMinimo'), undefined).tipo, 'restaurante');
  });

  // ── LO QUE NO HACE ──────────────────────────────────────────────────────
  it('EL QUE MUERDE · si las señales se CONTRADICEN, no adivina: pregunta', () => {
    // Un negocio con mesas Y tours. Puede ser un error, o puede ser un hotel con
    // restaurante — que es justo el caso que el dueño quiere soportar. En los dos
    // casos la respuesta es la misma: NO decidir por él.
    const d = decidir(con('numeroMesas', 'tours'), undefined);
    assert.strictEqual(d.accion, 'preguntar',
      'con señales de dos tipos el guion ADIVINÓ en vez de preguntar. A un cliente '
      + 'que paga no se le adivina qué negocio tiene.');
    assert.match(d.porque, /CONTRADICEN/);
    assert.strictEqual(d.tipo, undefined, 'no puede proponer un tipo cuando no lo sabe');
  });

  it('EL QUE MUERDE · si no hay NINGUNA señal, tampoco adivina', () => {
    const d = decidir(COMUNES, undefined);
    assert.strictEqual(d.accion, 'preguntar',
      'un negocio sin ninguna pista se le asignó un tipo por defecto. Eso es '
      + 'inventarse el negocio de un cliente.');
    assert.strictEqual(d.tipo, undefined);
  });

  it('EL QUE MUERDE · un negocio vacío no revienta el guion', () => {
    const d = decidir([], undefined);
    assert.strictEqual(d.accion, 'preguntar');
  });

  it('EL QUE MUERDE · un tipo puesto a mano que no reconocemos SE RESPETA', () => {
    // El dueño va a vender a hoteles y peluquerías. Cuando aparezca un
    // `tipoNegocio: 'hotel'` que este guion no conoce, NO puede pisarlo.
    const d = decidir(con('numeroMesas'), 'hotel');
    assert.strictEqual(d.accion, 'dejar',
      'el guion pisó un tipo que no conocía. Cuando lleguen hoteles y peluquerías '
      + 'esto les cambiaría el negocio por debajo.');
  });

  // ── LAS SEÑALES, QUE SON EL CIMIENTO ────────────────────────────────────
  it('EL QUE MUERDE · ninguna señal sirve para dos tipos a la vez', () => {
    // Si un mismo campo estuviera en dos listas, TODO negocio que lo tuviera
    // saldría «contradictorio» y el guion no serviría para nada.
    const vistas = new Map();
    for (const [tipo, lista] of Object.entries(SENALES)) {
      for (const campo of lista) {
        assert.ok(!vistas.has(campo),
          'el campo «' + campo + '» delata a la vez a ' + vistas.get(campo) + ' y a '
          + tipo + '. Con eso, cualquier negocio que lo tenga sale contradictorio.');
        vistas.set(campo, tipo);
      }
    }
  });

  it('EL QUE MUERDE · las señales son campos que las pantallas escriben de verdad', () => {
    // Una señal inventada no delata a nadie: el guion mandaría a preguntar por
    // todos los negocios y no serviría. Se comprueba contra el código de las apps.
    const { leer, soloCodigo } = require('./cargar.cjs');
    const codigo = [
      'guajirago-aliados/src/PerfilRestaurante.js',
      'guajirago-aliados/src/PerfilAgencia.js',
      'guajirago-aliados/src/ConfigMesas.js',
      'guajirago-aliados/src/Tours.js',
      'guajirago-aliados/src/ConfigFlujos.js',
      'guajirago-aliados/src/App.js',
      'guajirago-aliados/src/Login.js',
      'guajirago-aliados/src/Mesero.js',
    ].map((f) => soloCodigo(leer(f))).join('\n');

    const huerfanas = [];
    for (const lista of Object.values(SENALES)) {
      for (const campo of lista) if (!codigo.includes(campo)) huerfanas.push(campo);
    }
    assert.deepStrictEqual(huerfanas, [],
      'estas señales no las escribe ninguna pantalla: ' + huerfanas.join(', ')
      + '. Una señal que nadie escribe no delata a nadie, y el guion mandaría a '
      + 'preguntar por todos los negocios.');
  });

  it('EL QUE MUERDE · una señal tiene que ser EXCLUSIVA de su tipo', () => {
    // QUE EL CAMPO EXISTA NO BASTA, y esto costó un mutante vivo: la segunda
    // opinión metió `logo` como señal de turismo y la prueba de arriba pasó en
    // verde —`logo` sí lo escribe una pantalla— pero lo escriben LAS DOS. Con eso,
    // los dos restaurantes reales pasaban a «señales contradictorias» y el guion
    // dejaba de tocarlos. Un mutante verde que cambia lo que le pasa a los datos.
    //
    // Una señal solo sirve si la escribe el tipo al que delata Y NO EL OTRO.
    const { leer, soloCodigo } = require('./cargar.cjs');
    const DEL_TIPO = {
      turismo: ['PerfilAgencia.js', 'Tours.js', 'ReservasTurismo.js'],
      restaurante: ['PerfilRestaurante.js', 'ConfigMesas.js', 'Mesero.js', 'Menu.js',
        'ConfigFlujos.js', 'PedidosDomicilio.js'],
    };
    const codigoDe = (tipo) => DEL_TIPO[tipo]
      .map((f) => soloCodigo(leer('guajirago-aliados/src/' + f))).join('\n');

    const compartidas = [];
    for (const [tipo, campos] of Object.entries(SENALES)) {
      const elOtro = Object.keys(DEL_TIPO).find((x) => x !== tipo);
      const codigoDelOtro = codigoDe(elOtro);
      for (const campo of campos) {
        if (codigoDelOtro.includes(campo)) compartidas.push(campo + ' (dice ' + tipo + ', pero lo escribe ' + elOtro + ')');
      }
    }
    assert.deepStrictEqual(compartidas, [],
      'estas señales las escriben LOS DOS tipos: ' + compartidas.join('; ')
      + '. Una señal compartida no delata a nadie: hace que negocios normales '
      + 'salgan «contradictorios» y el guion deje de tocarlos.');
  });

  it('EL QUE MUERDE · la lista de señales es la acordada, no una cualquiera', () => {
    // Las señales son una decisión, no un detalle: quitar una debilita la
    // deducción en silencio (quitar `demoraMin` no rompía ninguna prueba). Se
    // fijan aquí para que cambiarlas sea un acto consciente y no un descuido.
    //
    // SI AÑADE UN TIPO NUEVO —hotel, peluquería— hay que añadir sus señales AQUÍ
    // y en el guion, y entonces esta prueba se pone roja y se actualiza a mano.
    // Es a propósito: un tipo nuevo sin señales hace que el guion le escriba
    // «restaurante» a un hotel.
    assert.deepStrictEqual(SENALES, {
      turismo: ['tours', 'alquileres'],
      restaurante: ['numeroMesas', 'flujoDomicilio', 'flujoLocal', 'demoraMin',
        'pedidoMinimo'],
    }, 'cambió la lista de señales. Si es a propósito, actualiza esta prueba y di '
      + 'por qué; si no, alguien debilitó la deducción sin darse cuenta.');
  });
});

// ── LA ESCRITURA · LOS RENGLONES QUE PUEDEN DESTRUIR DATOS ─────────────────
//
// La segunda opinión soltó 18 mutantes contra este guion y sobrevivieron 14 —
// SIETE de ellos aquí, porque las pruebas cubrían LA DECISIÓN y ni un solo
// renglón de LA ESCRITURA. Entre los que pasaban en verde:
//
//   · quitar el `updateMask` -> el PATCH REEMPLAZA EL DOCUMENTO ENTERO. Al negocio
//     de un cliente que paga se le borra el menú, el horario y las mesas.
//   · apuntar a otra colección.
//   · escribir siempre 'restaurante' en vez del tipo que se dedujo.
//
// Un guion que escribe en la base de un cliente no puede tener su parte peligrosa
// sin vigilar. Esto es esa vigilancia.
describe('EL ESQUELETO · la escritura, que es la parte que puede hacer daño', () => {
  const BASE = 'https://firestore.googleapis.com/v1/projects/guajirago/databases/(default)/documents';
  const UID = 'LD2hv04fGQVrXn8zjYQ3Jp4VinA3';

  it('EL QUE MUERDE · lleva la marca que limita la escritura a UN campo', () => {
    // Sin esta marca, Firestore REEMPLAZA el documento entero. Es el mutante que
    // más daño hace de todos los que se probaron.
    const url = direccionDeEscritura(BASE, UID);
    assert.match(url, /\?updateMask\.fieldPaths=tipoNegocio$/,
      'la dirección perdió el `updateMask`. Sin él, este PATCH no cambia un campo: '
      + 'REEMPLAZA EL DOCUMENTO ENTERO y le borra al negocio el menú, el horario y '
      + 'las mesas. Es lo único que separa «poner un campo» de «perder los datos '
      + 'de un cliente».');
  });

  it('EL QUE MUERDE · escribe en «restaurantes» y en el negocio que toca', () => {
    const url = direccionDeEscritura(BASE, UID);
    assert.ok(url.startsWith(BASE + '/restaurantes/'),
      'la dirección apunta a otro sitio: ' + url);
    assert.ok(url.includes('/restaurantes/' + UID + '?'),
      'la dirección no lleva el negocio que se pidió');
  });

  it('EL QUE MUERDE · un identificador raro NO deja la escritura sin marca', () => {
    // Un `?` o un `#` en el identificador parten la dirección: la marca se queda
    // fuera y el PATCH arrasa el documento. Hoy los tres identificadores son uid
    // de Firebase (letras y números), así que es una bomba sin espoleta — pero
    // taparla es una línea y destaparla cuesta los datos de un negocio.
    for (const raro of ['id?roto', 'id#roto', 'id con espacio', 'id/otro']) {
      const url = direccionDeEscritura(BASE, raro);
      assert.match(url, /\?updateMask\.fieldPaths=tipoNegocio$/,
        'con el identificador «' + raro + '» la dirección queda «' + url
        + '»: la marca se salió y el PATCH borraría el documento entero.');
      assert.strictEqual(url.split('?').length, 2,
        'con «' + raro + '» la dirección tiene más de un «?»: no se sabe dónde '
        + 'empieza la marca.');
    }
  });

  it('EL QUE MUERDE · manda UN solo campo, y de texto', () => {
    const cuerpo = cuerpoDeEscritura('restaurante');
    assert.deepStrictEqual(Object.keys(cuerpo), ['fields']);
    assert.deepStrictEqual(Object.keys(cuerpo.fields), ['tipoNegocio'],
      'el cuerpo lleva más campos que `tipoNegocio`: se estaría escribiendo algo '
      + 'que nadie revisó en el simulacro.');
    assert.deepStrictEqual(cuerpo.fields.tipoNegocio, { stringValue: 'restaurante' });
  });

  it('EL QUE MUERDE · escribe el tipo que se le da, no uno fijo', () => {
    // El mutante era escribir siempre 'restaurante'. A una agencia le cambiaría
    // el negocio.
    assert.strictEqual(cuerpoDeEscritura('turismo').fields.tipoNegocio.stringValue, 'turismo');
    assert.strictEqual(cuerpoDeEscritura('hotel').fields.tipoNegocio.stringValue, 'hotel');
  });
});

// ── UNA SOLA CALCULADORA (SEGUNDA LEY) ────────────────────────────────────
describe('EL ESQUELETO · los dos guiones deciden con la misma lista', () => {
  it('EL QUE MUERDE · el guion que MIDE usa las señales del que PONE', () => {
    // Tenían listas distintas —la de medir llevaba `costoEnvio` y la de poner no—
    // así que daban razones distintas para el mismo negocio. Y el PASO 10 manda
    // re-correr el que MIDE para comprobar lo que escribió el que PONE: se estaría
    // comprobando con otra calculadora. Lo cazó la segunda opinión.
    const medir = leer('scripts/medir-esqueleto.cjs');
    assert.match(medir, /require\('\.\/poner-tipo-negocio\.cjs'\)/,
      'scripts/medir-esqueleto.cjs volvió a tener su propia lista de señales. Los '
      + 'dos guiones tienen que decidir con la misma, o el paso 10 comprueba con '
      + 'una calculadora distinta de la que decidió (SEGUNDA LEY).');
    assert.ok(!/'costoEnvio'/.test(medir),
      'reapareció `costoEnvio` como señal: ninguna pantalla lo escribe, es un campo '
      + 'fósil.');
  });
});
