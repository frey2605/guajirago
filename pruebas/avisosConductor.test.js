/**
 * REGLA 9 EN LA APP DEL CONDUCTOR · EL VIAJE QUE NO CONSTA
 *
 * Palabras del dueño: «Nada se rechaza en silencio.»
 *
 * Medido el 4-sep-2026 leyendo los tres repos: la app del pasajero y conductor
 * tenía 57 escrituras que no le decían NADA a nadie si el servidor las rechazaba,
 * y DIECISÉIS estaban en AppConductor.js. Este arreglo cierra las SEIS que deciden
 * si un viaje existe, empieza, termina y se cobra:
 *
 *   ofertar · «ya llegué» · «arrancamos» · cancelar · terminar · soltar el viaje
 *
 * Y no es cosmético. Se careó contra el código de las otras pantallas:
 *   · `conductorEnPunto` es lo que escucha el pasajero para ver «tu conductor
 *     llegó» (Solicitar.js:618). Si falla callado, el conductor está en la puerta
 *     y el pasajero sigue esperando dentro.
 *   · `fase: 'en_viaje'` es lo que le pasa a la pantalla del viaje en marcha
 *     (Solicitar.js:627) y lo que el panel enseña como «En viaje»
 *     (admin/Viajes.js:63).
 *
 * ── LO QUE ESTE ARREGLO NO CIERRA ──────────────────────────────────────────
 * Quedan las del lado del PASAJERO —Solicitar.js y SolicitarMensajeria.js, los
 * gemelos—, la llamada, el pedido de comida, los chats y los menores. Y DOS de
 * este mismo archivo que la segunda opinión encontró y no estaban en la lista:
 *   · r649  retirar tus propias ofertas cuando gana otro conductor
 *   · r855  APAGARSE para dejar de recibir viajes — el conductor cree que se
 *           desconectó y puede no haberse desconectado
 * Quedan fuera A PROPÓSITO el GPS (se dispara a cada segundo) y los chats.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  leer, soloCodigo, sinTextos, cuerpoDelCatch, cuerpoDeLaFuncion,
  dentroDeTry, catchPropioDe,
} = require('./cargar.cjs');

const APP = 'guajirago/src/AppConductor.js';

// Los cuatro que viven en una función con nombre y llevan try/catch.
// El tercer campo dice si su catch TIENE QUE CORTAR: los que limpian la pantalla
// detrás no pueden seguir adelante si la escritura no entró.
const CON_NOMBRE = [
  ['llegueAlPunto', 'avisar que llegaste', true],
  ['iniciarViaje', 'iniciar el viaje', true],
  ['cancelarViaje', 'cancelar el viaje', true],
  ['cerrarViajeFinal', 'cerrar el viaje', true],
];

// Los que van disparados sin esperar y se protegen con su propio `.catch`.
// El tercer campo es CÓMO enseñan el aviso: los de dentro del componente con
// `setAviso`, y la tarjeta de solicitudes —que es otro componente— por su prop.
const CON_CATCH_PROPIO = [
  ["setDoc(doc(db, 'viajes', idViaje, 'contraofertas', user.uid)", 1, 'enviar tu oferta', 'onAviso'],
  ["setDoc(doc(db, 'conductores', user.uid), { ocupado: false, enViajeId: null }", 3, 'liberarte para recibir viajes', 'setAviso'],
];

describe('REGLA 9 · los botones del viaje del conductor ya no fallan en silencio', () => {
  for (const [fn, accion, tieneQueCortar] of CON_NOMBRE) {
    it('EL QUE MUERDE · «' + accion + '» avisa si el servidor dice que no', () => {
      const t = soloCodigo(leer(APP));
      const i = t.search(new RegExp('const ' + fn + '\\s*=\\s*(?:async\\s*)?\\('));
      assert.ok(i >= 0, 'no encontré la función ' + fn + ' en ' + APP);
      const fnCuerpo = cuerpoDeLaFuncion(t, i);
      const cuerpo = cuerpoDelCatch(t, i);
      assert.ok(cuerpo !== null, fn + '(): ya no tiene catch. La escritura vuelve a '
        + 'perderse en el aire.');

      // ── QUE LA ESCRITURA SE ESPERE ────────────────────────────────────────
      // Sin `await`, la promesa se rechaza sola y el catch NO SE ENTERA: el try y
      // el catch se quedan de adorno y volvemos al silencio. Lo demostró la
      // segunda opinión quitando el await con las 13 pruebas en verde. Es el
      // mutante más barato que existe contra este arreglo.
      // Sólo se le exige `await` a las que dependen de ESTE try. Las que llevan su
      // propio `.catch` van disparadas a propósito —convertirlas en `await` dejaría
      // la pantalla esperando a la red antes de limpiarse— y se comprueban aparte.
      for (const m of fnCuerpo.texto.matchAll(/(?:setDoc|updateDoc|addDoc|deleteDoc)\s*\(/g)) {
        const propio = catchPropioDe(fnCuerpo.texto, m.index);
        if (propio && propio.trim()) continue;
        const delante = fnCuerpo.texto.slice(Math.max(0, m.index - 10), m.index);
        if (!/\.\s*$/.test(delante) && !/await\s+$/.test(delante)) {
          assert.fail(fn + '(): hay una escritura SIN `await` y sin `.catch` propio '
            + '(renglón ' + fnCuerpo.texto.slice(0, m.index).split('\n').length
            + ' de la función). El catch no se entera de que falló: la promesa se '
            + 'rechaza sola y el aviso no sale nunca.');
        }
      }

      assert.ok(/apuntarRechazo\s*\(/.test(cuerpo),
        fn + '(): el catch no deja rastro del rechazo');
      assert.ok(/setAviso\s*\(\s*motivoDeRechazo/.test(cuerpo),
        fn + '(): no le dice NADA al conductor. Calcular el motivo y no enseñarlo es '
        + 'lo mismo que tragárselo.');
      assert.ok(!/setAviso\s*\(\s*null\s*\)/.test(cuerpo) && !/setAviso\s*\(\s*''\s*\)/.test(cuerpo),
        fn + '(): pone el aviso y lo borra en el mismo catch. Se ve igual que no avisar.');

      // ── EL QUE DE VERDAD IMPORTA ──────────────────────────────────────────
      // `cerrarViajeFinal` y `cancelarViaje` LIMPIAN LA PANTALLA detrás del try.
      // Si el catch no corta, la limpieza corre igual: el viaje no consta en el
      // servidor, el conductor ya no lo tiene delante, y NO HAY FORMA DE
      // REINTENTAR. Eso pasaba hasta el 5-sep-2026 y es la razón de todo esto.
      //
      // EL `return` TIENE QUE SER LO ÚLTIMO. La primera versión pedía sólo que
      // hubiera un `return` en alguna parte del catch: la segunda opinión lo puso
      // ANTES del aviso (corta bien, no dice nada) y dentro de una función suelta
      // que no cortaba nada, y las dos veces la prueba siguió verde.
      if (tieneQueCortar) {
        // Y QUE LA PANTALLA NO HAYA AVANZADO YA. La segunda opinión movió el
        // `setFase(...)` DELANTE del try: el catch avisaba, cortaba, y la pantalla
        // avanzaba igual — el conductor veía «no se pudo» sobre una pantalla que ya
        // decía que sí. Cortar después de haber avanzado no sirve de nada.
        const hastaElTry = fnCuerpo.texto.slice(0, fnCuerpo.texto.indexOf('try {'));
        assert.ok(!/setFase\s*\(/.test(hastaElTry),
          fn + '(): la pantalla avanza (`setFase`) ANTES del try. Si la escritura '
          + 'falla, el aviso sale pero la pantalla ya cambió: el conductor ve «no se '
          + 'pudo» encima de una pantalla que dice que sí se pudo.');

        const limpio = cuerpo.trim().replace(/;\s*$/, '');
        assert.ok(/\breturn\b\s*$/.test(limpio),
          fn + '(): el catch no termina en `return`. La limpieza de después va a '
          + 'correr igual: el viaje se queda colgado en el servidor, desaparece de '
          + 'la pantalla y el conductor no puede volver a intentarlo.');
      }
    });
  }

  for (const [ancla, veces, accion, comoAvisa] of CON_CATCH_PROPIO) {
    it('EL QUE MUERDE · «' + accion + '» avisa si el servidor dice que no', () => {
      const t = soloCodigo(leer(APP));
      assert.strictEqual(t.split(ancla).length - 1, veces,
        'la escritura de «' + accion + '» sale ' + (t.split(ancla).length - 1)
        + ' veces y se esperaban ' + veces + '. O se copió otra vez —y hay una copia '
        + 'sin comprobar— o cambió el código y esta prueba mira al vacío.');

      let desde = 0;
      for (let n = 0; n < veces; n += 1) {
        const pos = t.indexOf(ancla, desde);
        desde = pos + ancla.length;
        const donde = accion + ' (copia ' + (n + 1) + ' de ' + veces + ', renglón '
          + t.slice(0, pos).split('\n').length + ')';

        const manejador = catchPropioDe(t, pos);
        assert.ok(manejador && manejador.trim(),
          donde + ': la escritura no lleva `.catch` con nada dentro. Un '
          + '`.catch(() => {})` es tragarse el fallo con otra cara.');

        assert.ok(/apuntarRechazo\s*\(/.test(manejador), donde + ': no deja rastro');
        // ── QUE EL MOTIVO SE ENSEÑE, no solo que se calcule ────────────────
        // La primera versión sólo miraba que apareciera la palabra
        // `motivoDeRechazo`. La segunda opinión borró la llamada que lo PINTA y
        // dejó el cálculo: verde. Calcular el motivo y no enseñarlo es
        // exactamente lo mismo que tragárselo.
        const re = new RegExp(comoAvisa + '\\s*\\(\\s*motivoDeRechazo');
        assert.ok(re.test(manejador),
          donde + ': saca el motivo pero no lo enseña (no hay `' + comoAvisa
          + '(motivoDeRechazo…)`). Calcularlo y no pintarlo es tragárselo.');
      }
    });
  }

  it('EL QUE MUERDE · la oferta rechazada deshace el «oferta enviada»', () => {
    // Si la contraoferta no entra pero la tarjeta se queda diciendo «enviada», el
    // conductor espera una respuesta a algo que el pasajero nunca vio.
    const t = soloCodigo(leer(APP));
    const pos = t.indexOf("setDoc(doc(db, 'viajes', idViaje, 'contraofertas', user.uid)");
    const manejador = catchPropioDe(t, pos);
    assert.ok(/setOfertaEnviada\s*\(\s*null\s*\)/.test(manejador || ''),
      'la oferta falló pero la tarjeta sigue diciendo «oferta enviada».');
  });

  it('EL QUE MUERDE · el motivo sale del mismo archivo que en las otras dos apps', () => {
    const t = soloCodigo(leer(APP));
    assert.ok(/from '\.\/avisoRechazo'/.test(t),
      APP + ' no saca el motivo del archivo compartido: se lo está escribiendo. '
      + 'Dos redacciones del mismo mensaje se separan (SEGUNDA LEY).');
  });

  // ── Y QUE NO NAZCA UN SÉPTIMO BOTÓN MUDO ─────────────────────────────────
  // La lista de arriba está escrita a mano y no dice nada del botón siguiente. La
  // segunda opinión metió uno nuevo, `await updateDoc(...)` sin catch, y las 13
  // pruebas siguieron verdes. Esta es la pregunta en negativo.
  it('EL QUE MUERDE · no nace ninguna escritura muda nueva en el archivo', () => {
    const t = soloCodigo(leer(APP));
    const seguro = sinTextos(t);
    // Las que YA estaban mudas antes de este arreglo y quedaron fuera del alcance,
    // dichas por su ancla para que la cuenta no dependa del número de renglón.
    const FUERA = [
      "'contraofertas', miId), { vigente: false }",     // retirar mis ofertas (r649)
      "{ activo: false, nombre: nombre || '' }",         // apagarse (r855)
    ];
    const mudas = [];
    for (const m of t.matchAll(/(?:setDoc|updateDoc|addDoc|deleteDoc)\s*\(/g)) {
      if (dentroDeTry(seguro, m.index)) continue;
      const manejador = catchPropioDe(t, m.index);
      if (manejador && manejador.trim()) continue;
      const trozo = t.slice(m.index, m.index + 220);
      if (FUERA.some((x) => trozo.includes(x))) continue;
      mudas.push('renglón ' + t.slice(0, m.index).split('\n').length);
    }
    assert.deepStrictEqual(mudas, [],
      'hay ' + mudas.length + ' escritura(s) nuevas que se tragan el fallo ('
      + mudas.join(', ') + '). Un botón que guarda algo y no dice si no pudo es '
      + 'justo lo que este arreglo vino a cerrar.');
  });
});

// ── QUE EL AVISO SE VEA. LA TRAMPA QUE YA MORDIÓ TRES VECES ────────────────
// Archivo correcto, PANTALLA equivocada. Pasó en admin/Restaurantes.js, en
// admin/App.js, y aquí: AppConductor.js tiene CUATRO salidas de pantalla y la
// ventanita sólo estaba en DOS. Ofertar y soltar el viaje vivían en las otras dos.
describe('REGLA 9 · la ventanita se ve en TODAS las pantallas del conductor', () => {
  const jsxDelReturn = (codigo, pos) => {
    const seguro = sinTextos(codigo);
    const abre = seguro.indexOf('(', pos);
    if (abre < 0) return '';
    let i = abre + 1;
    let hondo = 1;
    while (i < seguro.length && hondo > 0) {
      if (seguro[i] === '(') hondo += 1;
      else if (seguro[i] === ')') hondo -= 1;
      i += 1;
    }
    return codigo.slice(abre + 1, i - 1);
  };

  it('EL QUE MUERDE · las CUATRO pantallas del conductor pintan la ventanita', () => {
    const t = soloCodigo(leer(APP));
    const comp = cuerpoDeLaFuncion(t, t.search(/^function AppConductor\s*\(/m));
    assert.ok(comp, 'no reconocí el componente AppConductor');
    const cuerpo = t.slice(comp.ini, comp.fin);

    const returns = [...cuerpo.matchAll(/^ {2,4}return \($/gm)];
    assert.ok(returns.length >= 4,
      'esperaba al menos las cuatro pantallas del conductor y encontré '
      + returns.length + '. O se quitó una, o cambió la forma de escribirlas y esta '
      + 'prueba dejó de verlas.');

    const sinVentanita = [];
    for (const m of returns) {
      const jsx = jsxDelReturn(cuerpo, m.index);
      if (!/<AvisoModal /.test(jsx)) {
        sinVentanita.push('renglón ' + t.slice(0, comp.ini + m.index).split('\n').length);
      }
    }
    assert.deepStrictEqual(sinVentanita, [],
      'hay ' + sinVentanita.length + ' pantalla(s) del conductor SIN la ventanita ('
      + sinVentanita.join(', ') + '). Un aviso en una pantalla que no se está '
      + 'enseñando no se ve nunca — y es la tercera vez que muerde lo mismo.');
  });

  it('EL QUE MUERDE · se pinta SIEMPRE que hay aviso, sin condiciones de más', () => {
    // NO se mira sólo el renglón del `<AvisoModal`: la segunda opinión metió el
    // envoltorio `{activo && (` en el renglón DE ARRIBA y la comprobación, que
    // buscaba la llave en la misma línea, se saltó el caso EN SILENCIO. Ahora se
    // cuentan las llaves de JSX que quedan abiertas desde que abre el return.
    const t = soloCodigo(leer(APP));
    const seguro = sinTextos(t);
    const comp = cuerpoDeLaFuncion(t, t.search(/^function AppConductor\s*\(/m));
    const cuerpo = seguro.slice(comp.ini, comp.fin);

    for (const m of cuerpo.matchAll(/<AvisoModal /g)) {
      const antes = [...cuerpo.slice(0, m.index).matchAll(/^ {2,4}return \($/gm)];
      assert.ok(antes.length > 0, 'la ventanita no está dentro de ningún return');
      const abre = antes[antes.length - 1].index;
      let hondo = 0;
      for (let i = abre; i < m.index; i += 1) {
        if (cuerpo[i] === '{') hondo += 1;
        else if (cuerpo[i] === '}') hondo -= 1;
      }
      assert.strictEqual(hondo, 0,
        'la ventanita está METIDA DENTRO de otra cosa (quedan ' + hondo + ' llave(s) '
        + 'sin cerrar antes de ella, renglón '
        + t.slice(0, comp.ini + m.index).split('\n').length + '). Sólo se vería '
        + 'cuando esa otra cosa se esté pintando, y eso es casi nunca.');
    }
  });

  it('EL QUE MUERDE · la ventanita va por ENCIMA de todo lo demás de la app', () => {
    // Aquí hay modales a 9998 —el del código de descuento entre ellos— y el aviso
    // se pinta ANTES que ellos en el árbol: a igual zIndex ganaría el otro. Con
    // «Omitir» en el código de descuento eso dejaba el aviso TAPADO. Lo midió la
    // segunda opinión sobre el arreglo a medio hacer.
    const modal = leer('guajirago/src/AvisoModal.js');
    const suyo = Number((/zIndex:\s*(\d+)/.exec(modal) || [])[1]);
    assert.ok(suyo > 0, 'la ventanita no declara zIndex');
    const t = soloCodigo(leer(APP));

    // NO valen TODOS los zIndex del archivo: los de 99999 y 999999 son pantallas
    // enteras que sustituyen a la del viaje —«CUENTA SANCIONADA», la celebración—
    // y nunca coinciden con el aviso. Lo que importa son los modales que SÍ pueden
    // estar abiertos a la vez. Se comprueban por su nombre de estado, uno a uno,
    // porque una lista escrita a mano es honesta y un barrido ciego no lo sería.
    //
    // «ANTES DE FINALIZAR» (el código de descuento) es el caso que mordió: está a
    // 99999, se llega al aviso desde su botón «Omitir», y por eso el arreglo lo
    // CIERRA antes de avisar. Aquí se comprueba que ese cierre siga estando.
    const i = t.search(/const cerrarViajeFinal\s*=/);
    const cuerpo = cuerpoDelCatch(t, i);
    assert.ok(/setMostrarCodigoDescuento\s*\(\s*false\s*\)/.test(cuerpo),
      'el catch de cerrarViajeFinal ya no cierra el modal del código de descuento. '
      + 'Ese modal está a zIndex 99999 y la ventanita a ' + suyo + ': si se queda '
      + 'abierto, TAPA el aviso. El conductor toca «Omitir», falla, y no ve nada.');

    // Y que no nazca otro modal por encima en las pantallas del viaje.
    for (const m of t.matchAll(/zIndex:\s*(\d+)/g)) {
      const z = Number(m[1]);
      if (z >= 99999) continue; // pantallas enteras, no coinciden con el aviso
      assert.ok(suyo > z,
        'AppConductor.js tiene algo a zIndex ' + z + ' y la ventanita está a '
        + suyo + ': el aviso puede salir TAPADO, que se ve igual que no salir.');
    }
  });

  it('EL QUE MUERDE · la tarjeta de solicitudes puede avisar (vive fuera del componente)', () => {
    const t = soloCodigo(leer(APP));
    assert.ok(/function TarjetaSolicitud\(\{[^}]*\bonAviso\b/.test(t),
      'TarjetaSolicitud ya no recibe `onAviso`: la oferta que el servidor rechaza '
      + 'no tiene por dónde decirlo.');
    assert.ok(/onAviso=\{setAviso\}/.test(t),
      'a TarjetaSolicitud no se le está pasando la ventanita. Recibe el prop pero '
      + 'nadie se lo da: el aviso no llega a ninguna parte.');
  });
});

// ── LAS COPIAS COMPARTIDAS, AMARRADAS ──────────────────────────────────────
describe('SEGUNDA LEY · las copias compartidas no se separan', () => {
  it('EL QUE MUERDE · avisoRechazo.js está tres veces y las tres son iguales', () => {
    const COPIAS = [
      'guajirago/src/avisoRechazo.js',
      'guajirago-aliados/src/avisoRechazo.js',
      'guajirago-admin/src/avisoRechazo.js',
    ];
    const textos = COPIAS.map(leer);
    for (let i = 1; i < textos.length; i += 1) {
      assert.strictEqual(textos[i], textos[0],
        COPIAS[i] + ' se separó de ' + COPIAS[0] + '. Los tres repos son APARTE y no '
        + 'hay forma de importar de uno a otro: si una copia cambia sola, dos apps '
        + 'empiezan a decir cosas distintas del mismo fallo.');
    }
    // Y que la cabecera nombre las tres rutas: si dice «dos veces», miente.
    for (const ruta of COPIAS) {
      assert.ok(textos[0].includes(ruta),
        'la cabecera de avisoRechazo.js no nombra «' + ruta + '». Quien la lea no '
        + 'sabrá dónde están las otras copias que tiene que tocar.');
    }
  });

  it('EL QUE MUERDE · la ventanita del conductor es la misma que la del panel', () => {
    // Con esto la ventanita queda comprobada de verdad: las pruebas del panel ya
    // le miran el cuerpo entero (que pinte, que el botón cierre, el zIndex). Si
    // aquí fuera otra copia, esas comprobaciones no dirían nada de esta.
    assert.strictEqual(
      leer('guajirago/src/AvisoModal.js'),
      leer('guajirago-admin/src/AvisoModal.js'),
      'la ventanita del conductor se separó de la del panel. Las pruebas que le '
      + 'miran el cuerpo están en el panel: si son distintas, esta no la comprueba nadie.');
  });
});

// ── LO QUE QUEDA ABIERTO, ESCRITO PARA QUE NO SE OLVIDE ────────────────────
describe('ANOTADO · lo que sigue mudo en la app del pasajero y conductor', () => {
  it('ANOTADO · siguen mudas las escrituras del lado del PASAJERO', () => {
    // Los gemelos Solicitar.js y SolicitarMensajeria.js. Se hablaron con el dueño
    // y se dejaron para el trabajo siguiente.
    //
    // ESTA PRUEBA SE PONE ROJA EL DÍA QUE SE ARREGLEN, y es a propósito: entonces
    // se borra, junto con esta anotación. Mientras esté verde, queda dicho.
    let quedan = 0;
    for (const archivo of ['guajirago/src/Solicitar.js', 'guajirago/src/SolicitarMensajeria.js']) {
      const t = soloCodigo(leer(archivo));
      const seguro = sinTextos(t);
      for (const m of t.matchAll(/setDoc\s*\(|updateDoc\s*\(|addDoc\s*\(|deleteDoc\s*\(/g)) {
        const manejador = catchPropioDe(t, m.index);
        if (!dentroDeTry(seguro, m.index) && !(manejador && manejador.trim())) quedan += 1;
      }
    }
    assert.ok(quedan > 0,
      'ya no quedan escrituras sueltas en los gemelos del pasajero: si es así, borra '
      + 'esta prueba y la anotación que la acompaña.');
  });
});
