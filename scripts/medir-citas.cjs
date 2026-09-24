/**
 * LAS NOTAS QUE MIENTEN — ¿cuántos comentarios citan algo que ya no existe?
 *
 *   node scripts/medir-citas.cjs     <- SOLO LEE. No escribe nada.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * El 12-sep-2026 este fallo mordió CINCO VECES en un solo día, y una de ellas
 * dentro del comentario que venía a arreglar ese mismo fallo. La peor: las
 * reglas de seguridad decían que el pasajero suelta el viaje en
 * «Solicitar.js:966 / SolicitarMensajeria.js:980». Medido ese día: el `:966`
 * era un RENGLÓN EN BLANCO, el `:771` que citaban al lado era una llave de
 * cierre, y `SolicitarMensajeria.js` llevaba una semana borrado. Quien fuera a
 * comprobar quién escribe ese campo no encontraba nada.
 *
 * Un comentario que miente es peor que no tener comentario: el que no está
 * hace mirar el código; el que miente hace mirar el sitio equivocado, y encima
 * con confianza.
 *
 * ── LAS DOS COSAS QUE SÍ SE PUEDEN MEDIR ────────────────────────────────────
 *   1. Citas a un ARCHIVO que ya no existe.
 *   2. Citas a un RENGLÓN que se sale del archivo (el `:980` de un archivo de
 *      900). Si el archivo tiene varios sitios con ese nombre —hay CUATRO
 *      `index.js`— vale el más largo.
 *
 * Lo que NO se puede medir solo: un renglón que SÍ existe pero ya no es el que
 * dice. Contra eso solo hay una defensa, y es no poner números: **se cita el
 * nombre de la función, que no se mueve**. Los números nacen viejos.
 *
 * ── DOS FALLOS QUE TUVO ESTE MISMO GUION (y que enseñan lo mismo) ────────────
 *   · Resolvía cada nombre con el PRIMER archivo que encontraba. Hay cuatro
 *     `index.js`: el de `functions` con 1.139 renglones y el de `src` con 25.
 *     Seis citas buenas salían como rotas. Un medidor que acusa de más gasta el
 *     tiempo de alguien buscando un agujero que no existe.
 *   · Leía `.guardian-foto.json` como si fuera `guardian-foto.js`, porque en la
 *     lista de extensiones `js` iba antes que `json` y casaba primero. Las
 *     largas van delante.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');

// SE MIRAN LAS CARPETAS ENTERAS, con lo que haya dentro. Antes se listaban
// «a un nivel», y el día que alguien creara `src/componentes/` el guion se
// habría apagado EN SILENCIO sin que nadie lo notara — que es la peor forma de
// que falle un vigilante. Lo midió la segunda opinión.
const CARPETAS = [
  'guajirago/src', 'guajirago/functions', 'guajirago/public',
  'guajirago-admin/src', 'guajirago-aliados/src',
  'pruebas', 'scripts', 'docs', '.claude',
];
// Y las RAÍCES, solo un nivel: ahí viven los README y las reglas.
const RAICES = ['.', 'guajirago', 'guajirago-admin', 'guajirago-aliados'];
const NO_ENTRAR = new Set(['node_modules', 'build', '.git', 'dist', 'coverage']);

// SOLO LA CABECERA DE ESTE GUION SE EXIME, no el archivo entero. Ahí arriba se
// nombran a propósito los archivos borrados y los renglones equivocados que
// vino a cazar —son los EJEMPLOS que explican para qué sirve—, así que mirarlos
// lo pondría rojo para siempre por hacer bien su trabajo. Pero de la cabecera
// para abajo se mira como cualquier otro: eximir el archivo completo dejaba
// fuera de control cualquier nota futura escrita aquí dentro, y este es
// justamente el archivo donde más fácil sería confiarse. Lo cazó la segunda
// opinión.
const ELGUION = 'scripts/medir-citas.cjs';
const CABECERA_DEL_GUION = 42;   // hasta el `require`; abajo hay un amarre

// Huecos de ejemplo en los textos de ayuda («<archivo.js>»), no citas de verdad.
const HUECOS = /^(archivo|fichero|nombre|algo|xxx|ejemplo)\./i;

/**
 * ── LAS CITAS HISTÓRICAS QUE SÍ SE QUEDAN ───────────────────────────────────
 *
 * Nombrar un archivo borrado NO siempre es mentir. Estas notas cuentan POR QUÉ
 * existe algo —«hasta tal día esto estaba escrito dos veces, aquí y allí»— y
 * esa historia es cierta y hace falta: es lo que impide que alguien vuelva a
 * partir en dos lo que se juntó. Todas van EN PASADO.
 *
 * 🔴 CADA EXCUSA DICE TRES COSAS: en qué archivo vale, QUÉ NOMBRE perdona, y un
 * trozo de la nota. Tienen que cumplirse las tres.
 *
 * Las dos versiones anteriores dejaron una puerta abierta, y las dos las midió
 * la segunda opinión:
 *   · La primera perdonaba por pareja (archivo, nombre citado). Metió en
 *     `CLAUDE.md` una fila de deuda NUEVA y EN PRESENTE citando ese archivo
 *     borrado y el guion dijo CERO. Una fila blanqueaba todas las menciones
 *     futuras de ese nombre — y `CLAUDE.md` es justo donde se escribe la deuda.
 *   · La segunda perdonaba por (archivo, trozo de la nota) y se olvidó del
 *     nombre: entonces CUALQUIER archivo inventado que se colara cerca de esa
 *     nota quedaba perdonado. Probado: un archivo inventado a dos renglones de
 *     la nota de `tarifas.js` pasaba sin más.
 *   · Y la tercera perdonaba TODAS las citas de su nota, así que una mención
 *     NUEVA del mismo archivo borrado metida dentro de la nota histórica
 *     también colaba. Ahora cada fila perdona UNA cita: la segunda sale roja.
 *
 * Una excusa por archivo es una puerta. Una excusa por archivo + nombre + nota
 * es una excepción, y se ve de un vistazo a qué renglón se refiere.
 *
 * Cada una lleva su motivo. Si una deja de estar aquí, el guion la señala.
 */
