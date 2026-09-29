// ═══════════════════════════════════════════════════════════════════════════
//  LAS VENTANITAS DE AVISO · UNA SOLA (AvisoModal) · gemelo G39, 28-sep-2026
//
//  En la app de transporte había 16 ventanitas de aviso escritas a mano (dibujito, título, texto y
//  «Entendido»), aunque AvisoModal.js ya existía. Las que eran AVISO pasaron a AvisoModal sin cambiar lo
//  que dicen; las que son otra cosa (el anuncio del panel, el mensaje del pasajero en grande, la
//  celebración con confeti) se quedaron, contadas en PENDIENTES con su porqué.
//
//  El juez es scripts/medir-ventanitas-aviso.cjs. Esta prueba no copia su recorrido: lo importa, le exige
//  la cuenta EXACTA (solo puede bajar, y a la vista), le exige que las cambiadas digan lo mismo que antes
//  (sacadas del archivo y EJECUTADAS), y le da archivos de mentira para que no se ablande.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const { medir, analizar, contarEn, PENDIENTES, CAMBIADAS } = require('../scripts/medir-ventanitas-aviso.cjs');

describe('G39 · las ventanitas de aviso salen de AvisoModal', () => {
  const r = medir();

  it('ninguna ventanita de aviso NUEVA escrita a mano, en las tres apps', () => {
    assert.deepStrictEqual(r.nuevas, [], '⛔ nació otra ventanita a mano: usa AvisoModal (' + r.nuevas.join(' · ') + ')');
  });

  it('la cuenta solo baja: si se pasa una a AvisoModal, se baja PENDIENTES', () => {
    assert.deepStrictEqual(r.sobran, [], 'PENDIENTES se quedó alto: ' + r.sobran.join(' · '));
  });

  it('en transporte quedan solo las 4 que no son avisos', () => {
    assert.strictEqual(r.transporte, 4, 'transporte tiene ' + r.transporte + ' ventanitas a mano');
  });

  it('las cambiadas dicen LO MISMO que antes (sacadas del archivo y ejecutadas)', () => {
    const mal = r.cambiadas.filter((c) => !c.igual).map((c) => c.nombre + ': ' + (c.falla || 'dice ' + JSON.stringify(c.dice) + ' y decía ' + JSON.stringify(c.decia)));
    assert.deepStrictEqual(mal, []);
    assert.strictEqual(r.cambiadas.length, CAMBIADAS.length);
  });

  it('Solicitar.js ya no tiene estados de ventanitas propias: todo entra por la general', () => {
    const t = leer('guajirago/src/Solicitar.js');
    for (const n of ['avisoOcupado', 'avisoFaltan', 'avisoLimite']) {
      assert.ok(!t.includes(n), 'Solicitar.js volvió a tener «' + n + '», una segunda ventanita al lado de la general');
    }
  });

  it('y el medidor no se puede ablandar: se queja de cada mentira', () => {
    // Cuenta bien lo que ve, y no cuenta lo que está en un comentario.
    assert.deepStrictEqual(contarEn('<div>\n<button onClick={x}>Entendido</button>\n</div>'), [2]);
    assert.deepStrictEqual(contarEn("<button onClick={x}>{'Entendido'}</button>"), [1]);
    assert.deepStrictEqual(contarEn('<button onClick={x}>\n  Entendido\n</button>'), [1]);
    assert.deepStrictEqual(contarEn('<button onClick={x}>Entendido 👍</button>'), [1], 'con un dibujito detrás también es una ventanita a mano');
    assert.deepStrictEqual(contarEn('<button onClick={x}><span>Entendido</span></button>'), [1], 'envuelto en un span también');
    assert.deepStrictEqual(contarEn('// <button>Entendido</button>\n{/* <button>Entendido</button> */}'), []);
    assert.deepStrictEqual(contarEn('<input accept="image/*" />\n<button onClick={x}>Entendido</button>\n<p>*/</p>'), [2],
      'un accept="image/*" no puede comerse el código de después');

    const REAL = Object.fromEntries(['guajirago/src/Restaurantes.js', 'guajirago/src/Login.js', 'guajirago/src/Solicitar.js', 'guajirago/src/AvisoModal.js', 'guajirago/src/configApp.js', ...Object.keys(PENDIENTES)].map((f) => [f, leer(f)]));
    const con = (cambio) => {
      const archivos = { ...REAL, ...cambio };
      return analizar(Object.keys(archivos), (f) => (f in archivos ? archivos[f] : leer(f)));
    };
    const base = con({});
    assert.deepStrictEqual(base.nuevas, [], 'sin mentiras el medidor tiene que dar por buena la de verdad');

    const R = REAL['guajirago/src/Restaurantes.js'];
    const L = REAL['guajirago/src/Login.js'];
    const S = REAL['guajirago/src/Solicitar.js'];
    const MENTIRAS = [
      ['una ventanita nueva a mano en una pantalla', { 'guajirago/src/Nueva.js': '<div><p>Ojo</p><button onClick={c}>Entendido</button></div>' }, (x) => x.nuevas.length > 0],
      ['una más en un archivo que ya tenía permitidas', { 'guajirago/src/Anuncio.js': REAL['guajirago/src/Anuncio.js'] + '\n<button onClick={c}>Entendido</button>' }, (x) => x.nuevas.length > 0],
      ['una que se quita y nadie baja PENDIENTES', { 'guajirago/src/Promociones.js': REAL['guajirago/src/Promociones.js'].replace(/>Entendido<\/button>/, '>Listo</button>') }, (x) => x.sobran.length > 0],
      ['el título cambiado', { 'guajirago/src/Restaurantes.js': R.replace("titulo: 'Falta el método de pago'", "titulo: 'Falta pagar'") }, (x) => x.bien < x.cambiadas.length],
      ['el dibujito cambiado', { 'guajirago/src/Restaurantes.js': R.replace("icono: '🏷️'", "icono: '⚠️'") }, (x) => x.bien < x.cambiadas.length],
      ['el texto que ya no llega', { 'guajirago/src/Login.js': L.replace("texto: error }} onCerrar={() => setError('')}", "texto: '' }} onCerrar={() => setError('')}") }, (x) => x.bien < x.cambiadas.length],
      ['el conductor ocupado sin su nombre', { 'guajirago/src/Solicitar.js': S.replace("${oferta.conductorNombre || 'Ese conductor'} ya tomó", 'El conductor ya tomó') }, (x) => x.bien < x.cambiadas.length],
      ['el aviso de faltan datos sin la lista', { 'guajirago/src/Solicitar.js': S.replace("'Completa esto para enviar tu mandado: ' + faltan.join(', ') + '.'", "'Completa esto para enviar tu mandado.'") }, (x) => x.bien < x.cambiadas.length],
    ];
    const escapan = [];
    for (const [nombre, cambio, pillada] of MENTIRAS) {
      for (const k of Object.keys(cambio)) assert.notStrictEqual(cambio[k], REAL[k], 'la mentira «' + nombre + '» no cambió nada');
      if (!pillada(con(cambio))) escapan.push(nombre);
    }
    assert.deepStrictEqual(escapan, [], '⛔ el medidor da por buenas estas mentiras');
  });
});
