// ─────────────────────────────────────────────────────────────────────────────
//  G96 (30-sep-2026) · EL CHAT DEL VIAJE sale de UNA pieza: guajirago/src/chatDelViaje.js.
//
//  Escuchar `viajes/{id}/mensajes` y enviar un mensaje estaba copiado en AppConductor.js y en Solicitar.js, y la
//  escucha no decía nada si el servidor la cortaba. Ahora las dos usan useChatDelViaje(id, autor, chatFinRef, setAviso).
//
//  Esta prueba CORRE el chat de cada pantalla —la pieza con los argumentos que la pantalla le pasa y el manejador de
//  enviar sacado de su archivo— con un React y un Firestore de mentira (scripts/medir-chat-del-viaje.cjs), y exige:
//    · que se escriba en la base LO MISMO que escribían las dos copias de antes (medido con --commit c111a24);
//    · que escuche en orden de fecha, siga al viaje nuevo, suelte la escucha y baje al último mensaje;
//    · que si el servidor corta la escucha, la pantalla reciba su aviso y quede rastro en la consola;
//    · que la tecla Enter y el botón ➤ sigan pasando por el candado (LEY DEL BOTÓN);
//    · que ninguna pantalla vuelva a nombrar 'mensajes' a mano.
// ─────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const { medirCodigo, fuentesDe, cargarPieza, firestoreDeMentira, fotoDelChat, PIEZA, AHORA } = require('../scripts/medir-chat-del-viaje.cjs');
const { reactDeMentira } = require('../scripts/medir-llamada-entrante.cjs');

const CANDADO = [['mensaje', 'Mensaje enviado.', 'enviar el mensaje']];
// Lo que escribían las dos copias de antes en cada caso (node scripts/medir-chat-del-viaje.cjs --sin-red --commit c111a24).
const COMO_ERA = (autor) => [
  ['con texto', { escribe: [{ ruta: 'viajes/V1/mensajes', datos: { texto: 'Ya llegué, estoy afuera', autor, autorId: 'U1', fecha: AHORA } }], vacia: [''], candado: CANDADO }],
  ['solo espacios', { escribe: [], vacia: [], candado: [] }],
  ['sin viaje', { escribe: [], vacia: [], candado: [] }],
  ['sin usuario', { escribe: [{ ruta: 'viajes/V1/mensajes', datos: { texto: 'Hola', autor, autorId: '', fecha: AHORA } }], vacia: [''], candado: CANDADO }],
  ['la base lo rechaza', { escribe: [{ ruta: 'viajes/V1/mensajes', datos: { texto: 'Hola', autor, autorId: 'U1', fecha: AHORA } }], vacia: [], candado: CANDADO }],
];
const ARGUMENTOS = {
  'guajirago/src/AppConductor.js': "viajeActual?.id, 'conductor', chatFinRef, setAviso",
  'guajirago/src/Solicitar.js': "viajeId, 'pasajero', chatFinRef, setAviso",
};
const M1 = { id: 'm1', texto: 'Ya voy', autor: 'conductor', autorId: 'C1', fecha: '2026-09-30T15:00:00.000Z' };
const M2 = { id: 'm2', texto: 'Te espero en la puerta', autor: 'pasajero', autorId: 'P1', fecha: '2026-09-30T15:01:00.000Z' };

