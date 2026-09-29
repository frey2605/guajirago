#!/usr/bin/env node
/**
 * 🕒 LA FECHA DEL PEDIDO — gemelo G48 (29-sep-2026). SOLO LECTURA.
 *
 * El campo `creado` de un pedido lo escriben DOS sitios y de DOS maneras:
 *   · el domicilio de la app del cliente (guajirago/src/Restaurantes.js): `serverTimestamp()` → un Timestamp;
 *   · el pedido de mesa de aliados (guajirago-aliados/src/Mesero.js): la hora del celular como TEXTO ISO.
 * Y cada pantalla lo leía con su propio convertidor. El del panel (`new Date(p.fecha || p.creado)`) no entiende un
 * Timestamp: «🧾 N pedidos hoy» no contaba NINGÚN domicilio, y la ficha pintaba «—» en su fecha.
 *
 * Qué cuenta:
 *   1. LOS DATOS (Firestore VIVO, producción): cuántos pedidos hay con `creado` en cada formato, por tipo; y cuántos
 *      cierres caen en otro día si se cuentan en hora de Londres (lo que hacía Corte de caja).
 *   2. EL CÓDIGO, corrido con esos pedidos: el «pedidos hoy» del panel, puesto el reloj en el instante en que se hizo
 *      cada pedido — ¿lo cuenta? — con el panel en Colombia y con el panel en un aparato en hora de Londres. Y cuántas
 *      fechas pinta «—». Y el «hoy» de Corte de caja de aliados, con el reloj en el instante de cada cierre.
 *   Con `--commit-panel <hash>` y `--commit-aliados <hash>` corre el código de esos commits: así se carea el de antes
 *   con el de ahora.
 *
 * Uso:  node scripts/medir-fecha-pedido.cjs [--commit-panel h] [--commit-aliados h]
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

/** Las piezas que la pantalla importa de './algo', cargadas del mismo commit (si existen allí). */
function piezasDe(repo, texto, commit, leerTexto = textoDe) {
  const piezas = {};
  const re = /^import\s*\{([^}]*)\}\s*from\s*'\.\/(fechaGuardada|reglaPromocion)';?\s*$/gm;
  let m;
  while ((m = re.exec(texto.replace(/\r\n/g, '\n')))) {
    const ruta = 'src/' + m[2] + '.js';
    const t = leerTexto(repo, ruta, commit);
    if (t == null) throw new Error('no está ' + repo + '/' + ruta + (commit ? ' en ' + commit : ''));
    const pieza = cargarDeLaApp(repo + '/' + ruta, t);
    for (const n of m[1].split(',').map((s) => s.trim()).filter(Boolean)) piezas[n] = pieza[n];
  }
  return piezas;
}

/** Corre `fn` con el reloj parado en `ms` y la zona horaria `tz`. */
function conReloj(ms, tz, fn) {
  const Real = global.Date;
  const antesTz = process.env.TZ;
  class Parado extends Real {
    constructor(...a) { if (a.length === 0) super(ms); else super(...a); }
    static now() { return ms; }
  }
  global.Date = Parado;
  process.env.TZ = tz;
  try { return fn(); } finally {
    global.Date = Real;
    if (antesTz === undefined) delete process.env.TZ; else process.env.TZ = antesTz;
  }
}

/**
 * El «pedidos hoy» y el «fechaTxt» del panel, sacados de guajirago-admin/src/Restaurantes.js tal cual están escritos.
 * Devuelve { pedidosHoyDe(pedidos, rid), fechaTxt(v) }.
 */
function elPanel(commit, leerTexto = textoDe) {
  const texto = leerTexto('guajirago-admin', 'src/Restaurantes.js', commit);
  if (texto == null) throw new Error('no está el panel' + (commit ? ' en ' + commit : ''));
  const t = texto.replace(/\r\n/g, '\n');
  const bloque = t.match(/\n((?:[ \t]*const hoyStr = [^\n]*\n)?[ \t]*const pedidosDe = [\s\S]*?const pedidosHoyDe = [\s\S]*?\.length;)\n/);
  if (!bloque) throw new Error('no encuentro pedidosDe/pedidosHoyDe en el panel');
  const fechaTxt = t.match(/\n[ \t]*(const fechaTxt = [^\n]*)\n/);
  if (!fechaTxt) throw new Error('no encuentro fechaTxt en el panel');
  const piezas = piezasDe('guajirago-admin', t, commit, leerTexto);
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  const hacer = new Function('pedidos', ...nombres, bloque[1] + '\n' + fechaTxt[1] + '\nreturn { pedidosHoyDe, fechaTxt };');
  return {
    pedidosHoyDe: (pedidos, rid) => hacer(pedidos, ...nombres.map((n) => piezas[n])).pedidosHoyDe(rid),
    fechaTxt: (v) => hacer([], ...nombres.map((n) => piezas[n])).fechaTxt(v),
  };
}

