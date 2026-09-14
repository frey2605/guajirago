/**
 * EL HISTORIAL DEL CONDUCTOR — ¿qué ve, y qué no ve, de su propio trabajo?
 *
 *   node scripts/medir-historial-conductor.cjs
 *
 * 🔴 NO ESCRIBE NADA: ni un archivo, ni un dato. Contra Firestore solo pide
 * (`GET`). Pero sí **EJECUTA** dos trozos sacados del código de la pantalla —el
 * filtro y la bandera— para medir qué dejan pasar, y eso pasa también en cada
 * `npm test`, porque el amarre importa este archivo. Se comprueba antes que
 * esos dos trozos no nombren las puertas de Node (ver `pareceSeguro`), pero un
 * bucle infinito ahí colgaría las pruebas: no hay tope de tiempo.
 *
 * Guion del PASO 1, y el mismo que corre el PASO 12.
 *
 * ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
 * La pantalla «Mis viajes» del conductor pide los suyos y luego se queda solo
 * con unos cuantos estados. Los que no estén en esa lista NO APARECEN: no dan
 * error, no salen en rojo, simplemente no están. Y el conductor no echa de
 * menos lo que nunca vio.
 *
 * Y hay una segunda mitad, peor: los que SÍ salen se pintan verde «Completado»
 * o rojo «Cancelado» según una bandera, y debajo va la TARIFA. Si la bandera no
 * conoce una forma de cancelar, ese viaje sale **en verde, con su tarifa**, como
 * si el conductor lo hubiera hecho y cobrado.
 *
 * ── CÓMO LO MIDE ────────────────────────────────────────────────────────────
 * 🔴 NO LEE ETIQUETAS: SACA EL FILTRO Y LA BANDERA DEL ARCHIVO Y LOS CORRE,
 * estado por estado. Copiar aquí las listas sería otra versión de la misma
 * lista —la enfermedad que se persigue—, y darlas por buenas porque el nombre
 * esté escrito es peor todavía: la primera versión hacía eso, y entonces restaba
 * la lista buena de sí misma y la columna «FALTAN» no podía dar otra cosa que 0.
 *
 * Y se cuenta POR CONDUCTOR, porque la pantalla es de cada uno: un total
 * general escondería que a uno le faltan la mitad de sus viajes.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PANTALLA = 'guajirago/src/AppConductor.js';

const { cargarDeLaApp } = require('../pruebas/cargar.cjs');
const LISTAS = cargarDeLaApp('guajirago/src/estadosViaje.js');
const { ESTADOS_TERMINADOS, ESTADOS_EN_CURSO } = LISTAS;

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const C = {
  neg: '\x1b[1m', off: '\x1b[0m', gris: '\x1b[90m',
  ama: '\x1b[33m', roj: '\x1b[31m', ver: '\x1b[32m',
};
const pad = (s, n) => (String(s).length >= n ? String(s).slice(0, n)
  : String(s) + ' '.repeat(n - String(s).length));

/**
 * LO QUE HACE LA PANTALLA — EJECUTÁNDOLO, NO LEYÉNDOLE LA ETIQUETA.
 *
 * 🔴 ESTA FUNCIÓN LA USAN LOS DOS: este guion (pasos 1 y 12) y el amarre
 * «EL HISTORIAL DEL CONDUCTOR» de `pruebas/amarres.test.js`, que la importa.
 * NO se copia allí. La primera versión sí estaba escrita dos veces, con regex
 * casi calcadas, y **se separaron el mismo día**. SEGUNDA LEY: un proceso, un
 * archivo. Y como el amarre depende ahora de este archivo, el amarre le da de
 * comer a esta misma función **pantallas de mentira** (el parámetro
 * `fuenteDePrueba`) y exige que se queje: así el vigilante también se vigila.
 *
 * 🔴 Y SOBRE TODO: `entran` y `rojos` SE CALCULAN CORRIENDO EL CÓDIGO DE LA
 * PANTALLA, estado por estado. La versión anterior los **copiaba** de
 * `ESTADOS_TERMINADOS` en cuanto veía el nombre escrito, así que el informe
 * restaba la lista buena de sí misma y la columna «FALTAN» no podía dar otra
 * cosa que 0; y las dos comparaciones del amarre comparaban `ESTADOS_TERMINADOS`
 * con `ESTADOS_TERMINADOS`, que no puede ponerse rojo nunca. Con eso puesto,
 * `.filter(v => v.estado !== 'expirado' && ESTADOS_TERMINADOS.includes(v.estado))`
 * escondía 9 viajes y este guion firmaba «✓ todos ven todo». Lo midió la
 * segunda opinión. **Un medidor que supone no es un medidor.**
 *
 * Devuelve `quejas`: todo lo que está MAL en la pantalla. El amarre se pone rojo
 * con ese mismo texto, sin reescribirlo. **Cegado y mal no son lo mismo**: si no
 * se pudo leer la pantalla (`entran`/`rojos` en `null`) el guion dice NO HAY
 * VEREDICTO; si se pudo leer pero hay quejas, dice qué está mal Y SIGUE DANDO
 * EL CONTEO — que es lo que hace falta para carear el paso 1 con el paso 12.
 */
const TODOS_LOS_ESTADOS = [...ESTADOS_TERMINADOS, ...ESTADOS_EN_CURSO];

