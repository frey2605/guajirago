#!/usr/bin/env node
/**
 * 🚗 ¿QUIÉN PUEDE LEER LA FICHA DE UN CONDUCTOR, Y POR DÓNDE VE EL PASAJERO EL CARRO? — SOLO LECTURA.
 *
 * Pasos 1 y 12 de P19 (1-oct-2026). La ficha `conductores/{uid}` lleva el teléfono, la placa, el nombre, el token de
 * avisos y la ubicación en vivo del conductor. Hasta P19 la podía leer cualquiera con sesión que supiera el uid, porque
 * el mapa del pasajero seguía al carro leyéndola. Este guion dice:
 *   · REGLAS: quién puede hacer `get` de la ficha, y si existe el sitio del carro en vivo (`viajes/{id}/enVivo/{cual}`);
 *   · CÓDIGO: qué pantallas de USUARIO (app y aliados) LEEN la ficha, y cuáles leen el carro en vivo;
 *   · con --publicado: lo mismo en el paquete PUBLICADO de la app, en producción y en pruebas;
 *   · con --nube: cuántas fichas hay en producción y qué datos de personas llevan;
 *   · con --commit <hash>: las reglas y el código de la app de ese commit (careo antes/después).
 * Veredicto: si la ficha sigue abierta a todos, y si el mapa del pasajero lee de un sitio que las reglas le dejan.
 *
 *   node scripts/medir-ubicacion-conductor.cjs [--commit <hash>] [--publicado] [--nube]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./medir-lectura-ajena.cjs');

const RAIZ = path.resolve(__dirname, '..');
const LEE = /\b(onSnapshot|getDoc|getDocs|getDocFromServer|getDocsFromServer)\s*\(/;

/** Las lecturas que las reglas declaran para una ruta: [condición, ...]. */
function lecturasDe(reglas, ruta, op) {
  return L.lecturasDeLasReglas(reglas).filter((l) => l.ruta === ruta && (l.ops.includes(op) || l.ops.includes('read'))).map((l) => l.condicion);
}

/** ¿Quién puede hacer `get` de la ficha de un conductor? 'todos' | 'él y el panel' | 'nadie' | 'otro: <condición>'. */
function quienLeeLaFicha(reglas) {
  const c = lecturasDe(reglas, '/conductores/{conductorId}', 'get');
  if (!c.length) return 'nadie';
  if (c.some(L.abiertaATodos)) return 'todos';
  const solo = c.map((x) => x.replace(/\s+/g, ''));
  if (solo.every((x) => x === 'request.auth!=null&&(request.auth.uid==conductorId||esAdmin())')) return 'él y el panel';
  return 'otro: ' + c.join(' | ');
}

/** ¿Las reglas tienen el sitio del carro en vivo, y quién lo lee? null si no existe. */
function reglaEnVivo(reglas) {
  const c = lecturasDe(reglas, '/viajes/{viajeId}/enVivo/{cual}', 'get');
  return c.length ? c.join(' | ') : null;
}

/** Renglones de un archivo que LEEN la ficha del conductor (una escritura con setDoc no cuenta). */
function leeLaFicha(texto) {
  const r = [];
  texto.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const codigo = l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/\s.*$/, '');
    if (LEE.test(codigo) && /['"`]conductores['"`]/.test(codigo)) r.push(i + 1);
  });
  return r;
}

/** Renglones que LEEN el carro en vivo (por la pieza `refUbicacionEnVivo` o nombrando 'enVivo'). */
function leeElCarroEnVivo(texto) {
  const r = [];
  texto.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const codigo = l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/\s.*$/, '');
    if (LEE.test(codigo) && /refUbicacionEnVivo\s*\(|['"`]enVivo['"`]/.test(codigo)) r.push(i + 1);
  });
  return r;
}

/** Los archivos .js de las apps de usuario: del disco, o de un commit (solo la app; aliados es otro repo). */
function archivosDeUsuario(commit) {
  if (!commit) {
    const out = [];
    const ver = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) ver(p);
        else if (/\.(c?js|jsx)$/.test(e.name) && !/\.test\.js$/.test(e.name)) out.push({ rel: path.relative(RAIZ, p).replace(/\\/g, '/'), texto: () => fs.readFileSync(p, 'utf8') });
      }
    };
    ver(path.join(RAIZ, 'guajirago/src'));
    ver(path.join(RAIZ, 'guajirago-aliados/src'));
    return out;
  }
  const lista = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, 'guajirago/src'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(c?js|jsx)$/.test(f) && !/\.test\.js$/.test(f));
  return lista.map((rel) => ({ rel, texto: () => execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 }) }));
}

