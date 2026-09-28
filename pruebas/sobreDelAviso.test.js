// ═══════════════════════════════════════════════════════════════════════════
//  EL SOBRE DE CADA AVISO AL CELULAR · gemelo G32, 28-sep-2026
//
//  Ocho sitios de guajirago/functions/index.js armaban el aviso a mano (título, cuerpo, sonido, canal, prioridad de
//  iPhone) y lo mandaban por su cuenta; solo uno miraba si Google lo había entregado. Ahora el sobre y el envío salen
//  de guajirago/functions/avisos.cjs, que SIEMPRE mira la respuesta y la anota en el registro.
//
//  Aquí se EJECUTA index.js ENTERO —cargado con una nube de mentira (Firestore en memoria y un mensajero que apunta
//  lo que Google recibiría)— y se enciende cada una de las 8 funciones que avisan:
//    1. el celular recibe EXACTAMENTE lo mismo que antes del arreglo (bb68c7f), token por token;
//    2. si un teléfono no recibe el aviso, el registro lo dice con el nombre de la función y el motivo;
//    3. nadie en index.js vuelve a mandar ni a armar un sobre por su cuenta (lo cuenta scripts/medir-sobres-de-aviso.cjs).
//
//  CAREO: `SOBRE_REF=bb68c7f node --test pruebas/sobreDelAviso.test.js` corre lo MISMO contra el index.js de ese
//  commit. Con el de antes, el bloque 1 pasa (el celular veía eso) y el 2 y el 3 se ponen rojos (nadie lo miraba).
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const Module = require('module');
const { execSync } = require('child_process');
const { leer } = require('./cargar.cjs');
const { cop } = require('../guajirago/functions/moneda.cjs');
const AVISOS = require('../guajirago/functions/avisos.cjs');
const { sitiosQueMandan, archivosDeLaNube } = require('../scripts/medir-sobres-de-aviso.cjs');

const RAIZ = path.resolve(__dirname, '..');
const DIR = path.join(RAIZ, 'guajirago', 'functions');
const REF = process.env.SOBRE_REF || '';

// ── La nube de mentira ─────────────────────────────────────────────────────
function baseDeMentira(datos) {
  const snap = (col, id) => {
    const d = (datos[col] || {})[id];
    return { id, exists: !!d, data: () => d, updateTime: { toMillis: () => Date.now() - 60 * 1000 } };
  };
  const ref = (col, id) => ({ col, id, get: async () => snap(col, id) });
  const consulta = (col, filtros) => ({
    where: (campo, op, valor) => consulta(col, [...filtros, [campo, valor]]),
    get: async () => {
      const docs = Object.keys(datos[col] || {}).map((id) => snap(col, id))
        .filter((s) => filtros.every(([c, v]) => s.data()[c] === v));
      return { size: docs.length, docs, forEach: (fn) => docs.forEach(fn) };
    },
  });
  return {
    collection: (col) => ({ doc: (id) => ref(col, id), where: (c, o, v) => consulta(col, [[c, v]]) }),
    getAll: async (...refs) => refs.map((r) => snap(r.col, r.id)),
  };
}

/** Lo que Google recibiría, un mensaje por token (así llega a cada celular), y los tokens que «fallan». */
function mensajeroDeMentira(fallan = {}) {
  const recibidos = [];
  const error = (codigo) => Object.assign(new Error('falló: ' + codigo), { code: codigo });
  return {
    recibidos,
    async send(m) {
      recibidos.push(m);
      if (fallan[m.token]) throw error(fallan[m.token]);
      return 'id';
    },
    async sendEachForMulticast({ tokens, ...resto }) {
      const responses = tokens.map((token) => {
        recibidos.push({ ...resto, token });
        return fallan[token] ? { success: false, error: error(fallan[token]) } : { success: true, messageId: 'id' };
      });
      const failureCount = responses.filter((r) => !r.success).length;
      return { responses, failureCount, successCount: responses.length - failureCount };
    },
  };
}

