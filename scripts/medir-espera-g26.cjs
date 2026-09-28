#!/usr/bin/env node
/**
 * ⏱️ ¿CUÁNTO TIEMPO ESPERA EL CONDUCTOR AL PASAJERO, SEGÚN CADA PANTALLA? — gemelo G26, SOLO LECTURA, contra producción.
 *
 * Cuando el conductor aprieta «Llegué», las DOS pantallas arrancan una cuenta atrás: la del conductor («Esperando al
 * pasajero…») y la del pasajero («Sal pronto o el conductor puede cancelar»). Hasta el G26 la del conductor salía de
 * `config/global.tiempoEsperaConductor` (lo que pone el dueño en el panel) y la del pasajero era un 240 fijo. Si el
 * dueño ponía otro número, cada uno veía un reloj distinto.
 *
 * Este guion:
 *   · lee `config/global` de PRODUCCIÓN y dice cuánto vale hoy `tiempoEsperaConductor`;
 *   · cuenta cuántos viajes llegaron a «el conductor llegó» (`conductorEnPunto`), para saber a cuántos les tocó ese reloj;
 *   · y EJECUTA lo que cada pantalla le pasa a `setContador` al arrancar la cuenta, con esa config y con configs de
 *     mentira (0, vacío, texto), para decir si las dos cuentan lo mismo.
 *
 * Dos modos, para carear el paso 1 con el 12:
 *   node scripts/medir-espera-g26.cjs --antes   → las dos expresiones como estaban antes del arreglo (copiadas aquí)
 *   node scripts/medir-espera-g26.cjs           → las de HOY, SACADAS de los archivos y ejecutadas (no copiadas)
 *   --sin-nube                                  → no lee producción (solo el careo con configs de mentira)
 */
const { leer, cargarDeLaApp, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

// ── Lo de ANTES del arreglo (commit edeb3b3), copiado tal cual para poder carear ──
const ANTES = {
  conductor: 'configApp.tiempoEsperaConductor || 240', // AppConductor.js, llegueAlPunto
  pasajero: '240',                                      // Solicitar.js, el oyente del viaje (conductorEnPunto)
};

/** El argumento del PRIMER `setContador(...)` que hay a partir de `desde` en `codigo` (con paréntesis anidados). */
function argumentoDeSetContador(codigo, desde) {
  const i = codigo.indexOf('setContador(', desde);
  if (i < 0) return null;
  let prof = 0;
  const ini = i + 'setContador('.length;
  for (let j = ini; j < codigo.length; j += 1) {
    const c = codigo[j];
    if (c === '(') prof += 1;
    else if (c === ')') { if (prof === 0) return codigo.slice(ini, j).trim(); prof -= 1; }
  }
  return null;
}

/**
 * Las expresiones de HOY, sacadas de los archivos:
 *   · conductor: el `setContador(...)` DENTRO de `llegueAlPunto`;
 *   · pasajero: el `setContador(...)` DENTRO del `if (data.conductorEnPunto ...)` de `reaccionarAlViaje`.
 */
function expresionesDeHoy(fuenteConductor, fuentePasajero) {
  const fc = (fuenteConductor !== undefined ? fuenteConductor : leer('guajirago/src/AppConductor.js')).replace(/\r\n/g, '\n');
  const fp = (fuentePasajero !== undefined ? fuentePasajero : leer('guajirago/src/Solicitar.js')).replace(/\r\n/g, '\n');
  const iLlegue = fc.indexOf('const llegueAlPunto = ');
  if (iLlegue < 0) throw new Error('AppConductor.js: no encuentro `const llegueAlPunto =`');
  const cuerpoLlegue = (cuerpoDeLaFuncion(fc, iLlegue) || {}).texto;
  if (!cuerpoLlegue) throw new Error('AppConductor.js: no pude sacar el cuerpo de llegueAlPunto');
  const conductor = argumentoDeSetContador(cuerpoLlegue, 0);
  if (!conductor) throw new Error('AppConductor.js: llegueAlPunto ya no arranca la cuenta con setContador(...)');

  const iReac = fp.indexOf('const reaccionarAlViaje = ');
  if (iReac < 0) throw new Error('Solicitar.js: no encuentro `const reaccionarAlViaje =`');
  const cuerpoReac = (cuerpoDeLaFuncion(fp, iReac) || {}).texto;
  if (!cuerpoReac) throw new Error('Solicitar.js: no pude sacar el cuerpo de reaccionarAlViaje');
  const iLlego = cuerpoReac.indexOf('if (data.conductorEnPunto');
  if (iLlego < 0) throw new Error('Solicitar.js: reaccionarAlViaje ya no mira `data.conductorEnPunto`');
  const bloque = (cuerpoDeLaFuncion(cuerpoReac, iLlego) || {}).texto;
  const pasajero = bloque && argumentoDeSetContador(bloque, 0);
  if (!pasajero) throw new Error('Solicitar.js: al llegar el conductor ya no se arranca la cuenta con setContador(...)');
  return { conductor, pasajero };
}

/**
 * Ejecuta una expresión de pantalla con la config que la pantalla tendría (el respaldo de configApp.js pisado por lo
 * del servidor, como hacen las dos: `{ ...respaldo, ...loDelServidor }`). Le da los nombres que las pantallas usan.
 */
function evaluar(expresion, delServidor, piezas) {
  const configApp = { ...piezas.CONFIG_COMPARTIDA, ...(delServidor || {}) };
  const nombres = { configApp, configAppRef: { current: configApp }, ...piezas };
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(nombres), 'return (' + expresion + ');')(...Object.values(nombres));
}

