#!/usr/bin/env node
/**
 * «ME ACEPTARON EL VIAJE»: ¿LO VE LA APP DEL CONDUCTOR, Y CON QUÉ REGLA? — gemelo G24 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-me-aceptaron.cjs            (datos de producción + las pantallas)
 *   node scripts/medir-me-aceptaron.cjs --sin-red  (solo las pantallas)
 *
 * La app del conductor (`AppConductor.js`) se entera de que el pasajero le aceptó la oferta por DOS sitios:
 *   · EL DE LA OFERTA (`agregarViajeEscuchando`): al ofertar, vigila ese viaje. Vive 3 minutos, y se suelta en cuanto
 *     el viaje llega con `nuevaOferta` (el pasajero subió su oferta).
 *   · EL GENERAL (el `useEffect` que vigila `where('conductorId', '==', miId)`): ve TODOS los viajes del conductor.
 * Hasta el 28-sep-2026 cada uno llevaba su propia regla y su propia reacción. El general solo aceptaba viajes con
 * menos de 10 minutos contados con el RELOJ DEL TELÉFONO desde `nuevaOferta || fechaSolicitud`, y no los que iban
 * `en_viaje`; el de la oferta no miraba ni la hora ni la fase. Y el servidor deja aceptar hasta 20 minutos
 * (`MINUTOS.buscando` de functions/viajesColgados.cjs). O sea: si el pasajero aceptaba pasados 3 minutos de la oferta
 * y 10 de la búsqueda, NO LO VEÍA NINGUNO — el servidor ya le había cobrado la comisión y lo había marcado ocupado.
 *
 * Mide TRES cosas, corriendo los dos detectores sacados del archivo (no copiados) con un viaje de mentira:
 *   A. REGLAS DISTINTAS: con el mismo documento en la mano, uno celebra y el otro no.
 *   B. VENTANA CIEGA: el pasajero acepta en el minuto X y NINGUNO de los dos se entera (con el reloj que corre de
 *      verdad: el de la oferta se apaga a los 3 min o con `nuevaOferta`; el general mira la hora).
 *   C. AL VOLVER A ABRIR LA APP: el viaje sigue aceptado (el servidor lo tiene ocupado) y la app no lo recupera.
 * Y en producción: cuántos viajes aceptados cayeron en cada caso (con la fecha que puso el SERVIDOR al aceptar), y qué
 * conductores tienen hoy la marca `enViajeId` (G02) en un viaje que el general no recuperaría.
 * No escribe nada. Sirve para el paso 1 y el 12, y para carear el código de antes con el de ahora (`fuentes`).
 */
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { ambitoDeMentira } = require('./medir-viaje-cerrado.cjs');

const ARCHIVO = 'guajirago/src/AppConductor.js';
const ANCLA_OFERTA = 'const agregarViajeEscuchando = useCallback((idViaje) => {';
const ANCLA_GENERAL = "const q = query(collection(db, 'viajes'), where('conductorId', '==', miId));";
// La reacción compartida (G24). Si el archivo no la tiene (el código de antes), no se define y queda espía.
const ANCLA_REACCION = 'const alQueMeAceptaron = useCallback((data) => {';

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 8, 28, 15, 0, 0); // cuando el pasajero pidió, en el reloj del conductor
const iso = (min) => new Date(T0 + min * MIN).toISOString();

function unaVez(codigo, ancla) {
  const i = codigo.indexOf(ancla);
  if (i < 0) throw new Error(ARCHIVO + ': no encuentro «' + ancla + '». Si se escribió de otra forma, hay que '
    + 'enseñarle al medidor dónde está; sin él no se puede decir nada.');
  if (codigo.indexOf(ancla, i + 1) >= 0) throw new Error(ARCHIVO + ': «' + ancla + '» aparece más de una vez.');
  return i;
}
function cuerpoDesde(codigo, i) {
  const c = cuerpoDeLaFuncion(codigo, i);
  if (!c) throw new Error(ARCHIVO + ': no pude sacar el cuerpo que abre en el carácter ' + i);
  return c.texto;
}

