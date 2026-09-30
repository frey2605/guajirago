#!/usr/bin/env node
/**
 * ¿CUÁNTAS ESTRELLAS TIENE EL RESTAURANTE? — gemelo G83 (29-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-promedio-restaurante.cjs            <- el código del disco, con casos de mentira
 *   node scripts/medir-promedio-restaurante.cjs --antes    <- y el careo con el código de antes (5fbff29 / 9c4f892)
 *   node scripts/medir-promedio-restaurante.cjs --nube     <- y además las calificaciones VIVAS de producción
 *
 * El promedio de estrellas de un restaurante se enseña en TRES sitios:
 *   · LISTA   — la lista de restaurantes de la app (guajirago/src/Restaurantes.js, `setMapaCalif` y su «⭐ x (n)»);
 *   · MENÚ    — la barra de arriba del menú del restaurante (Restaurantes.js, `setCalifsRestaurante`,
 *               `promedioCalif`/`totalCalif`);
 *   · ALIADOS — la pantalla «Calificaciones» del restaurante (guajirago-aliados/src/CalificacionesRestaurante.js).
 * Antes de G83 cada uno filtraba a su manera. Desde G83 los tres usan la pieza estrellasNegocio.js (copia idéntica
 * en la app y en aliados).
 *
 * Qué hace: saca de cada archivo el trozo que CARGA las calificaciones, el que CUENTA y el que ENSEÑA el número, y
 * los CORRE con calificaciones de mentira (o las de producción). Lo que da cada sitio es el texto que se ve:
 * «4.0 (2)» o «sin calificaciones». No imprime uids ni nombres de personas. No escribe nada.
 *
 * Se vuelve a correr en el paso 12.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { RAIZ, cargarDeLaApp } = require('../pruebas/cargar.cjs');

const ANTES = { raiz: '5fbff29', aliados: '9c4f892' }; // los últimos commits antes de G83
const PIEZA_APP = 'guajirago/src/estrellasNegocio.js';
const PIEZA_ALIADOS = 'guajirago-aliados/src/estrellasNegocio.js';
const RESTAURANTES = 'guajirago/src/Restaurantes.js';
const ALIADOS = 'guajirago-aliados/src/CalificacionesRestaurante.js';
const NOMBRES_PIEZA = ['calificaAlNegocio', 'estrellasValidas', 'cuentaParaElPromedio', 'lasQueCuentan', 'promedioDelNegocio', 'promediosPorNegocio'];
const SIN = 'sin calificaciones';

// El restaurante de los casos es «N1», y N1 es también el uid de su dueño (así nace en aliados/Login.js).
const cli = (estrellas, mas = {}) => ({ quienCalifica: 'cliente', calificadoId: 'N1', estrellas, pedidoId: 'p', ...mas });
const CASOS = [
  { nombre: 'dos clientes: 5 y 3', cals: [cli(5), cli(3)] },
  { nombre: 'tres clientes: 5, 4 y 4 (promedio con decimales)', cals: [cli(5), cli(4), cli(4)] },
  { nombre: 'dos clientes y una de TAXI al dueño como persona (1★)', cals: [cli(5), cli(3), { quienCalifica: 'pasajero', calificadoId: 'N1', estrellas: 1, viajeId: 'v', opcionesSeleccionadas: ['Tardó'] }] },
  { nombre: 'dos clientes y una reportada (1★)', cals: [cli(5), cli(3), cli(1, { reportado: true })] },
  { nombre: 'un cliente 4★ y una vieja con 0★', cals: [cli(4), cli(0)] },
  { nombre: 'un cliente 4★ y una sin campo estrellas', cals: [cli(4), { quienCalifica: 'cliente', calificadoId: 'N1' }] },
  { nombre: 'un cliente 4★ y una con «5» escrito como texto', cals: [cli(4), cli('5')] },
  { nombre: 'ninguna', cals: [] },
  { nombre: 'solo una de taxi al dueño (el conductor calificó al pasajero)', cals: [{ quienCalifica: 'conductor', calificadoId: 'N1', estrellas: 2, viajeId: 'v' }] },
  { nombre: 'un cliente 5★ en N1 y un cliente 2★ en otro negocio', cals: [cli(5), cli(2, { calificadoId: 'N2' })] },
  { nombre: 'un cliente 4★ y una con 4.5★', cals: [cli(4), cli(4.5)] },
  { nombre: 'solo reportadas', cals: [cli(5, { reportado: true })] },
];

function argumento(nombre) { return process.argv.includes(nombre); }

/** Lee un archivo (ruta desde la raíz): del disco o de un commit de su repo. `cambios` pisa (pantallas de mentira). */
function lector(commits, cambios = {}) {
  return (r) => {
    if (Object.prototype.hasOwnProperty.call(cambios, r)) return cambios[r];
    const enAliados = r.startsWith('guajirago-aliados/');
    const commit = commits && (enAliados ? commits.aliados : commits.raiz);
    if (!commit) {
      const abs = path.join(RAIZ, r);
      return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    }
    const cwd = enAliados ? path.join(RAIZ, 'guajirago-aliados') : RAIZ;
    const rel = enAliados ? r.slice('guajirago-aliados/'.length) : r;
    try {
      return execFileSync('git', ['show', commit + ':' + rel], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 });
    } catch (e) { return null; }
  };
}

