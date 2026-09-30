/**
 * ‹ EL BOTÓN «VOLVER» — gemelo G91 (30-sep-2026)
 *
 * El «‹ Volver» de la app de transporte es UNA pieza, guajirago/src/BotonVolver.js. Esta prueba lo EJECUTA con
 * scripts/medir-boton-volver.cjs, que saca cada botón de su archivo, lo pinta con React y lo toca:
 *   1. Ya no queda ninguno escrito a mano en guajirago/src, y todos se ven igual (un solo aspecto, de la paleta).
 *   2. Careo con 9dca917 (antes de G91): cada archivo vuelve a los MISMOS sitios, en el mismo orden, y cada botón sigue
 *      en el mismo lugar de la pantalla. Los que ya tenían el aspecto bueno pintan el MISMO HTML que antes.
 *   3. Pantallas de mentira: una copia a mano nueva, un botón que vuelve a otro sitio, una pieza que no vuelve a
 *      ningún lado o un lugar que no existe, se ven.
 */
const test = require('node:test');
const assert = require('node:assert');
const V = require('../scripts/medir-boton-volver.cjs');
const P = require('./../scripts/medir-paleta.cjs');

let ahora;
let antes;
test.before(async () => {
  ahora = await V.medir(null);
  antes = await V.medir(V.ANTES);
});

test.describe('EL BOTÓN «VOLVER» (G91) · una sola pieza', () => {
  test.it('ningún «‹ Volver» escrito a mano en guajirago/src: los 24 usan BotonVolver.js, y dicen «‹ Volver»', () => {
    const r = V.resumen(ahora);
    assert.strictEqual(r.aMano, 0, 'quedan copias a mano: ' + ahora.filter((b) => b.tipo === 'a mano').map((b) => b.archivo + ' (' + b.pantalla + ')').join(', '));
    assert.strictEqual(r.pieza, 24);
    assert.strictEqual(r.archivos, 15);
    assert.deepStrictEqual(r.errores, []);
  });

  test.it('todos se ven igual (UN aspecto), y los colores salen de la paleta', () => {
    assert.strictEqual(V.resumen(ahora).aspectos, 1);
    const pieza = P.lector(null)(V.PIEZA);
    assert.strictEqual(P.coloresDe(pieza), 0, 'BotonVolver.js tiene colores a mano');
    assert.match(pieza, /^import \{ T \} from '\.\/theme';/m);
    const T = P.laPaleta();
    const a = JSON.parse(ahora[0].aspecto);
    assert.strictEqual(a.boton.background, T.pastilla);
    assert.strictEqual(a.boton.color, T.tinta);
    assert.strictEqual(a.etiqueta, 'div');
  });

  test.it('antes (9dca917) eran 24 a mano en 15 archivos, con 7 aspectos', () => {
    const r = V.resumen(antes);
    assert.strictEqual(r.aMano, 24);
    assert.strictEqual(r.archivosAMano, 15);
    assert.strictEqual(r.aspectos, 7);
    assert.deepStrictEqual(r.errores, []);
  });
});

