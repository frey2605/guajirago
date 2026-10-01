#!/usr/bin/env node
/**
 * ¿UN MISMO TELÉFONO PUEDE SACAR DOS VECES LA BIENVENIDA? — pendiente P06 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-bienvenida-por-telefono.cjs              (el código de hoy + producción)
 *   node scripts/medir-bienvenida-por-telefono.cjs --sin-red    (solo el código)
 *   node scripts/medir-bienvenida-por-telefono.cjs --commit X   (el código del commit X: el careo de antes y después)
 *
 * El regalo de bienvenida del pasajero ($8.000) lo da `descuentoDeBienvenida` (G18). Hasta P06 el servidor lo daba
 * una vez por PERSONA y por APARATO, pero el teléfono no lo miraba: «una vez por teléfono» lo cuidaba solo la pantalla
 * de registro (Login.js), que antes de crear la ficha le pregunta a `celularDisponible` si OTRA FICHA tiene ese mismo
 * `celular`. Una pregunta que se puede saltar, y que se responde mirando un campo que el dueño de la ficha puede
 * cambiar (las reglas no congelan `celular`).
 *
 * 1. CÓDIGO: EJECUTA `celularDisponible` y `descuentoDeBienvenida` (los de hoy o los de un commit) con la nube de
 *    mentira (pruebas/nubeDeMentira.cjs), en escenarios de varios pasos: registros honrados, el número cambiado en
 *    Mi perfil, el `celular` cambiado por fuera de la app, la pregunta saltada, el número de otro puesto en Mi perfil.
 *    Dice qué pasó en cada registro: bloqueado, $8.000, o $0 con su motivo.
 * 2. DATOS (producción): teléfonos que aparecen en más de una ficha (`celular` y `telefono`, en 10 cifras), las
 *    bienvenidas ya dadas (huellas, fichas y viajes), y el SIMULACRO de llenar el registro nuevo
 *    `bienvenidaPorTelefono` con esas bienvenidas: cuántos documentos escribiría. No lo escribe: eso lo decide el dueño.
 * No escribe nada. No imprime teléfonos enteros (solo las 4 últimas cifras) ni nombres.
 */
const { cargarIndex } = require('../pruebas/nubeDeMentira.cjs');
const { celularDiezCifras } = require('../guajirago/functions/telefonoValido.cjs');

const X = '3001112233'; // el número de Ana
const OTRO = '3009998877'; // el número nuevo de Ana
const DE_CARLA = '3005556677'; // el número de Carla, que aún no se ha registrado

// Cada paso: ['registro', uid, celular, aparato, { salta, guardaTal, telefono }] · ['miPerfil', uid, telefono] ·
// ['celularDirecto', uid, celular] (escritura a la ficha por fuera de la app: las reglas la dejan) ·
// ['huellaVieja', uid, celular, aparato] (una bienvenida dada ANTES del registro por teléfono).
// `espera` es lo que debe pasar en el ÚLTIMO registro con el arreglo puesto; `honrado` marca los casos de gente de bien.
const ESCENARIOS = [
  { nombre: 'registro normal de Ana', honrado: true, espera: 8000,
    pasos: [['registro', 'ana', X, 'dev_ana']] },
  { nombre: 'Ana cobra, cambia su número en Mi perfil, y Beto se registra con el número viejo', honrado: true, espera: 'bloqueado',
    pasos: [['registro', 'ana', X, 'dev_ana'], ['miPerfil', 'ana', OTRO], ['registro', 'beto', X, 'dev_beto']] },
  { nombre: 'Ana cobra, cambia su `celular` por fuera de la app, y Beto se registra con el número viejo', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['celularDirecto', 'ana', OTRO], ['registro', 'beto', X, 'dev_beto']] },
  { nombre: 'Ana cobra; Beto, con una app modificada, se salta la pregunta y se registra con el mismo número', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['registro', 'beto', X, 'dev_beto', { salta: true }]] },
  { nombre: 'lo mismo, con el número escrito de otra forma («300 111 2233»)', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['registro', 'beto', '300 111 2233', 'dev_beto', { salta: true, guardaTal: true }]] },
  { nombre: 'Ana cobra y cambia su `celular` por fuera; Beto se salta la pregunta con el número viejo escrito «300 111 2233»', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['celularDirecto', 'ana', OTRO],
      ['registro', 'beto', '300 111 2233', 'dev_beto', { salta: true, guardaTal: true }]] },
  { nombre: 'Beto se salta la pregunta, se registra con el número de Ana y pone uno nuevo en Mi perfil', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['celularDirecto', 'ana', OTRO],
      ['registro', 'beto', X, 'dev_beto', { salta: true, telefono: '3004443322' }]] },
  { nombre: 'Ana pone en Mi perfil el número de Carla; Carla se registra con el suyo', honrado: true, espera: 8000,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['miPerfil', 'ana', DE_CARLA], ['registro', 'carla', DE_CARLA, 'dev_carla']] },
  { nombre: 'Ana pide la bienvenida otra vez desde otro aparato', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['registro', 'ana', X, 'dev_ana2', { salta: true }]] },
  { nombre: 'Carla se registra en el aparato que ya usó Ana', espera: 0,
    pasos: [['registro', 'ana', X, 'dev_ana'], ['registro', 'carla', DE_CARLA, 'dev_ana']] },
  { nombre: 'una ficha SIN celular (app modificada) pide la bienvenida', espera: 0,
    pasos: [['registro', 'beto', '', 'dev_beto', { salta: true, guardaTal: true }]] },
  { nombre: 'Ana cobró ANTES del registro por teléfono; Beto se salta la pregunta con su número', espera: 0,
    pasos: [['huellaVieja', 'ana', X, 'dev_ana'], ['registro', 'beto', X, 'dev_beto', { salta: true }]] },
];

