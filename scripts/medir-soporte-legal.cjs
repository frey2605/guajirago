#!/usr/bin/env node
/**
 * 📧 EL CORREO DE SOPORTE Y LAS PÁGINAS LEGALES: ¿CUÁNTAS VECES ESTÁN ESCRITOS Y QUÉ SE VE? — gemelo G75
 * (29-sep-2026), SOLO LECTURA.
 *
 * El correo de soporte tenía su constante (`CORREO_SOPORTE`, en AyudaSoporte.js) y aun así estaba escrito a mano en
 * cuatro textos: una respuesta de la Ayuda, dos secciones de la Política de privacidad y una de los Términos. Y los
 * Términos y la Política eran el mismo archivo con otro texto: cada uno dibujaba a mano su cabecera, su marco y el
 * estilo de cada sección. No toca datos: es solo código.
 *
 *   node scripts/medir-soporte-legal.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-soporte-legal.cjs --commit <hash>  <- otro commit de la raíz (careo)
 *   node scripts/medir-soporte-legal.cjs --html           <- además, el texto que se lee en cada página
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. Las TRES pantallas (Términos, Política y Ayuda) se COMPILAN con Babel (el mismo con que compila la app), con
 *     sus piezas de verdad (lo que importen de guajirago/src; solo la conexión a Firebase va de mentira) y se PINTAN
 *     con React (renderToStaticMarkup): la huella de su HTML y la del texto que se lee. Con el arreglo NO puede
 *     cambiar ni una letra del texto legal, ni un estilo.
 *  2. Las preguntas de la Ayuda (`preguntasCon`, que se pintan al abrirlas): se CORREN y se saca su huella.
 *  3. En las TRES apps: dónde está escrito el correo de soporte en el código (textos, no comentarios), separando la
 *     constante que lo guarda de las veces que se escribe a mano.
 *  4. Cuántas páginas llevan dibujado a mano el estilo de sus secciones (`seccion = (titulo, texto) =>`).
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ } = require('../pruebas/cargar.cjs');

const NM = path.join(RAIZ, 'guajirago', 'node_modules');
const pedir = (n) => {
  try { return require(path.join(NM, n)); } catch (e) {
    throw new Error('hace falta ' + n + ' en guajirago/node_modules (npm ci dentro de guajirago): ' + e.message);
  }
};
const babel = pedir('@babel/core');
const presetReact = pedir('@babel/preset-react');
const aCommonJS = pedir('@babel/plugin-transform-modules-commonjs');
const React = pedir('react');
const servidor = pedir('react-dom/server');

const CORREO = 'soporte@guajirago.com.co';
const CONSTANTE = 'CORREO_SOPORTE';
const PANTALLAS = [
  { archivo: 'guajirago/src/TerminosCondiciones.js', nombre: 'Términos y condiciones' },
  { archivo: 'guajirago/src/PoliticaPrivacidad.js', nombre: 'Política de privacidad' },
  { archivo: 'guajirago/src/AyudaSoporte.js', nombre: 'Ayuda y soporte' },
];
const AYUDA = 'guajirago/src/AyudaSoporte.js';
const CARPETAS = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
// Lo único de mentira: la conexión a Firebase (la Ayuda lee config/global al montarse; pintar no corre efectos).
const DE_MENTIRA = {
  './firebase': { db: {} },
  'firebase/firestore': { doc: () => ({}), getDoc: () => new Promise(() => {}) },
};

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

/**
 * Carga un archivo de guajirago/src como lo haría la app: lo compila (JSX e imports) y lo corre, con sus piezas de
 * verdad (leídas con el mismo lector: del disco o del commit). Además de lo que exporta, devuelve `__preguntasCon`
 * si el archivo lo declara (la Ayuda no lo exporta: se asoma para correrlo).
 */
function cargador(leer) {
  const cache = {};
  function cargar(ruta) {
    if (cache[ruta]) return cache[ruta].exports;
    const texto = leer(ruta);
    if (texto == null) throw new Error('no está ' + ruta);
    const js = babel.transformSync(texto, {
      presets: [[presetReact, { runtime: 'classic' }]], plugins: [aCommonJS], babelrc: false, configFile: false, sourceType: 'module',
    }).code + '\n;if (typeof preguntasCon !== "undefined") exports.__preguntasCon = preguntasCon;';
    const modulo = { exports: {} };
    cache[ruta] = modulo;
    const req = (n) => {
      if (n === 'react') return React;
      if (Object.prototype.hasOwnProperty.call(DE_MENTIRA, n)) return DE_MENTIRA[n];
      if (n.startsWith('./')) return cargar(path.posix.join(path.posix.dirname(ruta), n.endsWith('.js') ? n : n + '.js'));
      throw new Error(ruta + ' pide ' + n + ', que el medidor no sabe cargar');
    };
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', js)(req, modulo, modulo.exports);
    return modulo.exports;
  }
  return cargar;
}

