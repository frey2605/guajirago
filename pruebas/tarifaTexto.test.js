// ═══════════════════════════════════════════════════════════════════════════
//  EL TEXTO DEL PRECIO DEL VIAJE NO DEPENDE DEL IDIOMA DEL TELÉFONO · gemelo G13, 28-sep-2026
//
//  El viaje guarda el precio como NÚMERO (`tarifaValor`) y como TEXTO (`tarifa`); la oferta del conductor igual
//  (`montoValor` / `monto`). El texto lo armaban cuatro sitios con `toLocaleString()` SIN idioma, o sea con el del
//  teléfono. Medido en producción el 28-sep-2026 (scripts/medir-tarifa-texto.cjs): de 92 viajes, 33 dicen «$10.000»,
//  30 «$10,000» (teléfonos en inglés) y 29 «$5000» (sin agrupar). Ahora los cuatro sitios escriben con `cop()`:
//  guajirago/src/moneda.js en la app y su copia guajirago/functions/moneda.cjs en el servidor, atadas aquí.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, leer, soloCodigo, cuerpoDeLaFuncion } = require('./cargar.cjs');

const APP = cargarDeLaApp('guajirago/src/moneda.js');
const NUBE = require('../guajirago/functions/moneda.cjs');
const { armarViajeNuevo } = cargarDeLaApp('guajirago/src/viajeNuevo.js');
const MEDIDOR = require('../scripts/medir-tarifa-texto.cjs');

// El cuerpo de UNA función, buscada por el renglón que la abre (tiene que estar UNA vez).
function cuerpoDe(archivo, marca) {
  const codigo = leer(archivo);
  const i = codigo.indexOf(marca);
  assert.ok(i >= 0 && codigo.indexOf(marca, i + 1) < 0, archivo + ': esperaba UNA vez «' + marca + '»');
  const c = cuerpoDeLaFuncion(codigo, i);
  assert.ok(c, archivo + ': no encuentro el cuerpo de «' + marca + '»');
  return soloCodigo(c.texto);
}

const NUMEROS = [0, 1, 800, 999, 1000, 4600, 5000, 9999, 10000, 15000, 125500, 1000000, null, undefined];

// Un teléfono con otro idioma: `toLocaleString()` sin idioma usa el del aparato. Aquí se le cambia a propósito.
function conTelefonoEn(idioma, fn) {
  const original = Number.prototype.toLocaleString;
  // eslint-disable-next-line no-extend-native
  Number.prototype.toLocaleString = function (loc, op) { return original.call(this, loc || idioma, op); };
  try { return fn(); } finally {
    // eslint-disable-next-line no-extend-native
    Number.prototype.toLocaleString = original;
  }
}

const PEDIDO = {
  user: { uid: 'p1', email: 'p@x.co' }, nombrePasajero: 'Ana', coords: { lat: 11.54, lng: -72.9 },
  tipo: 'Taxi', origen: 'A', destino: 'B', tarifa: 5000, datosDescuento: null, radioBusqueda: 3,
};

describe('G13 · el formateador del servidor es COPIA EXACTA del de la app', () => {
  it('cop() escribe idéntico en la app y en el servidor, número por número', () => {
    for (const n of NUMEROS) {
      assert.strictEqual(NUBE.cop(n), APP.cop(n), 'con ' + String(n) + ' la app escribe «' + APP.cop(n) + '» y el servidor «' + NUBE.cop(n) + '»');
    }
    assert.strictEqual(APP.cop(10000), '$ 10.000');
  });
});

describe('G13 · el viaje nace con el MISMO texto en cualquier teléfono', () => {
  it('un teléfono en inglés, uno en España y uno en Colombia guardan lo mismo', () => {
    const textos = ['en-US', 'es-ES', 'es-CO', 'de-CH'].map((idioma) => conTelefonoEn(idioma, () => armarViajeNuevo(PEDIDO).tarifa));
    for (const t of textos) assert.strictEqual(t, '$ 5.000', 'un teléfono guardó «' + t + '»: el texto depende del idioma del aparato');
  });

  it('y el texto dice el mismo número que tarifaValor', () => {
    for (const n of [800, 5000, 10000, 125500]) {
      const v = conTelefonoEn('en-US', () => armarViajeNuevo({ ...PEDIDO, tarifa: n }));
      assert.strictEqual(MEDIDOR.numeroDel(v.tarifa), v.tarifaValor);
    }
  });
});

