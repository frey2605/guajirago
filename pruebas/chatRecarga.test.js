/**
 * EL CHAT DE RECARGA · QUE UNA RESPUESTA NO BORRE EL COMPROBANTE
 *
 * El conductor paga su recarga por Nequi o Daviplata y sube la FOTO del
 * comprobante por este chat. Todos los mensajes viven en UNA lista dentro de su
 * ficha (`usuarios/{uid}.mensajesRecarga`), y a esa lista le escriben CINCO
 * sitios: dos en la app del conductor y tres en el panel.
 *
 * Hasta el 6-sep-2026 los cinco hacían lo mismo: leer la lista entera, pegarle
 * su mensaje, y SUBIR LA LISTA COMPLETA otra vez. El que subiera de segundo, con
 * la copia que había leído ANTES, borraba lo que el otro acababa de mandar. Sin
 * error, sin rastro: el mensaje simplemente dejaba de estar. Y lo que se pierde
 * ahí no es charla — es la prueba de que el conductor pagó.
 *
 * ESTAS PRUEBAS NO LEEN EL CÓDIGO PARA CREÉRSELO: las cuatro primeras ENCIENDEN
 * el emulador de Firestore y hacen que el fallo ocurra de verdad, y luego que
 * NO ocurra. Las de después sí leen las cinco pantallas, para que nadie pueda
 * volver a meter el camino viejo en un sitio y dejar los otros cuatro buenos.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, soloCodigo, cuerpoDeLaFuncion, cuerpoDelCatch } = require('./cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const PROYECTO = 'demo-guajirago';

let RUT;   // @firebase/rules-unit-testing
let FS;    // firebase/firestore
let entorno;

// Fichas propias, con nombres que no usa ninguna otra prueba: estas corren en la
// misma base que funciones.test.js y NO se vacía nada a propósito.
const A = 'usuarios/CHATPRUEBA-A';
const B = 'usuarios/CHATPRUEBA-B';
const C = 'usuarios/CHATPRUEBA-C';

const msg = (texto, autor) => ({ texto, autor, fecha: new Date().toISOString() });

before(async () => {
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  entorno = await RUT.initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      rules: fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8085,
    },
  });
});

after(async () => { if (entorno) await entorno.cleanup(); });

/** Siembra una ficha con su chat, saltándose las reglas a propósito. */
async function sembrar(ruta, mensajes) {
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const { doc, setDoc } = FS;
    await setDoc(doc(ctx.firestore(), ruta), {
      nombre: 'Prueba', tipo: 'conductor', mensajesRecarga: mensajes,
    });
  });
}

/** Lee la lista de mensajes, sin reglas. */
async function chatDe(ruta) {
  let salida = [];
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const { doc, getDoc } = FS;
    const s = await getDoc(doc(ctx.firestore(), ruta));
    salida = (s.exists() ? s.data().mensajesRecarga : []) || [];
  });
  return salida;
}