function losCuerpos(fuentes) {
  const codigo = soloCodigo(fuentes[ARCHIVO] != null ? fuentes[ARCHIVO] : leer(ARCHIVO));
  const oferta = cuerpoDesde(codigo, unaVez(codigo, ANCLA_OFERTA));
  const iq = unaVez(codigo, ANCLA_GENERAL);
  const io = codigo.indexOf('onSnapshot(q, (snap) => {', iq);
  if (io < 0) throw new Error(ARCHIVO + ': el vigilante general ya no abre con «onSnapshot(q, (snap) => {»');
  const general = cuerpoDesde(codigo, io);
  const reaccion = codigo.includes(ANCLA_REACCION)
    ? 'const alQueMeAceptaron = (data) => {' + cuerpoDesde(codigo, unaVez(codigo, ANCLA_REACCION)) + '};\n' : '';
  return { oferta, general, reaccion };
}

/** El ámbito de la pantalla del conductor: sus refs, su reloj, y todo lo demás espiado. */
function ambitoDelConductor(ahoraMin, extras = {}) {
  class Reloj extends Date {
    constructor(...a) { if (a.length) super(...a); else super(T0 + ahoraMin.valor * MIN); }
    static now() { return T0 + ahoraMin.valor * MIN; }
  }
  const oyentes = [];
  const topes = [];
  const fijos = {
    ...cargarDeLaApp('guajirago/src/estadosViaje.js'),
    auth: { currentUser: { uid: 'yo' } }, miId: 'yo',
    celebrandoRef: { current: false }, faseRef: { current: null },
    unsubsViajesRef: { current: {} }, misOfertasRef: { current: new Set() }, descartadosRef: { current: {} },
    Date: Reloj,
    onSnapshot: (ref, cb) => { oyentes.push(cb); return () => {}; },
    // Los relojes de la pantalla: el TOPE de vida del vigilante de la oferta se guarda para correrlo cuando toque;
    // los cortos (los 3 s de la celebración) no deciden si se ve la aceptación.
    setTimeout: (fn, ms) => { if (ms >= MIN) topes.push({ fn, ms }); },
    console: { log: () => {}, error: () => {} },
    ...extras,
  };
  const { ambito, llamadas } = ambitoDeMentira(fijos);
  return { ambito, llamadas, oyentes, topes, fijos };
}

const celebro = (llamadas) => llamadas.some((l) => l[0] === 'setCelebrando' && l[1] === true);
// El argumento entra POR EL ÁMBITO: un parámetro suelto de la función de fuera lo taparía el `with` con un espía.
const correr = (ambito, prologo, cuerpo, [nombre, valor]) => {
  ambito.__argumento = valor;
  // eslint-disable-next-line no-new-func
  new Function('ambito', 'with (ambito) { ' + prologo + 'return ((' + nombre + ') => {' + cuerpo + '\n})(__argumento); }')(ambito);
};
const unaFoto = (id, datos) => ({ id, exists: () => true, data: () => ({ ...datos }) });

/**
 * EL DE LA OFERTA, con el reloj corriendo. El conductor oferta en el minuto `oferta` (el viaje está como estaba en
 * ese momento: `alOfertar`), y el pasajero acepta en el minuto `acepta` (`aceptado`). ¿Celebra?
 */
function elDeLaOferta(c, fuentes) {
  const { oferta, reaccion } = losCuerpos(fuentes);
  const reloj = { valor: c.oferta };
  const m = ambitoDelConductor(reloj);
  const idViaje = 'v1';
  correr(m.ambito, reaccion, oferta, ['idViaje', idViaje]);
  if (m.oyentes.length !== 1) throw new Error('el vigilante de la oferta no abrió UN oyente del viaje (abrió ' + m.oyentes.length + ')');
  m.oyentes[0](unaFoto(idViaje, c.alOfertar)); // Firestore manda el viaje tal cual está en cuanto se abre el oyente
  const vivo = () => !!m.fijos.unsubsViajesRef.current[idViaje];
  if (vivo()) {
    reloj.valor = c.acepta;
    for (const t of m.topes) if ((c.acepta - c.oferta) * MIN >= t.ms) t.fn();
  }
  if (!vivo()) return { vivo: false, celebra: false };
  m.oyentes[0](unaFoto(idViaje, c.aceptado));
  return { vivo: true, celebra: celebro(m.llamadas) };
}

