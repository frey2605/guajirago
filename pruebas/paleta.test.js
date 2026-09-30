/**
 * 🎨 LA PALETA — gemelo G90 (30-sep-2026)
 *
 * guajirago/src/theme.js es LA paleta de la app de transporte. Esta prueba vigila cuatro cosas, y todas las EJECUTA
 * con scripts/medir-paleta.cjs:
 *   1. Los colores a mano de las tres apps SOLO PUEDEN BAJAR, archivo por archivo (PENDIENTES del medidor).
 *   2. La paleta dice los colores del sistema de diseño, y Turismo.js y MenuLateral.js la usan (sin paleta propia).
 *   3. La copia de aliados (flujoPedidos.js, otro repo) dice lo mismo que la paleta.
 *   4. Turismo.js y MenuLateral.js, pintados con React, se ven IGUAL que antes de G90 (907dfd6), paso por paso.
 */
const test = require('node:test');
const assert = require('node:assert');
const M = require('../scripts/medir-paleta.cjs');

test.describe('LA PALETA (G90) · los colores a mano solo pueden bajar', () => {
  test.it('ningún archivo de las tres apps tiene más colores a mano que los que dice PENDIENTES (ni menos sin tachar)', () => {
    const difs = M.contraPendientes(M.contar());
    assert.deepStrictEqual(difs, [], '\n' + difs.join('\n'));
  });

  test.it('el contador cuenta #rgb, #rrggbb y #rrggbbaa, y no cuenta los comentarios', () => {
    assert.strictEqual(M.coloresDe("const a = '#FFF'; const b = '#1C8EF9'; const c = '#00000080';"), 3);
    assert.strictEqual(M.coloresDe("// '#FFFFFF'\n/* '#ECECEF' */\nconst x = 1;"), 0);
    assert.strictEqual(M.coloresDe("const id = '#PED01'; const t = `Pedido #${n}`;"), 0);
  });

  test.it('pantallas de mentira: un color nuevo, un archivo nuevo con colores y un color quitado sin tachar se ven', () => {
    const f = 'guajirago/src/Turismo.js';
    const leerHoy = M.lector(null);
    const mas = M.contraPendientes(M.contar(M.lector(null, { [f]: leerHoy(f) + "\nconst NUEVO = '#123456';\n" })));
    assert.ok(mas.some((d) => d.startsWith('🔴 ' + f)), 'un color más en Turismo.js no se vio: ' + mas.join(' | '));
    const nuevo = 'guajirago/src/PantallaNueva.js';
    const conNuevo = M.contraPendientes(M.contar(M.lector(null, { [nuevo]: "export const x = { color: '#ABCDEF' };" }), [nuevo]));
    assert.ok(conNuevo.some((d) => d.startsWith('🔴 ' + nuevo)), 'un archivo nuevo con colores a mano no se vio');
    const menos = M.contraPendientes(M.contar(M.lector(null, { [f]: leerHoy(f).replace("'#1A1A1E'", 'T.tinta') })));
    assert.ok(menos.some((d) => d.startsWith('✓ ' + f)), 'un color quitado sin tachar en PENDIENTES no se vio');
  });
});

