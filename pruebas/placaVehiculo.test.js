/**
 * G45 · ¿ESTA PLACA Y ESTE VEHÍCULO SIRVEN? (28-sep-2026)
 *
 * El registro del conductor (App.js) validaba la placa (6 caracteres) y armaba el vehículo «Marca Año» con dos
 * listas; la edición del panel (Conductores.js, `guardarEdicion`) guardaba lo que se escribiera. Ahora hay UNA
 * regla, guajirago/src/vehiculoConductor.js, con copia idéntica en el panel.
 *
 *   1. La regla se EJECUTA (la de la app y la del panel) con placas y vehículos de mentira.
 *   2. La copia del panel es byte a byte la de la app.
 *   3. EL QUE MUERDE · `guardarEdicion` del panel se SACA del archivo y se CORRE: una placa o un vehículo que no
 *      sirven NO se guardan y sale la ventanita; los buenos se guardan en la forma limpia (y el vehículo con su
 *      marca y su modelo).
 *   4. El trozo de la placa del registro (App.js) se saca y se corre: deja pasar lo mismo que la regla y guarda
 *      la forma limpia.
 *   5. En las tres apps, `placa:` solo se escribe en los sitios contados, y el vehículo «Marca Año» solo lo
 *      arma la regla: una pantalla nueva que guarde una placa tiene que pasar por aquí.
 *
 * El recorrido del medidor (sacar y correr) vive UNA vez, en scripts/medir-placa-vehiculo.cjs: aquí se importa.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const { correrEdicionDelPanel, correrPlacaDelRegistro, PLACAS } = require('../scripts/medir-placa-vehiculo.cjs');

const APP = 'guajirago/src/vehiculoConductor.js';
const PANEL = 'guajirago-admin/src/vehiculoConductor.js';

const piezasDelPanel = () => ({
  ...cargarDeLaApp('guajirago-admin/src/telefonoValido.js'),
  ...cargarDeLaApp('guajirago-admin/src/telefonoUsuario.js'),
  ...cargarDeLaApp(PANEL),
});

describe('G45 · ¿esta placa y este vehículo sirven?', () => {
  for (const ruta of [APP, PANEL]) {
    it('la regla decide bien (' + ruta.split('/')[0] + ')', () => {
      const R = cargarDeLaApp(ruta);
      // Lo que el registro ya aceptaba: 6 letras o números (taxi ABC123, moto ABC12D, y otras que hay guardadas).
      assert.strictEqual(R.placaLimpia('ABC123'), 'ABC123');
      assert.strictEqual(R.placaLimpia('ABC12D'), 'ABC12D');
      assert.strictEqual(R.placaLimpia('ABCDEF'), 'ABCDEF', 'hay placas guardadas así: no se hace más estricta sin medir');
      assert.strictEqual(R.placaLimpia('abc123'), 'ABC123', 'se guarda en mayúsculas');
      assert.strictEqual(R.placaLimpia(' abc-123 '), 'ABC123', 'los separadores se quitan');
      assert.strictEqual(R.placaLimpia('ABC 12 3'), 'ABC123');
      assert.strictEqual(R.placaLimpia('ABC.123'), 'ABC123');
      for (const mala of ['AB 12', 'ABC12', 'ABC1234', 'ABC1234567', 'AB#123', 'ÁBC123', '', null, undefined]) {
        assert.strictEqual(R.placaLimpia(mala), '', JSON.stringify(mala) + ' no es una placa');
        assert.strictEqual(R.placaSirve(mala), false);
      }
      assert.strictEqual(R.placaSirve('ABC123'), true);
      assert.strictEqual(R.placaMientrasEscribe('abc-123'), 'ABC123', 'escribiendo «ABC-123» cabe entero');
      assert.strictEqual(R.placaMientrasEscribe('abc1234'), 'ABC123');
      assert.strictEqual(R.vehiculoDe('Chevrolet', '2015'), 'Chevrolet 2015');
      assert.strictEqual(R.vehiculoDe(' Mazda ', 2020), 'Mazda 2020');
      assert.deepStrictEqual(R.datosDelVehiculo('  chevrolet   spark  2015 ', 2026),
        { vehiculo: 'chevrolet spark 2015', marca: 'chevrolet spark', modelo: '2015' });
      assert.deepStrictEqual(R.datosDelVehiculo('Kia 1990', 2026), { vehiculo: 'Kia 1990', marca: 'Kia', modelo: '1990' });
      assert.deepStrictEqual(R.datosDelVehiculo('Kia 2026', 2026), { vehiculo: 'Kia 2026', marca: 'Kia', modelo: '2026' });
      for (const malo of ['Kia 1989', 'Kia 2027', 'Kia', '2015', 'hola', 'Kia 15', '', null]) {
        assert.strictEqual(R.datosDelVehiculo(malo, 2026), null, JSON.stringify(malo) + ' no es «Marca Año»');
        assert.strictEqual(R.vehiculoSirve(malo, 2026), false);
      }
      // Sin año dado, usa el de hoy: el año en curso sirve, el siguiente no (como la lista del registro).
      const hoy = new Date().getFullYear();
      assert.ok(R.vehiculoSirve('Kia ' + hoy));
      assert.ok(!R.vehiculoSirve('Kia ' + (hoy + 1)));
    });
  }

  it('la copia del panel es idéntica a la de la app', () => {
    assert.strictEqual(leer(PANEL), leer(APP), PANEL + ' se separó de ' + APP + ': copia la de la app tal cual.');
  });

  it('EL QUE MUERDE · el panel no guarda una placa que no sirve (guardarEdicion, corrido)', async () => {
    const fuente = leer('guajirago-admin/src/Conductores.js');
    const pz = piezasDelPanel();
    for (const mala of ['AB 12', 'ABC1234567', 'AB#123', '']) {
      const r = await correrEdicionDelPanel(fuente, pz, { placa: mala });
      assert.strictEqual(r.guardo, null, '⛔ el panel guardó la placa ' + JSON.stringify(mala));
      assert.ok(r.aviso && /placa/i.test(r.aviso.titulo + r.aviso.texto), 'sin ventanita que diga qué pasa con ' + JSON.stringify(mala));
    }
    const buena = await correrEdicionDelPanel(fuente, pz, { placa: 'abc-123' });
    assert.deepStrictEqual(buena.guardo, { placa: 'ABC123' }, 'se guarda en la forma del registro');
    assert.strictEqual(buena.aviso, null);
    const moto = await correrEdicionDelPanel(fuente, pz, { placa: 'abc12d' });
    assert.deepStrictEqual(moto.guardo, { placa: 'ABC12D' }, 'la placa de mototaxi sirve');
  });

  it('EL QUE MUERDE · el panel no guarda un vehículo que no sirve, y el bueno va con su marca y su modelo (corrido)', async () => {
    const fuente = leer('guajirago-admin/src/Conductores.js');
    const pz = piezasDelPanel();
    for (const malo of ['hola', 'Chevrolet', 'Chevrolet 1985', '']) {
      const r = await correrEdicionDelPanel(fuente, pz, { vehiculo: malo });
      assert.strictEqual(r.guardo, null, '⛔ el panel guardó el vehículo ' + JSON.stringify(malo));
      assert.ok(r.aviso && /veh[ií]culo/i.test(r.aviso.titulo + r.aviso.texto));
    }
    const bueno = await correrEdicionDelPanel(fuente, pz, { vehiculo: '  Renault   2019 ' });
    assert.deepStrictEqual(bueno.guardo, { vehiculo: 'Renault 2019', marca: 'Renault', modelo: '2019' });
  });

  it('el panel sigue guardando lo demás como antes, y la placa junto al teléfono (corrido)', async () => {
    const fuente = leer('guajirago-admin/src/Conductores.js');
    const pz = piezasDelPanel();
    assert.deepStrictEqual((await correrEdicionDelPanel(fuente, pz, { nombre: 'PEDRO' })).guardo, { nombre: 'PEDRO' });
    assert.deepStrictEqual((await correrEdicionDelPanel(fuente, pz, { telefono: '300 123 4567', placa: 'xyz789', vehiculo: 'Kia 2020' })).guardo,
      { telefono: '3001234567', placa: 'XYZ789', vehiculo: 'Kia 2020', marca: 'Kia', modelo: '2020' });
    const telMalo = await correrEdicionDelPanel(fuente, pz, { telefono: '1', placa: 'ABC123' });
    assert.strictEqual(telMalo.guardo, null, 'si el teléfono no sirve, no se guarda nada');
  });

  it('el registro del conductor decide la placa con la regla y guarda su forma limpia (App.js, corrido)', () => {
    const fuente = leer('guajirago/src/App.js');
    const R = cargarDeLaApp(APP);
    for (const p of [...PLACAS, 'abc123', 'ABC.123']) {
      const r = correrPlacaDelRegistro(fuente, R, p);
      assert.strictEqual(r.pasa, R.placaSirve(p), 'App.js deja pasar ' + JSON.stringify(p) + ' distinto de la regla');
      if (r.pasa) assert.strictEqual(r.guarda, R.placaLimpia(p), 'App.js guarda ' + JSON.stringify(r.guarda) + ' en vez de la forma limpia');
    }
  });

  it('App.js arma el vehículo, la casilla y lo que le pasa a la app con la regla', () => {
    const t = soloCodigo(leer('guajirago/src/App.js'));
    assert.match(t, /const vehiculo = vehiculoDe\(marcaFinal, modelo\);/, 'el vehículo del registro sale de vehiculoDe');
    assert.match(t, /onChange=\{e => setPlaca\(placaMientrasEscribe\(e\.target\.value\)\)\}/, 'la casilla de la placa usa placaMientrasEscribe');
    assert.match(t, /onGuardar\(placaLimpia\(placa\), vehiculo,/, 'la app sigue con la placa limpia, la misma que guardó');
  });

  // ── Nadie vuelve a escribir la placa o el vehículo a su manera ─────────────────────────────────────────────
  const archivosDe = (carpeta) => fs.readdirSync(path.join(RAIZ, carpeta))
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
    .map((f) => carpeta + '/' + f);
  const TODOS = [
    ...archivosDe('guajirago/src'), ...archivosDe('guajirago-admin/src'), ...archivosDe('guajirago-aliados/src'),
    'guajirago/functions/index.js',
  ];
  // Dónde aparece hoy `placa:` y por qué está bien.
  const ESCRIBEN_PLACA = {
    'guajirago/src/App.js': 4, // datosDeLaFicha (lee la ficha), el registro (placaLimpia), y dos copias locales del teléfono
    'guajirago/src/AppConductor.js': 1, // la hoja del GPS: copia la placa ya guardada
    'guajirago/src/Login.js': 1, // la cuenta nueva nace con placa ''
    'guajirago-admin/src/Conductores.js': 1, // la casilla de edición; al guardar pasa por guardarEdicion (placaLimpia)
    'guajirago-admin/src/Mensajeria.js': 1, // un conteo en pantalla, con la placa del mandado
  };

  it('`placa:` solo aparece en los sitios contados de las tres apps', () => {
    const hay = {};
    for (const f of TODOS) {
      const n = (soloCodigo(leer(f)).match(/\bplaca\s*:/g) || []).length;
      if (n) hay[f] = n;
    }
    assert.deepStrictEqual(hay, ESCRIBEN_PLACA, 'apareció o cambió un sitio que escribe `placa:`: si guarda la placa de un conductor, que pase por vehiculoConductor.js, y cuéntalo aquí');
  });

  it('el vehículo «Marca Año» solo lo arma la regla', () => {
    for (const f of TODOS) {
      if (f.endsWith('/vehiculoConductor.js')) continue;
      assert.doesNotMatch(soloCodigo(leer(f)), /\$\{[^}]*marca[^}]*\}\s*\$\{[^}]*modelo[^}]*\}/i, f + ' arma «Marca Año» a mano: usa vehiculoDe');
    }
  });
});
