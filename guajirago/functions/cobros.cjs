/**
 * LA RUTINA DE COBROS — QUÉ HACER CON CADA CLIENTE, CADA MADRUGADA
 *
 * Esta es la única parte del sistema que puede APAGAR EL NEGOCIO DE UN CLIENTE
 * sin que nadie pulse un botón. Todo lo de aquí está escrito con eso en mente.
 *
 * ── POR QUÉ LA DECISIÓN VIVE APARTE DE LA RUTINA ────────────────────────────
 * Lo que sigue es una función PURA: recibe la ficha y la fecha, y devuelve qué
 * habría que hacer. No habla con la base ni manda avisos. Así se puede probar
 * entera, sin emulador y sin red.
 *
 * No es un capricho: en este mismo proyecto, hace dos días, un guion que escribía
 * en la base tenía SIETE mutantes vivos en la parte que escribía —incluido uno que
 * borraba el documento entero de un negocio— porque las pruebas solo miraban la
 * decisión y ni un renglón de la plomería. Por esa lección, hasta LO QUE SE
 * ESCRIBE se arma aquí (`loQueSeEscribe`), para poder mirarlo.
 *
 * ── LAS TRES REGLAS QUE MANDAN AQUÍ ─────────────────────────────────────────
 *
 * 1. ANTE LA DUDA, NO SE TOCA. Si a la ficha le falta un dato de los que
 *    justifican un castigo —el precio, los días de gracia, los días de aviso—
 *    esta rutina NO decide nada sobre ese cliente y lo deja apuntado. Bloquear a
 *    alguien que pagó es el error más caro que puede cometer este sistema.
 *
 * 2. UN AVISO AL DÍA, COMO MUCHO. Avisar de más es casi tan malo como no avisar:
 *    el cliente deja de mirarlos, y el día que de verdad importa no lo lee.
 *
 * 3. SI NADA CAMBIÓ, NO SE ESCRIBE NADA. Escribir el mismo estado cada madrugada
 *    ensucia el historial y dispara escuchas en las apps sin motivo.
 */
const { estadoQueLeToca, precioAPagar, esFecha } = require('./suscripcion.js');

/** Los tres estados que le duelen al cliente: los que se le avisan, y los únicos
 *  ante los que se exige tener los datos completos antes de actuar. */
const DUELEN = ['porVencer', 'vencido', 'bloqueado'];

/** Los dos estados en los que el cliente NO puede trabajar. */
const NO_OPERAN = ['bloqueado', 'cancelado'];

/**
 * QUÉ VA EN EL INTERRUPTOR DEL NEGOCIO (`restaurantes/{id}.estadoComercial`).
 *
 * EL INTERRUPTOR NO CUENTA LA HISTORIA COMERCIAL: solo contesta «¿puede
 * trabajar?». Y el candado del servidor entiende UNA SOLA palabra para decir que
 * no — `bloqueado` (`firestore.rules`, `negocioPuedeOperar`).
 *
 * Por eso `cancelado` se traduce a `bloqueado` al llegar aquí. Escribir la
 * palabra `cancelado` en el interruptor sería un agujero de los caros: el candado
 * la dejaría pasar y el cliente al que el dueño acaba de cancelar VOLVERÍA A
 * TRABAJAR GRATIS esa misma noche. La historia comercial se guarda en la ficha,
 * que para eso está.
 */
function interruptorQueLeToca(estado) {
  return NO_OPERAN.includes(estado) ? 'bloqueado' : estado;
}

/**
 * ¿LE FALTA A LA FICHA ALGO DE LO QUE HACE FALTA PARA CASTIGARLE?
 *
 * Devuelve `null` si está completa, o el texto de qué falta. Solo se pregunta
 * cuando el estado que toca es de los que duelen: estar al día sin precio
 * apuntado no le hace daño a nadie y no merece llenar la lista del dueño.
 *
 * Los tres datos que se exigen no son un capricho:
 *  · sin PRECIO, el aviso le llega sin decirle cuánto debe — y luego se le apaga;
 *  · sin DÍAS DE GRACIA, el campo vale cero y se le suspende al día siguiente de
 *    vencer, sin un solo día de margen;
 *  · sin DÍAS DE AVISO, nunca pasa por «por vencer»: se entera cuando ya no puede
 *    trabajar.
 * Campo ausente = castigo máximo es justo lo contrario de «ante la duda, no se
 * toca».
 */
