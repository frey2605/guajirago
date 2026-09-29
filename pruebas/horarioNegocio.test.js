/**
 * G46 · ¿ESTÁ ABIERTO AHORA? — UNA SOLA REGLA PARA RESTAURANTES Y AGENCIAS, EN HORA DE COLOMBIA (28-sep-2026)
 *
 * Antes la lista de restaurantes decía «abierto 24 horas» a un negocio que abre y cierra a la misma hora, y la de
 * agencias decía «cerrada» todo el día. Y las dos miraban la hora del teléfono.
 *
 *   1. La pieza (guajirago/src/horarioNegocio.js) se EJECUTA con los casos: misma hora = 24 horas, normal, cruza la
 *      medianoche, sin horario, pausado, horas guardadas como texto, en los bordes de cada hora.
 *   2. La hora es la de Colombia en CUALQUIER zona del teléfono, y sale de `hoyEnColombia` (no hay otra cuenta).
 *   3. Las dos pantallas se corren con el medidor (scripts/medir-horario-negocio.cjs), que saca de cada archivo la
 *      regla que usa: tienen que decir lo mismo a las 24 horas, con el teléfono en Colombia y en UTC.
 *   4. Nadie más en las tres apps decide con la hora de abrir o cerrar: solo la pieza la lee (los perfiles de aliados
 *      la escriben). Así el gemelo no vuelve a nacer.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const MEDIDOR = require('../scripts/medir-horario-negocio.cjs');

const PIEZA = 'guajirago/src/horarioNegocio.js';
const R = cargarDeLaApp(PIEZA);
const ZONAS = ['UTC', 'America/Bogota', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
const col = (s) => new Date(s + ':00-05:00');

function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

describe('G46 · la regla de «¿abierto ahora?»', () => {
  it('abrir y cerrar a la misma hora es abierto LAS 24 HORAS (también 0 y 0)', () => {
    for (const h of [0, 8, 23]) {
      for (let hora = 0; hora < 24; hora += 1) {
        const t = col('2026-10-07T' + String(hora).padStart(2, '0') + ':00');
        assert.strictEqual(R.negocioAbiertoAhora({ horarioApertura: h, horarioCierre: h }, t), true, h + ' y ' + h + ' a las ' + hora);
      }
    }
  });

  it('horario normal: de 8 a 22 abre a las 8:00 y cierra a las 22:00', () => {
    const n = { horarioApertura: 8, horarioCierre: 22 };
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T07:59')), false);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T08:00')), true);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T21:59')), true);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T22:00')), false);
  });

  it('cruza la medianoche: de 18 a 2 está abierto a las 23 y a la 1, cerrado a las 2 y a las 17', () => {
    const n = { horarioApertura: 18, horarioCierre: 2 };
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T17:59')), false);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T18:00')), true);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T23:30')), true);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-08T01:59')), true);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-08T02:00')), false);
  });

  it('sin horario (o con una hora que no es de 0 a 23) no se cierra; pausado a mano sí, a cualquier hora', () => {
    const t = col('2026-10-07T03:00');
    assert.strictEqual(R.negocioAbiertoAhora({}, t), true);
    assert.strictEqual(R.negocioAbiertoAhora({ horarioApertura: 8 }, t), true);
    assert.strictEqual(R.negocioAbiertoAhora({ horarioApertura: 'x', horarioCierre: 22 }, t), true);
    assert.strictEqual(R.negocioAbiertoAhora({ horarioApertura: 8, horarioCierre: 24 }, t), true);
    assert.strictEqual(R.negocioAbiertoAhora({ abierto: false }, t), false);
    assert.strictEqual(R.negocioAbiertoAhora({ abierto: false, horarioApertura: 0, horarioCierre: 0 }, t), false);
    assert.strictEqual(R.negocioAbiertoAhora(null, t), false);
  });

  it('una hora guardada como texto («8», «22») se lee como número', () => {
    const n = { horarioApertura: '8', horarioCierre: '22' };
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T03:00')), false);
    assert.strictEqual(R.negocioAbiertoAhora(n, col('2026-10-07T12:00')), true);
  });
});

describe('G46 · la hora es la de COLOMBIA, en cualquier zona del teléfono', () => {
  it('horaEnColombia da la hora de Colombia, cada media hora de tres días, en cuatro zonas', () => {
    for (const tz of ZONAS) {
      enZona(tz, () => {
        for (let t = Date.parse('2026-01-01T00:00:00Z'); t < Date.parse('2026-01-04T00:00:00Z'); t += 1800000) {
          const esperada = new Date(t - 5 * 3600000).getUTCHours();
          assert.strictEqual(R.horaEnColombia(new Date(t)), esperada, 'en ' + tz + ' a las ' + new Date(t).toISOString());
        }
      });
    }
  });

  it('la hora sale de hoyEnColombia (la pieza de las promociones), no de otra cuenta', () => {
    const src = leer(PIEZA).replace(/\r\n/g, '\n');
    assert.match(src, /^import \{ hoyEnColombia \} from '\.\/reglaPromocion';$/m, 'horarioNegocio.js no pide hoyEnColombia a reglaPromocion.js');
    const codigo = soloCodigo(src);
    assert.doesNotMatch(codigo, /getHours|getTimezoneOffset|toLocale/, 'la pieza mira la hora del teléfono');
  });
});

describe('G46 · las dos pantallas dicen lo mismo (corridas, no leídas)', () => {
  const reglas = {
    restaurante: MEDIDOR.reglaDe('guajirago/src/Restaurantes.js'),
    agencia: MEDIDOR.reglaDe('guajirago/src/Turismo.js'),
  };

  it('las dos usan la pieza única', () => {
    assert.match(reglas.restaurante.como, /pieza única/, 'Restaurantes.js usa ' + reglas.restaurante.como);
    assert.match(reglas.agencia.como, /pieza única/, 'Turismo.js usa ' + reglas.agencia.como);
  });

  it('a las 24 horas de Colombia coinciden, y la zona del teléfono no cambia nada', () => {
    for (const [nombre, n] of MEDIDOR.CASOS) {
      const r = MEDIDOR.careo(reglas, n);
      assert.strictEqual(r.distintas, 0, nombre + ': no coinciden en ' + r.distintas + ' h');
      assert.strictEqual(r.porZona, 0, nombre + ': cambian con la zona del teléfono');
    }
    const misma = MEDIDOR.careo(reglas, { horarioApertura: 0, horarioCierre: 0 });
    assert.strictEqual(misma.abiertasCol.agencia, 24, 'la agencia de 0 a 0 no sale abierta las 24 horas');
  });

  it('cada pantalla decide con la pieza en los sitios donde enseña «abierto» (lista y menú)', () => {
    const rest = soloCodigo(leer('guajirago/src/Restaurantes.js'));
    const tur = soloCodigo(leer('guajirago/src/Turismo.js'));
    assert.strictEqual((rest.match(/negocioAbiertoAhora\(/g) || []).length, 2, 'Restaurantes.js: la lista y el menú');
    assert.strictEqual((tur.match(/negocioAbiertoAhora\(/g) || []).length, 1, 'Turismo.js: la lista de agencias');
  });
});

describe('G46 · nadie más decide con la hora de abrir o cerrar', () => {
  // Los que ESCRIBEN el horario (los perfiles de aliados) sí lo nombran; los que lo LEEN para decidir, solo la pieza.
  const PERMITIDOS = new Set([
    PIEZA,
    'guajirago-aliados/src/PerfilRestaurante.js',
    'guajirago-aliados/src/PerfilAgencia.js',
  ]);
  const archivos = (dir) => {
    const fuera = [];
    const andar = (d) => {
      for (const e of fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true })) {
        const r = d + '/' + e.name;
        if (e.isDirectory()) andar(r);
        else if (/\.jsx?$/.test(e.name)) fuera.push(r);
      }
    };
    andar(dir);
    return fuera;
  };

  it('en las tres apps y en la nube, solo la pieza lee horarioApertura/horarioCierre', () => {
    const quien = [];
    for (const dir of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
      for (const f of archivos(dir)) {
        if (/horarioApertura|horarioCierre/.test(soloCodigo(leer(f))) && !PERMITIDOS.has(f)) quien.push(f);
      }
    }
    const nube = soloCodigo(leer('guajirago/functions/index.js'));
    if (/horarioApertura|horarioCierre/.test(nube)) quien.push('guajirago/functions/index.js');
    assert.deepStrictEqual(quien, [], 'deciden con el horario por su cuenta: ' + quien.join(', '));
  });
});
