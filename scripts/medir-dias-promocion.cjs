#!/usr/bin/env node
/**
 * ¿QUÉ DÍAS VALE LA PROMOCIÓN DEL RESTAURANTE? «Lun, Mié, Vie» — gemelo G87 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-dias-promocion.cjs            <- el código del disco
 *   node scripts/medir-dias-promocion.cjs --antes    <- y el careo con el código de antes (d1cbe51 / 3673808 / 0f89437)
 *   node scripts/medir-dias-promocion.cjs --nube     <- y además qué días tienen GUARDADOS las promociones de los negocios
 *
 * Una promoción de restaurante con `programacion: 'dias'` guarda en `dias` los números del día de la semana
 * (0 = domingo … 6 = sábado, los de `Date.getDay()`). Ese contrato lo usan TRES sitios:
 *   · APP · la tarjeta de la promo   — «Lun, Mié» bajo la oferta (guajirago/src/Restaurantes.js, vigenciaTxt);
 *   · ALIADOS · la lista de promos   — «📅 Lun, Mié» en la pantalla Promociones (guajirago-aliados/src/Promociones.js, progTxt);
 *   · ALIADOS · el selector de días  — los botones L M M J V S D al crear o editar la promo (el mismo Promociones.js).
 * Antes de G87 el mapa número → nombre (DOW_TXT) estaba escrito a mano DOS veces, y la lista de botones una tercera.
 * Desde G87 vive en guajirago/src/diasSemana.js, con copia IDÉNTICA en guajirago-aliados/src/diasSemana.js.
 *
 * Qué hace: busca en las TRES apps todo mapa de días escrito a mano ('Lun' y 'Mié' juntos, o la lista de letras), y para
 * cada sitio SACA del archivo la función (o la lista de botones) y la CORRE con unos casos. Dice además con qué reloj
 * decide la app «¿vale hoy?» (hallazgo aparte: no es de este gemelo).
 * Con --nube lee los negocios y cuenta sus promociones por `programacion` y los `dias` guardados: solo valores y
 * cantidades. No escribe nada. Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo } = require('../pruebas/cargar.cjs');
const { lector } = require('./medir-conexion-firebase.cjs');

const ANTES = { raiz: 'd1cbe51', aliados: '3673808', admin: '0f89437' }; // los últimos commits antes de G87
const PIEZA_APP = 'guajirago/src/diasSemana.js';
const PIEZA_ALIADOS = 'guajirago-aliados/src/diasSemana.js';
const RESTAURANTES = 'guajirago/src/Restaurantes.js';
const PROMOCIONES = 'guajirago-aliados/src/Promociones.js';
const CARPETAS = ['guajirago/src', 'guajirago-aliados/src', 'guajirago-admin/src'];
// Los casos: días sueltos, varios desordenados, toda la semana, y lo raro (texto, fuera de rango, vacío).
const CASOS = [[1], [0], [6], [3, 1, 5], [5, 6, 0], [1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5, 6], ['2'], [7], [1, 9], []];
const nombreCaso = (c) => JSON.stringify(c);

function argumento(nombre) { return process.argv.includes(nombre); }

function archivosDe(carpeta, commits) {
  const repo = carpeta.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : carpeta.startsWith('guajirago-admin/') ? 'guajirago-admin' : null;
  const commit = commits && (repo === 'guajirago-aliados' ? commits.aliados : repo === 'guajirago-admin' ? commits.admin : commits.raiz);
  if (!commit) return fs.readdirSync(path.join(RAIZ, carpeta)).filter((f) => f.endsWith('.js')).map((f) => carpeta + '/' + f);
  const cwd = repo ? path.join(RAIZ, repo) : RAIZ;
  const dentro = repo ? carpeta.slice(repo.length + 1) : carpeta;
  const salida = execFileSync('git', ['ls-tree', '--name-only', commit, dentro + '/'], { cwd, encoding: 'utf8' });
  return salida.split('\n').filter((f) => f.endsWith('.js')).map((f) => (repo ? repo + '/' : '') + f);
}

/** Sin comentarios, con los mismos renglones y finales LF. */
function limpio(texto) {
  return soloCodigo(texto.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' ')));
}