/** Desde `i` (que apunta a un `{` o `(`), hasta su pareja; salta textos entre comillas. Devuelve el índice de la pareja. */
function pareja(t, i) {
  const abre = t[i];
  const cierra = abre === '{' ? '}' : ')';
  let nivel = 0;
  let comilla = null;
  for (let k = i; k < t.length; k += 1) {
    const c = t[k];
    if (comilla) { if (c === '\\') k += 1; else if (c === comilla) comilla = null; continue; }
    if (c === '\'' || c === '"' || c === '`') comilla = c;
    else if (c === abre) nivel += 1;
    else if (c === cierra) { nivel -= 1; if (nivel === 0) return k; }
  }
  return -1;
}

/** El texto que hay entre el marcador `desde` (que tiene que estar UNA vez) y el final de la sentencia que contiene `hasta`. */
function trozo(t, desde, hasta, problemas, quien) {
  const i = t.indexOf(desde);
  if (i < 0 || t.indexOf(desde, i + 1) >= 0) { problemas.push(quien + ': el marcador «' + desde + '» no está UNA vez'); return null; }
  const j = t.indexOf(hasta, i + desde.length);
  if (j < 0) { problemas.push(quien + ': no está «' + hasta + '» después del marcador'); return null; }
  const p = pareja(t, j + hasta.length - 1);
  if (p < 0) { problemas.push(quien + ': «' + hasta + '» no cierra'); return null; }
  return t.slice(i + desde.length, p + 1) + ';';
}

/** Las expresiones `{...}` de un trozo de JSX que nombran `palabra`, en orden. */
function expresiones(seg, palabra) {
  const out = [];
  for (let k = 0; k < seg.length; k += 1) {
    if (seg[k] !== '{') continue;
    const p = pareja(seg, k);
    if (p < 0) break;
    const e = seg.slice(k + 1, p);
    if (e.includes(palabra) && !e.includes('style')) out.push(e.trim());
    k = p;
  }
  return out;
}

function correrCon(nombres, valores, cuerpo) {
  // eslint-disable-next-line no-new-func
  return new Function(...nombres, cuerpo)(...valores);
}

const hacerSnap = (cals) => ({ docs: cals.map((c, i) => ({ id: 'c' + i, data: () => ({ ...c }) })) });

