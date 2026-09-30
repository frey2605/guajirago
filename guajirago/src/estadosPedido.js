// ─────────────────────────────────────────────────────────────────────────────
// EL PEDIDO A DOMICILIO, VISTO POR EL CLIENTE — gemelo G33, 28-sep-2026.
//
// Los estados del pedido los decide el NEGOCIO: su lista y su orden viven en guajirago-aliados/src/flujoPedidos.js
// (ORDEN_ESTADOS y ESTADO_META), que es la fuente. El negocio puede apagar etapas (ConfigFlujos.js), así que un
// pedido puede saltar de «en camino» a «cerrado» sin pasar por «entregado».
//
// El cliente no ve esas etapas internas: ve 5 PASOS. Esta pieza dice a qué paso corresponde cada estado del negocio,
// y es la ÚNICA que lo dice en la app (Restaurantes.js la usa en el seguimiento y en «Mis pedidos»).
//
// El servidor necesita la misma tabla para saber QUÉ AVISO mandarle al cliente, y no puede importar la app
// (`functions/` es otro paquete): guajirago/functions/estadosPedido.cjs lleva una COPIA. pruebas/estadosPedido.test.js
// las EJECUTA a las dos y exige que digan lo mismo, y que cubran todos los estados de flujoPedidos.js.
//
// A PROPÓSITO distinto del negocio: para el cliente «entregado» y «cerrado» son el MISMO paso final (ya le llegó);
// para el negocio «entregado» no es final (falta cuadrar la caja). No se «arregla».
// ─────────────────────────────────────────────────────────────────────────────

// Los 5 pasos que ve el cliente, en orden.
export const PASOS_DEL_CLIENTE = [
  { id: 'nuevo', label: 'Recibido', icono: '📩' },
  { id: 'confirmado', label: 'Confirmado', icono: '✅' },
  { id: 'preparando', label: 'Preparando', icono: '👨‍🍳' },
  { id: 'en_camino', label: 'En camino', icono: '🏍️' },
  { id: 'entregado', label: 'Entregado', icono: '🎉' },
];

// Cada estado del negocio → el paso del cliente. «cancelado» no es un paso: se pinta aparte.
export const PASO_DEL_ESTADO = {
  nuevo: 'nuevo',
  confirmado: 'confirmado',
  preparando: 'preparando',
  empacado: 'preparando',
  en_camino: 'en_camino',
  entregado: 'entregado',
  cerrado: 'entregado',
  cancelado: 'cancelado',
};

// El paso del cliente de un estado del negocio (null si el estado no es de un pedido a domicilio).
export const pasoDelCliente = (estado) => PASO_DEL_ESTADO[estado] || null;

// El número del paso (0..4) para pintar la línea del seguimiento; -1 si no tiene (cancelado o desconocido).
export const indiceDelPaso = (estado) => PASOS_DEL_CLIENTE.findIndex((p) => p.id === pasoDelCliente(estado));

// ¿Ya le llegó el pedido al cliente? (entregado o cerrado: sea cual sea la etapa que el negocio tenga encendida)
export const yaLlegoAlCliente = (estado) => pasoDelCliente(estado) === 'entregado';

// ¿Ya terminó para el cliente? (le llegó o se canceló): no se le enseña el «Listo en ~N min».
export const terminadoParaElCliente = (estado) => ['entregado', 'cancelado'].includes(pasoDelCliente(estado));

// Cómo se llama el estado para el cliente; si es uno que no conoce, se enseña tal cual (como antes).
export const etiquetaParaElCliente = (estado) => {
  if (pasoDelCliente(estado) === 'cancelado') return 'Cancelado';
  const paso = PASOS_DEL_CLIENTE.find((p) => p.id === pasoDelCliente(estado));
  return paso ? paso.label : estado;
};

// ¿QUIÉN CANCELÓ EL PEDIDO, Y POR QUÉ? — gemelo G84, 29-sep-2026.
// PIEZA COMPARTIDA: la usan la app del cliente (Restaurantes.js) y el restaurante (aliados/PedidosDomicilio.js).
// Este bloque está IGUAL, letra por letra, en guajirago/src/estadosPedido.js y en guajirago-aliados/src/flujoPedidos.js
// (otro repo, no puede importarlo): lo atan pruebas/quienCancelo.test.js y scripts/medir-quien-cancelo.cjs.
// Antes cada app lo decidía a su manera y, con los pedidos viejos que no traen `canceladoPor`, el cliente leía
// «Cancelado por ti» y el restaurante «Rechazado por el restaurante» del MISMO pedido.
//   · `canceladoPor` manda: 'cliente' lo escribe la app al cancelar y 'restaurante' aliados al rechazar.
//   · Sin él (pedidos viejos), se mira el motivo: `motivoRechazo` solo lo escribe el restaurante y
//     `motivoCancelacion` solo el cliente.
//   · Sin nada de eso no se sabe, y no se inventa: quien = null (la pantalla dice solo «Cancelado»).
// El motivo es el mismo que ya enseñaban las dos: el del restaurante, o si no el del cliente.
export const quienCanceloElPedido = (pedido) => {
  const p = pedido || {};
  const motivo = p.motivoRechazo || p.motivoCancelacion || null;
  if (p.canceladoPor === 'cliente' || p.canceladoPor === 'restaurante') return { quien: p.canceladoPor, motivo };
  if (p.motivoRechazo) return { quien: 'restaurante', motivo };
  if (p.motivoCancelacion) return { quien: 'cliente', motivo };
  return { quien: null, motivo };
};

// ¿CÓMO SE PAGA UN PEDIDO? — gemelo G85, 30-sep-2026.
// PIEZA COMPARTIDA: los métodos de pago de un pedido. La app del cliente los ofrece al pedir (Restaurantes.js) y el
// restaurante al cerrar la venta del domicilio y de la mesa, y los cuenta en el corte de caja (aliados).
// Este bloque está IGUAL, letra por letra, en guajirago/src/estadosPedido.js y en guajirago-aliados/src/flujoPedidos.js
// (otro repo, no puede importarlo): lo atan pruebas/metodosPago.test.js y scripts/medir-metodos-pago.cjs.
// El pedido guarda el nombre tal cual (`metodoPago`, y `metodo` en cada renglón de `pagos`), o 'Mixto' si se pagó con
// varios: cambiar un nombre aquí deja los pedidos viejos en «Sin especificar» del corte de caja.
export const METODOS_PAGO = ['Efectivo', 'Nequi', 'Daviplata', 'Tarjeta'];

// ¿QUÉ NÚMERO LLEVA EL PEDIDO? — gemelo G94, 30-sep-2026.
// PIEZA COMPARTIDA: el número corto del pedido («Pedido #ABCDE») son las 5 últimas letras de su id, en mayúsculas.
// Lo enseñan la app del cliente (Restaurantes.js) y el restaurante (aliados: HistorialDomicilios.js y PedidosDomicilio.js,
// en la tarjeta, el recibo, la comanda, el WhatsApp y el chat), y cliente y restaurante lo usan para hablar del MISMO pedido.
// Este bloque está IGUAL, letra por letra, en guajirago/src/estadosPedido.js y en guajirago-aliados/src/flujoPedidos.js
// (otro repo, no puede importarlo): lo atan pruebas/numeroPedido.test.js y scripts/medir-numero-pedido.cjs.
export const numeroDelPedido = (id) => (id || '').slice(-5).toUpperCase();
