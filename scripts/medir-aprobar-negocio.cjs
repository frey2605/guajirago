#!/usr/bin/env node
/**
 * ✅ APROBAR UN NEGOCIO — gemelo G49 (29-sep-2026) · SOLO LECTURA
 *
 * El panel tiene TRES botones de «Aprobar» (🍽️ Restaurantes, 🧭 Turismo y 🤝 Aliados pendientes), cada uno con su propia
 * escritura. Dos de ellos escribían además `activo: true`: si en 💳 Cobros se había apagado «La cuenta está viva»,
 * aprobar la volvía a encender sin que nadie lo pidiera. Decisión (recomendada): APROBAR RESPETA LO QUE SE APAGÓ EN
 * COBROS — solo marca aprobado; `activo` y `estadoComercial` no se tocan.
 *
 * Este guion NO lee los botones como texto: SACA de cada pantalla la función `aprobar` y la EJECUTA con una base de
 * mentira que apunta cada escritura, contra tres casos (apagado en Cobros, bloqueado en Cobros, recién registrado).
 * Después lee los negocios de PRODUCCIÓN y dice qué le haría cada botón a cada uno si se le aprobara hoy.
 *
 *   node scripts/medir-aprobar-negocio.cjs [--commit-panel <hash>]
 *
 * Con `--commit-panel` corre el código del panel de ese commit (careo antes/después). No escribe nada.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const PANEL = 'guajirago-admin';
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const LOS_BOTONES = [
  ['src/Restaurantes.js', '🍽️ Restaurantes'],
  ['src/Turismo.js', '🧭 Turismo'],
  ['src/AliadosPendientes.js', '🤝 Aliados pendientes'],
];
const LA_PIEZA = 'src/aprobarNegocio.js';

/** El texto de un archivo del panel: el del disco, o el de un commit. null si no existe. */
function textoDe(ruta, commit) {
  if (!commit) {
    const p = path.join(RAIZ, PANEL, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, PANEL), 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

/** La base de mentira: `doc` da la ruta, `updateDoc` apunta la escritura. */
function baseDeMentira() {
  const escrituras = [];
  const doc = (_db, coleccion, id) => ({ ruta: coleccion + '/' + id });
  const updateDoc = async (ref, campos) => { escrituras.push({ ruta: ref.ruta, campos }); };
  return { escrituras, doc, updateDoc };
}

/**
 * La pieza única (`aprobarNegocio.js`) cargada con la base de mentira. Se le quita el import de firebase y se le pasan
 * `doc` y `updateDoc` de mentira. null si ese commit todavía no la tiene.
 */
function laPieza(commit, base, leerTexto = textoDe) {
  const t = leerTexto(LA_PIEZA, commit);
  if (t == null) return null;
  const limpio = t.replace(/\r\n/g, '\n');
  const sinFirebase = limpio.replace(/^import\s*\{[^}]*\}\s*from\s*'firebase\/firestore';?[ \t]*$/m, '');
  if (sinFirebase === limpio) throw new Error(PANEL + '/' + LA_PIEZA + ' ya no importa de firebase/firestore como se espera');
  if (/^import\s/m.test(sinFirebase)) throw new Error(PANEL + '/' + LA_PIEZA + ' importa algo más: este lector no sabe cargarlo');
  const nombres = [...sinFirebase.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  return new Function('doc', 'updateDoc', sinFirebase.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')(base.doc, base.updateDoc);
}

/**
 * El botón `aprobar` de una pantalla, SACADO del archivo y listo para correr: `(negocio) => { escrituras, despues }`.
 * Todo lo que la función toca de fuera se le da de mentira; si llama a algo que no se le dio, revienta (y se ve).
 */
function elBoton(ruta, commit, leerTexto = textoDe) {
  const texto = leerTexto(ruta, commit);
  if (texto == null) throw new Error('no está ' + PANEL + '/' + ruta + (commit ? ' en ' + commit : ''));
  const t = soloCodigo(texto).replace(/\r\n/g, '\n');
  const m = /const aprobar\s*=\s*async\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>/.exec(t);
  if (!m) throw new Error('no encuentro «const aprobar = async (x) =>» en ' + PANEL + '/' + ruta);
  const cuerpo = cuerpoDeLaFuncion(t, m.index);
  if (!cuerpo) throw new Error('no encuentro el cuerpo de aprobar en ' + PANEL + '/' + ruta);
  return async (negocio) => {
    const base = baseDeMentira();
    const pieza = laPieza(commit, base, leerTexto);
    const fallos = [];
    const piezas = {
      db: { soyLaBase: true },
      doc: base.doc,
      updateDoc: base.updateDoc,
      setGuardando: () => {},
      apuntarRechazo: (_d, e) => fallos.push(e),
      setAviso: () => {},
      motivoDeRechazo: (e) => ({ texto: String(e) }),
      aprobarNegocio: pieza ? pieza.aprobarNegocio : undefined,
    };
    const nombres = Object.keys(piezas);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...nombres, 'return async (' + m[1] + ') => {' + cuerpo.texto + '};')(...nombres.map((n) => piezas[n]));
    await fn(negocio);
    if (fallos.length) throw new Error(ruta + ': el botón cayó en su catch: ' + fallos.map(String).join(' | '));
    let despues = { ...negocio };
    for (const e of base.escrituras) {
      if (e.ruta === 'negocios/' + negocio.id) despues = { ...despues, ...e.campos };
    }
    return { escrituras: base.escrituras, despues };
  };
}

/** El candado del servidor (`negocioPuedeOperar`), con la copia del panel. */
function elCandado() {
  return cargarDeLaApp(PANEL + '/src/horarioNegocio.js').negocioPuedeOperar;
}

// Los tres casos que deciden. «igual» = lo que aprobar NO puede cambiar.
const CASOS = [
  { que: 'apagado en Cobros («La cuenta está viva» apagada) y suspendido',
    negocio: { id: 'caso-1', aprobado: false, estadoAprobacion: 'suspendido', activo: false, estadoComercial: 'alDia' } },
  { que: 'frenado en Cobros («Puede trabajar» apagado) y suspendido',
    negocio: { id: 'caso-2', aprobado: false, estadoAprobacion: 'suspendido', activo: true, estadoComercial: 'bloqueado' } },
  { que: 'recién registrado, pendiente (lo que aprobar SÍ tiene que seguir haciendo)',
    negocio: { id: 'caso-3', aprobado: false, estadoAprobacion: 'pendiente', activo: true } },
];

/** ¿Qué le hizo el botón al negocio? Lista de fallos (vacía = bien). */
function juzgar(antes, r) {
  const f = [];
  const d = r.despues;
  if (d.aprobado !== true) f.push('no quedó aprobado');
  if (d.estadoAprobacion !== 'aprobado') f.push('estadoAprobacion quedó ' + JSON.stringify(d.estadoAprobacion));
  if (typeof d.fechaAprobacion !== 'string' || Number.isNaN(Date.parse(d.fechaAprobacion))) f.push('sin fechaAprobacion');
  for (const k of ['activo', 'estadoComercial', 'visibleEnEscaparate']) {
    if (d[k] !== antes[k]) f.push(k + ': ' + JSON.stringify(antes[k]) + ' → ' + JSON.stringify(d[k]) + ' (lo pisó)');
  }
  const ajenas = r.escrituras.filter((e) => e.ruta !== 'negocios/' + antes.id);
  if (ajenas.length) f.push('escribió fuera del negocio: ' + ajenas.map((e) => e.ruta).join(', '));
  if (r.escrituras.length !== 1) f.push('hizo ' + r.escrituras.length + ' escrituras (tiene que ser 1)');
  return f;
}

/** Corre los tres botones contra los tres casos. Devuelve { filas, malos }. */
async function losCasos(commit, leerTexto = textoDe) {
  const filas = [];
  let malos = 0;
  for (const [ruta, nombre] of LOS_BOTONES) {
    const boton = elBoton(ruta, commit, leerTexto);
    for (const c of CASOS) {
      const r = await boton({ ...c.negocio });
      const fallos = juzgar(c.negocio, r);
      if (fallos.length) malos += 1;
      filas.push({ ruta, nombre, caso: c.que, fallos, despues: r.despues });
    }
  }
  return { filas, malos };
}

/** ¿Los tres botones usan la MISMA escritura? (una sola fuente) — compara lo que escriben, sin la fecha. */
function mismaEscritura(filas) {
  const firma = (d) => JSON.stringify(Object.keys(d).filter((k) => k !== 'fechaAprobacion' && k !== 'id').sort().map((k) => [k, d[k]]));
  const porCaso = {};
  for (const f of filas) (porCaso[f.caso] = porCaso[f.caso] || new Set()).add(firma(f.despues));
  return Object.values(porCaso).every((s) => s.size === 1);
}

async function main() {
  const commit = arg('--commit-panel');
  console.log('\n✅ APROBAR UN NEGOCIO — G49 · código del panel: ' + (commit || 'el del disco'));
  console.log('   pieza única ' + LA_PIEZA + ': ' + (textoDe(LA_PIEZA, commit) == null ? 'NO EXISTE' : 'existe'));

  const { filas, malos } = await losCasos(commit);
  console.log('\n1. LOS TRES BOTONES, EJECUTADOS CONTRA TRES CASOS:');
  for (const f of filas) {
    console.log('   ' + (f.fallos.length ? '🔴' : '✓ ') + ' ' + f.nombre.padEnd(22) + ' · ' + f.caso
      + (f.fallos.length ? '\n        ' + f.fallos.join(' · ') : ''));
  }
  console.log('   → ' + malos + ' de ' + filas.length + ' combinaciones pisan lo de Cobros o no aprueban bien');
  console.log('   → los tres botones escriben lo mismo: ' + (mismaEscritura(filas) ? 'SÍ' : 'NO'));

  // 2. Producción: las llaves de cada negocio, y qué le haría cada botón si se le aprobara hoy.
  const { traer, val } = require('./nube.cjs');
  const crudos = await traer('negocios');
  const puedeOperar = elCandado();
  console.log('\n2. PRODUCCIÓN · ' + crudos.length + ' negocios (las tres llaves + la aprobación):');
  let pisaria = 0;
  const botones = LOS_BOTONES.map(([ruta, nombre]) => [nombre, elBoton(ruta, commit)]);
  for (const d of crudos) {
    const f = d.fields || {};
    const id = d.name.split('/').pop();
    const n = { id };
    for (const k of ['aprobado', 'estadoAprobacion', 'activo', 'estadoComercial', 'visibleEnEscaparate', 'tipoNegocio', 'nombre']) {
      if (f[k] !== undefined) n[k] = val(f[k]);
    }
    const ver = (x) => (x === undefined ? '(sin campo)' : JSON.stringify(x));
    console.log('   · ' + id.slice(0, 10) + ' «' + (n.nombre || '') + '» ' + (n.tipoNegocio || '')
      + '\n       aprobado=' + ver(n.aprobado) + ' estadoAprobacion=' + ver(n.estadoAprobacion)
      + ' activo=' + ver(n.activo) + ' estadoComercial=' + ver(n.estadoComercial)
      + ' visibleEnEscaparate=' + ver(n.visibleEnEscaparate) + ' · el servidor lo deja operar: ' + (puedeOperar(n) ? 'sí' : 'NO'));
    for (const [nombre, boton] of botones) {
      const r = await boton({ ...n });
      const cambia = ['activo', 'estadoComercial'].filter((k) => r.despues[k] !== n[k]);
      if (cambia.length) pisaria += 1;
      if (cambia.length) console.log('       ' + nombre + ' le cambiaría: ' + cambia.map((k) => k + ' ' + ver(n[k]) + '→' + ver(r.despues[k])).join(', '));
    }
  }
  console.log('   → aprobar hoy le cambiaría una llave de Cobros a ' + pisaria + ' combinaciones negocio×botón'
    + ' (ojo: con las llaves encendidas, `activo: true` sobre un «(sin campo)» también cuenta como cambio)');

  console.log(malos ? '\n🔴 ' + malos + ' combinaciones pisan lo que se apagó en Cobros o no aprueban bien' : '\n✓ aprobar solo aprueba: ningún botón toca activo ni estadoComercial');
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + (e && e.message)); process.exit(1); });
}

module.exports = { LOS_BOTONES, CASOS, elBoton, laPieza, losCasos, juzgar, mismaEscritura, textoDe };
