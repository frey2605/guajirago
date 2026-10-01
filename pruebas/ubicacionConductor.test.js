/**
 * P19 · LA FICHA DEL CONDUCTOR YA NO LA LEE CUALQUIERA (1-oct-2026)
 *
 * La ficha `conductores/{uid}` lleva el teléfono, la placa, el nombre, el token de avisos y la ubicación en vivo del
 * conductor. Hasta P19 la leía cualquiera con sesión que supiera el uid (8 de 8 fichas en producción), porque el mapa
 * del pasajero seguía al carro leyéndola. Ahora:
 *   · el GPS del conductor, con un viaje vivo, escribe SOLO su posición en `viajes/{id}/enVivo/conductor`;
 *   · el mapa del pasajero lee de ahí (la ruta la arma UNA pieza, guajirago/src/ubicacionEnVivo.js);
 *   · las reglas dejan leer ese sitio solo a los dos del viaje mientras está vivo (y al panel), y la ficha solo a él y
 *     al panel.
 *
 * Esta prueba:
 *   1. que el MEDIDOR (scripts/medir-ubicacion-conductor.cjs) no se ablanda;
 *   2. AMARRA el código de hoy: ninguna pantalla de usuario lee la ficha, los dos lados usan la pieza, y el «vivo» de
 *      las reglas es el de estadosViaje.js;
 *   3. EJECUTA el GPS del conductor y el vigilante del pasajero sacados de sus archivos, y carea el del pasajero con el
 *      de antes (f1f8726);
 *   4. CAREA en el emulador las reglas de antes (f1f8726) y las de hoy.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { leer, cargarDeLaApp, cuerpoDeLaFuncion, soloCodigo, RAIZ } = require('./cargar.cjs');
const M = require('../scripts/medir-ubicacion-conductor.cjs');

const ANTES = 'f1f8726';
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 });

// ── 1. EL MEDIDOR NO SE ABLANDA ──
describe('P19 · el medidor de la ficha del conductor no se ablanda', () => {
  const reglas = (getFicha, enVivo) => [
    'service cloud.firestore {', '  match /databases/{database}/documents {',
    '    match /conductores/{conductorId} {', '      ' + getFicha, '      allow list: if esAdmin();', '    }',
    '    match /viajes/{viajeId} {', '      allow read: if esMio();',
    enVivo ? '      match /enVivo/{cual} { allow get: if request.auth != null && cual == \'conductor\'; }' : '',
    '    }', '  }', '}',
  ].join('\r\n');
  it('ve la ficha abierta, cerrada a él y al panel, y cualquier otra cosa la nombra', () => {
    assert.strictEqual(M.quienLeeLaFicha(reglas('allow get: if request.auth != null;')), 'todos');
    assert.strictEqual(M.quienLeeLaFicha(reglas('allow read: if request.auth != null;')), 'todos');
    assert.strictEqual(M.quienLeeLaFicha(reglas('allow get: if request.auth != null && (\n request.auth.uid == conductorId ||\n esAdmin() );')), 'él y el panel');
    assert.match(M.quienLeeLaFicha(reglas('allow get: if request.auth != null && (request.auth.uid == conductorId || true);')), /^otro: /);
    assert.strictEqual(M.quienLeeLaFicha(reglas('// allow get: if request.auth != null;')), 'nadie');
  });
  it('ve si existe el sitio del carro en vivo', () => {
    assert.strictEqual(M.reglaEnVivo(reglas('allow get: if true;', false)), null);
    assert.match(M.reglaEnVivo(reglas('allow get: if true;', true)), /cual == 'conductor'/);
  });
  it('leer la ficha no es escribirla, y un comentario no cuenta', () => {
    const t = [
      "onSnapshot(doc(db, 'conductores', id), (s) => {});",
      "await setDoc(doc(db, 'conductores', user.uid), { a: 1 }, { merge: true });",
      "// getDoc(doc(db, 'conductores', x))",
      "const s = await getDoc(doc(db, \"conductores\", x));",
      "carro.current = onSnapshot(refUbicacionEnVivo(db, v), () => {});",
      "getDoc(doc(db, 'viajes', v, 'enVivo', 'conductor'));",
    ].join('\n');
    assert.deepStrictEqual(M.leeLaFicha(t), [1, 4]);
    assert.deepStrictEqual(M.leeElCarroEnVivo(t), [5, 6]);
  });
  it('en el paquete minificado cuenta la lectura de la ubicación de la ficha, no las escrituras', () => {
    const p = '(0,a.BH)((0,a.H9)(r.db,"conductores",e),(e=>{e.exists()&&e.data().ubicacion&&n({lat:1})}));'
      + '(0,a.BN)((0,a.H9)(r.db,"conductores",t.uid),{ubicacion:o,activo:!0},{merge:!0});(0,a.H9)(r.db,"viajes",v,"enVivo","conductor")';
    assert.deepStrictEqual(M.enElPaquete(p), { leeLaFicha: 1, enVivo: 1 });
  });
  it('cuenta los datos de personas de cada ficha', () => {
    assert.deepStrictEqual(M.datosDeLasFichas([{ telefono: '300', fcmToken: 't', placa: 'A', nombre: 'L', ubicacion: {} }, { telefono: '', placa: 'B' }]),
      { fichas: 2, telefono: 1, fcmToken: 1, placa: 2, nombre: 1, ubicacion: 1 });
  });
  it('el veredicto se queja de la ficha abierta y de un mapa que lee de donde no le dejan', () => {
    assert.strictEqual(M.veredicto({ quien: 'él y el panel', enVivo: 'x', lectoresFicha: [], lectoresEnVivo: ['a:1'] }).length, 0);
    assert.match(M.veredicto({ quien: 'todos', enVivo: 'x', lectoresFicha: [], lectoresEnVivo: ['a:1'] })[0], /cualquiera con sesión/);
    assert.match(M.veredicto({ quien: 'él y el panel', enVivo: 'x', lectoresFicha: ['a:1'], lectoresEnVivo: [] })[0], /no se movería/);
    assert.match(M.veredicto({ quien: 'él y el panel', enVivo: null, lectoresFicha: [], lectoresEnVivo: ['a:1'] })[0], /no tienen ese sitio/);
    assert.match(M.veredicto({ quien: 'él y el panel', enVivo: 'x', lectoresFicha: [], lectoresEnVivo: [] })[0], /ninguna pantalla/);
  });
  it('con las reglas y el código de antes (f1f8726) ve la ficha abierta y al pasajero leyéndola', () => {
    assert.strictEqual(M.quienLeeLaFicha(deAntes('firestore.rules')), 'todos');
    assert.strictEqual(M.reglaEnVivo(deAntes('firestore.rules')), null);
    const lectores = M.archivosDeUsuario(ANTES).flatMap((f) => M.leeLaFicha(f.texto()).map((n) => f.rel + ':' + n));
    assert.deepStrictEqual(lectores, ['guajirago/src/Solicitar.js:794']);
  });
});

// ── 2. EL AMARRE DEL CÓDIGO DE HOY ──
describe('P19 · las reglas y el código de hoy', () => {
  const reglas = leer('firestore.rules');
  const archivos = M.archivosDeUsuario(null);
  it('ninguna pantalla de usuario (app y aliados) lee la ficha del conductor', () => {
    const lectores = archivos.flatMap((f) => M.leeLaFicha(f.texto()).map((n) => f.rel + ':' + n));
    assert.deepStrictEqual(lectores, []);
  });
  it('el pasajero sigue al carro desde el viaje vivo, y solo Solicitar.js lo lee', () => {
    const lectores = archivos.flatMap((f) => M.leeElCarroEnVivo(f.texto()).map((n) => f.rel));
    assert.deepStrictEqual(lectores, ['guajirago/src/Solicitar.js']);
  });
  // FASE 2: la ficha ya solo la leen él y el panel (la fase 1, 2990357, solo abrió el carro en vivo).
  it('la ficha del conductor la leen él y el panel', () => {
    assert.strictEqual(M.quienLeeLaFicha(reglas), 'él y el panel');
  });
  it('el veredicto del medidor sale limpio', () => {
    const lectoresFicha = archivos.flatMap((f) => M.leeLaFicha(f.texto()));
    const lectoresEnVivo = archivos.flatMap((f) => M.leeElCarroEnVivo(f.texto()));
    assert.deepStrictEqual(M.veredicto({ quien: M.quienLeeLaFicha(reglas), enVivo: M.reglaEnVivo(reglas), lectoresFicha, lectoresEnVivo }), []);
  });
  it('el «vivo» de las reglas del carro es ESTADO_ACEPTADO de estadosViaje.js', () => {
    const { ESTADO_ACEPTADO } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const bloque = reglas.slice(reglas.indexOf('match /enVivo/{cual}'));
    const vivo = /function estaVivo\(\) \{\s*return elViajeVivo\(\)\.get\('estado', ''\) == '([a-z_]+)';/.exec(bloque);
    assert.ok(vivo, 'no encuentro estaVivo() en el bloque del carro en vivo');
    assert.strictEqual(vivo[1], ESTADO_ACEPTADO);
  });
  it('la ruta de la pieza es la de las reglas: viajes/{id}/enVivo/conductor', () => {
    const P = pieza();
    assert.strictEqual(P.refUbicacionEnVivo('DB', 'v1'), 'viajes/v1/enVivo/conductor');
    assert.deepStrictEqual(Object.keys(P.puntoEnVivo(1, 2, 't')), ['lat', 'lng', 'timestamp']);
    assert.ok(/match \/viajes\/\{viajeId\} \{[\s\S]*match \/enVivo\/\{cual\} \{/.test(reglas));
    assert.ok(/keys\(\)\.hasOnly\(\['lat', 'lng', 'timestamp'\]\)/.test(reglas.slice(reglas.indexOf('match /enVivo/{cual}'))));
  });
  it('los dos lados pasan por la pieza, y el pasajero la llama con el id del VIAJE', () => {
    const sol = soloCodigo(leer('guajirago/src/Solicitar.js'));
    const con = soloCodigo(leer('guajirago/src/AppConductor.js'));
    assert.match(sol, /import \{ refUbicacionEnVivo \} from '\.\/ubicacionEnVivo';/);
    assert.match(con, /import \{ refUbicacionEnVivo, puntoEnVivo \} from '\.\/ubicacionEnVivo';/);
    const llamadas = [...sol.matchAll(/escucharConductor\(([^)]*)\)/g)].map((m) => m[1]);
    assert.ok(llamadas.length >= 2, 'no encuentro las llamadas a escucharConductor');
    assert.deepStrictEqual([...new Set(llamadas)], ['viajeId'], 'el vigilante del carro se llama con algo que no es el id del viaje');
    assert.ok(!/'enVivo'/.test(sol) && !/'enVivo'/.test(con), 'la ruta del carro se escribió a mano fuera de la pieza');
  });
});

function pieza(fuente = leer('guajirago/src/ubicacionEnVivo.js')) {
  const sinFirebase = fuente.replace(/^import \{ doc \} from 'firebase\/firestore';\r?$/m, "const doc = (db, ...p) => p.join('/');");
  assert.notStrictEqual(sinFirebase, fuente, 'la pieza ya no importa doc de firebase/firestore como esta prueba espera');
  return cargarDeLaApp('guajirago/src/ubicacionEnVivo.js', sinFirebase);
}

// ── 3. EJECUTAR LOS DOS LADOS ──
/** El GPS del conductor (`guardarUbicacion`), sacado de AppConductor.js y corrido con una base de mentira. */
function elGpsDelConductor(fase, viajeActual, fuente = leer('guajirago/src/AppConductor.js')) {
  // A qué viaje le cuenta el GPS dónde va: el cálculo se saca del archivo y se corre con esta fase y este viaje.
  const calc = /const viajeVivoId = ([^;\n]+);/.exec(fuente);
  assert.ok(calc, 'no encuentro el cálculo de viajeVivoId en AppConductor.js');
  // eslint-disable-next-line no-new-func
  const viajeVivoId = new Function('fase', 'viajeActual', 'return ' + calc[1] + ';')(fase, viajeActual);
  const efecto = fuente.slice(fuente.indexOf('const guardarUbicacion = async (pos) =>'));
  const deps = /\}, \[([^\]]*)\]\);/.exec(efecto);
  assert.ok(deps && deps[1].split(',').map((s) => s.trim()).includes('viajeVivoId'),
    'el efecto del GPS no se vuelve a armar cuando cambia el viaje vivo: escribiría en el viaje de antes');
  const i = fuente.indexOf('const guardarUbicacion = async (pos) =>');
  assert.ok(i > 0, 'no encuentro guardarUbicacion en AppConductor.js');
  const cuerpo = '{' + cuerpoDeLaFuncion(fuente, i).texto + '}';
  const escrituras = [];
  const P = pieza();
  const setDoc = async (ref, datos, opciones) => { escrituras.push([ref, datos, opciones || null]); };
  const doc = (db, ...p) => p.join('/');
  // eslint-disable-next-line no-new-func
  const fabrica = new Function('setDoc', 'doc', 'db', 'user', 'nombre', 'telefono', 'placa', 'vehiculo', 'viajeVivoId',
    'refUbicacionEnVivo', 'puntoEnVivo', 'setUbicacion', 'ubicacionRef', 'registrarTokenFCM',
    'let tokenListo = true, pidiendoToken = false; return async (pos) => ' + cuerpo + ';');
  const guardar = fabrica(setDoc, doc, 'DB', { uid: 'c1' }, 'Luis', '3160000000', 'ABC123', 'Taxi', viajeVivoId,
    P.refUbicacionEnVivo, P.puntoEnVivo, () => {}, { current: null }, async () => true);
  return { guardar, escrituras };
}

