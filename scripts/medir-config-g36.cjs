#!/usr/bin/env node
/**
 * ⚙️ LOS RESPALDOS DE config/global Y QUIÉN LA LEE — gemelos G36 y G66, SOLO LECTURA.
 *
 * `config/global` es la configuración que el dueño edita en el panel (Superadmin). Cuando no carga, cada pantalla usa
 * un RESPALDO. Hasta el G36 había respaldos escritos a mano y sin prueba que los atara:
 *   · el mensaje de mantenimiento, en TRES versiones (la app, el panel al cargar y el panel si falla la carga);
 *   · los cuatro interruptores de módulos, escritos a mano en App.js y en el CONFIG_POR_DEFECTO del panel;
 *   · el interruptor del regalo de bienvenida, en el panel (true) y en el servidor («encendido si no está»).
 * Y (G66) cada pantalla leía `config/global` a mano, con su propio respaldo y su propio fallo mudo.
 *
 * Este guion:
 *   · lee `config/global` de PRODUCCIÓN y dice qué trae de módulos, mantenimiento y regalo;
 *   · EJECUTA el código (sacado de los archivos, no copiado) para ver qué mensaje de mantenimiento enseña cada lado
 *     cuando la config no lo trae, qué módulos enseña la app si la config no carga frente a los del panel, y si el
 *     regalo arranca igual en el panel y en el servidor;
 *   · cuenta cuántos sitios de la app leen `config/global` a mano (fuera de la pieza común).
 *
 *   node scripts/medir-config-g36.cjs            → el código de HOY (los archivos de la carpeta)
 *   node scripts/medir-config-g36.cjs --antes    → el código de ANTES del arreglo (app 6233a01, panel d6d4cd5, con git)
 *   --sin-nube                                   → no lee producción
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { leer, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const ANTES_APP = '6233a01';
const ANTES_PANEL = 'd6d4cd5';

function git(args, cwd) {
  return execFileSync('git', args, { cwd: cwd || RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Las fuentes a medir: las de la carpeta, o las de los commits de antes. */
function fuentes(antes) {
  if (!antes) {
    return {
      app: leer('guajirago/src/App.js'),
      configApp: leer('guajirago/src/configApp.js'),
      panel: leer('guajirago-admin/src/Superadmin.js'),
      descuento: leer('guajirago/functions/descuentoPendiente.cjs'),
    };
  }
  return {
    app: git(['show', ANTES_APP + ':guajirago/src/App.js']),
    configApp: git(['show', ANTES_APP + ':guajirago/src/configApp.js']),
    panel: git(['show', ANTES_PANEL + ':src/Superadmin.js'], path.join(RAIZ, 'guajirago-admin')),
    descuento: git(['show', ANTES_APP + ':guajirago/functions/descuentoPendiente.cjs']),
  };
}

/** Lo que va entre el paréntesis que abre en `i` y el que lo cierra. */
function entreParentesis(t, i) {
  let p = 0;
  for (let j = i; j < t.length; j += 1) {
    if (t[j] === '(') p += 1;
    else if (t[j] === ')') { p -= 1; if (p === 0) return t.slice(i + 1, j); }
  }
  throw new Error('paréntesis sin cerrar');
}

/** Ejecuta una expresión con estos nombres a mano. */
function ejecutar(expr, nombres) {
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(nombres), 'return (' + expr + ');')(...Object.values(nombres));
}

/** Las piezas de configApp.js (con sus imports de la misma carpeta, si los tiene). */
function piezasDe(fuenteConfigApp) {
  return cargarDeLaApp('guajirago/src/configApp.js', fuenteConfigApp);
}

