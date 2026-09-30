#!/usr/bin/env node
/**
 * ¿LE ALCANZA EL SALDO AL CONDUCTOR PARA LA COMISIÓN QUE LE COBRA confirmarConductor? — pendiente P04 (30-sep-2026).
 * SOLO LEE.
 *
 *   node scripts/medir-saldo-al-confirmar.cjs              (el código de hoy + producción)
 *   node scripts/medir-saldo-al-confirmar.cjs --sin-red    (solo el código)
 *   node scripts/medir-saldo-al-confirmar.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * `confirmarConductor` (guajirago/functions/index.js) le cobra la comisión al conductor en la MISMA transacción en que
 * le da el viaje: `creditos` de su ficha (usuarios/{conductorId}) menos `comisionSegunTipoDeViaje` (comisiones.cjs,
 * G03). Hasta P04 no miraba si le alcanzaba: con $500 y un taxi de $800, lo confirmaba y el saldo quedaba en -$300.
 * Decisión del dueño (30-sep-2026): «No dejar confirmar: si al conductor no le alcanza el saldo para la comisión, el
 * servidor no lo confirma y al pasajero le sale un aviso para escoger otra oferta. El saldo nunca queda negativo.»
 *
 * 1. CÓDIGO: EJECUTA `confirmarConductor` (el de hoy o el de un commit) con la nube de mentira
 *    (pruebas/nubeDeMentira.cjs) con saldos de sobra, justos, de menos, en cero, sin campo y negativos, en taxi,
 *    mototaxi y mandado; dice qué contestó (o qué error lanzó) y qué habría escrito: el viaje, el saldo, la marca.
 * 2. DATOS (producción): las fichas de conductor y su saldo contra la comisión de config/global (cuántas en negativo,
 *    cuántas por debajo de la comisión más barata que pueden tomar y de la de taxi), los viajes que cobraron comisión,
 *    y las ofertas VIGENTES en viajes del mercado cuyo conductor hoy no alcanza (las que P04 ya no dejaría confirmar).
 * 3. QUIÉN ESCRIBE LAS OFERTAS: cada escritura a `contraofertas` en las tres apps (P04: desde la precisión del dueño,
 *    la regla de Firestore niega la oferta de quien no tiene saldo para la comisión de ESE viaje; ver reglas.test.js).
 * No escribe nada. No imprime nombres: los uid van recortados.
 */
