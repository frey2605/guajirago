#!/usr/bin/env node
// 🤖 EL CANDADO DE LA LEY DEL BOTÓN NO SE TRABA EN EL NAVEGADOR (27-sep-2026).
// Entra como el taxista de prueba (taxi@gg.test) → «Menú» → «Mis créditos», escribe un código de recarga INVENTADO
// y toca «Recargar» DOS veces (cerrando la ventanita entre una y otra). Cada toque tiene que:
//   1. terminar con la ventanita de la verdad («Ese código no existe…»), en menos de 15 s;
//   2. dejar el botón otra vez en «Recargar» y tocable (no en «Recargando…» para siempre).
// Y la página no puede romper con «Illegal invocation».
// Hasta el 27-sep-2026 el candado (src/candado.js, el mismo en las tres apps) guardaba `{ poner: setTimeout }` y lo
// llamaba como `reloj.poner(…)`: en el navegador eso revienta, así que la acción se hacía UNA vez, el botón se quedaba
// en «Recargando…», no decía cómo terminó, y el segundo toque no hacía nada hasta recargar la página.
// No escribe nada en la base: el código no existe, así que el servidor no toca ningún saldo.
//   node robot/candado-recarga.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'taxi@gg.test';
const CODIGO = 'ROBOTNOEXISTE' + Date.now().toString().slice(-6);

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'candado-recarga' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mis créditos').first().click();
    await p.waitForTimeout(3000);
    await r.captura('creditos');

    // Un toque: escribe el código, toca «Recargar» y espera hasta 15 s a la ventanita. Devuelve qué pasó.
    const unToque = async (n) => {
      const boton = p.getByRole('button', { name: 'Recargar', exact: true });
      if (!(await boton.count())) return { tocable: false };
      await p.fill('input[placeholder="ESCRIBE TU CÓDIGO"]', CODIGO);
      await boton.click();
      let ventanita = false;
      for (let i = 0; i < 30 && !ventanita; i += 1) {
        await p.waitForTimeout(500);
        ventanita = (await p.getByRole('button', { name: 'Entendido' }).count()) > 0;
      }
      const texto = await r.texto();
      await r.captura('toque-' + n);
      const trabado = /Recargando…/.test(texto);
      const dice = (/[^\n]*no existe[^\n]*/.exec(texto) || [''])[0];
      if (ventanita) {
        await p.getByRole('button', { name: 'Entendido' }).first().click();
        await p.waitForTimeout(800);
      }
      const libre = await boton.count() ? await boton.isEnabled() : false;
      return { tocable: true, ventanita, trabado, dice, libre };
    };

    for (const n of [1, 2]) {
      const t = await unToque(n);
      console.log('TOQUE ' + n + ':', JSON.stringify(t));
      if (!t.tocable) { fallos.push('toque ' + n + ': el botón «Recargar» ya no está (se quedó en otra palabra)'); continue; }
      if (!t.ventanita) fallos.push('toque ' + n + ': no salió la ventanita que dice cómo terminó');
      if (t.trabado) fallos.push('toque ' + n + ': el botón se quedó en «Recargando…»');
      if (!t.dice) fallos.push('toque ' + n + ': la pantalla no dice que el código no existe');
      if (!t.libre) fallos.push('toque ' + n + ': después del aviso el botón no quedó tocable');
    }
    const rompio = r.errores.filter((e) => /Illegal invocation/.test(e));
    if (rompio.length) fallos.push('la página rompió con «Illegal invocation» (' + rompio.length + ' vez/veces)');
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el candado no se traba: los dos toques dicen la verdad y el botón vuelve a quedar tocable');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