/**
 * ── ARCHIVOS QUE NACEN AL TRABAJAR ──────────────────────────────────────────
 *
 * 🔴 ENCONTRADO EL 24-sep-2026, la PRIMERA vez que la suite corrió en una máquina
 *  limpia. Este guion daba 0 citas rotas en el PC y **4 en GitHub**: las cuatro a
 *  `.guardian-foto.json`, que no está en el repo porque lo CREA el propio guardián
 *  al sacar una foto. En una máquina donde se trabaja existe; en un clon recién
 *  bajado, no.
 *
 *  O sea que esta prueba llevaba meses en verde **solo porque nunca había corrido
 *  donde nadie había trabajado**. Eso no es una prueba: es una casualidad.
 *
 * 🔑 Y LA EXCUSA NO SE CREE SOLA: cada nombre de aquí tiene que estar de verdad en
 *  `.gitignore`. Si alguien mete aquí un archivo que el repo SÍ debería traer, el
 *  guion lo canta — porque si no, esta lista sería la puerta para perdonar
 *  cualquier cita rota escribiendo su nombre.
 */
const NACEN_AL_TRABAJAR = [
  ['guardian-foto.json', 'la foto del guardián: la crea `guardian.cjs foto` y git la ignora'],
];

const HISTORIA = [
  ['guajirago/src/configApp.js', 'SolicitarMensajeria.js',
    'Estos seis números estaban escritos a mano',
    'cuenta dónde estaban los seis números antes de juntarlos'],
  ['guajirago/src/descuentos.js', 'SolicitarMensajeria.js',
    'esta cuenta vivía COPIADA, byte por byte',
    'cuenta que la cuenta del descuento vivía copiada, con hash'],
  ['guajirago/src/tarifas.js', 'SolicitarMensajeria.js',
    'sí la conocía. Era la única de las tres',
    'cuenta cuál de las tres conocía la mensajería'],
  ['guajirago/src/riohacha.js', 'Conductor.js',
    'un archivo muerto que nadie',
    'dice que ese archivo muerto se borró el 23-ago-2026, con permiso'],
  ['pruebas/compartidos.test.js', 'Conductor.js',
    'el archivo muerto que conservaba su copia vieja',
    'lo mismo: dice que se borró, y por eso ya no se mira'],
  ['pruebas/gemelosSolicitar.test.js', 'SolicitarMensajeria.js',
    'la pantalla de pedir estaba escrita DOS VECES',
    'cuenta de dónde viene la unión, con la medida de aquel día'],
  ['guajirago/src/viajeNuevo.js', 'SolicitarMensajeria.js',
    'se borró el 5-sep-2026 al',
    'dice con su fecha que esa pantalla se borró al juntar las dos'],
  ['CLAUDE.md', 'SolicitarMensajeria.js',
    'se borró el 5-sep-2026** al juntarlas',
    'la fila CERRADA de la tabla: cuenta por qué esa deuda ya no existe'],
];

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};

