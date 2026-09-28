#!/usr/bin/env node
/**
 * 🔔 ¿A QUIÉN LE SUENA EL AVISO DE UN VIAJE, Y QUIÉN LO VE EN SU LISTA? — gemelo G04, SOLO LECTURA, contra producción.
 *
 * El servidor (tokensConductoresCerca, en guajirago/functions/index.js) decidía a quién avisar SOLO por distancia; la
 * lista del conductor (AppConductor.js) filtra además por tipo de vehículo. Y si el viaje llega sin radio o con 0, el
 * servidor usaba 3 km y la lista 7 km. Este guion cuenta, con los datos de verdad:
 *   · qué radios traen los viajes (cuántos sin radio o con 0) y qué radios dice config/global;
 *   · qué tipo de vehículo tienen los conductores (en usuarios/{uid}, que es donde vive);
 *   · con cada viaje y cada conductor que tenga ubicación: cuántas veces el servidor AVISA y la lista NO lo enseña
 *     (aviso falso), y al revés (la lista lo enseña y el celular no suena).
 *
 * Dos modos, para carear el paso 1 con el 12:
 *   node scripts/medir-aviso-g04.cjs --antes   → las reglas como estaban antes del arreglo (copiadas aquí, abajo)
 *   node scripts/medir-aviso-g04.cjs           → las reglas de hoy, SACADAS de los archivos (no copiadas)
 * No mira si el conductor está en servicio (eso es avisables.cjs y no cambia aquí): cuenta la regla del tipo y el radio.
 */
