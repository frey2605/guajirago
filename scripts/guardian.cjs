#!/usr/bin/env node
/**
 * GUARDIÁN — graba la promesa antes de tocar y la revisa al final.
 *
 *   node scripts/guardian.cjs foto "qué se arregla" <sitio> [<sitio>...]
 *   node scripts/guardian.cjs revisar
 *   node scripts/guardian.cjs estado
 *
 * Un <sitio> es  ruta/archivo.js:funcion  (o solo ruta/archivo.js).
 * Se declara el SITIO, no solo el archivo.
 *
 * Mira los TRES repos por separado: guajirago-admin y guajirago-aliados están
 * en el .gitignore de la raíz y son repos APARTE — un git status normal NO los ve.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..');
const FOTO = path.join(RAIZ, '.guardian-foto.json');
const EXCEPCIONES = path.join(RAIZ, '.guardian-excepciones.log');
const CONFIG = path.join(RAIZ, '.guardian.json');

// La raíz ya cubre guajirago/ (sus archivos están rastreados por la raíz).
// NO se usa guajirago/.git: es un repo anidado viejo en la rama v2.1 (ver TRAMPAS en CLAUDE.md).
const REPOS = ['.', 'guajirago-admin', 'guajirago-aliados'];

// Papeles del propio guardián: son del sistema, no del arreglo. Jamás cuentan como violación.
const PROPIOS = new Set(['.guardian-foto.json', '.guardian-excepciones.log', '.guardian.json']);

const C = { rojo: '\x1b[31m', verde: '\x1b[32m', ama: '\x1b[33m', gris: '\x1b[90m', neg: '\x1b[1m', off: '\x1b[0m' };
const say = (s) => process.stdout.write((s === undefined ? '' : s) + '\n');

function git(repo, args) {
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, repo), ...args], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    return '';
  }
}

const existeRepo = (repo) => fs.existsSync(path.join(RAIZ, repo, '.git'));
const reposVivos = () => REPOS.filter(existeRepo);

/** Ruta relativa a la RAÍZ, siempre con barras normales. */
function aRaiz(repo, rutaRepo) {
  const p = repo === '.' ? rutaRepo : repo + '/' + rutaRepo;
  return p.replace(/\\/g, '/');
}

/** Archivos cambiados de un repo: [{ruta, marca}] con ruta relativa a la RAÍZ. */
function cambiados(repo) {
  const out = git(repo, ['status', '--porcelain', '--untracked-files=all']);
  const lista = [];
  for (const linea of out.split('\n')) {
    if (!linea.trim()) continue;
    const marca = linea.slice(0, 2).trim() || '??';
    let ruta = linea.slice(3).trim();
    if (ruta.startsWith('"') && ruta.endsWith('"')) ruta = ruta.slice(1, -1);
    if (ruta.includes(' -> ')) ruta = ruta.split(' -> ')[1]; // renombrados
    if (repo === '.' && PROPIOS.has(ruta)) continue;         // los papeles del guardián no cuentan
    lista.push({ ruta: aRaiz(repo, ruta), marca });
  }
  return lista;
}

/** Renglones agregados y quitados por archivo, desde el diff del repo. */
// 🔴 LOS ARCHIVOS NUEVOS NO LOS VE `git diff HEAD`, Y AHÍ ESTABA LA PUERTA DE
//  ATRÁS DEL DETECTOR DE CÓDIGO MOVIDO (medido el 24-sep-2026).
//
//  `git diff HEAD` compara contra el último commit, y un archivo que git todavía
//  no sigue no aparece en esa comparación. Así que sus renglones nunca entraban
//  en la lista de AÑADIDOS, y el detector no podía encontrar dónde reaparecieron
//  los que se habían quitado de otro sitio.
//
//  Resultado, y está demostrado ejecutándolo: se movieron 747 renglones de un
//  archivo a trece archivos nuevos y el guardián NO DIJO NADA — cuando el día
//  antes había parado el trabajo por SEIS renglones movidos entre dos archivos
//  ya seguidos. O sea: para esquivar el candado bastaba con mover el código a un
//  archivo nuevo.
//
//  Se cierra leyendo los archivos que git ve como «sin seguir» y metiendo sus
//  renglones como AÑADIDOS, que es lo que son.
function archivosNuevos(repo) {
  const out = git(repo, ['ls-files', '--others', '--exclude-standard']);
  const nuevos = [];
  for (const cruda of out.split('\n')) {
    const ruta = cruda.trim();
    if (!ruta) continue;
    if (repo === '.' && PROPIOS.has(ruta)) continue; // los papeles del guardián no cuentan
    const abs = path.join(RAIZ, repo === '.' ? '' : repo, ruta);
    try {
      const st = fs.statSync(abs);
      if (!st.isFile()) continue;
      // Un archivo enorme o binario no se lee: no es código movido, y leerlo
      // costaría más que lo que protege. Se ANOTA, no se calla (REGLA 9).
      if (st.size > 2 * 1024 * 1024) { SIN_MIRAR.push(ruta + ' (pesa demasiado)'); continue; }
      const crudo = fs.readFileSync(abs);
      if (crudo.includes(0)) { SIN_MIRAR.push(ruta + ' (es binario)'); continue; }
      nuevos.push({ ruta, contenido: crudo.toString('utf8') });
    } catch (e) {
      SIN_MIRAR.push(ruta + ' (no se pudo leer: ' + e.message + ')');
    }
  }
  return nuevos;
}

