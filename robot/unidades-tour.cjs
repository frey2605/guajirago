#!/usr/bin/env node
// 🤖 «POR PERSONA / POR GRUPO / POR DÍA / POR HORA» DEL TOUR SALE DE UNA PIEZA — gemelo G86, 30-sep-2026.
// La lista estaba escrita a mano en la app del cliente (Turismo.js) y en aliados (Tours.js). Desde G86 vive en
// guajirago/src/unidadesTour.js, con copia idéntica en guajirago-aliados/src/unidadesTour.js. Aquí, en PRUEBAS:
//   1. a la agencia de prueba se le ponen CUATRO tours fijos, uno por unidad («Robot G86 persona», «… grupo», «… dia»,
//      «… hora»), y al final se le devuelven los tours que tenía (NO se deja nada cambiado);
//   2. aliados como la agencia → «Tours y alquileres»: se lee la unidad que dice cada tour, y se abre «+ Agregar tour o
//      alquiler» para leer las opciones del selector (NO guarda nada);
//   3. el pasajero de prueba → Turismo → «Agencia de Turismo de Prueba»: se lee la unidad de cada tarjeta.
//   Los tres tienen que decir «por persona», «por grupo», «por día» y «por hora», y el selector ofrecer esas cuatro.
//   node robot/unidades-tour.cjs
const { abrir, claveDePruebas, entrarALaBase, entrarComoRestaurante } = require('./comun.cjs');

const AGENCIA = 'negocios/prueba-agencia';
const UNIDADES = ['persona', 'grupo', 'dia', 'hora'];
const DICHOS = ['por persona', 'por grupo', 'por día', 'por hora'];
const nombreDe = (k) => 'Robot G86 ' + k;
const TOURS = UNIDADES.map((k, i) => ({
  id: 'robotG86_' + k, tipo: 'tour', nombre: nombreDe(k), descripcion: 'Tour de mentira del robot', precio: 10000 * (i + 1),
  unidadPrecio: k, duracion: '1 hora', categoria: 'Otro', cupoMax: 0, puntoEncuentro: '', incluye: [], imagen: '',
  destacado: false, disponible: true, vecesReservado: 0,
}));

// La unidad que acompaña al tour `nombre`: el <span> del renglón del precio que sigue a su nombre.
const unidadesEnPantalla = (p) => p.evaluate((nombres) => {
  const ps = [...document.querySelectorAll('p')];
  return nombres.map((n) => {
    const i = ps.findIndex((x) => x.textContent.trim().endsWith(n));
    if (i < 0) return null;
    const f = ps.slice(i + 1, i + 8).find((x) => x.querySelector(':scope > span') && /\$/.test(x.textContent));
    return f ? f.querySelector(':scope > span').textContent.trim() : null;
  });
}, UNIDADES.map(nombreDe));

async function verAliados() {
  const r = await abrir('aliados', { nombre: 'unidades-tour-agencia' });
  const p = r.pagina;
  try {
    await entrarComoRestaurante(p, 'agencia@gg.test');
    if (!(await p.getByText('Tours y alquileres', { exact: true }).first().isVisible().catch(() => false))) {
      await p.getByText(/Menú|☰/).first().click();
      await p.waitForTimeout(800);
    }
    await p.getByText('Tours y alquileres', { exact: true }).first().click();
    await p.waitForTimeout(4000);
    const lista = await unidadesEnPantalla(p);
    await r.captura('lista');
    await p.getByRole('button', { name: '+ Agregar tour o alquiler' }).click();
    await p.waitForTimeout(1500);
    const opciones = await p.evaluate(() => {
      const s = [...document.querySelectorAll('select')].find((x) => [...x.options].some((o) => o.value === 'persona'));
      return s ? [...s.options].map((o) => o.value + '=' + o.textContent.trim()) : null;
    });
    await r.captura('selector');
    return { lista, opciones, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

async function verApp() {
  const r = await abrir('transporte', { nombre: 'unidades-tour-cliente' });
  const p = r.pagina;
  try {
    await p.getByRole('button', { name: 'Ya tengo cuenta' }).click();
    await p.waitForTimeout(800);
    await p.fill('input[placeholder="Correo electrónico"]', 'pasajero@gg.test');
    await p.fill('input[placeholder="Contraseña"]', claveDePruebas());
    await p.getByRole('button', { name: /Entrar a GuajiraGo/ }).click();
    await p.waitForTimeout(8000);
    await p.getByText('Turismo', { exact: true }).first().click();
    await p.waitForTimeout(5000);
    await p.getByText('Agencia de Turismo de Prueba').first().click();
    await p.waitForTimeout(3000);
    const tarjetas = await unidadesEnPantalla(p);
    await r.captura('agencia');
    return { tarjetas, errores: r.errores, carpeta: r.carpeta };
  } finally { await r.cerrar(); }
}

(async () => {
  const fallos = [];
  const base = await entrarALaBase('agencia@gg.test');
  const antes = await base.leer(AGENCIA);
  const toursAntes = Array.isArray(antes.tours) ? antes.tours : [];
  let a = null; let c = null;
  try {
    await base.cambiar(AGENCIA, { tours: TOURS });
    a = await verAliados();
    c = await verApp();
  } finally {
    await base.cambiar(AGENCIA, { tours: toursAntes });
  }
  const despues = await base.leer(AGENCIA);
  const devueltos = JSON.stringify((despues.tours || []).map((t) => t.id)) === JSON.stringify(toursAntes.map((t) => t.id));

  const esperadas = UNIDADES.map((k, i) => k + '=' + DICHOS[i]);
  console.log('ALIADOS · lista de tours: ' + JSON.stringify(a.lista) + ' · capturas', a.carpeta);
  console.log('ALIADOS · selector: ' + JSON.stringify(a.opciones));
  console.log('APP · tarjetas de la agencia: ' + JSON.stringify(c.tarjetas) + ' · capturas', c.carpeta);
  if (JSON.stringify(a.lista) !== JSON.stringify(DICHOS)) fallos.push('la lista de aliados dice ' + JSON.stringify(a.lista) + ' y tenía que decir ' + JSON.stringify(DICHOS));
  if (JSON.stringify(a.opciones) !== JSON.stringify(esperadas)) fallos.push('el selector ofrece ' + JSON.stringify(a.opciones) + ' y tenía que ofrecer ' + JSON.stringify(esperadas));
  if (JSON.stringify(c.tarjetas) !== JSON.stringify(DICHOS)) fallos.push('la app dice ' + JSON.stringify(c.tarjetas) + ' y tenía que decir ' + JSON.stringify(DICHOS));
  console.log('TOURS DE LA AGENCIA: ' + toursAntes.length + ' antes, ' + (despues.tours || []).length + ' después · devueltos: ' + (devueltos ? 'sí' : 'NO'));
  if (!devueltos) fallos.push('no se le devolvieron a la agencia de prueba sus tours de antes');
  console.log('ERRORES DE LA PÁGINA:', [...a.errores, ...c.errores].join(' || ') || 'ninguno');
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ la app y aliados dicen la unidad del tour igual, y el selector ofrece las cuatro');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
