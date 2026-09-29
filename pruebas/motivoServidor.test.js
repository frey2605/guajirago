// G38 · «Si el mensaje viene de NUESTRO servidor, se enseña tal cual» vive en UN sitio: motivoDeRechazo
// (avisoRechazo.js, con copia atada en el panel y en aliados). Promociones.js la llevaba copiada a mano, en letra
// roja, y las dos copias enseñaban la marca técnica que la librería de firebase 12 le pega al mensaje
// («Ese código no existe. Verifícalo [404]») y, sin señal, «internal [0]».
//
// Nada de esto se supone: scripts/medir-motivo-servidor.cjs arma cada frase con el HttpsError REAL del servidor, la
// pasa por la librería REAL del teléfono (fetch de mentira, lo único inventado es la red) y la juzga con las TRES
// copias de la pieza. Esta prueba exige que el medidor salga limpio, y además corre el candado de la ley del botón
// con la pieza, que es exactamente lo que hace useAccion en la pantalla.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-motivo-servidor.cjs');

describe('G38 · la frase del servidor: una sola regla, y llega limpia', () => {
  it('nadie fuera de avisoRechazo.js vuelve a escribir la regla a mano', () => {
    assert.deepStrictEqual(M.copiasDeLaRegla(), [],
      'la regla «si lleva espacio, es frase del servidor» apareció fuera de la pieza: usa motivoDeRechazo');
  });

  it('las TRES copias de la pieza enseñan cada frase del servidor entera y sin « [404]», y no enseñan «internal [0]»', async () => {
    const r = await M.medir();
    assert.strictEqual(Object.keys(r.apps).length, 3, 'faltan copias de avisoRechazo.js: ' + Object.keys(r.apps).join(', '));
    // El caso que mordió: la librería de verdad pega la marca. Si un día deja de hacerlo, esta prueba lo dice
    // en vez de seguir verde por una razón que ya no existe.
    assert.match(r.mensajeSinSenal, /\[\d+\]$/, 'la librería ya no pega la marca: revisa si la limpieza sigue haciendo falta');
    for (const [app, j] of Object.entries(r.apps)) {
      assert.ok(j.frases >= 20, app + ': se midieron solo ' + j.frases + ' frases; ¿cambió la forma de escribir HttpsError?');
      assert.deepStrictEqual(j.conMarca, [], app + ': frases con la marca pegada');
      assert.deepStrictEqual(j.fraseCambiada, [], app + ': frases del servidor cambiadas');
      assert.deepStrictEqual(j.crudo, [], app + ': fallos técnicos enseñados en crudo');
    }
  });

  it('el candado de la ley del botón, con la pieza, dice «Ese código no existe. Verifícalo» sin la marca', async () => {
    const { crearCandado } = cargarDeLaApp('guajirago/src/candado.js');
    const { motivoDeRechazo } = cargarDeLaApp('guajirago/src/avisoRechazo.js');
    const casos = await M.casosDeVerdad();
    const noExiste = casos.find((c) => c.tipo === 'frase' && c.frase === 'Ese código no existe. Verifícalo');
    assert.ok(noExiste, 'el servidor ya no dice «Ese código no existe. Verifícalo»');
    assert.match(noExiste.e.message, /Verifícalo \[404\]$/, 'así llega de la librería');
    let visto = null;
    const c = crearCandado({ alAviso: (a) => { visto = a; }, traducir: motivoDeRechazo });
    await c.correr(async () => { throw noExiste.e; }, 'aplicar', 'Listo.', 'aplicar el código');
    assert.strictEqual(visto && visto.texto, 'Ese código no existe. Verifícalo');
    assert.strictEqual(visto.titulo, 'No se pudo aplicar el código');
  });

  it('Promociones pasa el «Aplicar» por el candado y pinta el fallo en la ventanita', () => {
    const t = soloCodigo(leer('guajirago/src/Promociones.js'));
    assert.match(t, /const aplicarCodigo = \(\) => correr\(async \(\) => \{/, 'aplicarCodigo ya no pasa por correr');
    assert.match(t, /\}, 'aplicar', '[^']+', 'aplicar el código'\);/, 'el nombre de la acción o lo que se intentaba cambió');
    assert.match(t, /<AvisoModal aviso=\{aviso && !aviso\.ok \? aviso : null\} onCerrar=\{cerrarAviso\} \/>/,
      'la ventanita no recibe el aviso del candado');
    assert.match(t, /\{texto\('aplicar', 'Aplicando…', 'Aplicar'\)\}/, 'el botón no dice su palabra mientras trabaja');
    assert.doesNotMatch(t, /\.message/, 'Promociones vuelve a leer e.message a mano');
  });
});
