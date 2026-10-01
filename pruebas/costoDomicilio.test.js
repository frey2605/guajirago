/**
 * P10 · EL DOMICILIO DEL NEGOCIO SALE DE UNA SOLA PIEZA, QUE TAMBIÉN LEE EL NOMBRE VIEJO `costoEnvio` (30-sep-2026)
 *
 * El pendiente (hijo de P09): 2 de los 3 negocios de producción guardan su domicilio en `costoEnvio` —el nombre de
 * antes del 6-jul-2026— y no en `costoDomicilio`, así que el servidor, la app y aliados les ponían $0 de domicilio.
 * Ahora la pregunta «cuánto cobra de domicilio este negocio» la contesta `costoDomicilioDelNegocio`: vive en
 * guajirago/functions/precioPedido.cjs y tiene dos copias atadas (guajirago/src/precioPedido.js y
 * guajirago-aliados/src/costoDomicilio.js). Esta prueba:
 *   1. exige que el trozo entre las marcas sea IGUAL en los tres archivos, y los EJECUTA con los mismos casos;
 *   2. EJECUTA las cuatro miradas (servidor, carrito de la app, confirmar de aliados, perfil de aliados) sacadas del
 *      código de hoy con el medidor, y les exige el valor de la pieza;
 *   3. CAREO con el código de antes (c0f8ee5 / aliados caedbdb): negocio con costoDomicilio → idéntico; negocio solo
 *      con costoEnvio → antes $0, ahora su valor;
 *   4. nadie lee el domicilio del negocio a pelo ni escribe `costoEnvio` (el perfil guarda solo costoDomicilio);
 *   5. el medidor no se puede ablandar.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, copiaIdentica } = require('./cargar.cjs');
const M = require('../scripts/medir-costo-domicilio.cjs');

const ANTES = { raiz: 'c0f8ee5', aliados: 'caedbdb' }; // los últimos commits antes de P10
const SERVIDOR_RUTA = 'guajirago/functions/precioPedido.cjs';
const APP_RUTA = 'guajirago/src/precioPedido.js';
const ALIADOS_RUTA = 'guajirago-aliados/src/costoDomicilio.js';
const SERVIDOR = require('../' + SERVIDOR_RUTA);
const APP = cargarDeLaApp(APP_RUTA);
const ALIADOS = cargarDeLaApp(ALIADOS_RUTA);

const MARCA_A = '// ── EL DOMICILIO DEL NEGOCIO';
const MARCA_B = '// ── FIN DEL DOMICILIO DEL NEGOCIO ──';
function trozo(ruta) {
  const t = leer(ruta).replace(/\r\n/g, '\n');
  const a = t.indexOf(MARCA_A);
  const b = t.indexOf(MARCA_B);
  assert.ok(a >= 0 && b > a, 'no están las marcas del domicilio del negocio en ' + ruta);
  return t.slice(a, b).replace(/^export (function|const) /gm, '$1 ');
}

// [caso, negocio, lo que cobra]
const CASOS = [
  ['solo costoDomicilio', { costoDomicilio: 4000 }, 4000],
  ['solo el nombre viejo costoEnvio', { costoEnvio: 5200 }, 5200],
  ['los dos: manda el de hoy', { costoDomicilio: 3000, costoEnvio: 5000 }, 3000],
  ['domicilio gratis (0) aunque quede el viejo', { costoDomicilio: 0, costoEnvio: 5000 }, 0],
  ['costoDomicilio en null: vale el viejo', { costoDomicilio: null, costoEnvio: 5000 }, 5000],
  ['ninguno', {}, 0],
  ['sin negocio', null, 0],
  ['un texto que no es número', { costoDomicilio: 'x' }, 0],
  ['un número escrito como texto', { costoEnvio: '2500' }, 2500],
];

describe('P10 · la pieza del domicilio es UNA: servidor, app y aliados', () => {
  it('el trozo entre las marcas es igual en los tres archivos', () => {
    const fuente = { nombre: 'el trozo de ' + SERVIDOR_RUTA, texto: trozo(SERVIDOR_RUTA) };
    copiaIdentica({ nombre: 'el trozo de ' + APP_RUTA, texto: trozo(APP_RUTA) }, fuente, 'la copia de la APP se separó de la del servidor');
    copiaIdentica({ nombre: 'el trozo de ' + ALIADOS_RUTA, texto: trozo(ALIADOS_RUTA) }, fuente, 'la copia de ALIADOS se separó de la del servidor');
  });

  for (const [caso, negocio, cobra] of CASOS) {
    it(caso + ' → ' + cobra, () => {
      assert.strictEqual(SERVIDOR.costoDomicilioDelNegocio(negocio), cobra);
      assert.strictEqual(APP.costoDomicilioDelNegocio(negocio), cobra);
      assert.strictEqual(ALIADOS.costoDomicilioDelNegocio(negocio), cobra);
    });
  }
});

describe('P10 · las cuatro miradas, sacadas del código de hoy y ejecutadas', () => {
  it('servidor, carrito, confirmar y perfil dicen lo que dice la pieza', async () => {
    const miradas = M.lasMiradas({});
    for (const [k, v] of Object.entries(miradas.textos)) assert.ok(v, 'el medidor no encontró la mirada «' + k + '» en el código');
    const filas = await M.cadaNegocio(M.EJEMPLOS, miradas);
    for (const f of filas) {
      const n = M.EJEMPLOS.find((e) => e.id === f.id);
      const pieza = SERVIDOR.costoDomicilioDelNegocio(n);
      assert.strictEqual(f.servidor, pieza, f.nombre + ': el servidor');
      assert.strictEqual(f.app, pieza, f.nombre + ': el carrito de la app');
      assert.strictEqual(f.confirmar, pieza, f.nombre + ': confirmar en aliados');
      const hayAlgo = n.costoDomicilio !== undefined || n.costoEnvio !== undefined;
      assert.strictEqual(f.perfil, hayAlgo ? String(pieza) : '', f.nombre + ': el perfil de aliados');
    }
  });

  it('CAREO con el código de antes: con costoDomicilio idéntico; solo con costoEnvio antes $0, ahora su valor', async () => {
    const [antes, ahora] = await Promise.all([M.lasMiradas(ANTES), M.lasMiradas({})].map((m) => M.cadaNegocio(M.EJEMPLOS, m)));
    const de = (filas, id) => filas.find((f) => f.id === id);
    for (const id of ['con-domicilio', 'los-dos', 'gratis', 'ninguno']) {
      const { servidor, app, confirmar, perfil } = de(antes, id);
      assert.deepStrictEqual({ servidor, app, confirmar, perfil },
        (({ servidor: s, app: a, confirmar: c, perfil: p }) => ({ servidor: s, app: a, confirmar: c, perfil: p }))(de(ahora, id)), id);
    }
    const a = de(antes, 'solo-envio');
    const h = de(ahora, 'solo-envio');
    assert.deepStrictEqual([a.servidor, a.app, a.confirmar, a.perfil], [0, 0, 0, '']);
    assert.deepStrictEqual([h.servidor, h.app, h.confirmar, h.perfil], [5200, 5200, 5200, '5200']);
  });
});

describe('P10 · nadie lee el domicilio a pelo ni escribe costoEnvio', () => {
  const textosDeHoy = () => {
    const t = {};
    for (const r of ['guajirago/src/Restaurantes.js', SERVIDOR_RUTA, APP_RUTA, ALIADOS_RUTA,
      'guajirago-aliados/src/PedidosDomicilio.js', 'guajirago-aliados/src/PerfilRestaurante.js']) t[r] = leer(r);
    return t;
  };

  it('las seis lecturas pasan por la pieza, ninguna a pelo, y nadie escribe costoEnvio', () => {
    const s = M.sitiosDelCodigo(textosDeHoy());
    assert.deepStrictEqual(s.leenDirecto, [], 'alguien lee el domicilio del negocio sin la pieza');
    assert.deepStrictEqual(s.escribenEnvio, [], 'alguien escribe el nombre viejo costoEnvio');
    const porArchivo = {};
    for (const x of s.porLaPieza) { const f = x.split(':')[0]; porArchivo[f] = (porArchivo[f] || 0) + 1; }
    assert.deepStrictEqual(porArchivo, {
      'guajirago/src/Restaurantes.js': 3, [SERVIDOR_RUTA]: 1,
      'guajirago-aliados/src/PedidosDomicilio.js': 1, 'guajirago-aliados/src/PerfilRestaurante.js': 1,
    });
  });

  it('el perfil de aliados guarda el domicilio SOLO en costoDomicilio', () => {
    const t = leer('guajirago-aliados/src/PerfilRestaurante.js').replace(/\r\n/g, '\n');
    const m = t.match(/await updateDoc\(doc\(db, 'negocios', restauranteId\), \{[^}]*\}/);
    assert.ok(m, 'no encontré el guardado del perfil');
    assert.match(m[0], /costoDomicilio: parseInt\(costoDomicilio/);
    assert.doesNotMatch(m[0], /costoEnvio/);
  });
});

describe('P10 · el medidor no se puede ablandar', () => {
  it('cuenta una lectura a pelo, una escritura del nombre viejo y no se deja engañar por un comentario', () => {
    const s = M.sitiosDelCodigo({
      'a.js': 'const x = restauranteActivo.costoDomicilio || 0;\n// negocio.costoEnvio en un comentario\n',
      'b.js': "await updateDoc(ref, { costoEnvio: 5 });\nconst y = snap.data().costoEnvio;\n",
      'c.js': 'const z = costoDomicilioDelNegocio(negocio);\n',
    });
    assert.deepStrictEqual(s.leenDirecto, ['a.js:1', 'b.js:2']);
    assert.deepStrictEqual(s.escribenEnvio, ['b.js:1']);
    assert.deepStrictEqual(s.porLaPieza, ['c.js:1']);
  });

  it('lo que la pieza lee por dentro no cuenta, pero lo de fuera de sus marcas sí', () => {
    const t = MARCA_A + ' ──\nfunction costoDomicilioDelNegocio(negocio) { return negocio.costoDomicilio; }\n' + MARCA_B
      + '\nconst w = negocio.costoDomicilio;\n';
    assert.deepStrictEqual(M.sitiosDelCodigo({ 'd.js': t }).leenDirecto, ['d.js:4']);
  });
});