/** Mide un par de commits (o el disco): arma los tres sitios como funciones que dan el texto que se ve. */
function medir(commits, cambios = {}) {
  const leer = lector(commits, cambios);
  const problemas = [];
  const pieza = (ruta) => {
    const f = leer(ruta);
    if (f == null) return {};
    try { return cargarDeLaApp(ruta, f); } catch (e) { problemas.push(ruta + ' no carga: ' + e.message); return {}; }
  };
  const fApp = leer(PIEZA_APP);
  const fAli = leer(PIEZA_ALIADOS);
  const pApp = pieza(PIEZA_APP);
  const pAli = pieza(PIEZA_ALIADOS);
  const valoresDe = (p) => NOMBRES_PIEZA.map((n) => p[n]);
  const sitios = {};

  const tr = leer(RESTAURANTES);
  if (tr == null) problemas.push('no está ' + RESTAURANTES);
  const t = tr == null ? '' : tr.replace(/\r\n/g, '\n');
  const importaApp = /import \{[^}]*\} from '\.\/estrellasNegocio';/.test(t);

  // ── LISTA ──
  const cargaLista = trozo(t, "const snap = await getDocs(collection(db, 'calificaciones'));", 'setMapaCalif(', problemas, 'LISTA');
  const iVista = t.indexOf('{mapaCalif[r.id] &&');
  let condLista = null; let exprLista = [];
  if (iVista < 0) problemas.push('LISTA: no está la vista `{mapaCalif[r.id] && …`');
  else {
    const q = t.indexOf(' ? (', iVista);
    condLista = t.slice(iVista + 1, q);
    const fin = t.indexOf(') : (', q);
    exprLista = expresiones(t.slice(q, fin), 'mapaCalif');
    if (exprLista.length !== 2) problemas.push('LISTA: esperaba 2 números en la vista (promedio y cuántas), hay ' + exprLista.length);
  }
  if (cargaLista && condLista) {
    sitios.LISTA = (cals, negocioId) => {
      let mapaCalif;
      correrCon(['snap', 'setMapaCalif', ...NOMBRES_PIEZA], [hacerSnap(cals), (m) => { mapaCalif = m; }, ...valoresDe(pApp)], cargaLista);
      const r = { id: negocioId };
      const ver = (e) => correrCon(['mapaCalif', 'r'], [mapaCalif, r], 'return (' + e + ');');
      return ver(condLista) ? ver(exprLista[0]) + ' (' + ver(exprLista[1]) + ')' : SIN;
    };
  }

  // ── MENÚ ──
  const cargaMenu = trozo(t, "where('calificadoId', '==', restauranteActivo.id)));", 'setCalifsRestaurante(', problemas, 'MENÚ');
  const iMenu = t.indexOf("if (pantalla === 'menu' && restauranteActivo) {");
  let cuentasMenu = null;
  if (iMenu < 0) problemas.push('MENÚ: no está la pantalla del menú');
  else {
    const lineas = t.slice(iMenu).split('\n').slice(1, 30).filter((l) => /^\s*const .*\b(totalCalif|promedioCalif)\b.*=/.test(l));
    if (!lineas.length) problemas.push('MENÚ: no están las cuentas de promedioCalif/totalCalif');
    cuentasMenu = lineas.join('\n') + '\nreturn { promedioCalif, totalCalif };';
  }
  const iBarra = t.indexOf('{totalCalif > 0 ? (');
  let exprMenu = [];
  if (iBarra < 0) problemas.push('MENÚ: no está la barra `{totalCalif > 0 ? (`');
  else {
    exprMenu = expresiones(t.slice(iBarra + 19, t.indexOf(') : (', iBarra)), 'Calif');
    if (exprMenu.length !== 2) problemas.push('MENÚ: esperaba 2 números en la barra, hay ' + exprMenu.length);
  }
  if (cargaMenu && cuentasMenu && exprMenu.length) {
    sitios['MENÚ'] = (cals, negocioId) => {
      let califsRestaurante = [];
      const restauranteActivo = { id: negocioId };
      const snap = hacerSnap(cals.filter((c) => c.calificadoId === negocioId)); // la consulta where('calificadoId', '==', …)
      correrCon(['snap', 'activo', 'setCalifsRestaurante', 'restauranteActivo', ...NOMBRES_PIEZA],
        [snap, true, (l) => { califsRestaurante = l; }, restauranteActivo, ...valoresDe(pApp)], cargaMenu);
      const { promedioCalif, totalCalif } = correrCon(['califsRestaurante', 'restauranteActivo', ...NOMBRES_PIEZA],
        [califsRestaurante, restauranteActivo, ...valoresDe(pApp)], cuentasMenu);
      const ver = (e) => correrCon(['promedioCalif', 'totalCalif'], [promedioCalif, totalCalif], 'return (' + e + ');');
      return totalCalif > 0 ? ver(exprMenu[0]) + ' (' + ver(exprMenu[1]) + ')' : SIN;
    };
  }

  // ── ALIADOS ──
  const ta = leer(ALIADOS);
  if (ta == null) problemas.push('no está ' + ALIADOS);
  const a = ta == null ? '' : ta.replace(/\r\n/g, '\n');
  const importaAli = /import \{[^}]*\} from '\.\/estrellasNegocio';/.test(a);
  const cargaAli = trozo(a, "where('calificadoId', '==', restauranteId)));", 'setLista(', problemas, 'ALIADOS');
  const iV = a.indexOf('  const visibles');
  const iE = a.indexOf('  const estrellasTxt');
  const cuentasAli = iV >= 0 && iE > iV ? a.slice(iV, iE) + '\nreturn { promedio, total };' : null;
  if (!cuentasAli) problemas.push('ALIADOS: no están las cuentas entre `const visibles` y `const estrellasTxt`');
  const vacia = a.includes(') : lista.length === 0 ? (');
  if (!vacia) problemas.push('ALIADOS: no está la rama `lista.length === 0` (sin calificaciones)');
  const iTarjeta = a.indexOf('linear-gradient(135deg, #FFCF4D');
  let exprAli = [];
  if (iTarjeta < 0) problemas.push('ALIADOS: no está la tarjeta del promedio');
  else {
    const seg = a.slice(iTarjeta, a.indexOf('</div>', iTarjeta));
    exprAli = [expresiones(seg, 'promedio.')[0], expresiones(seg, 'total')[0]].filter(Boolean);
    if (exprAli.length !== 2) problemas.push('ALIADOS: esperaba el promedio y el total en la tarjeta, hay ' + exprAli.length);
  }
  if (cargaAli && cuentasAli && vacia && exprAli.length === 2) {
    sitios.ALIADOS = (cals, negocioId) => {
      let lista = [];
      const snap = hacerSnap(cals.filter((c) => c.calificadoId === negocioId));
      correrCon(['snap', 'setLista', 'restauranteId', ...NOMBRES_PIEZA], [snap, (l) => { lista = l; }, negocioId, ...valoresDe(pAli)], cargaAli);
      if (lista.length === 0) return SIN;
      const { promedio, total } = correrCon(['lista', 'restauranteId', ...NOMBRES_PIEZA], [lista, negocioId, ...valoresDe(pAli)], cuentasAli);
      const ver = (e) => correrCon(['promedio', 'total'], [promedio, total], 'return (' + e + ');');
      return ver(exprAli[0]) + ' (' + ver(exprAli[1]) + ')';
    };
  }

  return {
    commits: commits || 'el disco', sitios, problemas, importaApp, importaAli,
    piezasIguales: fApp != null && fApp === fAli, hayPieza: { app: fApp != null, aliados: fAli != null },
    trozos: { cargaLista, cargaMenu, cuentasMenu, cargaAli, cuentasAli },
  };
}

