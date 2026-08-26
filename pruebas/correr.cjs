#!/usr/bin/env node
/**
 * ARRANQUE DE LAS PRUEBAS DE REGLAS
 *
 * Levanta el emulador de Firestore, corre las pruebas contra él y lo apaga.
 *
 *   npm test
 *
 * Por qué existe este archivo y no un comando suelto: en esta máquina `java` NO
 * está en el PATH, pero SÍ hay un Java 21 dentro de Android Studio. Sin Java el
 * emulador no arranca, y sin emulador el paso 5 de los 10 pasos no se puede
 * cumplir. Este arranque lo busca solo, así que `npm test` funciona sin que nadie
 * tenga que acordarse de nada.
 */
const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');

// Dónde puede estar el Java de esta máquina, en orden de preferencia.
const CANDIDATOS = [
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  path.join(process.env.USERPROFILE || '', '.jdks', 'jbr-17.0.14'),
  'C:\\Program Files\\Eclipse Adoptium\\jdk-21',
  'C:\\Program Files\\Java\\jdk-21',
];

function buscarJava() {
  // ¿Ya está en el PATH? Entonces no tocamos nada.
  const enPath = spawnSync('java', ['-version'], { stdio: 'ignore', shell: true });
  if (enPath.status === 0) return null;

  if (process.env.JAVA_HOME && existsSync(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))) {
    return process.env.JAVA_HOME;
  }
  for (const c of CANDIDATOS) {
    if (c && existsSync(path.join(c, 'bin', 'java.exe'))) return c;
  }
  return undefined; // no hay ninguno
}

const java = buscarJava();

if (java === undefined) {
  console.error('\n✋ NO HAY JAVA en esta máquina, y el emulador de Firestore lo necesita.');
  console.error('   Sin emulador no se pueden probar las reglas, y el paso 5 no se cumple.');
  console.error('   Se buscó en el PATH y en:');
  for (const c of CANDIDATOS) console.error('     · ' + c);
  console.error('   Solución: instalar un JDK 17 o 21 (adoptium.net, gratis) o fijar JAVA_HOME.\n');
  process.exit(1);
}

const entorno = { ...process.env };
if (java) {
  entorno.JAVA_HOME = java;
  entorno.PATH = path.join(java, 'bin') + path.delimiter + entorno.PATH;
  console.log('java: ' + path.join(java, 'bin', 'java.exe'));
} else {
  console.log('java: ya estaba en el PATH');
}

const r = spawnSync(
  'npx',
  [
    '--yes',
    'firebase-tools@15',
    'emulators:exec',
    '--only', 'firestore',
    '--project', 'demo-guajirago',
    // Va entre comillas a propósito: con shell, Windows lo partiría en trozos
    // y `firebase` creería que --test es una opción suya.
    // tarifas.test.js no necesita el emulador (es aritmética), pero se corre aquí
    // igual para que `npm test` sea UN solo comando: una prueba que hay que
    // acordarse de correr aparte es una prueba que nadie corre.
    '"node --test pruebas/reglas.test.js pruebas/tarifas.test.js pruebas/descuentos.test.js pruebas/codigoSeguridad.test.js pruebas/viajeNuevo.test.js pruebas/compartidos.test.js pruebas/avisoCalificacion.test.js pruebas/filtroChat.test.js pruebas/amarres.test.js pruebas/vaciado.test.js"',
  ],
  { cwd: RAIZ, env: entorno, stdio: 'inherit', shell: true }
);

process.exit(r.status === null ? 1 : r.status);
