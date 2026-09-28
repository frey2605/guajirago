// ═══════════════════════════════════════════════════════════════════════════
//  LOS ESTADOS DEL PEDIDO Y EL AVISO DE «TU PEDIDO LLEGÓ» · gemelo G33, 28-sep-2026
//
//  Los estados del pedido vivían en 4 tablas: flujoPedidos.js y ConfigFlujos.js (aliados), Restaurantes.js (la app
//  del cliente) y el servidor. El servidor avisaba por ESTADO DEL NEGOCIO y no conocía «cerrado»: si el negocio
//  apagaba la etapa «entregado», el pedido saltaba de «en camino» a «cerrado» y al cliente no le llegaba el aviso.
//
//  Aquí se EJECUTA todo: la pieza de la app (estadosPedido.js), su copia del servidor (estadosPedido.cjs), la función
//  del servidor sacada de index.js con un mensajero de mentira, y la lista de ConfigFlujos.js sacada del archivo.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const SERVIDOR = require('../guajirago/functions/estadosPedido.cjs');
const { medirCodigo, elAvisoDelServidor, avisosDeLaCadena, todasLasCadenas } = require('../scripts/medir-estados-pedido.cjs');

const APP = cargarDeLaApp('guajirago/src/estadosPedido.js');
const FLUJO = cargarDeLaApp('guajirago-aliados/src/flujoPedidos.js');
const ESTADOS_DEL_NEGOCIO = Object.keys(FLUJO.ESTADO_META);
const RAROS = [undefined, null, '', 'tomado', 'inventado'];

