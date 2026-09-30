/**
 * G82 · SUBIR UNA FOTO Y PEDIR SU DIRECCIÓN SALE DE UNA SOLA PIEZA (29-sep-2026).
 *
 * Las tres apps suben fotos en 13 sitios, y los 13 escribían a mano lo mismo: `ref(storage, ruta)`,
 * `uploadBytes(ref, archivo)` y `getDownloadURL(ref)`. Ahora llaman a `subirAlAlmacen(storage, ruta, archivo)`,
 * con una copia IDÉNTICA en cada repo (guajirago/src, guajirago-admin/src, guajirago-aliados/src).
 *
 * Esta prueba EJECUTA: corre la pieza con un almacén de mentira, y saca de su archivo la función de cada uno de los
 * 13 sitios y la corre entera (scripts/medir-subir-foto.cjs), careándola con el código de ANTES de G82. Contra el
 * almacén de verdad (storage.rules en el emulador) la prueba pruebas/storage.test.js.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, copiaIdentica } = require('./cargar.cjs');
const M = require('../scripts/medir-subir-foto.cjs');

// Un almacén de mentira que apunta cada llamada, como el SDK en lo que importa aquí.
function sdkDeMentira({ falla = false } = {}) {
  const llamadas = [];
  const sdk = {
    ref: (st, ruta) => { llamadas.push(['ref', st, ruta]); return { ruta }; },
    uploadBytes: async (r, archivo, meta) => {
      llamadas.push(['uploadBytes', r.ruta, archivo, meta]);
      if (falla) { const e = new Error('no'); e.code = 'storage/unauthorized'; throw e; }
    },
    getDownloadURL: async (r) => { llamadas.push(['getDownloadURL', r.ruta]); return 'https://x/' + r.ruta; },
  };
  return { sdk, llamadas };
}

describe('G82 · la pieza subirAlAlmacen', () => {
  it('las tres copias (app, panel, aliados) son IDÉNTICAS', () => {
    const [a, b, c] = M.PIEZAS;
    copiaIdentica(b, a, 'la copia del PANEL se separó de la de la app');
    copiaIdentica(c, a, 'la copia de ALIADOS se separó de la de la app');
  });

  for (const r of M.PIEZAS) {
    it(r + ': sube a la ruta que le dan, con el tipo del teléfono, y devuelve la dirección de ESA foto', async () => {
      const { sdk, llamadas } = sdkDeMentira();
      const { subirAlAlmacen } = M.cargarPieza(leer(r), sdk);
      const ALMACEN = { soy: 'el almacén' };
      const png = { name: 'a.png', type: 'image/png' };
      const url = await subirAlAlmacen(ALMACEN, 'restaurantes/N1/logo_5.jpg', png);
      assert.strictEqual(url, 'https://x/restaurantes/N1/logo_5.jpg');
      assert.deepStrictEqual(llamadas, [
        ['ref', ALMACEN, 'restaurantes/N1/logo_5.jpg'],
        ['uploadBytes', 'restaurantes/N1/logo_5.jpg', png, { contentType: 'image/png' }],
        ['getDownloadURL', 'restaurantes/N1/logo_5.jpg'],
      ]);
    });

    it(r + ': si el teléfono no dice el tipo, sube como image/jpeg (no como application/octet-stream)', async () => {
      for (const archivo of [{ name: 'x', type: '' }, { name: 'x' }, new Uint8Array(4)]) {
        const { sdk, llamadas } = sdkDeMentira();
        await M.cargarPieza(leer(r), sdk).subirAlAlmacen({}, 'usuarios/U/perfil_1.jpg', archivo);
        assert.deepStrictEqual(llamadas[1][3], { contentType: 'image/jpeg' });
      }
    });

    it(r + ': si el almacén la rechaza, el error sale tal cual y NO pide dirección', async () => {
      const { sdk, llamadas } = sdkDeMentira({ falla: true });
      await assert.rejects(M.cargarPieza(leer(r), sdk).subirAlAlmacen({}, 'anuncios/a.jpg', { type: 'image/jpeg' }),
        (e) => e.code === 'storage/unauthorized');
      assert.ok(!llamadas.some((l) => l[0] === 'getDownloadURL'), 'pidió la dirección de una foto que no subió');
    });
  }
});

describe('G82 · los 13 sitios de las tres apps', () => {
  it('nadie sube a mano: 0 `uploadBytes` fuera de la pieza, y los 13 sitios la usan', () => {
    const m = M.medir(null);
    assert.deepStrictEqual(m.problemas, []);
    assert.deepStrictEqual(m.aMano, {}, 'hay subidas escritas a mano fuera de la pieza');
    assert.strictEqual(m.sitios.length, 13);
    assert.deepStrictEqual(m.sitios.filter((s) => !s.usaPieza).map((s) => s.id), [], 'sitios que no usan la pieza');
    assert.ok(m.copiasIguales, 'las copias de la pieza no son iguales');
  });

  it('CAREO con el código de antes de G82: los 13 sitios hacen lo mismo (ruta, dirección, a dónde va, errores); solo cambia el tipo de la foto sin tipo', async () => {
    const c = await M.carear(M.medir(M.ANTES), M.medir(null));
    assert.strictEqual(c.comparaciones, 13 * M.FOTOS.length);
    const otras = c.diferencias.filter((d) => !M.esLaDelTipo(d));
    assert.deepStrictEqual(otras.map((d) => d.sitio + ' · ' + d.caso), [], 'un sitio cambió algo más que el tipo');
    assert.strictEqual(c.diferencias.length, 13, 'la foto sin tipo tiene que subir como image/jpeg en los 13 sitios');
  });

  it('antes de G82 eran 13 subidas escritas a mano en 11 archivos, y 0 con la pieza', () => {
    const m = M.medir(M.ANTES);
    assert.strictEqual(Object.values(m.aMano).reduce((x, y) => x + y, 0), 13);
    assert.strictEqual(Object.keys(m.aMano).length, 11);
    assert.strictEqual(m.sitios.filter((s) => s.usaPieza).length, 0);
  });
});

describe('G82 · el medidor no se deja engañar (pantallas de mentira)', () => {
  const conCambio = (ruta, de, a) => {
    const t = leer(ruta);
    assert.ok(t.includes(de), 'el cambio de mentira no calza en ' + ruta);
    return { [ruta]: t.replace(de, a) };
  };

  it('una pantalla que vuelve a subir a mano se cuenta', () => {
    const m = M.medir(null, conCambio('guajirago-aliados/src/Tours.js', "import { subirAlAlmacen } from './subirAlAlmacen';",
      "import { subirAlAlmacen } from './subirAlAlmacen';\nconst x = () => uploadBytes(1, 2);"));
    assert.deepStrictEqual(m.aMano, { 'guajirago-aliados/src/Tours.js': 1 });
  });

  it('una copia de la pieza que se separa se nota', () => {
    const m = M.medir(null, { 'guajirago-admin/src/subirAlAlmacen.js': leer('guajirago-admin/src/subirAlAlmacen.js') + '\n' });
    assert.strictEqual(m.copiasIguales, false);
  });

  it('un sitio que cambia la ruta, o que pierde la dirección, sale en el careo', async () => {
    const antes = M.medir(M.ANTES);
    const r1 = await M.carear(antes, M.medir(null, conCambio('guajirago/src/MiPerfil.js', '/perfil_${Date.now()}', '/foto_${Date.now()}')));
    assert.ok(r1.diferencias.some((d) => /MiPerfil/.test(d.sitio) && !M.esLaDelTipo(d)), 'no vio la ruta cambiada');
    const r2 = await M.carear(antes, M.medir(null, conCambio('guajirago-aliados/src/Tours.js', 'setImagen(await subirAlAlmacen(', 'setImagen(!await subirAlAlmacen(')));
    assert.ok(r2.diferencias.some((d) => /Tours/.test(d.sitio) && !M.esLaDelTipo(d)), 'no vio que la dirección ya no llega');
  });
});
