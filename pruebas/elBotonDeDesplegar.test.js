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
const { leer } = require('./cargar.cjs');

const BOTON = '.github/workflows/desplegar.yml';
const YML = leer(BOTON);

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
    const idx = (t) => pasos.findIndex((p) => !p.trimStart().startsWith('#') && p.includes(t));
    const juntar = (ps) => cabeza + '\n' + ps.join('\n');

    // Mueve el paso que contiene `de` a justo después del que contiene `tras`.
    const mover = (de, tras) => {
      const ps = [...pasos];
      const i = ps.findIndex((p) => p.includes(de));
      const [trozo] = ps.splice(i, 1);
      const j = ps.findIndex((p) => p.includes(tras));
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
