// ═══════════════════════════════════════════════════════════════════════════
//  LA NUBE DE MENTIRA · para EJECUTAR guajirago/functions/index.js entero sin red
//
//  Nació dentro de pruebas/sobreDelAviso.test.js (G32, 28-sep-2026) y se sacó aquí el 29-sep-2026 (G64) porque
//  el medidor de a quién del negocio le llega cada aviso (scripts/medir-quien-recibe.cjs) necesitaba lo MISMO:
//  escribir una segunda nube de mentira habría sido el gemelo que prohíbe la SEGUNDA LEY. El código es el que
//  estaba allá, sin cambiarle nada; lo único nuevo es que el commit del careo se pasa como argumento en vez de
//  leerse de SOBRE_REF, para que cada uno use su propia variable.
//
//  · baseDeMentira(datos): Firestore en memoria ({ coleccion: { id: {campos} } }) con doc().get(), where().get()
//    y getAll(); y (P03) subcolecciones y runTransaction, que apunta lo que se escribiría en `escrituras`.
//  · mensajeroDeMentira(fallan): apunta lo que Google recibiría, un mensaje por token; los tokens de `fallan`
//    contestan con ese código de error.
//  · cargarIndex(datos, fallan, ref): carga index.js (el de hoy, o el del commit `ref`) con las dos de arriba, y
//    deja a mano sus funciones internas en `__internas`.
//  · conRegistro(hacer): corre algo y devuelve lo que escribió en el registro.
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path');
const Module = require('module');
const { execSync } = require('child_process');
const { leer } = require('./cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const DIR = path.join(RAIZ, 'guajirago', 'functions');

function baseDeMentira(datos, escrituras = []) {
  const snap = (col, id) => {
    const d = (datos[col] || {})[id];
    return { id, exists: !!d, data: () => d, updateTime: { toMillis: () => Date.now() - 60 * 1000 } };
  };
  // P03: `ref.collection(sub)` para las subcolecciones (viajes/{id}/contraofertas/{c}), con la ruta entera como nombre.
  const ref = (col, id) => ({
    col, id, get: async () => snap(col, id),
    collection: (sub) => ({ doc: (id2) => ref(col + '/' + id + '/' + sub, id2) }),
  });
  // P03: una transacción de mentira. Lee de `datos` y APUNTA lo que se escribiría en `escrituras` (no cambia `datos`).
  const runTransaction = async (fn) => fn({
    get: (r) => r.get(),
    update: (r, campos) => { escrituras.push({ que: 'update', ruta: r.col + '/' + r.id, campos }); },
    set: (r, campos, opciones) => { escrituras.push({ que: 'set', ruta: r.col + '/' + r.id, campos, opciones }); },
  });
  const consulta = (col, filtros) => ({
    where: (campo, op, valor) => consulta(col, [...filtros, [campo, valor]]),
    get: async () => {
      const docs = Object.keys(datos[col] || {}).map((id) => snap(col, id))
        .filter((s) => filtros.every(([c, v]) => s.data()[c] === v));
      return { size: docs.length, docs, forEach: (fn) => docs.forEach(fn) };
    },
  });
  return {
    collection: (col) => ({ doc: (id) => ref(col, id), where: (c, o, v) => consulta(col, [[c, v]]) }),
    getAll: async (...refs) => refs.map((r) => snap(r.col, r.id)),
    runTransaction,
  };
}

/** Lo que Google recibiría, un mensaje por token (así llega a cada celular), y los tokens que «fallan». */
function mensajeroDeMentira(fallan = {}) {
  const recibidos = [];
  const error = (codigo) => Object.assign(new Error('falló: ' + codigo), { code: codigo });
  return {
    recibidos,
    async send(m) {
      recibidos.push(m);
      if (fallan[m.token]) throw error(fallan[m.token]);
      return 'id';
    },
    async sendEachForMulticast({ tokens, ...resto }) {
      const responses = tokens.map((token) => {
        recibidos.push({ ...resto, token });
        return fallan[token] ? { success: false, error: error(fallan[token]) } : { success: true, messageId: 'id' };
      });
      const failureCount = responses.filter((r) => !r.success).length;
      return { responses, failureCount, successCount: responses.length - failureCount };
    },
  };
}

/** Carga index.js (el de hoy, o el del commit `ref`) con la nube de mentira, y deja a mano sus funciones internas. */
function cargarIndex(datos, fallan, ref) {
  const mensajero = mensajeroDeMentira(fallan);
  const escrituras = [];
  const admin = { initializeApp() {}, firestore: () => baseDeMentira(datos, escrituras), messaging: () => mensajero };
  const tal = (a, b) => (typeof b === 'function' ? b : a);
  // P04: como el de verdad, guarda el código, la frase y los detalles (antes la frase quedaba en el código).
  class HttpsError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
  const funciones = {
    'firebase-functions/v2/firestore': { onDocumentCreated: tal, onDocumentUpdated: tal },
    'firebase-functions/v2/https': { onCall: tal, HttpsError },
    'firebase-functions/v2/scheduler': { onSchedule: tal },
    'firebase-admin': admin,
  };
  const fuente = (ref ? execSync('git show ' + ref + ':guajirago/functions/index.js', { cwd: RAIZ }).toString()
    : leer('guajirago/functions/index.js'))
    + '\nmodule.exports.__internas = { avisarDelPedidoNuevo, avisarAlClienteDelCambio, avisarAlNegocio };\n';
  const archivo = path.join(DIR, 'index.js');
  const original = Module._load;
  Module._load = function (pedido, ...resto) {
    if (Object.prototype.hasOwnProperty.call(funciones, pedido)) return funciones[pedido];
    return original.call(this, pedido, ...resto);
  };
  try {
    const m = new Module(archivo, null);
    m.filename = archivo;
    m.paths = Module._nodeModulePaths(DIR);
    m._compile(fuente, archivo);
    return { fx: m.exports, mensajero, escrituras };
  } finally {
    Module._load = original;
  }
}

/** Corre algo y devuelve lo que escribió en el registro (log, warn y error). */
async function conRegistro(hacer) {
  const lineas = [];
  const guardado = { log: console.log, warn: console.warn, error: console.error };
  for (const k of Object.keys(guardado)) console[k] = (...a) => lineas.push(k + ': ' + a.join(' '));
  try { return { valor: await hacer(), registro: lineas.join('\n') }; } finally { Object.assign(console, guardado); }
}

module.exports = { baseDeMentira, mensajeroDeMentira, cargarIndex, conRegistro };
