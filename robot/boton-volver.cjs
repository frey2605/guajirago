#!/usr/bin/env node
// 🤖 EL «‹ VOLVER» SE VE IGUAL Y VUELVE A SU SITIO EN CADA PANTALLA — gemelo G91 (30-sep-2026).
// Desde G91 el botón es UNA pieza (guajirago/src/BotonVolver.js): la pastilla gris con ‹, con los colores de la paleta.
// Entra en PRUEBAS como pasajero@gg.test y, como una persona, abre cada pantalla con «‹ Volver», mira el botón (que
// diga «‹ Volver», que sea la pastilla gris y que quepa en el celular) y lo TOCA: tiene que volver a donde volvía.
//   · del menú de módulos: Mi perfil, Mis viajes, Mis créditos, Ganancias, Seguridad, Promociones, Configuración
//     (y dentro, Términos y condiciones → vuelve a Configuración), Ayuda y soporte → vuelven a módulos;
//   · Transporte: «¿Cómo vas a usar GuajiraGo?» → vuelve a módulos; Soy pasajero → vuelve a escoger rol;
//   · Restaurantes: 📦 Mis pedidos → vuelve a la lista; la lista → vuelve a módulos;
//   · Turismo: 📋 Mis reservas → vuelve a la lista; la lista → vuelve a módulos.
// No escribe nada: solo mira y toca «Volver».
//   node robot/boton-volver.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const MODULOS = /Transporte y movilidad/;
const GRIS = 'rgba(0, 0, 0, 0.06)';