/** El vigilante del carro del pasajero (`escucharConductor`), sacado de Solicitar.js y corrido con una base de mentira. */
function elVigilanteDelPasajero(fuente) {
  const i = fuente.indexOf('const escucharConductor = useCallback(');
  assert.ok(i > 0, 'no encuentro escucharConductor en Solicitar.js');
  const flecha = fuente.indexOf('=>', i);
  const params = fuente.slice(fuente.indexOf('((', i) + 2, flecha).replace(/\)\s*$/, '').trim();
  const cuerpo = '{' + cuerpoDeLaFuncion(fuente, i).texto + '}';
  const escuchas = [];
  const vistos = [];
  const onSnapshot = (ref, cada, fallo) => {
    const e = { ref, cada, fallo, suelta: false };
    escuchas.push(e);
    return () => { e.suelta = true; };
  };
  const doc = (db, ...p) => p.join('/');
  // eslint-disable-next-line no-new-func
  const fabrica = new Function('onSnapshot', 'doc', 'db', 'refUbicacionEnVivo', 'setUbicacionConductor', 'carroEnVivoRef',
    'return (' + params + ') => ' + cuerpo + ';');
  const escuchar = fabrica(onSnapshot, doc, 'DB', pieza().refUbicacionEnVivo, (p) => vistos.push(p), { current: null });
  return { escuchar, escuchas, vistos };
}
const foto = (datos) => ({ exists: () => !!datos, data: () => datos });

