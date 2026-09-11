/**
 * PRUEBAS DE LA CALCULADORA QUE CIERRA VIAJES COLGADOS
 *
 * No leen el código: lo EJECUTAN, caso por caso. La calculadora vive suelta en
 * `guajirago/functions/viajesColgados.cjs` justo para esto: la rutina que la usa
 * es PROGRAMADA y una función programada no se puede encender desde el emulador.
 *
 * LA PRUEBA QUE DA SENTIDO A TODO EL ARCHIVO es «EL VIAJE VIVO NO SE CIERRA».
 * Reproduce lo que pasó de verdad: medido el 9-sep-2026 contra el servidor, de
 * los 8 viajes que la rutina había cerrado, CUATRO estaban en `fase: 'en_viaje'`
 * —el conductor ya había recogido al pasajero—. La rutina miraba el reloj y no
 * miraba la fase. Si alguien vuelve a quitar esa mirada, esta prueba se pone
 * roja antes de que llegue al servidor.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const { queHacerConElViaje, MINUTOS, RODANDO }
  = require('../guajirago/functions/viajesColgados.cjs');

// Una hora redonda de referencia, para que las cuentas se lean solas.
const AHORA = '2026-09-10T12:00:00.000Z';
/** La fecha que estaba `m` minutos antes de AHORA. */
const haceMin = (m) => new Date(new Date(AHORA).getTime() - m * 60000).toISOString();

