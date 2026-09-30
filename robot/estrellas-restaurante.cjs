#!/usr/bin/env node
// 🤖 EL CLIENTE Y EL RESTAURANTE VEN LAS MISMAS ESTRELLAS — gemelo G83, 29-sep-2026.
// El promedio de estrellas del restaurante se enseña en tres sitios, y desde G83 los tres salen de la pieza
// estrellasNegocio.js (copia idéntica en la app y en aliados):
//   1. el pasajero de prueba entra a «Restaurantes»: la tarjeta de «Restaurante de Prueba» dice «⭐ x (n)» o nada;
//   2. entra a su menú: la barra de arriba dice «⭐ x (n)» o «Aún sin calificaciones»;
//   3. el restaurante de prueba entra a aliados → ☰ → «Calificaciones»: el número grande y «n calificaciones», o
//      «Aún no tienes calificaciones».
// Los tres tienen que decir lo MISMO. Solo mira: no califica ni reporta nada.
//   node robot/estrellas-restaurante.cjs
const { abrir, claveDePruebas, entrarComoRestaurante } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';
const NOMBRE = 'Restaurante de Prueba';
const SIN = 'sin calificaciones';

async function entrar(p) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', CORREO);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
}

(async () => {
  const fallos = [];
  let enLista = null; let enMenu = null; let enAliados = null;
  const r = await abrir('transporte', { nombre: 'estrellas-restaurante-cliente' });
  const p = r.pagina;
  try {
    await entrar(p);
    await p.getByText('Restaurantes', { exact: true }).first().click();
    await p.waitForTimeout(6000);
    await r.captura('lista');
    // La tarjeta del restaurante: desde el nombre, subir hasta el contenedor que lleve el nombre y ver si trae «⭐ x (n)».
    enLista = await p.evaluate((nombre) => {
      const nodo = [...document.querySelectorAll('p, span')].find((x) => x.textContent.trim() === nombre);
      if (!nodo) return null;
      let caja = nodo;
      for (let i = 0; i < 4 && caja.parentElement; i += 1) caja = caja.parentElement;
      const m = caja.textContent.match(/⭐\s*(\d+\.\d)\s*\((\d+)\)/);
      return m ? m[1] + ' (' + m[2] + ')' : 'sin calificaciones';
    }, NOMBRE);
    if (enLista === null) fallos.push('no encontré la tarjeta de «' + NOMBRE + '» en la lista');
    else {
      await p.getByText(NOMBRE, { exact: true }).first().click();
      await p.waitForTimeout(5000);
      await r.captura('menu');
      const t = await r.texto();
      const m = t.match(/⭐\s*(\d+\.\d)\s*\((\d+)\)/);
      enMenu = m ? m[1] + ' (' + m[2] + ')' : (/Aún sin calificaciones/.test(t) ? SIN : null);
      if (enMenu === null) fallos.push('el menú no enseña ni «⭐ x (n)» ni «Aún sin calificaciones»');
    }
  } finally { await r.cerrar(); }

  const a = await abrir('aliados', { nombre: 'estrellas-restaurante-aliados' });
  const pa = a.pagina;
  try {
    await entrarComoRestaurante(pa);
    if (!(await pa.getByText('Calificaciones', { exact: true }).first().isVisible().catch(() => false))) {
      await pa.getByText(/Menú|☰/).first().click();
      await pa.waitForTimeout(800);
    }
    const hay = await pa.getByText('Calificaciones', { exact: true }).first().isVisible().catch(() => false);
    if (!hay) fallos.push('aliados no ofrece «Calificaciones» en el menú (¿el módulo está apagado para el restaurante de prueba?)');
    else {
      await pa.getByText('Calificaciones', { exact: true }).first().click();
      await pa.waitForTimeout(5000);
      await a.captura('calificaciones');
      const t = await a.texto();
      const m = t.match(/(\d+\.\d)\s*⭐*\s*(\d+) calificaci/);
      enAliados = m ? m[1] + ' (' + m[2] + ')' : (/Aún no tienes calificaciones/.test(t) ? SIN : null);
      if (enAliados === '0.0 (0)') enAliados = SIN; // todas reportadas: aliados enseña 0.0, el cliente «sin»
      if (enAliados === null) fallos.push('aliados no enseña ni el promedio ni «Aún no tienes calificaciones»');
    }
  } finally { await a.cerrar(); }

  console.log('LISTA DEL CLIENTE: ' + enLista + ' · MENÚ DEL CLIENTE: ' + enMenu + ' · ALIADOS: ' + enAliados);
  console.log('CAPTURAS:', r.carpeta, a.carpeta);
  console.log('ERRORES DE LA PÁGINA:', [...r.errores, ...a.errores].join(' || ') || 'ninguno');
  if (enLista && enMenu && enAliados && !(enLista === enMenu && enMenu === enAliados)) {
    fallos.push('el cliente y el restaurante ven números distintos: lista ' + enLista + ', menú ' + enMenu + ', aliados ' + enAliados);
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el cliente (lista y menú) y el restaurante (aliados) ven lo mismo: ' + enLista);
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
