#!/usr/bin/env node
/**
 * ¿QUIÉN ES ADMINISTRADOR? — gemelo G78 (29-sep-2026). SOLO LECTURA.
 *
 * La pregunta «¿esta persona es del panel?» (rol `admin` o `superadmin`) se contestaba en unos doce sitios:
 * la función esAdmin() de firestore.rules y SEIS copias escritas a mano en el mismo archivo, la esAdmin() de
 * storage.rules, la de la función recalcularCobro (guajirago/functions/index.js) y dos en el panel
 * (guajirago-admin/src/App.js) más la lista de Superadmin.js. Este guion:
 *
 *   · CUENTA dónde se decide, archivo por archivo (sin comentarios, que engañan);
 *   · saca de cada sitio QUÉ ROLES acepta y lo EJECUTA con una lista de roles (no lo lee: lo corre);
 *   · con --nube, le pasa a cada sitio las fichas de verdad de producción (`usuarios`) y cuenta a quién deja entrar;
 *   · con --emulador (dentro de `firebase emulators:exec`), corre las reglas de Firestore en el emulador con
 *     8 personas × 12 operaciones, y con --commit <hash> también las de ese commit, para carear antes y ahora.
 *
 *   node scripts/medir-quien-es-admin.cjs [--commit <hash>] [--nube]
 *   npx firebase-tools@15 emulators:exec --only firestore --project demo-guajirago \
 *       "node scripts/medir-quien-es-admin.cjs --emulador --commit 398b0e6"
 *
 * Se exporta lo que usa pruebas/quienEsAdmin.test.js, para que el medidor y la prueba sean UN solo recorrido.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert');

const RAIZ = path.resolve(__dirname, '..');

// Los archivos que deciden, cada uno con el repo al que pertenece.
const ARCHIVOS = {
  firestore: { repo: '.', ruta: 'firestore.rules' },
  storage: { repo: '.', ruta: 'storage.rules' },
  funciones: { repo: '.', ruta: 'guajirago/functions/index.js' },
  panelApp: { repo: 'guajirago-admin', ruta: 'src/App.js' },
  panelSuper: { repo: 'guajirago-admin', ruta: 'src/Superadmin.js' },
  panelRoles: { repo: 'guajirago-admin', ruta: 'src/rolesPanel.js' },
};

/** Lee los archivos del disco, o de un commit (`commits.raiz`, `commits.panel`). Si no existe allí, null. */
function textosDe(commits) {
  const t = {};
  for (const [k, { repo, ruta }] of Object.entries(ARCHIVOS)) {
    const commit = commits && (repo === '.' ? commits.raiz : commits.panel);
    try {
      t[k] = commit
        ? execFileSync('git', ['-C', path.join(RAIZ, repo), 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        : fs.readFileSync(path.join(RAIZ, repo, ruta), 'utf8');
    } catch (e) {
      t[k] = null;
    }
    if (t[k] != null) t[k] = t[k].replace(/\r\n/g, '\n');
  }
  return t;
}

// Quita los comentarios de renglón entero (reglas y JS) y los /* */ del JS. Lo que queda es lo que se ejecuta.
const sinComentarios = (t) => t.split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l)).join('\n');

/** El cuerpo `{ ... }` de la función que empieza en `desde`, contando llaves. */
function cuerpoDesde(t, desde) {
  const a = t.indexOf('{', desde);
  let n = 0;
  for (let i = a; i < t.length; i += 1) {
    if (t[i] === '{') n += 1;
    else if (t[i] === '}') { n -= 1; if (n === 0) return { desde: a, hasta: i + 1, texto: t.slice(a, i + 1) }; }
  }
  throw new Error('llaves descuadradas');
}

/** Los roles que acepta un trozo de reglas: los `== 'x'` y los `in ['x', 'y']`. */
function rolesDelTrozo(trozo) {
  const r = new Set();
  for (const m of trozo.matchAll(/==\s*'([^']*)'/g)) r.add(m[1]);
  for (const m of trozo.matchAll(/in\s*\[([^\]]*)\]/g)) for (const x of m[1].matchAll(/'([^']*)'/g)) r.add(x[1]);
  return [...r].sort();
}

/**
 * Las reglas (Firestore o Storage): la función esAdmin() y las decisiones sobre el rol que viven FUERA de ella.
 * Una «decisión en línea» es un renglón de código que compara el rol del que llama (`.rol ==`, `get('rol'...) ==`
 * o `get('rol'...) in [`). Se separan las de «admin o superadmin» (el gemelo) de las de «solo superadmin».
 */
