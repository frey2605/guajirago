/**
 * ¿PUEDE ESTA PERSONA USAR ESTA PROMOCIÓN? — COPIA de guajirago/functions/promociones.cjs · gemelo G12 (28-sep-2026)
 *
 * La regla vive en el servidor. Esta es una COPIA porque desde aquí no se puede importar aquel archivo.
 * pruebas/reglaPromocion.test.js exige que el trozo entre las marcas sea IGUAL al del servidor y lo ejecuta con
 * los mismos casos: se cambia allá y se copia aquí, o la tanda se pone roja.
 */

// ── LA REGLA (se copia igual en la app y en el panel) ──

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
  // Inicio desde el arranque del día (00:00) y fin hasta el final del día (23:59:59)
  if (new Date(promo.fechaInicio + 'T00:00:00') > ahora || new Date(promo.fechaFin + 'T23:59:59') < ahora) {
    return { codigo: 'fuera-de-fecha' };
  }
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

// ── FIN DE LA REGLA ──
