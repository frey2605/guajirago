/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MEDIR · EL ALMACÉN DE ARCHIVOS (Storage)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SOLO LECTURA. No sube, no borra, no cambia nada. Se corre DOS veces: antes
 * de tocar (paso 1) y otra vez al final (paso 10).
 *
 *     node scripts/medir-storage.cjs                    ← solo mira
 *     node scripts/medir-storage.cjs storage.rules.LIVE ← y guarda las reglas
 *
 * QUÉ CONTESTA:
 *  1. QUÉ REGLAS RIGEN AHORA MISMO. Se bajan del servidor con la API
 *     `firebaserules.googleapis.com`, usando la sesión que el CLI ya tiene
 *     abierta — `firebase` no tiene comando para LEER reglas. Sirve para
 *     carear lo publicado contra `storage.rules` del repositorio: si alguien
 *     las cambia por la consola, aquí se ve.
 *  2. QUÉ HAY GUARDADO: cuántos archivos y en qué carpetas.
 *  3. **SI SE PUEDE ENTRAR SIN CUENTA.** Esta es la que importa. No se mira el
 *     texto de las reglas: se INTENTA, desde fuera y sin ninguna credencial,
 *     igual que lo haría un desconocido. Una regla que se lee bien pero deja
 *     entrar no sirve de nada.
 *
 * LO QUE ENCONTRÓ LA PRIMERA VEZ (6-sep-2026): las reglas decían
 * `allow read: if true`, se podía LISTAR el bucket entero sin cuenta y se
 * bajaron 105 kB de la foto de una cédula real. Había 43 archivos, 32 en
 * `conductores/` — 16 cédulas y 16 caras, de 15 conductores.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'guajirago';
const BUCKET = 'guajirago.firebasestorage.app';
// Las credenciales públicas del CLI de Firebase: no son un secreto, salen de su
// propio código. La sesión de verdad es el refresh_token del disco.
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const SALIDA = process.argv[2] || null;

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) {
    throw new Error('no pude abrir sesión con Firebase: ' + JSON.stringify(x).slice(0, 200)
      + '\n   (arréglalo con: npx firebase-tools login)');
  }
  return x.access_token;
}

const raya = (t) => console.log('\n' + t + '\n' + '─'.repeat(t.length));

(async () => {
  const hoy = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  console.log('EL ALMACÉN DE ARCHIVOS · ' + hoy + ' (hora de Colombia)');
  const t = await token();

  // ── 1 · LAS REGLAS QUE RIGEN AHORA ────────────────────────────────────────
  raya('1 · LAS REGLAS DE STORAGE PUBLICADAS');
  const rl = await (await fetch(
    'https://firebaserules.googleapis.com/v1/projects/' + PROYECTO + '/releases',
    { headers: { Authorization: 'Bearer ' + t } })).json();
  const rel = (rl.releases || []).find((x) => /firebase\.storage/.test(x.name));
  let fuente = '';
  if (!rel) {
    console.log('  ✋ NO hay release de Storage publicada.');
  } else {
    const rs = await (await fetch('https://firebaserules.googleapis.com/v1/' + rel.rulesetName,
      { headers: { Authorization: 'Bearer ' + t } })).json();
    fuente = ((rs.source && rs.source.files) || []).map((f) => f.content).join('\n');
    console.log('  publicadas el: ' + (rel.updateTime || '?'));
    console.log('  renglones: ' + fuente.split('\n').length);
    // SIN LOS COMENTARIOS. La cabecera de `storage.rules` CITA las reglas
    // viejas para explicar qué se vino a tapar, y la primera versión de esta
    // línea encontraba la cita y cantaba «✋ SÍ, sigue el agujero» con el
    // agujero ya cerrado. Un medidor que grita en falso deja de mirarse, y
    // entonces no avisa el día que sea verdad.
    const sinComentarios = fuente.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    console.log('  ¿sigue el agujero `allow read: if true`? ... '
      + (/allow read:\s*if true/.test(sinComentarios) ? '✋ SÍ' : 'no'));
    if (SALIDA) { fs.writeFileSync(SALIDA, fuente, 'utf8'); console.log('  guardadas en ' + SALIDA); }
  }

  // El careo con el repositorio: si alguien las cambió por la consola, se ve.
  const enElRepo = path.join(__dirname, '..', 'storage.rules');
  if (fs.existsSync(enElRepo) && fuente) {
    const igual = fs.readFileSync(enElRepo, 'utf8').replace(/\r\n/g, '\n').trim() === fuente.replace(/\r\n/g, '\n').trim();
    console.log('  ¿lo publicado es LO MISMO que storage.rules del repo? ... ' + (igual ? 'sí' : '✋ NO'));
  }

  // ── 2 · QUÉ HAY GUARDADO ──────────────────────────────────────────────────
  raya('2 · INVENTARIO DE ' + BUCKET);
  let pagina; const todos = [];
  do {
    const u = 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o?maxResults=1000'
      + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(u, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) { console.log('  no pude listar: HTTP ' + r.status); break; }
    const j = await r.json();
    todos.push(...(j.items || []));
    pagina = j.nextPageToken;
  } while (pagina);

  const porCarpeta = {};
  const uidsConductor = new Set();
  let cedulas = 0;
  for (const o of todos) {
    const n = String(o.name || '');
    const c = n.split('/')[0] || '(raíz)';
    porCarpeta[c] = (porCarpeta[c] || 0) + 1;
    if (c === 'conductores') {
      uidsConductor.add(n.split('/')[1]);
      if (/cedula_/.test(n)) cedulas += 1;
    }
  }
  console.log('  archivos en total: ' + todos.length);
  for (const [c, n] of Object.entries(porCarpeta).sort((a, b) => b[1] - a[1])) {
    console.log('    ' + c.padEnd(22) + n);
  }
  console.log('  conductores distintos con ficha: ' + uidsConductor.size);
  console.log('  fotos de CÉDULA guardadas: ' + cedulas);

  // ── 3 · LA QUE IMPORTA: ¿SE ENTRA SIN CUENTA? ─────────────────────────────
  raya('3 · ¿SE PUEDE ENTRAR SIN NINGUNA CUENTA?');
  console.log('  (no se lee el texto de las reglas: se INTENTA, como un desconocido)');
  let abierto = 0;
  const lista = await fetch('https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o?maxResults=3');
  const puedeListar = lista.ok;
  console.log('  listar el bucket ............ ' + (puedeListar ? '✋ SE PUEDE' : 'no'));
  if (puedeListar) abierto += 1;

  const unaCedula = todos.find((o) => /^conductores\/.*cedula_/.test(String(o.name || '')));
  if (unaCedula) {
    const ruta = encodeURIComponent(unaCedula.name);
    const d = await fetch('https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + ruta + '?alt=media');
    console.log('  bajar la foto de una cédula . ' + (d.ok ? '✋ SE PUEDE' : 'no'));
    if (d.ok) abierto += 1;
  } else {
    console.log('  bajar la foto de una cédula . (no hay ninguna para probar)');
  }

  raya('LA HUELLA (paso 1 vs paso 10)');
  console.log('archivos=' + todos.length + ' carpetas=' + Object.keys(porCarpeta).length
    + ' cedulas=' + cedulas + ' puertasAbiertas=' + abierto);

  // Si sigue abierto, esto tiene que DOLER: sale con error.
  if (abierto) {
    console.error('\n✋ EL ALMACÉN SIGUE ABIERTO A CUALQUIERA (' + abierto + ' de 2 puertas).');
    process.exit(1);
  }
  console.log('\n✓ desde fuera y sin cuenta, no se entra.');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
