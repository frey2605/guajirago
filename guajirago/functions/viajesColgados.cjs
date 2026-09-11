/**
 * QUÉ HACER CON UN VIAJE QUE NADIE CERRÓ
 *
 * Una sola calculadora, en un solo archivo, y SIN TOCAR LA RED: recibe el viaje
 * y la hora, y contesta qué hacer. Así se puede PROBAR de verdad.
 *
 * Existe por eso: `expirarViajesColgados` es una función PROGRAMADA, y una
 * función programada no se puede encender desde el emulador. Con la decisión
 * aquí dentro, `pruebas/viajesColgados.test.js` la ejecuta caso por caso.
 * Es el mismo trato que `cobros.cjs` (SEGUNDA LEY: una calculadora por proceso).
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUÉ SE ESCRIBIÓ ESTO (9/10-sep-2026)
 * ════════════════════════════════════════════════════════════════════════════
 * La rutina cerraba por RELOJ y no miraba en qué punto iba el viaje. MEDIDO
 * contra el servidor con `scripts/medir-rutina-colgados.cjs`: de los 8 viajes
 * que la rutina había cerrado, CUATRO estaban en `fase: 'en_viaje'` — el
 * conductor ya había recogido al pasajero. La mitad se cerraron CON EL PASAJERO
 * MONTADO: al pasajero se le acaba el viaje en la pantalla y al conductor se le
 * suelta, en medio de la carrera.
 *
 * El viaje ya llevaba dentro la señal que hacía falta, y nadie la miraba:
 *
 *   fase (ninguna) → el conductor va en camino. NADIE ha recogido a nadie.
 *   fase 'en_punto' → llegó y espera al pasajero. Hay alguien ahí parado.
 *   fase 'en_viaje' → el pasajero va montado. El viaje está pasando.
 *
 * ── LOS DOS RELOJES, Y QUIÉN DECIDIÓ LOS NÚMEROS ────────────────────────────
 * Los eligió el dueño el 10-sep-2026, con la medición delante:
 *
 *   · NUNCA RECOGIÓ (sin fase) ....... 1 hora  → `expirado`
 *     Ése sí está colgado: pasó una hora y el conductor ni llegó.
 *
 *   · YA VA RODANDO ('en_punto' o 'en_viaje') ....... 3 horas → `expirado`
 *     Aquí el tope NO es para limpiar: es para que un conductor que se olvide
 *     de cerrar no se quede «ocupado» para siempre y sin poder coger otro
 *     viaje. Por eso es largo. El viaje terminado más largo que hay medido
 *     duró 64,9 minutos, así que 3 horas deja casi el triple de margen.
 *
 * ── DESDE CUÁNDO SE CUENTA ──────────────────────────────────────────────────
 * De cada etapa, desde que ESA etapa empezó, no desde el principio del viaje:
 *   · el que no recogió: desde `fechaAceptacion` (la escribe
 *     `confirmarConductor`), y si no está, desde `fechaSolicitud`.
 *   · el que va rodando: desde `tiempoEspera`, que es cuando el conductor
 *     marcó que había llegado (`AppConductor.js:977`) — PERO esa fecha la
 *     escribe el CELULAR, así que solo se usa si es de fiar (ver `siEsDeFiar`).
 *   · la búsqueda: desde `nuevaOferta` si el pasajero le dio a «Seguir
 *     buscando», que reinicia la espera sin tocar `fechaSolicitud`.
 * Contarlo todo desde el principio era parte del problema: el reloj de la
 * carrera arrancaba mientras el pasajero todavía estaba buscando conductor.
 *
 * ── LO QUE ESTO NO HACE, Y ESTÁ DICHO A PROPÓSITO ───────────────────────────
 * No mira si el conductor se está moviendo: el viaje no guarda su ubicación
 * minuto a minuto, así que no hay forma. La fase es la mejor señal que hay.
 */

// Las fases en las que YA HAY ALGUIEN ESPERANDO O MONTADO.
const RODANDO = ['en_punto', 'en_viaje'];

// Los minutos que decidió el dueño el 10-sep-2026. Se tocan AQUÍ y en ningún
// otro sitio: `index.js` los lee de aquí.
const MINUTOS = {
  buscando: 20,      // `esperando` sin que nadie lo tome  → `vencido`
  noRecogio: 60,     // `aceptado` y el conductor no llegó → `expirado`
  rodando: 180,      // ya recogió, y nadie cerró          → `expirado`
};

// EL LÍMITE ES «PASADO DE», NO «AL CUMPLIR» (se compara con <=, no con <).
// Es como se comportaba la rutina vieja: `fecha < haceMin(20)` cierra cuando
// han pasado MÁS de 20 minutos, no cuando se cumplen justo. Lo cazó la prueba
// del borde: la primera versión de aquí cerraba un minuto antes que la vieja,
// y un cambio de comportamiento que nadie pidió es un cambio de comportamiento.

/**
 * 🔴 UNA FECHA QUE ESCRIBIÓ UN CELULAR NO SE CREE A CIEGAS.
 *
 * `tiempoEspera` y `nuevaOferta` las escribe el teléfono con SU reloj
 * (`AppConductor.js:977`, `Solicitar.js:877`). Un celular 4 horas atrasado
 * hace que un viaje que empezó hace 5 minutos parezca llevar 245 — y esta
 * calculadora lo cerraría CON EL PASAJERO MONTADO, que es justo el fallo que
 * vino a arreglar, entrando por otra puerta. Lo cazó la segunda opinión del
 * 10-sep-2026, midiéndolo.
 *
 * Así que solo vale si cae donde tiene que caer: después de una fecha que
 * escribió EL SERVIDOR, y no en el futuro. Si no, se usa la del servidor.
 * (CLAUDE.md ya tiene anotada la deuda de las fechas del reloj del teléfono:
 * 74 sitios. Esto no la arregla; se defiende de ella donde muerde.)
 */
