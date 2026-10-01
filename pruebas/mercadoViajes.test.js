/**
 * P20 · EL MERCADO DE VIAJES YA NO LO LEE CUALQUIERA (1-oct-2026)
 *
 * Un viaje en el mercado (estado `esperando`) lleva el nombre, el correo, las coordenadas, el origen y el destino del
 * pasajero, y en un mandado el nombre y el teléfono de quien recibe. Hasta P20 lo leía cualquiera con sesión. Ahora lo
 * leen los conductores (la ficha `usuarios/{uid}` dice `tipo: 'conductor'`, la misma marca que usa el servidor), de
 * cualquier vehículo y con o sin saldo (P05); el propio pasajero (esMio) y el panel siguen igual.
 *
 * Esta prueba:
 *   1. que el MEDIDOR (scripts/medir-mercado-viajes.cjs) no se ablanda: le da reglas y código de mentira;
 *   2. AMARRA lo de hoy: las reglas dicen «solo conductores», la única pantalla de usuario que pide el mercado es la del
 *      conductor, y la marca de las reglas es la que escriben la app y lee el servidor;
 *   3. CAREA en el emulador las reglas de antes (bec92de) y las de hoy, pidiendo el mercado EXACTAMENTE como la app
 *      (ESTADOS_MERCADO sale de estadosViaje.js).
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { leer, cargarDeLaApp, RAIZ } = require('./cargar.cjs');
const M = require('../scripts/medir-mercado-viajes.cjs');

const ANTES = 'bec92de';
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 });

// ── 1. EL MEDIDOR NO SE ABLANDA ──
describe('P20 · el medidor del mercado no se ablanda', () => {
  const ES_CONDUCTOR = [
    '      function esConductor() {',
    '        let ficha = /databases/$(database)/documents/usuarios/$(request.auth.uid);',
    "        return exists(ficha) && get(ficha).data.get('tipo', '') == 'conductor';",
    '      }',
  ];
  const reglas = (lectura, funcion = ES_CONDUCTOR) => [
    'service cloud.firestore {', '  match /databases/{database}/documents {',
    '    match /viajes/{viajeId} {',
    "      function enElMercado() { return resource.data.get('estado', '') in ['esperando']; }",
    ...funcion,
    '      ' + lectura,
    '    }', '  }', '}',
  ].join('\r\n');
  it('abierto a todos, atado a conductores, o sin mercado', () => {
    assert.strictEqual(M.quienLeeElMercado(reglas('allow read: if request.auth != null && (esMio() || enElMercado() || esAdmin());')), 'cualquiera con sesión');
    assert.strictEqual(M.quienLeeElMercado(reglas('allow read: if request.auth != null && (esMio() || (enElMercado() && esConductor()) || esAdmin());')), 'solo conductores');
    assert.strictEqual(M.quienLeeElMercado(reglas('allow read: if request.auth != null && (esMio() || (esConductor() && enElMercado()));')), 'solo conductores');
    assert.strictEqual(M.quienLeeElMercado(reglas('allow read: if request.auth != null && (esMio() || esAdmin());')), 'nadie');
  });
  it('un mercado atado en un sitio y suelto en otro sigue abierto', () => {
    assert.strictEqual(M.quienLeeElMercado(reglas('allow read: if request.auth != null && ((enElMercado() && esConductor()) || enElMercado());')), 'cualquiera con sesión');
  });
  it('el atado de un comentario no cuenta', () => {
    assert.strictEqual(M.quienLeeElMercado(reglas('allow read: if request.auth != null && (esMio() || enElMercado()); // (enElMercado() && esConductor())')), 'cualquiera con sesión');
  });
  it('un esConductor() que no mira la ficha de quien llama, o que mira otro campo, no vale', () => {
    const otroCampo = ES_CONDUCTOR.map((l) => l.replace("get('tipo', '')", "get('rol', '')"));
    const cualquiera = ['      function esConductor() { return request.auth != null; }'];
    const ajena = ES_CONDUCTOR.map((l) => l.replace('$(request.auth.uid)', '$(resource.data.pasajeroId)'));
    const atado = 'allow read: if request.auth != null && (esMio() || (enElMercado() && esConductor()));';
    for (const f of [otroCampo, cualquiera, ajena, []]) assert.match(M.quienLeeElMercado(reglas(atado, f)), /^otro: /);
  });
  it('encuentra quién pide el mercado y quién pide lo suyo, y no se cree los comentarios', () => {
    const t = [
      "const q = query(collection(db, 'viajes'), where('estado', 'in', ESTADOS_MERCADO));",
      "  // const q2 = query(collection(db, 'viajes'), where('estado', '==', 'esperando'));",
      "const s = query(collection(db, \"viajes\"), where('pasajeroId', '==', user.uid));",
      "const c = query(collection(db, 'viajes'), where('conductorId', '==', miId));",
      "getDoc(doc(db, 'viajes', id));",
    ].join('\r\n');
    assert.deepStrictEqual(M.consultasDeViajes(t), { mercado: [1], suyos: [3, 4] });
  });
  it('en el paquete minificado cuenta las consultas de viajes por estado', () => {
    assert.strictEqual(M.mercadoEnElPaquete('Ja(Qa(e,"viajes"),xx("estado","in",nA)),t=>{}; Qa(e,"viajes"),xx("pasajeroId","==",u)'), 1);
    assert.strictEqual(M.mercadoEnElPaquete('Qa(e,"viajes"),xx("conductorId","==",u)'), 0);
  });
  it('cuenta quién maneja sin la marca de conductor', () => {
    const r = M.conductoresSinMarca({
      usuarios: [{ id: 'a', tipo: 'conductor' }, { id: 'b' }, { id: 'c', placa: 'X' }, { id: 'p', tipo: 'pasajero' }],
      conductores: [{ id: 'a' }, { id: 'b' }],
      viajes: [{ conductorId: 'd' }, { pasajeroId: 'p' }],
    });
    assert.deepStrictEqual([r.manejan, r.conMarca, r.sin.sort()], [4, 1, ['b', 'c', 'd']]);
  });
});

// ── 2. EL AMARRE DE HOY ──
describe('P20 · amarre: el mercado es de los conductores', () => {
  it('las reglas de hoy dicen «solo conductores» y las de antes «cualquiera con sesión»', () => {
    assert.strictEqual(M.quienLeeElMercado(leer('firestore.rules')), 'solo conductores');
    assert.strictEqual(M.quienLeeElMercado(deAntes('firestore.rules')), 'cualquiera con sesión');
  });
  it('la única pantalla de usuario (app y aliados) que pide la lista del mercado es la del conductor', () => {
    const U = require('../scripts/medir-ubicacion-conductor.cjs');
    const quienes = new Set();
    for (const f of U.archivosDeUsuario()) if (M.consultasDeViajes(f.texto()).mercado.length) quienes.add(f.rel);
    assert.deepStrictEqual([...quienes], ['guajirago/src/AppConductor.js']);
  });
  it('la marca de conductor de las reglas es la que escribe la app y lee el servidor', () => {
    assert.match(leer('guajirago/src/App.js'), /setDoc\(doc\(db, 'usuarios', user\.uid\), \{\s*tipo: 'conductor',/);
    const servidor = leer('guajirago/functions/index.js');
    assert.ok(servidor.includes('.data().tipo === "conductor"') && servidor.includes('u.tipo !== "conductor"'), 'el servidor ya no usa tipo === "conductor"');
  });
});

// ── 3. EL CAREO DE LAS REGLAS EN EL EMULADOR ──
let RUT;
let FS;
const entornos = {};
const { ESTADOS_MERCADO } = cargarDeLaApp('guajirago/src/estadosViaje.js');

before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  const puerto = elEmulador().firestore;
  entornos.antes = await RUT.initializeTestEnvironment({ projectId: 'demo-p20-antes', firestore: { rules: deAntes('firestore.rules'), host: '127.0.0.1', port: puerto } });
  entornos.hoy = await RUT.initializeTestEnvironment({ projectId: 'demo-p20-hoy', firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: puerto } });
});
after(async () => { for (const e of Object.values(entornos)) await e.cleanup(); });

async function sembrar(entorno) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { doc, setDoc } = FS;
    await setDoc(doc(db, 'usuarios/ana'), { nombre: 'Ana', tipo: 'pasajero', rol: '' });
    await setDoc(doc(db, 'usuarios/beto'), { nombre: 'Beto', tipo: 'pasajero', rol: '' });
    await setDoc(doc(db, 'usuarios/nueva'), { nombre: 'Nueva', tipo: '', rol: '' });
    await setDoc(doc(db, 'usuarios/taxi'), { nombre: 'Carlos', tipo: 'conductor', tipoVehiculo: 'Taxi', creditos: 10000, rol: '' });
    await setDoc(doc(db, 'usuarios/pobre'), { nombre: 'Luis', tipo: 'conductor', tipoVehiculo: 'Taxi', creditos: 0, rol: '' });
    await setDoc(doc(db, 'usuarios/moto'), { nombre: 'Mario', tipo: 'conductor', tipoVehiculo: 'Mototaxi', creditos: 5000, rol: '' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'negocios/asadero'), { nombre: 'Asadero', activo: true });
    const delPasajero = { pasajeroId: 'ana', pasajeroNombre: 'Ana', pasajeroEmail: 'ana@x.co', pasajeroLat: 11.53, pasajeroLng: -72.9, origen: 'Calle 1', destino: 'Terminal', fechaSolicitud: '2026-10-01T12:00:00.000Z' };
    await setDoc(doc(db, 'viajes/taxiDeAna'), { ...delPasajero, tipo: 'Taxi', estado: 'esperando', tarifa: '$ 8.000', tarifaValor: 8000 });
    await setDoc(doc(db, 'viajes/mandadoDeAna'), { ...delPasajero, tipo: 'Mensajería', estado: 'esperando', mensajeria: { recibeNombre: 'Rosa', recibeTel: '3001112233' } });
    await setDoc(doc(db, 'viajes/aceptadoDeAna'), { ...delPasajero, tipo: 'Taxi', estado: 'aceptado', conductorId: 'taxi' });
    await setDoc(doc(db, 'viajes/aceptadoDeAna/contraofertas/moto'), { monto: 9000, vigente: false });
  });
}

const mercado = (db) => FS.getDocs(FS.query(FS.collection(db, 'viajes'), FS.where('estado', 'in', ESTADOS_MERCADO)));
const D = (db, ruta) => FS.getDoc(FS.doc(db, ruta));
/** [quién (null = sin cuenta), qué lee, (db) => promesa, ¿pasaba antes?, ¿pasa hoy?] */
const LECTURAS = [
  // ── legítimas: no cambian
  ['taxi', 'el taxista pide el mercado como la app (AppConductor.js)', mercado, true, true],
  ['pobre', 'el taxista SIN saldo pide el mercado (P05: ve, no oferta)', mercado, true, true],
  ['moto', 'el mototaxista pide el mercado', mercado, true, true],
  ['taxi', 'el taxista vigila un viaje del mercado (el vigilante de su oferta)', (db) => D(db, 'viajes/taxiDeAna'), true, true],
  ['moto', 'el mototaxista mira un mandado del mercado', (db) => D(db, 'viajes/mandadoDeAna'), true, true],
  ['moto', 'el que ofertó y perdió sigue mirando el viaje (dejoUnaOferta)', (db) => D(db, 'viajes/aceptadoDeAna'), true, true],
  ['ana', 'Ana mira su viaje en espera (Solicitar.js)', (db) => D(db, 'viajes/taxiDeAna'), true, true],
  ['ana', 'Ana pide su historial (where pasajeroId == ana)', (db) => FS.getDocs(FS.query(FS.collection(db, 'viajes'), FS.where('pasajeroId', '==', 'ana'))), true, true],
  ['eladmin', 'el panel pide todos los viajes', (db) => FS.getDocs(FS.collection(db, 'viajes')), true, true],
  ['eladmin', 'el panel pide el mercado', mercado, true, true],
  // ── AJENAS: pasaban antes y hoy no
  ['beto', 'AJENA · otro pasajero pide el mercado (nombre, correo y coordenadas de Ana)', mercado, true, false],
  ['beto', 'AJENA · otro pasajero mira el viaje de Ana', (db) => D(db, 'viajes/taxiDeAna'), true, false],
  ['beto', 'AJENA · otro pasajero mira el mandado de Ana (teléfono de quien recibe)', (db) => D(db, 'viajes/mandadoDeAna'), true, false],
  ['nueva', 'AJENA · una cuenta con ficha sin tipo pide el mercado', mercado, true, false],
  ['asadero', 'AJENA · un negocio de aliados (cuenta sin ficha) pide el mercado', mercado, true, false],
  ['asadero', 'AJENA · un negocio de aliados mira el viaje de Ana', (db) => D(db, 'viajes/taxiDeAna'), true, false],
  // ── cerradas antes y hoy
  [null, 'sin cuenta pide el mercado', mercado, false, false],
  ['beto', 'otro pasajero mira un viaje aceptado ajeno', (db) => D(db, 'viajes/aceptadoDeAna'), false, false],
];

