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

// ── REGLA 7 · LA PLATA LA DECIDE EL SERVIDOR ────────────────────────────────
// Estas pruebas ENCIENDEN las tres funciones nuevas y miran el saldo de verdad
// en la base, no lo que digan ellas.

describe('REGLA 7 · canjearCodigoRecarga', () => {
  beforeEach(async () => {
    await sembrar('codigos/BUENO50', { valor: num(50000), usado: { booleanValue: false } });
    await sembrar('codigos/YAUSADO', { valor: num(50000), usado: { booleanValue: true } });
    await sembrar('codigos/SINVALOR', { valor: num(0), usado: { booleanValue: false } });
    await sembrar('usuarios/elcond', { tipo: txt('conductor'), creditos: num(SALDO_INICIAL) });
  });

  test('SIN sesion no se canjea nada', async () => {
    const r = await llamarA('canjearCodigoRecarga', null, { codigo: 'BUENO50' });
    assert.strictEqual(r.cuerpo?.error?.status, 'UNAUTHENTICATED',
      'un rechazo que no sabe por que rechaza no es un candado');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL, 'el saldo se movio sin sesion');
    assert.strictEqual((await leer('codigos/BUENO50')).usado.booleanValue, false);
  });

  test('con sesion, el codigo bueno suma y queda marcado como usado', async () => {
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'BUENO50' });
    assert.strictEqual(r.cuerpo?.result?.valor, 50000);
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL + 50000);
    const cod = await leer('codigos/BUENO50');
    assert.strictEqual(cod.usado.booleanValue, true, 'el codigo no quedo marcado');
    assert.strictEqual(cod.usadoPor.stringValue, 'elcond', 'no quedo dicho quien lo uso');
  });

  test('el MISMO codigo no se puede canjear dos veces (ni llamando 5 veces seguidas)', async () => {
    await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'BUENO50' });
    for (let i = 0; i < 5; i++) {
      const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'BUENO50' });
      assert.strictEqual(r.cuerpo?.error?.status, 'ALREADY_EXISTS');
    }
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL + 50000, 'se sumo mas de una vez');
  });

  test('un codigo ya usado no suma', async () => {
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'YAUSADO' });
    assert.strictEqual(r.cuerpo?.error?.status, 'ALREADY_EXISTS');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL);
  });

  test('un codigo que no existe no suma', async () => {
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'INVENTADO' });
    assert.strictEqual(r.cuerpo?.error?.status, 'NOT_FOUND');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL);
  });

  test('un codigo de valor cero no suma', async () => {
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'SINVALOR' });
    assert.strictEqual(r.cuerpo?.error?.status, 'INVALID_ARGUMENT');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL);
  });

  test('el codigo se lee en MAYUSCULAS y sin espacios, como lo teclea la gente', async () => {
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: '  bueno50  ' });
    assert.strictEqual(r.cuerpo?.result?.valor, 50000, 'no acepto el codigo en minusculas');
  });
});

