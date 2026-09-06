/**
 * LA RUTINA DE COBROS · la decisión, probada aparte
 *
 * `guajirago/functions/cobros.cjs` decide, cada madrugada, qué hacerle a cada
 * cliente: avisarle, cambiarle el estado, o apagarle el negocio.
 *
 * ES LA ÚNICA PARTE DEL SISTEMA QUE PUEDE APAGAR A UN CLIENTE SIN QUE NADIE PULSE
 * UN BOTÓN. Por eso la mitad de estas pruebas son de cuándo NO hace nada.
 *
 * Y por eso la decisión vive en una función pura, separada de la parte que
 * escribe: hace dos días, en este mismo proyecto, un guion que escribía en la base
 * tenía SIETE mutantes vivos en su plomería —uno borraba el documento entero de un
 * negocio— porque las pruebas solo miraban la decisión.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { queHacerCon, loQueSeEscribe, interruptorQueLeToca, hoyEnColombia }
  = require('../guajirago/functions/cobros.cjs');

const ficha = (extra) => ({
  precio: 80000, diasDePrueba: 0, diasDeGracia: 8, diasDeAviso: 5,
  inicio: '2026-01-01', proximoCobro: '2026-10-01', estado: 'alDia', ...extra,
});
const negocio = (extra) => ({ nombre: 'EL FOGON', estadoComercial: 'alDia', ...extra });

describe('LA RUTINA · cuándo NO toca a nadie', () => {
  it('EL QUE MUERDE · sin fecha de cobro, NO se decide nada sobre ese cliente', () => {
    // Es el error más caro que puede cometer este sistema: apagarle el negocio a
    // alguien que está al día porque a su ficha le faltaba un dato.
    const r = queHacerCon(ficha({ proximoCobro: undefined }), negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'revisar',
      'sin fecha de cobro decidió actuar. Si decide bloquear, le apaga el negocio '
      + 'a un cliente que puede estar perfectamente al día.');
    assert.notStrictEqual(r.hacer, 'actualizar');
    assert.ok(r.porQue, 'tiene que decir por qué, o esa lista no sirve para nada');
  });

  it('EL QUE MUERDE · «revisar» NO cambia el estado ni el interruptor', () => {
    // Que la palabra no engañe: «revisar» es una lista para el dueño, no una
    // acción sobre el cliente.
    const r = queHacerCon(ficha({ proximoCobro: 'mañana' }), negocio(), '2026-09-06');
    assert.strictEqual(r.estado, undefined,
      'una decisión de «revisar» trae un estado: alguien la va a escribir.');
    assert.ok(!r.cambiaInterruptor);
  });

  it('EL QUE MUERDE · si nada cambió, no se escribe nada', () => {
    // Escribir el mismo estado cada madrugada ensucia el historial y despierta a
    // las apps sin motivo.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-10-01', estado: 'alDia' }),
      negocio({ estadoComercial: 'alDia' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'nada');
  });

  it('a un cancelado apagado no lo persigue la rutina', () => {
    // OJO con el interruptor: tiene que decir `bloqueado`, NO `cancelado`.
    // Escribir `cancelado` ahí le devolvía el negocio — el candado del servidor
    // solo frena esa palabra. Ver la prueba de más abajo.
    const r = queHacerCon(
      ficha({ estado: 'cancelado', proximoCobro: '2020-01-01' }),
      negocio({ estadoComercial: 'bloqueado' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'nada');
  });

  it('sin fecha válida de hoy, no se hace nada', () => {
    assert.strictEqual(queHacerCon(ficha(), negocio(), 'ayer').hacer, 'nada');
    assert.strictEqual(queHacerCon(ficha(), negocio(), undefined).hacer, 'nada');
  });
});

describe('LA RUTINA · cuándo sí actúa', () => {
  it('avisa cuando le queda poco', () => {
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-09-09', diasDeAviso: 5, estado: 'alDia' }),
      negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'actualizar');
    assert.strictEqual(r.estado, 'porVencer');
    assert.strictEqual(r.avisar, true);
    assert.match(r.mensaje.titulo, /3 días/);
  });

  it('EL QUE MUERDE · el aviso le dice CUÁNTO y CUÁNDO, no un código', () => {
    // Lo lee un dueño de restaurante en su teléfono, no un técnico.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-09-09', precio: 80000 }), negocio(), '2026-09-06');
    assert.match(r.mensaje.texto, /80\.000/, 'el aviso no dice cuánto debe');
    assert.match(r.mensaje.texto, /2026-09-09/, 'el aviso no dice cuándo vence');
    assert.ok(!/porVencer|estado|null|undefined/.test(r.mensaje.titulo + r.mensaje.texto),
      'al cliente le está llegando jerga del sistema: «' + r.mensaje.titulo + '»');
  });

  it('EL QUE MUERDE · con la oferta vigente, el aviso dice el precio DE LA OFERTA', () => {
    // Si le avisara con el precio normal, el cliente creería que le subieron el
    // plan y llamaría enfadado — teniendo razón.
    const r = queHacerCon(ficha({
      proximoCobro: '2026-09-09', precio: 80000,
      oferta: { descripcion: 'mitad', precio: 40000, hasta: '2026-12-01' },
    }), negocio(), '2026-09-06');
    assert.match(r.mensaje.texto, /40\.000/,
      'le avisó con el precio normal teniendo una oferta vigente.');
  });

  it('bloquea cuando se le pasó la gracia, y mueve el interruptor', () => {
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-08-01', diasDeGracia: 8, estado: 'vencido' }),
      negocio({ estadoComercial: 'vencido' }), '2026-09-06');
    assert.strictEqual(r.estado, 'bloqueado');
    assert.strictEqual(r.cambiaInterruptor, true,
      'cambió el estado en la ficha pero NO el interruptor del negocio. El candado '
      + 'del servidor lee el interruptor: el cliente seguiría trabajando.');
  });



  it('EL QUE MUERDE · la ficha atrasada se pone al día aunque el interruptor ya esté bien', () => {
    // El caso de todos los meses: el cliente PAGA, la administradora le mueve la
    // fecha de cobro y de paso le deja el interruptor en «alDia» a mano desde el
    // panel. Esa noche el interruptor ya está bien y no hay aviso que mandar.
    //
    // Si la rutina solo mirara el interruptor, diría «sigue igual» y LA FICHA SE
    // QUEDARÍA DICIENDO «por vencer» PARA SIEMPRE: el cliente entra a su pantalla
    // y ve que su plan está por vencer meses después de haber pagado.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-12-01', estado: 'porVencer' }),
      negocio({ estadoComercial: 'alDia' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'actualizar',
      'el cliente pagó y su ficha se quedó diciendo «porVencer»: cada vez que abra '
      + 'la app va a ver que su plan está por vencer.');
    assert.strictEqual(r.estado, 'alDia');
    assert.strictEqual(r.cambiaEstado, true);
    assert.strictEqual(r.cambiaInterruptor, false, 'el interruptor ya estaba bien');
    assert.strictEqual(r.avisar, false);
  });
  it('EL QUE MUERDE · un cliente AL DÍA con el interruptor trabado en bloqueado se DESBLOQUEA', () => {
    // EL PEOR CASO DE TODOS, y el que mi primera prueba no aislaba: un cliente que
    // pagó, cuya ficha dice «al día», pero cuyo interruptor quedó en «bloqueado»
    // porque una madrugada la rutina se cayó a medio camino.
    //
    // Aquí no hay aviso que mandar —estar al día no se avisa— así que si la rutina
    // no mirase el interruptor, diría «sigue igual» y ESE CLIENTE SE QUEDA
    // BLOQUEADO PARA SIEMPRE aunque esté pagando. Lo destapó la cacería: mi otra
    // prueba pasaba igual porque el aviso tapaba el fallo.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-12-01', estado: 'alDia' }),
      negocio({ estadoComercial: 'bloqueado' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'actualizar',
      'un cliente al día se quedó con el interruptor trabado en «bloqueado» y la '
      + 'rutina dijo que todo seguía igual. Ese cliente paga y no puede trabajar.');
    assert.strictEqual(r.estado, 'alDia');
    assert.strictEqual(r.cambiaInterruptor, true);
    assert.strictEqual(r.avisar, false, 'y no hay que molestarle con un aviso por esto');
  });

  it('EL QUE MUERDE · si la ficha y el interruptor están descuadrados, los cuadra', () => {
    // El caso peligroso: la ficha dice «bloqueado» pero el negocio quedó en
    // «alDia» por un fallo a mitad de camino. Si la rutina dijera «sigue igual»,
    // ese cliente trabajaría gratis para siempre.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-08-01', diasDeGracia: 8, estado: 'bloqueado' }),
      negocio({ estadoComercial: 'alDia' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'actualizar',
      'la ficha decía bloqueado y el negocio alDia, y la rutina no hizo nada: ese '
      + 'cliente trabaja gratis para siempre.');
    assert.strictEqual(r.cambiaInterruptor, true);
  });
});

describe('LA RUTINA · un aviso al día, como mucho', () => {
  it('EL QUE MUERDE · no repite el mismo aviso el mismo día', () => {
    // Avisar de más es casi tan malo como no avisar: el cliente deja de mirarlos.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-09-09', estado: 'porVencer', avisadoEl: '2026-09-06', avisadoDe: 'porVencer' }),
      negocio({ estadoComercial: 'porVencer' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'nada',
      'le mandó el mismo aviso dos veces el mismo día.');
  });

  it('al día siguiente sí vuelve a avisar', () => {
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-09-09', estado: 'porVencer', avisadoEl: '2026-09-05', avisadoDe: 'porVencer' }),
      negocio({ estadoComercial: 'porVencer' }), '2026-09-06');
    assert.strictEqual(r.avisar, true);
  });

  it('EL QUE MUERDE · si CAMBIA de estado, avisa aunque ya se le avisara hoy', () => {
    // Pasar de «vencido» a «bloqueado» es noticia nueva: que se entere de que le
    // apagaron el negocio no puede esperar a mañana.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-08-01', diasDeGracia: 8, estado: 'vencido', avisadoEl: '2026-09-06', avisadoDe: 'vencido' }),
      negocio({ estadoComercial: 'vencido' }), '2026-09-06');
    assert.strictEqual(r.estado, 'bloqueado');
    assert.strictEqual(r.avisar, true,
      'le apagó el negocio y no se lo dijo porque ya le había avisado de otra cosa '
      + 'esa misma mañana.');
  });

  it('EL QUE MUERDE · estar al día NO genera avisos', () => {
    // Nadie quiere un mensaje diario diciéndole que todo está bien.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-12-01', estado: 'porVencer' }),
      negocio({ estadoComercial: 'porVencer' }), '2026-09-06');
    assert.strictEqual(r.estado, 'alDia');
    assert.strictEqual(r.avisar, false);
  });

  it('EL QUE MUERDE · en prueba tampoco se le persigue con cobros', () => {
    const r = queHacerCon(
      ficha({ inicio: '2026-09-01', diasDePrueba: 15, estado: 'prueba' }),
      negocio({ estadoComercial: 'prueba' }), '2026-09-06');
    assert.strictEqual(r.avisar, false);
  });
});

describe('LA RUTINA · la fecha la pone el servidor, y en hora de Colombia', () => {
  it('EL QUE MUERDE · la fecha es la de Colombia, no la de Google', () => {
    // El servidor de Google va en UTC. Con la hora de allá, un cliente que vence
    // el día 1 se bloquearía a las 7 de la tarde del día 31.
    assert.strictEqual(hoyEnColombia(new Date('2026-09-07T02:00:00Z')), '2026-09-06',
      'a las 2 de la mañana en Londres son las 9 de la noche del día ANTERIOR aquí. '
      + 'Con la hora de allá se bloquea a la gente un día antes.');
    assert.strictEqual(hoyEnColombia(new Date('2026-09-06T04:59:00Z')), '2026-09-05');
    assert.strictEqual(hoyEnColombia(new Date('2026-09-06T05:01:00Z')), '2026-09-06');
  });

  it('la rutina corre a las 3 de la mañana, que en Colombia sigue siendo el mismo día', () => {
    // Es la hora a la que se programa. Con UTC−5, las 3:00 de Bogotá son las 8:00
    // UTC del mismo día: no hay salto.
    assert.strictEqual(hoyEnColombia(new Date('2026-09-06T08:00:00Z')), '2026-09-06');
  });
});

describe('SE VENDE · el interruptor solo entiende UNA palabra para decir que no', () => {
  it('EL QUE MUERDE · cancelar a un cliente NO le devuelve el negocio esa noche', () => {
    // EL AGUJERO MÁS CARO QUE TUVO ESTA RUTINA, y lo tuvo hasta que un revisor lo
    // encontró: el candado del servidor (`negocioPuedeOperar`) solo frena la
    // palabra exacta `bloqueado`. Si en el interruptor se escribiera `cancelado`,
    // el candado lo dejaría pasar.
    //
    // Y es el camino NORMAL: no paga -> se bloquea -> el dueño se cansa y lo
    // cancela -> esa madrugada el interruptor pasaba de «bloqueado» a «cancelado»
    // y el ex-cliente volvía a trabajar GRATIS, sin que nadie se enterara.
    assert.strictEqual(interruptorQueLeToca('cancelado'), 'bloqueado',
      'se iba a escribir «cancelado» en el interruptor, y el candado del servidor '
      + 'solo frena «bloqueado»: ese cliente vuelve a trabajar gratis.');
    assert.strictEqual(interruptorQueLeToca('bloqueado'), 'bloqueado');

    const r = queHacerCon(
      ficha({ estado: 'cancelado', proximoCobro: '2026-01-01' }),
      negocio({ estadoComercial: 'bloqueado' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'nada',
      'un cancelado que ya está apagado no se toca cada noche');
  });

  it('EL QUE MUERDE · a un cancelado que quedó ENCENDIDO se le apaga', () => {
    const r = queHacerCon(
      ficha({ estado: 'cancelado', proximoCobro: '2026-01-01' }),
      negocio({ estadoComercial: 'alDia' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'actualizar');
    assert.strictEqual(r.interruptor, 'bloqueado');
  });

  it('los estados que SÍ trabajan pasan tal cual', () => {
    // La otra mitad: si esto tradujera de más, apagaría a gente que está al día.
    for (const bueno of ['prueba', 'alDia', 'porVencer', 'vencido']) {
      assert.strictEqual(interruptorQueLeToca(bueno), bueno,
        'se apagó a un cliente en estado «' + bueno + '», que sí puede trabajar.');
    }
  });
});

describe('SE VENDE · sin los datos completos NO se castiga a nadie', () => {
  it('EL QUE MUERDE · sin PRECIO no se bloquea: se apunta', () => {
    // Le llegaba el aviso sin decirle cuánto debía —el importe se caía en
    // silencio— y a los pocos días se le apagaba el negocio. Se le suspendía sin
    // haberle dicho nunca qué tenía que pagar.
    const r = queHacerCon(
      ficha({ precio: undefined, proximoCobro: '2026-07-01' }),
      negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'revisar',
      'le apagó el negocio a un cliente sin saber cuánto tenía que cobrarle.');
    assert.match(r.porQue, /precio/);
  });

  it('EL QUE MUERDE · sin DÍAS DE GRACIA no se bloquea: se apunta', () => {
    // El campo ausente valía cero y el cliente quedaba suspendido al día
    // siguiente de vencer, sin un solo día de margen. Campo que falta = castigo
    // máximo era justo lo contrario de «ante la duda, no se toca».
    const r = queHacerCon(
      ficha({ diasDeGracia: undefined, proximoCobro: '2026-09-05' }),
      negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'revisar',
      'sin días de gracia apuntados, lo suspendió al día siguiente de vencer.');
  });

  it('EL QUE MUERDE · sin DÍAS DE AVISO tampoco: nunca le avisaría', () => {
    // Sin ese dato nunca pasa por «por vencer»: se entera de que debe el día que
    // ya no puede trabajar.
    const r = queHacerCon(
      ficha({ diasDeAviso: undefined, proximoCobro: '2026-07-01' }),
      negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'revisar');
  });

  it('EL QUE MUERDE · con una OFERTA a medio escribir tampoco se castiga', () => {
    // La calculadora ya dice que con una oferta incompleta no se cobra nada hasta
    // que alguien la termine. La rutina lo bloqueaba igual.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-07-01', oferta: { descripcion: 'mitad de precio' } }),
      negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'revisar',
      'una oferta a medio escribir en el panel le apagó el negocio al cliente.');
  });

  it('estar AL DÍA sin precio apuntado no llena la lista del dueño', () => {
    // La exigencia es solo para castigar. Si se pidiera siempre, la lista de
    // «revisar» tendría cada noche a todo el que aún no tiene precio puesto, y
    // una lista que siempre está llena no la mira nadie.
    const r = queHacerCon(
      ficha({ precio: undefined, proximoCobro: '2026-12-01' }),
      negocio({ estadoComercial: 'alDia' }), '2026-09-06');
    assert.notStrictEqual(r.hacer, 'revisar');
  });

  it('con los tres datos puestos, sí se bloquea', () => {
    // La otra mitad: si esto pidiera de más, no se bloquearía nunca a nadie y el
    // sistema de cobros no serviría para nada.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-07-01' }), negocio(), '2026-09-06');
    assert.strictEqual(r.hacer, 'actualizar');
    assert.strictEqual(r.estado, 'bloqueado');
  });
});

describe('SE VENDE · al bloqueado no se le persigue todas las noches', () => {
  it('EL QUE MUERDE · a un bloqueado ya avisado no se le vuelve a avisar', () => {
    // «bloqueado» no tiene fecha de final. Recordárselo a diario como a los otros
    // dos estados son CIENTOS de mensajes de «servicio suspendido» a un
    // ex-cliente —y dos escrituras cada noche, para siempre—. Eso es acoso, y
    // rompe la regla de «si nada cambió, no se escribe nada».
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-01-01', estado: 'bloqueado',
        avisadoEl: '2026-03-15', avisadoDe: 'bloqueado' }),
      negocio({ estadoComercial: 'bloqueado' }), '2026-09-06');
    assert.strictEqual(r.hacer, 'nada',
      'a un cliente bloqueado en enero le habría mandado ~250 avisos de '
      + '«servicio suspendido» y hecho 500 escrituras.');
  });

  it('EL QUE MUERDE · si el aviso de bloqueo NO salió, se reintenta mañana', () => {
    // El sello solo se pone cuando el mensaje sale de verdad. Como al bloqueado
    // se le avisa una sola vez, sin este reintento un aviso perdido se perdería
    // PARA SIEMPRE: se le apaga el negocio y nunca se entera de por qué.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-01-01', estado: 'bloqueado' }),
      negocio({ estadoComercial: 'bloqueado' }), '2026-09-06');
    assert.strictEqual(r.avisar, true,
      'no se le avisó del bloqueo y tampoco se reintentó: ese cliente se quedó '
      + 'apagado sin saber por qué.');
  });

  it('a los otros dos estados sí se les recuerda a diario', () => {
    // «por vencer» y «vencido» son ventanas de pocos días: ahí el recordatorio
    // diario es justo lo que hace falta.
    const r = queHacerCon(
      ficha({ proximoCobro: '2026-09-09', estado: 'porVencer',
        avisadoEl: '2026-09-05', avisadoDe: 'porVencer' }),
      negocio({ estadoComercial: 'porVencer' }), '2026-09-06');
    assert.strictEqual(r.avisar, true);
  });
});

describe('SE VENDE · lo que se escribe de verdad en los dos documentos', () => {
  // Esto existe por la lección de hace dos días: aquel guion tenía SIETE mutantes
  // vivos en la parte que escribía, uno de ellos capaz de reemplazar el documento
  // entero de un negocio, porque las pruebas solo miraban la decisión.
  const decisionDe = (f, n, hoy) => queHacerCon(ficha(f), negocio(n), hoy || '2026-09-06');

  it('EL QUE MUERDE · al negocio SOLO se le toca el interruptor', () => {
    // Si aquí saliera un campo de más, la rutina de cobros estaría pisando el
    // nombre, el menú o los horarios de un restaurante cada madrugada.
    const d = decisionDe({ proximoCobro: '2026-07-01' }, { estadoComercial: 'alDia' });
    const e = loQueSeEscribe(d, '2026-09-06', true);
    assert.deepStrictEqual(Object.keys(e.negocio), ['estadoComercial'],
      'la rutina de cobros iba a escribir esto en el negocio: '
      + JSON.stringify(e.negocio));
    assert.strictEqual(e.negocio.estadoComercial, 'bloqueado');
  });

  it('EL QUE MUERDE · en el interruptor va la palabra que el candado entiende', () => {
    const d = decisionDe({ estado: 'cancelado', proximoCobro: '2026-01-01' },
      { estadoComercial: 'alDia' });
    assert.strictEqual(loQueSeEscribe(d, '2026-09-06', false).negocio.estadoComercial,
      'bloqueado', 'se iba a escribir «cancelado», que el candado deja pasar.');
  });

  it('EL QUE MUERDE · el sello «ya se le avisó» solo se pone si el aviso SALIÓ', () => {
    // Si se pusiera antes de mandarlo, la ficha juraría haber avisado a alguien
    // que nunca recibió nada — y en una discusión el registro le daría la razón
    // al cliente y no al dueño.
    const d = decisionDe({ proximoCobro: '2026-09-09' }, {});
    const noSalio = loQueSeEscribe(d, '2026-09-06', false);
    assert.strictEqual(noSalio.ficha.avisadoEl, undefined,
      'la ficha dice que se le avisó y el mensaje no salió.');
    assert.strictEqual(noSalio.ficha.avisadoDe, undefined);

    const siSalio = loQueSeEscribe(d, '2026-09-06', true);
    assert.strictEqual(siSalio.ficha.avisadoEl, '2026-09-06');
    assert.strictEqual(siSalio.ficha.avisadoDe, d.estado);
  });

  it('la ficha guarda el estado y el porqué, para poder explicar un bloqueo', () => {
    const d = decisionDe({ proximoCobro: '2026-07-01' }, {});
    const e = loQueSeEscribe(d, '2026-09-06', true);
    assert.strictEqual(e.ficha.estado, 'bloqueado');
    assert.strictEqual(e.ficha.revisadoEl, '2026-09-06');
    assert.ok(e.ficha.porQue, 'sin el porqué no se puede explicar un bloqueo sin '
      + 'abrir el código.');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// LA PLOMERÍA · lo que hace la rutina de verdad, en `index.js`
//
// Estas pruebas LEEN el código de la función programada. No es lo mismo que
// ejecutarlo —eso pide un emulador— pero cubre justo lo que hace dos días quedó
// sin cubrir: la parte que ESCRIBE. Aquel guion tenía siete mutantes vivos ahí,
// uno capaz de reemplazar el documento entero de un negocio, porque nadie miró
// esos renglones.
// ══════════════════════════════════════════════════════════════════════════
describe('SE VENDE · la plomería de la rutina de madrugada', () => {
  const { leer, cuerpoDeLaFuncion, soloCodigo } = require('./cargar.cjs');
  const todo = leer('guajirago/functions/index.js');
  const rutina = (() => {
    const i = todo.indexOf('exports.rutinaDeCobros');
    assert.ok(i > 0, 'la rutina de cobros no está enganchada en index.js');
    const j = todo.indexOf('\nasync function avisarAlNegocio', i);
    assert.ok(j > i, 'no encuentro dónde acaba la rutina');
    return todo.slice(i, j);
  })();

  it('EL QUE MUERDE · las dos escrituras van con `merge: true`', () => {
    // SIN ESTO, un `set` REEMPLAZA EL DOCUMENTO ENTERO: el restaurante perdería su
    // nombre, su menú y sus horarios en la madrugada en que se le cambia el
    // estado de cobro. Es el mutante que sobrevivió hace dos días.
    const sets = soloCodigo(rutina).match(/lote\.set\([^;]*\)/g) || [];
    assert.strictEqual(sets.length, 2, 'la rutina hace ' + sets.length + ' escrituras, no 2');
    for (const s of sets) {
      assert.match(s, /merge:\s*true/,
        'una escritura sin `merge: true` REEMPLAZA el documento entero: «' + s + '»');
    }
  });

  it('EL QUE MUERDE · la ficha y el interruptor se escriben en el MISMO lote', () => {
    // Si fueran dos escrituras sueltas y fallara la segunda, un cliente bloqueado
    // seguiría trabajando —o uno al día se quedaría apagado— y nadie lo vería.
    assert.match(rutina, /const lote = db\.batch\(\)/);
    assert.match(rutina, /await lote\.commit\(\)/);
    const entre = rutina.slice(rutina.indexOf('db.batch()'), rutina.indexOf('lote.commit()'));
    assert.strictEqual((entre.match(/lote\.set\(/g) || []).length, 2,
      'las dos escrituras no están las dos dentro del mismo lote.');
  });

  it('EL QUE MUERDE · lo que se escribe sale de `loQueSeEscribe`, no se arma aquí', () => {
    // SEGUNDA LEY: una sola fuente. Si la rutina armara los campos por su cuenta,
    // habría dos versiones de lo que se escribe y las pruebas de arriba estarían
    // mirando la que no se usa.
    assert.match(rutina, /loQueSeEscribe\(decision, hoy, avisoQueSalio\)/);
    assert.match(rutina, /lote\.set\(docu\.ref, escribir\.ficha/);
    assert.match(rutina, /lote\.set\(negSnap\.ref, escribir\.negocio/);
  });

  it('EL QUE MUERDE · a un «revisar» no se le toca nada', () => {
    // «revisar» es una lista para el dueño, no una acción sobre el cliente. Si
    // este `continue` no estuviera, se le escribiría un estado vacío a alguien
    // sobre quien la rutina dijo que no sabía decidir.
    const i = rutina.indexOf('decision.hacer === "revisar"');
    assert.ok(i > 0, 'la rutina ya no distingue el caso «revisar»');
    const hasta = rutina.slice(i, rutina.indexOf('decision.hacer !== "actualizar"'));
    assert.match(hasta, /continue;/,
      'la rutina sigue adelante con un cliente que dijo que había que revisar.');
    assert.ok(!/lote\.set/.test(hasta), 'le escribe a un cliente marcado para revisar.');
  });

  it('EL QUE MUERDE · el aviso se manda ANTES de sellar que se avisó', () => {
    // Si se sellara primero, la ficha juraría haber avisado a alguien que nunca
    // recibió nada, y en una discusión el registro le daría la razón al cliente.
    assert.ok(rutina.indexOf('avisarAlNegocio(') < rutina.indexOf('loQueSeEscribe('),
      'se está sellando «ya se le avisó» antes de saber si el aviso salió.');
  });

  it('EL QUE MUERDE · si no se le pudo avisar, queda apuntado', () => {
    // Aliados es una app web: quien nunca aceptó las notificaciones no tiene
    // llave. A ese cliente se le contaban los días y se le apagaba el negocio sin
    // haberle mandado un solo mensaje, y sin que el dueño pudiera saberlo.
    const i = rutina.indexOf('avisarAlNegocio(');
    const trozo = rutina.slice(i, rutina.indexOf('loQueSeEscribe('));
    assert.match(trozo, /paraRevisar\.push/,
      'un aviso que no sale no deja ni rastro: ese cliente se apaga y nadie sabe '
      + 'que nunca se le avisó.');
  });

  it('EL QUE MUERDE · si se llena el cupo de la noche, se dice', () => {
    // Sin esto, pasados los 500 clientes se saltarían SIEMPRE LOS MISMOS —el
    // orden no cambia— y en el registro no se notaría nada raro: nunca se les
    // cobraría ni se les bloquearía.
    assert.match(rutina, /fichas\.size >= FICHAS_POR_NOCHE/);
    const i = rutina.indexOf('fichas.size >= FICHAS_POR_NOCHE');
    assert.match(rutina.slice(i, i + 400), /paraRevisar\.push/);
  });

  it('EL QUE MUERDE · el rastro NO va a la bitácora del superadmin', () => {
    // `logs` es la bitácora de acciones de PERSONAS, y el panel pinta `accion` y
    // `detalle`. Una fila automática cada noche sin esos campos sale en blanco, y
    // en cien noches echa de la pantalla las acciones de verdad.
    assert.match(rutina, /collection\("logsCobros"\)/);
    assert.ok(!/collection\("logs"\)/.test(rutina),
      'la rutina escribe en `logs` e inunda la pantalla de auditoría del superadmin.');
  });

  it('la fecha la pone el servidor, no la ficha', () => {
    assert.match(rutina, /hoyEnColombia\(new Date\(\)\)/);
  });

  it('EL QUE MUERDE · nada se borra (REGLA 12)', () => {
    const codigo = soloCodigo(rutina);
    assert.ok(!/\.delete\(|deleteDoc|FieldValue\.delete/.test(codigo),
      'la rutina de cobros borra algo. Los borrados dejan lápida.');
  });

  it('el aviso nunca tumba la rutina', () => {
    // Que no se pueda avisar a uno no puede dejar a los demás sin revisar.
    // OJO: `soloCodigo`. Sin él esta prueba miraba también los COMENTARIOS, y el
    // de aquí al lado nombra `failureCount`: la prueba pasaba en verde con la
    // comprobación borrada del código. Lo cazó la cacería de mutantes.
    const av = soloCodigo(
      cuerpoDeLaFuncion(todo, todo.indexOf('async function avisarAlNegocio')).texto);
    assert.match(av, /catch\s*\(/, 'un fallo de envío tumbaría la rutina entera.');
    assert.match(av, /failureCount/,
      'no mira `failureCount`: un token vencido contaría como aviso entregado.');
  });
});
