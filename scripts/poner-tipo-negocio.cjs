#!/usr/bin/env node
/**
 * QUE TODO NEGOCIO DIGA QUÉ ES — el esqueleto, paso 1.
 *
 *   node scripts/poner-tipo-negocio.cjs            <- SIMULACRO: no escribe nada
 *   node scripts/poner-tipo-negocio.cjs --aplicar  <- escribe de verdad
 *
 * El simulacro y la aplicación son EL MISMO CÓDIGO: solo cambia si al final se
 * llama o no a la escritura. Un ensayo de otra obra no es un ensayo.
 *
 * ── POR QUÉ ─────────────────────────────────────────────────────────────────
 * Decisión del dueño (6-sep-2026): el software de aliados se VENDE, y va a ser UNO
 * SOLO con módulos —restaurantes, hoteles, turismo, peluquerías— porque un hotel
 * puede tener restaurante y eso, con programas separados, serían dos cuentas.
 *
 * En ese mundo `tipoNegocio` cambia de oficio: ya no es «lo que el código mira
 * para bifurcarse» —eso es justo lo que pudre un sistema modular— sino EL PAQUETE
 * COMERCIAL que decide qué módulos vienen encendidos de fábrica.
 *
 * Y para eso tiene que existir. Medido el 6-sep-2026 con
 * scripts/medir-esqueleto.cjs: de 3 negocios, DOS no lo tienen.
 *
 * ── POR QUÉ NO ROMPE NADA ───────────────────────────────────────────────────
 * Las OCHO lecturas de ese campo ya tratan como restaurante a quien no lo dice:
 *   · guajirago/src/Restaurantes.js:114   `tipoNegocio !== 'turismo'`  -> lo enseña
 *   · guajirago/src/Turismo.js:44         `== 'turismo'`               -> no lo enseña
 *   · admin/Restaurantes.js:29            `!== 'turismo'`              -> sale en la lista
 *   · admin/Turismo.js:29                 `=== 'turismo'`              -> no sale
 *   · admin/AliadosPendientes.js:93 y :96 el icono y la etiqueta        -> igual
 *   · aliados/App.js:91                   `|| 'restaurante'`  (al recargar)
 *   · aliados/App.js:210                  `|| 'restaurante'`  (al entrar)
 *   · aliados/App.js:97                   lee del EMPLEADO, otra colección
 * Y en `guajirago/functions/index.js` y en `firestore.rules`: CERO menciones.
 *
 * O sea: escribir `tipoNegocio: 'restaurante'` en un negocio que ya se comporta
 * como restaurante NO CAMBIA NADA para nadie. Escribe lo que el sistema ya asume.
 *
 * ESTE COMENTARIO DECÍA «CINCO SITIOS» Y ERA FALSO. Son ocho, y las tres que
 * faltaban las encontró la segunda opinión buscando en las carpetas de los otros
 * dos repos — que están en `.gitignore`, así que una búsqueda normal SE LAS SALTA
 * EN SILENCIO. Ninguna de las tres cambia de comportamiento, así que la conclusión
 * aguanta; el número no aguantaba.
 *
 * ── LO QUE ESTE GUION NO SABE, Y HAY QUE SABERLO ────────────────────────────
 * `decidir` conoce DOS tipos: restaurante y turismo. El dueño va a vender también
 * a HOTELES y PELUQUERÍAS. Un hotel con restaurante tiene mesas y pedido mínimo y
 * ninguna señal de hotel — este guion le escribiría «restaurante» con toda
 * confianza. Hoy no muerde porque aliados/Login.js SIEMPRE escribe el tipo al
 * registrarse, así que un negocio nuevo nunca llega aquí sin él. Pero el día que
 * se añada un tipo, HAY QUE AÑADIR SUS SEÑALES A LA LISTA antes de re-correr esto.
 *
 * ── ANOTADO, NO ARREGLADO ───────────────────────────────────────────────────
 * `tipoNegocio` NO está en `camposDelPanel()` de firestore.rules, así que hoy un
 * negocio PUEDE CAMBIARSE SU PROPIO TIPO desde su app. Si ese campo va a decidir
 * qué módulos vienen encendidos, un cliente se enciende los caros él solo. Esta
 * escritura no lo empeora, pero hay que cerrarlo ANTES DE VENDER.
 *
 * ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
 *   · NO toca ningún negocio que YA tenga `tipoNegocio`. Si alguien lo puso, esa
 *     decisión manda.
 *   · NO adivina. Si las señales se contradicen o no hay ninguna, lo DEJA y lo
 *     dice, para que lo decida el dueño. Un guion que adivina el tipo de negocio
 *     de un cliente que paga es un guion que se equivoca en silencio.
 *   · NO toca `aprobado` ni `estadoAprobacion`. Eso NO es un arreglo, es una
 *     decisión del dueño, y ya la tomó: «son de prueba, no hemos comenzado
 *     operaciones» (26-ago-2026). Sigue parado.
 *   · No borra nada (REGLA 12).
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ── LA DECISIÓN, APARTE Y PURA ────────────────────────────────────────────
// Vive separada de la plomería de red para que las pruebas la puedan ejercitar
// sin tocar Firestore. Es el mismo patrón de scripts/vaciar-escaparate.cjs.

// Las señales que delatan de qué tipo es un negocio que no lo dice. Salen de los
// campos que cada pantalla escribe, no de la imaginación.
//
// `costoEnvio` NO ESTÁ AQUÍ, y no es un olvido: medido el 6-sep-2026, ese campo
// NO LO ESCRIBE NI LO LEE NADIE en las tres apps — es un fósil de una versión
// vieja que quedó en los datos de 2 de los 3 negocios. Una señal que el sistema
// ya no mantiene puede desaparecer el día que alguien limpie, y entonces la
// deducción se rompe sin que nadie lo note. Lo cazó la propia prueba que exige
// que cada señal la escriba una pantalla de verdad.
// Quitarlo no cambia ninguna deducción: los dos negocios que hay se delatan
// igual por sus otros campos.
const SENALES = {
  turismo: ['tours', 'alquileres'],
  restaurante: ['numeroMesas', 'flujoDomicilio', 'flujoLocal', 'demoraMin',
    'pedidoMinimo'],
};

/**
 * Qué hacer con un negocio. Devuelve siempre el porqué, para que el simulacro
 * pueda enseñarlo y el dueño lo pueda discutir.
 *
 * @param campos  los nombres de los campos que trae el documento
 * @param tipoActual  lo que ya dice, si dice algo
 */
