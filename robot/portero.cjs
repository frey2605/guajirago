#!/usr/bin/env node
// 🤖 EL PORTERO (App Check) — SOLO LECTURA. Le pregunta a Google cuántas llamadas llegaron a la
// base, a los archivos y al inicio de sesión de PRUEBAS en las últimas horas, y cuántas traían
// el sello válido de la app. Se corre DESPUÉS de un recorrido del robot: si el portero funciona,
// todo lo que hizo el robot llega con sello.
//
// 🔑 Las llamadas DIRECTAS del robot (las que miran la base sin pasar por la app, robot/comun.cjs →
// entrarALaBase) no pueden llevar sello: llegan a Google como «sin origen». El robot las anota en su
// cuaderno (CUADERNO, en la carpeta temporal del PC), y aquí se descuentan: si las «sin origen» no pasan
// de las anotadas, son del robot y no es alarma. Lo demás —sellos INVÁLIDOS, o más «sin origen» de las
// que anotó el robot— sí lo es (27-sep-2026).
//   node robot/portero.cjs [horas]
const fs = require('fs');
const { token } = require('../scripts/nube.cjs');

const PROYECTO = 'guajirago-pruebas';
const SIN_ORIGEN = 'MISSING_UNKNOWN_ORIGIN';

/** Cuántas llamadas directas anotó el robot en su cuaderno desde `desdeMs`, por servicio. */
function directasDelRobot(textoCuaderno, desdeMs) {
  const c = {};
  for (const l of String(textoCuaderno || '').split(/\r?\n/)) {
    const [hora, servicio] = l.trim().split(' ');
    if (!servicio || !(Date.parse(hora) >= desdeMs)) continue;
    c[servicio] = (c[servicio] || 0) + 1;
  }
  return c;
}

/** El juicio: qué es del robot y qué es alarma. `cuenta` = { servicio: { sello: n } }. */
function juzgar(cuenta, directas) {
  const alarmas = [];
  const delRobot = [];
  for (const [serv, c] of Object.entries(cuenta)) {
    for (const [sello, n] of Object.entries(c)) {
      if (sello === 'VALID' || !n) continue;
      if (sello === SIN_ORIGEN) {
        const delMio = Math.min(n, directas[serv] || 0);
        if (delMio) delRobot.push(serv + ': ' + delMio + ' sin origen, del robot mirando la base');
        if (n > delMio) alarmas.push(serv + ': ' + (n - delMio) + ' llamadas sin origen que el robot NO hizo (alguien habla con la base sin pasar por la app)');
      } else {
        alarmas.push(serv + ': ' + n + ' llamadas con sello ' + sello + ' (llegan desde la app pero su sello no sirve)');
      }
    }
  }
  return { alarmas, delRobot };
}

async function main() {
  const { CUADERNO } = require('./comun.cjs');
  const horas = Number(process.argv[2]) || 3;
  const { permiso } = await token();
  const H = { Authorization: 'Bearer ' + permiso, 'x-goog-user-project': PROYECTO };
  const fin = new Date();
  const ini = new Date(Date.now() - horas * 3600e3);
  const q = 'https://monitoring.googleapis.com/v3/projects/' + PROYECTO + '/timeSeries?filter='
    + encodeURIComponent('metric.type="firebaseappcheck.googleapis.com/services/verdict_count"')
    + '&interval.startTime=' + ini.toISOString() + '&interval.endTime=' + fin.toISOString();
  const s = await (await fetch(q, { headers: H })).json();
  if (s.error) throw new Error(JSON.stringify(s.error).slice(0, 300));
  const cuenta = {};
  for (const ts of s.timeSeries || []) {
    const servicio = ts.resource.labels.service_id.split('.')[0];
    const sello = ts.metric.labels.security || '?';
    const total = ts.points.reduce((a, pt) => a + Number(pt.value.int64Value || 0), 0);
    cuenta[servicio] = cuenta[servicio] || {};
    cuenta[servicio][sello] = (cuenta[servicio][sello] || 0) + total;
  }
  console.log('Llamadas a PRUEBAS en las últimas ' + horas + ' h, por sello (VALID = con sello bueno):');
  if (!Object.keys(cuenta).length) console.log('  ninguna todavía (hay que abrir la app o correr un recorrido)');
  for (const [serv, c] of Object.entries(cuenta)) console.log('  ' + serv.padEnd(18) + JSON.stringify(c));
  const cuaderno = fs.existsSync(CUADERNO) ? fs.readFileSync(CUADERNO, 'utf8') : '';
  const { alarmas, delRobot } = juzgar(cuenta, directasDelRobot(cuaderno, ini.getTime()));
  for (const d of delRobot) console.log('  · ' + d);
  for (const a of alarmas) console.log('  ⚠ ' + a);
  // El veredicto va SIEMPRE en la última línea, en una sola: robot/probar-cambio.cjs copia solo esa.
  console.log(alarmas.length ? '⚠ SIN SELLO VÁLIDO: ' + alarmas.join(' · ') : '✓ todas con sello válido (o del robot mirando la base)');
}

if (require.main === module) main().catch((e) => { console.log('🔴 ' + e.message); process.exit(1); });
module.exports = { juzgar, directasDelRobot, SIN_ORIGEN };
