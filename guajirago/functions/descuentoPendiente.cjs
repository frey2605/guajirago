/**
 * EL DESCUENTO PENDIENTE DE UNA FICHA, Y SU CÓDIGO DE 4 CIFRAS — gemelo G18 (28-sep-2026)
 *
 * `usuarios/{uid}.descuentoPendiente` es PLATA: cuando el pasajero lo usa en un viaje, `consumirDescuentoViaje` le
 * abona ese descuento al conductor. Hasta hoy nacía en DOS sitios:
 *   · aquí, en el servidor, al canjear un código de promoción (`reclamarPromocion`);
 *   · en el TELÉFONO (Login.js), el crédito de bienvenida del pasajero nuevo: el celular decidía el valor ($8.000),
 *     miraba la config y la huella del aparato, y fabricaba el código con su propia receta.
 * Y la receta del código («cuatro cifras al azar, 1000–9999») estaba escrita TRES veces: Login.js, index.js y
 * guajirago/src/codigoSeguridad.js.
 *
 * Ahora los dos descuentos se fabrican AQUÍ, con una sola receta, y el teléfono solo enseña lo que el servidor le
 * contesta. La receta del código vive una vez en el servidor (`codigoDeCuatroCifras`) y una vez en la app
 * (`generarCodigoSeguridad`, el código de seguridad del viaje, que sí nace en el celular). Son dos porque la nube no
 * puede importar la app; pruebas/descuentoBienvenida.test.js EJECUTA las dos y exige que sean la misma receta.
 */

/** Cuatro cifras al azar (1000–9999). La MISMA receta que generarCodigoSeguridad de guajirago/src/codigoSeguridad.js. */
function codigoDeCuatroCifras() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** El crédito de bienvenida del pasajero nuevo, en pesos. Antes vivía en Login.js (VALOR_CREDITO_BIENVENIDA). */
const CREDITO_BIENVENIDA_PASAJERO = 8000;

/** El promoId con que se apunta el descuento de bienvenida (lo lee el conductor y el cobro, como el de antes). */
const PROMO_BIENVENIDA = 'BIENVENIDA';

/**
 * La ficha `descuentoPendiente` tal como se guarda. Los mismos campos que armaban el servidor y el teléfono (los lee
 * guajirago/src/descuentos.js al crear el viaje), más `fabricadoPor`, para que se pueda medir quién lo hizo.
 */
function armarDescuentoPendiente({ promoId, tipoBeneficio, valorBeneficio }, fechaISO, codigo) {
  return {
    promoId,
    tipoBeneficio,
    valorBeneficio: valorBeneficio || 0,
    fechaActivacion: fechaISO,
    codigoVerificacion: codigo === undefined ? codigoDeCuatroCifras() : codigo,
    fabricadoPor: 'servidor',
  };
}

/**
 * ¿Le toca el crédito de bienvenida a esta persona? Devuelve el MOTIVO por el que no (un texto corto) o null si le
 * toca. Las mismas condiciones que miraba el teléfono —el interruptor del panel (`viajeGratisNuevoPasajero`, encendido
 * si no está) y que el aparato no lo haya usado ya— y las que el teléfono no podía comprobar de verdad: que la
 * persona no lo haya recibido antes (en otro aparato), que sea pasajero, que sea NUEVA (sin viajes pedidos) y que no
 * tenga ya otro descuento pendiente (no se le pisa).
 */
function porQueNoLaBienvenida({ config, ficha, aparatoYaUsado, yaLaRecibio, viajesPedidos }) {
  if (!ficha) return 'sin_ficha';
  if ((config || {}).viajeGratisNuevoPasajero === false) return 'apagada';
  if (ficha.tipo === 'conductor') return 'es_conductor';
  if (yaLaRecibio) return 'ya_recibida';
  if (aparatoYaUsado) return 'aparato_usado';
  if ((viajesPedidos || 0) > 0) return 'no_es_nuevo';
  if (ficha.descuentoPendiente) return 'ya_tiene_descuento';
  return null;
}

/** El identificador del aparato que manda el teléfono, si sirve como nombre de documento; si no, null. */
function aparatoSano(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 100 && !v.includes('/') && v !== '.' && v !== '..'
    && !/^__.*__$/.test(v) ? v : null;
}

module.exports = {
  codigoDeCuatroCifras, CREDITO_BIENVENIDA_PASAJERO, PROMO_BIENVENIDA,
  armarDescuentoPendiente, porQueNoLaBienvenida, aparatoSano,
};
