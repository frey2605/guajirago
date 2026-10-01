#!/usr/bin/env node
/**
 * 🚕 ¿QUIÉN PUEDE LEER LOS VIAJES DEL MERCADO (los que buscan conductor)? — SOLO LECTURA.
 *
 * Pasos 1 y 12 de P20 (1-oct-2026). Un viaje en el mercado (estado `esperando`) lleva el nombre, el correo y las
 * coordenadas del pasajero, su origen y su destino (`armarViajeNuevo`, viajeNuevo.js) y, si es un mandado, el nombre y
 * el teléfono de quien recibe. Hasta P20 lo podía leer cualquiera con sesión, no solo los conductores. Este guion dice:
 *   · REGLAS: con qué condición se lee el mercado (cualquiera con sesión / solo conductores / nadie), y cómo saben las
 *     reglas que alguien es conductor;
 *   · CÓDIGO: qué pantallas de las apps de usuario (app y aliados) piden la LISTA del mercado (un `where('estado'…)`
 *     sobre `viajes`), y cuáles piden la lista de sus propios viajes;
 *   · con --publicado: cuántas consultas del mercado hay en los paquetes PUBLICADOS (app de producción y de pruebas,
 *     aliados y panel);
 *   · con --nube: en producción, cuántos viajes hay en el mercado ahora, qué datos del pasajero lleva un viaje, y —lo que
 *     decide si el arreglo deja a alguien sin mercado— cuántos conductores NO tienen `tipo: 'conductor'` en su ficha;
 *   · con --commit <hash>: las reglas y el código de la app de ese commit (careo antes/después).
 *
 *   node scripts/medir-mercado-viajes.cjs [--commit <hash>] [--publicado] [--nube]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./medir-lectura-ajena.cjs');
const U = require('./medir-ubicacion-conductor.cjs');

const RAIZ = path.resolve(__dirname, '..');

/** La condición de lectura de un viaje (`/viajes/{viajeId}`), en un renglón. */
function condicionDelViaje(reglas) {
  const c = L.lecturasDeLasReglas(reglas).filter((l) => l.ruta === '/viajes/{viajeId}' && l.ops.includes('read')).map((l) => l.condicion);
  return c.join(' | ');
}

