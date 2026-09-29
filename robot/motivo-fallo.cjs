#!/usr/bin/env node
// 🤖 CUANDO ALGO NO SE GUARDA, LA PANTALLA DICE POR QUÉ — gemelo G40 (28-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test) → ☰ Menú → 👤 Mi perfil, escoge como foto un archivo de 11 MB
// (el almacén solo acepta fotos de menos de 10 MB: storage.rules, esUnaFoto) y toca «Guardar cambios». Tiene que:
//   1. decir el motivo que da motivoDeRechazo (la pieza única), y NO «Revisa tu conexión» —que era lo que decía
//      antes de G40 fuera cual fuera el fallo, aunque la red estuviera perfecta—;
//   2. soltar el botón (no quedarse en «Guardando...»).
// No escribe nada en la base: la foto la rechaza el almacén antes de subirla y el perfil no se toca.
//   node robot/motivo-fallo.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';
// Los textos que puede dar motivoDeRechazo (guajirago/src/avisoRechazo.js): permiso, sin red, u otro.
const DE_LA_PIEZA = /El servidor no aceptó el cambio|No hay internet ahora mismo|Algo falló por el camino/;

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'motivo-fallo' });
  const p = r.pagina;
  let aviso = ''; let boton = '';
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mi perfil', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    await r.captura('perfil');

    // Una «foto» de 11 MB: pasa el `accept="image/*"` del teléfono, pero el almacén la rechaza por grande.
    await p.locator('input[type="file"]').first().setInputFiles({
      name: 'grande.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024, 1),
    });
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Guardar cambios' }).click();
    // El rechazo llega cuando el almacén contesta: se espera el renglón rojo, con tope.
    for (let i = 0; i < 40 && !aviso; i++) {
      await p.waitForTimeout(1000);
      aviso = (await p.locator('p').allTextContents()).find((t) => DE_LA_PIEZA.test(t) || /Revisa tu conexi/.test(t)) || '';
    }
    boton = ((await p.getByRole('button', { name: /Guardar cambios|Guardando/ }).first().textContent()) || '').trim();
    await r.captura('despues-de-guardar');
  } finally {
    await r.cerrar();
  }

  console.log('AVISO:', aviso || '(ninguno)', '· BOTÓN:', boton, '· capturas', r.carpeta);
  if (!aviso) fallos.push('con una foto de 11 MB la pantalla no dijo nada en 40 s');
  else if (/Revisa tu conexi/.test(aviso)) fallos.push('dice «' + aviso + '»: culpa a la conexión de un rechazo del almacén (lo que G40 arregló)');
  else if (!DE_LA_PIEZA.test(aviso)) fallos.push('el aviso «' + aviso + '» no es el de motivoDeRechazo');
  if (/Guardando/.test(boton)) fallos.push('el botón se quedó en «Guardando...»');
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ Mi perfil dice el motivo de verdad cuando la foto no entra, no «Revisa tu conexión»');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
