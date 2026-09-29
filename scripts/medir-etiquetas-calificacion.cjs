#!/usr/bin/env node
/**
 * ⭐ ¿QUÉ ETIQUETAS DE LA CALIFICACIÓN SON «BUENAS»? — gemelo G73 (29-sep-2026), SOLO LECTURA.
 *
 * Al calificar un viaje, la app (Calificacion.js) ofrece etiquetas —«Llegó rápido», «Mal trato»…— y cada una dice
 * si es buena (verde ✅) o mala (roja ❌). El panel (Conductores.js, sección ⭐ Calificaciones) las vuelve a pintar
 * verdes o rojas, y para saber cuáles son buenas llevaba SU PROPIA lista escrita a mano, tres veces: una constante
 * `OPCIONES_BUENAS` y dos listas en línea dentro de la tarjeta. Hoy dicen lo mismo; el día que la app estrene una
 * etiqueta buena, el panel la pintaría roja sin que nada avise.
 *
 *   node scripts/medir-etiquetas-calificacion.cjs                       <- el disco (los tres repos) + producción
 *   node scripts/medir-etiquetas-calificacion.cjs --raiz <c> --panel <c> <- otro commit de cada repo (careo)
 *   --sin-nube                                                          <- no lee producción
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. LA VERDAD: las etiquetas que ofrece la app y cuáles son buenas. Se sacan de donde estén en ese commit (la
 *     pieza etiquetasCalificacion.js, o las constantes de Calificacion.js de antes) y se EJECUTAN.
 *  2. EL PANEL: cada `background:`/`color:` de Conductores.js que elige entre el verde y el rojo de una etiqueta
 *     (`<condición> ? '#E0F5E9'` y `<condición> ? '#2ECC71'`). Se saca la condición del archivo y se CORRE con cada
 *     etiqueta de la app y con etiquetas que la app no conoce: ¿pinta verde justo las buenas?
 *  3. Cuántas listas de etiquetas buenas hay escritas a mano en las tres apps (fuera de la pieza).
 *  4. PRODUCCIÓN (solo lectura): qué etiquetas están guardadas en `calificaciones`, cuántas veces, y si alguna no
 *     la conoce la app (quedaría sin clasificar: el panel la pinta roja).
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

const PIEZA = 'guajirago/src/etiquetasCalificacion.js';
const PIEZA_PANEL = 'guajirago-admin/src/etiquetasCalificacion.js';
const CALIFICACION = 'guajirago/src/Calificacion.js';
const CONDUCTORES = 'guajirago-admin/src/Conductores.js';
// Etiquetas que la app NO ofrece: el panel tiene que pintarlas rojas (como siempre ha hecho).
const DESCONOCIDAS = ['Etiqueta vieja', '', 'llegó rápido', 'Buen trato '];

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo: del disco, o de un commit de su repo (la raíz, o guajirago-admin/). */
function lector(commitRaiz, commitPanel) {
  return (r) => {
    const esPanel = r.startsWith('guajirago-admin/');
    const commit = esPanel ? commitPanel : commitRaiz;
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    const cwd = esPanel ? path.join(RAIZ, 'guajirago-admin') : RAIZ;
    const dentro = esPanel ? r.slice('guajirago-admin/'.length) : r;
    try {
      return execFileSync('git', ['show', commit + ':' + dentro], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** El array literal que empieza en el `[` de la posición `i` (sobre el texto sin textos, devuelto del original). */
function entreCorchetes(seguro, original, i) {
  let p = 0;
  for (let j = i; j < seguro.length; j += 1) {
    if (seguro[j] === '[') p += 1;
    else if (seguro[j] === ']') { p -= 1; if (p === 0) return original.slice(i, j + 1); }
  }
  return null;
}

/** 1 · La verdad: las listas de la app, ejecutadas. De la pieza si existe; si no, de las constantes de Calificacion.js. */
function laVerdad(leer) {
  const pieza = leer(PIEZA);
  let pasajero;
  let conductor;
  let origen;
  if (pieza) {
    const p = cargarDeLaApp(PIEZA, pieza);
    pasajero = p.OPCIONES_PASAJERO;
    conductor = p.OPCIONES_CONDUCTOR;
    origen = PIEZA;
  }
  const cal = leer(CALIFICACION);
  const codigo = soloCodigo(cal.replace(/\r\n/g, '\n'));
  const seguro = sinTextos(codigo);
  const propias = {};
  for (const nombre of ['OPCIONES_PASAJERO', 'OPCIONES_CONDUCTOR']) {
    const m = new RegExp('const\\s+' + nombre + '\\s*=\\s*\\[').exec(seguro);
    if (m) propias[nombre] = Function('"use strict"; return (' + entreCorchetes(seguro, codigo, m.index + m[0].length - 1) + ');')();
  }
  if (!pieza) {
    pasajero = propias.OPCIONES_PASAJERO;
    conductor = propias.OPCIONES_CONDUCTOR;
    origen = CALIFICACION;
  }
  if (!Array.isArray(pasajero) || !Array.isArray(conductor)) throw new Error('no encontré las listas de etiquetas de la app');
  const importaLaPieza = /import\s*\{[^}]*\bOPCIONES_PASAJERO\b[^}]*\bOPCIONES_CONDUCTOR\b[^}]*\}\s*from\s*'\.\/etiquetasCalificacion'/.test(codigo)
    || /import\s*\{[^}]*\bOPCIONES_CONDUCTOR\b[^}]*\bOPCIONES_PASAJERO\b[^}]*\}\s*from\s*'\.\/etiquetasCalificacion'/.test(codigo);
  const todas = [...pasajero, ...conductor];
  const buena = {};
  for (const o of todas) buena[o.texto] = !!o.buena;
  return {
    origen, pasajero, conductor, buena,
    listasPropiasEnLaPantalla: Object.keys(propias).length,
    importaLaPieza,
  };
}

