/**
 * G89 (30-sep-2026) · 🍽️ RESTAURANTES y 🧭 TURISMO DEL PANEL SON UNA SOLA PANTALLA
 *
 * Eran dos archivos casi iguales (guajirago-admin/src/Restaurantes.js y Turismo.js, 184 renglones iguales). Ahora es
 * NegociosDeUnTipo.js, que recibe el tipo, y lo propio de cada uno vive en tiposDeNegocio.js, con nombre.
 *
 * Lo que se comprueba, EJECUTANDO:
 *   1. la pantalla está escrita UNA vez y los dos archivos de antes ya no existen;
 *   2. lo propio de cada tipo (tiposDeNegocio.js) corrido: los dos tipos tienen la misma forma y cada negocio cae en
 *      UNO solo;
 *   3. el CAREO con el panel de antes (0f89437): scripts/medir-pantallas-negocios.cjs pinta con React, en un navegador
 *      de mentira, el renglón de App.js que abre cada módulo, lo recorre como una persona (secciones, buscar, cada
 *      ficha) y aprieta Aprobar / Suspender / Rechazar / WhatsApp contra una base de mentira. Paso por paso, el HTML,
 *      lo escrito y lo abierto tienen que ser IGUALES;
 *   4. el lector no se puede ablandar: con pantallas de mentira (un texto cambiado, una escritura de más, App.js sin
 *      la llave) el careo se queja.
 */
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ, leer, cargarDeLaApp, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-pantallas-negocios.cjs');

const SRC = path.join(RAIZ, 'guajirago-admin', 'src');
const PANTALLA = 'guajirago-admin/src/NegociosDeUnTipo.js';
const TIPOS = 'guajirago-admin/src/tiposDeNegocio.js';

/** Un archivo del panel (dentro de src/) con un cambio puesto; exige que el texto de antes calce UNA vez. */
function conCambio(ruta, de, a) {
  const t = fs.readFileSync(path.join(RAIZ, 'guajirago-admin', ruta), 'utf8');
  assert.strictEqual(t.split(de).length - 1, 1, 'la pantalla de mentira no calza en ' + ruta + ': «' + de + '»');
  return { [ruta]: t.replace(de, a) };
}

describe('G89 · la pantalla de negocios del panel está escrita UNA vez', () => {
  it('una sola copia, y Restaurantes.js / Turismo.js ya no existen en el panel', () => {
    const c = M.elCodigo(null);
    assert.deepStrictEqual(c.copias, ['src/NegociosDeUnTipo.js'], 'la pantalla está escrita en: ' + c.copias.join(', '));
    for (const f of ['Restaurantes.js', 'Turismo.js']) assert.ok(!fs.existsSync(path.join(SRC, f)), 'volvió guajirago-admin/src/' + f);
  });

  it('App.js abre los dos módulos con la pantalla única, cada uno con su tipo y su llave', () => {
    const t = soloCodigo(leer('guajirago-admin/src/App.js'));
    assert.match(t, /if \(modulo === 'restaurantes'\) return <NegociosDeUnTipo key="restaurante" tipo="restaurante" /);
    assert.match(t, /if \(modulo === 'turismo'\) return <NegociosDeUnTipo key="turismo" tipo="turismo" /);
    assert.doesNotMatch(t, /from '\.\/(Restaurantes|Turismo)'/, 'App.js sigue importando una pantalla vieja');
  });

  it('lo propio de cada tipo, corrido: la misma forma, y cada negocio cae en UN tipo', () => {
    const { TIPOS_DE_NEGOCIO: T } = cargarDeLaApp(TIPOS);
    assert.deepStrictEqual(Object.keys(T).sort(), ['restaurante', 'turismo']);
    const forma = (o) => Object.keys(o).sort().map((k) => k + (o[k] && typeof o[k] === 'object' && !Array.isArray(o[k]) ? '{' + forma(o[k]) + '}' : '')).join(',');
    assert.strictEqual(forma(T.turismo), forma(T.restaurante), 'los dos tipos no tienen la misma forma: la pantalla pediría algo que uno no trae');
    for (const n of [{}, { tipoNegocio: 'restaurante' }, { tipoNegocio: 'turismo' }, { tipoNegocio: 'otro' }]) {
      assert.strictEqual([T.restaurante, T.turismo].filter((t) => t.esDelTipo(n)).length, 1, JSON.stringify(n) + ' no cae en un solo tipo');
    }
    assert.strictEqual(T.restaurante.encargos.coleccion, 'pedidos');
    assert.strictEqual(T.turismo.encargos.coleccion, 'reservasTurismo');
  });

  it('la pantalla no escribe a mano ningún texto de un tipo (sale de tiposDeNegocio.js)', () => {
    const t = soloCodigo(leer(PANTALLA));
    for (const x of ['restaurante', 'agencia', 'RESTAURANTES', 'TURISMO', '🍽️', '🧭', "'pedidos'", "'reservasTurismo'", 'platos', 'tours']) {
      assert.ok(!t.includes(x), PANTALLA + ' escribe «' + x + '» a mano: va en tiposDeNegocio.js');
    }
  });
});

