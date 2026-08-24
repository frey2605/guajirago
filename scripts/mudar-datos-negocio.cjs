#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LA MUDANZA · lleva los datos del dueño al cuarto de atrás de su negocio
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   node scripts/mudar-datos-negocio.cjs              ← SIMULACRO (no escribe)
 *   node scripts/mudar-datos-negocio.cjs --aplicar    ← escribe de verdad
 *
 * POR DEFECTO NO ESCRIBE. Hay que pedirlo con --aplicar a propósito.
 *
 *
 * QUÉ HACE, Y QUÉ NO HACE
 *
 * El documento `restaurantes/{id}` es el escaparate: la app del pasajero se
 * descarga la colección entera. Dentro viajaban los datos personales del dueño.
 * La tanda 1a creó el cuarto de atrás (`restaurantesPrivado/{id}`) y el registro
 * de un negocio NUEVO ya escribe ahí. Este script trae a los que ya existían.
 *
 * COPIA. NO BORRA NADA. El escaparate se queda exactamente igual — vaciarlo es
 * la tanda 2, y va aparte a propósito: así, si algo sale mal aquí, los datos
 * siguen en su sitio de siempre y no se ha perdido nada.
 *
 * Tampoco pisa un cuarto que ya exista. Y esa promesa la sostiene el SERVIDOR,
 * no una comprobación de este script — mira más abajo «LOS TRES CANDADOS».
 *
 *
 * DE DÓNDE SACA QUÉ ES PRIVADO
 *
 * De `guajirago-aliados/src/negocioPrivado.js`, que es el ÚNICO sitio donde vive
 * esa lista (SEGUNDA LEY). No tiene una copia suya a propósito: si la tuviera,
 * el día que alguien añada un campo privado, la mudanza se quedaría vieja y
 * dejaría ese dato en el escaparate sin que nadie se enterara.
 *
 *
 * LOS TRES CANDADOS — por qué no puede borrar datos aunque falle algo
 *
 * Esto no estaba en la primera versión, y la segunda opinión del 24-ago-2026 lo
 * cazó. El agujero era este: `traer()` no miraba si la lectura había fallado.
 * Un 500 pasajero, un corte de red o una sesión caducada devolvían una lista
 * VACÍA, todos los negocios parecían «no tienen cuarto», y como el PATCH de
 * Firestore SIN updateMask REEMPLAZA el documento entero, los habría pisado
 * todos — llevándose por delante el token de avisos que escribe el teléfono del
 * dueño y el saldo que escribe el panel. Y el resumen habría dicho «mudados 3».
 *
 * O sea: la cabecera prometía algo que el código no cumplía. Ahora lo cumple, y
 * por tres sitios distintos:
 *
 *   1. `currentDocument.exists=false` en la escritura. Es el SERVIDOR quien
 *      rechaza si el cuarto ya existe. No depende de que este script acierte, y
 *      cierra también la carrera de que el dueño abra su app justo mientras esto
 *      corre.
 *   2. `updateMask` con los campos exactos que copia. Aunque todo lo demás
 *      fallara, no puede tocar un campo que no esté en esa lista.
 *   3. `traer()` revienta si la lectura no sale bien. Una lectura fallida no se
 *      puede parecer a «no hay nada».
 *
 *
 * CÓMO ENTRA AL SERVIDOR
 *
 * Con la sesión que el CLI de firebase ya tiene abierta en esta máquina. No hay
 * ninguna clave tuya escrita aquí. Si no has entrado nunca: `firebase login`.
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
 * hecho — descubre solo los nombres exportados. Esto es un gemelo pequeño de la
 * SEGUNDA LEY. No se unifica aquí porque unificar es trabajo aparte, con su
 * permiso y sus 10 pasos (PRIMERA LEY). Queda dicho para que se haga.
 */