const { cargarIndex, conRegistro } = require('../pruebas/nubeDeMentira.cjs');
const { comisionSegunTipoDeViaje } = require('../guajirago/functions/comisiones.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const { comisionParaActivarse } = cargarDeLaApp('guajirago/src/comisiones.js');
const { saldoDe } = cargarDeLaApp('guajirago/src/saldoUsuario.js');

const CONFIG = { comisionTaxi: 800, comisionMototaxi: 400, comisionDomicilio: 1000 };
const SIN = Symbol('sin campo');

// [nombre, tipo del viaje, saldo] — la comisión sale de CONFIG con la regla del servidor.
const CASOS = [
  ['taxi, saldo de sobra', 'Taxi', 10000],
  ['taxi, saldo JUSTO (= comisión)', 'Taxi', 800],
  ['taxi, un peso menos', 'Taxi', 799],
  ['taxi, saldo en cero', 'Taxi', 0],
  ['taxi, ficha sin el campo creditos', 'Taxi', SIN],
  ['taxi, saldo ya negativo', 'Taxi', -3000],
  ['mototaxi, saldo justo', 'Mototaxi', 400],
  ['mototaxi, saldo de menos', 'Mototaxi', 300],
  ['mandado, saldo de sobra', 'Mensajería', 5000],
  ['mandado, saldo de menos', 'Mensajería', 999],
].map(([nombre, tipo, saldo]) => ({ nombre, tipo, saldo }));

/** EJECUTA confirmarConductor (el de hoy, o el del commit `ref`) con un caso: qué contestó y qué habría escrito. */
async function correrCaso(caso, ref) {
  const ficha = { tipo: 'conductor', nombre: 'LUIS PEREZ', placa: 'ABC123', vehiculo: 'Chevrolet 2015' };
  if (caso.saldo !== SIN) ficha.creditos = caso.saldo;
  const datos = {
    viajes: { V1: { pasajeroId: 'P1', estado: 'esperando', tipo: caso.tipo, tarifa: '$ 12.000', tarifaValor: 12000 } },
    'viajes/V1/contraofertas': { C1: { conductorId: 'C1', tipoOferta: 'acepta', monto: '$ 12.000', montoValor: 12000, vigente: true } },
    conductores: { C1: { ocupado: false } },
    usuarios: { C1: ficha, P1: { tipo: 'pasajero', nombre: 'ANA' } },
    config: { global: CONFIG },
  };
  const { fx, escrituras } = cargarIndex(datos, {}, ref);
  let respuesta = null; let error = null;
  try {
    ({ valor: respuesta } = await conRegistro(() => fx.confirmarConductor({ auth: { uid: 'P1' }, data: { viajeId: 'V1', conductorId: 'C1' } })));
  } catch (e) {
    error = { code: e.code || null, message: e.message, details: e.details === undefined ? null : e.details };
  }
  const saldo = escrituras.find((w) => w.ruta === 'usuarios/C1');
  const viaje = escrituras.find((w) => w.ruta === 'viajes/V1');
  const marca = escrituras.find((w) => w.ruta === 'conductores/C1');
  return {
    caso: caso.nombre,
    comision: comisionSegunTipoDeViaje(caso.tipo, CONFIG),
    saldoAntes: caso.saldo === SIN ? '(sin campo)' : caso.saldo,
    respuesta, error,
    saldoDespues: saldo ? saldo.campos.creditos : null,
    viaje: viaje ? { estado: viaje.campos.estado, conductorId: viaje.campos.conductorId, comisionCobrada: viaje.campos.comisionCobrada, tarifaValor: viaje.campos.tarifaValor } : null,
    marca: marca ? marca.campos : null,
    escrituras: escrituras.length,
  };
}

async function medirCodigo(ref) {
  const salida = [];
  for (const caso of CASOS) {
    // eslint-disable-next-line no-await-in-loop
    salida.push(await correrCaso(caso, ref));
  }
  return salida;
}

/** FUNCIÓN PURA: el informe de los datos (listas de documentos ya leídos, y config/global). */
function revisarDatos({ usuarios, viajes, ofertas = [], config = {} }) {
  const conductores = usuarios.filter((u) => u.tipo === 'conductor');
  const fichas = Object.fromEntries(usuarios.map((u) => [u.id, u]));
  const negativos = conductores.filter((u) => saldoDe(u) < 0);
  const bajoSuMinimo = conductores.filter((u) => saldoDe(u) < comisionParaActivarse(u.tipoVehiculo, config));
  const bajoTaxi = conductores.filter((u) => saldoDe(u) < comisionSegunTipoDeViaje('Taxi', config));
  const cobrados = viajes.filter((v) => typeof v.comisionCobrada === 'number');
  const plataCobrada = cobrados.reduce((s, v) => s + v.comisionCobrada, 0);
  const delMercado = new Set(viajes.filter((v) => ['esperando'].includes(v.estado)).map((v) => v.id));
  const viajePorId = Object.fromEntries(viajes.map((v) => [v.id, v]));
  const vivas = ofertas.filter((o) => o.vigente !== false && delMercado.has(o.viajeId));
  const noAlcanzan = vivas.filter((o) => {
    const f = fichas[o.conductorId];
    return saldoDe(f) < comisionSegunTipoDeViaje((viajePorId[o.viajeId] || {}).tipo, config);
  });
  const total = conductores.reduce((s, u) => s + (Number(saldoDe(u)) || 0), 0);
  return { conductores, negativos, bajoSuMinimo, bajoTaxi, cobrados, plataCobrada, vivas, noAlcanzan, total };
}

/** Cada renglón de las tres apps que ESCRIBE en la subcolección `contraofertas` (setDoc/updateDoc/addDoc). */
function escritoresDeOfertas() {
  const fsx = require('fs');
  const path = require('path');
  const raiz = path.resolve(__dirname, '..');
  const salida = [];
  for (const app of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
    const dir = path.join(raiz, app);
    if (!fsx.existsSync(dir)) continue;
    for (const a of fsx.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
      fsx.readFileSync(path.join(dir, a), 'utf8').split(/\r?\n/).forEach((l, i) => {
        if (/contraofertas/.test(l) && /\b(setDoc|updateDoc|addDoc)\(/.test(l)) salida.push({ archivo: app + '/' + a, renglon: i + 1, texto: l.trim() });
      });
    }
  }
  return salida;
}

const corto = (id) => String(id).slice(0, 8) + '…';
const pesos = (n) => '$' + Number(n).toLocaleString('es-CO');

async function main() {
  const i = process.argv.indexOf('--commit');
  const ref = i >= 0 ? process.argv[i + 1] : null;
  console.log('💳 ¿LE ALCANZA EL SALDO PARA LA COMISIÓN? · ' + (ref ? 'commit ' + ref : 'carpeta de trabajo'));
  console.log('── CÓDIGO (se EJECUTA confirmarConductor; comisiones de mentira: taxi 800, mototaxi 400, mandado 1000) ──');
  for (const x of await medirCodigo(ref)) {
    const dijo = x.error ? 'LANZA ' + x.error.code + ' «' + x.error.message + '»' + (x.error.details ? ' ' + JSON.stringify(x.error.details) : '')
      : 'contesta ' + JSON.stringify(x.respuesta);
    console.log('  · ' + x.caso + ' (saldo ' + x.saldoAntes + ', comisión ' + x.comision + ') → ' + dijo);
    console.log('      saldo después: ' + (x.saldoDespues === null ? '(no se toca)' : x.saldoDespues)
      + ' · viaje: ' + (x.viaje ? JSON.stringify(x.viaje) : '(no se toca)') + ' · escrituras: ' + x.escrituras);
  }
  const esc = escritoresDeOfertas();
  console.log('── QUIÉN ESCRIBE LAS OFERTAS (tres apps) ── ' + esc.length);
  for (const x of esc) console.log('  · ' + x.archivo + ':' + x.renglon + '  ' + x.texto.slice(0, 110));
  if (process.argv.includes('--sin-red')) return;
  const { traer, doc } = require('./nube.cjs');
  const [u, v, c] = await Promise.all([traer('usuarios'), traer('viajes'), traer('config')]);
  const viajes = v.map(doc);
  const config = (c.map(doc).find((x) => x.id === 'global')) || {};
  const ofertas = [];
  for (let k = 0; k < viajes.length; k += 10) {
    // eslint-disable-next-line no-await-in-loop
    const lotes = await Promise.all(viajes.slice(k, k + 10).map((x) => traer('viajes/' + x.id + '/contraofertas')));
    lotes.forEach((l, j) => ofertas.push(...l.map(doc).map((o) => ({ ...o, conductorId: o.conductorId || o.id, viajeId: viajes[k + j].id }))));
  }
  const d = revisarDatos({ usuarios: u.map(doc), viajes, ofertas, config });
  console.log('── PRODUCCIÓN ──');
  console.log('COMISIONES en config/global: taxi ' + comisionSegunTipoDeViaje('Taxi', config) + ' · mototaxi '
    + comisionSegunTipoDeViaje('Mototaxi', config) + ' · mandado ' + comisionSegunTipoDeViaje('Mensajería', config));
  console.log('FICHAS DE CONDUCTOR: ' + d.conductores.length + ' · saldo total ' + pesos(d.total));
  for (const x of d.conductores) {
    console.log('   · ' + corto(x.id) + ' ' + (x.tipoVehiculo || '(sin tipo)') + ': ' + pesos(saldoDe(x))
      + ' · su mínimo ' + comisionParaActivarse(x.tipoVehiculo, config));
  }
  console.log('CON SALDO NEGATIVO: ' + d.negativos.length + ' · POR DEBAJO DE SU COMISIÓN MÁS BARATA: ' + d.bajoSuMinimo.length
    + ' · POR DEBAJO DE LA DE TAXI: ' + d.bajoTaxi.length);
  console.log('VIAJES QUE COBRARON COMISIÓN: ' + d.cobrados.length + ' · ' + pesos(d.plataCobrada));
  console.log('OFERTAS VIGENTES EN VIAJES DEL MERCADO: ' + d.vivas.length + ' · de un conductor al que hoy no le alcanza: ' + d.noAlcanzan.length);
}

module.exports = { medirCodigo, correrCaso, revisarDatos, escritoresDeOfertas, CASOS, CONFIG };

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