/** Aplica a `datos` lo que la transacción de mentira apuntó (la nube de mentira no cambia `datos` sola). */
function aplicar(datos, escrituras) {
  for (const e of escrituras.splice(0)) {
    const i = e.ruta.lastIndexOf('/');
    const col = e.ruta.slice(0, i), id = e.ruta.slice(i + 1);
    datos[col] = datos[col] || {};
    const antes = datos[col][id] || {};
    datos[col][id] = e.que === 'update' || (e.opciones && e.opciones.merge) ? { ...antes, ...e.campos } : { ...e.campos };
  }
}

/**
 * cargarIndex con `ref` saca del commit SOLO index.js; sus piezas (`./descuentoPendiente.cjs`…) las tomaría del disco
 * de hoy, y el careo mezclaría el código de antes con la pieza de ahora. Aquí, mientras carga, cada `./*.cjs` de
 * functions/ también sale del commit.
 */
function cargarDelCommit(datos, ref) {
  if (!ref) return cargarIndex(datos, {}, ref);
  const Module = require('module');
  const { execSync } = require('child_process');
  const path = require('path');
  const raiz = path.resolve(__dirname, '..');
  const dir = path.join(raiz, 'guajirago', 'functions');
  const hechos = {};
  const original = Module._load;
  Module._load = function (pedido, padre, ...resto) {
    if (/^\.\/[\w-]+\.cjs$/.test(pedido) && padre && path.dirname(padre.filename) === dir) {
      if (!hechos[pedido]) {
        const archivo = path.join(dir, pedido.slice(2));
        const m = new Module(archivo, padre);
        m.filename = archivo;
        m.paths = Module._nodeModulePaths(dir);
        m._compile(execSync('git show ' + ref + ':guajirago/functions/' + pedido.slice(2), { cwd: raiz }).toString(), archivo);
        hechos[pedido] = m.exports;
      }
      return hechos[pedido];
    }
    return original.call(this, pedido, padre, ...resto);
  };
  try { return cargarIndex(datos, {}, ref); } finally { Module._load = original; }
}

/** Corre UN escenario con el código de hoy (o el del commit `ref`). Devuelve lo que pasó en cada registro. */
async function correrEscenario(esc, ref) {
  const datos = { usuarios: {}, dispositivosBeneficio: {}, viajes: {}, config: { global: { viajeGratisNuevoPasajero: true } } };
  const { fx, escrituras } = cargarDelCommit(datos, ref);
  const registros = [];
  for (const [que, uid, valor, aparato, op = {}] of esc.pasos) {
    if (que === 'miPerfil') { datos.usuarios[uid] = { ...datos.usuarios[uid], telefono: valor }; continue; }
    if (que === 'celularDirecto') { datos.usuarios[uid] = { ...datos.usuarios[uid], celular: valor }; continue; }
    if (que === 'huellaVieja') {
      datos.usuarios[uid] = { tipo: '', nombre: uid, celular: valor, descuentoPendiente: null };
      datos.dispositivosBeneficio[aparato] = { usado: true, uid, fecha: '2026-09-01T00:00:00.000Z' };
      continue;
    }
    // 'registro': como Login.js — pregunta (salvo que se la salte), guarda la ficha, pide la bienvenida.
    const llamada = (data) => ({ auth: { uid }, data });
    if (!op.salta) {
      const r = await fx.celularDisponible(llamada({ celular: celularDiezCifras(valor) }));
      if (!r.disponible) { registros.push({ uid, resultado: 'bloqueado' }); continue; }
    }
    const celular = op.guardaTal ? valor : celularDiezCifras(valor);
    datos.usuarios[uid] = { ...(datos.usuarios[uid] || { tipo: '', nombre: uid }), celular, ...(op.telefono ? { telefono: op.telefono } : {}) };
    let r;
    try { r = await fx.descuentoDeBienvenida(llamada({ deviceId: aparato })); } catch (e) { r = { error: e.message }; }
    aplicar(datos, escrituras);
    registros.push({ uid, resultado: r.error ? 'error: ' + r.error : r.valor, motivo: r.motivo });
  }
  const tels = Object.keys(datos.bienvenidaPorTelefono || {});
  return { registros, ultimo: registros[registros.length - 1], registroPorTelefono: tels };
}

async function correrCodigo(ref) {
  const salida = [];
  for (const esc of ESCENARIOS) salida.push({ esc, ...(await correrEscenario(esc, ref)) });
  return salida;
}

