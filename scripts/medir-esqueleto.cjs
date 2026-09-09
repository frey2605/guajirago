#!/usr/bin/env node
/**
 * EL ESQUELETO DE CADA NEGOCIO — SOLO LECTURA, no escribe nada.
 *
 *   node scripts/medir-esqueleto.cjs
 *
 * PASO 1 de los 10, del primer paso del plan de vender el software.
 * Se guarda porque el PASO 10 lo re-corre: contar dos veces con el mismo contador
 * es la única forma de saber que no se movió lo que no tocaba.
 *
 * ── QUÉ SE MIDE Y POR QUÉ ───────────────────────────────────────────────────
 * Decisión del dueño (6-sep-2026): el software de aliados se VENDE, y el
 * restaurante se queda DENTRO de aliados pero bien organizado.
 *
 * Lo primero que hace falta es que todo negocio tenga el mismo esqueleto. Hoy no
 * lo tiene: auditado ese día, de 25 campos solo 6 los tenían los tres negocios, y
 * `tipoNegocio` —el campo que dice si es restaurante o agencia— solo lo tenía UNO.
 *
 * Sin eso, cada pantalla y cada regla tiene que ADIVINAR con quién está tratando.
 * Y adivinar con tres negocios de prueba sale bien; con treinta clientes que pagan,
 * no.
 *
 * Este guion no propone nada: cuenta qué le falta a cada negocio para tener el
 * esqueleto completo, y de dónde se podría deducir lo que falta.
 *
 * ── LO QUE NO HACE ──────────────────────────────────────────────────────────
 * No escribe NINGÚN dato. Solo GET. El único POST es el de abrir la sesión contra
 * oauth2.googleapis.com, que no toca la base.
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

// EL ESQUELETO: lo que TODO aliado debería tener, sea del tipo que sea.
// Cada uno con lo que significa en cristiano, para que el informe se entienda.
const ESQUELETO = [
  ['tipoNegocio', 'qué es (restaurante, agencia…)'],
  ['nombre', 'cómo se llama'],
  ['fechaCreacion', 'desde cuándo existe'],
  ['activo', 'si está suspendido a mano'],
  ['aprobado', 'si usted lo aprobó'],
  ['estadoAprobacion', 'en qué punto de la aprobación va'],
];

// Las señales que delatan de qué tipo es un negocio que NO lo dice.
//
// SALEN DEL OTRO GUION, NO DE AQUÍ (SEGUNDA LEY). Este archivo tenía su propia
// lista y se había separado ya: la suya llevaba `costoEnvio` y la del otro no,
// así que los dos daban razones distintas para el mismo negocio. Y el PASO 10
// manda re-correr ESTE guion para comprobar lo que escribió el OTRO — o sea que
// se estaría comprobando con una calculadora distinta de la que decidió.
// Lo cazó la segunda opinión antes de aplicar nada. Ahora hay una sola.
const { SENALES: LISTAS } = require('./poner-tipo-negocio.cjs');
const SENALES = Object.entries(LISTAS)
  .flatMap(([tipo, campos]) => campos.map((c) => [c, tipo]));

(async () => {
  const t = await token();
  const r = await fetch(BASE + '/negocios?pageSize=300', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('no pude leer los negocios: ' + r.status);
  const docs = (await r.json()).documents || [];

  console.log('\n=== EL ESQUELETO · SOLO LECTURA · ' + new Date().toLocaleString('es-CO') + ' ===\n');
  console.log('negocios en el servidor: ' + docs.length + '\n');

  const faltantes = new Map(ESQUELETO.map(([c]) => [c, 0]));
  let completos = 0;

  for (const d of docs) {
    const f = d.fields || {};
    const id = d.name.split('/').pop();
    const nombre = val(f.nombre) || '(sin nombre)';

    const leFalta = ESQUELETO.filter(([c]) => !tiene(f, c));
    for (const [c] of leFalta) faltantes.set(c, faltantes.get(c) + 1);
    if (!leFalta.length) completos += 1;

    console.log('· ' + nombre + '   (' + id.slice(0, 14) + '…)');
    if (!leFalta.length) {
      console.log('    esqueleto COMPLETO');
    } else {
      console.log('    le faltan ' + leFalta.length + ' de ' + ESQUELETO.length + ':');
      for (const [c, que] of leFalta) console.log('      · ' + c.padEnd(18) + que);
    }

    // Si no dice qué es, ¿se puede deducir? Esto decide si el arreglo se puede
    // hacer solo o hay que preguntarle al dueño negocio por negocio.
    if (!tiene(f, 'tipoNegocio')) {
      const pistas = SENALES.filter(([campo]) => tiene(f, campo));
      const tipos = [...new Set(pistas.map(([, tipo]) => tipo))];
      if (tipos.length === 1) {
        console.log('    -> NO dice qué es, pero se deduce: ' + tipos[0].toUpperCase()
          + '   (por ' + pistas.map(([c]) => c).join(', ') + ')');
      } else if (tipos.length > 1) {
        console.log('    -> NO dice qué es, y las pistas se CONTRADICEN: ' + tipos.join(' y '));
        console.log('       hay que preguntarle al dueño por este.');
      } else {
        console.log('    -> NO dice qué es y NO HAY NINGUNA PISTA.');
        console.log('       hay que preguntarle al dueño por este.');
      }
    }
    console.log('');
  }

  console.log('───────────────────────────────────────────────────────────');
  console.log('con el esqueleto completo: ' + completos + ' de ' + docs.length);
  console.log('\nqué campo le falta a cuántos:');
  for (const [c, que] of ESQUELETO) {
    const n = faltantes.get(c);
    console.log('   ' + (n ? '⚠ ' : '  ') + String(n) + '/' + docs.length + '  '
      + c.padEnd(18) + que);
  }
  console.log('\nNO SE ESCRIBIÓ NADA. Este guion solo lee.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
