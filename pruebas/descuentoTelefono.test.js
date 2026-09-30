/**
 * P01 · EL TELÉFONO YA NO SE ESCRIBE UN DESCUENTO NI CREA HUELLAS (30-sep-2026)
 *
 * Desde G18 el descuento pendiente (plata) y la huella del aparato (`dispositivosBeneficio`) los escribe SOLO el
 * servidor. P01 lo cerró en `firestore.rules`: el dueño de la ficha solo puede QUEMAR su descuento (null) y nadie crea
 * huellas desde el teléfono. Las reglas se EJECUTAN en pruebas/reglas.test.js («P01 · el descuento lo fabrica el
 * servidor»). Esto prueba el MEDIDOR (scripts/medir-descuento-telefono.cjs), que es la vara con que se cuenta quién
 * escribe, dándole textos y datos de mentira para que no se ablande; y lo corre sobre las TRES apps de verdad: si una
 * pantalla vuelve a escribir un descuento o a tocar las huellas, las reglas la rechazarían en producción EN SILENCIO
 * para el pasajero, así que se para aquí antes.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const M = require('../scripts/medir-descuento-telefono.cjs');

const RECETA = M.recetaDelServidor();

describe('P01 · el medidor de quién escribe el descuento no se ablanda', () => {
  const casos = [
    ['escribir un valor a pelo', "updateDoc(ref, { descuentoPendiente: { valorBeneficio: 999999 } })", { valor: 1 }],
    ['escribir un valor con variable', "setDoc(ref, { nombre, descuentoPendiente: miDescuento }, { merge: true })", { valor: 1 }],
    ['escribir un campo de dentro', "updateDoc(ref, { 'descuentoPendiente.valorBeneficio': 80000 })", { valor: 1 }],
    ['clave entre comillas', 'updateDoc(ref, { "descuentoPendiente": x })', { valor: 1 }],
    ['quemarlo con null', "updateDoc(ref, { descuentoPendiente: null })", { quema: 1 }],
    ['leerlo no cuenta', "const d = snap.data().descuentoPendiente; if (d) setDescuentoPendiente(d);", {}],
    ['desestructurarlo no cuenta', "const { descuentoPendiente } = datos;", {}],
    ['en un comentario no cuenta', "// updateDoc(ref, { descuentoPendiente: { valorBeneficio: 1 } })", {}],
    ['en un comentario de bloque no cuenta', "/* descuentoPendiente: 5 */ const a = 1;", {}],
    ['la huella del aparato', "getDoc(doc(db, 'dispositivosBeneficio', id))", { huella: 1 }],
    ['la huella en un comentario no cuenta', "// dispositivosBeneficio lo escribe el servidor", {}],
  ];
  for (const [nombre, texto, esperado] of casos) {
    it(nombre, () => {
      const r = M.escriturasEn(texto);
      assert.deepStrictEqual(
        { valor: r.valor.length, quema: r.quema.length, huella: r.huella.length },
        { valor: 0, quema: 0, huella: 0, ...esperado });
    });
  }
  it('mira las TRES apps, también en subcarpetas, y no las pruebas ni node_modules (árbol de mentira)', () => {
    const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
    const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'p01-'));
    const poner = (rel, texto) => { fs.mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true }); fs.writeFileSync(path.join(raiz, rel), texto); };
    const malo = "updateDoc(r, { descuentoPendiente: { valorBeneficio: 9 } }); getDoc(doc(db, 'dispositivosBeneficio', 'x'));";
    poner('guajirago/src/pantallas/Uno.js', malo);
    poner('guajirago-admin/src/Dos.js', malo);
    poner('guajirago-aliados/src/Tres.jsx', malo);
    poner('guajirago/src/Cuatro.test.js', malo);
    poner('guajirago-admin/src/node_modules/x/Cinco.js', malo);
    poner('guajirago/functions/index.js', malo);
    try {
      const { cliente, servidor } = M.escritoresEnCodigo(raiz);
      const donde = (s, t) => s.filter((x) => x.tipo === t).map((x) => x.archivo).sort();
      const tres = ['guajirago-admin/src/Dos.js', 'guajirago-aliados/src/Tres.jsx', 'guajirago/src/pantallas/Uno.js'];
      assert.deepStrictEqual(donde(cliente, 'valor'), tres);
      assert.deepStrictEqual(donde(cliente, 'huella'), tres);
      assert.deepStrictEqual(donde(servidor, 'valor'), ['guajirago/functions/index.js']);
    } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
  });
  it('dice el renglón (también con finales de Windows)', () => {
    const r = M.escriturasEn('a\r\nb\r\nupdateDoc(r, { descuentoPendiente: 5 })\r\n');
    assert.deepStrictEqual(r.valor, [3]);
  });
});

