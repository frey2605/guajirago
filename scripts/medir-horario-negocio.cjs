#!/usr/bin/env node
/**
 * 🕗 ¿ESTÁ ABIERTO AHORA? — gemelo G46 (28-sep-2026). SOLO LECTURA.
 *
 * Qué cuenta:
 *   1. LOS DATOS (Firestore VIVO, producción): cada negocio con su hora de abrir y de cerrar. Cuántos no tienen
 *      horario, cuántos abren y cierran a la MISMA hora, cuántos cruzan la medianoche, cuántos tienen una hora que no
 *      es un número de 0 a 23, y cuántos están pausados a mano. No enseña nombres: solo el comienzo del id.
 *   2. EL CÓDIGO (sin red): saca de cada pantalla la regla que usa —la lista de restaurantes (Restaurantes.js) y la de
 *      agencias (Turismo.js)— y la CORRE a las 24 horas de un día de Colombia, con el teléfono en hora de Colombia y
 *      con el teléfono en UTC. Dice en cuántas horas las dos pantallas no dicen lo mismo, y en cuántas una pantalla
 *      cambia de respuesta solo por la zona del teléfono. Lo hace con los negocios de producción y con casos de
 *      mentira (misma hora, 0 y 0 como el negocio de pruebas, normal, cruza la medianoche, sin horario, pausado).
 *      Con `--commit <hash>` corre el código de ese commit: así se carea el de antes con el de ahora.
 *
 * Uso:  node scripts/medir-horario-negocio.cjs [--commit <hash>] [--solo-codigo]
 * No escribe nada. Usa la casa común de datos (scripts/nube.cjs).
 */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { cargarDeLaApp, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');

const RAIZ = path.join(__dirname, '..');
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const COMMIT = arg('--commit');

function textoDe(ruta, commit) {
  if (!commit) {
    const p = path.join(RAIZ, ruta);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
  }
  try {
    return execFileSync('git', ['-C', RAIZ, 'show', commit + ':' + ruta], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}

/** Un reloj parado en `t` para el código que hace `new Date()` sin argumentos. */
const RealDate = Date;
const relojEn = (t) => class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(t.getTime()); }
  static now() { return t.getTime(); }
};

function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

/** `const <nombre> = (x) => {…}` o `=> expresión` sacado del texto, como texto de función. */
function flechaDelTexto(texto, nombre) {
  const t = texto.replace(/\r\n/g, '\n');
  const marca = 'const ' + nombre + ' = ';
  const d = t.indexOf(marca);
  if (d < 0) return null;
  const flecha = t.indexOf('=>', d);
  const tras = t.slice(flecha + 2).trimStart();
  if (tras.startsWith('{')) return t.slice(d + marca.length, cuerpoDeLaFuncion(t, d).fin + 1);
  return t.slice(d + marca.length, t.indexOf(';\n', flecha));
}

/**
 * La regla que usa una pantalla, lista para correr: (negocio, instante) → true/false.
 * · si la pantalla importa `negocioAbiertoAhora` de la pieza única, se corre la pieza (del mismo commit);
 * · si no, se saca su función propia del archivo y se corre con el reloj parado en ese instante.
 */
function reglaDe(pantalla, commit) {
  const texto = textoDe(pantalla, commit);
  if (texto == null) throw new Error('no está ' + pantalla + (commit ? ' en ' + commit : ''));
  // G47 (29-sep-2026): las pantallas usan ya la pregunta ENTERA, «¿me pueden pedir ahora?» (candado + escaparate +
  // pausa + horario). Aquí se mide solo el horario, así que se le da un negocio que SÍ sale en la lista (ficha llena):
  // los que no salen no se le enseñan al cliente, y eso lo mide scripts/medir-pedir-ahora.cjs.
  if (/import \{[^}]*\bsePuedePedirAhora\b[^}]*\} from '\.\/horarioNegocio'/.test(texto)) {
    const ruta = 'guajirago/src/horarioNegocio.js';
    const pieza = cargarDeLaApp(ruta, textoDe(ruta, commit));
    return { como: 'la pieza única (horarioNegocio.js, sePuedePedirAhora)', correr: (n, t) => pieza.sePuedePedirAhora({ perfilCompleto: true, ...n }, t) };
  }
  if (/import \{[^}]*\bnegocioAbiertoAhora\b[^}]*\} from '\.\/horarioNegocio'/.test(texto)) {
    const ruta = 'guajirago/src/horarioNegocio.js';
    const fuente = textoDe(ruta, commit);
    const pieza = cargarDeLaApp(ruta, fuente);
    return { como: 'la pieza única (horarioNegocio.js)', correr: (n, t) => pieza.negocioAbiertoAhora(n, t) };
  }
  // El código de antes: Restaurantes.js tenía `dentroHorario` + `restauranteAbiertoAhora`; Turismo.js `abiertaAhora`.
  const dentro = flechaDelTexto(texto, 'dentroHorario');
  const resto = flechaDelTexto(texto, 'restauranteAbiertoAhora');
  const agencia = flechaDelTexto(texto, 'abiertaAhora');
  let cuerpo;
  let como;
  if (dentro && resto) {
    cuerpo = 'const dentroHorario = ' + dentro + ';\nreturn (' + resto + ')(n);';
    como = 'su propia regla (dentroHorario)';
  } else if (agencia) {
    cuerpo = 'return (' + agencia + ')(n);';
    como = 'su propia regla (abiertaAhora)';
  } else {
    throw new Error('no encuentro la regla de «¿abierto ahora?» en ' + pantalla);
  }
  // eslint-disable-next-line no-new-func
  const f = new Function('Date', 'n', cuerpo);
  return { como, correr: (n, t) => f(relojEn(t), n) };
}

