/**
 * G88 · «MIS PEDIDOS» Y «MIS RESERVAS» LOS RECUERDA EN EL TELÉFONO UNA SOLA PIEZA (30-sep-2026)
 *
 * La app del cliente apunta en el teléfono (localStorage) los ids de lo que pidió (Restaurantes.js, clave
 * `misPedidosGuajira`) y de lo que reservó (Turismo.js, clave `misReservasGuajira`). Cada pantalla lo hacía a su manera:
 * el pedido con tope de 40 y el repetido al frente; la reserva sin tope y el repetido en su sitio; y si lo guardado no
 * era una lista de ids, «Mis pedidos» se caía (`ids.length` de null) y «Mis reservas» se quedaba cargando. Ahora lo hace
 * guajirago/src/recordadosEnTelefono.js; cada pantalla solo dice su lista (clave y tope, con nombre en la pieza).
 *
 *   1. La pieza se EJECUTA contra un teléfono de mentira, y las claves son las que YA están en los teléfonos.
 *   2. Cada pantalla se saca de su archivo y se CORRE (scripts/medir-recordados-telefono.cjs) en 15 casos.
 *   3. CAREO con el código de antes (c7db2a2): solo cambian los casos rotos y el repetido de la reserva, a propósito.
 *   4. El contador de la nube (cuántos pedidos y reservas llevan la firma del cliente).
 *   5. Pantallas de mentira: si alguien vuelve a leer a mano, cambia una clave o ablanda la pieza, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const { medir, carear, contarFirmas, ANTES, PIEZA, SITIOS, CASOS, PENDIENTES } = require('../scripts/medir-recordados-telefono.cjs');

const PEDIDOS = 'APP · Mis pedidos';
const RESERVAS = 'APP · Mis reservas';
const RESTAURANTES = SITIOS[PEDIDOS].archivo;
const TURISMO = SITIOS[RESERVAS].archivo;

/** Carga la pieza con un teléfono de mentira en lugar del localStorage del navegador. */
function piezaCon(telefono, texto = leer(PIEZA)) {
  const nombres = [...texto.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', texto.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')(telefono);
}
function telefono(inicial = {}) {
  const datos = new Map(Object.entries(inicial));
  return { datos, getItem: (k) => (datos.has(k) ? datos.get(k) : null), setItem: (k, v) => datos.set(k, String(v)) };
}

// Lo que cada pantalla LEE al final de cada caso (el mismo orden de CASOS). Los de 45 van por su largo y sus puntas.
const LEE = {
  'teléfono vacío': '[]',
  'guarda a, luego b': '["b","a"]',
  'ya tenía x, y (forma vieja)': '["x","y"]',
  'ya tenía x, y y guarda z': '["z","x","y"]',
  'repetido: a, b, a': '["a","b"]',
  'guardado roto (no es JSON)': '[]',
  'roto y guarda a': '["a"]',
  'guardado «null»': '[]',
  'guardado un objeto': '[]',
  'objeto y guarda a': '["a"]',
  'guardado un texto': '[]',
  'lista con basura': '["x"]',
  'teléfono que no deja guardar': '[]',
};
// Lo que el careo PUEDE cambiar respecto a antes (y nada más): los guardados que no son una lista de ids, y el repetido
// de la reserva (antes se quedaba en su sitio; ahora sube al frente, como el pedido — un id de addDoc no se repite).
const CAMBIAN = [
  [PEDIDOS, 'guardado «null»'], [PEDIDOS, 'guardado un objeto'], [PEDIDOS, 'objeto y guarda a'],
  [PEDIDOS, 'guardado un texto'], [PEDIDOS, 'lista con basura'],
  [RESERVAS, 'repetido: a, b, a'], [RESERVAS, 'guardado un objeto'], [RESERVAS, 'objeto y guarda a'],
  [RESERVAS, 'guardado un texto'], [RESERVAS, 'lista con basura'],
].map((x) => x.join(' · '));

