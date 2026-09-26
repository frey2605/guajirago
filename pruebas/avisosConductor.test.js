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
 *     llegó» (el escuchador del viaje, en `Solicitar.js`). Si falla callado, el
 *     conductor está en la puerta
 *     y el pasajero sigue esperando dentro.
 *   · `fase: 'en_viaje'` es lo que le pasa a la pantalla del viaje en marcha
 *     (`Solicitar.js`) y lo que el panel enseña como «En viaje»
 *     (`admin/Viajes.js`).
 *
 * ── LO QUE ESTE ARREGLO NO CIERRA ──────────────────────────────────────────
 * Quedan las del lado del PASAJERO —`Solicitar.js`—, la llamada, el pedido de
 * comida, los chats y los menores. Y DOS de
 * este mismo archivo que la segunda opinión encontró y no estaban en la lista:
 *   · `invalidarMisOtrasOfertas` — retirar tus propias ofertas cuando gana otro
 *   · el `activo: false` de APAGARSE para dejar de recibir viajes — el conductor cree que se
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

// ── DESDE LA LEY DEL BOTÓN (26-sep-2026) ─────────────────────────────────────
// Estas escrituras pasan por el candado (`correr`, de useAccion): el candado nunca se traga un fallo, deja rastro
// (apuntarRechazo) y saca el motivo con motivoDeRechazo, la pieza única; su aviso entra por la MISMA ventanita que
// pintan las cuatro pantallas (`setAviso`), y el de la tarjeta sube por `onAviso`. Lo que cada catch decidía —cortar,
// no limpiar la pantalla— lo decide ahora el `if (!r || !r.ok)` de después. Se vigila LO MISMO, con la forma nueva.