/** El texto de dentro de un paréntesis, contándolos. `i` señala al `(`. */
function argumentoDe(texto, i) {
  let hondo = 0;
  for (let j = i; j < texto.length; j += 1) {
    if (texto[j] === '(') hondo += 1;
    else if (texto[j] === ')') { hondo -= 1; if (hondo === 0) return texto.slice(i + 1, j); }
  }
  return null;
}

/**
 * Quita los comentarios que van AL FINAL de un renglón.
 *
 * `soloCodigo` solo quita los `//` que ABREN el renglón, a propósito, para no
 * destrozar los `https://`. Pero aquí se buscan métodos encadenados, y un
 * `// ojo: aquí hubo un .slice(0, 20)` al final del filtro daba un ROJO FALSO
 * con un mensaje que además mentía («se le encadenó .slice»). Lo cazó la
 * segunda opinión. Se respeta el `://`.
 */
const sinRabo = (t) => t.split('\n').map((l) => l.replace(/(^|[^:])\/\/.*/, '$1')).join('\n');

/**
 * Desde `desde`, el texto hasta el `;` que cierra LA FRASE — no el primero que
 * aparezca. Se cuenta la hondura de `( [ {`, así que una flecha con cuerpo
 * (`v => { const x = 1; return x; }`) no corta a mitad.
 */
function hastaElPuntoYComa(texto, desde) {
  let hondo = 0;
  for (let j = desde; j < texto.length; j += 1) {
    const ch = texto[j];
    if (ch === '(' || ch === '[' || ch === '{') hondo += 1;
    else if (ch === ')' || ch === ']' || ch === '}') hondo -= 1;
    else if (ch === ';' && hondo === 0) return texto.slice(desde, j);
  }
  return null;
}

/**
 * ¿Se puede correr este trozo sin miedo?
 *
 * Aquí se EJECUTA texto sacado de la app, y eso pasa ahora en cada `npm test`.
 * La segunda opinión coló una marca global escribiendo el filtro como
 * `(globalThis.x = 'algo', (v) => ...)`: una coma delante de la flecha y ya.
 * Así que el filtro tiene que EMPEZAR por una flecha, y ni él ni la bandera
 * pueden nombrar las puertas de salida de Node. No es una jaula —un `while
 * (true)` colgaría las pruebas— pero cierra lo que se encontró.
 */
const PUERTAS = /\b(?:require|process|globalThis|global|fetch|eval|Function|import|module|child_process|window|document)\b/;
function pareceSeguro(trozo, esFlecha) {
  if (PUERTAS.test(trozo)) return 'nombra `' + (PUERTAS.exec(trozo) || [])[0] + '`';
  if (esFlecha && !/^\s*\(?\s*[A-Za-z_$][\w$]*\s*\)?\s*=>/.test(trozo)) {
    return 'no empieza por una flecha `v => ...`, así que lleva algo pegado delante';
  }
  return null;
}

