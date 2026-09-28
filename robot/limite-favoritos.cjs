#!/usr/bin/env node
// 🤖 EL TOPE DE LUGARES FAVORITOS — gemelo G35 (28-sep-2026).
// Hasta el G35 la app dejaba guardar los favoritos que dijera el panel (config/global.maximoFavoritos; producción: 2)
// pero la ventanita «Llegaste al límite» decía siempre «Solo puedes guardar 3 lugares» y la Ayuda «hasta 3 lugares
// favoritos». Este recorrido, en PRUEBAS:
//   1. como superadmin de prueba (admin@gg.test) pone config/global.maximoFavoritos = 2 (guarda el de antes);
//   2. al pasajero de prueba le deja 2 favoritos de mentira (guarda los suyos);
//   3. el pasajero abre «Ayuda y soporte», busca los favoritos y exige «hasta 2 lugares favoritos»;
//   4. pide Taxi, escribe un destino y toca ➕: exige la ventanita «Solo puedes guardar 2 lugares» y que NO se haya
//      guardado un tercero.
// Al final config/global y los favoritos del pasajero quedan como estaban.
//   node robot/limite-favoritos.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const TOPE = 2; // distinto del respaldo de configApp.js (3) a propósito: si sale 3, la pantalla no leyó el panel
const LAT = 11.5444;
const LNG = -72.9072;

const antesDeCargar = '(' + ((lat, lng) => {
  const pos = () => ({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition: (ok) => setTimeout(() => ok(pos()), 200),
    watchPosition: (ok) => { setTimeout(() => ok(pos()), 200); return 1; },
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
}) + ')(' + LAT + ',' + LNG + ');';

(async () => {
  const fallos = [];
  const adm = await entrarALaBase('admin@gg.test');
  const pas = await entrarALaBase('pasajero@gg.test');
  const config = await adm.leer('config/global');
  const topeAntes = config.maximoFavoritos;
  const rutaUsuario = 'usuarios/' + pas.uid;
  const usuario = await pas.leer(rutaUsuario);
  const favoritosAntes = Array.isArray(usuario.favoritos) ? usuario.favoritos : [];
  const deMentira = [
    { nombre: 'Robot G35 casa', direccion: 'Robot G35 casa', icono: '⭐' },
    { nombre: 'Robot G35 trabajo', direccion: 'Robot G35 trabajo', icono: '⭐' },
  ];
  let r = null;
  try {
    await adm.cambiar('config/global', { maximoFavoritos: TOPE });
    await pas.cambiar(rutaUsuario, { favoritos: deMentira });
    console.log('config/global.maximoFavoritos en PRUEBAS:', topeAntes, '→', TOPE, '· favoritos del pasajero:', favoritosAntes.length, '→', deMentira.length);

    r = await abrir('transporte', { nombre: 'limite-favoritos', antesDeCargar });
    const p = r.pagina;
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);

    // ── 3: Ayuda y soporte ──
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Ayuda y soporte').first().click();
    await p.waitForTimeout(3000);
    await p.fill('input[placeholder="Busca tu pregunta..."]', 'favorit');
    await p.waitForTimeout(500);
    await p.getByText('¿Puedo guardar mis direcciones favoritas?').first().click();
    await p.waitForTimeout(800);
    await r.captura('ayuda-favoritos');
    const tAyuda = await r.texto();
    const mAyuda = /guardar hasta ([^.]*?) favoritos/.exec(tAyuda);
    console.log('LA AYUDA DICE:', mAyuda ? '«hasta ' + mAyuda[1] + ' favoritos»' : '(no se ve la respuesta)');
    if (!mAyuda || mAyuda[1] !== TOPE + ' lugares') fallos.push('la Ayuda no dice «hasta ' + TOPE + ' lugares favoritos»: ' + (mAyuda ? mAyuda[0] : 'no se ve'));
    await p.getByText('Volver').first().click();
    await p.waitForTimeout(1500);

    // ── 4: pedir Taxi y tocar ➕ con el tope lleno ──
    for (const paso of ['Transporte y movilidad', 'Soy pasajero']) {
      const x = p.getByText(paso, { exact: true });
      if (await x.count()) { await x.first().click(); await p.waitForTimeout(2500); }
    }
    await p.getByText('Taxi', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.fill('input[placeholder="¿A dónde vas? (Riohacha)"]', 'Terminal de transportes robot G35');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(1500);
    await p.getByText('➕', { exact: true }).first().click();
    await p.waitForTimeout(1500);
    await r.captura('ventanita-limite');
    const tLimite = await r.texto();
    const mLimite = /Solo puedes guardar ([^.]*?)\./.exec(tLimite);
    console.log('LA VENTANITA DICE:', /Llegaste al límite/.test(tLimite) ? '«' + (mLimite ? mLimite[0] : '?') + '»' : '(no salió la ventanita)');
    if (!/Llegaste al límite/.test(tLimite)) fallos.push('con ' + TOPE + ' favoritos y el tope en ' + TOPE + ', ➕ no abrió «Llegaste al límite»');
    else if (!mLimite || mLimite[1] !== TOPE + ' lugares') fallos.push('la ventanita no dice «Solo puedes guardar ' + TOPE + ' lugares»: ' + (mLimite ? mLimite[0] : 'no se ve'));

    const despues = await pas.leer(rutaUsuario);
    const cuantos = Array.isArray(despues.favoritos) ? despues.favoritos.length : 0;
    console.log('FAVORITOS EN LA BASE DESPUÉS DE ➕:', cuantos);
    if (cuantos !== TOPE) fallos.push('en la base quedaron ' + cuantos + ' favoritos, y el tope es ' + TOPE);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    console.log('CAPTURAS:', r.carpeta);
  } finally {
    if (r) await r.cerrar();
    await pas.cambiar(rutaUsuario, { favoritos: favoritosAntes })
      .catch((e) => console.log('⚠ no pude devolver los favoritos del pasajero:', e.message));
    await adm.cambiar('config/global', { maximoFavoritos: topeAntes ?? 3 })
      .catch((e) => console.log('⚠ no pude devolver config/global.maximoFavoritos:', e.message));
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ con el tope del panel en ' + TOPE + ', la Ayuda y la ventanita «Llegaste al límite» dicen ' + TOPE + ' lugares, y no se guarda un tercero');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
