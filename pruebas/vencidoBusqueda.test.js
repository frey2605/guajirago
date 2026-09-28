// ─────────────────────────────────────────────────────────────────────────────
//  G27 (28-sep-2026) · EL PLAZO DE LA BÚSQUEDA, UNA VEZ; Y EL «VENCIDO» DEL CELULAR, CON SU RASTRO
// ─────────────────────────────────────────────────────────────────────────────
//  El plazo con que el celular del pasajero busca conductor (al minuto amplía el radio, a los 2 min se rinde) estaba
//  escrito a mano nueve veces en dos pantallas, y el `vencido` que escribía el celular no decía cuándo, quién ni por
//  qué. Ahora el plazo vive en `BUSQUEDA` y la marca en `marcaDelVencido`, los dos en configApp.js.
//
//  Estas pruebas EJECUTAN el código: sacan del archivo los temporizadores de verdad y los corren con un reloj de
//  mentira, para ver cuánto esperan y qué escriben. El plazo del servidor (20 min) NO se iguala: es la red de
//  seguridad, y aquí se exige que siga siendo más largo que el del celular.
// ─────────────────────────────────────────────────────────────────────────────
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, cargarDeLaApp, soloCodigo, sinTextos } = require('./cargar.cjs');
const { medirCodigo } = require('../scripts/medir-vencido-busqueda.cjs');
const { correrVigilante } = require('../scripts/medir-viaje-cerrado.cjs');
const { MINUTOS } = require('../guajirago/functions/viajesColgados.cjs');

const APP = 'guajirago/src/Solicitar.js';
const COND = 'guajirago/src/AppConductor.js';
const pieza = () => cargarDeLaApp('guajirago/src/configApp.js');
const AHORA = '2026-09-28T15:00:00.000Z';

/** Todos los `radioRef.current = { ... }` del archivo, con su objeto entero (contando llaves sin mirar los textos). */
function losTemporizadores(fuente) {
  const t = soloCodigo(fuente);
  const seguro = sinTextos(t);
  const trozos = [];
  const ancla = 'radioRef.current = {';
  for (let i = seguro.indexOf(ancla); i >= 0; i = seguro.indexOf(ancla, i + 1)) {
    const abre = i + ancla.length - 1;
    let hondo = 0;
    let j = abre;
    for (; j < seguro.length; j++) {
      if (seguro[j] === '{') hondo++;
      else if (seguro[j] === '}' && --hondo === 0) break;
    }
    trozos.push(t.slice(abre, j + 1));
  }
  return trozos;
}

/** Corre un objeto de temporizadores con un reloj y una base de mentira; dispara cada uno y apunta qué escribe. */
function correrTemporizadores(objeto, { BUSQUEDA, marcaDelVencido }) {
  const relojes = {};
  const escrituras = [];
  const nombres = ['setTimeout', 'updateDoc', 'doc', 'db', 'viajeId', 'docRef', 'configApp', 'setBuscandoAgotado',
    'BUSQUEDA', 'marcaDelVencido', 'Date'];
  const fnDe = new Function(...nombres, 'return (' + objeto + ');');
  const ref = fnDe(
    (fn, ms) => ({ fn, ms }),
    (ruta, datos) => { escrituras.push({ ruta, datos }); return Promise.resolve(); },
    (_db, col, id) => col + '/' + id,
    {}, 'V1', { id: 'V1' }, { radioBusquedaAmpliado: 7 }, () => {},
    BUSQUEDA, marcaDelVencido,
    class extends Date { constructor(...a) { super(...(a.length ? a : [AHORA])); } },
  );
  for (const [k, r] of Object.entries(ref)) { relojes[k] = r.ms; escrituras.length = 0; r.fn(); relojes[k + 'Escribe'] = escrituras.map((e) => e.datos); }
  return relojes;
}