function loQueHaceLaPantalla(fuenteDePrueba) {
  const { soloCodigo, cuerpoDeLaFuncion } = require('../pruebas/cargar.cjs');
  const crudo = fuenteDePrueba != null ? fuenteDePrueba
    : fs.readFileSync(path.join(RAIZ, PANTALLA), 'utf8');
  const archivo = soloCodigo(crudo);
  const quejas = [];
  const nada = { entran: null, rojos: null, bandera: null, tope: null, quejas };

  // ── SE IMPORTA LA LISTA BUENA, Y CON SU NOMBRE ──────────────────────────
  //  🔴 ESTOS TRES FALLOS SE ANOTAN, PERO NO CIEGAN.
  //  Si al encontrar uno se dejaba de medir, este guion NO PODÍA CONTAR EL
  //  CÓDIGO VIEJO —que no importaba nada—, y entonces el paso 1 y el paso 12 no
  //  se pueden carear: es justo lo que el paso 1 existe para dar. Corrido contra
  //  el de antes decía «FALTAN 76» y «los ve: ?», no los 40 y el 16 de 47 que
  //  esta corrección cita. Lo midió la segunda opinión. Así que se apunta la
  //  queja **y se sigue midiendo**, con la lista que la pantalla use de verdad.
  let laQueUsa = ESTADOS_TERMINADOS;
  const trae = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/estadosViaje['"]/.exec(archivo);
  const piezas = trae ? trae[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (!trae || !piezas.includes('ESTADOS_TERMINADOS')) {
    const disfraz = piezas.find((s) => /\bas\s+ESTADOS_TERMINADOS$/.test(s));
    if (disfraz) {
      const deQuien = disfraz.split(/\s+as\s+/)[0].trim();
      laQueUsa = LISTAS[deQuien] || [];
      quejas.push('el import disfraza otra lista de `ESTADOS_TERMINADOS`: «' + disfraz + '». El '
        + 'nombre sigue ahí y todo parece bien, pero el historial enseña lo que diga '
        + '`' + deQuien + '`.');
    } else {
      laQueUsa = [];
      quejas.push('AppConductor.js no importa `ESTADOS_TERMINADOS` de `./estadosViaje`. Está '
        + 'en la MISMA carpeta: con la lista escrita a mano se separará de la buena sin que '
        + 'nada avise y al conductor le desaparecerán viajes.');
    }
  }
  const tapada = /(?:const|let|var)\s+ESTADOS_TERMINADOS\s*=\s*(\[[^\]]*\])/.exec(archivo);
  if (tapada) {
    try { laQueUsa = JSON.parse(tapada[1].split("'").join('"')); } catch (e) { laQueUsa = []; }
    quejas.push('dentro de AppConductor.js hay otro `ESTADOS_TERMINADOS = ' + tapada[1] + '` '
      + 'que TAPA al importado. El import sigue arriba, el nombre sigue escrito, y la pantalla '
      + 'usa la lista de mentira.');
  } else if (/(?:const|let|var)\s+ESTADOS_TERMINADOS\s*=/.test(archivo)) {
    laQueUsa = [];
    quejas.push('dentro de AppConductor.js hay otro `ESTADOS_TERMINADOS = ...` que TAPA al '
      + 'importado, y no pude leer qué vale.');
  }

  // ── LA PANTALLA EXISTE Y SE ENSEÑA ──────────────────────────────────────
  const arranca = archivo.indexOf('function HistorialConductor');
  if (arranca < 0) {
    quejas.push('ya no existe `HistorialConductor` en AppConductor.js. Es la pantalla del '
      + 'historial; si se renombró hay que cambiarlo aquí, que es lo único que la vigila.');
    return nada;
  }
  // Esto tampoco ciega: si la pantalla está apagada se anota y se sigue
  // midiendo el código, que es lo que se verá el día que se vuelva a encender.
  const seEnsena = /if\s*\(([^)]*)\)\s*return\s*<HistorialConductor/.exec(archivo);
  if (!seEnsena) {
    quejas.push('no encuentro dónde se enseña `<HistorialConductor />`. Si nadie la abre, la '
      + 'pantalla puede estar perfecta y el conductor no verla nunca.');
  } else if (/\bfalse\b/.test(seEnsena[1])) {
    quejas.push('la pantalla del historial está apagada desde donde se abre: «if ('
      + seEnsena[1].trim() + ')». El código de dentro sigue bien y no sirve de nada.');
  }
  const fn = cuerpoDeLaFuncion(archivo, arranca);
  if (!fn) { quejas.push('no pude leer el cuerpo de `HistorialConductor`.'); return nada; }
  // SIN COMENTARIOS DE FINAL DE RENGLÓN, en TODO el cuerpo. Antes solo se le
  // quitaban a la cadena de filtros, así que un `// ojo, aquí había un
  // setViajes(...)` al final de cualquier otro renglón daba ROJO FALSO.
  const t = sinRabo(fn.texto);

  // ── EL FILTRO NO SE MUDA A LA CONSULTA DEL SERVIDOR ─────────────────────
  if (/where\(\s*['"]estado['"]/.test(t)) {
    quejas.push('la consulta de `HistorialConductor` filtra por `estado` en el SERVIDOR. Así '
      + 'los viajes ni siquiera llegan al teléfono: la lista buena de aquí abajo no tiene nada '
      + 'que filtrar y el conductor los pierde igual.');
    return nada;
  }
  const elTope = /\blimit\(\s*(\d+)\s*\)/.exec(t);
  // La consulta, tal como está escrita. Es un ancla que SIEMPRE existe —sin
  // ella no habría pantalla—, al revés que el `limit`, que se puede quitar
  // (y quitarlo es justo el arreglo que la tabla de deuda anuncia).
  const laConsulta = /where\(\s*['"]conductorId['"][^)]*\)/.exec(t);
  if (!laConsulta) {
    quejas.push('la consulta de `HistorialConductor` ya no pide los viajes por `conductorId`. '
      + 'O cambió de forma, o esta pantalla dejó de ser «los viajes de este conductor».');
    return nada;
  }
  const tope = elTope ? Number(elTope[1]) : null;

  // ── QUÉ LISTA ACABA EN LA PANTALLA ──────────────────────────────────────
  //  Se sigue `setViajes(<var>)`. NO «el primer filter»: en esta misma función
  //  hay otro legítimo, el de la ganancia de hoy, que sí mira solo `finalizado`.
  const cuantosSet = (t.match(/setViajes\(/g) || []).length;
  if (cuantosSet !== 1) {
    quejas.push('`setViajes(...)` se llama ' + cuantosSet + ' veces en `HistorialConductor`, '
      + 'y debe llamarse UNA. Con dos, la primera puede llevar la lista buena y la segunda '
      + 'pisarla con lo que quiera — y esto solo miraría la primera.');
    return nada;
  }
  const alaPantalla = /setViajes\((\w+)\)/.exec(t);
  if (!alaPantalla) {
    quejas.push('no encuentro `setViajes(<variable>)` en `HistorialConductor`: no sé qué lista '
      + 'acaba en la pantalla del conductor.');
    return nada;
  }
  const laLista = alaPantalla[1];
  // 🔴 LA CADENA ENTERA, AUNQUE ESTÉ PARTIDA EN VARIOS `const`.
  //  Partirla —`const crudos = snap.docs.map(...); const lista = crudos.filter(...)`—
  //  es un arreglo legítimo, y la versión anterior solo miraba el último tramo:
  //  el `.map` se quedaba fuera y con él la comprobación de que nadie le pone el
  //  `estado` a mano a todos los viajes. Así que se sigue hacia atrás: si un
  //  tramo empieza por una variable que también se arma aquí, se trae la suya.
  let c = '';
  let nombre = laLista;
  for (let vuelta = 0; vuelta < 6; vuelta += 1) {
    const arranca = new RegExp('(?:const|let|var)\\s+' + nombre + '\\s*=').exec(t);
    if (!arranca) break;
    // HASTA EL `;` DE VERDAD, contando llaves y paréntesis. Con un `[\s\S]*?;`
    // no ávido, una flecha con cuerpo —`v => { const x = 1; return x; }`—
    // cortaba en su primer `;` de dentro y esto daba ROJO FALSO sobre código bueno.
    const tramo = hastaElPuntoYComa(t, arranca.index + arranca[0].length);
    if (tramo == null) {
      quejas.push('la cadena que arma «' + nombre + '» no cierra: no la pude leer entera.');
      return nada;
    }
    c = tramo + c;
    const deQuien = /^\s*([A-Za-z_$][\w$]*)\s*[.;\n]/.exec(tramo);
    if (!deQuien || deQuien[1] === 'snap' || deQuien[1] === nombre) break;
    nombre = deQuien[1];
  }
  if (!c.trim()) {
    quejas.push('no encuentro dónde se arma «' + laLista + '», la lista que ve el conductor.');
    return nada;
  }

  // ── LA CADENA ENTERA, CON LISTA DE LO PERMITIDO ─────────────────────────
  //  Antes se prohibía `.filter` DETRÁS, y solo eso: un `.filter` delante y un
  //  `.slice(0, 20)` detrás pasaban los dos sin un rojo.
  const PERMITIDO = ['map', 'filter', 'sort', 'data', 'includes', 'getTime', 'toDate'];
  const metidas = [...c.matchAll(/\.(\w+)\(/g)].map((m) => m[1]);
  const colada = metidas.find((m) => !PERMITIDO.includes(m));
  if (colada) {
    quejas.push('a la lista del conductor se le encadenó `.' + colada + '(...)`. Eso puede '
      + 'quitar viajes de la pantalla sin tocar la lista de estados: la comprobación de la '
      + 'lista sigue verde y al conductor le desaparecen viajes igual.');
    return nada;
  }
  const cuantosFiltros = metidas.filter((m) => m === 'filter').length;
  if (cuantosFiltros !== 1) {
    quejas.push('la lista del conductor se filtra ' + cuantosFiltros + ' veces, y debe '
      + 'filtrarse UNA. Con dos, la buena puede estar perfecta y la otra quitar lo que quiera '
      + '— delante o detrás, da igual.');
    return nada;
  }

  // El `.map` que arma cada viaje NO decide el estado. Poniendo
  // `estado: 'finalizado'` ahí salían los 60 en verde «Completado» con su
  // tarifa, con el filtro intacto y todo en verde.
  const iMap = c.indexOf('.map(');
  // 🔴 SIN `.map(` NO HAY VEREDICTO, no «no pasa nada». Aquí es donde se arma
  // cada viaje a partir del documento; si falta, o no se encontró. Y faltando
  // se caía sola la comprobación de abajo Y el escape que la prueba usa para
  // vigilarla — que además se SALTABA EN SILENCIO. Con un solo `const iMap = -1`
  // en este archivo se colaba `estado: 'finalizado'` en el map y los 60 viajes
  // salían verdes «Completado» con su tarifa, todo en verde. Lo midió la
  // segunda opinión.
  if (iMap < 0) {
    quejas.push('la cadena que arma la lista del conductor no tiene ningún `.map(...)`, que es '
      + 'donde cada documento se convierte en un viaje. O cambió de forma, o no la estoy '
      + 'leyendo entera: sin eso no puedo comprobar que nadie le ponga el `estado` a mano.');
    return nada;
  }
  {
    const arg = argumentoDe(c, iMap + 4);
    if (arg && /\bestado\b/.test(arg)) {
      quejas.push('el `.map(...)` que arma cada viaje toca el campo `estado`. Ahí se le puede '
        + 'poner a todos el que se quiera, y entonces el filtro y la bandera deciden sobre un '
        + 'dato inventado: los viajes salen verdes «Completado» con su tarifa.');
      return nada;
    }
  }

  // ── 🔴 AQUÍ SE MIDE DE VERDAD: SE CORRE EL FILTRO DE LA PANTALLA ────────
  const iFiltro = c.indexOf('.filter(');
  const laFlecha = argumentoDe(c, iFiltro + 7);
  if (!laFlecha) {
    quejas.push('no pude leer el filtro de la lista del conductor: los paréntesis no cierran.');
    return nada;
  }
  const raro = pareceSeguro(laFlecha, true);
  if (raro) {
    quejas.push('el filtro de la pantalla ' + raro + ': «' + laFlecha.trim().slice(0, 70)
      + '…». Aquí ese trozo SE EJECUTA para medir qué deja pasar, así que no se corre.');
    return nada;
  }
  let prueba;
  try {
    prueba = new Function('ESTADOS_TERMINADOS', 'return (' + laFlecha + ');')(laQueUsa);
  } catch (e) {
    quejas.push('el filtro de la pantalla no se puede correr aquí («' + laFlecha.trim().slice(0, 70)
      + '…»): ' + e.message + '. Sin correrlo no se puede saber qué viajes deja pasar.');
    return nada;
  }
  const entran = [];
  for (const e of TODOS_LOS_ESTADOS) {
    let pasa;
    try { pasa = !!prueba({ estado: e }); } catch (err) { pasa = false; }
    if (pasa) entran.push(e);
  }

  // ── LA SEGUNDA MITAD: LA BANDERA, TAMBIÉN CORRIDA ───────────────────────
  //  Una sola, en todo el archivo: un señuelo puesto en un ayudante de arriba
  //  dejaba la bandera de la tarjeta con la lista corta y los 40 en verde.
  // `const`, `let` o `var`: exigir `const` daba ROJO FALSO sobre código igual
  // de bueno.
  const banderas = [...archivo.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(v\.estado[^;]*);/g)];
  if (banderas.length !== 1) {
    quejas.push(banderas.length === 0
      ? 'no encuentro la bandera que decide si el viaje sale verde «Completado» o rojo. Si '
        + 'cambió de forma, hay que mirarla a mano.'
      : 'en AppConductor.js hay ' + banderas.length + ' banderas `const ... = v.estado...`, y '
        + 'debe haber UNA. Con dos, la de arriba puede decir la verdad y la de la tarjeta no.');
    return { entran, rojos: null, bandera: null, tope, quejas };
  }
  const bandera = banderas[0];
  const raraBandera = pareceSeguro(bandera[2], false);
  if (raraBandera) {
    quejas.push('la bandera ' + raraBandera + ': «' + bandera[2].trim() + '». Aquí ese trozo '
      + 'SE EJECUTA para medir qué sale rojo, así que no se corre.');
    return { entran, rojos: null, bandera: bandera[1], tope, quejas };
  }
  let decide;
  try {
    decide = new Function('return (v) => (' + bandera[2] + ');')();
  } catch (e) {
    quejas.push('la bandera «' + bandera[2].trim() + '» no se puede correr aquí: ' + e.message);
    return { entran, rojos: null, bandera: bandera[1], tope, quejas };
  }
  const rojos = [];
  for (const e of entran) {
    let rojo;
    try { rojo = !!decide({ estado: e }); } catch (err) { rojo = false; }
    if (rojo) rojos.push(e);
  }

  // 🔴 LOS TROZOS, TAL COMO ESTÁN ESCRITOS. La prueba «no se puede ablandar»
  // los usa de ancla para meterle los escapes. Antes los llevaba copiados a
  // mano y entonces renombrar la bandera o pasar Prettier ponía ROJA una
  // prueba sobre código correcto, con el mensaje «esta lista se quedó vieja».
  return {
    entran, rojos, tope, quejas, archivo, cuerpo: t,
    bandera: bandera[1],
    trozos: {
      importe: trae ? trae[0] : null,
      filtro: '.filter(' + laFlecha + ')',
      banderaEntera: bandera[0],
      mapa: iMap >= 0 ? '.map(' + argumentoDe(c, iMap + 4) + ')' : null,
      alaPantalla: alaPantalla[0],
      abreLaPantalla: seEnsena ? seEnsena[0] : null,
      tope: elTope ? elTope[0] : null,
      consulta: laConsulta ? laConsulta[0] : null,
    },
  };
}

/**
 * EL TROZO DE PANTALLA QUE DICE EL RESULTADO, y las tarjetas que lo rodean.
 *
 * Se devuelve el `<p>` ENTERO, no el renglón: Prettier parte ese JSX en cuanto
 * lo toca, y exigir que todo cupiera en una línea daba ROJO sobre código
 * correcto. Un amarre que se pone rojo por nada acaba desactivado.
 */
function elTrozoDelResultado(p) {
  const malo = (m) => ({ error: m });
  if (!p || !p.cuerpo || !p.bandera) return malo('no pude leer la pantalla, así que tampoco su tarjeta.');
  const { cuerpo, bandera } = p;

  // Las tarjetas salen de `viajes.map(`, sin recortes por el camino.
  const lasTarjetas = /\{\s*(\w+)((?:\.\w+\([^)]*\))*)\.map\(/.exec(cuerpo);
  if (!lasTarjetas) return malo('no encuentro el `.map(...)` que pinta las tarjetas.');
  if (lasTarjetas[2]) {
    return malo('antes de pintar las tarjetas se le encadena `' + lasTarjetas[2] + '` a la '
      + 'lista. Eso se hace después de todo lo demás: si recorta u ordena de otra forma, la '
      + 'lista puede estar completa y el conductor seguir sin ver sus viajes.');
  }
  const iMapa = cuerpo.indexOf('.map(', lasTarjetas.index);
  const cuerpoTarjeta = argumentoDe(cuerpo, iMapa + 4) || '';

  // 🔴 UN SOLO `return`, EL DE LA TARJETA. La versión anterior buscaba la
  // palabra `null`, así que `return <span key={v.id} />`, `return false` o
  // `return <React.Fragment />` hacían desaparecer los 60 viajes no completados
  // con las pruebas en verde. Lo midió la segunda opinión: lo que hay que
  // prohibir no es una palabra, es LA SALIDA TEMPRANA.
  const salidas = (cuerpoTarjeta.match(/\breturn\b/g) || []).length;
  if (salidas !== 1) {
    return malo('la tarjeta del historial tiene ' + salidas + ' `return`, y debe tener UNO: el '
      + 'que la pinta. Con otro delante, hay viajes que entran en la lista y aun así no se '
      + 'pintan — desaparecen igual, solo que un paso más tarde.');
  }

  const cuantos = (cuerpo.match(/['"]Completado['"]/g) || []).length;
  if (cuantos !== 1) {
    return malo('en la tarjeta del historial hay ' + cuantos + ' sitios que dicen «Completado»'
      + (cuantos === 0 ? ', y debería haber UNO: la palabra que ve el conductor cuando el viaje '
        + 'sí se completó.'
        : ', y debería haber UNO. Con dos, uno puede decir la verdad y el otro no.'));
  }
  const i = cuerpo.search(/['"]Completado['"]/);
  const abre = cuerpo.lastIndexOf('<p', i);
  const cierra = cuerpo.indexOf('</p>', i);
  if (abre < 0 || cierra < 0) {
    return malo('el «Completado» de la tarjeta ya no está dentro de un `<p>`: no sé qué trozo '
      + 'de pantalla mirar.');
  }
  const texto = cuerpo.slice(abre, cierra);

  // EL COLOR, EXACTO. Con un «contiene» bastaba dejar
  // `color: x ? '#2ECC71' : '#2ECC71'` y un `#FF4444` de adorno al lado para
  // pintarlo todo verde con la prueba en verde.
  //  Se exige la FORMA —la bandera manda, y los dos colores son DISTINTOS—, no
  //  los códigos concretos: comparándolos letra por letra, cambiar el rojo o el
  //  verde del tema ponía la suite roja sobre un cambio que no rompe nada.
  const apretado = texto.replace(/\s+/g, '').split('"').join("'");
  const elTernario = new RegExp('color:' + bandera + "\\?'(#\\w+)':'(#\\w+)'").exec(apretado);
  if (!elTernario) {
    return malo('el color del resultado ya no es «' + bandera + ' ? un color : otro». Dice: '
      + (/color:[^,]*/.exec(apretado) || ['?'])[0] + '. Con el color suelto, un viaje que no se '
      + 'completó se ve igual que uno hecho.');
  }
  if (elTernario[1] === elTernario[2]) {
    return malo('el resultado le pregunta a «' + bandera + '» y luego pinta el MISMO color en '
      + 'los dos casos (' + elTernario[1] + '). La pregunta está y no sirve de nada: un viaje '
      + 'que no se completó se ve igual que uno hecho.');
  }

  // ── 🔴 LA BANDERA SE USA EN TODA LA TARJETA UN NÚMERO EXACTO DE VECES ───
  //
  //  Y se cuenta en LA TARJETA ENTERA, no dentro del `<p>`. Contándola solo en
  //  el `<p>` la segunda opinión la burló dos veces, las dos sacando el uso un
  //  renglón afuera:
  //    · `return noCompletado ? null : (` — la tarjeta no se pinta
  //    · `<div style={{ display: noCompletado ? 'none' : 'block', ... }}>`
  //  Las dos con el color exacto, la lista entera y todo en verde; y las dos
  //  dejan al conductor sin ver 40 viajes.
  //
  //  Es un NÚMERO, no una lista de palabras prohibidas, y a propósito: las dos
  //  versiones anteriores prohibían palabras (`null`, y luego `return`) y a las
  //  dos se les dio la vuelta con otra palabra. La bandera decide QUÉ VE el
  //  conductor: cualquier uso nuevo cambia eso, así que cualquier uso nuevo
  //  tiene que mirarlo una persona. Si el que llega es legítimo, se sube el
  //  número aquí y se dice por qué.
  const USOS = 4; // la declaración · el color · el texto · el renglón de la razón
  const usos = (cuerpoTarjeta.match(new RegExp('\\b' + bandera + '\\b', 'g')) || []).length;
  if (usos !== USOS) {
    return malo('en la tarjeta del historial «' + bandera + '» se usa ' + usos + ' veces, y '
      + 'deben ser ' + USOS + ': donde se declara, el color, el texto y el renglón de la razón. '
      + 'Un uso de más puede esconder la tarjeta entera —`display: none`, o un `return ? null :`— '
      + 'sin tocar ni el color ni la lista, y el conductor deja de ver sus viajes igual. Si el '
      + 'uso nuevo es bueno, se sube el número en `medir-historial-conductor.cjs` y se explica.');
  }

  // EL NOMBRE DE LA TABLA SE SACA DE AQUÍ, no se da por supuesto: renombrarla es
  // legítimo y exigir «QUE_PASO» daba ROJO FALSO sobre código correcto.
  const laTabla = /(\w+)\s*\[\s*v\.estado\s*\]/.exec(texto);
  if (!laTabla) {
    return malo('el trozo del resultado escribe el texto a mano en vez de sacarlo de una tabla '
      + 'de nombres (`TABLA[v.estado]`). La tabla puede estar perfecta y no usarse.');
  }

  // ── LOS NOMBRES EN PALABRAS ─────────────────────────────────────────────
  //  Vive AQUÍ, no en el amarre, para que lo vean los dos y para que la prueba
  //  que le mete escapes al lector también lo cubra.
  //  Se busca en TODO el archivo, no dentro de la función: sacar la tabla al
  //  módulo —para no rehacerla en cada tarjeta— es legítimo, y exigirla dentro
  //  daba ROJO sobre código correcto.
  const tabla = laTabla[1];
  const decl = new RegExp('(?:const|let|var)\\s+' + tabla + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};')
    .exec(p.archivo);
  if (!decl) {
    return malo('la tarjeta saca el texto de `' + tabla + '[v.estado]` y no encuentro dónde se '
      + 'declara `' + tabla + '`, que es lo que pone en palabras cada forma de no completar.');
  }
  const dice = {};
  for (const m of decl[1].matchAll(/['"]?([a-z_]+)['"]?\s*:\s*['"]([^'"]*)['"]/g)) {
    dice[m[1]] = m[2];
  }
  for (const e of (p.rojos || [])) {
    if (dice[e] === undefined) {
      return malo('a `' + tabla + '` le falta «' + e + '», así que ese viaje saldría con el '
        + 'nombre CRUDO del estado en la pantalla del conductor.');
    }
    // 🔴 Que la llave esté no basta. Con `cancelado: ''` la tabla tiene sus
    // cuatro llaves, el `|| v.estado` de la tarjeta se dispara y sale el nombre
    // crudo igual. Lo midió la segunda opinión.
    if (!dice[e].trim()) {
      return malo('en `' + tabla + '`, «' + e + '» no dice nada («' + dice[e] + '»). La llave '
        + 'está, pero en pantalla sale el nombre crudo del estado igual.');
    }
  }
  if (/Completado/.test(decl[1])) {
    return malo('uno de los nombres de `' + tabla + '` dice «Completado». Son los finales que '
      + 'NO se completaron: si uno dice eso, vuelve la mentira por la puerta de al lado.');
  }
  // Y que no digan todos lo mismo: cuatro finales con un solo nombre es
  // volver a «no se completó» y no decir CUÁL de las cuatro cosas pasó.
  const distintos = new Set((p.rojos || []).map((e) => dice[e]));
  if ((p.rojos || []).length > 1 && distintos.size === 1) {
    return malo('los ' + p.rojos.length + ' finales de `' + tabla + '» dicen todos lo mismo («'
      + [...distintos][0] + '»). El conductor vuelve a no saber cuál de las cuatro cosas pasó.');
  }

  // El color y el `.map(` tal como están escritos: anclas para la prueba de los
  // escapes, que si no tendría que llevarlos copiados y se quedaría vieja.
  const elColor = /color:\s*[^,}]*/.exec(texto);
  // El texto del resultado tal como está escrito (`TABLA[v.estado] || v.estado`,
  // o con `??`): era el ÚLTIMO ancla que la prueba de los escapes llevaba
  // copiada a mano, y cambiar el `||` por `??` la ponía roja sobre código bueno.
  const elTexto = /\w+\s*\[\s*v\.estado\s*\]\s*(?:\|\||\?\?)\s*v\.estado/.exec(texto);
  return {
    texto, tarjetas: lasTarjetas[0], tabla, nombres: dice,
    flechaTarjeta: cuerpoTarjeta,
    declTabla: decl[0],
    color: elColor ? elColor[0] : null,
    elTexto: elTexto ? elTexto[0] : null,
    tarjetaAbre: (/<div[^>]*style=\{\{ [^}]*\}\}>/.exec(cuerpoTarjeta) || [null])[0],
    // El `return (` de la tarjeta CON su `<div` pegado: a secas hay otros
    // `return (` antes en el archivo y el ancla cogía el que no era.
    tarjetaVuelve: (/return\s*\(\s*<div/.exec(cuerpoTarjeta) || [null])[0],
  };
}

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 160));
  return x.access_token;
}

async function traer(sesion, coleccion) {
  const todos = [];
  let pagina;
  do {
    const url = BASE + '/' + coleccion + '?pageSize=300' + (pagina ? '&pageToken=' + pagina : '');
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + sesion } });
    if (!r.ok) throw new Error('no pude leer ' + coleccion + ': ' + r.status);
    const j = await r.json();
    todos.push(...(j.documents || []));
    pagina = j.nextPageToken;
  } while (pagina);
  return todos;
}

const val = (v) => (v == null ? undefined : v.stringValue);

// 🔴 EL AMARRE IMPORTA ESTAS DOS, para que el recorrido exista UNA sola vez
// (SEGUNDA LEY). Por eso el informe de abajo va detrás de `require.main`: sin
// eso, cada `npm test` abriría sesión contra Firestore vivo y se pondría a
// pedir los 91 viajes — una prueba no sale a internet.
module.exports = { loQueHaceLaPantalla, elTrozoDelResultado };
if (require.main !== module) return;

(async () => {
  const p = loQueHaceLaPantalla();
  console.log('');
  console.log(C.neg + '  EL HISTORIAL DEL CONDUCTOR' + C.off);
  console.log(C.gris + '  ' + PANTALLA + C.off);
  console.log('');
  console.log('  ' + C.neg + 'LO QUE HACE LA PANTALLA HOY' + C.off);
  console.log('    ' + pad('viajes que entran', 26)
    + (p.entran ? JSON.stringify(p.entran) : C.roj + 'no lo pude leer' + C.off));
  console.log('    ' + pad('se pintan de ROJO', 26)
    + (p.rojos ? JSON.stringify(p.rojos) : C.roj + 'no lo pude leer' + C.off));
  console.log(C.gris + '    (todo lo que entra y no está en rojo sale VERDE «Completado», '
    + 'con su tarifa)' + C.off);

  console.log('    ' + pad('pide como mucho', 26)
    + (p.tope ? p.tope + ' viajes' : C.roj + 'no lo pude leer' + C.off));

  // Y el trozo de pantalla, que es lo que de verdad ve el conductor: la lista
  // puede estar perfecta y la tarjeta pintar el verde a pelo.
  if (p.cuerpo) {
    const trozo = elTrozoDelResultado(p);
    if (trozo.error) p.quejas.push(trozo.error);
  }

  // CEGADO ≠ MAL. Cegado es «no pude medir»; las quejas son «lo que está mal».
  // Antes cualquier queja cegaba el conteo, y entonces este guion no podía
  // contar el código VIEJO — que es lo que hace falta para carear el paso 1 con
  // el paso 12.
  const cegado = !p.entran || !p.rojos;
  if (cegado) {
    console.log('');
    console.log(C.roj + '    ✗ la pantalla cambió de forma y no la pude leer: NO HAY VEREDICTO.'
      + C.off);
  }
  if (p.quejas.length) {
    console.log('');
    for (const q of p.quejas) console.log(C.roj + '    ✗ ' + q + C.off);
  }

  let sesion;
  try {
    sesion = await token();
  } catch (e) {
    console.log('');
    console.log(C.ama + '    ⚠ sin sesión de firebase: ' + e.message + C.off);
    return;
  }

  const viajes = await traer(sesion, 'viajes');
  const conConductor = viajes.filter((v) => val((v.fields || {}).conductorId));

  // Por conductor: la pantalla es de cada uno.
  const porConductor = {};
  for (const v of conConductor) {
    const c = val((v.fields || {}).conductorId);
    (porConductor[c] = porConductor[c] || []).push(val((v.fields || {}).estado));
  }

  console.log('');
  console.log('  ' + C.neg + 'LO QUE VE CADA CONDUCTOR, DE LO SUYO' + C.off);
  console.log('    ' + pad('conductor', 14) + pad('suyos', 8) + pad('los ve', 8)
    + pad('FALTAN', 9) + pad('en VERDE sin serlo', 20) + 'al tope');
  let faltanTotal = 0;
  let verdesTotal = 0;
  let alTope = 0;
  let pasadosDelTope = 0;
  for (const [c, estados] of Object.entries(porConductor).sort((a, b) => b[1].length - a[1].length)) {
    const terminados = estados.filter((e) => ESTADOS_TERMINADOS.includes(e));
    const ve = cegado ? [] : terminados.filter((e) => p.entran.includes(e));
    const faltan = terminados.length - (cegado ? 0 : ve.length);
    // De los que ve, ¿cuántos salen verdes sin ser `finalizado`?
    const verdesFalsos = cegado ? 0
      : ve.filter((e) => e !== 'finalizado' && !p.rojos.includes(e)).length;
    faltanTotal += faltan;
    verdesTotal += verdesFalsos;
    // EL OTRO TOPE, el que llega solo: la consulta pide como mucho `p.tope`
    // viajes, sin decir por cuál empezar. Este conductor tiene TODOS los suyos,
    // no solo los terminados — por eso se cuenta sobre `estados.length`.
    const pasado = p.tope && estados.length > p.tope;
    const cerca = p.tope && estados.length > p.tope * 0.9;
    if (pasado) pasadosDelTope += 1;
    else if (cerca) alTope += 1;
    console.log('    ' + pad(c.slice(0, 12), 14) + pad(terminados.length, 8)
      + pad(cegado ? '?' : ve.length, 8)
      + (faltan > 0 ? C.roj : C.ver) + pad(faltan, 9) + C.off
      + (verdesFalsos > 0 ? C.roj : C.ver) + pad(verdesFalsos, 20) + C.off
      + (p.tope ? (pasado ? C.roj : (cerca ? C.ama : C.gris)) + estados.length + ' de '
        + p.tope + C.off : ''));
  }

  console.log('');
  if (alTope > 0) {
    console.log(C.ama + '  ⚠ ' + alTope + ' conductor(es) rozando el tope de ' + p.tope
      + '. Al pasarlo, el servidor elige cuáles se caen' + C.off);
    console.log(C.ama + '    —la consulta no dice por cuál empezar— y vuelven a desaparecer '
      + 'registros, ya sin culpa de la lista.' + C.off);
    console.log('');
  }
  // 🔴 EL TOPE ES PARTE DEL VEREDICTO, no un aviso al margen. Con `limit(5)`
  // este guion decía «⚠ 3 rozando el tope» y dos renglones más abajo
  // «✓ cada conductor ve todos sus viajes»: se contradecía a sí mismo en la
  // misma pantalla, y el `✓` era falso. Lo midió la segunda opinión.
  if (pasadosDelTope > 0) {
    console.log(C.roj + '  🔴 ' + pasadosDelTope + ' conductor(es) tienen MÁS de ' + p.tope
      + ' viajes, que es lo máximo que pide la pantalla.' + C.off);
    console.log(C.roj + '     A ésos les faltan viajes en su historial — y no por la lista de '
      + 'estados, sino por el `limit`.' + C.off);
    console.log('');
  }
  if (cegado) {
    console.log(C.roj + '  ✗ NO HAY VEREDICTO: no pude leer lo que hace la pantalla.' + C.off);
  } else if (p.quejas.length) {
    console.log(C.roj + '  🔴 la pantalla del historial NO pasa: ' + p.quejas.length
      + ' cosa(s) mal, arriba.' + C.off);
    if (faltanTotal > 0) {
      console.log(C.roj + '     y ' + faltanTotal + ' viajes no los ve NINGÚN conductor.' + C.off);
    }
    if (verdesTotal > 0) {
      console.log(C.roj + '     y ' + verdesTotal + ' salen en VERDE «Completado» sin serlo.' + C.off);
    }
  } else if (faltanTotal === 0 && verdesTotal === 0 && pasadosDelTope === 0) {
    console.log(C.ver + '  ✓ cada conductor ve todos sus viajes terminados, y ninguno sale '
      + 'verde sin serlo.' + C.off);
  } else {
    if (faltanTotal > 0) {
      console.log(C.roj + '  🔴 ' + faltanTotal + ' viajes no los ve NINGÚN conductor en su '
        + 'historial.' + C.off);
    }
    if (verdesTotal > 0) {
      console.log(C.roj + '  🔴 ' + verdesTotal + ' salen en VERDE «Completado», con su tarifa '
        + 'debajo, sin haber' + C.off);
      console.log(C.roj + '     terminado bien. El conductor ve un trabajo hecho y cobrado que '
        + 'no lo fue.' + C.off);
    }
  }
  console.log('');
})().catch((e) => { console.error('FALLÓ: ' + e.message); process.exit(1); });
