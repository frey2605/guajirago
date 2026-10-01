#!/usr/bin/env node
/**
 * 🟢 ¿PUEDE PONERSE «DISPONIBLE» EL CONDUCTOR SIN SALDO, Y SABE POR QUÉ NO PUEDE OFERTAR? — pendiente P05 (30-sep-2026).
 * SOLO LEE.
 *
 *   node scripts/medir-disponible-sin-saldo.cjs              (el código de hoy + producción)
 *   node scripts/medir-disponible-sin-saldo.cjs --sin-red    (solo el código)
 *   node scripts/medir-disponible-sin-saldo.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * Decisión del dueño (30-sep-2026): «Que pueda ver: se pone disponible y ve los viajes y sus precios, pero no puede
 * ofertar hasta recargar. Ve lo que se está perdiendo.» Y del aviso al celular: «Que le suene para que se anime a
 * recargar por lo que se está perdiendo».
 *
 * Hasta P05 el interruptor «Estoy disponible» de AppConductor.js no se dejaba prender con un saldo menor que la
 * comisión más barata que ese conductor puede tomar (comisionParaActivarse, G03/G69): salía «Te falta saldo».
 *
 * 1. EL INTERRUPTOR: saca del archivo el `onClick` del interruptor (el que hace `setActivo(!activo)`) y lo CORRE con
 *    una tabla de saldos, vehículos y estado (prendido/apagado): ¿se prende, se apaga, o frena con la ventanita?
 * 2. LA FRANJA: saca del archivo `function FranjaSinSaldo` y la PINTA con React con la misma tabla: ¿se ve, y con qué
 *    texto? Y mira que la pantalla del mercado la ponga y que tocarla abra «Mis créditos».
 * 3. EL FRENO AL OFERTAR (P04, no se toca): la huella de su decisión, con scripts/medir-aviso-sin-saldo.cjs.
 * 4. EL AVISO AL CELULAR: EJECUTA notificarNuevoViaje (guajirago/functions/index.js) con la nube de mentira y un
 *    taxista sin saldo: ¿le suena? (La decisión es que SÍ.)
 * 5. PRODUCCIÓN: las fichas de conductor y cuántas, con su saldo de hoy, no podían prender el interruptor.
 * No escribe nada. No imprime nombres: los uid van recortados.
 */
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp } = require('../pruebas/cargar.cjs');
const AVISO = require('./medir-aviso-sin-saldo.cjs');
const { cargarIndex, conRegistro } = require('../pruebas/nubeDeMentira.cjs');

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

const APP = 'guajirago/src/AppConductor.js';
const CONFIG = { comisionMototaxi: 400, comisionTaxi: 800, comisionDomicilio: 1000 };
const SALDOS = [null, 0, 399, 400, 799, 800, 5000];
const VEHICULOS = ['Taxi', 'Mototaxi', ''];
const huella = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

/** Lee un archivo de la raíz: del disco, o de un commit. `cambios` ({ ruta: texto }) pisa lo que haya (pantallas de mentira). */
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

const OPC = { babelrc: false, configFile: false, presets: [[presetReact, { runtime: 'classic' }]] };
const analizar = (t) => babel.parseSync(t, { ...OPC, sourceType: 'module' });
const compilar = (t) => babel.transformSync(t, { ...OPC, sourceType: 'script' }).code;

/** El onClick del interruptor: el atributo onClick cuyo código hace `setActivo(!activo)`. Devuelve su fuente, o null. */
function elInterruptor(texto, ast) {
  const hallados = [];
  babel.traverse(ast, {
    JSXAttribute(p) {
      const n = p.node;
      if (!n.name || n.name.name !== 'onClick' || !n.value || n.value.type !== 'JSXExpressionContainer') return;
      const f = texto.slice(n.value.expression.start, n.value.expression.end);
      if (/setActivo\(\s*!activo\s*\)/.test(f)) hallados.push(f);
    },
  });
  return hallados;
}