/** Mapas o listas de días escritos a mano: un { … } o [ … ] con 'Lun' y 'Mié', o siete pares número-letra [[1, 'L'] … [0, 'D']]. */
function aManoEn(texto) {
  const t = limpio(texto);
  const out = [];
  const nota = (m) => out.push({ texto: m[0].replace(/\s+/g, ' ').slice(0, 120), renglon: t.slice(0, m.index).split('\n').length });
  for (const re of [/\[[^[\]]*\]/g, /\{[^{}]*\}/g]) {
    for (const m of t.matchAll(re)) if (/['"`]Lun['"`]/.test(m[0]) && /['"`]Mi[eé]['"`]/.test(m[0])) nota(m);
  }
  // Siete pares [número, 'Letra'] seguidos: la lista de botones, sea cual sea la letra que lleve cada uno.
  const par = String.raw`\[\s*\d\s*,\s*['"${'`'}][A-ZÁÉÍÓÚ]['"${'`'}]\s*\]`;
  for (const m of t.matchAll(new RegExp(String.raw`\[\s*` + par + String.raw`(?:\s*,\s*` + par + String.raw`){6}\s*\]`, 'g'))) nota(m);
  return out;
}

/** Ejecuta una expresión con unos nombres a la mano (no se lee a ojo). */
function evaluar(expr, nombres) {
  const k = Object.keys(nombres);
  // eslint-disable-next-line no-new-func
  return new Function(...k, 'return (' + expr + ');')(...k.map((x) => nombres[x]));
}

/** Desde la llave que abre en `desde`, hasta la que la cierra (las funciones medidas no llevan llaves dentro de textos). */
function hastaSuLlave(t, desde) {
  let n = 0;
  for (let i = desde; i < t.length; i++) {
    if (t[i] === '{') n += 1;
    else if (t[i] === '}') { n -= 1; if (n === 0) return t.slice(desde, i + 1); }
  }
  return null;
}

/**
 * Lo que un archivo tiene a mano: lo que importa de ./diasSemana (cargado) y su DOW_TXT local.
 * Devuelve { nombres, origen }.
 */
