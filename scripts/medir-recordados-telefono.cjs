#!/usr/bin/env node
/**
 * «MIS PEDIDOS» Y «MIS RESERVAS»: LO QUE EL TELÉFONO RECUERDA — gemelo G88 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-recordados-telefono.cjs            <- el código del disco
 *   node scripts/medir-recordados-telefono.cjs --antes    <- y el careo con el código de antes (c7db2a2 / 0f89437 / bfc7f4d)
 *   node scripts/medir-recordados-telefono.cjs --nube     <- y además si esos pedidos y reservas viven en la nube con dueño
 *
 * La app del cliente apunta en el TELÉFONO (localStorage) los ids de lo que pidió y reservó, para pintar después
 * «Mis pedidos» (guajirago/src/Restaurantes.js, clave `misPedidosGuajira`) y «Mis reservas» (guajirago/src/Turismo.js,
 * clave `misReservasGuajira`). Hasta G88 cada pantalla lo hacía a su manera: el pedido con tope de 40 y el repetido
 * al frente; la reserva sin tope y el repetido en su sitio; y si lo guardado no era una lista, cada una fallaba distinto.
 * Desde G88 lo hace UNA pieza, guajirago/src/recordadosEnTelefono.js, y cada pantalla solo dice su clave y su tope.
 *
 * Qué hace: SACA de cada pantalla la expresión con que LEE la lista y la instrucción con que GUARDA el id nuevo (justo
 * después del addDoc), con lo que esas expresiones necesitan del archivo o de la pieza, y las CORRE contra un teléfono de
 * mentira en varios casos: vacío, lo ya guardado, un repetido, más de 40, y guardados rotos. Busca además en las TRES
 * apps listas del teléfono leídas a mano. Con --nube cuenta, sin escribir nada, cuántos pedidos y reservas llevan la
 * firma del cliente (`clienteId`). No escribe nada. Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');
const { lector } = require('./medir-conexion-firebase.cjs');

const ANTES = { raiz: 'c7db2a2', admin: '0f89437', aliados: 'bfc7f4d' }; // los últimos commits antes de G88
const PIEZA = 'guajirago/src/recordadosEnTelefono.js';
const CARPETAS = ['guajirago/src', 'guajirago-aliados/src', 'guajirago-admin/src'];
const CLAVES = { pedidos: 'misPedidosGuajira', reservas: 'misReservasGuajira' };
// Los dos sitios: dónde está la pantalla, dónde LEE (lo que viene después del ancla) y tras qué addDoc GUARDA.
const SITIOS = {
  'APP · Mis pedidos': {
    archivo: 'guajirago/src/Restaurantes.js', clave: CLAVES.pedidos,
    anclaLeer: "if (pantalla !== 'misPedidos') return;", anclaGuardar: "collection(db, 'pedidos')",
  },
  'APP · Mis reservas': {
    archivo: 'guajirago/src/Turismo.js', clave: CLAVES.reservas,
    anclaLeer: 'const cargarMisReservas = async () => {', anclaGuardar: "collection(db, 'reservasTurismo')",
  },
};
// Lo pendiente CONOCIDO: la lista de «recientes» de Home.js, código muerto (se lee y no se pinta; nadie la escribe:
// irASolicitar nunca recibe destino). Lo dejó anotado G67 y aquí solo se cuenta; borrarlo es otra decisión.
const PENDIENTES = ['guajirago/src/Home.js'];

const LOTE = Array.from({ length: 45 }, (_, i) => 'p' + String(i + 1).padStart(2, '0'));
// Cada caso: qué hay guardado al empezar (undefined = nada; un texto = lo que haya en la clave) y qué ids se guardan.
const CASOS = [
  { nombre: 'teléfono vacío', guardado: undefined, guardar: [] },
  { nombre: 'guarda a, luego b', guardado: undefined, guardar: ['a', 'b'] },
  { nombre: 'ya tenía x, y (forma vieja)', guardado: '["x","y"]', guardar: [] },
  { nombre: 'ya tenía x, y y guarda z', guardado: '["x","y"]', guardar: ['z'] },
  { nombre: 'repetido: a, b, a', guardado: undefined, guardar: ['a', 'b', 'a'] },
  { nombre: 'guarda 45 seguidos', guardado: undefined, guardar: LOTE },
  { nombre: 'ya tenía 45 y guarda uno', guardado: JSON.stringify(LOTE), guardar: ['nuevo'] },
  { nombre: 'guardado roto (no es JSON)', guardado: 'no-json{', guardar: [] },
  { nombre: 'roto y guarda a', guardado: 'no-json{', guardar: ['a'] },
  { nombre: 'guardado «null»', guardado: 'null', guardar: [] },
  { nombre: 'guardado un objeto', guardado: '{"a":1}', guardar: [] },
  { nombre: 'objeto y guarda a', guardado: '{"a":1}', guardar: ['a'] },
  { nombre: 'guardado un texto', guardado: '"abc"', guardar: [] },
  { nombre: 'lista con basura', guardado: '[1,"x",null,"",{}]', guardar: [] },
  { nombre: 'teléfono que no deja guardar', guardado: undefined, guardar: ['a'], bloqueado: true },
];

function argumento(nombre) { return process.argv.includes(nombre); }

function archivosDe(carpeta, commits) {
  const repo = carpeta.startsWith('guajirago-aliados/') ? 'guajirago-aliados' : carpeta.startsWith('guajirago-admin/') ? 'guajirago-admin' : null;
  const commit = commits && (repo === 'guajirago-aliados' ? commits.aliados : repo === 'guajirago-admin' ? commits.admin : commits.raiz);
  if (!commit) return fs.readdirSync(path.join(RAIZ, carpeta)).filter((f) => f.endsWith('.js')).map((f) => carpeta + '/' + f);
  const cwd = repo ? path.join(RAIZ, repo) : RAIZ;
  const dentro = repo ? carpeta.slice(repo.length + 1) : carpeta;
  const salida = execFileSync('git', ['ls-tree', '--name-only', commit, dentro + '/'], { cwd, encoding: 'utf8' });
  return salida.split('\n').filter((f) => f.endsWith('.js')).map((f) => (repo ? repo + '/' : '') + f);
}

/** Sin comentarios, con los mismos renglones y finales LF. */
function limpio(texto) {
  return soloCodigo(texto.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, (s) => s.replace(/[^\n]/g, ' ')));
}

