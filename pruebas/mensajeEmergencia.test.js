/**
 * PRUEBAS DEL MENSAJE DE SEGURIDAD (Ajustes · compartir ubicación)
 *
 * 🔴 NO es el botón de pánico. Ése es el 🚨 del mapa y arma su texto a mano en
 * `Solicitar.js:772`, sin pruebas y con tres silencios. Está anotado.
 *
 * No leen el código: EJECUTAN `armarMensajeDeEmergencia` y miran el TEXTO que
 * sale — el mismo que le llega al familiar por WhatsApp.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 QUÉ VINO A CERRAR ESTO · REGLA 9 DEL DUEÑO
 * ════════════════════════════════════════════════════════════════════════════
 * «Nada se rechaza en silencio.»
 *
 * `Seguridad.js` buscaba el viaje en curso dentro de un `try` con el `catch`
 * VACÍO. Si esa consulta fallaba, el mensaje salía SIN ruta y SIN conductor y
 * no lo decía.
 *
 * LA PRUEBA QUE DA SENTIDO A TODO EL ARCHIVO es «SE COMPROBÓ Y NO HAY» contra
 * «NO SE PUDO COMPROBAR»: los dos casos no tienen viaje, y el mensaje TIENE que
 * decirlos distinto. Para quien está buscando a alguien, «no iba en ningún
 * viaje» y «no se pudo comprobar» no se parecen en nada.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp } = require('./cargar.cjs');

const { armarMensajeDeEmergencia, ENCABEZADO }
  = cargarDeLaApp('guajirago/src/mensajeEmergencia.js');

const AQUI = { lat: 11.5424, lng: -72.9019 };
const UN_VIAJE = {
  origen: 'Cl. 16 # 2-9, Riohacha', destino: 'Jalalao',
  conductorId: 'c1', conductorNombre: 'ERIKA QUITIAN', conductorPlaca: 'ABC123',
  conductorColor: 'Gris', conductorVehiculo: 'Chevrolet 2023', conductorTelefono: '3001112233',
  conductorFoto: 'https://firebasestorage.googleapis.com/erika.jpg',
};

describe('EL MENSAJE DE EMERGENCIA', () => {
  // ── 🔴 LO QUE ESTE TRABAJO VINO A CERRAR ─────────────────────────────────
  describe('«no hay viaje» y «no se pudo comprobar» NO se dicen igual', () => {
    it('EL QUE MUERDE · si la consulta FALLÓ, el mensaje lo dice', () => {
      const t = armarMensajeDeEmergencia(AQUI, null, 'viaje');
      assert.match(t, /No pude comprobar los datos de mi viaje/,
        'el mensaje de emergencia se calló que no pudo leer el viaje. Quien lo recibe '
        + 'entiende que el pasajero no iba en ninguno — y puede que sí vaya. Es el fallo '
        + 'que este archivo vino a cerrar (REGLA 9).');
      // Y LA SEGUNDA FRASE, que es la que sirve de algo. Decir «no pude
      // comprobar» a secas deja al familiar mirando el teléfono sin saber qué
      // hacer; lo que convierte el aviso en algo útil es el «llámame». Sin esta
      // comprobación se podía borrar esa mitad y la prueba seguía verde.
      assert.match(t, /Puede que vaya en uno: ll[áa]mame para saberlo/,
        'el aviso dice que no pudo comprobar el viaje, pero ya no dice QUÉ HACER. Quien '
        + 'recibe el mensaje se queda con la duda y sin instrucción: el aviso solo sirve '
        + 'si le dice que llame.');
    });

    it('y si se comprobó y NO hay viaje, NO dice que falló', () => {
      const t = armarMensajeDeEmergencia(AQUI, null, null);
      assert.ok(!/No pude comprobar/.test(t),
        'el mensaje avisa de un fallo que no hubo. Si el pasajero no va en ningún viaje, '
        + 'no hay nada que avisar: meter un aviso falso hace dudar de todo el mensaje.');
      assert.ok(!/MI RUTA/.test(t), 'salió el encabezado de la ruta sin haber ruta.');
    });

    it('EL QUE MUERDE · los dos casos dan textos DISTINTOS', () => {
      // Los dos tienen `viaje = null`. Si el texto sale igual, el arreglo no
      // sirve para nada: es exactamente la confusión que había antes.
      const seComprobo = armarMensajeDeEmergencia(AQUI, null, null);
      const noSePudo = armarMensajeDeEmergencia(AQUI, null, 'viaje');
      assert.notStrictEqual(seComprobo, noSePudo,
        'los dos mensajes salen IGUALES. «Se comprobó y no hay viaje» y «no se pudo '
        + 'comprobar» tienen que leerse distinto, o el familiar no puede saber si hay un '
        + 'carro que buscar.');
    });

    it('y el aviso del fallo va ANTES de todo lo demás del viaje', () => {
      // Si el mensaje se lee a medias o se corta, lo que no se puede perder es
      // el aviso de que falta información.
      const t = armarMensajeDeEmergencia(AQUI, UN_VIAJE, 'viaje');
      assert.match(t, /No pude comprobar los datos de mi viaje/);
      assert.ok(!/ERIKA QUITIAN/.test(t),
        'con la consulta fallida se mandaron datos de conductor. Si no se pudo comprobar, '
        + 'no hay dato del que fiarse: mandar uno «por si acaso» es mandar el carro '
        + 'equivocado.');
    });
  });

  // ── LA UBICACIÓN, que ya se hacía bien y no se puede romper ──────────────
  describe('la ubicación', () => {
    it('con ubicación, va el enlace del mapa', () => {
      const t = armarMensajeDeEmergencia(AQUI, null, null);
      assert.match(t, /maps\.google\.com\/\?q=11\.5424,-72\.9019/);
    });

    it('EL QUE MUERDE · sin ubicación, el mensaje lo dice', () => {
      for (const sin of [null, undefined, {}, { lat: 1 }, { lat: 'x', lng: 'y' }]) {
        const t = armarMensajeDeEmergencia(sin, null, null);
        assert.match(t, /No pude obtener mi ubicación exacta/,
          'con ubicacion=' + JSON.stringify(sin) + ' el mensaje no avisó de que falta. '
          + 'Esto ya funcionaba antes del arreglo y no se puede perder.');
        assert.ok(!/maps\.google\.com/.test(t), 'salió un enlace de mapa sin coordenadas.');
      }
    });
  });

  // ── EL VIAJE, cuando sí se pudo leer ────────────────────────────────────
  describe('cuando el viaje se leyó bien', () => {
    // SE COMPRUEBAN TODOS LOS CAMPOS, no una muestra. La primera versión de
    // esta prueba miraba seis de ocho: se le podían borrar el ORIGEN y el COLOR
    // del carro y seguía verde. En un mensaje de emergencia el origen es de
    // donde salió la persona —por dónde empezar a buscar— y el color es la
    // mitad de cómo se reconoce un carro en la calle. Lo cazó la segunda
    // opinión del 12-sep-2026. Va recorriendo el objeto para que un campo nuevo
    // que no se enseñe también salga rojo.
    it('van la ruta y TODOS los datos del conductor, sin dejarse ninguno', () => {
      const t = armarMensajeDeEmergencia(AQUI, UN_VIAJE, null);
      assert.ok(t.includes('MI RUTA'), 'al mensaje le falta el encabezado de la ruta');
      assert.ok(t.includes('DATOS DEL CONDUCTOR'), 'al mensaje le faltan los datos del conductor');
      for (const [campo, valor] of Object.entries(UN_VIAJE)) {
        if (campo === 'conductorId') continue;   // es el interno, no se enseña
        assert.ok(t.includes(valor),
          'el mensaje de emergencia NO lleva «' + campo + '» (' + valor + '). Quien lo '
          + 'recibe se queda sin ese dato para buscar, y nada lo avisa.');
      }
    });

    it('EL QUE MUERDE · sin conductor va la ruta, y NO el encabezado del conductor', () => {
      // Decisión del dueño (11-sep-2026): si el pasajero todavía busca, va la
      // ruta y nada más. Un encabezado «DATOS DEL CONDUCTOR» vacío en un
      // mensaje de emergencia hace dudar de todo el mensaje.
      const buscando = { origen: 'Cl. 16', destino: 'Jalalao' };
      const t = armarMensajeDeEmergencia(AQUI, buscando, null);
      assert.match(t, /MI RUTA/);
      assert.match(t, /Jalalao/);
      assert.ok(!/DATOS DEL CONDUCTOR/.test(t),
        'salió el encabezado del conductor sin haber conductor.');
    });

    it('un viaje a medio llenar no mete renglones vacíos', () => {
      const t = armarMensajeDeEmergencia(AQUI, { conductorId: 'c1', conductorPlaca: 'XYZ999' }, null);
      assert.match(t, /Placa: XYZ999/);
      assert.ok(!/Nombre: *$/m.test(t), 'salió un renglón «Nombre:» sin nombre');
      assert.ok(!/Origen:/.test(t), 'salió un renglón de origen sin origen');
    });

    // ── EL QUE TAPA SIETE HUECOS DE UNA VEZ ──────────────────────────────
    //  La prueba de arriba solo cazaba el renglón VACÍO («Nombre: » y nada
    //  más). La segunda opinión del 12-sep-2026 midió otra cosa: se podía
    //  borrar el `if (...)` de SIETE de los ocho campos —destino, nombre,
    //  placa, color, vehículo, teléfono y foto— y entonces el renglón sale
    //  igual, pero con la palabra `undefined` pegada detrás. Ninguna prueba
    //  se ponía roja.
    //
    //  Y eso importa de verdad: un «👤 Nombre: undefined» en un mensaje de
    //  emergencia se lee como un error del sistema justo cuando el familiar
    //  necesita creerse lo que está leyendo. Peor que no poner el renglón.
    it('EL QUE MUERDE · nunca sale la palabra «undefined» en el mensaje', () => {
      const CASOS = [
        ['un viaje casi vacío', AQUI, { conductorId: 'c1' }, null],
        ['solo la placa', AQUI, { conductorId: 'c1', conductorPlaca: 'XYZ999' }, null],
        ['buscando, sin conductor', AQUI, { origen: 'Cl. 16' }, null],
        ['el viaje entero', AQUI, UN_VIAJE, null],
        ['sin ubicación', null, { conductorId: 'c1', conductorNombre: 'ANA' }, null],
        ['no se pudo comprobar', AQUI, null, 'viaje'],
        ['nada de nada', null, null, null],
        ['campos en blanco', AQUI, { conductorId: 'c1', conductorNombre: '', destino: '' }, null],
        // LA UBICACIÓN A MEDIAS. `getCurrentPosition` puede devolver un punto
        // con una de las dos coordenadas en nada. Con un `if (ubicacion)` a
        // secas, el enlace del mapa sale «?q=11.5,undefined» — un enlace que
        // parece bueno y no lleva a ninguna parte, que es peor que decir «no
        // pude obtener mi ubicación». Por eso se comprueban las dos.
        ['media ubicación', { lat: 11.5424, lng: undefined }, UN_VIAJE, null],
        ['ubicación en texto', { lat: '11.5424', lng: '-72.9' }, null, null],
      ];
      for (const [comoEs, ubicacion, viaje, fallo] of CASOS) {
        const t = armarMensajeDeEmergencia(ubicacion, viaje, fallo);
        assert.ok(!/undefined|null|NaN|\[object/.test(t),
          'el mensaje de emergencia lleva basura dentro con «' + comoEs + '»:\n' + t
          + '\n   A alguien que está buscando a otro alguien, un «Nombre: undefined» le dice '
          + 'que el sistema está roto — y deja de creerse el resto del mensaje.');
      }
    });
  });

  // ── LOS BORDES ──────────────────────────────────────────────────────────
  describe('los bordes', () => {
    it('el encabezado va SIEMPRE, pase lo que pase', () => {
      for (const caso of [[null, null, null], [AQUI, UN_VIAJE, null], [null, null, 'viaje']]) {
        const t = armarMensajeDeEmergencia(...caso);
        assert.ok(t.startsWith(ENCABEZADO),
          'el mensaje dejó de empezar por el encabezado: quien lo recibe no sabe de qué va.');
      }
    });

    // ── Y QUE EL ENCABEZADO DIGA ALGO ───────────────────────────────────
    //  La prueba de arriba se muerde la cola: compara el mensaje contra el
    //  MISMO `ENCABEZADO` que importa, así que si el encabezado se cambia por
    //  la palabra «GuajiraGo» a secas, las dos mitades cambian juntas y sigue
    //  verde. Lo cazó la segunda opinión del 12-sep-2026 haciendo justo eso.
    //  Este mensaje llega por WhatsApp a un familiar que no esperaba nada:
    //  tiene que decir de dónde viene Y para qué, en el primer renglón.
    it('EL QUE MUERDE · y el encabezado dice de dónde viene y para qué', () => {
      assert.match(ENCABEZADO, /GuajiraGo/,
        'el encabezado ya no nombra a GuajiraGo: quien lo recibe no sabe de dónde le llega '
        + 'este mensaje ni si creérselo.');
      assert.match(ENCABEZADO, /d[óo]nde estoy|mi ubicaci[óo]n|emergencia/i,
        'el encabezado ya no dice PARA QUÉ es el mensaje. Un familiar que recibe un enlace '
        + 'de mapa sin explicación no sabe si es una emergencia o alguien compartiendo un '
        + 'sitio. El primer renglón es el único que se lee seguro.');
      assert.ok(ENCABEZADO.length >= 30,
        'el encabezado se quedó en ' + ENCABEZADO.length + ' letras. Es el renglón que '
        + 'explica el mensaje entero; no caben ni el nombre ni el motivo.');
    });

    it('sin nada de nada, el mensaje sigue sirviendo', () => {
      const t = armarMensajeDeEmergencia(null, null, null);
      assert.ok(t.length > 40, 'el mensaje se quedó en nada');
      assert.match(t, /GuajiraGo/);
      assert.match(t, /No pude obtener mi ubicación/);
    });
  });
});
