/**
 * G47 · «¿ME PUEDEN PEDIR AHORA?» — UNA SOLA RESPUESTA PARA EL CLIENTE, EL DUEÑO Y EL PANEL (29-sep-2026)
 *
 * Antes la contestaban tres pantallas, cada una a su manera: el cliente (escaparate + pausa + horario), el dueño en
 * aliados (solo la pausa: «Los clientes pueden pedirte» a las 3 de la mañana) y el panel («ABIERTOS AHORA» = aprobado +
 * pausa). Y ninguna miraba el candado del negocio, que es lo que el servidor sí mira al crear el pedido.
 *
 *   1. La regla (guajirago/src/horarioNegocio.js, `motivoParaNoPedir`) se EJECUTA: cada motivo, y en su orden.
 *   2. Su candado es el del servidor: se corre contra los casos, y firestore.rules tiene que seguir preguntando lo mismo.
 *   3. Aliados y el panel tienen COPIAS IGUALES (horarioNegocio.js, escaparate.js y, en aliados, reglaPromocion.js):
 *      letra por letra, y corridas con los mismos casos.
 *   4. Las pantallas se CORREN con el medidor (scripts/medir-pedir-ahora.cjs), que saca de cada archivo la expresión
 *      que decide: a las 24 horas, con ocho negocios de mentira, las cinco tienen que decir lo mismo, y ninguna «sí»
 *      cuando el servidor rechazaría el pedido.
 *   5. Nadie más en las tres apps decide «abierto» por su cuenta.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const MEDIDOR = require('../scripts/medir-pedir-ahora.cjs');

const PIEZA = 'guajirago/src/horarioNegocio.js';
const R = cargarDeLaApp(PIEZA);
const col = (s) => new Date(s + ':00-05:00');
const BASE = { perfilCompleto: true, horarioApertura: 8, horarioCierre: 22 };
const MEDIODIA = col('2026-10-07T12:00');
const MADRUGADA = col('2026-10-07T03:00');

// [nombre, negocio, instante, motivo esperado]
const CASOS = [
  ['normal a mediodía', { ...BASE }, MEDIODIA, null],
  ['normal de madrugada', { ...BASE }, MADRUGADA, 'fuera-de-horario'],
  ['24 horas de madrugada', { ...BASE, horarioApertura: 0, horarioCierre: 0 }, MADRUGADA, null],
  ['sin horario', { perfilCompleto: true }, MADRUGADA, null],
  ['pausado', { ...BASE, abierto: false }, MEDIODIA, 'pausado'],
  ['bloqueado en Cobros', { ...BASE, estadoComercial: 'bloqueado' }, MEDIODIA, 'bloqueado'],
  ['apagado', { ...BASE, activo: false }, MEDIODIA, 'bloqueado'],
  ['activo null (el servidor lo deja)', { ...BASE, activo: null }, MEDIODIA, null],
  ['estadoComercial en mora (el servidor lo deja)', { ...BASE, estadoComercial: 'enMora' }, MEDIODIA, null],
  ['oculto del escaparate', { ...BASE, visibleEnEscaparate: false }, MEDIODIA, 'no-sale-en-la-app'],
  ['pendiente de aprobar', { ...BASE, aprobado: false }, MEDIODIA, 'no-sale-en-la-app'],
  ['ficha a medias', { ...BASE, perfilCompleto: false }, MEDIODIA, 'no-sale-en-la-app'],
  ['bloqueado Y pausado Y fuera de horario: manda el candado', { ...BASE, estadoComercial: 'bloqueado', abierto: false }, MADRUGADA, 'bloqueado'],
  ['oculto Y pausado: manda el escaparate', { ...BASE, visibleEnEscaparate: false, abierto: false }, MEDIODIA, 'no-sale-en-la-app'],
  ['pausado Y fuera de horario: manda la pausa', { ...BASE, abierto: false }, MADRUGADA, 'pausado'],
  ['sin negocio', null, MEDIODIA, 'no-existe'],
];

function comprobarPieza(P, donde) {
  for (const [nombre, n, t, esperado] of CASOS) {
    assert.strictEqual(P.motivoParaNoPedir(n, t), esperado, donde + ' · ' + nombre);
    assert.strictEqual(P.sePuedePedirAhora(n, t), esperado === null, donde + ' · ' + nombre + ' (sePuedePedirAhora)');
    if (esperado !== null) assert.ok(P.MOTIVO_PARA_NO_PEDIR[esperado] && P.MOTIVO_PARA_NO_PEDIR[esperado].corto && P.MOTIVO_PARA_NO_PEDIR[esperado].alDueno, donde + ': falta el texto de ' + esperado);
  }
}

describe('G47 · la regla de «¿me pueden pedir ahora?»', () => {
  it('cada motivo, y en su orden: candado → escaparate → pausa → horario', () => comprobarPieza(R, 'la app'));

  it('el candado es el del servidor: se corre contra el mismo juicio que el medidor, y firestore.rules pregunta lo mismo', () => {
    for (const [nombre, n] of CASOS) {
      if (!n) continue;
      assert.strictEqual(R.negocioPuedeOperar(n), MEDIDOR.elServidorLoDeja(n), nombre);
    }
    const reglas = leer('firestore.rules').replace(/\r\n/g, '\n');
    const d = reglas.indexOf('function puedeOperarEn(');
    assert.ok(d >= 0, 'firestore.rules ya no tiene puedeOperarEn');
    const cuerpo = reglas.slice(d, reglas.indexOf('\n    }', d));
    assert.match(cuerpo, /get\('activo', true\) != false/, 'el servidor cambió cómo mira `activo`: hay que cambiar negocioPuedeOperar igual');
    assert.match(cuerpo, /get\('estadoComercial', 'alDia'\) != 'bloqueado'/, 'el servidor cambió cómo mira `estadoComercial`: hay que cambiar negocioPuedeOperar igual');
  });
});

describe('G47 · las copias de aliados y del panel son la MISMA pieza', () => {
  const norm = (t) => t.replace(/\r\n/g, '\n');
  const COPIAS = [
    ['guajirago-aliados/src/horarioNegocio.js', PIEZA],
    ['guajirago-aliados/src/escaparate.js', 'guajirago/src/escaparate.js'],
    ['guajirago-aliados/src/reglaPromocion.js', 'guajirago/src/reglaPromocion.js'],
    ['guajirago-admin/src/horarioNegocio.js', PIEZA],
    ['guajirago-admin/src/escaparate.js', 'guajirago/src/escaparate.js'],
    ['guajirago-admin/src/reglaPromocion.js', 'guajirago/src/reglaPromocion.js'],
  ];
  it('letra por letra (se cambia en la app y se copia, o la tanda se pone roja)', () => {
    for (const [copia, fuente] of COPIAS) assert.strictEqual(norm(leer(copia)), norm(leer(fuente)), copia + ' ya no es igual a ' + fuente);
  });
  it('y corridas con los mismos casos', () => {
    comprobarPieza(cargarDeLaApp('guajirago-aliados/src/horarioNegocio.js'), 'aliados');
    comprobarPieza(cargarDeLaApp('guajirago-admin/src/horarioNegocio.js'), 'panel');
  });
});

describe('G47 · el cliente, el dueño y el panel dicen lo mismo (corridos, no leídos)', () => {
  const rs = MEDIDOR.reglas();

  it('cada pantalla decide con la pieza', () => {
    for (const k of ['cliente-restaurante', 'cliente-menu', 'cliente-agencia', 'panel']) assert.match(rs[k].como, /sePuedePedirAhora\(/, k + ' usa ' + rs[k].como);
    assert.match(rs.dueno.como, /motivoParaNoPedir\(negocioDoc\)/, 'el dueño usa ' + rs.dueno.como);
  });

  it('a las 24 horas, con ocho negocios de mentira, coinciden; y ninguna dice «sí» si el servidor rechazaría el pedido', () => {
    for (const [nombre, n] of MEDIDOR.CASOS) {
      const r = MEDIDOR.careo(rs, n, 'comida');
      assert.strictEqual(r.distintas, 0, nombre + ': no coinciden en ' + r.distintas + ' h ' + JSON.stringify(r.horasSi));
      assert.strictEqual(r.siSinServidor, 0, nombre + ': dicen «sí» y el servidor lo rechaza en ' + r.siSinServidor + ' h');
      const a = MEDIDOR.careo(rs, { ...n, tipoNegocio: 'turismo' }, 'turismo');
      assert.strictEqual(a.distintas, 0, nombre + ' (agencia): no coinciden en ' + a.distintas + ' h');
    }
    const normal = MEDIDOR.careo(rs, MEDIDOR.CASOS[0][1], 'comida');
    assert.deepStrictEqual(Object.values(normal.horasSi), [14, 14, 14, 14], 'de 8 a 22 son 14 horas en las cuatro');
  });

  it('la tarjeta del dueño dice «pueden pedirte» solo con la regla, y el motivo sale de la pieza', () => {
    const t = soloCodigo(leer('guajirago-aliados/src/App.js')).replace(/\r\n/g, '\n');
    assert.match(t, /\{motivoNoPedir === null \? 'Los clientes pueden pedirte' : MOTIVO_PARA_NO_PEDIR\[motivoNoPedir\]\.alDueno\}/, 'la frase «Los clientes pueden pedirte» ya no depende de la regla');
    assert.strictEqual((t.match(/Los clientes pueden pedirte/g) || []).length, 1, 'la frase aparece en otro sitio');
    assert.match(t, /setNegocioDoc\(d\);/, 'la tarjeta no recibe el negocio del documento vivo');
  });

  // G89 (30-sep-2026): el chip es de los restaurantes (tiposDeNegocio.js) y lo pinta la pantalla única del panel.
  it('los chips del panel salen de la regla', () => {
    const t = soloCodigo(leer('guajirago-admin/src/tiposDeNegocio.js')).replace(/\r\n/g, '\n');
    assert.match(t, /const chipAbierto = \(r\) => \{\n\s*const m = motivoParaNoPedir\(r\);/, 'chipAbierto no pregunta a la regla');
    assert.match(t, /restaurante: \{[\s\S]*?\n\s*chipAbierto,\n[\s\S]*?\n {2}turismo: \{[\s\S]*?\n\s*chipAbierto: null,/, 'el chip ya no es de los restaurantes (y solo de ellos)');
    assert.strictEqual((t.match(/🟢 Abierto/g) || []).length, 1, '«🟢 Abierto» se escribe fuera de chipAbierto');
    const p = soloCodigo(leer('guajirago-admin/src/NegociosDeUnTipo.js'));
    assert.strictEqual((p.match(/T\.chipAbierto\(r\)\.t/g) || []).length, 2, 'la lista y la ficha del negocio');
    assert.strictEqual((p.match(/🟢 Abierto/g) || []).length, 0, '«🟢 Abierto» se escribe en la pantalla');
  });
});

describe('G47 · nadie más decide «abierto» por su cuenta', () => {
  // Solo la pieza (y sus copias) lee la pausa para decidir: dos veces (negocioAbiertoAhora y motivoParaNoPedir). aliados App.js la lee UNA vez, para el botón
  // «Pausar / Reabrir», que cambia justo ese campo.
  const PERMITIDOS = { [PIEZA]: 2, 'guajirago-aliados/src/horarioNegocio.js': 2, 'guajirago-admin/src/horarioNegocio.js': 2, 'guajirago-aliados/src/App.js': 1 };
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
  it('en las tres apps, `.abierto` comparado con false solo está en la pieza y en el botón de pausa', () => {
    const quien = [];
    for (const dir of ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src']) {
      for (const f of archivos(dir)) {
        const n = (soloCodigo(leer(f)).match(/\.abierto\s*[!=]==?\s*false/g) || []).length;
        if (n !== (PERMITIDOS[f] || 0)) quien.push(f + ' (' + n + ')');
      }
    }
    assert.deepStrictEqual(quien, [], 'deciden «abierto» por su cuenta: ' + quien.join(', '));
  });
});
