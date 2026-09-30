#!/usr/bin/env node
/**
 * ¿CÓMO SE COBRA UN TOUR? «por persona / por grupo / por día / por hora» — gemelo G86 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-unidades-tour.cjs            <- el código del disco
 *   node scripts/medir-unidades-tour.cjs --antes    <- y el careo con el código de antes (703a088 / 6bbe95d / 0f89437)
 *   node scripts/medir-unidades-tour.cjs --nube     <- y además qué unidades tienen GUARDADAS los tours y las reservas
 *
 * La unidad del precio de un tour (el campo `unidadPrecio`: 'persona', 'grupo', 'dia' u 'hora') la dicen TRES sitios:
 *   · APP · la tarjeta del tour     — «$ 80.000 por persona» en la lista de tours de la agencia (guajirago/src/Turismo.js);
 *   · ALIADOS · la lista de tours   — lo mismo en la pantalla «Tours» de la agencia (guajirago-aliados/src/Tours.js);
 *   · ALIADOS · el selector         — las opciones que la agencia escoge al crear o editar un tour (el mismo Tours.js).
 * Antes de G86 la lista (valor guardado + cómo se dice) estaba escrita a mano DOS veces: un diccionario en Turismo.js y
 * la lista UNIDADES en Tours.js. Desde G86 vive en guajirago/src/unidadesTour.js, con copia IDÉNTICA en
 * guajirago-aliados/src/unidadesTour.js (otro repo, no puede importarla).
 *
 * Qué hace: busca en las TRES apps toda lista o diccionario escrito a mano con 'por persona' y 'por grupo', y para cada
 * sitio CARGA lo que de verdad usa (lo suyo a mano, o la pieza que importa, ejecutándola) y lo CORRE con unos casos.
 * Dice también dónde se hace la CUENTA del precio que depende de la unidad (`unidadPrecio === ...`).
 * Con --nube lee los negocios (sus `tours`) y las `reservasTurismo`, y cuenta las unidades guardadas: solo valores y
 * cantidades, nada de clientes. No escribe nada. Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo } = require('../pruebas/cargar.cjs');
const { lector } = require('./medir-conexion-firebase.cjs');

const ANTES = { raiz: '703a088', aliados: '6bbe95d', admin: '0f89437' }; // los últimos commits antes de G86
const PIEZA_APP = 'guajirago/src/unidadesTour.js';
const PIEZA_ALIADOS = 'guajirago-aliados/src/unidadesTour.js';
const TURISMO = 'guajirago/src/Turismo.js';
const TOURS = 'guajirago-aliados/src/Tours.js';
const CARPETAS = ['guajirago/src', 'guajirago-aliados/src', 'guajirago-admin/src'];
const FUNCIONES = 'guajirago/functions/index.js';
// Los casos con que se corre cada sitio: las cuatro de siempre y lo raro (sin campo, vacío, con tilde, en mayúscula, otra).
const CASOS = ['persona', 'grupo', 'dia', 'hora', undefined, null, '', 'día', 'Persona', 'noche'];
const nombreCaso = (c) => (c === undefined ? '(sin campo)' : c === null ? 'null' : c === '' ? '(vacío)' : c);

function argumento(nombre) { return process.argv.includes(nombre); }

/** Los .js de una carpeta: del disco, o del commit de su repo. */
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

/** Las listas o diccionarios de unidades escritos a mano: un [ … ] o un { … } con 'por persona' y 'por grupo'. */
function aManoEn(texto) {
  const t = limpio(texto);
  const out = [];
  for (const re of [/\[[^[\]]*\]/g, /\{[^{}]*\}/g]) {
    for (const m of t.matchAll(re)) {
      if (/['"`]por persona['"`]/.test(m[0]) && /['"`]por grupo['"`]/.test(m[0])) {
        out.push({ texto: m[0].replace(/\s+/g, ' '), renglon: t.slice(0, m.index).split('\n').length });
      }
    }
  }
  return out;
}

/** Ejecuta una expresión con unos nombres a la mano (no se lee a ojo). */
function evaluar(expr, nombres) {
  const k = Object.keys(nombres);
  // eslint-disable-next-line no-new-func
  return new Function(...k, 'return (' + expr + ');')(...k.map((x) => nombres[x]));
}

