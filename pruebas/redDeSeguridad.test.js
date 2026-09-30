/**
 * 🛟 LA RED DE SEGURIDAD (ErrorBoundary) — gemelo G102 (30-sep-2026)
 *
 * La red que atrapa el fallo de una pantalla vive en UNA pieza, guajirago/src/ErrorBoundary.js, y aliados (otro repo)
 * lleva una copia IDÉNTICA. Lo que cambia entre apps —los colores y el nombre en la consola— lo pasa cada index.js,
 * tomado de su paleta (theme.js / flujoPedidos.js). Esta prueba lo EJECUTA con scripts/medir-red-de-seguridad.cjs:
 *   1. Solo hay dos redes en las tres apps, y la de aliados es copia idéntica de la pieza (copiaIdentica, G100).
 *   2. Cada index.js pinta la red con su nombre y los colores de SU paleta.
 *   3. Pintada con React con una pantalla que revienta: atrapa, escribe en la consola y se ve IGUAL que antes de G102
 *      (b2d0f10 / 06d4f9e), estilo por estilo; sin fallo deja pasar la app; y la pieza sin props también atrapa.
 *   4. El medidor no se ablanda: una copia separada, una red de más y un color cambiado se ven.
 */
const test = require('node:test');
const assert = require('node:assert');
const { copiaIdentica } = require('./cargar.cjs');
const M = require('../scripts/medir-red-de-seguridad.cjs');

test.describe('LA RED DE SEGURIDAD (G102) · una sola pieza', () => {
  test.it('en las tres apps solo hay dos redes: la pieza y su copia en aliados, y la copia es IDÉNTICA', () => {
    const r = M.redes();
    assert.deepStrictEqual(r.redes, [M.COPIA, M.PIEZA]);
    copiaIdentica(M.COPIA, M.PIEZA, 'aliados no puede importar la pieza (otro repo): se cambia en guajirago/src y se copia');
    assert.strictEqual(r.identica, true);
  });

  test.it('cada index.js pinta la red con su nombre y los colores de SU paleta', () => {
    const leer = M.lector();
    const t = M.laRedDelIndice(leer('guajirago/src/index.js'));
    assert.ok(t, 'guajirago/src/index.js no pinta <ErrorBoundary>');
    assert.deepStrictEqual(t.imports, ["import ErrorBoundary from './ErrorBoundary';", "import { T } from './theme';"]);
    assert.match(t.abre, /app="GuajiraGo"/);
    assert.match(t.abre, /titulo: T\.tinta, texto: T\.gris, boton: `linear-gradient\(135deg, \$\{T\.amarillo\}, \$\{T\.naranja\}\)`/);
    const a = M.laRedDelIndice(leer('guajirago-aliados/src/index.js'));
    assert.ok(a, 'guajirago-aliados/src/index.js no pinta <ErrorBoundary>');
    assert.deepStrictEqual(a.imports, ["import ErrorBoundary from './ErrorBoundary';", "import { AZUL, AZUL_MEDIO, TINTA, GRIS } from './flujoPedidos';"]);
    assert.match(a.abre, /app="GuajiraAliados"/);
    assert.match(a.abre, /titulo: TINTA, texto: GRIS, boton: `linear-gradient\(135deg, \$\{AZUL\}, \$\{AZUL_MEDIO\}\)`/);
  });

  test.it('pantallas de mentira: una copia separada y una red de más en el panel se ven', () => {
    const leer = M.lector();
    const separada = M.redes(M.lector(null, { [M.COPIA]: leer(M.COPIA).replace("'#C4C4C4'", "'#C4C4C5'") }));
    assert.strictEqual(separada.identica, false, 'una copia con un color cambiado no se vio');
    const otra = 'guajirago-admin/src/RedDeMentira.js';
    const mas = M.redes(M.lector(null, { [otra]: 'class X extends React.Component { componentDidCatch() {} }' }), [otra]);
    assert.ok(mas.redes.includes(otra), 'una red nueva en el panel no se vio');
  });
});

test.describe('LA RED DE SEGURIDAD (G102) · pintada con React', () => {
  let ahora;
  test.before(async () => { ahora = await M.recorrido(null); });

  test.it('con una pantalla que revienta, las dos apps atrapan, escriben en la consola y ofrecen volver al inicio', () => {
    assert.deepStrictEqual(ahora.map((x) => x.app), ['transporte', 'aliados']);
    const nombres = { transporte: 'GuajiraGo', aliados: 'GuajiraAliados' };
    for (const x of ahora) {
      assert.strictEqual(x.revento, null, x.app + ': la red no atrapó');
      assert.deepStrictEqual(x.consola, [nombres[x.app] + ' crash: ' + M.FALLO + ' · con la pila de React: true']);
      assert.match(x.conFallo, /h2\{[^}]*\}\("Algo se quedó pegado"\)/);
      assert.match(x.conFallo, /\("Volver al inicio"\)/);
      assert.match(x.conFallo, new RegExp('\\("' + M.FALLO + '"\\)'));
      assert.match(x.boton, /window\.location\.href = '\/'/);
      assert.strictEqual(x.sinFallo, 'p{}("la app de mentira")', x.app + ': sin fallo la red no deja pasar la app');
      assert.strictEqual(x.sinProps.atrapa, true, x.app + ': la pieza sin props no atrapa: ' + x.sinProps.revento);
    }
  });

  test.it('cada app con SUS colores: transporte naranja, aliados azul', () => {
    const [t, a] = ahora;
    assert.match(t.conFallo, /h2\{color:#1A1A1E;/);
    assert.match(t.conFallo, /p\{color:#6B7280;/);
    assert.match(t.conFallo, /button\{background:linear-gradient\(135deg, #FFCF4D, #FF7A2F\);/);
    assert.match(a.conFallo, /h2\{color:#1B2A6B;/);
    assert.match(a.conFallo, /p\{color:#6B7B9E;/);
    assert.match(a.conFallo, /button\{background:linear-gradient\(135deg, #1C8EF9, #39A6FF\);/);
  });

  test.it('se ve, escribe y reacciona IGUAL que antes de G102 (b2d0f10 / 06d4f9e), estilo por estilo', async () => {
    const antes = await M.recorrido(M.ANTES);
    const difs = M.carear(antes, ahora);
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
  });

  test.it('el careo no se ablanda: un color cambiado en la paleta de aliados se ve', async () => {
    const leer = M.lector();
    const f = 'guajirago-aliados/src/flujoPedidos.js';
    const otro = await M.recorrido(null, { [f]: leer(f).replace("TINTA = '#1B2A6B'", "TINTA = '#000000'") });
    const difs = M.carear(ahora, otro);
    assert.ok(difs.some((d) => d.startsWith('aliados · conFallo')), 'el careo no vio el color cambiado: ' + difs.join(' | '));
  });
});
