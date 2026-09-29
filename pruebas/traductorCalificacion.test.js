// G68 · QUÉ CLASE DE FALLO ES lo decide UNA pieza: `motivoDeRechazo` de guajirago/src/avisoRechazo.js.
//
// La calificación (avisoCalificacion.js) tenía su propia `motivoDeRechazo` —con el MISMO nombre— y su propia
// `apuntarRechazo`. El 26-sep la pieza aprendió a quitarle el apellido al código («functions/permission-denied») y la
// de la calificación no: 3 de 42 errores caían en otra clase, y la clase es lo que se guarda en la bandeja.
// Ahora la calificación le pregunta la clase a la pieza y solo pone SUS palabras (MOTIVOS).
//
// Esta prueba CORRE los dos traductores con la misma lista de errores (scripts/medir-traductores-g68.cjs), y le da al
// medidor traductores de mentira para comprobar que los ve.
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const { RAIZ, leer, soloCodigo } = require('./cargar.cjs');
const M = require('../scripts/medir-traductores-g68.cjs');

const CALIF = 'guajirago/src/avisoCalificacion.js';

describe('G68 · la calificación clasifica el fallo con la pieza de todos', () => {
  const hoy = M.medir();

  it('EL QUE MUERDE · con la MISMA lista de errores, la calificación da la misma clase que la pieza', () => {
    assert.ok(hoy.casos.length >= 40, 'la lista de errores se quedó corta: ' + hoy.casos.length);
    assert.deepStrictEqual(hoy.distintos.map((d) => d.error + ': ' + d.deLaPieza + ' / ' + d.deLaCalif), [],
      'la calificación clasifica distinto que avisoRechazo.js');
    // Y los que se separaron el 26-sep, con nombre: con apellido de las funciones.
    const de = (err) => hoy.casos.find((c) => c.error === err);
    assert.strictEqual(de('functions/permission-denied').deLaCalif, 'permiso');
    assert.strictEqual(de('functions/unavailable').deLaCalif, 'sinRed');
    assert.strictEqual(de('functions/deadline-exceeded').deLaCalif, 'sinRed');
  });

  it('la calificación sigue diciendo SUS palabras, una por clase', () => {
    assert.ok(hoy.palabrasPropias, 'algún caso devuelve un texto que no es de MOTIVOS');
    const { motivoDeCalificacion, MOTIVOS } = require('./cargar.cjs').cargarDeLaApp(CALIF);
    assert.strictEqual(motivoDeCalificacion({ code: 'permission-denied' }), MOTIVOS.permiso);
    assert.strictEqual(motivoDeCalificacion({ code: 'functions/unavailable' }), MOTIVOS.sinRed);
    assert.strictEqual(motivoDeCalificacion(null), MOTIVOS.otro);
    assert.ok(/calificaci/.test(MOTIVOS.permiso.titulo), 'el título dejó de hablar de la calificación');
  });

  it('EL QUE MUERDE · en la app hay UNA motivoDeRechazo y UNA apuntarRechazo, las de avisoRechazo.js', () => {
    assert.deepStrictEqual(hoy.defs.motivoDeRechazo, ['guajirago/src/avisoRechazo.js']);
    assert.deepStrictEqual(hoy.defs.apuntarRechazo, ['guajirago/src/avisoRechazo.js']);
    const c = soloCodigo(leer(CALIF));
    assert.ok(!/codigo\s*===/.test(c) && !/\.code\b/.test(c),
      CALIF + ' vuelve a mirar el código del error por su cuenta: la clase la decide avisoRechazo.js');
    assert.ok(/import\s*\{\s*motivoDeRechazo\s*\}\s*from\s*'\.\/avisoRechazo'/.test(c),
      CALIF + ' ya no le pregunta la clase a avisoRechazo.js');
  });

  it('las dos pantallas que califican piden el texto a la calificación y el rastro a la pieza', () => {
    const quien = hoy.importan.avisoCalificacion.map((x) => x.split(' → ')[0]).sort();
    assert.deepStrictEqual(quien, ['guajirago/src/Calificacion.js', 'guajirago/src/Restaurantes.js']);
    for (const x of hoy.importan.avisoCalificacion) {
      assert.strictEqual(x.split(' → ')[1], 'motivoDeCalificacion', 'importa de más: ' + x);
    }
    for (const f of quien) {
      assert.ok(hoy.importan.avisoRechazo.some((x) => x.startsWith(f + ' → ') && /\bapuntarRechazo\b/.test(x)),
        f + ' no saca apuntarRechazo de avisoRechazo.js');
    }
  });

  it('no hay copias de avisoCalificacion.js en el panel ni en aliados (no hay nada que atar)', () => {
    assert.deepStrictEqual(hoy.copias, []);
  });
});