describe('EL CHAT DE RECARGA · el comprobante no se puede perder', () => {
  it('EL FALLO, REPRODUCIDO · con el camino VIEJO la respuesta se come el comprobante', async () => {
    // Este es el guion exacto de la vida real:
    //   1. el chat tiene un mensaje;
    //   2. el DUEÑO abre el chat en el panel y se queda con esa copia en pantalla;
    //   3. el CONDUCTOR sube su comprobante;
    //   4. el dueño contesta — y sube la lista que tenía de ANTES de la foto.
    const inicial = [msg('Hola, ya pagué', 'conductor')];
    await sembrar(A, inicial);

    const loQueVeElPanel = await chatDe(A);          // paso 2: la copia vieja

    const comprobante = { tipo: 'imagen', url: 'https://x/comprobante.jpg', autor: 'conductor', fecha: new Date().toISOString() };
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, updateDoc } = FS;                  // paso 3: sube la foto
      await updateDoc(doc(ctx.firestore(), A), { mensajesRecarga: [...inicial, comprobante] });
    });

    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, updateDoc } = FS;                  // paso 4: el camino VIEJO
      await updateDoc(doc(ctx.firestore(), A), {
        mensajesRecarga: [...loQueVeElPanel, msg('Ya te mando el código', 'admin')],
      });
    });

    const final = await chatDe(A);
    assert.strictEqual(final.length, 2, 'el guion no salió como se esperaba');
    assert.ok(!final.some((m) => m.tipo === 'imagen'),
      'esta prueba tiene que DEMOSTRAR el fallo: si la foto sobrevive al camino viejo, '
      + 'es que el guion está mal montado y las pruebas de abajo no prueban nada.');
  });

  it('EL ARREGLO · con arrayUnion, la misma respuesta NO borra el comprobante', async () => {
    // Mismo guion, mismo desfase, misma copia vieja. Lo único que cambia es que
    // el mensaje se pega EN EL SERVIDOR en vez de subir la lista entera.
    const inicial = [msg('Hola, ya pagué', 'conductor')];
    await sembrar(B, inicial);

    await chatDe(B);   // el panel se queda con su copia vieja, igual que antes

    const comprobante = { tipo: 'imagen', url: 'https://x/comprobante.jpg', autor: 'conductor', fecha: new Date().toISOString() };
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, updateDoc, arrayUnion } = FS;
      await updateDoc(doc(ctx.firestore(), B), { mensajesRecarga: arrayUnion(comprobante) });
    });
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const { doc, updateDoc, arrayUnion } = FS;
      await updateDoc(doc(ctx.firestore(), B), { mensajesRecarga: arrayUnion(msg('Ya te mando el código', 'admin')) });
    });

    const final = await chatDe(B);
    assert.strictEqual(final.length, 3, 'se perdió un mensaje: quedaron ' + final.length + ' de 3');
    assert.ok(final.some((m) => m.tipo === 'imagen'),
      'EL COMPROBANTE SE PERDIÓ. Es la prueba de que el conductor pagó.');
  });

  it('LA ÚNICA CARA DE arrayUnion · un mensaje IDÉNTICO no se duplica', async () => {
    // Por eso cada mensaje lleva `fecha` con milisegundos: dos mensajes de verdad
    // nunca son idénticos. Si alguien le quita la fecha a un mensaje, empezarían
    // a colapsarse en silencio — y `scripts/medir-chat-recarga.cjs` lo vigila
    // contra los datos REALES cada vez que se corre.
    const igual = { texto: 'hola', autor: 'conductor', fecha: '2026-09-06T10:00:00.000Z' };
    await sembrar(C, []);
    for (let i = 0; i < 3; i++) {
      await entorno.withSecurityRulesDisabled(async (ctx) => {
        const { doc, updateDoc, arrayUnion } = FS;
        await updateDoc(doc(ctx.firestore(), C), { mensajesRecarga: arrayUnion(igual) });
      });
    }
    assert.strictEqual((await chatDe(C)).length, 1,
      'si esto deja de ser 1, arrayUnion cambió de comportamiento y hay que revisar el arreglo entero');
  });

  it('LAS REGLAS LO PERMITEN · el conductor puede pegarse un mensaje en SU ficha', async () => {
    // El arreglo no sirve de nada si las reglas lo rechazan. Aquí se escribe CON
    // las reglas puestas y con la sesión del propio conductor, como en la calle.
    await sembrar(A, []);
    const { doc, updateDoc, arrayUnion } = FS;
    const suyo = entorno.authenticatedContext('CHATPRUEBA-A').firestore();
    await RUT.assertSucceeds(updateDoc(doc(suyo, A), {
      mensajesRecarga: arrayUnion(msg('mi comprobante', 'conductor')),
    }));
  });
});

