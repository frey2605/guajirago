#!/usr/bin/env node
/**
 * 📢 EL LLAMADO DE ATENCIÓN: ¿CUÁNTAS VENTANITAS LO PINTAN, Y QUÉ PASA SI «ENTENDIDO» FALLA? — gemelo G37, SOLO LECTURA.
 *
 * El panel (guajirago-admin/src/Conductores.js, `enviarLlamado`) escribe `usuarios/{uid}.llamadoPendiente` (el texto) y
 * lo suma a `llamadosAtencion` (el historial). La app lo enseña en una ventanita, y «Entendido» lo marca como leído
 * (`llamadoPendiente: null`). Hasta el G37 eso estaba escrito en DOS pantallas (Home.js y AppConductor.js).
 *
 * Este guion:
 *   · en PRODUCCIÓN cuenta cuántos usuarios tienen un llamado sin ver y cuántos llamados hay en el historial;
 *   · en el CÓDIGO busca, en toda guajirago/src, cada ventanita «MENSAJE DE GUAJIRAGO», cada sitio que marca el
 *     llamado como leído, y EJECUTA el «Entendido» de cada uno (sacado del archivo, no copiado) con una base que
 *     RECHAZA la escritura y con una que la acepta: ¿se cierra la ventanita?, ¿alguien lo dice?, y si lo dice,
 *     ¿la ventanita del aviso se pinta dentro de la del llamado, o se queda tapada / no está?
 *
 *   node scripts/medir-llamado-g37.cjs            → el código de HOY
 *   node scripts/medir-llamado-g37.cjs --antes    → el código de ANTES del arreglo (commit 8f9af9f, sacado con git)
 *   --sin-nube                                    → no lee producción
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { RAIZ, sinTextos, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');
// Sin comentarios y con los MISMOS renglones (el limpiador de la ley del botón: no se escribe otro). Un comentario que
// nombre la ventanita o la escritura no cuenta como una.
const { soloCodigo } = require('./medir-ley-boton.cjs');

const ANTES = '8f9af9f';
const CARPETA = 'guajirago/src';
const TITULO = 'MENSAJE DE GUAJIRAGO';
const MARCAR = 'llamadoPendiente: null';

/** Los archivos de la app, de hoy (disco) o de un commit (git). { ruta: fuente } */
function archivosDe(commit) {
  const out = {};
  if (commit) {
    const lista = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, '--', CARPETA], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').filter((r) => /\.js$/.test(r));
    for (const r of lista) out[r] = execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 });
  } else {
    for (const f of fs.readdirSync(path.join(RAIZ, CARPETA))) {
      if (/\.js$/.test(f)) out[CARPETA + '/' + f] = fs.readFileSync(path.join(RAIZ, CARPETA, f), 'utf8');
    }
  }
  return out;
}

