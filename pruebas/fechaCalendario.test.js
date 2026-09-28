/**
 * G11 · LA AGENCIA VE EL MISMO DÍA QUE RESERVÓ EL CLIENTE (28-sep-2026)
 *
 * La reserva de turismo guarda `fecha` como la da el calendario: «2026-10-05», un DÍA sin
 * hora. La app del cliente lo leía como hora local; aliados hacía `new Date('2026-10-05')`,
 * que es medianoche UTC = las 7 de la noche del domingo 4 en Colombia. El cliente reservaba
 * el lunes 5 y la agencia veía «dom, 4 de oct».
 *
 * Ahora hay UNA pieza, `fechaDeCalendario` en guajirago/src/fechaCalendario.js, con copia
 * idéntica en aliados (otro repo: no puede importarla).
 *
 *   1. La pieza se EJECUTA (la de la app y la de aliados) en varias zonas horarias.
 *   2. Las dos copias son iguales byte a byte.
 *   3. Las DOS pantallas se ejecutan: se saca de cada archivo la función que pinta
 *      `r.fecha` —con el MISMO lector que usa scripts/medir-fecha-reserva.cjs, no una
 *      copia— y se corre con los 365 días de 2026 en hora de Colombia.
 *   4. En las tres apps, ningún archivo que lea `reservasTurismo` pinta una `.fecha` sin
 *      pasar por la pieza.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp } = require('./cargar.cjs');
const { elPintorDe, diaDelTexto, PANTALLAS } = require('../scripts/medir-fecha-reserva.cjs');

const APP = 'guajirago/src/fechaCalendario.js';
const ALIADOS = 'guajirago-aliados/src/fechaCalendario.js';
const LARGO = { weekday: 'long', day: 'numeric', month: 'long' };

// Cambia la zona horaria de este proceso mientras corre `fn` (node --test corre cada archivo aparte).
function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

// Lee el disco como lo haría el medidor, pero sin commit.
const delDisco = (ruta) => leer(ruta);

describe('G11 · la fecha de calendario se pinta con UNA pieza', () => {
  for (const ruta of [APP, ALIADOS]) {
    it('la pieza da el día guardado en cualquier zona horaria (' + ruta.split('/')[0] + ')', () => {
      const { fechaDeCalendario } = cargarDeLaApp(ruta);
      for (const tz of ['America/Bogota', 'UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
        enZona(tz, () => {
          // Que la zona SE APLICÓ: en Colombia la lectura a pelo cae el domingo 4. Si no, la prueba no mira nada.
          if (tz === 'America/Bogota') assert.strictEqual(new Date('2026-10-05').getDate(), 4, 'la zona de Colombia no se aplicó');
          assert.strictEqual(fechaDeCalendario('2026-10-05', LARGO), 'lunes, 5 de octubre', 'en ' + tz);
          assert.strictEqual(fechaDeCalendario('2026-01-01', LARGO), 'jueves, 1 de enero', 'en ' + tz);
          assert.strictEqual(fechaDeCalendario('2026-12-31', LARGO), 'jueves, 31 de diciembre', 'en ' + tz);
        });
      }
      // Lo que no es un día se enseña tal cual, nunca «Invalid Date» ni otro día.
      assert.strictEqual(fechaDeCalendario('', LARGO), '');
      assert.strictEqual(fechaDeCalendario(undefined, LARGO), '');
      assert.strictEqual(fechaDeCalendario('mañana', LARGO), 'mañana');
      assert.strictEqual(fechaDeCalendario('2026-02-31', LARGO), '2026-02-31');
    });
  }

  it('la copia de aliados es la de la app, byte a byte', () => {
    assert.strictEqual(leer(ALIADOS), leer(APP),
      'se separaron: se cambian LOS DOS (guajirago/src y guajirago-aliados/src fechaCalendario.js)');
  });

  it('en Colombia, el cliente y la agencia ven el día que se guardó, los 365 días de 2026', () => {
    enZona('America/Bogota', () => {
      const cliente = elPintorDe(PANTALLAS.cliente, null, delDisco);
      const agencia = elPintorDe(PANTALLAS.agencia, null, delDisco);
      const malos = [];
      for (let d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
        const guardado = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const c = cliente.pinta(guardado);
        const a = agencia.pinta(guardado);
        // El mismo día del mes, y el mismo día de la semana (el cliente lo escribe largo, la agencia corto).
        const semana = (t) => String(t).split(',')[0].replace('.', '').slice(0, 3).toLowerCase();
        if (diaDelTexto(c) !== d.getDate() || diaDelTexto(a) !== d.getDate() || semana(c) !== semana(a)) {
          malos.push(guardado + ' → cliente «' + c + '» · agencia «' + a + '»');
        }
      }
      assert.deepStrictEqual(malos.slice(0, 5), [], malos.length + ' días se ven distintos');
      assert.strictEqual(cliente.pinta('2026-10-05'), 'lunes, 5 de octubre');
      assert.match(agencia.pinta('2026-10-05'), /^lun.*5.*oct/);
    });
  });

  it('las dos pantallas piden la pieza y no leen el día a mano', () => {
    for (const ruta of Object.values(PANTALLAS)) {
      const fuente = leer(ruta);
      assert.match(fuente, /import\s*\{\s*fechaDeCalendario\s*\}\s*from\s*'\.\/fechaCalendario'/, ruta + ' no importa la pieza');
    }
  });

  it('en las tres apps, quien lee reservasTurismo pinta la .fecha con la pieza', () => {
    const archivos = [];
    for (const carpeta of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
      for (const f of fs.readdirSync(path.join(RAIZ, carpeta))) {
        if (f.endsWith('.js') && !f.endsWith('.test.js')) archivos.push(carpeta + '/' + f);
      }
    }
    const lectores = archivos.filter((r) => /reservasTurismo/.test(leer(r)));
    // Hoy son tres: el cliente, el panel (que enseña la fecha tal cual, sin new Date) y la agencia.
    assert.deepStrictEqual(lectores.sort(), [
      'guajirago-admin/src/Turismo.js', 'guajirago-aliados/src/ReservasTurismo.js', 'guajirago/src/Turismo.js',
    ], 'cambió quién lee las reservas: mira si el nuevo pinta la fecha y súmalo aquí');
    for (const ruta of lectores) {
      const fuente = leer(ruta).replace(/\r\n/g, '\n');
      assert.doesNotMatch(fuente, /new Date\(\s*[A-Za-z0-9_]+\.fecha\b/, ruta + ' lee una .fecha con new Date a pelo');
      for (const [, nombre] of fuente.matchAll(/([A-Za-z0-9_]+)\(\s*[A-Za-z0-9_]+\.fecha\s*\)/g)) {
        const def = new RegExp('const ' + nombre + ' = (.*);').exec(fuente);
        assert.ok(def, ruta + ': ' + nombre + ' pinta una .fecha y no encuentro su definición');
        assert.match(def[1], /fechaDeCalendario\(/, ruta + ': ' + nombre + ' pinta una .fecha sin la pieza');
        assert.doesNotMatch(def[1], /new Date/, ruta + ': ' + nombre + ' arma el día a mano');
      }
    }
  });
});
