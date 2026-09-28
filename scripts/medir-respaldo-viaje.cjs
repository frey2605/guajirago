#!/usr/bin/env node
/**
 * EL RESPALDO DE 5 s DEL PASAJERO, ¿HACE LO MISMO QUE EL VIGILANTE EN VIVO? — gemelo G22 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-respaldo-viaje.cjs            (datos de producción + las pantallas)
 *   node scripts/medir-respaldo-viaje.cjs --sin-red  (solo las pantallas)
 *
 * La pantalla del pasajero (`Solicitar.js`) mira su viaje por DOS sitios: un vigilante en vivo (`onSnapshot`) y un
 * respaldo que lo vuelve a leer cada 5 s (`setInterval` + `getDoc`), puesto para los teléfonos (Safari) en que el
 * vivo tarda. Hasta el 28-sep-2026 el respaldo llevaba SU PROPIA copia de las reacciones, y se había separado:
 *   · no conocía `aceptado` —el paso vivo en que el conductor ya va en camino—, así que si el vivo se callaba ahí,
 *     el pasajero se quedaba en «buscando» con el viaje ya tomado;
 *   · respaldaba `confirmando`, un estado RETIRADO que no escribe nadie (`ESTADOS_RETIRADOS` en estadosViaje.js);
 *   · y repetía cada 5 s lo que el vivo ya había hecho con el mismo viaje.
 *
 * Mide TRES cosas, corriendo los dos vigilantes sacados del archivo (con `correrVigilante` del medidor de G20: el
 * mismo ámbito de mentira, no una copia) con un viaje de mentira en cada paso:
 *   A. casos en que el respaldo, con un viaje que el vivo NO vio, no hace lo mismo que haría el vivo;
 *   B. casos en que alguno de los dos reacciona a un estado RETIRADO;
 *   C. casos en que el respaldo, 5 s después, VUELVE a hacer lo que el vivo ya hizo con el mismo viaje.
 * Y en producción: cuántos viajes hay en cada estado, cuántos en un estado retirado y cuántos pasaron por `aceptado`.
 * No escribe nada. Sirve para el paso 1 y el 12 (y para carear el código de antes con el de ahora: `fuentes`).
 */
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { correrVigilante } = require('./medir-viaje-cerrado.cjs');

const { ESTADOS_RETIRADOS } = cargarDeLaApp('guajirago/src/estadosViaje.js');

// Los pasos del viaje, como los ve el pasajero. `pantalla` es donde está él cuando llega ese documento.
const PASOS_VIVOS = [
  { nombre: 'buscando', viaje: { estado: 'esperando' }, pantalla: 'esperando' },
  { nombre: 'lo aceptaron', viaje: { estado: 'aceptado', conductorId: 'c1', conductorNombre: 'Luis' }, pantalla: 'esperando' },
  { nombre: 'el conductor llegó', viaje: { estado: 'aceptado', conductorId: 'c1', conductorEnPunto: true, fase: 'en_punto' }, pantalla: 'fase1' },
  { nombre: 'ya va montado', viaje: { estado: 'aceptado', conductorId: 'c1', conductorEnPunto: true, fase: 'en_viaje' }, pantalla: 'fase1' },
  { nombre: 'terminó', viaje: { estado: 'finalizado', conductorId: 'c1', fase: 'finalizado' }, pantalla: 'fase2' },
  { nombre: 'lo canceló el conductor', viaje: { estado: 'cancelado_conductor', conductorId: 'c1' }, pantalla: 'fase1' },
  { nombre: 'lo cerró el servidor', viaje: { estado: 'expirado', conductorId: 'c1', motivoExpiracion: 'prueba' }, pantalla: 'fase1' },
];
const pasosRetirados = () => ESTADOS_RETIRADOS.map((e) => ({
  nombre: 'retirado ' + e, retirado: true,
  viaje: { estado: e, conductorId: 'c1', conductorNombre: 'Luis', contraofertaValor: 9000 }, pantalla: 'esperando',
}));

// Lo que no es una REACCIÓN: armar la dirección del documento y leerlo.
const NO_CUENTA = new Set(['doc', 'getDoc']);
const firma = (llamadas) => JSON.stringify(llamadas.filter((l) => !NO_CUENTA.has(l[0]))
  .map((l) => l.map((a) => (typeof a === 'function' ? 'ƒ' : a))));