describe('G27 · el plazo de la búsqueda sale de un solo sitio', () => {
  it('la pieza: 60 s para ampliar, 120 s para rendirse, y ampliar va antes que rendirse', () => {
    const { BUSQUEDA } = pieza();
    assert.deepStrictEqual(BUSQUEDA, { segundosParaAmpliar: 60, segundos: 120 },
      'cambió el plazo de la búsqueda del celular: si es a propósito, cámbialo aquí también (lo decidió el dueño)');
    assert.ok(BUSQUEDA.segundosParaAmpliar < BUSQUEDA.segundos);
  });

  it('el del servidor sigue siendo la RED: más largo que el del celular (distintos a propósito, no gemelos)', () => {
    const { BUSQUEDA } = pieza();
    assert.ok(MINUTOS.buscando * 60 > BUSQUEDA.segundos,
      'el servidor vencería la búsqueda antes que el propio celular: dejaría de ser la red de seguridad');
  });

  it('las dos veces que el pasajero arranca la búsqueda, sus relojes son los de la pieza (corridos de verdad)', () => {
    const p = pieza();
    const trozos = losTemporizadores(leer(APP));
    assert.strictEqual(trozos.length, 2, 'esperaba 2 juegos de temporizadores (pedir y «Seguir buscando»), hay ' + trozos.length);
    for (const tr of trozos) {
      const r = correrTemporizadores(tr, p);
      assert.strictEqual(r.ampliar, p.BUSQUEDA.segundosParaAmpliar * 1000, 'ampliar no espera lo que dice la pieza');
      assert.strictEqual(r.agotar, p.BUSQUEDA.segundos * 1000, 'rendirse no espera lo que dice la pieza');
      assert.deepStrictEqual(r.ampliarEscribe, [{ radioBusqueda: 7 }]);
    }
  });

  it('el reloj que ve el pasajero arranca, y la barra se llena, con el plazo de la pieza', () => {
    const t = soloCodigo(leer(APP));
    const arranques = [...t.matchAll(/setTiempoBusqueda\(\s*([^)]+?)\s*\)/g)].map((m) => m[1]).filter((x) => !x.startsWith('prev'));
    assert.deepStrictEqual(arranques, ['BUSQUEDA.segundos', 'BUSQUEDA.segundos'], 'el reloj arranca con otro número');
    assert.ok(/useState\(\s*BUSQUEDA\.segundos\s*\)/.test(t), 'el reloj nace con otro número');
    assert.ok(/tiempoBusqueda\s*\/\s*BUSQUEDA\.segundos\b/.test(t), 'la barra se llena contra otro número');
  });

  it('el conductor deja de ver una solicitud con el MISMO plazo (corrido de verdad)', () => {
    const { BUSQUEDA } = pieza();
    const m = /const\s+VENTANA_MS\s*=\s*([^;]+);/.exec(soloCodigo(leer(COND)));
    assert.ok(m, 'no encuentro VENTANA_MS en AppConductor.js');
    const ventana = new Function('BUSQUEDA', 'return (' + m[1] + ');')(BUSQUEDA);
    assert.strictEqual(ventana, BUSQUEDA.segundos * 1000,
      'el conductor mira las solicitudes con otro plazo que el del pasajero');
  });

  it('el medidor ya no encuentra números a mano ni vencidos sin rastro', () => {
    const c = medirCodigo();
    assert.strictEqual(c.aMano, 0, 'quedan números del plazo a mano: ' + JSON.stringify(c.filas));
    assert.strictEqual(c.vencidoPelado, 0, 'hay un vencido del celular sin rastro');
  });
});

describe('G27 · el «vencido» del celular deja fecha, quién y por qué', () => {
  it('los dos temporizadores que se rinden escriben la marca completa (corridos de verdad)', () => {
    const p = pieza();
    for (const tr of losTemporizadores(leer(APP))) {
      const r = correrTemporizadores(tr, p);
      assert.deepStrictEqual(r.agotarEscribe, [p.marcaDelVencido(AHORA)], 'el vencido del celular no deja su rastro');
    }
  });

  it('la marca: vencido, la fecha que se le da, quién (no «sistema») y el motivo con los minutos del plazo', () => {
    const { marcaDelVencido } = pieza();
    const m = marcaDelVencido(AHORA);
    assert.strictEqual(m.estado, 'vencido');
    assert.strictEqual(m.fechaExpiracion, AHORA);
    assert.strictEqual(m.expiradoPor, 'app-pasajero');
    assert.notStrictEqual(m.expiradoPor, 'sistema', 'el celular no puede firmar como el servidor');
    assert.strictEqual(m.motivoExpiracion, 'llevaba 2 min buscando conductor y nadie lo tomó');
  });

  it('deja los MISMOS campos que el servidor (functions/index.js, expirarViajesColgados)', () => {
    const t = soloCodigo(leer('guajirago/functions/index.js'));
    const i = t.indexOf('exports.expirarViajesColgados');
    assert.ok(i >= 0);
    const bloque = /d\.ref\.update\(\{([^}]*)\}\)/.exec(t.slice(i));
    assert.ok(bloque, 'la rutina ya no escribe con d.ref.update({ ... })');
    const delServidor = [...bloque[1].matchAll(/(\w+)\s*:/g)].map((x) => x[1]).sort();
    const delCelular = Object.keys(pieza().marcaDelVencido(AHORA)).sort();
    assert.deepStrictEqual(delCelular, delServidor, 'el rastro del celular y el del servidor ya no tienen los mismos campos');
  });

  it('su propio vencido NO le saca al pasajero la ventanita «el sistema cerró tu viaje» mientras busca', async () => {
    const v = { ...pieza().marcaDelVencido(AHORA), pasajeroId: 'p1' };
    for (const vig of ['pasajeroEnVivo', 'pasajeroRespaldo']) {
      const ll = await correrVigilante(vig, v, 'esperando');
      assert.strictEqual(ll.filter((l) => l[0] === 'setViajeCerrado' && l[1]).length, 0, vig + ' le cerró el viaje');
      assert.strictEqual(ll.filter((l) => l[0] === 'setAviso' && l[1]).length, 0, vig + ' le sacó una ventanita');
      assert.strictEqual(ll.filter((l) => l[0] === 'setPantalla').length, 0, vig + ' lo sacó de la pantalla de búsqueda');
    }
  });
});
