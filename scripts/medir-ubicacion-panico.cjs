#!/usr/bin/env node
/**
 * MEDIR QUÉ UBICACIÓN LE LLEGA AL FAMILIAR — los DOS botones de emergencia
 * (gemelo G05, 27-sep-2026). Solo lee código y lo EJECUTA; no toca datos.
 *
 *   node scripts/medir-ubicacion-panico.cjs                 <- el código de hoy (el disco)
 *   node scripts/medir-ubicacion-panico.cjs --commit <hash> <- el de otro commit (el careo antes/después)
 *
 * ── QUÉ HACE ────────────────────────────────────────────────────────────────
 * Saca del archivo el cuerpo de cada botón —`compartirSeguridad` (el 🚨 del mapa,
 * `Solicitar.js`) y `compartirUbicacion` (Ajustes → Seguridad, `Seguridad.js`)— y
 * lo CORRE con un teléfono de mentira, en el caso que describe la auditoría: la
 * pantalla se abrió en un sitio (RECOGIDA, o AL_ABRIR en Ajustes) y el botón se
 * aprieta más tarde, cuando el pasajero ya está en otro (AHORA). Se captura el
 * enlace de WhatsApp que se abre, se lee el mensaje y se dice qué punto lleva y
 * cómo lo llama.
 *
 * No depende de datos guardados: la ubicación del pánico no se guarda en la base.
 * Por eso aquí no hay Firestore que leer; lo que se mide es lo que hace el código.
 *
 * ── LOS CASOS ───────────────────────────────────────────────────────────────
 *   · el GPS contesta al momento        → tiene que ir AHORA, como «Mi ubicación».
 *   · el GPS no contesta nunca          → el mensaje NO puede esperar para siempre:
 *                                          tiene que salir antes de 4,5 s, con la
 *                                          última conocida DICHA como tal.
 *   · el GPS dice que no (sin permiso)  → igual, pero sin esperar.
 * Y el del mapa, en las dos fases: `fase1` (el conductor viene a recogerlo: el
 * carro NO está donde el pasajero) y `fase2` (va dentro del carro).
 *
 * ── LA MENTIRA QUE SE CUENTA ────────────────────────────────────────────────
 * «Mi ubicación» con un punto que NO es el de ahora. Es la cifra del paso 1 y del
 * paso 12: antes del arreglo, todos los casos; después, cero.
 *
 * ── DOS COSAS QUE ESTE MEDIDOR NO HACE, dichas ──────────────────────────────
 *   · Con `--commit`, solo las PANTALLAS salen de ese commit; `mensajeEmergencia.js`
 *     y `ubicacionDeAhora.js` salen del disco. Las pantallas viejas no llaman a
 *     `ubicacionDeAhora`, y el mensaje de hoy, sin `ubicacionDe`, escribe lo mismo
 *     que el de antes. Así no hace falta una segunda copia de `cargarDeLaApp`.
 *   · No corre React ni un navegador: si WhatsApp se abre o no en un teléfono de
 *     verdad no se mide aquí. Eso lo mira el robot (`robot/ubicacion-emergencia.cjs`),
 *     en el navegador y contra pruebas.
 */
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { leer, cargarDeLaApp, soloCodigo, cuerpoDeLaFuncion, RAIZ } = require('../pruebas/cargar.cjs');

const RECOGIDA = { lat: 11.5444, lng: -72.9072 };   // donde se abrió la pantalla del viaje
const AL_ABRIR = { lat: 11.5400, lng: -72.9100 };   // donde se abrió Ajustes → Seguridad
const AHORA = { lat: 11.5010, lng: -72.8700 };      // donde está el pasajero al apretar
const CARRO = { lat: 11.5012, lng: -72.8702 };      // donde dice el conductor que va el carro
const PUNTOS = { RECOGIDA, AL_ABRIR, AHORA, CARRO };
const VIAJE = { origen: 'Cl. 16 #5-20', destino: 'Terminal', conductorId: 'c1', conductorNombre: 'Pedro', conductorPlaca: 'ABC123' };
// El tope sale de la función, no se copia aquí (SEGUNDA LEY); medio segundo de margen para el resto del botón. Que
// el tope mismo no pase de lo que un navegador deja para abrir WhatsApp lo exige pruebas/ubicacionDeAhora.test.js.
const TOPE_ACEPTABLE_MS = cargarDeLaApp('guajirago/src/ubicacionDeAhora.js').TOPE_UBICACION_MS + 500;

const BOTONES = [
  { nombre: 'el 🚨 del mapa', archivo: 'guajirago/src/Solicitar.js', funcion: 'const compartirSeguridad' },
  { nombre: 'Ajustes → Seguridad', archivo: 'guajirago/src/Seguridad.js', funcion: 'const compartirUbicacion' },
];

function fuente(archivo, commit) {
  if (!commit) return leer(archivo);
  return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + archivo], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Un teléfono de mentira. `como`: 'contesta' | 'mudo' | 'niega'. */
