/**
 * P23 · ¿A QUÉ TOKEN LE AVISA EL SERVIDOR AL PASAJERO? (1-oct-2026)
 *
 * Medido el 1-oct-2026 con scripts/medir-token-pasajero.cjs: en producción hay DOS avisos al pasajero, y cada uno
 * buscaba su token en un sitio distinto: «tienes una oferta» (notificarPasajeroOferta) en el cajón del viaje, que es
 * donde lo pegaba la app, y «¡tu conductor llegó!» (notificarConductorEnPunto, publicada en junio y sin código en este
 * repo) en la ficha del pasajero, usuarios/{uid}.fcmToken, que NADIE llenaba (0 de 10 fichas). Además, si el pasajero
 * no daba permiso de avisos, nadie se lo decía.
 *
 * Desde P23 el token del pasajero vive en SU FICHA (una sola fuente), el servidor pregunta «¿a qué token le aviso?» a
 * UNA pieza (guajirago/functions/tokenDelPasajero.cjs), y si el pasajero no da permiso le sale la misma ventanita que
 * al conductor (avisoDeAvisos de Notificaciones.js), con su texto.
 *
 * Esta prueba:
 *   1. EJECUTA la pieza del servidor: la ficha manda; los viajes de antes siguen avisando por el cajón o el viaje;
 *   2. corre el SERVIDOR (index.js con la nube de mentira) y CAREA el de antes (2f7efd3) con el de hoy;
 *   3. EJECUTA la cadena de la pantalla de pedir (sacada de Solicitar.js) y la ventanita (sacada de Notificaciones.js);
 *   4. que el MEDIDOR no se ablanda;
 *   5. CAREA en el emulador las reglas: la pasajera puede pegar su token en su ficha, nadie más puede ni leerlo.
 *   El robot no puede dar permiso de avisos: por eso esto se prueba aquí, ejecutándolo.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { leer, soloCodigo, RAIZ } = require('./cargar.cjs');
const NUBE = require('./nubeDeMentira.cjs');
const M = require('../scripts/medir-token-pasajero.cjs');
const { elTokenDelPasajero, tokenDelPasajero } = require('../guajirago/functions/tokenDelPasajero.cjs');

const ANTES = '2f7efd3';
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 << 20 });
const HOY = { solicitar: leer('guajirago/src/Solicitar.js'), index: leer('guajirago/functions/index.js'), pieza: leer('guajirago/functions/tokenDelPasajero.cjs').replace(/\r\n/g, '\n') };
const VIEJO = { solicitar: deAntes('guajirago/src/Solicitar.js'), index: deAntes('guajirago/functions/index.js') };
// Cómo lee el token el aviso «¡tu conductor llegó!» PUBLICADO (bajado del servidor el 1-oct-2026; su código no está en
// el repo). Es lo que el medidor vuelve a bajar con la red; aquí va el trozo, para poder probar sin red.
const EN_PUNTO_PUBLICADA = 'exports.notificarConductorEnPunto = onDocumentUpdated("viajes/{viajeId}", async (event) => {\n'
  + '  const usuarioSnap = await admin.firestore().collection("usuarios").doc(pasajeroId).get();\n'
  + '  const fcmToken = usuarioSnap.data().fcmToken;\n});\n';

// ── 1. LA PIEZA DEL SERVIDOR, EJECUTADA ──
describe('P23 · tokenDelPasajero: la ficha manda, los viajes de antes siguen avisando', () => {
  it('con la ficha, su token; sin ficha, el del cajón; sin cajón, el del viaje; sin nada, null', () => {
    const ficha = { fcmToken: 'tokFicha' };
    const contacto = { pasajeroFcmToken: 'tokCajon' };
    const viaje = { pasajeroFcmToken: 'tokViaje' };
    assert.strictEqual(elTokenDelPasajero({ ficha, contacto, viaje }), 'tokFicha');
    assert.strictEqual(elTokenDelPasajero({ ficha: {}, contacto, viaje }), 'tokCajon');
    assert.strictEqual(elTokenDelPasajero({ ficha: { fcmToken: '' }, contacto: {}, viaje }), 'tokViaje');
    assert.strictEqual(elTokenDelPasajero({}), null);
    assert.strictEqual(elTokenDelPasajero(), null);
    assert.strictEqual(elTokenDelPasajero({ ficha: { fcmToken: 7 } }), null, 'un token que no es texto no sirve');
  });
  it('lee la ficha DEL PASAJERO DEL VIAJE (no otra), y un id raro no abre otra ruta', async () => {
    const db = NUBE.baseDeMentira({ usuarios: { ana: { fcmToken: 'tokAna' }, beto: { fcmToken: 'tokBeto' } } });
    assert.strictEqual(await tokenDelPasajero(db, 'V1', { pasajeroId: 'ana' }), 'tokAna');
    assert.strictEqual(await tokenDelPasajero(db, 'V1', { pasajeroId: 'beto' }), 'tokBeto');
    assert.strictEqual(await tokenDelPasajero(db, 'V1', { pasajeroId: 'usuarios/beto' }), null);
    assert.strictEqual(await tokenDelPasajero(db, 'V1', {}), null);
  });
});

// ── 2. EL SERVIDOR, EJECUTADO (y el careo antes/después) ──
const creado = (d, params = {}) => ({ data: { data: () => d }, params });
const OFERTA = creado({ conductorNombre: 'Luis', tipoOferta: 'contra', monto: '$ 9.500' }, { viajeId: 'V1' });
async function aQuienLeLlega(datos, ref) {
  const { fx, mensajero } = NUBE.cargarIndex(datos, {}, ref);
  await NUBE.conRegistro(() => fx.notificarPasajeroOferta(OFERTA));
  return mensajero.recibidos.map((r) => r.token);
}
const CON_FICHA = { viajes: { V1: { estado: 'esperando', pasajeroId: 'ana' } }, usuarios: { ana: { fcmToken: 'tokAna' } } };
describe('P23 · «tienes una oferta» le llega al token de la ficha', () => {
  it('HOY: con el token en la ficha (lo que pega la app desde P23), le llega; ANTES (2f7efd3) no le llegaba', async () => {
    assert.deepStrictEqual(await aQuienLeLlega(CON_FICHA), ['tokAna']);
    assert.deepStrictEqual(await aQuienLeLlega(CON_FICHA, ANTES), [], 'el careo ya no enseña la diferencia');
  });
  it('un viaje de antes (cajón o viaje) le sigue llegando igual que antes', async () => {
    for (const datos of [
      { viajes: { V1: { pasajeroId: 'ana' } }, 'viajes/V1/contacto': { pasajero: { pasajeroFcmToken: 'tokCajon' } } },
      { viajes: { V1: { pasajeroId: 'ana', pasajeroFcmToken: 'tokViejo' } } },
    ]) assert.deepStrictEqual(await aQuienLeLlega(datos), await aQuienLeLlega(datos, ANTES));
  });
  it('si están la ficha y el cajón, manda la ficha (la fuente de hoy); sin ninguno, no avisa; sin viaje, tampoco', async () => {
    assert.deepStrictEqual(await aQuienLeLlega({ ...CON_FICHA, 'viajes/V1/contacto': { pasajero: { pasajeroFcmToken: 'tokCajon' } } }), ['tokAna']);
    assert.deepStrictEqual(await aQuienLeLlega({ viajes: { V1: { pasajeroId: 'ana' } }, usuarios: { ana: {} } }), []);
    assert.deepStrictEqual(await aQuienLeLlega({ viajes: {}, usuarios: { ana: { fcmToken: 'tokAna' } } }), []);
  });
  it('el sobre del aviso no cambió: el mismo título y el mismo texto que antes', async () => {
    const datos = { viajes: { V1: { pasajeroId: 'ana', pasajeroFcmToken: 'tokViejo' } } };
    const sobre = async (ref) => {
      const { fx, mensajero } = NUBE.cargarIndex(datos, {}, ref);
      await NUBE.conRegistro(() => fx.notificarPasajeroOferta(OFERTA));
      return JSON.stringify(mensajero.recibidos);
    };
    assert.strictEqual(await sobre(), await sobre(ANTES));
  });
  it('el aviso usa la pieza y no lee el token por su cuenta', () => {
    const trozo = soloCodigo(M.trozoDe(HOY.index, 'notificarPasajeroOferta'));
    assert.match(trozo, /tokenDelPasajero\(admin\.firestore\(\), event\.params\.viajeId, viajeSnap\.data\(\)\)/);
    assert.ok(!/FcmToken|fcmToken/.test(trozo), 'notificarPasajeroOferta vuelve a leer un token a mano');
  });
});

// ── 3. LA PANTALLA DE PEDIR Y LA VENTANITA, EJECUTADAS ──
const NOTIF = leer('guajirago/src/Notificaciones.js').replace(/\r\n/g, '\n');
const trozoAvisos = (t) => t.slice(t.indexOf('export const permisoDeAvisos'), t.indexOf('// Callback para mostrar'));
const piezasDe = (t) => new Function('Notification', trozoAvisos(t).replace(/^export\s+/gm, '') + '\nreturn { avisoDeAvisos };')(undefined);
const { avisoDeAvisos } = piezasDe(NOTIF);

/** La cadena de Solicitar.js que pega el token en la ficha y, si no quedó, enseña la ventanita. Sacada y ejecutada. */
function cadenaDeLaPantalla(textoSolicitar) {
  const t = soloCodigo(textoSolicitar).replace(/\r\n/g, '\n');
  const i = t.indexOf("const fichaRef = doc(db, 'usuarios', user.uid);");
  assert.ok(i >= 0, 'Solicitar.js ya no arma la ficha del pasajero para pegarle el token');
  const desde = t.indexOf('pegarToken(fichaRef)', i);
  assert.ok(desde >= 0, 'Solicitar.js ya no pega el token en la ficha');
  // La llamada entera: pegarToken(fichaRef).then((…) => { … }); — hasta el `});` que la cierra.
  const codigo = t.slice(i, t.indexOf('});', desde) + 3);
  return async ({ pegado, permiso, abierto = null }) => {
    let aviso = abierto;
    const llamadas = [];
    const escritas = [];
    const pegarToken = (ref) => { escritas.push(ref); return Promise.resolve(pegado); };
    const setAviso = (f) => { llamadas.push(1); aviso = typeof f === 'function' ? f(aviso) : f; };
    const doc = (db, col, id) => col + '/' + id;
    new Function('doc', 'db', 'user', 'pegarToken', 'avisoDeAvisos', 'permisoDeAvisos', 'setAviso', codigo)(
      doc, {}, { uid: 'ana' }, pegarToken, avisoDeAvisos, () => permiso, setAviso);
    await new Promise((r) => setTimeout(r, 0));
    return { aviso, llamadas: llamadas.length, escritas };
  };
}

