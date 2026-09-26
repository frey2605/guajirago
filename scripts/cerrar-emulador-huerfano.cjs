/**
 * CERRAR EL EMULADOR HUÉRFANO — apaga SOLO los procesos del emulador de pruebas que se quedaron solos.
 *
 *   node scripts/cerrar-emulador-huerfano.cjs              <- SIMULACRO: dice qué cerraría. No cierra nada.
 *   node scripts/cerrar-emulador-huerfano.cjs --de-verdad  <- cierra esos, y solo esos.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El 25-sep-2026 la tanda se colgó cinco veces y cada vez dejó el Java del emulador
 * de Firestore vivo con su padre muerto, ocupando el puerto: la tanda siguiente no
 * podía arrancar. La herramienta con la que se trabaja no deja cerrar procesos, así
 * que cada vez el dueño tenía que pegar un `Stop-Process` en PowerShell. Ese día dijo
 * «sí al guion»: uno que cierre esos huérfanos y NADA más, con un permiso escrito
 * solo para este comando.
 *
 * ── QUÉ CIERRA, Y QUÉ NO ────────────────────────────────────────────────────
 * El criterio NO se escribe aquí: sale de `scripts/medir-emulador-colgado.cjs`
 * (`quienOcupa`), el mismo que usan el medidor y el guardián (SEGUNDA LEY). Un proceso
 * es candidato solo si las TRES cosas son ciertas a la vez:
 *   · escucha en un puerto del emulador de la tanda;
 *   · es del proyecto de mentira `demo-guajirago` (lo dice su línea de comando);
 *   · su padre ya murió (una tanda en marcha tiene el padre VIVO: esa no se toca).
 * Y justo antes de cerrar cada uno se le vuelve a preguntar a Windows por ESE número
 * de proceso: entre la lista y el cierre, Windows puede haber reusado el número para
 * otro programa. Si ya no es un java/node de `demo-guajirago` con el padre muerto, se
 * deja y se dice por qué.
 *
 * Solo sirve en Windows. En otra máquina lo dice y sale sin tocar nada.
 */
const { execFileSync } = require('child_process');
const { quienOcupa } = require('./medir-emulador-colgado.cjs');

const PROYECTO = 'demo-guajirago';

/** De las filas de `quienOcupa`, los procesos que se pueden cerrar: [{ pid, puertos }]. */
function elegibles(filas) {
  if (!filas) return [];
  const porPid = new Map();
  for (const o of filas) {
    if (o.padre !== 'MUERTO' || o.proyecto !== PROYECTO || !/^\d+$/.test(String(o.pid))) continue;
    if (!porPid.has(String(o.pid))) porPid.set(String(o.pid), []);
    porPid.get(String(o.pid)).push(o.puerto);
  }
  return [...porPid].map(([pid, puertos]) => ({ pid: Number(pid), puertos }));
}

/** Lo que Windows dice HOY de un proceso: { nombre, padre, cmd }, o null si ya no existe. */
function revisarProceso(pid) {
  const ps = `$pr = Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}"
if (-not $pr) { 'NO_EXISTE' } else {
  $padre = Get-Process -Id $pr.ParentProcessId -ErrorAction SilentlyContinue
  "$($pr.Name)|$(if ($padre) { 'vivo' } else { 'MUERTO' })|$($pr.CommandLine)"
}`;
  const s = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8', timeout: 60 * 1000 }).trim();
  if (s === 'NO_EXISTE') return null;
  const [nombre, padre, ...cmd] = s.split('|');
  return { nombre, padre, cmd: cmd.join('|') };
}

/** La última palabra antes de cerrar: { si, porque }. */
function sePuedeCerrar(info) {
  if (!info) return { si: false, porque: 'ya no existe' };
  if (!/^(java|javaw|node)\.exe$/i.test(info.nombre)) return { si: false, porque: 'no es un Java ni un node (' + info.nombre + ')' };
  if (info.padre !== 'MUERTO') return { si: false, porque: 'su padre está vivo: es una tanda en marcha' };
  const proyecto = (String(info.cmd).match(/(demo-[\w-]+)/) || [])[1];
  if (proyecto !== PROYECTO) return { si: false, porque: 'no es del emulador de ' + PROYECTO + ' (' + (proyecto || 'sin proyecto') + ')' };
  return { si: true, porque: '' };
}

/** Cierra UN proceso. Es el único sitio del guion que cierra algo. */
function cerrar(pid) {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Stop-Process -Id ' + Number(pid) + ' -Force'],
    { encoding: 'utf8', timeout: 60 * 1000 });
}

/**
 * El guion entero, con sus piezas inyectables para poder probarlo sin cerrar nada de verdad.
 * Devuelve { candidatos, cerrados, saltados, quedan }.
 */
function principal({ argv = process.argv.slice(2), mirar = quienOcupa, revisar = revisarProceso, cerrarUno = cerrar, log = console.log } = {}) {
  const deVerdad = argv.includes('--de-verdad');
  const filas = mirar();
  if (filas === null) {
    log('Este guion pregunta a Windows (PowerShell). Aquí no hay nada que cerrar.');
    return { candidatos: [], cerrados: [], saltados: [], quedan: [] };
  }
  const candidatos = elegibles(filas);
  if (!candidatos.length) {
    log('✓ ningún emulador de ' + PROYECTO + ' huérfano: no hay nada que cerrar.');
    return { candidatos, cerrados: [], saltados: [], quedan: [] };
  }
  if (!deVerdad) {
    for (const c of candidatos) log('SIMULACRO · cerraría el proceso ' + c.pid + ' (puertos ' + c.puertos.join(', ') + ')');
    log('Nada se cerró. Para cerrarlos: node scripts/cerrar-emulador-huerfano.cjs --de-verdad');
    return { candidatos, cerrados: [], saltados: [], quedan: candidatos };
  }
  const cerrados = [];
  const saltados = [];
  for (const c of candidatos) {
    const d = sePuedeCerrar(revisar(c.pid));
    if (!d.si) { saltados.push({ pid: c.pid, porque: d.porque }); log('· se deja el proceso ' + c.pid + ': ' + d.porque); continue; }
    cerrarUno(c.pid);
    cerrados.push(c.pid);
    log('✓ cerrado el proceso ' + c.pid + ' (puertos ' + c.puertos.join(', ') + ')');
  }
  const quedan = elegibles(mirar());
  log(quedan.length ? '🔴 siguen ' + quedan.length + ' huérfano(s): ' + quedan.map((q) => q.pid).join(', ')
    : '✓ ya no queda ningún emulador de ' + PROYECTO + ' huérfano.');
  return { candidatos, cerrados, saltados, quedan };
}

module.exports = { elegibles, sePuedeCerrar, principal, PROYECTO };

if (require.main === module) {
  try {
    const r = principal();
    process.exit(r.quedan.length && process.argv.includes('--de-verdad') ? 1 : 0);
  } catch (e) {
    console.log('No se pudo terminar: ' + String(e.message).split('\n')[0]);
    process.exit(1);
  }
}
