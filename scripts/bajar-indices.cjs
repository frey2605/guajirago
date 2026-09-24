/**
 * BAJA LOS ÍNDICES QUE ESTÁN PUESTOS EN EL SERVIDOR.
 *
 *   node scripts/bajar-indices.cjs            <- solo los enseña
 *   node scripts/bajar-indices.cjs --escribir <- los guarda en firestore.indexes.json
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * 🔴 Los índices de Firestore vivían SOLO en la consola, sin historial — igual
 * que las reglas hasta agosto de 2026. Y eso no es solo incómodo: es peligroso.
 *
 * `firebase deploy --only firestore:indexes` **sincroniza**: si el archivo del
 * repo no trae un índice que el servidor sí tiene, ofrece BORRARLO. Así que
 * desplegar un archivo hecho a mano puede tumbar un índice que alguna consulta
 * necesite — y un índice borrado no da error de despliegue: hace que esa
 * consulta **falle en la cara del usuario**.
 *
 * Y lo que de verdad manda aquí no es saber quién usa cada índice: es que
 * **NADIE LO SABE**. Se buscó el 15-sep-2026 en los tres repos y en
 * `functions/` y no apareció ninguna consulta que necesitara los dos que ya
 * había. Eso NO es permiso para borrarlos: borrar lo que no se sabe quién usa
 * es exactamente lo que no se hace. Se bajan y se conservan.
 *
 * Por eso este guion se corre ANTES de tocar `firestore.indexes.json`: lo que
 * hay puesto se baja, y lo nuevo se añade encima. Es la misma regla que ya está
 * escrita para las reglas: *medir incluye mirar qué hay FUNCIONANDO en el
 * servidor, no solo qué hay en el repo*.
 *
 * ── QUÉ TOCA Y QUÉ NO ───────────────────────────────────────────────────────
 * No hace ninguna petición por su cuenta: le pregunta al `firebase` que ya está
 * instalado, que solo LEE. Lo único que escribe —y solo con `--escribir`— es el
 * archivo local. Y no pisa a ciegas: si ya existe y dice otra cosa, deja la
 * copia de lo que había en `firestore.indexes.json.antes`.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const DESTINO = path.join(RAIZ, 'firestore.indexes.json');

const PROYECTO = 'guajirago';

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};

const ESCRIBIR = process.argv.includes('--escribir');

/**
 * 🔴 EL VEREDICTO (`--verdicto`, 23-sep-2026) — para el botón de desplegar reglas.
 *
 * Este guion AVISA cuando el repo y el servidor no dicen lo mismo, pero siempre
 * sale en verde: es un informe para una persona. El botón de la nube necesita un
 * SÍ o un NO, y necesita distinguir los dos casos, que no son iguales ni de lejos:
 *
 *   · el REPO trae uno que el servidor no → **bien**: es un índice nuevo por crear,
 *     que es justo lo que se va a desplegar;
 *   · el SERVIDOR tiene uno que el repo no → 🔴 **peligro**: desplegar así ofrece
 *     BORRARLO, y un índice borrado no da error de despliegue — hace que la
 *     consulta que lo usaba falle en la cara del usuario.
 *
 * La comparación vive AQUÍ y no en el botón (SEGUNDA LEY): el que sabe de índices
 * es este archivo. Escribirla otra vez dentro del YAML sería el gemelo que se
 * queda viejo, y el que se queda viejo es el que nadie mira.
 */
const VERDICTO = process.argv.includes('--verdicto');

/** La huella de un índice: su contenido, no su sitio en la lista. */
const huella = (x) => JSON.stringify(x);

/**
 * Lo que el SERVIDOR tiene y el REPO no nombra. Función pura, sin red y sin
 * disco, para que se pueda probar con listas de mentira (lo hace el amarre).
 */
function loQueElRepoNoTrae(delServidor, delRepo) {
  const faltan = { indexes: [], fieldOverrides: [] };
  for (const cual of ['indexes', 'fieldOverrides']) {
    const mios = new Set((delRepo[cual] || []).map(huella));
    for (const x of delServidor[cual] || []) {
      if (!mios.has(huella(x))) faltan[cual].push(x);
    }
  }
  return faltan;
}

