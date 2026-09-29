#!/usr/bin/env node
// 🤖 LA FOTO DEL PASAJERO SALE EN EL PANEL — gemelo G43 (28-sep-2026).
// La foto de perfil se guarda en la ficha como `fotoConductor` (también la del pasajero: la escribe «Mi perfil»), y
// hasta G43 la ficha de 🙋 Pasajeros del panel buscaba `foto`, un campo que nadie escribe: la foto del pasajero no
// salía nunca, siempre el muñeco 🙋. Ahora las dos apps la leen con `fotoDe` (fotoUsuario.js).
// Este recorrido pone en la ficha de PRUEBAS de pasajero@gg.test una `fotoConductor` (una imagen pequeña escrita en
// la propia dirección, así no depende del almacén), entra al panel como admin@gg.test, abre 🙋 Pasajeros → Buscar
// por correo → su ficha, y exige que se vea ESA imagen, cargada. Al final deja el campo como estaba (si no había,
// queda en null, que para fotoDe es «sin foto»). Solo toca la base de PRUEBAS.
//   node robot/foto-pasajero-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

// Un cuadrito naranja de 8x8 en SVG: se reconoce en la captura y no pide red.
const FOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#FF7A2F"/></svg>');

(async () => {
  const fallos = [];
  const base = await entrarALaBase('pasajero@gg.test');
  const ruta = 'usuarios/' + base.uid;
  const antes = await base.leer(ruta);
  const habia = Object.prototype.hasOwnProperty.call(antes, 'fotoConductor') ? antes.fotoConductor : null;
  await base.cambiar(ruta, { fotoConductor: FOTO });
  console.log('FICHA DE PRUEBAS pasajero@gg.test: fotoConductor puesta (' + (habia ? 'tenía otra' : 'no tenía') + ')');

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'foto-pasajero-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Pasajeros es el 🙋.
    await p.locator('button, div').filter({ hasText: /^🙋$/ }).last().click();
    await p.waitForTimeout(5000);
    await p.getByText('Buscar', { exact: true }).first().click();
    await p.locator('input[placeholder="Correo electrónico"]').first().fill('pasajero@gg.test');
    await p.getByText('🔍 Buscar', { exact: true }).first().click();
    await p.waitForTimeout(1500);
    await p.locator('div').filter({ hasText: 'pasajero@gg.test' }).last().click();
    await p.waitForTimeout(2000);
    await r.captura('ficha-pasajero');
    const imagenes = await p.$$eval('img', (xs) => xs.map((x) => ({ src: x.getAttribute('src') || '', cargo: x.complete && x.naturalWidth > 0 })));
    const la = imagenes.find((x) => x.src === FOTO);
    console.log('LA FOTO GUARDADA EN LA FICHA DEL PANEL:', la ? (la.cargo ? 'sale y cargó' : 'sale pero no cargó') : 'NO SALE');
    if (!la) fallos.push('la ficha del pasajero en el panel no enseña la foto guardada en fotoConductor (sale el muñeco 🙋)');
    else if (!la.cargo) fallos.push('la foto sale en la ficha pero no cargó');
  } finally {
    await base.cambiar(ruta, { fotoConductor: habia });
    console.log('FICHA DE PRUEBAS devuelta: fotoConductor = ' + (habia ? '(la que tenía)' : 'null'));
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la foto del pasajero (fotoConductor) sale en su ficha del panel');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