describe('P19 · el GPS del conductor y el mapa del pasajero, EJECUTADOS', () => {
  const pos = { coords: { latitude: 11.54, longitude: -72.9 } };
  it('con un viaje vivo, el GPS escribe su ficha (con merge) Y solo la posición en el viaje', async () => {
    const g = elGpsDelConductor('recogiendo', { id: 'v1' });
    await g.guardar(pos);
    assert.strictEqual(g.escrituras.length, 2);
    const [ficha, enVivo] = g.escrituras;
    assert.strictEqual(ficha[0], 'conductores/c1');
    assert.deepStrictEqual(ficha[2], { merge: true });
    assert.strictEqual(enVivo[0], 'viajes/v1/enVivo/conductor');
    assert.deepStrictEqual(Object.keys(enVivo[1]), ['lat', 'lng', 'timestamp']);
    assert.strictEqual(enVivo[1].lat, 11.54);
    assert.strictEqual(enVivo[1].lng, -72.9);
    assert.strictEqual(enVivo[2], null, 'el carro en vivo se reemplaza entero: solo lleva la posición');
  });
  it('sin viaje vivo, el GPS escribe solo su ficha, como antes', async () => {
    for (const [fase, viaje] of [[null, null], [null, { id: 'v1' }], ['recogiendo', null]]) {
      const g = elGpsDelConductor(fase, viaje);
      await g.guardar(pos);
      assert.deepStrictEqual(g.escrituras.map((e) => e[0]), ['conductores/c1'], 'fase ' + fase + ' · viaje ' + JSON.stringify(viaje));
    }
  });
  it('en cada fase del viaje (recogiendo, en el punto, en viaje) escribe en ESE viaje', async () => {
    for (const fase of ['recogiendo', 'en_punto', 'en_viaje']) {
      const g = elGpsDelConductor(fase, { id: 'v9' });
      await g.guardar(pos);
      assert.strictEqual(g.escrituras[1][0], 'viajes/v9/enVivo/conductor', fase);
    }
  });
  it('el pasajero escucha el viaje vivo y mueve el carro; HOY vs ANTES (f1f8726)', () => {
    const hoy = elVigilanteDelPasajero(leer('guajirago/src/Solicitar.js'));
    hoy.escuchar('v1');
    assert.deepStrictEqual(hoy.escuchas.map((e) => e.ref), ['viajes/v1/enVivo/conductor']);
    hoy.escuchas[0].cada(foto({ lat: 11.5, lng: -72.9, timestamp: 't' }));
    hoy.escuchas[0].cada(foto({ lat: 11.6, lng: -72.8, timestamp: 't2' }));
    assert.deepStrictEqual(hoy.vistos, [{ lat: 11.5, lng: -72.9 }, { lat: 11.6, lng: -72.8 }]);
    const antes = elVigilanteDelPasajero(deAntes('guajirago/src/Solicitar.js'));
    antes.escuchar('c1');
    assert.deepStrictEqual(antes.escuchas.map((e) => e.ref), ['conductores/c1'], 'el de antes leía la FICHA del conductor');
  });
  it('un vigilante a la vez: escuchar otro viaje suelta el anterior', () => {
    const v = elVigilanteDelPasajero(leer('guajirago/src/Solicitar.js'));
    v.escuchar('v1');
    v.escuchar('v2');
    assert.deepStrictEqual(v.escuchas.map((e) => [e.ref, e.suelta]), [['viajes/v1/enVivo/conductor', true], ['viajes/v2/enVivo/conductor', false]]);
  });
  it('sin documento, o con algo que no es una posición, el carro no se mueve; y el «permiso denegado» no revienta', () => {
    const v = elVigilanteDelPasajero(leer('guajirago/src/Solicitar.js'));
    v.escuchar('v1');
    v.escuchas[0].cada(foto(null));
    v.escuchas[0].cada(foto({ lat: '11', lng: -72 }));
    assert.deepStrictEqual(v.vistos, []);
    assert.strictEqual(typeof v.escuchas[0].fallo, 'function', 'sin manejo de error, el corte de las reglas al acabar el viaje sale como error suelto');
    v.escuchas[0].fallo(new Error('permission-denied'));
    v.escuchar('v2');
    assert.strictEqual(v.escuchas.length, 2);
  });
  it('sin id de viaje no escucha nada', () => {
    const v = elVigilanteDelPasajero(leer('guajirago/src/Solicitar.js'));
    v.escuchar(undefined);
    assert.strictEqual(v.escuchas.length, 0);
  });
});

