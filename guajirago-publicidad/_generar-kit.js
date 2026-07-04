// Generador del kit publicitario GuajiraGo.
// Produce todas las variantes del logo (SVG) + formatos para redes + catalogo HTML.
// Basado en los SVG maestros oficiales y la guia de marca.
const fs = require('fs');
const path = require('path');

const OUT = __dirname;

// ---- Colores oficiales (de la guia de marca) ----
const AMARILLO = '#FFCF4D';
const NARANJA  = '#FF7A2F';
const MAGENTA  = '#D6357E';
const NEGRO     = '#141416';
const BLANCO    = '#FFFFFF';

// ---- Geometria del simbolo (del SVG maestro, espacio 100x100) ----
const OUTER = 'M 52 88 C 30 88, 14 74, 14 55 C 14 36, 28 24, 42 20 C 50 17, 58 16, 62 10 C 64 6, 63 2, 63 2 C 72 10, 76 22, 72 34 C 70 40, 66 45, 62 48 L 82 48 L 82 56 C 82 73, 69 88, 52 88 Z';
const INNER = 'M 52 78 C 36 78, 26 68, 26 55 C 26 42, 35 33, 46 30 C 53 27, 60 26, 64 20 C 66 30, 62 38, 56 42 L 70 42 L 70 56 C 70 63, 62 78, 52 78 Z';
const SPARK = '<rect x="44" y="51" width="10" height="10" transform="rotate(45 49 56)" FILL/>';

// Gradiente calido de marca
function grad(id, diag) {
  return `<linearGradient id="${id}" x1="10%" y1="90%" x2="90%" y2="5%">
      <stop offset="0%" stop-color="${AMARILLO}"/>
      <stop offset="40%" stop-color="${NARANJA}"/>
      <stop offset="100%" stop-color="${MAGENTA}"/>
    </linearGradient>`;
}

// Simbolo con fondo transparente (hueco real via fill-rule evenodd)
// fill puede ser un color o url(#grad)
function simbolo(fill, transform) {
  const t = transform ? ` transform="${transform}"` : '';
  return `<g${t}>
    <path fill-rule="evenodd" fill="${fill}" d="${OUTER} ${INNER}"/>
    ${SPARK.replace('FILL', `fill="${fill}"`)}
  </g>`;
}

// Wordmark inline "Guajira" + "GO"
function wordmark(x, y, size, colGuajira, colGO, anchor) {
  const a = anchor ? ` text-anchor="${anchor}"` : '';
  const goSize = Math.round(size * 1.02);
  return `<text x="${x}" y="${y}"${a} font-family="'Arial Black','Helvetica Neue',Arial,sans-serif" font-weight="900" font-size="${size}" letter-spacing="${-size*0.03}" fill="${colGuajira}">Guajira<tspan fill="${colGO}" font-size="${goSize}">GO</tspan></text>`;
}

function tagline(x, y, size, color, anchor) {
  const a = anchor ? ` text-anchor="${anchor}"` : '';
  return `<text x="${x}" y="${y}"${a} font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${size}" letter-spacing="${size*0.35}" fill="${color}">VIVE  •  DESCUBRE  •  CONECTA</text>`;
}