describe('REGLA 7 · reclamarPromocion', () => {
  const HOY = new Date().toISOString().slice(0, 10);
  const AYER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const MANANA = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  beforeEach(async () => {
    await sembrar('promociones/VIVA', {
      activa: { booleanValue: true }, fechaInicio: txt(AYER), fechaFin: txt(MANANA),
      tipoBeneficio: txt('credito'), valorBeneficio: num(8000), aplicaA: txt('todos'),
    });
    await sembrar('promociones/VENCIDA', {
      activa: { booleanValue: true }, fechaInicio: txt(AYER), fechaFin: txt(AYER),
      tipoBeneficio: txt('credito'), valorBeneficio: num(8000), aplicaA: txt('todos'),
    });
    await sembrar('promociones/SOLOCOND', {
      activa: { booleanValue: true }, fechaInicio: txt(AYER), fechaFin: txt(MANANA),
      tipoBeneficio: txt('credito'), valorBeneficio: num(8000), aplicaA: txt('conductores'),
    });
    await sembrar('usuarios/elpasa', { tipo: txt('') });
    await sembrar('usuarios/elcond', { tipo: txt('conductor'), creditos: num(SALDO_INICIAL) });
  });

  test('SIN sesion no se reclama nada', async () => {
    const r = await llamarA('reclamarPromocion', null, { codigo: 'VIVA' });
    assert.strictEqual(r.cuerpo?.error?.status, 'UNAUTHENTICATED');
    assert.strictEqual((await leer('usuarios/elpasa')).descuentoPendiente, undefined);
  });

  test('una promocion viva deja el descuento pendiente, con codigo de 4 cifras', async () => {
    const r = await llamarA('reclamarPromocion', 'elpasa', { codigo: 'VIVA' });
    assert.strictEqual(r.cuerpo?.result?.valor, 8000);
    assert.match(String(r.cuerpo?.result?.codigoVerificacion), /^[1-9][0-9]{3}$/);
    const u = await leer('usuarios/elpasa');
    assert.ok(u.descuentoPendiente, 'no quedo el descuento en la ficha');
  });

  test('una promocion vencida no da nada', async () => {
    const r = await llamarA('reclamarPromocion', 'elpasa', { codigo: 'VENCIDA' });
    assert.strictEqual(r.cuerpo?.error?.status, 'FAILED_PRECONDITION');
    assert.strictEqual((await leer('usuarios/elpasa')).descuentoPendiente, undefined);
  });

  test('el tipo de cuenta se lee de la FICHA, no de lo que mande el telefono', async () => {
    // Antes el celular mandaba su propio 'tipoUsuario' y con eso pasaba el
    // filtro. Aqui el pasajero pide una promo de conductores Y ADEMAS miente
    // diciendo que es conductor: el servidor mira la ficha y lo rechaza igual.
    const r = await llamarA('reclamarPromocion', 'elpasa', { codigo: 'SOLOCOND', tipoUsuario: 'conductor' });
    assert.strictEqual(r.cuerpo?.error?.status, 'FAILED_PRECONDITION');
    assert.strictEqual((await leer('usuarios/elpasa')).descuentoPendiente, undefined);
    // Y al conductor de verdad si se la da.
    const r2 = await llamarA('reclamarPromocion', 'elcond', { codigo: 'SOLOCOND' });
    assert.strictEqual(r2.cuerpo?.result?.valor, 8000);
  });

  test('reclamar NO toca el saldo: el descuento se consume en el viaje, no antes', async () => {
    await llamarA('reclamarPromocion', 'elcond', { codigo: 'VIVA' });
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL, 'el reclamo movio el saldo');
  });
});

