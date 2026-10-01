#!/usr/bin/env node
/**
 * 📇 P21 · LO QUE EL VIAJE DEL MERCADO DICE DEL PASAJERO — SOLO LECTURA.
 *
 * Un viaje que busca conductor lo leen TODOS los conductores (P20). Este guion mide qué datos del pasajero van dentro
 * de ese documento público y cuáles el conductor solo necesita DESPUÉS de ser aceptado:
 *
 *   1. EL CÓDIGO (el de hoy o el de `--commit X`): se EJECUTA `armarViajeNuevo` (viajeNuevo.js) con el paquete del
 *      mandado tal como lo escribe Solicitar.js (el `extras:` se saca del archivo y se corre), y se dice qué campos
 *      sensibles salen en el viaje. Del token de avisos se mira a qué documento lo pega la pantalla.
 *   2. LA TARJETA DEL MERCADO (AppConductor.js): si le enseña al conductor el teléfono de quien recibe ANTES de aceptar.
 *   3. QUIÉN LEE cada campo (hoy): los renglones de código de las tres apps y del servidor que lo nombran.
 *   4. `--nube`: cuántos viajes de producción llevan cada campo, y cuántos están en el mercado ahora.
 *   5. P22 · LAS REGLAS (las de hoy o las de `--commit X`): qué campos sensibles deja escribir en el viaje el `allow
 *      create` y el `allow update` (fase 1: los tres; fase 2: ninguno).
 *   6. `--publicado`: en los paquetes publicados (app, panel, aliados y pruebas), si nombran el correo y si arman el
 *      teléfono de quien recibe dentro de `mensajeria` (o sea, en el viaje).
 *
 *   node scripts/medir-contacto-del-viaje.cjs                  → el código de hoy
 *   node scripts/medir-contacto-del-viaje.cjs --commit 7733a4f → el código de ese commit (el «antes»)
 *   node scripts/medir-contacto-del-viaje.cjs --nube           → y los datos de producción
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cargarDeLaApp, soloCodigo } = require('../pruebas/cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');

function leerDe(commit, rel) {
  if (!commit) return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
  return execFileSync('git', ['show', commit + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 1 << 26 });
}

/** El objeto entre llaves que empieza en `desde` (la primera `{` a partir de ahí), con las llaves equilibradas. */
function objetoDesde(texto, desde) {
  const a = texto.indexOf('{', desde);
  let hondo = 0;
  for (let k = a; k < texto.length; k++) {
    if (texto[k] === '{') hondo++;
    else if (texto[k] === '}' && --hondo === 0) return texto.slice(a, k + 1);
  }
  throw new Error('no cierro el objeto que empieza en ' + a);
}

/**
 * El viaje PÚBLICO de un mandado, como lo crea la pantalla: se corre armarViajeNuevo con el `extras:` que Solicitar.js
 * le pasa (sacado del archivo y EJECUTADO con un mandado de ejemplo). Función pura sobre los dos textos.
 */
function viajePublicoDeUnMandado(textoViajeNuevo, textoSolicitar) {
  const { armarViajeNuevo } = cargarDeLaApp('guajirago/src/viajeNuevo.js', textoViajeNuevo);
  const t = soloCodigo(textoSolicitar);
  const llamada = t.indexOf('armarViajeNuevo({');
  if (llamada < 0) throw new Error('Solicitar.js ya no llama a armarViajeNuevo({');
  const i = t.indexOf('extras:', llamada);
  if (i < 0) throw new Error('la llamada a armarViajeNuevo no lleva extras:');
  const expr = objetoDesde(t, i);
  const ejemplo = { queEnvia: ' Documentos ', recibeNombre: ' Rosa ', recibeTel: '300 111 2233', notaEnvio: ' Timbrar ' };
  // eslint-disable-next-line no-new-func
  const extras = new Function('queEnvia', 'recibeNombre', 'recibeTel', 'notaEnvio', 'celularDiezCifras', 'esMensajeria',
    'return ' + expr + ';')(ejemplo.queEnvia, ejemplo.recibeNombre, ejemplo.recibeTel, ejemplo.notaEnvio,
    (s) => String(s).replace(/\D/g, '').slice(-10), true);
  return armarViajeNuevo({
    user: { uid: 'ana', email: 'ana@correo.co' }, nombrePasajero: 'Ana Pérez', coords: { lat: 11.5444, lng: -72.9072 },
    tipo: 'Mensajería', origen: 'Calle 1', destino: 'Calle 9', tarifa: 8000, datosDescuento: null, radioBusqueda: 3, extras,
  }, new Date('2026-10-01T12:00:00.000Z'));
}

