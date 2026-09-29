#!/usr/bin/env node
// 🤖 LA LLAVE DE MAPS (G62) — en transporte y aliados de PRUEBAS, Google Maps carga con la llave que dice
// el .env.pruebas de cada app (la que Create React App escribe en el index.html al compilar), Google no la
// rechaza (gm_authFailure, que es lo que Google llama cuando la llave o el dominio no valen) y un mapa se
// dibuja. No entra con ninguna cuenta ni escribe nada.
//   node robot/llave-maps.cjs
const fs = require('fs');
const path = require('path');
const { abrir } = require('./comun.cjs');
const { leerEnv } = require('../scripts/medir-ambientes.cjs');

const APPS = [['transporte', 'guajirago'], ['aliados', 'guajirago-aliados']];
// Se apunta si Google rechaza la llave: lo llama él, en cuanto intenta dibujar.
const antesDeCargar = '(' + (() => { window.__rechazoMaps = 0; window.gm_authFailure = () => { window.__rechazoMaps++; }; }).toString() + ')()';

(async () => {
  const fallos = [];
  for (const [sitio, carpeta] of APPS) {
    const esperada = leerEnv(fs.readFileSync(path.join(__dirname, '..', carpeta, '.env.pruebas'), 'utf8')).REACT_APP_GOOGLE_MAPS_KEY;
    const r = await abrir(sitio, { nombre: 'llave-maps-' + sitio, antesDeCargar });
    let cargo = false;
    for (let i = 0; i < 40 && !cargo; i++) {
      cargo = await r.pagina.evaluate(() => !!(window.google && window.google.maps && window.google.maps.places && window.google.maps.Map));
      if (!cargo) await r.pagina.waitForTimeout(500);
    }
    const src = await r.pagina.evaluate(() => (Array.from(document.scripts).find((s) => /maps\.googleapis\.com\/maps\/api\/js/.test(s.src)) || {}).src || '');
    let dibujo = false;
    if (cargo) {
      // Un mapa de verdad, fuera de la vista: es lo que hace que Google compruebe la llave y el dominio.
      await r.pagina.evaluate(() => {
        const d = document.createElement('div');
        d.id = 'mapa-robot';
        d.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;z-index:99999';
        document.body.appendChild(d);
        const m = new window.google.maps.Map(d, { center: { lat: 11.5444, lng: -72.9072 }, zoom: 14 });
        window.google.maps.event.addListenerOnce(m, 'tilesloaded', () => { window.__mapaDibujado = true; });
      });
      for (let i = 0; i < 30 && !dibujo; i++) {
        dibujo = await r.pagina.evaluate(() => !!window.__mapaDibujado);
        if (!dibujo) await r.pagina.waitForTimeout(500);
      }
    }
    await r.pagina.waitForTimeout(1500);
    const rechazos = await r.pagina.evaluate(() => window.__rechazoMaps || 0);
    const texto = await r.texto();
    await r.captura(sitio);
    const llave = (src.match(/[?&]key=([^&]*)/) || [])[1] || '';
    const f = [];
    if (!src) f.push('no hay <script> de Maps');
    if (/%/.test(llave)) f.push('la llave llegó SIN REEMPLAZAR («' + llave + '»)');
    else if (llave !== esperada) f.push('la llave servida no es la de .env.pruebas');
    if (!cargo) f.push('Google Maps no cargó');
    if (rechazos) f.push('Google rechazó la llave (gm_authFailure ×' + rechazos + ')');
    if (/no cargó bien Google Maps/i.test(texto)) f.push('sale «no cargó bien Google Maps»');
    if (cargo && !dibujo) f.push('el mapa no se dibujó');
    console.log((f.length ? '🔴 ' : '✓ ') + sitio.padEnd(11) + '· llave ' + (llave ? llave.slice(0, 10) + '…' + llave.slice(-4) : '—') +
      ' · Maps ' + (cargo ? 'cargó' : 'NO cargó') + ' · mapa ' + (dibujo ? 'dibujado' : 'sin dibujar') + ' · rechazos ' + rechazos + ' · ' + r.carpeta);
    for (const x of f) fallos.push(sitio + ': ' + x);
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ transporte y aliados de pruebas cargan Maps con la llave de su .env y Google la acepta');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
