// 🚨 G70 (29-sep-2026) · «LLAMAR AL 123»: UNA sola tarjeta y UN solo número, y al tocarla hace lo mismo que antes.
//
// La tarjeta roja salía dibujada a mano en Ajustes › Seguridad (Seguridad.js) y en la ventanita del 🚨 del viaje
// (Solicitar.js), cada una con su propio `tel:123`. Ahora las dos pintan `TarjetaLlamar123` de LlamarAl123.js.
//
// Esta prueba NO lee textos sueltos: con `scripts/medir-llamar-123.cjs` saca la tarjeta de cada pantalla, la PINTA con
// React y la TOCA con un `window` de mentira. Y la carea con el commit de antes del arreglo (e6877b2): cada pantalla
// tiene que verse EXACTAMENTE igual que antes (mismo HTML) y llamar al mismo sitio.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { medir } = require('../scripts/medir-llamar-123.cjs');
const { leer } = require('./cargar.cjs');

const ANTES = 'e6877b2'; // el último commit con las dos tarjetas dibujadas a mano
const SEGURIDAD = 'guajirago/src/Seguridad.js';
const SOLICITAR = 'guajirago/src/Solicitar.js';

describe('G70 · «Llamar al 123» sale de UNA pieza', () => {
  const hoy = medir(null);
  const antes = medir(ANTES);

  it('cada pantalla pinta la tarjeta de la pieza común, una sola vez', () => {
    for (const p of hoy.pantallas) {
      assert.strictEqual(p.tarjetas.length, 1, p.nombre + ': debería tener UNA tarjeta de «Llamar al 123», tiene ' + p.tarjetas.length);
      assert.ok(p.tarjetas[0].pieza, p.nombre + ': la tarjeta está dibujada a mano otra vez, en vez de usar TarjetaLlamar123 de LlamarAl123.js');
    }
  });

  it('al tocarla, en las dos pantallas, llama al 123 (lo mismo que antes)', () => {
    for (const [i, p] of hoy.pantallas.entries()) {
      assert.strictEqual(p.tarjetas[0].paraOnde, 'tel:123', p.nombre + ': al tocar la tarjeta va a «' + p.tarjetas[0].paraOnde + '», no a tel:123');
      assert.strictEqual(p.tarjetas[0].paraOnde, antes.pantallas[i].tarjetas[0].paraOnde, p.nombre + ': al tocarla ya no hace lo mismo que antes');
    }
  });

  it('se ve EXACTAMENTE como antes: cada pantalla conserva su tamaño (la de Ajustes más grande, la del viaje compacta)', () => {
    for (const [i, p] of hoy.pantallas.entries()) {
      assert.strictEqual(p.tarjetas[0].html, antes.pantallas[i].tarjetas[0].html,
        p.nombre + ': la tarjeta ya no se ve igual que antes del arreglo.\nANTES: ' + antes.pantallas[i].tarjetas[0].html + '\nAHORA: ' + p.tarjetas[0].html);
    }
    assert.notStrictEqual(hoy.pantallas[0].tarjetas[0].html, hoy.pantallas[1].tarjetas[0].html,
      'las dos pantallas salen iguales: se perdió la diferencia de tamaño que cada una tenía a propósito');
  });

  it('en toda la app hay UNA tarjeta dibujada y UN solo sitio que arma el enlace al 123', () => {
    assert.strictEqual(hoy.dibujadas, 1, 'tarjetas rojas de «Llamar al 123» dibujadas en guajirago/src: ' + hoy.dibujadas + ' (debe ser 1, la de LlamarAl123.js)');
    assert.deepStrictEqual(hoy.telAMano, [], '«tel:123» escrito a mano en: ' + hoy.telAMano.join(', ') + '. El número sale de NUMERO_EMERGENCIA');
    assert.deepStrictEqual(hoy.sitiosQueLlaman, ['LlamarAl123.js ×1'], 'sitios que arman el enlace para llamar: ' + hoy.sitiosQueLlaman.join(', '));
    // el careo: antes eran dos de cada
    assert.strictEqual(antes.dibujadas, 2);
    assert.strictEqual(antes.sitiosQueLlaman.length, 2);
  });

  it('el medidor no se puede ablandar: ve una tarjeta dibujada a mano otra vez y una que ya no llama', () => {
    const t = leer(SEGURIDAD).replace(/\r\n/g, '\n');
    // 1 · alguien vuelve a dibujarla a mano en Seguridad
    const aMano = t.replace('<TarjetaLlamar123 donde="ajustes" />',
      '<div onClick={() => { window.location.href = \'tel:123\'; }} style={{ background: \'linear-gradient(135deg, #FF4444, #CC0000)\' }}><p>Llamar al 123</p></div>');
    assert.notStrictEqual(aMano, t, 'la pantalla de mentira no calzó: ya no está <TarjetaLlamar123 donde="ajustes" /> en Seguridad.js');
    const m1 = medir(null, { [SEGURIDAD]: aMano });
    assert.strictEqual(m1.pantallas[0].tarjetas[0].pieza, false);
    assert.strictEqual(m1.dibujadas, 2);
    assert.strictEqual(m1.telAMano.length, 1);
    // 2 · una tarjeta a mano que no llama a ningún sitio
    const muda = t.replace('<TarjetaLlamar123 donde="ajustes" />', '<div onClick={() => {}}><p>Llamar al 123</p></div>');
    const m2 = medir(null, { [SEGURIDAD]: muda });
    assert.strictEqual(m2.pantallas[0].tarjetas[0].paraOnde, '(sin tocar)');
    // 3 · Solicitar pinta la de Ajustes (otro tamaño): el HTML ya no es el de antes
    const s = leer(SOLICITAR).replace(/\r\n/g, '\n').replace('<TarjetaLlamar123 donde="viaje" />', '<TarjetaLlamar123 donde="ajustes" />');
    const m3 = medir(null, { [SOLICITAR]: s });
    assert.notStrictEqual(m3.pantallas[1].tarjetas[0].html, antes.pantallas[1].tarjetas[0].html);
    // 4 · la pantalla se queda sin tarjeta
    const m4 = medir(null, { [SEGURIDAD]: t.replace('<TarjetaLlamar123 donde="ajustes" />', '') });
    assert.strictEqual(m4.pantallas[0].tarjetas.length, 0);
  });
});
