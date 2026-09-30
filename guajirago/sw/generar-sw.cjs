#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// EL SERVICE WORKER DE AVISOS SALE DEL AMBIENTE (G31, 28-sep-2026).
//
// El service worker de avisos (firebase-messaging-sw.js) es el programa que recibe los avisos del
// celular con la app cerrada. Corre aparte de la app y NO lee `process.env`, así que hasta hoy vivía en
// public/ con la configuración de PRODUCCIÓN escrita a mano: el sitio de PRUEBAS servía un SW que decía
// `projectId: "guajirago"`. Ahora la configuración sale de UN solo sitio, el mismo que usa la app:
// el .env del ambiente leído por configFirebaseDe (src/ambiente.js).
//
// Cómo: la compilación de cada ambiente corre, DESPUÉS de `react-scripts build` y con el MISMO .env,
//   env-cmd -f .env.<ambiente> node sw/generar-sw.cjs
// que llena las marcas %campo% de sw/plantilla-firebase-messaging-sw.js y escribe
// build/firebase-messaging-sw.js. Si falta una llave, el ambiente no existe o el proyecto no es de ese
// ambiente, SE PARA (y con él la compilación), igual que la app.
//
// Este archivo y la plantilla viven igual en guajirago/sw y en guajirago-aliados/sw (dos repos: aliados
// no puede importar de aquí). Los ata byte a byte pruebas/serviceWorker.test.js; el medidor es
// scripts/medir-service-worker.cjs (repo raíz).
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const { ambienteDe, configFirebaseDe, verificarPareja } = require('../src/ambiente.js');

/**
 * EL ÍCONO DE LA APP (G93, 30-sep-2026): el PNG de 192x192 que declara public/manifest.json, con su ruta desde
 * la raíz del sitio. Es el que el celular pinta al instalar la app; los avisos llevan ESE, no uno escrito a mano
 * (hasta ese día la plantilla decía '/logo192.png', y en transporte ése era el logo viejo).
 */
function iconoDelManifest(manifest) {
  const t = typeof manifest === 'string' ? manifest : null;
  const m = t === null ? manifest : JSON.parse(t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t);
  const icono = ((m && m.icons) || []).find((i) => String(i.sizes || '').split(/\s+/).includes('192x192') && /\.png$/i.test(String(i.src || '')));
  if (!icono) throw new Error('El manifest no declara un ícono PNG de 192x192: los avisos no tendrían con qué pintarse.');
  const src = String(icono.src).replace(/^\.?\//, '');
  if (!/^[\w.-]+(\/[\w.-]+)*$/.test(src)) throw new Error('El ícono del manifest tiene una ruta rara: «' + icono.src + '».');
  return '/' + src;
}

/** El texto del SW para este `env`: cada %campo% de la plantilla se llena con configFirebaseDe(env), y %icono% con el del manifest. */
function generarServiceWorker(plantilla, env, manifest) {
  ambienteDe(env.REACT_APP_AMBIENTE);
  const cfg = configFirebaseDe(env);
  verificarPareja(env.REACT_APP_AMBIENTE, cfg.projectId);
  const valores = { ...cfg, icono: iconoDelManifest(manifest) };
  const usados = new Set();
  const texto = String(plantilla).replace(/%([A-Za-z]+)%/g, (_, campo) => {
    if (!Object.prototype.hasOwnProperty.call(valores, campo)) {
      throw new Error('La plantilla del service worker pide «' + campo + '», que no es un campo de la configuración de Firebase ni el ícono.');
    }
    usados.add(campo);
    return JSON.stringify(String(valores[campo])).slice(1, -1);
  });
  const sinUsar = Object.keys(valores).filter((c) => !usados.has(c));
  if (sinUsar.length) throw new Error('La plantilla del service worker no usa: ' + sinUsar.join(', '));
  return texto;
}

module.exports = { generarServiceWorker, iconoDelManifest };

if (require.main === module) {
  const app = path.join(__dirname, '..');
  const build = path.join(app, 'build');
  if (!fs.existsSync(build)) throw new Error('No hay carpeta build/: el service worker se genera DESPUÉS de react-scripts build.');
  const plantilla = fs.readFileSync(path.join(__dirname, 'plantilla-firebase-messaging-sw.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(app, 'public', 'manifest.json'), 'utf8');
  fs.writeFileSync(path.join(build, 'firebase-messaging-sw.js'), generarServiceWorker(plantilla, process.env, manifest));
  console.log('✓ service worker de avisos generado para ' + process.env.REACT_APP_AMBIENTE + ' (' + process.env.REACT_APP_FIREBASE_PROJECT_ID + ')');
}
