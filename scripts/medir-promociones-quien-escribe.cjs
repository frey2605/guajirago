#!/usr/bin/env node
/**
 * SEGURIDAD · ¿quién puede escribir en `promociones`? (29-sep-2026) — SOLO LECTURA.
 *
 *  El hueco: `firestore.rules` dejaba crear y editar una promoción (y su contador de usos
 *  `promociones/{id}/usos/{uid}`) a CUALQUIERA con sesión. Un pasajero podía fabricarse una
 *  promoción de crédito y canjearla con `reclamarPromocion`, o ponerse a cero su contador de
 *  usos para saltarse el tope.
 *
 *  Este guion dice dos cosas:
 *   1. Lo que dicen las REGLAS del repo para `promociones` y `usos` (texto sacado del archivo).
 *   2. Lo que hay en PRODUCCIÓN: cuántas promociones, quién las creó (`creadoPor`), si tienen
 *      la forma que escribe el panel (`fechaCreacion`, `usosTotales`, `inversionTotal`), y los
 *      contadores de usos de cada una. Una promoción SIN la forma del panel es sospechosa de
 *      haber sido fabricada desde un teléfono: se nombra, no se borra.
 *
 *  Uso: node scripts/medir-promociones-quien-escribe.cjs [--sin-nube]
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

/** El bloque `match /promociones/{promoId} { ... }` entero, contando llaves. */
function bloqueDePromociones(texto) {
  const i = texto.indexOf('match /promociones/{promoId}');
  if (i < 0) return null;
  let n = 0;
  for (let j = texto.indexOf('{', i + 'match /promociones/{promoId}'.length); j < texto.length; j++) {
    if (texto[j] === '{') n++;
    else if (texto[j] === '}') { n--; if (n === 0) return texto.slice(i, j + 1); }
  }
  return null;
}

/** Los renglones `allow` del bloque, sin comentarios, separando promoción y usos. */
function reglasDePromociones(texto) {
  const b = bloqueDePromociones(texto);
  if (!b) return null;
  const sinComent = b.split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
  const iUsos = sinComent.indexOf('match /usos/');
  const promo = iUsos < 0 ? sinComent : sinComent.slice(0, iUsos);
  const usos = iUsos < 0 ? '' : sinComent.slice(iUsos);
  const allows = (t) => (t.match(/allow[^;]+;/g) || []).map((s) => s.replace(/\s+/g, ' ').trim());
  return { promo: allows(promo), usos: allows(usos) };
}

/** ¿Una escritura (create/update) la puede hacer cualquiera con sesión? */
function abiertaACualquiera(allows) {
  return allows.some((a) => /allow[^:]*\b(create|update|write)\b[^:]*:\s*if\s+request\.auth\s*!=\s*null\s*;/.test(a));
}

async function main() {
  const reglas = reglasDePromociones(fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8'));
  console.log('── REGLAS del repo (firestore.rules) ──');
  if (!reglas) { console.log('  🔴 no encontré el bloque de promociones'); process.exitCode = 1; return; }
  console.log('  promociones:'); reglas.promo.forEach((a) => console.log('    ' + a));
  console.log('  usos:'); reglas.usos.forEach((a) => console.log('    ' + a));
  const abiertaPromo = abiertaACualquiera(reglas.promo);
  const abiertaUsos = abiertaACualquiera(reglas.usos);
  console.log('  ' + (abiertaPromo ? '🔴 cualquiera con sesión crea/edita PROMOCIONES' : '✓ promociones: crear/editar NO está abierto a cualquiera'));
  console.log('  ' + (abiertaUsos ? '🔴 cualquiera con sesión crea/edita CONTADORES DE USO' : '✓ usos: crear/editar NO está abierto a cualquiera'));

  if (process.argv.includes('--sin-nube')) return;

  const { traer, doc } = require('./nube.cjs');
  const promos = (await traer('promociones')).map(doc);
  console.log('\n── PRODUCCIÓN (proyecto guajirago) ──');
  console.log('  promociones: ' + promos.length);
  let sospechosas = 0;
  let usosTotal = 0;
  for (const p of promos) {
    const formaDelPanel = p.fechaCreacion !== undefined && p.usosTotales !== undefined
      && p.inversionTotal !== undefined && p.creadoPor !== undefined;
    if (!formaDelPanel) sospechosas++;
    // eslint-disable-next-line no-await-in-loop
    const usos = (await traer('promociones/' + p.id + '/usos')).map(doc);
    usosTotal += usos.length;
    console.log('  · ' + p.id + ' — ' + (p.nombre || '(sin nombre)') + ' · ' + (p.tipoBeneficio || '?') + ' ' + (p.valorBeneficio ?? '?')
      + ' · creadoPor=' + JSON.stringify(p.creadoPor) + ' · creada=' + (p.fechaCreacion || '?')
      + ' · activa=' + p.activa + ' · usosTotales=' + p.usosTotales
      + (formaDelPanel ? '' : '  🔴 SIN LA FORMA DEL PANEL'));
    for (const u of usos) {
      console.log('      usos/' + u.id + ' veces=' + u.veces + ' nombre=' + JSON.stringify(u.nombreUsuario || ''));
    }
  }
  console.log('  contadores de uso: ' + usosTotal);
  console.log('  sin la forma del panel (posible fabricada): ' + sospechosas);
}

if (require.main === module) {
  main().catch((e) => { console.error('🔴 ' + e.message); process.exitCode = 1; });
}

module.exports = { bloqueDePromociones, reglasDePromociones, abiertaACualquiera };
