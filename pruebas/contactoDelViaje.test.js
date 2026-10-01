/**
 * P21 · EL CAJÓN DE CONTACTO DEL VIAJE (1-oct-2026)
 *
 * Un viaje que busca conductor lo leen todos los conductores (P20). Llevaba dentro el correo del pasajero (no lo leía
 * nadie), el teléfono de quien recibe un mandado y el token de avisos del pasajero: datos que el conductor solo
 * necesita DESPUÉS de que lo aceptan. Desde P21 el correo ya no se escribe, y el teléfono y el token van a
 * `viajes/{id}/contacto/pasajero` (guajirago/src/contactoDelViaje.js), que leen el pasajero, el conductor ACEPTADO con
 * el viaje vivo y el panel.
 *
 * Esta prueba:
 *   1. que el MEDIDOR (scripts/medir-contacto-del-viaje.cjs) no se ablanda: lo de antes (7733a4f) sale rojo, lo de hoy
 *      limpio, y cada vuelta atrás por separado lo pone rojo;
 *   2. EJECUTA la pieza (ruta, qué se guarda, qué se lee, el respaldo para los viajes de antes) y ata la copia del panel;
 *   3. AMARRA a los que la usan: la pantalla de pedir, la del conductor, el panel, el servidor y las reglas;
 *   4. corre el SERVIDOR (index.js con una nube de mentira): «tienes una oferta» le llega al mismo token, esté en el
 *      cajón (hoy) o en el viaje (viajes de antes / apps viejas); el aviso a conductores cercanos y el mensaje de
 *      emergencia salen IDÉNTICOS con el viaje de antes y el de hoy;
 *   5. CAREA en el emulador las reglas de antes (7733a4f) y las de hoy, con el viaje armado por el código de cada uno.
 *   6. P22 (fase 2): el medidor de las reglas no se ablanda, y el CAREO en el emulador de las reglas de la fase 1
 *      (dca9179) con las de hoy: la app de hoy pide igual y los viajes guardados se siguen moviendo; escribir el
 *      correo, el token o el teléfono de quien recibe en el viaje se niega, al crear y al cambiar.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { leer, cargarDeLaApp, soloCodigo, copiaIdentica, RAIZ } = require('./cargar.cjs');
const M = require('../scripts/medir-contacto-del-viaje.cjs');
const NUBE = require('./nubeDeMentira.cjs');

const ANTES = '7733a4f';
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 });
const HOY = {
  viajeNuevo: leer('guajirago/src/viajeNuevo.js'),
  solicitar: leer('guajirago/src/Solicitar.js'),
  conductor: leer('guajirago/src/AppConductor.js'),
};
const VIEJO = {
  viajeNuevo: deAntes('guajirago/src/viajeNuevo.js'),
  solicitar: deAntes('guajirago/src/Solicitar.js'),
  conductor: deAntes('guajirago/src/AppConductor.js'),
};
const medir = (t) => {
  const viaje = M.viajePublicoDeUnMandado(t.viajeNuevo, t.solicitar);
  return M.veredicto({ publicos: M.sensiblesEnElViaje(viaje), token: M.dondeVaElToken(t.solicitar), tarjeta: M.telefonoEnLaTarjetaDelMercado(t.conductor) });
};
/** Cambia UNA vez `que` por `por` en el texto (y revienta si no calza: un sabotaje que no se aplica no prueba nada). */
const cambiar = (texto, que, por) => {
  const n = texto.split(que).length - 1;
  assert.strictEqual(n, 1, 'el texto «' + que + '» aparece ' + n + ' veces');
  return texto.replace(que, por);
};