(async () => {
  const fallos = [];
  const vistos = [];
  const r = await abrir('transporte', { nombre: 'boton-volver' });
  const p = r.pagina;
  r.dialogos = [];
  p.on('dialog', async (d) => { r.dialogos.push(d.message()); await d.dismiss().catch(() => {}); });
  const espera = (ms) => p.waitForTimeout(ms);
  const texto = async () => (await r.texto()) || '';
  const hayMenu = async () => (await p.getByText('☰', { exact: false }).count()) > 0;

  // El botón «‹ Volver» de la pantalla: su texto, sus colores y dónde está.
  const elBoton = () => p.evaluate(() => {
    const b = [...document.querySelectorAll('div')].filter((d) => d.textContent.trim() === '‹ Volver' && d.children.length === 1 && d.children[0].tagName === 'SPAN');
    if (b.length !== 1) return { cuantos: b.length };
    const s = getComputedStyle(b[0]);
    const f = getComputedStyle(b[0].children[0]);
    const q = b[0].getBoundingClientRect();
    return { cuantos: 1, fondo: s.backgroundColor, color: s.color, padding: s.padding, flecha: f.fontSize, izq: Math.round(q.left), der: Math.round(q.right), alto: Math.round(q.height), ancho: window.innerWidth };
  });

  // Abre una pantalla, mira el botón, lo toca y comprueba a dónde volvió.
  async function probar(nombre, llegar, esLaPantalla, esDeVuelta) {
    await llegar();
    await espera(3500);
    const t = await texto();
    if (!(await esLaPantalla(t))) { fallos.push(nombre + ': no se abrió la pantalla'); await r.captura('no-abrio-' + nombre); return; }
    const b = await elBoton();
    await r.captura(nombre);
    if (b.cuantos !== 1) { fallos.push(nombre + ': hay ' + b.cuantos + ' botones «‹ Volver»'); return; }
    if (b.fondo !== GRIS) fallos.push(nombre + ': el botón no es la pastilla gris (' + b.fondo + ')');
    if (b.color !== 'rgb(26, 26, 30)') fallos.push(nombre + ': la letra no es la tinta de la paleta (' + b.color + ')');
    if (b.flecha !== '20px') fallos.push(nombre + ': el ‹ no es de 20px (' + b.flecha + ')');
    if (b.izq < 0 || b.der > b.ancho) fallos.push(nombre + ': el botón se sale de la pantalla (' + b.izq + '–' + b.der + ' de ' + b.ancho + ')');
    await p.getByText('‹ Volver').first().click();
    await espera(3000);
    const vuelta = await texto();
    const ok = await esDeVuelta(vuelta);
    if (!ok) { fallos.push(nombre + ': «‹ Volver» no volvió a donde debía'); await r.captura('no-volvio-' + nombre); }
    vistos.push(nombre + ' ' + (ok ? '✓' : '🔴') + ' (' + b.fondo + ', ‹ ' + b.flecha + ', padding ' + b.padding + ', x ' + b.izq + '–' + b.der + ')');
  }

  const delMenu = (opcion) => async () => {
    await p.getByText('Menú').first().click();
    await espera(800);
    await p.getByText(opcion, { exact: true }).first().click();
  };
  const tocar = (txt) => async () => { await p.getByText(txt, { exact: true }).first().click(); };
  const aModulos = async (t) => MODULOS.test(t) && (await hayMenu());

  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await espera(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await espera(8000);
    const entendido = p.getByRole('button', { name: 'Entendido' });
    if (await entendido.count()) { await entendido.first().click(); await espera(500); }
    if (!MODULOS.test(await texto())) throw new Error('no llegó al menú de módulos');

    // Del menú de módulos.
    await probar('mi-perfil', delMenu('Mi perfil'), async (t) => /Mi perfil/.test(t) && !(await hayMenu()), aModulos);
    await probar('mis-viajes', delMenu('Mis viajes'), async (t) => /Mis viajes/.test(t) && !(await hayMenu()), aModulos);
    await probar('mis-creditos', delMenu('Mis créditos'), async (t) => /SALDO DISPONIBLE/.test(t), aModulos);
    await probar('ganancias', delMenu('Ganancias'), async (t) => /ESTA SEMANA/.test(t), aModulos);
    await probar('seguridad', delMenu('Seguridad'), async (t) => /Seguridad/.test(t) && !(await hayMenu()), aModulos);
    await probar('promociones', delMenu('Promociones'), async (t) => /Promociones/.test(t) && !(await hayMenu()), aModulos);
    await probar('ayuda', delMenu('Ayuda y soporte'), async (t) => /Ayuda y soporte/.test(t) && !(await hayMenu()), aModulos);
    await delMenu('Configuración')();
    await espera(3000);
    await probar('terminos', tocar('Términos y condiciones'), async (t) => /Última actualización/.test(t), async (t) => /Configuración/.test(t) && /Términos y condiciones/.test(t));
    await probar('configuracion', async () => {}, async (t) => /Configuración/.test(t), aModulos);

    // Transporte.
    await probar('escoger-rol', tocar('Transporte y movilidad'), async (t) => /BIENVENIDO/.test(t) && /Soy pasajero/.test(t), aModulos);
    await tocar('Transporte y movilidad')();
    await espera(3000);
    await probar('pasajero', tocar('Soy pasajero'), async (t) => /UBICACIÓN/.test(t), async (t) => /BIENVENIDO/.test(t) && /Soy pasajero/.test(t));
    await p.getByText('‹ Volver').first().click();
    await espera(3000);

    // Restaurantes.
    await tocar('Restaurantes')();
    await espera(4000);
    await probar('mis-pedidos', tocar('📦 Mis pedidos'), async () => !(await hayMenu()), async (t) => /📦 Mis pedidos/.test(t) && (await hayMenu()));
    await probar('restaurantes', async () => {}, async (t) => /📦 Mis pedidos/.test(t) && (await hayMenu()), aModulos);

    // Turismo.
    await tocar('Turismo')();
    await espera(4000);
    await probar('mis-reservas', tocar('📋 Mis reservas'), async () => !(await hayMenu()), async (t) => /📋 Mis reservas/.test(t) && (await hayMenu()));
    await probar('turismo', async () => {}, async (t) => /📋 Mis reservas/.test(t) && (await hayMenu()), aModulos);
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
  if (vistos.length < 5) fallos.push('solo se probaron ' + vistos.length + ' pantallas (mínimo 5)');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ en las ' + vistos.length + ' pantallas el «‹ Volver» es la misma pastilla gris, cabe en el celular y vuelve a su sitio');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