function decidir(campos, tipoActual) {
  const tiene = (c) => campos.includes(c);

  if (tipoActual) {
    return { accion: 'dejar', porque: 'ya dice que es «' + tipoActual + '»' };
  }

  const pistas = {};
  for (const [tipo, lista] of Object.entries(SENALES)) {
    const encontradas = lista.filter(tiene);
    if (encontradas.length) pistas[tipo] = encontradas;
  }
  const tipos = Object.keys(pistas);

  if (tipos.length === 1) {
    return {
      accion: 'poner',
      tipo: tipos[0],
      porque: 'lo delatan sus campos: ' + pistas[tipos[0]].join(', '),
    };
  }
  if (tipos.length > 1) {
    return {
      accion: 'preguntar',
      porque: 'las señales se CONTRADICEN — '
        + tipos.map((t) => t + ' (' + pistas[t].join(', ') + ')').join(' y '),
    };
  }
  return { accion: 'preguntar', porque: 'no tiene ni una señal de qué es' };
}

/**
 * A DÓNDE SE ESCRIBE. Aparte y pura, para que las pruebas la puedan mirar.
 *
 * ESTO NO ES UN ADORNO: la segunda opinión soltó 18 mutantes contra este guion y
 * sobrevivieron 14 — SIETE de ellos aquí, en la plomería que escribe, porque
 * ninguna prueba miraba estos renglones. Entre los que sobrevivían:
 *
 *   · quitar el `updateMask` -> el PATCH REEMPLAZA EL DOCUMENTO ENTERO y le borra
 *     al negocio el menú, el horario y las mesas. Nadie se enteraba.
 *   · apuntar a otra colección. Nadie se enteraba.
 *   · escribir siempre 'restaurante' en vez del tipo deducido. Nadie se enteraba.
 *
 * El `updateMask.fieldPaths=tipoNegocio` es lo único que hace que este PATCH toque
 * UN campo en vez de tragarse el documento. Si desaparece, se pierden datos de un
 * cliente que paga.
 *
 * Y EL IDENTIFICADOR VA CODIFICADO. Sin eso, un identificador con `?` o con `#`
 * parte la dirección: la máscara se queda fuera y el PATCH arrasa el documento.
 * Hoy no puede pasar —los tres son uid de Firebase, letras y números— pero es una
 * bomba sin espoleta, y taparla es una línea.
 */
function direccionDeEscritura(base, negocioId) {
  return base + '/restaurantes/' + encodeURIComponent(negocioId)
    + '?updateMask.fieldPaths=tipoNegocio';
}

/** Lo que se manda dentro. Un solo campo, y de texto. */
function cuerpoDeEscritura(tipo) {
  return { fields: { tipoNegocio: { stringValue: tipo } } };
}

/**
 * A QUIÉN se le escribe, de todo lo que se leyó. Solo a los que `decidir` dijo
 * «poner» — nunca a los que dijo «preguntar» ni a los que dijo «dejar».
 *
 * ESTO ES EL CORAZÓN DEL DISEÑO Y ESTABA SIN VIGILAR. La segunda opinión cambió
 * `accion === 'poner'` por `accion !== 'dejar'` dentro del bucle y las 18 pruebas
 * siguieron VERDES: con eso, los negocios sobre los que el guion había decidido
 * PREGUNTARLE AL DUEÑO entraban en la lista de escritura y se les inventaba un
 * tipo. Es exactamente lo que todo este guion existe para impedir, y el único
 * renglón que lo garantizaba no lo miraba nadie.
 *
 * Hoy no muerde —no hay ninguno para preguntar— pero el día que llegue un hotel
 * sin señales conocidas, muerde.
 */
