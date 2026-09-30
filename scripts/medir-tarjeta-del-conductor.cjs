#!/usr/bin/env node
/**
 * ¿DE DÓNDE SALE LA TARJETA DEL CONDUCTOR QUE LLEVA EL VIAJE? — pendiente P03 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-tarjeta-del-conductor.cjs              (el código de hoy + producción)
 *   node scripts/medir-tarjeta-del-conductor.cjs --sin-red    (solo el código)
 *   node scripts/medir-tarjeta-del-conductor.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * `confirmarConductor` (guajirago/functions/index.js) escribe en el viaje el nombre, teléfono, placa, vehículo, foto y
 * color del conductor: lo que ve el pasajero para saber a qué carro subirse y lo que va en su mensaje de emergencia.
 * Hasta P03 los copiaba de la OFERTA, que escribe el teléfono del conductor.
 *
 * 1. CÓDIGO: EJECUTA `confirmarConductor` (el de hoy o el de un commit) con una base de mentira
 *    (pruebas/nubeDeMentira.cjs) en tres casos —oferta honrada, oferta mentirosa y ficha vieja sin foto ni color— y
 *    dice de dónde salió cada campo de la tarjeta: de la FICHA, de la OFERTA, o igual en las dos.
 *    La oferta honrada se arma con la receta de la app (App.js `datosDeLaFicha`, con `telefonoDe` y `fotoDe` de la
 *    app, y el `|| 'Conductor'` de AppConductor.js).
 * 2. DATOS (producción): cada viaje con conductor comparado con la tarjeta que sale HOY de la ficha de su conductor
 *    (la pieza del servidor, conductorDeLaFicha.cjs), cuántos difieren y en qué campo, cuántos están en curso; las
 *    fichas de conductor a las que les falta un dato de la tarjeta; y las ofertas guardadas que no cuadran con la ficha.
 *    Ojo: un viaje viejo puede diferir porque la ficha se corrigió DESPUÉS; eso no es una mentira.
 * No escribe nada.
 */
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { cargarIndex, conRegistro } = require('../pruebas/nubeDeMentira.cjs');
const { tarjetaDelConductor } = require('../guajirago/functions/conductorDeLaFicha.cjs');

const { telefonoDe } = cargarDeLaApp('guajirago/src/telefonoUsuario.js');
const { fotoDe } = cargarDeLaApp('guajirago/src/fotoUsuario.js');
const { CAMPOS_DEL_CONDUCTOR } = cargarDeLaApp('guajirago/src/conductorDelViaje.js');
const TARJETA = CAMPOS_DEL_CONDUCTOR.filter((c) => c !== 'conductorId');

/** La oferta que manda la app de un conductor honrado: la receta de App.js (datosDeLaFicha) + AppConductor.js. */
function ofertaHonrada(uid, ficha, montoValor) {
  return {
    conductorId: uid,
    conductorNombre: ficha.nombre || 'Conductor',
    conductorTelefono: telefonoDe(ficha) || '',
    conductorPlaca: ficha.placa || '',
    conductorVehiculo: ficha.vehiculo || '',
    conductorFoto: fotoDe(ficha) || null,
    conductorColor: ficha.color || '',
    tipoOferta: 'acepta', monto: '$ 12.000', montoValor, vigente: true,
  };
}

const FICHA = {
  tipo: 'conductor', nombre: 'LUIS PEREZ', telefono: '3001234567', celular: '3009999999', placa: 'ABC123',
  vehiculo: 'Chevrolet 2015', fotoConductor: 'https://fotos/luis.jpg', color: 'Blanco', creditos: 20000,
};
const MENTIRA = {
  conductorNombre: 'CARLOS GOMEZ', conductorTelefono: '3110000000', conductorPlaca: 'XYZ999',
  conductorVehiculo: 'Mazda 2022', conductorFoto: 'https://fotos/otro.jpg', conductorColor: 'Rojo',
};
const { color: _c, fotoConductor: _f, ...FICHA_VIEJA } = FICHA;

