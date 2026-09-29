#!/usr/bin/env node
// 🤖 EL «💬 WHATSAPP» DEL PANEL ABRE EL NÚMERO DE LA PIEZA, O LO DICE — gemelo G41 (28-sep-2026).
// Entra al panel de pruebas como superadmin (admin@gg.test), va a 🍽️ Restaurantes y a 🧭 Turismo, abre la ficha
// de cada negocio que haya y aprieta «💬 WhatsApp». El `window.open` se cambia ANTES de cargar por uno que solo
// apunta la dirección (no se abre nada). Lo que abrió se compara con la pieza (guajirago-admin/src/telefonoValido.js,
// EJECUTADA en Node con el teléfono que enseña la ficha): si el teléfono sirve, wa.me/57 + sus 10 cifras; si no,
// no abre nada y sale la ventanita «No puedo abrir WhatsApp». Antes de G41, «5712345678» abría wa.me/5712345678 (sin
// indicativo) y un teléfono sin cifras callaba. Solo lee: no escribe nada.
//   node robot/whatsapp-panel.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const { enlaceWhatsApp } = cargarDeLaApp('guajirago-admin/src/telefonoValido.js');

// Un window.open que no abre nada: apunta la dirección y devuelve una ventana de mentira.
const antesDeCargar = '(' + (() => {
  window.__abiertos = [];
  window.open = (u) => { window.__abiertos.push(String(u)); return {}; };
}) + ')();';

(async () => {
  const fallos = [];
  let probados = 0;
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'whatsapp-panel', antesDeCargar });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    for (const [icono, seccion] of [['🍽️', 'Restaurantes'], ['🧭', 'Turismo']]) {
      await p.locator('button, div').filter({ hasText: new RegExp('^' + icono + '$') }).last().click();
      await p.waitForTimeout(5000);
      // Las tarjetas de la lista: las que se tocan y dicen cuántos platos o servicios tiene el negocio.
      const tarjetas = p.locator('div[style*="cursor: pointer"]').filter({ hasText: /\d+ (platos|tours\/alquileres)/ });
      const n = Math.min(await tarjetas.count(), 3);
      console.log(seccion.toUpperCase() + ': ' + n + ' ficha(s) para probar');
      for (let i = 0; i < n; i++) {
        await tarjetas.nth(i).click();
        await p.waitForTimeout(1500);
        const boton = p.getByText('💬 WhatsApp', { exact: true });
        if (!(await boton.count())) { await r.captura(seccion + '-' + i + '-sin-boton'); continue; }
        // El texto de la pantalla viene en un solo renglón: el teléfono va de «📞» hasta el siguiente ícono (✉️).
        const tel = (((await r.texto()).match(/📞\s*(.*?)\s*✉️/) || [])[1] || '').trim();
        const antes = await p.evaluate(() => window.__abiertos.length);
        await boton.first().click();
        await p.waitForTimeout(800);
        const abierto = await p.evaluate((k) => window.__abiertos[k] || '', antes);
        const texto = await r.texto();
        const debe = enlaceWhatsApp(tel === '—' ? '' : tel);
        await r.captura(seccion + '-' + i);
        const tapar = (x) => String(x).replace(/\d(?=\d{2})/g, '•');
        console.log('   teléfono ' + tapar(tel) + ' → abrió «' + tapar(abierto) + '» · la pieza dice «' + tapar(debe) + '»');
        probados++;
        if (debe) {
          if (abierto !== debe) fallos.push(seccion + ': con «' + tapar(tel) + '» abrió «' + tapar(abierto) + '» y la pieza dice «' + tapar(debe) + '»');
        } else {
          if (abierto) fallos.push(seccion + ': con «' + tapar(tel) + '», que no sirve, abrió «' + tapar(abierto) + '»');
          if (!/No puedo abrir WhatsApp/.test(texto)) fallos.push(seccion + ': con «' + tapar(tel) + '», que no sirve, no salió la ventanita');
          else await p.getByText('Entendido', { exact: true }).first().click();
        }
        await p.keyboard.press('Escape');
        const volver = p.getByText(/Volver/).first();
        if (await volver.count()) await volver.click().catch(() => {});
        await p.waitForTimeout(1000);
      }
      // A la portada, para el siguiente ícono.
      const inicio = p.locator('button, div').filter({ hasText: /^🏠$/ }).last();
      if (await inicio.count()) await inicio.click().catch(() => {});
      await p.waitForTimeout(1500);
    }
    if (!probados) fallos.push('no encontré ninguna ficha con «💬 WhatsApp» que probar: la prueba no probó nada');
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el «💬 WhatsApp» del panel abre el número de la pieza (' + probados + ' ficha(s))');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
