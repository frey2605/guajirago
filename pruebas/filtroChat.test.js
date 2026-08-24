/**
 * EL FILTRO ANTI-DATOS — PRUEBAS QUE EJECUTAN EL ARCHIVO REAL
 *
 * El filtro impide que por los chats pasen teléfonos, correos o invitaciones a
 * irse a WhatsApp — o sea, que el negocio se escape por fuera de la app.
 * Estas pruebas cargan guajirago/src/filtroChat.js tal cual está en el disco.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
// El cargador vive en cargar.cjs: un solo sitio para todas las pruebas (SEGUNDA LEY).
const { RAIZ, cargarDeLaApp } = require('./cargar.cjs');

const { contieneInfoSensible } = cargarDeLaApp('guajirago/src/filtroChat.js');

describe('SEGUNDA LEY · el filtro anti-datos, un solo sitio', () => {
  it('BLOQUEA teléfonos, aunque vengan disfrazados con espacios, puntos o rayas', () => {
    // El «3+0+0+1+2+3+4+5+6+7» lo atajaba solo la copia floja: la unión no
    // podía perderlo (hallazgo de la segunda opinión, 24-ago-2026).
    for (const t of ['llámame al 3001234567', 'mi cel 300 123 4567', '300.123.45.67', '300-123-4567', '3+0+0+1+2+3+4+5+6+7']) {
      assert.strictEqual(contieneInfoSensible(t), true, 'dejó pasar: «' + t + '»');
    }
  });

  it('BLOQUEA correos y las palabras de contacto externo — incluidas las que la copia floja dejaba pasar', () => {
    const DEBEN_CAER = [
      'escríbeme a juan@correo.com',
      'hablemos por whatsapp', 'por whats app mejor', 'wasap', 'wapp',            // wapp: solo la floja lo tenía
      'mi instagram', 'facebook', 'telegram', 'tiktok',                           // tiktok: la floja lo dejaba pasar
      'mándame un correo', 'mi email', 'te paso mi gmail', 'hotmail',             // todas estas se le escapaban a la floja
      'dame tu celular', 'pásame tu numero', 'tu número', 'llamame', 'llámame',
    ];
    for (const t of DEBEN_CAER) {
      assert.strictEqual(contieneInfoSensible(t), true, 'dejó pasar: «' + t + '»');
    }
  });

  it('DEJA PASAR los mensajes normales de un pedido o una recarga', () => {
    const NORMALES = [
      'ya salió tu pedido',
      'la casa de rejas blancas, timbre 2',
      'gracias, todo llegó bien',
      'recargué 20 mil',       // «20 mil» no son 7 dígitos seguidos
      'el código es 1234',     // 4 cifras: el código del viaje, no un teléfono
    ];
    for (const t of NORMALES) {
      assert.strictEqual(contieneInfoSensible(t), false, 'bloqueó un mensaje normal: «' + t + '»');
    }
  });

  it('NINGUNA pantalla vuelve a tener su propia copia del filtro', () => {
    // Solo se revisan las pantallas de ESTA app; la copia del panel es de otro
    // repo y la vigila el amarre (pruebas/amarres.test.js), que la ejecuta.
    const PANTALLAS = fs.readdirSync(path.join(RAIZ, 'guajirago/src')).filter((f) => f.endsWith('.js') && f !== 'filtroChat.js');
    for (const archivo of PANTALLAS) {
      const fuente = fs.readFileSync(path.join(RAIZ, 'guajirago/src', archivo), 'utf8');
      assert.ok(!fuente.includes('palabrasBloqueadas') && !fuente.includes('palabrasProhibidas'),
        'guajirago/src/' + archivo + ' volvió a tener su PROPIA lista de palabras bloqueadas. ' +
        'El filtro vive en filtroChat.js (SEGUNDA LEY): dos listas terminan dejando pasar cosas distintas.');
    }
  });
});
