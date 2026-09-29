#!/usr/bin/env node
// 🤖 RECUPERAR LA CONTRASEÑA NO DELATA CORREOS NI CULPA AL CORREO DE TODO — gemelo G71 (29-sep-2026).
// Abre la app de transporte de PRUEBAS sin entrar a ninguna cuenta: «Ya tengo cuenta» →
//   1. escribe un correo que NO existe y toca «¿Olvidaste tu contraseña?»: tiene que salir la ventanita neutra
//      («Si ese correo está registrado…»), la misma que saldría con uno que existe; nunca «No encontramos ese correo».
//   2. escribe un correo mal escrito: tiene que decir que el correo no está bien escrito (motivoDeRechazo).
// A un correo que no existe el servidor no le manda nada, y al mal escrito tampoco: no se envía ningún correo ni se
// toca la base.
//   node robot/recuperar-contrasena.cjs
const { abrir } = require('./comun.cjs');

async function pedir(r, correo) {
  const p = r.pagina;
  await p.fill('input[placeholder="Correo electrónico"]', correo);
  await p.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
  await p.waitForTimeout(4000);
  return r.texto();
}

async function cerrar(r) {
  const boton = r.pagina.getByRole('button', { name: 'Entendido' });
  if (await boton.count()) { await boton.first().click(); await r.pagina.waitForTimeout(800); }
}

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'recuperar-contrasena' });
  const p = r.pagina;
  try {
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(1500);

    const t1 = await pedir(r, 'robot-no-existe-g71@ejemplo.invalid');
    await r.captura('correo-que-no-existe');
    const neutro = /Si ese correo está registrado en GuajiraGo/.test(t1);
    console.log('CORREO QUE NO EXISTE:', neutro ? 'ventanita neutra ✓' : '(no salió la neutra)');
    if (!neutro) fallos.push('con un correo que no existe no salió «Si ese correo está registrado en GuajiraGo…»');
    if (/No encontramos ese correo/.test(t1)) fallos.push('dice «No encontramos ese correo»: delata qué correos existen');
    await cerrar(r);

    const t2 = await pedir(r, 'esto no es un correo');
    await r.captura('correo-mal-escrito');
    const malo = /El correo no está bien escrito/.test(t2);
    console.log('CORREO MAL ESCRITO:', malo ? '«El correo no está bien escrito» ✓' : '(no lo dijo)');
    if (!malo) fallos.push('con un correo mal escrito no dijo «El correo no está bien escrito»');
    if (/No encontramos ese correo/.test(t2)) fallos.push('con un correo mal escrito culpa a que no existe');
    await cerrar(r);

    console.log('capturas', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  } finally {
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ recuperar la contraseña da el aviso neutro y dice la verdad del correo mal escrito');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