/** El trozo de JSX que contiene la posición `pos`: desde el `(` que lo abre (`return (` o `&& (`) hasta su `)`. */
function bloqueJsx(fuente, pos) {
  const seguro = sinTextos(fuente);
  const candidatos = [...seguro.slice(0, pos).matchAll(/(?:return|&&)\s*\(/g)];
  for (let k = candidatos.length - 1; k >= 0; k -= 1) {
    const abre = candidatos[k].index + candidatos[k][0].length - 1;
    let hondo = 0;
    for (let i = abre; i < seguro.length; i += 1) {
      if (seguro[i] === '(') hondo += 1;
      else if (seguro[i] === ')') { hondo -= 1; if (hondo === 0) { if (i > pos) return fuente.slice(abre, i + 1); break; } }
    }
  }
  return null;
}

/** La función `const X = async () => { … }` que contiene la posición `pos`. */
function funcionQueContiene(fuente, pos) {
  const cabezas = [...fuente.slice(0, pos).matchAll(/const\s+(\w+)\s*=\s*async\s*\(\s*\)\s*=>\s*\{/g)];
  for (let k = cabezas.length - 1; k >= 0; k -= 1) {
    const c = cuerpoDeLaFuncion(fuente, cabezas[k].index);
    if (c && c.ini <= pos && pos < c.fin) return { nombre: cabezas[k][1], texto: c.texto };
  }
  return null;
}

const CANDADO = () => cargarDeLaApp('guajirago/src/candado.js');

/**
 * EJECUTA el cuerpo de un «Entendido» con una base que acepta o rechaza, y el candado DE VERDAD (candado.js).
 * Devuelve { cierra, aviso } — `cierra`: si se llamó al setter del llamado con null; `aviso`: lo que dijo el candado.
 */
async function ejecutarCierre(cuerpo, { falla }) {
  const { crearCandado } = CANDADO();
  let cierra = false;
  let aviso = null;
  const cerrarCon = (v) => { if (v === null) cierra = true; };
  const reloj = { poner: () => 0, quitar: () => {} };
  const candado = crearCandado({ alAviso: (a) => { aviso = a; }, reloj, traducir: (e, accion) => ({ clave: 'otro', titulo: 'No se pudo ' + accion, texto: e.message }) });
  const env = {
    auth: { currentUser: { uid: 'u1' } },
    db: {},
    doc: (...a) => a.slice(1).join('/'),
    updateDoc: async () => { if (falla) throw new Error('permission-denied'); },
    correr: candado.correr,
    puedeCerrar: true,
    puedeCerrarLlamado: true,
    setLlamado: cerrarCon,
    setLlamadoAtencion: cerrarCon,
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('env', 'with (env) { return (async () => {' + cuerpo + '\n})(); }');
  // Si revienta (un «Entendido» sin candado ni catch), en el teléfono no pasa nada y nadie lo dice: aviso NINGUNO.
  let revienta = null;
  try { await fn(env); } catch (e) { revienta = e.message; }
  return { cierra, aviso, revienta };
}

/** Todo lo que se mide del código, sobre un juego de archivos { ruta: fuente }. */
async function medirCodigo(archivos) {
  const ventanitas = [];
  const cierres = [];
  const usan = [];
  for (const [ruta, crudo] of Object.entries(archivos)) {
    const fuente = soloCodigo(crudo.replace(/\r\n/g, '\n'));
    for (const m of fuente.matchAll(new RegExp(TITULO, 'g'))) {
      const bloque = bloqueJsx(fuente, m.index);
      ventanitas.push({ ruta, renglon: fuente.slice(0, m.index).split('\n').length, conAviso: !!(bloque && /<AvisoModal\b/.test(bloque)) });
    }
    for (const m of fuente.matchAll(new RegExp(MARCAR.replace(/[()]/g, '\\$&'), 'g'))) {
      const f = funcionQueContiene(fuente, m.index);
      const c = { ruta, renglon: fuente.slice(0, m.index).split('\n').length, funcion: f ? f.nombre : null };
      if (f) {
        c.siFalla = await ejecutarCierre(f.texto, { falla: true });
        c.siEntra = await ejecutarCierre(f.texto, { falla: false });
      }
      cierres.push(c);
    }
    const n = (fuente.match(/<LlamadoAtencion\b/g) || []).length;
    if (n) usan.push({ ruta, veces: n, importa: /^import LlamadoAtencion from '\.\/LlamadoAtencion';/m.test(fuente) });
  }
  const archivosQuePintan = [...new Set(ventanitas.map((v) => v.ruta))];
  const archivosQueMarcan = [...new Set(cierres.map((c) => c.ruta))];
  // Una ventanita que se cierra aunque la escritura falle, o que falla sin que se vea el aviso.
  const seCierranAunqueFalle = cierres.filter((c) => !c.siFalla || c.siFalla.cierra);
  const noSeCierranSiEntra = cierres.filter((c) => !c.siEntra || !c.siEntra.cierra);
  const fallanMudas = cierres.filter((c) => {
    if (!c.siFalla || !c.siFalla.aviso || c.siFalla.aviso.ok !== false) return true; // nadie dijo nada
    return !ventanitas.some((v) => v.ruta === c.ruta && v.conAviso); // lo dijo, pero no hay dónde pintarlo
  });
  return { ventanitas, archivosQuePintan, cierres, archivosQueMarcan, seCierranAunqueFalle, noSeCierranSiEntra, fallanMudas, usan };
}

async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const usuarios = (await traer('usuarios')).map(doc);
  const conHistorial = usuarios.filter((u) => Array.isArray(u.llamadosAtencion) && u.llamadosAtencion.length);
  const sinVer = usuarios.filter((u) => typeof u.llamadoPendiente === 'string' && u.llamadoPendiente.trim());
  const porTipo = (lista) => lista.reduce((o, u) => { const t = u.tipo || '(sin tipo)'; o[t] = (o[t] || 0) + 1; return o; }, {});
  return {
    usuarios: usuarios.length,
    conHistorial: conHistorial.length,
    llamadosEnHistorial: conHistorial.reduce((s, u) => s + u.llamadosAtencion.length, 0),
    sinVer: sinVer.length,
    sinVerPorTipo: porTipo(sinVer),
    // Un llamado sin ver que NO está en el historial sería uno que el panel no puede enseñar.
    sinVerFueraDelHistorial: sinVer.filter((u) => !(u.llamadosAtencion || []).some((l) => l && l.mensaje === u.llamadoPendiente)).length,
  };
}

async function medir({ antes = false, nube = true } = {}) {
  const codigo = await medirCodigo(archivosDe(antes ? ANTES : null));
  const datos = nube ? await medirDatos() : null;
  return { codigo, datos };
}

module.exports = { medir, medirCodigo, archivosDe, ejecutarCierre, bloqueJsx, funcionQueContiene, ANTES };

if (require.main === module) {
  const antes = process.argv.includes('--antes');
  const nube = !process.argv.includes('--sin-nube');
  medir({ antes, nube }).then(({ codigo: c, datos: d }) => {
    console.log('\n=== G37 · EL LLAMADO DE ATENCIÓN · SOLO LECTURA · código ' + (antes ? 'de ANTES (' + ANTES + ')' : 'de HOY') + ' ===\n');
    if (d) {
      console.log('PRODUCCIÓN');
      console.log('  usuarios:                         ' + d.usuarios);
      console.log('  con llamados en el historial:     ' + d.conHistorial + '  (llamados: ' + d.llamadosEnHistorial + ')');
      console.log('  con un llamado SIN VER:           ' + d.sinVer + '  ' + JSON.stringify(d.sinVerPorTipo));
      console.log('  sin ver y fuera del historial:    ' + d.sinVerFueraDelHistorial + '\n');
    }
    console.log('CÓDIGO');
    console.log('  ventanitas «' + TITULO + '»:  ' + c.ventanitas.length + ' en ' + c.archivosQuePintan.length + ' archivo(s)');
    for (const v of c.ventanitas) console.log('     · ' + v.ruta + ':' + v.renglon + (v.conAviso ? '  (con su aviso de fallo dentro)' : '  (SIN dónde decir un fallo)'));
    console.log('  sitios que marcan el llamado como leído:  ' + c.cierres.length + ' en ' + c.archivosQueMarcan.length + ' archivo(s)');
    for (const x of c.cierres) {
      console.log('     · ' + x.ruta + ':' + x.renglon + ' (' + (x.funcion || '¿función?') + ')'
        + ' → si FALLA: ' + (x.siFalla ? (x.siFalla.cierra ? 'SE CIERRA' : 'no se cierra') + ', aviso: ' + (x.siFalla.aviso ? '«' + x.siFalla.aviso.titulo + '»' : 'NINGUNO') : '?')
        + ' · si ENTRA: ' + (x.siEntra ? (x.siEntra.cierra ? 'se cierra' : 'NO SE CIERRA') : '?'));
    }
    console.log('  pantallas que ponen la pieza común <LlamadoAtencion />:  ' + (c.usan.map((u) => u.ruta.split('/').pop() + ' ×' + u.veces).join(', ') || 'ninguna'));
    console.log('');
    console.log('  se cierran aunque la escritura falle:  ' + c.seCierranAunqueFalle.length);
    console.log('  fallan sin que el aviso se vea:        ' + c.fallanMudas.length);
    console.log('  no se cierran cuando sí entró:         ' + c.noSeCierranSiEntra.length);
    const bien = c.archivosQuePintan.length === 1 && c.ventanitas.length === 1 && c.cierres.length === 1
      && !c.seCierranAunqueFalle.length && !c.fallanMudas.length && !c.noSeCierranSiEntra.length;
    console.log('\n' + (bien ? '✓ una sola ventanita, un solo «Entendido», y si falla lo dice sin cerrarse'
      : '🔴 el llamado no está en una sola pieza, o se cierra / calla cuando falla'));
    process.exit(0);
  }).catch((e) => { console.log('🔴 ' + e.message); process.exit(1); });
}
