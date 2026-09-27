#!/usr/bin/env node
// 🤖 REVISAR UN CONDUCTOR EN EL PANEL — entra al panel de pruebas con la cuenta admin de prueba,
// busca al conductor por su nombre y comprueba que su ficha enseñe los 6 documentos, cargados.
//   node robot/revisar-panel.cjs "Robot Taxi De Prueba"
const { abrir, claveDePruebas } = require('./comun.cjs');

const buscar = process.argv[2] || 'Robot Taxi De Prueba';

(async () => {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'panel' });
  const p = r.pagina;
  const fallos = [];
  await p.locator('input[type="email"]').first().fill('admin@gg.test');
  await p.locator('input[type="password"]').first().fill(claveDePruebas());
  await p.getByText('Entrar al panel').click();
  await p.waitForTimeout(6000);
  // El menú del panel está ABAJO, con íconos; Conductores es el 🚗 (ver APRENDIDO.md).
  await p.locator('button, div').filter({ hasText: /^🚗$/ }).last().click();
  await p.waitForTimeout(3000);
  await p.getByText('Buscar', { exact: true }).first().click();
  await p.fill('input[placeholder="Nombre del conductor"]', buscar.split(' ')[0]);
  await p.getByRole('button', { name: '🔍 Buscar' }).last().click();
  await p.waitForTimeout(3000);
  // Los nombres se guardan en MAYÚSCULAS: se busca sin distinguir.
  const fila = p.getByText(new RegExp(buscar, 'i')).first();
  if (!(await fila.count())) fallos.push('no aparece «' + buscar + '» en la búsqueda');
  else {
    await fila.click();
    await p.waitForTimeout(4000);
    await r.captura('ficha');
    const t = await r.texto();
    const caja = (t.match(/📂 Documentos \((\d+) de (\d+)\)/) || []);
    console.log('CUADRO DE DOCUMENTOS:', caja[0] || '(no sale)');
    if (!caja[0]) fallos.push('la ficha no enseña el cuadro de documentos');
    else if (caja[1] !== caja[2]) fallos.push('faltan documentos: ' + caja[0]);
    const cargadas = await p.$$eval('img', (xs) => xs.filter((x) => x.complete && x.naturalWidth > 0).map((x) => x.alt).filter(Boolean));
    console.log('FOTOS QUE CARGARON:', cargadas.join(' | ') || 'ninguna');
    if (caja[2] && cargadas.length < Number(caja[2])) fallos.push('solo cargaron ' + cargadas.length + ' fotos de ' + caja[2]);
  }
  console.log('CAPTURAS:', r.carpeta);
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el panel enseña los documentos del conductor');
  await r.cerrar();
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
