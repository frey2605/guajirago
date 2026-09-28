// ═══════════════════════════════════════════════════════════════════════════
//  EL ROBOT PROBADOR · nunca entra a producción · 27-sep-2026
//
//  El robot crea cuentas y sube fotos manejando el navegador. Su motor vive en la cuenta del
//  dueño (en su carpeta .claude, uno solo para todos sus proyectos; no es de este repo) y lo de
//  GuajiraGo en robot/comun.cjs. Aquí se EJECUTA la guardia con direcciones de mentira —las de
//  producción, las parecidas y las mal escritas— y se exige que se niegue ANTES de abrir el
//  navegador. Y que ningún recorrido se salte robot/comun.cjs ni lleve la clave dentro.
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const R = require('../robot/comun.cjs');

const RAIZ = path.join(__dirname, '..');
const PRODUCCION = ['https://guajirago.web.app/', 'https://guajirago-admin.web.app/', 'https://guajirago-aliados.web.app/',
  'https://guajirago.firebaseapp.com/'];

describe('EL ROBOT · la base de datos, solo la de pruebas', () => {
  it('la puerta a la base sale de .env.pruebas y dice guajirago-pruebas', () => {
    const b = R.baseDePruebas(fs.readFileSync(path.join(RAIZ, 'guajirago', '.env.pruebas'), 'utf8'));
    assert.strictEqual(b.proyecto, 'guajirago-pruebas');
    assert.ok(b.llave.length > 20);
  });

  it('con otro proyecto —producción, parecidos o ninguno— se niega', () => {
    const prod = fs.readFileSync(path.join(RAIZ, 'guajirago', '.env.produccion'), 'utf8');
    assert.throws(() => R.baseDePruebas(prod), /solo entra a la base de PRUEBAS/, '⛔ el robot entraría a la base de producción');
    for (const p of ['guajirago', 'guajirago-pruebas2', 'GUAJIRAGO-PRUEBAS', '']) {
      assert.throws(() => R.baseDePruebas('REACT_APP_FIREBASE_PROJECT_ID=' + p + '\nREACT_APP_FIREBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'), /PRUEBAS/, '⛔ aceptaría «' + p + '»');
    }
  });

  it('entrarALaBase usa esa puerta y cambia solo los campos dados (updateMask), nunca el documento entero', () => {
    const t = fs.readFileSync(path.join(RAIZ, 'robot', 'comun.cjs'), 'utf8');
    const cuerpo = t.slice(t.indexOf('async function entrarALaBase'), t.indexOf('module.exports'));
    assert.match(cuerpo, /baseDePruebas\(fs\.readFileSync\(path\.join\(__dirname, '\.\.', 'guajirago', '\.env\.pruebas'\)/);
    assert.ok(!/guajirago\/databases|projects\/guajirago\//.test(cuerpo), '⛔ el proyecto va escrito a mano');
    assert.match(cuerpo, /updateMask\.fieldPaths=/, '⛔ cambiar() reescribiría el documento entero');
  });
});

describe('EL PORTERO · distingue al robot de quien habla sin sello (27-sep-2026)', () => {
  const P = require('../robot/portero.cjs');
  const desde = Date.parse('2026-09-27T20:00:00Z');

  it('el cuaderno cuenta solo las llamadas del robot dentro de la ventana, por servicio', () => {
    const cuaderno = ['2026-09-27T19:59:59.000Z firestore', '2026-09-27T20:00:00.000Z firestore', '2026-09-27T20:10:00.000Z firestore',
      '2026-09-27T20:10:01.000Z identitytoolkit', 'basura', ''].join('\r\n');
    assert.deepStrictEqual(P.directasDelRobot(cuaderno, desde), { firestore: 2, identitytoolkit: 1 });
    assert.deepStrictEqual(P.directasDelRobot('', desde), {});
  });

  it('las «sin origen» que anotó el robot no son alarma; las que sobran y los sellos inválidos, sí', () => {
    const soloRobot = P.juzgar({ firestore: { VALID: 9, [P.SIN_ORIGEN]: 4 } }, { firestore: 4 });
    assert.deepStrictEqual(soloRobot.alarmas, []);
    assert.strictEqual(soloRobot.delRobot.length, 1);
    const sobran = P.juzgar({ firestore: { [P.SIN_ORIGEN]: 6 } }, { firestore: 4 });
    assert.match(sobran.alarmas.join(), /2 llamadas sin origen que el robot NO hizo/);
    const invalidas = P.juzgar({ identitytoolkit: { INVALID: 3 } }, { identitytoolkit: 99 });
    assert.match(invalidas.alarmas.join(), /3 llamadas con sello INVALID/, '⛔ el cuaderno del robot tapa sellos inválidos');
    assert.match(P.juzgar({ firestore: { MISSING: 1 } }, {}).alarmas.join(), /sello MISSING/);
    assert.deepStrictEqual(P.juzgar({ firestore: { VALID: 5 } }, {}).alarmas, []);
  });

  it('cada llamada directa del robot a la base se anota en el cuaderno, antes de hacerla', () => {
    const t = fs.readFileSync(path.join(RAIZ, 'robot', 'comun.cjs'), 'utf8').replace(/\r\n/g, '\n');
    assert.match(t, /anotarLlamada\('identitytoolkit'\);\n  const r = await fetch\('https:\/\/identitytoolkit/, '⛔ la entrada a la base no se anota');
    assert.match(t, /const pedir = async \(ruta, opciones = \{\}\) => \{\n    anotarLlamada\('firestore'\);\n    const x = await fetch\(/, '⛔ las lecturas y cambios no se anotan');
    // G24 (28-sep-2026): la tercera es la de las funciones del servidor (`llamar`), y también se anota.
    assert.match(t, /llamar: async \(nombre, datos\) => \{\n      anotarLlamada\('cloudfunctions'\);\n      const x = await fetch\(/, '⛔ las llamadas a las funciones del servidor no se anotan');
    assert.strictEqual((t.match(/await fetch\(/g) || []).length, 3, '⛔ hay una llamada nueva a la base que no pasa por el cuaderno');
  });
});

describe('EL ROBOT · solo pruebas', () => {
  it('sus sitios son los tres de guajirago-pruebas, y ninguno de producción', () => {
    assert.deepStrictEqual(Object.keys(R.SITIOS).sort(), ['aliados', 'panel', 'transporte']);
    for (const s of Object.values(R.SITIOS)) assert.match(new URL(s).host, /^guajirago-pruebas(-admin|-aliados)?\.web\.app$/);
  });

  it('la guardia acepta pruebas y rechaza producción, direcciones parecidas y basura', () => {
    for (const s of Object.values(R.SITIOS)) assert.strictEqual(R.esDePruebas(s + 'algo?x=1'), true, s);
    const malas = [...PRODUCCION, 'http://guajirago-pruebas.web.app/', 'https://guajirago-pruebas.web.app.malo.com/',
      'https://malo.com/?guajirago-pruebas.web.app', 'guajirago-pruebas.web.app', '', undefined];
    for (const m of malas) assert.strictEqual(R.esDePruebas(m), false, '⛔ el robot aceptaría «' + m + '»');
  });

  it('abrir producción se niega ANTES de arrancar el navegador', async () => {
    for (const p of PRODUCCION) {
      // Primero se pregunta, y solo se intenta abrir si la guardia ya dijo que no: si la guardia
      // estuviera rota, esta prueba NO debe llegar a abrir producción (pasó en un sabotaje del
      // 27-sep-2026: abrió la portada y se quedó colgada con el navegador vivo).
      assert.strictEqual(R.esDePruebas(p), false, '⛔ la guardia dejaría abrir ' + p);
      await assert.rejects(R.abrir(p), /solo entra a sitios de PRUEBA/, p);
    }
  });

  it('el mapa no miente: cada recorrido y cada archivo vigilado existen, y elige bien qué correr', () => {
    const { RECORRIDOS, queProbar } = require('../robot/mapa.cjs');
    for (const r of RECORRIDOS) {
      assert.ok(fs.existsSync(path.join(RAIZ, 'robot', r.archivo)), '⛔ el mapa nombra un recorrido que no existe: ' + r.archivo);
      for (const v of r.vigila) assert.ok(fs.existsSync(path.join(RAIZ, v)), '⛔ ' + r.nombre + ' vigila un archivo que no existe: ' + v);
    }
    // Créditos era el ejemplo de pantalla sin recorrido hasta el 27-sep-2026, cuando le nació candado-recarga.
    const a = queProbar(['guajirago/src/documentosConductor.js', 'guajirago/src/Turismo.js', 'pruebas/x.test.js']);
    assert.deepStrictEqual(a.tocan.map((r) => r.nombre), ['humo', 'registrar-conductor']);
    assert.deepStrictEqual(a.sinRecorrido, ['guajirago/src/Turismo.js'], '⛔ una pantalla sin recorrido tiene que salir nombrada');
    assert.deepStrictEqual(queProbar([]).tocan.map((r) => r.nombre), ['humo'], '⛔ el humo corre siempre');
  });

  it('ningún recorrido se salta comun.cjs, abre direcciones a mano ni lleva la clave', () => {
    const dir = path.join(RAIZ, 'robot');
    const recorridos = fs.readdirSync(dir).filter((f) => f.endsWith('.cjs') && f !== 'comun.cjs');
    assert.ok(recorridos.length >= 3, 'faltan recorridos');
    let clave = null;
    try { clave = R.claveDePruebas(); } catch (e) { clave = null; }
    for (const f of recorridos) {
      const t = fs.readFileSync(path.join(dir, f), 'utf8');
      assert.ok(!/require\(['"]playwright/.test(t), '⛔ ' + f + ' abre el navegador sin pasar por la guardia');
      assert.ok(!/https:\/\/guajirago[\w-]*\.(web\.app|firebaseapp\.com)/.test(t), '⛔ ' + f + ' escribe una dirección a mano en vez de usar SITIOS');
      if (clave) assert.ok(!t.includes(clave), '⛔ ' + f + ' lleva la clave de las cuentas de prueba dentro (el repo es público)');
    }
  });
});