/** La constante de texto del panel para el mensaje, si existe (`const MENSAJE_MANTENIMIENTO_DEFECTO = '...';`). */
function constantesDelPanel(panel) {
  const o = {};
  const m = panel.match(/^const MENSAJE_MANTENIMIENTO_DEFECTO = ('(?:[^'\\]|\\.)*');/m);
  if (m) o.MENSAJE_MANTENIMIENTO_DEFECTO = ejecutar(m[1], {});
  const b = panel.match(/const CONFIG_POR_DEFECTO = \{[\s\S]*?\n\};/);
  if (!b) throw new Error('Superadmin.js: no encuentro CONFIG_POR_DEFECTO');
  // eslint-disable-next-line no-new-func
  o.CONFIG_POR_DEFECTO = new Function(b[0] + '\nreturn CONFIG_POR_DEFECTO;')();
  return o;
}

/** Qué mensaje enseña la app si la config trae `d` (el argumento de setMensajeMantenimiento, ejecutado). */
function mensajeDeLaApp(f, d) {
  const t = f.app.replace(/\r\n/g, '\n');
  const i = t.indexOf('setMensajeMantenimiento(', t.indexOf('const revisarMantenimiento'));
  if (i < 0) throw new Error('App.js: revisarMantenimiento ya no llama a setMensajeMantenimiento');
  const expr = entreParentesis(t, i + 'setMensajeMantenimiento'.length);
  return ejecutar(expr, { d, ...piezasDe(f.configApp) });
}

/** Los mensajes que pone el panel en cargarMant: [al cargar con `d`, si la carga falla]. */
function mensajesDelPanel(f, d) {
  const t = f.panel.replace(/\r\n/g, '\n');
  const i = t.indexOf('const cargarMant = ');
  if (i < 0) throw new Error('Superadmin.js: no encuentro cargarMant');
  const fin = t.indexOf('}, []);', i);
  const cuerpo = t.slice(i, fin);
  const exprs = [...cuerpo.matchAll(/mensajeMantenimiento:\s*([^\n]*?)\s*,?\s*(?:\}\)|\n)/g)].map((m) => m[1].replace(/,\s*$/, ''));
  if (exprs.length !== 2) throw new Error('Superadmin.js: cargarMant ya no pone el mensaje en dos sitios (' + exprs.length + ')');
  const nombres = { d, ...constantesDelPanel(f.panel) };
  return exprs.map((e) => ejecutar(e, nombres));
}

/** Qué módulos enseña la app ANTES de que cargue (o si no carga): el `useState(...)` de PantallaModulos, ejecutado. */
function modulosDeLaApp(f) {
  const t = f.app.replace(/\r\n/g, '\n');
  const i = t.indexOf('useState(', t.indexOf('function PantallaModulos'));
  const expr = entreParentesis(t, i + 'useState'.length);
  const v = ejecutar(expr, piezasDe(f.configApp));
  return typeof v === 'function' ? v() : v;
}

/** ¿El servidor da el regalo con esta config? (null = sí le toca por el interruptor). */
function regaloDelServidor(f, config) {
  const t = f.descuento.replace(/\r\n/g, '\n');
  const i = t.indexOf('function porQueNoLaBienvenida');
  const cuerpo = t.slice(i, t.indexOf('\n}\n', i) + 2);
  // eslint-disable-next-line no-new-func
  const fn = new Function(cuerpo + '\nreturn porQueNoLaBienvenida;')();
  return fn({ config, ficha: { tipo: 'pasajero' }, aparatoYaUsado: false, yaLaRecibio: false, viajesPedidos: 0 }) !== 'apagada';
}

/** Cuántos sitios de la app leen config/global a mano (fuera de configApp.js, la pieza común). */
function lectoresAMano(antes) {
  let salida = '';
  try {
    salida = git(antes
      ? ['grep', '-c', "doc(db, 'config', 'global')", ANTES_APP, '--', 'guajirago/src']
      : ['grep', '-c', "doc(db, 'config', 'global')", '--', 'guajirago/src']);
  } catch (e) { salida = ''; }
  return salida.trim().split('\n').filter(Boolean).map((r) => {
    const partes = r.split(':');
    const n = Number(partes.pop());
    return { archivo: partes.join(':').replace(ANTES_APP + ':', ''), n };
  }).filter((x) => !x.archivo.endsWith('configApp.js'));
}

