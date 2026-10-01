/**
 * 🍽️ EL PRECIO DEL PEDIDO LO PONE EL SERVIDOR — P09 (30-sep-2026)
 *
 * Hasta hoy el total de un domicilio lo decidía el TELÉFONO: la app de transporte (Restaurantes.js) mandaba cada plato
 * CON SU PRECIO, el subtotal y el total, y aliados confirmaba con esos mismos números. Una app modificada pedía un
 * sancocho de $18.000 a $1, o seguía usando una promoción ya agotada (el tope solo lo miraba la app: hallazgo de P08).
 *
 * Ahora, cuando nace un pedido de un cliente, el servidor (notificarNuevoPedido, index.js) toma de cada línea solo QUÉ
 * se pidió —el plato, sus adiciones, cuántos y la promoción que dice usar— y le pone el PRECIO DEL MENÚ del negocio,
 * con la promoción solo si vale hoy (en hora de Colombia) y si ese teléfono no llenó su tope; y suma él mismo el
 * contador de usos (`usosPromo`). El teléfono sigue ENSEÑANDO el total mientras se arma el carrito, pero no lo decide.
 *
 * UNA SOLA CALCULADORA (SEGUNDA LEY). El trozo entre las dos marcas de abajo —qué promoción vale hoy, cuánto baja el
 * precio y cuánto cuesta una línea— lo usa también la app para enseñar el carrito: lleva una COPIA en
 * `guajirago/src/precioPedido.js` (no puede importar este archivo), y pruebas/totalPedido.test.js exige que el trozo
 * sea IGUAL en los dos y los EJECUTA con los mismos casos. Se cambia aquí y se copia allá.
 *
 * Solo `porcentaje` y `fijo` bajan el precio de un plato: así era en la app. El 2x1, el combo y el cupón se guardan
 * en aliados pero ninguna app los cobra (anotado en el informe de P09).
 */
const { etapaDeVigencia } = require('./promociones.cjs');
const { hoyEnColombia } = require('./cobros.cjs');

// ── EL PRECIO DEL PEDIDO (se copia igual en la app) ──

/** El día de la semana HOY en Colombia, con el número de `Date.getDay()` (0 = domingo … 6 = sábado). */
function diaDeLaSemanaEnColombia(ahora) {
  return new Date(hoyEnColombia(ahora) + 'T12:00:00Z').getUTCDay();
}

/** ¿Esta promoción del negocio vale HOY (en Colombia)? Encendida, y en su programación: siempre, ciertos días o un rango. */
function promoVigenteHoy(promo, ahora) {
  if (!promo || !promo.activa) return false;
  if (promo.programacion === 'dias') return (promo.dias || []).includes(diaDeLaSemanaEnColombia(ahora));
  // G16: el DÍA de hoy en Colombia (antes era el día en UTC: desde las 7 de la noche ya contaba «mañana»).
  if (promo.programacion === 'rango') return etapaDeVigencia(promo.fechaInicio, promo.fechaFin, ahora) === 'vigente';
  return true; // siempre
}

/** El precio del plato con esta promoción, o null si la promoción no le baja el precio a ESTE plato. */
function precioConPromo(plato, promo) {
  if (!plato || !promo) return null;
  if (promo.tipo !== 'porcentaje' && promo.tipo !== 'fijo') return null;
  const lista = promo.platosAplica || [];
  if (lista.length > 0 && !lista.some((x) => x.id === plato.id)) return null;
  const precioFinal = promo.tipo === 'porcentaje'
    ? Math.round(plato.precio * (1 - (promo.valor || 0) / 100))
    : Math.max(0, plato.precio - (promo.valor || 0));
  return precioFinal < plato.precio ? precioFinal : null;
}

/** ¿Este teléfono ya llenó el tope de la promoción? `usados` = cuántas veces la usó. Sin tope, nunca. */
function topeLleno(promo, usados) {
  return promo.limiteCliente > 0 && (usados || 0) >= promo.limiteCliente;
}

