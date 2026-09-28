#!/usr/bin/env node
/**
 * 💵 ¿LA APP DEL CONDUCTOR PIDE EL MISMO SALDO QUE EL SERVIDOR COBRA? — SOLO LECTURA, contra producción.
 *
 * Pasos 1 y 12 del gemelo G03 (27-sep-2026). El servidor (confirmarConductor) cobra la comisión según el tipo del
 * VIAJE (`viaje.tipo`). La app del conductor decidía si le alcanzaba el saldo según el vehículo del CONDUCTOR, y las
 * ganancias de los viajes viejos las contaba con `viaje.tipoVehiculo`, un campo que ningún viaje lleva. Este guion
 * cuenta, con la config de verdad:
 *   · los conductores, por tipo de vehículo, y su saldo;
 *   · por cada conductor y cada tipo de viaje que VE: cuánto le exige la app y cuánto cobra el servidor;
 *   · a quién eso lo BLOQUEA sin razón (le alcanza para lo que cobra el servidor, no para lo que pide la app) o lo
 *     deja pasar sin saldo;
 *   · el interruptor de activarse: cuánto pide contra lo más barato que ese conductor puede tomar;
 *   · los viajes sin `comisionCobrada`: cuántos cuenta la app con otra cifra que la regla del servidor.
 * Las cuentas NO se copian aquí: la de la app sale de guajirago/src/comisiones.js y la del servidor de
 * guajirago/functions/comisiones.cjs. Antes del arreglo ese archivo no existía y la regla vivía escrita dentro de
 * confirmarConductor: entonces se saca de allí la expresión tal cual y se EJECUTA (no se reescribe a mano).
 * NO escribe nada.
 *
 *   node scripts/medir-comision-g03.cjs
 */
const fs = require('fs');
const path = require('path');
const N = require('./nube.cjs');
const { cargarDeLaApp, leer } = require('../pruebas/cargar.cjs');

const APP = cargarDeLaApp('guajirago/src/comisiones.js');
const RUTA_NUBE = path.join(__dirname, '..', 'guajirago', 'functions', 'comisiones.cjs');

/** La regla del servidor: de functions/comisiones.cjs si existe; si no, la expresión de confirmarConductor, ejecutada. */
function reglaDelServidor() {
  if (fs.existsSync(RUTA_NUBE)) return require(RUTA_NUBE).comisionSegunTipoDeViaje;
  const texto = leer('guajirago/functions/index.js').replace(/\r\n/g, '\n');
  const m = texto.match(/const tipo = (viaje\.tipo \|\| "Taxi");\n\s*const comision = ([\s\S]*?);\n/);
  if (!m) throw new Error('no encontré la regla de la comisión en confirmarConductor');
  // eslint-disable-next-line no-new-func
  const f = new Function('viaje', 'cfg', 'const tipo = ' + m[1] + '; return ' + m[2] + ';');
  return (tipoViaje, cfg) => f({ tipo: tipoViaje }, cfg || {});
}
const SERVIDOR = reglaDelServidor();

/** Lo que la app exige para UN viaje de ese tipo (antes: según el vehículo; ahora: según el viaje). */
function appPorViaje(tipoVehiculo, tipoViaje, cfg) {
  if (APP.comisionSegunTipoDeViaje) return APP.comisionSegunTipoDeViaje(tipoViaje, cfg);
  return APP.comisionSegunTipo(tipoVehiculo, cfg, tipoViaje);
}
/** Lo que la app exige para prender el interruptor. */
function appParaActivarse(tipoVehiculo, cfg) {
  if (APP.comisionParaActivarse) return APP.comisionParaActivarse(tipoVehiculo, cfg);
  return APP.comisionSegunTipo(tipoVehiculo, cfg);
}
/** Los tipos de viaje que la lista del conductor le enseña (el filtro de AppConductor.js). */
function tiposQueVe(tipoVehiculo) {
  if (APP.tiposDeViajeQueVe) return APP.tiposDeViajeQueVe(tipoVehiculo);
  if (!tipoVehiculo) return ['Taxi', 'Mototaxi', 'Mensajería'];
  return tipoVehiculo === 'Mototaxi' ? ['Mototaxi', 'Mensajería'] : [tipoVehiculo];
}