/** EL GENERAL: en el minuto `ahora` le llega la foto de los viajes del conductor. ¿Celebra? */
function elGeneral(viajes, ahora, fuentes, fase = null) {
  const { general, reaccion } = losCuerpos(fuentes);
  const m = ambitoDelConductor({ valor: ahora }, { faseRef: { current: fase } });
  // La consulta ya filtra `conductorId == miId` en el servidor: un viaje de otro conductor no le llega nunca.
  const snap = { docs: viajes.filter((v) => v.conductorId === 'yo').map((v, i) => unaFoto(v.id || 'v' + (i + 1), v)) };
  correr(m.ambito, reaccion, general, ['snap', snap]);
  return { celebra: celebro(m.llamadas) };
}

// El viaje, como lo escribe el servidor al aceptar (`confirmarConductor`), con las fechas del reloj del pasajero.
const aceptadoA = (min, extra = {}) => ({ estado: 'aceptado', conductorId: 'yo', conductorNombre: 'Luis',
  fechaSolicitud: iso(0), fechaAceptacion: iso(min), ...extra });

/** A. Con el mismo documento en la mano y los dos vigilantes despiertos, ¿deciden lo mismo? */
function losDocumentos() {
  return [
    { nombre: 'aceptado hace 1 min', ahora: 1, viaje: aceptadoA(1) },
    { nombre: 'aceptado a los 12 min de pedir', ahora: 12, viaje: aceptadoA(12) },
    { nombre: 'aceptado a los 19 min de pedir', ahora: 19, viaje: aceptadoA(19) },
    { nombre: 'aceptado a los 4 min de subir la oferta', ahora: 16, viaje: aceptadoA(16, { nuevaOferta: iso(12) }) },
    { nombre: 'aceptado, el reloj del pasajero 12 min atrás', ahora: 2, viaje: aceptadoA(2, { fechaSolicitud: iso(-12) }) },
    { nombre: 'aceptado sin fecha de solicitud', ahora: 2, viaje: aceptadoA(2, { fechaSolicitud: undefined }) },
    { nombre: 'aceptado y ya llegó al punto', ahora: 12, viaje: aceptadoA(3, { fase: 'en_punto' }) },
    { nombre: 'aceptado y ya va en viaje', ahora: 4, viaje: aceptadoA(3, { fase: 'en_viaje' }) },
    { nombre: 'aceptado a OTRO conductor', ahora: 1, viaje: aceptadoA(1, { conductorId: 'otro' }) },
    { nombre: 'sigue buscando', ahora: 1, viaje: { estado: 'esperando', conductorId: 'yo', fechaSolicitud: iso(0) } },
    { nombre: 'terminado', ahora: 30, viaje: aceptadoA(3, { estado: 'finalizado', fase: 'finalizado' }) },
  ];
}

/** B. El reloj de verdad: cuándo oferta el conductor, cuándo acepta el pasajero. */
function lasHoras() {
  const casos = [];
  const buscando = { estado: 'esperando', conductorId: null, fechaSolicitud: iso(0) };
  for (const oferta of [0.5, 1.8]) {
    for (const acepta of [1, 2.5, 4, 6, 9.5, 10.5, 14, 19.5]) {
      if (acepta <= oferta) continue;
      casos.push({ nombre: 'oferta al min ' + oferta + ', acepta al ' + acepta, oferta, acepta,
        alOfertar: buscando, aceptado: aceptadoA(acepta) });
    }
  }
  // El pasajero subió su oferta en el minuto 5 («seguir buscando»): el servidor cuenta los 20 min desde ahí.
  const subio = { ...buscando, nuevaOferta: iso(5) };
  for (const acepta of [6, 9, 16, 24]) {
    casos.push({ nombre: 'subió la oferta al 5, oferta al 5.5, acepta al ' + acepta, oferta: 5.5, acepta,
      alOfertar: subio, aceptado: aceptadoA(acepta, { nuevaOferta: iso(5) }) });
  }
  // El reloj del teléfono del pasajero va 12 min atrasado (escribió la fecha de solicitud «vieja»).
  const atrasado = { ...buscando, fechaSolicitud: iso(-12) };
  for (const acepta of [2, 5]) {
    casos.push({ nombre: 'reloj del pasajero 12 min atrás, oferta al 1, acepta al ' + acepta, oferta: 1, acepta,
      alOfertar: atrasado, aceptado: aceptadoA(acepta, { fechaSolicitud: iso(-12) }) });
  }
  return casos;
}

