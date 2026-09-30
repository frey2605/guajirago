#!/usr/bin/env node
// 🤖 EL LOGO DE ARRIBA A LA DERECHA ES EL MISMO EN CADA PANTALLA — gemelo G92 (30-sep-2026).
// Desde G92 el logo de la esquina es UNA pieza (LogoEsquina de guajirago/src/Logo.js): el pin de GuajiraGo, arriba 14 y
// derecha 16, de 28 en el encabezado de las pantallas con «‹ Volver» y de 34 en las portadas con el ☰ Menú.
// Entra en PRUEBAS como pasajero@gg.test y, como una persona, abre cada pantalla y mira el logo: que haya UNO en la
// esquina, que sea el pin de GuajiraGo, de su tamaño, pegado arriba a la derecha y que quepa en el celular.
//   · del menú de módulos: Mi perfil, Mis viajes, Mis créditos, Ganancias, Seguridad, Promociones, Configuración y
//     Ayuda y soporte (28);
//   · Transporte → Soy pasajero (portada, 34);
//   · Restaurantes (28);
//   · Mensajería y Mandados (portada, 34) → Quiero enviar algo (la pantalla de pedir, 28).
// No escribe nada: solo mira y toca «Volver» (la pantalla de pedir se abre, no se pide nada).
//   node robot/logo-esquina.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const MODULOS = /Transporte y movilidad/;

(async () => {
  const fallos = [];
  const vistos = [];
  const r = await abrir('transporte', { nombre: 'logo-esquina' });
  const p = r.pagina;
  r.dialogos = [];
  p.on('dialog', async (d) => { r.dialogos.push(d.message()); await d.dismiss().catch(() => {}); });
  const espera = (ms) => p.waitForTimeout(ms);
  const texto = async () => (await r.texto()) || '';
  const hayMenu = async () => (await p.getByText('☰', { exact: false }).count()) > 0;

  // Los logos de esquina de la pantalla: el pin «GuajiraGo» puesto con position absolute, medido contra la caja que
  // lo posiciona (su primer antepasado que no es static).
  const losLogos = () => p.evaluate(() => [...document.querySelectorAll('svg[aria-label="GuajiraGo"]')]
    .filter((s) => getComputedStyle(s).position === 'absolute')
    .map((s) => {
      let c = s.parentElement;
      while (c && c !== document.body && getComputedStyle(c).position === 'static') c = c.parentElement;
      const q = s.getBoundingClientRect();
      const k = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return {
        ancho: Math.round(q.width), alto: Math.round(q.height), z: getComputedStyle(s).zIndex,
        arriba: Math.round(q.top - k.top - parseFloat(cs.borderTopWidth)),
        derecha: Math.round(k.right - parseFloat(cs.borderRightWidth) - q.right),
        der: Math.round(q.right), pantalla: window.innerWidth, trazos: s.querySelectorAll('path').length,
      };
    }));

  // Mira el logo de la pantalla abierta.
  async function mirar(nombre, tamano) {
    await espera(3500);
    const l = await losLogos();
    await r.captura(nombre);
    if (l.length !== 1) { fallos.push(nombre + ': hay ' + l.length + ' logos en la esquina'); vistos.push(nombre + ' 🔴'); return; }
    const x = l[0];
    const mal = [];
    if (x.ancho !== tamano || x.alto !== tamano) mal.push('mide ' + x.ancho + '×' + x.alto + ' y no ' + tamano);
    if (x.arriba !== 14) mal.push('está a ' + x.arriba + ' de arriba y no a 14');
    if (x.derecha !== 16) mal.push('está a ' + x.derecha + ' de la derecha y no a 16');
    if (x.z !== '6') mal.push('zIndex ' + x.z);
    if (x.trazos !== 1) mal.push('no es el pin de GuajiraGo');
    if (x.der > x.pantalla) mal.push('se sale de la pantalla');
    if (mal.length) fallos.push(nombre + ': ' + mal.join(', '));
    vistos.push(nombre + ' ' + (mal.length ? '🔴' : '✓') + ' (' + x.ancho + 'px, arriba ' + x.arriba + ', derecha ' + x.derecha + ', z ' + x.z + ')');
  }

  const delMenu = async (opcion) => {
    await p.getByText('Menú').first().click();
    await espera(800);
    await p.getByText(opcion, { exact: true }).first().click();
  };
  const tocar = async (txt) => { await p.getByText(txt, { exact: true }).first().click(); };
  const volver = async () => { await p.getByText('‹ Volver').first().click(); await espera(3000); };
  const enModulos = async () => MODULOS.test(await texto()) && (await hayMenu());

  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await espera(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await espera(8000);
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await espera(500); }
    if (!(await enModulos())) throw new Error('no llegó al menú de módulos');

    // Del menú de módulos: las ocho pantallas de encabezado.
    for (const [nombre, opcion] of [['mi-perfil', 'Mi perfil'], ['mis-viajes', 'Mis viajes'], ['mis-creditos', 'Mis créditos'],
      ['ganancias', 'Ganancias'], ['seguridad', 'Seguridad'], ['promociones', 'Promociones'], ['configuracion', 'Configuración'],
      ['ayuda', 'Ayuda y soporte']]) {
      await delMenu(opcion);
      await mirar(nombre, 28);
      await volver();
      if (!(await enModulos())) throw new Error('«‹ Volver» de ' + nombre + ' no volvió a módulos');
    }

    // Transporte → Soy pasajero: la portada.
    await tocar('Transporte y movilidad');
    await espera(3000);
    await tocar('Soy pasajero');
    await mirar('pasajero', 34);
    await volver();
    await volver();

    // Restaurantes.
    await tocar('Restaurantes');
    await mirar('restaurantes', 28);
    await volver();

    // Mensajería: la portada, y la pantalla de pedir (se abre, no se pide nada).
    await tocar('Mensajería y Mandados');
    await mirar('mensajeria', 34);
    await tocar('Quiero enviar algo');
    await mirar('pedir-mandado', 28);
  } catch (e) {
    fallos.push('el recorrido se cortó: ' + e.message.split('\n')[0]);
    await r.captura('cortado').catch(() => {});
  } finally {
    console.log('PANTALLAS (' + vistos.length + '):\n  · ' + vistos.join('\n  · '));
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    if (r.dialogos.length) console.log('VENTANAS DEL NAVEGADOR:', r.dialogos.join(' || '));
    await r.cerrar();
  }
  if (vistos.length < 5) fallos.push('solo se miraron ' + vistos.length + ' pantallas (mínimo 5)');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ en las ' + vistos.length + ' pantallas el logo de la esquina es el mismo pin, de su tamaño, arriba 14 y derecha 16');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