describe('P20 · CAREO de las reglas: las de antes (bec92de) y las de hoy, en el emulador', () => {
  it('el mercado de la app es el que siembra esta prueba', () => assert.deepStrictEqual(ESTADOS_MERCADO, ['esperando']));
  for (const [quien, que, leerla, antes, hoy] of LECTURAS) {
    it((quien || 'sin cuenta') + ' · ' + que + ' → antes ' + (antes ? 'pasa' : 'no') + ', hoy ' + (hoy ? 'pasa' : 'no'), async () => {
      for (const [cual, esperado] of [['antes', antes], ['hoy', hoy]]) {
        const e = entornos[cual];
        await sembrar(e);
        const db = (quien ? e.authenticatedContext(quien) : e.unauthenticatedContext()).firestore();
        const promesa = leerla(db);
        if (esperado) await RUT.assertSucceeds(promesa); else await RUT.assertFails(promesa);
      }
    });
  }
  it('y lo que lee el taxista trae los dos viajes del mercado, no una lista vacía', async () => {
    const e = entornos.hoy;
    await sembrar(e);
    const snap = await mercado(e.authenticatedContext('pobre').firestore());
    assert.deepStrictEqual(snap.docs.map((d) => d.id).sort(), ['mandadoDeAna', 'taxiDeAna']);
  });
});