/** C. La app se vuelve a abrir con el viaje aceptado (el servidor lo tiene ocupado): solo queda el general. */
function lasReaperturas() {
  return [
    { nombre: 'reabre al min 4 (aceptado al 2)', ahora: 4, viaje: aceptadoA(2) },
    { nombre: 'reabre al min 12 (aceptado al 2)', ahora: 12, viaje: aceptadoA(2) },
    { nombre: 'reabre al min 30 (aceptado al 2)', ahora: 30, viaje: aceptadoA(2) },
    { nombre: 'reabre al min 12, ya en el punto', ahora: 12, viaje: aceptadoA(2, { fase: 'en_punto' }) },
  ];
}

function medirPantallas(fuentes = {}) {
  const documentos = losDocumentos().map((d) => {
    const deLaOferta = elDeLaOferta({ oferta: d.ahora, acepta: d.ahora, alOfertar: { estado: 'esperando', conductorId: null }, aceptado: d.viaje }, fuentes).celebra;
    const general = elGeneral([d.viaje], d.ahora, fuentes).celebra;
    return { ...d, deLaOferta, general, distinto: deLaOferta !== general };
  });
  const horas = lasHoras().map((c) => {
    const o = elDeLaOferta(c, fuentes);
    const g = elGeneral([c.aceptado], c.acepta, fuentes).celebra;
    return { ...c, deLaOferta: o.celebra, ofertaViva: o.vivo, general: g, ciego: !o.celebra && !g };
  });
  const reaperturas = lasReaperturas().map((r) => {
    const g = elGeneral([r.viaje], r.ahora, fuentes).celebra;
    return { ...r, general: g, noVuelve: !g };
  });
  return { documentos, horas, reaperturas };
}

// ── DATOS DE PRODUCCIÓN ──────────────────────────────────────────────────────────
async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  const aceptados = viajes.filter((v) => v.fechaAceptacion && v.conductorId);
  const ms = (f) => (typeof f === 'string' ? new Date(f).getTime() : NaN);
  let sinOferta = 0;
  const filas = [];
  for (const v of aceptados) {
    // eslint-disable-next-line no-await-in-loop
    const ofertas = (await traer('viajes/' + v.id + '/contraofertas')).map(doc);
    const suya = ofertas.find((o) => o.id === v.conductorId || o.conductorId === v.conductorId);
    const acepto = ms(v.fechaAceptacion);
    const desdeBusqueda = (acepto - ms(v.nuevaOferta || v.fechaSolicitud)) / MIN;
    const desdeOferta = suya ? (acepto - ms(suya.creado)) / MIN : NaN;
    if (!suya) sinOferta += 1;
    // El de la oferta: se suelta con `nuevaOferta` y a los 3 min. El general: solo si van menos de 10 desde la búsqueda.
    const oferta = !v.nuevaOferta && Number.isFinite(desdeOferta) && desdeOferta < 3;
    const general = !(desdeBusqueda >= 10);
    filas.push({ id: v.id, desdeBusqueda, desdeOferta, oferta, general });
  }
  const conductores = (await traer('conductores')).map(doc).filter((c) => c.enViajeId);
  const porId = Object.fromEntries(viajes.map((v) => [v.id, v]));
  const marcas = conductores.map((c) => {
    const v = porId[c.enViajeId];
    const edad = v ? (Date.now() - ms(v.nuevaOferta || v.fechaSolicitud)) / MIN : NaN;
    return { conductor: c.id, viaje: c.enViajeId, estado: v ? v.estado : '(no existe)', fase: v && v.fase, edad };
  });
  const conConductor = viajes.filter((v) => v.conductorId);
  const fechas = conConductor.map((v) => v.fechaSolicitud).filter((f) => typeof f === 'string').sort();
  return { total: viajes.length, aceptados: aceptados.length, sinOferta, filas, marcas,
    conConductor: conConductor.length, desde: fechas[0], hasta: fechas[fechas.length - 1] };
}

const siNo = (b) => (b ? 'sí' : 'no');

