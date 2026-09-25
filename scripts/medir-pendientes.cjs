/**
 * LO QUE BLOQUEA — ¿sigue abierto lo que plan/D-PENDIENTES.md dice que bloquea?
 *
 *   node scripts/medir-pendientes.cjs     <- No toca datos. Solo escribe lo que escribe un `git fetch`.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * La noche del 24-sep-2026 el anexo D decía que bloqueaban cinco cosas (P1–P5) y que el
 * guardián tenía la puerta de atrás abierta (N1–N3). Medido ese día: cuatro de
 * los cinco bloqueos y los tres del guardián se habían cerrado esa misma tarde.
 * La lista escrita para que nada se perdiera mandaba a trabajar en lo hecho.
 *
 * ── LO QUE CUENTA ───────────────────────────────────────────────────────────
 *   · main en esta máquina contra main en el SERVIDOR (ls-remote, no origin/main)
 *   · commits que le faltan a main, y ramas del servidor sin fusionar
 *   · botones de despliegue escritos, los que están EN main, y si GitHub los
 *     tiene encendidos (desde el 24-sep-2026 cuatro van APAGADOS: se publica
 *     desde el PC)
 *   · las últimas corridas de GitHub Actions (necesita `gh` con sesión)
 *   · si los arreglos N1, N2 y N3 del guardián están en main
 *   · los dos repos hermanos: rama, commits sin empujar, ramas sin fusionar
 *
 * Lo que NO cuenta: los permisos de la llave de servicio (P3). Eso se ve en la
 * consola de Google, no desde aquí.
 */
const { execSync } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const sh = (c, cwd = RAIZ) => {
  try {
    return execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return 'ERROR: ' + String(e.stderr || e.message).trim().split('\n')[0];
  }
};
const fila = (k, v) => console.log(k.padEnd(52) + ' ' + v);

console.log('== medido ' + new Date().toISOString());
sh('git fetch -q origin');
fila('HEAD local', sh('git rev-parse --short HEAD'));
fila('main en el SERVIDOR (ls-remote)', sh('git ls-remote origin refs/heads/main').slice(0, 7));
fila('commits que le faltan a main (origin/main..HEAD)', sh('git rev-list --count origin/main..HEAD'));
fila('ramas del servidor sin fusionar en main', sh('git branch -r --no-merged origin/main').replace(/\s+/g, ' '));
fila('botones escritos (.github/workflows)', sh('git ls-files .github/workflows').split('\n').filter(Boolean).length);
fila('botones EN origin/main', sh('git ls-tree -r --name-only origin/main -- .github/workflows').split('\n').filter(Boolean).length);
fila('botones ENCENDIDOS en GitHub', '\n' + sh('gh workflow list --all --json path,state -q ".[] | \\"   \\(.state) \\(.path)\\""'));
fila('corridas de Actions (últimas 5)', '\n' + sh('gh run list -L 5 --json conclusion,name,createdAt -q ".[] | \\"   \\(.createdAt) \\(.conclusion) \\(.name)\\""'));
for (const n of ['N1', 'N2', 'N3'])
  fila(n + ' en origin/main', sh(`git log origin/main --format="%h %cs %s" -E --grep="^${n}:"`) || 'NO');
for (const r of ['guajirago-admin', 'guajirago-aliados']) {
  const cwd = path.join(RAIZ, r);
  sh('git fetch -q origin', cwd);
  fila(r + ' rama actual', sh('git rev-parse --abbrev-ref HEAD', cwd));
  fila(r + ' sin empujar', sh('git rev-list --count @{u}..HEAD', cwd));
  fila(r + ' ramas del servidor sin fusionar', sh('git branch -r --no-merged origin/HEAD', cwd).replace(/\s+/g, ' ') || '(ninguna)');
}
