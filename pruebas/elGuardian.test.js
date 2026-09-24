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
const { juntarRenglones, cubrePor, esPapelDelGuardian } = require('../scripts/guardian.cjs');

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

// ─────────────────────────────────────────────────────────────────────────────
//  DECLARAR UNA CARPETA
//
//  🔴 Por qué existe, medido el 24-sep-2026: al partir un documento en trece
//  archivos, los NOMBRES NACÍAN DEL TRABAJO —salían de los títulos del propio
//  documento— así que no se podían declarar antes. La foto declaró la carpeta y
//  el guardián paró TRECE veces por archivos que estaban dentro de lo declarado.
//
//  🔑 Pero una carpeta es una promesa MÁS FLOJA que un archivo: dice «voy a
//  tocar aquí dentro» sin decir qué. Por eso `cubrePor` no contesta sí o no:
//  contesta `true` si se declaró por su nombre y LA CARPETA si entró por ella,
//  para que el veredicto lo pueda enseñar. Una carpeta que no se enseña esconde.
describe('EL GUARDIÁN · una carpeta declarada cubre lo de dentro, y se nota', () => {
  const D = new Set(['plan/', 'scripts/vigia.cjs']);

  it('un archivo declarado por su NOMBRE devuelve true', () => {
    assert.strictEqual(cubrePor('scripts/vigia.cjs', D), true);
  });

  it('uno de dentro de la carpeta devuelve LA CARPETA, no true', () => {
    assert.strictEqual(cubrePor('plan/00-INDICE.md', D), 'plan/',
      '⛔ si devolviera `true` el veredicto no podría distinguirlo de un archivo declarado por su ' +
      'nombre, y una promesa floja pasaría por una firme');
  });

  it('cubre también lo que está en una carpeta más adentro', () => {
    assert.strictEqual(cubrePor('plan/anexos/x.md', D), 'plan/');
  });

  it('lo que no está declarado sigue fuera', () => {
    assert.strictEqual(cubrePor('otro/cosa.js', D), false);
  });

  //  🔴 EL ESCAPE QUE HABRÍA SIDO FÁCIL: comparar por texto sin la barra. Con
  //   `plan` en vez de `plan/`, la carpeta `planeta/` entraría por la puerta de
  //   `plan` y el guardián daría por declarado un archivo de otro sitio.
  it('una carpeta con nombre parecido NO se cuela', () => {
    assert.strictEqual(cubrePor('planeta/x.md', D), false,
      '⛔ `planeta/` se coló por `plan/`. Un archivo de otra carpeta pasaría por declarado.');
    assert.strictEqual(cubrePor('planes.md', D), false);
  });

  it('sin ninguna carpeta declarada, se porta exactamente como antes', () => {
    const soloArchivos = new Set(['a.js', 'b/c.js']);
    assert.strictEqual(cubrePor('a.js', soloArchivos), true);
    assert.strictEqual(cubrePor('b/c.js', soloArchivos), true);
    assert.strictEqual(cubrePor('b/otro.js', soloArchivos), false,
      '⛔ declarar `b/c.js` no puede abrir la carpeta `b/` entera');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  LOS PAPELES DEL PROPIO GUARDIÁN
//
//  🔴 Por qué existe, medido el 24-sep-2026 ejecutándolo: la ley manda anotar en
//  `.guardian-excepciones.log` cada vez que hay que salirse de la lista
//  declarada... y escribir ahí PARABA AL GUARDIÁN. O sea: cumplir la ley lo
//  rompía.
//
//  La causa no era misteriosa: el criterio «esto es un papel mío» vivía en UN
//  sitio y hacían falta DOS. La lista de archivos cambiados sí lo saltaba; la
//  comprobación de huellas, no. Así que el guardián se saltaba su propio libro y
//  después se quejaba de no haberlo visto — y encima lo llamaba «CAMBIO
//  INVISIBLE A GIT», cuando git lo seguía y lo había commiteado horas antes.
//  Lo invisible no era para git: era que el guardián no lo había mirado.
describe('EL GUARDIÁN · sus propios papeles no le paran el trabajo', () => {
  it('el libro de excepciones es papel suyo', () => {
    assert.strictEqual(esPapelDelGuardian('.', '.guardian-excepciones.log'), true,
      '⛔ escribir en el libro de excepciones vuelve a parar al guardián, y la ley manda ' +
      'escribir ahí. Cumplir la ley no puede romper al vigilante.');
  });

  it('su foto y su configuración también', () => {
    assert.strictEqual(esPapelDelGuardian('.', '.guardian-foto.json'), true);
    assert.strictEqual(esPapelDelGuardian('.', '.guardian.json'), true);
  });

  it('cualquier otro archivo NO lo es', () => {
    assert.strictEqual(esPapelDelGuardian('.', 'guajirago/src/Solicitar.js'), false);
    assert.strictEqual(esPapelDelGuardian('.', 'CLAUDE.md'), false,
      '⛔ si CLAUDE.md contara como papel del guardián, tocarlo dejaría de vigilarse');
  });

  //  🔴 Y EL ESCAPE QUE HABRÍA SIDO FÁCIL: dar por papel del guardián un archivo
  //   con el mismo nombre dentro de OTRO repo. Los repos hermanos tienen su
  //   propia carpeta, y un `.guardian.json` suyo no es papel de este guardián.
  it('un archivo con el mismo nombre en OTRO repo no se cuela', () => {
    assert.strictEqual(esPapelDelGuardian('guajirago-admin', '.guardian.json'), false,
      '⛔ un archivo de otro repo pasaría por papel de este guardián y dejaría de vigilarse');
  });
});