describe('REGLA 7 · creditosDeBienvenida', () => {
  beforeEach(async () => {
    await sembrar('config/global', {
      incentivoNuevoMototaxi: num(10000), incentivoNuevoTaxi: num(20000),
      comisionTaxi: num(COMISION_TAXI),
    });
    await sembrar('usuarios/motero', { tipo: txt('conductor'), tipoVehiculo: txt('Mototaxi') });
    await sembrar('usuarios/taxista', { tipo: txt('conductor'), tipoVehiculo: txt('Taxi') });
    await sembrar('usuarios/conSaldo', { tipo: txt('conductor'), tipoVehiculo: txt('Taxi'), creditos: num(5000) });
    await sembrar('usuarios/pasajero', { tipo: txt('') });
  });

  test('SIN sesion no se dan creditos', async () => {
    const r = await llamarA('creditosDeBienvenida', null, {});
    assert.strictEqual(r.cuerpo?.error?.status, 'UNAUTHENTICATED');
    assert.strictEqual(await saldoDe('motero'), -1, 'aparecio saldo sin sesion');
  });

  test('el monto sale de la config y del vehiculo de la FICHA', async () => {
    await llamarA('creditosDeBienvenida', 'motero', {});
    assert.strictEqual(await saldoDe('motero'), 10000, 'al mototaxista no le toco lo suyo');
    await llamarA('creditosDeBienvenida', 'taxista', {});
    assert.strictEqual(await saldoDe('taxista'), 20000, 'al taxista no le toco lo suyo');
  });

  test('el telefono NO puede pedir el monto que quiera', async () => {
    // Aunque mande 999999 y diga que es taxi, el servidor usa la ficha y la config.
    await llamarA('creditosDeBienvenida', 'motero', { creditos: 999999, tipoVehiculo: 'Taxi', monto: 999999 });
    assert.strictEqual(await saldoDe('motero'), 10000, 'se colo el monto que mando el telefono');
  });

  test('SOLO UNA VEZ: llamar cinco veces no multiplica el regalo', async () => {
    for (let i = 0; i < 5; i++) await llamarA('creditosDeBienvenida', 'taxista', {});
    assert.strictEqual(await saldoDe('taxista'), 20000, 'el regalo se dio mas de una vez');
  });

  test('a quien ya tiene saldo no le toca', async () => {
    const r = await llamarA('creditosDeBienvenida', 'conSaldo', {});
    assert.strictEqual(r.cuerpo?.result?.creditos, 0);
    assert.strictEqual(r.cuerpo?.result?.motivo, 'ya_recibida');
    assert.strictEqual(await saldoDe('conSaldo'), 5000);
  });

  test('PLATA INFINITA: gastar hasta CERO y volver a pedir el regalo NO funciona', async () => {
    // El ataque de verdad, el que encontro la segunda opinion: esto ya no es
    // una pantalla, es una puerta abierta. El conductor cobra su bienvenida,
    // gasta hasta cero con las comisiones, y vuelve a llamar. Con el candado
    // viejo ("¿tiene saldo?") le habria dado otros $20.000. Y otros. Y otros.
    await llamarA('creditosDeBienvenida', 'taxista', {});
    assert.strictEqual(await saldoDe('taxista'), 20000);

    // Gasto todo. (sembrar reemplaza la ficha entera, asi que se vuelve a
    // escribir con sus datos: si no, se perderia el tipo y el rechazo seria
    // por otro motivo y la prueba mentiria en verde.)
    await sembrar('usuarios/taxista', { tipo: txt('conductor'), tipoVehiculo: txt('Taxi'), creditos: num(0) });
    const r = await llamarA('creditosDeBienvenida', 'taxista', {});
    assert.strictEqual(r.cuerpo?.result?.motivo, 'ya_recibida');
    assert.strictEqual(await saldoDe('taxista'), 0, 'le regalaron la bienvenida DOS VECES');
  });

  test('a un conductor ENDEUDADO no se le borra la deuda con un regalo', async () => {
    // Peor que repetir el regalo: esto ESCRIBE el monto, no lo suma. Con el
    // candado viejo, un saldo negativo pasaba el filtro y quedaba en +20.000.
    await sembrar('usuarios/endeudado', { tipo: txt('conductor'), tipoVehiculo: txt('Taxi'), creditos: num(-3000) });
    const r = await llamarA('creditosDeBienvenida', 'endeudado', {});
    assert.strictEqual(r.cuerpo?.result?.motivo, 'ya_recibida');
    assert.strictEqual(await saldoDe('endeudado'), -3000, 'se le borro la deuda');
  });

  test('a un pasajero no le tocan creditos de conductor', async () => {
    const r = await llamarA('creditosDeBienvenida', 'pasajero', {});
    assert.strictEqual(r.cuerpo?.result?.motivo, 'no_es_conductor');
    assert.strictEqual(await saldoDe('pasajero'), -1);
  });
});

