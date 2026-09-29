// ─────────────────────────────────────────────────────────────────────────────
//  G57 (29-sep-2026) · SOLTARME DEL VIAJE sale de UNA pieza en la app del conductor.
//
//  Cuando el viaje se acaba, la ficha del conductor (`conductores/{uid}`) queda libre (`ocupado: false`,
//  `enViajeId: null`) y la pantalla sale del viaje. Eso estaba escrito a mano en CUATRO sitios de AppConductor.js
//  —cancelar, terminar, el botón «El pasajero canceló» y el cierre del servidor (G20)— y cada uno limpiaba una lista
//  distinta: tras «El pasajero canceló» o un cierre del servidor, el viaje siguiente enseñaba el último mensaje del
//  pasajero anterior y su tiempo de llegada. Ahora los cuatro llaman a `soltarmeDelViaje`.
//
//  Esta prueba SACA la pieza del archivo y la CORRE en sus tres formas (sin nada, 'por el candado', 'sin escribir'), con la
//  escritura saliendo bien y mal; y corre también los sitios que la llaman, para ver que la llaman cuando toca.
//  Respeta G02 (merge, y nunca PONE un viaje), G07 (cerrar sesión va aparte) y G20 (el cierre del servidor no escribe).
// ─────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cuerpoDeLaFuncion } = require('./cargar.cjs');
const { ambitoDeMentira, correrVigilante } = require('../scripts/medir-viaje-cerrado.cjs');
const { medirCodigo } = require('../scripts/medir-soltar-conductor.cjs');

const APP = 'guajirago/src/AppConductor.js';
const ANCLA = 'const soltarmeDelViaje = async (modo) => {';

// Todo lo que la pantalla tiene que dejar limpio al salir del viaje: la UNIÓN de lo que limpiaban los cuatro sitios
// de antes (medido con scripts/medir-soltar-conductor.cjs --commit 83c7e70), con el valor que deja cada uno.
const LIMPIO = {
  setMostrarCancelacion: false, setMostrarCodigo: false, setMostrarCodigoDescuento: false,
  setCodigoDescuentoIngresado: '', setErrorCodigoDescuento: '',
  setFase: null, setViajeActual: null, setTiempoLlegada: null, setDistancia: null,
  setRespuestaPasajero: null, setMensajeGrande: null, setUbicacionPasajero: null, setDestinoCoords: null,
  setActivo: true, setContador: 90,
};

function cuerpoDe(codigo, ancla) {
  const i = codigo.indexOf(ancla);
  assert.ok(i >= 0, 'no encuentro «' + ancla + '» en ' + APP);
  assert.strictEqual(codigo.indexOf(ancla, i + 1), -1, '«' + ancla + '» está más de una vez');
  return cuerpoDeLaFuncion(codigo, i).texto;
}

const esperarPromesas = () => new Promise((r) => setImmediate(r));

/** Corre un trozo de la pantalla en un ámbito de mentira: lo que no se le da, se vuelve un espía. */
async function correrTrozo(cuerpo, fijos) {
  const { ambito, llamadas } = ambitoDeMentira(fijos);
  // eslint-disable-next-line no-new-func
  const f = new Function('ambito', 'with (ambito) { return (async () => {' + cuerpo + '\n})(); }');
  const valor = await f(ambito);
  await esperarPromesas();
  return { valor, llamadas, ambito };
}

/** El ámbito de siempre: un conductor «yo», y una escritura y un candado que se pueden hacer fallar. */
function fijosDe({ modo, usuario = { uid: 'yo' }, escrituraFalla = false, correrOk = true } = {}) {
  const hechos = [];
  const falla = Object.assign(new Error('sin permiso'), { code: 'permission-denied' });
  return {
    hechos,
    fijos: {
      modo,
      auth: { currentUser: usuario },
      db: 'db',
      doc: (_db, ...ruta) => ruta.join('/'),
      setDoc: (...a) => { hechos.push(['setDoc', ...a]); return escrituraFalla ? Promise.reject(falla) : Promise.resolve(); },
      updateDoc: (...a) => { hechos.push(['updateDoc', ...a]); return Promise.resolve(); },
      // El candado de mentira corre lo que se le da; si esa escritura falla, dice que no (como el de verdad).
      correr: async (fn, cual, exito, accion) => {
        hechos.push(['correr', cual, exito, accion]);
        if (!correrOk) return { ok: false };
        try { const valor = await fn(); return { ok: true, valor }; } catch (e) { return { ok: false }; }
      },
      motivoDeRechazo: (e, accion) => ({ ok: false, texto: 'No se pudo ' + accion }),
      segundosDeEspera: () => 90, configApp: {},
      faseRef: { current: 'recogiendo' }, ultimoMensajeRef: { current: 'Ya voy' }, contadorRef: { current: 7 },
      viajeActual: { id: 'v1' },
    },
  };
}