/** Los campos sensibles que salen en el viaje público (los que el conductor solo necesita después de aceptar). */
const SENSIBLES = ['pasajeroEmail', 'pasajeroFcmToken', 'mensajeria.recibeTel'];
function sensiblesEnElViaje(viaje) {
  const valor = (k) => k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), viaje);
  return SENSIBLES.filter((k) => valor(k) !== undefined && valor(k) !== null && valor(k) !== '');
}

/**
 * ¿A qué documento pega la pantalla el token de avisos? 'viaje' si lo pega en lo que devuelve el addDoc de `viajes`;
 * 'contacto' si lo pega en una ruta armada con refContactoDelViaje; si no, 'otro'/'no lo pega'.
 */
function dondeVaElToken(textoSolicitar) {
  const t = soloCodigo(textoSolicitar);
  const prep = t.match(/const\s+(\w+)\s*=\s*prepararTokenDeAvisos\(\s*'pasajeroFcmToken'\s*\)/);
  if (!prep) return 'no lo pega';
  const pegado = t.match(new RegExp('\\b' + prep[1] + '\\(\\s*([^)]*?)\\s*\\)'));
  if (!pegado) return 'no lo pega';
  const arg = pegado[1];
  const viaje = (t.match(/const\s+(\w+)\s*=\s*await\s+addDoc\(\s*collection\(\s*db\s*,\s*'viajes'\s*\)/) || [])[1];
  if (arg === viaje) return 'viaje';
  if (/^refContactoDelViaje\(/.test(arg)) return 'contacto';
  const def = t.match(new RegExp('const\\s+' + arg.replace(/\W/g, '') + '\\s*=\\s*refContactoDelViaje\\('));
  return def ? 'contacto' : 'otro (' + arg + ')';
}

/** Los renglones del archivo con su número de verdad, sin los que son comentario (`//`, `/*`, `*`). */
function renglonesDeCodigo(texto) {
  return texto.replace(/\r\n/g, '\n').split('\n').map((l, i) => ({ l, n: i + 1 }))
    .filter(({ l }) => !/^\s*(\/\/|\/\*|\*)/.test(l));
}

/** Renglones de la TARJETA DEL MERCADO (lo que pinta `solicitud.` en AppConductor.js) que nombran el teléfono de quien recibe. */
function telefonoEnLaTarjetaDelMercado(textoConductor) {
  return renglonesDeCodigo(textoConductor)
    .filter(({ l }) => /\bsolicitud\b/.test(l) && /recibeTel/.test(l))
    .map(({ n }) => n);
}

const DONDE_SE_LEE = [
  'guajirago/src', 'guajirago/functions/index.js', 'guajirago-admin/src', 'guajirago-aliados/src',
];
function archivos(rel) {
  const abs = path.join(RAIZ, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).filter((f) => /\.(js|cjs)$/.test(f) && !/\.test\.js$/.test(f)).map((f) => rel + '/' + f);
}
/** Quién NOMBRA cada campo en el código (sin comentarios), sin contar la pieza que arma el viaje. */
function quienLo(campo) {
  const r = [];
  for (const base of DONDE_SE_LEE) {
    for (const rel of archivos(base)) {
      renglonesDeCodigo(fs.readFileSync(path.join(RAIZ, rel), 'utf8')).forEach(({ l, n }) => {
        if (new RegExp('\\b' + campo + '\\b').test(l)) r.push(rel + ':' + n);
      });
    }
  }
  return r;
}

function contarEnLaNube(viajes) {
  const r = { viajes: viajes.length, enElMercado: viajes.filter((v) => v.estado === 'esperando').length };
  for (const k of SENSIBLES) r[k] = viajes.filter((v) => sensiblesEnElViaje(v).includes(k)).length;
  r.mandados = viajes.filter((v) => v.tipo === 'Mensajería').length;
  return r;
}

function veredicto({ publicos, token, tarjeta }) {
  const v = [];
  if (publicos.length) v.push('🔴 el viaje del mercado lleva ' + publicos.join(', ') + ': lo lee cualquier conductor antes de que lo acepten');
  if (token === 'viaje') v.push('🔴 la pantalla pega el token de avisos del pasajero en el viaje del mercado');
  else if (token !== 'contacto') v.push('🔴 no sé dónde pega la pantalla el token de avisos: ' + token);
  if (tarjeta.length) v.push('🔴 la tarjeta del mercado le enseña al conductor el teléfono de quien recibe (AppConductor.js:' + tarjeta.join(', ') + ')');
  return v;
}

// ── P22 · LAS REGLAS: ¿dejan ESCRIBIR esos campos en el viaje? ──
/**
 * Del `match /viajes/{viajeId}` (sin comentarios y sin las subcolecciones) saca el `allow create` y el `allow update`,
 * les expande las funciones que llaman (las de ese mismo bloque, hasta el fondo) y dice cuáles de los campos sensibles
 * NO nombra cada guardia: esos son los que una app (vieja o hecha a mano) puede escribir en el viaje. Mira el TEXTO:
 * que la guardia de verdad niegue lo carea el emulador (pruebas/contactoDelViaje.test.js).
 */
function camposQueLasReglasDejanEscribir(reglas) {
  const { sinComentarios } = require('./medir-lectura-ajena.cjs');
  const t = sinComentarios(reglas.replace(/\r\n/g, '\n'));
  const i = t.indexOf('match /viajes/{viajeId}');
  if (i < 0) throw new Error('no encuentro match /viajes/{viajeId} en las reglas');
  const b = t.slice(i, t.indexOf('match /privado/', i));
  const funciones = {};
  for (const m of b.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{/g)) funciones[m[1]] = objetoDesde(b, m.index);
  const expandir = (texto, vistos = new Set()) => texto.replace(/\b(\w+)\s*\(/g, (todo, nombre) => {
    if (!funciones[nombre] || vistos.has(nombre)) return todo;
    return '(' + expandir(funciones[nombre], new Set([...vistos, nombre])) + ')(';
  });
  const guardia = (que) => {
    const a = b.indexOf('allow ' + que + ':');
    if (a < 0) throw new Error('no encuentro allow ' + que + ': en el viaje');
    return expandir(b.slice(a, b.indexOf(';', a)));
  };
  const r = {};
  for (const que of ['create', 'update']) {
    const g = guardia(que);
    r[que] = SENSIBLES.filter((k) => !new RegExp('\\b' + k.split('.').pop() + '\\b').test(g));
  }
  return r;
}

/** En el paquete PUBLICADO: veces que nombra el correo, y si arma un `mensajeria:{…recibeTel…}` (el teléfono en el viaje). */
function contactoEnElPaquete(texto) {
  return {
    pasajeroEmail: (texto.match(/pasajeroEmail/g) || []).length,
    telefonoEnElViaje: /mensajeria:\{[^}]*recibeTel/.test(texto),
    pasajeroFcmToken: (texto.match(/pasajeroFcmToken/g) || []).length,
  };
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const solicitar = leerDe(commit, 'guajirago/src/Solicitar.js');
  const viaje = viajePublicoDeUnMandado(leerDe(commit, 'guajirago/src/viajeNuevo.js'), solicitar);
  const publicos = sensiblesEnElViaje(viaje);
  const token = dondeVaElToken(solicitar);
  const tarjeta = telefonoEnLaTarjetaDelMercado(leerDe(commit, 'guajirago/src/AppConductor.js'));
  console.log('── LO QUE EL VIAJE DEL MERCADO DICE DEL PASAJERO · ' + (commit || 'hoy') + ' ──');
  console.log('  código · un mandado nace con: ' + Object.keys(viaje).filter((k) => k !== 'mensajeria').join(', ')
    + ', mensajeria.{' + Object.keys(viaje.mensajeria || {}).join(', ') + '}');
  console.log('  código · sensibles en el viaje público: ' + (publicos.join(', ') || 'ninguno'));
  console.log('  código · el token de avisos del pasajero se pega en: ' + token);
  console.log('  código · la tarjeta del mercado enseña el teléfono de quien recibe: ' + (tarjeta.length ? 'sí (AppConductor.js:' + tarjeta.join(', ') + ')' : 'no'));
  if (!commit) {
    for (const campo of ['pasajeroEmail', 'pasajeroFcmToken', 'recibeTel', 'pasajeroNombre', 'pasajeroLat']) {
      const q = quienLo(campo);
      console.log('  hoy · nombran «' + campo + '» (' + q.length + '): ' + (q.join(' · ') || 'nadie'));
    }
  }
  const reglas = camposQueLasReglasDejanEscribir(leerDe(commit, 'firestore.rules'));
  console.log('  reglas · el viaje deja escribir al CREARLO: ' + (reglas.create.join(', ') || 'ninguno')
    + ' · al CAMBIARLO: ' + (reglas.update.join(', ') || 'ninguno'));
  if (process.argv.includes('--publicado')) {
    const L = require('./medir-lectura-ajena.cjs');
    for (const sitio of ['guajirago', 'guajirago-admin', 'guajirago-aliados', 'guajirago-pruebas']) {
      const p = await L.paquete(sitio); // eslint-disable-line no-await-in-loop
      const c = contactoEnElPaquete(p.texto);
      console.log('  publicado · ' + sitio + '.web.app (' + p.nombre.split('/').pop() + '): nombra pasajeroEmail ' + c.pasajeroEmail
        + ' · arma el teléfono dentro de mensajeria: ' + (c.telefonoEnElViaje ? 'SÍ' : 'no') + ' · nombra pasajeroFcmToken ' + c.pasajeroFcmToken);
    }
  }
  if (process.argv.includes('--nube')) {
    const N = require('./nube.cjs');
    const viajes = (await N.traer('viajes')).map(N.doc);
    const c = contarEnLaNube(viajes);
    console.log('  producción · viajes ' + c.viajes + ' (mandados ' + c.mandados + ') · en el mercado ahora ' + c.enElMercado
      + ' · llevan ' + SENSIBLES.map((k) => k + ' ' + c[k]).join(', '));
    if (N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
  }
  const v = veredicto({ publicos, token, tarjeta });
  for (const que of ['create', 'update']) {
    if (reglas[que].length) v.push('🟠 las reglas aún dejan ' + (que === 'create' ? 'CREAR' : 'CAMBIAR') + ' un viaje con ' + reglas[que].join(', ') + ' dentro (fase 1)');
  }
  console.log('\n── VEREDICTO ──\n  ' + (v.length ? v.join('\n  ') : '✓ el viaje del mercado no lleva correo, teléfono de quien recibe ni token del pasajero'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { viajePublicoDeUnMandado, sensiblesEnElViaje, dondeVaElToken, telefonoEnLaTarjetaDelMercado, contarEnLaNube, veredicto, objetoDesde, SENSIBLES, camposQueLasReglasDejanEscribir, contactoEnElPaquete };