/** CORRE el onClick con un caso: 'prende', 'apaga', 'frena (ventanita «…»)' o 'no hace nada'. */
function correrInterruptor(fuente, caso, comisiones, AVISO_SIN_SALDO) {
  let resultado = 'no hace nada';
  const setActivo = (v) => { resultado = v ? 'prende' : 'apaga'; };
  const setAviso = (a) => { resultado = 'frena (ventanita «' + (a && a.titulo) + '»)'; };
  try {
    // eslint-disable-next-line no-new-func
    const f = new Function('saldoCreditos', 'activo', 'tipoVehiculo', 'configApp', 'comisionParaActivarse',
      'comisionSegunTipoDeViaje', 'setAviso', 'setActivo', 'desbloquearAudio', 'AVISO_SIN_SALDO', 'return (' + fuente + ');')(
      caso.saldo, caso.activo, caso.tv, CONFIG, comisiones.comisionParaActivarse, comisiones.comisionSegunTipoDeViaje,
      setAviso, setActivo, () => {}, AVISO_SIN_SALDO);
    f();
  } catch (e) { resultado = 'reventó: ' + e.message; }
  return resultado;
}

/** La `function FranjaSinSaldo(...)` del archivo (nodo), o null. */
function laFranja(ast) {
  for (const n of ast.program.body) if (n.type === 'FunctionDeclaration' && n.id && n.id.name === 'FranjaSinSaldo') return n;
  return null;
}

/** ¿Dónde pone la pantalla la franja? Cada `<FranjaSinSaldo …/>` con sus atributos (fuente). */
function dondeSePone(texto, ast) {
  const usos = [];
  babel.traverse(ast, {
    JSXOpeningElement(p) {
      if (p.node.name && p.node.name.name === 'FranjaSinSaldo') {
        const attrs = {};
        for (const a of p.node.attributes) if (a.type === 'JSXAttribute' && a.value) attrs[a.name.name] = texto.slice(a.value.start, a.value.end);
        usos.push(attrs);
      }
    },
  });
  return usos;
}

function medirCodigo(commit, cambios = {}) {
  const leer = lector(commit, cambios);
  const texto = leer(APP);
  if (texto == null) throw new Error('no está ' + APP);
  const comisiones = cargarDeLaApp('guajirago/src/comisiones.js', leer('guajirago/src/comisiones.js'));
  const { AVISO_SIN_SALDO } = cargarDeLaApp('guajirago/src/textosViaje.js', leer('guajirago/src/textosViaje.js'));
  const ast = analizar(texto);

  // 1 · el interruptor
  const interruptores = elInterruptor(texto, ast);
  const casos = [];
  for (const saldo of SALDOS) for (const tv of VEHICULOS) for (const activo of [false, true]) casos.push({ saldo, tv, activo });
  const tabla = interruptores.length === 1
    ? casos.map((c) => ({ ...c, hace: correrInterruptor(interruptores[0], c, comisiones, AVISO_SIN_SALDO) })) : [];
  const frena = tabla.filter((x) => x.hace.startsWith('frena'));
  const prendeSinSaldo = tabla.filter((x) => !x.activo && x.hace === 'prende' && x.saldo !== null
    && x.saldo < comisiones.comisionParaActivarse(x.tv, CONFIG));

  // 2 · la franja
  const nodo = laFranja(ast);
  let franja = null;
  if (nodo) {
    // eslint-disable-next-line no-new-func
    const { T } = cargarDeLaApp('guajirago/src/theme.js', leer('guajirago/src/theme.js'));
    // eslint-disable-next-line no-new-func
    const Comp = new Function('React', 'comisionParaActivarse', 'AVISO_SIN_SALDO', 'T', compilar(texto.slice(nodo.start, nodo.end)) + '\nreturn FranjaSinSaldo;')(
      React, comisiones.comisionParaActivarse, AVISO_SIN_SALDO, T);
    franja = [];
    for (const saldo of SALDOS) for (const tv of VEHICULOS) {
      let tocada = 0;
      let html;
      try { html = servidor.renderToStaticMarkup(React.createElement(Comp, { saldoCreditos: saldo, tipoVehiculo: tv, configApp: CONFIG, onRecargar: () => { tocada += 1; } })); } catch (e) { html = 'reventó: ' + e.message; }
      // y se TOCA: se busca el onClick del primer elemento que devuelve.
      try {
        const el = Comp({ saldoCreditos: saldo, tipoVehiculo: tv, configApp: CONFIG, onRecargar: () => { tocada += 1; } });
        if (el && el.props && typeof el.props.onClick === 'function') el.props.onClick();
      } catch (e) { /* lo dice el html */ }
      const debe = saldo !== null && saldo < comisiones.comisionParaActivarse(tv, CONFIG);
      franja.push({ saldo, tv, debe, seVe: html !== '', html, tocarAbreCreditos: tocada === 1,
        diceElTexto: html.includes(AVISO_SIN_SALDO.texto) && html.includes(AVISO_SIN_SALDO.titulo) });
    }
  }
  const usos = dondeSePone(texto, ast);

  // 3 · el freno al ofertar (P04): su huella
  const aviso = AVISO.medirCodigo(AVISO.lector(commit));

  return {
    interruptores: interruptores.length, tabla, frena: frena.length, prendeSinSaldo: prendeSinSaldo.length,
    huellaInterruptor: huella(JSON.stringify(tabla.filter((x) => !x.hace.startsWith('frena')).map((x) => x.hace))),
    franja, usos, AVISO_SIN_SALDO,
    frenos: aviso.sitios.map((s) => ({ renglon: s.renglon, huella: s.huella, frena: s.frena, casos: s.casos })),
  };
}

