#!/usr/bin/env node
/**
 * 🔒 ¿EL CANDADO TIENE SU PROPIO TEXTO DE FALLO? — gemelo G76 (29-sep-2026), SOLO LECTURA.
 *
 * LA LEY DEL BOTÓN (CLAUDE.md del proyecto) dice que el motivo de un fallo NO lo calcula el candado: lo da
 * `motivoDeRechazo` de avisoRechazo.js, la única pieza que lo sabe decir. Pero candado.js guardaba su propio texto,
 * «No se pudo completar. Revisa la señal y vuelve a intentar.», para dos caminos: cuando nadie le pasaba `traducir`, y
 * cuando la acción devolvía `{ ok: false }` sin decir por qué. No toca datos: es solo código.
 *
 *   node scripts/medir-texto-candado.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-texto-candado.cjs --commit <hash>  <- el candado de otro commit de la raíz (careo)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Los textos de fallo escritos DENTRO del candado (sin comentarios): textos con «No se pudo», «Revisa» o «falló».
 *     El del tope de 20 s («No se pudo confirmar. Revisa si quedó hecho…») NO cuenta: es ley y tiene que quedar igual.
 *  2. El candado EJECUTADO en siete casos, y si lo que dice sale de la pieza única (motivoDeRechazo con lo mismo).
 *  3. El texto del tope, letra por letra.
 *  4. En las TRES apps: cuántas acciones devuelven `{ ok: false }` SIN su motivo (ni `error` ni `avisado`). Ésas son las
 *     que llegaban al texto propio del candado: si son 0, el gemelo existe pero hoy no muerde.
 *  5. Que las tres copias de candado.js sean la misma (solo en el disco).
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo, sonLaMismaCopia } = require('../pruebas/cargar.cjs');

const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const TOPE_LEY = 'No se pudo confirmar. Revisa si quedó hecho antes de volver a intentar.';

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}
function leerDe(commit, r) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, r), 'utf8');
  return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** Los textos entre comillas del código (sin comentarios) que hablan de un fallo, menos el del tope. */
function textosPropios(fuente) {
  const codigo = soloCodigo(fuente);
  const textos = [...codigo.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]);
  return textos.filter((t) => /No se pudo|Revisa|fall[oó]/i.test(t) && t !== TOPE_LEY);
}

const esperar = () => new Promise((ok) => setImmediate(ok));
const reloj = () => { const p = new Map(); let n = 0; return { poner: (fn) => { p.set(++n, fn); return n; }, quitar: (id) => p.delete(id), vencer: () => { for (const [id, fn] of p) { p.delete(id); fn(); } } }; };

/** Corre el candado (fuente dada) en un caso, SIN pasarle `traducir` salvo que el caso lo pida. Devuelve el aviso. */
async function correrCaso(fuente, caso, RZ) {
  const C = cargarDeLaApp('guajirago/src/candado.js', fuente);
  const avisos = [];
  const r = reloj();
  const opciones = { alAviso: (a) => avisos.push(a), reloj: r };
  if (caso.conTraducir) opciones.traducir = RZ.motivoDeRechazo;
  const c = C.crearCandado(opciones);
  const p = c.correr(caso.fn, 'x', 'Listo.', caso.accion);
  await esperar();
  if (caso.tope) r.vencer();
  await p;
  return avisos[0] || null;
}

const permiso = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
const CASOS = [
  { n: 'revienta sin permiso, nadie le pasa `traducir`', fn: async () => { throw permiso(); }, accion: 'guardar la ficha', unica: (RZ) => RZ.motivoDeRechazo(permiso(), 'guardar la ficha') },
  { n: 'revienta con un código raro, nadie le pasa `traducir`', fn: async () => { throw Object.assign(new Error('x'), { code: 'internal' }); }, accion: 'recargar', unica: (RZ) => RZ.motivoDeRechazo({ code: 'internal' }, 'recargar') },
  { n: 'devuelve { ok: false } sin motivo, con lo que intentaba', fn: async () => ({ ok: false }), accion: 'aplicar el código', unica: (RZ) => RZ.motivoDeRechazo(null, 'aplicar el código') },
  { n: 'devuelve { ok: false } sin motivo, sin decir qué intentaba', fn: async () => ({ ok: false }), accion: undefined, unica: (RZ) => RZ.motivoDeRechazo(null, undefined) },
  { n: 'devuelve { ok: false, error } (Promociones), con lo que intentaba', fn: async () => ({ ok: false, error: 'Escribe un código de promoción' }), accion: 'aplicar el código', espera: { titulo: 'No se pudo aplicar el código', texto: 'Escribe un código de promoción' } },
  { n: 'devuelve { ok: false, avisado: true }: no saca otra ventanita', fn: async () => ({ ok: false, avisado: true }), accion: 'pedir', espera: null },
  { n: 'no contesta: el tope de 20 s (ley)', fn: () => new Promise(() => {}), accion: 'pagar', tope: true, conTraducir: true, espera: { titulo: 'Sin confirmar', texto: TOPE_LEY } },
];