/** Los casos del careo: la config de producción (si se leyó) y cuatro de mentira. */
function casos(produccion) {
  const l = [];
  if (produccion !== undefined) l.push(['PRODUCCIÓN (config/global de hoy)', produccion]);
  l.push(['el dueño puso 300 s', { tiempoEsperaConductor: 300 }]);
  l.push(['el dueño puso 120 s', { tiempoEsperaConductor: 120 }]);
  l.push(['config/global no cargó', {}]);
  l.push(['el panel guardó 0 (casilla vacía)', { tiempoEsperaConductor: 0 }]);
  l.push(['llegó como texto "180"', { tiempoEsperaConductor: '180' }]);
  return l;
}

/** Función pura: con las dos expresiones y los casos, cuánto cuenta cada pantalla y si coinciden. */
function medir(expresiones, listaCasos, piezas) {
  const filas = listaCasos.map(([nombre, cfg]) => {
    const conductor = evaluar(expresiones.conductor, cfg, piezas);
    const pasajero = evaluar(expresiones.pasajero, cfg, piezas);
    return { nombre, conductor, pasajero, iguales: conductor === pasajero && typeof conductor === 'number' };
  });
  return { filas, distintos: filas.filter((f) => !f.iguales).length };
}

async function main() {
  const antes = process.argv.includes('--antes');
  const sinNube = process.argv.includes('--sin-nube');
  const piezas = cargarDeLaApp('guajirago/src/configApp.js');
  const expresiones = antes ? ANTES : expresionesDeHoy();

  let produccion;
  let enPunto = null; let totalViajes = null;
  if (!sinNube) {
    const { traer, doc } = require('./nube.cjs');
    const config = (await traer('config')).map(doc);
    const global = config.find((d) => d.id === 'global');
    if (!global) console.log('⚠ config/global NO existe en producción');
    produccion = global ? { tiempoEsperaConductor: global.tiempoEsperaConductor } : {};
    console.log('config/global.tiempoEsperaConductor en PRODUCCIÓN = '
      + (global && 'tiempoEsperaConductor' in global ? JSON.stringify(global.tiempoEsperaConductor) + ' (' + typeof global.tiempoEsperaConductor + ')' : '(no está)'));
    const viajes = (await traer('viajes')).map(doc);
    totalViajes = viajes.length;
    enPunto = viajes.filter((v) => v.conductorEnPunto === true).length;
    console.log('viajes en los que el conductor marcó «Llegué» (conductorEnPunto): ' + enPunto + ' de ' + totalViajes);
  }

  console.log('\nModo: ' + (antes ? 'ANTES del arreglo (copiado)' : 'HOY (sacado de los archivos y ejecutado)'));
  console.log('  conductor → setContador(' + expresiones.conductor + ')');
  console.log('  pasajero  → setContador(' + expresiones.pasajero + ')\n');
  const r = medir(expresiones, casos(produccion), piezas);
  for (const f of r.filas) {
    console.log((f.iguales ? '  ✓ ' : '  🔴 ') + f.nombre.padEnd(38) + ' conductor ' + JSON.stringify(f.conductor).padEnd(6)
      + ' pasajero ' + JSON.stringify(f.pasajero));
  }
  console.log('\n' + (r.distintos === 0
    ? '✓ las dos pantallas cuentan lo mismo en los ' + r.filas.length + ' casos'
    : '🔴 en ' + r.distintos + ' de ' + r.filas.length + ' casos el conductor y el pasajero ven relojes distintos'));
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}

module.exports = { ANTES, expresionesDeHoy, evaluar, casos, medir, argumentoDeSetContador };
