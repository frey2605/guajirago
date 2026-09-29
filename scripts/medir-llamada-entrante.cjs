#!/usr/bin/env node
/**
 * ¿CUÁNTAS VECES SE ESCUCHA «ME ESTÁN LLAMANDO»? — gemelo G58 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-llamada-entrante.cjs              (el código de hoy + las llamadas de producción)
 *   node scripts/medir-llamada-entrante.cjs --sin-red    (solo el código)
 *   node scripts/medir-llamada-entrante.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * Cuando el otro lado del viaje llama por la app, el documento `llamadas/{viajeId}` pasa a `estado: 'llamando'` y
 * la pantalla tiene que saltar a «Llamada entrante». Esa escucha estaba copiada IGUAL en las dos pantallas
 * (AppConductor.js y Solicitar.js), y ninguna de las dos decía nada si la escucha se caía: el `onSnapshot` iba sin
 * su segundo manejador, así que si el servidor la cortaba, al que le llamaban no le sonaba nada y nadie lo sabía.
 *
 * Mide dos cosas:
 *   1. CÓDIGO: cuántas escuchas de `llamadas` hay escritas en las pantallas (fuera de Llamada.js y de la pieza), y
 *      CORRE la escucha de cada pantalla —la vieja, sacada del archivo, o la pieza nueva con los argumentos que le
 *      pasa la pantalla— con el MISMO guion de documentos: qué marca deja en cada paso, a qué documento escucha,
 *      si suelta la escucha al salir, y qué pasa si el servidor la corta.
 *   2. DATOS (producción): cuántos documentos de `llamadas` hay y en qué estado. No escribe nada.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { leer, sinTextos, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const PIEZA = 'guajirago/src/llamadaEntrante.js';
const PANTALLAS = [
  // [archivo, lo que la pantalla tiene en su ámbito cuando hay viaje]
  ['guajirago/src/AppConductor.js', () => ({ viajeActual: { id: 'V1', pasajeroNombre: 'Ana' } })],
  ['guajirago/src/Solicitar.js', () => ({ viajeId: 'V1' })],
];
// Archivos que SÍ pueden nombrar la colección: la llamada misma y la pieza que escucha.
const PERMITIDOS = new Set(['guajirago/src/Llamada.js', PIEZA]);

function fuente(ruta, commit) {
  if (!commit) return fs.existsSync(path.join(RAIZ, ruta)) ? leer(ruta) : null;
  try {
    return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + ruta],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

/**
 * Quita los comentarios SIN mover nada: los cambia por espacios del mismo largo y deja los saltos de renglón, así el
 * renglón que se enseña es el del archivo. (soloCodigo de cargar.cjs borra los de bloque y corre los renglones.)
 */
const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => l.replace(/^(\s*)(\/\/.*)/, (_, a, b) => a + ' '.repeat(b.length))).join('\n');

