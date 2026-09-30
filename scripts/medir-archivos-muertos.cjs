/**
 * ¿QUIÉN USA LOS ARCHIVOS DE PLANTILLA? (gemelo G103, 30-sep-2026) — SOLO LECTURA
 *
 * Create React App deja en cada app un `src/App.css` y un `src/logo.svg` (el átomo de React), y `firebase init`
 * deja un `index.html` de bienvenida («Welcome to Firebase Hosting»). En GuajiraGo había SIETE de esos,
 * idénticos entre las tres apps: App.css ×3, logo.svg ×3 y guajirago/index.html. Este guion dice, para cada
 * uno, si existe y QUIÉN lo usa:
 *
 *  · un uso es cualquier archivo de código o de configuración de las tres apps, de las pruebas, del robot, de los
 *    guiones o de la raíz (js, cjs, mjs, jsx, ts, json, html, css, yml, yaml, sh, svg) que nombre el archivo:
 *    un `import './App.css'`, un `require`, un `url(logo.svg)`, un `href`, un `src`…;
 *  · y además, si algún firebase.json lo PUBLICARÍA: se mira la carpeta `hosting.public` de cada firebase.json
 *    y se pregunta si el archivo cae dentro. (Así se comprueba que guajirago/index.html NO es el «resto de
 *    junio»: ése vive en el build/ de la raíz.)
 *
 * No cuentan como uso las NOTAS (*.md), los papeles del guardián, las cachés de `.firebase/`, `node_modules/`,
 * los `build/`, ni la copia vieja anidada `guajirago/guajirago/` (el repo v2.1 de julio, que no compila nadie).
 *
 * `guajirago/src/theme.js` también estaba en la fila de G103, pero desde G90 es LA paleta: aquí se cuenta quién
 * lo importa, para que nadie lo tome por muerto.
 *
 * Uso: node scripts/medir-archivos-muertos.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

/** Los siete de la fila de G103, y cómo se nombran en el código de quien los usara. */
const CANDIDATOS = [
  { ruta: 'guajirago/src/App.css', nombre: /(^|[^\w.-])App\.css\b/ },
  { ruta: 'guajirago-admin/src/App.css', nombre: /(^|[^\w.-])App\.css\b/ },
  { ruta: 'guajirago-aliados/src/App.css', nombre: /(^|[^\w.-])App\.css\b/ },
  { ruta: 'guajirago/src/logo.svg', nombre: /(^|[^\w.-])logo\.svg\b/ },
  { ruta: 'guajirago-admin/src/logo.svg', nombre: /(^|[^\w.-])logo\.svg\b/ },
  { ruta: 'guajirago-aliados/src/logo.svg', nombre: /(^|[^\w.-])logo\.svg\b/ },
  { ruta: 'guajirago/index.html', nombre: /guajirago\/index\.html\b/ },
];

/** El que NO está muerto: lo importan las pantallas. */
const VIVO = { ruta: 'guajirago/src/theme.js', nombre: /from\s+['"]\.\/theme(\.js)?['"]|require\(\s*['"]\.\/theme(\.js)?['"]\s*\)/ };

const EXTENSIONES = /\.(js|cjs|mjs|jsx|ts|tsx|json|html|css|yml|yaml|sh|svg)$/i;
const CARPETAS_FUERA = new Set(['node_modules', 'build', '.git', '.firebase']);
const RUTAS_FUERA = ['guajirago/guajirago/', '.guardian-', 'scripts/medir-archivos-muertos.cjs', 'pruebas/archivosMuertos.test.js'];

/** Todas las rutas (relativas a la raíz, con /) de archivos de texto que pueden usar a otro. */
function rutasDelDisco(dir = RAIZ, rel = '') {
  const salida = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (CARPETAS_FUERA.has(e.name)) continue;
      if (RUTAS_FUERA.some((f) => (r + '/').startsWith(f))) continue;
      salida.push(...rutasDelDisco(path.join(dir, e.name), r));
    } else if (e.isFile()) {
      salida.push(r);
    }
  }
  return salida;
}

/** Quita la marca invisible (BOM) del principio: JSON.parse no la aguanta (trampa del 23-sep-2026). */
function sinBom(t) {
  return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t;
}

/**
 * La medida, sobre un árbol cualquiera: `rutas` (lista de rutas relativas) y `leer(ruta)` → texto.
 * Devuelve, por candidato: si existe, sus usos (archivo:renglón) y qué firebase.json lo publicaría.
 */
