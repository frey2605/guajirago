#!/usr/bin/env node
/**
 * AVISO DE CONSOLA — hook PostToolUse. Corre DESPUÉS de cada comando de consola.
 *
 * 🔴 POR QUÉ EXISTE (24-sep-2026). El candado (`.claude/candado.cjs`) es un
 *  hook PreToolUse y solo lo llaman Write, Edit y NotebookEdit. Un `sed -i`, un
 *  `cat > archivo` o un `>>` escriben por la consola y el candado NI SE ENTERA:
 *  no lo niega, no lo anota, no dice nada. Eso lo dice la cabecera del propio
 *  candado desde el primer día — no es un hallazgo de nadie.
 *
 *  Lo que SÍ estaba mal es que `CLAUDE.md` prometía otra cosa: «corre antes de
 *  cada escritura: si el archivo no está declarado, la escritura no se hace».
 *  El mismo candado descrito en dos papeles que no dicen lo mismo, que es la
 *  SEGUNDA LEY rota en su peor forma — y el que se quedó viejo es el que todo
 *  el mundo lee. Mordió el 24-sep-2026: se leyeron las leyes, se creyó que
 *  había vigilancia, y se trabajó por consola sin ninguna.
 *
 * ⚠️ LO QUE ESTO NO HACE, Y HAY QUE DECIRLO: **no impide nada**. Un hook
 *  PostToolUse corre cuando el comando YA se ejecutó, así que esto no es un
 *  candado: es un testigo. Avisa después. La negación en el momento sigue
 *  existiendo solo para Write/Edit/NotebookEdit, y `CLAUDE.md` ya lo dice así.
 *
 * 🔑 POR QUÉ NO ES LA REVISIÓN ENTERA. Medido el 24-sep-2026 ejecutándolo:
 *  `node scripts/guardian.cjs revisar` tarda **16,09 s**; la pregunta barata
 *  —«¿qué está sucio fuera de la promesa?»— tarda **18 milésimas**. Un
 *  vigilante de 16 segundos por comando no se queda puesto: se apaga. Éste
 *  cuesta lo que el arranque de node y se puede tener siempre.
 *
 * 🔑 Y NO PREGUNTA POR FORMAS DE ESCRIBIR. No mira si el comando lleva `sed`,
 *  `>` o un heredoc: perseguir formas de escribir no acaba nunca (está pagado
 *  tres veces en este repo). Pregunta **QUÉ CAMBIÓ**, que es lo que importa —
 *  así caza también las que nadie ha pensado todavía, y no se queja de un `sed`
 *  que no escribió nada.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// El criterio y la lectura de git salen del guardián, no se vuelven a escribir
// aquí (SEGUNDA LEY). La copia de un criterio es la mitad que se separa.
const { fueraDeLaFoto, cambiados, reposVivos, FOTO } = require('../scripts/guardian.cjs');

// Lo ya avisado, para no repetir el mismo aviso en cada comando. Vive FUERA del
// repo a propósito: un archivo más dentro sería un papel nuevo que el guardián
// tendría que aprender a ignorar. Que sea pasajero no importa — lo peor que
// pasa si se pierde es que avise una vez de más.
const MEMORIA = path.join(os.tmpdir(), 'guajirago-aviso-consola.json');

/** Sale sin decir nada. El aviso jamás puede tumbar el trabajo. */
function callar() { process.exit(0); }

function hablar(texto) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: texto,
    },
  }));
  process.exit(0);
}

let evento;
try {
  evento = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch (e) {
  callar(); // sin entrada no hay nada que juzgar
}

if ((evento.tool_name || '') !== 'Bash') callar();

// ─────────────────── la pregunta barata ───────────────────
let fuera;
let hayFoto = true;
try {
  let declarados = [];
  let previos = [];
  if (fs.existsSync(FOTO)) {
    const f = JSON.parse(fs.readFileSync(FOTO, 'utf8'));
    declarados = f.archivos || [];
    for (const repo of Object.keys(f.estado || {})) {
      for (const r of (f.estado[repo] || {}).suciosPrevios || []) previos.push(r);
    }
  } else {
    hayFoto = false;
  }

  const sucios = [];
  for (const repo of reposVivos()) {
    for (const c of cambiados(repo)) sucios.push(c.ruta);
  }
  fuera = fueraDeLaFoto(sucios, declarados, previos);
} catch (e) {
  // 🔴 NO SE CALLA UN FALLO PROPIO (REGLA 9). Un vigilante que se rompe y no lo
  //  dice es peor que no tenerlo: deja creer que está mirando.
  hablar('⚠ EL AVISO DE CONSOLA NO PUDO COMPROBAR NADA: ' + e.message +
    '\n  O sea: en este comando NO hubo vigilancia. No lo leas como «todo bien».');
}

if (!fuera.length) callar();

// ─────────────────── solo lo nuevo ───────────────────
// Se avisa de un archivo la PRIMERA vez que aparece fuera de la promesa, no en
// cada comando: un vigía que grita siempre se deja de mirar. Si aparece uno
// nuevo, vuelve a hablar — lo que se calla es la repetición, no el hallazgo.
let yaAvisados = [];
try {
  yaAvisados = JSON.parse(fs.readFileSync(MEMORIA, 'utf8'));
  if (!Array.isArray(yaAvisados)) yaAvisados = [];
} catch (e) { yaAvisados = []; }

const nuevos = fuera.filter((r) => !yaAvisados.includes(r));
if (!nuevos.length) callar();

try {
  fs.writeFileSync(MEMORIA, JSON.stringify([...new Set([...yaAvisados, ...nuevos])]));
} catch (e) { /* sin memoria avisa de más, que es el lado bueno de equivocarse */ }

const cabecera = hayFoto
  ? '🔴 ESTO CAMBIÓ Y NO ESTÁ EN LA PROMESA GRABADA:'
  : '🔴 ESTO CAMBIÓ Y NO HAY NINGUNA PROMESA GRABADA (falta la foto del guardián):';

hablar(
  cabecera + '\n' +
  nuevos.map((r) => '  · ' + r).join('\n') + '\n\n' +
  'El candado NO pudo negarlo: lo escribió un comando de consola, y el candado\n' +
  'solo corre antes de Write, Edit y NotebookEdit. Esto es un aviso DESPUÉS, no\n' +
  'una negación — el cambio ya está hecho.\n\n' +
  'PRIMERA LEY: solo se toca lo que se pidió reparar.\n' +
  '  · Si hacía falta: PARA, explícale al dueño por qué, y espera permiso.\n' +
  '  · Si no hacía falta: deshazlo (git checkout -- <archivo>).\n' +
  '  · Si el dueño ya dijo que sí: anótalo en .guardian-excepciones.log con fecha,\n' +
  '    motivo y cómo se deshace.'
);
