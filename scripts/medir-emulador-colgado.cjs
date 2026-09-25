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
 *   · cada puerto del emulador: los de `firebase.json` y los que el emulador
 *     abre por su cuenta (hub, logging, eventarc, tasks, websocket)
 *   · quién lo escucha, de qué proyecto es (`demo-…`) y si su padre sigue vivo
 *
 * 🔑 Los puertos se comparten entre proyectos de esta máquina: Talaria usa el
 * mismo 9199 y el mismo hub 4400. Un puerto ocupado por OTRO proyecto no es un
 * huérfano de aquí: es un choque, y se dice distinto.
 *
 * Solo sirve en Windows (pregunta con PowerShell). En otra máquina lo dice y sale.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

/** Los puertos: los que declara `firebase.json` y los que el emulador abre solo. */
function losPuertos() {
  const em = require(path.join(RAIZ, 'firebase.json')).emulators || {};
  const declarados = Object.entries(em)
    .filter(([, v]) => v && v.port)
    .map(([nombre, v]) => [Number(v.port), nombre]);
  const propios = [[4400, 'hub'], [4500, 'logging'], [9150, 'websocket de firestore'],
    [9299, 'eventarc'], [9499, 'tasks']];
  return [...declarados, ...propios];
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
  return [...new Set(salida.split(/\r?\n/).filter(Boolean))].map((f) => {
    const [puerto, pid, desde, padre, proyecto] = f.split('|');
    return { puerto: Number(puerto), nombre: nombre[puerto], pid, desde, padre, proyecto };
  });
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
    console.log('No se pudo preguntar a Windows: ' + String(e.message).split('\n')[0]);
    process.exit(1);
  }
  if (filas === null) {
    console.log('Este guion pregunta a Windows (PowerShell). Aquí no hay nada que medir.');
    process.exit(0);
  }
  console.log('== medido ' + new Date().toISOString());
  console.log('puertos que se miran: ' + losPuertos().map(([n, q]) => n + ' (' + q + ')').join(', '));
  if (!filas.length) {
    console.log('✓ ninguno está abierto: no hay emulador vivo.');
    process.exit(0);
  }
  for (const o of filas) console.log(describir(o));
  const huerfanos = filas.filter((o) => o.padre === 'MUERTO' && o.proyecto === 'demo-guajirago').length;
  console.log(huerfanos ? '🔴 ' + huerfanos + ' puerto(s) con un emulador de GuajiraGo huérfano.'
    : '✓ ningún emulador de GuajiraGo huérfano.');
}
