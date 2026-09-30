/**
 * 👤 LA FOTO REDONDA CON EL MUÑECO DE RESPALDO — gemelo G98 (30-sep-2026)
 *
 * El círculo con la foto de una persona, y el muñeco 👤 si no hay foto, sale de UNA pieza,
 * guajirago/src/FotoRedonda.js. Esta prueba lo EJECUTA con scripts/medir-foto-redonda.cjs:
 *   1. Nadie escribe a mano una foto de persona con respaldo (en las tres apps); las del panel, que es otro repo,
 *      están contadas en PENDIENTES y solo pueden bajar. Las tres pantallas importan la pieza.
 *   2. Los 5 círculos, sacados de su archivo y pintados con React, se ven IGUAL que antes de G98 (62697e7) con foto
 *      y sin foto.
 *   3. Si la foto NO carga, los 5 enseñan el muñeco (antes: el círculo vacío con la imagen rota).
 *   4. La pieza, ejecutada: sus tamaños con nombre, un tamaño que no existe revienta, y si cambia la foto después de
 *      una rota, se vuelve a intentar.
 */
const test = require('node:test');
const assert = require('node:assert');
const M = require('../scripts/medir-foto-redonda.cjs');
const P = require('../scripts/medir-paleta.cjs');

test.describe('LA FOTO REDONDA (G98) · una sola pieza', () => {
  test.it('nadie escribe a mano una foto con respaldo, y el panel no pasa de PENDIENTES (ni baja sin tachar)', () => {
    const difs = M.contraPendientes(M.copias());
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
  });

  test.it('MenuLateral.js, MiPerfil.js y Solicitar.js pintan la pieza', () => {
    const { usan } = M.copias();
    assert.deepStrictEqual(usan, ['guajirago/src/MenuLateral.js', 'guajirago/src/MiPerfil.js', 'guajirago/src/Solicitar.js']);
    const leer = P.lector(null);
    for (const f of usan) assert.match(leer(f), /^import FotoRedonda from '\.\/FotoRedonda';\r?$/m, f + ' no importa la pieza');
  });

  test.it('pantallas de mentira: una foto a mano de más se ve, y una del panel quitada sin tachar también', () => {
    const leer = P.lector(null);
    const f = 'guajirago/src/Seguridad.js';
    const mas = M.contraPendientes(M.copias(P.lector(null, { [f]: leer(f) + "\nconst x = (u) => (u ? <img src={u} alt=\"\" /> : '👤');\n" })));
    assert.ok(mas.some((d) => d.startsWith('🔴 ' + f)), 'una foto a mano de más no se vio: ' + mas.join(' | '));
    const c = 'guajirago-admin/src/Pasajeros.js';
    const menos = M.contraPendientes(M.copias(P.lector(null, { [c]: leer(c).replace('🙋</div>', 'X</div>') })));
    assert.ok(menos.some((d) => d.startsWith('✓ ' + c)), 'una quitada sin tachar no se vio: ' + menos.join(' | '));
  });
});

