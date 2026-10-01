// ═══════════════════════════════════════════════════════════════════════════
//  EL TOKEN DE AVISOS DEL CLIENTE SE PEGA DE UNA SOLA MANERA · gemelo G34, 28-sep-2026
//
//  El viaje, el pedido y la reserva los crea el cliente, y el servidor solo le avisa por ellos («tienes una oferta»,
//  «tu pedido va en camino», «reserva confirmada») si el documento lleva su token de avisos. Hasta hoy cada pantalla
//  lo pegaba a su manera: Solicitar.js lo pedía después de crear el viaje y lo escribía aparte; Restaurantes.js y
//  Turismo.js hacían `await obtenerTokenFCM()` ANTES de crear — así que mientras el cliente no contestara el cartel
//  de permiso, el pedido y la reserva NO NACÍAN — y uno guardaba `null` y el otro no guardaba nada.
//
//  Ahora las tres usan `prepararTokenDeAvisos` de Notificaciones.js. Esta prueba:
//    1. EJECUTA esa pieza con un navegador de mentira: con el cartel sin contestar, preparar y pegar vuelven al
//       instante y no escriben nada; con permiso escribe el token en el campo pedido; sin permiso no escribe; si la
//       escritura falla, no revienta.
//    2. Ata cada pantalla a su colección: pide la pieza ANTES del addDoc, pega DESPUÉS sobre el documento creado,
//       el addDoc ya no lleva el token, y el nombre del campo es el que LEE el servidor para esa colección (sacado de
//       functions/index.js, no copiado).
//    3. Nadie más en la app pide el token por su cuenta.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, sinTextos } = require('./cargar.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { comoPegaElToken } = require('../scripts/medir-token-cliente.cjs');

const NOTIF = 'guajirago/src/Notificaciones.js';

/** Carga Notificaciones.js DE VERDAD, con las piezas de Firebase y del navegador cambiadas por las de mentira. */
function cargarNotificaciones(falsos, fuente = leer(NOTIF)) {
  let t = fuente.replace(/^import[^\n]*\n/gm, '');
  const nombres = [...t.matchAll(/^export\s+const\s+(\w+)/gm)].map((m) => m[1]);
  t = t.replace(/^export\s+/gm, '');
  const claves = Object.keys(falsos);
  // eslint-disable-next-line no-new-func
  return new Function(...claves, t + '\nreturn { ' + nombres.join(', ') + ' };')(...claves.map((k) => falsos[k]));
}

/** Un navegador de mentira. `contesta`: 'granted' | 'denied' | null (el cartel se queda abierto, nadie lo toca). */
function navegador(contesta, { token = 'tok-123', falla = null } = {}) {
  const escritas = [];
  const avisos = [];
  let cartel = 0;
  const Notification = {
    requestPermission: () => { cartel += 1; return contesta === null ? new Promise(() => {}) : Promise.resolve(contesta); },
  };
  const falsos = {
    db: {}, auth: {}, doc: () => ({}), setDoc: async () => {},
    updateDoc: async (ref, datos) => { if (falla) throw new Error(falla); escritas.push({ ref, datos }); },
    getMessaging: () => ({}), getToken: async () => token,
    process: { env: {} }, window: { Notification }, Notification, navigator: {},
    console: { log() {}, warn: (...a) => avisos.push(a.join(' ')) },
  };
  return { falsos, escritas, avisos, cartel: () => cartel };
}

const esperarUnPoco = () => new Promise((r) => setTimeout(r, 20));

describe('G34 · la pieza que pega el token (se ejecuta)', () => {
  it('con el cartel SIN contestar, preparar y pegar vuelven al instante y no escriben nada', async () => {
    const n = navegador(null);
    const { prepararTokenDeAvisos } = cargarNotificaciones(n.falsos);
    const pegar = prepararTokenDeAvisos('clienteFcmToken');
    assert.strictEqual(typeof pegar, 'function', 'preparar tiene que devolver con qué pegar, sin esperar al cartel');
    assert.strictEqual(n.cartel(), 1, 'el cartel tiene que salir al PREPARAR (con el toque fresco), no después');
    const ref = { id: 'P1' };
    let termino = false;
    pegar(ref).then(() => { termino = true; });
    await esperarUnPoco();
    assert.strictEqual(termino, false, 'con el cartel abierto no hay token: pegar se queda esperando, sin estorbar');
    assert.deepStrictEqual(n.escritas, [], 'sin respuesta del cartel no se escribe nada');
  });

  it('con permiso, escribe el token en el campo pedido y del documento creado', async () => {
    const n = navegador('granted', { token: 'tok-ABC' });
    const { prepararTokenDeAvisos } = cargarNotificaciones(n.falsos);
    const ref = { id: 'V9' };
    const ok = await prepararTokenDeAvisos('pasajeroFcmToken')(ref);
    assert.strictEqual(ok, true);
    assert.strictEqual(n.escritas.length, 1);
    assert.strictEqual(n.escritas[0].ref, ref, 'se pega al documento que se acaba de crear');
    assert.deepStrictEqual(n.escritas[0].datos, { pasajeroFcmToken: 'tok-ABC' }, 'solo el campo del token');
  });

  it('sin permiso no escribe nada y dice false', async () => {
    const n = navegador('denied');
    const { prepararTokenDeAvisos } = cargarNotificaciones(n.falsos);
    assert.strictEqual(await prepararTokenDeAvisos('clienteFcmToken')({ id: 'R1' }), false);
    assert.deepStrictEqual(n.escritas, []);
  });

  it('si la escritura falla, no revienta: deja rastro y dice false', async () => {
    const n = navegador('granted', { falla: 'permission-denied' });
    const { prepararTokenDeAvisos } = cargarNotificaciones(n.falsos);
    assert.strictEqual(await prepararTokenDeAvisos('clienteFcmToken')({ id: 'P2' }), false);
    assert.ok(n.avisos.some((a) => /permission-denied/.test(a) && /clienteFcmToken/.test(a)), 'el fallo tiene que quedar en la consola');
  });
});

