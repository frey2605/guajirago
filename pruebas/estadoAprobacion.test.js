/**
 * G50 · «¿EN QUÉ ESTADO DE APROBACIÓN ESTÁ ESTE NEGOCIO?» — UNA SOLA REGLA PARA LAS TRES LISTAS DEL PANEL (29-sep-2026)
 *
 * 🍽️ Restaurantes, 🧭 Turismo y 🤝 Aliados pendientes decidían cada una a su manera quién está pendiente, aprobado,
 * suspendido o rechazado. En 🤝 Aliados pendientes un negocio SUSPENDIDO salía como un registro nuevo por revisar: sin
 * etiqueta, en naranja, con «Rechazar» y «✅ Aprobar». Ahora las tres usan `estadoDeAprobacion` de
 * guajirago-admin/src/aprobarNegocio.js.
 *
 *   1. De cada pantalla se SACA lo que decide el estado (la etiqueta y el filtro de «Pendientes» de 🍽️/🧭; la tarjeta
 *      ENTERA de 🤝, compilada y pintada con React) y se EJECUTA contra seis casos (mismo lector que
 *      scripts/medir-estado-aprobacion.cjs).
 *   2. La regla, ejecutada, contesta lo que tiene que contestar.
 *   3. Ninguna pantalla del panel lee `.aprobado` ni `.estadoAprobacion` por su cuenta (el gemelo no puede volver).
 *   4. El lector no se puede ablandar: con la tarjeta VIEJA de 🤝 tiene que quejarse.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { soloCodigo, RAIZ } = require('./cargar.cjs');
const { LAS_LISTAS, CASOS, losCasos, laPieza, textoDe } = require('../scripts/medir-estado-aprobacion.cjs');

const PANEL = path.join(RAIZ, 'guajirago-admin', 'src');

describe('G50 · una sola regla del estado de aprobación para las tres listas del panel', () => {
  it('las tres listas, ejecutadas, enseñan el estado que es y cuentan como pendiente solo al pendiente', () => {
    const { filas, malos } = losCasos(null);
    // 6 casos × 🍽️ y 🧭, más los 4 que le llegan a 🤝 (su consulta es aprobado == false).
    assert.strictEqual(filas.length, CASOS.length * 2 + CASOS.filter((c) => c.negocio.aprobado === false).length);
    const malas = filas.filter((f) => f.fallos.length).map((f) => f.lista + ' · ' + f.caso + ': ' + f.fallos.join(' · '));
    assert.strictEqual(malos, 0, 'una lista enseña un estado que no es:\n  ' + malas.join('\n  '));
  });

  it('🤝 Aliados pendientes: el suspendido lleva su etiqueta y no se ofrece a «Rechazar» como un registro nuevo', () => {
    const { filas } = losCasos(null);
    const f = filas.find((x) => x.lista.startsWith('🤝') && x.debe === 'suspendido');
    assert.ok(f, 'no se corrió el caso del suspendido en 🤝');
    assert.strictEqual(f.visto.etiqueta, 'SUSPENDIDO');
    assert.ok(!f.visto.botones.includes('Rechazar'), 'al suspendido se le ofrece «Rechazar»: ' + f.visto.botones.join(' / '));
    assert.ok(f.visto.botones.includes('Reactivar y aprobar'), 'al suspendido no se le ofrece «Reactivar y aprobar»: ' + f.visto.botones.join(' / '));
    const p = filas.find((x) => x.lista.startsWith('🤝') && x.debe === 'pendiente');
    assert.deepStrictEqual(p.visto.botones, ['Rechazar', '✅ Aprobar'], 'el pendiente de verdad ya no se ofrece como antes');
  });

  it('la regla, ejecutada', () => {
    const { estadoDeAprobacion } = laPieza(null);
    assert.strictEqual(typeof estadoDeAprobacion, 'function', 'aprobarNegocio.js no exporta estadoDeAprobacion');
    for (const c of CASOS) assert.strictEqual(estadoDeAprobacion(c.negocio), c.debe, c.que);
    assert.strictEqual(estadoDeAprobacion({ aprobado: false, estadoAprobacion: 'cualquier otra cosa' }), 'pendiente');
    assert.strictEqual(estadoDeAprobacion({ aprobado: true, estadoAprobacion: 'suspendido' }), 'aprobado', 'aprobado lo decide `aprobado`, como el escaparate');
    assert.strictEqual(estadoDeAprobacion(null), 'aprobado');
  });

  it('las tres pantallas importan la regla, y ninguna lee `.aprobado` ni `.estadoAprobacion` por su cuenta', () => {
    for (const l of LAS_LISTAS) {
      const t = soloCodigo(textoDe(l.ruta, null));
      assert.match(t, /^import\s*\{[^}]*\bestadoDeAprobacion\b[^}]*\}\s*from\s*'\.\/aprobarNegocio';/m, l.ruta + ' no importa estadoDeAprobacion');
      const lecturas = t.match(/\.\s*(?:aprobado|estadoAprobacion)\b/g) || [];
      assert.deepStrictEqual(lecturas, [], l.ruta + ' vuelve a leer el estado por su cuenta: ' + lecturas.join(', '));
    }
  });

  it('en TODO el panel, `.estadoAprobacion` solo lo lee la regla (y `.aprobado`, la regla y el escaparate)', () => {
    const js = fs.readdirSync(PANEL).filter((f) => f.endsWith('.js'));
    const leen = (re) => js.filter((f) => re.test(soloCodigo(fs.readFileSync(path.join(PANEL, f), 'utf8'))));
    assert.deepStrictEqual(leen(/\.\s*estadoAprobacion\b/), ['aprobarNegocio.js'], 'otra pantalla decide el estado por su cuenta');
    assert.deepStrictEqual(leen(/\.\s*aprobado\b/), ['aprobarNegocio.js', 'escaparate.js'], 'otra pantalla lee `.aprobado` por su cuenta');
  });

  it('el lector no se puede ablandar: con la tarjeta VIEJA de 🤝 (la del suspendido como pendiente) se queja', () => {
    // La tarjeta de antes de G50, tal cual estaba, con la pieza y las otras dos listas de hoy.
    const vieja = [
      "      ) : lista.map(a => {",
      "        const rechazado = a.estadoAprobacion === 'rechazado';",
      "        return (",
      "          <div key={a.id} style={{ ...card }}>",
      "            {rechazado && <span>RECHAZADO</span>}",
      "            <p>{a.nombre}</p>",
      "            {!rechazado && <button onClick={() => rechazar(a)}>Rechazar</button>}",
      "            <button onClick={() => aprobar(a)}>{guardando === a.id ? '...' : (rechazado ? 'Reactivar y aprobar' : '✅ Aprobar')}</button>",
      "          </div>",
      "        );",
      "      })}",
    ].join('\n');
    const leer = (ruta, commit) => (ruta === 'src/AliadosPendientes.js' ? vieja : textoDe(ruta, commit));
    const { filas, malos } = losCasos(null, leer);
    assert.strictEqual(malos, 1, 'el lector ya no ve al suspendido enseñado como pendiente');
    assert.ok(filas.find((f) => f.fallos.length).lista.startsWith('🤝'));
  });
});
