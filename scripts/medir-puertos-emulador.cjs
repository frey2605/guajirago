#!/usr/bin/env node
/**
 * LOS PUERTOS DEL EMULADOR — ¿puede el de GuajiraGo chocar con otro proyecto, y quién lleva un puerto escrito a mano?
 *
 *   node scripts/medir-puertos-emulador.cjs           <- SOLO LEE. No arranca ni cierra nada.
 *   node scripts/medir-puertos-emulador.cjs --censo   <- se corre DENTRO del emulador, así:
 *       npx firebase-tools@15 emulators:exec --only firestore,functions,storage --project demo-guajirago
 *           "node scripts/medir-puertos-emulador.cjs --censo"
 *       y dice qué puertos tiene abiertos el emulador DE VERDAD (todo java o node que escuche).
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12. El amarre de `pruebas/amarres.test.js`
 * y `scripts/medir-emulador-colgado.cjs` lo importan: un solo recorrido (SEGUNDA LEY).
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El 25-sep-2026 la tanda se colgó dos veces. Hipótesis SIN medir: un choque de puertos con
 * otro proyecto Firebase de la máquina. Lo que sí se midió ese día:
 *   · firebase-tools tiene dos clases de puerto. Los FIJOS fallan si están ocupados; los que
 *     NO son fijos buscan otro solos. Un puerto DECLARADO en firebase.json es siempre fijo
 *     (`portFixed = true` en su controlador). Sin declarar, lo decide FIND_AVAILBLE_PORT_BY_DEFAULT.
 *   · Por eso solo firestore, functions y storage tienen que ser PROPIOS: son los fijos. Los
 *     demás (hub, registro, eventarc, tareas, websocket) se apartan solos si NO se declaran;
 *     declararlos los volvería fijos y frágiles. Lo cazó la segunda opinión del 25-sep.
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *   1. por cada puerto que abre la tanda: el número, si es fijo, y si un FIJO coincide con uno
 *      de fábrica (= otro proyecto lo usa igual, y chocan)
 *   2. dónde aparece como número suelto un puerto que la tanda puede abrir, en TODOS los archivos
 *      de código de los tres repos. Se busca el NÚMERO, no la forma de escribirlo: perseguir
 *      formas de escribir no acaba nunca (la segunda opinión coló cinco). Los propios solo
 *      pueden vivir en firebase.json; los de fábrica en ningún sitio, salvo EXCEPCIONES.
 *   3. quién escucha ahora (con `quienOcupa` de medir-emulador-colgado.cjs)
 *
 * 🔑 Los puertos de fábrica NO se copian aquí: se leen de firebase-tools. Y de la MISMA que
 * corre la tanda, buscada en el orden de npx (ver `dondeEstaFirebaseTools`). Qué versión pide
 * la tanda y qué emuladores levanta se leen de `pruebas/correr.cjs`. Si falta algo, se dice y
 * se para: este guion no adivina.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');

/**
 * Lo que arranca la tanda se LEE de `pruebas/correr.cjs`, que es quien la arranca: la versión de
 * firebase-tools (`firebase-tools@N`) y los emuladores de su `--only`. Escribirlos aquí sería el
 * gemelo que se queda viejo: la ronda 2 de segunda opinión añadió `auth` al `--only` —puerto
 * FIJO y de fábrica— y el amarre siguió en verde.
 */
