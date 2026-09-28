#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MEDIR EL SERVICE WORKER DE AVISOS (G31, 28-sep-2026) — SOLO LECTURA.
//
// El «service worker» de avisos (firebase-messaging-sw.js) es el programa que recibe los avisos del
// celular con la app cerrada. No lee `process.env`: hasta el 28-sep-2026 llevaba escrita A MANO la
// configuración de PRODUCCIÓN, en transporte y en aliados, así que el sitio de PRUEBAS servía un SW que
// decía `projectId: "guajirago"`. Desde ese día el SW se GENERA al compilar (sw/generar-sw.cjs de cada
// app) desde el mismo .env que la app, con configFirebaseDe de src/ambiente.js.
//
// Mira dos cosas:
//   1 · LO SERVIDO: baja el SW de los cuatro sitios (transporte y aliados, pruebas y producción) y
//       compara sus seis valores con los del .env de ESE ambiente. El panel no tiene SW de avisos.
//   2 · EL REPO: que ningún SW de public/ ni la plantilla lleve la configuración escrita a mano; que
//       la compilación de cada ambiente corra el generador con el MISMO .env que la app; y que el
//       generador, EJECUTADO con cada .env, dé un SW con los valores de ese .env.
//
//   node scripts/medir-service-worker.cjs            (lo servido + el repo)
//   node scripts/medir-service-worker.cjs --sin-red  (solo el repo)
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const { leerEnv } = require('./medir-ambientes.cjs');

const RAIZ = path.resolve(__dirname, '..');
const APPS = ['guajirago', 'guajirago-aliados'];
const SITIOS = {
  guajirago: { pruebas: 'https://guajirago-pruebas.web.app', produccion: 'https://guajirago.web.app' },
  'guajirago-aliados': { pruebas: 'https://guajirago-pruebas-aliados.web.app', produccion: 'https://guajirago-aliados.web.app' },
};
const NOMBRE_SW = 'firebase-messaging-sw.js';

