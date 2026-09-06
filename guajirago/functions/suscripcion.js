/**
 * EL COBRO DE UN CLIENTE — UNA SOLA CALCULADORA, Y ESTÁ EN EL SERVIDOR
 *
 * SEGUNDA LEY del proyecto: «No se pueden usar dos calculadoras para un mismo
 * proceso. La calculadora buena es la del servidor; el celular puede ENSEÑAR el
 * número, nunca DECIDIRLO.»
 *
 * Aquí eso no es una preferencia: es dinero de un cliente que paga. El panel
 * enseñará lo que este archivo calcule, y una prueba de amarre vigilará que digan
 * lo mismo. Si esta cuenta viviera también en el panel, el día que cambie una
 * regla su pantalla diría un precio y el cobro haría otro.
 *
 * Y hay precedente en esta misma casa: la comisión del viaje vive HOY en tres
 * sitios —comisiones.js, el cálculo a mano de functions/index.js:279 y un
 * `COMISION_POR_VIAJE = 800` escrito a pelo en el panel— y no dan lo mismo.
 * Esto nace sin ese problema.
 *
 * ── LO QUE ESTE ARCHIVO NO HACE NUNCA ───────────────────────────────────────
 * NO SE INVENTA UN NÚMERO SOBRE DINERO. Si a una ficha le falta el precio o la
 * fecha, esta calculadora NO devuelve cero ni una fecha por defecto: devuelve
 * «no lo sé» y dice por qué. Un cero silencioso significa «gratis», y una fecha
 * inventada bloquea a alguien que pagó.
 *
 * ── LAS FECHAS ──────────────────────────────────────────────────────────────
 * Se comparan como texto `AAAA-MM-DD`, que en ese formato ordena igual que una
 * fecha. El `hoy` LO PONE QUIEN LLAMA, y quien llama es el servidor. Nunca el
 * navegador de un cliente: bastaría con cambiarle la hora al computador para no
 * vencer jamás. Este proyecto ya tiene una deuda anotada por eso en los viajes.
 *
 * ── CADA CLIENTE, LO SUYO ───────────────────────────────────────────────────
 * Palabras del dueño (6-sep-2026): «cada cliente puede tener valores y ofertas
 * diferentes», y «los datos de prueba y todo lo demás se debe colocar en el panel
 * de administración de cada cliente». Por eso aquí NO HAY NI UN NÚMERO ESCRITO:
 * el precio, los días de prueba, los de gracia y los de aviso son campos de la
 * ficha de cada cliente. Este archivo solo sabe hacer la cuenta.
 */

/** Los estados por los que pasa un cliente. Quien los use, que los use de aquí. */
const ESTADOS = ['prueba', 'alDia', 'porVencer', 'vencido', 'bloqueado', 'cancelado'];