// ── 1. EL MEDIDOR NO SE ABLANDA ──
describe('P21 · el medidor del contacto del viaje no se ablanda', () => {
  it('lo de antes (7733a4f) sale rojo por las tres: correo y teléfono en el viaje, token en el viaje, teléfono en la tarjeta', () => {
    const v = medir(VIEJO);
    assert.strictEqual(v.length, 3, v.join('\n'));
    assert.match(v[0], /pasajeroEmail, mensajeria\.recibeTel/);
  });
  it('lo de hoy sale limpio', () => assert.deepStrictEqual(medir(HOY), []));
  it('volver a meter el teléfono en el paquete público lo pone rojo', () => {
    const s = cambiar(HOY.solicitar, 'recibeNombre: recibeNombre.trim(), nota:', 'recibeNombre: recibeNombre.trim(), recibeTel: celularDiezCifras(recibeTel), nota:');
    assert.match(medir({ ...HOY, solicitar: s }).join('\n'), /mensajeria\.recibeTel/);
  });
  it('volver a escribir el correo lo pone rojo', () => {
    const v = cambiar(HOY.viajeNuevo, 'pasajeroId: user.uid,', 'pasajeroId: user.uid, pasajeroEmail: user.email,');
    assert.match(medir({ ...HOY, viajeNuevo: v }).join('\n'), /pasajeroEmail/);
  });
  it('volver a pegar el token en el viaje lo pone rojo', () => {
    const s = cambiar(HOY.solicitar, 'pegarToken(contactoRef);', 'pegarToken(docRef);');
    assert.match(medir({ ...HOY, solicitar: s }).join('\n'), /token de avisos/);
  });
  it('volver a enseñar el teléfono en la tarjeta del mercado lo pone rojo', () => {
    const c = cambiar(HOY.conductor, '🙋 Recibe: {solicitud.mensajeria.recibeNombre}</p>}',
      '🙋 Recibe: {solicitud.mensajeria.recibeNombre}{solicitud.mensajeria?.recibeTel}</p>}');
    assert.match(medir({ ...HOY, conductor: c }).join('\n'), /tarjeta del mercado/);
  });
});

// ── 2. LA PIEZA, EJECUTADA ──
const FB = { escritas: [], leer: async () => ({ exists: () => false }), escribir: async () => {} };
globalThis.__FB_P21 = {
  doc: (_db, ...ruta) => ({ ruta: ruta.join('/') }),
  setDoc: (ref, datos) => { FB.escritas.push({ ruta: ref.ruta, datos }); return FB.escribir(); },
  getDoc: (ref) => FB.leer(ref),
};
const cargarPieza = (texto) => cargarDeLaApp('guajirago/src/contactoDelViaje.js',
  cambiar(texto, "import { doc, setDoc, getDoc } from 'firebase/firestore';", 'const { doc, setDoc, getDoc } = globalThis.__FB_P21;'));
const P = cargarPieza(leer('guajirago/src/contactoDelViaje.js'));
const callado = async (fn) => { const w = console.warn; const dicho = []; console.warn = (...a) => dicho.push(a.join(' ')); try { return { valor: await fn(), dicho }; } finally { console.warn = w; } };

describe('P21 · la pieza del cajón de contacto (contactoDelViaje.js), ejecutada', () => {
  it('la ruta es viajes/{id}/contacto/pasajero', () => assert.strictEqual(P.refContactoDelViaje({}, 'V9').ruta, 'viajes/V9/contacto/pasajero'));
  it('al pedir guarda solo el teléfono de quien recibe; un taxi, el cajón vacío', async () => {
    FB.escritas = []; FB.escribir = async () => {};
    assert.strictEqual(await P.guardarContactoDelViaje({}, 'V1', '3001112233'), true);
    assert.strictEqual(await P.guardarContactoDelViaje({}, 'V2', ''), true);
    assert.deepStrictEqual(FB.escritas, [{ ruta: 'viajes/V1/contacto/pasajero', datos: { recibeTel: '3001112233' } },
      { ruta: 'viajes/V2/contacto/pasajero', datos: {} }]);
  });
  it('si no se puede guardar, no revienta el pedido y queda rastro en la consola', async () => {
    FB.escribir = async () => { throw new Error('permission-denied'); };
    const r = await callado(() => P.guardarContactoDelViaje({}, 'V1', '3001112233'));
    assert.strictEqual(r.valor, false);
    assert.match(r.dicho.join('\n'), /contacto del viaje: permission-denied/);
  });
  it('leer: lo que hay, {} si no existe, {} (con rastro) si no se puede', async () => {
    FB.leer = async () => ({ exists: () => true, data: () => ({ recibeTel: '3001112233' }) });
    assert.deepStrictEqual(await P.leerContactoDelViaje({}, 'V1'), { recibeTel: '3001112233' });
    FB.leer = async () => ({ exists: () => false });
    assert.deepStrictEqual(await P.leerContactoDelViaje({}, 'V1'), {});
    FB.leer = async () => { throw new Error('permission-denied'); };
    const r = await callado(() => P.leerContactoDelViaje({}, 'V1'));
    assert.deepStrictEqual(r.valor, {});
    assert.match(r.dicho.join('\n'), /permission-denied/);
  });
  it('el teléfono de quien recibe: el del cajón; si el viaje es de antes, el del viaje; si no hay, vacío', () => {
    const viejo = { mensajeria: { recibeTel: '3009998877' } };
    assert.strictEqual(P.telefonoDeQuienRecibe({ mensajeria: {} }, { recibeTel: '3001112233' }), '3001112233');
    assert.strictEqual(P.telefonoDeQuienRecibe(viejo, {}), '3009998877');
    assert.strictEqual(P.telefonoDeQuienRecibe(viejo, { recibeTel: '3001112233' }), '3001112233');
    assert.strictEqual(P.telefonoDeQuienRecibe({ tipo: 'Taxi' }, {}), '');
    assert.strictEqual(P.telefonoDeQuienRecibe(null, null), '');
  });
  it('el panel lleva una copia IDÉNTICA (otro repo: no puede importarla)', () => {
    copiaIdentica('guajirago-admin/src/contactoDelViaje.js', 'guajirago/src/contactoDelViaje.js',
      'El panel lee el teléfono de quien recibe con esta pieza; si se separa, lee de otro sitio.');
  });
});