/** 2 · El panel: cada condición que elige verde o rojo para una etiqueta, sacada del archivo y lista para correr. */
function condicionesDelPanel(leer) {
  const texto = leer(CONDUCTORES).replace(/\r\n/g, '\n');
  const codigo = soloCodigo(texto);
  // Lo que el componente tiene a mano para decidir: la constante propia (si la hay) y la pieza (si la importa).
  const seguro = sinTextos(codigo);
  let OPCIONES_BUENAS;
  const m = /const\s+OPCIONES_BUENAS\s*=\s*\[/.exec(seguro);
  if (m) OPCIONES_BUENAS = Function('"use strict"; return (' + entreCorchetes(seguro, codigo, m.index + m[0].length - 1) + ');')();
  let esEtiquetaBuena;
  const importa = /import\s*\{[^}]*\besEtiquetaBuena\b[^}]*\}\s*from\s*'\.\/etiquetasCalificacion'/.test(codigo);
  if (importa) {
    const pieza = leer(PIEZA_PANEL);
    if (pieza) esEtiquetaBuena = cargarDeLaApp(PIEZA_PANEL, pieza).esEtiquetaBuena;
  }
  const condiciones = [];
  const re = /(background|color)\s*:\s*([^{}]*?)\s*\?\s*'(#E0F5E9|#2ECC71)'/g;
  for (const c of codigo.matchAll(re)) {
    const expr = c[2];
    // Solo las que miran la etiqueta (`op`): otros verdes del archivo no son de esto.
    if (!/\bop\b/.test(expr)) continue;
    const renglon = codigo.slice(0, c.index).split('\n').length;
    let correr;
    try {
      correr = Function('op', 'OPCIONES_BUENAS', 'esEtiquetaBuena', '"use strict"; return !!(' + expr + ');');
    } catch (e) { correr = () => { throw e; }; }
    condiciones.push({ renglon, que: c[1], expr, correr: (op) => correr(op, OPCIONES_BUENAS, esEtiquetaBuena) });
  }
  return { condiciones, importaLaPieza: importa, tieneListaPropia: !!m };
}

/** 3 · Listas de etiquetas escritas a mano: todo array literal que nombre 'Llegó rápido' o 'Pasajero puntual', fuera de la pieza. */
function listasAMano(leer, archivos) {
  const donde = [];
  for (const r of archivos) {
    if (r === PIEZA || r === PIEZA_PANEL) continue;
    const t = leer(r);
    if (!t) continue;
    const codigo = soloCodigo(t.replace(/\r\n/g, '\n'));
    const seguro = sinTextos(codigo);
    // Cada lista se cuenta UNA vez: se busca el `[` que encierra cada etiqueta y se cuentan los `[` distintos.
    const abre = new Set();
    for (const m of codigo.matchAll(/['"](Llegó rápido|Pasajero puntual)['"]/g)) {
      let p = 0;
      for (let j = m.index - 1; j >= 0; j -= 1) {
        if (seguro[j] === ']') p += 1;
        else if (seguro[j] === '[') { if (p === 0) { abre.add(j); break; } p -= 1; }
      }
    }
    if (abre.size) donde.push({ archivo: r, veces: abre.size });
  }
  return donde;
}

function archivosDeLasApps() {
  const lista = [];
  for (const carpeta of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
    const abs = path.join(RAIZ, carpeta);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs)) if (f.endsWith('.js')) lista.push(carpeta + '/' + f);
  }
  return lista;
}