// ── Las tres pantallas, atadas a su colección y al campo que lee el servidor ──
const INDEX = soloCodigo(leer('guajirago/functions/index.js'));
/** El trozo del servidor que avisa por esa colección, y el campo de token que lee. */
function campoQueLeeElServidor(inicio) {
  const i = INDEX.indexOf(inicio);
  assert.ok(i >= 0, 'no encuentro «' + inicio + '» en functions/index.js');
  const resto = INDEX.slice(i + inicio.length);
  const fin = resto.search(/\nexports\.|\nasync function |\nfunction /);
  const trozo = fin >= 0 ? resto.slice(0, fin) : resto;
  // P23: el aviso al pasajero le pregunta a tokenDelPasajero.cjs; el campo que cuenta es el de la ficha, el PRIMERO
  // que mira la pieza (el cajón y el viaje quedan solo para los viajes de antes).
  if (/\btokenDelPasajero\(/.test(trozo)) {
    const pieza = soloCodigo(leer('guajirago/functions/tokenDelPasajero.cjs'));
    const primero = pieza.match(/return\s+sirve\(\s*ficha\s*&&\s*ficha\.(\w+)\s*\)/);
    assert.ok(primero, 'tokenDelPasajero.cjs ya no mira primero la ficha');
    return primero[1];
  }
  const campos = [...new Set([...trozo.matchAll(/\.(\w+FcmToken)\b/g)].map((m) => m[1]))];
  assert.strictEqual(campos.length, 1, inicio + ' lee ' + campos.length + ' campos de token: ' + campos.join(', '));
  return campos[0];
}

const PANTALLAS = [
  { archivo: 'guajirago/src/Solicitar.js', col: 'viajes', servidor: 'exports.notificarPasajeroOferta' },
  { archivo: 'guajirago/src/Restaurantes.js', col: 'pedidos', servidor: 'async function avisarAlClienteDelCambio' },
  { archivo: 'guajirago/src/Turismo.js', col: 'reservasTurismo', servidor: 'exports.notificarClienteReserva' },
];

/** El paréntesis que cierra la llamada que abre en `abre`. */
function cierre(seguro, abre) {
  let hondo = 0;
  for (let k = abre; k < seguro.length; k++) {
    if (seguro[k] === '(') hondo++;
    else if (seguro[k] === ')' && --hondo === 0) return k;
  }
  return -1;
}

/** Cómo pega el token una pantalla. Devuelve una lista de quejas (vacía = bien). Función pura, para poder sabotearla. */
function quejasDeLaPantalla(texto, col, campo) {
  const quejas = [];
  const t = soloCodigo(texto);
  const seguro = sinTextos(t);
  if (/\bobtenerTokenFCM\b/.test(t)) quejas.push('pide el token por su cuenta (obtenerTokenFCM) en vez de la pieza común');
  const preparos = [...t.matchAll(/const\s+(\w+)\s*=\s*prepararTokenDeAvisos\(\s*'(\w+)'\s*\)/g)];
  if (preparos.length !== 1) { quejas.push('prepara el token ' + preparos.length + ' veces (tiene que ser 1)'); return quejas; }
  const [, pegar, campoPedido] = preparos[0];
  if (campoPedido !== campo) quejas.push('pega «' + campoPedido + '» y el servidor lee «' + campo + '»');
  if (/await\s*$/.test(t.slice(0, preparos[0].index).trimEnd() + ' ') || /await\s+prepararTokenDeAvisos/.test(t)) quejas.push('espera al token antes de crear');
  const alta = t.search(new RegExp("addDoc\\(\\s*collection\\(\\s*db,\\s*'" + col + "'\\s*\\)"));
  if (alta < 0) { quejas.push('no encuentro el addDoc de ' + col); return quejas; }
  if (preparos[0].index > alta) quejas.push('prepara el token DESPUÉS de crear: el cartel sale tarde');
  const fin = cierre(seguro, t.indexOf('(', alta));
  const carga = t.slice(alta, fin);
  if (/FcmToken/.test(carga)) quejas.push('el addDoc todavía lleva el token dentro');
  const antes = t.slice(0, alta);
  const variable = (antes.match(/const\s+(\w+)\s*=\s*await\s*$/) || [])[1];
  if (!variable) { quejas.push('no sé cómo se llama el documento creado'); return quejas; }
  const pegados = [...t.matchAll(new RegExp('\\b' + pegar + '\\(\\s*(\\w+)\\s*\\)', 'g'))];
  // P21 lo llevó del viaje (lo lee todo el mercado) al cajón de contacto; P23 (1-oct-2026) lo lleva a la FICHA del
  // pasajero (`const x = doc(db, 'usuarios', user.uid)`), la única fuente, que lee tokenDelPasajero.cjs.
  const destino = col === 'viajes'
    ? (t.slice(alta).match(/const\s+(\w+)\s*=\s*doc\(\s*db\s*,\s*'usuarios'\s*,\s*user\.uid\s*\)/) || [])[1]
    : variable;
  if (pegados.length !== 1) quejas.push('pega el token ' + pegados.length + ' veces (tiene que ser 1)');
  else {
    if (pegados[0][1] !== destino) quejas.push('pega el token en «' + pegados[0][1] + '», no en ' + (col === 'viajes' ? 'la ficha del pasajero' : 'el documento creado («' + variable + '»)'));
    if (pegados[0].index < fin) quejas.push('pega el token antes de que exista el documento');
    if (/await\s*$/.test(t.slice(0, pegados[0].index))) quejas.push('espera a que se pegue el token');
  }
  return quejas;
}

describe('G34 · las tres pantallas pegan el token con la pieza común', () => {
  for (const p of PANTALLAS) {
    it(p.archivo.split('/').pop() + ' → ' + p.col + ': antes del addDoc prepara, después pega, con el campo del servidor', () => {
      const campo = campoQueLeeElServidor(p.servidor);
      assert.deepStrictEqual(quejasDeLaPantalla(leer(p.archivo), p.col, campo), []);
    });
  }

  it('el vigilante se queja de las formas de antes (si no, no mira nada)', () => {
    const viejaEspera = "const clienteFcmToken = await obtenerTokenFCM();\nconst ref = await addDoc(collection(db, 'pedidos'), { a: 1, clienteFcmToken: clienteFcmToken || null });\n";
    assert.ok(quejasDeLaPantalla(viejaEspera, 'pedidos', 'clienteFcmToken').length > 0);
    const buena = "const pegarToken = prepararTokenDeAvisos('clienteFcmToken');\nconst ref = await addDoc(collection(db, 'pedidos'), { a: 1 });\npegarToken(ref);\n";
    assert.deepStrictEqual(quejasDeLaPantalla(buena, 'pedidos', 'clienteFcmToken'), []);
    assert.ok(quejasDeLaPantalla(buena.replace("'clienteFcmToken'", "'pasajeroFcmToken'"), 'pedidos', 'clienteFcmToken').length > 0, 'campo equivocado');
    assert.ok(quejasDeLaPantalla(buena.replace('pegarToken(ref)', 'pegarToken(otro)'), 'pedidos', 'clienteFcmToken').length > 0, 'documento equivocado');
    assert.ok(quejasDeLaPantalla(buena.replace('pegarToken(ref);', ''), 'pedidos', 'clienteFcmToken').length > 0, 'no pega');
    assert.ok(quejasDeLaPantalla(buena.replace('pegarToken(ref);', 'await pegarToken(ref);'), 'pedidos', 'clienteFcmToken').length > 0, 'espera a pegar');
  });

  it('el medidor ve una sola manera en las tres pantallas y ninguna que espere al cartel', () => {
    for (const p of PANTALLAS) {
      const r = comoPegaElToken(leer(p.archivo));
      assert.strictEqual(r.manera, 'la pieza común', p.archivo + ': ' + r.manera);
      assert.strictEqual(r.espera, 0);
    }
  });

  it('en toda la app, solo Notificaciones.js pide el token del cliente (obtenerTokenFCM)', () => {
    const carpeta = path.join(__dirname, '..', 'guajirago', 'src');
    const fuera = fs.readdirSync(carpeta).filter((f) => f.endsWith('.js') && f !== 'Notificaciones.js')
      .filter((f) => /\bobtenerTokenFCM\b/.test(soloCodigo(fs.readFileSync(path.join(carpeta, f), 'utf8'))));
    assert.deepStrictEqual(fuera, [], 'estas pantallas piden el token por su cuenta');
  });
});

module.exports = { quejasDeLaPantalla, cargarNotificaciones };