/**
 * El «hoy» de Corte de caja (aliados) y el día que le asigna a un cierre, sacados de CorteCaja.js.
 * Devuelve { hoy(), diaDelCierre(p) } — a un cierre lo cuenta HOY si diaDelCierre(p) === hoy().
 */
function laCaja(commit, leerTexto = textoDe) {
  const texto = leerTexto('guajirago-aliados', 'src/CorteCaja.js', commit);
  if (texto == null) throw new Error('no está CorteCaja' + (commit ? ' en ' + commit : ''));
  const t = texto.replace(/\r\n/g, '\n');
  const hoy = t.match(/const hoyISO = ([^\n]*);\n/);
  const dia = t.match(/\n[ \t]*const f = ([^\n]*);\n[ \t]*return f >= desde && f <= hasta;/);
  if (!hoy || !dia) throw new Error('no encuentro el hoy o el día del cierre en CorteCaja');
  const piezas = piezasDe('guajirago-aliados', t, commit, leerTexto);
  const nombres = Object.keys(piezas);
  // eslint-disable-next-line no-new-func
  const hacerHoy = new Function(...nombres, 'return ' + hoy[1] + ';');
  // eslint-disable-next-line no-new-func
  const hacerDia = new Function('p', ...nombres, 'return ' + dia[1] + ';');
  const vals = nombres.map((n) => piezas[n]);
  return { hoy: () => hacerHoy(...vals), diaDelCierre: (p) => hacerDia(p, ...vals) };
}

/** Un Timestamp DE VERDAD, el de la librería de firebase que usan las apps (no uno de mentira). */
function timestampDe(iso) {
  const { Timestamp } = require(path.join(RAIZ, 'guajirago', 'node_modules', 'firebase', 'firestore'));
  return Timestamp.fromDate(new Date(iso));
}

/** El pedido crudo de la API → como lo ve la app: el texto queda texto; el timestampValue, un Timestamp. */
function comoLoVeLaApp(d, val) {
  const campos = d.fields || {};
  const o = { id: (d.name || '').split('/').pop() };
  for (const k of Object.keys(campos)) {
    o[k] = 'timestampValue' in campos[k] ? timestampDe(campos[k].timestampValue) : val(campos[k]);
  }
  return o;
}

const formato = (campo) => {
  if (!campo) return 'sin campo';
  if ('timestampValue' in campo) return 'Timestamp';
  if ('stringValue' in campo) return /^\d{4}-\d{2}-\d{2}T/.test(campo.stringValue) ? 'texto ISO' : 'texto raro';
  return Object.keys(campo)[0];
};

