/**
 * LA PANTALLA DE COBROS DEL PANEL · y el amarre con el servidor
 *
 * El software de aliados se vende. `guajirago-admin/src/Cobros.js` es donde se
 * le pone precio a cada cliente y se decide si sigue trabajando.
 *
 * DOS COSAS SE COMPRUEBAN AQUÍ, y son de distinta naturaleza:
 *
 *  1. EL AMARRE. El panel es un REPO APARTE y no puede importar del servidor, así
 *     que la lista de estados está escrita dos veces. Estas pruebas CARGAN Y
 *     EJECUTAN los dos lados y se ponen rojas si dejan de decir lo mismo. Sin
 *     esto, el día que se separen no falla nada con estruendo: el panel pinta un
 *     cliente BLOQUEADO como uno cualquiera y nadie se entera de que dejó de pagar.
 *
 *  2. QUE LA PANTALLA NO DECIDA. La SEGUNDA LEY dice que la calculadora buena es
 *     la del servidor. Si esta pantalla calculara el estado por su cuenta habría
 *     dos calculadoras del mismo proceso, con el dinero de por medio.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  leer, cargarDeLaApp, soloCodigo, sinTextos, dentroDeTry, cuerpoDelCatch,
  cuerpoDeLaFuncion,
} = require('./cargar.cjs');

const PANEL = 'guajirago-admin/src/estadosCobro.js';
const PANTALLA = 'guajirago-admin/src/Cobros.js';

const panel = cargarDeLaApp(PANEL);
const servidor = require('../guajirago/functions/suscripcion.js');
const rutina = require('../guajirago/functions/cobros.cjs');

describe('AMARRE · los estados del cobro, en el panel y en el servidor', () => {
  it('EL QUE MUERDE · la lista de estados dice lo mismo en los dos lados', () => {
    // Si se separan, el panel recibe del servidor un estado que no conoce. No
    // revienta: lo pinta en gris. Un cliente bloqueado se vería como uno
    // cualquiera y el dueño no sabría que lleva un mes sin pagar.
    assert.deepStrictEqual(panel.ESTADOS, servidor.ESTADOS,
      'la lista de estados del panel y la del servidor se separaron.\n'
      + '  panel:    ' + JSON.stringify(panel.ESTADOS) + '\n'
      + '  servidor: ' + JSON.stringify(servidor.ESTADOS) + '\n'
      + '  Se arregla PRIMERO en guajirago/functions/suscripcion.js, y luego en '
      + PANEL);
  });

  it('EL QUE MUERDE · todos los estados tienen nombre y color', () => {
    // Un estado sin nombre sale como texto crudo en la pantalla del dueño, y eso
    // no le dice nada a nadie.
    for (const e of servidor.ESTADOS) {
      const c = panel.COMO_SE_LLAMA[e];
      assert.ok(c, 'el estado «' + e + '» no tiene nombre en el panel.');
      assert.ok(c.nombre && c.nombre.length > 2, 'el estado «' + e + '» tiene un nombre vacío.');
      assert.match(c.color, /^#[0-9A-F]{6}$/i, 'el estado «' + e + '» no tiene color.');
    }
  });

  it('EL QUE MUERDE · un estado que el panel no conoce SE VE, no se disimula', () => {
    // La tentación es devolver el estado crudo y seguir. Entonces un desajuste
    // entre los dos lados se vería como un texto raro en una esquina, y nadie lo
    // miraría. Tiene que cantar.
    const n = panel.nombreDelEstado('loQueSea');
    assert.match(n, /desconocido/i,
      'un estado que el panel no conoce se pintó como si tal cosa: «' + n + '»');
    assert.strictEqual(panel.nombreDelEstado(undefined), 'Sin estado');
  });

  it('EL QUE MUERDE · el interruptor se traduce IGUAL en los dos lados', () => {
    // Lo comprueba EJECUTANDO los dos, con los seis estados y con uno raro. Es el
    // agujero más caro que tuvo la rutina: el candado del servidor solo frena la
    // palabra `bloqueado`, y escribir `cancelado` en el interruptor le devolvía
    // el negocio al cliente que se acababa de cancelar.
    for (const e of servidor.ESTADOS.concat(['loQueSea', ''])) {
      assert.strictEqual(panel.interruptorQueLeToca(e), rutina.interruptorQueLeToca(e),
        'con el estado «' + e + '» el panel y el servidor no traducen igual el '
        + 'interruptor. Uno de los dos le está dando o quitando el servicio a un '
        + 'cliente por su cuenta.');
    }
  });

  it('EL QUE MUERDE · «cancelado» frena, y el panel lo sabe', () => {
    assert.strictEqual(panel.interruptorQueLeToca('cancelado'), 'bloqueado');
    assert.strictEqual(panel.COMO_SE_LLAMA.cancelado.frena, true);
    assert.strictEqual(panel.COMO_SE_LLAMA.bloqueado.frena, true);
    assert.strictEqual(panel.COMO_SE_LLAMA.alDia.frena, false);
  });

  it('la ficha vive donde el servidor la busca', () => {
    const indice = leer('guajirago/functions/index.js');
    assert.match(indice, /collection\("suscripciones"\)/);
    assert.strictEqual(panel.COLECCION_COBRO, 'suscripciones',
      'el panel busca las fichas en otra colección que el servidor.');
  });
});

describe('LA PANTALLA · las fechas y la plata, escritas para una persona', () => {
  it('EL QUE MUERDE · una fecha de cobro NO se corre un día', () => {
    // `new Date('2026-10-09')` lo lee como medianoche en Londres, y en Colombia
    // sale el día ANTERIOR. Una fecha de cobro corrida un día es una discusión
    // con un cliente que jura que pagó a tiempo.
    assert.strictEqual(panel.enCristiano('2026-10-09'), '9 de octubre de 2026');
    assert.strictEqual(panel.enCristiano('2026-01-01'), '1 de enero de 2026');
    assert.strictEqual(panel.enCristiano('2026-12-31'), '31 de diciembre de 2026');
  });

  it('una fecha rota no revienta la pantalla', () => {
    for (const mala of ['', 'mañana', '2026-13-01', undefined, null, 20261009]) {
      assert.doesNotThrow(() => panel.enCristiano(mala));
    }
    assert.strictEqual(panel.enCristiano('mañana'), '—');
  });

  it('la plata se escribe como se escribe aquí', () => {
    assert.strictEqual(panel.enPesos(80000), '$80.000');
    assert.strictEqual(panel.enPesos(0), '$0');
    // Un precio que no es número NO se pinta como «$0»: eso se leería como
    // «este cliente no paga nada», que es justo lo contrario de «no lo sé».
    assert.strictEqual(panel.enPesos(undefined), '—');
    assert.strictEqual(panel.enPesos('80.000'), '—');
  });
});

describe('LA PANTALLA · no decide, enseña (SEGUNDA LEY)', () => {
  const codigo = soloCodigo(leer(PANTALLA));

  it('EL QUE MUERDE · el estado lo calcula el servidor, no la pantalla', () => {
    assert.match(codigo, /httpsCallable\(\s*getFunctions\(\),\s*'recalcularCobro'\s*\)/,
      'la pantalla no le pide al servidor que calcule el estado.');
  });

  it('EL QUE MUERDE · la pantalla no lleva su propia calculadora de estados', () => {
    // Si aquí apareciera la lógica de vencimientos —restar fechas, comparar
    // contra los días de gracia— habría dos calculadoras del mismo proceso.
    // OJO CON LO QUE SE BUSCA. La primera versión miraba `diasDeGracia <` y se
    // ponía roja sobre código sano: eso es COMPROBAR que lo que se escribió es
    // un número, no calcular un vencimiento. Lo que delata a una segunda
    // calculadora es la ARITMÉTICA DE FECHAS.
    for (const señal of ['getTime()', 'sumarDias', 'diasEntre', 'setDate(', 'Date.parse']) {
      assert.ok(!codigo.includes(señal),
        'la pantalla está haciendo cuentas con fechas: «' + señal + '». Eso lo '
        + 'decide el servidor, o son dos calculadoras del mismo proceso.');
    }
    assert.ok(!/estado\s*=\s*['"](vencido|bloqueado|porVencer)['"]/.test(codigo),
      'la pantalla se está inventando un estado. Eso lo decide el servidor.');
  });

  it('EL QUE MUERDE · los nombres y colores salen del archivo del amarre', () => {
    // Si la pantalla los escribiera a mano, el amarre de arriba no la cubriría.
    assert.match(codigo, /from '\.\/estadosCobro'/);
    // SE CUENTAN, no se comprueba que aparezca «alguna vez». La pantalla enseña
    // el estado en DOS sitios —la fila de la lista y la cabecera de la ficha— y
    // la cacería demostró que con solo mirar si aparecía una vez se podía
    // escribir el estado crudo en el otro y las pruebas seguían en verde.
    const veces = (r) => (codigo.match(r) || []).length;
    assert.ok(veces(/nombreDelEstado\(/g) >= 2,
      'la pantalla enseña el estado en dos sitios y solo '
      + veces(/nombreDelEstado\(/g) + ' pasa por el traductor: en el otro se pinta '
      + 'el estado crudo, y ahí el amarre con el servidor no cubre nada.');
    assert.ok(veces(/colorDelEstado\(/g) >= 2);
  });

  it('EL QUE MUERDE · la pantalla no borra nada (REGLA 12)', () => {
    assert.ok(!/deleteDoc|\.delete\(/.test(codigo),
      'la pantalla de cobros borra algo. Los borrados dejan lápida.');
  });
});

describe('LA PANTALLA · nada se rechaza en silencio (REGLA 9)', () => {
  const fuente = leer(PANTALLA);
  const codigo = soloCodigo(fuente);

  // Cada sitio donde la pantalla ESCRIBE en la base. Si alguno falla sin decirlo,
  // el dueño cree que le puso precio a un cliente y no se lo puso.
  const ESCRITURAS = ['setDoc(', 'addDoc(', 'updateDoc('];
  const seguro = sinTextos(codigo);

  it('EL QUE MUERDE · cada escritura está DENTRO de un try', () => {
    let miradas = 0;
    for (const que of ESCRITURAS) {
      let desde = 0;
      for (;;) {
        const i = codigo.indexOf(que, desde);
        if (i < 0) break;
        desde = i + 1;
        // El import de firebase también nombra estas funciones: solo cuentan las
        // llamadas que van con `await`.
        const antes = codigo.slice(Math.max(0, i - 12), i);
        if (!/await\s*$/.test(antes)) continue;
        miradas += 1;

        assert.ok(dentroDeTry(seguro, i),
          'hay una escritura SIN try alrededor, en el renglón '
          + (codigo.slice(0, i).split('\n').length) + ' (' + que + '). Si falla, '
          + 'el dueño cree que se guardó y no se guardó.');
      }
    }
    assert.ok(miradas >= 4,
      'esta prueba solo encontró ' + miradas + ' escrituras. Debería haber al '
      + 'menos 4 (la ficha, el pago, la fecha del cobro y las tres llaves). '
      + 'Si bajaron, es que la prueba dejó de mirar donde tenía que mirar.');
  });

  // Las cinco funciones de la pantalla que hablan con la base. `cuerpoDelCatch`
  // quiere la posición DE LA FUNCIÓN —no la del catch— y devuelve su texto.
  const HABLAN_CON_LA_BASE = [
    'cargarPagos = useCallback',
    'recalcular = useCallback',
    'guardarFicha = async',
    'apuntarPago = async',
    'moverLlave = async',
  ];

  it('EL QUE MUERDE · TODOS los catch de la pantalla avisan a alguien', () => {
    // El otro lado de la prueba de arriba: estar dentro de un try no sirve de
    // nada si el catch se traga el fallo. Se miran las cinco, no una muestra.
    for (const nombre of HABLAN_CON_LA_BASE) {
      const i = codigo.indexOf(nombre);
      assert.ok(i > 0, 'ya no existe «' + nombre + '»: esta prueba dejó de mirar '
        + 'donde tenía que mirar.');
      const cuerpo = cuerpoDelCatch(codigo, i);
      assert.ok(cuerpo, '«' + nombre + '» habla con la base y NO tiene catch.');
      assert.match(cuerpo, /setAviso\(/,
        'el catch de «' + nombre + '» se traga el fallo sin avisarle a nadie. '
        + 'El dueño cree que se guardó y no se guardó.');

      // Y AHORA CADA CATCH DE ESA FUNCIÓN POR SEPARADO. Hicieron falta dos
      // intentos: `cuerpoDelCatch` solo encuentra el PRIMERO —en `apuntarPago` el
      // de dentro— así que el de fuera se podía enmudecer entero con la prueba en
      // verde; y contar avisos en toda la función tampoco valía, porque las
      // comprobaciones del formulario ya traen tres. Se mira de cada `catch` hasta
      // el siguiente.
      const suyo = cuerpoDeLaFuncion(codigo, i).texto;
      const sitios = [];
      let d = 0;
      for (;;) {
        const c = suyo.indexOf('catch (', d);
        if (c < 0) break;
        sitios.push(c);
        d = c + 1;
      }
      assert.ok(sitios.length > 0, '«' + nombre + '» no tiene ningún catch.');
      sitios.forEach((c, k) => {
        const hasta = k + 1 < sitios.length ? sitios[k + 1] : suyo.length;
        assert.match(suyo.slice(c, hasta), /setAviso\(/,
          'el catch nº ' + (k + 1) + ' de «' + nombre + '» se traga el fallo sin '
          + 'avisarle a nadie. El dueño cree que se guardó y no se guardó.');
      });
    }
  });

  it('EL QUE MUERDE · las tres escuchas avisan si el servidor dice que no', () => {
    // Una lista vacía porque el servidor la rechazó se ve IGUAL que una lista
    // vacía porque no hay clientes. Y la de los datos de contacto es peor: sin
    // ella, a TODOS se les vería «no tiene notificaciones activadas», que es
    // mentira, y el dueño no llamaría a nadie.
    const trozos = codigo.split('onSnapshot(').slice(1);
    assert.strictEqual(trozos.length, 3,
      'la pantalla tiene ' + trozos.length + ' escuchas, no 3.');
    for (const t of trozos) {
      const hasta = t.slice(0, t.indexOf('return () => unsub()'));
      assert.match(hasta, /setAviso\(/,
        'una escucha se queda callada si el servidor la rechaza: la pantalla '
        + 'enseña una lista vacía como si no hubiera clientes.');
    }
  });

  it('EL QUE MUERDE · las lecturas que fallan también avisan', () => {
    // Una lista vacía porque el servidor dijo que no se ve IGUAL que una lista
    // vacía porque no hay clientes. Ya hay ~55 sitios así en las tres apps.
    assert.ok((fuente.match(/setAviso\(motivoDeRechazo\(/g) || []).length >= 5,
      'faltan avisos: no todas las lecturas y escrituras cuentan lo que pasó.');
  });

  it('EL QUE MUERDE · si el recálculo falla, NO se dice que no se guardó', () => {
    // Lo que se guardó, guardado está. Decir «no se pudo» después de haber
    // escrito en la base es peor que no decir nada: el dueño lo vuelve a hacer.
    // SE MIRA SOLO DENTRO DEL CATCH, y las dos veces que no se hizo la cacería lo
    // demostró: primero el comentario de al lado decía «no borra lo que ya se
    // guardó» y tapaba al código; y después, mirando la función entera, el aviso
    // del OTRO caso —«Se guardó lo que escribiste»— hacía pasar la prueba con este
    // mensaje cambiado por «no se pudo».
    const i = codigo.indexOf('recalcular = useCallback');
    assert.ok(i > 0, 'no encuentro el recálculo');
    const elCatch = cuerpoDelCatch(codigo, i);
    assert.ok(elCatch, 'el recálculo ya no tiene catch.');
    assert.match(elCatch, /guardado|guardaron|guardó/,
      'cuando falla el recálculo, el aviso NO dice que los datos sí se guardaron. '
      + 'El dueño lo lee como «no se guardó nada» y lo vuelve a hacer.');
  });

  it('la ventanita se pinta', () => {
    assert.match(codigo, /<AvisoModal aviso=\{aviso\}/,
      'la pantalla arma avisos que no se pintan en ninguna parte.');
  });
});

describe('LA PANTALLA · una oferta a medias PARA el cobro, no lo adivina', () => {
  const codigo = soloCodigo(leer(PANTALLA));

  it('EL QUE MUERDE · no deja guardar una oferta sin precio o sin fecha', () => {
    // El servidor ya lo defiende: con una oferta incompleta no cobra nada hasta
    // que alguien la termine. Pero si la pantalla la deja guardar, ese cliente se
    // queda sin cobrar EN SILENCIO hasta que alguien lo note.
    //
    // SE MIRA LA CONDICIÓN, no el letrero. La primera versión buscaba el texto
    // «La oferta está a medias», y con el `if` invertido —guardar las malas y
    // rechazar las buenas— el letrero seguía ahí y la prueba seguía verde.
    assert.match(codigo, /!isFinite\(op\) \|\| op < 0 \|\| !\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(form\.ofertaHasta/,
      'la comprobación de la oferta cambió: repásala. Una oferta a medias que se '
      + 'guarde deja a ese cliente sin cobrar, en silencio.');
    assert.match(codigo, /La oferta está a medias/);
  });

  it('EL QUE MUERDE · los números se guardan como números', () => {
    // Un `<input>` entrega texto. Un precio guardado como «80.000» hace que la
    // calculadora se plante y ese cliente no se cobre NUNCA, en silencio.
    //
    // SE MIRA CAMPO POR CAMPO. La primera versión pedía que existieran `Number(`
    // y `Number.isInteger(` en alguna parte del archivo: se podía borrar TODA la
    // validación y quedaba verde.
    assert.match(codigo, /!isFinite\(precio\) \|\| precio < 0/,
      'ya no se comprueba el precio: un precio en texto no se cobra NUNCA.');
    for (const dia of ['diasDePrueba', 'diasDeGracia', 'diasDeAviso']) {
      const r = new RegExp('!Number\\.isInteger\\(' + dia + '\\)');
      assert.match(codigo, r, 'ya no se comprueba que «' + dia + '» sea entero.');
    }
    assert.match(codigo, /const precio = num\(form\.precio\)/,
      'el precio ya no se convierte a número antes de guardarlo.');
  });

  it('EL QUE MUERDE · el precio NACE VACÍO, no en cero', () => {
    // Un cero es un precio válido para el servidor: la ficha quedaría completa,
    // pasaría el ciclo entero y a ese cliente se le avisaría «tu pago de $0 vence
    // el…». Vacío obliga a teclearlo.
    assert.match(codigo, /precio: '',/,
      'la ficha nueva nace con un precio puesto: se puede guardar sin que nadie '
      + 'le ponga precio a ese cliente, y el sistema lo dará por bueno.');
  });
});

describe('EL SERVIDOR · recalcularCobro usa la calculadora de siempre', () => {
  const indice = leer('guajirago/functions/index.js');
  const i = indice.indexOf('exports.recalcularCobro');
  const fn = indice.slice(i, indice.length);
  const codigo = soloCodigo(fn);

  it('existe y está enganchada', () => {
    assert.ok(i > 0, 'recalcularCobro no está en index.js');
  });

  it('EL QUE MUERDE · comprueba que quien llama es administrador', () => {
    // Las funciones corren con el SDK admin y SE SALTAN las reglas de Firestore.
    // Lo que no se compruebe aquí, no se comprueba en ninguna parte: sin este
    // renglón, cualquiera con una cuenta podría recalcular —y escribir— la ficha
    // de cobro de cualquier negocio.
    // `request.auth` a secas NO vale: aparece igual en `request.auth.uid` más
    // abajo, así que la comprobación se podía borrar entera con la prueba en
    // verde. Lo que hay que buscar es el RECHAZO.
    assert.match(codigo, /unauthenticated/,
      'no rechaza a quien entra sin sesión.');
    assert.match(codigo, /"admin"/, 'no comprueba el rol.');
    assert.match(codigo, /"superadmin"/);
    assert.match(codigo, /permission-denied/,
      'no rechaza a quien no es administrador.');
  });

  it('EL QUE MUERDE · usa el MISMO queHacerCon que la rutina de madrugada', () => {
    // Es toda la razón de que esta función exista: una sola calculadora.
    assert.match(codigo, /queHacerCon\(/,
      'recalcularCobro calcula por su cuenta en vez de usar la calculadora de la rutina.');
    assert.match(codigo, /loQueSeEscribe\(/,
      'arma los campos a mano en vez de usar loQueSeEscribe: son dos versiones de '
      + 'lo que se escribe, y las pruebas de la rutina miran la otra.');
    assert.match(codigo, /hoyEnColombia\(new Date\(\)\)/,
      'la fecha no la pone el servidor en hora de Colombia.');
  });

  it('EL QUE MUERDE · ante la duda NO escribe nada', () => {
    // Si a la ficha le falta un dato, este cliente se queda EXACTAMENTE como
    // está. «revisar» es una lista para el dueño, no una acción sobre el cliente.
    const j = codigo.indexOf('"revisar"');
    assert.ok(j > 0, 'ya no distingue el caso «revisar»');
    const hasta = codigo.slice(j, codigo.indexOf('"actualizar"'));
    assert.match(hasta, /return/, 'sigue adelante con un cliente que hay que revisar.');
    assert.ok(!/lote\.set|\.set\(/.test(hasta),
      'le escribe a un cliente sobre el que dijo que no sabía decidir.');
  });

  it('EL QUE MUERDE · escribe con merge, y solo el interruptor en el negocio', () => {
    // Sin `merge`, un `set` REEMPLAZA el documento entero: el restaurante
    // perdería su nombre, su menú y sus horarios.
    const sets = codigo.match(/lote\.set\([^;]*\)/g) || [];
    assert.strictEqual(sets.length, 2, 'hace ' + sets.length + ' escrituras, no 2');
    for (const s of sets) {
      assert.match(s, /merge:\s*true/,
        'una escritura sin merge REEMPLAZA el documento entero: «' + s + '»');
    }
    assert.match(codigo, /escribir\.negocio/);
    assert.match(codigo, /escribir\.ficha/);
  });

  it('EL QUE MUERDE · no manda avisos ni sella que se avisó', () => {
    // Cambiar un precio no es motivo para despertar a nadie. Y si sellara sin
    // mandar nada, la rutina de esa noche creería que ya se le avisó y el
    // cliente no se enteraría nunca.
    assert.ok(!/sendEachForMulticast|avisarAlNegocio/.test(codigo),
      'recalcularCobro está mandando avisos.');
    assert.match(codigo, /loQueSeEscribe\(decision, hoy, false\)/,
      'está sellando «ya se le avisó» sin haber mandado nada.');
  });

  it('no borra nada (REGLA 12)', () => {
    assert.ok(!/\.delete\(|FieldValue\.delete/.test(codigo));
  });
});

describe('AMARRE · los NOMBRES DE CAMPO que el panel escribe y el servidor lee', () => {
  // Es la mitad más traicionera del amarre. Si el servidor renombrara
  // `diasDeAviso`, el panel seguiría escribiendo el nombre viejo, el servidor lo
  // vería ausente y TODOS los clientes caerían a la lista de «revisar»: nadie se
  // cobra, nadie se bloquea, y nada se pone rojo. Por eso esto no compara textos:
  // arma una ficha con los nombres del panel y SE LA DA a la calculadora del
  // servidor a ver si la reconoce.
  const C = panel.CAMPOS_DE_LA_FICHA;
  const fichaDelPanel = (extra) => {
    const f = {};
    f[C.precio] = 80000;
    f[C.diasDePrueba] = 0;
    f[C.diasDeGracia] = 8;
    f[C.diasDeAviso] = 5;
    f[C.inicio] = '2026-01-01';
    f[C.proximoCobro] = '2026-12-01';
    f[C.estado] = 'alDia';
    return Object.assign(f, extra);
  };

  it('EL QUE MUERDE · el servidor da por COMPLETA una ficha escrita por el panel', () => {
    assert.strictEqual(rutina.faltaAlgoParaCastigar(fichaDelPanel(), '2026-09-06'), null,
      'el servidor NO reconoce los campos que escribe el panel. A todos los '
      + 'clientes se les dejaría de cobrar, en silencio, y nadie se enteraría.');
  });

  it('EL QUE MUERDE · y saca de ella el estado que toca', () => {
    const r = servidor.estadoQueLeToca(fichaDelPanel(), '2026-09-06');
    assert.strictEqual(r.estado, 'alDia',
      'con una ficha del panel el servidor no sabe decidir: «' + r.porQue + '»');
    const v = servidor.estadoQueLeToca(fichaDelPanel({ proximoCobro: '2026-07-01' }), '2026-09-06');
    assert.strictEqual(v.estado, 'bloqueado');
  });

  it('EL QUE MUERDE · la OFERTA que escribe el panel es la que el servidor cobra', () => {
    // Si los nombres de dentro de la oferta se separaran, el servidor no vería
    // precio ni fecha: la daría por incompleta y ese cliente dejaría de cobrarse.
    const oferta = {};
    oferta[C.ofertaPrecio] = 40000;
    oferta[C.ofertaHasta] = '2026-12-01';
    const f = fichaDelPanel();
    f[C.oferta] = oferta;
    const p = servidor.precioAPagar(f, '2026-09-06');
    assert.strictEqual(p.precio, 40000,
      'el servidor no reconoce la oferta que escribe el panel: cobraría '
      + p.precio + ' (' + p.porQue + ')');
  });

  it('EL QUE MUERDE · la pantalla escribe EXACTAMENTE esos nombres', () => {
    const codigo = soloCodigo(leer(PANTALLA));
    for (const campo of ['precio', 'diasDePrueba', 'diasDeGracia', 'diasDeAviso', 'proximoCobro']) {
      assert.strictEqual(C[campo], campo, 'la lista de campos y el nombre no cuadran');
      // `campo,` o `campo:` — en el objeto que se guarda unos van abreviados y
      // otros con su valor. Pedir solo la coma se ponía roja sobre código sano.
      assert.match(codigo, new RegExp(campo + '\s*[,:]'),
        'la pantalla ya no escribe «' + campo + '».');
    }
  });
});

describe('LA PANTALLA · las llaves dicen la verdad', () => {
  const codigo = soloCodigo(leer(PANTALLA));

  it('EL QUE MUERDE · apagar a mano NO se deshace esa misma madrugada', () => {
    // EL PEOR FALLO QUE TUVO ESTA PANTALLA. Apagar el interruptor escribía solo en
    // el negocio; la rutina de esa noche leía la FICHA —que seguía diciendo «al
    // día»— y LO VOLVÍA A ENCENDER. Comprobado ejecutándolo: usted corta a un
    // moroso y a la mañana siguiente vuelve a vender.
    //
    // «cancelado» es el único estado que la calculadora respeta como decisión del
    // dueño en vez de recalcularlo por fechas. Esto lo comprueba EJECUTÁNDOLA.
    const conCancelado = rutina.queHacerCon(
      { precio: 80000, diasDePrueba: 0, diasDeGracia: 8, diasDeAviso: 5,
        inicio: '2026-01-01', proximoCobro: '2026-12-01', estado: 'cancelado' },
      { estadoComercial: 'bloqueado' }, '2026-09-06');
    assert.strictEqual(conCancelado.hacer, 'nada',
      'ni siquiera con la ficha en «cancelado» se queda apagado.');

    const i = codigo.indexOf('cambiarServicio = async');
    assert.ok(i > 0, 'ya no existe la función que corta el servicio a mano.');
    const cuerpo = cuerpoDeLaFuncion(codigo, i).texto;
    assert.match(cuerpo, /'cancelado'/,
      'apagar a mano no marca la ficha: la rutina lo volverá a encender esta noche.');
    assert.match(cuerpo, /COLECCION_COBRO/,
      'apagar a mano solo toca el negocio y no la ficha: se deshace solo.');
    assert.match(cuerpo, /'restaurantes'/,
      'apagar a mano no mueve el interruptor que lee el candado del servidor.');
  });

  it('EL QUE MUERDE · al encender, decide el servidor y no la pantalla', () => {
    // Si un cliente lleva tres meses sin pagar, encenderlo a mano no puede
    // dejarlo trabajando: el servidor recalcula y lo vuelve a frenar en el acto.
    const i = codigo.indexOf('cambiarServicio = async');
    const cuerpo = cuerpoDeLaFuncion(codigo, i).texto;
    assert.match(cuerpo, /recalcular\(seleccionadoId\)/,
      'al devolverle el servicio no se recalcula: un moroso se quedaría trabajando.');
  });

  it('EL QUE MUERDE · la palabra del candado sale del amarre, no escrita a mano', () => {
    const i = codigo.indexOf('cambiarServicio = async');
    const cuerpo = cuerpoDeLaFuncion(codigo, i).texto;
    assert.match(cuerpo, /interruptorQueLeToca\(/,
      'la pantalla escribe la palabra del candado a mano. Ahí el amarre con el '
      + 'servidor no cubre nada, y es justo la palabra más cara del sistema.');
  });

  it('EL QUE MUERDE · el cliente elegido NO sale de la lista filtrada', () => {
    // Si saliera de la lista ya filtrada por el buscador, escribir cualquier cosa
    // en la búsqueda dejaría fuera al cliente abierto: la pantalla se caería al
    // documento crudo, sin su cuarto de atrás, y enseñaría en amarillo «a este
    // cliente no se le puede avisar» siendo mentira. El dueño lo llamaría por
    // teléfono para nada, o peor: dejaría de fiarse del cartel.
    assert.match(codigo, /const negocio = todos\.find\(/,
      'el cliente elegido sale de la lista filtrada: al buscar se pierden sus '
      + 'datos de contacto y sale un cartel falso.');
  });

  it('EL QUE MUERDE · «frenado» mira las DOS cosas que frenan', () => {
    // El candado del servidor exige `activo != false` Y `estadoComercial !=
    // 'bloqueado'`. Mirando solo una, un negocio con la cuenta apagada —al que el
    // servidor le rechaza todo— salía en pantalla con «Puede trabajar» en verde.
    assert.match(codigo, /const frenado = negocio\.estadoComercial === 'bloqueado' \|\| negocio\.activo === false/,
      'la pantalla enseña como que puede trabajar a un negocio que el servidor '
      + 'tiene frenado.');
  });

  it('EL QUE MUERDE · el botón que todavía no hace nada LO DICE', () => {
    // `visibleEnEscaparate` no lo lee ninguna app. Un botón que promete esconder
    // un negocio y no lo esconde es exactamente lo que combate la REGLA 9.
    const t = leer(PANTALLA);
    // EN EL TÍTULO, que es lo que se lee de un vistazo. Con el aviso solo en la
    // letra pequeña se podía quitar del título y la prueba seguía verde.
    assert.match(t, /'Sale en la app del cliente · todavía sin conectar'/,
      'el botón del escaparate promete esconder al negocio ya, y hoy no lo '
      + 'esconde: ninguna app mira ese campo.');
    assert.match(t, /todavía no lo mira/);
  });

  it('EL QUE MUERDE · la tercera llave avisa de que TAMBIÉN frena', () => {
    // `activo: false` mata al negocio entero en el servidor. Quien la apague
    // creyendo que solo «archiva» un cliente le está cortando el servicio.
    const t = leer(PANTALLA);
    const i = t.indexOf("'La cuenta está viva'");
    assert.ok(i > 0);
    assert.match(t.slice(i, i + 400), /frena|rechaza/,
      'la llave «La cuenta está viva» no dice que apagarla le corta el servicio.');
  });
});

describe('LA PANTALLA · un pago no se apunta dos veces', () => {
  const codigo = soloCodigo(leer(PANTALLA));

  it('EL QUE MUERDE · el formulario se cierra ANTES de mover la fecha', () => {
    // Un pago apuntado NO se puede borrar ni corregir: lo impide el servidor. Si
    // el formulario siguiera abierto cuando falla el segundo paso, la
    // administradora pulsaría otra vez y crearía un SEGUNDO pago para siempre.
    const i = codigo.indexOf('apuntarPago = async');
    const cuerpo = cuerpoDeLaFuncion(codigo, i).texto;
    const cierra = cuerpo.indexOf('setNuevoPago(null)');
    const mueve = cuerpo.indexOf('proximoCobro: fechaNueva');
    assert.ok(cierra > 0 && mueve > 0, 'no encuentro los dos pasos del pago.');
    assert.ok(cierra < mueve,
      'el formulario se cierra DESPUÉS de mover la fecha: si eso falla, se queda '
      + 'lleno y el siguiente clic apunta el pago por segunda vez.');
  });

  it('EL QUE MUERDE · si solo falla la fecha, el aviso NO dice que se perdió el pago', () => {
    // El aviso corriente dice «el cambio no se hizo, inténtalo otra vez» — y eso
    // es mentira: el pago sí quedó. Volver a intentarlo lo duplica.
    const i = codigo.indexOf('apuntarPago = async');
    const cuerpo = cuerpoDeLaFuncion(codigo, i).texto;
    assert.match(cuerpo, /El pago SÍ quedó apuntado/,
      'cuando falla solo la fecha, se le dice al dueño que no se guardó nada.');
    assert.match(cuerpo, /No vuelvas a apuntar el pago/);
  });
});
