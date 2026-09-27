// ═══════════════════════════════════════════════════════════════════════════
//  ALIADOS AVISA CUANDO NO PODRÁ TRABAJAR SIN SEÑAL · 27-sep-2026
//
//  Aliados le pide al navegador guardar los datos en el aparato para seguir trabajando sin
//  internet. Hasta hoy, si el navegador decía que no —por ejemplo, con la app abierta en dos
//  pestañas—, `enableIndexedDbPersistence(db).catch(() => {})` se lo tragaba y el negocio creía
//  que podía trabajar sin señal. Anexo F del plan: «que el sin señal que ya está puesto DIGA si
//  falló». Ahora la respuesta se guarda y sale una ventanita.
//
//  Se prueba EJECUTANDO lo que dice cada caso (sinSenal.js) y por FORMA el cableado: que el
//  arranque no se trague la respuesta, que la ventanita esté en el arranque (cualquier pantalla)
//  y que sea LA MISMA ventanita de transporte y del panel, copia atada.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');

const A = 'guajirago-aliados/src/';
const S = cargarDeLaApp(A + 'sinSenal.js');

describe('ALIADOS SIN SEÑAL · qué se le dice al negocio', () => {
  it('si el aparato sí puede trabajar sin señal, no sale nada', () => {
    assert.strictEqual(S.avisoSinSenal({ ok: true }), null);
    assert.strictEqual(S.avisoSinSenal(null), null);
  });

  it('con la app abierta en otra pestaña, lo dice y dice qué hacer', () => {
    const a = S.avisoSinSenal({ ok: false, codigo: 'failed-precondition' });
    assert.match(a.texto, /otra pestaña/);
    assert.match(a.texto, /Ciérrala/);
  });

  it('si el navegador no lo permite, o falla otra cosa, también avisa (nunca se calla)', () => {
    assert.match(S.avisoSinSenal({ ok: false, codigo: 'unimplemented' }).texto, /navegador/);
    assert.ok(S.avisoSinSenal({ ok: false, codigo: 'cualquier-otra' }).texto.length > 20);
    for (const c of ['failed-precondition', 'unimplemented', 'x']) {
      const a = S.avisoSinSenal({ ok: false, codigo: c });
      assert.ok(a.titulo && a.texto && a.icono, 'la ventanita lleva ícono, título y texto');
      assert.ok(!/\b(error|failed|browser|offline|persistence)\b/i.test(a.titulo + ' ' + a.texto), '⛔ palabras técnicas o en inglés: ' + a.texto);
    }
  });
});

describe('ALIADOS SIN SEÑAL · el cableado', () => {
  it('el arranque ya no se traga la respuesta: la guarda en trabajoSinSenal', () => {
    const t = soloCodigo(leer(A + 'firebase.js'));
    assert.ok(!/enableIndexedDbPersistence\(db\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/.test(t), '⛔ vuelve el catch mudo');
    assert.match(t, /export const trabajoSinSenal = enableIndexedDbPersistence\(db\)\s*\.then\(\(\) => \(\{ ok: true \}\)\)\s*\.catch\(\(e\) => \(\{ ok: false, codigo:/);
  });

  it('la ventanita está en el arranque, al lado del cartel, y usa la respuesta y el texto de sinSenal', () => {
    const idx = soloCodigo(leer(A + 'index.js'));
    assert.match(idx, /import AvisoSinSenal from '\.\/AvisoSinSenal'/);
    assert.match(idx, /<CartelAmbiente \/>\s*<AvisoSinSenal \/>/, '⛔ la ventanita no está en el arranque');
    const c = soloCodigo(leer(A + 'AvisoSinSenal.js'));
    assert.match(c, /trabajoSinSenal\.then\(\(r\) => \{ if \(vivo\) setAviso\(avisoSinSenal\(r\)\); \}\)/);
    assert.match(c, /<AvisoModal aviso=\{aviso\} onCerrar=\{\(\) => setAviso\(null\)\} \/>/);
  });

  it('es LA MISMA ventanita de transporte y del panel (copia atada, no una nueva)', () => {
    const quitaCR = (s) => s.replace(/\r/g, '');
    assert.strictEqual(quitaCR(leer(A + 'AvisoModal.js')), quitaCR(leer('guajirago/src/AvisoModal.js')),
      '⛔ la ventanita de aliados se separó de la de transporte: se cambia en los tres sitios');
  });
});
