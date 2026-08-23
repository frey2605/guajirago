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
function renglones(repo) {
  const diff = git(repo, ['diff', '--unified=0', '--no-color', '--no-ext-diff', 'HEAD']);
  const porArchivo = {};
  let actual = null;
  for (const linea of diff.split('\n')) {
    const m = /^\+\+\+ b\/(.*)$/.exec(linea);
    if (m) {
      actual = aRaiz(repo, m[1]);
      if (!porArchivo[actual]) porArchivo[actual] = { mas: [], menos: [] };
      continue;
    }
    if (!actual) continue;
    if (linea.startsWith('+++') || linea.startsWith('---')) continue;
    if (linea.startsWith('+')) porArchivo[actual].mas.push(linea.slice(1));
    else if (linea.startsWith('-')) porArchivo[actual].menos.push(linea.slice(1));
  }
  return porArchivo;
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

  const archivos = [...new Set(sitios.map((s) => s.split(':')[0].replace(/\\/g, '/')))];
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
      if (declarados.has(c.ruta)) {
        say('   ' + C.verde + '✓' + C.off + ' ' + c.ruta.padEnd(52) + ' ' + marca);
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
        if (antes && antes !== ahora[ruta] && !declarados.has(ruta) && !previos.has(ruta) && !vistos.has(ruta)) {
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
