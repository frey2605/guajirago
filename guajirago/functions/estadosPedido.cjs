// ─────────────────────────────────────────────────────────────────────────────
// ¿QUÉ AVISO LE LLEGA AL CLIENTE CUANDO SU PEDIDO CAMBIA? — gemelo G33, 28-sep-2026.
//
// La usa el servidor (avisarAlClienteDelCambio, en index.js). El aviso lo MANDA avisos.cjs (G32); aquí solo se
// decide CUÁL.
//
// Antes el servidor tenía su propia tabla de avisos por ESTADO DEL NEGOCIO, y no conocía «empacado» ni «cerrado».
// Si el negocio apagaba la etapa «entregado» (ConfigFlujos.js de aliados), el pedido saltaba de «en camino» a
// «cerrado» y al cliente NO le llegaba «¡Pedido entregado!» (8 de las 16 formas de armar el flujo).
//
// Ahora se avisa por PASO DEL CLIENTE: cuando el paso cambia, se manda el aviso de ese paso. «cerrado» es el paso
// «entregado» para el cliente, así que el aviso llega aunque la etapa esté apagada; y si estaba encendida, el
// «entregado → cerrado» no cambia de paso y no se repite.
//
// PASO_DEL_ESTADO es COPIA de la de la app (guajirago/src/estadosPedido.js): la nube no puede importar la app.
// pruebas/estadosPedido.test.js ejecuta las dos y exige que digan lo mismo y que cubran los estados de
// guajirago-aliados/src/flujoPedidos.js, que es la fuente de los estados.
// ─────────────────────────────────────────────────────────────────────────────

const PASO_DEL_ESTADO = {
  nuevo: 'nuevo',
  confirmado: 'confirmado',
  preparando: 'preparando',
  empacado: 'preparando',
  en_camino: 'en_camino',
  entregado: 'entregado',
  cerrado: 'entregado',
  cancelado: 'cancelado',
};

const pasoDelCliente = (estado) => PASO_DEL_ESTADO[estado] || null;

/** El aviso ({ title, body }) de cada paso del cliente. «nuevo» no lleva: el cliente acaba de pedirlo. */
function textoDelPaso(paso, pedido) {
  const restNombre = pedido.restauranteNombre || 'El restaurante';
  const textos = {
    confirmado: { title: '✅ Pedido confirmado', body: restNombre + ' confirmó tu pedido' + (pedido.tiempoEstimado ? ' · listo en ~' + pedido.tiempoEstimado + ' min' : '') },
    preparando: { title: '👨‍🍳 Preparando tu pedido', body: 'Ya están cocinando lo tuyo en ' + restNombre },
    en_camino: { title: '🛵 Tu pedido va en camino', body: 'El domiciliario salió con tu pedido' },
    entregado: { title: '🎉 ¡Pedido entregado!', body: '¡Buen provecho! Gracias por pedir con GuajiraGo' },
    cancelado: { title: '❌ Pedido cancelado', body: 'Tu pedido en ' + restNombre + ' fue cancelado' + (pedido.motivoRechazo ? ': ' + pedido.motivoRechazo : '') },
  };
  return textos[paso] || null;
}

/** El aviso que toca por este cambio, o null si el cliente no tiene que enterarse (mismo paso, o paso sin aviso). */
function avisoDelCambio(antes, despues) {
  if (!despues) return null;
  const pasoAntes = pasoDelCliente(antes && antes.estado);
  const pasoAhora = pasoDelCliente(despues.estado);
  if (!pasoAhora || pasoAhora === pasoAntes) return null;
  return textoDelPaso(pasoAhora, despues);
}

module.exports = { PASO_DEL_ESTADO, pasoDelCliente, textoDelPaso, avisoDelCambio };
