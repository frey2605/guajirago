#!/usr/bin/env node
// 🤖 SUBIR UNA FOTO EN LAS TRES APPS — gemelo G82 (29-sep-2026).
// Las tres apps suben sus fotos con UNA pieza, subirAlAlmacen (copia idéntica en cada repo). Este recorrido sube una
// foto DE VERDAD en cada app de pruebas y le pregunta al almacén con qué tipo quedó:
//   1. transporte · el pasajero de prueba (pasajero@gg.test) → ☰ Menú → Mi perfil → escoge una foto SIN tipo (el
//      teléfono no dice qué es) → «Guardar cambios». La ficha tiene que quedar con la dirección de la foto, la foto
//      tiene que abrir, y el almacén la tiene que servir como image/jpeg (antes de G82: application/octet-stream).
//      Al final se le devuelven a la ficha la foto, el nombre y el teléfono de antes.
//   2. panel · el superadmin (admin@gg.test) → 👑 → Anuncios masivos → «📤 Subir imagen» con una PNG. Tiene que salir
//      la vista previa con la dirección del almacén (carpeta anuncios/), y abrir como image/png. El anuncio NO se
//      publica: la imagen queda subida y sin usar. (Hoy el almacén la rechaza con un 403 por un permiso que le falta
//      al proyecto, no por G82: ver la trampa en panel() y en robot/APRENDIDO.md.)
//   3. aliados · el dueño del restaurante de prueba → Configuración → Datos del restaurante → «📤 Subir foto o logo»
//      (si ya tiene logo, antes toca «✕ Quitar», que solo lo quita de la pantalla) con una foto SIN tipo. Tiene que salir
//      la vista previa con la dirección del almacén (restaurantes/<id>/logo_…) y abrir como image/jpeg. No se toca
//      «Guardar»: el negocio sigue con su logo de antes. Y lo mismo con la agencia de turismo (agencia@gg.test →
//      Datos de la agencia, PerfilAgencia.js).
// El recorrido registrar-conductor sube de verdad las 7 fotos del conductor (cédula, licencia…, App.js).
//   node robot/subir-foto.cjs [transporte|panel|aliados|agencia]
const { abrir, claveDePruebas, entrarALaBase, entrarComoRestaurante, fotoDeMentira } = require('./comun.cjs');

// Una foto SIN tipo: la misma imagen de mentira, con un nombre sin extensión y sin decir de qué tipo es.
const sinTipo = () => ({ ...fotoDeMentira('x'), name: 'foto-sin-tipo', mimeType: '' });

// Pide la foto por su dirección y dice si abre y con qué tipo la sirve el almacén.
async function comoLaSirve(url) {
  const r = await fetch(url);
  return { ok: r.ok, tipo: r.headers.get('content-type'), bytes: (await r.arrayBuffer()).byteLength };
}

// Espera (con tope) la vista previa: un <img> cuya dirección sea del almacén y lleve `trozo`.
async function esperarVista(p, trozo) {
  for (let i = 0; i < 30; i++) {
    const src = await p.evaluate((t) => {
      const img = [...document.querySelectorAll('img')].find((x) => /firebasestorage/.test(x.src) && x.src.includes(t));
      return img ? img.src : null;
    }, trozo);
    if (src) return src;
    await p.waitForTimeout(1000);
  }
  return null;
}

