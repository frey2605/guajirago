#!/usr/bin/env node
/**
 * 📈 ¿CUÁNTO DICE EL TABLERO DEL PANEL QUE SE GANÓ, Y CUÁNTO SE COBRÓ DE VERDAD? — SOLO LECTURA, contra producción.
 *
 * Pasos 1 y 12 del gemelo G15 (28-sep-2026). El tablero del panel (guajirago-admin/src/App.js, Dashboard) contaba
 * las ganancias como «viajes finalizados × 800», con un 800 escrito a mano: no miraba lo que el servidor cobró de
 * verdad (`comisionCobrada`, que escribe confirmarConductor) ni la configuración (config/global), y a un mototaxi o
 * a un mandado les ponía 800 igual. Y la nota de «Ingresos reales» (Superadmin.js) decía «mototaxi $300 · taxi $800
 * según tu configuración» leyendo los números de RESPALDO del panel, no la configuración de verdad.
 *
 * Este guion cuenta, con los viajes y la config de verdad, período por período (los mismos que pinta el tablero):
 *   · lo que decía el tablero: finalizados × el número fijo de App.js (si todavía está escrito ahí);
 *   · lo que dice la regla buena: la suma de lo cobrado (comisionCobrada) y, en los viajes viejos que no lo traen,
 *     la regla única del servidor con la config (guajirago/functions/comisiones.cjs — no se copia aquí);
 *   · lo que dice HOY el panel: si ya existe guajirago-admin/src/comisiones.js se EJECUTA esa copia (la que usa el
 *     tablero), para que el paso 12 compare el código puesto y no una cuenta mía.
 * Y la nota: qué números enseña contra los de config/global. NO escribe nada.
 *
 *   node scripts/medir-ganancias-g15.cjs
 */
const fs = require('fs');
const path = require('path');
const N = require('./nube.cjs');
const { cargarDeLaApp, leer } = require('../pruebas/cargar.cjs');

const SERVIDOR = require('../guajirago/functions/comisiones.cjs');
const RUTA_PANEL = path.join(__dirname, '..', 'guajirago-admin', 'src', 'comisiones.js');
const PANEL = fs.existsSync(RUTA_PANEL) ? cargarDeLaApp('guajirago-admin/src/comisiones.js') : null;

/** El número fijo del tablero, si sigue escrito en App.js. */
function numeroFijoDelTablero() {
  const m = leer('guajirago-admin/src/App.js').match(/const COMISION_POR_VIAJE = (\d+);/);
  return m ? Number(m[1]) : null;
}

/** Lo que de verdad se cobró por un viaje (la regla del servidor para los viejos). */
const cobrado = (v, cfg) => (typeof v.comisionCobrada === 'number'
  ? v.comisionCobrada : SERVIDOR.comisionSegunTipoDeViaje(v.tipo, cfg));

/** Los períodos del tablero (App.js, Dashboard), con la hora de este computador, como el navegador del panel. */
function periodos(ahora) {
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioAyer = new Date(inicioHoy); inicioAyer.setDate(inicioAyer.getDate() - 1);
  const finAyer = new Date(inicioHoy); finAyer.setSeconds(finAyer.getSeconds() - 1);
  const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59);
  return [
    ['Ayer', inicioAyer, finAyer],
    ['Hoy', inicioHoy, finHoy],
    ['Mes pasado (hasta este día)', new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1),
      new Date(ahora.getFullYear(), ahora.getMonth() - 1, ahora.getDate(), 23, 59, 59)],
    ['Este mes', new Date(ahora.getFullYear(), ahora.getMonth(), 1), ahora],
  ];
}

/** Función pura: la cuenta de un conjunto de viajes finalizados. */
function contar(finalizados, cfg, fijo) {
  const fila = { viajes: finalizados.length, antes: fijo == null ? null : finalizados.length * fijo, buena: 0,
    panel: PANEL ? 0 : null, conCobrada: 0, porTipo: {} };
  for (const v of finalizados) {
    const c = cobrado(v, cfg);
    fila.buena += c;
    if (PANEL) fila.panel += PANEL.comisionDeViaje(v, cfg);
    if (typeof v.comisionCobrada === 'number') fila.conCobrada += 1;
    const t = v.tipo || '(sin tipo)';
    fila.porTipo[t] = (fila.porTipo[t] || 0) + 1;
  }
  return fila;
}

