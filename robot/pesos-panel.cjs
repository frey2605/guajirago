#!/usr/bin/env node
// 🤖 LA PLATA DEL PANEL SE ESCRIBE CON cop(), AUNQUE EL COMPUTADOR ESTÉ EN INGLÉS — gemelo G14 (28-sep-2026).
// Entra al panel de pruebas como superadmin (admin@gg.test) con el navegador «en inglés» (`toLocaleString()` sin
// idioma escribe como en Estados Unidos: «125,500»), va a 👑 Superadmin → «Ingresos reales» y «Control de
// créditos», y lee la pantalla: la plata tiene que salir como la escribe cop() («$ 800», «$ 125.500», con el
// espacio) y NUNCA pegada («$800») ni con comas de mil («$125,500»). Antes de G14 salía «$125,500». Solo lee.
//   node robot/pesos-panel.cjs
const { abrir, claveDePruebas } = require('./comun.cjs');

// Un computador en inglés: el número sin idioma se escribe como en Estados Unidos.
const antesDeCargar = '(' + (() => {
  const original = Number.prototype.toLocaleString;
  // eslint-disable-next-line no-extend-native
  Number.prototype.toLocaleString = function (loc, op) { return original.call(this, loc || 'en-US', op); };
}) + ')();';

const ESPACIO = '[ ' + String.fromCharCode(160) + ']'; // cop() separa con un espacio duro; el navegador puede dar uno normal
const MAL = /\$\d/g; // el signo pegado al número: «$800», «$125,500»
const BIEN = new RegExp('\\$' + ESPACIO + '\\d{1,3}(\\.\\d{3})*(?!\\d)', 'g'); // como cop(): «$ 800», «$ 125.500»

(async () => {
  const fallos = [];
  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'pesos-panel', antesDeCargar });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(6000);
    const ingles = await p.evaluate(() => (125500).toLocaleString());
    console.log('EL NAVEGADOR ESCRIBE 125500 COMO:', ingles);
    if (ingles !== '125,500') fallos.push('el navegador no quedó «en inglés» (' + ingles + '): la prueba no probaría nada');
    // El menú del panel está ABAJO, con íconos; Superadmin es el 👑.
    await p.locator('button, div').filter({ hasText: /^👑$/ }).last().click();
    await p.waitForTimeout(3000);
    const SECCIONES = [
      ['Ingresos reales', new RegExp('mototaxi \\$' + ESPACIO + '\\d')],
      ['Control de créditos', new RegExp('CRÉDITOS EN CIRCULACIÓN\\s*\\$' + ESPACIO + '\\d')],
    ];
    for (const [seccion, debe] of SECCIONES) {
      await p.getByText(seccion, { exact: true }).first().click();
      await p.waitForTimeout(6000);
      await r.captura(seccion.replace(/\s+/g, '-').toLowerCase());
      const t = await r.texto();
      const malos = t.match(MAL) || [];
      const buenos = t.match(BIEN) || [];
      console.log(seccion.toUpperCase() + ': ' + buenos.length + ' cifra(s) como cop() · ' + malos.length + ' a mano · ej. ' + (buenos.slice(0, 3).join(' | ') || '—'));
      if (!debe.test(t)) fallos.push(seccion + ': no encuentro la cifra esperada escrita como cop() (' + debe + ')');
      if (malos.length) fallos.push(seccion + ': plata escrita a mano en pantalla: ' + [...new Set(t.match(/\$\d[\d.,]*/g))].slice(0, 5).join(', '));
    }
  } finally {
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el panel escribe la plata con cop() aunque el computador esté en inglés');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
