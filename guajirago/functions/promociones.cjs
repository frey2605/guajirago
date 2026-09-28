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
 * Lo que NO decide esta regla (y está anotado aparte): la vigencia se lee en la hora de la máquina que la corre
 * —el servidor está en UTC, el celular en Colombia— (G16). Aquí se dejó igual que estaba en los tres sitios.
 */

// ── LA REGLA (se copia igual en la app y en el panel) ──

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

module.exports = { viajesMinimosDe, motivoPorLaPromocion, motivoParaNoUsar, textoParaQuienLaUsa };
