#!/usr/bin/env node
// 🤖 «¿ME PUEDEN PEDIR AHORA?» — gemelo G47 (29-sep-2026).
// Antes el dueño (aliados) y el panel solo miraban la pausa a mano: fuera de horario la tarjeta del dueño decía
// «🟢 Abierto · Los clientes pueden pedirte» y el panel «🟢 Abierto», mientras el cliente veía «Cerrado».
// Ahora las tres usan la misma regla (horarioNegocio.js: candado + escaparate + pausa + horario).
// 1. Le pone al Restaurante de Prueba un horario que NO incluye la hora de ahora en Colombia.
//    · aliados (restaurante@gg.test): la tarjeta tiene que decir «🔴 Cerrado ahora» y «Estás fuera de tu horario…»;
//    · panel (admin@gg.test) → 🍽️ Restaurantes: el chip del Restaurante de Prueba tiene que decir «⚪ Fuera de horario».
// 2. Le devuelve el 0 y 0 (24 horas) y la tarjeta del dueño tiene que volver a «🟢 Abierto · Los clientes pueden pedirte»
//    y el chip del panel a «🟢 Abierto».
// Solo toca la base de PRUEBAS, y al final deja el horario como estaba.
//   node robot/pedir-ahora.cjs
const { abrir, claveDePruebas, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');

const RESTAURANTE = 'negocios/prueba-restaurante';
const horaColombia = () => new Date(Date.now() - 5 * 3600000).getUTCHours();

async function verDueno(nombre) {
  const r = await abrir('aliados', { nombre: 'pedir-ahora-dueno-' + nombre });
  try {
    await entrarComoRestaurante(r.pagina);
    await r.pagina.waitForTimeout(2000);
    await r.captura('tarjeta');
    const t = await r.texto();
    return { texto: t, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function verPanel(nombre) {
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'pedir-ahora-panel-' + nombre });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Restaurantes es el 🍽️.
    await p.locator('button, div').filter({ hasText: /^🍽️$/ }).last().click();
    await p.waitForTimeout(4000);
    await r.captura('lista');
    // El chip de «abierto» que va con la tarjeta del Restaurante de Prueba.
    const chip = await p.evaluate(() => {
      const nodos = [...document.querySelectorAll('p, span')];
      const i = nodos.findIndex((x) => x.textContent.trim() === 'Restaurante de Prueba');
      if (i < 0) return null;
      const f = nodos.slice(i, i + 8).find((x) => /^(🟢 Abierto|⚪ .+)$/.test(x.textContent.trim()));
      return f ? f.textContent.trim() : null;
    });
    return { chip, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const base = await entrarALaBase('restaurante@gg.test');
  const antes = await base.leer(RESTAURANTE);
  const como = { horarioApertura: antes.horarioApertura, horarioCierre: antes.horarioCierre };
  console.log('RESTAURANTE DE PRUEBA ANTES:', JSON.stringify(como), '· abierto', antes.abierto, '· estadoComercial', antes.estadoComercial);
  if (antes.abierto === false) fallos.push('el Restaurante de Prueba está pausado a mano: el recorrido necesita que no lo esté');

  const errores = [];
  const h = horaColombia();
  const abre = (h + 2) % 24;
  const cierra = (h + 4) % 24;
  try {
    await base.cambiar(RESTAURANTE, { horarioApertura: abre, horarioCierre: cierra });
    const d = await verDueno('fuera-de-horario');
    const pa = await verPanel('fuera-de-horario');
    errores.push(...d.errores, ...pa.errores);
    const cerrado = d.texto.includes('🔴 Cerrado ahora') && d.texto.includes('Estás fuera de tu horario: ahora no pueden pedirte');
    console.log('DE ' + abre + ' A ' + cierra + ' (en Colombia son las ' + h + '): el dueño ve ' + (cerrado ? '«🔴 Cerrado ahora · Estás fuera de tu horario…»' : 'OTRA COSA')
      + (d.texto.includes('Los clientes pueden pedirte') ? ' (y dice «Los clientes pueden pedirte»)' : '') + ' · el panel dice «' + pa.chip + '» · capturas', d.carpeta, pa.carpeta);
    if (!cerrado) fallos.push('fuera de horario la tarjeta del dueño no dice «🔴 Cerrado ahora · Estás fuera de tu horario…»');
    if (d.texto.includes('Los clientes pueden pedirte')) fallos.push('fuera de horario la tarjeta del dueño dice «Los clientes pueden pedirte»');
    if (pa.chip !== '⚪ Fuera de horario') fallos.push('fuera de horario el panel dice «' + pa.chip + '» y tiene que decir «⚪ Fuera de horario»');
  } finally {
    await base.cambiar(RESTAURANTE, { horarioApertura: 0, horarioCierre: 0 });
  }

  const d2 = await verDueno('24-horas');
  const pa2 = await verPanel('24-horas');
  errores.push(...d2.errores, ...pa2.errores);
  const abierto = d2.texto.includes('🟢 Abierto') && d2.texto.includes('Los clientes pueden pedirte');
  console.log('0 Y 0 (24 HORAS): el dueño ve ' + (abierto ? '«🟢 Abierto · Los clientes pueden pedirte»' : 'OTRA COSA') + ' · el panel dice «' + pa2.chip + '» · capturas', d2.carpeta, pa2.carpeta);
  if (!abierto) fallos.push('con 0 y 0 la tarjeta del dueño no dice «🟢 Abierto · Los clientes pueden pedirte»');
  if (pa2.chip !== '🟢 Abierto') fallos.push('con 0 y 0 el panel dice «' + pa2.chip + '» y tiene que decir «🟢 Abierto»');

  // Deja el horario como estaba (el sembrado lo pone en 0 y 0).
  if (como.horarioApertura !== 0 || como.horarioCierre !== 0) await base.cambiar(RESTAURANTE, como);
  const despues = await base.leer(RESTAURANTE);
  if (despues.horarioApertura !== como.horarioApertura || despues.horarioCierre !== como.horarioCierre) fallos.push('no pude devolverle su horario al Restaurante de Prueba');

  console.log('ERRORES DE LA PÁGINA:', errores.join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ fuera de horario el dueño y el panel dicen cerrado (como el cliente); con 24 horas dicen abierto');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
