#!/usr/bin/env node
/**
 * ¿PUEDE EL TELÉFONO FABRICARSE UN DESCUENTO? — pendiente P01 (30-sep-2026). SOLO LEE.
 *
 *   node scripts/medir-descuento-telefono.cjs              → el código de las tres apps + producción
 *   node scripts/medir-descuento-telefono.cjs --sin-red    → solo el código (no lee la base)
 *   node scripts/medir-descuento-telefono.cjs --reglas-vivas <archivo>
 *        → además compara el `firestore.rules` del repo con uno bajado del servidor
 *          (`node scripts/bajar-reglas.cjs guajirago <archivo>`), sin mirar los finales de línea.
 *
 * `usuarios/{uid}.descuentoPendiente` es PLATA: cuando se usa en un viaje, `consumirDescuentoViaje` se lo abona al
 * conductor. Desde G18 (28-sep-2026) lo fabrica SOLO el servidor (`reclamarPromocion` y `descuentoDeBienvenida`),
 * firmado con `fabricadoPor: 'servidor'`, y la huella del aparato (`dispositivosBeneficio`) también la escribe él.
 * Pero las reglas seguían dejando que el dueño de una ficha se escribiera el descuento que quisiera, y que cualquiera
 * con cuenta creara huellas. Este guion cuenta:
 *   · EN EL CÓDIGO de las tres apps y de las funciones: quién escribe `descuentoPendiente` (y con qué: un valor, o
 *     solo `null` para quemarlo) y quién nombra `dispositivosBeneficio`;
 *   · EN PRODUCCIÓN: cuántas fichas tienen descuento y cuáles NO pudieron salir del servidor (sin su firma, o con un
 *     valor que no es el de su promoción); cuántas huellas hay y si alguna no cuadra con una ficha; y, porque el
 *     dinero sale de ahí, cuántos viajes llevan un `descuentoInfo` con un valor que no es el de su promoción.
 *
 * No escribe nada.
 */
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const CARPETAS_CLIENTE = ['guajirago/src', 'guajirago-admin/src', 'guajirago-aliados/src'];
const CARPETA_SERVIDOR = 'guajirago/functions';

/** Todos los .js/.cjs de una carpeta, sin node_modules, build ni pruebas. */
function archivosDe(raiz, carpeta) {
  const abs = path.join(raiz, carpeta);
  if (!fs.existsSync(abs)) return [];
  const salida = [];
  const andar = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'build' || e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (/\.(c?js|jsx)$/.test(e.name) && !/\.test\.(c?js|jsx)$/.test(e.name)) salida.push(p);
    }
  };
  andar(abs);
  return salida;
}

/** Quita comentarios (de bloque y de renglón) para que la prosa no cuente como código. Conserva los renglones. */
function sinComentarios(texto) {
  return texto.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1')).join('\n');
}

/**
 * Quién escribe en un texto de código. FUNCIÓN PURA: recibe el texto y dice, renglón por renglón:
 *   · `valor`  — `descuentoPendiente` como CLAVE seguida de algo que NO es `null` (fabricar o cambiar un descuento);
 *   · `quema`  — `descuentoPendiente: null` (el pasajero lo quema cuando el conductor lo cobró);
 *   · `huella` — cualquier mención de `dispositivosBeneficio` en código (leerla o escribirla).
 * La clave cuenta escrita a pelo, entre comillas o con punto (`'descuentoPendiente.valorBeneficio': …`).
 */
