/**
 * P13 · EL CLIENTE YA NO PUEDE LLENAR SU PEDIDO HASTA DEJAR AL SERVIDOR SIN SITIO (1-oct-2026)
 *
 * El pendiente (hijo de P12): el cliente creaba su pedido con lo que quisiera dentro —un campo de sobra, un texto
 * enorme— hasta casi 1 MiB, el máximo de un documento. Entonces la revisión del precio (ponerElPrecioDelServidor,
 * guajirago/functions/precioPedido.cjs) no cabía para escribir el precio, ni la marca de «sin revisar» (P11): el
 * pedido se quedaba con la plata del teléfono y aliados solo lo sabía pasados 2 minutos.
 *
 * Se cierra en dos sitios, porque las reglas no pueden mirar dentro de las líneas (no recorren listas):
 *   · firestore.rules: el pedido del cliente nace con la LISTA CERRADA de campos que manda la app y con topes de
 *     tamaño; y después el cliente solo cambia lo que la app le cambia (cancelar, motivo, un mensaje, estrellas,
 *     token), también con topes.
 *   · precioPedido.cjs: la revisión guarda de cada línea solo sus campos conocidos, recortados.
 *
 * Esta prueba:
 *   1. ATA la lista de las reglas a lo que escribe la app (Restaurantes.js): si la app escribe un campo nuevo y nadie
 *      lo añade a las reglas, se pone roja (una lista cerrada a la que le falta uno rompe la app en silencio).
 *   2. EJECUTA la revisión con pedidos llenos (scripts/medir-pedido-cerrado.cjs, base estricta): con la de hoy todos
 *      caben y quedan revisados; con la de antes (c61de14) no cabían; los honrados salen IGUALES (careo).
 *   3. CAREA LAS REGLAS en el emulador, las de antes y las de hoy, cada una en su propio proyecto: cada escritura
 *      legítima (del cliente, del restaurante y del panel) pasa con las dos, y cada veneno pasaba antes y hoy no.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const M = require('../scripts/medir-pedido-cerrado.cjs');
const V = require('../scripts/medir-revision-venenosa.cjs');

const RAIZ = path.resolve(__dirname, '..');
const ANTES = 'c61de14';
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const deAntes = (rel) => execFileSync('git', ['show', ANTES + ':' + rel], { cwd: RAIZ, encoding: 'utf8' });

describe('P13 · la lista de las reglas es la de la app', () => {
  it('las reglas dejan EXACTAMENTE lo que la app escribe en un pedido (ni uno menos, ni uno de más)', () => {
    const app = M.escriturasDeLaApp(leer('guajirago/src/Restaurantes.js'));
    const reglas = M.listasDeLasReglas(leer('firestore.rules'));
    assert.ok(reglas.crear && reglas.cambiar && reglas.mensaje, 'las reglas del pedido no tienen sus tres listas');
    assert.deepStrictEqual([...new Set(app.crear)].sort(), [...reglas.crear].sort(), 'al CREAR, la app y las reglas no dicen lo mismo');
    assert.deepStrictEqual([...new Set([...app.cambiar.flat(), ...app.token])].sort(), [...reglas.cambiar].sort(), 'al CAMBIAR, la app y las reglas no dicen lo mismo');
    assert.deepStrictEqual([...new Set(app.mensaje)].sort(), [...reglas.mensaje].sort(), 'el MENSAJE del chat: la app y las reglas no dicen lo mismo');
    // Que el lector ve de verdad lo que la app escribe (si se quedara ciego, la comparación de arriba no diría nada).
    assert.ok(app.crear.length >= 14 && app.cambiar.length >= 4 && app.token.includes('clienteFcmToken') && app.mensaje.includes('texto'),
      'el lector de la app no encontró sus escrituras: ' + JSON.stringify(app));
  });

  it('el lector no se ablanda: un campo nuevo en la app sale como «fuera de las reglas»', () => {
    const reglas = M.listasDeLasReglas(leer('firestore.rules'));
    const app = leer('guajirago/src/Restaurantes.js');
    const conCampo = app.replace("tipo: 'domicilio',", "tipo: 'domicilio',\n        notaDelCliente: 'x',");
    assert.notStrictEqual(conCampo, app, 'no encontré dónde meter el campo nuevo');
    assert.deepStrictEqual(M.loQueLaAppEscribeYLasReglasNo(M.escriturasDeLaApp(conCampo), reglas).crear, ['notaDelCliente']);
    const conCambio = app.replace("{ calificado: true, estrellas: estrellasCal }", "{ calificado: true, estrellas: estrellasCal, opinion: 'x' }");
    assert.notStrictEqual(conCambio, app, 'no encontré la marca de calificado');
    assert.deepStrictEqual(M.loQueLaAppEscribeYLasReglasNo(M.escriturasDeLaApp(conCambio), reglas).cambiar, ['opinion']);
    // Y las reglas de antes no tenían lista: no se pueden dar por buenas.
    assert.strictEqual(M.listasDeLasReglas(deAntes('firestore.rules')).crear, null);
  });
});

describe('P13 · la revisión del servidor siempre cabe', () => {
  it('con la pieza de hoy, todo pedido lleno que dejan las reglas queda REVISADO y lejos del máximo', async () => {
    const filas = await M.medirServidor(null);
    for (const f of filas.filter((x) => x.reglas === 'entra')) {
      assert.strictEqual(f.revienta, false, f.nombre + ': ' + f.motivo);
      assert.strictEqual(f.estado, 'revisado', f.nombre);
      assert.ok(f.despues < M.LIMITE_DOCUMENTO - 100000, f.nombre + ' quedó de ' + f.despues + ' bytes');
    }
    // Los llenos con el bulto en una línea quedan en menos de 1 KB.
    for (const f of filas.filter((x) => !x.honrado && x.reglas === 'entra' && !/PEOR/.test(x.nombre))) {
      assert.ok(f.despues < 1000, f.nombre + ' quedó de ' + f.despues + ' bytes');
    }
    // De cada línea solo quedan sus campos conocidos (y los de la promoción, que pone el servidor).
    const conocidos = ['lineaId', 'firma', 'id', 'nombre', 'precio', 'cantidad', 'adiciones', 'promoId', 'promoNombre', 'precioOriginal'];
    for (const f of filas) for (const l of (f.items || [])) {
      assert.deepStrictEqual(Object.keys(l).filter((k) => !conocidos.includes(k)), [], f.nombre);
      for (const v of Object.values(l)) if (typeof v === 'string') assert.ok(v.length <= 200, f.nombre + ': un texto de ' + v.length);
      for (const a of (l.adiciones || [])) assert.deepStrictEqual(Object.keys(a).sort(), ['nombre', 'precio'], f.nombre);
    }
  });

  it('CAREO · con la pieza de antes (c61de14) los 4 llenos no cabían ni para la marca; los honrados salen IGUALES', async () => {
    const antes = await M.medirServidor(ANTES);
    const hoy = await M.medirServidor(null);
    const noCabian = antes.filter((f) => f.reglas === 'entra' && !f.honrado && f.revienta);
    assert.strictEqual(noCabian.length, 4, 'la base estricta ya no muerde con la pieza vieja: ' + JSON.stringify(antes.map((f) => [f.nombre, f.revienta])));
    for (const f of noCabian) assert.strictEqual(f.marca, 'tampoco cabe', f.nombre);
    const huella = (f) => JSON.stringify({ items: f.items, subtotal: f.subtotal, estado: f.estado });
    for (const n of antes.filter((f) => f.honrado).map((f) => f.nombre)) {
      assert.strictEqual(huella(hoy.find((f) => f.nombre === n)), huella(antes.find((f) => f.nombre === n)), n);
    }
    // Y los honrados del medidor de P12 (la app de hoy, con y sin promoción) también, contra la pieza de antes.
    const viejos = await V.medirCodigo(ANTES);
    const nuevos = await V.medirCodigo(null);
    for (const f of viejos.filter((x) => x.honrado)) assert.strictEqual(V.huella(nuevos.find((x) => x.nombre === f.nombre)), V.huella(f), f.nombre);
  });
});

// ── EL CAREO DE LAS REGLAS EN EL EMULADOR ──

let RUT;
let FS;
const entornos = {};
const PROYECTOS = { antes: 'demo-p13-antes', hoy: 'demo-p13-hoy' };

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
const MENSAJE = (extra) => ({ de: 'cliente', texto: 'Ya pagué', imagen: '', fecha: '2026-10-01T12:00:00.000Z', ...(extra || {}) });
/** Lo que manda la app al crear (Restaurantes.js, enviarPedido), con `creado` de la hora del servidor. */
const DE_LA_APP = (FSm) => ({
  restauranteId: 'r1', clienteId: 'ana', restauranteNombre: 'La Guajira', cliente: 'Ana', telefono: '3001112233',
  direccion: 'Calle 1 #2-3', items: [{ lineaId: 'l_1', firma: 'p1|Queso', id: 'p1', nombre: 'Sancocho', precio: 20000, cantidad: 2, adiciones: [{ nombre: 'Queso', precio: 2000 }] }],
  subtotal: 40000, costoDomicilio: 4000, total: 44000, metodoPago: 'Nequi', estado: 'nuevo', tipo: 'domicilio', creado: FSm.serverTimestamp(),
});
/** Un pedido de Ana ya creado (lo deja la base sin reglas), en `estado`, con el chat que se diga. */
const SEMBRADO = (estado, mensajes) => ({
  restauranteId: 'r1', clienteId: 'ana', restauranteNombre: 'La Guajira', cliente: 'Ana', telefono: '3001112233', direccion: 'Calle 1',
  items: [{ id: 'p1', nombre: 'Sancocho', precio: 18000, cantidad: 1, adiciones: [] }], subtotal: 18000, costoDomicilio: 4000, total: 22000,
  metodoPago: 'Nequi', estado, tipo: 'domicilio', revisionServidor: { evento: 'e', estado: 'revisado', promos: [], problemas: [] },
  ...(mensajes ? { mensajesPedido: mensajes } : {}),
});

