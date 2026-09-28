#!/usr/bin/env node
// 🤖 LAS ETAPAS DEL DOMICILIO QUE VE EL NEGOCIO — gemelo G33 (28-sep-2026).
// Entra a aliados de PRUEBAS como el restaurante de prueba (restaurante@gg.test) → ☰ → Configuración → «Flujos de
// pedido», y lee el recuadro «🏍️ Pedidos a domicilio». Desde G33 esas etapas (cuáles, en qué orden y cuáles van
// «(siempre)») salen de flujoPedidos.js y no de una lista propia de la pantalla. Tiene que enseñar las 6 de siempre,
// en su orden, con «(siempre)» solo en «Recepcionista recibe» y «Cajero cierra». NO toca «Guardar»: no cambia nada.
//   node robot/flujos-pedido.cjs
const { abrir, entrarComoRestaurante } = require('./comun.cjs');

const ESPERADAS = ['Recepcionista recibe', 'Cocina', 'Empacado', 'Despacho', 'Domiciliario entrega', 'Cajero cierra'];
const FIJAS = ['Recepcionista recibe', 'Cajero cierra'];

(async () => {
  const fallos = [];
  const r = await abrir('aliados', { nombre: 'flujos-pedido' });
  const p = r.pagina;
  let etapas = null;
  try {
    await entrarComoRestaurante(p);
    await r.captura('adentro');
    if (!(await p.getByText('Configuración', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Configuración', { exact: true }).first().click();
    await p.waitForTimeout(2500);
    await p.getByText('Flujos de pedido', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    await r.captura('flujos');
    // Las filas del recuadro de domicilio: el título de cada una es el <p> en negrilla, y «(siempre)» va dentro.
    etapas = await p.evaluate(() => {
      const titulo = [...document.querySelectorAll('p')].find((x) => x.textContent.includes('Pedidos a domicilio'));
      if (!titulo) return null;
      const caja = titulo.parentElement;
      return [...caja.children].slice(2).map((fila) => {
        const t = fila.querySelector('p');
        if (!t) return null;
        const siempre = t.textContent.includes('(siempre)');
        return { nombre: t.textContent.replace('(siempre)', '').trim(), siempre };
      }).filter(Boolean);
    });
  } finally {
    await r.cerrar();
  }

  console.log('ETAPAS DE DOMICILIO QUE VE EL NEGOCIO:', etapas ? etapas.map((e) => e.nombre + (e.siempre ? ' (siempre)' : '')).join(' → ') : 'no las encontré', '· capturas', r.carpeta);
  if (!etapas) fallos.push('no encontré el recuadro «Pedidos a domicilio» en «Flujos de pedido»');
  else {
    const nombres = etapas.map((e) => e.nombre);
    if (JSON.stringify(nombres) !== JSON.stringify(ESPERADAS)) fallos.push('las etapas son «' + nombres.join(', ') + '» y se esperaban «' + ESPERADAS.join(', ') + '»');
    const fijas = etapas.filter((e) => e.siempre).map((e) => e.nombre);
    if (JSON.stringify(fijas) !== JSON.stringify(FIJAS)) fallos.push('van «(siempre)»: «' + fijas.join(', ') + '»; debían ser «' + FIJAS.join(', ') + '»');
  }
  console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el negocio ve sus 6 etapas de domicilio en orden, con las fijas de flujoPedidos.js');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
