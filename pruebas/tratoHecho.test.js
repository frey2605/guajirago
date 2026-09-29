// 🤝 G74 (29-sep-2026) · «¡TRATO HECHO!»: UNA sola ventanita para el pasajero y el conductor, y se ve igual que antes.
//
// La ventanita salía dibujada a mano en Solicitar.js (el pasajero acepta una oferta) y en AppConductor.js (el pasajero
// escoge al conductor), cada una en su propia `function Celebracion()`, copiada igual. Ahora las dos pintan
// `TratoHecho` de TratoHecho.js.
//
// Esta prueba NO lee textos sueltos: con `scripts/medir-trato-hecho.cjs` busca lo que cada pantalla pinta mientras
// `celebrando` está puesto, lo saca de donde viva, lo PINTA con React y lo carea con el commit de antes del arreglo
// (bcc8fb3): mismo HTML, misma duración (3 s) y el resto de cada pantalla sin tocar.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { medir } = require('../scripts/medir-trato-hecho.cjs');
const { leer } = require('./cargar.cjs');

const ANTES = 'bcc8fb3'; // el último commit con la ventanita copiada en las dos pantallas
const SOLICITAR = 'guajirago/src/Solicitar.js';
const CONDUCTOR = 'guajirago/src/AppConductor.js';
const PIEZA = 'guajirago/src/TratoHecho.js';

describe('G74 · «¡Trato hecho!» sale de UNA pieza', () => {
  const hoy = medir(null);
  const antes = medir(ANTES);

  it('cada pantalla pinta la ventanita de la pieza común, una sola vez', () => {
    for (const p of hoy.pantallas) {
      assert.strictEqual(p.ventanitas.length, 1, p.nombre + ': debería pintar UNA ventanita al celebrar, pinta ' + p.ventanitas.length);
      assert.strictEqual(p.ventanitas[0].pieza, PIEZA, p.nombre + ': la ventanita no sale de TratoHecho.js (' + p.ventanitas[0].deDonde + ')');
      assert.ok(p.ventanitas[0].html, p.nombre + ': la ventanita no se pudo pintar');
    }
  });

  it('se ve EXACTAMENTE como antes, y el pasajero y el conductor ven lo mismo', () => {
    for (const [i, p] of hoy.pantallas.entries()) {
      assert.strictEqual(p.ventanitas[0].html, antes.pantallas[i].ventanitas[0].html,
        p.nombre + ': la ventanita ya no se ve igual que antes del arreglo.\nANTES: ' + antes.pantallas[i].ventanitas[0].html + '\nAHORA: ' + p.ventanitas[0].html);
      assert.match(p.ventanitas[0].html, /¡Trato hecho!/);
    }
    assert.strictEqual(hoy.pantallas[0].ventanitas[0].html, hoy.pantallas[1].ventanitas[0].html, 'el pasajero y el conductor ya no ven la misma ventanita');
  });

  it('dura lo mismo que antes (3 s) y el resto de cada pantalla no se movió', () => {
    for (const [i, p] of hoy.pantallas.entries()) {
      assert.deepStrictEqual(p.duraciones, antes.pantallas[i].duraciones, p.nombre + ': cambió cuánto dura la ventanita');
      assert.ok(p.duraciones.length > 0 && p.duraciones.every((d) => d === 3000), p.nombre + ': duraciones ' + p.duraciones.join(', '));
      assert.strictEqual(p.resto, antes.pantallas[i].resto, p.nombre + ': se movió algo de la pantalla que no era la ventanita');
    }
  });

  it('en las tres apps «¡Trato hecho!» está dibujado UNA vez, en la pieza', () => {
    assert.deepStrictEqual(hoy.dibujadas, [PIEZA + ' ×1'], 'dibujado en: ' + hoy.dibujadas.join(', '));
    assert.strictEqual(antes.dibujadas.length, 2, 'el careo: antes eran dos copias');
  });

  it('el medidor no se puede ablandar', () => {
    const s = leer(SOLICITAR).replace(/\r\n/g, '\n');
    const c = leer(CONDUCTOR).replace(/\r\n/g, '\n');
    const pieza = leer(PIEZA).replace(/\r\n/g, '\n');
    // 1 · el conductor vuelve a dibujarla a mano
    const aMano = c.replace('if (celebrando) return <TratoHecho />;', 'if (celebrando) return <Copia />;')
      .replace('function CelebracionConductor(', 'function Copia() { return (<div><h2>¡Trato hecho!</h2></div>); }\n\nfunction CelebracionConductor(');
    assert.notStrictEqual(aMano, c, 'la pantalla de mentira no calzó');
    const m1 = medir(null, { [CONDUCTOR]: aMano });
    assert.notStrictEqual(m1.pantallas[1].ventanitas[0].pieza, PIEZA);
    assert.strictEqual(m1.dibujadas.length, 2);
    // 2 · la pieza cambia de aspecto: el HTML ya no es el de antes
    const m2 = medir(null, { [PIEZA]: pieza.replace("fontSize: '28px'", "fontSize: '26px'") });
    assert.notStrictEqual(m2.pantallas[0].ventanitas[0].html, antes.pantallas[0].ventanitas[0].html);
    // 3 · alguien le cambia la duración al pasajero
    const m3 = medir(null, { [SOLICITAR]: s.replace('}, 3000);', '}, 1500);') });
    assert.notDeepStrictEqual(m3.pantallas[0].duraciones, antes.pantallas[0].duraciones);
    // 4 · el pasajero se queda sin ventanita
    const m4 = medir(null, { [SOLICITAR]: s.replace('if (celebrando) return <TratoHecho />;', '') });
    assert.strictEqual(m4.pantallas[0].ventanitas.length, 0);
  });
});