/**
 * Listas del teléfono leídas A MANO: un `localStorage.getItem(` (o `localStorage[`) en un renglón que da una lista por
 * defecto (`[]`), o cualquier mención de las dos claves. Fuera de la pieza no debería quedar ninguna (salvo PENDIENTES).
 */
function aManoEn(texto) {
  const t = limpio(texto);
  const out = [];
  t.split('\n').forEach((r, i) => {
    const lista = /localStorage\s*(?:\.\s*getItem\s*\(|\[)/.test(r) && /\[\s*\]/.test(r);
    const clave = Object.values(CLAVES).some((k) => r.includes("'" + k + "'") || r.includes('"' + k + '"') || r.includes('`' + k + '`'));
    if (lista || clave) out.push({ renglon: i + 1, texto: r.trim().slice(0, 140) });
  });
  return out;
}

/** Un teléfono de mentira: guarda textos como el de verdad; `bloqueado` revienta al leer y al escribir (modo privado). */
function telefonoDeMentira(clave, guardado, bloqueado) {
  const datos = new Map();
  if (guardado !== undefined) datos.set(clave, guardado);
  const no = () => { throw new Error('SecurityError: el teléfono no deja guardar'); };
  return {
    datos,
    getItem: (k) => (bloqueado ? no() : (datos.has(k) ? datos.get(k) : null)),
    setItem: (k, v) => (bloqueado ? no() : datos.set(k, String(v))),
    removeItem: (k) => (bloqueado ? no() : datos.delete(k)),
  };
}

/** Los identificadores que usa una expresión (sin lo que va entre comillas). */
function nombresEn(expr) {
  return new Set((expr.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""').match(/[A-Za-z_$][\w$]*/g)) || []);
}

/**
 * Lo que un archivo le da a sus expresiones: lo que importa de ./recordadosEnTelefono (el texto de la pieza, para
 * correrlo contra el teléfono de mentira) y sus `const X = …;` de UN renglón al principio de la línea.
 */
function ambienteDe(ruta, t, leer, problemas) {
  const defs = new Map();
  for (const m of t.matchAll(/^const ([A-Za-z_$][\w$]*)\s*=\s*(.+);[ \t]*$/gm)) defs.set(m[1], m[0]);
  let pieza = null;
  let importa = [];
  const imp = t.match(/import \{([^}]*)\} from '\.\/recordadosEnTelefono';/);
  if (imp) {
    importa = imp[1].split(',').map((s) => s.trim()).filter(Boolean);
    const de = path.posix.dirname(ruta) + '/recordadosEnTelefono.js';
    const texto = leer(de);
    if (texto == null) problemas.push(ruta + ' importa de ' + de + ' y no existe');
    else pieza = { ruta: de, texto: limpio(texto) };
    for (const n of importa) {
      if (pieza && !new RegExp('^export (?:const|function) ' + n + '\\b', 'm').test(pieza.texto)) problemas.push(ruta + ': importa ' + n + ' y la pieza no lo exporta');
      const usos = (t.match(new RegExp('\\b' + n + '\\b', 'g')) || []).length;
      if (usos < 2) problemas.push(ruta + ': importa ' + n + ' y no lo usa');
    }
  }
  return { defs, pieza, importa };
}

/** Arma una función que corre `codigo` con el teléfono de mentira, `ref` y lo que necesite del archivo y de la pieza. */
function armar(amb, codigo, esExpresion) {
  // Las definiciones del archivo que hacen falta, en orden de dependencia (las que usan otras van después).
  const usadas = [];
  const visitar = (expr, pila) => {
    for (const n of nombresEn(expr)) {
      if (!amb.defs.has(n) || usadas.includes(n) || pila.includes(n)) continue;
      visitar(amb.defs.get(n).replace(/^const [^=]+=/, ''), [...pila, n]);
      usadas.push(n);
    }
  };
  visitar(codigo, []);
  const traidos = amb.importa.filter((n) => !usadas.includes(n));
  const piezaCod = amb.pieza && traidos.length
    ? 'const { ' + traidos.join(', ') + ' } = (() => {\n' + amb.pieza.texto.replace(/^export\s+/gm, '') + '\nreturn { ' + traidos.join(', ') + ' };\n})();\n'
    : '';
  const cuerpo = piezaCod + usadas.map((n) => amb.defs.get(n)).join('\n') + '\n' + (esExpresion ? 'return (' + codigo + ');' : codigo);
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', 'ref', cuerpo);
}

/** Lo que viene después del ancla: `const ids = <esto>;` (la lectura). */
function lecturaDe(t, ancla) {
  const i = t.indexOf(ancla);
  if (i < 0) return null;
  const m = /const ids\s*=\s*([^;\n]+);/.exec(t.slice(i, i + 600));
  return m ? m[1].trim() : null;
}

/** La instrucción que guarda el id nuevo tras el addDoc: `algo(… ref.id …);` que no sea un set* ni pegarToken. */
function guardadoDe(t, ancla) {
  const i = t.indexOf(ancla);
  if (i < 0) return null;
  const trozo = t.slice(i, i + 2500);
  for (const m of trozo.matchAll(/^[ \t]*([A-Za-z_$][\w$]*)\(([^;\n]*\bref\.id\b[^;\n]*)\);/gm)) {
    if (/^set[A-Z]/.test(m[1]) || m[1] === 'pegarToken') continue;
    return m[0].trim();
  }
  return null;
}

/** Corre un caso: guarda los ids uno por uno y luego lee. Devuelve lo leído, lo que quedó en el teléfono y si algo reventó. */
function correrCaso(fnLeer, fnGuardar, clave, caso) {
  const tel = telefonoDeMentira(clave, caso.guardado, caso.bloqueado);
  const fallos = [];
  for (const id of caso.guardar) {
    try { fnGuardar(tel, { id }); } catch (e) { fallos.push('guardar ' + id + ': ' + e.message); }
  }
  let leido;
  try { leido = fnLeer(tel); } catch (e) { fallos.push('leer: ' + e.message); leido = '(revienta)'; }
  const sirve = Array.isArray(leido) && leido.every((x) => typeof x === 'string' && x.length > 0);
  return { leido: JSON.stringify(leido), quedo: tel.datos.has(clave) ? tel.datos.get(clave) : '(nada)', sirve, fallos };
}

/** Mide un estado del código. `commits` = null (el disco) o { raiz, aliados, admin }; `cambios` pisa archivos. */
function medir(commits, cambios = {}) {
  const base = lector(commits || {});
  const leer = (r) => (Object.prototype.hasOwnProperty.call(cambios, r) ? cambios[r] : base(r));
  const problemas = [];

  // 1 · Lo leído a mano en las TRES apps (fuera de la pieza).
  const aMano = [];
  for (const carpeta of CARPETAS) {
    for (const r of archivosDe(carpeta, commits)) {
      if (r === PIEZA) continue;
      const t = leer(r);
      if (t == null) continue;
      for (const l of aManoEn(t)) aMano.push({ archivo: r, renglon: l.renglon, texto: l.texto });
    }
  }

  // 2 · Cada sitio, sacado de su archivo y CORRIDO.
  const sitios = {};
  for (const [nombre, s] of Object.entries(SITIOS)) {
    const crudo = leer(s.archivo);
    if (crudo == null) { problemas.push('no está ' + s.archivo); continue; }
    const t = limpio(crudo);
    const amb = ambienteDe(s.archivo, t, leer, problemas);
    const lee = lecturaDe(t, s.anclaLeer);
    const guarda = guardadoDe(t, s.anclaGuardar);
    if (!lee) problemas.push(s.archivo + ': no encuentro con qué lee la lista (const ids = …) tras «' + s.anclaLeer + '»');
    if (!guarda) problemas.push(s.archivo + ': no encuentro con qué guarda el id nuevo tras «' + s.anclaGuardar + '»');
    if (!lee || !guarda) continue;
    let fLeer;
    let fGuardar;
    try {
      fLeer = armar(amb, lee, true);
      fGuardar = armar(amb, guarda, false);
    } catch (e) { problemas.push(s.archivo + ': no se deja ejecutar: ' + e.message); continue; }
    const resultados = CASOS.map((c) => correrCaso((tel) => fLeer(tel, null), (tel, ref) => fGuardar(tel, ref), s.clave, c));
    sitios[nombre] = {
      archivo: s.archivo, clave: s.clave, lee, guarda,
      origen: amb.pieza ? amb.pieza.ruta : 'a mano', resultados,
    };
  }
  return { commits: commits || 'el disco', problemas, aMano, sitios, pieza: leer(PIEZA) != null };
}

/** Careo: lo que da cada sitio en cada caso (lo leído y lo que queda en el teléfono), antes y ahora. */
function carear(antes, ahora) {
  const diferencias = [];
  let comparaciones = 0;
  for (const n of Object.keys(ahora.sitios)) {
    CASOS.forEach((c, i) => {
      comparaciones += 1;
      const a = antes.sitios[n] && antes.sitios[n].resultados[i];
      const b = ahora.sitios[n].resultados[i];
      const ta = a ? a.leido + ' | ' + a.quedo : '(no medido)';
      const tb = b.leido + ' | ' + b.quedo;
      if (ta !== tb) diferencias.push({ caso: c.nombre, sitio: n, antes: ta, ahora: tb });
    });
  }
  return { comparaciones, diferencias };
}

/** Cuenta pedidos o reservas (ya leídos con nube.doc): cuántos llevan la firma del cliente. */
function contarFirmas(docs) {
  const conFirma = docs.filter((d) => typeof d.clienteId === 'string' && d.clienteId.length > 0).length;
  const clientes = new Set(docs.map((d) => d.clienteId).filter((x) => typeof x === 'string' && x));
  return { total: docs.length, conFirma, sinFirma: docs.length - conFirma, clientes: clientes.size };
}

module.exports = {
  medir, carear, contarFirmas, aManoEn, correrCaso, telefonoDeMentira,
  ANTES, PIEZA, SITIOS, CLAVES, CASOS, PENDIENTES,
};

if (require.main === module) {
  (async () => {
    const pintar = (titulo, m) => {
      console.log('\n── ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : Object.values(m.commits).join(' / ')) + ')');
      console.log('   La pieza (' + PIEZA + '): ' + (m.pieza ? 'existe' : 'no existe'));
      console.log('   Listas del teléfono leídas a mano (fuera de la pieza): ' + m.aMano.length);
      for (const l of m.aMano) console.log('     · ' + l.archivo + ':' + l.renglon + '  ' + l.texto + (PENDIENTES.includes(l.archivo) ? '   (pendiente conocido: código muerto, G67)' : ''));
      for (const [n, s] of Object.entries(m.sitios)) {
        console.log('\n   ' + n + ' · clave «' + s.clave + '» · ← ' + s.origen);
        console.log('     lee:    ' + s.lee);
        console.log('     guarda: ' + s.guarda);
        CASOS.forEach((c, i) => {
          const r = s.resultados[i];
          const leido = r.leido.length > 60 ? r.leido.slice(0, 57) + '…' : r.leido;
          const quedo = r.quedo.length > 50 ? r.quedo.slice(0, 47) + '…' : r.quedo;
          console.log('     ' + (r.sirve ? '  ' : '✗ ') + c.nombre.padEnd(30) + ' lee ' + leido.padEnd(62) + ' queda ' + quedo + (r.fallos.length ? '  ⚠ ' + r.fallos.join('; ') : ''));
        });
        console.log('     Casos en que lo leído NO es una lista de ids que la pantalla pueda usar: ' + s.resultados.filter((r) => !r.sirve).length + ' de ' + CASOS.length);
      }
      if (m.problemas.length) console.log('   ⚠ ' + m.problemas.join('\n   ⚠ '));
    };

    const ahora = medir(null);
    console.log('\n=== LO QUE EL TELÉFONO RECUERDA · G88 · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===');
    pintar('AHORA', ahora);

    if (argumento('--antes')) {
      const antes = medir(ANTES);
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n── CAREO: ' + c.comparaciones + ' comparaciones (caso × sitio: lo leído y lo que queda), ' + c.diferencias.length + ' distintas');
      for (const d of c.diferencias) console.log('   · ' + d.sitio + ' · ' + d.caso + ':\n       antes ' + d.antes.slice(0, 150) + '\n       ahora ' + d.ahora.slice(0, 150));
    }

    if (argumento('--nube')) {
      const { traer, doc, tiposQueNoSupe } = require('./nube.cjs');
      const pedidos = contarFirmas((await traer('pedidos')).map(doc));
      const reservas = contarFirmas((await traer('reservasTurismo')).map(doc));
      console.log('\n── PRODUCCIÓN (¿viven también en la nube, con dueño?)');
      console.log('   pedidos:          ' + pedidos.total + ' · con clienteId ' + pedidos.conFirma + ' · sin ' + pedidos.sinFirma + ' · clientes distintos ' + pedidos.clientes);
      console.log('   reservasTurismo:  ' + reservas.total + ' · con clienteId ' + reservas.conFirma + ' · sin ' + reservas.sinFirma + ' · clientes distintos ' + reservas.clientes);
      if (tiposQueNoSupe().length) console.log('   ⚠ tipos de campo que no supe leer: ' + tiposQueNoSupe().join(', '));
    }

    const fuera = ahora.aMano.filter((l) => !PENDIENTES.includes(l.archivo));
    const ok = ahora.problemas.length === 0 && fuera.length === 0 && Object.values(ahora.sitios).every((s) => s.origen === PIEZA && s.resultados.every((r) => r.sirve));
    console.log('\n' + (ok ? '✓ «Mis pedidos» y «Mis reservas» los recuerda UNA pieza, y siempre da una lista de ids que sirve' : '✗ lo que recuerda el teléfono NO sale de una sola pieza (o da listas que no sirven)'));
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