/** 4 · EJECUTA notificarNuevoViaje con un taxista CON saldo y otro SIN saldo: a quién le suena. */
async function elAvisoAlCelular(ref) {
  const cerca = { lat: 11.544 + 0.01, lng: -72.907 };
  const datos = {
    conductores: {
      CON: { activo: true, fcmToken: 'tok-con-saldo', ubicacion: cerca },
      SIN: { activo: true, fcmToken: 'tok-sin-saldo', ubicacion: cerca },
    },
    usuarios: { CON: { tipo: 'conductor', tipoVehiculo: 'Taxi', creditos: 5000 }, SIN: { tipo: 'conductor', tipoVehiculo: 'Taxi', creditos: 0 } },
    config: { global: CONFIG },
  };
  const { fx, mensajero } = cargarIndex(datos, {}, ref);
  await conRegistro(() => fx.notificarNuevoViaje({ data: { data: () => ({ estado: 'esperando', tipo: 'Taxi', tarifa: '$ 8.000', tarifaValor: 8000, pasajeroLat: 11.544, pasajeroLng: -72.907, radioBusqueda: 3 }) }, params: {} }));
  return mensajero.recibidos.map((m) => m.token).sort();
}

const corto = (id) => String(id).slice(0, 8) + '…';
const pesos = (n) => '$' + Number(n).toLocaleString('es-CO');