/** Carga index.js (el de hoy, o el de SOBRE_REF) con la nube de mentira, y deja a mano sus funciones internas. */
function cargarIndex(datos, fallan) {
  const mensajero = mensajeroDeMentira(fallan);
  const admin = { initializeApp() {}, firestore: () => baseDeMentira(datos), messaging: () => mensajero };
  const tal = (a, b) => (typeof b === 'function' ? b : a);
  class HttpsError extends Error {}
  const funciones = {
    'firebase-functions/v2/firestore': { onDocumentCreated: tal, onDocumentUpdated: tal },
    'firebase-functions/v2/https': { onCall: tal, HttpsError },
    'firebase-functions/v2/scheduler': { onSchedule: tal },
    'firebase-admin': admin,
  };
  const fuente = (REF ? execSync('git show ' + REF + ':guajirago/functions/index.js', { cwd: RAIZ }).toString()
    : leer('guajirago/functions/index.js'))
    + '\nmodule.exports.__internas = { avisarDelPedidoNuevo, avisarAlClienteDelCambio, avisarAlNegocio };\n';
  const archivo = path.join(DIR, 'index.js');
  const original = Module._load;
  Module._load = function (pedido, ...resto) {
    if (Object.prototype.hasOwnProperty.call(funciones, pedido)) return funciones[pedido];
    return original.call(this, pedido, ...resto);
  };
  try {
    const m = new Module(archivo, null);
    m.filename = archivo;
    m.paths = Module._nodeModulePaths(DIR);
    m._compile(fuente, archivo);
    return { fx: m.exports, mensajero };
  } finally {
    Module._load = original;
  }
}

/** Corre algo y devuelve lo que escribió en el registro (log, warn y error). */
async function conRegistro(hacer) {
  const lineas = [];
  const guardado = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(guardado)) console[k] = (...a) => lineas.push(k + ': ' + a.join(' '));
  try { return { valor: await hacer(), registro: lineas.join('\n') }; } finally { Object.assign(console, guardado); }
}

// ── Los datos y los 8 avisos ───────────────────────────────────────────────
const DATOS = {
  conductores: {
    C1: { activo: true, fcmToken: 'tokC1', ubicacion: { lat: 11.545, lng: -72.907 } },
    C2: { activo: true, fcmToken: 'tokC2' },
    C3: { activo: true, fcmToken: 'tokC3', ubicacion: { lat: 11.1, lng: -72.5 } }, // a ~60 km: no le toca
  },
  usuarios: { C1: { tipoVehiculo: 'Taxi' }, C2: { tipoVehiculo: 'Taxi' }, C3: { tipoVehiculo: 'Taxi' } },
  negociosPrivado: { R1: { fcmToken: 'tokR1' }, A1: { fcmToken: 'tokA1' }, N1: { fcmToken: 'tokN1' }, N2: {} },
  empleados: {
    E1: { restauranteId: 'R1', fcmToken: 'tokE1', roles: { recepcionista: true } },
    E2: { restauranteId: 'R1', fcmToken: 'tokE2', roles: { mesero: true } },
    E3: { restauranteId: 'R1', fcmToken: 'tokE3', activo: false, roles: { administrador: true } },
    E4: { restauranteId: 'A1', fcmToken: 'tokE4', roles: { administrador: true } },
  },
  viajes: { V1: { pasajeroFcmToken: 'tokP' } },
};
const VIAJE = { estado: 'esperando', tipo: 'Taxi', tarifa: '$ 8.000', tarifaValor: 8000, pasajeroLat: 11.544, pasajeroLng: -72.907, radioBusqueda: 3 };
const creado = (d, params = {}) => ({ data: { data: () => d }, params });
const cambiado = (antes, despues) => ({ data: { before: { data: () => antes }, after: { data: () => despues } } });

