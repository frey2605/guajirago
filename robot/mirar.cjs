#!/usr/bin/env node
// 🤖 MIRAR — abre una pantalla de pruebas y cuenta qué hay: campos, botones, texto y errores.
// Es lo primero que hace el robot ante una pantalla que no conoce.
//   node robot/mirar.cjs transporte|panel|aliados|<dirección de pruebas>
const { abrir, inventario } = require('./comun.cjs');

(async () => {
  const r = await abrir(process.argv[2] || 'transporte', { nombre: 'mirar' });
  await r.pagina.waitForTimeout(3000);
  const campos = await inventario(r.pagina);
  console.log('CAPTURA:', await r.captura('pantalla'));
  console.log('CAMPOS:', campos.join(' | '));
  console.log('TEXTO:', (await r.texto()).slice(0, 800));
  console.log('ERRORES:', r.errores.join(' || ') || 'ninguno');
  await r.cerrar();
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
