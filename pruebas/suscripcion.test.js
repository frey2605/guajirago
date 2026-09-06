/**
 * EL COBRO DE UN CLIENTE · la calculadora, probada aparte
 *
 * `guajirago/functions/suscripcion.js` decide CUÁNTO PAGA cada cliente y EN QUÉ
 * ESTADO está. De ahí van a colgar el aviso automático y el bloqueo.
 *
 * ── POR QUÉ LA MITAD DE ESTAS PRUEBAS SON DE LO QUE **NO** HACE ────────────
 * Porque esto toca dinero ajeno, y los dos errores que puede cometer son caros
 * en direcciones opuestas:
 *
 *   · inventarse un número -> le cobra de más a alguien, o le regala el mes;
 *   · inventarse una fecha -> BLOQUEA A ALGUIEN QUE PAGÓ.
 *
 * Cuando le falta un dato no adivina: devuelve «no lo sé» y dice por qué. Eso es
 * lo que más se vigila aquí.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  ESTADOS, precioAPagar, estadoQueLeToca, sumarDias, diasEntre,
} = require('../guajirago/functions/suscripcion.js');

// Una ficha normal, para no repetirla. Ningún número está escrito en el código
// de la calculadora: todos son datos de ESTE cliente.
const ficha = (extra) => ({
  precio: 80000,
  diasDePrueba: 0,
  diasDeGracia: 8,
  diasDeAviso: 5,
  inicio: '2026-01-01',
  proximoCobro: '2026-10-01',
  ...extra,
});

describe('EL COBRO · cuánto paga este cliente', () => {
  it('sin oferta, paga su precio', () => {
    const r = precioAPagar(ficha(), '2026-09-06');
    assert.strictEqual(r.precio, 80000);
    assert.match(r.porQue, /precio normal/);
  });

  it('con oferta vigente, manda la oferta', () => {
    const r = precioAPagar(ficha({
      oferta: { descripcion: '3 meses a mitad', precio: 40000, hasta: '2026-12-01' },
    }), '2026-09-06');
    assert.strictEqual(r.precio, 40000);
    // El porqué se le enseña al dueño: un cobro raro tiene que poder explicarse
    // sin abrir el código.
    assert.match(r.porQue, /3 meses a mitad/);
  });

  it('EL QUE MUERDE · la oferta se acaba SOLA, sin que nadie se acuerde', () => {
    const conOferta = ficha({ oferta: { precio: 40000, hasta: '2026-08-31' } });
    const r = precioAPagar(conOferta, '2026-09-06');
    assert.strictEqual(r.precio, 80000,
      'la oferta se venció el 31 de agosto y se le sigue cobrando el precio de '
      + 'oferta. Eso es plata que no entra, cada mes, hasta que alguien lo note.');
    assert.match(r.porQue, /venció/);
  });

  it('EL QUE MUERDE · el último día de la oferta TODAVÍA es de oferta', () => {
    // Un «menor que» en vez de «menor o igual» le cobra el precio normal el
    // último día. Es un día, pero es el día en que el cliente mira.
    const r = precioAPagar(ficha({ oferta: { precio: 40000, hasta: '2026-09-06' } }), '2026-09-06');
    assert.strictEqual(r.precio, 40000);
  });

  it('cada cliente puede tener su propio precio y su propia oferta', () => {
    // Es lo que pidió el dueño: «cada cliente puede tener valores y ofertas
    // diferentes». La calculadora no sabe de precios «normales»: solo lee la ficha.
    assert.strictEqual(precioAPagar(ficha({ precio: 50000 }), '2026-09-06').precio, 50000);
    assert.strictEqual(precioAPagar(ficha({ precio: 250000 }), '2026-09-06').precio, 250000);
    assert.strictEqual(precioAPagar(ficha({ precio: 0 }), '2026-09-06').precio, 0);
  });

  // ── LO QUE NO HACE ──────────────────────────────────────────────────────
  it('EL QUE MUERDE · sin precio en la ficha NO se inventa un cero', () => {
    // Un cero silencioso significa «gratis». Este cliente se quedaría sin pagar
    // nunca y nadie lo vería.
    const r = precioAPagar(ficha({ precio: undefined }), '2026-09-06');
    assert.strictEqual(r.precio, null,
      'sin precio en la ficha devolvió un número. Si es 0, ese cliente no paga '
      + 'nunca y nadie se entera.');
    assert.match(r.porQue, /no dice cuánto paga/);
  });

  it('EL QUE MUERDE · una oferta a medio escribir PARA el cobro, no lo ignora', () => {
    // Si se ignorara, se le cobraría el precio normal a un cliente al que se le
    // prometió otro, y nadie sabría por qué.
    for (const rota of [{ precio: 40000 }, { hasta: '2026-12-01' }, { precio: 'mitad', hasta: '2026-12-01' }]) {
      const r = precioAPagar(ficha({ oferta: rota }), '2026-09-06');
      assert.strictEqual(r.precio, null,
        'con la oferta ' + JSON.stringify(rota) + ' devolvió un precio en vez de parar.');
      assert.match(r.porQue, /medio escribir/);
    }
  });

  it('EL QUE MUERDE · un precio imposible no se cobra', () => {
    for (const malo of [-5000, NaN, Infinity, '80000', null]) {
      assert.strictEqual(precioAPagar(ficha({ precio: malo }), '2026-09-06').precio, null,
        'aceptó cobrar «' + String(malo) + '».');
    }
  });

  it('EL QUE MUERDE · sin ficha, o sin fecha, no se calcula nada', () => {
    assert.strictEqual(precioAPagar(null, '2026-09-06').precio, null);
    assert.strictEqual(precioAPagar(undefined, '2026-09-06').precio, null);
    assert.strictEqual(precioAPagar(ficha(), 'ayer').precio, null);
    assert.strictEqual(precioAPagar(ficha(), undefined).precio, null);
  });
});

describe('EL COBRO · en qué estado le toca estar', () => {
  it('en sus días de prueba, está en prueba', () => {
    const r = estadoQueLeToca(ficha({ inicio: '2026-09-01', diasDePrueba: 15 }), '2026-09-06');
    assert.strictEqual(r.estado, 'prueba');
    assert.strictEqual(r.diasPara, 10);
  });

  it('EL QUE MUERDE · cada cliente tiene SUS días de prueba, no unos fijos', () => {
    assert.strictEqual(
      estadoQueLeToca(ficha({ inicio: '2026-09-01', diasDePrueba: 3 }), '2026-09-06').estado,
      'alDia', 'con 3 días de prueba, el día 6 ya no está en prueba');
    assert.strictEqual(
      estadoQueLeToca(ficha({ inicio: '2026-09-01', diasDePrueba: 30 }), '2026-09-06').estado,
      'prueba');
  });

  it('lejos del cobro, está al día', () => {
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-10-01' }), '2026-09-06');
    assert.strictEqual(r.estado, 'alDia');
    assert.strictEqual(r.diasPara, 25);
  });

  it('cerca del cobro, está por vencer', () => {
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-09-09', diasDeAviso: 5 }), '2026-09-06');
    assert.strictEqual(r.estado, 'porVencer');
    assert.strictEqual(r.diasPara, 3);
    assert.match(r.porQue, /3 día/);
  });

  it('vencido pero dentro de la gracia, sigue operando', () => {
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-09-01', diasDeGracia: 8 }), '2026-09-06');
    assert.strictEqual(r.estado, 'vencido');
    assert.strictEqual(r.diasPara, 3, 'le quedan 3 de los 8 días de gracia');
  });

  it('EL QUE MUERDE · pasada la gracia, bloqueado', () => {
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-09-01', diasDeGracia: 3 }), '2026-09-06');
    assert.strictEqual(r.estado, 'bloqueado');
  });

  it('EL QUE MUERDE · el ÚLTIMO día de gracia todavía NO bloquea', () => {
    // Un «mayor» en vez de «mayor o igual» le quita un día de gracia a todo el
    // mundo. Es el día en que la gente paga.
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-09-01', diasDeGracia: 5 }), '2026-09-06');
    assert.strictEqual(r.estado, 'vencido',
      'el quinto día de cinco de gracia ya bloqueaba: se le comió un día a todos.');
  });

  it('EL QUE MUERDE · el día del cobro NO bloquea todavía', () => {
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-09-06', diasDeGracia: 8 }), '2026-09-06');
    assert.strictEqual(r.estado, 'vencido');
    assert.strictEqual(r.diasPara, 8, 'el día del cobro empieza la gracia entera');
  });

  it('sin días de gracia, vence y bloquea el mismo día', () => {
    const r = estadoQueLeToca(ficha({ proximoCobro: '2026-09-05', diasDeGracia: 0 }), '2026-09-06');
    assert.strictEqual(r.estado, 'bloqueado');
  });

  // ── LO QUE NO HACE ──────────────────────────────────────────────────────
  it('EL QUE MUERDE · SIN FECHA DE COBRO NO SE TOCA A NADIE', () => {
    // Es el error caro en la otra dirección: inventarse una fecha bloquea a
    // alguien que pagó. Antes que eso, se para y se dice que falta el dato.
    const r = estadoQueLeToca(ficha({ proximoCobro: undefined }), '2026-09-06');
    assert.strictEqual(r.estado, null,
      'sin fecha de cobro decidió un estado igual. Si decide «bloqueado», le corta '
      + 'la operación a un cliente que puede estar al día.');
    assert.match(r.porQue, /no se toca/);
  });

  it('EL QUE MUERDE · una fecha rota tampoco decide nada', () => {
    for (const mala of ['01/10/2026', '2026-13-45', 'pronto', 12345, null]) {
      assert.strictEqual(estadoQueLeToca(ficha({ proximoCobro: mala }), '2026-09-06').estado, null,
        'con la fecha «' + String(mala) + '» decidió algo.');
    }
  });

  it('EL QUE MUERDE · a un cancelado no lo mueve el calendario', () => {
    const r = estadoQueLeToca(ficha({ estado: 'cancelado', proximoCobro: '2026-01-01' }), '2026-09-06');
    assert.strictEqual(r.estado, 'cancelado',
      'un cliente que canceló volvió a «bloqueado» por el calendario. Ya no es '
      + 'cliente: no se le persigue con avisos de cobro.');
  });

  it('EL QUE MUERDE · todos los estados que devuelve están en la lista', () => {
    // Si devolviera uno que nadie conoce, el candado de las reglas no lo
    // reconocería y el bloqueo no se aplicaría.
    const casos = [
      ficha({ inicio: '2026-09-01', diasDePrueba: 15 }),
      ficha({ proximoCobro: '2026-10-01' }),
      ficha({ proximoCobro: '2026-09-09' }),
      ficha({ proximoCobro: '2026-09-01' }),
      ficha({ proximoCobro: '2026-08-01' }),
      ficha({ estado: 'cancelado' }),
    ];
    for (const f of casos) {
      const e = estadoQueLeToca(f, '2026-09-06').estado;
      assert.ok(e === null || ESTADOS.includes(e),
        'devolvió el estado «' + e + '», que no está en la lista conocida.');
    }
  });

  it('EL QUE MUERDE · «bloqueado» se escribe igual que en las reglas', () => {
    // El candado del servidor pregunta por el texto exacto `bloqueado`. Si esta
    // calculadora escribiera «Bloqueado» o «blocked», el bloqueo no se aplicaría
    // NUNCA y nadie lo notaría hasta que un moroso siguiera trabajando.
    const { leer } = require('./cargar.cjs');
    const reglas = leer('firestore.rules');
    const e = estadoQueLeToca(ficha({ proximoCobro: '2026-01-01', diasDeGracia: 0 }), '2026-09-06');
    assert.strictEqual(e.estado, 'bloqueado');
    assert.ok(reglas.includes("!= 'bloqueado'"),
      'las reglas ya no preguntan por «bloqueado»: el candado y la calculadora '
      + 'dejaron de hablar el mismo idioma.');
  });
});

describe('EL COBRO · las cuentas de fechas, que son el cimiento', () => {
  it('sumar días cruza meses y años', () => {
    assert.strictEqual(sumarDias('2026-01-31', 1), '2026-02-01');
    assert.strictEqual(sumarDias('2026-12-31', 1), '2027-01-01');
    assert.strictEqual(sumarDias('2026-02-28', 1), '2026-03-01');
  });

  it('EL QUE MUERDE · el año bisiesto no descuadra el cobro', () => {
    // 2028 es bisiesto. Un cliente que vence el 28 de febrero de 2028 no puede
    // bloquearse un día antes por una cuenta mal hecha.
    assert.strictEqual(sumarDias('2028-02-28', 1), '2028-02-29');
    assert.strictEqual(sumarDias('2028-02-29', 1), '2028-03-01');
    assert.strictEqual(diasEntre('2028-02-28', '2028-03-01'), 2);
  });


  it('EL QUE MUERDE · sumar días también va HACIA ATRÁS', () => {
    // Media función sin probar. La cacería lo destapó con un mutante que sumaba
    // medio día: parecía equivalente —JavaScript trunca las fracciones— pero al
    // comprobarlo EJECUTÁNDOLO difería en 87 de 2.646 combinaciones, todas con
    // días negativos, porque trunca HACIA CERO y −40,5 se queda en −39.
    //
    // Hoy nadie la llama con negativos, pero está exportada: quien haga la
    // pantalla del panel va a querer preguntar «¿desde cuándo?» y la va a usar
    // así. Que no se rompa el día que pase.
    assert.strictEqual(sumarDias('2026-03-01', -1), '2026-02-28');
    assert.strictEqual(sumarDias('2027-01-01', -1), '2026-12-31');
    assert.strictEqual(sumarDias('2028-03-01', -1), '2028-02-29');
    assert.strictEqual(sumarDias('2026-01-31', -40), '2025-12-22');
    assert.strictEqual(sumarDias('2026-09-06', 0), '2026-09-06');
  });

  it('EL QUE MUERDE · una fecha rota no devuelve una fecha inventada', () => {
    for (const mala of ['ayer', '2026-13-45', '', null, 20260906]) {
      assert.strictEqual(sumarDias(mala, 5), null,
        'con «' + String(mala) + '» devolvió una fecha. Una fecha inventada aquí '
        + 'bloquea a alguien que pagó.');
    }
  });

  it('los días entre fechas salen bien en los dos sentidos', () => {
    assert.strictEqual(diasEntre('2026-09-06', '2026-09-09'), 3);
    assert.strictEqual(diasEntre('2026-09-09', '2026-09-06'), -3);
    assert.strictEqual(diasEntre('2026-09-06', '2026-09-06'), 0);
  });
});