const MIRABLES = /\.(cjs|json|rules|js|md)(\.LIVE)?$/i;

/** Todos los archivos que se miran, con su ruta desde la raíz. */
function losArchivos() {
  const fuera = new Set();
  const meter = (rel) => fuera.add(rel.split('\\').join('/'));

  const bajar = (c) => {
    const dir = path.join(RAIZ, c);
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (NO_ENTRAR.has(e.name)) continue;
      const rel = c === '.' ? e.name : c + '/' + e.name;
      if (e.isDirectory()) bajar(rel);
      else if (MIRABLES.test(e.name)) meter(rel);
    }
  };
  for (const c of CARPETAS) bajar(c);

  // Las raíces, SIN bajar: ahí abajo están `node_modules` y las carpetas de
  // cada app, que ya se miran por su cuenta.
  for (const r of RAICES) {
    const dir = path.join(RAIZ, r);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() || !MIRABLES.test(e.name)) continue;
      meter(r === '.' ? e.name : r + '/' + e.name);
    }
  }
  return [...fuera];
}

// LAS EXTENSIONES LARGAS PRIMERO: con `js` delante, `guardian-foto.json` casaba
// como si acabara en `.js` y salía «archivo que no existe».
// Y sin distinguir mayúsculas: una extensión en MAYÚSCULAS era invisible.
// Y el `(?![\w-])` del final NO SOBRA: sin él, `rel.rulesetName` se leía como
// una cita a un archivo de reglas, y el guion acusaba a dos guiones sin culpa.
// La extensión tiene que ACABAR ahí, no ser el principio de otra palabra.
const CITA = /([A-Za-z][\w.-]*\.(?:rules|json|cjs|md|js))(?![\w-])(?::(\d+))?/gi;

// Los archivos de configuración que se nombran a cada rato y no son citas.
// OJO: por nombre ENTERO. El filtro de antes empezaba por `firebase.` y se
// llevaba por delante `firebase.js`, que SÍ es un archivo del proyecto y sí se
// cita — así que sus citas no se comprobaban nunca. Lo cazó la segunda opinión.
const CONFIG = new Set(['package.json', 'package-lock.json', 'tsconfig.json',
  'firebase.json', 'jsconfig.json', 'manifest.json']);

/**
 * El trozo de la línea que es COMENTARIO, o '' si no hay.
 *
 * Antes solo valían las líneas que EMPIEZAN por `//`. Un
 * un comentario de bloque al final de una línea de código era
 * invisible. Ahora se corta desde la primera marca de comentario.
 */