function faltaAlgoParaCastigar(ficha, hoy) {
  const falta = [];
  const p = precioAPagar(ficha, hoy);
  if (p.precio === null) falta.push('el precio (' + p.porQue + ')');
  if (!Number.isInteger(ficha && ficha.diasDeGracia)) falta.push('los días de gracia');
  if (!Number.isInteger(ficha && ficha.diasDeAviso)) falta.push('los días de aviso');
  return falta.length ? falta.join(', ') : null;
}

/**
 * QUÉ HAY QUE HACERLE HOY A ESTE CLIENTE.
 *
 * @param ficha    lo que dice `suscripciones/{negocioId}`
 * @param negocio  lo que dice `restaurantes/{negocioId}` (para saber si el
 *                 interruptor ya está donde tiene que estar)
 * @param hoy      la fecha DEL SERVIDOR, `AAAA-MM-DD`. Nunca la del navegador de
 *                 un cliente: bastaría con cambiarle la hora al computador para
 *                 no vencer jamás.
 *
 * Devuelve siempre `{ hacer, porQue, ... }`. El `porQue` va SIEMPRE, para que el
 * registro sirva para explicar un bloqueo sin abrir el código.
 */
function queHacerCon(ficha, negocio, hoy) {
  if (!esFecha(hoy)) {
    return { hacer: 'nada', porQue: 'no me dieron una fecha válida', avisar: false };
  }

  const r = estadoQueLeToca(ficha, hoy);

  // ── REGLA 1 · ANTE LA DUDA, NO SE TOCA ────────────────────────────────
  if (!r.estado) {
    return {
      hacer: 'revisar',
      porQue: r.porQue,
      avisar: false,
      // «revisar» NO es «bloquear»: es una lista para que el dueño la mire. Este
      // cliente se queda EXACTAMENTE como está.
    };
  }

  // La misma regla, para los datos que justifican el castigo. Sin ellos no se
  // castiga: se apunta.
  if (DUELEN.includes(r.estado)) {
    const falta = faltaAlgoParaCastigar(ficha, hoy);
    if (falta) {
      return {
        hacer: 'revisar',
        porQue: 'iba a quedar «' + r.estado + '» pero a su ficha le falta ' + falta,
        avisar: false,
      };
    }
  }

  const estadoAhora = ficha && ficha.estado;
  const interruptorAhora = negocio && negocio.estadoComercial;
  const interruptor = interruptorQueLeToca(r.estado);
  const cambiaEstado = estadoAhora !== r.estado;
  const cambiaInterruptor = interruptorAhora !== interruptor;

  // ── ¿HAY QUE AVISARLE? ────────────────────────────────────────────────
  // Solo en los tres estados que le interesan al cliente. Estar «al día» no se
  // avisa: nadie quiere un mensaje diario diciéndole que todo está bien.
  const seAvisa = DUELEN.includes(r.estado);
  // REGLA 2 · uno al día como mucho. Y si acaba de CAMBIAR de estado, se avisa
  // aunque ya se le hubiera avisado hoy: pasar de «vencido» a «bloqueado» es
  // noticia nueva y no puede esperar a mañana.
  //
  // «bloqueado» es aparte, y por un motivo concreto: no tiene fecha de final.
  // Recordárselo a diario como a los otros dos serían CIENTOS de mensajes de
  // «servicio suspendido» a un ex-cliente. Se le avisa UNA vez, la que funciona:
  // como el sello solo se pone cuando el aviso SALIÓ de verdad, se reintenta
  // cada noche hasta que llegue, y entonces para.
  const yaAvisado = r.estado === 'bloqueado'
    ? !!(ficha && ficha.avisadoDe === 'bloqueado')
    : !!(ficha && ficha.avisadoEl === hoy && ficha.avisadoDe === r.estado);
  const avisar = seAvisa && !yaAvisado;

  // ── REGLA 3 · SI NADA CAMBIÓ, NO SE ESCRIBE NADA ──────────────────────
  if (!cambiaEstado && !cambiaInterruptor && !avisar) {
    return {
      hacer: 'nada', porQue: 'sigue igual: ' + r.porQue,
      estado: r.estado, interruptor, avisar: false,
    };
  }

  return {
    hacer: 'actualizar',
    estado: r.estado,
    porQue: r.porQue,
    diasPara: r.diasPara,
    cambiaEstado,
    // El interruptor que lee el candado del servidor vive en el NEGOCIO, no en la
    // ficha. Si se quedaran descuadrados, un cliente bloqueado seguiría operando
    // —o al revés— y nadie lo vería.
    interruptor,
    cambiaInterruptor,
    avisar,
    mensaje: avisar ? mensajeDelAviso(r, ficha, hoy) : null,
  };
}

