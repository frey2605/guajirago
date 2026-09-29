#!/usr/bin/env node
// 🤖 «¿QUÉ PASÓ CON ESTE MANDADO?» EN LAS DOS PANTALLAS DEL PANEL — gemelo G56 (29-sep-2026).
// Hasta ese día 🛣️ Viajes y 📦 Mensajería tenían cada una su tabla de palabras, y del MISMO mandado una decía
// «Cancelado por conductor» y la otra «Lo soltó el repartidor». Y ninguna enseñaba el porqué con que el sistema cierra
// un viaje (`motivoExpiracion`). Ahora las dos salen de `comoTermino(viaje, 'panel')` (guajirago-admin/src/estadosViaje.js).
// Este recorrido deja en la base de PRUEBAS, como el pasajero de prueba, DOS mandados —siempre los mismos documentos—:
// uno que soltó el repartidor (con su razón) y otro que cerró el sistema (con su porqué). Entra al panel como
// admin@gg.test y exige que 📦 Mensajería → Buscar y 🛣️ Viajes → Buscar digan la MISMA palabra de cada uno, y que se vea
// el porqué: en la tarjeta de Mensajería y en el detalle de Viajes.
//   node robot/que-paso-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CASOS = [
  { id: 'robot-que-paso-g56-soltado', origen: 'ROBOT G56 soltado origen', palabra: 'Lo canceló el repartidor',
    porque: 'ROBOT G56 se me pinchó la llanta',
    datos: { estado: 'cancelado_conductor', canceladoPor: 'conductor', razonCancelacion: 'ROBOT G56 se me pinchó la llanta' } },
  { id: 'robot-que-paso-g56-cerrado', origen: 'ROBOT G56 cerrado origen', palabra: 'Quedó sin terminar',
    porque: 'ROBOT G56 lo aceptaron hace 61 min y nunca recogió',
    datos: { estado: 'expirado', expiradoPor: 'sistema', motivoExpiracion: 'ROBOT G56 lo aceptaron hace 61 min y nunca recogió' } },
];

(async () => {
  const fallos = [];
  const base = await entrarALaBase('pasajero@gg.test');
  for (const c of CASOS) {
    await base.cambiar('viajes/' + c.id, {
      pasajeroId: base.uid,
      pasajeroNombre: 'Robot Qué Pasó G56',
      tipo: 'Mensajería',
      mensajeria: { queEnvia: 'Paquete G56' },
      origen: c.origen,
      destino: 'ROBOT G56 destino',
      tarifaValor: 6000,
      fechaSolicitud: new Date().toISOString(),
      ...c.datos,
    });
    const v = await base.leer('viajes/' + c.id);
    console.log('MANDADO EN PRUEBAS:', c.id, '·', v.estado);
  }

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'que-paso-panel' });
  const p = r.pagina;
  const entrar = async () => {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
  };
  const aModulo = async (icono) => {
    await p.reload();
    await p.waitForTimeout(8000);
    await p.locator('button, div').filter({ hasText: new RegExp('^' + icono + '$') }).last().click();
    await p.waitForTimeout(4000);
  };
  try {
    await entrar();
    for (const c of CASOS) {
      // 📦 MENSAJERÍA → Buscar
      await aModulo('📦');
      await p.getByText('Buscar', { exact: true }).first().click();
      await p.locator('input[placeholder^="Quien envía"]').first().fill(c.origen);
      await p.waitForTimeout(1500);
      const tarjeta = p.locator('div').filter({ hasText: c.origen }).filter({ hasText: 'Paquete G56' }).last();
      await tarjeta.scrollIntoViewIfNeeded().catch(() => {});
      await r.captura('mensajeria-' + c.id);
      const tMen = (await tarjeta.count()) ? await tarjeta.innerText() : '';
      console.log('📦 MENSAJERÍA', c.id, '→', tMen.replace(/\s+/g, ' ').slice(0, 220));
      if (!tMen.includes(c.palabra)) fallos.push('📦 Mensajería no dice «' + c.palabra + '» de ' + c.id);
      if (!tMen.includes('Motivo: ' + c.porque)) fallos.push('📦 Mensajería no enseña «Motivo: ' + c.porque + '»');

      // 🛣️ VIAJES → Buscar por origen, y el detalle
      await aModulo('🛣️');
      await p.getByText('Buscar', { exact: true }).first().click();
      await p.waitForTimeout(1000);
      await p.locator('input[placeholder="Lugar de origen"]').first().fill(c.origen);
      await p.getByText('🔍 Buscar', { exact: true }).first().click();
      await p.waitForTimeout(2000);
      const tv = p.locator('div').filter({ hasText: c.origen }).filter({ hasText: c.palabra }).last();
      await r.captura('viajes-' + c.id);
      if (!(await tv.count())) fallos.push('🛣️ Viajes no dice «' + c.palabra + '» de ' + c.id + ' (la misma palabra que Mensajería)');
      else {
        await tv.click();
        await p.waitForTimeout(1500);
        await r.captura('viajes-detalle-' + c.id);
        const det = await p.locator('body').innerText();
        console.log('🛣️ VIAJES (detalle)', c.id, '→ palabra:', det.includes(c.palabra) ? 'sí' : 'no', '· porqué:',
          det.includes(c.porque) ? 'sí' : 'no');
        if (!det.includes(c.porque)) fallos.push('el detalle de 🛣️ Viajes no enseña el porqué «' + c.porque + '»');
      }
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ 🛣️ Viajes y 📦 Mensajería dicen la misma palabra de cada final del mandado y enseñan su porqué (también el del sistema)');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
