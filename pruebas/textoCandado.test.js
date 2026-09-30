// ═══════════════════════════════════════════════════════════════════════════
//  G76 (29-sep-2026) · EL CANDADO NO TIENE TEXTO DE FALLO PROPIO
//
//  LA LEY DEL BOTÓN: el motivo de un fallo NO lo calcula el candado, lo da `motivoDeRechazo` de avisoRechazo.js.
//  candado.js guardaba «No se pudo completar. Revisa la señal y vuelve a intentar.» para cuando nadie le pasaba
//  `traducir` y para un `{ ok: false }` sin motivo. Esta prueba EJECUTA el candado (el de las tres apps es el mismo,
//  byte a byte) con scripts/medir-texto-candado.cjs y exige:
//    · cero textos de fallo escritos en el candado, salvo el del tope de 20 s;
//    · que en los siete casos lo que dice salga de la pieza única;
//    · que el texto del tope siga idéntico (es ley: no dice «falló» porque no se sabe);
//    · y que ninguna acción de las tres apps devuelva { ok: false } sin su motivo.
//  Y se prueba a sí misma: con el candado de ANTES (c50649f) y con candados de mentira, el medidor se queja.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const M = require('../scripts/medir-texto-candado.cjs');

const LEY_DEL_TOPE = 'No se pudo confirmar. Revisa si quedó hecho antes de volver a intentar.';

describe('G76 · el candado no tiene texto de fallo propio', () => {
  it('hoy: cero textos propios, los siete casos salen de la pieza única, el tope igual y las tres copias iguales', async () => {
    const r = await M.medir();
    assert.deepStrictEqual(r.textosPropios, [], '⛔ el candado volvió a escribir su propio texto de fallo');
    for (const c of r.casos) assert.ok(c.bien, '⛔ ' + c.caso + ': dice ' + JSON.stringify(c.dice) + ' y debería ' + JSON.stringify(c.deberia));
    assert.strictEqual(r.casos.length, 7);
    assert.ok(r.topeIgual, '⛔ cambió el texto del tope de 20 s, que es ley');
    assert.strictEqual(M.TOPE_LEY, LEY_DEL_TOPE);
    assert.deepStrictEqual(r.apps.sinMotivo, [], '⛔ una acción devuelve { ok: false } sin decir por qué');
    assert.ok(r.apps.total >= 7, 'se contaron muy pocas acciones con { ok: false }: ¿cambió la forma de escribirlas?');
    assert.ok(r.copias && r.copias.length === 2 && r.copias.every((c) => c.igual), '⛔ el candado del panel o de aliados se separó del de transporte');
  });

  it('el candado de las tres apps dice el tope con la ley, letra por letra', () => {
    for (const app of ['guajirago', 'guajirago-admin', 'guajirago-aliados']) {
      assert.ok(leer(app + '/src/candado.js').includes("export const NO_CONFIRMADO = '" + LEY_DEL_TOPE + "';"), app + ': el texto del tope cambió');
    }
  });

  it('careo: con el candado de ANTES (c50649f) el medidor ve el gemelo', async () => {
    const r = await M.medir({ commit: 'c50649f' });
    assert.strictEqual(r.textosPropios.length, 3);
    assert.strictEqual(r.casosQueNoSalenDeLaPieza, 4);
    assert.ok(r.topeIgual);
  });

  it('el medidor no se deja engañar: candados de mentira', async () => {
    const bueno = leer('guajirago/src/candado.js');
    const cambiar = (de, a) => { assert.strictEqual(bueno.split(de).length, 2, 'no calza: ' + de); return bueno.replace(de, a); };
    const mentiras = [
      ['el texto de «revisa la señal» de vuelta en la negativa', cambiar('error: v.error || m.texto', "error: v.error || 'No se pudo completar. Revisa la señal y vuelve a intentar.'")],
      ['un traducir por defecto propio', cambiar('traducir = motivoDeRechazo }', "traducir = (e, a) => ({ clave: 'otro', titulo: 'No se pudo ' + a, texto: 'Revisa la señal.' }) }")],
      ['el título de la negativa escrito aquí', cambiar('titulo: m.titulo, error: v.error', "titulo: 'No se pudo ' + (accion || 'completar'), error: v.error")],
      ['el tope dice «falló»', cambiar(LEY_DEL_TOPE, 'Falló. Vuelve a intentar.')],
    ];
    for (const [n, fuente] of mentiras) {
      const r = await M.medir({ fuente });
      const seQueja = r.textosPropios.length > 0 || r.casosMal > 0 || !r.topeIgual;
      assert.ok(seQueja, '⛔ el medidor no vio: ' + n);
    }
  });
});