const CASOS = [
  { nombre: 'oferta honrada', ficha: FICHA, oferta: ofertaHonrada('C1', FICHA, 12000) },
  { nombre: 'oferta mentirosa', ficha: FICHA, oferta: { ...ofertaHonrada('C1', FICHA, 12000), ...MENTIRA } },
  { nombre: 'ficha vieja sin foto ni color, oferta que sí los trae', ficha: FICHA_VIEJA,
    oferta: { ...ofertaHonrada('C1', FICHA_VIEJA, 12000), conductorFoto: 'https://fotos/luis.jpg', conductorColor: 'Blanco' } },
];

/** EJECUTA confirmarConductor (el de hoy, o el del commit `ref`) con un caso, y devuelve lo que escribió en el viaje. */
async function correrCaso(caso, ref) {
  const datos = {
    viajes: { V1: { pasajeroId: 'P1', estado: 'esperando', tipo: 'Taxi', tarifa: '$ 12.000', tarifaValor: 12000 } },
    'viajes/V1/contraofertas': { C1: caso.oferta },
    conductores: { C1: { ocupado: false } },
    usuarios: { C1: caso.ficha, P1: { tipo: 'pasajero', nombre: 'ANA' } },
    config: { global: { comisionTaxi: 800 } },
  };
  const { fx, escrituras } = cargarIndex(datos, {}, ref);
  const { valor } = await conRegistro(() => fx.confirmarConductor({ auth: { uid: 'P1' }, data: { viajeId: 'V1', conductorId: 'C1' } }));
  const w = escrituras.find((e) => e.ruta === 'viajes/V1' && e.que === 'update');
  return { respuesta: valor, viaje: w ? w.campos : null };
}

/** De dónde sale cada campo de la tarjeta en un caso: 'ficha', 'oferta', 'igual' (las dos dicen lo mismo) u 'otro'. */
function origenes(caso, viaje) {
  const deFicha = tarjetaDelConductor(caso.ficha);
  const o = {};
  for (const c of TARJETA) {
    const v = viaje ? viaje[c] : undefined;
    const esFicha = v === deFicha[c];
    const esOferta = v === (caso.oferta[c] === undefined ? undefined : caso.oferta[c]);
    o[c] = { valor: v, de: esFicha && esOferta ? 'igual' : esFicha ? 'ficha' : esOferta ? 'oferta' : 'otro' };
  }
  return o;
}

async function medirCodigo(ref) {
  const salida = [];
  for (const caso of CASOS) {
    // eslint-disable-next-line no-await-in-loop
    const r = await correrCaso(caso, ref);
    salida.push({ caso: caso.nombre, respuesta: r.respuesta, viaje: r.viaje, origen: origenes(caso, r.viaje) });
  }
  return salida;
}

/** FUNCIÓN PURA: el informe de los datos (listas de documentos ya leídos). */
function revisarDatos({ viajes, usuarios, ofertas = [] }) {
  const fichas = Object.fromEntries(usuarios.map((u) => [u.id, u]));
  const conConductor = viajes.filter((v) => typeof v.conductorId === 'string' && v.conductorId);
  const difieren = []; const porCampo = Object.fromEntries(TARJETA.map((c) => [c, 0])); let sinFicha = 0;
  for (const v of conConductor) {
    const f = fichas[v.conductorId];
    if (!f) { sinFicha += 1; continue; }
    const t = tarjetaDelConductor(f);
    const campos = TARJETA.filter((c) => (v[c] == null ? (c === 'conductorFoto' ? null : '') : v[c]) !== t[c]);
    for (const c of campos) porCampo[c] += 1;
    if (campos.length) difieren.push({ id: v.id, estado: v.estado, campos });
  }
  const conductores = usuarios.filter((u) => u.tipo === 'conductor' || u.placa);
  const faltan = Object.fromEntries(['nombre', 'telefono', 'placa', 'vehiculo', 'foto', 'color'].map((k) => [k, 0]));
  for (const u of conductores) {
    const t = tarjetaDelConductor(u);
    if (!u.nombre) faltan.nombre += 1;
    if (!t.conductorTelefono) faltan.telefono += 1;
    if (!t.conductorPlaca) faltan.placa += 1;
    if (!t.conductorVehiculo) faltan.vehiculo += 1;
    if (!t.conductorFoto) faltan.foto += 1;
    if (!t.conductorColor) faltan.color += 1;
  }
  const ofertasQueNoCuadran = ofertas.filter((o) => fichas[o.conductorId]).map((o) => {
    const t = tarjetaDelConductor(fichas[o.conductorId]);
    return { o, campos: TARJETA.filter((c) => (o[c] == null ? (c === 'conductorFoto' ? null : '') : o[c]) !== t[c]) };
  }).filter((x) => x.campos.length);
  return { conConductor, difieren, porCampo, sinFicha, conductores, faltan, ofertasQueNoCuadran };
}