/**
 * 🔴 SE LE PIDE AL PROPIO `firebase`, NO SE CONVIERTE A MANO.
 *
 * La primera versión de este guion leía la API de Firestore y traducía la
 * respuesta al formato del archivo por su cuenta. Salió MAL de dos formas, y
 * las dos las encontró el careo contra `npx firebase firestore:indexes`:
 *   · quitaba el `__name__` del final de cada índice y le faltaba el `density`,
 *   · y metía una «excepción de campo» `__default__` / `*` que **no es una
 *     excepción**: es la configuración por defecto de la base. El `firebase`
 *     deja `fieldOverrides` VACÍO. Con esa entrada de más, el despliegue habría
 *     intentado cambiar cómo se indexa TODO.
 *
 * La lección es la SEGUNDA LEY aplicada a un formato: el que sabe cómo se
 * escribe este archivo es la herramienta que luego lo lee. Traducirlo aquí era
 * una segunda versión de ese conocimiento, y se separó en el primer intento.
 */
function traerDelCli() {
  const { spawnSync } = require('child_process');
  const r = spawnSync('npx', ['firebase', 'firestore:indexes', '--project', PROYECTO],
    { encoding: 'utf8', shell: true, cwd: RAIZ });
  const salida = (r.stdout || '') + '';
  const desde = salida.indexOf('{');
  if (r.status !== 0 || desde < 0) {
    throw new Error('`firebase firestore:indexes` no contestó: '
      + ((r.stderr || salida) || '').trim().slice(0, 200));
  }
  try {
    return JSON.parse(salida.slice(desde));
  } catch (e) {
    throw new Error('no entendí lo que contestó `firebase firestore:indexes`: ' + e.message);
  }
}

const enPalabras = (i) => i.collectionGroup + ': '
  + (i.fields || []).filter((f) => f.fieldPath !== '__name__')
    .map((f) => f.fieldPath + (f.arrayConfig ? '[]' : (f.order === 'DESCENDING' ? '↓' : '↑')))
    .join(' + ');

