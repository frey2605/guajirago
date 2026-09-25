#!/usr/bin/env node
/**
 * LA MUDANZA A LA CARPETA LOCAL DE GOOGLE DRIVE — decisión del dueño (25-sep-2026).
 *
 *   node scripts/mudar-a-drive.cjs                     ← SOLO MIRA. No toca nada.
 *   node scripts/mudar-a-drive.cjs --mudar "<carpeta>" ← muda de verdad.
 *
 * 🔑 NO COPIA: CLONA. Y eso no es un capricho, son los números de esta carpeta
 *  (medidos el 24-sep-2026): el código que git sigue son **234 archivos** y todo
 *  su historial pesa **5,7 MB**; la carpeta entera son **170.747 archivos y 2 GB**,
 *  de los cuales **169.976 son `node_modules`** — el 99,5%. Copiar arrastraría a
 *  Drive 170.000 archivos para cuidar 234, y las librerías se vuelven a bajar con
 *  un comando. Clonar deja exactamente lo que importa.
 *
 * 🔴 Y PORQUE CLONA, HAY COSAS QUE NO VIAJAN. Un clon trae lo que está en GitHub
 *  y nada más. Lo que el `.gitignore` esconde —`.env`, `.firebase/`, la foto del
 *  guardián, el repo anidado viejo— **se queda en el disco de origen**. Este guion
 *  las BUSCA, las nombra con su peso, y las copia aparte después de clonar. Lo que
 *  no puede copiar lo dice, en vez de dejar un hueco callado (REGLA 9).
 *
 * 🔴 LO QUE PARA EL TRABAJO, y es lo importante: si en el PC hay algo commiteado y
 *  no empujado, algo sin commitear, o un `stash`, **un clon lo pierde para siempre**.
 *  Así que antes de tocar nada se le pregunta AL SERVIDOR (`git ls-remote`), no al
 *  `origin/main` de la máquina, que puede estar viejo — es la regla 4 del respaldo
 *  del dueño, y ya mintió una vez: la copia de Dropbox decía «ahead 11» y era falso.
 *  Las TRAMPAS de CLAUDE.md avisan que el PC tiene un repo anidado en `guajirago/`
 *  con TRES stashes, y que uno de ellos **no se puede subir porque lleva una
 *  credencial de Twilio dentro**. Ése no lo salva ningún clon: hay que sacarlo a
 *  mano antes, o queda solo en ese disco.
 *
 * 🔴 NO BORRA LA CARPETA VIEJA. Nunca. El dueño la borra cuando haya visto la nueva
 *  funcionar — un borrado no se deshace, y el careo del final es lo que da permiso.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const NOMBRE_DESTINO = 'Guajira Go Proyecto';

// Los tres repos, tal como viven: la raíz, y los dos hermanos DENTRO de ella.
// No se escribe su dirección a mano: se le pregunta a cada uno (SEGUNDA LEY).
const HERMANOS = ['guajirago-admin', 'guajirago-aliados'];

const C = { rojo: '\x1b[31m', verde: '\x1b[32m', ama: '\x1b[33m', gris: '\x1b[90m', neg: '\x1b[1m', off: '\x1b[0m' };
const say = (s) => process.stdout.write((s === undefined ? '' : s) + '\n');

function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) { return ''; }
}

const pesa = (n) => (n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');

function pesoDe(p) {
  let total = 0;
  const andar = (q) => {
    let st;
    try { st = fs.lstatSync(q); } catch (e) { return; }
    if (st.isSymbolicLink()) return;
    if (st.isDirectory()) { for (const h of fs.readdirSync(q)) andar(path.join(q, h)); return; }
    total += st.size;
  };
  andar(p);
  return total;
}

// ───────────────────────── BUSCAR LA CARPETA DE DRIVE ─────────────────────────
/**
 * Dónde puede estar la carpeta local de Google Drive. Se DEVUELVEN todas las que
 * existan, con qué clase son — no se escoge una a ciegas.
 *
 * 🔑 La diferencia entre las dos clases decide si esto funciona o no:
 *  · «espejo» (mirror) — carpeta de verdad en el disco. Los archivos están ahí.
 *  · «al vuelo» (streaming) — una unidad de mentira (`G:`) donde los archivos son
 *    marcadores que se bajan cuando alguien los abre. **Ahí un proyecto no puede
 *    vivir**: git y npm abren miles de archivos y esperan que estén.
 *
 * Es PURA a propósito —se le pasan el entorno y un «¿existe?»— para que la prueba
 * pueda darle un PC de mentira sin tener Windows ni Drive delante. Un buscador que
 * nadie ha visto funcionar no es un buscador.
 */