// ── 3. EL AMARRE ──
describe('P21 · todos usan la pieza', () => {
  const sol = soloCodigo(HOY.solicitar);
  const con = soloCodigo(HOY.conductor);
  const panel = soloCodigo(leer('guajirago-admin/src/Mensajeria.js'));
  it('la pantalla de pedir guarda el cajón con el teléfono limpio, justo después de crear el viaje', () => {
    const alta = sol.indexOf("const docRef = await addDoc(collection(db, 'viajes')");
    const guarda = sol.indexOf('guardarContactoDelViaje(db, docRef.id, celularDiezCifras(recibeTel));');
    assert.ok(alta > 0 && guarda > alta, 'no guarda el cajón después de crear el viaje');
    assert.ok(/const contactoRef = refContactoDelViaje\(db, docRef\.id\);/.test(sol), 'el token no va al cajón del viaje creado');
  });
  it('nadie lee el teléfono de quien recibe del viaje a pelo: conductor y panel pasan por telefonoDeQuienRecibe', () => {
    for (const [nombre, t] of [['AppConductor.js', con], ['Mensajeria.js (panel)', panel]]) {
      assert.deepStrictEqual(t.match(/mensajeria\??\.recibeTel/g), null, nombre + ' lee mensajeria.recibeTel a pelo');
      assert.ok(/telefonoDeQuienRecibe\(/.test(t), nombre + ' no usa telefonoDeQuienRecibe');
      assert.ok(/leerContactoDelViaje\(db, /.test(t), nombre + ' no lee el cajón');
    }
    assert.ok(/telefonoDeQuienRecibe\(viajeActual, contactoViaje\)/.test(con), 'el conductor no mira el cajón de SU viaje');
    assert.ok(/\(m\.telRecibe \|\| ''\)\.includes\(q\)/.test(panel), 'el buscador del panel ya no busca por el teléfono de quien recibe');
    assert.ok(/const contactos = await Promise\.all\(lista\.map\(\(m\) => leerContactoDelViaje\(db, m\.id\)\)\);/.test(panel)
      && /telRecibe: telefonoDeQuienRecibe\(m, contactos\[i\]\)/.test(panel), 'el panel no le da a cada mandado SU cajón');
    assert.ok(/\{m\.telRecibe \? ' \(' \+ m\.telRecibe \+ '\)' : ''\}/.test(panel), 'la tarjeta del panel no enseña el teléfono de quien recibe');
  });
  it('el servidor lee el token en la MISMA ruta que la pieza, y si no está, en el viaje', () => {
    const idx = soloCodigo(leer('guajirago/functions/index.js'));
    const i = idx.indexOf('exports.notificarPasajeroOferta');
    const trozo = idx.slice(i, idx.indexOf('\nexports.', i + 10));
    const m = trozo.match(/collection\("viajes"\)\.doc\(event\.params\.viajeId\)[\s\S]*?\.collection\("(\w+)"\)\.doc\("(\w+)"\)/);
    assert.ok(m, 'notificarPasajeroOferta ya no lee el cajón');
    assert.strictEqual('viajes/V9/' + m[1] + '/' + m[2], P.refContactoDelViaje({}, 'V9').ruta);
  });
  it('las reglas del cajón: «vivo» es ESTADO_ACEPTADO de estadosViaje.js', () => {
    const { ESTADO_ACEPTADO } = cargarDeLaApp('guajirago/src/estadosViaje.js');
    const r = leer('firestore.rules');
    const bloque = r.slice(r.indexOf('match /contacto/{cual}'), r.indexOf('match /contraofertas/'));
    const estados = [...bloque.matchAll(/get\('estado', ''\) == '(\w+)'/g)].map((x) => x[1]);
    assert.deepStrictEqual(estados, [ESTADO_ACEPTADO]);
  });
});

// ── 4. EL SERVIDOR, EJECUTADO ──
const creado = (d, params = {}) => ({ data: { data: () => d }, params });
const OFERTA = creado({ conductorNombre: 'Luis', tipoOferta: 'acepta', monto: '$ 9.000' }, { viajeId: 'V1' });
async function tokenDelAviso(datos) {
  const { fx, mensajero } = NUBE.cargarIndex(datos);
  await NUBE.conRegistro(() => fx.notificarPasajeroOferta(OFERTA));
  return mensajero.recibidos.map((r) => r.token);
}
describe('P21 · el servidor: «tienes una oferta» y los avisos a conductores', () => {
  it('con el token en el cajón (hoy), le llega a ese', async () => {
    assert.deepStrictEqual(await tokenDelAviso({ viajes: { V1: { estado: 'esperando' } }, 'viajes/V1/contacto': { pasajero: { pasajeroFcmToken: 'tokNuevo' } } }), ['tokNuevo']);
  });
  it('un viaje de antes (o de una app vieja) con el token dentro, le sigue llegando', async () => {
    assert.deepStrictEqual(await tokenDelAviso({ viajes: { V1: { pasajeroFcmToken: 'tokViejo' } } }), ['tokViejo']);
    assert.deepStrictEqual(await tokenDelAviso({ viajes: { V1: { pasajeroFcmToken: 'tokViejo' } }, 'viajes/V1/contacto': { pasajero: {} } }), ['tokViejo']);
  });
  it('con los dos, manda el del cajón; sin ninguno, no avisa a nadie; sin viaje, tampoco', async () => {
    assert.deepStrictEqual(await tokenDelAviso({ viajes: { V1: { pasajeroFcmToken: 'tokViejo' } }, 'viajes/V1/contacto': { pasajero: { pasajeroFcmToken: 'tokNuevo' } } }), ['tokNuevo']);
    assert.deepStrictEqual(await tokenDelAviso({ viajes: { V1: {} } }), []);
    assert.deepStrictEqual(await tokenDelAviso({ viajes: {}, 'viajes/V1/contacto': { pasajero: { pasajeroFcmToken: 'tokNuevo' } } }), []);
  });
  it('el aviso a conductores cercanos sale IDÉNTICO con el viaje de antes y el de hoy', async () => {
    const datos = {
      conductores: { C1: { activo: true, fcmToken: 'tokC1', ubicacion: { lat: 11.545, lng: -72.907 } }, C3: { activo: true, fcmToken: 'tokC3', ubicacion: { lat: 11.1, lng: -72.5 } }, C4: { activo: true, fcmToken: 'tokC4', ubicacion: { lat: 11.546, lng: -72.906 } } },
      usuarios: { C1: { tipoVehiculo: 'Taxi' }, C3: { tipoVehiculo: 'Taxi' }, C4: { tipoVehiculo: 'Mototaxi' } },
    };
    const avisos = async (viaje) => {
      const { fx, mensajero } = NUBE.cargarIndex(datos);
      await NUBE.conRegistro(() => fx.notificarNuevoViaje(creado(viaje)));
      return mensajero.recibidos;
    };
    const antes = await avisos(M.viajePublicoDeUnMandado(VIEJO.viajeNuevo, VIEJO.solicitar));
    const hoy = await avisos(M.viajePublicoDeUnMandado(HOY.viajeNuevo, HOY.solicitar));
    assert.deepStrictEqual(hoy, antes);
    assert.deepStrictEqual(hoy.map((r) => r.token), ['tokC4'], 'el mandado le toca al mototaxista cercano');
  });
  it('el mensaje de emergencia sale IDÉNTICO con el viaje de antes y el de hoy', () => {
    const { armarMensajeDeEmergencia } = cargarDeLaApp('guajirago/src/mensajeEmergencia.js');
    const conConductor = (v) => ({ ...v, estado: 'aceptado', conductorId: 'c1', conductorNombre: 'Carlos', conductorPlaca: 'ABC123', conductorTelefono: '3005556677', conductorVehiculo: 'Moto' });
    const armar = (v) => armarMensajeDeEmergencia({ desde: 'enViaje', ubicacion: { lat: 11.5444, lng: -72.9072 }, ubicacionDe: 'gps', viaje: conConductor(v) });
    const antes = armar(M.viajePublicoDeUnMandado(VIEJO.viajeNuevo, VIEJO.solicitar));
    assert.deepStrictEqual(armar(M.viajePublicoDeUnMandado(HOY.viajeNuevo, HOY.solicitar)), antes);
    assert.match(JSON.stringify(antes), /ABC123/);
  });
});

// ── 5. EL CAREO DE LAS REGLAS EN EL EMULADOR ──
let RUT;
let FS;
const entornos = {};
before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  const puerto = elEmulador().firestore;
  entornos.antes = await RUT.initializeTestEnvironment({ projectId: 'demo-p21-antes', firestore: { rules: deAntes('firestore.rules'), host: '127.0.0.1', port: puerto } });
  entornos.hoy = await RUT.initializeTestEnvironment({ projectId: 'demo-p21-hoy', firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: puerto } });
});
after(async () => { for (const e of Object.values(entornos)) await e.cleanup(); });

