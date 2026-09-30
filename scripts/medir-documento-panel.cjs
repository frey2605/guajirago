#!/usr/bin/env node
/**
 * ¿QUÉ ENCUENTRA EL PANEL CUANDO BUSCA A ALGUIEN POR SU DOCUMENTO? — gemelo G79 (29-sep-2026). SOLO LECTURA.
 *
 * El panel busca a una persona por su número de documento en CUATRO sitios, cada uno escrito a mano:
 *   · Códigos de recarga  (guajirago-admin/src/Codigos.js,      buscarConductorPorDocumento)
 *   · Asignar promoción   (guajirago-admin/src/Promociones.js,  buscarUsuarioParaAsignar)
 *   · Créditos            (guajirago-admin/src/Superadmin.js,   buscarConductorCred)
 *   · Administradores     (guajirago-admin/src/Superadmin.js,   buscarUsuario)
 * y el documento lo guarda el registro del conductor (guajirago/src/App.js) TAL COMO SE ESCRIBIÓ, sin limpiar.
 *
 * Este guion:
 *   · cuenta cómo están guardados los documentos en producción (con --nube): limpios, con puntos, espacios…
 *     sin enseñar ningún número (solo la FORMA: 9 por cifra);
 *   · saca las cuatro búsquedas de su archivo (el de hoy, o el de un commit del panel con --commit) y las
 *     EJECUTA con una Firestore de mentira cargada con esas fichas, escribiendo cada documento de varias
 *     maneras (tal cual, con puntos de miles, con espacios…), y cuenta a quién encuentra cada una;
 *   · y hace lo mismo con las fichas guardadas SUCIAS (en memoria, de mentira: no se escribe nada).
 *   · cuenta cuántas consultas `where('documento', …)` hay escritas en las tres apps.
 *
 *   node scripts/medir-documento-panel.cjs [--nube] [--commit <hash del repo guajirago-admin>]
 *
 * Se exporta lo que usa pruebas/documentoPanel.test.js: el medidor y la prueba son UN solo recorrido.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { soloCodigo, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const PANEL = path.join(RAIZ, 'guajirago-admin');

// Las cuatro búsquedas: dónde viven, qué reciben y dónde dejan a quien encontraron.
const BUSQUEDAS = [
  { nombre: 'Códigos de recarga', archivo: 'src/Codigos.js', funcion: 'buscarConductorPorDocumento', entrada: 'argumento', resultado: 'setConductorEncontrado' },
  { nombre: 'Asignar promoción', archivo: 'src/Promociones.js', funcion: 'buscarUsuarioParaAsignar', entrada: 'argumento', resultado: 'setUsuarioAsignar' },
  { nombre: 'Créditos (superadmin)', archivo: 'src/Superadmin.js', funcion: 'buscarConductorCred', entrada: 'busquedaCred', resultado: 'setConductorCred', soloConductor: true },
  { nombre: 'Administradores (superadmin)', archivo: 'src/Superadmin.js', funcion: 'buscarUsuario', entrada: 'busquedaAdmin', resultado: 'setResultadoBusqueda' },
];
const PIEZA = 'src/documentoUsuario.js';

/** Un archivo del panel: del disco, o de un commit del repo guajirago-admin. null si no existe. */
function textoDelPanel(ruta, commit) {
  if (!commit) {
    const p = path.join(PANEL, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', PANEL, 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    return null;
  }
}

// ── LA FIRESTORE DE MENTIRA (SDK modular, lo justo que usan las búsquedas) ─────────────────────────────
// `datos` = { usuarios: { id: {campos} } }. Se porta como la de verdad en lo que importa aquí:
//   · devuelve los documentos ordenados por id (el orden por defecto de Firestore);
//   · `in` exige una lista de 1 a 30 valores, o revienta como la de verdad;
//   · `doc()` con un id que lleve «/» revienta (en la de verdad es una ruta inválida).
function firestoreDeMentira(datos) {
  const consultas = [];
  const snap = (col, id) => {
    const d = (datos[col] || {})[id];
    return { id, exists: () => !!d, data: () => ({ ...d }) };
  };
  return {
    consultas,
    db: { deMentira: true },
    collection: (db, col) => ({ col }),
    doc: (db, col, id) => {
      if (typeof id !== 'string' || id === '' || id.includes('/')) throw new Error('ruta de documento inválida: ' + id);
      return { col, id };
    },
    where: (campo, op, valor) => ({ campo, op, valor }),
    query: (ref, ...filtros) => ({ col: ref.col, filtros }),
    getDoc: async (ref) => snap(ref.col, ref.id),
    getDocs: async (q) => {
      consultas.push(q.filtros.map((f) => f.campo + ' ' + f.op).join(' y '));
      const ids = Object.keys(datos[q.col] || {}).sort();
      const docs = ids.map((id) => snap(q.col, id)).filter((s) => q.filtros.every((f) => {
        const v = s.data()[f.campo];
        if (f.op === '==') return v === f.valor;
        if (f.op === 'in') {
          if (!Array.isArray(f.valor) || f.valor.length === 0 || f.valor.length > 30) {
            throw new Error('«in» pide una lista de 1 a 30 valores, y le llegaron ' + JSON.stringify(f.valor));
          }
          return f.valor.includes(v);
        }
        throw new Error('operador que la Firestore de mentira no conoce: ' + f.op);
      }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
  };
}

/**
 * Carga la pieza del documento (si existe en esa versión) con la Firestore de mentira puesta en lugar de
 * `firebase/firestore`. Devuelve null si esa versión del panel no la tiene.
 */
function cargarPieza(fuente, fs_) {
  if (fuente == null) return null;
  const importFirestore = /^import\s*\{([^}]*)\}\s*from\s*'firebase\/firestore';?[ \t]*\r?$/m;
  const m = fuente.match(importFirestore);
  const nombresFs = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (/^import\s/m.test(fuente.replace(importFirestore, ''))) throw new Error('la pieza del documento importa algo más que firebase/firestore');
  const sinImport = fuente.replace(importFirestore, '');
  const exportados = [...sinImport.matchAll(/^export\s+(?:async\s+)?(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((x) => x[1]);
  const cuerpo = sinImport.replace(/^export\s+/gm, '');
  // eslint-disable-next-line no-new-func
  return new Function(...nombresFs, cuerpo + '\nreturn { ' + exportados.join(', ') + ' };')(...nombresFs.map((n) => fs_[n]));
}

/**
 * Saca una búsqueda de su archivo y la deja lista para correr: devuelve `async (texto) => resultado`, donde
 * resultado es { encontrado: id | null, aviso: texto | null }. La función se corre ENTERA, tal como está
 * escrita, con sus setters apuntados en memoria.
 */
function sacarBusqueda(fuente, b, fs_, pieza) {
  const marca = 'const ' + b.funcion + ' = ';
  const pos = fuente.indexOf(marca);
  if (pos < 0) throw new Error('no encontré «' + marca + '» en ' + b.archivo);
  const c = cuerpoDeLaFuncion(fuente, pos);
  const cabeza = fuente.slice(pos + marca.length, c.ini - 1);
  const codigo = cabeza + '{' + c.texto + '}';
  return async (texto) => {
    const apuntes = {};
    const ambito = {
      db: fs_.db,
      collection: fs_.collection, doc: fs_.doc, where: fs_.where, query: fs_.query,
      getDoc: fs_.getDoc, getDocs: fs_.getDocs,
      busquedaCred: texto, busquedaAdmin: texto,
      ...(pieza || {}),
    };
    const proxy = new Proxy(ambito, {
      has: (t, k) => typeof k === 'string' && (k in t || /^set[A-Z]/.test(k)),
      get: (t, k) => {
        if (k === Symbol.unscopables) return undefined;
        if (k in t) return t[k];
        if (typeof k === 'string' && /^set[A-Z]/.test(k)) return (v) => { apuntes[k] = v; };
        return undefined;
      },
    });
    // eslint-disable-next-line no-new-func
    const fn = new Function('ambito', 'with (ambito) { return (' + codigo + '); }')(proxy);
    if (b.entrada === 'argumento') await fn(texto); else await fn();
    const r = apuntes[b.resultado];
    const aviso = apuntes.setErrorCred || apuntes.setErrorAdmin || null;
    return { encontrado: r && r.id ? r.id : null, aviso: aviso || null };
  };
}

/** Las cuatro búsquedas de una versión del panel (hoy, o `commit`), sobre unos datos. */
function cargarBusquedas(datos, commit, fuentes) {
  const fs_ = firestoreDeMentira(datos);
  const leer = (ruta) => (fuentes && ruta in fuentes ? fuentes[ruta] : textoDelPanel(ruta, commit));
  const pieza = cargarPieza(leer(PIEZA), fs_);
  const lista = BUSQUEDAS.map((b) => {
    const fuente = leer(b.archivo);
    if (fuente == null) throw new Error('no está ' + b.archivo + (commit ? ' en ' + commit : ''));
    return { ...b, correr: sacarBusqueda(fuente, b, fs_, pieza) };
  });
  return { busquedas: lista, consultas: fs_.consultas, pieza };
}

// ── LAS MANERAS DE ESCRIBIR UN DOCUMENTO ───────────────────────────────────────────────────────────────
const miles = (cifras, sep) => cifras.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
const MANERAS = [
  ['tal cual', (d) => d],
  ['con espacios alrededor', (d) => '  ' + d + ' '],
  ['con puntos de miles', (d) => miles(d, '.')],
  ['con espacios de miles', (d) => miles(d, ' ')],
];
// Cómo podría estar guardado SUCIO (el registro guarda lo que se escribió): se prueba en memoria.
const GUARDADOS_SUCIOS = [
  ['guardado con puntos', (d) => miles(d, '.')],
  ['guardado con un espacio al final', (d) => d + ' '],
  ['guardado con espacios de miles', (d) => miles(d, ' ')],
];

/** La FORMA de un documento sin enseñarlo: cada cifra es 9, cada letra es «a». */
const forma = (s) => String(s).replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'a');

/**
 * Corre las cuatro búsquedas con cada ficha que tiene documento y cada manera de escribirlo.
 * `fichas` = { id: {campos} }. Devuelve por búsqueda { encontrados, total, fallos: [...] }.
 */
async function careo(fichas, commit, fuentes, { suciosEnMemoria = false } = {}) {
  const conDoc = Object.entries(fichas).filter(([, f]) => typeof f.documento === 'string' && /\d/.test(f.documento));
  const escenarios = [];
  if (!suciosEnMemoria) {
    for (const [id, f] of conDoc) {
      for (const [manera, fn] of MANERAS) escenarios.push({ datos: { usuarios: fichas }, id, escrito: fn(f.documento.trim()), manera });
    }
  } else {
    for (const [id, f] of conDoc) {
      const limpio = f.documento.replace(/\D/g, '');
      for (const [guardado, fn] of GUARDADOS_SUCIOS) {
        const datos = { usuarios: { ...fichas, [id]: { ...f, documento: fn(limpio) } } };
        escenarios.push({ datos, id, escrito: limpio, manera: guardado + ', escrito limpio' });
      }
    }
  }
  const resultado = {};
  for (const b of BUSQUEDAS) resultado[b.nombre] = { encontrados: 0, total: 0, fallos: [], maneras: {} };
  for (const e of escenarios) {
    const { busquedas } = cargarBusquedas(e.datos, commit, fuentes);
    for (const b of busquedas) {
      // Créditos solo acepta conductores (a propósito): una ficha de pasajero no cuenta para ella.
      if (b.soloConductor && e.datos.usuarios[e.id].tipo !== 'conductor') continue;
      // eslint-disable-next-line no-await-in-loop
      const r = await b.correr(e.escrito);
      const fila = resultado[b.nombre];
      fila.total += 1;
      fila.maneras[e.manera] = fila.maneras[e.manera] || { encontrados: 0, total: 0 };
      fila.maneras[e.manera].total += 1;
      if (r.encontrado === e.id) { fila.encontrados += 1; fila.maneras[e.manera].encontrados += 1; } else fila.fallos.push({ id: e.id, manera: e.manera, obtuvo: r });
    }
  }
  return resultado;
}

/** Cuántas consultas `where('documento', …)` hay escritas en el código (sin comentarios), archivo por archivo. */
function consultasEscritas(commit) {
  const cuenta = {};
  const recorrer = (dirRepo, sub, lector) => {
    const dir = path.join(RAIZ, dirRepo, sub);
    if (!fs.existsSync(dir)) return;
    for (const a of fs.readdirSync(dir)) {
      if (!a.endsWith('.js')) continue;
      const t = lector(sub + '/' + a);
      if (t == null) continue;
      const n = (soloCodigo(t).match(/where\(\s*['"]documento['"]/g) || []).length;
      if (n) cuenta[path.posix.join(dirRepo, sub, a)] = n;
    }
  };
  recorrer('guajirago-admin', 'src', (r) => textoDelPanel(r, commit));
  recorrer('guajirago', 'src', (r) => fs.readFileSync(path.join(RAIZ, 'guajirago', r), 'utf8'));
  recorrer('guajirago-aliados', 'src', (r) => fs.readFileSync(path.join(RAIZ, 'guajirago-aliados', r), 'utf8'));
  recorrer('guajirago', 'functions', (r) => fs.readFileSync(path.join(RAIZ, 'guajirago', r), 'utf8'));
  return cuenta;
}

// Fichas de mentira para correr sin red (las usa la prueba). Documentos inventados.
const FICHAS_DE_MENTIRA = {
  a1: { tipo: 'conductor', nombre: 'Conductor Uno', email: 'uno@x.co', documento: '1122334455' },
  b2: { tipo: 'conductor', nombre: 'Conductor Dos', email: 'dos@x.co', documento: '84123456' },
  c3: { tipo: 'pasajero', nombre: 'Pasajera Tres', email: 'tres@x.co', documento: '40912' },
  d4: { tipo: 'pasajero', nombre: 'Sin documento', email: 'cuatro@x.co' },
};

async function principal() {
  const arg = process.argv.slice(2);
  const iC = arg.indexOf('--commit');
  const commit = iC >= 0 ? arg[iC + 1] : null;
  let fichas = FICHAS_DE_MENTIRA;
  console.log('\n🪪  BUSCAR POR DOCUMENTO EN EL PANEL — G79' + (commit ? ' · panel en ' + commit : ' · panel de hoy (disco)'));
  if (arg.includes('--nube')) {
    const { traer, doc } = require('./nube.cjs');
    const us = (await traer('usuarios')).map(doc);
    fichas = {};
    for (const u of us) { const { id, ...resto } = u; fichas[id] = resto; }
    const conDoc = us.filter((u) => 'documento' in u);
    const formas = {};
    for (const u of conDoc) { const k = typeof u.documento + ' ' + forma(u.documento); formas[k] = (formas[k] || 0) + 1; }
    const sucios = conDoc.filter((u) => typeof u.documento !== 'string' || !/^[0-9A-Za-z]+$/.test(u.documento));
    const limpios = {};
    for (const u of conDoc) { const l = String(u.documento).replace(/[^0-9A-Za-z]/g, ''); limpios[l] = (limpios[l] || 0) + 1; }
    const campos = {};
    for (const u of us) for (const k of Object.keys(u)) if (/docu|cedula|identi/i.test(k)) campos[k] = (campos[k] || 0) + 1;
    console.log('\n  PRODUCCIÓN (solo lectura): ' + us.length + ' fichas en «usuarios», ' + conDoc.length + ' con «documento»');
    console.log('    campos que se llaman parecido: ' + JSON.stringify(campos));
    console.log('    formas guardadas (9 = cifra): ' + JSON.stringify(formas));
    console.log('    guardados SUCIOS (con algo que no es letra ni cifra): ' + sucios.length + ' de ' + conDoc.length);
    console.log('    documentos REPETIDOS después de limpiarlos: ' + Object.values(limpios).filter((n) => n > 1).length);
  } else {
    console.log('  (sin --nube: fichas de mentira)');
  }

  const pinta = (titulo, r) => {
    console.log('\n  ' + titulo);
    for (const [nombre, fila] of Object.entries(r)) {
      const detalle = Object.entries(fila.maneras).map(([m, x]) => m + ' ' + x.encontrados + '/' + x.total).join(' · ');
      console.log('    ' + (fila.encontrados === fila.total ? '✓' : '✗') + ' ' + nombre.padEnd(30) + fila.encontrados + ' de ' + fila.total + '   (' + detalle + ')');
    }
  };
  const r1 = await careo(fichas, commit);
  pinta('LA PERSONA TIENE EL DOCUMENTO GUARDADO LIMPIO, Y EL ADMINISTRADOR LO ESCRIBE DE VARIAS MANERAS', r1);
  const r2 = await careo(fichas, commit, null, { suciosEnMemoria: true });
  pinta('EL DOCUMENTO ESTÁ GUARDADO SUCIO (en memoria, de mentira) Y EL ADMINISTRADOR LO ESCRIBE LIMPIO', r2);

  const c = consultasEscritas(commit);
  const total = Object.values(c).reduce((a, b) => a + b, 0);
  console.log('\n  CONSULTAS «where(documento…)» ESCRITAS EN LAS TRES APPS: ' + total);
  for (const [a, n] of Object.entries(c)) console.log('    ' + a + ': ' + n);
  const fallan = [...Object.values(r1), ...Object.values(r2)].reduce((a, f) => a + (f.total - f.encontrados), 0);
  console.log('\n  ' + (fallan === 0 ? '✓ las cuatro búsquedas encuentran a la persona en todos los casos' : '✗ ' + fallan + ' casos en que la búsqueda no encuentra a la persona') + '\n');
}

module.exports = {
  BUSQUEDAS, PIEZA, MANERAS, GUARDADOS_SUCIOS, FICHAS_DE_MENTIRA,
  textoDelPanel, firestoreDeMentira, cargarPieza, sacarBusqueda, cargarBusquedas, careo, consultasEscritas, forma,
};

if (require.main === module) {
  principal().catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
}
