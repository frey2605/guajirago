// ═══════════════════════════════════════════════════════════════════════════
//  «ME ACEPTARON EL VIAJE» EN LA APP DEL CONDUCTOR · gemelo G24, 28-sep-2026
//
//  `AppConductor.js` se entera de que el pasajero le aceptó la oferta por DOS vigilantes: el de la oferta
//  (`agregarViajeEscuchando`, vive 3 min) y el general (todos los viajes del conductor). Cada uno llevaba su regla y
//  su reacción: el general solo creía los viajes de menos de 10 min con el reloj del teléfono, y el servidor deja
//  aceptar hasta 20. Entre los 10 y los 20 no lo veía NINGUNO. Ahora los dos deciden con `meAceptaronEsteViaje`
//  (estadosViaje.js) y reaccionan con `alQueMeAceptaron`, la misma función.
//
//  Esta prueba CORRE los dos vigilantes sacados del archivo (con `scripts/medir-me-aceptaron.cjs`, el contador del
//  paso 1 y del 12), no busca palabras — salvo la última, que vigila que ninguno vuelva a decidir por su cuenta.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp } = require('./cargar.cjs');
const M = require('../scripts/medir-me-aceptaron.cjs');

const APP = 'guajirago/src/AppConductor.js';
const { meAceptaronEsteViaje } = cargarDeLaApp('guajirago/src/estadosViaje.js');

describe('G24 · la regla única: ¿me aceptaron este viaje?', () => {
  it('sí: aceptado, mío, y todavía no va en viaje (también en el punto, y sin mirar ninguna hora)', () => {
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'aceptado', conductorId: 'yo' }, 'yo'), true);
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'aceptado', conductorId: 'yo', fase: 'en_punto' }, 'yo'), true);
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'aceptado', conductorId: 'yo', fechaSolicitud: '2020-01-01T00:00:00Z' }, 'yo'), true);
  });
  it('no: de otro conductor, sin saber quién soy, buscando, terminado, ya en viaje, o sin viaje', () => {
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'aceptado', conductorId: 'otro' }, 'yo'), false);
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'aceptado', conductorId: undefined }, undefined), false);
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'esperando', conductorId: 'yo' }, 'yo'), false);
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'finalizado', conductorId: 'yo' }, 'yo'), false);
    assert.strictEqual(meAceptaronEsteViaje({ estado: 'aceptado', conductorId: 'yo', fase: 'en_viaje' }, 'yo'), false);
    assert.strictEqual(meAceptaronEsteViaje(null, 'yo'), false);
  });
});

describe('G24 · los dos vigilantes del conductor, corridos de verdad', () => {
  it('con el mismo documento en la mano, los dos deciden lo mismo', () => {
    const { documentos } = M.medirPantallas();
    assert.ok(documentos.length >= 10, 'el medidor corrió solo ' + documentos.length + ' casos');
    assert.deepStrictEqual(documentos.filter((f) => f.distinto).map((f) => f.nombre), []);
    // Y no deciden lo mismo por no decidir nada: el caso normal celebra en los dos.
    const normal = documentos.find((f) => f.nombre === 'aceptado hace 1 min');
    assert.ok(normal.deLaOferta && normal.general, 'el caso normal ya no celebra');
  });

  it('no hay ventana ciega: acepte cuando acepte el pasajero (mientras el servidor lo deja), alguno se entera', () => {
    const { horas } = M.medirPantallas();
    assert.ok(horas.length >= 15, 'el medidor corrió solo ' + horas.length + ' casos');
    assert.deepStrictEqual(horas.filter((f) => f.ciego).map((f) => f.nombre), [],
      'en estos momentos el pasajero acepta y la app del conductor no se entera');
    // El de la oferta sigue sirviendo para lo suyo: en los primeros minutos celebra él.
    assert.ok(horas.some((f) => f.ofertaViva && f.deLaOferta), 'el vigilante de la oferta ya no celebra nunca');
  });

  it('al volver a abrir la app con el viaje aceptado, el viaje vuelve', () => {
    const { reaperturas } = M.medirPantallas();
    assert.deepStrictEqual(reaperturas.filter((f) => f.noVuelve).map((f) => f.nombre), []);
  });

  it('si los dos se enteran, se celebra UNA vez (el segundo encuentra el candado)', () => {
    const { oferta, general, reaccion } = M.losCuerpos({});
    const m = M.ambitoDelConductor({ valor: 1 });
    const viaje = M.aceptadoA(1);
    M.correr(m.ambito, reaccion, oferta, ['idViaje', 'v1']);
    m.oyentes[0](M.unaFoto('v1', viaje));
    M.correr(m.ambito, reaccion, general, ['snap', { docs: [M.unaFoto('v1', viaje)] }]);
    const veces = m.llamadas.filter((l) => l[0] === 'setCelebrando' && l[1] === true).length;
    assert.strictEqual(veces, 1, 'se celebró ' + veces + ' veces');
  });

  it('los dos vigilantes solo LLAMAN a la regla y a la reacción: ninguno decide ni celebra por su cuenta', () => {
    const t = soloCodigo(leer(APP));
    const { oferta, general } = M.losCuerpos({});
    for (const [nombre, c] of [['el de la oferta', oferta], ['el general', general]]) {
      assert.strictEqual((c.match(/\bmeAceptaronEsteViaje\s*\(/g) || []).length, 1, nombre + ' no pregunta UNA vez a meAceptaronEsteViaje');
      assert.strictEqual((c.match(/\balQueMeAceptaron\s*\(/g) || []).length, 1, nombre + ' no llama UNA vez a alQueMeAceptaron');
      // (`nuevaOferta` no entra: el de la oferta la mira, con razón, para soltar el viaje cuando el pasajero la sube.)
      assert.doesNotMatch(c, /setCelebrando|iniciarFase1|Date\.now|fechaSolicitud|60\s*\*\s*1000/,
        nombre + ' reacciona o mira la hora por su cuenta: eso vive en alQueMeAceptaron y meAceptaronEsteViaje');
    }
    assert.strictEqual((t.match(/const\s+alQueMeAceptaron\s*=/g) || []).length, 1, 'alQueMeAceptaron está definida más de una vez');
    // Fuera de la reacción, nadie más arranca la celebración.
    const i = t.indexOf('const alQueMeAceptaron = useCallback((data) => {');
    const r = cuerpoDeLaFuncion(t, i);
    assert.ok(i >= 0 && r, 'no encuentro alQueMeAceptaron en ' + APP);
    const fuera = t.slice(0, i) + t.slice(r.fin);
    assert.doesNotMatch(fuera, /setCelebrando\(\s*true\s*\)/, 'hay otro sitio que arranca la celebración');
  });

  it('el medidor no se puede ablandar: si el general deja de reaccionar, ve la ventana ciega', () => {
    const t = leer(APP);
    const bueno = 'if (d) alQueMeAceptaron({ id: d.id, ...d.data() });';
    assert.strictEqual(t.split(bueno).length, 2, 'el sabotaje no calza UNA vez');
    const { horas, reaperturas } = M.medirPantallas({ [APP]: t.replace(bueno, '') });
    assert.ok(horas.some((f) => f.ciego), 'sin el general el medidor sigue sin ver la ventana ciega');
    assert.ok(reaperturas.some((f) => f.noVuelve), 'sin el general el medidor sigue diciendo que el viaje vuelve');
  });
});