/** El texto que se lee en un HTML: sin etiquetas y con los caracteres de verdad. */
function textoLeido(html) {
  return html.replace(/<[^>]+>/g, '\n').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').split('\n').map((s) => s.trim()).filter(Boolean).join('\n');
}

/** ¿Dónde está escrito el correo en un archivo? (textos del código, nunca comentarios.) Separa la constante del resto. */
function dondeEstaElCorreo(texto) {
  const constantes = []; const aMano = [];
  let ast;
  try { ast = analizar(texto); } catch (e) { return { constantes, aMano: texto.includes(CORREO) ? ['(Babel no lo lee)'] : [] }; }
  babel.traverse(ast, {
    'StringLiteral|JSXText|TemplateElement'(p) {
      const v = p.node.type === 'TemplateElement' ? p.node.value.raw : p.node.value;
      if (!v.includes(CORREO)) return;
      const renglon = p.node.loc.start.line;
      const d = p.parentPath && p.parentPath.node;
      if (d && d.type === 'VariableDeclarator' && d.id.type === 'Identifier' && d.id.name === CONSTANTE) constantes.push(renglon);
      else aMano.push(renglon);
    },
  });
  return { constantes, aMano };
}

function medir(commit, cambios = {}) {
  const leer = lector(commit, cambios);
  const cargar = cargador(leer);
  const pantallas = PANTALLAS.map((p) => {
    const m = cargar(p.archivo);
    const Comp = m.default;
    if (typeof Comp !== 'function') throw new Error(p.archivo + ': no exporta la pantalla por defecto');
    const html = servidor.renderToStaticMarkup(React.createElement(Comp, { onVolver: () => {} }));
    const texto = textoLeido(html);
    return { ...p, html, texto, huellaHtml: huella(html), huellaTexto: huella(texto), dicenElCorreo: texto.split(CORREO).length - 1 };
  });

  // Las preguntas de la Ayuda (se pintan al abrirlas): se corren con dos topes de favoritos distintos.
  const armar = cargar(AYUDA).__preguntasCon;
  if (typeof armar !== 'function') throw new Error(AYUDA + ': no encuentro preguntasCon(...)');
  const preguntas = [armar(2), armar(3)];
  const huellaPreguntas = huella(JSON.stringify(preguntas));
  const preguntasConCorreo = preguntas[0].filter((q) => q.respuesta.includes(CORREO) || q.pregunta.includes(CORREO)).length;

  // En las tres apps: la constante y las veces que el correo está escrito a mano.
  const constantes = []; const aMano = []; const seccionesAMano = [];
  for (const carpeta of CARPETAS) {
    for (const r of [...new Set([...listar(carpeta, commit), ...Object.keys(cambios).filter((k) => k.startsWith(carpeta + '/'))])]) {
      const t = leer(r);
      if (t == null) continue;
      const corto = r.replace('guajirago/src/', '');
      if (t.includes(CORREO)) {
        const d = dondeEstaElCorreo(t);
        for (const n of d.constantes) constantes.push(corto + ':' + n);
        for (const n of d.aMano) aMano.push(corto + ':' + n);
      }
      if (/\bseccion\s*=\s*\(\s*titulo\s*,\s*texto\s*\)\s*=>/.test(t) || /function\s+seccion\s*\(\s*titulo\s*,\s*texto\s*\)/.test(t)) seccionesAMano.push(corto);
    }
  }
  return { pantallas, huellaPreguntas, preguntasConCorreo, constantes, aMano, seccionesAMano };
}

function imprimir(m, etiqueta) {
  console.log('\n📧 EL CORREO DE SOPORTE Y LAS PÁGINAS LEGALES — ' + etiqueta);
  for (const p of m.pantallas) {
    console.log('  · ' + p.nombre + ': HTML ' + p.huellaHtml + ' · texto ' + p.huellaTexto + ' · dice el correo ×' + p.dicenElCorreo);
  }
  console.log('  · preguntas de la Ayuda: huella ' + m.huellaPreguntas + ' · con el correo ×' + m.preguntasConCorreo);
  console.log('  · constante con el correo (tres apps): ' + (m.constantes.join(', ') || '0'));
  console.log('  · correo escrito a mano (tres apps): ' + m.aMano.length + (m.aMano.length ? ' → ' + m.aMano.join(', ') : ''));
  console.log('  · páginas con el estilo de sus secciones dibujado a mano: ' + m.seccionesAMano.length + (m.seccionesAMano.length ? ' → ' + m.seccionesAMano.join(', ') : ''));
  if (process.argv.includes('--html')) for (const p of m.pantallas) console.log('\n--- ' + p.nombre + ' ---\n' + p.texto);
}

if (require.main === module) {
  const commit = argumento('--commit');
  imprimir(medir(commit), commit ? 'commit ' + commit : 'el disco (hoy)');
}

module.exports = { medir, CORREO, PANTALLAS };
