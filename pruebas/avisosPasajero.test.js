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

// ── DESDE LA LEY DEL BOTÓN (26-sep-2026) ─────────────────────────────────────
// Estas escrituras pasan por el candado (`correr`, de useAccion): el candado nunca se traga un fallo, deja rastro
// (apuntarRechazo) y saca el motivo con motivoDeRechazo, la pieza única; su aviso entra por la MISMA ventanita que
// pintan las siete pantallas (`setAviso`). Lo que cada una decidía en su catch —no salir, devolver la tarjeta— lo
// decide ahora el `if (!r || !r.ok)` de después. Se vigila LO MISMO que antes, con la forma nueva.

/** La llamada a correr(...) que hay dentro de `cuerpo`: { args: [fn, cual, exito, accion], despues }. */
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
      if (hondo === 0) { args.push(cuerpo.slice(desde, k).trim()); return { args, despues: cuerpo.slice(k + 1) }; }
    } else if (c === ',' && hondo === 1) { args.push(cuerpo.slice(desde, k).trim()); desde = k + 1; }
  }
  return null;
}

/** ¿La posición cae dentro del primer argumento de algún correr(...)? */
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

describe('REGLA 9 · los botones del pasajero ya no fallan en silencio', () => {
  it('el aviso del candado entra por la ventanita de la pantalla, y cuando FALLA siempre se enseña', () => {
    const t = soloCodigo(leer(APP));
    assert.match(t, /const \{ ocupado, correr, texto, aviso: avisoAccion \} = useAccion\(\);/);
    assert.match(t, /if \(avisoAccion && !avisoAccion\.ok\) setAviso\(avisoAccion\);/,
      'el candado dice el motivo pero la pantalla no lo pinta (o lo esconde también cuando falla).');
  });

  // G59 (29-sep-2026): `confirmarViaje` y `rechazarConfirmacion` se borraron (la ventanita que los llamaba no la abría
  // nadie); lo que las sustituye lo vigila pruebas/conductorDelViaje.test.js.
  for (const [fn, accion] of [['cancelarViaje', 'cancelar el viaje']]) {
    it('EL QUE MUERDE · «' + accion + '» pasa por el candado con su motivo, y decide qué hacer si falla', () => {
      const cuerpo = cuerpoDe(soloCodigo(leer(APP)), fn);
      const a = laAccion(cuerpo);
      assert.ok(a, fn + '(): no pasa por el candado.');
      assert.match(a.args[0], /updateDoc\(/, fn + '(): la escritura no va DENTRO del candado: si falla, nadie se entera.');
      assert.strictEqual(a.args[3], "'" + accion + "'", fn + '(): el candado no sabe qué se intentaba: el título del fallo no lo diría.');
      assert.match(a.despues, /if \(!r \|\| !r\.ok\)/, fn + '(): no mira si el candado dijo que no.');
    });
  }

  it('EL QUE MUERDE · cancelar NO se va de la pantalla si la cancelación no entra', () => {
    // Si el pasajero se va con el viaje AÚN VIVO en el servidor, un conductor va en camino a alguien que ya se fue, y
    // no queda botón para reintentar. Y la segunda opinión ya metió una vez el `onVolver()` antes del corte.
    const cuerpo = cuerpoDe(soloCodigo(leer(APP)), 'cancelarViaje');
    const a = laAccion(cuerpo);
    assert.ok(!/onVolver\s*\(/.test(cuerpo.slice(0, cuerpo.indexOf('correr('))), 'se sale de la pantalla ANTES de cancelar.');
    const corte = a.despues.indexOf('if (!r || !r.ok) return;');
    assert.ok(corte >= 0, 'si la cancelación falla, no se corta: el `onVolver()` de después corre igual.');
    assert.ok(a.despues.indexOf('onVolver(') > corte, 'el `onVolver()` va antes del corte.');
  });

  // Las que se protegen con su propio `.catch` o pasan por el candado con su motivo.
  for (const [ancla, veces, accion] of [
    ["updateDoc(doc(db, 'usuarios', user.uid), { descuentoPendiente: null })", 1, 'registrar que usaste tu descuento'],
    ["updateDoc(doc(db, 'viajes', viajeId, 'contraofertas', conductorId), { vigente: false })", 1, 'rechazar esa oferta'],
  ]) {
    it('EL QUE MUERDE · «' + accion + '» avisa si el servidor dice que no', () => {
      const t = soloCodigo(leer(APP));
      assert.strictEqual(t.split(ancla).length - 1, veces, 'la escritura de «' + accion + '» cambió o se copió: esta prueba mira al vacío.');
      const pos = t.indexOf(ancla);
      if (dentroDeCorrer(t, pos)) {
        const cierra = t.indexOf(')', pos + ancla.length - 1);
        assert.ok(t.slice(cierra, cierra + 400).includes("'" + accion + "'"), accion + ': va por el candado sin decir qué se intentaba.');
        return;
      }
      const manejador = catchPropioDe(t, pos);
      assert.ok(manejador && manejador.trim(), accion + ': ni candado ni `.catch` con algo dentro.');
      assert.ok(/apuntarRechazo\s*\(/.test(manejador), accion + ': no deja rastro');
      assert.ok(/setAviso\s*\(\s*motivoDeRechazo/.test(manejador), accion + ': saca el motivo pero no lo enseña.');
    });
  }

  it('EL QUE MUERDE · no nace ninguna escritura muda nueva', () => {
    // Las que quedan FUERA a propósito, por su ancla: los temporizadores de la búsqueda (no los toca nadie; los
    // dispara el reloj) y la creación del viaje, que va dentro del candado de «pedir el viaje».
    const FUERA = [
      'radioBusqueda: configApp.radioBusquedaAmpliado',   // el temporizador que amplía el radio
      'marcaDelVencido(',                                  // el temporizador que vence la búsqueda (G27)
      // (Aquí estuvo 'pasajeroFcmToken'. Desde G34 el token lo pega prepararTokenDeAvisos de Notificaciones.js, que
      // deja rastro si falla: en esta pantalla ya no hay esa escritura, y dejarla libre solo tapaba una nueva.)
    ];
    const t = soloCodigo(leer(APP));
    const seguro = sinTextos(t);
    const mudas = [];
    for (const m of t.matchAll(/(?:setDoc|updateDoc|addDoc|deleteDoc)\s*\(/g)) {
      if (dentroDeTry(seguro, m.index) || dentroDeCorrer(t, m.index)) continue;
      const manejador = catchPropioDe(t, m.index);
      if (manejador && manejador.trim()) continue;
      const trozo = t.slice(m.index, m.index + 400);
      if (FUERA.some((x) => trozo.includes(x))) continue;
      mudas.push('renglón ' + t.slice(0, m.index).split('\n').length);
    }
    assert.deepStrictEqual(mudas, [], 'hay escritura(s) nuevas que se tragan el fallo (' + mudas.join(', ') + ').');
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