function lasReglas(texto) {
  const t = sinComentarios(texto);
  const i = t.search(/function\s+esAdmin\s*\(\s*\)/);
  if (i < 0) return { funcion: null, roles: [], enLinea: [], soloSuper: [], usos: 0 };
  const cuerpo = cuerpoDesde(t, i);
  const fuera = t.slice(0, i) + t.slice(i, cuerpo.hasta).replace(/[^\n]/g, ' ') + t.slice(cuerpo.hasta);
  const renglones = fuera.split('\n');
  const enLinea = [];
  const soloSuper = [];
  renglones.forEach((l, n) => {
    // Solo las que miran la ficha de QUIEN LLAMA (no el `request.resource.data.rol` de lo que se escribe).
    if (!/request\.auth\.uid\)\)\s*\.data/.test(l)) return;
    if (!/\.data\.rol\s*(==|in\b)|\.data\.get\(\s*'rol'[^)]*\)\s*(==|in\b)/.test(l)) return;
    const quien = rolesDelTrozo(l);
    // La copia en línea va en pareja: el renglón de 'admin' y, debajo, el de 'superadmin'. El de debajo es la
    // misma decisión; solo cuenta aparte el 'superadmin' que va SOLO (config, leer logs).
    const ultima = enLinea[enLinea.length - 1];
    if (!quien.includes('admin') && ultima && ultima.renglon === n && !ultima.pareja) {
      ultima.pareja = true;
      ultima.roles = [...new Set([...ultima.roles, ...quien])].sort();
      ultima.texto += '\n' + l;
      return;
    }
    (quien.includes('admin') ? enLinea : soloSuper).push({ renglon: n + 1, roles: quien, texto: l });
  });
  // Las copias en línea van en pareja (admin || superadmin): cada 'admin' es UNA decisión copiada.
  const usos = (fuera.match(/\besAdmin\s*\(\s*\)/g) || []).length;
  return { funcion: cuerpo.texto, roles: rolesDelTrozo(cuerpo.texto), enLinea, soloSuper, usos };
}

/** Deja la función esAdmin() de unas reglas como una función de JS que recibe la ficha: `null` = no hay ficha. */
function ejecutarEsAdminDeReglas(funcionTexto) {
  // Se traduce el cuerpo, no se reescribe: get(...).data → ficha, firestore.get(...).data → ficha,
  // exists(...) → ficha !== null, request.auth != null → hay sesión, .get('rol', '') → (rol o '').
  let c = funcionTexto.replace(/^\{/, '').replace(/\}$/, '');
  c = c.replace(/==/g, '===');
  c = c.replace(/haySesion\(\)/g, 'sesion');
  c = c.replace(/request\.auth\s*!=\s*null/g, 'sesion');
  c = c.replace(/(firestore\.)?exists\(\/databases\/.*?\$\(request\.auth\.uid\)\)/g, '(ficha !== null)');
  c = c.replace(/(firestore\.)?get\(\/databases\/.*?\$\(request\.auth\.uid\)\)\s*\.data/g, 'fichaOError()');
  // `x in ['a', 'b']` de las reglas → `['a', 'b'].includes(x)`.
  c = c.replace(/(fichaOError\(\)\s*\.get\([^)]*\))\s+in\s+(\[[^\]]*\])/g, '$2.includes($1)');
  assert(!/\/databases\//.test(c), 'la esAdmin() de las reglas tiene una forma que este traductor no conoce:\n' + funcionTexto);
  // En las reglas, leer una ficha que no existe es ERROR, y un error niega. Se imita con una excepción.
  // `.get('rol', '')` devuelve el campo o el valor por defecto; `.rol` a pelo, sin el campo, es error (aquí: undefined, que tampoco es igual a nada).
  // eslint-disable-next-line no-new-func
  const f = new Function('sesion', 'ficha', 'const fichaOError = () => { if (ficha === null) throw new Error("sin ficha"); '
    + 'return { ...ficha, get: (k, d) => (k in ficha ? ficha[k] : d) }; };\n' + c);
  return (sesion, ficha) => { try { return f(sesion, ficha) === true; } catch (e) { return false; } };
}