const MANDADO = { antes: M.viajePublicoDeUnMandado(VIEJO.viajeNuevo, VIEJO.solicitar), hoy: M.viajePublicoDeUnMandado(HOY.viajeNuevo, HOY.solicitar) };
async function sembrar(entorno, cual) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { doc, setDoc } = FS;
    await setDoc(doc(db, 'usuarios/ana'), { nombre: 'Ana', tipo: 'pasajero', rol: '' });
    await setDoc(doc(db, 'usuarios/beto'), { nombre: 'Beto', tipo: 'pasajero', rol: '' });
    await setDoc(doc(db, 'usuarios/taxi'), { nombre: 'Carlos', tipo: 'conductor', tipoVehiculo: 'Taxi', rol: '' });
    await setDoc(doc(db, 'usuarios/moto'), { nombre: 'Mario', tipo: 'conductor', tipoVehiculo: 'Mototaxi', rol: '' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    const m = MANDADO[cual];
    await setDoc(doc(db, 'viajes/enEspera'), m);
    await setDoc(doc(db, 'viajes/aceptado'), { ...m, estado: 'aceptado', conductorId: 'taxi' });
    await setDoc(doc(db, 'viajes/aceptado/contraofertas/moto'), { monto: 9000, vigente: false });
    await setDoc(doc(db, 'viajes/terminado'), { ...m, estado: 'finalizado', conductorId: 'taxi' });
    for (const id of ['enEspera', 'aceptado', 'terminado']) {
      await setDoc(doc(db, 'viajes/' + id + '/contacto/pasajero'), { recibeTel: '3001112233', pasajeroFcmToken: 'tokAna' });
    }
  });
}
const D = (db, ruta) => FS.getDoc(FS.doc(db, ruta));
const C = (id) => 'viajes/' + id + '/contacto/pasajero';