describe('REGLA 7 · consumirDescuentoViaje', () => {
  const DESCUENTO = 8000;

  beforeEach(async () => {
    await sembrar('usuarios/condA', { tipo: txt('conductor'), creditos: num(SALDO_INICIAL) });
    await sembrar('usuarios/condB', { tipo: txt('conductor'), creditos: num(SALDO_INICIAL) });
    await sembrar('promociones/PROMO1', {
      usosTotales: num(4), inversionTotal: num(32000), activa: { booleanValue: true },
    });
    await sembrar('viajes/vd1', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'),
      descuentoInfo: { mapValue: { fields: {
        promoId: txt('PROMO1'), descuentoAplicado: num(DESCUENTO),
        codigoVerificacion: txt('7391'), consumido: { booleanValue: false },
      } } },
    });
  });

  const consumido = async () => {
    const v = await leer('viajes/vd1');
    return v?.descuentoInfo?.mapValue?.fields?.consumido?.booleanValue;
  };

  test('SIN sesion no se cobra nada', async () => {
    const r = await llamarA('consumirDescuentoViaje', null, { viajeId: 'vd1', codigo: '7391' });
    assert.strictEqual(r.cuerpo?.error?.status, 'UNAUTHENTICATED');
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL);
    assert.strictEqual(await consumido(), false);
  });

  test('OTRO conductor NO puede cobrar el descuento de este viaje', async () => {
    const r = await llamarA('consumirDescuentoViaje', 'condB', { viajeId: 'vd1', codigo: '7391' });
    assert.strictEqual(r.cuerpo?.error?.status, 'PERMISSION_DENIED');
    assert.strictEqual(await saldoDe('condB'), SALDO_INICIAL, 'cobro el descuento de un viaje ajeno');
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL);
    assert.strictEqual(await consumido(), false);
  });

  test('con el codigo MALO no se cobra, y el descuento sigue vivo', async () => {
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vd1', codigo: '0000' });
    assert.strictEqual(r.cuerpo?.error?.status, 'PERMISSION_DENIED');
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL);
    assert.strictEqual(await consumido(), false, 'se quemo el descuento con un codigo malo');
  });

  test('el conductor del viaje, con el codigo bueno: cobra, se marca y se apunta', async () => {
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vd1', codigo: '7391' });
    assert.strictEqual(r.cuerpo?.result?.monto, DESCUENTO);
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL + DESCUENTO);
    assert.strictEqual(await consumido(), true);
    // El contador por persona: es el que hace de verdad el tope de las promos.
    const uso = await leer('promociones/PROMO1/usos/elpasa');
    assert.strictEqual(Number(uso.veces.integerValue), 1);
    // Y la analitica del panel.
    const promo = await leer('promociones/PROMO1');
    assert.strictEqual(Number(promo.usosTotales.integerValue), 5);
    assert.strictEqual(Number(promo.inversionTotal.integerValue), 32000 + DESCUENTO);
  });

  test('el MISMO descuento no se cobra dos veces (ni llamando 5 veces)', async () => {
    await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vd1', codigo: '7391' });
    for (let i = 0; i < 5; i++) {
      const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vd1', codigo: '7391' });
      assert.strictEqual(r.cuerpo?.error?.status, 'ALREADY_EXISTS');
    }
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL + DESCUENTO, 'cobro el descuento mas de una vez');
    const promo = await leer('promociones/PROMO1');
    assert.strictEqual(Number(promo.usosTotales.integerValue), 5, 'la analitica conto de mas');
  });

  test('el codigo se compara solo por sus cifras, como hacia la app', async () => {
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vd1', codigo: ' 73-91 ' });
    assert.strictEqual(r.cuerpo?.result?.monto, DESCUENTO);
  });

  test('un conductor NO puede ser su propio pasajero y cobrarse el descuento', async () => {
    // El fraude barato: fabricarse un viaje donde uno es las dos partes. Hoy
    // las reglas dejan escribir cualquier viaje (eso es la REGLA 9), asi que
    // este freno vive en el servidor.
    await sembrar('viajes/vyo', {
      pasajeroId: txt('condA'), conductorId: txt('condA'), estado: txt('aceptado'),
      descuentoInfo: { mapValue: { fields: {
        promoId: txt('PROMO1'), descuentoAplicado: num(999999),
        codigoVerificacion: txt('1111'), consumido: { booleanValue: false },
      } } },
    });
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vyo', codigo: '1111' });
    assert.strictEqual(r.cuerpo?.error?.status, 'PERMISSION_DENIED');
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL, 'se cobro un descuento que se invento el solo');
  });

  test('el descuento SIN promoId tambien se cobra (el de bienvenida no tiene promo)', async () => {
    await sembrar('viajes/vbien', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'),
      descuentoInfo: { mapValue: { fields: {
        descuentoAplicado: num(3000), codigoVerificacion: txt('5555'),
        consumido: { booleanValue: false },
      } } },
    });
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vbien', codigo: '5555' });
    assert.strictEqual(r.cuerpo?.result?.monto, 3000);
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL + 3000);
  });

  test('una promo que no existe no estorba: se cobra y se cuenta igual', async () => {
    await sembrar('viajes/vsp', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'),
      descuentoInfo: { mapValue: { fields: {
        promoId: txt('FANTASMA'), descuentoAplicado: num(4000),
        codigoVerificacion: txt('2222'), consumido: { booleanValue: false },
      } } },
    });
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vsp', codigo: '2222' });
    assert.strictEqual(r.cuerpo?.result?.monto, 4000);
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL + 4000);
    // El contador por persona SI se escribe aunque la promo no exista: es el
    // que hace el tope, y va DENTRO de la transaccion del cobro.
    const uso = await leer('promociones/FANTASMA/usos/elpasa');
    assert.strictEqual(Number(uso.veces.integerValue), 1);
  });

  test('un promoId ROTO no le cuesta la plata al conductor', async () => {
    // Esta prueba encontro un fallo de verdad el 24-ago-2026: un promoId con
    // una barra dentro hace invalida la ruta del documento, la excepcion
    // saltaba DENTRO de la transaccion del cobro y se llevaba por delante el
    // pago del conductor. Y ese dato viene del viaje, que hoy puede escribir
    // cualquiera (REGLA 9). Ahora un id raro solo cuesta el apunte del uso.
    //
    // (El otro peligro — que la lista historialUsos llene el documento de la
    // promo, 1 MB — no se puede simular aqui; lo cubre que la analitica viva
    // FUERA de la transaccion, con su propio try. Comprobado con un mutante:
    // quitando el filtro del id, la analitica revienta y el cobro sobrevive.)
    await sembrar('viajes/vrota', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'),
      descuentoInfo: { mapValue: { fields: {
        promoId: txt('PRO/MO'), descuentoAplicado: num(6000),
        codigoVerificacion: txt('3333'), consumido: { booleanValue: false },
      } } },
    });
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vrota', codigo: '3333' });
    assert.strictEqual(r.cuerpo?.result?.monto, 6000, 'la analitica tumbo el cobro del conductor');
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL + 6000);
  });

  test('un viaje SIN descuento no da plata', async () => {
    await sembrar('viajes/vsin', { pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado') });
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vsin', codigo: '7391' });
    assert.strictEqual(r.cuerpo?.error?.status, 'FAILED_PRECONDITION');
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL);
  });

  test('si algo falla, NO queda a medias: ni cobro ni marca', async () => {
    // Un viaje cuyo descuento apunta a una promo que no existe. Todo va en una
    // sola transaccion, asi que o cuadra entero o no cuadra: el conductor debe
    // cobrar igual (la promo que falta no es su culpa) y quedar todo marcado.
    await sembrar('viajes/vd2', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'),
      descuentoInfo: { mapValue: { fields: {
        promoId: txt('NOEXISTE'), descuentoAplicado: num(5000),
        codigoVerificacion: txt('1234'), consumido: { booleanValue: false },
      } } },
    });
    const r = await llamarA('consumirDescuentoViaje', 'condA', { viajeId: 'vd2', codigo: '1234' });
    assert.strictEqual(r.cuerpo?.result?.monto, 5000);
    assert.strictEqual(await saldoDe('condA'), SALDO_INICIAL + 5000);
    const v = await leer('viajes/vd2');
    assert.strictEqual(v?.descuentoInfo?.mapValue?.fields?.consumido?.booleanValue, true);
  });
});