// Los archivos nuevos que el guardián NO pudo mirar. Si queda alguno, el
// detector está ciego ahí y hay que decirlo en vez de firmar en verde.
const SIN_MIRAR = [];

/**
 * Junta los renglones del diff con los de los archivos nuevos.
 *
 * Es PURA a propósito: recibe el texto del diff y los archivos nuevos ya
 * leídos, así que la prueba puede darle casos de mentira sin tocar git. Un
 * detector que nadie ha visto quejarse no es un detector.
 */
function juntarRenglones(diff, nuevos, aRuta) {
  const porArchivo = {};
  const dame = (r) => {
    if (!porArchivo[r]) porArchivo[r] = { mas: [], menos: [] };
    return porArchivo[r];
  };
  let actual = null;
  for (const linea of diff.split('\n')) {
    const m = /^\+\+\+ b\/(.*)$/.exec(linea);
    if (m) { actual = aRuta(m[1]); dame(actual); continue; }
    if (!actual) continue;
    if (linea.startsWith('+++') || linea.startsWith('---')) continue;
    if (linea.startsWith('+')) dame(actual).mas.push(linea.slice(1));
    else if (linea.startsWith('-')) dame(actual).menos.push(linea.slice(1));
  }
  // Un archivo nuevo es, entero, «renglones añadidos». Se le quita el último
  // salto para no inventar un renglón vacío que no existe en el archivo.
  for (const n of nuevos) {
    const r = dame(aRuta(n.ruta));
    for (const l of n.contenido.replace(/\n$/, '').split('\n')) r.mas.push(l);
  }
  return porArchivo;
}

function renglones(repo) {
  const diff = git(repo, ['diff', '--unified=0', '--no-color', '--no-ext-diff', 'HEAD']);
  return juntarRenglones(diff, archivosNuevos(repo), (r) => aRaiz(repo, r));
}

const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

/** Huella de todo lo rastreado: caza cambios en archivos que git no reporte. */
function huellas(repo) {
  const lista = git(repo, ['ls-files', '-z']).split('\0').filter(Boolean);
  const h = {};
  for (const rel of lista) {
    const abs = path.join(RAIZ, repo, rel);
    try {
      h[aRaiz(repo, rel)] = sha(fs.readFileSync(abs));
    } catch (e) {
      h[aRaiz(repo, rel)] = 'AUSENTE';
    }
  }
  return h;
}

function leerConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  } catch (e) {
    return {};
  }
}

