#!/usr/bin/env node
// 🤖 LOS DÍAS DE LA PROMOCIÓN SALEN DE UNA PIEZA — gemelo G87, 30-sep-2026.
// El mapa número → día («Lun», «Mié»…) estaba escrito a mano en la app (Restaurantes.js) y en aliados
// (Promociones.js), y los botones L M M J V S D una tercera vez. Desde G87 vive en guajirago/src/diasSemana.js, con
// copia idéntica en guajirago-aliados/src/diasSemana.js. Aquí, en PRUEBAS:
//   1. al restaurante de prueba se le ponen DOS promociones fijas: «Robot G87 semana» (10 %, todos los días, encendida)
//      y «Robot G87 tres» (lunes, miércoles y viernes, apagada), y al final se le devuelven las que tenía;
//   2. aliados → «Promociones»: se lee el «📅 …» de cada una, y se abre «+ Crear promoción» → «Días» para leer los
//      botones (NO guarda nada);
//   3. el pasajero de prueba → Restaurantes → Restaurante de Prueba: se lee el «🏷️ Robot G87 semana · …» de un plato.
//   node robot/dias-promocion.cjs
const { abrir, claveDePruebas, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');

const NEGOCIO = 'negocios/prueba-restaurante';
const SEMANA = 'Dom, Lun, Mar, Mié, Jue, Vie, Sáb';
const TRES = 'Lun, Mié, Vie';
const BOTONES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const base0 = { tipo: 'porcentaje', valor: 10, codigo: '', descripcion: 'Promo de mentira del robot', platosAplica: [], programacion: 'dias', fechaInicio: '', fechaFin: '', limiteCliente: 0 };
const PROMOS = [
  { id: 'robotG87_semana', activa: true, nombre: 'Robot G87 semana', dias: [0, 1, 2, 3, 4, 5, 6], ...base0 },
  { id: 'robotG87_tres', activa: false, nombre: 'Robot G87 tres', dias: [5, 1, 3], ...base0 },
];

async function verAliados() {
  const r = await abrir('aliados', { nombre: 'dias-promocion-restaurante' });
  const p = r.pagina;
  try {
    await entrarComoRestaurante(p);
    if (!(await p.getByText('Promociones', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Promociones', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    // El «📅 …» que sale en cada tarjeta (el elemento más hondo cuyo texto empieza por 📅).
    const lista = await p.evaluate(() => [...document.querySelectorAll('span, p, div')]
      .filter((x) => x.children.length === 0 && x.textContent.trim().startsWith('📅'))
      .map((x) => x.textContent.trim()));
    await r.captura('lista');
    await p.getByRole('button', { name: '+ Crear promoción' }).click();
    await p.waitForTimeout(1200);
    await p.getByRole('button', { name: 'Días', exact: true }).click();
    await p.waitForTimeout(800);
    const botones = await p.evaluate(() => {
      const dias = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Días');
      const fila = dias && dias.parentElement && dias.parentElement.nextElementSibling;
      return fila ? [...fila.querySelectorAll('button')].map((b) => b.textContent.trim()) : null;
    });
    await r.captura('botones');
    return { lista, botones, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function verApp() {
  const r = await abrir('transporte', { nombre: 'dias-promocion-cliente' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Restaurantes', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    await p.getByText('Restaurante de Prueba').first().click();
    await p.waitForTimeout(3000);
    const etiqueta = await p.evaluate(() => {
      const e = [...document.querySelectorAll('p')].find((x) => x.textContent.includes('🏷️ Robot G87 semana'));
      return e ? e.textContent.trim() : null;
    });
    await r.captura('platos');
    return { etiqueta, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const base = await entrarALaBase('restaurante@gg.test');
  const antes = await base.leer(NEGOCIO);
  const promosAntes = Array.isArray(antes.promociones) ? antes.promociones : [];
  let a = null; let c = null;
  try {
    await base.cambiar(NEGOCIO, { promociones: PROMOS });
    a = await verAliados();
    c = await verApp();
  } finally {
    await base.cambiar(NEGOCIO, { promociones: promosAntes });
  }
  const despues = await base.leer(NEGOCIO);
  const devueltas = JSON.stringify((despues.promociones || []).map((x) => x.id)) === JSON.stringify(promosAntes.map((x) => x.id));

  console.log('ALIADOS · lista de promos: ' + JSON.stringify(a.lista) + ' · capturas', a.carpeta);
  console.log('ALIADOS · botones de días: ' + JSON.stringify(a.botones));
  console.log('APP · etiqueta del plato: ' + JSON.stringify(c.etiqueta) + ' · capturas', c.carpeta);
  if (JSON.stringify(a.lista) !== JSON.stringify(['📅 ' + SEMANA, '📅 ' + TRES])) fallos.push('la lista de aliados dice ' + JSON.stringify(a.lista) + ' y tenía que decir «📅 ' + SEMANA + '» y «📅 ' + TRES + '»');
  if (JSON.stringify(a.botones) !== JSON.stringify(BOTONES)) fallos.push('los botones de días son ' + JSON.stringify(a.botones) + ' y tenían que ser ' + BOTONES.join(' '));
  if (c.etiqueta !== '🏷️ Robot G87 semana · ' + SEMANA) fallos.push('la app dice ' + JSON.stringify(c.etiqueta) + ' y tenía que decir «🏷️ Robot G87 semana · ' + SEMANA + '»');
  console.log('PROMOCIONES DEL RESTAURANTE: ' + promosAntes.length + ' antes, ' + (despues.promociones || []).length + ' después · devueltas: ' + (devueltas ? 'sí' : 'NO'));
  if (!devueltas) fallos.push('no se le devolvieron al restaurante de prueba sus promociones de antes');
  console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...c.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la app y aliados dicen los días de la promoción igual, y los botones son L M M J V S D');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
