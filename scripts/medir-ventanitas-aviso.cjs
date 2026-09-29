#!/usr/bin/env node
/**
 * 🪟 ¿CUÁNTAS VENTANITAS DE AVISO ESTÁN ESCRITAS A MANO? — gemelo G39, SOLO LECTURA (solo lee código, no datos).
 *
 *   node scripts/medir-ventanitas-aviso.cjs                 <- el código de hoy (el disco)
 *   node scripts/medir-ventanitas-aviso.cjs --commit 55dbfbf <- el de un commit (para carear antes y después)
 *   node scripts/medir-ventanitas-aviso.cjs --detalle        <- y cada una, con su renglón
 *
 * ── QUÉ ERA ─────────────────────────────────────────────────────────────────
 * La ventanita de aviso (dibujito, título, texto y «Entendido») ya existe UNA vez: `AvisoModal.js`, copia atada en
 * las tres apps y la que usa el candado. Pero en la app de transporte había 16 más escritas a mano, cada una con su
 * fondo, su letra y su botón (SEGUNDA LEY: «no se pueden usar dos calculadoras para un mismo proceso»). Las que eran
 * AVISO pasaron a `AvisoModal` sin cambiar lo que dicen.
 *
 * ── CÓMO CUENTA ─────────────────────────────────────────────────────────────
 * Una ventanita hecha a mano se reconoce por su botón: un `<button …>Entendido</button>` (o `{'Entendido'}`) escrito
 * en una pantalla. Se cuenta sobre el código SIN comentarios (con el lector de medir-ley-boton.cjs, que conserva los
 * renglones y no se come un `accept="image/*"`). `AvisoModal.js` no cuenta: es la pieza común.
 *
 * `PENDIENTES` lleva, archivo por archivo, las que QUEDAN y por qué. La prueba (pruebas/ventanitasAviso.test.js)
 * exige que la cuenta de hoy sea EXACTAMENTE esa: una ventanita nueva a mano la pone roja, y una que se pase a
 * `AvisoModal` sin bajar la cuenta aquí también. Así la lista solo puede bajar, y bajar a la vista.
 *
 * ── Y QUE DIGAN LO MISMO ────────────────────────────────────────────────────
 * `CAMBIADAS` son las que pasaron a `AvisoModal`. De cada una se SACA del archivo lo que se le da a la ventanita
 * (el `aviso={…}` o el `setAviso(…)`) y se EJECUTA con un caso, y se compara con lo que decía la de antes (dibujito,
 * título y texto). Si alguien cambia las palabras, o la devuelve a mano, se ve.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, sinTextos, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { soloCodigo } = require('./medir-ley-boton.cjs');

const APPS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const COMUN = 'AvisoModal.js';

// El botón de una ventanita hecha a mano. `>Entendido</button>`, `>{'Entendido'}</button>`, `>Entendido 👍</button>`,
// `<span>Entendido</span></button>`, con espacios o sin ellos. (Un botón que diga otra palabra, o un `<div onClick>`
// haciendo de botón, NO lo ve: perseguir todas las formas no acaba nunca. Lo dice el informe de G39.)
const BOTON = />\s*(?:\{\s*(['"`]))?Entendido[^<>{}'"`\n]{0,4}\1?\s*\}?\s*(?:<\/(?:span|b|strong)>\s*)?<\/button>/g;

// Las que QUEDAN escritas a mano, y por qué. Solo puede bajar.
const PENDIENTES = {
  // NO son avisos: se quedan así a propósito.
  'guajirago/src/Anuncio.js': [2, 'el anuncio que escribe el dueño en el panel: pantalla completa y texto largo con saltos de renglón, encima de todo'],
  'guajirago/src/AppConductor.js': [1, 'MensajeGrande: el mensaje del pasajero en letra gigante para el conductor, no es un aviso'],
  'guajirago/src/Promociones.js': [1, 'la celebración con confeti de «¡Código activado!» (gemelo G80)'],
  // Del panel y de aliados: SÍ son avisos, pero no eran de este gemelo (la auditoría era de transporte). Van aparte.
  'guajirago-admin/src/ComentariosReportados.js': [1, 'panel: va aparte'],
  'guajirago-aliados/src/CalificacionesRestaurante.js': [1, 'aliados: va aparte'],
  'guajirago-aliados/src/Inventario.js': [1, 'aliados: va aparte'],
  'guajirago-aliados/src/Menu.js': [1, 'aliados: va aparte'],
  'guajirago-aliados/src/Mesero.js': [1, 'aliados: va aparte'],
  'guajirago-aliados/src/Promociones.js': [1, 'aliados: va aparte'],
  'guajirago-aliados/src/Tours.js': [1, 'aliados: va aparte'],
};

// Las que pasaron a AvisoModal (G39), con lo que DECÍA la de antes: [dibujito, título, texto].
//   · `modal`: se busca el `<AvisoModal aviso={…}` que se cierra con ese `onCerrar`.
//   · `desde` + `vez`: se busca la vez n-ésima de `setAviso(` a partir de ese texto (Solicitar.js tiene UNA ventanita
//     general por pantalla, puesta de última, y los avisos entran por ella).
const CAMBIADAS = [
  { nombre: 'Solicitar · conductor ocupado (taxi)', archivo: 'guajirago/src/Solicitar.js', desde: "r.motivo === 'ocupado'", vez: 1,
    caso: { oferta: { conductorNombre: 'Pedro' }, esMensajeria: false },
    decia: ['🚕', 'Conductor ocupado', 'Pedro ya tomó otro viaje. Escoge otra de las propuestas.'] },
  { nombre: 'Solicitar · conductor ocupado (mandado, sin nombre)', archivo: 'guajirago/src/Solicitar.js', desde: "r.motivo === 'ocupado'", vez: 1,
    caso: { oferta: {}, esMensajeria: true },
    decia: ['🏍️', 'Conductor ocupado', 'Ese conductor ya tomó otro servicio. Escoge otra de las propuestas.'] },
  { nombre: 'Solicitar · no se pudo confirmar al conductor', archivo: 'guajirago/src/Solicitar.js', desde: "r.motivo === 'ocupado'", vez: 2,
    caso: { oferta: { conductorNombre: 'Pedro' }, esMensajeria: false },
    decia: ['⚠️', 'No se pudo confirmar', 'Intenta de nuevo en un momento.'] },
  { nombre: 'Solicitar · llegaste al límite de favoritos', archivo: 'guajirago/src/Solicitar.js', desde: 'const guardarFavorito = ', vez: 1,
    caso: { configApp: { maximoFavoritos: 2 } }, conConfig: true,
    decia: ['📍', 'Llegaste al límite', 'Solo puedes guardar 2 lugares. Borra uno para poder agregar otro.'] },
  { nombre: 'Solicitar · te faltan datos del mandado', archivo: 'guajirago/src/Solicitar.js', desde: 'if (faltan.length > 0)', vez: 1,
    caso: { faltan: ['Dónde se recoge', 'Qué vas a enviar'] },
    // Antes: «TE FALTAN DATOS», «Completa esto para enviar tu mandado:» y la lista con una ❌ por dato.
    decia: ['📋', 'Te faltan datos', 'Completa esto para enviar tu mandado: Dónde se recoge, Qué vas a enviar.'] },
  { nombre: 'Calificacion · la calificación no entró', archivo: 'guajirago/src/Calificacion.js', modal: 'onCerrar={() => setAviso(null)}',
    caso: { aviso: { titulo: 'No pudimos guardar tu calificación', texto: 'Revisa tu conexión.' } },
    decia: ['⭐', 'No pudimos guardar tu calificación', 'Revisa tu conexión.'] },
  { nombre: 'Restaurantes · la calificación no entró', archivo: 'guajirago/src/Restaurantes.js', modal: 'onCerrar={() => setAvisoCalif(null)}',
    caso: { avisoCalif: { titulo: 'No pudimos guardar tu calificación', texto: 'Revisa tu conexión.' } },
    decia: ['⭐', 'No pudimos guardar tu calificación', 'Revisa tu conexión.'] },
  { nombre: 'Restaurantes · falta el método de pago', archivo: 'guajirago/src/Restaurantes.js', modal: "onCerrar={() => setAvisoPago('')}",
    caso: { avisoPago: 'Escoge cómo vas a pagar tu pedido para continuar.' },
    decia: ['💳', 'Falta el método de pago', 'Escoge cómo vas a pagar tu pedido para continuar.'] },
  { nombre: 'Restaurantes · promoción sin cupos', archivo: 'guajirago/src/Restaurantes.js', modal: "onCerrar={() => setAvisoPromo('')}",
    caso: { avisoPromo: 'Con este teléfono ya usaste el máximo de veces: 2x1.' },
    decia: ['🏷️', 'Promoción sin cupos', 'Con este teléfono ya usaste el máximo de veces: 2x1.'] },
  { nombre: 'Restaurantes · falta el nombre de la calle', archivo: 'guajirago/src/Restaurantes.js', modal: "onCerrar={() => setAvisoUbic('')}",
    caso: { avisoUbic: 'SIN CALLE', SIN_NOMBRE_DE_CALLE: 'SIN CALLE' },
    decia: ['📍', 'Falta el nombre de la calle', 'SIN CALLE'] },
  { nombre: 'Restaurantes · ubicación no disponible', archivo: 'guajirago/src/Restaurantes.js', modal: "onCerrar={() => setAvisoUbic('')}",
    caso: { avisoUbic: 'Activa el GPS.', SIN_NOMBRE_DE_CALLE: 'SIN CALLE' },
    decia: ['📍', 'Ubicación no disponible', 'Activa el GPS.'] },
  { nombre: 'Turismo · falta un dato de la reserva', archivo: 'guajirago/src/Turismo.js', modal: "onCerrar={() => setAviso('')}",
    caso: { aviso: 'Escoge la fecha' },
    // Antes no tenía título: el aviso era una sola frase en negrita. Ahora esa frase es el título, y no hay texto.
    decia: ['⚠️', 'Escoge la fecha', ''] },
  { nombre: 'Login · atención al registrarse', archivo: 'guajirago/src/Login.js', modal: "onCerrar={() => setError('')}",
    caso: { error: 'Los correos no coinciden' },
    decia: ['⚠️', 'Atención', 'Los correos no coinciden'] },
  { nombre: 'App · falta un dato del conductor', archivo: 'guajirago/src/App.js', modal: "onCerrar={() => setError('')}",
    caso: { error: 'Falta la placa del vehículo' },
    decia: ['⚠️', 'Falta un dato', 'Falta la placa del vehículo'] },
  { nombre: 'Configuracion · correo enviado', archivo: 'guajirago/src/Configuracion.js', modal: "onCerrar={() => setCorreoEnviado('')}",
    caso: { correoEnviado: 'ana@correo.com' },
    // Antes: el correo en verde y la nota del spam en un recuadro amarillo; las mismas palabras, en un solo texto.
    decia: ['📧', '¡Correo enviado!', 'Te enviamos un enlace para cambiar tu contraseña a: ana@correo.com. Si no lo ves en tu bandeja de entrada, revisa la carpeta de correo no deseado o spam.'] },
];

/** Lee un archivo del disco, o de un commit (`git show`). Los de admin y aliados son repos aparte. */
function lectorDe(commit) {
  return (ruta) => {
    if (!commit) {
      const r = path.join(RAIZ, ruta);
      return fs.existsSync(r) ? fs.readFileSync(r, 'utf8') : null;
    }
    const repo = ruta.startsWith('guajirago-admin/') ? 'guajirago-admin' : ruta.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : '.';
    if (repo !== '.') { // un commit de la raíz no dice nada de los otros repos: esos se leen del disco
      const r = path.join(RAIZ, ruta);
      return fs.existsSync(r) ? fs.readFileSync(r, 'utf8') : null;
    }
    try { return execFileSync('git', ['show', commit + ':' + ruta], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }); } catch (e) { return null; }
  };
}