/** Función pura. */
function medir(conductores, viajes, cfgGlobal) {
  const cfg = { ...APP.COMISIONES_DEFECTO, ...cfgGlobal };
  const porVehiculo = {};
  const distintos = [];
  const bloqueados = [];
  const sinSaldo = [];
  const interruptor = [];
  for (const c of conductores) {
    const tv = c.tipoVehiculo || '';
    porVehiculo[tv || '(sin tipo)'] = (porVehiculo[tv || '(sin tipo)'] || 0) + 1;
    const saldo = Number(c.creditos) || 0;
    for (const tipo of tiposQueVe(tv)) {
      const pide = appPorViaje(tv, tipo, cfg);
      const cobra = SERVIDOR(tipo, cfg);
      if (pide === cobra) continue;
      distintos.push({ id: c.id, tv, tipo, pide, cobra });
      if (saldo >= cobra && saldo < pide) bloqueados.push({ id: c.id, tv, tipo, saldo, pide, cobra });
      if (saldo < cobra && saldo >= pide) sinSaldo.push({ id: c.id, tv, tipo, saldo, pide, cobra });
    }
    const minimo = Math.min(...tiposQueVe(tv).map((t) => SERVIDOR(t, cfg)));
    const pideActivar = appParaActivarse(tv, cfg);
    if (pideActivar !== minimo) interruptor.push({ id: c.id, tv, saldo, pideActivar, minimo,
      loTranca: saldo >= minimo && saldo < pideActivar });
  }
  const sinCobrada = viajes.filter((v) => typeof v.comisionCobrada !== 'number');
  const gananciaDistinta = sinCobrada.filter((v) => APP.comisionDeViaje(v, cfg) !== SERVIDOR(v.tipo, cfg));
  return { cfg, conductores: conductores.length, porVehiculo, distintos, bloqueados, sinSaldo, interruptor,
    viajes: viajes.length, sinCobrada: sinCobrada.length, gananciaDistinta };
}

async function main() {
  const usuarios = (await N.traer('usuarios')).map(N.doc);
  const conductores = usuarios.filter((u) => u.tipo === 'conductor');
  const viajes = (await N.traer('viajes')).map(N.doc);
  const config = (await N.traer('config')).map(N.doc).find((d) => d.id === 'global') || {};
  const r = medir(conductores, viajes, config);
  console.log('Regla del servidor: ' + (fs.existsSync(RUTA_NUBE) ? 'functions/comisiones.cjs' : 'la expresión de confirmarConductor'));
  console.log('Comisiones de la config: mototaxi $' + r.cfg.comisionMototaxi + ' · taxi $' + r.cfg.comisionTaxi
    + ' · domicilio $' + r.cfg.comisionDomicilio);
  console.log('Conductores: ' + r.conductores + ' · por vehículo: ' + JSON.stringify(r.porVehiculo));
  console.log('  pares (conductor, tipo de viaje que ve) donde la app pide otra cifra que la que cobra el servidor: '
    + r.distintos.length);
  for (const d of r.distintos) console.log('    · ' + d.id + ' (' + (d.tv || 'sin tipo') + ') ante ' + d.tipo
    + ': la app pide $' + d.pide + ', el servidor cobra $' + d.cobra);
  console.log('  de ésos, HOY bloqueados sin razón por su saldo: ' + r.bloqueados.length
    + ' · dejados pasar sin saldo: ' + r.sinSaldo.length);
  for (const d of [...r.bloqueados, ...r.sinSaldo]) console.log('    · ' + d.id + ' saldo $' + d.saldo + ' ante ' + d.tipo
    + ': pide $' + d.pide + ', cobra $' + d.cobra);
  console.log('  interruptor de activarse que pide otra cifra que lo más barato que puede tomar: ' + r.interruptor.length
    + ' · de ésos, trancados hoy: ' + r.interruptor.filter((i) => i.loTranca).length);
  for (const i of r.interruptor) console.log('    · ' + i.id + ' (' + (i.tv || 'sin tipo') + ') saldo $' + i.saldo
    + ': pide $' + i.pideActivar + ', lo más barato que puede tomar es $' + i.minimo + (i.loTranca ? '  ← TRANCADO' : ''));
  console.log('Viajes: ' + r.viajes + ' · sin comisionCobrada: ' + r.sinCobrada
    + ' · que la app (Ganancias) cuenta con otra cifra que la regla del servidor: ' + r.gananciaDistinta.length);
  const porTipo = {};
  for (const v of r.gananciaDistinta) porTipo[v.tipo || '(sin tipo)'] = (porTipo[v.tipo || '(sin tipo)'] || 0) + 1;
  if (r.gananciaDistinta.length) console.log('    por tipo: ' + JSON.stringify(porTipo));
  if (N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medir };
