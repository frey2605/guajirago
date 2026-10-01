/**
 * P18 · LO QUE UNA PERSONA CON CUENTA PUEDE LEER DE OTRAS (1-oct-2026)
 *
 * Dos colecciones dejaban LEER a cualquiera con sesión datos de otras personas, y ninguna app de usuario las lee:
 *   · `dispositivosBeneficio` — el uid de cada persona y el id de su aparato (la huella del regalo de bienvenida);
 *   · `promociones/{id}/usos/{uid}` — quién usó cada promoción y cuántas veces.
 * Ahora cada quien lee solo la suya, y el panel (admin) todas. Las funciones usan el SDK de administrador.
 *
 * Esta prueba:
 *   1. que el MEDIDOR (scripts/medir-lectura-ajena.cjs) no se ablanda: le da reglas y código de mentira;
 *   2. AMARRA las reglas de hoy: toda colección abierta a cualquiera con sesión la tiene que leer una app de usuario,
 *      y la lista de las abiertas es la que es (una nueva obliga a pensarlo);
 *   3. CAREA en el emulador las reglas de antes (30a1d2e) y las de hoy: cada lectura legítima pasa con las dos, cada
 *      lectura ajena pasaba antes y hoy no.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const M = require('../scripts/medir-lectura-ajena.cjs');

const RAIZ = path.resolve(__dirname, '..');
const ANTES = '30a1d2e';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8' });

describe('P18 · el medidor de lo que se lee ajeno no se ablanda', () => {
  const REGLAS = [
    'rules_version = \'2\';',
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '    function esAdmin() { return request.auth != null; }',
    '    match /abierta/{id} {',
    '      allow read: if request.auth != null;',
    '      match /hija/{h} {',
    '        allow get,',
    '              list: if request.auth   !=   null;',
    '      }',
    '    }',
    '    match /cerrada/{id} {',
    '      // allow read: if request.auth != null;',
    '      /* allow read: if request.auth != null; */',
    '      allow read: if request.auth != null && (request.auth.uid == id || esAdmin());',
    '      allow write: if request.auth != null;',
    '    }',
    '    match /suya/{id} { allow get: if request.auth.uid == id; allow list: if true; }',
    '  }',
    '}',
  ].join('\r\n');
  it('encuentra las abiertas, también anidadas y en varios renglones, y no se cree los comentarios ni los write', () => {
    assert.deepStrictEqual(M.abiertas(REGLAS).map((a) => [a.ruta, a.coleccion, a.ops.join(',')]), [
      ['/abierta/{id}', 'abierta', 'read'],
      ['/abierta/{id}/hija/{h}', 'hija', 'get,list'],
      ['/suya/{id}', 'suya', 'list'],
    ]);
  });
  it('una condición que mira de quién es NO es abierta', () => {
    assert.strictEqual(M.abiertaATodos('request.auth != null && request.auth.uid == id'), false);
    assert.strictEqual(M.abiertaATodos('esAdmin()'), false);
    assert.strictEqual(M.abiertaATodos(' request.auth  != null '), true);
    assert.strictEqual(M.abiertaATodos('true'), true);
  });
  it('nombrar la colección en un comentario no es leerla', () => {
    assert.deepStrictEqual(M.nombraEn("// getDoc(doc(db, 'usos', x))\n * promociones/{id}/usos/{uid}\nconst r = doc(db, 'promociones', p, 'usos', u);", 'usos'), [3]);
    assert.deepStrictEqual(M.nombraEn('const r = collection(db, `promociones/${p}/usos`);', 'usos'), [1]);
    assert.deepStrictEqual(M.nombraEn('const usosTotales = 1; usosPromo[id]', 'usos'), []);
  });
  it('solo la app y aliados cuentan como «la necesita» (el panel es admin y las funciones son servidor)', () => {
    assert.strictEqual(M.laNecesitaUnaApp({ panel: ['x:1'], funciones: ['y:2'] }), false);
    assert.strictEqual(M.laNecesitaUnaApp({ app: ['x:1'] }), true);
    assert.strictEqual(M.laNecesitaUnaApp({ aliados: ['x:1'] }), true);
  });
  it('mira las tres apps y las funciones, en subcarpetas, sin pruebas ni node_modules (árbol de mentira)', () => {
    const os = require('node:os');
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'p18-'));
    const poner = (rel) => { fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true }); fs.writeFileSync(path.join(raiz, rel), "getDoc(doc(db, 'secreta', id));"); };
    for (const rel of ['guajirago/src/a/Uno.js', 'guajirago-aliados/src/Dos.jsx', 'guajirago-admin/src/Tres.js', 'guajirago/functions/x.cjs',
      'guajirago/src/Cuatro.test.js', 'guajirago-aliados/src/node_modules/z/Cinco.js']) poner(rel);
    try {
      const r = M.lectoresEnCodigo('secreta', raiz);
      assert.deepStrictEqual(r, { app: ['guajirago/src/a/Uno.js:1'], aliados: ['guajirago-aliados/src/Dos.jsx:1'], panel: ['guajirago-admin/src/Tres.js:1'], funciones: ['guajirago/functions/x.cjs:1'] });
    } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
  });
  it('en el paquete minificado cuenta la colección entre comillas', () => {
    assert.strictEqual(M.vecesEnPaquete('(0,r.doc)(n,"promociones",e,"usos",t);var usosTotales=1', 'usos'), 1);
  });
  it('los datos de personas: cuenta campos y documentos que se llaman como un uid', () => {
    assert.deepStrictEqual(M.datosDePersonas([{ id: 'ana', veces: 2 }, { id: 'aparato1', uid: 'ana', usado: true }], new Set(['ana'])),
      { docs: 2, campos: { veces: 1, uid: 1 }, idEsUid: 1 });
  });
});