function listarArchivos(commit) {
  const out = [];
  for (const app of APPS) {
    const repo = app.split('/')[0];
    if (commit && repo === 'guajirago') {
      const l = execFileSync('git', ['ls-tree', '-r', '--name-only', commit, app], { cwd: RAIZ, encoding: 'utf8' }).split('\n');
      for (const f of l) if (f.endsWith('.js')) out.push(f);
      continue;
    }
    const dir = path.join(RAIZ, app);
    if (!fs.existsSync(dir)) continue;
    const andar = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) andar(p);
        else if (e.name.endsWith('.js')) out.push(path.relative(RAIZ, p).split(path.sep).join('/'));
      }
    };
    andar(dir);
  }
  return out.sort();
}

/** Cuántas ventanitas a mano tiene un texto de código, y en qué renglones. */
function contarEn(codigo) {
  const limpio = soloCodigo(codigo);
  const renglones = [];
  for (const m of limpio.matchAll(BOTON)) renglones.push(limpio.slice(0, m.index).split('\n').length);
  return renglones;
}

/** Lo que va entre la llave o el paréntesis que abre en `abre` y el que lo cierra (sin que los textos despisten). */
function balanceado(codigo, abre) {
  const seguro = sinTextos(codigo);
  const par = { '{': '}', '(': ')' }[seguro[abre]];
  if (!par) return null;
  let hondo = 0;
  for (let i = abre; i < seguro.length; i += 1) {
    if (seguro[i] === seguro[abre]) hondo += 1;
    else if (seguro[i] === par) { hondo -= 1; if (hondo === 0) return codigo.slice(abre + 1, i); }
  }
  return null;
}

