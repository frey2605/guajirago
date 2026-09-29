#!/usr/bin/env node
/**
 * 💳 ¿CÓMO SE LE DICE AL CONDUCTOR QUE NO LE ALCANZA EL SALDO? — gemelo G69 (29-sep-2026), SOLO LECTURA.
 *
 * AppConductor.js frena al conductor por saldo en DOS sitios: al prender el interruptor («recibir viajes») y al
 * aceptar o contraofertar una solicitud («tomar viajes»). Los dos avisaban con un `alert()` del navegador, cada uno
 * con su propio texto escrito a mano. La regla del proyecto dice que los avisos son ventanitas (AvisoModal).
 *
 *   node scripts/medir-aviso-sin-saldo.cjs                 <- el código de hoy (el disco) + producción
 *   node scripts/medir-aviso-sin-saldo.cjs --commit <hash> <- otro commit de la raíz (careo)
 *   --sin-nube                                             <- no lee producción
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Cada freno por saldo de AppConductor.js: todo `if (...saldoCreditos < ...) { ... }`. Se SACA del archivo y se
 *     CORRE su cuerpo con un `alert`, un `setAviso` y un `onAviso` de mentira: qué camino usa (alert o ventanita) y
 *     qué texto enseña. El texto de la ventanita sale del textosViaje.js de ese mismo commit.
 *  2. La DECISIÓN de cada freno (el umbral), corrida con una tabla de saldos, tipos de viaje, vehículos y la config:
 *     el arreglo NO puede moverla. Se imprime su huella para carear antes y después.
 *  3. Cuántos `alert(` quedan en AppConductor.js y cuántos textos de «saldo suficiente» escritos a mano en las
 *     pantallas de la app (fuera de textosViaje.js).
 *  4. PRODUCCIÓN (solo lectura): cuántos conductores hay y cuántos, con su saldo de hoy, verían el aviso al prender
 *     el interruptor (con la calculadora de la app, comisiones.js, y la config/global de verdad).
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp, soloCodigo, sinTextos } = require('../pruebas/cargar.cjs');

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo de la raíz: del disco, o de un commit. */
function lector(commit) {
  return (r) => {
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Lo que va entre la llave que abre en `i` y su pareja (sobre el texto sin textos, devuelto del original). */
function entreLlaves(seguro, original, i) {
  let p = 0;
  for (let j = i; j < seguro.length; j += 1) {
    if (seguro[j] === '{') p += 1;
    else if (seguro[j] === '}') { p -= 1; if (p === 0) return original.slice(i + 1, j); }
  }
  return null;
}

/** La llave sin cerrar más cercana hacia atrás desde `i`: donde empieza el bloque que contiene al freno. */
function llaveQueLoContiene(seguro, i) {
  let p = 0;
  for (let j = i - 1; j >= 0; j -= 1) {
    if (seguro[j] === '}') p += 1;
    else if (seguro[j] === '{') { if (p === 0) return j; p -= 1; }
  }
  return -1;
}

/** 1 · Los frenos por saldo de AppConductor.js: condición, lo que va antes en su bloque, y su cuerpo. */
function frenosDe(texto) {
  const codigo = soloCodigo(texto.replace(/\r\n/g, '\n'));
  const seguro = sinTextos(codigo);
  const frenos = [];
  for (const m of seguro.matchAll(/if\s*\(([^{};]*\bsaldoCreditos\s*<[^{};]*)\)\s*\{/g)) {
    const llave = m.index + m[0].length - 1;
    const cuerpo = entreLlaves(seguro, codigo, llave);
    const abre = llaveQueLoContiene(seguro, m.index);
    const antes = abre >= 0 ? codigo.slice(abre + 1, m.index) : '';
    frenos.push({ renglon: codigo.slice(0, m.index).split('\n').length, condicion: codigo.slice(m.index, m.index + m[0].length).replace(/^if\s*\(/, '').replace(/\)\s*\{$/, ''), antes, cuerpo });
  }
  return { frenos, alerts: (seguro.match(/\balert\s*\(/g) || []).length };
}

/** Corre el cuerpo de un freno con un alert, un setAviso y un onAviso de mentira. */
function quéDice(freno, AVISO_SIN_SALDO) {
  const dichos = [];
  const alert = (t) => dichos.push({ via: 'alert()', texto: String(t) });
  const ventanita = (a) => dichos.push({ via: 'ventanita', texto: a && a.texto, titulo: a && a.titulo });
  try {
    // eslint-disable-next-line no-new-func
    new Function('alert', 'setAviso', 'onAviso', 'onAvisoRef', 'AVISO_SIN_SALDO', freno.cuerpo)(alert, ventanita, ventanita, { current: ventanita }, AVISO_SIN_SALDO);
  } catch (e) { dichos.push({ via: 'reventó', texto: e.message }); }
  return dichos;
}

/** 2 · La decisión de un freno, corrida con una tabla de casos. Devuelve la lista de «frena / no frena». */
function decisiones(freno, comisiones) {
  // eslint-disable-next-line no-new-func
  const f = new Function('saldoCreditos', 'activo', 'solicitud', 'configApp', 'tipoVehiculo', 'comisionSegunTipoDeViaje', 'comisionParaActivarse',
    freno.antes + '\nreturn (' + freno.condicion + ');');
  const salida = [];
  const CFGS = [{ comisionMototaxi: 400, comisionTaxi: 800, comisionDomicilio: 1000 }, {}];
  for (const cfg of CFGS) for (const saldo of [null, 0, 299, 300, 399, 400, 799, 800, 999, 1000, 5000])
    for (const tipo of ['Taxi', 'Mototaxi', 'Mensajería', undefined]) for (const tv of ['Taxi', 'Mototaxi', ''])
      for (const activo of [false, true]) {
        let r;
        try { r = !!f(saldo, activo, { tipo }, cfg, tv, comisiones.comisionSegunTipoDeViaje, comisiones.comisionParaActivarse); } catch (e) { r = 'reventó'; }
        salida.push(r);
      }
  return salida;
}

function medirCodigo(leerDe) {
  const app = leerDe('guajirago/src/AppConductor.js');
  if (!app) throw new Error('no encontré AppConductor.js');
  const textos = leerDe('guajirago/src/textosViaje.js');
  const { AVISO_SIN_SALDO } = textos ? cargarDeLaApp('guajirago/src/textosViaje.js', textos) : {};
  const comisiones = cargarDeLaApp('guajirago/src/comisiones.js', leerDe('guajirago/src/comisiones.js'));
  const { frenos, alerts } = frenosDe(app);
  const sitios = frenos.map((f) => {
    const dice = quéDice(f, AVISO_SIN_SALDO);
    const tabla = decisiones(f, comisiones);
    return { renglon: f.renglon, dice, frena: tabla.filter((x) => x === true).length, casos: tabla.length, huella: crypto.createHash('sha1').update(JSON.stringify(tabla)).digest('hex').slice(0, 10) };
  });
  // 3 · Textos de «saldo suficiente» escritos a mano en las pantallas (fuera de la pieza de textos).
  const aMano = [];
  const dir = path.join(RAIZ, 'guajirago/src');
  for (const nombre of fs.readdirSync(dir)) {
    if (!/\.js$/.test(nombre) || nombre === 'textosViaje.js' || /\.test\.js$/.test(nombre)) continue;
    const t = leerDe('guajirago/src/' + nombre);
    if (!t) continue;
    const n = (soloCodigo(t).match(/(['"`])[^'"`\n]*saldo suficiente para (?:recibir|tomar|aceptar)[^'"`\n]*\1/g) || []).length;
    if (n) aMano.push({ archivo: nombre, n });
  }
  const textosDistintos = new Set(sitios.flatMap((s) => s.dice.map((d) => d.texto))).size;
  return { sitios, alerts, aMano, textosDistintos, AVISO_SIN_SALDO };
}

async function medirNube() {
  const N = require('./nube.cjs');
  const APP = cargarDeLaApp('guajirago/src/comisiones.js');
  const usuarios = (await N.traer('usuarios')).map(N.doc);
  const conductores = usuarios.filter((u) => u.tipo === 'conductor');
  const config = (await N.traer('config')).map(N.doc).find((d) => d.id === 'global') || {};
  const cfg = { ...APP.COMISIONES_DEFECTO, ...config };
  const loVerian = conductores.filter((c) => (Number(c.creditos) || 0) < APP.comisionParaActivarse(c.tipoVehiculo || '', cfg));
  return { conductores: conductores.length, loVerian: loVerian.map((c) => ({ id: c.id, saldo: Number(c.creditos) || 0, tv: c.tipoVehiculo || '(sin tipo)', pide: APP.comisionParaActivarse(c.tipoVehiculo || '', cfg) })) };
}

async function main() {
  const commit = argumento('--commit');
  const r = medirCodigo(lector(commit));
  console.log('💳 Aviso de «no tienes saldo» del conductor — ' + (commit ? 'commit ' + commit : 'el disco'));
  console.log('  frenos por saldo en AppConductor.js: ' + r.sitios.length);
  for (const s of r.sitios) {
    for (const d of s.dice) console.log('    · renglón ' + s.renglon + ' → ' + d.via + ': «' + d.texto + '»' + (d.titulo ? ' (título «' + d.titulo + '»)' : ''));
    console.log('      decisión: frena en ' + s.frena + ' de ' + s.casos + ' casos · huella ' + s.huella);
  }
  const porAlert = r.sitios.filter((s) => s.dice.some((d) => d.via === 'alert()')).length;
  console.log('  frenos que avisan con alert(): ' + porAlert + ' · con ventanita: ' + r.sitios.filter((s) => s.dice.some((d) => d.via === 'ventanita')).length);
  console.log('  textos distintos entre los frenos: ' + r.textosDistintos);
  console.log('  alert( en AppConductor.js: ' + r.alerts);
  console.log('  textos de «saldo suficiente» escritos a mano en pantallas: ' + (r.aMano.map((a) => a.archivo + ' ×' + a.n).join(', ') || '0'));
  console.log('  la pieza AVISO_SIN_SALDO en textosViaje.js: ' + (r.AVISO_SIN_SALDO ? 'sí' : 'no existe'));
  if (process.argv.includes('--sin-nube')) return;
  const n = await medirNube();
  console.log('  PRODUCCIÓN: conductores ' + n.conductores + ' · verían el aviso al prender el interruptor con su saldo de hoy: ' + n.loVerian.length);
  for (const c of n.loVerian) console.log('    · ' + c.id + ' (' + c.tv + ') saldo $' + c.saldo + ', pide $' + c.pide);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { medirCodigo, frenosDe, quéDice, decisiones, lector };
