#!/usr/bin/env node
/**
 * MEDIR LA LEY DEL BOTÓN — botón por botón, en las TRES apps. Solo lee código; no toca nada.
 *
 *   node scripts/medir-ley-boton.cjs            <- el informe, archivo por archivo
 *   node scripts/medir-ley-boton.cjs --detalle  <- y cada botón, con su renglón
 *
 * ── LA LEY (Jhon, 26-sep-2026, traída de Talaria) ────────────────────────────
 * Todo lo que al tocarlo guarda, envía o cambia algo (onClick, onSubmit, onChange) pasa por el candado
 * (`useAccion` → `src/candado.js`): una sola vez aunque se toque dos, dice su palabra mientras trabaja, dice la verdad
 * al final, «Cancelar» no se toca mientras trabaja, y nunca queda trabado.
 *
 * ── CÓMO MIRA, y por qué así ─────────────────────────────────────────────────
 * La ley de Talaria revisaba la PANTALLA entera: si el archivo usaba el candado una vez, un segundo botón sin
 * candado pasaba. Las trampas del 26-sep-2026 lo demostraron (cinco de cinco salieron en verde). Aquí se mira
 * CADA manejador:
 *   · ¿llega a una escritura? Una escritura de Firebase escrita ahí mismo, o una función del archivo que llegue a
 *     una (se sigue la cadena), o una función IMPORTADA de otro archivo de la app que llegue a una (esa lista se
 *     saca leyendo la app, no se copia a mano).
 *   · si llega, ¿pasa por `correr(`? Si no, es un botón sin candado.
 * Y el «guardando» hecho a mano se caza por lo que HACE, no por cómo se llama: dentro de una función que escribe,
 * un `setAlgo(true)` antes de escribir y un `setAlgo(false)` después. La de Talaria solo lo cazaba si se llamaba
 * «ocupado».
 *
 * ── LO QUE YA ESTABA ANTES DE LA LEY ─────────────────────────────────────────
 * `PENDIENTES` lleva, archivo por archivo, cuántos botones sin candado y cuántos «guardando» a mano había el día
 * que nació la ley. La prueba exige que la cuenta de hoy sea EXACTAMENTE esa: si aparece uno nuevo se pone roja,
 * y si se arregla uno y nadie baja la cuenta, también. Así la lista solo puede bajar, y bajar a la vista.
 */
const fs = require('node:fs');
const path = require('node:path');
const { sinTextos, RAIZ } = require('../pruebas/cargar.cjs');

// Sin comentarios, pero con los MISMOS renglones: `soloCodigo` de cargar.cjs se come los comentarios de bloque
// enteros y los renglones del informe salían corridos (un botón del renglón 1675 se reportaba en el 1667).
const soloCodigo = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => l.replace(/^(\s*)\/\/.*/, (x, s) => s + ' '.repeat(x.length - s.length))).join('\n');

const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const LA_PIEZA = ['candado.js', 'useAccion.js'];
// La base, las funciones de la nube, el almacén de fotos, y la cuenta (crear, entrar, borrar, cambiar la clave):
// todo lo que con un doble toque se hace dos veces, o que puede fallar y hay que decirlo.
const ESCRIBE = /\b(addDoc|updateDoc|setDoc|deleteDoc|runTransaction|writeBatch|httpsCallable|uploadBytes|uploadBytesResumable|uploadString|deleteObject|createUserWithEmailAndPassword|signInWithEmailAndPassword|deleteUser|updatePassword|updateEmail|updateProfile|sendPasswordResetEmail|sendEmailVerification|reauthenticateWithCredential)\s*\(/;
const NO_SON_NOMBRES = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'await', 'async', 'function', 'new', 'typeof', 'const', 'let', 'var', 'true', 'false', 'null', 'undefined', 'e', 'x']);

// Hasta la llave que cierra, contando llaves sobre el texto SIN textos (una llave dentro de un texto no descuadra).
function hastaCerrar(seguro, abre) {
  let hondo = 0;
  for (let i = abre; i < seguro.length; i++) {
    if (seguro[i] === '{') hondo++;
    else if (seguro[i] === '}') { hondo--; if (hondo === 0) return i; }
  }
  return seguro.length - 1;
}