async function principal() {
  console.log('');
  console.log(C.neg + '  LOS ÍNDICES QUE ESTÁN PUESTOS EN EL SERVIDOR' + C.off);
  console.log(C.gris + '  proyecto ' + PROYECTO + C.off);
  console.log('');

  const delServidor = traerDelCli();
  const indexes = delServidor.indexes || [];
  const fieldOverrides = delServidor.fieldOverrides || [];

  if (!indexes.length) {
    console.log(C.ama + '  ⚠ ninguno. Solo los automáticos de un campo, que no se declaran.' + C.off);
  }
  for (const i of indexes) console.log('  · ' + enPalabras(i));
  console.log('');
  console.log(C.gris + '  excepciones de campo: ' + fieldOverrides.length + C.off);

  const nuevo = JSON.stringify({ indexes, fieldOverrides }, null, 2) + '\n';

  // 🔴 EL VEREDICTO, antes que nada: es lo único que puede PARAR un despliegue.
  if (VERDICTO) {
    const delRepo = fs.existsSync(DESTINO)
      ? JSON.parse(fs.readFileSync(DESTINO, 'utf8'))
      : { indexes: [], fieldOverrides: [] };
    const faltan = loQueElRepoNoTrae({ indexes, fieldOverrides }, delRepo);
    const cuantos = faltan.indexes.length + faltan.fieldOverrides.length;

    // La dirección CONTRARIA no es un peligro, es una noticia: son los que se van a
    // CREAR. Se dice porque un índice nuevo TARDA en construirse, y mientras tanto
    // el servidor contesta «that index is currently building and cannot be used yet»
    // a la consulta que lo necesita — o sea, pantalla en blanco si se publica la app
    // en esa ventana. Eso ya pasó el 15-sep-2026 y está escrito en CLAUDE.md.
    const nuevos = loQueElRepoNoTrae(delRepo, { indexes, fieldOverrides });
    const cuantosNuevos = nuevos.indexes.length + nuevos.fieldOverrides.length;
    if (cuantosNuevos) {
      console.log(C.ama + '  ⚠ el repo trae ' + cuantosNuevos + ' que el servidor NO tiene: '
        + 'se van a CREAR.' + C.off);
      for (const i of nuevos.indexes) console.log(C.ama + '     + ' + enPalabras(i) + C.off);
      console.log(C.gris + '    Un índice nuevo tarda en construirse, y hasta que esté la '
        + 'consulta que lo usa' + C.off);
      console.log(C.gris + '    falla. NO se publica la app en esa ventana.' + C.off);
      console.log('');
    }

    if (!cuantos) {
      console.log(C.ver + '  ✓ el repo NO se deja fuera nada de lo que hay puesto: '
        + 'desplegar no borraría ningún índice.' + C.off);
      console.log('');
      return;
    }
    console.log(C.roj + C.neg + '  ⛔ EL SERVIDOR TIENE ' + cuantos
      + ' COSA(S) QUE firestore.indexes.json NO TRAE.' + C.off);
    for (const i of faltan.indexes) console.log(C.roj + '     · índice  ' + enPalabras(i) + C.off);
    for (const f of faltan.fieldOverrides) {
      console.log(C.roj + '     · excepción de campo  ' + (f.collectionGroup || '?')
        + '.' + (f.fieldPath || '?') + C.off);
    }
    console.log('');
    console.log(C.ama + '  Desplegar así OFRECERÍA BORRARLOS, y un índice borrado no da error de'
      + C.off);
    console.log(C.ama + '  despliegue: hace que la consulta que lo usaba falle en la cara del '
      + 'usuario.' + C.off);
    console.log(C.gris + '  Se arregla bajando primero lo que hay: '
      + 'node scripts/bajar-indices.cjs --escribir' + C.off);
    console.log('');
    process.exit(1);
  }

  console.log('');
  if (!ESCRIBIR) {
    const hay = fs.existsSync(DESTINO);
    if (hay && fs.readFileSync(DESTINO, 'utf8') === nuevo) {
      console.log(C.ver + '  ✓ firestore.indexes.json ya dice exactamente esto.' + C.off);
    } else if (hay) {
      console.log(C.ama + '  ⚠ firestore.indexes.json DICE OTRA COSA que el servidor.' + C.off);
      console.log(C.gris + '    (eso puede estar bien —un índice nuevo por desplegar— o puede '
        + 'que falte uno' + C.off);
      console.log(C.gris + '     que el servidor sí tiene, y entonces el despliegue ofrecería '
        + 'BORRARLO.)' + C.off);
    } else {
      console.log(C.ama + '  ⚠ firestore.indexes.json no existe todavía.' + C.off);
    }
    console.log(C.gris + '    Para guardarlo: node scripts/bajar-indices.cjs --escribir' + C.off);
  } else {
    if (fs.existsSync(DESTINO)) {
      const antes = fs.readFileSync(DESTINO, 'utf8');
      if (antes === nuevo) {
        console.log(C.ver + '  ✓ ya estaba igual: no toco el archivo.' + C.off);
        console.log('');
        return;
      }
      // No se pisa a ciegas: se deja la copia de lo que había al lado.
      fs.writeFileSync(DESTINO + '.antes', antes, 'utf8');
      console.log(C.ama + '  ⚠ había uno distinto. Lo de antes queda en '
        + 'firestore.indexes.json.antes' + C.off);
    }
    fs.writeFileSync(DESTINO, nuevo, 'utf8');
    console.log(C.ver + '  ✓ guardado en firestore.indexes.json (' + indexes.length
      + ' índices, ' + fieldOverrides.length + ' excepciones)' + C.off);
    console.log(C.gris + '    Ahora ya se puede AÑADIR el nuevo sin borrar los que hay.' + C.off);
  }
  console.log('');
}

// 🔴 Solo corre si se le llama a él. Antes se ejecutaba con solo cargarlo, así que
// el amarre no podía probar la comparación sin salir a pedirle los índices al
// servidor de verdad — o sea, no podía probarla.
if (require.main === module) {
  principal().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
}

module.exports = { loQueElRepoNoTrae };
