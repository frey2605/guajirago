/**
 * EL EMULADOR COLGADO — ¿quién tiene abiertos los puertos del emulador, y está huérfano?
 *
 *   node scripts/medir-emulador-colgado.cjs     <- SOLO LEE. No cierra nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12. Y el guardián usa su
 * `quienOcupa` cuando las pruebas no pasan o no terminan: una sola pieza para las
 * dos preguntas (SEGUNDA LEY).
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El 24-sep-2026 a las 23:55 el guardián corrió `npm test`, la tanda terminó, y
 * el Java del emulador de Firestore se quedó vivo con su padre ya muerto. El
 * guardián esperaba la salida que ese Java seguía reteniendo, y se quedó colgado
 * para siempre. Y el puerto ocupado hizo fallar la siguiente tanda con un falso
 * «rompiste algo que funcionaba». Hubo que matar los dos a mano.
 * Qué dejó huérfano a ese Java NO está medido: chocar dos tandas a propósito el
 * 25-sep no lo reprodujo.
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *   · cada puerto que abre el emulador de la tanda: los tres declarados en
 *     `firebase.json` y los que firebase-tools abre solo (hub, registro, eventarc,
 *     tareas, websocket), con el número que saca `scripts/medir-puertos-emulador.cjs`
 *   · quién lo escucha, de qué proyecto es (`demo-…`) y si su padre sigue vivo
 *
 * 🔑 Desde el 25-sep-2026 firestore, functions y storage tienen puertos PROPIOS,
 * declarados en `firebase.json`: antes eran los de fábrica, los mismos de cualquier
 * proyecto Firebase de la máquina. Los demás siguen siendo los de fábrica A PROPÓSITO:
 * si están ocupados, firebase-tools busca otro solo. Por eso un proyecto ajeno en uno
 * de ellos no es un huérfano de aquí: es un choque, y se dice distinto.
 *
 * Solo sirve en Windows (pregunta con PowerShell). En otra máquina lo dice y sale.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/**
 * Los puertos: los mismos que cuenta `scripts/medir-puertos-emulador.cjs`, que los lee de
 * `firebase.json` y de la firebase-tools de la tanda. Antes iban copiados aquí con su
 * número de fábrica: el gemelo que se queda viejo (SEGUNDA LEY).
 * 🔑 Si no encuentra firebase-tools, NO se queda ciego: mira al menos los que declara
 * `firebase.json` y lo DICE en `incompleta` (una propiedad de la lista). Hasta el 25-sep
 * reventaba y no se miraba ninguno, ni los tres que sí se conocían.
 */
function losPuertos() {
  const { losDeFabrica, losDeGuajiraGo } = require('./medir-puertos-emulador.cjs');
  try {
    return losDeGuajiraGo(losDeFabrica()).map((f) => [f.puerto, f.nombre]);
  } catch (e) {
    // Solo cuando FALTA firebase-tools. Cualquier otro error (un pruebas/correr.cjs que no se lee,
    // una firebase-tools que cambió) sigue reventando: la red no puede esconder otro fallo.
    if (!/no encontré la firebase-tools/.test(e.message)) throw e;
    const em = require(path.join(RAIZ, 'firebase.json')).emulators || {};
    const declarados = Object.entries(em)
      .filter(([, v]) => v && v.port)
      .map(([nombre, v]) => [Number(v.port), nombre]);
    if (em.firestore && em.firestore.websocketPort) {
      declarados.push([Number(em.firestore.websocketPort), 'firestore (websocket)']);
    }
    declarados.incompleta = 'solo se miraron los ' + declarados.length + ' puertos declarados en firebase.json; '
      + 'los que firebase-tools abre por su cuenta NO se pudieron mirar, porque: ' + String(e.message).split('\n')[0];
    return declarados;
  }
}

/**
 * Quién escucha en los puertos del emulador: [{ puerto, nombre, pid, desde, padre, proyecto }].
 * Fuera de Windows devuelve `null` (no se puede preguntar), que NO es lo mismo que «nadie».
 * Si Windows no contesta, revienta: callarlo sería decir «nadie» sin haber mirado.
 */
function quienOcupa() {
  if (process.platform !== 'win32') return null;
  const puertos = losPuertos();
  const ps = `
$p = @(${puertos.map(([n]) => n).join(',')})
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $p -contains $_.LocalPort } | ForEach-Object {
  $pr = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"
  $padre = if ($pr) { Get-Process -Id $pr.ParentProcessId -ErrorAction SilentlyContinue } else { $null }
  $cmd = if ($pr -and $pr.CommandLine) { $pr.CommandLine } else { '' }
  $proy = if ($cmd -match '(demo-[\\w-]+)') { $Matches[1] } else { '?' }
  "$($_.LocalPort)|$($_.OwningProcess)|$(if ($pr) { $pr.CreationDate.ToString('yyyy-MM-dd HH:mm') })|$(if ($padre) { 'vivo' } else { 'MUERTO' })|$proy"
}`;
  // Con tiempo máximo: el guardián llama aquí justo cuando algo se colgó, y un
  // PowerShell colgado lo volvería a colgar. Si se agota, revienta y se dice.
  const salida = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps],
    { encoding: 'utf8', timeout: 60 * 1000 });
  const nombre = Object.fromEntries(puertos);
  const filas = [...new Set(salida.split(/\r?\n/).filter(Boolean))].map((f) => {
    const [puerto, pid, desde, padre, proyecto] = f.split('|');
    return { puerto: Number(puerto), nombre: nombre[puerto], pid, desde, padre, proyecto };
  });
  // Si solo se miró una parte, viaja con la respuesta: un «nadie» a medias no es un «nadie».
  if (puertos.incompleta) filas.incompleta = puertos.incompleta;
  return filas;
}

/** Un renglón legible por puerto, para este guion y para el guardián. */
function describir(o) {
  const nuestro = o.proyecto === 'demo-guajirago';
  return (o.padre === 'MUERTO' ? '🔴 HUÉRFANO ' : '·  ') + o.puerto + ' (' + o.nombre + ')  proceso ' + o.pid
    + '  desde ' + o.desde + '  padre ' + o.padre + '  proyecto ' + o.proyecto
    + (nuestro ? '' : '  ← de OTRO proyecto: choque, no huérfano de aquí');
}

module.exports = { quienOcupa, describir, losPuertos };

if (require.main === module) {
  let filas;
  try {
    filas = quienOcupa();
  } catch (e) {
    console.log('No se pudo mirar quién ocupa los puertos: ' + String(e.message).split('\n')[0]);
    process.exit(1);
  }
  if (filas === null) {
    console.log('Este guion pregunta a Windows (PowerShell). Aquí no hay nada que medir.');
    process.exit(0);
  }
  console.log('== medido ' + new Date().toISOString());
  console.log('puertos que se miran: ' + losPuertos().map(([n, q]) => n + ' (' + q + ')').join(', '));
  if (filas.incompleta) console.log('⚠ ' + filas.incompleta);
  if (!filas.length) {
    console.log(filas.incompleta ? '✓ ninguno de ESOS está abierto (los demás no se miraron).'
      : '✓ ninguno está abierto: no hay emulador vivo.');
    process.exit(0);
  }
  for (const o of filas) console.log(describir(o));
  const huerfanos = filas.filter((o) => o.padre === 'MUERTO' && o.proyecto === 'demo-guajirago').length;
  console.log(huerfanos ? '🔴 ' + huerfanos + ' puerto(s) con un emulador de GuajiraGo huérfano.'
    : '✓ ningún emulador de GuajiraGo huérfano.');
}