// Lo que el celular recibía ANTES del arreglo (bb68c7f), escrito tal cual lo armaba cada sitio de index.js.
const COMPLETO = (title, body, canal, despertar) => ({
  notification: { title, body },
  android: { priority: 'high', notification: canal ? { sound: 'default', channelId: canal } : { sound: 'default' } },
  apns: { payload: { aps: despertar ? { sound: 'default', badge: 1, contentAvailable: true } : { sound: 'default', badge: 1 } },
    headers: { 'apns-priority': '10' } },
});
const AVISOS_DE_ANTES = [
  { nombre: 'notificarNuevoViaje', tokens: ['tokC1', 'tokC2'],
    correr: (fx) => fx.notificarNuevoViaje(creado(VIAJE)),
    sobre: COMPLETO('🚖 Nuevo viaje disponible', 'Taxi — $ 8.000', 'viajes', true) },
  { nombre: 'notificarNuevaOferta', tokens: ['tokC1', 'tokC2'],
    correr: (fx) => fx.notificarNuevaOferta(cambiado(VIAJE, { ...VIAJE, tarifa: '$ 9.000', tarifaValor: 9000 })),
    sobre: COMPLETO('⬆️ El pasajero subió su oferta', 'Taxi — $ 9.000', 'viajes', false) },
  { nombre: 'notificarNuevoPedido', tokens: ['tokR1', 'tokE1'],
    correr: (fx) => fx.notificarNuevoPedido(creado({ tipo: 'domicilio', estado: 'nuevo', restauranteId: 'R1', cliente: 'Ana', total: 25000 })),
    sobre: COMPLETO('🍽️ Nuevo pedido a domicilio', 'Ana — ' + cop(25000), 'pedidos', true) },
  { nombre: 'notificarClienteDelPedido', tokens: ['tokCli'],
    correr: (fx) => fx.notificarClienteDelPedido(cambiado({ estado: 'nuevo' },
      { estado: 'confirmado', clienteFcmToken: 'tokCli', restauranteNombre: 'La Casa', tiempoEstimado: 20 })),
    sobre: COMPLETO('✅ Pedido confirmado', 'La Casa confirmó tu pedido · listo en ~20 min', null, false) },
  { nombre: 'notificarClienteDelPedido (cancelado)', funcion: 'notificarClienteDelPedido', tokens: ['tokCli'],
    correr: (fx) => fx.notificarClienteDelPedido(cambiado({ estado: 'preparando' },
      { estado: 'cancelado', clienteFcmToken: 'tokCli', motivoRechazo: 'sin gas' })),
    sobre: COMPLETO('❌ Pedido cancelado', 'Tu pedido en El restaurante fue cancelado: sin gas', null, false) },
  { nombre: 'notificarNuevaReserva', tokens: ['tokA1', 'tokE4'],
    correr: (fx) => fx.notificarNuevaReserva(creado({ estado: 'nueva', agenciaId: 'A1', cliente: 'Beto', nombreTour: 'Cabo de la Vela', total: 150000 })),
    sobre: COMPLETO('🧭 Nueva reserva', 'Beto reservó Cabo de la Vela — ' + cop(150000), 'pedidos', true) },
  { nombre: 'notificarClienteReserva', tokens: ['tokCliR'],
    correr: (fx) => fx.notificarClienteReserva(cambiado({ estado: 'nueva' },
      { estado: 'confirmada', clienteFcmToken: 'tokCliR', agenciaNombre: 'Wayuu Tours', nombreTour: 'Cabo', codigo: 'X12' })),
    sobre: COMPLETO('✅ Reserva confirmada', 'Wayuu Tours confirmó tu reserva de Cabo · código X12', null, false) },
  { nombre: 'notificarPasajeroOferta', tokens: ['tokP'],
    correr: (fx) => fx.notificarPasajeroOferta(creado({ conductorNombre: 'Luis', tipoOferta: 'contra', monto: '$ 9.500' }, { viajeId: 'V1' })),
    sobre: COMPLETO('🚕 Tienes una oferta de un conductor', 'Luis te ofrece $ 9.500', 'viajes', false) },
  { nombre: 'rutinaDeCobros', tokens: ['tokN1'],
    correr: (fx) => fx.__internas.avisarAlNegocio('N1', { titulo: 'Tu plan vence', texto: 'Paga antes del 5' }),
    sobre: { notification: { title: 'Tu plan vence', body: 'Paga antes del 5' } } },
];