/** Los pares `campo: "valor"` que un SW le pasa a firebase.initializeApp({...}). */
function configDelSw(texto) {
  const m = String(texto).match(/initializeApp\(\s*\{([\s\S]*?)\}\s*\)/);
  if (!m) return null;
  const o = {};
  for (const x of m[1].matchAll(/([A-Za-z]+)\s*:\s*["'`]([^"'`]*)["'`]/g)) o[x[1]] = x[2];
  return o;
}

/** ¿Este SW lleva la configuración de ESTE .env? Devuelve el proyecto que dice y los campos distintos. */
function juzgarSw(texto, env, configFirebaseDe) {
  const esperado = configFirebaseDe(env);
  const tiene = configDelSw(texto);
  if (!tiene) return { proyecto: null, ok: false, distintos: Object.keys(esperado), porque: 'no llama a initializeApp({...})' };
  const distintos = Object.keys(esperado).filter((c) => tiene[c] !== esperado[c]);
  return { proyecto: tiene.projectId || null, ok: distintos.length === 0, distintos };
}

/** Los valores de configuración de los dos .env de una app (para cazarlos escritos a mano). */
function valoresDeLosEnv(dirApp) {
  const vals = new Set();
  for (const amb of ['pruebas', 'produccion']) {
    const r = path.join(dirApp, '.env.' + amb);
    if (!fs.existsSync(r)) continue;
    const e = leerEnv(fs.readFileSync(r, 'utf8'));
    for (const [k, v] of Object.entries(e)) if (/^REACT_APP_FIREBASE_(API_KEY|PROJECT_ID|MESSAGING_SENDER_ID|APP_ID|AUTH_DOMAIN|STORAGE_BUCKET)$/.test(k)) vals.add(v);
  }
  return [...vals];
}

/** Mide el REPO de una app. `dirApp` es la carpeta de la app. Todo se EJECUTA, nada se supone. */
function medirRepoApp(dirApp) {
  const porque = [];
  const piezas = {};
  const leerSi = (r) => (fs.existsSync(r) ? fs.readFileSync(r, 'utf8') : null);
  const valores = valoresDeLosEnv(dirApp);
  // Un valor cuenta como escrito a mano si aparece ENTERO (no «guajirago» dentro de «guajirago-pruebas»).
  const entero = (t, v) => new RegExp('(^|[^\\w.-])' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^\\w.-])').test(t);
  const aMano = (t) => !!t && (/AIza[0-9A-Za-z_-]{20,}/.test(t) || valores.some((v) => entero(t, v)));

  // 1 · ningún SW en public/ (lo copiaría la compilación tal cual) ni plantilla con valores a mano
  const enPublic = leerSi(path.join(dirApp, 'public', NOMBRE_SW));
  const plantilla = leerSi(path.join(dirApp, 'sw', 'plantilla-' + NOMBRE_SW));
  piezas.sinSwEnPublic = enPublic === null;
  if (!piezas.sinSwEnPublic) porque.push('public/' + NOMBRE_SW + ' existe: la compilación lo copia tal cual' + (aMano(enPublic) ? ', y lleva la configuración escrita a mano' : ''));
  piezas.plantillaSinValores = plantilla !== null && !aMano(plantilla);
  if (plantilla === null) porque.push('no hay sw/plantilla-' + NOMBRE_SW);
  else if (aMano(plantilla)) porque.push('la plantilla lleva valores de configuración escritos a mano');

  // 2 · cada compilación corre el generador DESPUÉS de react-scripts build y con el MISMO .env
  let s = {};
  try { const t = leerSi(path.join(dirApp, 'package.json')) || '{}'; s = JSON.parse(t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t).scripts || {}; } catch (e) { s = {}; }
  const malos = [];
  for (const amb of ['pruebas', 'produccion']) {
    const cmd = s['build:' + amb] || '';
    const partes = cmd.split('&&').map((x) => x.trim());
    const build = partes.findIndex((x) => /react-scripts build\s*$/.test(x));
    const gen = partes.findIndex((x) => /node sw\/generar-sw\.cjs\s*$/.test(x));
    const envDe = (x) => ((x || '').match(/^env-cmd -f (\.env\.[a-z]+) /) || [])[1];
    if (build < 0 || gen < 0) malos.push('build:' + amb + ' no corre react-scripts build y luego node sw/generar-sw.cjs');
    else if (gen < build) malos.push('build:' + amb + ' genera el SW ANTES de compilar (la compilación lo borraría)');
    else if (envDe(partes[build]) !== '.env.' + amb || envDe(partes[gen]) !== '.env.' + amb) malos.push('build:' + amb + ' no usa .env.' + amb + ' en la app Y en el generador');
  }
  piezas.compilaConGenerador = malos.length === 0;
  porque.push(...malos);

  // 3 · el generador, EJECUTADO con cada .env, da un SW con los valores de ESE .env y sin marcas sin llenar
  let corre = false;
  const rutaGen = path.join(dirApp, 'sw', 'generar-sw.cjs');
  if (fs.existsSync(rutaGen) && plantilla !== null) {
    try {
      delete require.cache[require.resolve(rutaGen)];
      const { generarServiceWorker } = require(rutaGen);
      const { configFirebaseDe } = require(path.join(dirApp, 'src', 'ambiente.js'));
      corre = true;
      for (const amb of ['pruebas', 'produccion']) {
        const env = leerEnv(leerSi(path.join(dirApp, '.env.' + amb)) || '');
        const sw = generarServiceWorker(plantilla, env);
        const j = juzgarSw(sw, env, configFirebaseDe);
        if (!j.ok) { corre = false; porque.push('el SW generado para ' + amb + ' no trae su configuración: ' + j.distintos.join(', ')); }
        if (/%[A-Za-z]+%/.test(sw)) { corre = false; porque.push('el SW generado para ' + amb + ' deja marcas sin llenar'); }
      }
    } catch (e) {
      corre = false;
      porque.push('el generador no corre: ' + String(e.message || e).slice(0, 200));
    }
  } else porque.push('no hay sw/generar-sw.cjs');
  piezas.generadorDaSuAmbiente = corre;

  const puestas = Object.values(piezas).filter(Boolean).length;
  return { app: path.basename(dirApp), piezas, puestas, de: Object.keys(piezas).length, porque };
}

/** Baja el SW de los cuatro sitios y lo juzga contra el .env de su ambiente (con la configFirebaseDe de la app). */
async function medirServido(raiz = RAIZ, pedir = fetch) {
  const filas = [];
  for (const app of APPS) {
    const dirApp = path.join(raiz, app);
    const { configFirebaseDe } = require(path.join(dirApp, 'src', 'ambiente.js'));
    for (const amb of ['pruebas', 'produccion']) {
      const url = SITIOS[app][amb] + '/' + NOMBRE_SW;
      const env = leerEnv(fs.readFileSync(path.join(dirApp, '.env.' + amb), 'utf8'));
      let texto = '';
      try { texto = await (await pedir(url + '?v=' + Date.now(), { cache: 'no-store' })).text(); } catch (e) { texto = ''; }
      const j = juzgarSw(texto, env, configFirebaseDe);
      filas.push({ app, amb, url, bytes: Buffer.byteLength(texto), ...j });
    }
  }
  return filas;
}

module.exports = { configDelSw, juzgarSw, medirRepoApp, medirServido, APPS, SITIOS };

if (require.main === module) {
  (async () => {
    console.log('\n📨 EL SERVICE WORKER DE AVISOS (G31) — solo lectura\n');
    let malo = 0;
    if (!process.argv.includes('--sin-red')) {
      console.log('1 · LO QUE SIRVE CADA SITIO (comparado con el .env de su ambiente)');
      for (const f of await medirServido()) {
        if (!f.ok) malo++;
        console.log(`   ${f.ok ? '✓' : '🔴'} ${f.url.padEnd(62)} ${String(f.bytes).padStart(5)} bytes · dice projectId «${f.proyecto}»` + (f.ok ? '' : ` · distinto: ${f.distintos.join(', ')}`));
      }
    }
    console.log('\n2 · EL REPO');
    for (const app of APPS) {
      const r = medirRepoApp(path.join(RAIZ, app));
      if (r.puestas !== r.de) malo++;
      console.log(`   ${r.puestas === r.de ? '✓' : '🔴'} ${r.app}: ${r.puestas}/${r.de} piezas`);
      for (const p of r.porque) console.log('      · ' + p);
    }
    console.log(malo ? `\n🔴 ${malo} renglón(es) sin cumplir.\n` : '\n✓ cada sitio sirve el SW de su ambiente y el repo lo genera desde el .env.\n');
    process.exitCode = malo ? 1 : 0;
  })().catch((e) => { console.log('🔴 ' + e.message); process.exitCode = 1; });
}
