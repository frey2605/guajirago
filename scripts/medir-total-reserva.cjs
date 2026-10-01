#!/usr/bin/env node
/**
 * P17 · ¿QUIÉN DECIDE EL TOTAL DE UNA RESERVA DE TURISMO? — SOLO LECTURA
 *
 *   node scripts/medir-total-reserva.cjs                  el código de hoy (sin red)
 *   node scripts/medir-total-reserva.cjs --commit d69c6de el código de un commit (el de antes de P17)
 *   node scripts/medir-total-reserva.cjs --nube           además, las reservas y los tours guardados en PRODUCCIÓN
 *
 * El pendiente (hijo de P16): «El precio de la reserva lo decide el teléfono». La app (Turismo.js, totalReserva) manda
 * `total` = precio del tour × personas, y `notificarNuevaReserva` le avisaba a la agencia con ese total sin mirarlo.
 * Este guion:
 *   1. EJECUTA `notificarNuevaReserva` de verdad (guajirago/functions/index.js del commit, cargado con la nube de
 *      mentira de pruebas/nubeDeMentira.cjs) con reservas de mentira: honradas (por persona, por grupo, por día, por
 *      hora), con el total inventado, de un tour borrado, de un tour con un precio raro y una que puso la agencia.
 *      Dice qué total queda guardado en la reserva, qué marca de revisión y qué le llega a la agencia en el aviso.
 *   2. EJECUTA la cuenta de la PANTALLA (Turismo.js del commit, con medir-reserva-cerrada.cjs): lo que el cliente ve.
 *   3. EN PRODUCCIÓN (--nube): cuántas reservas y tours hay, y cuántas reservas tienen un total que NO es el del tour de
 *      hoy. Lo dice el MOTOR DEL SERVIDOR (precioReserva.cjs) si existe; si no, la cuenta de la app. Ojo: el precio del
 *      tour pudo cambiar desde que se hizo la reserva, así que una vieja que no cuadra NO es por fuerza una trampa.
 * No escribe nada en ningún sitio.
 */
const fs = require('fs');
const path = require('path');
const NUBE = require('../pruebas/nubeDeMentira.cjs');
const { pantallaDe } = require('./medir-reserva-cerrada.cjs');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/Turismo.js';
const MOTOR = path.join(RAIZ, 'guajirago/functions/precioReserva.cjs');

// ── La agencia de mentira (la de Riohacha de siempre) ──
const TOURS = [
  { id: 'cabo', tipo: 'tour', nombre: 'Cabo de la Vela', precio: 250000, unidadPrecio: 'persona', disponible: true },
  { id: 'lancha', tipo: 'tour', nombre: 'Lancha privada a Manaure', precio: 400000, unidadPrecio: 'grupo', disponible: true },
  { id: 'carro', tipo: 'alquiler', nombre: 'Carro 4x4', precio: 300000, unidadPrecio: 'dia', disponible: true },
  { id: 'kayak', tipo: 'alquiler', nombre: 'Kayak', precio: 50000, unidadPrecio: 'hora', disponible: true },
  { id: 'raro', tipo: 'tour', nombre: 'Tour con precio raro', precio: 'mucho', unidadPrecio: 'persona', disponible: true },
];
const AGENCIA = { nombre: 'Wayuu Tours', tipoNegocio: 'turismo', tours: TOURS };
const tourDe = (id) => TOURS.find((t) => t.id === id);

const RESERVA = (tourId, personas, total, extra) => ({
  agenciaId: 'ag1', clienteId: 'ana', agenciaNombre: 'Wayuu Tours', tourId, tipo: 'tour',
  nombreTour: (tourDe(tourId) || {}).nombre || 'Cabo de la Vela', imagen: '', cliente: 'Ana', telefono: '3001112233',
  personas, fecha: '2026-10-05', total, unidadPrecio: (tourDe(tourId) || {}).unidadPrecio || 'persona', estado: 'nueva',
  notas: '', creado: '2026-10-01T15:00:00.000Z', ...extra,
});