/** Lo que ve cada sitio en cada caso. «0.0 (0)» en aliados (todas reportadas) cuenta como «sin calificaciones». */
function verCasos(m, casos = CASOS, negocioId = 'N1') {
  return casos.map((c) => {
    const vistos = {};
    for (const [n, f] of Object.entries(m.sitios)) {
      try { vistos[n] = f(c.cals, c.negocioId || negocioId); } catch (e) { vistos[n] = 'ERROR: ' + e.message; }
    }
    const norm = Object.values(vistos).map((v) => (v === '0.0 (0)' ? SIN : v));
    return { caso: c.nombre, vistos, iguales: norm.length === 3 && norm.every((v) => v === norm[0]) };
  });
}

function carear(antes, ahora, casos = CASOS) {
  const a = verCasos(antes, casos);
  const b = verCasos(ahora, casos);
  const diferencias = [];
  let comparaciones = 0;
  a.forEach((x, i) => {
    for (const s of Object.keys(x.vistos)) {
      comparaciones += 1;
      if (x.vistos[s] !== b[i].vistos[s]) diferencias.push({ caso: x.caso, sitio: s, antes: x.vistos[s], ahora: b[i].vistos[s] });
    }
  });
  return { comparaciones, diferencias };
}

module.exports = { medir, verCasos, carear, CASOS, ANTES, PIEZA_APP, PIEZA_ALIADOS, RESTAURANTES, ALIADOS, SIN };

