/**
 * LA LLAVE DE GOOGLE MAPS — PRUEBAS (gemelo G62, 29-sep-2026)
 *
 * La llave de Google Maps estaba escrita a mano en dos `public/index.html` (transporte y aliados),
 * aparte de todas las demás llaves públicas, que viven en el `.env` de cada ambiente. Ahora cada
 * `index.html` escribe `%REACT_APP_GOOGLE_MAPS_KEY%` y Create React App la reemplaza al compilar
 * con la del `.env.<ambiente>` que carga `env-cmd`. Esta prueba:
 *   1. corre el medidor sobre el disco: 0 llaves a mano, cada index.html toma la marca UNA vez, y
 *      en los dos ambientes de las dos apps la llave que viaja es una llave de Google (si un `.env`
 *      no la trae, la marca se queda sin reemplazar y la app saldría SIN MAPA);
 *   2. exige que transporte y aliados lleven la MISMA llave en cada ambiente, y que el panel no
 *      cargue Maps;
 *   3. corre la pieza REAL de CRA que hace el reemplazo (InterpolateHtmlPlugin de cada app);
 *   4. le da al medidor pantallas de mentira (y el código de ANTES) y exige que las vea todas: que
 *      no se pueda ablandar.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { medir, lector, interpolarComoCRA, scriptsDeMaps, NOMBRE, MARCA } = require('../scripts/medir-llave-maps.cjs');
const { leerEnv } = require('../scripts/medir-ambientes.cjs');

const disco = lector(null, null);
const LLAVE = /^AIza[0-9A-Za-z_-]{35}$/;

/** Un lector que cambia UN archivo del disco (una pantalla de mentira). */
const conCambio = (ruta, cambiar) => (r) => (r === ruta ? cambiar(disco(r)) : disco(r));

describe('G62 · la llave de Google Maps sale del .env de cada ambiente', () => {
  const r = medir(disco);

  it('ninguna llave de Google escrita a mano en los index.html, y el medidor no ve fallas', () => {
    assert.deepStrictEqual(r.fallas, []);
    assert.strictEqual(r.aMano, 0);
  });

  it('transporte y aliados cargan Maps UNA vez, con la marca de CRA', () => {
    for (const nombre of ['transporte', 'aliados']) {
      const a = r.apps.find((x) => x.nombre === nombre);
      assert.strictEqual(a.scripts, 1, nombre + ': <script> de Maps');
      assert.strictEqual(a.marcas, 1, nombre + ': ' + MARCA);
      const s = scriptsDeMaps(disco(a.rutaHtml))[0];
      assert.strictEqual(s.llave, MARCA, nombre + ': el key= del <script> de Maps no es la marca');
    }
  });

  it('en los dos ambientes de las dos apps viaja una llave de Google, la del .env, y es la misma en las dos apps', () => {
    for (const amb of ['pruebas', 'produccion']) {
      const llaves = ['transporte', 'aliados'].map((nombre) => {
        const e = r.apps.find((x) => x.nombre === nombre).ambientes[amb];
        assert.strictEqual(e.sinResolver, false, nombre + ' · ' + amb);
        assert.match(e.llave, LLAVE, nombre + ' · ' + amb);
        assert.strictEqual(e.llave, leerEnv(disco(e.rutaEnv))[NOMBRE], nombre + ' · ' + amb + ': no es la del .env');
        return e.llave;
      });
      assert.strictEqual(llaves[0], llaves[1], amb + ': transporte y aliados con llaves distintas');
    }
  });

  it('el panel no carga Maps', () => {
    const p = r.apps.find((x) => x.nombre === 'panel');
    assert.strictEqual(p.scripts, 0);
    assert.strictEqual(p.aMano, 0);
  });

  it('corre la pieza REAL de CRA: reemplaza la marca, deja lo que no conoce y no toca lo demás', () => {
    for (const carpeta of ['guajirago', 'guajirago-aliados']) {
      const html = '<a href="%PUBLIC_URL%/x">%REACT_APP_GOOGLE_MAPS_KEY% %NO_EXISTE% %react_app_otra%</a>';
      const out = interpolarComoCRA(html, { REACT_APP_GOOGLE_MAPS_KEY: 'LLAVE', react_app_otra: 'b', OTRA: 'no' }, carpeta);
      assert.strictEqual(out, '<a href="/x">LLAVE %NO_EXISTE% b</a>', carpeta);
    }
  });
});

