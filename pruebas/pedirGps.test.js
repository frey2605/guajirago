/**
 * PEDIRLE EL GPS AL TELÉFONO — una sola pieza (gemelo G28, 28-sep-2026).
 *
 * Pedir el GPS estaba escrito seis veces con cinco juegos de tiempos, y el
 * seguimiento del conductor dejaba seguimientos sueltos que escribían su ficha
 * después de salir del turno. Esta prueba EJECUTA:
 *   1. la pieza `guajirago/src/pedirGps.js` con teléfonos de mentira;
 *   2. el efecto del conductor sacado de `AppConductor.js` (con el medidor
 *      `scripts/medir-gps.cjs`, que se IMPORTA, no se copia);
 *   3. cada sitio que pide el GPS, para que siga pidiendo con SU juego;
 *   4. el botón de la dirección del pedido (`Restaurantes.js`), que avisa si falla.
 * Y vigila que nadie vuelva a pedir el GPS a mano fuera de la pieza.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer, soloCodigo, cuerpoDeLaFuncion } = require('./cargar.cjs');
const M = require('../scripts/medir-gps.cjs');

const { GPS, pedirGps, seguirGps } = cargarDeLaApp(M.PIEZA);

/** Un teléfono que contesta según la precisión que se le pida, y cuenta sus seguimientos. */
function telefono({ satelite, wifi }) {
  let sig = 1;
  const vivos = new Map();
  const pedidos = [];
  const contesta = (o) => ((o || {}).enableHighAccuracy === true ? satelite : wifi);
  const pos = { coords: { latitude: 11.53, longitude: -72.92 } };
  return {
    vivos,
    pedidos,
    tic() {
      for (const [, w] of [...vivos]) {
        if (contesta(w.o)) w.bien(pos); else w.mal({ code: 3 });
      }
    },
    navigator: {
      geolocation: {
        getCurrentPosition: (bien, mal, o) => { pedidos.push(o); return contesta(o) ? bien(pos) : mal({ code: 3 }); },
        watchPosition: (bien, mal, o) => { const id = sig++; vivos.set(id, { bien, mal, o }); pedidos.push(o); return id; },
        clearWatch: (id) => { vivos.delete(id); },
      },
    },
  };
}

describe('PEDIR EL GPS · la pieza común', () => {
  it('EL QUE MUERDE · prueba los intentos del juego en orden y para en el primero que contesta', () => {
    const t = telefono({ satelite: false, wifi: true });
    const r = [];
    pedirGps(t.navigator, 'pantalla', () => r.push('bien'), () => r.push('mal'));
    assert.deepStrictEqual(r, ['bien'], 'bajo techo (sin satélite, con wifi) la ubicación tiene que llegar');
    assert.deepStrictEqual(t.pedidos, GPS.pantalla, 'no pidió los intentos del juego, en su orden');

    const t2 = telefono({ satelite: true, wifi: true });
    pedirGps(t2.navigator, 'pantalla', () => {}, () => {});
    assert.strictEqual(t2.pedidos.length, 1, 'con el satélite contestando no hace falta pedir el respaldo');
  });

  it('EL QUE MUERDE · si fallan todos, lo dice UNA vez; y un juego que no existe revienta', () => {
    const t = telefono({ satelite: false, wifi: false });
    const r = [];
    pedirGps(t.navigator, 'pantalla', () => r.push('bien'), (e) => r.push(e && e.code));
    assert.deepStrictEqual(r, [3], 'con el teléfono callado, el que llama tiene que enterarse una vez, con el error');
    assert.throws(() => pedirGps(t.navigator, 'inventado', () => {}, () => {}), /No existe el juego de GPS/);
  });

  it('EL QUE MUERDE · el seguimiento abre UN solo respaldo aunque el satélite se caiga muchas veces, y parar lo cierra todo', () => {
    const t = telefono({ satelite: false, wifi: false });
    const parar = seguirGps(t.navigator, 'seguimiento', () => {});
    for (let i = 0; i < 7; i += 1) t.tic();
    assert.strictEqual(t.vivos.size, 2, 'con el satélite cayéndose 7 veces hay ' + t.vivos.size
      + ' seguimientos abiertos: cada caída abre otro respaldo sin cerrar el anterior (el fallo de G28).');
    parar();
    assert.strictEqual(t.vivos.size, 0, 'al parar quedan ' + t.vivos.size + ' seguimientos abiertos.');
    t.tic();
    assert.strictEqual(t.vivos.size, 0, 'después de parar, una caída del satélite volvió a abrir un seguimiento.');
  });

  it('los juegos cumplen la regla del respaldo: satélite primero, wifi de respaldo, aceptando la guardada', () => {
    for (const nombre of ['pantalla', 'emergencia', 'seguimiento']) {
      const [a, b] = GPS[nombre];
      assert.ok(a.enableHighAccuracy === true && b && b.enableHighAccuracy === false,
        'el juego «' + nombre + '» no pide primero el satélite y de respaldo el wifi');
      assert.ok(a.maximumAge > 0 && b.maximumAge > 0, 'el juego «' + nombre + '» tira una posición que el aparato ya tiene');
    }
    //  El del botón es a propósito de un intento: lo aprieta una persona y se le dice si falla.
    assert.strictEqual(GPS.boton.length, 1);
  });
});

