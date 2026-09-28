// ═══════════════════════════════════════════════════════════════════════════
//  LA PLATA SE ESCRIBE CON UN SOLO FORMATEADOR · gemelo G14, 28-sep-2026
//
//  `cop()` (guajirago/src/moneda.js, con copias atadas en aliados, en el panel y en el servidor) ya existía, pero
//  73 renglones escribían los pesos a mano: casi todos con `toLocaleString()` SIN idioma, que usa el del teléfono o
//  el del computador (en uno en inglés, «$10,000»), y otros con `'$' + n` o un `toLocaleString('es-CO')` suelto.
//  Medido con scripts/medir-formateo-pesos.cjs: transporte 25, panel 45, servidor 3. Ahora: 0.
//
//  Aquí se prueba:
//    · la cuenta del proyecto entero es EXACTAMENTE la de PENDIENTES (las máscaras de los campos donde se teclea un
//      precio, en aliados): si nace un formateo a mano se pone roja, y si se arregla uno y nadie baja la cuenta, también;
//    · el vigilante contra pantallas de mentira: caza cada forma, y NO caza las fechas ni `cop()`;
//    · quien llama a `cop(` lo importa de verdad (si no, la pantalla revienta al pintarse);
//    · y los textos se EJECUTAN con un teléfono en inglés: el de la app, el del panel y el del servidor.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, cargarDeLaApp } = require('./cargar.cjs');
const V = require('../scripts/medir-formateo-pesos.cjs');
const { soloCodigo } = require('../scripts/medir-ley-boton.cjs');

const NB = '\u00a0'; // cop() separa el signo del número con un espacio DURO

// Un teléfono con otro idioma: `toLocaleString()` sin idioma usa el del aparato. Aquí se le cambia a propósito.
function conTelefonoEn(idioma, fn) {
  const original = Number.prototype.toLocaleString;
  // eslint-disable-next-line no-extend-native
  Number.prototype.toLocaleString = function (loc, op) { return original.call(this, loc || idioma, op); };
  try { return fn(); } finally {
    // eslint-disable-next-line no-extend-native
    Number.prototype.toLocaleString = original;
  }
}

describe('G14 · nadie escribe los pesos a mano, en las tres apps ni en el servidor', () => {
  it('la cuenta de hoy es EXACTAMENTE la de PENDIENTES (solo puede bajar, y a la vista)', () => {
    const hoy = V.medir();
    const malos = [];
    const archivos = new Set([...Object.keys(hoy), ...Object.keys(V.PENDIENTES)]);
    for (const f of archivos) {
      const n = (hoy[f] || []).length;
      const p = V.PENDIENTES[f] || 0;
      if (n > p) {
        malos.push(`${f}: ${n} renglón(es) a mano y la lista permite ${p}. Usa cop() de moneda.js:\n`
          + (hoy[f] || []).map((s) => `      :${s.linea} [${s.reglas.join(', ')}] ${s.trozo}`).join('\n'));
      } else if (n < p) {
        malos.push(`${f}: ya solo hay ${n} y PENDIENTES dice ${p}. ¡Bien! Baja la cuenta en scripts/medir-formateo-pesos.cjs.`);
      }
    }
    assert.deepStrictEqual(malos, [], '\n' + malos.join('\n'));
  });

  it('las excepciones son SOLO máscaras de campos donde se teclea (un <input value=…>)', () => {
    const hoy = V.medir();
    for (const f of Object.keys(V.PENDIENTES)) {
      for (const s of hoy[f] || []) {
        assert.deepStrictEqual(s.reglas, ['es-CO a mano'], f + ':' + s.linea + ' no es una máscara: ' + s.trozo);
        assert.match(s.trozo, /value=\{/, f + ':' + s.linea + ' no es el valor de un campo: ' + s.trozo);
      }
    }
  });

  it('el vigilante recorre de verdad las cuatro carpetas', () => {
    assert.deepStrictEqual(V.CARPETAS, ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src', 'guajirago/functions']);
  });
});

describe('G14 · el vigilante, contra pantallas de mentira', () => {
  const caza = (codigo) => V.revisarArchivo(codigo, 'x/Pantalla.js').map((s) => s.reglas.sort().join('+'));

  it('caza cada forma de escribir la plata a mano', () => {
    const CASOS = [
      ['<p>${total.toLocaleString()}</p>', '$ suelto en pantalla+sin idioma'],
      ['<p>${total}</p>', '$ suelto en pantalla'],
      ['<p>Tu oferta: ${(a || b).toLocaleString()} ya</p>', '$ suelto en pantalla+sin idioma'],
      ['const t = `$${v.toLocaleString()}`;', 'plantilla $${+sin idioma'],
      ['const t = `Pagas $${v} hoy`;', 'plantilla $${'],
      ["const t = '$' + v;", 'signo pegado'],
      ['const t = "$ " + Number(v).toLocaleString("es-CO");', 'es-CO a mano+signo pegado'],
      ["const t = ' de $' + cop2(v);", 'signo pegado'],
      ["const t = n.toLocaleString('es-CO');", 'es-CO a mano'],
      ["const f = new Intl.NumberFormat('es-CO', {});", 'Intl propio'],
      ['const t = v.toLocaleString();', 'sin idioma'],
      ['const x = `a ${`b $${v}`} c`;', 'plantilla $${'],
    ];
    for (const [codigo, esperado] of CASOS) {
      assert.deepStrictEqual(caza(codigo), [esperado], 'con «' + codigo + '»');
    }
  });

  it('NO caza lo que está bien: cop(), fechas, porcentajes, el «$» de un campo, comentarios', () => {
    const BUENOS = [
      '<p>{cop(total)}</p>',
      'const t = `Recargaste ${cop(v)} hoy`;',
      "const t = `${p.valor}% de descuento`;",
      "<span>{tipo === 'descuento' ? '%' : '$'}</span>",
      "{campoNumero('TARIFA', 'tarifa', '$')}",
      "const f = new Date(v).toLocaleString('es-CO');",
      "const f = d.toLocaleString('es-CO');",
      "<p>{v.fechaSolicitud ? new Date(v.fechaSolicitud).toLocaleString('es-CO') : ''}</p>",
      '// antes: <p>${total.toLocaleString()}</p>',
      '/* `$${v.toLocaleString()}` */',
      'const $x = 1; const y = { a: $x };',
    ];
    for (const codigo of BUENOS) assert.deepStrictEqual(caza(codigo), [], 'cazó por error «' + codigo + '»');
  });

  it('el renglón que reporta es el de verdad, aunque haya comentarios de bloque arriba', () => {
    const r = V.revisarArchivo('/*\n uno\n dos\n*/\nconst a = 1;\n<p>${v.toLocaleString()}</p>\n', 'x/P.js');
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].linea, 6);
  });

  it('el formateador mismo (moneda.js / moneda.cjs) puede llevar su Intl.NumberFormat; nadie más', () => {
    const c = "export const cop = (n) => new Intl.NumberFormat('es-CO', {}).format(n || 0);";
    assert.deepStrictEqual(V.revisarArchivo(c, 'guajirago-admin/src/moneda.js'), []);
    assert.strictEqual(V.revisarArchivo(c, 'guajirago-admin/src/Otro.js').length, 1);
  });
});