describe('G62 · el medidor de la llave no se puede ablandar', () => {
  const T = 'guajirago/public/index.html';
  const A = 'guajirago-aliados/public/index.html';
  const LA_DE_HOY = leerEnv(disco('guajirago/.env.produccion'))[NOMBRE];
  const casos = [
    ['la llave escrita a mano otra vez en transporte', conCambio(T, (t) => t.replace(MARCA, LA_DE_HOY)), /a mano en guajirago\/public/],
    ['una llave a mano en un comentario del panel', conCambio('guajirago-admin/public/index.html', (t) => t + '<!-- ' + LA_DE_HOY + ' -->'), /panel: 1 llave/],
    ['el .env de producción de aliados sin la llave', conCambio('guajirago-aliados/.env.produccion', (t) => t.replace(NOMBRE + '=', 'OTRA_COSA=')), /aliados · produccion: la llave de Maps queda SIN REEMPLAZAR/],
    ['la llave vacía en el .env de pruebas de transporte', conCambio('guajirago/.env.pruebas', (t) => t.replace(/REACT_APP_GOOGLE_MAPS_KEY=.*/, 'REACT_APP_GOOGLE_MAPS_KEY=')), /transporte · pruebas: la llave de Maps queda SIN REEMPLAZAR/],
    ['la marca mal escrita en aliados', conCambio(A, (t) => t.replace(MARCA, '%REACT_APP_GOOGLE_MAP_KEY%')), /aliados · pruebas: la llave de Maps queda SIN REEMPLAZAR/],
    ['una llave que no es de Google', conCambio('guajirago/.env.produccion', (t) => t.replace(/REACT_APP_GOOGLE_MAPS_KEY=.*/, 'REACT_APP_GOOGLE_MAPS_KEY=cualquiercosa')), /transporte · produccion: la llave de Maps que viaja no es una llave de Google/],
    ['aliados con otra llave en pruebas', conCambio('guajirago-aliados/.env.pruebas', (t) => t.replace(/(REACT_APP_GOOGLE_MAPS_KEY=AIza)./, '$1Z')), /pruebas: transporte y aliados viajan con llaves de Maps DISTINTAS/],
    ['Maps cargado dos veces en transporte', conCambio(T, (t) => t.replace('<title>', '<script src="https://maps.googleapis.com/maps/api/js?key=' + MARCA + '"></script><title>')), /transporte: .* carga Maps 2 veces/],
    ['transporte sin cargar Maps', conCambio(T, (t) => t.replace(/<script defer src="https:\/\/maps[^>]*><\/script>/, '')), /transporte: .* carga Maps 0 veces/],
    ['el panel cargando Maps', conCambio('guajirago-admin/public/index.html', (t) => t.replace('<title>', '<script src="https://maps.googleapis.com/maps/api/js?key=%X%"></script><title>')), /panel: .* carga Maps y no debería/],
    ['el index.html de transporte que no está', conCambio(T, () => null), /transporte: no existe/],
  ];
  for (const [nombre, leer, espera] of casos) {
    it(nombre, () => {
      const r = medir(leer);
      assert.ok(r.fallas.some((f) => espera.test(f)), 'el medidor no lo vio: ' + JSON.stringify(r.fallas));
    });
  }

  // (Que producción siga viajando con la MISMA llave que antes se careó una vez, compilando de verdad antes
  // y después; no se deja aquí porque el día que el dueño cambie la llave esta prueba se pondría roja sin motivo.)
  it('el código de ANTES de G62 (b9d47e6 / 238d3c4): 2 llaves a mano', () => {
    const r = medir(lector('b9d47e6', '238d3c4'));
    assert.strictEqual(r.aMano, 2);
    assert.ok(r.fallas.some((f) => /transporte: 1 llave/.test(f)) && r.fallas.some((f) => /aliados: 1 llave/.test(f)));
  });
});