function nombresDe(ruta, t, leer, problemas) {
  const nombres = {};
  let origen = 'a mano';
  const imp = t.match(/import \{([^}]*)\} from '\.\/diasSemana';/);
  if (imp) {
    const de = path.posix.dirname(ruta) + '/diasSemana.js';
    const texto = leer(de);
    let pieza = null;
    try { pieza = texto == null ? null : cargarDeLaApp(de, texto); } catch (e) { problemas.push(de + ' no carga: ' + e.message); }
    for (const n of imp[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      if (!pieza || !(n in pieza)) problemas.push(ruta + ': importa ' + n + ' de ' + de + ' y allí no está');
      else nombres[n] = pieza[n];
      const usos = (t.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
      if (usos < 2) problemas.push(ruta + ': importa ' + n + ' y no lo usa');
    }
    origen = de;
  }
  const loc = t.match(/const (DOW_TXT)\s*=\s*(\{[^{}]*\});/);
  if (loc) {
    try { nombres.DOW_TXT = evaluar(loc[2], {}); } catch (e) { problemas.push(ruta + ': su DOW_TXT no se deja ejecutar'); }
    if (imp) origen = 'mezclado';
  }
  return { nombres, origen };
}

/** Saca `const <nombre> = (p) => { … };` del archivo y la devuelve como función, con los nombres del archivo a mano. */
function funcionDe(ruta, t, nombre, nombres, problemas) {
  const m = new RegExp('const ' + nombre + '\\s*=\\s*\\(p\\)\\s*=>\\s*\\{').exec(t);
  if (!m) { problemas.push(ruta + ': no encuentro ' + nombre); return null; }
  const cuerpo = hastaSuLlave(t, m.index + m[0].length - 1);
  let g;
  try { g = evaluar('(p) => ' + cuerpo, nombres); } catch (e) { problemas.push(ruta + ': ' + nombre + ' no se deja ejecutar: ' + e.message); return null; }
  // Si revienta al correrla (un nombre que no existe, por ejemplo), se dice y se sigue: un fallo no es un texto vacío.
  let dicho = false;
  return (p) => {
    try { return g(p); } catch (e) {
      if (!dicho) { problemas.push(ruta + ': ' + nombre + ' revienta al correrla: ' + e.message); dicho = true; }
      return '(falla)';
    }
  };
}

/** Los botones de días de aliados: la lista que se recorre dentro de `programacion === 'dias' && (`, y qué número y letra da cada uno. */
function botonesDe(ruta, t, nombres, problemas) {
  const ini = t.indexOf("{programacion === 'dias' && (");
  if (ini < 0) { problemas.push(ruta + ': no encuentro los botones de días'); return null; }
  const trozo = t.slice(ini, ini + 1500);
  const m = trozo.match(/\{(\[[^\n]*?\]\]|\w+)\.map\(\(?(\[\s*\w+\s*,\s*\w+\s*\]|\{[^}]*\})\)?\s*=>/);
  if (!m) { problemas.push(ruta + ': no entiendo cómo se pintan los botones de días'); return null; }
  let lista;
  try { lista = /^\w+$/.test(m[1]) ? nombres[m[1]] : evaluar(m[1], {}); } catch (e) { lista = null; }
  if (!Array.isArray(lista)) { problemas.push(ruta + ': los botones usan ' + m[1] + ' y no sé de dónde sale'); return null; }
  // Los nombres que la plantilla usa son `d` (el número que se guarda) y `t` (la letra que se ve).
  let par;
  try { par = evaluar('(' + m[2] + ') => [d, t]', {}); } catch (e) { problemas.push(ruta + ': los botones no dan d y t'); return null; }
  return lista.map((x) => par(x));
}

function pieza(texto) { return texto == null ? null : texto.replace(/\r\n/g, '\n'); }

/** Mide un estado del código. `commits` = null (el disco) o { raiz, aliados, admin }; `cambios` pisa archivos. */
function medir(commits, cambios = {}) {
  const base = lector(commits || {});
  const leer = (r) => (Object.prototype.hasOwnProperty.call(cambios, r) ? cambios[r] : base(r));
  const problemas = [];

  // 1 · La pieza y su copia.
  const pApp = pieza(leer(PIEZA_APP));
  const pAli = pieza(leer(PIEZA_ALIADOS));
  const piezas = {};
  for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
    const t = leer(ruta);
    if (t == null) continue;
    try { piezas[ruta] = cargarDeLaApp(ruta, t); } catch (e) { problemas.push(ruta + ' no carga: ' + e.message); }
  }

  // 2 · Lo escrito a mano en las TRES apps (fuera de la pieza).
  const aMano = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosDe(carpeta, commits)) {
      if (r === PIEZA_APP || r === PIEZA_ALIADOS) continue;
      const t = leer(r);
      if (t == null) continue;
      for (const l of aManoEn(t)) aMano.push({ archivo: r, renglon: l.renglon, texto: l.texto });
    }
  }

  // 3 · Lo que dice cada sitio, CORRIDO con los casos. El «📅 » de aliados es adorno: se compara sin él.
  const sitios = {};
  const promo = (dias) => ({ programacion: 'dias', dias });
  const tRes = leer(RESTAURANTES);
  const tPro = leer(PROMOCIONES);
  if (tRes == null) problemas.push('no está ' + RESTAURANTES);
  if (tPro == null) problemas.push('no está ' + PROMOCIONES);
  let reloj = null;
  if (tRes != null) {
    const t = limpio(tRes);
    const u = nombresDe(RESTAURANTES, t, leer, problemas);
    const f = funcionDe(RESTAURANTES, t, 'vigenciaTxt', u.nombres, problemas);
    sitios['APP · la tarjeta de la promo'] = { archivo: RESTAURANTES, origen: u.origen, dice: f ? CASOS.map((c) => f(promo(c))) : null };
    const hoy = t.match(/const dow\s*=\s*([^;\n]+);/);
    reloj = hoy ? hoy[1].trim() : '(no encuentro cómo se calcula el día de hoy)';
  }
  if (tPro != null) {
    const t = limpio(tPro);
    const u = nombresDe(PROMOCIONES, t, leer, problemas);
    const f = funcionDe(PROMOCIONES, t, 'progTxt', u.nombres, problemas);
    sitios['ALIADOS · la lista de promos'] = {
      archivo: PROMOCIONES, origen: u.origen, dice: f ? CASOS.map((c) => String(f(promo(c))).replace(/^📅 /, '')) : null,
    };
    const b = botonesDe(PROMOCIONES, t, u.nombres, problemas);
    sitios['ALIADOS · el selector de días'] = {
      archivo: PROMOCIONES, origen: u.origen, botones: b ? b.map(([d, l]) => d + '=' + l) : null,
      // Cada botón: el número que guarda y la letra que se ve; `cuadra` = esa letra es la inicial del nombre que
      // la lista de promos dice de ese mismo número (si no, el dueño toca «L» y la promo dice «Mar»).
      cuadra: b && f ? b.map(([d, l]) => String(f(promo([d]))).replace(/^📅 /, '').charAt(0) === l) : null,
    };
  }

  // 4 · ¿Dicen lo mismo? Para cada caso, los textos de los sitios que escriben nombres.
  const conTexto = Object.entries(sitios).filter(([, s]) => s.dice);
  const porCaso = CASOS.map((c, i) => {
    const vistos = {};
    for (const [n, s] of conTexto) vistos[n] = s.dice[i];
    return { caso: nombreCaso(c), vistos, iguales: new Set(Object.values(vistos)).size === 1 };
  });

  // 5 · El selector: los siete días, cada número una vez, y cada letra la inicial del nombre de su número.
  const sel = sitios['ALIADOS · el selector de días'];
  const selectorBien = !!(sel && sel.botones && sel.cuadra) && (() => {
    const nums = sel.botones.map((x) => Number(x.split('=')[0]));
    return nums.length === 7 && new Set(nums).size === 7 && nums.every((n) => n >= 0 && n <= 6) && sel.cuadra.every(Boolean);
  })();

  const piezaApp = piezas[PIEZA_APP];
  return {
    commits: commits || 'el disco', problemas, piezas, copiasIguales: !!pApp && pApp === pAli,
    aMano, sitios, porCaso, distintos: porCaso.filter((x) => !x.iguales), selectorBien, reloj,
    textoPieza: piezaApp && piezaApp.diasTxt,
  };
}

