/**
 * G30 · LA DIRECCIÓN DE UN PUNTO DEL MAPA SALE DE UNA SOLA PIEZA (28-sep-2026).
 *
 * Antes eran dos maneras: el mapa de recogida (Solicitar.js) y el botón «Usar mi
 * ubicación» del pedido de comida (Restaurantes.js) le preguntaban a Google cada
 * uno por su cuenta. Si Google fallaba, el mapa dejaba la dirección vacía —y eso
 * se queda igual, a propósito— y el pedido escribía las coordenadas crudas SIN
 * DECIR NADA. Ahora las dos preguntan por `direccionDePunto.js`, y el pedido,
 * cuando falla, deja las coordenadas y lo dice en su ventanita.
 *
 * Todo se EJECUTA: la pieza con un Google de mentira, y las dos pantallas
 * sacadas del archivo por `scripts/medir-direccion-punto.cjs` (el mismo medidor
 * del paso 1 y del 12: no hay una segunda copia del recorrido).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { RAIZ, leer, soloCodigo, cargarDeLaApp } = require('./cargar.cjs');
const { medir, CASOS, PUNTO, CALLE } = require('../scripts/medir-direccion-punto.cjs');

const { direccionDePunto, textoDeCoordenadas } = cargarDeLaApp('guajirago/src/direccionDePunto.js');
const COORDS = '11.544210, -72.907110';
// El commit de ANTES de G30: el mapa de recogida tiene que hacer lo mismo que hacía ahí.
const ANTES = '3acbc85';

const preguntar = (geo) => {
  const salidas = [];
  direccionDePunto(geo, PUNTO.lat, PUNTO.lng, (r) => salidas.push(r));
  return salidas;
};
const google = (results, status) => ({ geocode: (req, cb) => { assert.deepStrictEqual(req, { location: PUNTO }); cb(results, status); } });

describe('G30 · la dirección de un punto del mapa sale de una sola pieza', () => {
  it('la pieza contesta la dirección, o un fallo con su motivo — siempre una sola vez', () => {
    assert.deepStrictEqual(preguntar(google([{ formatted_address: CALLE }], 'OK')), [{ ok: true, direccion: CALLE }]);
    assert.deepStrictEqual(preguntar(google([], 'ZERO_RESULTS')), [{ ok: false, motivo: 'ZERO_RESULTS' }]);
    assert.deepStrictEqual(preguntar(google(null, 'REQUEST_DENIED')), [{ ok: false, motivo: 'REQUEST_DENIED' }]);
    assert.deepStrictEqual(preguntar(null), [{ ok: false, motivo: 'SIN_MAPAS' }]);
    // «OK» pero sin texto no es una dirección: es un fallo, no un campo con «undefined».
    assert.deepStrictEqual(preguntar(google([{}], 'OK')), [{ ok: false, motivo: 'OK' }]);
    assert.strictEqual(textoDeCoordenadas(PUNTO.lat, PUNTO.lng), COORDS);
  });

  const hoy = medir();

  it('nadie más le pide a Google la dirección de un punto por su cuenta (las tres apps)', () => {
    assert.deepStrictEqual(hoy.sitios, [],
      'estos archivos le preguntan a Google por su cuenta en vez de usar direccionDePunto.js: '
      + hoy.sitios.map(([r, n]) => r + ' ×' + n).join(', '));
  });

  it('el mapa de recogida hace EXACTAMENTE lo que hacía antes de G30 (corrido, los 4 casos)', () => {
    const esperado = [CALLE, '', '', ''];
    hoy.mapa.forEach(([nombre, r], i) => {
      assert.ok(!r.falla, nombre + ': ' + r.falla);
      assert.strictEqual(r.llamadas.length, 1, nombre + ': onCambioPunto se llamó ' + r.llamadas.length + ' veces');
      assert.strictEqual(r.llamadas[0].direccion, esperado[i], nombre);
      assert.deepStrictEqual(r.llamadas[0].punto, PUNTO, nombre + ': el punto no es el que se pidió');
      assert.strictEqual(r.llamadas[0].loEligio, true, nombre + ': la marca «lo eligió» no llegó');
    });
  });

  it('y es lo mismo que daba el código de antes (careo contra ' + ANTES + ')', (t) => {
    try { execFileSync('git', ['cat-file', '-e', ANTES], { cwd: RAIZ, stdio: 'ignore' }); } catch (e) {
      t.skip('este clon no trae el commit ' + ANTES); return;
    }
    const antes = medir(ANTES);
    assert.deepStrictEqual(hoy.mapa, antes.mapa);
    assert.strictEqual(antes.sitios.length, 2, 'antes eran 2 los que preguntaban por su cuenta');
  });

  it('el botón del pedido: con dirección la escribe; sin ella deja las coordenadas Y LO DICE', () => {
    const codigo = soloCodigo(leer('guajirago/src/Restaurantes.js'));
    const aviso = /^const SIN_NOMBRE_DE_CALLE\s*=\s*'([^']+)';/m.exec(codigo);
    assert.ok(aviso, 'no está el texto SIN_NOMBRE_DE_CALLE en Restaurantes.js');
    hoy.boton.forEach(([nombre, r], i) => {
      assert.ok(!r.falla, nombre + ': ' + r.falla);
      assert.strictEqual(r.ubicando, false, nombre + ': el botón se queda en «Buscando tu ubicación»');
      if (CASOS[i][1] && CASOS[i][1].status === 'OK') {
        assert.strictEqual(r.direccion, CALLE, nombre);
        assert.strictEqual(r.aviso, '', nombre + ': con dirección no hay nada que avisar');
      } else {
        assert.strictEqual(r.direccion, COORDS, nombre + ': sin dirección tienen que quedar las coordenadas');
        assert.strictEqual(r.aviso, aviso[1], nombre + ': el fallo vuelve a ser mudo');
        assert.ok(r.ventanita, nombre + ': el aviso no llega a ninguna ventanita');
      }
    });
    // Y la ventanita no dice «Ubicación no disponible» cuando la ubicación SÍ se encontró.
    // (G39: la ventanita es AvisoModal y el título va en su `titulo:`; pruebas/ventanitasAviso.test.js lo ejecuta.)
    assert.match(codigo, /titulo: avisoUbic === SIN_NOMBRE_DE_CALLE \? 'Falta el nombre de la calle' : 'Ubicación no disponible'/);
  });
});
