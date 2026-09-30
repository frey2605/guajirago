#!/usr/bin/env node
// 🤖 🍽️ RESTAURANTES Y 🧭 TURISMO DEL PANEL, UNA SOLA PANTALLA — gemelo G89 (30-sep-2026).
// Hasta ese día eran dos archivos casi iguales (Restaurantes.js y Turismo.js); ahora es NegociosDeUnTipo.js con lo
// propio de cada tipo en tiposDeNegocio.js. Este recorrido entra al panel de PRUEBAS como superadmin (admin@gg.test)
// y, en cada uno de los dos módulos, mira lo que ve una persona: el menú lateral (RESTAURANTES / TURISMO), «Todos» o
// «Todas», el Resumen con sus cinco números, Pendientes, la lista (que el número del título cuadre con las tarjetas) y
// la ficha del primer negocio (sus secciones y sus botones). Al final pasa de 🍽️ Restaurantes (con una ficha abierta)
// a 🧭 Turismo por el menú del panel, sin volver al inicio: tiene que salir TURISMO con sus agencias, no la ficha
// del restaurante (App.js monta la pantalla con `key` = el tipo). NO aprieta ningún botón que escribe: solo mira.
//   node robot/pantallas-negocios.cjs                       (mira y dice ✓ o 🔴)
//   node robot/pantallas-negocios.cjs --guardar <archivo>   (y guarda lo que vio, para comparar antes/después)
//   node robot/pantallas-negocios.cjs --comparar <archivo>  (y lo compara con lo guardado: tiene que ser lo mismo)
const fs = require('fs');
const { abrir, claveDePruebas } = require('./comun.cjs');

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };

const MODULOS = [
  { icono: '🍽️', lateral: 'RESTAURANTES', todos: 'Todos', titulo: /🍽️ Todos los restaurantes \((\d+)\)/,
    kpis: ['TOTAL', 'APROBADOS', 'PENDIENTES', 'ABIERTOS AHORA', 'PEDIDOS HOY'], pendientes: /Restaurantes pendientes \(\d+\)/,
    ficha: ['🍽️ Menú (', '🧾 Pedidos recientes', '🧾 Pedidos hoy:', '🕒 Registrado:', '💬 WhatsApp'], tarjeta: /\d+ platos/ },
  { icono: '🧭', lateral: 'TURISMO', todos: 'Todas', titulo: /🧭 Todas las agencias \((\d+)\)/,
    kpis: ['AGENCIAS', 'APROBADAS', 'PENDIENTES', 'TOURS/ALQUILERES', 'RESERVAS HOY'], pendientes: /Agencias pendientes \(\d+\)/,
    ficha: ['🧭 Tours y alquileres (', '📅 Reservas recientes', '📅 Reservas hoy:', '🕒 Registrada:', '💬 WhatsApp'], tarjeta: /\d+ tours\/alquileres/ },
];

(async () => {
  const fallos = [];
  const visto = {};
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'pantallas-negocios' });
  const p = r.pagina;
  const lado = () => p.locator('.gg-mod-navitems').first().innerText();
  const contenido = () => p.locator('.gg-mod > div').nth(1).innerText();
  const irA = async (icono) => { await p.locator('button, div').filter({ hasText: new RegExp('^' + icono + '$') }).last().click(); await p.waitForTimeout(5000); };
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    for (const m of MODULOS) {
      await irA(m.icono);
      const nav = await lado();
      visto[m.lateral + ' · menú'] = nav;
      if (!nav.includes(m.lateral)) fallos.push(m.icono + ': el menú lateral no dice ' + m.lateral);
      if (!nav.split('\n').map((s) => s.trim()).includes(m.todos)) fallos.push(m.icono + ': el menú lateral no dice «' + m.todos + '»');
      // La lista (sección de entrada).
      const lista = await contenido();
      visto[m.lateral + ' · lista'] = lista;
      const t = lista.match(m.titulo);
      const tarjetas = p.locator('div[style*="cursor: pointer"]').filter({ hasText: m.tarjeta });
      const n = await tarjetas.count();
      if (!t) fallos.push(m.icono + ': la lista no tiene su título («' + m.titulo.source + '»)');
      else if (Number(t[1]) !== n) fallos.push(m.icono + ': el título dice ' + t[1] + ' y hay ' + n + ' tarjetas');
      await r.captura(m.lateral + '-lista');
      // Resumen.
      await p.locator('.gg-mod-navitems > div').nth(0).click();
      await p.waitForTimeout(800);
      const resumen = await contenido();
      visto[m.lateral + ' · resumen'] = resumen;
      for (const k of m.kpis) if (!resumen.includes(k)) fallos.push(m.icono + ' Resumen: falta «' + k + '»');
      await r.captura(m.lateral + '-resumen');
      // Pendientes.
      await p.locator('.gg-mod-navitems > div').nth(2).click();
      await p.waitForTimeout(800);
      const pend = await contenido();
      visto[m.lateral + ' · pendientes'] = pend;
      if (!m.pendientes.test(pend)) fallos.push(m.icono + ' Pendientes: no dice «' + m.pendientes.source + '»');
      // La ficha del primero.
      await p.locator('.gg-mod-navitems > div').nth(1).click();
      await p.waitForTimeout(800);
      if (n) {
        await tarjetas.first().click();
        await p.waitForTimeout(1200);
        const ficha = await contenido();
        visto[m.lateral + ' · ficha'] = ficha;
        for (const k of m.ficha) if (!ficha.includes(k)) fallos.push(m.icono + ' ficha: falta «' + k + '»');
        if (!/✅ Aprobar|🚫 Suspender/.test(ficha)) fallos.push(m.icono + ' ficha: no tiene ni «✅ Aprobar» ni «🚫 Suspender»');
        await r.captura(m.lateral + '-ficha');
      } else fallos.push(m.icono + ': no hay ningún negocio en la lista de pruebas: la ficha no se pudo mirar');
    }
    // De 🍽️ (con una ficha abierta) a 🧭 por el menú del panel, sin pasar por el inicio.
    await irA('🍽️');
    const primera = p.locator('div[style*="cursor: pointer"]').filter({ hasText: MODULOS[0].tarjeta }).first();
    if (await primera.count()) { await primera.click(); await p.waitForTimeout(1200); }
    await irA('🧭');
    const nav = await lado();
    const tras = await contenido();
    visto['de 🍽️ a 🧭'] = nav + '\n' + tras;
    if (!nav.includes('TURISMO') || nav.includes('RESTAURANTES')) fallos.push('de 🍽️ a 🧭: el menú lateral no dice TURISMO');
    if (!MODULOS[1].titulo.test(tras)) fallos.push('de 🍽️ a 🧭: no sale la lista de agencias (sigue la ficha o la lista de antes)');
    await r.captura('de-restaurantes-a-turismo');
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  const guardar = arg('--guardar');
  if (guardar) { fs.writeFileSync(guardar, JSON.stringify(visto, null, 1)); console.log('guardado lo visto en ' + guardar); }
  const comparar = arg('--comparar');
  if (comparar) {
    const antes = JSON.parse(fs.readFileSync(comparar, 'utf8'));
    const claves = [...new Set([...Object.keys(antes), ...Object.keys(visto)])];
    const distintas = claves.filter((k) => antes[k] !== visto[k]);
    console.log('careo con lo guardado: ' + claves.length + ' vistas, ' + distintas.length + ' distintas');
    for (const k of distintas) fallos.push('se ve distinto que antes: «' + k + '»');
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ 🍽️ Restaurantes y 🧭 Turismo del panel se ven como deben (' + Object.keys(visto).length + ' vistas)');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
