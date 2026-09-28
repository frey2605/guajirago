/**
 * ¿PUEDE ESTA PERSONA USAR ESTA PROMOCIÓN? — LA REGLA ÚNICA · gemelo G12 (28-sep-2026)
 *
 * Tres sitios lo decidían, cada uno a su manera:
 *   · el servidor (reclamarPromocion, el canje con el código) miraba activa, fechas, tipo de cuenta y tope por
 *     persona, pero NO los «viajes previos»: con el código, un pasajero nuevo canjeaba una promoción que pedía
 *     5 viajes, y el descuento se lo abona GuajiraGo al conductor;
 *   · la app (la lista de ofertas) miraba activa, fechas y tipo de cuenta;
 *   · el panel (asignar a mano) miraba tipo de cuenta, viajes previos y tope, pero NO activa ni fechas: asignaba
 *     promociones vencidas o apagadas sin decir nada.
 * Decisión del dueño (la recomendada): el servidor exige también los viajes previos, y el panel no puede asignar
 * una promoción vencida o inactiva.
 *
 * ESTE archivo es la fuente. La app y el panel no pueden importarlo (la nube es otro paquete; el panel, otro repo),
 * así que llevan una COPIA en `guajirago/src/reglaPromocion.js` y `guajirago-admin/src/reglaPromocion.js`.
 * pruebas/reglaPromocion.test.js exige que el trozo entre las dos marcas de abajo sea IGUAL en los tres, y los
 * EJECUTA con los mismos casos. Se cambia aquí y se copia; si no, la tanda se pone roja.
 *
 * LA VIGENCIA, EN HORA DE COLOMBIA · gemelo G16 (28-sep-2026). Las fechas se guardan como un DÍA («2026-10-05»,
 * lo que da un <input type="date">). Antes cada máquina las leía en SU hora: el servidor (UTC) daba la promoción
 * por empezada a las 7 de la noche del día anterior y por acabada a las 7 de la noche del último día; el teléfono,
 * de 00:00 a 23:59 de Colombia. En esas horas la app ofrecía una promoción y el canje decía «ya no está
 * disponible». Ahora `etapaDeVigencia` compara el DÍA de hoy en Colombia (`hoyEnColombia`, de cobros.cjs: no hay
 * otro) con el día guardado, y da lo mismo en cualquier máquina. La usan también los anuncios (Anuncio.js y
 * Superadmin.js) y las promos de restaurante (Restaurantes.js): una sola respuesta a «¿esta fecha está vigente hoy?».
 * La app y el panel no pueden importar cobros.cjs: su copia de `hoyEnColombia` va fuera de las marcas, y
 * pruebas/vigenciaHoy.test.js exige que sea la misma función y la ejecuta.
 */
const { hoyEnColombia } = require('./cobros.cjs');

// ── LA REGLA (se copia igual en la app y en el panel) ──

/**
 * ¿En qué punto está hoy (en Colombia) un rango de días AAAA-MM-DD? 'antes' (aún no empieza), 'vigente' o 'despues'
 * (ya se acabó). Los dos extremos cuentan enteros: del primer día a las 00:00 al último a las 23:59, hora de Colombia.
 * Un extremo vacío no limita. Uno que no es AAAA-MM-DD no se puede leer: no se da por vigente ('despues').
 */
function etapaDeVigencia(fechaInicio, fechaFin, ahora) {
  const hoy = hoyEnColombia(ahora);
  const esDia = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f));
  if ((fechaInicio && !esDia(fechaInicio)) || (fechaFin && !esDia(fechaFin))) return 'despues';
  if (fechaInicio && hoy < fechaInicio) return 'antes';
  if (fechaFin && hoy > fechaFin) return 'despues';
  return 'vigente';
}

/** Cuántos viajes completados pide la promoción antes de poder usarla. 0 = ninguno. */
function viajesMinimosDe(promo) {
  const n = Number((promo && promo.viajesMinimosRequeridos) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Lo que depende solo de la promoción y del tipo de cuenta: si está encendida, si está en sus fechas y si es para
 * este tipo de cuenta. Devuelve null si se puede, o el motivo { codigo, ... } si no.
 */
function motivoPorLaPromocion(promo, esConductor, ahora) {
  if (!promo || !promo.activa) return { codigo: 'inactiva' };
  // G16: del primer día a las 00:00 al último a las 23:59, en hora de COLOMBIA (no en la de la máquina).
  if (etapaDeVigencia(promo.fechaInicio, promo.fechaFin, ahora) !== 'vigente') return { codigo: 'fuera-de-fecha' };
  if (promo.aplicaA === 'pasajeros' && esConductor) return { codigo: 'otro-tipo', aplicaA: 'pasajeros' };
  if (promo.aplicaA === 'conductores' && !esConductor) return { codigo: 'otro-tipo', aplicaA: 'conductores' };
  return null;
}

/**
 * La regla entera. `persona` = { esConductor, usosPrevios, viajesCompletados }. Si la promoción pide viajes previos
 * y `viajesCompletados` no es un número, NO se deja: quien llama tiene que haberlos contado.
 */
function motivoParaNoUsar(promo, persona, ahora) {
  const quien = persona || {};
  const porLaPromo = motivoPorLaPromocion(promo, !!quien.esConductor, ahora);
  if (porLaPromo) return porLaPromo;
  if (promo.limiteUsosPorPersona && (quien.usosPrevios || 0) >= promo.limiteUsosPorPersona) {
    return { codigo: 'limite', limite: promo.limiteUsosPorPersona };
  }
  const minimos = viajesMinimosDe(promo);
  if (minimos > 0 && !(quien.viajesCompletados >= minimos)) {
    return { codigo: 'faltan-viajes', minimos, tiene: Number(quien.viajesCompletados) || 0 };
  }
  return null;
}

/** El motivo en palabras para quien la quiere usar (las del canje de siempre, más la de los viajes). */
function textoParaQuienLaUsa(motivo) {
  if (!motivo) return '';
  if (motivo.codigo === 'otro-tipo') return 'Esta promoción no aplica para tu tipo de cuenta';
  if (motivo.codigo === 'limite') return 'Ya usaste esta promoción el máximo de veces permitido';
  if (motivo.codigo === 'faltan-viajes') {
    return 'Esta promoción es para quien ya tiene ' + motivo.minimos + ' viajes completados. Llevas ' + motivo.tiene;
  }
  return 'Esta promoción ya no está disponible';
}

// ── FIN DE LA REGLA ──

module.exports = {
  etapaDeVigencia, hoyEnColombia, viajesMinimosDe, motivoPorLaPromocion, motivoParaNoUsar, textoParaQuienLaUsa,
};
