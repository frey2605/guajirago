#!/usr/bin/env node
// 🤖 ALIADOS SIN SEÑAL — abre aliados de pruebas en DOS pestañas del mismo navegador. La segunda
// no puede guardar los datos en el aparato (el navegador se lo da a una sola), así que tiene que
// salir la ventanita «Sin internet, este aparato no podrá trabajar» diciendo lo de la otra
// pestaña. Hasta el 27-sep-2026 aliados se callaba en ese caso.
//   node robot/sin-senal-aliados.cjs
const { abrir } = require('./comun.cjs');

(async () => {
  const r = await abrir('aliados', { nombre: 'sin-senal-aliados' });
  const fallos = [];
  await r.pagina.waitForTimeout(3000);
  const primera = await r.texto();
  if (/no podrá trabajar/.test(primera)) fallos.push('la PRIMERA pestaña avisa sin motivo: ' + primera.slice(0, 150));

  // La segunda pestaña, en el mismo navegador (misma dirección de pruebas, sale de SITIOS).
  const segunda = await r.otraPestana('aliados');
  await segunda.waitForTimeout(4000);
  await segunda.screenshot({ path: r.carpeta + '/02-segunda-pestana.png', fullPage: true });
  const t = (await segunda.innerText('body')).replace(/\s+/g, ' ');
  const aviso = (t.match(/Sin internet, este aparato no podrá trabajar[^✕]{0,200}?Entendido/) || [''])[0];
  console.log('SEGUNDA PESTAÑA:', aviso || '(no avisó nada)');
  if (!aviso) fallos.push('con aliados abierto en dos pestañas, la segunda NO avisa que no podrá trabajar sin internet');
  else if (!/otra pestaña/.test(aviso)) fallos.push('avisa, pero no dice lo de la otra pestaña: ' + aviso);

  console.log('CAPTURAS:', r.carpeta);
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ aliados avisa cuando no podrá trabajar sin señal');
  await r.cerrar();
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