describe('G32 · 1. el celular recibe EXACTAMENTE lo mismo que antes' + (REF ? ' [careo contra ' + REF + ']' : ''), () => {
  for (const a of AVISOS_DE_ANTES) {
    it(a.nombre + ': mismo título, cuerpo, sonido, canal y prioridad, a los mismos teléfonos', async () => {
      const { fx, mensajero } = cargarIndex(DATOS);
      await conRegistro(() => a.correr(fx));
      assert.deepStrictEqual(mensajero.recibidos, a.tokens.map((token) => ({ ...a.sobre, token })));
    });
  }
  it('lo que no es un cambio de estado ni un viaje buscando conductor sigue sin avisar a nadie', async () => {
    const { fx, mensajero } = cargarIndex(DATOS);
    await conRegistro(async () => {
      await fx.notificarNuevoViaje(creado({ ...VIAJE, estado: 'aceptado' }));
      await fx.notificarNuevaOferta(cambiado(VIAJE, { ...VIAJE }));
      await fx.notificarClienteDelPedido(cambiado({ estado: 'nuevo' }, { estado: 'nuevo', clienteFcmToken: 'tokCli' }));
      await fx.notificarNuevoPedido(creado({ tipo: 'local', estado: 'nuevo', restauranteId: 'R1' }));
      await fx.notificarClienteReserva(cambiado({ estado: 'nueva' }, { estado: 'rara', clienteFcmToken: 'tokCliR' }));
    });
    assert.deepStrictEqual(mensajero.recibidos, []);
  });
});

describe('G32 · 2. si el aviso no llega, el registro lo dice' + (REF ? ' [careo contra ' + REF + ']' : ''), () => {
  for (const a of AVISOS_DE_ANTES) {
    const funcion = a.funcion || a.nombre;
    it(a.nombre + ': con el último teléfono vencido, el registro nombra la función, cuántos no llegaron y el motivo', async () => {
      const ultimo = a.tokens[a.tokens.length - 1];
      const { fx, mensajero } = cargarIndex(DATOS, { [ultimo]: 'messaging/registration-token-not-registered' });
      const { registro } = await conRegistro(() => a.correr(fx));
      assert.strictEqual(mensajero.recibidos.length, a.tokens.length, 'a los demás les tiene que seguir llegando');
      assert.ok(registro.includes('aviso ' + funcion + ': 1 de ' + a.tokens.length + ' NO llegaron'),
        'el registro no dice que no llegó:\n' + registro);
      assert.ok(registro.includes('registration-token-not-registered'), 'el registro no dice por qué:\n' + registro);
      assert.ok(registro.includes('…' + ultimo.slice(-6)), 'el registro no nombra el token vencido:\n' + registro);
    });
    it(a.nombre + ': cuando llega a todos, el registro también lo dice', async () => {
      const { fx } = cargarIndex(DATOS);
      const { registro } = await conRegistro(() => a.correr(fx));
      assert.ok(registro.includes('aviso ' + funcion + ': llegó a ' + a.tokens.length + ' de ' + a.tokens.length),
        'el registro no dice que llegó:\n' + registro);
    });
  }
  it('el aviso al dueño del negocio (rutina de cobros) sigue devolviendo lo mismo: salió, rechazado o sin token', async () => {
    let r = cargarIndex(DATOS);
    assert.deepStrictEqual((await conRegistro(() => r.fx.__internas.avisarAlNegocio('N1', { titulo: 't', texto: 'x' }))).valor,
      { salio: true, porQue: '' });
    r = cargarIndex(DATOS, { tokN1: 'messaging/registration-token-not-registered' });
    assert.deepStrictEqual((await conRegistro(() => r.fx.__internas.avisarAlNegocio('N1', { titulo: 't', texto: 'x' }))).valor,
      { salio: false, porQue: 'su teléfono rechazó el aviso (token vencido)' });
    r = cargarIndex(DATOS);
    assert.deepStrictEqual((await conRegistro(() => r.fx.__internas.avisarAlNegocio('N2', { titulo: 't', texto: 'x' }))).valor,
      { salio: false, porQue: 'no tiene notificaciones activadas' });
    assert.deepStrictEqual(r.mensajero.recibidos, []);
  });
});