/** La decisión de recalcularCobro, sacada de index.js y corrida: recibe la ficha (o null) y dice si deja pasar. */
function laDeLasFunciones(texto) {
  const t = sinComentarios(texto);
  const i = t.indexOf('exports.recalcularCobro');
  if (i < 0) return null;
  const desde = t.indexOf('const rol =', i);
  const siF = t.indexOf('if (rol', desde);
  const cierre = cuerpoDesde(t, siF).hasta;
  const trozo = t.slice(desde, cierre);
  // eslint-disable-next-line no-new-func
  const f = new Function('quien', 'HttpsError', trozo + '\nreturn true;');
  class HttpsError extends Error {}
  const decide = (ficha) => {
    const quien = { exists: ficha !== null, data: () => ficha };
    try { return f(quien, HttpsError) === true; } catch (e) { if (e instanceof HttpsError) return false; throw e; }
  };
  const lista = (trozo.match(/"(admin|superadmin)"/g) || []).length;
  return { trozo, decide, literales: lista };
}

/**
 * El panel: los dos sitios de App.js (entrar y volver a abrir la sesión) y la lista de Superadmin.js.
 * Los dos `if` se sacan del archivo y se corren con cada rol; si llaman a esDelPanel(), se les da la de rolesPanel.js.
 */
function elPanel(t) {
  const app = sinComentarios(t.panelApp || '');
  const sup = sinComentarios(t.panelSuper || '');
  let esDelPanel = null;
  let ROLES = null;
  if (t.panelRoles) {
    const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
    const pieza = cargarDeLaApp('guajirago-admin/src/rolesPanel.js', t.panelRoles);
    esDelPanel = pieza.esDelPanel;
    ROLES = pieza.ROLES_DEL_PANEL;
  }
  // Cada `const rol = ...rol || '';` va seguido del `if (...)` que decide. Se corre esa condición.
  const sitios = [];
  for (const m of app.matchAll(/const rol = [^\n]*\n\s*if \((.*)\) \{/g)) {
    const cond = m[1];
    // eslint-disable-next-line no-new-func
    const f = new Function('rol', 'esDelPanel', 'return (' + cond + ');');
    const entra = cond.startsWith('!') || /!==/.test(cond) ? (rol) => !f(rol, esDelPanel) : (rol) => f(rol, esDelPanel);
    sitios.push({ cond, entra });
  }
  const aMano = (app.match(/rol\s*[!=]==\s*'admin'/g) || []).length
    + (sup.match(/\[\s*'admin'\s*,\s*'superadmin'\s*\]/g) || []).length;
  const listaSuper = (() => {
    const m = sup.match(/where\('rol',\s*'in',\s*([^)]*)\)/);
    if (!m) return null;
    const expr = m[1].trim();
    if (expr === 'ROLES_DEL_PANEL') return ROLES;
    // eslint-disable-next-line no-new-func
    return new Function('return ' + expr)();
  })();
  return { sitios, aMano, listaSuper, esDelPanel, ROLES };
}

// Los roles con que se prueba cada sitio: los dos buenos, los de la gente normal, y los que casi engañan.
const ROLES_DE_PRUEBA = ['admin', 'superadmin', '', 'conductor', 'pasajero', 'dueno', 'Admin', 'SUPERADMIN', ' admin', 'administrador', undefined, null];

