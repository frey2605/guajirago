#!/usr/bin/env node
/**
 * ¿CÓMO SUENA LA ALARMA DE UN AVISO NUEVO? — gemelo G63 (29-sep-2026). SOLO LEE: la alarma no guarda datos.
 *
 *   node scripts/medir-alarma.cjs                 (el código de hoy)
 *   node scripts/medir-alarma.cjs --commit X      (transporte en el commit X de la raíz: el careo de antes y después)
 *   node scripts/medir-alarma.cjs --aliados Y     (aliados en el commit Y de su repo; sin él, el disco)
 *
 * La alarma (vibrar + el tono /gogo.mp3 + unas notas de respaldo) estaba escrita dos veces: en transporte
 * (guajirago/src/Notificaciones.js: precargarAudio, alertarNuevoViaje, activarAudioiOS) y en aliados
 * (guajirago-aliados/src/alerta.js: precargarAudio, desbloquearAudio, sonarAlerta). Desde G63 las dos apps usan
 * alerta.js, la misma pieza (copia idéntica en aliados).
 *
 * No lee nada escrito a mano: SACA del archivo la alarma de cada app y lo que cada pantalla llama DENTRO del toque
 * (conductor: el interruptor de «activo»; pasajero: el botón de pedir; negocio: el primer toque en la app) y lo
 * CORRE en un celular de mentira, con dos modelos de navegador:
 *   · iPhone — solo suena lo que arrancó con un toque: el tono si se tocó en un toque, el motor si nació o se
 *     despertó en un toque. Un motor nuevo fuera del toque nace callado y `resume()` no contesta nunca.
 *   · Android (Chrome) — después del primer toque en la página, suena todo.
 * Y en cada modelo: con toque antes, sin ningún toque, y con el tono roto (el mp3 no carga).
 *
 * Qué cuenta en cada caso: qué se oye (el tono, las notas de respaldo o NADA), si al callarse deja rastro, cuántos
 * motores de sonido crea en diez alarmas seguidas, y si el toque deja escapar un pedacito del tono.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i > 0 ? process.argv[i + 1] : null;
}

/** El texto de un archivo: del disco, del commit X de la raíz, o del commit Y de aliados. */
function fuente(ruta, { commit = null, aliados = null } = {}) {
  const esAliados = ruta.startsWith('guajirago-aliados/');
  const ref = esAliados ? aliados : commit;
  if (!ref) {
    const abs = path.join(RAIZ, ruta);
    return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') : null;
  }
  const repo = esAliados ? path.join(RAIZ, 'guajirago-aliados') : RAIZ;
  const rel = esAliados ? ruta.slice('guajirago-aliados/'.length) : ruta;
  try {
    return execFileSync('git', ['-C', repo, 'show', ref + ':' + rel],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r\n/g, '\n');
  } catch (e) { return null; }
}

const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => l.replace(/^(\s*)\/\/.*/, '$1')).join('\n');

/**
 * La alarma de una app, como texto ejecutable: la pieza alerta.js si la app la tiene; si no (transporte antes de
 * G63), los trozos de Notificaciones.js que la llevaban. Devuelve { texto, sonar, origen }.
 */
function laAlarma(app, refs) {
  const pieza = fuente(app + '/src/alerta.js', refs);
  if (pieza) return { texto: pieza, sonar: 'sonarAlerta', origen: app + '/src/alerta.js' };
  const n = fuente(app + '/src/Notificaciones.js', refs);
  if (!n) throw new Error('no encuentro la alarma de ' + app);
  const a = n.indexOf('let _audioAlerta');
  const b = n.indexOf('export const permisoDeAvisos');
  const c = n.indexOf('export const alertarNuevoViaje');
  if (a < 0 || b < a || c < 0) throw new Error('Notificaciones.js de ' + app + ' cambió de forma: no sé sacarle la alarma');
  return { texto: n.slice(a, b) + '\n' + n.slice(c), sonar: 'alertarNuevoViaje', origen: app + '/src/Notificaciones.js' };
}

/**
 * Lo que cada pantalla llama DENTRO del toque, sacado de su archivo: las llamadas de audio (nombres que exporta la
 * alarma, menos la que suena) del renglón que se ejecuta con el toque.
 */