describe('LA CALCULADORA DE VIAJES COLGADOS', () => {
  // ── LO QUE SÍ SE CIERRA ──────────────────────────────────────────────────
  describe('lo que de verdad está colgado, se cierra', () => {
    it('una búsqueda que nadie tomó en 20 min → vencido', () => {
      const r = queHacerConElViaje({ estado: 'esperando', fechaSolicitud: haceMin(21) }, AHORA);
      assert.strictEqual(r.cerrar, true);
      assert.strictEqual(r.estado, 'vencido');
      assert.match(r.porQue, /nadie lo tomó/);
    });

    it('un viaje aceptado que el conductor nunca llegó a recoger, a la hora → expirado', () => {
      const r = queHacerConElViaje({
        estado: 'aceptado', fechaAceptacion: haceMin(61),
        // SIN `fase`: el conductor iba en camino y no llegó.
      }, AHORA);
      assert.strictEqual(r.cerrar, true);
      assert.strictEqual(r.estado, 'expirado');
      assert.match(r.porQue, /nunca llegó a recoger/);
    });

    it('y el que va rodando, a las 3 horas, para no dejar ocupado al conductor', () => {
      const r = queHacerConElViaje({
        estado: 'aceptado', fase: 'en_viaje', tiempoEspera: haceMin(181),
      }, AHORA);
      assert.strictEqual(r.cerrar, true);
      assert.strictEqual(r.estado, 'expirado');
    });
  });

  // ── 🔴 LO QUE NO SE PUEDE CERRAR ─────────────────────────────────────────
  describe('EL VIAJE VIVO NO SE CIERRA · lo que pasó de verdad 4 veces', () => {
    // Reconstruido de los datos: `aceptado`, el conductor ya llegó
    // (`conductorEnPunto`), el pasajero montado (`fase: 'en_viaje'`), y más de
    // una hora desde que se aceptó. La rutina vieja lo cerraba. Ésta no.
    const elCasoReal = (minutosRodando) => ({
      estado: 'aceptado',
      fase: 'en_viaje',
      conductorEnPunto: true,
      fechaSolicitud: haceMin(200),
      fechaAceptacion: haceMin(190),
      tiempoEspera: haceMin(minutosRodando),
    });

    it('el pasajero va montado y hace rato que se aceptó: NO se cierra', () => {
      const r = queHacerConElViaje(elCasoReal(30), AHORA);
      assert.strictEqual(r.cerrar, false,
        'SE CERRÓ UN VIAJE CON EL PASAJERO MONTADO. Es exactamente lo que le pasó a 4 de '
        + 'los 8 viajes que la rutina había cerrado hasta el 9-sep-2026: al pasajero se le '
        + 'acaba el viaje en la pantalla y al conductor se le suelta, en media carrera.');
      assert.match(r.porQue, /ESTE VIAJE ESTÁ VIVO/);
    });

    it('el conductor llegó y está esperando al pasajero: tampoco', () => {
      const r = queHacerConElViaje({
        estado: 'aceptado', fase: 'en_punto', conductorEnPunto: true,
        fechaAceptacion: haceMin(120), tiempoEspera: haceMin(10),
      }, AHORA);
      assert.strictEqual(r.cerrar, false,
        'se cerró un viaje con el conductor parado en la puerta esperando al pasajero.');
    });

    // EL QUE MUERDE DE VERDAD: la rutina vieja contaba desde que se ACEPTÓ.
    // Con eso, un viaje que lleva 5 minutos rodando pero se aceptó hace 2 horas
    // —porque el pasajero tardó en encontrar conductor— se cerraba igual.
    it('EL QUE MUERDE · lleva 5 min rodando pero se aceptó hace 2 horas: NO se cierra', () => {
      const r = queHacerConElViaje({
        estado: 'aceptado', fase: 'en_viaje',
        fechaAceptacion: haceMin(125),
        tiempoEspera: haceMin(5),
      }, AHORA);
      assert.strictEqual(r.cerrar, false,
        'el reloj del viaje sigue arrancando desde que se aceptó, y no desde que el '
        + 'conductor recogió. Con eso, un viaje que acaba de empezar se cierra por culpa '
        + 'del rato que el pasajero pasó buscando conductor.');
    });

    it('una búsqueda de hace 5 min sigue buscando', () => {
      const r = queHacerConElViaje({ estado: 'esperando', fechaSolicitud: haceMin(5) }, AHORA);
      assert.strictEqual(r.cerrar, false);
    });

    it('un viaje ya terminado no se toca', () => {
      for (const estado of ['finalizado', 'cancelado', 'cancelado_conductor', 'vencido', 'expirado']) {
        const r = queHacerConElViaje({ estado, fechaSolicitud: haceMin(9999) }, AHORA);
        assert.strictEqual(r.cerrar, false, 'se volvió a cerrar un viaje que ya estaba en «' + estado + '»');
      }
    });
  });

  // ── LOS BORDES, QUE ES DONDE SE ESCONDEN LOS ERRORES ─────────────────────
  describe('los bordes', () => {
    it('justo EN el límite todavía no se cierra; un minuto después sí', () => {
      const justo = queHacerConElViaje({ estado: 'esperando', fechaSolicitud: haceMin(MINUTOS.buscando) }, AHORA);
      assert.strictEqual(justo.cerrar, false, 'se cerró justo AL cumplir el límite, y el límite es «pasado de»');
      const pasado = queHacerConElViaje({ estado: 'esperando', fechaSolicitud: haceMin(MINUTOS.buscando + 1) }, AHORA);
      assert.strictEqual(pasado.cerrar, true);
    });

    it('un viaje sin fechas NO se cierra, y dice por qué', () => {
      // Sin fecha no se puede saber si está colgado. Cerrarlo «por si acaso»
      // sería cerrar viajes vivos: ante la duda, no se toca.
      const r = queHacerConElViaje({ estado: 'aceptado' }, AHORA);
      assert.strictEqual(r.cerrar, false);
      assert.match(r.porQue, /no se puede medir/);
    });

    it('una fecha con basura dentro tampoco lo cierra', () => {
      const r = queHacerConElViaje({ estado: 'esperando', fechaSolicitud: 'ayer por la tarde' }, AHORA);
      assert.strictEqual(r.cerrar, false);
    });

    it('sin viaje ninguno no revienta', () => {
      assert.strictEqual(queHacerConElViaje(null, AHORA).cerrar, false);
      assert.strictEqual(queHacerConElViaje(undefined, AHORA).cerrar, false);
      assert.strictEqual(queHacerConElViaje({}, AHORA).cerrar, false);
    });

    // REGLA 9 del dueño: nada pasa en silencio, tampoco NO hacer nada.
    it('SIEMPRE dice por qué, se cierre o no', () => {
      const casos = [
        { estado: 'esperando', fechaSolicitud: haceMin(5) },
        { estado: 'esperando', fechaSolicitud: haceMin(99) },
        { estado: 'aceptado', fechaAceptacion: haceMin(10) },
        { estado: 'aceptado', fase: 'en_viaje', tiempoEspera: haceMin(10) },
        { estado: 'finalizado' },
        {},
      ];
      for (const c of casos) {
        const r = queHacerConElViaje(c, AHORA);
        assert.ok(r.porQue && r.porQue.length > 10,
          'un viaje se quedó sin explicación: ' + JSON.stringify(c));
      }
    });
  });

  // ── 🔴 EL RELOJ DEL CELULAR ──────────────────────────────────────────────
  //  `tiempoEspera` y `nuevaOferta` las escribe EL TELÉFONO. Un celular
  //  atrasado hacía que un viaje recién empezado pareciera llevar horas, y la
  //  calculadora lo cerraba con el pasajero dentro. Lo cazó la segunda opinión
  //  del 10-sep-2026 MIDIÉNDOLO, no leyéndolo.
  describe('EL RELOJ DEL CELULAR no puede matar un viaje', () => {
    it('EL QUE MUERDE · celular 4 horas ATRASADO: el viaje sigue vivo', () => {
      const r = queHacerConElViaje({
        estado: 'aceptado', fase: 'en_viaje',
        fechaAceptacion: haceMin(10),          // del SERVIDOR (confirmarConductor)
        tiempoEspera: haceMin(245),            // del CELULAR, 4 h atrasado
      }, AHORA);
      assert.strictEqual(r.cerrar, false,
        'un celular atrasado mató un viaje vivo. `tiempoEspera` no puede ser ANTERIOR a '
        + '`fechaAceptacion`, que la escribe el servidor: si lo es, no es de fiar.');
    });

    it('celular ADELANTADO: tampoco se cuela una fecha del futuro', () => {
      const enElFuturo = new Date(new Date(AHORA).getTime() + 60 * 60000).toISOString();
      const r = queHacerConElViaje({
        estado: 'aceptado', fase: 'en_viaje',
        fechaAceptacion: haceMin(400), tiempoEspera: enElFuturo,
      }, AHORA);
      // Con la fecha del futuro descartada se cae a `fechaAceptacion` (400 min),
      // que sí pasa de las 3 horas: se cierra, y por el motivo correcto.
      assert.strictEqual(r.cerrar, true);
      assert.ok(r.minutos > 300, 'se usó la fecha del futuro en vez de la del servidor');
    });

    it('y si la fecha del celular es buena, esa se usa', () => {
      const r = queHacerConElViaje({
        estado: 'aceptado', fase: 'en_viaje',
        fechaAceptacion: haceMin(400),   // se aceptó hace mucho...
        tiempoEspera: haceMin(20),       // ...pero recogió hace 20 min
      }, AHORA);
      assert.strictEqual(r.cerrar, false,
        'se ignoró una `tiempoEspera` buena y se contó desde que se aceptó. El reloj del '
        + 'viaje empieza cuando el conductor recoge, no cuando acepta.');
    });

    it('EL QUE MUERDE · «Seguir buscando» reinicia el reloj de la búsqueda', () => {
      // `Solicitar.js:877` devuelve el viaje a `esperando` y escribe `nuevaOferta`,
      // pero NO toca `fechaSolicitud`. Sin mirar `nuevaOferta`, a un pasajero que
      // lleva media hora insistiendo se le muere la búsqueda en la mano.
      const r = queHacerConElViaje({
        estado: 'esperando',
        fechaSolicitud: haceMin(25),
        nuevaOferta: haceMin(1),
      }, AHORA);
      assert.strictEqual(r.cerrar, false,
        'se venció la búsqueda de alguien que acababa de darle a «Seguir buscando».');
    });
  });

  // ── LOS NÚMEROS QUE DECIDIÓ EL DUEÑO ─────────────────────────────────────
  //  🔴 SIN ESTA PRUEBA LOS TRES NÚMEROS ESTÁN SUELTOS. Lo comprobó la segunda
  //  opinión saboteándolos: con `noRecogio: 5` la rutina mataría todo viaje
  //  aceptado a los cinco minutos, y las 14 pruebas de este archivo seguían
  //  verdes — porque todas calculan sus casos A PARTIR de `MINUTOS`, así que se
  //  mueven con el número en vez de vigilarlo.
  //  Esto los clava. Si el dueño los cambia, esta prueba se pone roja: es lo que
  //  se quiere, para que el cambio sea a propósito y quede con su fecha.
  it('EL QUE MUERDE · los minutos son los que decidió el dueño el 10-sep-2026', () => {
    assert.deepStrictEqual({ ...MINUTOS }, {
      buscando: 20,     // nadie tomó la búsqueda
      noRecogio: 60,    // lo aceptaron y el conductor nunca llegó
      rodando: 180,     // ya recogió, y nadie cerró el viaje
    }, 'alguien cambió los minutos de la rutina que cierra viajes.\n'
      + '   Los eligió el dueño el 10-sep-2026 con la medición delante:\n'
      + '     · 1 hora al que nunca recogió — ése sí está colgado.\n'
      + '     · 3 horas al que va rodando — el tope NO es para limpiar, es para que\n'
      + '       un conductor que se olvide de cerrar no quede ocupado para siempre.\n'
      + '   Si el cambio es a propósito, cámbialo aquí también y pon la fecha.');
  });

  // ── EL AMARRE CON LA FASE ────────────────────────────────────────────────
  it('EL QUE MUERDE · las fases que cuentan como «hay alguien ahí» son las de la app', () => {
    // `AppConductor.js` escribe exactamente estas dos antes de finalizar:
    //   :977  fase: 'en_punto'   (llegó, espera al pasajero)
    //   :1003 fase: 'en_viaje'   (el pasajero va montado)
    // Si mañana se añade una fase nueva a la app y no aquí, esta calculadora
    // volvería a cerrar viajes vivos — sin un solo error.
    //
    // SE LEE EL CÓDIGO SIN COMENTARIOS, y no es un detalle: `AppConductor.js:995`
    // tiene un COMENTARIO que menciona `fase: 'en_viaje'`. Leyendo el archivo
    // crudo, esta prueba se quedaba verde aunque se borrara la escritura de
    // verdad, porque el comentario la tapaba. Lo cazó la segunda opinión.
    const { leer, soloCodigo } = require('./cargar.cjs');
    const app = soloCodigo(leer('guajirago/src/AppConductor.js'));
    const enLaApp = [...app.matchAll(/fase:\s*'([a-z_]+)'/g)].map((m) => m[1]);
    const vivas = [...new Set(enLaApp)].filter((f) => f !== 'finalizado').sort();
    assert.deepStrictEqual([...RODANDO].sort(), vivas,
      'la app del conductor escribe estas fases: ' + vivas.join(', ') + '\n'
      + '   y la calculadora cuenta como «hay alguien ahí»: ' + [...RODANDO].sort().join(', ') + '\n'
      + '   Si se separan, un viaje en la fase nueva se cierra con el pasajero dentro.');
  });
});
