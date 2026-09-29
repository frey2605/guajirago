/**
 * G41 · EL NÚMERO PARA WHATSAPP SALE DE UN SOLO SITIO (28-sep-2026)
 *
 * El enlace wa.me/57… se armaba en 8 sitios de las tres apps, de tres formas que no daban lo
 * mismo: «pegar 57 si no empieza por 57» (panel), «57 + las 10 últimas cifras» (app y aliados)
 * y «57 a todo» (Codigos.js del panel). Ahora hay UNA pieza, `numeroWhatsApp` y `enlaceWhatsApp`
 * en guajirago/src/telefonoValido.js —la misma regla de «¿este teléfono sirve?» de G10—, con
 * copia idéntica en el panel y en aliados. Esta prueba:
 *
 *   1. EJECUTA la pieza con teléfonos de mentira;
 *   2. exige que las copias del panel y de aliados sean byte a byte la de la app;
 *   3. saca los 6 botones de sus archivos (con el recorrido de scripts/medir-numero-whatsapp.cjs,
 *      que vive una sola vez) y los CORRE: todos abren el mismo número, y con un teléfono que no
 *      sirve ninguno abre un número inventado (no pinta el enlace, avisa, o abre sin destinatario);
 *   4. nadie en las tres apps ni en las funciones escribe «wa.me» a mano fuera de la pieza.
 * Los 2 botones de emergencia los corre pruebas/contactoEmergencia.test.js.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const { SITIOS, tablaDe } = require('../scripts/medir-numero-whatsapp.cjs');

const APP = 'guajirago/src/telefonoValido.js';
const COPIAS = ['guajirago-admin/src/telefonoValido.js', 'guajirago-aliados/src/telefonoValido.js'];
const { numeroWhatsApp, enlaceWhatsApp } = cargarDeLaApp(APP);

describe('G41 · la pieza: el número para WhatsApp', () => {
  const CASOS = [
    ['3001234567', '573001234567'],
    ['300 123 4567', '573001234567'],
    ['+57 300 123 4567', '573001234567'],
    ['573001234567', '573001234567'],
    ['5712345678', '575712345678'], // 10 cifras que empiezan por 57: es el número, le falta el indicativo
    ['300 123 45', ''],
    ['03001234567', ''],
    ['abc', ''],
    ['', ''],
    [null, ''],
    [undefined, ''],
  ];
  for (const [dado, sale] of CASOS) {
    it('«' + dado + '» → «' + sale + '»', () => assert.strictEqual(numeroWhatsApp(dado), sale));
  }

  it('el enlace: con número bueno va a él; sin número y con mensaje, sin destinatario; sin nada, no hay enlace', () => {
    assert.strictEqual(enlaceWhatsApp('300 123 4567'), 'https://wa.me/573001234567');
    assert.strictEqual(enlaceWhatsApp('3001234567', 'Hola & chao'), 'https://wa.me/573001234567?text=Hola%20%26%20chao');
    assert.strictEqual(enlaceWhatsApp('300 123 45', 'Hola'), 'https://wa.me/?text=Hola');
    assert.strictEqual(enlaceWhatsApp('300 123 45'), '');
    assert.strictEqual(enlaceWhatsApp('', ''), '');
  });
});

describe('G41 · las copias del panel y de aliados son la misma pieza', () => {
  for (const copia of COPIAS) {
    it(copia + ' es byte a byte ' + APP, () => {
      assert.strictEqual(leer(copia), leer(APP),
        copia + ' se separó de ' + APP + ': se cambia allá primero y se copia IGUAL (son repos aparte y no pueden importar)');
    });
  }
});

describe('G41 · los 6 botones de WhatsApp, corridos', () => {
  const MUESTRAS = ['3001234567', '+57 300 123 4567', '573001234567', '5712345678', '300 123 45', '03001234567', 'abc'];
  const NUMERO = ['573001234567', '573001234567', '573001234567', '575712345678', null, null, null];
  // Qué hace cada botón cuando el teléfono NO sirve. Ninguno abre un número inventado ni calla.
  const SIN_NUMERO = {
    'app · Turismo (WhatsApp de la agencia)': '(sin enlace)', // no se pinta: no hay mensaje que mandar
    'aliados · pedido a domicilio': '(sin número)', // abre WhatsApp sin destinatario, con el mensaje escrito
    'aliados · reserva de turismo': '(sin número)',
    'panel · Restaurantes': '(no abre: avisa)', // ventanita con el motivo
    'panel · Turismo': '(no abre: avisa)',
    'panel · Codigos (nadie la llama)': '(sin número)',
  };

  it('el medidor recorre los 6 botones que hay', () => {
    assert.deepStrictEqual(SITIOS.map((s) => s[0]).sort(), Object.keys(SIN_NUMERO).sort());
  });

  const { tabla } = tablaDe(MUESTRAS);
  for (const nombre of Object.keys(SIN_NUMERO)) {
    it(nombre + ': abre el número de la pieza, o nada inventado', () => {
      const esperado = NUMERO.map((n) => n || SIN_NUMERO[nombre]);
      assert.deepStrictEqual(tabla[nombre], esperado,
        nombre + ' no abre lo que dice la pieza. Teléfonos: ' + MUESTRAS.join(' | '));
    });
  }
});

describe('G41 · nadie arma el enlace de WhatsApp a mano', () => {
  const archivosDe = (carpeta) => fs.readdirSync(path.join(RAIZ, carpeta))
    .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js')).map((f) => carpeta + '/' + f);
  const TODOS = [
    ...archivosDe('guajirago/src'), ...archivosDe('guajirago-admin/src'), ...archivosDe('guajirago-aliados/src'),
    'guajirago/functions/index.js',
  ];
  const ENLACE = /wa\.me|api\.whatsapp\.com|whatsapp:\/\//i;

  // Los 2 botones de emergencia escriben su enlace a la vista a propósito: los amarres de
  // pruebas/amarres.test.js y pruebas/ubicacionDeAhora.test.js vigilan ahí que lleve ESE texto
  // (encodeURIComponent del mensaje armado). Lo que no pueden es armar el NÚMERO: sale de la pieza.
  const EMERGENCIA = ['guajirago/src/Seguridad.js', 'guajirago/src/Solicitar.js'];

  it('«wa.me» solo aparece en la pieza, sus dos copias y los 2 botones de emergencia', () => {
    const con = TODOS.filter((f) => ENLACE.test(soloCodigo(leer(f))));
    assert.deepStrictEqual(con.sort(), [APP, ...COPIAS, ...EMERGENCIA].sort(),
      'un archivo arma el enlace de WhatsApp a mano: que use enlaceWhatsApp de telefonoValido.js');
  });

  for (const f of EMERGENCIA) {
    it(f + ': el número del enlace sale de numeroWhatsApp, no se arma a mano', () => {
      const t = soloCodigo(leer(f));
      const plantillas = t.match(/`https:\/\/wa\.me\/[^`]*`/g) || [];
      assert.ok(plantillas.length >= 1, f + ' ya no arma el enlace a la vista: mira los amarres del botón de emergencia');
      for (const p of plantillas) {
        const m = p.match(/^`https:\/\/wa\.me\/(?:\$\{(\w+)\})?\?text=/);
        assert.ok(m, f + ': el enlace «' + p.slice(0, 40) + '…» pone algo a mano delante del número (¿un 57?)');
        if (m[1]) {
          assert.match(t, new RegExp('const\\s+' + m[1] + '\\s*=\\s*numeroWhatsApp\\('),
            f + ': «' + m[1] + '» no sale de numeroWhatsApp');
          assert.strictEqual((t.match(new RegExp('\\b' + m[1] + '\\s*=[^=]', 'g')) || []).length, 1,
            f + ': a «' + m[1] + '» se le vuelve a asignar algo después de sacarlo de la pieza');
        }
      }
    });
  }

  it('quien usa la pieza la importa de ./telefonoValido', () => {
    for (const f of TODOS) {
      const t = soloCodigo(leer(f));
      if (!/\b(enlaceWhatsApp|numeroWhatsApp)\(/.test(t) || f.endsWith('/telefonoValido.js')) continue;
      assert.match(t, /import\s*\{[^}]*\b(enlaceWhatsApp|numeroWhatsApp)\b[^}]*\}\s*from\s*'\.\/telefonoValido'/, f + ' no importa la pieza');
    }
  });
});
