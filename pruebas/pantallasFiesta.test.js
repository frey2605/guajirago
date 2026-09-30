// 🎉 G80 (29-sep-2026) · LAS PANTALLAS DE FIESTA: el fondo y el confeti salen de UN marco común, y cada una se ve igual.
//
// Cuatro pantallas celebraban dibujando a mano el mismo fondo blanco y el mismo confeti que cae: la bienvenida del
// pasajero (Login.js), la del conductor (App.js), «¡Recibiste tu saldo!» (AppConductor.js) y «¡Código activado!»
// (Promociones.js). Ahora las cuatro se pintan dentro de `PantallaFiesta` (PantallaFiesta.js), y cada una pone su
// dibujo, su título, su tarjeta y su botón.
//
// Esta prueba NO lee textos sueltos: con `scripts/medir-pantallas-fiesta.cjs` saca cada pantalla de su archivo, la
// PINTA con React (con el confeti cayendo en sitios fijos) y la carea con el commit de antes del arreglo (03b0997):
// lo que se ve, igual; el resto de cada archivo, sin tocar; y el confeti dibujado en UN solo sitio de las tres apps.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { medir, PIEZA } = require('../scripts/medir-pantallas-fiesta.cjs');
const { leer } = require('./cargar.cjs');

const ANTES = '03b0997'; // el último commit con el marco y el confeti copiados en las cuatro pantallas
const LOGIN = 'guajirago/src/Login.js';
const APP = 'guajirago/src/App.js';
const PROMO = 'guajirago/src/Promociones.js';

describe('G80 · las pantallas de fiesta salen de UN marco', () => {
  const hoy = medir(null);
  const antes = medir(ANTES);

  it('las cuatro pantallas usan el marco común y se pueden pintar', () => {
    assert.strictEqual(hoy.pantallas.length, 4);
    for (const p of hoy.pantallas) {
      assert.ok(p.pintadas, p.nombre + ': no se encontró su función');
      assert.ok(p.usaLaPieza, p.nombre + ': no se pinta dentro de PantallaFiesta');
    }
  });

  it('cada una se ve EXACTAMENTE como antes, en todos sus casos', () => {
    for (const [i, p] of hoy.pantallas.entries()) {
      assert.strictEqual(antes.pantallas[i].usaLaPieza, false, 'el careo: antes cada una dibujaba su marco');
      for (const [k, seVe] of p.seVe.entries()) {
        assert.strictEqual(seVe, antes.pantallas[i].seVe[k],
          p.nombre + ' (caso ' + (k + 1) + '): ya no se ve igual que antes del arreglo.\nANTES: ' + antes.pantallas[i].seVe[k] + '\nAHORA: ' + seVe);
      }
    }
    // Y lo propio de cada una sigue ahí.
    const [login, app, saldo, promo] = hoy.pantallas.map((p) => p.pintadas[0]);
    assert.match(login, /¡Bienvenido a GuajiraGo![\s\S]*¡Vamos! 🎉/);
    assert.match(app, /¡Bienvenido, conductor![\s\S]*¡A rodar! 🎉/);
    assert.match(saldo, /¡Recibiste tu saldo![\s\S]*Continuar/);
    assert.match(promo, /¡Código activado![\s\S]*4821[\s\S]*Entendido/);
  });

  it('el resto de cada archivo no se movió', () => {
    // Es el careo DEL ARREGLO de G80: el commit del arreglo (f6a60f4) contra el de antes, no el disco de hoy. Comparar
    // el disco lo ponía rojo con cualquier arreglo posterior de otra parte de esos archivos (le pasó a G81, que cambió
    // la lectura del saldo en AppConductor.js). Es lo mismo que ya se hizo en pruebas/tratoHecho.test.js.
    const arreglo = medir('f6a60f4');
    for (const [i, p] of arreglo.pantallas.entries()) assert.strictEqual(p.resto, antes.pantallas[i].resto, p.nombre + ': el arreglo de G80 movió algo que no era la pantalla de fiesta');
  });

  it('en las tres apps el confeti está dibujado en UN solo archivo, el marco', () => {
    assert.deepStrictEqual(hoy.dibujadas, [PIEZA + ' ×2'], 'dibujado en: ' + hoy.dibujadas.join(', '));
    assert.strictEqual(antes.dibujadas.length, 4, 'el careo: antes eran cuatro copias');
  });

  it('el medidor no se puede ablandar', () => {
    const login = leer(LOGIN);
    const app = leer(APP);
    const promo = leer(PROMO);
    const pieza = leer(PIEZA);
    const cambia = (t, de, a) => { const r = t.replace(de, a); assert.notStrictEqual(r, t, 'la pantalla de mentira no calzó: ' + de); return r; };
    const conLogin = (i, m) => m.pantallas[i];
    // 1 · el pasajero vuelve a dibujar su confeti a mano
    const aMano = cambia(login, '<PantallaFiesta estilo="bienvenida">',
      '<PantallaFiesta estilo="bienvenida"><style>{`@keyframes otra { from { transform: translateY(-9px); } to { transform: translateY(100vh); } }`}</style>');
    assert.strictEqual(medir(null, { [LOGIN]: aMano }).dibujadas.length, 2);
    // 2 · la bienvenida del pasajero deja el marco
    const sinMarco = cambia(cambia(login, '<PantallaFiesta estilo="bienvenida">', '<div>'), '    </PantallaFiesta>', '    </div>');
    assert.strictEqual(conLogin(0, medir(null, { [LOGIN]: sinMarco })).usaLaPieza, false);
    // 3 · el marco pinta una bolita menos
    const m3 = medir(null, { [PIEZA]: cambia(pieza, 'piezas: 40', 'piezas: 39') });
    assert.notStrictEqual(m3.pantallas[0].seVe[0], antes.pantallas[0].seVe[0]);
    // 4 · la bienvenida del conductor pierde sus seis colores
    const m4 = medir(null, { [APP]: cambia(app, " colores={['#FFCF4D', '#FF7A2F', '#D6357E', '#2ECC71', '#4DA3FF', '#1C8EF9']}", '') });
    assert.notStrictEqual(m4.pantallas[1].seVe[0], antes.pantallas[1].seVe[0]);
    // 5 · el rebote de los dibujos cambia de nombre y ya no existe su animación
    const m5 = medir(null, { [PIEZA]: cambia(pieza, "export const REBOTE = 'rebotarBienvenida", "export const REBOTE = 'rebotar") });
    assert.notStrictEqual(m5.pantallas[0].seVe[0], antes.pantallas[0].seVe[0]);
    // 6 · algo del resto de Promociones se mueve
    const m6 = medir(null, { [PROMO]: cambia(promo, 'function Promociones({ onVolver }) {', 'function Promociones({ onVolver, x }) {') });
    assert.notStrictEqual(m6.pantallas[3].resto, antes.pantallas[3].resto);
  });
});
