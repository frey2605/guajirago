/**
 * ▭ EL ESTILO DEL CAMPO DEL FORMULARIO — gemelo G97 (30-sep-2026)
 *
 * La caja del campo y el texto de dentro salen de UNA pieza, guajirago/src/estiloCampo.js, con los colores de la
 * paleta (theme.js). Esta prueba lo EJECUTA con scripts/medir-estilo-campo.cjs:
 *   1. Nadie escribe la caja a mano (en las tres apps), y las copias del texto que ya había en otras pantallas solo
 *      pueden bajar. Login.js y App.js importan la pieza.
 *   2. La pieza, ejecutada, da el estilo de siempre, y sus colores salen de la paleta.
 *   3. Login.js (crear cuenta y entrar) y los datos del conductor (App.js), pintados con React, se ven IGUAL que antes
 *      de G97 (2a20537): el HTML y los estilos que React le da a cada elemento, paso por paso.
 *   4. Los dos formularios dan la misma caja y el mismo texto.
 */
const test = require('node:test');
const assert = require('node:assert');
const M = require('../scripts/medir-estilo-campo.cjs');
const P = require('../scripts/medir-paleta.cjs');

const CAJA = { background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' };
const TEXTO = { background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' };

test.describe('EL ESTILO DEL CAMPO (G97) · una sola pieza', () => {
  test.it('nadie escribe la caja a mano, y el texto no pasa de PENDIENTES (ni baja sin tachar)', () => {
    const difs = M.contraPendientes(M.copias());
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
  });

  test.it('Login.js y App.js importan la pieza', () => {
    const leer = P.lector(null);
    for (const f of ['guajirago/src/Login.js', 'guajirago/src/App.js']) {
      assert.match(leer(f), /import \{ estiloCampo, estiloInput \} from '\.\/estiloCampo';/, f + ' no importa la pieza');
    }
  });

  test.it('pantallas de mentira: una caja a mano y un texto de más se ven; uno quitado sin tachar también', () => {
    const leer = P.lector(null);
    const f = 'guajirago/src/Seguridad.js';
    const conCaja = M.contraPendientes(M.copias(P.lector(null, { [f]: leer(f) + "\nconst x = { background: '#FFFFFF', border: '1.5px solid #ECECEF', borderRadius: '16px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px' };\n" })));
    assert.ok(conCaja.some((d) => d.startsWith('🔴 ' + f) && d.includes('caja')), 'una caja a mano no se vio: ' + conCaja.join(' | '));
    const conTexto = M.contraPendientes(M.copias(P.lector(null, { [f]: leer(f) + "\nconst y = { background: 'none', border: 'none', outline: 'none', color: '#1A1A1E', fontSize: '16px', width: '100%' };\n" })));
    assert.ok(conTexto.some((d) => d.startsWith('🔴 ' + f)), 'un texto de más no se vio: ' + conTexto.join(' | '));
    const s = 'guajirago/src/Solicitar.js';
    const menos = M.contraPendientes(M.copias(P.lector(null, { [s]: leer(s).replace("color: '#1A1A1E', fontSize: '16px', width: '100%'", "color: T.tinta, fontSize: '16px', width: '100%'") })));
    assert.ok(menos.some((d) => d.startsWith('✓ ' + s)), 'uno quitado sin tachar no se vio: ' + menos.join(' | '));
  });
});

test.describe('EL ESTILO DEL CAMPO (G97) · la pieza, ejecutada', () => {
  test.it('da la caja y el texto de siempre, con los colores de la paleta', () => {
    const cache = {};
    const pieza = P.cargarModulo(M.PIEZA, P.lector(null), cache);
    assert.deepStrictEqual(pieza.estiloCampo, CAJA);
    assert.deepStrictEqual(Object.keys(pieza.estiloCampo), Object.keys(CAJA), 'el orden de las claves cambió');
    assert.deepStrictEqual(pieza.estiloInput, TEXTO);
    // Los colores salen de la paleta: con otra paleta, la pieza cambia con ella.
    const leer = P.lector(null);
    const otra = P.cargarModulo(M.PIEZA, P.lector(null, { 'guajirago/src/theme.js': leer('guajirago/src/theme.js').replace("borde: '#ECECEF'", "borde: '#123456'").replace("tinta: '#1A1A1E'", "tinta: '#654321'").replace("tarjeta: '#FFFFFF'", "tarjeta: '#ABCDEF'") }), {});
    assert.strictEqual(otra.estiloCampo.border, '1.5px solid #123456');
    assert.strictEqual(otra.estiloCampo.background, '#ABCDEF');
    assert.strictEqual(otra.estiloInput.color, '#654321');
  });
});

test.describe('EL ESTILO DEL CAMPO (G97) · se ven igual, pintados con React', () => {
  let ahora;
  test.before(async () => { ahora = await M.recorrido(null); });

  test.it('los 4 pasos, igual que antes de G97 (2a20537): HTML y estilos de React', async () => {
    const antes = await M.recorrido(M.ANTES);
    assert.deepStrictEqual(ahora.map((p) => p.paso), ['login · crear cuenta', 'login · ya tengo cuenta', 'conductor · datos, vacía', 'conductor · datos, el teléfono en rojo']);
    const difs = M.carear(antes, ahora);
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
  });

  test.it('la caja y el texto que React pinta en cada paso son los de siempre (y el rojo sigue siendo rojo)', () => {
    for (const p of ahora.slice(0, 3)) {
      assert.deepStrictEqual(p.caja, CAJA, p.paso);
      assert.deepStrictEqual(p.texto, TEXTO, p.paso);
    }
    assert.deepStrictEqual(ahora[3].caja, { ...CAJA, border: '2px solid #FF4444' });
  });

  test.it('Login y el conductor dan la misma caja y el mismo texto', () => {
    assert.deepStrictEqual(M.losDosIguales(ahora), []);
  });

  test.it('el careo no es un adorno: un estilo cambiado en Login.js se ve', async () => {
    const leer = P.lector(null);
    const l = 'guajirago/src/Login.js';
    const roto = leer(l).replace("<div style={estiloCampo}>", "<div style={{ ...estiloCampo, padding: '15px' }}>");
    assert.notStrictEqual(roto, leer(l), 'el cambio de mentira no calzó');
    const difs = M.carear(ahora, await M.recorrido(null, { [l]: roto }));
    assert.ok(difs.some((d) => d.includes('login · crear cuenta')), 'no se vio: ' + difs.join(' | '));
  });
});
