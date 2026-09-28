// ═══════════════════════════════════════════════════════════════════════════
//  UN SOLO MAPA CON RUTA, Y NO LO TAPA LA TARJETA · gemelo G29, 28-sep-2026
//
//  El conductor (`MapaConductor`) y el pasajero (`MapaPasajero`) tenían cada uno su mapa con ruta, casi iguales. El
//  del conductor le pasaba a Google un margen que Google no entiende (`{ padding: 80 }`), y los DOS pintaban la ruta
//  con un `DirectionsRenderer` que re-encuadra la vista él solo, sin margen: el 📍 quedaba debajo de la tarjeta del
//  viaje en las dos apps (el robot lo midió en pruebas: y=692 con la tarjeta empezando en 566 y en 451).
//
//  Esta prueba CORRE, con un Google Maps de mentira, el mapa que usa cada una de las cuatro pantallas, con los datos
//  que cada pantalla le pasa tal como están escritos (scripts/medir-mapa-ruta.cjs), y exige:
//    · que haya UN solo componente con ruta;
//    · que en las cuatro el margen de abajo alcance para su tarjeta y que el encuadre sea nuestro, no de Google;
//    · y que lo que ya se veía bien siga igual: dónde se centra, qué ruta pide, de qué color, qué marcadores, si avisa
//      el tiempo y si el mapa sigue al carro. Eso se midió con el código de ANTES (a66120d) y se copia aquí.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const { medir } = require('../scripts/medir-mapa-ruta.cjs');

// Lo que cada pantalla hacía ANTES del arreglo, medido con `node scripts/medir-mapa-ruta.cjs --commit a66120d`.
const COMO_ERA = {
  'conductor · yendo a recoger': { centros: ['plaza', 'carro'], rutas: ['carro→recogida'], colores: ['#2ECC71'], marcadores: ['📍', '🚗'], avisaElTiempo: true, sigueAlCarro: true },
  'conductor · viaje en curso': { centros: ['plaza', 'carro'], rutas: ['carro→destino'], colores: ['#FF7A2F'], marcadores: ['📍', '🚗'], avisaElTiempo: true, sigueAlCarro: true },
  'pasajero · conductor en camino': { centros: ['recogida', 'recogida'], rutas: ['carro→recogida'], colores: ['#FF7A2F'], marcadores: ['📍', '🚗'], avisaElTiempo: false, sigueAlCarro: true },
  'pasajero · viaje en curso': { centros: ['destino', 'destino'], rutas: ['carro→destino'], colores: ['#FF7A2F'], marcadores: ['📍', '🚗'], avisaElTiempo: true, sigueAlCarro: true },
};

/** Las piezas de arriba de MapaConRuta.js (el margen), sacadas del archivo y corridas. */
function lasCuentasDelMargen() {
  const t = leer('guajirago/src/MapaConRuta.js');
  const ini = t.indexOf('export const MARGEN_DE_LA_RUTA');
  const fin = t.indexOf('export default function MapaConRuta');
  assert.ok(ini > 0 && fin > ini, 'no encuentro el margen de la ruta en MapaConRuta.js');
  // eslint-disable-next-line no-new-func
  return new Function(t.slice(ini, fin).replace(/^export\s+/gm, '') + '\nreturn { MARGEN_DE_LA_RUTA, margenDeLaRuta };')();
}

describe('EL MAPA CON RUTA · uno solo, y deja ver la tarjeta', () => {
  const hoy = medir();

  it('encuentra las cuatro pantallas y las corre (si no, la prueba no mira nada)', () => {
    assert.deepStrictEqual(hoy.pantallas.map((p) => p.pantalla), Object.keys(COMO_ERA));
    for (const p of hoy.pantallas) assert.ok(!p.falla, p.pantalla + ': ' + p.falla);
  });

  it('hay UN solo componente que dibuja una ruta, y las cuatro pantallas lo usan', () => {
    assert.deepStrictEqual(hoy.conRuta, ['MapaConRuta.js:MapaConRuta']);
    assert.deepStrictEqual([...new Set(hoy.pantallas.map((p) => p.vive + ':' + p.mapa))], ['MapaConRuta.js:MapaConRuta']);
  });

  it('en las cuatro, el encuadre es nuestro (no de Google) y el margen de abajo alcanza para su tarjeta', () => {
    for (const p of hoy.pantallas) {
      assert.strictEqual(p.loEncuadraGoogle, false, p.pantalla + ': la ruta la encuadra Google, sin margen');
      assert.ok(p.margen && p.margen.abajo >= p.altoTarjeta,
        p.pantalla + ': deja ' + (p.margen && p.margen.abajo) + ' px abajo y su tarjeta mide ' + p.altoTarjeta);
      assert.ok(p.margen.arriba >= 100, p.pantalla + ': arriba deja ' + p.margen.arriba + ' px y ahí va la barra');
    }
    assert.deepStrictEqual(hoy.fallos, []);
  });

  it('lo que ya se veía bien sigue igual: centro, ruta, color, marcadores, aviso del tiempo y seguir al carro', () => {
    for (const p of hoy.pantallas) {
      const { centros, rutas, colores, marcadores, avisaElTiempo, sigueAlCarro } = p;
      assert.deepStrictEqual({ centros, rutas, colores, marcadores, avisaElTiempo, sigueAlCarro }, COMO_ERA[p.pantalla], p.pantalla);
    }
  });

  it('el margen de abajo sale del alto de la tarjeta, con 380 si no la hay y sin comerse el mapa entero', () => {
    const { MARGEN_DE_LA_RUTA, margenDeLaRuta } = lasCuentasDelMargen();
    assert.deepStrictEqual(MARGEN_DE_LA_RUTA, { top: 120, bottom: 380, left: 60, right: 60 });
    assert.strictEqual(margenDeLaRuta(860, 294).bottom, 318);
    assert.strictEqual(margenDeLaRuta(860, 409).bottom, 433);
    assert.strictEqual(margenDeLaRuta(860, 0).bottom, 380);
    assert.strictEqual(margenDeLaRuta(860, undefined).bottom, 380);
    // Una tarjeta más alta que el mapa: se deja un hueco de 120 px para la ruta en vez de pedirle a Google lo imposible.
    assert.strictEqual(margenDeLaRuta(700, 900).bottom, 700 - 120 - 120);
  });

  it('con el código de ANTES el medidor sí ve el fallo (si no, sería un medidor ciego)', () => {
    const antes = medir('a66120d');
    assert.strictEqual(antes.conRuta.length, 2);
    assert.ok(antes.pantallas.every((p) => p.loEncuadraGoogle), 'antes la encuadraba Google en las cuatro');
    assert.strictEqual(antes.fallos.filter((f) => /tapa la ruta/.test(f)).length, 4);
  });
});