const path = require('path');
const { leer, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { calcularDistanciaKm } = cargarDeLaApp('guajirago/src/distancia.js');

// ── Las reglas de ANTES del arreglo (commit 184121a), copiadas tal cual para poder carear ──
const ANTES = {
  servidor(v, tipoVehiculo, km) { // tokensConductoresCerca: solo distancia, radio `viaje.radioBusqueda || 3`
    return !(typeof km === 'number' && km > ((v.radioBusqueda || 3) || 3));
  },
  lista(v, tipoVehiculo, km) {    // AppConductor.js: tipo con tiposDeViajeQueVe, y radio `v.radioBusqueda || 7`
    const ve = !tipoVehiculo ? ['Taxi', 'Mototaxi', 'Mensajería'] : tipoVehiculo === 'Mototaxi' ? ['Mototaxi', 'Mensajería'] : [tipoVehiculo];
    if (tipoVehiculo && v.tipo && !ve.includes(v.tipo)) return false;
    return !(typeof km === 'number' && km > (v.radioBusqueda || 7));
  },
};

/**
 * Carga guajirago/src/leTocaElViaje.js (la regla de la APP) y la EJECUTA, con sus dos importaciones de verdad
 * (comisiones.js y configApp.js). cargarDeLaApp no sabe de `import`, así que aquí se le dan hechas.
 */
function cargarLeTocaDeLaApp(fuenteLeToca) {
  const { tiposDeViajeQueVe } = cargarDeLaApp('guajirago/src/comisiones.js');
  const { CONFIG_COMPARTIDA } = cargarDeLaApp('guajirago/src/configApp.js');
  const fuente = (fuenteLeToca !== undefined ? fuenteLeToca : leer('guajirago/src/leTocaElViaje.js')).replace(/\r\n/g, '\n');
  const importa = [...fuente.matchAll(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';?$/gm)];
  const dados = { './comisiones': { tiposDeViajeQueVe }, './configApp': { CONFIG_COMPARTIDA } };
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const params = []; const valores = [];
  for (const m of importa) {
    const de = dados[m[2]];
    if (!de) throw new Error('leTocaElViaje.js importa de «' + m[2] + '», que este cargador no conoce');
    for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) { params.push(n); valores.push(de[n]); }
  }
  const cuerpo = fuente.replace(/^import\s+.*$/gm, '').replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(...params, cuerpo + '\nreturn { ' + nombres.join(', ') + ' };')(...valores);
}

// ── Las reglas de HOY, sacadas de los archivos: el servidor y la app ──
function reglasDeHoy() {
  const servidor = require(path.join(__dirname, '..', 'guajirago', 'functions', 'leTocaElViaje.cjs'));
  const app = cargarLeTocaDeLaApp();
  return {
    servidor: (v, t, km) => servidor.porQueNoLeToca(v, t, km) === null,
    lista: (v, t, km) => app.porQueNoLeToca(v, t, km) === null,
  };
}

/** Función pura: con viajes, conductores (con su tipo) y una pareja de reglas, qué se ve. */
function medir(viajes, conductores, reglas) {
  const radios = {};
  for (const v of viajes) {
    const r = v.radioBusqueda;
    const k = r === undefined ? 'sin radio' : (typeof r === 'number' && r > 0 ? r + ' km' : 'radio ' + JSON.stringify(r));
    radios[k] = (radios[k] || 0) + 1;
  }
  const tipos = {};
  for (const c of conductores) { const k = c.tipoVehiculo || '(sin tipo)'; tipos[k] = (tipos[k] || 0) + 1; }
  let parejas = 0; const avisoFalso = []; const mudo = [];
  for (const v of viajes) {
    if (typeof v.pasajeroLat !== 'number' || typeof v.pasajeroLng !== 'number') continue;
    for (const c of conductores) {
      const u = c.ubicacion;
      if (!u || typeof u.lat !== 'number' || typeof u.lng !== 'number') continue;
      parejas++;
      const km = calcularDistanciaKm(u.lat, u.lng, v.pasajeroLat, v.pasajeroLng);
      const suena = reglas.servidor(v, c.tipoVehiculo, km);
      const loVe = reglas.lista(v, c.tipoVehiculo, km);
      const quien = v.id + ' (' + (v.tipo || 'sin tipo') + ') → ' + c.id + ' (' + (c.tipoVehiculo || 'sin tipo') + ', ' + km.toFixed(1) + ' km)';
      if (suena && !loVe) avisoFalso.push(quien);
      if (!suena && loVe) mudo.push(quien);
    }
  }
  return { radios, tipos, parejas, avisoFalso, mudo };
}

async function main() {
  const N = require('./nube.cjs');
  const antes = process.argv.includes('--antes');
  const reglas = antes ? ANTES : reglasDeHoy();
  const viajes = (await N.traer('viajes')).map(N.doc);
  const fichas = (await N.traer('conductores')).map(N.doc);
  const usuarios = new Map((await N.traer('usuarios')).map(N.doc).map((u) => [u.id, u]));
  const config = (await N.traer('config')).map(N.doc).find((d) => d.id === 'global') || {};
  const conductores = fichas.map((f) => ({ ...f, tipoVehiculo: (usuarios.get(f.id) || {}).tipoVehiculo }));
  const r = medir(viajes, conductores, reglas);
  console.log('MODO: ' + (antes ? 'ANTES del arreglo' : 'reglas de HOY (sacadas de los archivos)'));
  console.log('config/global: radioBusquedaInicial=' + JSON.stringify(config.radioBusquedaInicial) + ' · radioBusquedaAmpliado=' + JSON.stringify(config.radioBusquedaAmpliado));
  console.log('Viajes: ' + viajes.length + ' · radios que traen: ' + JSON.stringify(r.radios));
  console.log('Fichas de conductor: ' + fichas.length + ' · con ubicación: ' + fichas.filter((f) => f.ubicacion && typeof f.ubicacion.lat === 'number').length + ' · tipo de vehículo (de usuarios): ' + JSON.stringify(r.tipos));
  console.log('Parejas viaje×conductor con las dos posiciones: ' + r.parejas);
  console.log('  🔔 el celular SUENA y la lista NO lo enseña (aviso falso): ' + r.avisoFalso.length);
  for (const x of r.avisoFalso.slice(0, 8)) console.log('     · ' + x);
  console.log('  🔕 la lista lo enseña y el celular NO suena: ' + r.mudo.length);
  for (const x of r.mudo.slice(0, 8)) console.log('     · ' + x);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medir, ANTES, reglasDeHoy, cargarLeTocaDeLaApp };
