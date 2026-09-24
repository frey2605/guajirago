/**
 * EL AMARRE DEL BOTÓN DE DESPLEGAR
 *
 * `.github/workflows/desplegar.yml` publica la app del cliente sin que nadie mire.
 * Lleva dentro cuatro decisiones que lo hacen PROTEGER, y las cuatro se pueden
 * deshacer con un cambio de aspecto inocente que deja el botón **en verde**:
 *
 *   1. el vigía de permisos va ANTES de `npm test` — si baja, no ahorra nada;
 *   2. compilar y desplegar van con `working-directory: guajirago` — desde la raíz
 *      se publica un resto de junio y se tumba la app del cliente;
 *   3. los TRES repos se traen antes de las pruebas — sin ellos nueve archivos ni
 *      arrancan y el candado del paso 5 se ablanda sin decirlo;
 *   4. la comprobación contra la nube compara la huella de lo compilado — si se
 *      quita, el botón firma «desplegado y comprobado» sin haber mirado.
 *
 * 🔴 CÓMO ESTÁ ESCRITO, Y POR QUÉ ASÍ. Esta prueba NO pregunta «¿aparece el texto
 * en el archivo?». Pregunta **EN QUÉ PASO** está cada cosa y **EN QUÉ ORDEN** van
 * los pasos. La diferencia no es teórica: en `control-elite`, la prueba escrita
 * para vigilar su botón exige `assert.match(MANDA, /transporte\.apk/)` — o sea, que
 * el nombre aparezca EN ALGÚN SITIO del archivo— y aparece tres veces... mientras
 * la comprobación final contra la nube solo mira `elite.apk`. La prueba pasa en
 * verde con el agujero abierto. Medido el 23-sep-2026 leyendo su repo.
 *
 * 🔴 Y EL SEÑUELO MÁS FÁCIL DE TODOS AQUÍ SON MIS PROPIOS COMENTARIOS: el archivo
 * del botón explica en prosa qué hace cada paso, y al explicarlo NOMBRA
 * `npm test`, `working-directory: guajirago` y los demás. Un buscador a pelo los
 * encontraría ahí y daría por buena una vigilancia que no existe. Por eso lo
 * primero que hace `sinComentarios` es tirar todo renglón que empiece por `#`
 * —los de YAML y los de dentro de los `run:`, que también son comentarios—.
 *
 * 🔴 Y LA PRUEBA SE PRUEBA A SÍ MISMA. Al final se le dan DIEZ versiones
 * estropeadas del botón, cada una con una de las protecciones deshecha, y se le
 * exige que se queje de las diez. Un amarre que no se pone rojo con el fallo
 * puesto no es un amarre: es un adorno que da tranquilidad. Este repo ya pagó esa
 * lección tres veces (ver CLAUDE.md, «el medidor SUPONÍA»).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
// `RAIZ` sale de la casa común, no de un `..` escrito a mano: si este archivo
// cambia de carpeta, un `..` apuntaría a otro sitio y esta prueba miraría
// una carpeta de botones vacía — verde por no haber mirado nada.
const { leer, RAIZ } = require('./cargar.cjs');

const BOTON = '.github/workflows/desplegar.yml';
const YML = leer(BOTON);

const BOTON_REGLAS = '.github/workflows/desplegar-reglas.yml';
const YML_REGLAS = leer(BOTON_REGLAS);

const BOTON_PANEL = '.github/workflows/desplegar-panel-y-aliados.yml';
const YML_PANEL = leer(BOTON_PANEL);

const BOTON_NUBE = '.github/workflows/desplegar-funciones.yml';
const YML_NUBE = leer(BOTON_NUBE);

/** Fuera los comentarios: de YAML y de shell. Son el señuelo, no el código. */
function sinComentarios(yml) {
  return yml.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
}

/** El archivo partido por PASOS, que es la unidad en la que este botón decide. */
function enTrozos(yml) {
  const lineas = yml.split('\n');
  const cabeza = [];
  const pasos = [];
  for (const l of lineas) {
    if (/^ {6}- name: /.test(l)) pasos.push([l]);
    else if (pasos.length) pasos[pasos.length - 1].push(l);
    else cabeza.push(l);
  }
  return { cabeza: cabeza.join('\n'), pasos: pasos.map((p) => p.join('\n')) };
}

const losPasos = (yml) => enTrozos(sinComentarios(yml)).pasos;
const elPasoQue = (pasos, ...textos) =>
  pasos.findIndex((p) => textos.every((t) => p.includes(t)));

/**
 * EL RECORRIDO, UNA SOLA VEZ. Devuelve la lista de quejas. Lo usan tanto las
 * comprobaciones del archivo de verdad como los diez sabotajes, así que no puede
 * haber dos criterios que se separen (SEGUNDA LEY).
 */
