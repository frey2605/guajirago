/**
 * REGLA 9 · NADA SE RECHAZA EN SILENCIO — PRUEBAS QUE EJECUTAN EL ARCHIVO REAL
 *
 * Palabras del dueño: «Nada se rechaza en silencio. Todo rechazo va a una
 * bandeja con su motivo.»
 *
 * Hasta el 26-ago-2026 los DOS sitios que guardan una calificación se tragaban
 * el fallo con un `catch` vacío. Estas pruebas cargan
 * guajirago/src/avisoCalificacion.js tal cual está en el disco, y además
 * COMPRUEBAN LOS DOS SITIOS QUE LO USAN: que ya no queda ningún catch vacío en
 * el camino de calificar. Sin esa segunda mitad, alguien podría volver a
 * ponerlo mañana y estas pruebas seguirían verdes.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { RAIZ, cargarDeLaApp } = require('./cargar.cjs');

const { motivoDeRechazo, MOTIVOS } = cargarDeLaApp('guajirago/src/avisoCalificacion.js');

const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

// Se miran los RENGLONES DE CÓDIGO, no los comentarios. La primera versión de
// estas pruebas no lo hacía y se puso roja ella sola: encontró un «catch (e) {}»
// escrito DENTRO de un comentario que explicaba cómo era antes. Una prueba que
// lee comentarios no comprueba lo que hace el programa: comprueba lo que dice.
//
// El `//` se quita solo cuando ABRE el renglón. La versión anterior lo quitaba
// en cualquier posición, así que se comía la mitad de un texto entrecomillado
// como 'https://…' y mutilaba justo el código que venía a mirar. Y se quitan
// también los comentarios de bloque, que la anterior no tocaba — por ahí se le
// colaba un `catch (e) { /* nada */ }`. Las dos cosas las cazó la segunda opinión.
const soloCodigo = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');

/**
 * El cuerpo de un `catch`, contando llaves. Se cuenta en vez de buscar con una
 * expresión porque el agujero se puede escribir de muchas formas —`catch {}` sin
 * paréntesis es JavaScript válido desde 2019— y una expresión solo pilla las que
 * a uno se le ocurrieron. Con el cuerpo en la mano se puede preguntar lo único
 * que importa: si DENTRO pasa algo o no.
 */
function cuerpoDelCatch(codigo, desde) {
  const m = /catch\s*(\([^)]*\))?\s*\{/.exec(codigo.slice(desde));
  if (!m) return null;
  let i = desde + m.index + m[0].length;
  let hondo = 1;
  const ini = i;
  while (i < codigo.length && hondo > 0) {
    if (codigo[i] === '{') hondo += 1;
    else if (codigo[i] === '}') hondo -= 1;
    i += 1;
  }
  return codigo.slice(ini, i - 1);
}

describe('REGLA 9 · una calificación que no entra se le dice al cliente', () => {
  it('el «no tienes permiso» del servidor se traduce a algo que una persona entiende', () => {
    const m = motivoDeRechazo({ code: 'permission-denied' });
    assert.strictEqual(m, MOTIVOS.permiso);
    assert.ok(m.titulo.length > 0, 'sin título no hay ventanita');
    assert.ok(m.texto.length > 0, 'sin texto el aviso no dice nada');
    // Que no se le escupa la jerga del SDK a la cara. OJO: «error» NO va en esta
    // lista — en español es una palabra normal y corriente, y la primera versión
    // de esta prueba tumbaba un mensaje perfectamente claro solo por llevarla.
    assert.ok(!/permission|denied|firestore|unavailable/i.test(m.titulo + m.texto),
      'el aviso lleva jerga en inglés: «' + m.titulo + ' / ' + m.texto + '»');
  });

  it('quedarse sin internet NO se cuenta como un rechazo del servidor', () => {
    // Son dos cosas distintas y al cliente le importan de forma distinta: con una
    // vuelve a intentarlo cuando tenga señal; con la otra no va a entrar nunca.
    assert.strictEqual(motivoDeRechazo({ code: 'unavailable' }), MOTIVOS.sinRed);
    assert.strictEqual(motivoDeRechazo({ code: 'deadline-exceeded' }), MOTIVOS.sinRed);
    assert.notStrictEqual(MOTIVOS.sinRed, MOTIVOS.permiso);
  });

  it('lo que no se reconoce TAMBIÉN avisa — nunca se devuelve nada vacío', () => {
    // Esta es la que de verdad importa: de donde venimos es de no avisar NUNCA.
    // Un aviso genérico es infinitamente mejor que ninguno.
    for (const caso of [{ code: 'algo-raro' }, {}, null, undefined, 'un texto suelto', new Error('boom')]) {
      const m = motivoDeRechazo(caso);
      assert.ok(m && m.titulo && m.texto,
        'se quedó sin aviso con: ' + JSON.stringify(caso));
    }
  });

  it('los tres motivos son distintos entre sí y ninguno está vacío', () => {
    const claves = Object.keys(MOTIVOS);
    assert.ok(claves.length >= 3, 'faltan motivos');
    const textos = new Set();
    for (const k of claves) {
      const m = MOTIVOS[k];
      assert.ok(m.titulo && m.texto, 'el motivo «' + k + '» está a medias');
      textos.add(m.titulo + '|' + m.texto);
    }
    assert.strictEqual(textos.size, claves.length, 'hay dos motivos que dicen lo mismo');
  });

  it('«sin conexión» se distingue por el TÍTULO, porque ahí el cliente tiene que hacer otra cosa', () => {
    // Lo cazó un mutante: cambiarle el título a sinRed para que dijera lo mismo
    // que los otros dos SOBREVIVÍA a todas las pruebas, porque la de arriba
    // compara el par título+texto y los textos seguían siendo distintos.
    //
    // Y sí importa: en los otros dos casos al cliente le decimos que escriba a
    // soporte; en este, que vuelva a intentarlo cuando tenga señal. Es la única
    // situación en la que lo que tiene que HACER es diferente, y el titular es
    // lo primero que lee.
    //
    // OJO: NO se pide que los tres títulos sean distintos. `permiso` y `otro`
    // comparten titular A PROPÓSITO — para el cliente son el mismo problema
    // («no se guardó») y solo cambia el detalle de abajo.
    assert.notStrictEqual(MOTIVOS.sinRed.titulo, MOTIVOS.permiso.titulo);
    assert.notStrictEqual(MOTIVOS.sinRed.titulo, MOTIVOS.otro.titulo);
  });
});

// ── Y LA MITAD QUE DE VERDAD SE PUEDE ROMPER MAÑANA ──────────────────────────
// Un archivo de motivos perfecto no sirve de nada si la pantalla lo ignora.
describe('REGLA 9 · las dos pantallas que califican ya no se tragan el fallo', () => {
  const SITIOS = [
    { archivo: 'guajirago/src/Calificacion.js', que: 'la del viaje' },
    { archivo: 'guajirago/src/Restaurantes.js', que: 'la del pedido' },
  ];

  for (const s of SITIOS) {
    it('«' + s.que + '» usa el archivo compartido y no se lo escribe por su cuenta', () => {
      const t = leer(s.archivo);
      assert.ok(t.includes("from './avisoCalificacion'"),
        s.archivo + ' no importa el archivo de los motivos');
      assert.ok(t.includes('motivoDeRechazo('),
        s.archivo + ' no llama a motivoDeRechazo()');
      assert.ok(t.includes('apuntarRechazo('),
        s.archivo + ' no deja rastro del rechazo');
    });
  }

  it('EL QUE MUERDE · el catch de calificar HACE algo, se escriba como se escriba', () => {
    // Restaurantes.js tiene otros ocho catch vacíos que NO son de este arreglo y
    // que la PRIMERA LEY prohíbe tocar. Por eso no se mira el archivo entero: se
    // busca el catch de la función de calificar y se mira SU cuerpo.
    //
    // Se pregunta en POSITIVO —«¿llama a apuntarRechazo?»— y no «¿está vacío?».
    // La versión anterior preguntaba lo segundo con una expresión, y la segunda
    // opinión la burló de cuatro formas: `catch {}` sin paréntesis, con un
    // comentario de bloque dentro, con un `console.log(e)` que el cliente no ve,
    // y con un `void e;`. Todas «no están vacías». Ninguna avisa a nadie.
    const SITIOS = [
      { archivo: 'guajirago/src/Calificacion.js', desde: 'const enviar = async' },
      { archivo: 'guajirago/src/Restaurantes.js', desde: 'const enviarCalificacion = async' },
    ];
    for (const p of SITIOS) {
      const t = soloCodigo(leer(p.archivo));
      const i = t.indexOf(p.desde);
      assert.ok(i >= 0, 'no encontré «' + p.desde + '» en ' + p.archivo);
      const cuerpo = cuerpoDelCatch(t, i);
      assert.ok(cuerpo !== null, 'no encontré el catch en ' + p.archivo);
      assert.ok(/apuntarRechazo\s*\(/.test(cuerpo),
        p.archivo + ': el catch no deja rastro del rechazo');
      assert.ok(/motivoDeRechazo\s*\(/.test(cuerpo),
        p.archivo + ': el catch no saca el motivo del archivo compartido');
      assert.ok(/set[A-Za-z]*\s*\(\s*motivoDeRechazo/.test(cuerpo),
        p.archivo + ': saca el motivo pero NO lo enseña. Calcularlo y no pintarlo '
        + 'es exactamente lo mismo que tragárselo.');
    }
  });

  // ── LA QUE FALTABA, Y ES LA QUE HABRÍA CAZADO EL FALLO DE VERDAD ───────────
  // La primera versión de este arreglo puso la ventanita de Restaurantes.js en
  // la pantalla del MENÚ, y el botón de calificar vive en la de SEGUIMIENTO. Son
  // excluyentes: el aviso no se veía NUNCA. Las nueve pruebas de entonces salían
  // verdes igual, porque solo miraban que ciertas palabras estuvieran en el
  // archivo. Lo cazó la segunda opinión con el mismo Babel que compila la app.
  //
  // El guardián tampoco podía verlo: compara ARCHIVOS, no sitios.
  it('EL QUE MUERDE · la ventanita se pinta en la MISMA pantalla donde está el botón', () => {
    const t = leer('guajirago/src/Restaurantes.js');
    // Las pantallas de este archivo son bloques `if (pantalla === '…')` seguidos.
    const cortes = [...t.matchAll(/^\s*if \(pantalla === '([a-zA-Z]+)'/gm)]
      .map((m) => ({ nombre: m[1], en: m.index }));
    assert.ok(cortes.length >= 2, 'no reconocí las pantallas de Restaurantes.js');

    const pantallaDe = (busca) => {
      const donde = t.indexOf(busca);
      assert.ok(donde >= 0, 'no encontré «' + busca + '»');
      let cual = null;
      for (const c of cortes) if (c.en < donde) cual = c.nombre;
      return cual;
    };

    const dondeElBoton = pantallaDe('onClick={enviarCalificacion}');
    const dondeElAviso = pantallaDe('{avisoCalif && (');
    assert.strictEqual(dondeElAviso, dondeElBoton,
      'el botón de calificar está en la pantalla «' + dondeElBoton + '» y su aviso '
      + 'en «' + dondeElAviso + '»: son excluyentes, así que el cliente no vería nada.');
  });

  // ── Y LA PUERTA QUE ESTE MISMO ARREGLO ABRIÓ ───────────────────────────────
  // Cada envío son DOS escrituras. Si la primera entra y la segunda falla, la
  // calificación YA ESTÁ GUARDADA. Decirle entonces «no pudimos guardarla» es
  // mentir, y como ahora se le deja reintentar, cada reintento mete OTRO voto:
  // las reglas no impiden calificar dos veces el mismo pedido o viaje. Antes del
  // arreglo esto no podía pasar porque la pantalla se cerraba sola.
  it('EL QUE MUERDE · si la calificación SÍ entró, no se avisa de fallo ni se deja repetir', () => {
    const SITIOS = [
      { archivo: 'guajirago/src/Calificacion.js', desde: 'const enviar = async' },
      { archivo: 'guajirago/src/Restaurantes.js', desde: 'const enviarCalificacion = async' },
    ];
    for (const p of SITIOS) {
      const t = soloCodigo(leer(p.archivo));
      const i = t.indexOf(p.desde);
      const cuerpo = cuerpoDelCatch(t, i);
      // Entre el addDoc y el catch tiene que quedar apuntado que ya entró.
      const antes = t.slice(i, t.indexOf('catch', i));
      assert.ok(/guardada\s*=\s*true/.test(antes),
        p.archivo + ': no se apunta que la calificación entró, así que un fallo de '
        + 'la SEGUNDA escritura se cuenta como si no hubiera entrado ninguna.');
      // Y el catch tiene que mirarlo antes de avisar.
      assert.ok(/if\s*\(\s*!?\s*guardada\s*\)/.test(cuerpo),
        p.archivo + ': el catch no mira si ya se había guardado. Le va a decir «no '
        + 'pudimos guardarla» a alguien cuya calificación sí entró, y a invitarle a '
        + 'mandar otra.');
    }
  });

  it('la del VIAJE no cierra la pantalla cuando el envío falló', () => {
    // Era lo peor de las dos: llamaba a onFinalizar() pasara lo que pasara, así
    // que el pasajero se iba creyendo que había calificado.
    const t = leer('guajirago/src/Calificacion.js');
    const i = t.indexOf('const enviar = async');
    const f = t.indexOf('onFinalizar();', t.indexOf('catch', i));
    const catchBloque = soloCodigo(t.slice(t.indexOf('catch', i), f));
    assert.ok(/return;/.test(catchBloque),
      'el catch no corta: la pantalla se cierra igual y el pasajero cree que calificó');
  });
});
