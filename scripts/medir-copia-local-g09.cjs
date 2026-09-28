#!/usr/bin/env node
/**
 * ¿LA PLACA QUE MANDA EL CONDUCTOR ES LA DE SU FICHA? — gemelo G09 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-copia-local-g09.cjs
 *
 * La app guarda en el teléfono una copia de la ficha (`guajirago_usuario` en localStorage). Hasta G09, si
 * esa copia existía, la app NO volvía a leer la ficha `usuarios/{uid}` al abrir: solo traía la foto. Así
 * que si el panel corregía la placa, el conductor seguía mandando la vieja en sus ofertas, y el servidor
 * (`confirmarConductor`) la copiaba al viaje.
 *
 * La copia del teléfono no se puede leer desde aquí (vive en cada aparato). Lo que SÍ se ve es su rastro:
 *   1. la hoja `conductores/{uid}` (la escribe el teléfono con cada GPS: placa y vehículo de SU copia);
 *   2. las ofertas `viajes/{id}/contraofertas/{uid}` (placa que mandó el teléfono);
 *   3. los viajes (`conductorPlaca`, copiada de la oferta al confirmar).
 * Y se compara con la ficha de HOY. Un viaje viejo puede no cuadrar con razón (la placa cambió después);
 * la hoja y la ÚLTIMA oferta de cada conductor deberían cuadrar si el teléfono lee la ficha.
 *
 * No escribe nada. Se vuelve a correr en el paso 12.
 */
const { traer, doc } = require('./nube.cjs');

const norm = (x) => String(x == null ? '' : x).trim().toUpperCase().replace(/\s+/g, '');

async function main() {
  const usuarios = (await traer('usuarios')).map(doc);
  const fichas = new Map(usuarios.map((u) => [u.id, u]));
  const conductores = (await traer('conductores')).map(doc);
  const viajes = (await traer('viajes')).map(doc);

  const conPlaca = usuarios.filter((u) => u.placa);
  console.log('\n🚘 FICHAS con placa: ' + conPlaca.length + ' (de ' + usuarios.length + ')');

  // 1. La hoja de conductores (la escribe el teléfono desde su copia).
  let hojas = 0; let hojaNoCuadra = 0;
  for (const c of conductores) {
    const f = fichas.get(c.id);
    if (!f || !f.placa || !c.placa) continue;
    hojas++;
    if (norm(c.placa) !== norm(f.placa) || (c.vehiculo && norm(c.vehiculo) !== norm(f.vehiculo))) {
      hojaNoCuadra++;
      console.log('   🔴 hoja conductores/' + c.id.slice(0, 8) + '… lleva «' + c.placa + ' · ' + (c.vehiculo || '')
        + '» y la ficha dice «' + f.placa + ' · ' + (f.vehiculo || '') + '»');
    }
  }
  console.log('📋 HOJAS conductores con placa: ' + hojas + ' · 🔴 no cuadran con la ficha: ' + hojaNoCuadra);

  // 2. Las ofertas: la última de cada conductor.
  const ultima = new Map();
  let ofertas = 0;
  for (const v of viajes) {
    // eslint-disable-next-line no-await-in-loop
    const ofs = (await traer('viajes/' + v.id + '/contraofertas')).map(doc);
    for (const o of ofs) {
      if (!o.conductorPlaca) continue;
      ofertas++;
      const antes = ultima.get(o.id);
      if (!antes || String(o.creado || '') > String(antes.creado || '')) ultima.set(o.id, o);
    }
  }
  let ultNoCuadra = 0;
  for (const [uid, o] of ultima) {
    const f = fichas.get(uid);
    if (!f || !f.placa) continue;
    if (norm(o.conductorPlaca) !== norm(f.placa)) {
      ultNoCuadra++;
      console.log('   🔴 última oferta de ' + uid.slice(0, 8) + '… (' + String(o.creado || '').slice(0, 10) + ') mandó «'
        + o.conductorPlaca + '» y la ficha dice «' + f.placa + '»');
    }
  }
  console.log('📨 OFERTAS con placa: ' + ofertas + ' · conductores: ' + ultima.size
    + ' · 🔴 su ÚLTIMA oferta no cuadra con la ficha: ' + ultNoCuadra);

  // 3. Los viajes con placa del conductor.
  let conPl = 0; let viajeNoCuadra = 0;
  for (const v of viajes) {
    if (!v.conductorPlaca || !v.conductorId) continue;
    const f = fichas.get(v.conductorId);
    if (!f || !f.placa) continue;
    conPl++;
    if (norm(v.conductorPlaca) !== norm(f.placa)) viajeNoCuadra++;
  }
  console.log('🚕 VIAJES con placa del conductor: ' + conPl + ' · no cuadran con la ficha de HOY: ' + viajeNoCuadra
    + '\n   (un viaje guarda la placa del día en que se hizo: si luego cambió, no cuadra y está bien)\n');
}

main().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