/** Saca del archivo lo que se le da a la ventanita en ese sitio. Devuelve { expr } o { falla }. */
function expresionDe(codigo, s) {
  const c = soloCodigo(codigo.replace(/\r\n/g, '\n'));
  if (s.modal) {
    const iC = c.indexOf(s.modal);
    if (iC < 0) return { falla: 'no hay ventanita que se cierre con ' + s.modal };
    const iM = c.lastIndexOf('<AvisoModal aviso={', iC);
    if (iM < 0 || c.slice(iM, iC).includes('/>')) return { falla: 'la ventanita que se cierra con ' + s.modal + ' no es AvisoModal (sigue a mano)' };
    const expr = balanceado(c, iM + '<AvisoModal aviso='.length);
    return expr ? { expr } : { falla: 'no pude leer el aviso={…}' };
  }
  const iD = c.indexOf(s.desde);
  if (iD < 0) return { falla: 'no encuentro «' + s.desde + '»' };
  let i = iD;
  for (let n = 0; n < s.vez; n += 1) {
    i = c.indexOf('setAviso(', n === 0 ? i : i + 1);
    // Cerca, no «en cualquier parte de después»: con el código de antes el primer setAviso( quedaba a cientos de
    // renglones y era de otra cosa.
    if (i < 0 || i - iD > 600) return { falla: 'después de «' + s.desde + '» no hay ' + s.vez + ' setAviso(…) cerca (sigue a mano)' };
  }
  const expr = balanceado(c, i + 'setAviso'.length);
  return expr ? { expr } : { falla: 'no pude leer el setAviso(…)' };
}

