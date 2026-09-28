#!/usr/bin/env node
/**
 * ¿CUÁNTO «INVERTIDO» DE LAS PROMOCIONES ES PLATA DE VERDAD? — gemelo G17 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-invertido-promociones.cjs
 *
 * El uso de una promoción lo apuntaban DOS sitios, cada uno con su receta:
 *   · el servidor (`consumirDescuentoViaje`), cuando el conductor verifica el código: suma lo que se
 *     descontó del viaje, en pesos;
 *   · el panel (asignar a mano), que sumaba `valorBeneficio`: con una promoción de PORCENTAJE eso es
 *     un 20 (por ciento) sumado como si fueran $20.
 * Este guion cuenta, contra producción y por promoción:
 *   · el «Invertido» que enseña el panel (`inversionTotal`) y los usos (`usosTotales`);
 *   · la suma de los apuntes del historial, y si cuadra con el total;
 *   · cuántos apuntes de promociones de porcentaje NO tienen detrás un viaje cobrado de esa persona por
 *     ese mismo valor (o sea: un porcentaje sumado como pesos), y cuántos «pesos» falsos suman;
 *   · las personas (`usos/{uid}`) que apuntó el panel (solo el panel escribe `nombreUsuario`).
 * No escribe nada. Se corre antes y después del arreglo (pasos 1 y 12).
 */
const { traer, doc } = require('./nube.cjs');
const { cop } = require('../guajirago/functions/moneda.cjs');

async function main() {
  const [promosCrudas, viajesCrudos] = await Promise.all([traer('promociones'), traer('viajes')]);
  const promos = promosCrudas.map(doc);
  const viajes = viajesCrudos.map(doc);

  // Los descuentos cobrados de verdad: viaje con descuentoInfo consumido.
  const cobrados = viajes.filter((v) => v.descuentoInfo && v.descuentoInfo.consumido === true && v.descuentoInfo.promoId);

  console.log('PROMOCIONES en producción: ' + promos.length + ' (de porcentaje: '
    + promos.filter((p) => p.tipoBeneficio === 'descuento').length + ') · viajes con descuento cobrado: ' + cobrados.length);
  let totalInvertido = 0; let totalFalso = 0; let apuntesFalsos = 0; let descuadres = 0; let usosDelPanel = 0;
  let apuntes = 0;
  for (const p of promos) {
    const historial = p.historialUsos || [];
    apuntes += historial.length;
    const sumaHistorial = historial.reduce((a, h) => a + (Number(h.valor) || 0), 0);
    const inv = Number(p.inversionTotal) || 0;
    totalInvertido += inv;
    const cuadra = sumaHistorial === inv && historial.length === (Number(p.usosTotales) || 0);
    if (!cuadra) descuadres++;

    // De porcentaje: cada apunte debería venir de un viaje cobrado de esa persona con esa promoción.
    let falsos = 0; let pesosFalsos = 0;
    if (p.tipoBeneficio === 'descuento') {
      const libres = cobrados.filter((v) => v.descuentoInfo.promoId === p.id).map((v) => ({
        uid: v.pasajeroId, pesos: Number(v.descuentoInfo.descuentoAplicado) || 0,
      }));
      for (const h of historial) {
        const i = libres.findIndex((l) => l.uid === h.usuarioId && l.pesos === (Number(h.valor) || 0));
        if (i >= 0) libres.splice(i, 1);
        else { falsos++; pesosFalsos += Number(h.valor) || 0; }
      }
    }
    apuntesFalsos += falsos; totalFalso += pesosFalsos;

    // eslint-disable-next-line no-await-in-loop
    const usos = (await traer('promociones/' + p.id + '/usos')).map(doc);
    const delPanel = usos.filter((u) => u.nombreUsuario !== undefined).length;
    usosDelPanel += delPanel;

    console.log('  ' + (falsos ? '🔴' : cuadra ? '✓' : '⚠') + ' ' + p.id + ' · ' + (p.tipoBeneficio || '?')
      + ' ' + (p.valorBeneficio ?? '?') + (p.tipoBeneficio === 'descuento' ? '%' : '')
      + ' · Invertido ' + cop(inv) + ' · usos ' + (p.usosTotales || 0)
      + ' · historial ' + historial.length + ' apuntes = ' + cop(sumaHistorial) + (cuadra ? '' : ' (NO CUADRA)')
      + ' · personas ' + usos.length + ' (del panel: ' + delPanel + ')'
      + (falsos ? ' · ' + falsos + ' apunte(s) de porcentaje SIN viaje cobrado = ' + cop(pesosFalsos) + ' falsos' : ''));
  }
  console.log('\nRESUMEN');
  console.log('  · «Invertido» total que enseña el panel: ' + cop(totalInvertido) + ' en ' + apuntes + ' apuntes');
  console.log('  · apuntes de porcentaje sumados como pesos (sin viaje cobrado detrás): ' + apuntesFalsos
    + ' → ' + cop(totalFalso) + ' que NO son plata');
  console.log('  · promociones cuyo total no cuadra con su historial: ' + descuadres);
  console.log('  · personas apuntadas por el panel (asignar a mano): ' + usosDelPanel);
}

main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