describe('G96 · el chat del viaje sale de UNA pieza', async () => {
  const hoy = await medirCodigo(fuentesDe(null));

  it('ninguna pantalla nombra «mensajes» a mano, y el medidor no se queja', () => {
    assert.deepStrictEqual(hoy.quejas, []);
    assert.deepStrictEqual(hoy.aMano, [], '⛔ el chat escrito a mano: ' + hoy.aMano.join(', '));
    assert.strictEqual(hoy.pantallas.length, 2);
  });

  for (const p of hoy.pantallas) {
    const nombre = p.ruta.split('/').pop();
    describe(nombre, () => {
      it('usa la pieza, con SU viaje, SU autor, su fondo del chat y SU ventanita', () => {
        assert.strictEqual(p.forma, 'la pieza');
        assert.strictEqual(p.args, ARGUMENTOS[p.ruta]);
      });
      it('al enviar escribe en la base LO MISMO que antes, caso por caso', () => {
        assert.deepStrictEqual(p.envios, COMO_ERA(p.autor));
      });
      it('la tecla Enter y el botón ➤ llaman al manejador que pasa por el candado', () => {
        assert.deepStrictEqual(p.entradas, { enter: 2, boton: 2 });
      });
      it('escucha su viaje en orden de fecha, enseña lo que llega y baja al último', () => {
        assert.strictEqual(p.escuchaA, 'viajes/V1/mensajes orderBy(fecha,asc)');
        assert.strictEqual(p.alEmpezar, '[]');
        assert.deepStrictEqual(JSON.parse(p.conUno), [M1]);
        assert.deepStrictEqual(JSON.parse(p.conDos), [M1, M2]);
        assert.strictEqual(p.bajadas, 2);
        assert.strictEqual(p.bajaSuave, true);
      });
      it('sigue al viaje nuevo, no reempieza con el mismo, suelta al salir y sin viaje no escucha', () => {
        assert.strictEqual(p.reescucha, 0, '⛔ vuelve a escuchar desde cero aunque el viaje sea el mismo');
        assert.strictEqual(p.otroViaje, 'viajes/V2/mensajes orderBy(fecha,asc)');
        assert.strictEqual(p.sueltaAlSalir, true, '⛔ la escucha se queda viva al salir');
        assert.strictEqual(p.sinViajeEscucha, 0, '⛔ escucha algo sin viaje');
      });
      it('si el servidor corta la escucha, la pantalla recibe su aviso y queda rastro', () => {
        assert.strictEqual(p.tieneManejador, true, '⛔ onSnapshot sin manejador de error: falla muda');
        assert.strictEqual(p.avisos.length, 1, '⛔ la pantalla no recibió el aviso');
        assert.strictEqual(p.avisos[0].clave, 'permiso');
        assert.strictEqual(p.avisos[0].titulo, 'No se pudo recibir los mensajes del chat');
        assert.match(p.avisos[0].texto, /no te van a llegar/);
        assert.strictEqual(p.apuntes.length, 1, '⛔ no queda rastro en la consola');
        assert.strictEqual(p.apuntes[0][1], 'permission-denied');
      });
      it('el gancho va después del viaje, del fondo del chat y de la ventanita que recibe', () => {
        const t = leer(p.ruta);
        const gancho = t.indexOf('useChatDelViaje(' + ARGUMENTOS[p.ruta] + ')');
        assert.ok(gancho > 0);
        assert.ok(t.indexOf('const [aviso, setAviso] = useState(null);') < gancho, '⛔ setAviso se declara después del gancho');
        assert.ok(t.indexOf('const chatFinRef = useRef(null);') < gancho, '⛔ chatFinRef se declara después del gancho');
        const id = p.ruta.endsWith('AppConductor.js') ? 'const [viajeActual, setViajeActual]' : 'const [viajeId, setViajeId]';
        assert.ok(t.indexOf(id) >= 0 && t.indexOf(id) < gancho, '⛔ la id del viaje se declara después del gancho');
      });
    });
  }

  describe('la pieza sola', () => {
    it('sin señal, el aviso dice «Sin conexión» y lo que significa', () => {
      const pieza = cargarPieza(leer(PIEZA), reactDeMentira().H, firestoreDeMentira(false), [], { currentUser: null });
      const a = pieza.avisoSinChat({ code: 'unavailable' });
      assert.strictEqual(a.clave, 'sinRed');
      assert.strictEqual(a.titulo, 'Sin conexión');
      assert.match(a.texto, /no te van a llegar/);
    });
    it('sin quien reciba el aviso, un corte no revienta; y un mensaje que llega sin fondo del chat, tampoco', () => {
      const R = reactDeMentira();
      const F = firestoreDeMentira(false);
      const apuntes = [];
      const pieza = cargarPieza(leer(PIEZA), R.H, F, apuntes, { currentUser: null });
      R.montar(() => pieza.useChatDelViaje('V9', 'pasajero', { current: null }));
      assert.doesNotThrow(() => F.escuchas[0].siguiente(fotoDelChat([['a', { texto: 'x' }]])));
      assert.doesNotThrow(() => F.escuchas[0].error({ code: 'permission-denied' }));
      assert.strictEqual(apuntes.length, 1);
    });
  });
});
