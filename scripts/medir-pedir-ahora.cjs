#!/usr/bin/env node
/**
 * 🛎️ «¿ME PUEDEN PEDIR AHORA?» — gemelo G47 (29-sep-2026). SOLO LECTURA.
 *
 * La misma pregunta la contestaban tres pantallas, cada una a su manera:
 *   · el CLIENTE (guajirago/src/Restaurantes.js y Turismo.js): sale en el escaparate + pausa a mano + horario;
 *   · el DUEÑO   (guajirago-aliados/src/App.js, la tarjeta «🟢 Abierto · Los clientes pueden pedirte»): solo la pausa;
 *   · el PANEL   (guajirago-admin/src/Restaurantes.js, la cuenta «ABIERTOS AHORA»): aprobado + la pausa.
 * Y ninguna miraba el candado del negocio (`activo` / `estadoComercial`), que es lo que decide el servidor al crear el
 * pedido (`negocioPuedeOperar` en firestore.rules).
 *
 * Qué cuenta:
 *   1. EL CÓDIGO (sin red): saca de cada pantalla la regla que usa y la CORRE a las 24 horas de un día de Colombia con
 *      negocios de mentira (normal, 24 horas, pausado, bloqueado, apagado, oculto, pendiente, ficha a medias).
 *      Dice en cuántas horas no contestan lo mismo, y en cuántas alguna dice «sí» cuando el servidor rechazaría el pedido.
 *   2. LOS DATOS (Firestore VIVO, producción): cada negocio, a las 24 horas: en cuántas horas no coinciden, y qué dice
 *      cada una AHORA. No enseña nombres: solo el comienzo del id.
 *   Con `--commit <hash>` (raíz), `--commit-aliados <hash>` y `--commit-panel <hash>` corre el código de esos commits:
 *   así se carea el de antes con el de ahora.
 *
 * Uso:  node scripts/medir-pedir-ahora.cjs [--commit h] [--commit-aliados h] [--commit-panel h] [--solo-codigo]
 * No escribe nada. Usa la casa común de datos (scripts/nube.cjs).
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cargarDeLaApp } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

function textoDe(repo, ruta, commit) {
  if (!commit) {
    const p = path.join(RAIZ, repo, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', path.join(RAIZ, repo), 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

/** Una pieza pura de ese repo y commit, ya cargada (sus imports salen del disco). */
function cargar(repo, ruta, commit) {
  const t = textoDe(repo, ruta, commit);
  if (t == null) throw new Error('no está ' + path.posix.join(repo, ruta) + (commit ? ' en ' + commit : ''));
  return cargarDeLaApp(path.posix.join(repo, ruta), t);
}

/** Una expresión de una sola línea sacada del archivo: `const <nombre> = <expresión>;`, o lo que case con `patron`. */
function expresion(texto, patron, donde) {
  const m = texto.replace(/\r\n/g, '\n').match(patron);
  if (!m) throw new Error('no encuentro la regla en ' + donde + ' (' + patron + ')');
  return m[1].trim();
}

/**
 * Corre una expresión sacada de la pantalla, con el negocio en `variable` y con las piezas que la pantalla importa
 * puestas a su alcance. El reloj: las funciones de la pieza que reciben (negocio, ahora) se llaman sin `ahora` desde la
 * pantalla, así que aquí se les pone el instante `h` que se está midiendo.
 */
function correrExpresion(expr, variable, piezas, n, h) {
  const nombres = Object.keys(piezas);
  const valores = nombres.map((k) => (typeof piezas[k] === 'function' ? (a, t) => piezas[k](a, t === undefined ? h : t) : piezas[k]));
  // eslint-disable-next-line no-new-func
  return new Function(variable, ...nombres, 'return (' + expr + ');')(n, ...valores);
}

/**
 * Las reglas de cada pantalla: (negocio, instante) → true/false. Se SACAN del archivo y se CORREN —antes y después—:
 *   · cliente: la lista filtra con el escaparate y la tarjeta decide con `const ab = …` (y el menú con `const abiertoAhora = …`);
 *   · dueño:   antes `setAbierto(d.… )`; ahora `const motivoNoPedir = …` (null = pueden pedirle);
 *   · panel:   `const abiertos = lista.filter(r => …).length`.
 * `fuentes` deja pasar el texto de un archivo (un sabotaje) en vez del disco: { 'guajirago-aliados/src/App.js': '...' }.
 */
