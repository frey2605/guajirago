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
