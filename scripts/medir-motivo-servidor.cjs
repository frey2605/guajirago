#!/usr/bin/env node
/**
 * G38 · ¿QUÉ LE LLEGA A LA PERSONA CUANDO NUESTRO SERVIDOR DICE QUE NO?   (solo lectura, no toca datos)
 *
 *   node scripts/medir-motivo-servidor.cjs
 *
 * La regla «si el mensaje viene de nuestro servidor, se enseña tal cual» vive en `motivoDeRechazo`
 * (guajirago/src/avisoRechazo.js, con copia atada en el panel y en aliados). Este guion:
 *
 *   1. Cuenta cuántos archivos de las TRES apps llevan esa regla escrita A MANO fuera de la pieza
 *      (el gemelo de G38 era Promociones.js: `e.message.includes(' ')`).
 *   2. Saca de `guajirago/functions/index.js` TODAS las frases que el servidor le contesta a la gente
 *      (`new HttpsError("código", "frase")`), y las pasa por el camino DE VERDAD, sin inventar nada:
 *        · el `HttpsError` REAL de firebase-functions (el servidor) arma el cuerpo y el estado HTTP;
 *        · la librería REAL del teléfono (`firebase/functions`, la versión que compila la app) lo convierte
 *          en el error que recibe la pantalla — con un `fetch` de mentira que devuelve ese cuerpo;
 *        · y `motivoDeRechazo` de las TRES copias dice qué se enseña.
 *      Más dos casos que no son frases: SIN SEÑAL (el `fetch` revienta) y una función que se CAE (500).
 *   3. Cuenta cuántas frases llegan con la marca técnica pegada al final (« [404]») y si el «sin señal»
 *      o el «se cayó» se le enseñan a la persona en crudo.
 *
 * Por qué se corre la librería y no se supone el formato: la versión 12 de firebase le pega « [estado]» a
 * TODO mensaje del servidor, y la regla vieja asumía que sin señal el mensaje era «internal» a secas. Hoy es
 * «internal [0]», que lleva espacio, y la regla lo tomaba por una frase.
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const leer = (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8');

// ── 1. La regla escrita a mano fuera de la pieza ──────────────────────────────────────────────────────────
// Se busca lo que HACE (mirar si e.message lleva espacio para decidir si se enseña), no un nombre.
const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const PIEZA = /\/avisoRechazo\.js$/;
function copiasDeLaRegla() {
  const out = [];
  for (const dir of APPS) {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) {
      if (!/\.js$/.test(f)) continue;
      const ruta = dir + '/' + f;
      if (PIEZA.test(ruta)) continue;
      const t = leer(ruta).replace(/^\s*\/\/.*$/gm, '');
      const n = (t.match(/\.message\s*\.includes\(\s*['"] ['"]\s*\)|\\s\/\.test\([^)]*\.message/g) || []).length;
      if (n) out.push(ruta + ' (' + n + ')');
    }
  }
  return out;
}

// ── 2. Las frases del servidor, por el camino de verdad ──────────────────────────────────────────────────
function frasesDelServidor() {
  const idx = leer('guajirago/functions/index.js');
  const vistas = new Set();
  const out = [];
  for (const m of idx.matchAll(/new HttpsError\(\s*"([a-z-]+)"\s*,\s*"([^"]+)"\s*\)/g)) {
    const k = m[1] + '|' + m[2];
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push({ code: m[1], frase: m[2] });
  }
  // La única frase que no está escrita a pelo: la de las promociones sale de promociones.cjs.
  const promo = require(path.join(RAIZ, 'guajirago/functions/promociones.cjs'));
  out.push({ code: 'failed-precondition', frase: promo.textoParaQuienLaUsa({ codigo: 'otra-cosa' }) });
  return out;
}

async function errorQueRecibeLaPantalla(respuesta) {
  const reqApp = (m) => require(path.join(RAIZ, 'guajirago/node_modules', m));
  const { initializeApp, getApps, deleteApp } = reqApp('firebase/app');
  const { getFunctions, httpsCallable } = reqApp('firebase/functions');
  for (const a of getApps()) await deleteApp(a);
  const app = initializeApp({ apiKey: 'x', projectId: 'demo-medir', appId: '1:1:web:1' });
  const fns = getFunctions(app);
  fns.fetchImpl = respuesta; // el fetch de mentira: lo único inventado es la red
  try { await httpsCallable(fns, 'algo')({}); return null; } catch (e) { return e; }
}

function cuerpoDelServidor(code, frase) {
  const { HttpsError } = require(path.join(RAIZ, 'guajirago/functions/node_modules/firebase-functions/lib/common/providers/https.js'));
  const h = new HttpsError(code, frase);
  return { status: h.httpErrorCode.status, body: { error: h.toJSON() } };
}

// Los errores que la pantalla recibe de verdad: uno por frase del servidor, más «sin señal» y «se cayó».
async function casosDeVerdad() {
  const casos = [];
  for (const { code, frase } of frasesDelServidor()) {
    const { status, body } = cuerpoDelServidor(code, frase);
    const e = await errorQueRecibeLaPantalla(async () => ({ status, json: async () => body }));
    casos.push({ tipo: 'frase', code, frase, e });
  }
  casos.push({ tipo: 'sinSenal', e: await errorQueRecibeLaPantalla(async () => { throw new TypeError('Failed to fetch'); }) });
  casos.push({ tipo: 'seCayo', e: await errorQueRecibeLaPantalla(async () => ({ status: 500, json: async () => ({ error: { status: 'INTERNAL', message: 'INTERNAL' } }) })) });
  return casos;
}

// Qué enseña una pieza `f(e, accion) → { clave, texto }` con esos casos.
function juzgar(f, casos) {
  const r = { frases: 0, conMarca: [], fraseCambiada: [], crudo: [] };
  for (const c of casos) {
    const m = f(c.e, 'hacer algo');
    if (c.tipo === 'frase') {
      r.frases++;
      if (/\[\d+\]\s*$/.test(m.texto)) r.conMarca.push(m.texto);
      // La frase tiene que llegar ENTERA (salvo en «sin red», que tiene su propio aviso).
      else if (m.clave !== 'sinRed' && m.texto !== c.frase) r.fraseCambiada.push(c.frase + ' → ' + m.texto);
    } else if (m.texto === c.e.message || /\[\d+\]/.test(m.texto) || !/\s/.test(m.texto)) {
      r.crudo.push(c.tipo + ': «' + m.texto + '»');
    }
  }
  return r;
}

async function medir() {
  const { cargarDeLaApp } = require(path.join(RAIZ, 'pruebas/cargar.cjs'));
  const casos = await casosDeVerdad();
  const apps = {};
  for (const d of APPS) {
    const app = d.split('/')[0];
    if (!fs.existsSync(path.join(RAIZ, app, 'src/avisoRechazo.js'))) continue;
    apps[app] = juzgar(cargarDeLaApp(app + '/src/avisoRechazo.js').motivoDeRechazo, casos);
  }
  return { copias: copiasDeLaRegla(), apps, mensajeSinSenal: casos.find((c) => c.tipo === 'sinSenal').e.message };
}

module.exports = { medir, copiasDeLaRegla, frasesDelServidor, casosDeVerdad, juzgar };

if (require.main === module) {
  medir().then((r) => {
    console.log('\nG38 · lo que le llega a la persona cuando NUESTRO servidor dice que no\n');
    console.log('La regla escrita a mano fuera de avisoRechazo.js: ' + r.copias.length
      + (r.copias.length ? '  → ' + r.copias.join(', ') : ''));
    console.log('Lo que la librería del teléfono entrega sin señal: «' + r.mensajeSinSenal + '»');
    let malo = r.copias.length;
    for (const [app, j] of Object.entries(r.apps)) {
      const n = j.conMarca.length, x = j.fraseCambiada.length, c = j.crudo.length;
      malo += n + x + c;
      console.log('\n· ' + app + ': ' + n + ' de ' + j.frases + ' frases del servidor con la marca pegada'
        + (n ? ' (p. ej. «' + j.conMarca[0] + '»)' : '')
        + ' · ' + x + ' cambiadas · ' + c + ' fallos técnicos enseñados en crudo' + (c ? ': ' + j.crudo.join(' | ') : ''));
    }
    console.log('\n' + (malo ? '🔴 ' + malo + ' cosas por arreglar' : '✓ una sola regla, y cada frase llega entera y limpia'));
  }).catch((e) => { console.error(e); process.exit(1); });
}