// ── 4. EL CAREO DE LAS REGLAS EN EL EMULADOR ──
let RUT;
let FS;
const entornos = {};

before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  const puerto = elEmulador().firestore;
  entornos.antes = await RUT.initializeTestEnvironment({ projectId: 'demo-p19-antes', firestore: { rules: deAntes('firestore.rules'), host: '127.0.0.1', port: puerto } });
  entornos.hoy = await RUT.initializeTestEnvironment({ projectId: 'demo-p19-hoy', firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: puerto } });
});
after(async () => { for (const e of Object.values(entornos)) await e.cleanup(); });

async function sembrar(entorno) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { doc, setDoc } = FS;
    await setDoc(doc(db, 'usuarios/ana'), { nombre: 'Ana', rol: '' });
    await setDoc(doc(db, 'usuarios/beto'), { nombre: 'Beto', rol: '' });
    await setDoc(doc(db, 'usuarios/c1'), { nombre: 'Carlos', tipo: 'conductor', rol: '' });
    await setDoc(doc(db, 'usuarios/c2'), { nombre: 'Otro', tipo: 'conductor', rol: '' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'conductores/c1'), { nombre: 'Carlos', telefono: '3160000000', placa: 'ABC123', fcmToken: 'tok-de-carlos', activo: true, ubicacion: { lat: 11.54, lng: -72.9 } });
    // Ana va AHORA con Carlos; Beto viajó con Carlos la semana pasada.
    await setDoc(doc(db, 'viajes/vivo'), { pasajeroId: 'ana', conductorId: 'c1', estado: 'aceptado' });
    await setDoc(doc(db, 'viajes/vivo/enVivo/conductor'), { lat: 11.54, lng: -72.9, timestamp: '2026-10-01T12:00:00.000Z' });
    await setDoc(doc(db, 'viajes/viejo'), { pasajeroId: 'beto', conductorId: 'c1', estado: 'finalizado' });
    await setDoc(doc(db, 'viajes/viejo/enVivo/conductor'), { lat: 11.5, lng: -72.8, timestamp: '2026-09-24T12:00:00.000Z' });
  });
}