describe('G14 · quien llama a cop() lo importa de verdad', () => {
  // Sin el import, `cop` no existe y la pantalla revienta EN LA CARA del usuario al pintarse.
  it('cada archivo que dice cop( lo trae de ./moneda (o de ./moneda.cjs en el servidor)', () => {
    const faltan = [];
    for (const carpeta of V.CARPETAS) {
      for (const d of fs.readdirSync(path.join(RAIZ, carpeta), { withFileTypes: true })) {
        if (!d.isFile() || !/\.c?js$/.test(d.name) || /^moneda\.c?js$/.test(d.name)) continue;
        const fuente = fs.readFileSync(path.join(RAIZ, carpeta, d.name), 'utf8');
        const codigo = soloCodigo(fuente.replace(/\r\n/g, '\n'));
        if (!/(^|[^\w$.])cop\(/.test(codigo)) continue;
        const trae = /^import \{[^}]*\bcop\b[^}]*\} from '\.\/moneda';/m.test(codigo)
          || /const \{[^}]*\bcop\b[^}]*\} = require\('\.\/moneda\.cjs'\);/.test(codigo);
        if (!trae) faltan.push(carpeta + '/' + d.name);
      }
    }
    assert.deepStrictEqual(faltan, [], 'llaman a cop() sin importarlo: ' + faltan.join(', '));
  });

  it('el panel tiene su copia, y es la MISMA función que la de la app', () => {
    const app = cargarDeLaApp('guajirago/src/moneda.js').cop;
    const panel = cargarDeLaApp('guajirago-admin/src/moneda.js').cop;
    // Con decimales también: con enteros solos, una copia que dejara ver centavos pasaba en verde (lo cazó el sabotaje).
    for (const n of [0, 800, 10000, 125500, -500, 1234.56, null, undefined]) assert.strictEqual(panel(n), app(n));
  });
});

describe('G14 · los textos de plata, EJECUTADOS con un teléfono en inglés', () => {
  it('la app: lo que paga el pasajero con descuento (descuentos.js, tarifaParaPasajero)', () => {
    const { tarifaParaPasajero } = cargarDeLaApp('guajirago/src/descuentos.js');
    const v = { tarifa: '$ 10.000', descuentoInfo: { tarifaPasajeroPaga: 12000 } };
    for (const idioma of ['en-US', 'es-ES', 'es-CO']) {
      assert.strictEqual(conTelefonoEn(idioma, () => tarifaParaPasajero(v)), '$' + NB + '12.000', 'con un teléfono en ' + idioma);
    }
  });

  it('el panel: el precio del cobro (estadosCobro.js, enPesos) y el «—» cuando no es número', () => {
    const panel = cargarDeLaApp('guajirago-admin/src/estadosCobro.js');
    assert.strictEqual(conTelefonoEn('en-US', () => panel.enPesos(80000)), '$' + NB + '80.000');
    assert.strictEqual(panel.enPesos(undefined), '—');
  });

  it('el servidor: el aviso de cobro al negocio (cobros.cjs, mensajeDelAviso) dice el precio con cop()', () => {
    const { mensajeDelAviso } = require('../guajirago/functions/cobros.cjs');
    const ficha = { precio: 80000, proximoCobro: '2026-10-09', estado: 'porVencer' };
    const m = conTelefonoEn('en-US', () => mensajeDelAviso({ estado: 'porVencer', diasPara: 3 }, ficha, '2026-10-06'));
    assert.match(m.texto, new RegExp('de \\$' + NB + '80\\.000 vence'), 'el aviso dice: ' + m.texto);
  });

  it('el servidor: los avisos de pedido y de reserva nuevos arman el total con cop()', () => {
    const idx = fs.readFileSync(path.join(RAIZ, 'guajirago/functions/index.js'), 'utf8');
    assert.match(idx, /const totalTxt = p\.total \? cop\(Number\(p\.total\)\) : "";/, 'el aviso del pedido nuevo');
    assert.match(idx, /const totalTxt = r\.total \? cop\(Number\(r\.total\)\) : "";/, 'el aviso de la reserva nueva');
  });
});
