#!/usr/bin/env node
/**
 * 🛵 LOS ESTADOS DEL PEDIDO Y EL AVISO DE «TU PEDIDO LLEGÓ» — gemelo G33, SOLO LECTURA.
 *
 * El negocio (guajirago-aliados) decide qué etapas usa su flujo de domicilio (ConfigFlujos.js escribe
 * `flujoDomicilio` en su ficha de `negocios`; flujoPedidos.js arma la cadena). El servidor le avisa al CLIENTE
 * cuando su pedido cambia de estado (avisarAlClienteDelCambio, en guajirago/functions/index.js). Si el negocio
 * apaga la etapa «entregado», el pedido salta de «en camino» a «cerrado»... y ¿le llega al cliente el aviso?
 *
 * Cuenta dos cosas, y ninguna escribe nada:
 *
 *   1. EL CÓDIGO: EJECUTA la función del servidor (sacada de index.js, del disco o de un commit) sobre las 16
 *      cadenas posibles (cada etapa opcional encendida o apagada) y dice en cuántas el cliente NO recibe el aviso
 *      de entregado, y en cuántas lo recibe dos veces.
 *   2. LOS DATOS de producción (scripts/nube.cjs): qué etapas tiene cada negocio, y cuántos pedidos a domicilio
 *      se cerraron en un negocio sin la etapa «entregado» (esos se quedaron sin el aviso final).
 *
 *   node scripts/medir-estados-pedido.cjs                 → el código de hoy + los datos
 *   node scripts/medir-estados-pedido.cjs --ref 183eb82   → el código de ese commit (para carear el antes)
 *   node scripts/medir-estados-pedido.cjs --sin-datos     → solo el código
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cargarDeLaApp, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const RAIZ = path.resolve(__dirname, '..');
const NUBE = 'guajirago/functions';
const FLUJO = cargarDeLaApp('guajirago-aliados/src/flujoPedidos.js');

function leerDe(ref, archivo) {
  if (!ref) return fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
  return execSync('git show ' + ref + ':' + archivo, { cwd: RAIZ, maxBuffer: 1 << 26 }).toString();
}

/** Carga un .cjs de la nube (del disco o de un commit), con sus `require('./…')` también de ese sitio. */
function cargarCjs(ref, archivo) {
  const texto = leerDe(ref, archivo);
  const m = { exports: {} };
  const req = (r) => {
    if (r.startsWith('./')) return cargarCjs(ref, path.posix.join(path.posix.dirname(archivo), /\.c?js$/.test(r) ? r : r + '.js'));
    return require(require.resolve(r, { paths: [path.join(RAIZ, NUBE)] }));
  };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', texto)(m, m.exports, req);
  return m.exports;
}

/**
 * La función del servidor que le avisa al cliente, EJECUTABLE, con un mensajero de mentira que apunta los avisos.
 * Se le dan los nombres que index.js trae de sus piezas `./…cjs` (del mismo commit) que el cuerpo use.
 * `fuente` permite pasarle un index.js con un sabotaje metido; `piezas` reemplaza alguna pieza ya cargada.
 */
function elAvisoDelServidor(ref, fuente, piezas = {}) {
  const codigo = (fuente || leerDe(ref, NUBE + '/index.js')).replace(/\r\n/g, '\n');
  const i = codigo.indexOf('async function avisarAlClienteDelCambio(');
  if (i < 0) throw new Error('no está avisarAlClienteDelCambio en index.js');
  const cuerpo = codigo.slice(i, cuerpoDeLaFuncion(codigo, i).fin + 1);
  const nombres = [];
  const valores = [];
  for (const m of codigo.matchAll(/^const \{([^}]+)\} = require\(['"](\.\/[^'"]+)['"]\);/gm)) {
    const usados = m[1].split(',').map((s) => s.trim())
      .filter((n) => n && !['mandarAviso', 'sobreDelAviso'].includes(n) && new RegExp('\\b' + n + '\\b').test(cuerpo));
    if (!usados.length) continue;
    const archivo = m[2].slice(2);
    const pieza = piezas[archivo] || cargarCjs(ref, NUBE + '/' + archivo);
    for (const n of usados) { nombres.push(n); valores.push(pieza[n]); }
  }
  return async (antes, despues) => {
    const mandados = [];
    const mandarAviso = async (_m, token, sobre) => { mandados.push(sobre); };
    const sobreDelAviso = (title, body) => ({ title, body });
    const admin = { messaging: () => ({}) };
    const consola = { log() {}, error() {}, warn() {} };
    // eslint-disable-next-line no-new-func
    const f = new Function('mandarAviso', 'sobreDelAviso', 'admin', 'console', ...nombres,
      cuerpo + '\nreturn avisarAlClienteDelCambio;')(mandarAviso, sobreDelAviso, admin, consola, ...valores);
    await f(antes, despues);
    return mandados;
  };
}

// Las etapas que el negocio PUEDE apagar: las de ORDEN_ESTADOS que construirCadena no deja fijas.
const FIJAS = FLUJO.construirCadena(['__ninguna__']).filter((e) => e !== 'nuevo');
const OPCIONALES = FLUJO.ORDEN_ESTADOS.filter((e) => !FIJAS.includes(e));

