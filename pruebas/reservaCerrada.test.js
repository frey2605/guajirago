/**
 * P16 · LA RESERVA DE TURISMO QUE MANDA EL CLIENTE (1-oct-2026)
 *
 * Dos pendientes, un solo arreglo (hijos de P13 y P15):
 *   · la app (enviarReserva, guajirago/src/Turismo.js) mandaba `nombreTour` y `tourId` tal cual venían del tour; si al
 *     tour le faltaba uno, iba un `undefined` y Firestore rechazaba la reserva en el teléfono, siempre. Ahora el nombre
 *     sale de la pieza de P15 (nombreOPorDefecto: «Tour» o «Alquiler») y un tour sin id va sin `tourId`.
 *   · las reglas de `reservasTurismo` no tenían lista cerrada: el cliente creaba su reserva con cualquier campo, de
 *     casi 1 MiB y en cualquier estado, y después le cambiaba cualquier cosa (hasta confirmarla él mismo). Ahora nace
 *     con los 16 campos de la app y con topes, y después el cliente solo pega su token de avisos.
 *
 * Esta prueba:
 *   1. ATA la lista de las reglas a lo que escribe la app (y que el lector no se ablanda).
 *   2. EJECUTA enviarReserva (scripts/medir-reserva-cerrada.cjs, con la librería de verdad de Firestore): con la de
 *      hoy ningún dato faltante tranca la reserva; con la de antes (9f0be79) 3 de 6 la trancaban; los honrados, IGUALES.
 *   3. CAREA LAS REGLAS en el emulador, las de antes y las de hoy, cada una en su propio proyecto: lo que manda la app
 *      de hoy en cada caso y cada escritura legítima (cliente, agencia, panel) pasa con las dos; cada veneno pasaba
 *      antes y hoy no.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const M = require('../scripts/medir-reserva-cerrada.cjs');

const RAIZ = path.resolve(__dirname, '..');
const ANTES = '9f0be79';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8' });

describe('P16 · la lista de las reglas es la de la app', () => {
  it('las reglas dejan EXACTAMENTE lo que la app escribe en una reserva (ni uno menos, ni uno de más)', () => {
    const app = M.escriturasDe(leer('guajirago/src/Turismo.js'));
    const reglas = M.listasDeLasReglas(leer('firestore.rules'));
    assert.ok(reglas.crear && reglas.cambiar, 'las reglas de la reserva no tienen sus dos listas');
    assert.deepStrictEqual([...new Set(app.crear)].sort(), [...reglas.crear].sort(), 'al CREAR, la app y las reglas no dicen lo mismo');
    assert.deepStrictEqual([...new Set([...app.cambiar.flat(), ...app.token])].sort(), [...reglas.cambiar].sort(), 'al CAMBIAR, la app y las reglas no dicen lo mismo');
    assert.ok(app.crear.length >= 16 && app.crear.includes('tourId') && app.token.includes('clienteFcmToken'),
      'el lector de la app no encontró sus escrituras: ' + JSON.stringify(app));
  });

  it('el lector no se ablanda: un campo nuevo en la app sale como «fuera de las reglas»', () => {
    const reglas = M.listasDeLasReglas(leer('firestore.rules'));
    const app = leer('guajirago/src/Turismo.js');
    const conCampo = app.replace("estado: 'nueva',", "estado: 'nueva',\n        cupon: 'x',");
    assert.notStrictEqual(conCampo, app, 'no encontré dónde meter el campo nuevo');
    assert.deepStrictEqual(M.loQueLaAppEscribeYLasReglasNo(M.escriturasDe(conCampo), reglas).crear, ['cupon']);
    const conCambio = app.replace("prepararTokenDeAvisos('clienteFcmToken')", "prepararTokenDeAvisos('otroFcmToken')");
    assert.notStrictEqual(conCambio, app, 'no encontré el token de avisos');
    assert.deepStrictEqual(M.loQueLaAppEscribeYLasReglasNo(M.escriturasDe(conCambio), reglas).cambiar, ['otroFcmToken']);
    // Las reglas de antes no tenían lista: no se pueden dar por buenas.
    assert.deepStrictEqual(M.listasDeLasReglas(deAntes('firestore.rules')), { crear: null, cambiar: null });
  });
});

describe('P16 · la app ya no tranca la reserva por un dato que le falta al tour', () => {
  it('con la app de hoy, todos los casos salen, sin undefined, dentro de la lista y con el nombre entendible', async () => {
    const reglas = M.listasDeLasReglas(leer('firestore.rules'));
    const filas = await M.medirApp(null, reglas);
    for (const f of filas) {
      assert.strictEqual(f.entro, true, f.caso + ': ' + f.aviso);
      assert.deepStrictEqual(f.indefinidos, [], f.caso);
      assert.deepStrictEqual(f.fueraDeLaLista, [], f.caso);
      assert.strictEqual(typeof f.reserva.nombreTour, 'string', f.caso);
      assert.ok(f.reserva.nombreTour.trim(), f.caso);
      assert.strictEqual(f.reserva.total, f.totalEnPantalla, f.caso + ': la app mandó otro total que el que enseñó');
    }
    const por = (c) => filas.find((f) => f.caso === c).reserva;
    assert.strictEqual(por('FALTA · el tour no tiene nombre').nombreTour, 'Tour');
    assert.strictEqual(por('FALTA · el nombre del tour no es texto (un número)').nombreTour, 'Tour');
    assert.ok(!('tourId' in por('FALTA · el tour no tiene id')), 'un tour sin id manda tourId');
    assert.strictEqual(por('FALTA · el tour no tiene nombre ni id').nombreTour, 'Tour');
    assert.strictEqual(por('FALTA · la agencia no tiene nombre').agenciaNombre, '');
  });

  it('un alquiler sin nombre se llama «Alquiler»', async () => {
    const aparato = M.pantallaDe(leer('guajirago/src/Turismo.js'))({ tour: { id: 't9', tipo: 'alquiler', precio: 1000, unidadPrecio: 'dia' } });
    await aparato.enviar();
    assert.strictEqual(aparato.mandados[0].nombreTour, 'Alquiler');
    assert.deepStrictEqual(aparato.estado.exito, { nombre: 'Alquiler' }, 'la ventanita de «¡Reserva enviada!» no dice el mismo nombre');
  });

  it('CAREO · con la app de antes (9f0be79) 3 de 6 casos no dejaban reservar; los honrados salen IGUALES', async () => {
    const reglas = M.listasDeLasReglas(leer('firestore.rules'));
    const antes = await M.medirApp(ANTES, reglas);
    const hoy = await M.medirApp(null, reglas);
    const trancadas = antes.filter((f) => f.falta && !f.entro);
    assert.deepStrictEqual(trancadas.map((f) => f.caso), [
      'FALTA · el tour no tiene nombre', 'FALTA · el tour no tiene id', 'FALTA · el tour no tiene nombre ni id',
    ], 'el medidor ya no ve el fallo con la app vieja');
    for (const f of trancadas) assert.ok(f.indefinidos.length > 0 && /undefined/.test(f.aviso), f.caso);
    const huella = (f) => JSON.stringify({ ...f.reserva, creado: 'x' });
    for (const f of antes.filter((x) => x.honrado)) assert.strictEqual(huella(hoy.find((x) => x.caso === f.caso)), huella(f), f.caso);
  });
});

// ── EL CAREO DE LAS REGLAS EN EL EMULADOR ──

let RUT;
let FS;
const entornos = {};
const PROYECTOS = { antes: 'demo-p16-antes', hoy: 'demo-p16-hoy' };

before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  const puerto = elEmulador().firestore;
  entornos.antes = await RUT.initializeTestEnvironment({ projectId: PROYECTOS.antes, firestore: { rules: deAntes('firestore.rules'), host: '127.0.0.1', port: puerto } });
  entornos.hoy = await RUT.initializeTestEnvironment({ projectId: PROYECTOS.hoy, firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: puerto } });
});
after(async () => { for (const e of Object.values(entornos)) await e.cleanup(); });

const GRANDE = 'x'.repeat(900 * 1024);
/** Lo que manda la app al crear (Turismo.js, enviarReserva), firmada por Ana. */
const DE_LA_APP = (extra) => ({
  agenciaId: 'a1', clienteId: 'ana', agenciaNombre: 'Wayuu Tours', tourId: 'tour_1', tipo: 'tour', nombreTour: 'Cabo De La Vela 2 Días',
  imagen: 'https://firebasestorage.googleapis.com/v0/b/x/o/restaurantes%2Fa1%2Ftours%2F1.jpg?alt=media&token=' + 'a'.repeat(36),
  cliente: 'Ana', telefono: '3001112233', personas: 2, fecha: '2026-10-05', total: 500000, unidadPrecio: 'persona',
  estado: 'nueva', notas: 'somos 2 adultos', creado: '2026-10-01T12:00:00.000Z', ...(extra || {}),
});

