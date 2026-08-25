#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EL VACIADO · saca los datos del dueño del escaparate del negocio
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/vaciar-escaparate.cjs              ← SIMULACRO (no escribe)
 *   node scripts/vaciar-escaparate.cjs --aplicar    ← borra de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 *
 *
 * QUÉ HACE
 *
 * `restaurantes/{id}` es EL ESCAPARATE: la app del pasajero se descarga esa
 * colección ENTERA para enseñar dónde pedir (guajirago/src/Restaurantes.js,
 * Turismo.js). Dentro viajaban el NOMBRE, el TELÉFONO y el CORREO del dueño, y
 * sus créditos. Le llegaban solos a cualquiera que abriera esa pantalla.
 *
 * La tanda 1b los COPIÓ al cuarto de atrás (`restaurantesPrivado/{id}`), sin
 * borrar nada. Este script hace la otra mitad: los quita del escaparate.
 *
 *
 * ESTO SÍ BORRA. POR ESO LLEVA CUATRO CANDADOS
 *
 * La mudanza podía equivocarse y como mucho no copiaba. Esto puede dejar a un
 * negocio sin los datos de su dueño en ningún sitio. No basta con tener cuidado:
 *
 *   1. NO SE BORRA NADA QUE NO ESTÉ YA GUARDADO. Antes de tocar un negocio se
 *      lee su cuarto y se comprueba campo por campo que el valor guardado es
 *      IDÉNTICO al del escaparate. Si uno solo no cuadra, ese negocio se salta
 *      entero y se dice por qué. No se borra «lo que sí cuadra»: o todo o nada.
 *   2. `currentDocument.exists=true` en la escritura. Es el SERVIDOR quien
 *      rechaza si el documento del escaparate ya no está. No depende de que este
 *      script acierte.
 *   3. `updateMask` con los campos EXACTOS que se quitan, y nada en el cuerpo.
 *      Así es un borrado de esos campos y solo de esos: aunque todo lo demás
 *      fallara, no puede tocar el menú, el logo ni el horario.
 *   4. Toda lectura que falle REVIENTA. Una lectura a medias no puede parecerse
 *      a «este negocio no tiene cuarto» ni a «ya estaba vacío».
 *
 * Y LO QUE NO HACE: no borra el documento, ni ningún campo que no esté en la
 * lista. La REGLA 12 del proyecto —los borrados dejan lápida— habla de
 * REGISTROS; aquí no desaparece ningún negocio. Y el dato no se pierde: sigue
 * entero en su cuarto, que es lo que comprueba el candado 1.
 *
 *
 * DE DÓNDE SACA QUÉ ES PRIVADO
 *
 * De `guajirago-aliados/src/negocioPrivado.js`, el ÚNICO sitio donde vive esa
 * lista (SEGUNDA LEY). No tiene una copia suya a propósito.
 *
 *
 * CÓMO ENTRA AL SERVIDOR
 *
 * Con la sesión que el CLI de firebase ya tiene abierta en esta máquina. No hay
 * ninguna clave escrita aquí. Si no has entrado nunca: `firebase login`.
 * Ojo: entra como administrador, así que SE SALTA las reglas de Firestore.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const RAIZ = path.resolve(__dirname, '..');
const PROYECTO = 'guajirago';
const APLICAR = process.argv.includes('--aplicar');

const C = { rojo: '\x1b[31m', verde: '\x1b[32m', ama: '\x1b[33m', gris: '\x1b[90m', neg: '\x1b[1m', off: '\x1b[0m' };
const say = (t) => process.stdout.write(t + '\n');

/**
 * La lista buena, ejecutando el archivo de la app. Sin copias.
 *
 * ANOTADO (24-ago-2026): `pruebas/cargar.cjs` ya tiene un cargador así, y mejor
 * hecho. Es el mismo gemelo pequeño que ya lleva anotado
 * `scripts/mudar-datos-negocio.cjs`. Unificar los tres es trabajo aparte, con su
 * permiso y sus 10 pasos (PRIMERA LEY).
 */
function listaDeCamposPrivados() {
  const ruta = path.join(RAIZ, 'guajirago-aliados/src/negocioPrivado.js');
  if (!fs.existsSync(ruta)) {
    say(C.rojo + 'No está guajirago-aliados/src/negocioPrivado.js en el disco.' + C.off);
    say('Ese archivo es el ÚNICO que dice qué es privado. Sin él, este borrado');
    say('tendría que adivinar, y adivinar antes de borrar no se hace.');
    process.exit(1);
  }
  const fuente = fs.readFileSync(ruta, 'utf8').replace(/^export\s+/gm, '');
  try {
    // eslint-disable-next-line no-new-func
    return new Function(fuente + '\nreturn { CAMPOS_PRIVADOS, COLECCION_PRIVADA };')();
  } catch (e) {
    say(C.rojo + 'No se pudo leer la lista de negocioPrivado.js: ' + e.message + C.off);
    say('  · ¿Le añadieron un import? Ese archivo NO puede importar nada.');
    say('  · ¿Le cambiaron el nombre a CAMPOS_PRIVADOS o a COLECCION_PRIVADA?');
    process.exit(1);
  }
}

