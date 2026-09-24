// ══════════════════════════════════════════════════════════════════════════════
//  EL GUARDIÁN, VIGILADO
//
//  🔴 Hasta el 24-sep-2026 el guardián NO TENÍA NI UNA PRUEBA. Y no por descuido:
//  no se podía cargar. `require()` lo ejecutaba, y sin argumentos imprimía la
//  ayuda y hacía `process.exit(1)` — o sea que mataba al que intentara probarlo.
//
//  Un vigilante que nadie vigila es el único sitio donde un fallo vive tranquilo,
//  y en éste vivía uno: el detector de CÓDIGO MOVIDO no veía los archivos nuevos.
//  `git diff HEAD` compara contra el último commit, y un archivo que git todavía
//  no sigue no sale ahí. Así que para esquivar el candado bastaba con mover el
//  código a un archivo NUEVO.
//
//  Demostrado, no razonado: el 24-sep se movieron 747 renglones de un archivo a
//  trece nuevos y el guardián no dijo nada — el día después de haber parado el
//  trabajo por SEIS renglones movidos entre dos archivos ya seguidos.
// ══════════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { juntarRenglones } = require('../scripts/guardian.cjs');

//  `juntarRenglones` es pura: recibe el texto del diff y los archivos nuevos ya
//  leídos. Por eso aquí se le pueden dar casos de mentira sin tocar git.
const igual = (r) => r;

//  El mismo buscador de gemelos que usa el guardián, escrito aquí para poder
//  preguntar «¿lo habría cazado?» sin montar un repo entero. Si el criterio del
//  guardián cambiara, esta prueba seguiría verde — por eso lo que se prueba de
//  verdad es que los renglones del archivo nuevo LLEGUEN a la lista de añadidos,
//  que es donde estaba el agujero.
function seVeElMovimiento(porArchivo) {
  const mas = [], menos = [];
  for (const [ruta, r] of Object.entries(porArchivo)) {
    for (const t of r.mas) mas.push({ ruta, texto: t });
    for (const t of r.menos) menos.push({ ruta, texto: t });
  }
  return menos.some((m) => m.texto.trim().length >= 25
    && mas.some((a) => a.texto.trim() === m.texto.trim() && a.ruta !== m.ruta));
}

const RENGLON = 'esta es una funcion sana que lleva anios funcionando bien';
const DIFF_QUE_LO_QUITA = [
  '--- a/viejo.js',
  '+++ b/viejo.js',
  '@@ -1 +0,0 @@',
  '-' + RENGLON,
].join('\n');

describe('EL GUARDIÁN · el código movido a un archivo NUEVO ya no se escapa', () => {
  it('🔴 EL FALLO: sin mirar los archivos nuevos, el movimiento es invisible', () => {
    //  Esto es lo que hacía el guardián antes: solo el diff. Se deja escrito
    //  para que se vea POR QUÉ hacía falta el arreglo, no solo que lo hay.
    const solesDelDiff = juntarRenglones(DIFF_QUE_LO_QUITA, [], igual);
    assert.strictEqual(seVeElMovimiento(solesDelDiff), false,
      'si esto diera true, el fallo del 24-sep-2026 no habría podido existir y esta prueba ' +
      'estaría vigilando un fantasma');
  });

  it('✅ EL ARREGLO: con el archivo nuevo, el movimiento se ve', () => {
    const conElNuevo = juntarRenglones(DIFF_QUE_LO_QUITA,
      [{ ruta: 'nuevo.js', contenido: RENGLON + '\n' }], igual);
    assert.ok(seVeElMovimiento(conElNuevo),
      '⛔ el guardián sigue sin ver el código movido a un archivo nuevo. Basta con mover el ' +
      'código a un archivo que git no siga todavía para esquivar el candado que más ha ' +
      'protegido a este proyecto.');
  });

  it('un archivo nuevo entra ENTERO como renglones añadidos', () => {
    const r = juntarRenglones('', [{ ruta: 'a.js', contenido: 'uno\ndos\ntres\n' }], igual);
    assert.deepStrictEqual(r['a.js'].mas, ['uno', 'dos', 'tres']);
    assert.deepStrictEqual(r['a.js'].menos, []);
  });

  it('y no se inventa un renglón vacío por el salto del final', () => {
    const r = juntarRenglones('', [{ ruta: 'a.js', contenido: 'uno\n' }], igual);
    assert.deepStrictEqual(r['a.js'].mas, ['uno'],
      'un `\\n` final no es un renglón: contarlo haría que cualquier archivo nuevo pareciera ' +
      'tener una línea vacía movida');
  });

  it('sin archivos nuevos, se porta exactamente como antes', () => {
    const antes = {
      'viejo.js': { mas: [], menos: [RENGLON] },
    };
    assert.deepStrictEqual(juntarRenglones(DIFF_QUE_LO_QUITA, [], igual), antes,
      'el arreglo no puede cambiar lo que el guardián ya hacía bien');
  });

  it('el diff y el archivo nuevo se suman en el mismo sitio, sin pisarse', () => {
    const diff = ['--- a/x.js', '+++ b/x.js', '@@ -0,0 +1 @@', '+del diff'].join('\n');
    const r = juntarRenglones(diff, [{ ruta: 'x.js', contenido: 'del archivo\n' }], igual);
    assert.deepStrictEqual(r['x.js'].mas, ['del diff', 'del archivo'],
      'si uno pisara al otro, el guardián vería la mitad de lo que hay');
  });
});