/**
 * La mejor promoción para este plato: { promo, precioFinal }, o null. `usos(id)` dice cuántas veces la usó ya quien
 * pide; con su tope lleno no cuenta.
 */
function mejorDescuento(plato, promos, usos, ahora) {
  let mejor = null;
  for (const p of (promos || []).filter((x) => promoVigenteHoy(x, ahora))) {
    if (topeLleno(p, usos(p.id))) continue;
    const precioFinal = precioConPromo(plato, p);
    if (precioFinal !== null && (!mejor || precioFinal < mejor.precioFinal)) mejor = { promo: p, precioFinal };
  }
  return mejor;
}

/** El precio de UNA unidad de la línea: el del plato (con su promoción, si la hay) más el de sus adiciones. */
function precioDeLaLinea(plato, adiciones, desc) {
  const extra = (adiciones || []).reduce((s, a) => s + (a.precio || 0), 0);
  return (desc ? desc.precioFinal : plato.precio) + extra;
}

// ── FIN DEL PRECIO DEL PEDIDO ──

// ── SOLO EN EL SERVIDOR ──

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** La línea sin lo que dice de la promoción (promoId, promoNombre y precioOriginal): eso lo pone el servidor. */
function sinPromo(linea) {
  const { promoId, promoNombre, precioOriginal, ...resto } = linea && typeof linea === 'object' ? linea : {};
  return resto;
}

/**
 * EL PEDIDO CON LOS PRECIOS DEL MENÚ. Del teléfono solo se cree QUÉ se pidió; el precio sale del menú del negocio.
 * `usos(id)` = cuántas veces usó ya este teléfono esa promoción (ANTES de este pedido).
 * Devuelve { items, subtotal, promos (las que se aplicaron, una vez cada una), problemas }.
 *
 * Lo que no se puede cobrar con el menú NO se inventa: un plato que no está en el menú, o una adición que el plato no
 * tiene, va a $0 y queda en `problemas` (el negocio lo ve y decide); una cantidad que no es un entero de 1 o más no
 * suma; una promoción que no vale se quita y el plato va a su precio del menú.
 */
function pedidoConPreciosDelMenu(negocio, items, usos, ahora) {
  const menu = (negocio && negocio.menu) || [];
  const promos = (negocio && negocio.promociones) || [];
  const problemas = [];
  const usadas = [];
  let subtotal = 0;
  const lineas = (Array.isArray(items) ? items : []).map((linea, i) => {
    const l = linea && typeof linea === 'object' ? linea : {};
    const base = sinPromo(l);
    const cantidadBuena = Number.isInteger(l.cantidad) && l.cantidad > 0;
    if (!cantidadBuena) problemas.push({ linea: i, codigo: 'cantidad-no-valida' });
    const plato = menu.find((p) => p && p.id === l.id);
    if (!plato) {
      problemas.push({ linea: i, codigo: 'fuera-del-menu' });
      return { ...base, precio: 0 };
    }
    if (plato.disponible === false) problemas.push({ linea: i, codigo: 'no-disponible' });
    const adiciones = (Array.isArray(l.adiciones) ? l.adiciones : []).map((a) => {
      const delMenu = (plato.adiciones || []).find((x) => x && a && x.nombre === a.nombre);
      if (delMenu) return delMenu;
      problemas.push({ linea: i, codigo: 'adicion-fuera-del-menu' });
      return { nombre: String((a && a.nombre) || ''), precio: 0 };
    });
    let desc = null;
    if (l.promoId) {
      const promo = promos.find((p) => p && p.id === l.promoId);
      const vale = !!promo && promoVigenteHoy(promo, ahora) && !topeLleno(promo, usos(promo.id));
      const precioFinal = vale ? precioConPromo(plato, promo) : null;
      if (precioFinal !== null) desc = { promo, precioFinal };
      else problemas.push({ linea: i, codigo: 'promocion-no-vale', promoId: String(l.promoId) });
    }
    if (desc && cantidadBuena && !usadas.includes(desc.promo.id)) usadas.push(desc.promo.id);
    const precio = cantidadBuena ? precioDeLaLinea(plato, adiciones, desc) : 0;
    if (cantidadBuena) subtotal += precio * l.cantidad;
    const extra = adiciones.reduce((s, a) => s + (a.precio || 0), 0);
    return {
      ...base, id: plato.id, nombre: plato.nombre || '', precio, adiciones,
      ...(desc ? { promoId: desc.promo.id, promoNombre: desc.promo.nombre || '', precioOriginal: plato.precio + extra } : {}),
    };
  });
  return { items: lineas, subtotal, promos: usadas, problemas };
}

