/**
 * 🧭 EL TOTAL DE LA RESERVA DE TURISMO LO PONE EL SERVIDOR — P17 (1-oct-2026)
 *
 * Hasta hoy el total de una reserva lo decidía el TELÉFONO: la app (Turismo.js, totalReserva) mandaba `total` = precio
 * del tour × personas, y `notificarNuevaReserva` le avisaba a la agencia con ese total sin mirarlo. Una app modificada
 * reservaba «Cabo de la Vela» de $250.000 × 2 personas con `total: 1`, y a la agencia le llegaba «Ana reservó Cabo de
 * la Vela — $ 1».
 *
 * Ahora, cuando nace la reserva de un cliente, el servidor (notificarNuevaReserva, index.js) busca el TOUR en la agencia
 * (`negocios/{agenciaId}.tours`, por `tourId`), calcula el total con la MISMA cuenta que enseña la app
 * (`totalDeLaReserva`, en el trozo atado de precioPedido.cjs) y lo escribe, guardando lo que mandó el teléfono en
 * `revisionServidor` (el mismo campo y los mismos estados que el pedido: P09/P11), ANTES de avisar. Si no puede
 * —el tour ya no está, la reserva no dice qué tour, el precio guardado no es un número, la agencia no existe, o la
 * revisión revienta— la reserva queda marcada «sin revisar» con su motivo, el aviso lo dice y aliados lo enseña
 * (comoVaLaRevision, copia atada en guajirago-aliados/src/revisionPrecio.js). Un dato raro del cliente no la hace
 * reventar (P12): solo se busca el tour por igualdad dentro de la agencia, y la agencia por un nombre que Firestore
 * acepte. Las reglas (P16) congelan la reserva después de crearla; el servidor escribe por encima de ellas.
 */
const {
  totalDeLaReserva, loRevisaElServidor, REVISION_HECHA, REVISION_FALLIDA, nombreDeDocumento, numero, yaLoRevisoEsteDisparo,
} = require('./precioPedido.cjs');

/** Las personas que aceptan las reglas al crear la reserva (P16: entero de 1 a 1000). */
const PERSONAS_MAXIMAS = 1000;

/**
 * El total de esta reserva con el tour guardado en la agencia: { total, problemas } o { motivo } si no se puede saber.
 * Función pura: `agencia` es el documento del negocio y `r` la reserva.
 */
function precioDeLaReserva(agencia, r) {
  const tours = agencia && Array.isArray(agencia.tours) ? agencia.tours : [];
  const tour = r && r.tourId != null ? tours.find((t) => t && t.id === r.tourId) : null;
  if (!tour) return { motivo: r && r.tourId != null ? 'sin-tour' : 'reserva-sin-tour' };
  const personas = r.personas;
  if (!Number.isInteger(personas) || personas < 1 || personas > PERSONAS_MAXIMAS) return { motivo: 'personas-no-valido' };
  const total = totalDeLaReserva(tour, personas);
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return { motivo: 'precio-del-tour-no-valido' };
  // Un tour apagado se reserva igual si alguien lo tenía abierto: se cobra a su precio y la agencia lo ve en los problemas.
  return { total, problemas: tour.disponible === false ? [{ codigo: 'no-disponible' }] : [] };
}

/**
 * Le pone a la reserva recién nacida el total del tour, en UNA transacción. Devuelve lo que quedó escrito
 * ({ total?, revisionServidor }) o null si no hay nada que revisar. `eventoId` hace que un reintento del mismo disparo
 * no la vuelva a revisar.
 */
async function ponerElPrecioDeLaReserva(db, reservaId, eventoId) {
  const ref = db.collection('reservasTurismo').doc(reservaId);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return null;
    const r = s.data();
    if (!loRevisaElServidor(r)) return null;
    if (yaLoRevisoEsteDisparo(r, eventoId)) return { total: r.total, revisionServidor: r.revisionServidor };
    const idAgencia = nombreDeDocumento(r.agenciaId);
    const sa = idAgencia ? await tx.get(db.collection('negocios').doc(idAgencia)) : null;
    const p = sa && sa.exists ? precioDeLaReserva(sa.data(), r) : { motivo: 'sin-agencia' };
    const totalDelTelefono = numero(r.total);
    if (p.motivo) {
      const campos = { revisionServidor: { evento: eventoId, estado: REVISION_FALLIDA, motivo: p.motivo, totalDelTelefono, problemas: [{ codigo: p.motivo }] } };
      tx.update(ref, campos);
      return campos;
    }
    const campos = { total: p.total, revisionServidor: { evento: eventoId, estado: REVISION_HECHA, totalDelTelefono, problemas: p.problemas } };
    tx.update(ref, campos);
    return campos;
  });
}

/** Si poner el total FALLÓ, se deja dicho en la reserva (como marcarSinRevisar con el pedido, P11). No toca el total. */
async function marcarLaReservaSinRevisar(db, reservaId, eventoId, motivo) {
  const ref = db.collection('reservasTurismo').doc(reservaId);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return null;
    const r = s.data();
    if (!loRevisaElServidor(r)) return null;
    if (yaLoRevisoEsteDisparo(r, eventoId)) return { total: r.total, revisionServidor: r.revisionServidor };
    const campos = { revisionServidor: { evento: eventoId, estado: REVISION_FALLIDA, motivo: String(motivo || 'error').slice(0, 200), totalDelTelefono: numero(r.total), problemas: [] } };
    tx.update(ref, campos);
    return campos;
  });
}

/**
 * La reserva como debe avisarse: la que NACIÓ (`creada`, para que el estado sea el del nacimiento) con lo que el
 * servidor le escribió. Si la revisión falla, se marca «sin revisar»; si ni eso se puede, se devuelve como nació y el
 * aviso la da por sin revisar (comoVaLaRevision sin revisión ni edad dice 'sin-revisar'). Nunca revienta: una reserva
 * sin aviso es peor que un aviso con el total del teléfono.
 */
async function reservaConElPrecioDelServidor(db, reservaId, eventoId, creada) {
  if (!loRevisaElServidor(creada)) return creada;
  try {
    const c = await ponerElPrecioDeLaReserva(db, reservaId, eventoId);
    return c ? { ...creada, ...c } : creada;
  } catch (e) {
    console.error('P17 · no se pudo poner el total del tour a la reserva', reservaId, e.message);
    try {
      const c = await marcarLaReservaSinRevisar(db, reservaId, eventoId, e.message);
      return c ? { ...creada, ...c } : creada;
    } catch (e2) {
      console.error('P17 · tampoco se pudo marcar la reserva sin revisar', reservaId, e2.message);
      return creada;
    }
  }
}

module.exports = { PERSONAS_MAXIMAS, precioDeLaReserva, ponerElPrecioDeLaReserva, marcarLaReservaSinRevisar, reservaConElPrecioDelServidor };
