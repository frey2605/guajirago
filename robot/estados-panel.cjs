#!/usr/bin/env node
// 🤖 LOS ESTADOS DEL VIAJE EN EL BUSCADOR DEL PANEL — gemelo G25 (28-sep-2026).
// Hasta ese día el desplegable ESTADO del buscador de 🛣️ Viajes ofrecía cuatro estados escritos a mano, y le faltaban
// `aceptado`, `vencido` y `expirado`: los 9 viajes `expirado` de producción no se podían buscar por su estado. Ahora
// ofrece todos los de la copia atada del panel (guajirago-admin/src/estadosViaje.js).
// Este recorrido deja en la base de PRUEBAS, como el pasajero de prueba, UN viaje `expirado` —siempre el mismo
// documento, así que no se amontonan—, entra al panel como admin@gg.test, va a 🛣️ Viajes → Buscar, mira que el
// desplegable ofrezca «Con conductor», «Nadie lo tomó» y «Quedó sin terminar», escoge «Quedó sin terminar» con el
// origen del robot, busca, y exige que salga la tarjeta del viaje con su etiqueta.
//   node robot/estados-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const ID = 'robot-estados-panel-g25';
const ORIGEN = 'ROBOT G25 origen';
const DEBE_OFRECER = ['Con conductor', 'Nadie lo tomó', 'Quedó sin terminar'];

(async () => {
  const fallos = [];
  const base = await entrarALaBase('pasajero@gg.test');
  await base.cambiar('viajes/' + ID, {
    pasajeroId: base.uid,
    pasajeroNombre: 'Robot Estados G25',
    tipo: 'Taxi',
    estado: 'expirado',
    origen: ORIGEN,
    destino: 'ROBOT G25 destino',
    tarifaValor: 7000,
    fechaSolicitud: new Date().toISOString(),
  });
  const v = await base.leer('viajes/' + ID);
  console.log('VIAJE EN PRUEBAS:', ID, '· estado', v.estado);

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'estados-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Viajes es el 🛣️.
    await p.locator('button, div').filter({ hasText: /^🛣️$/ }).last().click();
    await p.waitForTimeout(4000);
    await p.getByText('Buscar', { exact: true }).first().click();
    await p.waitForTimeout(1500);
    const desplegable = p.locator('select').first();
    const ofrece = await desplegable.locator('option').allInnerTexts();
    console.log('EL DESPLEGABLE OFRECE:', ofrece.join(' · '));
    for (const t of DEBE_OFRECER) if (!ofrece.includes(t)) fallos.push('el desplegable no ofrece «' + t + '»');
    await desplegable.selectOption('expirado');
    await p.locator('input[placeholder="Lugar de origen"]').first().fill(ORIGEN);
    await p.getByText('🔍 Buscar', { exact: true }).first().click();
    await p.waitForTimeout(2000);
    const tarjeta = p.locator('div').filter({ hasText: ORIGEN }).filter({ hasText: 'Quedó sin terminar' }).last();
    await tarjeta.scrollIntoViewIfNeeded().catch(() => {});
    await r.captura('buscar-expirado');
    const sale = await tarjeta.count();
    console.log('TARJETA DEL VIAJE EXPIRADO EN EL RESULTADO:', sale ? 'sí' : 'no');
    if (!sale) fallos.push('buscando «Quedó sin terminar» no sale la tarjeta «' + ORIGEN + '» con su etiqueta');

    // LA FICHA DEL PASAJERO (🙋 Pasajeros → Buscar por correo): con el viaje del robot en `expirado`, «❌ Cancelados»
    // tiene que bajar en UNO al pasarlo a `finalizado` (con la lista vieja no lo contaba, y no bajaba). Después se
    // deja otra vez en `expirado`.
    const leerFicha = async (paso) => {
      await p.reload();
      await p.waitForTimeout(8000);
      await p.locator('button, div').filter({ hasText: /^🙋$/ }).last().click();
      await p.waitForTimeout(5000);
      await p.getByText('Buscar', { exact: true }).first().click();
      await p.locator('input[placeholder="Correo electrónico"]').first().fill('pasajero@gg.test');
      await p.getByText('🔍 Buscar', { exact: true }).first().click();
      await p.waitForTimeout(1500);
      await p.locator('div').filter({ hasText: 'pasajero@gg.test' }).last().click();
      await p.waitForTimeout(1500);
      await r.captura('ficha-' + paso);
      const m = (await p.locator('body').innerText()).match(/❌ Cancelados: (\d+)/);
      return m ? Number(m[1]) : null;
    };
    const conExpirado = await leerFicha('expirado');
    await base.cambiar('viajes/' + ID, { estado: 'finalizado' });
    const conFinalizado = await leerFicha('finalizado');
    await base.cambiar('viajes/' + ID, { estado: 'expirado' });
    console.log('FICHA DEL PASAJERO «❌ Cancelados»: con el viaje expirado', conExpirado, '· con el viaje finalizado', conFinalizado);
    if (conExpirado == null || conFinalizado == null) fallos.push('no pude leer «❌ Cancelados» en la ficha del pasajero');
    else if (conExpirado - conFinalizado !== 1) {
      fallos.push('la ficha del pasajero no cuenta el viaje expirado como cancelado (' + conExpirado + ' → ' + conFinalizado + ')');
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ el buscador del panel ofrece todos los estados y encuentra el viaje expirado, y la ficha del pasajero lo cuenta como cancelado');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
