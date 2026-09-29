#!/usr/bin/env node
/**
 * 🎁 EL REGALO AL CONDUCTOR NUEVO: ¿CUÁNTO DA EL SERVIDOR SI config/global NO LO DICE? — gemelo G53, SOLO LECTURA.
 *
 * `creditosDeBienvenida` (guajirago/functions/index.js) le da al conductor nuevo sus créditos de regalo: lo que diga
 * config/global (`incentivoNuevoMototaxi`, `incentivoNuevoTaxi`), y si la config no lo trae, un número de respaldo. El
 * panel (guajirago-admin/src/Superadmin.js, CONFIG_POR_DEFECTO) tiene su propio respaldo de esos dos números, y ése
 * pesa más: si config/global no existe, el panel lo ESCRIBE entero como configuración inicial. Hasta el G53 el del
 * servidor estaba escrito a mano (`?? 10000`, `?? 20000`) y NINGUNA prueba lo comparaba con el panel.
 *
 * Qué cuenta:
 *   · en el CÓDIGO: cuánto regala el servidor sin config y con la de producción (EJECUTANDO el `const monto = …` de
 *     creditosDeBienvenida, con su pieza si la usa), cuánto dice el panel, y cuántos números de respaldo quedan
 *     escritos a mano en el servidor (`?? 20000`, `|| 3`…) en vez de salir de una pieza que una prueba pueda cargar;
 *   · en PRODUCCIÓN: qué trae config/global de esos dos números y cuántos conductores todavía no han recibido el
 *     regalo (a ésos les tocaría el respaldo si la config perdiera el número).
 *
 *   node scripts/medir-regalo-conductor.cjs                       → el código de hoy + producción
 *   node scripts/medir-regalo-conductor.cjs --commit <c>          → el servidor de ese commit (careo antes/después)
 *   node scripts/medir-regalo-conductor.cjs --commit-panel <c>    → el panel de ese commit
 *   node scripts/medir-regalo-conductor.cjs --sin-nube            → solo el código
 */
const path = require('path');
const { execFileSync } = require('child_process');
const { RAIZ, leer } = require('../pruebas/cargar.cjs');

const RUTA_INDEX = 'guajirago/functions/index.js';
const RUTA_PIEZA = 'guajirago/functions/regaloConductorNuevo.cjs';

function deGit(repo, commit, ruta) {
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, repo), 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

/** Los tres archivos que deciden: el index del servidor, su pieza (si existe) y el panel. */
function fuentes({ commit, commitPanel } = {}) {
  const index = commit ? deGit('.', commit, RUTA_INDEX) : leer(RUTA_INDEX);
  if (index == null) throw new Error('no pude leer ' + RUTA_INDEX + ' en ' + commit);
  let pieza = null;
  if (commit) pieza = deGit('.', commit, RUTA_PIEZA);
  else { try { pieza = leer(RUTA_PIEZA); } catch (e) { pieza = null; } }
  const panel = commitPanel ? deGit('guajirago-admin', commitPanel, 'src/Superadmin.js') : leer('guajirago-admin/src/Superadmin.js');
  if (panel == null) throw new Error('no pude leer Superadmin.js en ' + commitPanel);
  return { index, pieza, panel };
}

/** Carga el texto de un .cjs como módulo (sin tocar el disco, para poder cargar el de un commit viejo). */
function cargarCjs(fuente) {
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', fuente)(module, module.exports, require);
  return module.exports;
}

/** El cuerpo de creditosDeBienvenida, del `exports.creditosDeBienvenida` al siguiente `exports.`. */
function cuerpoDeLaFuncion(index) {
  const t = index.replace(/\r\n/g, '\n');
  const i = t.indexOf('exports.creditosDeBienvenida = ');
  if (i < 0) throw new Error('index.js ya no exporta creditosDeBienvenida');
  const fin = t.indexOf('\nexports.', i + 10);
  return t.slice(i, fin < 0 ? undefined : fin);
}

/** ¿Cuánto regala el servidor a este vehículo con esta config? Se EJECUTA el `const monto = …;` de la función. */
function regaloDelServidor(f, tipoVehiculo, cfg) {
  const cuerpo = cuerpoDeLaFuncion(f.index);
  const m = cuerpo.match(/const monto = ([\s\S]*?);\n/);
  if (!m) throw new Error('creditosDeBienvenida ya no calcula `const monto = …;`');
  const piezas = f.pieza ? cargarCjs(f.pieza) : {};
  const nombres = { u: { tipo: 'conductor', tipoVehiculo }, cfg: cfg || {}, ...piezas };
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(nombres), 'return (' + m[1] + ');')(...Object.values(nombres));
}

/** El CONFIG_POR_DEFECTO del panel, ejecutado (es un objeto de puros números y verdadero/falso). */
function respaldoDelPanel(panel) {
  const b = panel.match(/const CONFIG_POR_DEFECTO = \{[\s\S]*?\n\};/);
  if (!b) throw new Error('Superadmin.js: no encuentro CONFIG_POR_DEFECTO');
  // eslint-disable-next-line no-new-func
  return new Function(b[0] + '\nreturn CONFIG_POR_DEFECTO;')();
}

