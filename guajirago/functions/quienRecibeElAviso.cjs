// ─────────────────────────────────────────────────────────────────────────────
// ¿A QUIÉN DEL NEGOCIO LE LLEGA CADA AVISO? — en UN solo sitio (gemelo G64, 29-sep-2026).
//
// El DUEÑO los recibe todos (su token vive en el cuarto privado, negociosPrivado, y lo lee index.js). Esta tabla
// dice qué EMPLEADOS los reciben además, por rol. Hasta G64 cada aviso de index.js elegía a sus empleados a mano, y
// no decían lo mismo. Hoy (medido con scripts/medir-quien-recibe.cjs, ejecutando index.js):
//
//   · pedidoNuevo  (notificarNuevoPedido)   → administrador y recepcionista: los dos ven los pedidos nuevos en
//                                             aliados (el administrador «Todos los pedidos»; el recepcionista, su
//                                             estación «Pedidos por recibir»).
//   · reservaNueva (notificarNuevaReserva)  → SOLO administrador. 🔴 NO es simétrico con el pedido, y es a
//                                             propósito: en una agencia la pantalla «Reservas» solo la abren el
//                                             dueño y el administrador (App.js de aliados). Mandarle el aviso al
//                                             recepcionista sería despertarlo por algo que no puede abrir. Si el
//                                             dueño quiere que el recepcionista de la agencia atienda reservas, hay
//                                             que darle las DOS cosas juntas: la pantalla en aliados y su rol aquí.
//   · cobro        (avisarAlNegocio)        → ningún empleado: el cobro del plan es asunto del dueño.
//
// Lo vigila pruebas/quienRecibe.test.js: corre index.js entero y exige que a cada aviso le lleguen EXACTAMENTE
// el dueño y estos roles; que cada rol exista en aliados; y que aliados le registre el token y le deje abrir la
// pantalla a todo el que recibe un aviso.
// ─────────────────────────────────────────────────────────────────────────────
const EMPLEADOS_QUE_RECIBEN = Object.freeze({
  pedidoNuevo: Object.freeze(['administrador', 'recepcionista']),
  reservaNueva: Object.freeze(['administrador']),
  cobro: Object.freeze([]),
});

function rolesQueReciben(aviso) {
  const roles = EMPLEADOS_QUE_RECIBEN[aviso];
  // Un nombre de aviso mal escrito no puede dejar a todos sin aviso en silencio: se revienta y el registro lo dice.
  if (!roles) throw new Error('quienRecibeElAviso: no conozco el aviso «' + aviso + '»');
  return roles;
}

/** ¿Le llega este aviso a este empleado? Tiene que tener token, no estar apagado y tener uno de los roles. */
function leLlegaAlEmpleado(aviso, empleado) {
  const roles = rolesQueReciben(aviso);
  const e = empleado || {};
  const suyos = e.roles || {};
  return !!e.fcmToken && e.activo !== false && roles.some((r) => suyos[r]);
}

/** Los tokens de los empleados del negocio a los que les llega el aviso. Si ningún rol lo recibe, ni se consulta. */
async function tokensDeLosEmpleados(db, negocioId, aviso) {
  if (rolesQueReciben(aviso).length === 0) return [];
  const snap = await db.collection("empleados").where("restauranteId", "==", negocioId).get();
  const tokens = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (leLlegaAlEmpleado(aviso, d)) tokens.push(d.fcmToken);
  });
  return tokens;
}

module.exports = { EMPLEADOS_QUE_RECIBEN, rolesQueReciben, leLlegaAlEmpleado, tokensDeLosEmpleados };