function gpsFalso(como) {
  return {
    geolocation: {
      getCurrentPosition: (bien, mal) => {
        if (como === 'contesta') setTimeout(() => bien({ coords: { latitude: AHORA.lat, longitude: AHORA.lng }, timestamp: Date.now() }), 30);
        else if (como === 'niega') setTimeout(() => mal && mal({ code: 1, message: 'permiso negado' }), 5);
        // 'mudo': no llama a nadie, nunca.
      },
    },
  };
}

/** Qué punto lleva el mensaje y cómo lo llama. */
function leerMensaje(url) {
  if (!url) return { punto: 'NO SE ABRIÓ WHATSAPP', etiqueta: '' };
  const texto = decodeURIComponent((/[?&]text=([^&]*)/.exec(url) || [])[1] || '');
  const m = /📍([^\n]*?)https:\/\/maps\.google\.com\/\?q=(-?[\d.]+),(-?[\d.]+)/.exec(texto);
  if (!m) return { punto: /No pude obtener/.test(texto) ? 'ninguno (lo dice)' : 'ninguno (NO lo dice)', etiqueta: '', texto };
  const lat = Number(m[2]);
  const lng = Number(m[3]);
  const cual = Object.keys(PUNTOS).find((k) => PUNTOS[k].lat === lat && PUNTOS[k].lng === lng) || (lat + ',' + lng);
  return { punto: cual, etiqueta: m[1].replace(/\*/g, '').trim(), texto };
}

/**
 * Corre UN botón en UN caso. Devuelve { punto, etiqueta, ms, aCiegas }.
 * `aCiegas` son los nombres que el código usó y este medidor no conocía: se
 * rellenan con una función vacía y se DICEN, porque rellenar a ciegas puede
 * cambiar lo que pasa sin que nadie se entere.
 */
async function correrUno(boton, como, fase, commit, bloquea = false) {
  const codigo = soloCodigo(fuente(boton.archivo, commit));
  const desde = codigo.indexOf(boton.funcion);
  if (desde < 0) return { falla: 'no encuentro «' + boton.funcion + '» en ' + boton.archivo };
  const cuerpo = cuerpoDeLaFuncion(codigo, desde);
  if (!cuerpo) return { falla: 'no pude leer el cuerpo de «' + boton.funcion + '»' };

  const { armarMensajeDeEmergencia } = cargarDeLaApp('guajirago/src/mensajeEmergencia.js');
  let deAhora = null;
  try { deAhora = cargarDeLaApp('guajirago/src/ubicacionDeAhora.js').ubicacionDeAhora; } catch (e) { deAhora = null; }
  // El número del contacto (G10, 28-sep-2026): la regla de verdad, no una de mentira.
  let diezCifras;
  try { diezCifras = cargarDeLaApp('guajirago/src/telefonoValido.js').celularDiezCifras; } catch (e) { diezCifras = undefined; }
  const nav = gpsFalso(como);

  let abierto = null;
  const avisos = [];
  const ctx = {
    armarMensajeDeEmergencia,
    celularDiezCifras: diezCifras,
    ubicacionDeAhora: deAhora ? (resp, tope) => deAhora(resp, tope, nav) : undefined,
    navigator: nav,
    // `bloquea`: el navegador no deja abrir la ventana (devuelve null), como pasa si tarda mucho desde el toque.
    window: { open: (url) => { abierto = url; return bloquea ? null : {}; }, location: {} },
    // el botón del mapa
    ubicacionEsDelGps: true, ubicacionPasajero: RECOGIDA, ubicacionConductor: CARRO, pantalla: fase,
    viaje: VIAJE, contactoEmergencia: '3001234567', setAviso: (a) => { avisos.push(a && a.texto); },
    // el de Ajustes
    ubicacion: AL_ABRIR, contactoNumero: '3001234567', setError: (e) => { if (e) avisos.push(e); },
    auth: { currentUser: { uid: 'u1' } }, db: {},
    query: () => ({}), collection: () => ({}), where: () => ({}),
    getDocs: async () => ({ docs: [] }), elViajeEnCurso: () => VIAJE,
  };
  const aCiegas = [];
  for (let vuelta = 0; vuelta <= 12; vuelta += 1) {
    const nombres = [...Object.keys(ctx), ...aCiegas];
    const valores = [...Object.values(ctx), ...aCiegas.map(() => () => {})];
    abierto = null;
    const t0 = Date.now();
    try {
      // eslint-disable-next-line no-new-func
      await new Function(...nombres, 'return (async () => {' + cuerpo.texto + '\n})();')(...valores);
      return { ...leerMensaje(abierto), ms: Date.now() - t0, aCiegas, avisos };
    } catch (e) {
      const falta = /^(\w+) is not defined$/.exec(e.message || '');
      if (!falta || aCiegas.includes(falta[1])) return { falla: 'el botón reventó al correrlo: ' + e.message };
      aCiegas.push(falta[1]);
    }
  }
  return { falla: 'el botón usa más de 12 nombres que no conozco; no lo corro a ciegas' };
}

