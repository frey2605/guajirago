#!/usr/bin/env node
// 🤖 ALIADOS SIN SEÑAL — comprueba que aliados AVISA cuando el aparato no podrá trabajar sin internet.
//   1. En un navegador normal, NO sale ningún aviso, ni antes ni después de entrar.
//   2. En un navegador que NO deja guardar datos en el aparato (se simula quitándole el almacén
//      local antes de que cargue la app, como pasa en algunos modos privados), SÍ sale la ventanita
//      «Sin internet, este aparato no podrá trabajar». Hasta el 27-sep-2026 aliados se callaba.
// 🪤 El aviso sale al ENTRAR, no en la portada: Firebase solo prueba el almacén la primera vez que
// usa la base, y cuando no puede NO falla — cae a memoria y lo dice en su registro.
// 🪤 Se intentó primero con DOS pestañas y no sirve: la segunda no falla, trabaja sin almacén local
// y no se queja (ver robot/APRENDIDO.md).
//   node robot/sin-senal-aliados.cjs
const { abrir, entrarComoRestaurante } = require('./comun.cjs');

const AVISO = /Sin internet, este aparato no podrá trabajar[^✕]{0,220}?Entendido/;

(async () => {
  const fallos = [];

  const normal = await abrir('aliados', { nombre: 'sin-senal-normal' });
  await entrarComoRestaurante(normal.pagina);
  const avisoNormal = AVISO.test(await normal.texto());
  if (avisoNormal) fallos.push('en un navegador normal avisa sin motivo');
  console.log('NAVEGADOR NORMAL:', avisoNormal ? 'avisó (mal)' : 'sin aviso (bien)');
  await normal.cerrar();

  const sinAlmacen = await abrir('aliados', {
    nombre: 'sin-senal-sin-almacen',
    antesDeCargar: () => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); },
  });
  await entrarComoRestaurante(sinAlmacen.pagina);
  await sinAlmacen.pagina.waitForTimeout(3000);
  await sinAlmacen.captura('sin-almacen');
  const aviso = ((await sinAlmacen.texto()).match(AVISO) || [''])[0];
  console.log('NAVEGADOR QUE NO DEJA GUARDAR:', aviso || '(no avisó nada)');
  if (!aviso) fallos.push('en un navegador que no deja guardar datos en el aparato, aliados NO avisa');
  console.log('CAPTURAS:', sinAlmacen.carpeta);
  await sinAlmacen.cerrar();

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ aliados avisa cuando no podrá trabajar sin señal, y solo entonces');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