test.describe('EL BOTÓN «VOLVER» (G91) · careo con 9dca917', () => {
  test.it('cada archivo vuelve a los mismos sitios, en el mismo orden (los 24 botones tocados)', () => {
    assert.deepStrictEqual(V.carear(antes, ahora), []);
    const d = V.aDonde(ahora);
    assert.deepStrictEqual(d['guajirago/src/Restaurantes.js'], ['setPantalla("misPedidos")', 'setPantalla("lista") + setRestauranteActivo(null) + setCarrito([])', 'setPantalla("lista")', 'onVolver(toque)']);
    assert.deepStrictEqual(d['guajirago/src/Turismo.js'], ['onVolver(toque)', 'setPantalla("lista")', 'setPantalla("lista")']);
  });

  test.it('cada botón sigue en el mismo LUGAR de su pantalla (solo cambia display, que en una fila da lo mismo)', () => {
    assert.strictEqual(antes.length, ahora.length);
    const sinDisplay = (l) => { const o = JSON.parse(l); delete o.display; return JSON.stringify(o); };
    ahora.forEach((b, i) => {
      assert.strictEqual(b.archivo, antes[i].archivo);
      assert.strictEqual(sinDisplay(b.lugar), sinDisplay(antes[i].lugar), b.archivo + ' (' + b.pantalla + ') cambió de lugar');
    });
    // Los de «arriba» (Turismo) no se estiran: siguen en inline-flex.
    for (const b of ahora.filter((x) => /marginBottom/.test(x.lugar))) assert.strictEqual(JSON.parse(b.lugar).display, 'inline-flex');
  });

  test.it('los que ya tenían el aspecto bueno pintan EXACTAMENTE el mismo HTML que antes', () => {
    const iguales = ahora.filter((b, i) => b.aspecto === antes[i].aspecto && b.lugar === antes[i].lugar);
    assert.strictEqual(iguales.length, 10, 'se esperaban 10 (Ayuda, Configuración, Créditos, Ganancias, Historial, Mi perfil, Mis viajes, Legal, Promociones, Seguridad)');
    ahora.forEach((b, i) => { if (b.aspecto === antes[i].aspecto && b.lugar === antes[i].lugar) assert.strictEqual(b.html, antes[i].html, b.archivo); });
  });

  test.it('cambian de aspecto 14 de 24, y en qué, en palabras', () => {
    const c = V.cambiosDeAspecto(antes, ahora);
    assert.strictEqual(c.length, 14);
    const resta = c.filter((x) => x.archivo.endsWith('Restaurantes.js'));
    assert.strictEqual(resta.length, 4);
    assert.match(V.diferencia(resta[0].antes, resta[0].ahora), /botón color: #1C8EF9 → #1A1A1E/);
    const sol = c.find((x) => x.archivo.endsWith('Solicitar.js'));
    assert.strictEqual(V.diferencia(sol.antes, sol.ahora), '‹ fontSize: 22px → 20px');
  });
});

test.describe('EL BOTÓN «VOLVER» (G91) · pantallas de mentira', () => {
  const leer = P.lector(null);
  const cambia = (f, esta, roto) => {
    const t = leer(f);
    assert.strictEqual(t.split(esta).length, 2, 'el texto de la pantalla de mentira no calza en ' + f + ': ' + esta);
    return { [f]: t.replace(esta, roto) };
  };

  test.it('una copia a mano nueva se ve', async () => {
    const f = 'guajirago/src/Ganancias.js';
    const m = await V.medir(null, cambia(f, '<BotonVolver alVolver={onVolver} />', "<div onClick={onVolver} style={{ padding: '8px' }}><span>‹</span> Volver</div>"));
    assert.strictEqual(V.resumen(m).aMano, 1);
    assert.strictEqual(V.resumen(m).aspectos, 2);
  });

  test.it('un botón que vuelve a otro sitio se ve en el careo', async () => {
    const m = await V.medir(null, cambia('guajirago/src/Restaurantes.js', "<BotonVolver alVolver={() => setPantalla('misPedidos')} />", "<BotonVolver alVolver={() => setPantalla('lista')} />"));
    assert.strictEqual(V.carear(antes, m).length, 1);
  });

  test.it('una pieza que no vuelve a ningún lado, o un lugar que no existe, se ven', async () => {
    const m1 = await V.medir(null, cambia(V.PIEZA, '<div onClick={alVolver}', '<div onClick={() => {}}'));
    assert.strictEqual(V.resumen(m1).errores.length, 24);
    const m2 = await V.medir(null, cambia('guajirago/src/Turismo.js', '<BotonVolver alVolver={onVolver} lugar="trasMenu" />', '<BotonVolver alVolver={onVolver} lugar="alLado" />'));
    assert.strictEqual(V.resumen(m2).errores.length, 1);
  });
});