async function correrPieza(opciones) {
  const cuerpo = cuerpoDe(soloCodigo(leer(APP)), ANCLA);
  const { hechos, fijos } = fijosDe(opciones);
  const r = await correrTrozo(cuerpo, fijos);
  const llamadas = [...hechos, ...r.llamadas];
  const ultimo = (n) => { const l = llamadas.filter((x) => x[0] === n); return l.length ? l[l.length - 1][1] : undefined; };
  return { ...r, llamadas, hechos, fijos, ultimo, escrituras: llamadas.filter((l) => l[0] === 'setDoc') };
}

function assertSalio(p, donde) {
  for (const [setter, valor] of Object.entries(LIMPIO)) {
    assert.deepStrictEqual(p.ultimo(setter), valor, donde + ': no deja ' + setter + '(' + JSON.stringify(valor) + ')');
  }
  assert.strictEqual(p.fijos.faseRef.current, null, donde + ': faseRef se queda con la fase del viaje');
  assert.strictEqual(p.fijos.ultimoMensajeRef.current, null, donde + ': el último mensaje del pasajero se queda guardado');
}

describe('G57 · soltarmeDelViaje, corrida de verdad', () => {
  it('sin nada (cancelar, terminar): escribe con merge y sale; si la escritura entra, no hay ventanita', async () => {
    const p = await correrPieza({});
    assert.deepStrictEqual(p.escrituras, [['setDoc', 'conductores/yo', { ocupado: false, enViajeId: null }, { merge: true }]]);
    assert.ok(!p.hechos.some((l) => l[0] === 'correr'), 'vuelve a trancar la pantalla: pisa la verdad que ya dijo el candado');
    assert.strictEqual(p.ultimo('setAviso'), undefined);
    assert.strictEqual(p.valor, true);
    assertSalio(p, 'sin nada');
  });

  it('sin nada, y la escritura NO entra: lo apunta, lo dice en la ventanita, y la pantalla sale igual', async () => {
    const p = await correrPieza({ escrituraFalla: true });
    assert.strictEqual(p.escrituras.length, 1);
    assert.ok(p.llamadas.some((l) => l[0] === 'apuntarRechazo' && /soltar el viaje/.test(l[1])), 'no deja rastro');
    assert.deepStrictEqual(p.ultimo('setAviso'), { ok: false, texto: 'No se pudo liberarte para recibir viajes' },
      'el conductor no se entera de que sigue «ocupado»');
    assertSalio(p, 'sin nada, fallando');
  });

  it("'por el candado' («El pasajero canceló»): pasa por el candado con su palabra y sale", async () => {
    const p = await correrPieza({ modo: 'por el candado' });
    assert.deepStrictEqual(p.hechos.find((l) => l[0] === 'correr'),
      ['correr', 'volver', 'Listo para recibir viajes.', 'liberarte para recibir viajes']);
    assert.deepStrictEqual(p.escrituras, [['setDoc', 'conductores/yo', { ocupado: false, enViajeId: null }, { merge: true }]]);
    assert.strictEqual(p.valor, true);
    assertSalio(p, 'por el candado');
  });

  it("'por el candado', y NO entra: NO sale (se queda en la pantalla para reintentar)", async () => {
    for (const o of [{ modo: 'por el candado', escrituraFalla: true }, { modo: 'por el candado', correrOk: false }]) {
      const p = await correrPieza(o);
      assert.strictEqual(p.valor, false);
      assert.strictEqual(p.ultimo('setFase'), undefined, 'sale del viaje aunque el conductor sigue «ocupado»');
      assert.strictEqual(p.ultimo('setActivo'), undefined);
      assert.strictEqual(p.fijos.faseRef.current, 'recogiendo');
    }
  });

  it("'sin escribir' (lo cerró el servidor, G20): no escribe nada y sale", async () => {
    const p = await correrPieza({ modo: 'sin escribir' });
    assert.deepStrictEqual(p.escrituras, []);
    assert.ok(!p.hechos.some((l) => l[0] === 'correr'));
    assertSalio(p, 'sin escribir');
  });

  it('sin sesión: no escribe y sale (como antes)', async () => {
    for (const modo of [undefined, 'por el candado']) {
      const p = await correrPieza({ modo, usuario: null });
      assert.deepStrictEqual(p.escrituras, []);
      assertSalio(p, 'sin sesión');
    }
  });
});

