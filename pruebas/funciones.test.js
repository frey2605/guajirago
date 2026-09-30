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
// Los puertos salen de firebase.json por `pruebas/cargar.cjs` (elEmulador): no se escriben aquí.
const PUERTOS = require('./cargar.cjs').elEmulador();
const BD = 'http://127.0.0.1:' + PUERTOS.firestore + '/v1/projects/' + PROYECTO + '/databases/(default)/documents';
const FUNCIONES = 'http://127.0.0.1:' + PUERTOS.functions + '/' + PROYECTO + '/us-central1/';
const FN = FUNCIONES + 'confirmarConductor';

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
  const r = await fetch(FUNCIONES + nombre,
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
    const r = await fetch(FUNCIONES + 'subirTarifa', {
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

  // ── EL QUE MUERDE · el codigo ANULADO no se cobra (6-sep-2026) ────────────
  //  El panel escribe `anulado: true` al pulsar Anular, y esa palabra NO llegaba
  //  hasta esta funcion: aqui solo se miraba `usado`. O sea que anular cambiaba
  //  como se veia la lista en la pantalla del dueño, y nada mas.
  //  MEDIDO contra la nube ese dia: GGO-CHSGYH, $50.000, Nequi, anulado el
  //  29-jun y SIN USAR. El servidor se lo habria entregado a quien lo escribiera.
  test('EL QUE MUERDE · un codigo ANULADO no se cobra', async () => {
    await sembrar('codigos/ANULADO50', {
      valor: num(50000), usado: { booleanValue: false }, anulado: { booleanValue: true },
    });
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'ANULADO50' });
    assert.strictEqual(r.cuerpo?.error?.status, 'FAILED_PRECONDITION',
      'el codigo anulado se cobro igual: el boton de anular no anula nada');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL,
      'entro plata de un codigo que el dueño habia cancelado');
    assert.strictEqual((await leer('codigos/ANULADO50')).usado.booleanValue, false,
      'lo marco como usado aunque estaba anulado');
  });

  // ── EL QUE MUERDE · el codigo es de quien es ──────────────────────────────
  //  El panel ATA cada codigo a un conductor: exige su documento, lo busca y
  //  guarda `conductorId`. Esta funcion le acreditaba el saldo A QUIEN LLAMARA,
  //  sin comparar nunca los dos. Un codigo que llegara a otras manos —reenviado,
  //  pasado por WhatsApp— lo cobraba el otro, y el que hizo la transferencia se
  //  quedaba sin su recarga y sin nada que reclamar.
  test('EL QUE MUERDE · un codigo de OTRO conductor no se cobra', async () => {
    await sembrar('usuarios/otrocond', { tipo: txt('conductor'), creditos: num(0) });
    await sembrar('codigos/DEOTRO50', {
      valor: num(50000), usado: { booleanValue: false }, conductorId: txt('otrocond'),
    });
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'DEOTRO50' });
    assert.strictEqual(r.cuerpo?.error?.status, 'PERMISSION_DENIED',
      'cualquiera cobra el codigo de cualquiera');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL, 'se llevo la recarga de otro');
    assert.strictEqual(await saldoDe('otrocond'), 0, 'y al que pago no le entro nada');
    assert.strictEqual((await leer('codigos/DEOTRO50')).usado.booleanValue, false,
      'ademas se lo quemo: el dueño ya no podria cobrarlo');
  });

  test('su DUEÑO si lo cobra', async () => {
    await sembrar('codigos/MIO50', {
      valor: num(50000), usado: { booleanValue: false }, conductorId: txt('elcond'),
    });
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'MIO50' });
    assert.strictEqual(r.cuerpo?.result?.valor, 50000, 'el dueño no pudo cobrar el suyo');
    assert.strictEqual(await saldoDe('elcond'), SALDO_INICIAL + 50000);
  });

  // ── Y LOS VIEJOS SE SIGUEN COBRANDO ───────────────────────────────────────
  //  El candado de arriba SOLO muerde si el codigo trae dueño apuntado, y eso no
  //  es pereza: MEDIDO el 6-sep-2026, de los 3 codigos cobrables de la nube DOS
  //  son viejos y no lo traen (GGO-4PZKAT, por $50.000). Exigirlo a secas habria
  //  dejado sin cobrar una recarga que alguien ya pago.
  //  Esta prueba se pone ROJA si alguien endurece el candado sin mirar los datos.
  test('un codigo VIEJO sin dueño apuntado se sigue cobrando: no se deja a nadie fuera', async () => {
    assert.strictEqual((await leer('codigos/BUENO50')).conductorId, undefined,
      'este codigo tiene que estar SIN dueño para que la prueba valga');
    const r = await llamarA('canjearCodigoRecarga', 'elcond', { codigo: 'BUENO50' });
    assert.strictEqual(r.cuerpo?.result?.valor, 50000,
      'el candado del dueño dejo sin cobrar un codigo viejo, y esa es plata de alguien');
  });
});