describe('P21 · CAREO de los datos: lo que el conductor del mercado recibe al mirar un mandado', () => {
  for (const cual of ['antes', 'hoy']) {
    it(cual + ': el mototaxista del mercado lee el mandado → ' + (cual === 'antes' ? 'con correo y teléfono de quien recibe' : 'sin correo ni teléfono'), async () => {
      const e = entornos[cual];
      await sembrar(e, cual);
      const s = await D(e.authenticatedContext('moto').firestore(), 'viajes/enEspera');
      assert.ok(s.exists());
      const v = s.data();
      const lleva = [v.pasajeroEmail ? 'correo' : '', v.mensajeria && v.mensajeria.recibeTel ? 'teléfono' : ''].filter(Boolean);
      assert.deepStrictEqual(lleva, cual === 'antes' ? ['correo', 'teléfono'] : []);
      assert.strictEqual(v.mensajeria.recibeNombre, 'Rosa', 'el nombre de quien recibe y el paquete siguen para decidir');
      assert.strictEqual(v.pasajeroLat, 11.5444, 'las coordenadas siguen (distancia del mercado y aviso)');
    });
  }
});

/** [quién, qué hace, (db) => promesa, ¿pasa hoy?] — en las reglas de antes el cajón no existía (nadie lo lee ni escribe). */
const CAJON = [
  ['ana', 'la pasajera lee el cajón de su mandado en espera', (db) => D(db, C('enEspera')), true],
  ['taxi', 'su conductor ACEPTADO lee el cajón con el viaje vivo', (db) => D(db, C('aceptado')), true],
  ['eladmin', 'el panel lee el cajón', (db) => D(db, C('terminado')), true],
  ['moto', 'AJENA · un conductor del mercado lee el cajón antes de que lo acepten', (db) => D(db, C('enEspera')), false],
  ['taxi', 'AJENA · un conductor lee el cajón de un viaje que NO ha aceptado', (db) => D(db, C('enEspera')), false],
  ['moto', 'AJENA · el que ofertó y perdió lee el cajón', (db) => D(db, C('aceptado')), false],
  ['taxi', 'AJENA · el conductor lee el cajón con el viaje terminado', (db) => D(db, C('terminado')), false],
  ['beto', 'AJENA · otro pasajero lee el cajón', (db) => D(db, C('enEspera')), false],
  ['moto', 'AJENA · un conductor pide la lista de cajones', (db) => FS.getDocs(FS.collection(db, 'viajes/enEspera/contacto')), false],
  ['ana', 'la pasajera le pega su token (Notificaciones.js)', (db) => FS.updateDoc(FS.doc(db, C('enEspera')), { pasajeroFcmToken: 'tokNuevo' }), true],
  ['ana', 'la pasajera cambia el teléfono después de pedir', (db) => FS.updateDoc(FS.doc(db, C('enEspera')), { recibeTel: '3000000000' }), false],
  ['taxi', 'el conductor aceptado escribe en el cajón', (db) => FS.updateDoc(FS.doc(db, C('aceptado')), { pasajeroFcmToken: 'x' }), false],
  ['ana', 'la pasajera borra el cajón', (db) => FS.deleteDoc(FS.doc(db, C('enEspera'))), false],
];
describe('P21 · CAREO de las reglas del cajón: antes (7733a4f) no existía; hoy, en el emulador', () => {
  for (const [quien, que, hacer, hoy] of CAJON) {
    it(quien + ' · ' + que + ' → antes no, hoy ' + (hoy ? 'pasa' : 'no'), async () => {
      for (const [cual, esperado] of [['antes', false], ['hoy', hoy]]) {
        const e = entornos[cual];
        await sembrar(e, cual);
        const promesa = hacer(e.authenticatedContext(quien).firestore());
        if (esperado) await RUT.assertSucceeds(promesa); else await RUT.assertFails(promesa);
      }
    });
  }
});