/** Las acciones de las tres apps que devuelven { ok: false } sin motivo. */
function sinMotivoEnLasApps() {
  const out = [];
  let total = 0;
  for (const app of APPS) {
    const dir = path.join(RAIZ, app);
    if (!fs.existsSync(dir)) continue;
    // candado.js no cuenta: su propio { ok: false } es el que ARMA el aviso, no una acción de pantalla.
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js') && x !== 'candado.js')) {
      const codigo = soloCodigo(fs.readFileSync(path.join(dir, f), 'utf8'));
      for (const m of codigo.matchAll(/return\s*\{\s*ok:\s*false\b([^}]*)\}/g)) {
        total++;
        if (!/\berror\b|\bavisado\b/.test(m[1])) out.push(app + '/' + f + ' · ' + m[0].replace(/\s+/g, ' '));
      }
    }
  }
  return { total, sinMotivo: out };
}

async function medir({ commit = null, fuente = null } = {}) {
  const src = fuente != null ? fuente : leerDe(commit, 'guajirago/src/candado.js');
  const RZ = cargarDeLaApp('guajirago/src/avisoRechazo.js');
  const propios = textosPropios(src);
  const casos = [];
  for (const caso of CASOS) {
    let visto;
    try { visto = await correrCaso(src, caso, RZ); } catch (e) { visto = { revento: e.message }; }
    const esperado = caso.unica ? caso.unica(RZ) : caso.espera;
    const quedo = visto && !visto.revento ? { titulo: visto.titulo, texto: visto.texto } : visto;
    const bien = esperado === null ? visto === null : !!(quedo && !quedo.revento && quedo.titulo === esperado.titulo && quedo.texto === esperado.texto);
    casos.push({ caso: caso.n, deLaPiezaUnica: !!caso.unica, dice: quedo, deberia: esperado && { titulo: esperado.titulo, texto: esperado.texto }, bien });
  }
  const C = cargarDeLaApp('guajirago/src/candado.js', src);
  const copias = fuente == null && !commit
    ? APPS.slice(1).filter((a) => fs.existsSync(path.join(RAIZ, a, 'candado.js'))).map((a) => ({ app: a, igual: sonLaMismaCopia(fs.readFileSync(path.join(RAIZ, a, 'candado.js'), 'utf8'), src) }))
    : null;
  return {
    textosPropios: propios,
    casos,
    casosQueNoSalenDeLaPieza: casos.filter((c) => c.deLaPiezaUnica && !c.bien).length,
    casosMal: casos.filter((c) => !c.bien).length,
    topeIgual: C.NO_CONFIRMADO === TOPE_LEY,
    apps: sinMotivoEnLasApps(),
    copias,
  };
}

module.exports = { medir, textosPropios, TOPE_LEY };

if (require.main === module) {
  (async () => {
    const commit = argumento('--commit');
    const r = await medir({ commit });
    console.log('\n🔒 EL TEXTO DE FALLO DEL CANDADO — ' + (commit ? 'commit ' + commit : 'el disco'));
    console.log('\n1. Textos de fallo escritos en el candado (sin contar el del tope): ' + r.textosPropios.length);
    for (const t of r.textosPropios) console.log('     · «' + t + '»');
    console.log('\n2. El candado ejecutado:');
    for (const c of r.casos) {
      console.log('   ' + (c.bien ? '✓' : '✗') + ' ' + c.caso);
      console.log('       dice:     ' + JSON.stringify(c.dice));
      if (!c.bien) console.log('       debería:  ' + JSON.stringify(c.deberia));
    }
    console.log('   casos que NO salen de la pieza única (motivoDeRechazo): ' + r.casosQueNoSalenDeLaPieza + ' de ' + r.casos.filter((c) => c.deLaPiezaUnica).length);
    console.log('\n3. El texto del tope de 20 s, letra por letra: ' + (r.topeIgual ? '✓ igual' : '✗ CAMBIÓ'));
    console.log('\n4. Acciones de las tres apps que devuelven { ok: false }: ' + r.apps.total + ' · sin su motivo (llegan al texto del candado): ' + r.apps.sinMotivo.length);
    for (const s of r.apps.sinMotivo) console.log('     · ' + s);
    if (r.copias) console.log('\n5. Copias de candado.js: ' + r.copias.map((c) => c.app + ' ' + (c.igual ? '✓ igual' : '✗ DISTINTA')).join(' · '));
    const ok = r.textosPropios.length === 0 && r.casosMal === 0 && r.topeIgual && (!r.copias || r.copias.every((c) => c.igual));
    console.log('\n' + (ok ? '✓ el candado no tiene texto de fallo propio: lo dice la pieza única' : '✗ el candado todavía decide su propio texto de fallo') + '\n');
  })().catch((e) => { console.error(e); process.exit(1); });
}
