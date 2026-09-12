/**
 * PRUEBAS DEL MENSAJE DE EMERGENCIA · LOS DOS BOTONES
 *
 * Desde el 12-sep-2026 hay UN solo texto para los dos (SEGUNDA LEY), y estas
 * pruebas cubren los dos:
 *   · `desde: 'ajustes'` — el «compartir mi ubicación» de la pantalla de
 *     Seguridad, preventivo, antes de salir.
 *   · `desde: 'enViaje'` — el 🚨 rojo que flota sobre el mapa DURANTE el viaje.
 *     Éste armaba su propio texto a mano dentro de `Solicitar.js` y no tenía ni
 *     una prueba; era el que de verdad se aprieta.
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

const { armarMensajeDeEmergencia, ENCABEZADOS }
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
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: null, fallo: 'viaje' });
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
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: null, fallo: null });
      assert.ok(!/No pude comprobar/.test(t),
        'el mensaje avisa de un fallo que no hubo. Si el pasajero no va en ningún viaje, '
        + 'no hay nada que avisar: meter un aviso falso hace dudar de todo el mensaje.');
      assert.ok(!/MI RUTA/.test(t), 'salió el encabezado de la ruta sin haber ruta.');
    });

    it('EL QUE MUERDE · los dos casos dan textos DISTINTOS', () => {
      // Los dos tienen `viaje = null`. Si el texto sale igual, el arreglo no
      // sirve para nada: es exactamente la confusión que había antes.
      const seComprobo = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: null, fallo: null });
      const noSePudo = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: null, fallo: 'viaje' });
      assert.notStrictEqual(seComprobo, noSePudo,
        'los dos mensajes salen IGUALES. «Se comprobó y no hay viaje» y «no se pudo '
        + 'comprobar» tienen que leerse distinto, o el familiar no puede saber si hay un '
        + 'carro que buscar.');
    });

    it('y el aviso del fallo va ANTES de todo lo demás del viaje', () => {
      // Si el mensaje se lee a medias o se corta, lo que no se puede perder es
      // el aviso de que falta información.
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: UN_VIAJE, fallo: 'viaje' });
      assert.match(t, /No pude comprobar los datos de mi viaje/);
      assert.ok(!/ERIKA QUITIAN/.test(t),
        'con la consulta fallida se mandaron datos de conductor. Si no se pudo comprobar, '
        + 'no hay dato del que fiarse: mandar uno «por si acaso» es mandar el carro '
        + 'equivocado.');
    });
  });

  // ── 🔴 EL BOTÓN DEL MAPA · LO QUE VINO A CERRAR EL SEGUNDO ARREGLO ───────
  //  El 🚨 del mapa mandaba el CENTRO DE RIOHACHA como «mi ubicación» cuando
  //  el GPS no se conseguía, porque la pantalla mete ese relleno para poder
  //  dibujar el mapa y el botón no sabía distinguirlo de un GPS de verdad.
  //  Medido: 4 de los 91 viajes nacieron con ese relleno.
  //
  //  Un silencio y una mentira no son lo mismo: con un silencio el familiar
  //  sabe que no sabe; con esto se iba a la plaza a buscar a alguien que podía
  //  estar en cualquier otro sitio.
  //
  //  QUIÉN DECIDE si es de verdad es la pantalla (`ubicacionEsDelGps`), y lo
  //  que se prueba aquí es el trato: si llega `null`, el mensaje lo DICE y no
  //  se inventa ningún punto. El amarre de `pruebas/amarres.test.js` vigila que
  //  la pantalla siga pasando `null` con el relleno.
  describe('el botón del MAPA no se inventa dónde estás', () => {
    const PLAZA = { lat: 11.5444, lng: -72.9072 };   // el relleno de riohacha.js

    it('EL QUE MUERDE · sin GPS dice que no lo pudo conseguir, y NO manda un punto', () => {
      const t = armarMensajeDeEmergencia({
        desde: 'enViaje', ubicacion: null, viaje: UN_VIAJE, fallo: null,
      });
      assert.match(t, /No pude obtener mi ubicación exacta/,
        'el mensaje del botón del mapa no avisa de que no tiene la ubicación. Antes '
        + 'mandaba la plaza de Riohacha como si fuera cierta.');
      assert.ok(!/maps\.google\.com/.test(t),
        'salió un enlace de mapa sin tener ubicación. Un enlace que parece bueno y lleva '
        + 'al sitio equivocado es peor que no poner ninguno: la familia va allí.');
      assert.ok(!t.includes('11.5444') && !t.includes('-72.9072'),
        'el mensaje lleva las coordenadas de la plaza de Riohacha dentro. Ése es el '
        + 'relleno del mapa, no el sitio de nadie.');
      // Y lo que sí tiene que seguir yendo: el viaje y el conductor.
      assert.match(t, /Jalalao/, 'sin GPS se perdió también la ruta, que sí se sabía.');
      assert.match(t, /ABC123/, 'sin GPS se perdió la placa, que sí se sabía.');
    });

    it('y con GPS de verdad manda el enlace, como siempre', () => {
      const t = armarMensajeDeEmergencia({
        desde: 'enViaje', ubicacion: PLAZA, viaje: UN_VIAJE, fallo: null,
      });
      // Aquí se le pasa la plaza A PROPÓSITO: si alguien de verdad está en la
      // plaza, su ubicación es la plaza y el mensaje la manda. Lo que no puede
      // pasar es que la mande cuando NO se sabe. La diferencia no la hacen las
      // coordenadas: la hace quien las pasa.
      assert.match(t, /maps\.google\.com\/\?q=11\.5444,-72\.9072/,
        'con una ubicación de verdad el mensaje dejó de mandar el enlace del mapa. '
        + 'Estando en la plaza, la plaza es la respuesta buena.');
      assert.ok(!/No pude obtener/.test(t), 'avisa de que no tiene ubicación teniéndola.');
    });

    // ── NINGÚN ENCABEZADO PELADO, PASE LO QUE PASE ─────────────────────
    //  Decisión del dueño (11-sep-2026): un encabezado vacío en un mensaje de
    //  emergencia hace dudar de todo el mensaje. Se comprobaba solo el del
    //  conductor; la segunda opinión midió que con un viaje a medias —un
    //  `{conductorId: 'x'}` y nada más— salían LOS DOS pelados.
    it('EL QUE MUERDE · ningún encabezado sale sin nada debajo', () => {
      const MEDIAS = [
        ['solo el id del conductor', { conductorId: 'x' }],
        ['un viaje sin nada', {}],
        ['ruta sí, conductor a medias', { origen: 'Cl. 16', conductorId: 'x' }],
        ['conductor sí, ruta no', { conductorId: 'x', conductorPlaca: 'ABC123' }],
      ];
      for (const [comoEs, viaje] of MEDIAS) {
        for (const desde of ['ajustes', 'enViaje']) {
          const t = armarMensajeDeEmergencia({ desde, ubicacion: AQUI, viaje, fallo: null });
          for (const cabeza of ['MI RUTA', 'DATOS DEL CONDUCTOR']) {
            const i = t.indexOf(cabeza);
            if (i < 0) continue;                       // no salió: perfecto
            const debajo = t.slice(i + cabeza.length).replace(/[\s*]/g, '');
            assert.ok(debajo.length > 0,
              'con «' + comoEs + '» (' + desde + ') salió el encabezado «' + cabeza + '» y '
              + 'debajo NO HAY NADA:\n' + t + '\n   Un encabezado pelado en un mensaje de '
              + 'emergencia hace dudar de todo el mensaje — lo decidió el dueño.');
          }
        }
      }
    });

    it('EL QUE MUERDE · «MI RUTA» no sale si no hay viaje', () => {
      // El texto viejo del mapa pegaba el encabezado de la ruta SIEMPRE, aunque
      // debajo no fuera nada. Un encabezado vacío en un mensaje de emergencia
      // hace dudar de todo el mensaje.
      const t = armarMensajeDeEmergencia({
        desde: 'enViaje', ubicacion: PLAZA, viaje: null, fallo: null,
      });
      assert.ok(!/MI RUTA/.test(t), 'salió el encabezado de la ruta sin haber ruta.');
      assert.ok(!/DATOS DEL CONDUCTOR/.test(t), 'salió el encabezado del conductor sin conductor.');
    });
  });

  // ── LA UBICACIÓN, que ya se hacía bien y no se puede romper ──────────────
  describe('la ubicación', () => {
    it('con ubicación, va el enlace del mapa', () => {
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: null, fallo: null });
      assert.match(t, /maps\.google\.com\/\?q=11\.5424,-72\.9019/);
    });

    it('EL QUE MUERDE · sin ubicación, el mensaje lo dice', () => {
      // `{lat: NaN}` está aquí a propósito: `typeof NaN === 'number'`, así que
      // la primera versión del filtro lo daba por bueno y mandaba
      // «?q=NaN,NaN». Es lo que sale de un `parseFloat` fallido, y es el caso
      // más fácil de tener sin darse cuenta. Lo cazó la segunda opinión.
      for (const sin of [null, undefined, {}, { lat: 1 }, { lat: 'x', lng: 'y' },
        { lat: NaN, lng: NaN }, { lat: 11.5, lng: NaN }, { lat: Infinity, lng: 0 }]) {
        const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: sin, viaje: null, fallo: null });
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
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: UN_VIAJE, fallo: null });
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
      // 🔴 EL VIAJE LLEVA DATOS DE CONDUCTOR A PROPÓSITO, PERO NO `conductorId`.
      //    Con un viaje pelado esta prueba se volvió ciega: desde que ningún
      //    encabezado sale vacío, quitar el `if (viaje.conductorId)` ya no
      //    cambiaba nada —el bloque salía vacío y se suprimía solo— y el
      //    sabotaje sobrevivía. Así se distingue de verdad quién decide: si se
      //    deja de mirar `conductorId`, estos datos se cuelan en el mensaje.
      const buscando = {
        origen: 'Cl. 16', destino: 'Jalalao',
        conductorNombre: 'ALGUIEN QUE NO CONFIRMÓ', conductorPlaca: 'ZZZ000',
      };
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: buscando, fallo: null });
      assert.match(t, /MI RUTA/);
      assert.match(t, /Jalalao/);
      assert.ok(!/ZZZ000|ALGUIEN QUE NO CONFIRM/.test(t),
        'salieron datos de un conductor que NO ha confirmado el viaje (no hay `conductorId`). '
        + 'Al familiar le llega la placa de un carro que a lo mejor nunca llegó: es mandarle '
        + 'a buscar el carro equivocado.');
      assert.ok(!/DATOS DEL CONDUCTOR/.test(t),
        'salió el encabezado del conductor sin haber conductor.');
    });

    it('un viaje a medio llenar no mete renglones vacíos', () => {
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: AQUI, viaje: { conductorId: 'c1', conductorPlaca: 'XYZ999' }, fallo: null });
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
        const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: ubicacion, viaje: viaje, fallo: fallo });
        assert.ok(!/undefined|null|NaN|\[object/.test(t),
          'el mensaje de emergencia lleva basura dentro con «' + comoEs + '»:\n' + t
          + '\n   A alguien que está buscando a otro alguien, un «Nombre: undefined» le dice '
          + 'que el sistema está roto — y deja de creerse el resto del mensaje.');
      }
    });
  });

  // ── LOS BORDES ──────────────────────────────────────────────────────────
  describe('los bordes', () => {
    it('el encabezado va SIEMPRE, pase lo que pase, y el de CADA botón', () => {
      const CASOS = [
        { ubicacion: null, viaje: null, fallo: null },
        { ubicacion: AQUI, viaje: UN_VIAJE, fallo: null },
        { ubicacion: null, viaje: null, fallo: 'viaje' },
      ];
      for (const desde of ['ajustes', 'enViaje']) {
        for (const caso of CASOS) {
          const t = armarMensajeDeEmergencia({ desde, ...caso });
          assert.ok(t.startsWith(ENCABEZADOS[desde]),
            'el mensaje de «' + desde + '» dejó de empezar por SU encabezado: quien lo '
            + 'recibe no sabe de qué va, o le llega el encabezado del otro botón.');
        }
      }
    });

    // ── SI EL NOMBRE DEL BOTÓN LLEGA MAL, NO SE QUEDA SIN MENSAJE ───────
    //  Se tira hacia el lado urgente a propósito. Un encabezado más alarmante
    //  de lo que tocaba es un susto; quedarse sin mensaje en una emergencia es
    //  otra cosa. Esto fija esa decisión para que nadie la cambie sin verla.
    it('con un `desde` desconocido usa el de EMERGENCIA, no se queda en nada', () => {
      for (const malo of [undefined, null, '', 'otro', 'AJUSTES', 123]) {
        const t = armarMensajeDeEmergencia({ desde: malo, ubicacion: AQUI, viaje: UN_VIAJE, fallo: null });
        assert.ok(t.startsWith(ENCABEZADOS.enViaje),
          'con desde=' + JSON.stringify(malo) + ' el mensaje no empieza por el encabezado '
          + 'de emergencia. Si el nombre llega mal, el mensaje tiene que salir IGUAL: lo '
          + 'que no puede pasar es que en una emergencia no salga nada.');
        assert.match(t, /Jalalao/, 'y con el nombre malo se perdió el resto del mensaje.');
      }
    });

    // ── Y LOS DOS ENCABEZADOS SON DISTINTOS ────────────────────────────
    //  Si alguien los deja iguales, el de Ajustes diría EMERGENCIA —o al
    //  contrario, el del viaje diría «quiero que sepas dónde estoy», que suena
    //  a nada cuando algo está pasando de verdad.
    it('los dos encabezados NO dicen lo mismo, y el del viaje suena a emergencia', () => {
      assert.notStrictEqual(ENCABEZADOS.ajustes, ENCABEZADOS.enViaje,
        'los dos encabezados quedaron iguales. Uno se usa antes de salir, de forma '
        + 'preventiva, y el otro cuando algo está pasando: no pueden sonar igual.');
      assert.match(ENCABEZADOS.enViaje, /EMERGENCIA/,
        'el encabezado del botón del mapa dejó de decir EMERGENCIA. Es el que se aprieta '
        + 'durante el viaje: la primera línea es lo único que se lee seguro.');
      assert.match(ENCABEZADOS.enViaje, /viaje/i,
        'el encabezado del mapa ya no dice que va en un viaje, que es el dato que hace '
        + 'que el familiar sepa qué está pasando.');
    });

    // ── Y QUE EL ENCABEZADO DIGA ALGO ───────────────────────────────────
    //  La prueba de arriba se muerde la cola: compara el mensaje contra el
    //  MISMO encabezado que importa, así que si se cambia por la palabra
    //  «GuajiraGo» a secas, las dos mitades cambian juntas y sigue verde. Lo
    //  cazó la segunda opinión del 12-sep-2026 haciendo justo eso.
    //  Este mensaje llega por WhatsApp a un familiar que no esperaba nada:
    //  tiene que decir de dónde viene Y para qué, en el primer renglón.
    //
    //  SE MIRAN LOS DOS. La primera versión de esto miraba uno solo, y al
    //  juntar los botones el del mapa se habría quedado sin vigilancia.
    it('EL QUE MUERDE · los dos encabezados dicen de dónde vienen y para qué', () => {
      for (const [cual, encabezado] of Object.entries(ENCABEZADOS)) {
        assert.match(encabezado, /GuajiraGo/,
          'el encabezado de «' + cual + '» ya no nombra a GuajiraGo: quien lo recibe no '
          + 'sabe de dónde le llega este mensaje ni si creérselo.');
        assert.match(encabezado, /d[óo]nde estoy|mi ubicaci[óo]n|emergencia/i,
          'el encabezado de «' + cual + '» ya no dice PARA QUÉ es el mensaje. Un familiar '
          + 'que recibe un enlace de mapa sin explicación no sabe si es una emergencia o '
          + 'alguien compartiendo un sitio. El primer renglón es el único que se lee seguro.');
        assert.ok(encabezado.length >= 30,
          'el encabezado de «' + cual + '» se quedó en ' + encabezado.length + ' letras. Es '
          + 'el renglón que explica el mensaje entero; no caben ni el nombre ni el motivo.');
      }
    });

    it('sin nada de nada, el mensaje sigue sirviendo', () => {
      const t = armarMensajeDeEmergencia({ desde: 'ajustes', ubicacion: null, viaje: null, fallo: null });
      assert.ok(t.length > 40, 'el mensaje se quedó en nada');
      assert.match(t, /GuajiraGo/);
      assert.match(t, /No pude obtener mi ubicación/);
    });
  });
});
