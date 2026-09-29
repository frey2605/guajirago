#!/usr/bin/env node
// 🤖 EL «HOY» DE CORTE DE CAJA ES EL DE COLOMBIA — gemelo G48 (y hallazgo de G16), 29-sep-2026.
// Corte de caja (aliados) sacaba «hoy» con la hora de Londres: desde las 7 p. m. de Colombia ya era MAÑANA, y el
// corte de la noche salía casi vacío. Aquí se abre aliados de PRUEBAS con el reloj de la página puesto a las 8 p. m.
// de HOY en Colombia (se corre el reloj antes de cargar; nada más cambia), se entra como el restaurante de prueba →
// ☰ → «Corte de caja», y se leen las dos fechas «desde / hasta»: las dos tienen que ser el día de hoy en Colombia.
// No toca «Guardar» ni escribe nada.
//   node robot/corte-caja-hoy.cjs
const { abrir, entrarComoRestaurante } = require('./comun.cjs');

const hoyCol = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const OCHO_PM = Date.parse(hoyCol + 'T20:00:00-05:00');

// Va como TEXTO porque el motor no le pasa datos a lo que corre antes de cargar (ver APRENDIDO.md).
// Corre el reloj de la página: `new Date()` y `Date.now()` dan la hora de hoy a las 8 p. m. de Colombia, y siguen
// avanzando. Una fecha dada (`new Date(x)`) no se toca.
const antesDeCargar = '(' + ((objetivo) => {
  const Real = Date;
  const corrimiento = objetivo - Real.now();
  function Corrido(...a) {
    if (!(this instanceof Corrido)) return new Real(Real.now() + corrimiento).toString();
    return a.length === 0 ? new Real(Real.now() + corrimiento) : new Real(...a);
  }
  Corrido.prototype = Real.prototype;
  Corrido.now = () => Real.now() + corrimiento;
  Corrido.parse = Real.parse;
  Corrido.UTC = Real.UTC;
  window.Date = Corrido;
}) + ')(' + OCHO_PM + ');';

(async () => {
  const fallos = [];
  const r = await abrir('aliados', { nombre: 'corte-caja-hoy', antesDeCargar });
  const p = r.pagina;
  let fechas = null; let reloj = null;
  try {
    reloj = await p.evaluate(() => new Date().toISOString());
    await entrarComoRestaurante(p);
    await r.captura('adentro');
    if (!(await p.getByText('Corte de caja', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Corte de caja', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await r.captura('corte');
    fechas = await p.evaluate(() => [...document.querySelectorAll('input[type="date"]')].map((x) => x.value));
  } finally { await r.cerrar(); }

  console.log('RELOJ DE LA PÁGINA: ' + reloj + ' (las 8 p. m. del ' + hoyCol + ' en Colombia) · desde/hasta: '
    + JSON.stringify(fechas) + ' · capturas', r.carpeta);
  if (!reloj || Math.abs(Date.parse(reloj) - OCHO_PM) > 5 * 60000) fallos.push('el reloj de la página no se corrió: ' + reloj);
  if (!fechas || fechas.length < 2) fallos.push('no encontré las fechas desde/hasta de Corte de caja');
  else if (fechas.some((f) => f !== hoyCol)) fallos.push('a las 8 p. m. el corte dice ' + JSON.stringify(fechas) + ' y hoy en Colombia es ' + hoyCol);
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ a las 8 p. m. el corte de caja de «hoy» es el día de Colombia');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
