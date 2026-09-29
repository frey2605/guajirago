#!/usr/bin/env node
// 🤖 «MIS VIAJES» Y «GANANCIAS» ABREN LO MISMO DESDE CUALQUIER SITIO — gemelo G51 (29-sep-2026).
// Hasta ese día «Mis viajes» abría una pantalla desde el menú de módulos (la de los dos lados, MisViajes.js) y otra
// desde el menú de Transporte (la del pasajero en Home.js, la del conductor en AppConductor.js); y «Ganancias», en el
// menú del pasajero, contestaba «Esta función estará disponible muy pronto». Ahora lo decide navegacionMenu.js según
// quién es la persona.
// Entra en PRUEBAS dos veces y toca los botones como una persona:
//   · pasajero@gg.test: «Mis viajes» del menú de módulos y del menú del pasajero → la MISMA pantalla (la del pasajero,
//     sin las etiquetas «Como pasajero / Como conductor» de la de los dos lados). «Ganancias» desde los dos menús →
//     la pantalla Ganancias, y ningún «muy pronto».
//   · taxi@gg.test: «Mis viajes» del menú de módulos, del menú del conductor y de su tarjeta «Mis viajes» → la MISMA
//     pantalla (la del conductor).
// «La misma» se mide con una firma de lo pintado: el texto de la pantalla y cuántos logos lleva (la de los dos lados
// lleva logo; la del conductor, no). No escribe nada: solo mira.
//   node robot/menu-navegacion.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

async function entrar(correo, nombre) {
  const r = await abrir('transporte', { nombre });
  const p = r.pagina;
  r.dialogos = [];
  p.on('dialog', async (d) => { r.dialogos.push(d.message()); await d.dismiss().catch(() => {}); });
  await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
  await p.waitForTimeout(800);
  await p.fill('input[placeholder="Correo electrónico"]', correo);
  await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
  await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
  await p.waitForTimeout(8000);
  return r;
}

async function firma(r) {
  const p = r.pagina;
  const texto = (await r.texto()).trim();
  const logos = await p.locator('svg[aria-label="GuajiraGo"]').count();
  const etiquetas = (texto.match(/Como (pasajero|conductor)/g) || []).length;
  return { texto, logos, etiquetas, clave: logos + '|' + texto };
}

async function delMenu(r, opcion, captura) {
  const p = r.pagina;
  await p.getByText('Menú').first().click();
  await p.waitForTimeout(800);
  await p.getByText(opcion, { exact: true }).first().click();
  await p.waitForTimeout(6000);
  await r.captura(captura);
  const f = await firma(r);
  const volver = p.getByText('Volver');
  if (await volver.count()) { await volver.first().click(); await p.waitForTimeout(2000); }
  return f;
}

async function entrarA(r, pasos) {
  const p = r.pagina;
  for (const paso of pasos) {
    const x = p.getByText(paso, { exact: true });
    if (await x.count()) { await x.first().click(); await p.waitForTimeout(3000); }
  }
  const entendido = p.getByRole('button', { name: 'Entendido' });
  if (await entendido.count()) { await entendido.first().click(); await p.waitForTimeout(500); }
}

const resumen = (n, f) => console.log('  ' + n + ': logos ' + f.logos + ' · etiquetas «Como …» ' + f.etiquetas + ' · «' + f.texto.slice(0, 70) + '…»');

(async () => {
  const fallos = [];

  // ── PASAJERO ──
  const a = await entrar('pasajero@gg.test', 'menu-navegacion-pasajero');
  try {
    console.log('pasajero@gg.test');
    const v1 = await delMenu(a, 'Mis viajes', 'pasajero-viajes-modulos');
    const g1 = await delMenu(a, 'Ganancias', 'pasajero-ganancias-modulos');
    await entrarA(a, ['Transporte y movilidad', 'Soy pasajero']);
    const v2 = await delMenu(a, 'Mis viajes', 'pasajero-viajes-transporte');
    const g2 = await delMenu(a, 'Ganancias', 'pasajero-ganancias-transporte');
    resumen('Mis viajes (módulos)   ', v1);
    resumen('Mis viajes (pasajero)  ', v2);
    resumen('Ganancias (módulos)    ', g1);
    resumen('Ganancias (pasajero)   ', g2);
    if (v1.clave !== v2.clave) fallos.push('pasajero: «Mis viajes» abre pantallas distintas desde módulos y desde su menú');
    if (v1.etiquetas || v2.etiquetas) fallos.push('pasajero: «Mis viajes» abre la de los dos lados («Como pasajero / Como conductor»), no la suya');
    if (/Aún no tienes viajes/.test(v2.texto)) fallos.push('pasajero: sale «Aún no tienes viajes» (¿el índice?)');
    for (const [n, g] of [['módulos', g1], ['pasajero', g2]]) {
      if (!/ESTA SEMANA/.test(g.texto)) fallos.push('pasajero: «Ganancias» del menú de ' + n + ' no abre la pantalla Ganancias');
    }
    const pronto = a.dialogos.filter((d) => /muy pronto/i.test(d));
    if (pronto.length) fallos.push('pasajero: el menú contestó «' + pronto[0] + '» (' + pronto.length + ' vez/veces)');
  } finally {
    console.log('  CAPTURAS:', a.carpeta);
    console.log('  ERRORES DE LA PÁGINA:', a.errores.join(' || ') || 'ninguno');
    await a.cerrar();
  }

  // ── CONDUCTOR ──
  const b = await entrar('taxi@gg.test', 'menu-navegacion-conductor');
  try {
    console.log('taxi@gg.test');
    const v1 = await delMenu(b, 'Mis viajes', 'conductor-viajes-modulos');
    await entrarA(b, ['Transporte y movilidad', 'Soy conductor']);
    const v2 = await delMenu(b, 'Mis viajes', 'conductor-viajes-menu');
    const g2 = await delMenu(b, 'Ganancias', 'conductor-ganancias-menu');
    resumen('Mis viajes (módulos)   ', v1);
    resumen('Mis viajes (conductor) ', v2);
    const tarjeta = b.pagina.getByText('Ver historial y ganancias');
    let v3 = null;
    if (await tarjeta.count()) {
      await tarjeta.first().click();
      await b.pagina.waitForTimeout(6000);
      await b.captura('conductor-viajes-tarjeta');
      v3 = await firma(b);
      resumen('Mis viajes (tarjeta)   ', v3);
    } else {
      console.log('  (la tarjeta «Mis viajes» no sale: el conductor está en turno)');
    }
    if (v1.clave !== v2.clave) fallos.push('conductor: «Mis viajes» abre pantallas distintas desde módulos y desde su menú');
    if (v3 && v3.clave !== v2.clave) fallos.push('conductor: la tarjeta «Mis viajes» abre otra pantalla que el menú');
    if (v1.etiquetas || v2.etiquetas) fallos.push('conductor: «Mis viajes» abre la de los dos lados, no la suya');
    if (!/ESTA SEMANA/.test(g2.texto)) fallos.push('conductor: «Ganancias» no abre la pantalla Ganancias');
    const pronto = b.dialogos.filter((d) => /muy pronto/i.test(d));
    if (pronto.length) fallos.push('conductor: el menú contestó «' + pronto[0] + '»');
  } finally {
    console.log('  CAPTURAS:', b.carpeta);
    console.log('  ERRORES DE LA PÁGINA:', b.errores.join(' || ') || 'ninguno');
    await b.cerrar();
  }

  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ')
    : '✓ «Mis viajes» y «Ganancias» abren la misma pantalla desde cualquier sitio, y ninguna dice «muy pronto»');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
