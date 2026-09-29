#!/usr/bin/env node
// 🤖 EL PANEL NO GUARDA UNA PLACA O UN VEHÍCULO QUE NO SIRVEN — gemelo G45 (28-sep-2026).
// El registro del conductor exige una placa de 6 letras o números y arma el vehículo «Marca Año»; hasta G45 la
// edición de la ficha en 🚗 Conductores del panel guardaba lo que se escribiera («AB 12», «hola»). Ahora las dos
// usan la regla de vehiculoConductor.js.
// Este recorrido entra al panel de PRUEBAS como admin@gg.test, abre la ficha del taxista de prueba (taxi@gg.test),
// y dos veces toca ✏️ Editar datos → escribe algo que no sirve → Guardar cambios:
//   1. placa «AB 12»   · 2. vehículo «hola»
// Exige que salga la ventanita que lo dice y que la ficha de la base NO cambie. Al final, pase lo que pase, deja
// placa, vehículo, marca y modelo como estaban. Solo toca la base de PRUEBAS.
//   node robot/placa-panel.cjs
const { abrir, claveDePruebas, entrarALaBase } = require('./comun.cjs');

const CAMPOS = ['placa', 'vehiculo', 'marca', 'modelo'];
const CASOS = [
  { etiqueta: 'PLACA', campo: 'placa', escrito: 'AB 12', aviso: 'Revisa la placa' },
  { etiqueta: 'VEHÍCULO', campo: 'vehiculo', escrito: 'hola', aviso: 'Revisa el vehículo' },
];

(async () => {
  const fallos = [];
  const taxi = await entrarALaBase('taxi@gg.test');
  const admin = await entrarALaBase('admin@gg.test');
  const ruta = 'usuarios/' + taxi.uid;
  const antes = await admin.leer(ruta);
  const como = {};
  for (const k of CAMPOS) como[k] = Object.prototype.hasOwnProperty.call(antes, k) ? antes[k] : null;
  console.log('FICHA DE PRUEBAS taxi@gg.test ANTES:', JSON.stringify(como));
  if (!antes.nombre) { console.log('🔴 el taxista de prueba no tiene nombre: no lo puedo buscar en el panel'); process.exit(1); }

  const r = await abrir('panel', { ancho: 1200, alto: 900, nombre: 'placa-panel' });
  const p = r.pagina;
  try {
    await p.locator('input[type="email"]').first().fill('admin@gg.test');
    await p.locator('input[type="password"]').first().fill(claveDePruebas());
    await p.getByText('Entrar al panel').click();
    await p.waitForTimeout(8000);
    // El menú del panel está ABAJO, con íconos; Conductores es el 🚗.
    await p.locator('button, div').filter({ hasText: /^🚗$/ }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText('Buscar', { exact: true }).first().click();
    await p.fill('input[placeholder="Nombre del conductor"]', antes.nombre.split(' ')[0]);
    await p.getByRole('button', { name: '🔍 Buscar' }).last().click();
    await p.waitForTimeout(3000);
    await p.getByText(new RegExp('^' + antes.nombre + '$', 'i')).first().click();
    await p.waitForTimeout(3000);

    for (const caso of CASOS) {
      await p.getByText('✏️ Editar datos').click();
      await p.waitForTimeout(800);
      const casilla = p.locator('p', { hasText: new RegExp('^' + caso.etiqueta + '$') }).locator('xpath=following-sibling::div[1]//input');
      await casilla.fill(caso.escrito);
      await p.getByText('Guardar cambios').click();
      await p.waitForTimeout(3000);
      await r.captura('despues-de-guardar-' + caso.campo);
      const texto = await r.texto();
      const salio = texto.includes(caso.aviso);
      const ficha = await admin.leer(ruta);
      const guardo = ficha[caso.campo] !== como[caso.campo];
      console.log(caso.etiqueta + ' «' + caso.escrito + '»: ventanita ' + (salio ? '«' + caso.aviso + '»' : 'NINGUNA')
        + ' · la ficha guarda ' + JSON.stringify(ficha[caso.campo]) + (guardo ? ' (CAMBIÓ)' : ' (como estaba)'));
      if (guardo) fallos.push('el panel guardó ' + caso.campo + ' «' + caso.escrito + '»');
      if (!salio) fallos.push('no salió la ventanita «' + caso.aviso + '» para ' + caso.campo + ' «' + caso.escrito + '»');
      // Cerrar lo que haya quedado abierto: la ventanita y la edición.
      if (salio) { await p.getByText('Entendido').click(); await p.waitForTimeout(500); }
      if (await p.getByText('Guardar cambios').count()) { await p.getByText('Cancelar', { exact: true }).first().click(); await p.waitForTimeout(500); }
      // Si se guardó (código de antes), se devuelve ya, para que el caso siguiente parta de la ficha buena.
      if (guardo) await admin.cambiar(ruta, como);
    }
  } finally {
    await admin.cambiar(ruta, como);
    const quedo = await admin.leer(ruta);
    const igual = CAMPOS.every((k) => (quedo[k] ?? null) === como[k]);
    console.log('FICHA DE PRUEBAS devuelta:', JSON.stringify(Object.fromEntries(CAMPOS.map((k) => [k, quedo[k] ?? null]))), igual ? '(como estaba)' : '🔴 NO quedó como estaba');
    if (!igual) fallos.push('la ficha no quedó como estaba');
    console.log('CAPTURAS:', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ el panel no guarda una placa ni un vehículo que no sirven, y lo dice en la ventanita');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