function svg(w, h, defs, body, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>${defs || ''}</defs>
  ${bg || ''}
  ${body}
</svg>`;
}

function write(name, content) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf8');
  console.log('  ✔', name);
}

// Fondo oscuro premium reutilizable
function bgOscuro(w, h, r) {
  return `<rect width="${w}" height="${h}" rx="${r||0}" fill="url(#dark)"/>`;
}
const DEF_DARK = `<radialGradient id="dark" cx="35%" cy="28%" r="90%">
      <stop offset="0%" stop-color="#24242A"/>
      <stop offset="100%" stop-color="${NEGRO}"/>
    </radialGradient>`;

console.log('Generando LOGOS...');

// ============ LOGOS HORIZONTALES (transparente) ============
// simbolo left + wordmark inline a la derecha. viewBox 620x180
function horizontal(fillSimbolo, colG, colGO, defs) {
  const body = `${simbolo(fillSimbolo, 'translate(24,14) scale(1.55)')}
  ${wordmark(215, 118, 74, colG, colGO)}`;
  return svg(620, 180, defs, body);
}
write('logo-horizontal-color.svg', horizontal('url(#g)', BLANCO === BLANCO ? NEGRO : NEGRO, 'url(#g)', grad('g')));
write('logo-horizontal-blanco.svg', horizontal(BLANCO, BLANCO, BLANCO));
write('logo-horizontal-negro.svg', horizontal(NEGRO, NEGRO, NEGRO));

// Version horizontal para fondo oscuro (Guajira blanco, GO gradiente, simbolo gradiente)
write('logo-horizontal-fondo-oscuro.svg', (function(){
  const body = `${simbolo('url(#g)', 'translate(24,14) scale(1.55)')}
  ${wordmark(215, 118, 74, BLANCO, 'url(#g)')}`;
  return svg(620, 180, grad('g'), body);
})());

// ============ LOGOS VERTICALES (icono arriba, texto abajo, tagline) ============
function vertical(fillSimbolo, colG, colGO, defs, tagColor) {
  const body = `${simbolo(fillSimbolo, 'translate(160,10) scale(1.7)')}
  ${wordmark(240, 300, 66, colG, colGO, 'middle')}
  ${tagline(240, 340, 15, tagColor || NARANJA, 'middle')}`;
  return svg(480, 380, defs, body);
}
write('logo-vertical-color.svg', vertical('url(#g)', NEGRO, 'url(#g)', grad('g')));
write('logo-vertical-blanco.svg', vertical(BLANCO, BLANCO, BLANCO, '', AMARILLO));
write('logo-vertical-fondo-oscuro.svg', (function(){
  const body = `${simbolo('url(#g)', 'translate(160,10) scale(1.7)')}
  ${wordmark(240, 300, 66, BLANCO, 'url(#g)', 'middle')}
  ${tagline(240, 340, 15, NARANJA, 'middle')}`;
  return svg(480, 380, grad('g'), body);
})());

// ============ SOLO ICONO (transparente) ============
function iconoSolo(fill, defs) {
  // encuadra el simbolo en 120x120
  const body = simbolo(fill, 'translate(12,8) scale(1.02)');
  return svg(120, 120, defs, body);
}
write('icono-color.svg', iconoSolo('url(#g)', grad('g')));
write('icono-blanco.svg', iconoSolo(BLANCO));
write('icono-negro.svg', iconoSolo(NEGRO));

// ============ ICONO APP (badge cuadrado redondeado) ============
// fondo gradiente + simbolo blanco  (estilo app store)
write('icono-app-badge.svg', (function(){
  const defs = grad('g');
  const bg = `<rect width="120" height="120" rx="27" fill="url(#g)"/>`;
  const body = simbolo(BLANCO, 'translate(12,8) scale(1.02)');
  return svg(120, 120, defs, bg + body);
})());
// badge oscuro + simbolo gradiente
write('icono-app-badge-oscuro.svg', (function(){
  const defs = grad('g') + DEF_DARK;
  const bg = `<rect width="120" height="120" rx="27" fill="url(#dark)"/>`;
  const body = simbolo('url(#g)', 'translate(12,8) scale(1.02)');
  return svg(120, 120, defs, bg + body);
})());

// ============ SOLO WORDMARK ============
function wordmarkFile(colG, colGO, defs) {
  return svg(420, 130, defs, wordmark(10, 95, 82, colG, colGO));
}
write('wordmark-color.svg', wordmarkFile(NEGRO, 'url(#g)', grad('g')));
write('wordmark-blanco.svg', wordmarkFile(BLANCO, 'url(#g)', grad('g')));
write('wordmark-negro.svg', wordmarkFile(NEGRO, NEGRO));

console.log('Generando FORMATOS para redes / publicidad...');

// Lockup vertical centrado reutilizable para los formatos (sobre fondo oscuro)
function lockupCentro(cx, cy, escala) {
  const s = escala;
  return `<g transform="translate(${cx},${cy}) scale(${s})">
    ${simbolo('url(#g)', 'translate(-58,-150)')}
    ${wordmark(0, 30, 66, BLANCO, 'url(#g)', 'middle')}
    ${tagline(0, 70, 15, NARANJA, 'middle')}
  </g>`;
}

// Perfil redes 1080x1080 (Instagram/FB/WhatsApp)
write('formato-perfil-1080x1080.svg', (function(){
  const defs = grad('g') + DEF_DARK;
  const bg = bgOscuro(1080,1080,0);
  const body = `${bg}
  <g transform="translate(540,470) scale(3.0)">
    ${simbolo('url(#g)','translate(-48,-70)')}
  </g>
  ${wordmark(540, 760, 150, BLANCO, 'url(#g)', 'middle')}
  ${tagline(540, 830, 30, NARANJA, 'middle')}`;
  return svg(1080,1080,defs,body);
})());

// Post cuadrado 1080x1080 (fondo gradiente calido, logo blanco)
write('formato-post-1080x1080.svg', (function(){
  const defs = grad('g');
  const bg = `<rect width="1080" height="1080" fill="url(#g)"/>`;
  const body = `${bg}
  <g transform="translate(540,430) scale(3.0)">
    ${simbolo(BLANCO,'translate(-48,-70)')}
  </g>
  ${wordmark(540, 720, 150, BLANCO, BLANCO, 'middle')}
  <text x="540" y="800" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="30" letter-spacing="10" fill="rgba(255,255,255,0.9)">VIVE  •  DESCUBRE  •  CONECTA</text>`;
  return svg(1080,1080,defs,body);
})());

// Historia / Story 1080x1920
write('formato-historia-1080x1920.svg', (function(){
  const defs = grad('g') + DEF_DARK;
  const bg = bgOscuro(1080,1920,0);
  const body = `${bg}
  <g transform="translate(540,760) scale(3.6)">
    ${simbolo('url(#g)','translate(-48,-70)')}
  </g>
  ${wordmark(540, 1120, 170, BLANCO, 'url(#g)', 'middle')}
  ${tagline(540, 1200, 34, NARANJA, 'middle')}
  <text x="540" y="1780" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="30" letter-spacing="6" fill="rgba(255,255,255,0.55)">La Guajira, en una sola app</text>`;
  return svg(1080,1920,defs,body);
})());

// Portada Facebook 820x312 (horizontal)
write('formato-portada-facebook-820x312.svg', (function(){
  const defs = grad('g') + DEF_DARK;
  const bg = bgOscuro(820,312,0);
  const body = `${bg}
  ${simbolo('url(#g)','translate(70,70) scale(1.9)')}
  ${wordmark(320, 175, 86, BLANCO, 'url(#g)')}
  ${tagline(322, 215, 17, NARANJA)}`;
  return svg(820,312,defs,body);
})());

// Banner web 1500x500
write('formato-banner-web-1500x500.svg', (function(){
  const defs = grad('g') + DEF_DARK;
  const bg = bgOscuro(1500,500,0);
  const body = `${bg}
  ${simbolo('url(#g)','translate(150,110) scale(3.1)')}
  ${wordmark(560, 275, 130, BLANCO, 'url(#g)')}
  ${tagline(565, 335, 26, NARANJA)}`;
  return svg(1500,500,defs,body);
})());

// Tarjeta de presentacion 1050x600 (frente)
write('formato-tarjeta-presentacion-1050x600.svg', (function(){
  const defs = grad('g') + DEF_DARK;
  const bg = bgOscuro(1050,600,0);
  const body = `${bg}
  <rect x="0" y="0" width="1050" height="10" fill="url(#g)"/>
  ${simbolo('url(#g)','translate(120,150) scale(2.4)')}
  ${wordmark(430, 300, 96, BLANCO, 'url(#g)')}
  ${tagline(434, 345, 18, NARANJA)}
  <text x="434" y="410" font-family="Arial,sans-serif" font-size="24" fill="rgba(255,255,255,0.6)">guajirago.web.app</text>`;
  return svg(1050,600,defs,body);
})());

// ============ Copiar el logo original subido, como referencia ============
try {
  const orig = 'C:/Users/Windows 11/.claude/uploads/29abe5d7-91f6-4166-8f8d-3fc5aa06fea8/c7e04b6e-FB7A068219DB4B10BC1A51CBF5CF8F43.png';
  fs.copyFileSync(orig, path.join(OUT, 'logo-original-subido.png'));
  console.log('  ✔ logo-original-subido.png (copiado)');
} catch (e) { console.log('  (no se pudo copiar el original:', e.message, ')'); }

// ============ CATALOGO HTML ============
console.log('Generando catalogo...');
const archivos = fs.readdirSync(OUT).filter(f => f.endsWith('.svg')).sort();
const logos = archivos.filter(f => !f.startsWith('formato-'));
const formatos = archivos.filter(f => f.startsWith('formato-'));

function tarjetaSVG(f, oscuro) {
  const cls = oscuro ? 'card dark' : 'card';
  return `<div class="${cls}">
    <div class="preview"><img src="${f}" alt="${f}"/></div>
    <div class="name">${f}</div>
  </div>`;
}

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GuajiraGo · Kit de Publicidad</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family:'Arial Black',Arial,sans-serif; background:#0F0F12; color:#fff; }
  header { padding:32px 20px; text-align:center; background:radial-gradient(90% 120% at 35% 20%,#24242A,#0F0F12); border-bottom:1px solid #2A2A2E; }
  header h1 { margin:0; font-size:26px; }
  header .go { background:linear-gradient(135deg,#FFCF4D,#FF7A2F,#D6357E); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
  header p { color:#AAA; font-family:Arial; font-weight:normal; font-size:13px; letter-spacing:2px; margin:10px 0 0; }
  .paleta { display:flex; gap:8px; justify-content:center; flex-wrap:wrap; margin:16px 0 0; }
  .sw { width:74px; border-radius:10px; overflow:hidden; font-family:Arial; font-size:10px; }
  .sw .c { height:38px; } .sw .l { padding:4px; background:#1A1A1E; color:#ccc; text-align:center; }
  h2 { font-size:15px; letter-spacing:3px; color:#FF7A2F; margin:36px 20px 4px; font-family:Arial; }
  .sub { font-family:Arial; font-weight:normal; color:#888; font-size:12px; margin:0 20px 12px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; padding:0 16px; }
  .card { background:#fff; border-radius:14px; overflow:hidden; border:1px solid #2A2A2E; }
  .card.dark { background:#141416; }
  .card .preview { padding:22px; display:flex; align-items:center; justify-content:center; min-height:150px; }
  .card .preview img { max-width:100%; max-height:180px; }
  .card .name { font-family:Arial; font-size:10px; color:#888; padding:8px 10px; border-top:1px solid #2A2A2E; word-break:break-all; background:#0F0F12; }
  .fmt .preview img { max-height:260px; }
  footer { font-family:Arial; color:#666; font-size:12px; text-align:center; padding:30px 20px 50px; line-height:1.7; }
  footer b { color:#aaa; }
</style></head>
<body>
<header>
  <h1>Guajira<span class="go">GO</span> · Kit de Publicidad</h1>
  <p>VIVE · DESCUBRE · CONECTA</p>
  <div class="paleta">
    ${[['#FFCF4D','Amarillo'],['#FF7A2F','Naranja'],['#D6357E','Magenta'],['#141416','Negro'],['#FFFFFF','Blanco']].map(([c,n])=>`<div class="sw"><div class="c" style="background:${c}"></div><div class="l">${n}<br>${c}</div></div>`).join('')}
  </div>
</header>

<h2>LOGOS · TODAS SUS FORMAS</h2>
<p class="sub">Fondo blanco = versiones color/negro · Fondo oscuro = versiones para fondos oscuros y blancas · SVG = calidad infinita, editable en Canva / Illustrator</p>
<div class="grid">
  ${logos.map(f => tarjetaSVG(f, /oscuro|blanco|badge(?!-oscuro)/.test(f))).join('\n  ')}
</div>

<h2>FORMATOS PARA REDES Y PUBLICIDAD</h2>
<p class="sub">Listos para Instagram, Facebook, WhatsApp, banners y tarjetas. Ábrelos en Canva o el navegador y expórtalos como imagen.</p>
<div class="grid">
  ${formatos.map(f => `<div class="card dark fmt"><div class="preview"><img src="${f}"/></div><div class="name">${f}</div></div>`).join('\n  ')}
</div>

<h2>TU LOGO ORIGINAL</h2>
<p class="sub">El que enviaste, como referencia.</p>
<div class="grid"><div class="card"><div class="preview"><img src="logo-original-subido.png"/></div><div class="name">logo-original-subido.png</div></div></div>

<footer>
  <b>${archivos.length} archivos SVG</b> generados · colores oficiales de la guía de marca.<br>
  Para exportar a PNG/JPG: abre el SVG en <b>Canva</b> (arrastrar y soltar) o en el navegador y captura, o en <b>Illustrator/Inkscape/Figma</b> → Exportar.<br>
  Reglas: no deformes el símbolo · no cambies el gradiente · deja aire alrededor del logo.
</footer>
</body></html>`;

fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log('  ✔ index.html');
console.log('\nListo. Carpeta:', OUT);