function aQuienSeLeEscribe(decisiones) {
  return decisiones.filter((d) => d.accion === 'poner');
}

module.exports = {
  decidir, SENALES, direccionDeEscritura, cuerpoDeEscritura, aQuienSeLeEscribe,
};

// ── DE AQUÍ ABAJO, LA PLOMERÍA ────────────────────────────────────────────
// Solo corre si se llama al guion directamente; si lo cargan las pruebas, no.
if (require.main !== module) return;

const PROYECTO = 'guajirago';
const CI = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CS = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const SES = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
const BASE = 'https://firestore.googleapis.com/v1/projects/' + PROYECTO
  + '/databases/(default)/documents';

const APLICAR = process.argv.includes('--aplicar');
const val = (v) => v == null ? undefined : v.stringValue;

async function token() {
  const j = JSON.parse(fs.readFileSync(SES, 'utf8'));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CI, client_secret: CS,
      refresh_token: j.tokens.refresh_token, grant_type: 'refresh_token',
    }),
  });
  const x = await r.json();
  if (!x.access_token) throw new Error('no pude abrir sesión: ' + JSON.stringify(x).slice(0, 200));
  return x.access_token;
}

(async () => {
  const t = await token();
  const r = await fetch(BASE + '/restaurantes?pageSize=300', { headers: { Authorization: 'Bearer ' + t } });
  if (!r.ok) throw new Error('no pude leer los negocios: ' + r.status);
  const docs = (await r.json()).documents || [];

  console.log(APLICAR ? '\n*** APLICANDO DE VERDAD ***\n' : '\n=== SIMULACRO — no se escribe nada ===\n');
  console.log('negocios en el servidor: ' + docs.length + '\n');

  // Se decide sobre TODOS primero, y luego una sola función elige a quién se le
  // escribe. Antes el bucle metía en la lista según su propio `if`, y ese renglón
  // —el único que garantizaba que a un «preguntar» no se le escribe— no lo
  // vigilaba ninguna prueba.
  const decisiones = [];
  const aPreguntar = [];

  for (const d of docs) {
    const f = d.fields || {};
    const id = d.name.split('/').pop();
    const nombre = val(f.nombre) || '(sin nombre)';
    const d2 = { ...decidir(Object.keys(f), val(f.tipoNegocio)), id, nombre };
    decisiones.push(d2);

    console.log('· ' + nombre + '   ' + id);
    if (d2.accion === 'dejar') {
      console.log('    SE QUEDA COMO ESTÁ: ' + d2.porque + '\n');
    } else if (d2.accion === 'poner') {
      console.log('    quedaría:  tipoNegocio = «' + d2.tipo + '»');
      console.log('    por qué:   ' + d2.porque);
      console.log('    y con eso: nada cambia para nadie — las OCHO lecturas de');
      console.log('               ese campo ya lo tratan así. Solo deja de adivinarse.\n');
    } else {
      console.log('    *** NO SE TOCA: ' + d2.porque);
      console.log('    lo decide el dueño, negocio por negocio.\n');
      aPreguntar.push({ id, nombre, porque: d2.porque });
    }
  }

  // AQUI, y no dentro del bucle: una sola funcion decide a quien se le escribe.
  const aPoner = aQuienSeLeEscribe(decisiones);

  console.log('───────────────────────────────────────────────────────────');
  console.log('se pondría el tipo a: ' + aPoner.length + ' de ' + docs.length
    + '   ·   se quedan igual: ' + (docs.length - aPoner.length - aPreguntar.length)
    + '   ·   hay que preguntar por: ' + aPreguntar.length);

  if (!APLICAR) {
    console.log('\nNO SE ESCRIBIÓ NADA. Para aplicarlo de verdad:');
    console.log('   node scripts/poner-tipo-negocio.cjs --aplicar');
    return;
  }

  for (const n of aPoner) {
    const rr = await fetch(direccionDeEscritura(BASE, n.id), {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoDeEscritura(n.tipo)),
    });
    console.log((rr.ok ? '  ✓ ' : '  ✗ ') + n.nombre + '  ->  ' + n.tipo
      + (rr.ok ? '' : '   (' + rr.status + ')'));
  }
  console.log('\nHecho. Vuelve a correr scripts/medir-esqueleto.cjs para comprobarlo');
  console.log('LEYENDO del servidor, que es el paso 10.');
})().catch((e) => { console.error('\n✋ ' + e.message + '\n'); process.exit(1); });
