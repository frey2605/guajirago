/**
 * G55 (29-sep-2026) · «BUSCANDO CONDUCTOR» Y «ACEPTADO» SALEN DE UNA SOLA FUENTE
 *
 * La fuente es `guajirago/src/estadosViaje.js` (ESTADOS_MERCADO, ESTADO_ACEPTADO, ESTADOS_EN_CURSO). Las funciones no
 * pueden importarla (otro paquete npm), así que llevan una copia en `guajirago/functions/estadosViaje.cjs`, y esta
 * prueba:
 *   1. ata esa copia a la de la app, valor por valor;
 *   2. EJECUTA cada comparación del servidor (avisar del viaje nuevo, avisar de la oferta subida, confirmar al
 *      conductor, la rutina de colgados) y de la pantalla del conductor, estado por estado, con los valores de la fuente;
 *   3. prohíbe volver a escribir `'esperando'` / `'aceptado'` a mano en el servidor y en AppConductor.js.
 *
 * Antes del G55 esos textos estaban escritos a mano 12 veces fuera de la fuente (scripts/medir-estados-a-mano.cjs), y
 * si la app renombraba un estado ninguna prueba se ponía roja: el servidor dejaba de avisar y de confirmar en silencio.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { RAIZ, leer, soloCodigo, cargarDeLaApp } = require('./cargar.cjs');

const app = cargarDeLaApp('guajirago/src/estadosViaje.js');
const srv = require('../guajirago/functions/estadosViaje.cjs');
const { queHacerConElViaje } = require('../guajirago/functions/viajesColgados.cjs');

// Todos los estados que existen o existieron, más uno vacío: cada comparación se ejecuta con cada uno.
const TODOS = [...new Set([...app.ESTADOS_EN_CURSO, ...app.ESTADOS_TERMINADOS, ...app.ESTADOS_RETIRADOS, undefined])];
const enMercado = (e) => app.ESTADOS_MERCADO.includes(e);

const sinCR = (t) => t.replace(/\r\n/g, '\n');

/** El cuerpo de `exports.<nombre>` en index.js, hasta el siguiente `exports.`. */
function cuerpoDe(index, nombre) {
  const i = index.indexOf('exports.' + nombre + ' = ');
  assert.ok(i >= 0, 'functions/index.js ya no exporta ' + nombre);
  const fin = index.indexOf('\nexports.', i + 10);
  return index.slice(i, fin < 0 ? undefined : fin);
}

/** La condición completa del `if (...)` que contiene `ancla` (paréntesis balanceados). */
function condicionDelIf(texto, ancla) {
  const k = texto.indexOf(ancla);
  assert.ok(k >= 0, 'no encuentro «' + ancla + '»');
  const i = texto.lastIndexOf('if (', k);
  assert.ok(i >= 0, 'no encuentro el if de «' + ancla + '»');
  let prof = 0;
  for (let j = i + 3; j < texto.length; j++) {
    if (texto[j] === '(') prof++;
    else if (texto[j] === ')') { prof--; if (prof === 0) return texto.slice(i + 4, j); }
  }
  throw new Error('if sin cerrar en «' + ancla + '»');
}

/** Ejecuta un trozo de código con estos nombres a mano. */
function ejecutar(expr, nombres) {
  // eslint-disable-next-line no-new-func
  return new Function(...Object.keys(nombres), 'return (' + expr + ');')(...Object.values(nombres));
}

const INDEX = sinCR(soloCodigo(leer('guajirago/functions/index.js')));
const CONDUCTOR = sinCR(soloCodigo(leer('guajirago/src/AppConductor.js')));

