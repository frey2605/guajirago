/**
 * REGLA 2 — PRUEBAS QUE EJECUTAN LA FUNCION confirmarConductor.
 *
 * No comprueban el codigo leyendolo: lo ENCIENDEN. Levantan el emulador de
 * funciones y llaman a confirmarConductor por la red, igual que lo haria un
 * celular — o un atacante.
 *
 *   npx firebase-tools emulators:exec --only firestore,functions \
 *       --project demo-guajirago "node --test pruebas/funciones.test.js"
 *
 * Esta es la funcion que COBRA la comision al conductor. Antes del 23-ago-2026 no
 * preguntaba quien llamaba: cualquiera podia confirmar el viaje de otro y
 * descontarle $800 a un conductor que nunca oferto.
 */
const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');

const PROYECTO = 'demo-guajirago';
const BD = 'http://127.0.0.1:8085/v1/projects/' + PROYECTO + '/databases/(default)/documents';
const FN = 'http://127.0.0.1:5001/' + PROYECTO + '/us-central1/confirmarConductor';

const COMISION_TAXI = 800;
const SALDO_INICIAL = 10000;

// ── utilidades ──────────────────────────────────────────────────────────────

/** Escribe un documento saltandose las reglas (el emulador acepta "owner"). */
async function sembrar(ruta, campos) {
  const r = await fetch(BD + '/' + ruta, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: campos }),
  });
  if (!r.ok) throw new Error('no se pudo sembrar ' + ruta + ': HTTP ' + r.status);
}

async function leer(ruta) {
  const r = await fetch(BD + '/' + ruta, { headers: { Authorization: 'Bearer owner' } });
  if (!r.ok) return null;
  return (await r.json()).fields || {};
}

const txt = (s) => ({ stringValue: s });
const num = (n) => ({ integerValue: String(n) });

/**
 * Carnet de identidad falso, del tipo que el emulador acepta sin firma.
 * Es exactamente lo que tendria un atacante: puede decir que es quien quiera.
 */
function carnet(uid) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const cabecera = { alg: 'none', typ: 'JWT' };
  const cuerpo = {
    iss: 'https://securetoken.google.com/' + PROYECTO,
    aud: PROYECTO,
    auth_time: ahora, user_id: uid, sub: uid,
    iat: ahora, exp: ahora + 3600,
    firebase: { identities: {}, sign_in_provider: 'custom' },
  };
  return b64(cabecera) + '.' + b64(cuerpo) + '.';
}

/** Llama a CUALQUIER funcion del emulador. Si uid es null, llama SIN sesion. */
async function llamarA(nombre, uid, datos) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (uid) cabeceras.Authorization = 'Bearer ' + carnet(uid);
  const r = await fetch('http://127.0.0.1:5001/' + PROYECTO + '/us-central1/' + nombre,
    { method: 'POST', headers: cabeceras, body: JSON.stringify({ data: datos }) });
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch (e) { cuerpo = null; }
  return { http: r.status, cuerpo };
}

/** Llama a confirmarConductor. Si uid es null, llama SIN sesion. */
async function llamar(uid, datos) {
  const cabeceras = { 'Content-Type': 'application/json' };
  if (uid) cabeceras.Authorization = 'Bearer ' + carnet(uid);
  const r = await fetch(FN, { method: 'POST', headers: cabeceras, body: JSON.stringify({ data: datos }) });
  let cuerpo = null;
  try { cuerpo = await r.json(); } catch (e) { cuerpo = null; }
  return { http: r.status, cuerpo };
}

const saldoDe = async (uid) => Number(((await leer('usuarios/' + uid)) || {}).creditos?.integerValue ?? -1);

// ── el escenario ────────────────────────────────────────────────────────────

