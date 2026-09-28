#!/usr/bin/env node
/**
 * «¿CUÁNTO GANÉ HOY?» — gemelo G23 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-ganancias-hoy.cjs
 *
 * Hasta el 28-sep-2026 el conductor tenía DOS respuestas:
 *   · el recuadro «GANANCIAS DE HOY» del historial (AppConductor.js, HistorialConductor): sumaba los finalizados
 *     cuyo `fechaSolicitud` caía en el mismo día que el reloj del teléfono (`toDateString`), pero SOLO entre los
 *     50 viajes más recientes que pide el historial (el tope);
 *   · la tarjeta «HOY» de la pantalla Ganancias (Ganancias.js): todos los finalizados, sin tope, con
 *     `fechaSolicitud >= medianoche del teléfono` (así que un viaje fechado en el futuro también contaba).
 * Las dos decidían el día con la zona del TELÉFONO, no la de Colombia.
 *
 * Este guion, para cada conductor y cada día (en Colombia) en que tuvo viajes finalizados, pone el reloj a las
 * 23:59 de ese día y calcula qué decía cada pantalla con el teléfono en hora de Colombia y con el teléfono en UTC,
 * y qué dice la cuenta única (guajirago/src/gananciasConductor.js, si ya existe). Cuenta además cuántos viajes
 * traen una fecha que la consulta nueva no puede comparar (no es texto ISO), y cuántos conductores pasan del tope.
 * No escribe nada.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const TERMINADOS = ['finalizado', 'cancelado', 'cancelado_conductor', 'vencido', 'expirado'];
const TOPE = 50;

function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

// El día (AAAA-MM-DD) en Colombia de un instante: Colombia es UTC−5 todo el año.
const diaCol = (f) => { const t = Date.parse(f); return Number.isNaN(t) ? null : new Date(t - 5 * 3600000).toISOString().slice(0, 10); };
const valor = (v) => { const n = Number(v && v.tarifaValor); return Number.isFinite(n) && n > 0 ? n : 0; };

/** Lo que decía el recuadro del HISTORIAL a la hora `ahora` (su consulta: los 50 más recientes del conductor). */
function historialAntes(suyos, ahora) {
  const existian = suyos.filter((v) => Date.parse(v.fechaSolicitud) <= ahora.getTime());
  const lista = existian.sort((a, b) => String(b.fechaSolicitud).localeCompare(String(a.fechaSolicitud)))
    .slice(0, TOPE).filter((v) => TERMINADOS.includes(v.estado));
  const hoy = ahora.toDateString();
  return lista.filter((v) => v.estado === 'finalizado' && new Date(v.fechaSolicitud).toDateString() === hoy)
    .reduce((a, v) => a + valor(v), 0);
}

/** Lo que decía la tarjeta HOY de GANANCIAS a la hora `ahora` (su consulta: todos los finalizados, sin tope). */
function gananciasAntes(suyos, ahora) {
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return suyos.filter((v) => v.estado === 'finalizado' && Date.parse(v.fechaSolicitud) <= ahora.getTime())
    .filter((v) => new Date(v.fechaSolicitud) >= inicioHoy).reduce((a, v) => a + valor(v), 0);
}

function laCuentaUnica() {
  if (!fs.existsSync(path.join(RAIZ, 'guajirago', 'src', 'gananciasConductor.js'))) return null;
  const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
  return cargarDeLaApp('guajirago/src/gananciasConductor.js');
}

/** El careo entero, con funciones puras (la prueba lo corre con viajes de mentira). */
function carear(viajes, unica) {
  const porConductor = {};
  for (const v of viajes) if (v.conductorId) (porConductor[v.conductorId] = porConductor[v.conductorId] || []).push(v);
  const filas = [];
  for (const [id, suyos] of Object.entries(porConductor)) {
    const dias = [...new Set(suyos.filter((v) => v.estado === 'finalizado').map((v) => diaCol(v.fechaSolicitud)).filter(Boolean))].sort();
    for (const dia of dias) {
      const ahora = new Date(dia + 'T23:59:00-05:00');
      const fila = {
        conductor: id,
        dia,
        historialCol: enZona('America/Bogota', () => historialAntes([...suyos], ahora)),
        gananciasCol: enZona('America/Bogota', () => gananciasAntes(suyos, ahora)),
        historialUtc: enZona('UTC', () => historialAntes([...suyos], ahora)),
        gananciasUtc: enZona('UTC', () => gananciasAntes(suyos, ahora)),
        unica: null,
      };
      if (unica) {
        // La cuenta única, con lo que le trae SU consulta (finalizados desde el principio de la semana o del mes).
        const desde = unica.desdeCuandoSeLee(ahora);
        const trae = suyos.filter((v) => v.estado === 'finalizado' && typeof v.fechaSolicitud === 'string' && v.fechaSolicitud >= desde
          && Date.parse(v.fechaSolicitud) <= ahora.getTime());
        const enUtc = enZona('UTC', () => unica.resumenDeGanancias(trae, ahora, {}).hoy.total);
        const enCol = enZona('America/Bogota', () => unica.resumenDeGanancias(trae, ahora, {}).hoy.total);
        fila.unica = enCol === enUtc ? enCol : { enCol, enUtc };
      }
      filas.push(fila);
    }
  }
  const noIso = viajes.filter((v) => v.estado === 'finalizado' && !(typeof v.fechaSolicitud === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(v.fechaSolicitud)));
  const sobreTope = Object.entries(porConductor).filter(([, s]) => s.length > TOPE).map(([id, s]) => ({ id, viajes: s.length }));
  return { filas, noIso: noIso.length, sobreTope, conductores: Object.keys(porConductor).length };
}

