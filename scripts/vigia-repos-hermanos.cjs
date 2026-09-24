#!/usr/bin/env node
/**
 * ⏱️ VIGÍA DEL PERMISO DE LOS REPOS HERMANOS — REGLA 1407: comprobar que PUEDES
 * antes de gastar.
 *
 * 🔴 POR QUÉ EXISTE, medido el 23-sep-2026. El botón que mide comprobaba que el
 * secreto `LEER_REPOS_HERMANOS` ESTUVIERA puesto, no que SIRVIERA. Pasó en
 * verde, y cuarenta segundos después murió dentro de `checkout` con esto:
 *
 *     Bad credentials - https://docs.github.com/rest
 *
 * Un mensaje que no dice qué hacer, en un paso que no es el que falla de
 * verdad. El permiso estaba caducado. Comprobarlo cuesta UNA llamada de un
 * segundo; descubrirlo así cuesta el run entero y media hora de buscar.
 *
 * 🔑 VIVE AQUÍ Y NO DENTRO DE CADA BOTÓN (SEGUNDA LEY). CUATRO workflows usan
 * ese permiso —medido con `grep -ln LEER_REPOS_HERMANOS .github/workflows/`—,
 * así que escribir la comprobación en cada uno serían cuatro copias, y la que
 * se quedara vieja sería la que nadie mira.
 *
 * 🔑 Y LA DECISIÓN SE SEPARA DE LA LLAMADA: `veredicto()` es una función pura
 * que recibe lo que contestó GitHub y dice qué significa. Así el amarre la
 * prueba con respuestas de mentira, sin red y sin permiso — que es la única
 * forma de comprobar que un vigía se queja cuando toca.
 *
 * Se usa así, desde un botón:
 *     LEER_REPOS_HERMANOS: ${{ secrets.LEER_REPOS_HERMANOS }}
 *     run: node scripts/vigia-repos-hermanos.cjs
 */

// Los repos que hacen falta. No se copian de un YAML: es la lista de los que
// `pruebas/cargar.cjs` busca en la carpeta raíz.
const HERMANOS = ['frey2605/guajirago-admin', 'frey2605/guajirago-aliados'];

const COMO_SE_RENUEVA = [
  '   Se renueva en: https://github.com/settings/personal-access-tokens',
  '     · Repository access → Only select repositories → guajirago-admin y guajirago-aliados',
  '     · Repository permissions → Contents → Read-only',
  '   Y se pega en: Settings → Secrets and variables → Actions → LEER_REPOS_HERMANOS',
];

/**
 * QUÉ SIGNIFICA LO QUE CONTESTÓ GITHUB. Función pura: ni red, ni secretos.
 *
 * `respuestas` es una lista de { repo, estado, error }, donde `estado` es el
 * código que devolvió GitHub y `error` el tropiezo de red, si lo hubo.
 *
 * Devuelve { para, titulo, detalle[] }. `para` = true significa PARAR el botón.
 */
function veredicto(hayToken, respuestas) {
  if (!hayToken) {
    return {
      para: true,
      titulo: 'FALTA EL SECRETO «LEER_REPOS_HERMANOS»',
      detalle: [
        '   Sin él no se pueden traer guajirago-admin y guajirago-aliados, y sin los tres repos',
        '   juntos NUEVE archivos de pruebas no corren: el candado de las pruebas quedaría más',
        '   flojo que el del PC y no lo diría.',
        ...COMO_SE_RENUEVA,
      ],
    };
  }

  // 🔴 UN TROPIEZO DE RED NO ES UN PERMISO MALO, y confundirlos es fabricar
  //  falsas alarmas. Un vigía que grita sin fuego se deja de mirar, y éste
  //  protege al que más falta hace. Si no se pudo ni preguntar, se avisa y se
  //  sigue: el `checkout` de después es quien manda.
  const sinRespuesta = respuestas.filter((r) => r.error || r.estado == null);
  if (sinRespuesta.length === respuestas.length) {
    return {
      para: false,
      titulo: 'no se pudo preguntarle a GitHub si el permiso sirve',
      detalle: [
        '   Ni un repo contestó: ' + sinRespuesta.map((r) => r.repo + ' (' + (r.error || 'sin respuesta') + ')').join(', '),
        '   Eso es un tropiezo de RED, no un permiso malo. Se avisa y se sigue: si el permiso',
        '   estuviera mal, el paso que trae los repos lo dirá igual.',
      ],
    };
  }

  const malos = respuestas.filter((r) => r.estado != null && r.estado !== 200);
  if (!malos.length) {
    return { para: false, titulo: null, detalle: [] };
  }

  // 401 = la llave no vale (caducada o revocada). 403 = vale pero no le dejan.
  // 404 = GitHub esconde lo que no puedes ver, así que un repo privado sin
  // permiso contesta 404, NO 403 — y por eso «no existe» y «no tienes acceso»
  // se dicen juntos, en vez de afirmar el que no es.
  const porQue = (e) => (
    e === 401 ? 'el permiso NO VALE: está caducado o revocado'
      : e === 403 ? 'el permiso vale pero GitHub no deja leer ese repo'
        : e === 404 ? 'el repo no existe, o este permiso no tiene acceso a él (GitHub contesta lo mismo en los dos casos)'
          : 'GitHub contestó ' + e + ', que no es un «sí»');

  return {
    para: true,
    titulo: 'EL PERMISO «LEER_REPOS_HERMANOS» NO SIRVE',
    detalle: [
      ...malos.map((r) => '   · ' + r.repo + ' → ' + porQue(r.estado)),
      '',
      '   Sin él no se pueden traer los repos hermanos, y sin los tres juntos NUEVE archivos de',
      '   pruebas no corren. Se para AQUÍ, en un paso que dice qué hacer, en vez de morir dentro',
      '   de `checkout` con un «Bad credentials» que no lo dice.',
      ...COMO_SE_RENUEVA,
    ],
  };
}

async function preguntar(repo, token) {
  try {
    const r = await fetch('https://api.github.com/repos/' + repo, {
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'guajirago-vigia',
      },
    });
    return { repo, estado: r.status, error: null };
  } catch (e) {
    return { repo, estado: null, error: e.message };
  }
}

async function principal() {
  const token = process.env.LEER_REPOS_HERMANOS || '';
  const respuestas = token
    ? await Promise.all(HERMANOS.map((r) => preguntar(r, token)))
    : [];
  const v = veredicto(!!token, respuestas);

  if (!v.titulo) {
    console.log('✅ El permiso sirve: se pueden leer ' + HERMANOS.join(' y ') + '.');
    return 0;
  }
  console.log((v.para ? '⛔ ' : '⚠️  ') + v.titulo);
  for (const l of v.detalle) console.log(l);
  return v.para ? 1 : 0;
}

if (require.main === module) {
  principal().then((c) => process.exit(c)).catch((e) => {
    // Ni esto se queda callado: si el propio vigía revienta, se dice y se sigue.
    console.log('⚠️  el vigía del permiso reventó: ' + e.message + ' — se sigue, el checkout manda.');
    process.exit(0);
  });
}

module.exports = { veredicto, HERMANOS };