describe('G57 · los cuatro sitios salen del viaje por la pieza', () => {
  it('el medidor: UNA escritura de «soltar», UN sitio que limpia la pantalla, y cuatro que llaman a la pieza', () => {
    const r = medirCodigo(leer(APP));
    assert.strictEqual(r.escrituras.length, 1, 'la escritura de «soltar» se volvió a copiar');
    assert.strictEqual(r.sitios.length, 1, 'otro sitio vuelve a sacar la pantalla del viaje a mano: ' + r.sitios.map((s) => s.renglon));
    assert.strictEqual(r.llamadasAlaPieza, 4);
  });

  for (const [fn, accion] of [['cancelarViaje', 'cancelar el viaje'], ['cerrarViajeFinal', 'cerrar el viaje']]) {
    it(fn + ': si el viaje se cerró, suelta SIN nada (escribe y avisa); si no, no suelta', async () => {
      const cuerpo = cuerpoDe(soloCodigo(leer(APP)), 'const ' + fn + ' = async (');
      for (const correrOk of [true, false]) {
        const { hechos, fijos } = fijosDe({ correrOk });
        const r = await correrTrozo(cuerpo, { ...fijos, razon: 'Tráfico' });
        const sueltas = r.llamadas.filter((l) => l[0] === 'soltarmeDelViaje');
        assert.ok(hechos.some((l) => l[0] === 'correr' && l[3] === accion), fn + ': no pasa por el candado');
        if (correrOk) assert.deepStrictEqual(sueltas, [['soltarmeDelViaje']], fn + ': no suelta al conductor por la pieza (o le pasa un modo)');
        else assert.deepStrictEqual(sueltas, [], fn + ': suelta al conductor aunque el viaje NO se cerró');
      }
    });
  }

  it("el botón «Volver al inicio» de «El pasajero canceló» llama a la pieza 'por el candado'", () => {
    const t = soloCodigo(leer(APP));
    const i = t.indexOf("if (fase === 'cancelado_pasajero') {");
    assert.ok(i >= 0);
    const pantalla = cuerpoDeLaFuncion(t, i).texto;
    assert.match(pantalla, /<button onClick=\{\(\) => soltarmeDelViaje\('por el candado'\)\} disabled=\{!!ocupado\}/,
      'el botón ya no suelta por la pieza, por el candado');
  });

  it('el cierre del servidor (G20) sale por la pieza sin escribir, y ya no deja el mensaje del pasajero pegado', async () => {
    // CON un conductor en sesión: sin él, la pieza no escribiría nunca y «no escribe» saldría verde por casualidad
    // (así escapó el primer sabotaje que le hacía escribir).
    const ll = await correrVigilante('conductorEnCurso', { estado: 'expirado' }, 'en_punto', {}, { auth: { currentUser: { uid: 'yo' } } });
    assert.ok(ll.some((l) => l[0] === 'setFase' && l[1] === null), 'el cierre del servidor ya no saca al conductor del viaje');
    assert.deepStrictEqual(ll.filter((l) => ['updateDoc', 'setDoc', 'correr'].includes(l[0])), [],
      'el cierre del servidor escribe la ficha: el servidor ya soltó al conductor (G20)');
    for (const setter of ['setFase', 'setRespuestaPasajero', 'setMensajeGrande', 'setTiempoLlegada']) {
      assert.ok(ll.some((l) => l[0] === setter && l[1] === null), 'el cierre del servidor no hace ' + setter + '(null)');
    }
  });
});