const ABIERTAS_DE_HOY = ['/conductores/{conductorId}', '/calificaciones/{calId}', '/promociones/{promoId}', '/anuncios/{anuncioId}',
  '/config/{documentoConfig}', '/restaurantes/{restauranteId}', '/negocios/{negocioId}', '/usosPromo/{usoId}'];

describe('P18 · las reglas de hoy: lo que cualquiera con sesión lee, lo necesita una app', () => {
  const hoy = M.abiertas(leer('firestore.rules'));
  it('las abiertas a cualquiera con sesión son éstas y ninguna más (una nueva hay que pensarla)', () => {
    assert.deepStrictEqual(hoy.map((a) => a.ruta).sort(), [...ABIERTAS_DE_HOY].sort());
  });
  for (const a of hoy) {
    it(a.ruta + ': la lee una app de usuario (si no, no tiene por qué estar abierta)', () => {
      assert.ok(M.laNecesitaUnaApp(M.lectoresEnCodigo(a.coleccion)), '⛔ ' + a.ruta + ' está abierta a todos y ninguna app de usuario la lee');
    });
  }
  it('dispositivosBeneficio y los usos de las promociones ya no están abiertas; con las reglas de antes sí', () => {
    const antes = M.abiertas(deAntes('firestore.rules')).map((a) => a.ruta);
    for (const r of ['/dispositivosBeneficio/{deviceId}', '/promociones/{promoId}/usos/{usoId}']) {
      assert.ok(antes.includes(r), 'el medidor no ve ' + r + ' abierta en las reglas de antes: se ablandó');
      assert.ok(!hoy.some((a) => a.ruta === r), r + ' sigue abierta a todos');
    }
  });
  it('y ninguna app de usuario las nombra (si una empezara a leerlas, las reglas se lo negarían en silencio)', () => {
    for (const c of ['dispositivosBeneficio', 'usos']) assert.strictEqual(M.laNecesitaUnaApp(M.lectoresEnCodigo(c)), false, c);
  });
  it('el registro de bienvenidas por teléfono (P06) sigue sin regla: nadie lo lee desde un teléfono', () => {
    assert.ok(!M.lecturasDeLasReglas(leer('firestore.rules')).some((l) => /bienvenidaPorTelefono/.test(l.ruta)));
  });
});

// ── EL CAREO DE LAS REGLAS EN EL EMULADOR ──

let RUT;
let FS;
const entornos = {};

before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  const puerto = elEmulador().firestore;
  entornos.antes = await RUT.initializeTestEnvironment({ projectId: 'demo-p18-antes', firestore: { rules: deAntes('firestore.rules'), host: '127.0.0.1', port: puerto } });
  entornos.hoy = await RUT.initializeTestEnvironment({ projectId: 'demo-p18-hoy', firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: puerto } });
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
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'dispositivosBeneficio/aparatoAna'), { usado: true, uid: 'ana', fecha: '2026-09-01T00:00:00.000Z' });
    await setDoc(doc(db, 'dispositivosBeneficio/aparatoBeto'), { usado: true, uid: 'beto', fecha: '2026-09-02T00:00:00.000Z' });
    await setDoc(doc(db, 'promociones/PROMO1'), { nombre: 'Bienvenida', codigo: 'PROMO1', activa: true, tipoBeneficio: 'credito', valorBeneficio: 5000 });
    await setDoc(doc(db, 'promociones/PROMO1/usos/ana'), { veces: 1 });
    await setDoc(doc(db, 'promociones/PROMO1/usos/beto'), { veces: 2 });
    await setDoc(doc(db, 'conductores/c1'), { nombre: 'Carlos', ubicacion: { lat: 11.5, lng: -72.9 } });
    await setDoc(doc(db, 'usosPromo/P__3001112233'), { veces: 1, telefono: '3001112233', promoId: 'P' });
    await setDoc(doc(db, 'calificaciones/cal1'), { calificadoId: 'n1', estrellas: 5 });
    await setDoc(doc(db, 'negocios/n1'), { nombre: 'Asadero', activo: true });
    await setDoc(doc(db, 'config/global'), { tarifaMinima: 5000 });
    await setDoc(doc(db, 'bienvenidaPorTelefono/3001112233'), { uid: 'ana', fecha: 'x' });
  });
}

