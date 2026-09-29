#!/usr/bin/env node
/**
 * 🤝 «¡TRATO HECHO!»: ¿CUÁNTAS VECES ESTÁ DIBUJADA Y CÓMO SE VE? — gemelo G74 (29-sep-2026), SOLO LECTURA.
 *
 * La ventanita blanca con el 🤝, los confetis y «¡Trato hecho! · El viaje está confirmado 🚀» sale en las dos puntas
 * del viaje: al pasajero cuando acepta una oferta (Solicitar.js) y al conductor cuando el pasajero lo escoge
 * (AppConductor.js). Cada pantalla la tenía dibujada a mano, en su propia `function Celebracion()`, copiada igual.
 * No toca datos: es solo código.
 *
 *   node scripts/medir-trato-hecho.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-trato-hecho.cjs --commit <hash>  <- otro commit de la raíz (careo)
 *   node scripts/medir-trato-hecho.cjs --html           <- además, el HTML que pinta cada pantalla
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. En cada pantalla, lo que se pinta mientras `celebrando` está puesto (`if (celebrando) return <X />;`): se busca
 *     ese <X/>, se saca su función (del mismo archivo o de la pieza que importe, con el analizador de Babel, el mismo
 *     con que compila la app), se compila y se PINTA con React (renderToStaticMarkup): su HTML y su huella.
 *  2. Cuánto dura: el `setTimeout` que apaga `celebrando` (`setCelebrando(false)`), en cada sitio que lo prende. La
 *     duración NO es de este gemelo: tiene que quedar igual (el robot `ruta-conductor` ya tropezó con ella, G60).
 *  3. El RESTO de cada pantalla (el archivo sin la función de la ventanita, sin el import de la pieza y con el <X/>
 *     cambiado por una marca): su huella. Con el arreglo tiene que quedar igual.
 *  4. En las TRES apps: cuántas veces está dibujado «¡Trato hecho!» en el código (sin contar comentarios).
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, soloCodigo } = require('../pruebas/cargar.cjs');

const NM = path.join(RAIZ, 'guajirago', 'node_modules');
const pedir = (n) => {
  try { return require(path.join(NM, n)); } catch (e) {
    throw new Error('hace falta ' + n + ' en guajirago/node_modules (npm ci dentro de guajirago): ' + e.message);
  }
};
const babel = pedir('@babel/core');
const presetReact = pedir('@babel/preset-react');
const React = pedir('react');
const servidor = pedir('react-dom/server');

const PANTALLAS = [
  { archivo: 'guajirago/src/Solicitar.js', nombre: 'el pasajero (Solicitar)' },
  { archivo: 'guajirago/src/AppConductor.js', nombre: 'el conductor (AppConductor)' },
];
const TEXTO = '¡Trato hecho!';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i >= 0 ? process.argv[i + 1] : null;
}

/** Lee un archivo de la raíz: del disco, o de un commit. `cambios` ({ ruta: texto }) pisa lo que haya: las pantallas de mentira de la prueba. */
function lector(commit, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    try {
      return execFileSync('git', ['show', commit + ':' + r], { cwd: RAIZ, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Los .js de una carpeta (del disco o de un commit). Los repos hermanos solo se miran en el disco: un commit es de la raíz. */
function listar(carpeta, commit) {
  if (!commit || carpeta !== 'guajirago/src') {
    const abs = path.join(RAIZ, carpeta);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs).filter((f) => f.endsWith('.js')).map((f) => carpeta + '/' + f);
  }
  return execFileSync('git', ['ls-tree', '--name-only', commit, carpeta + '/'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.js'));
}

const huella = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const analizar = (texto) => babel.parseSync(texto, {
  presets: [[presetReact, { runtime: 'classic' }]], babelrc: false, configFile: false, sourceType: 'module',
});
const compilar = (fuente) => babel.transformSync(fuente, {
  presets: [[presetReact, { runtime: 'classic' }]], babelrc: false, configFile: false, sourceType: 'script',
}).code;

/** El <X/> que devuelve `if (celebrando) return <X />;` (todas las veces que aparezca). */
function loQueSePintaAlCelebrar(ast) {
  const hallados = [];
  babel.traverse(ast, {
    IfStatement(p) {
      const t = p.node.test;
      if (!(t.type === 'Identifier' && t.name === 'celebrando')) return;
      const c = p.node.consequent;
      const ret = c.type === 'ReturnStatement' ? c : (c.type === 'BlockStatement' && c.body.length === 1 && c.body[0].type === 'ReturnStatement' ? c.body[0] : null);
      if (ret && ret.argument && ret.argument.type === 'JSXElement') {
        hallados.push({ nombre: ret.argument.openingElement.name.name, start: ret.argument.start, end: ret.argument.end, props: ret.argument.openingElement.attributes.length });
      }
    },
  });
  return hallados;
}

/** La `function <nombre>(…) {…}` declarada en el archivo, o null. */
function funcionDelArchivo(ast, nombre) {
  let f = null;
  babel.traverse(ast, {
    FunctionDeclaration(p) { if (p.node.id && p.node.id.name === nombre && p.parent.type === 'Program') f = p.node; },
  });
  return f;
}

/** ¿De qué archivo importa `nombre` por defecto? (`import X from './Y';`) → 'guajirago/src/Y.js', o null. */
function importadoDe(ast, nombre, carpeta) {
  for (const n of ast.program.body) {
    if (n.type !== 'ImportDeclaration' || !n.source.value.startsWith('./')) continue;
    if (n.specifiers.some((s) => s.type === 'ImportDefaultSpecifier' && s.local.name === nombre)) {
      const r = n.source.value.replace(/^\.\//, '');
      return { ruta: carpeta + '/' + (r.endsWith('.js') ? r : r + '.js'), start: n.start, end: n.end };
    }
  }
  return null;
}

/** Compila la función de la ventanita y la PINTA: el HTML, o el motivo de por qué no se pudo. */
function pintar(fuenteFuncion, nombre) {
  const js = compilar(fuenteFuncion);
  // eslint-disable-next-line no-new-func
  const Comp = new Function('React', js + '\nreturn ' + nombre + ';')(React);
  return servidor.renderToStaticMarkup(React.createElement(Comp));
}

/** Los `setTimeout` que apagan la ventanita: su duración en milisegundos, en el orden del archivo. */
function duraciones(ast, texto) {
  const ms = [];
  babel.traverse(ast, {
    CallExpression(p) {
      const n = p.node;
      if (!(n.callee.type === 'Identifier' && n.callee.name === 'setTimeout') || n.arguments.length < 2) return;
      const cuerpo = texto.slice(n.arguments[0].start, n.arguments[0].end);
      if (!/setCelebrando\(\s*false\s*\)/.test(cuerpo)) return;
      const d = n.arguments[1];
      ms.push(d.type === 'NumericLiteral' ? d.value : texto.slice(d.start, d.end));
    },
  });
  return ms;
}

/** El archivo sin la ventanita: sin su función, sin el import de la pieza, con el <X/> cambiado por una marca. */
function elResto(texto, cortes, marcas) {
  const todos = [...cortes.map((c) => ({ ...c, por: '' })), ...marcas.map((m) => ({ ...m, por: '«VENTANITA»' }))].sort((a, b) => b.start - a.start);
  let t = texto;
  for (const c of todos) t = t.slice(0, c.start) + c.por + t.slice(c.end);
  // los comentarios que acompañan al cambio no cuentan como «resto»: se quitan los de renglón entero.
  return t.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\s+/g, ' ').trim();
}

function medir(commit, cambios = {}) {
  const leer = lector(commit, cambios);
  const pantallas = PANTALLAS.map((p) => {
    const texto = leer(p.archivo);
    if (texto == null) throw new Error('no está ' + p.archivo + (commit ? ' en ' + commit : ''));
    const ast = analizar(texto);
    const pintadas = loQueSePintaAlCelebrar(ast);
    const cortes = [];
    const ventanitas = pintadas.map((x) => {
      const local = funcionDelArchivo(ast, x.nombre);
      if (local) {
        cortes.push({ start: local.start, end: local.end });
        return { nombre: x.nombre, deDonde: 'dibujada en su propio archivo', props: x.props, html: pintar(texto.slice(local.start, local.end), x.nombre) };
      }
      const imp = importadoDe(ast, x.nombre, path.posix.dirname(p.archivo));
      if (!imp) return { nombre: x.nombre, deDonde: '(no se encontró de dónde sale)', props: x.props, html: null };
      cortes.push({ start: imp.start, end: imp.end });
      const pieza = leer(imp.ruta);
      if (pieza == null) return { nombre: x.nombre, deDonde: 'importada de ' + imp.ruta + ', que NO existe', props: x.props, html: null };
      const astP = analizar(pieza);
      let decl = null;
      for (const n of astP.program.body) if (n.type === 'ExportDefaultDeclaration' && n.declaration.type === 'FunctionDeclaration') decl = n.declaration;
      if (!decl) return { nombre: x.nombre, deDonde: 'importada de ' + imp.ruta + ', que no exporta una función por defecto', props: x.props, html: null };
      return { nombre: x.nombre, deDonde: 'de la pieza ' + imp.ruta.replace('guajirago/src/', ''), pieza: imp.ruta, props: x.props, html: pintar(pieza.slice(decl.start, decl.end), decl.id.name) };
    });
    return { ...p, ventanitas, duraciones: duraciones(ast, texto), resto: huella(elResto(texto, cortes, pintadas)) };
  });

  // En las tres apps: cuántas veces está dibujado «¡Trato hecho!» en el código, y dónde.
  const dibujadas = [];
  for (const carpeta of CARPETAS) {
    for (const r of [...new Set([...listar(carpeta, commit), ...Object.keys(cambios).filter((k) => k.startsWith(carpeta + '/'))])]) {
      const t = leer(r);
      if (t == null || !t.includes(TEXTO)) continue;
      // lo DIBUJADO: el texto dentro del JSX (o en una cadena del código), nunca un comentario, vaya donde vaya.
      let n = 0;
      try {
        babel.traverse(analizar(t), {
          JSXText(p) { n += p.node.value.split(TEXTO).length - 1; },
          StringLiteral(p) { n += p.node.value.split(TEXTO).length - 1; },
          TemplateElement(p) { n += p.node.value.raw.split(TEXTO).length - 1; },
        });
      } catch (e) {
        n = soloCodigo(t.replace(/\r\n/g, '\n')).split(TEXTO).length - 1; // un archivo que Babel no lee: a lo bruto
      }
      if (n) dibujadas.push(r + ' ×' + n);
    }
  }
  return { pantallas, dibujadas };
}

function informe(m, etiqueta) {
  console.log('\n🤝 «¡Trato hecho!» · ' + etiqueta);
  for (const p of m.pantallas) {
    console.log('  · ' + p.nombre + ': ' + p.ventanitas.length + ' ventanita(s) · dura ' + (p.duraciones.join(', ') || '(no se encontró)') + ' ms · resto de la pantalla ' + p.resto);
    for (const v of p.ventanitas) console.log('      <' + v.nombre + '/> ' + v.deDonde + ' · huella ' + (v.html ? huella(v.html) : '(no se pudo pintar)'));
  }
  const [a, b] = m.pantallas.map((p) => (p.ventanitas[0] || {}).html);
  console.log('  · el pasajero y el conductor ven ' + (a && a === b ? 'EXACTAMENTE lo mismo' : 'algo DISTINTO'));
  console.log('  · «' + TEXTO + '» dibujada en el código de las tres apps: ' + m.dibujadas.length + (m.dibujadas.length ? ' (' + m.dibujadas.join(', ') + ')' : ''));
}

if (require.main === module) {
  const commit = argumento('--commit');
  const m = medir(commit);
  informe(m, commit ? 'commit ' + commit : 'el disco');
  if (process.argv.includes('--html')) for (const p of m.pantallas) for (const v of p.ventanitas) console.log('\n' + p.nombre + ':\n' + v.html);
}

module.exports = { medir, huella, lector, TEXTO };