describe('G89 · se ve y escribe IGUAL que antes (pintada con React y careada con 0f89437)', () => {
  let antes;
  let ahora;
  before(async () => {
    antes = await M.recorrido(M.ANTES);
    ahora = await M.recorrido(null);
  });

  it('el careo paso por paso: 0 distintas', () => {
    assert.ok(ahora.length >= 90, 'el recorrido se quedó corto: ' + ahora.length + ' pasos');
    const c = M.carear(antes, ahora);
    assert.deepStrictEqual(c.distintas, [], 'la pantalla se ve o escribe distinto que antes');
    assert.ok(c.comparaciones >= 450, 'el careo comparó poco: ' + c.comparaciones);
  });

  it('lo que escriben los botones, uno por uno (y el de antes escribía lo mismo)', () => {
    const esc = M.escriturasDe(ahora);
    assert.strictEqual(esc.length, 13, 'escrituras: ' + esc.join('\n'));
    assert.deepStrictEqual(esc, M.escriturasDe(antes));
    for (const e of esc) assert.match(e, / → negocios\/[RA]\d /, 'escribe fuera de su negocio: ' + e);
    assert.ok(esc.some((e) => /Suspender → negocios\/A1 \{"aprobado":false,"estadoAprobacion":"suspendido"\}$/.test(e)), 'Suspender de turismo');
    assert.ok(esc.some((e) => /Rechazar → negocios\/R2 \{"aprobado":false,"estadoAprobacion":"rechazado","fechaRechazo":"2026-09-29T20:30:00.000Z"\}$/.test(e)), 'Rechazar de restaurante');
  });

  it('el aviso de un rechazo del servidor sale con su tipo, y la consola nombra la pantalla única', () => {
    const r = ahora.find((p) => p.paso === 'turismo · ficha 0 · ✅ Aprobar (el servidor dice que no)');
    assert.ok(r && r.html.includes('No se pudo aprobar la agencia'), 'no salió «No se pudo aprobar la agencia»');
    assert.deepStrictEqual(r.consola, ['[rechazo] NegociosDeUnTipo.js (turismo · aprobar) · permission-denied · Missing or insufficient permissions.']);
    const w = ahora.find((p) => p.paso.startsWith('restaurantes · ficha 1 · 💬 WhatsApp'));
    assert.ok(w && w.html.includes('El teléfono guardado de este restaurante («abc»)'), 'el aviso del WhatsApp no nombra al restaurante');
  });

  it('de 🍽️ Restaurantes (con una ficha abierta) a 🧭 Turismo sale la lista de agencias', () => {
    const r = ahora.find((p) => p.paso.startsWith('de 🍽️'));
    assert.ok(r.html.includes('TURISMO') && r.html.includes('Todas las agencias (4)'), 'al pasar de módulo no salen las agencias');
    assert.ok(!r.html.includes('Menú ('), 'al pasar de módulo sigue la ficha del restaurante');
    // Y abre como nueva: ni la sección ni lo buscado en 🍽️ pasan a 🧭.
    const s = ahora.find((p) => p.paso === 'de 🍽️ Restaurantes (en Resumen, con «ana» buscado) a 🧭 Turismo');
    assert.ok(s && s.html.includes('Todas las agencias (4)') && !s.html.includes('Resumen de turismo'), 'Turismo heredó la sección de Restaurantes');
    const b = ahora.find((p) => p.paso.endsWith('a 🧭 Turismo · Todas'));
    assert.ok(b && b.html.includes('Guajira Tours') && b.html.includes('Nueva Agencia'), 'Turismo heredó lo buscado en Restaurantes');
  });

  // Las pantallas de mentira: cada una cambia UNA cosa, y el careo tiene que verla.
  const MENTIRAS = [
    ['el aviso de un botón con otro texto', () => conCambio('src/NegociosDeUnTipo.js', "setAviso(motivoDeRechazo(e, 'rechazar ' + T.elNegocio));", "setAviso(motivoDeRechazo(e, 'rechazar ' + T.esteNegocio));"), 'html'],
    ['Suspender escribe un campo de más', () => conCambio('src/NegociosDeUnTipo.js', "{ aprobado: false, estadoAprobacion: 'suspendido' }", "{ aprobado: false, estadoAprobacion: 'suspendido', activo: false }"), 'escrituras'],
    ['una etiqueta de turismo en masculino', () => conCambio('src/tiposDeNegocio.js', "suspendido: 'SUSPENDIDA'", "suspendido: 'SUSPENDIDO'"), 'html'],
    ['App.js sin la llave del tipo', () => {
      const uno = conCambio('src/App.js', '<NegociosDeUnTipo key="turismo" tipo="turismo"', '<NegociosDeUnTipo tipo="turismo"')['src/App.js'];
      assert.strictEqual(uno.split('<NegociosDeUnTipo key="restaurante" tipo="restaurante"').length - 1, 1, 'la pantalla de mentira no calza en App.js');
      return { 'src/App.js': uno.replace('<NegociosDeUnTipo key="restaurante" tipo="restaurante"', '<NegociosDeUnTipo tipo="restaurante"') };
    }, 'html'],
  ];
  for (const [nombre, cambios, que] of MENTIRAS) {
    it('el lector no se puede ablandar · ' + nombre, async () => {
      // Si la pantalla de mentira ni deja terminar el recorrido (un botón o el buscador que ya no están), también se vio.
      const puestos = cambios();
      let mentira;
      try { mentira = await M.recorrido(null, puestos); } catch (e) {
        assert.match(String(e && e.message), /reading 'dispatchEvent'|reading 'querySelector'/, 'el recorrido reventó por otra cosa: ' + e);
        return;
      }
      const c = M.carear(antes, mentira);
      assert.ok(c.distintas.some((d) => d.que === que), 'el careo no vio «' + nombre + '» (distintas: ' + JSON.stringify(c.distintas.slice(0, 3)) + ')');
    });
  }
});
