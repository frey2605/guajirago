// ═══════════════════════════════════════════════════════════════════════════
//  CERRAR EL EMULADOR HUÉRFANO · solo lo que se quedó solo, y solo si se pide
//
//  scripts/cerrar-emulador-huerfano.cjs apaga procesos, y un guion que apaga
//  procesos tiene que demostrar lo que NO apaga. Aquí se le dan listas de mentira
//  y un «cerrar» de mentira que solo anota: nada de esta prueba cierra nada real.
//  Se exige que: sin --de-verdad no cierre nada; que solo cierre lo que es del
//  emulador demo-guajirago con el padre muerto; que vuelva a preguntar justo antes
//  de cerrar (Windows reusa los números de proceso); y que el criterio lo saque del
//  medidor, no de una copia (SEGUNDA LEY).
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { leer, soloCodigo } = require('./cargar.cjs');
const H = require('../scripts/cerrar-emulador-huerfano.cjs');

const fila = (pid, puerto, padre, proyecto) => ({ puerto, nombre: 'x', pid: String(pid), desde: '2026-09-25 16:03', padre, proyecto });
const JAVA_SOLO = { nombre: 'java.exe', padre: 'MUERTO', cmd: 'java -jar cloud-firestore-emulator.jar --project_id=demo-guajirago' };

describe('CERRAR EL EMULADOR HUÉRFANO · solo lo que se quedó solo, y solo si se pide', () => {
  it('candidatos: solo demo-guajirago con el padre muerto, un proceso una vez aunque tenga dos puertos', () => {
    const filas = [
      fila(10196, 1101, 'MUERTO', 'demo-guajirago'),
      fila(10196, 1102, 'MUERTO', 'demo-guajirago'),
      fila(2000, 1103, 'vivo', 'demo-guajirago'),
      fila(3000, 1104, 'MUERTO', 'demo-otro'),
      fila(4000, 1105, 'MUERTO', '?'),
    ];
    assert.deepStrictEqual(H.elegibles(filas), [{ pid: 10196, puertos: [1101, 1102] }]);
    assert.deepStrictEqual(H.elegibles(null), [], 'fuera de Windows no hay candidatos');
    assert.deepStrictEqual(H.elegibles([]), []);
  });

  it('la última palabra antes de cerrar: Java o node, padre muerto y proyecto demo-guajirago exacto', () => {
    assert.strictEqual(H.sePuedeCerrar(JAVA_SOLO).si, true);
    assert.strictEqual(H.sePuedeCerrar({ ...JAVA_SOLO, nombre: 'node.exe' }).si, true);
    assert.strictEqual(H.sePuedeCerrar(null).si, false, 'si ya no existe no se cierra');
    assert.strictEqual(H.sePuedeCerrar({ ...JAVA_SOLO, padre: 'vivo' }).si, false, '⛔ una tanda en marcha no se toca');
    assert.strictEqual(H.sePuedeCerrar({ ...JAVA_SOLO, nombre: 'chrome.exe' }).si, false, '⛔ solo java o node');
    assert.strictEqual(H.sePuedeCerrar({ ...JAVA_SOLO, cmd: 'java --project_id=demo-talaria' }).si, false, '⛔ el emulador de otro proyecto no es nuestro');
    assert.strictEqual(H.sePuedeCerrar({ ...JAVA_SOLO, cmd: 'java --project_id=demo-guajirago-x' }).si, false, '⛔ el nombre tiene que ser exacto');
    assert.strictEqual(H.sePuedeCerrar({ ...JAVA_SOLO, cmd: 'java -jar algo.jar' }).si, false, '⛔ sin proyecto no se cierra');
    for (const x of [null, { ...JAVA_SOLO, padre: 'vivo' }]) assert.ok(H.sePuedeCerrar(x).porque, 'y dice por qué no');
  });

  const correr = (argv, { filas, revision = () => JAVA_SOLO, despues = [] }) => {
    const cerrados = [];
    let vuelta = 0;
    const r = H.principal({
      argv, log: () => {},
      mirar: () => (vuelta++ === 0 ? filas : despues),
      revisar: revision,
      cerrarUno: (pid) => cerrados.push(pid),
    });
    return { r, cerrados };
  };
  const DOS = [fila(10196, 1101, 'MUERTO', 'demo-guajirago'), fila(777, 1102, 'MUERTO', 'demo-guajirago')];

  it('SIN --de-verdad no cierra nada, aunque haya huérfanos: es un simulacro', () => {
    const { r, cerrados } = correr([], { filas: DOS });
    assert.deepStrictEqual(cerrados, [], '⛔ el simulacro cerró procesos');
    assert.strictEqual(r.candidatos.length, 2, 'pero sí dice cuáles cerraría');
  });

  it('CON --de-verdad cierra solo los que pasan la revisión de ese momento', () => {
    // 777 se reusó entre la lista y el cierre: ahora es otro programa.
    const revision = (pid) => (pid === 777 ? { nombre: 'chrome.exe', padre: 'vivo', cmd: 'chrome' } : JAVA_SOLO);
    const { r, cerrados } = correr(['--de-verdad'], { filas: DOS, revision });
    assert.deepStrictEqual(cerrados, [10196]);
    assert.deepStrictEqual(r.saltados.map((s) => s.pid), [777], '⛔ se cerró un proceso que ya no era el huérfano');
  });

  it('CON --de-verdad y sin huérfanos no cierra nada, y una tanda viva nunca es candidata', () => {
    const viva = [fila(2000, 1101, 'vivo', 'demo-guajirago'), fila(3000, 1104, 'MUERTO', 'demo-otro')];
    assert.deepStrictEqual(correr(['--de-verdad'], { filas: viva }).cerrados, []);
    assert.deepStrictEqual(correr(['--de-verdad'], { filas: null }).cerrados, [], 'fuera de Windows no se toca nada');
  });

  it('después de cerrar vuelve a mirar, y dice si quedó alguno', () => {
    const quedo = [fila(10196, 1101, 'MUERTO', 'demo-guajirago')];
    assert.strictEqual(correr(['--de-verdad'], { filas: DOS, despues: quedo }).r.quedan.length, 1);
    assert.strictEqual(correr(['--de-verdad'], { filas: DOS, despues: [] }).r.quedan.length, 0);
  });

  it('el criterio de «quién ocupa el puerto» sale del medidor, no de una copia (SEGUNDA LEY)', () => {
    const t = soloCodigo(leer('scripts/cerrar-emulador-huerfano.cjs'));
    assert.match(t, /require\('\.\/medir-emulador-colgado\.cjs'\)/, '⛔ el guion no usa quienOcupa del medidor');
    assert.ok(!/Get-NetTCPConnection/.test(t), '⛔ el guion lleva su propia copia de la lista de puertos');
    assert.strictEqual((t.match(/Stop-Process/g) || []).length, 1, '⛔ cerrar procesos vive en UN sitio del guion');
  });
});