function todasLasCadenas() {
  const out = [];
  for (let mascara = 0; mascara < (1 << OPCIONALES.length); mascara++) {
    const encendidas = OPCIONALES.filter((_, k) => mascara & (1 << k));
    out.push({ encendidas, cadena: FLUJO.construirCadena(encendidas.length ? encendidas : ['__ninguna__']) });
  }
  return out;
}

const esAvisoDeEntregado = (s) => /entregado/i.test((s && s.title) || '');

/** Recorre la cadena de principio a fin con el servidor y dice qué avisos recibió el cliente. */
async function avisosDeLaCadena(avisar, cadena) {
  const recibidos = [];
  for (let k = 0; k + 1 < cadena.length; k++) {
    const antes = { estado: cadena[k] };
    const despues = { estado: cadena[k + 1], clienteFcmToken: 'tok', restauranteNombre: 'Asadero La 15' };
    for (const s of await avisar(antes, despues)) recibidos.push({ de: cadena[k], a: cadena[k + 1], title: s.title });
  }
  return recibidos;
}

async function medirCodigo(ref, fuente, piezas) {
  const avisar = elAvisoDelServidor(ref, fuente, piezas);
  const filas = [];
  for (const { encendidas, cadena } of todasLasCadenas()) {
    const recibidos = await avisosDeLaCadena(avisar, cadena);
    const entregados = recibidos.filter(esAvisoDeEntregado).length;
    filas.push({ encendidas, cadena, recibidos, entregados });
  }
  return {
    filas,
    sinEntregado: filas.filter((f) => f.entregados === 0).length,
    dobles: filas.filter((f) => f.entregados > 1).length,
    total: filas.length,
  };
}

async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const negocios = (await traer('negocios')).map(doc);
  const pedidos = (await traer('pedidos')).map(doc);
  const porNegocio = new Map(negocios.map((n) => [n.id, n]));
  const conFlujo = negocios.filter((n) => Array.isArray(n.flujoDomicilio) && n.flujoDomicilio.length);
  const sinEntregado = negocios.filter((n) => !FLUJO.construirCadena(n.flujoDomicilio).includes('entregado'));
  const domicilio = pedidos.filter((p) => p.tipo !== 'local');
  const porEstado = {};
  domicilio.forEach((p) => { porEstado[p.estado] = (porEstado[p.estado] || 0) + 1; });
  const cerradosSinEtapa = domicilio.filter((p) => {
    const n = porNegocio.get(p.restauranteId);
    return p.estado === 'cerrado' && n && !FLUJO.construirCadena(n.flujoDomicilio).includes('entregado');
  });
  return {
    negocios: negocios.length,
    conFlujo: conFlujo.map((n) => ({ nombre: n.nombre || n.id, flujo: n.flujoDomicilio })),
    sinEntregado: sinEntregado.map((n) => n.nombre || n.id),
    pedidosDomicilio: domicilio.length,
    porEstado,
    cerradosSinEtapa: cerradosSinEtapa.length,
    cerradosSinEtapaConToken: cerradosSinEtapa.filter((p) => p.clienteFcmToken).length,
  };
}

async function main() {
  const i = process.argv.indexOf('--ref');
  const ref = i > 0 ? process.argv[i + 1] : null;
  const r = await medirCodigo(ref);
  console.log('\n🛵 EL AVISO DE «TU PEDIDO LLEGÓ» — código ' + (ref ? 'del commit ' + ref : 'de hoy'));
  console.log('   Etapas que el negocio puede apagar: ' + OPCIONALES.join(', ') + ' (fijas: ' + FIJAS.join(', ') + ')');
  for (const f of r.filas) {
    const marca = f.entregados === 1 ? '✓' : '🔴';
    console.log('   ' + marca + ' encendidas [' + (f.encendidas.join(', ') || 'ninguna') + '] → avisos al pasar a: '
      + (f.recibidos.map((x) => x.a).join(' · ') || 'ninguno') + ' · «entregado»: ' + f.entregados);
  }
  console.log('   → cadenas donde el cliente NO recibe «entregado»: ' + r.sinEntregado + ' de ' + r.total);
  console.log('   → cadenas donde lo recibe dos veces: ' + r.dobles + ' de ' + r.total);

  if (process.argv.includes('--sin-datos')) return;
  const d = await medirDatos();
  console.log('\n📊 PRODUCCIÓN');
  console.log('   negocios: ' + d.negocios + ' · con flujo de domicilio guardado: ' + d.conFlujo.length);
  d.conFlujo.forEach((n) => console.log('     · ' + n.nombre + ': ' + n.flujo.join(', ')));
  console.log('   negocios SIN la etapa «entregado»: ' + d.sinEntregado.length + (d.sinEntregado.length ? ' (' + d.sinEntregado.join(', ') + ')' : ''));
  console.log('   pedidos a domicilio: ' + d.pedidosDomicilio + ' · por estado: ' + JSON.stringify(d.porEstado));
  console.log('   cerrados en un negocio sin «entregado» (se quedaron sin aviso final): ' + d.cerradosSinEtapa
    + ' (con teléfono para avisar: ' + d.cerradosSinEtapaConToken + ')');
}

module.exports = { elAvisoDelServidor, medirCodigo, todasLasCadenas, avisosDeLaCadena, OPCIONALES, FIJAS };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
