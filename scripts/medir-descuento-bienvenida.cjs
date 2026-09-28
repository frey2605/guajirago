#!/usr/bin/env node
/**
 * ¿QUIÉN FABRICÓ EL DESCUENTO PENDIENTE? — gemelo G18 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-descuento-bienvenida.cjs
 *
 * El descuento pendiente de una ficha (`usuarios/{uid}.descuentoPendiente`) y su código de
 * 4 cifras nacían en DOS sitios: el servidor (`reclamarPromocion`, al canjear un código) y el
 * teléfono (Login.js, el crédito de bienvenida del pasajero: el valor, $8.000, y el código los
 * decidía el celular). Desde el 28-sep-2026 los dos los fabrica el servidor, y lo firma con
 * `fabricadoPor: 'servidor'`. Este guion cuenta, contra producción:
 *   · cuántas fichas tienen un descuento pendiente, y de qué promoción;
 *   · cuántos de bienvenida los fabricó el TELÉFONO (sin la firma del servidor);
 *   · cuántos viajes llevan un descuento de bienvenida, y cuántos pesos ya se abonaron;
 *   · la huella de dispositivos (`dispositivosBeneficio`) y cuántas fichas la tienen.
 *
 * No escribe nada.
 */
const { traer, doc } = require('./nube.cjs');

async function main() {
  const [usuariosCrudos, viajesCrudos, dispositivosCrudos, promosCrudas] = await Promise.all([
    traer('usuarios'), traer('viajes'), traer('dispositivosBeneficio'), traer('promociones'),
  ]);
  const usuarios = usuariosCrudos.map(doc);
  const viajes = viajesCrudos.map(doc);
  const dispositivos = dispositivosCrudos.map(doc);
  const promos = promosCrudas.map(doc);

  const conPendiente = usuarios.filter((u) => u.descuentoPendiente && typeof u.descuentoPendiente === 'object');
  const porPromo = {};
  for (const u of conPendiente) {
    const k = u.descuentoPendiente.promoId || '(sin promoId)';
    porPromo[k] = (porPromo[k] || 0) + 1;
  }
  const bienvenida = conPendiente.filter((u) => u.descuentoPendiente.promoId === 'BIENVENIDA');
  const delServidor = bienvenida.filter((u) => u.descuentoPendiente.fabricadoPor === 'servidor');
  const delTelefono = bienvenida.filter((u) => u.descuentoPendiente.fabricadoPor !== 'servidor');

  console.log('FICHAS en producción: ' + usuarios.length);
  console.log('  · con descuento pendiente: ' + conPendiente.length
    + (conPendiente.length ? ' → ' + Object.entries(porPromo).map(([k, n]) => k + ' ×' + n).join(', ') : ''));
  console.log('  · de bienvenida (BIENVENIDA): ' + bienvenida.length
    + ' · fabricados por el TELÉFONO: ' + delTelefono.length + ' · por el servidor: ' + delServidor.length);
  const valores = {};
  for (const u of bienvenida) {
    const k = String(u.descuentoPendiente.valorBeneficio);
    valores[k] = (valores[k] || 0) + 1;
  }
  if (bienvenida.length) console.log('    valores: ' + Object.entries(valores).map(([k, n]) => '$' + k + ' ×' + n).join(', '));
  const sinCodigo = conPendiente.filter((u) => !/^[1-9][0-9]{3}$/.test(String(u.descuentoPendiente.codigoVerificacion || '')));
  console.log('  · pendientes con un código que NO es de 4 cifras: ' + sinCodigo.length);
  console.log('  · ¿hay una promoción con código BIENVENIDA en `promociones`? '
    + (promos.some((p) => p.id === 'BIENVENIDA') ? 'SÍ' : 'no'));

  const viajesBienvenida = viajes.filter((v) => v.descuentoInfo && v.descuentoInfo.promoId === 'BIENVENIDA');
  const cobrados = viajesBienvenida.filter((v) => v.descuentoInfo.consumido === true);
  const pesos = cobrados.reduce((s, v) => s + (Number(v.descuentoInfo.descuentoAplicado) || 0), 0);
  console.log('VIAJES con descuento de bienvenida: ' + viajesBienvenida.length
    + ' · ya abonados al conductor: ' + cobrados.length + ' ($' + pesos + ')');

  const uidsConHuella = new Set(dispositivos.map((d) => d.uid).filter(Boolean));
  console.log('HUELLAS de dispositivo (dispositivosBeneficio): ' + dispositivos.length
    + ' · fichas distintas: ' + uidsConHuella.size
    + ' · fichas con bienvenida pendiente SIN huella: ' + bienvenida.filter((u) => !uidsConHuella.has(u.id)).length);
  const pasajeros = usuarios.filter((u) => u.tipo !== 'conductor');
  console.log('PASAJEROS (tipo distinto de conductor): ' + pasajeros.length
    + ' · con huella de bienvenida: ' + pasajeros.filter((u) => uidsConHuella.has(u.id)).length);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
