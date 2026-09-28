#!/usr/bin/env node
// 🤖 LA AGENCIA VE EL DÍA QUE RESERVÓ EL CLIENTE — gemelo G11 (28-sep-2026).
// 1. El pasajero de prueba (pasajero@gg.test) deja en la base de PRUEBAS una reserva para la agencia de prueba
//    (prueba-agencia) el LUNES 5 de octubre de 2026 («2026-10-05», como la guarda el calendario de la app).
// 2. Entra a aliados como la agencia (agencia@gg.test) → «Reservas», busca esa reserva y lee su 📅.
// Tiene que decir lunes 5 («lun, 5 de oct»). Antes de G11 decía «dom, 4 de oct»: aliados leía el día como
// medianoche UTC, y en Colombia eso es el domingo a las 7 de la noche.
// Al final el pasajero cancela la reserva (no se puede borrar: reglas), así no queda en «Nuevas».
//   node robot/fecha-reserva.cjs
const { abrir, entrarComoRestaurante, entrarALaBase } = require('./comun.cjs');

const FECHA = '2026-10-05';

(async () => {
  const fallos = [];
  const hora = Date.now();
  const cliente = 'Robot G11 ' + hora;
  const ruta = 'reservasTurismo/robot-g11-' + hora;
  const base = await entrarALaBase('pasajero@gg.test');
  await base.cambiar(ruta, {
    agenciaId: 'prueba-agencia', clienteId: base.uid, agenciaNombre: 'Agencia de Turismo de Prueba',
    tourId: 'tour_1', tipo: 'tour', nombreTour: 'Cabo de la Vela en un día', imagen: '', cliente,
    telefono: '+573000000001', personas: 1, fecha: FECHA, total: 250000, unidadPrecio: 'persona',
    estado: 'nueva', notas: 'Reserva de mentira del robot (G11)', creado: new Date().toISOString(),
  });

  const r = await abrir('aliados', { nombre: 'fecha-reserva' });
  const p = r.pagina;
  let zona = ''; let dice = null;
  try {
    zona = await p.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    await entrarComoRestaurante(p, 'agencia@gg.test');
    await r.captura('adentro');
    if (!(await p.getByText('Reservas', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Reservas', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    // La tarjeta de ESTA reserva: la que lleva el nombre del cliente de esta corrida.
    dice = await p.evaluate((nombre) => {
      const ps = [...document.querySelectorAll('p')];
      const i = ps.findIndex((x) => x.textContent.includes(nombre));
      if (i < 0) return null;
      const f = ps.slice(i, i + 3).find((x) => x.textContent.includes('📅'));
      return f ? f.textContent.replace('📅', '').trim() : null;
    }, cliente);
    await r.captura('reservas');
  } finally {
    await r.cerrar();
    try { await base.cambiar(ruta, { estado: 'cancelada', motivoCancelacion: 'Reserva de mentira del robot' }); } catch (e) {
      console.log('⚠ no pude cancelar la reserva de mentira ' + ruta + ': ' + e.message);
    }
  }

  console.log('ZONA DEL NAVEGADOR:', zona, '· GUARDADO:', FECHA, '(lunes 5) · LA AGENCIA VE:', dice, '· capturas', r.carpeta);
  if (zona !== 'America/Bogota') fallos.push('el navegador no está en hora de Colombia (' + zona + '): así no se ve el fallo');
  if (dice === null) fallos.push('no encontré la reserva de «' + cliente + '» en «Reservas» de la agencia');
  else if (!/^lun\.?,? *5 de oct/.test(dice)) fallos.push('la agencia ve «' + dice + '» y el cliente reservó el lunes 5 de octubre');
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la agencia ve la reserva el mismo día que la pidió el cliente');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
