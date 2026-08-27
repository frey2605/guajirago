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
// `leer` SE TRAE DE AHÍ. La primera versión de este archivo se lo volvía a escribir
// a mano —y su copia era PEOR: reventaba con un error de sistema si faltaba un
// repo, mientras que la de cargar.cjs lo dice en cristiano («las pruebas necesitan
// los tres repos juntos»). Justo el caso que importa aquí, porque aliados y el
// panel son repos APARTE que pueden no estar en el disco.
//
// Lo cazó la segunda opinión, y de paso desmintió algo que yo había escrito en el
// libro de excepciones: dije que no había casa común para los ayudantes de
// pruebas y que por eso me salía de la foto con «CERO código duplicado». Las dos
// mitades eran falsas: la casa es esta, y este archivo duplicaba `leer`.
const { leer, cargarDeLaApp } = require('./cargar.cjs');

const { motivoDeRechazo, MOTIVOS } = cargarDeLaApp('guajirago/src/avisoCalificacion.js');

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
 * Deja el código con la MISMA longitud pero sin nada dentro de los textos
 * entrecomillados: cada letra de dentro pasa a ser una «x». Se conserva el largo
 * para que los números de posición sigan valiendo.
 *
 * Hace falta para contar llaves. Sin esto, un `console.log('formato {{ raro')`
 * dentro de un catch descuadraba la cuenta, el contador se salía de la función y
 * acababa mirando el catch del vecino — y la prueba salía VERDE con el agujero
 * abierto. Lo demostró la segunda opinión ejecutándolo.
 */
const sinTextos = (t) => t.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
  (s) => s[0] + 'x'.repeat(s.length - 2) + s[s.length - 1]);

/**
 * El cuerpo de la función que empieza en `desde`, contando llaves.
 */