// ── Y AHORA LAS CINCO PANTALLAS, UNA POR UNA ──────────────────────────────────
//  Las de arriba demuestran que el arreglo funciona. Estas impiden que alguien
//  arregle cuatro sitios y deje el quinto con el camino viejo: bastaría UNO para
//  que los mensajes se sigan perdiendo, porque el que pisa es el que escribe mal.

const ESCRITORES = [
  ['guajirago/src/Creditos.js', 'enviarMensajeRecarga', 'el conductor escribe'],
  ['guajirago/src/Creditos.js', 'enviarComprobante', 'el conductor sube la FOTO'],
  ['guajirago-admin/src/Codigos.js', 'enviarRespuestaRecarga', 'el dueño contesta'],
  ['guajirago-admin/src/Codigos.js', 'enviarPorChatGG', 'el dueño manda el código nuevo'],
  ['guajirago-admin/src/Codigos.js', 'enviarCodigoExistentePorChat', 'el dueño reenvía un código'],
];

/** El cuerpo de una función, sin comentarios ni textos que despisten. */
function cuerpoDe(archivo, nombre) {
  const codigo = leer(archivo);
  const i = codigo.indexOf('const ' + nombre + ' = async');
  assert.ok(i >= 0, 'ya no existe «' + nombre + '» en ' + archivo
    + '. Si se renombró, hay que re-apuntar esta prueba: si no, deja de vigilar nada.');
  const c = cuerpoDeLaFuncion(codigo, i);
  assert.ok(c, 'no pude leer el cuerpo de «' + nombre + '» en ' + archivo);
  return c.texto;
}