const TOQUES = [
  // [app, archivo, ancla del renglón (o del trozo) que corre con el toque, quién]
  ['guajirago', 'guajirago/src/AppConductor.js', 'setActivo(!activo)', 'el conductor, al activarse'],
  // El pedido: el audio va en los renglones de justo antes del comentario que abre el candado del pedido.
  ['guajirago', 'guajirago/src/Solicitar.js', '// LA LEY DEL BOTÓN: desde aquí hasta crear el viaje', 'el pasajero, al pedir'],
  ['guajirago-aliados', 'guajirago-aliados/src/App.js', 'const unlock = () =>', 'el negocio, en su primer toque'],
];
function loQueLlamaElToque([, archivo, ancla], exportados, sonar, refs) {
  const t = fuente(archivo, refs) || '';
  const i = t.indexOf(ancla);
  if (i < 0 || t.indexOf(ancla, i + 1) >= 0) throw new Error(archivo + ': «' + ancla + '» no está UNA vez');
  const ini = t.lastIndexOf('\n', i) + 1;
  // Si el ancla es un comentario, lo que corre con el toque son los 4 renglones de antes; si no, su propio renglón.
  const trozo = sinComentarios(ancla.startsWith('//')
    ? t.slice(0, ini).split('\n').slice(-5).join('\n')
    : t.slice(ini, t.indexOf('\n', i)));
  const llamadas = [...trozo.matchAll(/\b([A-Za-z_]\w*)\(\)/g)].map((m) => m[1])
    .filter((nombre) => exportados.includes(nombre) && nombre !== sonar);
  return [...new Set(llamadas)];
}

// ── Un celular de mentira ───────────────────────────────────────────────────────────────────────────────────────
function celular(modelo, { tonoRoto = false } = {}) {
  const r = { oido: [], pitidos: 0, motores: 0, notasCalladas: 0, rastros: [], vibraciones: [], volumenes: [] };
  let enToque = false;
  let tocado = false; // Android: la página ya recibió un toque
  const puede = (desbloqueado) => (modelo === 'android' ? tocado : (enToque || desbloqueado));
  const timers = [];
  class Audio {
    constructor(src) { this.src = src; this.currentTime = 0; this.volume = 1; this.desbloqueado = false; }
    load() {}
    play() {
      if (tonoRoto) { const e = new Error('el tono no carga'); e.name = 'NotSupportedError'; return Promise.reject(e); }
      if (!puede(this.desbloqueado)) { const e = new Error('play() sin un toque'); e.name = 'NotAllowedError'; return Promise.reject(e); }
      if (enToque) this.desbloqueado = true;
      // En el iPhone el volumen no se puede bajar desde la página: suena siempre a 1.
      const vol = modelo === 'iphone' ? 1 : this.volume;
      if (enToque) { if (vol > 0) r.pitidos += 1; } else { r.oido.push('tono'); r.volumenes.push(vol); r.desdeElPrincipio = this.currentTime === 0; }
      return Promise.resolve();
    }
    pause() {}
  }
  class Motor {
    constructor() { r.motores += 1; this.state = puede(false) ? 'running' : 'suspended'; this.currentTime = 0; this.destination = {}; }
    resume() { if (puede(false)) { this.state = 'running'; return Promise.resolve(); } return new Promise(() => {}); }
    createGain() { const g = { valor: null, gain: { setValueAtTime: (v) => { if (g.valor === null) g.valor = v; }, exponentialRampToValueAtTime() {} }, connect() {} }; return g; }
    createOscillator() {
      const m = this;
      const o = { frequency: { value: 0 }, type: '', g: null, connect(x) { o.g = x; }, stop() {},
        start() {
          const audible = o.g && o.g.valor > 0;
          if (!audible) return;
          if (m.state === 'running') r.oido.push('nota ' + o.frequency.value); else r.notasCalladas += 1;
        } };
      return o;
    }
  }
  const window = { AudioContext: Motor };
  const navigator = { vibrate: (p) => { r.vibraciones.push(JSON.stringify(p)); return true; } };
  const consola = { log() {}, warn: (...a) => r.rastros.push(a.join(' ')), error: (...a) => r.rastros.push(a.join(' ')) };
  const apuntarRechazo = (donde, e) => r.rastros.push('[rechazo] ' + donde + ' · ' + ((e && e.name) || '') + ' ' + ((e && e.message) || e));
  const setTimeout = (f) => { timers.push(f); return timers.length; };
  const clearTimeout = (k) => { timers[k - 1] = null; };
  return {
    r, window, navigator, consola, apuntarRechazo, setTimeout, clearTimeout, Audio,
    tocar(fn) { enToque = true; tocado = true; try { fn(); } finally { enToque = false; } },
    async esperar() {
      for (let v = 0; v < 3; v += 1) {
        for (let k = 0; k < 20; k += 1) await Promise.resolve(); // eslint-disable-line no-await-in-loop
        const pend = timers.splice(0).filter(Boolean); pend.forEach((f) => f());
      }
    },
  };
}