// Las funciones del archivo: nombre → cuerpo. Flechas (con o sin llaves, con o sin useCallback) y `function`.
const DONDE = new WeakMap(); // dónde está cada función, para saber cuál es la más interna que contiene un renglón
function funcionesDe(codigo, seguro) {
  const f = new Map();
  const donde = [];
  const re = /(?:\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:useCallback\(\s*)?(?:async\s*)?(?:\([^()]*(?:\([^()]*\)[^()]*)*\)|[A-Za-z_$][\w$]*)\s*=>)|(?:\bfunction\s+([A-Za-z_$][\w$]*)\s*\()/g;
  let m;
  while ((m = re.exec(seguro))) {
    const nombre = m[1] || m[2];
    let i = m.index + m[0].length;
    if (m[2]) { // function nombre( … ) { … }: se salta la lista de parámetros
      let hondo = 1;
      while (i < seguro.length && hondo > 0) { if (seguro[i] === '(') hondo++; else if (seguro[i] === ')') hondo--; i++; }
      i = seguro.indexOf('{', i);
    } else {
      while (/\s/.test(seguro[i])) i++;
    }
    let fin;
    if (seguro[i] === '{') fin = hastaCerrar(seguro, i) + 1;
    else { // flecha sin llaves: hasta el fin del renglón o del punto y coma
      const k = seguro.slice(i).search(/;|\n/);
      fin = k < 0 ? seguro.length : i + k;
    }
    f.set(nombre, codigo.slice(i, fin));
    donde.push({ nombre, ini: i, fin });
  }
  DONDE.set(f, donde);
  return f;
}

const nombresEn = (trozo) => [...sinTextos(trozo).matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].map((m) => m[1]).filter((n) => !NO_SON_NOMBRES.has(n));

// ¿Este trozo llega a una escritura? ¿Y pasa por correr(? Siguiendo la cadena de funciones del archivo.
function alcance(trozo, locales, importados, visto = new Set()) {
  let escribe = ESCRIBE.test(trozo);
  let candado = /\bcorrer\s*\(/.test(trozo);
  for (const n of nombresEn(trozo)) {
    if (visto.has(n)) continue;
    visto.add(n);
    if (locales.has(n)) {
      const r = alcance(locales.get(n), locales, importados, visto);
      escribe = escribe || r.escribe;
      candado = candado || r.candado;
    } else if (importados.has(n)) escribe = true;
  }
  return { escribe, candado };
}

// Los nombres importados en el archivo (los de `import { a, b as c } from './x'` y `import d from './x'`).
function importadosDe(codigo) {
  const n = new Set();
  for (const m of codigo.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]\.{1,2}\/[^'"]+['"]/g)) {
    for (const p of m[1].replace(/[{}]/g, ',').split(',')) {
      const nombre = p.trim().split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(nombre)) n.add(nombre);
    }
  }
  return n;
}

// Las entradas de un archivo: [{ evento, linea, trozo, ini }]. Dos clases:
//   · el valor entre llaves de CUALQUIER `on…={…}` (onClick, onSubmit, onChange, y los de las ventanitas propias:
//     onConfirmar, onGuardar…);
//   · una función del archivo PASADA a otro sitio sin llamarla ahí (`filaToggle('🔊', 'Sonido', sonido, cambiarSonido)`):
//     la llama un botón que no se ve desde aquí. Sin esto, los interruptores de Configuración pasaban por debajo.
function entradasDe(codigo, seguro, locales) {
  const out = [];
  const tramos = [];
  const linea = (i) => seguro.slice(0, i).split('\n').length;
  for (const m of seguro.matchAll(/\b(on[A-Z]\w*)=\{/g)) {
    const abre = m.index + m[0].length - 1;
    const fin = hastaCerrar(seguro, abre);
    tramos.push([abre, fin]);
    out.push({ evento: m[1], ini: m.index, linea: linea(m.index), trozo: codigo.slice(abre + 1, fin) });
  }
  for (const n of locales.keys()) {
    if (/^[A-Z]/.test(n)) continue; // una pantalla (componente) no es un botón
    for (const m of seguro.matchAll(new RegExp('(^|[^\\w$.])' + n.replace(/\$/g, '\\$') + '(?![\\w$])', 'g'))) {
      const i = m.index + m[1].length;
      if (tramos.some(([a, b]) => a < i && i < b)) continue; // ya lo cuenta su `on…=`
      const despues = seguro.slice(i + n.length).match(/^\s*([^\s])/);
      if (despues && /[(=:.]/.test(despues[1])) continue; // se llama, se define, o es una clave
      // Cuenta solo si se le ENTREGA a otra pieza de la pantalla: `algunaProp={n}`, o como argumento de una
      // función del propio archivo (el interruptor). Pasada a setInterval o a la lista de un useEffect es automática.
      const antes = seguro.slice(0, i).replace(/\s+$/, '');
      if (/\w=\{$/.test(antes)) { out.push({ evento: 'entregada a', ini: i, linea: linea(i), trozo: n }); continue; }
      if (!/[(,]$/.test(antes)) continue;
      let hondo = 0;
      let k = antes.length - 1;
      for (; k >= 0; k--) {
        const c = antes[k];
        if (')]}'.includes(c)) hondo++;
        else if ('([{'.includes(c)) { if (hondo === 0) break; hondo--; }
      }
      if (k < 0 || antes[k] !== '(') continue;
      const quien = (antes.slice(0, k).match(/([A-Za-z_$][\w$]*)\s*$/) || [])[1];
      if (quien && locales.has(quien) && quien !== n) out.push({ evento: 'entregada a ' + quien, ini: i, linea: linea(i), trozo: n });
    }
  }
  return out;
}

// El elemento que contiene la posición: desde su `<etiqueta` hasta su cierre (para leer su palabra y su disabled).
function elementoEn(codigo, seguro, pos) {
  const ini = seguro.lastIndexOf('<', pos);
  const etiqueta = (seguro.slice(ini + 1).match(/^[A-Za-z]\w*/) || [''])[0];
  const cierre = seguro.indexOf('</' + etiqueta + '>', pos);
  const solo = seguro.indexOf('/>', pos);
  const fin = cierre >= 0 && (solo < 0 || cierre < solo || etiqueta === 'button') ? cierre + etiqueta.length + 3 : solo + 2;
  return codigo.slice(ini, fin);
}

// Los argumentos de primer nivel de una llamada que abre en `abre` (el paréntesis).
function argumentos(seguro, codigo, abre) {
  const args = [];
  let hondo = 0;
  let desde = abre + 1;
  for (let i = abre; i < seguro.length; i++) {
    const c = seguro[i];
    if ('([{'.includes(c)) hondo++;
    else if (')]}'.includes(c)) { hondo--; if (hondo === 0) { args.push(codigo.slice(desde, i).trim()); return args; } }
    else if (c === ',' && hondo === 1) { args.push(codigo.slice(desde, i).trim()); desde = i + 1; }
  }
  return args;
}

/**
 * Revisa UN archivo. `escritores`: nombres exportados por la app que llegan a escribir.
 * Devuelve { sinCandado: [{linea, evento, trozo}], aMano: [nombres], faltas: [texto] }.
 */
function revisarArchivo(fuente, escritores = new Set()) {
  const codigo = soloCodigo(fuente);
  const seguro = sinTextos(codigo);
  const locales = funcionesDe(codigo, seguro);
  const importados = new Set([...importadosDe(codigo)].filter((n) => escritores.has(n) && !locales.has(n)));
  const sinCandado = [];
  const faltas = [];
  const usaLey = /\buseAccion\s*\(/.test(codigo);

  for (const h of entradasDe(codigo, seguro, locales)) {
    const r = alcance(h.trozo, locales, importados);
    if (r.escribe && !r.candado) sinCandado.push({ linea: h.linea, evento: h.evento, trozo: h.trozo.replace(/\s+/g, ' ').slice(0, 90) });
    if (usaLey && r.candado) {
      const el = elementoEn(codigo, seguro, h.ini);
      if (/^<button/.test(el)) {
        if (!/\bdisabled=/.test(el)) faltas.push(`renglón ${h.linea}: un botón con candado no se deshabilita mientras trabaja`);
        if (!/…|\btexto\(/.test(el)) faltas.push(`renglón ${h.linea}: un botón con candado no dice qué está haciendo («Guardando…»)`);
      }
    }
  }

  // El «guardando» hecho a mano, por lo que HACE: setX(true) antes de escribir y setX(false) después.
  // Se mira SOLO en la función más interna: la pantalla entera contiene a la que guarda, y contarla también daba
  // cada bloqueo dos veces (y cazaba un «hay cambios» de otro botón como si fuera un bloqueo).
  const aMano = [];
  const donde = DONDE.get(locales);
  const interna = (pos) => donde.filter((d) => d.ini <= pos && pos < d.fin).sort((a, b) => (a.fin - a.ini) - (b.fin - b.ini))[0];
  for (const m of seguro.matchAll(/\bset([A-Z]\w*)\(\s*true\s*\)/g)) {
    const d = interna(m.index);
    if (!d) continue;
    const resto = seguro.slice(m.index, d.fin);
    const w = resto.search(ESCRIBE);
    if (w < 0 || interna(m.index + w) !== d) continue;
    const cierra = new RegExp('\\bset' + m[1] + '\\(\\s*false\\s*\\)').test(resto.slice(w));
    if (cierra && !aMano.includes(d.nombre + ':' + m[1])) aMano.push(d.nombre + ':' + m[1]);
  }

  if (usaLey) {
    // La palabra del botón y la acción que corre tienen que llamarse igual, o la palabra no sale nunca.
    const corren = new Set();
    for (const m of seguro.matchAll(/\bcorrer\s*\(/g)) {
      const a = argumentos(seguro, codigo, m.index + m[0].length - 1);
      if (a.length < 3) faltas.push(`renglón ${seguro.slice(0, m.index).split('\n').length}: correr(fn, cual, exito) sin su nombre o sin su «se hizo»`);
      const lit = (a[1] || '').match(/^['"]([^'"]+)['"]$/);
      if (lit) corren.add(lit[1]);
    }
    for (const m of codigo.matchAll(/\btexto\(\s*['"]([^'"]+)['"]/g)) {
      if (!corren.has(m[1])) faltas.push(`la palabra de «${m[1]}» no sale nunca: ninguna acción corre con ese nombre`);
    }
    // Botón por botón hasta su </button>: la versión de Talaria (`<button\b[^>]*>…Cancelar`) se paraba en el `>` de
    // una flecha `onClick={() => …}` y no veía ningún «Cancelar» escrito así. Lo cazó una trampa el 26-sep-2026.
    for (const m of seguro.matchAll(/<button\b/g)) {
      const el = codigo.slice(m.index, seguro.indexOf('</button>', m.index) + 9);
      if (/>\s*(?:\{[^}]*\}\s*)?Cancelar\s*<\/button>$/.test(el) && !/\bdisabled=/.test(el)) faltas.push('un «Cancelar» se puede tocar mientras trabaja');
    }
    if ((codigo.match(/\baviso\b/g) || []).length < 2) faltas.push('la pantalla no pinta el aviso del final: la verdad no se ve');
  }
  return { sinCandado, aMano, faltas };
}

// Los nombres exportados por la app que llegan a escribir, siguiendo imports entre archivos hasta que no crezca.
function escritoresDe(archivos) {
  const esc = new Set();
  let crecio = true;
  while (crecio) {
    crecio = false;
    for (const { fuente } of archivos) {
      const codigo = soloCodigo(fuente);
      const seguro = sinTextos(codigo);
      const locales = funcionesDe(codigo, seguro);
      const importados = new Set([...importadosDe(codigo)].filter((n) => esc.has(n) && !locales.has(n)));
      for (const m of seguro.matchAll(/\bexport\s+(?:default\s+)?(?:async\s+)?(?:function\s+|const\s+)([A-Za-z_$][\w$]*)/g)) {
        if (esc.has(m[1]) || !locales.has(m[1])) continue;
        if (alcance(locales.get(m[1]), locales, importados).escribe) { esc.add(m[1]); crecio = true; }
      }
    }
  }
  return esc;
}

function archivosDe(app) {
  const dir = path.join(RAIZ, app);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.js') && !d.name.endsWith('.test.js') && !LA_PIEZA.includes(d.name))
    .map((d) => ({ ruta: app + '/' + d.name, fuente: fs.readFileSync(path.join(dir, d.name), 'utf8') }));
}

// Todo el proyecto: { 'app/src/X.js': { sinCandado, aMano, faltas } } — solo los que tienen algo.
function medir() {
  const out = {};
  for (const app of APPS) {
    const archivos = archivosDe(app);
    const esc = escritoresDe(archivos);
    for (const a of archivos) {
      const r = revisarArchivo(a.fuente, esc);
      if (r.sinCandado.length || r.aMano.length || r.faltas.length) out[a.ruta] = r;
    }
  }
  return out;
}

// El día que nació la ley (26-sep-2026): archivo → [botones sin candado, «guardando» a mano]. SOLO PUEDE BAJAR.
const PENDIENTES = {
  'guajirago/src/App.js': [1, 1],
  'guajirago/src/AppConductor.js': [21, 0],
  'guajirago/src/Calificacion.js': [1, 1],
  'guajirago/src/Configuracion.js': [4, 0],
  'guajirago/src/Creditos.js': [4, 2],
  'guajirago/src/Home.js': [2, 0],
  'guajirago/src/Llamada.js': [3, 0],
  'guajirago/src/Login.js': [3, 3],
  'guajirago/src/MiPerfil.js': [1, 1],
  'guajirago/src/Promociones.js': [1, 1],
  'guajirago/src/Restaurantes.js': [5, 4],
  'guajirago/src/Seguridad.js': [1, 1],
  'guajirago/src/Solicitar.js': [18, 2],
  'guajirago/src/Turismo.js': [1, 1],
  'guajirago-admin/src/AliadosPendientes.js': [2, 0],
  'guajirago-admin/src/App.js': [4, 1],
  'guajirago-admin/src/Cobros.js': [2, 4],
  'guajirago-admin/src/Codigos.js': [6, 1],
  'guajirago-admin/src/ComentariosReportados.js': [2, 0],
  'guajirago-admin/src/Conductores.js': [14, 0],
  'guajirago-admin/src/Promociones.js': [5, 2],
  'guajirago-admin/src/Restaurantes.js': [3, 0],
  'guajirago-admin/src/Superadmin.js': [8, 9],
  'guajirago-admin/src/Turismo.js': [3, 0],
  'guajirago-aliados/src/App.js': [2, 1],
  'guajirago-aliados/src/CalificacionesRestaurante.js': [1, 1],
  'guajirago-aliados/src/ConfigFlujos.js': [1, 1],
  'guajirago-aliados/src/ConfigMesas.js': [1, 1],
  'guajirago-aliados/src/Configuracion.js': [1, 1],
  'guajirago-aliados/src/Empleados.js': [2, 2],
  'guajirago-aliados/src/Inventario.js': [6, 1],
  'guajirago-aliados/src/Login.js': [2, 2],
  'guajirago-aliados/src/Menu.js': [4, 1],
  'guajirago-aliados/src/Mesero.js': [2, 4],
  'guajirago-aliados/src/PedidosDomicilio.js': [6, 2],
  'guajirago-aliados/src/PerfilAgencia.js': [2, 2],
  'guajirago-aliados/src/PerfilRestaurante.js': [2, 2],
  'guajirago-aliados/src/Promociones.js': [7, 1],
  'guajirago-aliados/src/ReservasTurismo.js': [3, 0],
  'guajirago-aliados/src/Tours.js': [4, 1],
};

module.exports = { revisarArchivo, escritoresDe, medir, PENDIENTES, APPS, ESCRIBE };

if (require.main === module) {
  const r = medir();
  const detalle = process.argv.includes('--detalle');
  let botones = 0;
  let aMano = 0;
  let faltas = 0;
  for (const app of APPS) {
    const suyos = Object.entries(r).filter(([f]) => f.startsWith(app + '/'));
    const b = suyos.reduce((s, [, x]) => s + x.sinCandado.length, 0);
    const m = suyos.reduce((s, [, x]) => s + x.aMano.length, 0);
    console.log(`\n${app}: ${b} botón(es) que guardan SIN candado · ${m} «guardando» hecho(s) a mano · en ${suyos.length} archivo(s)`);
    for (const [f, x] of suyos) {
      console.log(`   ${f.slice(app.length + 1).padEnd(34)} sin candado ${String(x.sinCandado.length).padStart(3)} · a mano ${String(x.aMano.length).padStart(3)}${x.faltas.length ? ' · 🔴 ' + x.faltas.length + ' falta(s) a la ley' : ''}`);
      if (detalle) {
        for (const s of x.sinCandado) console.log(`        :${s.linea} ${s.evento} ${s.trozo}`);
        for (const s of x.aMano) console.log(`        a mano: ${s}`);
      }
      for (const s of x.faltas) console.log(`        🔴 ${s}`);
    }
    botones += b; aMano += m; faltas += suyos.reduce((s, [, x]) => s + x.faltas.length, 0);
  }
  console.log(`\nTOTAL: ${botones} botón(es) sin candado · ${aMano} «guardando» a mano · ${faltas} falta(s) en pantallas que ya usan la ley`);
}
