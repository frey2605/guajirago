/**
 * G49 · APROBAR UN NEGOCIO ES UNA SOLA ESCRITURA, Y RESPETA LO QUE SE APAGÓ EN COBROS (29-sep-2026)
 *
 * El panel tiene tres botones de «Aprobar» (🍽️ Restaurantes, 🧭 Turismo y 🤝 Aliados pendientes). Cada uno escribía lo
 * suyo, y dos añadían `activo: true`: aprobar volvía a encender «La cuenta está viva» que se había apagado en 💳 Cobros.
 * Decisión: aprobar SOLO aprueba. `activo`, `estadoComercial` y `visibleEnEscaparate` son de Cobros.
 *
 *   1. Cada botón se SACA de su pantalla y se EJECUTA (con el mismo lector de scripts/medir-aprobar-negocio.cjs) contra
 *      un negocio apagado en Cobros, uno frenado en Cobros y uno recién registrado.
 *   2. Los tres escriben lo mismo, y lo escriben por la pieza única (guajirago-admin/src/aprobarNegocio.js).
 *   3. Nadie más en el panel escribe `aprobado: true`.
 *   4. El negocio apagado en Cobros sigue frenado para el servidor después de aprobarlo (negocioPuedeOperar).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { leer, soloCodigo, cuerpoDeLaFuncion, cargarDeLaApp, RAIZ } = require('./cargar.cjs');
const { LOS_BOTONES, CASOS, elBoton, laPieza, losCasos, mismaEscritura } = require('../scripts/medir-aprobar-negocio.cjs');

const PIEZA = 'guajirago-admin/src/aprobarNegocio.js';

describe('G49 · aprobar un negocio: una sola escritura que no pisa lo de Cobros', () => {
  it('los tres botones, ejecutados, aprueban y NO tocan activo, estadoComercial ni visibleEnEscaparate', async () => {
    const { filas, malos } = await losCasos(null);
    assert.strictEqual(filas.length, LOS_BOTONES.length * CASOS.length);
    const malas = filas.filter((f) => f.fallos.length).map((f) => f.nombre + ' · ' + f.caso + ': ' + f.fallos.join(' · '));
    assert.strictEqual(malos, 0, 'aprobar pisa lo de Cobros o no aprueba bien:\n  ' + malas.join('\n  '));
  });

  it('los tres botones escriben exactamente lo mismo', async () => {
    const { filas } = await losCasos(null);
    assert.ok(mismaEscritura(filas), 'los tres botones de aprobar ya no escriben lo mismo: volvió el gemelo');
  });

  it('cada botón aprueba por la pieza única, no con su propia escritura', () => {
    for (const [ruta] of LOS_BOTONES) {
      const archivo = 'guajirago-admin/' + ruta;
      const t = soloCodigo(leer(archivo)).replace(/\r\n/g, '\n');
      assert.match(t, /^import\s*\{\s*aprobarNegocio\s*\}\s*from\s*'\.\/aprobarNegocio';/m, archivo + ' no importa la pieza única');
      const i = t.search(/const aprobar\s*=\s*async\s*\(/);
      assert.ok(i >= 0, 'no encuentro aprobar en ' + archivo);
      const cuerpo = cuerpoDeLaFuncion(t, i).texto;
      assert.match(cuerpo, /aprobarNegocio\s*\(\s*db\s*,/, archivo + ' · aprobar no llama a aprobarNegocio(db, …)');
      assert.doesNotMatch(cuerpo, /\b(updateDoc|setDoc|writeBatch|runTransaction)\s*\(/, archivo + ' · aprobar escribe por su cuenta, además de la pieza');
    }
  });

  it('la pieza: solo los tres campos de la aprobación, ninguna llave de Cobros', () => {
    const P = laPieza(null, { doc: () => ({}), updateDoc: async () => {} });
    assert.ok(P && typeof P.camposAlAprobar === 'function' && typeof P.aprobarNegocio === 'function', 'no está la pieza ' + PIEZA);
    const c = P.camposAlAprobar(new Date('2026-09-29T15:00:00Z'));
    assert.deepStrictEqual(c, { aprobado: true, estadoAprobacion: 'aprobado', fechaAprobacion: '2026-09-29T15:00:00.000Z' });
  });

  it('nadie más en el panel escribe `aprobado: true` (el gemelo no puede volver por otra pantalla)', () => {
    const carpeta = path.join(RAIZ, 'guajirago-admin', 'src');
    const conAprobado = fs.readdirSync(carpeta).filter((f) => f.endsWith('.js'))
      .filter((f) => /\baprobado\s*:\s*true\b/.test(soloCodigo(fs.readFileSync(path.join(carpeta, f), 'utf8'))));
    assert.deepStrictEqual(conAprobado, ['aprobarNegocio.js'], 'escriben `aprobado: true` fuera de la pieza: ' + conAprobado.join(', '));
  });

  it('el negocio apagado en Cobros sigue frenado para el servidor después de aprobarlo', async () => {
    const { negocioPuedeOperar } = cargarDeLaApp('guajirago-admin/src/horarioNegocio.js');
    for (const [ruta, nombre] of LOS_BOTONES) {
      const boton = elBoton(ruta, null);
      for (const c of CASOS.slice(0, 2)) {
        assert.strictEqual(negocioPuedeOperar(c.negocio), false, 'el caso «' + c.que + '» ya no está frenado');
        const r = await boton({ ...c.negocio });
        assert.strictEqual(negocioPuedeOperar(r.despues), false, nombre + ': aprobar le devolvió el servicio a «' + c.que + '»');
      }
      const r = await boton({ ...CASOS[2].negocio });
      assert.strictEqual(negocioPuedeOperar(r.despues), true, nombre + ': el recién registrado no puede operar después de aprobarlo');
    }
  });
});