describe('P23 · la pantalla de pedir: el token a la ficha y, si no hay permiso, la ventanita', () => {
  const correr = cadenaDeLaPantalla(HOY.solicitar);
  it('el token se pega en la ficha de quien pide (usuarios/su uid), una vez', async () => {
    assert.deepStrictEqual((await correr({ pegado: true, permiso: 'granted' })).escritas, ['usuarios/ana']);
  });
  it('quedó pegado: no sale nada', async () => {
    const r = await correr({ pegado: true, permiso: 'granted' });
    assert.strictEqual(r.aviso, null);
  });
  it('bloqueado, sin contestar o sin soporte: sale la ventanita del pasajero', async () => {
    for (const permiso of ['denied', 'default', 'no-soportado']) {
      const r = await correr({ pegado: false, permiso });
      assert.deepStrictEqual(r.aviso, avisoDeAvisos(permiso, 'pasajero'), permiso);
      assert.match(r.aviso.titulo, /ofertas/);
    }
  });
  it('con permiso pero sin pegarse (falló la escritura): no se le echa la culpa al permiso', async () => {
    assert.strictEqual((await correr({ pegado: false, permiso: 'granted' })).aviso, null);
  });
  it('no tapa otra ventanita que ya esté abierta', async () => {
    const otra = { titulo: 'Conductor ocupado', texto: 'x' };
    assert.strictEqual((await correr({ pegado: false, permiso: 'denied', abierto: otra })).aviso, otra);
  });
  it('el cartel de permiso se prepara ANTES de crear el viaje, con el campo de la ficha', () => {
    const t = soloCodigo(HOY.solicitar);
    const prep = t.indexOf("const pegarToken = prepararTokenDeAvisos('fcmToken');");
    assert.ok(prep > 0 && prep < t.indexOf("const docRef = await addDoc(collection(db, 'viajes')"), 'el cartel sale tarde o con otro campo');
  });
});

