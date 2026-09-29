#!/usr/bin/env node
/**
 * 🧭 ¿ADÓNDE LLEVAN «MIS VIAJES» Y «GANANCIAS»? — gemelo G51 (29-sep-2026) · SOLO LECTURA
 *
 * El menú lateral (`MenuLateral.js`) sale en muchas pantallas de la app de transporte, y cada pantalla le dice a
 * dónde lleva cada opción. Hasta el 29-sep-2026 «Mis viajes» abría TRES pantallas distintas según desde dónde se
 * tocara (la del menú de módulos, la del pasajero y la del conductor), y «Ganancias» contestaba «Esta función estará
 * disponible muy pronto» en la pantalla del pasajero, aunque la pantalla existe.
 *
 * Este guion NO lee los botones como texto: de cada pantalla SACA lo que el botón hace (el `onIrViajes={…}` y el
 * `onIrGanancias={…}` que le pasa al menú, y el `onClick` de la tarjeta «Mis viajes» del conductor), lo EJECUTA con
 * los `set…` de mentira que apuntan qué cambió, y después CORRE la cadena de `if (…) return <Pantalla` de esa misma
 * pantalla con el estado que quedó. Lo que sale es la pantalla que de verdad se abre.
 *
 * El juez es la tabla `pantallaDelMenu` de guajirago/src/navegacionMenu.js (la del DISCO, también cuando se corre el
 * código de otro commit). Si la tabla no existe todavía, el juez es otro: que para la misma persona todas las
 * entradas abran lo mismo, y que ninguna diga «muy pronto».
 *
 *   node scripts/medir-menu-navegacion.cjs [--commit <hash>] [--sin-datos]
 *
 * Con `--commit` corre las pantallas de ese commit (careo antes/después). Sin `--sin-datos` cuenta además, en
 * producción, cuántas personas tienen viajes de los dos lados (pasajero y conductor): son las únicas para las que la
 * pantalla «de los dos lados» y la de su papel enseñan cosas distintas. No escribe nada.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cuerpoDeLaFuncion, sinTextos } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const TABLA = 'guajirago/src/navegacionMenu.js';
const OPCIONES = ['viajes', 'ganancias'];
const PAPELES = ['pasajero', 'conductor', ''];

// La pantalla que pinta cada componente, en palabras. Y qué clave de la tabla la nombra.
const COMPONENTE = {
  Historial: 'historialPasajero',
  HistorialConductor: 'historialConductor',
  MisViajes: 'misViajes',
  Ganancias: 'ganancias',
};
const EN_PALABRAS = {
  historialPasajero: 'historial del pasajero',
  historialConductor: 'historial del conductor',
  misViajes: 'historial de los dos lados',
  ganancias: 'Ganancias',
  muyPronto: '«muy pronto»',
  nada: 'no abre nada',
};

// Las entradas: dónde está el botón, en qué pantalla de la app, y con qué papeles se puede llegar ahí.
//   · App.js: las pantallas de antes de escoger papel (y las de los módulos). Ahí la persona puede ser cualquiera: el
//     papel es `tipoUsuario` (el último que escogió, o el de su ficha; vacío si la ficha no lo dice).
//   · Home.js: la pantalla del pasajero. Quien está ahí está pidiendo como pasajero, sea cual sea su ficha.
//   · AppConductor.js: la pantalla del conductor.
const PANTALLAS_DE_APP = ['modulos', 'rol', 'mensajeria', 'restaurantes', 'turismo', 'datos_conductor'];
const ENTRADAS = [
  ...PANTALLAS_DE_APP.map((s) => ({
    nombre: 'menú de «' + s + '»', archivo: 'guajirago/src/App.js', componente: 'App', papeles: PAPELES,
    busca: (t) => lineaQueEmpieza(t, "if (screen === '" + s + "') return"), estado: (papel) => ({ screen: s, tipoUsuario: papel }),
  })),
  {
    nombre: 'menú del pasajero', archivo: 'guajirago/src/Home.js', componente: 'Home', papeles: ['pasajero'],
    busca: (t) => elementoMenu(t), estado: () => ({}),
  },
  {
    nombre: 'menú del conductor', archivo: 'guajirago/src/AppConductor.js', componente: 'AppConductor', papeles: ['conductor'],
    busca: (t) => elementoMenu(t), estado: () => ({}),
  },
  {
    nombre: 'tarjeta «Mis viajes» del conductor', archivo: 'guajirago/src/AppConductor.js', componente: 'AppConductor',
    papeles: ['conductor'], soloOpcion: 'viajes', busca: (t) => tarjetaMisViajes(t), estado: () => ({}),
  },
];

/** El texto de un archivo del repo raíz: el del disco, o el de un commit. null si no existe. */
function textoDe(ruta, commit) {
  if (!commit) {
    const p = path.join(RAIZ, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
  }
  try {
    return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .replace(/\r\n/g, '\n');
  } catch { return null; }
}

/** La tabla (`navegacionMenu.js`) de un texto. null si no hay texto. */
function laTabla(texto) {
  if (texto == null) return null;
  if (/^import\s/m.test(texto)) throw new Error(TABLA + ' importa algo: tiene que ser una tabla pura');
  const nombres = [...texto.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  // eslint-disable-next-line no-new-func
  return new Function(texto.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')();
}

// ── Sacar trozos del archivo ────────────────────────────────────────────────
function lineaQueEmpieza(t, inicio) {
  const i = t.indexOf(inicio);
  if (i < 0) return null;
  const fin = t.indexOf('\n', i);
  return t.slice(i, fin < 0 ? t.length : fin);
}
function elementoMenu(t) {
  const i = sinTextos(t).indexOf('<MenuLateral ');
  if (i < 0) return null;
  const fin = sinTextos(t).indexOf('/>', i);
  return t.slice(i, fin + 2);
}
/** El `onClick` de la tarjeta cuyo título es «Mis viajes» (la de la pantalla del conductor). */
function tarjetaMisViajes(t) {
  const titulo = t.indexOf(">Mis viajes</p>");
  if (titulo < 0) return null;
  const div = t.lastIndexOf('<div onClick={', titulo);
  if (div < 0) return null;
  const expr = valorDeLaLlave(t, div + '<div onClick='.length);
  return expr == null ? null : 'onIrViajes={' + expr + '}';
}
/** Lo que va entre la llave que abre en `abre` y la que la cierra. */
function valorDeLaLlave(t, abre) {
  const s = sinTextos(t);
  if (s[abre] !== '{') return null;
  let i = abre + 1;
  let hondo = 1;
  while (i < s.length && hondo > 0) {
    if (s[i] === '{') hondo += 1;
    else if (s[i] === '}') hondo -= 1;
    i += 1;
  }
  return t.slice(abre + 1, i - 1);
}
/** El `{…}` que el trozo le pasa a una propiedad (`onIrViajes`). null si no se la pasa. */
function propiedad(trozo, nombre) {
  const m = new RegExp('\\b' + nombre + '=\\{').exec(sinTextos(trozo));
  if (!m) return null;
  return valorDeLaLlave(trozo, m.index + nombre.length + 1);
}
/** La declaración `const NOMBRE = …;` del cuerpo, su lado derecho. null si no está. */
function declaracion(cuerpo, nombre) {
  const m = new RegExp('\\bconst\\s+' + nombre + '\\s*=\\s*').exec(sinTextos(cuerpo));
  if (!m) return null;
  const s = sinTextos(cuerpo);
  let i = m.index + m[0].length;
  const desde = i;
  let hondo = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(' || c === '{' || c === '[') hondo += 1;
    else if (c === ')' || c === '}' || c === ']') hondo -= 1;
    else if ((c === ';' || c === '\n') && hondo === 0) break;
    i += 1;
  }
  return cuerpo.slice(desde, i);
}

// ── Ejecutar ────────────────────────────────────────────────────────────────
/** Los `useState` del cuerpo: { estado: valorInicial, setter: estado }. Solo iniciales literales; los demás, undefined. */
function losEstados(cuerpo) {
  const inicial = {};
  const deSetter = {};
  for (const m of cuerpo.matchAll(/const\s*\[\s*(\w*)\s*,\s*(set\w+)\s*\]\s*=\s*(?:React\.)?useState\(([^)\n]*)\)/g)) {
    const [, nombre, setter, ini] = m;
    let v;
    // eslint-disable-next-line no-new-func
    if (/^\s*(true|false|null|'[^']*'|"[^"]*"|-?\d+)\s*$/.test(ini)) v = new Function('return (' + ini + ');')();
    if (nombre) inicial[nombre] = v;
    deSetter[setter] = nombre || null;
  }
  return { inicial, deSetter };
}

/** Un ámbito para `with`: los `set…` apuntan lo que cambian, y lo demás sale de `valores` o de las declaraciones del cuerpo. */
function ambito(cuerpo, valores, cambios, estados) {
  const hechos = {};
  const p = new Proxy({}, {
    has: (_, k) => typeof k === 'string' && !(k in globalThis && !(k in valores) && !/^set[A-Z]/.test(k) && declaracion(cuerpo, k) == null),
    get: (_, k) => {
      if (k === Symbol.unscopables) return undefined;
      if (k in valores) return valores[k];
      if (/^set[A-Z]/.test(k)) {
        return (v) => {
          const nombre = estados.deSetter[k];
          if (nombre) cambios[nombre] = typeof v === 'function' ? v(cambios[nombre]) : v;
        };
      }
      if (k in hechos) return hechos[k];
      const d = declaracion(cuerpo, k);
      if (d == null) return undefined;
      // eslint-disable-next-line no-new-func
      hechos[k] = new Function('__s', 'with (__s) { return (' + d + '); }')(p);
      return hechos[k];
    },
  });
  return p;
}

/** La cadena de `if (…) return <Pantalla` del cuerpo, en orden. */
function laCadena(cuerpo) {
  return [...cuerpo.matchAll(/\bif\s*\(([^\n]+?)\)\s*\{?\s*return\s*\(?\s*(?:<>)?\s*<([A-Z]\w*)/g)].map((m) => ({ cond: m[1], comp: m[2] }));
}

/** Qué pantalla se pinta con este estado: el primer `if` que se cumple. */
function quePinta(cuerpo, estado) {
  const s = new Proxy({}, {
    has: (_, k) => typeof k === 'string' && !(k in globalThis && !(k in estado)),
    get: (_, k) => (k === Symbol.unscopables ? undefined : estado[k]),
  });
  for (const { cond, comp } of laCadena(cuerpo)) {
    let si = false;
    // eslint-disable-next-line no-new-func
    try { si = new Function('__s', 'with (__s) { return (' + cond + '); }')(s); } catch { si = false; }
    if (si) return comp;
  }
  return null;
}

/**
 * Lo que de verdad abre una opción desde una entrada, con un papel. Devuelve la clave (`historialPasajero`…),
 * `muyPronto` si el botón no recibe nada (el menú contesta «muy pronto»), o `nada` si el botón no cambia la pantalla.
 * `textos` permite pasar los archivos a mano (sabotajes de la prueba); si no, salen de `commit` o del disco.
 */
function loQueAbre(entrada, opcion, papel, { commit, textos = {} } = {}) {
  const t = textos[entrada.archivo] != null ? textos[entrada.archivo] : textoDe(entrada.archivo, commit);
  if (t == null) throw new Error('no encuentro ' + entrada.archivo);
  const i = t.indexOf('function ' + entrada.componente + '(');
  if (i < 0) throw new Error(entrada.archivo + ': no encuentro la pantalla ' + entrada.componente);
  const cuerpo = (cuerpoDeLaFuncion(t, i) || {}).texto || "";
  const trozo = entrada.busca(t);
  if (trozo == null) throw new Error(entrada.archivo + ': no encuentro el botón de «' + entrada.nombre + '»');
  const expr = propiedad(trozo, opcion === 'viajes' ? 'onIrViajes' : 'onIrGanancias');
  if (expr == null) return 'muyPronto';

  const estados = losEstados(cuerpo);
  const valores = { ...estados.inicial, ...entrada.estado(papel) };
  const tabla = laTabla(textos[TABLA] != null ? textos[TABLA] : textoDe(TABLA, commit));
  if (tabla) Object.assign(valores, tabla);
  const antes = quePinta(cuerpo, valores);
  const cambios = { ...valores };
  // eslint-disable-next-line no-new-func
  const manejador = new Function('__s', 'with (__s) { return (' + expr + '); }')(ambito(cuerpo, valores, cambios, estados));
  if (typeof manejador === 'function') manejador();
  const despues = quePinta(cuerpo, cambios);
  if (despues === antes || !(despues in COMPONENTE)) return 'nada';
  return COMPONENTE[despues];
}

/** Todas las combinaciones (entrada × papel × opción) y lo que abren. */
function medir(opciones = {}) {
  const filas = [];
  for (const e of ENTRADAS) {
    for (const opcion of OPCIONES) {
      if (e.soloOpcion && e.soloOpcion !== opcion) continue;
      for (const papel of e.papeles) filas.push({ entrada: e.nombre, opcion, papel, abre: loQueAbre(e, opcion, papel, opciones) });
    }
  }
  return filas;
}

/** El veredicto: con la tabla del disco como juez (si existe), o sin ella (que todas las entradas digan lo mismo). */
function veredicto(filas) {
  const juez = laTabla(textoDe(TABLA));
  const malas = [];
  const porPersona = {};
  for (const f of filas) {
    const k = f.opcion + '|' + f.papel;
    (porPersona[k] = porPersona[k] || new Set()).add(f.abre);
    if (f.abre === 'muyPronto' || f.abre === 'nada') malas.push(f);
    else if (juez && juez.pantallaDelMenu(f.opcion, f.papel) !== f.abre) malas.push(f);
  }
  const distintas = Object.entries(porPersona).filter(([, s]) => s.size > 1).map(([k, s]) => ({ quien: k, abre: [...s] }));
  return { juez: !!juez, malas, distintas, total: filas.length };
}

/** Producción: cuántas personas tienen viajes de un lado, del otro, o de los dos. */
async function contarPersonas() {
  const { traer, doc } = require('./nube.cjs');
  const viajes = (await traer('viajes')).map(doc);
  const pas = new Set(viajes.map((v) => v.pasajeroId).filter(Boolean));
  const con = new Set(viajes.map((v) => v.conductorId).filter(Boolean));
  const dos = [...pas].filter((u) => con.has(u));
  const usuarios = (await traer('usuarios')).map(doc);
  const porTipo = {};
  for (const u of usuarios) porTipo[u.tipo || '(sin tipo)'] = (porTipo[u.tipo || '(sin tipo)'] || 0) + 1;
  return { viajes: viajes.length, soloPasajero: pas.size - dos.length, soloConductor: con.size - dos.length, losDos: dos.length, porTipo };
}

if (require.main === module) {
  (async () => {
    const commit = arg('--commit');
    console.log('🧭 ¿Adónde llevan «Mis viajes» y «Ganancias»? · código ' + (commit ? 'del commit ' + commit : 'del disco'));
    const filas = medir({ commit });
    for (const f of filas) {
      console.log('  ' + (f.opcion === 'viajes' ? 'Mis viajes' : 'Ganancias ') + ' · ' + (f.papel || '(sin papel)').padEnd(11)
        + ' · ' + f.entrada.padEnd(36) + ' → ' + EN_PALABRAS[f.abre]);
    }
    const v = veredicto(filas);
    console.log('\nJuez: ' + (v.juez ? 'la tabla de ' + TABLA : 'no hay tabla todavía: que todas las entradas digan lo mismo'));
    for (const d of v.distintas) {
      const [op, papel] = d.quien.split('|');
      console.log('  🔴 ' + (op === 'viajes' ? 'Mis viajes' : 'Ganancias') + ' para ' + (papel || '(sin papel)')
        + ' abre ' + d.abre.length + ' cosas distintas según desde dónde: ' + d.abre.map((a) => EN_PALABRAS[a]).join(' / '));
    }
    const pronto = v.malas.filter((f) => f.abre === 'muyPronto').length;
    console.log('  «muy pronto» o nada: ' + v.malas.filter((f) => f.abre === 'muyPronto' || f.abre === 'nada').length + ' de ' + v.total
      + ' (de ellas «muy pronto»: ' + pronto + ')');
    console.log('  personas (opción+papel) con más de una pantalla: ' + v.distintas.length);
    console.log('  combinaciones que no abren lo que dice la tabla (o «muy pronto»): ' + v.malas.length + ' de ' + v.total);

    if (!process.argv.includes('--sin-datos')) {
      try {
        const c = await contarPersonas();
        console.log('\nProducción (solo lectura): ' + c.viajes + ' viajes · personas solo pasajero ' + c.soloPasajero
          + ' · solo conductor ' + c.soloConductor + ' · con viajes de LOS DOS lados ' + c.losDos);
        console.log('  usuarios por tipo: ' + Object.entries(c.porTipo).map(([k, n]) => k + ' ' + n).join(' · '));
      } catch (e) {
        console.log('\n(no pude leer producción: ' + e.message + ')');
      }
    }
    console.log(v.malas.length || v.distintas.length ? '\n🔴 no está en orden' : '\n✓ cada persona abre UNA pantalla por opción, la de la tabla, y ninguna dice «muy pronto»');
  })().catch((e) => { console.log('🔴 ' + e.message); process.exit(1); });
}

module.exports = { ENTRADAS, OPCIONES, PAPELES, COMPONENTE, EN_PALABRAS, TABLA, loQueAbre, medir, veredicto, laTabla, textoDe };
