/**
 * G43 · ¿CUÁL ES LA FOTO DE ESTA PERSONA? (28-sep-2026)
 *
 * La foto de perfil se guarda en la ficha `usuarios/{uid}` como `fotoConductor`, sea conductor
 * o pasajero (lo escriben el alta del conductor y «Mi perfil»). Cada pantalla la buscaba a su
 * manera, y el panel de Pasajeros buscaba `foto`, un campo que nadie escribe: la foto de un
 * pasajero no salía nunca. Ahora hay UNA regla, `fotoDe` en guajirago/src/fotoUsuario.js, con
 * copia idéntica en el panel.
 *
 *   1. La regla se EJECUTA (la de la app y la del panel) con fichas de mentira.
 *   2. La copia del panel es byte a byte la de la app.
 *   3. Las fotos del panel (Pasajeros y Conductores) se SACAN del archivo y se CORREN con una
 *      ficha de pasajero que solo tiene `fotoConductor`: tienen que enseñarla.
 *   4. La traducción de la ficha de App.js (datosDeLaFicha) se saca y se corre igual.
 *   5. Las pantallas que leen la ficha no leen `fotoConductor` ni `foto` a mano, y en las TRES
 *      apps `.fotoConductor` / `.foto` solo aparecen en los sitios contados: un archivo nuevo
 *      que lea la foto de una ficha tiene que pasar por aquí.
 *   6. El nombre guardado NO cambia: «Mi perfil» y el alta del conductor siguen escribiendo
 *      `fotoConductor` (es el contrato con los datos que ya hay).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo, cuerpoDeLaFuncion, copiaIdentica } = require('./cargar.cjs');

const APP = 'guajirago/src/fotoUsuario.js';
const PANEL = 'guajirago-admin/src/fotoUsuario.js';

// Las pantallas que leen la FICHA de una persona (usuarios/{uid}) para enseñar su foto.
const LEEN_LA_FICHA = [
  'guajirago/src/App.js',
  'guajirago/src/Home.js',
  'guajirago/src/MiPerfil.js',
  'guajirago/src/AppConductor.js',
  'guajirago-admin/src/Pasajeros.js',
  'guajirago-admin/src/Conductores.js',
];

const archivosDe = (carpeta) => fs.readdirSync(path.join(RAIZ, carpeta))
  .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js'))
  .map((f) => carpeta + '/' + f);
const TODOS = [
  ...archivosDe('guajirago/src'), ...archivosDe('guajirago-admin/src'), ...archivosDe('guajirago-aliados/src'),
  'guajirago/functions/index.js',
];

const cuenta = (texto, re) => (texto.match(re) || []).length;
const LEE_FOTO_CONDUCTOR = /\.fotoConductor\b|\[\s*['"`]fotoConductor['"`]\s*\]/g;
const LEE_FOTO = /\.foto\b|\[\s*['"`]foto['"`]\s*\]/g;

// Dónde aparece `.fotoConductor` hoy, y por qué está bien.
const NOMBRAN_FOTO_CONDUCTOR = {
  'guajirago/src/fotoUsuario.js': 1, // la regla misma
  'guajirago-admin/src/fotoUsuario.js': 1, // su copia
  'guajirago/src/MiPerfil.js': 1, // ESCRIBE la foto nueva: `actualizacion.fotoConductor = urlFoto`
};
// Dónde aparece `.foto` hoy: la regla, y objetos que NO son la ficha.
const NOMBRAN_FOTO = {
  'guajirago/src/fotoUsuario.js': 1,
  'guajirago-admin/src/fotoUsuario.js': 1,
  'guajirago/src/App.js': 1, // `f.foto`: lo que ya devolvió datosDeLaFicha (con fotoDe), no la ficha
  // (eran 6: G59 borró la ventanita muerta «¿Confirmas este viaje?», que nombraba dos)
  // (eran 4: G98 pasó las dos fotos del conductor a <FotoRedonda src={datosConductor?.foto}>, una vez cada una)
  'guajirago/src/Solicitar.js': 2, // `datosConductor.foto`: la copia del viaje (conductorFoto), no la ficha
};

/** Las fotos redondas del panel: `{COND ? ( <img src={SRC}`, sacadas del archivo. */
function fotosDelPanel(ruta, fuente = leer(ruta)) {
  const t = soloCodigo(fuente).replace(/\r\n/g, '\n');
  return [...t.matchAll(/\{([^{}?]+(?:\([^()]*\))?)\s*\?\s*\(\s*<img src=\{([^{}]+(?:\([^()]*\))?)\}/g)]
    .map((m) => ({ cond: m[1].trim(), src: m[2].trim() }));
}

/** Corre una expresión del archivo con la ficha puesta en su variable. */
function correr(expr, ficha, fotoDe) {
  const variable = (expr.match(/^(?:fotoDe\()?([A-Za-z_]\w*)/) || [])[1];
  // eslint-disable-next-line no-new-func
  return new Function(variable, 'fotoDe', 'return (' + expr + ');')(ficha, fotoDe);
}

const PASAJERO = { tipo: 'pasajero', nombre: 'Ana', fotoConductor: 'https://x/ana.jpg' };

describe('G43 · ¿cuál es la foto de esta persona?', () => {
  for (const ruta of [APP, PANEL]) {
    it('la regla elige bien (' + ruta.split('/')[0] + ')', () => {
      const { fotoDe } = cargarDeLaApp(ruta);
      assert.strictEqual(fotoDe({ fotoConductor: 'a.jpg' }), 'a.jpg', 'la foto se guarda como fotoConductor');
      assert.strictEqual(fotoDe({ foto: 'b.jpg' }), 'b.jpg', 'el nombre viejo `foto` se sigue leyendo');
      assert.strictEqual(fotoDe({ fotoConductor: 'a.jpg', foto: 'b.jpg' }), 'a.jpg', 'si están los dos, gana la que se escribe hoy');
      assert.strictEqual(fotoDe({ fotoConductor: '', foto: 'b.jpg' }), 'b.jpg');
      assert.strictEqual(fotoDe({}), null);
      assert.strictEqual(fotoDe(null), null);
      assert.strictEqual(fotoDe(undefined), null);
    });
  }

  it('la copia del panel es idéntica a la de la app', () => {
    copiaIdentica(PANEL, APP, PANEL + ' se separó de ' + APP + ': copia la de la app tal cual.');
  });

  for (const [ruta, cuantas] of [['guajirago-admin/src/Pasajeros.js', 1], ['guajirago-admin/src/Conductores.js', 2]]) {
    it('EL QUE MUERDE · ' + ruta + ' enseña la foto de una ficha que solo tiene fotoConductor (corrido)', () => {
      const { fotoDe } = cargarDeLaApp(PANEL);
      const fotos = fotosDelPanel(ruta);
      assert.strictEqual(fotos.length, cuantas, ruta + ': esperaba ' + cuantas + ' foto(s) redonda(s), hay ' + fotos.length);
      for (const { cond, src } of fotos) {
        assert.ok(correr(cond, PASAJERO, fotoDe), '⛔ ' + ruta + ' no enseña la foto guardada: `' + cond + '` da vacío');
        assert.strictEqual(correr(src, PASAJERO, fotoDe), PASAJERO.fotoConductor, ruta + ': la imagen no es la foto guardada');
        assert.ok(!correr(cond, { nombre: 'Sin foto' }, fotoDe), ruta + ': sin foto tiene que salir el muñeco');
      }
    });
  }

  it('App.js · datosDeLaFicha saca la foto con la regla (corrido)', () => {
    const t = soloCodigo(leer('guajirago/src/App.js')).replace(/\r\n/g, '\n');
    const d = t.indexOf('function datosDeLaFicha(');
    assert.ok(d >= 0, 'no encuentro datosDeLaFicha en App.js');
    const fuente = t.slice(d, cuerpoDeLaFuncion(t, d).fin + 1);
    const { fotoDe } = cargarDeLaApp(APP);
    const { telefonoDe } = cargarDeLaApp('guajirago/src/telefonoUsuario.js');
    // eslint-disable-next-line no-new-func
    const datosDeLaFicha = new Function('fotoDe', 'telefonoDe', fuente + '\nreturn datosDeLaFicha;')(fotoDe, telefonoDe);
    assert.strictEqual(datosDeLaFicha(PASAJERO).foto, PASAJERO.fotoConductor);
    assert.strictEqual(datosDeLaFicha({ foto: 'vieja.jpg' }).foto, 'vieja.jpg');
    assert.strictEqual(datosDeLaFicha({}).foto, null);
  });

  for (const ruta of LEEN_LA_FICHA) {
    it(ruta + ' lee la foto de la ficha solo con fotoDe', () => {
      const codigo = soloCodigo(leer(ruta));
      assert.ok(/\bfotoDe\(/.test(codigo), ruta + ' no usa fotoDe');
      assert.ok(/import \{[^}]*\bfotoDe\b[^}]*\} from '\.\/fotoUsuario'/.test(codigo),
        ruta + ' no importa fotoDe de ./fotoUsuario');
      // Leer la ficha a mano: `.data().fotoConductor`, `d.fotoConductor || d.foto`, `p.foto ?`…
      const aMano = codigo.match(/\.data\(\)\s*\.\s*(fotoConductor|foto)\b|\b\w+\.fotoConductor\s*(\|\||\?|\))|\b(p|c|d|u|f|ficha|conductorDelMes)\.foto\s*(\?|\|\|)/);
      assert.ok(!aMano, ruta + ' lee la foto de la ficha a mano: `' + (aMano && aMano[0]) + '` — usa fotoDe');
    });
  }

  it('`.fotoConductor` solo aparece donde ya se sabe (tres apps y funciones)', () => {
    const hoy = {};
    for (const ruta of TODOS) { const n = cuenta(soloCodigo(leer(ruta)), LEE_FOTO_CONDUCTOR); if (n) hoy[ruta] = n; }
    assert.deepStrictEqual(hoy, NOMBRAN_FOTO_CONDUCTOR,
      'cambió quién nombra `.fotoConductor`. Si lee la ficha de una persona, usa fotoDe; si no, súmalo a NOMBRAN_FOTO_CONDUCTOR diciendo por qué.');
  });

  it('`.foto` solo aparece donde ya se sabe (tres apps y funciones)', () => {
    const hoy = {};
    for (const ruta of TODOS) { const n = cuenta(soloCodigo(leer(ruta)), LEE_FOTO); if (n) hoy[ruta] = n; }
    assert.deepStrictEqual(hoy, NOMBRAN_FOTO,
      'cambió quién nombra `.foto`. Si lee la ficha de una persona, usa fotoDe; si es otra cosa, súmalo a NOMBRAN_FOTO diciendo por qué.');
  });

  it('el nombre guardado no cambia: Mi perfil y el alta del conductor escriben `fotoConductor`', () => {
    assert.match(soloCodigo(leer('guajirago/src/MiPerfil.js')), /actualizacion\.fotoConductor = urlFoto;/);
    assert.match(soloCodigo(leer('guajirago/src/App.js')), /\bfotoConductor: urlFotoConductor,/);
  });
});