const corto = (id) => String(id).slice(0, 8) + '…';

async function main() {
  const i = process.argv.indexOf('--commit');
  const ref = i >= 0 ? process.argv[i + 1] : null;
  console.log('🚕 LA TARJETA DEL CONDUCTOR EN EL VIAJE · ' + (ref ? 'commit ' + ref : 'carpeta de trabajo'));
  console.log('── CÓDIGO (se EJECUTA confirmarConductor) ──');
  const r = await medirCodigo(ref);
  for (const x of r) {
    const cuenta = {};
    for (const c of TARJETA) cuenta[x.origen[c].de] = (cuenta[x.origen[c].de] || 0) + 1;
    console.log('  · ' + x.caso + ' → ' + JSON.stringify(x.respuesta) + ' · de la ficha ' + (cuenta.ficha || 0)
      + ', de la oferta ' + (cuenta.oferta || 0) + ', igual en las dos ' + (cuenta.igual || 0) + ', otro ' + (cuenta.otro || 0));
    for (const c of TARJETA) console.log('      ' + c + ' = ' + JSON.stringify(x.origen[c].valor) + ' (' + x.origen[c].de + ')');
  }
  if (process.argv.includes('--sin-red')) return;
  const { traer, doc } = require('./nube.cjs');
  const [u, v] = await Promise.all([traer('usuarios'), traer('viajes')]);
  const viajes = v.map(doc);
  const ofertas = [];
  for (let k = 0; k < viajes.length; k += 10) {
    // eslint-disable-next-line no-await-in-loop
    const lotes = await Promise.all(viajes.slice(k, k + 10).map((x) => traer('viajes/' + x.id + '/contraofertas')));
    for (const l of lotes) ofertas.push(...l.map(doc));
  }
  const d = revisarDatos({ viajes, usuarios: u.map(doc), ofertas });
  console.log('── PRODUCCIÓN ──');
  console.log('VIAJES: ' + viajes.length + ' · con conductor: ' + d.conConductor.length + ' · sin ficha de su conductor: ' + d.sinFicha);
  console.log('VIAJES cuya tarjeta NO es la que da HOY la ficha de su conductor: ' + d.difieren.length
    + ' · en curso: ' + d.difieren.filter((x) => ['esperando', 'aceptado'].includes(x.estado)).length);
  console.log('   por campo: ' + TARJETA.map((c) => c + ' ' + d.porCampo[c]).join(' · '));
  for (const x of d.difieren) console.log('   · viaje ' + corto(x.id) + ' ' + x.estado + ': ' + x.campos.join(', '));
  console.log('FICHAS DE CONDUCTOR: ' + d.conductores.length + ' · les falta: '
    + Object.entries(d.faltan).map(([k, n]) => k + ' ' + n).join(' · '));
  console.log('OFERTAS guardadas: ' + ofertas.length + ' · que no cuadran con la ficha de su conductor: ' + d.ofertasQueNoCuadran.length);
  for (const x of d.ofertasQueNoCuadran) console.log('   · oferta de ' + corto(x.o.conductorId) + ': ' + x.campos.join(', '));
}

module.exports = { medirCodigo, revisarDatos, ofertaHonrada, origenes, correrCaso, CASOS, TARJETA };

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