const reacciones = (llamadas) => llamadas.filter((l) => !NO_CUENTA.has(l[0]) && l[0] !== 'setViaje');

async function medirPantallas(fuentes = {}) {
  const filas = [];
  for (const paso of [...PASOS_VIVOS, ...pasosRetirados()]) {
    const vivo = await correrVigilante('pasajeroEnVivo', paso.viaje, paso.pantalla, fuentes, { ultimaHuellaRef: { current: null } });
    const respaldo = await correrVigilante('pasajeroRespaldo', paso.viaje, paso.pantalla, fuentes, { ultimaHuellaRef: { current: null } });
    // C: el mismo ref para los dos, en orden: primero el vivo ve el viaje, 5 s después pasa el respaldo.
    const compartido = { current: null };
    await correrVigilante('pasajeroEnVivo', paso.viaje, paso.pantalla, fuentes, { ultimaHuellaRef: compartido });
    const despues = await correrVigilante('pasajeroRespaldo', paso.viaje, paso.pantalla, fuentes, { ultimaHuellaRef: compartido });
    filas.push({
      paso: paso.nombre, retirado: !!paso.retirado,
      distinto: firma(vivo) !== firma(respaldo),
      reaccionaRetirado: !!paso.retirado && (reacciones(vivo).length > 0 || reacciones(respaldo).length > 0),
      repite: reacciones(despues).length > 0,
      vivo: reacciones(vivo).map((l) => l[0]), respaldo: reacciones(respaldo).map((l) => l[0]),
      despues: reacciones(despues).map((l) => l[0]),
    });
  }
  return filas;
}

async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  const porEstado = {};
  for (const v of viajes) porEstado[v.estado || '(sin estado)'] = (porEstado[v.estado || '(sin estado)'] || 0) + 1;
  return {
    total: viajes.length, porEstado,
    enRetirado: viajes.filter((v) => ESTADOS_RETIRADOS.includes(v.estado)).length,
    conConductor: viajes.filter((v) => v.conductorId).length,
    aceptadoAhora: viajes.filter((v) => v.estado === 'aceptado').length,
  };
}

async function main() {
  if (!process.argv.includes('--sin-red')) {
    const d = await medirDatos();
    console.log('🚕 viajes en producción: ' + d.total);
    console.log('   por estado: ' + Object.entries(d.porEstado).map(([k, n]) => k + '=' + n).join(' · '));
    console.log('   en un estado RETIRADO: ' + d.enRetirado + ' · pasaron por «aceptado» (tienen conductor): '
      + d.conConductor + ' · en «aceptado» ahora mismo: ' + d.aceptadoAhora);
  }
  const filas = await medirPantallas();
  console.log('\n📱 los dos vigilantes del pasajero, corridos con un viaje de mentira en cada paso (' + filas.length + ' casos):');
  for (const f of filas) {
    console.log('   ' + (f.distinto || f.reaccionaRetirado || f.repite ? '🔴' : '✓') + ' ' + f.paso.padEnd(26)
      + ' vivo: ' + (f.vivo.join(',') || '—') + '  |  respaldo: ' + (f.respaldo.join(',') || '—')
      + '  |  respaldo tras el vivo: ' + (f.despues.join(',') || '—'));
  }
  const A = filas.filter((f) => f.distinto).length;
  const B = filas.filter((f) => f.reaccionaRetirado).length;
  const C = filas.filter((f) => f.repite).length;
  console.log('\n   A · el respaldo NO hace lo que haría el vivo:          ' + A);
  console.log('   B · alguno reacciona a un estado retirado:             ' + B);
  console.log('   C · el respaldo repite lo que el vivo ya hizo:         ' + C);
  console.log('\n' + (A + B + C === 0 ? '✓ una sola manera de reaccionar, y el respaldo solo actúa si el vivo se calló'
    : '🔴 ' + (A + B + C) + ' casos en que los dos vigilantes del pasajero no dicen lo mismo'));
}

if (require.main === module) main().catch((e) => { console.error('⛔ ' + e.message); process.exit(1); });

module.exports = { medirPantallas, PASOS_VIVOS };