/** Qué pinta AvisoModal con ese aviso: el dibujito por defecto se SACA de AvisoModal.js, no se copia. */
function iconoPorDefecto(leerArchivo) {
  const m = /aviso\.icono \|\| '([^']+)'/.exec(leerArchivo('guajirago/src/AvisoModal.js') || '');
  return m ? m[1] : null;
}

function revisarCambiada(s, leerArchivo, porDefecto) {
  const codigo = leerArchivo(s.archivo);
  if (codigo == null) return { ...s, falla: 'no existe el archivo' };
  const x = expresionDe(codigo, s);
  if (x.falla) return { ...s, falla: x.falla };
  const vars = { ...s.caso };
  if (s.conConfig) {
    const cfg = cargarDeLaApp('guajirago/src/configApp.js', leerArchivo('guajirago/src/configApp.js'));
    Object.assign(vars, cfg);
    vars.configApp = { ...cfg.CONFIG_COMPARTIDA, ...s.caso.configApp };
  }
  let aviso;
  try {
    // eslint-disable-next-line no-new-func
    aviso = new Function(...Object.keys(vars), 'return (' + x.expr + ');')(...Object.values(vars));
  } catch (e) { return { ...s, falla: 'al ejecutarlo: ' + e.message }; }
  if (!aviso || typeof aviso !== 'object') return { ...s, falla: 'con el caso no hay aviso' };
  const dice = [aviso.icono || porDefecto, aviso.titulo == null ? '' : String(aviso.titulo), aviso.texto == null ? '' : String(aviso.texto)];
  const igual = dice.every((v, k) => v === s.decia[k]);
  return { ...s, dice, igual };
}