async function sembrar(entorno) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { doc, setDoc } = FS;
    await setDoc(doc(db, 'usuarios/ana'), { nombre: 'Ana', rol: '' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'negocios/a1'), { nombre: 'Wayuu Tours', tipoNegocio: 'turismo', activo: true });
    await setDoc(doc(db, 'empleados/emp1'), { restauranteId: 'a1', activo: true });
    await setDoc(doc(db, 'reservasTurismo/nueva'), DE_LA_APP());
    await setDoc(doc(db, 'reservasTurismo/confirmada'), DE_LA_APP({ estado: 'confirmada', codigo: 'GGABCD123', fechaConfirmada: '2026-10-01T13:00:00.000Z' }));
  });
}

/**
 * Cada escritura: [quién, qué hace, (db, F) => promesa, ¿pasaba antes?, ¿pasa hoy?]. Las LEGÍTIMAS (las que hace hoy
 * alguna app, medidas en el código y en el paquete publicado) pasan con las dos reglas; los VENENOS pasaban y ya no.
 */
const ESCRITURAS = [
  // ── legítimas del cliente (Turismo.js; el token, Notificaciones.js)
  ['ana', 'crea su reserva como la app', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP()), true, true],
  ['ana', 'crea la reserva de un tour sin id (sin tourId) y sin nombre («Tour»)', (db, F) => { const d = DE_LA_APP({ nombreTour: 'Tour' }); delete d.tourId; return F.addDoc(F.collection(db, 'reservasTurismo'), d); }, true, true],
  ['ana', 'crea la de un alquiler por día con agencia sin nombre y sin notas', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ tipo: 'alquiler', unidadPrecio: 'dia', personas: 1, agenciaNombre: '', notas: '', imagen: '' })), true, true],
  ['ana', 'crea con textos largos de verdad (nombre 120, notas 400)', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ cliente: 'A'.repeat(120), notas: 'N'.repeat(400) })), true, true],
  ['ana', 'pega su token de avisos', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { clienteFcmToken: 't'.repeat(163) }), true, true],
  // ── legítimas de la agencia (aliados, ReservasTurismo.js) y del panel: no cambian
  ['a1', 'confirma con su código', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { estado: 'confirmada', codigo: 'GGABCD123', fechaConfirmada: '2026-10-01T13:00:00.000Z' }), true, true],
  ['a1', 'la marca realizada', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/confirmada'), { estado: 'realizada', fechaRealizada: '2026-10-05T18:00:00.000Z' }), true, true],
  ['emp1', 'la cancela con su motivo (un empleado de la agencia)', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { estado: 'cancelada', canceladoPor: 'agencia', motivoCancelacion: 'Sin disponibilidad', fechaCancelada: '2026-10-01T14:00:00.000Z' }), true, true],
  ['eladmin', 'el panel (hoy solo lee; su permiso no cambia)', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { estado: 'cancelada', notaAdmin: 'duplicada' }), true, true],
  ['a1', 'la agencia crea una reserva (nadie lo hace hoy; su permiso no cambia)', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), { agenciaId: 'a1', estado: 'confirmada', cliente: 'Por teléfono', total: 100000 }), true, true],

  // ── VENENOS del cliente al crear
  ['ana', 'VENENO · crea con un campo de sobra casi de 1 MiB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ relleno: GRANDE })), true, false],
  ['ana', 'VENENO · crea con un campo de sobra chiquito', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ cupon: 'GRATIS' })), true, false],
  ['ana', 'VENENO · crea ya confirmada, con su propio código', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ estado: 'confirmada', codigo: 'FALSO1' })), true, false],
  ['ana', 'VENENO · crea ya confirmada', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ estado: 'confirmada' })), true, false],
  ['ana', 'VENENO · el nombre del tour de 900 KB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ nombreTour: GRANDE })), true, false],
  ['ana', 'VENENO · las notas de 900 KB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ notas: GRANDE })), true, false],
  ['ana', 'VENENO · el nombre del cliente de 900 KB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ cliente: GRANDE })), true, false],
  ['ana', 'VENENO · la foto de 900 KB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ imagen: GRANDE })), true, false],
  ['ana', 'VENENO · la fecha de 900 KB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ fecha: GRANDE })), true, false],
  ['ana', 'VENENO · el total como texto de 900 KB', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ total: GRANDE })), true, false],
  ['ana', 'VENENO · 0 personas', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ personas: 0 })), true, false],
  ['ana', 'VENENO · las personas como texto', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ personas: '2' })), true, false],
  ['ana', 'VENENO · el teléfono con «+57» (la app manda 10 cifras)', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ telefono: '+573001112233' })), true, false],
  ['ana', 'VENENO · el nombre del tour como número (lo que la app de antes mandaba tal cual)', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ nombreTour: 123 })), true, false],
  ['ana', 'VENENO · sin agencia', (db, F) => F.addDoc(F.collection(db, 'reservasTurismo'), DE_LA_APP({ agenciaId: '' })), true, false],
  // ── VENENOS del cliente al cambiar
  ['ana', 'VENENO · se confirma la reserva él mismo', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { estado: 'confirmada', codigo: 'FALSO1' }), true, false],
  ['ana', 'VENENO · le baja el total', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/confirmada'), { total: 1 }), true, false],
  ['ana', 'VENENO · le añade un campo de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { nota: GRANDE }), true, false],
  ['ana', 'VENENO · le cambia las notas por unas de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { notas: GRANDE }), true, false],
  ['ana', 'VENENO · token de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/nueva'), { clienteFcmToken: GRANDE }), true, false],
  ['ana', 'VENENO · la cancela diciendo que fue la agencia', (db, F) => F.updateDoc(F.doc(db, 'reservasTurismo/confirmada'), { estado: 'cancelada', canceladoPor: 'agencia', motivoCancelacion: 'x' }), true, false],
];

describe('P16 · CAREO de las reglas: las de antes (9f0be79) y las de hoy, en el emulador', () => {
  for (const [quien, que, escribir, antes, hoy] of ESCRITURAS) {
    it(quien + ' · ' + que + ' → antes ' + (antes ? 'pasa' : 'no') + ', hoy ' + (hoy ? 'pasa' : 'no'), async () => {
      for (const [cual, esperado] of [['antes', antes], ['hoy', hoy]]) {
        const e = entornos[cual];
        await sembrar(e);
        const db = e.authenticatedContext(quien).firestore();
        const promesa = escribir(db, FS);
        if (esperado) await RUT.assertSucceeds(promesa); else await RUT.assertFails(promesa);
      }
    });
  }

  it('lo que la app de HOY manda en cada caso del medidor entra con las reglas de hoy', async () => {
    const filas = await M.medirApp(null, M.listasDeLasReglas(leer('firestore.rules')));
    const e = entornos.hoy;
    await sembrar(e);
    const db = e.authenticatedContext('cliente-ana').firestore();
    for (const f of filas) await RUT.assertSucceeds(FS.addDoc(FS.collection(db, 'reservasTurismo'), { ...f.reserva, agenciaId: 'a1' }));
  });
});
