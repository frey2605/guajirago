/**
 * PRUEBAS DE «¿CUÁL ES MI VIAJE EN CURSO?»
 *
 * No leen el código: EJECUTAN `elViajeEnCurso` de `guajirago/src/estadosViaje.js`,
 * caso por caso.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 QUÉ VINO A CERRAR ESTO
 * ════════════════════════════════════════════════════════════════════════════
 * El BOTÓN DE PÁNICO. `Seguridad.js` busca el viaje en curso del pasajero para
 * meterle al mensaje de emergencia su RUTA y los DATOS DEL CONDUCTOR. Lo buscaba
 * mirando la FASE sin comprobar que el viaje estuviera vivo — y un viaje que se
 * cancela o se expira MIENTRAS ESTÁ EN MARCHA se queda con su fase pegada.
 *
 * MEDIDO contra el servidor el 11-sep-2026 (`scripts/medir-panico.cjs`):
 * 7 viajes terminados llevan una fase de viaje en marcha, y TRES DE LOS CINCO
 * pasajeros de la base cogían uno de ésos. Aprietas emergencia sin ir en ningún
 * viaje, y a tu familia le llega la placa y el teléfono de un conductor de julio.
 *
 * LOS TRES CASOS DE ABAJO SON ESOS TRES, con sus datos. Si alguien vuelve a
 * mirar la fase, se ponen rojos antes de llegar al teléfono de nadie.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer } = require('./cargar.cjs');

const { elViajeEnCurso, ESTADOS_EN_CURSO, ESTADOS_TERMINADOS, ESTADOS_MERCADO, FASES_GUARDADAS }
  = cargarDeLaApp('guajirago/src/estadosViaje.js');

describe('EL VIAJE EN CURSO · el que usa el botón de pánico', () => {
  // ── LOS TRES CASOS REALES, TAL COMO ESTÁN EN EL SERVIDOR ─────────────────
  describe('🔴 los tres pasajeros afectados, con sus datos de verdad', () => {
    it('un viaje EXPIRADO con fase «en_viaje» NO es el viaje en curso', () => {
      // KY9R6TjaMMHa6ZFsAxsn — le mandaba «PRUEBA · placa ABC145».
      const suyos = [{
        id: 'KY9R6TjaMMHa6ZFsAxsn', estado: 'expirado', fase: 'en_viaje',
        conductorId: 'c1', conductorNombre: 'PRUEBA', conductorPlaca: 'ABC145',
        conductorTelefono: '1234567890', origen: 'Cl. 16', destino: 'Jalalao',
      }];
      assert.strictEqual(elViajeEnCurso(suyos), null,
        'el botón de pánico volvió a coger un viaje EXPIRADO y le mandaría a la familia '
        + 'del pasajero la placa de un conductor de julio. Si algo pasa, buscan el carro '
        + 'que no es.');
    });

    it('un viaje CANCELADO POR EL CONDUCTOR con fase «en_punto» tampoco', () => {
      // WHLJiqNKNJWKarhyoMFP — le mandaba «ERIKA QUITIAN · placa ABC123».
      const suyos = [{
        id: 'WHLJiqNKNJWKarhyoMFP', estado: 'cancelado_conductor', fase: 'en_punto',
        conductorId: 'c2', conductorNombre: 'ERIKA QUITIAN', conductorPlaca: 'ABC123',
      }];
      assert.strictEqual(elViajeEnCurso(suyos), null,
        'el conductor canceló ese viaje y el pánico seguía dando su placa.');
    });

    it('ni un CANCELADO por el pasajero con la fase pegada', () => {
      const suyos = [{ estado: 'cancelado', fase: 'en_punto', conductorId: 'c3', conductorNombre: 'JHON' }];
      assert.strictEqual(elViajeEnCurso(suyos), null);
    });

    it('EL CASO COMPLETO · 45 viajes viejos y ninguno en curso → null', () => {
      // Así está la base del pasajero IxnJ1uHgMvMjgIU...: muchos viajes, todos
      // terminados, varios con la fase pegada. La respuesta buena es NINGUNO.
      const suyos = [];
      for (let i = 0; i < 20; i++) suyos.push({ estado: 'cancelado', fechaSolicitud: '2026-07-0' + (i % 9 + 1) });
      for (let i = 0; i < 20; i++) suyos.push({ estado: 'cancelado_conductor', fase: 'en_punto', conductorId: 'x' });
      for (let i = 0; i < 5; i++) suyos.push({ estado: 'expirado', fase: 'en_viaje', conductorId: 'x' });
      assert.strictEqual(elViajeEnCurso(suyos), null,
        'con 45 viajes terminados el pánico encontró uno «en curso». No hay ninguno.');
    });
  });

  // ── LO QUE SÍ TIENE QUE ENCONTRAR ────────────────────────────────────────
  describe('y lo que SÍ es un viaje en curso', () => {
    it('un viaje ACEPTADO, con su conductor', () => {
      const v = { id: 'vivo', estado: 'aceptado', conductorId: 'c9', conductorPlaca: 'XYZ999' };
      assert.strictEqual(elViajeEnCurso([v]), v);
    });

    it('uno aceptado que ya va EN VIAJE — la fase no lo descalifica', () => {
      const v = { id: 'vivo', estado: 'aceptado', fase: 'en_viaje', conductorId: 'c9' };
      assert.strictEqual(elViajeEnCurso([v]), v,
        'la fase dice EN QUÉ PUNTO va un viaje vivo; no puede servir para descartarlo.');
    });

    it('y uno que todavía BUSCA conductor: se encuentra, para mandar la ruta', () => {
      // Decisión del dueño (11-sep-2026): si aún no hay conductor, va la ruta y
      // nada más. Antes no se mandaba nada en este caso.
      const v = { id: 'buscando', estado: 'esperando', origen: 'Cl. 16', destino: 'Jalalao' };
      assert.strictEqual(elViajeEnCurso([v]), v);
      assert.ok(!v.conductorId, 'este caso no tiene conductor: la pantalla no debe pintar sus datos');
    });
  });

  // ── SI TUVIERA VARIOS ────────────────────────────────────────────────────
  describe('si tuviera varios en curso, se escoge a propósito', () => {
    it('EL QUE MUERDE · primero el que YA TIENE CONDUCTOR', () => {
      // En una emergencia la placa vale más que la ruta. Antes se usaba
      // `.find()`, que coge el primero que aparezca — sin ningún orden.
      const buscando = { id: 'buscando', estado: 'esperando', fechaSolicitud: '2026-09-11T10:00:00Z' };
      const conConductor = { id: 'conConductor', estado: 'aceptado', conductorId: 'c1', fechaAceptacion: '2026-09-11T09:00:00Z' };
      assert.strictEqual(elViajeEnCurso([buscando, conConductor]).id, 'conConductor',
        'se escogió el que no tiene conductor habiendo uno con conductor. En una '
        + 'emergencia, los datos del carro son lo que sirve.');
    });

    it('y de los que tienen conductor, el más reciente', () => {
      const viejo = { id: 'viejo', estado: 'aceptado', conductorId: 'c1', fechaAceptacion: '2026-09-11T08:00:00Z' };
      const nuevo = { id: 'nuevo', estado: 'aceptado', conductorId: 'c2', fechaAceptacion: '2026-09-11T11:00:00Z' };
      assert.strictEqual(elViajeEnCurso([viejo, nuevo]).id, 'nuevo');
      assert.strictEqual(elViajeEnCurso([nuevo, viejo]).id, 'nuevo',
        'el resultado cambió al cambiar el orden de la lista: sigue escogiendo al azar.');
    });
  });

  // ── LOS BORDES ───────────────────────────────────────────────────────────
  describe('los bordes', () => {
    it('sin viajes, sin lista, o con basura dentro: null y sin reventar', () => {
      assert.strictEqual(elViajeEnCurso([]), null);
      assert.strictEqual(elViajeEnCurso(null), null);
      assert.strictEqual(elViajeEnCurso(undefined), null);
      assert.strictEqual(elViajeEnCurso([null, undefined]), null);
      assert.strictEqual(elViajeEnCurso([{}]), null);
    });

    it('EL QUE MUERDE · un estado que nadie conoce NO cuenta como en curso', () => {
      // Las listas son BLANCAS a propósito. El fallo original salió de dar por
      // activo lo que no estaba en una lista. Para el pánico, equivocarse por
      // defecto es no mandar datos; por exceso es mandar los de otro viaje.
      assert.strictEqual(elViajeEnCurso([{ estado: 'algo_nuevo', conductorId: 'c1' }]), null,
        'un estado desconocido se dio por «en curso». Si mañana aparece un estado nuevo, '
        + 'hay que añadirlo a ESTADOS_EN_CURSO a propósito — no colarse solo.');
    });
  });

  // ── LAS LISTAS, CLAVADAS ─────────────────────────────────────────────────
  describe('las listas dicen lo que tienen que decir', () => {
    it('EL QUE MUERDE · un estado no puede estar en curso Y terminado', () => {
      const enLasDos = ESTADOS_EN_CURSO.filter((e) => ESTADOS_TERMINADOS.includes(e));
      assert.deepStrictEqual(enLasDos, [],
        'estos estados están en las dos listas: ' + enLasDos.join(', '));
    });

    it('EL QUE MUERDE · «en curso» se DERIVA del mercado, no se copia', () => {
      // Un viaje del MERCADO es un viaje vivo por definición. Esta prueba cazó
      // la primera versión, que llevaba la lista escrita a mano y se dejó fuera
      // `en_negociacion`. Ahora se deriva — y esto vigila que siga derivándose:
      // si alguien la vuelve a escribir a mano, se pone roja.
      const fuera = ESTADOS_MERCADO.filter((e) => !ESTADOS_EN_CURSO.includes(e));
      assert.deepStrictEqual(fuera, [],
        'estos estados del MERCADO no cuentan como «en curso»: ' + fuera.join(', ') + '\n'
        + '   Un viaje que está buscando conductor está vivo. Si se quedan fuera, el botón '
        + 'de pánico no encuentra a quien está esperando un taxi ahora mismo.');
      assert.ok(ESTADOS_EN_CURSO.includes('aceptado'),
        '`aceptado` se cayó de ESTADOS_EN_CURSO. Es el único estado vivo que NO está en el '
        + 'mercado —el viaje que ya tiene conductor—, y es justo el que lleva los datos que '
        + 'hacen falta en una emergencia.');
      assert.strictEqual(ESTADOS_EN_CURSO.length, ESTADOS_MERCADO.length + 1,
        'ESTADOS_EN_CURSO ya no es «el mercado más `aceptado`»: alguien le añadió o le '
        + 'quitó algo a mano. Si hace falta otro estado vivo, que se vea y se explique.');
      // Y SE MIRA EL TEXTO, porque comparar los CONTENIDOS no caza que alguien
      // copie la lista a mano con lo mismo dentro. El revisor lo hizo el
      // 11-sep-2026 y las 14 pruebas siguieron verdes. Una copia idéntica hoy es
      // la que mañana se queda vieja sola, sin que nada avise.
      const fuente = leer('guajirago/src/estadosViaje.js');
      assert.match(fuente, /ESTADOS_EN_CURSO = \[\.\.\.ESTADOS_MERCADO/,
        'ESTADOS_EN_CURSO dejó de DERIVARSE de ESTADOS_MERCADO: alguien la escribió a mano. '
        + 'Puede llevar lo mismo dentro hoy y separarse mañana sin que nada avise — que es '
        + 'justo lo que pasó cuando esta lista se escribió a mano la primera vez.');
    });

    it('`recogiendo` NO es una fase guardada: vive en la memoria de la app', () => {
      assert.ok(!FASES_GUARDADAS.includes('recogiendo'),
        '`recogiendo` se colό en las fases guardadas. `AppConductor.js:963` la pone con '
        + '`setFase`, en memoria, y nunca la escribe en el viaje. Buscarla en la base es '
        + 'buscar algo que no puede estar.');
    });
  });
});