const pesos = (n) => (n == null ? '—' : typeof n === 'object' ? JSON.stringify(n) : '$' + Number(n).toLocaleString('es-CO'));

async function main() {
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  const unica = laCuentaUnica();
  const c = carear(viajes, unica);
  console.log('🚕 viajes en producción: ' + viajes.length + ' · conductores con viajes: ' + c.conductores);
  console.log('   finalizados con fecha que no es texto ISO (la consulta nueva no los ve): ' + c.noIso);
  console.log('   conductores con más de ' + TOPE + ' viajes (el tope del historial): ' + c.sobreTope.length
    + (c.sobreTope.length ? ' → ' + c.sobreTope.map((s) => s.id + ' (' + s.viajes + ')').join(', ') : ''));
  console.log('\n📅 conductor · día (Colombia) · reloj a las 23:59 de ese día');
  console.log('   historial/Ganancias con el teléfono en hora de Colombia · lo mismo con el teléfono en UTC · cuenta única');
  let distintasCol = 0; let distintasUtc = 0; let unicaDistinta = 0;
  for (const f of c.filas) {
    const difCol = f.historialCol !== f.gananciasCol;
    const difUtc = f.historialUtc !== f.gananciasUtc || f.historialUtc !== f.historialCol;
    if (difCol) distintasCol++;
    if (difUtc) distintasUtc++;
    if (unica && f.unica !== f.gananciasCol) unicaDistinta++;
    console.log('   ' + (difCol || difUtc ? '🔴 ' : '   ') + f.conductor.slice(0, 12) + ' · ' + f.dia
      + ' · COL ' + pesos(f.historialCol) + ' / ' + pesos(f.gananciasCol)
      + ' · UTC ' + pesos(f.historialUtc) + ' / ' + pesos(f.gananciasUtc)
      + ' · única ' + (unica ? pesos(f.unica) : 'todavía no existe'));
  }
  console.log('\n   días medidos: ' + c.filas.length);
  console.log('   las dos pantallas decían distinto (teléfono en Colombia): ' + distintasCol);
  console.log('   decían distinto o cambiaban con el teléfono en UTC: ' + distintasUtc);
  if (unica) console.log('   la cuenta única difiere de Ganancias-en-Colombia: ' + unicaDistinta);

  // Y HOY de verdad (el reloj de ahora), conductor por conductor.
  const ahora = new Date();
  console.log('\n🕐 hoy de verdad (' + diaCol(ahora.toISOString()) + ' en Colombia): historial / Ganancias'
    + (unica ? ' / única' : ''));
  const ids = [...new Set(viajes.map((v) => v.conductorId).filter(Boolean))];
  for (const id of ids) {
    const suyos = viajes.filter((v) => v.conductorId === id);
    const h = enZona('America/Bogota', () => historialAntes([...suyos], ahora));
    const g = enZona('America/Bogota', () => gananciasAntes(suyos, ahora));
    const u = unica ? unica.resumenDeGanancias(suyos.filter((v) => typeof v.fechaSolicitud === 'string'
      && v.fechaSolicitud >= unica.desdeCuandoSeLee(ahora)), ahora, {}).hoy.total : null;
    console.log('   ' + id.slice(0, 12) + ' · ' + pesos(h) + ' / ' + pesos(g) + (unica ? ' / ' + pesos(u) : ''));
  }

  // ¿Queda alguna pantalla haciendo su propia cuenta de «hoy»?
  const PANTALLAS = ['guajirago/src/AppConductor.js', 'guajirago/src/Ganancias.js'];
  const propias = PANTALLAS.filter((p) => /toDateString\(\)|inicioHoy|new Date\(v\.fechaSolicitud\) >=/.test(fs.readFileSync(path.join(RAIZ, p), 'utf8')));
  console.log('\n' + (propias.length ? '🔴 pantallas con su propia cuenta de «hoy»: ' + propias.join(', ')
    : '✓ ninguna de las 2 pantallas hace su propia cuenta de «hoy»'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { carear, historialAntes, gananciasAntes };