/** En el paquete minificado: lecturas de la ubicación de la ficha y menciones del carro en vivo. */
function enElPaquete(texto) {
  let ficha = 0;
  const re = /["'`]conductores["'`]/g;
  let m;
  while ((m = re.exec(texto))) if (/\.data\(\)\.ubicacion/.test(texto.slice(m.index, m.index + 300))) ficha += 1;
  return { leeLaFicha: ficha, enVivo: (texto.match(/["'`]enVivo["'`]/g) || []).length };
}

const SENSIBLES = ['telefono', 'fcmToken', 'placa', 'nombre', 'ubicacion'];
function datosDeLasFichas(docs) {
  const r = { fichas: docs.length };
  for (const k of SENSIBLES) r[k] = docs.filter((d) => d[k] !== undefined && d[k] !== null && d[k] !== '').length;
  return r;
}

function veredicto({ quien, enVivo, lectoresFicha, lectoresEnVivo }) {
  const v = [];
  if (quien === 'todos') v.push('🔴 la ficha del conductor (teléfono, placa, token, ubicación) la lee cualquiera con sesión que sepa su uid');
  if (lectoresFicha.length && quien !== 'todos') v.push('🔴 ' + lectoresFicha.length + ' pantalla(s) de usuario leen la ficha y las reglas no las dejan: el carro no se movería');
  if (lectoresEnVivo.length && !enVivo) v.push('🔴 la app lee el carro en vivo pero las reglas no tienen ese sitio: el carro no se movería');
  if (!lectoresFicha.length && !lectoresEnVivo.length) v.push('🔴 ninguna pantalla sigue al carro: el pasajero no lo vería moverse');
  return v;
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const reglas = commit ? execFileSync('git', ['show', commit + ':firestore.rules'], { cwd: RAIZ, encoding: 'utf8' }) : fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8');
  const quien = quienLeeLaFicha(reglas);
  const enVivo = reglaEnVivo(reglas);
  const lectoresFicha = [];
  const lectoresEnVivo = [];
  for (const f of archivosDeUsuario(commit)) {
    const t = f.texto();
    for (const n of leeLaFicha(t)) lectoresFicha.push(f.rel + ':' + n);
    for (const n of leeElCarroEnVivo(t)) lectoresEnVivo.push(f.rel + ':' + n);
  }
  console.log('── LA FICHA DEL CONDUCTOR Y EL CARRO EN VIVO · ' + (commit || 'hoy') + ' ──');
  console.log('  reglas · get de conductores/{uid}: ' + quien);
  console.log('  reglas · viajes/{id}/enVivo/conductor: ' + (enVivo ? 'existe (get: ' + enVivo.replace(/\s+/g, ' ').slice(0, 160) + '…)' : 'NO existe'));
  console.log('  código · pantallas de usuario que LEEN la ficha: ' + (lectoresFicha.join(' · ') || 'ninguna'));
  console.log('  código · pantallas de usuario que leen el carro en vivo: ' + (lectoresEnVivo.join(' · ') || 'ninguna'));
  if (process.argv.includes('--publicado')) {
    for (const sitio of ['guajirago', 'guajirago-pruebas']) {
      const p = await L.paquete(sitio); // eslint-disable-line no-await-in-loop
      const e = enElPaquete(p.texto);
      console.log('  publicado · ' + sitio + '.web.app (' + p.nombre.split('/').pop() + '): lee la ubicación de la ficha ' + e.leeLaFicha + ' vez/veces · nombra enVivo ' + e.enVivo);
    }
  }
  if (process.argv.includes('--nube')) {
    const N = require('./nube.cjs');
    const d = datosDeLasFichas((await N.traer('conductores')).map(N.doc));
    console.log('  producción · ' + d.fichas + ' fichas de conductor · con ' + SENSIBLES.map((k) => k + ' ' + d[k]).join(', '));
    const vivos = (await N.traer('viajes')).map(N.doc).filter((v) => v.estado === 'aceptado');
    console.log('  producción · viajes vivos (aceptado) ahora: ' + vivos.length);
  }
  const v = veredicto({ quien, enVivo, lectoresFicha, lectoresEnVivo });
  console.log('\n── VEREDICTO ──\n  ' + (v.length ? v.join('\n  ') : '✓ la ficha solo la leen él y el panel, y el pasajero sigue al carro desde el viaje vivo'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { quienLeeLaFicha, reglaEnVivo, leeLaFicha, leeElCarroEnVivo, enElPaquete, datosDeLasFichas, veredicto, archivosDeUsuario };