const MODULOS = ['moduloTransporte', 'moduloMensajeria', 'moduloRestaurantes', 'moduloTurismo'];

/** La medida entera, pura sobre las fuentes (la usa la prueba). */
function medir(f, antes) {
  const sinMensaje = {};
  const app = mensajeDeLaApp(f, sinMensaje);
  const [panelCarga, panelFallo] = mensajesDelPanel(f, sinMensaje);
  const versiones = [...new Set([app, panelCarga, panelFallo])];
  const panel = constantesDelPanel(f.panel).CONFIG_POR_DEFECTO;
  const modApp = modulosDeLaApp(f);
  const modulosDistintos = MODULOS.filter((k) => modApp[k] !== panel[k]);
  const regaloPanel = panel.viajeGratisNuevoPasajero === true;
  const regaloServidor = regaloDelServidor(f, {});
  return {
    mensajes: { app, panelCarga, panelFallo }, versiones: versiones.length,
    modApp, modulosDistintos, regaloPanel, regaloServidor, regaloIgual: regaloPanel === regaloServidor,
    lectores: lectoresAMano(antes),
  };
}

async function main() {
  const antes = process.argv.includes('--antes');
  if (!process.argv.includes('--sin-nube')) {
    const { traer, doc } = require('./nube.cjs');
    const g = (await traer('config')).map(doc).find((d) => d.id === 'global');
    if (!g) console.log('⚠ config/global NO existe en producción');
    else {
      console.log('config/global en PRODUCCIÓN:');
      for (const k of [...MODULOS, 'mantPasajeros', 'mantConductores', 'mensajeMantenimiento', 'viajeGratisNuevoPasajero']) {
        console.log('  ' + k.padEnd(26) + (k in g ? JSON.stringify(g[k]) : '(no está → manda el respaldo)'));
      }
    }
  }
  const r = medir(fuentes(antes), antes);
  console.log('\nModo: ' + (antes ? 'ANTES (app ' + ANTES_APP + ', panel ' + ANTES_PANEL + ')' : 'HOY (los archivos de la carpeta)'));
  console.log('\nMENSAJE DE MANTENIMIENTO cuando la config no lo trae (ejecutado):');
  console.log('  app                 → «' + r.mensajes.app + '»');
  console.log('  panel al cargar     → «' + r.mensajes.panelCarga + '»');
  console.log('  panel si no carga   → «' + r.mensajes.panelFallo + '»');
  console.log('  ' + (r.versiones === 1 ? '✓ una sola versión' : '🔴 ' + r.versiones + ' versiones distintas'));
  console.log('\nMÓDULOS que enseña la app si la config no carga, frente al respaldo del panel:');
  console.log('  app   → ' + MODULOS.map((k) => k.replace('modulo', '') + '=' + r.modApp[k]).join(' '));
  console.log('  ' + (r.modulosDistintos.length === 0 ? '✓ iguales' : '🔴 distintos: ' + r.modulosDistintos.join(', ')));
  console.log('\nREGALO DE BIENVENIDA sin el campo: panel ' + (r.regaloPanel ? 'encendido' : 'apagado') + ' · servidor '
    + (r.regaloServidor ? 'encendido' : 'apagado') + '  ' + (r.regaloIgual ? '✓' : '🔴'));
  const total = r.lectores.reduce((s, x) => s + x.n, 0);
  console.log('\nLECTURAS de config/global a mano en la app (fuera de configApp.js): ' + total + ' en ' + r.lectores.length
    + ' archivo(s)' + (r.lectores.length ? ' → ' + r.lectores.map((x) => x.archivo.replace('guajirago/src/', '') + ' ×' + x.n).join(', ') : ''));
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}

module.exports = { fuentes, medir, mensajeDeLaApp, mensajesDelPanel, modulosDeLaApp, regaloDelServidor, lectoresAMano, constantesDelPanel };