describe('P23 · la ventanita del pasajero (la misma pieza que la del conductor)', () => {
  it('con permiso no sale; los tres casos dicen lo suyo, en español y sin palabras técnicas', () => {
    assert.strictEqual(avisoDeAvisos('granted', 'pasajero'), null);
    const textos = new Set();
    for (const p of ['denied', 'default', 'no-soportado']) {
      const a = avisoDeAvisos(p, 'pasajero');
      assert.ok(a && a.icono && a.titulo && a.texto.length > 40, 'sin ventanita para ' + p);
      assert.ok(!/\b(FCM|token|permission|denied|granted|default|push)\b/i.test(a.titulo + ' ' + a.texto), a.texto);
      assert.match(a.texto, /oferta/);
      assert.ok(!/sonar los viajes|viajes nuevos/.test(a.titulo + a.texto), 'le habla al pasajero como a un conductor');
      textos.add(a.texto);
    }
    assert.strictEqual(textos.size, 3);
  });
  it('la del conductor quedó IDÉNTICA a la de antes de P23', () => {
    const vieja = piezasDe(deAntes('guajirago/src/Notificaciones.js').replace(/\r\n/g, '\n')).avisoDeAvisos;
    for (const p of ['granted', 'denied', 'default', 'no-soportado']) assert.deepStrictEqual(avisoDeAvisos(p), vieja(p), p);
  });
});