function siEsDeFiar(fecha, minimoDelServidor, ahora) {
  if (!fecha) return null;
  const t = new Date(fecha).getTime();
  if (Number.isNaN(t)) return null;
  if (t > new Date(ahora).getTime()) return null;                       // adelantado
  if (minimoDelServidor) {
    const piso = new Date(minimoDelServidor).getTime();
    if (!Number.isNaN(piso) && t < piso) return null;                   // atrasado
  }
  return fecha;
}

/** Cuántos minutos han pasado desde `desde` hasta `ahora`. */
function minutosDesde(desde, ahora) {
  if (!desde) return null;
  const d = new Date(desde).getTime();
  if (Number.isNaN(d)) return null;
  return (new Date(ahora).getTime() - d) / 60000;
}

/**
 * QUÉ HACER CON ESTE VIAJE.
 *
 * @param viaje  el documento del viaje, tal cual
 * @param ahora  la fecha DEL SERVIDOR. Nunca la del navegador de un cliente:
 *               bastaría con cambiarle la hora al computador para no vencer
 *               jamás. (Es la misma razón que en `cobros.cjs`.)
 * @returns  { cerrar, estado, porQue, minutos }
 *           `cerrar:false` cuando hay que dejarlo en paz, y `porQue` dice
 *           siempre el motivo — también cuando NO se cierra. REGLA 9 del dueño:
 *           nada pasa en silencio, ni siquiera no hacer nada.
 */
function queHacerConElViaje(viaje, ahora) {
  const v = viaje || {};
  const no = (porQue, minutos) => ({ cerrar: false, estado: null, porQue, minutos: minutos ?? null });

  // 1) LA BÚSQUEDA COLGADA. Nadie lo tomó: no hay conductor a quien avisar.
  if (v.estado === 'esperando') {
    // «Seguir buscando» (`Solicitar.js:877`) devuelve el viaje a `esperando` y
    // escribe `nuevaOferta`, pero NO toca `fechaSolicitud`. Contando desde la
    // fecha vieja, a un pasajero que lleva 25 min dándole al botón se le muere
    // la búsqueda en la mano. Se cuenta desde el último intento.
    const desde = siEsDeFiar(v.nuevaOferta, v.fechaSolicitud, ahora) || v.fechaSolicitud;
    const m = minutosDesde(desde, ahora);
    if (m === null) return no('no tiene fecha de solicitud: no se puede saber si está colgado');
    if (m <= MINUTOS.buscando) return no('lleva buscando ' + Math.round(m) + ' min, y el límite son ' + MINUTOS.buscando, m);
    return {
      cerrar: true, estado: 'vencido', minutos: m,
      porQue: 'llevaba ' + Math.round(m) + ' min buscando conductor y nadie lo tomó',
    };
  }

  // 2) EL VIAJE ACEPTADO. Aquí es donde se miraba solo el reloj.
  if (v.estado === 'aceptado') {
    const rodando = RODANDO.includes(v.fase);

    if (!rodando) {
      // El conductor lo tomó y nunca llegó a recoger a nadie.
      const m = minutosDesde(v.fechaAceptacion || v.fechaSolicitud, ahora);
      if (m === null) return no('no tiene fecha de aceptación ni de solicitud: no se puede medir');
      if (m <= MINUTOS.noRecogio) return no('lo aceptaron hace ' + Math.round(m) + ' min, y el límite son ' + MINUTOS.noRecogio, m);
      return {
        cerrar: true, estado: 'expirado', minutos: m,
        porQue: 'lo aceptaron hace ' + Math.round(m) + ' min y el conductor nunca llegó a recoger',
      };
    }

    // YA HAY ALGUIEN ESPERANDO O MONTADO. El reloj empieza cuando llegó — pero
    // `tiempoEspera` la escribe el CELULAR del conductor, así que solo se usa
    // si es de fiar. Si no, la de `confirmarConductor`, que es del servidor.
    const desde = siEsDeFiar(v.tiempoEspera, v.fechaAceptacion, ahora)
      || v.fechaAceptacion || v.fechaSolicitud;
    const m = minutosDesde(desde, ahora);
    if (m === null) return no('va rodando pero no tiene ninguna fecha: no se toca');
    if (m <= MINUTOS.rodando) {
      return no('va rodando (' + v.fase + ') desde hace ' + Math.round(m)
        + ' min, y el límite son ' + MINUTOS.rodando + ': ESTE VIAJE ESTÁ VIVO', m);
    }
    return {
      cerrar: true, estado: 'expirado', minutos: m,
      porQue: 'lleva ' + Math.round(m) + ' min en «' + v.fase + '» y nadie lo cerró',
    };
  }

  // 3) TODO LO DEMÁS ya está cerrado, o no es cosa de esta rutina.
  return no('el estado «' + (v.estado || 'sin estado') + '» no lo cierra esta rutina');
}

module.exports = { queHacerConElViaje, MINUTOS, RODANDO, minutosDesde, siEsDeFiar };