describe('EL CHAT DE RECARGA · los CINCO escritores, ninguno menos', () => {
  for (const [archivo, nombre, quien] of ESCRITORES) {
    it('«' + nombre + '» (' + quien + ') pega el mensaje EN EL SERVIDOR', () => {
      const suyo = soloCodigo(cuerpoDe(archivo, nombre));
      assert.match(suyo, /mensajesRecarga:\s*arrayUnion\(/,
        'este sitio no usa arrayUnion. Con que UNO suba la lista entera, los mensajes '
        + 'se siguen perdiendo: el que pisa es el que escribe mal, no los otros cuatro.');
    });

    it('«' + nombre + '» NO vuelve a subir la lista entera', () => {
      const suyo = soloCodigo(cuerpoDe(archivo, nombre));
      // Se mira solo lo que se ESCRIBE a Firestore. Pintar la pantalla con
      // `[...previos, nuevo]` es inofensivo y dos de los cinco lo siguen
      // haciendo a propósito: si se enseña un mensaje de más durante un segundo
      // no se pierde nada, y el onSnapshot lo corrige solo.
      const escrituras = [...suyo.matchAll(/updateDoc\([^;]*?\);/gs)].map((m) => m[0]);
      assert.ok(escrituras.length > 0, '«' + nombre + '» ya no escribe en la base: ¿se movió?');
      for (const e of escrituras) {
        assert.ok(!/mensajesRecarga:\s*\[/.test(e),
          'esta escritura sube la lista entera y puede borrar el mensaje de otro:\n      ' + e.trim());
      }
    });

    it('«' + nombre + '» le pone FECHA al mensaje (sin ella, arrayUnion los junta)', () => {
      const suyo = soloCodigo(cuerpoDe(archivo, nombre));
      // Se pide que el mensaje LLEVE fecha, no CÓMO se saca. CLAUDE.md tiene
      // anotada la deuda de los «74 sitios con new Date().toISOString()»; el día
      // que se cambie por un reloj común, esta prueba tiene que seguir verde
      // sobre código sano. Lo que importa aquí es que el mensaje tenga con qué
      // distinguirse de otro igual. (Y no vale `serverTimestamp()`: Firestore lo
      // prohíbe dentro de un array.)
      // Y una fecha VACÍA no cuenta como fecha: con `fecha: ''` o `fecha: null`
      // dos mensajes vuelven a ser idénticos y arrayUnion los junta, que es
      // justo el fallo que esta prueba dice vigilar.
      assert.match(suyo, /fecha:\s*(?!''|""|null|undefined)[^,\s}]/,
        'un mensaje sin fecha puede salir IDÉNTICO a otro, y arrayUnion descarta los '
        + 'idénticos: dos mensajes iguales se colapsarían en uno, en silencio.');
    });
  }

  // ── ¿Y SI MAÑANA APARECE UN SEXTO ESCRITOR? ─────────────────────────────
  //  La lista de arriba está escrita a mano. Si alguien añade otro sitio que
  //  suba la lista entera, las 15 pruebas de arriba siguen verdes y los
  //  comprobantes vuelven a perderse. Esto barre los dos archivos enteros.
  //  El suelo va POR ARCHIVO, con el número que de verdad tiene cada uno: uno
  //  común de «al menos 2» dejaba pasar que a `Codigos.js` le desapareciera un
  //  escritor de los tres sin que nada lo dijera.
  for (const [archivo, cuantas] of [
    ['guajirago/src/Creditos.js', 2],
    ['guajirago-admin/src/Codigos.js', 3],
  ]) {
    it('BARRIDO · en ' + archivo + ' NINGUNA escritura sube la lista entera', () => {
      const codigo = soloCodigo(leer(archivo));
      const escrituras = [...codigo.matchAll(/updateDoc\([^;]*?\);/gs)]
        .map((m) => m[0])
        .filter((e) => e.includes('mensajesRecarga'));
      assert.ok(escrituras.length >= cuantas,
        'esperaba al menos ' + cuantas + ' escrituras al chat en ' + archivo + ' y encontré '
        + escrituras.length + ': o se movieron, o este barrido dejó de mirar donde debe.');
      for (const e of escrituras) {
        assert.ok(/mensajesRecarga:\s*arrayUnion\(/.test(e),
          'hay una escritura al chat que NO usa arrayUnion:\n      ' + e.trim());
      }
    });
  }

  // ── REGLA 9, SOLO EN LA APP DEL CONDUCTOR ───────────────────────────────
  //  Los tres del panel NO se prueban aquí: ya los vigila `avisosPanel.test.js`
  //  con su lista, y una segunda prueba del mismo proceso es un gemelo de la
  //  SEGUNDA LEY. `Creditos.js`, en cambio, no lo mira NADIE — ni
  //  `avisosConductor.test.js` ni `avisosPasajero.test.js` lo tienen en su lista.
  for (const nombre of ['enviarMensajeRecarga', 'enviarComprobante']) {
    it('«' + nombre + '» no se traga el fallo en silencio (REGLA 9)', () => {
      // SIN COMENTARIOS, Y SE QUITAN ANTES DE BUSCAR. Sin `soloCodigo` esto
      // leería la prosa de dentro del catch: vaciarlo y dejar un comentario que
      // dijera «setError» lo dejaba verde. Es la trampa que documenta
      // `cargar.cjs`, y cazó la primera versión de esta prueba.
      // Y la posición se busca SOBRE EL CÓDIGO YA LIMPIO: quitar los
      // comentarios corre todo hacia atrás, así que un índice sacado del texto
      // original apunta a otro sitio.
      const codigo = soloCodigo(leer('guajirago/src/Creditos.js'));
      const i = codigo.indexOf('const ' + nombre + ' = async');
      assert.ok(i >= 0, 'ya no existe «' + nombre + '» en Creditos.js');
      const cuerpo = cuerpoDelCatch(codigo, i);
      assert.ok(cuerpo, '«' + nombre + '» habla con la base y NO tiene catch.');
      assert.match(cuerpo, /setErrorChatRecarga\(/,
        'el catch de «' + nombre + '» no avisa de nada. El conductor ve irse su mensaje '
        + 'de la caja de texto y cree que llegó, y no llegó.');
    });
  }
});
