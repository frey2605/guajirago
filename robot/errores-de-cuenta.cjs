#!/usr/bin/env node
// 🤖 LOS ERRORES AL ENTRAR SE DICEN IGUAL EN LAS TRES APPS Y NO DELATAN CORREOS — gemelo G72 (29-sep-2026).
// Abre las tres apps de PRUEBAS sin entrar a ninguna cuenta y trata de entrar con una contraseña que no es:
//   · transporte y panel: con un correo que NO existe;
//   · aliados: con un correo que no existe Y con el de la cuenta de prueba del restaurante (restaurante@gg.test).
// En los cuatro intentos tiene que salir la MISMA frase, la de avisoRechazo.js: «No se pudo iniciar sesión. El correo
// o la contraseña no son correctos…». Si el correo que existe y el que no dijeran distinto, delataría qué correos
// tienen cuenta. Un solo intento fallido por cuenta: no alcanza para que el servidor la bloquee. No se escribe nada.
//   node robot/errores-de-cuenta.cjs
const { abrir } = require('./comun.cjs');

const FRASE = 'No se pudo iniciar sesión. El correo o la contraseña no son correctos';
const NO_EXISTE = 'robot-no-existe-g72@ejemplo.invalid';
const CLAVE_MALA = 'clave-que-no-es-g72';

(async () => {
  const fallos = [];
  const vistos = {};

  // Transporte: «Ya tengo cuenta» → correo, contraseña → «Entrar a GuajiraGo».
  let r = await abrir('transporte', { nombre: 'errores-de-cuenta-transporte' });
  try {
    const p = r.pagina;
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(1500);
    await p.fill('input[placeholder="Correo electrónico"]', NO_EXISTE);
    await p.fill('input[placeholder="Contraseña"]', CLAVE_MALA);
    await p.getByRole('button', { name: 'Entrar a GuajiraGo' }).click();
    await p.waitForTimeout(5000);
    await r.captura('transporte-correo-que-no-existe');
    vistos.transporte = await r.texto();
    console.log('ERRORES DE LA PÁGINA (transporte):', r.errores.join(' || ') || 'ninguno');
  } finally { await r.cerrar(); }

  // Panel: correo, contraseña → «Entrar al panel».
  r = await abrir('panel', { nombre: 'errores-de-cuenta-panel' });
  try {
    const p = r.pagina;
    await p.waitForTimeout(3000);
    await p.fill('input[placeholder="Correo electrónico"]', NO_EXISTE);
    await p.fill('input[placeholder="Contraseña"]', CLAVE_MALA);
    await p.getByRole('button', { name: 'Entrar al panel' }).click();
    await p.waitForTimeout(5000);
    await r.captura('panel-correo-que-no-existe');
    vistos.panel = await r.texto();
    console.log('ERRORES DE LA PÁGINA (panel):', r.errores.join(' || ') || 'ninguno');
  } finally { await r.cerrar(); }

  // Aliados: dos intentos, uno con un correo que no existe y otro con el de la cuenta de prueba.
  for (const [nombre, correo] of [['aliadosNoExiste', NO_EXISTE], ['aliadosExiste', 'restaurante@gg.test']]) {
    r = await abrir('aliados', { nombre: 'errores-de-cuenta-' + nombre });
    try {
      const p = r.pagina;
      await p.waitForTimeout(3000);
      await p.getByText(/Ya tengo cuenta/).first().click();
      await p.waitForTimeout(1000);
      await p.locator('input[placeholder="Correo"]').first().fill(correo);
      await p.locator('input[placeholder="Contrasena"]').first().fill(CLAVE_MALA);
      await p.getByRole('button', { name: 'Entrar', exact: true }).click();
      await p.waitForTimeout(5000);
      await r.captura(nombre);
      vistos[nombre] = await r.texto();
      console.log('ERRORES DE LA PÁGINA (' + nombre + '):', r.errores.join(' || ') || 'ninguno');
    } finally { await r.cerrar(); }
  }

  for (const [donde, t] of Object.entries(vistos)) {
    const ok = t.includes(FRASE);
    console.log(donde.padEnd(16), ok ? '«' + FRASE + '…» ✓' : '(no salió la frase)');
    if (!ok) fallos.push(donde + ': no salió «' + FRASE + '…»');
    if (/Error al (ingresar|iniciar sesion)|Correo o contrase(ñ|n)a incorrectos/.test(t)) fallos.push(donde + ': sigue saliendo el texto viejo de su propia tablita');
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ las tres apps dicen lo mismo al fallar la entrada, exista o no el correo');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