if (require.main === module) {
  (async () => {
    const pintar = (titulo, m) => {
      console.log('\n══ ' + titulo + ' (' + (typeof m.commits === 'string' ? m.commits : m.commits.raiz + ' / ' + m.commits.aliados) + ')');
      if (m.problemas.length) console.log('  🔴 ' + m.problemas.join('\n  🔴 '));
      console.log('  sitios medidos: ' + Object.keys(m.sitios).join(', ') + ' · usan la pieza: app ' + (m.importaApp ? 'sí' : 'no') + ', aliados ' + (m.importaAli ? 'sí' : 'no')
        + ' · copias de la pieza idénticas: ' + (m.piezasIguales ? 'sí' : 'no'));
      const v = verCasos(m);
      for (const x of v) console.log('  ' + (x.iguales ? '✓' : '✗') + ' ' + x.caso + ' → ' + Object.entries(x.vistos).map(([s, t]) => s + ' ' + t).join(' · '));
      console.log('  casos donde el cliente y el restaurante ven lo MISMO: ' + v.filter((x) => x.iguales).length + ' de ' + v.length);
      return v;
    };
    const ahora = medir(null);
    pintar('AHORA', ahora);
    if (argumento('--antes')) {
      const antes = medir(ANTES);
      pintar('ANTES', antes);
      const c = carear(antes, ahora);
      console.log('\n══ CAREO antes/ahora: ' + c.comparaciones + ' comparaciones, ' + c.diferencias.length + ' distintas');
      for (const d of c.diferencias) console.log('  · ' + d.caso + ' · ' + d.sitio + ': ' + d.antes + ' → ' + d.ahora);
    }
    if (argumento('--nube')) {
      const { traer, doc } = require('./nube.cjs');
      const cals = (await traer('calificaciones')).map(doc);
      const negocios = (await traer('negocios')).map(doc);
      const antes = medir(ANTES);
      console.log('\n══ PRODUCCIÓN: ' + cals.length + ' calificaciones, ' + negocios.length + ' negocios');
      const porQuien = {};
      cals.forEach((c) => { const k = (c.quienCalifica || '?') + (negocios.some((n) => n.id === c.calificadoId) ? ' → negocio' : ' → persona'); porQuien[k] = (porQuien[k] || 0) + 1; });
      console.log('  calificaciones por quién califica: ' + JSON.stringify(porQuien));
      console.log('  a negocios: reportadas ' + cals.filter((c) => c.reportado && negocios.some((n) => n.id === c.calificadoId)).length
        + ', sin 1-5 estrellas enteras ' + cals.filter((c) => negocios.some((n) => n.id === c.calificadoId) && !(Number.isInteger(c.estrellas) && c.estrellas >= 1 && c.estrellas <= 5)).length);
      let iguales = 0; let cambios = 0;
      negocios.forEach((n, i) => {
        const caso = [{ nombre: 'negocio ' + (i + 1) + ' (' + (n.tipoNegocio || '?') + ')', cals, negocioId: n.id }];
        const x = verCasos(ahora, caso, n.id)[0];
        const y = verCasos(antes, caso, n.id)[0];
        if (x.iguales) iguales += 1;
        if (JSON.stringify(x.vistos) !== JSON.stringify(y.vistos)) cambios += 1;
        console.log('  ' + x.caso + ': ANTES ' + Object.entries(y.vistos).map(([s, t]) => s + ' ' + t).join(' · ') + '  |  AHORA ' + Object.entries(x.vistos).map(([s, t]) => s + ' ' + t).join(' · '));
      });
      console.log('  negocios donde los tres ven lo mismo AHORA: ' + iguales + ' de ' + negocios.length + ' · negocios cuyo número cambia: ' + cambios);
      const guardados = [...new Set(negocios.flatMap(Object.keys))].filter((k) => /calif|estrell|promed|rating/i.test(k));
      console.log('  promedio GUARDADO en la ficha del negocio: ' + (guardados.length ? guardados.join(', ') : 'ninguno (no hay campo que pueda quedar distinto)'));
    }
  })().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
