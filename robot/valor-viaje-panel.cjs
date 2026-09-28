#!/usr/bin/env node
// 🤖 ¿CUÁNTO VALIÓ ESTE VIAJE? EN EL PANEL — gemelo G19 (28-sep-2026).
// Hasta ese día el panel decía que un viaje valió `contraofertaValor || tarifaValor`: en 2 viajes de julio la oferta
// vieja ($11.000 y $11.500) no fue la que quedó, y el panel la enseñaba en vez del precio ($10.000 y $10.500).
// Este recorrido deja en la base de PRUEBAS, como el pasajero de prueba, UN viaje cancelado con esa misma forma
// (tarifaValor 10.000, contraofertaValor 11.000 y sin el texto `tarifa`, para que la tarjeta pinte el número) —
// siempre el mismo documento, así que no se amontonan—, entra al panel como admin@gg.test, va a 🛣️ Viajes →
// «Sin completar» y lee la tarjeta: tiene que decir $ 10.000.
//   node robot/valor-viaje-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const ID = 'robot-valor-viaje-g19';
const ORIGEN = 'ROBOT G19 origen';
const P = '\\$[ ' + String.fromCharCode(160) + ']([\\d.]+)'; // una cifra como la escribe cop(): «$ 10.000»

(async () => {
  const fallos = [];
  const base = await entrarALaBase('pasajero@gg.test');
  await base.cambiar('viajes/' + ID, {
    pasajeroId: base.uid,
    pasajeroNombre: 'Robot Valor G19',
    tipo: 'Taxi',
    estado: 'cancelado',
    origen: ORIGEN,
    destino: 'ROBOT G19 destino',
    tarifaValor: 10000,
    contraofertaValor: 11000,
    fechaSolicitud: new Date().toISOString(),
  });
  const v = await base.leer('viajes/' + ID);
  console.log('VIAJE EN PRUEBAS:', ID, '· tarifaValor', v.tarifaValor, '· contraofertaValor', v.contraofertaValor, '· tarifa', v.tarifa);

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'valor-viaje-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Viajes es el 🛣️.
    await p.locator('button, div').filter({ hasText: /^🛣️$/ }).last().click();
    await p.waitForTimeout(4000);
    await p.getByText('Sin completar', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    const tarjeta = p.locator('div').filter({ hasText: ORIGEN }).filter({ hasText: /\$/ }).last();
    await tarjeta.scrollIntoViewIfNeeded().catch(() => {});
    await r.captura('sin-completar');
    const texto = await tarjeta.innerText().catch(() => '');
    const m = texto.match(new RegExp(P));
    console.log('LA TARJETA DICE:', m ? '$ ' + m[1] : '(no encuentro la tarjeta del robot con su cifra)');
    if (!m) fallos.push('no encuentro en «Sin completar» la tarjeta «' + ORIGEN + '» con su cifra');
    else if (m[1] !== '10.000') fallos.push('la tarjeta dice $ ' + m[1] + ' y el viaje valió $ 10.000 (tarifaValor)');
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el panel enseña lo que valió el viaje (tarifaValor), no la oferta vieja');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