// ── 4. EL MEDIDOR NO SE ABLANDA ──
describe('P23 · el medidor del token del pasajero no se ablanda', () => {
  const avisosDe = (t) => [
    { nombre: 'notificarPasajeroOferta', sitios: M.dondeBuscaElServidor(M.trozoDe(t.index, 'notificarPasajeroOferta'), t.pieza || '') },
    { nombre: 'notificarConductorEnPunto', sitios: M.dondeBuscaElServidor(EN_PUNTO_PUBLICADA) },
  ];
  const medir = (t) => M.veredicto({ app: M.dondePegaLaApp(t.solicitar), avisos: avisosDe(t), ventanita: M.avisaSinPermiso(t.solicitar) });
  it('lo de antes (2f7efd3) sale rojo: «tu conductor llegó» no llega nunca, y nadie avisa sin permiso', () => {
    assert.strictEqual(M.dondePegaLaApp(VIEJO.solicitar).donde, 'contacto');
    const v = medir(VIEJO);
    assert.strictEqual(v.length, 2, v.join('\n'));
    assert.match(v[0], /notificarConductorEnPunto.*NO LLEGA NUNCA/);
    assert.match(v[1], /nadie se lo dice/);
  });
  it('lo de hoy sale limpio, y el servidor mira la ficha PRIMERO', () => {
    assert.deepStrictEqual(medir(HOY), []);
    assert.deepStrictEqual(M.dondePegaLaApp(HOY.solicitar), { donde: 'ficha', campo: 'fcmToken' });
    assert.deepStrictEqual(avisosDe(HOY)[0].sitios, ['ficha', 'contacto', 'viaje']);
  });
  const cambiar = (texto, que, por) => {
    const n = texto.split(que).length - 1;
    assert.strictEqual(n, 1, 'el texto «' + que + '» aparece ' + n + ' veces');
    return texto.replace(que, por);
  };
  it('pegar el token en el viaje del mercado lo pone rojo', () => {
    const s = cambiar(HOY.solicitar, 'pegarToken(fichaRef)', 'pegarToken(docRef)');
    assert.match(medir({ ...HOY, solicitar: s }).join('\n'), /viaje del mercado|NO LLEGA NUNCA/);
  });
  it('quitar la ventanita lo pone rojo', () => {
    const s = cambiar(HOY.solicitar, "avisoDeAvisos(permisoDeAvisos(), 'pasajero')", 'null');
    assert.match(medir({ ...HOY, solicitar: s }).join('\n'), /nadie se lo dice/);
  });
  it('que el servidor deje de mirar la ficha lo pone rojo', () => {
    const p = cambiar(HOY.pieza, 'idSano ? db.collection("usuarios").doc(uid).get() : null', 'null');
    const v = medir({ ...HOY, pieza: p.replace('sirve(ficha && ficha.fcmToken)\n    || ', '') });
    assert.match(v.join('\n'), /notificarPasajeroOferta.*NO LLEGA NUNCA/);
  });
  it('las cuentas de los datos separan los viajes de antes del código', () => {
    const d = M.contarDatos(
      [{ id: 'a', fechaSolicitud: '2026-07-01T10:00:00Z', pasajeroId: 'ana' },
        { id: 'b', fechaSolicitud: '2026-09-23T10:00:00Z', pasajeroId: 'ana' },
        { id: 'c', fechaSolicitud: '2026-10-01T10:00:00Z', pasajeroId: 'beto', pasajeroFcmToken: 't' }],
      { b: { pasajeroFcmToken: 't2' } },
      [{ id: 'ana', fcmToken: 'x' }, { id: 'beto' }, { id: 'carla', fcmToken: '' }]);
    assert.deepStrictEqual(d, { viajes: 3, antesDelCodigo: 1, despuesDelCodigo: 2, conToken: 2, despuesConToken: 2, conCajon: 1, fichas: 3, fichasConToken: 1, pasajeros: 2, pasajerosConTokenEnFicha: 1 });
  });
});