async function sembrar(entorno) {
  await entorno.clearFirestore();
  await entorno.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const { doc, setDoc } = FS;
    await setDoc(doc(db, 'usuarios/ana'), { nombre: 'Ana', rol: '' });
    await setDoc(doc(db, 'usuarios/eladmin'), { nombre: 'Admin', rol: 'admin' });
    await setDoc(doc(db, 'negocios/r1'), { nombre: 'La Guajira', activo: true });
    await setDoc(doc(db, 'empleados/emp1'), { restauranteId: 'r1', activo: true });
    await setDoc(doc(db, 'pedidos/nuevo'), SEMBRADO('nuevo'));
    await setDoc(doc(db, 'pedidos/conChat'), SEMBRADO('confirmado', [{ de: 'restaurante', texto: 'Envía el comprobante', imagen: '', fecha: '2026-10-01T11:00:00.000Z' }]));
    await setDoc(doc(db, 'pedidos/entregado'), SEMBRADO('entregado'));
    await setDoc(doc(db, 'pedidos/lleno'), SEMBRADO('confirmado', Array.from({ length: 100 }, (_, i) => MENSAJE({ texto: 'm' + i }))));
    await setDoc(doc(db, 'pedidos/mesa'), { restauranteId: 'r1', tipo: 'local', mesa: 3, items: [{ id: 'p1', nombre: 'Sancocho', precio: 18000, cantidad: 1, obsLibre: 'sin sal' }], total: 18000, estado: 'tomado', tomadoPor: 'Juan', creado: '2026-10-01T12:00:00.000Z', mensajesPedido: [] });
  });
}

