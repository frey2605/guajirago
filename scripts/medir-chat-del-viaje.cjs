#!/usr/bin/env node
/**
 * ¿CUÁNTAS VECES ESTÁ ESCRITO EL CHAT DEL VIAJE? — gemelo G96 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-chat-del-viaje.cjs              (el código de hoy + los chats de producción)
 *   node scripts/medir-chat-del-viaje.cjs --sin-red    (solo el código)
 *   node scripts/medir-chat-del-viaje.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * Durante el viaje, el conductor y el pasajero se escriben por `viajes/{id}/mensajes`. Escuchar ese chat y enviar un
 * mensaje estaba copiado en las dos pantallas (AppConductor.js y Solicitar.js), y la escucha iba sin manejador de
 * error: si el servidor la cortaba, los mensajes nuevos dejaban de llegar y nadie se enteraba.
 *
 * Mide dos cosas:
 *   1. CÓDIGO: cuántas veces nombran las pantallas la colección 'mensajes' (fuera de la pieza), y CORRE el chat de
 *      cada pantalla —el de antes, sacado del archivo, o la pieza con los argumentos que le pasa la pantalla— con el
 *      MISMO guion: a qué escucha y en qué orden, qué mensajes enseña, si baja al último, si sigue al viaje nuevo,
 *      si suelta la escucha, qué pasa si el servidor la corta, y QUÉ ESCRIBE en la base al enviar (con la tecla o el
 *      botón: los dos llaman al mismo manejador), con texto vacío, sin viaje, sin usuario y si la escritura falla.
 *   2. DATOS (producción): cuántos viajes tienen chat, cuántos mensajes, con qué campos y de qué forma. No escribe.
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { leer, sinTextos, cuerpoDeLaFuncion, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { reactDeMentira } = require('./medir-llamada-entrante.cjs');

const RAIZ = path.join(__dirname, '..');
const PIEZA = 'guajirago/src/chatDelViaje.js';
const PANTALLAS = [
  // [archivo, su manejador de «enviar», quién escribe, lo que la pantalla tiene en su ámbito con viaje]
  ['guajirago/src/AppConductor.js', 'enviarMensajeConductor', 'conductor', () => ({ viajeActual: { id: 'V1', pasajeroNombre: 'Ana' } })],
  ['guajirago/src/Solicitar.js', 'enviarMensajeChat', 'pasajero', () => ({ viajeId: 'V1' })],
];
const AHORA = '2026-09-30T15:04:05.000Z';

function fuente(ruta, commit) {
  if (!commit) return fs.existsSync(path.join(RAIZ, ruta)) ? leer(ruta) : null;
  try {
    return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + ruta],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { return null; }
}

/** Quita los comentarios sin mover nada (los cambia por espacios y deja los saltos de renglón). */
const sinComentarios = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => l.replace(/^(\s*)(\/\/.*)/, (_, a, b) => a + ' '.repeat(b.length))).join('\n');