async function main() {
  const viajes = (await N.traer('viajes')).map(N.doc);
  const config = (await N.traer('config')).map(N.doc).find((d) => d.id === 'global') || {};
  const cfg = { ...SERVIDOR.COMISIONES_DEFECTO, ...config };
  const fijo = numeroFijoDelTablero();
  const fin = viajes.filter((v) => v.estado === 'finalizado');
  const fecha = (v) => (v.fechaSolicitud ? new Date(v.fechaSolicitud) : null);
  const pesos = (n) => (n == null ? '—' : '$' + n.toLocaleString('es-CO'));

  console.log('Config de verdad (config/global): mototaxi ' + pesos(cfg.comisionMototaxi) + ' · taxi '
    + pesos(cfg.comisionTaxi) + ' · domicilio ' + pesos(cfg.comisionDomicilio));
  console.log('Número fijo del tablero en App.js: ' + (fijo == null ? 'ya no está' : pesos(fijo)));
  console.log('Copia del panel (guajirago-admin/src/comisiones.js): ' + (PANEL ? 'existe, se ejecuta' : 'no existe todavía'));
  console.log('Viajes: ' + viajes.length + ' · finalizados: ' + fin.length);

  const linea = (nombre, f) => console.log('  ' + nombre.padEnd(30) + ' ' + String(f.viajes).padStart(3) + ' viajes · tablero decía '
    + pesos(f.antes).padStart(9) + ' · regla buena ' + pesos(f.buena).padStart(9) + ' · panel hoy ' + pesos(f.panel).padStart(9)
    + (f.antes != null && f.antes !== f.buena ? '  ← diferencia ' + pesos(f.antes - f.buena) : ''));

  console.log('\nLOS PERÍODOS DEL TABLERO (hoy es ' + new Date().toLocaleDateString('es-CO') + '):');
  for (const [nombre, desde, hasta] of periodos(new Date())) {
    linea(nombre, contar(fin.filter((v) => { const f = fecha(v); return f && f >= desde && f <= hasta; }), cfg, fijo));
  }

  console.log('\nMES POR MES (lo que el tablero habría pintado en «Este mes» ese mes):');
  const meses = {};
  for (const v of fin) { const f = fecha(v); if (!f) continue; const k = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0'); (meses[k] = meses[k] || []).push(v); }
  for (const k of Object.keys(meses).sort()) linea(k, contar(meses[k], cfg, fijo));
  const todo = contar(fin, cfg, fijo);
  linea('TODOS', todo);
  console.log('  por tipo: ' + JSON.stringify(todo.porTipo) + ' · con comisionCobrada: ' + todo.conCobrada + ' de ' + todo.viajes);
  const mandados = fin.filter((v) => v.tipo === 'Mensajería');
  console.log('  mandados finalizados que «Ingresos reales» suma en la caja «Taxi/Carro»: ' + mandados.length
    + ' (' + pesos(mandados.reduce((a, v) => a + cobrado(v, cfg), 0)) + ')');
  if (PANEL && todo.panel !== todo.buena) console.log('  🔴 la copia del panel NO da lo mismo que la regla del servidor');

  // La nota de «Ingresos reales»: ¿de dónde saca sus números?
  const s = leer('guajirago-admin/src/Superadmin.js');
  const nota = (s.match(/ℹ️ Son comisiones brutas[^\n]*/) || [''])[0];
  console.log('\nLA NOTA DE «INGRESOS REALES»: ' + (/CONFIG_POR_DEFECTO\.comision/.test(nota)
    ? 'enseña los números de RESPALDO del panel (300 / 800), no los de config/global'
    : 'ya no lee los números de respaldo'));
  if (N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { contar, periodos };