/** Las escuchas escritas a mano: cada vez que el código (sin comentarios) nombra la colección 'llamadas'. */
function escuchasAMano(ruta, texto) {
  const codigo = sinComentarios(texto);
  const renglon = (pos) => codigo.slice(0, pos).split('\n').length;
  return [...codigo.matchAll(/['"`]llamadas['"`]/g)].map((m) => ruta.split('/').pop() + ':' + renglon(m.index));
}

// ── Un React de mentira, lo justo para correr un gancho: useState, useRef, useEffect con su lista de dependencias. ──
function reactDeMentira() {
  const celdas = [];
  let i = 0;
  let pendientes = [];
  let usar = null;
  let valor;
  let montado = true;
  function pintar() {
    i = 0;
    pendientes = [];
    valor = usar();
    const p = pendientes;
    pendientes = [];
    p.forEach((f) => f());
  }
  const H = {
    useState(ini) {
      const k = i++;
      if (!(k in celdas)) {
        celdas[k] = { v: ini };
        celdas[k].set = (nv) => { celdas[k].v = typeof nv === 'function' ? nv(celdas[k].v) : nv; if (montado) pintar(); };
      }
      return [celdas[k].v, celdas[k].set];
    },
    useRef(ini) { const k = i++; if (!(k in celdas)) celdas[k] = { current: ini }; return celdas[k]; },
    useEffect(fn, deps) {
      const k = i++;
      const antes = celdas[k];
      const cambia = !antes || !deps || !antes.deps || deps.length !== antes.deps.length
        || deps.some((d, j) => !Object.is(d, antes.deps[j]));
      if (!cambia) return;
      pendientes.push(() => {
        if (antes && antes.limpiar) antes.limpiar();
        const l = fn();
        celdas[k] = { deps, limpiar: typeof l === 'function' ? l : null };
      });
    },
  };
  return {
    H,
    montar(u) { usar = u; pintar(); },
    valor: () => valor,
    repintar: () => pintar(),
    desmontar() {
      montado = false;
      celdas.forEach((c) => { if (c && c.limpiar) c.limpiar(); });
    },
  };
}

// ── Firestore de mentira: guarda a qué documento se escucha y con qué manejadores. ──
function firestoreDeMentira() {
  const escuchas = [];
  return {
    escuchas,
    db: { deMentira: true },
    doc: (_db, ...trozos) => ({ ruta: trozos.join('/') }),
    onSnapshot: (ref, siguiente, error) => {
      const e = { ruta: ref.ruta, siguiente, error, soltada: false };
      escuchas.push(e);
      return () => { e.soltada = true; };
    },
  };
}
const foto = (datos) => ({ exists: () => datos !== null, data: () => datos });

/** Carga la pieza nueva con el React y el Firestore de mentira, y el avisoRechazo.js DE VERDAD. */
function cargarPieza(texto, H, F, apuntes) {
  const avisoRechazo = cargarDeLaApp('guajirago/src/avisoRechazo.js');
  const sinImports = texto.replace(/^import[^;]*;[ \t]*\r?$/gm, '');
  const nombres = [...sinImports.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const cuerpo = sinImports.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function('useState', 'useEffect', 'useRef', 'doc', 'onSnapshot', 'db', 'motivoDeRechazo', 'apuntarRechazo',
    cuerpo + '\nreturn { ' + nombres.join(', ') + ' };')(
    H.useState, H.useEffect, H.useRef, F.doc, F.onSnapshot, F.db, avisoRechazo.motivoDeRechazo,
    (donde, e) => apuntes.push([donde, e && e.code]));
}

/** Evalúa una lista de expresiones de la pantalla (argumentos o dependencias) en su ámbito. */
function evaluar(expr, ambito) {
  // eslint-disable-next-line no-new-func
  return new Function('ambito', 'with (ambito) { return [' + expr + ']; }')(ambito);
}

/**
 * La escucha de UNA pantalla, lista para correr: la vieja (el useEffect que nombra 'llamadas', sacado del archivo) o
 * la pieza (si la pantalla llama a useLlamadaEntrante). Devuelve { forma, usar(H, F, ambito, apuntes) } o { queja }.
 */
function laEscucha(ruta, texto, textoPieza) {
  if (texto == null) return { queja: ruta + ' no existe' };
  const codigo = sinComentarios(texto);
  const seguro = sinTextos(codigo);
  const alGancho = [...seguro.matchAll(/\buseLlamadaEntrante\s*\(/g)];
  const nombraLaColeccion = [...codigo.matchAll(/['"`]llamadas['"`]/g)];
  if (alGancho.length) {
    if (alGancho.length !== 1) return { queja: ruta + ' llama ' + alGancho.length + ' veces a useLlamadaEntrante (debe ser UNA)' };
    if (nombraLaColeccion.length) return { queja: ruta + ' usa la pieza y ADEMÁS escucha «llamadas» a mano' };
    if (!textoPieza) return { queja: ruta + ' usa useLlamadaEntrante pero ' + PIEZA + ' no existe' };
    const ini = alGancho[0].index;
    const abre = seguro.indexOf('(', ini);
    let hondo = 0;
    let k = abre;
    for (; k < seguro.length; k++) {
      if (seguro[k] === '(') hondo++;
      else if (seguro[k] === ')' && --hondo === 0) break;
    }
    const args = codigo.slice(abre + 1, k);
    // Lo que la pantalla recibe: `const [marca, ponerMarca] = useLlamadaEntrante(...)`
    const antes = codigo.slice(codigo.lastIndexOf('\n', ini) + 1, ini);
    const m = antes.match(/const\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*$/);
    if (!m) return { queja: ruta + ': no encuentro «const [marca, ponerMarca] = useLlamadaEntrante(...)»' };
    return {
      forma: 'la pieza',
      args: args.trim(),
      usar: (H, F, ambito, apuntes) => {
        const pieza = cargarPieza(textoPieza, H, F, apuntes);
        return () => pieza.useLlamadaEntrante(...evaluar(args, ambito));
      },
    };
  }
  if (nombraLaColeccion.length !== 1) {
    return { queja: ruta + ' nombra la colección llamadas ' + nombraLaColeccion.length + ' veces y no usa la pieza' };
  }
  const pos = nombraLaColeccion[0].index;
  const efecto = seguro.lastIndexOf('useEffect(', pos);
  if (efecto < 0) return { queja: ruta + ': la escucha no está dentro de un useEffect' };
  const c = cuerpoDeLaFuncion(codigo, efecto);
  const d = codigo.slice(c.fin + 1).match(/^\s*\}?\s*,\s*\[([^\]]*)\]/);
  if (!d) return { queja: ruta + ': no encuentro las dependencias del useEffect de la escucha' };
  const deps = d[1];
  return {
    forma: 'escrita a mano',
    deps,
    usar: (H, F, ambito) => () => {
      const [marca, ponerMarca] = H.useState(false);
      const todo = Object.assign(Object.create(null), ambito,
        { setLlamadaEntrante: ponerMarca, doc: F.doc, db: F.db, onSnapshot: F.onSnapshot });
      // eslint-disable-next-line no-new-func
      const correr = new Function('ambito', 'with (ambito) { ' + c.texto + '\n}');
      H.useEffect(() => correr(todo), evaluar(deps, ambito));
      return [marca, ponerMarca];
    },
  };
}

/**
 * El guion: el MISMO para las dos pantallas, antes y después. Cada paso le da un documento a la escucha (o un corte
 * del servidor) y anota la marca «me están llamando» que queda.
 */
function correrGuion(escucha, ambitoBase) {
  const R = reactDeMentira();
  const F = firestoreDeMentira();
  const apuntes = [];
  const avisos = [];
  const ambito = { ...ambitoBase(), setAviso: (a) => avisos.push(a) };
  R.montar(escucha.usar(R.H, F, ambito, apuntes));
  const viva = () => F.escuchas.filter((e) => !e.soltada);
  const ruta = F.escuchas.length ? F.escuchas[0].ruta : '(no escucha)';
  const pasos = [];
  const dar = (nombre, datos) => {
    const v = viva();
    if (v.length === 1) v[0].siguiente(foto(datos));
    pasos.push([nombre, R.valor()[0]]);
  };
  dar('no hay llamada', null);
  dar('me llaman', { estado: 'llamando' });
  dar('contesté', { estado: 'activa' });
  dar('colgaron', { estado: 'terminada' });
  dar('me vuelven a llamar', { estado: 'llamando' });
  R.valor()[1](false); // la pantalla cierra «Llamada entrante» (su onCerrar)
  pasos.push(['cerré la ventana', R.valor()[0]]);
  dar('sigue activa', { estado: 'activa' });
  dar('sin estado', {});
  // El viaje cambia (otro objeto, la MISMA id): ¿vuelve a escuchar desde cero?
  const antesDeCambiar = F.escuchas.length;
  if (ambito.viajeActual) {
    ambito.viajeActual = { ...ambito.viajeActual };
    R.repintar();
  }
  const reescucha = F.escuchas.length - antesDeCambiar;
  // Otro viaje (otra id): tiene que soltar el de antes y escuchar el nuevo.
  if (ambito.viajeActual) ambito.viajeActual = { ...ambito.viajeActual, id: 'V2' };
  if ('viajeId' in ambito) ambito.viajeId = 'V2';
  R.repintar();
  const otroViaje = viva().map((e) => e.ruta).join(',') || '(ninguna)';
  // El servidor corta la escucha.
  const corte = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const v = viva();
  const tieneManejador = v.length === 1 && typeof v[0].error === 'function';
  if (tieneManejador) v[0].error(corte);
  R.desmontar();
  const sueltaAlSalir = viva().length === 0;
  // Sin viaje: no escucha nada.
  const R2 = reactDeMentira();
  const F2 = firestoreDeMentira();
  const vacio = Object.fromEntries(Object.keys(ambitoBase()).map((k) => [k, null]));
  R2.montar(escucha.usar(R2.H, F2, { ...vacio, setAviso: () => {} }, []));
  return { escuchaA: ruta, pasos, reescucha, otroViaje, tieneManejador, avisos, apuntes, sueltaAlSalir, sinViajeEscucha: F2.escuchas.length };
}

/** Función pura: de las fuentes (de un commit o del disco), lo que mide el paso 1. */
function medirCodigo(fuentes) {
  const quejas = [];
  const aMano = [];
  for (const [ruta, texto] of Object.entries(fuentes)) {
    if (PERMITIDOS.has(ruta) || texto == null) continue;
    aMano.push(...escuchasAMano(ruta, texto));
  }
  const pantallas = PANTALLAS.map(([ruta, ambito]) => {
    const e = laEscucha(ruta, fuentes[ruta], fuentes[PIEZA]);
    if (e.queja) { quejas.push(e.queja); return { ruta, queja: e.queja }; }
    return { ruta, forma: e.forma, args: e.args, deps: e.deps, ...correrGuion(e, ambito) };
  });
  return { aMano, pantallas, quejas };
}

function fuentesDe(commit) {
  const todas = {};
  let lista;
  if (commit) {
    lista = execFileSync('git', ['-C', RAIZ, 'ls-tree', '-r', '--name-only', commit, '--', 'guajirago/src'], { encoding: 'utf8' })
      .split('\n').filter((f) => /\.js$/.test(f));
  } else {
    lista = fs.readdirSync(path.join(RAIZ, 'guajirago/src')).filter((f) => /\.js$/.test(f)).map((f) => 'guajirago/src/' + f);
  }
  for (const r of lista) todas[r] = fuente(r, commit);
  if (!(PIEZA in todas)) todas[PIEZA] = null;
  return todas;
}

function informe(r, commit) {
  const L = [];
  L.push('\n1. CÓDIGO' + (commit ? ' del commit ' + commit : ' de hoy'));
  L.push('   escuchas de «llamadas» escritas a mano en las pantallas: ' + r.aMano.length
    + (r.aMano.length ? '  (' + r.aMano.join(', ') + ')' : ''));
  for (const p of r.pantallas) {
    const nombre = p.ruta.split('/').pop();
    if (p.queja) { L.push('   🔴 ' + p.queja); continue; }
    L.push('   · ' + nombre + ' — ' + p.forma + (p.args ? ' (' + p.args + ')' : ' [' + p.deps + ']') + '; escucha «' + p.escuchaA + '»');
    L.push('       marca en cada paso: ' + p.pasos.map(([n, v]) => n + '=' + v).join(' · '));
    L.push('       si el viaje cambia con la misma id: vuelve a escuchar ' + p.reescucha + ' vez · con otro viaje escucha: ' + p.otroViaje);
    L.push('       si el servidor corta la escucha: ' + (p.tieneManejador
      ? 'lo dice — ' + p.avisos.length + ' aviso' + (p.avisos[0] ? ' «' + p.avisos[0].titulo + '»' : '')
        + ', ' + p.apuntes.length + ' rastro en consola'
      : '🔴 NADIE se entera (onSnapshot sin manejador de error)'));
    L.push('       suelta la escucha al salir: ' + (p.sueltaAlSalir ? 'sí' : '🔴 NO') + ' · sin viaje, escuchas: ' + p.sinViajeEscucha);
  }
  const mudas = r.pantallas.filter((p) => !p.queja && !p.tieneManejador).length;
  L.push('   → escuchas mudas si el servidor las corta: ' + mudas + ' de ' + r.pantallas.length);
  return L.join('\n');
}

async function datos() {
  const { traer, val } = require('./nube.cjs');
  const crudos = await traer('llamadas');
  const porEstado = {};
  const sinTerminar = [];
  for (const d of crudos) {
    const f = d.fields || {};
    const estado = f.estado ? val(f.estado) : '(sin estado)';
    porEstado[estado] = (porEstado[estado] || 0) + 1;
    if (estado !== 'terminada') sinTerminar.push(d.name.split('/').pop().slice(0, 8) + ' ' + estado + ' ' + (f.inicio ? val(f.inicio) : ''));
  }
  console.log('\n2. PRODUCCIÓN · ' + crudos.length + ' documentos en «llamadas»: '
    + (Object.entries(porEstado).map(([k, v]) => k + '=' + v).join(', ') || 'ninguno'));
  if (sinTerminar.length) console.log('   sin «terminada»: ' + sinTerminar.join(' | '));
}

module.exports = {
  medirCodigo, fuentesDe, laEscucha, correrGuion, cargarPieza, reactDeMentira, firestoreDeMentira, foto, PIEZA, PANTALLAS,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--commit');
  const commit = i >= 0 ? args[i + 1] : null;
  const r = medirCodigo(fuentesDe(commit));
  console.log(informe(r, commit));
  if (r.quejas.length) process.exitCode = 1;
  if (!args.includes('--sin-red')) {
    datos().catch((e) => { console.log('\n2. PRODUCCIÓN · no pude leer: ' + e.message); process.exitCode = 1; });
  }
}
