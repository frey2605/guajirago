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

/**
 * ¿CUÁNTO VALE DE VERDAD el descuento pendiente de esta ficha? — pendiente P02 (30-sep-2026). FUNCIÓN PURA.
 *
 * Es la ÚNICA fuente del valor del descuento de un viaje: la usan `confirmarConductor` (para armar la ficha del viaje)
 * y `consumirDescuentoViaje` (para saber cuánto abonarle al conductor). Antes las dos se creían el número escrito
 * DENTRO del viaje (`descuentoInfo`), que el pasajero y el conductor podían cambiar: un conductor se escribía
 * `descuentoAplicado: 999999` y se lo abonaba.
 *
 * Devuelve { promoId, tipoBeneficio, valorBeneficio, codigoVerificacion } si vale, o null si no vale nada:
 *   · con la firma del servidor (`fabricadoPor: 'servidor'`, G18) vale lo que dice: desde P01 el teléfono ya no puede
 *     escribir la ficha, así que esa cifra la puso el servidor (o el panel);
 *   · SIN firma (los de antes de G18) solo vale si es EXACTAMENTE lo de su origen: la bienvenida ($8.000 de crédito) o
 *     el tipo y valor que tiene hoy su promoción (`promo`, el documento de `promociones/{promoId}`, o null). Si no
 *     cuadra, NO vale: se escoge lo que no paga de más. Ejemplo: una ficha sin firma que diga «BIENVENIDA, $50.000»
 *     no da descuento (el viaje se cobra entero); una sin firma de «BIENVENIDA, $8.000» sí da sus $8.000.
 *   · en los dos casos: un crédito tiene que ser un número mayor que 0, un porcentaje entre 1 y 100 (más de 100 daría
 *     una tarifa negativa, hallazgo del G01), y tiene que traer su código de cifras.
 */
function descuentoQueVale(desc, promo) {
  if (!desc || typeof desc !== 'object') return null;
  const { promoId, tipoBeneficio, valorBeneficio } = desc;
  if (typeof valorBeneficio !== 'number' || !Number.isFinite(valorBeneficio) || valorBeneficio <= 0) return null;
  if (tipoBeneficio !== 'credito' && !(tipoBeneficio === 'descuento' && valorBeneficio <= 100)) return null;
  const codigo = String(desc.codigoVerificacion == null ? '' : desc.codigoVerificacion).replace(/\D/g, '');
  if (!codigo) return null;
  if (desc.fabricadoPor !== 'servidor') {
    const cuadra = promoId === PROMO_BIENVENIDA
      ? tipoBeneficio === 'credito' && valorBeneficio === CREDITO_BIENVENIDA_PASAJERO
      : !!promo && promo.tipoBeneficio === tipoBeneficio && (promo.valorBeneficio || 0) === valorBeneficio;
    if (!cuadra) return null;
  }
  return { promoId, tipoBeneficio, valorBeneficio, codigoVerificacion: codigo };
}

/** El identificador del aparato que manda el teléfono, si sirve como nombre de documento; si no, null. */
function aparatoSano(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 100 && !v.includes('/') && v !== '.' && v !== '..'
    && !/^__.*__$/.test(v) ? v : null;
}

module.exports = {
  codigoDeCuatroCifras, CREDITO_BIENVENIDA_PASAJERO, PROMO_BIENVENIDA,
  armarDescuentoPendiente, porQueNoLaBienvenida, aparatoSano, descuentoQueVale,
};