describe('G13 · nadie vuelve a escribir el precio a mano', () => {
  // Los que ESCRIBEN el texto del precio. Lo que pintan las pantallas es G14 y no se mira aquí.
  const ESCRITORES = [
    ['guajirago/src/viajeNuevo.js', 'export function armarViajeNuevo(', /\btarifa:\s*cop\(tarifa\)/],
    ['guajirago/src/Solicitar.js', 'const enviarNuevaOferta = ', /\btarifa:\s*cop\(nuevaTarifa\)/],
    ['guajirago/src/AppConductor.js', 'const aceptarOEnviar = ', /\bmonto:\s*cop\(monto\)/],
  ];
  for (const [archivo, funcion, patron] of ESCRITORES) {
    it(archivo + ' (' + funcion + ') escribe con cop()', () => {
      const cuerpo = cuerpoDe(archivo, funcion);
      assert.match(cuerpo, patron, funcion + ' ya no escribe el precio con cop()');
    });
  }

  it('el servidor (confirmarConductor) arma el texto desde el NÚMERO aceptado, no copia el del teléfono', () => {
    const cuerpo = cuerpoDe('guajirago/functions/index.js', 'exports.confirmarConductor = ');
    const lineas = cuerpo.split('\n').filter((l) => /^\s*tarifa:/.test(l));
    assert.strictEqual(lineas.length, 1, 'esperaba UNA escritura de tarifa en confirmarConductor y hay ' + lineas.length);
    assert.match(lineas[0], /cop\(tarifaValorAceptada\)/, 'confirmarConductor ya no arma el texto con cop(tarifaValorAceptada)');
    assert.match(leer('guajirago/functions/index.js'), /const \{ cop \} = require\('\.\/moneda\.cjs'\);/);
  });

  it('en ninguna de las tres apps ni en el servidor se escribe tarifa/monto con toLocaleString o «$» a mano', () => {
    const archivos = ['guajirago/src/viajeNuevo.js', 'guajirago/src/Solicitar.js', 'guajirago/src/AppConductor.js', 'guajirago/functions/index.js'];
    const malos = [];
    for (const a of archivos) {
      soloCodigo(leer(a)).split('\n').forEach((l, i) => {
        if (/\b(tarifa|monto)\s*:\s*(`\$|'\$|"\$|[^,}]*toLocaleString)/.test(l)) malos.push(a + ':' + (i + 1) + '  ' + l.trim());
      });
    }
    assert.deepStrictEqual(malos, [], 'volvió el precio armado a mano:\n' + malos.join('\n'));
  });
});

describe('G13 · el medidor sabe distinguir las formas', () => {
  it('formaDe y numeroDel con casos de mentira', () => {
    assert.strictEqual(MEDIDOR.formaDe('$10.000'), 'español «$10.000»');
    assert.strictEqual(MEDIDOR.formaDe('$10,000'), 'inglés «$10,000»');
    assert.strictEqual(MEDIDOR.formaDe('$5000'), 'sin agrupar «$5000»');
    assert.strictEqual(MEDIDOR.formaDe('$ 10.000'), 'cop() «$ 10.000»');
    assert.strictEqual(MEDIDOR.formaDe(undefined), 'vacío');
    for (const t of ['$10.000', '$10,000', '$10000', '$ 10.000']) assert.strictEqual(MEDIDOR.numeroDel(t), 10000);
    const c = MEDIDOR.contar([{ id: 'a', texto: '$10,000', valor: 10000 }, { id: 'b', texto: '$9.000', valor: 10000 }]);
    assert.strictEqual(c.noCuadran, 1);
  });
});
