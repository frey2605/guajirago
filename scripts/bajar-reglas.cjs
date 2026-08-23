#!/usr/bin/env node
/**
 * BAJA LAS REGLAS QUE ESTÁN VIVAS EN EL SERVIDOR — paso 9 de los 10 pasos.
 *
 *   node bajar-reglas.cjs <proyecto> <archivo-de-salida>
 *
 * "Que el comando diga listo no es prueba de nada": esto vuelve a LEER del
 * servidor lo que de verdad está sirviendo, para compararlo con lo que se subió.
 *
 * `firebase` no tiene comando para leer reglas. Se usa la API
 * firebaserules.googleapis.com con la sesión que el CLI ya tiene abierta.
 * NUNCA imprime credenciales.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PROYECTO = process.argv[2];
const SALIDA = process.argv[3];
if (!PROYECTO || !SALIDA) {
  console.error('uso: node bajar-reglas.cjs <proyecto> <archivo-de-salida>');
  process.exit(1);
}

// Constantes PÚBLICAS del CLI de Firebase (vienen dentro del paquete, no son secretas).
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const SESION = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

function leerRefresh() {
  if (!fs.existsSync(SESION)) {
    console.error('No hay sesión del CLI en ' + SESION + '. Corre: firebase login');
    process.exit(1);
  }
  const j = JSON.parse(fs.readFileSync(SESION, 'utf8'));
  const rt = j.tokens && j.tokens.refresh_token;
  if (!rt) {
    console.error('La sesión no tiene refresh token. Corre: firebase login --reauth');
    process.exit(1);
  }
  return rt;
}

async function accessToken() {
  const cuerpo = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: leerRefresh(),
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo,
  });
  if (!r.ok) {
    console.error('No se pudo renovar la sesión (HTTP ' + r.status + '). Corre: firebase login --reauth');
    process.exit(1);
  }
  const j = await r.json();
  return j.access_token;
}

async function api(url, tok) {
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
  if (!r.ok) {
    console.error('La API respondió HTTP ' + r.status + ' en ' + url.replace(/\/v1\/.*/, '/v1/…'));
    process.exit(1);
  }
  return r.json();
}

(async () => {
  const tok = await accessToken();

  // 1) Qué conjunto de reglas está PUBLICADO ahora mismo
  const rel = await api(
    'https://firebaserules.googleapis.com/v1/projects/' + PROYECTO + '/releases/cloud.firestore',
    tok
  );
  console.log('publicado el : ' + (rel.updateTime || rel.createTime || '?'));
  console.log('conjunto     : ' + String(rel.rulesetName || '').split('/').pop());

  // 2) El contenido de ese conjunto
  const rs = await api('https://firebaserules.googleapis.com/v1/' + rel.rulesetName, tok);
  const archivos = (rs.source && rs.source.files) || [];
  if (!archivos.length) {
    console.error('El conjunto publicado no trae archivos.');
    process.exit(1);
  }
  fs.writeFileSync(SALIDA, archivos[0].content);
  console.log('bajado a     : ' + SALIDA + '  (' + archivos[0].content.split('\n').length + ' líneas)');
})();
