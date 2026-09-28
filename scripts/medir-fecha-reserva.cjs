#!/usr/bin/env node
/**
 * ¿QUÉ DÍA VE CADA UNO EN UNA RESERVA DE TURISMO? — gemelo G11 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-fecha-reserva.cjs                          (el código de ahora, contra producción)
 *   node scripts/medir-fecha-reserva.cjs --en raiz=<c>,aliados=<c> (el código de esos commits, mismos datos)
 *
 * La reserva guarda `fecha` como la escribe el calendario del celular: «2026-10-05» (un
 * DÍA, sin hora). Dos pantallas la pintan:
 *   · el CLIENTE  — guajirago/src/Turismo.js («Mis reservas»)
 *   · la AGENCIA  — guajirago-aliados/src/ReservasTurismo.js
 * Este guion NO copia cómo las pinta: saca del archivo la función que se llama con
 * `r.fecha` y la CORRE con cada reserva de producción, con la hora de Colombia
 * (America/Bogota). Si el archivo la pide a fechaCalendario.js, carga esa pieza.
 * Así el paso 12 cuenta con el mismo contador, y `--en` carea el antes.
 *
 * No escribe nada.
 */
process.env.TZ = 'America/Bogota';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLAS = {
  cliente: 'guajirago/src/Turismo.js',
  agencia: 'guajirago-aliados/src/ReservasTurismo.js',
};

// Lee un archivo del disco, o del commit dado (cada app es su propio repo).
function leerArchivo(ruta, commit) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
  const repo = ruta.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : ruta.startsWith('guajirago-admin/') ? 'guajirago-admin' : '.';
  const dentro = repo === '.' ? ruta : ruta.slice(repo.length + 1);
  const c = commit[repo] || commit['.'];
  return execSync('git -C "' + path.join(RAIZ, repo) + '" show ' + c + ':' + dentro, { encoding: 'utf8', maxBuffer: 1 << 26 });
}

// Carga los `export const` de una pieza (como pruebas/cargar.cjs, pero desde texto).
function cargarPieza(fuente) {
  const nombres = [...fuente.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  return new Function(fuente.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
}

/**
 * La función con que la pantalla pinta `r.fecha`, sacada del archivo y lista para correr.
 * Devuelve { nombre, pinta } o lanza si no la encuentra (un medidor que no encuentra lo que
 * mide no firma nada).
 */
function elPintorDe(ruta, commit, leer = leerArchivo) {
  const fuente = leer(ruta, commit).replace(/\r\n/g, '\n');
  const usos = [...fuente.matchAll(/\{\s*([A-Za-z0-9_]+)\(\s*r\.fecha\s*\)\s*\}/g)].map((m) => m[1]);
  if (usos.length !== 1) throw new Error(ruta + ': esperaba UNA llamada que pinte {X(r.fecha)} y hay ' + usos.length);
  const nombre = usos[0];
  const defs = [...fuente.matchAll(new RegExp('^\\s*const ' + nombre + ' = (.*);\\s*$', 'gm'))];
  if (defs.length > 1) throw new Error(ruta + ': hay ' + defs.length + ' definiciones de ' + nombre);
  let ambiente = {};
  if (/from '\.\/fechaCalendario'/.test(fuente)) {
    ambiente = cargarPieza(leer(path.posix.dirname(ruta) + '/fechaCalendario.js', commit));
  }
  if (!defs.length) {
    if (typeof ambiente[nombre] === 'function') return { nombre, pinta: ambiente[nombre] };
    throw new Error(ruta + ': no encuentro la definición de ' + nombre);
  }
  const claves = Object.keys(ambiente);
  // eslint-disable-next-line no-new-func
  const pinta = new Function(...claves, 'return (' + defs[0][1] + ');')(...claves.map((k) => ambiente[k]));
  return { nombre, pinta };
}

// El día del mes que dice un texto pintado («lunes, 5 de octubre» → 5).
const diaDelTexto = (t) => { const m = /\b(\d{1,2})\b/.exec(String(t)); return m ? Number(m[1]) : null; };

async function main() {
  const i = process.argv.indexOf('--en');
  let commit = null;
  if (i > 0) {
    const v = process.argv[i + 1] || '';
    commit = {};
    for (const parte of v.split(',')) {
      const [k, c] = parte.includes('=') ? parte.split('=') : ['.', parte];
      commit[k === 'raiz' ? '.' : k === 'aliados' ? 'guajirago-aliados' : k] = c;
    }
  }
  const pintores = {};
  for (const [quien, ruta] of Object.entries(PANTALLAS)) pintores[quien] = elPintorDe(ruta, commit);

  const { traer, doc } = require('./nube.cjs');
  const reservas = (await traer('reservasTurismo')).map(doc);
  const cuenta = { total: reservas.length, sinFecha: 0, formatoDia: 0, otroFormato: 0, iguales: 0, distintas: 0 };
  const ejemplos = [];
  for (const r of reservas) {
    if (!r.fecha) { cuenta.sinFecha++; continue; }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha))) cuenta.formatoDia++; else cuenta.otroFormato++;
    const cli = pintores.cliente.pinta(r.fecha);
    const age = pintores.agencia.pinta(r.fecha);
    const diaGuardado = Number(String(r.fecha).slice(8, 10));
    const ok = diaDelTexto(cli) === diaGuardado && diaDelTexto(age) === diaGuardado;
    if (ok) cuenta.iguales++; else { cuenta.distintas++; if (ejemplos.length < 8) ejemplos.push({ fecha: r.fecha, cli, age, estado: r.estado }); }
  }

  console.log('\n🧭 RESERVAS DE TURISMO en producción: ' + cuenta.total + (commit ? '   (código de ' + JSON.stringify(commit) + ')' : '   (código de ahora)'));
  console.log('   pintor del cliente: ' + pintores.cliente.nombre + ' · pintor de la agencia: ' + pintores.agencia.nombre);
  console.log('   sin fecha ............................. ' + cuenta.sinFecha);
  console.log('   fecha AAAA-MM-DD ...................... ' + cuenta.formatoDia);
  console.log('   fecha en otro formato ................. ' + cuenta.otroFormato);
  console.log('   ✓ los dos ven el día guardado ......... ' + cuenta.iguales);
  console.log('   🔴 alguno ve OTRO día ................. ' + cuenta.distintas);
  for (const e of ejemplos) console.log('      guardado ' + e.fecha + ' (' + e.estado + ') → cliente «' + e.cli + '» · agencia «' + e.age + '»');

  // Un caso fijo, para que el careo se vea aunque la base no tenga reservas.
  const caso = '2026-10-05';
  const cCli = pintores.cliente.pinta(caso);
  const cAge = pintores.agencia.pinta(caso);
  console.log('\n   caso fijo «' + caso + '» (lunes 5): cliente «' + cCli + '» · agencia «' + cAge + '»');
  console.log(cuenta.distintas === 0 && diaDelTexto(cAge) === 5 && diaDelTexto(cCli) === 5
    ? '✓ cliente y agencia ven el mismo día que se guardó'
    : '🔴 la agencia y el cliente NO ven el mismo día');
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { elPintorDe, diaDelTexto, PANTALLAS };