async function main() {
  if (!process.argv.includes('--sin-red')) {
    const d = await medirDatos();
    const conOferta = d.filas.filter((f) => Number.isFinite(f.desdeOferta));
    console.log('🚕 viajes en producción: ' + d.total + ' · aceptados alguna vez (con fechaAceptacion del servidor): ' + d.aceptados
      + ' · sin la oferta guardada: ' + d.sinOferta);
    if (!d.aceptados) {
      console.log('   ⚠ ' + d.conConductor + ' viajes tienen conductor (pedidos entre ' + String(d.desde).slice(0, 10) + ' y '
        + String(d.hasta).slice(0, 10) + '), pero NINGUNO lleva la hora de aceptar que escribe hoy el servidor: son de antes.'
        + ' Los datos NO pueden decir cuántas aceptaciones cayeron en la ventana ciega; lo dicen las pantallas, abajo.');
    }
    console.log('   aceptados a los 10 min o más de la búsqueda (el general NO los veía): '
      + d.filas.filter((f) => !f.general).length);
    console.log('   aceptados a los 3 min o más de la oferta, o tras subir la oferta (el de la oferta NO los veía): '
      + d.filas.filter((f) => !f.oferta).length + ' (de ' + conOferta.length + ' con oferta guardada)');
    const ciegos = d.filas.filter((f) => !f.general && !f.oferta);
    console.log('   🔴 en la ventana ciega (no los veía NINGUNO): ' + ciegos.length
      + (ciegos.length ? ' → ' + ciegos.map((f) => f.id + ' (' + f.desdeBusqueda.toFixed(1) + ' min)').join(', ') : ''));
    console.log('   conductores con la marca enViajeId del servidor: ' + d.marcas.length
      + (d.marcas.length ? ' → ' + d.marcas.map((m) => m.conductor.slice(0, 6) + '→' + m.viaje.slice(0, 6) + ' ' + m.estado
        + (m.fase ? '/' + m.fase : '') + ' ' + (Number.isFinite(m.edad) ? m.edad.toFixed(0) + ' min' : '')).join(' · ') : ''));
  }
  const { documentos, horas, reaperturas } = medirPantallas();
  console.log('\n📱 A · el mismo documento en la mano de los dos vigilantes (' + documentos.length + ' casos):');
  for (const f of documentos) {
    console.log('   ' + (f.distinto ? '🔴' : '✓') + ' ' + f.nombre.padEnd(44) + ' el de la oferta: ' + siNo(f.deLaOferta).padEnd(3)
      + ' | el general: ' + siNo(f.general));
  }
  console.log('\n⏱️ B · el reloj de verdad: ¿se entera ALGUNO de que lo aceptaron? (' + horas.length + ' casos):');
  for (const f of horas) {
    console.log('   ' + (f.ciego ? '🔴' : '✓') + ' ' + f.nombre.padEnd(56) + ' oferta: ' + (f.ofertaViva ? siNo(f.deLaOferta) : 'apagado').padEnd(8)
      + ' | general: ' + siNo(f.general));
  }
  console.log('\n🔄 C · la app se vuelve a abrir con el viaje aceptado (' + reaperturas.length + ' casos):');
  for (const f of reaperturas) console.log('   ' + (f.noVuelve ? '🔴' : '✓') + ' ' + f.nombre.padEnd(44) + ' lo recupera: ' + siNo(f.general));
  const A = documentos.filter((f) => f.distinto).length;
  const B = horas.filter((f) => f.ciego).length;
  const C = reaperturas.filter((f) => f.noVuelve).length;
  console.log('\n   A · reglas distintas con el mismo documento:        ' + A);
  console.log('   B · ventana ciega (no se entera ninguno):             ' + B);
  console.log('   C · al reabrir, el viaje aceptado no vuelve:          ' + C);
  console.log('\n' + (A + B + C === 0 ? '✓ una sola regla y ninguna aceptación se pierde'
    : '🔴 ' + (A + B + C) + ' casos en que «me aceptaron el viaje» no se ve igual o no se ve'));
}

if (require.main === module) main().catch((e) => { console.error('⛔ ' + e.message); process.exit(1); });

module.exports = { medirPantallas, elDeLaOferta, elGeneral, losCuerpos, ambitoDelConductor, correr, unaFoto, aceptadoA };
