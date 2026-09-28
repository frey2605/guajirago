#!/usr/bin/env node
/**
 * ¿CUÁNTO VALIÓ UN VIAJE? — gemelo G19 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-valor-viaje.cjs
 *
 * Hasta el 28-sep-2026 el panel (Viajes.js, Conductores.js, Pasajeros.js) decía que un viaje valió
 * `contraofertaValor || tarifaValor`, y la app del conductor (el historial de AppConductor.js y Ganancias.js) decía
 * `tarifaValor`. `contraofertaValor` es un campo del flujo VIEJO de contraofertas (antes del 12-jul-2026, cuando la
 * contraoferta se escribía encima del viaje): hoy no lo escribe nadie, y el precio que se cobra lo fija el servidor
 * en `tarifaValor` al confirmar (confirmarConductor).
 *
 * Este guion cuenta, en producción:
 *   · cuántos viajes traen `contraofertaValor`, y en cuántos NO coincide con `tarifaValor` (y cómo quedó cada uno);
 *   · cuánto suman los viajes finalizados con la cuenta del panel de antes, con la de la app y con la regla única
 *     (guajirago/src/valorViaje.js, si ya existe), en total, por conductor y por pasajero.
 * No escribe nada.
 */
const fs = require('fs');
const path = require('path');
const { traer, doc } = require('./nube.cjs');

// Las dos cuentas de ANTES, tal como estaban escritas (para poder carear siempre contra ellas).
const cuentaPanelAntes = (v) => v.contraofertaValor || v.tarifaValor || 0;
const cuentaAppAntes = (v) => v.tarifaValor || 0;

// La regla única, sacada del archivo si ya existe (el paso 12 la vuelve a leer de ahí).
function reglaUnica() {
  const ruta = path.join(__dirname, '..', 'guajirago', 'src', 'valorViaje.js');
  if (!fs.existsSync(ruta)) return null;
  const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
  return cargarDeLaApp('guajirago/src/valorViaje.js').valorDelViaje;
}

/** Cuenta, con funciones puras (la prueba la corre con viajes de mentira). */
function contar(viajes, regla) {
  const conContra = viajes.filter((v) => v.contraofertaValor != null);
  const distintos = conContra.filter((v) => Number(v.contraofertaValor) !== Number(v.tarifaValor));
  const fin = viajes.filter((v) => v.estado === 'finalizado');
  const sumar = (lista, f) => lista.reduce((a, v) => a + f(v), 0);
  const porClave = (clave, f) => {
    const m = {};
    for (const v of fin) { const k = v[clave] || '(sin ' + clave + ')'; m[k] = (m[k] || 0) + f(v); }
    return m;
  };
  const totales = {
    panelAntes: sumar(fin, cuentaPanelAntes),
    appAntes: sumar(fin, cuentaAppAntes),
    regla: regla ? sumar(fin, regla) : null,
  };
  const difPor = (clave) => {
    const a = porClave(clave, cuentaPanelAntes);
    const b = porClave(clave, regla || cuentaAppAntes);
    return Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => ({ quien: k, antes: a[k], ahora: b[k] }));
  };
  const tiposRaros = viajes.filter((v) => v.tarifaValor != null && typeof v.tarifaValor !== 'number');
  return {
    total: viajes.length,
    finalizados: fin.length,
    conContra: conContra.length,
    distintos,
    distintosFinalizados: distintos.filter((v) => v.estado === 'finalizado').length,
    sinTarifaValor: viajes.filter((v) => v.tarifaValor == null).length,
    tiposRaros: tiposRaros.length,
    totales,
    conductoresQueCambian: difPor('conductorId'),
    pasajerosQueCambian: difPor('pasajeroId'),
  };
}

const pesos = (n) => (n == null ? '—' : '$' + Number(n).toLocaleString('es-CO'));

async function main() {
  const viajes = (await traer('viajes')).map(doc);
  const regla = reglaUnica();
  const c = contar(viajes, regla);
  console.log('🚕 viajes en producción: ' + c.total + ' (finalizados: ' + c.finalizados + ')');
  console.log('   sin tarifaValor: ' + c.sinTarifaValor + ' · tarifaValor que no es número: ' + c.tiposRaros);
  console.log('   con contraofertaValor (campo del flujo viejo): ' + c.conContra);
  console.log('   🔴 contraofertaValor DISTINTO de tarifaValor: ' + c.distintos.length
    + ' (finalizados: ' + c.distintosFinalizados + ')');
  for (const v of c.distintos) {
    console.log('      ' + v.id + ' · ' + v.estado + ' · tarifa «' + v.tarifa + '» · tarifaValor ' + v.tarifaValor
      + ' · contraofertaValor ' + v.contraofertaValor + ' · contraoferta «' + (v.contraoferta || '') + '»'
      + ' · ' + (v.fechaSolicitud || '').slice(0, 10));
  }
  console.log('\n💰 suma de los finalizados');
  console.log('   panel ANTES (contraofertaValor || tarifaValor): ' + pesos(c.totales.panelAntes));
  console.log('   app ANTES   (tarifaValor):                      ' + pesos(c.totales.appAntes));
  console.log('   regla única (valorViaje.js):                    ' + (regla ? pesos(c.totales.regla) : 'todavía no existe'));
  console.log('   conductores cuya suma cambia en el panel: ' + c.conductoresQueCambian.length);
  for (const d of c.conductoresQueCambian) console.log('      ' + d.quien + ': ' + pesos(d.antes) + ' → ' + pesos(d.ahora));
  console.log('   pasajeros cuyo «total gastado» cambia en el panel: ' + c.pasajerosQueCambian.length);
  for (const d of c.pasajerosQueCambian) console.log('      ' + d.quien + ': ' + pesos(d.antes) + ' → ' + pesos(d.ahora));

  // ¿Queda alguna pantalla leyendo contraofertaValor para decir cuánto valió un viaje?
  const raiz = path.join(__dirname, '..');
  const PANTALLAS = ['guajirago-admin/src/Viajes.js', 'guajirago-admin/src/Conductores.js', 'guajirago-admin/src/Pasajeros.js',
    'guajirago-admin/src/Mensajeria.js', 'guajirago/src/AppConductor.js', 'guajirago/src/Ganancias.js'];
  const quedan = PANTALLAS.filter((p) => fs.existsSync(path.join(raiz, p))
    && /contraofertaValor/.test(fs.readFileSync(path.join(raiz, p), 'utf8')));
  console.log('\n' + (quedan.length ? '🔴 pantallas que todavía leen contraofertaValor: ' + quedan.join(', ')
    : '✓ ninguna de las 6 pantallas lee contraofertaValor'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { contar, cuentaPanelAntes, cuentaAppAntes };
