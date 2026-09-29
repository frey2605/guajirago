#!/usr/bin/env node
/**
 * ¿A QUÉ NÚMERO ABRE WHATSAPP CADA BOTÓN? — gemelo G41 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-numero-whatsapp.cjs              (el código del disco)
 *   node scripts/medir-numero-whatsapp.cjs --commit HEAD (el código de ese commit, en los TRES repos: el careo)
 *   node scripts/medir-numero-whatsapp.cjs --sin-datos   (solo el código, sin leer la base)
 *
 * El número de WhatsApp (wa.me/57…) se armaba en 8 sitios, en dos familias que no dan lo mismo:
 *   · «pegar 57 si no empieza por 57» (panel: Restaurantes y Turismo) → «5712345678» abría wa.me/5712345678;
 *   · «57 + las 10 últimas cifras» (app: Turismo · aliados: pedidos y reservas) → «300 123 45» abría wa.me/5730012345;
 *   · y Codigos.js del panel le pegaba 57 a TODO → «+57 300…» abría wa.me/57573….
 *
 * 1. EL CÓDIGO: saca cada botón de su archivo (tal como está, o como estaba en el commit) y lo CORRE con los
 *    mismos teléfonos de mentira. Así se ve, lado a lado, a qué número abre cada uno.
 * 2. LOS DATOS: los teléfonos guardados en producción que esos botones usan (negocios, su cuarto privado,
 *    reservas de turismo y pedidos), y cuántos abrían un número distinto del bueno.
 *
 * No imprime números enteros. No escribe nada.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit') ? args[args.indexOf('--commit') + 1] : null;

// El texto de un archivo: el del disco o el de un commit (cada archivo en SU repo).
function fuente(ruta) {
  if (!COMMIT) {
    const p = path.join(RAIZ, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  const repo = ruta.split('/')[0];
  const [cwd, dentro] = ['guajirago-admin', 'guajirago-aliados'].includes(repo)
    ? [path.join(RAIZ, repo), ruta.slice(repo.length + 1)] : [RAIZ, ruta];
  try { return execFileSync('git', ['show', COMMIT + ':' + dentro], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
}

// La pieza de cada repo (si en ese código existe), EJECUTADA tal cual.
function pieza(repo) {
  const ruta = repo + '/src/telefonoValido.js';
  const f = fuente(ruta);
  return f ? cargarDeLaApp(ruta, f) : {};
}

// Desde «desde», el trozo entre la llave que abre y la que la cierra (salta textos y plantillas por encima).
function hastaCerrar(texto, desde) {
  const abre = texto.indexOf('{', desde);
  let n = 0;
  for (let i = abre; i < texto.length; i++) {
    const c = texto[i];
    if (c === '{') n++;
    else if (c === '}') { n--; if (n === 0) return texto.slice(abre + 1, i); }
  }
  return null;
}
const correr = (cuerpo, ambito) => new Function('ambito', 'with (ambito) {' + cuerpo + '\n}')(ambito); // eslint-disable-line no-new-func

// Lo que abre un botón que llama a window.open, o su aviso si no abre nada.
function porVentana(archivo, nombre, llamar) {
  return (texto, piezas) => (tel) => {
    const i = texto.indexOf('const ' + nombre + ' = ');
    if (i < 0) return '¿?';
    const cuerpo = hastaCerrar(texto, texto.indexOf('=>', i));
    const r = {};
    correr(cuerpo, {
      ...piezas, ...llamar(tel),
      cop: (v) => '$' + v, encodeURIComponent,
      window: { open: (u) => { r.url = u; return {}; } },
      setAviso: (a) => { r.aviso = a; },
    });
    return r.url || (r.aviso ? '(no abre: avisa)' : '(no hace nada)');
  };
}

// Lo que pinta un enlace <a href={…}> de la pantalla (con su condición, si la lleva en el mismo renglón).
function porEnlace(ambitoDe) {
  return (texto, piezas) => (tel) => {
    // El enlace de antes llevaba «wa.me» escrito; el de ahora pide el enlace a la pieza.
    const i = texto.indexOf('wa.me') >= 0 ? texto.indexOf('wa.me') : texto.indexOf('href={enlaceWhatsApp(');
    if (i < 0) return '¿?';
    const h = texto.lastIndexOf('href={', i + 6);
    const expr = hastaCerrar(texto, h);
    const renglon = texto.slice(texto.lastIndexOf('\n', h) + 1, h);
    const cond = (renglon.match(/\{([^{}]+?)\s*&&\s*<a\s*$/) || [])[1];
    const ambito = { ...piezas, ...ambitoDe(tel), encodeURIComponent };
    if (cond && !correr('return (' + cond + ');', ambito)) return '(sin enlace)';
    return correr('return (' + expr + ');', ambito);
  };
}

const SITIOS = [
  ['app · Turismo (WhatsApp de la agencia)', 'guajirago/src/Turismo.js',
    porEnlace((tel) => ({ agenciaActiva: { telefono: tel } }))],
  ['aliados · pedido a domicilio', 'guajirago-aliados/src/PedidosDomicilio.js',
    porEnlace((tel) => ({ p: { telefono: tel, cliente: 'Ana', id: 'abc12345' }, nombreRestaurante: 'X' }))],
  ['aliados · reserva de turismo', 'guajirago-aliados/src/ReservasTurismo.js', (texto, piezas) => (tel) => {
    const i = texto.indexOf('const waLink = ');
    if (i < 0) return '¿?';
    return correr(hastaCerrar(texto, texto.indexOf('=>', i)), { ...piezas, r: { telefono: tel, cliente: 'Ana', nombreTour: 'T' }, nombreAgencia: 'A', encodeURIComponent });
  }],
  ['panel · Restaurantes', 'guajirago-admin/src/Restaurantes.js', porVentana('', 'wa', (tel) => ({ tel }))],
  ['panel · Turismo', 'guajirago-admin/src/Turismo.js', porVentana('', 'wa', (tel) => ({ tel }))],
  ['panel · Codigos (nadie la llama)', 'guajirago-admin/src/Codigos.js', porVentana('', 'enviarWhatsApp', (tel) => ({ cod: 'C1', val: 1000, tel }))],
];

const MUESTRAS = ['3001234567', '+57 300 123 4567', '573001234567', '5712345678', '300 123 45', '03001234567', 'abc'];
const numeroDe = (u) => { const m = String(u).match(/wa\.me\/(\d*)/); return m ? (m[1] || '(sin número)') : u; };

// Cada botón, sacado de su archivo y CORRIDO con cada teléfono de mentira. La prueba
// (pruebas/numeroWhatsApp.test.js) usa ESTA misma función: el recorrido vive una sola vez.
function tablaDe(muestras = MUESTRAS) {
  const piezas = { app: pieza('guajirago'), admin: pieza('guajirago-admin'), aliados: pieza('guajirago-aliados') };
  const tabla = {};
  for (const [nombre, ruta, hacer] of SITIOS) {
    const texto = fuente(ruta);
    const p = ruta.startsWith('guajirago-admin') ? piezas.admin : ruta.startsWith('guajirago-aliados') ? piezas.aliados : piezas.app;
    const f = hacer(texto.replace(/\r\n/g, '\n'), p);
    tabla[nombre] = muestras.map((m) => { try { return numeroDe(f(m)); } catch (e) { return '💥 ' + e.message.slice(0, 30); } });
  }
  return { tabla, piezas };
}

function medirCodigo() {
  console.log('\n📱 NÚMERO DE WHATSAPP — código ' + (COMMIT ? 'del commit ' + COMMIT : 'del disco'));
  const { tabla, piezas } = tablaDe();
  const bueno = (m) => { const d = (piezas.app.celularDiezCifras || (() => ''))(m); return d ? '57' + d : '(sin número)'; };
  let malos = 0;
  for (const [i, m] of MUESTRAS.entries()) {
    console.log('\n   teléfono guardado «' + m + '»  → el bueno: ' + (piezas.app.celularDiezCifras ? bueno(m) : '(la pieza no existe en este código)'));
    for (const nombre of Object.keys(tabla)) {
      const sale = tabla[nombre][i];
      // Sin número bueno vale: no pintar el enlace, avisar, o abrir WhatsApp SIN destinatario (con el mensaje escrito).
      // «(no hace nada)» NO vale: es un botón que se aprieta y calla (REGLA 9).
      const ok = piezas.app.celularDiezCifras
        ? (sale === bueno(m) || (bueno(m) === '(sin número)' && ['(sin enlace)', '(no abre: avisa)', '(sin número)'].includes(sale))) : null;
      if (ok === false) malos++;
      console.log('      ' + (ok === false ? '🔴' : ok ? '✓ ' : '· ') + ' ' + nombre.padEnd(40) + ' ' + sale);
    }
  }
  // Formas distintas de armar el NÚMERO (todo lo que no abre un número cuenta igual: «sin número»).
  const distintos = new Set(Object.values(tabla).map((f) => JSON.stringify(f.map((s) => (/^\d+$/.test(s) ? s : '—'))))).size;
  console.log('\n   formas distintas de armar el número entre los ' + SITIOS.length + ' botones: ' + distintos);
  if (piezas.app.celularDiezCifras) console.log('   botones que abren un número distinto del bueno (casos): ' + malos);
  console.log('   (los 2 botones de emergencia —Seguridad y el 🚨 del mapa— los corre pruebas/contactoEmergencia.test.js)');
  return { distintos, malos };
}

async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const { celularDiezCifras } = cargarDeLaApp('guajirago/src/telefonoValido.js');
  const bueno = (x) => { const d = celularDiezCifras(x); return d ? '57' + d : ''; };
  const familiaPanel = (x) => { let n = String(x || '').replace(/[^0-9]/g, ''); if (!n) return ''; return n.startsWith('57') ? n : '57' + n; };
  const familiaUltimas10 = (x) => '57' + String(x).replace(/\D/g, '').slice(-10);
  const [negocios, privados, reservas, pedidos] = await Promise.all(['negocios', 'negociosPrivado', 'reservasTurismo', 'pedidos'].map((c) => traer(c)));
  const porId = {};
  privados.map(doc).forEach((p) => { porId[p.id] = p; });
  const grupos = [
    ['panel · negocios (duenoTelefono || telefono)', negocios.map(doc).map((n) => ({ ...n, ...(porId[n.id] || {}) })).map((n) => n.duenoTelefono || n.telefono), familiaPanel],
    ['app · agencias (negocios.telefono, turismo)', negocios.map(doc).filter((n) => n.tipoNegocio === 'turismo').map((n) => n.telefono), familiaUltimas10],
    ['aliados · reservasTurismo.telefono', reservas.map(doc).map((r) => r.telefono), familiaUltimas10],
    ['aliados · pedidos.telefono', pedidos.map(doc).map((p) => p.telefono), familiaUltimas10],
  ];
  console.log('\n🗄️  TELÉFONOS GUARDADOS EN PRODUCCIÓN (los que usan esos botones)');
  for (const [nombre, lista, deAntes] of grupos) {
    const con = lista.filter((t) => String(t || '').trim() !== '');
    const noSirven = con.filter((t) => !bueno(t));
    const distinto = con.filter((t) => deAntes(t) !== bueno(t));
    console.log('   ' + nombre.padEnd(46) + ' con teléfono ' + String(con.length).padStart(3)
      + ' · no sirven ' + String(noSirven.length).padStart(2) + ' · el botón de antes abría otro número ' + distinto.length);
    for (const t of noSirven) {
      const d = String(t).replace(/\D/g, '');
      console.log('      · ' + d.length + ' cifras (…' + d.slice(-2) + ')' + (/[^\d\s+().-]/.test(String(t)) ? ' + letras' : ''));
    }
  }
}

module.exports = { SITIOS, tablaDe };

if (require.main === module) {
  (async () => {
    medirCodigo();
    if (!args.includes('--sin-datos')) await medirDatos();
    console.log('');
  })().catch((e) => { console.error('❌ ' + e.message); process.exit(1); });
}
