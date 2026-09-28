// ═══════════════════════════════════════════════════════════════════════════
//  «¿POR QUÉ CANCELAS?» — UNA SOLA VENTANITA, Y SUS MOTIVOS SE LEEN · gemelo G06, 28-sep-2026
//
//  Estaba escrita dos veces (Solicitar.js y AppConductor.js). Se arregló la del conductor al pasar
//  al tema claro y la del pasajero se quedó con los motivos en letra BLANCA sobre la tarjeta blanca.
//  Ahora vive en guajirago/src/ModalCancelacion.js y las dos pantallas la importan.
//
//  El juez es scripts/medir-cancelacion-g06.cjs: busca la ventanita en las TRES apps, sigue el import
//  de cada pantalla, saca del archivo el estilo del motivo y lo CORRE para medir el contraste. Esta
//  prueba no copia su recorrido: lo importa, y además le da ventanitas de mentira para que no se ablande.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { medir, analizar, contraste, CONTRASTE_MINIMO } = require('../scripts/medir-cancelacion-g06.cjs');

describe('«¿POR QUÉ CANCELAS?» · una sola ventanita, y los motivos se leen', () => {
  const r = medir();

  it('está escrita UNA sola vez en las tres apps, en ModalCancelacion.js', () => {
    assert.deepStrictEqual(r.escritas, ['guajirago/src/ModalCancelacion.js'], '⛔ la ventanita volvió a nacer gemela');
  });

  it('el pasajero y el conductor la importan de ahí, con SU lista de motivos', () => {
    const [pasajero, conductor] = r.pantallas;
    for (const p of [pasajero, conductor]) {
      assert.ok(!p.error, p.quien + ': ' + p.error);
      assert.strictEqual(p.de, 'guajirago/src/ModalCancelacion.js', p.quien + ' no usa la ventanita común');
      assert.strictEqual(p.propia, false, p.quien + ' tiene su propia ventanita');
    }
    assert.strictEqual(pasajero.usos, 2, 'el pasajero la abre desde sus dos pantallas de viaje');
    assert.deepStrictEqual([...new Set(pasajero.listas)], ['RAZONES_CANCELACION_PASAJERO']);
    assert.strictEqual(conductor.usos, 1);
    assert.deepStrictEqual(conductor.listas, ['RAZONES_CANCELACION_CONDUCTOR']);
  });

  it('los motivos sin escoger se leen en las dos pantallas (contraste ≥ 4,5)', () => {
    for (const p of r.pantallas) {
      const s = p.estados['sin escoger'];
      assert.ok(s.contraste >= CONTRASTE_MINIMO, '⛔ ' + p.quien + ': letra ' + s.letra + ' sobre ' + s.fondo + ' → contraste ' + s.contraste);
    }
    assert.deepStrictEqual(r.ilegibles, []);
  });

  it('el contraste se calcula bien: blanco sobre blanco es 1, negro sobre blanco es 21', () => {
    assert.strictEqual(contraste('#FFFFFF', '#FFFFFF'), 1);
    assert.strictEqual(contraste('#000000', '#FFFFFF'), 21);
    assert.strictEqual(contraste('#FFFFFF', 'transparent'), 1, 'un fondo transparente se mira sobre la tarjeta blanca');
  });

  it('y el medidor no se puede ablandar: se queja de cada ventanita de mentira', () => {
    const buena = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'guajirago/src/ModalCancelacion.js'), 'utf8');
    const pantalla = (lista) => "import ModalCancelacion from './ModalCancelacion';\n<ModalCancelacion razones={" + lista + '} ocupado={ocupado} />\n';
    const PAS = 'guajirago/src/Solicitar.js';
    const CON = 'guajirago/src/AppConductor.js';
    const VEN = 'guajirago/src/ModalCancelacion.js';
    const con = (archivos) => analizar(Object.keys(archivos), (ruta) => (ruta in archivos ? archivos[ruta] : null));
    const base = { [PAS]: pantalla('RAZONES_CANCELACION_PASAJERO'), [CON]: pantalla('RAZONES_CANCELACION_CONDUCTOR'), [VEN]: buena };
    // Sin mentiras, el medidor da por buena la de verdad (si no, las mentiras de abajo no demuestran nada).
    assert.deepStrictEqual(con(base).ilegibles, []);
    assert.strictEqual(con(base).escritas.length, 1);

    const MENTIRAS = [
      ['la letra del motivo, blanca', { [VEN]: buena.replace("escogido ? '#FF4444' : '#1A1A1E'", "escogido ? '#FF4444' : '#FFFFFF'") }, 'ilegible'],
      ['la letra del motivo, gris claro', { [VEN]: buena.replace("escogido ? '#FF4444' : '#1A1A1E'", "escogido ? '#FF4444' : '#DDDDDD'") }, 'ilegible'],
      ['el fondo del motivo, del color de la letra', { [VEN]: buena.replace("background: escogido ? 'rgba(255,68,68,0.15)' : '#FFFFFF'", "background: escogido ? 'rgba(255,68,68,0.15)' : '#1A1A1E'") }, 'ilegible'],
      ['el estilo escrito a mano en el botón, blanco', { [VEN]: buena.replace('style={estiloMotivo(razonSeleccionada === razon)}', "style={{ color: '#FFFFFF', background: '#FFFFFF' }}") }, 'ilegible'],
      ['el pasajero con su propia ventanita (gemela)', { [PAS]: buena.replace(/export default /, '').replace(/import[^\n]*\n/, '') + pantalla('RAZONES_CANCELACION_PASAJERO') }, 'gemela'],
      ['el pasajero sin ventanita de dónde sacarla', { [PAS]: '<ModalCancelacion razones={RAZONES_CANCELACION_PASAJERO} />' }, 'ilegible'],
    ];
    const escapan = [];
    for (const [nombre, cambio, espera] of MENTIRAS) {
      const archivos = { ...base, ...cambio };
      for (const k of Object.keys(cambio)) assert.notStrictEqual(archivos[k], base[k], 'la mentira «' + nombre + '» no cambió nada');
      const x = con(archivos);
      const pillada = espera === 'gemela' ? x.escritas.length > 1 : x.ilegibles.length > 0;
      if (!pillada) escapan.push(nombre);
    }
    assert.deepStrictEqual(escapan, [], '⛔ el medidor da por buenas estas ventanitas rotas');
  });
});