/** Todo el careo de un commit: la verdad, lo que pinta el panel con cada etiqueta, y los desacuerdos. */
function medir(leer, archivos = archivosDeLasApps()) {
  const verdad = laVerdad(leer);
  const panel = condicionesDelPanel(leer);
  const etiquetas = [...new Set([...Object.keys(verdad.buena), ...DESCONOCIDAS])];
  const tabla = [];
  const desacuerdos = [];
  for (const et of etiquetas) {
    const esperado = verdad.buena[et] === true;
    const fila = { etiqueta: et, app: et in verdad.buena ? (esperado ? 'buena' : 'mala') : '(no la ofrece)', panel: [] };
    for (const c of panel.condiciones) {
      let v;
      try { v = c.correr(et); } catch (e) { v = 'REVIENTA: ' + e.message; }
      fila.panel.push(v);
      if (v !== esperado) desacuerdos.push({ etiqueta: et, renglon: c.renglon, que: c.que, pinta: v, deberia: esperado });
    }
    tabla.push(fila);
  }
  const huella = crypto.createHash('sha256').update(JSON.stringify(tabla.map((f) => [f.etiqueta, f.app, [...new Set(f.panel)]]))).digest('hex').slice(0, 10);
  return { verdad, panel, tabla, desacuerdos, huella, aMano: listasAMano(leer, archivos) };
}

async function produccion(verdad) {
  const { traer, doc } = require('./nube.cjs');
  const ds = (await traer('calificaciones')).map(doc);
  const cuenta = {};
  let conEtiquetas = 0;
  for (const d of ds) {
    const ops = Array.isArray(d.opcionesSeleccionadas) ? d.opcionesSeleccionadas : [];
    if (ops.length) conEtiquetas += 1;
    for (const o of ops) cuenta[o] = (cuenta[o] || 0) + 1;
  }
  const desconocidas = Object.keys(cuenta).filter((e) => !(e in verdad.buena));
  return { total: ds.length, conEtiquetas, cuenta, desconocidas };
}

async function main() {
  const commitRaiz = argumento('--raiz');
  const commitPanel = argumento('--panel');
  const leer = lector(commitRaiz, commitPanel);
  const r = medir(leer);
  console.log('⭐ ETIQUETAS DE LA CALIFICACIÓN — raíz ' + (commitRaiz || 'disco') + ' · panel ' + (commitPanel || 'disco'));
  console.log('\n1 · LA VERDAD (sale de ' + r.verdad.origen + '): ' + r.verdad.pasajero.length + ' etiquetas del pasajero, '
    + r.verdad.conductor.length + ' del conductor; buenas: ' + Object.keys(r.verdad.buena).filter((k) => r.verdad.buena[k]).length);
  console.log('   Calificacion.js con listas propias: ' + r.verdad.listasPropiasEnLaPantalla + ' · importa la pieza: ' + (r.verdad.importaLaPieza ? 'sí' : 'no'));
  console.log('\n2 · EL PANEL (Conductores.js): ' + r.panel.condiciones.length + ' sitios eligen verde o rojo para una etiqueta'
    + ' · lista propia: ' + (r.panel.tieneListaPropia ? 'sí' : 'no') + ' · importa la pieza: ' + (r.panel.importaLaPieza ? 'sí' : 'no'));
  for (const c of r.panel.condiciones) console.log('   · renglón ' + c.renglon + ' (' + c.que + '): ' + c.expr.slice(0, 90) + (c.expr.length > 90 ? '…' : ''));
  console.log('   etiquetas probadas: ' + r.tabla.length + ' · desacuerdos con la app: ' + r.desacuerdos.length);
  for (const d of r.desacuerdos) console.log('   🔴 «' + d.etiqueta + '» renglón ' + d.renglon + ' pinta ' + (d.pinta === true ? 'verde' : d.pinta === false ? 'rojo' : d.pinta) + ' y debería ' + (d.deberia ? 'verde' : 'rojo'));
  console.log('   huella de lo que se pinta: ' + r.huella);
  const totalAMano = r.aMano.reduce((s, x) => s + x.veces, 0);
  console.log('\n3 · LISTAS DE ETIQUETAS ESCRITAS A MANO (fuera de la pieza): ' + r.aMano.length + ' archivos, ' + totalAMano + ' listas');
  for (const x of r.aMano) console.log('   · ' + x.archivo + ': ' + x.veces);
  if (!process.argv.includes('--sin-nube')) {
    try {
      const p = await produccion(r.verdad);
      console.log('\n4 · PRODUCCIÓN (calificaciones, solo lectura): ' + p.total + ' calificaciones, ' + p.conEtiquetas + ' con etiquetas');
      for (const [e, n] of Object.entries(p.cuenta).sort((a, b) => b[1] - a[1])) console.log('   · «' + e + '» ×' + n + ' → ' + (e in r.verdad.buena ? (r.verdad.buena[e] ? 'buena' : 'mala') : 'LA APP NO LA CONOCE'));
      console.log('   etiquetas guardadas que la app no conoce: ' + p.desconocidas.length);
    } catch (e) {
      console.log('\n4 · PRODUCCIÓN: no se pudo leer (' + e.message + ')');
    }
  }
  console.log('\n' + (r.desacuerdos.length === 0 && totalAMano === 0 ? '✓ una sola lista, y el panel pinta como la app' : '⚠ ' + totalAMano + ' listas a mano, ' + r.desacuerdos.length + ' desacuerdos'));
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { medir, lector, laVerdad, condicionesDelPanel, listasAMano, DESCONOCIDAS, PIEZA, PIEZA_PANEL, CALIFICACION, CONDUCTORES };