describe('G68 · el medidor ve lo que tiene que ver', () => {
  it('EL QUE MUERDE · con el traductor de antes (su propia clasificación) cuenta los 3 que se separaron', () => {
    // La calificación como estaba en 1f3b28c: su motivoDeRechazo sin quitar el apellido.
    let vieja;
    try {
      vieja = execFileSync('git', ['show', '1f3b28c:' + CALIF], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { vieja = null; }
    assert.ok(vieja, 'no pude sacar ' + CALIF + ' del commit 1f3b28c');
    // Contra la pieza COMO LA DEJÓ G68 (2387169). Desde G71 (29-sep-2026) la pieza también reconoce la falta de señal
    // de las cuentas («network-request-failed»), así que contra la de hoy la vieja se separa en 2 más: eso ya no es
    // lo que G68 arregló, y este careo mide lo de G68.
    let piezaG68;
    try {
      piezaG68 = execFileSync('git', ['show', '2387169:guajirago/src/avisoRechazo.js'], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch (e) { piezaG68 = null; }
    assert.ok(piezaG68, 'no pude sacar avisoRechazo.js del commit 2387169');
    const r = M.medir({ fuenteCalif: vieja, fuentePieza: piezaG68 });
    assert.strictEqual(r.traductor, 'motivoDeRechazo');
    assert.deepStrictEqual(r.distintos.map((d) => d.error).sort(),
      ['functions/deadline-exceeded', 'functions/permission-denied', 'functions/unavailable']);
  });

  it('una calificación que se inventa la clase también se ve', () => {
    const rota = leer(CALIF).replace(
      "return MOTIVOS[motivoDeRechazo(e, 'guardar tu calificación').clave] || MOTIVOS.otro;",
      "return (e && e.code === 'unavailable') ? MOTIVOS.otro : (MOTIVOS[motivoDeRechazo(e, 'x').clave] || MOTIVOS.otro);");
    assert.notStrictEqual(rota, leer(CALIF), 'la pieza de mentira no calzó');
    assert.ok(M.medir({ fuenteCalif: rota }).distintos.length > 0, 'el medidor no vio la clase inventada');
  });

  it('una apuntarRechazo gemela que vuelva a nacer en la calificación también se cuenta', () => {
    const rota = leer(CALIF).replace('export function motivoDeCalificacion(e) {',
      "export function apuntarRechazo(donde, e) { console.error(donde, e); }\nexport function motivoDeCalificacion(e) {");
    assert.notStrictEqual(rota, leer(CALIF), 'la pieza de mentira no calzó');
    assert.deepStrictEqual(M.medir({ fuenteCalif: rota }).defs.apuntarRechazo.sort(),
      [CALIF, 'guajirago/src/avisoRechazo.js']);
  });

  it('una calificación que devuelve textos que no son suyos también se ve', () => {
    const rota = leer(CALIF).replace(
      "return MOTIVOS[motivoDeRechazo(e, 'guardar tu calificación').clave] || MOTIVOS.otro;",
      "return motivoDeRechazo(e, 'guardar tu calificación');");
    assert.notStrictEqual(rota, leer(CALIF), 'la pieza de mentira no calzó');
    assert.strictEqual(M.medir({ fuenteCalif: rota }).palabrasPropias, false);
  });
});