describe('REGLA 7 · reclamarPromocion', () => {
  // Los días salen de la MISMA pieza con que el servidor cuenta la vigencia (G16): en UTC, de 7 p. m. a medianoche
  // de Colombia el «ayer» de la prueba era el «hoy» del servidor y la VENCIDA salía vigente. Colombia no cambia de hora.
  const { hoyEnColombia } = require('../guajirago/functions/cobros.cjs');
  const AYER = hoyEnColombia(new Date(Date.now() - 86400000));
  const MANANA = hoyEnColombia(new Date(Date.now() + 86400000));

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
    // G18: la ficha la arma la receta unica del servidor, con el MISMO codigo que se le contesta al telefono.
    const f = u.descuentoPendiente.mapValue.fields;
    assert.strictEqual(f.codigoVerificacion.stringValue, String(r.cuerpo.result.codigoVerificacion));
    assert.strictEqual(f.fabricadoPor?.stringValue, 'servidor', 'la ficha no la firmo la receta del servidor');
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

  // ── G12 (28-sep-2026): LOS «VIAJES PREVIOS» LOS EXIGE TAMBIÉN EL SERVIDOR ──
  //  Antes solo los miraba el panel: con el código, un pasajero NUEVO canjeaba
  //  aquí una promoción que pedía viajes, y el descuento lo paga GuajiraGo.
  //  Solo cuentan los viajes 'finalizado' de esa persona.
  test('G12 · un pasajero SIN los viajes previos no canjea la promoción que los pide', async () => {
    await sembrar('promociones/DOSVIAJES', {
      activa: { booleanValue: true }, fechaInicio: txt(AYER), fechaFin: txt(MANANA),
      tipoBeneficio: txt('credito'), valorBeneficio: num(8000), aplicaA: txt('pasajeros'),
      viajesMinimosRequeridos: num(2),
    });
    await sembrar('usuarios/nuevoG12', { tipo: txt('') });
    await sembrar('viajes/g12-uno', { pasajeroId: txt('nuevoG12'), estado: txt('finalizado') });
    await sembrar('viajes/g12-cancelado', { pasajeroId: txt('nuevoG12'), estado: txt('cancelado') });
    const r = await llamarA('reclamarPromocion', 'nuevoG12', { codigo: 'DOSVIAJES' });
    assert.strictEqual(r.cuerpo?.error?.status, 'FAILED_PRECONDITION', 'el servidor dejó canjear sin los viajes previos');
    assert.match(String(r.cuerpo?.error?.message), /2 viajes completados\. Llevas 1/,
      'el motivo no dice cuántos pide y cuántos lleva (el cancelado NO cuenta)');
    assert.strictEqual((await leer('usuarios/nuevoG12')).descuentoPendiente, undefined, 'quedó un descuento sin cumplir');

    // Y con el segundo viaje completado, SÍ.
    await sembrar('viajes/g12-dos', { pasajeroId: txt('nuevoG12'), estado: txt('finalizado') });
    const r2 = await llamarA('reclamarPromocion', 'nuevoG12', { codigo: 'DOSVIAJES' });
    assert.strictEqual(r2.cuerpo?.result?.valor, 8000, 'con los viajes cumplidos no le dio la promoción');
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
  // P02: el valor y el código salen de la FICHA del pasajero (firmada por el servidor), no del viaje. Cada viaje de
  // aquí lleva al lado el descuento de la ficha que le corresponde, y una tarifa sobre la que calcularlo.
  const darDescuento = (promoId, valor, codigo) => sembrar('usuarios/elpasa', { tipo: txt(''), descuentoPendiente: { mapValue: { fields: {
    ...(promoId ? { promoId: txt(promoId) } : {}), tipoBeneficio: txt('credito'), valorBeneficio: num(valor),
    codigoVerificacion: txt(codigo), fabricadoPor: txt('servidor'),
  } } } });

  beforeEach(async () => {
    await sembrar('usuarios/condA', { tipo: txt('conductor'), creditos: num(SALDO_INICIAL) });
    await sembrar('usuarios/condB', { tipo: txt('conductor'), creditos: num(SALDO_INICIAL) });
    await sembrar('promociones/PROMO1', {
      usosTotales: num(4), inversionTotal: num(32000), activa: { booleanValue: true },
    });
    await darDescuento('PROMO1', DESCUENTO, '7391');
    await sembrar('viajes/vd1', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'), tarifaValor: num(20000),
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
      pasajeroId: txt('condA'), conductorId: txt('condA'), estado: txt('aceptado'), tarifaValor: num(20000),
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
    await darDescuento(null, 3000, '5555');
    await sembrar('viajes/vbien', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'), tarifaValor: num(20000),
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
    await darDescuento('FANTASMA', 4000, '2222');
    await sembrar('viajes/vsp', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'), tarifaValor: num(20000),
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
    await darDescuento('PRO/MO', 6000, '3333');
    await sembrar('viajes/vrota', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'), tarifaValor: num(20000),
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
    await darDescuento('NOEXISTE', 5000, '1234');
    await sembrar('viajes/vd2', {
      pasajeroId: txt('elpasa'), conductorId: txt('condA'), estado: txt('aceptado'), tarifaValor: num(20000),
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

// ── G01 · EL DESCUENTO SE CALCULA SOBRE LA TARIFA ACEPTADA ──────────────────
// El caso del hallazgo, encendiendo las dos funciones de verdad: el pasajero ofrece $10.000 con un crédito de $8.000
// (la ficha nace diciendo «paga $2.000»), el conductor contraoferta $15.000 y el pasajero la acepta. Antes el viaje
// quedaba en $15.000 con la ficha diciendo $2.000: el pasajero pagaba $2.000, se abonaban $8.000 y faltaban $5.000.
describe('G01 · confirmarConductor rehace el descuento sobre la tarifa aceptada', () => {
  const ficha = (campos) => ({ mapValue: { fields: campos } });
  const numDe = (f) => Number(f?.integerValue ?? f?.doubleValue);

  beforeEach(async () => {
    await sembrar('config/global', { comisionTaxi: num(COMISION_TAXI) });
    await sembrar('conductores/condG', { ocupado: { booleanValue: false } });
    await sembrar('usuarios/condG', { creditos: num(SALDO_INICIAL), tipo: txt('conductor') });
    // P02: el valor sale de la ficha del pasajero (la bienvenida que le dio el servidor), no del viaje.
    await sembrar('usuarios/pasaG', { tipo: txt(''), descuentoPendiente: ficha({
      promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(8000),
      codigoVerificacion: txt('4455'), fabricadoPor: txt('servidor'),
    }) });
    await sembrar('viajes/vg1', {
      pasajeroId: txt('pasaG'), estado: txt('esperando'), tipo: txt('Taxi'),
      tarifa: txt('$10.000'), tarifaValor: num(10000),
      descuentoInfo: ficha({
        tarifaOriginal: num(10000), tarifaPasajeroPaga: num(2000), descuentoAplicado: num(8000),
        promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(8000),
        codigoVerificacion: txt('4455'), consumido: { booleanValue: false },
      }),
    });
    await sembrar('viajes/vg1/contraofertas/condG', {
      monto: txt('$15.000'), montoValor: num(15000), conductorNombre: txt('Gabo'), tipoOferta: txt('contraoferta'),
    });
  });

  test('contraoferta $15.000 con crédito $8.000: el pasajero paga $7.000, el conductor cobra $15.000 y se abonan $8.000', async () => {
    const r = await llamar('pasaG', { viajeId: 'vg1', conductorId: 'condG' });
    assert.strictEqual(r.http, 200, JSON.stringify(r.cuerpo));
    assert.strictEqual(r.cuerpo.result.ok, true);
    const v = await leer('viajes/vg1');
    const f = v.descuentoInfo.mapValue.fields;
    assert.strictEqual(numDe(v.tarifaValor), 15000);
    assert.strictEqual(numDe(f.tarifaOriginal), 15000, 'la ficha sigue hecha sobre la oferta vieja');
    assert.strictEqual(numDe(f.tarifaPasajeroPaga), 7000, 'la pantalla del pasajero diría otra cifra que la del conductor');
    assert.strictEqual(numDe(f.descuentoAplicado), 8000);
    assert.strictEqual(f.codigoVerificacion.stringValue, '4455', 'el código del descuento no puede cambiar');
    assert.strictEqual(f.consumido.booleanValue, false);

    // Y el abono al terminar sale de ESA ficha: 7.000 del pasajero + 8.000 de GuajiraGo = los 15.000 del conductor.
    const saldoTrasComision = await saldoDe('condG');
    const c = await llamarA('consumirDescuentoViaje', 'condG', { viajeId: 'vg1', codigo: '4455' });
    assert.strictEqual(c.cuerpo?.result?.monto, 8000, JSON.stringify(c.cuerpo));
    assert.strictEqual(await saldoDe('condG'), saldoTrasComision + 8000);
  });

  test('un porcentaje se aplica sobre la tarifa aceptada', async () => {
    await sembrar('usuarios/pasaG', { tipo: txt(''), descuentoPendiente: ficha({
      promoId: txt('P10'), tipoBeneficio: txt('descuento'), valorBeneficio: num(10),
      codigoVerificacion: txt('1111'), fabricadoPor: txt('servidor'),
    }) });
    await sembrar('viajes/vg1', {
      pasajeroId: txt('pasaG'), estado: txt('esperando'), tipo: txt('Taxi'),
      tarifa: txt('$10.000'), tarifaValor: num(10000),
      descuentoInfo: ficha({
        tarifaOriginal: num(10000), tarifaPasajeroPaga: num(9000), descuentoAplicado: num(1000),
        promoId: txt('P10'), tipoBeneficio: txt('descuento'), valorBeneficio: num(10),
        codigoVerificacion: txt('1111'), consumido: { booleanValue: false },
      }),
    });
    const r = await llamar('pasaG', { viajeId: 'vg1', conductorId: 'condG' });
    assert.strictEqual(r.cuerpo?.result?.ok, true, JSON.stringify(r.cuerpo));
    const f = (await leer('viajes/vg1')).descuentoInfo.mapValue.fields;
    assert.strictEqual(numDe(f.tarifaPasajeroPaga), 13500);
    assert.strictEqual(numDe(f.descuentoAplicado), 1500);
  });

  test('un viaje SIN descuento sigue sin ficha: no se le inventa una', async () => {
    await sembrar('viajes/vg1', {
      pasajeroId: txt('pasaG'), estado: txt('esperando'), tipo: txt('Taxi'),
      tarifa: txt('$10.000'), tarifaValor: num(10000),
    });
    const r = await llamar('pasaG', { viajeId: 'vg1', conductorId: 'condG' });
    assert.strictEqual(r.cuerpo?.result?.ok, true, JSON.stringify(r.cuerpo));
    const v = await leer('viajes/vg1');
    assert.strictEqual(numDe(v.tarifaValor), 15000);
    assert.ok(!('descuentoInfo' in v), 'apareció una ficha de descuento en un viaje que no tenía');
  });

  // G13 (28-sep-2026): el servidor copiaba al viaje el TEXTO de la oferta tal como lo armó el teléfono del conductor,
  // con el idioma de ese teléfono. Ahora lo arma él desde el NÚMERO aceptado, con el formateador único.
  test('G13 · la oferta de un teléfono en inglés («$15,000») deja en el viaje el texto de cop(), no el del teléfono', async () => {
    await sembrar('viajes/vg1/contraofertas/condG', {
      monto: txt('$15,000'), montoValor: num(15000), conductorNombre: txt('Gabo'), tipoOferta: txt('contraoferta'),
    });
    const r = await llamar('pasaG', { viajeId: 'vg1', conductorId: 'condG' });
    assert.strictEqual(r.cuerpo?.result?.ok, true, JSON.stringify(r.cuerpo));
    const v = await leer('viajes/vg1');
    assert.strictEqual(v.tarifa.stringValue, '$ 15.000', 'el viaje guardó el texto del teléfono: «' + v.tarifa.stringValue + '»');
    assert.strictEqual(numDe(v.tarifaValor), 15000);
  });
});

// ── G18 · EL CREDITO DE BIENVENIDA DEL PASAJERO LO FABRICA EL SERVIDOR ─────────
// Antes lo fabricaba el telefono (Login.js): el valor, el codigo y la huella del aparato. Se enciende la funcion de
// verdad y se comprueba que decide ella, una vez por persona y por aparato, y que el telefono no puede pedir mas.
describe('G18 · descuentoDeBienvenida', () => {
  const pendienteDe = async (uid) => (await leer('usuarios/' + uid))?.descuentoPendiente?.mapValue?.fields;
  let n = 0;
  const nuevo = async (campos = {}) => {
    n += 1;
    const uid = 'bienv' + Date.now() + '_' + n;
    await sembrar('usuarios/' + uid, { tipo: txt(''), nombre: txt('Ana'), ...campos });
    return uid;
  };

  beforeEach(async () => {
    await sembrar('config/global', { comisionTaxi: num(COMISION_TAXI), viajeGratisNuevoPasajero: { booleanValue: true } });
  });

  test('SIN sesion no se da nada', async () => {
    const r = await llamarA('descuentoDeBienvenida', null, { deviceId: 'dev_x' });
    assert.strictEqual(r.cuerpo?.error?.status, 'UNAUTHENTICATED');
  });

  test('un pasajero nuevo recibe $8.000 con codigo de 4 cifras, firmado por el servidor, y queda la huella', async () => {
    const uid = await nuevo();
    const aparato = 'dev_' + uid;
    const r = await llamarA('descuentoDeBienvenida', uid, { deviceId: aparato });
    assert.strictEqual(r.cuerpo?.result?.valor, 8000, JSON.stringify(r.cuerpo));
    const f = await pendienteDe(uid);
    assert.ok(f, 'no quedo el descuento en la ficha');
    assert.strictEqual(f.promoId.stringValue, 'BIENVENIDA');
    assert.strictEqual(f.tipoBeneficio.stringValue, 'credito');
    assert.strictEqual(Number(f.valorBeneficio.integerValue), 8000);
    assert.match(f.codigoVerificacion.stringValue, /^[1-9][0-9]{3}$/);
    assert.strictEqual(f.codigoVerificacion.stringValue, r.cuerpo.result.codigoVerificacion);
    assert.strictEqual(f.fabricadoPor.stringValue, 'servidor');
    assert.strictEqual((await leer('usuarios/' + uid)).nombre.stringValue, 'Ana', 'se piso la ficha');
    const huella = await leer('dispositivosBeneficio/' + aparato);
    assert.strictEqual(huella?.uid?.stringValue, uid, 'no quedo la huella del aparato');
  });

  test('el telefono NO puede pedir el valor que quiera', async () => {
    const uid = await nuevo();
    const r = await llamarA('descuentoDeBienvenida', uid, { deviceId: 'dev_' + uid, valor: 999999, valorBeneficio: 999999 });
    assert.strictEqual(r.cuerpo?.result?.valor, 8000);
    assert.strictEqual(Number((await pendienteDe(uid)).valorBeneficio.integerValue), 8000, 'se colo el valor del telefono');
  });

  test('SOLO UNA VEZ por persona, aunque cambie de aparato y aunque borre su descuento', async () => {
    const uid = await nuevo();
    await llamarA('descuentoDeBienvenida', uid, { deviceId: 'dev_a_' + uid });
    assert.ok(await pendienteDe(uid), 'la primera vez no se dio');
    const r = await llamarA('descuentoDeBienvenida', uid, { deviceId: 'dev_b_' + uid });
    assert.strictEqual(r.cuerpo?.result?.valor, 0);
    assert.strictEqual(r.cuerpo?.result?.motivo, 'ya_recibida');
    // El telefono puede borrar su propio descuento (las reglas se lo dejan): aun asi no se le vuelve a dar.
    await sembrar('usuarios/' + uid, { tipo: txt('') });
    const r2 = await llamarA('descuentoDeBienvenida', uid, { deviceId: 'dev_c_' + uid });
    assert.strictEqual(r2.cuerpo?.result?.motivo, 'ya_recibida');
    assert.strictEqual(await pendienteDe(uid), undefined, 'se le dio la bienvenida dos veces');
  });

  test('un aparato que ya la uso no se la da a otra cuenta', async () => {
    const uno = await nuevo();
    const dos = await nuevo();
    const aparato = 'dev_compartido_' + uno;
    await llamarA('descuentoDeBienvenida', uno, { deviceId: aparato });
    const r = await llamarA('descuentoDeBienvenida', dos, { deviceId: aparato });
    assert.strictEqual(r.cuerpo?.result?.motivo, 'aparato_usado');
    assert.strictEqual(await pendienteDe(dos), undefined);
  });

  test('sin aparato tambien funciona, y tambien una sola vez', async () => {
    const uid = await nuevo();
    const r = await llamarA('descuentoDeBienvenida', uid, {});
    assert.strictEqual(r.cuerpo?.result?.valor, 8000, JSON.stringify(r.cuerpo));
    const r2 = await llamarA('descuentoDeBienvenida', uid, {});
    assert.strictEqual(r2.cuerpo?.result?.motivo, 'ya_recibida');
  });

  test('con el interruptor del panel APAGADO no se da', async () => {
    await sembrar('config/global', { comisionTaxi: num(COMISION_TAXI), viajeGratisNuevoPasajero: { booleanValue: false } });
    const uid = await nuevo();
    const r = await llamarA('descuentoDeBienvenida', uid, { deviceId: 'dev_' + uid });
    assert.strictEqual(r.cuerpo?.result?.motivo, 'apagada');
    assert.strictEqual(await pendienteDe(uid), undefined);
  });

  test('a un conductor, a quien ya pidio viajes o ya tiene otro descuento, no se le da', async () => {
    const cond = await nuevo({ tipo: txt('conductor') });
    assert.strictEqual((await llamarA('descuentoDeBienvenida', cond, { deviceId: 'dev_' + cond })).cuerpo?.result?.motivo, 'es_conductor');

    const viejo = await nuevo();
    await sembrar('viajes/viaje_' + viejo, { pasajeroId: txt(viejo), estado: txt('cancelado') });
    assert.strictEqual((await llamarA('descuentoDeBienvenida', viejo, { deviceId: 'dev_' + viejo })).cuerpo?.result?.motivo, 'no_es_nuevo');

    const conPromo = await nuevo({ descuentoPendiente: { mapValue: { fields: { promoId: txt('VIVA'), codigoVerificacion: txt('5555') } } } });
    assert.strictEqual((await llamarA('descuentoDeBienvenida', conPromo, { deviceId: 'dev_' + conPromo })).cuerpo?.result?.motivo, 'ya_tiene_descuento');
    assert.strictEqual((await pendienteDe(conPromo)).codigoVerificacion.stringValue, '5555', 'se le piso la promocion que tenia');
  });
});

// ── P02 · EL ABONO DEL DESCUENTO NO SALE DEL NÚMERO QUE TRAIGA EL VIAJE ──────────
// Hallazgo del P01 (30-sep-2026): el dinero que se le abona al conductor salía de `descuentoInfo.descuentoAplicado`,
// escrito DENTRO del viaje, y las reglas de `viajes` dejaban que el pasajero y el conductor del viaje lo cambiaran.
// Y `confirmarConductor` rehacía la cuenta con el `valorBeneficio` que había escrito el teléfono. Ahora la cuenta la
// hace el servidor con la ficha del pasajero (el descuento que firmó él), la quema al cobrar y las reglas congelan la
// ficha del viaje. Estas pruebas ENCIENDEN el ataque tal como lo haría un teléfono: escriben por la red, con su carnet,
// pasando por las reglas.
describe('P02 · el abono del descuento lo decide el servidor, no el viaje', () => {
  const ficha = (campos) => ({ mapValue: { fields: campos } });
  const numDe = (f) => Number(f?.integerValue ?? f?.doubleValue);
  const firmado = (codigo, extra = {}) => ficha({
    promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(8000),
    codigoVerificacion: txt(codigo), fabricadoPor: txt('servidor'), ...extra,
  });
  const infoHonrada = (codigo, tarifa = 15000, aplicado = 8000) => ficha({
    tarifaOriginal: num(tarifa), tarifaPasajeroPaga: num(tarifa - aplicado), descuentoAplicado: num(aplicado),
    promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(8000),
    codigoVerificacion: txt(codigo), consumido: { booleanValue: false },
  });
  const pendienteDe = async (uid) => (await leer('usuarios/' + uid))?.descuentoPendiente?.mapValue?.fields;

  /** Escribe unos campos de un documento COMO un teléfono: con su carnet, así que pasa por las reglas. */
  async function escribirComo(uid, ruta, campos) {
    const mascara = Object.keys(campos).map((k) => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
    const r = await fetch(BD + '/' + ruta + '?' + mascara, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + carnet(uid), 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: campos }),
    });
    return r.status;
  }

  beforeEach(async () => {
    await sembrar('config/global', { comisionTaxi: num(COMISION_TAXI) });
    await sembrar('conductores/condP', { ocupado: { booleanValue: false } });
    await sembrar('usuarios/condP', { creditos: num(SALDO_INICIAL), tipo: txt('conductor') });
    await sembrar('usuarios/pasaP', { tipo: txt(''), descuentoPendiente: firmado('4455') });
    // Un viaje honrado, ya aceptado: la ficha del descuento es la que escribe confirmarConductor.
    await sembrar('viajes/vp1', {
      pasajeroId: txt('pasaP'), conductorId: txt('condP'), estado: txt('aceptado'), tipo: txt('Taxi'),
      tarifa: txt('$ 15.000'), tarifaValor: num(15000), descuentoInfo: infoHonrada('4455'),
    });
  });

  test('EL ATAQUE · el conductor NO puede reescribir el descuento de su viaje (las reglas lo niegan)', async () => {
    const estado = await escribirComo('condP', 'viajes/vp1', {
      descuentoInfo: ficha({ descuentoAplicado: num(999999), codigoVerificacion: txt('1'), consumido: { booleanValue: false } }),
    });
    assert.strictEqual(estado, 403, 'las reglas dejaron que el conductor se escribiera un descuento de $999.999');
    const f = (await leer('viajes/vp1')).descuentoInfo.mapValue.fields;
    assert.strictEqual(numDe(f.descuentoAplicado), 8000);
  });

  test('EL ATAQUE · el pasajero tampoco puede cambiarlo con el viaje en marcha', async () => {
    const estado = await escribirComo('pasaP', 'viajes/vp1', {
      descuentoInfo: ficha({ descuentoAplicado: num(15000), tarifaPasajeroPaga: num(0), codigoVerificacion: txt('4455') }),
    });
    assert.strictEqual(estado, 403, 'las reglas dejaron que el pasajero cambiara su descuento con el viaje en marcha');
  });

  test('EL ATAQUE · aunque el viaje traiga $999.999 y otro código, el servidor NO lo abona', async () => {
    // Como si el número hubiera llegado igual al viaje (por la puerta que sea): el servidor no se lo cree.
    await sembrar('viajes/vp1', {
      pasajeroId: txt('pasaP'), conductorId: txt('condP'), estado: txt('aceptado'), tipo: txt('Taxi'),
      tarifa: txt('$ 15.000'), tarifaValor: num(15000),
      descuentoInfo: ficha({ descuentoAplicado: num(999999), codigoVerificacion: txt('1'), consumido: { booleanValue: false },
        tarifaOriginal: num(15000) }),
    });
    const r = await llamarA('consumirDescuentoViaje', 'condP', { viajeId: 'vp1', codigo: '1' });
    assert.notStrictEqual(r.cuerpo?.result?.monto, 999999, 'se abonaron los $999.999 que escribió el viaje');
    assert.ok(r.cuerpo?.error, 'con el código inventado se cobró algo: ' + JSON.stringify(r.cuerpo));
    assert.strictEqual(await saldoDe('condP'), SALDO_INICIAL, 'el saldo del conductor se movió');
    // Con el código DE LA FICHA se abona lo de la ficha ($8.000), no lo del viaje.
    const bueno = await llamarA('consumirDescuentoViaje', 'condP', { viajeId: 'vp1', codigo: '4455' });
    assert.strictEqual(bueno.cuerpo?.result?.monto, 8000, JSON.stringify(bueno.cuerpo));
    assert.strictEqual(await saldoDe('condP'), SALDO_INICIAL + 8000);
  });

  test('EL ATAQUE · un pasajero SIN descuento que se lo inventa al pedir no lo recibe', async () => {
    await sembrar('usuarios/pasaP', { tipo: txt('') });
    await sembrar('viajes/vp2', {
      pasajeroId: txt('pasaP'), estado: txt('esperando'), tipo: txt('Taxi'), tarifa: txt('$ 15.000'), tarifaValor: num(15000),
      descuentoInfo: ficha({ tarifaOriginal: num(15000), tarifaPasajeroPaga: num(0), descuentoAplicado: num(15000),
        promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(999999),
        codigoVerificacion: txt('1234'), consumido: { booleanValue: false } }),
    });
    await sembrar('viajes/vp2/contraofertas/condP', { monto: txt('$ 15.000'), montoValor: num(15000), tipoOferta: txt('acepta') });
    const c = await llamar('pasaP', { viajeId: 'vp2', conductorId: 'condP' });
    assert.strictEqual(c.cuerpo?.result?.ok, true, JSON.stringify(c.cuerpo));
    const v = await leer('viajes/vp2');
    assert.ok(!('descuentoInfo' in v), 'el viaje se quedó con un descuento que la ficha no tiene');
    const saldo = await saldoDe('condP');
    const r = await llamarA('consumirDescuentoViaje', 'condP', { viajeId: 'vp2', codigo: '1234' });
    assert.ok(r.cuerpo?.error, 'se cobró un descuento inventado: ' + JSON.stringify(r.cuerpo));
    assert.strictEqual(await saldoDe('condP'), saldo);
  });

  test('EL ATAQUE · confirmarConductor no se cree el valorBeneficio que escribió el teléfono', async () => {
    await sembrar('viajes/vp3', {
      pasajeroId: txt('pasaP'), estado: txt('esperando'), tipo: txt('Taxi'), tarifa: txt('$ 15.000'), tarifaValor: num(15000),
      descuentoInfo: ficha({ tarifaOriginal: num(15000), tarifaPasajeroPaga: num(0), descuentoAplicado: num(15000),
        promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(15000),
        codigoVerificacion: txt('4455'), consumido: { booleanValue: false } }),
    });
    await sembrar('viajes/vp3/contraofertas/condP', { monto: txt('$ 15.000'), montoValor: num(15000), tipoOferta: txt('acepta') });
    const c = await llamar('pasaP', { viajeId: 'vp3', conductorId: 'condP' });
    assert.strictEqual(c.cuerpo?.result?.ok, true, JSON.stringify(c.cuerpo));
    const f = (await leer('viajes/vp3')).descuentoInfo.mapValue.fields;
    assert.strictEqual(numDe(f.descuentoAplicado), 8000, 'se rehízo la cuenta con el valor del teléfono');
    assert.strictEqual(numDe(f.tarifaPasajeroPaga), 7000);
    assert.strictEqual(numDe(f.valorBeneficio), 8000);
  });

  test('EL HERMANO · el cobro QUEMA el descuento de la ficha: no se puede reusar en otro viaje', async () => {
    const r = await llamarA('consumirDescuentoViaje', 'condP', { viajeId: 'vp1', codigo: '4455' });
    assert.strictEqual(r.cuerpo?.result?.monto, 8000, JSON.stringify(r.cuerpo));
    assert.strictEqual(await pendienteDe('pasaP'), undefined, 'el descuento sigue en la ficha: el pasajero lo puede volver a usar');
    // Un segundo viaje con el mismo descuento (el teléfono no lo quemó): ya no da plata.
    await sembrar('viajes/vp4', {
      pasajeroId: txt('pasaP'), conductorId: txt('condP'), estado: txt('aceptado'), tipo: txt('Taxi'),
      tarifa: txt('$ 15.000'), tarifaValor: num(15000), descuentoInfo: infoHonrada('4455'),
    });
    const r2 = await llamarA('consumirDescuentoViaje', 'condP', { viajeId: 'vp4', codigo: '4455' });
    assert.ok(r2.cuerpo?.error, 'el mismo descuento se cobró dos veces: ' + JSON.stringify(r2.cuerpo));
    assert.strictEqual(await saldoDe('condP'), SALDO_INICIAL + 8000);
  });

  /** Un viaje en el mercado que pide usar el descuento, con la oferta de `cond` lista para aceptar. */
  async function pedirConDescuento(id, cond) {
    await sembrar('conductores/' + cond, { ocupado: { booleanValue: false } });
    await sembrar('usuarios/' + cond, { creditos: num(SALDO_INICIAL), tipo: txt('conductor') });
    await sembrar('viajes/' + id, {
      pasajeroId: txt('pasaP'), estado: txt('esperando'), tipo: txt('Taxi'), tarifa: txt('$ 15.000'), tarifaValor: num(15000),
      descuentoInfo: infoHonrada('4455'),
    });
    await sembrar('viajes/' + id + '/contraofertas/' + cond, { monto: txt('$ 15.000'), montoValor: num(15000), tipoOferta: txt('acepta') });
    const c = await llamar('pasaP', { viajeId: id, conductorId: cond });
    assert.strictEqual(c.cuerpo?.result?.ok, true, JSON.stringify(c.cuerpo));
    return (await leer('viajes/' + id)).descuentoInfo?.mapValue?.fields;
  }

  test('APARTADO · el mismo descuento no se pone a la vez en dos viajes en curso', async () => {
    const f1 = await pedirConDescuento('vp5', 'condP');
    assert.strictEqual(numDe(f1?.descuentoAplicado), 8000);
    assert.strictEqual((await pendienteDe('pasaP')).enViajeId?.stringValue, 'vp5', 'el descuento no quedó apartado');
    const f2 = await pedirConDescuento('vp6', 'condQ');
    assert.strictEqual(f2, undefined, 'el mismo descuento quedó puesto en dos viajes en curso a la vez');
    // Y aunque otro viaje traiga la ficha del descuento (escrita a mano), no lo cobra: está apartado para vp5.
    await sembrar('viajes/vp8', {
      pasajeroId: txt('pasaP'), conductorId: txt('condQ'), estado: txt('aceptado'), tipo: txt('Taxi'),
      tarifa: txt('$ 15.000'), tarifaValor: num(15000), descuentoInfo: infoHonrada('4455'),
    });
    const ajeno = await llamarA('consumirDescuentoViaje', 'condQ', { viajeId: 'vp8', codigo: '4455' });
    assert.ok(ajeno.cuerpo?.error, 'se cobró en otro viaje un descuento apartado para vp5: ' + JSON.stringify(ajeno.cuerpo));
    // Si el primero se cancela, el descuento se libera para el siguiente.
    await sembrar('viajes/vp5', { pasajeroId: txt('pasaP'), estado: txt('cancelado'), descuentoInfo: infoHonrada('4455') });
    const f3 = await pedirConDescuento('vp7', 'condR');
    assert.strictEqual(numDe(f3?.descuentoAplicado), 8000, 'el descuento de un viaje cancelado no se liberó');
  });

  test('SIN FIRMA · vale solo si es exactamente lo de su origen; si no, no da nada (no se paga de más)', async () => {
    // Bienvenida sin firma de $8.000 (las de antes de G18): vale.
    await sembrar('usuarios/pasaP', { tipo: txt(''), descuentoPendiente: ficha({
      promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(8000), codigoVerificacion: txt('4455') }) });
    assert.strictEqual(numDe((await pedirConDescuento('vs1', 'condP'))?.descuentoAplicado), 8000);
    // Bienvenida sin firma de $50.000: no cuadra con su origen, el viaje va sin descuento.
    await sembrar('usuarios/pasaP', { tipo: txt(''), descuentoPendiente: ficha({
      promoId: txt('BIENVENIDA'), tipoBeneficio: txt('credito'), valorBeneficio: num(50000), codigoVerificacion: txt('4455') }) });
    assert.strictEqual(await pedirConDescuento('vs2', 'condQ'), undefined, 'se aceptó una bienvenida sin firma de $50.000');
    // Promoción sin firma: vale si su tipo y valor son los de la promoción de hoy.
    await sembrar('promociones/PROMO-P02', { tipoBeneficio: txt('credito'), valorBeneficio: num(5000) });
    await sembrar('usuarios/pasaP', { tipo: txt(''), descuentoPendiente: ficha({
      promoId: txt('PROMO-P02'), tipoBeneficio: txt('credito'), valorBeneficio: num(5000), codigoVerificacion: txt('4455') }) });
    assert.strictEqual(numDe((await pedirConDescuento('vs3', 'condR'))?.descuentoAplicado), 5000);
    await sembrar('usuarios/pasaP', { tipo: txt(''), descuentoPendiente: ficha({
      promoId: txt('PROMO-P02'), tipoBeneficio: txt('credito'), valorBeneficio: num(9000), codigoVerificacion: txt('4455') }) });
    assert.strictEqual(await pedirConDescuento('vs4', 'condS'), undefined, 'se aceptó una promoción sin firma con otro valor');
  });
});

// ── P03 · LA TARJETA DEL CONDUCTOR SALE DE SU FICHA (30-sep-2026) ──
// confirmarConductor copiaba al viaje el nombre, teléfono, placa, vehículo, foto y color que escribía la OFERTA (el
// teléfono del conductor). Ahora salen de la ficha usuarios/{conductorId}; la oferta solo aporta el precio.
describe('P03 · confirmarConductor pone en el viaje la tarjeta de la FICHA del conductor', () => {
  const FICHA = {
    tipo: txt('conductor'), creditos: num(SALDO_INICIAL), nombre: txt('LUIS PEREZ'), telefono: txt('3001234567'),
    placa: txt('ABC123'), vehiculo: txt('Chevrolet 2015'), fotoConductor: txt('https://fotos/luis.jpg'), color: txt('Blanco'),
  };
  const DE_LA_FICHA = {
    conductorNombre: 'LUIS PEREZ', conductorTelefono: '3001234567', conductorPlaca: 'ABC123',
    conductorVehiculo: 'Chevrolet 2015', conductorFoto: 'https://fotos/luis.jpg', conductorColor: 'Blanco',
  };
  const tarjetaDe = (v) => Object.fromEntries(Object.keys(DE_LA_FICHA).map((k) => [k, v[k] && (v[k].stringValue ?? null)]));
  const pedir = async (id, oferta, ficha = FICHA) => {
    await sembrar('config/global', { comisionTaxi: num(COMISION_TAXI) });
    await sembrar('conductores/condT', { ocupado: { booleanValue: false } });
    await sembrar('usuarios/condT', ficha);
    await sembrar('viajes/' + id, { pasajeroId: txt('pasaT'), estado: txt('esperando'), tipo: txt('Taxi'),
      tarifa: txt('$12.000'), tarifaValor: num(12000) });
    await sembrar('viajes/' + id + '/contraofertas/condT', { monto: txt('$12.000'), montoValor: num(12000),
      tipoOferta: txt('acepta'), ...Object.fromEntries(Object.entries(oferta).map(([k, v]) => [k, txt(v)])) });
    const r = await llamar('pasaT', { viajeId: id, conductorId: 'condT' });
    assert.strictEqual(r.cuerpo?.result?.ok, true, JSON.stringify(r.cuerpo));
    return leer('viajes/' + id);
  };

  test('EL ATAQUE · una oferta con placa, nombre y teléfono ajenos deja en el viaje los de la ficha', async () => {
    const v = await pedir('vt1', {
      conductorNombre: 'CARLOS GOMEZ', conductorTelefono: '3110000000', conductorPlaca: 'XYZ999',
      conductorVehiculo: 'Mazda 2022', conductorFoto: 'https://fotos/otro.jpg', conductorColor: 'Rojo',
    });
    assert.deepStrictEqual(tarjetaDe(v), DE_LA_FICHA, 'el viaje lleva los datos que escribió el teléfono del conductor');
    assert.strictEqual(v.conductorId.stringValue, 'condT');
  });

  test('una oferta honrada deja el viaje igual que antes', async () => {
    const v = await pedir('vt2', DE_LA_FICHA);
    assert.deepStrictEqual(tarjetaDe(v), DE_LA_FICHA);
  });

  test('ficha vieja sin foto ni color: el viaje va sin ellos, aunque la oferta los traiga', async () => {
    const { fotoConductor: _f, color: _c, ...vieja } = FICHA;
    const v = await pedir('vt3', { ...DE_LA_FICHA }, vieja);
    const t = tarjetaDe(v);
    assert.strictEqual(t.conductorPlaca, 'ABC123');
    assert.strictEqual(t.conductorFoto, null, 'la foto salió de la oferta');
    assert.strictEqual(t.conductorColor, '', 'el color salió de la oferta');
  });
});