async function main() {
  const commitPanel = arg('--commit-panel');
  const commitAliados = arg('--commit-aliados');
  const { traer, val } = require('./nube.cjs');
  const crudos = await traer('pedidos');
  console.log('\n🕒 LA FECHA DEL PEDIDO — G48 · producción · ' + crudos.length + ' pedidos');
  console.log('   código del panel: ' + (commitPanel || 'el del disco') + ' · de aliados: ' + (commitAliados || 'el del disco'));

  // 1. Los formatos guardados.
  const tabla = {};
  let conFecha = 0; let conFechaCreacion = 0;
  for (const d of crudos) {
    const f = d.fields || {};
    const tipo = f.tipo && f.tipo.stringValue ? f.tipo.stringValue : '(sin tipo)';
    const k = tipo + ' · ' + formato(f.creado);
    tabla[k] = (tabla[k] || 0) + 1;
    if (f.fecha) conFecha += 1;
    if (f.fechaCreacion) conFechaCreacion += 1;
  }
  console.log('\n1. CÓMO ESTÁ GUARDADO `creado` (tipo · formato → cuántos):');
  for (const k of Object.keys(tabla).sort()) console.log('   ' + k.padEnd(34) + tabla[k]);
  console.log('   con campo `fecha`: ' + conFecha + ' · con `fechaCreacion`: ' + conFechaCreacion);

  const pedidos = crudos.map((d) => comoLoVeLaApp(d, val));
  const instante = (p) => {
    const c = p.creado;
    if (!c) return null;
    if (typeof c === 'string') return Date.parse(c);
    return c.toMillis();
  };

  // 2. El «pedidos hoy» del panel, a la hora en que se hizo cada pedido.
  const panel = elPanel(commitPanel);
  const resumen = {};
  for (const tz of ['America/Bogota', 'UTC']) {
    let noCuenta = 0; let total = 0; const porTipo = {};
    for (const p of pedidos) {
      const ms = instante(p);
      if (ms == null || Number.isNaN(ms)) continue;
      total += 1;
      const n = conReloj(ms, tz, () => panel.pedidosHoyDe([p], p.restauranteId));
      if (n !== 1) { noCuenta += 1; porTipo[p.tipo || '(sin tipo)'] = (porTipo[p.tipo || '(sin tipo)'] || 0) + 1; }
    }
    resumen[tz] = noCuenta;
    console.log('\n2. «Pedidos hoy» del panel en un aparato en ' + (tz === 'UTC' ? 'hora de Londres' : 'hora de Colombia')
      + ': de ' + total + ' pedidos, NO cuenta ' + noCuenta + ' el día en que se hicieron'
      + (noCuenta ? '  (' + Object.entries(porTipo).map(([k, v]) => k + ': ' + v).join(', ') + ')' : ''));
  }
  const guiones = pedidos.filter((p) => { const ms = instante(p); return ms != null && !Number.isNaN(ms) && panel.fechaTxt(p.creado) === '—'; }).length;
  console.log('   la ficha pinta «—» en la fecha de ' + guiones + ' pedidos');

  // 3. Corte de caja: el dueño abre «hoy» a las 11 p. m. de Colombia del día de cada cierre. ¿Sale ese cierre?
  const caja = laCaja(commitAliados);
  let cierres = 0; let fueraDeHoy = 0;
  for (const p of pedidos) {
    if (p.estado !== 'cerrado' || typeof p.fechaCierre !== 'string') continue;
    const ms = Date.parse(p.fechaCierre);
    if (Number.isNaN(ms)) continue;
    cierres += 1;
    const diaCol = new Date(ms - 5 * 3600000).toISOString().slice(0, 10);
    const onceDeLaNoche = Date.parse(diaCol + 'T23:00:00-05:00');
    const ok = conReloj(onceDeLaNoche, 'America/Bogota', () => caja.diaDelCierre(p) === caja.hoy());
    if (!ok) fueraDeHoy += 1;
  }
  // Y lo que pasa con un cierre a las 8 p. m. de Colombia (en Londres ya es el día siguiente).
  const ochoPm = Date.parse('2026-09-20T20:00:00-05:00');
  const ejemplo = conReloj(ochoPm, 'America/Bogota', () => ({ hoy: caja.hoy(), dia: caja.diaDelCierre({ fechaCierre: new Date(ochoPm).toISOString() }) }));
  console.log('\n3. Corte de caja (aliados): de ' + cierres + ' cierres, ' + fueraDeHoy
    + ' NO salen en «hoy» si el dueño lo mira a las 11 p. m. del día en que se cerraron');
  console.log('   un cierre del domingo 20-sep a las 8 p. m. de Colombia: la caja dice hoy=' + ejemplo.hoy + ', cierre del día ' + ejemplo.dia);

  const malo = resumen['America/Bogota'] + resumen.UTC + guiones + fueraDeHoy + (ejemplo.hoy !== '2026-09-20' || ejemplo.dia !== '2026-09-20' ? 1 : 0);
  console.log('\n' + (malo ? '🔴 ' + malo + ' lecturas de fecha que no dicen el día de Colombia' : '✓ todas las lecturas medidas dicen el día de Colombia'));
}

module.exports = { elPanel, laCaja, conReloj, timestampDe, textoDe };

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
}