function dondePuedeEstarDrive(env, existe) {
  const casa = env.USERPROFILE || env.HOME || '';
  const candidatos = [];
  const mete = (ruta, clase) => { if (ruta && existe(ruta)) candidatos.push({ ruta, clase }); };

  // Espejo: dentro de la carpeta del usuario.
  for (const n of ['Mi unidad', 'My Drive', 'Google Drive', 'GoogleDrive']) {
    if (casa) mete(path.join(casa, n), 'espejo');
  }
  // Al vuelo: una letra de unidad que Drive se inventa.
  for (const letra of ['G', 'H', 'I', 'J']) {
    for (const n of ['Mi unidad', 'My Drive']) mete(letra + ':\\' + n, 'al vuelo');
  }
  return candidatos;
}

// ────────────────── ¿ESTÁ TODO EN GITHUB? (esto es lo que PARA) ──────────────────
/**
 * Mira un repo y devuelve los motivos por los que NO se puede clonar sin perder algo.
 * Devuelve una lista vacía si está limpio.
 *
 * 🔑 Le pregunta AL SERVIDOR, no al `origin/main` de la máquina. Regla 4 del
 *  respaldo del dueño: «Se comprueba contra el servidor (`git ls-remote`), no contra
 *  el `origin/main` local, que puede estar viejo». Ya mintió una vez.
 */