function reglas(c = {}, fuentes = {}) {
  const texto = (repo, ruta, commit) => {
    const t = fuentes[path.posix.join(repo, ruta)] ?? textoDe(repo, ruta, commit);
    if (t == null) throw new Error('no está ' + path.posix.join(repo, ruta) + (commit ? ' en ' + commit : ''));
    return t;
  };
  const pieza = (repo, dir, commit) => {
    const ruta = path.posix.join(repo, dir, 'horarioNegocio.js');
    const f = fuentes[ruta];
    return f != null ? cargarDeLaApp(ruta, f) : cargar(repo, dir + '/horarioNegocio.js', commit);
  };
  const r = {};
  // EL CLIENTE — la lista de restaurantes, el menú del restaurante y la lista de agencias.
  const pApp = pieza('', 'guajirago/src', c.raiz);
  const esc = cargarDeLaApp('guajirago/src/escaparate.js', texto('', 'guajirago/src/escaparate.js', c.raiz));
  const cliente = [
    ['cliente-restaurante', 'Restaurantes.js', 'losDeComida', /const ab = ([^;]+);/, 'r'],
    ['cliente-menu', 'Restaurantes.js', 'losDeComida', /const abiertoAhora = ([^;]+);/, 'restauranteActivo'],
    ['cliente-agencia', 'Turismo.js', 'lasDeTurismo', /const ab = ([^;]+);/, 'a'],
  ];
  for (const [nombre, ruta, filtro, patron, variable] of cliente) {
    const expr = expresion(texto('', 'guajirago/src/' + ruta, c.raiz), patron, ruta);
    r[nombre] = { como: filtro + ' + ' + expr, correr: (n, h) => esc[filtro]([n]).length === 1 && !!correrExpresion(expr, variable, pApp, n, h) };
  }
  // EL DUEÑO — la tarjeta de la bienvenida de aliados.
  {
    const t = texto('guajirago-aliados', 'src/App.js', c.aliados);
    if (/const motivoNoPedir = /.test(t)) {
      const expr = expresion(t, /const motivoNoPedir = ([^;]+);/, 'aliados App.js');
      const p = pieza('guajirago-aliados', 'src', c.aliados);
      r.dueno = { como: 'motivoNoPedir = ' + expr, correr: (n, h) => correrExpresion(expr, 'negocioDoc', p, n, h) === null };
    } else {
      const expr = expresion(t, /setAbierto\((d\.[^;]+)\);/, 'aliados App.js');
      r.dueno = { como: expr, correr: (n, h) => !!correrExpresion(expr, 'd', {}, n, h) };
    }
  }
  // EL PANEL — «ABIERTOS AHORA» del resumen de restaurantes.
  {
    const t = texto('guajirago-admin', 'src/Restaurantes.js', c.panel);
    const expr = expresion(t, /const abiertos = lista\.filter\(r => (.+)\)\.length;/, 'panel Restaurantes.js');
    const p = /from '\.\/horarioNegocio'/.test(t) ? pieza('guajirago-admin', 'src', c.panel) : {};
    r.panel = { como: expr, correr: (n, h) => !!correrExpresion(expr, 'r', p, n, h) };
  }
  return r;
}

/** Lo que decide el SERVIDOR al crear el pedido (firestore.rules, `puedeOperarEn`): solo el candado. */
const elServidorLoDeja = (n) => (n.activo === undefined ? true : n.activo) !== false
  && (n.estadoComercial === undefined ? 'alDia' : n.estadoComercial) !== 'bloqueado';

const HORAS = Array.from({ length: 24 }, (_, h) => new Date('2026-10-07T' + String(h).padStart(2, '0') + ':30:00-05:00'));

// Un negocio que sale en la app: ficha llena, de 8 a 22. Cada caso le cambia UNA cosa.
const BASE = { perfilCompleto: true, horarioApertura: 8, horarioCierre: 22 };
const CASOS = [
  ['normal, de 8 a 22', { ...BASE }],
  ['24 horas (0 y 0)', { ...BASE, horarioApertura: 0, horarioCierre: 0 }],
  ['pausado a mano', { ...BASE, abierto: false }],
  ['bloqueado en Cobros (estadoComercial)', { ...BASE, estadoComercial: 'bloqueado' }],
  ['apagado (activo: false)', { ...BASE, activo: false }],
  ['oculto del escaparate', { ...BASE, visibleEnEscaparate: false }],
  ['pendiente de aprobar', { ...BASE, aprobado: false }],
  ['ficha a medias', { ...BASE, perfilCompleto: false }],
];

