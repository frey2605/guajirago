#!/usr/bin/env node
// 🤖 PROBAR UN CAMBIO — lo que corre el robot SOLO después de cada cambio publicado en pruebas.
//
// Mira qué archivos cambiaron (los que se le pasen, o los del último commit de cada uno de los
// tres repos), busca en robot/mapa.cjs qué recorridos los cubren, los corre uno tras otro y al final
// le pregunta al portero (App Check). No gasta nada del plan de Claude: es el navegador del PC.
// Dice ✓ o 🔴 por recorrido, y nombra las pantallas que cambiaron y NO tienen recorrido, para que
// el agente probador les escriba el suyo.
//   node robot/probar-cambio.cjs                 ← el último commit de cada repo
//   node robot/probar-cambio.cjs <archivo> …     ← estos archivos
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const { queProbar } = require('./mapa.cjs');

const RAIZ = path.join(__dirname, '..');
const REPOS = [['.', ''], ['guajirago-admin', 'guajirago-admin/'], ['guajirago-aliados', 'guajirago-aliados/']];

function cambiadosEnElUltimoCommit() {
  const lista = [];
  for (const [repo, prefijo] of REPOS) {
    try {
      const out = execFileSync('git', ['-C', path.join(RAIZ, repo), 'diff', '--name-only', 'HEAD~1', 'HEAD'], { encoding: 'utf8' });
      for (const f of out.split(/\r?\n/).filter(Boolean)) lista.push(prefijo + f);
    } catch (e) { /* un repo sin commit anterior no aporta nada */ }
  }
  return lista;
}

const cambiados = process.argv.length > 2 ? process.argv.slice(2).map((f) => f.replace(/\\/g, '/')) : cambiadosEnElUltimoCommit();
const { tocan, sinRecorrido } = queProbar(cambiados);
console.log('Archivos cambiados: ' + (cambiados.length ? cambiados.join(', ') : 'ninguno'));
console.log('Recorridos que tocan: ' + tocan.map((r) => r.nombre).join(', ') + '\n');

const resultado = [];
for (const r of tocan) {
  process.stdout.write('▶ ' + r.nombre + ' — ' + r.que + '\n');
  const p = spawnSync(process.execPath, [path.join(__dirname, r.archivo), ...(r.args || [])], { cwd: RAIZ, encoding: 'utf8', timeout: 240000 });
  const salida = (p.stdout || '') + (p.stderr || '');
  const ultima = salida.trim().split(/\r?\n/).slice(-3).join('\n    ');
  const ok = p.status === 0;
  resultado.push({ nombre: r.nombre, ok });
  console.log('    ' + ultima + '\n');
}
const portero = spawnSync(process.execPath, [path.join(__dirname, 'portero.cjs'), '2'], { cwd: RAIZ, encoding: 'utf8', timeout: 120000 });
console.log('▶ portero (App Check)\n    ' + ((portero.stdout || '') + (portero.stderr || '')).trim().split(/\r?\n/).slice(-1)[0] + '\n');

console.log('═══ RESUMEN');
for (const r of resultado) console.log((r.ok ? '  ✓ ' : '  🔴 ') + r.nombre);
if (sinRecorrido.length) console.log('  ⚠ SIN RECORRIDO (pedirle al agente probador que lo escriba): ' + sinRecorrido.join(', '));
process.exit(resultado.some((r) => !r.ok) ? 1 : 0);