const D = (db, ruta) => FS.getDoc(FS.doc(db, ruta));
const ES = (db, ruta, datos) => FS.setDoc(FS.doc(db, ruta), datos);
const PUNTO = { lat: 11.55, lng: -72.91, timestamp: '2026-10-01T12:00:05.000Z' };
/** [quién (null = sin cuenta), qué, (db) => promesa, ¿pasaba antes?, ¿pasa hoy?] */
const CASOS = [
  // ── legítimas que ya pasaban y siguen igual
  ['c1', 'Carlos lee su propia ficha', (db) => D(db, 'conductores/c1'), true, true],
  ['c1', 'Carlos escribe su ficha (el GPS, con merge)', (db) => FS.setDoc(FS.doc(db, 'conductores/c1'), { ubicacion: { lat: 1, lng: 2 } }, { merge: true }), true, true],
  ['eladmin', 'el panel lee la ficha de Carlos', (db) => D(db, 'conductores/c1'), true, true],
  ['eladmin', 'el panel lista las fichas', (db) => FS.getDocs(FS.collection(db, 'conductores')), true, true],
  // ── el camino NUEVO del carro en vivo: no existía antes, hoy pasa
  ['ana', 'Ana (viaje vivo con Carlos) ve dónde va el carro', (db) => D(db, 'viajes/vivo/enVivo/conductor'), false, true],
  ['c1', 'Carlos lee su posición en su viaje vivo', (db) => D(db, 'viajes/vivo/enVivo/conductor'), false, true],
  ['c1', 'Carlos escribe su posición en su viaje vivo', (db) => ES(db, 'viajes/vivo/enVivo/conductor', PUNTO), false, true],
  ['eladmin', 'el panel lee la última posición de un viaje terminado', (db) => D(db, 'viajes/viejo/enVivo/conductor'), false, true],
  // ── AJENAS: la ficha con teléfono y token
  ['ana', 'AJENA · Ana lee la ficha de Carlos (teléfono, token)', (db) => D(db, 'conductores/c1'), true, false],
  ['beto', 'AJENA · Beto (viajó con Carlos, ya terminó) lee su ficha y ve dónde está', (db) => D(db, 'conductores/c1'), true, false],
  ['c2', 'AJENA · otro conductor lee la ficha de Carlos', (db) => D(db, 'conductores/c1'), true, false],
  // ── cerradas antes y hoy
  ['beto', 'Beto lee el carro de su viaje ya terminado', (db) => D(db, 'viajes/viejo/enVivo/conductor'), false, false],
  ['beto', 'Beto lee el carro del viaje de Ana', (db) => D(db, 'viajes/vivo/enVivo/conductor'), false, false],
  ['c2', 'otro conductor escribe la posición en el viaje de Carlos', (db) => ES(db, 'viajes/vivo/enVivo/conductor', PUNTO), false, false],
  ['ana', 'la pasajera escribe la posición del carro', (db) => ES(db, 'viajes/vivo/enVivo/conductor', PUNTO), false, false],
  ['c1', 'Carlos escribe posición en un viaje ya terminado', (db) => ES(db, 'viajes/viejo/enVivo/conductor', PUNTO), false, false],
  ['c1', 'Carlos mete su token junto a la posición', (db) => ES(db, 'viajes/vivo/enVivo/conductor', { ...PUNTO, fcmToken: 'tok' }), false, false],
  ['c1', 'Carlos escribe una posición que no es número', (db) => ES(db, 'viajes/vivo/enVivo/conductor', { ...PUNTO, lat: '11.5' }), false, false],
  ['c1', 'Carlos escribe otro documento del cajón', (db) => ES(db, 'viajes/vivo/enVivo/otro', PUNTO), false, false],
  ['ana', 'Ana lista el cajón del carro', (db) => FS.getDocs(FS.collection(db, 'viajes/vivo/enVivo')), false, false],
  ['c1', 'Carlos borra su posición', (db) => FS.deleteDoc(FS.doc(db, 'viajes/vivo/enVivo/conductor')), false, false],
  [null, 'sin cuenta lee la ficha', (db) => D(db, 'conductores/c1'), false, false],
  [null, 'sin cuenta lee el carro', (db) => D(db, 'viajes/vivo/enVivo/conductor'), false, false],
  ['ana', 'nadie lista las fichas sin ser el panel', (db) => FS.getDocs(FS.collection(db, 'conductores')), false, false],
];

