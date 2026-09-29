#!/usr/bin/env node
/**
 * 🎁 ¿QUÉ DICE CADA PANTALLA DEL BENEFICIO DE UNA PROMOCIÓN? — gemelo G52 (29-sep-2026) · SOLO LECTURA
 *
 * El beneficio de una promoción («$ 8.000 de crédito» o «20% de descuento») se escribía a mano en SEIS sitios:
 *   app   · Promociones.js (el descuento pendiente, el recién canjeado y la tarjeta de cada oferta) y Solicitar.js
 *   panel · Promociones.js (la tarjeta) y Superadmin.js (la lista de promociones)
 * y no todos preguntaban lo mismo: unos «¿es de crédito?» y otros «¿es de descuento?». Con un tipo que no sea
 * ninguno de los dos (o vacío) decían cosas contrarias. Y la lista de categorías estaba dos veces (app y panel).
 *
 * La verdad la tiene el que COBRA: `aplicarDescuento` de guajirago/functions/descuentos.cjs. Este guion le pregunta a
 * él si un beneficio resta PESOS o un PORCENTAJE, y lo compara con lo que ENSEÑA cada sitio. No lee el texto como
 * texto: SACA de cada archivo la expresión que pinta el beneficio y la EJECUTA con cada caso (inventados y los de
 * producción: cada promoción y cada descuento pendiente guardado en una ficha).
 *
 *   node scripts/medir-texto-beneficio.cjs [--commit <hash-raiz>] [--commit-panel <hash-panel>] [--sin-nube]
 *
 * Con --commit / --commit-panel corre el código de ese commit (careo antes/después). No escribe nada.
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const { aplicarDescuento } = require('../guajirago/functions/descuentos.cjs');

const RAIZ = path.resolve(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

/** El archivo tal como está, o como estaba en un commit (del repo que le toca). */
function fuente(ruta, commitRaiz, commitPanel) {
  const enPanel = ruta.startsWith('guajirago-admin/');
  const commit = enPanel ? commitPanel : commitRaiz;
  if (!commit) return fs.readFileSync(path.join(RAIZ, ruta), 'utf8');
  const cwd = enPanel ? path.join(RAIZ, 'guajirago-admin') : RAIZ;
  const rel = enPanel ? ruta.slice('guajirago-admin/'.length) : ruta;
  try { return execFileSync('git', ['show', commit + ':' + rel], { cwd, encoding: 'utf8', maxBuffer: 1 << 26 }); }
  catch { return null; }
}

/** El contenido del siguiente `{ ... }` a partir de `desde` (llaves equilibradas). */
function llaveDesde(t, desde) {
  const a = t.indexOf('{', desde);
  if (a < 0) return null;
  let n = 0;
  for (let i = a; i < t.length; i++) {
    if (t[i] === '{') n++;
    else if (t[i] === '}') { n--; if (n === 0) return t.slice(a + 1, i).trim(); }
  }
  return null;
}

