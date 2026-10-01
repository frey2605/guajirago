/**
 * P06 · LA BIENVENIDA, UNA VEZ POR TELÉFONO, LA DECIDE EL SERVIDOR (30-sep-2026)
 *
 * El regalo de bienvenida ($8.000) lo da `descuentoDeBienvenida` (G18), una vez por persona y por aparato. «Una vez
 * por teléfono» lo cuidaba SOLO la pantalla de registro, preguntándole a `celularDisponible` si otra ficha tenía ese
 * `celular`: una pregunta que una app modificada se salta, y que mira un campo que el dueño de la ficha puede cambiar.
 * Ahora el servidor mira el `celular` de la ficha en 10 cifras, lo apunta en su propio registro
 * (`bienvenidaPorTelefono/{10 cifras}`, en la MISMA transacción que da el regalo) y no lo vuelve a dar a ese número.
 *
 * Estas pruebas EJECUTAN guajirago/functions/index.js entero con la nube de mentira (los escenarios de
 * scripts/medir-bienvenida-por-telefono.cjs, una sola lista), y lo carean con el código de antes (7d3cfff):
 * los abusos dejan de cobrar y los casos honrados dan exactamente lo mismo.
 * (Las del servidor encendido, con el emulador, están en pruebas/funciones.test.js: «P06 · descuentoDeBienvenida».)
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer } = require('./cargar.cjs');
const { ESCENARIOS, correrCodigo } = require('../scripts/medir-bienvenida-por-telefono.cjs');
const PIEZA = require('../guajirago/functions/descuentoPendiente.cjs');

const ANTES = '7d3cfff';
const RAIZ = path.resolve(__dirname, '..');

describe('P06 · la bienvenida y el teléfono, ejecutando el servidor', () => {
  let hoy;
  let antes;
  it('con el código de hoy, todos los escenarios terminan como deben', async () => {
    hoy = await correrCodigo();
    const mal = hoy.filter((s) => s.ultimo.resultado !== s.esc.espera)
      .map((s) => s.esc.nombre + ' → ' + JSON.stringify(s.registros));
    assert.deepStrictEqual(mal, [], '⛔ escenarios mal:\n' + mal.join('\n'));
    assert.strictEqual(hoy.length, ESCENARIOS.length);
  });

  it('los abusos: el mismo número ya no cobra dos veces (y antes sí cobraba)', async () => {
    antes = await correrCodigo(ANTES);
    const abusos = ['cambia su `celular` por fuera', 'se salta la pregunta y se registra con el mismo', 'escrito de otra forma',
      'SIN celular', 'ANTES del registro por teléfono', 'número viejo escrito «300 111 2233»', 'pone uno nuevo en Mi perfil'];
    for (const trozo of abusos) {
      const i = ESCENARIOS.findIndex((e) => e.nombre.includes(trozo));
      assert.ok(i >= 0, 'no está el escenario «' + trozo + '»');
      assert.strictEqual(antes[i].ultimo.resultado, 8000, 'el careo no reproduce el abuso de antes en «' + trozo + '»');
      assert.strictEqual(hoy[i].ultimo.resultado, 0, '⛔ «' + ESCENARIOS[i].nombre + '» sigue cobrando');
    }
  });

  it('los casos honrados dan lo mismo que antes (mismo regalo, mismo bloqueo, mismos motivos)', () => {
    const honrados = ESCENARIOS.map((e, i) => i).filter((i) => ESCENARIOS[i].honrado
      || /otra vez desde otro aparato|aparato que ya usó/.test(ESCENARIOS[i].nombre));
    assert.ok(honrados.length >= 5);
    for (const i of honrados) {
      const quitarRegistro = (s) => s.registros.map((r) => ({ uid: r.uid, resultado: r.resultado, motivo: r.motivo }));
      assert.deepStrictEqual(quitarRegistro(hoy[i]), quitarRegistro(antes[i]), '⛔ cambió un caso honrado: ' + ESCENARIOS[i].nombre);
    }
  });

  it('el regalo apunta el número en 10 cifras, a nombre de quien lo recibió, y nada más', () => {
    const normal = hoy[ESCENARIOS.findIndex((e) => e.nombre === 'registro normal de Ana')];
    assert.deepStrictEqual(normal.registroPorTelefono, ['3001112233']);
    const sinTel = hoy[ESCENARIOS.findIndex((e) => e.nombre.includes('SIN celular'))];
    assert.deepStrictEqual(sinTel.registroPorTelefono, [], '⛔ apuntó algo sin teléfono');
    // En TODOS los escenarios: apuntados = exactamente los números de los registros que recibieron el regalo.
    const { celularDiezCifras } = require('../guajirago/functions/telefonoValido.cjs');
    for (const s of hoy) {
      const pasosRegistro = s.esc.pasos.filter((p) => p[0] === 'registro');
      const cobrados = s.registros.map((r, i) => (r.resultado === 8000 ? celularDiezCifras(pasosRegistro[i][2]) : null)).filter(Boolean);
      assert.deepStrictEqual([...s.registroPorTelefono].sort(), [...new Set(cobrados)].sort(),
        '⛔ «' + s.esc.nombre + '»: se apuntaron números que no cobraron, o faltan los que sí');
    }
  });
});

describe('P06 · la pieza que decide (descuentoPendiente.cjs)', () => {
  const nuevo = { config: {}, ficha: { tipo: '' }, aparatoYaUsado: false, yaLaRecibio: false, viajesPedidos: 0, telefono: '3001112233' };
  const CASOS = [
    ['con su teléfono y nada más', {}, null],
    ['sin teléfono que sirva', { telefono: '' }, 'sin_telefono'],
    ['con el número ya apuntado a otra persona', { telefonoUsado: true }, 'telefono_usado'],
    ['con el número en la ficha de otra persona', { telefonoDeOtro: true }, 'telefono_de_otro'],
    ['quien ya la recibió sigue diciendo ya_recibida aunque su número esté apuntado', { yaLaRecibio: true, telefonoUsado: true }, 'ya_recibida'],
  ];
  for (const [que, cambio, motivo] of CASOS) {
    it(que + ' → ' + (motivo || 'le toca'), () => {
      assert.strictEqual(PIEZA.porQueNoLaBienvenida({ ...nuevo, ...cambio }), motivo);
    });
  }
});

describe('P06 · el registro de teléfonos es solo del servidor', () => {
  it('las reglas no nombran `bienvenidaPorTelefono` (sin match, nadie lo lee ni lo escribe desde un teléfono)', () => {
    assert.ok(!/bienvenidaPorTelefono/.test(leer('firestore.rules')), '⛔ las reglas abren el registro de teléfonos');
    assert.ok(!/match \/\{document=\*\*\}/.test(leer('firestore.rules').replace(/\/\/.*$/gm, '')),
      '⛔ hay un match general en las reglas: el registro de teléfonos dejaría de estar cerrado');
  });

  it('ninguna de las tres apps lo nombra; en la nube, solo descuentoDeBienvenida', () => {
    const culpables = [];
    const recorrer = (dir) => {
      for (const f of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
        const rel = dir + '/' + f.name;
        if (f.isDirectory()) recorrer(rel);
        else if (/\.js$/.test(f.name) && /bienvenidaPorTelefono/.test(leer(rel))) culpables.push(rel);
      }
    };
    for (const d of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) recorrer(d);
    assert.deepStrictEqual(culpables, [], '⛔ una app toca el registro de teléfonos');
    const idx = leer('guajirago/functions/index.js');
    const veces = idx.split('collection("bienvenidaPorTelefono")').length - 1;
    assert.strictEqual(veces, 1, 'el registro se nombra ' + veces + ' veces en index.js');
    const i = idx.indexOf('exports.descuentoDeBienvenida = ');
    const cuerpo = idx.slice(i, idx.indexOf('\n});', i));
    assert.ok(cuerpo.includes('collection("bienvenidaPorTelefono")'), '⛔ el registro se escribe fuera de descuentoDeBienvenida');
    assert.match(cuerpo, /t\.set\(refTelefono, /, '⛔ el número no se apunta dentro de la transacción del regalo');
  });

  it('celularDisponible y descuentoDeBienvenida hacen la MISMA pregunta (una sola consulta del celular)', () => {
    const idx = leer('guajirago/functions/index.js');
    const pieza = leer('guajirago/functions/telefonoValido.cjs');
    const consulta = /where\(\s*['"]celular['"]\s*,\s*['"]in['"]/g;
    assert.strictEqual((idx.match(consulta) || []).length, 0, '⛔ index.js vuelve a escribir la consulta del celular a mano');
    assert.strictEqual((pieza.match(consulta) || []).length, 1, '⛔ la consulta del celular no está (una vez) en telefonoValido.cjs');
    for (const nombre of ['celularDisponible', 'descuentoDeBienvenida']) {
      const i = idx.indexOf('exports.' + nombre + ' = ');
      const cuerpo = idx.slice(i, idx.indexOf('\n});', i));
      assert.match(cuerpo, /fichasConEsteCelular\(/, '⛔ ' + nombre + ' no usa la pregunta común');
      assert.match(cuerpo, /esDeOtraFicha\(/, '⛔ ' + nombre + ' decide a mano si es de otro');
    }
  });
});