/** Careo: lo que dice cada sitio en cada caso, antes y ahora (y los botones del selector). */
function carear(antes, ahora) {
  const diferencias = [];
  let comparaciones = 0;
  for (let i = 0; i < CASOS.length; i++) {
    for (const n of Object.keys(ahora.porCaso[i].vistos)) {
      comparaciones += 1;
      const a = antes.porCaso[i].vistos[n];
      const b = ahora.porCaso[i].vistos[n];
      if (a !== b) diferencias.push({ caso: nombreCaso(CASOS[i]), sitio: n, antes: a, ahora: b });
    }
  }
  const s = 'ALIADOS · el selector de días';
  comparaciones += 1;
  const ba = JSON.stringify(antes.sitios[s] && antes.sitios[s].botones);
  const bb = JSON.stringify(ahora.sitios[s] && ahora.sitios[s].botones);
  if (ba !== bb) diferencias.push({ caso: 'los botones', sitio: s, antes: ba, ahora: bb });
  return { comparaciones, diferencias };
}

/** Cuenta las promociones guardadas en los negocios (ya leídos con nube.doc). `decir` = cómo se nombran sus días. */
function contarGuardados(negocios, decir) {
  const porProgramacion = {};
  const porDias = {};
  const raros = [];
  let conPromos = 0;
  let promos = 0;
  for (const n of negocios) {
    const lista = Array.isArray(n.promociones) ? n.promociones : [];
    if (lista.length) conPromos += 1;
    for (const p of lista) {
      promos += 1;
      const prog = (p && p.programacion) || '(sin campo)';
      porProgramacion[prog] = (porProgramacion[prog] || 0) + 1;
      if (prog !== 'dias') continue;
      const dias = Array.isArray(p.dias) ? p.dias : [];
      const k = JSON.stringify(dias);
      if (!porDias[k]) porDias[k] = { dias: k, cuantos: 0, activas: 0, dice: decir(dias) };
      porDias[k].cuantos += 1;
      if (p.activa) porDias[k].activas += 1;
      for (const d of dias) if (!(typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6)) raros.push(k);
      if (!dias.length) raros.push(k);
    }
  }
  return { negocios: negocios.length, conPromos, promos, porProgramacion, porDias: Object.values(porDias), raros };
}

module.exports = {
  medir, carear, contarGuardados, aManoEn, ANTES, PIEZA_APP, PIEZA_ALIADOS, RESTAURANTES, PROMOCIONES, CASOS, nombreCaso,
};