/** Los casos: `honrado` = el total es el que enseña la pantalla; `bueno` = el total que tiene que quedar (null: sin revisar). */
const CASOS = [
  { caso: 'HONRADA · por persona (Cabo de la Vela, 2 personas)', reserva: RESERVA('cabo', 2, 500000), honrado: true, bueno: 500000 },
  { caso: 'HONRADA · por grupo (Lancha, 5 personas)', reserva: RESERVA('lancha', 5, 400000), honrado: true, bueno: 400000 },
  { caso: 'HONRADA · por día (Carro 4x4, 3 personas)', reserva: RESERVA('carro', 3, 300000), honrado: true, bueno: 300000 },
  { caso: 'HONRADA · por hora (Kayak, 1 persona)', reserva: RESERVA('kayak', 1, 50000), honrado: true, bueno: 50000 },
  { caso: 'INVENTADA · Cabo de la Vela × 2 con total $1', reserva: RESERVA('cabo', 2, 1), bueno: 500000 },
  { caso: 'INVENTADA · Lancha (por grupo) con total $0', reserva: RESERVA('lancha', 3, 0), bueno: 400000 },
  // La segunda opinión de P17: el teléfono también manda `unidadPrecio` (uno de los 16 campos), y puede mandar MÁS de la cuenta.
  { caso: 'INVENTADA · Cabo × 10 diciendo que se cobra «por grupo», total $250.000', reserva: RESERVA('cabo', 10, 250000, { unidadPrecio: 'grupo' }), bueno: 2500000 },
  { caso: 'INFLADA · Kayak (por hora) con total $9.999.999', reserva: RESERVA('kayak', 2, 9999999), bueno: 50000 },
  { caso: 'TOUR BORRADO · el tour ya no está en la agencia, total $1', reserva: RESERVA('borrado', 2, 1), bueno: null },
  { caso: 'SIN TOUR · la reserva no dice qué tour (tour sin id, P16)', reserva: RESERVA(undefined, 2, 1), bueno: null },
  { caso: 'PRECIO RARO · el tour guarda un precio que no es número', reserva: RESERVA('raro', 2, 1), bueno: null },
  { caso: 'AGENCIA BORRADA · la reserva apunta a una agencia que no existe', reserva: RESERVA('cabo', 2, 1, { agenciaId: 'no-existe' }), bueno: null },
  { caso: 'DE LA AGENCIA · sin firma de cliente (no la revisa el servidor)', reserva: RESERVA('cabo', 2, 7, { clienteId: null }), agencia: true, bueno: 7 },
];
// Un tour borrado o sin id: la reserva no lleva tourId.
for (const c of CASOS) if (c.reserva.tourId === undefined) delete c.reserva.tourId;

const datosCon = (reserva) => ({
  reservasTurismo: { res1: reserva },
  negocios: { ag1: AGENCIA },
  negociosPrivado: { ag1: { fcmToken: 'tokAg1' } },
  empleados: {},
});

/** Corre `notificarNuevaReserva` del commit (o del disco) con la reserva, y dice qué quedó y qué se avisó. */
async function correrServidor(commit, reserva) {
  const { fx, escrituras, mensajero } = NUBE.cargarIndex(datosCon(reserva), {}, commit || undefined);
  const { registro } = await NUBE.conRegistro(() => fx.notificarNuevaReserva({ id: 'ev1', data: { id: 'res1', data: () => reserva }, params: { id: 'res1' } }));
  const up = escrituras.filter((e) => e.ruta === 'reservasTurismo/res1').reduce((o, e) => ({ ...o, ...e.campos }), {});
  const quedo = { ...reserva, ...up };
  const aviso = mensajero.recibidos.map((m) => (m.notification && m.notification.body) || (m.data && m.data.body) || '').join(' | ');
  return {
    total: quedo.total,
    revision: quedo.revisionServidor ? quedo.revisionServidor.estado + (quedo.revisionServidor.motivo ? ' (' + quedo.revisionServidor.motivo + ')' : '') : '(ninguna)',
    aviso, escribio: Object.keys(up), registro,
  };
}

/** La cuenta de la PANTALLA del commit (Turismo.js, totalReserva) con ese tour y esas personas. */
function totalDeLaPantalla(commit, tour, personas) {
  const fuente = commit
    ? execFileSync('git', ['show', commit + ':' + PANTALLA], { cwd: RAIZ, encoding: 'utf8' })
    : fs.readFileSync(path.join(RAIZ, PANTALLA), 'utf8');
  const aparato = pantallaDe(fuente)({ tour });
  aparato.estado.personas = String(personas);
  return aparato.total();
}

async function medirCodigo(commit) {
  const filas = [];
  for (const c of CASOS) {
    // eslint-disable-next-line no-await-in-loop
    const s = await correrServidor(commit, c.reserva);
    const tour = tourDe(c.reserva.tourId);
    const pantalla = c.honrado && tour ? totalDeLaPantalla(commit, tour, c.reserva.personas) : null;
    filas.push({ ...c, servidor: s, pantalla });
  }
  // Veredicto: el total que queda es el bueno (o, si no se puede revisar, queda marcada y el aviso lo dice).
  const malos = filas.filter((f) => (f.bueno === null
    // (Sin a quién avisar —la agencia no existe— basta la marca: no hay aviso que lo diga.)
    ? !(/sin_revisar/.test(f.servidor.revision) && (!f.servidor.aviso || /precio sin revisar/.test(f.servidor.aviso)))
    : f.servidor.total !== f.bueno));
  const honradasDistintas = filas.filter((f) => f.honrado && (f.pantalla !== f.reserva.total || f.servidor.total !== f.reserva.total));
  return { filas, malos, honradasDistintas };
}

