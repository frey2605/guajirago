#!/usr/bin/env node
// 🤖 EL PORTERO (App Check) — SOLO LECTURA. Le pregunta a Google cuántas llamadas llegaron a la
// base, a los archivos y al inicio de sesión de PRUEBAS en las últimas horas, y cuántas traían
// el sello válido de la app. Se corre DESPUÉS de un recorrido del robot: si el portero funciona,
// todo lo que hizo el robot llega con sello.
//   node robot/portero.cjs [horas]
const { token } = require('../scripts/nube.cjs');

const PROYECTO = 'guajirago-pruebas';
const horas = Number(process.argv[2]) || 3;

(async () => {
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
  const sinSello = Object.values(cuenta).reduce((a, c) => a + Object.entries(c).filter(([k]) => k !== 'VALID').reduce((x, [, v]) => x + v, 0), 0);
  console.log(sinSello ? '⚠ ' + sinSello + ' llamadas SIN sello válido: alguien habla con la base sin pasar por la app' : '✓ todas con sello válido');
})().catch((e) => { console.log('🔴 ' + e.message); process.exit(1); });