function laParteComentada(linea, esMarkdown) {
  if (esMarkdown) return linea;
  const i = linea.search(/\/\/|\/\*|^\s*\*|^\s*#/);
  if (i < 0) return '';
  return linea.slice(i);
}

/**
 * ¿Esta cita es de FUERA del proyecto?
 *
 * 🔴 LA PRIMERA VERSIÓN TIRABA TODA CITA CON UNA BARRA DELANTE, y con eso se
 * cargaba **432 de las citas del repo** — justo el estilo que más se usa en
 * `firestore.rules` y en `CLAUDE.md` (`admin/Mensajeria.js`,
 * `guajirago/src/Solicitar.js`). El «cero citas rotas» solo cubría la mitad del
 * proyecto, y la fila que este trabajo arregló a mano era precisamente de las
 * que el guion nunca habría cazado. Lo midió la segunda opinión.
 *
 * Ahora se distingue: es de FUERA si viene de una dirección de internet, o si
 * la primera carpeta de la ruta no es ninguna de este proyecto (`react-scripts/
 * scripts/…`). Lo demás se comprueba como cualquier cita.
 */
const CARPETAS_NUESTRAS = new Set(['guajirago', 'guajirago-admin', 'guajirago-aliados',
  'admin', 'aliados', 'src', 'pruebas', 'scripts', 'functions', 'docs', 'public', '.claude']);

function deFuera(comentario, desde) {
  // ¿Hay una dirección de internet abierta antes de esta cita, sin espacios?
  const antes = comentario.slice(0, desde);
  const espacio = Math.max(antes.lastIndexOf(' '), antes.lastIndexOf('`'),
    antes.lastIndexOf('('), antes.lastIndexOf('«'));
  const trozo = antes.slice(espacio + 1);
  if (trozo.includes('://')) return true;
  if (!trozo.includes('/')) return false;          // sin carpeta: cita normal
  const primera = trozo.split('/')[0];
  return !CARPETAS_NUESTRAS.has(primera);
}

/** Las citas rotas: a un archivo que no está, o a un renglón que se sale. */
function medir() {
  const archivos = losArchivos();
  const porNombre = {};
  for (const a of archivos) {
    const base = path.basename(a);
    (porNombre[base] = porNombre[base] || []).push(a);
    // Y también sin el punto de delante: una cita escribe «.guardian-foto.json»
    // y la expresión, que empieza por letra, se queda con «guardian-foto.json».
    // Sin esto, un archivo oculto que SÍ existe salía como desaparecido.
    if (base.startsWith('.')) (porNombre[base.slice(1)] = porNombre[base.slice(1)] || []).push(a);
  }
  // Se perdona por RENGLÓN: archivo + un trozo que tiene que estar en la línea.
  const perdonadas = HISTORIA.map(([d, quien, trozo]) => ({ d, quien, trozo }));

  // La excusa de «nace al trabajar» tiene que estar respaldada por `.gitignore`.
  // Sin esto, la lista sería un permiso para perdonar cualquier cita escribiendo
  // su nombre — y una excusa floja es una puerta (lo dice el propio guion arriba).
  const loQueGitIgnora = (() => {
    try { return fs.readFileSync(path.join(RAIZ, '.gitignore'), 'utf8'); } catch (e) { return ''; }
  })();
  const excusasSinRespaldo = NACEN_AL_TRABAJAR
    .filter(([n]) => !loQueGitIgnora.includes(n))
    .map(([n, porque]) => n + ' — dice «' + porque + '» pero .gitignore no lo nombra');
  const naceAlTrabajar = (nombre) => NACEN_AL_TRABAJAR
    .some(([n]) => n.toLowerCase() === nombre.toLowerCase()
      && loQueGitIgnora.includes(n));
  const usadas = new Set();

  const fuera = { total: 0, conRenglon: 0, sinArchivo: [], sinRenglon: [], historiaViva: [],
    excusasSinRespaldo };
  for (const rel of archivos) {
    const esteGuion = rel === ELGUION;
    const texto = fs.readFileSync(path.join(RAIZ, rel), 'utf8');
    const renglones = texto.split('\n');
    renglones.forEach((linea, i) => {
      // ── HASTA DÓNDE LLEGA UNA EXCUSA ────────────────────────────────────
      //  En un archivo de código, una nota es el BLOQUE DE COMENTARIO seguido:
      //  el trozo que la distingue suele estar un renglón más arriba y el
      //  nombre del archivo en el siguiente. Así que la excusa vale en todo su
      //  bloque, y se corta en cuanto aparece una línea que no es comentario.
      //
      //  🔴 EN UN `.md`, SOLO SU PROPIO RENGLÓN. En una tabla las filas van
      //  pegadas, así que una ventana de varias líneas dejaba que una fila
      //  NUEVA heredara el perdón de la de al lado. La segunda opinión lo hizo
      //  dos veces seguidas: metió una fila de deuda inventada y EN PRESENTE
      //  dos renglones debajo de la fila cerrada, y el guion dijo CERO. Cada
      //  fila de una tabla es una nota distinta y se defiende sola.
      if (esteGuion && i < CABECERA_DEL_GUION) return;   // los ejemplos de la cabecera
      const esMd = rel.endsWith('.md');
      let alrededor;
      if (esMd) alrededor = linea;
      else {
        let a = i;
        let b = i;
        const esNota = (l) => /^\s*(\/\/|\*|\/\*|#)/.test(l || '');
        while (a > 0 && esNota(renglones[a - 1])) a -= 1;
        while (b < renglones.length - 1 && esNota(renglones[b + 1])) b += 1;
        alrededor = renglones.slice(a, b + 1).join('\n');
      }
      const comentario = laParteComentada(linea, rel.endsWith('.md'));
      if (!comentario) return;
      let m;
      CITA.lastIndex = 0;
      while ((m = CITA.exec(comentario)) !== null) {
        const nombre = m[1];
        const num = m[2] ? Number(m[2]) : null;
        if (CONFIG.has(nombre.toLowerCase())) continue;
        if (HUECOS.test(nombre)) continue;
        if (deFuera(comentario, m.index)) continue;
        fuera.total += 1;
        const donde = porNombre[nombre] || porNombre[Object.keys(porNombre).find(
          (k) => k.toLowerCase() === nombre.toLowerCase())];
        if (!donde) {
          // ¿Hay una fila de HISTORIA para ESTE renglón? No basta el archivo:
          // el trozo declarado tiene que estar en la línea.
          // 🔴 UNA EXCUSA PERDONA UNA CITA, NO TODAS LAS DE SU NOTA. Si no,
          // metiendo una mención NUEVA del mismo archivo borrado dentro de la
          // nota histórica, quedaba perdonada también. Cada fila de HISTORIA
          // cubre exactamente la cita que se declaró; la segunda que aparezca
          // con el mismo nombre y en el mismo sitio sale roja y hay que
          // declararla aparte (o quitarla). Lo midió la segunda opinión.
          const fila = perdonadas.find((x) => x.d === rel
            && x.quien.toLowerCase() === nombre.toLowerCase()
            && alrededor.includes(x.trozo)
            && !usadas.has(x.d + '|' + x.quien + '|' + x.trozo));
          if (fila) {
            // Es historia declarada. Pero si lleva RENGLÓN, ya no vale: un
            // número de un archivo borrado no lo puede comprobar nadie.
            if (num !== null) {
              fuera.sinArchivo.push({ rel, renglon: i + 1, cita: m[0], eraHistoria: true });
            } else {
              usadas.add(fila.d + '|' + fila.quien + '|' + fila.trozo);
              fuera.historiaViva.push(fila.d + '|' + fila.quien + '|' + fila.trozo);
            }
          } else if (!naceAlTrabajar(nombre)) {
            fuera.sinArchivo.push({ rel, renglon: i + 1, cita: m[0] });
          }
          continue;
        }
        if (num !== null) {
          fuera.conRenglon += 1;
          // TODOS los archivos con ese nombre, no el primero.
          const largos = donde.map(
            (d) => fs.readFileSync(path.join(RAIZ, d), 'utf8').split('\n').length);
          const mayor = Math.max(...largos);
          if (num > mayor) fuera.sinRenglon.push({ rel, renglon: i + 1, cita: m[0], mayor });
        }
      }
    });
  }
  return fuera;
}

const r = medir();

console.log('');
console.log(C.neg + '  LAS NOTAS QUE MIENTEN' + C.off);
console.log(C.gris + '  comentarios que citan un archivo o un renglón que ya no existe' + C.off);
console.log('');
console.log('    citas de archivos en comentarios ... ' + r.total);
console.log('    de ellas, con número de renglón ... ' + r.conRenglon);
console.log(C.gris + '      (un número dentro de un comentario nace viejo: se mueve con la '
  + 'siguiente edición' + C.off);
console.log(C.gris + '       y ya nadie lo comprueba. Se cita el nombre de la función, que no '
  + 'se mueve.)' + C.off);
console.log('');

const pinta = (titulo, lista, extra) => {
  console.log('    ' + (lista.length === 0 ? C.ver + '✓ ' : C.roj + '🔴 ') + titulo + ': '
    + lista.length + C.off);
  for (const x of lista) {
    console.log(C.gris + '        ' + x.rel + ':' + x.renglon + '   →  ' + x.cita
      + (extra ? extra(x) : '') + C.off);
  }
};

// `firestore.rules.LIVE` es la FOTO de lo que está puesto en el servidor. No se
// edita a mano —sería mentirle a la foto—: se arregla `firestore.rules`, se
// despliega, y se vuelve a bajar. Por eso va aparte, para que no parezca
// trabajo pendiente de escritorio cuando lo que falta es un despliegue.
const esLaFoto = (x) => x.rel.endsWith('.LIVE');
// 🔴 UNA EXCUSA SIN RESPALDO ES UNA PUERTA. Si alguien mete en
// `NACEN_AL_TRABAJAR` un archivo que el repo SÍ debería traer, esa lista pasaría a
// perdonar cualquier cita rota con solo escribir su nombre. Se canta ANTES que
// nada, porque mientras esté ahí lo demás no se puede creer.
if (r.excusasSinRespaldo && r.excusasSinRespaldo.length) {
  console.log('');
  console.log('    ' + C.roj + '🔴 ' + r.excusasSinRespaldo.length
    + ' excusa(s) de «nace al trabajar» que .gitignore NO respalda:' + C.off);
  for (const x of r.excusasSinRespaldo) console.log('        ' + x);
  console.log(C.gris + '      Mientras estén ahí, esta lista perdona sin motivo.' + C.off);
  process.exitCode = 1;
}

pinta('citas a un ARCHIVO que no existe', r.sinArchivo.filter((x) => !esLaFoto(x)),
  (x) => (x.eraHistoria ? '   (está en HISTORIA, pero con renglón: no vale)' : ''));
const enLaFoto = r.sinArchivo.filter(esLaFoto);
if (enLaFoto.length > 0) {
  console.log('');
  console.log('    ' + C.ama + '⚠ y ' + enLaFoto.length + ' en `firestore.rules.LIVE`, que es '
    + 'la foto de lo PUESTO en el servidor.' + C.off);
  console.log(C.gris + '      Ésa no se edita a mano: se arregla `firestore.rules`, se '
    + 'despliega y se vuelve a bajar.' + C.off);
}
console.log('');
pinta('citas a un RENGLÓN fuera del archivo', r.sinRenglon,
  (x) => '   (el más largo con ese nombre tiene ' + x.mayor + ')');
console.log('');
console.log('    ' + C.gris + 'historia declarada, y cierta: ' + r.historiaViva.length
  + ' (ver HISTORIA en este guion)' + C.off);

// ¿Sobra alguna de las declaradas? Si se limpió una nota y su fila sigue aquí,
// la lista empieza a mentir por el otro lado.
const vivas = new Set(r.historiaViva);
const sobran = HISTORIA.filter(([d, quien, trozo]) => !vivas.has(d + '|' + quien + '|' + trozo));
if (sobran.length > 0) {
  console.log('');
  console.log(C.ama + '    ⚠ en HISTORIA sobran ' + sobran.length + ' filas: esas notas ya no '
    + 'están.' + C.off);
  for (const [d, quien, trozo] of sobran) console.log(C.gris + '        ' + d + '  →  ' + quien + '  «' + trozo.slice(0, 38) + '…»' + C.off);
}

console.log('');
// EL VEREDICTO CUENTA LO QUE SE PUEDE ARREGLAR ESCRIBIENDO. Las de
// `firestore.rules.LIVE` se van solas al desplegar, así que meterlas aquí
// dejaba el guion diciendo «falló» para siempre — y un semáforo que está
// siempre en rojo no lo mira nadie.
const enElRepo = r.sinArchivo.filter((x) => !esLaFoto(x)).length + r.sinRenglon.length;
console.log(enElRepo === 0
  ? C.ver + '  ✓ ninguna nota del repo apunta a algo que no existe.' + C.off
  : C.ama + '  ⚠ ' + enElRepo + ' notas apuntan a algo que no existe.' + C.off);
if (enLaFoto.length > 0) {
  console.log(C.gris + '    (y ' + enLaFoto.length + ' en la foto del servidor, que se van al '
    + 'desplegar las reglas)' + C.off);
}
console.log('');
// 🔴 Y UNA EXCUSA SIN RESPALDO CUENTA COMO PROBLEMA. Sin esto, el guion enseñaba
// la queja en rojo y salía con 0 — o sea que se quejaba y firmaba bien a la vez, y
// quien mirara solo la salida no se enteraba. `process.exitCode` lo pisaba este
// `process.exit` de aquí abajo, que solo miraba las citas.
const excusasMalas = (r.excusasSinRespaldo || []).length;
process.exit(enElRepo === 0 && excusasMalas === 0 ? 0 : 1);
