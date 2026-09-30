/**
 * G83 · EL PROMEDIO DE ESTRELLAS DEL RESTAURANTE SALE DE UNA PIEZA (29-sep-2026)
 *
 * El promedio se enseña en tres sitios: la lista de restaurantes y el menú (guajirago/src/Restaurantes.js) y la
 * pantalla «Calificaciones» de aliados. Antes cada uno filtraba a su manera: la lista contaba solo las de clientes,
 * el menú y aliados contaban también las que le ponen al DUEÑO como persona en un viaje (el id del negocio es su uid).
 * Ahora los tres usan estrellasNegocio.js, con una copia IDÉNTICA en aliados (otro repo).
 *
 *   1. Las dos copias de la pieza son iguales byte a byte, y la pieza se EJECUTA.
 *   2. Los tres sitios se SACAN de su archivo y se CORREN (scripts/medir-promedio-restaurante.cjs): con cada caso
 *      de mentira, el cliente (lista y menú) y el restaurante (aliados) ven el MISMO número.
 *   3. CAREO con el código de antes (5fbff29 / 9c4f892): cambia SOLO donde se decidió.
 *   4. Nadie más en la app ni en aliados suma estrellas a mano.
 *   5. Pantallas de mentira: si un sitio vuelve a su filtro propio, o las copias se separan, se pone roja.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo, copiaIdentica } = require('./cargar.cjs');
const { medir, verCasos, carear, CASOS, ANTES, PIEZA_APP, PIEZA_ALIADOS, RESTAURANTES, ALIADOS, SIN } = require('../scripts/medir-promedio-restaurante.cjs');

describe('G83 · el promedio de estrellas del restaurante sale de UNA pieza', () => {
  it('las dos copias de la pieza son IDÉNTICAS (app y aliados)', () => {
    copiaIdentica(PIEZA_ALIADOS, PIEZA_APP, 'la copia de aliados se separó de ' + PIEZA_APP);
  });

  it('la pieza cuenta solo las de clientes, del negocio, sin reportar y con 1 a 5 estrellas', () => {
    const p = cargarDeLaApp(PIEZA_APP);
    const cli = (estrellas, mas = {}) => ({ quienCalifica: 'cliente', calificadoId: 'N1', estrellas, ...mas });
    assert.deepStrictEqual(p.promedioDelNegocio([cli(5), cli(3)], 'N1'), { promedio: 4, total: 2 });
    assert.deepStrictEqual(p.promedioDelNegocio([], 'N1'), { promedio: 0, total: 0 });
    assert.deepStrictEqual(p.promedioDelNegocio(undefined, 'N1'), { promedio: 0, total: 0 });
    assert.strictEqual(p.cuentaParaElPromedio({ quienCalifica: 'pasajero', calificadoId: 'N1', estrellas: 1 }, 'N1'), false, 'una de taxi al dueño no es del restaurante');
    assert.strictEqual(p.cuentaParaElPromedio({ quienCalifica: 'conductor', calificadoId: 'N1', estrellas: 1 }, 'N1'), false);
    assert.strictEqual(p.cuentaParaElPromedio(cli(5, { reportado: true }), 'N1'), false, 'una reportada no cuenta');
    assert.strictEqual(p.cuentaParaElPromedio(cli(5), 'N2'), false, 'la de otro negocio no cuenta');
    for (const e of [0, 6, 4.5, '5', null, undefined, NaN]) assert.strictEqual(p.cuentaParaElPromedio(cli(e), 'N1'), false, 'estrellas ' + e + ' no cuenta');
    for (const e of [1, 2, 3, 4, 5]) assert.strictEqual(p.cuentaParaElPromedio(cli(e), 'N1'), true);
    assert.strictEqual(p.calificaAlNegocio(cli(5, { reportado: true }), 'N1'), true, 'reportada sigue siendo del negocio (aliados la enseña marcada)');
    assert.deepStrictEqual(p.promediosPorNegocio([cli(5), cli(2, { calificadoId: 'N2' }), cli(4), { quienCalifica: 'pasajero', calificadoId: 'U9', estrellas: 3 }]),
      { N1: { promedio: 4.5, total: 2 }, N2: { promedio: 2, total: 1 } });
  });

  it('los tres sitios pasan por la pieza, corridos, y enseñan el MISMO número en todos los casos', () => {
    const m = medir(null);
    assert.deepStrictEqual(m.problemas, [], m.problemas.join(' · '));
    assert.deepStrictEqual(Object.keys(m.sitios), ['LISTA', 'MENÚ', 'ALIADOS']);
    assert.ok(m.importaApp && m.importaAli, 'Restaurantes.js o CalificacionesRestaurante.js no importan ./estrellasNegocio');
    assert.match(m.trozos.cargaLista, /promediosPorNegocio\(/);
    assert.match(m.trozos.cargaMenu, /lasQueCuentan\(/);
    assert.match(m.trozos.cuentasMenu, /promedioDelNegocio\(/);
    assert.match(m.trozos.cargaAli, /calificaAlNegocio\(/);
    assert.match(m.trozos.cuentasAli, /promedioDelNegocio\(/);
    const v = verCasos(m);
    const distintos = v.filter((x) => !x.iguales).map((x) => x.caso + ' → ' + JSON.stringify(x.vistos));
    assert.deepStrictEqual(distintos, [], 'el cliente y el restaurante ven números distintos');
    const taxi = v.find((x) => /TAXI/.test(x.caso));
    assert.deepStrictEqual(taxi.vistos, { LISTA: '4.0 (2)', 'MENÚ': '4.0 (2)', ALIADOS: '4.0 (2)' });
    assert.strictEqual(v.find((x) => x.caso === 'ninguna').vistos.LISTA, SIN);
  });

  it('CAREO · con el código de antes (' + ANTES.raiz + ' / ' + ANTES.aliados + ') cambia SOLO lo decidido', () => {
    const antes = medir(ANTES);
    assert.deepStrictEqual(antes.problemas, [], antes.problemas.join(' · '));
    assert.ok(!antes.importaApp && !antes.importaAli, 'el código de antes no debería usar la pieza');
    // Antes, con la de taxi al dueño, el cliente veía 4.0 en la lista y 3.0 en el menú: el gemelo.
    assert.strictEqual(verCasos(antes).filter((x) => !x.iguales).length, 2, 'el medidor ya no ve el fallo de antes');
    const c = carear(antes, medir(null));
    assert.strictEqual(c.comparaciones, CASOS.length * 3);
    const donde = c.diferencias.map((d) => d.caso + ' · ' + d.sitio);
    assert.deepStrictEqual(donde, [
      'dos clientes y una de TAXI al dueño como persona (1★) · MENÚ',
      'dos clientes y una de TAXI al dueño como persona (1★) · ALIADOS',
      'un cliente 4★ y una vieja con 0★ · LISTA', 'un cliente 4★ y una vieja con 0★ · MENÚ', 'un cliente 4★ y una vieja con 0★ · ALIADOS',
      'un cliente 4★ y una sin campo estrellas · LISTA', 'un cliente 4★ y una sin campo estrellas · MENÚ', 'un cliente 4★ y una sin campo estrellas · ALIADOS',
      'un cliente 4★ y una con «5» escrito como texto · LISTA', 'un cliente 4★ y una con «5» escrito como texto · MENÚ', 'un cliente 4★ y una con «5» escrito como texto · ALIADOS',
      'solo una de taxi al dueño (el conductor calificó al pasajero) · MENÚ', 'solo una de taxi al dueño (el conductor calificó al pasajero) · ALIADOS',
      'un cliente 4★ y una con 4.5★ · LISTA', 'un cliente 4★ y una con 4.5★ · MENÚ', 'un cliente 4★ y una con 4.5★ · ALIADOS',
    ], 'el careo cambió en un caso que no se decidió cambiar');
  });

  it('nadie más en la app ni en aliados suma estrellas a mano', () => {
    const conSuma = [];
    for (const carpeta of ['guajirago/src', 'guajirago-aliados/src']) {
      for (const f of fs.readdirSync(path.join(RAIZ, carpeta)).filter((x) => x.endsWith('.js'))) {
        const r = carpeta + '/' + f;
        if (r === PIEZA_APP || r === PIEZA_ALIADOS) continue;
        if (/reduce\([^\n]*\.estrellas/.test(soloCodigo(leer(r)))) conSuma.push(r);
      }
    }
    assert.deepStrictEqual(conSuma, [], 'suma estrellas a mano (usa estrellasNegocio.js): ' + conSuma.join(', '));
  });

  describe('pantallas de mentira: el medidor no se puede ablandar', () => {
    it('si la copia de aliados se separa, se nota', () => {
      const rota = leer(PIEZA_ALIADOS).replace("c.quienCalifica === 'cliente' && ", '');
      assert.notStrictEqual(rota, leer(PIEZA_ALIADOS));
      const m = medir(null, { [PIEZA_ALIADOS]: rota });
      assert.strictEqual(m.piezasIguales, false);
      assert.ok(verCasos(m).some((x) => !x.iguales), 'aliados contando las de taxi no cambia nada según el medidor');
    });

    it('si el menú vuelve a su filtro propio, el cliente ve dos números', () => {
      const rota = leer(RESTAURANTES).replace(/lasQueCuentan\(snap\.docs\.map\(d => \(\{ id: d\.id, \.\.\.d\.data\(\) \}\)\), restauranteActivo\.id\)/,
        'snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.reportado)')
        .replace('promedioDelNegocio(califsRestaurante, restauranteActivo.id)', "{ promedio: califsRestaurante.reduce((s, c) => s + (c.estrellas || 0), 0) / (califsRestaurante.length || 1), total: califsRestaurante.length }");
      assert.notStrictEqual(rota, leer(RESTAURANTES));
      const v = verCasos(medir(null, { [RESTAURANTES]: rota }));
      assert.ok(v.some((x) => !x.iguales), 'el menú contando las de taxi no se nota');
    });

    it('si aliados vuelve a contar todas las de su id, se nota', () => {
      const rota = leer(ALIADOS).replace('.filter(c => calificaAlNegocio(c, restauranteId))', '');
      assert.notStrictEqual(rota, leer(ALIADOS));
      const m = medir(null, { [ALIADOS]: rota });
      assert.match(m.trozos.cargaAli, /^((?!calificaAlNegocio).)*$/s);
    });

    it('si la lista deja de enseñar el número de la pieza, se nota', () => {
      const rota = leer(RESTAURANTES).replace('{mapaCalif[r.id].promedio.toFixed(1)}', '{Math.round(mapaCalif[r.id].promedio).toFixed(1)}');
      assert.notStrictEqual(rota, leer(RESTAURANTES));
      assert.ok(verCasos(medir(null, { [RESTAURANTES]: rota })).some((x) => !x.iguales), 'la lista redondeando a entero no se nota');
    });
  });
});
