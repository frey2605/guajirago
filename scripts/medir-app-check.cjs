#!/usr/bin/env node
/**
 * 🚪 ¿QUIÉN PUEDE HABLAR CON LA BASE? — App Check, medido (SOLO LECTURA).
 *
 * Paso 1 y paso 12 de la fase 1 del plan («cerrar la puerta»). Pregunta a Google, en los dos
 * proyectos, y cuenta en el código de las tres apps y de la nube:
 *   · si la API de App Check y la de reCAPTCHA Enterprise están encendidas;
 *   · si la app web tiene proveedor registrado (reCAPTCHA v3 o Enterprise);
 *   · qué hace cada servicio con una llamada SIN App Check: nada (OFF), apuntarla sin
 *     rechazarla (UNENFORCED, «solo mirar») o rechazarla (ENFORCED);
 *   · cuántas apps arrancan App Check y cuántas funciones lo exigen.
 *
 * No escribe nada, ni en la nube ni en disco.
 *   node scripts/medir-app-check.cjs
 */
const fs = require('fs');
const path = require('path');
const { token } = require('./nube.cjs');

const RAIZ = path.join(__dirname, '..');
const PROYECTOS = [
  { id: 'guajirago', ambiente: 'produccion' },
  { id: 'guajirago-pruebas', ambiente: 'pruebas' },
];
const APIS = ['firebaseappcheck.googleapis.com', 'recaptchaenterprise.googleapis.com'];

/** El APP_ID de la app web sale del .env de cada ambiente, no se copia aquí. */
function appIdDe(ambiente) {
  const t = fs.readFileSync(path.join(RAIZ, 'guajirago', '.env.' + ambiente), 'utf8');
  const m = t.match(/^REACT_APP_FIREBASE_APP_ID=(.+)$/m);
  if (!m) throw new Error('no encuentro REACT_APP_FIREBASE_APP_ID en .env.' + ambiente);
  return m[1].trim();
}

async function pedir(url, permiso, quien) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + permiso, 'x-goog-user-project': quien } });
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch (e) { cuerpo = null; }
  return { estado: r.status, cuerpo };
}

/** Cuenta en el CÓDIGO: quién arranca App Check y qué funciones lo exigen. */
function contarCodigo() {
  const apps = ['guajirago', 'guajirago-admin', 'guajirago-aliados'].map((a) => {
    const t = fs.readFileSync(path.join(RAIZ, a, 'src', 'firebase.js'), 'utf8');
    return { app: a, arranca: /initializeAppCheck\s*\(/.test(t) };
  });
  const idx = fs.readFileSync(path.join(RAIZ, 'guajirago', 'functions', 'index.js'), 'utf8');
  const llamables = (idx.match(/\bonCall\s*\(/g) || []).length;
  const exigen = (idx.match(/enforceAppCheck\s*:\s*true/g) || []).length;
  return { apps, llamables, exigen };
}

async function main() {
  const { permiso, puerta } = await token();
  console.log('Puerta: ' + puerta + '\n');
  for (const p of PROYECTOS) {
    const appId = appIdDe(p.ambiente);
    const num = appId.split(':')[1];
    console.log('═══ ' + p.id + ' (' + p.ambiente + ') · app web ' + appId);
    for (const api of APIS) {
      const r = await pedir('https://serviceusage.googleapis.com/v1/projects/' + p.id + '/services/' + api, permiso, p.id);
      console.log('  API ' + api.padEnd(36) + (r.cuerpo && r.cuerpo.state ? r.cuerpo.state : 'no se pudo leer (' + r.estado + ')'));
    }
    const base = 'https://firebaseappcheck.googleapis.com/v1/projects/' + num + '/apps/' + appId;
    for (const prov of ['recaptchaV3Config', 'recaptchaEnterpriseConfig']) {
      const r = await pedir(base + '/' + prov, permiso, p.id);
      const tiene = r.estado === 200 && r.cuerpo && (r.cuerpo.siteSecretSet || r.cuerpo.siteKey);
      console.log('  proveedor ' + prov.padEnd(27) + (r.estado === 200 ? (tiene ? 'REGISTRADO' : 'vacío') : 'no se pudo leer (' + r.estado + ') ' + JSON.stringify(r.cuerpo).slice(0, 160)));
    }
    const s = await pedir('https://firebaseappcheck.googleapis.com/v1/projects/' + num + '/services?pageSize=100', permiso, p.id);
    if (s.estado !== 200) console.log('  servicios: no se pudo leer (' + s.estado + ') ' + JSON.stringify(s.cuerpo).slice(0, 200));
    else {
      const lista = (s.cuerpo.services || []);
      if (!lista.length) console.log('  servicios: ninguno configurado (todos OFF: nadie mira nada)');
      for (const x of lista) console.log('  servicio ' + x.name.split('/').pop().padEnd(34) + (x.enforcementMode || 'OFF'));
    }
    console.log('');
  }
  const c = contarCodigo();
  console.log('═══ Código');
  for (const a of c.apps) console.log('  ' + a.app.padEnd(20) + (a.arranca ? 'arranca App Check' : 'NO arranca App Check'));
  console.log('  funciones llamables: ' + c.llamables + ' · que exigen App Check: ' + c.exigen);
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
module.exports = { contarCodigo, appIdDe };