async function main() {
  const i = process.argv.indexOf('--commit');
  const ref = i >= 0 ? process.argv[i + 1] : null;
  const m = medirCodigo(ref);
  console.log('🟢 ¿SE PONE DISPONIBLE EL CONDUCTOR SIN SALDO? · ' + (ref ? 'commit ' + ref : 'carpeta de trabajo'));
  console.log('── 1. EL INTERRUPTOR (se CORRE su onClick; comisiones de mentira: taxi 800, mototaxi 400, mandado 1000) ──');
  console.log('  interruptores hallados: ' + m.interruptores + ' · casos: ' + m.tabla.length + ' · frena con la ventanita: ' + m.frena
    + ' · se prende con saldo de menos: ' + m.prendeSinSaldo + ' · huella de lo que hace cuando no frena: ' + m.huellaInterruptor);
  for (const x of m.tabla.filter((y) => !y.activo)) {
    console.log('   · apagado, ' + (x.tv || '(sin tipo)') + ', saldo ' + x.saldo + ' → ' + x.hace);
  }
  console.log('── 2. LA FRANJA «' + m.AVISO_SIN_SALDO.titulo + '» ──');
  if (!m.franja) console.log('  no existe FranjaSinSaldo en ' + APP);
  else {
    const mal = m.franja.filter((x) => x.seVe !== x.debe || (x.seVe && (!x.diceElTexto || !x.tocarAbreCreditos)));
    console.log('  casos: ' + m.franja.length + ' · se ve: ' + m.franja.filter((x) => x.seVe).length + ' · debería verse: '
      + m.franja.filter((x) => x.debe).length + ' · casos mal (se ve cuando no toca, no se ve cuando toca, sin el texto, o tocarla no abre Mis créditos): ' + mal.length);
    for (const x of mal) console.log('   🔴 ' + (x.tv || '(sin tipo)') + ' saldo ' + x.saldo + ': ' + JSON.stringify({ debe: x.debe, seVe: x.seVe, texto: x.diceElTexto, abre: x.tocarAbreCreditos }));
  }
  console.log('  la pantalla la pone ' + m.usos.length + ' vez/veces' + (m.usos.length ? ': ' + JSON.stringify(m.usos) : ''));
  console.log('── 3. LOS FRENOS POR SALDO (medir-aviso-sin-saldo.cjs) ──');
  for (const f of m.frenos) console.log('  · renglón ' + f.renglon + ': frena ' + f.frena + ' de ' + f.casos + ' casos · huella ' + f.huella);
  console.log('── 4. EL AVISO AL CELULAR (se EJECUTA notificarNuevoViaje; un taxista con $5.000 y otro con $0, los dos cerca) ──');
  const tokens = await elAvisoAlCelular(ref);
  console.log('  le suena a: ' + (tokens.join(', ') || 'nadie') + ' · al de $0: ' + (tokens.includes('tok-sin-saldo') ? 'SÍ' : 'NO'));
  if (process.argv.includes('--sin-red')) return;
  const { traer, doc } = require('./nube.cjs');
  const { saldoDe } = cargarDeLaApp('guajirago/src/saldoUsuario.js');
  const comisiones = cargarDeLaApp('guajirago/src/comisiones.js');
  const [u, c, k] = await Promise.all([traer('usuarios'), traer('config'), traer('conductores')]);
  const config = (c.map(doc).find((x) => x.id === 'global')) || {};
  const conductores = u.map(doc).filter((x) => x.tipo === 'conductor');
  const fichas = Object.fromEntries(k.map(doc).map((x) => [x.id, x]));
  console.log('── 5. PRODUCCIÓN ──');
  console.log('COMISIONES en config/global: taxi ' + comisiones.comisionSegunTipoDeViaje('Taxi', config) + ' · mototaxi '
    + comisiones.comisionSegunTipoDeViaje('Mototaxi', config) + ' · mandado ' + comisiones.comisionSegunTipoDeViaje('Mensajería', config));
  let bajo = 0;
  for (const x of conductores) {
    const min = comisiones.comisionParaActivarse(x.tipoVehiculo, config);
    if (saldoDe(x) < min) bajo += 1;
    console.log('   · ' + corto(x.id) + ' ' + (x.tipoVehiculo || '(sin tipo)') + ': ' + pesos(saldoDe(x)) + ' · su mínimo ' + min
      + ' · activo en su ficha de conductor: ' + (fichas[x.id] ? String(fichas[x.id].activo) : '(sin ficha)'));
  }
  console.log('FICHAS DE CONDUCTOR: ' + conductores.length + ' · NO PODÍAN PRENDER EL INTERRUPTOR (saldo menor que su comisión más barata): ' + bajo);
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });

module.exports = { medirCodigo, elAvisoAlCelular, lector, CONFIG, APP };