describe('EL SEGUIMIENTO DEL CONDUCTOR · no deja seguimientos sueltos (AppConductor.js, corrido)', () => {
  it('EL QUE MUERDE · al salir del turno no queda nada abierto ni nada escribe su ficha', () => {
    const leerDe = M.lector(null);
    const c = M.elSeguimientoDelConductor(leerDe, { satelite: false, wifi: false, caidas: 5 });
    assert.ok(!c.falla, c.falla);
    assert.strictEqual(c.abiertosAlSalir, 0, 'al salir del turno quedan ' + c.abiertosAlSalir + ' seguimientos abiertos.');
    assert.strictEqual(c.escritasAlSalir, 0, 'con el conductor ya fuera del turno, su ficha se escribió '
      + c.escritasAlSalir + ' veces (con `activo: true`): seguimientos sueltos.');
  });

  it('y su ubicación sigue llegando bajo techo y en la calle (no se rompe lo que servía)', () => {
    const leerDe = M.lector(null);
    for (const [como, tel] of [['bajo techo', { satelite: false, wifi: true }], ['en la calle', { satelite: true, wifi: true }]]) {
      const r = M.elSeguimientoDelConductor(leerDe, { ...tel, caidas: 3 });
      assert.ok(!r.falla, r.falla);
      assert.ok(r.escritasEnTurno >= 3, como + ': la ubicación del conductor se escribió solo ' + r.escritasEnTurno + ' veces en turno.');
      assert.strictEqual(r.abiertosAlSalir, 0, como + ': al salir quedan ' + r.abiertosAlSalir + ' seguimientos abiertos.');
      assert.ok(r.seguimientosPedidos.length > 0 && r.seguimientosPedidos[0].enableHighAccuracy === true,
        como + ': el seguimiento no empieza pidiendo el satélite.');
    }
  });
});

describe('LOS SEIS SITIOS · piden el GPS por la pieza, cada uno con su juego', () => {
  //  G28 junta, no cambia tiempos: cada sitio sigue pidiendo lo mismo que antes.
  const JUEGO = {
    'el pasajero al abrir la pantalla': 'pantalla',
    'el botón «Usar mi ubicación» del mapa': 'boton',
    'el conductor al entrar en turno': 'pantalla',
    'el botón de la dirección del pedido': 'boton',
    'los botones de emergencia': 'emergencia',
  };

  it('EL QUE MUERDE · nadie le pide el GPS al teléfono a mano fuera de pedirGps.js, en las tres apps', () => {
    const { sitios, juegos } = M.losQuePidenPorSuCuenta(M.lector(null));
    assert.deepStrictEqual(sitios, [], 'estos archivos vuelven a pedir el GPS por su cuenta:\n   · '
      + sitios.map(([r, n]) => r + ' (' + n + ')').join('\n   · ') + '\n   Que llamen a `pedirGps` o `seguirGps`.');
    assert.deepStrictEqual(juegos, [], 'hay tiempos de GPS escritos a mano fuera de pedirGps.js:\n   · ' + juegos.join('\n   · '));
  });

  it('EL QUE MUERDE · cada sitio pide, corrido, exactamente los intentos de su juego', () => {
    const v = M.medir(null);
    assert.strictEqual(v.intentos.length, Object.keys(JUEGO).length);
    for (const [quien, r] of v.intentos) {
      assert.ok(!r.falla, quien + ': ' + r.falla);
      //  Con el teléfono callado, se ven TODOS los intentos del juego.
      assert.deepStrictEqual(r.intentos, GPS[JUEGO[quien]], quien + ' no pide con el juego «' + JUEGO[quien] + '»');
    }
    //  El seguimiento del conductor, también por la pieza.
    const t = soloCodigo(leer('guajirago/src/AppConductor.js'));
    assert.match(t, /seguirGps\(navigator, 'seguimiento', guardarUbicacion\)/, 'el conductor no sigue su GPS con `seguirGps`');
  });

  it('el botón de la dirección del pedido, sin GPS, lo DICE (Restaurantes.js, corrido)', () => {
    const t = soloCodigo(leer('guajirago/src/Restaurantes.js'));
    const c = cuerpoDeLaFuncion(t, t.indexOf('const usarMiUbicacion'));
    assert.ok(c, 'no encuentro `usarMiUbicacion` en Restaurantes.js');
    const dicho = [];
    const ubicando = [];
    // eslint-disable-next-line no-new-func
    new Function('navigator', 'pedirGps', 'setUbicando', 'setAvisoUbic', 'setDireccion', 'window', c.texto)(
      telefono({ satelite: false, wifi: false }).navigator, pedirGps, (v) => ubicando.push(v), (x) => dicho.push(x), () => {}, {});
    assert.ok(dicho.some((x) => typeof x === 'string' && x.trim()), 'sin GPS el botón se queda callado');
    assert.strictEqual(ubicando[ubicando.length - 1], false, 'sin GPS el botón se queda «ubicando» para siempre');
  });
});