describe('G32 · 3. el sobre y el envío viven en UN sitio' + (REF ? ' [careo contra ' + REF + ']' : ''), () => {
  it('en guajirago/functions solo avisos.cjs manda avisos, y ese sitio mira la respuesta', () => {
    const { sitios, sobres } = sitiosQueMandan(archivosDeLaNube(REF || null));
    assert.deepStrictEqual(sitios.map((s) => s.archivo + ' ' + (s.revisa ? 'revisa' : 'NO revisa')),
      ['guajirago/functions/avisos.cjs revisa'], 'hay sitios que mandan por su cuenta: ' + JSON.stringify(sitios));
    assert.strictEqual(sobres, 1, 'hay ' + sobres + ' sobres armados a mano (apns:), tiene que haber 1 (el de avisos.cjs)');
  });
  it('cada admin.messaging() de index.js va directo a mandarAviso', () => {
    const t = leer('guajirago/functions/index.js');
    const todos = (t.match(/admin\.messaging\(\)/g) || []).length;
    const bien = (t.match(/mandarAviso\(admin\.messaging\(\),/g) || []).length;
    assert.ok(todos > 0 && todos === bien, todos + ' admin.messaging() y solo ' + bien + ' van a mandarAviso');
  });
  it('el medidor no se puede ablandar: con el código de antes cuenta 8 sitios, 7 sobres y 1 que revisa', () => {
    const viejo = [{ f: 'index.js', t: [
      'await admin.messaging().sendEachForMulticast({ tokens,', '  apns: {} });',
      'await admin.messaging().send({ token, apns: {} });',
      'const r = await admin.messaging().sendEachForMulticast({ tokens: [t] });', 'if (r.failureCount > 0) {}',
    ].join('\n') }];
    const { sitios, sobres } = sitiosQueMandan(viejo);
    assert.deepStrictEqual(sitios.map((s) => s.como + ':' + s.revisa),
      ['sendEachForMulticast:false', 'send:false', 'sendEachForMulticast:true']);
    assert.strictEqual(sobres, 2);
  });
});

describe('G32 · 4. la pieza avisos.cjs por dentro', () => {
  it('sin tokens no llama a Google y lo dice', async () => {
    const m = mensajeroDeMentira();
    const { valor, registro } = await conRegistro(() => AVISOS.mandarAviso(m, [null, ''], AVISOS.sobreSencillo('a', 'b'), 'x'));
    assert.deepStrictEqual(valor, { total: 0, llegaron: 0, fallaron: 0, vencidos: [], motivos: [] });
    assert.deepStrictEqual(m.recibidos, []);
    assert.ok(registro.includes('aviso x: no hay a quién mandarlo'));
  });
  it('cuenta los que llegan y los que no, y separa los vencidos de los otros fallos', async () => {
    const m = mensajeroDeMentira({ b: 'messaging/invalid-registration-token', c: 'messaging/internal-error' });
    const { valor } = await conRegistro(() => AVISOS.mandarAviso(m, ['a', 'b', 'c'], AVISOS.sobreSencillo('t', 'x'), 'x'));
    assert.deepStrictEqual(valor, { total: 3, llegaron: 1, fallaron: 2, vencidos: ['b'],
      motivos: ['messaging/invalid-registration-token', 'messaging/internal-error'] });
  });
  it('un solo token (texto) vale igual que una lista de uno', async () => {
    const m = mensajeroDeMentira();
    await conRegistro(() => AVISOS.mandarAviso(m, 'uno', AVISOS.sobreSencillo('t', 'x'), 'x'));
    assert.deepStrictEqual(m.recibidos, [{ notification: { title: 't', body: 'x' }, token: 'uno' }]);
  });
  it('si Google revienta del todo, el error sube al catch de quien llama (no se traga)', async () => {
    const m = { sendEachForMulticast: async () => { throw new Error('sin red'); } };
    await assert.rejects(() => AVISOS.mandarAviso(m, ['a'], AVISOS.sobreSencillo('t', 'x'), 'x'), /sin red/);
  });
});