function aManoEn(ruta, texto) {
  const codigo = sinComentarios(texto);
  const renglon = (pos) => codigo.slice(0, pos).split('\n').length;
  return [...codigo.matchAll(/['"`]mensajes['"`]/g)].map((m) => ruta.split('/').pop() + ':' + renglon(m.index));
}

// ── Firestore de mentira: lo justo para el chat. ──
function firestoreDeMentira(falla) {
  const escuchas = [];
  const escrituras = [];
  return {
    escuchas,
    escrituras,
    db: { deMentira: true },
    collection: (_db, ...trozos) => ({ ruta: trozos.join('/') }),
    orderBy: (campo, dir) => 'orderBy(' + campo + ',' + dir + ')',
    query: (ref, ...mods) => ({ ruta: ref.ruta, mods }),
    onSnapshot: (q, siguiente, error) => {
      const e = { ruta: q.ruta + (q.mods ? ' ' + q.mods.join(' ') : ''), siguiente, error, soltada: false };
      escuchas.push(e);
      return () => { e.soltada = true; };
    },
    addDoc: (ref, datos) => {
      escrituras.push({ ruta: ref.ruta, datos: JSON.parse(JSON.stringify(datos)) });
      return falla ? Promise.reject(Object.assign(new Error('sin permiso'), { code: 'permission-denied' }))
        : Promise.resolve({ id: 'nuevo' });
    },
  };
}
const fotoDelChat = (lista) => ({ docs: lista.map(([id, datos]) => ({ id, data: () => datos })) });
class FechaFija { toISOString() { return AHORA; } }
const alInstante = (f) => { f(); return 0; };

/** Carga la pieza con el React y el Firestore de mentira, y el avisoRechazo.js DE VERDAD. */
function cargarPieza(texto, H, F, apuntes, auth) {
  const avisoRechazo = cargarDeLaApp('guajirago/src/avisoRechazo.js');
  const sinImports = texto.replace(/^import[^;]*;[ \t]*\r?$/gm, '');
  const nombres = [...sinImports.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const cuerpo = sinImports.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function('useState', 'useEffect', 'useRef', 'collection', 'query', 'orderBy', 'onSnapshot', 'addDoc',
    'db', 'auth', 'motivoDeRechazo', 'apuntarRechazo', 'Date', 'setTimeout',
    cuerpo + '\nreturn { ' + nombres.join(', ') + ' };')(
    H.useState, H.useEffect, H.useRef, F.collection, F.query, F.orderBy, F.onSnapshot, F.addDoc, F.db, auth,
    avisoRechazo.motivoDeRechazo, (donde, e) => apuntes.push([donde, e && e.code]), FechaFija, alInstante);
}

function evaluar(expr, ambito) {
  // eslint-disable-next-line no-new-func
  return new Function('ambito', 'with (ambito) { return [' + expr + ']; }')(ambito);
}

/** Lo que va entre los paréntesis de la llamada que empieza en `ini`. */
function argumentos(codigo, seguro, ini) {
  const abre = seguro.indexOf('(', ini);
  let hondo = 0;
  let k = abre;
  for (; k < seguro.length; k++) {
    if (seguro[k] === '(') hondo++;
    else if (seguro[k] === ')' && --hondo === 0) break;
  }
  return codigo.slice(abre + 1, k).trim();
}

/**
 * El chat de UNA pantalla, listo para correr. `montar(H, F, ambito, apuntes, auth)` da el gancho para el React de
 * mentira; lo que devuelve se reparte en el ámbito con los nombres que la pantalla le da. `enviar(ambito)` corre el
 * manejador de enviar de la pantalla, sacado de su archivo.
 */
function elChat(ruta, manejador, texto, textoPieza) {
  if (texto == null) return { queja: ruta + ' no existe' };
  const codigo = sinComentarios(texto);
  const seguro = sinTextos(codigo);
  const alGancho = [...seguro.matchAll(/\buseChatDelViaje\s*\(/g)];
  const nombraLaColeccion = [...codigo.matchAll(/['"`]mensajes['"`]/g)];
  // El manejador de enviar (lo llaman la tecla Enter y el botón ➤).
  const m = new RegExp('const\\s+' + manejador + '\\s*=\\s*async\\s*\\(\\)\\s*=>').exec(seguro);
  if (!m) return { queja: ruta + ': no encuentro «const ' + manejador + ' = async () =>»' };
  const cuerpoEnviar = cuerpoDeLaFuncion(codigo, m.index).texto;
  const enviar = (ambito) => {
    // eslint-disable-next-line no-new-func
    const f = new Function('ambito', 'with (ambito) { return (async () => {' + cuerpoEnviar + '\n})(); }');
    return f(ambito);
  };
  const llamaEnter = new RegExp("onKeyDown=\\{e => e\\.key === 'Enter' && " + manejador + '\\(\\)\\}', 'g');
  const llamaBoton = new RegExp('<button onClick=\\{' + manejador + '\\}', 'g');
  const entradas = { enter: (texto.match(llamaEnter) || []).length, boton: (texto.match(llamaBoton) || []).length };

  if (alGancho.length) {
    if (alGancho.length !== 1) return { queja: ruta + ' llama ' + alGancho.length + ' veces a useChatDelViaje (debe ser UNA)' };
    if (nombraLaColeccion.length) return { queja: ruta + ' usa la pieza y ADEMÁS nombra «mensajes» a mano' };
    if (!textoPieza) return { queja: ruta + ' usa useChatDelViaje pero ' + PIEZA + ' no existe' };
    const ini = alGancho[0].index;
    const args = argumentos(codigo, seguro, ini);
    const antes = codigo.slice(codigo.lastIndexOf('\n', ini) + 1, ini);
    const d = antes.match(/const\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*$/);
    if (!d) return { queja: ruta + ': no encuentro «const [mensajes, enviar] = useChatDelViaje(...)»' };
    return {
      forma: 'la pieza',
      args,
      nombres: [d[1], d[2]],
      entradas,
      enviar,
      montar: (H, F, ambito, apuntes, auth) => {
        const pieza = cargarPieza(textoPieza, H, F, apuntes, auth);
        return () => pieza.useChatDelViaje(...evaluar(args, ambito));
      },
    };
  }
  // La forma de antes: el useEffect que escucha 'mensajes' con onSnapshot, y su useState de la lista.
  const escucha = nombraLaColeccion.find((x) => {
    const efecto = seguro.lastIndexOf('useEffect(', x.index);
    return efecto >= 0 && /onSnapshot\s*\(/.test(seguro.slice(efecto, x.index + 200));
  });
  if (!escucha) return { queja: ruta + ': no usa la pieza y no encuentro la escucha de «mensajes»' };
  const efecto = seguro.lastIndexOf('useEffect(', escucha.index);
  const c = cuerpoDeLaFuncion(codigo, efecto);
  const deps = codigo.slice(c.fin + 1).match(/^\s*\}?\s*,\s*\[([^\]]*)\]/);
  if (!deps) return { queja: ruta + ': no encuentro las dependencias del useEffect del chat' };
  const lista = seguro.match(/const\s*\[\s*(\w+)\s*,\s*(set\w+)\s*\]\s*=\s*useState\(\[\]\);/g) || [];
  const setter = /setMensajesChat/.test(c.texto) ? ['mensajesChat', 'setMensajesChat'] : null;
  if (!setter || !lista.some((l) => l.includes('setMensajesChat'))) return { queja: ruta + ': no encuentro el useState de la lista del chat' };
  return {
    forma: 'escrita a mano',
    deps: deps[1].trim(),
    nombres: ['mensajesChat', null],
    entradas,
    enviar,
    montar: (H, F, ambito) => () => {
      const [mensajes, ponerMensajes] = H.useState([]);
      const todo = Object.assign(Object.create(null), ambito, {
        setMensajesChat: ponerMensajes, query: F.query, collection: F.collection, orderBy: F.orderBy,
        onSnapshot: F.onSnapshot, db: F.db, setTimeout: alInstante,
      });
      // eslint-disable-next-line no-new-func
      const correr = new Function('ambito', 'with (ambito) { ' + c.texto + '\n}');
      H.useEffect(() => correr(todo), evaluar(deps[1], ambito));
      return [mensajes, null];
    },
  };
}

const M1 = ['m1', { texto: 'Ya voy', autor: 'conductor', autorId: 'C1', fecha: '2026-09-30T15:00:00.000Z' }];
const M2 = ['m2', { texto: 'Te espero en la puerta', autor: 'pasajero', autorId: 'P1', fecha: '2026-09-30T15:01:00.000Z' }];

/** El guion de ESCUCHAR: el mismo para las dos pantallas, antes y después. */
function guionEscuchar(chat, ambitoBase) {
  const R = reactDeMentira();
  const F = firestoreDeMentira(false);
  const apuntes = [];
  const avisos = [];
  const bajadas = [];
  const ambito = { ...ambitoBase(), setAviso: (a) => avisos.push(a), chatFinRef: { current: { scrollIntoView: (o) => bajadas.push(o) } } };
  R.montar(chat.montar(R.H, F, ambito, apuntes, { currentUser: { uid: 'U1' } }));
  const viva = () => F.escuchas.filter((e) => !e.soltada);
  const lista = () => JSON.stringify(R.valor()[0]);
  const escuchaA = F.escuchas.length ? F.escuchas[0].ruta : '(no escucha)';
  const alEmpezar = lista();
  viva().forEach((e) => e.siguiente(fotoDelChat([M1])));
  const conUno = lista();
  viva().forEach((e) => e.siguiente(fotoDelChat([M1, M2])));
  const conDos = lista();
  const bajo = bajadas.length;
  const antesDeCambiar = F.escuchas.length;
  if (ambito.viajeActual) { ambito.viajeActual = { ...ambito.viajeActual }; R.repintar(); }
  const reescucha = F.escuchas.length - antesDeCambiar;
  if (ambito.viajeActual) ambito.viajeActual = { ...ambito.viajeActual, id: 'V2' };
  if ('viajeId' in ambito) ambito.viajeId = 'V2';
  R.repintar();
  const otroViaje = viva().map((e) => e.ruta).join(',') || '(ninguna)';
  const alCambiarDeViaje = lista();
  const corte = Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });
  const v = viva();
  const tieneManejador = v.length === 1 && typeof v[0].error === 'function';
  if (tieneManejador) v[0].error(corte);
  R.desmontar();
  const sueltaAlSalir = viva().length === 0;
  const R2 = reactDeMentira();
  const F2 = firestoreDeMentira(false);
  const vacio = Object.fromEntries(Object.keys(ambitoBase()).map((k) => [k, null]));
  R2.montar(chat.montar(R2.H, F2, { ...vacio, setAviso: () => {}, chatFinRef: { current: null } }, [], { currentUser: null }));
  return {
    escuchaA, alEmpezar, conUno, conDos, bajadas: bajo, bajaSuave: bajadas.every((o) => o && o.behavior === 'smooth'),
    reescucha, otroViaje, alCambiarDeViaje, tieneManejador, avisos, apuntes, sueltaAlSalir, sinViajeEscucha: F2.escuchas.length,
  };
}

/** El guion de ENVIAR: corre el manejador de la pantalla y anota qué se escribe en la base. */
async function guionEnviar(chat, ambitoBase) {
  const casos = [
    ['con texto', '  Ya llegué, estoy afuera  ', true, { uid: 'U1' }, false],
    ['solo espacios', '   ', true, { uid: 'U1' }, false],
    ['sin viaje', 'Hola', false, { uid: 'U1' }, false],
    ['sin usuario', 'Hola', true, null, false],
    ['la base lo rechaza', 'Hola', true, { uid: 'U1' }, true],
  ];
  const out = [];
  for (const [nombre, textoChat, conViaje, usuario, falla] of casos) {
    const R = reactDeMentira();
    const F = firestoreDeMentira(falla);
    const base = ambitoBase();
    if (!conViaje) for (const k of Object.keys(base)) base[k] = null;
    const auth = { currentUser: usuario };
    const vaciados = [];
    const correrLlamado = [];
    const ambito = Object.assign(Object.create(null), base, {
      textoChat, auth, setAviso: () => {}, chatFinRef: { current: null },
      setTextoChat: (t) => vaciados.push(t),
      addDoc: F.addDoc, collection: F.collection, db: F.db, Date: FechaFija,
      correr: async (fn, ...resto) => {
        correrLlamado.push(resto);
        try { return await fn(); } catch (e) { return { rechazado: e.code }; }
      },
    });
    R.montar(chat.montar(R.H, F, ambito, [], auth));
    const hecho = R.valor();
    chat.nombres.forEach((n, i) => { if (n) ambito[n] = hecho[i]; });
    // eslint-disable-next-line no-await-in-loop
    await chat.enviar(ambito);
    out.push([nombre, { escribe: F.escrituras, vacia: vaciados, candado: correrLlamado }]);
  }
  return out;
}

/** Función pura (asíncrona): de las fuentes, lo que mide el paso 1. */
async function medirCodigo(fuentes) {
  const quejas = [];
  const aMano = [];
  for (const [ruta, texto] of Object.entries(fuentes)) {
    if (ruta === PIEZA || texto == null) continue;
    aMano.push(...aManoEn(ruta, texto));
  }
  const pantallas = [];
  for (const [ruta, manejador, autor, ambito] of PANTALLAS) {
    const c = elChat(ruta, manejador, fuentes[ruta], fuentes[PIEZA]);
    if (c.queja) { quejas.push(c.queja); pantallas.push({ ruta, queja: c.queja }); continue; }
    // eslint-disable-next-line no-await-in-loop
    const envios = await guionEnviar(c, ambito);
    pantallas.push({ ruta, autor, forma: c.forma, args: c.args, deps: c.deps, entradas: c.entradas, ...guionEscuchar(c, ambito), envios });
  }
  return { aMano, pantallas, quejas };
}

function fuentesDe(commit) {
  const todas = {};
  let lista;
  if (commit) {
    lista = execFileSync('git', ['-C', RAIZ, 'ls-tree', '-r', '--name-only', commit, '--', 'guajirago/src'], { encoding: 'utf8' })
      .split('\n').filter((f) => /\.js$/.test(f));
  } else {
    lista = fs.readdirSync(path.join(RAIZ, 'guajirago/src')).filter((f) => /\.js$/.test(f)).map((f) => 'guajirago/src/' + f);
  }
  for (const r of lista) todas[r] = fuente(r, commit);
  if (!(PIEZA in todas)) todas[PIEZA] = null;
  return todas;
}

function informe(r, commit) {
  const L = [];
  L.push('\n1. CÓDIGO' + (commit ? ' del commit ' + commit : ' de hoy'));
  L.push('   veces que las pantallas nombran «mensajes» a mano: ' + r.aMano.length + (r.aMano.length ? '  (' + r.aMano.join(', ') + ')' : ''));
  for (const p of r.pantallas) {
    const nombre = p.ruta.split('/').pop();
    if (p.queja) { L.push('   🔴 ' + p.queja); continue; }
    L.push('   · ' + nombre + ' (' + p.autor + ') — ' + p.forma + (p.args ? ' (' + p.args + ')' : ' [' + p.deps + ']'));
    L.push('       escucha «' + p.escuchaA + '» · con 2 mensajes enseña ' + JSON.parse(p.conDos).length + ' · baja al último ' + p.bajadas + ' veces');
    L.push('       mismo viaje otra vez: vuelve a escuchar ' + p.reescucha + ' · otro viaje: ' + p.otroViaje + ' · suelta al salir: ' + (p.sueltaAlSalir ? 'sí' : '🔴 NO'));
    L.push('       si el servidor corta la escucha: ' + (p.tieneManejador
      ? 'lo dice — ' + p.avisos.length + ' aviso' + (p.avisos[0] ? ' «' + p.avisos[0].titulo + '»' : '') + ', ' + p.apuntes.length + ' rastro en consola'
      : '🔴 NADIE se entera (onSnapshot sin manejador de error)'));
    L.push('       enviar: Enter ' + p.entradas.enter + ' · botón ➤ ' + p.entradas.boton);
    for (const [caso, e] of p.envios) {
      L.push('         ' + caso + ': ' + (e.escribe.length ? e.escribe.map((w) => w.ruta + ' ' + JSON.stringify(w.datos)).join(' ; ') : 'no escribe')
        + ' · vacía el campo ' + e.vacia.length + ' · candado ' + JSON.stringify(e.candado));
    }
  }
  const mudas = r.pantallas.filter((p) => !p.queja && !p.tieneManejador).length;
  L.push('   → escuchas del chat mudas si el servidor las corta: ' + mudas + ' de ' + r.pantallas.length);
  return L.join('\n');
}

async function datos() {
  const { traer, val } = require('./nube.cjs');
  const viajes = await traer('viajes');
  let conChat = 0;
  let total = 0;
  const formas = {};
  const autores = {};
  let fechaNoIso = 0;
  let autorIdNoEsDelViaje = 0;
  for (const v of viajes) {
    const id = v.name.split('/').pop();
    const f = v.fields || {};
    // eslint-disable-next-line no-await-in-loop
    const ms = await traer('viajes/' + id + '/mensajes');
    if (!ms.length) continue;
    conChat += 1;
    total += ms.length;
    const lados = [f.pasajeroId && val(f.pasajeroId), f.conductorId && val(f.conductorId)];
    for (const m of ms) {
      const c = m.fields || {};
      const forma = Object.keys(c).sort().map((k) => k + ':' + Object.keys(c[k])[0].replace('Value', '')).join(',');
      formas[forma] = (formas[forma] || 0) + 1;
      const a = c.autor ? val(c.autor) : '(sin autor)';
      autores[a] = (autores[a] || 0) + 1;
      const fe = c.fecha ? val(c.fecha) : '';
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(String(fe))) fechaNoIso += 1;
      const aid = c.autorId ? val(c.autorId) : '';
      if (!lados.includes(aid)) autorIdNoEsDelViaje += 1;
    }
  }
  console.log('\n2. PRODUCCIÓN · ' + viajes.length + ' viajes, ' + conChat + ' con chat, ' + total + ' mensajes');
  console.log('   quién escribe: ' + (Object.entries(autores).map(([k, n]) => k + '=' + n).join(', ') || 'nadie'));
  for (const [k, n] of Object.entries(formas)) console.log('   forma ' + n + '× · ' + k);
  console.log('   fecha que no es ISO: ' + fechaNoIso + ' · autorId que no es ni el pasajero ni el conductor del viaje: ' + autorIdNoEsDelViaje);
}

module.exports = { medirCodigo, fuentesDe, elChat, cargarPieza, firestoreDeMentira, fotoDelChat, PIEZA, PANTALLAS, AHORA };

if (require.main === module) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--commit');
  const commit = i >= 0 ? args[i + 1] : null;
  medirCodigo(fuentesDe(commit)).then((r) => {
    console.log(informe(r, commit));
    if (r.quejas.length) process.exitCode = 1;
    if (!args.includes('--sin-red')) {
      return datos().catch((e) => { console.log('\n2. PRODUCCIÓN · no pude leer: ' + e.message); process.exitCode = 1; });
    }
    return null;
  });
}
