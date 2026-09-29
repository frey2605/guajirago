// 📧 G75 (29-sep-2026) · EL CORREO DE SOPORTE sale de UNA constante, y los Términos y la Política de privacidad
// comparten su esqueleto (PaginaLegal.js) sin que cambie ni una letra de lo que se ve.
//
// Antes: el correo tenía su constante en AyudaSoporte.js y aun así estaba escrito a mano en cuatro textos; y las dos
// páginas legales dibujaban cada una su cabecera, su marco y el estilo de sus secciones.
//
// Esta prueba NO lee textos sueltos: con `scripts/medir-soporte-legal.cjs` COMPILA las tres pantallas (Términos,
// Política y Ayuda) con sus piezas de verdad, las PINTA con React y carea su HTML con el del commit de antes del
// arreglo (2ac31fc). Y cambia la constante para comprobar que las cuatro veces que se dice el correo salen de ella.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { medir, CORREO } = require('../scripts/medir-soporte-legal.cjs');
const { leer } = require('./cargar.cjs');

const ANTES = '2ac31fc'; // el último commit con el correo a mano y el esqueleto copiado
const TERMINOS = 'guajirago/src/TerminosCondiciones.js';
const POLITICA = 'guajirago/src/PoliticaPrivacidad.js';
const PIEZA_CORREO = 'guajirago/src/correoSoporte.js';

describe('G75 · el correo de soporte y las páginas legales salen de UNA pieza', () => {
  const hoy = medir(null);
  const antes = medir(ANTES);

  it('el correo está escrito UNA vez en las tres apps: en su constante', () => {
    assert.deepStrictEqual(hoy.constantes, ['correoSoporte.js:7'], 'constantes con el correo: ' + hoy.constantes.join(', '));
    assert.deepStrictEqual(hoy.aMano, [], 'el correo está escrito a mano en: ' + hoy.aMano.join(', '));
    assert.strictEqual(antes.aMano.length, 4, 'el careo: antes eran cuatro a mano');
  });

  it('el estilo de las secciones está dibujado una sola vez, en PaginaLegal.js', () => {
    assert.deepStrictEqual(hoy.seccionesAMano, ['PaginaLegal.js'], 'dibujado en: ' + hoy.seccionesAMano.join(', '));
    assert.strictEqual(antes.seccionesAMano.length, 2, 'el careo: antes eran dos páginas');
  });

  it('las tres pantallas se ven EXACTAMENTE como antes (el texto legal no cambió ni una letra)', () => {
    for (const [i, p] of hoy.pantallas.entries()) {
      assert.strictEqual(p.texto, antes.pantallas[i].texto, p.nombre + ': cambió el texto que se lee');
      assert.strictEqual(p.html, antes.pantallas[i].html, p.nombre + ': cambió el HTML (un estilo o una etiqueta)');
    }
    assert.strictEqual(hoy.huellaPreguntas, antes.huellaPreguntas, 'cambiaron las preguntas de la Ayuda');
    assert.deepStrictEqual(hoy.pantallas.map((p) => p.dicenElCorreo), [1, 2, 1]);
    assert.strictEqual(hoy.preguntasConCorreo, 1);
  });

  it('las cuatro veces que se dice el correo salen de la constante: si cambia, cambian todas', () => {
    const pieza = leer(PIEZA_CORREO);
    const otro = medir(null, { [PIEZA_CORREO]: pieza.split(CORREO).join('ayuda@otro.co') });
    for (const p of otro.pantallas) {
      assert.ok(!p.texto.includes(CORREO), p.nombre + ': sigue diciendo ' + CORREO + ' aunque la constante cambió');
    }
    assert.deepStrictEqual(otro.pantallas.map((p) => p.texto.split('ayuda@otro.co').length - 1), [1, 2, 1]);
    assert.strictEqual(otro.preguntasConCorreo, 0, 'la respuesta de la Ayuda no sale de la constante');
  });

  it('el medidor no se puede ablandar', () => {
    const t = leer(TERMINOS);
    const p = leer(POLITICA);
    // 1 · los Términos vuelven a escribir el correo a mano
    const aMano = medir(null, { [TERMINOS]: t.replace('${CORREO_SOPORTE}', CORREO).replace(/`Para cualquier duda[^`]*`/, (s) => "'" + s.slice(1, -1) + "'") });
    assert.ok(aMano.aMano.length === 1 && aMano.aMano[0].startsWith('TerminosCondiciones.js:'), 'no vio el correo a mano: ' + aMano.aMano.join(', '));
    // 2 · la Política vuelve a dibujar el estilo de sus secciones
    const copia = medir(null, { [POLITICA]: p.replace("import PaginaLegal, { seccion } from './PaginaLegal';", "import PaginaLegal from './PaginaLegal';\nconst seccion = (titulo, texto) => (<div><h3>{titulo}</h3><p>{texto}</p></div>);") });
    assert.deepStrictEqual(copia.seccionesAMano.sort(), ['PaginaLegal.js', 'PoliticaPrivacidad.js']);
    assert.notStrictEqual(copia.pantallas[1].html, hoy.pantallas[1].html, 'no vio que la Política ya no se ve igual');
    // 3 · una segunda constante en otra app
    const otra = medir(null, { 'guajirago-aliados/src/Contacto.js': "export const CORREO_SOPORTE = '" + CORREO + "';\n" });
    assert.deepStrictEqual(otra.constantes, ['correoSoporte.js:7', 'guajirago-aliados/src/Contacto.js:1']);
    // 4 · una letra del texto legal cambia
    const letra = medir(null, { [TERMINOS]: t.replace('en su totalidad', 'en su totalidad.') });
    assert.notStrictEqual(letra.pantallas[0].texto, hoy.pantallas[0].texto, 'no vio que cambió el texto de los Términos');
  });
});
