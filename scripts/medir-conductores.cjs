#!/usr/bin/env node
/**
 * MEDIR LA PANTALLA DE CONDUCTORES — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-conductores.cjs
 *
 * PASO 1 de los 10. Se guarda porque el PASO 10 lo vuelve a correr: contar dos
 * veces con el mismo contador es la única forma de saber que no se movió nada
 * que no tocaba.
 *
 * ── POR QUÉ SE MIDE ESTO ────────────────────────────────────────────────────
 * guajirago-admin/src/Conductores.js tiene DOCE escrituras que no le dicen NADA
 * al dueño si el servidor las rechaza. En todo el archivo hay 0 `setAviso`,
 * 0 `alert` y 0 `apuntarRechazo`. Cuatro llevan `catch (e) { console.error(e); }`
 * —rastro en la consola, cero en pantalla— y ocho no llevan `catch` ninguno.
 *
 * Antes de tocar nada hay que saber CUÁNTO pesa: cuántos conductores hay, a
 * cuántos se les ha sancionado de verdad, y cuántas apelaciones están esperando
 * respuesta. Un arreglo se justifica con un número, no con una corazonada.
 *
 * ── QUÉ CAMPOS SE MIRAN, Y POR QUÉ ESOS ─────────────────────────────────────
 * Son exactamente los que escriben las doce, leídos del propio archivo:
 *   · activo, sancionHasta, sanciones      -> sancionar (r299) y reactivar (r307)
 *   · llamadosAtencion, llamadoPendiente   -> el llamado de atención (r321)
 *   · mensajesApelacion                    -> contestar la apelación (r517)
 *   · fechaArchivado                       -> archivar al conductor (r767)
 * La consulta es la misma que usa la pantalla: usuarios con tipo == 'conductor'
 * (Conductores.js:150). Si se midiera con otra, se estaría midiendo otra cosa.
 *
 * NO ESCRIBE NINGÚN DATO. Los datos solo se LEEN, con GET a /documents/usuarios.
 * No hay ni un PATCH, ni un DELETE, ni un :commit, ni un :batchWrite.
 *
 * SÍ hay UN POST, y hay que decirlo: el del renglón ~51, a oauth2.googleapis.com,
 * que es abrir la sesión para poder leer. No toca la base. (La primera versión de
 * este comentario decía «no hay un solo POST» y era FALSO; lo cazó la segunda
 * opinión. Un comentario que el archivo desmiente es peor que no ponerlo.)
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const val = (v) => v == null ? undefined
  : v.stringValue ?? v.booleanValue ?? (v.integerValue != null ? Number(v.integerValue) : undefined);
const lista = (v) => (v && v.arrayValue && v.arrayValue.values) ? v.arrayValue.values : [];
const tiene = (f, k) => Object.prototype.hasOwnProperty.call(f, k);

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 200));
  return x.access_token;
}

// Trae TODOS los usuarios, pasando página a página. Sin esto, con más de 300
// usuarios la cuenta saldría corta y nadie se enteraría.
async function traerUsuarios(t) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/usuarios?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) throw new Error('no pude leer los usuarios: ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

(async () => {
  const t = await token();
  const usuarios = await traerUsuarios(t);

  console.log('\n=== MEDIDA · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===\n');
  console.log('usuarios en el servidor: ' + usuarios.length);

  const conductores = usuarios.filter((d) => val((d.fields || {}).tipo) === 'conductor');
  console.log('de esos, conductores (tipo == "conductor"): ' + conductores.length + '\n');

  const cuenta = {
    inactivos: 0, conSancionHasta: 0, sancionVigente: 0,
    conSanciones: 0, sancionesTotal: 0,
    conLlamados: 0, llamadosTotal: 0, llamadoPendiente: 0,
    conApelaciones: 0, apelacionesTotal: 0,
    archivados: 0,
  };
  const ahora = new Date();
  const detalle = [];

  for (const d of conductores) {
    const f = d.fields || {};
    const nombre = val(f.nombre) || '(sin nombre)';
    const activo = val(f.activo);
    const hasta = val(f.sancionHasta);
    const sanciones = lista(f.sanciones);
    const llamados = lista(f.llamadosAtencion);
    const apelaciones = lista(f.mensajesApelacion);

    if (activo === false) cuenta.inactivos += 1;
    if (hasta) {
      cuenta.conSancionHasta += 1;
      if (new Date(hasta) > ahora) cuenta.sancionVigente += 1;
    }
    if (sanciones.length) { cuenta.conSanciones += 1; cuenta.sancionesTotal += sanciones.length; }
    if (llamados.length) { cuenta.conLlamados += 1; cuenta.llamadosTotal += llamados.length; }
    if (tiene(f, 'llamadoPendiente') && val(f.llamadoPendiente)) cuenta.llamadoPendiente += 1;
    if (apelaciones.length) { cuenta.conApelaciones += 1; cuenta.apelacionesTotal += apelaciones.length; }
    if (tiene(f, 'fechaArchivado')) cuenta.archivados += 1;

    const marcas = [];
    if (activo === false) marcas.push('INACTIVO');
    if (hasta) marcas.push('sancionHasta=' + String(hasta).slice(0, 16));
    if (sanciones.length) marcas.push(sanciones.length + ' sanción(es)');
    if (llamados.length) marcas.push(llamados.length + ' llamado(s)');
    if (apelaciones.length) marcas.push(apelaciones.length + ' apelación(es)');
    if (tiene(f, 'fechaArchivado')) marcas.push('ARCHIVADO');
    if (marcas.length) detalle.push('  · ' + nombre.padEnd(24) + marcas.join('  ·  '));
  }

  console.log('LO QUE ESCRIBEN LAS DOCE, contado en la base de verdad:');
  console.log('  sancionar / reactivar');
  console.log('    inactivos (activo == false):        ' + cuenta.inactivos);
  console.log('    con sancionHasta puesto:            ' + cuenta.conSancionHasta
    + '   (vigente ahora mismo: ' + cuenta.sancionVigente + ')');
  console.log('    con historial de sanciones:         ' + cuenta.conSanciones
    + '   (sanciones en total: ' + cuenta.sancionesTotal + ')');
  console.log('  llamado de atención');
  console.log('    con llamados:                       ' + cuenta.conLlamados
    + '   (llamados en total: ' + cuenta.llamadosTotal + ')');
  console.log('    con llamado SIN VER:                ' + cuenta.llamadoPendiente);
  console.log('  apelaciones');
  console.log('    con mensajes de apelación:          ' + cuenta.conApelaciones
    + '   (mensajes en total: ' + cuenta.apelacionesTotal + ')');
  console.log('  archivar');
  console.log('    archivados (fechaArchivado):        ' + cuenta.archivados);

  if (detalle.length) {
    console.log('\nUNO POR UNO, los que tienen algo:');
    detalle.forEach((l) => console.log(l));
  } else {
    console.log('\nNINGÚN conductor tiene nada de esto puesto todavía.');
  }

  console.log('\n───────────────────────────────────────────────────────────');
  console.log('NO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
