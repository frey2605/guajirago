#!/usr/bin/env node
// 🤖 LAS PÁGINAS LEGALES SE VEN COMO ANTES Y DICEN EL CORREO DE SOPORTE — gemelo G75 (29-sep-2026).
// Abre la app de transporte de PRUEBAS sin entrar a ninguna cuenta: «Crear cuenta» →
//   1. toca «Términos y condiciones»: tiene que salir la página con su título, «Última actualización», las 11
//      secciones y el correo de soporte una vez; «‹ Volver» regresa al registro.
//   2. lo mismo con «Política de privacidad» (el correo sale dos veces: «7. Tus derechos» y «11. Contacto»).
// No llena ni envía nada: no crea cuentas ni toca la base.
//   node robot/paginas-legales.cjs
const { abrir } = require('./comun.cjs');

const CORREO = 'soporte@guajirago.com.co';
const PAGINAS = [
  { enlace: 'Términos y condiciones', ultima: '11. Contacto', correos: 1, nombre: 'terminos' },
  { enlace: 'Política de privacidad', ultima: '11. Contacto', correos: 2, nombre: 'privacidad' },
];

(async () => {
  const fallos = [];
  const r = await abrir('transporte', { nombre: 'paginas-legales' });
  const p = r.pagina;
  try {
    await p.waitForTimeout(3000);
    await p.getByRole('button', { name: 'Crear cuenta' }).click();
    await p.waitForTimeout(1500);

    for (const pg of PAGINAS) {
      await p.getByText(pg.enlace, { exact: true }).first().click();
      await p.waitForTimeout(1200);
      await r.captura(pg.nombre);
      const t = await r.texto();
      const secciones = (t.match(/^\s*\d{1,2}\. /gm) || []).length;
      const correos = t.split(CORREO).length - 1;
      const bien = t.includes(pg.enlace) && t.includes('Última actualización: junio de 2026') && t.includes(pg.ultima)
        && secciones === 11 && correos === pg.correos;
      console.log(pg.enlace.toUpperCase() + ':', 'secciones ' + secciones + ' · correo ×' + correos, bien ? '✓' : '(no cuadra)');
      if (!bien) fallos.push(pg.enlace + ': título/fecha/secciones/correo no cuadran (secciones ' + secciones + ', correo ×' + correos + ')');
      await p.getByText('Volver', { exact: false }).first().click();
      await p.waitForTimeout(1000);
      const deVuelta = await r.texto();
      if (!/He leído y acepto/.test(deVuelta)) fallos.push(pg.enlace + ': «‹ Volver» no regresó al registro');
    }

    console.log('capturas', r.carpeta);
    console.log('ERRORES DE LA PÁGINA:', r.errores.join(' || ') || 'ninguno');
  } finally {
    await r.cerrar();
  }
  console.log(fallos.length ? '🔴 FALLÓ:\n  · ' + fallos.join('\n  · ') : '✓ los Términos y la Política se abren enteros, dicen el correo de soporte y «‹ Volver» regresa');
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.log('🔴 ' + e.message.split('\n')[0]); process.exit(1); });
