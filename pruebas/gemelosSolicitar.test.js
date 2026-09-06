/**
 * LOS GEMELOS SOLICITAR · UN SOLO ARCHIVO
 *
 * SEGUNDA LEY del dueño: «No pueden vivir dos procesos en diferentes archivos.»
 *
 * Hasta el 5-sep-2026 la pantalla de pedir estaba escrita DOS VECES:
 * Solicitar.js (viaje) y SolicitarMensajeria.js (mandado). Medido ese día:
 * **1.235 de 1.308 renglones eran idénticos — el 94%**. Lo que de verdad cambiaba
 * eran ocho cosas: el título, dos rótulos de casilla, el rótulo del botón, un
 * emoji, una palabra, la lista de datos obligatorios, y el bloque de campos del
 * paquete. Todo lo demás era la misma pantalla copiada.
 *
 * Y YA SE HABÍAN EMPEZADO A SEPARAR: mensajería tenía un degradado de color en la
 * barra que taxi no tenía. (Resultó no verse —`progreso` está fijo en 100 y
 * siempre daba verde—, pero es exactamente cómo empieza la separación: alguien
 * mejora una copia y nadie toca la otra.)
 *
 * Estas pruebas guardan la unión. No miran píxeles —ninguna prueba de este
 * proyecto dibuja una pantalla— pero sí que las dos formas sigan existiendo y que
 * el gemelo no vuelva a nacer.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, soloCodigo } = require('./cargar.cjs');

const PANTALLA = 'guajirago/src/Solicitar.js';

describe('SEGUNDA LEY · la pantalla de pedir vive en UN solo archivo', () => {
  it('EL QUE MUERDE · el gemelo no ha vuelto a nacer', () => {
    // Se mira el DISCO, no una lista escrita a mano: si mañana alguien copia el
    // archivo con otro nombre, esto lo ve.
    const dir = path.join(RAIZ, 'guajirago/src');
    const sospechosos = fs.readdirSync(dir)
      .filter((f) => /^Solicitar.+\.js$/.test(f));
    assert.deepStrictEqual(sospechosos, [],
      'ha aparecido otro archivo de pedir: ' + sospechosos.join(', ') + '. Eran dos '
      + 'y se juntaron por algo: al 94% idénticos, cada arreglo había que hacerlo '
      + 'dos veces y uno de los dos se quedaba viejo.');
  });

  it('EL QUE MUERDE · nadie importa ya el archivo que se borró', () => {
    const dir = path.join(RAIZ, 'guajirago/src');
    const culpables = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      const t = soloCodigo(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (/from '\.\/SolicitarMensajeria'|<SolicitarMensajeria/.test(t)) culpables.push(f);
    }
    assert.deepStrictEqual(culpables, [],
      culpables.join(', ') + ' todavía llama a SolicitarMensajeria, que ya no existe. '
      + 'Esa pantalla no abriría.');
  });

  it('EL QUE MUERDE · las DOS formas siguen existiendo, no solo una', () => {
    // El riesgo de juntar dos cosas es quedarse con una. Aquí se comprueba que la
    // bandera decide de verdad, y que el lado del TAXI no desapareció: sus rótulos
    // son los que se perderían sin darse cuenta, porque el archivo base era el de
    // mensajería.
    const t = soloCodigo(leer(PANTALLA));
    assert.ok(/const esMensajeria = tipo === 'Mensajería';/.test(t),
      'ya no existe la bandera que separa las dos pantallas');

    // El título del taxi va en la lista aunque parezca obvio: la primera versión de
    // esta prueba no lo tenía, y poner «Pedir mandado 📦» fijo —o sea, un pasajero
    // pidiendo un taxi leyendo «Pedir mandado»— pasaba en VERDE.
    const DEL_TAXI = ['¿Dónde estás? (Riohacha)', '¿A dónde vas? (Riohacha)',
      'Por favor escribe el origen y destino', "'🚕'", "'viaje'",
      '`Solicitar ${tipo}`'];
    const DEL_MANDADO = ['¿Dónde se recoge? (Riohacha)', '¿Dónde se entrega? (Riohacha)',
      'Pedir mandado', 'Qué vas a enviar', "'🏍️'", "'servicio'"];

    for (const x of DEL_TAXI) {
      assert.ok(t.includes(x),
        'se perdió del lado del TAXI: «' + x + '». El archivo base de la unión fue el '
        + 'de mensajería, así que lo del taxi es justo lo que se pierde sin ruido.');
    }
    for (const x of DEL_MANDADO) {
      assert.ok(t.includes(x), 'se perdió del lado del MANDADO: «' + x + '»');
    }
  });

  it('EL QUE MUERDE · los campos del paquete NO se pintan en un viaje de taxi', () => {
    // Si el bloque de datos del envío quedara sin bandera, un pasajero pidiendo un
    // taxi vería «¿Qué envías?» y «Nombre de quien recibe».
    const t = soloCodigo(leer(PANTALLA));
    const i = t.indexOf('{esMensajeria && (<>');
    assert.ok(i > 0, 'el bloque de campos del paquete ya no está detrás de la bandera: '
      + 'se pintaría también al pedir un taxi.');
    const bloque = t.slice(i, t.indexOf('</>)}', i));
    for (const campo of ['queEnvia', 'recibeNombre', 'recibeTel', 'notaEnvio']) {
      assert.ok(bloque.includes(campo),
        'el campo «' + campo + '» se salió del bloque protegido: se vería en un taxi.');
    }
  });

  it('EL QUE MUERDE · lo obligatorio de cada una es distinto', () => {
    // Un mandado pide seis datos; un viaje pide dos. Si se quedara solo la lista de
    // mensajería, no se podría pedir un taxi sin rellenar «Qué vas a enviar».
    const t = soloCodigo(leer(PANTALLA));
    assert.ok(/if \(esMensajeria\) \{[\s\S]{0,700}?\} else \{[\s\S]{0,300}?origen \|\| !destino/.test(t),
      'la comprobación de datos obligatorios ya no distingue las dos pantallas. Si se '
      + 'quedó la de mensajería, no se puede pedir un taxi sin rellenar los datos de '
      + 'un paquete; si se quedó la de taxi, se puede pedir un mandado sin destinatario.');
  });

  it('EL QUE MUERDE · las dos pantallas se siguen abriendo con su tipo', () => {
    const app = soloCodigo(leer('guajirago/src/App.js'));
    const home = soloCodigo(leer('guajirago/src/Home.js'));
    assert.ok(/<Solicitar tipo="Mensajería"/.test(app),
      'App.js ya no le pasa el tipo «Mensajería»: la pantalla de mandados abriría como '
      + 'si fuera un taxi — sin los campos del paquete y pidiendo otra cosa.');
    assert.ok(/<Solicitar tipo=\{tipoSeleccionado\}/.test(home),
      'Home.js ya no le pasa el tipo del viaje.');
  });
});
