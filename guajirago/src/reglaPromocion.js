/**
 * ¿PUEDE ESTA PERSONA USAR ESTA PROMOCIÓN? — COPIA de guajirago/functions/promociones.cjs · gemelo G12 (28-sep-2026)
 *
 * La regla vive en el servidor. Esta es una COPIA porque desde aquí no se puede importar aquel archivo.
 * pruebas/reglaPromocion.test.js exige que el trozo entre las marcas sea IGUAL al del servidor y lo ejecuta con
 * los mismos casos: se cambia allá y se copia aquí, o la tanda se pone roja.
 *
 * G16 (28-sep-2026): la vigencia se decide con el DÍA de hoy en Colombia (`etapaDeVigencia`), no con la hora del
 * aparato. La usan también los anuncios y las promos de restaurante: «¿esta fecha AAAA-MM-DD está vigente hoy?».
 */

/**
 * COPIA de `hoyEnColombia` (guajirago/functions/cobros.cjs), que es la fuente: la fecha de hoy, AAAA-MM-DD, en hora
 * de Colombia. pruebas/vigenciaHoy.test.js exige que sea la misma función, letra por letra, y la ejecuta.
 */
export function hoyEnColombia(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  // Colombia es UTC−5 todo el año: no tiene cambio de horario.
  const local = new Date(d.getTime() - 5 * 3600000);
  return local.toISOString().slice(0, 10);
}

// ── LA REGLA (se copia igual en la app y en el panel) ──

/**
 * ¿En qué punto está hoy (en Colombia) un rango de días AAAA-MM-DD? 'antes' (aún no empieza), 'vigente' o 'despues'
 * (ya se acabó). Los dos extremos cuentan enteros: del primer día a las 00:00 al último a las 23:59, hora de Colombia.
 * Un extremo vacío no limita. Uno que no es AAAA-MM-DD no se puede leer: no se da por vigente ('despues').
 */
export function etapaDeVigencia(fechaInicio, fechaFin, ahora) {
  const hoy = hoyEnColombia(ahora);
  const esDia = (f) => /^\d{4}-\d{2}-\d{2}$/.test(String(f));
  if ((fechaInicio && !esDia(fechaInicio)) || (fechaFin && !esDia(fechaFin))) return 'despues';
  if (fechaInicio && hoy < fechaInicio) return 'antes';
  if (fechaFin && hoy > fechaFin) return 'despues';
  return 'vigente';
}

/** Cuántos viajes completados pide la promoción antes de poder usarla. 0 = ninguno. */
export function viajesMinimosDe(promo) {
  const n = Number((promo && promo.viajesMinimosRequeridos) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Lo que depende solo de la promoción y del tipo de cuenta: si está encendida, si está en sus fechas y si es para
 * este tipo de cuenta. Devuelve null si se puede, o el motivo { codigo, ... } si no.
 */
export function motivoPorLaPromocion(promo, esConductor, ahora) {
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
export function motivoParaNoUsar(promo, persona, ahora) {
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
export function textoParaQuienLaUsa(motivo) {
  if (!motivo) return '';
  if (motivo.codigo === 'otro-tipo') return 'Esta promoción no aplica para tu tipo de cuenta';
  if (motivo.codigo === 'limite') return 'Ya usaste esta promoción el máximo de veces permitido';
  if (motivo.codigo === 'faltan-viajes') {
    return 'Esta promoción es para quien ya tiene ' + motivo.minimos + ' viajes completados. Llevas ' + motivo.tiene;
  }
  return 'Esta promoción ya no está disponible';
}

/**
 * G17 · ¿CUÁNTOS PESOS COSTÓ ESTE USO? `descuentoDelViaje` = lo que se le descontó a un viaje
 * (descuentoInfo.descuentoAplicado), cuando el uso sale de un viaje. Sin viaje, solo una promoción de CRÉDITO tiene
 * costo en pesos (su valorBeneficio); una de porcentaje no: su 20 es un 20 %, no $20. Devuelve null si no se sabe.
 */
export function pesosDelUso(promo, descuentoDelViaje) {
  const esPesos = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  if (descuentoDelViaje !== undefined) return esPesos(descuentoDelViaje) ? descuentoDelViaje : null;
  if (!promo || promo.tipoBeneficio !== 'credito') return null;
  const v = Number(promo.valorBeneficio || 0);
  return esPesos(v) ? v : null;
}

/**
 * G17 · «Esta persona usó la promoción»: lo que se apunta en promociones/{id}/usos/{uid}. Es el contador del tope
 * por persona (lo lee reclamarPromocion y el panel). No lleva pesos.
 */
export function apunteDeLaPersona(usoPrevio, fecha) {
  return { veces: ((usoPrevio && usoPrevio.veces) || 0) + 1, ultimaFecha: fecha };
}

/**
 * G17 · «Se usó la promoción y costó tantos pesos»: lo que se apunta en promociones/{id} (los usos y el
 * «Invertido» que enseña el panel). `pesos` sale de pesosDelUso: si no es un número de pesos, REVIENTA en vez de
 * sumar un porcentaje como si fuera plata.
 */
export function apunteEnLaPromocion(promo, usuarioId, fecha, pesos) {
  if (!(typeof pesos === 'number' && Number.isFinite(pesos) && pesos >= 0)) {
    throw new Error('El costo del uso no está en pesos: ' + pesos);
  }
  const p = promo || {};
  return {
    usosTotales: (p.usosTotales || 0) + 1,
    inversionTotal: (p.inversionTotal || 0) + pesos,
    historialUsos: [...(p.historialUsos || []), { usuarioId, fecha, valor: pesos }],
  };
}

// ── FIN DE LA REGLA ──