/** La cuenta entera, pura: con qué archivos y cómo leerlos. */
function analizar(archivos, leerArchivo) {
  const aMano = {};
  for (const f of archivos) {
    if (path.posix.basename(f) === COMUN) continue;
    const t = leerArchivo(f);
    if (t == null) continue;
    const r = contarEn(t);
    if (r.length) aMano[f] = r;
  }
  const nuevas = [];
  const sobran = [];
  for (const [f, rs] of Object.entries(aMano)) {
    const permitido = PENDIENTES[f] ? PENDIENTES[f][0] : 0;
    if (rs.length > permitido) nuevas.push(f + ' (' + rs.length + ', se permiten ' + permitido + ': renglones ' + rs.join(', ') + ')');
  }
  for (const [f, [n]] of Object.entries(PENDIENTES)) {
    const hay = aMano[f] ? aMano[f].length : 0;
    if (hay < n) sobran.push(f + ' (quedan ' + hay + ' y PENDIENTES dice ' + n + ': bájalo)');
  }
  const porDefecto = iconoPorDefecto(leerArchivo);
  const cambiadas = CAMBIADAS.map((s) => revisarCambiada(s, leerArchivo, porDefecto));
  const total = Object.values(aMano).reduce((a, r) => a + r.length, 0);
  const transporte = Object.entries(aMano).filter(([f]) => f.startsWith('guajirago/')).reduce((a, [, r]) => a + r.length, 0);
  return { aMano, total, transporte, nuevas, sobran, cambiadas, bien: cambiadas.filter((c) => c.igual).length };
}

function medir(commit) {
  return analizar(listarArchivos(commit), lectorDe(commit));
}

module.exports = { medir, analizar, contarEn, expresionDe, PENDIENTES, CAMBIADAS, BOTON, APPS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const iC = args.indexOf('--commit');
  const commit = iC >= 0 ? args[iC + 1] : null;
  const r = medir(commit);
  console.log('🪟 VENTANITAS DE AVISO ESCRITAS A MANO — ' + (commit ? 'commit ' + commit : 'el disco de hoy'));
  console.log('   transporte: ' + r.transporte + ' · las tres apps: ' + r.total);
  for (const [f, rs] of Object.entries(r.aMano)) {
    const p = PENDIENTES[f];
    console.log('   · ' + f + ': ' + rs.length + (args.includes('--detalle') ? ' (renglones ' + rs.join(', ') + ')' : '') + (p ? '  — ' + p[1] : '  — ⛔ NO está en PENDIENTES'));
  }
  console.log('\n   Las que pasaron a AvisoModal, ejecutadas con un caso (' + r.bien + ' de ' + r.cambiadas.length + ' dicen lo mismo que antes):');
  for (const c of r.cambiadas) {
    if (c.falla) console.log('   ✗ ' + c.nombre + ': ' + c.falla);
    else console.log('   ' + (c.igual ? '✓' : '✗') + ' ' + c.nombre + (c.igual ? '' : '\n       decía: ' + JSON.stringify(c.decia) + '\n       dice:  ' + JSON.stringify(c.dice)));
  }
  const ok = !r.nuevas.length && !r.sobran.length && r.bien === r.cambiadas.length;
  if (r.nuevas.length) console.log('\n   ⛔ NUEVAS a mano: ' + r.nuevas.join(' · '));
  if (r.sobran.length) console.log('\n   ⛔ PENDIENTES se quedó alto: ' + r.sobran.join(' · '));
  console.log('\n' + (ok ? '✓ todo en su sitio' : '✗ hay diferencias (ver arriba)'));
}
