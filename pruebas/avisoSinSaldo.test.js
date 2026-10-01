/**
 * 💳 EL AVISO DE «NO TE ALCANZA EL SALDO» — gemelo G69 (29-sep-2026).
 *
 * AppConductor.js frena por saldo en dos sitios (el interruptor y aceptar/contraofertar una solicitud). Los dos
 * avisaban con un alert() y un texto propio cada uno. Ahora los dos enseñan la MISMA ventanita, AVISO_SIN_SALDO de
 * textosViaje.js. Esta prueba SACA cada freno del archivo y CORRE su cuerpo (scripts/medir-aviso-sin-saldo.cjs), y
 * corre también su decisión con una tabla de casos para exigir que el umbral NO se movió respecto al código de antes.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-aviso-sin-saldo.cjs');

const ANTES = '2387169'; // el último commit con los dos alert(): su umbral es la vara.
const { AVISO_SIN_SALDO } = cargarDeLaApp('guajirago/src/textosViaje.js');
const hoy = M.medirCodigo(M.lector(null));

/** Un lector que cambia AppConductor.js por una versión de mentira (el resto, del disco). */
function conPantalla(cambiar) {
  const del = M.lector(null);
  return (r) => (r === 'guajirago/src/AppConductor.js' ? cambiar(del(r).replace(/\r\n/g, '\n')) : del(r));
}

describe('G69 · el aviso de «no tienes saldo» sale de UNA ventanita', () => {
  it('la pieza existe, en español, con título y texto que manda a recargar', () => {
    assert.ok(AVISO_SIN_SALDO, 'no existe AVISO_SIN_SALDO en textosViaje.js');
    assert.strictEqual(AVISO_SIN_SALDO.ok, false);
    assert.ok(AVISO_SIN_SALDO.titulo && AVISO_SIN_SALDO.titulo.length > 3, 'la ventanita no tiene título');
    assert.match(AVISO_SIN_SALDO.texto, /saldo/i);
    assert.match(AVISO_SIN_SALDO.texto, /[Rr]ecarga/);
  });

  // P05 (30-sep-2026): el interruptor ya no frena por saldo (decisión del dueño); queda UN freno, al aceptar o
  // contraofertar. La franja que lo explica la vigila pruebas/disponibleSinSaldo.test.js.
  it('el freno por saldo avisa con esa ventanita, y ninguno con alert()', () => {
    assert.strictEqual(hoy.sitios.length, 1, 'AppConductor.js debería tener 1 freno por saldo (al ofertar) y tiene ' + hoy.sitios.length);
    for (const s of hoy.sitios) {
      assert.strictEqual(s.dice.length, 1, 'el freno del renglón ' + s.renglon + ' avisa ' + s.dice.length + ' veces');
      assert.strictEqual(s.dice[0].via, 'ventanita', 'el freno del renglón ' + s.renglon + ' avisa por ' + s.dice[0].via);
      assert.strictEqual(s.dice[0].texto, AVISO_SIN_SALDO.texto, 'el freno del renglón ' + s.renglon + ' no usa el texto de la pieza');
      assert.strictEqual(s.dice[0].titulo, AVISO_SIN_SALDO.titulo);
    }
    assert.strictEqual(hoy.textosDistintos, 1);
    assert.strictEqual(hoy.alerts, 0, 'volvió un alert() a AppConductor.js');
    assert.deepStrictEqual(hoy.aMano, [], 'hay un texto de «saldo suficiente» escrito a mano en una pantalla');
  });

  it('la ventanita se pinta: la tarjeta sube su aviso a la pantalla, y la pantalla tiene AvisoModal', () => {
    const fuente = soloCodigo(fs.readFileSync(path.join(RAIZ, 'guajirago/src/AppConductor.js'), 'utf8'));
    assert.match(fuente, /<TarjetaSolicitud[\s\S]*?onAviso=\{setAviso\}/, 'la tarjeta ya no recibe setAviso por onAviso');
    assert.match(fuente, /<AvisoModal aviso=\{aviso\} onCerrar=\{\(\) => setAviso\(null\)\} \/>/);
  });

  it('el umbral NO se movió: el freno al ofertar decide igual que en el commit de antes, caso por caso', () => {
    const antes = M.medirCodigo(M.lector(ANTES));
    assert.strictEqual(antes.sitios.length, 2); // el de ofertar (primero en el archivo) y el del interruptor, que P05 quitó
    for (let i = 0; i < hoy.sitios.length; i += 1) {
      assert.strictEqual(hoy.sitios[i].huella, antes.sitios[i].huella, 'el freno ' + (i + 1) + ' cambió cuándo frena');
      assert.strictEqual(hoy.sitios[i].frena, antes.sitios[i].frena);
    }
    // Y la vara de antes sí era la de los dos alert(): si no, el careo no compara nada.
    assert.strictEqual(antes.alerts, 2);
    assert.strictEqual(antes.textosDistintos, 2);
  });

  it('el medidor no se deja engañar (pantallas de mentira)', () => {
    const conAlert = M.medirCodigo(conPantalla((t) => t.replace('onAviso(AVISO_SIN_SALDO);', "alert('Sin saldo');")));
    assert.ok(conAlert.sitios.some((s) => s.dice.some((d) => d.via === 'alert()')), 'no vio un alert() de vuelta');
    assert.strictEqual(conAlert.alerts, 1);
    const aMano = M.medirCodigo(conPantalla((t) => t.replace('onAviso(AVISO_SIN_SALDO);', "onAviso({ titulo: 'Sin saldo', texto: 'Recarga ya.' });")));
    // P05: con un solo freno, el texto propio es el único que hay; se mira que ya no sea el de la pieza.
    assert.notStrictEqual(aMano.sitios[0].dice[0].texto, AVISO_SIN_SALDO.texto, 'no vio una ventanita con texto propio');
    const tercero = M.medirCodigo(conPantalla((t) => t.replace('const user = auth.currentUser;', "if (saldoCreditos < 1) { alert('No tienes saldo suficiente para tomar viajes.'); return; }\n    const user = auth.currentUser;")));
    assert.strictEqual(tercero.sitios.length, 2, 'no vio un segundo freno');
    assert.strictEqual(tercero.aMano.length, 1, 'no vio el texto a mano');
    const mudo = M.medirCodigo(conPantalla((t) => t.replace('onAviso(AVISO_SIN_SALDO);', '')));
    assert.ok(mudo.sitios.some((s) => s.dice.length === 0), 'no vio un freno que se calla');
    const umbral = M.medirCodigo(conPantalla((t) => t.replace('saldoCreditos < comisionAplicable', 'saldoCreditos <= comisionAplicable')));
    assert.notStrictEqual(umbral.sitios[0].huella, hoy.sitios[0].huella, 'no vio que el umbral cambió');
  });
});