function cargar(alarma, cel) {
  const t = alarma.texto.replace(/^import[^\n]*\n/gm, '').replace(/^export\s+/gm, '');
  const nombres = [...alarma.texto.matchAll(/^export\s+const\s+(\w+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  const f = new Function('window', 'navigator', 'Audio', 'console', 'setTimeout', 'clearTimeout', 'apuntarRechazo',
    t + '\nreturn { ' + nombres.join(', ') + ' };');
  return { piezas: f(cel.window, cel.navigator, cel.Audio, cel.consola, cel.setTimeout, cel.clearTimeout, cel.apuntarRechazo), nombres };
}

const CASOS = [
  ['iPhone, con toque antes', 'iphone', true, false],
  ['Android, con toque antes', 'android', true, false],
  ['iPhone, sin ningún toque', 'iphone', false, false],
  ['Android, sin ningún toque', 'android', false, false],
  ['iPhone, tono roto', 'iphone', true, true],
  ['Android, tono roto', 'android', true, true],
];

/** Corre UNA alarma en un caso: devuelve qué se oyó, si dejó rastro al callarse y lo que contestó. */
async function correrCaso(alarma, toque, [, modelo, conToque, tonoRoto], veces = 1) {
  const cel = celular(modelo, { tonoRoto });
  const { piezas } = cargar(alarma, cel);
  if (conToque) cel.tocar(() => toque.forEach((n) => piezas[n]()));
  await cel.esperar();
  const pitidos = cel.r.pitidos;
  const rastrosAntes = cel.r.rastros.length;
  const contestas = [];
  for (let k = 0; k < veces; k += 1) {
    const oidoAntes = cel.r.oido.length;
    contestas.push(piezas[alarma.sonar]());
    await cel.esperar(); // eslint-disable-line no-await-in-loop
    if (k === 0) cel.r.primera = cel.r.oido.slice(oidoAntes);
  }
  const contesto = await Promise.resolve(contestas[0]);
  const oido = cel.r.primera;
  const que = oido.length === 0 ? 'NADA' : oido[0] === 'tono' ? 'el tono' : 'notas de respaldo (' + oido.length + ')';
  const rastroDelSilencio = cel.r.rastros.slice(rastrosAntes).some((x) => /no dej|sonar/i.test(x));
  return { que, callado: oido.length === 0, dijo: oido.length === 0 && rastroDelSilencio, contesto, pitidos,
    motores: cel.r.motores, vibra: cel.r.vibraciones[cel.r.vibraciones.length - 1], volumen: cel.r.volumenes[0],
    desdeElPrincipio: cel.r.desdeElPrincipio };
}

/** Todo lo que se mide, para una pareja de referencias. La prueba lo usa también. */
async function medir(refs = {}) {
  const apps = {};
  for (const app of ['guajirago', 'guajirago-aliados']) apps[app] = laAlarma(app, refs);
  const filas = [];
  for (const t of TOQUES) {
    const alarma = apps[t[0]];
    const nombres = [...alarma.texto.matchAll(/^export\s+const\s+(\w+)/gm)].map((m) => m[1]);
    const toque = loQueLlamaElToque(t, nombres, alarma.sonar, refs);
    const casos = [];
    for (const c of CASOS) casos.push({ caso: c[0], ...(await correrCaso(alarma, toque, c)) }); // eslint-disable-line no-await-in-loop
    const diez = await correrCaso(alarma, toque, ['', 'android', true, true], 10);
    filas.push({ quien: t[3], app: t[0], origen: alarma.origen, toque, casos, motoresEnDiez: diez.motores });
  }
  // Copias de la alarma en las pantallas (sin contar la pieza): quién escribe el tono o crea un motor de sonido.
  // Llamada.js lleva su propio timbre (el de la llamada entrante, otro sonido): se nombra aparte.
  const aMano = [];
  for (const app of ['guajirago', 'guajirago-aliados', 'guajirago-admin']) {
    const carpeta = path.join(RAIZ, app, 'src');
    if (refs.commit || refs.aliados || !fs.existsSync(carpeta)) continue;
    for (const f of fs.readdirSync(carpeta).filter((x) => x.endsWith('.js'))) {
      if (f === 'alerta.js' || f === 'Llamada.js') continue;
      const t = sinComentarios(fs.readFileSync(path.join(carpeta, f), 'utf8'));
      if (/gogo\.mp3|AudioContext/.test(t)) aMano.push(app + '/src/' + f);
    }
  }
  const textos = Object.values(apps).map((a) => a.texto);
  return { filas, distintas: new Set(textos).size, origenes: Object.values(apps).map((a) => a.origen), aMano };
}

async function main() {
  const refs = { commit: argumento('--commit'), aliados: argumento('--aliados') };
  const m = await medir(refs);
  console.log('\n🔔 LA ALARMA DE UN AVISO NUEVO · ' + (refs.commit ? 'transporte en ' + refs.commit : 'transporte en el disco')
    + ' · ' + (refs.aliados ? 'aliados en ' + refs.aliados : 'aliados en el disco') + '\n');
  console.log('   dónde vive: ' + m.origenes.join('  y  ') + ' → ' + m.distintas + (m.distintas === 1 ? ' versión (la misma)' : ' versiones distintas'));
  if (!refs.commit && !refs.aliados) console.log('   alarmas escritas a mano fuera de la pieza (sin contar el timbre de Llamada.js): ' + m.aMano.length + (m.aMano.length ? ' → ' + m.aMano.join(', ') : ''));
  let calladosMudos = 0;
  let calladosConToque = 0;
  for (const f of m.filas) {
    console.log('\n   ▸ ' + f.quien + '  (' + f.origen + ')');
    console.log('     el toque llama a: ' + (f.toque.join(' + ') || '(nada)') + ' · motores creados en 10 alarmas con el tono roto: ' + f.motoresEnDiez);
    for (const c of f.casos) {
      const mudo = c.callado && !c.dijo;
      if (mudo) calladosMudos += 1;
      if (c.callado && /con toque/.test(c.caso)) calladosConToque += 1;
      console.log('     ' + (c.callado ? (mudo ? '🔴' : '🟡') : '✓ ') + ' ' + c.caso.padEnd(26) + ' se oye: ' + c.que.padEnd(22)
        + (c.callado ? (c.dijo ? ' · lo deja escrito' : ' · SE CALLA SIN DECIRLO') : '')
        + ' · contesta ' + JSON.stringify(c.contesto)
        + (c.pitidos ? ' · el toque deja escapar ' + c.pitidos + ' pedacito del tono' : ''));
    }
    const c0 = f.casos[1];
    console.log('     vibra ' + c0.vibra + ' · volumen ' + c0.volumen + ' · desde el principio: ' + (c0.desdeElPrincipio ? 'sí' : 'no'));
  }
  console.log('\n   RESUMEN: se calla habiendo tenido toque antes: ' + calladosConToque + ' casos · se calla sin decirlo: ' + calladosMudos + ' casos\n');
}

if (require.main === module) main().catch((e) => { console.error('⛔', e.message); process.exit(1); });

module.exports = { medir, laAlarma, loQueLlamaElToque, celular, cargar, correrCaso, CASOS, TOQUES };