describe('P19 · CAREO de las reglas: las de antes (f1f8726) y las de hoy, en el emulador', () => {
  for (const [quien, que, hacer, antes, hoy] of CASOS) {
    it((quien || 'sin cuenta') + ' · ' + que + ' → antes ' + (antes ? 'pasa' : 'no') + ', hoy ' + (hoy ? 'pasa' : 'no'), async () => {
      for (const [cual, esperado] of [['antes', antes], ['hoy', hoy]]) {
        const e = entornos[cual];
        await sembrar(e);
        const db = (quien ? e.authenticatedContext(quien) : e.unauthenticatedContext()).firestore();
        const promesa = hacer(db);
        if (esperado) await RUT.assertSucceeds(promesa); else await RUT.assertFails(promesa);
      }
    });
  }
  it('cuando el viaje de Ana se acaba, deja de ver el carro (hoy)', async () => {
    const e = entornos.hoy;
    await sembrar(e);
    await RUT.assertSucceeds(D(e.authenticatedContext('ana').firestore(), 'viajes/vivo/enVivo/conductor'));
    await e.withSecurityRulesDisabled(async (ctx) => { await FS.updateDoc(FS.doc(ctx.firestore(), 'viajes/vivo'), { estado: 'finalizado' }); });
    await RUT.assertFails(D(e.authenticatedContext('ana').firestore(), 'viajes/vivo/enVivo/conductor'));
    await RUT.assertFails(ES(e.authenticatedContext('c1').firestore(), 'viajes/vivo/enVivo/conductor', PUNTO));
  });
});
