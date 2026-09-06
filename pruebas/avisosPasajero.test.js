/**
 * REGLA 9 DEL LADO DEL PASAJERO · Y LA PANTALLA QUE MENTÍA
 *
 * Palabras del dueño: «Nada se rechaza en silencio.»
 *
 * Este arreglo cierra los CINCO botones de Solicitar.js que deciden el viaje y el
 * dinero. Medido el 6-sep-2026 contra la base: de 91 viajes, **35 acabaron
 * cancelados por el pasajero** — más que los cancelados por el conductor (31) y
 * más del doble que los terminados (16). Cancelar es de los botones más usados de
 * toda la app, y hasta hoy no decía nada si fallaba.
 *
 * ── LA MENTIRA ──────────────────────────────────────────────────────────────
 * `confirmarViaje` hacía `setConductorYaTomado(true)` en su catch: fallara lo que
 * fallara, al pasajero se le enseñaba la pantalla de «el conductor ya fue tomado»
 * y se le mandaba a buscar otro.
 *
 * Y ESO NO PODÍA PASAR NUNCA por ese camino. La escritura solo pone
 * `estado: 'aceptado'` en el viaje del PROPIO pasajero; nadie comprueba si el
 * conductor sigue libre — ni el código, ni las reglas de Firestore (se leyó el
 * bloque `match /viajes/{id}` entero el 6-sep-2026). El conductor se marca ocupado
 * a sí mismo, en OTRA colección. O sea: ese mensaje era **siempre falso**, y el
 * pasajero se quedaba creyendo que había perdido un viaje que seguía ahí.
 *
 * Decir algo falso es peor que callar: el que calla deja dudar; el que miente
 * cierra la puerta.
 *
 * ── LO QUE NO CIERRA ────────────────────────────────────────────────────────
 * Quedan DIEZ escrituras mudas en el archivo, todas de las que se dejaron fuera a
 * propósito: `enviarRespuesta`, el chat, `borrarFavorito`, `enviarNuevaOferta`,
 * `seguirBuscando` y su temporizador (×3), y tres de `solicitarViaje`.
 *
 * Y DOS COSAS MÁS, encontradas por la segunda opinión y ANOTADAS sin tocar:
 *
 *   · POR ENCIMA de las siete pantallas hay CUATRO salidas más que no llevan la
 *     ventanita: `<Calificacion/>`, `<Celebracion/>` y dos `<Llamada/>`. Mientras
 *     una de ellas está puesta, el aviso queda tapado. En tres se recupera solo
 *     —el aviso sobrevive y sale después—; en `<Calificacion/>` se PIERDE, porque
 *     esa pantalla desmonta esta. El único aviso que puede saltar ahí es el del
 *     descuento.
 *   · Los temporizadores de `cancelarViaje` se matan ANTES de intentar la
 *     escritura (era así de antes). Tras una cancelación fallida el pasajero se
 *     queda en «esperando» con el contador parado: el radio no se amplía y el
 *     viaje no se vence en el teléfono.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  leer, soloCodigo, sinTextos, cuerpoDelCatch, cuerpoDeLaFuncion,
  dentroDeTry, catchPropioDe,
} = require('./cargar.cjs');

const APP = 'guajirago/src/Solicitar.js';

// Los que viven en una función con nombre y llevan try/catch.
// El tercer campo dice si su catch TIENE QUE CORTAR.
const CON_NOMBRE = [
  ['cancelarViaje', 'cancelar el viaje', true],
  ['confirmarViaje', 'confirmar el viaje', false],
];

// Los que van disparados sin esperar y se protegen con su propio `.catch`.
const CON_CATCH_PROPIO = [
  ["updateDoc(doc(db, 'usuarios', user.uid), { descuentoPendiente: null })", 1, 'registrar que usaste tu descuento'],
  ["updateDoc(doc(db, 'viajes', viajeId, 'contraofertas', conductorId), { vigente: false })", 1, 'rechazar esa oferta'],
  // Se ancla en UN campo que solo sale aquí. `nuevaOferta: new Date()...` sale DOS
  // veces —aquí y en enviarNuevaOferta—, y `estado: 'esperando'` sale TRES.
  //
  // Y NO se ancla en dos renglones juntos: este archivo es CRLF, así que entre
  // renglón y renglón hay `\r\n` y un ancla escrita con `\n` no casa NUNCA. Ya
  // costó una prueba que decía «sale 0 veces» sobre código que estaba ahí.
  ['conductorVehiculo: null,', 1, 'rechazar al conductor'],
];

describe('REGLA 9 · los botones del pasajero ya no fallan en silencio', () => {
  for (const [fn, accion, tieneQueCortar] of CON_NOMBRE) {
    it('EL QUE MUERDE · «' + accion + '» avisa si el servidor dice que no', () => {
      const t = soloCodigo(leer(APP));
      const i = t.search(new RegExp('const ' + fn + '\\s*=\\s*(?:async\\s*)?\\('));
      assert.ok(i >= 0, 'no encontré la función ' + fn + ' en ' + APP);
      const fnCuerpo = cuerpoDeLaFuncion(t, i);
      const cuerpo = cuerpoDelCatch(t, i);
      assert.ok(cuerpo !== null, fn + '(): ya no tiene catch.');

      // Sin `await` el catch no se entera: la promesa se rechaza sola y el try se
      // queda de adorno. Es el mutante más barato contra cualquier arreglo así.
      for (const m of fnCuerpo.texto.matchAll(/(?:setDoc|updateDoc|addDoc|deleteDoc)\s*\(/g)) {
        const propio = catchPropioDe(fnCuerpo.texto, m.index);
        if (propio && propio.trim()) continue;
        const delante = fnCuerpo.texto.slice(Math.max(0, m.index - 10), m.index);
        assert.ok(/\.\s*$/.test(delante) || /await\s+$/.test(delante),
          fn + '(): hay una escritura sin `await` y sin `.catch` propio. El catch no '
          + 'se entera de que falló y el aviso no sale nunca.');
      }

      assert.ok(/apuntarRechazo\s*\(/.test(cuerpo), fn + '(): no deja rastro del rechazo');
      assert.ok(/setAviso\s*\(\s*motivoDeRechazo/.test(cuerpo),
        fn + '(): no le dice NADA al pasajero. Calcular el motivo y no enseñarlo es lo '
        + 'mismo que tragárselo.');
      assert.ok(!/setAviso\s*\(\s*(null|'')\s*\)/.test(cuerpo),
        fn + '(): pone el aviso y lo borra en el mismo catch. Se ve igual que no avisar.');

      // ── QUE EL AVISO NO SE PISE A SÍ MISMO ────────────────────────────────
      // Un solo `setAviso` por catch. Con dos, el segundo gana: se podía dejar el
      // bueno y ponerle detrás un texto a mano, y la prueba seguía verde porque
      // solo miraba que el bueno estuviera. Lo demostró la segunda opinión.
      assert.strictEqual((cuerpo.match(/setAviso\s*\(/g) || []).length, 1,
        fn + '(): hay más de un `setAviso` en el catch. El último gana, así que el '
        + 'aviso bueno se puede quedar tapado por otro escrito a mano.');

      // ── QUE NO SE VAYA DE LA PANTALLA ─────────────────────────────────────
      // Vale para las DOS: avisar y marcharse es lo mismo que no avisar, porque el
      // pasajero no llega a leerlo y pierde el botón para reintentar.
      for (const salida of [/onVolver\s*\(/, /setPantalla\s*\(/]) {
        assert.ok(!salida.test(cuerpo),
          fn + '(): el catch avisa y SE VA de la pantalla. El pasajero no llega a leer '
          + 'el aviso y se queda sin forma de reintentar.');
      }

      if (tieneQueCortar) {
        // `cancelarViaje` hace `onVolver()` detrás del try: si el catch no corta, el
        // pasajero se va de la pantalla con el viaje AÚN VIVO en el servidor —un
        // conductor en camino a alguien que ya se fue— y sin botón para reintentar.
        //
        // PEDIR SOLO QUE «TERMINE EN RETURN» NO BASTA: la segunda opinión metió el
        // `onVolver()` DENTRO del catch, justo antes del return, y la prueba siguió
        // verde reproduciendo el daño exacto que su propio mensaje describe. Por eso
        // la comprobación de arriba mira el catch entero.
        const hastaElTry = fnCuerpo.texto.slice(0, fnCuerpo.texto.indexOf('try {'));
        assert.ok(!/onVolver\s*\(/.test(hastaElTry),
          fn + '(): se sale de la pantalla ANTES del try.');
        const limpio = cuerpo.trim().replace(/;\s*$/, '');
        assert.ok(/\breturn\b\s*$/.test(limpio),
          fn + '(): el catch no termina en `return`. El `onVolver()` de después corre '
          + 'igual: el pasajero se va y el viaje se queda vivo.');
      }
    });
  }

  it('EL QUE MUERDE · aceptar el viaje ya NO miente diciendo «el conductor ya fue tomado»', () => {
    // Esta es la razón de ser de este arreglo. Se comprueba en NEGATIVO porque lo
    // que hacía daño era una línea que sobraba, no una que faltara.
    const t = soloCodigo(leer(APP));
    const i = t.search(/const confirmarViaje\s*=\s*(?:async\s*)?\(/);
    const cuerpo = cuerpoDelCatch(t, i);
    assert.ok(!/setConductorYaTomado\s*\(\s*true\s*\)/.test(cuerpo),
      'confirmarViaje volvió a decir «el conductor ya fue tomado» cuando falla. Ese '
      + 'mensaje es SIEMPRE falso por ese camino: la escritura solo pone '
      + '`estado: aceptado` en el viaje del propio pasajero y nadie comprueba si el '
      + 'conductor sigue libre —ni el código ni las reglas—. El pasajero se queda '
      + 'creyendo que perdió un viaje que seguía ahí.');

    // Y que le devuelva la confirmación, para que pueda volver a intentarlo en vez
    // de quedarse sin el conductor que ya había elegido.
    assert.ok(/setConfirmacionPendiente\s*\(\s*datos\s*\)/.test(cuerpo),
      'confirmarViaje avisa del fallo pero se traga la confirmación: el pasajero se '
      + 'queda sin la oferta que estaba aceptando y sin forma de reintentar.');
  });

  it('EL QUE MUERDE · rechazar al conductor DEVUELVE la tarjeta si falla', () => {
    // La hermana de la de arriba. `rechazarConfirmacion` quita la tarjeta ANTES de
    // escribir; si la escritura no entra y no se devuelve, al pasajero se le dice
    // «no se pudo rechazar» y se queda sin el botón para reintentar, con el viaje
    // todavía asignado al conductor que acababa de rechazar. Era el mismo agujero
    // que se le cerró a confirmarViaje, abierto justo al lado — lo vio la segunda
    // opinión.
    const t = soloCodigo(leer(APP));
    const i = t.search(/const rechazarConfirmacion\s*=\s*(?:async\s*)?\(/);
    assert.ok(i >= 0, 'no encontré rechazarConfirmacion');
    const fn = cuerpoDeLaFuncion(t, i);
    assert.ok(/const datosRechazados = confirmacionPendiente;/.test(fn.texto),
      'rechazarConfirmacion ya no guarda la tarjeta antes de quitarla: si el rechazo '
      + 'falla no hay nada que devolver.');
    const pos = t.lastIndexOf('updateDoc(', t.indexOf('conductorVehiculo: null,'));
    const manejador = catchPropioDe(t, pos) || '';
    assert.ok(/setConfirmacionPendiente\s*\(\s*datosRechazados\s*\)/.test(manejador),
      'rechazar al conductor avisa del fallo pero NO devuelve la tarjeta: el pasajero '
      + 'se queda sin forma de reintentar y el viaje sigue asignado al conductor que '
      + 'acaba de rechazar.');
  });

  for (const [ancla, veces, accion] of CON_CATCH_PROPIO) {
    it('EL QUE MUERDE · «' + accion + '» avisa si el servidor dice que no', () => {
      const t = soloCodigo(leer(APP));
      assert.strictEqual(t.split(ancla).length - 1, veces,
        'la escritura de «' + accion + '» sale ' + (t.split(ancla).length - 1)
        + ' veces y se esperaban ' + veces + '. O se copió, o cambió el código y esta '
        + 'prueba mira al vacío.');
      // El ancla puede caer DENTRO de la llamada —`conductorVehiculo: null` está en
      // mitad del objeto que se escribe—, así que se sube hasta el principio de la
      // escritura que la contiene. Sin esto, `catchPropioDe` empezaba a contar
      // paréntesis desde mitad del objeto y no encontraba el `.catch` que sí está.
      const dentro = t.indexOf(ancla);
      const pos = Math.max(
        t.lastIndexOf('updateDoc(', dentro), t.lastIndexOf('setDoc(', dentro),
        t.lastIndexOf('addDoc(', dentro), t.lastIndexOf('deleteDoc(', dentro),
      );
      assert.ok(pos >= 0, accion + ': no encontré la escritura que contiene el ancla');
      const manejador = catchPropioDe(t, pos);
      assert.ok(manejador && manejador.trim(),
        accion + ': la escritura no lleva `.catch` con nada dentro. Un '
        + '`.catch(() => {})` es tragarse el fallo con otra cara.');
      assert.ok(/apuntarRechazo\s*\(/.test(manejador), accion + ': no deja rastro');
      assert.ok(/setAviso\s*\(\s*motivoDeRechazo/.test(manejador),
        accion + ': saca el motivo pero no lo enseña.');
    });
  }

  it('EL QUE MUERDE · no nace ninguna escritura muda nueva entre las cinco', () => {
    // Las que quedaron FUERA del alcance, dichas por su ancla para que la cuenta no
    // dependa del renglón. Si aparece una muda que no esté aquí, esto se pone rojo.
    const FUERA = [
      'respuestaPasajero: respuesta',        // enviarRespuesta
      "'mensajes'",                          // el chat
      'favoritos: nuevos',                   // borrarFavorito
      'nuevaOfertaPasajero',                 // enviarNuevaOferta
      'radioBusqueda',                       // seguirBuscando
      'estado: ESTADOS_MERCADO',             // seguirBuscando
      'fechaSolicitud: new Date',            // seguirBuscando / crear
      "estado: 'vencido'",                    // el temporizador de seguirBuscando
    ];
    const t = soloCodigo(leer(APP));
    const seguro = sinTextos(t);
    const mudas = [];
    for (const m of t.matchAll(/(?:setDoc|updateDoc|addDoc|deleteDoc)\s*\(/g)) {
      if (dentroDeTry(seguro, m.index)) continue;
      const manejador = catchPropioDe(t, m.index);
      if (manejador && manejador.trim()) continue;
      const trozo = t.slice(m.index, m.index + 400);
      if (FUERA.some((x) => trozo.includes(x))) continue;
      mudas.push('renglón ' + t.slice(0, m.index).split('\n').length);
    }
    assert.deepStrictEqual(mudas, [],
      'hay ' + mudas.length + ' escritura(s) nuevas que se tragan el fallo ('
      + mudas.join(', ') + ').');
  });
});

// ── QUE EL AVISO SE VEA. LA TRAMPA QUE YA MORDIÓ CUATRO VECES ──────────────
describe('REGLA 9 · la ventanita se ve en TODAS las pantallas del pasajero', () => {
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

  it('EL QUE MUERDE · las SIETE pantallas del pasajero pintan la ventanita', () => {
    // Siete, no las tres donde están los botones: el descuento se quema desde un
    // escuchador que corre en CUALQUIER pantalla, así que el aviso puede salir en
    // cualquiera de ellas.
    const t = soloCodigo(leer(APP));
    const comp = cuerpoDeLaFuncion(t, t.search(/^function Solicitar\s*\(/m));
    assert.ok(comp, 'no reconocí el componente Solicitar');
    const cuerpo = t.slice(comp.ini, comp.fin);

    const returns = [...cuerpo.matchAll(/^ {2,4}return \($/gm)];
    assert.ok(returns.length >= 7,
      'esperaba al menos las siete pantallas del pasajero y encontré ' + returns.length
      + '. O se quitó una, o cambió la forma de escribirlas y esta prueba dejó de verlas.');

    // SE MIRA QUÉ SE LE PASA, no solo que la etiqueta esté. La segunda opinión dejó
    // la ventanita puesta en las siete y le pasó `aviso={aviso && false}`: no
    // enseñaba NADA nunca, y las once pruebas siguieron verdes.
    const sinVentanita = [];
    const malPuestas = [];
    for (const m of returns) {
      const jsx = jsxDelReturn(cuerpo, m.index);
      const renglon = 'renglón ' + t.slice(0, comp.ini + m.index).split('\n').length;
      if (!/<AvisoModal /.test(jsx)) { sinVentanita.push(renglon); continue; }
      if (!/<AvisoModal aviso=\{aviso\} onCerrar=\{\(\) => setAviso\(null\)\} \/>/.test(jsx)) {
        malPuestas.push(renglon);
      }
    }
    assert.deepStrictEqual(malPuestas, [],
      'hay ' + malPuestas.length + ' ventanita(s) que NO reciben el aviso tal cual ('
      + malPuestas.join(', ') + '). Estar puesta y no enseñar nada se ve igual que no '
      + 'estar.');
    assert.deepStrictEqual(sinVentanita, [],
      'hay ' + sinVentanita.length + ' pantalla(s) del pasajero SIN la ventanita ('
      + sinVentanita.join(', ') + '). Un aviso en una pantalla que no se está enseñando '
      + 'no se ve nunca — y van cuatro veces que muerde lo mismo en este proyecto.');
  });

  it('EL QUE MUERDE · se pinta SIEMPRE que hay aviso, sin condiciones de más', () => {
    const t = soloCodigo(leer(APP));
    const seguro = sinTextos(t);
    const comp = cuerpoDeLaFuncion(t, t.search(/^function Solicitar\s*\(/m));
    const cuerpo = seguro.slice(comp.ini, comp.fin);
    for (const m of cuerpo.matchAll(/<AvisoModal /g)) {
      const antes = [...cuerpo.slice(0, m.index).matchAll(/^ {2,4}return \($/gm)];
      assert.ok(antes.length > 0, 'la ventanita no está dentro de ningún return');
      let hondo = 0;
      for (let i = antes[antes.length - 1].index; i < m.index; i += 1) {
        if (cuerpo[i] === '{') hondo += 1;
        else if (cuerpo[i] === '}') hondo -= 1;
      }
      assert.strictEqual(hondo, 0,
        'la ventanita está METIDA DENTRO de otra cosa (renglón '
        + t.slice(0, comp.ini + m.index).split('\n').length + '): sólo se vería cuando '
        + 'esa otra cosa se esté pintando.');
    }
  });

  it('EL QUE MUERDE · la ventanita va por ENCIMA de los modales de esta pantalla', () => {
    const modal = leer('guajirago/src/AvisoModal.js');
    const suyo = Number((/zIndex:\s*(\d+)/.exec(modal) || [])[1]);
    assert.ok(suyo > 0, 'la ventanita no declara zIndex');
    const t = soloCodigo(leer(APP));
    for (const m of t.matchAll(/zIndex:\s*(\d+)/g)) {
      const z = Number(m[1]);
      if (z >= 99999) continue; // pantallas enteras, no coinciden con el aviso
      assert.ok(suyo >= z,
        'Solicitar.js tiene algo a zIndex ' + z + ' y la ventanita está a ' + suyo
        + ': el aviso saldría TAPADO, que se ve igual que no salir.');
    }

    // EL EMPATE NO BASTA, Y AQUÍ HAY UNO: la ventanita de «conductor ocupado» de
    // esta pantalla está al MISMO 10000 que el aviso. Cuando dos cosas empatan
    // gana la que se pinta DESPUÉS — así que el aviso tiene que ir el ÚLTIMO de
    // cada pantalla. Estaba el primero y perdía; se movió.
    const seguro = sinTextos(t);
    const comp = cuerpoDeLaFuncion(t, t.search(/^function Solicitar\s*\(/m));
    const cuerpo = seguro.slice(comp.ini, comp.fin);
    //
    // Y SE COMPRUEBA EN LAS SIETE, no solo donde haya un zIndex detrás. La primera
    // versión buscaba un `zIndex:` literal después de la ventanita, y eso solo
    // existe en UNA de las siete pantallas: en las otras seis la posición no la
    // vigilaba nadie. Lo midió la segunda opinión. Ahora se pide lo que de verdad
    // se quiere: que después de la ventanita no quede NINGUNA etiqueta más.
    for (const m of cuerpo.matchAll(/^ {2,4}return \($/gm)) {
      const trozo = jsxDelReturn(cuerpo, m.index);
      const donde = trozo.indexOf('<AvisoModal ');
      if (donde < 0) continue;
      const despues = trozo.slice(donde + '<AvisoModal '.length);
      const otraEtiqueta = /<[A-Za-z]/.exec(despues);
      assert.ok(!otraEtiqueta,
        'después de la ventanita todavía se pinta «' + despues.slice(otraEtiqueta ? otraEtiqueta.index : 0, (otraEtiqueta ? otraEtiqueta.index : 0) + 40).trim()
        + '». La ventanita de «conductor ocupado» de esta pantalla está al MISMO '
        + 'zIndex (' + suyo + '), y a igual altura gana lo que se pinta después: el '
        + 'aviso quedaría debajo. Tiene que ser lo ÚLTIMO de cada pantalla.');
    }
  });

  it('EL QUE MUERDE · el motivo sale del mismo archivo que en el resto del proyecto', () => {
    const t = soloCodigo(leer(APP));
    assert.ok(/from '\.\/avisoRechazo'/.test(t),
      APP + ' no saca el motivo del archivo compartido: se lo está escribiendo.');
  });
});