// Cada sitio: dónde está, cómo se saca la expresión, cómo se llama su variable, y si pinta el valor CORTO
// («$ 8.000» / «20%», luego la pantalla añade «de descuento») o el texto LARGO («… de crédito» / «… de descuento»).
const SITIOS = [
  { nombre: 'app · Promociones · descuento pendiente', ruta: 'guajirago/src/Promociones.js', var: 'descPend', largo: false,
    sacar: (t) => (t.match(/const texto = (.+);\r?$/m) || [])[1] },
  { nombre: 'app · Promociones · recién canjeado', ruta: 'guajirago/src/Promociones.js', var: 'resultado', largo: false, canje: true,
    sacar: (t) => (t.match(/const textoValor = (.+);\r?$/m) || [])[1] },
  { nombre: 'app · Promociones · tarjeta de la oferta', ruta: 'guajirago/src/Promociones.js', var: 'p', largo: true,
    sacar: (t) => { const a = t.indexOf("fontSize: '20px', fontWeight: '900', margin: '0 0 8px' }}>"); return a < 0 ? null : llaveDesde(t, t.indexOf('}}>', a) + 3); } },
  { nombre: 'app · Solicitar · «Tienes un descuento activo de…»', ruta: 'guajirago/src/Solicitar.js', var: 'descuentoPendiente', largo: false,
    sacar: (t) => { const a = t.indexOf('Tienes un descuento activo de '); return a < 0 ? null : llaveDesde(t, a); } },
  { nombre: 'panel · Promociones · tarjeta', ruta: 'guajirago-admin/src/Promociones.js', var: 'p', largo: true,
    sacar: (t) => { const a = t.indexOf("color: '#2ECC71', fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px' }}>"); return a < 0 ? null : llaveDesde(t, t.indexOf('}}>', a) + 3); } },
  { nombre: 'panel · Superadmin · lista de promociones', ruta: 'guajirago-admin/src/Superadmin.js', var: 'p', largo: true,
    sacar: (t) => { const a = t.indexOf("{p.nombre || 'Sin nombre'}</p>"); return a < 0 ? null : llaveDesde(t, t.indexOf('}}>', t.indexOf('<p', a)) + 3); } },
];