test.describe('LA PALETA (G90) · una sola fuente', () => {
  test.it('la paleta, ejecutada, dice los colores del sistema de diseño', () => {
    const T = M.laPaleta();
    assert.deepStrictEqual({
      fondo: T.fondo, tinta: T.tinta, gris: T.gris, borde: T.borde, azul: T.azul, azulClaro: T.azulClaro,
      amarillo: T.amarillo, naranja: T.naranja, magenta: T.magenta, negro: T.negro, grad: T.grad, azulNaranja: T.azulNaranja,
    }, {
      fondo: '#FFFFFF', tinta: '#1A1A1E', gris: '#6B7280', borde: '#ECECEF', azul: '#1C8EF9', azulClaro: '#39A6FF',
      amarillo: '#FFCF4D', naranja: '#FF7A2F', magenta: '#D6357E', negro: '#141416',
      grad: 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)', azulNaranja: 'linear-gradient(135deg, #1C8EF9, #FF7A2F)',
    });
  });

  test.it('Turismo.js y MenuLateral.js importan la paleta, y ningún archivo de la app se arma una paleta propia', () => {
    const usan = M.quienImporta();
    for (const f of ['guajirago/src/Turismo.js', 'guajirago/src/MenuLateral.js']) assert.ok(usan.includes(f), f + ' no importa theme.js');
    const leer = M.lector(null);
    const propias = require('node:fs').readdirSync(require('node:path').join(require('../pruebas/cargar.cjs').RAIZ, 'guajirago/src'))
      .filter((x) => x.endsWith('.js') && x !== 'theme.js').map((x) => 'guajirago/src/' + x)
      .map((x) => [x, M.paletaPropia(leer(x))]).filter(([, n]) => n.length);
    assert.deepStrictEqual(propias, [], 'paleta propia: ' + JSON.stringify(propias));
    assert.deepStrictEqual(M.paletaPropia("import x from './y';\nconst AZUL = '#1C8EF9';\nconst VERDE = \"#2ECC71\";"), ['AZUL', 'VERDE'],
      'el detector de paletas propias no ve una');
  });

  test.it('la copia de aliados (flujoPedidos.js) dice lo mismo que la paleta, y si se separa se ve', () => {
    const T = M.laPaleta();
    assert.deepStrictEqual(M.copiaSeparada(T, M.laCopiaDeAliados()), []);
    const copia = M.laCopiaDeAliados(M.lector(null, { [M.COPIA_ALIADOS]: "export const AZUL = '#0000FF';\nexport const NARANJA = '#FF7A2F';" }));
    const sep = M.copiaSeparada(T, copia);
    assert.strictEqual(sep.length, 3, 'la copia de mentira (un azul distinto y dos que faltan) no se vio: ' + sep.join(' | '));
  });
});

test.describe('LA PALETA (G90) · Turismo y el menú se ven igual (pintados con React)', () => {
  let ahora;
  test.before(async () => { ahora = await M.recorrido(null); });

  test.it('el recorrido pasa por todo: el menú, la lista, buscar, Mis reservas, la agencia y la reserva', () => {
    assert.strictEqual(ahora.length, 21);
    const texto = (i) => ahora[i].html.replace(/<[^>]+>/g, ' ');
    const todo = ahora.map((p) => p.html).join('\n');
    for (const t of ['Cambiar de negocio', 'Cerrar sesión', 'Abierta ahora', 'Cerrada ahora', 'Aún no hay agencias', 'Esperando confirmación',
      'TU CÓDIGO', 'Motivo: Lluvia', 'Escoge la fecha', '¡Reserva enviada!', 'TOTAL A PAGAR', 'Esta agencia aún no ha publicado tours.']) {
      assert.ok(todo.includes(t), 'el recorrido no llega a «' + t + '»');
    }
    assert.ok(texto(1).includes('Mi perfil'), 'el menú no se abre');
    // jsdom tira los degradados del HTML: el careo los mira en los estilos que da React, y aquí se exige que estén.
    const estilos = ahora.map((p) => p.estilos).join('\n');
    for (const g of ['linear-gradient(135deg, #1C8EF9, #FF7A2F)', 'linear-gradient(135deg, #FFCF4D, #FF7A2F, #D6357E)',
      'linear-gradient(135deg, #2ECC71, #27AE60)', '"color":"#1A1A1E"', '"color":"#141416"']) {
      assert.ok(estilos.includes(g), 'los estilos del recorrido no traen ' + g);
    }
    assert.ok(ahora.some((p) => p.escrituras.length === 1 && p.escrituras[0].col === 'reservasTurismo'), 'la reserva no se escribe');
  });

  test.it('careo con 907dfd6 (antes de G90): el mismo HTML y las mismas escrituras, paso por paso', async () => {
    const antes = await M.recorrido(M.ANTES);
    assert.deepStrictEqual(M.carear(antes, ahora), []);
  });

  test.it('pantallas de mentira: un color cambiado en Turismo, en el menú o en la paleta se ve en el careo', async () => {
    const leer = M.lector(null);
    const cambios = [
      ['guajirago/src/Turismo.js', 'const VERDE = T.ok;', 'const VERDE = T.azul;'],
      ['guajirago/src/MenuLateral.js', 'background: T.grad,', 'background: T.azulNaranja,'],
      ['guajirago/src/theme.js', "negro: '#141416',", "negro: '#000000',"],
    ];
    for (const [f, esta, roto] of cambios) {
      const t = leer(f);
      assert.strictEqual(t.split(esta).length, 2, 'el texto de la pantalla de mentira no calza en ' + f + ': ' + esta);
      const mentira = await M.recorrido(null, { [f]: t.replace(esta, roto) });
      assert.ok(M.carear(mentira, ahora).length > 0, 'cambiar «' + esta + '» por «' + roto + '» en ' + f + ' no cambió nada en el careo');
    }
  });
});
