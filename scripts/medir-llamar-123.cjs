#!/usr/bin/env node
/**
 * 🚨 «LLAMAR AL 123»: ¿CUÁNTAS VECES ESTÁ DIBUJADO Y QUÉ HACE AL TOCARLO? — gemelo G70 (29-sep-2026), SOLO LECTURA.
 *
 * La tarjeta roja «Llamar al 123» sale en dos pantallas de la app del pasajero: Ajustes › Seguridad (Seguridad.js) y la
 * ventanita del 🚨 en medio del viaje (el `PanelEmergencia` de Solicitar.js). Cada una la dibujaba a mano y cada una
 * tenía su propio `window.location.href = 'tel:123'`. No toca datos: es solo código.
 *
 *   node scripts/medir-llamar-123.cjs                  <- el código de hoy (el disco)
 *   node scripts/medir-llamar-123.cjs --commit <hash>  <- otro commit de la raíz (careo)
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *  1. En cada pantalla, la tarjeta que dice «Llamar al 123» se SACA del archivo (con el analizador de Babel, el mismo
 *     con que compila la app), se compila y se PINTA con React (renderToStaticMarkup): su huella y su HTML.
 *  2. Se TOCA: se busca el `onClick` de la tarjeta ya pintada y se corre con un `window` de mentira. Se apunta a dónde
 *     manda (`tel:123`). Lo que hace el botón al tocarse NO puede cambiar con el arreglo.
 *  3. El RESTO de cada pantalla (el archivo sin la tarjeta, sin su función de llamar y sin el import de la pieza):
 *     su huella. Con el arreglo tiene que quedar igual: si cambia, se movió algo que no era de este gemelo.
 *  4. En toda guajirago/src: cuántas tarjetas rojas de «Llamar al 123» están dibujadas, cuántos `tel:123` hay escritos
 *     a mano, y cuántos textos de ayuda mencionan la línea 123 (esos se cuentan, no se tocan).
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
  { archivo: 'guajirago/src/Seguridad.js', nombre: 'Ajustes › Seguridad' },
  { archivo: 'guajirago/src/Solicitar.js', nombre: 'el 🚨 en medio del viaje (Solicitar)' },
];
const TEXTO = 'Llamar al 123';

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

function listarSrc(commit) {
  if (!commit) return fs.readdirSync(path.join(RAIZ, 'guajirago', 'src')).filter((f) => f.endsWith('.js')).map((f) => 'guajirago/src/' + f);
  return execFileSync('git', ['ls-tree', '--name-only', commit, 'guajirago/src/'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => f.endsWith('.js'));
}

const huella = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
const analizar = (texto) => babel.parseSync(texto, {
  presets: [[presetReact, { runtime: 'classic' }]], babelrc: false, configFile: false, sourceType: 'module',
});
const compilar = (fuente) => babel.transformSync(fuente, {
  presets: [[presetReact, { runtime: 'classic' }]], babelrc: false, configFile: false, sourceType: 'script',
}).code;

/** ¿Este elemento JSX (o algo dentro) dice «Llamar al 123»? Se mira el texto tal cual y los textos entre llaves. */
function diceElTexto(texto, nodo) {
  return texto.slice(nodo.start, nodo.end).includes(TEXTO);
}
const tieneOnClick = (n) => n.openingElement.attributes.some((a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'onClick');
const nombreDe = (n) => (n.openingElement.name.name || '');

/**
 * Las tarjetas de un archivo: cada elemento JSX que es la pieza (`<TarjetaLlamar123 …/>`), o el elemento CON onClick
 * más interno que contiene el texto «Llamar al 123» dibujado a mano.
 */
function tarjetasDe(texto) {
  const ast = analizar(texto);
  const tarjetas = [];
  babel.traverse(ast, {
    JSXElement(p) {
      const n = p.node;
      if (nombreDe(n) === 'TarjetaLlamar123') { tarjetas.push({ n, pieza: true }); return; }
      if (!tieneOnClick(n) || !diceElTexto(texto, n)) return;
      // el más interno: si dentro hay otro con onClick que también lo dice, ése es la tarjeta, no éste.
      let hayOtro = false;
      p.traverse({ JSXElement(q) { if (tieneOnClick(q.node) && diceElTexto(texto, q.node)) hayOtro = true; } });
      if (!hayOtro) tarjetas.push({ n, pieza: false });
    },
  });
  return { ast, tarjetas };
}

/** Lo que el archivo declara con `const <nombre> = …` (su fuente), o null. */
function declaracion(ast, texto, nombre) {
  let hallada = null;
  babel.traverse(ast, {
    VariableDeclaration(p) {
      const d = p.node.declarations[0];
      if (d && d.id && d.id.name === nombre) hallada = { fuente: texto.slice(d.init.start, d.init.end), start: p.node.start, end: p.node.end };
    },
  });
  return hallada;
}

/** La pieza común (si el commit la tiene): se compila y se carga con un `window` que se le pasa. */
function cargarPieza(leer, win) {
  const t = leer('guajirago/src/LlamarAl123.js');
  if (t == null) return null;
  const sinImport = t.replace(/^import\s+React\s+from\s+'react';?[ \t]*\r?$/m, '');
  const nombres = [...sinImport.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
  const js = compilar(sinImport.replace(/^export\s+(default\s+)?/gm, ''));
  // eslint-disable-next-line no-new-func
  return new Function('React', 'window', js + '\nreturn { ' + nombres.join(', ') + ' };')(React, win);
}

/** Expande los componentes hasta llegar a la primera etiqueta de verdad (un div), para buscar su onClick. */
function primeraEtiqueta(el) {
  let e = el;
  for (let i = 0; i < 10 && e && typeof e.type === 'function'; i += 1) e = e.type(e.props);
  return e;
}

/** Pinta la tarjeta y la toca. */
function pintarYTocar(texto, tarjeta, ast, leer) {
  const win = { location: { href: '(sin tocar)' }, open: () => null };
  const pieza = cargarPieza(leer, win) || {};
  const llamar = declaracion(ast, texto, 'llamarEmergencia');
  const alcance = { React, window: win, TarjetaLlamar123: pieza.TarjetaLlamar123 };
  const nombres = Object.keys(alcance);
  const cuerpo = (llamar ? 'const llamarEmergencia = ' + compilar('(' + llamar.fuente + ')').replace(/;\s*$/, '') + ';\n' : '')
    + 'return ' + compilar('(' + texto.slice(tarjeta.n.start, tarjeta.n.end) + ')').replace(/;\s*$/, '') + ';';
  // eslint-disable-next-line no-new-func
  const elemento = new Function(...nombres, cuerpo)(...nombres.map((k) => alcance[k]));
  const html = servidor.renderToStaticMarkup(elemento);
  const raiz = primeraEtiqueta(elemento);
  const onClick = raiz && raiz.props && raiz.props.onClick;
  let paraOnde = '(no tiene onClick)';
  if (typeof onClick === 'function') { onClick({ stopPropagation() {}, preventDefault() {} }); paraOnde = win.location.href; }
  return { html, paraOnde };
}

/** El archivo sin la tarjeta, sin `const llamarEmergencia` y sin el import de la pieza, con el espacio aplastado. */
function elResto(texto, ast, tarjetas) {
  const cortes = tarjetas.map((t) => [t.n.start, t.n.end]);
  const llamar = declaracion(ast, texto, 'llamarEmergencia');
  if (llamar) cortes.push([llamar.start, llamar.end]);
  cortes.sort((a, b) => b[0] - a[0]);
  let t = texto;
  for (const [a, b] of cortes) t = t.slice(0, a) + '«TARJETA»' + t.slice(b);
  t = t.replace(/«TARJETA»/g, '').replace(/^import\s*\{[^}]*\}\s*from\s*'\.\/LlamarAl123';?[ \t]*\r?$/m, '')
    .replace(/^import\s+TarjetaLlamar123[^;\n]*;?[ \t]*\r?$/m, '');
  // los comentarios que acompañan al cambio no cuentan como «resto»: se quitan los de renglón entero.
  return t.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '').replace(/\s+/g, ' ').trim();
}