/** Números de respaldo escritos a mano en el código del servidor: `?? 20000`, `|| 3`… (el 0 no cuenta: es «nada»). */
function numerosSueltos(f) {
  const sueltos = [];
  const mirar = [[RUTA_INDEX, f.index]].concat(f.pieza ? [[RUTA_PIEZA, f.pieza]] : []);
  for (const [ruta, texto] of mirar) {
    texto.replace(/\r\n/g, '\n').split('\n').forEach((linea, n) => {
      if (/^\s*(\*|\/\*)/.test(linea)) return; // renglón de un comentario de bloque
      const sinComentario = linea.replace(/\/\/.*$/, '');
      if (/(\?\?|\|\|)\s*[1-9]\d*(?![\w.])/.test(sinComentario)) sueltos.push(ruta + ':' + (n + 1) + '  ' + linea.trim());
    });
  }
  return sueltos;
}

const VEHICULOS = ['Mototaxi', 'Taxi', undefined, 'Carro'];
const CLAVE = (tv) => (tv === 'Mototaxi' ? 'incentivoNuevoMototaxi' : 'incentivoNuevoTaxi');

/** Lo del código: por vehículo, el regalo del servidor sin config y el respaldo del panel; y las diferencias. */
function medirCodigo(f) {
  const panel = respaldoDelPanel(f.panel);
  const filas = VEHICULOS.map((tv) => {
    const servidor = regaloDelServidor(f, tv, {});
    const delPanel = panel[CLAVE(tv)];
    return { tipoVehiculo: tv === undefined ? '(sin tipo)' : tv, servidor, panel: delPanel, igual: servidor === delPanel };
  });
  return { filas, distintos: filas.filter((x) => !x.igual).length, sueltos: numerosSueltos(f), usaPieza: !!f.pieza };
}

function valorDe(args, bandera) {
  const i = args.indexOf(bandera);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const commit = valorDe(args, '--commit');
  const commitPanel = valorDe(args, '--commit-panel');
  const f = fuentes({ commit, commitPanel });
  const r = medirCodigo(f);
  console.log('SERVIDOR: ' + (commit ? 'commit ' + commit : 'archivos de hoy') + ' · PANEL: ' + (commitPanel ? 'commit ' + commitPanel : 'archivo de hoy'));
  console.log('El servidor ' + (r.usaPieza ? 'usa la pieza ' + RUTA_PIEZA : 'NO tiene pieza: el respaldo va escrito dentro de index.js'));
  console.log('\nREGALO AL CONDUCTOR NUEVO si config/global no trae el número:');
  for (const x of r.filas) {
    console.log('  ' + (x.igual ? '✓' : '🔴') + ' ' + x.tipoVehiculo.padEnd(11) + ' servidor ' + String(x.servidor).padStart(6) + ' · panel ' + String(x.panel).padStart(6));
  }
  console.log('  → combinaciones donde servidor y panel dicen distinto: ' + r.distintos + ' de ' + r.filas.length);
  console.log('\nNÚMEROS DE RESPALDO ESCRITOS A MANO EN EL SERVIDOR: ' + r.sueltos.length);
  for (const s of r.sueltos) console.log('  · ' + s);

  if (args.includes('--sin-nube')) return;
  const N = require('./nube.cjs');
  const config = (await N.traer('config')).map(N.doc).find((d) => d.id === 'global') || null;
  const usuarios = (await N.traer('usuarios')).map(N.doc);
  const conductores = usuarios.filter((u) => u.tipo === 'conductor');
  const sinRegalo = conductores.filter((u) => u.creditos === undefined || u.creditos === null);
  console.log('\nPRODUCCIÓN:');
  if (!config) console.log('  🔴 config/global NO existe: manda el respaldo');
  else {
    for (const k of ['incentivoNuevoMototaxi', 'incentivoNuevoTaxi']) {
      console.log('  config/global.' + k + ' = ' + JSON.stringify(config[k]) + (config[k] === undefined ? '  ← falta: manda el respaldo' : ''));
    }
    const conProd = VEHICULOS.map((tv) => (tv === undefined ? '(sin tipo)' : tv) + ' ' + regaloDelServidor(f, tv, config)).join(' · ');
    console.log('  lo que regala hoy el servidor con esa config: ' + conProd);
  }
  console.log('  fichas de usuario: ' + usuarios.length + ' · conductores: ' + conductores.length
    + ' · conductores que todavía no han recibido el regalo (sin campo creditos): ' + sinRegalo.length);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { fuentes, cargarCjs, cuerpoDeLaFuncion, regaloDelServidor, respaldoDelPanel, numerosSueltos, medirCodigo, VEHICULOS };
