#!/usr/bin/env node
// 🤖 LAS VENTANITAS DE AVISO SON LA COMÚN (AvisoModal) — gemelo G39 (28-sep-2026).
// Abre la app de transporte de PRUEBAS sin entrar a ninguna cuenta: «Crear cuenta» → toca «Crear cuenta» con todo
// vacío. Tiene que salir la ventanita «Atención · Por favor completa todos los campos», y tiene que ser la COMÚN
// (AvisoModal: su «Entendido» es azul #1C8EF9; la de antes, escrita a mano en Login.js, era naranja degradado).
// «Entendido» la cierra. No crea cuentas ni toca la base.
//   node robot/ventanitas-aviso.cjs
const { abrir } = require('./comun.cjs');

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'ventanitas-aviso' });
  const p = r.pagina;
  try {
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Crear cuenta' }).first().click();
    await p.waitForTimeout(1500);
    await p.getByRole('button', { name: 'Crear cuenta' }).last().click();
    await p.waitForTimeout(1200);
    const texto = await r.texto();
    await r.captura('ventanita-registro');
    const sale = /Atención/.test(texto) && /Por favor completa todos los campos/.test(texto);
    console.log('LA VENTANITA:', sale ? '«Atención · Por favor completa todos los campos»' : '(no salió)');
    if (!sale) fallos.push('con el registro vacío no salió la ventanita «Atención · Por favor completa todos los campos»');
    else {
      const boton = p.getByRole('button', { name: 'Entendido' });
      const cuantos = await boton.count();
      const fondo = cuantos ? await boton.first().evaluate((b) => getComputedStyle(b).backgroundColor + ' | ' + getComputedStyle(b).backgroundImage) : '';
      console.log('EL BOTÓN «Entendido»:', cuantos, 'visible(s) ·', fondo);
      if (cuantos !== 1) fallos.push('hay ' + cuantos + ' botones «Entendido» (debería ser UNO)');
      if (!/rgb\(28, 142, 249\)/.test(fondo) || /gradient/.test(fondo)) fallos.push('la ventanita no es la común (AvisoModal): su «Entendido» es ' + fondo);
      await boton.first().click();
      await p.waitForTimeout(800);
      const cerro = !/Por favor completa todos los campos/.test(await r.texto());
      await r.captura('ventanita-cerrada');
      if (!cerro) fallos.push('«Entendido» no cierra la ventanita');
    }
    console.log('capturas', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  } finally {
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el aviso del registro sale en la ventanita común, con sus palabras, y «Entendido» la cierra');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
