#!/usr/bin/env node
// 🤖 EL HISTORIAL DEL PASAJERO ENSEÑA TODOS SUS VIAJES TERMINADOS — gemelo G21 (28-sep-2026).
// Hasta ese día las dos pantallas «Mis viajes» del pasajero (la del menú de Transporte, `Home.js`, y la del menú de
// módulos, `MisViajes.js`) solo enseñaban `finalizado` y `cancelado`: los viajes que canceló el conductor y los que se
// quedaron a medias NO SALÍAN, y lo que salía decía «Cancelado» o «Completado» a secas.
// Entra como el pasajero de prueba (pasajero@gg.test) en PRUEBAS y abre las dos. Exige, en las dos:
//   · que haya tarjetas (si sale «Aún no tienes viajes», la consulta ordenada falló: suele ser el índice
//     pasajeroId + fechaSolicitud sin construir, y la pantalla no lo dice);
//   · que salga al menos un viaje que el servidor dejó a medias con sus palabras, «Quedó sin terminar» (lo deja en
//     pruebas `robot/viaje-cerrado.cjs`; si no hay, se corre ése antes);
//   · que ya no salga el «Cancelado» a secas de antes.
// No escribe nada: solo mira.
//   node robot/historial-viajes.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';

function juzgar(nombre, texto, fallos) {
  const tarjetas = (texto.match(/\b(Taxi|Mototaxi|Mensajería|Mensajeria)\b/g) || []).length;
  console.log(nombre + ': ~' + tarjetas + ' tarjetas · «Quedó sin terminar» ×'
    + (texto.match(/Quedó sin terminar/g) || []).length + ' · «Completado» ×' + (texto.match(/Completado/g) || []).length
    + ' · «Lo cancelaste tú» ×' + (texto.match(/Lo cancelaste tú/g) || []).length
    + ' · «Lo canceló el conductor» ×' + (texto.match(/Lo canceló el conductor/g) || []).length);
  if (/Aún no tienes viajes/.test(texto)) {
    fallos.push(nombre + ': sale «Aún no tienes viajes» (¿el índice pasajeroId + fechaSolicitud no está construido?)');
    return;
  }
  if (!/Quedó sin terminar/.test(texto)) {
    fallos.push(nombre + ': no sale ningún viaje «Quedó sin terminar» (el expirado que deja robot/viaje-cerrado.cjs)');
  }
  if (/(^|\n)\s*Cancelado\s*(\n|$)/.test(texto)) fallos.push(nombre + ': sigue saliendo el «Cancelado» a secas de antes');
}

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'historial-viajes' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);

    // ── 1 · «Mis viajes» del menú de MÓDULOS (MisViajes.js) ──
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mis viajes').first().click();
    await p.waitForTimeout(6000);
    await r.captura('mis-viajes-modulos');
    juzgar('MisViajes (menú de módulos)', await r.texto(), fallos);
    await p.getByText('Volver').first().click();
    await p.waitForTimeout(2000);

    // ── 2 · «Mis viajes» del menú de TRANSPORTE (Home.js) ──
    for (const paso of ['Transporte y movilidad', 'Soy pasajero']) {
      const x = p.getByText(paso, { exact: true });
      if (await x.count()) { await x.first().click(); await p.waitForTimeout(2500); }
    }
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mis viajes').first().click();
    await p.waitForTimeout(6000);
    await r.captura('mis-viajes-pasajero');
    juzgar('Home · Mis viajes (menú del pasajero)', await r.texto(), fallos);
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ las dos pantallas «Mis viajes» del pasajero enseñan los viajes que no se completaron, en palabras');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