function escriturasEn(texto) {
  const r = { valor: [], quema: [], huella: [] };
  sinComentarios(texto).split('\n').forEach((l, i) => {
    const n = i + 1;
    const re = /(?:^|[{,\s(])['"`]?descuentoPendiente(\.[\w.]+)?['"`]?\s*:(?!:)\s*([^\s,}]*)/g;
    let m;
    while ((m = re.exec(l))) {
      if (!m[1] && /^null\b/.test(m[2])) r.quema.push(n); else r.valor.push(n);
    }
    if (/dispositivosBeneficio/.test(l)) r.huella.push(n);
  });
  return r;
}

/** Recorre las tres apps y las funciones. Devuelve { cliente: [...], servidor: [...] } con los sitios. */
function escritoresEnCodigo(raiz = RAIZ) {
  const mirar = (carpetas) => {
    const sitios = [];
    for (const c of carpetas) {
      for (const f of archivosDe(raiz, c)) {
        const e = escriturasEn(fs.readFileSync(f, 'utf8'));
        const rel = path.relative(raiz, f).replace(/\\/g, '/');
        for (const tipo of ['valor', 'quema', 'huella']) for (const n of e[tipo]) sitios.push({ archivo: rel, renglon: n, tipo });
      }
    }
    return sitios;
  };
  return { cliente: mirar(CARPETAS_CLIENTE), servidor: mirar([CARPETA_SERVIDOR]) };
}

// Lo que fabrica el servidor, sacado de SU archivo (no copiado): el valor de la bienvenida y su promoId.
function recetaDelServidor() {
  const m = require(path.join(RAIZ, 'guajirago/functions/descuentoPendiente.cjs'));
  return { valorBienvenida: m.CREDITO_BIENVENIDA_PASAJERO, promoBienvenida: m.PROMO_BIENVENIDA };
}

/**
 * ¿Pudo este descuento pendiente salir del servidor? FUNCIÓN PURA. Devuelve null si cuadra, o el motivo.
 * Cuadra si lleva la firma del servidor y su valor y tipo son los de su promoción (o los de la bienvenida).
 */
function porQueNoCuadra(desc, promos, receta) {
  if (!desc || typeof desc !== 'object') return 'no es una ficha';
  if (desc.fabricadoPor !== 'servidor') return 'sin la firma del servidor';
  if (desc.promoId === receta.promoBienvenida) {
    if (desc.tipoBeneficio !== 'credito' || desc.valorBeneficio !== receta.valorBienvenida) {
      return 'bienvenida con ' + desc.tipoBeneficio + ' ' + desc.valorBeneficio;
    }
    return null;
  }
  const p = promos[desc.promoId];
  if (!p) return 'promoción ' + desc.promoId + ' no existe';
  if (desc.tipoBeneficio !== p.tipoBeneficio || desc.valorBeneficio !== (p.valorBeneficio || 0)) {
    return 'valor ' + desc.tipoBeneficio + ' ' + desc.valorBeneficio + ' ≠ promoción ' + p.tipoBeneficio + ' ' + p.valorBeneficio;
  }
  return null;
}

/** Lo mismo para el `descuentoInfo` de un viaje: ¿su valor es el de su promoción? (sin firma: lo arma el teléfono). */
function porQueNoCuadraElViaje(info, promos, receta) {
  if (!info || typeof info !== 'object') return 'no es una ficha';
  let esperado;
  if (info.promoId === receta.promoBienvenida) esperado = { tipoBeneficio: 'credito', valorBeneficio: receta.valorBienvenida };
  else if (promos[info.promoId]) esperado = promos[info.promoId];
  else return 'promoción ' + info.promoId + ' no existe (hoy)';
  if (info.tipoBeneficio !== esperado.tipoBeneficio || info.valorBeneficio !== (esperado.valorBeneficio || 0)) {
    return 'valor ' + info.tipoBeneficio + ' ' + info.valorBeneficio + ' ≠ ' + esperado.tipoBeneficio + ' ' + esperado.valorBeneficio;
  }
  const orig = Number(info.tarifaOriginal); const apl = Number(info.descuentoAplicado);
  if (Number.isFinite(orig) && Number.isFinite(apl) && (apl < 0 || apl > orig)) return 'descuento aplicado ' + apl + ' fuera de 0..' + orig;
  return null;
}

const corto = (id) => String(id).slice(0, 8) + '…';

async function main() {
  const args = process.argv.slice(2);
  const sinRed = args.includes('--sin-red');
  const iv = args.indexOf('--reglas-vivas');

  console.log('── EL CÓDIGO ──');
  const { cliente, servidor } = escritoresEnCodigo();
  const NOMBRES = { valor: 'escribe un VALOR de descuento', quema: 'quema el descuento (null)', huella: 'nombra dispositivosBeneficio' };
  const decir = (titulo, sitios) => {
    for (const tipo of ['valor', 'quema', 'huella']) {
      const s = sitios.filter((x) => x.tipo === tipo);
      console.log('  ' + titulo + ' · ' + NOMBRES[tipo] + ': ' + s.length
        + (s.length ? ' → ' + s.map((x) => x.archivo + ':' + x.renglon).join(', ') : ''));
    }
  };
  decir('APPS (teléfono y panel)', cliente);
  decir('SERVIDOR (functions)', servidor);

  if (iv >= 0) {
    const vivas = fs.readFileSync(args[iv + 1], 'utf8').replace(/\r\n/g, '\n');
    const repo = fs.readFileSync(path.join(RAIZ, 'firestore.rules'), 'utf8').replace(/\r\n/g, '\n');
    const lv = vivas.split('\n'); const lr = repo.split('\n');
    const soloRepo = lr.filter((l) => !lv.includes(l)); const soloVivas = lv.filter((l) => !lr.includes(l));
    const deCodigo = (ls) => ls.filter((l) => l.trim() && !l.trim().startsWith('//'));
    console.log('── LAS REGLAS PUESTAS vs el repo ──');
    console.log('  ' + (vivas === repo ? 'IGUALES' : 'DISTINTAS: ' + soloRepo.length + ' renglones solo en el repo ('
      + deCodigo(soloRepo).length + ' de código), ' + soloVivas.length + ' solo en el servidor ('
      + deCodigo(soloVivas).length + ' de código)'));
  }

  if (sinRed) return;
  const { traer, doc } = require('./nube.cjs');
  const [u, d, p, v] = await Promise.all([traer('usuarios'), traer('dispositivosBeneficio'), traer('promociones'), traer('viajes')]);
  const usuarios = u.map(doc); const huellas = d.map(doc); const viajes = v.map(doc);
  const promos = Object.fromEntries(p.map(doc).map((x) => [x.id, x]));
  const receta = recetaDelServidor();
  const fichas = Object.fromEntries(usuarios.map((x) => [x.id, x]));

  console.log('── PRODUCCIÓN ──');
  const conDesc = usuarios.filter((x) => x.descuentoPendiente && typeof x.descuentoPendiente === 'object');
  const malos = conDesc.map((x) => ({ x, motivo: porQueNoCuadra(x.descuentoPendiente, promos, receta) })).filter((y) => y.motivo);
  console.log('FICHAS: ' + usuarios.length + ' · con descuento pendiente: ' + conDesc.length
    + ' · que NO pudieron salir del servidor: ' + malos.length);
  for (const { x, motivo } of malos) {
    console.log('   · ' + corto(x.id) + ' (' + (x.tipo || 'pasajero') + ') ' + x.descuentoPendiente.promoId + ' '
      + x.descuentoPendiente.tipoBeneficio + ' ' + x.descuentoPendiente.valorBeneficio + ' — ' + motivo);
  }
  const suma = malos.filter((y) => y.x.descuentoPendiente.tipoBeneficio === 'credito')
    .reduce((s, y) => s + (Number(y.x.descuentoPendiente.valorBeneficio) || 0), 0);
  if (malos.length) console.log('   pesos en créditos de esos: $' + suma);

  const sinFicha = huellas.filter((h) => !h.uid || !fichas[h.uid]);
  const deConductor = huellas.filter((h) => h.uid && fichas[h.uid] && fichas[h.uid].tipo === 'conductor');
  const formaRara = huellas.filter((h) => Object.keys(h).filter((k) => k !== 'id').sort().join(',') !== 'fecha,uid,usado');
  console.log('HUELLAS (dispositivosBeneficio): ' + huellas.length + ' · sin ficha detrás: ' + sinFicha.length
    + ' · de una ficha hoy conductor: ' + deConductor.length + ' · con otra forma que {usado, uid, fecha}: ' + formaRara.length);

  const conInfo = viajes.filter((x) => x.descuentoInfo && typeof x.descuentoInfo === 'object');
  const viajesMalos = conInfo.map((x) => ({ x, motivo: porQueNoCuadraElViaje(x.descuentoInfo, promos, receta) })).filter((y) => y.motivo);
  const cobrados = conInfo.filter((x) => x.descuentoInfo.consumido === true);
  console.log('VIAJES con descuento: ' + conInfo.length + ' · cobrados por el conductor: ' + cobrados.length
    + ' ($' + cobrados.reduce((s, x) => s + (Number(x.descuentoInfo.descuentoAplicado) || 0), 0) + ')'
    + ' · con un valor que no es el de su promoción de hoy: ' + viajesMalos.length);
  for (const { x, motivo } of viajesMalos) {
    console.log('   · viaje ' + corto(x.id) + ' ' + x.estado
      + (x.descuentoInfo.consumido ? ' (cobrado $' + x.descuentoInfo.descuentoAplicado + ')' : '') + ' — ' + motivo);
  }
}

module.exports = { escriturasEn, escritoresEnCodigo, porQueNoCuadra, porQueNoCuadraElViaje, recetaDelServidor, sinComentarios };

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