/** La llamada a correr(...) que hay dentro de `cuerpo`: { args: [fn, cual, exito, accion], antes, despues }. */
function laAccion(cuerpo) {
  const seguro = sinTextos(cuerpo);
  const i = seguro.search(/\bcorrer\s*\(/);
  if (i < 0) return null;
  const abre = seguro.indexOf('(', i);
  const args = [];
  let hondo = 0;
  let desde = abre + 1;
  for (let k = abre; k < seguro.length; k++) {
    const c = seguro[k];
    if ('([{'.includes(c)) hondo++;
    else if (')]}'.includes(c)) {
      hondo--;
      if (hondo === 0) { args.push(cuerpo.slice(desde, k).trim()); return { args, antes: cuerpo.slice(0, i), despues: cuerpo.slice(k + 1) }; }
    } else if (c === ',' && hondo === 1) { args.push(cuerpo.slice(desde, k).trim()); desde = k + 1; }
  }
  return null;
}

/** ¿La posición cae dentro de algún correr(...)? */
function dentroDeCorrer(t, pos) {
  const seguro = sinTextos(t);
  for (const m of seguro.matchAll(/\bcorrer\s*\(/g)) {
    const abre = seguro.indexOf('(', m.index);
    let hondo = 0;
    for (let k = abre; k < seguro.length; k++) {
      if ('([{'.includes(seguro[k])) hondo++;
      else if (')]}'.includes(seguro[k])) { hondo--; if (hondo === 0) { if (abre < pos && pos < k) return true; break; } }
    }
  }
  return false;
}

const cuerpoDe = (t, fn) => {
  const i = t.search(new RegExp('const ' + fn + '\\s*=\\s*(?:async\\s*)?\\('));
  assert.ok(i >= 0, 'no encontré la función ' + fn + ' en ' + APP);
  return cuerpoDeLaFuncion(t, i).texto;
};

describe('REGLA 9 · los botones del viaje del conductor ya no fallan en silencio', () => {
  // Los cuatro que limpian o avanzan la pantalla detrás: si la escritura no entró, TIENEN que cortar.
  for (const [fn, accion] of [['llegueAlPunto', 'avisar que llegaste'], ['iniciarViaje', 'iniciar el viaje'],
    ['cancelarViaje', 'cancelar el viaje'], ['cerrarViajeFinal', 'cerrar el viaje']]) {
    it('EL QUE MUERDE · «' + accion + '» pasa por el candado con su motivo, y CORTA si no entró', () => {
      const cuerpo = cuerpoDe(soloCodigo(leer(APP)), fn);
      const a = laAccion(cuerpo);
      assert.ok(a, fn + '(): no pasa por el candado: la escritura vuelve a perderse en el aire.');
      assert.match(a.args[0], /updateDoc\(/, fn + '(): la escritura no va DENTRO del candado.');
      assert.strictEqual(a.args[3], "'" + accion + "'", fn + '(): el candado no sabe qué se intentaba.');
      // Y QUE LA PANTALLA NO HAYA AVANZADO YA: la segunda opinión movió una vez el `setFase(...)` delante; el aviso
      // salía encima de una pantalla que ya decía que sí.
      assert.ok(!/setFase\s*\(|setViajeActual\s*\(\s*null/.test(a.antes),
        fn + '(): la pantalla avanza ANTES de saber si la escritura entró.');
      // EL CORTE: sin él, la limpieza de después corre igual y el viaje se queda colgado sin forma de reintentar.
      const corte = a.despues.match(/if \(!r \|\| !r\.ok\) (return;|\{[\s\S]*?\breturn;\s*\})/);
      assert.ok(corte, fn + '(): si el candado dice que no, no corta: la limpieza de después corre igual.');
      const iCorte = a.despues.indexOf(corte[0]);
      const iAvanza = a.despues.search(/setFase\s*\(|setViajeActual\s*\(/);
      assert.ok(iAvanza < 0 || iCorte < iAvanza, fn + '(): el corte va DESPUÉS de avanzar la pantalla.');
    });
  }

  it('EL QUE MUERDE · la oferta: «enviada» SOLO cuando entró (si falla, la tarjeta no miente)', () => {
    // Si la contraoferta no entra pero la tarjeta dice «enviada», el conductor espera una respuesta a algo que el
    // pasajero nunca vio.
    const cuerpo = cuerpoDe(soloCodigo(leer(APP)), 'aceptarOEnviar');
    const a = laAccion(cuerpo);
    assert.ok(a && /setDoc\(doc\(db, 'viajes', idViaje, 'contraofertas', user\.uid\)/.test(a.args[0]), 'la oferta no va por el candado.');
    assert.strictEqual(a.args[3], "'enviar tu oferta'");
    assert.ok(!/setOfertaEnviada\s*\(\s*monto/.test(a.antes), '«enviada» se pone ANTES de saber si entró.');
    assert.match(a.despues, /if \(r && r\.ok\) setOfertaEnviada\(monto\);/, '«enviada» no depende de que la oferta entrara.');
  });

  it('EL QUE MUERDE · «liberarte para recibir viajes» avisa si el servidor dice que no, en sus tres sitios', () => {
    const t = soloCodigo(leer(APP));
    const ancla = "setDoc(doc(db, 'conductores', user.uid), { ocupado: false, enViajeId: null }";
    assert.strictEqual(t.split(ancla).length - 1, 3, 'la escritura de «liberarte» cambió o se copió: esta prueba mira al vacío.');
    let desde = 0;
    for (let n = 0; n < 3; n += 1) {
      const pos = t.indexOf(ancla, desde);
      desde = pos + ancla.length;
      const donde = 'liberarte (copia ' + (n + 1) + ', renglón ' + t.slice(0, pos).split('\n').length + ')';
      if (dentroDeCorrer(t, pos)) {
        assert.ok(t.slice(pos, pos + 400).includes("'liberarte para recibir viajes'"), donde + ': va por el candado sin decir qué se intentaba.');
        continue;
      }
      const manejador = catchPropioDe(t, pos);
      assert.ok(manejador && manejador.trim(), donde + ': ni candado ni `.catch` con algo dentro.');
      assert.ok(/apuntarRechazo\s*\(/.test(manejador), donde + ': no deja rastro');
      assert.ok(/setAviso\s*\(\s*motivoDeRechazo/.test(manejador), donde + ': saca el motivo pero no lo enseña.');
    }
  });

  it('EL QUE MUERDE · cerrar sesión con un viaje en marcha NO se va si la cancelación no entró', () => {
    // Si se va, el pasajero se queda esperando a un conductor que ya se fue, y nadie lo sabe.
    const a = laAccion(cuerpoDe(soloCodigo(leer(APP)), 'cerrarSesion'));
    assert.ok(a && /updateDoc\(doc\(db, 'viajes', viajeActual\.id\)/.test(a.args[0]), 'la cancelación de cerrar sesión no va por el candado.');
    const corta = a.despues.indexOf('if (!r.ok && viajeActual) return;');
    assert.ok(corta >= 0 && corta < a.despues.indexOf('signOut('), 'con viaje en marcha, cierra la sesión aunque la cancelación haya fallado.');
  });

  it('EL QUE MUERDE · los códigos (seguridad y descuento) dicen el error DENTRO de su ventanita', () => {
    const t = soloCodigo(leer(APP));
    for (const [fn, setter] of [['verificarCodigo', 'setErrorCodigo'], ['verificarCodigoDescuento', 'setErrorCodigoDescuento']]) {
      const a = laAccion(cuerpoDe(t, fn));
      assert.ok(a, fn + '(): no pasa por el candado: un doble toque son dos comprobaciones (y el descuento, dos cobros).');
      const captura = a.args[0].match(/catch \(e\) \{([\s\S]*?)return \{ ok: false, avisado: true \};/);
      assert.ok(captura, fn + '(): si falla, no avisa DENTRO de su ventanita (o no le dice al candado que ya avisó).');
      assert.match(captura[1], new RegExp(setter + '\\('), fn + '(): el fallo no se pinta en la ventanita del código.');
      assert.match(captura[1], /apuntarRechazo\(/, fn + '(): no deja rastro.');
    }
    assert.ok(!/includes\(' '\)/.test(cuerpoDe(t, 'verificarCodigoDescuento')),
      'el descuento volvió a calcular por su cuenta si el mensaje «es del servidor»: eso lo sabe motivoDeRechazo (SEGUNDA LEY).');
  });

  it('EL QUE MUERDE · el motivo sale del mismo archivo que en las otras dos apps', () => {
    const t = soloCodigo(leer(APP));
    assert.ok(/from '\.\/avisoRechazo'/.test(t),
      APP + ' no saca el motivo del archivo compartido: se lo está escribiendo (SEGUNDA LEY).');
  });

  it('EL QUE MUERDE · no nace ninguna escritura muda nueva en el archivo', () => {
    const t = soloCodigo(leer(APP));
    const seguro = sinTextos(t);
    // Las que YA estaban mudas antes y quedaron fuera del alcance, dichas por su ancla.
    const FUERA = [
      "'contraofertas', miId), { vigente: false }",     // retirar mis ofertas
      "{ activo: false, nombre: nombre || '' }",         // apagarse
    ];
    const mudas = [];
    for (const m of t.matchAll(/(?:setDoc|updateDoc|addDoc|deleteDoc)\s*\(/g)) {
      if (dentroDeTry(seguro, m.index) || dentroDeCorrer(t, m.index)) continue;
      const manejador = catchPropioDe(t, m.index);
      if (manejador && manejador.trim()) continue;
      const trozo = t.slice(m.index, m.index + 220);
      if (FUERA.some((x) => trozo.includes(x))) continue;
      mudas.push('renglón ' + t.slice(0, m.index).split('\n').length);
    }
    assert.deepStrictEqual(mudas, [], 'hay escritura(s) nuevas que se tragan el fallo (' + mudas.join(', ') + ').');
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
    // Desde LA LEY DEL BOTÓN el fallo lo decide el `if (!r || !r.ok) { … }` de después del candado, no un catch.
    const i = t.search(/const cerrarViajeFinal\s*=/);
    const cuerpo = (cuerpoDeLaFuncion(t, i).texto.match(/if \(!r \|\| !r\.ok\) \{([\s\S]*?)\breturn;/) || [])[1] || '';
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
    // SE COMPARA EL CONTENIDO, NO LOS BYTES. Git convierte los finales de línea al
    // sacar los archivos, y no siempre igual en los tres repos: medido el
    // 6-sep-2026, en una copia recién bajada guajirago/AvisoModal.js sale en
    // formato Windows y el del panel en Unix. Comparando byte a byte, esta prueba
    // se ponía ROJA sobre código idéntico — el peor fallo de una prueba, porque
    // enseña a desconfiar de ella. Lo que importa es que digan lo mismo.
    const mismoTexto = (s) => s.split('\r\n').join('\n');
    const textos = COPIAS.map((f) => mismoTexto(leer(f)));
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
    // Ignorando el final de línea, por lo mismo que arriba: git los convierte al
    // sacar los archivos y no igual en los dos repos. Este par fue justo el que lo
    // destapó.
    const mismoTexto = (s) => s.split('\r\n').join('\n');
    assert.strictEqual(
      mismoTexto(leer('guajirago/src/AvisoModal.js')),
      mismoTexto(leer('guajirago-admin/src/AvisoModal.js')),
      'la ventanita del conductor se separó de la del panel. Las pruebas que le '
      + 'miran el cuerpo están en el panel: si son distintas, esta no la comprueba nadie.');
  });
});

// ── LO QUE QUEDA ABIERTO, ESCRITO PARA QUE NO SE OLVIDE ────────────────────
describe('ANOTADO · lo que sigue mudo en la app del pasajero y conductor', () => {
  it('ANOTADO · siguen mudas las escrituras del lado del PASAJERO', () => {
    // La pantalla del pasajero, `Solicitar.js`. Se hablaron con el dueño y se
    // dejaron para el trabajo siguiente. (Eran dos pantallas gemelas; se
    // juntaron en una el 5-sep-2026.)
    //
    // ESTA PRUEBA SE PONE ROJA EL DÍA QUE SE ARREGLEN, y es a propósito: entonces
    // se borra, junto con esta anotación. Mientras esté verde, queda dicho.
    let quedan = 0;
    for (const archivo of ['guajirago/src/Solicitar.js']) {
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
