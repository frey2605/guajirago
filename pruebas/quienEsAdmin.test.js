// ═══════════════════════════════════════════════════════════════════════════
//  ¿QUIÉN ES ADMINISTRADOR? · gemelo G78, 29-sep-2026
//
//  «¿Esta persona es del panel?» (rol `admin` o `superadmin`) se contestaba en unos doce sitios: la esAdmin() de
//  firestore.rules y SEIS copias escritas a mano en el mismo archivo, la esAdmin() de storage.rules, la de
//  recalcularCobro en las funciones, dos `if` en el panel (App.js) y la lista de Superadmin.js.
//
//  Ahora, dentro de cada archivo, UNA sola respuesta: firestore.rules usa su esAdmin() en todas partes, y el panel
//  la saca de guajirago-admin/src/rolesPanel.js. Entre archivos de lenguajes distintos no se puede importar, así que
//  esta prueba los ATA, EJECUTANDO cada uno (no leyéndolo):
//    · todos aceptan exactamente los roles de ROLES_DEL_PANEL, y ninguno deja entrar sin ficha o sin sesión;
//    · no vuelve a nacer una copia a mano (en las reglas ni en el panel);
//    · las reglas de Firestore, corridas en el EMULADOR con 8 personas × 12 operaciones, dan la tabla esperada, y
//      la MISMA casilla por casilla que las reglas de antes del cambio (commit 398b0e6).
// ═══════════════════════════════════════════════════════════════════════════
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { cargarDeLaApp, elEmulador } = require('./cargar.cjs');
const M = require('../scripts/medir-quien-es-admin.cjs');

const ANTES = '398b0e6'; // el último commit con las seis copias en línea
const PANEL = cargarDeLaApp('guajirago-admin/src/rolesPanel.js');
const ROLES = [...PANEL.ROLES_DEL_PANEL].sort();