function losFallos(yml) {
  const q = [];
  const pasos = losPasos(yml);
  const limpio = sinComentarios(yml);

  // El paso que comprueba los secretos es el único que nombra los DOS.
  const iSecretos = elPasoQue(pasos, 'FIREBASE_SERVICE_ACCOUNT', 'LEER_REPOS_HERMANOS');
  const iVigia = elPasoQue(pasos, 'hosting:channel:list');
  const iPruebas = elPasoQue(pasos, 'npm test');
  const iAdmin = elPasoQue(pasos, 'frey2605/guajirago-admin');
  const iAliados = elPasoQue(pasos, 'frey2605/guajirago-aliados');
  const iCompila = elPasoQue(pasos, 'npm run build');
  const iDespliega = elPasoQue(pasos, 'deploy --only hosting');
  const iNube = elPasoQue(pasos, 'guajirago.web.app');

  // ── 0 · Nada de lo de abajo se puede comprobar si la pieza no está ───────────
  if (iSecretos < 0) q.push('SECRETOS: ya no hay un paso que compruebe los dos secretos');
  if (iVigia < 0) q.push('VIGIA: desapareció el vigía de permisos (`hosting:channel:list`)');
  if (iPruebas < 0) q.push('PRUEBAS: el botón ya no corre `npm test`');
  if (iAdmin < 0) q.push('REPOS: ya no se trae guajirago-admin');
  if (iAliados < 0) q.push('REPOS: ya no se trae guajirago-aliados');
  if (iCompila < 0) q.push('COMPILA: ya no se compila la app');
  if (iDespliega < 0) q.push('DESPLIEGA: ya no se despliega a hosting');
  if (iNube < 0) q.push('NUBE: ya nadie le pregunta al sitio si quedó puesto');

  // ── 1 · El vigía ahorra, o no es vigía ───────────────────────────────────────
  if (iSecretos > 0) {
    q.push('SECRETOS: la comprobación de los secretos ya no es el PRIMER paso, '
      + 'así que se gasta trabajo antes de saber si se puede');
  }
  if (iVigia >= 0 && iPruebas >= 0 && iVigia > iPruebas) {
    q.push('VIGIA: quedó DESPUÉS de las pruebas, así que no ahorra nada y es un adorno');
  }

  // ── 2 · El candado del paso 5 solo vale con los tres repos ───────────────────
  for (const [i, quien] of [[iAdmin, 'guajirago-admin'], [iAliados, 'guajirago-aliados']]) {
    if (i >= 0 && iPruebas >= 0 && i > iPruebas) {
      q.push('REPOS: ' + quien + ' se trae DESPUÉS de las pruebas: nueve archivos '
        + 'ya habrán reventado por no tener el otro lado del contrato');
    }
  }

  // ── 3 · Desde dentro de guajirago/, y se mira EN SU PROPIO PASO ──────────────
  //  Aquí es exactamente donde se cae una prueba escrita a la ligera: el texto
  //  `working-directory: guajirago` aparece en el archivo aunque falte en el paso
  //  que lo necesita. Por eso se pregunta por el CUERPO del paso, no por el archivo.
  if (iCompila >= 0 && !pasos[iCompila].includes('working-directory: guajirago')) {
    q.push('COMPILA: el paso que compila NO lleva `working-directory: guajirago`. '
      + 'Desde la raíz se compila contra el `build` de junio');
  }
  if (iDespliega >= 0 && !pasos[iDespliega].includes('working-directory: guajirago')) {
    q.push('DESPLIEGA: el paso que despliega NO lleva `working-directory: guajirago`. '
      + 'Desde la raíz se publica un resto de junio y se tumba la app del cliente');
  }

  // ── 4 · Preguntarle a la nube tiene que poder decir que NO ───────────────────
  if (iNube >= 0) {
    const nube = pasos[iNube];
    if (!nube.includes('steps.compilado.outputs.archivo')) {
      q.push('NUBE: ya no compara contra lo que se acaba de compilar');
    }
    if (!nube.includes('"$SERVIDO" != "$ESPERADO"')) {
      q.push('NUBE: desapareció la comparación entre lo servido y lo compilado');
    }
    if (!nube.includes('exit 1')) {
      q.push('NUBE: ya no puede ponerse ROJA: comprueba y sigue en verde pase lo que pase');
    }
  }

  // ── 4bis · Este botón publica la APP, no las reglas ──────────────────────────
  //  Publicar la app sin las reglas que necesita la mata EN SILENCIO (paso 1 de las
  //  leyes). Antes lo cuidaba una persona; desde que el botón sale solo, lo tiene
  //  que cuidar el botón. Y no es un caso raro: 11 de los últimos 30 commits de
  //  main tocaron reglas o índices.
  const iReglas = elPasoQue(pasos, 'github.event.before');
  if (iReglas < 0) {
    q.push('REGLAS: desapareció la guardia que para si el cambio toca reglas o índices. '
      + 'El botón publicaría la app sin ellas y la mataría en silencio');
  } else {
    const g = pasos[iReglas];
    if (!g.includes("require('./firebase.json')")) {
      q.push('REGLAS: la guardia ya no le pregunta a `firebase.json` qué archivos protege. '
        + 'Una lista copiada aquí se queda vieja con un renombrado, y entonces mira en verde '
        + 'un archivo que ya no existe');
    }
    if (!g.includes('exit 1')) {
      q.push('REGLAS: la guardia ya no puede PARAR: mira y deja pasar');
    }
    if (iDespliega >= 0 && iReglas > iDespliega) {
      q.push('REGLAS: la guardia quedó DESPUÉS de desplegar, así que avisa cuando ya no sirve');
    }
    if (!/reglas_ya_estan/.test(limpio)) {
      q.push('REGLAS: el botón a mano perdió la casilla `reglas_ya_estan`, así que no hay forma '
        + 'de decir «ya las comprobé»: o queda trancado, o alguien le quitará la guardia entera');
    }
  }

  // ── 5 · El orden del final ───────────────────────────────────────────────────
  if (iPruebas >= 0 && iDespliega >= 0 && iPruebas > iDespliega) {
    q.push('CANDADO: las pruebas corren DESPUÉS de desplegar: el paso 5 dejó de ser candado');
  }
  if (iDespliega >= 0 && iNube >= 0 && iNube < iDespliega) {
    q.push('NUBE: se le pregunta al sitio ANTES de desplegar, así que contesta lo de antes');
  }

  // ── 6 · La herramienta no puede cambiar sola ─────────────────────────────────
  if (/firebase-tools@latest/.test(limpio)) {
    q.push('VERSION: `firebase-tools@latest` — el despliegue puede cambiar de '
      + 'comportamiento sin que nadie toque una letra');
  }

  return q;
}