/** ¿A este pedido le pone el precio el servidor? Los de un CLIENTE (llevan su firma); los del negocio (la mesa), no. */
function loRevisaElServidor(p) {
  return !!(p && p.clienteId);
}

/**
 * Le pone al pedido recién nacido los precios del menú, en UNA transacción: lee el pedido, el negocio y los contadores
 * de las promociones que dice usar; escribe los precios, el subtotal, el domicilio, el total y `revisionServidor`
 * (lo que mandó el teléfono, qué promociones se aplicaron y los problemas); y suma uno al contador de cada promoción
 * aplicada. `eventoId` hace que un reintento del mismo disparo no cuente dos veces. Devuelve el pedido como quedó.
 *
 * El domicilio: si el pedido sigue «nuevo», el del negocio (lo mismo que ponía la app); si el negocio ya lo tocó
 * (lo confirmó con otro domicilio), se respeta el suyo.
 */
async function ponerElPrecioDelServidor(db, pedidoId, eventoId, ahora) {
  const refPedido = db.collection('pedidos').doc(pedidoId);
  return db.runTransaction(async (tx) => {
    const sp = await tx.get(refPedido);
    if (!sp.exists) return null;
    const p = sp.data();
    if (!loRevisaElServidor(p)) return p;
    if (p.revisionServidor && p.revisionServidor.evento === eventoId) return p;
    const sn = p.restauranteId ? await tx.get(db.collection('negocios').doc(String(p.restauranteId))) : null;
    const delTelefono = { subtotalDelTelefono: numero(p.subtotal), totalDelTelefono: numero(p.total) };
    if (!sn || !sn.exists) {
      const revisionServidor = { evento: eventoId, ...delTelefono, promos: [], problemas: [{ codigo: 'sin-negocio' }] };
      tx.update(refPedido, { revisionServidor });
      return { ...p, revisionServidor };
    }
    const negocio = sn.data();
    const tel = typeof p.telefono === 'string' ? p.telefono : '';
    const reclamadas = [...new Set((Array.isArray(p.items) ? p.items : []).map((l) => l && l.promoId).filter(Boolean).map(String))];
    const usados = {};
    for (const pid of reclamadas) {
      if (!tel) { usados[pid] = Infinity; continue; } // sin teléfono no se puede mirar el tope
      const su = await tx.get(db.collection('usosPromo').doc(pid + '__' + tel));
      usados[pid] = su.exists ? Number(su.data().veces) || 0 : 0;
    }
    const r = pedidoConPreciosDelMenu(negocio, p.items, (id) => usados[id] || 0, ahora);
    const costoDomicilio = p.estado === 'nuevo' ? Number(negocio.costoDomicilio) || 0 : Number(p.costoDomicilio) || 0;
    const campos = {
      items: r.items, subtotal: r.subtotal, costoDomicilio, total: r.subtotal + costoDomicilio,
      revisionServidor: { evento: eventoId, ...delTelefono, promos: r.promos, problemas: r.problemas },
    };
    tx.update(refPedido, campos);
    for (const pid of r.promos) {
      if (tel) tx.set(db.collection('usosPromo').doc(pid + '__' + tel), { veces: (usados[pid] || 0) + 1, telefono: tel, promoId: pid });
    }
    return { ...p, ...campos };
  });
}

module.exports = {
  diaDeLaSemanaEnColombia, promoVigenteHoy, precioConPromo, topeLleno, mejorDescuento, precioDeLaLinea,
  pedidoConPreciosDelMenu, loRevisaElServidor, ponerElPrecioDelServidor,
};