function laTanda(texto) {
  const t = texto || fs.readFileSync(path.join(RAIZ, 'pruebas', 'correr.cjs'), 'utf8');
  // UNA sola aparición, fuera de un comentario, y el `--only` como texto COMPLETO (seguido de coma):
  // la ronda 3 de segunda opinión metió un comentario viejo con el `--only` de antes encima del
  // real y el guion leyó el del comentario; y un `'…' + ',auth'` armado por partes se leía a medias.
  // Con dos apariciones no se elige: se para y se dice.
  // 🔑 Y se cuenta el NOMBRE, escrito como sea, no la forma: la ronda 4 escribió la orden real con
  // comillas dobles y dejó un señuelo con comillas simples en un comentario de bloque; el patrón de
  // comillas simples solo veía el señuelo, y lo daba por la única aparición.
  const unaSola = (nombre, re, que) => {
    const veces = t.split(nombre).length - 1;
    const m = t.match(re);
    const antes = m ? t.slice(0, m.index) : '';
    const renglon = antes.slice(antes.lastIndexOf('\n') + 1);
    const enBloque = antes.lastIndexOf('/*') > antes.lastIndexOf('*/');
    if (veces !== 1 || !m || /(^|\s)\/\//.test(renglon) || enBloque) {
      throw new Error('en pruebas/correr.cjs tiene que haber UNA sola ' + que + ', escrita en el código y no en un '
        + 'comentario; «' + nombre + '» aparece ' + veces + ' vez/veces' + (m ? '' : ' y ninguna con la forma esperada')
        + '. Este guion no elige: si cambió la forma de escribirla, hay que cambiar este guion');
    }
    return m[1];
  };
  const mayor = unaSola('firebase-tools@', /['"]firebase-tools@(\d+)['"]/, "versión 'firebase-tools@N'");
  const only = unaSola('--only', /['"]--only['"],\s*['"]([^'"]+)['"]\s*,/,
    "lista '--only', '…', (completa, no armada por partes)");
  // 🔑 Y LOS ARCHIVOS DE LA ORDEN (25-sep-2026): una prueba que no está escrita aquí no corre en
  //  ningún sitio y queda verde para siempre. Salen de la orden misma —el texto que arranca con
  //  '"node --test— y no de todo el archivo: un nombre en un comentario no es parte de la tanda.
  const orden = unaSola('\'"node --test', /'"node --test ([^']+)"'/,
    'orden \'"node --test …"\' (la tanda entera, en un solo texto)');
  const archivos = [...new Set(orden.match(/pruebas\/[A-Za-z0-9_-]+\.test\.js/g) || [])];
  return { mayor: Number(mayor), emuladores: only.split(',').map((s) => s.trim()).filter(Boolean), archivos };
}

/** Los que abre firebase-tools por su cuenta, además de los del `--only`. Esto SÍ va escrito: no
 *  hay dónde leerlo. Lo comprueba el censo (`--censo`), que enseña lo que el emulador abre de verdad. */
function losQueArrancan(emuladores) {
  const solos = ['hub', 'logging'];
  if (emuladores.includes('functions')) solos.push('eventarc', 'tasks');
  return [...emuladores, ...solos.filter((s) => !emuladores.includes(s))];
}
const WEBSOCKET = 'firestore (websocket)';

/** Los números que NO son un puerto aunque coincidan. Cada una perdona SOLO el número del puerto
 *  que nombra, y solo en los renglones de su archivo que contengan su texto: perdonar el renglón
 *  entero lo volvía escondite (ronda 2: un puerto metido en un renglón perdonado seguía verde).
 *  El puerto va por su NOMBRE, no por su número: este guion también se recorre a sí mismo.
 *  El amarre exige que cada una siga calzando: una excepción sin uso se queda vieja sin avisar. */
const EXCEPCIONES = [
  { archivo: 'pruebas/reglas.test.js', contiene: "'comprasInsumos/c5'), { costo: ", puerto: 'logging',
    motivo: 'es el costo de una compra de insumos en pesos, no un puerto' },
  { archivo: 'pruebas/storage.test.js', contiene: "'pedidosRestaurantes/PED1/' + nueva(", puerto: 'functions',
    motivo: 'es el tamaño en bytes de una foto de prueba, no un puerto' },
];

function mayorDe(version) { return Number(String(version).split('.')[0]); }

function laVersionDe(carpeta) {
  const pj = path.join(carpeta, 'package.json');
  return fs.existsSync(pj) ? JSON.parse(fs.readFileSync(pj, 'utf8')).version : null;
}

/**
 * Dónde está la firebase-tools que corre la tanda, buscada EN EL MISMO ORDEN QUE npx
 * (libnpmexec): 1) la del propio proyecto; 2) la global, si cumple la versión que pide la tanda;
 * 3) la del caché de npx para ESA orden, cuya carpeta se llama con el sha512 de
 * `firebase-tools@N` (sus 16 primeras letras). La primera versión de este guion cogía «la 15 más
 * alta de cualquier carpeta del caché» y leía la de `firebase-tools@latest`, que no es la de la
 * tanda (ronda 2 de segunda opinión, 25-sep-2026: la tanda corría una versión y este guion leía otra).
 */
function dondeEstaFirebaseTools(mayor) {
  const buscadas = [];
  const probar = (carpeta, origen) => {
    const version = laVersionDe(carpeta);
    buscadas.push(origen + ': ' + (version ? version : 'no está'));
    return version && mayorDe(version) === mayor ? { carpeta, origen, version } : null;
  };
  const delProyecto = probar(path.join(RAIZ, 'node_modules', 'firebase-tools'), 'proyecto');
  if (delProyecto) return delProyecto;
  let global = null;
  // Con tiempo máximo: el guardián llama aquí justo cuando algo se colgó (ronda 3).
  try { global = path.join(execSync('npm root -g', { encoding: 'utf8', timeout: 60 * 1000 }).trim(), 'firebase-tools'); }
  catch (e) { buscadas.push('global: npm no contestó'); }
  const laGlobal = global && probar(global, 'global');
  if (laGlobal) return laGlobal;
  let cache = process.env.npm_config_cache;
  if (!cache) {
    try { cache = execSync('npm config get cache', { encoding: 'utf8', timeout: 60 * 1000 }).trim(); } catch (e) { cache = null; }
  }
  if (cache) {
    const hash = crypto.createHash('sha512').update('firebase-tools@' + mayor).digest('hex').slice(0, 16);
    const delCache = probar(path.join(cache, '_npx', hash, 'node_modules', 'firebase-tools'), 'caché de npx');
    if (delCache) return delCache;
  }
  throw new Error('no encontré la firebase-tools ' + mayor + ' que corre la tanda (' + buscadas.join(' · ') + '). '
    + 'Sin ella no se sabe cuáles son los puertos de fábrica, y este guion no adivina. '
    + 'Se baja sola al correr `npm test` (npx firebase-tools@' + mayor + ').');
}

/** Los puertos de fábrica y cuáles buscan otro solos, leídos de la firebase-tools de la tanda.
 *  Se guarda en memoria: preguntarle a npm cuesta medio segundo cada vez. */
let enMemoria = null;
function losDeFabrica() {
  if (enMemoria) return enMemoria;
  const tanda = laTanda();
  const ft = dondeEstaFirebaseTools(tanda.mayor);
  const carpeta = path.join(ft.carpeta, 'lib', 'emulator');
  const c = require(path.join(carpeta, 'constants.js'));
  // El websocket de firestore no está en DEFAULT_PORTS: vive en el controlador (`wsPortConfig || N`).
  const controlador = fs.readFileSync(path.join(carpeta, 'controller.js'), 'utf8');
  const ws = controlador.match(/wsPortConfig\s*\|\|\s*(\d+)/);
  if (!ws) throw new Error('no encontré el puerto de fábrica del websocket en el controlador de firebase-tools ' + ft.version);
  // Y que un puerto DECLARADO es fijo también se LEE, no se supone: si firebase-tools cambia, se ve.
  if (!/if\s*\(portVal\)\s*\{\s*port\s*=\s*parseInt\([^;]*;\s*portFixed\s*=\s*true/.test(controlador)) {
    throw new Error('firebase-tools ' + ft.version + ' ya no dice que un puerto declarado es fijo: '
      + 'la cuenta de «cuáles chocan» de este guion ya no vale y hay que revisarla');
  }
  enMemoria = {
    puertos: { ...c.DEFAULT_PORTS, [WEBSOCKET]: Number(ws[1]) },
    buscaOtro: { ...c.FIND_AVAILBLE_PORT_BY_DEFAULT, [WEBSOCKET]: true },
    version: ft.version, origen: ft.origen, carpeta: ft.carpeta,
    mayor: tanda.mayor, arrancan: losQueArrancan(tanda.emuladores),
  };
  return enMemoria;
}

function leerFirebaseJson() {
  let t = fs.readFileSync(path.join(RAIZ, 'firebase.json'), 'utf8');
  if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  return JSON.parse(t);
}

/** Los puertos de GuajiraGo, uno por fila. `config` es para el amarre (un firebase.json de mentira). */
function losDeGuajiraGo(fabrica, config) {
  const em = (config || leerFirebaseJson()).emulators || {};
  const deFabrica = new Set(Object.values(fabrica.puertos));
  return [...fabrica.arrancan, WEBSOCKET].map((nombre) => {
    const valor = nombre === WEBSOCKET ? em.firestore && em.firestore.websocketPort : em[nombre] && em[nombre].port;
    const declarado = !!valor;
    const puerto = declarado ? Number(valor) : fabrica.puertos[nombre];
    const fijo = declarado || !fabrica.buscaOtro[nombre];
    return { nombre, puerto, declarado, fijo, fabrica: fabrica.puertos[nombre], chocable: fijo && deFabrica.has(puerto) };
  });
}

/** Los números prohibidos: { numero: motivo }. Los propios solo pueden estar en firebase.json. */
function losNumerosProhibidos(fabrica, config) {
  const prohibidos = {};
  for (const f of losDeGuajiraGo(fabrica, config)) {
    prohibidos[f.fabrica] = 'el de fábrica de ' + f.nombre + ': con él se habla con el emulador de OTRO proyecto, o con uno que ya no está';
    if (f.declarado) prohibidos[f.puerto] = 'el propio de ' + f.nombre + ': vive en firebase.json, y se pide con `elEmulador` de pruebas/cargar.cjs';
  }
  return prohibidos;
}

/** Los números prohibidos que aparecen SUELTOS en un texto: [{ renglon, numero, texto }]. Pura. */
function numerosEnTexto(fuente, numeros) {
  const hallados = [];
  const patrones = numeros.map((n) => [Number(n), new RegExp('(?<![\\w.])' + n + '(?![\\w])')]);
  fuente.split(/\r?\n/).forEach((l, i) => {
    for (const [n, re] of patrones) if (re.test(l)) hallados.push({ renglon: i + 1, numero: n, texto: l.trim() });
  });
  return hallados;
}

/** Todos los archivos de código de los tres repos, bajando a subcarpetas. */
const NO_ENTRAR = new Set(['node_modules', 'build', '.git', '.firebase', 'coverage', 'dist']);
const COPIAS_MUERTAS = new Set(['guajirago/guajirago']); // la copia anidada de junio: .gitignore la tapa
const EXT = /\.(js|cjs|mjs|jsx|ts|tsx|json|yml|yaml|sh|ps1|bat|cmd|html)$|^\.env(\..+)?$/;
const NO_MIRAR = new Set(['firebase.json']); // el único sitio donde viven los propios
function losArchivos(dir = RAIZ, fuera = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(RAIZ, abs).split(path.sep).join('/');
    if (e.isDirectory()) {
      if (NO_ENTRAR.has(e.name) || COPIAS_MUERTAS.has(rel)) continue;
      losArchivos(abs, fuera);
    } else if (EXT.test(e.name) && e.name !== 'package-lock.json' && !NO_MIRAR.has(rel)) {
      fuera.push(rel);
    }
  }
  return fuera;
}

/** Dónde aparece un número prohibido. Devuelve { sitios, usadas, sinUso } (sitios ya sin excepciones). */
function losEscritosAMano(fabrica, config) {
  const prohibidos = losNumerosProhibidos(fabrica, config);
  const numeros = Object.keys(prohibidos);
  const sitios = [];
  const usadas = new Set();
  for (const archivo of losArchivos()) {
    for (const h of numerosEnTexto(fs.readFileSync(path.join(RAIZ, archivo), 'utf8'), numeros)) {
      const ex = EXCEPCIONES.find((x) => x.archivo === archivo && h.texto.includes(x.contiene)
        && h.numero === fabrica.puertos[x.puerto]);
      if (ex) { usadas.add(ex); continue; }
      sitios.push({ archivo, ...h, motivo: prohibidos[h.numero] });
    }
  }
  return { sitios, usadas: [...usadas], sinUso: EXCEPCIONES.filter((x) => !usadas.has(x)) };
}

/** Qué puertos tiene abiertos el emulador DE VERDAD: todo java o node que escuche. Solo Windows. */
function censo() {
  if (process.platform !== 'win32') return null;
  const ps = [
    "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {",
    "  $pr = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue",
    "  if ($pr -and ($pr.ProcessName -eq 'java' -or $pr.ProcessName -eq 'node')) {",
    "    $ci = Get-CimInstance Win32_Process -Filter \"ProcessId=$($_.OwningProcess)\" -ErrorAction SilentlyContinue",
    "    $cmd = if ($ci -and $ci.CommandLine) { $ci.CommandLine } else { '' }",
    "    $proy = if ($cmd -match '(demo-[\\w-]+)') { $Matches[1] } else { '?' }",
    "    \"$($_.LocalPort)|$($_.OwningProcess)|$($pr.ProcessName)|$proy\"",
    "  }",
    "} | Sort-Object -Unique",
  ].join('\n');
  const salida = execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  return salida.split(/\r?\n/).filter(Boolean).map((f) => {
    const [puerto, pid, proceso, proyecto] = f.split('|');
    return { puerto: Number(puerto), pid, proceso, proyecto };
  }).sort((a, b) => a.puerto - b.puerto);
}

// Se exporta ANTES del bloque que corre: medir-emulador-colgado.cjs pide este archivo y este pide
// aquél, así que exportar al final dejaba al otro con un objeto vacío.
module.exports = {
  laTanda, losQueArrancan, WEBSOCKET, EXCEPCIONES, dondeEstaFirebaseTools, losDeFabrica, losDeGuajiraGo,
  losNumerosProhibidos, numerosEnTexto, losArchivos, losEscritosAMano, censo,
};

if (require.main === module) {
  if (process.argv.includes('--censo')) {
    const c = censo();
    if (c === null) { console.log('el censo solo sabe preguntar en Windows'); process.exit(0); }
    console.log('== censo de puertos abiertos por java/node (' + new Date().toISOString() + ')');
    for (const o of c) {
      console.log('   ' + String(o.puerto).padEnd(7) + 'pid ' + String(o.pid).padEnd(8) + o.proceso.padEnd(6) + o.proyecto);
    }
    console.log('   ' + c.length + ' puerto(s) abiertos');
    process.exit(0);
  }

  const fabrica = losDeFabrica();
  console.log('== medido ' + new Date().toISOString());
  console.log('puertos de fábrica leídos de firebase-tools ' + fabrica.version + ' (' + fabrica.origen
    + '), la que corre la tanda: npx firebase-tools@' + fabrica.mayor);
  console.log('emuladores que arranca (el --only de pruebas/correr.cjs, más los que abre solo): '
    + fabrica.arrancan.join(', '));

  console.log('\n1 · LOS PUERTOS QUE ABRE LA TANDA');
  const filas = losDeGuajiraGo(fabrica);
  for (const f of filas) {
    const origen = f.declarado ? 'declarado' : 'sin declarar';
    const clase = f.fijo ? 'FIJO: si está ocupado, falla' : 'si está ocupado, busca otro';
    const choque = f.chocable ? '🔴 fijo Y de fábrica: choca con otro proyecto' : '✓';
    console.log('   ' + f.nombre.padEnd(23) + String(f.puerto).padEnd(8) + origen.padEnd(14) + clase.padEnd(31) + choque);
  }

  console.log('\n2 · NÚMEROS DE PUERTO SUELTOS EN EL CÓDIGO (tres repos, con subcarpetas)');
  const m = losEscritosAMano(fabrica);
  console.log('   archivos recorridos: ' + losArchivos().length + ' · números que se buscan: '
    + Object.keys(losNumerosProhibidos(fabrica)).join(', '));
  if (!m.sitios.length) console.log('   ✓ ninguno');
  for (const s of m.sitios) console.log('   🔴 ' + (s.archivo + ':' + s.renglon).padEnd(40) + s.texto.slice(0, 90) + '\n        ↳ ' + s.motivo);
  for (const x of m.usadas) console.log('   · excepción: ' + x.archivo + ' — ' + x.motivo);
  for (const x of m.sinUso) console.log('   🔴 excepción que ya no calza con nada: ' + x.archivo + ' — ' + x.motivo);

  console.log('\n3 · QUIÉN ESCUCHA AHORA');
  const { quienOcupa, describir } = require('./medir-emulador-colgado.cjs');
  const ocupados = quienOcupa();
  if (ocupados === null) console.log('   (solo se puede preguntar en Windows)');
  else if (!ocupados.length) console.log('   nadie');
  else for (const o of ocupados) console.log('   ' + describir(o));

  const chocables = filas.filter((f) => f.chocable).length;
  console.log('\n== RESUMEN');
  console.log('   ' + chocables + ' puerto(s) fijos que chocan · ' + m.sitios.length + ' número(s) de puerto sueltos · '
    + m.sinUso.length + ' excepción(es) vieja(s)');
}
