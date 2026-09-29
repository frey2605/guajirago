// ─────────────────────────────────────────────────────────────────────────────
//  G58 (29-sep-2026) · «ME ESTÁN LLAMANDO» sale de UNA pieza: guajirago/src/llamadaEntrante.js.
//
//  La escucha de `llamadas/{viajeId}` estaba copiada igual en AppConductor.js y en Solicitar.js, y ninguna de las dos
//  decía nada si el servidor la cortaba. Ahora las dos usan useLlamadaEntrante(id, setAviso).
//
//  Esta prueba CORRE la escucha de cada pantalla —la pieza con los argumentos que la pantalla le pasa, sacados de su
//  archivo— con un React y un Firestore de mentira (scripts/medir-llamada-entrante.cjs), y exige:
//    · la MISMA marca, paso por paso, que dejaban las dos copias de antes (medido con --commit 5d299fa);
//    · que escuche el documento del viaje, siga al viaje cuando cambia de id, y suelte la escucha al salir;
//    · que si el servidor corta la escucha, la pantalla reciba su aviso y quede rastro en la consola;
//    · que ninguna pantalla vuelva a escuchar 'llamadas' a mano.
// ─────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer } = require('./cargar.cjs');
const {
  medirCodigo, fuentesDe, cargarPieza, reactDeMentira, firestoreDeMentira, foto, PIEZA,
} = require('../scripts/medir-llamada-entrante.cjs');

// La marca que dejaban las dos copias de antes en cada paso del guion (node scripts/medir-llamada-entrante.cjs
// --sin-red --commit 5d299fa): las dos daban esto, las dos iguales.
const COMO_ERA = [
  ['no hay llamada', false], ['me llaman', true], ['contesté', true], ['colgaron', false],
  ['me vuelven a llamar', true], ['cerré la ventana', false], ['sigue activa', false], ['sin estado', false],
];
const ARGUMENTOS = {
  'guajirago/src/AppConductor.js': 'viajeActual?.id, setAviso',
  'guajirago/src/Solicitar.js': 'viajeId, setAviso',
};

const hoy = medirCodigo(fuentesDe(null));

describe('G58 · la escucha de «llamada entrante» sale de UNA pieza', () => {
  it('ninguna pantalla escucha «llamadas» a mano, y el medidor no se queja', () => {
    assert.deepStrictEqual(hoy.quejas, []);
    assert.deepStrictEqual(hoy.aMano, [], '⛔ escuchas de «llamadas» escritas a mano: ' + hoy.aMano.join(', '));
  });

  for (const p of hoy.pantallas) {
    const nombre = p.ruta.split('/').pop();
    describe(nombre, () => {
      it('usa la pieza, con la id de SU viaje y SU ventanita de aviso', () => {
        assert.strictEqual(p.forma, 'la pieza');
        assert.strictEqual(p.args, ARGUMENTOS[p.ruta]);
      });
      it('deja la misma marca que antes en cada paso', () => {
        assert.deepStrictEqual(p.pasos, COMO_ERA);
      });
      it('escucha el documento de su viaje, sigue al viaje nuevo y suelta la escucha al salir', () => {
        assert.strictEqual(p.escuchaA, 'llamadas/V1');
        assert.strictEqual(p.otroViaje, 'llamadas/V2', '⛔ con otro viaje escucha: ' + p.otroViaje);
        assert.strictEqual(p.reescucha, 0, '⛔ vuelve a escuchar desde cero aunque el viaje sea el mismo');
        assert.strictEqual(p.sueltaAlSalir, true, '⛔ la escucha se queda viva al salir de la pantalla');
        assert.strictEqual(p.sinViajeEscucha, 0, '⛔ escucha algo sin viaje');
      });
      it('si el servidor corta la escucha, la pantalla recibe su aviso y queda rastro', () => {
        assert.strictEqual(p.tieneManejador, true, '⛔ onSnapshot sin manejador de error: falla muda');
        assert.strictEqual(p.avisos.length, 1, '⛔ la pantalla no recibió el aviso');
        assert.strictEqual(p.avisos[0].clave, 'permiso');
        assert.strictEqual(p.avisos[0].titulo, 'No se pudo escuchar las llamadas de este viaje');
        assert.match(p.avisos[0].texto, /no te va a sonar/);
        assert.strictEqual(p.apuntes.length, 1, '⛔ no queda rastro en la consola');
        assert.strictEqual(p.apuntes[0][1], 'permission-denied');
      });
      it('el gancho va después de la id del viaje y de la ventanita que recibe', () => {
        const t = leer(p.ruta);
        const gancho = t.indexOf('useLlamadaEntrante(' + ARGUMENTOS[p.ruta] + ')');
        assert.ok(gancho > 0);
        assert.ok(t.indexOf('const [aviso, setAviso] = useState(null);') < gancho, '⛔ setAviso se declara después del gancho');
        const id = p.ruta.endsWith('AppConductor.js') ? 'const [viajeActual, setViajeActual]' : 'const [viajeId, setViajeId]';
        assert.ok(t.indexOf(id) >= 0 && t.indexOf(id) < gancho, '⛔ la id del viaje se declara después del gancho');
      });
      it('con la marca puesta, la pantalla enseña «Llamada entrante» y la apaga al cerrar', () => {
        const t = leer(p.ruta);
        assert.match(t, /if \(llamadaEntrante\) return <Llamada [^\n]*miRol="entrante"[^\n]*onCerrar=\{\(\) => \{? ?setLlamadaEntrante\(false\);? ?\}?\} \/>/);
      });
    });
  }

  describe('la pieza sola', () => {
    const R = reactDeMentira();
    const F = firestoreDeMentira();
    const pieza = cargarPieza(leer(PIEZA), R.H, F, []);
    it('la marca: suena con «llamando», se apaga con «terminada» o sin documento, y lo demás no la toca', () => {
      assert.strictEqual(pieza.marcaDeLlamada(foto({ estado: 'llamando' })), true);
      assert.strictEqual(pieza.marcaDeLlamada(foto({ estado: 'terminada' })), false);
      assert.strictEqual(pieza.marcaDeLlamada(foto(null)), false);
      assert.strictEqual(pieza.marcaDeLlamada(foto({ estado: 'activa' })), null);
      assert.strictEqual(pieza.marcaDeLlamada(foto({})), null);
    });
    it('sin señal, el aviso dice «Sin conexión» y lo que significa', () => {
      const a = pieza.avisoSinEscucha({ code: 'unavailable' });
      assert.strictEqual(a.clave, 'sinRed');
      assert.strictEqual(a.titulo, 'Sin conexión');
      assert.match(a.texto, /no te va a sonar/);
    });
    it('sin quien reciba el aviso, un corte no revienta', () => {
      const R2 = reactDeMentira();
      const F2 = firestoreDeMentira();
      const apuntes = [];
      const p2 = cargarPieza(leer(PIEZA), R2.H, F2, apuntes);
      R2.montar(() => p2.useLlamadaEntrante('V9'));
      assert.doesNotThrow(() => F2.escuchas[0].error({ code: 'permission-denied' }));
      assert.strictEqual(apuntes.length, 1);
    });
  });
});
