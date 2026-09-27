#!/usr/bin/env node
// 🤖 CREAR UN EMPLEADO EN ALIADOS — entra a aliados de pruebas como el dueño del restaurante de
// prueba, va a Configuración → Mi equipo → «+ Agregar empleado», lo crea con el rol de mesero y
// comprueba que aparezca en la lista. Crear un empleado usa la SEGUNDA conexión de aliados (la que
// no cierra la sesión del dueño), que desde el 27-sep-2026 también lleva el sello de App Check:
// después de correr esto, `node robot/portero.cjs` tiene que contar las llamadas con sello válido.
//   node robot/crear-empleado.cjs
const { abrir, entrarComoRestaurante } = require('./comun.cjs');

const marca = Date.now();
const nombre = 'Robot Mesero ' + String(marca).slice(-5);
const correo = 'robot.empleado.' + marca + '@gg.test';

(async () => {
  const r = await abrir('aliados', { nombre: 'crear-empleado' });
  const p = r.pagina;
  const fallos = [];

  // ── Entrar como el dueño del restaurante de prueba (pieza común de robot/comun.cjs) ──
  await entrarComoRestaurante(p);
  await r.captura('dentro');

  // ── Configuración → Mi equipo ──
  const menu = p.getByText(/Menú|☰/).first();
  if (await menu.count()) { await menu.click(); await p.waitForTimeout(800); }
  await p.getByText('Configuración', { exact: true }).first().click();
  await p.waitForTimeout(1500);
  await p.getByText('Mi equipo', { exact: true }).click();
  await p.waitForTimeout(2500);
  await r.captura('equipo');

  // ── + Agregar empleado ──
  await p.getByText('+ Agregar empleado').click();
  await p.fill('input[placeholder="Nombre del empleado"]', nombre);
  await p.fill('input[placeholder="Correo para que inicie sesión"]', correo);
  await p.fill('input[placeholder="Mínimo 6 caracteres"]', 'Robot' + Math.random().toString(36).slice(2, 10));
  await p.getByText('Mesero', { exact: true }).first().click();
  await r.captura('formulario');
  await p.getByRole('button', { name: 'Crear empleado' }).click();
  await p.waitForTimeout(8000);
  await r.captura('creado');
  const t = await r.texto();
  if (!t.toUpperCase().includes(nombre.toUpperCase())) fallos.push('el empleado no aparece en la lista después de crearlo: ' + t.slice(0, 200));

  console.log('EMPLEADO:', nombre, '·', correo);
  console.log('CAPTURAS:', r.carpeta);
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ aliados crea el empleado');
  await r.cerrar();
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
