#!/usr/bin/env node
// 🤖 REGISTRAR UN CONDUCTOR — crea una cuenta NUEVA en pruebas y se registra como conductor,
// como lo haría una persona. Comprueba dos cosas del arreglo del 27-sep-2026 (documentos):
//   1. con UNA foto de menos, el registro se para y dice cuál falta;
//   2. con todas, entra y le dan la bienvenida de conductor.
// Deja el correo del conductor creado en la salida, para que robot/revisar-panel.cjs lo busque.
//   node robot/registrar-conductor.cjs [Taxi|Mototaxi]
const { abrir, fotoDeMentira } = require('./comun.cjs');

const TIPO = process.argv[2] === 'Mototaxi' ? 'Mototaxi' : 'Taxi';
const marca = Date.now();
const correo = 'robot.' + TIPO.toLowerCase() + '.' + marca + '@gg.test';
const clave = 'Robot' + Math.random().toString(36).slice(2, 10);
const nombre = 'Robot ' + TIPO + ' De Prueba';

(async () => {
  const r = await abrir('transporte', { nombre: 'registrar-' + TIPO.toLowerCase() });
  const p = r.pagina;
  const fallos = [];

  // ── La cuenta ──
  await p.getByRole('button', { name: 'Crear cuenta' }).click();
  await p.fill('input[placeholder="NOMBRE COMPLETO"]', nombre);
  await p.fill('input[placeholder="Correo electrónico"]', correo);
  await p.fill('input[placeholder="Confirmar correo electrónico"]', correo);
  // El celular NO se puede repetir entre cuentas (ver APRENDIDO.md): uno distinto cada vez.
  await p.locator('input[placeholder="3001234567"]').first().fill('300' + String(marca).slice(-7));
  const fecha = p.locator('select');
  await fecha.nth(0).selectOption({ index: 5 });
  await fecha.nth(1).selectOption({ index: 3 });
  await fecha.nth(2).selectOption({ index: 10 });
  await p.fill('input[placeholder="Contraseña (mínimo 6 caracteres)"]', clave);
  await p.fill('input[placeholder="Confirmar contraseña"]', clave);
  if (await p.locator('input[placeholder="Nombre del contacto"]').count()) {
    await p.fill('input[placeholder="Nombre del contacto"]', 'Contacto Robot');
    await p.locator('input[placeholder="3001234567"]').nth(1).fill('301' + String(marca).slice(-7));
  }
  // Los términos NO son una casilla normal: es un cuadrito al lado del texto (ver APRENDIDO.md).
  await p.locator('div', { has: p.getByText('Términos y condiciones', { exact: true }) }).last().locator('> div').first().click();
  await p.getByRole('button', { name: /Crear cuenta/ }).last().click();
  await p.waitForTimeout(6000);
  await r.captura('cuenta-creada');
  const vamos = p.getByText(/¡Vamos!/);
  if (await vamos.count()) { await vamos.first().click(); await p.waitForTimeout(1500); }
  else fallos.push('no salió la bienvenida al crear la cuenta: ' + (await r.texto()).slice(0, 200));

  // ── Transporte → Soy conductor ──
  await p.getByText('Transporte y movilidad').click();
  await p.waitForTimeout(1500);
  await p.getByText('Soy conductor').click();
  await p.waitForTimeout(2000);

  // ── El formulario del conductor ──
  await p.locator('select').first().selectOption(TIPO);
  await p.fill('input[placeholder="Placa del vehículo (6 caracteres)"]', TIPO === 'Taxi' ? 'ROB123' : 'ROB12A');
  await p.getByText('Marca del vehículo').click();
  await p.getByText('Otra', { exact: true }).click();
  await p.fill('input[placeholder="Escribe la marca"]', 'Robotica');
  await p.locator('select').nth(1).selectOption({ index: 3 });
  // La lista de colores se abre tocando «Color» y se escoge tocando el NOMBRE (ver APRENDIDO.md).
  await p.getByText(/^Color/).first().click();
  await p.getByText('Azul', { exact: true }).click();
  await p.fill('input[placeholder="Documento de identidad"]', '11' + String(marca).slice(-8));
  const archivos = p.locator('input[type="file"]');
  const cuantos = await archivos.count();
  const etiquetas = await p.$$eval('label', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));
  console.log('CAMPOS DE FOTO (' + cuantos + '):', etiquetas.join(' | '));

  // 1. Con una foto de menos, se tiene que parar y decir cuál falta.
  for (let i = 0; i < cuantos - 1; i++) await archivos.nth(i).setInputFiles(fotoDeMentira('foto' + i));
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(1000);
  await r.captura('falta-una');
  const aviso = ((await r.texto()).match(/Falta subir la foto: [^✕]{0,60}?(?=Entendido|$)/) || [''])[0].trim();
  if (!aviso) fallos.push('con una foto de menos NO avisó qué falta');
  console.log('CON UNA DE MENOS:', aviso || '(no avisó)');
  const entendido = p.getByRole('button', { name: 'Entendido' });
  if (await entendido.count()) await entendido.click();

  // 2. Con todas, entra.
  await archivos.nth(cuantos - 1).setInputFiles(fotoDeMentira('foto-ultima'));
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(15000);
  await r.captura('registrado');
  const t = await r.texto();
  if (!/Bienvenido, conductor/.test(t)) fallos.push('con todas las fotos NO entró: ' + t.slice(0, 200));

  console.log('CONDUCTOR:', nombre, '·', correo);
  console.log('CAPTURAS:', r.carpeta);
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el registro del conductor funciona');
  await r.cerrar();
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