const D = (db, ruta) => FS.getDoc(FS.doc(db, ruta));
const L = (db, ruta) => FS.getDocs(FS.collection(db, ruta));
/** [quién (null = sin cuenta), qué lee, (db) => promesa, ¿pasaba antes?, ¿pasa hoy?] */
const LECTURAS = [
  // ── legítimas: el panel (admin) y el dueño de su dato
  ['eladmin', 'el panel lee una huella', (db) => D(db, 'dispositivosBeneficio/aparatoBeto'), true, true],
  ['eladmin', 'el panel lista las huellas', (db) => L(db, 'dispositivosBeneficio'), true, true],
  ['eladmin', 'el panel lee el uso de Beto (asignarPromoManual, dentro de su transacción)', (db) => D(db, 'promociones/PROMO1/usos/beto'), true, true],
  ['eladmin', 'el panel lista los usos de una promoción', (db) => L(db, 'promociones/PROMO1/usos'), true, true],
  ['ana', 'Ana lee su propia huella', (db) => D(db, 'dispositivosBeneficio/aparatoAna'), true, true],
  ['ana', 'Ana busca sus huellas (where uid == ana)', (db) => FS.getDocs(FS.query(FS.collection(db, 'dispositivosBeneficio'), FS.where('uid', '==', 'ana'))), true, true],
  ['ana', 'Ana lee su propio uso de la promoción', (db) => D(db, 'promociones/PROMO1/usos/ana'), true, true],
  // ── legítimas que hace la app hoy en las que siguen abiertas: no cambian
  ['ana', 'la app lista las promociones (Promociones.js)', (db) => L(db, 'promociones'), true, true],
  ['ana', 'la app sigue al carro del conductor (Solicitar.js)', (db) => D(db, 'conductores/c1'), true, true],
  ['ana', 'la app mira su contador de una promo de restaurante (Restaurantes.js)', (db) => D(db, 'usosPromo/P__3001112233'), true, true],
  ['ana', 'la app baja las calificaciones (Restaurantes.js)', (db) => L(db, 'calificaciones'), true, true],
  ['ana', 'la app baja los negocios (Restaurantes.js)', (db) => L(db, 'negocios'), true, true],
  ['ana', 'la app lee la configuración (configApp.js)', (db) => D(db, 'config/global'), true, true],
  // ── AJENAS: pasaban antes y hoy no
  ['ana', 'AJENA · Ana lee la huella de Beto', (db) => D(db, 'dispositivosBeneficio/aparatoBeto'), true, false],
  ['ana', 'AJENA · Ana se baja todas las huellas (uid y aparato de todos)', (db) => L(db, 'dispositivosBeneficio'), true, false],
  ['ana', 'AJENA · Ana busca las huellas de Beto (where uid == beto)', (db) => FS.getDocs(FS.query(FS.collection(db, 'dispositivosBeneficio'), FS.where('uid', '==', 'beto'))), true, false],
  ['c1', 'AJENA · un conductor lee la huella de Ana', (db) => D(db, 'dispositivosBeneficio/aparatoAna'), true, false],
  ['ana', 'AJENA · Ana lee cuántas veces usó Beto la promoción', (db) => D(db, 'promociones/PROMO1/usos/beto'), true, false],
  ['ana', 'AJENA · Ana lista quién usó la promoción', (db) => L(db, 'promociones/PROMO1/usos'), true, false],
  ['c1', 'AJENA · un conductor lee el uso de Ana', (db) => D(db, 'promociones/PROMO1/usos/ana'), true, false],
  // ── sin cuenta y el registro de P06: cerrados antes y hoy
  [null, 'sin cuenta lee una huella', (db) => D(db, 'dispositivosBeneficio/aparatoAna'), false, false],
  [null, 'sin cuenta lee un uso', (db) => D(db, 'promociones/PROMO1/usos/ana'), false, false],
  ['ana', 'Ana lee su número en el registro de bienvenidas (P06: solo el servidor)', (db) => D(db, 'bienvenidaPorTelefono/3001112233'), false, false],
  ['eladmin', 'ni el panel lee el registro de bienvenidas', (db) => L(db, 'bienvenidaPorTelefono'), false, false],
];

describe('P18 · CAREO de las reglas: las de antes (30a1d2e) y las de hoy, en el emulador', () => {
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
});