async function transporte(fallos) {
  const base = await entrarALaBase('pasajero@gg.test');
  const ruta = 'usuarios/' + base.uid;
  const antes = await base.leer(ruta);
  const r = await abrir('transporte', { nombre: 'subir-foto-transporte' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Mi perfil', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    await p.locator('input[type="file"]').first().setInputFiles(sinTipo());
    await p.waitForTimeout(800);
    await p.getByRole('button', { name: 'Guardar cambios' }).click();
    let listo = false;
    for (let i = 0; i < 30 && !listo; i++) { await p.waitForTimeout(1000); listo = /Perfil actualizado/.test(await r.texto()); }
    await r.captura('perfil-guardado');
    if (!listo) fallos.push('transporte: «Mi perfil» no dijo «¡Perfil actualizado!» en 30 s');
    const despues = await base.leer(ruta);
    const url = despues.fotoConductor;
    console.log('TRANSPORTE · foto en la ficha:', url ? url.split('?')[0].replace(/.*\/o\//, '') : '(ninguna)');
    if (!url || url === antes.fotoConductor || !/\/o\/usuarios%2F/.test(url)) fallos.push('transporte: la ficha no quedó con la dirección de la foto nueva (usuarios/<uid>/perfil_…)');
    else {
      const s = await comoLaSirve(url);
      console.log('TRANSPORTE · el almacén la sirve:', s);
      if (!s.ok || !s.bytes) fallos.push('transporte: la foto subida no abre');
      if (s.tipo !== 'image/jpeg') fallos.push('transporte: la foto sin tipo quedó como «' + s.tipo + '», no image/jpeg');
    }
    console.log('TRANSPORTE · errores de la página:', r.errores.join(' || ') || 'ninguno', '· capturas', r.carpeta);
  } finally {
    await r.cerrar();
    // La ficha como estaba: la foto (null si no tenía), el nombre y el teléfono.
    const devolver = { fotoConductor: antes.fotoConductor === undefined ? null : antes.fotoConductor };
    if (antes.nombre !== undefined) devolver.nombre = antes.nombre;
    if (antes.telefono !== undefined) devolver.telefono = antes.telefono;
    await base.cambiar(ruta, devolver);
    console.log('TRANSPORTE · (se le devolvió a la ficha la foto, el nombre y el teléfono de antes)');
  }
}

async function panel(fallos) {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'subir-foto-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    await p.locator('button, div').filter({ hasText: /^👑$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Anuncios masivos', { exact: true }).first().click();
    await p.waitForTimeout(3000);
    await p.locator('input[type="file"]').first().setInputFiles(fotoDeMentira('anuncio-robot'));
    const src = await esperarVista(p, 'anuncios%2Fanuncio_');
    await r.captura('anuncio-con-imagen');
    console.log('PANEL · vista previa:', src ? src.split('?')[0].replace(/.*\/o\//, '') : '(no sale)');
    if (!src) fallos.push('panel: la imagen del anuncio no salió en la vista previa (anuncios/anuncio_…)');
    else {
      const s = await comoLaSirve(src);
      console.log('PANEL · el almacén la sirve:', s);
      if (!s.ok || !s.bytes) fallos.push('panel: la imagen subida no abre');
      if (s.tipo !== 'image/png') fallos.push('panel: la PNG quedó como «' + s.tipo + '»');
    }
    // 🪤 (29-sep-2026) En pruebas —y en producción— el almacén contesta 403 a la imagen del anuncio: `esAdmin` de
    // storage.rules le pregunta a Firestore quién es admin, y ninguno de los dos proyectos le dio a las reglas el
    // permiso para leer Firestore (roles/firebaserules.firestoreServiceAgent). No es de G82: pasaba igual antes.
    if (/Error al subir/.test(await r.texto())) fallos.push('panel: dice «Error al subir la imagen» (si es un 403: falta el permiso roles/firebaserules.firestoreServiceAgent del proyecto, ver robot/APRENDIDO.md)');
    console.log('PANEL · errores de la página:', r.errores.join(' || ') || 'ninguno', '· capturas', r.carpeta);
  } finally {
    await r.cerrar();
  }
}

async function aliados(fallos, cuenta = 'restaurante') {
  // El restaurante (PerfilRestaurante.js) o la agencia de turismo (PerfilAgencia.js): el mismo cuadro del logo.
  const correo = cuenta + '@gg.test';
  const pantalla = cuenta === 'agencia' ? 'Datos de la agencia' : 'Datos del restaurante';
  const A = 'ALIADOS (' + cuenta + ')';
  const r = await abrir('aliados', { nombre: 'subir-foto-' + cuenta });
  const p = r.pagina;
  try {
    await entrarComoRestaurante(p, correo);
    const menu = p.getByText(/Menú|☰/).first();
    if (await menu.count()) { await menu.click(); await p.waitForTimeout(800); }
    await p.getByText('Configuración', { exact: true }).first().click();
    await p.waitForTimeout(1500);
    await p.getByText(pantalla, { exact: true }).first().click();
    await p.waitForTimeout(3000);
    const quitar = p.getByText('✕ Quitar', { exact: true }).first();
    if (await quitar.count()) { await quitar.click(); await p.waitForTimeout(500); }
    await p.locator('input[type="file"]').first().setInputFiles(sinTipo());
    const src = await esperarVista(p, '%2Flogo_');
    await r.captura('logo-subido');
    console.log(A + ' · vista previa:', src ? src.split('?')[0].replace(/.*\/o\//, '') : '(no sale)');
    if (!src || !/restaurantes%2F/.test(src)) fallos.push(A + ': el logo no salió en la vista previa (restaurantes/<id>/logo_…)');
    else {
      const s = await comoLaSirve(src);
      console.log(A + ' · el almacén lo sirve:', s);
      if (!s.ok || !s.bytes) fallos.push(A + ': el logo subido no abre');
      if (s.tipo !== 'image/jpeg') fallos.push(A + ': la foto sin tipo quedó como «' + s.tipo + '», no image/jpeg');
    }
    if (/No se pudo subir/.test(await r.texto())) fallos.push(A + ': dice «No se pudo subir la imagen»');
    console.log(A + ' · errores de la página:', r.errores.join(' || ') || 'ninguno', '· capturas', r.carpeta);
  } finally {
    await r.cerrar();
  }
}

(async () => {
  const fallos = [];
  // Sin argumento, las tres; con uno (transporte | panel | aliados | agencia), solo esa (así la usa robot/mapa.cjs).
  const cuales = process.argv.slice(2);
  for (const [nombre, fn] of [['transporte', transporte], ['panel', panel], ['aliados', aliados], ['agencia', (f) => aliados(f, 'agencia')]]) {
    if (cuales.length && !cuales.includes(nombre)) continue;
    try { await fn(fallos); } catch (e) { fallos.push(nombre + ': ' + e.message.split('\n')[0]); }
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ ' + (cuales.join(', ') || 'transporte, panel, aliados y agencia') + ': sube la foto, la foto abre, y la que no dice su tipo queda como image/jpeg');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
