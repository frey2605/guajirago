// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
//  G100 (30-sep-2026) · LAS COPIAS ATADAS SE COMPARAN CON UNA SOLA VARA
//
//  Los tres repos son aparte y no pueden importar entre sí: una pieza compartida se copia y una prueba la ata. Hasta
//  G100 cada prueba decidía a su manera qué es «idéntica» (23 byte a byte, 14 sin el \r\n, 1 sin ningún \r, medido
//  con `node scripts/medir-copias-atadas.cjs --commit d483d58`). Ahora todas llaman a `copiaIdentica` de
//  pruebas/cargar.cjs, con UNA vara: iguales carácter por carácter salvo el final de línea.
//
//  Esta prueba:
//    1. CORRE la vara con los casos que la definen (el final de línea no cuenta; un carácter, un espacio, un \r
//       suelto o una marca BOM sí);
//    2. corre `copiaIdentica` con archivos de verdad y con trozos, y exige que su queja diga dónde se separan;
//    3. exige que en pruebas/ no quede ninguna comparación de copias con otra vara (lo cuenta el medidor), y que
//       el medidor vea las 38 de antes con sus tres varas;
//    4. le da de comer al medidor pruebas de mentira, para que no se pueda ablandar.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { sonLaMismaCopia, copiaIdentica } = require('./cargar.cjs');
const M = require('../scripts/medir-copias-atadas.cjs');

const BASE = 'const a = 1;\nconst b = 2;\n';

describe('G100 · la vara de «esta copia es idéntica»', () => {
  const CASOS = [
    ['las dos iguales', BASE, BASE, true],
    ['solo el final de línea: Windows contra Unix', BASE.replace(/\n/g, '\r\n'), BASE, true],
    ['solo el final de línea, mezclado dentro de la misma copia', 'const a = 1;\r\nconst b = 2;\n', BASE, true],
    ['un carácter distinto', BASE.replace('2', '3'), BASE, false],
    ['un espacio de más', BASE.replace('const b', 'const  b'), BASE, false],
    ['un espacio de más al final de un renglón', BASE.replace('= 1;', '= 1; '), BASE, false],
    ['un \\r suelto (no es un final de línea)', BASE.replace('const b', 'const\r b'), BASE, false],
    ['una marca BOM al principio', '﻿' + BASE, BASE, false],
    ['un renglón vacío de más al final', BASE + '\n', BASE, false],
    ['una copia que no es texto', null, BASE, false],
  ];
  for (const [caso, a, b, iguales] of CASOS) {
    it(caso + ' → ' + (iguales ? 'IGUALES' : 'DISTINTAS'), () => {
      assert.strictEqual(sonLaMismaCopia(a, b), iguales);
      assert.strictEqual(sonLaMismaCopia(b, a), iguales, 'la vara tiene que dar lo mismo en los dos sentidos');
    });
  }
});

describe('G100 · copiaIdentica', () => {
  it('pasa con una copia de verdad que solo difiere en el final de línea (AvisoModal del panel y de transporte)', () => {
    // Hoy guajirago-admin/src/AvisoModal.js sale en formato Unix y la de transporte en Windows: con una vara byte
    // a byte esta prueba estaría roja sobre el mismo código.
    copiaIdentica('guajirago-admin/src/AvisoModal.js', 'guajirago/src/AvisoModal.js');
  });

  it('acepta trozos ya sacados ({ nombre, texto }) y los mide con la misma vara', () => {
    copiaIdentica({ nombre: 'copia', texto: BASE.replace(/\n/g, '\r\n') }, { nombre: 'fuente', texto: BASE });
  });

  it('si se separan, dice cuál, en qué renglón, qué pone cada una y el porqué de quien la llama', () => {
    assert.throws(
      () => copiaIdentica({ nombre: 'la copia', texto: BASE.replace('2', '3') }, { nombre: 'la fuente', texto: BASE }, 'se copia ENTERA'),
      (e) => /la copia se separó de la fuente en el renglón 2/.test(e.message)
        && /la fuente: "const b = 2;"/.test(e.message) && /la copia: "const b = 3;"/.test(e.message)
        && /se copia ENTERA/.test(e.message),
    );
  });

  it('una marca BOM se ve en la queja (si no, las dos líneas saldrían iguales a la vista)', () => {
    assert.throws(
      () => copiaIdentica({ nombre: 'c', texto: '﻿' + BASE }, { nombre: 'f', texto: BASE }),
      (e) => /renglón 1/.test(e.message) && e.message.includes('\\uFEFF'),
    );
  });

  it('si a una le sobra un renglón, dice que a la otra ahí se le acaba el archivo', () => {
    assert.throws(
      () => copiaIdentica({ nombre: 'c', texto: 'const a = 1;\nconst b = 2;\nconst z = 9;' }, { nombre: 'f', texto: 'const a = 1;\nconst b = 2;' }),
      (e) => /renglón 3/.test(e.message) && /\(ahí se acaba el archivo\)/.test(e.message),
    );
  });

  it('si no encuentra el texto de un lado (un trozo que no se pudo sacar), se queja en vez de dar por buena la copia', () => {
    assert.throws(() => copiaIdentica({ nombre: 'el bloque', texto: null }, { nombre: 'f', texto: BASE }),
      /no encuentro el texto de «el bloque»/);
  });
});