describe('G33 · una sola tabla de estados del pedido, con la copia del servidor atada', () => {
  it('la app y el servidor dicen el MISMO paso para cada estado (también los raros)', () => {
    assert.deepStrictEqual(SERVIDOR.PASO_DEL_ESTADO, APP.PASO_DEL_ESTADO, 'las dos tablas se separaron');
    for (const e of [...ESTADOS_DEL_NEGOCIO, ...RAROS]) {
      assert.strictEqual(SERVIDOR.pasoDelCliente(e), APP.pasoDelCliente(e), 'dicen distinto con ' + JSON.stringify(e));
    }
  });

  it('todo estado que conoce aliados (flujoPedidos.js) tiene su paso del cliente, y ninguno sobra', () => {
    for (const e of ESTADOS_DEL_NEGOCIO) {
      assert.ok(APP.pasoDelCliente(e), 'aliados conoce «' + e + '» y la app del cliente no sabe qué paso es');
    }
    assert.deepStrictEqual(Object.keys(APP.PASO_DEL_ESTADO).sort(), [...ESTADOS_DEL_NEGOCIO].sort(),
      'la tabla del cliente tiene estados que aliados no conoce (o le faltan)');
  });

  it('los pasos van en el orden del flujo del negocio, y cada paso (menos cancelado) está en la línea de tiempo', () => {
    const ids = APP.PASOS_DEL_CLIENTE.map((p) => p.id);
    let ultimo = -1;
    for (const e of ['nuevo', ...FLUJO.ORDEN_ESTADOS]) {
      const i = ids.indexOf(APP.pasoDelCliente(e));
      assert.ok(i >= 0, '«' + e + '» cae en un paso que la línea de tiempo no pinta');
      assert.ok(i >= ultimo, '«' + e + '» haría RETROCEDER la línea de tiempo del cliente');
      ultimo = i;
    }
    assert.strictEqual(APP.pasoDelCliente('cancelado'), 'cancelado');
    assert.strictEqual(APP.indiceDelPaso('cancelado'), -1);
  });

  it('el servidor tiene un aviso para cada paso menos «nuevo»', () => {
    for (const p of APP.PASOS_DEL_CLIENTE.map((x) => x.id).concat('cancelado')) {
      const t = SERVIDOR.textoDelPaso(p, { restauranteNombre: 'X' });
      if (p === 'nuevo') assert.strictEqual(t, null);
      else assert.ok(t && t.title && t.body, 'el paso «' + p + '» no tiene aviso');
    }
  });

  it('A PROPÓSITO distinto: «entregado» es final para el cliente y NO para el negocio', () => {
    assert.strictEqual(APP.yaLlegoAlCliente('entregado'), true);
    assert.strictEqual(APP.yaLlegoAlCliente('cerrado'), true);
    assert.strictEqual(FLUJO.esFinal('entregado'), false, 'el negocio todavía tiene que cerrar la caja');
    assert.strictEqual(FLUJO.esFinal('cerrado'), true);
  });

  it('lo que ve el cliente en pantalla sale igual que antes de G33', () => {
    // La tabla y las listas que tenía Restaurantes.js hasta 183eb82, escritas aquí como referencia del careo.
    const ANTES = { nuevo: 'Recibido', confirmado: 'Confirmado', preparando: 'Preparando', empacado: 'Preparando', en_camino: 'En camino', entregado: 'Entregado', cerrado: 'Entregado', cancelado: 'Cancelado' };
    const PASO_ANTES = { nuevo: 0, confirmado: 1, preparando: 2, empacado: 2, en_camino: 3, entregado: 4, cerrado: 4 };
    for (const e of [...ESTADOS_DEL_NEGOCIO, ...RAROS]) {
      assert.strictEqual(APP.etiquetaParaElCliente(e), ANTES[e] || e, 'etiqueta de ' + JSON.stringify(e));
      assert.strictEqual(APP.indiceDelPaso(e), PASO_ANTES[e] !== undefined ? PASO_ANTES[e] : -1, 'paso de ' + JSON.stringify(e));
      assert.strictEqual(APP.terminadoParaElCliente(e), ['entregado', 'cerrado', 'cancelado'].includes(e), 'terminado ' + JSON.stringify(e));
      assert.strictEqual(APP.yaLlegoAlCliente(e), ['entregado', 'cerrado'].includes(e), 'llegó ' + JSON.stringify(e));
    }
  });

  it('Restaurantes.js usa la pieza y no vuelve a escribir su propia tabla', () => {
    const t = soloCodigo(leer('guajirago/src/Restaurantes.js'));
    assert.match(t, /from '\.\/estadosPedido'/, 'Restaurantes.js ya no importa estadosPedido.js');
    assert.match(t, /const ESTADOS = PASOS_DEL_CLIENTE;/, 'la línea de tiempo del seguimiento no sale de la pieza');
    assert.ok(!/'entregado',\s*'cerrado'/.test(t), 'volvió una lista a mano de «entregado, cerrado» en Restaurantes.js');
    assert.ok(!/ESTADO_A_PASO|ESTADO_LABEL_CLIENTE/.test(t), 'volvió una tabla propia de estados en Restaurantes.js');
    // Cada sitio que pinta el estado del pedido le pregunta a la pieza (los cuatro que tenían su lista a mano).
    const usos = [
      ['const indiceActual = indiceDelPaso(pedidoActivo.estado);', 1, 'la línea de tiempo del seguimiento'],
      [': etiquetaParaElCliente(p.estado);', 1, 'la etiqueta de «Mis pedidos»'],
      ['!terminadoParaElCliente(pedidoActivo.estado)', 1, 'el «Listo en ~N min» del seguimiento'],
      ['!terminadoParaElCliente(p.estado)', 1, 'el «Listo en ~N min» de «Mis pedidos»'],
      ['{yaLlegoAlCliente(pedidoActivo.estado) && (', 1, 'el recuadro de calificar'],
    ];
    for (const [texto, veces, que] of usos) {
      assert.strictEqual(t.split(texto).length - 1, veces, que + ' ya no le pregunta a estadosPedido.js («' + texto + '»)');
    }
  });
});

