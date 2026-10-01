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
const { celularDiezCifras } = require('./telefonoValido.cjs');

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

// ── EL DOMICILIO DEL NEGOCIO (se copia igual en la app y en aliados) ──

/**
 * P10: cuánto cobra de domicilio este negocio. El campo de hoy es `costoDomicilio` (el que escribe el perfil de
 * aliados desde el 6-jul-2026); `costoEnvio` es el MISMO dato con su nombre viejo, de antes de ese día, y solo vale
 * si el negocio no tiene el de hoy. Lo guardado no se reescribe: se lee así.
 */
function costoDomicilioDelNegocio(negocio) {
  if (!negocio) return 0;
  const valor = negocio.costoDomicilio != null ? negocio.costoDomicilio : negocio.costoEnvio;
  return Number(valor) || 0;
}

// ── FIN DEL DOMICILIO DEL NEGOCIO ──

// ── FIN DEL PRECIO DEL PEDIDO ──

// ── SOLO EN EL SERVIDOR ──

const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** La línea sin lo que dice de la promoción (promoId, promoNombre y precioOriginal): eso lo pone el servidor. */
function sinPromo(linea) {
  const { promoId, promoNombre, precioOriginal, ...resto } = linea && typeof linea === 'object' ? linea : {};
  return resto;
}

/**
 * P12 (30-sep-2026): LO QUE MANDA EL CLIENTE NO HACE REVENTAR LA REVISIÓN. Una app modificada puede mandar cualquier
 * cosa en el pedido; la revisión lo trata (lo deja fuera y lo apunta en `problemas`) y el pedido queda con el precio
 * del menú, nunca «sin revisar» por eso. Los topes de abajo no los alcanza un pedido de la app (medido con
 * scripts/medir-revision-venenosa.cjs: los de producción tienen 2 líneas como mucho) y dejan el pedido revisado lejos
 * del máximo de 1 MiB de un documento: más líneas, más adiciones o más problemas solo servían para pasarse.
 */
const MAX_LINEAS = 100;
const MAX_ADICIONES = 30;
const CANTIDAD_MAXIMA = 999;
const MAX_PROBLEMAS = 50;
const LARGO_TEXTO = 200;

/** Un texto del cliente, recortado para guardarlo en la revisión. */
const textoCorto = (v) => String(v == null ? '' : v).slice(0, LARGO_TEXTO);

/**
 * P12: el nombre de un documento hecho con un dato del pedido, o '' si Firestore no lo aceptaría (con «/» la ruta
 * apunta a otro sitio o no apunta a un documento; «.», «..» y `__algo__` están prohibidos; más de 1.500 bytes, también).
 */
