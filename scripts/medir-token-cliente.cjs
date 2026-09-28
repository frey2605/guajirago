#!/usr/bin/env node
/**
 * 🔔 EL TOKEN DE AVISOS DEL CLIENTE — gemelo G34, SOLO LECTURA.
 *
 * Tres documentos los crea el cliente, y el servidor le avisa por ellos solo si llevan su token:
 *   · viajes           → `pasajeroFcmToken` (lo lee notificarPasajeroOferta: «tienes una oferta»)
 *   · pedidos          → `clienteFcmToken`  (lo lee notificarClienteDelPedido: «tu pedido va en camino»)
 *   · reservasTurismo  → `clienteFcmToken`  (lo lee notificarClienteReserva: «reserva confirmada»)
 *
 * Mide dos cosas, y ninguna escribe nada:
 *
 *   1. EN EL CÓDIGO (Solicitar.js, Restaurantes.js, Turismo.js): cuántas maneras distintas hay de pegar el token, y
 *      cuáles hacen ESPERAR la creación del documento al cartel de permiso (un `await obtenerTokenFCM()` antes del
 *      `addDoc`: mientras el cliente no toque «Permitir» o «Bloquear», el pedido no nace). Antes de G34 (6afb677):
 *      3 maneras, 2 que esperan.
 *   2. EN LOS DATOS de producción (con scripts/nube.cjs): cuántos documentos llevan el token, POR MES. Un documento
 *      creado antes de que existiera el código que pega el token no puede llevarlo, así que un «0 de 92» sin fecha
 *      no dice nada: el código del viaje nació el 12-jul-2026.
 *
 *   node scripts/medir-token-cliente.cjs                 → el código de hoy + los datos
 *   node scripts/medir-token-cliente.cjs --ref 6afb677   → el código de ese commit (para carear el antes)
 *   node scripts/medir-token-cliente.cjs --sin-datos     → solo el código
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLAS = ['guajirago/src/Solicitar.js', 'guajirago/src/Restaurantes.js', 'guajirago/src/Turismo.js'];

const QUE_SE_MIDE = [
  { col: 'viajes', campo: 'pasajeroFcmToken', fecha: 'fechaSolicitud' },
  { col: 'pedidos', campo: 'clienteFcmToken', fecha: 'creado' },
  { col: 'reservasTurismo', campo: 'clienteFcmToken', fecha: 'creado' },
];

function leerPantalla(archivo, ref) {
  if (ref) return execSync('git show ' + ref + ':' + archivo, { cwd: RAIZ, maxBuffer: 1 << 26 }).toString();
  return fs.readFileSync(path.join(RAIZ, archivo), 'utf8');
}

/**
 * Cómo pega el token cada pantalla. Función pura: recibe el texto de la pantalla.
 *   · `pieza`   — usa la pieza común (prepararTokenDeAvisos)
 *   · `espera`  — hace esperar la creación al cartel (`await obtenerTokenFCM(`)
 *   · `aMano`   — pide el token por su cuenta (`obtenerTokenFCM(` sin la pieza)
 */
function comoPegaElToken(texto) {
  const t = texto.replace(/\r\n/g, '\n').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
  const pieza = (t.match(/\bprepararTokenDeAvisos\s*\(/g) || []).length;
  const espera = (t.match(/\bawait\s+obtenerTokenFCM\s*\(/g) || []).length;
  const aMano = (t.match(/\bobtenerTokenFCM\s*\(/g) || []).length;
  let manera = 'no lo pega';
  if (pieza && !aMano) manera = 'la pieza común';
  else if (espera) {
    manera = 'await obtenerTokenFCM() antes de crear'
      + (/FcmToken:\s*\w+\s*\|\|\s*null/.test(t) ? ', y sin token guarda null' : ', y sin token no guarda el campo');
  }
  else if (aMano) manera = 'obtenerTokenFCM().then(updateDoc) después de crear';
  return { pieza, espera, aMano, manera };
}

/** De una lista de documentos ya leídos, cuántos llevan el token, por mes. Función pura. */
function contarTokens(docs, campo, fecha) {
  const porMes = {};
  let con = 0;
  let ultima = '';
  for (const d of docs) {
    const f = typeof d[fecha] === 'string' ? d[fecha] : '';
    const mes = f.slice(0, 7) || '(sin fecha)';
    if (!porMes[mes]) porMes[mes] = { total: 0, con: 0 };
    porMes[mes].total += 1;
    if (typeof d[campo] === 'string' && d[campo].length > 0) { porMes[mes].con += 1; con += 1; }
    if (f > ultima) ultima = f;
  }
  return { total: docs.length, con, ultima, porMes };
}

async function main() {
  const i = process.argv.indexOf('--ref');
  const ref = i > 0 ? process.argv[i + 1] : null;
  console.log('\n🔔 EL TOKEN DE AVISOS DEL CLIENTE — código ' + (ref ? 'del commit ' + ref : 'de hoy'));
  const maneras = new Set();
  let esperan = 0;
  for (const a of PANTALLAS) {
    const r = comoPegaElToken(leerPantalla(a, ref));
    maneras.add(r.manera);
    if (r.espera) esperan += 1;
    console.log('  ' + a.split('/').pop().padEnd(18) + r.manera);
  }
  console.log('  → ' + maneras.size + ' manera(s) distinta(s) · ' + esperan + ' pantalla(s) que hacen esperar la creación al cartel');

  if (process.argv.includes('--sin-datos')) return;
  const { traer, doc } = require('./nube.cjs');
  console.log('\n  EN LOS DATOS DE PRODUCCIÓN (solo lectura):');
  for (const q of QUE_SE_MIDE) {
    // eslint-disable-next-line no-await-in-loop
    const r = contarTokens((await traer(q.col)).map(doc), q.campo, q.fecha);
    console.log('  ' + q.col.padEnd(16) + String(r.con).padStart(3) + ' de ' + String(r.total).padStart(3)
      + ' llevan ' + q.campo + '   (el más nuevo: ' + (r.ultima || '—') + ')');
    for (const mes of Object.keys(r.porMes).sort()) {
      console.log('      ' + mes + ': ' + r.porMes[mes].con + ' de ' + r.porMes[mes].total);
    }
  }
  console.log('');
}

if (require.main === module) {
  main().catch((e) => { console.error('No se pudo medir:', e.message); process.exit(1); });
}

module.exports = { comoPegaElToken, contarTokens, PANTALLAS, QUE_SE_MIDE };