/** Las respuestas de cada pantalla a las 24 horas: horas en que no coinciden, y horas en que alguna dice «sí» y el servidor no. */
function careo(rs, negocio, tipo) {
  // A una agencia la ven el cliente (lista de agencias) y su dueño; el resumen del panel de restaurantes no la cuenta.
  const nombres = Object.keys(rs).filter((k) => (tipo === 'turismo' ? k === 'cliente-agencia' || k === 'dueno' : k !== 'cliente-agencia'));
  const out = { distintas: 0, siSinServidor: 0, horasSi: {} };
  for (const k of nombres) out.horasSi[k] = 0;
  for (const t of HORAS) {
    const v = nombres.map((k) => { const s = !!rs[k].correr(negocio, t); if (s) out.horasSi[k] += 1; return s; });
    if (new Set(v).size > 1) out.distintas += 1;
    if (!elServidorLoDeja(negocio) && v.some(Boolean)) out.siSinServidor += 1;
  }
  return out;
}

async function main() {
  const c = { raiz: arg('--commit'), aliados: arg('--commit-aliados'), panel: arg('--commit-panel') };
  console.log('\n🛎️ ¿ME PUEDEN PEDIR AHORA? — gemelo G47 · código raíz ' + (c.raiz || 'del disco') + ' · aliados ' + (c.aliados || 'del disco') + ' · panel ' + (c.panel || 'del disco') + '\n');
  const rs = reglas(c);
  for (const [k, v] of Object.entries(rs)) console.log('  ' + k.padEnd(20) + ' usa: ' + v.como);

  let totDist = 0;
  let totServ = 0;
  console.log('\n  CASOS DE MENTIRA (restaurante; 24 horas de Colombia; «h» = horas en que esa pantalla dice que se puede pedir):');
  for (const [nombre, n] of CASOS) {
    const r = careo(rs, n, 'comida');
    totDist += r.distintas;
    totServ += r.siSinServidor;
    console.log('   · ' + nombre.padEnd(38) + Object.entries(r.horasSi).map(([k, h]) => k + ' ' + String(h).padStart(2) + ' h').join(' · ')
      + ' · no coinciden en ' + r.distintas + ' h · dicen «sí» y el servidor lo rechaza: ' + r.siSinServidor + ' h');
  }

  if (!process.argv.includes('--solo-codigo')) {
    const { traer, doc } = require('./nube.cjs');
    const negocios = (await traer('negocios')).map(doc);
    const ahora = new Date();
    let conDist = 0;
    let horasDist = 0;
    let ahoraDist = 0;
    console.log('\n  LOS DATOS (producción, colección negocios, ' + negocios.length + '):');
    for (const n of negocios) {
      const tipo = n.tipoNegocio === 'turismo' ? 'turismo' : 'comida';
      const r = careo(rs, n, tipo);
      const nombres = Object.keys(r.horasSi);
      const ya = nombres.map((k) => k + ' ' + (rs[k].correr(n, ahora) ? 'sí' : 'no'));
      const hoyDistinto = new Set(nombres.map((k) => !!rs[k].correr(n, ahora))).size > 1;
      if (r.distintas) conDist += 1;
      if (hoyDistinto) ahoraDist += 1;
      horasDist += r.distintas;
      console.log('   · ' + String(n.id).slice(0, 6) + '… ' + tipo.padEnd(8) + ' abre ' + JSON.stringify(n.horarioApertura) + ' cierra ' + JSON.stringify(n.horarioCierre)
        + (n.abierto === false ? ' · PAUSADO' : '') + (n.aprobado === false ? ' · SIN APROBAR' : '') + (n.perfilCompleto !== true ? ' · FICHA A MEDIAS' : '')
        + (n.visibleEnEscaparate === false ? ' · OCULTO' : '') + (!elServidorLoDeja(n) ? ' · BLOQUEADO' : '')
        + ' → no coinciden en ' + r.distintas + ' h · ahora: ' + ya.join(', '));
    }
    console.log('\n   negocios en que las pantallas no coinciden en alguna hora: ' + conDist + ' de ' + negocios.length + ' (' + horasDist + ' horas en total) · no coinciden AHORA: ' + ahoraDist);
  }

  console.log('\n  VEREDICTO (casos de mentira): ' + (totDist === 0 && totServ === 0
    ? '✓ el cliente, el dueño y el panel contestan lo mismo a todas horas, y ninguno dice «sí» cuando el servidor rechazaría el pedido'
    : '🔴 no coinciden en ' + totDist + ' horas, y dicen «sí» cuando el servidor rechazaría el pedido en ' + totServ + ' horas') + '\n');
}

module.exports = { reglas, careo, CASOS, HORAS, elServidorLoDeja };

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