/** Lo que TIENE que salir en cada caso (el veredicto de después del arreglo). */
function loQueDebe(boton, como, fase) {
  if (como === 'contesta') return { punto: 'AHORA', etiqueta: 'Mi ubicación:' };
  if (boton.archivo.endsWith('Solicitar.js')) return fase === 'fase2' ? { punto: 'CARRO' } : { punto: 'RECOGIDA' };
  return { punto: 'ninguno (lo dice)' };
}

const CASOS = [];
for (const b of BOTONES) {
  for (const como of ['contesta', 'mudo', 'niega']) {
    for (const fase of (b.archivo.endsWith('Solicitar.js') ? ['fase1', 'fase2'] : ['-'])) CASOS.push({ boton: b, como, fase });
  }
}

/** Corre todos los casos (en paralelo: los mudos esperan el tope de verdad). */
async function medir(commit) {
  const salidas = await Promise.all(CASOS.map(async (c) => ({ ...c, r: await correrUno(c.boton, c.como, c.fase, commit) })));
  const fallos = [];
  let mentiras = 0;
  let tardios = 0;
  for (const s of salidas) {
    const { r } = s;
    if (r.falla) { fallos.push(s.boton.nombre + ' · ' + s.como + ': ' + r.falla); continue; }
    const esMiUbicacion = /^Mi ubicación/.test(r.etiqueta);
    s.mentira = esMiUbicacion && r.punto !== 'AHORA';
    if (s.mentira) mentiras += 1;
    s.tarde = r.ms > TOPE_ACEPTABLE_MS;
    if (s.tarde) tardios += 1;
    const debe = loQueDebe(s.boton, s.como, s.fase);
    s.bien = r.punto === debe.punto && !s.mentira && !s.tarde && (!debe.etiqueta || r.etiqueta === debe.etiqueta);
  }
  return { salidas, fallos, mentiras, tardios, bien: salidas.filter((s) => s.bien).length, total: salidas.length };
}

/**
 * Y SI EL NAVEGADOR NO DEJA ABRIR WHATSAPP, ¿SE DICE? Ahora hay una espera antes de abrir (el GPS, hasta 4 s), y un
 * navegador puede bloquear la ventana. Cada botón se corre con `window.open` devolviendo null, y se mira si le dijo
 * algo a la persona que hable de WhatsApp. Devuelve { <botón>: true | false | 'no se pudo correr: …' }.
 */
async function seAvisaSiBloquean(commit) {
  const fuera = {};
  for (const b of BOTONES) {
    const r = await correrUno(b, 'contesta', 'fase2', commit, true);
    fuera[b.nombre] = r.falla ? 'no se pudo correr: ' + r.falla : r.avisos.some((a) => /WhatsApp/.test(String(a)));
  }
  return fuera;
}

module.exports = { medir, seAvisaSiBloquean, CASOS, PUNTOS, TOPE_ACEPTABLE_MS, correrUno, BOTONES };

if (require.main === module) {
  const i = process.argv.indexOf('--commit');
  const commit = i > 0 ? process.argv[i + 1] : null;
  (async () => {
    const v = await medir(commit);
    console.log('');
    console.log('  QUÉ UBICACIÓN LE LLEGA AL FAMILIAR · ' + (commit ? 'commit ' + commit : 'el código de hoy'));
    console.log('  (la pantalla se abrió en RECOGIDA/AL_ABRIR; el pasajero está en AHORA; el carro en CARRO)');
    console.log('');
    for (const s of v.salidas) {
      const r = s.r;
      const quien = (s.boton.nombre + (s.fase !== '-' ? ' ' + s.fase : '')).padEnd(24);
      const como = ('GPS ' + s.como).padEnd(13);
      if (r.falla) { console.log('  ✗ ' + quien + como + r.falla); continue; }
      const marca = s.bien ? '✓' : '✗';
      console.log('  ' + marca + ' ' + quien + como + ('→ ' + r.punto).padEnd(22) + ('«' + r.etiqueta + '»').padEnd(46)
        + (r.ms + ' ms').padStart(8) + (s.mentira ? '   ← dice «Mi ubicación» y NO es la de ahora' : '')
        + (r.aCiegas && r.aCiegas.length ? '   (rellené a ciegas: ' + r.aCiegas.join(', ') + ')' : ''));
    }
    console.log('');
    console.log('  «Mi ubicación» con un sitio que NO es el de ahora: ' + v.mentiras + ' de ' + v.total);
    console.log('  mensajes que tardaron más de ' + TOPE_ACEPTABLE_MS + ' ms: ' + v.tardios);
    console.log('  casos como tienen que ser: ' + v.bien + ' de ' + v.total);
    if (v.fallos.length) console.log('  no se pudieron correr: ' + v.fallos.length);
    const b = await seAvisaSiBloquean(commit);
    console.log('  si el navegador bloquea WhatsApp, ¿se dice?  ' + Object.entries(b).map(([k, x]) => k + ': ' + (x === true ? 'sí' : x === false ? 'NO' : x)).join(' · '));
    console.log('');
  })();
}