describe('EL BOTÓN DE DESPLEGAR · sus cuatro protecciones siguen donde sirven', () => {
  it('hoy no tiene ninguna queja', () => {
    const q = losFallos(YML);
    assert.deepEqual(q, [], '🔴 el botón perdió una protección:\n  · ' + q.join('\n  · '));
  });

  it('el vigía de permisos va ANTES de las pruebas', () => {
    const pasos = losPasos(YML);
    const iVigia = elPasoQue(pasos, 'hosting:channel:list');
    const iPruebas = elPasoQue(pasos, 'npm test');
    assert.ok(iVigia >= 0, '⛔ desapareció el vigía');
    assert.ok(iVigia < iPruebas,
      '⛔ el vigía quedó después de las pruebas: ya no ahorra los minutos que existe para ahorrar');
  });

  it('compilar y desplegar van DESDE DENTRO de guajirago/', () => {
    const pasos = losPasos(YML);
    for (const [ancla, qué] of [['npm run build', 'compila'], ['deploy --only hosting', 'despliega']]) {
      const i = elPasoQue(pasos, ancla);
      assert.ok(i >= 0, '⛔ ya no hay paso que ' + qué);
      assert.ok(pasos[i].includes('working-directory: guajirago'),
        '⛔ el paso que ' + qué + ' perdió `working-directory: guajirago`: '
        + 'desde la raíz se publica el resto de junio');
    }
  });

  it('los TRES repos se traen antes de las pruebas', () => {
    const pasos = losPasos(YML);
    const iPruebas = elPasoQue(pasos, 'npm test');
    for (const repo of ['frey2605/guajirago-admin', 'frey2605/guajirago-aliados']) {
      const i = elPasoQue(pasos, repo);
      assert.ok(i >= 0, '⛔ ya no se trae ' + repo + ': el candado del paso 5 se ablanda en silencio');
      assert.ok(i < iPruebas, '⛔ ' + repo + ' llega después de las pruebas');
    }
  });

  it('la comprobación contra la nube puede ponerse ROJA', () => {
    const pasos = losPasos(YML);
    const i = elPasoQue(pasos, 'guajirago.web.app');
    assert.ok(i >= 0, '⛔ ya nadie le pregunta al sitio');
    assert.ok(pasos[i].includes('"$SERVIDO" != "$ESPERADO"'),
      '⛔ desapareció la comparación: el botón firmaría «comprobado» sin comparar nada');
    assert.ok(pasos[i].includes('exit 1'),
      '⛔ la comprobación ya no puede fallar: mira y sigue en verde pase lo que pase');
  });

  it('para si el cambio toca las REGLAS, y le pregunta a firebase.json cuáles son', () => {
    const pasos = losPasos(YML);
    const i = elPasoQue(pasos, 'github.event.before');
    assert.ok(i >= 0, '⛔ desapareció la guardia de las reglas: el botón publicaría la app sin ellas');
    assert.ok(pasos[i].includes("require('./firebase.json')"),
      '⛔ la guardia dejó de preguntarle a `firebase.json` qué proteger: una lista copiada '
      + 'se queda vieja con un renombrado y la guardia mira en verde un archivo que ya no existe');
    assert.ok(pasos[i].includes('exit 1'), '⛔ la guardia ya no puede parar el despliegue');
    assert.ok(i < elPasoQue(pasos, 'deploy --only hosting'),
      '⛔ la guardia avisa DESPUÉS de desplegar: cuando ya no sirve de nada');
  });

  it('la herramienta de desplegar está FIJADA, no `@latest`', () => {
    assert.ok(!/firebase-tools@latest/.test(sinComentarios(YML)),
      '⛔ `@latest`: el despliegue cambiaría de comportamiento sin commit');
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  🔴 Y EL AMARRE SE AMARRA A SÍ MISMO. Diez botones estropeados, uno por
  //  protección. Si alguno pasa en verde, lo de arriba es decoración.
  // ══════════════════════════════════════════════════════════════════════════
  it('y no se puede ablandar: diez botones rotos, y se queja de los diez', () => {
    const { cabeza, pasos } = enTrozos(YML);
    //  🔴 SE BUSCA EN EL PASO SIN SUS COMENTARIOS, Y ESTO COSTÓ UNA VUELTA. Los comentarios
    //  que van ANTES de un `- name:` quedan pegados al paso ANTERIOR, así que buscar en el
    //  texto crudo encuentra el paso de arriba y el sabotaje termina rompiendo otra cosa —
    //  con lo cual el amarre firma en verde sin haber probado nada. Lo cazó el propio
    //  contador de sabotajes mudos el 23-sep-2026: 2 de 6 no mordían.
    const idx = (t) => pasos.findIndex((p) => sinComentarios(p).includes(t));
    const juntar = (ps) => cabeza + '\n' + ps.join('\n');

    // Mueve el paso que contiene `de` a justo después del que contiene `tras`.
    const mover = (de, tras) => {
      const ps = [...pasos];
      const i = ps.findIndex((p) => sinComentarios(p).includes(de));
      const [trozo] = ps.splice(i, 1);
      const j = ps.findIndex((p) => sinComentarios(p).includes(tras));
      ps.splice(j + 1, 0, trozo);
      return juntar(ps);
    };
    // Quita el paso que contiene `t`.
    const quitar = (t) => juntar(pasos.filter((p, i) => i !== idx(t)));
    // Cambia `viejo` por `nuevo` SOLO dentro del paso que contiene `donde`.
    const enElPaso = (donde, viejo, nuevo) => {
      const ps = [...pasos];
      const i = idx(donde);
      ps[i] = ps[i].replace(viejo, nuevo);
      return juntar(ps);
    };

    const SABOTAJES = [
      ['el vigía, movido detrás de las pruebas', mover('hosting:channel:list', 'npm test'), 'VIGIA'],
      ['la comprobación de secretos, movida al final', mover('LEER_REPOS_HERMANOS\n', 'guajirago.web.app'), 'SECRETOS'],
      ['compilar, sin entrar a guajirago/', enElPaso('npm run build', '        working-directory: guajirago\n', ''), 'COMPILA'],
      ['desplegar, sin entrar a guajirago/', enElPaso('deploy --only hosting', '        working-directory: guajirago\n', ''), 'DESPLIEGA'],
      ['sin traer guajirago-admin', quitar('frey2605/guajirago-admin'), 'REPOS'],
      ['sin traer guajirago-aliados', quitar('frey2605/guajirago-aliados'), 'REPOS'],
      ['sin correr las pruebas', enElPaso('npm test', 'npm test', 'echo saltado'), 'PRUEBAS'],
      ['la nube, sin poder ponerse roja', enElPaso('guajirago.web.app', 'exit 1', 'exit 0'), 'NUBE'],
      ['la nube, comparándose consigo misma', enElPaso('guajirago.web.app', '"$SERVIDO" != "$ESPERADO"', '"$SERVIDO" != "$SERVIDO"'), 'NUBE'],
      ['la herramienta suelta otra vez', juntar(pasos).replace(/firebase-tools@15/g, 'firebase-tools@latest'), 'VERSION'],
      ['sin la guardia de las reglas', quitar('github.event.before'), 'REGLAS'],
      ['la guardia de las reglas, que mira y deja pasar',
        enElPaso('github.event.before', /exit 1/g, 'exit 0'), 'REGLAS'],
      ['la guardia con la lista copiada a mano en vez de preguntarle a firebase.json',
        enElPaso('github.event.before', "require('./firebase.json')", "({firestore:{rules:'firestore.rules'}})"), 'REGLAS'],
      ['la guardia de las reglas, movida detrás del despliegue',
        mover('github.event.before', 'deploy --only hosting'), 'REGLAS'],
      ['el botón a mano, sin la casilla para decir «ya las comprobé»',
        juntar(pasos).replace(/reglas_ya_estan/g, 'otra_cosa'), 'REGLAS'],
    ];

    const mudos = [];
    for (const [nombre, roto, marca] of SABOTAJES) {
      const q = losFallos(roto);
      if (!q.some((x) => x.startsWith(marca))) mudos.push(nombre + ' (esperaba ' + marca + ')');
    }
    assert.deepEqual(mudos, [],
      '🔴 EL AMARRE NO MUERDE en ' + mudos.length + ' de ' + SABOTAJES.length
      + ' sabotajes:\n  · ' + mudos.join('\n  · '));
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  EL OTRO BOTÓN: EL DE LAS REGLAS Y LOS ÍNDICES
 *
 *  Es el despliegue más peligroso del proyecto, y tiene DOS formas de hacer daño
 *  que no existen en el de la app:
 *
 *    · `--only hosting` desde la RAÍZ publica un resto de JUNIO (el `build` de la
 *      raíz) y tumba la app del cliente. Este botón corre justo ahí, así que esa
 *      palabra no puede aparecer nunca en lo que ejecuta;
 *    · el despliegue de índices SINCRONIZA: `--force` convierte «ofrece borrar»
 *      en «borra», y un índice borrado no da error de despliegue — hace que la
 *      consulta que lo usaba falle en la cara del usuario.
 *
 *  Las dos se vigilan mirando lo que se EJECUTA, con los comentarios fuera: el
 *  propio archivo explica en prosa por qué no usa ninguna de las dos, así que un
 *  buscador a pelo las encontraría ahí y se pondría rojo sin motivo — o, peor, se
 *  ablandaría para dejar de hacerlo.
 * ══════════════════════════════════════════════════════════════════════════════
 */
function losFallosDeLasReglas(yml) {
  const q = [];
  const pasos = losPasos(yml);
  const limpio = sinComentarios(yml);

  if (/--only\s+hosting|--only\s+\S*hosting/.test(limpio)) {
    q.push('HOSTING: este botón corre en la RAÍZ y nombra `hosting`. El `firebase.json` de la '
      + 'raíz apunta a un `build` de junio: publicarlo tumbaría la app del cliente');
  }
  if (/--force/.test(limpio)) {
    q.push('FORCE: `--force` convierte «ofrece borrar un índice» en «lo borra», y un índice '
      + 'borrado no da error: hace fallar la consulta que lo usaba');
  }

  const iVerdicto = elPasoQue(pasos, 'bajar-indices.cjs --verdicto');
  const iReglas = elPasoQue(pasos, 'firestore:rules');
  const iIndices = elPasoQue(pasos, '--only firestore:indexes');

  if (iVerdicto < 0) {
    q.push('VERDICTO: desapareció la comprobación de que el repo no se deja fuera un índice '
      + 'que ya está puesto');
  }
  if (iReglas < 0) q.push('REGLAS: este botón ya no despliega las reglas');
  if (iIndices < 0) q.push('INDICES: este botón ya no despliega los índices');

  if (iVerdicto >= 0 && iIndices >= 0 && iVerdicto > iIndices) {
    q.push('VERDICTO: la comprobación quedó DESPUÉS de desplegar los índices: avisa cuando el '
      + 'borrado ya se hizo');
  }
  // La comparación tiene que vivir en el guion que sabe de índices, no copiada aquí.
  if (iVerdicto >= 0 && !pasos[iVerdicto].includes('scripts/bajar-indices.cjs')) {
    q.push('VERDICTO: la comparación se copió dentro del YAML en vez de pedírsela a '
      + '`scripts/bajar-indices.cjs` (SEGUNDA LEY: el gemelo se queda viejo)');
  }
  if (!/firebase-tools@15/.test(limpio) || /firebase-tools@latest/.test(limpio)) {
    q.push('VERSION: la herramienta no está fijada en 15');
  }
  return q;
}

describe('EL BOTÓN DE LAS REGLAS · el despliegue más peligroso, y sus dos frenos', () => {
  it('hoy no tiene ninguna queja', () => {
    const q = losFallosDeLasReglas(YML_REGLAS);
    assert.deepEqual(q, [], '🔴 el botón de las reglas perdió una protección:\n  · ' + q.join('\n  · '));
  });

  it('NUNCA nombra `hosting`: corre en la raíz, donde el build es de junio', () => {
    assert.ok(!/--only\s+\S*hosting/.test(sinComentarios(YML_REGLAS)),
      '⛔ nombra hosting desde la raíz: publicaría el resto de junio');
  });

  it('NUNCA usa `--force`: eso borra índices de verdad', () => {
    assert.ok(!/--force/.test(sinComentarios(YML_REGLAS)),
      '⛔ `--force` convierte «ofrece borrar» en «borra»');
  });

  it('comprueba ANTES de desplegar que no se deja fuera ningún índice puesto', () => {
    const pasos = losPasos(YML_REGLAS);
    const iV = elPasoQue(pasos, 'bajar-indices.cjs --verdicto');
    const iI = elPasoQue(pasos, '--only firestore:indexes');
    assert.ok(iV >= 0, '⛔ desapareció el veredicto de los índices');
    assert.ok(iV < iI, '⛔ el veredicto quedó después de desplegar: avisa cuando ya se borró');
  });

  it('y no se puede ablandar: seis botones de reglas rotos, y se queja de los seis', () => {
    const { cabeza, pasos } = enTrozos(YML_REGLAS);
    const juntar = (ps) => cabeza + '\n' + ps.join('\n');
    //  Sin comentarios, por lo mismo que arriba: el comentario que explica un paso vive al
    //  final del paso ANTERIOR, y buscar en crudo saboteaba el que no era.
    const idx = (t) => pasos.findIndex((p) => sinComentarios(p).includes(t));
    const quitar = (t) => juntar(pasos.filter((p, i) => i !== idx(t)));
    const cambiar = (viejo, nuevo) => juntar(pasos).replace(viejo, nuevo);
    const mover = (de, tras) => {
      const ps = [...pasos];
      const i = idx(de);
      const [trozo] = ps.splice(i, 1);
      const j = ps.findIndex((p) => sinComentarios(p).includes(tras));
      ps.splice(j + 1, 0, trozo);
      return juntar(ps);
    };

    const SABOTAJES = [
      ['desplegando también hosting desde la raíz',
        cambiar('--only firestore:indexes', '--only firestore:indexes,hosting'), 'HOSTING'],
      ['forzando el despliegue de índices',
        cambiar('--only firestore:indexes', '--only firestore:indexes --force'), 'FORCE'],
      ['sin el veredicto de los índices', quitar('bajar-indices.cjs --verdicto'), 'VERDICTO'],
      ['el veredicto, movido detrás del despliegue de índices',
        mover('bajar-indices.cjs --verdicto', '--only firestore:indexes'), 'VERDICTO'],
      ['sin desplegar las reglas', quitar('firestore:rules'), 'REGLAS'],
      ['la herramienta suelta', cambiar(/firebase-tools@15/g, 'firebase-tools@latest'), 'VERSION'],
    ];

    const mudos = [];
    for (const [nombre, roto, marca] of SABOTAJES) {
      const q = losFallosDeLasReglas(roto);
      if (!q.some((x) => x.startsWith(marca))) mudos.push(nombre + ' (esperaba ' + marca + ')');
    }
    assert.deepEqual(mudos, [],
      '🔴 EL AMARRE DE LAS REGLAS NO MUERDE en ' + mudos.length + ' de ' + SABOTAJES.length
      + ':\n  · ' + mudos.join('\n  · '));
  });
});

/**
 * Y la comparación de índices, que es la que decide si un despliegue borra algo.
 * Se prueba con listas de mentira, sin salir a la red: la función es pura y vive
 * en el guion que sabe de índices.
 */
describe('LA COMPARACIÓN DE ÍNDICES · distingue crear de BORRAR', () => {
  const { loQueElRepoNoTrae } = require('../scripts/bajar-indices.cjs');
  const A = { collectionGroup: 'viajes', fields: [{ fieldPath: 'conductorId' }] };
  const B = { collectionGroup: 'pedidos', fields: [{ fieldPath: 'negocioId' }] };
  const cuantos = (s, r) => {
    const f = loQueElRepoNoTrae(s, r);
    return f.indexes.length + f.fieldOverrides.length;
  };

  it('si el repo los trae todos, no falta nada', () => {
    assert.equal(cuantos({ indexes: [A, B] }, { indexes: [A, B] }), 0);
  });

  it('🔴 si al repo le falta uno que el servidor tiene, lo canta', () => {
    assert.equal(cuantos({ indexes: [A, B] }, { indexes: [A] }), 1);
  });

  it('pero un índice NUEVO en el repo no es un problema: es lo que se va a crear', () => {
    assert.equal(cuantos({ indexes: [A] }, { indexes: [A, B] }), 0);
  });

  it('y las excepciones de campo cuentan igual', () => {
    const E = { collectionGroup: 'viajes', fieldPath: 'tarifa' };
    assert.equal(cuantos({ indexes: [], fieldOverrides: [E] }, { indexes: [], fieldOverrides: [] }), 1);
    assert.equal(cuantos({ indexes: [], fieldOverrides: [E] }, { indexes: [], fieldOverrides: [E] }), 0);
  });

  it('un archivo vacío no engaña: faltan todos', () => {
    assert.equal(cuantos({ indexes: [A, B] }, {}), 2);
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  EL TERCER BOTÓN: EL PANEL Y ALIADOS, EN UN SOLO ARCHIVO
 *
 *  Publica dos apps distintas, y de ahí salen sus peligros propios:
 *
 *    · **publicar en el sitio equivocado**. A qué sitio va cada app lo dicen su
 *      `firebase.json` (el target) y su `.firebaserc` (qué sitio es ese target).
 *      Si el botón se los COPIA, un renombrado los separa en silencio y publica
 *      el panel encima de aliados. Tiene que LEERLOS.
 *    · **la marca invisible**. Los dos `firebase.json` de esas apps empiezan con
 *      un BOM. El archivo se ve perfecto y `JSON.parse` revienta. Lo cazó el
 *      simulacro del 23-sep-2026: las DOS fallaban. Si alguien quita ese
 *      `replace`, el botón deja de arrancar — y parecerá culpa de otra cosa.
 *    · **`--only hosting` a secas**. Hay varios sitios en este proyecto: sin
 *      nombrar el target, un despliegue puede tocar el que no era.
 *    · **la carpeta fija**. Compilar y desplegar van con la carpeta que salió de
 *      la casilla; si alguien la escribe a mano, el botón publica siempre la
 *      misma app diga lo que diga quien lo aprieta.
 * ══════════════════════════════════════════════════════════════════════════════
 */
function losFallosDelPanel(yml) {
  const q = [];
  const pasos = losPasos(yml);
  const limpio = sinComentarios(yml);

  const iQuien = elPasoQue(pasos, 'firebase.json');
  const iVigia = elPasoQue(pasos, 'hosting:channel:list');
  const iPruebas = elPasoQue(pasos, 'npm test');
  const iCompila = elPasoQue(pasos, 'npm run build');
  const iDespliega = elPasoQue(pasos, 'deploy \\');
  const iNube = elPasoQue(pasos, 'steps.app.outputs.url');

  if (iQuien < 0) {
    q.push('SITIO: ya no se le pregunta a `firebase.json` a qué sitio publica cada app. '
      + 'Copiar el target aquí lo separa en silencio de donde vive de verdad');
  } else {
    //  🔴 NO BASTA CON QUE EL NOMBRE APAREZCA: el paso lo nombra también en su mensaje de
    //  error («su .firebaserc no dice qué SITIO es el target…»), así que un `includes` daba
    //  por bueno un botón que ya no lo leía. Lo cazó el contador de sabotajes mudos el
    //  23-sep-2026. Se pregunta DÓNDE aparece el nombre: tiene que estar en un renglón que
    //  además lo LEA.
    const seLee = sinComentarios(pasos[iQuien]).split('\n')
      .some((l) => l.includes('.firebaserc') && /leerJson|readFileSync|require\(/.test(l));
    if (!seLee) {
      q.push('SITIO: `.firebaserc` se nombra pero ya no se LEE, y es quien dice qué sitio es '
        + 'cada target. Nombrarlo en un mensaje de error no es leerlo');
    }
    if (!/charCodeAt\(0\) === 0xFEFF/.test(pasos[iQuien])) {
      q.push('BOM: se quitó el descarte de la marca invisible. Los firebase.json de esas dos '
        + 'apps empiezan con ella y `JSON.parse` revienta: el botón no arranca');
    }
  }
  if (!/--only hosting:\$\{\{ steps\.app\.outputs\.target \}\}/.test(limpio)) {
    q.push('TARGET: el despliegue ya no nombra el target leído. Un `--only hosting` a secas '
      + 'puede publicar en el sitio que no era');
  }
  for (const [i, qué] of [[iCompila, 'compila'], [iDespliega, 'despliega']]) {
    if (i >= 0 && !pasos[i].includes('steps.app.outputs.carpeta')) {
      q.push('CARPETA: el paso que ' + qué + ' no usa la carpeta que salió de la casilla: '
        + 'publicaría siempre la misma app');
    }
  }
  if (iVigia < 0) q.push('VIGIA: desapareció el vigía de permisos');
  else if (iPruebas >= 0 && iVigia > iPruebas) {
    q.push('VIGIA: quedó después de las pruebas, así que no ahorra nada');
  }
  if (iPruebas < 0) q.push('PRUEBAS: el botón ya no corre `npm test`');
  for (const repo of ['frey2605/guajirago-admin', 'frey2605/guajirago-aliados']) {
    const i = elPasoQue(pasos, repo);
    if (i < 0) q.push('REPOS: ya no se trae ' + repo);
    else if (iPruebas >= 0 && i > iPruebas) q.push('REPOS: ' + repo + ' llega tarde');
  }
  if (iNube >= 0) {
    if (!pasos[iNube].includes('"$SERVIDO" != "$ESPERADO"')) {
      q.push('NUBE: desapareció la comparación con lo compilado');
    }
    if (!pasos[iNube].includes('exit 1')) {
      q.push('NUBE: ya no puede ponerse roja');
    }
  } else {
    q.push('NUBE: ya nadie le pregunta al sitio si quedó puesto');
  }
  if (!/firebase-tools@15/.test(limpio) || /firebase-tools@latest/.test(limpio)) {
    q.push('VERSION: la herramienta no está fijada en 15');
  }
  return q;
}

describe('EL BOTÓN DEL PANEL Y ALIADOS · publica dos apps, y no puede confundirlas', () => {
  it('hoy no tiene ninguna queja', () => {
    const q = losFallosDelPanel(YML_PANEL);
    assert.deepEqual(q, [], '🔴 perdió una protección:\n  · ' + q.join('\n  · '));
  });

  it('el sitio y el target se LEEN de los archivos de cada app, no se copian', () => {
    const pasos = losPasos(YML_PANEL);
    const i = elPasoQue(pasos, 'firebase.json');
    assert.ok(i >= 0, '⛔ ya no lee firebase.json');
    // Que lo LEA, no que lo nombre: el mensaje de error de ese mismo paso también lo nombra.
    assert.ok(
      pasos[i].split('\n').some((l) => l.includes('.firebaserc') && /leerJson|readFileSync/.test(l)),
      '⛔ `.firebaserc` se nombra pero no se lee: de ahí sale a qué SITIO va cada target',
    );
  });

  it('le quita la marca invisible al JSON, o no arranca', () => {
    const pasos = losPasos(YML_PANEL);
    const i = elPasoQue(pasos, 'firebase.json');
    assert.match(pasos[i], /charCodeAt\(0\) === 0xFEFF/,
      '⛔ sin descartar el BOM, `JSON.parse` revienta con los firebase.json de esas apps');
  });

  it('nombra el target al desplegar: nunca `--only hosting` a secas', () => {
    assert.match(sinComentarios(YML_PANEL), /--only hosting:\$\{\{ steps\.app\.outputs\.target \}\}/,
      '⛔ sin nombrar el target, puede publicar en el sitio que no era');
  });

  it('y no se puede ablandar: siete botones rotos, y se queja de los siete', () => {
    const { cabeza, pasos } = enTrozos(YML_PANEL);
    const juntar = (ps) => cabeza + '\n' + ps.join('\n');
    const idx = (t) => pasos.findIndex((p) => sinComentarios(p).includes(t));
    const quitar = (t) => juntar(pasos.filter((p, i) => i !== idx(t)));
    const cambiar = (viejo, nuevo) => juntar(pasos).replace(viejo, nuevo);
    const mover = (de, tras) => {
      const ps = [...pasos];
      const [trozo] = ps.splice(idx(de), 1);
      const j = ps.findIndex((p) => sinComentarios(p).includes(tras));
      ps.splice(j + 1, 0, trozo);
      return juntar(ps);
    };

    const SABOTAJES = [
      ['sin leer .firebaserc (el sitio, copiado a mano)',
        cambiar("leerJson(c + '/.firebaserc')", "({targets:{guajirago:{hosting:{admin:['guajirago-admin']}}}})"), 'SITIO'],
      ['sin quitarle la marca invisible al JSON',
        cambiar('if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);', ''), 'BOM'],
      ['desplegando sin nombrar el target',
        cambiar('--only hosting:${{ steps.app.outputs.target }}', '--only hosting'), 'TARGET'],
      ['compilando siempre la misma carpeta',
        cambiar('working-directory: ${{ steps.app.outputs.carpeta }}\n        run: npm run build',
          'working-directory: guajirago-admin\n        run: npm run build'), 'CARPETA'],
      ['el vigía, detrás de las pruebas', mover('hosting:channel:list', 'npm test'), 'VIGIA'],
      ['sin traer aliados', quitar('frey2605/guajirago-aliados'), 'REPOS'],
      ['la nube, sin poder ponerse roja',
        cambiar('exit 1\n            fi\n            sleep 5', 'exit 0\n            fi\n            sleep 5'), 'NUBE'],
    ];

    const mudos = [];
    for (const [nombre, roto, marca] of SABOTAJES) {
      const q = losFallosDelPanel(roto);
      if (!q.some((x) => x.startsWith(marca))) mudos.push(nombre + ' (esperaba ' + marca + ')');
    }
    assert.deepEqual(mudos, [],
      '🔴 EL AMARRE DEL PANEL NO MUERDE en ' + mudos.length + ' de ' + SABOTAJES.length
      + ':\n  · ' + mudos.join('\n  · '));
  });
});

/**
 * ══════════════════════════════════════════════════════════════════════════════
 *  EL QUINTO BOTÓN: LA NUBE (functions)
 *
 *  Publica las 19 funciones que mueven el negocio: los avisos al conductor, el
 *  cierre de los viajes colgados, el canje de recargas, los cobros. Sus peligros
 *  propios:
 *
 *    · **`--force`**. Si la nube tiene una función que el código ya no trae, el
 *      despliegue OFRECE borrarla; `--force` la borra. Borrar una función viva
 *      deja a los conductores sin avisos, o sin cobrar.
 *    · **el vigía sin librerías**. `firebase` LEE el código de las funciones para
 *      descubrir los disparadores; si el vigía corre antes de instalarlas, falla
 *      por falta de librerías y no por permisos — una falsa alarma puesta por
 *      nosotros, que es lo que enseña a ignorar al vigía.
 *    · **la lista de funciones copiada**. El paso 11 exige que estén TODAS, y esa
 *      lista sale de `index.js`. Copiada en el YAML, el día que se añada una
 *      función nadie actualiza el botón y el paso 11 firma verde sin mirarla.
 * ══════════════════════════════════════════════════════════════════════════════
 */
function losFallosDeLaNube(yml) {
  const q = [];
  const pasos = losPasos(yml);
  const limpio = sinComentarios(yml);

  if (/--force/.test(limpio)) {
    q.push('FORCE: `--force` convierte «ofrece borrar una función» en «la borra», y una '
      + 'función borrada deja a los conductores sin avisos o sin cobrar');
  }
  if (/--only\s+\S*hosting/.test(limpio)) {
    q.push('HOSTING: este botón es de la nube y nombra `hosting`');
  }

  const iLibs = elPasoQue(pasos, 'npm ci --prefix guajirago/functions');
  const iVigia = elPasoQue(pasos, '--dry-run');
  const iPruebas = elPasoQue(pasos, 'npm test');
  const iDespliega = elPasoQue(pasos, 'deploy --only functions', 'working-directory');
  const iComprueba = elPasoQue(pasos, 'functions:list');

  if (iLibs < 0) q.push('LIBRERIAS: ya no se instalan las librerías de la nube');
  if (iVigia < 0) q.push('VIGIA: desapareció el simulacro de permisos (`--dry-run`)');
  if (iPruebas < 0) q.push('PRUEBAS: el botón ya no corre `npm test`');
  if (iComprueba < 0) q.push('COMPRUEBA: ya nadie le pregunta a la nube qué funciones tiene');

  if (iVigia >= 0 && iPruebas >= 0 && iVigia > iPruebas) {
    q.push('VIGIA: quedó DESPUÉS de las pruebas, así que no ahorra nada y es un adorno');
  }
  if (iLibs >= 0 && iVigia >= 0 && iLibs > iVigia) {
    q.push('LIBRERIAS: se instalan DESPUÉS del vigía, así que el vigía fallaría por falta de '
      + 'librerías y no por permisos: una falsa alarma puesta por nosotros');
  }
  //  El despliegue va desde dentro de `guajirago/`, y se mira EN SU PROPIO PASO.
  if (elPasoQue(pasos, 'deploy --only functions') >= 0 && iDespliega < 0) {
    q.push('CARPETA: el paso que despliega la nube perdió su `working-directory`');
  }
  if (iComprueba >= 0) {
    const c = pasos[iComprueba];
    if (!c.includes('guajirago/functions/index.js')) {
      q.push('LISTA: la comprobación ya no saca los nombres de `index.js`. Una lista copiada '
        + 'en el YAML se queda vieja en cuanto se añada una función, y el paso 11 firma verde '
        + 'sin haberla mirado');
    }
    if (!c.includes('exit 1')) {
      q.push('COMPRUEBA: ya no puede ponerse ROJA: mira y sigue en verde pase lo que pase');
    }
  }
  for (const repo of ['frey2605/guajirago-admin', 'frey2605/guajirago-aliados']) {
    const i = elPasoQue(pasos, repo);
    if (i < 0) q.push('REPOS: ya no se trae ' + repo);
    else if (iPruebas >= 0 && i > iPruebas) q.push('REPOS: ' + repo + ' llega tarde');
  }
  if (!/firebase-tools@15/.test(limpio) || /firebase-tools@latest/.test(limpio)) {
    q.push('VERSION: la herramienta no está fijada en 15');
  }
  return q;
}

describe('EL BOTÓN DE LA NUBE · 19 funciones, y ninguna se puede quedar por el camino', () => {
  it('hoy no tiene ninguna queja', () => {
    const q = losFallosDeLaNube(YML_NUBE);
    assert.deepEqual(q, [], '🔴 perdió una protección:\n  · ' + q.join('\n  · '));
  });

  it('NUNCA usa `--force`: eso borra funciones vivas', () => {
    assert.ok(!/--force/.test(sinComentarios(YML_NUBE)),
      '⛔ `--force` borra la función que el código ya no trae, sin preguntar');
  });

  it('las librerías de la nube se instalan ANTES del vigía, o el vigía miente', () => {
    const pasos = losPasos(YML_NUBE);
    const iLibs = elPasoQue(pasos, 'npm ci --prefix guajirago/functions');
    const iVigia = elPasoQue(pasos, '--dry-run');
    assert.ok(iLibs >= 0 && iVigia >= 0, '⛔ falta una de las dos piezas');
    assert.ok(iLibs < iVigia,
      '⛔ el vigía correría sin las librerías: fallaría por falta de librerías, no por permisos');
  });

  it('la lista de funciones se SACA de index.js, no se copia', () => {
    const pasos = losPasos(YML_NUBE);
    const i = elPasoQue(pasos, 'functions:list');
    assert.ok(i >= 0, '⛔ ya nadie le pregunta a la nube');
    assert.ok(pasos[i].includes('guajirago/functions/index.js'),
      '⛔ la lista dejó de salir de index.js: una copia se queda vieja con la primera función nueva');
    assert.ok(pasos[i].includes('exit 1'), '⛔ la comprobación ya no puede parar');
  });

  it('y no se puede ablandar: ocho botones de nube rotos, y se queja de los ocho', () => {
    const { cabeza, pasos } = enTrozos(YML_NUBE);
    const juntar = (ps) => cabeza + '\n' + ps.join('\n');
    const idx = (t) => pasos.findIndex((p) => sinComentarios(p).includes(t));
    const quitar = (t) => juntar(pasos.filter((p, i) => i !== idx(t)));
    const cambiar = (viejo, nuevo) => juntar(pasos).replace(viejo, nuevo);
    //  Cambia DENTRO de un paso concreto. Hace falta porque `exit 1` aparece en varios
    //  pasos: tocar «el primero del archivo» saboteaba otro y el sabotaje no mordía —
    //  lo cazó el propio contador de sabotajes mudos el 23-sep-2026.
    const enElPaso = (donde, viejo, nuevo) => {
      const ps = [...pasos];
      const i = idx(donde);
      ps[i] = ps[i].replace(viejo, nuevo);
      return juntar(ps);
    };
    const mover = (de, tras) => {
      const ps = [...pasos];
      const [trozo] = ps.splice(idx(de), 1);
      const j = ps.findIndex((p) => sinComentarios(p).includes(tras));
      ps.splice(j + 1, 0, trozo);
      return juntar(ps);
    };

    const SABOTAJES = [
      ['forzando el despliegue (borra funciones)',
        cambiar('--project guajirago --non-interactive\n          rm -f',
          '--project guajirago --non-interactive --force\n          rm -f'), 'FORCE'],
      ['el vigía, movido detrás de las pruebas', mover('--dry-run', 'npm test'), 'VIGIA'],
      ['las librerías de la nube, después del vigía',
        mover('npm ci --prefix guajirago/functions', '--dry-run'), 'LIBRERIAS'],
      ['sin las librerías de la nube', quitar('npm ci --prefix guajirago/functions'), 'LIBRERIAS'],
      ['la lista de funciones, copiada a mano en el YAML',
        cambiar("grep -oE '^exports\\.[a-zA-Z0-9_]+' guajirago/functions/index.js",
          "echo 'notificarNuevoViaje'"), 'LISTA'],
      ['la comprobación, sin poder ponerse roja',
        enElPaso('functions:list', /exit 1/g, 'exit 0'), 'COMPRUEBA'],
      ['sin correr las pruebas', cambiar('run: npm test', 'run: echo saltado'), 'PRUEBAS'],
      ['la herramienta suelta', cambiar(/firebase-tools@15/g, 'firebase-tools@latest'), 'VERSION'],
    ];

    const mudos = [];
    for (const [nombre, roto, marca] of SABOTAJES) {
      const q = losFallosDeLaNube(roto);
      if (!q.some((x) => x.startsWith(marca))) mudos.push(nombre + ' (esperaba ' + marca + ')');
    }
    assert.deepEqual(mudos, [],
      '🔴 EL AMARRE DE LA NUBE NO MUERDE en ' + mudos.length + ' de ' + SABOTAJES.length
      + ':\n  · ' + mudos.join('\n  · '));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  EL BOTÓN QUE MIDE Y EL QUE DESPLIEGA TIENEN QUE MEDIR LO MISMO.
//
//  El botón que mide existe para contestar UNA pregunta: «¿el paso 5 del botón
//  de desplegar —la suite entera, con los tres repos— corre en una máquina de
//  GitHub?». Esa respuesta solo vale si mide EXACTAMENTE lo que el otro hace.
//
//  🔴 Si uno trae los tres repos y el otro dos, o uno corre `npm test` y el otro
//  una lista escrita a mano, la medición sale verde y el despliegue se para
//  igual — y nadie entendería por qué, porque «ya lo habíamos medido». Ese es el
//  peor tipo de vigilante: el que da permiso para no mirar.
//
//  Por eso esto no pregunta si el YAML «está bien»: pregunta si los DOS hacen lo
//  mismo, comparándolos entre sí. Que no se separen no lo cuida la buena
//  intención, lo cuida esta prueba.
const BOTON_MEDIR = '.github/workflows/medir-pruebas.yml';
const YML_MEDIR = leer(BOTON_MEDIR);

describe('EL BOTÓN QUE MIDE · mide lo mismo que el que despliega, o no vale', () => {
  it('trae los MISMOS tres repos, y a las mismas carpetas', () => {
    const medir = sinComentarios(YML_MEDIR);
    const desplegar = sinComentarios(YML);
    for (const repo of ['frey2605/guajirago-admin', 'frey2605/guajirago-aliados']) {
      assert.ok(desplegar.includes(repo),
        '⛔ el botón de DESPLEGAR ya no trae ' + repo + '. Esta prueba compara los dos, así que '
        + 'arréglalo ahí: si él deja de traerlo, medirlo aquí no prueba nada.');
      assert.ok(medir.includes(repo),
        '⛔ el botón que MIDE no trae ' + repo + ', y el de desplegar sí. Entonces lo que mide NO '
        + 'es la suite entera: le faltan los amarres que leen los dos lados de cada contrato, y '
        + 'su verde daría permiso para fusionar algo que se va a parar en el paso 5.');
    }
    //  Y a la MISMA carpeta. `pruebas/cargar.cjs` los busca por nombre en la raíz;
    //  traerlos a otro sitio es no traerlos, solo que sin decirlo.
    for (const carpeta of ['path: guajirago-admin', 'path: guajirago-aliados']) {
      assert.ok(medir.includes(carpeta),
        '⛔ el botón que mide trae el repo a otra carpeta (' + carpeta + ' no aparece). Las '
        + 'pruebas los buscan por nombre en la raíz: en otro sitio es como no tenerlos.');
    }
  });

  it('corre `npm test`, no una lista de archivos escrita a mano', () => {
    const pasos = losPasos(YML_MEDIR);
    const i = elPasoQue(pasos, 'npm test');
    assert.ok(i >= 0,
      '⛔ el botón que mide ya no corre `npm test`. La lista de archivos de prueba, las cuatro '
      + 'tandas y los emuladores viven UNA sola vez en `pruebas/correr.cjs` (SEGUNDA LEY). Una '
      + 'lista copiada aquí mediría una suite parecida a la de verdad, que se separa de ella en '
      + 'cuanto alguien añada una prueba — o sea, una medición que miente sin avisar.');
    //  Y las librerías de los DOS paquetes antes, igual que el de desplegar: sin
    //  las de la app, `npm test` ni arranca.
    assert.ok(elPasoQue(pasos, 'npm ci --prefix guajirago') >= 0,
      '⛔ no instala las librerías de la app (`npm ci --prefix guajirago`), que el botón de '
      + 'desplegar sí instala. Mediría con menos de lo que el otro tiene.');
  });

  //  🔴 Y QUE SIGA SIENDO UNA CINTA MÉTRICA QUE NO MIENTE. Estas tres se
  //  sabotean, porque una comprobación que nadie rompe no está comprobada — la
  //  primera versión de esto preguntaba si el archivo contiene un «4», y el 4
  //  aparece por todas partes: era verde pasara lo que pasara.
  const FALLOS_DEL_MEDIDOR = [
    ['la cuenta se lee de lo que escribe `node --test`, no se cuenta a mano',
      (t) => !t.includes('grep -oP "^# $1 \\K'),
      'un número contado a mano es un número inventado en cuanto el formato cambie'],
    ['distingue «no falló ninguna» de «NO CORRIÓ ninguna»',
      (t) => !t.includes('if [ "$TANDAS" = "0" ]'),
      'un cero sin pruebas detrás se lee como un ✅ y da permiso para fusionar a ciegas'],
    ['exige que las CUATRO tandas hayan corrido',
      (t) => !t.includes('[ "$TANDAS" = "4" ]'),
      '`npm test` encadena con `&&`: una tanda caída deja a las siguientes sin arrancar, '
      + 'y salen pocas pruebas y CERO fallos — que parece perfecto'],
    ['mira también la salida de `npm test`, no solo el conteo',
      (t) => !t.includes('[ "$SALIDA" = "0" ]'),
      'una tanda puede morir después de escribir su cuenta; solo la salida lo dice'],
  ];

  it('sigue siendo una CINTA MÉTRICA que no puede fingir un número', () => {
    const medir = sinComentarios(YML_MEDIR);
    for (const [que, falla, porque] of FALLOS_DEL_MEDIDOR) {
      assert.ok(!falla(medir), '⛔ el botón que mide ya no ' + que + '. ' + porque);
    }
  });

  it('y no se puede ablandar: cuatro medidores rotos, y se queja de los cuatro', () => {
    const real = sinComentarios(YML_MEDIR);
    const ESCAPES = [
      ['la cuenta pasa a contarse a mano',
        (t) => t.replace(/grep -oP "\^# \$1 \\K\\d\+"/, 'echo 0')],
      ['deja de distinguir «no corrió ninguna»',
        (t) => t.replace(/if \[ "\$TANDAS" = "0" \]/, 'if false')],
      ['ya no exige las cuatro tandas',
        (t) => t.replace(/\[ "\$TANDAS" = "4" \]/g, 'true')],
      ['ya no mira la salida de npm test',
        (t) => t.replace(/\[ "\$SALIDA" = "0" \]/g, 'true')],
    ];
    const saltados = [];
    for (const [nombre, romper] of ESCAPES) {
      const rota = romper(real);
      //  Un parche que no encuentra dónde morder se estaría aprobando solo: el
      //  archivo sale limpio y el verde no vale nada. Se apunta y se falla.
      if (rota === real) { saltados.push(nombre); continue; }
      const seQueja = FALLOS_DEL_MEDIDOR.some(([, falla]) => falla(rota));
      assert.ok(seQueja,
        'con este medidor roto —«' + nombre + '»— las comprobaciones de arriba siguen diciendo '
        + 'que todo está bien. O sea que se puede poner en el botón de verdad y ninguna prueba '
        + 'se entera. Arregla la COMPROBACIÓN, no este sabotaje.');
    }
    assert.deepStrictEqual(saltados, [],
      'estos sabotajes ya no encuentran dónde morder en `' + BOTON_MEDIR + '`, así que no '
      + 'probaron nada:\n   · ' + saltados.join('\n   · '));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  EL VIGÍA DEL PERMISO DE LOS REPOS HERMANOS
//
//  🔴 Por qué existe, medido el 23-sep-2026: los botones comprobaban que el
//  secreto ESTUVIERA puesto, no que SIRVIERA. El botón que mide pasó en verde y
//  murió cuarenta segundos después dentro de `checkout` con «Bad credentials»:
//  el permiso estaba caducado. Un mensaje que no dice qué hacer, en un paso que
//  no es el que falla de verdad.
//
//  La decisión está separada de la llamada a propósito: `veredicto()` es pura y
//  recibe lo que contestó GitHub, así que aquí se le pueden dar respuestas de
//  mentira —sin red y sin permiso— y exigir que se queje cuando toca. Un vigía
//  que nadie ha visto quejarse no es un vigía.
describe('EL VIGÍA DEL PERMISO · distingue caducado de sin red, y lo dice', () => {
  const { veredicto } = require('../scripts/vigia-repos-hermanos.cjs');
  const ok = (r) => ({ repo: r, estado: 200, error: null });

  it('con todo bien, deja pasar y no dice nada', () => {
    const v = veredicto(true, [ok('a'), ok('b')]);
    assert.strictEqual(v.para, false);
    assert.strictEqual(v.titulo, null, 'no debería tener nada que decir cuando todo está bien');
  });

  it('🔴 con el permiso CADUCADO (401), PARA — es el fallo del 23-sep-2026', () => {
    const v = veredicto(true, [{ repo: 'a', estado: 401 }, { repo: 'b', estado: 401 }]);
    assert.ok(v.para, 'un permiso caducado tiene que parar el botón AQUÍ, no dentro de `checkout`');
  });

  it('y con un repo bueno y otro malo también para', () => {
    assert.ok(veredicto(true, [ok('a'), { repo: 'b', estado: 401 }]).para,
      'si falta UNO de los dos repos, nueve archivos de pruebas no corren igual');
  });

  it('sin el secreto puesto, para', () => {
    assert.ok(veredicto(false, []).para);
  });

  it('con 403 y con 404 también para, y dice lo que significa cada uno', () => {
    for (const e of [403, 404]) {
      const v = veredicto(true, [{ repo: 'a', estado: e }, { repo: 'b', estado: e }]);
      assert.ok(v.para, 'un ' + e + ' no es un «sí»');
      assert.ok(v.detalle.join('\n').length > 50, 'tiene que explicar qué significa el ' + e);
    }
  });

  //  🔑 Y LA OTRA MITAD, que es la que evita la falsa alarma: si no se pudo ni
  //   PREGUNTAR, eso es un tropiezo de red, no un permiso malo. Un vigía que
  //   grita sin fuego se deja de mirar, y éste protege al que más falta hace.
  it('si NO se pudo preguntar (sin red), avisa pero NO para', () => {
    const v = veredicto(true, [
      { repo: 'a', estado: null, error: 'ENOTFOUND' },
      { repo: 'b', estado: null, error: 'ENOTFOUND' },
    ]);
    assert.strictEqual(v.para, false, 'un fallo de red no puede parar el botón: eso es falsa alarma');
    assert.ok(v.titulo, 'pero tiene que DECIRLO, no callarse (REGLA 9)');
  });

  //  Y que el mensaje sirva para algo. Un «no sirve» sin decir cómo se arregla
  //  deja igual de atascado que el «Bad credentials» que vino a sustituir.
  it('cuando para, el mensaje dice DÓNDE se renueva el permiso', () => {
    const texto = veredicto(true, [{ repo: 'a', estado: 401 }]).detalle.join('\n');
    assert.ok(texto.includes('personal-access-tokens'),
      '⛔ el aviso no dice dónde se renueva. Entonces es el mismo callejón sin salida que el ' +
      '«Bad credentials» de GitHub, solo que con mejor letra.');
    assert.ok(texto.includes('LEER_REPOS_HERMANOS'),
      '⛔ el aviso no dice en qué secreto se pega');
  });

  //  Y QUE ESTÉ ENCHUFADO EN LOS BOTONES, en el sitio correcto. Un vigía
  //  perfecto que nadie llama no protege nada, y llamado DESPUÉS de traer los
  //  repos llega tarde: para entonces el `checkout` ya murió.
  //
  //  🔑 LA LISTA NO SE ESCRIBE A MANO: se LEE de la carpeta de botones. Una
  //   lista de cuatro nombres aquí se queda vieja el día que nazca el quinto —y
  //   ese quinto entraría sin vigía, en verde—. Así que la regla es: **todo
  //   botón que use el permiso tiene que llamar al vigía**, y quién los usa lo
  //   dicen ellos, no yo. Es la misma lección que este repo ya pagó tres veces:
  //   preguntar DÓNDE aparece, no repetir una lista.
  const LOS_QUE_USAN_EL_PERMISO = fs.readdirSync(path.join(RAIZ, '.github/workflows'))
    .filter((f) => f.endsWith('.yml'))
    .map((f) => ['.github/workflows/' + f, leer('.github/workflows/' + f)])
    .filter(([, yml]) => yml.includes('LEER_REPOS_HERMANOS'));

  it('TODO botón que usa el permiso llama al vigía, y ANTES de traer los repos hermanos', () => {
    assert.ok(LOS_QUE_USAN_EL_PERMISO.length >= 4,
      'solo ' + LOS_QUE_USAN_EL_PERMISO.length + ' botones usan el permiso, y el 24-sep-2026 eran '
      + '4. Si bajó, esta prueba vigila menos de lo que creía.');
    for (const [quien, yml] of LOS_QUE_USAN_EL_PERMISO) {
      const pasos = losPasos(yml);
      const iVigia = elPasoQue(pasos, 'vigia-repos-hermanos.cjs');
      const iCodigo = elPasoQue(pasos, 'actions/checkout@v4');
      const iHermano = elPasoQue(pasos, 'frey2605/guajirago-admin');
      assert.ok(iVigia >= 0, '⛔ ' + quien + ' ya no llama al vigía del permiso. Vuelve a morir ' +
        'dentro de `checkout` con «Bad credentials», que no dice qué hacer.');
      assert.ok(iVigia > iCodigo, '⛔ en ' + quien + ' el vigía va ANTES de traer el código, y el ' +
        'vigía es un guion de este repo: no existiría todavía.');
      assert.ok(iVigia < iHermano, '⛔ en ' + quien + ' el vigía va DESPUÉS de traer los repos ' +
        'hermanos, así que llega tarde: para entonces el checkout ya falló.');
    }
  });
});