describe('P21 · el pedido entero, como lo hace la app, con las reglas de hoy', () => {
  const nuevoDe = (cual) => ({ ...MANDADO[cual], fechaSolicitud: new Date().toISOString() });
  it('app de hoy: crea el viaje, crea el cajón con el teléfono, le pega el token', async () => {
    const e = entornos.hoy;
    await sembrar(e, 'hoy');
    const db = e.authenticatedContext('ana').firestore();
    const ref = await RUT.assertSucceeds(FS.addDoc(FS.collection(db, 'viajes'), nuevoDe('hoy')));
    await RUT.assertSucceeds(FS.setDoc(FS.doc(db, C(ref.id)), { recibeTel: '3001112233' }));
    await RUT.assertSucceeds(FS.updateDoc(FS.doc(db, C(ref.id)), { pasajeroFcmToken: 'tokAna' }));
  });
  it('un taxi crea el cajón vacío', async () => {
    const e = entornos.hoy;
    await sembrar(e, 'hoy');
    const db = e.authenticatedContext('ana').firestore();
    const ref = await FS.addDoc(FS.collection(db, 'viajes'), { ...nuevoDe('hoy'), tipo: 'Taxi' });
    await RUT.assertSucceeds(FS.setDoc(FS.doc(db, C(ref.id)), {}));
  });
  it('nadie mete en el cajón otra cosa, ni lo crea en un viaje ajeno', async () => {
    const e = entornos.hoy;
    await sembrar(e, 'hoy');
    const ana = e.authenticatedContext('ana').firestore();
    const ref = await FS.addDoc(FS.collection(ana, 'viajes'), nuevoDe('hoy'));
    await RUT.assertFails(FS.setDoc(FS.doc(ana, C(ref.id)), { recibeTel: '3001112233', pasajeroEmail: 'a@b.co' }));
    await RUT.assertFails(FS.setDoc(FS.doc(e.authenticatedContext('beto').firestore(), C(ref.id)), { recibeTel: '3001112233' }));
  });
});

