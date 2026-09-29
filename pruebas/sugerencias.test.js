/**
 * EL CUADRO DE SUGERENCIAS DE DIRECCIONES — PRUEBAS (gemelo G61, 29-sep-2026)
 *
 * El cuadro de Google que sugiere direcciones se armaba a mano en cinco sitios de dos
 * apps, y el marco de La Guajira estaba escrito con números tres veces. Ahora sale de
 * `sugerenciasDeDirecciones.js` (con copia byte a byte en aliados) y los marcos viven en
 * `riohacha.js` (con copia de los dos marcos en aliados). Esta prueba:
 *   1. CORRE la pieza con un Google de mentira y exige las opciones de cada uso, con sus
 *      diferencias a propósito (taxi y favoritos: solo Riohacha; domicilios y negocios:
 *      preferencia de La Guajira);
 *   2. ata las copias de aliados;
 *   3. corre, con el medidor, el efecto de CADA uno de los cinco sitios sacado del archivo
 *      y exige lo que hacía antes de G61, y que nadie vuelva a armar el cuadro a mano;
 *   4. le da al medidor el código de ANTES y exige que lo vea (que no se pueda ablandar).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp } = require('./cargar.cjs');
const { medir, lector } = require('../scripts/medir-sugerencias.cjs');

const APP = 'guajirago/src/sugerenciasDeDirecciones.js';
const COPIA = 'guajirago-aliados/src/sugerenciasDeDirecciones.js';
const pieza = cargarDeLaApp(APP);
const geo = cargarDeLaApp('guajirago/src/riohacha.js');
const geoAliados = cargarDeLaApp('guajirago-aliados/src/riohacha.js');

const RIOHACHA = { south: 11.3, west: -73, north: 11.7, east: -72.6 };
const LA_GUAJIRA = { south: 10.9, west: -73.4, north: 12.5, east: -71.1 };

// Lo que cada sitio le pedía a Google ANTES de G61 (medido corriendo el código de 40db86e / ef77969).
const OPCIONES = {
  viaje: { componentRestrictions: { country: 'co' }, bounds: RIOHACHA, strictBounds: true, types: ['establishment', 'geocode'], fields: ['geometry', 'name', 'formatted_address'] },
  favorito: { componentRestrictions: { country: 'co' }, bounds: RIOHACHA, strictBounds: true, types: ['establishment', 'geocode'] },
  entrega: { componentRestrictions: { country: 'co' }, bounds: LA_GUAJIRA, fields: ['formatted_address'] },
  negocio: { componentRestrictions: { country: 'co' }, bounds: LA_GUAJIRA, fields: ['formatted_address', 'geometry'] },
};
const DIRECCION = '"Cra. 7 #10-20, Riohacha, La Guajira, Colombia"';
const PUNTO = '{"lat":11.5501,"lng":-72.9012}';
const SITIOS = [
  ['app · pedir el viaje', 'viaje', ['texto del campo ← "Cra. 7 # 10-20"', 'punto del mapa ← ' + PUNTO]],
  ['app · lugar favorito', 'favorito', ['dirección ← "Cra. 7 # 10-20"']],
  ['app · dirección de entrega', 'entrega', ['dirección ← ' + DIRECCION]],
  ['aliados · perfil del restaurante', 'negocio', ['dirección ← ' + DIRECCION, 'ubicación ← ' + PUNTO]],
  ['aliados · perfil de la agencia', 'negocio', ['dirección ← ' + DIRECCION, 'ubicación ← ' + PUNTO]],
];

function mapsDeMentira() {
  function LatLng(la, ln) { this.la = la; this.ln = ln; }
  function LatLngBounds(sw, ne) { this.toJSON = () => ({ south: sw.la, west: sw.ln, north: ne.la, east: ne.ln }); }
  return { LatLng, LatLngBounds };
}
const plano = (o) => JSON.parse(JSON.stringify(o));

describe('G61 · la pieza arma el cuadro de cada uso, con sus diferencias a propósito', () => {
  for (const [uso, esperado] of Object.entries(OPCIONES)) {
    it(uso + ': ' + (esperado.strictBounds ? 'solo dentro de Riohacha' : 'preferencia de La Guajira'), () => {
      assert.deepStrictEqual(plano(pieza.opcionesDeSugerencias(mapsDeMentira(), uso)), esperado);
    });
  }

  it('ponerSugerencias crea UN cuadro en el campo que se le da, con esas opciones', () => {
    const creados = [];
    const maps = mapsDeMentira();
    maps.places = { Autocomplete: function Autocomplete(input, op) { creados.push([input, plano(op)]); } };
    const campo = { soy: 'el campo' };
    pieza.ponerSugerencias({ maps }, campo, 'entrega');
    assert.deepStrictEqual(creados, [[campo, OPCIONES.entrega]]);
  });

  it('un uso que no existe revienta en vez de armar un cuadro sin marco', () => {
    assert.throws(() => pieza.opcionesDeSugerencias(mapsDeMentira(), 'pasajero'), /no conozco el uso/);
  });

  it('los marcos: La Guajira contiene a Riohacha y al centro', () => {
    const r = geo.BOUNDS_RIOHACHA;
    const g = geo.BOUNDS_LA_GUAJIRA;
    assert.ok(g.north > g.south && g.east > g.west, 'el marco de La Guajira está al revés');
    assert.ok(g.south <= r.south && r.north <= g.north && g.west <= r.west && r.east <= g.east, 'Riohacha quedó fuera de La Guajira');
    const c = geo.centroRiohacha;
    assert.ok(g.south < c.lat && c.lat < g.north && g.west < c.lng && c.lng < g.east, 'el centro quedó fuera de La Guajira');
  });
});

describe('G61 · las copias de aliados siguen atadas', () => {
  it(COPIA + ' es byte a byte ' + APP, () => {
    assert.strictEqual(leer(COPIA), leer(APP),
      COPIA + ' se separó de ' + APP + ': se cambia allá primero y se copia IGUAL (son repos aparte y no pueden importar)');
  });

  it('guajirago-aliados/src/riohacha.js lleva SOLO los dos marcos, con los valores de la app', () => {
    assert.deepStrictEqual(Object.keys(geoAliados).sort(), ['BOUNDS_LA_GUAJIRA', 'BOUNDS_RIOHACHA']);
    for (const k of Object.keys(geoAliados)) {
      assert.deepStrictEqual(geoAliados[k], geo[k], k + ' de aliados se separó del de guajirago/src/riohacha.js');
    }
  });
});

describe('G61 · los cinco sitios, corridos: hacen lo mismo que antes y ninguno arma el cuadro a mano', () => {
  const hoy = medir(lector());

  it('nadie arma el cuadro, ni el marco, ni escribe esquinas con números, fuera de la pieza y de riohacha.js', () => {
    const c = hoy.copias;
    assert.deepStrictEqual(c.cuadros, [], 'cuadros armados a mano: ' + JSON.stringify(c.cuadros));
    assert.deepStrictEqual(c.marcos, [], 'marcos armados a mano: ' + JSON.stringify(c.marcos));
    assert.deepStrictEqual(c.esquinas, [], 'esquinas escritas con números: ' + JSON.stringify(c.esquinas));
    assert.deepStrictEqual(c.setBounds, [], 'setBounds que repiten el marco: ' + JSON.stringify(c.setBounds));
  });

  SITIOS.forEach(([nombre, uso, queda], i) => {
    it(nombre + ' (uso «' + uso + '»)', () => {
      const s = hoy.sitios[i];
      assert.ok(!s.hace.falla, s.nombre + ': ' + s.hace.falla);
      assert.strictEqual(s.hace.cuadros, 1, 'cuadros creados');
      assert.deepStrictEqual(s.hace.opciones, OPCIONES[uso], 'las opciones que se le dan a Google');
      assert.deepStrictEqual(s.hace.marco, OPCIONES[uso].bounds, 'el marco con que queda');
      assert.deepStrictEqual(s.hace.oyentes, ['place_changed']);
      assert.deepStrictEqual(s.hace.queda, queda, 'lo que le queda a la pantalla al escoger');
    });
  });
});

describe('G61 · y el medidor no se puede ablandar', () => {
  // Con el código de ANTES tiene que ver las cinco copias y el mismo comportamiento.
  let hayHistoria = true;
  try {
    execFileSync('git', ['cat-file', '-e', '40db86e^{commit}'], { cwd: RAIZ, stdio: 'ignore' });
    execFileSync('git', ['cat-file', '-e', 'ef77969^{commit}'], { cwd: path.join(RAIZ, 'guajirago-aliados'), stdio: 'ignore' });
  } catch (e) { hayHistoria = false; }

  it('con el código de antes de G61 cuenta 5 cuadros, 5 marcos, 6 esquinas y 3 setBounds, y los mismos cinco comportamientos', { skip: !hayHistoria && 'sin la historia de git de los dos repos' }, () => {
    const antes = medir(lector('40db86e', 'ef77969'));
    const total = (l) => l.reduce((a, [, n]) => a + n, 0);
    assert.deepStrictEqual(
      [total(antes.copias.cuadros), total(antes.copias.marcos), total(antes.copias.esquinas), total(antes.copias.setBounds)],
      [5, 5, 6, 3]);
    SITIOS.forEach(([, uso, queda], i) => {
      const s = antes.sitios[i].hace;
      assert.ok(!s.falla, s.falla);
      assert.deepStrictEqual([s.opciones, s.marco, s.queda], [OPCIONES[uso], OPCIONES[uso].bounds, queda]);
    });
  });
});