test.describe('LA FOTO REDONDA (G98) · pintada con React', () => {
  let ahora;
  test.before(async () => { ahora = await M.recorrido(null); });

  test.it('los 5 sitios, con foto y sin foto, se ven igual que antes de G98 (62697e7)', async () => {
    const antes = await M.recorrido(M.ANTES);
    assert.deepStrictEqual(ahora.map((x) => x.sitio), M.SITIOS.map((s) => s[1]));
    const difs = M.carear(antes, ahora);
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
    // Y antes, con la foto rota, los 5 dejaban la imagen rota: es lo que se arregló.
    assert.deepStrictEqual(antes.map((x) => x.imgRota), [true, true, true, true, true]);
  });

  test.it('con foto sale la foto (redonda y cubriendo); sin foto y con la foto rota, el muñeco', () => {
    for (const x of ahora) {
      assert.match(x.conFoto, /^div\{[^}]*borderRadius:50%[^}]*overflow:hidden[^}]*\}\(img\{height:100%;objectFit:cover;width:100%\}\[src=https:\/\/almacen\.de\.mentira\/foto\.jpg\]\(\)\)$/, x.sitio + ': ' + x.conFoto);
      assert.match(x.sinFoto, /^div\{[^}]*\}\("👤"\)$/, x.sitio + ' sin foto: ' + x.sinFoto);
      assert.strictEqual(x.imgRota, false, x.sitio + ': con la foto rota sigue la imagen rota');
      assert.strictEqual(x.fotoRota, x.sinFoto, x.sitio + ': con la foto rota no sale lo mismo que sin foto');
    }
  });

  test.it('cada sitio conserva su tamaño, su fondo y su borde', () => {
    const esperado = [
      ['width:56px', 'fontSize:28px', 'background:rgba(255,255,255,0.25)', 'marginBottom:12px'],
      ['width:80px', 'fontSize:36px', 'background:linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', 'marginBottom:8px'],
      ['width:44px', 'fontSize:22px', 'border:2px solid #FF7A2F', 'flexShrink:0'],
      ['width:48px', 'fontSize:24px', 'border:2px solid #2ECC71', 'flexShrink:0'],
      ['width:44px', 'fontSize:22px', 'border:2px solid #FF7A2F', 'flexShrink:0'],
    ];
    ahora.forEach((x, i) => { for (const e of esperado[i]) assert.ok(x.sinFoto.includes(e), x.sitio + ' perdió ' + e + ': ' + x.sinFoto); });
  });

  test.it('el careo no es un adorno: un tamaño cambiado en MiPerfil.js se ve', async () => {
    const leer = P.lector(null);
    const f = 'guajirago/src/MiPerfil.js';
    const roto = leer(f).replace('tamano="perfil"', 'tamano="menu"');
    assert.notStrictEqual(roto, leer(f), 'el cambio de mentira no calzó');
    const difs = M.carear(ahora, await M.recorrido(null, { [f]: roto }));
    assert.ok(difs.some((d) => d.startsWith('Mi perfil')), 'no se vio: ' + difs.join(' | '));
  });
});

test.describe('LA FOTO REDONDA (G98) · la pieza, ejecutada', () => {
  test.it('los tamaños con nombre, y uno que no existe revienta en vez de pintar mal', async () => {
    const pieza = P.cargarModulo(M.PIEZA, P.lector(null), {});
    assert.deepStrictEqual(Object.keys(pieza.TAMANOS), ['menu', 'perfil', 'tarjeta', 'tarjetaGrande']);
    assert.throws(() => pieza.default({ src: null, tamano: 'gigante' }), /no conozco el tamaño «gigante»/);
  });

  test.it('si la foto rota cambia por otra, se vuelve a intentar', async () => {
    const H = P.herramientas();
    const pieza = P.cargarModulo(M.PIEZA, P.lector(null), {});
    const dom = new H.JSDOM('<!doctype html><html><body><div id="r"></div></body></html>');
    const previa = { window: global.window, document: global.document, act: global.IS_REACT_ACT_ENVIRONMENT };
    global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
    try {
      const { React } = H;
      const raiz = dom.window.document.getElementById('r');
      const r = H.cliente.createRoot(raiz);
      const pintar = (src) => React.act(async () => { r.render(React.createElement(pieza.default, { src, tamano: 'menu' })); });
      await pintar('https://x/a.jpg');
      await React.act(async () => { raiz.querySelector('img').dispatchEvent(new dom.window.Event('error')); });
      assert.strictEqual(raiz.querySelector('img'), null);
      assert.strictEqual(raiz.textContent, '👤');
      await pintar('https://x/b.jpg');
      assert.strictEqual(raiz.querySelector('img').getAttribute('src'), 'https://x/b.jpg', 'la foto nueva no se intentó');
      await React.act(async () => { r.unmount(); });
    } finally {
      global.window = previa.window; global.document = previa.document; global.IS_REACT_ACT_ENVIRONMENT = previa.act;
    }
  });
});