function listaDeCamposPrivados() {
  const ruta = path.join(RAIZ, 'guajirago-aliados/src/negocioPrivado.js');
  if (!fs.existsSync(ruta)) {
    say(C.rojo + 'No está guajirago-aliados/src/negocioPrivado.js en el disco.' + C.off);
    say('Ese archivo es el ÚNICO que dice qué es privado. Sin él, esta mudanza');
    say('tendría que adivinar, y adivinar con datos de personas no se hace.');
    process.exit(1);
  }
  const fuente = fs.readFileSync(ruta, 'utf8').replace(/^export\s+/gm, '');
  try {
    // eslint-disable-next-line no-new-func
    return new Function(fuente + '\nreturn { CAMPOS_PRIVADOS, COLECCION_PRIVADA };')();
  } catch (e) {
    say(C.rojo + 'No se pudo leer la lista de negocioPrivado.js: ' + e.message + C.off);
    say('');
    say('Las dos causas de siempre:');
    say('  · Le añadieron un import. Ese archivo NO puede importar nada — lo dice');
    say('    su propia cabecera. Si hace falta importar algo, saca la lista a un');
    say('    archivo aparte que siga sin imports.');
    say('  · Le cambiaron el nombre a CAMPOS_PRIVADOS o a COLECCION_PRIVADA.');
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
      // Estos dos son los del CLI de firebase, que van dentro de cada instalación
      // y son públicos a propósito. NO es una llave del proyecto ni se filtró
      // nada: sin la sesión abierta de tu máquina no sirven para entrar a nada.
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

/**
 * CANDADO 3 · una lectura que falla NO puede parecerse a «no hay nada».
 * Revienta a propósito: si esto devolviera una lista vacía por un error de red,
 * la mudanza creería que ningún negocio tiene cuarto y los pisaría todos.
 */
async function traer(t, coleccion) {
  let pt = ''; const out = [];
  for (;;) {
    const r = await fetch(BASE + '/' + coleccion + '?pageSize=300' + (pt ? '&pageToken=' + pt : ''), { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) {
      throw new Error('no se pudo leer «' + coleccion + '»: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200) +
        '\n   Se para aquí a propósito. Una lectura a medias haría creer a la mudanza que' +
        '\n   los negocios no tienen cuarto, y los reemplazaría enteros. Vuelve a intentarlo.');
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
  if (v == null) return '(vacío)';
  if (v.stringValue !== undefined) return '"' + v.stringValue + '"';
  if (v.integerValue !== undefined) return String(v.integerValue);
  if (v.doubleValue !== undefined) return String(v.doubleValue);
  if (v.booleanValue !== undefined) return String(v.booleanValue);
  if (v.nullValue !== undefined) return '(nulo)';
  return JSON.stringify(v);
}

(async () => {
  const { CAMPOS_PRIVADOS, COLECCION_PRIVADA } = listaDeCamposPrivados();
  const t = await token();

  say('');
  say(C.neg + (APLICAR ? '🚚 MUDANZA DE VERDAD' : '🔍 SIMULACRO — no se escribe nada') + C.off);
  say(C.gris + '   proyecto: ' + PROYECTO + '   ·   cuarto: ' + COLECCION_PRIVADA + C.off);
  say(C.gris + '   campos privados (de negocioPrivado.js): ' + CAMPOS_PRIVADOS.join(', ') + C.off);
  say(C.gris + '   la escritura solo entra si el cuarto NO existe: lo comprueba el servidor' + C.off);
  say('');

  const negocios = await traer(t, 'restaurantes');
  const cuartos = new Set((await traer(t, COLECCION_PRIVADA)).map((d) => d.id));

  let candidatos = 0; let escritos = 0; let fallados = 0; let yaTenian = 0; let sinNada = 0;

  for (const n of negocios) {
    const nombre = (n.campos.nombre && n.campos.nombre.stringValue) || '(sin nombre)';
    const aMudar = {};
    CAMPOS_PRIVADOS.forEach((campo) => {
      if (n.campos[campo] !== undefined) aMudar[campo] = n.campos[campo];
    });
    const nombresDeCampo = Object.keys(aMudar);

    if (cuartos.has(n.id)) {
      yaTenian++;
      say(C.ama + '  ─ ' + nombre + C.off + C.gris + '  ya tiene su cuarto — NO se toca' + C.off);
      continue;
    }
    if (nombresDeCampo.length === 0) {
      sinNada++;
      say(C.gris + '  ─ ' + nombre + '  no lleva ningún dato privado dentro — nada que mudar' + C.off);
      continue;
    }

    candidatos++;
    say(C.verde + '  ✔ ' + nombre + C.off + C.gris + '   (' + n.id + ')' + C.off);
    nombresDeCampo.forEach((campo) => {
      say('       ' + campo.padEnd(16) + ' → ' + enCristiano(aMudar[campo]));
    });
    say(C.gris + '       el escaparate NO se toca: estos campos siguen ahí hasta la tanda 2' + C.off);

    if (APLICAR) {
      // CANDADOS 1 y 2: el servidor rechaza si el cuarto ya existe, y solo
      // pueden entrar estos campos exactos. Ni una carrera ni un fallo de
      // lectura pueden hacer que esto pise nada.
      const p = new URLSearchParams();
      nombresDeCampo.forEach((campo) => p.append('updateMask.fieldPaths', campo));
      p.append('currentDocument.exists', 'false');
      const r = await fetch(BASE + '/' + COLECCION_PRIVADA + '/' + n.id + '?' + p.toString(), {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: aMudar }),
      });
      if (!r.ok) {
        fallados++;
        const cuerpo = (await r.text()).slice(0, 200);
        // 409 es lo que contesta Firestore cuando el candado 1 salta. Comprobado
        // contra el servidor de verdad el 24-ago-2026: HTTP 409 «Document already
        // exists», y el documento se queda intacto. El 400 va por si acaso.
        if ((r.status === 409 || r.status === 400) && cuerpo.includes('already exists')) {
          say(C.ama + '       NO se escribió: el cuarto apareció mientras esto corría. Bien así —' + C.off);
          say(C.ama + '       el que vale es el que ya está guardado, no el que calcularía esto.' + C.off);
        } else {
          say(C.rojo + '       FALLÓ: ' + r.status + ' ' + cuerpo + C.off);
        }
        process.exitCode = 1;
      } else {
        escritos++;
        say(C.verde + '       mudado' + C.off);
      }
    }
    say('');
  }

  say('');
  say(C.neg + 'RESUMEN' + C.off);
  say('   negocios en total .......... ' + negocios.length);
  if (APLICAR) {
    say('   mudados de verdad .......... ' + escritos);
    if (fallados) say(C.rojo + '   NO se pudieron mudar ........ ' + fallados + C.off);
  } else {
    say('   se mudarían ................ ' + candidatos);
  }
  say('   ya tenían cuarto (intactos)  ' + yaTenian);
  say('   sin datos privados dentro .. ' + sinNada);
  say('');
  if (!APLICAR) {
    say(C.ama + '   Esto era un SIMULACRO. No se escribió nada.' + C.off);
    say(C.gris + '   Para hacerlo de verdad: node scripts/mudar-datos-negocio.cjs --aplicar' + C.off);
  } else if (fallados) {
    say(C.rojo + '   Quedó algo sin mudar. Mira las líneas de arriba y vuelve a correrlo:' + C.off);
    say(C.gris + '   repetirlo es seguro, los que ya están hechos no se tocan.' + C.off);
  } else {
    say(C.gris + '   Ahora toca comprobarlo LEYENDO del servidor, no fiarse de este resumen.' + C.off);
  }
  say('');
})().catch((e) => { say(''); say(C.rojo + 'FALLÓ: ' + e.message + C.off); say(''); process.exit(1); });