/**
 * EXACTAMENTE LO QUE SE VA A ESCRIBIR, en los dos documentos.
 *
 * Está aquí, y no metido dentro de la rutina, POR LA LECCIÓN DE HACE DOS DÍAS:
 * aquel guion tenía siete mutantes vivos precisamente en la parte que escribía,
 * porque no había forma de mirarla sin una base de datos delante. Esto sí se
 * puede mirar.
 *
 * @param avisoQueSalio  si el aviso SALIÓ de verdad. El sello «ya se le avisó»
 *   solo se pone si el mensaje se mandó: si se pusiera antes de mandarlo, la
 *   ficha juraría haber avisado a alguien que nunca recibió nada, y en una
 *   discusión el registro le daría la razón al cliente.
 */
function loQueSeEscribe(decision, hoy, avisoQueSalio) {
  return {
    ficha: {
      estado: decision.estado,
      revisadoEl: hoy,
      porQue: decision.porQue,
      ...(avisoQueSalio ? { avisadoEl: hoy, avisadoDe: decision.estado } : {}),
    },
    // SOLO el interruptor. Lo demás del negocio —su nombre, su menú, sus
    // horarios— no es asunto de la rutina de cobros.
    negocio: { estadoComercial: decision.interruptor },
  };
}

/**
 * QUÉ SE LE DICE, en cristiano. Lo lee un dueño de restaurante en su teléfono, no
 * un técnico: nada de «estado: vencido».
 */
function mensajeDelAviso(r, ficha, hoy) {
  const p = precioAPagar(ficha, hoy);
  const cuanto = p.precio === null ? '' : ' de $' + p.precio.toLocaleString('es-CO');

  if (r.estado === 'porVencer') {
    return {
      titulo: 'Tu plan vence en ' + r.diasPara + ' día' + (r.diasPara === 1 ? '' : 's'),
      texto: 'Tu pago' + cuanto + ' vence el ' + ficha.proximoCobro
        + '. Escríbenos para renovarlo y no perder el servicio.',
    };
  }
  if (r.estado === 'vencido') {
    return {
      titulo: 'Tu plan venció',
      texto: 'Venció el ' + ficha.proximoCobro + '. Tienes ' + r.diasPara
        + ' día' + (r.diasPara === 1 ? '' : 's') + ' para ponerte al día antes de que '
        + 'se suspenda el servicio.',
    };
  }
  return {
    titulo: 'Servicio suspendido',
    texto: 'Tu cuenta quedó suspendida por falta de pago. Tus datos están completos '
      + 'y puedes seguir consultándolos. Escríbenos y la reactivamos enseguida.',
  };
}

/**
 * LA FECHA DEL SERVIDOR, en `AAAA-MM-DD` y en hora de Colombia.
 *
 * VA AQUÍ Y NO EN LA RUTINA para que se pueda probar. Y es de Colombia a
 * propósito: si se usara la hora del servidor de Google —que es UTC— un cliente
 * que vence el día 1 se bloquearía a las 7 de la tarde del día 31.
 */
function hoyEnColombia(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  // Colombia es UTC−5 todo el año: no tiene cambio de horario.
  const local = new Date(d.getTime() - 5 * 3600000);
  return local.toISOString().slice(0, 10);
}

module.exports = {
  queHacerCon, loQueSeEscribe, mensajeDelAviso, hoyEnColombia,
  interruptorQueLeToca, faltaAlgoParaCastigar, DUELEN, NO_OPERAN,
};
