#!/usr/bin/env node
/**
 * 🔔 EL «SOBRE» DE CADA AVISO AL CELULAR — gemelo G32, SOLO LECTURA.
 *
 * Cuenta dos cosas, y ninguna escribe nada:
 *
 *   1. EN EL CÓDIGO de guajirago/functions: cuántos sitios mandan un aviso por su cuenta (`.send(` o
 *      `.sendEachForMulticast(`), cuántos arman su propio sobre (`apns:`), y cuántos REVISAN la respuesta
 *      (`failureCount` / `responses`). Antes del arreglo (bb68c7f): 8 que mandan, 7 sobres, 1 que revisa.
 *   2. EN LOS DATOS de producción (con scripts/nube.cjs): cuántas fichas guardan un token de avisos, que son
 *      los teléfonos a los que esos sitios les escriben. No se valida ningún token contra Google: eso sería
 *      MANDAR algo, y este guion no manda nada.
 *
 *   node scripts/medir-sobres-de-aviso.cjs                 → el código de hoy + los datos
 *   node scripts/medir-sobres-de-aviso.cjs --ref bb68c7f   → el código de ese commit (para carear el antes)
 *   node scripts/medir-sobres-de-aviso.cjs --sin-datos     → solo el código
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const CARPETA = 'guajirago/functions';

function archivosDeLaNube(ref) {
  if (ref) {
    const lista = execSync('git ls-tree --name-only ' + ref + ' ' + CARPETA + '/', { cwd: RAIZ }).toString()
      .split('\n').filter((f) => /\.(c?js)$/.test(f));
    return lista.map((f) => ({ f, t: execSync('git show ' + ref + ':' + f, { cwd: RAIZ, maxBuffer: 1 << 26 }).toString() }));
  }
  return fs.readdirSync(path.join(RAIZ, CARPETA)).filter((f) => /\.(c?js)$/.test(f))
    .map((f) => ({ f: CARPETA + '/' + f, t: fs.readFileSync(path.join(RAIZ, CARPETA, f), 'utf8') }));
}

/** Los sitios del código que mandan un aviso, y si miran lo que Google contestó. Función pura. */
function sitiosQueMandan(archivos) {
  const sitios = [];
  let sobres = 0;
  for (const { f, t } of archivos) {
    const texto = t.replace(/\r\n/g, '\n');
    const sinComentarios = texto.split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n');
    sobres += (sinComentarios.match(/\bapns\s*:/g) || []).length;
    const re = /\.(sendEachForMulticast|sendMulticast|sendEach|send)\(/g;
    const llamadas = [...sinComentarios.matchAll(re)];
    llamadas.forEach((m, k) => {
      const renglon = sinComentarios.slice(0, m.index).split('\n').length;
      // ¿Mira la respuesta? Se busca en los 30 renglones siguientes a la llamada, pero SIN pasar a la llamada
      // siguiente: si no, un sitio que no revisa se apuntaría el `failureCount` del vecino.
      const hasta = k + 1 < llamadas.length ? llamadas[k + 1].index : sinComentarios.length;
      const despues = sinComentarios.slice(m.index, hasta).split('\n').slice(0, 30).join('\n');
      const revisa = /failureCount|responses/.test(despues);
      sitios.push({ archivo: f, renglon, como: m[1], revisa });
    });
  }
  return { sitios, sobres };
}

async function tokensEnLosDatos() {
  const { traer, doc } = require('./nube.cjs');
  const contar = async (col, campo, filtro = () => true) => {
    const docs = (await traer(col)).map(doc).filter(filtro);
    const con = docs.filter((d) => typeof d[campo] === 'string' && d[campo]);
    return { col, campo, fichas: docs.length, conToken: con.length, distintos: new Set(con.map((d) => d[campo])).size };
  };
  return [
    await contar('conductores', 'fcmToken', (d) => d.activo === true),
    await contar('negociosPrivado', 'fcmToken'),
    await contar('empleados', 'fcmToken', (d) => d.activo !== false),
    await contar('pedidos', 'clienteFcmToken'),
    await contar('reservasTurismo', 'clienteFcmToken'),
    await contar('viajes', 'pasajeroFcmToken'),
  ];
}

async function main() {
  const i = process.argv.indexOf('--ref');
  const ref = i > 0 ? process.argv[i + 1] : null;
  const { sitios, sobres } = sitiosQueMandan(archivosDeLaNube(ref));
  console.log('\n🔔 EL SOBRE DE LOS AVISOS — código ' + (ref ? 'del commit ' + ref : 'de hoy'));
  for (const s of sitios) {
    console.log('   ' + (s.revisa ? '✓ revisa   ' : '✗ NO revisa') + '  ' + s.archivo + ':' + s.renglon + '  (' + s.como + ')');
  }
  const revisan = sitios.filter((s) => s.revisa).length;
  console.log('   → ' + sitios.length + ' sitio(s) mandan avisos · ' + sobres + ' sobre(s) armado(s) a mano (apns:) · '
    + revisan + ' de ' + sitios.length + ' miran si llegó');

  if (process.argv.includes('--sin-datos')) return;
  console.log('\n📱 TOKENS DE AVISOS GUARDADOS EN PRODUCCIÓN (solo lectura)');
  try {
    for (const r of await tokensEnLosDatos()) {
      console.log('   ' + (r.col + '.' + r.campo).padEnd(34) + r.conToken + ' de ' + r.fichas + ' fichas'
        + (r.distintos !== r.conToken ? ' (' + r.distintos + ' distintos)' : ''));
    }
  } catch (e) {
    console.log('   ⚠ no pude leer los datos: ' + e.message.split('\n')[0]);
  }
  console.log('   (Cuántos de esos tokens están vencidos NO se puede saber sin mandarles algo: desde el arreglo');
  console.log('    lo apunta el registro de la nube cada vez que un aviso sale.)');
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { sitiosQueMandan, archivosDeLaNube };