// ── 5. LAS REGLAS, EN EL EMULADOR ──
let RUT;
let FS;
let entorno;
before(async () => {
  const { elEmulador } = require('./cargar.cjs');
  RUT = await import('@firebase/rules-unit-testing');
  FS = await import('firebase/firestore');
  entorno = await RUT.initializeTestEnvironment({ projectId: 'demo-p23', firestore: { rules: leer('firestore.rules'), host: '127.0.0.1', port: elEmulador().firestore } });
});
after(async () => { if (entorno) await entorno.cleanup(); });

describe('P23 · las reglas: el token en la ficha lo pega su dueña y no lo lee nadie más', () => {
  it('la pasajera lo pega en SU ficha; otro no puede escribirlo ni leerlo; el panel sí lo lee', async () => {
    await entorno.clearFirestore();
    await entorno.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await FS.setDoc(FS.doc(db, 'usuarios/ana'), { nombre: 'ANA', email: 'ana@gg.test' });
      await FS.setDoc(FS.doc(db, 'usuarios/eladmin'), { rol: 'admin' });
      await FS.setDoc(FS.doc(db, 'usuarios/taxi'), { tipo: 'conductor' });
    });
    const ana = entorno.authenticatedContext('ana').firestore();
    const taxi = entorno.authenticatedContext('taxi').firestore();
    const admin = entorno.authenticatedContext('eladmin').firestore();
    await RUT.assertSucceeds(FS.updateDoc(FS.doc(ana, 'usuarios/ana'), { fcmToken: 'tokAna' }));
    await RUT.assertSucceeds(FS.updateDoc(FS.doc(ana, 'usuarios/ana'), { fcmToken: 'tokAnaNuevo' }));
    await RUT.assertFails(FS.updateDoc(FS.doc(taxi, 'usuarios/ana'), { fcmToken: 'tokDelTaxi' }));
    await RUT.assertFails(FS.getDoc(FS.doc(taxi, 'usuarios/ana')));
    const leido = await RUT.assertSucceeds(FS.getDoc(FS.doc(admin, 'usuarios/ana')));
    assert.strictEqual(leido.data().fcmToken, 'tokAnaNuevo');
  });
});