/** Las piezas que la expresión puede pedir: cop y, si ya existen, las de la regla de promociones de su app. */
function piezasDe(ruta, commitRaiz, commitPanel) {
  const dir = path.posix.dirname(ruta);
  const moneda = cargarDeLaApp(dir + '/moneda.js', fuente(dir + '/moneda.js', commitRaiz, commitPanel));
  let regla = {};
  const f = fuente(dir + '/reglaPromocion.js', commitRaiz, commitPanel);
  if (f) {
    // La regla puede pedir cop a './moneda': se le da la del mismo commit.
    const sinMoneda = f.replace(/^import\s*\{\s*cop\s*\}\s*from\s*'\.\/moneda';?[ \t]*\r?$/m, 'const cop = __cop;');
    const nombres = [...sinMoneda.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
    // eslint-disable-next-line no-new-func
    regla = new Function('__cop', sinMoneda.replace(/^export\s+/gm, '') + '\nreturn { ' + nombres.join(', ') + ' };')(moneda.cop);
  }
  return { cop: moneda.cop, ...regla };
}

/** ¿Qué hace el que cobra con este beneficio? 'pesos' o 'porcentaje'. */
function loQueCobra(b) {
  const r = aplicarDescuento(1000000, { tipoBeneficio: b.tipoBeneficio, valorBeneficio: 1 });
  return r === 999999 ? 'pesos' : 'porcentaje';
}

/** ¿Qué dice el texto? */
function loQueDice(texto) {
  const t = String(texto);
  if (/undefined|NaN|null/.test(t)) return 'roto';
  const pesos = /\$/.test(t);
  const pct = /%/.test(t);
  if (pesos === pct) return 'roto';
  return pesos ? 'pesos' : 'porcentaje';
}

function correrSitios(casos, commitRaiz, commitPanel) {
  const filas = [];
  for (const s of SITIOS) {
    const t = fuente(s.ruta, commitRaiz, commitPanel);
    const expr = t && s.sacar(t);
    if (!expr) { filas.push({ sitio: s, error: 'no se encontró la expresión' }); continue; }
    const piezas = piezasDe(s.ruta, commitRaiz, commitPanel);
    const claves = Object.keys(piezas);
    // eslint-disable-next-line no-new-func
    const fn = new Function(...claves, s.var, 'return (' + expr + ');');
    const malos = [];
    for (const c of casos) {
      const entrada = s.canje ? { tipo: c.b.tipoBeneficio, valor: c.b.valorBeneficio || 0 } : c.b;
      let texto;
      try { texto = fn(...claves.map((k) => piezas[k]), entrada); } catch (e) { texto = 'ERROR ' + e.message; }
      const cobra = loQueCobra(c.b);
      const dice = loQueDice(texto);
      const coletilla = !s.largo ? true
        : cobra === 'pesos' ? /de crédito$/.test(texto) : /de descuento$/.test(texto);
      if (dice !== cobra || !coletilla) malos.push({ caso: c.nombre, texto, cobra });
    }
    filas.push({ sitio: s, expr, malos, textos: casos.map((c) => { try { return fn(...claves.map((k) => piezas[k]), s.canje ? { tipo: c.b.tipoBeneficio, valor: c.b.valorBeneficio || 0 } : c.b); } catch (e) { return 'ERROR'; } }) });
  }
  return filas;
}

/** Categorías: cuántas listas hay escritas, y qué etiqueta sale para cada categoría en la app y en el panel. */
function categorias(commitRaiz, commitPanel, ids) {
  const res = {};
  for (const ruta of ['guajirago/src/Promociones.js', 'guajirago-admin/src/Promociones.js']) {
    const t = fuente(ruta, commitRaiz, commitPanel);
    const piezas = piezasDe(ruta, commitRaiz, commitPanel);
    const lista = (t.match(/const CATEGORIAS = (\[[\s\S]*?\]);/) || [])[1];
    const info = (t.match(/const categoriaInfo = (.+);\r?$/m) || [])[1];
    const cat = (t.match(/const cat = (.+);\r?$/m) || [])[1];
    const claves = Object.keys(piezas);
    const ctx = (lista ? 'const CATEGORIAS = ' + lista + ';\n' : '') + (info ? 'const categoriaInfo = ' + info + ';\n' : '');
    // eslint-disable-next-line no-new-func
    const fn = new Function(...claves, 'p', ctx + 'const cat = ' + cat + ';\nreturn cat.icono + " " + cat.label;');
    res[ruta] = { escritaAqui: !!lista, etiquetas: ids.map((id) => fn(...claves.map((k) => piezas[k]), { categoria: id })) };
  }
  return res;
}

const INVENTADOS = [
  { nombre: 'crédito de 8.000', b: { tipoBeneficio: 'credito', valorBeneficio: 8000 } },
  { nombre: 'descuento del 20 %', b: { tipoBeneficio: 'descuento', valorBeneficio: 20 } },
  { nombre: 'tipo vacío, valor 15', b: { tipoBeneficio: '', valorBeneficio: 15 } },
  { nombre: 'sin tipo, valor 10', b: { valorBeneficio: 10 } },
  { nombre: 'tipo «porcentaje», valor 5', b: { tipoBeneficio: 'porcentaje', valorBeneficio: 5 } },
  { nombre: 'crédito sin valor', b: { tipoBeneficio: 'credito' } },
  { nombre: 'descuento sin valor', b: { tipoBeneficio: 'descuento' } },
];

async function main() {
  const commitRaiz = arg('--commit');
  const commitPanel = arg('--commit-panel');
  console.log('🎁 EL TEXTO DEL BENEFICIO · código ' + (commitRaiz ? 'raíz @' + commitRaiz : 'raíz de hoy') + ' · '
    + (commitPanel ? 'panel @' + commitPanel : 'panel de hoy'));

  let casos = INVENTADOS.slice();
  let promos = [];
  if (!process.argv.includes('--sin-nube')) {
    const { traer, doc } = require('./nube.cjs');
    const [pc, uc] = await Promise.all([traer('promociones'), traer('usuarios')]);
    promos = pc.map(doc);
    const pendientes = uc.map(doc).filter((u) => u.descuentoPendiente);
    const tipos = {};
    for (const p of promos) tipos[p.tipoBeneficio || '(vacío)'] = (tipos[p.tipoBeneficio || '(vacío)'] || 0) + 1;
    const tiposD = {};
    for (const u of pendientes) { const k = u.descuentoPendiente.tipoBeneficio || '(vacío)'; tiposD[k] = (tiposD[k] || 0) + 1; }
    console.log('PRODUCCIÓN: ' + promos.length + ' promociones ' + JSON.stringify(tipos) + ' · ' + pendientes.length
      + ' fichas con descuento pendiente ' + JSON.stringify(tiposD));
    casos = casos.concat(promos.map((p) => ({ nombre: 'promo ' + p.id, b: p })),
      pendientes.map((u) => ({ nombre: 'pendiente de ' + u.id.slice(0, 6), b: u.descuentoPendiente })));
  }

  const filas = correrSitios(casos, commitRaiz, commitPanel);
  let sitiosMalos = 0; let combinacionesMalas = 0; let malasProduccion = 0;
  console.log('\nSITIOS (' + filas.length + ') × CASOS (' + casos.length + ', ' + INVENTADOS.length + ' inventados):');
  for (const f of filas) {
    if (f.error) { console.log('  🔴 ' + f.sitio.nombre + ': ' + f.error); sitiosMalos++; continue; }
    const n = f.malos.length;
    combinacionesMalas += n;
    malasProduccion += f.malos.filter((m) => !INVENTADOS.some((i) => i.nombre === m.caso)).length;
    if (n) sitiosMalos++;
    console.log('  ' + (n ? '🔴' : '✓') + ' ' + f.sitio.nombre + ' — ' + n + ' caso(s) dicen otra cosa que el cobro');
    for (const m of f.malos.slice(0, 4)) console.log('       · ' + m.caso + ': enseña «' + m.texto + '» y el cobro resta ' + m.cobra);
  }
  // ¿Dicen todos lo mismo? (el texto largo y el corto por separado)
  const distintos = (grupo) => {
    let d = 0;
    for (let i = 0; i < casos.length; i++) if (new Set(grupo.map((f) => f.textos && f.textos[i])).size > 1) d++;
    return d;
  };
  const cortos = filas.filter((f) => !f.error && !f.sitio.largo);
  const largos = filas.filter((f) => !f.error && f.sitio.largo);
  const dCortos = distintos(cortos); const dLargos = distintos(largos);
  console.log('\n  casos en que los sitios del valor corto no dicen lo mismo entre sí: ' + dCortos + ' de ' + casos.length);
  console.log('  casos en que los sitios del texto largo no dicen lo mismo entre sí: ' + dLargos + ' de ' + casos.length);

  const ids = ['transporte', 'domicilios', 'restaurantes', 'turismo', 'general', ...new Set(promos.map((p) => p.categoria).filter(Boolean)), 'otra'];
  const cats = categorias(commitRaiz, commitPanel, [...new Set(ids)]);
  const escritas = Object.values(cats).filter((c) => c.escritaAqui).length;
  const [a, b] = Object.values(cats);
  const catDistintas = a.etiquetas.filter((e, i) => e !== b.etiquetas[i]).length;
  console.log('\nCATEGORÍAS: listas escritas a mano en las pantallas: ' + escritas + ' · etiquetas distintas entre app y panel: ' + catDistintas);
  const fuera = promos.filter((p) => p.categoria && !['transporte', 'domicilios', 'restaurantes', 'turismo', 'general'].includes(p.categoria));
  if (promos.length) console.log('  promociones de producción con una categoría fuera de la lista: ' + fuera.length);

  console.log('\nVEREDICTO: ' + sitiosMalos + ' de ' + filas.length + ' sitios enseñan algo distinto de lo que se cobra ('
    + combinacionesMalas + ' combinaciones; de producción: ' + malasProduccion + ') · listas de categorías: ' + escritas);
  return { sitiosMalos, combinacionesMalas, malasProduccion, dCortos, dLargos, escritas, catDistintas };
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { SITIOS, correrSitios, categorias, INVENTADOS, loQueCobra, loQueDice };