function cuerpoDeLaFuncion(codigo, desde) {
  const seguro = sinTextos(codigo);
  const abre = seguro.indexOf('{', desde);
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
 * El cuerpo de un `catch`, buscado SOLO DENTRO de la función que empieza en
 * `desde`. Se cuenta en vez de buscar con una expresión porque el agujero se
 * puede escribir de muchas formas —`catch {}` sin paréntesis es JavaScript válido
 * desde 2019— y una expresión solo pilla las que a uno se le ocurrieron.
 *
 * EL «SOLO DENTRO» NO ES ADORNO. La primera versión buscaba hacia adelante sin
 * tope: al quitarle el try/catch a `restaurar()`, agarraba el de
 * `mantenerOculto()` —la función de al lado— y daba la prueba por buena. La
 * segunda opinión lo puso y salió VERDE con el rechazo otra vez mudo. En ese
 * archivo hay TRES catch seguidos: cada uno tapaba al anterior.
 *
 * Devuelve null si esa función no tiene catch, y eso ES un fallo: quien llama
 * tiene que comprobarlo.
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
      assert.ok(/set[A-Za-z]*\s*\(\s*motivo(DeRechazo)?\b/.test(cuerpo),
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

// ── LAS OTRAS DOS APPS (26-ago-2026) ────────────────────────────────────────
// El mismo agujero estaba en aliados y en el panel. Estas pruebas viven AQUÍ y
// no en amarres.test.js porque necesitan `cuerpoDelCatch`, que ya está en este
// archivo: llevárselo a otro sitio sería tener el ayudante en dos casas, y eso
// es justo lo que prohíbe la SEGUNDA LEY. Queda anotado en el libro de
// excepciones, porque este archivo no estaba en la foto de este arreglo.
describe('REGLA 9 · reportar y moderar una reseña tampoco se rechazan en silencio', () => {
  const CATCHES = [
    { archivo: 'guajirago-aliados/src/CalificacionesRestaurante.js', fn: 'const cargar = async',
      que: 'aliados carga las calificaciones del restaurante' },
    { archivo: 'guajirago-aliados/src/CalificacionesRestaurante.js', fn: 'const enviarReporte = async',
      que: 'el restaurante reporta un comentario' },
    { archivo: 'guajirago-admin/src/ComentariosReportados.js', fn: 'const cargar = async',
      que: 'el panel carga los reportados' },
    { archivo: 'guajirago-admin/src/ComentariosReportados.js', fn: 'const restaurar = async',
      que: 'el panel restaura un comentario' },
    { archivo: 'guajirago-admin/src/ComentariosReportados.js', fn: 'const mantenerOculto = async',
      que: 'el panel mantiene oculto un comentario' },
  ];

  for (const c of CATCHES) {
    it('EL QUE MUERDE · «' + c.que + '»: su catch avisa, no se lo traga', () => {
      const t = soloCodigo(leer(c.archivo));
      const i = t.indexOf(c.fn);
      assert.ok(i >= 0, 'no encontré «' + c.fn + '» en ' + c.archivo);
      const cuerpo = cuerpoDelCatch(t, i);
      assert.ok(cuerpo !== null, 'no encontré el catch de ' + c.fn);
      assert.ok(/apuntarRechazo\s*\(/.test(cuerpo),
        c.archivo + ' · ' + c.fn + ': el catch no deja rastro');
      assert.ok(/setAviso\s*\(\s*motivo(DeRechazo)?\b/.test(cuerpo),
        c.archivo + ' · ' + c.fn + ': saca el motivo pero no lo enseña, o ni lo saca');
    });
  }

  for (const a of ['guajirago-aliados/src/CalificacionesRestaurante.js',
    'guajirago-admin/src/ComentariosReportados.js']) {
    it('«' + a.split('/')[0] + '» pinta la ventanita en el mismo componente', () => {
      // Se mira el CÓDIGO, no el texto crudo. La primera versión usaba el archivo
      // entero, así que bastaba comentar la ventanita para que saliera verde — y
      // la cabecera de este mismo archivo dice, con todas las letras, que eso no
      // se hace. Lo cazó la segunda opinión comentándola de verdad.
      const t = soloCodigo(leer(a));
      assert.ok(t.includes("from './avisoRechazo'"), a + ' no importa el archivo compartido');
      assert.ok(t.includes('{aviso && ('), a + ' no pinta la ventanita en ningún sitio');
      // Las dos pantallas tienen UN solo return: si la ventanita está en el
      // archivo, está donde se dispara. En la app del pasajero no era así —había
      // tres pantallas excluyentes— y un aviso acabó donde no se veía nunca.
      //
      // SE CUENTAN LOS RETURN SIN MIRAR LA SANGRÍA. La primera versión exigía
      // exactamente dos espacios, así que metiendo una segunda pantalla sangrada
      // con cuatro se colaba justo el fallo que esta prueba venía a impedir.
      // También lo demostró la segunda opinión, ejecutándolo.
      const returns = (t.match(/^[ \t]*return \(/gm) || []).length;
      assert.strictEqual(returns, 1,
        a + ' ya no tiene un solo return (' + returns + '): hay que comprobar en qué '
        + 'pantalla cae la ventanita, como se hace con Restaurantes.js.');
    });
  }

  // La misma mentira estaba en LAS DOS apps, y la primera versión de este arreglo
  // solo tapó la del panel: en aliados quedó, trece renglones más abajo del catch
  // que sí se arregló y en el mismo archivo declarado en la foto. Lo cazó la
  // segunda opinión. Si falla la carga, al restaurante se le decía «Aún no tienes
  // calificaciones» — pudiendo tener veinte. Aquí se fija para los dos.
  const NO_MIENTEN = [
    { archivo: 'guajirago-admin/src/ComentariosReportados.js', quien: 'el panel',
      vacio: 'lista.length === 0' },
    { archivo: 'guajirago-aliados/src/CalificacionesRestaurante.js', quien: 'aliados',
      vacio: 'lista.length === 0' },
  ];

  for (const n of NO_MIENTEN) {
    it('EL QUE MUERDE · «' + n.quien + '» NO dice «no hay nada» cuando no pudo mirar', () => {
      const codigo = soloCodigo(leer(n.archivo));
      assert.ok(/setFalloCargar\s*\(\s*true\s*\)/.test(codigo),
        n.archivo + ': nadie apunta que la carga falló');
      // La condición es «falló Y no hay nada que enseñar». Las dos mitades importan:
      // sin la primera la pantalla miente; sin la segunda le quita al moderador la
      // lista que ya tenía delante cuando le falla un refresco.
      const guarda = /\(\s*falloCargar\s*&&\s*lista\.length === 0\s*\)\s*\?/;
      assert.ok(guarda.test(codigo),
        n.archivo + ': la pantalla no distingue «vacía porque no hay» de «vacía porque '
        + 'no pude mirar», así que va a seguir diciendo que no hay nada');
      // Y tiene que evaluarse ANTES del «no hay nada», o ese se lleva siempre el caso.
      assert.ok(codigo.search(guarda) < codigo.indexOf(n.vacio + ' ?'),
        n.archivo + ': el «no hay nada» se evalúa antes que el «no pude mirar», '
        + 'así que el segundo no se vería nunca');
    });
  }

});

// ── LA BANDEJA DE RECHAZOS (26-ago-2026) ────────────────────────────────────
// La otra mitad de la REGLA 9: que lo rechazado quede escrito y el dueño lo vea.
describe('REGLA 9 · la bandeja: lo que se apunta y quién lo apunta', () => {
  // guardarRechazo.js habla con la base de datos, así que lleva imports y
  // cargarDeLaApp no puede con él. Se le quitan los imports y se ejecuta: las
  // funciones que interesan —las del NOMBRE del documento— no tocan la base,
  // solo hacen cuentas con texto. Es lo que hay que probar de verdad: ese nombre
  // es el candado que impide que la bandeja se convierta en un vertedero.
  const cargarConImports = (rel) => {
    const fuente = leer(rel).replace(/^import[^;]+;$/gm, '');
    const nombres = [...fuente.matchAll(/^export\s+(?:const|function|async function)\s+([A-Za-z0-9_]+)/gm)]
      .map((m) => m[1]);
    assert.ok(nombres.length > 0, 'no se encontró nada exportado en ' + rel);
    // eslint-disable-next-line no-new-func
    return new Function(fuente.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
  };

  const G = cargarConImports('guajirago/src/guardarRechazo.js');

  it('EL CANDADO · el nombre del documento NO tiene ninguna parte libre', () => {
    // Es lo único que impide que esta colección se convierta en un vertedero:
    // lo que el que escribe pueda ELEGIR del nombre, son documentos que puede
    // crear. La primera versión metía la FECHA dentro y las reglas solo exigían
    // que el nombre EMPEZARA por el uid: la segunda opinión creó 300 documentos
    // de basura con una sola cuenta. Ahora el nombre es uid + sitio, y el sitio
    // sale de una lista cerrada de cuatro.
    assert.strictEqual(G.nombreDelRechazo('pasajero1', 'calificar-pedido'),
      'pasajero1__calificar-pedido');
    // El mismo uid y el mismo sitio dan SIEMPRE el mismo nombre — no depende de
    // la hora, del día ni de nada que cambie solo.
    assert.strictEqual(G.nombreDelRechazo('pasajero1', 'calificar-pedido'),
      G.nombreDelRechazo('pasajero1', 'calificar-pedido'));
    assert.notStrictEqual(G.nombreDelRechazo('pasajero1', 'calificar-pedido'),
      G.nombreDelRechazo('otro', 'calificar-pedido'));
  });

  it('EL CANDADO · con los cuatro sitios salen CUATRO nombres, ni uno más', () => {
    // El tope no es «un puñado»: es un número, y aquí se cuenta.
    const nombres = new Set(G.SITIOS.map((s) => G.nombreDelRechazo('pasajero1', s)));
    assert.strictEqual(nombres.size, G.SITIOS.length);
    assert.strictEqual(G.SITIOS.length, 4, 'cambió el número de sitios: repasa el tope');
    for (const n of nombres) {
      assert.ok(n.startsWith('pasajero1__'), 'el nombre no empieza por el uid: ' + n);
    }
  });

  it('EL CANDADO · el nombre cuadra con lo que se guarda, o el apunte se pierde', () => {
    // Las reglas comparan el nombre del documento con el campo `donde`. Si el
    // nombre se limpiara y el campo no (o al revés), NINGÚN apunte entraría —y
    // fallaría en silencio justo cuando hace falta.
    for (const s of G.SITIOS) {
      assert.strictEqual(G.nombreDelRechazo('u', s), 'u__' + G.limpiar(s),
        'el nombre y el campo no cuadran con «' + s + '»');
    }
  });

  it('el sitio se limpia: sin barras y con tope, o el apunte se pierde', () => {
    // Una barra parte el nombre en dos y Firestore lo rechaza; pasar de 60
    // letras lo niegan las reglas. Cualquiera de las dos cosas perdería el
    // rechazo justo cuando hace falta.
    assert.ok(!G.limpiar('con/barra y espacios').includes('/'));
    assert.ok(!/[^a-zA-Z0-9_-]/.test(G.limpiar('¡ñoño! con acentos/y barras')));
    assert.ok(G.limpiar('z'.repeat(200)).length <= 60);
    assert.ok(G.limpiar('').length > 0, 'sin sitio tiene que quedar ALGO, o el nombre se rompe');
    assert.ok(G.limpiar(null).length > 0);
  });

  // ── QUE LAS PANTALLAS DE VERDAD LO APUNTEN ───────────────────────────────
  const APUNTAN = [
    { archivo: 'guajirago/src/Calificacion.js', fn: 'const enviar = async', que: 'calificar un viaje' },
    { archivo: 'guajirago/src/Restaurantes.js', fn: 'const enviarCalificacion = async', que: 'calificar un pedido' },
    { archivo: 'guajirago-aliados/src/CalificacionesRestaurante.js', fn: 'const cargar = async', que: 'ver las calificaciones' },
    { archivo: 'guajirago-aliados/src/CalificacionesRestaurante.js', fn: 'const enviarReporte = async', que: 'reportar un comentario' },
  ];

  for (const a of APUNTAN) {
    it('EL QUE MUERDE · «' + a.que + '» apunta el rechazo en la bandeja', () => {
      const t = soloCodigo(leer(a.archivo));
      assert.ok(t.includes("from './guardarRechazo'"),
        a.archivo + ' no importa la bandeja');
      const cuerpo = cuerpoDelCatch(t, t.indexOf(a.fn));
      assert.ok(cuerpo !== null, 'no encontré el catch de ' + a.fn);
      assert.ok(/guardarRechazo\s*\(/.test(cuerpo),
        a.archivo + ' · ' + a.fn + ': avisa al usuario pero NO lo apunta en la bandeja');
      // Y la clase se saca del motivo, no se escribe a mano: si se escribiera a
      // mano seria una SEGUNDA calculadora del mismo numero (SEGUNDA LEY), y en
      // un mes diria una cosa distinta de la que ve el usuario en su ventanita.
      assert.ok(/guardarRechazo\([^)]*motivo\.clave/.test(cuerpo),
        a.archivo + ' · ' + a.fn + ': la clase del fallo no sale del motivo');
    });
  }

  it('EL QUE MUERDE · la bandeja del panel NO dice «no ha fallado nada» cuando no pudo mirar', () => {
    // Es la mentira más peligrosa de las tres, porque aquí «vacío» es la mejor
    // noticia posible: el dueño se iría convencido de que todo va bien.
    const codigo = soloCodigo(leer('guajirago-admin/src/Rechazos.js'));
    assert.ok(/setFalloCargar\s*\(\s*true\s*\)/.test(codigo), 'nadie apunta que la carga falló');
    const guarda = /\(\s*falloCargar\s*&&\s*lista\.length === 0\s*\)\s*\?/;
    assert.ok(guarda.test(codigo), 'la pantalla no distingue «no hay» de «no pude mirar»');
    assert.ok(codigo.search(guarda) < codigo.indexOf('lista.length === 0 ?'),
      'el «no hay nada» se evalúa antes que el «no pude mirar»');
  });

  it('la bandeja cuenta las VECES, no los renglones', () => {
    // Un renglón puede llevar cuarenta rechazos dentro. Contar renglones diría
    // «pasó 4 veces» cuando pasó 40, que es justo al revés de lo que importa.
    const codigo = soloCodigo(leer('guajirago-admin/src/Rechazos.js'));
    assert.ok(/reduce\(\(s, r\) => s \+ \(r\.veces \|\| 0\), 0\)/.test(codigo),
      'el total no suma las veces: está contando renglones');
  });
});