/** Las reservas guardadas, contadas con el motor del servidor (o la cuenta de la app si aún no hay motor). */
function contarReservas(reservas, negocios, cuenta) {
  const porId = Object.fromEntries(negocios.map((n) => [n.id, n]));
  const r = { reservas: reservas.length, deCliente: 0, conRevision: 0, sinRevisar: 0, sinTour: 0, noCuadran: [] };
  for (const x of reservas) {
    if (!x.clienteId) continue;
    r.deCliente += 1;
    if (x.revisionServidor) r.conRevision += 1;
    if (x.revisionServidor && x.revisionServidor.estado !== 'revisado') r.sinRevisar += 1;
    const ag = porId[x.agenciaId];
    const tour = ag && Array.isArray(ag.tours) ? ag.tours.find((t) => t && t.id === x.tourId) : null;
    if (!tour) { r.sinTour += 1; continue; }
    const bueno = cuenta(tour, x.personas);
    if (bueno !== x.total) r.noCuadran.push({ id: x.id, telefono: x.total, tour: bueno });
  }
  return r;
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const m = await medirCodigo(commit);
  console.log('── EL SERVIDOR Y LA PANTALLA' + (commit ? ' (commit ' + commit + ')' : ' (el disco, hoy)') + ' ──');
  for (const f of m.filas) {
    console.log('  · ' + f.caso);
    console.log('      mandó el teléfono $' + f.reserva.total + (f.pantalla != null ? ' · la pantalla enseña $' + f.pantalla : '')
      + ' → queda $' + f.servidor.total + ' · revisión: ' + f.servidor.revision);
    console.log('      aviso a la agencia: ' + (f.servidor.aviso || '(ninguno)'));
  }
  console.log('\n  casos en que queda un total que no es el del tour (o sin revisar y sin decirlo): ' + m.malos.length + ' de ' + m.filas.length);
  for (const f of m.malos) console.log('    🔴 ' + f.caso);
  console.log('  reservas honradas en que la pantalla o el servidor cambian el total: ' + m.honradasDistintas.length);

  if (process.argv.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const reservas = (await traer('reservasTurismo')).map(doc);
    const negocios = (await traer('negocios')).map(doc);
    const motor = fs.existsSync(MOTOR) ? require(MOTOR) : null;
    const cuenta = motor
      ? (tour, personas) => { const p = motor.precioDeLaReserva({ tours: [tour] }, { tourId: tour.id, personas }); return p.motivo ? null : p.total; }
      : (tour, personas) => (tour.unidadPrecio === 'persona' ? (tour.precio || 0) * personas : (tour.precio || 0));
    const agencias = negocios.filter((n) => n.tipoNegocio === 'turismo');
    const tours = agencias.flatMap((a) => (Array.isArray(a.tours) ? a.tours : []));
    const r = contarReservas(reservas, negocios, cuenta);
    console.log('\n── PRODUCCIÓN (solo lectura; la cuenta: ' + (motor ? 'el motor del servidor, precioReserva.cjs' : 'la de la app, aún no hay motor del servidor') + ') ──');
    console.log('  agencias de turismo: ' + agencias.length + ' · tours guardados: ' + tours.length
      + ' (por unidad: ' + JSON.stringify(tours.reduce((o, t) => ({ ...o, [t.unidadPrecio || '(sin unidad)']: (o[t.unidadPrecio || '(sin unidad)'] || 0) + 1 }), {})) + ')');
    console.log('  tours sin id: ' + tours.filter((t) => t.id == null).length + ' · con un precio que no es número: ' + tours.filter((t) => typeof t.precio !== 'number').length);
    console.log('  reservas: ' + r.reservas + ' · de clientes: ' + r.deCliente + ' · con la revisión del servidor: ' + r.conRevision + ' (sin revisar: ' + r.sinRevisar + ')');
    console.log('  de clientes cuyo tour ya no está: ' + r.sinTour + ' · cuyo total NO es el del tour de hoy: ' + r.noCuadran.length);
    for (const x of r.noCuadran) console.log('    · ' + x.id + ': el teléfono $' + x.telefono + ', el tour $' + x.tour);
  }
}

if (require.main === module) {
  main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
}

module.exports = { CASOS, TOURS, AGENCIA, correrServidor, totalDeLaPantalla, medirCodigo, contarReservas };
