#!/usr/bin/env node
/**
 * ¿EN QUÉ FORMATO ESTÁ GUARDADO EL PRECIO DEL VIAJE? — gemelo G13 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-tarifa-texto.cjs
 *
 * El viaje guarda el precio dos veces: `tarifaValor` (el NÚMERO, con el que se calcula) y `tarifa` (el TEXTO que
 * se enseña). La oferta del conductor igual: `montoValor` y `monto`. Hasta el 28-sep-2026 el texto lo armaba cada
 * teléfono con `toLocaleString()` SIN idioma, o sea con el del teléfono: uno en español de Colombia guarda
 * «$10.000», uno en inglés «$10,000», uno en español de España «$5000» (no agrupa las cuatro cifras). Y el servidor
 * (confirmarConductor) copiaba al viaje el texto de la oferta tal cual venía.
 *
 * Este guion cuenta, en producción, cuántos textos hay de cada forma y cuántos NO dicen el mismo número que el
 * campo numérico de al lado. No escribe nada: arreglar los textos viejos es tocar datos, y eso no se hace aquí.
 */
const { traer, doc } = require('./nube.cjs');

// La forma de un texto de precio. Función pura: la prueba la corre con casos de mentira.
function formaDe(t) {
  if (t === undefined || t === null || t === '') return 'vacío';
  const s = String(t);
  if (/^\$ \d{1,3}(\.\d{3})*$/.test(s)) return 'cop() «$ 10.000»';
  if (/^\$\d{1,3}(\.\d{3})+$/.test(s)) return 'español «$10.000»';
  if (/^\$\d{1,3}(,\d{3})+$/.test(s)) return 'inglés «$10,000»';
  if (/^\$\d{4,}$/.test(s)) return 'sin agrupar «$5000»';
  if (/^\$\d{1,3}$/.test(s)) return 'menos de mil «$800»';
  return 'otra forma';
}

// El número que dice un texto de precio («$10.000», «$10,000», «$ 10.000» → 10000).
const numeroDel = (t) => { const d = String(t == null ? '' : t).replace(/\D/g, ''); return d ? Number(d) : null; };

function contar(filas) {
  const formas = {};
  let noCuadran = 0;
  const ejemplos = [];
  for (const f of filas) {
    const forma = formaDe(f.texto);
    formas[forma] = (formas[forma] || 0) + 1;
    if (f.texto != null && f.valor != null && numeroDel(f.texto) !== Number(f.valor)) {
      noCuadran++;
      if (ejemplos.length < 6) ejemplos.push(f);
    }
  }
  return { total: filas.length, formas, noCuadran, ejemplos };
}

function imprimir(titulo, c) {
  console.log('\n' + titulo + ': ' + c.total);
  for (const [k, n] of Object.entries(c.formas).sort((a, b) => b[1] - a[1])) console.log('   ' + k.padEnd(26, '.') + ' ' + n);
  console.log('   🔴 el texto NO dice el número de al lado: ' + c.noCuadran);
  for (const e of c.ejemplos) console.log('      ' + e.id + ': «' + e.texto + '» contra ' + e.valor);
}

async function main() {
  const viajes = (await traer('viajes')).map(doc);
  const cv = contar(viajes.map((v) => ({ id: v.id, texto: v.tarifa, valor: v.tarifaValor })));
  imprimir('🚕 VIAJES en producción (campo tarifa)', cv);
  console.log('   sin tarifaValor (número): ' + viajes.filter((v) => v.tarifaValor == null).length);

  const ofertas = [];
  for (const v of viajes) {
    // eslint-disable-next-line no-await-in-loop
    for (const o of (await traer('viajes/' + v.id + '/contraofertas')).map(doc)) {
      ofertas.push({ id: v.id + '/' + o.id, texto: o.monto, valor: o.montoValor });
    }
  }
  imprimir('🙋 OFERTAS de conductores (campo monto)', contar(ofertas));

  const distintas = Object.keys(cv.formas).filter((k) => k !== 'vacío' && k !== 'menos de mil «$800»');
  console.log('\n' + (distintas.length > 1
    ? '⚠ los viajes guardan el precio en ' + distintas.length + ' formas distintas (datos viejos: NO se tocan aquí)'
    : '✓ los viajes guardan el precio en una sola forma'));
}

if (require.main === module) main().catch((e) => { console.error('🔴 ' + e.message); process.exit(1); });
module.exports = { formaDe, numeroDel, contar };
