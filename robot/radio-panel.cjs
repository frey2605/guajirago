#!/usr/bin/env node
// 🤖 EL RADIO DE BÚSQUEDA DEL PANEL NO SE GUARDA EN 0 — gemelo G04 (27-sep-2026).
// Entra al panel de pruebas como superadmin (admin@gg.test), va a 👑 Superadmin → configuración, BORRA el campo
// «RADIO DE BÚSQUEDA INICIAL» (eso lo deja en 0) y toca «Guardar cambios». Tiene que salir el aviso de que el radio
// debe ser mayor que 0, y en la BASE de pruebas config/global tiene que seguir con el radio de antes.
// Si el arreglo fallara y se guardara el 0, al final se devuelve el radio de antes.
//   node robot/radio-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

(async () => {
  const fallos = [];
  const db = await entrarALaBase('admin@gg.test');
  const antes = await db.leer('config/global');
  console.log('RADIO ANTES:', antes.radioBusquedaInicial, '/', antes.radioBusquedaAmpliado);

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'radio-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    // El menú del panel está ABAJO, con íconos; Superadmin es el 👑.
    await p.locator('button, div').filter({ hasText: /^👑$/ }).last().click();
    await p.waitForTimeout(4000);
    const campo = p.locator('xpath=//p[normalize-space(.)="RADIO DE BÚSQUEDA INICIAL"]/following-sibling::div//input').first();
    if (!(await campo.count())) fallos.push('no encuentro el campo «RADIO DE BÚSQUEDA INICIAL»');
    else {
      await campo.fill('');
      await p.getByRole('button', { name: 'Guardar cambios' }).click();
      await p.waitForTimeout(3000);
      await r.captura('radio-en-0');
      const t = await r.texto();
      const aviso = (t.match(/❌ El radio de búsqueda[^\n]*/) || [])[0];
      console.log('AVISO:', aviso || '(no sale)');
      if (!aviso || !/inicial.*mayor que 0/.test(aviso)) fallos.push('no sale el aviso de que el radio inicial debe ser mayor que 0');
    }
    const despues = await db.leer('config/global');
    console.log('RADIO DESPUÉS:', despues.radioBusquedaInicial, '/', despues.radioBusquedaAmpliado);
    if (despues.radioBusquedaInicial !== antes.radioBusquedaInicial) {
      fallos.push('se guardó el radio inicial: ' + antes.radioBusquedaInicial + ' → ' + despues.radioBusquedaInicial);
      await db.cambiar('config/global', { radioBusquedaInicial: antes.radioBusquedaInicial });
      console.log('(se devolvió el radio de antes)');
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el panel no deja guardar el radio de búsqueda en 0 y dice por qué');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
