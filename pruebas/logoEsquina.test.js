/**
 * EL LOGO DE LA ESQUINA — gemelo G92 (30-sep-2026)
 *
 * El logo de arriba a la derecha de la app de transporte es UNA pieza, LogoEsquina de guajirago/src/Logo.js. Esta prueba
 * lo EJECUTA con scripts/medir-logo-esquina.cjs, que saca cada logo de su archivo y lo pinta con React:
 *   1. Ya no queda ninguno escrito a mano en guajirago/src: los 14 usan LogoEsquina, con dos tamaños con nombre, y
 *      todos son el dibujo oficial de Logo.js, pegados arriba a la derecha.
 *   2. Careo con 236586d (antes de G92): el logo sigue en las MISMAS pantallas; los 8 que ya tenían la forma buena
 *      pintan el MISMO HTML y los mismos estilos de React que antes; cambian 6, y en qué, en palabras.
 *   3. Pantallas de mentira: una copia a mano nueva, un tamaño que no existe, una pieza que se sale de la esquina o
 *      un logo que desaparece de una pantalla, se ven.
 */
const test = require('node:test');
const assert = require('node:assert');
const L = require('../scripts/medir-logo-esquina.cjs');
const P = require('../scripts/medir-paleta.cjs');

let ahora;
let antes;
let oficial;
test.before(async () => {
  ahora = await L.medir(null);
  antes = await L.medir(L.ANTES);
  oficial = await L.elDibujoOficial(null);
});

test.describe('EL LOGO DE LA ESQUINA (G92) · una sola pieza', () => {
  test.it('ningún logo de esquina escrito a mano en guajirago/src: los 14 usan LogoEsquina, y son el dibujo oficial', () => {
    const r = L.resumen(ahora, oficial);
    assert.strictEqual(r.aMano, 0, 'quedan copias a mano: ' + ahora.filter((l) => l.tipo === 'a mano').map((l) => l.archivo + ' (' + l.pantalla + ')').join(', '));
    assert.strictEqual(r.pieza, 14);
    assert.strictEqual(r.archivos, 13);
    assert.deepStrictEqual(r.errores, []);
    assert.ok(oficial && /<path/.test(oficial), 'no se pudo pintar el dibujo oficial');
  });

  test.it('dos formas, una por tamaño con nombre (encabezado 28, portada 34), en el mismo sitio de la esquina', () => {
    assert.strictEqual(L.resumen(ahora).formas, 2);
    const esquina = ahora.filter((l) => l.tipo === 'pieza');
    assert.deepStrictEqual([...new Set(esquina.map((l) => l.tamano))].sort(), [28, 34]);
    for (const l of esquina) {
      assert.strictEqual(l.estilo.length, 1, l.archivo + ': el pin va directo, sin caja alrededor');
      assert.deepStrictEqual(l.estilo[0], { etiqueta: 'svg', estilo: { position: 'absolute', right: '16px', top: '14px', zIndex: 6 } }, l.archivo);
    }
    const portadas = esquina.filter((l) => l.tamano === 34).map((l) => l.archivo.replace('guajirago/src/', '') + ' (' + l.pantalla + ')');
    assert.deepStrictEqual(portadas, ['App.js (PantallaMensajeria)', 'AppConductor.js (AppConductor)', 'Home.js (Home)']);
  });

  test.it('antes (236586d) eran 14 a mano en 13 archivos, con 5 formas, y LogoEsquina no la usaba nadie', () => {
    const r = L.resumen(antes);
    assert.strictEqual(r.aMano, 14);
    assert.strictEqual(r.archivosAMano, 13);
    assert.strictEqual(r.pieza, 0);
    assert.strictEqual(r.formas, 5);
    assert.deepStrictEqual(r.errores, []);
  });

  test.it('los logos que no son de esquina (centrados o en una fila) no se tocaron', () => {
    assert.deepStrictEqual(L.resumen(ahora).otros, L.resumen(antes).otros);
    assert.strictEqual(L.resumen(ahora).otros.length, 5);
  });
});

test.describe('EL LOGO DE LA ESQUINA (G92) · careo con 236586d', () => {
  test.it('el logo sigue en las mismas pantallas, en el mismo orden', () => {
    assert.deepStrictEqual(L.carear(antes, ahora), []);
    assert.deepStrictEqual(L.dondeHay(ahora)['guajirago/src/Home.js'], ['Historial', 'Home']);
  });

  test.it('los 8 que ya tenían la forma buena pintan EXACTAMENTE el mismo HTML y los mismos estilos de React', () => {
    const iguales = L.parejas(antes, ahora).filter((p) => p.antes.forma === p.ahora.forma);
    assert.strictEqual(iguales.length, 8, 'se esperaban 8 (Ayuda, Configuración, Créditos, Ganancias, Mis viajes, Promociones, Restaurantes, Seguridad)');
    for (const p of iguales) {
      assert.strictEqual(p.ahora.html, p.antes.html, p.antes.archivo);
      assert.deepStrictEqual(p.ahora.estilo, p.antes.estilo, p.antes.archivo);
    }
  });

  test.it('cambian de forma 6 de 14, y en qué, en palabras', () => {
    const c = L.cambiosDeForma(antes, ahora);
    const d = Object.fromEntries(c.map((x) => [x.archivo.replace('guajirago/src/', '') + ' (' + x.pantalla + ')', L.diferencia(x.antes, x.ahora)]));
    assert.deepStrictEqual(d, {
      'App.js (PantallaMensajeria)': 'top: 16px → 14px · zIndex: 5 → 6',
      'AppConductor.js (AppConductor)': 'tamaño 30 → 34',
      'Home.js (Historial)': 'top: 16px → 14px · zIndex: (nada) → 6',
      'Home.js (Home)': 'top: 16px → 14px · zIndex: 5 → 6',
      'MiPerfil.js (MiPerfil)': 'top: 16px → 14px · zIndex: (nada) → 6',
      'Solicitar.js (Solicitar)': 'tamaño 26 → 28 · top: 12px → 14px · zIndex: (nada) → 6',
    });
  });
});

test.describe('EL LOGO DE LA ESQUINA (G92) · pantallas de mentira', () => {
  const leer = P.lector(null);
  const cambia = (f, esta, roto) => {
    const t = leer(f);
    assert.strictEqual(t.split(esta).length, 2, 'el texto de la pantalla de mentira no calza en ' + f + ': ' + esta);
    return { [f]: t.replace(esta, roto) };
  };

  test.it('una copia a mano nueva se ve', async () => {
    const m = await L.medir(null, cambia('guajirago/src/Ganancias.js', '<LogoEsquina />', "<Logo size={28} style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 6 }} />"));
    assert.strictEqual(L.resumen(m).aMano, 1);
  });

  test.it('un tamaño que no existe, o una pieza que se sale de la esquina, se ven', async () => {
    const m1 = await L.medir(null, cambia('guajirago/src/Seguridad.js', '<LogoEsquina />', '<LogoEsquina tamano="grande" />'));
    assert.strictEqual(L.resumen(m1, oficial).errores.length, 1);
    const m2 = await L.medir(null, cambia(L.PIEZA, "right: '16px', zIndex: 6", "left: '16px', zIndex: 6"));
    assert.strictEqual(L.resumen(m2, oficial).errores.length, 14);
  });

  test.it('un logo que desaparece de una pantalla se ve en el careo', async () => {
    const m = await L.medir(null, cambia('guajirago/src/MiPerfil.js', '<LogoEsquina />', ''));
    assert.strictEqual(L.carear(antes, m).length, 1);
  });
});