describe('G100 · en pruebas/ todas las copias atadas usan la casa común', () => {
  it('hoy: ninguna comparación de copias con otra vara, y están las 38 de antes', () => {
    const r = M.lasComparaciones(null);
    const otras = r.lista.filter((c) => c.vara !== 'casa común (copiaIdentica)');
    assert.deepStrictEqual(otras.map((c) => c.archivo + ':' + c.renglon + ' [' + c.vara + ']'), [],
      '⛔ hay pruebas que comparan copias con su propia vara: usen copiaIdentica de pruebas/cargar.cjs');
    assert.ok(r.lista.length >= 38, 'esperaba al menos las 38 comparaciones de antes y veo ' + r.lista.length);
  });

  it('careo: con las pruebas de ANTES (d483d58) el medidor ve 38 comparaciones con tres varas', () => {
    const r = M.lasComparaciones(M.ANTES);
    assert.deepStrictEqual(r.porVara, { 'byte a byte': 23, 'sin el \\r\\n (final de línea)': 14, 'sin NINGÚN \\r': 1 });
    assert.strictEqual(r.archivos.length, 29);
  });
});

describe('G100 · el medidor no se puede ablandar: pruebas de mentira', () => {
  const GUION = "const { bloque } = require('../scripts/g.cjs');\n";
  const guionDeMentira = (r) => (r === 'scripts/g.cjs' ? "function bloque(t) { return t.replace(/\\r\\n/g, '\\n').slice(3); }\n" : null);
  const mide = (codigo) => M.comparacionesDe('pruebas/mentira.test.js', GUION + codigo, guionDeMentira);
  const MENTIRAS = [
    ['byte a byte, directo', "assert.strictEqual(leer(A), leer(B), 'x');", 'byte a byte'],
    ['quitando el \\r\\n con replace', "assert.strictEqual(leer(A).replace(/\\r\\n/g, '\\n'), leer(B).replace(/\\r\\n/g, '\\n'));", 'sin el \\r\\n (final de línea)'],
    ['quitando todo \\r con una función del archivo', "const q = (s) => s.replace(/\\r/g, '');\nassert.strictEqual(q(leer(A)), q(leer(B)));", 'sin NINGÚN \\r'],
    ['por variables', "const a = leer(A);\nconst b = leer(B);\nassert.strictEqual(a, b);", 'byte a byte'],
    ['por una lista destructurada', "const [a, b] = RUTAS.map((r) => leer(r));\nassert.strictEqual(b, a);", 'byte a byte'],
    ['por una lista con índice', "const t = RUTAS.map((f) => leer(f));\nassert.strictEqual(t[1], t[0]);", 'byte a byte'],
    ['por el bloque de un guion', "const app = bloque(leer(A));\nassert.strictEqual(bloque(leer(B)), app);", 'sin el \\r\\n (final de línea)'],
    ['con deepStrictEqual', "assert.deepStrictEqual(leer(A), leer(B));", 'byte a byte'],
  ];
  for (const [nombre, codigo, vara] of MENTIRAS) {
    it('la ve: ' + nombre, () => {
      const r = mide(codigo);
      assert.strictEqual(r.length, 1, 'el medidor no ve la comparación «' + nombre + '»: ' + JSON.stringify(r));
      assert.strictEqual(r[0].vara, vara);
    });
  }

  it('cuenta copiaIdentica como casa común, y no a su definición', () => {
    const r = mide("function copiaIdentica(a, b) {}\ncopiaIdentica(A, B);\ncopiaIdentica({ nombre: 'x', texto: bloque(leer(A)) }, B);");
    assert.deepStrictEqual(r.map((c) => c.vara), ['casa común (copiaIdentica)', 'casa común (copiaIdentica)']);
  });

  it('NO cuenta como copia comparar un VALOR sacado de un archivo, ni un número', () => {
    const r = mide("assert.strictEqual(M.leerEnv(leer(A)).LLAVE, M.leerEnv(leer(B)).LLAVE);\nconst r = M.medir();\nassert.strictEqual(r.total, 3);");
    assert.deepStrictEqual(r, []);
  });

  it('NO cuenta una comparación que solo está escrita dentro de un texto o de un comentario', () => {
    const r = mide("const s = 'assert.strictEqual(leer(A), leer(B));';\n// assert.strictEqual(leer(A), leer(B));\n/* copiaIdentica(A, B); */\nconst re = /['\"]x['\"]/;\nassert.strictEqual(leer(A), leer(B));");
    assert.strictEqual(r.length, 1, 'tenía que ver SOLO la de verdad (la última): ' + JSON.stringify(r));
  });

  it('la variable que vale es la declarada más cerca ANTES de la comparación (un `const app` por cada prueba)', () => {
    const r = mide("it('x', () => { const app = cargarDeLaApp(A); });\nit('y', () => { const app = leer(A);\nassert.strictEqual(leer(B), app); });");
    assert.strictEqual(r.length, 1);
  });

  it('lo que no es copia está nombrado, con su porqué', () => {
    for (const [archivo, lado, porque] of M.NO_SON_COPIAS) {
      assert.ok(archivo && lado && porque && porque.length > 20, 'una excepción sin su porqué: ' + archivo);
    }
  });
});
