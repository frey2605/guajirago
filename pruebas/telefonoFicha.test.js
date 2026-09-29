/**
 * G08 · ¿CUÁL ES EL TELÉFONO DE ESTA PERSONA? (28-sep-2026)
 *
 * La ficha `usuarios/{uid}` tiene dos campos: `celular` (el número del REGISTRO, que no
 * se toca después) y `telefono` (el de ahora, si lo cambió). Cada pantalla los leía en
 * distinto orden. Ahora hay UNA regla, `telefonoDe` en guajirago/src/telefonoUsuario.js,
 * con copia idéntica en el panel.
 *
 *   1. La regla se EJECUTA (la de la app y la del panel) con fichas de mentira.
 *   2. La copia del panel es byte a byte la de la app.
 *   3. Las pantallas que leen la ficha no leen ninguno de los dos campos a mano: ni con
 *      punto, ni con corchetes, ni desarmando el objeto.
 *   4. En las TRES apps y en las funciones, `.celular` solo se lee donde ya se sabe, y
 *      `.telefono` solo en los archivos contados (negocios, agencias, pedidos): un
 *      archivo nuevo que lea el teléfono tiene que pasar por aquí.
 *   5. `celular` no lo escribe nadie más que el registro: el servidor lo usa para no dar
 *      dos veces el crédito de bienvenida (functions: celularDisponible). Si «Mi perfil»
 *      lo sobrescribiera, el número del registro quedaría libre para otra cuenta.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo, sinTextos } = require('./cargar.cjs');

const APP = 'guajirago/src/telefonoUsuario.js';
const PANEL = 'guajirago-admin/src/telefonoUsuario.js';

// Las pantallas que leen la FICHA de una persona (usuarios/{uid}) para enseñar o usar su teléfono.
const LEEN_LA_FICHA = [
  'guajirago/src/Login.js',
  'guajirago/src/App.js',
  'guajirago/src/MiPerfil.js',
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
const ES_CELULAR = /\.celular\b|\[\s*['"`]celular['"`]\s*\]/g;
const ES_TELEFONO = /\.telefono\b|\[\s*['"`]telefono['"`]\s*\]/g;
// `celular` como llave de un objeto (`celular:`, `'celular':`), abreviado (`{ celular }`,
// `, celular,`) o calculado (`['celular']`). También casa argumentos y props: por eso se
// CUENTA por archivo contra lo que hay hoy, y cualquier cambio obliga a mirarlo.
const NOMBRA_CELULAR = /(['"]?)celular\1\s*:|\[\s*['"`]celular['"`]\s*\]|[{,(]\s*celular\s*[,})]/g;

// Dónde se lee `.celular` hoy, y por qué está bien.
const LEEN_CELULAR = {
  'guajirago/src/telefonoUsuario.js': 1, // la regla misma
  'guajirago-admin/src/telefonoUsuario.js': 1, // su copia
  'guajirago/functions/index.js': 1, // celularDisponible: el número que manda quien se registra
};
// Dónde se lee `.telefono` hoy: la regla, y el teléfono de NEGOCIOS, AGENCIAS y PEDIDOS, que no es la ficha.
const LEEN_TELEFONO = {
  'guajirago/src/telefonoUsuario.js': 1,
  'guajirago-admin/src/telefonoUsuario.js': 1,
  'guajirago/src/Turismo.js': 2, // la agencia
  'guajirago-admin/src/AliadosPendientes.js': 1, // el negocio que pide entrar
  'guajirago-admin/src/Restaurantes.js': 4, // el restaurante
  'guajirago-admin/src/Turismo.js': 4, // la agencia
  'guajirago-aliados/src/HistorialDomicilios.js': 2, // el pedido
  'guajirago-aliados/src/PedidosDomicilio.js': 3, // el pedido
  'guajirago-aliados/src/PerfilAgencia.js': 2, // la agencia
  'guajirago-aliados/src/ReservasTurismo.js': 4, // la reserva
};
// Dónde se nombra `celular` hoy. Login: el registro (setDoc de la ficha), la pregunta a
// celularDisponible y el campo del formulario. App.js: la copia LOCAL del teléfono
// (guardarLocal) y la prop del alta del conductor. Funciones: el dato de celularDisponible.
// G42 (28-sep-2026): Login baja de 5 a 4 — el celular se limpia UNA vez (`celularDiezCifras(celular)`) y
// lo que se le entrega a la app al entrar es ese número limpio (`celularLimpio`), ya no el texto crudo.
const NOMBRAN_CELULAR = {
  'guajirago/src/Login.js': 4,
  'guajirago/src/App.js': 6,
  'guajirago/functions/index.js': 1,
};

describe('G08 · ¿cuál es el teléfono de esta persona?', () => {
  for (const ruta of [APP, PANEL]) {
    it('la regla elige bien (' + ruta.split('/')[0] + ')', () => {
      const { telefonoDe } = cargarDeLaApp(ruta);
      // Con los dos distintos gana `telefono`: solo lo escribe quien cambió el número DESPUÉS.
      assert.strictEqual(telefonoDe({ celular: '3001111111', telefono: '3002222222' }), '3002222222');
      assert.strictEqual(telefonoDe({ celular: '3001111111' }), '3001111111');
      assert.strictEqual(telefonoDe({ telefono: '3002222222' }), '3002222222');
      assert.strictEqual(telefonoDe({ celular: '3001111111', telefono: '' }), '3001111111');
      assert.strictEqual(telefonoDe({}), '');
      assert.strictEqual(telefonoDe(null), '');
      assert.strictEqual(telefonoDe(undefined), '');
    });
  }

  it('la copia del panel es idéntica a la de la app', () => {
    assert.strictEqual(leer(PANEL), leer(APP), PANEL + ' se separó de ' + APP + ': copia la de la app tal cual.');
  });

  for (const ruta of LEEN_LA_FICHA) {
    it(ruta + ' lee el teléfono solo con telefonoDe', () => {
      const codigo = soloCodigo(leer(ruta));
      const limpio = sinTextos(codigo);
      assert.strictEqual(cuenta(codigo, ES_TELEFONO) + cuenta(codigo, ES_CELULAR), 0,
        ruta + ' lee `telefono` o `celular` a mano: tiene que pasar por telefonoDe');
      const desarma = limpio.match(/\{[^{}]*\b(celular|telefono)\b[^{}]*\}\s*=(?![=>])/);
      assert.ok(!desarma, ruta + ' desarma la ficha para sacar el teléfono a mano: ' + (desarma && desarma[0]));
      assert.ok(/\btelefonoDe\(/.test(limpio), ruta + ' no usa telefonoDe');
      assert.ok(/import \{[^}]*\btelefonoDe\b[^}]*\} from '\.\/telefonoUsuario'/.test(codigo),
        ruta + ' no importa telefonoDe de ./telefonoUsuario');
    });
  }

  it('`.celular` solo se lee donde ya se sabe (tres apps y funciones)', () => {
    const hoy = {};
    for (const ruta of TODOS) { const n = cuenta(soloCodigo(leer(ruta)), ES_CELULAR); if (n) hoy[ruta] = n; }
    assert.deepStrictEqual(hoy, LEEN_CELULAR,
      'cambió quién lee `.celular`. Si es la ficha de una persona, usa telefonoDe; si no, súmalo a LEEN_CELULAR diciendo por qué.');
  });

  it('`.telefono` solo se lee en los archivos contados (tres apps y funciones)', () => {
    const hoy = {};
    for (const ruta of TODOS) { const n = cuenta(soloCodigo(leer(ruta)), ES_TELEFONO); if (n) hoy[ruta] = n; }
    assert.deepStrictEqual(hoy, LEEN_TELEFONO,
      'cambió quién lee `.telefono`. Si es la ficha de una persona, usa telefonoDe; si es un negocio, una agencia o un pedido, súmalo a LEEN_TELEFONO.');
  });

  it('`celular` no lo escribe nadie más que el registro', () => {
    const hoy = {};
    for (const ruta of TODOS) { const n = cuenta(soloCodigo(leer(ruta)), NOMBRA_CELULAR); if (n) hoy[ruta] = n; }
    assert.deepStrictEqual(hoy, NOMBRAN_CELULAR,
      'cambió quién nombra `celular`. Es el número del REGISTRO y no se sobrescribe: si se cambia el teléfono, se escribe `telefono`.');
    // Y el registro sí lo escribe: sin él, celularDisponible no tendría con qué comparar.
    const login = soloCodigo(leer('guajirago/src/Login.js'));
    const i = login.search(/await setDoc\(doc\(db, 'usuarios', cuentaCreada\.user\.uid\), \{/);
    assert.ok(i >= 0, 'no encuentro la escritura de la ficha en el registro');
    assert.match(login.slice(i, login.indexOf('});', i)), /\bcelular: celularLimpio\b/);
  });
});