function nombreDeDocumento(v) {
  const t = typeof v === 'string' ? v : (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
  if (!t || t.includes('/') || t === '.' || t === '..' || /^__.*__$/.test(t) || Buffer.byteLength(t, 'utf8') > 1500) return '';
  return t;
}

/**
 * P12: el nombre del contador de usos de una promoción para un teléfono: `<promo>__<10 cifras>`, o '' si no se puede
 * armar. El teléfono entra ya limpio (celularDiezCifras): antes entraba tal cual lo mandó el cliente, así que un «/»
 * rompía la ruta y la revisión reventaba, y «+57 300…» contaba aparte de «300…» (el tope se saltaba cambiando la forma
 * de escribir el MISMO número). Sin contador posible, la promoción con tope no se aplica (como un pedido sin teléfono).
 */
function idDelContador(promoId, telDiez) {
  const p = nombreDeDocumento(promoId);
  if (typeof telDiez !== 'string' || !/^\d{10}$/.test(telDiez) || !p || p.length > LARGO_TEXTO) return '';
  return p + '__' + telDiez;
}

/**
 * EL PEDIDO CON LOS PRECIOS DEL MENÚ. Del teléfono solo se cree QUÉ se pidió; el precio sale del menú del negocio.
 * `usos(id)` = cuántas veces usó ya este teléfono esa promoción (ANTES de este pedido).
 * Devuelve { items, subtotal, promos (las que se aplicaron, una vez cada una), problemas, problemasDeMas }.
 *
 * Lo que no se puede cobrar con el menú NO se inventa: un plato que no está en el menú, o una adición que el plato no
 * tiene, va a $0 y queda en `problemas` (el negocio lo ve y decide); una cantidad que no es un entero de 1 a
 * CANTIDAD_MAXIMA no suma; una promoción que no vale se quita y el plato va a su precio del menú. P12: las líneas
 * después de MAX_LINEAS y las adiciones después de MAX_ADICIONES no entran (queda dicho en `problemas`), y de los
 * problemas se guardan los MAX_PROBLEMAS primeros (`problemasDeMas` = cuántos más hubo).
 */
function pedidoConPreciosDelMenu(negocio, items, usos, ahora) {
  const menu = (negocio && negocio.menu) || [];
  const promos = (negocio && negocio.promociones) || [];
  const problemas = [];
  const usadas = [];
  let subtotal = 0;
  const todas = Array.isArray(items) ? items : [];
  if (todas.length > MAX_LINEAS) problemas.push({ codigo: 'demasiadas-lineas', lineas: todas.length });
  const lineas = todas.slice(0, MAX_LINEAS).map((linea, i) => {
    const l = linea && typeof linea === 'object' ? linea : {};
    const base = sinPromo(l);
    const cantidadBuena = Number.isInteger(l.cantidad) && l.cantidad > 0 && l.cantidad <= CANTIDAD_MAXIMA;
    if (!cantidadBuena) problemas.push({ linea: i, codigo: 'cantidad-no-valida' });
    const plato = menu.find((p) => p && p.id === l.id);
    if (!plato) {
      problemas.push({ linea: i, codigo: 'fuera-del-menu' });
      return { ...base, precio: 0 };
    }
    if (plato.disponible === false) problemas.push({ linea: i, codigo: 'no-disponible' });
    const pedidas = Array.isArray(l.adiciones) ? l.adiciones : [];
    if (pedidas.length > MAX_ADICIONES) problemas.push({ linea: i, codigo: 'demasiadas-adiciones', adiciones: pedidas.length });
    const adiciones = pedidas.slice(0, MAX_ADICIONES).map((a) => {
      const delMenu = (plato.adiciones || []).find((x) => x && a && x.nombre === a.nombre);
      if (delMenu) return delMenu;
      problemas.push({ linea: i, codigo: 'adicion-fuera-del-menu' });
      return { nombre: textoCorto((a && a.nombre) || ''), precio: 0 };
    });
    let desc = null;
    if (l.promoId) {
      const promo = promos.find((p) => p && p.id === l.promoId);
      const vale = !!promo && promoVigenteHoy(promo, ahora) && !topeLleno(promo, usos(promo.id));
      const precioFinal = vale ? precioConPromo(plato, promo) : null;
      if (precioFinal !== null) desc = { promo, precioFinal };
      else problemas.push({ linea: i, codigo: 'promocion-no-vale', promoId: textoCorto(l.promoId) });
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
  const deMas = problemas.length - MAX_PROBLEMAS;
  return { items: lineas, subtotal, promos: usadas, problemas: problemas.slice(0, MAX_PROBLEMAS), ...(deMas > 0 ? { problemasDeMas: deMas } : {}) };
}

// ── LA REVISIÓN DEL PRECIO (se copia igual en aliados) ──

/** ¿A este pedido le pone el precio el servidor? Los de un CLIENTE (llevan su firma); los del negocio (la mesa), no. */
function loRevisaElServidor(p) {
  return !!(p && p.clienteId);
}

/**
 * P11: lo que el servidor deja en `revisionServidor.estado`: REVISION_HECHA si le puso al pedido el precio del menú,
 * o REVISION_FALLIDA (con su `motivo`) si no pudo y el pedido se quedó con lo que mandó el teléfono.
 */
const REVISION_HECHA = 'revisado';
const REVISION_FALLIDA = 'sin_revisar';
/** Lo que se espera la revisión antes de darla por perdida (la función se cayó o no corrió): 2 minutos. */
const ESPERA_DE_LA_REVISION_MS = 2 * 60 * 1000;

/**
 * Qué se puede decir del precio de este pedido: 'no-aplica' (lo hizo el negocio: la mesa), 'revisando' (acaba de
 * nacer y el servidor aún no contesta), 'revisado' (lleva el precio del menú) o 'sin-revisar' (el total es el que
 * mandó el teléfono y nadie lo comprobó). `msDeVida` = cuánto hace que nació el pedido (null si no se sabe).
 * Una revisión sin estado, o con otro, no se cree: no la escribió este servidor.
 */
function comoVaLaRevision(p, msDeVida) {
  if (!loRevisaElServidor(p)) return 'no-aplica';
  const r = p.revisionServidor;
  if (r) return r.estado === REVISION_HECHA ? 'revisado' : 'sin-revisar';
  // Con el reloj del aparato atrasado la vida sale negativa: tampoco se espera más de la cuenta.
  return typeof msDeVida === 'number' && Math.abs(msDeVida) < ESPERA_DE_LA_REVISION_MS ? 'revisando' : 'sin-revisar';
}

// ── FIN DE LA REVISIÓN DEL PRECIO ──

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
    // P11: un reintento del mismo disparo no vuelve a revisar (ni a contar) lo que ya quedó revisado; si la vez
    // anterior falló, sí lo intenta otra vez (el contador solo se suma cuando la revisión sale bien).
    if (yaLoRevisoEsteDisparo(p, eventoId)) return p;
    // P12: un id de negocio que Firestore no acepta como nombre es un negocio que no existe (antes reventaba).
    const idNegocio = nombreDeDocumento(p.restauranteId);
    const sn = idNegocio ? await tx.get(db.collection('negocios').doc(idNegocio)) : null;
    const delTelefono = { subtotalDelTelefono: numero(p.subtotal), totalDelTelefono: numero(p.total) };
    if (!sn || !sn.exists) {
      const revisionServidor = { evento: eventoId, estado: REVISION_FALLIDA, motivo: 'sin-negocio', ...delTelefono, promos: [], problemas: [{ codigo: 'sin-negocio' }] };
      tx.update(refPedido, { revisionServidor });
      return { ...p, revisionServidor };
    }
    const negocio = sn.data();
    // P12: el teléfono, en sus 10 cifras (la regla única, telefonoValido.cjs); '' si no sirve. Y solo se leen los
    // contadores de las promociones QUE TIENE EL NEGOCIO y que alguna línea dice usar: antes se leía uno por cada
    // promoId que mandara el cliente, con su texto tal cual en la ruta.
    const tel = celularDiezCifras(p.telefono);
    const lineasDelPedido = Array.isArray(p.items) ? p.items : [];
    const reclamadas = (Array.isArray(negocio.promociones) ? negocio.promociones : [])
      .filter((pr) => pr && pr.id != null && lineasDelPedido.some((l) => l && l.promoId === pr.id));
    const usados = new Map();
    for (const pr of reclamadas) {
      const id = idDelContador(pr.id, tel);
      if (!id) { usados.set(pr.id, Infinity); continue; } // sin teléfono (o sin contador posible) no se puede mirar el tope
      const su = await tx.get(db.collection('usosPromo').doc(id));
      usados.set(pr.id, su.exists ? Number(su.data().veces) || 0 : 0);
    }
    const usos = (id) => usados.get(id) || 0;
    const r = pedidoConPreciosDelMenu(negocio, p.items, usos, ahora);
    const costoDomicilio = p.estado === 'nuevo' ? costoDomicilioDelNegocio(negocio) : Number(p.costoDomicilio) || 0;
    const campos = {
      items: r.items, subtotal: r.subtotal, costoDomicilio, total: r.subtotal + costoDomicilio,
      revisionServidor: {
        evento: eventoId, estado: REVISION_HECHA, ...delTelefono, promos: r.promos, problemas: r.problemas,
        ...(r.problemasDeMas ? { problemasDeMas: r.problemasDeMas } : {}),
      },
    };
    tx.update(refPedido, campos);
    for (const pid of r.promos) {
      const id = idDelContador(pid, tel);
      if (id) tx.set(db.collection('usosPromo').doc(id), { veces: usos(pid) + 1, telefono: tel, promoId: String(pid) });
    }
    return { ...p, ...campos };
  });
}

/** P11: ¿este mismo disparo ya le dejó al pedido una revisión HECHA? (entonces no se repite ni se pisa) */
function yaLoRevisoEsteDisparo(p, eventoId) {
  const r = p && p.revisionServidor;
  return !!(r && r.evento === eventoId && r.estado === REVISION_HECHA);
}

/**
 * P11: si poner el precio FALLÓ, se deja dicho en el pedido —`revisionServidor.estado` = REVISION_FALLIDA, con el
 * motivo y lo que mandó el teléfono— para que aliados no lo enseñe como uno revisado. En una transacción, y sin pisar
 * una revisión hecha por este mismo disparo. No toca la plata ni el contador de las promociones.
 */
async function marcarSinRevisar(db, pedidoId, eventoId, motivo) {
  const refPedido = db.collection('pedidos').doc(pedidoId);
  return db.runTransaction(async (tx) => {
    const sp = await tx.get(refPedido);
    if (!sp.exists) return null;
    const p = sp.data();
    if (!loRevisaElServidor(p) || yaLoRevisoEsteDisparo(p, eventoId)) return p;
    const revisionServidor = {
      evento: eventoId, estado: REVISION_FALLIDA, motivo: String(motivo || 'error').slice(0, 200),
      subtotalDelTelefono: numero(p.subtotal), totalDelTelefono: numero(p.total), promos: [], problemas: [],
    };
    tx.update(refPedido, { revisionServidor });
    return { ...p, revisionServidor };
  });
}

module.exports = {
  diaDeLaSemanaEnColombia, promoVigenteHoy, precioConPromo, topeLleno, mejorDescuento, precioDeLaLinea,
  costoDomicilioDelNegocio, pedidoConPreciosDelMenu, loRevisaElServidor, ponerElPrecioDelServidor,
  REVISION_HECHA, REVISION_FALLIDA, ESPERA_DE_LA_REVISION_MS, comoVaLaRevision, marcarSinRevisar,
  nombreDeDocumento, idDelContador, MAX_LINEAS, MAX_ADICIONES, CANTIDAD_MAXIMA, MAX_PROBLEMAS,
};