/** Le pregunta a cada sitio, rol por rol, si deja entrar. Devuelve { sitio: [roles que acepta] }. */
function quienEntraEnCadaSitio(t) {
  const out = {};
  const fichaDe = (rol) => (rol === undefined ? { nombre: 'x' } : { nombre: 'x', rol });
  const fr = lasReglas(t.firestore);
  // Además de la lista fija, cada texto que aparezca DENTRO de alguna decisión: un rol de más escrito en un solo
  // sitio (p. ej. 'soporte') se prueba en todos, y así se ve quién lo acepta y quién no.
  const extra = new Set([
    ...rolesDelTrozo(fr.funcion || ''), ...fr.enLinea.flatMap((e) => e.roles),
    ...rolesDelTrozo(lasReglas(t.storage).funcion || ''),
    ...(((laDeLasFunciones(t.funciones) || {}).trozo || '').match(/"[^"\n]*"/g) || []).map((x) => x.slice(1, -1)),
    ...(elPanel(t).listaSuper || []),
  ]);
  const pruebas = [...ROLES_DE_PRUEBA, ...[...extra].filter((r) => !ROLES_DE_PRUEBA.includes(r))];
  const acepta = (fn) => pruebas.filter((r) => fn(r)).map(String).sort();
  const f1 = ejecutarEsAdminDeReglas(fr.funcion);
  out['firestore.rules · esAdmin()'] = acepta((r) => f1(true, fichaDe(r)));
  // Y cada copia en línea que quede, corrida igual que la función (con el `request.auth != null` que la precede).
  for (const e of fr.enLinea) {
    const g = ejecutarEsAdminDeReglas('{ return request.auth != null && (' + e.texto.replace(/\|\|\s*$/, '') + '); }');
    out['firestore.rules · copia del renglón ' + e.renglon] = acepta((r) => g(true, fichaDe(r)));
  }
  const sr = lasReglas(t.storage);
  const f2 = ejecutarEsAdminDeReglas(sr.funcion);
  out['storage.rules · esAdmin()'] = acepta((r) => f2(true, fichaDe(r)));
  const fu = laDeLasFunciones(t.funciones);
  out['functions · recalcularCobro'] = acepta((r) => fu.decide(fichaDe(r)));
  const p = elPanel(t);
  p.sitios.forEach((s, n) => {
    out['panel App.js · sitio ' + (n + 1)] = acepta((r) => s.entra(r === undefined ? '' : (r || '')));
  });
  out['panel Superadmin.js · lista'] = (p.listaSuper || []).slice().sort();
  // Y sin ficha, y sin sesión: nadie entra.
  out['firestore.rules · sin ficha'] = f1(true, null) ? ['ENTRA'] : [];
  out['firestore.rules · sin sesión'] = f1(false, fichaDe('admin')) ? ['ENTRA'] : [];
  out['storage.rules · sin ficha'] = f2(true, null) ? ['ENTRA'] : [];
  out['storage.rules · sin sesión'] = f2(false, fichaDe('admin')) ? ['ENTRA'] : [];
  out['functions · sin ficha'] = fu.decide(null) ? ['ENTRA'] : [];
  return out;
}

/** Cuántos sitios deciden, archivo por archivo. */
function contar(t) {
  const fr = lasReglas(t.firestore);
  const sr = lasReglas(t.storage);
  const fu = laDeLasFunciones(t.funciones);
  const p = elPanel(t);
  return {
    firestoreFuncion: fr.funcion ? 1 : 0,
    firestoreEnLinea: fr.enLinea.length,
    firestoreUsos: fr.usos,
    firestoreSoloSuper: fr.soloSuper.length,
    storageFuncion: sr.funcion ? 1 : 0,
    storageEnLinea: sr.enLinea.length,
    funciones: fu ? 1 : 0,
    panelAMano: p.aMano,
    panelSitios: p.sitios.length,
    panelFuente: p.ROLES ? 1 : 0,
  };
}

// ── LAS REGLAS DE FIRESTORE, CORRIDAS EN EL EMULADOR ───────────────────────
// 8 personas × 12 operaciones. Cada operación es uno de los sitios que preguntan «¿es del panel?» (y los dos de
// «solo superadmin», que no cambian, como testigo).
const PERSONAS = {
  admin: { rol: 'admin' },
  superadmin: { rol: 'superadmin' },
  conductor: { rol: '', tipo: 'conductor' },
  pasajero: { rol: '' },
  sinCampoRol: {},
  rolParecido: { rol: 'Admin' },
  sinFicha: null,
  anonimo: 'anonimo',
};

function operaciones(FS) {
  const { doc, setDoc, updateDoc, deleteDoc, addDoc, getDoc, getDocs, collection } = FS;
  return {
    'usuarios · cambiar ficha ajena': (db) => updateDoc(doc(db, 'usuarios/victima'), { nombre: 'cambiado' }),
    'usuarios · crear ficha ajena': (db) => setDoc(doc(db, 'usuarios/fichaNueva'), { nombre: 'nuevo' }),
    'conductores · cambiar uno ajeno': (db) => updateDoc(doc(db, 'conductores/otroConductor'), { nota: 'x' }),
    // El camino que NO es del panel y vive en la misma condición (`uid == conductorId || ...`): no se puede perder.
    'conductores · cambiar el suyo': (db, persona) => updateDoc(doc(db, 'conductores/' + persona), { nota: 'x' }),
    'conductores · listar': (db) => getDocs(collection(db, 'conductores')),
    'promociones · crear': (db) => setDoc(doc(db, 'promociones/nueva'), { nombre: 'promo' }),
    'promociones · borrar': (db) => deleteDoc(doc(db, 'promociones/p1')),
    'anuncios · crear': (db) => setDoc(doc(db, 'anuncios/nuevo'), { texto: 'hola' }),
    'anuncios · borrar': (db) => deleteDoc(doc(db, 'anuncios/a1')),
    'logs · escribir': (db) => addDoc(collection(db, 'logs'), { accion: 'x' }),
    'config · cambiar (solo superadmin)': (db) => setDoc(doc(db, 'config/global'), { x: 1 }, { merge: true }),
    'logs · leer (solo superadmin)': (db) => getDoc(doc(db, 'logs/l1')),
  };
}

/** Siembra, y corre cada operación con cada persona. Devuelve { persona: { operacion: 'sí'|'no' } }. */
async function correrMatriz(RUT, FS, projectId, reglas, puerto) {
  const entorno = await RUT.initializeTestEnvironment({
    projectId,
    firestore: { rules: reglas, host: '127.0.0.1', port: puerto },
  });
  const ops = operaciones(FS);
  const tabla = {};
  try {
    for (const [persona, ficha] of Object.entries(PERSONAS)) {
      tabla[persona] = {};
      for (const [nombre, op] of Object.entries(ops)) {
        // Cada operación arranca de la misma base: una escritura anterior no le cambia el resultado a la siguiente.
        await entorno.clearFirestore();
        await entorno.withSecurityRulesDisabled(async (ctx) => {
          const db = ctx.firestore();
          const { doc, setDoc } = FS;
          if (ficha && ficha !== 'anonimo') await setDoc(doc(db, 'usuarios/' + persona), { nombre: persona, ...ficha });
          await setDoc(doc(db, 'usuarios/victima'), { nombre: 'Otra', rol: '' });
          await setDoc(doc(db, 'conductores/otroConductor'), { nombre: 'Otro' });
          await setDoc(doc(db, 'conductores/' + persona), { nombre: persona });
          await setDoc(doc(db, 'promociones/p1'), { nombre: 'p' });
          await setDoc(doc(db, 'anuncios/a1'), { texto: 'a' });
          await setDoc(doc(db, 'logs/l1'), { accion: 'a' });
          await setDoc(doc(db, 'config/global'), { x: 0 });
        });
        const db = ficha === 'anonimo' ? entorno.unauthenticatedContext().firestore() : entorno.authenticatedContext(persona).firestore();
        try { await op(db, persona); tabla[persona][nombre] = 'sí'; } catch (e) {
          if (!/PERMISSION_DENIED|permission/i.test(String(e && (e.code || e.message)))) throw e;
          tabla[persona][nombre] = 'no';
        }
      }
    }
  } finally {
    await entorno.cleanup();
  }
  return tabla;
}

/** Lo que tiene que salir: las personas del panel pueden, las demás no; lo de «solo superadmin», solo él. */
function tablaEsperada() {
  const t = {};
  for (const persona of Object.keys(PERSONAS)) {
    t[persona] = {};
    for (const op of Object.keys(operaciones({ doc() {}, collection() {} }))) {
      const soloSuper = /solo superadmin/.test(op);
      const elSuyo = /el suyo/.test(op);
      let puede = soloSuper ? persona === 'superadmin' : ['admin', 'superadmin'].includes(persona);
      if (elSuyo) puede = persona !== 'anonimo'; // su propio documento de conductor: cualquiera con sesión
      t[persona][op] = puede ? 'sí' : 'no';
    }
  }
  return t;
}

// ── LA NUBE: las fichas de verdad, pasadas por cada sitio ──────────────────
async function conLaNube(t) {
  const { traer, val } = require('./nube.cjs');
  const docs = await traer('usuarios');
  const fichas = docs.map((d) => {
    const f = {};
    for (const [k, v] of Object.entries(d.fields || {})) if (k === 'rol') f.rol = val(v);
    return f;
  });
  const porRol = {};
  for (const f of fichas) { const k = 'rol' in f ? JSON.stringify(f.rol) : '(sin campo)'; porRol[k] = (porRol[k] || 0) + 1; }
  const fr = ejecutarEsAdminDeReglas(lasReglas(t.firestore).funcion);
  const sr = ejecutarEsAdminDeReglas(lasReglas(t.storage).funcion);
  const fu = laDeLasFunciones(t.funciones);
  const p = elPanel(t);
  const cuentas = {
    'firestore.rules': fichas.filter((f) => fr(true, f)).length,
    'storage.rules': fichas.filter((f) => sr(true, f)).length,
    functions: fichas.filter((f) => fu.decide(f)).length,
  };
  p.sitios.forEach((s, n) => { cuentas['panel App.js sitio ' + (n + 1)] = fichas.filter((f) => s.entra(f.rol || '')).length; });
  cuentas['panel Superadmin.js lista'] = fichas.filter((f) => (p.listaSuper || []).includes(f.rol)).length;
  return { total: fichas.length, porRol, cuentas };
}

module.exports = {
  ARCHIVOS, textosDe, lasReglas, ejecutarEsAdminDeReglas, laDeLasFunciones, elPanel, quienEntraEnCadaSitio, contar,
  PERSONAS, operaciones, correrMatriz, tablaEsperada, ROLES_DE_PRUEBA,
};

if (require.main === module) {
  (async () => {
    const arg = process.argv.slice(2);
    const iC = arg.indexOf('--commit');
    const commit = iC >= 0 ? arg[iC + 1] : null;
    const iP = arg.indexOf('--panel');
    const panel = iP >= 0 ? arg[iP + 1] : null;
    const ahora = textosDe(null);
    const antes = commit || panel ? textosDe({ raiz: commit, panel }) : null;
    const mostrar = (nombre, t) => {
      console.log('\n══ ' + nombre);
      console.log('  sitios que deciden:', JSON.stringify(contar(t)));
      const q = quienEntraEnCadaSitio(t);
      for (const [k, v] of Object.entries(q)) console.log('  ' + k.padEnd(34) + ' acepta: ' + (v.length ? v.join(', ') : '(nadie)'));
      return q;
    };
    const qA = antes ? mostrar('ANTES (' + (commit || 'disco') + ' / panel ' + (panel || 'disco') + ')', antes) : null;
    const qH = mostrar('AHORA (disco)', ahora);
    const valores = Object.values(qH).filter((v) => !(v.length === 1 && v[0] === 'ENTRA') && v.length);
    const iguales = valores.every((v) => JSON.stringify(v) === JSON.stringify(['admin', 'superadmin']));
    console.log('\n  ' + (iguales ? '✓' : '🔴') + ' todos los sitios aceptan exactamente admin y superadmin');
    if (qA) {
      // Un sitio que sigue: acepta lo mismo. Una copia que se fue: aceptaba lo mismo que la función que la reemplaza.
      const mal = Object.keys(qA).filter((k) => JSON.stringify(qA[k]) !== JSON.stringify(k in qH ? qH[k] : qH['firestore.rules · esAdmin()']));
      console.log('  ' + (mal.length ? '🔴 cambió: ' + mal.join('; ') : '✓') + ' antes y ahora aceptan lo mismo, sitio por sitio (las copias que se fueron, lo mismo que esAdmin())');
    }
    if (arg.includes('--nube')) {
      const n = await conLaNube(ahora);
      console.log('\n══ PRODUCCIÓN · usuarios: ' + n.total + ' fichas; por rol: ' + JSON.stringify(n.porRol));
      console.log('  a cuántas deja entrar cada sitio (AHORA): ' + JSON.stringify(n.cuentas));
      if (antes) console.log('  y ANTES: ' + JSON.stringify((await conLaNube(antes)).cuentas));
    }
    if (arg.includes('--emulador')) {
      const { elEmulador } = require('../pruebas/cargar.cjs');
      const RUT = await import('@firebase/rules-unit-testing');
      const FS = await import('firebase/firestore');
      const puerto = elEmulador().firestore;
      const tH = await correrMatriz(RUT, FS, 'demo-g78-ahora', ahora.firestore, puerto);
      console.log('\n══ EMULADOR · reglas de AHORA');
      console.table(tH);
      const esperada = JSON.stringify(tH) === JSON.stringify(tablaEsperada());
      console.log('  ' + (esperada ? '✓' : '🔴') + ' las del panel pueden, las demás no (y lo de solo superadmin, solo él)');
      if (antes && antes.firestore) {
        const tA = await correrMatriz(RUT, FS, 'demo-g78-antes', antes.firestore, puerto);
        console.log('\n══ EMULADOR · reglas de ANTES (' + commit + ')');
        console.table(tA);
        const dif = [];
        for (const p of Object.keys(tA)) for (const o of Object.keys(tA[p])) if (tA[p][o] !== tH[p][o]) dif.push(p + ' / ' + o);
        console.log('  ' + (dif.length ? '🔴 difieren: ' + dif.join('; ') : '✓ antes y ahora dan la MISMA tabla, casilla por casilla (' + Object.keys(tA).length * Object.keys(tA.admin).length + ' casillas)'));
      }
    }
  })().catch((e) => { console.error(e); process.exit(1); });
}