/**
 * Lo que un archivo tiene a mano para decir la unidad: lo que importa de ./unidadesTour (cargado), sus UNIDADES* locales
 * y su `unidadTxt` local. Devuelve { nombres, texto (función o null), selector (lista usada en <option> o null), origen }.
 */
function queUsa(ruta, t0, leer, problemas) {
  const t = limpio(t0);
  const nombres = {};
  let origen = 'a mano';
  const imp = t.match(/import \{([^}]*)\} from '\.\/unidadesTour';/);
  if (imp) {
    const de = path.posix.dirname(ruta) + '/unidadesTour.js';
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
  for (const m of t.matchAll(/const (UNIDADES\w*)\s*=\s*(\[[^[\]]*\]);/g)) {
    try { nombres[m[1]] = evaluar(m[2], {}); } catch (e) { problemas.push(ruta + ': ' + m[1] + ' no se deja ejecutar'); }
  }
  let texto = null;
  const loc = t.match(/const unidadTxt\s*=\s*(.+);[ \t]*$/m);
  if (loc) {
    try { texto = evaluar(loc[1], nombres); } catch (e) { problemas.push(ruta + ': su unidadTxt no se deja ejecutar'); }
    if (imp && /\bunidadTxt\b/.test(imp[1])) problemas.push(ruta + ': importa unidadTxt y además escribe uno propio');
  } else if (typeof nombres.unidadTxt === 'function') {
    texto = nombres.unidadTxt;
  }
  let selector = null;
  const sel = t.match(/\{\s*(\w+)\.map\(\s*\(?(\w+)\)?\s*=>\s*<option/);
  if (sel) {
    if (!Array.isArray(nombres[sel[1]])) problemas.push(ruta + ': el selector usa ' + sel[1] + ' y no sé de dónde sale');
    else selector = nombres[sel[1]];
  }
  if (!loc && !imp) origen = 'ninguno';
  return { nombres, texto, selector, origen };
}

/** El bloque de la pieza (el archivo entero, LF): las dos copias se comparan letra por letra. */
function pieza(texto) { return texto == null ? null : texto.replace(/\r\n/g, '\n'); }

/**
 * Mide un estado del código. `commits` = null (el disco) o { raiz, aliados, admin }; `cambios` pisa archivos
 * (pantallas de mentira para la prueba).
 */
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

  // 3 · Lo que dice cada sitio, CORRIDO con los casos.
  const sitios = {};
  const tTur = leer(TURISMO);
  const tTours = leer(TOURS);
  if (tTur == null) problemas.push('no está ' + TURISMO);
  if (tTours == null) problemas.push('no está ' + TOURS);
  if (tTur != null) {
    const u = queUsa(TURISMO, tTur, leer, problemas);
    if (!u.texto) problemas.push('APP · la tarjeta del tour: no encuentro con qué dice la unidad');
    sitios['APP · la tarjeta del tour'] = { archivo: TURISMO, origen: u.origen, dice: u.texto ? CASOS.map((c) => u.texto(c)) : null };
  }
  if (tTours != null) {
    const u = queUsa(TOURS, tTours, leer, problemas);
    if (!u.texto) problemas.push('ALIADOS · la lista de tours: no encuentro con qué dice la unidad');
    if (!u.selector) problemas.push('ALIADOS · el selector: no encuentro qué opciones ofrece');
    sitios['ALIADOS · la lista de tours'] = { archivo: TOURS, origen: u.origen, dice: u.texto ? CASOS.map((c) => u.texto(c)) : null };
    const op = u.selector || [];
    sitios['ALIADOS · el selector'] = {
      archivo: TOURS, origen: u.origen, opciones: op.map((o) => o.k + '=' + o.t),
      dice: u.selector ? CASOS.map((c) => { const o = op.find((x) => x.k === c); return o ? o.t : ''; }) : null,
    };
  }

  // 4 · ¿Dicen lo mismo? Para cada caso, los textos de los tres sitios.
  const porCaso = CASOS.map((c, i) => {
    const vistos = {};
    for (const [n, s] of Object.entries(sitios)) vistos[n] = s.dice ? s.dice[i] : '(no se pudo)';
    return { caso: nombreCaso(c), vistos, iguales: new Set(Object.values(vistos)).size === 1 };
  });

  // 5 · Dónde se hace la CUENTA que depende de la unidad (y el panel / las funciones, por si nombran la unidad).
  const cuentas = [];
  const nombranUnidad = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosDe(carpeta, commits)) {
      const t0 = leer(r);
      if (t0 == null) continue;
      const t = limpio(t0);
      t.split('\n').forEach((l, i) => { if (/unidadPrecio\s*[!=]==?\s*['"`]/.test(l)) cuentas.push(r + ':' + (i + 1) + '  ' + l.trim()); });
      // (Inventario.js de aliados tiene su propia UNIDADES —g, kg, ml…—: es otra cosa, no la unidad del tour.)
      if (r !== PIEZA_APP && r !== PIEZA_ALIADOS && /\bunidadPrecio\b|\bunidadTxt\b|\bUNIDADES_PRECIO\b/.test(t)) nombranUnidad.push(r);
    }
  }
  const tFun = leer(FUNCIONES);
  if (tFun && /\bunidadPrecio\b/.test(limpio(tFun))) nombranUnidad.push(FUNCIONES);

  const textoPieza = piezas[PIEZA_APP] && piezas[PIEZA_APP].unidadTxt;
  return {
    commits: commits || 'el disco', problemas, piezas, copiasIguales: !!pApp && pApp === pAli,
    aMano, sitios, porCaso, distintos: porCaso.filter((x) => !x.iguales), cuentas, nombranUnidad, textoPieza,
  };
}

/** Careo: lo que dice cada sitio en cada caso, antes y ahora. */
function carear(antes, ahora) {
  const diferencias = [];
  let comparaciones = 0;
  for (let i = 0; i < CASOS.length; i++) {
    for (const n of Object.keys(ahora.sitios)) {
      comparaciones += 1;
      const a = antes.porCaso[i].vistos[n];
      const b = ahora.porCaso[i].vistos[n];
      if (a !== b) diferencias.push({ caso: nombreCaso(CASOS[i]), sitio: n, antes: a, ahora: b });
    }
  }
  return { comparaciones, diferencias };
}

/**
 * Cuenta las unidades guardadas en tours (de los negocios) y reservas, ya leídos con nube.doc. `decir` es la función
 * de la pieza: lo que dé '' es un valor que NINGUNA pantalla sabe nombrar.
 */
function contarGuardados(negocios, reservas, decir) {
  const filas = {};
  const sumar = (donde, v, extra) => {
    const nombre = v === undefined ? '(sin campo)' : v === null ? 'null' : v === '' ? '(vacío)' : String(v);
    const k = donde + ' · ' + nombre;
    if (!filas[k]) filas[k] = { donde, valor: nombre, cuantos: 0, dice: decir(v), extra: {} };
    filas[k].cuantos += 1;
    if (extra) filas[k].extra[extra] = (filas[k].extra[extra] || 0) + 1;
  };
  let agencias = 0;
  for (const n of negocios) {
    const tours = Array.isArray(n.tours) ? n.tours : [];
    if (tours.length) agencias += 1;
    for (const t of tours) sumar('tour', t && t.unidadPrecio, (t && t.tipo) || 'tour');
  }
  for (const r of reservas) sumar('reserva', r.unidadPrecio, r.estado || '(sin estado)');
  const lista = Object.values(filas).sort((a, b) => a.donde.localeCompare(b.donde) || b.cuantos - a.cuantos);
  return { filas: lista, agencias, sinNombre: lista.filter((f) => !f.dice) };
}

module.exports = {
  medir, carear, contarGuardados, aManoEn, queUsa, ANTES, PIEZA_APP, PIEZA_ALIADOS, TURISMO, TOURS, CASOS, nombreCaso,
};

if (require.main === module) {
  (async () => {
    const pintar = (titulo, m) => {
      console.log('\n── ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : Object.values(m.commits).join(' / ')) + ')');
      console.log('   Listas o diccionarios de unidades escritos a mano (fuera de la pieza): ' + m.aMano.length);
      for (const l of m.aMano) console.log('     · ' + l.archivo + ':' + l.renglon + '  ' + l.texto);
      console.log('   La pieza en la app (' + PIEZA_APP + '): ' + (m.piezas[PIEZA_APP] ? JSON.stringify(m.piezas[PIEZA_APP].UNIDADES_PRECIO) : 'no existe'));
      console.log('   La copia en aliados (' + PIEZA_ALIADOS + '): ' + (m.piezas[PIEZA_ALIADOS] ? 'existe' : 'no existe'));
      console.log('   ¿Las dos copias son IGUALES letra por letra? ' + (m.copiasIguales ? 'sí' : 'no (o no existen)'));
      for (const [n, s] of Object.entries(m.sitios)) console.log('   ' + n.padEnd(28) + ' ← ' + s.origen + (s.opciones ? '  · opciones ' + s.opciones.join(', ') : ''));
      console.log('   Caso'.padEnd(18) + Object.keys(m.sitios).map((n) => n.padEnd(30)).join(''));
      for (const x of m.porCaso) {
        console.log('   ' + (x.iguales ? '  ' : '≠ ') + x.caso.padEnd(13) + Object.values(x.vistos).map((v) => ('«' + v + '»').padEnd(30)).join(''));
      }
      console.log('   Casos donde los tres sitios dicen lo MISMO: ' + (m.porCaso.length - m.distintos.length) + ' de ' + m.porCaso.length);
      console.log('   La CUENTA que depende de la unidad está en:');
      for (const c of m.cuentas) console.log('     · ' + c);
      console.log('   Archivos que nombran la unidad: ' + m.nombranUnidad.join(', '));
      if (m.problemas.length) console.log('   ⚠ ' + m.problemas.join('\n   ⚠ '));
    };

    const ahora = medir(null);
    console.log('\n=== ¿CÓMO SE COBRA UN TOUR? · G86 · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===');
    pintar('AHORA', ahora);

    if (argumento('--antes')) {
      const antes = medir(ANTES);
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n── CAREO: ' + c.comparaciones + ' comparaciones (caso × sitio), ' + c.diferencias.length + ' distintas');
      for (const d of c.diferencias) console.log('   · ' + d.caso + ' · ' + d.sitio + ': antes «' + d.antes + '» · ahora «' + d.ahora + '»');
    }

    if (argumento('--nube')) {
      const { traer, doc, tiposQueNoSupe } = require('./nube.cjs');
      const negocios = (await traer('negocios')).map(doc);
      const reservas = (await traer('reservasTurismo')).map(doc);
      const decir = ahora.textoPieza || ((s) => (Object.values(ahora.sitios)[0] || { dice: [] }).dice[CASOS.indexOf(s)] || '');
      const r = contarGuardados(negocios, reservas, decir);
      console.log('\n── PRODUCCIÓN: ' + negocios.length + ' negocios leídos (' + r.agencias + ' con tours), ' + reservas.length + ' reservas de turismo');
      for (const f of r.filas) {
        console.log('   ' + (f.donde + ' unidadPrecio = «' + f.valor + '»').padEnd(44) + String(f.cuantos).padStart(4) + '  se dice «' + f.dice + '»'
          + '  ' + Object.entries(f.extra).map(([t, n]) => t + ':' + n).join(' '));
      }
      console.log('   Valores guardados que NINGUNA pantalla sabe nombrar: ' + r.sinNombre.length
        + (r.sinNombre.length ? ' (' + r.sinNombre.map((f) => f.donde + ' «' + f.valor + '» ×' + f.cuantos).join(', ') + ')' : ''));
      if (tiposQueNoSupe().length) console.log('   ⚠ tipos de campo que no supe leer: ' + tiposQueNoSupe().join(', '));
    }

    const ok = ahora.problemas.length === 0 && ahora.aMano.length === 0 && ahora.copiasIguales && ahora.distintos.length === 0;
    console.log('\n' + (ok ? '✓ una sola lista de unidades del tour, en la pieza y su copia atada' : '✗ la unidad del tour NO sale de una sola pieza'));
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