if (require.main === module) {
  (async () => {
    const pintar = (titulo, m) => {
      console.log('\n── ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : Object.values(m.commits).join(' / ')) + ')');
      console.log('   Mapas o listas de días escritos a mano (fuera de la pieza): ' + m.aMano.length);
      for (const l of m.aMano) console.log('     · ' + l.archivo + ':' + l.renglon + '  ' + l.texto);
      console.log('   La pieza en la app (' + PIEZA_APP + '): ' + (m.piezas[PIEZA_APP] ? JSON.stringify(m.piezas[PIEZA_APP].DIAS_SEMANA) : 'no existe'));
      console.log('   La copia en aliados (' + PIEZA_ALIADOS + '): ' + (m.piezas[PIEZA_ALIADOS] ? 'existe' : 'no existe'));
      console.log('   ¿Las dos copias son IGUALES letra por letra? ' + (m.copiasIguales ? 'sí' : 'no (o no existen)'));
      for (const [n, s] of Object.entries(m.sitios)) console.log('   ' + n.padEnd(30) + ' ← ' + s.origen + (s.botones ? '  · botones ' + s.botones.join(' ') : ''));
      console.log('   ¿El selector ofrece los 7 días, del 0 al 6, una vez cada uno y con la letra de su nombre? ' + (m.selectorBien ? 'sí' : 'NO'));
      console.log('   Caso'.padEnd(26) + Object.keys(m.porCaso[0].vistos).map((n) => n.padEnd(34)).join(''));
      for (const x of m.porCaso) {
        console.log('   ' + (x.iguales ? '  ' : '≠ ') + x.caso.padEnd(21) + Object.values(x.vistos).map((v) => ('«' + v + '»').padEnd(34)).join(''));
      }
      console.log('   Casos donde los sitios dicen lo MISMO: ' + (m.porCaso.length - m.distintos.length) + ' de ' + m.porCaso.length);
      console.log('   La app decide «¿vale hoy?» con: ' + m.reloj + (/getDay\(\)/.test(m.reloj || '') ? '  ⚠ el reloj y la zona del TELÉFONO (hallazgo aparte, no es de G87)' : ''));
      if (m.problemas.length) console.log('   ⚠ ' + m.problemas.join('\n   ⚠ '));
    };

    const ahora = medir(null);
    console.log('\n=== ¿QUÉ DÍAS VALE LA PROMOCIÓN? · G87 · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===');
    pintar('AHORA', ahora);

    if (argumento('--antes')) {
      const antes = medir(ANTES);
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n── CAREO: ' + c.comparaciones + ' comparaciones (caso × sitio, y los botones), ' + c.diferencias.length + ' distintas');
      for (const d of c.diferencias) console.log('   · ' + d.caso + ' · ' + d.sitio + ': antes «' + d.antes + '» · ahora «' + d.ahora + '»');
    }

    if (argumento('--nube')) {
      const { traer, doc, tiposQueNoSupe } = require('./nube.cjs');
      const negocios = (await traer('negocios')).map(doc);
      const decir = (dias) => {
        const f = ahora.sitios['APP · la tarjeta de la promo'];
        if (!f || !f.dice) return '(no se pudo)';
        const i = CASOS.findIndex((c) => JSON.stringify(c) === JSON.stringify(dias));
        if (i >= 0) return f.dice[i];
        return ahora.textoPieza ? ahora.textoPieza(dias) : '(caso no medido)';
      };
      const r = contarGuardados(negocios, decir);
      console.log('\n── PRODUCCIÓN: ' + r.negocios + ' negocios leídos, ' + r.conPromos + ' con promociones, ' + r.promos + ' promociones');
      console.log('   Por programación: ' + (Object.entries(r.porProgramacion).map(([k, n]) => k + ' ' + n).join(' · ') || 'ninguna'));
      for (const f of r.porDias) console.log('   dias = ' + f.dias.padEnd(22) + String(f.cuantos).padStart(3) + ' (' + f.activas + ' activas)  se dice «' + f.dice + '»');
      console.log('   Promociones «por días» con días fuera de 0..6, de otro tipo o vacíos: ' + r.raros.length + (r.raros.length ? ' (' + r.raros.join(', ') + ')' : ''));
      if (tiposQueNoSupe().length) console.log('   ⚠ tipos de campo que no supe leer: ' + tiposQueNoSupe().join(', '));
    }

    const ok = ahora.problemas.length === 0 && ahora.aMano.length === 0 && ahora.copiasIguales && ahora.distintos.length === 0 && ahora.selectorBien;
    console.log('\n' + (ok ? '✓ una sola lista de días de la semana, en la pieza y su copia atada' : '✗ los días de la promoción NO salen de una sola pieza'));
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