/**
 * Cada escritura: [quién, qué hace, (db, FS) => promesa, ¿pasaba antes?, ¿pasa hoy?]. Las LEGÍTIMAS (las que hace hoy
 * alguna app, medidas en el código y en el paquete publicado) pasan con las dos reglas; los VENENOS pasaban y ya no.
 */
const ESCRITURAS = [
  // ── legítimas del cliente (Restaurantes.js; el token, Notificaciones.js; el robot de pruebas crea con fecha en texto)
  ['ana', 'crea su pedido como la app', (db, F) => F.addDoc(F.collection(db, 'pedidos'), DE_LA_APP(F)), true, true],
  ['ana', 'crea su pedido como el robot (fecha en texto, sin domicilio)', (db, F) => F.setDoc(F.doc(db, 'pedidos/robot'), { ...DE_LA_APP(F), creado: '2026-10-01T12:00:00.000Z' }), true, true],
  ['ana', 'crea su pedido con textos largos de verdad (nombre 120, dirección 400)', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), cliente: 'A'.repeat(120), direccion: 'D'.repeat(400) }), true, true],
  ['ana', 'cancela', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { estado: 'cancelado', canceladoPor: 'cliente' }), true, true],
  ['ana', 'deja el motivo', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { motivoCancelacion: 'Me demoré en pagar' }), true, true],
  ['ana', 'manda el primer mensaje del chat', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { mensajesPedido: F.arrayUnion(MENSAJE()) }), true, true],
  ['ana', 'contesta en un chat que ya tiene mensajes, con foto', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { mensajesPedido: F.arrayUnion(MENSAJE({ texto: '', imagen: 'https://firebasestorage.googleapis.com/v0/b/x/o/pedidosRestaurantes%2Fa%2F1.jpg?alt=media&token=' + 'a'.repeat(36) })) }), true, true],
  ['ana', 'califica', (db, F) => F.updateDoc(F.doc(db, 'pedidos/entregado'), { calificado: true, estrellas: 4 }), true, true],
  ['ana', 'pega su token de avisos', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { clienteFcmToken: 't'.repeat(163) }), true, true],
  // ── legítimas del restaurante (aliados: PedidosDomicilio.js y Mesero.js) y del panel: no cambian
  ['r1', 'crea un pedido de mesa (Mesero.js)', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { restauranteId: 'r1', tipo: 'local', mesa: 2, items: [{ id: 'p1', nombre: 'Sancocho', precio: 18000, cantidad: 1, ingredientesQuitados: [], obsSeleccionadas: [], obsLibre: '' }], total: 18000, estado: 'tomado', tomadoPor: 'Juan', creado: F.serverTimestamp(), mensajesPedido: [] }), true, true],
  ['r1', 'confirma con su domicilio', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { estado: 'confirmado', tiempoEstimado: 30, costoDomicilio: 5000, subtotal: 18000, total: 23000 }), true, true],
  ['r1', 'lo rechaza', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { estado: 'cancelado', motivoRechazo: 'Sin gas', canceladoPor: 'restaurante' }), true, true],
  ['r1', 'lo manda con el domiciliario', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { estado: 'en_camino', domiciliario: 'Pedro', fechaEnCamino: '2026-10-01T12:30:00.000Z' }), true, true],
  ['r1', 'cierra la venta con sus pagos', (db, F) => F.updateDoc(F.doc(db, 'pedidos/entregado'), { estado: 'cerrado', metodoPago: 'Mixto', pagos: [{ metodo: 'Nequi', monto: 10000 }, { metodo: 'Efectivo', monto: 12000 }], fechaCierre: '2026-10-01T13:00:00.000Z', comprobantes: ['https://x/1.jpg'] }), true, true],
  ['r1', 'escribe en el chat', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { mensajesPedido: F.arrayUnion({ de: 'restaurante', texto: 'Recibido', imagen: '', fecha: '2026-10-01T12:05:00.000Z' }) }), true, true],
  ['emp1', 'cierra la mesa con el reparto (Mesero.js)', (db, F) => F.updateDoc(F.doc(db, 'pedidos/mesa'), { estado: 'cerrado', fechaCierre: '2026-10-01T14:00:00.000Z', metodoPago: 'Efectivo', pagos: [{ metodo: 'Efectivo', monto: 18000 }], propina: 2000, reparto: [{ nombre: 'Ana', items: [] }] }), true, true],
  ['eladmin', 'el panel (hoy no escribe pedidos; su permiso no cambia)', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { estado: 'cancelado', notaAdmin: 'duplicado' }), true, true],

  // ── VENENOS del cliente al crear
  ['ana', 'VENENO · crea con un campo de sobra casi de 1 MiB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), relleno: GRANDE }), true, false],
  ['ana', 'VENENO · crea con un campo de sobra chiquito', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), notaDelCliente: 'hola' }), true, false],
  ['ana', 'VENENO · crea con la dirección de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), direccion: GRANDE }), true, false],
  ['ana', 'VENENO · crea con el nombre de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), cliente: GRANDE }), true, false],
  ['ana', 'VENENO · crea con el nombre del negocio de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), restauranteNombre: GRANDE }), true, false],
  ['ana', 'VENENO · crea con el método de pago de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), metodoPago: GRANDE }), true, false],
  ['ana', 'VENENO · crea con el tipo de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), tipo: GRANDE }), true, false],
  ['ana', 'VENENO · crea con la fecha de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), creado: GRANDE }), true, false],
  ['ana', 'VENENO · crea con 10.000 líneas', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), items: Array.from({ length: 10000 }, () => ({ id: 'p1' })) }), true, false],
  ['ana', 'VENENO · crea con 101 líneas', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), items: Array.from({ length: 101 }, () => ({ id: 'p1', cantidad: 1 })) }), true, false],
  ['ana', 'VENENO · crea con las líneas como un mapa de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), items: { a: GRANDE } }), true, false],
  ['ana', 'VENENO · crea con el total como texto de 900 KB', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), total: GRANDE }), true, false],
  ['ana', 'VENENO · crea con el chat ya lleno', (db, F) => F.addDoc(F.collection(db, 'pedidos'), { ...DE_LA_APP(F), mensajesPedido: Array.from({ length: 10000 }, () => MENSAJE()) }), true, false],
  // ── VENENOS del cliente al cambiar
  ['ana', 'VENENO · le añade un campo de sobra de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { nota: GRANDE }), true, false],
  ['ana', 'VENENO · le cambia la dirección', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { direccion: 'Otra' }), true, false],
  ['ana', 'VENENO · motivo de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { motivoCancelacion: GRANDE }), true, false],
  ['ana', 'VENENO · token de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { clienteFcmToken: GRANDE }), true, false],
  ['ana', 'VENENO · un mensaje de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { mensajesPedido: F.arrayUnion(MENSAJE({ texto: GRANDE })) }), true, false],
  ['ana', 'VENENO · un mensaje con un campo de sobra', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { mensajesPedido: F.arrayUnion(MENSAJE({ relleno: 'x' })) }), true, false],
  ['ana', 'VENENO · el chat con 10.000 mensajes de una', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { mensajesPedido: Array.from({ length: 10000 }, (_, i) => MENSAJE({ texto: 'm' + i })) }), true, false],
  ['ana', 'VENENO · el mensaje 101', (db, F) => F.updateDoc(F.doc(db, 'pedidos/lleno'), { mensajesPedido: F.arrayUnion(MENSAJE({ texto: 'otro' })) }), true, false],
  ['ana', 'VENENO · se hace pasar por el restaurante en el chat', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { mensajesPedido: F.arrayUnion({ ...MENSAJE(), de: 'restaurante' }) }), true, false],
  ['ana', 'VENENO · le borra el mensaje al restaurante', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { mensajesPedido: [MENSAJE()] }), true, false],
  ['ana', 'VENENO · le cambia el mensaje al restaurante (por uno de 900 KB) y añade el suyo', (db, F) => F.updateDoc(F.doc(db, 'pedidos/conChat'), { mensajesPedido: [{ de: 'restaurante', texto: GRANDE, imagen: '', fecha: '2026-10-01T11:00:00.000Z' }, MENSAJE()] }), true, false],
  ['ana', 'VENENO · manda dos mensajes de una, el segundo de 900 KB', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { mensajesPedido: F.arrayUnion(MENSAJE(), MENSAJE({ texto: GRANDE })) }), true, false],
  ['ana', 'VENENO · 99 estrellas', (db, F) => F.updateDoc(F.doc(db, 'pedidos/entregado'), { calificado: true, estrellas: 99 }), true, false],
  ['ana', 'VENENO · cancela diciendo que fue el restaurante', (db, F) => F.updateDoc(F.doc(db, 'pedidos/nuevo'), { estado: 'cancelado', canceladoPor: 'restaurante' }), true, false],
];

describe('P13 · CAREO de las reglas: las de antes (c61de14) y las de hoy, en el emulador', () => {
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
});
