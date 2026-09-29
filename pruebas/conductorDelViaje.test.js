/**
 * G59 (29-sep-2026) · LOS DATOS DEL CONDUCTOR EN EL VIAJE: UNA LISTA, ATADA AL SERVIDOR, Y UN SOLO CAMINO PARA ACEPTAR
 *
 * `confirmarConductor` (guajirago/functions/index.js) es el único que pone al conductor en el viaje. La app lleva la
 * copia de sus campos en `guajirago/src/conductorDelViaje.js` (las funciones no se importan), y esta prueba:
 *   1. EJECUTA el objeto que escribe `confirmarConductor` y exige que sus campos `conductor…` sean la lista de la app,
 *      y que cada campo más que escriba esté clasificado aquí (un campo nuevo obliga a decidir si se borra al soltar);
 *   2. EJECUTA cada escritura de la app que suelta al conductor y exige que no deje NINGÚN campo suyo sin borrar;
 *   3. exige que la app no ponga el viaje en «aceptado» (eso lo hace el servidor) y que la ventanita muerta
 *      «¿Confirmas este viaje?» no vuelva;
 *   4. prohíbe borrar a mano campos del conductor fuera de la pieza;
 *   5. le da al medidor pantallas de mentira y exige que se queje de todas (el medidor no se puede ablandar).
 * El recorrido vive UNA vez, en scripts/medir-conductor-soltado.cjs: aquí se importa.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo, cargarDeLaApp } = require('./cargar.cjs');
const M = require('../scripts/medir-conductor-soltado.cjs');

const pieza = cargarDeLaApp('guajirago/src/conductorDelViaje.js');
const INDEX = leer('guajirago/functions/index.js');

// Lo que `confirmarConductor` escribe en el viaje y NO es del conductor: se queda al soltarlo. Si el servidor escribe
// un campo que no está aquí ni en la lista del conductor, esta prueba se pone roja hasta que alguien decida.
const DEL_VIAJE = ['estado', 'tarifa', 'tarifaValor', 'fechaAceptacion', 'comisionCobrada', 'descuentoInfo'];

const ordenada = (a) => [...a].sort();

describe('G59 · la lista del conductor está atada a confirmarConductor', () => {
  it('los campos conductor… que escribe el servidor son exactamente los de la app', () => {
    const s = M.camposDelServidor(INDEX);
    assert.deepStrictEqual(s.delConductor, ordenada(pieza.CAMPOS_DEL_CONDUCTOR),
      'confirmarConductor y conductorDelViaje.js ya no dicen lo mismo: al soltar al conductor quedarían restos suyos');
  });

  it('cada otro campo que escribe el servidor está clasificado', () => {
    const s = M.camposDelServidor(INDEX);
    const sinClasificar = s.todos.filter((k) => !pieza.CAMPOS_DEL_CONDUCTOR.includes(k) && !DEL_VIAJE.includes(k));
    assert.deepStrictEqual(sinClasificar, [],
      'confirmarConductor escribe campos nuevos: ¿son del conductor (van en conductorDelViaje.js) o del viaje?');
  });

  it('sinConductor() pone en null cada campo de la lista, y nada más', () => {
    const o = pieza.sinConductor();
    assert.deepStrictEqual(ordenada(Object.keys(o)), ordenada(pieza.CAMPOS_DEL_CONDUCTOR));
    for (const k of Object.keys(o)) assert.strictEqual(o[k], null, k + ' no queda en null');
  });
});

describe('G59 · la app suelta al conductor entero y no acepta por su cuenta', () => {
  const r = M.medirCodigo(null);

  it('soltar al conductor (limpiarViajesOtrosConductor) no deja ningún campo suyo', () => {
    assert.ok(r.sueltan.some((s) => s.donde.startsWith('AppConductor.js:')),
      'no encuentro la escritura con la que el conductor suelta sus otros viajes');
    for (const s of r.sueltan) assert.deepStrictEqual(s.leQuedan, [], s.donde + ' deja sin borrar: ' + s.leQuedan.join(', '));
  });

  it('la app no pone el viaje en «aceptado»: eso lo hace solo confirmarConductor', () => {
    assert.deepStrictEqual(r.aceptan, [], 'la app vuelve a aceptar a mano, sin cobrar la comisión ni marcar al conductor');
  });

  it('la ventanita muerta «¿Confirmas este viaje?» no vuelve', () => {
    assert.strictEqual(r.ventanita.existe, false, 'volvió confirmacionPendiente a Solicitar.js');
    assert.ok(!/\b(confirmarViaje|rechazarConfirmacion)\b/.test(soloCodigo(leer('guajirago/src/Solicitar.js'))),
      'volvieron confirmarViaje o rechazarConfirmacion');
  });

  it('nadie borra a mano un campo del conductor fuera de la pieza', () => {
    const fs = require('fs');
    const path = require('path');
    const carpeta = path.join(__dirname, '..', 'guajirago', 'src');
    const culpables = [];
    for (const n of fs.readdirSync(carpeta).filter((x) => x.endsWith('.js') && x !== 'conductorDelViaje.js')) {
      const c = soloCodigo(fs.readFileSync(path.join(carpeta, n), 'utf8'));
      const m = c.match(/\bconductor[A-Z]\w*\s*:\s*null\b/g);
      if (m) culpables.push(n + ' (' + m.length + ')');
    }
    assert.deepStrictEqual(culpables, [], 'lista a mano de campos del conductor: úsese sinConductor()');
  });
});

describe('G59 · el medidor no se puede ablandar', () => {
  const reales = M.piezasDeLaApp(null);
  const pantalla = (cuerpo) => 'function P() {\n' + cuerpo + '\n}\n';

  it('ve el resto que deja una lista a mano sin foto ni color', () => {
    const e = M.escriturasDeLaApp({ 'guajirago/src/X.js': pantalla(
      "updateDoc(doc(db, 'viajes', id), { estado: 'esperando', conductorId: null, conductorNombre: null });") },
    reales, pieza.CAMPOS_DEL_CONDUCTOR);
    assert.strictEqual(e.sueltan.length, 1);
    assert.ok(e.sueltan[0].leQuedan.includes('conductorFoto') && e.sueltan[0].leQuedan.includes('conductorColor'));
  });

  it('da por buena la escritura con sinConductor(), que ejecuta de verdad', () => {
    const e = M.escriturasDeLaApp({ 'guajirago/src/X.js': pantalla(
      "updateDoc(doc(db, 'viajes', d.id), { estado: d.data().estado, ...sinConductor() }).catch(() => {});") },
    reales, pieza.CAMPOS_DEL_CONDUCTOR);
    assert.deepStrictEqual(e.sueltan.map((s) => s.leQuedan), [[]]);
  });

  it('ve el «aceptado» a mano, escrito con texto o con la pieza de estados', () => {
    const e = M.escriturasDeLaApp({ 'guajirago/src/X.js': pantalla(
      "updateDoc(doc(db, 'viajes', id), { estado: 'aceptado' });\nupdateDoc(doc(db, 'viajes', id), { estado: ESTADO_ACEPTADO });") },
    reales, pieza.CAMPOS_DEL_CONDUCTOR);
    assert.strictEqual(e.aceptan.length, 2);
  });

  it('distingue la ventanita muerta de una que se abre', () => {
    const muerta = "const [confirmacionPendiente, setConfirmacionPendiente] = useState(null);\n"
      + "const x = confirmacionPendiente;\nsetConfirmacionPendiente(null);\nsetConfirmacionPendiente(x);";
    assert.strictEqual(M.laVentanitaDeConfirmar(muerta).existe, true, 'no ve que la ventanita existe');
    assert.strictEqual(M.laVentanitaDeConfirmar('const a = 1;').existe, false);
    assert.strictEqual(M.laVentanitaDeConfirmar(muerta).entradas, 0);
    assert.strictEqual(M.laVentanitaDeConfirmar(muerta + '\nsetConfirmacionPendiente(o);').entradas, 1);
    assert.strictEqual(M.laVentanitaDeConfirmar(muerta.replace('useState(null)', 'useState(viaje)')).entradas, 1);
  });

  it('ve un campo nuevo del conductor en el servidor', () => {
    const roto = INDEX.replace('conductorColor: of.conductorColor || "",',
      'conductorColor: of.conductorColor || "",\n        conductorApodo: of.conductorApodo || "",');
    assert.notStrictEqual(roto, INDEX, 'el ancla del servidor no calzó');
    assert.ok(M.camposDelServidor(roto).delConductor.includes('conductorApodo'));
  });

  it('cuenta los restos de un conductor soltado en los datos', () => {
    const d = M.restosEnLosViajes([
      { id: 'a', estado: 'cancelado', conductorId: null, conductorFoto: 'f', conductorColor: 'Gris' },
      { id: 'b', estado: 'cancelado', conductorId: null, conductorNombre: null },
      { id: 'c', estado: 'finalizado', conductorId: 'u', conductorFoto: 'f' },
      { id: 'd', estado: 'esperando', conductorId: 'u' },
    ], pieza.CAMPOS_DEL_CONDUCTOR, ['esperando']);
    assert.deepStrictEqual(d.restos.map((v) => v.id), ['a']);
    assert.deepStrictEqual(d.mercadoConConductor.map((v) => v.id), ['d']);
  });
});