describe('G55 · la pieza de estados del servidor dice lo mismo que la app', () => {
  it('mercado, aceptado y en curso: valor por valor', () => {
    assert.ok(app.ESTADOS_MERCADO.length > 0, 'ESTADOS_MERCADO de la app quedó vacío');
    assert.deepStrictEqual(srv.ESTADOS_MERCADO, app.ESTADOS_MERCADO,
      'functions/estadosViaje.cjs y src/estadosViaje.js ya no dicen lo mismo del MERCADO (buscando conductor)');
    assert.strictEqual(srv.ESTADO_ACEPTADO, app.ESTADO_ACEPTADO,
      'functions/estadosViaje.cjs y src/estadosViaje.js ya no dicen lo mismo de ACEPTADO');
    assert.deepStrictEqual(srv.ESTADOS_EN_CURSO, app.ESTADOS_EN_CURSO,
      'functions/estadosViaje.cjs y src/estadosViaje.js ya no dicen lo mismo de EN CURSO');
  });

  it('index.js y viajesColgados.cjs la sacan de ./estadosViaje.cjs, no de una copia suya', () => {
    const colgados = soloCodigo(leer('guajirago/functions/viajesColgados.cjs'));
    for (const [nombre, t] of [['index.js', INDEX], ['viajesColgados.cjs', colgados]]) {
      assert.match(t, /require\(\s*['"]\.\/estadosViaje\.cjs['"]\s*\)/, nombre + ' ya no pide la pieza ./estadosViaje.cjs');
      for (const c of ['ESTADOS_MERCADO', 'ESTADO_ACEPTADO', 'ESTADOS_EN_CURSO']) {
        assert.ok(!new RegExp('(?:const|let|var)\\s+' + c + '\\s*=').test(t), nombre + ' se escribió su propio ' + c);
      }
    }
  });
});

describe('G55 · nadie más escribe «esperando» ni «aceptado» a mano', () => {
  const A_MANO = /['"](esperando|aceptado)['"]/g;
  it('ni en las funciones (fuera de su pieza) ni en la pantalla del conductor', () => {
    const dir = path.join(RAIZ, 'guajirago/functions');
    const archivos = fs.readdirSync(dir).filter((f) => /\.(c?js)$/.test(f) && f !== 'estadosViaje.cjs')
      .map((f) => 'guajirago/functions/' + f);
    archivos.push('guajirago/src/AppConductor.js');
    const culpables = [];
    for (const ruta of archivos) {
      for (const m of soloCodigo(leer(ruta)).matchAll(A_MANO)) culpables.push(ruta + ' → ' + m[0]);
    }
    assert.deepStrictEqual(culpables, [],
      'estos sitios volvieron a escribir el estado a mano; tiene que salir de ESTADOS_MERCADO / ESTADO_ACEPTADO:\n   '
      + culpables.join('\n   '));
  });

  it('y en la fuente de la app cada uno está escrito UNA sola vez', () => {
    const cuenta = { esperando: 0, aceptado: 0 };
    for (const m of soloCodigo(leer('guajirago/src/estadosViaje.js')).matchAll(A_MANO)) cuenta[m[1]]++;
    assert.deepStrictEqual(cuenta, { esperando: 1, aceptado: 1 },
      'src/estadosViaje.js tiene que declarar cada estado vivo una sola vez (ESTADOS_MERCADO y ESTADO_ACEPTADO)');
  });
});

describe('G55 · las comparaciones del servidor, ejecutadas estado por estado', () => {
  const piezas = { ESTADOS_MERCADO: srv.ESTADOS_MERCADO, ESTADO_ACEPTADO: srv.ESTADO_ACEPTADO };

  it('notificarNuevoViaje avisa solo de los viajes que buscan conductor', () => {
    const cond = condicionDelIf(cuerpoDe(INDEX, 'notificarNuevoViaje'), 'viaje.estado');
    for (const estado of TODOS) {
      assert.strictEqual(ejecutar(cond, { ...piezas, viaje: { estado } }), !enMercado(estado),
        'notificarNuevoViaje con estado «' + estado + '»');
    }
  });

  it('notificarNuevaOferta avisa solo si el viaje sigue buscando conductor', () => {
    const cond = condicionDelIf(cuerpoDe(INDEX, 'notificarNuevaOferta'), 'despues.estado');
    for (const estado of TODOS) {
      assert.strictEqual(ejecutar(cond, { ...piezas, despues: { estado } }), !enMercado(estado),
        'notificarNuevaOferta con estado «' + estado + '»');
    }
  });

  it('confirmarConductor solo confirma un viaje del mercado, y lo deja en ESTADO_ACEPTADO de la app', () => {
    const cuerpo = cuerpoDe(INDEX, 'confirmarConductor');
    const cond = condicionDelIf(cuerpo, 'viaje_no_disponible');
    for (const estado of TODOS) {
      assert.strictEqual(ejecutar(cond, { ...piezas, viaje: { estado } }), !enMercado(estado),
        'confirmarConductor con estado «' + estado + '»');
    }
    const m = cuerpo.match(/t\.update\(viajeRef,\s*\{\s*estado:\s*([^,\n]+),/);
    assert.ok(m, 'confirmarConductor ya no escribe `estado` al principio de su t.update(viajeRef, …)');
    assert.strictEqual(ejecutar(m[1], piezas), app.ESTADO_ACEPTADO, 'confirmarConductor escribe otro estado que ESTADO_ACEPTADO');
  });

  it('la rutina de colgados cierra las búsquedas como vencido y los aceptados como expirado', () => {
    const AHORA = '2026-09-29T12:00:00.000Z';
    const hace = (m) => new Date(new Date(AHORA).getTime() - m * 60000).toISOString();
    for (const estado of TODOS) {
      const r = queHacerConElViaje({ estado, fechaSolicitud: hace(999), fechaAceptacion: hace(999) }, AHORA);
      const esperado = enMercado(estado) ? 'vencido' : estado === app.ESTADO_ACEPTADO ? 'expirado' : null;
      assert.strictEqual(r.estado, esperado, 'queHacerConElViaje con estado «' + estado + '»');
    }
  });
});

describe('G55 · las comparaciones de la pantalla del conductor, ejecutadas', () => {
  const piezas = { ESTADOS_MERCADO: app.ESTADOS_MERCADO, ESTADO_ACEPTADO: app.ESTADO_ACEPTADO };

  it('suelta el viaje que otro conductor ganó', () => {
    const cond = condicionDelIf(CONDUCTOR, 'data.conductorId !== miId');
    for (const estado of TODOS) {
      assert.strictEqual(ejecutar(cond, { ...piezas, data: { estado, conductorId: 'otro' }, miId: 'yo' }),
        estado === app.ESTADO_ACEPTADO, 'viaje de otro con estado «' + estado + '»');
    }
  });

  it('suelta el viaje cuyo pasajero subió la oferta, solo si sigue buscando', () => {
    const cond = condicionDelIf(CONDUCTOR, 'data.nuevaOferta');
    for (const estado of TODOS) {
      assert.strictEqual(!!ejecutar(cond, { ...piezas, data: { estado, nuevaOferta: 'x' } }), enMercado(estado),
        'oferta subida con estado «' + estado + '»');
    }
  });

  it('al ganar un viaje, libera solo sus otros viajes que siguen buscando, sin cambiarles el estado', () => {
    const cond = condicionDelIf(CONDUCTOR, 'idViajeGanador &&');
    const m = CONDUCTOR.slice(CONDUCTOR.indexOf('idViajeGanador &&'))
      .match(/updateDoc\(doc\(db, 'viajes', d\.id\),\s*\{\s*estado:\s*([^,\n]+),/);
    assert.ok(m, 'limpiarViajesOtrosConductor ya no escribe `estado` al soltar el viaje');
    for (const estado of TODOS) {
      const d = { id: 'v2', data: () => ({ estado }) };
      const entra = ejecutar(cond, { ...piezas, d, idViajeGanador: 'v1' });
      assert.strictEqual(entra, enMercado(estado), 'otro viaje mío con estado «' + estado + '»');
      if (entra) assert.strictEqual(ejecutar(m[1], { ...piezas, d }), estado, 'le cambió el estado al soltarlo');
    }
  });
});
