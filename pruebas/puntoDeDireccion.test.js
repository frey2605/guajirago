/**
 * G60 · DE UNA DIRECCIÓN ESCRITA A SU PUNTO SALE DE UNA SOLA PIEZA (29-sep-2026).
 *
 * Antes eran cuatro sitios, cada uno pegándole a mano «, Riohacha, Colombia» y
 * preguntándole a Google por su cuenta: el respaldo del autocompletar y el pedido
 * del viaje (Solicitar.js), y `geocodificarDestino`, repetida en Solicitar.js y
 * AppConductor.js. Ahora los cuatro llaman a `puntoDeDireccion`
 * (direccionDePunto.js) y la ciudad vive en riohacha.js.
 *
 * Todo se EJECUTA: la pieza con un Google de mentira, y los cuatro sitios
 * sacados de su archivo por `scripts/medir-punto-de-direccion.cjs` (el mismo
 * medidor del paso 1 y del 12). Lo que hace cada sitio con el fallo NO cambia:
 * se exige caso por caso, y se carea contra el commit de antes.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp } = require('./cargar.cjs');
const { medir, CASOS, TEXTO, LUGAR } = require('../scripts/medir-punto-de-direccion.cjs');

const { puntoDeDireccion, geocodificadorDe } = cargarDeLaApp('guajirago/src/direccionDePunto.js');
const { CIUDAD_PARA_BUSCAR } = cargarDeLaApp('guajirago/src/riohacha.js');
// El commit de ANTES de G60: los cuatro sitios tienen que hacer lo mismo que hacían ahí.
const ANTES = '2543d70';

const preguntar = (geo, texto) => {
  const salidas = [];
  const pedidas = [];
  const conEspia = geo && { geocode: (req, cb) => { pedidas.push(req); geo.geocode(req, cb); } };
  puntoDeDireccion(conEspia, texto, (r) => salidas.push(r));
  return { salidas, pedidas };
};
const google = (results, status) => ({ geocode: (req, cb) => cb(results, status) });
const conPunto = [{ geometry: { location: { lat: () => LUGAR.lat, lng: () => LUGAR.lng } } }];

describe('G60 · de una dirección escrita a su punto sale de una sola pieza', () => {
  it('la ciudad que se le pega a la dirección es la de siempre', () => {
    assert.strictEqual(CIUDAD_PARA_BUSCAR, ', Riohacha, Colombia');
  });

  it('la pieza contesta el punto, o un fallo con su motivo — siempre una sola vez', () => {
    const bien = preguntar(google(conPunto, 'OK'), TEXTO);
    assert.deepStrictEqual(bien.salidas, [{ ok: true, lat: LUGAR.lat, lng: LUGAR.lng }]);
    assert.deepStrictEqual(bien.pedidas, [{ address: TEXTO + CIUDAD_PARA_BUSCAR }]);
    assert.deepStrictEqual(preguntar(google([], 'ZERO_RESULTS'), TEXTO).salidas, [{ ok: false, motivo: 'ZERO_RESULTS' }]);
    assert.deepStrictEqual(preguntar(google(null, 'REQUEST_DENIED'), TEXTO).salidas, [{ ok: false, motivo: 'REQUEST_DENIED' }]);
    assert.deepStrictEqual(preguntar(null, TEXTO).salidas, [{ ok: false, motivo: 'SIN_MAPAS' }]);
    // «OK» sin punto no es un punto: es un fallo, no unas coordenadas que revientan.
    assert.deepStrictEqual(preguntar(google([{}], 'OK'), TEXTO).salidas, [{ ok: false, motivo: 'OK' }]);
    // Y un punto que llega con otra respuesta que no es «OK» tampoco vale: antes solo se aceptaba con «OK».
    assert.deepStrictEqual(preguntar(google(conPunto, 'OVER_QUERY_LIMIT'), TEXTO).salidas, [{ ok: false, motivo: 'OVER_QUERY_LIMIT' }]);
    // Sin texto NO se le pregunta a Google: preguntar solo por la ciudad devuelve su centro, la plaza.
    const vacio = preguntar(google(conPunto, 'OK'), '');
    assert.deepStrictEqual(vacio.salidas, [{ ok: false, motivo: 'SIN_TEXTO' }]);
    assert.deepStrictEqual(vacio.pedidas, []);
  });

  it('el geocodificador de Google, o nada', () => {
    assert.strictEqual(geocodificadorDe(undefined), null);
    assert.strictEqual(geocodificadorDe({}), null);
    function Geocoder() { this.soy = 'google'; }
    assert.strictEqual(geocodificadorDe({ maps: { Geocoder } }).soy, 'google');
  });

  let hoy;
  it('nadie más escribe la ciudad a mano ni le pregunta a Google por su cuenta (las tres apps)', async () => {
    hoy = await medir();
    assert.ok(hoy.piezaExiste, 'no está puntoDeDireccion en direccionDePunto.js');
    assert.deepStrictEqual(hoy.ciudad, [],
      'estos archivos escriben «Riohacha, Colombia» a mano en vez de usar CIUDAD_PARA_BUSCAR de riohacha.js: '
      + hoy.ciudad.map(([r, n]) => r + ' ×' + n).join(', '));
    assert.deepStrictEqual(hoy.porSuCuenta, [],
      'estos archivos le piden a Google el punto de una dirección por su cuenta en vez de usar puntoDeDireccion: '
      + hoy.porSuCuenta.map(([r, n]) => r + ' ×' + n).join(', '));
  });

  it('cada uno de los cuatro sitios, corrido: pregunta la dirección con la ciudad y solo se queda con el punto si Google lo dio', async () => {
    if (!hoy) hoy = await medir();
    assert.strictEqual(hoy.sitios.length, 4);
    for (const [sitio, casos] of hoy.sitios) {
      for (const [caso, r] of casos) {
        const nombre = sitio + ' · ' + caso;
        assert.ok(!r.falla, nombre + ': ' + r.falla);
        const [, g, texto] = CASOS.find(([c]) => c === caso);
        const preguntaGoogle = !!g && texto !== '';
        assert.deepStrictEqual(r.preguntas, preguntaGoogle ? [TEXTO + CIUDAD_PARA_BUSCAR] : [], nombre + ': qué le preguntó a Google');
        const encontro = preguntaGoogle && g.status === 'OK';
        // El pedido devuelve el punto o `null`; las pantallas llaman (o no) a quien pinta el punto.
        const esperado = sitio.startsWith('el pedido')
          ? (encontro ? LUGAR : null)
          : (encontro ? [LUGAR] : []);
        assert.deepStrictEqual(r.queda, esperado, nombre + ': lo que le quedó a la pantalla');
      }
    }
  });

  it('y es lo mismo que hacía el código de antes (careo contra ' + ANTES + ')', async (t) => {
    try { execFileSync('git', ['cat-file', '-e', ANTES], { cwd: RAIZ, stdio: 'ignore' }); } catch (e) {
      t.skip('este clon no trae el commit ' + ANTES); return;
    }
    if (!hoy) hoy = await medir();
    const antes = await medir(ANTES);
    assert.deepStrictEqual(hoy.sitios, antes.sitios);
    assert.strictEqual(antes.ciudad.reduce((s, [, n]) => s + n, 0), 4, 'antes eran 4 las copias de la ciudad');
    assert.strictEqual(antes.porSuCuenta.reduce((s, [, n]) => s + n, 0), 4, 'antes eran 4 los que preguntaban por su cuenta');
  });
});