function medir({ rutas, leer }) {
  const existe = new Set(rutas);
  const textos = rutas.filter((r) => EXTENSIONES.test(r) && !RUTAS_FUERA.some((f) => r.startsWith(f)));

  // Las carpetas que publica cada firebase.json (hosting.public, relativa a la carpeta del firebase.json).
  const publicas = [];
  for (const r of rutas.filter((x) => x === 'firebase.json' || x.endsWith('/firebase.json'))) {
    let conf;
    try { conf = JSON.parse(sinBom(leer(r))); } catch (e) { publicas.push({ desde: r, error: e.message }); continue; }
    const base = r.includes('/') ? r.slice(0, r.lastIndexOf('/')) : '';
    const hosting = Array.isArray(conf.hosting) ? conf.hosting : conf.hosting ? [conf.hosting] : [];
    for (const h of hosting) {
      if (typeof h.public !== 'string') continue;
      const carpeta = path.posix.normalize(base ? base + '/' + h.public : h.public).replace(/^\.\/?$/, '');
      publicas.push({ desde: r, carpeta });
    }
  }

  const buscar = (c) => {
    const usos = [];
    for (const r of textos) {
      if (r === c.ruta) continue;
      const lineas = String(leer(r)).split('\n');
      lineas.forEach((l, i) => { if (c.nombre.test(l)) usos.push(r + ':' + (i + 1)); });
    }
    return usos;
  };

  const candidatos = CANDIDATOS.map((c) => {
    const lasPublica = publicas
      .filter((p) => p.carpeta !== undefined && (p.carpeta === '' || c.ruta.startsWith(p.carpeta + '/')))
      .map((p) => p.desde);
    return { ruta: c.ruta, existe: existe.has(c.ruta), usos: buscar(c), lasPublica };
  });
  // Solo cuentan las pantallas de la app (un guion o una prueba que lo nombre no lo mantiene vivo).
  const vivo = { ruta: VIVO.ruta, existe: existe.has(VIVO.ruta),
    importan: [...new Set(buscar(VIVO).map((u) => u.replace(/:\d+$/, '')))].filter((r) => r.startsWith('guajirago/src/')) };

  const fallas = [];
  for (const c of candidatos) {
    if (c.usos.length) fallas.push(c.ruta + ' lo usa: ' + c.usos.join(', '));
    if (c.lasPublica.length) fallas.push(c.ruta + ' lo publicaría: ' + c.lasPublica.join(', '));
  }
  for (const p of publicas) if (p.error) fallas.push(p.desde + ' no se pudo leer: ' + p.error);
  const sobran = candidatos.filter((c) => c.existe && !c.usos.length && !c.lasPublica.length).map((c) => c.ruta);
  return { candidatos, vivo, publicas, sobran, fallas };
}

/** La medida sobre el disco de hoy. */
function medirDisco() {
  return medir({ rutas: rutasDelDisco(), leer: (r) => fs.readFileSync(path.join(RAIZ, r), 'utf8') });
}

if (require.main === module) {
  const r = medirDisco();
  console.log('Archivos de plantilla de la fila G103 (¿existen? ¿quién los usa? ¿quién los publicaría?):\n');
  for (const c of r.candidatos) {
    console.log('  ' + (c.existe ? 'EXISTE  ' : 'no está ') + c.ruta
      + ' · usos: ' + c.usos.length + (c.usos.length ? ' (' + c.usos.join(', ') + ')' : '')
      + ' · lo publica: ' + (c.lasPublica.length ? c.lasPublica.join(', ') : 'nadie'));
  }
  console.log('\nCarpetas que publica cada firebase.json:');
  for (const p of r.publicas) console.log('  ' + p.desde + ' → ' + (p.error ? 'ERROR ' + p.error : (p.carpeta || '(la raíz)') + '/'));
  console.log('\n' + r.vivo.ruta + ' (NO es muerto, es la paleta): ' + (r.vivo.existe ? 'existe' : '🔴 NO EXISTE')
    + ', lo importan ' + r.vivo.importan.length + ' archivos');
  console.log('\nMuertos que siguen en el disco: ' + r.sobran.length + (r.sobran.length ? ' (' + r.sobran.join(', ') + ')' : ''));
  console.log(r.fallas.length ? '\n🔴 ' + r.fallas.length + ' uso(s):\n  · ' + r.fallas.join('\n  · ')
    : '\n✓ ninguno de los siete lo usa ni lo publica nadie');
}

module.exports = { CANDIDATOS, VIVO, medir, medirDisco, rutasDelDisco };