// Las 24 horas de un día de Colombia (a y media, para no caer en el borde).
const HORAS = Array.from({ length: 24 }, (_, h) => new Date('2026-10-07T' + String(h).padStart(2, '0') + ':30:00-05:00'));

const CASOS = [
  ['abre y cierra a la misma hora (8 y 8)', { horarioApertura: 8, horarioCierre: 8 }],
  ['0 y 0, como el negocio de pruebas', { horarioApertura: 0, horarioCierre: 0 }],
  ['normal, de 8 a 22', { horarioApertura: 8, horarioCierre: 22 }],
  ['cruza la medianoche, de 18 a 2', { horarioApertura: 18, horarioCierre: 2 }],
  ['sin horario', {}],
  ['pausado a mano, de 8 a 22', { horarioApertura: 8, horarioCierre: 22, abierto: false }],
];

function careo(reglas, negocio) {
  const r = { distintas: 0, porZona: 0, abiertasCol: {} };
  for (const [nombre, regla] of Object.entries(reglas)) r.abiertasCol[nombre] = 0;
  for (const t of HORAS) {
    const enCol = {};
    for (const [nombre, regla] of Object.entries(reglas)) {
      const col = enZona('America/Bogota', () => regla.correr(negocio, t));
      const utc = enZona('UTC', () => regla.correr(negocio, t));
      enCol[nombre] = col;
      if (col) r.abiertasCol[nombre] += 1;
      if (col !== utc) r.porZona += 1;
    }
    if (enCol.restaurante !== enCol.agencia) r.distintas += 1;
  }
  return r;
}

async function main() {
  console.log('\n🕗 ¿ESTÁ ABIERTO AHORA? — gemelo G46 · código ' + (COMMIT ? 'del commit ' + COMMIT : 'del disco') + '\n');

  const reglas = {
    restaurante: reglaDe('guajirago/src/Restaurantes.js', COMMIT),
    agencia: reglaDe('guajirago/src/Turismo.js', COMMIT),
  };
  console.log('  Lista de restaurantes usa: ' + reglas.restaurante.como);
  console.log('  Lista de agencias usa:     ' + reglas.agencia.como + '\n');

  let totalDistintas = 0;
  let totalZona = 0;
  console.log('  CASOS DE MENTIRA (24 horas de Colombia; «horas abierto» con el teléfono en Colombia):');
  for (const [nombre, n] of CASOS) {
    const r = careo(reglas, n);
    totalDistintas += r.distintas;
    totalZona += r.porZona;
    console.log('   · ' + nombre.padEnd(40) + ' restaurante ' + String(r.abiertasCol.restaurante).padStart(2) + ' h · agencia '
      + String(r.abiertasCol.agencia).padStart(2) + ' h · no coinciden en ' + r.distintas + ' h · respuestas (pantalla × hora) que cambian con la zona del teléfono: ' + r.porZona);
  }

  if (!process.argv.includes('--solo-codigo')) {
    const { traer, doc } = require('./nube.cjs');
    const negocios = (await traer('negocios')).map(doc);
    const cuenta = { total: negocios.length, sinHorario: 0, mismaHora: 0, cruza: 0, normal: 0, raros: 0, pausados: 0 };
    const esHora = (v) => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 23 && v !== '' && v !== null;
    console.log('\n  LOS DATOS (producción, colección negocios):');
    let datosDistintas = 0;
    let datosZona = 0;
    for (const n of negocios) {
      const a = n.horarioApertura;
      const c = n.horarioCierre;
      let clase;
      if (a === undefined || c === undefined) clase = 'sinHorario';
      else if (!esHora(a) || !esHora(c) || typeof a !== 'number' || typeof c !== 'number') clase = 'raros';
      else if (a === c) clase = 'mismaHora';
      else if (a > c) clase = 'cruza';
      else clase = 'normal';
      cuenta[clase] += 1;
      if (n.abierto === false) cuenta.pausados += 1;
      const r = careo(reglas, n);
      datosDistintas += r.distintas;
      datosZona += r.porZona;
      console.log('   · ' + String(n.id).slice(0, 6) + '… ' + String(n.tipoNegocio || '(sin tipo)').padEnd(12) + ' abre ' + JSON.stringify(a) + ' cierra '
        + JSON.stringify(c) + (n.abierto === false ? ' · PAUSADO' : '') + ' → no coinciden en ' + r.distintas + ' h, respuestas que cambian con la zona: ' + r.porZona);
    }
    console.log('\n   negocios: ' + cuenta.total + ' · sin horario ' + cuenta.sinHorario + ' · misma hora ' + cuenta.mismaHora + ' · cruzan la medianoche '
      + cuenta.cruza + ' · normales ' + cuenta.normal + ' · hora rara (no es número de 0 a 23) ' + cuenta.raros + ' · pausados ' + cuenta.pausados);
    console.log('   con los negocios de producción: las dos pantallas no coinciden en ' + datosDistintas + ' horas; respuestas (pantalla × hora) que cambian con la zona del teléfono: ' + datosZona);
  }

  console.log('\n  VEREDICTO (casos de mentira): ' + (totalDistintas === 0 && totalZona === 0
    ? '✓ las dos pantallas dicen lo mismo a todas horas, y la zona del teléfono no cambia nada'
    : '🔴 las dos pantallas no coinciden en ' + totalDistintas + ' horas, y la zona del teléfono cambia ' + totalZona + ' respuestas (pantalla × hora)') + '\n');
}

module.exports = { reglaDe, careo, CASOS, HORAS };

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
