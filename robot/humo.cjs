#!/usr/bin/env node
// 🤖 HUMO — lo mínimo en cada cambio: las tres apps de PRUEBAS abren, enseñan su cartel naranja de
// pruebas y la página no se rompe. Si esto sale 🔴, lo demás no importa.
//   node robot/humo.cjs
const { abrir, SITIOS } = require('./comun.cjs');

(async () => {
  const fallos = [];
  for (const sitio of Object.keys(SITIOS)) {
    const r = await abrir(sitio, { nombre: 'humo-' + sitio, ancho: sitio === 'panel' ? 1200 : 400 });
    await r.pagina.waitForTimeout(2500);
    const t = await r.texto();
    await r.captura(sitio);
    const rotas = r.errores.filter((e) => /ROMPIÓ|intentó salir/.test(e));
    const ok = /PRUEBAS · datos de mentira/.test(t) && !rotas.length;
    if (!/PRUEBAS · datos de mentira/.test(t)) fallos.push(sitio + ': no sale el cartel de PRUEBAS');
    for (const e of rotas) fallos.push(sitio + ': ' + e);
    console.log((ok ? '✓ ' : '🔴 ') + sitio.padEnd(11) + (r.errores.length ? '· avisos de la consola: ' + r.errores.length : '· sin errores') + ' · ' + r.carpeta);
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ las tres apps de pruebas abren bien');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
