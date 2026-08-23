#!/usr/bin/env node
/**
 * CANDADO — hook PreToolUse. Corre ANTES de cada escritura.
 *
 * Guardia en la puerta, no inventario al cierre: si el archivo no está en la
 * promesa grabada (.guardian-foto.json), la escritura NO SE HACE.
 *
 * Cubre: Write, Edit, NotebookEdit.
 * NO cubre: escrituras hechas desde Bash (sed, heredocs, >). Para esas manda
 * la primera ley y la revisión del guardián al final.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const FOTO = path.join(RAIZ, '.guardian-foto.json');
const EXCEPCIONES = path.join(RAIZ, '.guardian-excepciones.log');

const LEYES = [
  'LEY 1: solo se toca lo que se pidió reparar.',
  'LEY 2: dentro de un archivo permitido, solo los renglones involucrados.',
  'LEY 3: código que funciona no se mueve, no se reordena, no se embellece de paso.',
  'LEY 4: si aparece OTRO problema, se ANOTA y se dice — no se arregla aquí.',
  'LEY 5: la promesa se graba ANTES de tocar (guardian.cjs foto).',
].join('\n');

function responder(decision, razon) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: razon,
    },
  }));
  process.exit(0);
}

function anotarEscape(ruta, motivo) {
  const linea = new Date().toISOString() + '\t' + ruta + '\t' + motivo + '\n';
  try {
    fs.appendFileSync(EXCEPCIONES, linea);
  } catch (e) { /* el libro no debe tumbar el trabajo */ }
}

let entrada = '';
try {
  entrada = fs.readFileSync(0, 'utf8');
} catch (e) {
  process.exit(0); // sin entrada no hay nada que juzgar
}

let evento;
try {
  evento = JSON.parse(entrada);
} catch (e) {
  process.exit(0);
}

const herramienta = evento.tool_name || '';
if (!['Write', 'Edit', 'NotebookEdit'].includes(herramienta)) process.exit(0);

const objetivo = (evento.tool_input || {}).file_path || (evento.tool_input || {}).notebook_path || '';
if (!objetivo) process.exit(0);

const abs = path.resolve(objetivo);

// Fuera del repo (borradores, temporales): no es asunto del candado.
const dentro = abs.toLowerCase().startsWith(RAIZ.toLowerCase() + path.sep);
if (!dentro) process.exit(0);

const rel = path.relative(RAIZ, abs).replace(/\\/g, '/');

// El libro de excepciones y la foto son del sistema, no del arreglo.
if (rel === path.basename(EXCEPCIONES) || rel === path.basename(FOTO)) process.exit(0);

if (!fs.existsSync(FOTO)) {
  anotarEscape(rel, 'NEGADO: sin foto grabada');
  responder('deny',
    'CANDADO: no hay promesa grabada, así que esta escritura no se hace.\n\n' + LEYES +
    '\n\nGraba la promesa primero:\n' +
    '  node scripts/guardian.cjs foto "qué se arregla" ' + rel + ':<funcion>\n\n' +
    'Si el dueño ya dio el «dale» para otra cosa, eso no autoriza saltarse pasos.');
}

let foto;
try {
  foto = JSON.parse(fs.readFileSync(FOTO, 'utf8'));
} catch (e) {
  responder('deny', 'CANDADO: la foto está ilegible. Vuelve a grabarla con guardian.cjs foto.');
}

const declarados = (foto.archivos || []).map((a) => a.replace(/\\/g, '/'));

if (!declarados.includes(rel)) {
  anotarEscape(rel, 'NEGADO: fuera de la promesa "' + (foto.descripcion || '') + '"');
  responder('deny',
    'CANDADO: "' + rel + '" NO está en la promesa grabada.\n\n' +
    'Promesa vigente: ' + (foto.descripcion || '(sin descripción)') + '\n' +
    'Archivos declarados:\n' + declarados.map((d) => '  · ' + d).join('\n') +
    '\n\n' + LEYES +
    '\n\nSi de verdad el arreglo no sale sin tocar ese archivo: PARA, explícale al dueño\n' +
    'en cristiano por qué, y espera permiso. No lo toques y avises después.');
}

// Está declarado: pasa, pero la ley se muestra otra vez.
responder('allow',
  'Declarado en la promesa: ' + (foto.descripcion || '') + '\n\n' + LEYES +
  '\n\nSolo los renglones involucrados. Al terminar: node scripts/guardian.cjs revisar');
