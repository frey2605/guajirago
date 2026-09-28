#!/usr/bin/env node
/**
 * ¿LA PROMOCIÓN SIGUE VIGENTE? — gemelo G16 (28-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-vigencia.cjs            (el «antes» sale del commit 09ce12e)
 *   node scripts/medir-vigencia.cjs --antes <commit>
 *
 * Las fechas de una promoción, de un anuncio o de una promo de restaurante se guardan como un DÍA
 * («2026-10-05», lo que da un <input type="date">). Cada sitio decidía «¿vigente hoy?» a su manera:
 *   · el servidor (reclamarPromocion) leía «2026-10-05T00:00:00» en SU hora, que es UTC → la
 *     promoción empezaba a las 7 de la noche del día anterior y se acababa a las 7 de la noche del
 *     último día, en hora de Colombia;
 *   · la app y el panel lo leían en la hora del teléfono (Colombia) → de 00:00 a 23:59;
 *   · las promos de restaurante (Restaurantes.js) comparaban con `toISOString()`, que es el día en
 *     UTC → desde las 7 de la noche ya es «mañana».
 *
 * Este guion corre la regla de VERDAD (no una copia): la de antes la saca de git, la de ahora la
 * carga del disco, y la ejecuta con el reloj del servidor (UTC) y con el del teléfono (Colombia),
 * hora por hora a lo largo de cada promoción guardada en producción. Cuenta las horas en que los
 * dos no dicen lo mismo. También cuenta cuántos canjes cayeron en esas horas, y cuántas fechas se
 * pintaban un día antes («Válida hasta»).
 *
 * No escribe nada.
 */
const path = require('path');
const { execSync } = require('child_process');
const { traer, doc } = require('./nube.cjs');

const RAIZ = path.resolve(__dirname, '..');
const i = process.argv.indexOf('--antes');
const ANTES = i > 0 ? process.argv[i + 1] : '09ce12e';
const HORA = 3600000;
const DIA = /^\d{4}-\d{2}-\d{2}$/;

// Corre `fn` con el reloj de una zona horaria (node aplica process.env.TZ en caliente).
function enZona(tz, fn) {
  const antes = process.env.TZ;
  process.env.TZ = tz;
  try { return fn(); } finally { if (antes === undefined) delete process.env.TZ; else process.env.TZ = antes; }
}

function reglaDeAntes() {
  const src = execSync('git show ' + ANTES + ':guajirago/functions/promociones.cjs', { cwd: RAIZ, encoding: 'utf8' });
  const m = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', src)(m, m.exports, require);
  return m.exports;
}

// Medianoche de Colombia (UTC−5) del día AAAA-MM-DD, como instante.
const medianocheCol = (f) => Date.parse(f + 'T05:00:00Z');