describe('G88 · lo que el teléfono recuerda sale de UNA pieza', () => {
  it('la pieza, ejecutada: claves de siempre, tope 40 solo en pedidos, el último al frente y lo roto no revienta', () => {
    const tel = telefono({ misReservasGuajira: '["r1","r2"]', misPedidosGuajira: '{"x":1}' });
    const p = piezaCon(tel);
    // Las claves son las que YA tienen guardadas los teléfonos: cambiarlas deja a cada cliente sin su historial.
    assert.deepStrictEqual(p.MIS_PEDIDOS, { clave: 'misPedidosGuajira', tope: 40 });
    assert.deepStrictEqual(p.MIS_RESERVAS, { clave: 'misReservasGuajira', tope: null });
    assert.deepStrictEqual(p.leerRecordados(p.MIS_RESERVAS), ['r1', 'r2'], 'no lee la forma que ya está guardada');
    p.recordar(p.MIS_RESERVAS, 'r3');
    assert.strictEqual(tel.datos.get('misReservasGuajira'), '["r3","r1","r2"]');
    assert.deepStrictEqual(p.leerRecordados(p.MIS_PEDIDOS), [], 'un guardado que no es lista tiene que dar lista vacía');
    for (let i = 1; i <= 42; i++) p.recordar(p.MIS_PEDIDOS, 'p' + i);
    const ids = p.leerRecordados(p.MIS_PEDIDOS);
    assert.strictEqual(ids.length, 40, 'el tope de «Mis pedidos» es 40');
    assert.deepStrictEqual([ids[0], ids[39]], ['p42', 'p3']);
    p.recordar(p.MIS_PEDIDOS, 'p10');
    assert.deepStrictEqual(p.leerRecordados(p.MIS_PEDIDOS).slice(0, 2), ['p10', 'p42'], 'un repetido sube al frente, sin duplicarse');
    assert.strictEqual(p.leerRecordados(p.MIS_PEDIDOS).filter((x) => x === 'p10').length, 1);
    // Un teléfono que no deja leer ni guardar (modo privado): ni revienta ni inventa.
    const cerrado = piezaCon({ getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } });
    assert.deepStrictEqual(cerrado.leerRecordados(cerrado.MIS_PEDIDOS), []);
    assert.doesNotThrow(() => cerrado.recordar(cerrado.MIS_PEDIDOS, 'a'));
  });

  it('las dos pantallas usan la pieza y, corridas, leen y guardan lo esperado en los 15 casos', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(m.aMano.map((l) => l.archivo), PENDIENTES, 'listas del teléfono leídas a mano: ' + JSON.stringify(m.aMano));
    assert.deepStrictEqual(Object.keys(m.sitios), [PEDIDOS, RESERVAS]);
    for (const [n, s] of Object.entries(m.sitios)) {
      assert.strictEqual(s.origen, PIEZA, n);
      CASOS.forEach((c, i) => {
        const r = s.resultados[i];
        assert.ok(r.sirve, n + ' · ' + c.nombre + ': lee ' + r.leido);
        assert.deepStrictEqual(r.fallos, [], n + ' · ' + c.nombre);
        if (c.nombre in LEE) assert.strictEqual(r.leido, LEE[c.nombre], n + ' · ' + c.nombre);
      });
    }
    // Más de 40: el pedido se queda con los 40 últimos; la reserva, sin tope (como antes: no se borra nada guardado).
    const largo = (n, caso) => JSON.parse(m.sitios[n].resultados[CASOS.findIndex((c) => c.nombre === caso)].leido);
    assert.strictEqual(largo(PEDIDOS, 'guarda 45 seguidos').length, 40);
    assert.deepStrictEqual(largo(PEDIDOS, 'guarda 45 seguidos').slice(0, 1), ['p45']);
    assert.strictEqual(largo(RESERVAS, 'guarda 45 seguidos').length, 45);
    assert.strictEqual(largo(PEDIDOS, 'ya tenía 45 y guarda uno').length, 40);
    assert.strictEqual(largo(RESERVAS, 'ya tenía 45 y guarda uno').length, 46);
    for (const n of [PEDIDOS, RESERVAS]) assert.strictEqual(largo(n, 'ya tenía 45 y guarda uno')[0], 'nuevo');
    // Leer NO escribe: lo guardado roto se queda como estaba mientras no se guarde nada nuevo.
    const roto = m.sitios[PEDIDOS].resultados[CASOS.findIndex((c) => c.nombre === 'lista con basura')];
    assert.strictEqual(roto.quedo, '[1,"x",null,"",{}]');
  });

  it('CAREO · con el código de antes (' + Object.values(ANTES).join(' / ') + ') solo cambian los casos rotos y el repetido de la reserva', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.ok(!antes.pieza, 'antes no había pieza');
    assert.deepStrictEqual([...new Set(antes.aMano.map((l) => l.archivo))].sort(), [...PENDIENTES, RESTAURANTES, TURISMO].sort());
    assert.deepStrictEqual(Object.values(antes.sitios).map((s) => s.origen), ['a mano', 'a mano']);
    assert.strictEqual(antes.sitios[PEDIDOS].resultados.filter((r) => !r.sirve).length, 5, 'antes «Mis pedidos» daba 5 listas que no servían');
    assert.strictEqual(antes.sitios[RESERVAS].resultados.filter((r) => !r.sirve).length, 4, 'antes «Mis reservas» daba 4');
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparaciones, CASOS.length * 2);
    assert.deepStrictEqual(c.diferencias.map((d) => d.sitio + ' · ' + d.caso), CAMBIAN);
  });

  it('la nube: cuenta cuántos pedidos o reservas llevan la firma del cliente', () => {
    const r = contarFirmas([{ clienteId: 'u1' }, { clienteId: 'u1' }, { clienteId: 'u2' }, { clienteId: null }, {}, { clienteId: '' }]);
    assert.deepStrictEqual(r, { total: 6, conFirma: 3, sinFirma: 3, clientes: 2 });
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    it('si «Mis pedidos» vuelve a leer a mano, se nota', () => {
      const t = leer(RESTAURANTES);
      const rota = t.replace('const ids = leerRecordados(MIS_PEDIDOS);', "const ids = JSON.parse(localStorage.getItem('misPedidosGuajira') || '[]');");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [RESTAURANTES]: rota });
      assert.ok(m.aMano.some((l) => l.archivo === RESTAURANTES), 'la lectura a mano no se ve');
      assert.ok(m.sitios[PEDIDOS].resultados.some((r) => !r.sirve), 'lo roto vuelve a romper y no se ve');
    });

    it('si «Mis reservas» guarda con otra clave, se nota', () => {
      const t = leer(TURISMO);
      const rota = t.replace('recordar(MIS_RESERVAS, ref.id);', "recordar({ clave: 'misReservas', tope: null }, ref.id);");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [TURISMO]: rota });
      const i = CASOS.findIndex((c) => c.nombre === 'guarda a, luego b');
      assert.notStrictEqual(m.sitios[RESERVAS].resultados[i].leido, LEE['guarda a, luego b'], 'guardar en otra clave no se ve');
    });

    it('si «Mis reservas» lee la lista de los pedidos, se nota', () => {
      const t = leer(TURISMO);
      const rota = t.replace('const ids = leerRecordados(MIS_RESERVAS);', 'const ids = leerRecordados(MIS_PEDIDOS);')
        .replace("import { MIS_RESERVAS, leerRecordados, recordar } from './recordadosEnTelefono';", "import { MIS_RESERVAS, MIS_PEDIDOS, leerRecordados, recordar } from './recordadosEnTelefono';");
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [TURISMO]: rota });
      const i = CASOS.findIndex((c) => c.nombre === 'ya tenía x, y (forma vieja)');
      assert.strictEqual(m.sitios[RESERVAS].resultados[i].leido, '[]', 'leer la lista equivocada no se ve');
    });

    it('si la pieza deja de filtrar lo que no es un id, se nota', () => {
      const t = leer(PIEZA);
      const rota = t.replace(".filter((id) => typeof id === 'string' && id.length > 0)", '');
      assert.notStrictEqual(rota, t);
      const m = medir(null, { [PIEZA]: rota });
      assert.ok(Object.values(m.sitios).every((s) => s.resultados.some((r) => !r.sirve)), 'la basura en la lista no se ve');
    });

    it('si otra pantalla lee una lista del teléfono a mano, se nota', () => {
      const ruta = 'guajirago/src/MisViajes.js';
      const rota = leer(ruta) + "\nconst misCosas = () => { try { return JSON.parse(localStorage.getItem('misCosas')) || []; } catch (e) { return []; } };\n";
      const m = medir(null, { [ruta]: rota });
      assert.ok(m.aMano.some((l) => l.archivo === ruta), 'una lista nueva a mano no se ve');
    });
  });
});