/** Suma días a una fecha `AAAA-MM-DD` y devuelve otra igual. */
function sumarDias(fecha, dias) {
  const d = new Date(fecha + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** ¿Es una fecha `AAAA-MM-DD` de verdad? */
function esFecha(f) {
  return typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)
    && !Number.isNaN(new Date(f + 'T00:00:00Z').getTime());
}

/** ¿Es un número de dinero que se puede cobrar? */
function esPlata(n) {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * CUÁNTO PAGA ESTE CLIENTE HOY.
 *
 * Si tiene una oferta vigente, manda la oferta. Cuando se le pasa la fecha,
 * vuelve solo a su precio normal — sin que nadie tenga que acordarse.
 *
 * Devuelve `{ precio, porQue }`, o `{ precio: null, porQue }` si no se puede
 * saber. El `porQue` va SIEMPRE, para que el panel se lo pueda enseñar al dueño
 * y para que un cobro raro se pueda explicar sin abrir el código.
 */
function precioAPagar(ficha, hoy) {
  if (!ficha || typeof ficha !== 'object') {
    return { precio: null, porQue: 'este cliente no tiene ficha de cobro' };
  }
  if (!esFecha(hoy)) {
    return { precio: null, porQue: 'no me dieron una fecha válida para calcular' };
  }

  const o = ficha.oferta;
  if (o && typeof o === 'object') {
    // Una oferta a medio escribir NO se aplica ni se ignora en silencio: se dice.
    // Si se ignorara, al cliente se le cobraría el precio normal después de
    // habérsele prometido otro, y nadie sabría por qué.
    if (!esPlata(o.precio) || !esFecha(o.hasta)) {
      return {
        precio: null,
        porQue: 'tiene una oferta a medio escribir (le falta el precio o el hasta): '
          + 'no se cobra nada hasta que alguien la complete',
      };
    }
    if (hoy <= o.hasta) {
      return {
        precio: o.precio,
        porQue: 'oferta vigente'
          + (o.descripcion ? ' «' + o.descripcion + '»' : '')
          + ' hasta el ' + o.hasta,
      };
    }
  }

  if (!esPlata(ficha.precio)) {
    return { precio: null, porQue: 'la ficha no dice cuánto paga este cliente' };
  }
  return {
    precio: ficha.precio,
    porQue: o ? 'su oferta venció el ' + o.hasta + ': vuelve a su precio normal'
      : 'su precio normal',
  };
}

/**
 * EN QUÉ ESTADO LE TOCA ESTAR HOY.
 *
 * El recorrido: prueba → al día → por vencer → vencido → bloqueado. Y de vuelta
 * a «al día» en cuanto el dueño marque el pago, que es otra cosa y no se decide
 * aquí.
 *
 * Devuelve también `diasPara`, que es lo que el aviso necesita para decir «te
 * vence en 3 días» sin volver a hacer la cuenta por su lado.
 */
function estadoQueLeToca(ficha, hoy) {
  if (!ficha || typeof ficha !== 'object') {
    return { estado: null, porQue: 'este cliente no tiene ficha de cobro' };
  }
  if (!esFecha(hoy)) {
    return { estado: null, porQue: 'no me dieron una fecha válida para calcular' };
  }
  // Un cliente cancelado se queda cancelado: no lo mueve el calendario.
  if (ficha.estado === 'cancelado') {
    return { estado: 'cancelado', porQue: 'lo canceló el dueño', diasPara: null };
  }

  // ── LA PRUEBA GRATIS ────────────────────────────────────────────────────
  if (esFecha(ficha.inicio) && Number.isInteger(ficha.diasDePrueba) && ficha.diasDePrueba > 0) {
    const finPrueba = sumarDias(ficha.inicio, ficha.diasDePrueba);
    if (hoy < finPrueba) {
      return {
        estado: 'prueba',
        porQue: 'está en sus ' + ficha.diasDePrueba + ' días de prueba, hasta el ' + finPrueba,
        diasPara: diasEntre(hoy, finPrueba),
      };
    }
  }

  // ── DE AQUÍ EN ADELANTE MANDA LA FECHA DE COBRO ─────────────────────────
  // Sin ella no se decide NADA. Antes que bloquear a alguien que pagó, se para
  // y se dice que falta el dato.
  if (!esFecha(ficha.proximoCobro)) {
    return {
      estado: null,
      porQue: 'la ficha no dice cuándo le toca pagar: no se toca a este cliente',
      diasPara: null,
    };
  }

  const faltan = diasEntre(hoy, ficha.proximoCobro);

  if (faltan > 0) {
    const aviso = Number.isInteger(ficha.diasDeAviso) ? ficha.diasDeAviso : 0;
    if (aviso > 0 && faltan <= aviso) {
      return {
        estado: 'porVencer',
        porQue: 'le vence en ' + faltan + ' día(s), el ' + ficha.proximoCobro,
        diasPara: faltan,
      };
    }
    return {
      estado: 'alDia',
      porQue: 'al día; le vence el ' + ficha.proximoCobro,
      diasPara: faltan,
    };
  }

  // Ya venció. ¿Le queda gracia?
  const gracia = Number.isInteger(ficha.diasDeGracia) && ficha.diasDeGracia > 0
    ? ficha.diasDeGracia : 0;
  const vencidoHace = -faltan;
  if (vencidoHace <= gracia) {
    return {
      estado: 'vencido',
      porQue: 'venció el ' + ficha.proximoCobro + '; le quedan '
        + (gracia - vencidoHace) + ' día(s) de gracia',
      diasPara: gracia - vencidoHace,
    };
  }
  return {
    estado: 'bloqueado',
    porQue: 'venció el ' + ficha.proximoCobro + ' y se le pasaron los '
      + gracia + ' día(s) de gracia',
    diasPara: 0,
  };
}

/** Días entre dos fechas `AAAA-MM-DD`. Negativo si la segunda ya pasó. */
function diasEntre(desde, hasta) {
  const a = new Date(desde + 'T00:00:00Z').getTime();
  const b = new Date(hasta + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

module.exports = {
  ESTADOS, precioAPagar, estadoQueLeToca, sumarDias, diasEntre, esFecha, esPlata,
};