async function main() {
  const [promosC, anunciosC, negociosC, usuariosC] = await Promise.all([
    traer('promociones'), traer('anuncios'), traer('negocios'), traer('usuarios'),
  ]);
  const promos = promosC.map(doc);
  const anuncios = anunciosC.map(doc);
  const negocios = negociosC.map(doc);
  const usuarios = usuariosC.map(doc);

  const vieja = reglaDeAntes();
  const nueva = require(path.join(RAIZ, 'guajirago/functions/promociones.cjs'));
  const fueraDeFecha = (regla, p, t) => {
    const m = regla.motivoPorLaPromocion({ ...p, activa: true, aplicaA: 'ambos' }, false, new Date(t));
    return !!(m && m.codigo === 'fuera-de-fecha');
  };

  // ── 1. Las fechas guardadas: ¿son días AAAA-MM-DD? ──
  const promosRest = negocios.flatMap((n) => (n.promociones || []).map((p) => ({ ...p, negocio: n.id })));
  const rangoRest = promosRest.filter((p) => p.programacion === 'rango');
  const fechas = [
    ...promos.flatMap((p) => [p.fechaInicio, p.fechaFin]),
    ...anuncios.flatMap((a) => [a.fechaInicio, a.fechaFin]),
    ...rangoRest.flatMap((p) => [p.fechaInicio, p.fechaFin]),
  ].filter((f) => f !== undefined && f !== null && f !== '');
  const raras = fechas.filter((f) => !DIA.test(String(f)));
  console.log('FECHAS GUARDADAS en producción');
  console.log('  · promociones: ' + promos.length + ' · anuncios: ' + anuncios.length
    + ' · promos de restaurante: ' + promosRest.length + ' (con rango de fechas: ' + rangoRest.length + ')');
  console.log('  · fechas escritas: ' + fechas.length + ' · que NO son AAAA-MM-DD: ' + raras.length
    + (raras.length ? ' → ' + raras.map((f) => JSON.stringify(f)).join(', ') : ''));

  // ── 2. Promociones: servidor (UTC) contra teléfono (Colombia), hora por hora ──
  const cuenta = (regla) => {
    let horas = 0; let conDesacuerdo = 0; const ventanas = [];
    for (const p of promos) {
      if (!DIA.test(String(p.fechaInicio)) || !DIA.test(String(p.fechaFin))) continue;
      let mias = 0;
      for (let t = medianocheCol(p.fechaInicio) - DIA_MS; t <= medianocheCol(p.fechaFin) + 2 * DIA_MS; t += HORA) {
        const srv = enZona('UTC', () => fueraDeFecha(regla, p, t));
        const tel = enZona('America/Bogota', () => fueraDeFecha(regla, p, t));
        if (srv !== tel) { mias++; ventanas.push({ id: p.id, t, srv, tel }); }
      }
      horas += mias;
      if (mias) conDesacuerdo++;
    }
    return { horas, conDesacuerdo, ventanas };
  };
  const A = cuenta(vieja);
  const B = cuenta(nueva);
  console.log('\nPROMOCIONES · horas en que el servidor y el teléfono NO dicen lo mismo (regla ejecutada)');
  console.log('  · ANTES (' + ANTES + '): ' + A.horas + ' horas, en ' + A.conDesacuerdo + ' de ' + promos.length + ' promociones');
  console.log('  · AHORA (disco):  ' + B.horas + ' horas, en ' + B.conDesacuerdo + ' de ' + promos.length + ' promociones');
  const ej = A.ventanas.filter((v) => v.srv && !v.tel)[0];
  if (ej) {
    console.log('  · ejemplo de antes: «' + ej.id + '» el ' + new Date(ej.t - 5 * HORA).toISOString().slice(0, 16).replace('T', ' ')
      + ' (hora de Colombia): la app la ofrece y el servidor dice «ya no está disponible»');
  }

  // Canjes que cayeron en esas horas (el servidor aceptó uno que el teléfono no ofrecía, o al revés no se ve: se rechazó).
  const canjes = usuarios.map((u) => u.descuentoPendiente).filter((d) => d && d.promoId && d.fechaActivacion);
  const porId = Object.fromEntries(promos.map((p) => [p.id, p]));
  const enVentana = canjes.filter((d) => {
    const p = porId[d.promoId];
    if (!p) return false;
    const t = Date.parse(d.fechaActivacion);
    return enZona('UTC', () => fueraDeFecha(vieja, p, t)) !== enZona('America/Bogota', () => fueraDeFecha(vieja, p, t));
  });
  console.log('  · canjes guardados (descuento reclamado en la ficha): ' + canjes.length + ' · en esas horas: ' + enVentana.length);

  // ── 3. Lo que la regla de ahora dice HOY de cada promoción, anuncio y promo de restaurante ──
  if (nueva.etapaDeVigencia) {
    const ahora = new Date();
    const cuantos = (lista) => {
      const c = { antes: 0, vigente: 0, despues: 0 };
      for (const x of lista) c[nueva.etapaDeVigencia(x.fechaInicio, x.fechaFin, ahora)]++;
      return c.vigente + ' vigentes · ' + c.antes + ' por empezar · ' + c.despues + ' vencidas';
    };
    console.log('\nHOY EN COLOMBIA (' + nueva.hoyEnColombia(ahora) + '), con la regla única');
    console.log('  · promociones: ' + cuantos(promos));
    console.log('  · anuncios: ' + cuantos(anuncios));
    console.log('  · promos de restaurante con rango: ' + cuantos(rangoRest));
  } else {
    console.log('\n(la regla única «etapaDeVigencia» aún no existe en promociones.cjs)');
  }

  // Promos de restaurante: el «hoy» de antes (día UTC) contra el día de Colombia, en las 24 horas de un día.
  let horasRest = 0;
  for (let h = 0; h < 24; h++) {
    const t = new Date(Date.parse('2026-10-05T05:00:00Z') + h * HORA);
    if (t.toISOString().slice(0, 10) !== '2026-10-05') horasRest++;
  }
  console.log('  · promos de restaurante, antes: de cada día, ' + horasRest + ' horas (de 7 p. m. a medianoche) ya contaban como el día siguiente');

  // ── 4. «Válida hasta»: la fecha pintada con new Date(AAAA-MM-DD).toLocaleDateString en un teléfono de Colombia ──
  const corridas = enZona('America/Bogota', () => promos.filter((p) => DIA.test(String(p.fechaFin))
    && new Date(p.fechaFin).getDate() !== Number(String(p.fechaFin).slice(8, 10))).length);
  console.log('\nPINTAR: promociones cuya «Válida hasta» salía un día antes con la forma vieja: ' + corridas + ' de '
    + promos.filter((p) => DIA.test(String(p.fechaFin))).length);
}

const DIA_MS = 24 * HORA;
main().catch((e) => { console.error('✋ ' + e.message); process.exit(1); });
