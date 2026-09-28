#!/usr/bin/env node
// 🤖 LA UBICACIÓN DEL MENSAJE DE EMERGENCIA ES LA DE AHORA — gemelo G05 (27-sep-2026).
// Entra como el pasajero de prueba (pasajero@gg.test) → ☰ Menú → 🛡️ Seguridad y toca «Compartir ubicación, ruta e
// identidad del conductor», dos veces, cada una con un GPS de mentira distinto:
//   1. El GPS contesta con un punto de ESTA vuelta: el enlace de WhatsApp tiene que llevar ESE punto como
//      «Mi ubicación». (Antes se mandaba la que se pidió al ABRIR la pantalla.)
//   2. El GPS no contesta nunca: el mensaje NO puede quedarse esperando. Tiene que salir en menos de 5,5 s (el tope es
//      de 4 s) diciendo que no pudo conseguir la ubicación, y sin enlace de mapa inventado.
//   Y en las dos, un SEGUNDO toque tiene que volver a mandar el mensaje: el botón no se puede quedar trabado.
// WhatsApp no se abre de verdad: `window.open` se cambia antes de cargar para anotar el enlace y la hora.
// Si el pasajero de prueba no tiene contacto de confianza, se le guarda uno de mentira (3000000099) en PRUEBAS.
//   node robot/ubicacion-emergencia.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';
// Un punto de Riohacha que cambia en cada vuelta, para saber que el del mensaje es de ESTA vuelta.
const LAT = Number((11.52 + Math.random() / 100).toFixed(6));
const LNG = -72.8911;

// Va como TEXTO porque el motor no le pasa datos a lo que corre antes de cargar (ver APRENDIDO.md).
const antesDeCargar = (contesta) => '(' + ((lat, lng, sí) => {
  const geo = {
    getCurrentPosition: (ok) => { if (sí) setTimeout(() => ok({ coords: { latitude: lat, longitude: lng, accuracy: 10 }, timestamp: Date.now() }), 300); },
    watchPosition: () => 1,
    clearWatch: () => {},
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  window.__abiertos = [];
  window.open = (u) => { window.__abiertos.push({ u: String(u), t: Date.now() }); return {}; };
}) + ')(' + LAT + ',' + LNG + ',' + (contesta ? 'true' : 'false') + ');';

async function unaVuelta(nombre, contesta) {
  const r = await abrir('transporte', { nombre: 'ubicacion-emergencia-' + nombre, antesDeCargar: antesDeCargar(contesta) });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', CORREO);
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Menú').first().click();
    await p.waitForTimeout(800);
    await p.getByText('Seguridad', { exact: true }).first().click();
    await p.waitForTimeout(3000);

    // Sin contacto guardado no se puede compartir: se guarda uno de mentira, en la base de PRUEBAS.
    if (await p.getByText('Sin número').count()) {
      const editar = p.getByText('Editar');
      await editar.nth(0).click();
      await p.fill('input[placeholder="Nombre del contacto"]', 'Contacto del Robot');
      await editar.nth(1).click();
      await p.fill('input[placeholder="Ej: 3001234567"]', '3000000099');
      await p.getByRole('button', { name: 'Guardar contacto' }).click();
      await p.waitForTimeout(3000);
    }
    await r.captura('antes-de-tocar');

    // Toca y espera (hasta 10 s) a que se abra WhatsApp. Devuelve cuánto tardó y el enlace, o null.
    const tocarYEsperar = async (n) => {
      const boton = p.getByText('Compartir ubicación, ruta e identidad del conductor');
      if (!(await boton.count())) return null; // el botón ya no dice lo suyo: se quedó trabado en otra palabra
      const t0 = await p.evaluate(() => Date.now());
      await boton.click();
      let abierto = null;
      for (let i = 0; i < 20 && !abierto; i += 1) {
        await p.waitForTimeout(500);
        abierto = await p.evaluate((k) => window.__abiertos[k] || null, n);
      }
      return abierto ? { ms: abierto.t - t0, u: abierto.u } : null;
    };
    const primero = await tocarYEsperar(0);
    await r.captura('despues');
    const segundo = await tocarYEsperar(1);
    const mensaje = primero ? decodeURIComponent((/[?&]text=([^&]*)/.exec(primero.u) || [])[1] || '') : '';
    return {
      ms: primero ? primero.ms : null,
      mensaje,
      segundoToque: !!segundo,
      errores: r.errores,
      carpeta: r.carpeta,
    };
  } finally {
    await r.cerrar();
  }
}

(async () => {
  const fallos = [];

  const a = await unaVuelta('gps-contesta', true);
  const ubic = (/📍[^\n]*/.exec(a.mensaje) || [''])[0];
  console.log('GPS CONTESTA:', a.ms === null ? 'NO SE ABRIÓ WHATSAPP' : a.ms + ' ms', '·', ubic, '· capturas', a.carpeta);
  if (a.ms === null) fallos.push('con el GPS contestando, WhatsApp no se abrió');
  else {
    if (!ubic.includes('?q=' + LAT + ',' + LNG)) fallos.push('el mensaje no lleva el punto de AHORA (' + LAT + ',' + LNG + '): ' + ubic);
    if (!/Mi ubicación/.test(ubic)) fallos.push('el punto de ahora no sale como «Mi ubicación»');
  }

  const b = await unaVuelta('gps-mudo', false);
  const ubicB = (/📍[^\n]*/.exec(b.mensaje) || [''])[0];
  console.log('GPS MUDO:', b.ms === null ? 'NO SE ABRIÓ WHATSAPP' : b.ms + ' ms', '·', ubicB, '· capturas', b.carpeta);
  if (b.ms === null) fallos.push('con el GPS mudo, el mensaje de emergencia NO SALIÓ: se quedó esperando');
  else {
    if (b.ms > 5500) fallos.push('con el GPS mudo, el mensaje tardó ' + b.ms + ' ms en salir (el tope es de 4 s)');
    if (!/No pude obtener mi ubicación/.test(ubicB)) fallos.push('con el GPS mudo, el mensaje no dice que no pudo conseguir la ubicación: ' + ubicB);
    if (/maps\.google\.com/.test(ubicB)) fallos.push('con el GPS mudo, el mensaje lleva un enlace de mapa: ¿de dónde salió ese punto?');
  }
  for (const [cual, v] of [['con GPS', a], ['sin GPS', b]]) {
    if (!v.segundoToque) fallos.push(cual + ', un SEGUNDO toque ya no manda el mensaje: el botón se quedó trabado');
  }
  console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...b.errores].join(' || ') || 'ninguno');

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el mensaje de emergencia de Ajustes lleva la ubicación de ahora, y sin GPS sale a tiempo diciendo que no la tiene');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