describe('¿QUIÉN ES ADMINISTRADOR? · una respuesta por archivo, y todas atadas (G78)', () => {
  it('la pieza del panel dice admin y superadmin, y esDelPanel() la usa', () => {
    assert.deepStrictEqual(ROLES, ['admin', 'superadmin']);
    for (const r of M.ROLES_DE_PRUEBA) assert.strictEqual(PANEL.esDelPanel(r), ROLES.includes(r), 'esDelPanel(' + r + ')');
  });

  it('todos los sitios, EJECUTADOS rol por rol, aceptan exactamente los mismos roles', () => {
    const q = M.quienEntraEnCadaSitio(M.textosDe(null));
    const sitios = Object.keys(q).filter((k) => !/sin (ficha|sesión)/.test(k));
    // Que de verdad se hayan corrido los seis: reglas, almacén, servidor, los dos del panel y la lista.
    assert.deepStrictEqual(sitios, ['firestore.rules · esAdmin()', 'storage.rules · esAdmin()', 'functions · recalcularCobro',
      'panel App.js · sitio 1', 'panel App.js · sitio 2', 'panel Superadmin.js · lista'],
    'no se encontraron los seis sitios que deciden (o apareció una copia en línea en firestore.rules)');
    for (const k of sitios) assert.deepStrictEqual(q[k], ROLES, k + ' no acepta lo mismo que ROLES_DEL_PANEL');
    for (const k of Object.keys(q).filter((x) => /sin (ficha|sesión)/.test(x))) assert.deepStrictEqual(q[k], [], k + ' deja entrar');
  });

  it('no queda ninguna copia a mano: ni en las reglas, ni en el panel', () => {
    const c = M.contar(M.textosDe(null));
    assert.strictEqual(c.firestoreFuncion, 1, 'firestore.rules perdió su esAdmin()');
    assert.strictEqual(c.firestoreEnLinea, 0, 'firestore.rules volvió a decidir «¿es admin?» a mano, fuera de esAdmin()');
    assert.strictEqual(c.storageFuncion, 1, 'storage.rules perdió su esAdmin()');
    assert.strictEqual(c.storageEnLinea, 0, 'storage.rules decide «¿es admin?» a mano, fuera de esAdmin()');
    assert.strictEqual(c.funciones, 1, 'no se encontró la decisión de recalcularCobro');
    assert.strictEqual(c.panelAMano, 0, 'el panel volvió a escribir los roles a mano (App.js o Superadmin.js)');
    assert.strictEqual(c.panelSitios, 2, 'App.js ya no tiene sus dos sitios que deciden');
    assert.strictEqual(c.panelFuente, 1, 'falta guajirago-admin/src/rolesPanel.js');
    // Los dos de «solo superadmin» (cambiar config, leer logs) son OTRA pregunta y no cambian. Si nace otro, que se vea.
    assert.strictEqual(c.firestoreSoloSuper, 2, 'cambió el número de decisiones de «solo superadmin» en firestore.rules');
  });

  it('los dos sitios de App.js llaman a esDelPanel(), y la lista de Superadmin.js es ROLES_DEL_PANEL', () => {
    const p = M.elPanel(M.textosDe(null));
    for (const s of p.sitios) assert.match(s.cond, /^!?esDelPanel\(rol\)$/, 'App.js decide sin esDelPanel(): ' + s.cond);
    assert.match(M.textosDe(null).panelSuper, /where\('rol',\s*'in',\s*ROLES_DEL_PANEL\)/, 'Superadmin.js no busca con ROLES_DEL_PANEL');
  });

  it('y el medidor no se puede ablandar: cada copia de mentira la caza', () => {
    const bueno = M.textosDe(null);
    const G = "get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == ";
    const mentiras = {
      'una copia en línea que vuelve': { ...bueno, firestore: bueno.firestore.replace('allow delete: if esAdmin();', "allow delete: if request.auth != null && (\n        " + G + "'admin' ||\n        " + G + "'superadmin'\n      );") },
      'firestore acepta un rol de más': { ...bueno, firestore: bueno.firestore.replace("data.get('rol', '') == 'superadmin'", "data.get('rol', '') in ['superadmin', 'soporte']") },
      'storage acepta un rol de más': { ...bueno, storage: bueno.storage.replace("in ['admin', 'superadmin']", "in ['admin', 'superadmin', 'dueno']") },
      'el servidor se olvida del superadmin': { ...bueno, funciones: bueno.funciones.replace('if (rol !== "admin" && rol !== "superadmin")', 'if (rol !== "admin")') },
      'el panel vuelve a escribirlo a mano': { ...bueno, panelApp: bueno.panelApp.replace('if (esDelPanel(rol)) {', "if (rol === 'admin' || rol === 'superadmin') {") },
      'la lista de Superadmin.js a mano y corta': { ...bueno, panelSuper: bueno.panelSuper.replace("where('rol', 'in', ROLES_DEL_PANEL)", "where('rol', 'in', ['admin'])") },
    };
    for (const [nombre, t] of Object.entries(mentiras)) {
      const k = Object.keys(t).find((x) => t[x] !== bueno[x]);
      assert.ok(k, 'la mentira «' + nombre + '» no calzó: el texto que rompe ya no existe');
      const c = M.contar(t);
      const q = M.quienEntraEnCadaSitio(t);
      const todosIguales = Object.entries(q).filter(([x]) => !/sin (ficha|sesión)/.test(x)).every(([, v]) => JSON.stringify(v) === JSON.stringify(ROLES));
      const cazada = c.firestoreEnLinea > 0 || c.panelAMano > 0 || !todosIguales;
      assert.ok(cazada, 'el medidor NO caza «' + nombre + '»');
    }
  });

  it('EN EL EMULADOR: las reglas dan la tabla esperada, y la misma que antes, casilla por casilla', async () => {
    const RUT = await import('@firebase/rules-unit-testing');
    const FS = await import('firebase/firestore');
    const puerto = elEmulador().firestore;
    const ahora = await M.correrMatriz(RUT, FS, 'demo-g78-ahora', M.textosDe(null).firestore, puerto);
    const antes = await M.correrMatriz(RUT, FS, 'demo-g78-antes', M.textosDe({ raiz: ANTES }).firestore, puerto);
    const esperada = M.tablaEsperada();
    assert.strictEqual(Object.keys(esperada).length * Object.keys(esperada.admin).length, 96, 'no son 8 personas × 12 operaciones');
    assert.deepStrictEqual(ahora, esperada, 'las reglas de AHORA no dan la tabla esperada');
    assert.deepStrictEqual(antes, esperada, 'las reglas de ANTES no daban la tabla esperada (el careo no vale)');
    assert.deepStrictEqual(ahora, antes, 'las reglas cambiaron de comportamiento');
  });
});
