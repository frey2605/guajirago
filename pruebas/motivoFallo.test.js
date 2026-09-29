// G40 · Cuando algo no se guarda, la pantalla dice POR QUÉ (y no «Revisa tu conexión» sea cual sea el fallo).
//
// Seis sitios de la app de transporte avisaban con un texto fijo: el código de seguridad del conductor, sus datos al
// registrarse, Mi perfil, el contacto de confianza y la reserva de turismo decían «Revisa tu conexión» aunque el
// servidor hubiera dicho que no o la foto pesara demasiado; y el código de descuento, que ya usaba la pieza, avisaba
// distinto que el de seguridad estando en la misma pantalla. La única pieza que sabe decir por qué es motivoDeRechazo
// (avisoRechazo.js).
//
// Nada se supone: scripts/medir-motivo-fallo.cjs saca de cada archivo el catch que pinta el aviso y lo EJECUTA con
// cuatro fallos (sin permiso, sin señal, frase de nuestro servidor, foto rechazada) y con la motivoDeRechazo real.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-motivo-fallo.cjs');

const { motivoDeRechazo } = cargarDeLaApp('guajirago/src/avisoRechazo.js');

describe('G40 · el aviso de un fallo al guardar dice el motivo', () => {
  const r = M.medir();

  it('se midieron los seis sitios de la fila G40', () => {
    assert.strictEqual(r.sitios.length, 6);
  });

  for (const s of M.SITIOS) {
    it('EL QUE MUERDE · «' + s.nombre + '» dice lo que dice motivoDeRechazo, fallo por fallo', () => {
      const medido = r.sitios.find((x) => x.nombre === s.nombre);
      assert.ok(!medido.siempreLoMismo, s.nombre + ': dice LO MISMO sea cual sea el fallo («' + medido.dice[0].texto + '»)');
      medido.dice.forEach((d, i) => {
        const m = motivoDeRechazo(M.FALLOS[i].e, '@@');
        // El texto que queda en pantalla es el de la pieza (con el nombre de lo que se intentaba, que pone el sitio).
        const esperado = new RegExp('^' + (s.setter === 'setAviso' ? '[^·]+ · ' : '')
          + m.texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('@@', '[^.]+') + '$');
        assert.match(d.texto, esperado, s.nombre + ' · ' + d.cual + ': no es el motivo de la pieza');
      });
      // La frase de nuestro servidor llega ENTERA y sin la marca técnica: es la pieza, no una copia.
      assert.ok(medido.dice[2].texto.endsWith('Ese código ya fue usado'), s.nombre + ': la frase del servidor no llegó limpia');
    });
  }

  it('EL QUE MUERDE · los dos códigos del conductor (seguridad y descuento) avisan igual ante el mismo fallo', () => {
    assert.ok(r.codigosIguales, 'el código de seguridad y el de descuento vuelven a avisar distinto');
  });

  it('los «Revisa tu conexión» a mano que quedan son los de PENDIENTES, y SOLO PUEDEN BAJAR', () => {
    const aMano = M.contarAMano();
    for (const [f, n] of Object.entries(aMano)) {
      assert.ok(n <= (M.PENDIENTES[f] || 0), f + ': ' + n + ' «Revisa tu conexión» a mano en un catch (se dejan '
        + (M.PENDIENTES[f] || 0) + '). Usa motivoDeRechazo.');
    }
    for (const [f, n] of Object.entries(M.PENDIENTES)) {
      assert.strictEqual(aMano[f] || 0, n, f + ': ya no tiene ' + n + ' — baja la cuenta de PENDIENTES en scripts/medir-motivo-fallo.cjs');
    }
  });

  it('EL QUE MUERDE · Turismo pinta en la ventanita el aviso de la pieza (título y texto) y sigue pintando los suyos', () => {
    const t = soloCodigo(leer('guajirago/src/Turismo.js'));
    const m = t.match(/<AvisoModal aviso=\{([^\n]*?)\} onCerrar=\{\(\) => setAviso\(''\)\} \/>/);
    assert.ok(m, 'Turismo ya no pinta el aviso con AvisoModal');
    // eslint-disable-next-line no-new-func
    const armar = new Function('aviso', 'return (' + m[1] + ');');
    const pieza = motivoDeRechazo({ code: 'permission-denied' }, 'enviar la reserva');
    assert.deepStrictEqual(armar(pieza), pieza, 'el aviso de la pieza no llega entero a la ventanita');
    assert.deepStrictEqual(armar('Escoge la fecha'), { titulo: 'Escoge la fecha' }, 'los avisos de «falta un dato» dejaron de salir');
  });
});