/** Corre las pruebas si hay comando configurado. Sin comando NO inventa: lo dice. */
function correrPruebas() {
  const cfg = leerConfig();
  if (!cfg.pruebas) return { hay: false, ok: null };
  try {
    execFileSync(cfg.pruebas, {
      cwd: RAIZ, encoding: 'utf8', shell: true,
      maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { hay: true, ok: true };
  } catch (e) {
    return { hay: true, ok: false };
  }
}

/**
 * ¿Está este archivo declarado? Devuelve `true` si se declaró POR SU NOMBRE, la
 * carpeta que lo cubre si entró por una carpeta, y `false` si no está.
 *
 * 🔑 Se distinguen los dos casos a propósito. Declarar una carpeta es una
 * promesa más floja que declarar un archivo: dice «voy a tocar aquí dentro» sin
 * decir qué. Eso vale cuando los nombres nacen del trabajo, pero SOLO si se ve.
 * Una carpeta que no se enseña es una carpeta que esconde.
 */
function cubrePor(ruta, declarados) {
  if (declarados.has(ruta)) return true;
  for (const d of declarados) {
    if (d.endsWith('/') && ruta.startsWith(d)) return d;
  }
  return false;
}

// ─────────────────────────────── FOTO ───────────────────────────────
function foto(argv) {
  const descripcion = (argv[0] || '').trim();
  const sitios = argv.slice(1).filter(Boolean);
  if (!descripcion || sitios.length === 0) {
    say(C.rojo + 'Falta la promesa.' + C.off);
    say('  node scripts/guardian.cjs foto "qué se arregla" archivo.js:funcion [más sitios...]');
    say(C.gris + '  Se declara el SITIO, no solo el archivo.' + C.off);
    process.exit(1);
  }

  // 🔴 SE PUEDEN DECLARAR CARPETAS (24-sep-2026). Hasta hoy había que nombrar
  //  cada archivo, y hay trabajos en los que los NOMBRES NACEN DEL TRABAJO: al
  //  partir un documento en trece, los nombres salen de sus propios títulos y no
  //  se pueden saber antes. Ese día la foto declaró `plan/` y el guardián paró
  //  13 veces por archivos que estaban DENTRO de lo declarado.
  //  Una carpeta se escribe con barra al final (`plan/`), y también se reconoce
  //  sola si lo que se declaró ya existe y es una carpeta.
  const archivos = [...new Set(sitios.map((s) => {
    const r = s.split(':')[0].replace(/\\/g, '/');
    if (r.endsWith('/')) return r;
    try {
      if (fs.statSync(path.join(RAIZ, r)).isDirectory()) return r + '/';
    } catch (e) { /* no existe todavía: se trata como archivo, y el aviso de abajo lo dirá */ }
    return r;
  }))];
  const faltantes = archivos.filter((a) => !fs.existsSync(path.join(RAIZ, a)));

  const estado = {};
  for (const repo of reposVivos()) {
    estado[repo] = {
      head: git(repo, ['rev-parse', 'HEAD']).trim(),
      rama: git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
      suciosPrevios: cambiados(repo).map((c) => c.ruta),
      huellas: huellas(repo),
    };
  }

  const pruebas = correrPruebas();
  const datos = {
    descripcion, sitios, archivos,
    fecha: new Date().toISOString(),
    estado,
    pruebasBase: { hay: pruebas.hay, ok: pruebas.ok },
  };
  fs.writeFileSync(FOTO, JSON.stringify(datos, null, 2));

  say(C.verde + C.neg + '📸 FOTO GRABADA' + C.off + '  ' + descripcion);
  say(C.gris + '   sitios declarados:' + C.off);
  for (const s of sitios) say('     · ' + s);
  if (faltantes.length) {
    say(C.ama + '   ⚠ no existen todavía (¿archivos nuevos?): ' + C.off + faltantes.join(', '));
  }
  for (const repo of reposVivos()) {
    const e = estado[repo];
    const sucio = e.suciosPrevios.length;
    const extra = sucio ? '  (' + sucio + ' ya sucios, no cuentan)' : '';
    say(C.gris + '   ' + repo.padEnd(20) + ' ' + e.rama + ' @ ' + e.head.slice(0, 7) + extra + C.off);
  }
  if (!pruebas.hay) {
    say(C.ama + '   ⚠ sin pruebas configuradas: el paso 5 no se puede cumplir (ver .guardian.json)' + C.off);
  } else {
    say(C.gris + '   pruebas base: ' + (pruebas.ok ? 'pasaban' : 'YA FALLABAN antes de tocar') + C.off);
  }
}

// ────────────────────────────── REVISAR ─────────────────────────────
function revisar() {
  if (!fs.existsSync(FOTO)) {
    say(C.rojo + C.neg + '✋ SIN FOTO — no se puede revisar.' + C.off);
    say(C.gris + '   Sin declaración previa el guardián no deja seguir. Corre "foto" antes de tocar.' + C.off);
    process.exit(1);
  }
  const f = JSON.parse(fs.readFileSync(FOTO, 'utf8'));
  const declarados = new Set(f.archivos);
  //  Los archivos que entraron por una CARPETA y no por su nombre. Se cuentan
  //  aparte a propósito: una carpeta es una promesa más floja que un archivo, y
  //  si no se enseña, esconde. Enseñarla es lo que la hace aceptable.
  const porCarpeta = [];
  const paradas = [];
  const avisos = [];

  say(C.neg + '🔍 REVISIÓN' + C.off + '  ' + f.descripcion);
  say(C.gris + '   foto del ' + new Date(f.fecha).toLocaleString('es-CO') + C.off);
  say('');

  const todosMas = [];
  const todosMenos = [];
  let totalTocados = 0;

  for (const repo of reposVivos()) {
    const base = f.estado[repo];
    const previos = new Set(base ? base.suciosPrevios : []);
    const hoy = cambiados(repo);
    const rens = renglones(repo);

    if (base && base.head !== git(repo, ['rev-parse', 'HEAD']).trim()) {
      avisos.push(repo + ': el HEAD cambió desde la foto (¿un commit a mitad de trabajo?)');
    }

    for (const c of hoy) {
      if (previos.has(c.ruta)) continue; // ya estaba sucio antes de la foto: no cuenta
      totalTocados++;
      const r = rens[c.ruta] || { mas: [], menos: [] };
      for (const t of r.mas) todosMas.push({ ruta: c.ruta, texto: t });
      for (const t of r.menos) todosMenos.push({ ruta: c.ruta, texto: t });
      const cuenta = '+' + r.mas.length + ' -' + r.menos.length;
      const marca = C.gris + cuenta + '  [' + c.marca + ']' + C.off;
      const carpeta = cubrePor(c.ruta, declarados);
      if (carpeta) {
        const nota = carpeta === true ? '' : C.gris + '  (por la carpeta ' + carpeta + ')' + C.off;
        if (carpeta !== true) porCarpeta.push(c.ruta + ' ← ' + carpeta);
        say('   ' + C.verde + '✓' + C.off + ' ' + c.ruta.padEnd(52) + ' ' + marca + nota);
      } else {
        say('   ' + C.rojo + '✗' + C.off + ' ' + c.ruta.padEnd(52) + ' ' + marca);
        paradas.push('ARCHIVO FUERA DE LA LISTA: ' + c.ruta);
      }
    }

    // Cambio que git no reporta (permisos, .gitignore, etc.) pero la huella delata
    if (base && base.huellas) {
      const ahora = huellas(repo);
      const vistos = new Set(hoy.map((c) => c.ruta));
      for (const ruta of Object.keys(ahora)) {
        const antes = base.huellas[ruta];
        if (antes && antes !== ahora[ruta] && !cubrePor(ruta, declarados) && !previos.has(ruta) && !vistos.has(ruta)) {
          paradas.push('CAMBIO INVISIBLE A GIT: ' + ruta);
        }
      }
    }
  }

  if (totalTocados === 0) say('   ' + C.gris + '(ningún archivo tocado todavía)' + C.off);

  // Código movido: un renglón sano que desaparece de un sitio y reaparece igual en otro
  const trivial = (t) => t.trim().length < 25 || /^[\s{}()[\];,]*$/.test(t);
  const movidos = [];
  for (const m of todosMenos) {
    if (trivial(m.texto)) continue;
    const gemelo = todosMas.find((a) => a.texto.trim() === m.texto.trim() && a.ruta !== m.ruta);
    if (gemelo) movidos.push(m.ruta + ' → ' + gemelo.ruta + ': ' + m.texto.trim().slice(0, 60));
  }
  if (movidos.length) {
    say('');
    for (const mv of [...new Set(movidos)].slice(0, 10)) {
      say('   ' + C.rojo + '⇄ CÓDIGO MOVIDO' + C.off + ' ' + C.gris + mv + C.off);
      paradas.push('CÓDIGO MOVIDO DE SITIO: ' + mv.split(':')[0]);
    }
  }

  // Pruebas: una que pasaba y ahora falla es "moviste código que ya funcionaba"
  say('');
  const pr = correrPruebas();
  if (!pr.hay) {
    say('   ' + C.ama + '⚠ SIN PRUEBAS' + C.off + ' — el paso 5 no se está cumpliendo.');
    say('   ' + C.gris + '  Configura {"pruebas":"<comando>"} en .guardian.json.' + C.off);
    avisos.push('no hay pruebas que ejecuten lo tocado');
  } else if (f.pruebasBase.ok && !pr.ok) {
    say('   ' + C.rojo + C.neg + '✗ UNA PRUEBA QUE PASABA AHORA FALLA' + C.off);
    paradas.push('ROMPISTE ALGO QUE YA FUNCIONABA (prueba en verde → en rojo)');
  } else if (pr.ok) {
    say('   ' + C.verde + '✓ pruebas en verde' + C.off);
  } else {
    say('   ' + C.ama + '⚠ pruebas en rojo, pero ya lo estaban antes de tocar' + C.off);
  }

  // Veredicto
  say('');
  // 🔴 Los archivos nuevos que no se pudieron leer dejan CIEGO al detector de
  //  código movido justo ahí. Callarlo sería firmar en verde una zona que nadie
  //  miró, que es peor que no tener detector (REGLA 9).
  // Una carpeta declarada no puede esconder: se dice cuántos entraron por ella
  // y cuáles. Quien lea el veredicto tiene que poder ver qué se prometió de
  // verdad y qué se dio por bueno por estar en la misma carpeta.
  if (porCarpeta.length) {
    say('');
    say(C.gris + '   entraron por una CARPETA declarada, no por su nombre:' + C.off);
    for (const x of porCarpeta.slice(0, 20)) say(C.gris + '     · ' + x + C.off);
    if (porCarpeta.length > 20) say(C.gris + '     … y ' + (porCarpeta.length - 20) + ' más' + C.off);
    avisos.push(porCarpeta.length + ' archivo(s) entraron por una carpeta declarada, no por su '
      + 'nombre: la promesa fue más floja de lo normal');
  }
  for (const x of SIN_MIRAR) avisos.push('archivo nuevo que NO se pudo mirar: ' + x
    + ' — el detector de código movido está ciego ahí');
  for (const a of avisos) say('   ' + C.ama + '⚠ ' + a + C.off);
  if (paradas.length) {
    say('');
    say(C.rojo + C.neg + '✋ SE PARA EL TRABAJO — ' + paradas.length + ' motivo(s):' + C.off);
    for (const p of [...new Set(paradas)]) say('   ' + C.rojo + '·' + C.off + ' ' + p);
    say('');
    say(C.gris + '   Si de verdad hacía falta salirse de la lista: se pide permiso al dueño');
    say('   y se anota en ' + path.basename(EXCEPCIONES) + ' con fecha y motivo.' + C.off);
    process.exit(1);
  }
  say(C.verde + C.neg + '✓ LO TOCADO CUADRA CON LO PROMETIDO' + C.off + '  ' + C.gris + '(' + totalTocados + ' archivo(s))' + C.off);
  if (fs.existsSync(EXCEPCIONES)) {
    const n = fs.readFileSync(EXCEPCIONES, 'utf8').split('\n').filter((l) => l.trim()).length;
    if (n) say(C.ama + '   escapes anotados hasta hoy: ' + n + C.off);
  }
}

function estado() {
  if (!fs.existsSync(FOTO)) {
    say(C.gris + 'Sin foto grabada.' + C.off);
    return;
  }
  const f = JSON.parse(fs.readFileSync(FOTO, 'utf8'));
  say(C.neg + 'Promesa vigente:' + C.off + ' ' + f.descripcion);
  say(C.gris + 'del ' + new Date(f.fecha).toLocaleString('es-CO') + C.off);
  for (const s of f.sitios) say('  · ' + s);
}

// 🔴 SIN ESTA GUARDA, `require()` EJECUTABA EL GUARDIÁN — y sin argumentos
//  imprime la ayuda y hace `process.exit(1)`, o sea que MATA al que lo cargue.
//  Por eso el guardián no tenía ni una prueba propia: no se podía cargar. Y un
//  vigilante que nadie vigila es el único sitio donde un fallo vive tranquilo.
if (require.main === module) {
  const modo = process.argv[2];
  const resto = process.argv.slice(3);
  if (modo === 'foto') foto(resto);
  else if (modo === 'revisar') revisar();
  else if (modo === 'estado') estado();
  else {
    say('Guardián — graba la promesa antes de tocar y la revisa al final.');
    say('  node scripts/guardian.cjs foto "qué se arregla" <archivo:funcion> [...]');
    say('  node scripts/guardian.cjs revisar');
    say('  node scripts/guardian.cjs estado');
    process.exit(1);
  }
}

module.exports = { juntarRenglones, cubrePor };