function medir(commit, cambios = {}) {
  const leer = lector(commit, cambios);
  const pantallas = PANTALLAS.map((p) => {
    const texto = leer(p.archivo);
    if (texto == null) throw new Error('no está ' + p.archivo + (commit ? ' en ' + commit : ''));
    const { ast, tarjetas } = tarjetasDe(texto);
    const pintadas = tarjetas.map((t) => ({ pieza: t.pieza, ...pintarYTocar(texto, t, ast, leer) }));
    return { ...p, tarjetas: pintadas, resto: huella(elResto(texto, ast, tarjetas)) };
  });

  // En toda la app: tarjetas dibujadas a mano, `tel:123` escritos, y textos de ayuda que nombran la línea 123.
  let dibujadas = 0; const telAMano = []; const sitiosQueLlaman = []; const textosDeAyuda = [];
  for (const r of [...new Set([...listarSrc(commit), ...Object.keys(cambios)])]) {
    const t = leer(r);
    if (t == null) continue;
    if (t.includes(TEXTO) || /Llamar al \$\{/.test(t)) {
      try {
        const ast = analizar(t);
        babel.traverse(ast, {
          JSXElement(p) {
            const s = t.slice(p.node.start, p.node.end);
            const dibuja = /#FF4444,\s*#CC0000/.test(s) && (s.includes(TEXTO) || /Llamar al \$\{/.test(s));
            if (!dibuja) return;
            let hayOtro = false;
            p.traverse({ JSXElement(q) { const u = t.slice(q.node.start, q.node.end); if (/#FF4444,\s*#CC0000/.test(u) && (u.includes(TEXTO) || /Llamar al \$\{/.test(u))) hayOtro = true; } });
            if (!hayOtro) dibujadas += 1;
          },
        });
      } catch (e) { /* un archivo que Babel no lee no es una tarjeta */ }
    }
    // sin comentarios: una nota que cuenta la historia no es un sitio que llame.
    const codigo = soloCodigo(t.replace(/\r\n/g, '\n'));
    const tel = (codigo.match(/tel:123/g) || []).length;
    if (tel) telAMano.push(r.replace('guajirago/src/', '') + ' ×' + tel);
    const enlaces = (codigo.match(/tel:(?:123|\$\{NUMERO_EMERGENCIA\})/g) || []).length;
    if (enlaces) sitiosQueLlaman.push(r.replace('guajirago/src/', '') + ' ×' + enlaces);
    const renglones = codigo.split('\n').filter((l) => /\b123\b/.test(l) && /emergencia/i.test(l) && !/tel:123|Llamar al|NUMERO_EMERGENCIA/.test(l));
    if (renglones.length) textosDeAyuda.push(r.replace('guajirago/src/', '') + ' ×' + renglones.length);
  }
  return { pantallas, dibujadas, telAMano, sitiosQueLlaman, textosDeAyuda };
}

function informe(m, etiqueta) {
  console.log('\n🚨 «Llamar al 123» · ' + etiqueta);
  for (const p of m.pantallas) {
    console.log('  · ' + p.nombre + ' (' + p.archivo.replace('guajirago/src/', '') + '): ' + p.tarjetas.length + ' tarjeta(s) · resto de la pantalla ' + p.resto);
    for (const t of p.tarjetas) {
      console.log('      ' + (t.pieza ? 'de la pieza común' : 'dibujada a mano') + ' · huella ' + huella(t.html) + ' · al tocarla va a ' + t.paraOnde);
    }
  }
  console.log('  · tarjetas rojas de «Llamar al 123» dibujadas en guajirago/src: ' + m.dibujadas);
  console.log('  · «tel:123» escritos a mano: ' + (m.telAMano.length ? m.telAMano.join(', ') : '0'));
  console.log('  · sitios que arman el enlace para llamar al 123: ' + (m.sitiosQueLlaman.length ? m.sitiosQueLlaman.join(', ') : '0'));
  console.log('  · textos de ayuda que nombran la línea 123 (se cuentan, no se tocan): ' + (m.textosDeAyuda.join(', ') || '0'));
}

if (require.main === module) {
  const commit = argumento('--commit');
  const m = medir(commit);
  informe(m, commit ? 'commit ' + commit : 'el disco');
  if (process.argv.includes('--html')) for (const p of m.pantallas) for (const t of p.tarjetas) console.log('\n' + p.nombre + ':\n' + t.html);
}

module.exports = { medir, tarjetasDe, pintarYTocar, elResto, cargarPieza, lector, huella, TEXTO };
