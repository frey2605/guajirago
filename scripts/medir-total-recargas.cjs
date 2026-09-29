#!/usr/bin/env node
/**
 * 💰 ¿CUÁNTO SE HA RECARGADO? — LAS DOS CUENTAS DEL PANEL, contra producción. SOLO LECTURA.
 *
 * Pasos 1 y 12 del gemelo G54 (29-sep-2026). El panel contaba el total recargado DOS veces y con criterios distintos:
 *   · el tablero (guajirago-admin/src/App.js, Dashboard, `recargas`): los códigos con `usado === true`, sin mirar si
 *     están anulados, y la fecha leída con `new Date(c.fechaUso)` (un Timestamp daba «Invalid Date» y se caía);
 *   · 🎟️ Códigos (guajirago-admin/src/Codigos.js, `valorTotal`, la tarjeta «VALOR RECARGADO»): los que tienen `usado`
 *     con cualquier valor que parezca verdad Y NO están anulados.
 * Desde el arreglo, las dos salen de guajirago-admin/src/recargas.js (`totalRecargado`).
 *
 * Este guion NO copia ninguna de las dos cuentas: saca del archivo el renglón de cada pantalla y lo EJECUTA con los
 * códigos de verdad, así el paso 12 mide el código puesto y no una cuenta mía.
 *
 *   node scripts/medir-total-recargas.cjs                  → el código de la carpeta de trabajo
 *   node scripts/medir-total-recargas.cjs --commit-panel X → el panel de ese commit (careo antes/después)
 */
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { leer, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const APP = 'guajirago-admin/src/App.js';
const CODIGOS = 'guajirago-admin/src/Codigos.js';
const PIEZA = 'guajirago-admin/src/recargas.js';
const FECHA = 'guajirago-admin/src/fechaGuardada.js';

/** El texto de un archivo del panel: el de la carpeta de trabajo, o el de un commit del repo del panel. */
function fuente(ruta, commit) {
  if (!commit) {
    try { return leer(ruta); } catch (e) { return null; }
  }
  const rel = ruta.replace(/^guajirago-admin\//, '');
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, 'guajirago-admin'), 'show', commit + ':' + rel],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

/** Saca del texto el renglón `const <nombre> = ...;` (de una sola línea). null si no está. */
function renglon(texto, nombre) {
  const t = texto.replace(/\r\n/g, '\n');
  const m = t.match(new RegExp('\\n[ \\t]*(const ' + nombre + ' = [^\\n]*;)[ \\t]*\\n'));
  return m ? m[1] : null;
}

/**
 * Las dos cuentas del panel, EJECUTABLES, sacadas de sus archivos (del commit dado o de la carpeta de trabajo).
 *   · tablero(codigos, desde, hasta) → el `recargas` del Dashboard, con su `enRango` y su `fechaCodigo` si los usa;
 *   · pantalla(codigos)              → el `valorTotal` de 🎟️ Códigos.
 * Las piezas que importan (totalRecargado de recargas.js, msDeFecha de fechaGuardada.js) se cargan del MISMO commit.
 */
function lasDosCuentas(commit, textos = {}) {
  const tApp = textos.app != null ? textos.app : fuente(APP, commit);
  const tCod = textos.codigos != null ? textos.codigos : fuente(CODIGOS, commit);
  const tPieza = textos.pieza !== undefined ? textos.pieza : fuente(PIEZA, commit);
  assert.ok(tApp, 'no pude leer ' + APP);
  assert.ok(tCod, 'no pude leer ' + CODIGOS);
  const piezas = {};
  if (tPieza) Object.assign(piezas, cargarDeLaApp(PIEZA, tPieza));
  const tFecha = fuente(FECHA, commit);
  if (tFecha) Object.assign(piezas, cargarDeLaApp(FECHA, tFecha));

  const lRecargas = renglon(tApp, 'recargas');
  assert.ok(lRecargas, 'no encuentro «const recargas = …;» en el Dashboard de ' + APP);
  const auxiliares = ['fechaCodigo', 'enRango'].map((n) => renglon(tApp, n)).filter(Boolean);
  const lValor = renglon(tCod, 'valorTotal');
  assert.ok(lValor, 'no encuentro «const valorTotal = …;» en ' + CODIGOS);

  const nombres = Object.keys(piezas);
  const valores = nombres.map((n) => piezas[n]);
  // eslint-disable-next-line no-new-func
  const hacerTablero = new Function('codigos', ...nombres, auxiliares.join('\n') + '\n' + lRecargas + '\nreturn recargas;');
  // eslint-disable-next-line no-new-func
  const hacerPantalla = new Function('codigos', ...nombres, lValor + '\nreturn valorTotal;');
  return {
    tablero: (codigos, desde, hasta) => hacerTablero(codigos, ...valores)(desde, hasta),
    pantalla: (codigos) => hacerPantalla(codigos, ...valores),
    usaLaPieza: /\btotalRecargado\(/.test(lRecargas) && /\btotalRecargado\(/.test(lValor),
  };
}

const MUY_ATRAS = new Date(2000, 0, 1);

async function main() {
  const N = require('./nube.cjs');
  const i = process.argv.indexOf('--commit-panel');
  const commit = i > 0 ? process.argv[i + 1] : null;
  const C = lasDosCuentas(commit);
  const codigos = (await N.traer('codigos')).map(N.doc);
  const pesos = (n) => '$' + Number(n).toLocaleString('es-CO');

  console.log('Panel: ' + (commit ? 'commit ' + commit : 'carpeta de trabajo') + ' · las dos pantallas usan totalRecargado: '
    + (C.usaLaPieza ? 'SÍ' : 'NO'));
  console.log('Códigos en producción: ' + codigos.length);
  const cuenta = (f) => codigos.filter(f).length;
  console.log('  usado === true: ' + cuenta((c) => c.usado === true)
    + ' · usado «parece verdad» sin ser true: ' + cuenta((c) => c.usado && c.usado !== true)
    + ' · usados Y anulados: ' + cuenta((c) => c.usado === true && c.anulado === true)
    + ' · anulados sin usar: ' + cuenta((c) => c.anulado === true && c.usado !== true)
    + ' · sin usar con fecha de uso (escritos encima): ' + cuenta((c) => c.usado !== true && c.fechaUso));
  console.log('  fecha de uso que no es texto: ' + cuenta((c) => c.fechaUso && typeof c.fechaUso !== 'string')
    + ' · valor que no es número: ' + cuenta((c) => c.valor != null && typeof c.valor !== 'number'));

  const tablero = C.tablero(codigos, MUY_ATRAS, null);
  const pantalla = C.pantalla(codigos);
  console.log('\nTOTAL DE SIEMPRE');
  console.log('  tablero (💰 Recargas, desde el año 2000 hasta hoy): ' + pesos(tablero));
  console.log('  🎟️ Códigos («VALOR RECARGADO»):                      ' + pesos(pantalla));
  console.log('  ' + (tablero === pantalla ? '✓ dicen lo mismo' : '🔴 NO dicen lo mismo: diferencia ' + pesos(tablero - pantalla)));

  console.log('\nMES POR MES (lo que el tablero pinta en «Este mes» ese mes):');
  const meses = new Set(codigos.filter((c) => typeof c.fechaUso === 'string').map((c) => c.fechaUso.slice(0, 7)));
  for (const k of [...meses].sort()) {
    const [a, m] = k.split('-').map(Number);
    console.log('  ' + k + ': ' + pesos(C.tablero(codigos, new Date(a, m - 1, 1), new Date(a, m, 0, 23, 59, 59))));
  }
  const { tiposQueNoSupe } = N;
  if (tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + tiposQueNoSupe().join(', '));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { lasDosCuentas, renglon };