async function token() {
  const ses = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(ses)) { say(C.rojo + 'No hay sesión de firebase. Corre: firebase login' + C.off); process.exit(1); }
  let refresco;
  try {
    refresco = JSON.parse(fs.readFileSync(ses, 'utf8')).tokens.refresh_token;
  } catch (e) {
    say(C.rojo + 'La sesión de firebase no tiene la forma esperada. Corre: firebase login' + C.off);
    process.exit(1);
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      // Los del CLI de firebase, públicos a propósito: sin la sesión abierta de
      // esta máquina no sirven para entrar a nada.
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: refresco,
      grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) { say(C.rojo + 'La sesión de firebase no vale ya. Corre: firebase login' + C.off); process.exit(1); }
  return x.access_token;
}

const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO + '/databases/(default)/documents';

/** CANDADO 4 · una lectura que falla NO puede parecerse a «aquí no hay nada». */
async function traer(t, coleccion) {
  let pt = ''; const out = [];
  for (;;) {
    const r = await fetch(BASE + '/' + coleccion + '?pageSize=300' + (pt ? '&pageToken=' + pt : ''), { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) {
      throw new Error('no se pudo leer «' + coleccion + '»: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200) +
        '\n   Se para aquí a propósito. Una lectura a medias haría creer a este script que' +
        '\n   un negocio no tiene cuarto, o que ya estaba vacío. Vuelve a intentarlo.');
    }
    const x = await r.json();
    for (const d of x.documents || []) out.push({ id: d.name.split('/').pop(), campos: d.fields || {} });
    pt = x.nextPageToken;
    if (!pt) break;
  }
  return out;
}

/** Enseña un valor de Firestore en cristiano, sin importar de qué tipo sea. */
function enCristiano(v) {
  if (v == null) return '(no está)';
  if (v.stringValue !== undefined) return '"' + v.stringValue + '"';
  if (v.integerValue !== undefined) return String(v.integerValue);
  if (v.doubleValue !== undefined) return String(v.doubleValue);
  if (v.booleanValue !== undefined) return String(v.booleanValue);
  if (v.nullValue !== undefined) return '(nulo)';
  return JSON.stringify(v);
}

/** Dos valores de Firestore son el mismo dato. Se comparan crudos, sin convertir. */
const mismoValor = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * EL CANDADO 1, SOLO. Decide qué hacer con UN negocio, sin tocar la red.
 *
 * Está aquí fuera —y se exporta— por una razón concreta: es lo ÚNICO que impide
 * perder los datos de una persona. La segunda opinión del 24-ago-2026 plantó dos
 * mutantes dentro del bucle (hacer que la comparación dijera siempre «cuadra», y
 * quitar el aviso de «no tiene cuarto») y NO SE ENTERÓ NADIE: todo verde. Con el
 * segundo, un negocio sin cuarto se vaciaba igual y sus datos se perdían para
 * siempre.
 *
 * Ahora lo vigila `pruebas/vaciado.test.js`, que la ejecuta caso por caso. Este
 * script se queda en el repo para que alguien lo corra dentro de un año; para
 * entonces esta prueba es lo único que va a quedar de esta conversación.
 *
 * Devuelve una de tres:
 *   · limpio  — no le queda nada privado en el escaparate, no hay que tocarlo.
 *   · saltar  — falta algo por guardar. NO se toca, ni siquiera lo que sí cuadra.
 *   · vaciar  — todo comprobado: se pueden quitar los campos de `campos`.
 *
 * @param campos            los campos del documento del escaparate, crudos de Firestore
 * @param cuarto            los del cuarto de atrás, o undefined si no existe
 * @param CAMPOS_PRIVADOS   la lista buena, de negocioPrivado.js
 */
function decidir(campos, cuarto, CAMPOS_PRIVADOS) {
  const presentes = (CAMPOS_PRIVADOS || []).filter((c) => campos[c] !== undefined);
  if (presentes.length === 0) return { accion: 'limpio', campos: [], descuadres: [] };
  // Sin cuarto no hay dónde estén guardados: esto es lo que impide la pérdida.
  if (!cuarto) return { accion: 'saltar', motivo: 'sin-cuarto', campos: presentes, descuadres: [] };
  const descuadres = presentes.filter((c) => !mismoValor(campos[c], cuarto[c]));
  if (descuadres.length) return { accion: 'saltar', motivo: 'descuadre', campos: presentes, descuadres };
  return { accion: 'vaciar', campos: presentes, descuadres: [] };
}

// Las pruebas cargan este archivo para ejecutar decidir(). Si el vaciado echara a
// andar solo al cargarlo, `npm test` se pondría a hablar con el servidor de
// verdad. Por eso lo de abajo solo corre cuando alguien lo llama a mano.
module.exports = { decidir, mismoValor };

if (require.main !== module) return;

(async () => {
  const { CAMPOS_PRIVADOS, COLECCION_PRIVADA } = listaDeCamposPrivados();
  const t = await token();

  say('');
  say(C.neg + (APLICAR ? '🧹 VACIADO DE VERDAD' : '👀 SIMULACRO — no se escribe nada') + C.off);
  say(C.gris + '   lo que sale del escaparate: ' + CAMPOS_PRIVADOS.join(', ') + C.off);
  say(C.gris + '   el cuarto de atrás: ' + COLECCION_PRIVADA + C.off);
  say('');

  const escaparate = await traer(t, 'restaurantes');
  const cuartos = await traer(t, COLECCION_PRIVADA);
  const porId = {};
  cuartos.forEach((c) => { porId[c.id] = c.campos; });

  let porVaciar = 0; let vaciados = 0; let limpios = 0; const saltados = [];

  for (const n of escaparate) {
    const nombre = (n.campos.nombre && n.campos.nombre.stringValue) || '(sin nombre)';
    const cuarto = porId[n.id];

    // ── CANDADO 1 · o todo está guardado, o no se toca nada ──────────────────
    // La decisión NO se toma aquí: la toma decidir(), que vive arriba y tiene sus
    // propias pruebas. Aquí solo se cuenta lo que dijo.
    const fallo = decidir(n.campos, cuarto, CAMPOS_PRIVADOS);
    const presentes = fallo.campos;

    if (fallo.accion === 'limpio') { limpios++; continue; }

    say(C.neg + '── ' + nombre + C.off + C.gris + '   [' + n.id + ']' + C.off);

    if (fallo.accion === 'saltar' && fallo.motivo === 'sin-cuarto') {
      say('   ' + C.rojo + 'SE SALTA: no tiene cuarto de atrás.' + C.off);
      say(C.gris + '   Borrar esto dejaría al dueño sin sus datos en ningún sitio.' + C.off);
      say(C.gris + '   Arreglo: corre antes  node scripts/mudar-datos-negocio.cjs --aplicar' + C.off);
      saltados.push(nombre + ' (sin cuarto)');
      say('');
      continue;
    }
    if (fallo.accion === 'saltar') {
      say('   ' + C.rojo + 'SE SALTA: ' + fallo.descuadres.length + ' campo(s) NO están guardados igual.' + C.off);
      for (const c of fallo.descuadres) {
        say('     ' + C.rojo + c.padEnd(15) + C.off + ' escaparate=' + enCristiano(n.campos[c]) + '   cuarto=' + enCristiano(cuarto[c]));
      }
      say(C.gris + '   No se borra ni lo que sí cuadra: o todo o nada.' + C.off);
      saltados.push(nombre + ' (' + fallo.descuadres.join(', ') + ')');
      say('');
      continue;
    }

    for (const c of presentes) {
      say('   ' + C.ama + 'sale' + C.off + ' ' + c.padEnd(15) + enCristiano(n.campos[c]) +
        C.gris + '   (guardado igual en su cuarto ✓)' + C.off);
    }

    if (!APLICAR) { porVaciar++; say(''); continue; }

    // ── CANDADOS 2 y 3 · lo impone el servidor, y solo sobre esos campos ─────
    const mascara = presentes.map((c) => 'updateMask.fieldPaths=' + encodeURIComponent(c)).join('&');
    const url = BASE + '/restaurantes/' + n.id + '?' + mascara + '&currentDocument.exists=true';
    const r = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      // Cuerpo VACÍO + updateMask = «quita justo estos campos». Nada más se toca.
      body: JSON.stringify({ fields: {} }),
    });
    if (!r.ok) {
      const detalle = (await r.text()).slice(0, 200);
      say('   ' + C.rojo + 'NO SE PUDO: HTTP ' + r.status + ' ' + detalle + C.off);
      if (r.status === 404) say(C.gris + '   El documento ya no existe. El servidor lo paró (candado 2).' + C.off);
      saltados.push(nombre + ' (HTTP ' + r.status + ')');
      say('');
      continue;
    }
    vaciados++;
    say('   ' + C.verde + 'vaciado' + C.off);
    say('');
  }

  say(C.neg + '── RESUMEN ──' + C.off);
  if (APLICAR) say('   vaciados: ' + C.verde + vaciados + C.off);
  else say('   se vaciarían: ' + C.ama + porVaciar + C.off);
  say('   ya estaban limpios: ' + limpios);
  if (saltados.length) {
    say('   ' + C.rojo + 'SALTADOS: ' + saltados.length + C.off);
    for (const s of saltados) say('     · ' + s);
  }
  if (!APLICAR && porVaciar > 0) {
    say('');
    say(C.gris + '   Esto ha sido un simulacro: NO se ha tocado nada.' + C.off);
    say(C.gris + '   Para hacerlo de verdad:  node scripts/vaciar-escaparate.cjs --aplicar' + C.off);
  }
  say('');
})().catch((e) => {
  say('');
  say(C.rojo + C.neg + '✋ SE PARA: ' + C.off + e.message);
  say('');
  process.exit(1);
});
