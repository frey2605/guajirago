/**
 * G86 · «POR PERSONA / POR GRUPO / POR DÍA / POR HORA» DEL TOUR SALE DE UNA PIEZA (30-sep-2026)
 *
 * La unidad del precio de un tour la dicen tres sitios: la tarjeta del tour en la app del cliente
 * (guajirago/src/Turismo.js), y la lista y el selector de la pantalla «Tours» de la agencia (guajirago-aliados/src/Tours.js).
 * Estaba escrita a mano DOS veces (un diccionario en Turismo.js y la lista UNIDADES en Tours.js). Ahora vive en
 * guajirago/src/unidadesTour.js, con una copia IDÉNTICA en guajirago-aliados/src/unidadesTour.js (otro repo, no puede
 * importarla).
 *
 *   1. Las dos copias son IGUALES y la pieza se EJECUTA: da los valores que se guardan en `unidadPrecio`.
 *   2. Cada sitio se lee de su archivo y se CORRE lo que de verdad usa (scripts/medir-unidades-tour.cjs): los tres
 *      dicen lo mismo en todos los casos, y nadie en las tres apps escribe la lista a mano.
 *   3. CAREO con el código de antes (703a088 / 6bbe95d / 0f89437): ningún sitio dice algo distinto.
 *   4. La cuenta del precio que depende de la unidad vive solo en la app (no es gemelo); si aparece otra, se nota.
 *   5. El contador de lo guardado separa lo que tiene nombre de lo que ninguna pantalla sabe nombrar.
 *   6. Pantallas de mentira: si la copia se separa, o alguien vuelve a escribir la lista a mano, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp } = require('./cargar.cjs');
const { medir, carear, contarGuardados, ANTES, PIEZA_APP, PIEZA_ALIADOS, TURISMO, TOURS, CASOS } = require('../scripts/medir-unidades-tour.cjs');

// Los valores que se GUARDAN en `unidadPrecio` (tours de los negocios y reservasTurismo): cambiarlos deja sin nombre a
// los tours ya creados. Medido en producción el 30-sep-2026: 0 tours y 0 reservas, así que hoy nadie se queda sin nombre.
const GUARDADOS = ['persona', 'grupo', 'dia', 'hora'];
const DICHOS = ['por persona', 'por grupo', 'por día', 'por hora'];
const SITIOS = ['APP · la tarjeta del tour', 'ALIADOS · la lista de tours', 'ALIADOS · el selector'];

describe('G86 · la unidad del precio del tour sale de UNA pieza', () => {
  it('las dos copias de la pieza son IDÉNTICAS (app y aliados)', () => {
    assert.strictEqual(leer(PIEZA_ALIADOS).replace(/\r\n/g, '\n'), leer(PIEZA_APP).replace(/\r\n/g, '\n'), 'la copia de aliados se separó de ' + PIEZA_APP);
  });

  it('la pieza, ejecutada, da los valores guardados y cómo se dicen (en la app y en aliados)', () => {
    for (const ruta of [PIEZA_APP, PIEZA_ALIADOS]) {
      const p = cargarDeLaApp(ruta);
      assert.deepStrictEqual(p.UNIDADES_PRECIO.map((u) => u.k), GUARDADOS, ruta);
      assert.deepStrictEqual(p.UNIDADES_PRECIO.map((u) => u.t), DICHOS, ruta);
      assert.deepStrictEqual(GUARDADOS.map((k) => p.unidadTxt(k)), DICHOS, ruta);
      for (const raro of [undefined, null, '', 'día', 'Persona', 'noche', 'toString']) assert.strictEqual(p.unidadTxt(raro), '', ruta + ' nombra «' + raro + '»');
    }
  });

  it('los tres sitios usan la pieza, corridos dicen lo MISMO, y nadie escribe la lista a mano', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(m.aMano.map((l) => l.archivo + ':' + l.renglon), [], 'unidades del tour escritas a mano (usa unidadesTour.js)');
    assert.ok(m.copiasIguales, 'las dos copias de la pieza no son iguales');
    assert.deepStrictEqual(Object.keys(m.sitios), SITIOS);
    assert.strictEqual(m.sitios[SITIOS[0]].origen, PIEZA_APP);
    assert.strictEqual(m.sitios[SITIOS[1]].origen, PIEZA_ALIADOS);
    assert.deepStrictEqual(m.sitios[SITIOS[2]].opciones, GUARDADOS.map((k, i) => k + '=' + DICHOS[i]), 'el selector ofrece otra cosa');
    assert.deepStrictEqual(m.distintos.map((x) => x.caso), [], 'los sitios dicen cosas distintas');
    for (const s of SITIOS) assert.deepStrictEqual(m.sitios[s].dice.slice(0, 4), DICHOS, s);
    assert.strictEqual(m.porCaso.length, CASOS.length);
  });

  it('CAREO · con el código de antes (' + Object.values(ANTES).join(' / ') + ') ningún sitio dice algo distinto', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.deepStrictEqual(antes.aMano.map((l) => l.archivo), [TURISMO, TOURS], 'el medidor ya no ve las dos listas a mano de antes');
    assert.ok(!antes.copiasIguales, 'antes no había pieza');
    assert.deepStrictEqual(Object.values(antes.sitios).map((s) => s.origen), ['a mano', 'a mano', 'a mano']);
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparaciones, CASOS.length * 3);
    assert.deepStrictEqual(c.diferencias, [], 'un sitio dice otra cosa que antes');
  });

  it('la CUENTA del precio que depende de la unidad vive solo en la app (Turismo.js): no hay otra que atar', () => {
    const m = medir(null);
    assert.ok(m.cuentas.length >= 1, 'el medidor no ve la cuenta de totalReserva');
    assert.deepStrictEqual(m.cuentas.filter((c) => !c.startsWith(TURISMO + ':')), [], 'otra pantalla decide con la unidad: hay que atarla');
    assert.deepStrictEqual(m.nombranUnidad.sort(), [TURISMO, TOURS].sort(), 'otro archivo nombra la unidad del tour: míralo');
  });

  it('lo guardado: lo que tiene nombre y lo que ninguna pantalla sabe nombrar se cuentan aparte', () => {
    const p = cargarDeLaApp(PIEZA_APP);
    const r = contarGuardados(
      [{ tours: [{ unidadPrecio: 'persona' }, { unidadPrecio: 'dia', tipo: 'alquiler' }, {}] }, { tours: [] }, {}],
      [{ unidadPrecio: 'persona', estado: 'nueva' }, { unidadPrecio: 'noche', estado: 'nueva' }],
      p.unidadTxt,
    );
    assert.strictEqual(r.agencias, 1);
    assert.deepStrictEqual(r.sinNombre.map((f) => f.donde + ' ' + f.valor).sort(), ['reserva noche', 'tour (sin campo)']);
    const fila = r.filas.find((f) => f.donde === 'tour' && f.valor === 'dia');
    assert.strictEqual(fila.dice, 'por día');
    assert.deepStrictEqual(fila.extra, { alquiler: 1 });
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    const HORA = "  { k: 'hora', t: 'por hora' },\n";

    it('si la copia de aliados se separa, se nota', () => {
      const t = leer(PIEZA_ALIADOS).replace(/\r\n/g, '\n');
      const rota = t.replace(HORA, HORA + "  { k: 'noche', t: 'por noche' },\n");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PIEZA_ALIADOS]: rota });
      assert.ok(!m.copiasIguales, 'la copia separada sigue saliendo igual');
      assert.deepStrictEqual(m.distintos.map((x) => x.caso), ['noche'], 'la app y aliados dicen distinto y el medidor no lo ve');
    });

    it('si la app vuelve a su diccionario propio, se nota (aunque diga lo mismo)', () => {
      const t = leer(TURISMO);
      const rota = t.replace("import { unidadTxt } from './unidadesTour';",
        "const unidadTxt = (k) => ({ persona: 'por persona', grupo: 'por grupo', dia: 'por día', hora: 'por hora' }[k] || '');");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [TURISMO]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [TURISMO]);
      assert.strictEqual(m.sitios[SITIOS[0]].origen, 'a mano');
    });

    it('si aliados vuelve a escribir la lista a mano para el selector, se nota', () => {
      const t = leer(TOURS);
      const rota = t.replace("import { UNIDADES_PRECIO, unidadTxt } from './unidadesTour';",
        "import { unidadTxt } from './unidadesTour';\nconst UNIDADES_PRECIO = [{ k: 'persona', t: 'por persona' }, { k: 'grupo', t: 'por grupo' }];");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [TOURS]: rota });
      assert.deepStrictEqual(m.aMano.map((l) => l.archivo), [TOURS]);
      assert.deepStrictEqual(m.sitios[SITIOS[2]].opciones, ['persona=por persona', 'grupo=por grupo']);
      assert.deepStrictEqual(m.distintos.map((x) => x.caso), ['dia', 'hora']);
    });

    it('si aliados dice la unidad con un unidadTxt propio y distinto, se nota', () => {
      const t = leer(TOURS);
      const rota = t.replace("import { UNIDADES_PRECIO, unidadTxt } from './unidadesTour';",
        "import { UNIDADES_PRECIO } from './unidadesTour';\nconst unidadTxt = (k) => (k ? 'x ' + k : '');");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [TOURS]: rota });
      assert.ok(m.distintos.length > 0, 'un unidadTxt propio en aliados no se nota');
      assert.strictEqual(m.sitios[SITIOS[1]].dice[0], 'x persona');
    });

    it('si un sitio importa de la pieza algo que no está, se nota', () => {
      const t = leer(PIEZA_APP);
      const rota = t.replace('export function unidadTxt(k)', 'export function unidadTexto(k)');
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PIEZA_APP]: rota });
      assert.ok(m.problemas.some((p) => /Turismo\.js: importa unidadTxt/.test(p)), m.problemas.join(' · '));
    });

    it('si otra pantalla hace su propia cuenta con la unidad, se nota', () => {
      const t = leer(TOURS);
      const rota = t.replace('const soloNumeros = (v) =>', "const porPersona = (x) => x.unidadPrecio === 'persona';\n  const soloNumeros = (v) =>");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [TOURS]: rota });
      assert.ok(m.cuentas.some((c) => c.startsWith(TOURS + ':')), 'la cuenta nueva en aliados no se ve');
    });
  });
});