// ── 6. P22 · FASE 2: esos campos ya no se escriben en el viaje ──
const FASE1 = 'dca9179';
describe('P22 · el medidor de las reglas no se ablanda', () => {
  it('las reglas de la fase 1 (' + FASE1 + ') dejan escribir los tres al crear y al cambiar; las de hoy, ninguno', () => {
    const r1 = M.camposQueLasReglasDejanEscribir(execFileSync('git', ['show', FASE1 + ':firestore.rules'], { cwd: RAIZ, encoding: 'utf8' }));
    assert.deepStrictEqual(r1, { create: M.SENSIBLES, update: M.SENSIBLES });
    assert.deepStrictEqual(M.camposQueLasReglasDejanEscribir(leer('firestore.rules')), { create: [], update: [] });
  });
  it('quitarle la guardia al alta o al cambio lo pone a decirlo', () => {
    const r = leer('firestore.rules').replace(/\r\n/g, '\n'); // las reglas van con CRLF
    const sinAlta = cambiar(r, "&& !request.resource.data.keys().hasAny(['conductorId'])\n        && contactoFueraDelViajeNuevo();", "&& !request.resource.data.keys().hasAny(['conductorId']);");
    assert.deepStrictEqual(M.camposQueLasReglasDejanEscribir(sinAlta).create, M.SENSIBLES);
    const sinCambio = cambiar(r, '&& tarjetaIntacta()\n        && contactoNoEntraAlViaje();', '&& tarjetaIntacta();');
    assert.deepStrictEqual(M.camposQueLasReglasDejanEscribir(sinCambio).update, M.SENSIBLES);
  });
  it('el paquete: cuenta el correo y ve el teléfono armado dentro de mensajeria', () => {
    assert.deepStrictEqual(M.contactoEnElPaquete('x={pasajeroEmail:r.email,mensajeria:{queEnvia:g,recibeTel:b}}'), { pasajeroEmail: 1, telefonoEnElViaje: true, pasajeroFcmToken: 0 });
    assert.deepStrictEqual(M.contactoEnElPaquete('x={mensajeria:{queEnvia:g,nota:w}};kx(h,{recibeTel:e})'), { pasajeroEmail: 0, telefonoEnElViaje: false, pasajeroFcmToken: 0 });
  });
});

