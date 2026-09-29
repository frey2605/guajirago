#!/usr/bin/env node
// 🤖 «¿ABIERTA AHORA?» DE LA AGENCIA Y DEL RESTAURANTE — gemelo G46 (29-sep-2026).
// En la base de PRUEBAS la agencia y el restaurante de prueba abren y cierran a la MISMA hora (0 y 0: así los siembra
// scripts/sembrar-pruebas.cjs, y quiere decir «abierto las 24 horas»).
// 1. Entra como el pasajero de prueba (pasajero@gg.test) → Turismo: la tarjeta de «Agencia de Turismo de Prueba» tiene
//    que decir «Abierta ahora». Antes de G46 decía «Cerrada ahora» a toda hora (la lista de agencias leía la misma hora
//    como cerrado), mientras el restaurante con 0 y 0 salía abierto.
// 2. Vuelve y entra a Restaurantes: «Restaurante de Prueba» tiene que decir «Abierto ahora» (lo mismo que la agencia).
// 3. La agencia (agencia@gg.test) cambia su horario a uno que NO incluye la hora de ahora EN COLOMBIA; el pasajero vuelve
//    a Turismo y la tarjeta tiene que decir «Cerrada ahora» (la regla sigue cerrando fuera de horario). Al final se le
//    devuelve el 0 y 0.
//   node robot/horario-agencia.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CORREO = 'pasajero@gg.test';
const AGENCIA = 'negocios/prueba-agencia';

// La hora de ahora en Colombia (UTC−5 todo el año), la misma idea que hoyEnColombia.
const horaColombia = () => new Date(Date.now() - 5 * 3600000).getUTCHours();

async function entrar(p) {
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', CORREO);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
}

// El texto de la tarjeta que lleva `nombre`: el renglón de «abierta/cerrada» que va con él.
const estadoDe = (p, nombre, patron) => p.evaluate(([n, pat]) => {
  const re = new RegExp(pat);
  const nodos = [...document.querySelectorAll('p, span')];
  const i = nodos.findIndex((x) => x.textContent.trim() === n || x.textContent.includes(n));
  if (i < 0) return null;
  const f = nodos.slice(i, i + 8).find((x) => re.test(x.textContent));
  return f ? f.textContent.trim() : null;
}, [nombre, patron]);

async function verTurismo(nombre) {
  const r = await abrir('transporte', { nombre: 'horario-agencia-' + nombre });
  const p = r.pagina;
  try {
    await entrar(p);
    await p.getByText('Turismo', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    const agencia = await estadoDe(p, 'Agencia de Turismo de Prueba', 'Abierta ahora|Cerrada ahora');
    await r.captura('turismo');
    let restaurante = null;
    if (nombre === 'misma-hora') {
      const r2 = await abrir('transporte', { nombre: 'horario-restaurante' });
      try {
        await entrar(r2.pagina);
        await r2.pagina.getByText('Restaurantes', { exact: true }).first().click();
        await r2.pagina.waitForTimeout(5000);
        restaurante = await estadoDe(r2.pagina, 'Restaurante de Prueba', 'Abierto ahora|Cerrado ahora');
        await r2.captura('restaurantes');
      } finally { await r2.cerrar(); }
    }
    return { agencia, restaurante, errores: r.errores, carpeta: r.carpeta };
  } finally {
    await r.cerrar();
  }
}

(async () => {
  const fallos = [];
  const base = await entrarALaBase('agencia@gg.test');
  const antes = await base.leer(AGENCIA);
  if (antes.horarioApertura !== 0 || antes.horarioCierre !== 0) {
    console.log('⚠ la agencia de prueba no estaba en 0 y 0 (' + antes.horarioApertura + ' y ' + antes.horarioCierre + '): la pongo en 0 y 0');
    await base.cambiar(AGENCIA, { horarioApertura: 0, horarioCierre: 0 });
  }

  const a = await verTurismo('misma-hora');
  console.log('0 Y 0 (24 HORAS): la agencia dice «' + a.agencia + '» · el restaurante dice «' + a.restaurante + '» · capturas', a.carpeta);
  if (a.agencia !== 'Abierta ahora') fallos.push('con 0 y 0 la agencia dice «' + a.agencia + '» y tiene que decir «Abierta ahora» (24 horas)');
  if (a.restaurante !== 'Abierto ahora') fallos.push('con 0 y 0 el restaurante dice «' + a.restaurante + '» y tiene que decir «Abierto ahora»');

  let b = { agencia: null, errores: [] };
  const h = horaColombia();
  const abre = (h + 2) % 24;
  const cierra = (h + 4) % 24;
  try {
    await base.cambiar(AGENCIA, { horarioApertura: abre, horarioCierre: cierra });
    b = await verTurismo('fuera-de-horario');
    console.log('DE ' + abre + ' A ' + cierra + ' (en Colombia son las ' + h + '): la agencia dice «' + b.agencia + '» · capturas', b.carpeta);
    if (b.agencia !== 'Cerrada ahora') fallos.push('fuera de horario (' + abre + ' a ' + cierra + ', son las ' + h + ') la agencia dice «' + b.agencia + '»');
  } finally {
    await base.cambiar(AGENCIA, { horarioApertura: 0, horarioCierre: 0 });
    const despues = await base.leer(AGENCIA);
    if (despues.horarioApertura !== 0 || despues.horarioCierre !== 0) fallos.push('no pude devolverle el 0 y 0 a la agencia de prueba');
  }

  console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...b.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ con la misma hora la agencia y el restaurante salen abiertos; fuera de horario la agencia sale cerrada');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