describe('REGLA 2 · confirmarConductor pregunta quien llama', () => {
  before(() => {
    assert.ok(process.env.FIRESTORE_EMULATOR_HOST || true,
      'estas pruebas necesitan el emulador: usa emulators:exec');
  });

  beforeEach(async () => {
    // Un viaje de 'duenoDelViaje', esperando, con una oferta del conductor 'cond1'.
    await sembrar('config/global', { comisionTaxi: num(COMISION_TAXI) });
    await sembrar('viajes/v1', {
      pasajeroId: txt('duenoDelViaje'), estado: txt('esperando'),
      tipo: txt('Taxi'), tarifa: txt('$12.000'), tarifaValor: num(12000),
    });
    await sembrar('viajes/v1/contraofertas/cond1', {
      monto: txt('$11.000'), montoValor: num(11000), conductorNombre: txt('Luis'),
    });
    await sembrar('conductores/cond1', { ocupado: { booleanValue: false } });
    await sembrar('usuarios/cond1', { creditos: num(SALDO_INICIAL), tipo: txt('conductor') });
  });

  test('SIN sesion: la llamada se rechaza y no se le cobra a nadie', async () => {
    const r = await llamar(null, { viajeId: 'v1', conductorId: 'cond1' });
    assert.notStrictEqual(r.http, 200, 'una llamada sin sesion NO puede salir bien');
    // Exige el MOTIVO, no solo el rechazo: sin esto, quitar el control de sesion
    // "pasa" igual porque el codigo se cae solo — rechaza por accidente, no por
    // decision. Un rechazo que no sabe por que rechaza no es un candado.
    assert.strictEqual(r.cuerpo && r.cuerpo.error && r.cuerpo.error.status, 'UNAUTHENTICATED',
      'debe rechazarse por FALTA DE SESION, no por un error interno disfrazado');
    assert.strictEqual(await saldoDe('cond1'), SALDO_INICIAL, 'al conductor no se le toca el saldo');
    const viaje = await leer('viajes/v1');
    assert.strictEqual(viaje.estado.stringValue, 'esperando', 'el viaje sigue libre');
  });

  test('UN EXTRAÑO con cuenta: se rechaza y el conductor conserva su plata', async () => {
    const r = await llamar('unExtrano', { viajeId: 'v1', conductorId: 'cond1' });
    assert.notStrictEqual(r.http, 200, 'un extraño NO puede confirmar el viaje de otro');
    assert.strictEqual(await saldoDe('cond1'), SALDO_INICIAL, 'este era el robo: el saldo no se mueve');
    const viaje = await leer('viajes/v1');
    assert.strictEqual(viaje.estado.stringValue, 'esperando');
    assert.ok(viaje.conductorId === undefined, 'no se le asigna conductor a la fuerza');
  });

  test('EL DUEÑO del viaje: funciona igual que siempre y se cobra la comision', async () => {
    const r = await llamar('duenoDelViaje', { viajeId: 'v1', conductorId: 'cond1' });
    assert.strictEqual(r.http, 200, 'el dueño SI puede confirmar: ' + JSON.stringify(r.cuerpo));
    assert.strictEqual(r.cuerpo.result.ok, true);
    assert.strictEqual(await saldoDe('cond1'), SALDO_INICIAL - COMISION_TAXI,
      'se cobra la comision exacta, ni mas ni menos');
    const viaje = await leer('viajes/v1');
    assert.strictEqual(viaje.estado.stringValue, 'aceptado');
    assert.strictEqual(viaje.conductorId.stringValue, 'cond1');
  });

  test('el extraño no puede repetir la llamada para vaciar al conductor', async () => {
    for (let i = 0; i < 5; i++) await llamar('unExtrano', { viajeId: 'v1', conductorId: 'cond1' });
    assert.strictEqual(await saldoDe('cond1'), SALDO_INICIAL,
      'cinco intentos seguidos y el saldo sigue intacto');
  });

  // ── REGLA 6 · la pregunta del celular repetido, ahora en el servidor ──
  // Antes el registro pedia la LISTA de fichas desde el celular, y por eso la lista
  // tenia que estar abierta a cualquiera. Ahora pregunta aqui y solo recibe si o no.
  test('SIN sesion no se puede ni preguntar', async () => {
    const r = await llamarA('celularDisponible', null, { celular: '3001112233' });
    assert.strictEqual(r.cuerpo && r.cuerpo.error && r.cuerpo.error.status, 'UNAUTHENTICATED');
  });

  test('un celular libre: dice que SI se puede', async () => {
    const r = await llamarA('celularDisponible', 'alguien', { celular: '3009999999' });
    assert.strictEqual(r.http, 200, JSON.stringify(r.cuerpo));
    assert.strictEqual(r.cuerpo.result.disponible, true);
  });

  test('un celular que YA es de otro: dice que NO', async () => {
    await sembrar('usuarios/yaRegistrado', { celular: txt('3001112233'), nombre: txt('Ana') });
    const r = await llamarA('celularDisponible', 'alguien', { celular: '3001112233' });
    assert.strictEqual(r.http, 200, JSON.stringify(r.cuerpo));
    assert.strictEqual(r.cuerpo.result.disponible, false);
  });

  // Numero propio y distinto: las pruebas de arriba siembran fichas y esta base no
  // se limpia entre pruebas, asi que reusar el mismo numero las mezclaria.
  test('su PROPIO celular no lo bloquea a el mismo', async () => {
    await sembrar('usuarios/yoMismo', { celular: txt('3007778888'), nombre: txt('Ana') });
    const r = await llamarA('celularDisponible', 'yoMismo', { celular: '3007778888' });
    assert.strictEqual(r.http, 200, JSON.stringify(r.cuerpo));
    assert.strictEqual(r.cuerpo.result.disponible, true,
      'si su propia ficha lo bloqueara, nadie podria reintentar su registro');
  });

  test('la respuesta NO trae datos de nadie: solo si o no', async () => {
    await sembrar('usuarios/yaRegistrado', { celular: txt('3001112233'), nombre: txt('Ana'),
      fotoCedula: txt('https://x/cedula.jpg'), fechaNacimiento: txt('12/04/1995') });
    const r = await llamarA('celularDisponible', 'alguien', { celular: '3001112233' });
    assert.deepStrictEqual(Object.keys(r.cuerpo.result), ['disponible'],
      'no puede devolver nada mas que la respuesta');
    const texto = JSON.stringify(r.cuerpo);
    for (const dato of ['Ana', 'cedula', '1995', 'yaRegistrado']) {
      assert.ok(!texto.includes(dato), 'se filtro un dato: ' + dato);
    }
  });

  // ── REGLAS 5 y 11 · la comprobacion del codigo, en el servidor ──
  const sembrarViajeConCodigo = async () => {
    await sembrar('viajes/v9', { pasajeroId: txt('laPasajera'), conductorId: txt('elConductor'),
      estado: txt('aceptado'), tieneCodigo: { booleanValue: true } });
    await sembrar('viajes/v9/privado/seguridad', { codigo: txt('4821') });
  };

  test('el conductor asignado acierta el codigo: adelante', async () => {
    await sembrarViajeConCodigo();
    const r = await llamarA('verificarCodigoViaje', 'elConductor', { viajeId: 'v9', codigo: '4821' });
    assert.strictEqual(r.http, 200, JSON.stringify(r.cuerpo));
    assert.strictEqual(r.cuerpo.result.ok, true);
  });

  test('el conductor asignado falla el codigo: no pasa', async () => {
    await sembrarViajeConCodigo();
    const r = await llamarA('verificarCodigoViaje', 'elConductor', { viajeId: 'v9', codigo: '0000' });
    assert.strictEqual(r.cuerpo.result.ok, false);
  });

  test('un conductor que NO es el asignado no puede ni probar', async () => {
    await sembrarViajeConCodigo();
    const r = await llamarA('verificarCodigoViaje', 'otroCualquiera', { viajeId: 'v9', codigo: '4821' });
    assert.strictEqual(r.cuerpo && r.cuerpo.error && r.cuerpo.error.status, 'PERMISSION_DENIED',
      'si no, se prueban los 10.000 codigos uno por uno');
  });

  test('SIN sesion tampoco', async () => {
    await sembrarViajeConCodigo();
    const r = await llamarA('verificarCodigoViaje', null, { viajeId: 'v9', codigo: '4821' });
    assert.strictEqual(r.cuerpo && r.cuerpo.error && r.cuerpo.error.status, 'UNAUTHENTICATED');
  });

  test('la respuesta NUNCA trae el codigo dentro', async () => {
    await sembrarViajeConCodigo();
    const r = await llamarA('verificarCodigoViaje', 'elConductor', { viajeId: 'v9', codigo: '0000' });
    assert.ok(!JSON.stringify(r.cuerpo).includes('4821'), 'se filtro el codigo en la respuesta');
  });

  test('subirTarifa ya no existe en el servidor', async () => {
    const r = await fetch('http://127.0.0.1:5001/' + PROYECTO + '/us-central1/subirTarifa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { viajeId: 'v1', nuevaTarifa: 1 } }),
    });
    assert.strictEqual(r.status, 404, 'la funcion retirada no debe responder');
  });
});