/** El cuerpo de una función de las reglas (sin comentarios), o null. */
function cuerpoDe(reglas, nombre) {
  const t = L.sinComentarios(reglas.replace(/\r\n/g, '\n'));
  const m = new RegExp('function\\s+' + nombre + '\\s*\\(\\)\\s*\\{([\\s\\S]*?)\\}').exec(t);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

/**
 * ¿Quién lee el mercado? 'cualquiera con sesión' | 'solo conductores' | 'nadie' | 'otro: …'.
 * Solo conductores = `enElMercado()` va SIEMPRE junto a `esConductor()` con un «y», y `esConductor()` pregunta por la
 * ficha de quien llama (`usuarios/{uid}`, campo `tipo` == 'conductor'), la misma marca que usa el servidor.
 */
function quienLeeElMercado(reglas) {
  const c = condicionDelViaje(reglas).replace(/\s+/g, '');
  if (!c) return 'nadie';
  if (!c.includes('enElMercado()')) return 'nadie';
  const sueltos = c.split('enElMercado()').length - 1;
  const atados = (c.match(/esConductor\(\)&&enElMercado\(\)|enElMercado\(\)&&esConductor\(\)/g) || []).length;
  if (atados < sueltos) return 'cualquiera con sesión';
  const marca = (cuerpoDe(reglas, 'esConductor') || '').replace(/\s+/g, '');
  if (!marca.includes('documents/usuarios/$(request.auth.uid)') || !marca.includes(".data.get('tipo','')=='conductor'")) return 'otro: esConductor() = ' + (marca || 'NO EXISTE');
  return 'solo conductores';
}

/** Renglones que piden viajes: { mercado: [...], suyos: [...] }. Un comentario no cuenta. */
function consultasDeViajes(texto) {
  const r = { mercado: [], suyos: [] };
  texto.replace(/\r\n/g, '\n').split('\n').forEach((l, i) => {
    const codigo = l.replace(/^\s*(\/\/|\*|\/\*).*$/, '').replace(/\s\/\/\s.*$/, '');
    if (!/collection\(\s*\w+\s*,\s*['"`]viajes['"`]\s*\)/.test(codigo)) return;
    if (/where\(\s*['"`]estado['"`]/.test(codigo)) r.mercado.push(i + 1);
    else if (/where\(\s*['"`](pasajeroId|conductorId)['"`]\s*,\s*['"`]==['"`]/.test(codigo)) r.suyos.push(i + 1);
  });
  return r;
}

/** En un paquete minificado: consultas a `viajes` filtradas por estado. */
function mercadoEnElPaquete(texto) {
  let n = 0;
  const re = /["'`]viajes["'`]\)/g;
  let m;
  while ((m = re.exec(texto))) if (/^\)?,\s*\w+\(\s*["'`]estado["'`]\s*,/.test(texto.slice(m.index + 8, m.index + 60))) n += 1;
  return n;
}

// Lo que un viaje dice de su PASAJERO (o de quien recibe el mandado).
const DEL_PASAJERO = ['pasajeroId', 'pasajeroNombre', 'pasajeroEmail', 'pasajeroTelefono', 'pasajeroLat', 'pasajeroLng', 'origen', 'destino', 'pasajeroFcmToken', 'descuentoInfo'];
function datosDelPasajero(viajes) {
  const r = { viajes: viajes.length };
  for (const k of DEL_PASAJERO) r[k] = viajes.filter((v) => v[k] !== undefined && v[k] !== null && v[k] !== '').length;
  r['mensajeria.recibeTel'] = viajes.filter((v) => v.mensajeria && v.mensajeria.recibeTel).length;
  r['mensajeria.recibeNombre'] = viajes.filter((v) => v.mensajeria && v.mensajeria.recibeNombre).length;
  const otros = new Set();
  for (const v of viajes) for (const k of Object.keys(v)) if (/pasajero|cliente|token/i.test(k) && !DEL_PASAJERO.includes(k)) otros.add(k);
  r.otros = [...otros].sort();
  return r;
}

/**
 * Conductores que el arreglo dejaría SIN mercado: los que manejan (ficha en `conductores`, placa o tipo de vehículo en
 * su ficha, o algún viaje como conductor) y cuya ficha NO dice `tipo: 'conductor'`.
 */
function conductoresSinMarca({ usuarios, conductores, viajes }) {
  const porUid = new Map(usuarios.map((u) => [u.id, u]));
  const manejan = new Set([
    ...conductores.map((c) => c.id),
    ...usuarios.filter((u) => u.placa || u.tipoVehiculo).map((u) => u.id),
    ...viajes.map((v) => v.conductorId).filter(Boolean),
  ]);
  const sin = [...manejan].filter((uid) => (porUid.get(uid) || {}).tipo !== 'conductor');
  return { manejan: manejan.size, conMarca: usuarios.filter((u) => u.tipo === 'conductor').length, sin };
}

function veredicto({ quien, mercadoUsuario }) {
  const v = [];
  if (quien === 'cualquiera con sesión') v.push('🔴 los viajes del mercado (nombre, correo y coordenadas del pasajero) los lee cualquiera con sesión, no solo los conductores');
  if (quien.startsWith('otro')) v.push('🔴 no reconozco cómo deciden las reglas quién es conductor: ' + quien);
  if (quien === 'nadie' && mercadoUsuario.length) v.push('🔴 la app pide el mercado y las reglas no se lo dejan leer a nadie: el conductor lo vería vacío');
  return v;
}

async function main() {
  const i = process.argv.indexOf('--commit');
  const commit = i >= 0 ? process.argv[i + 1] : null;
  const reglas = commit ? execFileSync('git', ['show', commit + ':firestore.rules'], { cwd: RAIZ, encoding: 'utf8' }) : fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8');
  const quien = quienLeeElMercado(reglas);
  const mercadoUsuario = [];
  const suyos = [];
  for (const f of U.archivosDeUsuario(commit)) {
    const c = consultasDeViajes(f.texto());
    for (const n of c.mercado) mercadoUsuario.push(f.rel + ':' + n);
    for (const n of c.suyos) suyos.push(f.rel + ':' + n);
  }
  const panel = [];
  if (!commit) {
    for (const f of fs.readdirSync(path.join(RAIZ, 'guajirago-admin/src')).filter((x) => /\.js$/.test(x) && !/\.test\.js$/.test(x))) {
      for (const n of consultasDeViajes(fs.readFileSync(path.join(RAIZ, 'guajirago-admin/src', f), 'utf8')).mercado) panel.push('guajirago-admin/src/' + f + ':' + n);
    }
  }
  console.log('── LOS VIAJES DEL MERCADO · ' + (commit || 'hoy') + ' ──');
  console.log('  reglas · quién lee un viaje del mercado: ' + quien);
  console.log('  reglas · condición: ' + condicionDelViaje(reglas));
  console.log('  código · pantallas de usuario que piden la LISTA del mercado: ' + (mercadoUsuario.join(' · ') || 'ninguna'));
  console.log('  código · pantallas de usuario que piden SUS viajes: ' + (suyos.join(' · ') || 'ninguna'));
  if (!commit) console.log('  código · el panel (entra como admin) filtra viajes por estado en: ' + (panel.join(' · ') || 'ninguna'));
  if (process.argv.includes('--publicado')) {
    for (const sitio of ['guajirago', 'guajirago-pruebas', 'guajirago-aliados', 'guajirago-admin']) {
      const p = await L.paquete(sitio); // eslint-disable-line no-await-in-loop
      console.log('  publicado · ' + sitio + '.web.app (' + p.nombre.split('/').pop() + '): consultas de viajes por estado ' + mercadoEnElPaquete(p.texto)
        + ' · nombra "viajes" ' + L.vecesEnPaquete(p.texto, 'viajes'));
    }
  }
  if (process.argv.includes('--nube')) {
    const N = require('./nube.cjs');
    const viajes = (await N.traer('viajes')).map(N.doc);
    const usuarios = (await N.traer('usuarios')).map(N.doc);
    const conductores = (await N.traer('conductores')).map(N.doc);
    const enMercado = viajes.filter((v) => v.estado === 'esperando');
    console.log('  producción · viajes en el mercado ahora: ' + enMercado.length + ' (de ' + viajes.length + ')');
    const d = datosDelPasajero(viajes);
    console.log('  producción · de los ' + d.viajes + ' viajes, llevan: ' + DEL_PASAJERO.concat(['mensajeria.recibeNombre', 'mensajeria.recibeTel']).map((k) => k + ' ' + d[k]).join(', '));
    if (d.otros.length) console.log('  producción · otros campos del pasajero: ' + d.otros.join(', '));
    const s = conductoresSinMarca({ usuarios, conductores, viajes });
    console.log('  producción · personas que manejan: ' + s.manejan + ' · fichas con tipo «conductor»: ' + s.conMarca + ' · manejan SIN la marca (se quedarían sin mercado): ' + s.sin.length + (s.sin.length ? ' (' + s.sin.join(', ') + ')' : ''));
    if (N.tiposQueNoSupe().length) console.log('  ⚠ tipos de campo que no supe leer: ' + N.tiposQueNoSupe().join(', '));
  }
  const v = veredicto({ quien, mercadoUsuario });
  console.log('\n── VEREDICTO ──\n  ' + (v.length ? v.join('\n  ') : '✓ el mercado solo lo leen los conductores (su pasajero y el panel leen el suyo / todos)'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { condicionDelViaje, cuerpoDe, quienLeeElMercado, consultasDeViajes, mercadoEnElPaquete, datosDelPasajero, conductoresSinMarca, veredicto };