function motivosParaNoMudar(dir, nombre) {
  const malas = [];
  if (!fs.existsSync(path.join(dir, '.git'))) return ['no es un repo de git'];

  const sucio = git(dir, ['status', '--porcelain', '--untracked-files=normal'])
    .split('\n').filter((l) => l.trim());
  if (sucio.length) {
    malas.push(sucio.length + ' archivo(s) sin guardar en git — un clon no los trae:\n' +
      sucio.slice(0, 12).map((l) => '        ' + l.trim()).join('\n') +
      (sucio.length > 12 ? '\n        … y ' + (sucio.length - 12) + ' más' : ''));
  }

  const stashes = git(dir, ['stash', 'list']).split('\n').filter((l) => l.trim());
  if (stashes.length) {
    malas.push(stashes.length + ' stash(es) guardados — un clon NO los trae, y no hay forma de' +
      ' recuperarlos después:\n' + stashes.map((l) => '        ' + l).join('\n'));
  }

  // Cada rama local, contra lo que el SERVIDOR dice tener.
  const enServidor = {};
  for (const linea of git(dir, ['ls-remote', '--heads', 'origin']).split('\n')) {
    const m = /^([0-9a-f]{40})\s+refs\/heads\/(.+)$/.exec(linea.trim());
    if (m) enServidor[m[2]] = m[1];
  }
  if (!Object.keys(enServidor).length) {
    malas.push('no se pudo hablar con el servidor de GitHub: sin eso no se sabe qué está respaldado');
    return malas;
  }
  for (const rama of git(dir, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']).split('\n')) {
    const r = rama.trim();
    if (!r) continue;
    const local = git(dir, ['rev-parse', r]).trim();
    if (!local) continue;
    if (enServidor[r] === local) continue;
    // Puede estar en otra rama ya empujada (una rama fusionada, por ejemplo).
    const cubierta = Object.values(enServidor).some((sha) => {
      const salida = git(dir, ['merge-base', '--is-ancestor', local, sha]);
      // `--is-ancestor` no imprime nada: sale con 0 si sí. git() devuelve '' en fallo,
      // así que se vuelve a preguntar de la forma que sí imprime.
      return salida !== null && git(dir, ['rev-list', '--count', local + '..' + sha]).trim() !== '' &&
        git(dir, ['rev-list', '--count', sha + '..' + local]).trim() === '0';
    });
    if (!cubierta) {
      const cuantos = git(dir, ['rev-list', '--count', r, '--not', '--remotes']).trim() || '?';
      malas.push('la rama «' + r + '» tiene ' + cuantos + ' commit(s) que el servidor NO tiene');
    }
  }
  return malas;
}

// ──────────── LO QUE EL CLON NO TRAE PORQUE EL .gitignore LO ESCONDE ────────────
/**
 * Archivos y carpetas que EXISTEN aquí, que git ignora, y que hacen falta.
 * No se busca una lista escrita a mano: se le pregunta a git cuáles ignora
 * (`git status --ignored`) y se descartan los que se vuelven a fabricar.
 *
 * 🔑 Así aparecen también los que nadie ha pensado todavía. Una lista a mano se
 *  queda vieja con el primer archivo nuevo, y entonces el hueco no lo dice nadie.
 */
const SE_VUELVEN_A_FABRICAR = ['node_modules', 'build', '.firebase', 'coverage', '.eslintcache'];

/**
 * ¿Esto se vuelve a fabricar, o hay que copiarlo?
 *
 * 🔴 SE MIRA CADA TRAMO DE LA RUTA, NO EL PRINCIPIO. La primera versión preguntaba
 *  `ruta.startsWith('node_modules/')`, y el SIMULACRO del 25-sep-2026 la desmintió
 *  en la primera corrida: git reporta `guajirago/node_modules/` y
 *  `guajirago/functions/node_modules/`, que no empiezan así. Iba a copiar
 *  **900 MB** a Drive — 405 MB + 88,5 MB de librerías y los dos repos hermanos
 *  enteros—. Y la prueba que debía cazarlo tenía el MISMO hueco: ponía los
 *  `node_modules` en la raíz, el único sitio donde el `startsWith` acertaba.
 *  Leerlo no lo habría enseñado; correrlo sí.
 *
 * Y los repos HERMANOS tampoco se copian: se clonan aparte, cada uno del suyo.
 * Copiarlos traería su `.git` a medias, que es justo como Dropbox corrompe un repo.
 */
function seVuelveAFabricar(ruta) {
  const tramos = ruta.replace(/[\\/]+$/, '').split(/[\\/]/);
  if (tramos.some((t) => SE_VUELVEN_A_FABRICAR.includes(t))) return true;
  return HERMANOS.includes(tramos[0]);
}

function loQueNoViaja(dir) {
  const salida = git(dir, ['status', '--porcelain', '--ignored=matching', '--untracked-files=normal']);
  const lista = [];
  for (const linea of salida.split('\n')) {
    if (!linea.startsWith('!!')) continue;
    let r = linea.slice(3).trim();
    if (r.startsWith('"') && r.endsWith('"')) r = r.slice(1, -1);
    if (seVuelveAFabricar(r)) continue;
    const abs = path.join(dir, r);
    if (!fs.existsSync(abs)) continue;
    lista.push({ ruta: r, bytes: pesoDe(abs) });
  }
  return lista;
}

// ─────────────────────────────── EL CAREO FINAL ───────────────────────────────
const huella = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/**
 * Compara, archivo por archivo y BYTE A BYTE, todo lo que git sigue en el origen
 * contra lo que quedó en el destino. No se le cree al clon: se le pregunta.
 */
function carear(origen, destino) {
  const seguidos = git(origen, ['ls-files', '-z']).split('\0').filter(Boolean);
  const iguales = [], distintos = [], faltan = [];
  for (const rel of seguidos) {
    const a = path.join(origen, rel), b = path.join(destino, rel);
    if (!fs.existsSync(b)) { faltan.push(rel); continue; }
    try { (huella(a) === huella(b) ? iguales : distintos).push(rel); }
    catch (e) { distintos.push(rel + ' (no se pudo leer: ' + e.message + ')'); }
  }
  return { total: seguidos.length, iguales, distintos, faltan };
}

// ─────────────────────────────── CLONAR EN SU RAMA ───────────────────────────────
/**
 * Clona un repo y SE PONE EN LA MISMA RAMA que tenía el origen.
 *
 * 🔴 ESTO SALIÓ DEL SIMULACRO (25-sep-2026), y era grave: `git clone` a secas trae
 *  **la rama por defecto del repo**, no la rama en la que se está trabajando. En la
 *  primera corrida la carpeta nueva quedó en `main`: **le faltaban dos archivos y
 *  tenía dos versiones viejas**, y no hubo un solo error — el clon había salido
 *  «bien». Lo cazó el careo byte a byte del final, que es justo para lo que está.
 *  Leyendo el código nadie lo habría visto.
 *
 * 🔑 Vive aquí fuera, y no dentro de `mudar()`, para que la prueba lo pueda
 *  ENCENDER contra un repo de mentira. Un arreglo que nadie ha visto funcionar
 *  vuelve solo, y éste ya se escapó una vez.
 *
 * Si la rama no está en el servidor —fusionada y borrada, por ejemplo— NO se calla
 * ni lo da por bueno: dice en qué rama quedó, y el careo del final lo confirma.
 */
function clonarEnSuRama(url, dir, quien, rama, hablar = say) {
  hablar('   clonando ' + quien + (rama ? ' (rama ' + rama + ')' : '') + '…');
  try {
    execFileSync('git', ['clone', url, dir], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  } catch (e) {
    hablar('   ' + C.rojo + '✗ ' + quien + ': ' + String(e.stderr || e.message).trim() + C.off);
    return false;
  }
  if (!rama || rama === 'HEAD') return true;
  const ahora = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (ahora === rama) return true;
  try {
    execFileSync('git', ['-C', dir, 'checkout', rama], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
    hablar('     ' + C.gris + 'puesto en ' + rama + C.off);
  } catch (e) {
    hablar('     ' + C.ama + '⚠ no se pudo poner en «' + rama + '»: quedó en «' + ahora +
      '». Si tu trabajo estaba en esa rama, el careo de abajo lo va a decir.' + C.off);
  }
  return true;
}

// ─────────────────────────────────── INFORME ───────────────────────────────────
function mirar() {
  say(C.neg + '🔍 ANTES DE MUDAR — qué hay y qué se perdería' + C.off);
  say('');

  const repos = [{ nombre: '(la raíz)', dir: RAIZ }];
  for (const h of HERMANOS) {
    const d = path.join(RAIZ, h);
    if (fs.existsSync(path.join(d, '.git'))) repos.push({ nombre: h, dir: d });
    else say(C.ama + '   ⚠ ' + h + ' no está en esta carpeta: no se puede mudar lo que no está' + C.off);
  }

  say(C.neg + '  LOS REPOS' + C.off);
  let paradas = 0;
  for (const r of repos) {
    const url = git(r.dir, ['remote', 'get-url', 'origin']).trim() || '(sin origin)';
    const rama = git(r.dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    const sha = git(r.dir, ['rev-parse', '--short', 'HEAD']).trim();
    say('   · ' + r.nombre.padEnd(20) + rama + ' @ ' + sha + C.gris + '  ' + url + C.off);
    const malas = motivosParaNoMudar(r.dir, r.nombre);
    for (const m of malas) { paradas++; say('     ' + C.rojo + '✗ ' + m + C.off); }
    if (!malas.length) say('     ' + C.verde + '✓ todo lo suyo está en GitHub' + C.off);
  }
  say('');

  say(C.neg + '  LO QUE UN CLON NO TRAE (git lo ignora, pero existe)' + C.off);
  let hayQueCopiar = 0;
  for (const r of repos) {
    for (const x of loQueNoViaja(r.dir)) {
      hayQueCopiar++;
      say('   · ' + C.ama + (r.nombre === '(la raíz)' ? '' : r.nombre + '/') + x.ruta + C.off +
        C.gris + '  ' + pesa(x.bytes) + C.off);
    }
  }
  if (!hayQueCopiar) say(C.gris + '   (nada: el clon trae todo lo que hace falta)' + C.off);
  else say(C.gris + '   Esto lo copia la mudanza aparte, después de clonar.' + C.off);
  say('');

  say(C.neg + '  LA CARPETA DE GOOGLE DRIVE' + C.off);
  const drives = dondePuedeEstarDrive(process.env, fs.existsSync);
  if (!drives.length) {
    say('   ' + C.rojo + '✗ no encontré ninguna' + C.off);
    say(C.gris + '     Instala «Google Drive para escritorio» y déjalo en modo ESPEJO, o dime la ruta:' + C.off);
    say(C.gris + '     node scripts/mudar-a-drive.cjs --mudar "C:\\ruta\\a\\tu\\Drive"' + C.off);
  }
  for (const d of drives) {
    const aviso = d.clase === 'al vuelo'
      ? C.rojo + '  🔴 AL VUELO — aquí un proyecto NO puede vivir' + C.off
      : C.verde + '  ✓ espejo (carpeta de verdad)' + C.off;
    say('   · ' + d.ruta + aviso);
  }
  say('');

  say(C.neg + '  CUÁNTO SE MUDA DE VERDAD' + C.off);
  let seguidos = 0;
  for (const r of repos) seguidos += git(r.dir, ['ls-files']).split('\n').filter(Boolean).length;
  say('   · archivos que git sigue, en los tres repos: ' + C.neg + seguidos + C.off);
  say('   · la carpeta entera de hoy pesa ' + C.neg + pesa(pesoDe(RAIZ)) + C.off +
    C.gris + ' — lo demás son librerías, y se vuelven a bajar' + C.off);
  say('');

  if (paradas) {
    say(C.rojo + C.neg + '✋ NO SE PUEDE MUDAR TODAVÍA — ' + paradas + ' motivo(s) arriba.' + C.off);
    say(C.gris + '   Un clon trae lo que está en GitHub y NADA MÁS. Lo de arriba no está, así que');
    say('   mudarse ahora lo borraría sin avisar. Primero se guarda y se empuja.' + C.off);
    return 1;
  }
  say(C.verde + C.neg + '✓ TODO LO DE LOS TRES REPOS ESTÁ EN GITHUB' + C.off + ' — la mudanza no perdería código.');
  say('');
  say(C.neg + '  Para mudar de verdad:' + C.off);
  const sugerida = drives.find((d) => d.clase === 'espejo');
  say('   node scripts/mudar-a-drive.cjs --mudar "' + (sugerida ? sugerida.ruta : 'C:\\ruta\\a\\tu\\Drive') + '"');
  say(C.gris + '   Va a crear ahí dentro «' + NOMBRE_DESTINO + '». No borra nada de lo viejo.' + C.off);
  return 0;
}

// ─────────────────────────────────── MUDAR ───────────────────────────────────
function mudar(carpetaDrive) {
  if (mirar() !== 0) return 1;
  say('');
  say(C.neg + '📦 MUDANDO' + C.off);

  if (!fs.existsSync(carpetaDrive)) {
    say(C.rojo + '✗ esa carpeta no existe: ' + carpetaDrive + C.off);
    return 1;
  }
  const destino = path.join(carpetaDrive, NOMBRE_DESTINO);
  const proyecto = path.join(destino, 'GuajiraGo');
  if (fs.existsSync(proyecto)) {
    say(C.rojo + '✗ ya existe ' + proyecto + C.off);
    say(C.gris + '   No se escribe encima de una carpeta que ya está: si es de un intento anterior,');
    say('   míralo tú y decide. Borrar por mi cuenta lo que no puse yo, no.' + C.off);
    return 1;
  }

  fs.mkdirSync(proyecto, { recursive: true });

  const raizUrl = git(RAIZ, ['remote', 'get-url', 'origin']).trim();
  const raizRama = git(RAIZ, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  fs.rmdirSync(proyecto); // git clone quiere la carpeta vacía o inexistente
  if (!clonarEnSuRama(raizUrl, proyecto, 'la raíz', raizRama)) return 1;

  for (const h of HERMANOS) {
    const d = path.join(RAIZ, h);
    if (!fs.existsSync(path.join(d, '.git'))) continue;
    const u = git(d, ['remote', 'get-url', 'origin']).trim();
    const r = git(d, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
    if (!clonarEnSuRama(u, path.join(proyecto, h), h, r)) return 1;
  }

  // Los papeles que no viajan, copiados uno por uno y nombrados.
  say('');
  say(C.neg + '  COPIANDO LO QUE EL CLON NO TRAE' + C.off);
  const repos = [{ nombre: '', dir: RAIZ }, ...HERMANOS.map((h) => ({ nombre: h, dir: path.join(RAIZ, h) }))];
  let copiados = 0;
  for (const r of repos) {
    if (!fs.existsSync(path.join(r.dir, '.git'))) continue;
    for (const x of loQueNoViaja(r.dir)) {
      const de = path.join(r.dir, x.ruta);
      const a = path.join(proyecto, r.nombre, x.ruta);
      try {
        fs.mkdirSync(path.dirname(a), { recursive: true });
        fs.cpSync(de, a, { recursive: true });
        say('   ' + C.verde + '✓' + C.off + ' ' + path.join(r.nombre, x.ruta));
        copiados++;
      } catch (e) {
        say('   ' + C.rojo + '✗ ' + path.join(r.nombre, x.ruta) + ': ' + e.message + C.off);
      }
    }
  }
  if (!copiados) say(C.gris + '   (no había nada que copiar)' + C.off);

  // ─────────── EL CAREO: no se le cree al clon, se le pregunta ───────────
  say('');
  say(C.neg + '  CAREO BYTE A BYTE contra la carpeta de hoy' + C.off);
  let malo = 0;
  for (const r of repos) {
    if (!fs.existsSync(path.join(r.dir, '.git'))) continue;
    const c = carear(r.dir, path.join(proyecto, r.nombre));
    const quien = r.nombre || '(la raíz)';
    const ok = c.distintos.length === 0 && c.faltan.length === 0;
    say('   ' + (ok ? C.verde + '✓' : C.rojo + '✗') + C.off + ' ' + quien.padEnd(20) +
      c.iguales.length + ' de ' + c.total + ' iguales' +
      (c.distintos.length ? C.rojo + '  · ' + c.distintos.length + ' DISTINTOS' + C.off : '') +
      (c.faltan.length ? C.rojo + '  · ' + c.faltan.length + ' FALTAN' + C.off : ''));
    for (const x of [...c.distintos.slice(0, 5), ...c.faltan.slice(0, 5)]) say('        ' + x);
    if (!ok) malo++;
  }

  say('');
  if (malo) {
    say(C.rojo + C.neg + '✋ LA MUDANZA NO CUADRA. No borres nada de lo viejo.' + C.off);
    return 1;
  }
  say(C.verde + C.neg + '✓ MUDADO Y CAREADO' + C.off + '  ' + proyecto);
  say('');
  say(C.neg + '  LO QUE FALTA, Y LO HACES TÚ' + C.off);
  say('   1. Dentro de la carpeta nueva: ' + C.neg + 'npm ci' + C.off + '  (y lo mismo en guajirago/ y');
  say('      en guajirago/functions/). Las librerías NO se mudan: se vuelven a bajar.');
  say('   2. ' + C.ama + 'Drive va a intentar sincronizar los node_modules' + C.off + ' — son ~170.000');
  say('      archivos. Si Drive deja excluirlos, excluyelos; si no, va a ir lento y hacer ruido.');
  say('   3. ' + C.rojo + 'NO abras esta carpeta desde dos máquinas a la vez.' + C.off + ' Drive no une');
  say('      cambios: deja copias («archivo (1).js») y nadie sabe cuál es la buena.');
  say('   4. La carpeta vieja ' + C.neg + 'sigue donde estaba' + C.off + '. Bórrala tú, cuando hayas');
  say('      trabajado un rato en la nueva y estés tranquilo. Yo no borro lo que no puse.');
  return 0;
}

if (require.main === module) {
  const i = process.argv.indexOf('--mudar');
  process.exit(i === -1 ? mirar() : mudar(process.argv[i + 1] || ''));
}

module.exports = {
  dondePuedeEstarDrive, motivosParaNoMudar, loQueNoViaja, carear,
  seVuelveAFabricar, clonarEnSuRama, NOMBRE_DESTINO, SE_VUELVEN_A_FABRICAR, HERMANOS,
};