describe('G33 · el aviso de «tu pedido llegó» no depende de la etapa que el negocio tenga encendida', () => {
  it('en las 16 formas de armar el flujo, el cliente recibe «¡Pedido entregado!» exactamente UNA vez', async () => {
    const r = await medirCodigo(null);
    assert.strictEqual(r.total, 16);
    for (const f of r.filas) {
      assert.strictEqual(f.entregados, 1, 'con las etapas [' + f.encendidas.join(', ') + '] el cliente recibe «entregado» '
        + f.entregados + ' veces (cadena ' + f.cadena.join(' → ') + ')');
    }
  });

  it('con «entregado» apagado el aviso sale al CERRAR; con él encendido, cerrar no lo repite', async () => {
    const avisar = elAvisoDelServidor(null);
    const pedido = { clienteFcmToken: 'tok', restauranteNombre: 'Asadero La 15' };
    const alCerrar = await avisar({ estado: 'en_camino' }, { ...pedido, estado: 'cerrado' });
    assert.deepStrictEqual(alCerrar.map((s) => s.title), ['🎉 ¡Pedido entregado!']);
    assert.deepStrictEqual(await avisar({ estado: 'entregado' }, { ...pedido, estado: 'cerrado' }), []);
    assert.deepStrictEqual(await avisar({ estado: 'preparando' }, { ...pedido, estado: 'empacado' }), [],
      'empacado es el mismo paso que preparando para el cliente');
    assert.deepStrictEqual(await avisar({ estado: 'en_camino' }, { estado: 'cerrado' }), [], 'sin teléfono no se avisa');
  });

  it('en ninguna cadena el cliente recibe dos veces el mismo paso, y cancelar avisa desde cualquier estado', async () => {
    const avisar = elAvisoDelServidor(null);
    for (const { cadena } of todasLasCadenas()) {
      const titulos = (await avisosDeLaCadena(avisar, cadena)).map((x) => x.title);
      assert.strictEqual(new Set(titulos).size, titulos.length, 'aviso repetido en ' + cadena.join(' → '));
    }
    for (const e of ['nuevo', ...FLUJO.ORDEN_ESTADOS.filter((x) => x !== 'cerrado')]) {
      const s = await avisar({ estado: e }, { estado: 'cancelado', clienteFcmToken: 'tok', motivoRechazo: 'sin gas' });
      assert.strictEqual(s.length, 1, 'cancelar desde ' + e);
      assert.match(s[0].body, /fue cancelado: sin gas/);
    }
  });
});

describe('G33 · ConfigFlujos.js saca sus etapas de flujoPedidos.js', () => {
  it('las etapas de domicilio son ORDEN_ESTADOS, en su orden, con las fijas de construirCadena y su nombre', () => {
    const t = leer('guajirago-aliados/src/ConfigFlujos.js').replace(/\r\n/g, '\n');
    assert.match(t, /import \{[^}]*\bORDEN_ESTADOS\b[^}]*\bETAPAS_FIJAS\b[^}]*\} from '\.\/flujoPedidos';/,
      'ConfigFlujos.js ya no importa ORDEN_ESTADOS y ETAPAS_FIJAS de flujoPedidos.js');
    const desde = t.indexOf('const TEXTO_ETAPA_DOMICILIO');
    const hasta = t.indexOf('}));', t.indexOf('const ETAPAS_DOMICILIO'));
    assert.ok(desde >= 0 && hasta > desde, 'no se encuentra la lista de etapas de domicilio en ConfigFlujos.js');
    // eslint-disable-next-line no-new-func
    const ETAPAS = new Function('ORDEN_ESTADOS', 'ETAPAS_FIJAS', t.slice(desde, hasta + 4) + '\nreturn ETAPAS_DOMICILIO;')(
      FLUJO.ORDEN_ESTADOS, FLUJO.ETAPAS_FIJAS);
    assert.deepStrictEqual(ETAPAS.map((e) => e.id), FLUJO.ORDEN_ESTADOS);
    const fijasDeLaCadena = FLUJO.construirCadena(['__ninguna__']).filter((e) => e !== 'nuevo');
    assert.deepStrictEqual(ETAPAS.filter((e) => e.fija).map((e) => e.id), fijasDeLaCadena,
      'la pantalla pinta «(siempre)» en etapas distintas de las que construirCadena deja fijas');
    for (const e of ETAPAS) assert.notStrictEqual(e.label, e.id, 'la etapa «' + e.id + '» no tiene nombre en la pantalla');
  });
});
