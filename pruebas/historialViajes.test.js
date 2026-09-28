/**
 * EL HISTORIAL DE VIAJES, UNA SOLA PIEZA EN LAS TRES PANTALLAS — gemelo G21 (28-sep-2026)
 *
 * El historial está en tres pantallas: el del conductor (`AppConductor.js`, `HistorialConductor`, vigilado por el
 * amarre «EL HISTORIAL DEL CONDUCTOR» de `amarres.test.js`), el del pasajero (`Home.js`, `Historial`) y el del menú
 * de módulos (`MisViajes.js`). Qué viajes salen lo dice `ESTADOS_TERMINADOS`; cómo terminó cada uno —en palabras y
 * con su color— lo dice `comoTermino`. Las dos viven en `estadosViaje.js`.
 *
 * Hasta el 28-sep-2026 las dos del pasajero filtraban `finalizado || cancelado` y pintaban «Cancelado» / «Completado»
 * a mano: 40 viajes escondidos en Home y 72 en MisViajes (medido con `scripts/medir-historial-pasajero.cjs`).
 *
 * Esta prueba CORRE la pieza y CORRE los filtros sacados de las pantallas (con el lector del medidor, que se importa:
 * no se copia).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cargarDeLaApp } = require('./cargar.cjs');
const { PANTALLAS, loQueDejaPasar } = require('../scripts/medir-historial-pasajero.cjs');

const P = cargarDeLaApp('guajirago/src/estadosViaje.js');
const { ESTADOS_TERMINADOS, comoTermino, FINAL_EN_PALABRAS } = P;
const NO_COMPLETADOS = ESTADOS_TERMINADOS.filter((e) => e !== 'finalizado');

describe('G21 · cómo terminó un viaje sale de UNA pieza (comoTermino)', () => {
  it('EL QUE MUERDE · completado es UNO; los demás finales salen en rojo y en palabras', () => {
    for (const quien of ['pasajero', 'conductor']) {
      const bien = comoTermino({ estado: 'finalizado' }, quien);
      assert.deepStrictEqual(bien, { completado: true, texto: 'Completado', color: '#2ECC71' });
      const textos = new Set();
      for (const e of NO_COMPLETADOS) {
        const r = comoTermino({ estado: e }, quien);
        assert.strictEqual(r.completado, false, e + ' (' + quien + ') sale como completado');
        assert.notStrictEqual(r.color, bien.color, e + ' (' + quien + ') sale del color de un viaje hecho');
        assert.ok(r.texto && r.texto.trim(), e + ' (' + quien + ') no dice nada');
        assert.notStrictEqual(r.texto, e, e + ' (' + quien + ') sale con el nombre crudo del estado');
        assert.ok(!/Completado/.test(r.texto), e + ' (' + quien + ') dice «Completado»');
        textos.add(r.texto);
      }
      assert.strictEqual(textos.size, NO_COMPLETADOS.length,
        'dos finales distintos dicen lo mismo al ' + quien + ': no sabe cuál de las cosas pasó');
    }
  });

  it('EL QUE MUERDE · las palabras dependen de quién mira: quien cancela lee «Lo cancelaste tú»', () => {
    // `cancelado` lo escribe el pasajero (Solicitar.js) y `cancelado_conductor` el conductor (AppConductor.js).
    assert.strictEqual(comoTermino({ estado: 'cancelado' }, 'pasajero').texto, 'Lo cancelaste tú');
    assert.strictEqual(comoTermino({ estado: 'cancelado' }, 'conductor').texto, 'Lo canceló el cliente');
    assert.strictEqual(comoTermino({ estado: 'cancelado_conductor' }, 'conductor').texto, 'Lo cancelaste tú');
    assert.strictEqual(comoTermino({ estado: 'cancelado_conductor' }, 'pasajero').texto, 'Lo canceló el conductor');
  });

  it('un estado que no conoce sale en ROJO con su nombre, nunca verde; y sin viaje no revienta', () => {
    const raro = comoTermino({ estado: 'algo_nuevo' }, 'pasajero');
    assert.strictEqual(raro.completado, false);
    assert.strictEqual(raro.texto, 'algo_nuevo');
    assert.strictEqual(raro.color, '#FF4444');
    assert.strictEqual(comoTermino(null, 'conductor').completado, false);
  });

  it('las dos tablas de palabras tienen EXACTAMENTE los finales que no se completan', () => {
    for (const quien of Object.keys(FINAL_EN_PALABRAS)) {
      assert.deepStrictEqual(Object.keys(FINAL_EN_PALABRAS[quien]).sort(), [...NO_COMPLETADOS].sort(),
        'a la tabla del ' + quien + ' le sobra o le falta un final: si ESTADOS_TERMINADOS crece, aquí también');
    }
  });
});

describe('G21 · las dos pantallas del pasajero usan la pieza', () => {
  const ESPERA = {
    'guajirago/src/Home.js': "'pasajero'",
    'guajirago/src/MisViajes.js': "fuiConductor ? 'conductor' : 'pasajero'",
  };

  for (const p of PANTALLAS) {
    it('EL QUE MUERDE · ' + p.nombre + ': salen TODOS los terminados y ninguno en curso (corriendo su filtro)', () => {
      const r = loQueDejaPasar(p);
      assert.deepStrictEqual(r.quejas, [], p.archivo + ' no pasa:\n   · ' + r.quejas.join('\n   · '));
      assert.deepStrictEqual(r.entran, [...ESTADOS_TERMINADOS],
        'corriendo el filtro de ' + p.archivo + ', no entran todos los terminados: los que falten NO SALEN en el '
        + 'historial, sin error ni aviso.');
    });

    it('EL QUE MUERDE · ' + p.nombre + ': la tarjeta dice el final y su color con comoTermino', () => {
      const r = loQueDejaPasar(p);
      assert.strictEqual(r.usaLaPieza, ESPERA[p.archivo],
        p.archivo + ' no llama `comoTermino(v, ' + ESPERA[p.archivo] + ')` (llama: ' + r.usaLaPieza + ')');
      const t = r.cuerpo;
      assert.ok(/\{\s*fin\.texto\s*\}/.test(t), p.archivo + ': la tarjeta no enseña `{fin.texto}`');
      assert.ok(/color:\s*fin\.color\b/.test(t), p.archivo + ': el color del resultado no es `fin.color`');
      assert.ok(!/['"]Completado['"]/.test(t), p.archivo + ': vuelve a escribir «Completado» a mano');
      assert.ok(!/estado\s*===?\s*['"]cancelado['"]/.test(t),
        p.archivo + ': vuelve a decidir a mano con `estado === \'cancelado\'`');
    });

    it(p.nombre + ': cada consulta pide los ÚLTIMOS por fecha (orderBy fechaSolicitud desc)', () => {
      const r = loQueDejaPasar(p);
      const consultas = [...r.cuerpo.matchAll(/query\(collection\([^;]*?limit\(\s*\d+\s*\)\)/g)].map((m) => m[0]);
      assert.strictEqual(consultas.length, p.lados.length, p.archivo + ': esperaba ' + p.lados.length + ' consulta(s)');
      for (const q of consultas) {
        assert.ok(/orderBy\(\s*['"]fechaSolicitud['"]\s*,\s*['"]desc['"]\s*\)/.test(q),
          p.archivo + ': «' + q.slice(0, 90) + '…» no pide los últimos por fecha: con más de 50, el servidor elige');
      }
    });
  }

  it('el índice que piden (pasajeroId ASC + fechaSolicitud DESC) está declarado', () => {
    const dentro = JSON.parse(leer('firestore.indexes.json'));
    const hay = (campo) => (dentro.indexes || []).some((i) => {
      const f = (i.fields || []).filter((x) => x.fieldPath !== '__name__');
      return i.collectionGroup === 'viajes' && i.queryScope === 'COLLECTION' && f.length === 2
        && f[0].fieldPath === campo && f[0].order === 'ASCENDING'
        && f[1].fieldPath === 'fechaSolicitud' && f[1].order === 'DESCENDING';
    });
    assert.ok(hay('pasajeroId'), 'falta el índice viajes: pasajeroId ASC + fechaSolicitud DESC; sin él el '
      + 'historial del pasajero sale EN BLANCO');
    assert.ok(hay('conductorId'), 'falta el índice viajes: conductorId ASC + fechaSolicitud DESC');
  });

  it('las TRES pantallas importan comoTermino de ./estadosViaje', () => {
    for (const a of ['guajirago/src/Home.js', 'guajirago/src/MisViajes.js', 'guajirago/src/AppConductor.js']) {
      const imp = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/estadosViaje['"]/.exec(soloCodigo(leer(a)));
      assert.ok(imp && imp[1].split(',').map((s) => s.trim()).includes('comoTermino'),
        a + ' no importa `comoTermino` de ./estadosViaje');
    }
  });
});

// ── Y EL LECTOR NO SE PUEDE ABLANDAR ────────────────────────────────────────
//  Las pruebas de arriba se creen lo que diga `loQueDejaPasar`. Así que se le dan pantallas de mentira —cada forma
//  conocida de esconder viajes— y se exige que lo note.
describe('G21 · el lector del historial del pasajero ve los escapes', () => {
  for (const p of PANTALLAS) {
    it(p.nombre + ': cada pantalla de mentira se nota', () => {
      const bueno = leer(p.archivo).split('\r\n').join('\n');
      const FILTRO = '.filter(v => ESTADOS_TERMINADOS.includes(v.estado))';
      assert.ok(bueno.includes(FILTRO), p.archivo + ': ya no encuentro el filtro bueno; rehacer esta lista mirando '
        + 'el archivo');
      const ESCAPES = [
        ['la lista corta de siempre', FILTRO, ".filter(v => v.estado === 'finalizado' || v.estado === 'cancelado')"],
        ['un filtro de más detrás', FILTRO, FILTRO + "\n            .filter(v => v.estado !== 'expirado')"],
        ['una condición de más dentro', FILTRO, ".filter(v => v.estado !== 'vencido' && ESTADOS_TERMINADOS.includes(v.estado))"],
        ['el filtro al revés', FILTRO, '.filter(v => !ESTADOS_TERMINADOS.includes(v.estado))'],
        ['un .slice detrás', FILTRO, FILTRO + '\n            .slice(0, 5)'],
        ['sin filtro (entra el viaje en curso)', FILTRO, ''],
        ['setViajes dos veces', 'setCargando(false);', 'setViajes([]);\n      setCargando(false);'],
        ['la pantalla renombrada', p.ancla, p.ancla.replace('(', 'Viejo(')],
      ];
      for (const [nombre, de, a] of ESCAPES) {
        assert.ok(bueno.includes(de), 'el escape «' + nombre + '» no encuentra su sitio en ' + p.archivo);
        const r = loQueDejaPasar(p, bueno.replace(de, a));
        const seNota = r.quejas.length > 0 || !r.entran
          || JSON.stringify(r.entran) !== JSON.stringify(ESTADOS_TERMINADOS);
        assert.ok(seNota, '🔴 el lector NO ve el escape «' + nombre + '» en ' + p.archivo);
      }
    });
  }
});