describe('P01 · en las tres apps, el teléfono ni fabrica descuentos ni toca huellas', () => {
  const { cliente, servidor } = M.escritoresEnCodigo();
  it('ninguna pantalla escribe un VALOR de descuento (solo lo quema con null)', () => {
    const malos = cliente.filter((s) => s.tipo === 'valor').map((s) => s.archivo + ':' + s.renglon);
    assert.deepStrictEqual(malos, [], '⛔ una pantalla escribe un descuento: las reglas se lo niegan desde P01');
  });
  it('ninguna pantalla nombra dispositivosBeneficio', () => {
    const malos = cliente.filter((s) => s.tipo === 'huella').map((s) => s.archivo + ':' + s.renglon);
    assert.deepStrictEqual(malos, [], '⛔ una pantalla toca las huellas: las reglas se lo niegan desde P01');
  });
  it('y el que quema sigue ahí (Solicitar.js): si desaparece, el descuento se podría gastar dos veces', () => {
    const quema = cliente.filter((s) => s.tipo === 'quema').map((s) => s.archivo);
    assert.deepStrictEqual(quema, ['guajirago/src/Solicitar.js']);
  });
  it('el que sí escribe la huella es el servidor (descuentoDeBienvenida)', () => {
    assert.ok(servidor.some((s) => s.tipo === 'huella' && s.archivo === 'guajirago/functions/index.js'));
  });
});

describe('P01 · ¿pudo este descuento salir del servidor?', () => {
  const promos = { VIVA: { tipoBeneficio: 'credito', valorBeneficio: 5000 } };
  const firmado = (x) => ({ fabricadoPor: 'servidor', ...x });
  it('la bienvenida del servidor cuadra', () => {
    assert.strictEqual(M.porQueNoCuadra(firmado({ promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: RECETA.valorBienvenida }), promos, RECETA), null);
  });
  it('una promoción con su valor cuadra', () => {
    assert.strictEqual(M.porQueNoCuadra(firmado({ promoId: 'VIVA', tipoBeneficio: 'credito', valorBeneficio: 5000 }), promos, RECETA), null);
  });
  for (const [nombre, d] of [
    ['sin firma', { promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: RECETA.valorBienvenida }],
    ['bienvenida de $999.999', firmado({ promoId: 'BIENVENIDA', tipoBeneficio: 'credito', valorBeneficio: 999999 })],
    ['promoción con otro valor', firmado({ promoId: 'VIVA', tipoBeneficio: 'credito', valorBeneficio: 50000 })],
    ['promoción con otro tipo', firmado({ promoId: 'VIVA', tipoBeneficio: 'porcentaje', valorBeneficio: 5000 })],
    ['promoción que no existe', firmado({ promoId: 'INVENTADA', tipoBeneficio: 'credito', valorBeneficio: 5000 })],
  ]) {
    it('NO cuadra: ' + nombre, () => assert.ok(M.porQueNoCuadra(d, promos, RECETA)));
  }
  it('el viaje: descuento aplicado mayor que la tarifa no cuadra', () => {
    assert.ok(M.porQueNoCuadraElViaje({ promoId: 'VIVA', tipoBeneficio: 'credito', valorBeneficio: 5000, tarifaOriginal: 10000, descuentoAplicado: 999999 }, promos, RECETA));
    assert.strictEqual(M.porQueNoCuadraElViaje({ promoId: 'VIVA', tipoBeneficio: 'credito', valorBeneficio: 5000, tarifaOriginal: 10000, descuentoAplicado: 5000 }, promos, RECETA), null);
  });
});