/** Un viaje GUARDADO de antes de P21: lleva el correo y (es un mandado) el teléfono de quien recibe dentro. */
const VIAJE_DE_ANTES = { ...MANDADO.antes, estado: 'aceptado', conductorId: 'taxi' };
async function sembrarFase2(entorno) {
  await sembrar(entorno, 'hoy');
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    await FS.setDoc(FS.doc(ctx.firestore(), 'viajes/deAntes'), VIAJE_DE_ANTES);
    // 79 de los 92 viajes de producción no llevan `mensajeria` (taxis de antes): la guardia no puede tropezar con eso.
    const { mensajeria, ...taxi } = VIAJE_DE_ANTES; // eslint-disable-line no-unused-vars
    await FS.setDoc(FS.doc(ctx.firestore(), 'viajes/taxiDeAntes'), { ...taxi, tipo: 'Taxi' });
  });
}
const V = (db, id) => FS.doc(db, 'viajes/' + id);
const nuevoHoy = () => ({ ...MANDADO.hoy, fechaSolicitud: new Date().toISOString() });
/** [quién, qué hace, (db) => promesa, ¿pasa hoy?] — con las reglas de la fase 1 (dca9179) TODAS pasan. */
const FASE2 = [
  ['ana', 'la app de hoy crea un mandado', (db) => FS.addDoc(FS.collection(db, 'viajes'), nuevoHoy()), true],
  ['ana', 'la app de hoy crea un taxi', (db) => FS.addDoc(FS.collection(db, 'viajes'), { ...nuevoHoy(), tipo: 'Taxi' }), true],
  ['ana', 'la pasajera amplía el radio de su mandado', (db) => FS.updateDoc(V(db, 'enEspera'), { radioBusqueda: 7 }), true],
  ['taxi', 'el conductor llega al punto de un viaje GUARDADO con correo y teléfono dentro', (db) => FS.updateDoc(V(db, 'deAntes'), { conductorEnPunto: true, fase: 'en_punto' }), true],
  ['taxi', 'el conductor finaliza ese viaje guardado', (db) => FS.updateDoc(V(db, 'deAntes'), { estado: 'finalizado', fase: 'finalizado' }), true],
  ['taxi', 'el conductor finaliza un taxi guardado SIN mensajeria', (db) => FS.updateDoc(V(db, 'taxiDeAntes'), { estado: 'finalizado', fase: 'finalizado' }), true],
  ['ana', 'la pasajera califica ese taxi guardado', (db) => FS.updateDoc(V(db, 'taxiDeAntes'), { calificadoPorPasajero: true, estrellas_pasajero: 5 }), true],
  ['ana', 'la pasajera cancela un viaje guardado (reenvía el viaje entero, igual)', (db) => FS.setDoc(V(db, 'deAntes'), { ...VIAJE_DE_ANTES, estado: 'cancelado' }), true],
  ['ana', 'la pasajera le quita el correo a su viaje guardado', (db) => FS.updateDoc(V(db, 'deAntes'), { pasajeroEmail: FS.deleteField() }), true],
  ['ana', 'NIEGA · una app VIEJA (7733a4f) crea el mandado con correo y teléfono dentro', (db) => FS.addDoc(FS.collection(db, 'viajes'), { ...MANDADO.antes, fechaSolicitud: new Date().toISOString() }), false],
  ['ana', 'NIEGA · crear con el correo', (db) => FS.addDoc(FS.collection(db, 'viajes'), { ...nuevoHoy(), pasajeroEmail: 'ana@correo.co' }), false],
  ['ana', 'NIEGA · crear con el token', (db) => FS.addDoc(FS.collection(db, 'viajes'), { ...nuevoHoy(), pasajeroFcmToken: 'tokAna' }), false],
  ['ana', 'NIEGA · crear con el teléfono de quien recibe', (db) => FS.addDoc(FS.collection(db, 'viajes'), { ...nuevoHoy(), mensajeria: { ...MANDADO.hoy.mensajeria, recibeTel: '3001112233' } }), false],
  ['ana', 'NIEGA · pegar el token en el viaje (lo que hacía la app vieja)', (db) => FS.updateDoc(V(db, 'enEspera'), { pasajeroFcmToken: 'tokAna' }), false],
  ['ana', 'NIEGA · ponerle el correo al viaje', (db) => FS.updateDoc(V(db, 'enEspera'), { pasajeroEmail: 'ana@correo.co' }), false],
  ['ana', 'NIEGA · ponerle el teléfono dentro de mensajeria', (db) => FS.updateDoc(V(db, 'enEspera'), { 'mensajeria.recibeTel': '3001112233' }), false],
  ['ana', 'NIEGA · reescribir mensajeria entera con el teléfono', (db) => FS.updateDoc(V(db, 'enEspera'), { mensajeria: { ...MANDADO.hoy.mensajeria, recibeTel: '3001112233' } }), false],
  ['ana', 'NIEGA · cambiar el teléfono de un viaje guardado', (db) => FS.updateDoc(V(db, 'deAntes'), { 'mensajeria.recibeTel': '3000000000' }), false],
  ['ana', 'NIEGA · cambiar el correo de un viaje guardado', (db) => FS.updateDoc(V(db, 'deAntes'), { pasajeroEmail: 'otro@correo.co' }), false],
  ['eladmin', 'NIEGA · el panel le pone el token a un viaje', (db) => FS.updateDoc(V(db, 'enEspera'), { pasajeroFcmToken: 'x' }), false],
];
describe('P22 · CAREO de las reglas del viaje: fase 1 (' + FASE1 + ') contra hoy, en el emulador', () => {
  before(async () => {
    entornos.fase1 = await RUT.initializeTestEnvironment({ projectId: 'demo-p22-fase1', firestore: { rules: execFileSync('git', ['show', FASE1 + ':firestore.rules'], { cwd: RAIZ, encoding: 'utf8' }), host: '127.0.0.1', port: require('./cargar.cjs').elEmulador().firestore } });
  });
  for (const [quien, que, hacer, hoy] of FASE2) {
    it(quien + ' · ' + que + ' → fase 1 pasa, hoy ' + (hoy ? 'pasa' : 'no'), async () => {
      for (const [cual, esperado] of [['fase1', true], ['hoy', hoy]]) {
        const e = entornos[cual];
        await sembrarFase2(e);
        const promesa = hacer(e.authenticatedContext(quien).firestore());
        if (esperado) await RUT.assertSucceeds(promesa); else await RUT.assertFails(promesa);
      }
    });
  }
});