const cola = (t) => (t ? '…' + String(t).slice(-4) : '(vacío)');

/** Lo de producción. Solo lee. */
async function medirDatos() {
  const { traer, doc } = require('./nube.cjs');
  const [usuarios, huellas, viajes, registro] = await Promise.all([
    traer('usuarios'), traer('dispositivosBeneficio'), traer('viajes'),
    traer('bienvenidaPorTelefono').catch(() => []),
  ]).then((l) => l.map((x) => x.map(doc)));

  // Teléfonos en más de una ficha: cada ficha aporta su `celular` y su `telefono`, en 10 cifras.
  const fichasPorTel = {};
  const soloCelular = {};
  for (const u of usuarios) {
    const c = celularDiezCifras(u.celular), t = celularDiezCifras(u.telefono);
    for (const n of new Set([c, t].filter(Boolean))) (fichasPorTel[n] = fichasPorTel[n] || new Set()).add(u.id);
    if (c) (soloCelular[c] = soloCelular[c] || new Set()).add(u.id);
  }
  const repetidos = Object.entries(fichasPorTel).filter(([, s]) => s.size > 1);
  const repetidosCelular = Object.entries(soloCelular).filter(([, s]) => s.size > 1);
  const distintos = usuarios.filter((u) => celularDiezCifras(u.celular) && celularDiezCifras(u.telefono)
    && celularDiezCifras(u.celular) !== celularDiezCifras(u.telefono));

  // Quién ya recibió la bienvenida: la huella del aparato (G18), la ficha con BIENVENIDA, o un viaje que la llevó.
  const cobraron = new Set(huellas.map((h) => h.uid).filter(Boolean));
  for (const u of usuarios) if (u.descuentoPendiente && u.descuentoPendiente.promoId === 'BIENVENIDA') cobraron.add(u.id);
  for (const v of viajes) if (v.descuentoInfo && v.descuentoInfo.promoId === 'BIENVENIDA' && v.pasajeroId) cobraron.add(v.pasajeroId);
  const porId = Object.fromEntries(usuarios.map((u) => [u.id, u]));
  const aEscribir = {};
  const sinCelular = [];
  for (const uid of cobraron) {
    const n = celularDiezCifras((porId[uid] || {}).celular);
    if (!n) { sinCelular.push(uid); continue; }
    if (!aEscribir[n]) aEscribir[n] = uid;
  }

  console.log('\n2. DATOS (producción, solo lectura)');
  console.log('  fichas: ' + usuarios.length + ' · con `celular` y `telefono` distintos: ' + distintos.length);
  console.log('  teléfonos (10 cifras) que aparecen en MÁS DE UNA ficha, contando `celular` y `telefono`: ' + repetidos.length
    + (repetidos.length ? ' → ' + repetidos.map(([n, s]) => cola(n) + ' ×' + s.size).join(', ') : ''));
  console.log('  …y solo por `celular` (el del registro, el que mira celularDisponible): ' + repetidosCelular.length);
  console.log('  bienvenidas ya dadas: huellas de aparato ' + huellas.length + ' · personas distintas que la recibieron: '
    + cobraron.size + ' · de esas, sin un `celular` de 10 cifras en su ficha: ' + sinCelular.length);
  console.log('  registro `bienvenidaPorTelefono` en producción: ' + registro.length + ' documento(s)');
  console.log('  SIMULACRO (no escribe): llenar el registro con las bienvenidas ya dadas escribiría '
    + Object.keys(aEscribir).length + ' documento(s)'
    + (Object.keys(aEscribir).length ? ': ' + Object.keys(aEscribir).map(cola).join(', ') : ''));
  return { fichas: usuarios.length, repetidos: repetidos.length, repetidosCelular: repetidosCelular.length,
    cobraron: cobraron.size, sinCelular: sinCelular.length, simulacro: Object.keys(aEscribir).length, registro: registro.length };
}

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf('--commit');
  const ref = i >= 0 ? args[i + 1] : undefined;
  console.log('1. CÓDIGO ' + (ref ? 'del commit ' + ref : 'de hoy') + ' (ejecutado con la nube de mentira)');
  const salida = await correrCodigo(ref);
  let malos = 0;
  for (const s of salida) {
    const u = s.ultimo;
    const ok = u.resultado === s.esc.espera;
    if (!ok) malos += 1;
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + s.esc.nombre + (s.esc.honrado ? ' [honrado]' : ''));
    console.log('      ' + s.registros.map((r) => r.uid + ': ' + (r.resultado === 'bloqueado' ? 'registro bloqueado'
      : typeof r.resultado === 'number' ? '$' + r.resultado + (r.motivo ? ' (' + r.motivo + ')' : '') : r.resultado)).join(' → ')
      + ' · registro por teléfono: ' + (s.registroPorTelefono.length ? s.registroPorTelefono.map(cola).join(', ') : 'ninguno'));
  }
  console.log('  → ' + (salida.length - malos) + ' de ' + salida.length + ' escenarios como deben (' + malos + ' mal)');
  if (!args.includes('--sin-red')) await medirDatos();
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });

module.exports = { ESCENARIOS, correrEscenario, correrCodigo };
